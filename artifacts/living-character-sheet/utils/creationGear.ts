import { ALL_BACKGROUNDS, ALL_CLASSES } from "@/data/dnd5e";
import { ADVENTURING_GEAR, ARMOR_PRICES, POTION_PRICES, WEAPON_PRICES } from "@/data/dnd5eReference";
import type { InventoryItem } from "@/types";
import { buildInventoryStackKey } from "@/utils/equipment/inventoryStacks";

export type GearSelectionMode = "strict" | "preset" | "free";
export type CreationGearLoadPreset = "light" | "moderate" | "heavy" | "encumbered";
export const CREATION_GEAR_RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"] as const;
export type CreationGearRarity = (typeof CREATION_GEAR_RARITIES)[number];
export type CreationGearFilterCategory = "all" | InventoryItem["category"] | "component" | "junk";
export const CREATION_GEAR_FILTER_CATEGORIES: CreationGearFilterCategory[] = [
  "all",
  "weapon",
  "armor",
  "gear",
  "consumable",
  "magic",
  "treasure",
  "accessory",
  "component",
  "junk",
  "other",
];

export interface StartingWealthRule {
  className: string;
  supported: boolean;
  formula: string;
  diceCount: number;
  diceSides: number;
  multiplierGp: number;
}

export interface ClassGearOption {
  id: string;
  label: string;
  notes?: string;
  items: Array<{ name: string; quantity?: number }>;
}

export interface CreationGearCatalogEntry {
  name: string;
  category: InventoryItem["category"];
  costGp: number;
  rarity: CreationGearRarity;
  weightLbs?: number;
  source: "weapon" | "armor" | "gear" | "manual";
}

interface CreationRandomLootPoolEntry {
  name: string;
  category: InventoryItem["category"];
  rarity: CreationGearRarity;
  costGp: number;
  weightLbs: number;
  minQty: number;
  maxQty: number;
}

interface CreationGearCatalogFilter {
  maxRarity?: CreationGearRarity;
}

type CreationGearFilterTarget = {
  name: string;
  category: InventoryItem["category"];
  costGp: number;
};

const CREATION_GEAR_RARITY_INDEX: Record<CreationGearRarity, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  "Very Rare": 3,
  Legendary: 4,
  Artifact: 5,
};

const CREATION_GEAR_LOAD_PRESET_LIMITS: Record<CreationGearLoadPreset, number> = {
  light: 25,
  moderate: 60,
  heavy: 120,
  encumbered: Number.POSITIVE_INFINITY,
};

const CREATION_GEAR_RANDOM_TARGETS: Record<
  CreationGearLoadPreset,
  { minWeight: number; maxWeight: number; minItems: number; maxItems: number }
> = {
  light: { minWeight: 4, maxWeight: 18, minItems: 1, maxItems: 3 },
  moderate: { minWeight: 16, maxWeight: 48, minItems: 3, maxItems: 7 },
  heavy: { minWeight: 42, maxWeight: 92, minItems: 6, maxItems: 12 },
  encumbered: { minWeight: 90, maxWeight: 180, minItems: 10, maxItems: 18 },
};

const CREATION_BONUS_LOOT_POOL: CreationRandomLootPoolEntry[] = [
  { name: "Ball Bearings (bag of 1000)", category: "gear", rarity: "Common", costGp: 1, weightLbs: 2, minQty: 1, maxQty: 2 },
  { name: "Caltrops (bag of 20)", category: "gear", rarity: "Common", costGp: 1, weightLbs: 2, minQty: 1, maxQty: 2 },
  { name: "Flask of Oil", category: "consumable", rarity: "Common", costGp: 0.1, weightLbs: 1, minQty: 1, maxQty: 6 },
  { name: "Acid Vial", category: "consumable", rarity: "Common", costGp: 25, weightLbs: 1, minQty: 1, maxQty: 4 },
  { name: "Alchemist's Fire", category: "consumable", rarity: "Common", costGp: 50, weightLbs: 1, minQty: 1, maxQty: 3 },
  { name: "Signal Whistle", category: "gear", rarity: "Common", costGp: 0.5, weightLbs: 0.1, minQty: 1, maxQty: 2 },
  { name: "Smokepowder Satchel", category: "consumable", rarity: "Uncommon", costGp: 90, weightLbs: 1, minQty: 1, maxQty: 2 },
  { name: "Quartz Gem", category: "treasure", rarity: "Uncommon", costGp: 75, weightLbs: 0.1, minQty: 1, maxQty: 8 },
  { name: "Moonstone", category: "treasure", rarity: "Uncommon", costGp: 120, weightLbs: 0.1, minQty: 1, maxQty: 5 },
  { name: "Silversheen Flask", category: "consumable", rarity: "Uncommon", costGp: 180, weightLbs: 1, minQty: 1, maxQty: 2 },
  { name: "Runed Arrow Bundle", category: "weapon", rarity: "Uncommon", costGp: 150, weightLbs: 1, minQty: 1, maxQty: 3 },
  { name: "Blessed Incense Kit", category: "gear", rarity: "Uncommon", costGp: 200, weightLbs: 1, minQty: 1, maxQty: 2 },
  { name: "Spell Component Pouch (Refined)", category: "gear", rarity: "Rare", costGp: 700, weightLbs: 2, minQty: 1, maxQty: 2 },
  { name: "Aether Crystal", category: "treasure", rarity: "Rare", costGp: 950, weightLbs: 0.2, minQty: 1, maxQty: 3 },
  { name: "Adamantine Buckler", category: "armor", rarity: "Rare", costGp: 1800, weightLbs: 6, minQty: 1, maxQty: 1 },
  { name: "Flame Tongue Oil", category: "consumable", rarity: "Rare", costGp: 2200, weightLbs: 1, minQty: 1, maxQty: 1 },
  { name: "Shadowweave Cloak", category: "gear", rarity: "Rare", costGp: 3000, weightLbs: 2, minQty: 1, maxQty: 1 },
  { name: "Wyrmscale Vest", category: "armor", rarity: "Very Rare", costGp: 9000, weightLbs: 10, minQty: 1, maxQty: 1 },
  { name: "Stormglass Greatsword", category: "weapon", rarity: "Very Rare", costGp: 12000, weightLbs: 8, minQty: 1, maxQty: 1 },
  { name: "Elixir of Swift Resolve", category: "consumable", rarity: "Very Rare", costGp: 11000, weightLbs: 1, minQty: 1, maxQty: 1 },
  { name: "Phoenix Ember", category: "treasure", rarity: "Very Rare", costGp: 15000, weightLbs: 0.2, minQty: 1, maxQty: 1 },
  { name: "Crownsteel Breastplate", category: "armor", rarity: "Legendary", costGp: 65000, weightLbs: 18, minQty: 1, maxQty: 1 },
  { name: "Astral Compass", category: "gear", rarity: "Legendary", costGp: 52000, weightLbs: 2, minQty: 1, maxQty: 1 },
  { name: "Prismatic Core", category: "treasure", rarity: "Legendary", costGp: 70000, weightLbs: 0.3, minQty: 1, maxQty: 1 },
  { name: "Blade of Seven Echoes", category: "weapon", rarity: "Artifact", costGp: 260000, weightLbs: 7, minQty: 1, maxQty: 1 },
  { name: "Aegis of the First Forge", category: "armor", rarity: "Artifact", costGp: 275000, weightLbs: 22, minQty: 1, maxQty: 1 },
  { name: "Worldseed Prism", category: "treasure", rarity: "Artifact", costGp: 320000, weightLbs: 0.4, minQty: 1, maxQty: 1 },
  { name: "Archivist's Living Codex", category: "gear", rarity: "Artifact", costGp: 290000, weightLbs: 4, minQty: 1, maxQty: 1 },
];

