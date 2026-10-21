import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { appendFileToFormData } from "@/utils/formDataFile";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import colors from "@/constants/colors";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useCharacter } from "@/context/CharacterContext";
import type { ProposedInventoryItem, LootAnalysisResult, QuickUpdateResult, ItemCategory, AbilityScores, ItemEffectType, ItemEffect, EquippedStatKey, AdditionalDamage } from "@/types";
import { API_BASE_URL } from "@/utils/apiUrl";
import { SPELL_LIST, SCHOOL_COLORS } from "@/data/spellList";
import type { SpellEntry } from "@/data/spellList";
import { STAT_KEY_LABELS, STAT_KEY_ORDER, statBonusLabel } from "@/data/itemStats";
import { roll } from "@/data/dmTables";
import { estimateItemPriceFromResources } from "@/data/itemPricing";
import { getRuntimeItemProjectedEffects } from "@/utils/mechanics/runtimeMechanicsCompatibility";
import { deduplicateItems } from "@/utils/lootReviewMerge";

const ALL_CATEGORIES: { label: string; value: ItemCategory }[] = [
  { label: "Weapon", value: "weapon" },
  { label: "Armor", value: "armor" },
  { label: "Accessory", value: "accessory" },
  { label: "Consumable", value: "consumable" },
  { label: "Magic", value: "magic" },
  { label: "Quest", value: "quest" },
  { label: "Gear", value: "gear" },
  { label: "Treasure", value: "treasure" },
  { label: "Other", value: "other" },
];

const ABILITY_KEYS: (keyof AbilityScores)[] = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
];
const ABILITY_SHORT: Record<keyof AbilityScores, string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
};

function abilityMod(score: number): number { return Math.floor((score - 10) / 2); }
function fmtMod(n: number): string { return n >= 0 ? `+${n}` : `${n}`; }

const CONFIDENCE_COLORS = {
  high: "#10B981",
  medium: "#F59E0B",
  low: "#EF4444",
};

const EFFECT_TYPE_COLORS: Record<ItemEffectType, string> = {
  stat_bonus: "#10B981",
  attack_damage: "#F97316",
  spell: "#8B5CF6",
  buff: "#3B82F6",
  feature: "#F59E0B",
  note: "#6B7280",
};

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const EFFECT_TYPE_LABELS: Record<ItemEffectType, string> = {
  stat_bonus: "Stat (+N)", attack_damage: "Atk DMG", spell: "Grant Spell",
  buff: "Passive Buff", feature: "Feature", note: "Note",
};
const EFFECT_TYPE_HINTS: Record<ItemEffectType, string> = {
  stat_bonus: "Numerically changes a stat (AC, DEX, Initiative…)",
  attack_damage: "Adds extra dice to all attacks while equipped",
  spell: "Grants use of a spell — no slot required",
  buff: "Descriptive passive benefit (resistance, advantage…). Optionally also bumps a stat.",
  feature: "Increases a tracked resource max (Rage, Ki…)",
  note: "Just a reminder note, no mechanical effect",
};
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

function withPricing(item: ProposedInventoryItem): ProposedInventoryItem {
  const estimate = estimateItemPriceFromResources({
    name: item.name,
    notes: item.notes,
    tags: item.tags,
  });
  if (!estimate) return item;

  const hasPriceRangeNote = /Estimated value range:/i.test(item.notes ?? "");
  const rangeNote = `Estimated value range: ${estimate.minGp}-${estimate.maxGp} gp (base ${estimate.baseGp} gp from ${estimate.matchedName})`;
  const notes = hasPriceRangeNote
    ? item.notes
    : item.notes?.trim()
    ? `${item.notes}\n${rangeNote}`
    : rangeNote;

  return {
    ...item,
    value: estimate.suggestedGp,
    notes,
  };
}

function withPricingForBatch(items: ProposedInventoryItem[]): ProposedInventoryItem[] {
  return items.map(withPricing);
}

