import type { InventoryItem, ItemCategory, LootFilterCriteria, ProposedInventoryItem } from "@/types";
import { WEAPON_SUBTYPES, ARMOR_SUBTYPES, ACCESSORY_SUBTYPES } from "@/data/itemSubtypes";
import { ADVENTURING_GEAR, ARMOR_PRICES, POTION_PRICES, WEAPON_PRICES } from "@/data/dnd5eReference";

/**
 * Normalize a rarity tag from various formats to a canonical form.
 */
export function normalizeRarity(tag: string): string | null {
  const normalized = tag.toLowerCase().trim();
  const rarities = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"];
  for (const rarity of rarities) {
    if (normalized === rarity || normalized.includes(rarity)) {
      return rarity.charAt(0).toUpperCase() + rarity.slice(1);
    }
  }
  return null;
}

/**
 * Infer the rarity of an item from its tags or price.
 */
export function estimateItemRarity(item: InventoryItem | ProposedInventoryItem): string | null {
  // Check explicit tags first
  if (item.tags && item.tags.length > 0) {
    for (const tag of item.tags) {
      const rarity = normalizeRarity(tag);
      if (rarity) return rarity;
    }
  }

  // Infer from price estimate
  if (item.value && typeof item.value === "number") {
    if (item.value <= 50) return "Common";
    if (item.value <= 500) return "Uncommon";
    if (item.value <= 5000) return "Rare";
    if (item.value <= 50000) return "Very Rare";
    if (item.value <= 500000) return "Legendary";
    return "Artifact";
  }

  // Check name for keywords
  const name = item.name.toLowerCase();
  if (/(artifact|ancient|legendary|epic)/i.test(name)) return "Legendary";
  if (/(rare|enchanted|magical)/i.test(name)) return "Rare";
  if (/(uncommon|cursed)/i.test(name)) return "Uncommon";

  return null;
}

/**
 * Filter items by the given criteria.
 */
