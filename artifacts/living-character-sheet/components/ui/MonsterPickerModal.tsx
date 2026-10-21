import React, { useState, useMemo, useDeferredValue } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { Card } from "./Card";
import type { CompendiumMonster } from "@/types";
import {
  getCompendiumWithMeta,
  isCustomMonster,
} from "@/utils/monsterApi";

const INITIAL_RENDER_COUNT = 16;
const RENDER_STEP = 16;
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

interface MonsterPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (monster: CompendiumMonster) => void;
}

interface FilterState {
  crMin: number;
  crMax: number;
  types: Set<string>;
  sizes: Set<string>;
  realms: Set<string>;
  hpMin: number;
  hpMax: number;
}

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

export function MonsterPickerModal({
  visible,
  onClose,
  onSelect,
}: MonsterPickerModalProps) {
  const c = useColors();
  const [tab, setTab] = useState<"official" | "custom">("official");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [monsters, setMonsters] = useState<CompendiumMonster[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_COUNT);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    crMin: 0,
    crMax: 30,
    types: new Set(),
    sizes: new Set(),
    realms: new Set(),
    hpMin: 0,
    hpMax: 999,
  });
  const deferredSearch = useDeferredValue(search);

  React.useEffect(() => {
    if (visible) {
      void loadMonsters();
    }
  }, [visible]);

  React.useEffect(() => {
    setVisibleCount(INITIAL_RENDER_COUNT);
  }, [tab, search, filters]);

  const loadMonsters = async (forceRefresh = false) => {
    setLoading(true);

    try {
      const result = await getCompendiumWithMeta({ forceRefresh });
      setMonsters(result.monsters);

      // Stale-cache-first path: render cached list now, then refresh once in background.
      if (!forceRefresh && result.officialMeta.isStale && result.officialMeta.isRefreshingInBackground) {
        void loadMonsters(true);
      }
    } catch (e) {
      console.error("Failed to load compendium:", e);
      setMonsters([]);
    } finally {
      setLoading(false);
    }
  };

  const tabMonsters = useMemo(() => {
    return monsters.filter((m) => {
      const custom = isCustomMonster(m);
      return tab === "custom" ? custom : !custom;
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
      const monsterRealms = getMonsterRealmTokens(monster);
      if (monsterRealms.length === 0) {
        hasUnassigned = true;
        return;
      }
      monsterRealms.forEach((realm) => {
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

  const toggleFilter = (type: "type" | "size" | "realm", value: string) => {
    setFilters((prev) => {
      const source = type === "type" ? prev.types : type === "size" ? prev.sizes : prev.realms;
      const newSet = source.has(value) ? new Set<string>() : new Set<string>([value]);
      return {
        ...prev,
        [type === "type" ? "types" : type === "size" ? "sizes" : "realms"]: newSet,
      };
    });
  };

  const filtered = useMemo(() => {
    const searchLower = normalizeToken(deferredSearch);
    return tabMonsters
      .filter((m) => {
        const textMatch =
          normalizeToken(m.name).includes(searchLower) ||
          normalizeToken(m.type).includes(searchLower);

        const cr = parseChallengeRating(m.challenge_rating);
        const hp = m.hit_points || 0;

        const crMatch = cr >= filters.crMin && cr <= filters.crMax;
        const hpMatch = hp >= filters.hpMin && hp <= filters.hpMax;

        const typeMatch =
          filters.types.size === 0 ||
          filters.types.has(normalizeToken(m.type));
        const sizeMatch =
          filters.sizes.size === 0 ||
          filters.sizes.has(normalizeToken(m.size));
        const monsterRealms = getMonsterRealmTokens(m);
        const realmMatch =
          filters.realms.size === 0 ||
          Array.from(filters.realms).some((realm) => (
            realm === UNASSIGNED_REALM_KEY
              ? monsterRealms.length === 0
              : monsterRealms.includes(realm)
          ));

        return textMatch && crMatch && hpMatch && typeMatch && sizeMatch && realmMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tabMonsters, deferredSearch, filters]);

  const visibleMonsters = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: c.background }]}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <Text style={[styles.headerText, { color: c.foreground }]}>
            Select Monster
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={20} color={c.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 8,
            gap: 8,
          }}
        >
          {(["official", "custom"] as const).map((tabId) => (
            <TouchableOpacity
              key={tabId}
              onPress={() => setTab(tabId)}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    tab === tabId ? c.primary + "20" : c.secondary,
                  borderBottomWidth: tab === tabId ? 2 : 0,
                  borderBottomColor: tab === tabId ? c.primary : "transparent",
                },
              ]}
            >
              <Text
                style={{
                  color: tab === tabId ? c.primary : c.mutedForeground,
                  fontWeight: tab === tabId ? "600" : "500",
                  fontSize: 13,
                  textTransform: "capitalize",
                }}
              >
                {tabId}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search monsters..."
            placeholderTextColor={c.mutedForeground}
            style={[
              styles.searchInput,
              {
                backgroundColor: c.secondary,
                color: c.foreground,
                borderColor: c.border,
              },
            ]}
          />
        </View>

        {/* Filter Toggle */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 8,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: c.secondary,
              borderRadius: 6,
            }}
          >
            <Feather name="sliders" size={16} color={c.primary} />
            <Text
              style={{
                color: c.primary,
                fontWeight: "500",
                fontSize: 12,
              }}
            >
              Filters
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {(filters.crMin !== 0 ||
              filters.crMax !== 30 ||
              filters.hpMin !== 0 ||
              filters.hpMax !== 999 ||
              filters.types.size > 0 ||
              filters.sizes.size > 0 ||
              filters.realms.size > 0) && (
              <TouchableOpacity
                onPress={() =>
                  setFilters({
                    crMin: 0,
                    crMax: 30,
                    types: new Set(),
                    sizes: new Set(),
                    realms: new Set(),
                    hpMin: 0,
                    hpMax: 999,
                  })
                }
                style={{ paddingVertical: 8, paddingHorizontal: 12 }}
              >
                <Text
                  style={{
                    color: c.mutedForeground,
                    fontSize: 12,
                    textDecorationLine: "underline",
                  }}
                >
                  Clear
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Loading */}
        {loading && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={c.primary} />
          </View>
        )}

        {/* Filter Panel + Monster List scroll together so filter expansion doesn't break scrolling */}
        {!loading && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Filter Panel */}
            {showFilters && (
              <View
                style={{
                  gap: 12,
                  backgroundColor: c.secondary,
                  marginBottom: 12,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                {/* CR Range */}
                <View>
                  <Text style={{ color: c.foreground, fontWeight: "600", fontSize: 12, marginBottom: 6 }}>
                    Challenge Rating: {filters.crMin} – {filters.crMax}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={filters.crMin.toString()}
                      onChangeText={(val) => setFilters((prev) => ({ ...prev, crMin: Math.max(0, parseInt(val) || 0) }))}
                      placeholder="Min CR"
                      placeholderTextColor={c.mutedForeground}
                      keyboardType="numeric"
                      style={[styles.filterInput, { backgroundColor: c.background, color: c.foreground }]}
                    />
                    <TextInput
                      value={filters.crMax.toString()}
                      onChangeText={(val) => setFilters((prev) => ({ ...prev, crMax: Math.max(0, parseInt(val) || 30) }))}
                      placeholder="Max CR"
                      placeholderTextColor={c.mutedForeground}
                      keyboardType="numeric"
                      style={[styles.filterInput, { backgroundColor: c.background, color: c.foreground }]}
                    />
                  </View>
                </View>

                {/* HP Range */}
                <View>
                  <Text style={{ color: c.foreground, fontWeight: "600", fontSize: 12, marginBottom: 6 }}>
                    Hit Points: {filters.hpMin} – {filters.hpMax}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={filters.hpMin.toString()}
                      onChangeText={(val) => setFilters((prev) => ({ ...prev, hpMin: Math.max(0, parseInt(val) || 0) }))}
                      placeholder="Min HP"
                      placeholderTextColor={c.mutedForeground}
                      keyboardType="numeric"
                      style={[styles.filterInput, { backgroundColor: c.background, color: c.foreground }]}
                    />
                    <TextInput
                      value={filters.hpMax.toString()}
                      onChangeText={(val) => setFilters((prev) => ({ ...prev, hpMax: Math.max(0, parseInt(val) || 999) }))}
                      placeholder="Max HP"
                      placeholderTextColor={c.mutedForeground}
                      keyboardType="numeric"
                      style={[styles.filterInput, { backgroundColor: c.background, color: c.foreground }]}
                    />
                  </View>
                </View>

                {/* Type Filter */}
                {allTypes.length > 0 && (
                  <View>
                    <Text style={{ color: c.foreground, fontWeight: "600", fontSize: 12, marginBottom: 6 }}>Type</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {allTypes.map((type) => (
                        <TouchableOpacity
                          key={type.key}
                          onPress={() => toggleFilter("type", type.key)}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: filters.types.has(type.key)
                                ? c.primary + "30"
                                : c.background,
                              borderColor: filters.types.has(type.key)
                                ? c.primary
                                : c.border,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: filters.types.has(type.key)
                                ? c.primary
                                : c.mutedForeground,
                              fontSize: 11,
                              fontWeight: "500",
                            }}
                          >
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Size Filter */}
                {allSizes.length > 0 && (
                  <View>
                    <Text style={{ color: c.foreground, fontWeight: "600", fontSize: 12, marginBottom: 6 }}>Size</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {allSizes.map((size) => (
                        <TouchableOpacity
                          key={size.key}
                          onPress={() => toggleFilter("size", size.key)}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: filters.sizes.has(size.key)
                                ? c.primary + "30"
                                : c.background,
                              borderColor: filters.sizes.has(size.key)
                                ? c.primary
                                : c.border,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: filters.sizes.has(size.key)
                                ? c.primary
                                : c.mutedForeground,
                              fontSize: 11,
                              fontWeight: "500",
                            }}
                          >
                            {size.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {allRealms.length > 0 && (
                  <View>
                    <Text style={{ color: c.foreground, fontWeight: "600", fontSize: 12, marginBottom: 6 }}>Planes & Environments</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {allRealms.map((realm) => (
                        <TouchableOpacity
                          key={realm.key}
                          onPress={() => toggleFilter("realm", realm.key)}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: filters.realms.has(realm.key)
                                ? c.primary + "30"
                                : c.background,
                              borderColor: filters.realms.has(realm.key)
                                ? c.primary
                                : c.border,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: filters.realms.has(realm.key)
                                ? c.primary
                                : c.mutedForeground,
                              fontSize: 11,
                              fontWeight: "500",
                              textTransform: "capitalize",
                            }}
                          >
                            {realm.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Monster List */}
            {filtered.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Feather name="search" size={32} color={c.mutedForeground} style={{ marginBottom: 8 }} />
                <Text style={{ color: c.mutedForeground, fontSize: 13 }}>No monsters found</Text>
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                {visibleMonsters.map((monster, index) => {
                  const isCustom = isCustomMonster(monster);
                  const key = isCustom
                    ? monster.id
                    : `${monster.slug ?? monster.name}::${index}`;
                  return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => { onSelect(monster); onClose(); }}
                    activeOpacity={0.7}
                  >
                    <Card
                      padding={12}
                      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                          <Text style={{ color: c.foreground, fontWeight: "600", fontSize: 13 }}>
                            {monster.name}
                          </Text>
                          {isCustom ? (
                            <View style={{ borderRadius: 999, borderWidth: 1, borderColor: c.primary + "55", backgroundColor: c.primary + "22", paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 }}>
                              <Text style={{ fontSize: 9, fontWeight: "700", color: c.primary }}>CUSTOM</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                          {monster.type} · CR {monster.challenge_rating}
                        </Text>
                        {getMonsterDescription(monster) && (
                          <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: 4 }} numberOfLines={2}>
                            {getMonsterDescription(monster)}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: c.primary, fontWeight: "600" }}>{monster.hit_points} HP</Text>
                        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>AC {monster.armor_class}</Text>
                      </View>
                    </Card>
                  </TouchableOpacity>
                  );
                })}

                {visibleMonsters.length < filtered.length && (
                  <TouchableOpacity
                    style={{
                      marginTop: 8,
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: c.radius,
                      backgroundColor: c.secondary,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onPress={() => setVisibleCount((count) => count + RENDER_STEP)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: c.foreground }}>
                      Load More ({filtered.length - visibleMonsters.length} remaining)
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "700",
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
});
