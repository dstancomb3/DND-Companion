/**
 * CharacterSheetFormCore.tsx
 * 
 * Shared form component for both landing page and DM NPC character creation.
 * Handles: Identity, Stats, Personality, and Appearance/Secrets sections.
 * 
 * Props:
 * - formData: Character/NPC object with name, race, age, ability scores, traits, etc.
 * - onChange: Callback to update form data
 * - section: Currently active form section
 * - onSectionChange: Callback to switch sections
 * - showAppearanceAiButton?: Show AI appearance generation button (optional)
 * - onGenerateAppearance?: Callback for AI appearance generation (optional)
 * - isGeneratingAppearance?: Loading state for appearance generation (optional)
 */

import React, { useMemo } from "react";
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { RACE_GROUPS, ALL_CLASSES, ALL_BACKGROUNDS } from "@/data/dnd5e";
import {
  roll, roll4d6DropLowest,
  NPC_GENDERS, NPC_ALIGNMENTS, NPC_OCCUPATIONS,
  NPC_PERSONALITY_TRAITS, NPC_IDEALS, NPC_BONDS, NPC_FLAWS,
  NPC_APPEARANCE, NPC_SECRETS,
} from "@/data/dmTables";
import { getRaceLifespan, computeAgeCategory, getLifespanHint } from "@/utils/raceLifespan";

export type CharacterSheetFormSection = "identity" | "stats" | "personality" | "appearance";

export interface CharacterSheetFormData {
  name: string;
  gender: string;
  race: string;
  age: string;
  alignment: string;
  occupation: string;
  background: string;
  charClass: string;
  subclass: string;
  level: string;
  personalityTrait1: string;
  personalityTrait2: string;
  ideal: string;
  bond: string;
  flaw: string;
  appearance: string;
  str: string;
  dex: string;
  con: string;
  int: string;
  wis: string;
  cha: string;
}

interface CharacterSheetFormCoreProps {
  formData: CharacterSheetFormData;
  onChange: (key: keyof CharacterSheetFormData, value: string) => void;
  section: CharacterSheetFormSection;
  onSectionChange: (section: CharacterSheetFormSection) => void;
  raceDescriptions?: Record<string, string>;
  classDescriptions?: Record<string, string>;
  subclassDescriptions?: Record<string, string>;
  showAppearanceAiButton?: boolean;
  onGenerateAppearance?: () => void;
  isGeneratingAppearance?: boolean;
  showTabs?: boolean;
}

const TABS: { id: CharacterSheetFormSection; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "stats", label: "Stats" },
  { id: "personality", label: "Traits" },
  { id: "appearance", label: "Appearance" },
];

