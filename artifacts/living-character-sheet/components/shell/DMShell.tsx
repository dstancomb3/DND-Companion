import React from "react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Props = {
  pathname: string;
  enabled?: boolean;
};

type NavItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  href: string;
  active: boolean;
};

export function DMShell({ pathname, enabled = false }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const [menuHidden, setMenuHidden] = React.useState(true);
  const toggleBottom = Platform.OS === "web" ? 16 : Math.max(insets.bottom + 14, 16);
  const toggleRight = 14;
  const toggleWidth = compact ? 124 : 144;

  const primaryItems: NavItem[] = [
    {
      key: "dm-party",
      label: "DM Party",
      icon: "users",
      href: "/dm-party",
      active: pathname.startsWith("/dm-party"),
    },
    {
      key: "dm-notes",
      label: "Notes",
      icon: "book-open",
      href: "/dm-notes",
      active: pathname.startsWith("/dm-notes"),
    },
    {
      key: "dm-npc",
      label: "NPCs",
      icon: "user-plus",
      href: "/dm-npc",
      active: pathname.startsWith("/dm-npc"),
    },
    {
      key: "dm-item",
      label: "Item Forge",
      icon: "package",
      href: "/dm-item",
      active: pathname.startsWith("/dm-item"),
    },
    {
      key: "dm-monsters",
      label: "Monster Tools",
      icon: "shield",
      href: "/dm-monsters",
      active: pathname.startsWith("/dm-monsters"),
    },
  ];

  if (!enabled || !pathname.startsWith("/dm-")) return null;

  return (
    <>
      {!menuHidden ? (
        <View
          testID="dm-shell"
          style={[
            styles.overlay,
            {
              left: 0,
              right: 0,
              bottom: toggleBottom,
              paddingRight: toggleRight + toggleWidth + 10,
              pointerEvents: "box-none",
            },
          ]}
        >
          <View style={[styles.topMenuBar, compact ? styles.panelCompact : null, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radiusLg }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.primaryRow}
            >
              {primaryItems.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => router.push(item.href as never)}
                  activeOpacity={0.82}
                  style={[
                    styles.navChip,
                    {
                      backgroundColor: item.active ? c.primary + "22" : c.background,
                      borderColor: item.active ? c.primary + "66" : c.border,
                      borderRadius: c.radiusPill,
                    },
                  ]}
                >
                  <Feather name={item.icon} size={14} color={item.active ? c.primary : c.mutedForeground} />
                  <Text style={[styles.navText, { color: item.active ? c.primary : c.foreground }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}

      <View style={[styles.floatingToggleWrap, { right: toggleRight, bottom: toggleBottom, pointerEvents: "box-none" }]}>
        <TouchableOpacity
          onPress={() => setMenuHidden((value) => !value)}
          activeOpacity={0.85}
          style={[
            styles.floatingToggle,
            {
              borderColor: c.border,
              backgroundColor: c.card,
              width: toggleWidth,
              borderRadius: c.radiusPill,
            },
          ]}
        >
          <Feather name={menuHidden ? "eye" : "eye-off"} size={14} color={c.foreground} />
          <Text style={[styles.floatingToggleText, { color: c.foreground }]}>{menuHidden ? "Show DM Menu" : "Hide DM Menu"}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    paddingHorizontal: 12,
    zIndex: 24,
    gap: 6,
  },
  topMenuBar: {
    borderWidth: 1,
    padding: 8,
    maxWidth: 980,
    alignSelf: "center",
    width: "100%",
  },
  panelCompact: {
    padding: 10,
  },
  primaryRow: {
    gap: 8,
  },
  navChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  navText: {
    fontSize: 12,
    fontWeight: "700",
  },
  floatingToggleWrap: {
    position: "absolute",
    zIndex: 25,
  },
  floatingToggle: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  floatingToggleText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
