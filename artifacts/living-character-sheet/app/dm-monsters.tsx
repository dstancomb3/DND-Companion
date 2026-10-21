import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { THEMES, useAppSettings } from "@/context/AppSettingsContext";
import { useParty } from "@/context/PartyContext";
import { CompendiumMonster, CustomMonster, Disposition } from "@/types/index";
import {
  getCompendiumWithMeta,
  saveCustomMonster,
  updateCustomMonster,
  deleteCustomMonster,
  isCustomMonster,
  type OfficialMonstersFetchMeta,
} from "@/utils/monsterApi";
import { addCombatNpc, fetchPartyCombatState, type CombatNpcCoreStats, type CombatNpcDummyState, type PartyCombatState } from "@/utils/partyApi";
import { setEncounterSetupHandoff, type EncounterSetupMonsterSelection } from "@/utils/encounterSetupIntent";

const DM_WATCH_KEY = "@dm_party_watch";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F1117" },
  headerBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, backgroundColor: "#1A1D2E" },
  headerTitle: { fontSize: 24, fontWeight: "700", flex: 1 },
  closeBtn: { padding: 8 },
  content: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", marginTop: 40 },
  emptyIcon: { marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  emptySubtext: { fontSize: 13 },
  searchContainer: { marginBottom: 16 },
  searchInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  filterToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  filterToggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  filterPanel: { borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 12, gap: 10 },
  filterLabel: { fontSize: 12, fontWeight: "600" },
  filterRangeRow: { flexDirection: "row", gap: 8 },
  filterInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  filterChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  tabBtnText: { fontSize: 13, fontWeight: "500" },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  createBtnText: { fontSize: 13, fontWeight: "600" },
  monsterCard: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  monsterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  monsterName: { fontSize: 16, fontWeight: "600", flex: 1 },
  customPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  monsterMeta: { fontSize: 12, marginBottom: 4 },
  monsterDescription: { fontSize: 12, lineHeight: 17, marginBottom: 2 },
  monsterActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  monsterBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  monsterBtnText: { fontSize: 11, fontWeight: "600" },
  encounterHint: { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  selectorWrap: { gap: 8, marginBottom: 16 },
  selectorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectorChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  // Modal styles
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", overflow: "hidden" },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 6 },
  formInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  formRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  formRowHalf: { flex: 1 },
  formActions: { flexDirection: "row", gap: 8, marginTop: 24 },
  arrayItemRow: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "flex-start" },
  arrayItemFields: { flex: 1, gap: 6 },
  deleteBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center", borderRadius: 10, borderWidth: 1 },
  addArrayBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
});

type TabType = "official" | "custom";
type CustomMonsterFormData = Omit<CustomMonster, "id" | "createdAt" | "updatedAt">;
const INITIAL_RENDER_COUNT = 12;
const RENDER_STEP = 20;
const UNASSIGNED_REALM_KEY = "__unassigned_realm__";
const KNOWN_PLANE_TOKENS = new Set([
  "astral plane",
  "ethereal plane",
  "feywild",
  "shadowfell",
  "elemental plane",
  "abyss",
  "nine hells",
  "baator",
  "hades",
  "limbo",
  "mechanus",
  "pandemonium",
  "arcadia",
  "mount celestia",
  "arborea",
  "beastlands",
  "carceri",
  "elysium",
  "bytopia",
]);

type FilterState = {
  crMin: number;
  crMax: number;
  hpMin: number;
  hpMax: number;
  types: Set<string>;
  sizes: Set<string>;
  realms: Set<string>;
};

