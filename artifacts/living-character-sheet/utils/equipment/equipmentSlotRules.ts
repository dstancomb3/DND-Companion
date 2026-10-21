import type { InventoryItem } from "@/types";
import { isEquippableCategory } from "@/data/itemCategoryRules";

const ACCESSORY_HEAD = new Set(["Helm", "Circlet", "Hat"]);
const ACCESSORY_NECK = new Set(["Amulet", "Necklace"]);
const ACCESSORY_BACK = new Set(["Cloak", "Cape"]);
const ACCESSORY_HANDS = new Set(["Gloves", "Bracers"]);
const ACCESSORY_FEET = new Set(["Boots"]);
const ACCESSORY_WAIST = new Set(["Belt"]);
const ACCESSORY_RING = "Ring";
const RING_LIMIT = 10;

function hasTag(item: InventoryItem, tag: string): boolean {
  return (item.tags ?? []).some((value) => value === tag);
}

function isShield(item: InventoryItem): boolean {
  return item.category === "armor" && item.subtype === "Shield";
}

function handSlotCost(item: InventoryItem): 0 | 1 | 2 {
  if (item.category === "weapon") {
    return hasTag(item, "Two-Handed") ? 2 : 1;
  }
  if (isShield(item)) {
    return 1;
  }
  return 0;
}

function accessorySlotGroup(subtype: string | undefined): string | null {
  const value = subtype ?? "";
  if (ACCESSORY_HEAD.has(value)) return "head";
  if (ACCESSORY_NECK.has(value)) return "neck";
  if (ACCESSORY_BACK.has(value)) return "back";
  if (ACCESSORY_HANDS.has(value)) return "hands";
  if (ACCESSORY_FEET.has(value)) return "feet";
  if (ACCESSORY_WAIST.has(value)) return "waist";
  if (value === ACCESSORY_RING) return "ring";
  return null;
}

export interface NormalizeEquippedInventorySlotsOptions {
  preferredItemId?: string;
}

export interface NormalizeEquippedInventorySlotsResult {
  inventory: InventoryItem[];
  autoUnequippedIds: string[];
}

export function normalizeEquippedInventorySlots(
  items: InventoryItem[],
  options: NormalizeEquippedInventorySlotsOptions = {},
): NormalizeEquippedInventorySlotsResult {
  const preferredItemId = options.preferredItemId;
  const preferredExists = preferredItemId ? items.some((item) => item.id === preferredItemId) : false;

  const orderedItems = preferredExists
    ? [
        ...items.filter((item) => item.id === preferredItemId),
        ...items.filter((item) => item.id !== preferredItemId),
      ]
    : [...items];

  const keptEquippedIds = new Set<string>();
  let usedHands = 0;
  let shieldEquipped = false;
  let bodyArmorEquipped = false;
  let ringCount = 0;
  const accessorySlots = new Set<string>();

  for (const item of orderedItems) {
    if (!item.equipped) continue;
    if (!isEquippableCategory(item.category)) continue;

    if (item.category === "armor") {
      if (isShield(item)) {
        if (shieldEquipped) continue;
        if (usedHands + 1 > 2) continue;
        shieldEquipped = true;
        usedHands += 1;
        keptEquippedIds.add(item.id);
        continue;
      }

      if (bodyArmorEquipped) continue;
      bodyArmorEquipped = true;
      keptEquippedIds.add(item.id);
      continue;
    }

    if (item.category === "accessory") {
      const slot = accessorySlotGroup(item.subtype);
      if (!slot) {
        keptEquippedIds.add(item.id);
        continue;
      }
      if (slot === "ring") {
        if (ringCount >= RING_LIMIT) continue;
        ringCount += 1;
        keptEquippedIds.add(item.id);
        continue;
      }
      if (accessorySlots.has(slot)) continue;
      accessorySlots.add(slot);
      keptEquippedIds.add(item.id);
      continue;
    }

    const handCost = handSlotCost(item);
    if (handCost > 0 && usedHands + handCost > 2) continue;

    usedHands += handCost;
    keptEquippedIds.add(item.id);
  }

  const autoUnequippedIds: string[] = [];
  const normalized = items.map((item) => {
    const keepEquipped = item.equipped && isEquippableCategory(item.category) && keptEquippedIds.has(item.id);
    if (item.equipped && !keepEquipped) {
      autoUnequippedIds.push(item.id);
    }
    if (item.equipped === keepEquipped) return item;
    return { ...item, equipped: keepEquipped };
  });

  return {
    inventory: normalized,
    autoUnequippedIds,
  };
}
