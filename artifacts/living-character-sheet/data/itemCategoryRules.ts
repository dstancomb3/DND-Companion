import type { ItemCategory } from "@/types";

const NON_EQUIPPABLE_CATEGORIES = new Set<ItemCategory>([
  "consumable",
  "map",
  "treasure",
  "quest",
  "other",
]);

export function isEquippableCategory(category: ItemCategory): boolean {
  return !NON_EQUIPPABLE_CATEGORIES.has(category);
}

export function isConsumptionCategory(category: ItemCategory): boolean {
  return category === "consumable";
}
