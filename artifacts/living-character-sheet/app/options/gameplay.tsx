import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { useAppSettings } from "@/context/AppSettingsContext";
import colors from "@/constants/colors";

export default function GameplayOptionsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useAppSettings();
  const topPad = Platform.OS === "web" ? 16 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}> 
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: c.border }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>Gameplay</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollHintScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader label="GENERAL" />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
          <ToggleRow
            label="Snarky Parse Mode"
            desc="Adds cheeky AI flavor text for parsed loot/updates (consensual, non-abusive tone)"
            value={settings.snarkyParseMode}
            onChange={(v) => updateSettings({ snarkyParseMode: v })}
            trackColor={c.primary}
          />
        </View>

        <SectionHeader label="COMBAT AND PARTY CONTEXT CONTROLS" />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
          <ToggleRow
            label="Auto-roll Concentration Save"
            desc="Also controllable in the Combat HUD. When enabled, concentration checks auto-roll in combat."
            value={settings.autoConcentrationSave}
            onChange={(v) => updateSettings({ autoConcentrationSave: v })}
            trackColor={c.primary}
          />
          <Divider color={c.border} />
          <ToggleRow
            label="Disable Party Card Themes"
            desc="Also controllable in Party and DM Party headers. Turns off per-member card theme accents."
            value={settings.disablePartyCardThemes}
            onChange={(v) => updateSettings({ disablePartyCardThemes: v })}
            trackColor={c.primary}
          />
          <Divider color={c.border} />
          <ToggleRow
            label="Party Event Pills"
            desc="Show popup pills for DM roll prompts and party event updates"
            value={settings.showPartyEventPills}
            onChange={(v) => updateSettings({ showPartyEventPills: v })}
            trackColor={c.primary}
          />
        </View>

        <SectionHeader label="PROGRESSION, HELP, AND CONFIRMATIONS" />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
          <ToggleRow
            label="Auto-open Level Up"
            desc="Automatically opens level-up wizard when queued levels exist"
            value={settings.autoOpenLevelUpModal}
            onChange={(v) => updateSettings({ autoOpenLevelUpModal: v })}
            trackColor={c.primary}
          />
          <Divider color={c.border} />
          <ToggleRow
            label="Inspect Mode"
            desc="When enabled, long-pressing any labeled surface shows a popup explaining what it is and how it works"
            value={settings.inspectModeEnabled}
            onChange={(v) => updateSettings({ inspectModeEnabled: v })}
            trackColor={c.primary}
          />
          <Divider color={c.border} />
          <ToggleRow
            label="Long-Press Help Popups"
            desc="Show hardcoded quick explanations for sheet basics when you long-press stats"
            value={settings.enableLongPressHelpPopups}
            onChange={(v) => updateSettings({ enableLongPressHelpPopups: v })}
            trackColor={c.primary}
          />
          <Divider color={c.border} />
          <ToggleRow
            label="Click-and-Hold Info Hints"
            desc="Show helper hint text where click-and-hold or press-and-hold info is available"
            value={settings.showHoldToInfoHints}
            onChange={(v) => updateSettings({ showHoldToInfoHints: v })}
            trackColor={c.primary}
          />
          <Divider color={c.border} />
          <ToggleRow
            label="Scroll Hint Pills"
            desc="Show temporary scroll hint pills on supported long pages and modal sheets"
            value={settings.showScrollHints}
            onChange={(v) => updateSettings({ showScrollHints: v })}
            trackColor={c.primary}
          />
          <Divider color={c.border} />
          <ToggleRow
            label="Confirm Display Reset"
            desc='Require confirmation before using "Return Display to Default" in this screen.'
            value={settings.confirmBeforeDangerousActions}
            onChange={(v) => updateSettings({ confirmBeforeDangerousActions: v })}
            trackColor={c.primary}
          />
          <Divider color={c.border} />
          <ToggleRow
            label="Confirm DM Deletes"
            desc="Show confirmation popups before deleting notes, quests, people, or locations in DM Notes"
            value={settings.confirmDmDeleteActions}
            onChange={(v) => updateSettings({ confirmDmDeleteActions: v })}
            trackColor={c.primary}
          />
        </View>

        <SectionHeader label="CHARACTER CREATION" />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <ToggleRow
            label="Disable Starting Gold Cap"
            desc="Allow the free-choice gear budget to be exceeded during character creation (advisory mode instead of hard limit)"
            value={settings.disableStartingGoldCap ?? false}
            onChange={(v) => updateSettings({ disableStartingGoldCap: v })}
            trackColor={c.primary}
          />
        </View>
      </ScrollHintScrollView>
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  const c = useColors();
  return <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>{label}</Text>;
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
  trackColor,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  trackColor: string;
}) {
  const c = useColors();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.settingLabel, { color: c.foreground }]}>{label}</Text>
        {desc ? <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>{desc}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.muted, true: trackColor }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={c.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700" },
  scrollContent: { padding: 16, gap: 0 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: colors.radius * 1.15,
    padding: 12,
    gap: 10,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
  settingLabel: { fontSize: 14, fontWeight: "600" },
  settingDesc: { fontSize: 12, lineHeight: 16 },
  divider: {
    height: 1,
    borderRadius: 1,
    opacity: 0.7,
  },
});
