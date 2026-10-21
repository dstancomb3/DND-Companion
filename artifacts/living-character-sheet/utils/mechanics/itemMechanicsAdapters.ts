import type {
  AdditionalDamage,
  ItemEffect,
  ItemMechanicsBlock,
  ItemMechanicsCompatibilityShape,
  MechanicDefinition,
  MechanicsCompatibilityMetadata,
  ReviewState,
  UnsupportedSegment,
} from "@/types";

type LegacyItemMechanicsInput = ItemMechanicsCompatibilityShape & {
  id?: string;
  name?: string;
  category?: string;
  mechanics?: ItemMechanicsBlock;
};

const DEFAULT_REVIEW: ReviewState = {
  reviewStatus: "needs_review",
  confidence: "medium",
  parserNotes: ["Generated from legacy item compatibility fields"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDamageType(raw: string | undefined):
  | "acid"
  | "bludgeoning"
  | "cold"
  | "fire"
  | "force"
  | "lightning"
  | "necrotic"
  | "piercing"
  | "poison"
  | "psychic"
  | "radiant"
  | "slashing"
  | "thunder"
  | "other" {
  const normalized = (raw ?? "").trim().toLowerCase();
  switch (normalized) {
    case "acid":
    case "bludgeoning":
    case "cold":
    case "fire":
    case "force":
    case "lightning":
    case "necrotic":
    case "piercing":
    case "poison":
    case "psychic":
    case "radiant":
    case "slashing":
    case "thunder":
      return normalized;
    default:
      return "other";
  }
}

function buildMechanicId(prefix: string, index: number): string {
  return `${prefix}_${index + 1}`;
}

function makeUnsupportedSegment(rawText: string, reason: UnsupportedSegment["reason"] = "missing_required_detail"): UnsupportedSegment {
  return { rawText, reason };
}

/**
 * Builds a canonical weapon attack mechanic from top-level weapon fields
 * (damageDice / damageType / etc.) on items that have no attack_damage equippedEffect.
 * These fields exist on InventoryItem but are not always mirrored into effects.
 */
function toCanonicalWeaponAttackAction(input: LegacyItemMechanicsInput, index: number): MechanicDefinition {
  const name = input.name ?? "Weapon Attack";
  const notes: string[] = [];
  if (input.attackAbility) notes.push(`ability: ${input.attackAbility}`);
  if (typeof input.isProficient === "boolean") notes.push(`proficient: ${input.isProficient}`);
  if (typeof input.useAbilityModifierForDamage === "boolean") {
    notes.push(`useAbilityModifierForDamage: ${input.useAbilityModifierForDamage}`);
  }
  if (input.weaponRange) notes.push(`range: ${input.weaponRange}`);

  return {
    schemaVersion: "v1",
    mechanicId: buildMechanicId("canonical_weapon", index),
    kind: "action",
    name,
    sourceType: "item",
    review: {
      reviewStatus: "needs_review",
      confidence: "medium",
      parserNotes: ["Built from canonical item weapon fields (damageDice/damageType)", ...notes],
    },
    action: {
      actionType: "attack",
      activation: "action",
      effects: [],
      target: {
        selectionMode: "single",
        targetKinds: ["enemy"],
        quantity: { mode: "exact", value: 1 },
      },
      resolution: {
        mode: "attack_roll",
        attackType: input.weaponRange ? "ranged_weapon" : "melee_weapon",
        damageParts: [
          {
            dice: input.damageDice,
            flat: input.damageModifier,
            damageType: normalizeDamageType(input.damageType),
          },
        ],
      },
    },
  };
}

function toNarrativePassive(effect: ItemEffect, index: number): MechanicDefinition {
  const summary = effect.description?.trim() || effect.label;
  return {
    schemaVersion: "v1",
    mechanicId: buildMechanicId("legacy_passive", index),
    kind: "passive",
    name: effect.label,
    sourceType: "item",
    review: DEFAULT_REVIEW,
    description: effect.description,
    passive: {
      passiveType: effect.type === "stat_bonus" ? "static_bonus" : "passive_grant",
      effects: [
        {
          effectType: "narrative_only",
          narrative: { summary },
        },
      ],
      notes: effect.type === "stat_bonus" && effect.statKey && typeof effect.statValue === "number"
        ? `legacy stat bonus: ${effect.statKey} ${effect.statValue >= 0 ? "+" : ""}${effect.statValue}`
        : undefined,
    },
  };
}

function toAttackAction(effect: ItemEffect, index: number): MechanicDefinition {
  return {
    schemaVersion: "v1",
    mechanicId: buildMechanicId("legacy_attack", index),
    kind: "action",
    name: effect.label,
    sourceType: "item",
    review: DEFAULT_REVIEW,
    description: effect.description,
    action: {
      actionType: "attack",
      activation: "action",
      effects: [],
      target: {
        selectionMode: "single",
        targetKinds: ["enemy"],
        quantity: { mode: "exact", value: 1 },
      },
      resolution: {
        mode: "attack_roll",
        attackType: "melee_weapon",
        damageParts: [
          {
            dice: effect.attackDamageDice,
            flat: effect.attackDamageBonus,
            damageType: normalizeDamageType(effect.attackDamageType),
          },
        ],
      },
    },
  };
}

function toSpellAction(effect: ItemEffect, index: number): MechanicDefinition {
  const summary = effect.description?.trim() || effect.label;
  return {
    schemaVersion: "v1",
    mechanicId: buildMechanicId("legacy_spell", index),
    kind: "action",
    name: effect.label,
    sourceType: "item",
    review: DEFAULT_REVIEW,
    description: effect.description,
    action: {
      actionType: "spell",
      activation: "action",
      effects: [],
      target: {
        selectionMode: "none",
        targetKinds: ["self"],
        quantity: { mode: "exact", value: 1 },
      },
      resolution: {
        mode: "utility",
        utilityKind: "magic",
        outcomeEffects: [
          {
            effectType: "narrative_only",
            narrative: { summary },
          },
        ],
      },
      ...(typeof effect.uses === "number" && effect.uses > 0
        ? {
            usage: [
              {
                limitType: "fixed_uses",
                maxUses: effect.uses,
                reset: effect.resetOn ?? "long_rest",
              },
            ],
          }
        : {}),
    },
  };
}

function mapLegacyEffectsToMechanics(effects: ItemEffect[] | undefined): {
  mechanics: MechanicDefinition[];
  unresolved: UnsupportedSegment[];
} {
  if (!effects || effects.length === 0) {
    return { mechanics: [], unresolved: [] };
  }

  const mechanics: MechanicDefinition[] = [];
  const unresolved: UnsupportedSegment[] = [];

  effects.forEach((effect, index) => {
    if (effect.type === "attack_damage") {
      if (!effect.attackDamageDice || !effect.attackDamageType) {
        unresolved.push(makeUnsupportedSegment(`effect:${effect.label}:attack_damage_missing_fields`));
        return;
      }
      mechanics.push(toAttackAction(effect, index));
      return;
    }

    if (effect.type === "spell") {
      mechanics.push(toSpellAction(effect, index));
      return;
    }

    if (effect.type === "stat_bonus" && (!effect.statKey || typeof effect.statValue !== "number")) {
      unresolved.push(makeUnsupportedSegment(`effect:${effect.label}:stat_bonus_missing_fields`));
    }

    mechanics.push(toNarrativePassive(effect, index));
  });

  return { mechanics, unresolved };
}

function mapAdditionalDamage(additionalDamage: AdditionalDamage[] | undefined, offset: number): {
  mechanics: MechanicDefinition[];
  unresolved: UnsupportedSegment[];
} {
  if (!additionalDamage || additionalDamage.length === 0) {
    return { mechanics: [], unresolved: [] };
  }

  const mechanics: MechanicDefinition[] = [];
  const unresolved: UnsupportedSegment[] = [];

  additionalDamage.forEach((entry, index) => {
    if (!entry.dice || !entry.damageType) {
      unresolved.push(makeUnsupportedSegment(`additionalDamage:${index}:missing_fields`));
      return;
    }

    mechanics.push({
      schemaVersion: "v1",
      mechanicId: buildMechanicId("legacy_extra_damage", offset + index),
      kind: "action",
      name: entry.sourceLabel || `Additional Damage ${index + 1}`,
      sourceType: "item",
      review: DEFAULT_REVIEW,
      action: {
        actionType: "attack",
        activation: "special",
        effects: [],
        target: {
          selectionMode: "none",
          targetKinds: ["self"],
          quantity: { mode: "exact", value: 1 },
        },
        resolution: {
          mode: "attack_roll",
          attackType: "melee_weapon",
          damageParts: [
            {
              dice: entry.dice,
              flat: entry.damageModifier,
              damageType: normalizeDamageType(entry.damageType),
            },
          ],
        },
      },
    });
  });

  return { mechanics, unresolved };
}

function buildCompatibilityMetadata(input: LegacyItemMechanicsInput): MechanicsCompatibilityMetadata {
  const preservedLegacyFields: string[] = [];

  if (input.equippedEffects && input.equippedEffects.length > 0) preservedLegacyFields.push("equippedEffects");
  if (input.additionalDamage && input.additionalDamage.length > 0) preservedLegacyFields.push("additionalDamage");
  if (input.damageDice) preservedLegacyFields.push("damageDice");
  if (input.damageType) preservedLegacyFields.push("damageType");
  if (typeof input.damageModifier === "number") preservedLegacyFields.push("damageModifier");
  if (input.attackAbility) preservedLegacyFields.push("attackAbility");
  if (typeof input.isProficient === "boolean") preservedLegacyFields.push("isProficient");
  if (typeof input.useAbilityModifierForDamage === "boolean") {
    preservedLegacyFields.push("useAbilityModifierForDamage");
  }
  if (input.weaponRange) preservedLegacyFields.push("weaponRange");

  return {
    migratedFrom: "legacy_item",
    legacyEffectCount: input.equippedEffects?.length ?? 0,
    legacyAdditionalDamageCount: input.additionalDamage?.length ?? 0,
    preservedLegacyFields,
  };
}

export function legacyItemToItemMechanicsBlock(input: LegacyItemMechanicsInput): ItemMechanicsBlock {
  if (input.mechanics && isRecord(input.mechanics)) {
    return input.mechanics;
  }

  const effectsResult = mapLegacyEffectsToMechanics(input.equippedEffects);
  const additionalDamageResult = mapAdditionalDamage(input.additionalDamage, effectsResult.mechanics.length);

  // If top-level canonical weapon fields exist (damageDice + damageType) and no attack_damage
  // effect is already present in equippedEffects, synthesize a weapon attack mechanic from them.
  // This prevents silent data loss for items that store weapon stats canonically without effects.
  const hasAttackDamageEffect = (input.equippedEffects ?? []).some((effect) => effect.type === "attack_damage");
  const canonicalWeaponMechanics: MechanicDefinition[] = [];
  if (!hasAttackDamageEffect && input.damageDice?.trim() && input.damageType?.trim()) {
    canonicalWeaponMechanics.push(
      toCanonicalWeaponAttackAction(input, effectsResult.mechanics.length + additionalDamageResult.mechanics.length)
    );
  }
  const unresolved = [...effectsResult.unresolved, ...additionalDamageResult.unresolved];

  const parserNotes: string[] = [
    "Converted from legacy item compatibility fields",
    ...(input.notes ? [`legacy notes: ${input.notes}`] : []),
  ];

  return {
    schemaVersion: "v1",
    ownerType: "item",
    mechanics: [...effectsResult.mechanics, ...additionalDamageResult.mechanics, ...canonicalWeaponMechanics],
    review: {
      ...DEFAULT_REVIEW,
      parserNotes,
      ...(unresolved.length > 0 ? { unsupportedSegments: unresolved } : {}),
    },
    compatibility: buildCompatibilityMetadata(input),
    ...(unresolved.length > 0 ? { unresolvedSegments: unresolved } : {}),
    ...(input.name ? { exportedFrom: input.name } : {}),
  };
}

function effectFromPassiveMechanic(mechanic: MechanicDefinition): ItemEffect {
  const passive = mechanic.kind === "passive" ? mechanic.passive : undefined;
  const summary = passive?.notes || mechanic.description || mechanic.name;
  return {
    id: mechanic.mechanicId,
    type: "note",
    label: mechanic.name,
    description: summary,
  };
}

function additionalDamageFromAction(mechanic: MechanicDefinition): AdditionalDamage | null {
  if (mechanic.kind !== "action" || mechanic.action.actionType !== "attack" || mechanic.action.resolution.mode !== "attack_roll") {
    return null;
  }

  const firstDamagePart = mechanic.action.resolution.damageParts?.[0];
  if (!firstDamagePart?.dice || !firstDamagePart.damageType) {
    return null;
  }

  return {
    dice: firstDamagePart.dice,
    damageModifier: firstDamagePart.flat,
    damageType: firstDamagePart.damageType,
    sourceLabel: mechanic.name,
  };
}

export function itemMechanicsBlockToLegacyCompatibility(block: ItemMechanicsBlock): ItemMechanicsCompatibilityShape {
  const equippedEffects: ItemEffect[] = [];
  const additionalDamage: AdditionalDamage[] = [];

  for (const mechanic of block.mechanics) {
    const addDamage = additionalDamageFromAction(mechanic);
    if (addDamage) {
      additionalDamage.push(addDamage);
      continue;
    }
    equippedEffects.push(effectFromPassiveMechanic(mechanic));
  }

  const derivedNotes = [
    ...(block.review.parserNotes ?? []),
    ...(block.review.unsupportedSegments ?? []).map((segment) => `unsupported:${segment.reason}:${segment.rawText}`),
    ...(block.unresolvedSegments ?? []).map((segment) => `unresolved:${segment.reason}:${segment.rawText}`),
  ];

  return {
    equippedEffects: equippedEffects.length > 0 ? equippedEffects : undefined,
    additionalDamage: additionalDamage.length > 0 ? additionalDamage : undefined,
    notes: derivedNotes.length > 0 ? derivedNotes.join("\n") : undefined,
  };
}