export default function LootReviewScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { source, data, questBatchId } = useLocalSearchParams<{ source: string; data?: string; questBatchId?: string }>();
  const { settings } = useAppSettings();
  const { applyProposedItems, updateCurrency, applyDeferredInventoryLinksForBatch, character } = useCharacter();

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Analyzing...");
  const [lootResult, setLootResult] = useState<LootAnalysisResult | null>(null);
  const [items, setItems] = useState<ProposedInventoryItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [pendingCurrency, setPendingCurrency] = useState<import("@/types").ProposedCurrencyChange | null>(null);

  // Text parse input (used when source=text)
  const [textInput, setTextInput] = useState("");
  const [textParsing, setTextParsing] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("1");
  const [editCategory, setEditCategory] = useState<ItemCategory>("gear");
  const [editNotes, setEditNotes] = useState("");
  const [editAbility, setEditAbility] = useState<keyof AbilityScores>("strength");
  const [editIsProficient, setEditIsProficient] = useState(true);
  const [editDamageDice, setEditDamageDice] = useState("");
  const [editDmgMod, setEditDmgMod] = useState("");
  const [editDmgType, setEditDmgType] = useState("");
  const [editRange, setEditRange] = useState("");
  // Effects editor state
  const [editEffects, setEditEffects] = useState<ItemEffect[]>([]);
  const [editAdditionalDamage, setEditAdditionalDamage] = useState<AdditionalDamage[]>([]);
  const [newExtraDice, setNewExtraDice] = useState("");
  const [newExtraDmgType, setNewExtraDmgType] = useState("");
  const [newEffectType, setNewEffectType] = useState<ItemEffectType>("stat_bonus");
  const [newEffectLabel, setNewEffectLabel] = useState("");
  const [newEffectDesc, setNewEffectDesc] = useState("");
  const [newEffectStatKey, setNewEffectStatKey] = useState<EquippedStatKey | null>(null);
  const [newEffectStatVal, setNewEffectStatVal] = useState("1");
  const [newEffectAtkDice, setNewEffectAtkDice] = useState("");
  const [newEffectAtkDmgType, setNewEffectAtkDmgType] = useState("");
  const [newEffectSpellSearch, setNewEffectSpellSearch] = useState("");
  const [newEffectSpellEntry, setNewEffectSpellEntry] = useState<SpellEntry | null>(null);
  const [newEffectUses, setNewEffectUses] = useState("1");
  const [newEffectResetOn, setNewEffectResetOn] = useState<"short_rest" | "long_rest" | "dawn">("long_rest");
  const [newEffectBuffStatKey, setNewEffectBuffStatKey] = useState<EquippedStatKey | null>(null);
  const [newEffectBuffStatVal, setNewEffectBuffStatVal] = useState("1");

  const isEditWeapon = editCategory === "weapon";
  const editAbilityMod = abilityMod(character.abilityScores[editAbility]);
  const editAtkBonus = editAbilityMod + (editIsProficient ? character.proficiencyBonus : 0);

  useEffect(() => {
    if (source === "text" && data) {
      loadTextData(data);
    } else if (source === "photo") {
      pickAndAnalyzePhoto();
    }
  }, []);

  const loadTextData = (rawData: string) => {
    setLoading(true);
    setLoadingMsg("Processing update...");
    try {
      const parsed: QuickUpdateResult = JSON.parse(rawData);
      const syntheticResult: LootAnalysisResult = {
        sourceType: "text",
        summary: parsed.summary,
        proposedItems: parsed.proposedInventoryChanges.filter((i) => i.quantity > 0),
        proposedCurrencyChange: parsed.proposedCurrencyChange,
        confidence: "high",
      };
      const itemsWithIds = syntheticResult.proposedItems.map((item) => ({
        ...item,
        id: item.id || generateId(),
      }));
      const pricedItems = withPricingForBatch(itemsWithIds);
      setLootResult(syntheticResult);
      setItems(pricedItems);
      setSelected(new Set(pricedItems.map((i) => i.id)));
    } catch {
      setError("Failed to parse update data.");
    } finally {
      setLoading(false);
    }
  };

  const mergeCurrency = (
    a: import("@/types").ProposedCurrencyChange | null | undefined,
    b: import("@/types").ProposedCurrencyChange | null | undefined
  ): import("@/types").ProposedCurrencyChange | null => {
    if (!a && !b) return null;
    const coins = ["cp", "sp", "ep", "gp", "pp"] as const;
    const result: import("@/types").ProposedCurrencyChange = {};
    for (const coin of coins) {
      const sum = (a?.[coin] ?? 0) + (b?.[coin] ?? 0);
      if (sum !== 0) result[coin] = sum;
    }
    return Object.keys(result).length > 0 ? result : null;
  };

  const analyzeAssets = async (
    assets: ImagePicker.ImagePickerAsset[]
  ): Promise<{ newItems: ProposedInventoryItem[]; currency: import("@/types").ProposedCurrencyChange | null; firstResult: LootAnalysisResult }> => {
    const results = await Promise.all(assets.map((a) => sendImageAsset(a)));
    const rawItems = results.flatMap((r) =>
      r.proposedItems.map((item) => ({
        ...item,
        id: item.id || generateId(),
        sourceTag: item.sourceTag ?? (item.officialMatch ? "official" : "custom"),
      }))
    );
    // Auto-merge items with the same name across all analyzed photos
    const { deduped: newItems } = deduplicateItems(rawItems);
    const pricedItems = withPricingForBatch(newItems);
    let currency: import("@/types").ProposedCurrencyChange | null = null;
    for (const r of results) currency = mergeCurrency(currency, r.proposedCurrencyChange);
    return { newItems: pricedItems, currency, firstResult: results[0] };
  };

  const pickAndAnalyzePhoto = async () => {
    setError(null);

    let pickerResult: ImagePicker.ImagePickerResult;

    if (Platform.OS === "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setError("Photo library permission is required to analyze loot photos.");
        return;
      }
      pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: true,
      });
    } else {
      const choice = await new Promise<"camera" | "library" | null>((resolve) => {
        Alert.alert(
          "Add Loot Photo",
          "Take a photo or choose screenshots from your library?",
          [
            { text: "Take Photo", onPress: () => resolve("camera") },
            { text: "Choose Screenshots", onPress: () => resolve("library") },
            { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
          ]
        );
      });

      if (!choice) {
        router.back();
        return;
      }

      if (choice === "camera") {
        const camStatus = await ImagePicker.requestCameraPermissionsAsync();
        if (camStatus.status !== "granted") {
          setError("Camera permission is required to take a photo.");
          return;
        }
        pickerResult = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          quality: 0.8,
        });
      } else {
        const libStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libStatus.status !== "granted") {
          setError("Photo library permission is required to choose photos.");
          return;
        }
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          quality: 0.8,
          allowsMultipleSelection: true,
        });
      }
    }

    if (pickerResult.canceled || !pickerResult.assets?.length) {
      router.back();
      return;
    }

    const assets = pickerResult.assets;
    const n = assets.length;
    setLoading(true);
    setLoadingMsg(n > 1 ? `Analyzing ${n} screenshots with AI...` : "Analyzing loot photo with AI...");

    try {
      const { newItems, currency, firstResult } = await analyzeAssets(assets);
      setLootResult({ ...firstResult, proposedCurrencyChange: currency ?? undefined });
      setPendingCurrency(currency);
      setItems(newItems);
      setSelected(new Set(newItems.map((i) => i.id)));
      setPhotoCount(n);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const addMorePhotos = async () => {
    setError(null);
    let pickerResult: ImagePicker.ImagePickerResult;

    if (Platform.OS === "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setError("Photo library permission required.");
        return;
      }
      pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: true,
      });
    } else {
      const libStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libStatus.status !== "granted") {
        setError("Photo library permission required.");
        return;
      }
      pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsMultipleSelection: true,
      });
    }

    if (pickerResult.canceled || !pickerResult.assets?.length) return;

    const assets = pickerResult.assets;
    const n = assets.length;
    setLoading(true);
    setLoadingMsg(n > 1 ? `Analyzing ${n} more screenshots...` : "Analyzing additional screenshot...");

    try {
      const { newItems, currency } = await analyzeAssets(assets);
      const merged = mergeCurrency(pendingCurrency, currency);
      setPendingCurrency(merged);
      setLootResult((prev) => prev ? { ...prev, proposedCurrencyChange: merged ?? undefined } : prev);
      const withIds = newItems.map((i) => ({ ...i, id: generateId() }));
      setItems((prev) => {
        const { deduped: brandNew, updatedExisting } = deduplicateItems(withIds, prev);
        return [...updatedExisting, ...brandNew];
      });
      setSelected((prev) => {
        const next = new Set(prev);
        withIds.forEach((i) => next.add(i.id));
        return next;
      });
      setPhotoCount((prev) => prev + n);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTextParse = async () => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    setTextParsing(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/ai/parse-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          snarkyParseMode: settings.snarkyParseMode,
          characterContext: {
            name: character.name,
            class: character.class,
            level: character.level,
            currentHp: character.currentHp,
            maxHp: character.maxHp,
            proficiencyBonus: character.proficiencyBonus,
          },
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? `Server error: ${resp.status}`);
      }
      const parsed: QuickUpdateResult = await resp.json();
      const newItems = (parsed.proposedInventoryChanges ?? [])
        .filter((i) => i.quantity > 0)
        .map((i) => ({ ...i, id: i.id || generateId() }));
      const pricedItems = withPricingForBatch(newItems);

      if (pricedItems.length === 0) {
        setError("No inventory items found in that text. Try describing specific items (e.g. '2 healing potions, a shortsword').");
        setTextParsing(false);
        return;
      }

      const syntheticResult: LootAnalysisResult = {
        sourceType: "text",
        summary: parsed.summary,
        proposedItems: pricedItems,
        proposedCurrencyChange: parsed.proposedCurrencyChange,
        confidence: "high",
      };

      const currency = parsed.proposedCurrencyChange ?? null;
      const merged = mergeCurrency(pendingCurrency, currency);
      setPendingCurrency(merged);
      setLootResult(syntheticResult);

      setItems((prev) => {
        const { deduped: brandNew, updatedExisting } = deduplicateItems(pricedItems, prev);
        return [...updatedExisting, ...brandNew];
      });
      setSelected((prev) => {
        const next = new Set(prev);
        pricedItems.forEach((i) => next.add(i.id));
        return next;
      });
      setTextInput("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTextParsing(false);
    }
  };

  const sendImageAsset = async (asset: ImagePicker.ImagePickerAsset): Promise<LootAnalysisResult> => {
    const formData = new FormData();
    const mimeType = asset.mimeType ?? "image/jpeg";
    const extension = mimeType.includes("png") ? "png" : "jpg";
    const filename = `loot.${extension}`;

    appendFileToFormData(
      formData,
      "image",
      { uri: asset.uri, name: filename, type: mimeType },
      asset.base64 ?? undefined
    );
    formData.append("snarkyParseMode", settings.snarkyParseMode ? "true" : "false");

    const resp = await fetch(`${API_BASE_URL}/api/ai/analyze-loot`, {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error((errData as { error?: string }).error ?? `Server error: ${resp.status}`);
    }

    return (await resp.json()) as LootAnalysisResult;
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetEffectFields = () => {
    setNewEffectType("stat_bonus");
    setNewEffectLabel(""); setNewEffectDesc("");
    setNewEffectStatKey(null); setNewEffectStatVal("1");
    setNewEffectAtkDice(""); setNewEffectAtkDmgType("");
    setNewEffectSpellSearch(""); setNewEffectSpellEntry(null);
    setNewEffectUses("1"); setNewEffectResetOn("long_rest");
    setNewEffectBuffStatKey(null); setNewEffectBuffStatVal("1");
  };

  const handleStartEdit = (item: ProposedInventoryItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(String(item.quantity));
    setEditCategory(item.category);
    setEditNotes(item.notes ?? "");
    setEditAbility(item.attackAbility ?? "strength");
    setEditIsProficient(item.isProficient !== false);
    setEditDamageDice(item.damageDice ?? "");
    setEditDmgMod(item.damageModifier != null ? String(item.damageModifier) : "");
    setEditDmgType(item.damageType ?? "");
    setEditRange(item.weaponRange?.replace(" ft", "") ?? "");
    setEditEffects(getRuntimeItemProjectedEffects(item as Partial<import("@/types").InventoryItem>));
    setEditAdditionalDamage(item.additionalDamage ?? []);
    setNewExtraDice(""); setNewExtraDmgType("");
    resetEffectFields();
    setShowEditModal(true);
  };

  const handleAddEffect = () => {
    if (newEffectType === "spell") {
      const spellLabel = newEffectSpellEntry ? `${newEffectSpellEntry.name} ${newEffectUses}/day` : newEffectLabel.trim();
      if (!spellLabel) return;
      setEditEffects((prev) => [...prev, {
        id: generateId(), type: "spell", label: spellLabel,
        description: newEffectSpellEntry?.desc || newEffectDesc.trim() || undefined,
        uses: parseInt(newEffectUses) || 1, resetOn: newEffectResetOn,
      }]);
      resetEffectFields();
      return;
    }
    const statKey = newEffectType === "stat_bonus" ? (newEffectStatKey ?? undefined) : undefined;
    const statValue = statKey != null ? (parseInt(newEffectStatVal) || 1) : undefined;
    const autoFilledStat = statKey != null && statValue != null ? statBonusLabel(statKey, statValue) : "";
    const atkDice = newEffectType === "attack_damage" ? newEffectAtkDice.trim() || undefined : undefined;
    const atkDmgType = newEffectType === "attack_damage" ? newEffectAtkDmgType.trim() || undefined : undefined;
    const autoFilledAtk = atkDice && atkDmgType ? `+${atkDice} ${atkDmgType} to all attacks` : "";
    const buffStatKey = newEffectType === "buff" ? (newEffectBuffStatKey ?? undefined) : undefined;
    const buffStatValue = buffStatKey != null ? (parseInt(newEffectBuffStatVal) || 1) : undefined;
    const label = newEffectLabel.trim() || autoFilledStat || autoFilledAtk;
    if (!label) return;
    setEditEffects((prev) => [...prev, {
      id: generateId(), type: newEffectType, label,
      description: newEffectDesc.trim() || undefined,
      statKey: statKey ?? buffStatKey, statValue: statValue ?? buffStatValue,
      attackDamageDice: atkDice, attackDamageType: atkDmgType,
    }]);
    resetEffectFields();
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const dmgMod = editDmgMod.trim() !== "" ? parseInt(editDmgMod) : undefined;
    const rangeVal = editRange.trim();
    const pendingExtra = newExtraDice.trim() && newExtraDmgType.trim()
      ? [{ dice: newExtraDice.trim(), damageType: newExtraDmgType.trim() }] : [];
    const finalAdditionalDamage = [...editAdditionalDamage, ...pendingExtra];
    setItems((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? withPricing({
              ...item,
              name: editName.trim() || item.name,
              quantity: parseInt(editQty) || item.quantity,
              category: editCategory,
              notes: editNotes.trim() || undefined,
              attackAbility: isEditWeapon && editDamageDice.trim() ? editAbility : undefined,
              isProficient: isEditWeapon && editDamageDice.trim() ? editIsProficient : undefined,
              damageDice: isEditWeapon && editDamageDice.trim() ? editDamageDice.trim() : undefined,
              damageModifier: isEditWeapon && !isNaN(dmgMod as number) ? dmgMod : undefined,
              damageType: isEditWeapon && editDmgType.trim() ? editDmgType.trim() : undefined,
              weaponRange: isEditWeapon && rangeVal ? rangeVal + " ft" : undefined,
              additionalDamage: isEditWeapon && finalAdditionalDamage.length > 0 ? finalAdditionalDamage : undefined,
              equippedEffects: editEffects.length > 0 ? editEffects : undefined,
            })
          : item
      )
    );
    setEditingId(null);
    setShowEditModal(false);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleApproveSelected = () => {
    const selectedItems = items.filter((i) => selected.has(i.id));
    if (selectedItems.length === 0) {
      Alert.alert("Nothing selected", "Select at least one item to add.");
      return;
    }
    applyProposedItems(selectedItems);
    if (questBatchId) {
      applyDeferredInventoryLinksForBatch(questBatchId, selectedItems.map((item) => item.id));
    }
    if (pendingCurrency) updateCurrency(pendingCurrency);
    router.back();
  };

  const handleApproveAll = () => {
    applyProposedItems(items);
    if (questBatchId) {
      applyDeferredInventoryLinksForBatch(questBatchId, items.map((item) => item.id));
    }
    if (pendingCurrency) updateCurrency(pendingCurrency);
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={[styles.loadingText, { color: c.foreground }]}>{loadingMsg}</Text>
        <Text style={[styles.loadingSubtext, { color: c.mutedForeground }]}>
          {source === "photo" ? "Sending to AI vision model..." : "Processing text update"}
        </Text>
      </View>
    );
  }

  if (error && !lootResult) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: c.background }]}>
        <View style={[styles.errorBox, { backgroundColor: "#EF444420", borderColor: "#EF4444", borderRadius: colors.radius * 1.5 }]}>
          <Feather name="alert-circle" size={28} color="#EF4444" style={{ marginBottom: 12 }} />
          <Text style={[styles.errorTitle, { color: "#EF4444" }]}>Analysis Failed</Text>
          <Text style={[styles.errorMsg, { color: c.mutedForeground }]}>{error}</Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity
              onPress={() => {
                setError(null);
                if (source === "text" && data) {
                  loadTextData(data);
                } else {
                  pickAndAnalyzePhoto();
                }
              }}
              activeOpacity={0.8}
              style={[styles.retryBtn, { backgroundColor: c.primary, borderRadius: colors.radius }]}
            >
              <Feather name="refresh-cw" size={14} color={c.primaryForeground} />
              <Text style={[styles.retryBtnText, { color: c.primaryForeground }]}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={[styles.backBtn, { backgroundColor: c.secondary, borderRadius: colors.radius }]}
            >
              <Text style={[styles.backBtnText, { color: c.mutedForeground }]}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const topPad = Platform.OS === "web" ? 16 : insets.top;

  return (
    <>
    {/* Custom header matching dm-npc baseline */}
    <View style={[styles.customHeader, { paddingTop: topPad + 12, borderBottomColor: c.border, backgroundColor: c.card }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
        <Feather name="arrow-left" size={22} color={c.foreground} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitleText, { color: c.foreground }]}>Loot Review</Text>
        <Text style={[styles.headerSubText, { color: c.mutedForeground }]}>
          {source === "photo" ? "Photo analysis" : "Text parse"} · review before adding
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => router.push("/loot-generator")}
        style={[styles.headerBackBtn, { marginLeft: 8 }]}
      >
        <Feather name="sliders" size={18} color={c.foreground} />
      </TouchableOpacity>
    </View>

    <ScrollHintScrollView
      style={[styles.container, { backgroundColor: c.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: insets.bottom + 40,
          paddingTop: 16,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Error banner (inline, non-blocking) */}
      {error && lootResult && (
        <View style={[styles.errorBanner, { backgroundColor: "#EF444420", borderColor: "#EF4444", borderRadius: colors.radius }]}>
          <Feather name="alert-circle" size={14} color="#EF4444" />
          <Text style={[styles.errorBannerText, { color: "#EF4444" }]}>{error}</Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.headerCard, { backgroundColor: c.card, borderRadius: colors.radius * 1.5, borderColor: c.border }]}>
        <View style={styles.headerTop}>
          <View style={[styles.sourceBadge, { backgroundColor: source === "photo" ? "#8B5CF620" : "#3B82F620" }]}>
            <Feather
              name={source === "photo" ? "camera" : "type"}
              size={12}
              color={source === "photo" ? "#8B5CF6" : "#3B82F6"}
            />
            <Text style={[styles.sourceText, { color: source === "photo" ? "#8B5CF6" : "#3B82F6" }]}>
              {source === "photo" ? "Photo Analysis" : "Text Parse"}
            </Text>
          </View>
          {lootResult?.confidence && (
            <View style={[styles.confidenceBadge, { backgroundColor: CONFIDENCE_COLORS[lootResult.confidence] + "20" }]}>
              <Text style={[styles.confidenceText, { color: CONFIDENCE_COLORS[lootResult.confidence] }]}>
                {lootResult.confidence.toUpperCase()} CONFIDENCE
              </Text>
            </View>
          )}
        </View>
        {!!lootResult?.summary && (
          <Text style={[styles.headerSummary, { color: c.foreground }]}>
            {lootResult.summary}
          </Text>
        )}
        {lootResult?.rawAnalysis && (
          <Text style={[styles.rawAnalysis, { color: c.mutedForeground }]}>
            "{lootResult.rawAnalysis}"
          </Text>
        )}

        {/* Currency preview */}
        {lootResult?.proposedCurrencyChange && (
          <View style={[styles.currencyPreview, { backgroundColor: "#F59E0B20", borderRadius: colors.radius }]}>
            <Feather name="dollar-sign" size={14} color="#F59E0B" />
            <Text style={[styles.currencyText, { color: "#F59E0B" }]}>
              {Object.entries(lootResult.proposedCurrencyChange)
                .filter(([, a]) => a != null && a !== 0)
                .map(([coin, a]) => `+${a} ${coin.toUpperCase()}`)
                .join(", ")}
            </Text>
          </View>
        )}

        {/* Add more screenshots */}
        {source === "photo" && (
          <TouchableOpacity
            onPress={addMorePhotos}
            activeOpacity={0.8}
            disabled={loading}
            style={[
              styles.addMoreBtn,
              { backgroundColor: "#8B5CF610", borderColor: "#8B5CF640", borderRadius: colors.radius },
            ]}
          >
            <Feather name="plus-circle" size={14} color="#8B5CF6" />
            <Text style={[styles.addMoreText, { color: "#8B5CF6" }]}>Add another screenshot</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Text parse input panel */}
      {source !== "photo" && (
        <View style={[styles.textParseCard, { backgroundColor: c.card, borderRadius: colors.radius * 1.5, borderColor: c.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Feather name="type" size={14} color={c.primary} />
            <Text style={[styles.textParseTitle, { color: c.foreground }]}>Describe loot or items</Text>
          </View>
          <TextInput
            value={textInput}
            onChangeText={setTextInput}
            placeholder={"e.g. 2 healing potions, a +1 longsword, and 50 gp"}
            placeholderTextColor={c.mutedForeground}
            multiline
            style={[
              styles.textParseInput,
              { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius },
            ]}
          />
          <TouchableOpacity
            onPress={handleTextParse}
            disabled={textParsing || !textInput.trim()}
            activeOpacity={0.8}
            style={[
              styles.textParseBtn,
              {
                backgroundColor: textInput.trim() ? c.primary : c.secondary,
                borderRadius: colors.radius,
                opacity: textParsing || !textInput.trim() ? 0.6 : 1,
              },
            ]}
          >
            {textParsing
              ? <ActivityIndicator size="small" color={textInput.trim() ? c.primaryForeground : c.mutedForeground} />
              : <Feather name="zap" size={14} color={textInput.trim() ? c.primaryForeground : c.mutedForeground} />}
            <Text style={[styles.textParseBtnText, { color: textInput.trim() ? c.primaryForeground : c.mutedForeground }]}>
              {textParsing ? "Parsing..." : "Parse Items"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Items */}
      <Text style={[styles.itemsTitle, { color: c.mutedForeground }]}>
        {items.length} proposed item{items.length !== 1 ? "s" : ""}
        {photoCount > 1 ? ` from ${photoCount} photos` : ""} — select to add
      </Text>

      {items.map((item) => (
        <View key={item.id}>
          <TouchableOpacity
              onPress={() => toggleSelect(item.id)}
              activeOpacity={0.8}
              style={[
                styles.itemCard,
                {
                  backgroundColor: c.card,
                  borderColor: selected.has(item.id) ? c.primary : c.border,
                  borderRadius: colors.radius * 1.5,
                  borderWidth: selected.has(item.id) ? 2 : 1,
                },
              ]}
            >
              <View style={styles.itemLeft}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: selected.has(item.id) ? c.primary : c.secondary,
                      borderColor: selected.has(item.id) ? c.primary : c.border,
                    },
                  ]}
                >
                  {selected.has(item.id) && (
                    <Feather name="check" size={12} color={c.primaryForeground} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.itemNameRow}>
                    <Text style={[styles.itemName, { color: c.foreground }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.itemQty, { color: c.primary }]}>×{item.quantity}</Text>
                    <View
                      style={[
                        styles.reviewBadge,
                        {
                          backgroundColor:
                            (item.sourceTag ?? (item.officialMatch ? "official" : "custom")) === "official"
                              ? "#10B98120"
                              : "#EF444420",
                        },
                      ]}
                    >
                      <Feather
                        name={(item.sourceTag ?? (item.officialMatch ? "official" : "custom")) === "official" ? "check-circle" : "edit-3"}
                        size={9}
                        color={(item.sourceTag ?? (item.officialMatch ? "official" : "custom")) === "official" ? "#10B981" : "#EF4444"}
                        style={{ marginRight: 3 }}
                      />
                      <Text
                        style={[
                          styles.reviewText,
                          {
                            color:
                              (item.sourceTag ?? (item.officialMatch ? "official" : "custom")) === "official"
                                ? "#10B981"
                                : "#EF4444",
                          },
                        ]}
                      >
                        {(item.sourceTag ?? (item.officialMatch ? "official" : "custom")) === "official" ? "Official" : "Custom"}
                      </Text>
                    </View>
                    {item.needsReview && (
                      <View style={[styles.reviewBadge, { backgroundColor: "#F59E0B20" }]}>
                        <Text style={[styles.reviewText, { color: "#F59E0B" }]}>Review</Text>
                      </View>
                    )}
                    {(item._mergedCount ?? 0) > 1 && (
                      <View style={[styles.reviewBadge, { backgroundColor: "#14B8A620" }]}>
                        <Feather name="git-merge" size={9} color="#14B8A6" style={{ marginRight: 3 }} />
                        <Text style={[styles.reviewText, { color: "#14B8A6" }]}>
                          Merged ×{item._mergedCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.itemMeta}>
                    <View style={[styles.confDot, { backgroundColor: CONFIDENCE_COLORS[item.confidence] }]} />
                    <Text style={[styles.itemCat, { color: c.mutedForeground }]}>
                      {item.category} · {item.confidence} confidence
                    </Text>
                    {item.value != null && (
                      <Text style={[styles.itemCat, { color: c.primary }]}>· {item.value} gp</Text>
                    )}
                  </View>
                  {item.tags && item.tags.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                      {item.tags.map((tag) => {
                        const isRarity = ["common","uncommon","rare","very rare","legendary","artifact"].includes(tag);
                        const rarityColor: Record<string,string> = { common:"#9CA3AF", uncommon:"#22C55E", rare:"#3B82F6", "very rare":"#A855F7", legendary:"#F97316", artifact:"#EF4444" };
                        const tagColor = isRarity ? (rarityColor[tag] ?? "#9CA3AF") : "#64748B";
                        return (
                          <View key={tag} style={{ backgroundColor: tagColor + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                            <Text style={{ fontSize: 10, fontWeight: "600", color: tagColor, textTransform: "capitalize" }}>{tag}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  {item.notes && (
                    <Text style={[styles.itemNotes, { color: c.mutedForeground }]}>
                      {item.notes}
                    </Text>
                  )}
                  {(() => { const _itemEffects = getRuntimeItemProjectedEffects(item as Partial<import("@/types").InventoryItem>); return _itemEffects.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {_itemEffects.map((eff, i) => {
                        const col = EFFECT_TYPE_COLORS[eff.type] ?? "#6B7280";
                        return (
                          <View
                            key={i}
                            style={{
                              backgroundColor: col + "20",
                              borderRadius: 4,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: col }} />
                            <Text style={{ fontSize: 10, fontWeight: "600", color: col }}>
                              {eff.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ); })()} 
                </View>
              </View>

              <View style={styles.itemActions}>
                <TouchableOpacity
                  onPress={() => handleStartEdit(item)}
                  style={[styles.itemActionBtn, { backgroundColor: c.secondary, borderRadius: 6 }]}
                  activeOpacity={0.7}
                >
                  <Feather name="edit-2" size={14} color={c.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRemove(item.id)}
                  style={[styles.itemActionBtn, { backgroundColor: c.secondary, borderRadius: 6 }]}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={14} color={c.destructive} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
        </View>
      ))}

      {items.length === 0 && !loading && (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No items to review</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          onPress={handleApproveSelected}
          activeOpacity={0.8}
          style={[styles.approveBtn, { backgroundColor: c.primary, borderRadius: colors.radius }]}
        >
          <Feather name="check" size={16} color={c.primaryForeground} />
          <Text style={[styles.approveBtnText, { color: c.primaryForeground }]}>
            Add Selected ({selected.size})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleApproveAll}
          activeOpacity={0.8}
          style={[styles.approveAllBtn, { backgroundColor: "#10B98120", borderColor: "#10B981", borderRadius: colors.radius }]}
        >
          <Feather name="check-circle" size={16} color="#10B981" />
          <Text style={[styles.approveAllText, { color: "#10B981" }]}>Add All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={[styles.cancelBtn, { backgroundColor: c.secondary, borderRadius: colors.radius }]}
        >
          <Text style={[styles.cancelText, { color: c.mutedForeground }]}>Discard</Text>
        </TouchableOpacity>
      </View>
    </ScrollHintScrollView>

    {/* Full edit modal */}
    <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: c.card, borderRadius: colors.radius * 2 }]}>
          <ScrollHintScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalTitle, { color: c.foreground }]}>Edit Item</Text>

            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Name *</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Item name"
              placeholderTextColor={c.mutedForeground}
              style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
            />

            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Quantity</Text>
            <TextInput
              value={editQty}
              onChangeText={setEditQty}
              keyboardType="number-pad"
              style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
            />

            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {ALL_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => setEditCategory(cat.value)}
                    style={[
                      styles.catChip,
                      { backgroundColor: editCategory === cat.value ? c.primary : c.secondary, borderRadius: colors.radius },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: editCategory === cat.value ? c.primaryForeground : c.mutedForeground }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginBottom: 0, flex: 1 }]}>Notes / Flavor Text</Text>
              <TouchableOpacity
                onPress={() => setEditNotes(randomFlavorText(editName || "item"))}
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
              placeholder="Item description or flavor text…"
              placeholderTextColor={c.mutedForeground}
              multiline
              numberOfLines={2}
              style={[
                styles.fieldInput,
                { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius, minHeight: 60, textAlignVertical: "top" },
              ]}
            />

            {/* Weapon stats */}
            {isEditWeapon && (
              <View style={[styles.weaponSection, { borderTopColor: c.border }]}>
                <Text style={[styles.sectionTitle, { color: c.foreground }]}>Attack Stats</Text>
                <Text style={[styles.sectionSub, { color: c.mutedForeground }]}>
                  Fill these in to auto-generate an attack card when equipped
                </Text>

                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Attack ability</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
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
                            { backgroundColor: isSelected ? c.primary : c.secondary, borderRadius: colors.radius },
                          ]}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: isSelected ? c.primaryForeground : c.mutedForeground }}>
                            {ABILITY_SHORT[key]}
                          </Text>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: isSelected ? c.primaryForeground : c.foreground }}>
                            {fmtMod(total)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <TouchableOpacity
                  onPress={() => setEditIsProficient((v) => !v)}
                  activeOpacity={0.8}
                  style={[styles.profToggle, {
                    backgroundColor: editIsProficient ? "#10B98120" : c.secondary,
                    borderColor: editIsProficient ? "#10B981" : c.border,
                    borderRadius: colors.radius,
                  }]}
                >
                  <View style={[styles.profToggleIcon, {
                    backgroundColor: editIsProficient ? "#10B981" : c.muted,
                    borderRadius: 6,
                  }]}>
                    <Feather name="check" size={12} color={editIsProficient ? "#fff" : c.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: editIsProficient ? "#10B981" : c.foreground }}>
                      Proficient with this weapon
                    </Text>
                    <Text style={{ fontSize: 12, color: c.mutedForeground }}>
                      {editIsProficient
                        ? `+${character.proficiencyBonus} proficiency bonus included`
                        : "Proficiency bonus not added"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={[styles.atkPreview, { backgroundColor: c.secondary, borderRadius: colors.radius }]}>
                  <Text style={{ fontSize: 12, color: c.mutedForeground }}>Attack Bonus =</Text>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: c.primary }}>{fmtMod(editAtkBonus)}</Text>
                  <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                    {editIsProficient
                      ? `(${ABILITY_SHORT[editAbility]} ${fmtMod(editAbilityMod)} + Prof ${fmtMod(character.proficiencyBonus)})`
                      : `(${ABILITY_SHORT[editAbility]} ${fmtMod(editAbilityMod)})`}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 8, marginBottom: 0 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Damage Dice</Text>
                    <TextInput
                      value={editDamageDice}
                      onChangeText={setEditDamageDice}
                      placeholder="e.g. 1d8"
                      placeholderTextColor={c.mutedForeground}
                      autoCapitalize="none"
                      style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Dmg Mod</Text>
                    <TextInput
                      value={editDmgMod}
                      onChangeText={setEditDmgMod}
                      placeholder="e.g. 2"
                      placeholderTextColor={c.mutedForeground}
                      keyboardType="numbers-and-punctuation"
                      style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Dmg Type</Text>
                    <TextInput
                      value={editDmgType}
                      onChangeText={setEditDmgType}
                      placeholder="e.g. slashing"
                      placeholderTextColor={c.mutedForeground}
                      autoCapitalize="none"
                      style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Range (ft)</Text>
                    <TextInput
                      value={editRange}
                      onChangeText={setEditRange}
                      placeholder="e.g. 5"
                      placeholderTextColor={c.mutedForeground}
                      keyboardType="number-pad"
                      style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Additional Damage (weapon only) */}
            {isEditWeapon && (
              <View style={[styles.weaponSection, { borderTopColor: c.border, marginTop: 0 }]}>
                <Text style={[styles.sectionTitle, { color: c.foreground }]}>Extra Damage Dice</Text>
                <Text style={[styles.sectionSub, { color: c.mutedForeground }]}>On-hit bonus damage dice (e.g. +1d6 fire)</Text>
                {editAdditionalDamage.map((d, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <View style={{ flex: 1, backgroundColor: c.secondary, borderRadius: colors.radius, padding: 8 }}>
                      <Text style={{ fontSize: 13, color: c.foreground }}>{d.dice} {d.damageType}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setEditAdditionalDamage((prev) => prev.filter((_, j) => j !== i))} activeOpacity={0.7}>
                      <Feather name="x" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <TextInput value={newExtraDice} onChangeText={setNewExtraDice} placeholder="1d6"
                    placeholderTextColor={c.mutedForeground} autoCapitalize="none"
                    style={[styles.fieldInput, { flex: 1, backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius, marginBottom: 0 }]} />
                  <TextInput value={newExtraDmgType} onChangeText={setNewExtraDmgType} placeholder="fire"
                    placeholderTextColor={c.mutedForeground} autoCapitalize="none"
                    style={[styles.fieldInput, { flex: 1.5, backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius, marginBottom: 0 }]} />
                  <TouchableOpacity onPress={() => {
                    if (!newExtraDice.trim() || !newExtraDmgType.trim()) return;
                    setEditAdditionalDamage((prev) => [...prev, { dice: newExtraDice.trim(), damageType: newExtraDmgType.trim() }]);
                    setNewExtraDice(""); setNewExtraDmgType("");
                  }} activeOpacity={0.7} style={{ backgroundColor: "#10B98120", borderRadius: 6, padding: 8 }}>
                    <Feather name="plus" size={14} color="#10B981" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Equipped Effects */}
            <View style={[styles.weaponSection, { borderTopColor: c.border }]}>
              <Text style={[styles.sectionTitle, { color: c.foreground }]}>Equipped Effects</Text>
              <Text style={[styles.sectionSub, { color: c.mutedForeground }]}>Passive bonuses applied when this item is equipped</Text>

              {/* Existing effects */}
              {editEffects.map((eff) => (
                <View key={eff.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <View style={{ flex: 1, flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: c.secondary, borderRadius: colors.radius, padding: 8 }}>
                    <View style={{ backgroundColor: EFFECT_TYPE_COLORS[eff.type] + "20", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: EFFECT_TYPE_COLORS[eff.type] }}>{EFFECT_TYPE_LABELS[eff.type]}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: c.foreground, flex: 1 }}>{eff.label}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setEditEffects((prev) => prev.filter((e) => e.id !== eff.id))} activeOpacity={0.7}>
                    <Feather name="x" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Effect type selector */}
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Effect Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(Object.keys(EFFECT_TYPE_LABELS) as ItemEffectType[]).map((et) => (
                    <TouchableOpacity key={et} onPress={() => setNewEffectType(et)} activeOpacity={0.7}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
                        backgroundColor: newEffectType === et ? EFFECT_TYPE_COLORS[et] + "30" : c.secondary,
                        borderWidth: newEffectType === et ? 1 : 0, borderColor: EFFECT_TYPE_COLORS[et] }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: newEffectType === et ? EFFECT_TYPE_COLORS[et] : c.mutedForeground }}>
                        {EFFECT_TYPE_LABELS[et]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={{ fontSize: 11, color: c.mutedForeground, marginBottom: 8 }}>{EFFECT_TYPE_HINTS[newEffectType]}</Text>

              {/* Stat bonus fields */}
              {newEffectType === "stat_bonus" && (
                <>
                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Stat to boost</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {STAT_KEY_ORDER.map((sk) => (
                        <TouchableOpacity key={sk} onPress={() => setNewEffectStatKey(sk)} activeOpacity={0.7}
                          style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                            backgroundColor: newEffectStatKey === sk ? "#10B98130" : c.secondary,
                            borderWidth: newEffectStatKey === sk ? 1 : 0, borderColor: "#10B981" }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: newEffectStatKey === sk ? "#10B981" : c.mutedForeground }}>
                            {STAT_KEY_LABELS[sk]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Value (+N)</Text>
                      <TextInput value={newEffectStatVal} onChangeText={setNewEffectStatVal} keyboardType="numbers-and-punctuation"
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]} />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Custom label (optional)</Text>
                      <TextInput value={newEffectLabel} onChangeText={setNewEffectLabel} placeholder={
                        newEffectStatKey ? statBonusLabel(newEffectStatKey, parseInt(newEffectStatVal) || 1) : "Auto-generated"
                      } placeholderTextColor={c.mutedForeground}
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]} />
                    </View>
                  </View>
                </>
              )}

              {/* Attack damage fields */}
              {newEffectType === "attack_damage" && (
                <>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Dice</Text>
                      <TextInput value={newEffectAtkDice} onChangeText={setNewEffectAtkDice} placeholder="e.g. 1d6" autoCapitalize="none"
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]} />
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Damage type</Text>
                      <TextInput value={newEffectAtkDmgType} onChangeText={setNewEffectAtkDmgType} placeholder="e.g. fire" autoCapitalize="none"
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]} />
                    </View>
                  </View>
                </>
              )}

              {/* Spell fields */}
              {newEffectType === "spell" && (
                <>
                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Search Spell</Text>
                  <TextInput value={newEffectSpellSearch} onChangeText={(t) => { setNewEffectSpellSearch(t); setNewEffectSpellEntry(null); }}
                    placeholder="Fireball, Cure Wounds…" placeholderTextColor={c.mutedForeground} autoCapitalize="none"
                    style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]} />
                  {newEffectSpellSearch.trim().length >= 2 && !newEffectSpellEntry && (
                    <ScrollView style={{ maxHeight: 120, backgroundColor: c.secondary, borderRadius: colors.radius, marginBottom: 6 }} keyboardShouldPersistTaps="handled">
                      {SPELL_LIST.filter((s) => s.name.toLowerCase().includes(newEffectSpellSearch.toLowerCase())).slice(0, 8).map((s) => (
                        <TouchableOpacity key={s.name} onPress={() => { setNewEffectSpellEntry(s); setNewEffectSpellSearch(s.name); }} activeOpacity={0.7}
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
                  {newEffectSpellEntry && (
                    <View style={{ backgroundColor: "#8B5CF620", borderRadius: colors.radius, padding: 8, marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#8B5CF6" }}>{newEffectSpellEntry.name}</Text>
                      <Text style={{ fontSize: 11, color: c.mutedForeground }} numberOfLines={2}>{newEffectSpellEntry.desc}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Uses</Text>
                      <TextInput value={newEffectUses} onChangeText={setNewEffectUses} keyboardType="number-pad"
                        style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]} />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Recharge</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          {(["short_rest", "long_rest", "dawn"] as const).map((r) => (
                            <TouchableOpacity key={r} onPress={() => setNewEffectResetOn(r)} activeOpacity={0.7}
                              style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                                backgroundColor: newEffectResetOn === r ? "#8B5CF630" : c.secondary,
                                borderWidth: newEffectResetOn === r ? 1 : 0, borderColor: "#8B5CF6" }}>
                              <Text style={{ fontSize: 10, fontWeight: "700", color: newEffectResetOn === r ? "#8B5CF6" : c.mutedForeground }}>
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

              {/* Buff / passive fields */}
              {(newEffectType === "buff" || newEffectType === "note" || newEffectType === "feature") && (
                <>
                  <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Label *</Text>
                  <TextInput value={newEffectLabel} onChangeText={setNewEffectLabel}
                    placeholder={newEffectType === "buff" ? "e.g. Resistance: fire" : newEffectType === "feature" ? "e.g. +2 Rage uses" : "Short reminder note"}
                    placeholderTextColor={c.mutedForeground}
                    style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]} />
                  {newEffectType === "buff" && (
                    <>
                      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Optional stat bump</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                        <View style={{ flexDirection: "row", gap: 5 }}>
                          <TouchableOpacity onPress={() => setNewEffectBuffStatKey(null)} activeOpacity={0.7}
                            style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: newEffectBuffStatKey === null ? "#3B82F630" : c.secondary, borderWidth: newEffectBuffStatKey === null ? 1 : 0, borderColor: "#3B82F6" }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: newEffectBuffStatKey === null ? "#3B82F6" : c.mutedForeground }}>None</Text>
                          </TouchableOpacity>
                          {STAT_KEY_ORDER.map((sk) => (
                            <TouchableOpacity key={sk} onPress={() => setNewEffectBuffStatKey(sk)} activeOpacity={0.7}
                              style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: newEffectBuffStatKey === sk ? "#3B82F630" : c.secondary, borderWidth: newEffectBuffStatKey === sk ? 1 : 0, borderColor: "#3B82F6" }}>
                              <Text style={{ fontSize: 10, fontWeight: "700", color: newEffectBuffStatKey === sk ? "#3B82F6" : c.mutedForeground }}>{STAT_KEY_LABELS[sk]}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      {newEffectBuffStatKey && (
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Value</Text>
                            <TextInput value={newEffectBuffStatVal} onChangeText={setNewEffectBuffStatVal} keyboardType="numbers-and-punctuation"
                              style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius }]} />
                          </View>
                        </View>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Description (all types) */}
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Description (optional)</Text>
              <TextInput value={newEffectDesc} onChangeText={setNewEffectDesc} placeholder="Longer explanation or lore note"
                placeholderTextColor={c.mutedForeground} multiline numberOfLines={2}
                style={[styles.fieldInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius, minHeight: 50, textAlignVertical: "top" }]} />

              <TouchableOpacity onPress={handleAddEffect} activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#10B98120", borderRadius: colors.radius, paddingVertical: 10, marginTop: 4 }}>
                <Feather name="plus-circle" size={14} color="#10B981" />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#10B981" }}>Add Effect</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { setShowEditModal(false); setEditingId(null); }}
                activeOpacity={0.7}
                style={[styles.modalCancelBtn, { backgroundColor: c.secondary, borderRadius: colors.radius }]}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: c.mutedForeground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                activeOpacity={0.8}
                style={[styles.modalSaveBtn, { backgroundColor: c.primary, borderRadius: colors.radius }]}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: c.primaryForeground }}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </ScrollHintScrollView>
        </View>
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBackBtn: { padding: 4 },
  headerTitleText: { fontSize: 17, fontWeight: "700" },
  headerSubText: { fontSize: 11, marginTop: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  loadingText: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  loadingSubtext: { fontSize: 14, textAlign: "center" },
  errorBox: { width: "100%", padding: 24, alignItems: "center" },
  errorTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  errorMsg: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  errorButtons: { flexDirection: "row", gap: 10, width: "100%" },
  retryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14 },
  retryBtnText: { fontSize: 14, fontWeight: "700" },
  backBtn: { flex: 1, padding: 14, alignItems: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 12, borderWidth: 1 },
  errorBannerText: { fontSize: 13, flex: 1 },
  headerCard: { padding: 16, marginBottom: 16, borderWidth: 1 },
  headerTop: { flexDirection: "row", gap: 8, marginBottom: 10 },
  sourceBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sourceText: { fontSize: 11, fontWeight: "700" },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  confidenceText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  headerSummary: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  rawAnalysis: { fontSize: 12, fontStyle: "italic", marginBottom: 10 },
  currencyPreview: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, marginTop: 4 },
  currencyText: { fontSize: 13, fontWeight: "600" },
  addMoreBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, marginTop: 10, borderWidth: 1 },
  addMoreText: { fontSize: 13, fontWeight: "600" },
  itemsTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  itemCard: { marginBottom: 10, padding: 12, flexDirection: "row", alignItems: "flex-start" },
  itemLeft: { flex: 1, flexDirection: "row", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  itemNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" },
  itemName: { fontSize: 15, fontWeight: "700" },
  itemQty: { fontSize: 14, fontWeight: "700" },
  reviewBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  reviewText: { fontSize: 10, fontWeight: "700" },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  confDot: { width: 6, height: 6, borderRadius: 3 },
  itemCat: { fontSize: 11, textTransform: "capitalize" },
  itemNotes: { fontSize: 12, fontStyle: "italic" },
  itemActions: { flexDirection: "column", gap: 6, marginLeft: 8 },
  itemActionBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", marginTop: 40 },
  emptyText: { fontSize: 14 },
  bottomActions: { marginTop: 16, gap: 10 },
  approveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
  approveBtnText: { fontSize: 15, fontWeight: "700" },
  approveAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderWidth: 1 },
  approveAllText: { fontSize: 15, fontWeight: "700" },
  cancelBtn: { padding: 14, alignItems: "center" },
  cancelText: { fontSize: 14, fontWeight: "600" },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  modalContent: { maxHeight: "90%", padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  fieldInput: { padding: 12, fontSize: 14, marginBottom: 12 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8 },
  weaponSection: { borderTopWidth: 1, marginTop: 8, paddingTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  sectionSub: { fontSize: 12, marginBottom: 12 },
  abilityChip: { paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", minWidth: 52 },
  profToggle: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1, marginBottom: 12 },
  profToggleIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  atkPreview: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, marginBottom: 12 },
  modalCancelBtn: { flex: 1, padding: 14, alignItems: "center" },
  modalSaveBtn: { flex: 1, padding: 14, alignItems: "center" },
  // Text parse panel
  textParseCard: { padding: 14, marginBottom: 14, borderWidth: 1, gap: 10 },
  textParseTitle: { fontSize: 14, fontWeight: "700" },
  textParseInput: { padding: 12, fontSize: 14, minHeight: 72, textAlignVertical: "top" },
  textParseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14 },
  textParseBtnText: { fontSize: 14, fontWeight: "700" },
});
