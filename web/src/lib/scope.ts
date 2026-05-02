import type { LatLng } from "../state/types";

// Bbox of the baked shade-gap dataset (Jakarta + Depok).
// Keep in sync with BBOX_* constants in data_prep/overpass_jabodetabek.py.
export const JABODETABEK_BBOX = {
  south: -6.5,
  west: 106.69,
  north: -6.09,
  east: 106.97,
} as const;

export const SCOPE_NAME = "Jakarta + Depok";

export function isInJabodetabek(p: LatLng): boolean {
  return (
    p.lat >= JABODETABEK_BBOX.south &&
    p.lat <= JABODETABEK_BBOX.north &&
    p.lng >= JABODETABEK_BBOX.west &&
    p.lng <= JABODETABEK_BBOX.east
  );
}
