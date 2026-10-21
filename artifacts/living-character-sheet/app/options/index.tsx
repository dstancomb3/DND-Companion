import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import colors from "@/constants/colors";

const NAV_ITEMS = [
  {
    title: "Display",
    description: "Themes, presets, text, layout, effects, and visual display settings.",
    icon: "monitor",
    route: "/options/display",
  },
  {
    title: "Gameplay",
    description: "General play flow controls, combat/party shared settings, and confirmations.",
    icon: "sliders",
    route: "/options/gameplay",
  },
  {
    title: "Dev",
    description: "Deterministic debug toggles and advanced feature-flag information.",
    icon: "tool",
    route: "/options/dev",
  },
  {
    title: "JSON Architecture",
    description: "Character and item JSON import/export architecture reference.",
    icon: "file-text",
    route: "/options/json-architecture",
  },
] as const;

export default function OptionsHubScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 16 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}> 
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: c.border }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>Options</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollHintScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>SETTINGS HUB</Text>
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.84}
            style={[styles.navCard, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={[styles.navIcon, { backgroundColor: c.primary + "20" }]}> 
              <Feather name={item.icon as any} size={16} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.navTitle, { color: c.foreground }]}>{item.title}</Text>
              <Text style={[styles.navDesc, { color: c.mutedForeground }]}>{item.description}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={c.mutedForeground} />
          </TouchableOpacity>
        ))}
        <Text style={[styles.sectionHeader, { color: c.mutedForeground, marginTop: 16 }]}>ABOUT</Text>
        <View style={[styles.aboutCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutTitle, { color: c.foreground }]}>D&D Companion</Text>
            <View style={[styles.versionBadge, { backgroundColor: c.secondary }]}>
              <Text style={[styles.versionText, { color: c.mutedForeground }]}>v0.2.0</Text>
            </View>
          </View>
          <Text style={[styles.aboutDesc, { color: c.mutedForeground }]}>A D&D 5e companion app with AI-powered loot analysis, smart resource tracking, quick action parsing, and full multi-character support.</Text>
        </View>
      </ScrollHintScrollView>
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
  scrollContent: { padding: 16, gap: 10 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 6,
    marginLeft: 4,
  },
  navCard: {
    borderWidth: 1,
    borderRadius: colors.radius * 1.1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  navDesc: { fontSize: 12, lineHeight: 17 },
  aboutCard: {
    borderWidth: 1,
    borderRadius: colors.radius * 1.1,
    padding: 14,
    gap: 10,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aboutTitle: { fontSize: 14, fontWeight: "600" },
  versionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  versionText: { fontSize: 11, fontWeight: "700" },
  aboutDesc: { fontSize: 12, lineHeight: 16 },
});
