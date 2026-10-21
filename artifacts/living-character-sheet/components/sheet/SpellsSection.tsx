import React, { useState, useMemo, useCallback } from "react";
import {
  Animated,
  Easing,
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useCombat } from "@/context/CombatContext";
import { DEFAULT_MOTIONS, useAppSettings } from "@/context/AppSettingsContext";
import { useHelpPopup } from "@/hooks/useHelpPopup";
import { useFilterPanelMotion } from "@/hooks/useFilterPanelMotion";
import type { PreparedSpell, SpellSchool } from "@/types";
import { SPELL_LIST } from "@/data/spellList";
import { buildCombatActionCommand } from "@/utils/combat/buildCombatActionCommand";
import { buildSpellDeclaredPayload } from "@/utils/combat/buildSpellDeclaredPayload";
import { buildDeclaredReaction } from "@/utils/combat/buildDeclaredReaction";
import { formatDeclaredSpellSummary, formatSpellCastEventMessage } from "@/utils/combat/spellMetadataPresentation";
import { getCombatRejectMessage, formatOutcomeSummary } from "@/utils/combat/combatFeedback";
import type { CombatActionResult } from "@/types/combatResolution";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPELL_LEVEL_LABELS: Record<number, string> = {
  0: "Cantrip", 1: "1st", 2: "2nd", 3: "3rd",
  4: "4th", 5: "5th", 6: "6th", 7: "7th", 8: "8th", 9: "9th",
};

const SCHOOL_COLORS: Record<SpellSchool, string> = {
  Abjuration:   "#3B82F6",
  Conjuration:  "#8B5CF6",
  Divination:   "#06B6D4",
  Enchantment:  "#EC4899",
  Evocation:    "#EF4444",
  Illusion:     "#A78BFA",
  Necromancy:   "#10B981",
  Transmutation:"#F59E0B",
};

const SCHOOLS: SpellSchool[] = [
  "Abjuration","Conjuration","Divination","Enchantment",
  "Evocation","Illusion","Necromancy","Transmutation",
];

function isSpellSchool(value: string): value is SpellSchool {
  return SCHOOLS.includes(value as SpellSchool);
}

const CASTING_TIMES = [
  "1 action", "1 bonus action", "1 reaction", "1 minute",
  "10 minutes", "1 hour", "8 hours", "Ritual (10 min)",
];

type FilterLevel = "all" | "cantrip" | number;

const CUSTOM_SPELLS_STORAGE_KEY = "@custom_spell_catalog_v1";
const RANGE_FILTERS = ["Touch", "Self", "30 feet", "60 feet", "120 feet", "Sight"];
const DURATION_FILTERS = ["Instantaneous", "1 round", "1 minute", "10 minutes", "1 hour", "8 hours", "24 hours"];

const SPELL_MODAL_HELP: Record<string, string> = {
  "SPELL NAME *": "Use the canonical spell name when possible so search, dedupe, and source tagging remain accurate.",
  "OFFICIAL 5E SPELL SEARCH": "Search the built-in official catalog and optionally filter by level, school, timing, range, duration, ritual, and concentration.",
  "SPELL LEVEL": "Level determines slot usage and whether this appears under cantrips or leveled spells in other views.",
  "SCHOOL (OPTIONAL)": "School helps classification, filtering, and visual grouping. Keep it consistent with official definitions when possible.",
  "CASTING TIME": "Casting time affects action economy in combat and should match how the spell is intended to be used.",
  RANGE: "Range controls target distance and tactical constraints. Use clear ranges like Self, Touch, or feet values.",
  DURATION: "Duration should indicate if the spell is instantaneous, timed, or persistent until conditions end.",
  DESCRIPTION: "Description captures rules text and practical effects players need when casting.",
};

type CatalogSpell = {
  name: string;
  level: number;
  school?: SpellSchool;
  castingTime?: string;
  range?: string;
  duration?: string;
  concentration?: boolean;
  ritual?: boolean;
  desc?: string;
  source: "official" | "custom";
};

function normalizeSpellKey(name: string, level: number) {
  return `${name.trim().toLowerCase()}::${level}`;
}

// ── Add/Edit modal ─────────────────────────────────────────────────────────────

interface SpellModalProps {
  visible: boolean;
  spell: PreparedSpell | null;
  onClose: () => void;
  onSave: (data: Omit<PreparedSpell, "id" | "createdAt">) => void;
}

