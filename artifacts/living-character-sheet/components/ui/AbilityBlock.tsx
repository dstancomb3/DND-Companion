import React, { useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useHelpPopup } from "@/hooks/useHelpPopup";
import { shouldUseInspectMode } from "@/utils/inspectModePolicy";

interface AbilityBlockProps {
  name: string;
  score: number;
  modifier: number;
  /** Non-zero when an equipped item is adding to this score */
  bonus?: number;
  onLongPress?: () => void;
  /** Inspect Mode: title shown in the popup when Inspect Mode is on */
  inspectTitle?: string;
  /** Inspect Mode: body text shown in the popup when Inspect Mode is on */
  inspectBody?: string;
}

export function AbilityBlock({ name, score, modifier, bonus, onLongPress, inspectTitle, inspectBody }: AbilityBlockProps) {
  const c = useColors();
  const { settings } = useAppSettings();
  const { showHelp, helpPopup } = useHelpPopup();
  const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  const hasBonus = bonus != null && bonus !== 0;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const useInspect = shouldUseInspectMode({
    inspectModeEnabled: settings.inspectModeEnabled,
    helpPopupsEnabled: settings.enableLongPressHelpPopups,
    hasInspectInfo: !!(inspectTitle && inspectBody),
  });

  const resolvedLongPress = useInspect
    ? () => showHelp(inspectTitle!, inspectBody!)
    : onLongPress;

  const startWebHold = () => {
    if (Platform.OS !== "web" || !resolvedLongPress) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      resolvedLongPress();
      holdTimerRef.current = null;
    }, 360);
  };

  const endWebHold = () => {
    if (Platform.OS !== "web") return;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  if (resolvedLongPress) {
    return (
      <>
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={resolvedLongPress}
        onPressIn={Platform.OS === "web" ? startWebHold : undefined}
        onPressOut={Platform.OS === "web" ? endWebHold : undefined}
        onPress={Platform.OS === "web" ? () => undefined : undefined}
        delayLongPress={320}
        style={[
          styles.container,
          {
            backgroundColor: c.card,
            borderColor: hasBonus ? c.primary + "55" : c.border,
            borderRadius: c.radius,
          },
        ]}
      >
        <Text style={[styles.name, { color: c.mutedForeground }]}>{name}</Text>
        <Text style={[styles.modifier, { color: c.primary }]}>{modStr}</Text>
        <Text style={[styles.score, { color: hasBonus ? c.primary : c.mutedForeground }]}>{score}</Text>
        {hasBonus && (
          <View style={[styles.bonusBadge, { backgroundColor: c.primary + "20" }]}>
            <Text style={[styles.bonusText, { color: c.primary }]}>{bonus! > 0 ? `+${bonus}` : bonus}</Text>
          </View>
        )}
      </TouchableOpacity>
      {helpPopup}
      </>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: c.card,
          borderColor: hasBonus ? c.primary + "55" : c.border,
          borderRadius: c.radius,
        },
      ]}
    >
      <Text style={[styles.name, { color: c.mutedForeground }]}>{name}</Text>
      <Text style={[styles.modifier, { color: c.primary }]}>{modStr}</Text>
      <Text style={[styles.score, { color: hasBonus ? c.primary : c.mutedForeground }]}>{score}</Text>
      {hasBonus && (
        <View style={[styles.bonusBadge, { backgroundColor: c.primary + "20" }]}>
          <Text style={[styles.bonusText, { color: c.primary }]}>{bonus! > 0 ? `+${bonus}` : bonus}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1,
    marginHorizontal: 3,
  },
  name: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  modifier: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  score: {
    fontSize: 11,
    fontWeight: "500",
  },
  bonusBadge: {
    marginTop: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  bonusText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
