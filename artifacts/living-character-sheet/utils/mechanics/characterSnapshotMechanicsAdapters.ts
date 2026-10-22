import type {
  Character,
  CharacterSnapshot,
  InventoryItem,
  ItemEffect,
  ItemMechanicsBlock,
} from "@/types";
import { normalizeLocationHierarchyRecords } from "@/utils/locationHierarchy";
import { legacyItemToItemMechanicsBlock } from "./itemMechanicsAdapters";
import { envelopeToRuntimeCompatibilityItem, runtimeCompatibilityItemToEnvelope } from "./mechanicsEnvelopeAdapters";

import { readSnapshotEffectUsage } from "./snapshotEffectUsage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asItemEffects(value: unknown): ItemEffect[] | undefined {
  return Array.isArray(value) ? (value as ItemEffect[]) : undefined;
}

function asAdditionalDamage(value: unknown): InventoryItem["additionalDamage"] {
  return Array.isArray(value) ? (value as InventoryItem["additionalDamage"]) : undefined;
}

export function hasMeaningfulLegacyMechanicsContent(item: Partial<InventoryItem>): boolean {
  const hasEffects = (item.equippedEffects?.length ?? 0) > 0;
  const hasAdditionalDamage = (item.additionalDamage?.length ?? 0) > 0;
  const hasWeaponFields =
    (typeof item.damageDice === "string" && item.damageDice.trim().length > 0) ||
    (typeof item.damageType === "string" && item.damageType.trim().length > 0) ||
    typeof item.damageModifier === "number" ||
    (typeof item.attackAbility === "string" && item.attackAbility.trim().length > 0) ||
    (typeof item.weaponRange === "string" && item.weaponRange.trim().length > 0);
  return hasEffects || hasAdditionalDamage || hasWeaponFields;
}

function resolveItemMechanics(rawItem: Partial<InventoryItem>): ItemMechanicsBlock | undefined {
  const rawMechanics = rawItem.mechanics as unknown;

  if (isRecord(rawMechanics)) {
    const looksLikeBlock =
      rawMechanics["schemaVersion"] === "v1" &&
      rawMechanics["ownerType"] === "item" &&
      Array.isArray(rawMechanics["mechanics"]);

    const envelopeInput = looksLikeBlock
      ? { schemaVersion: "v1", ownerType: "item", mechanics: rawMechanics }
      : rawMechanics;

    const normalized = envelopeToRuntimeCompatibilityItem(envelopeInput);
    return normalized.mechanicsBlock;
  }

  if (!hasMeaningfulLegacyMechanicsContent(rawItem)) {
    return undefined;
  }

  return legacyItemToItemMechanicsBlock({
    name: rawItem.name,
    notes: rawItem.notes,
    equippedEffects: asItemEffects(rawItem.equippedEffects),
    additionalDamage: asAdditionalDamage(rawItem.additionalDamage),
    useAbilityModifierForDamage: rawItem.useAbilityModifierForDamage,
    damageDice: rawItem.damageDice,
    damageModifier: rawItem.damageModifier,
    damageType: rawItem.damageType,
    attackAbility: rawItem.attackAbility,
    isProficient: rawItem.isProficient,
    weaponRange: rawItem.weaponRange,
  });
}

function normalizeInventoryForSnapshot(items: InventoryItem[] | undefined): InventoryItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item) => {
    const mechanics = resolveItemMechanics(item);
    return {
      ...item,
      ...(mechanics ? { mechanics } : {}),
      ...(!mechanics ? { mechanics: undefined } : {}),
    };
  });
}

function resolveAuthoritativeCharacterMechanics(snapshot: CharacterSnapshot): Character["mechanics"] | undefined {
  if (snapshot.character?.mechanics) {
    return snapshot.character.mechanics;
  }
  return snapshot.mechanics;
}

export function normalizeCharacterSnapshotMechanics(snapshot: CharacterSnapshot): CharacterSnapshot {
  const inventory = normalizeInventoryForSnapshot(snapshot.inventory);
  const normalizedLocations = normalizeLocationHierarchyRecords(snapshot.locations ?? []);
  const authoritativeCharacterMechanics = resolveAuthoritativeCharacterMechanics(snapshot);

  return {
    ...snapshot,
    spellEffectUses: readSnapshotEffectUsage(snapshot.spellEffectUses, "spellEffectUses"),
    itemActionUses: readSnapshotEffectUsage(snapshot.itemActionUses, "itemActionUses"),
    inventory,
    locations: normalizedLocations,
    character: {
      ...snapshot.character,
      ...(authoritativeCharacterMechanics ? { mechanics: authoritativeCharacterMechanics } : {}),
      ...(!authoritativeCharacterMechanics ? { mechanics: undefined } : {}),
    },
    ...(authoritativeCharacterMechanics ? { mechanics: authoritativeCharacterMechanics } : {}),
    ...(!authoritativeCharacterMechanics ? { mechanics: undefined } : {}),
  };
}

export function assemblePortableCharacterSnapshot(snapshot: CharacterSnapshot): CharacterSnapshot {
  const normalized = normalizeCharacterSnapshotMechanics(snapshot);

  const inventory = normalized.inventory.map((item) => {
    const hasSourceMechanics = Boolean(item.mechanics);
    const hasLegacyContent = hasMeaningfulLegacyMechanicsContent(item);

    if (!hasSourceMechanics && !hasLegacyContent) {
      return {
        ...item,
        mechanics: undefined,
      };
    }

    const envelope = runtimeCompatibilityItemToEnvelope({
      mechanics: item.mechanics,
      compatibilityShape: {
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
      },
      exportedFrom: item.name,
    });

    return {
      ...item,
      mechanics: envelope.mechanics,
    };
  });

  const authoritativeCharacterMechanics = resolveAuthoritativeCharacterMechanics(normalized);

  return {
    ...normalized,
    inventory,
    character: {
      ...normalized.character,
      ...(authoritativeCharacterMechanics ? { mechanics: authoritativeCharacterMechanics } : {}),
      ...(!authoritativeCharacterMechanics ? { mechanics: undefined } : {}),
    },
    ...(authoritativeCharacterMechanics ? { mechanics: authoritativeCharacterMechanics } : {}),
    ...(!authoritativeCharacterMechanics ? { mechanics: undefined } : {}),
  };
}