export interface CreationAutoGrantedItemsResult {
  items: InventoryItem[];
}

export interface CreationGearLoadoutResult {
  items: InventoryItem[];
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number };
  spentGp: number;
  budgetGp: number;
  mode: GearSelectionMode;
}

const CLASS_STARTING_WEALTH_RULES: Record<string, StartingWealthRule> = {
  artificer: { className: "Artificer", supported: true, formula: "5d4 x 10 gp", diceCount: 5, diceSides: 4, multiplierGp: 10 },
  barbarian: { className: "Barbarian", supported: true, formula: "2d4 x 10 gp", diceCount: 2, diceSides: 4, multiplierGp: 10 },
  bard: { className: "Bard", supported: true, formula: "5d4 x 10 gp", diceCount: 5, diceSides: 4, multiplierGp: 10 },
  "blood hunter": { className: "Blood Hunter", supported: true, formula: "4d4 x 10 gp", diceCount: 4, diceSides: 4, multiplierGp: 10 },
  cleric: { className: "Cleric", supported: true, formula: "5d4 x 10 gp", diceCount: 5, diceSides: 4, multiplierGp: 10 },
  druid: { className: "Druid", supported: true, formula: "2d4 x 10 gp", diceCount: 2, diceSides: 4, multiplierGp: 10 },
  fighter: { className: "Fighter", supported: true, formula: "5d4 x 10 gp", diceCount: 5, diceSides: 4, multiplierGp: 10 },
  monk: { className: "Monk", supported: true, formula: "5d4 gp", diceCount: 5, diceSides: 4, multiplierGp: 1 },
  paladin: { className: "Paladin", supported: true, formula: "5d4 x 10 gp", diceCount: 5, diceSides: 4, multiplierGp: 10 },
  ranger: { className: "Ranger", supported: true, formula: "5d4 x 10 gp", diceCount: 5, diceSides: 4, multiplierGp: 10 },
  rogue: { className: "Rogue", supported: true, formula: "4d4 x 10 gp", diceCount: 4, diceSides: 4, multiplierGp: 10 },
  sorcerer: { className: "Sorcerer", supported: true, formula: "3d4 x 10 gp", diceCount: 3, diceSides: 4, multiplierGp: 10 },
  warlock: { className: "Warlock", supported: true, formula: "4d4 x 10 gp", diceCount: 4, diceSides: 4, multiplierGp: 10 },
  wizard: { className: "Wizard", supported: true, formula: "4d4 x 10 gp", diceCount: 4, diceSides: 4, multiplierGp: 10 },
};

const BASE_STRICT_OPTIONS: Record<string, ClassGearOption[]> = {
  martial: [
    {
      id: "martial-frontline",
      label: "Frontline Steel",
      items: [
        { name: "Longsword" },
        { name: "Shield" },
        { name: "Chain Mail" },
        { name: "Backpack" },
        { name: "Rations (1 day)", quantity: 5 },
      ],
    },
    {
      id: "martial-ranged",
      label: "Ranged Skirmisher",
      items: [
        { name: "Longbow" },
        { name: "Leather" },
        { name: "Dagger", quantity: 2 },
        { name: "Backpack" },
        { name: "Rope (hempen, 50 ft)" },
      ],
    },
  ],
  caster: [
    {
      id: "caster-focus",
      label: "Arcane Focus Kit",
      items: [
        { name: "Quarterstaff" },
        { name: "Leather" },
        { name: "Backpack" },
        { name: "Tinderbox" },
        { name: "Rations (1 day)", quantity: 5 },
      ],
    },
    {
      id: "caster-defensive",
      label: "Defensive Caster Kit",
      items: [
        { name: "Dagger" },
        { name: "Light Crossbow" },
        { name: "Leather" },
        { name: "Backpack" },
        { name: "Waterskin" },
      ],
    },
  ],
  agile: [
    {
      id: "agile-stealth",
      label: "Stealth Operative",
      items: [
        { name: "Shortsword" },
        { name: "Dagger", quantity: 2 },
        { name: "Leather" },
        { name: "Thieves' Tools" },
        { name: "Backpack" },
      ],
    },
    {
      id: "agile-duelist",
      label: "Fast Duelist",
      items: [
        { name: "Rapier" },
        { name: "Shortbow" },
        { name: "Leather" },
        { name: "Backpack" },
        { name: "Rations (1 day)", quantity: 3 },
      ],
    },
  ],
};

