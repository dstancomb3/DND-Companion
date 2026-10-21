import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ScrollView,
  Image,
  Alert,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { useColors } from "@/hooks/useColors";
import colors from "@/constants/colors";
import type { InventoryItem, ItemCategory, ItemEffect, ItemEffectType, ActionType, AbilityScores, EquippedStatKey, AdditionalDamage, Open5eFeat } from "@/types";
import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { STAT_KEY_LABELS, STAT_KEY_ORDER, statBonusLabel } from "@/data/itemStats";
import { SPELL_LIST, SCHOOL_COLORS } from "@/data/spellList";
import type { SpellEntry } from "@/data/spellList";
import { findFeatureFeats, formatFeatureFeatDescription } from "@/data/featureFeats";
import { tagsForCategory, subtypesForCategory } from "@/data/itemSubtypes";
import { isConsumptionCategory, isEquippableCategory } from "@/data/itemCategoryRules";
import { getRuntimeItemProjectedEffects, normalizeRuntimeInventoryItem } from "@/utils/mechanics/runtimeMechanicsCompatibility";
import {
  buildInventoryStackKey,
} from "@/utils/equipment/inventoryStacks";

import {
  INVENTORY_CATEGORY_COLORS,
  ITEM_EFFECT_TYPE_COLORS,
  ACTION_TYPE_COLORS as SEMANTIC_ACTION_TYPE_COLORS,
} from "@/constants/semanticColors";

export const CATEGORY_COLORS: Record<ItemCategory, string> = INVENTORY_CATEGORY_COLORS;

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  weapon: "Weapon",
  armor: "Armor",
  accessory: "Accessory",
  consumable: "Consumable",
  quest: "Quest",
  magic: "Magic",
  gear: "Gear",
  treasure: "Treasure",
  map: "Map",
  other: "Other",
};

const ALL_EDIT_CATEGORIES: { label: string; value: ItemCategory }[] = [
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
  stat_bonus: "Stat (+N)",
  attack_damage: "Attack",
  spell: "Grant Spell",
  buff: "Passive Buff",
  feature: "Feat / Feature",
  note: "Note",
};

const EFFECT_TYPE_HINTS: Record<ItemEffectType, string> = {
  stat_bonus: "Numerically changes a stat (AC, DEX, Initiative…)",
  attack_damage: "Adds a hit die, damage modifier, damage type, and optional to-hit modifier to attacks while equipped",
  spell: "Grants use of a spell — no slot required",
  buff: "Descriptive passive benefit (resistance, advantage…). Optionally also bumps a stat.",
  feature: "Pick a feat from the catalog or add a custom item feature.",
  note: "Just a reminder note, no mechanical effect",
};

