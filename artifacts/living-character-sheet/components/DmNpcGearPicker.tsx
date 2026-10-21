import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import {
  CREATION_GEAR_FILTER_CATEGORIES,
  CREATION_GEAR_RARITIES,
  buildRandomCreationGearSelection,
  buildCreationGearLoadout,
  buildCreationGearCatalog,
  filterCreationGearCatalog,
  formatCreationGearCost,
  getCreationGearCatalogEntryWeightLbs,
  getCreationGearLoadPresetWeightLimit,
  getClassFreeChoiceBudgetGp,
  getClassPresetOptions,
  getClassStrictPackageOptions,
  getPackageDetails,
  sortCreationGearCatalogBySelections,
  type ClassGearOption,
  type CreationGearFilterCategory,
  type CreationGearLoadPreset,
  type CreationGearRarity,
  type GearSelectionMode,
} from "@/utils/creationGear";
import type { InventoryItem } from "@/types";

interface DmNpcGearPickerProps {
  npc: {
    charClass: string;
    race: string;
    background: string;
  };
  gearMode: GearSelectionMode;
  setGearMode: (mode: GearSelectionMode) => void;
  strictPackageId: string;
  setStrictPackageId: (id: string) => void;
  presetId: string;
  setPresetId: (id: string) => void;
  category: CreationGearFilterCategory;
  setCategory: (cat: CreationGearFilterCategory) => void;
  freeSelections: Record<string, number>;
  setFreeSelections: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onInventoryUpdate: (items: InventoryItem[]) => void;
}

const MARTIAL_CATALOG_CATEGORIES = new Set<InventoryItem["category"]>(["weapon", "armor"]);

