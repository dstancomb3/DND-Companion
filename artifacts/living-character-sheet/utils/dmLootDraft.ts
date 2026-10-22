import type { InventoryItem, ProposedInventoryItem } from "../types";
import type { LootAssignmentItem } from "./partyApi";

export type DmLootDraftFields = LootAssignmentItem & {
  rarity?: string;
  subtype?: string;
  tags?: string[];
  properties?: string;
  description?: string;
  mapImageUri?: string;
  attackAbility?: InventoryItem["attackAbility"];
  isProficient?: boolean;
  damageDice?: string;
  damageType?: string;
  weaponRange?: string;
  needsReview?: boolean;
  reviewAcknowledged?: boolean;
};

function inventoryCategory(category: LootAssignmentItem["category"]): InventoryItem["category"] {
  return category === "currency" ? "treasure" : category === "component" || category === "junk" ? "gear" : category;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function hasStructuredLootEffects(item: DmLootDraftFields): boolean {
  return !!item.inventoryItem?.mechanics || !!item.inventoryItem?.equippedEffects?.length;
}

export function createDmLootDraft(item: DmLootDraftFields): DmLootDraftFields {
  const snapshot = item.inventoryItem;
  const useWeaponDefaults = item.category === "weapon" && !hasStructuredLootEffects(item);
  return {
    ...item,
    value: item.value ?? snapshot?.value,
    notes: item.notes ?? snapshot?.notes,
    subtype: item.subtype ?? snapshot?.subtype ?? "",
    tags: [...(item.tags ?? snapshot?.tags ?? [])],
    properties: item.properties ?? "",
    description: item.description ?? "",
    mapImageUri: item.mapImageUri ?? (item.category === "map" ? item.imageUri ?? snapshot?.imageUri : ""),
    attackAbility: item.attackAbility ?? snapshot?.attackAbility ?? (useWeaponDefaults ? "strength" : undefined),
    isProficient: item.isProficient ?? snapshot?.isProficient ?? (useWeaponDefaults ? true : undefined),
    damageDice: item.damageDice ?? snapshot?.damageDice ?? "",
    damageType: item.damageType ?? snapshot?.damageType ?? "",
    weaponRange: item.weaponRange ?? snapshot?.weaponRange ?? "",
    needsReview: item.needsReview === true || (!!snapshot?.mechanics && snapshot.mechanics.review.reviewStatus !== "verified"),
  };
}

const categories = new Set(["weapon", "armor", "accessory", "consumable", "quest", "magic", "gear", "treasure", "map", "currency", "component", "junk", "other"]);

// Validate the response envelope before adapting it. Deep mechanics validation remains
// at the API boundary; preserving a reviewed block does not certify runtime support.
export function dmLootDraftFromProposal(raw: unknown): DmLootDraftFields {
  if (!isRecord(raw) || typeof raw.name !== "string" || !raw.name.trim()
    || !Number.isSafeInteger(raw.quantity) || Number(raw.quantity) <= 0
    || typeof raw.category !== "string" || !categories.has(raw.category)) {
    throw new Error("AI returned an invalid loot item. Generate again or add it manually.");
  }
  for (const key of ["value", "weight"]) {
    if (raw[key] != null && (typeof raw[key] !== "number" || !Number.isFinite(raw[key]) || Number(raw[key]) < 0)) throw new Error(`Invalid item ${key}`);
  }
  if (raw.mechanics != null && (!isRecord(raw.mechanics) || raw.mechanics.schemaVersion !== "v1"
    || raw.mechanics.ownerType !== "item" || !Array.isArray(raw.mechanics.mechanics) || !isRecord(raw.mechanics.review))) throw new Error("Invalid item mechanics envelope");
  if (raw.equippedEffects != null && (!Array.isArray(raw.equippedEffects) || !raw.equippedEffects.every(effect =>
    isRecord(effect) && typeof effect.id === "string" && typeof effect.type === "string" && typeof effect.label === "string"))) throw new Error("Invalid item effects");
  if (raw.tags != null && (!Array.isArray(raw.tags) || !raw.tags.every(tag => typeof tag === "string"))) throw new Error("Invalid item tags");
  for (const key of ["notes", "subtype", "damageDice", "damageType", "weaponRange"]) {
    if (raw[key] != null && typeof raw[key] !== "string") throw new Error(`Invalid item ${key}`);
  }
  const item = raw as unknown as ProposedInventoryItem;
  const snapshot: Omit<InventoryItem, "id"> = {
    name: item.name.trim(), quantity: item.quantity, category: inventoryCategory(item.category), equipped: false,
    value: item.value, weight: item.weight, subtype: item.subtype, notes: item.notes,
    tags: item.tags, sourceTag: item.sourceTag ?? (item.officialMatch ? "official" : "custom"),
    attackAbility: item.attackAbility, isProficient: item.isProficient,
    useAbilityModifierForDamage: item.useAbilityModifierForDamage,
    damageDice: item.damageDice, damageModifier: item.damageModifier, damageType: item.damageType,
    additionalDamage: item.additionalDamage, weaponRange: item.weaponRange,
    equippedEffects: item.equippedEffects, mechanics: item.mechanics,
  };
  return createDmLootDraft({
    name: snapshot.name, quantity: item.quantity, category: item.category,
    notes: item.notes, value: item.value, inventoryItem: snapshot,
    needsReview: item.needsReview || item.confidence !== "high",
  });
}

export function buildLootAssignmentNotes(item: DmLootDraftFields): string | undefined {
  const parts: string[] = [];
  const notes = item.notes?.replace(/^Map Image:\s*.+$/gim, "").replace(/\n{3,}/g, "\n\n").trim();
  if (notes) parts.push(notes);
  if (item.properties?.trim()) parts.push(`Properties: ${item.properties.trim()}`);
  if (item.description?.trim()) parts.push(`Description: ${item.description.trim()}`);
  if (item.rarity) parts.push(`Rarity: ${item.rarity}`);
  if (item.subtype?.trim()) parts.push(`Subtype: ${item.subtype.trim()}`);
  if (item.tags?.length) parts.push(`Tags: ${item.tags.join(", ")}`);
  if (item.category === "weapon") {
    const combat: string[] = [];
    if (item.attackAbility) combat.push(`ability=${item.attackAbility.toUpperCase()}`);
    if (typeof item.isProficient === "boolean") combat.push(`proficient=${item.isProficient ? "yes" : "no"}`);
    if (item.damageDice?.trim()) combat.push(`damage=${item.damageDice.trim()}${item.damageType?.trim() ? ` ${item.damageType.trim()}` : ""}`);
    if (item.weaponRange?.trim()) combat.push(`range=${item.weaponRange.trim()}`);
    if (combat.length) parts.push(`Weapon: ${combat.join(", ")}`);
  }
  if (item.needsReview) parts.push("Item effects require DM review; unsupported effects are not automated.");
  return parts.length ? parts.join("\n") : undefined;
}

export function toDmLootAssignment(item: DmLootDraftFields): LootAssignmentItem {
  if (!item.name.trim() || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new Error("Each loot row needs a name and positive whole-number quantity.");
  if (item.needsReview && !item.reviewAcknowledged) throw new Error("Review and confirm flagged item effects before assigning loot.");
  if (hasStructuredLootEffects(item)) {
    const baseline = createDmLootDraft({ name: item.inventoryItem!.name, quantity: item.quantity, category: item.inventoryItem!.category, inventoryItem: item.inventoryItem });
    for (const key of ["category", "attackAbility", "isProficient", "damageDice", "damageType", "weaponRange"] as const) {
      if ((key === "category" ? inventoryCategory(item.category) : item[key]) !== baseline[key]) throw new Error("This item's weapon stats are linked to its effects and cannot be changed in the loot draft.");
    }
  }
  const imageUri = item.category === "map" ? item.mapImageUri?.trim() || undefined : item.imageUri ?? item.inventoryItem?.imageUri;
  if (item.category === "map" && imageUri && !/^data:image\//i.test(imageUri) && !/^https?:\/\//i.test(imageUri)) throw new Error("Map images must use a shareable data URL or public HTTP(S) URL.");
  const notes = buildLootAssignmentNotes(item);
  const inventoryItem: Omit<InventoryItem, "id"> = {
    ...item.inventoryItem,
    name: item.name.trim(), quantity: item.quantity, equipped: false, category: inventoryCategory(item.category),
    notes, value: item.value, subtype: item.subtype?.trim() || undefined,
    tags: [...(item.tags ?? []), ...(item.rarity ? [item.rarity] : [])],
    imageUri, imageSource: imageUri ? item.imageSource ?? item.inventoryItem?.imageSource ?? "dm" : undefined,
    attackAbility: item.attackAbility, isProficient: item.isProficient,
    damageDice: item.damageDice?.trim() || undefined, damageType: item.damageType?.trim() || undefined,
    weaponRange: item.weaponRange?.trim() || undefined,
  };
  return { name: inventoryItem.name, quantity: item.quantity, category: item.category, notes, value: item.value,
    imageUri, imageSource: inventoryItem.imageSource, inventoryItem };
}
