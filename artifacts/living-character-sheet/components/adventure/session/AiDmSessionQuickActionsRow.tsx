import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { AiDmQuickActionKey } from "@/utils/adventure/aiDmSessionFeedScaffold";

const NARRATION_ACTIONS: Array<{ key: AiDmQuickActionKey; label: string }> = [
  { key: "advance_scene", label: "Advance Scene" },
  { key: "offer_choices", label: "Offer Choices" },
  { key: "resolve_turn", label: "Resolve Turn" },
];

const BOUNDED_ACTIONS: Array<{ key: AiDmQuickActionKey; label: string }> = [
  { key: "start_combat", label: "Start Combat" },
  { key: "loot_hook", label: "Loot Hook" },
  { key: "end_encounter", label: "End Encounter" },
];

export interface AiDmSessionQuickActionsRowProps {
  onAction: (key: AiDmQuickActionKey) => void;
}

export function AiDmSessionQuickActionsRow({ onAction }: AiDmSessionQuickActionsRowProps) {
  const c = useColors();

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card }]}> 
      <Text style={[styles.label, { color: c.foreground }]}>Quick Actions</Text>
      <Text style={[styles.helper, { color: c.mutedForeground }]}>Narration actions continue the scene. Bounded actions stay outcome-driven.</Text>
      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: c.mutedForeground }]}>Narration</Text>
        <View style={styles.row}>
          {NARRATION_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.key}
              onPress={() => onAction(action.key)}
              activeOpacity={0.82}
              style={[styles.actionChip, { borderColor: c.primary + "55", backgroundColor: c.primary + "10" }]}
            >
              <Text style={[styles.actionText, { color: c.primary }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: c.mutedForeground }]}>Bounded outcomes</Text>
        <View style={styles.row}>
          {BOUNDED_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.key}
              onPress={() => onAction(action.key)}
              activeOpacity={0.82}
              style={[styles.actionChip, { borderColor: c.border, backgroundColor: c.background }]}
            >
              <Text style={[styles.actionText, { color: c.foreground }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
  helper: {
    fontSize: 11,
    lineHeight: 15,
  },
  group: {
    gap: 6,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
