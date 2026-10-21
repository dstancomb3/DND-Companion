import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { useCharacter } from "@/context/CharacterContext";
import { useColors } from "@/hooks/useColors";
import { API_BASE_URL } from "@/utils/apiUrl";
import { getAllCharacters, type SavedCharacter } from "@/utils/characterStorage";
import { getSavedDmNpcs, type SavedDmNpc } from "@/app/dm-npc";
import { getCustomMonsters } from "@/utils/monsterApi";
import {
  type CustomMonster,
  type ItemEffect,
  type InventoryItem,
  type ItemCategory,
  type EquippedStatKey,
  type LootFilterCriteria,
  type LootGeneratorMode,
  type ProposedInventoryItem,
  type QuickUpdateResult,
} from "@/types";
import {
  COMMON_LOOT_TAGS,
  getAllPlanes,
  searchCustomItems,
  searchOfficialItems,
} from "@/utils/lootGeneratorFilters";
import {
  analyzeCombatantForLoot,
  generatePersonalizedTailorItems,
  generateTailorSuggestions,
  parseEntityFromJson,
} from "@/utils/lootTailorAnalyzer";

type GeneratorTab = "photo_text" | "builder" | "tailor";
type TailorEntityType = "character" | "npc" | "beast";
type TailorGenerationMode = "local" | "ai";
type TailorPreference = "offense" | "defense" | "sustain" | "utility";

type TailorItemSource = "ai" | "local";

type TailorComputeResult = {
  items: ProposedInventoryItem[];
  usedFallback: boolean;
  sources: Record<string, TailorItemSource>;
};

type TailorOption = {
  id: string;
  label: string;
  subtitle?: string;
  entityType: TailorEntityType;
  payload: unknown;
};

