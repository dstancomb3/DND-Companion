import React, { useMemo } from "react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import type { ShellContextState } from "@/components/shell/ShellContextRouter";

type Props = {
  shell: "player" | "dm";
  pathname: string;
  state: ShellContextState;
  enabled?: boolean;
};

type Action = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
};

export function UnifiedUtilityMenu({ shell, pathname, state, enabled = false }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  // Matches the tabBarStyle height in (tabs)/_layout.tsx
  const tabBarHeight = Platform.OS === "web" ? 74 : 54 + Math.max(insets.bottom, 1);

  const actions = useMemo<Action[]>(() => {
    if (shell !== "player") return [];

    const nextActions: Action[] = [];
    const showQuickUpdate =
      pathname === "/" ||
      pathname.includes("/sheet") ||
      pathname.includes("/attacks") ||
      pathname.includes("/notes");

    if (showQuickUpdate) {
      const label = pathname.includes("/attacks")
        ? "Battle Update"
        : pathname.includes("/notes")
          ? "Update From Notes"
          : "Quick Update";

      nextActions.push({
        key: "quick-update",
        label,
        icon: "edit-3",
        onPress: () => router.push("/(tabs)/quick-update"),
      });
    }

    if (pathname.includes("/inventory") && !state.lootReviewActive) {
      nextActions.push({
        key: "loot-review",
        label: "Loot Generator",
        icon: "camera",
        onPress: () => router.push({ pathname: "/loot-generator", params: { tab: "photo_text" } }),
      });
    }

    if (!pathname.includes("/log")) {
      nextActions.push({
        key: "log",
        label: "History",
        icon: "clock",
        onPress: () => router.push("/(tabs)/log"),
      });
    }

    return nextActions.slice(0, 2);
  }, [pathname, shell, state.lootReviewActive]);

  if (!enabled || actions.length === 0) return null;

  const isNotesRoute = pathname.includes("/notes");
  const isTabbedPlayerRoute =
    pathname === "/" ||
    pathname.includes("/attacks") ||
    pathname.includes("/inventory") ||
    pathname.includes("/notes");
  const bottomOffset = isTabbedPlayerRoute
    ? (Platform.OS === "web" ? 96 : 72 + insets.bottom)
    : 16 + insets.bottom;

  if (isNotesRoute) {
    // Stack pills vertically, right-aligned to the left edge of the FAB (right:20, width:56 → left edge at right:76, +8px gap = right:84)
    const fabBottom = tabBarHeight + 8;
    return (
      <View
        style={[styles.dock, { bottom: fabBottom, right: 84 }]}
        pointerEvents="box-none"
      >
        {actions.map((action) => (
          <TouchableOpacity
            key={action.key}
            onPress={action.onPress}
            activeOpacity={0.85}
            style={[styles.dockPill, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radiusPill }]}
          >
            <Feather name={action.icon} size={13} color={c.foreground} />
            <Text style={[styles.text, { color: c.foreground }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.overlay, { bottom: bottomOffset, right: 12, pointerEvents: "box-none" }]}>
      <View style={styles.group}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.key}
            onPress={action.onPress}
            activeOpacity={0.85}
            style={[styles.pill, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radiusPill }]}
          >
            <Feather name={action.icon} size={14} color={c.foreground} />
            <Text style={[styles.text, { color: c.foreground }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    zIndex: 20,
  },
  group: {
    gap: 8,
    alignItems: "flex-end",
  },
  dock: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 20,
    pointerEvents: "box-none",
  },
  dockPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
