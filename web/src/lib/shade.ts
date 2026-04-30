// 5-stop ramp matching the H0 distribution buckets.
// Low gap = lots of shade (cool); high gap = no shade (hot).
const STOPS: Array<{ max: number; color: string }> = [
  { max: 0.2, color: "#16a34a" }, // green-600  — well shaded
  { max: 0.4, color: "#84cc16" }, // lime-500
  { max: 0.6, color: "#facc15" }, // yellow-400
  { max: 0.8, color: "#f97316" }, // orange-500
  { max: 1.01, color: "#dc2626" }, // red-600   — no shade
];

export function shadeGapColor(gap: number): string {
  for (const s of STOPS) if (gap < s.max) return s.color;
  return STOPS[STOPS.length - 1].color;
}

export const SHADE_LEGEND = [
  { label: "Sangat teduh", range: "0.0–0.2", color: "#16a34a" },
  { label: "Teduh", range: "0.2–0.4", color: "#84cc16" },
  { label: "Sedang", range: "0.4–0.6", color: "#facc15" },
  { label: "Kurang teduh", range: "0.6–0.8", color: "#f97316" },
  { label: "Tanpa teduh", range: "0.8–1.0", color: "#dc2626" },
];