const CLASS_STRICT_OPTIONS: Record<string, ClassGearOption[]> = {
  artificer: [
    {
      id: "artificer-engineer",
      label: "Engineer Initiate",
      items: [
        { name: "Light Crossbow" },
        { name: "Dagger" },
        { name: "Leather" },
        { name: "Artisan's Tools" },
        { name: "Backpack" },
      ],
    },
    {
      id: "artificer-field",
      label: "Field Technician",
      items: [
        { name: "Quarterstaff" },
        { name: "Shield" },
        { name: "Leather" },
        { name: "Tinker's Tools" },
        { name: "Backpack" },
      ],
    },
  ],
  barbarian: BASE_STRICT_OPTIONS.martial,
  bard: BASE_STRICT_OPTIONS.agile,
  "blood hunter": BASE_STRICT_OPTIONS.agile,
  cleric: [
    {
      id: "cleric-mace-shield",
      label: "Sanctified Defender",
      items: [
        { name: "Warhammer" },
        { name: "Shield" },
        { name: "Chain Mail" },
        { name: "Backpack" },
      ],
    },
    {
      id: "cleric-support",
      label: "Temple Support",
      items: [
        { name: "Mace" },
        { name: "Scale Mail" },
        { name: "Shield" },
        { name: "Healer's Kit" },
        { name: "Backpack" },
      ],
    },
  ],
  druid: BASE_STRICT_OPTIONS.caster,
  fighter: BASE_STRICT_OPTIONS.martial,
  monk: [
    {
      id: "monk-open-hand",
      label: "Open Hand Pilgrim",
      items: [
        { name: "Quarterstaff" },
        { name: "Dagger", quantity: 2 },
        { name: "Backpack" },
        { name: "Rations (1 day)", quantity: 5 },
      ],
    },
    {
      id: "monk-shadow",
      label: "Shadow Disciple",
      items: [
        { name: "Shortsword" },
        { name: "Dagger" },
        { name: "Backpack" },
        { name: "Rope (hempen, 50 ft)" },
      ],
    },
  ],
  paladin: BASE_STRICT_OPTIONS.martial,
  ranger: [
    {
      id: "ranger-hunter",
      label: "Hunter's Trail",
      items: [
        { name: "Longbow" },
        { name: "Shortsword", quantity: 2 },
        { name: "Leather" },
        { name: "Backpack" },
        { name: "Rations (1 day)", quantity: 6 },
      ],
    },
    {
      id: "ranger-warden",
      label: "Warden Path",
      items: [
        { name: "Longsword" },
        { name: "Shield" },
        { name: "Scale Mail" },
        { name: "Backpack" },
        { name: "Rope (hempen, 50 ft)" },
      ],
    },
  ],
  rogue: BASE_STRICT_OPTIONS.agile,
  sorcerer: BASE_STRICT_OPTIONS.caster,
  warlock: BASE_STRICT_OPTIONS.caster,
  wizard: BASE_STRICT_OPTIONS.caster,
};

const CLASS_PRESET_OPTIONS: Record<string, ClassGearOption[]> = {
  default: [
    {
      id: "preset-balanced",
      label: "Balanced Adventurer",
      items: [
        { name: "Longsword" },
        { name: "Leather" },
        { name: "Backpack" },
        { name: "Waterskin" },
        { name: "Rations (1 day)", quantity: 5 },
      ],
    },
    {
      id: "preset-expedition",
      label: "Expedition Kit",
      items: [
        { name: "Shortbow" },
        { name: "Dagger", quantity: 2 },
        { name: "Backpack" },
        { name: "Torch", quantity: 10 },
        { name: "Rope (hempen, 50 ft)" },
      ],
    },
    {
      id: "preset-caster",
      label: "Spell-Ready Kit",
      items: [
        { name: "Quarterstaff" },
        { name: "Leather" },
        { name: "Backpack" },
        { name: "Tinderbox" },
        { name: "Rations (1 day)", quantity: 3 },
      ],
    },
  ],
};

const BACKGROUND_AUTO_ITEMS: Record<string, Array<{ name: string; quantity?: number }>> = {
  Acolyte: [{ name: "Holy Symbol" }, { name: "Prayer Book" }, { name: "Rations (1 day)", quantity: 2 }],
  Anthropologist: [{ name: "Notebook" }, { name: "Ink and Quill" }, { name: "Rations (1 day)", quantity: 2 }],
  Archaeologist: [{ name: "Cartographer's Tools" }, { name: "Rope (hempen, 50 ft)" }, { name: "Torch", quantity: 2 }],
  Athlete: [{ name: "Traveler's Clothes" }, { name: "Rations (1 day)", quantity: 2 }],
  Charlatan: [{ name: "Disguise Kit" }, { name: "Forgery Kit" }],
  "City Watch": [{ name: "Signal Whistle" }, { name: "Lantern (hooded)" }],
  "Clan Crafter": [{ name: "Artisan's Tools" }, { name: "Traveler's Clothes" }],
  "Cloistered Scholar": [{ name: "Notebook" }, { name: "Ink and Quill" }],
  Courtier: [{ name: "Fine Clothes" }, { name: "Sealing Kit" }],
  Criminal: [{ name: "Thieves' Tools" }, { name: "Dark Hooded Cloak" }],
  Entertainer: [{ name: "Disguise Kit" }, { name: "Musical Instrument" }],
  "Faction Agent": [{ name: "Cipher Book" }, { name: "Signet Ring" }],
  "Far Traveler": [{ name: "Traveler's Clothes" }, { name: "Waterskin" }],
  Fisher: [{ name: "Fishing Tackle" }, { name: "Rope (hempen, 50 ft)" }],
  "Folk Hero": [{ name: "Artisan's Tools" }, { name: "Vehicle (Land)" }, { name: "Shovel" }],
  Gladiator: [{ name: "Performance Costume" }, { name: "Dagger" }],
  "Guild Artisan": [{ name: "Artisan's Tools" }, { name: "Letter of Introduction" }],
  "Haunted One": [{ name: "Monster Trophy" }, { name: "Torch", quantity: 3 }],
  Hermit: [{ name: "Herbalism Kit" }, { name: "Scroll Case" }],
  Inheritor: [{ name: "Inheritance Token" }, { name: "Traveler's Clothes" }],
  Knight: [{ name: "Gaming Set" }, { name: "Fine Clothes" }],
  "Knight of the Order": [{ name: "Holy Symbol" }, { name: "Fine Clothes" }],
  Marine: [{ name: "Vehicle (Water)" }, { name: "Navigator's Tools" }, { name: "Rope (hempen, 50 ft)" }],
  "Mercenary Veteran": [{ name: "Gaming Set" }, { name: "Vehicle (Land)" }],
  Noble: [{ name: "Fine Clothes" }, { name: "Gaming Set" }],
  Outlander: [{ name: "Hunting Trap" }, { name: "Staff" }, { name: "Rations (1 day)", quantity: 3 }],
  Pirate: [{ name: "Navigator's Tools" }, { name: "Vehicle (Water)" }, { name: "Rope (hempen, 50 ft)" }],
  Sage: [{ name: "Notebook" }, { name: "Ink and Quill" }],
  Sailor: [{ name: "Navigator's Tools" }, { name: "Vehicle (Water)" }],
  Soldier: [{ name: "Gaming Set" }, { name: "Vehicle (Land)" }, { name: "Insignia" }],
  Spy: [{ name: "Thieves' Tools" }, { name: "Dark Hooded Cloak" }],
  "Urban Bounty Hunter": [{ name: "Thieves' Tools" }, { name: "Manacles" }],
  Urchin: [{ name: "Disguise Kit" }, { name: "Thieves' Tools" }],
  "Uthgardt Tribe Member": [{ name: "Hunting Trap" }, { name: "Totem Trinket" }],
  "Waterdhavian Noble": [{ name: "Fine Clothes" }, { name: "Gaming Set" }],
};

