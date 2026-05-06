import { along } from "@turf/along";
import { length as turfLength } from "@turf/length";
import { nearestPointOnLine } from "@turf/nearest-point-on-line";
import { lineString } from "@turf/helpers";
import Flatbush from "flatbush";
import type { LabeledRoute, RouteSummary } from "../state/types";
import type { ShadeCollection, ShadeProps } from "./shadeData";
import type { Weather } from "./weather";

const SAMPLE_INTERVAL_M = 10;
const MAX_DIST_TO_SHADE_M = 25;
const BBOX_PAD_DEG = 30 / 111000;

export type HesCategory =
  | "sejuk"
  | "cukup-nyaman"
  | "sedang"
  | "panas"
  | "sangat-panas";

export const HES_CATEGORY_NAMES: Record<HesCategory, string> = {
  sejuk: "Sejuk",
  "cukup-nyaman": "Cukup nyaman",
  sedang: "Sedang",
  panas: "Panas",
  "sangat-panas": "Sangat panas",
};

export const HES_CATEGORY_COLORS: Record<HesCategory, string> = {
  sejuk: "#16a34a",       // green-600
  "cukup-nyaman": "#84cc16", // lime-500
  sedang: "#facc15",      // yellow-400
  panas: "#f97316",       // orange-500
  "sangat-panas": "#dc2626", // red-600
};

export function categorizeHes(hes: number): HesCategory {
  if (hes < 0.2) return "sejuk";
  if (hes < 0.4) return "cukup-nyaman";
  if (hes < 0.6) return "sedang";
  if (hes < 0.8) return "panas";
  return "sangat-panas";
}

// Weights and normalization constants from docs/HES_FORMULA.md — keep in sync.
const W_TEMP = 0.25;
const W_HUMID = 0.10;
const W_UV = 0.15;
const W_SHADE = 0.30;
const W_VEG = 0.20;
const TEMP_BASE_C = 24;
const TEMP_PEAK_C = 38;
const UV_PEAK = 11;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Climate-only contribution to HES, in [0, W_TEMP+W_HUMID+W_UV] = [0, 0.50].
 * Same value applies city-wide at any moment, so it is a uniform offset on
 * the per-segment heat map. */
export function climateContribution(w: Weather): number {
  const tempNorm = clamp01((w.temperature - TEMP_BASE_C) / (TEMP_PEAK_C - TEMP_BASE_C));
  const humidNorm = clamp01(w.humidity / 100);
  const uvNorm = clamp01(w.uvIndex / UV_PEAK);
  return W_TEMP * tempNorm + W_HUMID * humidNorm + W_UV * uvNorm;
}

/** Full HES per pre-baked shade segment: climate + shade gap + vegetation gap.
 * Returns [0, 1]. Used to color the city heat-exposure map layer.
 *
 * `bldgTimeFactor` ∈ [0, 1] modulates the building-proximity contribution to
 * shade by sun altitude (see lib/sun.ts). Default 1 keeps the bake-static
 * behavior. When the sun is overhead (factor → 0), buildings stop shading the
 * road, so the effective shade gap rises by the building share of static
 * shade coverage (0.30 per HES_FORMULA.md).
 *
 * `shadeSensitivity` ∈ [0, 1] gates the entire shade+veg contribution by sun
 * altitude — at night there's no direct sun to be exposed from, so HES
 * collapses to pure climate. Default 1 preserves daytime behavior. */
export function segmentHes(
  props: ShadeProps,
  w: Weather,
  bldgTimeFactor = 1,
  shadeSensitivity = 1,
): number {
  const climate = climateContribution(w);
  const baseShadeGap = clamp01(props.shade_gap);
  const bldgReduction = 0.3 * clamp01(props.building_proximity) * (1 - bldgTimeFactor);
  const shadeGap = clamp01(baseShadeGap + bldgReduction);
  const vegGap = clamp01(1 - props.veg_density_norm);
  return clamp01(climate + shadeSensitivity * (W_SHADE * shadeGap + W_VEG * vegGap));
}

