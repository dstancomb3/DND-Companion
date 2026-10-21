import React, { useMemo, useState } from "react";
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { AiDmDifficultyProfile, AiDmStylePreset } from "@/types";

const DIFFICULTY_OPTIONS: Array<{ label: string; value: AiDmDifficultyProfile }> = [
  { label: "Story", value: "story" },
  { label: "Balanced", value: "balanced" },
  { label: "Tactical", value: "tactical" },
  { label: "Deadly", value: "deadly" },
];

const STYLE_OPTIONS: Array<{ label: string; value: AiDmStylePreset }> = [
  { label: "Cinematic", value: "cinematic" },
  { label: "Grounded", value: "grounded" },
  { label: "Heroic", value: "heroic" },
  { label: "Grim", value: "grim" },
  { label: "Mystery", value: "mystery" },
];

export interface AiDmOneOffSetupValues {
  title: string;
  guidanceText: string;
  difficultyProfile: AiDmDifficultyProfile;
  stylePreset: AiDmStylePreset;
  startInCombat: boolean;
}

export interface AiDmOneOffSetupFormProps {
  onSubmit: (values: AiDmOneOffSetupValues) => void;
}

export function AiDmOneOffSetupForm({ onSubmit }: AiDmOneOffSetupFormProps) {
  const c = useColors();
  const [title, setTitle] = useState("Bandit Ambush at Dusk");
  const [guidanceText, setGuidanceText] = useState("");
  const [difficultyProfile, setDifficultyProfile] = useState<AiDmDifficultyProfile>("balanced");
  const [stylePreset, setStylePreset] = useState<AiDmStylePreset>("cinematic");
  const [startInCombat, setStartInCombat] = useState(false);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card }]}> 
      <Text style={[styles.sectionTitle, { color: c.foreground }]}>One-Off Encounter Setup</Text>
      <Text style={[styles.sectionBody, { color: c.mutedForeground }]}>Start a bounded single-session encounter flow. Campaign continuity remains out of scope.</Text>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: c.foreground }]}>Encounter Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Enter encounter title"
          placeholderTextColor={c.mutedForeground}
          style={[styles.input, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]}
          autoCorrect={false}
          maxLength={72}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: c.foreground }]}>Encounter Guidance (Optional)</Text>
        <TextInput
          value={guidanceText}
          onChangeText={setGuidanceText}
          placeholder="Describe how you want the encounter to feel or unfold"
          placeholderTextColor={c.mutedForeground}
          style={[
            styles.input,
            styles.guidanceInput,
            { color: c.foreground, borderColor: c.border, backgroundColor: c.background },
          ]}
          autoCorrect
          multiline
          textAlignVertical="top"
          maxLength={320}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: c.foreground }]}>Difficulty</Text>
        <View style={styles.chipRow}>
          {DIFFICULTY_OPTIONS.map((option) => {
            const active = difficultyProfile === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? c.primary : c.border,
                    backgroundColor: active ? c.primary + "1A" : c.background,
                  },
                ]}
                onPress={() => setDifficultyProfile(option.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, { color: active ? c.primary : c.foreground }]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: c.foreground }]}>Narrative Style</Text>
        <View style={styles.chipRow}>
          {STYLE_OPTIONS.map((option) => {
            const active = stylePreset === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? c.primary : c.border,
                    backgroundColor: active ? c.primary + "1A" : c.background,
                  },
                ]}
                onPress={() => setStylePreset(option.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, { color: active ? c.primary : c.foreground }]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.toggleRow, { borderColor: c.border, backgroundColor: c.background }]}> 
        <View style={styles.toggleLabelWrap}>
          <Text style={[styles.fieldLabel, { color: c.foreground }]}>Start in Combat Submode</Text>
          <Text style={[styles.toggleHint, { color: c.mutedForeground }]}>Preps session with combat-first intent only.</Text>
        </View>
        <Switch
          value={startInCombat}
          onValueChange={setStartInCombat}
          thumbColor={startInCombat ? c.primary : c.mutedForeground}
          trackColor={{ false: c.border, true: c.primary + "66" }}
        />
      </View>

      <TouchableOpacity
        onPress={() =>
          onSubmit({
            title,
            guidanceText,
            difficultyProfile,
            stylePreset,
            startInCombat,
          })
        }
        style={[
          styles.submitButton,
          { backgroundColor: canSubmit ? c.primary : c.muted, opacity: canSubmit ? 1 : 0.65 },
        ]}
        activeOpacity={0.85}
        disabled={!canSubmit}
      >
        <Text style={[styles.submitText, { color: c.primaryForeground }]}>Start One-Off Session</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  guidanceInput: {
    minHeight: 88,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabelWrap: {
    flex: 1,
    gap: 3,
  },
  toggleHint: {
    fontSize: 12,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  submitText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
