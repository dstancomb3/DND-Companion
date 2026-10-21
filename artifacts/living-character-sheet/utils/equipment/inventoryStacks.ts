import type { InventoryItem } from "@/types";

type StackableInventoryShape = Omit<InventoryItem, "id" | "quantity" | "equipped">;

function buildStackableInventoryShape(item: InventoryItem): StackableInventoryShape {
  return {
    name: item.name.trim().toLowerCase(),
    pinned: item.pinned,
    category: item.category,
    notes: item.notes,
    weight: item.weight,
    value: item.value,
    equippedEffects: item.equippedEffects,
    attackAbility: item.attackAbility,
    isProficient: item.isProficient,
    useAbilityModifierForDamage: item.useAbilityModifierForDamage,
    damageDice: item.damageDice,
    damageModifier: item.damageModifier,
    damageType: item.damageType,
    additionalDamage: item.additionalDamage,
    weaponRange: item.weaponRange,
    imageUri: item.imageUri,
    imageSource: item.imageSource,
    suppressWeaponCard: item.suppressWeaponCard,
    subtype: item.subtype,
    tags: item.tags ? [...item.tags].sort() : undefined,
    sourceTag: item.sourceTag,
    mechanics: item.mechanics,
    questLink: item.questLink,
  };
}

export function buildInventoryStackKey(item: InventoryItem): string {
  return JSON.stringify(buildStackableInventoryShape(item));
}

export function splitInventoryStackForEquip(
  items: InventoryItem[],
  targetId: string,
  equippedItemId: string,
): { inventory: InventoryItem[]; equippedItemId: string; didSplit: boolean } {
  const target = items.find((item) => item.id === targetId);
  if (!target || target.quantity <= 1) {
    return {
      inventory: items.map((item) => (item.id === targetId ? { ...item, equipped: true } : item)),
      equippedItemId: targetId,
      didSplit: false,
    };
  }

  const inventory = items.flatMap((item) => {
    if (item.id !== targetId) return [item];
    return [
      { ...item, quantity: item.quantity - 1, equipped: false },
      { ...item, id: equippedItemId, quantity: 1, equipped: true },
    ];
  });

  return {
    inventory,
    equippedItemId,
    didSplit: true,
  };
}

export function mergeInventoryItemIntoMatchingUnequippedStack(
  items: InventoryItem[],
  itemToMerge: InventoryItem,
): { inventory: InventoryItem[]; mergedIntoId: string; merged: boolean } {
  const stackKey = buildInventoryStackKey({ ...itemToMerge, equipped: false });
  const mergeIndex = items.findIndex(
    (item) => !item.equipped && buildInventoryStackKey({ ...item, equipped: false }) === stackKey,
  );

  if (mergeIndex === -1) {
    return {
      inventory: [...items, itemToMerge],
      mergedIntoId: itemToMerge.id,
      merged: false,
    };
  }

  const mergedItem = {
    ...items[mergeIndex],
    quantity: items[mergeIndex].quantity + itemToMerge.quantity,
    equipped: false,
  };
  const inventory = items.map((item, index) => (index === mergeIndex ? mergedItem : item));

  return {
    inventory,
    mergedIntoId: mergedItem.id,
    merged: true,
  };
}

/**
 * Splits `splitQty` units out of a stack into a new inventory item with `newId`.
 * Returns null if the split is invalid (splitQty out of range).
 */
export function splitInventoryStack(
  items: InventoryItem[],
  id: string,
  splitQty: number,
  newId: string,
): { inventory: InventoryItem[]; newItemId: string } | null {
  const target = items.find((item) => item.id === id);
  if (!target || splitQty < 1 || splitQty >= target.quantity) return null;

  const newItem: InventoryItem = { ...target, id: newId, quantity: splitQty, equipped: false };
  const inventory = [
    ...items.map((item) =>
      item.id === id ? { ...item, quantity: item.quantity - splitQty } : item,
    ),
    newItem,
  ];
  return { inventory, newItemId: newId };
}