import React, { useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useHelpPopup } from "@/hooks/useHelpPopup";
import { shouldUseInspectMode } from "@/utils/inspectModePolicy";

interface StatRowProps {
  label: string;
  value: string | number;
  valueColor?: string;
  bold?: boolean;
  compact?: boolean;
  onLongPress?: () => void;
  /** Inspect Mode: title shown in the popup when Inspect Mode is on */
  inspectTitle?: string;
  /** Inspect Mode: body text shown in the popup when Inspect Mode is on */
  inspectBody?: string;
}

export function StatRow({ label, value, valueColor, bold, compact, onLongPress, inspectTitle, inspectBody }: StatRowProps) {
  const colors = useColors();
  const { settings } = useAppSettings();
  const { showHelp, helpPopup } = useHelpPopup();

  const useInspect = shouldUseInspectMode({
    inspectModeEnabled: settings.inspectModeEnabled,
    helpPopupsEnabled: settings.enableLongPressHelpPopups,
    hasInspectInfo: !!(inspectTitle && inspectBody),
  });

  const resolvedLongPress = useInspect
    ? () => showHelp(inspectTitle!, inspectBody!)
    : onLongPress;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          style={[styles.row, compact && styles.compact]}
        >
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
          <Text
            style={[
              styles.value,
              { color: valueColor ?? colors.foreground },
              bold && styles.bold,
            ]}
          >
            {value}
          </Text>
        </TouchableOpacity>
        {helpPopup}
      </>
    );
  }

  return (
    <View style={[styles.row, compact && styles.compact]}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          styles.value,
          { color: valueColor ?? colors.foreground },
          bold && styles.bold,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  compact: {
    paddingVertical: 5,
  },
  label: {
    fontSize: 14,
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
  },
  bold: {
    fontWeight: "700",
  },
});
