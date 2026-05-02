import type { Feature, FeatureCollection, LineString } from "geojson";

export type ShadeProps = {
  shade_gap: number;
  shade_coverage: number;
  highway: string;
  name?: string;
  length_m: number;
  tree_count: number;
  building_proximity: number;
  veg_density_norm: number;
  osm_id?: number;
};

export type ShadeFeature = Feature<LineString, ShadeProps>;
export type ShadeCollection = FeatureCollection<LineString, ShadeProps>;

// (south, west, north, east)
export type Bbox = [number, number, number, number];

type ShardEntry = {
  id: string;
  bbox: Bbox;
  n_features: number;
};

type Manifest = {
  version: number;
  bbox_south_west_north_east: Bbox;
  cell_deg: number;
  rows: number;
  cols: number;
  shards: ShardEntry[];
};

const MANIFEST_URL = "/data/shards/manifest.json";
const SHARD_URL = (id: string) => `/data/shards/${id}.geojson`;
const LEGACY_SALEMBA_URL = "/data/salemba_shade_gap.geojson";

// ---------------------------------------------------------------------------
// Manifest cache
// ---------------------------------------------------------------------------
let manifest: Manifest | null = null;
let manifestPending: Promise<Manifest | null> | null = null;
// `null` resolution means: no shards available, fall back to legacy file.

function fetchManifest(): Promise<Manifest | null> {
  if (manifest) return Promise.resolve(manifest);
  if (manifestPending) return manifestPending;
  manifestPending = fetch(MANIFEST_URL)
    .then(async (r) => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`manifest fetch ${r.status}`);
      // Vite dev (and some static hosts) fall back to index.html for unknown
      // paths. Accept JSON only, otherwise treat as "no manifest yet".
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("json")) return null;
      return (await r.json()) as Manifest;
    })
    .then((m) => {
      manifest = m;
      manifestPending = null;
      return m;
    })
    .catch((e: Error) => {
      manifestPending = null;
      console.warn("[shadeData] manifest fetch failed, will use legacy", e);
      manifest = null;
      return null;
    });
  return manifestPending;
}

// ---------------------------------------------------------------------------
// Shard cache + monotonic merged snapshot
// ---------------------------------------------------------------------------
const shardCache = new Map<string, ShadeFeature[]>();
const shardPending = new Map<string, Promise<ShadeFeature[]>>();

let snapshot: ShadeCollection = {
  type: "FeatureCollection",
  features: [],
};
let snapshotVersion = 0;

function appendFeatures(feats: ShadeFeature[]): void {
  if (feats.length === 0) return;
  // New array reference invalidates the Flatbush cache in hes.ts.
  snapshot = {
    type: "FeatureCollection",
    features: snapshot.features.concat(feats),
  };
  snapshotVersion += 1;
}

function fetchShard(id: string): Promise<ShadeFeature[]> {
  const hit = shardCache.get(id);
  if (hit) return Promise.resolve(hit);
  const inflight = shardPending.get(id);
  if (inflight) return inflight;
  const p = fetch(SHARD_URL(id))
    .then((r) => {
      if (!r.ok) throw new Error(`shard ${id} fetch ${r.status}`);
      return r.json() as Promise<ShadeCollection>;
    })
    .then((coll) => {
      const feats = coll.features;
      shardCache.set(id, feats);
      shardPending.delete(id);
      appendFeatures(feats);
      return feats;
    })
    .catch((e: Error) => {
      shardPending.delete(id);
      console.warn(`[shadeData] shard ${id} failed`, e);
      return [];
    });
  shardPending.set(id, p);
  return p;
}

// ---------------------------------------------------------------------------
// Legacy fallback (single Salemba file as one shard)
// ---------------------------------------------------------------------------
let legacyPending: Promise<void> | null = null;
let legacyLoaded = false;

function ensureLegacyLoaded(): Promise<void> {
  if (legacyLoaded) return Promise.resolve();
  if (legacyPending) return legacyPending;
  legacyPending = fetch(LEGACY_SALEMBA_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`legacy fetch ${r.status}`);
      return r.json() as Promise<ShadeCollection>;
    })
    .then((coll) => {
      appendFeatures(coll.features);
      legacyLoaded = true;
      legacyPending = null;
    })
    .catch((e: Error) => {
      legacyPending = null;
      console.warn("[shadeData] legacy fetch failed", e);
    });
  return legacyPending;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
function bboxesIntersect(a: Bbox, b: Bbox): boolean {
  // a/b: [south, west, north, east]
  if (a[2] < b[0] || a[0] > b[2]) return false;
  if (a[3] < b[1] || a[1] > b[3]) return false;
  return true;
}

/** Fetch all shards intersecting the bbox; resolve with the merged snapshot. */
export async function loadShardsForBounds(bbox: Bbox): Promise<ShadeCollection> {
  const m = await fetchManifest();
  if (!m) {
    await ensureLegacyLoaded();
    return snapshot;
  }
  const ids = m.shards
    .filter((s) => s.n_features > 0 && bboxesIntersect(s.bbox, bbox))
    .map((s) => s.id);
  if (ids.length > 0) {
    await Promise.all(ids.map(fetchShard));
  }
  return snapshot;
}

/** Current loaded snapshot (no fetch). Used by HES compute when it knows
 * the right shards have already been awaited via loadShardsForBounds. */
export function currentShadeSnapshot(): ShadeCollection {
  return snapshot;
}

/** Monotonic version that bumps each time new features are appended.
 * Components can use this in a deps array to re-render on shard load. */
export function shadeSnapshotVersion(): number {
  return snapshotVersion;
}

