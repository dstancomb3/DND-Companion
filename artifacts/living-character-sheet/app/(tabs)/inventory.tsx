  // --- Import logic stubs ---
  // --- AI-powered import logic ---
  // These functions must be inside InventoryScreen to access context/state
import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  FlatList,
  Platform,
  Image,
  useWindowDimensions,
  Pressable,
} from "react-native";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import colors from "@/constants/colors";
import { useCharacter } from "@/context/CharacterContext";
import { InventoryItemRow } from "@/components/inventory/InventoryItemRow";
import { InventoryGridCard } from "@/components/inventory/InventoryGridCard";
import type { InventoryItem, ItemCategory, ItemEffect, ItemEffectType, ActionType, AbilityScores, EquippedStatKey, AdditionalDamage, CharacterSnapshot, Open5eFeat, WishlistItem, WishlistStatus } from "@/types";
import { STAT_KEY_LABELS, STAT_KEY_ORDER, statBonusLabel } from "@/data/itemStats";
import { SPELL_LIST, SCHOOL_COLORS } from "@/data/spellList";
import type { SpellEntry } from "@/data/spellList";
import { findFeatureFeats, formatFeatureFeatDescription } from "@/data/featureFeats";
import { WEAPON_PRICES } from "@/data/dnd5eReference";
import { tagsForCategory, subtypesForCategory } from "@/data/itemSubtypes";
import { CATEGORY_COLORS } from "@/components/inventory/InventoryItemRow";
import { ACTION_TYPE_COLORS as SEMANTIC_ACTION_TYPE_COLORS } from "@/constants/semanticColors";
import { roll } from "@/data/dmTables";
import { isConsumptionCategory, isEquippableCategory } from "@/data/itemCategoryRules";
import { legacyItemToItemMechanicsBlock } from "@/utils/mechanics/itemMechanicsAdapters";
import { envelopeToRuntimeCompatibilityItem, runtimeCompatibilityItemToEnvelope } from "@/utils/mechanics/mechanicsEnvelopeAdapters";

const CATEGORIES: { label: string; value: ItemCategory | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Weapons", value: "weapon" },
  { label: "Armor", value: "armor" },
  { label: "Accessories", value: "accessory" },
  { label: "Magic", value: "magic" },
  { label: "Consumables", value: "consumable" },
  { label: "Quest", value: "quest" },
  { label: "Gear", value: "gear" },
  { label: "Treasure", value: "treasure" },
  { label: "Maps", value: "map" },
  { label: "Other", value: "other" },
];

const ALL_CATEGORIES: { label: string; value: ItemCategory }[] = [
  { label: "Weapon", value: "weapon" },
  { label: "Armor", value: "armor" },
  { label: "Accessory", value: "accessory" },
  { label: "Magic", value: "magic" },
  { label: "Consumable", value: "consumable" },
  { label: "Quest", value: "quest" },
  { label: "Gear", value: "gear" },
  { label: "Treasure", value: "treasure" },
  { label: "Map", value: "map" },
  { label: "Other", value: "other" },
];

const EFFECT_TYPE_LABELS: Record<ItemEffectType, string> = {
  stat_bonus: "Stat (+N)", attack_damage: "Atk DMG", spell: "Grant Spell", buff: "Passive Buff", feature: "Feat / Feature", note: "Note",
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
const WISHLIST_STATUSES: WishlistStatus[] = ["wanted", "discussed", "shopping", "acquired"];

const ABILITY_KEYS: (keyof AbilityScores)[] = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
];
const ABILITY_SHORT: Record<keyof AbilityScores, string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
};

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}
function abilityMod(score: number): number { return Math.floor((score - 10) / 2); }
function fmtMod(n: number): string { return n >= 0 ? `+${n}` : `${n}`; }

interface WeaponSubtypeDefaults {
  damageDice: string;
  damageModifier: number;
  damageType: string;
  range: string;
}

const DAMAGE_TYPE_BY_CODE: Record<string, string> = {
  B: "bludgeoning",
  P: "piercing",
  S: "slashing",
};

const EXTRA_WEAPON_DEFAULTS: Record<string, WeaponSubtypeDefaults> = {
  "Knuckle Dusters": { damageDice: "1d4", damageModifier: 0, damageType: "bludgeoning", range: "5" },
  "Light Hammer": { damageDice: "1d4", damageModifier: 0, damageType: "bludgeoning", range: "20/60" },
  Sickle: { damageDice: "1d4", damageModifier: 0, damageType: "slashing", range: "5" },
  Spear: { damageDice: "1d6", damageModifier: 0, damageType: "piercing", range: "20/60" },
  Flail: { damageDice: "1d8", damageModifier: 0, damageType: "bludgeoning", range: "5" },
  Halberd: { damageDice: "1d10", damageModifier: 0, damageType: "slashing", range: "10" },
  Lance: { damageDice: "1d12", damageModifier: 0, damageType: "piercing", range: "10" },
  Morningstar: { damageDice: "1d8", damageModifier: 0, damageType: "piercing", range: "5" },
  Scimitar: { damageDice: "1d6", damageModifier: 0, damageType: "slashing", range: "5" },
  Trident: { damageDice: "1d6", damageModifier: 0, damageType: "piercing", range: "20/60" },
  "War Pick": { damageDice: "1d8", damageModifier: 0, damageType: "piercing", range: "5" },
  Whip: { damageDice: "1d4", damageModifier: 0, damageType: "slashing", range: "10" },
  Dart: { damageDice: "1d4", damageModifier: 0, damageType: "piercing", range: "20/60" },
  Sling: { damageDice: "1d4", damageModifier: 0, damageType: "bludgeoning", range: "30/120" },
  Blowgun: { damageDice: "1", damageModifier: 0, damageType: "piercing", range: "25/100" },
  Net: { damageDice: "", damageModifier: 0, damageType: "", range: "5/15" },
};

const STANDARD_WEAPON_DEFAULTS: Record<string, WeaponSubtypeDefaults> = {
  ...Object.fromEntries(
    WEAPON_PRICES.map((weapon) => {
      const [damageDice = "", damageCode = ""] = weapon.damage.split(" ");
      const lowerProps = weapon.properties.toLowerCase();
      const range =
        weapon.item === "Hand Crossbow" ? "30/120" :
        weapon.item === "Light Crossbow" ? "80/320" :
        weapon.item === "Heavy Crossbow" ? "100/400" :
        weapon.item === "Shortbow" ? "80/320" :
        weapon.item === "Longbow" ? "150/600" :
        lowerProps.includes("reach") ? "10" :
        lowerProps.includes("thrown")
          ? weapon.item === "Javelin" ? "30/120" : "20/60"
          : "5";

      return [
        weapon.item,
        {
          damageDice,
          damageModifier: 0,
          damageType: DAMAGE_TYPE_BY_CODE[damageCode] ?? "",
          range,
        },
      ];
    }),
  ),
  ...EXTRA_WEAPON_DEFAULTS,
};

function getWeaponSubtypeDefaults(subtype: string): WeaponSubtypeDefaults | null {
  return STANDARD_WEAPON_DEFAULTS[subtype] ?? null;
}

const FLAVOR_ADJECTIVES = [
  "Ancient","Arcane","Blessed","Corrupted","Dwarven","Elven","Enchanted","Ethereal",
  "Fey-touched","Forged","Gilded","Hallowed","Infernal","Luminous","Mythril","Obsidian",
  "Runic","Sacred","Shadow","Silvered","Spectral","Twilight","Void-kissed","Warded",
  "Stormbound","Sunken","Cursed","Moonlit","Wyrm-marked","Oathbound","Hushed","Bloodforged",
];
const FLAVOR_MATERIALS = [
  "bone","crystal","darkwood","dragonscale","ember-forged iron","feywild silk",
  "frosted steel","gold","living oak","midnight-alloy","moonshard","obsidian",
  "orichalcum","pale stone","phoenix feather","runed bronze","sea-jade","shadowsteel",
  "starfall iron","thunderwood","void-iron",
  "wyrmglass","grave-silver","sunsteel","dream-ivory","hollow brass","ashen yew",
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
  "smells faintly of pine resin and sea salt",
  "was recovered from a sealed dungeon vault",
  "was tempered in dragon-flame",
  "whispers fragments of forgotten lore",
  "flares briefly when danger is near",
  "seems heavier whenever lies are spoken nearby",
  "rings softly at dawn and dusk",
  "casts a shadow that moves half a beat too late",
  "holds traces of an old oath woven into its surface",
  "bears tiny notches that map an unknown constellation",
];
function randomFlavorText(name: string): string {
  return `${roll(FLAVOR_ADJECTIVES)} ${name.toLowerCase()} crafted from ${roll(FLAVOR_MATERIALS)}, this piece ${roll(FLAVOR_DESCRIPTORS)}.`;
}

