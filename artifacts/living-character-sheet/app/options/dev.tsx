import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { useAppSettings } from "@/context/AppSettingsContext";
import colors from "@/constants/colors";

export default function DevOptionsScreen() {
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
        <Text style={[styles.headerTitle, { color: c.foreground }]}>Dev</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollHintScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>DETERMINISTIC DEBUG TOGGLES</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
          <ToggleRow
            label="Show Deterministic Coverage Details"
            desc="Display implementation-status badges and deterministic engine notes in level-up flows"
            value={settings.showDevDeterministicDetails}
            onChange={(v) => updateSettings({ showDevDeterministicDetails: v })}
            trackColor={c.primary}
          />
          <Divider color={c.border} />
          <ToggleRow
            label="Show Level-Up Rebuild Steps"
            desc="Display internal deterministic rebuild details in the level-up modal"
            value={settings.showDevRebuildSteps}
            onChange={(v) => updateSettings({ showDevRebuildSteps: v })}
            trackColor={c.primary}
          />
          <Divider color={c.border} />
          <ToggleRow
            label="Show Landing Demo Content"
            desc="Reveal demo character shortcuts and Demo Party Bootstrap on the landing Player tab"
            value={settings.showDevLandingDemoContent}
            onChange={(v) => updateSettings({ showDevLandingDemoContent: v })}
            trackColor={c.primary}
          />
        </View>

        <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>FEATURE FLAG INFORMATION</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
          <Text style={[styles.settingLabel, { color: c.foreground }]}>Experimental Feature Flags</Text>
          <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Feature flags remain dev-only in this phase. They are stored separately in localStorage and are not part of normal app settings.</Text>
        </View>
      </ScrollHintScrollView>
    </View>
  );
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