function SpellModal({ visible, spell, onClose, onSave }: SpellModalProps) {
  const c = useColors();
  const { settings } = useAppSettings();
  const { showHelp, helpPopup } = useHelpPopup();
  const motionIntensity = settings.motionIntensity ?? "full";
  const motionsEnabled = settings.motions?.enabled ?? DEFAULT_MOTIONS.enabled;
  const modalMotionEnabled =
    motionsEnabled &&
    motionIntensity !== "off" &&
    (settings.motions?.spellModalTransition ?? DEFAULT_MOTIONS.spellModalTransition);
  const motionDuration = motionIntensity === "subtle" ? 120 : 190;
  const useNativeDriver = Platform.OS !== "web";
  const modalAnim = React.useRef(new Animated.Value(1)).current;
  const showFieldHelp = useCallback((label: string) => {
    const body = SPELL_MODAL_HELP[label] ?? "This field controls spell metadata used in filtering, casting behavior, and display.";
    showHelp(label, body);
  }, [showHelp]);

  const [name, setName] = useState("");
  const [level, setLevel] = useState(0);
  const [school, setSchool] = useState<SpellSchool | undefined>();
  const [castingTime, setCastingTime] = useState("1 action");
  const [range, setRange] = useState("");
  const [duration, setDuration] = useState("");
  const [concentration, setConcentration] = useState(false);
  const [ritual, setRitual] = useState(false);
  const [description, setDescription] = useState("");
  const [prepared, setPrepared] = useState(true);
  const [spellQuery, setSpellQuery] = useState("");
  const [customSpells, setCustomSpells] = useState<CatalogSpell[]>([]);
  const [customSavedThisSession, setCustomSavedThisSession] = useState(false);

  const [filterLevel, setFilterLevel] = useState<FilterLevel>("all");
  const [filterSchool, setFilterSchool] = useState<"all" | SpellSchool>("all");
  const [filterCastingTime, setFilterCastingTime] = useState<"all" | string>("all");
  const [filterRange, setFilterRange] = useState<"all" | string>("all");
  const [filterDuration, setFilterDuration] = useState<"all" | string>("all");
  const [filterConcentration, setFilterConcentration] = useState<"all" | "yes" | "no">("all");
  const [filterRitual, setFilterRitual] = useState<"all" | "yes" | "no">("all");
  const [filterSource, setFilterSource] = useState<"all" | "official" | "custom">("all");
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const { filterPanelAnimatedStyle } = useFilterPanelMotion(showSearchFilters, settings);

  React.useEffect(() => {
    if (!visible) return;
    let mounted = true;
    async function loadCustomSpells() {
      try {
        const raw = await AsyncStorage.getItem(CUSTOM_SPELLS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as CatalogSpell[]) : [];
        if (mounted) {
          setCustomSpells(Array.isArray(parsed) ? parsed.filter((s) => s?.name).map((s) => ({ ...s, source: "custom" })) : []);
        }
      } catch {
        if (mounted) setCustomSpells([]);
      }
    }
    loadCustomSpells();
    return () => {
      mounted = false;
    };
  }, [visible]);

  React.useEffect(() => {
    if (visible) {
      setName(spell?.name ?? "");
      setLevel(spell?.level ?? 0);
      setSchool(spell?.school);
      setCastingTime(spell?.castingTime ?? "1 action");
      setRange(spell?.range ?? "");
      setDuration(spell?.duration ?? "");
      setConcentration(spell?.concentration ?? false);
      setRitual(spell?.ritual ?? false);
      setDescription(spell?.description ?? "");
      setPrepared(spell?.prepared ?? true);
      setSpellQuery(spell?.name ?? "");
      setCustomSavedThisSession(false);
      setFilterLevel("all");
      setFilterSchool("all");
      setFilterCastingTime("all");
      setFilterRange("all");
      setFilterDuration("all");
      setFilterConcentration("all");
      setFilterRitual("all");
      setFilterSource("all");
      setShowSearchFilters(false);
    }
  }, [visible, spell]);

  React.useEffect(() => {
    if (!visible) {
      modalAnim.setValue(1);
      return;
    }
    if (!modalMotionEnabled) {
      modalAnim.setValue(1);
      return;
    }
    modalAnim.setValue(0);
    Animated.timing(modalAnim, {
      toValue: 1,
      duration: motionDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [modalAnim, modalMotionEnabled, motionDuration, useNativeDriver, visible]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterSource !== "all") count += 1;
    if (filterLevel !== "all") count += 1;
    if (filterSchool !== "all") count += 1;
    if (filterCastingTime !== "all") count += 1;
    if (filterRange !== "all") count += 1;
    if (filterDuration !== "all") count += 1;
    if (filterConcentration !== "all") count += 1;
    if (filterRitual !== "all") count += 1;
    return count;
  }, [filterSource, filterLevel, filterSchool, filterCastingTime, filterRange, filterDuration, filterConcentration, filterRitual]);

  const officialCatalog = useMemo<CatalogSpell[]>(() => {
    return SPELL_LIST.map((entry) => ({
      name: entry.name,
      level: entry.level,
      school: isSpellSchool(entry.school) ? entry.school : undefined,
      desc: entry.desc,
      source: "official",
    }));
  }, []);

  const fullCatalog = useMemo<CatalogSpell[]>(() => {
    const customByKey = new Map<string, CatalogSpell>();
    customSpells.forEach((sp) => {
      customByKey.set(normalizeSpellKey(sp.name, sp.level), { ...sp, source: "custom" });
    });

    const officialWithoutCustomDupes = officialCatalog.filter(
      (sp) => !customByKey.has(normalizeSpellKey(sp.name, sp.level))
    );

    return [...customByKey.values(), ...officialWithoutCustomDupes];
  }, [customSpells, officialCatalog]);

  const spellSuggestions = useMemo(() => {
    const q = spellQuery.trim().toLowerCase();
    const list = fullCatalog.filter((entry) => {
      if (q && !entry.name.toLowerCase().includes(q)) return false;

      if (filterSource !== "all" && entry.source !== filterSource) return false;

      if (filterLevel === "cantrip" && entry.level !== 0) return false;
      if (typeof filterLevel === "number" && entry.level !== filterLevel) return false;

      if (filterSchool !== "all" && entry.school !== filterSchool) return false;

      if (filterCastingTime !== "all") {
        const ct = (entry.castingTime ?? "").toLowerCase();
        if (!ct.includes(filterCastingTime.toLowerCase())) return false;
      }

      if (filterRange !== "all") {
        const rg = (entry.range ?? "").toLowerCase();
        if (!rg.includes(filterRange.toLowerCase())) return false;
      }

      if (filterDuration !== "all") {
        const du = (entry.duration ?? "").toLowerCase();
        if (!du.includes(filterDuration.toLowerCase())) return false;
      }

      if (filterConcentration === "yes" && !entry.concentration) return false;
      if (filterConcentration === "no" && entry.concentration) return false;

      if (filterRitual === "yes" && !entry.ritual) return false;
      if (filterRitual === "no" && entry.ritual) return false;

      return true;
    });

    return list
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [fullCatalog, spellQuery, filterSource, filterLevel, filterSchool, filterCastingTime, filterRange, filterDuration, filterConcentration, filterRitual]);

  function applySpellSuggestion(entry: CatalogSpell) {
    setName(entry.name);
    setSpellQuery(entry.name);
    setLevel(entry.level);
    setSchool(entry.school);
    setCastingTime(entry.castingTime ?? "1 action");
    setRange(entry.range ?? "");
    setDuration(entry.duration ?? "");
    setConcentration(Boolean(entry.concentration));
    setRitual(Boolean(entry.ritual));
    setDescription(entry.desc ?? "");
    setCustomSavedThisSession(entry.source === "custom");
  }

  const officialExactMatch = useMemo(() => {
    const key = normalizeSpellKey(name, level);
    return officialCatalog.some((sp) => normalizeSpellKey(sp.name, sp.level) === key);
  }, [name, level, officialCatalog]);

  const officialEntryForForm = useMemo(() => {
    const key = normalizeSpellKey(name, level);
    return officialCatalog.find((sp) => normalizeSpellKey(sp.name, sp.level) === key) ?? null;
  }, [name, level, officialCatalog]);

  const customEntryForForm = useMemo(() => {
    const key = normalizeSpellKey(name, level);
    return customSpells.find((sp) => normalizeSpellKey(sp.name, sp.level) === key) ?? null;
  }, [name, level, customSpells]);

  const isModifiedOfficialForm = useMemo(() => {
    if (!officialEntryForForm) return false;
    const schoolChanged = (officialEntryForForm.school ?? "") !== (school ?? "");
    const descChanged = (officialEntryForForm.desc ?? "").trim() !== description.trim();
    const hasExtraOverrides = Boolean(
      castingTime !== "1 action" ||
      range.trim() ||
      duration.trim() ||
      concentration ||
      ritual
    );
    return schoolChanged || descChanged || hasExtraOverrides;
  }, [officialEntryForForm, school, description, castingTime, range, duration, concentration, ritual]);

  const showSaveAsCustomButton = useMemo(() => {
    if (!name.trim()) return false;
    if (customSavedThisSession) return false;
    if (customEntryForForm) return false;
    if (!officialEntryForForm) return true; // manual spell
    return isModifiedOfficialForm; // official spell changed
  }, [name, customSavedThisSession, customEntryForForm, officialEntryForForm, isModifiedOfficialForm]);

  async function persistCustomSpell(entry: CatalogSpell) {
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_SPELLS_STORAGE_KEY);
      const existing = raw ? (JSON.parse(raw) as CatalogSpell[]) : [];
      const nextMap = new Map<string, CatalogSpell>();
      (Array.isArray(existing) ? existing : []).forEach((sp) => {
        if (!sp?.name) return;
        nextMap.set(normalizeSpellKey(sp.name, sp.level), { ...sp, source: "custom" });
      });
      nextMap.set(normalizeSpellKey(entry.name, entry.level), { ...entry, source: "custom" });
      const next = Array.from(nextMap.values());
      await AsyncStorage.setItem(CUSTOM_SPELLS_STORAGE_KEY, JSON.stringify(next));
      setCustomSpells(next);
    } catch {
      Alert.alert("Custom spell not saved", "The spell was added to your sheet, but could not be saved to the custom spell catalog.");
    }
  }

  async function handleSave() {
    if (!name.trim()) return Alert.alert("Name required", "Please enter a spell name.");
    onSave({
      name: name.trim(), level, school, castingTime, prepared,
      range: range.trim() || undefined, duration: duration.trim() || undefined,
      concentration, ritual, description: description.trim() || undefined,
    });
  }

  async function handleSaveAsCustomSpell() {
    if (!name.trim()) return;
    await persistCustomSpell({
      name: name.trim(),
      level,
      school,
      castingTime,
      range: range.trim() || undefined,
      duration: duration.trim() || undefined,
      concentration,
      ritual,
      desc: description.trim() || undefined,
      source: "custom",
    });
    setCustomSavedThisSession(true);
    Alert.alert("Saved", "Saved to custom spell catalog.");
  }

  function renderSuggestionSourceTag(sourceTag: "official" | "custom") {
    if (settings.spellSourceTagStyle === "hidden") return null;
    if (settings.spellSourceTagStyle === "dot") {
      return <View style={sourceTag === "custom" ? s.customDot : s.officialDot} />;
    }
    const label = settings.spellSourceTagStyle === "compact"
      ? (sourceTag === "custom" ? "C" : "O")
      : (sourceTag === "custom" ? "CUSTOM" : "OFFICIAL");
    return (
      <View style={sourceTag === "custom" ? s.customBadge : s.officialBadge}>
        <Text style={sourceTag === "custom" ? s.customBadgeText : s.officialBadgeText}>{label}</Text>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[s.mHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose} style={s.mHeaderBtn}>
            <Text style={[s.mHeaderBtnText, { color: c.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[s.mHeaderTitle, { color: c.foreground }]}>{spell ? "Edit Spell" : "Add Spell"}</Text>
          <TouchableOpacity onPress={handleSave} style={s.mHeaderBtn}>
            <Text style={[s.mHeaderBtnText, { color: c.primary, fontWeight: "700" }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <Animated.View
          style={{
            flex: 1,
            opacity: modalAnim,
            transform: [
              {
                translateY: modalAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [motionIntensity === "subtle" ? 5 : 10, 0],
                }),
              },
            ],
          }}
        >
        <ScrollView contentContainerStyle={s.mBody} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <TouchableOpacity onLongPress={() => showFieldHelp("SPELL NAME *")} delayLongPress={380} activeOpacity={0.85}>
            <Text style={[s.label, { color: c.mutedForeground }]}>SPELL NAME *</Text>
          </TouchableOpacity>
          <TextInput
            style={[s.input, { backgroundColor: c.card, borderColor: name.trim() ? c.primary : c.border, color: c.foreground }]}
            placeholder="e.g. Fireball" placeholderTextColor={c.mutedForeground}
            value={name}
            onChangeText={(value) => {
              setName(value);
              setSpellQuery(value);
            }}
          />

          {!spell && (
            <>
              <TouchableOpacity onLongPress={() => showFieldHelp("OFFICIAL 5E SPELL SEARCH")} delayLongPress={380} activeOpacity={0.85}>
                <Text style={[s.label, { color: c.mutedForeground }]}>OFFICIAL 5E SPELL SEARCH</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setShowSearchFilters((v) => !v)}
                style={[s.filterTogglePill, { backgroundColor: c.card, borderColor: showSearchFilters ? c.primary : c.border }]}
              >
                <View style={s.filterToggleLeft}>
                  <Feather name="filter" size={12} color={showSearchFilters ? c.primary : c.mutedForeground} />
                  <Text style={[s.filterToggleText, { color: showSearchFilters ? c.primary : c.mutedForeground }]}>Search Filters</Text>
                  {activeFilterCount > 0 && (
                    <View style={[s.filterActiveBadge, { backgroundColor: c.primary + "22", borderColor: c.primary + "66" }]}>
                      <Text style={[s.filterActiveBadgeText, { color: c.primary }]}>{activeFilterCount} active</Text>
                    </View>
                  )}
                </View>
                <Feather name={showSearchFilters ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
              </TouchableOpacity>

              {showSearchFilters && (
                <Animated.View
                  style={[
                    s.filterPanel,
                    filterPanelAnimatedStyle,
                  ]}
                >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                <View style={s.chipRow}>
                  {[
                    { key: "all", label: "All Sources" },
                    { key: "official", label: "Official" },
                    { key: "custom", label: "Custom" },
                  ].map((opt) => {
                    const active = filterSource === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setFilterSource(opt.key as "all" | "official" | "custom")}
                        style={[s.chip, { borderColor: active ? "#EF4444" : c.border, backgroundColor: active ? "#EF444422" : c.card }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, { color: active ? "#EF4444" : c.mutedForeground }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                <View style={s.chipRow}>
                  {["all", "cantrip", 1, 2, 3, 4, 5, 6, 7, 8, 9].map((lv) => {
                    const active = filterLevel === lv;
                    const label = lv === "all" ? "Any Level" : lv === "cantrip" ? "Cantrip" : SPELL_LEVEL_LABELS[lv as number];
                    return (
                      <TouchableOpacity
                        key={String(lv)}
                        onPress={() => setFilterLevel(lv as FilterLevel)}
                        style={[s.chip, { borderColor: active ? "#A78BFA" : c.border, backgroundColor: active ? "#A78BFA22" : c.card }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, { color: active ? "#A78BFA" : c.mutedForeground }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                <View style={s.chipRow}>
                  {["all", ...SCHOOLS].map((sc) => {
                    const active = filterSchool === sc;
                    const col = sc === "all" ? c.primary : SCHOOL_COLORS[sc as SpellSchool];
                    return (
                      <TouchableOpacity
                        key={sc}
                        onPress={() => setFilterSchool(sc as "all" | SpellSchool)}
                        style={[s.chip, { borderColor: active ? col : c.border, backgroundColor: active ? `${col}22` : c.card }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, { color: active ? col : c.mutedForeground }]}>{sc === "all" ? "Any School" : sc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                <View style={s.chipRow}>
                  {["all", ...CASTING_TIMES].map((ct) => {
                    const active = filterCastingTime === ct;
                    return (
                      <TouchableOpacity
                        key={ct}
                        onPress={() => setFilterCastingTime(ct as "all" | string)}
                        style={[s.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? `${c.primary}22` : c.card }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, { color: active ? c.primary : c.mutedForeground }]}>{ct === "all" ? "Any Casting Time" : ct}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                <View style={s.chipRow}>
                  {["all", ...RANGE_FILTERS].map((rg) => {
                    const active = filterRange === rg;
                    return (
                      <TouchableOpacity
                        key={rg}
                        onPress={() => setFilterRange(rg as "all" | string)}
                        style={[s.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? `${c.primary}22` : c.card }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, { color: active ? c.primary : c.mutedForeground }]}>{rg === "all" ? "Any Range" : rg}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                <View style={s.chipRow}>
                  {["all", ...DURATION_FILTERS].map((du) => {
                    const active = filterDuration === du;
                    return (
                      <TouchableOpacity
                        key={du}
                        onPress={() => setFilterDuration(du as "all" | string)}
                        style={[s.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? `${c.primary}22` : c.card }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, { color: active ? c.primary : c.mutedForeground }]}>{du === "all" ? "Any Duration" : du}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                <View style={s.chipRow}>
                  {["all", "yes", "no"].map((v) => {
                    const active = filterConcentration === v;
                    return (
                      <TouchableOpacity
                        key={`concentration-${v}`}
                        onPress={() => setFilterConcentration(v as "all" | "yes" | "no")}
                        style={[s.chip, { borderColor: active ? "#06B6D4" : c.border, backgroundColor: active ? "#06B6D422" : c.card }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, { color: active ? "#06B6D4" : c.mutedForeground }]}>{v === "all" ? "Any Concentration" : v === "yes" ? "Concentration" : "Non-Concentration"}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {["all", "yes", "no"].map((v) => {
                    const active = filterRitual === v;
                    return (
                      <TouchableOpacity
                        key={`ritual-${v}`}
                        onPress={() => setFilterRitual(v as "all" | "yes" | "no")}
                        style={[s.chip, { borderColor: active ? "#8B5CF6" : c.border, backgroundColor: active ? "#8B5CF622" : c.card }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, { color: active ? "#8B5CF6" : c.mutedForeground }]}>{v === "all" ? "Any Ritual" : v === "yes" ? "Ritual" : "Non-Ritual"}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
                </Animated.View>
              )}

              <View style={s.searchSectionGap} />

              <View style={[s.suggestionWrap, { backgroundColor: c.card, borderColor: c.border }]}> 
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={s.suggestionScroll}>
                  {spellSuggestions.map((entry) => (
                    <TouchableOpacity
                      key={`${entry.name}-${entry.level}`}
                      onPress={() => applySpellSuggestion(entry)}
                      activeOpacity={0.82}
                      style={[s.suggestionRow, { borderBottomColor: c.border }]}
                    >
                      <View style={s.suggestionNameRow}>
                        <Text style={[s.suggestionName, { color: c.foreground }]}>{entry.name}</Text>
                        {renderSuggestionSourceTag(entry.source)}
                      </View>
                      <Text style={[s.suggestionMeta, { color: c.mutedForeground }]}>
                        {SPELL_LEVEL_LABELS[entry.level]}{entry.school ? ` • ${entry.school}` : ""}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {spellSuggestions.length === 0 && (
                    <Text style={[s.suggestionEmpty, { color: c.mutedForeground }]}>No matching spells</Text>
                  )}
                </ScrollView>
              </View>
            </>
          )}

          {/* Level */}
          <TouchableOpacity onLongPress={() => showFieldHelp("SPELL LEVEL")} delayLongPress={380} activeOpacity={0.85}>
            <Text style={[s.label, { color: c.mutedForeground }]}>SPELL LEVEL</Text>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={s.chipRow}>
              {[0,1,2,3,4,5,6,7,8,9].map(lv => (
                <TouchableOpacity key={lv} onPress={() => setLevel(lv)} activeOpacity={0.8}
                  style={[s.chip, { borderColor: level === lv ? "#A78BFA" : c.border, backgroundColor: level === lv ? "#A78BFA22" : c.card }]}>
                  <Text style={[s.chipText, { color: level === lv ? "#A78BFA" : c.mutedForeground }]}>
                    {SPELL_LEVEL_LABELS[lv]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* School */}
          <TouchableOpacity onLongPress={() => showFieldHelp("SCHOOL (OPTIONAL)")} delayLongPress={380} activeOpacity={0.85}>
            <Text style={[s.label, { color: c.mutedForeground }]}>SCHOOL (OPTIONAL)</Text>
          </TouchableOpacity>
          <View style={s.schoolGrid}>
            {SCHOOLS.map(sc => {
              const sel = school === sc;
              const col = SCHOOL_COLORS[sc];
              return (
                <TouchableOpacity key={sc} onPress={() => setSchool(sel ? undefined : sc)} activeOpacity={0.8}
                  style={[s.schoolChip, { borderColor: sel ? col : c.border, backgroundColor: sel ? col + "22" : c.card }]}>
                  <Text style={[s.schoolChipText, { color: sel ? col : c.mutedForeground }]}>{sc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Casting time */}
          <TouchableOpacity onLongPress={() => showFieldHelp("CASTING TIME")} delayLongPress={380} activeOpacity={0.85}>
            <Text style={[s.label, { color: c.mutedForeground }]}>CASTING TIME</Text>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={s.chipRow}>
              {CASTING_TIMES.map(ct => (
                <TouchableOpacity key={ct} onPress={() => setCastingTime(ct)} activeOpacity={0.8}
                  style={[s.chip, { borderColor: castingTime === ct ? c.primary : c.border, backgroundColor: castingTime === ct ? c.primary + "22" : c.card }]}>
                  <Text style={[s.chipText, { color: castingTime === ct ? c.primary : c.mutedForeground }]}>{ct}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Range / Duration */}
          <View style={s.rowHalf}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity onLongPress={() => showFieldHelp("RANGE")} delayLongPress={380} activeOpacity={0.85}>
                <Text style={[s.label, { color: c.mutedForeground }]}>RANGE</Text>
              </TouchableOpacity>
              <TextInput style={[s.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                placeholder="60 feet" placeholderTextColor={c.mutedForeground} value={range} onChangeText={setRange} />
            </View>
            <View style={{ flex: 1 }}>
              <TouchableOpacity onLongPress={() => showFieldHelp("DURATION")} delayLongPress={380} activeOpacity={0.85}>
                <Text style={[s.label, { color: c.mutedForeground }]}>DURATION</Text>
              </TouchableOpacity>
              <TextInput style={[s.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                placeholder="Instantaneous" placeholderTextColor={c.mutedForeground} value={duration} onChangeText={setDuration} />
            </View>
          </View>

          {/* Toggles */}
          <View style={[s.toggleRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={s.toggleItem}>
              <View style={s.toggleLeft}>
                <Feather name="rotate-cw" size={14} color={concentration ? "#06B6D4" : c.mutedForeground} />
                <Text style={[s.toggleLabel, { color: c.foreground }]}>Concentration</Text>
              </View>
              <Switch value={concentration} onValueChange={setConcentration}
                trackColor={{ false: c.muted, true: "#06B6D4" }} thumbColor="#fff" />
            </View>
            <View style={[s.toggleDivider, { backgroundColor: c.border }]} />
            <View style={s.toggleItem}>
              <View style={s.toggleLeft}>
                <Feather name="clock" size={14} color={ritual ? "#8B5CF6" : c.mutedForeground} />
                <Text style={[s.toggleLabel, { color: c.foreground }]}>Ritual</Text>
              </View>
              <Switch value={ritual} onValueChange={setRitual}
                trackColor={{ false: c.muted, true: "#8B5CF6" }} thumbColor="#fff" />
            </View>
            <View style={[s.toggleDivider, { backgroundColor: c.border }]} />
            <View style={s.toggleItem}>
              <View style={s.toggleLeft}>
                <Feather name="check-circle" size={14} color={prepared ? "#10B981" : c.mutedForeground} />
                <Text style={[s.toggleLabel, { color: c.foreground }]}>Prepared</Text>
              </View>
              <Switch value={prepared} onValueChange={setPrepared}
                trackColor={{ false: c.muted, true: "#10B981" }} thumbColor="#fff" />
            </View>
          </View>

          {showSaveAsCustomButton && (
            <TouchableOpacity
              onPress={handleSaveAsCustomSpell}
              activeOpacity={0.85}
              style={[s.saveCustomBtn, { backgroundColor: "#EF444422", borderColor: "#EF4444" }]}
            >
              <Feather name="save" size={14} color="#EF4444" />
              <Text style={s.saveCustomBtnText}>Save As Custom Spell</Text>
            </TouchableOpacity>
          )}
          {officialExactMatch && (
            <Text style={[s.customHint, { color: c.mutedForeground }]}>Custom entries override official entries with the same name and level.</Text>
          )}

          {/* Description */}
          <TouchableOpacity onLongPress={() => showFieldHelp("DESCRIPTION")} delayLongPress={380} activeOpacity={0.85}>
            <Text style={[s.label, { color: c.mutedForeground }]}>DESCRIPTION</Text>
          </TouchableOpacity>
          <TextInput
            style={[s.input, s.inputMulti, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="Spell effect, damage, saving throw..." placeholderTextColor={c.mutedForeground}
            value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top"
          />
        </ScrollView>
        </Animated.View>
        {helpPopup}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Cast slot picker modal ─────────────────────────────────────────────────────

interface CastModalProps {
  visible: boolean;
  spell: PreparedSpell | null;
  spellSlots: { level: number; total: number; used: number }[];
  requiresAttackRoll?: boolean;
  suggestedAttackBonus?: number;
  requiresSaveRolls?: boolean;
  saveAbility?: string;
  saveDc?: number;
  saveTargets?: Array<{ id: string; name: string }>;
  onCast: (
    atSlotLevel: number,
    attackRoll?: { total: number; isCritical?: boolean },
    saveRolls?: Record<string, number>,
  ) => void;
  onClose: () => void;
}

function CastModal({
  visible,
  spell,
  spellSlots,
  requiresAttackRoll = false,
  suggestedAttackBonus,
  requiresSaveRolls = false,
  saveAbility,
  saveDc,
  saveTargets = [],
  onCast,
  onClose,
}: CastModalProps) {
  const c = useColors();
  const [attackRollInput, setAttackRollInput] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [saveRollInputs, setSaveRollInputs] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!visible) return;
    setAttackRollInput("");
    setIsCritical(false);
    setSaveRollInputs({});
  }, [visible, spell?.id]);

  if (!spell) return null;

  function parseAttackRoll(): { total: number; isCritical?: boolean } | undefined {
    const value = attackRollInput.trim();
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      Alert.alert("Invalid Attack Roll", "Enter a positive attack roll total or leave it blank.");
      return null as never;
    }
    return { total: parsed, isCritical };
  }

  function parseSaveRolls(): Record<string, number> | undefined {
    if (!requiresSaveRolls || saveTargets.length === 0) return undefined;
    const parsed: Record<string, number> = {};
    for (const target of saveTargets) {
      const value = (saveRollInputs[target.id] ?? "").trim();
      if (!value) continue;
      const roll = Number.parseInt(value, 10);
      if (!Number.isFinite(roll) || roll < 1) {
        Alert.alert("Invalid Save Roll", `Enter a positive save roll total for ${target.name}, or leave it blank.`);
        return null as never;
      }
      parsed[target.id] = roll;
    }
    return Object.keys(parsed).length > 0 ? parsed : undefined;
  }

  function emitCast(atSlotLevel: number) {
    const parsedRoll = parseAttackRoll();
    if (parsedRoll === null) return;
    const parsedSaveRolls = parseSaveRolls();
    if (parsedSaveRolls === null) return;
    onCast(atSlotLevel, parsedRoll, parsedSaveRolls);
  }

  // Treat level 0, undefined, or any non-positive value as a cantrip
  const isCantrip = !spell.level || Number(spell.level) < 1;
  const availableSlots = isCantrip
    ? []
    : spellSlots.filter(s => s.level >= spell.level && s.total - s.used > 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.castOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.castSheet, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <View style={[s.castHandle, { backgroundColor: c.border }]} />

          <Text style={[s.castTitle, { color: c.foreground }]}>{spell.name}</Text>
          <Text style={[s.castSub, { color: c.mutedForeground }]}>
            {isCantrip ? "Cantrip — no slot needed" : `Choose a slot level to cast at`}
          </Text>

          {requiresAttackRoll ? (
            <View style={[s.castAttackInputCard, { backgroundColor: c.background, borderColor: c.border }]}> 
              <Text style={[s.castAttackInputTitle, { color: c.foreground }]}>Spell Attack Roll (optional)</Text>
              <Text style={[s.castAttackInputHint, { color: c.mutedForeground }]}>
                Enter your final d20 total for this cast
                {typeof suggestedAttackBonus === "number" ? ` (suggested bonus +${suggestedAttackBonus})` : ""}.
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                placeholder="e.g. 19"
                placeholderTextColor={c.mutedForeground}
                keyboardType="number-pad"
                value={attackRollInput}
                onChangeText={setAttackRollInput}
              />
              <View style={s.castAttackCritRow}>
                <Text style={[s.castAttackCritLabel, { color: c.foreground }]}>Critical hit</Text>
                <Switch
                  value={isCritical}
                  onValueChange={setIsCritical}
                  trackColor={{ false: c.muted, true: "#EF4444" }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          ) : null}

          {requiresSaveRolls && saveTargets.length > 0 ? (
            <View style={[s.castSaveInputCard, { backgroundColor: c.background, borderColor: c.border }]}> 
              <Text style={[s.castAttackInputTitle, { color: c.foreground }]}>Target Save Rolls (optional)</Text>
              <Text style={[s.castAttackInputHint, { color: c.mutedForeground }]}>Enter final totals for each selected target.</Text>
              <Text style={[s.castSaveMeta, { color: c.mutedForeground }]}>Save: {(saveAbility ?? "?").toUpperCase()}{typeof saveDc === "number" ? ` DC ${saveDc}` : ""}</Text>
              {saveTargets.map((target) => (
                <View key={target.id} style={s.castSaveRow}>
                  <Text style={[s.castSaveTargetName, { color: c.foreground }]} numberOfLines={1}>{target.name}</Text>
                  <TextInput
                    style={[s.castSaveInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                    placeholder="e.g. 14"
                    placeholderTextColor={c.mutedForeground}
                    keyboardType="number-pad"
                    value={saveRollInputs[target.id] ?? ""}
                    onChangeText={(value) => {
                      setSaveRollInputs((prev) => ({ ...prev, [target.id]: value }));
                    }}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {isCantrip ? (
            <TouchableOpacity onPress={() => emitCast(0)} activeOpacity={0.8}
              style={[s.castSlotBtn, { backgroundColor: "#A78BFA22", borderColor: "#A78BFA" }]}>
              <Feather name="zap" size={16} color="#A78BFA" />
              <Text style={[s.castSlotLabel, { color: "#A78BFA" }]}>Cast Cantrip (free — no slot used)</Text>
            </TouchableOpacity>
          ) : availableSlots.length === 0 ? (
            <View style={[s.castNoSlots, { backgroundColor: c.muted + "40", borderColor: c.border }]}>
              <Feather name="alert-circle" size={20} color={c.mutedForeground} />
              <Text style={[s.castNoSlotsText, { color: c.mutedForeground }]}>
                No available slots of {SPELL_LEVEL_LABELS[spell.level]} level or higher
              </Text>
            </View>
          ) : (
            availableSlots.map(slot => {
              const remaining = slot.total - slot.used;
              const isMinimum = slot.level === spell.level;
              return (
                <TouchableOpacity key={slot.level} onPress={() => emitCast(slot.level)} activeOpacity={0.8}
                  style={[s.castSlotBtn, {
                    backgroundColor: isMinimum ? "#A78BFA22" : c.background,
                    borderColor: isMinimum ? "#A78BFA" : c.border,
                  }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.castSlotLabel, { color: isMinimum ? "#A78BFA" : c.foreground }]}>
                      {SPELL_LEVEL_LABELS[slot.level]} Level Slot
                      {slot.level > spell.level ? " (upcasted)" : ""}
                    </Text>
                    <Text style={[s.castSlotRemaining, { color: c.mutedForeground }]}>
                      {remaining} of {slot.total} remaining
                    </Text>
                  </View>
                  <View style={s.castSlotPips}>
                    {Array.from({ length: Math.min(slot.total, 5) }).map((_, i) => (
                      <View key={i} style={[s.castPip, {
                        backgroundColor: i < remaining ? "#A78BFA" : c.muted,
                        borderColor: i < remaining ? "#A78BFA" : c.border,
                      }]} />
                    ))}
                    {slot.total > 5 && <Text style={[s.castPipExtra, { color: c.mutedForeground }]}>+{slot.total - 5}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity onPress={onClose} style={[s.castCancelBtn, { borderColor: c.border }]} activeOpacity={0.8}>
            <Text style={[s.castCancelText, { color: c.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main SpellsSection ────────────────────────────────────────────────────────

export function SpellsSection() {
  const c = useColors();
  const { settings } = useAppSettings();
  const {
    character,
    preparedSpells, addSpell, updateSpell, removeSpell, toggleSpellPrepared,
    spellSlots, expendSpellSlot,
  } = useCharacter();

  const [filter, setFilter] = useState<FilterLevel>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<PreparedSpell | null>(null);
  const [castTarget, setCastTarget] = useState<PreparedSpell | null>(null);
  const [justCastId, setJustCastId] = useState<string | null>(null);
  const [customCatalog, setCustomCatalog] = useState<CatalogSpell[]>([]);

  React.useEffect(() => {
    let mounted = true;
    async function loadCustomCatalog() {
      try {
        const raw = await AsyncStorage.getItem(CUSTOM_SPELLS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as CatalogSpell[]) : [];
        if (mounted) {
          setCustomCatalog(Array.isArray(parsed) ? parsed.filter((s) => s?.name).map((s) => ({ ...s, source: "custom" })) : []);
        }
      } catch {
        if (mounted) setCustomCatalog([]);
      }
    }
    loadCustomCatalog();
    return () => {
      mounted = false;
    };
  }, [modalVisible]);

  const officialCatalogMap = useMemo(() => {
    const m = new Map<string, CatalogSpell>();
    SPELL_LIST.forEach((entry) => {
      m.set(normalizeSpellKey(entry.name, entry.level), {
        name: entry.name,
        level: entry.level,
        school: isSpellSchool(entry.school) ? entry.school : undefined,
        desc: entry.desc,
        source: "official",
      });
    });
    return m;
  }, []);

  const customCatalogSet = useMemo(() => {
    const s = new Set<string>();
    customCatalog.forEach((entry) => s.add(normalizeSpellKey(entry.name, entry.level)));
    return s;
  }, [customCatalog]);

  function getSpellSourceTag(sp: PreparedSpell): "official" | "custom" {
    const key = normalizeSpellKey(sp.name, sp.level);
    if (customCatalogSet.has(key)) return "custom";
    const official = officialCatalogMap.get(key);
    if (!official) return "custom";

    const schoolMatches = (official.school ?? "") === (sp.school ?? "");
    const descMatches = (official.desc ?? "").trim() === (sp.description ?? "").trim();
    const hasCustomOverrides = Boolean(
      (sp.castingTime ?? "1 action") !== "1 action" ||
      (sp.range ?? "").trim() ||
      (sp.duration ?? "").trim() ||
      sp.concentration ||
      sp.ritual
    );

    return schoolMatches && descMatches && !hasCustomOverrides ? "official" : "custom";
  }

  function renderSourceTag(sourceTag: "official" | "custom") {
    if (settings.spellSourceTagStyle === "hidden") return null;
    if (settings.spellSourceTagStyle === "dot") {
      return <View style={sourceTag === "custom" ? s.customDot : s.officialDot} />;
    }
    const label = settings.spellSourceTagStyle === "compact"
      ? (sourceTag === "custom" ? "C" : "O")
      : (sourceTag === "custom" ? "CUSTOM" : "OFFICIAL");
    return (
      <View style={sourceTag === "custom" ? s.customBadge : s.officialBadge}>
        <Text style={sourceTag === "custom" ? s.customBadgeText : s.officialBadgeText}>{label}</Text>
      </View>
    );
  }

  // Sort: cantrips first, then by spell level, then alphabetically
  const sortedSpells = useMemo(() => {
    const list = filter === "all" ? preparedSpells
      : filter === "cantrip" ? preparedSpells.filter(sp => sp.level === 0)
      : preparedSpells.filter(sp => sp.level === filter);
    return [...list].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [preparedSpells, filter]);

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: preparedSpells.length, cantrip: 0 };
    preparedSpells.forEach(sp => {
      if (sp.level === 0) counts.cantrip = (counts.cantrip ?? 0) + 1;
      else counts[String(sp.level)] = (counts[String(sp.level)] ?? 0) + 1;
    });
    return counts;
  }, [preparedSpells]);

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openNew() { setEditing(null); setModalVisible(true); }
  function openEdit(sp: PreparedSpell) { setEditing(sp); setModalVisible(true); }

  function handleSave(data: Omit<PreparedSpell, "id" | "createdAt">) {
    if (editing) updateSpell(editing.id, data);
    else addSpell(data);
    setModalVisible(false);
  }

  function handleDelete(sp: PreparedSpell) {
    Alert.alert("Remove Spell", `Remove "${sp.name}" from your spell list?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeSpell(sp.id) },
    ]);
  }


  // Helper: parse duration string to rounds (default 10 if not found)
  function parseDurationToRounds(duration?: string): number {
    if (!duration) return 10;
    const lower = duration.toLowerCase();
    if (lower.includes("hour")) return 600;
    if (lower.includes("minute")) {
      const m = lower.match(/(\d+)/);
      return m ? parseInt(m[1], 10) * 10 : 10;
    }
    if (lower.includes("round")) {
      const m = lower.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 1;
    }
    return 10;
  }

  const combat = useCombat();

  function actionKindForSpellCastingTime(castingTime?: string): "action" | "bonus_action" | "reaction" {
    const value = (castingTime ?? "").toLowerCase();
    if (value.includes("bonus")) return "bonus_action";
    if (value.includes("reaction")) return "reaction";
    return "action";
  }

  async function handleCast(sp: PreparedSpell) {
    setCastTarget(sp);
  }

  async function resolveSpellCast(
    sp: PreparedSpell,
    castAtLevel: number,
    attackRoll?: { total: number; isCritical?: boolean },
    saveRolls?: Record<string, number>,
  ) {
    const isCantrip = castAtLevel < 1;
    const actionKind = actionKindForSpellCastingTime(sp.castingTime);
    const reactionWindow = actionKind === "reaction" ? combat.pendingReactionWindow : null;
    const selectedTargetIds = [...combat.selectedTargetIds];
    const officialSpellData = officialCatalogMap.get(normalizeSpellKey(sp.name, sp.level));
    const spellResolution = buildSpellDeclaredPayload({
      spell: sp,
      characterClass: character.class,
      proficiencyBonus: character.proficiencyBonus,
      abilityScores: character.abilityScores,
      officialDescription: officialSpellData?.desc,
      castAtLevel,
      attackRollTotal: attackRoll?.total,
      attackRollIsCritical: attackRoll?.isCritical,
    });
    const declared = spellResolution.declared.save && saveRolls && Object.keys(saveRolls).length > 0
      ? {
          ...spellResolution.declared,
          save: {
            ...spellResolution.declared.save,
            targetRolls: saveRolls,
          },
        }
      : spellResolution.declared;
    const reactionDeclaration = actionKind === "reaction"
      ? buildDeclaredReaction({
          triggerType: reactionWindow?.triggerType,
          sourceType: "prepared_spell",
          sourceName: sp.name,
          spellLevel: castAtLevel,
        })
      : undefined;
    const command = buildCombatActionCommand({
      sourceType: "prepared_spell",
      sourceId: sp.id,
      sourceName: sp.name,
      actionKind,
      targetIds: selectedTargetIds,
      declared,
      reaction: reactionWindow
        ? {
            windowId: reactionWindow.windowId,
            triggerType: reactionWindow.triggerType,
            sourceCommandId: reactionWindow.sourceCommandId,
            decision: "accept",
            declared: reactionDeclaration?.declared,
          }
        : undefined,
      metadata: {
        eventType: "player_spell_cast",
        eventMessage: formatSpellCastEventMessage(sp.name, castAtLevel),
        eventMetadata: {
          spellName: sp.name,
          spellLevel: castAtLevel,
          selectedTargetIds,
          ...(reactionDeclaration?.declared
            ? {
                reactionDeclaredName: reactionDeclaration.declared.reactionName,
                reactionDeclaredKind: reactionDeclaration.declared.reactionKind,
                reactionTriggerType: reactionDeclaration.inferredTriggerType,
              }
            : {}),
          ...(reactionDeclaration?.limitation
            ? { reactionDeclarationLimitation: reactionDeclaration.limitation }
            : {}),
          ...(spellResolution.declared.save
            ? {
                declaredSaveAbility: spellResolution.declared.save.saveAbility,
                declaredSaveDc: spellResolution.declared.save.dc,
                declaredOnSave: spellResolution.declared.save.onSave,
                ...(saveRolls && Object.keys(saveRolls).length > 0
                  ? {
                      declaredTargetSaveRollCount: Object.keys(saveRolls).length,
                    }
                  : {}),
              }
            : {}),
          ...(spellResolution.declared.damagePackets?.length
            ? {
                declaredDamagePacketCount: spellResolution.declared.damagePackets.length,
              }
            : {}),
          ...(spellResolution.declared.spell
            ? {
                declaredSpellMode: spellResolution.declared.spell.mode,
                declaredTargetScopeHint: spellResolution.declared.spell.targetScopeHint,
                declaredDamageModel: spellResolution.declared.spell.damageModel,
                declaredParsingConfidence: spellResolution.declared.spell.parsingConfidence,
                declaredScalingSupported: spellResolution.declared.spell.scaling?.supported === true,
                declaredScalingSource: spellResolution.declared.spell.scaling?.source,
                declaredScalingLevelsAboveBase: spellResolution.declared.spell.scaling?.levelsAboveBase,
                declaredConcentrationRequired: spellResolution.declared.spell.concentration?.required === true,
                declaredConcentrationDuration: spellResolution.declared.spell.concentration?.durationText,
              }
            : {}),
          ...(spellResolution.spellAttack.detected
            ? {
                spellAttackDetected: true,
                ...(typeof spellResolution.spellAttack.attackBonus === "number"
                  ? { spellAttackBonus: spellResolution.spellAttack.attackBonus }
                  : {}),
                ...(typeof spellResolution.spellAttack.declaredAttackRoll === "number"
                  ? {
                      declaredAttackRoll: spellResolution.spellAttack.declaredAttackRoll,
                      declaredAttackRollCritical: spellResolution.spellAttack.declaredCritical === true,
                    }
                  : {}),
              }
            : {}),
          ...(spellResolution.resolutionLimitations.length > 0
            ? {
                resolutionLimitations: spellResolution.resolutionLimitations,
              }
            : {}),
          ...(reactionWindow
            ? {
                reactionWindowId: reactionWindow.windowId,
                reactionTriggerType: reactionWindow.triggerType,
              }
            : {}),
        },
        requiresResolution: spellResolution.requiresResolution,
        ...(spellResolution.resolutionLimitations.length > 0
          ? {
              resolutionLimitations: spellResolution.resolutionLimitations,
            }
          : {}),
      },
    });
    const result = await combat.resolveCombatAction(command);
    if (result.status !== "accepted") {
      Alert.alert("Cast Rejected", getCombatRejectMessage(result.reasonCode));
      return;
    }
    const summaryText = formatOutcomeSummary(result);
    const targetNameById = Object.fromEntries(
      combat.partyTargets.map((target) => [target.id, target.name])
    ) as Record<string, string>;
    const declaredSummary = formatDeclaredSpellSummary({
      declared,
      resolutionLimitations: spellResolution.resolutionLimitations,
      targetNameById,
      targetOrderIds: selectedTargetIds,
      spellAttack: spellResolution.spellAttack,
    });
    const castDetails = [summaryText, declaredSummary].filter(Boolean).join("\n\n");
    if (castDetails) {
      Alert.alert("Cast Outcome", castDetails);
    }

    if (castAtLevel > 0) {
      expendSpellSlot(castAtLevel);
    }

    if (isCantrip) {
      setJustCastId(sp.id);
      setTimeout(() => setJustCastId(id => id === sp.id ? null : id), 1500);
    }

    // If concentration, add to combat context
    if (sp.concentration) {
      combat.addConcentrationSpell({
        id: sp.id,
        name: sp.name,
        rounds: parseDurationToRounds(sp.duration),
        casterId: character.id,
      });
    }
  }

  function handleConfirmCast(
    atLevel: number,
    attackRoll?: { total: number; isCritical?: boolean },
    saveRolls?: Record<string, number>,
  ) {
    const selected = castTarget;
    setCastTarget(null);
    if (!selected) return;
    void resolveSpellCast(selected, atLevel, attackRoll, saveRolls);
  }

  const castTargetAttackHint = useMemo(() => {
    if (!castTarget) return { requiresAttackRoll: false as const, suggestedAttackBonus: undefined as number | undefined };
    const officialSpellData = officialCatalogMap.get(normalizeSpellKey(castTarget.name, castTarget.level));
    const preview = buildSpellDeclaredPayload({
      spell: castTarget,
      characterClass: character.class,
      proficiencyBonus: character.proficiencyBonus,
      abilityScores: character.abilityScores,
      officialDescription: officialSpellData?.desc,
      castAtLevel: !castTarget.level || Number(castTarget.level) < 1 ? 0 : castTarget.level,
    });
    return {
      requiresAttackRoll: preview.spellAttack.detected,
      suggestedAttackBonus: preview.spellAttack.attackBonus,
    };
  }, [castTarget, officialCatalogMap, character.class, character.proficiencyBonus, character.abilityScores]);

  const castTargetSaveHint = useMemo(() => {
    if (!castTarget) {
      return {
        requiresSaveRolls: false as const,
        saveAbility: undefined as string | undefined,
        saveDc: undefined as number | undefined,
        saveTargets: [] as Array<{ id: string; name: string }>,
      };
    }
    const officialSpellData = officialCatalogMap.get(normalizeSpellKey(castTarget.name, castTarget.level));
    const preview = buildSpellDeclaredPayload({
      spell: castTarget,
      characterClass: character.class,
      proficiencyBonus: character.proficiencyBonus,
      abilityScores: character.abilityScores,
      officialDescription: officialSpellData?.desc,
      castAtLevel: !castTarget.level || Number(castTarget.level) < 1 ? 0 : castTarget.level,
    });
    const selectedTargetIds = new Set(combat.selectedTargetIds);
    const saveTargets = combat.partyTargets
      .filter((target) => selectedTargetIds.has(target.id))
      .map((target) => ({ id: target.id, name: target.name }));
    return {
      requiresSaveRolls: Boolean(preview.declared.save),
      saveAbility: preview.declared.save?.saveAbility,
      saveDc: preview.declared.save?.dc,
      saveTargets,
    };
  }, [castTarget, officialCatalogMap, character.class, character.proficiencyBonus, character.abilityScores, combat.selectedTargetIds, combat.partyTargets]);

  // Build filter tabs dynamically based on what spell levels exist
  const filterOptions: { key: FilterLevel; label: string }[] = [
    { key: "all", label: `All (${levelCounts.all})` },
    ...(levelCounts.cantrip > 0 ? [{ key: "cantrip" as FilterLevel, label: `Cantrips (${levelCounts.cantrip})` }] : []),
    ...[1,2,3,4,5,6,7,8,9]
      .filter(lv => (levelCounts[String(lv)] ?? 0) > 0)
      .map(lv => ({ key: lv as FilterLevel, label: `${SPELL_LEVEL_LABELS[lv]} (${levelCounts[String(lv)]})` })),
  ];

  return (
    <View style={{ marginTop: 16 }}>
      {/* Section header */}
      <View style={[s.sectionHeader, { borderBottomColor: c.border }]}> 
        <Feather name="star" size={13} color="#A78BFA" />
        <Text style={[s.sectionTitle, { color: c.mutedForeground }]}>Prepared Spells</Text>
        <View style={{ flex: 1 }} />
        {preparedSpells.length > 0 && (
          <TouchableOpacity onPress={openNew} activeOpacity={0.8}
            style={[s.addBtn, { backgroundColor: "#A78BFA22", borderColor: "#A78BFA66" }]}> 
            <Feather name="plus" size={13} color="#A78BFA" />
            <Text style={[s.addBtnText, { color: "#A78BFA" }]}>Add Spell</Text>
          </TouchableOpacity>
        )}
      </View>

      {preparedSpells.length === 0 ? (
        <View style={[s.empty, { backgroundColor: c.card, borderColor: c.border }]}>
          <Feather name="book-open" size={28} color={c.mutedForeground + "66"} />
          <Text style={[s.emptyText, { color: c.mutedForeground }]}>No spells added yet</Text>
          <TouchableOpacity onPress={openNew} activeOpacity={0.8}
            style={[s.emptyBtn, { backgroundColor: "#A78BFA22", borderColor: "#A78BFA66" }]}>
            <Feather name="plus" size={13} color="#A78BFA" />
            <Text style={[s.emptyBtnText, { color: "#A78BFA" }]}>Add your first spell</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Filter tabs */}
          {filterOptions.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}
              contentContainerStyle={s.filterRow}>
              {filterOptions.map(opt => {
                const active = filter === opt.key;
                return (
                  <TouchableOpacity key={String(opt.key)} onPress={() => setFilter(opt.key)} activeOpacity={0.8}
                    style={[s.filterChip, { backgroundColor: active ? "#A78BFA22" : c.card, borderColor: active ? "#A78BFA" : c.border }]}>
                    <Text style={[s.filterChipText, { color: active ? "#A78BFA" : c.mutedForeground }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Spell cards */}
          {sortedSpells.map(sp => {
            const isExpanded = expanded.has(sp.id);
            const schoolColor = sp.school ? SCHOOL_COLORS[sp.school] : "#A78BFA";
            const isCantrip = !sp.level || Number(sp.level) < 1;
            const isPrepared = sp.prepared;
            const sourceTag = getSpellSourceTag(sp);
            const castingTimeIcon = sp.castingTime?.includes("bonus") ? "zap"
              : sp.castingTime?.includes("reaction") ? "shield"
              : sp.castingTime?.includes("minute") || sp.castingTime?.includes("hour") ? "clock"
              : "play-circle";

            return (
              <TouchableOpacity key={sp.id} activeOpacity={0.85}
                onPress={() => toggleExpanded(sp.id)}
                onLongPress={() => Alert.alert(
                  sp.name,
                  [
                    sp.description ? sp.description : null,
                    sp.description ? "\n—" : null,
                    "What would you like to do?",
                  ].filter(Boolean).join("\n"),
                  [
                    { text: "Cast", onPress: () => { void handleCast(sp); } },
                    { text: "Edit", onPress: () => openEdit(sp) },
                    { text: sp.prepared ? "Mark Unprepared" : "Mark Prepared", onPress: () => toggleSpellPrepared(sp.id) },
                    { text: "Remove", style: "destructive", onPress: () => handleDelete(sp) },
                    { text: "Cancel", style: "cancel" },
                  ]
                )}
                style={[s.spellCard, {
                  backgroundColor: c.card, borderColor: c.border,
                  borderLeftColor: isPrepared ? schoolColor : c.border,
                  opacity: isPrepared ? 1 : 0.6,
                }]}>

                {/* Top row */}
                <View style={s.spellCardTop}>
                  <View style={s.spellCardLeft}>
                    {/* Level badge */}
                    <View style={[s.levelBadge, { backgroundColor: "#A78BFA22", borderColor: "#A78BFA66" }]}>
                      <Text style={[s.levelBadgeText, { color: "#A78BFA" }]}>
                        {isCantrip ? "Cantrip" : SPELL_LEVEL_LABELS[sp.level]}
                      </Text>
                    </View>

                    <Text style={[s.spellName, { color: c.foreground }]}>{sp.name}</Text>
                    {renderSourceTag(sourceTag)}
                  </View>

                  {/* Right indicators */}
                  <View style={s.spellCardRight}>
                    {sp.concentration && (
                      <View style={[s.indicator, { backgroundColor: "#06B6D422" }]}>
                        <Text style={[s.indicatorText, { color: "#06B6D4" }]}>C</Text>
                      </View>
                    )}
                    {sp.ritual && (
                      <View style={[s.indicator, { backgroundColor: "#8B5CF622" }]}>
                        <Text style={[s.indicatorText, { color: "#8B5CF6" }]}>R</Text>
                      </View>
                    )}
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
                  </View>
                </View>

                {/* Metadata row (always visible) */}
                <View style={s.metaRow}>
                  {sp.school && (
                    <View style={[s.schoolTag, { backgroundColor: schoolColor + "18", borderColor: schoolColor + "44" }]}>
                      <Text style={[s.schoolTagText, { color: schoolColor }]}>{sp.school}</Text>
                    </View>
                  )}
                  {sp.castingTime && (
                    <View style={s.metaChip}>
                      <Feather name={castingTimeIcon as any} size={10} color={c.mutedForeground} />
                      <Text style={[s.metaChipText, { color: c.mutedForeground }]}>{sp.castingTime}</Text>
                    </View>
                  )}
                  {sp.range && (
                    <View style={s.metaChip}>
                      <Feather name="target" size={10} color={c.mutedForeground} />
                      <Text style={[s.metaChipText, { color: c.mutedForeground }]}>{sp.range}</Text>
                    </View>
                  )}
                </View>

                {/* Expanded section */}
                {isExpanded && (
                  <View style={[s.spellExpanded, { borderTopColor: c.border }]}>
                    {sp.duration && (
                      <View style={s.expandedRow}>
                        <Text style={[s.expandedKey, { color: c.mutedForeground }]}>Duration</Text>
                        <Text style={[s.expandedVal, { color: c.foreground }]}>{sp.duration}</Text>
                      </View>
                    )}
                    {sp.description && (
                      <Text style={[s.spellDesc, { color: c.mutedForeground }]}>{sp.description}</Text>
                    )}

                    {/* Action buttons */}
                    <View style={s.actionBtns}>
                      {(() => {
                        const didJustCast = justCastId === sp.id;
                        if (sp.concentration) {
                          return (
                            <TouchableOpacity onPress={() => { void handleCast(sp); }} activeOpacity={0.8}
                              style={[s.castBtn, {
                                backgroundColor: didJustCast ? "#10B98122" : "#06B6D422",
                                borderColor: didJustCast ? "#10B98166" : "#06B6D466",
                              }]}> 
                              <Feather name={didJustCast ? "check" : "rotate-cw"} size={13} color={didJustCast ? "#10B981" : "#06B6D4"} />
                              <Text style={[s.castBtnText, { color: didJustCast ? "#10B981" : "#06B6D4" }]}> 
                                {didJustCast ? "Cast!" : isCantrip ? "Cast (free)" : "Cast (Concentration)"}
                              </Text>
                            </TouchableOpacity>
                          );
                        }
                        return (
                          <TouchableOpacity onPress={() => { void handleCast(sp); }} activeOpacity={0.8}
                            style={[s.castBtn, {
                              backgroundColor: didJustCast ? "#10B98122" : "#A78BFA22",
                              borderColor: didJustCast ? "#10B98166" : "#A78BFA66",
                            }]}> 
                            <Feather name={didJustCast ? "check" : "zap"} size={13} color={didJustCast ? "#10B981" : "#A78BFA"} />
                            <Text style={[s.castBtnText, { color: didJustCast ? "#10B981" : "#A78BFA" }]}> 
                              {didJustCast ? "Cast!" : isCantrip ? "Cast (free)" : "Cast Spell"}
                            </Text>
                          </TouchableOpacity>
                        );
                      })()}

                      <TouchableOpacity onPress={() => toggleSpellPrepared(sp.id)} activeOpacity={0.8}
                        style={[s.prepBtn, {
                          backgroundColor: isPrepared ? "#10B98118" : c.card,
                          borderColor: isPrepared ? "#10B98144" : c.border,
                        }]}>
                        <Feather name={isPrepared ? "check-circle" : "circle"} size={13} color={isPrepared ? "#10B981" : c.mutedForeground} />
                        <Text style={[s.prepBtnText, { color: isPrepared ? "#10B981" : c.mutedForeground }]}>
                          {isPrepared ? "Prepared" : "Unprepared"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => openEdit(sp)} activeOpacity={0.8}
                        style={[s.editBtn, { borderColor: c.border }]}>
                        <Feather name="edit-2" size={13} color={c.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </>
      )}

      <SpellModal visible={modalVisible} spell={editing} onClose={() => setModalVisible(false)} onSave={handleSave} />
      <CastModal visible={castTarget !== null} spell={castTarget} spellSlots={spellSlots}
        requiresAttackRoll={castTargetAttackHint.requiresAttackRoll}
        suggestedAttackBonus={castTargetAttackHint.suggestedAttackBonus}
        requiresSaveRolls={castTargetSaveHint.requiresSaveRolls}
        saveAbility={castTargetSaveHint.saveAbility}
        saveDc={castTargetSaveHint.saveDc}
        saveTargets={castTargetSaveHint.saveTargets}
        onCast={handleConfirmCast} onClose={() => setCastTarget(null)} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 8, marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  addBtnText: { fontSize: 12, fontWeight: "600" },

  filterScroll: { marginBottom: 10 },
  filterRow: { gap: 8, paddingBottom: 2 },
  filterChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  filterChipText: { fontSize: 12, fontWeight: "600" },

  spellCard: { borderWidth: 1, borderLeftWidth: 3, borderRadius: 12, padding: 12, marginBottom: 8, gap: 6 },
  spellCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  spellCardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  spellCardRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  levelBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  levelBadgeText: { fontSize: 10, fontWeight: "700" },
  spellName: { fontSize: 15, fontWeight: "700", flex: 1 },
  indicator: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  indicatorText: { fontSize: 10, fontWeight: "800" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  schoolTag: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  schoolTagText: { fontSize: 10, fontWeight: "700" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaChipText: { fontSize: 11 },

  spellExpanded: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 6 },
  expandedRow: { flexDirection: "row", gap: 8 },
  expandedKey: { fontSize: 11, fontWeight: "700", minWidth: 60 },
  expandedVal: { fontSize: 12, flex: 1 },
  spellDesc: { fontSize: 13, lineHeight: 18 },
  actionBtns: { flexDirection: "row", gap: 8, marginTop: 4 },
  castBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  castBtnText: { fontSize: 12, fontWeight: "700" },
  prepBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  prepBtnText: { fontSize: 12, fontWeight: "600" },
  editBtn: { padding: 8, borderRadius: 8, borderWidth: 1 },

  empty: { borderWidth: 1, borderRadius: 12, padding: 24, alignItems: "center", gap: 8, borderStyle: "dashed" },
  emptyText: { fontSize: 14, fontWeight: "500" },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginTop: 4 },
  emptyBtnText: { fontSize: 13, fontWeight: "600" },

  // Modal
  mHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  mHeaderTitle: { fontSize: 16, fontWeight: "700" },
  mHeaderBtn: { minWidth: 60, alignItems: "center" },
  mHeaderBtnText: { fontSize: 15 },
  mBody: { padding: 16, paddingBottom: 60, gap: 4 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  inputMulti: { minHeight: 90, textAlignVertical: "top" },
  suggestionWrap: { borderWidth: 1, borderRadius: 10, maxHeight: 190, overflow: "hidden" },
  suggestionScroll: { maxHeight: 190 },
  filterTogglePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  filterToggleLeft: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  filterToggleText: { fontSize: 12, fontWeight: "700" },
  filterActiveBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  filterActiveBadgeText: { fontSize: 10, fontWeight: "700" },
  filterPanel: { marginBottom: 4 },
  searchSectionGap: { height: 10 },
  suggestionRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  suggestionName: { fontSize: 13, fontWeight: "700" },
  suggestionMeta: { fontSize: 11, marginTop: 2 },
  customBadge: { backgroundColor: "#EF444422", borderColor: "#EF4444", borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  customBadgeText: { color: "#EF4444", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  officialBadge: { backgroundColor: "#2563EB22", borderColor: "#2563EB", borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  officialBadgeText: { color: "#2563EB", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  officialDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2563EB" },
  customDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  suggestionEmpty: { fontSize: 12, fontStyle: "italic", paddingHorizontal: 12, paddingVertical: 12 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: "600" },
  schoolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  schoolChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  schoolChipText: { fontSize: 12, fontWeight: "600" },
  rowHalf: { flexDirection: "row", gap: 12 },
  toggleRow: { borderWidth: 1, borderRadius: 12, overflow: "hidden", marginTop: 8 },
  toggleItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { fontSize: 14 },
  toggleDivider: { height: 1 },
  customHint: { fontSize: 11, marginTop: 6, lineHeight: 16 },
  saveCustomBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  saveCustomBtnText: { color: "#EF4444", fontSize: 13, fontWeight: "700" },

  // Cast modal
  castOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  castSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, gap: 10, borderTopWidth: 1 },
  castHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 6 },
  castTitle: { fontSize: 18, fontWeight: "800" },
  castSub: { fontSize: 13, marginBottom: 4 },
  castAttackInputCard: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  castSaveInputCard: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  castAttackInputTitle: { fontSize: 13, fontWeight: "700" },
  castAttackInputHint: { fontSize: 12, lineHeight: 17 },
  castSaveMeta: { fontSize: 11 },
  castSaveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  castSaveTargetName: { flex: 1, fontSize: 12, fontWeight: "600" },
  castSaveInput: {
    width: 90,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 14,
  },
  castAttackCritRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  castAttackCritLabel: { fontSize: 12, fontWeight: "600" },
  castSlotBtn: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  castSlotLabel: { fontSize: 15, fontWeight: "700" },
  castSlotRemaining: { fontSize: 12, marginTop: 2 },
  castSlotPips: { flexDirection: "row", alignItems: "center", gap: 4 },
  castPip: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  castPipExtra: { fontSize: 11 },
  castNoSlots: { borderWidth: 1, borderRadius: 12, padding: 16, alignItems: "center", gap: 8 },
  castNoSlotsText: { fontSize: 13, textAlign: "center" },
  castCancelBtn: { borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4 },
  castCancelText: { fontSize: 15, fontWeight: "600" },
});