export default function InventoryScreen() {
    const normalizeCategory = (value: unknown): ItemCategory => {
      const raw = String(value ?? "gear").trim().toLowerCase();
      const allowed: ItemCategory[] = ["weapon", "armor", "accessory", "magic", "consumable", "quest", "gear", "treasure", "map", "other"];
      return allowed.includes(raw as ItemCategory) ? (raw as ItemCategory) : "gear";
    };

    const normalizeEffect = (rawEffect: any): ItemEffect | null => {
      if (!rawEffect || typeof rawEffect !== "object") return null;
      const rawType = String(rawEffect.type ?? "note") as ItemEffectType;
      const allowedTypes: ItemEffectType[] = ["stat_bonus", "attack_damage", "spell", "buff", "feature", "note"];
      const type: ItemEffectType = allowedTypes.includes(rawType) ? rawType : "note";
      const label = String(rawEffect.label ?? "").trim();
      if (!label) return null;
      const actionType = rawEffect.actionType === "action" || rawEffect.actionType === "bonus_action" || rawEffect.actionType === "reaction" || rawEffect.actionType === "free"
        ? rawEffect.actionType
        : undefined;
      return {
        id: String(rawEffect.id ?? generateId()),
        type,
        label,
        pinned: rawEffect.pinned === true,
        description: typeof rawEffect.description === "string" && rawEffect.description.trim() ? rawEffect.description : undefined,
        actionType,
        statKey: rawEffect.statKey,
        statValue: typeof rawEffect.statValue === "number" ? rawEffect.statValue : undefined,
        attackDamageDice: typeof rawEffect.attackDamageDice === "string" ? rawEffect.attackDamageDice : undefined,
        attackDamageBonus: typeof rawEffect.attackDamageBonus === "number" ? rawEffect.attackDamageBonus : undefined,
        attackDamageType: typeof rawEffect.attackDamageType === "string" ? rawEffect.attackDamageType : undefined,
        attackToHitBonus: typeof rawEffect.attackToHitBonus === "number" ? rawEffect.attackToHitBonus : undefined,
        uses: typeof rawEffect.uses === "number" ? rawEffect.uses : undefined,
        resetOn: rawEffect.resetOn === "short_rest" || rawEffect.resetOn === "long_rest" || rawEffect.resetOn === "dawn" ? rawEffect.resetOn : undefined,
        resourceName: typeof rawEffect.resourceName === "string" ? rawEffect.resourceName : undefined,
        resourceMaxBonus: typeof rawEffect.resourceMaxBonus === "number" ? rawEffect.resourceMaxBonus : undefined,
      };
    };

    const normalizeEffects = (effects: any): ItemEffect[] | undefined => {
      if (!Array.isArray(effects)) return undefined;
      const normalized = effects.map(normalizeEffect).filter((effect): effect is ItemEffect => Boolean(effect));
      return normalized.length > 0 ? normalized : undefined;
    };

    const hasMeaningfulLegacyMechanicsContent = (rawItem: any, normalizedEffects?: ItemEffect[]): boolean => {
      const hasEffects = (normalizedEffects?.length ?? 0) > 0;
      const hasAdditionalDamage = Array.isArray(rawItem?.additionalDamage) && rawItem.additionalDamage.length > 0;
      const hasWeaponFields =
        (typeof rawItem?.damageDice === "string" && rawItem.damageDice.trim().length > 0) ||
        (typeof rawItem?.damageType === "string" && rawItem.damageType.trim().length > 0) ||
        typeof rawItem?.damageModifier === "number" ||
        (typeof rawItem?.attackAbility === "string" && rawItem.attackAbility.trim().length > 0) ||
        (typeof rawItem?.weaponRange === "string" && rawItem.weaponRange.trim().length > 0);
      return hasEffects || hasAdditionalDamage || hasWeaponFields;
    };

    const resolveImportedMechanics = (rawItem: any, normalizedEffects?: ItemEffect[]) => {
      if (rawItem?.mechanics) {
        const rawMechanics = rawItem.mechanics;
        const looksLikeBlock =
          typeof rawMechanics === "object" &&
          rawMechanics !== null &&
          rawMechanics.schemaVersion === "v1" &&
          rawMechanics.ownerType === "item" &&
          Array.isArray(rawMechanics.mechanics);
        const envelopeInput = looksLikeBlock
          ? { schemaVersion: "v1", ownerType: "item", mechanics: rawMechanics }
          : rawMechanics;
        const resolved = envelopeToRuntimeCompatibilityItem(envelopeInput);
        return resolved.mechanicsBlock;
      }

      if (!hasMeaningfulLegacyMechanicsContent(rawItem, normalizedEffects)) {
        return undefined;
      }

      return legacyItemToItemMechanicsBlock({
        name: rawItem?.name,
        notes: rawItem?.notes,
        equippedEffects: normalizedEffects,
        additionalDamage: Array.isArray(rawItem?.additionalDamage) ? rawItem.additionalDamage : undefined,
        useAbilityModifierForDamage:
          typeof rawItem?.useAbilityModifierForDamage === "boolean"
            ? rawItem.useAbilityModifierForDamage
            : undefined,
        damageDice: typeof rawItem?.damageDice === "string" ? rawItem.damageDice : undefined,
        damageModifier: typeof rawItem?.damageModifier === "number" ? rawItem.damageModifier : undefined,
        damageType: typeof rawItem?.damageType === "string" ? rawItem.damageType : undefined,
        attackAbility: rawItem?.attackAbility,
        isProficient: typeof rawItem?.isProficient === "boolean" ? rawItem.isProficient : undefined,
        weaponRange: typeof rawItem?.weaponRange === "string" ? rawItem.weaponRange : undefined,
      });
    };

    // Helper to map raw imported items to InventoryItem format
    const mapRawItemToInventoryItem = (rawItem: any): InventoryItem => {
      const category = normalizeCategory(rawItem.category);
      const normalizedEffects = normalizeEffects(rawItem.equippedEffects ?? rawItem.consumptionEffects);
      const mechanics = resolveImportedMechanics(rawItem, normalizedEffects);
      const item: InventoryItem = {
        id: rawItem.id || `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: rawItem.name,
        pinned: rawItem.pinned === true,
        quantity: rawItem.quantity ?? 1,
        equipped: isEquippableCategory(category) ? (rawItem.equipped ?? false) : false,
        category,
        notes: rawItem.notes || '',
        weight: rawItem.weight ? Number(rawItem.weight) : undefined,
        value: rawItem.value ? Number(rawItem.value) : undefined,
        equippedEffects: normalizedEffects,
        subtype: rawItem.subtype,
        tags: rawItem.tags,
        attackAbility: rawItem.attackAbility,
        isProficient: rawItem.isProficient !== false,
        useAbilityModifierForDamage:
          typeof rawItem.useAbilityModifierForDamage === "boolean"
            ? rawItem.useAbilityModifierForDamage
            : undefined,
        damageDice: rawItem.damageDice,
        damageModifier: rawItem.damageModifier,
        damageType: rawItem.damageType,
        additionalDamage: rawItem.additionalDamage,
        weaponRange: rawItem.weaponRange,
        suppressWeaponCard: rawItem.suppressWeaponCard,
        imageUri: rawItem.imageUri,
        imageSource: rawItem.imageSource,
        mechanics,
      };
      
      // Preserve DM-specific metadata in notes
      if (rawItem.quality || rawItem.isQuestItem || rawItem.description || rawItem.properties) {
        const dmMetadata = [];
        if (rawItem.quality) dmMetadata.push(`[${rawItem.quality}]`);
        if (rawItem.isQuestItem) dmMetadata.push(`[QUEST: ${rawItem.questName || 'Unknown'}]`);
        if (rawItem.description) dmMetadata.push(`Description: ${rawItem.description}`);
        if (rawItem.properties) dmMetadata.push(`Properties: ${rawItem.properties}`);
        if (dmMetadata.length > 0) {
          item.notes = dmMetadata.join('\n') + (item.notes ? '\n' + item.notes : '');
        }
      }
      
      return item;
    };

    // --- Import logic ---
    const handlePickImportFile = async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
        if (result.canceled || !result.assets?.length) return;
        const file = result.assets[0];
        const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
        // Try to parse as JSON, fallback to AI endpoint if not valid
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = null;
        }
        let items: InventoryItem[] = [];
        if (parsed && Array.isArray(parsed)) {
          items = parsed.map((rawItem: any) => mapRawItemToInventoryItem(rawItem));
        } else {
          // Fallback: send to AI parser endpoint
          const resp = await fetch(require('@/utils/apiUrl').API_BASE_URL + '/api/ai/parse-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: content, characterContext: character }),
          });
          if (!resp.ok) throw new Error('AI parsing failed');
          const data = await resp.json();
          items = data.proposedInventoryChanges || [];
        }
        if (!items.length) {
          Alert.alert('Import', 'No items found in file.');
          return;
        }
        items.forEach((item: InventoryItem) => addItem(item));
        Alert.alert('Import', `Imported ${items.length} item(s).`);
      } catch (e) {
        Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
      }
    };

    const handleImportItems = async (text?: string) => {
      try {
        const input = typeof text === 'string' ? text : importPaste;
        if (!input.trim()) {
          Alert.alert('Import', 'Paste some text to import.');
          return;
        }
        
        // Try to parse as JSON first
        let parsed;
        try {
          parsed = JSON.parse(input);
        } catch {
          parsed = null;
        }
        
        let items: InventoryItem[] = [];
        if (parsed && Array.isArray(parsed)) {
          items = parsed.map((rawItem: any) => mapRawItemToInventoryItem(rawItem));
        } else {
          // Fallback: send to AI parser endpoint
          const resp = await fetch(require('@/utils/apiUrl').API_BASE_URL + '/api/ai/parse-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input, characterContext: character }),
          });
          if (!resp.ok) throw new Error('AI parsing failed');
          const data = await resp.json();
          items = data.proposedInventoryChanges || [];
        }
        
        if (!items.length) {
          Alert.alert('Import', 'No items found in text.');
          return;
        }
        items.forEach((item: InventoryItem) => addItem(item));
        setShowImportModal(false);
        setImportPaste("");
        Alert.alert('Import', `Imported ${items.length} item(s).`);
      } catch (e) {
        Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
      }
    };
  const c = useColors();
  const insets = useSafeAreaInsets();
  const {
    inventory,
    addItem,
    updateItem,
    removeItem,
    toggleEquipped,
    splitStackItem,
    mergeStackItem,
    reorderInventory,
    character,
    wishlist,
    addWishlistItem,
    updateWishlistItem,
    removeWishlistItem,
    convertWishlistItemToInventory,
  } = useCharacter();

  const [inventoryMode, setInventoryMode] = useState<"inventory" | "wishlist">("inventory");
  const [filter, setFilter] = useState<ItemCategory | "all">("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showAddModal, setShowAddModal] = useState(false);
  // Track which grid item is expanded
  const [expandedGridItemId, setExpandedGridItemId] = useState<string | null>(null);

  // Basic fields
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newCategory, setNewCategory] = useState<ItemCategory>("gear");
  const [newNotes, setNewNotes] = useState("");

  // Weapon stats
  const [newAbility, setNewAbility] = useState<keyof AbilityScores>("strength");
  const [newIsProficient, setNewIsProficient] = useState(true);
  const [newDamageDice, setNewDamageDice] = useState("");
  const [newDmgMod, setNewDmgMod] = useState("");
  const [newDmgType, setNewDmgType] = useState("");
  const [newRange, setNewRange] = useState("");

  // Additional damage (weapon extra dice)
  const [newAdditionalDamage, setNewAdditionalDamage] = useState<AdditionalDamage[]>([]);
  const [newSuppressWeapon, setNewSuppressWeapon] = useState(false);
  const [newSubtype, setNewSubtype] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newImageUri, setNewImageUri] = useState("");
  const [extraDice, setExtraDice] = useState("");
  const [extraDmgType, setExtraDmgType] = useState("");

  // Effects
  const [newEffects, setNewEffects] = useState<ItemEffect[]>([]);
  const [effectLabel, setEffectLabel] = useState("");
  const [effectDesc, setEffectDesc] = useState("");
  const [effectType, setEffectType] = useState<ItemEffectType>("stat_bonus");
  const [effectStatKey, setEffectStatKey] = useState<EquippedStatKey | null>(null);
  const [effectStatVal, setEffectStatVal] = useState("1");
  const [effectAtkDice, setEffectAtkDice] = useState("");
  const [effectAtkDmgType, setEffectAtkDmgType] = useState("");
  const [effectAtkDamageSign, setEffectAtkDamageSign] = useState<"+" | "-">("+");
  const [effectAtkDamageMagnitude, setEffectAtkDamageMagnitude] = useState("");
  const [effectAtkToHitSign, setEffectAtkToHitSign] = useState<"+" | "-">("+");
  const [effectAtkToHitMagnitude, setEffectAtkToHitMagnitude] = useState("");
  const [effectSpellSearch, setEffectSpellSearch] = useState("");
  const [effectSpellEntry, setEffectSpellEntry] = useState<SpellEntry | null>(null);
  const [effectFeatureEntry, setEffectFeatureEntry] = useState<Open5eFeat | null>(null);
  const [effectUses, setEffectUses] = useState("1");
  const [effectResetOn, setEffectResetOn] = useState<"short_rest" | "long_rest" | "dawn">("long_rest");
  const [effectBuffStatKey, setEffectBuffStatKey] = useState<EquippedStatKey | null>(null);
  const [effectBuffStatVal, setEffectBuffStatVal] = useState("1");

  // Effect inline editing
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);
  const [editEffectLabel, setEditEffectLabel] = useState("");
  const [editEffectDesc, setEditEffectDesc] = useState("");
  const [editEffectType, setEditEffectType] = useState<ItemEffectType>("buff");
  const [editEffectActionType, setEditEffectActionType] = useState<ActionType | null>(null);

  // Import/export submenu
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPaste, setImportPaste] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  // Export item selection
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set());

  // Wishlist quick add
  const [wishlistName, setWishlistName] = useState("");
  const [wishlistNotes, setWishlistNotes] = useState("");
  const [wishlistSource, setWishlistSource] = useState("");
  const [wishlistCategory, setWishlistCategory] = useState<ItemCategory | "">("");
  const [wishlistRarity, setWishlistRarity] = useState("");
  const [wishlistPriority, setWishlistPriority] = useState("");
  const [wishlistStatus, setWishlistStatus] = useState<WishlistStatus>("wanted");

  function openExportModal() {
    setShowActionsMenu(false);
    if (inventory.length === 0) { Alert.alert("Nothing to export", "Your inventory is empty."); return; }
    setExportSelectedIds(new Set(inventory.map(i => i.id)));
    setShowExportModal(true);
  }

  function toggleExportItem(id: string) {
    setExportSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const handleExportItems = async () => {
    const toExport = inventory.filter(i => exportSelectedIds.has(i.id));
    if (toExport.length === 0) { Alert.alert("Nothing selected", "Select at least one item to export."); return; }
    setShowExportModal(false);
    try {
      const exportPayload = toExport.map((item) => {
        const normalizedEffects = item.equippedEffects?.map((effect) => normalizeEffect(effect)).filter((effect): effect is ItemEffect => Boolean(effect));
        const equippable = isEquippableCategory(item.category);
        const consumable = isConsumptionCategory(item.category);
        const hasLegacyMechanicsContent =
          (normalizedEffects?.length ?? 0) > 0 ||
          (item.additionalDamage?.length ?? 0) > 0 ||
          !!item.damageDice ||
          !!item.damageType ||
          typeof item.damageModifier === "number" ||
          !!item.attackAbility ||
          !!item.weaponRange;
        const mechanicsEnvelope = (item.mechanics || hasLegacyMechanicsContent)
          ? runtimeCompatibilityItemToEnvelope({
              mechanics: item.mechanics,
              compatibilityShape: {
                notes: item.notes,
                attackAbility: item.attackAbility,
                isProficient: item.isProficient,
                damageDice: item.damageDice,
                damageModifier: item.damageModifier,
                damageType: item.damageType,
                additionalDamage: item.additionalDamage,
                weaponRange: item.weaponRange,
                equippedEffects: normalizedEffects,
              },
              exportedFrom: item.name,
            })
          : undefined;
        return {
          ...item,
          equipped: equippable ? item.equipped : false,
          equippedEffects: equippable ? normalizedEffects : undefined,
          consumptionEffects: consumable ? normalizedEffects : undefined,
          mechanics: mechanicsEnvelope,
        };
      });
      const json = JSON.stringify(exportPayload, null, 2);
      const charName = character.name?.replace(/[^a-z0-9]/gi, "_").toLowerCase() ?? "character";
      const filename = `${charName}_inventory.json`;
      if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
        Alert.alert("Export", `Sharing is not available on this platform. (${filename})`);
        return;
      }
      const path = (FileSystem.cacheDirectory ?? "") + filename;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Export Inventory", UTI: "public.json" });
      return;
    } catch (e) {
      const err = e as any;
      Alert.alert("Export failed", err && typeof err.message === "string" ? err.message : String(e));
    }
  };

  const isWeapon = newCategory === "weapon";
  const isEquippableNewItem = isEquippableCategory(newCategory);
  const isConsumptionNewItem = isConsumptionCategory(newCategory);
  const computedAbilityMod = abilityMod(character.abilityScores[newAbility]);
  const computedAtkBonus = computedAbilityMod + (newIsProficient ? character.proficiencyBonus : 0);

  const sortedWishlist = [...wishlist]
    .filter((entry) => !entry.archived)
    .sort((a, b) => {
      if (a.status === "acquired" && b.status !== "acquired") return 1;
      if (a.status !== "acquired" && b.status === "acquired") return -1;
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pa !== pb) return pb - pa;
      return b.updatedAt - a.updatedAt;
    });

  const resetWishlistForm = () => {
    setWishlistName("");
    setWishlistNotes("");
    setWishlistSource("");
    setWishlistCategory("");
    setWishlistRarity("");
    setWishlistPriority("");
    setWishlistStatus("wanted");
  };

  const handleAddWishlistItem = () => {
    const name = wishlistName.trim();
    if (!name) {
      Alert.alert("Wishlist", "Item name is required.");
      return;
    }
    const parsedPriority = parseInt(wishlistPriority, 10);
    addWishlistItem({
      name,
      notes: wishlistNotes.trim() || undefined,
      source: wishlistSource.trim() || undefined,
      category: wishlistCategory || undefined,
      rarityTarget: wishlistRarity.trim() || undefined,
      priority: Number.isNaN(parsedPriority) ? undefined : Math.min(5, Math.max(1, parsedPriority)),
      status: wishlistStatus,
      archived: false,
    });
    resetWishlistForm();
  };

  const cycleWishlistStatus = (entry: WishlistItem) => {
    const idx = WISHLIST_STATUSES.indexOf(entry.status);
    const nextStatus = WISHLIST_STATUSES[(idx + 1) % WISHLIST_STATUSES.length];
    updateWishlistItem(entry.id, { status: nextStatus });
  };

  const convertWishlistEntry = (entry: WishlistItem) => {
    Alert.alert(
      "Convert to Inventory",
      `Add ${entry.name} to owned inventory?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Convert + Keep",
          onPress: () => convertWishlistItemToInventory(entry.id, { keepAsAcquired: true, archiveAfterConvert: true }),
        },
        {
          text: "Convert + Remove",
          style: "destructive",
          onPress: () => convertWishlistItemToInventory(entry.id, { keepAsAcquired: false }),
        },
      ]
    );
  };

  const modeSelector = (
    <View style={[styles.modeTabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      {([
        { key: "inventory", label: "Inventory", icon: "package" },
        { key: "wishlist",  label: "Wishlist",  icon: "bookmark" },
      ] as const).map((tab) => {
        const active = inventoryMode === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setInventoryMode(tab.key)}
            activeOpacity={0.8}
            style={[styles.modeTabBtn, active && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}
          >
            <Feather name={tab.icon} size={15} color={active ? c.primary : c.mutedForeground} />
            <Text style={[styles.modeTabLabel, { color: active ? c.primary : c.mutedForeground }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  function toggleInventoryPinned(itemId: string) {
    const target = inventory.find((item) => item.id === itemId);
    if (!target) return;

    const nextPinned = !(target.pinned === true);
    const updatedInventory = inventory.map((item) =>
      item.id === itemId ? { ...item, pinned: nextPinned } : item
    );
    const targetItem = updatedInventory.find((item) => item.id === itemId);
    if (!targetItem) return;

    const remaining = updatedInventory.filter((item) => item.id !== itemId);
    if (nextPinned) {
      reorderInventory([targetItem, ...remaining]);
      return;
    }

    const pinnedItems = remaining.filter((item) => item.pinned === true);
    const unpinnedItems = remaining.filter((item) => item.pinned !== true);
    reorderInventory([...pinnedItems, targetItem, ...unpinnedItems]);
  }

  const filtered =
    filter === "all" ? inventory : inventory.filter((i) => i.category === filter);
  const equippedItems = filtered.filter((item) => item.equipped);
  const backpackItems = filtered.filter((item) => !item.equipped);
  const featureMatches = effectType === "feature" ? findFeatureFeats(effectLabel, 8) : [];

  const sectionedListData: Array<
    | { type: "section"; id: string; title: string; count: number }
    | { type: "item"; id: string; item: InventoryItem }
  > = [
    ...(equippedItems.length > 0
      ? [
          { type: "section" as const, id: "equipped-section", title: "Equipped", count: equippedItems.length },
          ...equippedItems.map((item) => ({ type: "item" as const, id: `equipped-${item.id}`, item })),
        ]
      : []),
    ...(backpackItems.length > 0
      ? [
          { type: "section" as const, id: "inventory-section", title: "Inventory", count: backpackItems.length },
          ...backpackItems.map((item) => ({ type: "item" as const, id: `inventory-${item.id}`, item })),
        ]
      : []),
  ];

  const renderInventorySectionHeader = (title: string, count: number) => (
    <View style={[styles.inventorySectionHeader, { borderColor: c.border, backgroundColor: c.card }]}> 
      <Text style={[styles.inventorySectionTitle, { color: c.foreground }]}>{title}</Text>
      <Text style={[styles.inventorySectionCount, { color: c.mutedForeground }]}>
        {count} item{count === 1 ? "" : "s"}
      </Text>
    </View>
  );

  const resetEffectFields = () => {
    setEffectLabel(""); setEffectDesc("");
    setEffectStatKey(null); setEffectStatVal("1");
    setEffectAtkDice(""); setEffectAtkDmgType(""); setEffectAtkDamageSign("+"); setEffectAtkDamageMagnitude(""); setEffectAtkToHitSign("+"); setEffectAtkToHitMagnitude("");
    setEffectSpellSearch(""); setEffectSpellEntry(null); setEffectFeatureEntry(null);
    setEffectUses("1"); setEffectResetOn("long_rest");
    setEffectBuffStatKey(null); setEffectBuffStatVal("1");
  };

  const handleAddEffect = () => {
    if (effectType === "spell") {
      const spellLabel = effectSpellEntry ? `${effectSpellEntry.name} ${effectUses}/day` : effectLabel.trim();
      if (!spellLabel) return;
      setNewEffects((prev) => [...prev, {
        id: generateId(), type: "spell", label: spellLabel,
        description: effectSpellEntry?.desc || effectDesc.trim() || undefined,
        uses: parseInt(effectUses) || 1, resetOn: effectResetOn,
      }]);
      resetEffectFields();
      return;
    }
    const statKey = effectType === "stat_bonus" ? (effectStatKey ?? undefined) : undefined;
    const statValue = statKey != null ? (parseInt(effectStatVal) || 1) : undefined;
    const autoFilledStat = statKey != null && statValue != null ? statBonusLabel(statKey, statValue) : "";
    const atkDice = effectType === "attack_damage" ? effectAtkDice.trim() || undefined : undefined;
    const atkDmgType = effectType === "attack_damage" ? effectAtkDmgType.trim() || undefined : undefined;
    const atkDamageMagnitude = Math.max(1, parseInt(effectAtkDamageMagnitude, 10) || 1);
    const atkDamageBonus = effectType === "attack_damage" ? (effectAtkDamageSign === "-" ? -atkDamageMagnitude : atkDamageMagnitude) : undefined;
    const atkToHitMagnitude = Math.max(0, parseInt(effectAtkToHitMagnitude, 10) || 0);
    const atkToHitBonus = effectType === "attack_damage"
      ? (atkToHitMagnitude === 0 ? 0 : (effectAtkToHitSign === "-" ? -atkToHitMagnitude : atkToHitMagnitude))
      : undefined;
    const autoFilledAtk = atkDice && atkDmgType
      ? `Attack: ${atkDice}${atkDamageBonus ? (atkDamageBonus > 0 ? `+${atkDamageBonus}` : `${atkDamageBonus}`) : ""} ${atkDmgType}${atkToHitBonus ? `, ${atkToHitBonus > 0 ? `+${atkToHitBonus}` : atkToHitBonus} to hit` : ""}`
      : "";
    const buffStatKey = effectType === "buff" ? (effectBuffStatKey ?? undefined) : undefined;
    const buffStatValue = buffStatKey != null ? (parseInt(effectBuffStatVal) || 1) : undefined;
    const label = effectLabel.trim() || autoFilledStat || autoFilledAtk;
    if (!label) return;
    setNewEffects((prev) => [
      ...prev,
      {
        id: generateId(), type: effectType, label,
        description: effectDesc.trim() || undefined,
        statKey: statKey ?? buffStatKey, statValue: statValue ?? buffStatValue,
        attackDamageDice: atkDice, attackDamageBonus: atkDamageBonus, attackDamageType: atkDmgType, attackToHitBonus: atkToHitBonus,
      },
    ]);
    resetEffectFields();
  };

  const handleRemoveEffect = (id: string) => {
    setNewEffects((prev) => prev.filter((e) => e.id !== id));
  };

  const openEditEffect = (effect: ItemEffect) => {
    setEditingEffectId(effect.id);
    setEditEffectLabel(effect.label);
    setEditEffectDesc(effect.description ?? "");
    setEditEffectType(effect.type);
    setEditEffectActionType(effect.actionType ?? null);
  };

  const handleSaveEffect = () => {
    if (!editingEffectId) return;
    setNewEffects((prev) =>
      prev.map((e) =>
        e.id !== editingEffectId
          ? e
          : {
              ...e,
              label: editEffectLabel.trim() || e.label,
              description: editEffectDesc.trim() || undefined,
              type: editEffectType,
              actionType: editEffectActionType ?? undefined,
            }
      )
    );
    setEditingEffectId(null);
  };

  const handlePickNewItemImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow access to your photo library to attach images.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      if (FileSystem.documentDirectory) {
        const dir = FileSystem.documentDirectory + "item_images/";
        const info = await FileSystem.getInfoAsync(dir);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }
        const ext = (asset.uri.split(".").pop() ?? "jpg").split("?")[0];
        const dest = dir + "item_new_" + Date.now() + "." + ext;
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        setNewImageUri(dest);
      } else {
        setNewImageUri(asset.uri);
      }
    } catch {
      setNewImageUri(asset.uri);
    }
  };

  const handleRemoveNewItemImage = () => {
    setNewImageUri("");
  };

  const resetAddForm = () => {
    setNewName(""); setNewQty("1"); setNewNotes(""); setNewCategory("gear");
    setNewAbility("strength"); setNewIsProficient(true);
    setNewDamageDice(""); setNewDmgMod(""); setNewDmgType(""); setNewRange("");
    setNewAdditionalDamage([]); setExtraDice(""); setExtraDmgType("");
    setNewSuppressWeapon(false);
    setNewSubtype(""); setNewTags([]);
    setNewImageUri("");
    setNewEffects([]); setEffectType("stat_bonus"); resetEffectFields();
  };

  const handleSubtypeSelect = (subtype: string) => {
    setNewSubtype(subtype);
    if (newCategory !== "weapon") return;

    const defaults = getWeaponSubtypeDefaults(subtype);
    if (!defaults) return;

    setNewDamageDice(defaults.damageDice);
    setNewDmgMod(String(defaults.damageModifier));
    setNewDmgType(defaults.damageType);
    setNewRange(defaults.range);
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const dmgMod = newDmgMod.trim() !== "" ? parseInt(newDmgMod) : undefined;
    const rangeVal = newRange.trim();
    // Auto-commit any pending extra damage still in the input fields
    const pendingExtra =
      extraDice.trim() && extraDmgType.trim()
        ? [{ dice: extraDice.trim(), damageType: extraDmgType.trim() }]
        : [];
    const finalAdditionalDamage = [...newAdditionalDamage, ...pendingExtra];
    addItem({
      name: newName.trim(),
      pinned: false,
      quantity: parseInt(newQty) || 1,
      equipped: false,
      category: newCategory,
      notes: newNotes.trim() || undefined,
      equippedEffects: newEffects.length > 0 ? newEffects : undefined,
      attackAbility: isWeapon && newDamageDice.trim() ? newAbility : undefined,
      isProficient: isWeapon && newDamageDice.trim() ? newIsProficient : undefined,
      damageDice: isWeapon && newDamageDice.trim() ? newDamageDice.trim() : undefined,
      damageModifier: isWeapon && !isNaN(dmgMod as number) ? dmgMod : undefined,
      damageType: isWeapon && newDmgType.trim() ? newDmgType.trim() : undefined,
      additionalDamage: isWeapon && finalAdditionalDamage.length > 0 ? finalAdditionalDamage : undefined,
      weaponRange: isWeapon && rangeVal ? rangeVal + " ft" : undefined,
      suppressWeaponCard: isWeapon && newSuppressWeapon ? true : undefined,
      subtype: newSubtype.trim() || undefined,
      tags: newTags.length > 0 ? newTags : undefined,
      sourceTag: "custom",
      imageUri: newImageUri.trim() || undefined,
    });
    resetAddForm();
    setShowAddModal(false);
  };

  const listHeader = (
    <>
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => { resetAddForm(); setShowAddModal(true); }}
          activeOpacity={0.8}
          style={[styles.actionBtn, { backgroundColor: c.primary, borderRadius: colors.radius }]}
        >
          <Feather name="plus" size={16} color={c.primaryForeground} />
          <Text style={[styles.actionBtnText, { color: c.primaryForeground }]}>Add Item</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/loot-generator", params: { tab: "photo_text" } })}
          activeOpacity={0.8}
          style={[
            styles.actionBtn,
            { backgroundColor: "#8B5CF620", borderColor: "#8B5CF6", borderRadius: colors.radius, borderWidth: 1 },
          ]}
        >
          <Feather name="camera" size={16} color="#8B5CF6" />
          <Text style={[styles.actionBtnText, { color: "#8B5CF6" }]}>Loot Generator</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowActionsMenu(true)}
          activeOpacity={0.8}
          style={[styles.moreBtn, { backgroundColor: c.card, borderColor: c.border, borderRadius: colors.radius }]}
        >
          <Feather name="more-horizontal" size={18} color={c.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            onPress={() => setFilter(cat.value)}
            activeOpacity={0.7}
            style={[
              styles.filterChip,
              { backgroundColor: filter === cat.value ? c.primary : c.secondary, borderRadius: colors.radius },
            ]}
          >
            <Text style={[styles.filterText, { color: filter === cat.value ? c.primaryForeground : c.mutedForeground }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <View>
          <Text style={{ fontSize: 12, color: c.mutedForeground }}>
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </Text>
          <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>
            Equipped items stay in their own section above the main inventory list.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setViewMode(v => v === "list" ? "grid" : "list")}
          activeOpacity={0.7}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border }}
        >
          <Feather name={viewMode === "list" ? "grid" : "list"} size={13} color={c.foreground} />
          <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "600" }}>
            {viewMode === "list" ? "Grid" : "List"}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // DEBUG: Log render and data
  console.log('InventoryScreen render', { inventory });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {modeSelector}
      {inventoryMode === "wishlist" ? (
        <ScrollHintScrollView
          style={[styles.container, { backgroundColor: c.background }]}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Platform.OS === "web" ? 76 : 92, paddingTop: 12 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.wishlistComposer, { backgroundColor: c.card, borderColor: c.border }]}> 
            <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground, marginBottom: 10 }}>Add Wanted Item</Text>
            <TextInput
              value={wishlistName}
              onChangeText={setWishlistName}
              placeholder="Item name"
              placeholderTextColor={c.mutedForeground}
              style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border, borderRadius: colors.radius }]}
            />
            <View style={styles.twoCol}>
              <TextInput
                value={wishlistSource}
                onChangeText={setWishlistSource}
                placeholder="Source / idea"
                placeholderTextColor={c.mutedForeground}
                style={[styles.fieldInput, { flex: 1, backgroundColor: c.secondary, color: c.foreground, borderColor: c.border, borderRadius: colors.radius }]}
              />
              <TextInput
                value={wishlistPriority}
                onChangeText={setWishlistPriority}
                placeholder="Priority 1-5"
                placeholderTextColor={c.mutedForeground}
                keyboardType="number-pad"
                style={[styles.fieldInput, { width: 120, backgroundColor: c.secondary, color: c.foreground, borderColor: c.border, borderRadius: colors.radius }]}
              />
            </View>
            <View style={styles.twoCol}>
              <TextInput
                value={wishlistCategory}
                onChangeText={(value) => setWishlistCategory(value as ItemCategory | "")}
                placeholder="Type/category"
                placeholderTextColor={c.mutedForeground}
                style={[styles.fieldInput, { flex: 1, backgroundColor: c.secondary, color: c.foreground, borderColor: c.border, borderRadius: colors.radius }]}
              />
              <TextInput
                value={wishlistRarity}
                onChangeText={setWishlistRarity}
                placeholder="Rarity target"
                placeholderTextColor={c.mutedForeground}
                style={[styles.fieldInput, { flex: 1, backgroundColor: c.secondary, color: c.foreground, borderColor: c.border, borderRadius: colors.radius }]}
              />
            </View>
            <TextInput
              value={wishlistNotes}
              onChangeText={setWishlistNotes}
              placeholder="Notes"
              placeholderTextColor={c.mutedForeground}
              multiline
              numberOfLines={2}
              style={[styles.fieldInput, { minHeight: 68, backgroundColor: c.secondary, color: c.foreground, borderColor: c.border, borderRadius: colors.radius, textAlignVertical: "top" }]}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {WISHLIST_STATUSES.map((status) => {
                  const selected = wishlistStatus === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setWishlistStatus(status)}
                      activeOpacity={0.7}
                      style={[
                        styles.statusChip,
                        {
                          backgroundColor: selected ? c.primary : c.secondary,
                          borderColor: selected ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: selected ? c.primaryForeground : c.mutedForeground }}>
                        {status}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={handleAddWishlistItem}
              activeOpacity={0.8}
              style={[styles.actionBtn, { backgroundColor: c.primary, borderRadius: colors.radius, flex: undefined }]}
            >
              <Feather name="plus" size={16} color={c.primaryForeground} />
              <Text style={[styles.actionBtnText, { color: c.primaryForeground }]}>Add to Wishlist</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: c.mutedForeground }}>
              {sortedWishlist.length} active item{sortedWishlist.length === 1 ? "" : "s"}
            </Text>
          </View>

          {sortedWishlist.map((entry) => (
            <View key={entry.id} style={[styles.wishlistCard, { backgroundColor: c.card, borderColor: c.border }]}> 
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: c.foreground }}>{entry.name}</Text>
                <TouchableOpacity
                  onPress={() => cycleWishlistStatus(entry)}
                  activeOpacity={0.7}
                  style={[styles.statusChip, { backgroundColor: c.secondary, borderColor: c.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground }}>{entry.status}</Text>
                </TouchableOpacity>
              </View>

              {(entry.category || entry.rarityTarget || entry.priority) ? (
                <Text style={{ marginTop: 6, fontSize: 12, color: c.mutedForeground }}>
                  {[entry.category, entry.rarityTarget, entry.priority ? `P${entry.priority}` : null].filter(Boolean).join(" · ")}
                </Text>
              ) : null}

              {entry.notes ? (
                <Text style={{ marginTop: 8, fontSize: 13, color: c.foreground }}>{entry.notes}</Text>
              ) : null}

              {entry.source ? (
                <Text style={{ marginTop: 6, fontSize: 12, color: c.mutedForeground }}>Source: {entry.source}</Text>
              ) : null}

              <View style={styles.wishlistActions}>
                <TouchableOpacity
                  onPress={() => convertWishlistEntry(entry)}
                  activeOpacity={0.8}
                  style={[styles.wishlistActionBtn, { backgroundColor: "#10B98120", borderColor: "#10B981" }]}
                >
                  <Feather name="repeat" size={13} color="#10B981" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#10B981" }}>Convert</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateWishlistItem(entry.id, { archived: true })}
                  activeOpacity={0.8}
                  style={[styles.wishlistActionBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
                >
                  <Feather name="archive" size={13} color={c.mutedForeground} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground }}>Archive</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeWishlistItem(entry.id)}
                  activeOpacity={0.8}
                  style={[styles.wishlistActionBtn, { backgroundColor: "#EF444415", borderColor: "#EF4444" }]}
                >
                  <Feather name="trash-2" size={13} color="#EF4444" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#EF4444" }}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {sortedWishlist.length === 0 && (
            <View style={styles.empty}>
              <Feather name="bookmark" size={32} color={c.mutedForeground} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: c.foreground }]}>No wishlist items yet</Text>
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>Add the next gear you want to find or buy.</Text>
            </View>
          )}
        </ScrollHintScrollView>
      ) : viewMode === "list" ? (
        <FlatList
          data={sectionedListData}
          keyExtractor={(entry) => entry.id}
          style={[styles.container, { backgroundColor: c.background }]}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Platform.OS === "web" ? 76 : 92, paddingTop: 12 },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          renderItem={({ item: entry }) => {
            if (entry.type === "section") {
              return renderInventorySectionHeader(entry.title, entry.count);
            }

            const item = entry.item;
            const sectionItems = item.equipped ? equippedItems : backpackItems;
            const sectionIndex = sectionItems.findIndex((i) => i.id === item.id);
            const canMoveUp = sectionIndex > 0;
            const canMoveDown = sectionIndex >= 0 && sectionIndex < sectionItems.length - 1;

            const moveWithinSection = (delta: -1 | 1) => {
              if (sectionIndex < 0) return;
              const targetIndex = sectionIndex + delta;
              if (targetIndex < 0 || targetIndex >= sectionItems.length) return;

              const reorderedSection = [...sectionItems];
              const temp = reorderedSection[targetIndex];
              reorderedSection[targetIndex] = reorderedSection[sectionIndex];
              reorderedSection[sectionIndex] = temp;

              const reorderedVisibleItems = item.equipped
                ? [...reorderedSection, ...backpackItems]
                : [...equippedItems, ...reorderedSection];

              // Keep items hidden by current filter at the end in their existing order.
              const visibleIds = new Set(filtered.map((i) => i.id));
              const hiddenItems = inventory.filter((invItem) => !visibleIds.has(invItem.id));
              reorderInventory([...reorderedVisibleItems, ...hiddenItems]);
            };
            return (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flexDirection: "column", alignItems: "center", marginRight: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      if (canMoveUp) moveWithinSection(-1);
                    }}
                    disabled={!canMoveUp}
                    hitSlop={{ top: 12, bottom: 8, left: 12, right: 12 }}
                    style={{ opacity: canMoveUp ? 1 : 0.3, padding: 6 }}
                  >
                    <Feather name="arrow-up" size={18} color={c.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (canMoveDown) moveWithinSection(1);
                    }}
                    disabled={!canMoveDown}
                    hitSlop={{ top: 8, bottom: 12, left: 12, right: 12 }}
                    style={{ opacity: canMoveDown ? 1 : 0.3, padding: 6 }}
                  >
                    <Feather name="arrow-down" size={18} color={c.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <InventoryItemRow
                    item={item}
                    onUpdate={(updates) => updateItem(item.id, updates)}
                    onRemove={() => removeItem(item.id)}
                    onToggleEquip={() => toggleEquipped(item.id)}
                    onTogglePin={() => toggleInventoryPinned(item.id)}
                    onSplitStack={(qty) => splitStackItem(item.id, qty)}
                    onMergeStack={() => mergeStackItem(item.id)}
                  />
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="package" size={32} color={c.mutedForeground} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: c.foreground }]}> 
                {filter === "all" ? "No items" : `No ${filter} items`}
              </Text>
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>Add items or use the loot photo flow</Text>
            </View>
          }
        />
      ) : (
        <ScrollHintScrollView
          style={[styles.container, { backgroundColor: c.background }]}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Platform.OS === "web" ? 76 : 92, paddingTop: 12 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {listHeader}
          {equippedItems.length > 0 ? renderInventorySectionHeader("Equipped", equippedItems.length) : null}
          <InventoryGridSection
            items={equippedItems}
            expandedGridItemId={expandedGridItemId}
            setExpandedGridItemId={setExpandedGridItemId}
            toggleInventoryPinned={toggleInventoryPinned}
            updateItem={updateItem}
            removeItem={removeItem}
            toggleEquipped={toggleEquipped}
            splitStackItem={splitStackItem}
            mergeStackItem={mergeStackItem}
          />
          {backpackItems.length > 0 ? renderInventorySectionHeader("Inventory", backpackItems.length) : null}
          <InventoryGridSection
            items={backpackItems}
            expandedGridItemId={expandedGridItemId}
            setExpandedGridItemId={setExpandedGridItemId}
            toggleInventoryPinned={toggleInventoryPinned}
            updateItem={updateItem}
            removeItem={removeItem}
            toggleEquipped={toggleEquipped}
            splitStackItem={splitStackItem}
            mergeStackItem={mergeStackItem}
          />
          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Feather name="package" size={32} color={c.mutedForeground} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: c.foreground }]}>
                {filter === "all" ? "No items" : `No ${filter} items`}
              </Text>
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>Add items or use the loot photo flow</Text>
            </View>
          )}
        </ScrollHintScrollView>
      )}

      {/* Add item modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.card, borderRadius: colors.radius * 2, minHeight: 200 }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: c.foreground }]}>Add Item</Text>

              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Name *</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Item name"
                placeholderTextColor={c.mutedForeground}
                style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
              />

              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Quantity</Text>
              <TextInput
                value={newQty}
                onChangeText={setNewQty}
                keyboardType="number-pad"
                style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
              />

              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {ALL_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      onPress={() => setNewCategory(cat.value)}
                      style={[
                        styles.catChip,
                        { backgroundColor: newCategory === cat.value ? c.primary : c.secondary, borderRadius: colors.radius },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: newCategory === cat.value ? c.primaryForeground : c.mutedForeground }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Subtype picker — shown when category has subtypes */}
              {subtypesForCategory(newCategory).length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
                    {newCategory === "weapon" ? "Weapon Type" : newCategory === "armor" ? "Armor Type" : "Type"}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setNewSubtype("")}
                        activeOpacity={0.7}
                        style={[styles.catChip, {
                          backgroundColor: newSubtype === "" ? c.muted : c.secondary,
                          borderColor: newSubtype === "" ? c.mutedForeground : "transparent",
                          borderWidth: 1,
                          borderRadius: colors.radius,
                        }]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "600", color: newSubtype === "" ? c.foreground : c.mutedForeground }}>None</Text>
                      </TouchableOpacity>
                      {subtypesForCategory(newCategory).map((sub) => {
                        const selected = newSubtype === sub;
                        const col = CATEGORY_COLORS[newCategory as ItemCategory] ?? "#6B7280";
                        return (
                          <TouchableOpacity
                            key={sub}
                            onPress={() => handleSubtypeSelect(sub)}
                            activeOpacity={0.7}
                            style={[styles.catChip, {
                              backgroundColor: selected ? col + "30" : c.secondary,
                              borderColor: selected ? col : "transparent",
                              borderWidth: 1,
                              borderRadius: colors.radius,
                            }]}
                          >
                            <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? col : c.mutedForeground }}>{sub}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  {newCategory === "weapon" && (
                    <Text style={[styles.sectionSub, { color: c.mutedForeground, marginTop: -4, marginBottom: 12 }]}>Selecting a weapon type auto-fills standard combat stats. You can still edit any field below.</Text>
                  )}
                </>
              )}

              {/* Tags — filtered to the selected category */}
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Tags</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {tagsForCategory(newCategory).map((tag) => {
                  const selected = newTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => setNewTags((prev) => selected ? prev.filter((t) => t !== tag) : [...prev, tag])}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
                        backgroundColor: selected ? "#8B5CF620" : c.secondary,
                        borderWidth: 1,
                        borderColor: selected ? "#8B5CF6" : "transparent",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? "#8B5CF6" : c.mutedForeground }}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 0, flex: 1 }]}>Notes / Flavor Text</Text>
                <TouchableOpacity
                  onPress={() => setNewNotes(randomFlavorText(newName || "item"))}
                  activeOpacity={0.7}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#8B5CF620", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                >
                  <Feather name="zap" size={11} color="#8B5CF6" />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#8B5CF6" }}>Randomize</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder="Item description or flavor text…"
                placeholderTextColor={c.mutedForeground}
                multiline
                numberOfLines={2}
                style={[
                  styles.fieldInput,
                  { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius, minHeight: 60, textAlignVertical: "top" },
                ]}
              />

              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Attached Image</Text>
              {newImageUri ? (
                <View style={{ gap: 8, marginBottom: 12 }}>
                  <Image
                    source={{ uri: newImageUri }}
                    style={{ width: "100%", height: 160, borderRadius: colors.radius, borderWidth: 1, borderColor: c.border }}
                    resizeMode="cover"
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={handlePickNewItemImage}
                      activeOpacity={0.8}
                      style={[styles.imageActionBtn, { backgroundColor: c.secondary, borderColor: c.border, borderRadius: colors.radius }]}
                    >
                      <Feather name="image" size={14} color={c.foreground} />
                      <Text style={{ fontSize: 13, fontWeight: "600", color: c.foreground }}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleRemoveNewItemImage}
                      activeOpacity={0.8}
                      style={[styles.imageActionBtn, { backgroundColor: c.secondary, borderColor: c.border, borderRadius: colors.radius }]}
                    >
                      <Feather name="x" size={14} color={c.destructive} />
                      <Text style={{ fontSize: 13, fontWeight: "600", color: c.destructive }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handlePickNewItemImage}
                  activeOpacity={0.8}
                  style={[
                    styles.imageActionBtn,
                    { alignSelf: "flex-start", backgroundColor: c.secondary, borderColor: "#14B8A640", borderRadius: colors.radius, marginBottom: 12, paddingHorizontal: 14 },
                  ]}
                >
                  <Feather name="image" size={14} color="#14B8A6" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#14B8A6" }}>Attach Image</Text>
                </TouchableOpacity>
              )}

              {/* Weapon stats — visible only when category = Weapon */}
              {isWeapon && (
                <View style={[styles.weaponSection, { borderTopColor: c.border }]}>
                  <Text style={[styles.sectionTitle, { color: c.foreground }]}>Attack Stats</Text>
                  <Text style={[styles.sectionSub, { color: c.mutedForeground }]}>
                    Fill these in to auto-generate an attack card when equipped
                  </Text>

                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Attack uses which ability?</Text>
                  <View style={styles.abilityRow}>
                    {ABILITY_KEYS.map((key) => {
                      const mod = abilityMod(character.abilityScores[key]);
                      const total = mod + (newIsProficient ? character.proficiencyBonus : 0);
                      const isSelected = newAbility === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setNewAbility(key)}
                          activeOpacity={0.7}
                          style={[
                            styles.abilityChip,
                            { backgroundColor: isSelected ? c.primary : c.secondary, borderRadius: colors.radius },
                          ]}
                        >
                          <Text style={[styles.abilityChipLabel, { color: isSelected ? c.primaryForeground : c.mutedForeground }]}>
                            {ABILITY_SHORT[key]}
                          </Text>
                          <Text style={[styles.abilityChipMod, { color: isSelected ? c.primaryForeground : c.foreground }]}>
                            {fmtMod(total)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Proficiency toggle */}
                  <TouchableOpacity
                    onPress={() => setNewIsProficient((v) => !v)}
                    activeOpacity={0.8}
                    style={[styles.profToggle, {
                      backgroundColor: newIsProficient ? "#10B98120" : c.secondary,
                      borderColor: newIsProficient ? "#10B981" : c.border,
                      borderRadius: colors.radius,
                    }]}
                  >
                    <View style={[styles.profToggleIcon, {
                      backgroundColor: newIsProficient ? "#10B981" : c.muted,
                      borderRadius: 6,
                    }]}>
                      <Feather name="check" size={12} color={newIsProficient ? "#fff" : c.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.profToggleLabel, { color: newIsProficient ? "#10B981" : c.foreground }]}>
                        Proficient with this weapon
                      </Text>
                      <Text style={[styles.profToggleSub, { color: c.mutedForeground }]}>
                        {newIsProficient
                          ? `+${character.proficiencyBonus} proficiency bonus included`
                          : "Proficiency bonus not added"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Live ATK bonus preview */}
                  <View style={[styles.atkPreview, { backgroundColor: c.secondary, borderRadius: colors.radius }]}>
                    <Text style={[styles.atkPreviewLabel, { color: c.mutedForeground }]}>Attack Bonus =</Text>
                    <Text style={[styles.atkPreviewValue, { color: c.primary }]}>{fmtMod(computedAtkBonus)}</Text>
                    <Text style={[styles.atkPreviewBreakdown, { color: c.mutedForeground }]}>
                      {newIsProficient
                        ? `(${ABILITY_SHORT[newAbility]} ${fmtMod(computedAbilityMod)} + Prof ${fmtMod(character.proficiencyBonus)})`
                        : `(${ABILITY_SHORT[newAbility]} ${fmtMod(computedAbilityMod)}, no prof)`}
                    </Text>
                  </View>

                  <View style={styles.twoCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Damage Dice</Text>
                      <TextInput
                        value={newDamageDice}
                        onChangeText={setNewDamageDice}
                        placeholder="e.g. 1d8"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>DMG Modifier</Text>
                      <TextInput
                        value={newDmgMod}
                        onChangeText={setNewDmgMod}
                        keyboardType="number-pad"
                        placeholder="e.g. 4"
                        placeholderTextColor={c.mutedForeground}
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
                      />
                    </View>
                  </View>

                  <View style={styles.twoCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Damage Type</Text>
                      <TextInput
                        value={newDmgType}
                        onChangeText={setNewDmgType}
                        placeholder="e.g. slashing"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Range</Text>
                      <View style={[styles.rangeInputRow, { backgroundColor: c.secondary, borderRadius: colors.radius }]}>
                        <TextInput
                          value={newRange}
                          onChangeText={setNewRange}
                          placeholder="5"
                          placeholderTextColor={c.mutedForeground}
                          style={[styles.rangeInput, { color: c.foreground }]}
                        />
                        <Text style={[styles.rangeUnit, { color: c.mutedForeground }]}>ft</Text>
                      </View>
                    </View>
                  </View>

                  {/* Additional damage entries */}
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Extra Damage</Text>
                    <Text style={{ fontSize: 11, color: c.mutedForeground, marginBottom: 8 }}>
                      e.g. +1d4 psychic from a secondary effect
                    </Text>
                    {newAdditionalDamage.map((ad, i) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <View style={{ flex: 1, backgroundColor: "#A78BFA20", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7 }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#A78BFA" }}>
                            {ad.dice} {ad.damageType}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setNewAdditionalDamage((prev) => prev.filter((_, j) => j !== i))}
                          style={{ padding: 6, backgroundColor: c.muted, borderRadius: 6 }}
                          activeOpacity={0.7}
                        >
                          <Feather name="x" size={14} color={c.destructive} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      <TextInput
                        value={extraDice}
                        onChangeText={setExtraDice}
                        placeholder="Dice (e.g. 1d4)"
                        placeholderTextColor={c.mutedForeground}
                        style={{ flex: 1, backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius, padding: 8, fontSize: 13 }}
                      />
                      <TextInput
                        value={extraDmgType}
                        onChangeText={setExtraDmgType}
                        placeholder="Type"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={{ flex: 1, backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius, padding: 8, fontSize: 13 }}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          if (!extraDice.trim() || !extraDmgType.trim()) return;
                          setNewAdditionalDamage((prev) => [
                            ...prev,
                            { dice: extraDice.trim(), damageType: extraDmgType.trim() },
                          ]);
                          setExtraDice("");
                          setExtraDmgType("");
                        }}
                        style={{ padding: 8, backgroundColor: extraDice.trim() && extraDmgType.trim() ? c.primary : c.muted, borderRadius: colors.radius }}
                        activeOpacity={0.7}
                      >
                        <Feather name="plus" size={16} color={extraDice.trim() && extraDmgType.trim() ? c.primaryForeground : c.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {/* Suppress attack card toggle — only for Unarmed Weapon tagged items */}
                  {newTags.includes("Unarmed Weapon") && (
                    <TouchableOpacity
                      onPress={() => setNewSuppressWeapon((v) => !v)}
                      activeOpacity={0.8}
                      style={[styles.profToggle, {
                        backgroundColor: newSuppressWeapon ? "#F5920020" : c.secondary,
                        borderColor: newSuppressWeapon ? "#F59200" : c.border,
                        borderRadius: colors.radius,
                        marginTop: 14,
                      }]}
                    >
                      <View style={[styles.profToggleIcon, {
                        backgroundColor: newSuppressWeapon ? "#F59200" : c.muted,
                        borderRadius: 6,
                      }]}>
                        <Feather name="link" size={12} color={newSuppressWeapon ? "#fff" : c.mutedForeground} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.profToggleLabel, { color: newSuppressWeapon ? "#F59200" : c.foreground }]}>
                          Merge with unarmed attack
                        </Text>
                        <Text style={[styles.profToggleSub, { color: c.mutedForeground }]}>
                          {newSuppressWeapon
                            ? "No separate attack card — bonus damage feeds into your unarmed attack"
                            : "Generate a standalone attack card for this weapon when equipped"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Equipped Effects */}
              <View style={[styles.effectsSection, { borderTopColor: c.border }]}>
                <Text style={[styles.sectionTitle, { color: c.foreground }]}>{isConsumptionNewItem ? "Consumption Effects" : "Equipped Effects"}</Text>
                <Text style={[styles.sectionSub, { color: c.mutedForeground }]}>
                  {isConsumptionNewItem
                    ? "Effects that trigger when this item is consumed"
                    : (isEquippableNewItem
                      ? "Bonuses, spells, or buffs active while this item is equipped"
                      : "Item effects that apply while carrying or using this item")}
                </Text>

                {newEffects.map((effect) => {
                  const isEditing = editingEffectId === effect.id;
                  const actionColor = effect.actionType ? ACTION_TYPE_COLORS[effect.actionType] : null;
                  return (
                    <View key={effect.id}>
                      <View style={[styles.effectItem, { backgroundColor: c.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: c.border, flexDirection: "column", alignItems: "stretch" }]}> 
                        {/* Header row */}
                        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                          <View style={styles.effectItemLeft}>
                            <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap" }}>
                              <View style={[styles.effectTypePill, { backgroundColor: EFFECT_TYPE_COLORS[effect.type] + "30" }]}>
                                <Text style={[styles.effectTypeText, { color: EFFECT_TYPE_COLORS[effect.type] }]}>
                                  {EFFECT_TYPE_LABELS[effect.type]}
                                </Text>
                              </View>
                              {actionColor && (
                                <View style={[styles.effectTypePill, { backgroundColor: actionColor + "25" }]}>
                                  <Text style={[styles.effectTypeText, { color: actionColor }]}>
                                    {ACTION_TYPE_CHIPS.find((chip) => chip.value === effect.actionType)?.label ?? effect.actionType}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={[styles.effectItemLabel, { color: c.foreground }]}>{effect.label}</Text>
                            {effect.description && !isEditing ? (
                              <Text style={[styles.effectItemDesc, { color: c.mutedForeground }]}>{effect.description}</Text>
                            ) : null}
                          </View>
                          <View style={{ flexDirection: "row", gap: 4 }}>
                            <TouchableOpacity
                              onPress={() => isEditing ? setEditingEffectId(null) : openEditEffect(effect)}
                              style={[styles.removeEffectBtn, { backgroundColor: isEditing ? c.primary + "30" : c.muted, borderRadius: 6 }]}
                              activeOpacity={0.7}
                            >
                              <Feather name={isEditing ? "chevron-up" : "edit-2"} size={13} color={isEditing ? c.primary : c.mutedForeground} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleRemoveEffect(effect.id)}
                              style={[styles.removeEffectBtn, { backgroundColor: c.muted, borderRadius: 6 }]}
                              activeOpacity={0.7}
                            >
                              <Feather name="x" size={13} color={c.destructive} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Inline edit form */}
                        {isEditing && (
                          <View style={{ marginTop: 10, gap: 8 }}>
                            <TextInput
                              value={editEffectLabel}
                              onChangeText={setEditEffectLabel}
                              placeholder="Effect label"
                              placeholderTextColor={c.mutedForeground}
                              style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: colors.radius }]}
                            />
                            <TextInput
                              value={editEffectDesc}
                              onChangeText={setEditEffectDesc}
                              placeholder="Description (optional)"
                              placeholderTextColor={c.mutedForeground}
                              multiline
                              numberOfLines={2}
                              style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: colors.radius, minHeight: 48, textAlignVertical: "top" }]}
                            />
                            <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                              Effect Type
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              <View style={{ flexDirection: "row", gap: 5 }}>
                                {(Object.keys(EFFECT_TYPE_LABELS) as ItemEffectType[]).map((t) => (
                                  <TouchableOpacity
                                    key={t}
                                    onPress={() => setEditEffectType(t)}
                                    style={[styles.typeChip, { backgroundColor: editEffectType === t ? EFFECT_TYPE_COLORS[t] : c.muted, borderRadius: 6 }]}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: editEffectType === t ? "#fff" : c.mutedForeground }}>
                                      {EFFECT_TYPE_LABELS[t]}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </ScrollView>
                            <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                              Used As (Action Economy)
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              <View style={{ flexDirection: "row", gap: 5 }}>
                                {ACTION_TYPE_CHIPS.map(({ label, value }) => {
                                  const col = value ? ACTION_TYPE_COLORS[value] : c.mutedForeground;
                                  const active = editEffectActionType === value;
                                  return (
                                    <TouchableOpacity
                                      key={label}
                                      onPress={() => setEditEffectActionType(value)}
                                      style={[styles.typeChip, { backgroundColor: active ? col + "30" : c.muted, borderRadius: 6, borderWidth: active ? 1 : 0, borderColor: active ? col : "transparent" }]}
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
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <TouchableOpacity
                                onPress={() => setEditingEffectId(null)}
                                style={[{ flex: 1, padding: 9, borderRadius: colors.radius, backgroundColor: c.muted, alignItems: "center" }]}
                                activeOpacity={0.7}
                              >
                                <Text style={{ fontSize: 13, fontWeight: "600", color: c.mutedForeground }}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={handleSaveEffect}
                                style={[{ flex: 2, padding: 9, borderRadius: colors.radius, backgroundColor: c.primary, alignItems: "center" }]}
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

                <View style={[styles.addEffectBox, { backgroundColor: c.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: c.border }]}> 
                  <Text style={[styles.addEffectTitle, { color: c.foreground }]}>Add Effect</Text>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, marginBottom: 8 }}>
                    Tap a type chip to switch editors. Inputs with borders are editable fields.
                  </Text>

                  {/* Type chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {(Object.keys(EFFECT_TYPE_LABELS) as ItemEffectType[]).map((t) => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => { setEffectType(t); resetEffectFields(); }}
                          style={[
                            styles.typeChip,
                            { backgroundColor: effectType === t ? EFFECT_TYPE_COLORS[t] : c.muted, borderRadius: 6, borderWidth: 1, borderColor: effectType === t ? EFFECT_TYPE_COLORS[t] : c.border },
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: effectType === t ? "#fff" : c.mutedForeground }}>
                            {EFFECT_TYPE_LABELS[t]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, marginBottom: 8 }}>
                    {effectType === "stat_bonus" ? "Numerically changes a stat (AC, DEX, Initiative…)" :
                     effectType === "attack_damage" ? "Adds damage dice, modifiers, and/or to-hit bonuses to attacks while equipped" :
                     effectType === "spell" ? "Grants use of a spell — no slot required" :
                     effectType === "buff" ? "Descriptive passive benefit (resistance, advantage…). Optionally also bumps a stat." :
                     effectType === "feature" ? "Pick a feat from the catalog or type a custom item feature." :
                     "Just a reminder note, no mechanical effect"}
                  </Text>

                  {effectType === "feature" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Feat or feature name</Text>
                      <TextInput
                        value={effectLabel}
                        onChangeText={(v) => { setEffectLabel(v); setEffectFeatureEntry(null); }}
                        placeholder="Search feats or type a custom feature"
                        placeholderTextColor={c.mutedForeground}
                        style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: colors.radius }]}
                      />
                      {!effectFeatureEntry && effectLabel.trim().length >= 1 && (
                        featureMatches.length === 0 ? (
                          <Text style={{ fontSize: 12, color: c.mutedForeground, marginBottom: 8 }}>No feats found. Keep typing to add a custom feature.</Text>
                        ) : (
                          <View style={{ maxHeight: 220, marginBottom: 8 }}>
                            <ScrollView nestedScrollEnabled>
                              {featureMatches.map((feat) => (
                                <TouchableOpacity
                                  key={feat.slug}
                                  onPress={() => {
                                    setEffectFeatureEntry(feat);
                                    setEffectLabel(feat.name);
                                    setEffectDesc(formatFeatureFeatDescription(feat));
                                  }}
                                  activeOpacity={0.7}
                                  style={{ paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: c.border }}
                                >
                                  <Text style={{ fontSize: 13, fontWeight: "700", color: c.foreground }}>{feat.name}</Text>
                                  <Text style={{ fontSize: 11, color: c.mutedForeground }} numberOfLines={2}>
                                    {feat.prerequisites ? `${feat.prerequisites} · ` : ""}{feat.desc}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )
                      )}
                      {effectFeatureEntry && (
                        <View style={{ backgroundColor: "#F59E0B20", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: "#F59E0B", flex: 1 }}>{effectFeatureEntry.name}</Text>
                            <TouchableOpacity onPress={() => { setEffectFeatureEntry(null); setEffectLabel(""); setEffectDesc(""); }} activeOpacity={0.7}>
                              <Feather name="x" size={14} color={c.mutedForeground} />
                            </TouchableOpacity>
                          </View>
                          <Text style={{ fontSize: 11, color: c.mutedForeground }} numberOfLines={4}>{formatFeatureFeatDescription(effectFeatureEntry)}</Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* Stat bonus fields */}
                  {effectType === "stat_bonus" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Which stat?</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: "row", gap: 5 }}>
                          {STAT_KEY_ORDER.map((key) => (
                            <TouchableOpacity
                              key={key}
                              onPress={() => {
                                setEffectStatKey(key);
                                const val = parseInt(effectStatVal) || 1;
                                setEffectLabel(statBonusLabel(key, val));
                              }}
                              style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: effectStatKey === key ? "#10B981" : c.muted, borderRadius: 6 }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: effectStatKey === key ? "#fff" : c.mutedForeground }}>
                                {STAT_KEY_LABELS[key]}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Bonus amount</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <TouchableOpacity
                          onPress={() => { const val = (parseInt(effectStatVal) || 1) - 1; setEffectStatVal(String(val)); if (effectStatKey) setEffectLabel(statBonusLabel(effectStatKey, val)); }}
                          style={{ width: 32, height: 32, backgroundColor: c.muted, borderRadius: 6, alignItems: "center", justifyContent: "center" }}
                          activeOpacity={0.7}
                        >
                          <Feather name="minus" size={14} color={c.foreground} />
                        </TouchableOpacity>
                        <TextInput
                          value={effectStatVal}
                          onChangeText={(t) => { setEffectStatVal(t); const val = parseInt(t); if (!isNaN(val) && effectStatKey) setEffectLabel(statBonusLabel(effectStatKey, val)); }}
                          keyboardType="numbers-and-punctuation"
                          style={{ width: 56, textAlign: "center", backgroundColor: c.muted, color: c.foreground, borderRadius: 6, paddingVertical: 6, fontSize: 15, fontWeight: "700" }}
                        />
                        <TouchableOpacity
                          onPress={() => { const val = (parseInt(effectStatVal) || 0) + 1; setEffectStatVal(String(val)); if (effectStatKey) setEffectLabel(statBonusLabel(effectStatKey, val)); }}
                          style={{ width: 32, height: 32, backgroundColor: c.muted, borderRadius: 6, alignItems: "center", justifyContent: "center" }}
                          activeOpacity={0.7}
                        >
                          <Feather name="plus" size={14} color={c.foreground} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* Attack damage fields */}
                  {effectType === "attack_damage" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Hit Die</Text>
                      <TextInput
                        value={effectAtkDice}
                        onChangeText={setEffectAtkDice}
                        placeholder="e.g. 1d4"
                        placeholderTextColor={c.mutedForeground}
                        style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: colors.radius }]}
                      />
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Damage Type</Text>
                      <TextInput
                        value={effectAtkDmgType}
                        onChangeText={setEffectAtkDmgType}
                        placeholder="e.g. lightning"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: colors.radius }]}
                      />
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Damage Modifier</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <TouchableOpacity
                          onPress={() => setEffectAtkDamageSign((prev) => prev === "+" ? "-" : "+")}
                          style={{ width: 42, height: 38, backgroundColor: c.muted, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: c.foreground, fontSize: 18, fontWeight: "800" }}>{effectAtkDamageSign}</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={effectAtkDamageMagnitude}
                          onChangeText={(t) => setEffectAtkDamageMagnitude(t.replace(/[^0-9]/g, "") || "")}
                          keyboardType="number-pad"
                          placeholder="N"
                          placeholderTextColor={c.mutedForeground}
                          style={{ width: 72, textAlign: "center", backgroundColor: c.muted, color: c.foreground, borderRadius: 8, paddingVertical: 8, fontSize: 15, fontWeight: "700", borderWidth: 1, borderColor: c.border }}
                        />
                        <Text style={{ fontSize: 12, color: c.mutedForeground, flex: 1 }}>
                          {`${effectAtkDice || "XdY"}${((effectAtkDamageSign === "-" ? -1 : 1) * Math.max(1, parseInt(effectAtkDamageMagnitude || "1", 10) || 1)) > 0 ? `+${(effectAtkDamageSign === "-" ? -1 : 1) * Math.max(1, parseInt(effectAtkDamageMagnitude || "1", 10) || 1)}` : `${(effectAtkDamageSign === "-" ? -1 : 1) * Math.max(1, parseInt(effectAtkDamageMagnitude || "1", 10) || 1)}`} ${effectAtkDmgType || "damage"}`}
                        </Text>
                      </View>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>To Hit Modifier</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <TouchableOpacity
                          onPress={() => setEffectAtkToHitSign((prev) => prev === "+" ? "-" : "+")}
                          style={{ width: 42, height: 38, backgroundColor: c.muted, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: c.foreground, fontSize: 18, fontWeight: "800" }}>{effectAtkToHitSign}</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={effectAtkToHitMagnitude}
                          onChangeText={(t) => setEffectAtkToHitMagnitude(t.replace(/[^0-9]/g, "") || "")}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={c.mutedForeground}
                          style={{ width: 72, textAlign: "center", backgroundColor: c.muted, color: c.foreground, borderRadius: 8, paddingVertical: 8, fontSize: 15, fontWeight: "700", borderWidth: 1, borderColor: c.border }}
                        />
                        <Text style={{ fontSize: 12, color: c.mutedForeground, flex: 1 }}>
                          {`${Math.max(0, parseInt(effectAtkToHitMagnitude || "0", 10) || 0) === 0 ? "+0" : (((effectAtkToHitSign === "-" ? -1 : 1) * Math.max(0, parseInt(effectAtkToHitMagnitude || "0", 10) || 0)) > 0 ? `+${(effectAtkToHitSign === "-" ? -1 : 1) * Math.max(0, parseInt(effectAtkToHitMagnitude || "0", 10) || 0)}` : `${(effectAtkToHitSign === "-" ? -1 : 1) * Math.max(0, parseInt(effectAtkToHitMagnitude || "0", 10) || 0)}`)} to hit`}
                        </Text>
                      </View>
                    </>
                  )}

                  {/* Spell fields */}
                  {effectType === "spell" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Search Spell</Text>
                      <TextInput
                        value={effectSpellSearch}
                        onChangeText={(t) => { setEffectSpellSearch(t); setEffectSpellEntry(null); }}
                        placeholder="Fireball, Cure Wounds…"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: colors.radius }]}
                      />
                      {effectSpellSearch.trim().length >= 2 && !effectSpellEntry && (
                        <ScrollView style={{ maxHeight: 120, backgroundColor: c.muted, borderRadius: colors.radius, marginBottom: 6 }} keyboardShouldPersistTaps="handled">
                          {SPELL_LIST.filter((s) => s.name.toLowerCase().includes(effectSpellSearch.toLowerCase())).slice(0, 8).map((s) => (
                            <TouchableOpacity key={s.name} onPress={() => { setEffectSpellEntry(s); setEffectSpellSearch(s.name); }} activeOpacity={0.7}
                              style={{ paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <View style={{ backgroundColor: (SCHOOL_COLORS[s.school] ?? "#6B7280") + "30", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                                  <Text style={{ fontSize: 9, fontWeight: "700", color: SCHOOL_COLORS[s.school] ?? "#6B7280" }}>{s.school}</Text>
                                </View>
                                <Text style={{ fontSize: 13, color: c.foreground }}>{s.name}</Text>
                                <Text style={{ fontSize: 11, color: c.mutedForeground, marginLeft: "auto" }}>
                                  {s.level === 0 ? "Cantrip" : `L${s.level}`}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                      {effectSpellEntry && (
                        <View style={{ backgroundColor: "#8B5CF620", borderRadius: colors.radius, padding: 8, marginBottom: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#8B5CF6" }}>{effectSpellEntry.name}</Text>
                          <Text style={{ fontSize: 11, color: c.mutedForeground }} numberOfLines={2}>{effectSpellEntry.desc}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Uses</Text>
                          <TextInput value={effectUses} onChangeText={setEffectUses} keyboardType="number-pad"
                            style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: colors.radius }]} />
                        </View>
                        <View style={{ flex: 2 }}>
                          <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Recharge</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: "row", gap: 4 }}>
                              {(["short_rest", "long_rest", "dawn"] as const).map((r) => (
                                <TouchableOpacity key={r} onPress={() => setEffectResetOn(r)} activeOpacity={0.7}
                                  style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                                    backgroundColor: effectResetOn === r ? "#8B5CF630" : c.muted,
                                    borderWidth: effectResetOn === r ? 1 : 0, borderColor: "#8B5CF6" }}>
                                  <Text style={{ fontSize: 10, fontWeight: "700", color: effectResetOn === r ? "#8B5CF6" : c.mutedForeground }}>
                                    {r === "short_rest" ? "Short Rest" : r === "long_rest" ? "Long Rest" : "Dawn"}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </ScrollView>
                        </View>
                      </View>
                    </>
                  )}

                  {/* Buff stat bump + label for buff/feature/note */}
                  {(effectType === "buff" || effectType === "note" || effectType === "feature") && (
                    <>
                      {effectType === "buff" && (
                        <>
                          <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Optional stat bump</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                            <View style={{ flexDirection: "row", gap: 5 }}>
                              <TouchableOpacity onPress={() => setEffectBuffStatKey(null)} activeOpacity={0.7}
                                style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: effectBuffStatKey === null ? "#3B82F630" : c.muted, borderWidth: effectBuffStatKey === null ? 1 : 0, borderColor: "#3B82F6" }}>
                                <Text style={{ fontSize: 10, fontWeight: "700", color: effectBuffStatKey === null ? "#3B82F6" : c.mutedForeground }}>None</Text>
                              </TouchableOpacity>
                              {STAT_KEY_ORDER.map((sk) => (
                                <TouchableOpacity key={sk} onPress={() => setEffectBuffStatKey(sk)} activeOpacity={0.7}
                                  style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: effectBuffStatKey === sk ? "#3B82F630" : c.muted, borderWidth: effectBuffStatKey === sk ? 1 : 0, borderColor: "#3B82F6" }}>
                                  <Text style={{ fontSize: 10, fontWeight: "700", color: effectBuffStatKey === sk ? "#3B82F6" : c.mutedForeground }}>{STAT_KEY_LABELS[sk]}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </ScrollView>
                          {effectBuffStatKey && (
                            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Value</Text>
                                <TextInput value={effectBuffStatVal} onChangeText={setEffectBuffStatVal} keyboardType="numbers-and-punctuation"
                                  style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: colors.radius }]} />
                              </View>
                            </View>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Label (always shown, auto-filled for stat/atk, required for others) */}
                  {effectType !== "feature" && (
                    <TextInput
                      value={effectLabel}
                      onChangeText={setEffectLabel}
                      placeholder={
                        effectType === "stat_bonus" ? "Label (auto-filled from stat picker)" :
                        effectType === "attack_damage" ? "Label (auto-filled above)" :
                        effectType === "spell" ? "e.g. Hunter's Mark 1/day (auto from picker)" :
                        effectType === "buff" ? "e.g. Resistance: fire" : "Short reminder note"
                      }
                      placeholderTextColor={c.mutedForeground}
                      style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: colors.radius }]}
                    />
                  )}
                  <TextInput
                    value={effectDesc}
                    onChangeText={setEffectDesc}
                    placeholder="Full description (optional)"
                    placeholderTextColor={c.mutedForeground}
                    multiline
                    numberOfLines={2}
                    style={[
                      styles.effectInput,
                      { backgroundColor: c.muted, color: c.foreground, borderRadius: colors.radius, minHeight: 52, textAlignVertical: "top" },
                    ]}
                  />
                  {(() => {
                    const canAdd = effectLabel.trim() ||
                      (effectType === "stat_bonus" && effectStatKey != null) ||
                      (effectType === "attack_damage" && effectAtkDice.trim() !== "" && effectAtkDmgType.trim() !== "") ||
                      (effectType === "spell" && (effectSpellEntry != null || effectLabel.trim() !== ""));
                    return (
                      <TouchableOpacity
                        onPress={handleAddEffect}
                        disabled={!canAdd}
                        activeOpacity={0.8}
                        style={[
                          styles.addEffectBtn,
                          { backgroundColor: canAdd ? c.primary : c.muted, borderRadius: colors.radius },
                        ]}
                      >
                        <Feather name="plus" size={14} color={canAdd ? c.primaryForeground : c.mutedForeground} />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: canAdd ? c.primaryForeground : c.mutedForeground }}>
                          Add Effect
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={() => { resetAddForm(); setShowAddModal(false); }}
                  style={[styles.modalBtn, { backgroundColor: c.secondary, borderRadius: colors.radius }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalBtnText, { color: c.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAdd}
                  disabled={!newName.trim()}
                  style={[styles.modalBtn, { backgroundColor: newName.trim() ? c.primary : c.secondary, borderRadius: colors.radius }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalBtnText, { color: newName.trim() ? c.primaryForeground : c.mutedForeground }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Actions submenu (export / import) ── */}
      <Modal visible={showActionsMenu} transparent animationType="fade" onRequestClose={() => setShowActionsMenu(false)}>
        <View style={styles.menuOverlay}>
          <Pressable style={styles.menuBackdrop} onPress={() => setShowActionsMenu(false)} />
          <View style={[styles.menuSheet, { backgroundColor: c.card, borderRadius: colors.radius * 2 }]}>
            <Text style={[styles.menuTitle, { color: c.mutedForeground }]}>Item JSON</Text>

            <TouchableOpacity
              onPress={openExportModal}
              activeOpacity={0.8}
              style={[styles.menuRow, { borderColor: c.border }]}
            >
              <View style={[styles.menuIcon, { backgroundColor: "#10B98120" }]}>
                <Feather name="share-2" size={18} color="#10B981" />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuRowTitle, { color: c.foreground }]}>Export Items</Text>
                <Text style={[styles.menuRowSub, { color: c.mutedForeground }]}>
                  Choose which of your {inventory.length} item{inventory.length !== 1 ? "s" : ""} to export
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={c.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setShowActionsMenu(false); setImportPaste(""); setImportError(null); setShowImportModal(true); }}
              activeOpacity={0.8}
              style={[styles.menuRow, { borderColor: c.border }]}
            >
              <View style={[styles.menuIcon, { backgroundColor: "#3B82F620" }]}>
                <Feather name="upload" size={18} color="#3B82F6" />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuRowTitle, { color: c.foreground }]}>Import Items</Text>
                <Text style={[styles.menuRowSub, { color: c.mutedForeground }]}>
                  Add items from a JSON file or pasted text
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={c.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowActionsMenu(false)}
              style={[styles.menuCancel, { backgroundColor: c.secondary, borderRadius: colors.radius }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.menuCancelText, { color: c.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Export item selection modal ── */}
      <Modal visible={showExportModal} transparent animationType="slide" onRequestClose={() => setShowExportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.card, borderRadius: colors.radius * 2 }]}>
            <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
              <Text style={{ color: c.foreground, fontSize: 18, fontWeight: "700" }}>Choose Items to Export</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Feather name="x" size={20} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12 }}>
              <TouchableOpacity
                onPress={() => setExportSelectedIds(new Set(inventory.map(i => i.id)))}
                style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center", borderColor: c.border, backgroundColor: c.secondary }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: c.foreground, fontSize: 13, fontWeight: "600" }}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setExportSelectedIds(new Set())}
                style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center", borderColor: c.border, backgroundColor: c.secondary }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: c.mutedForeground, fontSize: 13, fontWeight: "600" }}>Deselect All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
              {inventory.map(item => {
                const sel = exportSelectedIds.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    onPress={() => toggleExportItem(item.id)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
                      borderRadius: 10, borderWidth: 1,
                      borderColor: sel ? c.primary + "60" : c.border,
                      backgroundColor: sel ? c.primary + "0F" : c.background,
                    }}
                  >
                    <View style={{
                      width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                      borderColor: sel ? c.primary : c.border,
                      backgroundColor: sel ? c.primary : "transparent",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {sel && <Feather name="check" size={13} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontWeight: "600", fontSize: 14 }}>{item.name}</Text>
                      <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                        {item.category} · qty {item.quantity}{item.equipped ? " · equipped" : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ padding: 16, paddingTop: 8, gap: 10 }}>
              <TouchableOpacity
                onPress={handleExportItems}
                activeOpacity={0.85}
                style={[styles.importConfirm, { backgroundColor: exportSelectedIds.size === 0 ? c.muted : c.primary }]}
                disabled={exportSelectedIds.size === 0}
              >
                <Feather name="share-2" size={16} color="#fff" />
                <Text style={[styles.importConfirmText, { color: "#fff" }]}>
                  Export {exportSelectedIds.size} item{exportSelectedIds.size !== 1 ? "s" : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Import items modal ── */}
      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.card, borderRadius: colors.radius * 2 }]}>
            <ScrollHintScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: c.foreground }]}>Import Items</Text>
              <Text style={[{ fontSize: 13, color: c.mutedForeground, marginBottom: 16, lineHeight: 18 }]}>
                Import a JSON array of items, or paste a full character snapshot — items will be added to your existing inventory.
              </Text>

              {/* File picker */}
              <TouchableOpacity
                onPress={handlePickImportFile}
                disabled={importBusy}
                activeOpacity={0.8}
                style={[styles.importPickBtn, { backgroundColor: c.primary, borderRadius: colors.radius }]}
              >
                <Feather name="file-text" size={16} color={c.primaryForeground} />
                <Text style={[styles.importPickBtnText, { color: c.primaryForeground }]}>
                  {importBusy ? "Reading…" : "Pick JSON File"}
                </Text>
              </TouchableOpacity>

              <View style={styles.importOrRow}>
                <View style={[styles.importOrLine, { backgroundColor: c.border }]} />
                <Text style={[styles.importOrText, { color: c.mutedForeground }]}>or paste JSON</Text>
                <View style={[styles.importOrLine, { backgroundColor: c.border }]} />
              </View>

              <TextInput
                value={importPaste}
                onChangeText={(v) => { setImportPaste(v); setImportError(null); }}
                multiline
                numberOfLines={8}
                placeholder={"[\n  { \"name\": \"Longsword\", \"category\": \"weapon\", \"quantity\": 1 },\n  ...\n]"}
                placeholderTextColor={c.mutedForeground}
                style={[
                  styles.importPasteInput,
                  { color: c.foreground, backgroundColor: c.secondary, borderColor: importError ? "#EF4444" : c.border, borderRadius: colors.radius },
                ]}
              />

              {importError && (
                <View style={[styles.importError, { backgroundColor: "#EF444415", borderColor: "#EF4444", borderRadius: colors.radius }]}>
                  <Feather name="alert-circle" size={14} color="#EF4444" />
                  <Text style={[styles.importErrorText, { color: "#EF4444" }]}>{importError}</Text>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={() => { setShowImportModal(false); setImportPaste(""); setImportError(null); }}
                  style={[styles.modalBtn, { backgroundColor: c.secondary, borderRadius: colors.radius }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalBtnText, { color: c.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleImportItems()}
                  disabled={!importPaste.trim()}
                  activeOpacity={0.8}
                  style={[
                    styles.modalBtn,
                    { backgroundColor: importPaste.trim() ? "#10B981" : c.secondary, borderRadius: colors.radius },
                  ]}
                >
                  <Text style={[styles.modalBtnText, { color: importPaste.trim() ? "#FFFFFF" : c.mutedForeground }]}>
                    Import
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollHintScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InventoryGridSection({
  items,
  expandedGridItemId,
  setExpandedGridItemId,
  toggleInventoryPinned,
  updateItem,
  removeItem,
  toggleEquipped,
  splitStackItem,
  mergeStackItem,
}: {
  items: InventoryItem[];
  expandedGridItemId: string | null;
  setExpandedGridItemId: React.Dispatch<React.SetStateAction<string | null>>;
  toggleInventoryPinned: (itemId: string) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  removeItem: (id: string) => void;
  toggleEquipped: (id: string) => void;
  splitStackItem: (id: string, qty: number) => void;
  mergeStackItem: (id: string) => void;
}) {
  const c = useColors();
  const { width } = useWindowDimensions();

  if (items.length === 0) return null;

  const columns = width >= 1100 ? 4 : width >= 760 ? 3 : width >= 430 ? 2 : 1;

  const rows = [];
  let compactRow: InventoryItem[] = [];

  const flushCompactRow = (keyPrefix: string) => {
    if (compactRow.length === 0) return;
    const rowItems = compactRow;
    rows.push(
      <View key={`${keyPrefix}-${rowItems.map((rowItem) => rowItem.id).join("-")}`} style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        {rowItems.map((rowItem) => (
          <View key={rowItem.id} style={{ flex: 1 }}>
            <InventoryGridCard
              item={rowItem}
              onPress={() => setExpandedGridItemId((prev) => (prev === rowItem.id ? null : rowItem.id))}
              onLongPress={() => toggleInventoryPinned(rowItem.id)}
            />
          </View>
        ))}
        {Array.from({ length: Math.max(0, columns - rowItems.length) }).map((_, spacerIdx) => (
          <View key={`${keyPrefix}-spacer-${spacerIdx}`} style={{ flex: 1 }} />
        ))}
      </View>
    );
    compactRow = [];
  };

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    if (item.id === expandedGridItemId) {
      flushCompactRow(`before-${i}`);
      rows.push(
        <View key={`expanded-${item.id}`} style={{ width: "100%", marginBottom: 10 }}>
          <InventoryItemRow
            item={item}
            initiallyExpanded
            onHeaderPressOverride={() => setExpandedGridItemId(null)}
            onUpdate={(updates) => updateItem(item.id, updates)}
            onRemove={() => removeItem(item.id)}
            onToggleEquip={() => toggleEquipped(item.id)}
            onTogglePin={() => toggleInventoryPinned(item.id)}
            onSplitStack={(qty) => splitStackItem(item.id, qty)}
            onMergeStack={() => mergeStackItem(item.id)}
          />
          <TouchableOpacity
            onPress={() => setExpandedGridItemId(null)}
            style={{ alignSelf: "center", marginTop: 4, marginBottom: 2 }}
            activeOpacity={0.7}
          >
            <Text style={{ color: c.primary, fontWeight: "600", fontSize: 13 }}>
              Collapse
            </Text>
          </TouchableOpacity>
        </View>
      );
      continue;
    }

    compactRow.push(item);
    if (compactRow.length === columns) {
      flushCompactRow(`row-${i}`);
    }
  }

  flushCompactRow("tail");
  return <View style={{ width: "100%" }}>{rows}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  modeTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingTop: 4,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 10,
    gap: 3,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  modeTabLabel: { fontSize: 11, fontWeight: "600" },
  modeRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  actionBtnText: { fontSize: 14, fontWeight: "700" },
  filterScroll: { marginBottom: 12 },
  filterRow: { gap: 8, paddingRight: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontWeight: "600" },
  countText: { fontSize: 12, marginBottom: 10 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
  inventorySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    marginTop: 2,
  },
  inventorySectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  inventorySectionCount: {
    fontSize: 11,
    fontWeight: "600",
  },
  wishlistComposer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  wishlistCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  wishlistActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  wishlistActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { maxHeight: "92%", padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  importConfirm: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  importConfirmText: { fontSize: 16, fontWeight: "700" },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  fieldInput: { padding: 12, fontSize: 15, borderWidth: 1 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  twoCol: { flexDirection: "row", gap: 10 },

  weaponSection: { borderTopWidth: 1, marginTop: 16, paddingTop: 14 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  sectionSub: { fontSize: 12, marginBottom: 4 },

  abilityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  abilityChip: { alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, minWidth: 46 },
  abilityChipLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  abilityChipMod: { fontSize: 14, fontWeight: "800", marginTop: 2 },

  profToggle: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginTop: 10, borderWidth: 1 },
  profToggleIcon: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  profToggleLabel: { fontSize: 13, fontWeight: "700" },
  profToggleSub: { fontSize: 11, marginTop: 2 },

  atkPreview: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, marginTop: 10, flexWrap: "wrap" },
  atkPreviewLabel: { fontSize: 12, fontWeight: "600" },
  atkPreviewValue: { fontSize: 20, fontWeight: "800" },
  atkPreviewBreakdown: { fontSize: 12 },

  rangeInputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  rangeInput: { flex: 1, fontSize: 15, padding: 0 },
  rangeUnit: { fontSize: 14, fontWeight: "600", marginLeft: 4 },
  imageActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, paddingVertical: 10 },

  effectsSection: { borderTopWidth: 1, marginTop: 16, paddingTop: 14 },
  effectItem: { flexDirection: "row", alignItems: "flex-start", padding: 10, marginBottom: 8 },
  effectItemLeft: { flex: 1 },
  effectTypePill: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, marginBottom: 4 },
  effectTypeText: { fontSize: 10, fontWeight: "700" },
  effectItemLabel: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  effectItemDesc: { fontSize: 12 },
  removeEffectBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginLeft: 8, borderWidth: 1 },
  addEffectBox: { padding: 12, marginBottom: 4 },
  addEffectTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 6 },
  effectInput: { padding: 10, fontSize: 13, marginBottom: 8, borderWidth: 1 },
  addEffectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 10 },

  modalButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, padding: 14, alignItems: "center" },
  modalBtnText: { fontSize: 15, fontWeight: "700" },

  moreBtn: {
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menuSheet: { margin: 12, padding: 16, paddingBottom: 8 },
  menuTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  menuIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuText: { flex: 1 },
  menuRowTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  menuRowSub: { fontSize: 12 },
  menuCancel: { marginTop: 10, marginBottom: 4, padding: 14, alignItems: "center" },
  menuCancelText: { fontSize: 15, fontWeight: "600" },

  importPickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, marginBottom: 4 },
  importPickBtnText: { fontSize: 14, fontWeight: "700" },
  importOrRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  importOrLine: { flex: 1, height: 1 },
  importOrText: { fontSize: 12, fontWeight: "500" },
  importPasteInput: {
    minHeight: 140,
    borderWidth: 1,
    padding: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    lineHeight: 18,
    textAlignVertical: "top",
  },
  importError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  importErrorText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
