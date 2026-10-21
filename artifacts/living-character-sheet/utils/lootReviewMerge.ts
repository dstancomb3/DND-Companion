import type { ProposedInventoryItem } from "@/types";

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/^the\s+/i, "");
}

function mergeMechanicsBlock(
  base: ProposedInventoryItem["mechanics"],
  extra: ProposedInventoryItem["mechanics"],
): ProposedInventoryItem["mechanics"] {
  if (!base) return extra;
  if (!extra) return base;

  const mechanicsCountBase = base.mechanics.length;
  const mechanicsCountExtra = extra.mechanics.length;
  if (mechanicsCountExtra > mechanicsCountBase) return extra;
  if (mechanicsCountBase > mechanicsCountExtra) return base;

  const statusRank: Record<string, number> = {
    verified: 4,
    needs_review: 3,
    partial: 2,
    unsupported: 1,
  };
  const baseRank = statusRank[base.review.reviewStatus] ?? 0;
  const extraRank = statusRank[extra.review.reviewStatus] ?? 0;
  return extraRank > baseRank ? extra : base;
}

export function mergeProposedItems(base: ProposedInventoryItem, extra: ProposedInventoryItem): ProposedInventoryItem {
  const noteA = base.notes?.trim() ?? "";
  const noteB = extra.notes?.trim() ?? "";
  const combinedNotes =
    noteA && noteB && noteA !== noteB ? `${noteA}\n${noteB}` : noteA || noteB || undefined;

  const effectsA = base.equippedEffects ?? [];
  const effectsB = extra.equippedEffects ?? [];
  const seenLabels = new Set(effectsA.map((e) => e.label.toLowerCase()));
  const mergedEffects = [
    ...effectsA,
    ...effectsB.filter((e) => !seenLabels.has(e.label.toLowerCase())),
  ];

  const addDmgA = base.additionalDamage ?? [];
  const addDmgB = extra.additionalDamage ?? [];
  const seenAddDmg = new Set(addDmgA.map((d) => `${d.dice}|${d.damageType}`));
  const mergedAddDmg = [
    ...addDmgA,
    ...addDmgB.filter((d) => !seenAddDmg.has(`${d.dice}|${d.damageType}`)),
  ];

  const weaponSource = base.damageDice ? base : extra.damageDice ? extra : base;
  const mergedMechanics = mergeMechanicsBlock(base.mechanics, extra.mechanics);

  return {
    ...weaponSource,
    id: base.id,
    name: base.name,
    quantity: Math.max(base.quantity ?? 1, extra.quantity ?? 1),
    value: Math.max(base.value ?? 0, extra.value ?? 0) || undefined,
    notes: combinedNotes,
    equippedEffects: mergedEffects.length > 0 ? mergedEffects : undefined,
    additionalDamage: mergedAddDmg.length > 0 ? mergedAddDmg : undefined,
    confidence:
      base.confidence === "high" || extra.confidence === "high"
        ? "high"
        : base.confidence === "medium" || extra.confidence === "medium"
        ? "medium"
        : "low",
    needsReview: base.needsReview || extra.needsReview,
    _mergedCount: ((base._mergedCount ?? 1) + 1) as number,
    officialMatch: base.officialMatch || extra.officialMatch,
    sourceTag:
      base.sourceTag === "official" || extra.sourceTag === "official" || base.officialMatch || extra.officialMatch
        ? "official"
        : "custom",
    tags: Array.from(new Set([...(base.tags ?? []), ...(extra.tags ?? [])])),
    ...(mergedMechanics ? { mechanics: mergedMechanics } : {}),
  };
}

export function deduplicateItems(incoming: ProposedInventoryItem[], existing: ProposedInventoryItem[] = []): {
  deduped: ProposedInventoryItem[];
  updatedExisting: ProposedInventoryItem[];
} {
  const updatedExisting = [...existing];
  const deduped: ProposedInventoryItem[] = [];

  for (const item of incoming) {
    const normalItem = normalizeName(item.name);

    const existIdx = updatedExisting.findIndex(
      (e) => normalizeName(e.name) === normalItem,
    );
    if (existIdx >= 0) {
      updatedExisting[existIdx] = mergeProposedItems(updatedExisting[existIdx], item);
      continue;
    }

    const dedupIdx = deduped.findIndex((e) => normalizeName(e.name) === normalItem);
    if (dedupIdx >= 0) {
      deduped[dedupIdx] = mergeProposedItems(deduped[dedupIdx], item);
    } else {
      deduped.push(item);
    }
  }

  return { deduped, updatedExisting };
}
