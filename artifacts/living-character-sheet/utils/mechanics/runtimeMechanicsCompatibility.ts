import type {
  InventoryItem,
  ItemEffect,
  ItemMechanicsBlock,
  ItemMechanicsCompatibilityShape,
} from "@/types";
import { hasMeaningfulLegacyMechanicsContent } from "./characterSnapshotMechanicsAdapters";
import {
  itemMechanicsBlockToLegacyCompatibility,
  legacyItemToItemMechanicsBlock,
} from "./itemMechanicsAdapters";
import { envelopeToRuntimeCompatibilityItem } from "./mechanicsEnvelopeAdapters";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toLegacyCompatibilityShape(item: Partial<InventoryItem>): ItemMechanicsCompatibilityShape {
  return {
    notes: item.notes,
    attackAbility: item.attackAbility,
    isProficient: item.isProficient,
    useAbilityModifierForDamage: item.useAbilityModifierForDamage,
    damageDice: item.damageDice,
    damageModifier: item.damageModifier,
    damageType: item.damageType,
    additionalDamage: item.additionalDamage,
    weaponRange: item.weaponRange,
    equippedEffects: item.equippedEffects,
  };
}

export function resolveRuntimeItemMechanics(item: Partial<InventoryItem>): ItemMechanicsBlock | undefined {
  const rawMechanics = item.mechanics as unknown;

  if (isRecord(rawMechanics)) {
    const looksLikeBlock =
      rawMechanics["schemaVersion"] === "v1" &&
      rawMechanics["ownerType"] === "item" &&
      Array.isArray(rawMechanics["mechanics"]);

    const envelopeInput = looksLikeBlock
      ? { schemaVersion: "v1", ownerType: "item", mechanics: rawMechanics }
      : rawMechanics;

    return envelopeToRuntimeCompatibilityItem(envelopeInput).mechanicsBlock;
  }

  if (!hasMeaningfulLegacyMechanicsContent(item)) {
    return undefined;
  }

  return legacyItemToItemMechanicsBlock({
    name: item.name,
    notes: item.notes,
    equippedEffects: item.equippedEffects,
    additionalDamage: item.additionalDamage,
    useAbilityModifierForDamage: item.useAbilityModifierForDamage,
    damageDice: item.damageDice,
    damageModifier: item.damageModifier,
    damageType: item.damageType,
    attackAbility: item.attackAbility,
    isProficient: item.isProficient,
    weaponRange: item.weaponRange,
  });
}

function makeStableEffectId(itemId: string, effect: ItemEffect, index: number): string {
  if (effect.id && effect.id.trim().length > 0) {
    if (effect.id.startsWith(`${itemId}::`)) {
      return effect.id;
    }
    return `${itemId}::${effect.id}`;
  }

  const signature = [
    effect.type,
    effect.label,
    effect.description ?? "",
    effect.actionType ?? "",
    effect.statKey ?? "",
    effect.statValue != null ? String(effect.statValue) : "",
    effect.attackDamageDice ?? "",
    effect.attackDamageType ?? "",
    effect.triggerType ?? "",
    effect.triggerCondition ?? "",
    effect.resourceName ?? "",
    effect.resourceMaxBonus != null ? String(effect.resourceMaxBonus) : "",
    effect.uses != null ? String(effect.uses) : "",
    effect.resetOn ?? "",
    effect.maxTargets != null ? String(effect.maxTargets) : "",
    String(index),
  ].join("|");

  return `${itemId}::projected::${signature}`;
}

function withStableEffectIds(itemId: string, effects: ItemEffect[] | undefined): ItemEffect[] {
  if (!effects || effects.length === 0) return [];
  return effects.map((effect, index) => ({
    ...effect,
    id: makeStableEffectId(itemId, effect, index),
  }));
}

function mergeProjectedWithLegacyEffects(
  itemId: string,
  projected: ItemEffect[] | undefined,
  legacy: ItemEffect[] | undefined,
): ItemEffect[] | undefined {
  const projectedStable = withStableEffectIds(itemId, projected);
  const legacyStable = withStableEffectIds(itemId, legacy);

  if (projectedStable.length === 0 && legacyStable.length === 0) {
    return undefined;
  }

  if (projectedStable.length === 0) {
    return legacyStable;
  }

  const legacyById = new Map<string, ItemEffect>();
  for (const effect of legacyStable) {
    legacyById.set(effect.id, effect);
  }

  const merged = projectedStable.map((effect) => {
    const legacyOverride = legacyById.get(effect.id);
    return legacyOverride ? { ...effect, ...legacyOverride, id: effect.id } : effect;
  });

  const mergedIds = new Set(merged.map((effect) => effect.id));
  for (const effect of legacyStable) {
    if (!mergedIds.has(effect.id)) {
      merged.push(effect);
    }
  }

  return merged;
}

