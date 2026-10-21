import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Resource } from "@/types";
import * as Haptics from "expo-haptics";
import { createShadowStyle } from "../../utils/shadow";

interface ResourceRowProps {
  resource: Resource;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
  /** Extra max from equipped item effects (e.g. +3 Ki from an amulet) */
  extraMax?: number;
}

const RESET_LABELS: Record<string, string> = {
  short_rest: "Short Rest",
  long_rest: "Long Rest",
  dawn: "Dawn",
  custom: "Custom",
};

export function ResourceRow({
  resource,
  onIncrement,
  onDecrement,
  onReset,
  extraMax = 0,
}: ResourceRowProps) {
  const c = useColors();
  const accentColor = resource.color ?? c.primary;
  const effectiveMax = resource.max + extraMax;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderRadius: c.radius * 1.5,
          borderLeftColor: accentColor,
        },
      ]}
    >
      {/* Header: name/notes on left, count badge on right */}
      <View style={styles.header}>
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.foreground }]}>{resource.name}</Text>
          {resource.notes && (
            <Text style={[styles.notes, { color: c.mutedForeground }]} numberOfLines={1}>
              {resource.notes}
            </Text>
          )}
        </View>
        <View style={styles.countBadge}>
          <Text style={[styles.countText, { color: accentColor }]}>{resource.current}</Text>
          <Text style={[styles.countMax, { color: c.mutedForeground }]}>/{effectiveMax}</Text>
          {extraMax > 0 && (
            <Text style={[styles.extraLabel, { color: accentColor }]}>+{extraMax}</Text>
          )}
        </View>
      </View>

      {/* Pip circles — tap to use, long-press to restore */}
      <View style={styles.pipsRow}>
        {Array.from({ length: effectiveMax }).map((_, i) => {
          const isSpent = i >= resource.current;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => {
                if (!isSpent) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onDecrement();
                }
              }}
              onLongPress={() => {
                if (isSpent) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onIncrement();
                }
              }}
              activeOpacity={0.7}
              delayLongPress={400}
              style={[
                styles.pip,
                {
                  backgroundColor: isSpent ? c.muted : `${accentColor}30`,
                  borderColor: isSpent ? c.border : accentColor,
                },
              ]}
            >
              {!isSpent && (
                <View style={[styles.pipInner, { backgroundColor: accentColor }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.resetLabel, { color: c.mutedForeground }]}>
          Resets on: {RESET_LABELS[resource.resetOn]}
        </Text>
        <TouchableOpacity onPress={onReset} activeOpacity={0.7}>
          <Text style={[styles.resetBtn, { color: accentColor }]}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
    ...createShadowStyle({ y: 1, blur: 3, opacity: 0.12, elevation: 2 }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  notes: {
    fontSize: 11,
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
  },
  countText: {
    fontSize: 16,
    fontWeight: "700",
  },
  countMax: {
    fontSize: 13,
    fontWeight: "500",
  },
  extraLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 3,
  },
  pipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  pip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pipInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resetLabel: {
    fontSize: 11,
  },
  resetBtn: {
    fontSize: 12,
    fontWeight: "600",
  },
});
