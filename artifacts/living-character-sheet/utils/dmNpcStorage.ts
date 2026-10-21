import type { InventoryItem } from "@/types";

function isInventoryCategory(value: unknown): value is InventoryItem["category"] {
  return value === "weapon"
    || value === "armor"
    || value === "accessory"
    || value === "magic"
    || value === "consumable"
    || value === "quest"
    || value === "gear"
    || value === "treasure"
    || value === "map"
    || value === "other";
}

function isInventoryAttackAbility(value: unknown): value is NonNullable<InventoryItem["attackAbility"]> {
  return value === "strength"
    || value === "dexterity"
    || value === "constitution"
    || value === "intelligence"
    || value === "wisdom"
    || value === "charisma";
}

function isInventorySourceTag(value: unknown): value is NonNullable<InventoryItem["sourceTag"]> {
  return value === "official" || value === "custom";
}

export function normalizeSavedDmNpcInventory(raw: unknown): InventoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.name !== "string" || !isInventoryCategory(record.category)) {
      return [];
    }

    const quantity = typeof record.quantity === "number" && Number.isFinite(record.quantity)
      ? Math.max(1, Math.floor(record.quantity))
      : 1;

    return [{
      id: record.id,
      name: record.name,
      quantity,
      equipped: record.equipped === true,
      category: record.category,
      subtype: typeof record.subtype === "string" ? record.subtype : undefined,
      notes: typeof record.notes === "string" ? record.notes : undefined,
      weight: typeof record.weight === "number" && Number.isFinite(record.weight) ? record.weight : undefined,
      value: typeof record.value === "number" && Number.isFinite(record.value) ? record.value : undefined,
      rarity: typeof record.rarity === "string" ? record.rarity : undefined,
      tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
      sourceTag: isInventorySourceTag(record.sourceTag) ? record.sourceTag : undefined,
      attackBonus: typeof record.attackBonus === "number" && Number.isFinite(record.attackBonus) ? record.attackBonus : undefined,
      damageDice: typeof record.damageDice === "string" ? record.damageDice : undefined,
      damageBonus: typeof record.damageBonus === "number" && Number.isFinite(record.damageBonus) ? record.damageBonus : undefined,
      damageType: typeof record.damageType === "string" ? record.damageType : undefined,
      acBonus: typeof record.acBonus === "number" && Number.isFinite(record.acBonus) ? record.acBonus : undefined,
      spellAttached: typeof record.spellAttached === "string" ? record.spellAttached : undefined,
      chargesMax: typeof record.chargesMax === "number" && Number.isFinite(record.chargesMax) ? record.chargesMax : undefined,
      chargesCurrent: typeof record.chargesCurrent === "number" && Number.isFinite(record.chargesCurrent) ? record.chargesCurrent : undefined,
      usesMax: typeof record.usesMax === "number" && Number.isFinite(record.usesMax) ? record.usesMax : undefined,
      usesCurrent: typeof record.usesCurrent === "number" && Number.isFinite(record.usesCurrent) ? record.usesCurrent : undefined,
      consumption: typeof record.consumption === "string" ? record.consumption : undefined,
      icon: typeof record.icon === "string" ? record.icon : undefined,
      source: typeof record.source === "string" ? record.source : undefined,
      sourceId: typeof record.sourceId === "string" ? record.sourceId : undefined,
      containerId: typeof record.containerId === "string" ? record.containerId : undefined,
      parentId: typeof record.parentId === "string" ? record.parentId : undefined,
      stackKey: typeof record.stackKey === "string" ? record.stackKey : undefined,
      attackAbility: isInventoryAttackAbility(record.attackAbility) ? record.attackAbility : undefined,
      isProficient: record.isProficient === true,
      equippedSlot: typeof record.equippedSlot === "string" ? record.equippedSlot : undefined,
      identified: typeof record.identified === "boolean" ? record.identified : undefined,
      attunementRequired: typeof record.attunementRequired === "boolean" ? record.attunementRequired : undefined,
      attuned: typeof record.attuned === "boolean" ? record.attuned : undefined,
      mechanics: typeof record.mechanics === "object" && record.mechanics !== null ? record.mechanics as InventoryItem["mechanics"] : undefined,
    }];
  });
}

export function normalizeSavedDmNpcRecord<T extends object & { inventory?: unknown }>(record: T): Omit<T, "inventory"> & { inventory: InventoryItem[] } {
  return {
    ...record,
    inventory: normalizeSavedDmNpcInventory(record.inventory),
  };
}