const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];
const TAILOR_PREFERENCES: TailorPreference[] = ["offense", "defense", "sustain", "utility"];
const CATEGORIES: ItemCategory[] = [
  "weapon",
  "armor",
  "accessory",
  "consumable",
  "magic",
  "gear",
  "treasure",
  "quest",
  "map",
  "other",
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function pick<T>(items: T[], index: number): T {
  return items[index % items.length];
}

function randomInt(min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function pickRandomUnique<T>(items: T[], count: number): T[] {
  if (count <= 0 || items.length === 0) return [];
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

const THEME_STOPWORDS = new Set([
  "magical",
  "masterwork",
  "artifact",
  "custom",
  "material",
  "plane",
  "requires",
  "attunement",
]);

const THEME_FALLBACKS = [
  "Cinder",
  "Dusk",
  "Gale",
  "Frost",
  "Gloom",
  "Star",
  "Wyrm",
  "Storm",
  "Ash",
  "Moon",
];

const RARITY_ADJECTIVES: Record<string, string[]> = {
  Common: ["Sturdy", "Weathered", "Keen", "Honed", "Practical", "Field", "Reliable", "Seasoned"],
  Uncommon: ["Gilded", "Emberforged", "Moonlit", "Swift", "Glinting", "Warden", "Arc-bound", "Star-etched"],
  Rare: ["Sovereign", "Tempest", "Nightglass", "Sunmarked", "Wildfire", "Dawnforged", "Stormbound", "Wyrm-sung"],
  "Very Rare": ["Mythwoven", "Voidforged", "Eclipse", "Kingshield", "Dragonwake", "Celestial", "Ashen Crown", "Runescar"],
  Legendary: ["Worldforged", "Godsworn", "Empyrean", "Dreadstar", "Skybreaker", "Primeval", "Kingsbane", "Stormcrown"],
  Artifact: ["First Age", "Eternal", "Fatebound", "Eldritch Crown", "Doomwake", "Astral Throne", "Mythic Prime", "Ancientsworn"],
};

const NAME_TITLES = [
  "Oath",
  "Whisper",
  "Sigil",
  "Vow",
  "Crown",
  "Echo",
  "Spark",
  "Brand",
  "Aegis",
  "Tide",
  "Gleam",
  "Veil",
  "Pulse",
  "Shard",
  "Pact",
  "Warden",
];

function truncate(value: string | null | undefined, max = 120): string | null {
  if (!value) return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function humanizeStatKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function signedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function buildEffectPreview(effect: ItemEffect): string {
  const mechanics: string[] = [];

  if (effect.statKey && typeof effect.statValue === "number") {
    mechanics.push(`${humanizeStatKey(effect.statKey)} ${signedNumber(effect.statValue)}`);
  }
  if (effect.attackDamageDice || typeof effect.attackDamageBonus === "number" || effect.attackDamageType) {
    mechanics.push(
      [
        effect.attackDamageDice ?? "",
        typeof effect.attackDamageBonus === "number" ? signedNumber(effect.attackDamageBonus) : "",
        effect.attackDamageType ?? "",
      ].join(" ").trim(),
    );
  }
  if (effect.resourceName && typeof effect.resourceMaxBonus === "number") {
    mechanics.push(`${effect.resourceName} max ${signedNumber(effect.resourceMaxBonus)}`);
  }
  if (typeof effect.uses === "number") {
    mechanics.push(`${effect.uses} use${effect.uses === 1 ? "" : "s"}${effect.resetOn ? ` / ${effect.resetOn.replace("_", " ")}` : ""}`);
  }

  const base = [effect.label, ...mechanics].filter(Boolean).join(" | ");
  if (effect.description?.trim()) {
    return `${base}: ${effect.description.trim()}`;
  }
  return base;
}

function effectPreviewLines(item: ProposedInventoryItem, max = 2): string[] {
  if (!item.equippedEffects?.length) return [];
  return item.equippedEffects
    .slice(0, max)
    .map((effect) => truncate(buildEffectPreview(effect), 160))
    .filter((line): line is string => Boolean(line));
}

function resolveSourceTag(item: ProposedInventoryItem): "official" | "custom" {
  if (item.sourceTag === "official" || item.officialMatch) return "official";
  return "custom";
}

function resolveGeneratedQuantity(item: ProposedInventoryItem): number {
  const name = item.name.toLowerCase();
  const category = item.category;

  // Durable equipment and unique artifacts should stay singular.
  if (
    ["weapon", "armor", "accessory", "magic", "map", "quest", "other"].includes(category)
    || /\b(sword|blade|axe|bow|dagger|spear|hammer|mace|shield|helm|helmet|armor|cuirass|ring|amulet|talisman|brooch|tome|book|codex|atlas|map|relic|totem|lens|focus)\b/.test(name)
  ) {
    return 1;
  }

  if (/\b(torch|candle|ration|arrow|bolt|mushroom|herb|reagent|component)\b/.test(name)) {
    return randomInt(3, 12);
  }

  if (/\b(potion|elixir|draught|tonic|philter|antidote)\b/.test(name)) {
    return randomInt(1, 3);
  }

  if (category === "consumable") {
    return randomInt(1, 4);
  }

  if (category === "gear") {
    return randomInt(1, 5);
  }

  if (category === "treasure") {
    return randomInt(1, 4);
  }

  return 1;
}

function mechanicsSummary(item: ProposedInventoryItem): string[] {
  const details: string[] = [];
  if (item.damageDice) {
    const mod = item.damageModifier ? (item.damageModifier > 0 ? `+${item.damageModifier}` : `${item.damageModifier}`) : "";
    details.push(`Damage ${item.damageDice}${mod}${item.damageType ? ` ${item.damageType}` : ""}`.trim());
  }
  if (item.weaponRange) details.push(`Range ${item.weaponRange}`);
  if (item.additionalDamage?.length) {
    const first = item.additionalDamage[0];
    if (first?.dice || first?.damageType) {
      details.push(`Extra ${first.dice ?? ""} ${first.damageType ?? ""}`.trim());
    }
  }
  if (item.equippedEffects?.length) details.push(`${item.equippedEffects.length} effect${item.equippedEffects.length === 1 ? "" : "s"}`);
  if (item.tags?.length) details.push(item.tags.slice(0, 2).join(" / "));
  return details;
}

function rarityRank(rarity: string): number {
  const ranks: Record<string, number> = {
    Common: 0,
    Uncommon: 1,
    Rare: 2,
    "Very Rare": 3,
    Legendary: 4,
    Artifact: 5,
  };
  return ranks[rarity] ?? 0;
}

function buildDamageDice(rarity: string, category: ItemCategory): string {
  const baseDice = category === "weapon" ? ["1d4", "1d6", "1d8", "1d10", "1d12"] : ["1d4", "1d6", "1d8", "1d10", "2d6"];
  return pick(baseDice, rarityRank(rarity));
}

function resolveItemRarity(item: ProposedInventoryItem): string {
  const rarityTag = (item.tags ?? []).find((tag) => RARITIES.includes(tag));
  if (rarityTag) return rarityTag;

  const text = `${item.name} ${item.notes ?? ""}`;
  for (const rarity of RARITIES.slice().reverse()) {
    if (new RegExp(`\\b${rarity.replace(/\s+/g, "\\s+")}\\b`, "i").test(text)) {
      return rarity;
    }
  }

  return "Uncommon";
}

function nextRarity(rarity: string): string {
  const index = RARITIES.indexOf(rarity);
  if (index < 0) return "Rare";
  return RARITIES[Math.min(index + 1, RARITIES.length - 1)];
}

function applyItemRarity(item: ProposedInventoryItem, rarity: string): ProposedInventoryItem {
  const currentRarity = resolveItemRarity(item);
  const delta = rarityRank(rarity) - rarityRank(currentRarity);
  const value = typeof item.value === "number"
    ? Math.max(1, Math.round(item.value * Math.pow(1.75, delta)))
    : item.value;
  const filteredTags = (item.tags ?? []).filter((tag) => !RARITIES.includes(tag));
  return {
    ...item,
    value,
    tags: [rarity, ...filteredTags],
  };
}

function buildDamageType(tags: string[], planes: string[], index: number): string {
  const normalized = [...tags, ...planes].join(" ").toLowerCase();
  if (normalized.includes("fire") || normalized.includes("hell") || normalized.includes("infernal")) return "fire";
  if (normalized.includes("ice") || normalized.includes("frost") || normalized.includes("winter")) return "cold";
  if (normalized.includes("shadow") || normalized.includes("necrotic") || normalized.includes("dark")) return "necrotic";
  if (normalized.includes("radiant") || normalized.includes("holy") || normalized.includes("celestial")) return "radiant";
  if (normalized.includes("lightning") || normalized.includes("storm")) return "lightning";
  if (normalized.includes("poison") || normalized.includes("venom")) return "poison";
  return pick(["slashing", "piercing", "bludgeoning", "force"], index);
}

function buildThemeWord(tags: string[], planes: string[], index: number): string {
  const tagCandidates = [...tags]
    .map((entry) => titleCase(entry))
    .map((entry) => entry.replace(/\b(Plane|Nine|The|Of)\b/gi, "").trim())
    .map((entry) => entry.split(/\s+/).find(Boolean) ?? "")
    .filter((entry) => entry.length > 2)
    .filter((entry) => !THEME_STOPWORDS.has(entry.toLowerCase()));

  const planeCandidates = [...planes]
    .map((entry) => titleCase(entry))
    .map((entry) => entry.replace(/\b(Plane|Nine|The|Of)\b/gi, "").trim())
    .map((entry) => entry.split(/\s+/).find(Boolean) ?? "")
    .filter((entry) => entry.length > 2)
    .filter((entry) => !THEME_STOPWORDS.has(entry.toLowerCase()));

  // Plane tokens are intentionally rare in names (roughly 1 in 6), unless tags are missing.
  const shouldUsePlaneToken = planeCandidates.length > 0 && (tagCandidates.length === 0 || index % 6 === 0);
  const candidates = shouldUsePlaneToken
    ? [...tagCandidates, ...planeCandidates]
    : tagCandidates;

  if (candidates.length > 0) return pick(candidates, index);
  return pick(THEME_FALLBACKS, index);
}

function buildCustomLootDescription(category: ItemCategory, rarity: string, tags: string[], planes: string[], index: number): string {
  const theme = buildThemeWord(tags, planes, index);
  const planeText = planes.length > 0 ? planes.join(", ") : "the Material Plane";
  const tagText = tags.length > 0 ? tags.join(", ") : "mysterious origins";

  const weaponLine = category === "weapon"
    ? `Wielded, it grants a ${rarity === "Common" ? "+1" : "+2"} bonus to damage rolls and a burst of ${buildDamageType(tags, planes, index)} power.`
    : "";
  const armorLine = category === "armor"
    ? `While worn, it hardens into a protective ward and improves your defenses.`
    : "";
  const accessoryLine = category === "accessory"
    ? `It subtly sharpens instincts and seems to guide fate toward the wearer.`
    : "";
  const consumableLine = category === "consumable"
    ? `Drink to gain a brief surge of ${buildDamageType(tags, planes, index)}-tinted power.`
    : "";

  return [
    `A ${titleCase(rarity)} ${titleCase(category)} from ${theme.toLowerCase()} traditions, shaped by ${planeText}.`,
    `Tags: ${tagText}.`,
    weaponLine,
    armorLine,
    accessoryLine,
    consumableLine,
  ].filter(Boolean).join(" ");
}

function buildCustomLootEffects(category: ItemCategory, rarity: string, tags: string[], planes: string[], index: number): ItemEffect[] {
  const effectStrength = Math.max(1, rarityRank(rarity) + 1);
  const damageType = buildDamageType(tags, planes, index);
  const theme = buildThemeWord(tags, planes, index);

  if (category === "weapon") {
    return [
      {
        id: `effect_${generateId()}`,
        type: "attack_damage",
        label: `${theme} Strike`,
        description: `Adds ${buildDamageDice(rarity, category)} ${damageType} damage on a hit.`,
        attackDamageDice: buildDamageDice(rarity, category),
        attackDamageBonus: Math.max(0, effectStrength - 1),
        attackDamageType: damageType,
      },
      {
        id: `effect_${generateId()}`,
        type: "stat_bonus",
        label: `${theme} Accuracy`,
        description: `Improves weapon handling with a ${effectStrength > 2 ? "+2" : "+1"} bonus to attack rolls.`,
        statKey: pick<EquippedStatKey>(["strength", "dexterity", "initiative"], index),
        statValue: effectStrength > 2 ? 2 : 1,
      },
    ];
  }

  if (category === "armor") {
    return [
      {
        id: `effect_${generateId()}`,
        type: "stat_bonus",
        label: `${theme} Ward`,
        description: `A protective ward that bolsters defenses while worn.`,
        statKey: "armorClass",
        statValue: effectStrength > 3 ? 2 : 1,
      },
      {
        id: `effect_${generateId()}`,
        type: "buff",
        label: `${theme} Fortitude`,
        description: `You feel steadier and harder to shake when this is equipped.`,
      },
    ];
  }

  if (category === "accessory") {
    return [
      {
        id: `effect_${generateId()}`,
        type: "stat_bonus",
        label: `${theme} Insight`,
        description: `Heightens awareness and improves passive defenses.`,
        statKey: pick<EquippedStatKey>(["initiative", "passivePerception", "maxHp"], index),
        statValue: effectStrength > 2 ? 2 : 1,
      },
    ];
  }

  if (category === "consumable") {
    return [
      {
        id: `effect_${generateId()}`,
        type: "spell",
        label: `${theme} Surge`,
        description: `A single-use burst of ${damageType} energy that feels like a spell effect.`,
        uses: 1,
        resetOn: "dawn",
      },
    ];
  }

  if (category === "magic") {
    return [
      {
        id: `effect_${generateId()}`,
        type: "feature",
        label: `${theme} Focus`,
        description: `Channels a persistent magical benefit aligned to ${theme.toLowerCase()}.`,
        resourceName: "Focus",
        resourceMaxBonus: effectStrength,
      },
      {
        id: `effect_${generateId()}`,
        type: "buff",
        label: `${theme} Aura`,
        description: `A constant aura that colors the item’s magic in ${damageType}.`,
      },
    ];
  }

  return [
    {
      id: `effect_${generateId()}`,
      type: "note",
      label: `${theme} Lore`,
      description: `An item with a story tied to ${planes.join(", ") || "the Material Plane"}.`,
    },
  ];
}

function buildCustomLootRange(category: ItemCategory, rarity: string, tags: string[], planes: string[], index: number): string | undefined {
  if (category !== "weapon") return undefined;
  const damageType = buildDamageType(tags, planes, index);
  const base = rarityRank(rarity) >= 3 ? "30 ft" : "20 ft";
  return `${base} / ${damageType === "force" ? "60 ft" : "40 ft"}`;
}

function buildCustomLootName(category: ItemCategory, rarity: string, tags: string[], planes: string[], index: number): string {
  const categoryBase: Record<ItemCategory, string[]> = {
    weapon: ["Blade", "Spear", "Axe", "Bow", "Dagger", "Hammer", "Glaive", "Lance"],
    armor: ["Cuirass", "Ward", "Carapace", "Bulwark", "Shell"],
    accessory: ["Amulet", "Ring", "Talisman", "Brooch", "Band", "Pendant"],
    consumable: ["Vial", "Potion", "Elixir", "Draught", "Tonic"],
    magic: ["Relic", "Focus", "Sigil", "Totem", "Lens"],
    gear: ["Kit", "Pack", "Tool", "Bundle", "Token"],
    treasure: ["Cache", "Hoard", "Cachet", "Purse", "Trove"],
    quest: ["Clue", "Key", "Seal", "Token", "Marker"],
    map: ["Map", "Chart", "Atlas", "Diagram", "Route"],
    other: ["Relic", "Curio", "Trinket", "Oddment", "Keystone"],
  };

  const theme = buildThemeWord(tags, planes, index);
  const adjective = pick(RARITY_ADJECTIVES[rarity] ?? RARITY_ADJECTIVES.Uncommon, index + category.length);
  const epithet = pick(NAME_TITLES, index + rarityRank(rarity) + theme.length);
  const categoryWord = pick(categoryBase[category], index);
  const patternIndex = (index + rarityRank(rarity) + categoryWord.length) % 5;

  if (patternIndex === 0) {
    return `${adjective} ${categoryWord}`.replace(/\s+/g, " ").trim();
  }
  if (patternIndex === 1) {
    return `${adjective} ${theme} ${categoryWord}`.replace(/\s+/g, " ").trim();
  }
  if (patternIndex === 2) {
    return `${categoryWord} of the ${theme} ${epithet}`.replace(/\s+/g, " ").trim();
  }
  if (patternIndex === 3) {
    return `${theme} ${categoryWord}`.replace(/\s+/g, " ").trim();
  }
  return `${adjective} ${categoryWord} of ${epithet}`.replace(/\s+/g, " ").trim();
}

function buildCustomLootNotes(category: ItemCategory, rarity: string, tags: string[], planes: string[]): string {
  const tagText = tags.length > 0 ? tags.join(", ") : "no special tags";
  const planeText = planes.length > 0 ? planes.join(", ") : "the Material Plane";
  return `Synthesized from filter requirements. Category: ${category}. Rarity: ${rarity}. Tags: ${tagText}. Plane origins: ${planeText}.`;
}

function buildCustomLootValue(rarity: string, category: ItemCategory): number {
  const rarityValue: Record<string, number> = {
    Common: 25,
    Uncommon: 150,
    Rare: 750,
    "Very Rare": 3000,
    Legendary: 12000,
    Artifact: 50000,
  };

  const categoryMultiplier: Record<ItemCategory, number> = {
    weapon: 1.2,
    armor: 1.25,
    accessory: 1.35,
    consumable: 0.85,
    magic: 1.5,
    gear: 0.75,
    treasure: 1.0,
    quest: 0.6,
    map: 0.55,
    other: 0.8,
  };

  return Math.max(1, Math.round((rarityValue[rarity] ?? 100) * (categoryMultiplier[category] ?? 1)));
}

function generateCustomLoot(criteria: LootFilterCriteria, batchSize: number): ProposedInventoryItem[] {
  const fallbackCategories: ItemCategory[] = ["magic", "gear", "treasure"];
  const categories: ItemCategory[] = criteria.category?.length ? criteria.category : fallbackCategories;
  const rarities = criteria.rarity?.length ? criteria.rarity : ["Uncommon"];
  const tags = criteria.tags?.length ? criteria.tags : ["Magical", "Clever", "Cursed"];
  const planes = criteria.planeOrigins?.length ? criteria.planeOrigins : ["Material"];

  return Array.from({ length: batchSize }, (_, index) => {
    const category = categories[index % categories.length];
    const rarity = rarities[index % rarities.length];
    const name = buildCustomLootName(category, rarity, tags, planes, index);
    const damageDice = buildCustomLootRange(category, rarity, tags, planes, index);
    const damageType = buildDamageType(tags, planes, index);
    const effects = buildCustomLootEffects(category, rarity, tags, planes, index);

    return {
      id: `custom_generated_${generateId()}`,
      name,
      quantity: 1,
      category,
      value: buildCustomLootValue(rarity, category),
      notes: buildCustomLootDescription(category, rarity, tags, planes, index),
      tags: Array.from(new Set(["Custom Generated", rarity, ...tags.slice(0, 3), ...planes.slice(0, 2)])),
      confidence: "medium",
      needsReview: true,
      sourceTag: "custom",
      officialMatch: false,
      damageDice: category === "weapon" ? buildDamageDice(rarity, category) : undefined,
      damageModifier: category === "weapon" ? Math.max(0, rarityRank(rarity) - 1) : undefined,
      damageType: category === "weapon" ? damageType : undefined,
      weaponRange: damageDice,
      attackAbility: category === "weapon"
        ? (tags.some((tag) => /dex|agile|finesse|quick/i.test(tag)) ? "dexterity" : "strength")
        : undefined,
      isProficient: category === "weapon" ? true : undefined,
      additionalDamage: category === "weapon" && rarityRank(rarity) >= 2
        ? [{ dice: rarityRank(rarity) >= 4 ? "1d6" : "1d4", damageType, sourceLabel: `${titleCase(rarity)} Focus` }]
        : undefined,
      equippedEffects: effects,
    };
  });
}

function toProposed(item: InventoryItem | ProposedInventoryItem): ProposedInventoryItem {
  if ("confidence" in item && "needsReview" in item) {
    return {
      ...item,
      sourceTag: item.sourceTag ?? (item.officialMatch ? "official" : "custom"),
    };
  }

  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity ?? 1,
    category: item.category,
    value: item.value,
    notes: item.notes,
    tags: item.tags,
    confidence: "medium",
    needsReview: true,
    sourceTag: item.sourceTag ?? "custom",
    damageDice: item.damageDice,
    damageModifier: item.damageModifier,
    damageType: item.damageType,
    additionalDamage: item.additionalDamage,
    equippedEffects: item.equippedEffects,
    weaponRange: item.weaponRange,
    attackAbility: item.attackAbility,
    isProficient: item.isProficient,
  };
}

function buildQuickUpdatePayload(items: ProposedInventoryItem[]): QuickUpdateResult {
  return {
    rawInput: "loot-generator",
    summary: `Loot Generator draft with ${items.length} item${items.length === 1 ? "" : "s"}`,
    type: "inventory",
    proposedInventoryChanges: items,
    proposedResourceChanges: [],
    proposedConditionChanges: [],
  };
}

function byName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function mergeTailorSuggestions(
  personalized: ProposedInventoryItem[],
  recommended: ProposedInventoryItem[],
  limit = 8,
  options?: {
    strictCategoryDiversity?: boolean;
    preferences?: TailorPreference[];
  },
): ProposedInventoryItem[] {
  const merged = [...personalized, ...recommended];
  const seen = new Set<string>();
  const unique: ProposedInventoryItem[] = [];

  for (const item of merged) {
    const key = item.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const preferences = options?.preferences ?? [];
  const ranked = preferences.length > 0
    ? unique
      .map((item, index) => ({
        item,
        index,
        score: preferences.reduce((total, preference) => {
          if (preference === "offense") {
            return total
              + (["weapon", "magic"].includes(item.category) ? 4 : 0)
              + (item.damageDice || item.additionalDamage?.length ? 3 : 0)
              + ((item.equippedEffects ?? []).some((effect) => effect.attackDamageDice || effect.attackDamageType) ? 2 : 0);
          }
          if (preference === "defense") {
            return total
              + (["armor", "accessory"].includes(item.category) ? 4 : 0)
              + ((item.equippedEffects ?? []).some((effect) => effect.statKey === "armorClass" || effect.statKey === "maxHp") ? 3 : 0);
          }
          if (preference === "sustain") {
            return total
              + (["consumable", "accessory", "magic"].includes(item.category) ? 3 : 0)
              + ((item.equippedEffects ?? []).some((effect) => effect.resourceName || effect.resourceMaxBonus || effect.statKey === "maxHp") ? 2 : 0)
              + (/heal|healing|potion|elixir|vigor|rest/i.test(item.name + " " + (item.notes ?? "")) ? 1 : 0);
          }
          return total
            + (["gear", "map", "quest", "accessory", "magic"].includes(item.category) ? 3 : 0)
            + (/tool|travel|scout|utility|map|key|focus|ward/i.test(item.name + " " + (item.notes ?? "")) ? 2 : 0);
        }, 0),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.item)
    : unique;

  if (options?.strictCategoryDiversity) {
    const buckets = new Map<ItemCategory, ProposedInventoryItem[]>();
    for (const item of ranked) {
      const bucket = buckets.get(item.category);
      if (bucket) {
        bucket.push(item);
      } else {
        buckets.set(item.category, [item]);
      }
    }

    const categoryOrder = Array.from(buckets.keys());
    const result: ProposedInventoryItem[] = [];
    while (result.length < limit) {
      let added = false;
      for (const category of categoryOrder) {
        const bucket = buckets.get(category);
        if (bucket && bucket.length > 0) {
          result.push(bucket.shift() as ProposedInventoryItem);
          added = true;
          if (result.length >= limit) break;
        }
      }
      if (!added) break;
    }
    return result;
  }

  const categoryUsed = new Set<ItemCategory>();
  const categoryFirstPass: ProposedInventoryItem[] = [];
  const overflow: ProposedInventoryItem[] = [];

  for (const item of ranked) {
    if (!categoryUsed.has(item.category) && categoryFirstPass.length < limit) {
      categoryUsed.add(item.category);
      categoryFirstPass.push(item);
    } else {
      overflow.push(item);
    }
  }

  return [...categoryFirstPass, ...overflow].slice(0, limit);
}

const TAILOR_NAME_ADJECTIVES = [
  "Stormbound",
  "Nightglass",
  "Dawnforged",
  "Ashen",
  "Moonlit",
  "Wyrm-sung",
  "Star-threaded",
  "Gilded",
  "Oathbound",
  "Runescar",
];

const TAILOR_NAME_TITLES = ["Aegis", "Vow", "Whisper", "Sigil", "Brand", "Echo", "Crown", "Warden"];

function buildTailorReason(context: ReturnType<typeof analyzeCombatantForLoot>, item: ProposedInventoryItem): string {
  const reasons: string[] = [];
  if (context.primaryAbility) reasons.push(`supports ${context.primaryAbility}`);
  if ((context.armorClass ?? 10) <= 12 && ["armor", "accessory"].includes(item.category)) reasons.push("covers low AC");
  const firstGearGap = (context.gearGaps ?? [])[0];
  if (firstGearGap) reasons.push(`targets ${firstGearGap.toLowerCase()}`);
  if (context.characterClass) reasons.push(`fits ${context.characterClass} playstyle`);
  return reasons.length > 0 ? `Tailored: ${reasons.slice(0, 3).join("; ")}.` : "Tailored: profile-aligned upgrade.";
}

function shouldRenameTailorItem(name: string, context: ReturnType<typeof analyzeCombatantForLoot>): boolean {
  const clean = name.trim();
  const lower = clean.toLowerCase();
  const seed = context.name.toLowerCase();
  if (clean.length < 9) return true;
  if (/\b(item|weapon|armor|loot|gear|magic item|artifact)\b/i.test(clean)) return true;
  if (new RegExp(`^${seed}['’]s\\s+`, "i").test(clean)) return true;
  if (/\b(beast|companion|creature)\b/i.test(clean)) return true;
  return false;
}

function rewriteTailorName(item: ProposedInventoryItem, index: number): string {
  const categoryWord: Record<ItemCategory, string[]> = {
    weapon: ["Blade", "Fang", "Lance", "Glaive", "Bow", "Spear"],
    armor: ["Carapace", "Cuirass", "Mantle", "Wardplate"],
    accessory: ["Charm", "Band", "Amulet", "Talisman", "Brooch"],
    consumable: ["Elixir", "Tonic", "Draught", "Phial"],
    magic: ["Relic", "Focus", "Sigil", "Totem"],
    gear: ["Kit", "Bundle", "Toolset", "Pack"],
    treasure: ["Cache", "Hoard", "Trove", "Cachet"],
    quest: ["Seal", "Token", "Keystone", "Marker"],
    map: ["Chart", "Atlas", "Route", "Survey"],
    other: ["Relic", "Curio", "Oddment", "Keystone"],
  };
  const adjective = TAILOR_NAME_ADJECTIVES[index % TAILOR_NAME_ADJECTIVES.length];
  const title = TAILOR_NAME_TITLES[(index + adjective.length) % TAILOR_NAME_TITLES.length];
  const nounPool = categoryWord[item.category] ?? categoryWord.other;
  const noun = nounPool[index % nounPool.length];
  const pattern = index % 4;
  if (pattern === 0) return `${adjective} ${noun}`;
  if (pattern === 1) return `${noun} of the ${title}`;
  if (pattern === 2) return `${adjective} ${noun} of ${title}`;
  return `${title} ${noun}`;
}

function leadingToken(name: string): string {
  const token = name.trim().split(/\s+/)[0] ?? "";
  return token.toLowerCase();
}

function trailingToken(name: string): string {
  const parts = name.trim().split(/\s+/);
  const token = parts[parts.length - 1] ?? "";
  return token.toLowerCase();
}

function uniquifyTailorName(
  baseItem: ProposedInventoryItem,
  startIndex: number,
  usedLeadingTokens: Set<string>,
  usedTrailingTokens: Set<string>,
): string {
  for (let offset = 0; offset < 10; offset += 1) {
    const candidate = rewriteTailorName(baseItem, startIndex + offset);
    const lead = leadingToken(candidate);
    const tail = trailingToken(candidate);
    if (!usedLeadingTokens.has(lead) && !usedTrailingTokens.has(tail)) {
      usedLeadingTokens.add(lead);
      usedTrailingTokens.add(tail);
      return candidate;
    }
  }

  const fallback = `${rewriteTailorName(baseItem, startIndex)} Mk.${(startIndex % 7) + 1}`;
  usedLeadingTokens.add(leadingToken(fallback));
  usedTrailingTokens.add(trailingToken(fallback));
  return fallback;
}

function personalizeTailorItems(
  items: ProposedInventoryItem[],
  context: ReturnType<typeof analyzeCombatantForLoot>,
): ProposedInventoryItem[] {
  const usedLeadingTokens = new Set<string>();
  const usedTrailingTokens = new Set<string>();

  return items.map((item, index) => {
    const renamed = shouldRenameTailorItem(item.name, context)
      ? uniquifyTailorName(item, index, usedLeadingTokens, usedTrailingTokens)
      : item.name;
    usedLeadingTokens.add(leadingToken(renamed));
    usedTrailingTokens.add(trailingToken(renamed));
    const reason = buildTailorReason(context, item);
    const nextNotes = item.notes?.trim() ? `${reason} ${item.notes.trim()}` : reason;
    return {
      ...item,
      name: renamed,
      notes: nextNotes,
    };
  });
}

function extractTailorReason(notes: string | undefined): string | null {
  if (!notes) return null;
  const match = /^(Tailored:[^.]+\.)/.exec(notes);
  return match ? match[1] : null;
}

function stripTailorReason(notes: string | undefined): string | null {
  if (!notes) return null;
  const stripped = notes.replace(/^Tailored:[^.]+\.\s*/, "").trim();
  return stripped || null;
}

function buildTailorAiPrompt(context: ReturnType<typeof analyzeCombatantForLoot>): string {
  const core = [
    `Create personalized D&D 5e loot for this entity: ${context.name}.`,
    `Entity type: ${context.entityType}.`,
    context.characterClass ? `Class: ${context.characterClass}.` : "",
    context.race ? `Race: ${context.race}.` : "",
    context.level ? `Level/CR baseline: ${context.level}.` : "",
    context.primaryAbility ? `Primary ability: ${context.primaryAbility}.` : "",
    context.secondaryAbilities?.length ? `Secondary abilities: ${context.secondaryAbilities.join(", ")}.` : "",
    `Armor class: ${context.armorClass ?? "unknown"}. HP: ${context.currentHp ?? "unknown"}/${context.maxHp ?? "unknown"}.`,
    context.specialAbilities?.length ? `Special abilities/themes: ${context.specialAbilities.slice(0, 5).join(", ")}.` : "",
    context.personalityHints?.length ? `Personality hints: ${context.personalityHints.join(", ")}.` : "",
    context.gearGaps?.length ? `Gear gaps to address: ${context.gearGaps.join(", ")}.` : "",
    "Output only inventory loot suggestions (no HP/resource/condition changes).",
    "Return 6-8 items with varied categories and rich mechanical details where appropriate.",
    "Use diverse item names; avoid repeating the entity name in every item.",
  ].filter(Boolean);

  return core.join(" ");
}

export default function LootGeneratorScreen() {
  const c = useColors();
  const { inventory, realms } = useCharacter();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();

  const [tab, setTab] = useState<GeneratorTab>(() => {
    if (initialTab === "photo_text" || initialTab === "builder" || initialTab === "tailor") {
      return initialTab;
    }
    return "builder";
  });
  const [mode, setMode] = useState<LootGeneratorMode>("single");

  const [nameFilter, setNameFilter] = useState("");
  const [selectedRarity, setSelectedRarity] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPlanes, setSelectedPlanes] = useState<string[]>([]);

  const [draft, setDraft] = useState<ProposedInventoryItem[]>([]);

  const [tailorLoading, setTailorLoading] = useState(false);
  const [tailorGenerating, setTailorGenerating] = useState(false);
  const [tailorGenerationMode, setTailorGenerationMode] = useState<TailorGenerationMode>("local");
  const [tailorEntityType, setTailorEntityType] = useState<TailorEntityType>("character");
  const [strictTailorDiversity, setStrictTailorDiversity] = useState(false);
  const [tailorPreferences, setTailorPreferences] = useState<TailorPreference[]>([]);
  const [tailorOptions, setTailorOptions] = useState<TailorOption[]>([]);
  const [selectedTailorId, setSelectedTailorId] = useState<string | null>(null);
  const [tailorSuggestions, setTailorSuggestions] = useState<ProposedInventoryItem[]>([]);
  const [tailorUsedFallback, setTailorUsedFallback] = useState(false);
  const [tailorItemSources, setTailorItemSources] = useState<Record<string, TailorItemSource>>({});
  const [jsonInput, setJsonInput] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftEditName, setDraftEditName] = useState("");
  const [draftEditQuantity, setDraftEditQuantity] = useState("1");
  const [draftEditRarity, setDraftEditRarity] = useState("Uncommon");

  const allPlanes = useMemo(() => getAllPlanes((realms ?? []).map((plane) => plane.name)), [realms]);

  const criteria: LootFilterCriteria = useMemo(
    () => ({
      name: nameFilter.trim() || undefined,
      rarity: selectedRarity.length > 0 ? selectedRarity : undefined,
      category: selectedCategory.length > 0 ? selectedCategory : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      planeOrigins: selectedPlanes.length > 0 ? selectedPlanes : undefined,
    }),
    [nameFilter, selectedCategory, selectedPlanes, selectedRarity, selectedTags],
  );

  const officialItems = useMemo(() => searchOfficialItems(criteria), [criteria]);
  const allOfficialItems = useMemo(() => searchOfficialItems({}), []);
  const customItems = useMemo(() => searchCustomItems(inventory, criteria), [criteria, inventory]);
  const allCustomItems = useMemo(() => inventory.map((item) => toProposed(item)), [inventory]);
  const filteredPool = useMemo(() => {
    return byName([
      ...officialItems,
      ...customItems.map((item) => toProposed(item)),
    ]);
  }, [customItems, officialItems]);
  const tailorSuggestionPool = useMemo(
    () => byName([...allOfficialItems, ...allCustomItems]),
    [allCustomItems, allOfficialItems],
  );

  const draftNames = useMemo(() => new Set(draft.map((item) => item.name.toLowerCase())), [draft]);
  const editingDraftItem = useMemo(
    () => draft.find((item) => item.id === editingDraftId) ?? null,
    [draft, editingDraftId],
  );

  const toggleSelect = <T extends string>(values: T[], value: T, set: (next: T[]) => void) => {
    if (values.includes(value)) {
      set(values.filter((entry) => entry !== value));
      return;
    }
    set([...values, value]);
  };

  const addToDraft = useCallback(
    (item: ProposedInventoryItem) => {
      setDraft((prev) => {
        if (mode === "single") return [toProposed(item)];
        const exists = prev.some((entry) => entry.name.toLowerCase() === item.name.toLowerCase());
        if (exists) return prev;
        return [...prev, toProposed(item)];
      });
    },
    [mode],
  );

  const addAllFiltered = useCallback(() => {
    setDraft((prev) => {
      if (mode === "single") return filteredPool.length > 0 ? [filteredPool[0]] : prev;
      const existing = new Set(prev.map((item) => item.name.toLowerCase()));
      const additions = filteredPool.filter((item) => !existing.has(item.name.toLowerCase()));
      return [...prev, ...additions];
    });
  }, [filteredPool, mode]);

  const handleGenerateLoot = useCallback(() => {
    setDraft((prev) => {
      const desiredCount = mode === "single" ? 1 : 3;
      const tableLoot = pickRandomUnique(filteredPool, desiredCount)
        .map(toProposed)
        .map((item) => ({
          ...item,
          quantity: resolveGeneratedQuantity(item),
        }));
      const missingCount = Math.max(0, desiredCount - tableLoot.length);
      const customLootBase = mode === "batch"
        ? generateCustomLoot(criteria, Math.max(1, missingCount > 0 ? missingCount : 2))
        : tableLoot.length === 0
          ? generateCustomLoot(criteria, 1)
        : [];
      const customLoot = customLootBase.map((item) => ({
        ...item,
        quantity: resolveGeneratedQuantity(item),
      }));
      const combined = byName([...tableLoot, ...customLoot]);
      if (mode === "single") {
        return combined.slice(0, 1);
      }

      const existing = new Set(prev.map((item) => item.name.toLowerCase()));
      const additions = combined.filter((item) => !existing.has(item.name.toLowerCase()));
      return [...prev, ...additions];
    });
  }, [criteria, filteredPool, mode]);

  const removeFromDraft = useCallback((id: string) => {
    setDraft((prev) => prev.filter((item) => item.id !== id));
    setEditingDraftId((prev) => (prev === id ? null : prev));
  }, []);

  const beginEditDraft = useCallback((item: ProposedInventoryItem) => {
    setEditingDraftId(item.id);
    setDraftEditName(item.name);
    setDraftEditQuantity(String(Math.max(1, item.quantity || 1)));
    setDraftEditRarity(resolveItemRarity(item));
  }, []);

  const saveDraftEdit = useCallback(() => {
    if (!editingDraftId) return;
    const quantity = Math.max(1, Number.parseInt(draftEditQuantity, 10) || 1);

    setDraft((prev) => prev.map((item) => {
      if (item.id !== editingDraftId) return item;
      const renamed = draftEditName.trim() || item.name;
      const withBasics = {
        ...item,
        name: renamed,
        quantity,
      };
      return applyItemRarity(withBasics, draftEditRarity);
    }));

    setEditingDraftId(null);
  }, [draftEditName, draftEditQuantity, draftEditRarity, editingDraftId]);

  const pushDraftToReview = useCallback(() => {
    if (draft.length === 0) {
      Alert.alert("No items selected", "Add at least one item to the draft before sending to Loot Review.");
      return;
    }

    const payload = buildQuickUpdatePayload(draft);
    router.push({
      pathname: "/loot-review",
      params: {
        source: "text",
        data: JSON.stringify(payload),
      },
    });
  }, [draft]);

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      setTailorLoading(true);
      try {
        const [characters, npcs, beasts] = await Promise.all([
          getAllCharacters(),
          getSavedDmNpcs(),
          getCustomMonsters(),
        ]);

        if (!active) return;

        const mappedCharacters: TailorOption[] = characters.map((entry: SavedCharacter) => ({
          id: `character_${entry.id}`,
          label: entry.name,
          subtitle: `${entry.characterClass} · L${entry.level}`,
          entityType: "character",
          payload: entry.snapshot.character,
        }));

        const mappedNpcs: TailorOption[] = npcs.map((entry: SavedDmNpc) => ({
          id: `npc_${entry.id}`,
          label: entry.name || "Unnamed NPC",
          subtitle: `${entry.charClass || "NPC"} · L${entry.level || "1"}`,
          entityType: "npc",
          payload: {
            id: entry.id,
            name: entry.name || "Unnamed NPC",
            role: entry.occupation || entry.charClass || "NPC",
            relationship: "neutral",
            questTags: entry.questTags ?? [],
            createdAt: entry.savedAt,
            description: entry.notes,
          },
        }));

        const mappedBeasts: TailorOption[] = beasts.map((monster: CustomMonster) => ({
          id: `beast_${monster.id}`,
          label: monster.name,
          subtitle: `${monster.type || "Beast"} · CR ${monster.challenge_rating} · Saved`,
          entityType: "beast",
          payload: monster,
        }));

        setTailorOptions([...mappedCharacters, ...mappedNpcs, ...mappedBeasts]);
      } catch {
        if (active) {
          setTailorOptions([]);
        }
      } finally {
        if (active) {
          setTailorLoading(false);
        }
      }
    };

    void loadOptions();

    return () => {
      active = false;
    };
  }, []);

  const filteredTailorOptions = useMemo(
    () => tailorOptions.filter((option) => option.entityType === tailorEntityType),
    [tailorEntityType, tailorOptions],
  );

  const generateAiTailorSuggestions = useCallback(async (context: ReturnType<typeof analyzeCombatantForLoot>): Promise<ProposedInventoryItem[]> => {
    const payload = {
      text: buildTailorAiPrompt(context),
      characterContext: {
        name: context.name,
        class: context.characterClass,
        level: context.level,
        currentHp: context.currentHp,
        maxHp: context.maxHp,
      },
    };

    const resp = await fetch(`${API_BASE_URL}/api/ai/parse-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error((errData as { error?: string }).error ?? `Server error: ${resp.status}`);
    }

    const parsed = (await resp.json()) as QuickUpdateResult;
    const aiItems = (parsed.proposedInventoryChanges ?? [])
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        ...item,
        id: item.id || generateId(),
        sourceTag: item.sourceTag ?? (item.officialMatch ? "official" : "custom"),
      }));

    return aiItems;
  }, []);

  const computeTailorSuggestions = useCallback(async (context: ReturnType<typeof analyzeCombatantForLoot>): Promise<TailorComputeResult> => {
    if (tailorGenerationMode === "ai") {
      try {
        const aiItems = await generateAiTailorSuggestions(context);
        const personalized = generatePersonalizedTailorItems(context, 2);
        const mergedAi = mergeTailorSuggestions(personalized, aiItems, 8, {
          strictCategoryDiversity: strictTailorDiversity,
          preferences: tailorPreferences,
        });
        if (mergedAi.length > 0) {
          const sources: Record<string, TailorItemSource> = {};
          for (const item of personalized) sources[item.id] = "local";
          for (const item of aiItems) sources[item.id] = "ai";
          for (const item of mergedAi) { if (!sources[item.id]) sources[item.id] = "ai"; }
          return { items: mergedAi, usedFallback: false, sources };
        }
      } catch {
        // Silent fallback to local path.
      }
    }

    const personalized = generatePersonalizedTailorItems(context, 3);
    const suggestions = generateTailorSuggestions(context, tailorSuggestionPool);
    const merged = mergeTailorSuggestions(personalized, suggestions, 8, {
      strictCategoryDiversity: strictTailorDiversity,
      preferences: tailorPreferences,
    });
    const sources: Record<string, TailorItemSource> = {};
    for (const item of merged) sources[item.id] = "local";
    return { items: merged, usedFallback: tailorGenerationMode === "ai", sources };
  }, [
    generateAiTailorSuggestions,
    strictTailorDiversity,
    tailorGenerationMode,
    tailorPreferences,
    tailorSuggestionPool,
  ]);

  const runTailorForSelected = useCallback(async () => {
    const target = filteredTailorOptions.find((option) => option.id === selectedTailorId);
    if (!target) {
      Alert.alert("Select an entity", "Pick a saved character, NPC, or beast first.");
      return;
    }

    try {
      setTailorGenerating(true);
      const context = analyzeCombatantForLoot(target.payload as any);
      const result = await computeTailorSuggestions(context);
      const personalized = personalizeTailorItems(result.items, context);
      setTailorUsedFallback(result.usedFallback);
      setTailorItemSources(result.sources);
      setTailorSuggestions(byName(personalized));
    } catch (err: unknown) {
      Alert.alert("Tailor generation failed", err instanceof Error ? err.message : "Could not generate tailor suggestions.");
    } finally {
      setTailorGenerating(false);
    }
  }, [computeTailorSuggestions, filteredTailorOptions, selectedTailorId]);

  const runTailorForJson = useCallback(async () => {
    if (!jsonInput.trim()) {
      Alert.alert("JSON required", "Paste an entity JSON payload to analyze.");
      return;
    }

    try {
      setTailorGenerating(true);
      const parsed = JSON.parse(jsonInput);
      const entity = parseEntityFromJson(parsed);
      if (!entity) {
        Alert.alert("Unsupported JSON", "Could not identify this as a character, NPC, or beast record.");
        setTailorGenerating(false);
        return;
      }
      const context = analyzeCombatantForLoot(entity);
      const result = await computeTailorSuggestions(context);
      const personalized = personalizeTailorItems(result.items, context);
      setTailorUsedFallback(result.usedFallback);
      setTailorItemSources(result.sources);
      setTailorSuggestions(byName(personalized));
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        Alert.alert("Invalid JSON", "The pasted input is not valid JSON.");
      } else {
        Alert.alert("Tailor generation failed", err instanceof Error ? err.message : "Could not generate tailor suggestions.");
      }
    } finally {
      setTailorGenerating(false);
    }
  }, [computeTailorSuggestions, jsonInput]);

  const handleRegenerate = useCallback(() => {
    if (selectedTailorId) {
      void runTailorForSelected();
    } else if (jsonInput.trim()) {
      void runTailorForJson();
    } else {
      Alert.alert("Nothing to regenerate", "Select an entity or paste JSON first.");
    }
  }, [jsonInput, runTailorForJson, runTailorForSelected, selectedTailorId]);

  const addAllTailorSuggestions = useCallback(() => {
    if (tailorSuggestions.length === 0) {
      Alert.alert("Nothing to add", "Generate suggestions first so there is something to add.");
      return;
    }

    setDraft((prev) => {
      if (mode === "single") {
        return [tailorSuggestions[0]];
      }

      const existing = new Set(prev.map((item) => item.name.toLowerCase()));
      const additions = tailorSuggestions.filter((item) => !existing.has(item.name.toLowerCase()));
      return [...prev, ...additions];
    });
  }, [mode, tailorSuggestions]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { borderBottomColor: c.border }]}> 
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/landing"))}
          style={[styles.backButton, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Feather name="arrow-left" size={16} color={c.foreground} />
          <Text style={{ color: c.foreground, fontWeight: "700" }}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.foreground }]}>Loot Generator</Text>
        <TouchableOpacity
          onPress={pushDraftToReview}
          style={[styles.reviewButton, { backgroundColor: c.primary }]}
        >
          <Feather name="send" size={14} color={c.primaryForeground} />
          <Text style={{ color: c.primaryForeground, fontWeight: "700" }}>Review ({draft.length})</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {[
          { key: "photo_text", label: "Photo/Text", icon: "camera" },
          { key: "builder", label: "Detailed Builder", icon: "sliders" },
          { key: "tailor", label: "Tailor to Player", icon: "user-check" },
        ].map((entry) => {
          const active = tab === (entry.key as GeneratorTab);
          return (
            <TouchableOpacity
              key={entry.key}
              onPress={() => setTab(entry.key as GeneratorTab)}
              style={[
                styles.tabButton,
                {
                  borderColor: active ? c.primary : c.border,
                  backgroundColor: active ? `${c.primary}20` : c.card,
                },
              ]}
            >
              <Feather name={entry.icon as any} size={14} color={active ? c.primary : c.mutedForeground} />
              <Text style={{ color: active ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>
                {entry.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "photo_text" ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>Use Existing Loot Review Flow</Text>
            <Text style={{ color: c.mutedForeground, marginBottom: 12 }}>
              Photo analysis and free-text parsing stay in Loot Review. This tab keeps that same behavior inside Loot Generator.
            </Text>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/loot-review", params: { source: "photo" } })}
                style={[styles.actionBtn, { backgroundColor: "#4F46E5" }]}
              >
                <Feather name="camera" size={14} color="#fff" />
                <Text style={styles.actionBtnText}>Analyze Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/loot-review", params: { source: "text" } })}
                style={[styles.actionBtn, { backgroundColor: "#0EA5E9" }]}
              >
                <Feather name="type" size={14} color="#fff" />
                <Text style={styles.actionBtnText}>Parse Text</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {tab === "builder" ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: c.foreground }]}>Detailed Builder</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  onPress={() => setMode("single")}
                  style={[styles.modeChip, { backgroundColor: mode === "single" ? c.primary : c.secondary }]}
                >
                  <Text style={{ color: mode === "single" ? c.primaryForeground : c.foreground, fontWeight: "700", fontSize: 11 }}>
                    Single
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMode("batch")}
                  style={[styles.modeChip, { backgroundColor: mode === "batch" ? c.primary : c.secondary }]}
                >
                  <Text style={{ color: mode === "batch" ? c.primaryForeground : c.foreground, fontWeight: "700", fontSize: 11 }}>
                    Batch
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              value={nameFilter}
              onChangeText={setNameFilter}
              placeholder="Search by item name"
              placeholderTextColor={c.mutedForeground}
              style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]}
            />

            <Text style={[styles.label, { color: c.foreground }]}>Rarity</Text>
            <View style={styles.wrapRow}>
              {RARITIES.map((rarity) => {
                const selected = selectedRarity.includes(rarity);
                return (
                  <TouchableOpacity
                    key={rarity}
                    onPress={() => toggleSelect(selectedRarity, rarity, setSelectedRarity)}
                    style={[styles.filterChip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? `${c.primary}20` : c.background }]}
                  >
                    <Text style={{ color: selected ? c.primary : c.mutedForeground, fontSize: 11, fontWeight: "700" }}>{rarity}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: c.foreground }]}>Category</Text>
            <View style={styles.wrapRow}>
              {CATEGORIES.map((category) => {
                const selected = selectedCategory.includes(category);
                return (
                  <TouchableOpacity
                    key={category}
                    onPress={() => toggleSelect(selectedCategory, category, setSelectedCategory)}
                    style={[styles.filterChip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? `${c.primary}20` : c.background }]}
                  >
                    <Text style={{ color: selected ? c.primary : c.mutedForeground, fontSize: 11, fontWeight: "700" }}>{category}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: c.foreground }]}>Tags</Text>
            <View style={styles.wrapRow}>
              {COMMON_LOOT_TAGS.slice(0, 10).map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleSelect(selectedTags, tag, setSelectedTags)}
                    style={[styles.filterChip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? `${c.primary}20` : c.background }]}
                  >
                    <Text style={{ color: selected ? c.primary : c.mutedForeground, fontSize: 11, fontWeight: "700" }}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: c.foreground }]}>Plane Origins</Text>
            <View style={styles.wrapRow}>
              {allPlanes.slice(0, 12).map((plane) => {
                const selected = selectedPlanes.includes(plane);
                return (
                  <TouchableOpacity
                    key={plane}
                    onPress={() => toggleSelect(selectedPlanes, plane, setSelectedPlanes)}
                    style={[styles.filterChip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? `${c.primary}20` : c.background }]}
                  >
                    <Text style={{ color: selected ? c.primary : c.mutedForeground, fontSize: 11, fontWeight: "700" }}>{plane}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.card, { backgroundColor: c.background, borderColor: c.border, marginTop: 8 }]}> 
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { color: c.foreground }]}>Draft ({draft.length})</Text>
                <TouchableOpacity onPress={() => setDraft([])} style={[styles.secondaryBtn, { borderColor: c.border, backgroundColor: c.card }]}> 
                  <Text style={{ color: c.foreground, fontSize: 12, fontWeight: "700" }}>Clear</Text>
                </TouchableOpacity>
              </View>

              {draft.length === 0 ? (
                <Text style={{ color: c.mutedForeground }}>No draft items yet. Add from builder or tailor suggestions.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {draft.map((item) => (
                    (() => {
                      const summary = mechanicsSummary(item);
                      const effectLines = effectPreviewLines(item, 3);
                      const note = truncate(item.notes, 170);
                      const sourceTag = resolveSourceTag(item);
                      return (
                        <View key={item.id} style={[styles.itemRow, { borderColor: c.border }]}> 
                          <TouchableOpacity
                            style={{ flex: 1 }}
                            onPress={() => beginEditDraft(item)}
                            activeOpacity={0.85}
                          >
                            <View style={styles.itemTitleRow}>
                              <Text style={[styles.itemName, { color: c.foreground }]}>{item.name}</Text>
                              <View style={[styles.quantityBadge, { backgroundColor: `${c.primary}22` }]}>
                                <Text style={[styles.quantityBadgeText, { color: c.primary }]}>x{Math.max(1, item.quantity || 1)}</Text>
                              </View>
                              <View style={[styles.sourceBadge, { backgroundColor: sourceTag === "official" ? "#3B82F620" : "#EF444420" }]}>
                                <Text style={[styles.sourceBadgeText, { color: sourceTag === "official" ? "#3B82F6" : "#EF4444" }]}> 
                                  {sourceTag === "official" ? "OFFICIAL" : "CUSTOM"}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.itemMeta, { color: c.mutedForeground }]}> 
                              {item.category} {item.value ? `· ${item.value} gp` : ""}
                            </Text>
                            {summary.length > 0 ? (
                              <View style={styles.itemChipRow}>
                                {summary.slice(0, 4).map((chip) => (
                                  <Text key={chip} style={styles.itemChipText}>{chip}</Text>
                                ))}
                              </View>
                            ) : null}
                            {effectLines.length > 0 ? (
                              <View style={styles.effectList}>
                                {effectLines.map((line) => (
                                  <Text key={line} style={[styles.effectLineText, { color: c.mutedForeground }]}>• {line}</Text>
                                ))}
                                {item.equippedEffects && item.equippedEffects.length > effectLines.length ? (
                                  <Text style={[styles.effectMoreText, { color: c.primary }]}>+{item.equippedEffects.length - effectLines.length} more effect details</Text>
                                ) : null}
                              </View>
                            ) : null}
                            {note ? <Text style={[styles.itemNote, { color: c.mutedForeground }]}>{note}</Text> : null}
                            <Text style={[styles.editHintText, { color: c.primary }]}>Tap to edit quantity, name, rarity</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => removeFromDraft(item.id)} style={[styles.iconBtn, { borderColor: c.border }]}> 
                            <Feather name="x" size={14} color={c.mutedForeground} />
                          </TouchableOpacity>
                        </View>
                      );
                    })()
                  ))}
                </View>
              )}

              {editingDraftItem ? (
                <View style={[styles.editorCard, { borderColor: c.border, backgroundColor: c.card }]}> 
                  <Text style={[styles.label, { color: c.foreground }]}>Edit Draft Item</Text>
                  <TextInput
                    value={draftEditName}
                    onChangeText={setDraftEditName}
                    placeholder="Item name"
                    placeholderTextColor={c.mutedForeground}
                    style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]}
                  />
                  <View style={styles.rowBetween}>
                    <Text style={[styles.label, { color: c.foreground }]}>Quantity</Text>
                    <View style={styles.row}>
                      <TouchableOpacity
                        onPress={() => setDraftEditQuantity(String(Math.max(1, (Number.parseInt(draftEditQuantity, 10) || 1) - 1)))}
                        style={[styles.qtyBtn, { borderColor: c.border, backgroundColor: c.background }]}
                      >
                        <Text style={{ color: c.foreground, fontWeight: "700" }}>-</Text>
                      </TouchableOpacity>
                      <TextInput
                        value={draftEditQuantity}
                        onChangeText={setDraftEditQuantity}
                        keyboardType="number-pad"
                        style={[styles.qtyInput, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]}
                      />
                      <TouchableOpacity
                        onPress={() => setDraftEditQuantity(String((Number.parseInt(draftEditQuantity, 10) || 1) + 1))}
                        style={[styles.qtyBtn, { borderColor: c.border, backgroundColor: c.background }]}
                      >
                        <Text style={{ color: c.foreground, fontWeight: "700" }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.rowBetween}>
                    <Text style={[styles.label, { color: c.foreground }]}>Rarity</Text>
                    <TouchableOpacity
                      onPress={() => setDraftEditRarity((prev) => nextRarity(prev))}
                      style={[styles.secondaryBtn, { borderColor: c.border, backgroundColor: c.background }]}
                    >
                      <Text style={{ color: c.foreground, fontWeight: "700", fontSize: 12 }}>Bump Rarity</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.wrapRow}>
                    {RARITIES.map((rarity) => {
                      const selected = draftEditRarity === rarity;
                      return (
                        <TouchableOpacity
                          key={rarity}
                          onPress={() => setDraftEditRarity(rarity)}
                          style={[
                            styles.filterChip,
                            { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? `${c.primary}20` : c.background },
                          ]}
                        >
                          <Text style={{ color: selected ? c.primary : c.mutedForeground, fontSize: 11, fontWeight: "700" }}>{rarity}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={[styles.row, { justifyContent: "flex-end" }]}>
                    <TouchableOpacity
                      onPress={() => setEditingDraftId(null)}
                      style={[styles.secondaryBtn, { borderColor: c.border, backgroundColor: c.background }]}
                    >
                      <Text style={{ color: c.foreground, fontWeight: "700", fontSize: 12 }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={saveDraftEdit} style={[styles.primaryBtn, { backgroundColor: c.primary }]}> 
                      <Text style={{ color: c.primaryForeground, fontWeight: "700", fontSize: 12 }}>Save Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={[styles.rowBetween, { marginTop: 10 }]}> 
              <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                {filteredPool.length} matching item{filteredPool.length === 1 ? "" : "s"} available, plus custom loot in batch mode
              </Text>
              <TouchableOpacity onPress={handleGenerateLoot} style={[styles.primaryBtn, { backgroundColor: c.primary }]}> 
                <Text style={{ color: c.primaryForeground, fontWeight: "700", fontSize: 12 }}>Generate Loot</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, marginTop: 10 }}>
              {filteredPool.slice(0, 24).map((item) => {
                const exists = draftNames.has(item.name.toLowerCase());
                const summary = mechanicsSummary(item);
                const effectLines = effectPreviewLines(item, 2);
                const note = truncate(item.notes, 120);
                const sourceTag = resolveSourceTag(item);
                return (
                  <View key={item.id} style={[styles.itemRow, { borderColor: c.border }]}> 
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemTitleRow}>
                        <Text style={[styles.itemName, { color: c.foreground }]}>{item.name}</Text>
                        <View style={[styles.sourceBadge, { backgroundColor: sourceTag === "official" ? "#3B82F620" : "#EF444420" }]}>
                          <Text style={[styles.sourceBadgeText, { color: sourceTag === "official" ? "#3B82F6" : "#EF4444" }]}>
                            {sourceTag === "official" ? "OFFICIAL" : "CUSTOM"}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.itemMeta, { color: c.mutedForeground }]}> 
                        {item.category} {item.value ? `· ${item.value} gp` : ""}
                      </Text>
                      {summary.length > 0 ? (
                        <View style={styles.itemChipRow}>
                          {summary.slice(0, 3).map((chip) => (
                            <Text key={chip} style={styles.itemChipText}>{chip}</Text>
                          ))}
                        </View>
                      ) : null}
                      {effectLines.length > 0 ? (
                        <View style={styles.effectList}>
                          {effectLines.map((line) => (
                            <Text key={line} style={[styles.effectLineText, { color: c.mutedForeground }]}>• {line}</Text>
                          ))}
                          {item.equippedEffects && item.equippedEffects.length > effectLines.length ? (
                            <Text style={[styles.effectMoreText, { color: c.primary }]}>+{item.equippedEffects.length - effectLines.length} more effect details</Text>
                          ) : null}
                        </View>
                      ) : null}
                      {note ? <Text style={[styles.itemNote, { color: c.mutedForeground }]}>{note}</Text> : null}
                    </View>
                    <TouchableOpacity
                      disabled={exists}
                      onPress={() => addToDraft(item)}
                      style={[styles.addButton, { backgroundColor: exists ? c.secondary : c.primary }]}
                    >
                      <Text style={{ color: exists ? c.mutedForeground : c.primaryForeground, fontWeight: "700", fontSize: 12 }}>
                        {exists ? "Added" : "Add"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {tab === "tailor" ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>Tailor to Player</Text>
            <Text style={{ color: c.mutedForeground, marginBottom: 10 }}>
              Select any saved character, NPC, beast, or paste JSON. Local Tailor uses profile rules, while AI Tailor calls the AI parser for richer personalized suggestions.
            </Text>

            <View style={[styles.row, { marginBottom: 4 }]}>
              {(["local", "ai"] as TailorGenerationMode[]).map((generationMode) => {
                const selected = tailorGenerationMode === generationMode;
                return (
                  <TouchableOpacity
                    key={generationMode}
                    onPress={() => setTailorGenerationMode(generationMode)}
                    style={[styles.modeChip, { backgroundColor: selected ? c.primary : c.secondary }]}
                  >
                    <Text style={{ color: selected ? c.primaryForeground : c.foreground, fontWeight: "700", fontSize: 11 }}>
                      {generationMode === "ai" ? "AI Tailor" : "Local Tailor"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => setStrictTailorDiversity((prev) => !prev)}
                style={[
                  styles.filterChip,
                  {
                    borderColor: strictTailorDiversity ? c.primary : c.border,
                    backgroundColor: strictTailorDiversity ? `${c.primary}20` : c.background,
                  },
                ]}
              >
                <Text style={{ color: strictTailorDiversity ? c.primary : c.mutedForeground, fontSize: 11, fontWeight: "700" }}>
                  Strict Category Diversity
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: c.foreground, marginTop: 4 }]}>Prefer</Text>
            <View style={styles.wrapRow}>
              {TAILOR_PREFERENCES.map((preference) => {
                const selected = tailorPreferences.includes(preference);
                return (
                  <TouchableOpacity
                    key={preference}
                    onPress={() => toggleSelect(tailorPreferences, preference, setTailorPreferences)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: selected ? c.primary : c.border,
                        backgroundColor: selected ? `${c.primary}20` : c.background,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? c.primary : c.mutedForeground, fontSize: 11, fontWeight: "700" }}>
                      {preference}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.row}>
              {(["character", "npc", "beast"] as TailorEntityType[]).map((entityType) => {
                const selected = tailorEntityType === entityType;
                return (
                  <TouchableOpacity
                    key={entityType}
                    onPress={() => {
                      setTailorEntityType(entityType);
                      setSelectedTailorId(null);
                    }}
                    style={[styles.modeChip, { backgroundColor: selected ? c.primary : c.secondary }]}
                  >
                    <Text style={{ color: selected ? c.primaryForeground : c.foreground, fontWeight: "700", fontSize: 11 }}>
                      {entityType}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {tailorLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 18 }}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : (
              <View style={{ gap: 6, marginTop: 8 }}>
                {filteredTailorOptions.slice(0, 18).map((option) => {
                  const selected = selectedTailorId === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => setSelectedTailorId(option.id)}
                      style={[styles.itemRow, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? `${c.primary}14` : "transparent" }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.foreground, fontWeight: "700" }}>{option.label}</Text>
                        {option.subtitle ? (
                          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{option.subtitle}</Text>
                        ) : null}
                      </View>
                      {selected ? <Feather name="check" size={16} color={c.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              onPress={() => { void runTailorForSelected(); }}
              disabled={tailorGenerating}
              style={[styles.actionBtn, { backgroundColor: "#16A34A", marginTop: 10 }]}
            >
              {tailorGenerating ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="star" size={14} color="#fff" />}
              <Text style={styles.actionBtnText}>
                {tailorGenerating ? "Generating..." : `Generate ${tailorGenerationMode === "ai" ? "AI" : "Local"} Suggestions`}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.label, { color: c.foreground, marginTop: 12 }]}>Or Paste JSON</Text>
            <TextInput
              value={jsonInput}
              onChangeText={setJsonInput}
              placeholder='{"name":"..."}'
              placeholderTextColor={c.mutedForeground}
              multiline
              style={[
                styles.input,
                {
                  borderColor: c.border,
                  color: c.foreground,
                  backgroundColor: c.background,
                  minHeight: 84,
                  textAlignVertical: "top",
                },
              ]}
            />
            <TouchableOpacity
              onPress={() => { void runTailorForJson(); }}
              disabled={tailorGenerating}
              style={[styles.secondaryBtn, { borderColor: c.border, backgroundColor: c.background }]}
            >
              <Text style={{ color: c.foreground, fontWeight: "700", fontSize: 12 }}>
                {tailorGenerating ? "Generating..." : `Generate ${tailorGenerationMode === "ai" ? "AI" : "Local"} from JSON`}
              </Text>
            </TouchableOpacity>

            {tailorSuggestions.length > 0 ? (
              <View style={{ gap: 8, marginTop: 12 }}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.label, { color: c.foreground }]}>Suggestions ({tailorSuggestions.length})</Text>
                  <View style={[styles.row, { gap: 6 }]}>
                    <TouchableOpacity
                      onPress={handleRegenerate}
                      disabled={tailorGenerating}
                      style={[styles.secondaryBtn, { borderColor: c.border, backgroundColor: c.background }]}
                    >
                      <Text style={{ color: c.foreground, fontWeight: "700", fontSize: 12 }}>Regen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={addAllTailorSuggestions}
                      style={[styles.secondaryBtn, { borderColor: c.border, backgroundColor: c.background }]}
                    >
                      <Text style={{ color: c.foreground, fontWeight: "700", fontSize: 12 }}>Add All</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {tailorUsedFallback ? (
                  <View style={[styles.fallbackBanner, { backgroundColor: "#78350F20", borderColor: "#F59E0B" }]}>
                    <Feather name="alert-triangle" size={12} color="#F59E0B" />
                    <Text style={[styles.fallbackBannerText, { color: "#F59E0B" }]}>AI Tailor unavailable — showing Local Tailor suggestions</Text>
                  </View>
                ) : null}
                {tailorSuggestions.map((item) => {
                  const exists = draftNames.has(item.name.toLowerCase());
                  const summary = mechanicsSummary(item);
                  const effectLines = effectPreviewLines(item, 2);
                  const note = truncate(stripTailorReason(item.notes), 100);
                  const sourceTag = resolveSourceTag(item);
                  const whyReason = extractTailorReason(item.notes);
                  const itemSource = tailorItemSources[item.id];
                  return (
                    <View key={item.id} style={[styles.itemRow, { borderColor: c.border }]}> 
                      <View style={{ flex: 1 }}>
                        <View style={styles.itemTitleRow}>
                          <Text style={[styles.itemName, { color: c.foreground }]}>{item.name}</Text>
                          <View style={[styles.quantityBadge, { backgroundColor: `${c.primary}22` }]}>
                            <Text style={[styles.quantityBadgeText, { color: c.primary }]}>x{Math.max(1, item.quantity || 1)}</Text>
                          </View>
                          <View style={[styles.sourceBadge, { backgroundColor: sourceTag === "official" ? "#3B82F620" : "#EF444420" }]}>
                            <Text style={[styles.sourceBadgeText, { color: sourceTag === "official" ? "#3B82F6" : "#EF4444" }]}>
                              {sourceTag === "official" ? "OFFICIAL" : "CUSTOM"}
                            </Text>
                          </View>
                          {itemSource ? (
                            <View style={[styles.sourceBadge, { backgroundColor: itemSource === "ai" ? "#7C3AED20" : "#05966920" }]}>
                              <Text style={[styles.sourceBadgeText, { color: itemSource === "ai" ? "#7C3AED" : "#059669" }]}>
                                {itemSource === "ai" ? "AI" : "LOCAL"}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.itemMeta, { color: c.mutedForeground }]}> 
                          {item.category} {item.value ? `· ${item.value} gp` : ""}
                        </Text>
                        {whyReason ? (
                          <View style={styles.whyChipRow}>
                            <Feather name="info" size={10} color="#A78BFA" />
                            <Text style={styles.whyChipText} numberOfLines={2}>{whyReason}</Text>
                          </View>
                        ) : null}
                        {summary.length > 0 ? (
                          <View style={styles.itemChipRow}>
                            {summary.slice(0, 3).map((chip) => (
                              <Text key={chip} style={styles.itemChipText}>{chip}</Text>
                            ))}
                          </View>
                        ) : null}
                        {effectLines.length > 0 ? (
                          <View style={styles.effectList}>
                            {effectLines.map((line) => (
                              <Text key={line} style={[styles.effectLineText, { color: c.mutedForeground }]}>• {line}</Text>
                            ))}
                            {item.equippedEffects && item.equippedEffects.length > effectLines.length ? (
                              <Text style={[styles.effectMoreText, { color: c.primary }]}>+{item.equippedEffects.length - effectLines.length} more effect details</Text>
                            ) : null}
                          </View>
                        ) : null}
                        {note ? <Text style={[styles.itemNote, { color: c.mutedForeground }]}>{note}</Text> : null}
                      </View>
                      <TouchableOpacity
                        disabled={exists}
                        onPress={() => addToDraft(item)}
                        style={[styles.addButton, { backgroundColor: exists ? c.secondary : c.primary }]}
                      >
                        <Text style={{ color: exists ? c.mutedForeground : c.primaryForeground, fontWeight: "700", fontSize: 12 }}>
                          {exists ? "Added" : "Add"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  content: {
    padding: 14,
    gap: 12,
    paddingBottom: 32,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  modeChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 36,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  actionBtn: {
    flex: 1,
    minWidth: 150,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 38,
    justifyContent: "center",
  },
  primaryBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  itemRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemName: {
    fontWeight: "700",
    flexShrink: 1,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  quantityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  quantityBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  itemMeta: {
    fontSize: 12,
  },
  itemChipRow: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  itemChipText: {
    color: "#C4B5FD",
    fontSize: 10,
    borderWidth: 1,
    borderColor: "#4C1D95",
    backgroundColor: "#2E1065",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  effectList: {
    marginTop: 4,
    gap: 2,
  },
  effectLineText: {
    fontSize: 11,
    lineHeight: 16,
  },
  effectMoreText: {
    fontSize: 11,
    fontWeight: "700",
  },
  itemNote: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  editHintText: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 5,
  },
  editorCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 10,
  },
  qtyBtn: {
    borderWidth: 1,
    borderRadius: 8,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyInput: {
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 64,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },
  addButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  iconBtn: {
    borderWidth: 1,
    borderRadius: 8,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fallbackBannerText: {
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  whyChipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 4,
    backgroundColor: "#2E1065",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  whyChipText: {
    color: "#C4B5FD",
    fontSize: 10,
    lineHeight: 14,
    flex: 1,
  },
});