function normalizeToken(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function parseChallengeRating(value?: string | number): number {
  const raw = String(value ?? "0").trim();
  if (!raw) return 0;
  if (raw.includes("/")) {
    const [n, d] = raw.split("/").map((part) => Number(part.trim()));
    if (Number.isFinite(n) && Number.isFinite(d) && d !== 0) return n / d;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMonsterRealmTokens(monster: CompendiumMonster): string[] {
  const raw = (monster as { environments?: unknown }).environments;
  if (!Array.isArray(raw)) return [];

  const realms = raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .map((entry) => normalizeToken(entry));

  return Array.from(new Set(realms));
}

function formatPlaneEnvironmentLabel(token: string): string {
  return token
    .split(/[_\-\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isPlaneToken(token: string): boolean {
  const normalized = normalizeToken(token);
  if (KNOWN_PLANE_TOKENS.has(normalized)) return true;
  return normalized.includes("plane") || normalized.includes("planar");
}

function getEncounterLabel(index: number): string {
  let value = index;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return `Encounter ${label || "A"}`;
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function parseNumberish(value: unknown, fallback: number): number {
  const raw = typeof value === "string" ? Number.parseInt(value, 10) : typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(raw)) return fallback;
  return Math.floor(raw);
}

function parseSpeedFromMonster(speed: unknown): number {
  if (typeof speed === "number" && Number.isFinite(speed)) return Math.max(0, Math.floor(speed));
  if (typeof speed === "string") {
    const match = speed.match(/(\d+)/);
    if (!match) return 30;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : 30;
  }
  if (speed && typeof speed === "object") {
    for (const value of Object.values(speed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
      if (typeof value === "string") {
        const match = value.match(/(\d+)/);
        if (match) {
          const parsed = Number.parseInt(match[1], 10);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    }
  }
  return 30;
}

function buildCoreStatsFromMonster(monster: CompendiumMonster): CombatNpcCoreStats {
  return {
    speed: parseSpeedFromMonster(monster.speed),
    initiativeBonus: abilityModifier(parseNumberish(monster.dexterity, 10)),
    strength: parseNumberish(monster.strength, 10),
    dexterity: parseNumberish(monster.dexterity, 10),
    constitution: parseNumberish(monster.constitution, 10),
    intelligence: parseNumberish(monster.intelligence, 10),
    wisdom: parseNumberish(monster.wisdom, 10),
    charisma: parseNumberish(monster.charisma, 10),
  };
}

function buildDummyStateFromMonster(monster: CompendiumMonster): CombatNpcDummyState {
  const maxHp = Math.max(1, parseNumberish(monster.hit_points, 20));
  return {
    maxHp,
    currentHp: maxHp,
    armorClass: Math.max(1, parseNumberish(monster.armor_class, 12)),
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
  };
}

function getMonsterDescription(monster: CompendiumMonster): string | null {
  const directDesc = (monster as { desc?: unknown }).desc;
  if (typeof directDesc === "string" && directDesc.trim()) return directDesc.trim();

  const specialDesc = monster.special_abilities?.[0]?.desc?.trim();
  if (specialDesc) return specialDesc;

  const actionDesc = monster.actions?.[0]?.desc?.trim();
  if (actionDesc) return actionDesc;

  if (isCustomMonster(monster) && monster.notes?.trim()) return monster.notes.trim();

  return null;
}

function emptyCustomMonster(): CustomMonsterFormData {
  return {
    name: "", size: "Medium", type: "Humanoid", alignment: "Neutral",
    armor_class: 10, hit_points: 10, hit_dice: "1d8", speed: "30 ft.",
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10, challenge_rating: "0",
    actions: [], special_abilities: [], notes: "", level: undefined, levelLabel: "", loot: [],
  };
}

function buildCustomMonsterForm(monster: CompendiumMonster): CustomMonsterFormData {
  return {
    name: monster.name,
    size: monster.size || "Medium",
    type: monster.type || "Humanoid",
    alignment: monster.alignment || "Neutral",
    armor_class: parseNumberish(monster.armor_class, 10),
    hit_points: parseNumberish(monster.hit_points, 10),
    hit_dice: monster.hit_dice || "1d8",
    speed: typeof monster.speed === "string" ? monster.speed : `${parseSpeedFromMonster(monster.speed)} ft.`,
    strength: parseNumberish(monster.strength, 10),
    dexterity: parseNumberish(monster.dexterity, 10),
    constitution: parseNumberish(monster.constitution, 10),
    intelligence: parseNumberish(monster.intelligence, 10),
    wisdom: parseNumberish(monster.wisdom, 10),
    charisma: parseNumberish(monster.charisma, 10),
    challenge_rating: String(monster.challenge_rating ?? "0"),
    actions: monster.actions?.map((action) => ({ ...action })) ?? [],
    special_abilities: monster.special_abilities?.map((ability) => ({ ...ability })) ?? [],
    notes: getMonsterDescription(monster) ?? undefined,
    level: isCustomMonster(monster) ? monster.level : undefined,
    levelLabel: isCustomMonster(monster) ? (monster.levelLabel ?? "") : "",
    loot: isCustomMonster(monster) ? (monster.loot?.map((l) => ({ ...l })) ?? []) : [],
  };
}

export default function DmMonstersScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings } = useAppSettings();
  const { partyCode: memberPartyCode, combatState: memberCombatState, isInParty, memberId, members } = useParty();
  const [dmWatchedCode, setDmWatchedCode] = useState<string | null>(null);
  const [dmCombatState, setDmCombatState] = useState<PartyCombatState | null>(null);

  // Load DM watch code from storage and poll combat state for it
  useEffect(() => {
    AsyncStorage.getItem(DM_WATCH_KEY).then((stored) => {
      if (stored) setDmWatchedCode(stored);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!dmWatchedCode) return;
    let cancelled = false;
    const fetch = async () => {
      try {
        const state = await fetchPartyCombatState(dmWatchedCode);
        if (!cancelled) setDmCombatState(state);
      } catch { /* ignore */ }
    };
    void fetch();
    const id = setInterval(() => { void fetch(); }, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, [dmWatchedCode]);

  // Prefer DM watch context over player party context
  const partyCode = dmWatchedCode ?? memberPartyCode;
  const combatState = dmWatchedCode ? dmCombatState : memberCombatState;
  const isDmMode = !!dmWatchedCode;
  const [tab, setTab] = useState<TabType>("official");
  const [searchText, setSearchText] = useState("");
  const deferredSearchText = useDeferredValue(searchText);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    crMin: 0,
    crMax: 30,
    hpMin: 0,
    hpMax: 999,
    types: new Set(),
    sizes: new Set(),
    realms: new Set(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [monsters, setMonsters] = useState<CompendiumMonster[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_COUNT);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingMonsterId, setEditingMonsterId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomMonsterFormData>(emptyCustomMonster());
  const [showBattleAddModal, setShowBattleAddModal] = useState(false);
  const [battleMonster, setBattleMonster] = useState<CompendiumMonster | null>(null);
  const [battleQuantity, setBattleQuantity] = useState(1);
  const [battleDisposition, setBattleDisposition] = useState<Disposition>("hostile");
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);
  const [addingToBattle, setAddingToBattle] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isRefreshingCompendium, setIsRefreshingCompendium] = useState(false);
  const [officialMeta, setOfficialMeta] = useState<OfficialMonstersFetchMeta | null>(null);

  const headerTheme = useMemo(() => {
    if (settings.disablePartyCardThemes || !memberId) return null;
    const currentMember = members.find((member) => member.id === memberId);
    const themeId = currentMember?.presentation?.themeId as keyof typeof THEMES | undefined;
    return themeId ? THEMES[themeId] : null;
  }, [memberId, members, settings.disablePartyCardThemes]);

  const headerCardColor = headerTheme?.palette.card || c.card;
  const headerBorderColor = headerTheme?.palette.border || c.border;
  const headerForegroundColor = headerTheme?.palette.foreground || c.foreground;
  const headerPrimaryColor = headerTheme?.palette.primary || c.primary;
  const headerMutedColor = headerTheme?.palette.mutedForeground || c.mutedForeground;

  const loadCompendium = useCallback(async (forceRefresh = false, silent = false) => {
    if (silent) {
      setIsRefreshingCompendium(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await getCompendiumWithMeta({ forceRefresh });
      setMonsters(result.monsters);
      setOfficialMeta(result.officialMeta);

      // Stale-cache-first path: render cached list now, then await in-flight refresh once.
      if (!forceRefresh && result.officialMeta.isStale && result.officialMeta.isRefreshingInBackground) {
        void loadCompendium(true, true);
      }
    } catch (error) {
      console.error("Failed to load compendium:", error);
      Alert.alert("Error", "Failed to load monsters.");
    } finally {
      if (silent) {
        setIsRefreshingCompendium(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadCompendium();
  }, [loadCompendium]);

  const tabMonsters = useMemo(() => {
    return monsters.filter((m) => {
      const isCustom = isCustomMonster(m);
      return tab === "official" ? !isCustom : isCustom;
    });
  }, [monsters, tab]);

  const allTypes = useMemo(() => {
    const typeMap = new Map<string, string>();
    tabMonsters.forEach((m) => {
      const key = normalizeToken(m.type);
      if (key && !typeMap.has(key)) typeMap.set(key, m.type.trim());
    });
    return Array.from(typeMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({ key, label }));
  }, [tabMonsters]);

  const allSizes = useMemo(() => {
    const sizeMap = new Map<string, string>();
    tabMonsters.forEach((m) => {
      const key = normalizeToken(m.size);
      if (key && !sizeMap.has(key)) sizeMap.set(key, m.size.trim());
    });
    return Array.from(sizeMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({ key, label }));
  }, [tabMonsters]);

  const allRealms = useMemo(() => {
    const planeMap = new Map<string, string>();
    const environmentMap = new Map<string, string>();
    let hasUnassigned = false;

    tabMonsters.forEach((monster) => {
      const realms = getMonsterRealmTokens(monster);
      if (realms.length === 0) {
        hasUnassigned = true;
        return;
      }
      realms.forEach((realm) => {
        if (isPlaneToken(realm)) {
          if (!planeMap.has(realm)) planeMap.set(realm, formatPlaneEnvironmentLabel(realm));
          return;
        }

        if (!environmentMap.has(realm)) {
          environmentMap.set(realm, formatPlaneEnvironmentLabel(realm));
        }
      });
    });

    const planeEntries = Array.from(planeMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({ key, label }));

    const environmentEntries = Array.from(environmentMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({ key, label }));

    const entries = [...planeEntries, ...environmentEntries];

    if (hasUnassigned) {
      entries.push({ key: UNASSIGNED_REALM_KEY, label: "Unassigned" });
    }

    return entries;
  }, [tabMonsters]);

  const displayMonsters = useMemo(() => {
    const searchLower = normalizeToken(deferredSearchText);
    return tabMonsters.filter((m) => {
      const textMatch =
        normalizeToken(m.name).includes(searchLower) ||
        normalizeToken(m.type).includes(searchLower);

      const cr = parseChallengeRating(m.challenge_rating);
      const hp = m.hit_points || 0;
      const crMatch = cr >= filters.crMin && cr <= filters.crMax;
      const hpMatch = hp >= filters.hpMin && hp <= filters.hpMax;

      const typeMatch = filters.types.size === 0 || filters.types.has(normalizeToken(m.type));
      const sizeMatch = filters.sizes.size === 0 || filters.sizes.has(normalizeToken(m.size));
      const monsterRealms = getMonsterRealmTokens(m);
      const realmMatch =
        filters.realms.size === 0 ||
        Array.from(filters.realms).some((realm) => (
          realm === UNASSIGNED_REALM_KEY
            ? monsterRealms.length === 0
            : monsterRealms.includes(realm)
        ));

      return textMatch && crMatch && hpMatch && typeMatch && sizeMatch && realmMatch;
    });
  }, [tabMonsters, deferredSearchText, filters]);

  const officialCacheStatusText = useMemo(() => {
    if (tab !== "official") return null;
    if (isRefreshingCompendium) return "Refreshing official monster cache...";
    if (!officialMeta) return null;
    if (officialMeta.isStale) return "Showing cached official monsters while refresh completes.";
    if (officialMeta.source === "network_fresh") return "Official monsters loaded from network.";
    if (officialMeta.source === "memory_fresh" || officialMeta.source === "persisted_fresh") {
      return "Official monsters loaded from cache.";
    }
    return null;
  }, [isRefreshingCompendium, officialMeta, tab]);

  const toggleFilter = (kind: "type" | "size" | "realm", value: string) => {
    setFilters((prev) => {
      const source = kind === "type" ? prev.types : kind === "size" ? prev.sizes : prev.realms;
      const next = source.has(value) ? new Set<string>() : new Set<string>([value]);
      return { ...prev, [kind === "type" ? "types" : kind === "size" ? "sizes" : "realms"]: next };
    });
  };

  const resetFilters = () => {
    setFilters({
      crMin: 0,
      crMax: 30,
      hpMin: 0,
      hpMax: 999,
      types: new Set(),
      sizes: new Set(),
      realms: new Set(),
    });
  };

  const visibleMonsters = useMemo(
    () => displayMonsters.slice(0, visibleCount),
    [displayMonsters, visibleCount],
  );

  const activeEncounterOptions = useMemo(() => {
    const battleIds = Array.from(
      new Set(
        Object.values(combatState?.participantBattleById ?? {}).filter(
          (battleId) => battleId && battleId !== "no-battle",
        ),
      ),
    ).sort();
    return battleIds.map((battleId, index) => ({
      id: battleId,
      label: getEncounterLabel(index + 1),
    }));
  }, [combatState?.participantBattleById]);

  const hasActiveEncounter = (isInParty || isDmMode) && activeEncounterOptions.length > 0;

  useEffect(() => {
    setVisibleCount(INITIAL_RENDER_COUNT);
    setExpandedKey(null);
  }, [tab, searchText]);

  useEffect(() => {
    setSelectedBattleId((prev) => {
      if (prev && activeEncounterOptions.some((option) => option.id === prev)) return prev;
      return activeEncounterOptions[0]?.id ?? null;
    });
  }, [activeEncounterOptions]);

  const handleCreateCustom = async () => {
    if (!formData.name.trim()) {
      Alert.alert("Validation", "Monster name is required.");
      return;
    }
    try {
      const newMonster = await saveCustomMonster(formData);
      setMonsters((prev) => [...prev, newMonster]);
      setTab("custom");
      setSearchText(newMonster.name);
      setFormData(emptyCustomMonster());
      setShowCustomForm(false);
      Alert.alert("Success", "Custom monster created!");
    } catch (error) {
      console.error("Failed to create custom monster:", error);
      Alert.alert("Error", "Failed to create monster.");
    }
  };

  const handleUpdateCustom = async () => {
    if (!editingMonsterId || !formData.name.trim()) {
      Alert.alert("Validation", "Monster name is required.");
      return;
    }
    try {
      const updated = await updateCustomMonster(editingMonsterId, formData);
      if (updated) {
        setMonsters((prev) =>
          prev.map((m) => (isCustomMonster(m) && m.id === editingMonsterId ? updated : m))
        );
        setTab("custom");
        setSearchText(updated.name);
        Alert.alert("Success", "Custom monster updated!");
      }
      setFormData(emptyCustomMonster());
      setEditingMonsterId(null);
      setShowCustomForm(false);
    } catch (error) {
      Alert.alert("Error", "Failed to update monster.");
    }
  };

  const handleDeleteCustom = (monsterId: string) => {
    Alert.alert("Delete Monster", "Are you sure? This cannot be undone.", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          try {
            const success = await deleteCustomMonster(monsterId);
            if (success) {
              setMonsters((prev) => prev.filter((m) => !isCustomMonster(m) || m.id !== monsterId));
              Alert.alert("Success", "Custom monster deleted.");
            }
          } catch (error) {
            Alert.alert("Error", "Failed to delete monster.");
          }
        },
      },
    ]);
  };

  const handleEditCustom = (monster: CustomMonster) => {
    setFormData(monster);
    setEditingMonsterId(monster.id);
    setShowCustomForm(true);
  };

  const handleOpenCustomForm = () => {
    setFormData(emptyCustomMonster());
    setEditingMonsterId(null);
    setShowCustomForm(true);
  };

  const handleCustomizeMonster = (monster: CompendiumMonster) => {
    setFormData(buildCustomMonsterForm(monster));
    setEditingMonsterId(null);
    setShowCustomForm(true);
  };

  const handleAddToBattle = (monster: CompendiumMonster) => {
    // Open modal to configure quantity/disposition, regardless of active encounter
    // Modal button handler will decide whether to add directly or handoff to DM Party
    setBattleMonster(monster);
    setBattleQuantity(1);
    setBattleDisposition("hostile");
    setShowBattleAddModal(true);
  };

  const handleSetupEncounterInParty = async () => {
    if (!battleMonster || !partyCode) return;

    // Create handoff with staged monster selection
    const stagedSelection: EncounterSetupMonsterSelection[] = [
      {
        monsterId: isCustomMonster(battleMonster) ? battleMonster.id : battleMonster.slug,
        quantity: battleQuantity,
        disposition: battleDisposition,
        customName: battleQuantity > 1 ? `${battleMonster.name} (${battleQuantity})` : undefined,
      },
    ];

    // Store handoff context and navigate to DM Party import area
    setEncounterSetupHandoff(stagedSelection, null);
    setShowBattleAddModal(false);

    // Navigate directly to dm-party
    await router.push("/dm-party");
  };

  const handleConfirmAddToBattle = async () => {
    if (!battleMonster || !partyCode || !selectedBattleId) return;
    setAddingToBattle(true);
    try {
      for (let index = 0; index < battleQuantity; index += 1) {
        const copyName = battleQuantity > 1 ? `${battleMonster.name} ${index + 1}` : battleMonster.name;
        await addCombatNpc(partyCode, {
          name: copyName,
          sourceType: "monster",
          sourceId: isCustomMonster(battleMonster) ? battleMonster.id : battleMonster.slug,
          disposition: battleDisposition,
          initiativeTotal: buildCoreStatsFromMonster(battleMonster).initiativeBonus,
          battleId: selectedBattleId,
          coreStats: buildCoreStatsFromMonster(battleMonster),
          dummyState: buildDummyStateFromMonster(battleMonster),
          visibleStatKeys: [],
        });
      }
      setShowBattleAddModal(false);
      Alert.alert("Monster Added", `${battleQuantity} ${battleMonster.name}${battleQuantity > 1 ? "s" : ""} added to battle.`);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to add monster to battle.");
    } finally {
      setAddingToBattle(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.headerBar, { backgroundColor: headerCardColor, borderBottomColor: headerBorderColor }]}> 
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/dm-party"))} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={22} color={headerPrimaryColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: headerForegroundColor }]}>Monster Compendium</Text>
      </View>

      <ScrollView style={[styles.content, { backgroundColor: c.background }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="Search monsters..."
            placeholderTextColor={headerMutedColor}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <View style={styles.filterToggleRow}>
          <TouchableOpacity
            style={[styles.filterToggleBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]}
            onPress={() => setShowFilters((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Feather name="sliders" size={14} color={c.primary} />
            <Text style={[styles.tabBtnText, { color: c.primary }]}>Filters</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={() => void loadCompendium(true, true)}
              disabled={isRefreshingCompendium}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {isRefreshingCompendium ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : (
                <Feather name="refresh-cw" size={14} color={c.primary} />
              )}
              <Text style={[styles.tabBtnText, { color: isRefreshingCompendium ? c.mutedForeground : c.primary }]}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetFilters} activeOpacity={0.7}>
              <Text style={[styles.tabBtnText, { color: c.mutedForeground }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {officialCacheStatusText && (
          <View style={{ marginBottom: 12, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: c.radius, borderColor: c.border, backgroundColor: c.card }}>
            <Text style={{ fontSize: 12, color: c.mutedForeground }}>{officialCacheStatusText}</Text>
          </View>
        )}

        {showFilters && (
          <View style={[styles.filterPanel, { backgroundColor: c.card, borderColor: c.border }]}>
            <View>
              <Text style={[styles.filterLabel, { color: c.foreground }]}>Challenge Rating</Text>
              <View style={styles.filterRangeRow}>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                  value={filters.crMin.toString()}
                  onChangeText={(val) => setFilters((prev) => ({ ...prev, crMin: Math.max(0, parseInt(val, 10) || 0) }))}
                  placeholder="Min CR"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.filterInput, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                  value={filters.crMax.toString()}
                  onChangeText={(val) => setFilters((prev) => ({ ...prev, crMax: Math.max(0, parseInt(val, 10) || 30) }))}
                  placeholder="Max CR"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View>
              <Text style={[styles.filterLabel, { color: c.foreground }]}>Hit Points</Text>
              <View style={styles.filterRangeRow}>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                  value={filters.hpMin.toString()}
                  onChangeText={(val) => setFilters((prev) => ({ ...prev, hpMin: Math.max(0, parseInt(val, 10) || 0) }))}
                  placeholder="Min HP"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.filterInput, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
                  value={filters.hpMax.toString()}
                  onChangeText={(val) => setFilters((prev) => ({ ...prev, hpMax: Math.max(0, parseInt(val, 10) || 999) }))}
                  placeholder="Max HP"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {allTypes.length > 0 && (
              <View>
                <Text style={[styles.filterLabel, { color: c.foreground }]}>Type</Text>
                <View style={styles.filterChipRow}>
                  {allTypes.map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: filters.types.has(type.key) ? c.primary + "22" : c.background,
                          borderColor: filters.types.has(type.key) ? c.primary : c.border,
                        },
                      ]}
                      onPress={() => toggleFilter("type", type.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: filters.types.has(type.key) ? c.primary : c.mutedForeground }}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {allSizes.length > 0 && (
              <View>
                <Text style={[styles.filterLabel, { color: c.foreground }]}>Size</Text>
                <View style={styles.filterChipRow}>
                  {allSizes.map((size) => (
                    <TouchableOpacity
                      key={size.key}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: filters.sizes.has(size.key) ? c.primary + "22" : c.background,
                          borderColor: filters.sizes.has(size.key) ? c.primary : c.border,
                        },
                      ]}
                      onPress={() => toggleFilter("size", size.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: filters.sizes.has(size.key) ? c.primary : c.mutedForeground }}>
                        {size.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {allRealms.length > 0 && (
              <View>
                <Text style={[styles.filterLabel, { color: c.foreground }]}>Planes & Environments</Text>
                <View style={styles.filterChipRow}>
                  {allRealms.map((realm) => (
                    <TouchableOpacity
                      key={realm.key}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: filters.realms.has(realm.key) ? c.primary + "22" : c.background,
                          borderColor: filters.realms.has(realm.key) ? c.primary : c.border,
                        },
                      ]}
                      onPress={() => toggleFilter("realm", realm.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: filters.realms.has(realm.key) ? c.primary : c.mutedForeground, textTransform: "capitalize" }}>
                        {realm.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.tabRow}>
          {(["official", "custom"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, { flex: 1, backgroundColor: tab === t ? c.primary : c.card, borderColor: c.border }]}
              onPress={() => setTab(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, { color: tab === t ? c.primaryForeground : c.foreground, textTransform: "capitalize" }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "official" && !hasActiveEncounter && (
          <Text style={[styles.encounterHint, { color: c.mutedForeground }]}>
            No active encounter. Start one in DM Party to add monsters to encounter. Customize is still available.
          </Text>
        )}

        {tab === "custom" && (
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: c.primary + "22", borderWidth: 1, borderColor: c.primary }]}
            onPress={handleOpenCustomForm}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={16} color={c.primary} />
            <Text style={[styles.createBtnText, { color: c.primary }]}>Create Custom Monster</Text>
          </TouchableOpacity>
        )}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={c.primary} />
          </View>
        )}

        {!isLoading && displayMonsters.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={40} color={c.mutedForeground} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: c.foreground }]}>
              {tab === "official" ? "No official monsters" : "No custom monsters"}
            </Text>
            <Text style={[styles.emptySubtext, { color: c.mutedForeground }]}>
              {tab === "official" ? (searchText ? "No results match your search" : "Check back when online") : "Create your first custom monster"}
            </Text>
          </View>
        )}

        {!isLoading &&
          visibleMonsters.map((monster, index) => {
            const isCustom = isCustomMonster(monster);
            const key = isCustom ? monster.id : `${monster.slug}::${index}`;
            const isExpanded = expandedKey === key;
            const cm = isCustom ? (monster as CustomMonster) : null;
            // Description: custom monsters show notes directly; official fall back through special_abilities/actions
            const cardDescription = isCustom
              ? (cm!.notes?.trim() || null)
              : getMonsterDescription(monster);
            return (
              <View key={key} style={[styles.monsterCard, { backgroundColor: c.card, borderColor: isExpanded ? c.primary + "66" : c.border }]}>
                {/* Card header row: name + customize icon + chevron */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <TouchableOpacity
                    onPress={() => setExpandedKey((prev) => (prev === key ? null : key))}
                    activeOpacity={0.7}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                  >
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                      <Text style={[styles.monsterName, { color: c.foreground }]}>{monster.name}</Text>
                      {isCustom ? (
                        <View style={[styles.customPill, { backgroundColor: c.primary + "22", borderColor: c.primary + "55" }]}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: c.primary }}>CUSTOM</Text>
                        </View>
                      ) : null}
                    </View>
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                  {!isCustom ? (
                    <TouchableOpacity
                      style={{ width: 28, height: 28, justifyContent: "center", alignItems: "center", borderRadius: c.radius, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, marginLeft: 8 }}
                      onPress={() => handleCustomizeMonster(monster)}
                      activeOpacity={0.7}
                    >
                      <Feather name="copy" size={13} color={c.mutedForeground} />
                    </TouchableOpacity>
                  ) : null}
                  {isCustom ? (
                    <TouchableOpacity
                      style={{ width: 28, height: 28, justifyContent: "center", alignItems: "center", borderRadius: c.radius, borderWidth: 1, borderColor: c.primary + "55", backgroundColor: c.primary + "18", marginLeft: 8 }}
                      onPress={() => handleEditCustom(monster as CustomMonster)}
                      activeOpacity={0.7}
                    >
                      <Feather name="edit-2" size={13} color={c.primary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={[styles.monsterMeta, { color: c.mutedForeground }]}>
                  {monster.size} {monster.type} • AC {monster.armor_class} • HP {monster.hit_points} • CR {monster.challenge_rating}
                </Text>
                {monster.alignment && (
                  <Text style={[styles.monsterMeta, { color: c.mutedForeground }]}>{monster.alignment}</Text>
                )}
                {isCustom && (() => {
                  const cm = monster as CustomMonster;
                  const levelStr = cm.level !== undefined ? (cm.levelLabel ? `${cm.levelLabel} (Lv ${cm.level})` : `Level ${cm.level}`) : null;
                  const actionsCount = cm.actions?.length ?? 0;
                  const abilitiesCount = cm.special_abilities?.length ?? 0;
                  const lootCount = cm.loot?.length ?? 0;
                  const hasMeta = levelStr || actionsCount > 0 || abilitiesCount > 0 || lootCount > 0;
                  return hasMeta ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6, marginTop: 2 }}>
                      {levelStr ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.primary + "18", borderWidth: 1, borderColor: c.primary + "44" }}>
                          <Feather name="star" size={10} color={c.primary} />
                          <Text style={{ fontSize: 11, color: c.primary, fontWeight: "600" }}>{levelStr}</Text>
                        </View>
                      ) : null}
                      {actionsCount > 0 ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
                          <Feather name="zap" size={10} color={c.mutedForeground} />
                          <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "500" }}>{actionsCount} action{actionsCount !== 1 ? "s" : ""}</Text>
                        </View>
                      ) : null}
                      {abilitiesCount > 0 ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
                          <Feather name="book-open" size={10} color={c.mutedForeground} />
                          <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "500" }}>{abilitiesCount} abilit{abilitiesCount !== 1 ? "ies" : "y"}</Text>
                        </View>
                      ) : null}
                      {lootCount > 0 ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
                          <Feather name="package" size={10} color={c.mutedForeground} />
                          <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "500" }}>{lootCount} loot item{lootCount !== 1 ? "s" : ""}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null;
                })()}
                {cardDescription && (
                  <Text style={[styles.monsterDescription, { color: c.mutedForeground }]} numberOfLines={isExpanded ? undefined : 3}>
                    {cardDescription}
                  </Text>
                )}
                {/* Expanded detail view */}
                {isExpanded && (
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {/* Ability scores */}
                    <View style={{ backgroundColor: c.background, borderRadius: c.radius, padding: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 8, letterSpacing: 0.5 }}>ABILITY SCORES</Text>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        {(["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const).map((abbr, i) => {
                          const val = parseNumberish([monster.strength, monster.dexterity, monster.constitution, monster.intelligence, monster.wisdom, monster.charisma][i], 10);
                          const mod = abilityModifier(val);
                          return (
                            <View key={abbr} style={{ alignItems: "center", flex: 1 }}>
                              <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "600" }}>{abbr}</Text>
                              <Text style={{ fontSize: 14, color: c.foreground, fontWeight: "700" }}>{val}</Text>
                              <Text style={{ fontSize: 11, color: c.mutedForeground }}>{mod >= 0 ? `+${mod}` : mod}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                    {/* Speed / Hit Dice */}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1, backgroundColor: c.background, borderRadius: c.radius, padding: 8 }}>
                        <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "600", marginBottom: 2 }}>SPEED</Text>
                        <Text style={{ fontSize: 13, color: c.foreground }}>{typeof monster.speed === "string" ? monster.speed : `${parseSpeedFromMonster(monster.speed)} ft.`}</Text>
                      </View>
                      {monster.hit_dice ? (
                        <View style={{ flex: 1, backgroundColor: c.background, borderRadius: c.radius, padding: 8 }}>
                          <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "600", marginBottom: 2 }}>HIT DICE</Text>
                          <Text style={{ fontSize: 13, color: c.foreground }}>{monster.hit_dice}</Text>
                        </View>
                      ) : null}
                    </View>
                    {/* Special Abilities */}
                    {monster.special_abilities && monster.special_abilities.length > 0 && (
                      <View>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 6, letterSpacing: 0.5 }}>SPECIAL ABILITIES</Text>
                        {monster.special_abilities.map((ab, idx) => (
                          <View key={idx} style={{ marginBottom: 8 }}>
                            <Text style={{ fontSize: 13, color: c.foreground, fontWeight: "600" }}>{ab.name}.</Text>
                            <Text style={{ fontSize: 12, color: c.mutedForeground, lineHeight: 18, marginTop: 2 }}>{ab.desc}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {/* Actions */}
                    {monster.actions && monster.actions.length > 0 && (
                      <View>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 6, letterSpacing: 0.5 }}>ACTIONS</Text>
                        {monster.actions.map((ac, idx) => (
                          <View key={idx} style={{ marginBottom: 8 }}>
                            <Text style={{ fontSize: 13, color: c.foreground, fontWeight: "600" }}>{ac.name}.</Text>
                            <Text style={{ fontSize: 12, color: c.mutedForeground, lineHeight: 18, marginTop: 2 }}>{ac.desc}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {/* Loot (custom only) */}
                    {cm && cm.loot && cm.loot.length > 0 && (
                      <View>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 6, letterSpacing: 0.5 }}>LOOT</Text>
                        {cm.loot.map((item, idx) => (
                          <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <Feather name="package" size={12} color={c.mutedForeground} />
                            <Text style={{ fontSize: 12, color: c.foreground }}>{item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}{item.category ? ` (${item.category})` : ""}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
                {(hasActiveEncounter || isCustom) && (
                <View style={styles.monsterActions}>
                  {hasActiveEncounter && (
                    <TouchableOpacity
                      style={[styles.monsterBtn, { backgroundColor: c.primary + "33", flex: 1 }]}
                      onPress={() => handleAddToBattle(monster)}
                      activeOpacity={0.7}
                    >
                      <Feather name="plus-circle" size={12} color={c.primary} />
                      <Text style={[styles.monsterBtnText, { color: c.primary }]}>Add to Encounter</Text>
                    </TouchableOpacity>
                  )}
                  {isCustom && (
                    <TouchableOpacity
                      style={[styles.monsterBtn, { backgroundColor: "#EF4444" + "33" }]}
                      onPress={() => handleDeleteCustom(monster.id)}
                      activeOpacity={0.7}
                    >
                      <Feather name="trash-2" size={12} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                )}
              </View>
            );
          })}

        {!isLoading && visibleMonsters.length < displayMonsters.length && (
          <TouchableOpacity
            style={[
              styles.createBtn,
              { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, justifyContent: "center" },
            ]}
            onPress={() => setVisibleCount((count) => count + RENDER_STEP)}
            activeOpacity={0.7}
          >
            <Text style={[styles.createBtnText, { color: c.foreground }]}>
              Load More ({displayMonsters.length - visibleMonsters.length} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Custom Monster Form Modal */}
      <Modal visible={showCustomForm} animationType="slide" transparent onRequestClose={() => setShowCustomForm(false)}>
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { backgroundColor: c.background }]}>
            {/* Sticky header — always visible */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: c.foreground }}>
                {editingMonsterId ? "Edit Monster" : "Create Custom Monster"}
              </Text>
              <TouchableOpacity onPress={() => setShowCustomForm(false)} activeOpacity={0.6}>
                <Feather name="x" size={20} color={c.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: c.mutedForeground }]}>NAME</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                  placeholder="e.g. Goblin Rider"
                  placeholderTextColor={c.mutedForeground}
                  value={formData.name}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: c.mutedForeground }]}>DESCRIPTION</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    { backgroundColor: c.card, borderColor: c.border, color: c.foreground, minHeight: 88, textAlignVertical: "top" },
                  ]}
                  placeholder="Monster description, notes, loot hooks, or customization notes..."
                  placeholderTextColor={c.mutedForeground}
                  multiline
                  value={formData.notes ?? ""}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, notes: text }))}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formField, styles.formRowHalf]}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>SIZE</Text>
                  <TextInput style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} value={formData.size} onChangeText={(text) => setFormData((prev) => ({ ...prev, size: text }))} />
                </View>
                <View style={[styles.formField, styles.formRowHalf]}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>TYPE</Text>
                  <TextInput style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} value={formData.type} onChangeText={(text) => setFormData((prev) => ({ ...prev, type: text }))} />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formField, styles.formRowHalf]}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>AC</Text>
                  <TextInput style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} keyboardType="number-pad" value={formData.armor_class.toString()} onChangeText={(text) => setFormData((prev) => ({ ...prev, armor_class: parseInt(text, 10) || 10 }))} />
                </View>
                <View style={[styles.formField, styles.formRowHalf]}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>HP</Text>
                  <TextInput style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} keyboardType="number-pad" value={formData.hit_points.toString()} onChangeText={(text) => setFormData((prev) => ({ ...prev, hit_points: parseInt(text, 10) || 1 }))} />
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: c.mutedForeground }]}>CHALLENGE RATING</Text>
                <TextInput style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} placeholder="e.g. 1/4 or 1 or 10" placeholderTextColor={c.mutedForeground} value={formData.challenge_rating} onChangeText={(text) => setFormData((prev) => ({ ...prev, challenge_rating: text }))} />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formField, styles.formRowHalf]}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>LEVEL (optional)</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                    keyboardType="number-pad"
                    placeholder="e.g. 5"
                    placeholderTextColor={c.mutedForeground}
                    value={formData.level !== undefined ? formData.level.toString() : ""}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, level: text === "" ? undefined : parseInt(text, 10) || undefined }))}
                  />
                </View>
                <View style={[styles.formField, styles.formRowHalf]}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>LEVEL LABEL</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                    placeholder="e.g. Veteran"
                    placeholderTextColor={c.mutedForeground}
                    value={formData.levelLabel ?? ""}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, levelLabel: text }))}
                  />
                </View>
              </View>

              <Text style={[styles.formLabel, { color: c.mutedForeground, marginTop: 12, marginBottom: 8 }]}>ABILITY SCORES</Text>
              <View style={styles.formRow}>
                {(["strength", "dexterity", "constitution"] as const).map((ability) => (
                  <View key={ability} style={[styles.formField, styles.formRowHalf]}>
                    <Text style={[styles.formLabel, { color: c.mutedForeground }]}>{ability.slice(0, 3).toUpperCase()}</Text>
                    <TextInput style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} keyboardType="number-pad" value={formData[ability].toString()} onChangeText={(text) => setFormData((prev) => ({ ...prev, [ability]: parseInt(text, 10) || 10 }))} />
                  </View>
                ))}
              </View>
              <View style={styles.formRow}>
                {(["intelligence", "wisdom", "charisma"] as const).map((ability) => (
                  <View key={ability} style={[styles.formField, styles.formRowHalf]}>
                    <Text style={[styles.formLabel, { color: c.mutedForeground }]}>{ability.slice(0, 3).toUpperCase()}</Text>
                    <TextInput style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} keyboardType="number-pad" value={formData[ability].toString()} onChangeText={(text) => setFormData((prev) => ({ ...prev, [ability]: parseInt(text, 10) || 10 }))} />
                  </View>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: c.mutedForeground }]}>ACTIONS</Text>
                {(formData.actions ?? []).map((action, idx) => (
                  <View key={idx} style={styles.arrayItemRow}>
                    <View style={styles.arrayItemFields}>
                      <TextInput
                        style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 13 }]}
                        placeholder="Action name"
                        placeholderTextColor={c.mutedForeground}
                        value={action.name}
                        onChangeText={(text) => setFormData((prev) => { const next = [...(prev.actions ?? [])]; next[idx] = { ...next[idx], name: text }; return { ...prev, actions: next }; })}
                      />
                      <TextInput
                        style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 12, minHeight: 60, textAlignVertical: "top", marginTop: 4 }]}
                        placeholder="Description"
                        placeholderTextColor={c.mutedForeground}
                        multiline
                        value={action.desc}
                        onChangeText={(text) => setFormData((prev) => { const next = [...(prev.actions ?? [])]; next[idx] = { ...next[idx], desc: text }; return { ...prev, actions: next }; })}
                      />
                    </View>
                    <TouchableOpacity style={[styles.deleteBtn, { borderColor: "#EF4444" + "55" }]} onPress={() => setFormData((prev) => { const next = [...(prev.actions ?? [])]; next.splice(idx, 1); return { ...prev, actions: next }; })} activeOpacity={0.7}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.addArrayBtn, { borderColor: c.border }]}
                  onPress={() => setFormData((prev) => ({ ...prev, actions: [...(prev.actions ?? []), { name: "", desc: "" }] }))}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={14} color={c.primary} />
                  <Text style={{ fontSize: 12, color: c.primary, fontWeight: "600" }}>Add Action</Text>
                </TouchableOpacity>
              </View>

              {/* Special Abilities */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: c.mutedForeground }]}>SPECIAL ABILITIES</Text>
                {(formData.special_abilities ?? []).map((ability, idx) => (
                  <View key={idx} style={styles.arrayItemRow}>
                    <View style={styles.arrayItemFields}>
                      <TextInput
                        style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 13 }]}
                        placeholder="Ability name"
                        placeholderTextColor={c.mutedForeground}
                        value={ability.name}
                        onChangeText={(text) => setFormData((prev) => { const next = [...(prev.special_abilities ?? [])]; next[idx] = { ...next[idx], name: text }; return { ...prev, special_abilities: next }; })}
                      />
                      <TextInput
                        style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 12, minHeight: 60, textAlignVertical: "top", marginTop: 4 }]}
                        placeholder="Description"
                        placeholderTextColor={c.mutedForeground}
                        multiline
                        value={ability.desc}
                        onChangeText={(text) => setFormData((prev) => { const next = [...(prev.special_abilities ?? [])]; next[idx] = { ...next[idx], desc: text }; return { ...prev, special_abilities: next }; })}
                      />
                    </View>
                    <TouchableOpacity style={[styles.deleteBtn, { borderColor: "#EF4444" + "55" }]} onPress={() => setFormData((prev) => { const next = [...(prev.special_abilities ?? [])]; next.splice(idx, 1); return { ...prev, special_abilities: next }; })} activeOpacity={0.7}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.addArrayBtn, { borderColor: c.border }]}
                  onPress={() => setFormData((prev) => ({ ...prev, special_abilities: [...(prev.special_abilities ?? []), { name: "", desc: "" }] }))}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={14} color={c.primary} />
                  <Text style={{ fontSize: 12, color: c.primary, fontWeight: "600" }}>Add Ability</Text>
                </TouchableOpacity>
              </View>

              {/* Loot */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: c.mutedForeground }]}>LOOT / ITEMS</Text>
                {(formData.loot ?? []).map((item, idx) => (
                  <View key={idx} style={[styles.arrayItemRow, { alignItems: "center" }]}>
                    <View style={[styles.arrayItemFields, { flexDirection: "row", gap: 6 }]}>
                      <TextInput
                        style={[styles.formInput, { flex: 3, backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 13 }]}
                        placeholder="Item name"
                        placeholderTextColor={c.mutedForeground}
                        value={item.name}
                        onChangeText={(text) => setFormData((prev) => { const next = [...(prev.loot ?? [])]; next[idx] = { ...next[idx], name: text }; return { ...prev, loot: next }; })}
                      />
                      <TextInput
                        style={[styles.formInput, { flex: 1, backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 13 }]}
                        placeholder="Qty"
                        placeholderTextColor={c.mutedForeground}
                        keyboardType="number-pad"
                        value={item.quantity.toString()}
                        onChangeText={(text) => setFormData((prev) => { const next = [...(prev.loot ?? [])]; next[idx] = { ...next[idx], quantity: parseInt(text, 10) || 1 }; return { ...prev, loot: next }; })}
                      />
                    </View>
                    <TouchableOpacity style={[styles.deleteBtn, { borderColor: "#EF4444" + "55" }]} onPress={() => setFormData((prev) => { const next = [...(prev.loot ?? [])]; next.splice(idx, 1); return { ...prev, loot: next }; })} activeOpacity={0.7}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.addArrayBtn, { borderColor: c.border }]}
                  onPress={() => setFormData((prev) => ({ ...prev, loot: [...(prev.loot ?? []), { name: "", quantity: 1 }] }))}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={14} color={c.primary} />
                  <Text style={{ fontSize: 12, color: c.primary, fontWeight: "600" }}>Add Item</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]} onPress={() => { setShowCustomForm(false); setFormData(emptyCustomMonster()); setEditingMonsterId(null); }} activeOpacity={0.7}>
                  <Text style={[styles.actionBtnText, { color: c.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.primary }]} onPress={() => (editingMonsterId ? handleUpdateCustom() : handleCreateCustom())} activeOpacity={0.7}>
                  <Text style={[styles.actionBtnText, { color: c.primaryForeground }]}>{editingMonsterId ? "Update" : "Create"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Battle Add Modal */}
      <Modal visible={showBattleAddModal} animationType="slide" transparent onRequestClose={() => setShowBattleAddModal(false)}>
        <View style={[styles.modalOverlay, { justifyContent: "center", paddingHorizontal: 16 }]}>
          <View style={[styles.modalContent, { backgroundColor: c.background, borderRadius: c.radius * 2, padding: 20, maxHeight: "80%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: c.foreground }}>Add to Encounter</Text>
              <TouchableOpacity onPress={() => setShowBattleAddModal(false)} activeOpacity={0.6}>
                <Feather name="x" size={20} color={c.foreground} />
              </TouchableOpacity>
            </View>

            {battleMonster && (
              <>
                <Text style={{ fontSize: 14, color: c.foreground, marginBottom: 16 }}>{battleMonster.name}</Text>

                {hasActiveEncounter ? (
                  <View style={styles.selectorWrap}>
                    <Text style={[styles.formLabel, { color: c.mutedForeground }]}>ENCOUNTER</Text>
                    <View style={styles.selectorRow}>
                      {activeEncounterOptions.map((option) => (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.selectorChip,
                            {
                              backgroundColor: selectedBattleId === option.id ? c.primary + "22" : c.card,
                              borderColor: selectedBattleId === option.id ? c.primary : c.border,
                            },
                          ]}
                          onPress={() => setSelectedBattleId(option.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "600", color: selectedBattleId === option.id ? c.primary : c.foreground }}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={[styles.selectorWrap, { backgroundColor: c.card, borderRadius: c.radius, padding: 12, borderWidth: 1, borderColor: c.border, marginBottom: 16 }]}>
                    <Text style={[styles.formLabel, { color: c.primary }]}>SETTING UP ENCOUNTER</Text>
                    <Text style={{ fontSize: 13, color: c.foreground, marginTop: 8, lineHeight: 18 }}>
                      Configure this monster, then set up the encounter in DM Party to select which battle it joins.
                    </Text>
                  </View>
                )}

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>DISPOSITION</Text>
                  <View style={styles.formRow}>
                    {(["hostile", "passive", "friendly"] as const).map((disp) => (
                      <TouchableOpacity key={disp} style={[styles.tabBtn, { flex: 1, backgroundColor: battleDisposition === disp ? c.primary : c.card, borderColor: c.border }]} onPress={() => setBattleDisposition(disp)} activeOpacity={0.7}>
                        <Text style={[styles.tabBtnText, { color: battleDisposition === disp ? c.primaryForeground : c.foreground, textTransform: "capitalize" }]}>{disp}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>QUANTITY</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TouchableOpacity style={[styles.actionBtn, { flex: 0.3, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]} onPress={() => setBattleQuantity((q) => Math.max(1, q - 1))} activeOpacity={0.7}>
                      <Text style={[styles.actionBtnText, { color: c.foreground }]}>−</Text>
                    </TouchableOpacity>
                    <TextInput style={[styles.formInput, { flex: 1, backgroundColor: c.card, borderColor: c.border, color: c.foreground, textAlign: "center" }]} keyboardType="number-pad" value={battleQuantity.toString()} onChangeText={(text) => setBattleQuantity(Math.max(1, parseInt(text, 10) || 1))} />
                    <TouchableOpacity style={[styles.actionBtn, { flex: 0.3, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]} onPress={() => setBattleQuantity((q) => q + 1)} activeOpacity={0.7}>
                      <Text style={[styles.actionBtnText, { color: c.foreground }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]} onPress={() => setShowBattleAddModal(false)} activeOpacity={0.7}>
                    <Text style={[styles.actionBtnText, { color: c.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                  {hasActiveEncounter ? (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.primary, opacity: addingToBattle ? 0.7 : 1 }]} onPress={handleConfirmAddToBattle} activeOpacity={0.7} disabled={addingToBattle || !selectedBattleId}>
                      <Text style={[styles.actionBtnText, { color: c.primaryForeground }]}>{addingToBattle ? "Adding..." : "Add to Encounter"}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.primary }]} onPress={handleSetupEncounterInParty} activeOpacity={0.7}>
                      <Text style={[styles.actionBtnText, { color: c.primaryForeground }]}>Set Up Encounter in DM Party</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
