import { PHB_FEATS } from "@/data/phbFeats";
import type { Open5eFeat } from "@/types";

export const FEATURE_FEATS: Open5eFeat[] = [...PHB_FEATS].sort((left, right) =>
  left.name.localeCompare(right.name)
);

export function formatFeatureFeatDescription(feat: Open5eFeat): string {
  const parts = [
    feat.prerequisites ? `Prerequisites: ${feat.prerequisites}` : "",
    feat.desc?.trim() ?? "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function findFeatureFeats(query: string, limit = 12): Open5eFeat[] {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) return FEATURE_FEATS.slice(0, limit);

  return FEATURE_FEATS.filter((feat) => {
    const haystack = [feat.name, feat.prerequisites, feat.desc].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(trimmedQuery);
  }).slice(0, limit);
}