const RACE_AUTO_ITEMS: Record<string, Array<{ name: string; quantity?: number }>> = {
  "Deep Gnome": [{ name: "Hooded Lantern" }],
  "Ghostwise Halfling": [{ name: "Traveler's Clothes" }],
  Duergar: [{ name: "Miner's Pick" }],
  Fairy: [{ name: "Fine Clothes" }],
  Owlin: [{ name: "Traveler's Clothes" }],
  Tortle: [{ name: "Traveler's Clothes" }],
  Triton: [{ name: "Waterskin" }],
  Warforged: [{ name: "Repair Kit" }],
};

const MANUAL_GEAR_DEFINITIONS: Record<string, Partial<InventoryItem> & { costGp?: number }> = {
  "Artisan's Tools": { category: "gear", notes: "Generic artisan tool set.", costGp: 8 },
  "Ball Bearings (bag of 1000)": { category: "gear", notes: "Scatterable bearings to hinder movement.", costGp: 1 },
  "Caltrops (bag of 20)": { category: "gear", notes: "Scatterable spikes to slow pursuers.", costGp: 1 },
  "Acid Vial": { category: "consumable", notes: "Thrown corrosive vial.", costGp: 25 },
  "Alchemist's Fire": { category: "consumable", notes: "Sticky burning flask.", costGp: 50 },
  "Cartographer's Tools": { category: "gear", notes: "Maps, ink, quills, parchment, compasses, calipers.", costGp: 15 },
  "Cipher Book": { category: "gear", notes: "Codes and operational ciphers.", costGp: 10 },
  "Dark Hooded Cloak": { category: "gear", notes: "Concealing travel cloak.", costGp: 1 },
  "Fine Clothes": { category: "gear", notes: "Formal attire for courtly or social settings.", costGp: 15 },
  "Fishing Tackle": { category: "gear", notes: "Hooks, line, floats, and weights for fishing.", costGp: 1 },
  "Forgery Kit": { category: "gear", notes: "Forgery implements and writing tools.", costGp: 15 },
  "Gaming Set": { category: "gear", notes: "Generic gaming set.", costGp: 1 },
  "Hooded Lantern": { category: "gear", notes: "Alternate naming variant of lantern.", costGp: 5 },
  "Holy Symbol": { category: "gear", notes: "Sacred symbol representing a deity.", costGp: 5 },
  "Hunting Trap": { category: "gear", notes: "Steel trap for small game.", costGp: 5 },
  "Ink and Quill": { category: "gear", notes: "Writing supplies for journals and correspondence.", costGp: 1 },
  InheritanceToken: { category: "gear", notes: "Family heirloom or inherited keepsake.", costGp: 1 },
  "Inheritance Token": { category: "gear", notes: "Family heirloom or inherited keepsake.", costGp: 1 },
  Insignia: { category: "gear", notes: "Rank insignia or military emblem.", costGp: 1 },
  "Letter of Introduction": { category: "gear", notes: "Written recommendation from guild or patron.", costGp: 0.5 },
  Manacles: { category: "gear", notes: "Iron restraints.", costGp: 2 },
  "Miner's Pick": { category: "gear", notes: "Mining and excavation tool.", costGp: 2 },
  "Monster Trophy": { category: "gear", notes: "Token from a defeated creature.", costGp: 1 },
  "Musical Instrument": { category: "gear", notes: "Generic instrument placeholder.", costGp: 12 },
  "Navigator's Tools": { category: "gear", notes: "Navigation instruments, charts, sextant, and compass.", costGp: 25 },
  Notebook: { category: "gear", notes: "Blank journal book.", costGp: 1 },
  "Performance Costume": { category: "gear", notes: "Show attire for performances.", costGp: 5 },
  "Prayer Book": { category: "gear", notes: "Religious text and prayers.", costGp: 1 },
  "Repair Kit": { category: "gear", notes: "Tools for patching armor and construct plating.", costGp: 5 },
  "Scroll Case": { category: "gear", notes: "Case for storing parchments.", costGp: 1 },
  "Sealing Kit": { category: "gear", notes: "Wax, seals, and stamps for official letters.", costGp: 2 },
  "Signal Whistle": { category: "gear", notes: "Used for alarms and formation signals.", costGp: 0.5 },
  "Signet Ring": { category: "gear", notes: "Ring used to authenticate seals.", costGp: 5 },
  Shovel: { category: "gear", notes: "Digging tool.", costGp: 2 },
  Staff: { category: "weapon", notes: "Simple staff weapon.", subtype: "Quarterstaff", costGp: 0.2 },
  "Thieves' Tools": { category: "gear", notes: "Pick locks and disarm traps. Proficiency required.", costGp: 25 },
  "Tinker's Tools": { category: "gear", notes: "Tools for repairs and mechanical crafting.", costGp: 15 },
  "Totem Trinket": { category: "gear", notes: "Small tribal totem.", costGp: 0.5 },
  "Traveler's Clothes": { category: "gear", notes: "Durable everyday travel outfit.", costGp: 2 },
  "Vehicle (Land)": { category: "gear", notes: "Represents proficiency and access to land vehicles.", costGp: 15 },
  "Vehicle (Water)": { category: "gear", notes: "Represents proficiency and access to water vehicles.", costGp: 50 },
  "Smokepowder Satchel": { category: "consumable", notes: "Single-use powder charge for loud distraction.", costGp: 90 },
  "Quartz Gem": { category: "treasure", notes: "Polished quartz trade gem.", costGp: 75 },
  Moonstone: { category: "treasure", notes: "Luminous gem often used as a spell focus augment.", costGp: 120 },
  "Silversheen Flask": { category: "consumable", notes: "Coats one weapon with silver sheen for a short duration.", costGp: 180 },
  "Runed Arrow Bundle": { category: "weapon", notes: "Bundle of rune-etched arrows.", costGp: 150 },
  "Blessed Incense Kit": { category: "gear", notes: "Consecrated incense used in rituals and warding.", costGp: 200 },
  "Spell Component Pouch (Refined)": { category: "gear", notes: "Masterwork component pouch for advanced casting.", costGp: 700 },
  "Aether Crystal": { category: "treasure", notes: "Arcane crystal that stores ambient magical charge.", costGp: 950 },
  "Adamantine Buckler": { category: "armor", subtype: "Shield", notes: "Compact shield forged from adamantine.", costGp: 1800 },
  "Flame Tongue Oil": { category: "consumable", notes: "Temporary oil enchantment that ignites weapon strikes.", costGp: 2200 },
  "Shadowweave Cloak": { category: "gear", notes: "Fine cloak that dampens visibility in dim light.", costGp: 3000 },
  "Wyrmscale Vest": { category: "armor", subtype: "Half Plate", notes: "Scaled vest cut from young wyrm hide.", costGp: 9000 },
  "Stormglass Greatsword": { category: "weapon", subtype: "Greatsword", notes: "Greatsword threaded with stormglass filaments.", costGp: 12000 },
  "Elixir of Swift Resolve": { category: "consumable", notes: "Rare elixir granting brief reflexive clarity.", costGp: 11000 },
  "Phoenix Ember": { category: "treasure", notes: "A captured ember said to never fully cool.", costGp: 15000 },
  "Crownsteel Breastplate": { category: "armor", subtype: "Breastplate", notes: "Royal breastplate reinforced with crownsteel.", costGp: 65000 },
  "Astral Compass": { category: "gear", notes: "Legendary navigator's compass attuned to planar drift.", costGp: 52000 },
  "Prismatic Core": { category: "treasure", notes: "Dense jewel refracting seven stable spectra.", costGp: 70000 },
  "Blade of Seven Echoes": { category: "weapon", subtype: "Longsword", notes: "Artifact blade that sings across time-delayed strikes.", costGp: 260000 },
  "Aegis of the First Forge": { category: "armor", subtype: "Shield", notes: "Artifact shield bearing the first smithmark.", costGp: 275000 },
  "Worldseed Prism": { category: "treasure", notes: "Artifact prism linked to primordial growth rites.", costGp: 320000 },
  "Archivist's Living Codex": { category: "gear", notes: "Artifact tome that rewrites itself as events unfold.", costGp: 290000 },
};

