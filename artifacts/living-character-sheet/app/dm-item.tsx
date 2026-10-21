import React, { useState, useCallback, createContext, useContext, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, Share, Switch, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { useHelpPopup } from "@/hooks/useHelpPopup";
import { useFilterPanelMotion } from "@/hooks/useFilterPanelMotion";
import { DEFAULT_MOTIONS, useAppSettings } from "@/context/AppSettingsContext";
import { getDmNotesPayload, upsertDmItem } from "@/utils/dmNotesStorage";
import type { Quest, NpcPerson, CampaignLocation, DmCampaignItem, DmCampaignItemLootRole } from "@/types";
import colors from "@/constants/colors";
import {
  ITEM_QUALITIES, ITEM_CATEGORIES, ITEM_TYPES, ITEM_ATTUNEMENT_REQUIREMENTS,
  QUALITY_VALUE_RANGES, RANDOM_ITEMS, generateRandomItem, roll,
  type ItemQuality,
} from "@/data/dmTables";
import type { ItemEffect, ItemEffectType, ActionType, EquippedStatKey, Open5eFeat, ItemCategory } from "@/types";
import type { ItemMechanicsBlock } from "@/types";
import { STAT_KEY_LABELS, STAT_KEY_ORDER, statBonusLabel } from "@/data/itemStats";
import { SPELL_LIST } from "@/data/spellList";
import type { SpellEntry } from "@/data/spellList";
import { findFeatureFeats, formatFeatureFeatDescription } from "@/data/featureFeats";
import { tagsForCategory, subtypesForCategory } from "@/data/itemSubtypes";
import { isConsumptionCategory, isEquippableCategory } from "@/data/itemCategoryRules";
import { ACTION_TYPE_COLORS as SEMANTIC_ACTION_TYPE_COLORS } from "@/constants/semanticColors";
import { legacyItemToItemMechanicsBlock } from "@/utils/mechanics/itemMechanicsAdapters";

interface ItemState {
  name: string;
  type: string;
  quality: ItemQuality | "";
  category: ItemCategory | "";
  subtype: string;
  tags: string[];
  value: string;
  valueCurrency: "cp" | "sp" | "gp" | "pp";
  weight: string;
  attunement: boolean;
  attunementReq: string;
  properties: string;
  description: string;
  notes: string;
  equippedEffects: ItemEffect[];
  isQuestItem: boolean;
  questName: string;
}

function emptyItem(): ItemState {
  return {
    name: "", type: "", quality: "", category: "",
    subtype: "", tags: [],
    value: "", valueCurrency: "gp",
    weight: "", attunement: false, attunementReq: "Any creature",
    properties: "", description: "", notes: "",
    equippedEffects: [],
    isQuestItem: false, questName: "",
  };
}

const ALL_CATEGORIES: { label: string; value: ItemCategory }[] = [
  { label: "Weapon", value: "weapon" },
  { label: "Armor", value: "armor" },
  { label: "Accessory", value: "accessory" },
  { label: "Magic", value: "magic" },
  { label: "Consumable", value: "consumable" },
  { label: "Gear", value: "gear" },
  { label: "Treasure", value: "treasure" },
  { label: "Map", value: "map" },
  { label: "Other", value: "other" },
];

const QUALITY_COLORS: Record<ItemQuality, string> = {
  Common: "#9CA3AF",
  Uncommon: "#10B981",
  Rare: "#3B82F6",
  "Very Rare": "#8B5CF6",
  Legendary: "#F59E0B",
  Artifact: "#EF4444",
};

const EFFECT_TYPE_LABELS: Record<ItemEffectType, string> = {
  stat_bonus: "Stat (+N)", attack_damage: "Attack", spell: "Grant Spell", buff: "Passive Buff", feature: "Feat / Feature", note: "Note",
};
const EFFECT_TYPE_COLORS: Record<ItemEffectType, string> = {
  stat_bonus: "#10B981", attack_damage: "#F97316", spell: "#8B5CF6", buff: "#3B82F6", feature: "#F59E0B", note: "#6B7280",
};
const ACTION_TYPE_CHIPS: { label: string; value: ActionType | null }[] = [
  { label: "Auto", value: null },
  { label: "Action", value: "action" },
  { label: "Bonus Action", value: "bonus_action" },
  { label: "Reaction", value: "reaction" },
  { label: "Free", value: "free" },
];
const ACTION_TYPE_COLORS: Record<ActionType, string> = {
  action: SEMANTIC_ACTION_TYPE_COLORS.action,
  bonus_action: SEMANTIC_ACTION_TYPE_COLORS.bonus_action,
  reaction: SEMANTIC_ACTION_TYPE_COLORS.reaction,
  free: SEMANTIC_ACTION_TYPE_COLORS.free,
};

type SpellTargetFilter = "all" | "self" | "touch" | "aoe";

const SPELL_LEVEL_FILTERS: Array<number | "all"> = ["all", 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const SPELL_SCHOOL_FILTERS = ["All", ...Array.from(new Set(SPELL_LIST.map((spell) => spell.school))).sort()];
const SPELL_TARGET_FILTERS: Array<{ label: string; value: SpellTargetFilter }> = [
  { label: "All", value: "all" },
  { label: "Self", value: "self" },
  { label: "Touch", value: "touch" },
  { label: "AOE", value: "aoe" },
];

const ITEM_CREATOR_HELP: Record<string, string> = {
  "Quality / Rarity": "Rarity strongly affects expected power and value range. Higher rarities should carry stronger effects or broader utility.",
  Category: "Category controls what subtypes, tags, and effect combinations make sense for this item.",
  Type: "Subtype narrows the item within its category, such as weapon family or armor class.",
  "Weapon Type": "Weapon subtype helps align effect generation and naming with the intended weapon style.",
  "Armor Type": "Armor subtype helps estimate baseline role and how defensive bonuses should be interpreted.",
  Tags: "Tags are metadata for filtering and behavior cues. Quest tags can tie items into objective workflows.",
  "Item Name": "Name is what players see in inventory, action lists, and exports. Keep it concise but descriptive.",
  Value: "Value is market-facing price. It should roughly align with rarity, category, and effect strength.",
  "Weight (lbs)": "Weight affects carrying realism and can matter for encumbrance-focused tables.",
  "Requires Attunement": "Attunement gates powerful items so characters cannot stack too many major magical effects.",
  "Properties / Effects": "Use this for mechanical behavior players need at the table: bonuses, limits, triggers, and usage rules.",
  "Flavor Description": "Flavor text is narrative presentation only: look, aura, craftsmanship, and lore texture.",
  "DM Notes": "Private creator notes for hooks, provenance, balancing rationale, or future plot tie-ins.",
};

const ItemHelpContext = createContext<(label: string, hint?: string) => void>(() => {});

function classifySpellTarget(spell: SpellEntry): Exclude<SpellTargetFilter, "all"> | "other" {
  const desc = spell.desc.toLowerCase();
  if (/(radius|cone|cube|sphere|cylinder|line|up to \d+ creatures|each creature|all creatures|creatures within|in the area)/.test(desc)) {
    return "aoe";
  }
  if (/\btouch\b/.test(desc)) {
    return "touch";
  }
  if (/^you\b|^your\b|\byou gain\b|\byour weapon\b|\bfrom you\b|\baround you\b/.test(desc)) {
    return "self";
  }
  return "other";
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Flavor text generators for when API is unavailable
const FLAVOR_ADJECTIVES = [
  "Ancient", "Arcane", "Blessed", "Corrupted", "Dwarven", "Elven", "Enchanted", "Ethereal",
  "Fey-touched", "Forged", "Gilded", "Hallowed", "Infernal", "Luminous", "Mythril", "Obsidian",
  "Runic", "Sacred", "Shadow", "Silvered", "Spectral", "Twilight", "Void-kissed", "Warded",
];
const FLAVOR_MATERIALS = [
  "bone", "crystal", "darkwood", "dragonscale", "ember-forged iron", "feywild silk",
  "frosted steel", "gold", "living oak", "midnight-alloy", "moonshard", "obsidian",
  "orichalcum", "pale stone", "phoenix feather", "runed bronze", "sea-jade", "shadowsteel",
  "starfall iron", "thunderwood", "void-iron",
];
const FLAVOR_DESCRIPTORS = [
  "bears faint glowing runes along its edges",
  "carries the chill of the Shadowfell",
  "emits a soft hum when held in moonlight",
  "feels warm to the touch, as if alive",
  "is etched with scenes of an ancient battle",
  "is said to have been wielded by a legendary hero",
  "leaves a faint silver trail in dim light",
  "pulses with a barely-contained inner radiance",
  "resonates with any who carry noble blood",
  "shifts subtly in colour depending on the bearer's mood",
];
const ITEM_PROPERTIES = [
  // Resistances & Protections
  "Grants resistance to one damage type of your choice",
  "Grants resistance to nonmagical damage",
  "Grants advantage on saves against poison",
  "Grants advantage on saves against being charmed",
  "Grants advantage on saves against being frightened",
  "Protects the wearer from extreme temperatures",
  
  // Spellcasting & Magic
  "Allows you to cast a spell once per day without expending a spell slot",
  "Allows you to cast a 1st-level spell twice per day without expending a spell slot",
  "Can store and cast a spell up to 3rd level, once per dawn",
  "Grants advantage on saving throws against spells",
  "Grants +1 to spell attack rolls and spell save DC",
  "Allows casting mage hand at will",
  "Can detect magic within 120 feet",
  
  // Ability & Attribute Enhancements
  "Increases one ability score by 1, to a maximum of 20",
  "Increases one ability score by 2, to a maximum of 20",
  "Increases the wearer's AC by 1",
  "Increases speed by 10 feet",
  "Grants proficiency in an ability check of your choice",
  
  // Hit Points & Healing
  "Provides 10 temporary hit points at dawn each day",
  "Provides 15 temporary hit points when first attuned",
  "Grants resistance to necrotic damage and heals 1d4 hit points at dawn",
  "Once per day, regain hit points equal to your proficiency bonus",
  
  // Languages & Skills
  "Lets you speak and understand an extra language",
  "Speaks and understands all languages",
  "Grants a bonus to one type of skill check (+2)",
  "Grants advantage on Stealth checks",
  "Grants advantage on Perception checks",
  "Grants advantage on Insight checks",
  "Grants advantage on Deception checks",
  
  // Perception & Senses
  "Grants darkvision up to 60 feet",
  "Grants darkvision up to 120 feet",
  "Allows seeing in magical darkness",
  "Allows seeing invisible creatures within 10 feet",
  "Can sense the presence of magic within 30 feet",
  "Grants truesight in 60-foot radius",
  
  // Combat-Related
  "Grants +1 to attack rolls made with this weapon",
  "Grants +1 to damage rolls made with this weapon",
  "Never needs sharpening",
  "Glows in the presence of undead within 60 feet",
  "Can be thrown and returns to your hand",
  "Dreams of its wielder appear in your mind when attuned",
  
  // Utility & Movement
  "Grants the ability to cast feather fall once per day",
  "Grants the ability to cast misty step twice per day",
  "Allows climbing any surface as if proficient",
  "Allows underwater breathing",
  "Grants telepathy with creatures within 60 feet",
  
  // Miscellaneous
  "Weighs nothing to you when attuned",
  "Never accumulates dust or grime",
  "Cannot be stolen if you are attuned to it",
  "Can summon a familiar once per week",
  "Grants luck—reroll one failed saving throw per day",
  "Imparts proficiency in a weapon of your choice",
  "Grants immunity to one disease",
  "Cannot be destroyed by ordinary means",
];

function randomFlavorDescription(itemName: string): string {
  const adjective = FLAVOR_ADJECTIVES[Math.floor(Math.random() * FLAVOR_ADJECTIVES.length)];
  const material = FLAVOR_MATERIALS[Math.floor(Math.random() * FLAVOR_MATERIALS.length)];
  const descriptor = FLAVOR_DESCRIPTORS[Math.floor(Math.random() * FLAVOR_DESCRIPTORS.length)];
  return `${adjective} ${itemName.toLowerCase()} crafted from ${material}, this piece ${descriptor}.`;
}

function randomItemProperty(): string {
  return ITEM_PROPERTIES[Math.floor(Math.random() * ITEM_PROPERTIES.length)];
}

// Return multiple properties based on rarity
function randomItemPropertiesByRarity(quality: ItemQuality | ""): string {
  if (!quality) return "";
  
  const propertyCount = {
    Common: 0,
    Uncommon: 1,
    Rare: 1,
    "Very Rare": 2,
    Legendary: 3,
    Artifact: 4,
  }[quality] || 0;
  
  if (propertyCount === 0) return "";
  
  const selected: string[] = [];
  const available = [...ITEM_PROPERTIES];
  
  for (let i = 0; i < propertyCount && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    selected.push(available[idx]);
    available.splice(idx, 1);
  }
  
  return selected.join("\n• ");
}

function buildPropertiesFromEffects(effects: ItemEffect[]): string {
  if (effects.length === 0) return "";
  return effects
    .map((effect) => {
      const desc = effect.description?.trim();
      return desc ? `• ${effect.label}: ${desc}` : `• ${effect.label}`;
    })
    .join("\n");
}

// Generate random equipped effects based on rarity
function generateRandomEffectsByRarity(quality: ItemQuality | "", category: ItemCategory | ""): ItemEffect[] {
  if (!quality) return [];
  
  const effectChances = {
    Common: { count: 0, baseChance: 0 },
    Uncommon: { count: 0, baseChance: 0.3 },
    Rare: { count: 1, baseChance: 1 },
    "Very Rare": { count: 2, baseChance: 0.8 },
    Legendary: { count: 3, baseChance: 0.9 },
    Artifact: { count: 4, baseChance: 1 },
  }[quality] || { count: 0, baseChance: 0 };
  
  const effects: ItemEffect[] = [];
  
  // Determine actual effect count for lower rarities
  let actualCount = effectChances.count;
  if (quality === "Uncommon" || quality === "Very Rare") {
    actualCount = Math.random() < effectChances.baseChance ? effectChances.count + 1 : effectChances.count;
  }
  
  const effectTypesByCategory: Record<string, ItemEffectType[]> = {
    weapon: ["stat_bonus", "attack_damage", "spell", "buff", "feature", "note"],
    armor: ["stat_bonus", "buff", "feature", "spell", "note"],
    accessory: ["stat_bonus", "buff", "feature", "spell", "note"],
    magic: ["stat_bonus", "buff", "feature", "spell", "note"],
    consumable: ["spell", "buff", "feature", "note", "stat_bonus"],
    map: ["feature", "note", "spell"],
    treasure: ["feature", "note"],
    gear: ["feature", "note", "buff"],
    other: ["feature", "note", "buff"],
    quest: ["feature", "note", "spell"],
  };
  const effectTypes: ItemEffectType[] = effectTypesByCategory[category] ?? ["feature", "note", "buff"];
  const actionTypes: (ActionType | null)[] = [null, "action", "bonus_action", "reaction", "free"];
  
  const effectLabels = [
    "Strength Boost", "Dexterity Enhancement", "Constitution Fortitude", "Intelligence Sharpening", "Wisdom Insight", "Charisma Presence",
    "Arcane Surge", "Elemental Warding", "Shadow Cloak", "Divine Protection", "Blessed Form",
    "Weapon Enhancement", "Armor Reinforcement", "Speed Surge", "Insight Clarity", "Spell Amplification",
    "Fire Resistance", "Cold Resistance", "Lightning Resistance", "Poison Resistance", "Healing Aura",
  ];

    const effectDescriptions = [
      "While attuned to or equipped with this item, you gain advantage on Strength checks and saving throws.",
      "Gain +2 to Dexterity (AC). Reflex and dodge become second nature.",
      "Resistance to magical and non-magical damage. Your constitution is bolstered.",
      "Gain advantage on all Intelligence (Arcana) checks. Forbidden knowledge becomes clear.",
      "Gain advantage on Wisdom (Perception) checks. Your senses are heightened.",
      "Gain advantage on Charisma (Persuasion) checks. You command attention and respect.",
      "When you cast a spell, you gain +1 to your spell attack rolls.",
      "You have resistance to a specific damage type while wearing this item.",
      "While this item is worn, you can hide as a bonus action even when exposed.",
      "You gain 1d4 temporary hit points at the start of each of your turns.",
      "Once per day as a bonus action, you can bless yourself or an ally nearby.",
      "Attacks made with this weapon or while wearing this item gain +1 to damage rolls.",
      "Gain +1 to AC from this armor or defensive item.",
      "Your walking speed increases by 10 feet while attuned or equipped.",
      "Gain advantage on Wisdom (Insight) checks to understand creatures' intentions.",
      "When you cast a spell, you can add 1 to the spell's damage roll.",
      "You have resistance to fire damage.",
      "You have resistance to cold damage.",
      "You have resistance to lightning damage.",
      "You have resistance to poison damage.",
      "As a bonus action, you can restore 1d4 + your proficiency bonus hit points to yourself or a nearby creature.",
    ];
  
  for (let i = 0; i < actualCount; i++) {
    const type = effectTypes[Math.floor(Math.random() * effectTypes.length)];
    let labelIndex = Math.floor(Math.random() * effectLabels.length);
    let label = effectLabels[labelIndex];
    let attempts = 0;
    while (effects.some((effect) => effect.label === label) && attempts < 8) {
      labelIndex = Math.floor(Math.random() * effectLabels.length);
      label = effectLabels[labelIndex];
      attempts += 1;
    }
    const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
    const description = effectDescriptions[labelIndex];
    
    effects.push({
      id: generateId(),
      type,
      label,
      description,
      actionType: actionType ?? undefined,
    });
  }
  
  return effects;
}

export default function DmItemScreen() {
  const c = useColors();
  const { settings } = useAppSettings();
  const insets = useSafeAreaInsets();
  const { showHelp, helpPopup } = useHelpPopup();
  const [item, setItem] = useState<ItemState>(emptyItem);
  const [section, setSection] = useState<"basic" | "details" | "quest">("basic");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [effectType, setEffectType] = useState<ItemEffectType>("stat_bonus");
  const [effectLabel, setEffectLabel] = useState("");
  const [effectDesc, setEffectDesc] = useState("");
  const [effectActionType, setEffectActionType] = useState<ActionType | null>(null);
  const [effectMaxTargets, setEffectMaxTargets] = useState("");
  const [effectStatKey, setEffectStatKey] = useState<EquippedStatKey | null>(null);
  const [effectStatMagnitude, setEffectStatMagnitude] = useState("1");
  const [effectStatSign, setEffectStatSign] = useState<"+" | "-">("+");
  const [effectSpell, setEffectSpell] = useState("");
  const [effectAtkDice, setEffectAtkDice] = useState("");
  const [effectAtkDmgType, setEffectAtkDmgType] = useState("");
  const [effectAtkDamageMagnitude, setEffectAtkDamageMagnitude] = useState("1");
  const [effectAtkDamageSign, setEffectAtkDamageSign] = useState<"+" | "-">("+");
  const [effectAtkToHitMagnitude, setEffectAtkToHitMagnitude] = useState("0");
  const [effectAtkToHitSign, setEffectAtkToHitSign] = useState<"+" | "-">("+");
  const [effectBuffStatKey, setEffectBuffStatKey] = useState<"ac" | "initiative">("ac");
  const [effectBuffVal, setEffectBuffVal] = useState("1");
  const [effectFeatureEntry, setEffectFeatureEntry] = useState<Open5eFeat | null>(null);
  const [effectSpellEntry, setEffectSpellEntry] = useState<SpellEntry | null>(null);
  const [effectSpellUses, setEffectSpellUses] = useState("1");
  const [effectSpellResetOn, setEffectSpellResetOn] = useState<"short_rest" | "long_rest" | "dawn">("long_rest");
  const [effectSpellLevelFilter, setEffectSpellLevelFilter] = useState<number | "all">("all");
  const [effectSpellSchoolFilter, setEffectSpellSchoolFilter] = useState("All");
  const [effectSpellTargetFilter, setEffectSpellTargetFilter] = useState<SpellTargetFilter>("all");
  const [showEffectSpellFilters, setShowEffectSpellFilters] = useState(false);
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);
  const [editEffectLabel, setEditEffectLabel] = useState("");
  const [editEffectDesc, setEditEffectDesc] = useState("");
  const [editEffectType, setEditEffectType] = useState<ItemEffectType>("buff");
  const [editEffectActionType, setEditEffectActionType] = useState<ActionType | null>(null);
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [questInputValue, setQuestInputValue] = useState("");
  const [showExportJson, setShowExportJson] = useState(false);
  const [exportJsonString, setExportJsonString] = useState("");

  // Quest Tie-In state
  const [dmQuests, setDmQuests] = useState<Quest[]>([]);
  const [dmPeople, setDmPeople] = useState<NpcPerson[]>([]);
  const [dmLocations, setDmLocations] = useState<CampaignLocation[]>([]);
  const [linkedQuestIds, setLinkedQuestIds] = useState<string[]>([]);
  const [linkedPeopleIds, setLinkedPeopleIds] = useState<string[]>([]);
  const [linkedLocationIds, setLinkedLocationIds] = useState<string[]>([]);
  const [lootRole, setLootRole] = useState<DmCampaignItemLootRole>("loot");
  const [saveToNotesBusy, setSaveToNotesBusy] = useState(false);
  const [savedToNotesId, setSavedToNotesId] = useState<string | null>(null);
  const motionIntensity = settings.motionIntensity ?? "full";
  const motionsEnabled = settings.motions?.enabled ?? DEFAULT_MOTIONS.enabled;
  const motionEnabled =
    motionsEnabled &&
    motionIntensity !== "off" &&
    (settings.motions?.itemCreatorSectionTransition ?? DEFAULT_MOTIONS.itemCreatorSectionTransition);
  const motionDuration = motionIntensity === "subtle" ? 130 : 210;
  const useNativeDriver = Platform.OS !== "web";
  const sectionAnim = useRef(new Animated.Value(1)).current;
  const { filterPanelAnimatedStyle } = useFilterPanelMotion(showEffectSpellFilters, settings);

  const set = useCallback((key: keyof ItemState, val: unknown) => {
    setItem((prev) => ({ ...prev, [key]: val }));
  }, []);

  const resetEffectFields = useCallback(() => {
    setEffectLabel(""); setEffectDesc(""); setEffectActionType(null);
    setEffectMaxTargets("");
    setEffectStatKey(null); setEffectStatMagnitude("1"); setEffectStatSign("+");
    setEffectSpell(""); setEffectAtkDice(""); setEffectAtkDmgType("");
    setEffectAtkDamageMagnitude("1"); setEffectAtkDamageSign("+");
    setEffectAtkToHitMagnitude("0"); setEffectAtkToHitSign("+");
    setEffectBuffStatKey("ac"); setEffectBuffVal("1");
    setEffectFeatureEntry(null);
    setEffectSpellEntry(null);
    setEffectSpellUses("1");
    setEffectSpellResetOn("long_rest");
    setEffectSpellLevelFilter("all");
    setEffectSpellSchoolFilter("All");
    setEffectSpellTargetFilter("all");
    setShowEffectSpellFilters(false);
  }, []);

  const filteredSpellOptions = SPELL_LIST.filter((spell) => {
    const search = effectSpell.trim().toLowerCase();
    if (search && !spell.name.toLowerCase().includes(search)) return false;
    if (effectSpellLevelFilter !== "all" && spell.level !== effectSpellLevelFilter) return false;
    if (effectSpellSchoolFilter !== "All" && spell.school !== effectSpellSchoolFilter) return false;
    if (effectSpellTargetFilter !== "all" && classifySpellTarget(spell) !== effectSpellTargetFilter) return false;
    return true;
  }).slice(0, 24);
  const filteredFeatureOptions = findFeatureFeats(effectLabel, 10);

  const handleAddEffect = useCallback(() => {
    let newEffect: ItemEffect | null = null;
    const maxTargets = effectMaxTargets.trim().length > 0
      ? Math.max(1, parseInt(effectMaxTargets, 10) || 1)
      : undefined;

    if (effectType === "spell") {
      const spellName = effectSpellEntry?.name || effectSpell.trim();
      if (!spellName) return;
      const uses = Math.max(1, parseInt(effectSpellUses, 10) || 1);
      newEffect = {
        id: generateId(),
        type: "spell",
        label: `${spellName} ${uses}/day`,
        description: effectSpellEntry?.desc || effectDesc.trim() || undefined,
        actionType: effectActionType || undefined,
        maxTargets,
        uses,
        resetOn: effectSpellResetOn,
      };
    } else if (effectType === "stat_bonus") {
      if (!effectStatKey) return;
      const magnitude = Math.max(1, parseInt(effectStatMagnitude, 10) || 1);
      const statValue = effectStatSign === "-" ? -magnitude : magnitude;
      newEffect = {
        id: generateId(),
        type: "stat_bonus",
        label: statBonusLabel(effectStatKey, statValue),
        description: effectDesc.trim() || undefined,
        actionType: effectActionType || undefined,
        maxTargets,
        statKey: effectStatKey,
        statValue,
      };
    } else if (effectType === "attack_damage") {
      const attackDamageDice = effectAtkDice.trim();
      if (!attackDamageDice || !effectAtkDmgType.trim()) return;
      const damageMagnitude = Math.max(1, parseInt(effectAtkDamageMagnitude, 10) || 1);
      const attackDamageBonus = effectAtkDamageSign === "-" ? -damageMagnitude : damageMagnitude;
      const toHitMagnitude = Math.max(0, parseInt(effectAtkToHitMagnitude, 10) || 0);
      const attackToHitBonus = toHitMagnitude === 0 ? 0 : (effectAtkToHitSign === "-" ? -toHitMagnitude : toHitMagnitude);
      const labelParts = [`${attackDamageDice}${attackDamageBonus !== 0 ? (attackDamageBonus > 0 ? `+${attackDamageBonus}` : `${attackDamageBonus}`) : ""} ${effectAtkDmgType.trim()}`];
      if (attackToHitBonus !== 0) {
        labelParts.push(`${attackToHitBonus >= 0 ? "+" : ""}${attackToHitBonus} to hit`);
      }
      newEffect = {
        id: generateId(),
        type: "attack_damage",
        label: `Attack: ${labelParts.join(", ")}`,
        description: effectDesc.trim() || undefined,
        actionType: effectActionType || undefined,
        maxTargets,
        attackDamageDice,
        attackDamageBonus,
        attackDamageType: effectAtkDmgType.trim(),
        attackToHitBonus,
      };
    } else if (effectType === "feature") {
      const featureLabel = effectLabel.trim();
      if (!featureLabel) return;
      newEffect = {
        id: generateId(),
        type: "feature",
        label: featureLabel,
        description: effectDesc.trim() || undefined,
        actionType: effectActionType || undefined,
        maxTargets,
      };
    } else {
      if (!effectLabel.trim()) return;
      newEffect = {
        id: generateId(),
        type: effectType,
        label: effectLabel.trim(),
        description: effectDesc.trim() || undefined,
        actionType: effectActionType || undefined,
        maxTargets,
      };
    }

    setItem((prev) => {
      const nextEffects = [...prev.equippedEffects, newEffect];
      return {
        ...prev,
        equippedEffects: nextEffects,
        properties: buildPropertiesFromEffects(nextEffects),
      };
    });
    resetEffectFields();
    setEffectType("stat_bonus");
  }, [effectLabel, effectDesc, effectType, effectActionType, effectMaxTargets, effectSpellEntry, effectSpell, effectSpellUses, effectSpellResetOn, effectStatKey, effectStatMagnitude, effectStatSign, effectAtkDice, effectAtkDmgType, effectAtkDamageMagnitude, effectAtkDamageSign, effectAtkToHitMagnitude, effectAtkToHitSign, resetEffectFields]);

  const handleRemoveEffect = useCallback((effectId: string) => {
    setItem((prev) => {
      const nextEffects = prev.equippedEffects.filter((e) => e.id !== effectId);
      return {
        ...prev,
        equippedEffects: nextEffects,
        properties: buildPropertiesFromEffects(nextEffects),
      };
    });
  }, []);

  const openEditEffect = useCallback((effect: ItemEffect) => {
    setEditingEffectId(effect.id);
    setEditEffectLabel(effect.label);
    setEditEffectDesc(effect.description || "");
    setEditEffectType(effect.type);
    setEditEffectActionType(effect.actionType || null);
  }, []);

  const handleSaveEffect = useCallback(() => {
    setItem((prev) => {
      const nextEffects = prev.equippedEffects.map((e) =>
        e.id === editingEffectId
          ? { ...e, label: editEffectLabel, description: editEffectDesc || undefined, type: editEffectType, actionType: editEffectActionType || undefined }
          : e
      );
      return {
        ...prev,
        equippedEffects: nextEffects,
        properties: buildPropertiesFromEffects(nextEffects),
      };
    });
    setEditingEffectId(null);
  }, [editingEffectId, editEffectLabel, editEffectDesc, editEffectType, editEffectActionType]);

  const generateItemPropertiesWithAi = useCallback(async (itemToGenerate: ItemState) => {
    setIsGeneratingAi(true);
    try {
      const response = await fetch("http://localhost:3000/api/ai/item-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            name: itemToGenerate.name,
            quality: itemToGenerate.quality,
            category: itemToGenerate.category,
            type: itemToGenerate.type,
            value: parseInt(itemToGenerate.value),
            weight: itemToGenerate.weight ? parseFloat(itemToGenerate.weight) : undefined,
            attunement: itemToGenerate.attunement,
            attunementReq: itemToGenerate.attunement ? itemToGenerate.attunementReq : undefined,
            notes: itemToGenerate.notes,
            equippedEffects: itemToGenerate.equippedEffects.map((effect) => ({
              type: effect.type,
              label: effect.label,
              description: effect.description,
              actionType: effect.actionType,
            })),
          },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { description?: string };
        const syncedProperties = buildPropertiesFromEffects(itemToGenerate.equippedEffects);
        setItem((prev) => ({
          ...prev,
          properties: syncedProperties,
          description: data.description || prev.description,
        }));
        setIsGeneratingAi(false);
        return;
      }
    } catch (err) {
      console.warn("AI generation error:", err);
    }

    // Fallback: keep mechanical effects synced and synthesize only flavor description.
    const properties = buildPropertiesFromEffects(itemToGenerate.equippedEffects);
    const description = randomFlavorDescription(itemToGenerate.name);
    setItem((prev) => ({
      ...prev,
      properties: properties || prev.properties,
      description: description || prev.description,
    }));
    setIsGeneratingAi(false);
  }, []);

  const randomizeItem = useCallback((options?: { preserveQuality?: boolean; preserveCategory?: boolean; preserveName?: boolean }) => {
    // Step 1: Resolve rarity/quality
    const rolledQuality: ItemQuality = options?.preserveQuality && item.quality
      ? item.quality
      : roll(ITEM_QUALITIES);
    
    // Step 2: Resolve category
    const allCategories: ItemCategory[] = ["weapon", "armor", "accessory", "magic", "consumable", "gear", "treasure", "map", "other"];
    const rolledCategory: ItemCategory = options?.preserveCategory && item.category
      ? item.category
      : roll(allCategories);
    
    // Step 3: Generate random item name and value for this quality + category combo
    const gen = generateRandomItem(
      rolledQuality,
      (rolledCategory.charAt(0).toUpperCase() + rolledCategory.slice(1)) as Parameters<typeof generateRandomItem>[1]
    );
    const categoryLower = rolledCategory;
    const resolvedName = options?.preserveName && item.name.trim() ? item.name.trim() : gen.name;
    
    // Step 4: Roll subtype based on the rolled category, preferring types that match the item name
    const availableSubtypes = subtypesForCategory(categoryLower);
    let rolledSubtype = "";
    
    if (availableSubtypes.length > 0) {
      // Try to match item name to available subtypes (case-insensitive)
      const itemNameLower = resolvedName.toLowerCase();
      const matchedSubtypes = availableSubtypes.filter((subtype) =>
        itemNameLower.includes(subtype.toLowerCase())
      );
      
      // Prefer matched subtypes, fall back to random if none match
      rolledSubtype = matchedSubtypes.length > 0 ? roll(matchedSubtypes) : roll(availableSubtypes);
    }
    
    // Step 5: Roll tags based on the rolled category (0-3 tags)
    const availableTags = tagsForCategory(categoryLower);
    const tagCount = Math.floor(Math.random() * 4); // 0, 1, 2, or 3
    const rolledTags: string[] = [];
    const tagsCopy = [...availableTags];
    for (let i = 0; i < tagCount && tagsCopy.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * tagsCopy.length);
      rolledTags.push(tagsCopy[randomIndex]);
      tagsCopy.splice(randomIndex, 1);
    }
    
    // Step 6: Determine attunement (less likely for common items)
    const needsAttunement = categoryLower !== "consumable" && gen.quality !== "Common" && Math.random() > 0.35;
    
    // Step 7: Roll attunement requirement if needed
    const attuneChoices = ITEM_ATTUNEMENT_REQUIREMENTS.filter((r) => r !== "None");
    const rolledAttunementReq = needsAttunement ? roll(attuneChoices) : "Any creature";

    // Step 8: Generate random effects based on rarity
    const rolledEffects = generateRandomEffectsByRarity(gen.quality, categoryLower);
    const rolledProperties = buildPropertiesFromEffects(rolledEffects);

    // Assemble the fully randomized item
    const newItem = {
      name: resolvedName,
      quality: gen.quality,
      category: categoryLower,
      subtype: rolledSubtype,
      tags: rolledTags,
      value: String(gen.value),
      valueCurrency: "gp" as const,
      attunement: needsAttunement,
      attunementReq: rolledAttunementReq,
      properties: rolledProperties,
      description: "",
      type: item.type,
      weight: item.weight,
      notes: item.notes,
      equippedEffects: rolledEffects,
      isQuestItem: item.isQuestItem,
      questName: item.questName,
    };

    setItem((prev) => ({ ...prev, ...newItem }));

    // Trigger AI generation for properties and description
    generateItemPropertiesWithAi(newItem);
  }, [item, generateItemPropertiesWithAi]);

  const rollTheRest = useCallback(() => {
    randomizeItem({
      preserveQuality: !!item.quality,
      preserveCategory: !!item.category,
      preserveName: !!item.name.trim(),
    });
  }, [item.quality, item.category, item.name, randomizeItem]);

  const handleExport = useCallback(() => {
    // Export as JSON format that can be imported to inventory
    const existingMechanics = (item as ItemState & { mechanics?: ItemMechanicsBlock }).mechanics;
    const hasLegacyMechanicsContent = item.equippedEffects.length > 0;
    const synthesizedMechanics = hasLegacyMechanicsContent
      ? legacyItemToItemMechanicsBlock({
          mechanics: existingMechanics,
          name: item.name,
          equippedEffects: item.equippedEffects,
          notes: item.properties || item.notes || undefined,
        })
      : undefined;
    const mechanics = existingMechanics ?? synthesizedMechanics;
    const exportData = [
      {
        id: "dm-" + Date.now(),
        name: item.name,
        quantity: 1,
        equipped: false,
        category: item.category,
        notes: item.notes || undefined,
        weight: item.weight ? parseFloat(item.weight) : undefined,
        value: item.value ? parseFloat(item.value) : undefined,
        equippedEffects: isEquippableItem && item.equippedEffects.length > 0 ? item.equippedEffects.map((effect) => ({
          id: effect.id,
          type: effect.type,
          label: effect.label,
          description: effect.description || undefined,
          actionType: effect.actionType || undefined,
          statKey: effect.statKey,
          statValue: effect.statValue,
          attackDamageDice: effect.attackDamageDice,
          attackDamageBonus: effect.attackDamageBonus,
          attackDamageType: effect.attackDamageType,
          attackToHitBonus: effect.attackToHitBonus,
          uses: effect.uses,
          resetOn: effect.resetOn,
          resourceName: effect.resourceName,
          resourceMaxBonus: effect.resourceMaxBonus,
        })) : undefined,
        consumptionEffects: isConsumableItem && item.equippedEffects.length > 0 ? item.equippedEffects.map((effect) => ({
          id: effect.id,
          type: effect.type,
          label: effect.label,
          description: effect.description || undefined,
          actionType: effect.actionType || undefined,
          statKey: effect.statKey,
          statValue: effect.statValue,
          attackDamageDice: effect.attackDamageDice,
          attackDamageBonus: effect.attackDamageBonus,
          attackDamageType: effect.attackDamageType,
          attackToHitBonus: effect.attackToHitBonus,
          uses: effect.uses,
          resetOn: effect.resetOn,
          resourceName: effect.resourceName,
          resourceMaxBonus: effect.resourceMaxBonus,
        })) : undefined,
        subtype: item.subtype || undefined,
        tags: item.tags.length > 0 ? item.tags : undefined,
        // DM-specific fields
        quality: item.quality || undefined,
        attunement: isEquippableItem && item.attunement ? item.attunementReq : undefined,
        properties: item.properties || undefined,
        description: item.description || undefined,
        isQuestItem: item.isQuestItem ? true : undefined,
        questName: item.questName || undefined,
        mechanics: mechanics && (existingMechanics || hasLegacyMechanicsContent) ? mechanics : undefined,
        // Canonical weapon fields — bridge attack_damage effects to flat item weapon slots.
        // These are required for import-time compatibility projections and legacy fallback paths.
        ...(() => {
          if (item.category !== "weapon") return {};
          const atkEffect = item.equippedEffects.find((e) => e.type === "attack_damage");
          if (!atkEffect) return {};
          return {
            damageDice: atkEffect.attackDamageDice || undefined,
            damageModifier: typeof atkEffect.attackDamageBonus === "number" ? atkEffect.attackDamageBonus : undefined,
            damageType: atkEffect.attackDamageType || undefined,
          };
        })(),
      },
    ];
    
    const jsonString = JSON.stringify(exportData, null, 2);
    setExportJsonString(jsonString);
    setShowExportJson(true);
    try {
      const shareRequest = Share.share({ message: jsonString });
      shareRequest.catch(() => {
        // Web may not support native share; JSON modal is the fallback.
      });
    } catch {
      // Ignore unsupported share errors; raw JSON remains visible in modal.
    }
  }, [item, item.properties, item.notes]);

  const handleClear = useCallback(() => {
    setItem(emptyItem());
    setEditingEffectId(null);
    setShowQuestModal(false);
    setQuestInputValue("");
    setLinkedQuestIds([]);
    setLinkedPeopleIds([]);
    setLinkedLocationIds([]);
    setLootRole("loot");
    setSavedToNotesId(null);
  }, []);

  useEffect(() => {
    getDmNotesPayload().then((payload) => {
      setDmQuests(payload.quests);
      setDmPeople(payload.people);
      setDmLocations(payload.locations);
    }).catch(() => {});
  }, []);

  const handleSaveToNotes = useCallback(async () => {
    if (!item.name.trim()) return;
    setSaveToNotesBusy(true);
    try {
      const input: Partial<DmCampaignItem> = {
        id: savedToNotesId ?? undefined,
        name: item.name.trim(),
        quality: item.quality || undefined,
        category: item.category || undefined,
        subtype: item.subtype || undefined,
        tags: item.tags.length > 0 ? item.tags : undefined,
        value: item.value || undefined,
        valueCurrency: item.valueCurrency || undefined,
        weight: item.weight || undefined,
        attunement: item.attunement || undefined,
        attunementReq: item.attunement ? item.attunementReq : undefined,
        properties: item.properties || undefined,
        description: item.description || undefined,
        notes: item.notes || undefined,
        questTags: linkedQuestIds.length > 0 ? linkedQuestIds : undefined,
        peopleTags: linkedPeopleIds.length > 0 ? linkedPeopleIds : undefined,
        locationTags: linkedLocationIds.length > 0 ? linkedLocationIds : undefined,
        lootRole,
      };
      const saved = await upsertDmItem(input);
      setSavedToNotesId(saved.id);
    } catch {
      // ignore
    } finally {
      setSaveToNotesBusy(false);
    }
  }, [item, linkedQuestIds, linkedPeopleIds, linkedLocationIds, lootRole, savedToNotesId]);

  const topPad = Platform.OS === "web" ? 16 : insets.top;

  const TABS = [
    { id: "basic", label: "Item" },
    { id: "details", label: "Details" },
    { id: "quest", label: "Quest Tie-In" },
  ] as const;

  const qColor = item.quality ? QUALITY_COLORS[item.quality] : c.primary;
  const isConsumableItem = item.category ? isConsumptionCategory(item.category as ItemCategory) : false;
  const isEquippableItem = item.category ? isEquippableCategory(item.category) : true;
  const showFieldHelp = useCallback((label: string, hint?: string) => {
    const body = ITEM_CREATOR_HELP[label] ?? ITEM_CREATOR_HELP[label.replace(/\s*\(.+\)$/, "")] ?? hint ?? "This field controls part of the generated item behavior or metadata.";
    showHelp(label, body);
  }, [showHelp]);

  useEffect(() => {
    if (!motionEnabled) {
      sectionAnim.setValue(1);
      return;
    }
    sectionAnim.setValue(0);
    Animated.timing(sectionAnim, {
      toValue: 1,
      duration: motionDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [motionDuration, motionEnabled, section, sectionAnim, useNativeDriver]);

  return (
    <ItemHelpContext.Provider value={showFieldHelp}>
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: c.border, backgroundColor: c.card }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={c.foreground} />
          </TouchableOpacity>
          <View style={[styles.headerTitleWrap, { flexShrink: 1 }]}>
            <Text style={[styles.headerTitle, { color: c.foreground }]} numberOfLines={1} ellipsizeMode="tail">Item Creator</Text>
            <Text style={[styles.headerSub, { color: c.mutedForeground }]} numberOfLines={1} ellipsizeMode="tail">
              {item.name || "Custom or random item"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => randomizeItem()}
            disabled={isGeneratingAi}
            style={[styles.randomBtn, { backgroundColor: qColor, opacity: isGeneratingAi ? 0.6 : 1 }]}
          >
            <Feather name="shuffle" size={14} color="#fff" />
            <Text style={styles.randomBtnText}>{isGeneratingAi ? "Generating..." : "Roll All"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerActionsRow}>
        <TouchableOpacity
          onPress={rollTheRest}
          disabled={isGeneratingAi}
          style={[styles.randomBtn, { backgroundColor: qColor, opacity: isGeneratingAi ? 0.6 : 1 }]}
        >
          <Feather name="refresh-cw" size={14} color="#fff" />
          <Text style={styles.randomBtnText}>{isGeneratingAi ? "Generating..." : "Roll the Rest"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleClear}
          style={[styles.randomBtn, { backgroundColor: c.destructive }]}
        >
          <Feather name="trash-2" size={14} color="#fff" />
          <Text style={styles.randomBtnText}>Clear All</Text>
        </TouchableOpacity>
        </View>
      </View>

      {/* Section tabs */}
      <View style={[styles.tabRow, { borderBottomColor: c.border, backgroundColor: c.card }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setSection(t.id)}
            style={[styles.tab, { borderBottomColor: section === t.id ? c.primary : "transparent" }]}
          >
            <Text style={[styles.tabText, { color: section === t.id ? c.primary : c.mutedForeground }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollHintScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}> 
        <Animated.View
          style={{
            opacity: sectionAnim,
            transform: [
              {
                translateY: sectionAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [motionIntensity === "subtle" ? 4 : 8, 0],
                }),
              },
            ],
          }}
        >
        {section === "basic" && (
          <View style={styles.section}>
            {/* Quality picker */}
            <FieldRow label="Quality / Rarity">
              <View style={styles.qualityRow}>
                {ITEM_QUALITIES.map((q) => (
                  <TouchableOpacity
                    key={q}
                    onPress={() => set("quality", item.quality === q ? "" : q)}
                    style={[
                      styles.qualityChip,
                      {
                        backgroundColor: item.quality === q ? QUALITY_COLORS[q] + "30" : c.card,
                        borderColor: item.quality === q ? QUALITY_COLORS[q] : c.border,
                      },
                    ]}
                  >
                    <Text style={[styles.qualityText, { color: item.quality === q ? QUALITY_COLORS[q] : c.mutedForeground }]}>
                      {q}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FieldRow>

            {/* Category picker */}
            <FieldRow label="Category">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
                <View style={styles.chipRow}>
                  {ALL_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      onPress={() => set("category", item.category === cat.value ? "" : cat.value)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: item.category === cat.value ? c.primary + "25" : c.card,
                          borderColor: item.category === cat.value ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: item.category === cat.value ? c.primary : c.mutedForeground }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </FieldRow>

            {/* Subtype picker */}
            {subtypesForCategory(item.category).length > 0 && (
              <FieldRow label={item.category === "weapon" ? "Weapon Type" : item.category === "armor" ? "Armor Type" : "Type"}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => set("subtype", "")}
                    style={[styles.chip, {
                      backgroundColor: item.subtype === "" ? c.muted : c.card,
                      borderColor: item.subtype === "" ? c.mutedForeground : c.border,
                    }]}
                  >
                    <Text style={[styles.chipText, { color: item.subtype === "" ? c.foreground : c.mutedForeground }]}>None</Text>
                  </TouchableOpacity>
                  {subtypesForCategory(item.category).map((sub) => (
                    <TouchableOpacity
                      key={sub}
                      onPress={() => set("subtype", item.subtype === sub ? "" : sub)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: item.subtype === sub ? c.primary + "25" : c.card,
                          borderColor: item.subtype === sub ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: item.subtype === sub ? c.primary : c.mutedForeground }]}>{sub}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FieldRow>
            )}

            {/* Tags */}
            {(tagsForCategory(item.category).length > 0 || true) && (
              <FieldRow label="Tags">
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {[...tagsForCategory(item.category), "Quest"].map((tag) => {
                    const selected = tag === "Quest" ? item.isQuestItem : item.tags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => {
                          if (tag === "Quest") {
                            setQuestInputValue(item.questName);
                            setShowQuestModal(true);
                          } else {
                            set("tags", selected ? item.tags.filter((t) => t !== tag) : [...item.tags, tag]);
                          }
                        }}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
                          backgroundColor: selected ? c.primary + "20" : c.card,
                          borderWidth: 1,
                          borderColor: selected ? c.primary : c.border,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? c.primary : c.mutedForeground }}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </FieldRow>
            )}

            {/* Item Name */}
            <FieldRow label="Item Name">
              <View style={styles.inputRow}>
                <NiceInput
                  value={item.name}
                  onChange={(v) => set("name", v)}
                  placeholder="e.g. Cloak of Elvenkind, Severed Foot of Fortune…"
                />
                <TouchableOpacity
                  onPress={() => randomizeItem()}
                  style={[styles.rollBtn, { backgroundColor: qColor + "30", borderColor: qColor + "80" }]}
                >
                  <Text style={{ fontSize: 18 }}>🎲</Text>
                </TouchableOpacity>
              </View>
            </FieldRow>

            {/* Value */}
            <FieldRow label="Value">
              <View style={styles.inputRow}>
                <NiceInput
                  value={item.value}
                  onChange={(v) => set("value", v)}
                  placeholder="Amount"
                  numeric
                  style={{ width: 100 }}
                />
                <View style={styles.currencyRow}>
                  {(["cp", "sp", "gp", "pp"] as const).map((cur) => (
                    <TouchableOpacity
                      key={cur}
                      onPress={() => set("valueCurrency", cur)}
                      style={[
                        styles.currencyChip,
                        {
                          backgroundColor: item.valueCurrency === cur ? c.primary + "25" : c.card,
                          borderColor: item.valueCurrency === cur ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: item.valueCurrency === cur ? c.primary : c.mutedForeground }]}>
                        {cur}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {item.quality && (
                <Text style={[styles.hint, { color: c.mutedForeground }]}>
                  Typical {item.quality}: {QUALITY_VALUE_RANGES[item.quality][0].toLocaleString()}–{QUALITY_VALUE_RANGES[item.quality][1].toLocaleString()} gp
                </Text>
              )}
            </FieldRow>

            {/* Weight */}
            <FieldRow label="Weight (lbs)">
              <NiceInput
                value={item.weight}
                onChange={(v) => set("weight", v)}
                placeholder="e.g. 0.5"
                numeric
                style={{ width: 100 }}
              />
            </FieldRow>

            {/* Attunement */}
            <FieldRow label="Requires Attunement">
              <View style={styles.switchRow}>
                <Switch
                  value={item.attunement}
                  onValueChange={(v) => set("attunement", v)}
                  trackColor={{ false: c.border, true: c.primary + "80" }}
                  thumbColor={item.attunement ? c.primary : c.mutedForeground}
                />
                {item.attunement && (
                  <View style={styles.chipRow}>
                    {ITEM_ATTUNEMENT_REQUIREMENTS.map((req) => (
                      <TouchableOpacity
                        key={req}
                        onPress={() => set("attunementReq", req)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: item.attunementReq === req ? c.primary + "25" : c.card,
                            borderColor: item.attunementReq === req ? c.primary : c.border,
                          },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: item.attunementReq === req ? c.primary : c.mutedForeground }]}>
                          {req}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </FieldRow>
          </View>
        )}

        {section === "details" && (
          <View style={styles.section}>
            <FieldRow label="Properties / Effects" hint="Describe exactly what the item does — no rules limits!">
              <NiceInput
                value={item.properties}
                onChange={(v) => set("properties", v)}
                placeholder={"e.g. Grants 3 bonus actions per day.\nWhile wearing this, you generate 100 gp at dawn.\nYou smell faintly of cinnamon (no game effect)."}
                multiline
                style={{ minHeight: 140 }}
              />
            </FieldRow>

            <FieldRow label="Flavor Description" hint="How does it look, smell, feel?">
              <NiceInput
                value={item.description}
                onChange={(v) => set("description", v)}
                placeholder="A gnarled foot, severed at the ankle, preserved with some arcane art…"
                multiline
                style={{ minHeight: 100 }}
              />
            </FieldRow>

            <FieldRow label="DM Notes">
              <NiceInput
                value={item.notes}
                onChange={(v) => set("notes", v)}
                placeholder="Quest hooks, lore, who made it, where it was found…"
                multiline
                style={{ minHeight: 80 }}
              />
            </FieldRow>

            {/* Equipped Effects */}
            <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16, gap: 8 }}>
              <Text style={[styles.sectionTitle, { color: c.foreground }]}>{isConsumableItem ? "Consumption Effects" : "Equipped Effects"}</Text>
              <Text style={[styles.sectionHint, { color: c.mutedForeground }]}>
                {isConsumableItem
                  ? "Effects that trigger when this item is consumed"
                  : (isEquippableItem
                    ? "Bonuses, spells, or buffs active while this item is equipped"
                    : "Item effects that apply while carrying or using this item")}
              </Text>

              {item.equippedEffects.map((effect) => {
                const isEditing = editingEffectId === effect.id;
                const actionColor = effect.actionType ? ACTION_TYPE_COLORS[effect.actionType] : null;
                return (
                  <View key={effect.id}>
                    <View style={[styles.effectItem, { backgroundColor: c.secondary, borderRadius: 8, padding: 12, gap: 8 }]}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <View style={{ flex: 1, gap: 6 }}>
                          <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap" }}>
                            <View style={[styles.effectTypePill, { backgroundColor: EFFECT_TYPE_COLORS[effect.type] + "30", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                              <Text style={[styles.effectTypeText, { color: EFFECT_TYPE_COLORS[effect.type], fontSize: 11, fontWeight: "600" }]}>
                                {EFFECT_TYPE_LABELS[effect.type]}
                              </Text>
                            </View>
                            {actionColor && (
                              <View style={[styles.effectTypePill, { backgroundColor: actionColor + "25", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                                <Text style={[styles.effectTypeText, { color: actionColor, fontSize: 11, fontWeight: "600" }]}>
                                  {ACTION_TYPE_CHIPS.find((chip) => chip.value === effect.actionType)?.label ?? effect.actionType}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.effectItemLabel, { color: c.foreground, fontSize: 14, fontWeight: "600" }]}>{effect.label}</Text>
                          {effect.description && !isEditing && (
                            <Text style={[styles.effectItemDesc, { color: c.mutedForeground, fontSize: 12 }]}>{effect.description}</Text>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          <TouchableOpacity
                            onPress={() => isEditing ? setEditingEffectId(null) : openEditEffect(effect)}
                            style={[styles.removeEffectBtn, { backgroundColor: isEditing ? c.primary + "30" : c.muted, width: 32, height: 32, borderRadius: 6, alignItems: "center", justifyContent: "center" }]}
                            activeOpacity={0.7}
                          >
                            <Feather name={isEditing ? "chevron-up" : "edit-2"} size={12} color={isEditing ? c.primary : c.mutedForeground} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemoveEffect(effect.id)}
                            style={[styles.removeEffectBtn, { backgroundColor: c.muted, width: 32, height: 32, borderRadius: 6, alignItems: "center", justifyContent: "center" }]}
                            activeOpacity={0.7}
                          >
                            <Feather name="x" size={12} color={c.destructive} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {isEditing && (
                        <View style={{ marginTop: 8, gap: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
                          <TextInput
                            value={editEffectLabel}
                            onChangeText={setEditEffectLabel}
                            placeholder="Effect label"
                            placeholderTextColor={c.mutedForeground}
                            style={[styles.input, { backgroundColor: c.muted, color: c.foreground }]}
                          />
                          <TextInput
                            value={editEffectDesc}
                            onChangeText={setEditEffectDesc}
                            placeholder="Description (optional)"
                            placeholderTextColor={c.mutedForeground}
                            multiline
                            numberOfLines={2}
                            style={[styles.input, { backgroundColor: c.muted, color: c.foreground, minHeight: 60, textAlignVertical: "top" }]}
                          />
                          <View>
                            <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Effect Type</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              <View style={{ flexDirection: "row", gap: 6 }}>
                                {(Object.keys(EFFECT_TYPE_LABELS) as ItemEffectType[]).map((t) => (
                                  <TouchableOpacity
                                    key={t}
                                    onPress={() => setEditEffectType(t)}
                                    style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: editEffectType === t ? EFFECT_TYPE_COLORS[t] : c.muted, borderRadius: 6 }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: editEffectType === t ? "#fff" : c.mutedForeground }}>
                                      {EFFECT_TYPE_LABELS[t]}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </ScrollView>
                          </View>
                          <View>
                            <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Used As (Action)</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              <View style={{ flexDirection: "row", gap: 6 }}>
                                {ACTION_TYPE_CHIPS.map(({ label, value }) => {
                                  const col = value ? ACTION_TYPE_COLORS[value] : c.mutedForeground;
                                  const active = editEffectActionType === value;
                                  return (
                                    <TouchableOpacity
                                      key={label}
                                      onPress={() => setEditEffectActionType(value)}
                                      style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: active ? col + "30" : c.muted, borderRadius: 6, borderWidth: active ? 1 : 0, borderColor: active ? col : "transparent" }}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={{ fontSize: 11, fontWeight: "700", color: active ? col : c.mutedForeground }}>
                                        {label}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </ScrollView>
                          </View>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => setEditingEffectId(null)}
                              style={{ flex: 1, padding: 10, borderRadius: 6, backgroundColor: c.muted, alignItems: "center" }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 13, fontWeight: "600", color: c.mutedForeground }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={handleSaveEffect}
                              style={{ flex: 2, padding: 10, borderRadius: 6, backgroundColor: c.primary, alignItems: "center" }}
                              activeOpacity={0.8}
                            >
                              <Text style={{ fontSize: 13, fontWeight: "700", color: c.primaryForeground }}>Save Changes</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}

              <View style={{ backgroundColor: c.secondary, borderRadius: 8, padding: 12, gap: 8 }}>
                <Text style={[styles.fieldLabel, { color: c.foreground, marginBottom: 0 }]}>Add Effect</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {(Object.keys(EFFECT_TYPE_LABELS) as ItemEffectType[]).map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => { setEffectType(t); resetEffectFields(); }}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: effectType === t ? EFFECT_TYPE_COLORS[t] : c.muted, borderRadius: 6 }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: effectType === t ? "#fff" : c.mutedForeground }}>
                          {EFFECT_TYPE_LABELS[t]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {effectType !== "stat_bonus" && (
                  <TextInput
                    value={effectType === "spell" ? effectSpell : effectLabel}
                    onChangeText={(v) => {
                      if (effectType === "spell") {
                        setEffectSpell(v);
                        setEffectSpellEntry(null);
                      } else {
                        setEffectLabel(v);
                        if (effectType === "feature") {
                          setEffectFeatureEntry(null);
                        }
                      }
                    }}
                    placeholder={
                      effectType === "spell"
                        ? "Search spell (e.g. Misty Step, Shield, Fireball)"
                        : effectType === "feature"
                          ? "Search feats or type a custom feature"
                          : "Effect label (e.g. 'Grants +2 AC')"
                    }
                    placeholderTextColor={c.mutedForeground}
                    style={[styles.input, { backgroundColor: c.muted, color: c.foreground }]}
                  />
                )}

                {effectType === "stat_bonus" && (
                  <View style={{ backgroundColor: c.muted, borderRadius: 8, padding: 10, gap: 10, borderWidth: 1, borderColor: c.border }}>
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Stat</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {STAT_KEY_ORDER.map((key) => {
                          const active = effectStatKey === key;
                          return (
                            <TouchableOpacity
                              key={key}
                              onPress={() => setEffectStatKey(key)}
                              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: active ? "#10B981" : c.card }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : c.mutedForeground }}>{STAT_KEY_LABELS[key]}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Modifier</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => setEffectStatSign((prev) => prev === "+" ? "-" : "+")}
                          style={{ width: 42, height: 38, borderRadius: 8, backgroundColor: c.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: c.foreground, fontSize: 18, fontWeight: "800" }}>{effectStatSign}</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={effectStatMagnitude}
                          onChangeText={(value) => setEffectStatMagnitude(value.replace(/[^0-9]/g, "") || "")}
                          keyboardType="number-pad"
                          placeholder="N"
                          placeholderTextColor={c.mutedForeground}
                          style={[styles.input, { width: 72, textAlign: "center", backgroundColor: c.card, color: c.foreground, paddingVertical: 8 }]}
                        />
                        <Text style={{ color: c.mutedForeground, fontSize: 12, flex: 1 }}>
                          {effectStatKey ? statBonusLabel(effectStatKey, (effectStatSign === "-" ? -1 : 1) * Math.max(1, parseInt(effectStatMagnitude || "1", 10) || 1)) : "Choose a stat first"}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {effectType === "spell" && (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowEffectSpellFilters((prev) => !prev)}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderWidth: 1,
                        borderColor: showEffectSpellFilters ? c.primary : c.border,
                        backgroundColor: showEffectSpellFilters ? c.primary + "14" : c.muted,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Feather name="filter" size={13} color={showEffectSpellFilters ? c.primary : c.mutedForeground} />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: showEffectSpellFilters ? c.primary : c.mutedForeground }}>
                          Spell Filters
                        </Text>
                      </View>
                      <Feather name={showEffectSpellFilters ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
                    </TouchableOpacity>

                    {showEffectSpellFilters && (
                      <Animated.View
                        style={{
                          ...filterPanelAnimatedStyle,
                          gap: 10,
                        }}
                      >
                        <View>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Level</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: "row", gap: 6 }}>
                              {SPELL_LEVEL_FILTERS.map((level) => {
                                const active = effectSpellLevelFilter === level;
                                const label = level === "all" ? "All" : level === 0 ? "Cantrip" : `Lv ${level}`;
                                return (
                                  <TouchableOpacity
                                    key={String(level)}
                                    onPress={() => setEffectSpellLevelFilter(level)}
                                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: active ? "#8B5CF6" : c.muted }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : c.mutedForeground }}>{label}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </ScrollView>
                        </View>

                        <View>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>School</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: "row", gap: 6 }}>
                              {SPELL_SCHOOL_FILTERS.map((school) => {
                                const active = effectSpellSchoolFilter === school;
                                return (
                                  <TouchableOpacity
                                    key={school}
                                    onPress={() => setEffectSpellSchoolFilter(school)}
                                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: active ? "#8B5CF6" : c.muted }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : c.mutedForeground }}>{school}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </ScrollView>
                        </View>

                        <View>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Target Style</Text>
                          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                            {SPELL_TARGET_FILTERS.map(({ label, value }) => {
                              const active = effectSpellTargetFilter === value;
                              return (
                                <TouchableOpacity
                                  key={value}
                                  onPress={() => setEffectSpellTargetFilter(value)}
                                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: active ? "#8B5CF6" : c.muted }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : c.mutedForeground }}>{label}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </Animated.View>
                    )}
                  </>
                )}

                {effectType === "spell" && !effectSpellEntry && (() => {
                  if (filteredSpellOptions.length === 0) {
                    return (
                      <View style={{ backgroundColor: c.muted, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10 }}>
                        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>No spells match the current search and filters.</Text>
                      </View>
                    );
                  }

                  return (
                    <View style={{ backgroundColor: c.muted, borderRadius: 8, borderWidth: 1, borderColor: c.border, maxHeight: 180 }}>
                      <ScrollView>
                        {filteredSpellOptions.map((sp) => (
                          <TouchableOpacity
                            key={sp.name}
                            onPress={() => {
                              setEffectSpellEntry(sp);
                              setEffectSpell(sp.name);
                              setEffectDesc(sp.desc);
                            }}
                            style={{ paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: c.foreground, fontSize: 13, fontWeight: "700" }}>{sp.name}</Text>
                            <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                              {sp.level === 0 ? "Cantrip" : `Level ${sp.level}`} - {sp.school} - {classifySpellTarget(sp) === "other" ? "Single/Other" : classifySpellTarget(sp).toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  );
                })()}

                {effectType === "spell" && effectSpellEntry && (
                  <View style={{ backgroundColor: c.muted, borderRadius: 8, padding: 10, gap: 8, borderWidth: 1, borderColor: c.border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ color: c.foreground, fontSize: 13, fontWeight: "700" }}>{effectSpellEntry.name}</Text>
                        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{effectSpellEntry.level === 0 ? "Cantrip" : `Level ${effectSpellEntry.level}`} - {effectSpellEntry.school}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setEffectSpellEntry(null);
                          setEffectSpell("");
                        }}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: c.card }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: c.mutedForeground, fontSize: 11, fontWeight: "700" }}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: c.mutedForeground, fontSize: 11 }} numberOfLines={3}>{effectSpellEntry.desc}</Text>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: c.foreground, fontSize: 12, fontWeight: "600" }}>Uses / Day</Text>
                      <TouchableOpacity
                        onPress={() => setEffectSpellUses(String(Math.max(1, (parseInt(effectSpellUses, 10) || 1) - 1)))}
                        style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.card, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ color: c.foreground, fontSize: 14, fontWeight: "700" }}>-</Text>
                      </TouchableOpacity>
                      <TextInput
                        value={effectSpellUses}
                        onChangeText={setEffectSpellUses}
                        keyboardType="number-pad"
                        style={[styles.input, { width: 56, textAlign: "center", backgroundColor: c.card, color: c.foreground, paddingVertical: 6 }]}
                      />
                      <TouchableOpacity
                        onPress={() => setEffectSpellUses(String((parseInt(effectSpellUses, 10) || 1) + 1))}
                        style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.card, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ color: c.foreground, fontSize: 14, fontWeight: "700" }}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Resets On</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {[
                          { label: "Short Rest", value: "short_rest" as const },
                          { label: "Long Rest", value: "long_rest" as const },
                          { label: "Dawn", value: "dawn" as const },
                        ].map(({ label, value }) => (
                          <TouchableOpacity
                            key={label}
                            onPress={() => setEffectSpellResetOn(value)}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: effectSpellResetOn === value ? "#8B5CF6" : c.card }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: effectSpellResetOn === value ? "#fff" : c.mutedForeground }}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {effectType === "feature" && !effectFeatureEntry && effectLabel.trim().length >= 1 && (
                  filteredFeatureOptions.length === 0 ? (
                    <View style={{ backgroundColor: c.muted, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10 }}>
                      <Text style={{ color: c.mutedForeground, fontSize: 12 }}>No feats match that search. Keep typing to add a custom feature instead.</Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: c.muted, borderRadius: 8, borderWidth: 1, borderColor: c.border, maxHeight: 220 }}>
                      <ScrollView>
                        {filteredFeatureOptions.map((feat) => (
                          <TouchableOpacity
                            key={feat.slug}
                            onPress={() => {
                              setEffectFeatureEntry(feat);
                              setEffectLabel(feat.name);
                              setEffectDesc(formatFeatureFeatDescription(feat));
                            }}
                            style={{ paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: c.foreground, fontSize: 13, fontWeight: "700" }}>{feat.name}</Text>
                            <Text style={{ color: c.mutedForeground, fontSize: 11 }} numberOfLines={2}>
                              {feat.prerequisites ? `${feat.prerequisites} - ` : ""}{feat.desc}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )
                )}

                {effectType === "feature" && effectFeatureEntry && (
                  <View style={{ backgroundColor: c.muted, borderRadius: 8, padding: 10, gap: 8, borderWidth: 1, borderColor: c.border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ color: c.foreground, fontSize: 13, fontWeight: "700" }}>{effectFeatureEntry.name}</Text>
                        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{effectFeatureEntry.reference_abr ?? "PHB feat"}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setEffectFeatureEntry(null);
                          setEffectLabel("");
                          setEffectDesc("");
                        }}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: c.card }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: c.mutedForeground, fontSize: 11, fontWeight: "700" }}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: c.mutedForeground, fontSize: 11 }} numberOfLines={4}>{formatFeatureFeatDescription(effectFeatureEntry)}</Text>
                  </View>
                )}

                {effectType === "attack_damage" && (
                  <View style={{ backgroundColor: c.muted, borderRadius: 8, padding: 10, gap: 10, borderWidth: 1, borderColor: c.border }}>
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Hit Die</Text>
                      <TextInput
                        value={effectAtkDice}
                        onChangeText={setEffectAtkDice}
                        placeholder="e.g. 1d4"
                        placeholderTextColor={c.mutedForeground}
                        style={[styles.input, { backgroundColor: c.card, color: c.foreground }]}
                      />
                    </View>

                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Damage Type</Text>
                      <TextInput
                        value={effectAtkDmgType}
                        onChangeText={setEffectAtkDmgType}
                        placeholder="e.g. fire, force, lightning"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={[styles.input, { backgroundColor: c.card, color: c.foreground }]}
                      />
                    </View>

                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Damage Modifier</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => setEffectAtkDamageSign((prev) => prev === "+" ? "-" : "+")}
                          style={{ width: 42, height: 38, borderRadius: 8, backgroundColor: c.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: c.foreground, fontSize: 18, fontWeight: "800" }}>{effectAtkDamageSign}</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={effectAtkDamageMagnitude}
                          onChangeText={(value) => setEffectAtkDamageMagnitude(value.replace(/[^0-9]/g, "") || "")}
                          keyboardType="number-pad"
                          placeholder="N"
                          placeholderTextColor={c.mutedForeground}
                          style={[styles.input, { width: 72, textAlign: "center", backgroundColor: c.card, color: c.foreground, paddingVertical: 8 }]}
                        />
                        <Text style={{ color: c.mutedForeground, fontSize: 12, flex: 1 }}>
                          {`${effectAtkDice || "XdY"}${(effectAtkDamageSign === "-" ? -1 : 1) * Math.max(1, parseInt(effectAtkDamageMagnitude || "1", 10) || 1) !== 0 ? ((effectAtkDamageSign === "-" ? -1 : 1) * Math.max(1, parseInt(effectAtkDamageMagnitude || "1", 10) || 1) > 0 ? `+${(effectAtkDamageSign === "-" ? -1 : 1) * Math.max(1, parseInt(effectAtkDamageMagnitude || "1", 10) || 1)}` : `${(effectAtkDamageSign === "-" ? -1 : 1) * Math.max(1, parseInt(effectAtkDamageMagnitude || "1", 10) || 1)}`) : ""} ${effectAtkDmgType || "damage"}`}
                        </Text>
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>To Hit Modifier</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => setEffectAtkToHitSign((prev) => prev === "+" ? "-" : "+")}
                          style={{ width: 42, height: 38, borderRadius: 8, backgroundColor: c.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: c.foreground, fontSize: 18, fontWeight: "800" }}>{effectAtkToHitSign}</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={effectAtkToHitMagnitude}
                          onChangeText={(value) => setEffectAtkToHitMagnitude(value.replace(/[^0-9]/g, "") || "")}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={c.mutedForeground}
                          style={[styles.input, { width: 72, textAlign: "center", backgroundColor: c.card, color: c.foreground, paddingVertical: 8 }]}
                        />
                        <Text style={{ color: c.mutedForeground, fontSize: 12, flex: 1 }}>
                          {`${Math.max(0, parseInt(effectAtkToHitMagnitude || "0", 10) || 0) === 0 ? "+0" : ((effectAtkToHitSign === "-" ? -1 : 1) * Math.max(0, parseInt(effectAtkToHitMagnitude || "0", 10) || 0) > 0 ? `+${(effectAtkToHitSign === "-" ? -1 : 1) * Math.max(0, parseInt(effectAtkToHitMagnitude || "0", 10) || 0)}` : `${(effectAtkToHitSign === "-" ? -1 : 1) * Math.max(0, parseInt(effectAtkToHitMagnitude || "0", 10) || 0)}`)} to hit`}
                        </Text>
                      </View>
                    </View>

                    <TextInput
                      value={effectDesc}
                      onChangeText={setEffectDesc}
                      placeholder="Description (optional)"
                      placeholderTextColor={c.mutedForeground}
                      multiline
                      numberOfLines={2}
                      style={[styles.input, { backgroundColor: c.card, color: c.foreground, minHeight: 60, textAlignVertical: "top" }]}
                    />
                  </View>
                )}

                {effectType !== "spell" && effectType !== "stat_bonus" && effectType !== "attack_damage" && (
                  <TextInput
                    value={effectDesc}
                    onChangeText={setEffectDesc}
                    placeholder="Description (optional)"
                    placeholderTextColor={c.mutedForeground}
                    multiline
                    numberOfLines={2}
                    style={[styles.input, { backgroundColor: c.muted, color: c.foreground, minHeight: 60, textAlignVertical: "top" }]}
                  />
                )}

                <View>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Used As (Action)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {ACTION_TYPE_CHIPS.map(({ label, value }) => {
                        const col = value ? ACTION_TYPE_COLORS[value] : c.mutedForeground;
                        const active = effectActionType === value;
                        return (
                          <TouchableOpacity
                            key={label}
                            onPress={() => setEffectActionType(value)}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: active ? col + "30" : c.muted, borderRadius: 6, borderWidth: active ? 1 : 0, borderColor: active ? col : "transparent" }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: active ? col : c.mutedForeground }}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {effectActionType && (
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", marginBottom: 6 }}>Max Targets</Text>
                    <TextInput
                      value={effectMaxTargets}
                      onChangeText={(value) => setEffectMaxTargets(value.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad"
                      placeholder="Leave blank for any"
                      placeholderTextColor={c.mutedForeground}
                      style={[styles.input, { backgroundColor: c.muted, color: c.foreground }]}
                    />
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleAddEffect}
                  disabled={effectType === "spell" ? !(effectSpellEntry || effectSpell.trim()) : effectType === "stat_bonus" ? !effectStatKey : effectType === "attack_damage" ? !(effectAtkDice.trim() && effectAtkDmgType.trim()) : !effectLabel.trim()}
                  style={{
                    padding: 11,
                    borderRadius: 6,
                    backgroundColor: (effectType === "spell" ? (effectSpellEntry || effectSpell.trim()) : effectType === "stat_bonus" ? effectStatKey : effectType === "attack_damage" ? (effectAtkDice.trim() && effectAtkDmgType.trim()) : effectLabel.trim()) ? c.primary : c.muted,
                    alignItems: "center",
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: (effectType === "spell" ? (effectSpellEntry || effectSpell.trim()) : effectType === "stat_bonus" ? effectStatKey : effectType === "attack_damage" ? (effectAtkDice.trim() && effectAtkDmgType.trim()) : effectLabel.trim()) ? c.primaryForeground : c.mutedForeground,
                    }}
                  >
                    Add Effect
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Live preview card */}
            {item.name ? (
              <View style={[styles.previewCard, { backgroundColor: c.card, borderColor: qColor, borderLeftWidth: 4 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text style={[styles.previewName, { color: c.foreground }]}>{item.name}</Text>
                  {item.quality && (
                    <View style={[styles.qualityBadge, { backgroundColor: QUALITY_COLORS[item.quality] + "25" }]}>
                      <Text style={[styles.qualityBadgeText, { color: QUALITY_COLORS[item.quality] }]}>
                        {item.quality}
                      </Text>
                    </View>
                  )}
                  {item.attunement && (
                    <View style={[styles.qualityBadge, { backgroundColor: c.primary + "20" }]}>
                      <Text style={[styles.qualityBadgeText, { color: c.primary }]}>Attunement</Text>
                    </View>
                  )}
                </View>

                {item.type && <Text style={[styles.previewMeta, { color: c.mutedForeground }]}>{item.type}{item.category ? ` · ${item.category}` : ""}</Text>}
                {item.value && <Text style={[styles.previewMeta, { color: c.mutedForeground }]}>Value: {item.value} {item.valueCurrency}{item.weight ? ` · ${item.weight} lbs` : ""}</Text>}
                {item.properties ? (
                  <Text style={[styles.previewProp, { color: c.foreground }]}>{item.properties}</Text>
                ) : null}
                {item.description ? (
                  <Text style={[styles.previewDesc, { color: c.mutedForeground }]}>{item.description}</Text>
                ) : null}

              {item.equippedEffects.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, textTransform: "uppercase" }}>{isConsumableItem ? "Consumption Effects" : "Equipped Effects"}</Text>
                  {item.equippedEffects.map((effect) => (
                    <View key={effect.id} style={{ backgroundColor: EFFECT_TYPE_COLORS[effect.type] + "15", borderLeftWidth: 2, borderLeftColor: EFFECT_TYPE_COLORS[effect.type], paddingLeft: 8, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: c.foreground }}>{effect.label}</Text>
                      {effect.description && <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }} numberOfLines={2}>{effect.description}</Text>}
                    </View>
                  ))}
                </View>
              )}
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleExport}
              style={[styles.bigBtn, { backgroundColor: c.primary }]}
            >
              <Feather name="share-2" size={18} color="#fff" />
              <Text style={styles.bigBtnText}>Share / Export</Text>
            </TouchableOpacity>
          </View>
        )}

        {section === "quest" && (
          <View style={styles.section}>
            <View style={[styles.questTieInIntro, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.fieldLabel, { color: c.foreground }]}>Quest Tie-In (Optional)</Text>
              <Text style={[styles.hint, { color: c.mutedForeground }]}>Link this item to quests, people, or locations and save it to DM notes.</Text>
            </View>

            {/* Loot role */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: c.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Item Role</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["quest_item", "reward", "loot", "other"] as DmCampaignItemLootRole[]).map((role) => {
                  const labels: Record<DmCampaignItemLootRole, string> = { quest_item: "Quest Item", reward: "Reward", loot: "Loot", other: "Other" };
                  const selected = lootRole === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      onPress={() => setLootRole(role)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + "22" : c.card }}
                    >
                      <Text style={{ color: selected ? c.primary : c.mutedForeground, fontSize: 12, fontWeight: "600" }}>{labels[role]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {dmQuests.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>Quests ({linkedQuestIds.length} linked)</Text>
                <View style={styles.chipRow}>
                {dmQuests.map((quest) => {
                  const selected = linkedQuestIds.includes(quest.id);
                  return (
                    <TouchableOpacity
                      key={quest.id}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "22" : c.card,
                        },
                      ]}
                      onPress={() => setLinkedQuestIds((prev) => selected ? prev.filter((id) => id !== quest.id) : [...prev, quest.id])}
                    >
                      <Text style={[styles.chipText, { color: selected ? c.primary : c.mutedForeground }]}>{quest.name}</Text>
                    </TouchableOpacity>
                  );
                })}
                </View>
              </View>
            )}

            {dmPeople.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>People ({linkedPeopleIds.length} linked)</Text>
                <View style={styles.chipRow}>
                {dmPeople.map((person) => {
                  const selected = linkedPeopleIds.includes(person.id);
                  return (
                    <TouchableOpacity
                      key={person.id}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "22" : c.card,
                        },
                      ]}
                      onPress={() => setLinkedPeopleIds((prev) => selected ? prev.filter((id) => id !== person.id) : [...prev, person.id])}
                    >
                      <Text style={[styles.chipText, { color: selected ? c.primary : c.mutedForeground }]}>{person.name}</Text>
                    </TouchableOpacity>
                  );
                })}
                </View>
              </View>
            )}

            {dmLocations.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>Locations ({linkedLocationIds.length} linked)</Text>
                <View style={styles.chipRow}>
                {dmLocations.map((loc) => {
                  const selected = linkedLocationIds.includes(loc.id);
                  return (
                    <TouchableOpacity
                      key={loc.id}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "22" : c.card,
                        },
                      ]}
                      onPress={() => setLinkedLocationIds((prev) => selected ? prev.filter((id) => id !== loc.id) : [...prev, loc.id])}
                    >
                      <Text style={[styles.chipText, { color: selected ? c.primary : c.mutedForeground }]}>{loc.name}</Text>
                    </TouchableOpacity>
                  );
                })}
                </View>
              </View>
            )}

            {dmQuests.length === 0 && dmPeople.length === 0 && dmLocations.length === 0 && (
              <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 16 }}>
                No quests, people, or locations found. Create them in the campaign journal first.
              </Text>
            )}

            <TouchableOpacity
              onPress={handleSaveToNotes}
              disabled={saveToNotesBusy || !item.name.trim()}
              style={[styles.bigBtn, { backgroundColor: savedToNotesId ? "#10B981" : c.primary, opacity: (!item.name.trim() || saveToNotesBusy) ? 0.5 : 1 }]}
            >
              <Feather name={savedToNotesId ? "check" : "bookmark"} size={18} color="#fff" />
              <Text style={styles.bigBtnText}>
                {saveToNotesBusy ? "Saving…" : savedToNotesId ? "Saved to DM Notes" : "Save to DM Notes"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        </Animated.View>
      </ScrollHintScrollView>

      {/* Export JSON Modal */}
      <Modal
        visible={showExportJson}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportJson(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: c.card, borderRadius: 12, padding: 16, width: "88%", maxWidth: 700, maxHeight: "78%", borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: c.foreground, marginBottom: 8 }}>Exported Raw JSON</Text>
            <Text style={{ fontSize: 12, color: c.mutedForeground, marginBottom: 10 }}>
              Copy and paste this JSON into Inventory import or anywhere else.
            </Text>

            <ScrollView style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, backgroundColor: c.secondary }}>
              <Text
                selectable
                style={{ color: c.foreground, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12, lineHeight: 18, padding: 12 }}
              >
                {exportJsonString}
              </Text>
            </ScrollView>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setShowExportJson(false)}
                style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, backgroundColor: c.primary }}
              >
                <Text style={{ color: c.primaryForeground, fontWeight: "700", fontSize: 13 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quest Modal */}
      <Modal
        visible={showQuestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuestModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: "#2a2a2a", borderRadius: 12, padding: 20, width: "80%", maxWidth: 350 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 12 }}>Quest Item Name</Text>
            <TextInput
              value={questInputValue}
              onChangeText={setQuestInputValue}
              placeholder="Enter quest name..."
              placeholderTextColor="#888"
              style={{
                borderWidth: 1,
                borderColor: "#555",
                borderRadius: 8,
                padding: 10,
                color: "#fff",
                fontSize: 14,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
              <TouchableOpacity
                onPress={() => setShowQuestModal(false)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 6,
                  backgroundColor: "#555",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (questInputValue.trim()) {
                    setItem((prev) => ({
                      ...prev,
                      isQuestItem: true,
                      questName: questInputValue.trim(),
                    }));
                  }
                  setShowQuestModal(false);
                  setQuestInputValue("");
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 6,
                  backgroundColor: "#6366f1",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {helpPopup}
    </View>
    </ItemHelpContext.Provider>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const c = useColors();
  const openHelp = useContext(ItemHelpContext);
  return (
    <View style={styles.fieldRow}>
      <TouchableOpacity onLongPress={() => openHelp(label, hint)} delayLongPress={380} activeOpacity={0.85}>
        <Text style={[styles.fieldLabel, { color: c.foreground }]}>{label}</Text>
      </TouchableOpacity>
      {hint && <Text style={[styles.hint, { color: c.mutedForeground }]}>{hint}</Text>}
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}

function NiceInput({
  value, onChange, placeholder, multiline, numeric, style,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  multiline?: boolean; numeric?: boolean; style?: object;
}) {
  const c = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.mutedForeground}
      multiline={multiline}
      keyboardType={numeric ? "decimal-pad" : "default"}
      style={[
        styles.input,
        { color: c.foreground, backgroundColor: c.secondary, borderColor: c.border },
        multiline && { minHeight: 80, textAlignVertical: "top" },
        style,
      ]}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    gap: 10,
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerSub: { fontSize: 11, marginTop: 1 },
  randomBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
  },
  randomBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontWeight: "600" },

  content: { padding: 16, gap: 16 },
  section: { gap: 16 },

  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  hint: { fontSize: 11, color: "#999" },

  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 9, fontSize: 14, width: "100%",
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  qualityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  qualityChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
  },
  qualityText: { fontSize: 12, fontWeight: "600" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "500" },

  currencyRow: { flexDirection: "row", gap: 4 },
  currencyChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },

  rollBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },

  switchRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },

  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionHint: { fontSize: 13, lineHeight: 19 },

  previewCard: {
    borderWidth: 1, borderRadius: 10 * 1.5, padding: 14, gap: 6,
  },
  previewName: { fontSize: 16, fontWeight: "800" },
  previewMeta: { fontSize: 12 },
  previewProp: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  previewDesc: { fontSize: 12, lineHeight: 18, fontStyle: "italic" },

  qualityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  qualityBadgeText: { fontSize: 11, fontWeight: "700" },

  emptyState: {
    alignItems: "center", justifyContent: "center", gap: 10,
    padding: 40, borderWidth: 1, borderRadius: 10 * 1.5, borderStyle: "dashed",
  },
  emptyText: { fontSize: 14 },

  effectItem: { gap: 8 },
  effectTypePill: { alignSelf: "flex-start", borderRadius: 6 },
  effectTypeText: { fontSize: 11, fontWeight: "600" },
  effectItemLabel: { fontSize: 14, fontWeight: "600" },
  effectItemDesc: { fontSize: 12, lineHeight: 16 },
  removeEffectBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  bigBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16, borderRadius: 10 * 1.5,
  },
  bigBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  questTieInIntro: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  tagSection: { gap: 8, marginBottom: 16 },
  tagSectionLabel: { fontSize: 12, fontWeight: "600" },
});
