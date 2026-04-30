"""
HeatRouteID — Overpass data prep for Salemba test bed.

One-time script: query OpenStreetMap via Overpass API, compute per-segment
shade & vegetation scores, and bake a static GeoJSON that the frontend
can load directly. This avoids hitting Overpass at runtime (slow, rate-limited).

Output: ../data/salemba_shade_gap.geojson
        FeatureCollection of LineString features, each with properties:
        - osm_id, name, highway, length_m
        - tree_count, tree_density_per_100m
        - building_proximity (0-1)
        - shade_coverage (0-1)
        - shade_gap (1 - shade_coverage)
        - veg_density_norm (0-1)

Run:
    cd heatroute-id/data_prep
    python -m venv .venv && .venv/Scripts/activate   # Windows
    pip install -r requirements.txt
    python overpass_salemba.py

Outputs to ../data/salemba_shade_gap.geojson (~few MB depending on bbox).
"""

from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Test bed config — Salemba area, ~1.5km radius around Kampus UI Salemba.
# Bbox: (south, west, north, east) — adjust if too sparse / too wide.
# ---------------------------------------------------------------------------
BBOX = (-6.205, 106.830, -6.185, 106.860)
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "salemba_shade_gap.geojson"

# Walkable highway types (OSM standard)
WALKABLE_HIGHWAYS = {
    "footway", "path", "pedestrian", "living_street",
    "residential", "tertiary", "secondary", "primary",
    "service", "unclassified", "steps",
}

# Tunable thresholds (mirror docs/HES_FORMULA.md)
TREE_BUFFER_M = 5.0           # buffer radius for "tree near segment"
# 15m for buildings: centroids of typical Jakarta blocks sit ~10-15m from road
# centerline (sidewalk + setback + footprint half-width). 5m only caught buildings
# physically touching the curb and threw away most real street-front adjacency.
BUILDING_BUFFER_M = 15.0
VEG_POLYGON_BUFFER_M = 15.0   # parks/grass/forest polygons — wider buffer (polygon vertices, not points)
TREE_DENSITY_SAT = 8.0        # 8 trees/100m -> fully vegetated by point-trees alone
VEG_POLYGON_SAT_PER_100M = 6.0  # 6 polygon-anchor hits/100m -> fully veg-bonused
BUILDING_DENSITY_SAT_PER_100M = 6.0  # was 10; lowered so dense Salemba blocks saturate sooner
VEG_POLYGON_BONUS_W = 0.6     # weight of polygon bonus when combined with tree density
# Shade weights — flipped after H0 risk gate (Indonesian OSM has only 4 tagged trees in Salemba bbox).
# Buildings are well-tagged and now do the heavy lifting; trees+veg polygons add residual spread.
SHADE_W_BUILDING = 0.6
SHADE_W_VEG = 0.4

# Vegetation polygon tag filters (regex-friendly)
VEG_LANDUSE = {"grass", "forest", "cemetery"}
VEG_NATURAL = {"wood", "scrub"}


# ---------------------------------------------------------------------------
# Overpass query
# ---------------------------------------------------------------------------
def overpass_query(bbox: tuple[float, float, float, float]) -> dict[str, Any]:
    """Fetch ways (highways), trees, buildings, and vegetation polygons within bbox."""
    south, west, north, east = bbox
    bbox_str = f"({south},{west},{north},{east})"
    query = f"""
    [out:json][timeout:90];
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
    print(f"[overpass] querying bbox {bbox_str}...")
    t0 = time.time()
    headers = {
        "User-Agent": "HeatRouteID/0.1 (IYREF 2026 hackathon; contact: farrel.pradipa@gmail.com)",
        "Accept": "application/json",
    }
    resp = requests.post(OVERPASS_URL, data={"data": query}, headers=headers, timeout=90)
    resp.raise_for_status()
    elapsed = time.time() - t0
    data = resp.json()
    print(f"[overpass] got {len(data.get('elements', []))} elements in {elapsed:.1f}s")
    return data


# ---------------------------------------------------------------------------
# Geometry helpers (no shapely — keep deps minimal)
# ---------------------------------------------------------------------------
def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in meters."""
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def way_length_m(geom: list[dict[str, float]]) -> float:
    total = 0.0
    for i in range(1, len(geom)):
        a, b = geom[i - 1], geom[i]
        total += haversine_m(a["lat"], a["lon"], b["lat"], b["lon"])
    return total


