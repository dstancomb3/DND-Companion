import {
  ADVENTURING_GEAR,
  ARMOR_PRICES,
  GEMSTONE_VALUES,
  POTION_PRICES,
  WEAPON_PRICES,
} from "./dnd5eReference";

export interface ItemPriceEstimate {
  baseGp: number;
  minGp: number;
  maxGp: number;
  suggestedGp: number;
  enchantmentLevel: number;
  source: "weapon" | "armor" | "gear" | "potion" | "gem";
  matchedName: string;
}

type SourceType = ItemPriceEstimate["source"];

interface PriceEntry {
  key: string;
  gp: number;
  source: SourceType;
  name: string;
}

const ALL_ENTRIES: PriceEntry[] = [];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\barmor\b/g, " ")
    .replace(/\+\d+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCostToGp(cost: string): number | null {
  const cleaned = cost.replace(/,/g, "").toLowerCase();
  const match = cleaned.match(/([0-9]+(?:\.[0-9]+)?)\s*(cp|sp|ep|gp|pp)/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const coin = match[2];
  if (coin === "cp") return amount * 0.01;
  if (coin === "sp") return amount * 0.1;
  if (coin === "ep") return amount * 0.5;
  if (coin === "gp") return amount;
  return amount * 10;
}

function addEntry(name: string, gp: number, source: SourceType): void {
  const key = normalize(name);
  if (!key || !Number.isFinite(gp) || gp <= 0) return;
  ALL_ENTRIES.push({ key, gp, source, name });
}

for (const item of WEAPON_PRICES) {
  const gp = parseCostToGp(item.cost);
  if (gp != null) addEntry(item.item, gp, "weapon");
}

for (const item of ARMOR_PRICES) {
  const gp = parseCostToGp(item.cost);
  if (gp == null) continue;
  addEntry(item.item, gp, "armor");
  addEntry(`${item.item} armor`, gp, "armor");
}

for (const item of ADVENTURING_GEAR) {
  const gp = parseCostToGp(item.cost);
  if (gp != null) addEntry(item.item, gp, "gear");
}

for (const item of POTION_PRICES) {
  const gp = parseCostToGp(item.cost);
  if (gp != null) addEntry(item.item, gp, "potion");
}

for (const row of GEMSTONE_VALUES) {
  const gp = parseCostToGp(row.value);
  if (gp == null) continue;
  const gems = row.examples
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  for (const gem of gems) addEntry(gem, gp, "gem");
}

ALL_ENTRIES.sort((a, b) => b.key.length - a.key.length);

function inferQualityTier(name: string, notes?: string): number {
  const combined = `${name} ${notes ?? ""}`.toLowerCase();
  if (/(damaged|battered|poor|rusty|crude|worn)/.test(combined)) return 0;
  if (/(masterwork|flawless|pristine|exquisite|superb)/.test(combined)) return 3;
  if (/(fine|well-made|reinforced|sturdy|high quality)/.test(combined)) return 2;
  return 1;
}

function inferRarityMultiplier(tags?: string[]): number {
  if (!tags || tags.length === 0) return 1;
  const joined = tags.join(" ").toLowerCase();
  if (joined.includes("artifact")) return 5;
  if (joined.includes("legendary")) return 3.5;
  if (joined.includes("very rare")) return 2.4;
  if (joined.includes("rare")) return 1.75;
  if (joined.includes("uncommon")) return 1.25;
  return 1;
}

function inferEnchantmentLevel(name: string, notes?: string): number {
  const combined = `${name} ${notes ?? ""}`;
  const plusMatch = combined.match(/\+(\d+)/);
  if (plusMatch) return Math.min(9, Math.max(0, parseInt(plusMatch[1], 10) || 0));

  const levelMatch = combined.match(/(?:enchant(?:ment)?|enchanted)\s*(?:level|lvl)?\s*(\d+)/i);
  if (levelMatch) return Math.min(9, Math.max(0, parseInt(levelMatch[1], 10) || 0));

  return /\benchanted\b/i.test(combined) ? 1 : 0;
}

function qualityMultiplierRange(tier: number): [number, number] {
  if (tier <= 0) return [0.8, 1.0];
  if (tier >= 3) return [1.5, 2.1];
  if (tier === 2) return [1.2, 1.8];
  return [1.0, 2.0];
}

function enchantmentMultiplier(level: number): number {
  return 1 + 0.12 * level + 0.03 * level * level;
}

function findBaseEntry(name: string): PriceEntry | null {
  const key = normalize(name);
  if (!key) return null;

  for (const entry of ALL_ENTRIES) {
    if (key === entry.key) return entry;
  }

  for (const entry of ALL_ENTRIES) {
    const pattern = new RegExp(`(^|\\s)${entry.key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(\\s|$)`);
    if (pattern.test(key)) return entry;
  }

  return null;
}

export function estimateItemPriceFromResources(input: {
  name: string;
  notes?: string;
  tags?: string[];
}): ItemPriceEstimate | null {
  const match = findBaseEntry(input.name);
  if (!match) return null;

  const enchantmentLevel = inferEnchantmentLevel(input.name, input.notes);
  const qualityTier = inferQualityTier(input.name, input.notes);
  const rarityMultiplier = inferRarityMultiplier(input.tags);
  const [qualityMin, qualityMax] = qualityMultiplierRange(qualityTier);
  const enchantMultiplier = enchantmentMultiplier(enchantmentLevel);

  const minGp = Math.max(1, Math.round(match.gp * qualityMin * rarityMultiplier * enchantMultiplier));
  const maxGp = Math.max(minGp, Math.round(match.gp * qualityMax * rarityMultiplier * enchantMultiplier));
  const suggestedGp = Math.round((minGp + maxGp) / 2);

  return {
    baseGp: match.gp,
    minGp,
    maxGp,
    suggestedGp,
    enchantmentLevel,
    source: match.source,
    matchedName: match.name,
  };
}
