"""
HeatRouteID — Sharded Overpass bake for Jakarta + Depok.

Produces per-cell shade-gap GeoJSON shards so the frontend can load
only the cells intersecting the user's current viewport / route bbox
instead of one ~hundred-MB file.

Tile grid: regular lat/lon cells across the Jabodetabek bbox. Each
non-empty cell becomes `data/shards/r{row}c{col}.geojson`. A small
`data/shards/manifest.json` lists all shards with their bbox so the
frontend can map viewport → shard IDs in O(N) without downloading
shard contents first.

Run:
    cd heatroute-id/data_prep
    python overpass_jabodetabek.py            # full bake (resumable)
    python overpass_jabodetabek.py --dry-run  # print plan only
    python overpass_jabodetabek.py --cell r03c05  # single cell

Resume: shards already on disk are skipped. Failed cells are logged
to `data/shards/_failed.txt`; re-run picks them up.

Etiquette: 5s sleep between Overpass calls. With ~77 cells this is
~6 min minimum, ~15-30 min realistic depending on Overpass load.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

import requests

# Reuse scoring + geometry helpers from the Salemba bake.
from overpass_salemba import (
    OVERPASS_URL,
    VEG_LANDUSE,
    VEG_NATURAL,
    WALKABLE_HIGHWAYS,
    compute_segment_scores,
)

# ---------------------------------------------------------------------------
# Tile grid config
# ---------------------------------------------------------------------------
# Jabodetabek-ish bbox: Jakarta admin (~-6.37 to -6.09, 106.69 to 106.97)
# unioned with Depok (~-6.50 to -6.34, 106.74 to 106.91). Slight padding.
BBOX_SOUTH = -6.50
BBOX_WEST = 106.69
BBOX_NORTH = -6.09
BBOX_EAST = 106.97

CELL_DEG = 0.04  # ~4.4 km per cell at this latitude
QUERY_PAD_DEG = 0.001  # ~110 m — captures buildings near cell edges

THROTTLE_S = 5.0
MAX_RETRIES = 3
RETRY_BACKOFF_S = (10.0, 30.0, 90.0)

OUTPUT_DIR = Path(__file__).parent.parent / "data" / "shards"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
FAILED_LOG_PATH = OUTPUT_DIR / "_failed.txt"


# ---------------------------------------------------------------------------
# Grid math
# ---------------------------------------------------------------------------
def grid_dims() -> tuple[int, int]:
    """Number of (rows, cols) covering the bbox at CELL_DEG."""
    rows = int(round((BBOX_NORTH - BBOX_SOUTH) / CELL_DEG))
    cols = int(round((BBOX_EAST - BBOX_WEST) / CELL_DEG))
    return rows, cols


def cell_id(row: int, col: int) -> str:
    return f"r{row:02d}c{col:02d}"


def cell_bbox(row: int, col: int) -> tuple[float, float, float, float]:
    """Return (south, west, north, east) for the cell."""
    south = BBOX_SOUTH + row * CELL_DEG
    north = south + CELL_DEG
    west = BBOX_WEST + col * CELL_DEG
    east = west + CELL_DEG
    return (south, west, north, east)


def way_centroid(geom_lonlat: list[list[float]]) -> tuple[float, float]:
    """Return (lat, lon) centroid of a LineString geometry (avg of vertices)."""
    n = len(geom_lonlat)
    sum_lat = sum(p[1] for p in geom_lonlat)
    sum_lon = sum(p[0] for p in geom_lonlat)
    return sum_lat / n, sum_lon / n


def in_cell(lat: float, lon: float, bbox: tuple[float, float, float, float]) -> bool:
    s, w, n, e = bbox
    return s <= lat < n and w <= lon < e


# ---------------------------------------------------------------------------
# Overpass per-cell fetch (with retries)
# ---------------------------------------------------------------------------
def overpass_query_cell(
    bbox: tuple[float, float, float, float],
) -> dict[str, Any]:
    south, west, north, east = bbox
    qs, qw = south - QUERY_PAD_DEG, west - QUERY_PAD_DEG
    qn, qe = north + QUERY_PAD_DEG, east + QUERY_PAD_DEG
    bbox_str = f"({qs},{qw},{qn},{qe})"
    query = f"""
    [out:json][timeout:60];
    (
      way["highway"]{bbox_str};
      node["natural"="tree"]{bbox_str};
      way["building"]{bbox_str};
      way["leisure"="park"]{bbox_str};
      way["landuse"~"^(grass|forest|cemetery)$"]{bbox_str};
      way["natural"~"^(wood|scrub)$"]{bbox_str};
    );
    out body geom;
    """
    headers = {
        "User-Agent": "HeatRouteID/0.2 (IYREF 2026 hackathon; contact: farrel.pradipa@gmail.com)",
        "Accept": "application/json",
    }
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(
                OVERPASS_URL, data={"data": query}, headers=headers, timeout=90
            )
            if resp.status_code in (429, 503, 504):
                raise requests.HTTPError(f"server {resp.status_code}", response=resp)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, json.JSONDecodeError) as e:
            last_err = e
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_BACKOFF_S[attempt]
                print(f"    retry {attempt + 1}/{MAX_RETRIES} after {wait:.0f}s: {e}")
                time.sleep(wait)
    assert last_err is not None
    raise last_err


# ---------------------------------------------------------------------------
# Score one cell
# ---------------------------------------------------------------------------
def bake_cell(row: int, col: int) -> dict[str, Any] | None:
    """Query, score, and return shard payload for one cell.

    Returns None if the cell has no walkable features.
    """
    cid = cell_id(row, col)
    bbox = cell_bbox(row, col)
    raw = overpass_query_cell(bbox)
    elements = raw.get("elements", [])

    trees: list[dict[str, float]] = []
    buildings: list[dict[str, Any]] = []
    veg_polygons: list[dict[str, Any]] = []
    walkable_ways: list[dict[str, Any]] = []

    for el in elements:
        if el["type"] == "node" and el.get("tags", {}).get("natural") == "tree":
            trees.append({"lat": el["lat"], "lon": el["lon"]})
            continue
        if el["type"] != "way":
            continue
        tags = el.get("tags", {})
        if "building" in tags:
            buildings.append(el)
            continue
        if (
            tags.get("leisure") == "park"
            or tags.get("landuse") in VEG_LANDUSE
            or tags.get("natural") in VEG_NATURAL
        ):
            veg_polygons.append(el)
            continue
        if tags.get("highway") in WALKABLE_HIGHWAYS:
            walkable_ways.append(el)

    if not walkable_ways:
        return None

    veg_anchors: list[tuple[float, float]] = []
    for poly in veg_polygons:
        for node in poly.get("geometry", []):
            veg_anchors.append((node["lat"], node["lon"]))

    features = []
    for way in walkable_ways:
        scored = compute_segment_scores(way, trees, buildings, veg_anchors)
        if scored is None:
            continue
        coords = scored.pop("geometry")
        # Centroid-in-cell dedupe: each way belongs to exactly one shard
        # so the same osm_id never appears twice across the dataset.
        c_lat, c_lon = way_centroid(coords)
        if not in_cell(c_lat, c_lon, bbox):
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": scored,
        })

    if not features:
        return None

    return {
        "type": "FeatureCollection",
        "metadata": {
            "cell_id": cid,
            "bbox_south_west_north_east": list(bbox),
            "n_features": len(features),
        },
        "features": features,
    }


# ---------------------------------------------------------------------------
# Manifest read/write
# ---------------------------------------------------------------------------
def manifest_template() -> dict[str, Any]:
    rows, cols = grid_dims()
    return {
        "version": 1,
        "bbox_south_west_north_east": [BBOX_SOUTH, BBOX_WEST, BBOX_NORTH, BBOX_EAST],
        "cell_deg": CELL_DEG,
        "rows": rows,
        "cols": cols,
        "shards": [],  # populated incrementally
    }


def load_or_init_manifest() -> dict[str, Any]:
    if MANIFEST_PATH.exists():
        try:
            data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            if data.get("cell_deg") == CELL_DEG and data.get("version") == 1:
                return data
            print("[manifest] existing manifest has different cell_deg/version, reinitializing")
        except (OSError, json.JSONDecodeError) as e:
            print(f"[manifest] could not read existing ({e}); reinitializing")
    return manifest_template()


def save_manifest(manifest: dict[str, Any]) -> None:
    manifest["shards"].sort(key=lambda s: s["id"])
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def upsert_shard_entry(manifest: dict[str, Any], cid: str, bbox: tuple[float, float, float, float], n: int) -> None:
    entry = {"id": cid, "bbox": list(bbox), "n_features": n}
    for i, s in enumerate(manifest["shards"]):
        if s["id"] == cid:
            manifest["shards"][i] = entry
            return
    manifest["shards"].append(entry)


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def parse_cell_arg(s: str) -> tuple[int, int]:
    """Parse 'r03c05' → (3, 5)."""
    if not (s.startswith("r") and "c" in s):
        raise ValueError(f"bad cell id: {s!r} (expected like r03c05)")
    r_str, c_str = s[1:].split("c", 1)
    return int(r_str), int(c_str)


def all_cells() -> list[tuple[int, int]]:
    rows, cols = grid_dims()
    return [(r, c) for r in range(rows) for c in range(cols)]


def append_failed(cid: str, err: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with FAILED_LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(f"{cid}\t{err}\n")


def main() -> int:
    ap = argparse.ArgumentParser(description="Sharded Overpass bake for HeatRouteID")
    ap.add_argument("--dry-run", action="store_true", help="print plan only, no fetches")
    ap.add_argument("--cell", help="bake a single cell (e.g. r03c05)")
    ap.add_argument("--force", action="store_true", help="re-bake cells even if shard file exists")
    args = ap.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    rows, cols = grid_dims()
    print(f"[grid] {rows} rows × {cols} cols = {rows * cols} cells "
          f"@ {CELL_DEG}° (~{CELL_DEG * 111:.1f} km)")
    print(f"[bbox] S={BBOX_SOUTH} W={BBOX_WEST} N={BBOX_NORTH} E={BBOX_EAST}")

    if args.cell:
        cells = [parse_cell_arg(args.cell)]
    else:
        cells = all_cells()

    if args.dry_run:
        for r, c in cells[:10]:
            cid = cell_id(r, c)
            bb = cell_bbox(r, c)
            print(f"  {cid} bbox={bb}")
        if len(cells) > 10:
            print(f"  ... ({len(cells) - 10} more)")
        return 0

    manifest = load_or_init_manifest()
    queried = 0
    written = 0
    skipped_existing = 0
    skipped_empty = 0
    failed = 0

    for i, (r, c) in enumerate(cells):
        cid = cell_id(r, c)
        bbox = cell_bbox(r, c)
        out_path = OUTPUT_DIR / f"{cid}.geojson"

        if out_path.exists() and not args.force:
            skipped_existing += 1
            # Make sure manifest reflects on-disk shard
            try:
                existing = json.loads(out_path.read_text(encoding="utf-8"))
                n = len(existing.get("features", []))
                upsert_shard_entry(manifest, cid, bbox, n)
            except (OSError, json.JSONDecodeError):
                pass
            continue

        print(f"[{i + 1}/{len(cells)}] {cid} bbox={bbox} ...")
        try:
            shard = bake_cell(r, c)
        except Exception as e:  # noqa: BLE001 — we want to log + continue
            print(f"    FAILED: {e}")
            append_failed(cid, str(e))
            failed += 1
            time.sleep(THROTTLE_S)
            continue
        queried += 1

        if shard is None:
            skipped_empty += 1
            print("    empty (no walkable ways)")
        else:
            out_path.write_text(json.dumps(shard, ensure_ascii=False), encoding="utf-8")
            n = len(shard["features"])
            upsert_shard_entry(manifest, cid, bbox, n)
            size_kb = out_path.stat().st_size / 1024
            print(f"    wrote {n} features ({size_kb:.1f} KB)")
            written += 1
            # Save manifest after every write so resume is robust to Ctrl-C.
            save_manifest(manifest)

        time.sleep(THROTTLE_S)

    save_manifest(manifest)
    print()
    print(f"[done] queried={queried} written={written} "
          f"skipped_existing={skipped_existing} skipped_empty={skipped_empty} failed={failed}")
    print(f"[done] manifest: {MANIFEST_PATH} ({len(manifest['shards'])} shards)")
    if failed:
        print(f"[done] failed cells logged to {FAILED_LOG_PATH} — re-run to retry")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