def point_to_segment_m(
    plat: float, plon: float,
    a: dict[str, float], b: dict[str, float],
) -> float:
    """Approximate point-to-segment distance in meters using equirectangular projection."""
    mean_lat = math.radians((a["lat"] + b["lat"]) / 2)
    # convert to local x,y in meters
    def to_xy(lat: float, lon: float) -> tuple[float, float]:
        x = math.radians(lon) * math.cos(mean_lat) * 6371000.0
        y = math.radians(lat) * 6371000.0
        return x, y
    px, py = to_xy(plat, plon)
    ax, ay = to_xy(a["lat"], a["lon"])
    bx, by = to_xy(b["lat"], b["lon"])
    dx, dy = bx - ax, by - ay
    seg_len2 = dx * dx + dy * dy
    if seg_len2 == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg_len2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def way_min_distance_to_point(
    way_geom: list[dict[str, float]], plat: float, plon: float,
) -> float:
    if not way_geom:
        return float("inf")
    return min(
        point_to_segment_m(plat, plon, way_geom[i - 1], way_geom[i])
        for i in range(1, len(way_geom))
    )


def trees_near_way(
    way_geom: list[dict[str, float]],
    trees: list[dict[str, float]],
    buffer_m: float,
) -> int:
    count = 0
    for tree in trees:
        # cheap bbox prefilter using lat/lon
        lat, lon = tree["lat"], tree["lon"]
        # Approx: 1 deg lat ≈ 111km, 1 deg lon ≈ 111km*cos(lat)
        if not any(
            abs(node["lat"] - lat) < 0.0005 and abs(node["lon"] - lon) < 0.0005
            for node in way_geom
        ):
            continue
        # exact distance check
        for i in range(1, len(way_geom)):
            d = point_to_segment_m(lat, lon, way_geom[i - 1], way_geom[i])
            if d <= buffer_m:
                count += 1
                break
    return count


def buildings_near_way(
    way_geom: list[dict[str, float]],
    buildings: list[dict[str, Any]],
    buffer_m: float,
) -> int:
    """Count buildings whose closest polygon vertex is within buffer_m of way.

    Centroid-based proxy under-counted for large blocks: a 30m-wide building
    set against a curb has its centroid 15m+ from the road, so a 15m buffer
    misses the obvious adjacency. Vertex-based check finds the building's
    closest corner instead, which is the actually-relevant geometry for
    facade-derived shade.
    """
    if not way_geom:
        return 0
    pad = 0.0005  # ~50m at this latitude — prefilter padding
    way_lat_min = min(p["lat"] for p in way_geom) - pad
    way_lat_max = max(p["lat"] for p in way_geom) + pad
    way_lon_min = min(p["lon"] for p in way_geom) - pad
    way_lon_max = max(p["lon"] for p in way_geom) + pad

    count = 0
    for b in buildings:
        bgeom = b.get("geometry", [])
        if not bgeom:
            continue
        b_lat_min = b_lat_max = bgeom[0]["lat"]
        b_lon_min = b_lon_max = bgeom[0]["lon"]
        for v in bgeom[1:]:
            if v["lat"] < b_lat_min: b_lat_min = v["lat"]
            elif v["lat"] > b_lat_max: b_lat_max = v["lat"]
            if v["lon"] < b_lon_min: b_lon_min = v["lon"]
            elif v["lon"] > b_lon_max: b_lon_max = v["lon"]
        if b_lat_max < way_lat_min or b_lat_min > way_lat_max:
            continue
        if b_lon_max < way_lon_min or b_lon_min > way_lon_max:
            continue
        hit = False
        for v in bgeom:
            for i in range(1, len(way_geom)):
                if point_to_segment_m(v["lat"], v["lon"], way_geom[i - 1], way_geom[i]) <= buffer_m:
                    hit = True
                    break
            if hit:
                break
        if hit:
            count += 1
    return count


