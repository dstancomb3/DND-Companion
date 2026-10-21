import type { InventoryItem } from "@/types";
import type { LootAssignmentItem } from "@/utils/partyApi";

export function isPartyTransferEligibleItem(item: InventoryItem): boolean {
  if (!item) return false;
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) return false;
  if (item.equipped) return false;
  return true;
}

export function toLootAssignmentCategory(item: InventoryItem): LootAssignmentItem["category"] {
  if (item.category === "weapon") return "weapon";
  if (item.category === "armor") return "armor";
  if (item.category === "accessory") return "accessory";
  if (item.category === "consumable") return "consumable";
  if (item.category === "quest") return "quest";
  if (item.category === "magic") return "magic";
  if (item.category === "gear") return "gear";
  if (item.category === "treasure") return "treasure";
  if (item.category === "map") return "map";
  return "other";
}

export function buildLootAssignmentItemFromInventory(
  item: InventoryItem,
  quantity: number,
): LootAssignmentItem {
  const normalizedQuantity = Number.isFinite(quantity)
    ? Math.max(1, Math.floor(quantity))
    : 1;
  const { id: _itemId, ...itemWithoutId } = item;

  return {
    name: item.name,
    quantity: normalizedQuantity,
    category: toLootAssignmentCategory(item),
    notes: item.notes,
    value: item.value,
    imageUri: item.imageUri,
    imageSource: item.imageSource,
    inventoryItem: {
      ...itemWithoutId,
      quantity: normalizedQuantity,
      equipped: false,
    },
  };
}

export function getTransferableInventoryItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter(isPartyTransferEligibleItem);
}

export function getRemainingQuantityAfterTransfer(currentQuantity: number, sentQuantity: number): number {
  const current = Number.isFinite(currentQuantity) ? Math.max(0, Math.floor(currentQuantity)) : 0;
  const sent = Number.isFinite(sentQuantity) ? Math.max(1, Math.floor(sentQuantity)) : 1;
  return Math.max(0, current - sent);
}