export function CharacterSheetFormCore({
  formData,
  onChange,
  section,
  onSectionChange,
  raceDescriptions = {},
  classDescriptions = {},
  subclassDescriptions = {},
  showAppearanceAiButton = false,
  onGenerateAppearance,
  isGeneratingAppearance = false,
  showTabs = true,
}: CharacterSheetFormCoreProps) {
  const c = useColors();

  // Race/class selector state
  const [raceGroup, setRaceGroup] = React.useState(RACE_GROUPS[0].label);
  const [activeParentRace, setActiveParentRace] = React.useState<string | null>(null);

  const currentRaceGroup = useMemo(
    () => RACE_GROUPS.find((g) => g.label === raceGroup) ?? RACE_GROUPS[0],
    [raceGroup],
  );

  const selectedParentRace = useMemo(() => {
    for (const g of RACE_GROUPS) {
      for (const r of g.races) {
        if (r.base === formData.race || r.subraces?.includes(formData.race)) return r;
      }
    }
    return null;
  }, [formData.race]);

  const expandedParentData = useMemo(
    () => RACE_GROUPS.flatMap((g) => g.races).find((r) => r.base === activeParentRace) ?? null,
    [activeParentRace],
  );

  const selectedClassEntry = useMemo(
    () => ALL_CLASSES.find((entry) => entry.name === formData.charClass) ?? null,
    [formData.charClass],
  );

  const ageCategory = useMemo(
    () => (formData.age && formData.race ? computeAgeCategory(Number(formData.age) || 0, formData.race) : null),
    [formData.age, formData.race],
  );

  const lifespan = useMemo(() => getRaceLifespan(formData.race), [formData.race]);

  const rollScores = React.useCallback(() => {
    onChange("str", String(roll4d6DropLowest()));
    onChange("dex", String(roll4d6DropLowest()));
    onChange("con", String(roll4d6DropLowest()));
    onChange("int", String(roll4d6DropLowest()));
    onChange("wis", String(roll4d6DropLowest()));
    onChange("cha", String(roll4d6DropLowest()));
  }, [onChange]);

  return (
    <View>
      {/* Section tabs (conditional) */}
      {showTabs && (
        <View style={[styles.tabRow, { borderBottomColor: c.border, backgroundColor: c.card }]}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => onSectionChange(t.id)}
              style={[styles.tab, { borderBottomColor: section === t.id ? c.primary : "transparent" }]}
            >
              <Text style={[styles.tabText, { color: section === t.id ? c.primary : c.mutedForeground }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* IDENTITY SECTION */}
      {section === "identity" && (
        <View style={styles.section}>
          <FieldRow label="Name">
            <RowInput
              value={formData.name}
              onChange={(v) => onChange("name", v)}
              placeholder="e.g. Brennus Ashbend"
            />
          </FieldRow>

          <FieldRow label="Gender">
            <ChipGroup
              chips={NPC_GENDERS}
              value={formData.gender}
              onChange={(v) => onChange("gender", v)}
            />
          </FieldRow>

          <FieldRow label="Race" hint="Select from preset races or type a custom race">
            <View style={styles.raceSelectorStack}>
              {/* Race group source tabs */}
              <View style={[styles.groupTabPanel, { backgroundColor: c.secondary, borderColor: c.border }]}>
                <Text style={[styles.groupTabHeading, { color: c.mutedForeground }]}>Race source filter</Text>
                <View style={styles.groupTabRow}>
                  {RACE_GROUPS.map((g) => {
                    const active = raceGroup === g.label;
                    const iconName = g.label.toLowerCase().includes("core") ? "book-open" : "layers";
                    return (
                      <TouchableOpacity
                        key={g.label}
                        onPress={() => {
                          setRaceGroup(g.label);
                          setActiveParentRace(null);
                        }}
                        style={[
                          styles.groupTab,
                          {
                            backgroundColor: active ? c.primary : c.background,
                            borderColor: active ? c.primary : c.border,
                          },
                        ]}
                      >
                        <Feather name={iconName} size={12} color={active ? "#fff" : c.mutedForeground} />
                        <Text style={[styles.groupTabText, { color: active ? "#fff" : c.mutedForeground }]}>
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.groupTabHint, { color: c.mutedForeground }]}>Filters the race list below</Text>
              </View>

              {/* Race chips for selected group */}
              <View style={styles.chipRow}>
                {currentRaceGroup.races.map((r: any) => {
                  const isParentSelected = selectedParentRace?.base === r.base;
                  const isExpanded = activeParentRace === r.base;
                  const hasSubraces = (r.subraces?.length ?? 0) > 0;
                  return (
                    <TouchableOpacity
                      key={r.base}
                      onPress={() => {
                        if (hasSubraces) {
                          setActiveParentRace(isExpanded ? null : r.base);
                        } else {
                          onChange("race", r.base);
                          setActiveParentRace(null);
                        }
                      }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isParentSelected ? c.primary + "25" : c.card,
                          borderColor: isParentSelected ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: isParentSelected ? c.primary : c.mutedForeground }]}>
                        {r.base}{hasSubraces ? " ▾" : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Subrace chips */}
              {activeParentRace && expandedParentData?.subraces && (
                <View style={{ gap: 6 }}>
                  <Text style={[styles.fieldHint, { color: c.primary, marginTop: 2 }]}>
                    Choose your {activeParentRace} subrace:
                  </Text>
                  <View style={styles.chipRow}>
                    {expandedParentData.subraces.map((sr: string) => (
                      <TouchableOpacity
                        key={sr}
                        onPress={() => {
                          onChange("race", sr);
                          setActiveParentRace(null);
                        }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: formData.race === sr ? c.primary + "25" : c.secondary,
                            borderColor: formData.race === sr ? c.primary : c.border,
                          },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: formData.race === sr ? c.primary : c.foreground }]}>
                          {sr}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Selected race badge or custom input */}
              {formData.race ? (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.chip, { backgroundColor: c.primary + "20", borderColor: c.primary }]}>
                      <Text style={[styles.chipText, { color: c.primary }]}>✓ {formData.race}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { onChange("race", ""); setActiveParentRace(null); }}>
                      <Text style={{ color: c.mutedForeground, fontSize: 12 }}>clear</Text>
                    </TouchableOpacity>
                  </View>
                  {raceDescriptions[formData.race] && (
                    <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
                      <Feather name="info" size={12} color={c.mutedForeground} style={{ marginTop: 1, flexShrink: 0 }} />
                      <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>
                        {raceDescriptions[formData.race]}
                      </Text>
                    </View>
                  )}
                  {formData.race && (
                    <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
                      <Feather name="clock" size={12} color={c.mutedForeground} style={{ marginTop: 1, flexShrink: 0 }} />
                      <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>
                        {getLifespanHint(formData.race)}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <RowInput
                  value={formData.race}
                  onChange={(v) => onChange("race", v)}
                  placeholder="Or type a custom race…"
                />
              )}
            </View>
          </FieldRow>

          <FieldRow label="Class / Level" hint="Optional — if the character has class levels">
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.chipRow}>
                {ALL_CLASSES.map((cl: any) => (
                  <TouchableOpacity
                    key={cl.name}
                    onPress={() => {
                      onChange("charClass", cl.name);
                      onChange("subclass", "");
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: formData.charClass === cl.name ? c.primary + "25" : c.card,
                        borderColor: formData.charClass === cl.name ? c.primary : c.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: formData.charClass === cl.name ? c.primary : c.mutedForeground }]}>
                      {cl.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {formData.charClass && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.chip, { backgroundColor: c.primary + "20", borderColor: c.primary }]}>
                    <Text style={[styles.chipText, { color: c.primary }]}>✓ {formData.charClass}</Text>
                  </View>
                  <TouchableOpacity onPress={() => onChange("charClass", "")}>
                    <Text style={{ color: c.mutedForeground, fontSize: 12 }}>clear</Text>
                  </TouchableOpacity>
                </View>
              )}

              {classDescriptions[formData.charClass] && (
                <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <Feather name="info" size={12} color={c.mutedForeground} style={{ marginTop: 1, flexShrink: 0 }} />
                  <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>
                    {classDescriptions[formData.charClass]}
                  </Text>
                </View>
              )}

              {selectedClassEntry && (
                <View style={{ gap: 6 }}>
                  <Text style={[styles.fieldHint, { color: c.primary }]}>
                    {selectedClassEntry.subclassLabel ?? "Subclass"} — optional
                  </Text>
                  <View style={styles.chipRow}>
                    {selectedClassEntry.subclasses.map((sc) => (
                      <TouchableOpacity
                        key={sc}
                        onPress={() => onChange("subclass", formData.subclass === sc ? "" : sc)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: formData.subclass === sc ? c.primary + "25" : c.card,
                            borderColor: formData.subclass === sc ? c.primary : c.border,
                          },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: formData.subclass === sc ? c.primary : c.mutedForeground }]}>
                          {sc}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {formData.subclass && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[styles.chip, { backgroundColor: c.primary + "20", borderColor: c.primary }]}>
                        <Text style={[styles.chipText, { color: c.primary }]}>✓ {formData.subclass}</Text>
                      </View>
                      <TouchableOpacity onPress={() => onChange("subclass", "")}>
                        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>clear</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {subclassDescriptions[formData.subclass] && (
                    <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
                      <Feather name="book-open" size={12} color={c.mutedForeground} style={{ marginTop: 1, flexShrink: 0 }} />
                      <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>
                        {subclassDescriptions[formData.subclass]}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Text style={[styles.fieldHint, { color: c.mutedForeground }]}>Level:</Text>
                {[...Array(20)].map((_, i) => {
                  const l = String(i + 1);
                  return (
                    <TouchableOpacity
                      key={l}
                      onPress={() => onChange("level", l)}
                      style={[
                        styles.levelChip,
                        {
                          backgroundColor: formData.level === l ? c.primary : c.card,
                          borderColor: formData.level === l ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: formData.level === l ? "#fff" : c.mutedForeground }}>
                        {l}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </FieldRow>

          <FieldRow label="Age" hint="Enter numeric age; category updates based on race">
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  value={formData.age}
                  onChangeText={(v) => onChange("age", v)}
                  keyboardType="number-pad"
                  placeholder="e.g. 25"
                  placeholderTextColor={c.mutedForeground}
                  style={[
                    styles.rowInput,
                    { color: c.foreground, backgroundColor: c.secondary, borderColor: c.border, flex: 1 },
                  ]}
                />
              </View>
              {ageCategory && formData.age && (
                <View style={{ gap: 4 }}>
                  <Text style={[styles.fieldHint, { color: c.primary }]}>
                    Age Category: <Text style={{ fontWeight: "600" }}>{ageCategory}</Text>
                  </Text>
                </View>
              )}
            </View>
          </FieldRow>

          <FieldRow label="Alignment">
            <View style={styles.alignGrid}>
              {NPC_ALIGNMENTS.map((a) => (
                <TouchableOpacity
                  key={a}
                  onPress={() => onChange("alignment", a)}
                  style={[
                    styles.alignChip,
                    {
                      backgroundColor: formData.alignment === a ? c.primary + "25" : c.card,
                      borderColor: formData.alignment === a ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.alignChipText, { color: formData.alignment === a ? c.primary : c.mutedForeground }]}>
                    {a}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </FieldRow>

          <FieldRow label="Occupation">
            <RowInput
              value={formData.occupation}
              onChange={(v) => onChange("occupation", v)}
              placeholder="Blacksmith, Spy…"
            />
          </FieldRow>

          <FieldRow label="Background">
            <RowInput
              value={formData.background}
              onChange={(v) => onChange("background", v)}
              placeholder="Criminal, Sage…"
            />
          </FieldRow>
        </View>
      )}

      {/* STATS SECTION */}
      {section === "stats" && (
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Ability Scores</Text>
              <TouchableOpacity
                onPress={rollScores}
                style={[styles.randomBtn, { backgroundColor: c.primary }]}
              >
                <Text style={styles.randomBtnText}>Roll 4d6</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.scoreHelp, { color: c.mutedForeground }]}>
              Tap a number to type your own score, or use - / + to change by 1.
            </Text>
            <View style={styles.scoreGrid}>
              {(["str", "dex", "con", "int", "wis", "cha"] as const).map((key) => {
                const labels = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
                const val = Number(formData[key]) || 10;
                const dec = Math.max(1, val - 1);
                const inc = Math.min(30, val + 1);
                const mod = Math.floor((val - 10) / 2);
                const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

                return (
                  <View key={key} style={[styles.scoreBox, { backgroundColor: c.background, borderColor: c.border }]}>
                    <Text style={[styles.scoreLabel, { color: c.mutedForeground }]}>{labels[key]}</Text>
                    <View style={styles.scoreInputRow}>
                      <TouchableOpacity
                        onPress={() => onChange(key, String(dec))}
                        style={[styles.scoreAdjustBtn, { borderColor: c.border, backgroundColor: c.card }]}
                      >
                        <Text style={[styles.scoreAdjustText, { color: c.foreground }]}>-</Text>
                      </TouchableOpacity>
                      <TextInput
                        value={formData[key]}
                        onChangeText={(v) => onChange(key, v)}
                        keyboardType="number-pad"
                        style={[styles.scoreInput, { color: c.foreground }]}
                        maxLength={2}
                      />
                      <TouchableOpacity
                        onPress={() => onChange(key, String(inc))}
                        style={[styles.scoreAdjustBtn, { borderColor: c.border, backgroundColor: c.card }]}
                      >
                        <Text style={[styles.scoreAdjustText, { color: c.foreground }]}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.scoreMod, { color: c.primary }]}>{modStr}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* PERSONALITY SECTION */}
      {section === "personality" && (
        <View style={styles.section}>
          <FieldRow label="Personality Trait 1">
            <RowInput
              value={formData.personalityTrait1}
              onChange={(v) => onChange("personalityTrait1", v)}
              multiline
              placeholder="How they act…"
            />
            <RollBtn onPress={() => onChange("personalityTrait1", roll(NPC_PERSONALITY_TRAITS))} />
          </FieldRow>

          <FieldRow label="Personality Trait 2">
            <RowInput
              value={formData.personalityTrait2}
              onChange={(v) => onChange("personalityTrait2", v)}
              multiline
              placeholder="Another quirk…"
            />
            <RollBtn onPress={() => onChange("personalityTrait2", roll(NPC_PERSONALITY_TRAITS))} />
          </FieldRow>

          <FieldRow label="Ideal">
            <RowInput
              value={formData.ideal}
              onChange={(v) => onChange("ideal", v)}
              multiline
              placeholder="What drives them…"
            />
            <RollBtn onPress={() => onChange("ideal", roll(NPC_IDEALS))} />
          </FieldRow>

          <FieldRow label="Bond">
            <RowInput
              value={formData.bond}
              onChange={(v) => onChange("bond", v)}
              multiline
              placeholder="What they care about…"
            />
            <RollBtn onPress={() => onChange("bond", roll(NPC_BONDS))} />
          </FieldRow>

          <FieldRow label="Flaw">
            <RowInput
              value={formData.flaw}
              onChange={(v) => onChange("flaw", v)}
              multiline
              placeholder="Their weakness…"
            />
            <RollBtn onPress={() => onChange("flaw", roll(NPC_FLAWS))} />
          </FieldRow>
        </View>
      )}

      {/* APPEARANCE SECTION */}
      {section === "appearance" && (
        <View style={styles.section}>
          <FieldRow label="Appearance" hint="Best generated after identity and traits are filled.">
            <RowInput
              value={formData.appearance}
              onChange={(v) => onChange("appearance", v)}
              multiline
              placeholder="Distinctive features, clothing, and visible details…"
            />
            <RollBtn onPress={() => onChange("appearance", roll(NPC_APPEARANCE))} />
          </FieldRow>

          {showAppearanceAiButton && onGenerateAppearance && (
            <TouchableOpacity
              onPress={onGenerateAppearance}
              disabled={isGeneratingAppearance}
              style={[
                styles.aiAppearanceBtn,
                { opacity: isGeneratingAppearance ? 0.6 : 1 },
              ]}
            >
              <Feather name="cpu" size={15} color={c.primary} />
              <Text style={[styles.aiAppearanceBtnText, { color: c.primary }]}>
                {isGeneratingAppearance ? "Generating appearance..." : "AI Generate Appearance"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: c.foreground }]}>{label}</Text>
      {hint && <Text style={[styles.fieldHint, { color: c.mutedForeground }]}>{hint}</Text>}
      <View style={styles.fieldInput}>{children}</View>
    </View>
  );
}

function RowInput({
  value, onChange, placeholder, multiline,
}: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  const c = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.mutedForeground}
      multiline={multiline}
      style={[
        styles.rowInput,
        { color: c.foreground, backgroundColor: c.secondary, borderColor: c.border },
        multiline && { minHeight: 72, textAlignVertical: "top" },
      ]}
    />
  );
}

function RollBtn({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.rollBtn, { backgroundColor: c.primary + "20", borderColor: c.primary + "60" }]}
    >
      <Text style={[styles.rollBtnText, { color: c.primary }]}>🎲</Text>
    </TouchableOpacity>
  );
}

function ChipGroup({ chips, value, onChange }: { chips: readonly string[]; value: string; onChange: (v: string) => void }) {
  const c = useColors();
  return (
    <View style={styles.chipGroup}>
      {chips.map((chip) => (
        <TouchableOpacity
          key={chip}
          onPress={() => onChange(chip)}
          style={[
            styles.chip,
            {
              backgroundColor: value === chip ? c.primary + "25" : c.card,
              borderColor: value === chip ? c.primary : c.border,
            },
          ]}
        >
          <Text style={[styles.chipText, { color: value === chip ? c.primary : c.mutedForeground }]}>
            {chip}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontWeight: "600" },

  section: { gap: 14, padding: 16 },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  fieldHint: { fontSize: 11, marginTop: -2 },
  fieldInput: { flexDirection: "row", alignItems: "flex-start", gap: 8 },

  rowInput: {
    flex: 1, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14,
  },
  rollBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  rollBtnText: { fontSize: 18 },

  randomBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
  },
  randomBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipGroup: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "500" },

  aiAppearanceBtn: {
    marginTop: -4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderColor: "#3b82f6",
    backgroundColor: "#3b82f622",
  },
  aiAppearanceBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },

  alignGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  alignChip: {
    paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1, minWidth: 48, alignItems: "center",
  },
  alignChipText: { fontSize: 10, fontWeight: "700" },

  groupTabPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  groupTabHeading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  groupTabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  groupTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  groupTabText: { fontSize: 12, fontWeight: "600" },
  groupTabHint: { fontSize: 11 },

  raceSelectorStack: {
    width: "100%",
    gap: 8,
  },

  infoCard: { flexDirection: "row", gap: 7, padding: 10, borderRadius: 10, borderWidth: 1 },
  infoCardText: { flex: 1, fontSize: 12, lineHeight: 18 },

  levelChip: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  card: {
    borderWidth: 1, borderRadius: 15, padding: 14, gap: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  scoreHelp: { fontSize: 11, marginTop: -4, marginBottom: 2 },

  scoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    columnGap: 8,
    width: "100%",
    paddingHorizontal: 8,
  },
  scoreBox: {
    width: "24.8%",
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center", justifyContent: "center", gap: 0,
  },
  scoreLabel: { fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  scoreInputRow: { flexDirection: "row", alignItems: "center", gap: 1 },
  scoreAdjustBtn: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  scoreAdjustText: { fontSize: 18, fontWeight: "700", lineHeight: 18 },
  scoreInput: { fontSize: 27, fontWeight: "800", textAlign: "center", width: 40, paddingVertical: 0 },
  scoreMod: { fontSize: 18, fontWeight: "600" },
});