export function filterItemsByCategory(
  items: (InventoryItem | ProposedInventoryItem)[],
  criteria: LootFilterCriteria
): (InventoryItem | ProposedInventoryItem)[] {
  return items.filter((item) => {
    // Filter by rarity
    if (criteria.rarity && criteria.rarity.length > 0) {
      const itemRarity = estimateItemRarity(item);
      if (!itemRarity || !criteria.rarity.map((r) => r.toLowerCase()).includes(itemRarity.toLowerCase())) {
        return false;
      }
    }

    // Filter by category
    if (criteria.category && criteria.category.length > 0) {
      if (!criteria.category.includes(item.category)) {
        return false;
      }
    }

    // Filter by tags (match at least one)
    if (criteria.tags && criteria.tags.length > 0) {
      const itemTags = (item.tags || []).map((t) => t.toLowerCase());
      const hasMappingTag = criteria.tags.some((tag) => itemTags.some((t) => t.includes(tag.toLowerCase())));
      if (!hasMappingTag) {
        return false;
      }
    }

    // Filter by value range
    if (criteria.valueRange) {
      const itemValue = item.value ?? 0;
      if (itemValue < criteria.valueRange.min || itemValue > criteria.valueRange.max) {
        return false;
      }
    }

    // Filter by name (simple substring match)
    if (criteria.name && criteria.name.trim().length > 0) {
      if (!item.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
    }

    // Filter by plane origin (check tags for plane names)
    if (criteria.planeOrigins && criteria.planeOrigins.length > 0) {
      const itemTags = (item.tags || []).map((t) => t.toLowerCase());
      const planeMatch = criteria.planeOrigins.some((plane) =>
        itemTags.some((t) => t.includes(plane.toLowerCase()))
      );
      if (!planeMatch && criteria.planeOrigins.length > 0) {
        // Only filter if we actually have plane criteria and no match found
        // (allow untagged items to pass through unless we have strict plane matching)
        return false;
      }
    }

    return true;
  });
}

/**
 * Search items by all criteria and return filtered list.
 */
export function searchItemsByFilter(
  items: (InventoryItem | ProposedInventoryItem)[],
  filter: LootFilterCriteria
): (InventoryItem | ProposedInventoryItem)[] {
  return filterItemsByCategory(items, filter).sort((a, b) => {
    // Sort by: rarity (high first), then value (high first), then name
    const rarityOrder = { Artifact: 6, Legendary: 5, "Very Rare": 4, Rare: 3, Uncommon: 2, Common: 1 };
    const rarityA = (rarityOrder as Record<string, number>)[estimateItemRarity(a) || "Common"] ?? 0;
    const rarityB = (rarityOrder as Record<string, number>)[estimateItemRarity(b) || "Common"] ?? 0;

    if (rarityA !== rarityB) return rarityB - rarityA;

    const valueA = a.value ?? 0;
    const valueB = b.value ?? 0;
    if (valueA !== valueB) return valueB - valueA;

    return a.name.localeCompare(b.name);
  });
}

function parseCostToGp(cost: string): number {
  const cleaned = cost.replace(/,/g, "").toLowerCase();
  const match = cleaned.match(/([0-9]+(?:\.[0-9]+)?)\s*(cp|sp|ep|gp|pp)/);
  if (!match) return 0;

  const amount = Number(match[1]);
  const coin = match[2];
  if (!Number.isFinite(amount)) return 0;
  if (coin === "cp") return amount * 0.01;
  if (coin === "sp") return amount * 0.1;
  if (coin === "ep") return amount * 0.5;
  if (coin === "gp") return amount;
  return amount * 10;
}

function toOfficialProposedItem(input: {
  id: string;
  name: string;
  category: ItemCategory;
  value: number;
  notes?: string;
  tags?: string[];
}): ProposedInventoryItem {
  return {
    id: input.id,
    name: input.name,
    quantity: 1,
    category: input.category,
    value: Math.max(0, Math.floor(input.value)),
    notes: input.notes,
    tags: input.tags,
    confidence: "high",
    needsReview: false,
    sourceTag: "official",
    officialMatch: true,
  };
}

function buildOfficialItemPool(): ProposedInventoryItem[] {
  const weapons = WEAPON_PRICES.map((item, index) =>
    toOfficialProposedItem({
      id: `official_weapon_${index}`,
      name: item.item,
      category: "weapon",
      value: parseCostToGp(item.cost),
      notes: item.properties ? `Properties: ${item.properties}` : undefined,
      tags: ["Official", "Weapon"],
    })
  );

  const armors = ARMOR_PRICES.map((item, index) =>
    toOfficialProposedItem({
      id: `official_armor_${index}`,
      name: item.item,
      category: item.item.toLowerCase() === "shield" ? "accessory" : "armor",
      value: parseCostToGp(item.cost),
      notes: `AC: ${item.ac}`,
      tags: ["Official", "Armor"],
    })
  );

  const gear = ADVENTURING_GEAR.map((item, index) =>
    toOfficialProposedItem({
      id: `official_gear_${index}`,
      name: item.item,
      category: "gear",
      value: parseCostToGp(item.cost),
      notes: item.notes || undefined,
      tags: ["Official", "Gear"],
    })
  );

  const potions = POTION_PRICES.map((item, index) =>
    toOfficialProposedItem({
      id: `official_potion_${index}`,
      name: item.item,
      category: "consumable",
      value: parseCostToGp(item.cost),
      notes: item.heal !== "—" ? `Effect: ${item.heal}` : undefined,
      tags: ["Official", "Potion", item.rarity],
    })
  );

  return [...weapons, ...armors, ...gear, ...potions];
}

export function searchOfficialItems(criteria: LootFilterCriteria): ProposedInventoryItem[] {
  const pool = buildOfficialItemPool();
  return searchItemsByFilter(pool, criteria).map((item) => ({ ...item, sourceTag: "official" })) as ProposedInventoryItem[];
}

export function searchCustomItems(
  items: InventoryItem[],
  criteria: LootFilterCriteria,
): InventoryItem[] {
  return searchItemsByFilter(items, criteria) as InventoryItem[];
}

export function filterByPlane<T extends { tags?: string[] }>(items: T[], planes: string[]): T[] {
  if (!planes.length) return items;
  const target = planes.map((plane) => plane.toLowerCase().trim());
  return items.filter((item) => {
    const tags = (item.tags ?? []).map((tag) => tag.toLowerCase());
    return target.some((plane) => tags.some((tag) => tag.includes(plane)));
  });
}

export function getAllPlanes(customPlanes: string[] = []): string[] {
  const merged = [...STANDARD_PLANES, ...customPlanes.map((plane) => plane.trim()).filter(Boolean)];
  return Array.from(new Set(merged));
}

/**
 * Get suggested subtypes for an item category (for UI filtering/suggestion).
 */
export function getSubtypesForCategory(category: ItemCategory): string[] {
  switch (category) {
    case "weapon":
      return WEAPON_SUBTYPES;
    case "armor":
      return ARMOR_SUBTYPES;
    case "accessory":
      return ACCESSORY_SUBTYPES;
    default:
      return [];
  }
}

/**
 * Common planes for filtering (standard D&D + placeholder for custom).
 */
export const STANDARD_PLANES = [
  "Material",
  "Shadowfell",
  "Feywild",
  "Abyss",
  "Nine Hells",
  "Celestia",
  "Elysium",
  "Concordant Opposition",
  "Ethereal",
  "Astral",
  "Custom",
];

/**
 * Common loot tags for UI filtering suggestions.
 */
export const COMMON_LOOT_TAGS = [
  "Magical",
  "Masterwork",
  "Cursed",
  "Requires Attunement",
  "Silvered",
  "Adamantine",
  "Mithral",
  "Returning",
  "Sentient",
  "Artifact",
  "Rare",
  "Legendary",
  "One-of-a-kind",
  "Findable",
  "Consumable",
];