export const HES_LEGEND: Array<{ label: string; range: string; color: string }> = [
  { label: HES_CATEGORY_NAMES.sejuk, range: "0–20", color: HES_CATEGORY_COLORS.sejuk },
  { label: HES_CATEGORY_NAMES["cukup-nyaman"], range: "20–40", color: HES_CATEGORY_COLORS["cukup-nyaman"] },
  { label: HES_CATEGORY_NAMES.sedang, range: "40–60", color: HES_CATEGORY_COLORS.sedang },
  { label: HES_CATEGORY_NAMES.panas, range: "60–80", color: HES_CATEGORY_COLORS.panas },
  { label: HES_CATEGORY_NAMES["sangat-panas"], range: "80–100", color: HES_CATEGORY_COLORS["sangat-panas"] },
];

let indexCache: { data: ShadeCollection; index: Flatbush } | null = null;

function getShadeIndex(shade: ShadeCollection): Flatbush {
  if (indexCache && indexCache.data === shade) return indexCache.index;
  const idx = new Flatbush(shade.features.length);
  for (const f of shade.features) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of f.geometry.coordinates) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    idx.add(minX, minY, maxX, maxY);
  }
  idx.finish();
  indexCache = { data: shade, index: idx };
  return idx;
}

export function computeRouteHes(
  route: RouteSummary,
  shade: ShadeCollection,
): number {
  const index = getShadeIndex(shade);
  const routeFeature = lineString(route.geometry.coordinates);
  const totalKm = turfLength(routeFeature, { units: "kilometers" });
  const stepKm = SAMPLE_INTERVAL_M / 1000;
  const numSamples = Math.max(2, Math.ceil(totalKm / stepKm) + 1);

  let sumGap = 0;
  let count = 0;

  for (let i = 0; i < numSamples; i++) {
    const dKm =
      numSamples === 1 ? 0 : (i / (numSamples - 1)) * totalKm;
    const sample = along(routeFeature, dKm, { units: "kilometers" });
    const [lng, lat] = sample.geometry.coordinates;

    const candidates = index.search(
      lng - BBOX_PAD_DEG,
      lat - BBOX_PAD_DEG,
      lng + BBOX_PAD_DEG,
      lat + BBOX_PAD_DEG,
    );
    if (candidates.length === 0) continue;

    let bestDist = Infinity;
    let bestGap = 0;
    let foundMatch = false;

    for (const ci of candidates) {
      const f = shade.features[ci];
      const result = nearestPointOnLine(f, sample, { units: "meters" });
      const props = result.properties as { dist?: number };
      const dist = props.dist ?? Infinity;
      if (dist < bestDist) {
        bestDist = dist;
        bestGap = f.properties.shade_gap;
        foundMatch = true;
      }
    }

    if (foundMatch && bestDist <= MAX_DIST_TO_SHADE_M) {
      sumGap += bestGap;
      count += 1;
    }
  }

  return count > 0 ? sumGap / count : 0.5;
}

export function computeAndLabel(
  routes: RouteSummary[],
  shade: ShadeCollection,
): LabeledRoute[] {
  if (routes.length === 0) return [];

  const withHes = routes.map((r) => ({
    ...r,
    hes: computeRouteHes(r, shade),
  }));

  const minDuration = Math.min(...withHes.map((r) => r.duration));
  const maxDuration = Math.max(...withHes.map((r) => r.duration));
  const minHes = Math.min(...withHes.map((r) => r.hes));
  const maxHes = Math.max(...withHes.map((r) => r.hes));

  const dRange = maxDuration - minDuration || 1;
  const hRange = maxHes - minHes || 1;

  const balancedScores = withHes.map((r) => {
    const tNorm = (r.duration - minDuration) / dRange;
    const hNorm = (r.hes - minHes) / hRange;
    return 0.5 * tNorm + 0.5 * hNorm;
  });
  const minBalanced = Math.min(...balancedScores);

  return withHes
    .map((r, i) => ({
      ...r,
      hesCategory: categorizeHes(r.hes),
      isFastest: r.duration === minDuration,
      isCoolest: r.hes === minHes,
      isBalanced: balancedScores[i] === minBalanced,
    }))
    .filter((r) => r.isFastest || r.isCoolest || r.isBalanced);
}