const ARMOR_NAME_TO_SUBTYPE: Record<string, string> = {
  Padded: "Padded Armor",
  Leather: "Leather Armor",
  Hide: "Hide Armor",
  Splint: "Splint Armor",
  Plate: "Full Plate",
  Shield: "Shield",
};

const DAMAGE_TYPE_BY_CODE: Record<string, string> = {
  B: "bludgeoning",
  P: "piercing",
  S: "slashing",
};

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function parseCostToGp(cost: string | undefined): number | undefined {
  if (!cost) return undefined;
  const match = cost.trim().match(/^([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*(cp|sp|ep|gp|pp)\+?$/i);
  if (!match) return undefined;
  const amount = Number.parseFloat(match[1].replace(/,/g, ""));
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount)) return undefined;
  if (unit === "cp") return amount / 100;
  if (unit === "sp") return amount / 10;
  if (unit === "ep") return amount / 2;
  if (unit === "pp") return amount * 10;
  return amount;
}

function parseWeightToLbs(weight: string | undefined): number | undefined {
  if (!weight) return undefined;
  const match = weight.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*lbs?$/i);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function parseWeaponProperties(properties: string): string[] {
  return properties
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.replace(/\bTwo-handed\b/i, "Two-Handed"));
}

function parseWeightFromNotes(notes: string | undefined): number | undefined {
  if (!notes) return undefined;
  const match = notes.match(/([0-9]+(?:\.[0-9]+)?)\s*lbs?/i);
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inferRarityFromCost(costGp: number): CreationGearRarity {
  if (costGp <= 100) return "Common";
  if (costGp <= 500) return "Uncommon";
  if (costGp <= 5000) return "Rare";
  if (costGp <= 50000) return "Very Rare";
  if (costGp <= 250000) return "Legendary";
  return "Artifact";
}

function isComponentLikeEntry(entry: CreationGearFilterTarget): boolean {
  if (entry.category === "magic") return true;
  return /(component|pouch|kit|incense|focus|totem|codex|crystal|prism)/i.test(entry.name);
}

function isJunkLikeEntry(entry: CreationGearFilterTarget): boolean {
  if (entry.costGp > 0) return false;
  return /(token|trophy|insignia|trinket|letter|clothes|book|notebook|badge|keepsake)/i.test(entry.name);
}

function matchesCreationGearFilterCategory(
  entry: CreationGearFilterTarget,
  category: CreationGearFilterCategory,
): boolean {
  if (category === "all") return true;
  if (category === "component") return isComponentLikeEntry(entry);
  if (category === "junk") return isJunkLikeEntry(entry);
  return entry.category === category;
}

function isRarityAtMost(rarity: CreationGearRarity, maxRarity: CreationGearRarity): boolean {
  return CREATION_GEAR_RARITY_INDEX[rarity] <= CREATION_GEAR_RARITY_INDEX[maxRarity];
}

function getDefaultWeightByCategory(category: InventoryItem["category"]): number {
  if (category === "weapon") return 3;
  if (category === "armor") return 25;
  return 2;
}

export function getCreationGearLoadPresetWeightLimit(loadPreset: CreationGearLoadPreset): number {
  return CREATION_GEAR_LOAD_PRESET_LIMITS[loadPreset];
}

export function getCreationGearCatalogEntryWeightLbs(entry: CreationGearCatalogEntry): number {
  return entry.weightLbs ?? getDefaultWeightByCategory(entry.category);
}

function mergeInventoryDrafts(items: InventoryItem[]): InventoryItem[] {
  const merged = new Map<string, InventoryItem>();
  for (const item of items) {
    const stackKey = buildInventoryStackKey({ ...item, equipped: false });
    const existing = merged.get(stackKey);
    if (!existing) {
      merged.set(stackKey, item);
      continue;
    }
    merged.set(stackKey, {
      ...existing,
      quantity: existing.quantity + item.quantity,
    });
  }
  return [...merged.values()];
}

function getClassArchetype(className: string): "martial" | "caster" | "agile" {
  const key = normalizeKey(className);
  if (key === "rogue" || key === "bard" || key === "blood hunter") return "agile";
  if (key === "sorcerer" || key === "warlock" || key === "wizard" || key === "druid") return "caster";
  return "martial";
}

function getCatalogCost(name: string): number {
  const entry = buildCreationGearCatalog().find((item) => normalizeKey(item.name) === normalizeKey(name));
  return entry?.costGp ?? 0;
}

function randomBetween(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

function randomIntBetween(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(randomBetween(min, max + 1));
}

function getLoadPresetRandomTarget(loadPreset: CreationGearLoadPreset): {
  targetWeight: number;
  minItems: number;
  maxItems: number;
} {
  const profile = CREATION_GEAR_RANDOM_TARGETS[loadPreset];
  return {
    targetWeight: randomBetween(profile.minWeight, profile.maxWeight),
    minItems: profile.minItems,
    maxItems: profile.maxItems,
  };
}

function buildRandomLootChoices(input: {
  maxRarity: CreationGearRarity;
  loadPreset: CreationGearLoadPreset;
  category: CreationGearFilterCategory;
  startingWeightLbs?: number;
}): Array<{ name: string; quantity: number }> {
  const catalog = buildCreationGearCatalog();
  const catalogByName = new Map(catalog.map((entry) => [entry.name, entry]));
  const pool = CREATION_BONUS_LOOT_POOL.filter(
    (entry) => isRarityAtMost(entry.rarity, input.maxRarity) && matchesCreationGearFilterCategory(entry, input.category),
  );

  const fallbackPool = catalog
    .filter((entry) => isRarityAtMost(entry.rarity, input.maxRarity))
    .filter((entry) => matchesCreationGearFilterCategory(entry, input.category))
    .map((entry) => ({
      name: entry.name,
      category: entry.category,
      rarity: entry.rarity,
      costGp: entry.costGp,
      weightLbs: getCreationGearCatalogEntryWeightLbs(entry),
      minQty: 1,
      maxQty: 2,
    }));

  const sourcePool = pool.length > 0 ? pool : fallbackPool;
  if (sourcePool.length === 0) return [];

  const target = getLoadPresetRandomTarget(input.loadPreset);
  const startingWeight = Math.max(0, input.startingWeightLbs ?? 0);
  const targetWeight = Math.max(startingWeight, target.targetWeight);

  const selections = new Map<string, number>();
  let runningWeight = startingWeight;
  let generatedItems = 0;
  let safety = 0;

  while (
    safety < 200
    && generatedItems < target.maxItems
    && (generatedItems < target.minItems || runningWeight < targetWeight)
  ) {
    safety += 1;
    const pick = sourcePool[Math.floor(Math.random() * sourcePool.length)];
    if (!pick) break;
    const qty = randomIntBetween(pick.minQty, pick.maxQty);
    const itemWeight = pick.weightLbs * qty;
    const maxOverflowWeight = targetWeight + 12;
    if (runningWeight + itemWeight > maxOverflowWeight && generatedItems >= target.minItems) {
      continue;
    }
    selections.set(pick.name, (selections.get(pick.name) ?? 0) + qty);
    runningWeight += itemWeight;
    generatedItems += 1;
  }

  const result = [...selections.entries()].map(([name, quantity]) => ({ name, quantity }));
  if (result.length > 0) return result;

  const fallback = sourcePool[Math.floor(Math.random() * sourcePool.length)] ?? sourcePool[0];
  if (!fallback) return [];
  const fallbackEntry = catalogByName.get(fallback.name);
  const fallbackQty = randomIntBetween(fallback.minQty, fallback.maxQty);
  if (!fallbackEntry || fallbackQty <= 0) return [];
  return [{ name: fallback.name, quantity: fallbackQty }];
}

function sumSpecWeightLbs(specs: Array<{ name: string; quantity?: number }>): number {
  const catalog = buildCreationGearCatalog();
  const catalogByName = new Map(catalog.map((entry) => [entry.name, entry]));
  return specs.reduce((sum, spec) => {
    const qty = Math.max(1, Math.floor(spec.quantity ?? 1));
    const entry = catalogByName.get(spec.name);
    if (!entry) return sum;
    return sum + getCreationGearCatalogEntryWeightLbs(entry) * qty;
  }, 0);
}

function averageRollGp(rule: StartingWealthRule): number {
  const avgDie = (rule.diceSides + 1) / 2;
  return Math.floor(rule.diceCount * avgDie * rule.multiplierGp);
}

function specsToInventoryItems(specs: Array<{ name: string; quantity?: number }>): InventoryItem[] {
  return mergeInventoryDrafts(specs.map((item) => buildInventoryItemDraft({ name: item.name, quantity: item.quantity })));
}

export function getClassStartingWealthRule(className: string): StartingWealthRule | null {
  const normalized = normalizeKey(className);
  return CLASS_STARTING_WEALTH_RULES[normalized] ?? null;
}

export function getClassStrictPackageOptions(className: string): ClassGearOption[] {
  const normalized = normalizeKey(className);
  if (CLASS_STRICT_OPTIONS[normalized]) return CLASS_STRICT_OPTIONS[normalized];
  return BASE_STRICT_OPTIONS[getClassArchetype(className)];
}

export function getClassPresetOptions(className: string): ClassGearOption[] {
  const classStrict = getClassStrictPackageOptions(className);
  return [
    CLASS_PRESET_OPTIONS.default[0],
    CLASS_PRESET_OPTIONS.default[1],
    {
      ...CLASS_PRESET_OPTIONS.default[2],
      id: `preset-${normalizeKey(className)}-classic`,
      label: `${className || "Class"} Classic`,
      items: classStrict[0]?.items ?? CLASS_PRESET_OPTIONS.default[2].items,
    },
  ];
}

export function getClassFreeChoiceBudgetGp(className: string): number {
  const rule = getClassStartingWealthRule(className);
  if (!rule) return 0;
  return Math.max(0, averageRollGp(rule));
}

export function getPackageDetails(option: ClassGearOption): Array<{ name: string; quantity: number; costGp: number }> {
  return option.items.map((item) => ({
    name: item.name,
    quantity: item.quantity ?? 1,
    costGp: getCatalogCost(item.name) * (item.quantity ?? 1),
  }));
}

export function buildGoldAlternativeCurrency(gp: number): { cp: number; sp: number; ep: number; gp: number; pp: number } {
  const normalizedGp = Number.isFinite(gp) ? Math.max(0, gp) : 0;
  const wholeGp = Math.floor(normalizedGp);
  const remainingCp = Math.round((normalizedGp - wholeGp) * 100);
  const sp = Math.floor(remainingCp / 10);
  const cp = remainingCp % 10;
  return {
    cp,
    sp,
    ep: 0,
    gp: wholeGp,
    pp: 0,
  };
}

export function formatCreationGearCost(costGp: number): string {
  const normalizedCost = Number.isFinite(costGp) ? Math.max(0, costGp) : 0;
  if (normalizedCost === 0) return "free";
  if (normalizedCost >= 1) return `${normalizedCost} gp`;
  const cp = Math.round(normalizedCost * 100);
  if (cp % 10 === 0) return `${cp / 10} sp`;
  return `${cp} cp`;
}

export function buildInventoryItemDraft(input: { name: string; quantity?: number }): InventoryItem {
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const name = input.name.trim();
  const weapon = WEAPON_PRICES.find((entry) => normalizeKey(entry.item) === normalizeKey(name));
  if (weapon) {
    const [damageDice = "", damageCode = ""] = weapon.damage.split(" ");
    return {
      id: generateId(),
      name,
      quantity,
      equipped: false,
      category: "weapon",
      subtype: weapon.item,
      notes: weapon.properties,
      value: parseCostToGp(weapon.cost),
      attackAbility: "strength",
      isProficient: true,
      damageDice,
      damageModifier: 0,
      damageType: DAMAGE_TYPE_BY_CODE[damageCode] ?? undefined,
      tags: parseWeaponProperties(weapon.properties),
      sourceTag: "official",
    };
  }

  const armor = ARMOR_PRICES.find((entry) => normalizeKey(entry.item) === normalizeKey(name));
  if (armor) {
    const subtype = ARMOR_NAME_TO_SUBTYPE[armor.item] ?? armor.item;
    return {
      id: generateId(),
      name: subtype,
      quantity,
      equipped: false,
      category: "armor",
      subtype,
      notes: `AC ${armor.ac}${armor.stealth && armor.stealth !== "-" ? ` · Stealth ${armor.stealth}` : ""}`,
      value: parseCostToGp(armor.cost),
      weight: parseWeightToLbs(armor.weight),
      sourceTag: "official",
    };
  }

  const gear = ADVENTURING_GEAR.find((entry) => normalizeKey(entry.item) === normalizeKey(name));
  if (gear) {
    return {
      id: generateId(),
      name: gear.item,
      quantity,
      equipped: false,
      category: "gear",
      notes: gear.notes || undefined,
      value: parseCostToGp(gear.cost),
      sourceTag: "official",
    };
  }

  const manual = MANUAL_GEAR_DEFINITIONS[name] ?? MANUAL_GEAR_DEFINITIONS[name.replace(/\s+/g, " ").trim()];
  return {
    id: generateId(),
    name,
    quantity,
    equipped: false,
    category: manual?.category ?? "gear",
    subtype: manual?.subtype,
    notes: manual?.notes,
    value: manual?.costGp,
    sourceTag: "official",
  };
}

export function buildCreationGearCatalog(): CreationGearCatalogEntry[] {
  const weaponEntries: CreationGearCatalogEntry[] = WEAPON_PRICES.map((weapon) => ({
    name: weapon.item,
    category: "weapon",
    costGp: parseCostToGp(weapon.cost) ?? 0,
    rarity: inferRarityFromCost(parseCostToGp(weapon.cost) ?? 0),
    source: "weapon",
  }));

  const armorEntries: CreationGearCatalogEntry[] = ARMOR_PRICES.map((armor) => ({
    name: armor.item,
    category: "armor",
    costGp: parseCostToGp(armor.cost) ?? 0,
    rarity: inferRarityFromCost(parseCostToGp(armor.cost) ?? 0),
    weightLbs: parseWeightToLbs(armor.weight),
    source: "armor",
  }));

  const gearEntries: CreationGearCatalogEntry[] = ADVENTURING_GEAR.map((gear) => ({
    name: gear.item,
    category: "gear",
    costGp: parseCostToGp(gear.cost) ?? 0,
    rarity: inferRarityFromCost(parseCostToGp(gear.cost) ?? 0),
    weightLbs: parseWeightFromNotes(gear.notes),
    source: "gear",
  }));

  const potionEntries: CreationGearCatalogEntry[] = POTION_PRICES.map((potion) => ({
    name: potion.item,
    category: "gear",
    costGp: parseCostToGp(potion.cost) ?? 0,
    rarity: CREATION_GEAR_RARITIES.includes(potion.rarity as CreationGearRarity)
      ? (potion.rarity as CreationGearRarity)
      : inferRarityFromCost(parseCostToGp(potion.cost) ?? 0),
    source: "manual",
  }));

  const manualEntries: CreationGearCatalogEntry[] = Object.entries(MANUAL_GEAR_DEFINITIONS).map(([name, item]) => ({
    name,
    category: item.category ?? "gear",
    costGp: item.costGp ?? 0,
    rarity: inferRarityFromCost(item.costGp ?? 0),
    source: "manual",
  }));

  const all = [...weaponEntries, ...armorEntries, ...gearEntries, ...potionEntries, ...manualEntries];
  const deduped = new Map<string, CreationGearCatalogEntry>();
  for (const entry of all) {
    const key = normalizeKey(entry.name);
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }
  return [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterCreationGearCatalog(
  category: CreationGearFilterCategory,
  filter: CreationGearCatalogFilter = {},
): CreationGearCatalogEntry[] {
  const catalog = buildCreationGearCatalog();
  const byCategory = catalog.filter((item) => matchesCreationGearFilterCategory(item, category));
  const maxRarity = filter.maxRarity;
  if (!maxRarity) return byCategory;
  return byCategory.filter((item) => isRarityAtMost(item.rarity, maxRarity));
}

export function sortCreationGearCatalogBySelections(
  catalog: CreationGearCatalogEntry[],
  selections: Record<string, number>,
): CreationGearCatalogEntry[] {
  return [...catalog].sort((a, b) => {
    const aSelected = (selections[a.name] ?? 0) > 0;
    const bSelected = (selections[b.name] ?? 0) > 0;
    if (aSelected !== bSelected) {
      return aSelected ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export function buildRandomCreationGearSelection(input: {
  className: string;
  mode?: GearSelectionMode;
  category?: CreationGearFilterCategory;
  maxRarity?: CreationGearRarity;
  loadPreset?: CreationGearLoadPreset;
}): {
  mode: GearSelectionMode;
  strictPackageId: string;
  presetId: string;
  freeChoices: Array<{ name: string; quantity: number }>;
  bonusChoices: Array<{ name: string; quantity: number }>;
  category: CreationGearFilterCategory;
} {
  const strictOptions = getClassStrictPackageOptions(input.className);
  const presetOptions = getClassPresetOptions(input.className);
  const maxRarity = input.maxRarity ?? "Artifact";
  const loadPreset = input.loadPreset ?? "moderate";
  const allCatalog = filterCreationGearCatalog("all", { maxRarity }).filter((item) => item.costGp >= 0);

  const mode = input.mode ?? (["strict", "preset", "free"] as const)[Math.floor(Math.random() * 3)]!;
  const strictPackageId = strictOptions.length
    ? strictOptions[Math.floor(Math.random() * strictOptions.length)]!.id
    : "";
  const presetId = presetOptions.length
    ? presetOptions[Math.floor(Math.random() * presetOptions.length)]!.id
    : "";

  const freeCategory = input.category
    ?? CREATION_GEAR_FILTER_CATEGORIES[Math.floor(Math.random() * CREATION_GEAR_FILTER_CATEGORIES.length)]!;

  let basePackageWeightLbs = 0;
  if (mode === "strict") {
    const strict = strictOptions.find((option) => option.id === strictPackageId) ?? strictOptions[0];
    basePackageWeightLbs = strict ? sumSpecWeightLbs(strict.items) : 0;
  } else if (mode === "preset") {
    const preset = presetOptions.find((option) => option.id === presetId) ?? presetOptions[0];
    basePackageWeightLbs = preset ? sumSpecWeightLbs(preset.items) : 0;
  }

  const bonusChoices = buildRandomLootChoices({
    maxRarity,
    loadPreset,
    category: freeCategory,
    startingWeightLbs: basePackageWeightLbs,
  });

  const generatedFreeChoices = buildRandomLootChoices({
    maxRarity,
    loadPreset,
    category: freeCategory,
    startingWeightLbs: 0,
  });

  const freeChoices = mode === "free" ? generatedFreeChoices : bonusChoices;

  if (mode === "free" && freeChoices.length === 0 && allCatalog[0]) {
    freeChoices.push({ name: allCatalog[0].name, quantity: 1 });
  }

  return {
    mode,
    strictPackageId,
    presetId,
    freeChoices,
    bonusChoices,
    category: freeCategory,
  };
}

export function getBackgroundAutoGear(background: string): Array<{ name: string; quantity?: number }> {
  return BACKGROUND_AUTO_ITEMS[background.trim()] ?? [];
}

export function getRaceAutoGear(race: string): Array<{ name: string; quantity?: number }> {
  return RACE_AUTO_ITEMS[race.trim()] ?? [];
}

export function buildCreationAutoGrantedItems(input: { race: string; background: string }): CreationAutoGrantedItemsResult {
  const backgroundItems = getBackgroundAutoGear(input.background);
  const raceItems = getRaceAutoGear(input.race);
  return {
    items: specsToInventoryItems([...backgroundItems, ...raceItems]),
  };
}

export function buildCreationGearLoadout(input: {
  className: string;
  race: string;
  background: string;
  mode: GearSelectionMode;
  strictPackageId?: string;
  presetId?: string;
  freeChoices?: Array<{ name: string; quantity: number }>;
  bonusChoices?: Array<{ name: string; quantity: number }>;
}): CreationGearLoadoutResult {
  const autoGranted = buildCreationAutoGrantedItems({ race: input.race, background: input.background }).items;
  const bonusChoices = input.bonusChoices ?? [];
  const bonusItems = specsToInventoryItems(
    bonusChoices
      .filter((choice) => choice.quantity > 0)
      .map((choice) => ({ name: choice.name, quantity: Math.max(1, Math.floor(choice.quantity)) })),
  );

  if (input.mode === "strict") {
    const options = getClassStrictPackageOptions(input.className);
    const selected = options.find((option) => option.id === input.strictPackageId) ?? options[0];
    const strictItems = selected ? specsToInventoryItems(selected.items) : [];
    return {
      items: mergeInventoryDrafts([...autoGranted, ...strictItems, ...bonusItems]),
      currency: buildGoldAlternativeCurrency(0),
      spentGp: 0,
      budgetGp: 0,
      mode: "strict",
    };
  }

  if (input.mode === "preset") {
    const options = getClassPresetOptions(input.className);
    const selected = options.find((option) => option.id === input.presetId) ?? options[0];
    const presetItems = selected ? specsToInventoryItems(selected.items) : [];
    return {
      items: mergeInventoryDrafts([...autoGranted, ...presetItems, ...bonusItems]),
      currency: buildGoldAlternativeCurrency(0),
      spentGp: 0,
      budgetGp: 0,
      mode: "preset",
    };
  }

  const budgetGp = getClassFreeChoiceBudgetGp(input.className);
  const freeChoices = input.freeChoices ?? [];
  const chosenSpecs: Array<{ name: string; quantity?: number }> = [];
  let spentGp = 0;
  for (const choice of freeChoices) {
    const quantity = Math.max(0, Math.floor(choice.quantity));
    if (quantity <= 0) continue;
    chosenSpecs.push({ name: choice.name, quantity });
    spentGp += getCatalogCost(choice.name) * quantity;
  }

  const freeItems = specsToInventoryItems(chosenSpecs);
  const remainingGp = Math.max(0, budgetGp - spentGp);
  return {
    items: mergeInventoryDrafts([...autoGranted, ...freeItems]),
    currency: buildGoldAlternativeCurrency(remainingGp),
    spentGp,
    budgetGp,
    mode: "free",
  };
}

export function getCreationCoverageSummary(): {
  classesTotal: number;
  classesCovered: number;
  backgroundsTotal: number;
  backgroundsCovered: number;
} {
  const classesTotal = ALL_CLASSES.length;
  const classesCovered = ALL_CLASSES.filter((entry) => getClassStartingWealthRule(entry.name)).length;
  const backgroundsTotal = ALL_BACKGROUNDS.length;
  const backgroundsCovered = ALL_BACKGROUNDS.filter((name) => getBackgroundAutoGear(name).length > 0).length;
  return { classesTotal, classesCovered, backgroundsTotal, backgroundsCovered };
}
