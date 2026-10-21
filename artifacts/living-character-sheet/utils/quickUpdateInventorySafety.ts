import type { ProposedInventoryItem } from "@/types";

export type QuickUpdateInventoryPartition = {
  autoApplicable: ProposedInventoryItem[];
  requiresReview: ProposedInventoryItem[];
};

function hasStructuredMechanics(item: ProposedInventoryItem): boolean {
  return (
    (item.equippedEffects?.length ?? 0) > 0 ||
    (item.additionalDamage?.length ?? 0) > 0 ||
    item.mechanics != null
  );
}

export function partitionQuickUpdateInventoryChanges(
  changes: ProposedInventoryItem[],
): QuickUpdateInventoryPartition {
  const autoApplicable: ProposedInventoryItem[] = [];
  const requiresReview: ProposedInventoryItem[] = [];

  for (const change of changes) {
    const lowConfidenceStructured = change.confidence === "low" && hasStructuredMechanics(change);
    if (change.needsReview || lowConfidenceStructured) {
      requiresReview.push(change);
    } else {
      autoApplicable.push(change);
    }
  }

  return { autoApplicable, requiresReview };
}
