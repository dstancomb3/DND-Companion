import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useColors } from "@/hooks/useColors";
import { useToastAnimation } from "@/hooks/useToastAnimation";
import { createShadowStyle } from "@/utils/shadow";

export function StatusEventPill() {
  const { statusPill, clearStatusPill } = useCharacter();
  const { settings } = useAppSettings();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { animatedStyle } = useToastAnimation({
    visible: Boolean(statusPill),
    dismissAfterMs: 5000,
    onDismiss: clearStatusPill,
    entryOpacityDuration: 180,
    entryTranslateDuration: 220,
    exitDuration: 260,
    motionIntensity: settings.motionIntensity,
    motionsEnabled: settings.motions?.enabled,
  });

  if (!statusPill) return null;

  const isTop = settings.statusPillPosition === "top";

  const toneColor =
    statusPill.tone === "positive"
      ? c.primary
      : statusPill.tone === "negative"
      ? c.destructive
      : c.primary;

  const iconName =
    statusPill.tone === "positive"
      ? "check-circle"
      : statusPill.tone === "negative"
      ? "minus-circle"
      : "info";

  return (
    <View
      style={[
        styles.host,
        { pointerEvents: "none" },
        isTop
          ? { top: insets.top + 12 }
          : { bottom: insets.bottom + 14 },
      ]}
    > 
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: c.card,
            borderColor: toneColor + "88",
            borderRadius: c.radiusPill,
            ...animatedStyle,
          },
        ]}
      >
        <Feather name={iconName as any} size={14} color={toneColor} />
        <Text numberOfLines={2} style={[styles.text, { color: c.foreground }]}>
          {statusPill.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 14,
    zIndex: 140,
  },
  pill: {
    minWidth: 220,
    maxWidth: 560,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...createShadowStyle({ y: 4, blur: 16, opacity: 0.2, elevation: 7 }),
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
});
