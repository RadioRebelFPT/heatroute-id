export const LABEL_COLORS = {
  fastest: "#2563eb",
  coolest: "#0d9488",
  balanced: "#a855f7",
} as const;

export const LABEL_NAMES = {
  fastest: "Tercepat",
  coolest: "Tersejuk",
  balanced: "Seimbang",
} as const;

export type RouteLabelKey = keyof typeof LABEL_COLORS;

type Labeled = {
  isFastest: boolean;
  isCoolest: boolean;
  isBalanced: boolean;
};

export function primaryLabel(route: Labeled): RouteLabelKey | null {
  if (route.isFastest) return "fastest";
  if (route.isCoolest) return "coolest";
  if (route.isBalanced) return "balanced";
  return null;
}

export function primaryColor(route: Labeled): string {
  const key = primaryLabel(route);
  return key ? LABEL_COLORS[key] : "#64748b";
}