function formatCategoryLabel(category: CreationGearFilterCategory): string {
  if (category === "all") return "All";
  if (category === "component") return "Component";
  if (category === "junk") return "Junk";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function DmNpcGearPicker({
  npc,
  gearMode,
  setGearMode,
  strictPackageId,
  setStrictPackageId,
  presetId,
  setPresetId,
  category,
  setCategory,
  freeSelections,
  setFreeSelections,
  onInventoryUpdate,
}: DmNpcGearPickerProps) {
  const c = useColors();
  const [loadPreset, setLoadPreset] = useState<CreationGearLoadPreset>("moderate");
  const [maxRarity, setMaxRarity] = useState<CreationGearRarity>("Artifact");

  if (!npc.charClass) {
    return (
      <View style={styles.section}>
        <Text style={{ color: c.mutedForeground }}>Please select a class on the Identity tab first.</Text>
      </View>
    );
  }

  const strictOptions = getClassStrictPackageOptions(npc.charClass);
  const presetOptions = getClassPresetOptions(npc.charClass);
  const likelyProficientNames = useMemo(() => {
    return new Set(
      strictOptions
        .flatMap((option) => option.items)
        .map((item) => item.name.trim().toLowerCase()),
    );
  }, [strictOptions]);
  const catalogByName = useMemo(() => {
    return new Map(buildCreationGearCatalog().map((entry) => [entry.name, entry]));
  }, []);
  const filteredCatalog = useMemo(
    () => filterCreationGearCatalog(category, { maxRarity }),
    [category, maxRarity],
  );
  const orderedCatalog = useMemo(
    () => sortCreationGearCatalogBySelections(filteredCatalog, freeSelections),
    [filteredCatalog, freeSelections],
  );
  const loadLimitLbs = useMemo(() => getCreationGearLoadPresetWeightLimit(loadPreset), [loadPreset]);
  const selectedWeightLbs = useMemo(() => {
    return Object.entries(freeSelections).reduce((sum, [itemName, quantity]) => {
      if (quantity <= 0) return sum;
      const entry = catalogByName.get(itemName);
      if (!entry) return sum;
      return sum + getCreationGearCatalogEntryWeightLbs(entry) * quantity;
    }, 0);
  }, [catalogByName, freeSelections]);
  const budgetGp = getClassFreeChoiceBudgetGp(npc.charClass);

  useEffect(() => {
    if (!strictOptions.length) {
      setStrictPackageId("");
      return;
    }
    if (!strictPackageId || !strictOptions.some((option) => option.id === strictPackageId)) {
      setStrictPackageId(strictOptions[0].id);
    }
  }, [strictOptions, strictPackageId, setStrictPackageId]);

  useEffect(() => {
    if (!presetOptions.length) {
      setPresetId("");
      return;
    }
    if (!presetId || !presetOptions.some((option) => option.id === presetId)) {
      setPresetId(presetOptions[0].id);
    }
  }, [presetOptions, presetId, setPresetId]);

  // Compute the current gear loadout
  const selectedChoices = useMemo(
    () => Object.entries(freeSelections)
      .filter(([, quantity]) => quantity > 0)
      .map(([name, quantity]) => ({ name, quantity })),
    [freeSelections],
  );

  const currentLoadout = useMemo(() => {
    return buildCreationGearLoadout({
      className: npc.charClass,
      race: npc.race || "Human",
      background: npc.background || "Acolyte",
      mode: gearMode,
      strictPackageId: gearMode === "strict" ? strictPackageId : undefined,
      presetId: gearMode === "preset" ? presetId : undefined,
      freeChoices: gearMode === "free" ? selectedChoices : [],
      bonusChoices: gearMode === "free" ? [] : selectedChoices,
    });
  }, [npc.charClass, npc.race, npc.background, gearMode, strictPackageId, presetId, selectedChoices]);

  // Update parent when loadout changes
  useEffect(() => {
    onInventoryUpdate(currentLoadout.items);
  }, [currentLoadout, onInventoryUpdate]);

  const suggestedDelta = Math.floor(budgetGp - currentLoadout.spentGp);

  const adjustFreeSelection = (itemName: string, delta: number) => {
    setFreeSelections((prev) => {
      const nextQty = Math.max(0, (prev[itemName] ?? 0) + delta);
      if (delta > 0) {
        const entry = catalogByName.get(itemName);
        if (entry) {
          const addedWeight = getCreationGearCatalogEntryWeightLbs(entry);
          const nextWeight = selectedWeightLbs + addedWeight;
          if (Number.isFinite(loadLimitLbs) && nextWeight > loadLimitLbs) {
            return prev;
          }
        }
      }
      if (nextQty === 0) {
        const { [itemName]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [itemName]: nextQty,
      };
    });
  };

  const randomizeGear = (modeOverride?: GearSelectionMode) => {
    const randomGear = buildRandomCreationGearSelection({
      className: npc.charClass,
      mode: modeOverride ?? gearMode,
      category,
      maxRarity,
      loadPreset,
    });
    setGearMode(randomGear.mode);
    setStrictPackageId(randomGear.strictPackageId);
    setPresetId(randomGear.presetId);
    setCategory(randomGear.category);
    const nextSelections = (randomGear.mode === "free" ? randomGear.freeChoices : randomGear.bonusChoices);
    setFreeSelections(
      Object.fromEntries(nextSelections.map((choice) => [choice.name, Math.max(1, choice.quantity)])),
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: c.foreground }]}>Gear Selection Mode</Text>
        <View style={styles.modeButtonsContainer}>
          {(["strict", "preset", "free"] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => {
                setGearMode(mode);
                // Reset selections when switching modes
                setStrictPackageId("");
                setPresetId("");
                setCategory("all");
                setFreeSelections({});
                randomizeGear(mode);
              }}
              style={[
                styles.modeButton,
                {
                  backgroundColor: gearMode === mode ? c.primary : c.card,
                  borderColor: gearMode === mode ? c.primary : c.border,
                },
              ]}
            >
              <Text style={[styles.modeButtonText, { color: gearMode === mode ? "#fff" : c.foreground }]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: c.foreground }]}>Load Preset</Text>
        <View style={styles.presetWrap}>
          {(["light", "moderate", "heavy", "encumbered"] as const).map((preset) => (
            <TouchableOpacity
              key={preset}
              onPress={() => setLoadPreset(preset)}
              style={[
                styles.presetChip,
                {
                  backgroundColor: loadPreset === preset ? c.primary : c.card,
                  borderColor: loadPreset === preset ? c.primary : c.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: loadPreset === preset ? "#fff" : c.foreground }]}>
                {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.hint, { color: c.mutedForeground }]}>
          {Number.isFinite(loadLimitLbs)
            ? `Estimated load cap: ${loadLimitLbs} lbs`
            : "Estimated load cap: none"}
        </Text>
      </View>

      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: c.foreground }]}>Max Rarity</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {CREATION_GEAR_RARITIES.map((rarity) => (
            <TouchableOpacity
              key={rarity}
              onPress={() => setMaxRarity(rarity)}
              style={[
                styles.chip,
                {
                  backgroundColor: maxRarity === rarity ? c.primary : c.card,
                  borderColor: maxRarity === rarity ? c.primary : c.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: maxRarity === rarity ? "#fff" : c.foreground }]}>
                {rarity}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity
        onPress={() => randomizeGear()}
        style={[styles.randomizeBtn, { backgroundColor: c.card, borderColor: c.border }]}
        activeOpacity={0.8}
      >
        <Text style={[styles.randomizeBtnText, { color: c.foreground }]}>Randomize Gear</Text>
      </TouchableOpacity>

      {gearMode === "strict" && (
        <>
          <View style={styles.fieldRow}>
            <Text style={[styles.label, { color: c.foreground }]}>5e Class Package</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {strictOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setStrictPackageId(opt.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: strictPackageId === opt.id ? c.primary : c.card,
                      borderColor: strictPackageId === opt.id ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: strictPackageId === opt.id ? "#fff" : c.foreground }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {strictPackageId && (
            <PackageContents
              packageOption={strictOptions.find((opt) => opt.id === strictPackageId)}
            />
          )}
        </>
      )}

      {gearMode === "preset" && (
        <>
          <View style={styles.fieldRow}>
            <Text style={[styles.label, { color: c.foreground }]}>Preset Kit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {presetOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setPresetId(opt.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: presetId === opt.id ? c.primary : c.card,
                      borderColor: presetId === opt.id ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: presetId === opt.id ? "#fff" : c.foreground }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {presetId && (
            <PackageContents
              packageOption={presetOptions.find((opt) => opt.id === presetId)}
            />
          )}
        </>
      )}

      {gearMode === "free" && (
        <>
          <View style={styles.fieldRow}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[styles.label, { color: c.foreground }]}>Suggested Budget</Text>
              <Text style={[styles.hint, { color: c.mutedForeground }]}>{budgetGp} gp baseline</Text>
            </View>
            <Text style={{ color: c.foreground, marginTop: 8 }}>
              {suggestedDelta >= 0
                ? `Suggested remaining: ${suggestedDelta} gp`
                : `Over suggestion by ${Math.abs(suggestedDelta)} gp`}
            </Text>
            <Text style={{ color: c.foreground, marginTop: 6 }}>
              {Number.isFinite(loadLimitLbs)
                ? `Estimated load: ${selectedWeightLbs.toFixed(1)} / ${loadLimitLbs} lbs`
                : `Estimated load: ${selectedWeightLbs.toFixed(1)} lbs (no cap)`}
            </Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.label, { color: c.foreground }]}>Category Filter</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {CREATION_GEAR_FILTER_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: category === cat ? c.primary : c.card,
                      borderColor: category === cat ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: category === cat ? "#fff" : c.foreground }]}>
                    {formatCategoryLabel(cat)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Free Choice Catalog</Text>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
              {orderedCatalog.map((entry) => {
                const qty = freeSelections[entry.name] ?? 0;
                const isLikelyProficient = MARTIAL_CATALOG_CATEGORIES.has(entry.category)
                  && likelyProficientNames.has(entry.name.trim().toLowerCase());
                return (
                  <View
                    key={entry.name}
                    style={[styles.freeRow, { borderColor: c.border, backgroundColor: c.background }]}
                  >
                    <View style={styles.counterRow}>
                      <TouchableOpacity
                        onPress={() => adjustFreeSelection(entry.name, -1)}
                        style={[styles.counterBtn, { borderColor: c.border, backgroundColor: c.card }]}
                      >
                        <Text style={{ color: c.foreground, fontWeight: "700" }}>-</Text>
                      </TouchableOpacity>
                      <Text style={{ color: c.foreground, minWidth: 20, textAlign: "center", fontWeight: "700" }}>{qty}</Text>
                      <TouchableOpacity
                        onPress={() => adjustFreeSelection(entry.name, 1)}
                        disabled={Boolean(
                          Number.isFinite(loadLimitLbs)
                          && selectedWeightLbs + getCreationGearCatalogEntryWeightLbs(entry) > loadLimitLbs,
                        )}
                        style={[styles.counterBtn, { borderColor: c.border, backgroundColor: c.card }]}
                      >
                        <Text style={{ color: c.foreground, fontWeight: "700" }}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {isLikelyProficient ? <Text style={{ color: c.primary, fontSize: 12 }}>★</Text> : null}
                        <Text style={{ color: c.foreground, fontSize: 13, fontWeight: "600", flexShrink: 1 }}>{entry.name}</Text>
                      </View>
                      <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                        {entry.category} · {entry.rarity} · {formatCreationGearCost(entry.costGp)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

      {/* Summary */}
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, marginTop: 16 }]}>
        <Text style={[styles.cardTitle, { color: c.foreground }]}>Current Loadout</Text>
        <Text style={{ color: c.foreground, marginTop: 8 }}>
          {currentLoadout.items.length} items, {currentLoadout.currency.gp} gp
          {currentLoadout.currency.sp > 0 ? ` ${currentLoadout.currency.sp} sp` : ""}
          {currentLoadout.currency.cp > 0 ? ` ${currentLoadout.currency.cp} cp` : ""}
        </Text>
        {gearMode !== "free" ? (
          <Text style={{ color: c.mutedForeground, marginTop: 6, fontSize: 12 }}>
            Randomize adds bonus loot from selected max rarity and load preset.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// Helper component to display package contents
interface PackageContentsProps {
  packageOption?: ClassGearOption;
}

function PackageContents({ packageOption }: PackageContentsProps) {
  const c = useColors();
  if (!packageOption) return null;

  const details = getPackageDetails(packageOption);

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, marginTop: 12 }]}>
      <Text style={[styles.cardTitle, { color: c.foreground }]}>Package Contents</Text>
      {details.map((item, idx) => (
        <View key={idx} style={{ marginTop: 8, paddingBottom: 8, borderBottomColor: c.border, borderBottomWidth: idx < details.length - 1 ? 1 : 0 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: c.foreground, fontWeight: "500" }}>
              {item.name} {item.quantity > 1 ? `x${item.quantity}` : ""}
            </Text>
            <Text style={{ color: c.mutedForeground }}>
              {formatCreationGearCost(item.costGp)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: 12,
    gap: 12,
  },
  fieldRow: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
  },
  modeButtonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  presetWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  randomizeBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  randomizeBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  modeButtonText: {
    fontWeight: "600",
    fontSize: 13,
  },
  chipScroll: {
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardTitle: {
    fontWeight: "600",
    fontSize: 14,
  },
  freeRow: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  counterBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