export function projectRuntimeItemCompatibility(item: Partial<InventoryItem>): {
  mechanics: ItemMechanicsBlock | undefined;
  compatibility: ItemMechanicsCompatibilityShape;
} {
  const mechanics = resolveRuntimeItemMechanics(item);
  const projected = mechanics ? itemMechanicsBlockToLegacyCompatibility(mechanics) : {};
  const legacy = toLegacyCompatibilityShape(item);
  const stableItemId = item.id ?? "runtime_item";

  return {
    mechanics,
    compatibility: {
      notes: legacy.notes ?? projected.notes,
      attackAbility: legacy.attackAbility ?? projected.attackAbility,
      isProficient: legacy.isProficient ?? projected.isProficient,
      useAbilityModifierForDamage:
        legacy.useAbilityModifierForDamage ?? projected.useAbilityModifierForDamage,
      damageDice: legacy.damageDice ?? projected.damageDice,
      damageModifier: legacy.damageModifier ?? projected.damageModifier,
      damageType: legacy.damageType ?? projected.damageType,
      additionalDamage: legacy.additionalDamage ?? projected.additionalDamage,
      weaponRange: legacy.weaponRange ?? projected.weaponRange,
      equippedEffects: mergeProjectedWithLegacyEffects(
        stableItemId,
        projected.equippedEffects,
        legacy.equippedEffects,
      ),
    },
  };
}

export function normalizeRuntimeInventoryItem<T extends Partial<InventoryItem>>(item: T): T {
  const projected = projectRuntimeItemCompatibility(item);
  return {
    ...item,
    ...(projected.mechanics ? { mechanics: projected.mechanics } : { mechanics: undefined }),
    ...projected.compatibility,
  } as T;
}

/**
 * Scores a mechanics block for merge preference. Higher = better quality.
 * Factors: number of mechanic entries, review confidence, fewer unsupported/unresolved segments.
 */
function scoreItemMechanicsBlock(block: ItemMechanicsBlock): number {
  const unsupportedPenalty = (block.unresolvedSegments?.length ?? 0) * 2 + (block.review.unsupportedSegments?.length ?? 0);
  const mechanicBonus = block.mechanics.length * 2;
  const confidenceBonus =
    block.review.confidence === "high" ? 4 :
    block.review.confidence === "medium" ? 2 :
    block.review.confidence === "low" ? 1 : 0;
  return mechanicBonus + confidenceBonus - unsupportedPenalty;
}

/**
 * Merges two ItemMechanicsBlock values deterministically.
 * - Prefers the higher-scoring block as the base (by mechanic count, confidence, unsupported segment count).
 * - Merges unresolvedSegments from both.
 * - Accumulates compatibility notes from both so provenance is preserved.
 * - Never silently discards: if both have mechanics, the better one wins but the other's
 *   notes and unresolved segments are retained.
 */
export function mergeItemMechanicsBlocks(
  existing: ItemMechanicsBlock | undefined,
  incoming: ItemMechanicsBlock | undefined,
): ItemMechanicsBlock | undefined {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const existingScore = scoreItemMechanicsBlock(existing);
  const incomingScore = scoreItemMechanicsBlock(incoming);
  const [winner, other] = existingScore >= incomingScore ? [existing, incoming] : [incoming, existing];

  const mergedUnresolved = [
    ...(winner.unresolvedSegments ?? []),
    ...(other.unresolvedSegments ?? []),
  ];
  const allNotes = [
    ...(winner.compatibility?.notes ?? []),
    ...(other.compatibility?.notes ?? []),
    `merged: winner score=${Math.max(existingScore, incomingScore)}, other score=${Math.min(existingScore, incomingScore)}`,
  ];

  return {
    ...winner,
    ...(mergedUnresolved.length > 0 ? { unresolvedSegments: mergedUnresolved } : {}),
    compatibility: {
      ...winner.compatibility,
      notes: [...new Set(allNotes)],
    },
  };
}

export function getRuntimeItemProjectedEffects(item: Partial<InventoryItem>): ItemEffect[] {
  return projectRuntimeItemCompatibility(item).compatibility.equippedEffects ?? [];
}

export function buildProjectedEffectPinUpdate(
  item: InventoryItem,
  projectedEffectId: string,
  pinned: boolean,
): Partial<InventoryItem> {
  const effects = getRuntimeItemProjectedEffects(item);
  return {
    equippedEffects: effects.map((effect) =>
      effect.id === projectedEffectId ? { ...effect, pinned } : effect
    ),
  };
}
