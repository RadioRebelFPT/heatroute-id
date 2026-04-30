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
};

export type ShadeFeature = Feature<LineString, ShadeProps>;
export type ShadeCollection = FeatureCollection<LineString, ShadeProps>;

const URL = "/data/salemba_shade_gap.geojson";

let cached: ShadeCollection | null = null;
let pending: Promise<ShadeCollection> | null = null;

export function loadShadeData(): Promise<ShadeCollection> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = fetch(URL)
    .then((r) => {
      if (!r.ok) throw new Error(`shade-data fetch ${r.status}`);
      return r.json() as Promise<ShadeCollection>;
    })
    .then((data) => {
      cached = data;
      pending = null;
      return data;
    })
    .catch((e: Error) => {
      pending = null;
      throw e;
    });
  return pending;
}