def veg_anchors_near_way(
    way_geom: list[dict[str, float]],
    veg_anchors: list[tuple[float, float]],
    buffer_m: float,
) -> int:
    """Count vegetation polygon vertices within buffer_m of way.

    Polygons (parks, grass, cemetery, etc.) are unrolled into their vertex
    coordinates so a long park edge contributes multiple anchors. This means
    a segment running alongside a park accumulates more hits than one merely
    near a corner — proxy for "how much vegetation-frontage does this segment
    have." Coarse but matches the spirit of the H0 fix: any signal beats none.
    """
    count = 0
    for vlat, vlon in veg_anchors:
        # cheap bbox prefilter (~50m at this latitude)
        if not any(
            abs(node["lat"] - vlat) < 0.0005 and abs(node["lon"] - vlon) < 0.0005
            for node in way_geom
        ):
            continue
        for i in range(1, len(way_geom)):
            d = point_to_segment_m(vlat, vlon, way_geom[i - 1], way_geom[i])
            if d <= buffer_m:
                count += 1
                break
    return count


# ---------------------------------------------------------------------------
# Score per segment
# ---------------------------------------------------------------------------
def compute_segment_scores(
    way: dict[str, Any],
    trees: list[dict[str, float]],
    buildings: list[dict[str, Any]],
    veg_anchors: list[tuple[float, float]],
) -> dict[str, Any] | None:
    geom = way.get("geometry", [])
    if len(geom) < 2:
        return None

    length_m = way_length_m(geom)
    if length_m < 5:
        return None

    tree_count = trees_near_way(geom, trees, TREE_BUFFER_M)
    bld_count = buildings_near_way(geom, buildings, BUILDING_BUFFER_M)
    veg_anchor_count = veg_anchors_near_way(geom, veg_anchors, VEG_POLYGON_BUFFER_M)

    length_100m = length_m / 100.0 if length_m > 0 else 1e-9

    tree_density_per_100m = tree_count / length_100m
    tree_density_norm = min(tree_density_per_100m / TREE_DENSITY_SAT, 1.0)

    veg_polygon_per_100m = veg_anchor_count / length_100m
    veg_polygon_norm = min(veg_polygon_per_100m / VEG_POLYGON_SAT_PER_100M, 1.0)

    veg_total = min(tree_density_norm + VEG_POLYGON_BONUS_W * veg_polygon_norm, 1.0)

    bld_per_100m = bld_count / length_100m
    building_proximity = min(bld_per_100m / BUILDING_DENSITY_SAT_PER_100M, 1.0)

    shade_coverage = SHADE_W_BUILDING * building_proximity + SHADE_W_VEG * veg_total
    shade_coverage = min(max(shade_coverage, 0.0), 1.0)

    return {
        "osm_id": way["id"],
        "name": way.get("tags", {}).get("name", ""),
        "highway": way.get("tags", {}).get("highway", ""),
        "length_m": round(length_m, 1),
        "tree_count": tree_count,
        "tree_density_per_100m": round(tree_density_per_100m, 2),
        "tree_density_norm": round(tree_density_norm, 3),
        "veg_polygon_anchors": veg_anchor_count,
        "veg_polygon_norm": round(veg_polygon_norm, 3),
        "veg_density_norm": round(veg_total, 3),
        "building_proximity": round(building_proximity, 3),
        "shade_coverage": round(shade_coverage, 3),
        "shade_gap": round(1.0 - shade_coverage, 3),
        "geometry": [[p["lon"], p["lat"]] for p in geom],
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> int:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    raw = overpass_query(BBOX)
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

    print(
        f"[parse] trees={len(trees)} buildings={len(buildings)} "
        f"veg_polys={len(veg_polygons)} ways={len(walkable_ways)}"
    )

    if not walkable_ways:
        print("[error] no walkable ways found - bbox too small or wrong area?")
        return 1

    # Unroll vegetation polygons into vertex anchors. Long park edges contribute
    # multiple anchors; small parks contribute few. Acts as a frontage proxy.
    veg_anchors: list[tuple[float, float]] = []
    for poly in veg_polygons:
        for node in poly.get("geometry", []):
            veg_anchors.append((node["lat"], node["lon"]))
    print(f"[parse] veg_polygon_anchors={len(veg_anchors)}")

    features = []
    for i, way in enumerate(walkable_ways):
        if i % 50 == 0 and i > 0:
            print(f"[score] processed {i}/{len(walkable_ways)} ways...")
        scored = compute_segment_scores(way, trees, buildings, veg_anchors)
        if scored is None:
            continue
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": scored.pop("geometry"),
            },
            "properties": scored,
        })

    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "test_bed": "Salemba",
            "bbox_south_west_north_east": list(BBOX),
            "tree_buffer_m": TREE_BUFFER_M,
            "building_buffer_m": BUILDING_BUFFER_M,
            "veg_polygon_buffer_m": VEG_POLYGON_BUFFER_M,
            "tree_density_sat_per_100m": TREE_DENSITY_SAT,
            "veg_polygon_sat_per_100m": VEG_POLYGON_SAT_PER_100M,
            "building_density_sat_per_100m": BUILDING_DENSITY_SAT_PER_100M,
            "veg_polygon_bonus_w": VEG_POLYGON_BONUS_W,
            "shade_weights": {"building": SHADE_W_BUILDING, "veg": SHADE_W_VEG},
            "n_features": len(features),
            "n_trees": len(trees),
            "n_buildings": len(buildings),
            "n_veg_polygons": len(veg_polygons),
        },
        "features": features,
    }

    OUTPUT_PATH.write_text(json.dumps(geojson, ensure_ascii=False), encoding="utf-8")
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"[done] wrote {len(features)} features -> {OUTPUT_PATH} ({size_kb:.1f} KB)")

    # Quick distribution summary
    if features:
        gaps = [f["properties"]["shade_gap"] for f in features]
        gaps_sorted = sorted(gaps)
        n = len(gaps_sorted)
        print(
            f"[stats] shade_gap: min={gaps_sorted[0]:.2f} p25={gaps_sorted[n//4]:.2f} "
            f"med={gaps_sorted[n//2]:.2f} p75={gaps_sorted[3*n//4]:.2f} "
            f"max={gaps_sorted[-1]:.2f}"
        )
        # 5-bucket histogram for the H0 acceptance gate.
        buckets = [0, 0, 0, 0, 0]
        for g in gaps:
            if g < 0.2:
                buckets[0] += 1
            elif g < 0.4:
                buckets[1] += 1
            elif g < 0.6:
                buckets[2] += 1
            elif g < 0.8:
                buckets[3] += 1
            else:
                buckets[4] += 1
        labels = ["[0.0,0.2)", "[0.2,0.4)", "[0.4,0.6)", "[0.6,0.8)", "[0.8,1.0]"]
        print("[stats] bucket distribution (n={}):".format(n))
        for label, count in zip(labels, buckets):
            pct = 100.0 * count / n
            bar = "#" * int(pct / 2)
            print(f"  {label} {count:5d} ({pct:5.1f}%) {bar}")
        # Acceptance gate read-out
        bands_above_5pct = sum(1 for c in buckets if 100.0 * c / n > 5.0)
        med = gaps_sorted[n // 2]
        gate_med = 0.4 <= med <= 0.7
        gate_bands = bands_above_5pct >= 3
        print(
            f"[gate] median in [0.4,0.7]: {gate_med} (med={med:.2f}); "
            f"bands>5%: {gate_bands} ({bands_above_5pct}/5) -> "
            f"{'PASS' if gate_med and gate_bands else 'FAIL'}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