const EFFECT_TYPE_COLORS: Record<ItemEffectType, string> = {
  stat_bonus: ITEM_EFFECT_TYPE_COLORS.stat_bonus,
  attack_damage: ITEM_EFFECT_TYPE_COLORS.attack_damage,
  spell: ITEM_EFFECT_TYPE_COLORS.spell,
  buff: ITEM_EFFECT_TYPE_COLORS.buff,
  feature: ITEM_EFFECT_TYPE_COLORS.feature,
  note: ITEM_EFFECT_TYPE_COLORS.note,
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
function stripFt(val: string): string { return val.replace(/\s*ft\s*$/i, "").trim(); }

const FLAVOR_ADJECTIVES = [
  "Ancient", "Arcane", "Blessed", "Corrupted", "Cursed", "Dwarven", "Elven",
  "Enchanted", "Ethereal", "Fey-touched", "Forged", "Gilded", "Hallowed",
  "Infernal", "Luminous", "Mythril", "Obsidian", "Runic", "Sacred", "Shadow",
  "Silvered", "Spectral", "Titanium", "Twilight", "Void-kissed", "Warded",
];
const FLAVOR_MATERIALS = [
  "bone", "crystal", "darkwood", "dragonscale", "ember-forged iron", "feywild silk",
  "frosted steel", "glass", "gold", "living oak", "midnight-alloy",
  "moonshard", "obsidian", "orichalcum", "pale stone", "phoenix feather",
  "runed bronze", "sea-jade", "shadowsteel", "starfall iron", "thunderwood",
  "void-iron",
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
];
function randomFlavorText(name: string): string {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(FLAVOR_ADJECTIVES)} ${name.toLowerCase()} crafted from ${pick(FLAVOR_MATERIALS)}, this piece ${pick(FLAVOR_DESCRIPTORS)}.`;
}

function isPortableMapImageUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  return /^data:image\//i.test(trimmed) || /^https?:\/\//i.test(trimmed);
}

interface InventoryItemRowProps {
  item: InventoryItem;
  onUpdate: (updates: Partial<InventoryItem>) => void;
  onRemove: () => void;
  onToggleEquip: () => void;
  onTogglePin?: () => void;
  onSplitStack?: (splitQty: number) => void;
  onMergeStack?: () => void;
  drag?: () => void;
  isActive?: boolean;
  initiallyExpanded?: boolean;
  onHeaderPressOverride?: () => void;
}

export function InventoryItemRow({ item, onUpdate, onRemove, onToggleEquip, onTogglePin, onSplitStack, onMergeStack, drag, isActive, initiallyExpanded = false, onHeaderPressOverride }: InventoryItemRowProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { settings } = useAppSettings();
  const { character, inventory } = useCharacter();

  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [showEdit, setShowEdit] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitQtyText, setSplitQtyText] = useState("1");

  // Edit modal state
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState<ItemCategory>(item.category);
  const [editNotes, setEditNotes] = useState(item.notes ?? "");
  const [editQty, setEditQty] = useState(String(item.quantity));

  const [editAbility, setEditAbility] = useState<keyof AbilityScores>(item.attackAbility ?? "strength");
  const [editIsProficient, setEditIsProficient] = useState(item.isProficient !== false);
  const [editUseAbilityDamage, setEditUseAbilityDamage] = useState(item.useAbilityModifierForDamage !== false);
  const [editDamageDice, setEditDamageDice] = useState(item.damageDice ?? "");
  const [editDmgMod, setEditDmgMod] = useState(item.damageModifier !== undefined ? String(item.damageModifier) : "");
  const [editDmgType, setEditDmgType] = useState(item.damageType ?? "");
  const [editRange, setEditRange] = useState(stripFt(item.weaponRange ?? ""));

  const [editAdditionalDamage, setEditAdditionalDamage] = useState<AdditionalDamage[]>(item.additionalDamage ?? []);
  const [newExtraDice, setNewExtraDice] = useState("");
  const [newExtraDmgType, setNewExtraDmgType] = useState("");
  const [editSuppressWeapon, setEditSuppressWeapon] = useState(item.suppressWeaponCard ?? false);
  const [editSubtype, setEditSubtype] = useState(item.subtype ?? "");
  const [editTags, setEditTags] = useState<string[]>(item.tags ?? []);

  const [editEffects, setEditEffects] = useState<ItemEffect[]>(getRuntimeItemProjectedEffects(item));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newEffectLabel, setNewEffectLabel] = useState("");
  const [newEffectDesc, setNewEffectDesc] = useState("");
  const [newEffectType, setNewEffectType] = useState<ItemEffectType>("stat_bonus");
  const [newEffectStatKey, setNewEffectStatKey] = useState<EquippedStatKey | null>(null);
  const [newEffectStatMagnitude, setNewEffectStatMagnitude] = useState("1");
  const [newEffectStatSign, setNewEffectStatSign] = useState<"+" | "-">("+");
  const [newEffectAtkDice, setNewEffectAtkDice] = useState("");
  const [newEffectAtkDmgType, setNewEffectAtkDmgType] = useState("");
  const [newEffectAtkDamageMagnitude, setNewEffectAtkDamageMagnitude] = useState("1");
  const [newEffectAtkDamageSign, setNewEffectAtkDamageSign] = useState<"+" | "-">("+");
  const [newEffectAtkToHitMagnitude, setNewEffectAtkToHitMagnitude] = useState("0");
  const [newEffectAtkToHitSign, setNewEffectAtkToHitSign] = useState<"+" | "-">("+");

  // Spell-grant effect fields
  const [newEffectSpellSearch, setNewEffectSpellSearch] = useState("");
  const [newEffectSpellEntry, setNewEffectSpellEntry] = useState<SpellEntry | null>(null);
  const [newEffectFeatureEntry, setNewEffectFeatureEntry] = useState<Open5eFeat | null>(null);
  const [newEffectUses, setNewEffectUses] = useState("1");
  const [newEffectResetOn, setNewEffectResetOn] = useState<"short_rest" | "long_rest" | "dawn">("long_rest");
  // Optional stat key/value for "buff" type
  const [newEffectBuffStatKey, setNewEffectBuffStatKey] = useState<EquippedStatKey | null>(null);
  const [newEffectBuffStatVal, setNewEffectBuffStatVal] = useState("1");

  // Inline effect editing
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);
  const [editingEffLabel, setEditingEffLabel] = useState("");
  const [editingEffDesc, setEditingEffDesc] = useState("");
  const [editingEffType, setEditingEffType] = useState<ItemEffectType>("buff");
  const [editingEffActionType, setEditingEffActionType] = useState<ActionType | null>(null);

  const catColor = CATEGORY_COLORS[item.category];
  const isWeaponItem = item.category === "weapon";
  const isEquippableItem = isEquippableCategory(item.category);
  const hasMergeTarget = React.useMemo(() => {
    if (item.equipped) return false;
    const sourceKey = buildInventoryStackKey({ ...item, equipped: false });
    return inventory.some((entry) => (
      entry.id !== item.id
      && !entry.equipped
      && buildInventoryStackKey({ ...entry, equipped: false }) === sourceKey
    ));
  }, [inventory, item]);
  const legacyDmMapImageUri = React.useMemo(() => {
    if (item.category !== "map" || !item.notes) return undefined;
    const match = item.notes.match(/^Map Image:\s*(.+)$/im);
    const candidate = match?.[1]?.trim();
    if (!candidate || candidate.length === 0) return undefined;
    return isPortableMapImageUri(candidate) ? candidate : undefined;
  }, [item.category, item.notes]);
  const resolvedImageUri = item.imageUri && isPortableMapImageUri(item.imageUri)
    ? item.imageUri
    : legacyDmMapImageUri;
  const isDmProvidedMapImage = item.category === "map"
    && Boolean(resolvedImageUri)
    && (item.imageSource === "dm" || Boolean(legacyDmMapImageUri));
  const displayNotes = React.useMemo(() => {
    if (!item.notes) return "";
    return item.notes
      .replace(/^Map Image:\s*.+$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }, [item.notes]);
  const isConsumptionItem = isConsumptionCategory(item.category);
  const isWeaponEdit = editCategory === "weapon";
  const sourceTag = item.sourceTag ?? "custom";
  const sourceTagMode = settings.spellSourceTagStyle;

  function renderSourceTag() {
    if (sourceTagMode === "hidden") return null;
    if (sourceTagMode === "dot") {
      return (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginLeft: 4,
            backgroundColor: sourceTag === "official" ? "#3B82F6" : "#EF4444",
          }}
        />
      );
    }

    const label = sourceTagMode === "compact" ? (sourceTag === "official" ? "O" : "C") : (sourceTag === "official" ? "OFFICIAL" : "CUSTOM");
    const bg = sourceTag === "official" ? "#3B82F620" : "#EF444420";
    const fg = sourceTag === "official" ? "#3B82F6" : "#EF4444";

    return (
      <View style={{ marginLeft: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: bg }}>
        <Text style={{ fontSize: 9, fontWeight: "700", color: fg, letterSpacing: 0.4 }}>{label}</Text>
      </View>
    );
  }

  const computedAbilityMod = abilityMod(character.abilityScores[editAbility]);
  const computedAtkBonus = computedAbilityMod + (editIsProficient ? character.proficiencyBonus : 0);

  const savedAbility = item.attackAbility ?? "strength";
  const savedProficient = item.isProficient !== false;
  const rowAtkBonus = abilityMod(character.abilityScores[savedAbility]) + (savedProficient ? character.proficiencyBonus : 0);

  const hasAtkStats = isWeaponItem && !!item.damageDice;
  const projectedEffects = getRuntimeItemProjectedEffects(item);
  const activeEffects = isEquippableItem && item.equipped ? projectedEffects : [];
  const inactiveEffects = isEquippableItem && !item.equipped ? projectedEffects : [];
  const consumptionEffects = !isEquippableItem ? projectedEffects : [];
  const featureMatches = newEffectType === "feature" ? findFeatureFeats(newEffectLabel, 8) : [];

  const handlePickImage = async () => {
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
        const dest = dir + "item_" + item.id + "_" + Date.now() + "." + ext;
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        onUpdate({ imageUri: dest });
      } else {
        onUpdate({ imageUri: asset.uri });
      }
    } catch {
      onUpdate({ imageUri: asset.uri });
    }
  };

  const handleRemoveImage = () => {
    onUpdate({ imageUri: undefined });
  };

  const openEdit = () => {
    setEditName(item.name);
    setEditCategory(item.category);
    setEditNotes(item.notes ?? "");
    setEditQty(String(item.quantity));
    setEditAbility(item.attackAbility ?? "strength");
    setEditIsProficient(item.isProficient !== false);
    setEditUseAbilityDamage(item.useAbilityModifierForDamage !== false);
    setEditDamageDice(item.damageDice ?? "");
    setEditDmgMod(item.damageModifier !== undefined ? String(item.damageModifier) : "");
    setEditDmgType(item.damageType ?? "");
    setEditRange(stripFt(item.weaponRange ?? ""));
    setEditAdditionalDamage(item.additionalDamage ?? []);
    setNewExtraDice("");
    setNewExtraDmgType("");
    setEditEffects(getRuntimeItemProjectedEffects(item));
    setNewEffectLabel("");
    setNewEffectDesc("");
    setNewEffectType("stat_bonus");
    setNewEffectStatKey(null);
    setNewEffectStatMagnitude("1");
    setNewEffectStatSign("+");
    setNewEffectAtkDice("");
    setNewEffectAtkDmgType("");
    setNewEffectAtkDamageMagnitude("1");
    setNewEffectAtkDamageSign("+");
    setNewEffectAtkToHitMagnitude("0");
    setNewEffectAtkToHitSign("+");
    setNewEffectSpellSearch("");
    setNewEffectSpellEntry(null);
    setNewEffectFeatureEntry(null);
    setNewEffectUses("1");
    setNewEffectResetOn("long_rest");
    setNewEffectBuffStatKey(null);
    setNewEffectBuffStatVal("1");
    setShowEdit(true);
  };

  const handleAddEffect = () => {
    // Spell grant type — uses spell picker selection
    if (newEffectType === "spell") {
      const spellLabel = newEffectSpellEntry
        ? `${newEffectSpellEntry.name} ${newEffectUses}/day`
        : newEffectLabel.trim();
      if (!spellLabel) return;
      const uses = parseInt(newEffectUses) || 1;
      setEditEffects((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "spell",
          label: spellLabel,
          description: newEffectSpellEntry?.desc || newEffectDesc.trim() || undefined,
          uses,
          resetOn: newEffectResetOn,
        },
      ]);
      setNewEffectLabel("");
      setNewEffectDesc("");
      setNewEffectSpellSearch("");
      setNewEffectSpellEntry(null);
      setNewEffectFeatureEntry(null);
      setNewEffectUses("1");
      setNewEffectResetOn("long_rest");
      return;
    }

    const statKey = newEffectType === "stat_bonus" ? (newEffectStatKey ?? undefined) : undefined;
    const statMagnitude = Math.max(1, parseInt(newEffectStatMagnitude, 10) || 1);
    const statValue = statKey != null ? (newEffectStatSign === "-" ? -statMagnitude : statMagnitude) : undefined;
    const autoFilledStat = statKey != null && statValue != null ? statBonusLabel(statKey, statValue) : "";
    const atkDice = newEffectType === "attack_damage" ? newEffectAtkDice.trim() || undefined : undefined;
    const atkDmgType = newEffectType === "attack_damage" ? newEffectAtkDmgType.trim() || undefined : undefined;
    const atkDamageMagnitude = Math.max(1, parseInt(newEffectAtkDamageMagnitude, 10) || 1);
    const atkDamageBonus = newEffectType === "attack_damage" ? (newEffectAtkDamageSign === "-" ? -atkDamageMagnitude : atkDamageMagnitude) : undefined;
    const atkToHitMagnitude = Math.max(0, parseInt(newEffectAtkToHitMagnitude, 10) || 0);
    const atkToHitBonus = newEffectType === "attack_damage"
      ? (atkToHitMagnitude === 0 ? 0 : (newEffectAtkToHitSign === "-" ? -atkToHitMagnitude : atkToHitMagnitude))
      : undefined;
    const autoFilledAtk = atkDice && atkDmgType
      ? `Attack: ${atkDice}${atkDamageBonus ? (atkDamageBonus > 0 ? `+${atkDamageBonus}` : `${atkDamageBonus}`) : ""} ${atkDmgType}${atkToHitBonus ? `, ${atkToHitBonus > 0 ? `+${atkToHitBonus}` : atkToHitBonus} to hit` : ""}`
      : "";

    // Buff type — optional numeric stat bonus
    const buffStatKey = newEffectType === "buff" ? (newEffectBuffStatKey ?? undefined) : undefined;
    const buffStatValue = buffStatKey != null ? (parseInt(newEffectBuffStatVal) || 1) : undefined;

    const label = newEffectLabel.trim() || autoFilledStat || autoFilledAtk;
    if (!label) return;

    setEditEffects((prev) => [
      ...prev,
      {
        id: generateId(),
        type: newEffectType,
        label,
        description: newEffectDesc.trim() || undefined,
        statKey: statKey ?? buffStatKey,
        statValue: statValue ?? buffStatValue,
        attackDamageDice: atkDice,
        attackDamageBonus: atkDamageBonus,
        attackDamageType: atkDmgType,
        attackToHitBonus: atkToHitBonus,
      },
    ]);
    setNewEffectLabel("");
    setNewEffectDesc("");
    setNewEffectStatKey(null);
    setNewEffectStatMagnitude("1");
    setNewEffectStatSign("+");
    setNewEffectAtkDice("");
    setNewEffectAtkDmgType("");
    setNewEffectAtkDamageMagnitude("1");
    setNewEffectAtkDamageSign("+");
    setNewEffectAtkToHitMagnitude("0");
    setNewEffectAtkToHitSign("+");
    setNewEffectBuffStatKey(null);
    setNewEffectBuffStatVal("1");
  };

  const handleRemoveEffect = (id: string) => {
    setEditEffects((prev) => prev.filter((e) => e.id !== id));
  };

  const openEditEffect = (effect: ItemEffect) => {
    setEditingEffectId(effect.id);
    setEditingEffLabel(effect.label);
    setEditingEffDesc(effect.description ?? "");
    setEditingEffType(effect.type);
    setEditingEffActionType(effect.actionType ?? null);
  };

  const handleSaveEffect = () => {
    if (!editingEffectId) return;
    setEditEffects((prev) =>
      prev.map((e) =>
        e.id !== editingEffectId
          ? e
          : {
              ...e,
              label: editingEffLabel.trim() || e.label,
              description: editingEffDesc.trim() || undefined,
              type: editingEffType,
              actionType: editingEffActionType ?? undefined,
            }
      )
    );
    setEditingEffectId(null);
  };

  const handleSave = () => {
    const qty = parseInt(editQty);
    const dmgMod = editDmgMod.trim() !== "" ? parseInt(editDmgMod) : undefined;
    const rangeVal = editRange.trim();
    // Auto-commit any pending extra damage still in the input fields
    const pendingExtra =
      newExtraDice.trim() && newExtraDmgType.trim()
        ? [{ dice: newExtraDice.trim(), damageType: newExtraDmgType.trim() }]
        : [];
    const finalAdditionalDamage = [...editAdditionalDamage, ...pendingExtra];
    // Clear the old mechanics block so normalizeRuntimeInventoryItem in updateItem
    // re-synthesizes it from the user's edited compatibility fields (effects + weapon stats).
    onUpdate({
      name: editName.trim() || item.name,
      category: editCategory,
      notes: editNotes.trim() || undefined,
      quantity: isNaN(qty) || qty < 1 ? item.quantity : qty,
      equippedEffects: editEffects.length > 0 ? editEffects : undefined,
      mechanics: undefined,
      attackAbility: isWeaponEdit && editDamageDice.trim() ? editAbility : undefined,
      isProficient: isWeaponEdit && editDamageDice.trim() ? editIsProficient : undefined,
      useAbilityModifierForDamage:
        isWeaponEdit && editDamageDice.trim() ? (editUseAbilityDamage ? undefined : false) : undefined,
      damageDice: isWeaponEdit && editDamageDice.trim() ? editDamageDice.trim() : undefined,
      damageModifier: isWeaponEdit && !isNaN(dmgMod as number) ? dmgMod : undefined,
      damageType: isWeaponEdit && editDmgType.trim() ? editDmgType.trim() : undefined,
      additionalDamage: isWeaponEdit && finalAdditionalDamage.length > 0 ? finalAdditionalDamage : undefined,
      weaponRange: isWeaponEdit && rangeVal ? rangeVal + " ft" : undefined,
      suppressWeaponCard: isWeaponEdit && editSuppressWeapon ? true : undefined,
      subtype: editSubtype.trim() || undefined,
      tags: editTags.length > 0 ? editTags : undefined,
      sourceTag: item.sourceTag ?? "custom",
    });
    setShowEdit(false);
  };

  const handleDelete = () => {
    setConfirmDelete(true);
  };

  return (
    <>
      <View
        style={[
          styles.card,
          {
            backgroundColor: c.card,
            borderColor: expanded ? catColor + "88" : c.border,
            borderRadius: c.radius,
            borderLeftColor: catColor,
          },
        ]}
      >
        {/* ── Compact header row — always visible, tappable to expand ─── */}
        <View style={[styles.header, isActive && { opacity: 0.85 }]}>
          {drag && (
            <TouchableWithoutFeedback onLongPress={drag}>
              <View style={{ padding: 5, justifyContent: 'center' }}>
                <Feather name="menu" size={15} color={c.mutedForeground} />
              </View>
            </TouchableWithoutFeedback>
          )}
          <TouchableOpacity
            onPress={onHeaderPressOverride ?? (() => setExpanded((v) => !v))}
            onLongPress={drag ?? onTogglePin}
            activeOpacity={0.85}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <View style={styles.headerLeft}>
            <View style={styles.titleLine}>
              <View style={[styles.catDot, { backgroundColor: catColor }]} />
              <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.equipped && (
                <View style={[styles.equippedBadge, { backgroundColor: "#10B98120" }]}>
                  <Text style={[styles.equippedText, { color: "#10B981" }]}>Equipped</Text>
                </View>
              )}
              {resolvedImageUri ? (
                <Feather name="image" size={12} color="#14B8A6" style={{ marginLeft: 4 }} />
              ) : null}
              {item.pinned ? <Feather name="bookmark" size={13} color={catColor} style={{ marginLeft: 4 }} /> : null}
              {renderSourceTag()}
            </View>

            <View style={styles.metaLine}>
              <Text style={[styles.catLabel, { color: catColor }]}>
                {item.subtype ?? CATEGORY_LABELS[item.category]}
              </Text>
              {item.subtype ? (
                <Text style={[styles.catLabel, { color: catColor + "88", marginLeft: 4 }]}>
                  · {CATEGORY_LABELS[item.category]}
                </Text>
              ) : null}
              {!expanded && displayNotes ? (
                <Text style={[styles.notesTrunc, { color: c.mutedForeground }]} numberOfLines={1}>
                  {" · "}{displayNotes}
                </Text>
              ) : null}
            </View>
            {item.tags && item.tags.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                {item.tags.map((tag) => (
                  <View key={tag} style={{ backgroundColor: catColor + "18", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: catColor }}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {hasAtkStats && (
              <View style={styles.chipRow}>
                <View style={[styles.statChip, { backgroundColor: "#EF444420" }]}>
                  <Text style={[styles.statChipText, { color: "#EF4444" }]}>
                    ATK {fmtMod(rowAtkBonus)} ({ABILITY_SHORT[savedAbility]})
                  </Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: "#EF444420" }]}>
                  <Text style={[styles.statChipText, { color: "#EF4444" }]}>
                    {item.damageDice}{item.damageModifier !== undefined ? fmtMod(item.damageModifier) : ""}
                    {item.damageType ? ` ${item.damageType}` : ""}
                  </Text>
                </View>
                {item.weaponRange && (
                  <View style={[styles.statChip, { backgroundColor: c.secondary }]}>
                    <Text style={[styles.statChipText, { color: c.mutedForeground }]}>{item.weaponRange}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.headerRight}>
            <Text style={[styles.qty, { color: c.primary }]}>×{item.quantity}</Text>
            <Feather
              name={expanded ? "chevron-up" : "chevron-down"}
              size={15}
              color={c.mutedForeground}
            />
          </View>
          </TouchableOpacity>
        </View>

        {/* ── Expanded detail panel ───────────────────────────────────── */}
        {expanded && (
          <View style={[styles.detail, { borderTopColor: c.border }]}>

            {/* Full notes */}
            {displayNotes ? (
              <Text style={[styles.detailNotes, { color: c.mutedForeground }]}>{displayNotes}</Text>
            ) : null}

            {/* Weapon detail block */}
            {hasAtkStats && (
              <View style={[styles.detailBlock, { backgroundColor: c.secondary, borderRadius: c.radius }]}>
                <Text style={[styles.detailBlockTitle, { color: c.mutedForeground }]}>ATTACK</Text>
                <View style={styles.detailStatRow}>
                  <View style={styles.detailStat}>
                    <Text style={[styles.detailStatVal, { color: "#EF4444" }]}>{fmtMod(rowAtkBonus)}</Text>
                    <Text style={[styles.detailStatLabel, { color: c.mutedForeground }]}>To Hit</Text>
                  </View>
                  <View style={[styles.detailDivider, { backgroundColor: c.border }]} />
                  <View style={styles.detailStat}>
                    <Text style={[styles.detailStatVal, { color: c.foreground }]}>
                      {item.damageDice}{item.damageModifier !== undefined ? fmtMod(item.damageModifier) : ""}
                    </Text>
                    <Text style={[styles.detailStatLabel, { color: c.mutedForeground }]}>
                      {item.damageType ?? "Damage"}
                    </Text>
                  </View>
                  {item.weaponRange && (
                    <>
                      <View style={[styles.detailDivider, { backgroundColor: c.border }]} />
                      <View style={styles.detailStat}>
                        <Text style={[styles.detailStatVal, { color: c.foreground }]}>{item.weaponRange}</Text>
                        <Text style={[styles.detailStatLabel, { color: c.mutedForeground }]}>Range</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* Active effects (equipped) */}
            {activeEffects.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={[styles.detailSectionLabel, { color: c.mutedForeground }]}>ACTIVE EFFECTS</Text>
                {activeEffects.map((effect) => (
                  <View
                    key={effect.id}
                    style={[styles.effectRow, { backgroundColor: EFFECT_TYPE_COLORS[effect.type] + "18", borderRadius: c.radius }]}
                  >
                    <View style={[styles.effectDot, { backgroundColor: EFFECT_TYPE_COLORS[effect.type] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.effectLabel, { color: c.foreground }]}>{effect.label}</Text>
                      {effect.description ? (
                        <Text style={[styles.effectDesc, { color: c.mutedForeground }]}>{effect.description}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Consumption effects (non-equippable categories) */}
            {consumptionEffects.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={[styles.detailSectionLabel, { color: c.mutedForeground }]}>
                  {isConsumptionItem ? "CONSUMPTION EFFECTS" : "ITEM EFFECTS"}
                </Text>
                {consumptionEffects.map((effect) => (
                  <View
                    key={effect.id}
                    style={[
                      styles.effectRow,
                      {
                        backgroundColor: EFFECT_TYPE_COLORS[effect.type] + "12",
                        borderRadius: c.radius,
                      },
                    ]}
                  >
                    <View style={[styles.effectDot, { backgroundColor: EFFECT_TYPE_COLORS[effect.type] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.effectLabel, { color: c.foreground }]}>{effect.label}</Text>
                      {effect.description ? (
                        <Text style={[styles.effectDesc, { color: c.mutedForeground }]}>{effect.description}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Inactive effects (not yet equipped) */}
            {inactiveEffects.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={[styles.detailSectionLabel, { color: c.mutedForeground }]}>
                  EFFECTS WHEN EQUIPPED
                </Text>
                {inactiveEffects.map((effect) => (
                  <View
                    key={effect.id}
                    style={[
                      styles.effectRow,
                      {
                        backgroundColor: EFFECT_TYPE_COLORS[effect.type] + "10",
                        borderRadius: c.radius,
                        opacity: 0.75,
                      },
                    ]}
                  >
                    <View style={[styles.effectDot, { backgroundColor: EFFECT_TYPE_COLORS[effect.type] }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.effectLabel, { color: c.foreground }]}>{effect.label}</Text>
                        <View style={{ backgroundColor: EFFECT_TYPE_COLORS[effect.type] + "25", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: EFFECT_TYPE_COLORS[effect.type], textTransform: "uppercase" }}>
                            {effect.type.replace("_", " ")}
                          </Text>
                        </View>
                      </View>
                      {effect.description ? (
                        <Text style={[styles.effectDesc, { color: c.mutedForeground }]}>{effect.description}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Image attachment section */}
            {resolvedImageUri ? (
              <View style={{ gap: 8 }}>
                <Text style={[styles.detailSectionLabel, { color: c.mutedForeground }]}>ATTACHED IMAGE</Text>
                <TouchableOpacity onPress={() => setShowImageViewer(true)} activeOpacity={0.88}>
                  <Image
                    source={{ uri: resolvedImageUri }}
                    style={{ width: "100%", height: 180, borderRadius: c.radius }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                {isDmProvidedMapImage ? (
                  <Text style={{ fontSize: 12, color: c.mutedForeground }}>Provided by DM</Text>
                ) : (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={handlePickImage}
                      activeOpacity={0.8}
                      style={[styles.detailBtn, { flex: 1, backgroundColor: c.secondary, borderColor: c.border, borderRadius: c.radius }]}
                    >
                      <Feather name="image" size={14} color={c.foreground} />
                      <Text style={{ fontSize: 13, fontWeight: "600", color: c.foreground }}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleRemoveImage}
                      activeOpacity={0.8}
                      style={[styles.detailBtn, { flex: 1, backgroundColor: c.secondary, borderColor: c.border, borderRadius: c.radius }]}
                    >
                      <Feather name="x" size={14} color={c.destructive} />
                      <Text style={{ fontSize: 13, fontWeight: "600", color: c.destructive }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              !isDmProvidedMapImage && (
                <TouchableOpacity
                  onPress={handlePickImage}
                  activeOpacity={0.8}
                  style={[
                    styles.detailBtn,
                    { backgroundColor: c.secondary, borderColor: "#14B8A640", borderRadius: c.radius, alignSelf: "flex-start", paddingHorizontal: 16 },
                  ]}
                >
                  <Feather name="image" size={14} color="#14B8A6" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#14B8A6" }}>Attach Image</Text>
                </TouchableOpacity>
              )
            )}

            {/* Action buttons */}
            <View style={styles.detailActions}>
              {isEquippableItem ? (
                <TouchableOpacity
                  onPress={onToggleEquip}
                  activeOpacity={0.8}
                  style={[
                    styles.detailBtn,
                    {
                      backgroundColor: item.equipped ? "#10B98120" : c.secondary,
                      borderColor: item.equipped ? "#10B981" : c.border,
                      borderRadius: c.radius,
                    },
                  ]}
                >
                  <Feather name="shield" size={14} color={item.equipped ? "#10B981" : c.mutedForeground} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: item.equipped ? "#10B981" : c.mutedForeground }}>
                    {item.equipped ? "Unequip" : "Equip"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.detailBtn,
                    {
                      backgroundColor: c.secondary,
                      borderColor: c.border,
                      borderRadius: c.radius,
                      opacity: 0.8,
                    },
                  ]}
                >
                  <Feather name="slash" size={14} color={c.mutedForeground} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: c.mutedForeground }}>
                    Not Equippable
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={openEdit}
                activeOpacity={0.8}
                style={[styles.detailBtn, { backgroundColor: c.secondary, borderColor: c.border, borderRadius: c.radius }]}
              >
                <Feather name="edit-2" size={14} color={c.foreground} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: c.foreground }}>Edit</Text>
              </TouchableOpacity>

              {item.quantity > 1 && !showSplit && (
                <TouchableOpacity
                  onPress={() => { setShowSplit(true); setSplitQtyText("1"); }}
                  activeOpacity={0.8}
                  style={[styles.detailBtn, { backgroundColor: c.secondary, borderColor: c.border, borderRadius: c.radius }]}
                >
                  <Feather name="scissors" size={14} color={c.foreground} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: c.foreground }}>Split</Text>
                </TouchableOpacity>
              )}

              {hasMergeTarget && (
                <TouchableOpacity
                  onPress={onMergeStack}
                  activeOpacity={0.8}
                  style={[styles.detailBtn, { backgroundColor: "#10B98120", borderColor: "#10B981", borderRadius: c.radius }]}
                >
                  <Feather name="git-merge" size={14} color="#10B981" />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#10B981" }}>Merge</Text>
                </TouchableOpacity>
              )}

              {confirmDelete ? (
                <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setConfirmDelete(false)}
                    activeOpacity={0.8}
                    style={[styles.detailBtn, { flex: 1, backgroundColor: c.secondary, borderColor: c.border, borderRadius: c.radius }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: c.mutedForeground }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setConfirmDelete(false); onRemove(); }}
                    activeOpacity={0.8}
                    style={[styles.detailBtn, { flex: 1, backgroundColor: c.destructive + "20", borderColor: c.destructive, borderRadius: c.radius }]}
                  >
                    <Feather name="trash-2" size={14} color={c.destructive} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: c.destructive }}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleDelete}
                  activeOpacity={0.8}
                  style={[styles.detailBtn, { backgroundColor: c.secondary, borderColor: c.border, borderRadius: c.radius }]}
                >
                  <Feather name="trash-2" size={14} color={c.destructive} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: c.destructive }}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Split stack inline form */}
            {showSplit && item.quantity > 1 && (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 }}>
                <Text style={{ fontSize: 13, color: c.mutedForeground, flexShrink: 0 }}>
                  Split off (max {item.quantity - 1}):
                </Text>
                <TextInput
                  style={[
                    styles.fieldInput,
                    { flex: 1, backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius, marginBottom: 0, paddingVertical: 8 },
                  ]}
                  value={splitQtyText}
                  onChangeText={setSplitQtyText}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={c.mutedForeground}
                  maxLength={5}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  onPress={() => setShowSplit(false)}
                  activeOpacity={0.8}
                  style={[styles.detailBtn, { backgroundColor: c.secondary, borderColor: c.border, borderRadius: c.radius }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: c.mutedForeground }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const qty = parseInt(splitQtyText, 10);
                    if (!isNaN(qty) && qty >= 1 && qty < item.quantity) {
                      onSplitStack?.(qty);
                      setShowSplit(false);
                      setSplitQtyText("1");
                    }
                  }}
                  activeOpacity={0.8}
                  style={[styles.detailBtn, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B", borderRadius: c.radius }]}
                >
                  <Feather name="scissors" size={14} color="#F59E0B" />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#F59E0B" }}>Split</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Full-screen image viewer ────────────────────────────────── */}
      <Modal visible={showImageViewer} transparent animationType="fade" onRequestClose={() => setShowImageViewer(false)}>
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity
            onPress={() => setShowImageViewer(false)}
            activeOpacity={0.85}
            style={styles.imageViewerClose}
          >
            <Feather name="x" size={24} color="white" />
          </TouchableOpacity>
          {resolvedImageUri ? (
            <Image source={{ uri: resolvedImageUri }} style={{ flex: 1 }} resizeMode="contain" />
          ) : null}
          <View style={styles.imageViewerFooter}>
            <Text style={{ color: "white", fontSize: 14, fontWeight: "600" }}>{item.name}</Text>
            <Text style={{ color: "#ffffff80", fontSize: 12, marginTop: 2 }}>Tap × to close</Text>
          </View>
        </View>
      </Modal>

      {/* ── Edit modal ─────────────────────────────────────────────────── */}
      <Modal visible={showEdit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.card, borderRadius: c.radius * 2 }]}>
            <ScrollHintScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: c.foreground }]}>Edit Item</Text>

              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius }]}
              />

              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Quantity</Text>
              <TextInput
                value={editQty}
                onChangeText={setEditQty}
                keyboardType="number-pad"
                style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius }]}
              />

              {/* Category picker */}
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {ALL_EDIT_CATEGORIES.map((cat) => {
                    const selected = editCategory === cat.value;
                    return (
                      <TouchableOpacity
                        key={cat.value}
                        onPress={() => setEditCategory(cat.value)}
                        activeOpacity={0.7}
                        style={[
                          styles.catChip,
                          {
                            backgroundColor: selected ? CATEGORY_COLORS[cat.value] + "30" : c.secondary,
                            borderColor: selected ? CATEGORY_COLORS[cat.value] : "transparent",
                            borderRadius: c.radius,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? CATEGORY_COLORS[cat.value] : c.mutedForeground }}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Subtype picker — shown when category has subtypes */}
              {subtypesForCategory(editCategory).length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>
                    {editCategory === "weapon" ? "Weapon Type" : editCategory === "armor" ? "Armor Type" : "Type"}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <TouchableOpacity
                        key="none"
                        onPress={() => setEditSubtype("")}
                        activeOpacity={0.7}
                        style={[styles.catChip, {
                          backgroundColor: editSubtype === "" ? c.muted : c.secondary,
                          borderColor: editSubtype === "" ? c.mutedForeground : "transparent",
                          borderWidth: 1,
                          borderRadius: c.radius,
                        }]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "600", color: editSubtype === "" ? c.foreground : c.mutedForeground }}>None</Text>
                      </TouchableOpacity>
                      {subtypesForCategory(editCategory).map((sub) => {
                        const selected = editSubtype === sub;
                        const col = CATEGORY_COLORS[editCategory as ItemCategory] ?? "#6B7280";
                        return (
                          <TouchableOpacity
                            key={sub}
                            onPress={() => setEditSubtype(sub)}
                            activeOpacity={0.7}
                            style={[styles.catChip, {
                              backgroundColor: selected ? col + "30" : c.secondary,
                              borderColor: selected ? col : "transparent",
                              borderWidth: 1,
                              borderRadius: c.radius,
                            }]}
                          >
                            <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? col : c.mutedForeground }}>{sub}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </>
              )}

              {/* Tags — filtered to the selected category */}
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Tags</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {tagsForCategory(editCategory).map((tag) => {
                  const selected = editTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => setEditTags((prev) => selected ? prev.filter((t) => t !== tag) : [...prev, tag])}
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
                  onPress={() => setEditNotes(randomFlavorText(editName || item.name))}
                  activeOpacity={0.7}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#8B5CF620", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                >
                  <Feather name="zap" size={11} color="#8B5CF6" />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#8B5CF6" }}>Randomize</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                numberOfLines={3}
                placeholder="Item description or flavor text…"
                placeholderTextColor={c.mutedForeground}
                style={[
                  styles.fieldInput, styles.multiline,
                  { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius },
                ]}
              />

              {/* Weapon stats — shown when category is Weapon */}
              {isWeaponEdit && (
                <View style={[styles.weaponSection, { borderTopColor: c.border }]}>
                  <Text style={[styles.sectionTitle, { color: c.foreground }]}>Attack Stats</Text>
                  <Text style={[styles.sectionSub, { color: c.mutedForeground }]}>
                    Fill these in to auto-generate an attack card when equipped
                  </Text>

                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Attack uses which ability?</Text>
                  <View style={styles.abilityRow}>
                    {ABILITY_KEYS.map((key) => {
                      const mod = abilityMod(character.abilityScores[key]);
                      const total = mod + (editIsProficient ? character.proficiencyBonus : 0);
                      const isSelected = editAbility === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setEditAbility(key)}
                          activeOpacity={0.7}
                          style={[
                            styles.abilityChip,
                            { backgroundColor: isSelected ? c.primary : c.secondary, borderRadius: c.radius },
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

                  <TouchableOpacity
                    onPress={() => setEditIsProficient((v) => !v)}
                    activeOpacity={0.8}
                    style={[styles.profToggle, {
                      backgroundColor: editIsProficient ? "#10B98120" : c.secondary,
                      borderColor: editIsProficient ? "#10B981" : c.border,
                      borderRadius: c.radius,
                    }]}
                  >
                    <View style={[styles.profToggleIcon, { backgroundColor: editIsProficient ? "#10B981" : c.muted, borderRadius: 6 }]}>
                      <Feather name="check" size={12} color={editIsProficient ? "#fff" : c.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.profToggleLabel, { color: editIsProficient ? "#10B981" : c.foreground }]}>
                        Proficient with this weapon
                      </Text>
                      <Text style={[styles.profToggleSub, { color: c.mutedForeground }]}>
                        {editIsProficient
                          ? `+${character.proficiencyBonus} proficiency bonus included`
                          : "Proficiency bonus not added"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setEditUseAbilityDamage((v) => !v)}
                    activeOpacity={0.8}
                    style={[styles.profToggle, {
                      backgroundColor: editUseAbilityDamage ? "#10B98120" : "#F59E0B20",
                      borderColor: editUseAbilityDamage ? "#10B981" : "#F59E0B",
                      borderRadius: c.radius,
                    }]}
                  >
                    <View style={[styles.profToggleIcon, { backgroundColor: editUseAbilityDamage ? "#10B981" : "#F59E0B", borderRadius: 6 }]}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.profToggleLabel, { color: editUseAbilityDamage ? "#10B981" : "#F59E0B" }]}>Add ability modifier to damage</Text>
                      <Text style={[styles.profToggleSub, { color: c.mutedForeground }]}>
                        {editUseAbilityDamage
                          ? "Ability modifier is included in generated weapon damage"
                          : "Ability modifier is excluded from generated weapon damage"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={[styles.atkPreview, { backgroundColor: c.secondary, borderRadius: c.radius }]}>
                    <Text style={[styles.atkPreviewLabel, { color: c.mutedForeground }]}>Attack Bonus =</Text>
                    <Text style={[styles.atkPreviewValue, { color: c.primary }]}>{fmtMod(computedAtkBonus)}</Text>
                    <Text style={[styles.atkPreviewBreakdown, { color: c.mutedForeground }]}>
                      {editIsProficient
                        ? `(${ABILITY_SHORT[editAbility]} ${fmtMod(computedAbilityMod)} + Prof ${fmtMod(character.proficiencyBonus)})`
                        : `(${ABILITY_SHORT[editAbility]} ${fmtMod(computedAbilityMod)}, no prof)`}
                    </Text>
                  </View>

                  <View style={styles.twoCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Damage Dice</Text>
                      <TextInput
                        value={editDamageDice}
                        onChangeText={setEditDamageDice}
                        placeholder="e.g. 1d8"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius }]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>DMG Modifier</Text>
                      <TextInput
                        value={editDmgMod}
                        onChangeText={setEditDmgMod}
                        keyboardType="number-pad"
                        placeholder="e.g. 4"
                        placeholderTextColor={c.mutedForeground}
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius }]}
                      />
                    </View>
                  </View>

                  <View style={styles.twoCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Damage Type</Text>
                      <TextInput
                        value={editDmgType}
                        onChangeText={setEditDmgType}
                        placeholder="e.g. slashing"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius }]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Range</Text>
                      <View style={[styles.rangeInputRow, { backgroundColor: c.secondary, borderRadius: c.radius }]}>
                        <TextInput
                          value={editRange}
                          onChangeText={setEditRange}
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
                      e.g. +1d4 psychic from a second effect
                    </Text>

                    {editAdditionalDamage.map((ad, i) => (
                      <View
                        key={i}
                        style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}
                      >
                        <View style={[styles.additionalDmgChip, { backgroundColor: "#A78BFA20", borderRadius: 6 }]}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#A78BFA" }}>
                            {ad.dice} {ad.damageType}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setEditAdditionalDamage((prev) => prev.filter((_, j) => j !== i))}
                          style={[{ padding: 6, backgroundColor: c.muted, borderRadius: 6 }]}
                          activeOpacity={0.7}
                        >
                          <Feather name="x" size={14} color={c.destructive} />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      <TextInput
                        value={newExtraDice}
                        onChangeText={setNewExtraDice}
                        placeholder="Dice (e.g. 1d4)"
                        placeholderTextColor={c.mutedForeground}
                        style={[{ flex: 1, backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius, padding: 8, fontSize: 13 }]}
                      />
                      <TextInput
                        value={newExtraDmgType}
                        onChangeText={setNewExtraDmgType}
                        placeholder="Type"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={[{ flex: 1, backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius, padding: 8, fontSize: 13 }]}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          if (!newExtraDice.trim() || !newExtraDmgType.trim()) return;
                          setEditAdditionalDamage((prev) => [
                            ...prev,
                            { dice: newExtraDice.trim(), damageType: newExtraDmgType.trim() },
                          ]);
                          setNewExtraDice("");
                          setNewExtraDmgType("");
                        }}
                        style={[{ padding: 8, backgroundColor: newExtraDice.trim() && newExtraDmgType.trim() ? c.primary : c.muted, borderRadius: c.radius }]}
                        activeOpacity={0.7}
                      >
                        <Feather name="plus" size={16} color={newExtraDice.trim() && newExtraDmgType.trim() ? c.primaryForeground : c.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Suppress attack card toggle — only for Unarmed Weapon tagged items */}
                  {editTags.includes("Unarmed Weapon") && (
                    <TouchableOpacity
                      onPress={() => setEditSuppressWeapon((v) => !v)}
                      activeOpacity={0.8}
                      style={[styles.profToggle, {
                        backgroundColor: editSuppressWeapon ? "#F5920020" : c.secondary,
                        borderColor: editSuppressWeapon ? "#F59200" : c.border,
                        borderRadius: c.radius,
                        marginTop: 14,
                      }]}
                    >
                      <View style={[styles.profToggleIcon, {
                        backgroundColor: editSuppressWeapon ? "#F59200" : c.muted,
                        borderRadius: 6,
                      }]}>
                        <Feather name="link" size={12} color={editSuppressWeapon ? "#fff" : c.mutedForeground} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.profToggleLabel, { color: editSuppressWeapon ? "#F59200" : c.foreground }]}>
                          Merge with unarmed attack
                        </Text>
                        <Text style={[styles.profToggleSub, { color: c.mutedForeground }]}>
                          {editSuppressWeapon
                            ? "No separate attack card — bonus damage feeds into your unarmed attack"
                            : "Generate a standalone attack card when equipped"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Equipped Effects */}
              <View style={[styles.effectsSection, { borderTopColor: c.border }]}>
                <Text style={[styles.sectionTitle, { color: c.foreground }]}>Equipped Effects</Text>
                <Text style={[styles.sectionSub, { color: c.mutedForeground }]}>
                  Bonuses, spells, or buffs active while this item is equipped
                </Text>

                {editEffects.map((effect) => {
                  const isEditing = editingEffectId === effect.id;
                  const actionColor = effect.actionType ? ACTION_TYPE_COLORS[effect.actionType] : null;
                  return (
                    <View key={effect.id}>
                      <View style={[styles.effectItem, { backgroundColor: c.secondary, borderRadius: c.radius, flexDirection: "column", alignItems: "stretch" }]}>
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
                              value={editingEffLabel}
                              onChangeText={setEditingEffLabel}
                              placeholder="Effect label"
                              placeholderTextColor={c.mutedForeground}
                              style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius }]}
                            />
                            <TextInput
                              value={editingEffDesc}
                              onChangeText={setEditingEffDesc}
                              placeholder="Description (optional)"
                              placeholderTextColor={c.mutedForeground}
                              multiline
                              numberOfLines={2}
                              style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius, minHeight: 48, textAlignVertical: "top" }]}
                            />
                            <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                              Effect Type
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              <View style={{ flexDirection: "row", gap: 5 }}>
                                {(Object.keys(EFFECT_TYPE_LABELS) as ItemEffectType[]).map((t) => (
                                  <TouchableOpacity
                                    key={t}
                                    onPress={() => setEditingEffType(t)}
                                    style={[styles.typeChip, { backgroundColor: editingEffType === t ? EFFECT_TYPE_COLORS[t] : c.muted, borderRadius: 6 }]}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: editingEffType === t ? "#fff" : c.mutedForeground }}>
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
                                  const active = editingEffActionType === value;
                                  return (
                                    <TouchableOpacity
                                      key={label}
                                      onPress={() => setEditingEffActionType(value)}
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
                                style={{ flex: 1, padding: 9, borderRadius: c.radius, backgroundColor: c.muted, alignItems: "center" }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ fontSize: 13, fontWeight: "600", color: c.mutedForeground }}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={handleSaveEffect}
                                style={{ flex: 2, padding: 9, borderRadius: c.radius, backgroundColor: c.primary, alignItems: "center" }}
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

                <View style={[styles.addEffectBox, { backgroundColor: c.secondary, borderRadius: c.radius }]}>
                  <Text style={[styles.addEffectTitle, { color: c.foreground }]}>Add Effect</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {(Object.keys(EFFECT_TYPE_LABELS) as ItemEffectType[]).map((t) => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => {
                            setNewEffectType(t);
                            setNewEffectStatKey(null); setNewEffectStatMagnitude("1"); setNewEffectStatSign("+");
                            setNewEffectAtkDice(""); setNewEffectAtkDmgType("");
                            setNewEffectSpellSearch(""); setNewEffectSpellEntry(null); setNewEffectFeatureEntry(null);
                            setNewEffectUses("1"); setNewEffectResetOn("long_rest");
                            setNewEffectBuffStatKey(null); setNewEffectBuffStatVal("1");
                            setNewEffectLabel(""); setNewEffectDesc("");
                          }}
                          style={[
                            styles.typeChip,
                            { backgroundColor: newEffectType === t ? EFFECT_TYPE_COLORS[t] : c.muted, borderRadius: 6 },
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: newEffectType === t ? "#fff" : c.mutedForeground }}>
                            {EFFECT_TYPE_LABELS[t]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Type hint */}
                  <Text style={{ fontSize: 11, color: c.mutedForeground, marginBottom: 8, fontStyle: "italic" }}>
                    {EFFECT_TYPE_HINTS[newEffectType]}
                  </Text>

                  {newEffectType === "feature" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Feat or feature name</Text>
                      <TextInput
                        value={newEffectLabel}
                        onChangeText={(v) => { setNewEffectLabel(v); setNewEffectFeatureEntry(null); }}
                        placeholder="Search feats or type a custom feature"
                        placeholderTextColor={c.mutedForeground}
                        style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius }]}
                      />
                      {!newEffectFeatureEntry && newEffectLabel.trim().length >= 1 && (
                        featureMatches.length === 0 ? (
                          <Text style={{ fontSize: 12, color: c.mutedForeground, marginBottom: 8 }}>No feats found. Keep typing to add a custom feature.</Text>
                        ) : (
                          <View style={{ maxHeight: 220, marginBottom: 8 }}>
                            <ScrollView nestedScrollEnabled>
                              {featureMatches.map((feat) => (
                                <TouchableOpacity
                                  key={feat.slug}
                                  onPress={() => {
                                    setNewEffectFeatureEntry(feat);
                                    setNewEffectLabel(feat.name);
                                    setNewEffectDesc(formatFeatureFeatDescription(feat));
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
                      {newEffectFeatureEntry && (
                        <View style={{ backgroundColor: "#F59E0B20", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: "#F59E0B", flex: 1 }}>{newEffectFeatureEntry.name}</Text>
                            <TouchableOpacity onPress={() => { setNewEffectFeatureEntry(null); setNewEffectLabel(""); setNewEffectDesc(""); }} activeOpacity={0.7}>
                              <Feather name="x" size={14} color={c.mutedForeground} />
                            </TouchableOpacity>
                          </View>
                          <Text style={{ fontSize: 11, color: c.mutedForeground }} numberOfLines={4}>{formatFeatureFeatDescription(newEffectFeatureEntry)}</Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* ── Spell Grant picker ── */}
                  {newEffectType === "spell" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Search spell list</Text>
                      <TextInput
                        value={newEffectSpellSearch}
                        onChangeText={(v) => { setNewEffectSpellSearch(v); setNewEffectSpellEntry(null); }}
                        placeholder="Spell name…"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius }]}
                      />
                      {newEffectSpellSearch.trim().length >= 2 && !newEffectSpellEntry && (() => {
                        const q = newEffectSpellSearch.trim().toLowerCase();
                        const matches = SPELL_LIST.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
                        if (!matches.length) return <Text style={{ fontSize: 12, color: c.mutedForeground, marginBottom: 8 }}>No spells found</Text>;
                        return (
                          <View style={{ maxHeight: 200, marginBottom: 8 }}>
                            <ScrollView nestedScrollEnabled>
                              {matches.map((sp) => (
                                <TouchableOpacity
                                  key={sp.name}
                                  onPress={() => { setNewEffectSpellEntry(sp); setNewEffectSpellSearch(sp.name); setNewEffectLabel(`${sp.name} 1/day`); setNewEffectDesc(sp.desc); }}
                                  activeOpacity={0.7}
                                  style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: c.border }}
                                >
                                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SCHOOL_COLORS[sp.school] ?? "#8B5CF6" }} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: "700", color: c.foreground }}>{sp.name}</Text>
                                    <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                                      {sp.level === 0 ? "Cantrip" : `Level ${sp.level}`} · {sp.school}
                                    </Text>
                                  </View>
                                  <Feather name="plus-circle" size={16} color={c.primary} />
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        );
                      })()}
                      {newEffectSpellEntry && (
                        <View style={{ backgroundColor: "#8B5CF620", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SCHOOL_COLORS[newEffectSpellEntry.school] ?? "#8B5CF6" }} />
                            <Text style={{ fontSize: 14, fontWeight: "700", color: "#8B5CF6" }}>{newEffectSpellEntry.name}</Text>
                            <Text style={{ fontSize: 11, color: c.mutedForeground, flex: 1 }}>
                              {newEffectSpellEntry.level === 0 ? "Cantrip" : `Level ${newEffectSpellEntry.level}`} · {newEffectSpellEntry.school}
                            </Text>
                            <TouchableOpacity onPress={() => { setNewEffectSpellEntry(null); setNewEffectSpellSearch(""); setNewEffectLabel(""); setNewEffectDesc(""); }} activeOpacity={0.7}>
                              <Feather name="x" size={14} color={c.mutedForeground} />
                            </TouchableOpacity>
                          </View>
                          <Text style={{ fontSize: 11, color: c.mutedForeground }} numberOfLines={3}>{newEffectSpellEntry.desc}</Text>
                        </View>
                      )}
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Uses per reset</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <TouchableOpacity
                          onPress={() => setNewEffectUses(String(Math.max(1, (parseInt(newEffectUses) || 1) - 1)))}
                          style={{ width: 32, height: 32, backgroundColor: c.muted, borderRadius: 6, alignItems: "center", justifyContent: "center" }}
                          activeOpacity={0.7}
                        >
                          <Feather name="minus" size={14} color={c.foreground} />
                        </TouchableOpacity>
                        <TextInput
                          value={newEffectUses}
                          onChangeText={setNewEffectUses}
                          keyboardType="number-pad"
                          style={{ width: 56, textAlign: "center", backgroundColor: c.muted, color: c.foreground, borderRadius: 6, paddingVertical: 6, fontSize: 15, fontWeight: "700" }}
                        />
                        <TouchableOpacity
                          onPress={() => setNewEffectUses(String((parseInt(newEffectUses) || 1) + 1))}
                          style={{ width: 32, height: 32, backgroundColor: c.muted, borderRadius: 6, alignItems: "center", justifyContent: "center" }}
                          activeOpacity={0.7}
                        >
                          <Feather name="plus" size={14} color={c.foreground} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 12, color: c.mutedForeground }}>uses</Text>
                      </View>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Recharges on</Text>
                      <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                        {([["short_rest", "Short Rest"], ["long_rest", "Long Rest"], ["dawn", "Dawn"]] as const).map(([val, lbl]) => (
                          <TouchableOpacity
                            key={val}
                            onPress={() => setNewEffectResetOn(val)}
                            activeOpacity={0.7}
                            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: newEffectResetOn === val ? "#8B5CF6" : c.muted }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: newEffectResetOn === val ? "#fff" : c.mutedForeground }}>{lbl}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* ── Buff optional stat ── */}
                  {newEffectType === "buff" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 4 }]}>Also bump a stat? (optional)</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: "row", gap: 5 }}>
                          <TouchableOpacity
                            onPress={() => { setNewEffectBuffStatKey(null); setNewEffectBuffStatVal("1"); }}
                            style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: newEffectBuffStatKey === null ? c.primary : c.muted, borderRadius: 6 }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: newEffectBuffStatKey === null ? c.primaryForeground : c.mutedForeground }}>None</Text>
                          </TouchableOpacity>
                          {STAT_KEY_ORDER.map((key) => (
                            <TouchableOpacity
                              key={key}
                              onPress={() => setNewEffectBuffStatKey(key)}
                              style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: newEffectBuffStatKey === key ? "#3B82F6" : c.muted, borderRadius: 6 }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: newEffectBuffStatKey === key ? "#fff" : c.mutedForeground }}>
                                {STAT_KEY_LABELS[key]}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      {newEffectBuffStatKey != null && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <TouchableOpacity
                            onPress={() => setNewEffectBuffStatVal(String((parseInt(newEffectBuffStatVal) || 1) - 1))}
                            style={{ width: 32, height: 32, backgroundColor: c.muted, borderRadius: 6, alignItems: "center", justifyContent: "center" }}
                            activeOpacity={0.7}
                          >
                            <Feather name="minus" size={14} color={c.foreground} />
                          </TouchableOpacity>
                          <TextInput
                            value={newEffectBuffStatVal}
                            onChangeText={setNewEffectBuffStatVal}
                            keyboardType="numbers-and-punctuation"
                            style={{ width: 56, textAlign: "center", backgroundColor: c.muted, color: c.foreground, borderRadius: 6, paddingVertical: 6, fontSize: 15, fontWeight: "700" }}
                          />
                          <TouchableOpacity
                            onPress={() => setNewEffectBuffStatVal(String((parseInt(newEffectBuffStatVal) || 0) + 1))}
                            style={{ width: 32, height: 32, backgroundColor: c.muted, borderRadius: 6, alignItems: "center", justifyContent: "center" }}
                            activeOpacity={0.7}
                          >
                            <Feather name="plus" size={14} color={c.foreground} />
                          </TouchableOpacity>
                          <Text style={{ fontSize: 12, color: c.mutedForeground }}>
                            {`→ +${parseInt(newEffectBuffStatVal) || 1} to ${STAT_KEY_LABELS[newEffectBuffStatKey]}`}
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  {newEffectType === "stat_bonus" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Stat</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: "row", gap: 5 }}>
                          {STAT_KEY_ORDER.map((key) => (
                            <TouchableOpacity
                              key={key}
                              onPress={() => {
                                setNewEffectStatKey(key);
                                const magnitude = Math.max(1, parseInt(newEffectStatMagnitude, 10) || 1);
                                const val = newEffectStatSign === "-" ? -magnitude : magnitude;
                                setNewEffectLabel(statBonusLabel(key, val));
                              }}
                              style={{
                                paddingHorizontal: 8, paddingVertical: 5,
                                backgroundColor: newEffectStatKey === key ? "#10B981" : c.muted,
                                borderRadius: 6,
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: newEffectStatKey === key ? "#fff" : c.mutedForeground }}>
                                {STAT_KEY_LABELS[key]}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Modifier</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setNewEffectStatSign((prev) => {
                              const next = prev === "+" ? "-" : "+";
                              const magnitude = Math.max(1, parseInt(newEffectStatMagnitude, 10) || 1);
                              if (newEffectStatKey) {
                                const signedValue = next === "-" ? -magnitude : magnitude;
                                setNewEffectLabel(statBonusLabel(newEffectStatKey, signedValue));
                              }
                              return next;
                            });
                          }}
                          style={{ width: 42, height: 38, backgroundColor: c.muted, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: c.foreground, fontSize: 18, fontWeight: "800" }}>{newEffectStatSign}</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={newEffectStatMagnitude}
                          onChangeText={(t) => {
                            const clean = t.replace(/[^0-9]/g, "") || "";
                            setNewEffectStatMagnitude(clean);
                            const magnitude = Math.max(1, parseInt(clean || "1", 10) || 1);
                            const signedValue = newEffectStatSign === "-" ? -magnitude : magnitude;
                            if (newEffectStatKey) setNewEffectLabel(statBonusLabel(newEffectStatKey, signedValue));
                          }}
                          keyboardType="number-pad"
                          placeholder="N"
                          placeholderTextColor={c.mutedForeground}
                          style={{ width: 72, textAlign: "center", backgroundColor: c.muted, color: c.foreground, borderRadius: 8, paddingVertical: 8, fontSize: 15, fontWeight: "700", borderWidth: 1, borderColor: c.border }}
                        />
                        <Text style={{ fontSize: 12, color: c.mutedForeground, flex: 1 }}>
                          {newEffectStatKey
                            ? statBonusLabel(newEffectStatKey, (newEffectStatSign === "-" ? -1 : 1) * Math.max(1, parseInt(newEffectStatMagnitude || "1", 10) || 1))
                            : "Choose a stat first"}
                        </Text>
                      </View>
                    </>
                  )}

                  {newEffectType === "attack_damage" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Hit Die</Text>
                      <TextInput
                        value={newEffectAtkDice}
                        onChangeText={setNewEffectAtkDice}
                        placeholder="e.g. 1d4"
                        placeholderTextColor={c.mutedForeground}
                        style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius }]}
                      />
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Damage Type</Text>
                      <TextInput
                        value={newEffectAtkDmgType}
                        onChangeText={setNewEffectAtkDmgType}
                        placeholder="e.g. lightning"
                        placeholderTextColor={c.mutedForeground}
                        autoCapitalize="none"
                        style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius }]}
                      />
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>Damage Modifier</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <TouchableOpacity
                          onPress={() => setNewEffectAtkDamageSign((prev) => prev === "+" ? "-" : "+")}
                          style={{ width: 42, height: 38, backgroundColor: c.muted, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: c.foreground, fontSize: 18, fontWeight: "800" }}>{newEffectAtkDamageSign}</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={newEffectAtkDamageMagnitude}
                          onChangeText={(t) => setNewEffectAtkDamageMagnitude(t.replace(/[^0-9]/g, "") || "")}
                          keyboardType="number-pad"
                          placeholder="N"
                          placeholderTextColor={c.mutedForeground}
                          style={{ width: 72, textAlign: "center", backgroundColor: c.muted, color: c.foreground, borderRadius: 8, paddingVertical: 8, fontSize: 15, fontWeight: "700", borderWidth: 1, borderColor: c.border }}
                        />
                        <Text style={{ fontSize: 12, color: c.mutedForeground, flex: 1 }}>
                          {`${newEffectAtkDice || "XdY"}${((newEffectAtkDamageSign === "-" ? -1 : 1) * Math.max(1, parseInt(newEffectAtkDamageMagnitude || "1", 10) || 1)) > 0 ? `+${(newEffectAtkDamageSign === "-" ? -1 : 1) * Math.max(1, parseInt(newEffectAtkDamageMagnitude || "1", 10) || 1)}` : `${(newEffectAtkDamageSign === "-" ? -1 : 1) * Math.max(1, parseInt(newEffectAtkDamageMagnitude || "1", 10) || 1)}`} ${newEffectAtkDmgType || "damage"}`}
                        </Text>
                      </View>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 6 }]}>To Hit Modifier</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <TouchableOpacity
                          onPress={() => setNewEffectAtkToHitSign((prev) => prev === "+" ? "-" : "+")}
                          style={{ width: 42, height: 38, backgroundColor: c.muted, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: c.foreground, fontSize: 18, fontWeight: "800" }}>{newEffectAtkToHitSign}</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={newEffectAtkToHitMagnitude}
                          onChangeText={(t) => setNewEffectAtkToHitMagnitude(t.replace(/[^0-9]/g, "") || "")}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={c.mutedForeground}
                          style={{ width: 72, textAlign: "center", backgroundColor: c.muted, color: c.foreground, borderRadius: 8, paddingVertical: 8, fontSize: 15, fontWeight: "700", borderWidth: 1, borderColor: c.border }}
                        />
                        <Text style={{ fontSize: 12, color: c.mutedForeground, flex: 1 }}>
                          {`${Math.max(0, parseInt(newEffectAtkToHitMagnitude || "0", 10) || 0) === 0 ? "+0" : (((newEffectAtkToHitSign === "-" ? -1 : 1) * Math.max(0, parseInt(newEffectAtkToHitMagnitude || "0", 10) || 0)) > 0 ? `+${(newEffectAtkToHitSign === "-" ? -1 : 1) * Math.max(0, parseInt(newEffectAtkToHitMagnitude || "0", 10) || 0)}` : `${(newEffectAtkToHitSign === "-" ? -1 : 1) * Math.max(0, parseInt(newEffectAtkToHitMagnitude || "0", 10) || 0)}`)} to hit`}
                        </Text>
                      </View>
                    </>
                  )}

                  {newEffectType !== "spell" && newEffectType !== "stat_bonus" && newEffectType !== "attack_damage" && newEffectType !== "feature" && (
                    <TextInput
                      value={newEffectLabel}
                      onChangeText={setNewEffectLabel}
                      placeholder={
                        newEffectType === "buff" ? "e.g. Advantage on Stealth checks" :
                        "Short label"
                      }
                      placeholderTextColor={c.mutedForeground}
                      style={[styles.effectInput, { backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius }]}
                    />
                  )}
                  {newEffectType !== "spell" && (
                    <TextInput
                      value={newEffectDesc}
                      onChangeText={setNewEffectDesc}
                      placeholder="Full description (optional)"
                      placeholderTextColor={c.mutedForeground}
                      multiline
                      numberOfLines={2}
                      style={[
                        styles.effectInput,
                        { backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius, minHeight: 52, textAlignVertical: "top" },
                      ]}
                    />
                  )}
                  {(() => {
                    const canAdd =
                      (newEffectType === "spell" && (!!newEffectSpellEntry || newEffectLabel.trim() !== "")) ||
                      newEffectLabel.trim() !== "" ||
                      (newEffectType === "stat_bonus" && newEffectStatKey != null) ||
                      (newEffectType === "attack_damage" && newEffectAtkDice.trim() !== "" && newEffectAtkDmgType.trim() !== "");
                    return (
                      <TouchableOpacity
                        onPress={handleAddEffect}
                        disabled={!canAdd}
                        activeOpacity={0.8}
                        style={[
                          styles.addEffectBtn,
                          { backgroundColor: canAdd ? c.primary : c.muted, borderRadius: c.radius },
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

              {/* Modal actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowEdit(false)}
                  activeOpacity={0.8}
                  style={[styles.modalBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: c.mutedForeground }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  activeOpacity={0.8}
                  style={[styles.modalBtn, { backgroundColor: c.primary, borderRadius: c.radius }]}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: c.primaryForeground }}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollHintScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (c: { radius: number }) => StyleSheet.create({
  card: {
    marginBottom: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
    overflow: "hidden",
  },

  // Compact header
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  headerLeft: { flex: 1, gap: 3 },
  headerRight: { alignItems: "center", gap: 4 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  name: { fontSize: 15, fontWeight: "700", flex: 1 },
  equippedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  equippedText: { fontSize: 10, fontWeight: "700" },
  metaLine: { flexDirection: "row", alignItems: "center" },
  catLabel: { fontSize: 11, fontWeight: "700" },
  notesTrunc: { fontSize: 11, flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  statChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statChipText: { fontSize: 11, fontWeight: "600" },
  qty: { fontSize: 16, fontWeight: "800" },

  // Expanded detail
  detail: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 10,
    gap: 10,
  },
  detailNotes: { fontSize: 13, lineHeight: 18 },
  detailBlock: { padding: 10 },
  detailBlockTitle: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 },
  detailStatRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  detailStat: { flex: 1, alignItems: "center" },
  detailStatVal: { fontSize: 17, fontWeight: "800" },
  detailStatLabel: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  detailDivider: { width: 1, height: 32, marginHorizontal: 4 },
  detailSectionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  effectRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 8 },
  effectDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  effectLabel: { fontSize: 13, fontWeight: "600" },
  effectDesc: { fontSize: 11, marginTop: 1 },
  detailActions: { flexDirection: "row", gap: 8 },
  detailBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderWidth: 1 },

  // Image viewer
  imageViewerOverlay: { flex: 1, backgroundColor: "#000000F2", justifyContent: "center" },
  imageViewerClose: {
    position: "absolute",
    top: 52,
    right: 20,
    zIndex: 10,
    backgroundColor: "#00000088",
    borderRadius: 20,
    padding: 10,
  },
  imageViewerFooter: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: "center",
  },

  // Edit modal
  modalOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  modalContent: { maxHeight: "92%", padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4 },
  fieldInput: { padding: 11, fontSize: 14, marginBottom: 12 },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  catChip: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  weaponSection: { borderTopWidth: 1, marginTop: 4, paddingTop: 14, gap: 0 },
  sectionTitle: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  sectionSub: { fontSize: 11, marginBottom: 10 },
  abilityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  abilityChip: { alignItems: "center", padding: 8, minWidth: 48 },
  abilityChipLabel: { fontSize: 10, fontWeight: "700" },
  abilityChipMod: { fontSize: 13, fontWeight: "800", marginTop: 2 },
  profToggle: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, marginBottom: 12 },
  profToggleIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  profToggleLabel: { fontSize: 13, fontWeight: "700" },
  profToggleSub: { fontSize: 11, marginTop: 1 },
  atkPreview: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, marginBottom: 12 },
  atkPreviewLabel: { fontSize: 11 },
  atkPreviewValue: { fontSize: 17, fontWeight: "800" },
  atkPreviewBreakdown: { fontSize: 11, flex: 1 },
  twoCol: { flexDirection: "row", gap: 10, marginBottom: 0 },
  rangeInputRow: { flexDirection: "row", alignItems: "center", paddingRight: 10, marginBottom: 12 },
  rangeInput: { flex: 1, padding: 11, fontSize: 14 },
  rangeUnit: { fontSize: 13, fontWeight: "600" },
  additionalDmgChip: { flex: 1, paddingHorizontal: 10, paddingVertical: 7 },
  effectsSection: { borderTopWidth: 1, marginTop: 12, paddingTop: 14 },
  effectItem: { flexDirection: "row", alignItems: "flex-start", padding: 10, marginBottom: 8 },
  effectItemLeft: { flex: 1, gap: 3 },
  effectTypePill: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  effectTypeText: { fontSize: 10, fontWeight: "700" },
  effectItemLabel: { fontSize: 13, fontWeight: "600" },
  effectItemDesc: { fontSize: 11 },
  removeEffectBtn: { padding: 6, marginLeft: 8 },
  addEffectBox: { padding: 12, marginTop: 4 },
  addEffectTitle: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
  typeChip: { paddingHorizontal: 8, paddingVertical: 5 },
  effectInput: { padding: 10, fontSize: 13, marginBottom: 8 },
  addEffectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 10 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16, paddingBottom: 4 },
  modalBtn: { flex: 1, alignItems: "center", padding: 14 },
});
