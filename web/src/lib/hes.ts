import { along } from "@turf/along";
import { length as turfLength } from "@turf/length";
import { nearestPointOnLine } from "@turf/nearest-point-on-line";
import { lineString } from "@turf/helpers";
import Flatbush from "flatbush";
import type { LabeledRoute, RouteSummary } from "../state/types";
import type { ShadeCollection } from "./shadeData";

const SAMPLE_INTERVAL_M = 10;
const MAX_DIST_TO_SHADE_M = 25;
const BBOX_PAD_DEG = 30 / 111000;

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

  return withHes.map((r, i) => ({
    ...r,
    isFastest: r.duration === minDuration,
    isCoolest: r.hes === minHes,
    isBalanced: balancedScores[i] === minBalanced,
  }));
}
