import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { AiDmOneOffOutcomeState } from "@/utils/adventure/aiDmOneOffOutcomeScaffold";
import type { AiDmOneOffRecapResult } from "@/utils/adventure/aiDmOneOffRecapScaffold";

export interface AiDmSessionOutcomeShellProps {
  outcomeState: AiDmOneOffOutcomeState;
  recap?: AiDmOneOffRecapResult;
  isHandoffApproved: boolean;
  canApplyHandoff: boolean;
  onApproveHandoff: () => void;
  onApplyHandoff: () => void;
  onReset: () => void;
}

export function AiDmSessionOutcomeShell({
  outcomeState,
  recap,
  isHandoffApproved,
  canApplyHandoff,
  onApproveHandoff,
  onApplyHandoff,
  onReset,
}: AiDmSessionOutcomeShellProps) {
  const c = useColors();

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: c.foreground }]}>One-Off Finale</Text>
        <View
          style={[
            styles.badge,
            {
              borderColor: outcomeState.status === "encounter_closed" ? c.primary : c.border,
              backgroundColor: outcomeState.status === "encounter_closed" ? c.primary + "1A" : c.background,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: outcomeState.status === "encounter_closed" ? c.primary : c.mutedForeground },
            ]}
          >
            {outcomeState.status === "idle"
              ? "Idle"
              : outcomeState.status === "loot_ready"
                ? "Loot Ready"
                : "Encounter Closed"}
          </Text>
        </View>
      </View>

      <Text style={[styles.body, { color: c.mutedForeground }]}>{outcomeState.summary}</Text>

      {outcomeState.lootPreview ? (
        <View style={[styles.previewCard, { borderColor: c.border, backgroundColor: c.background }]}>
          <Text style={[styles.previewTitle, { color: c.foreground }]}>Reward Preview ({outcomeState.lootPreview.rewardTier})</Text>
          {outcomeState.lootPreview.rewardLines.map((line, index) => (
            <Text key={`${line}-${index}`} style={[styles.previewLine, { color: c.mutedForeground }]}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {outcomeState.closedAt ? (
        <Text style={[styles.closedStamp, { color: c.mutedForeground }]}>Closed at {new Date(outcomeState.closedAt).toLocaleTimeString()}</Text>
      ) : null}

      {recap ? (
        <View style={[styles.previewCard, { borderColor: c.border, backgroundColor: c.background }]}>
          <Text style={[styles.previewTitle, { color: c.foreground }]}>Session Recap</Text>
          {recap.recapLines.map((line, index) => (
            <Text key={`${line}-${index}`} style={[styles.previewLine, { color: c.mutedForeground }]}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {recap ? (
        <View style={[styles.previewCard, { borderColor: c.border, backgroundColor: c.background }]}>
          <Text style={[styles.previewTitle, { color: c.foreground }]}>Archive Summary</Text>
          <Text style={[styles.previewLine, { color: c.mutedForeground }]}>Session: {recap.handoff.sessionId}</Text>
          <Text style={[styles.previewLine, { color: c.mutedForeground }]}>Schema: {recap.handoff.schemaVersion}</Text>
          <Text style={[styles.previewLine, { color: c.mutedForeground }]}>Mode: {recap.handoff.mode}</Text>
          <Text style={[styles.previewLine, { color: c.mutedForeground }]}>Outcome: {recap.handoff.finalOutcomeStatus}</Text>
          <Text style={[styles.previewLine, { color: c.mutedForeground }]}>Entries: {recap.handoff.entryCount}</Text>
          <Text style={[styles.previewLine, { color: c.mutedForeground }]}>Loot Preview: {recap.handoff.hasLootPreview ? "yes" : "no"}</Text>

          {!isHandoffApproved ? (
            <Text style={[styles.previewLine, { color: c.mutedForeground }]}>Approval Required Before Apply</Text>
          ) : (
            <Text style={[styles.previewLine, { color: c.primary }]}>Handoff Approved (Local)</Text>
          )}

          <View style={styles.controlsRow}>
            <TouchableOpacity
              onPress={onApproveHandoff}
              style={[
                styles.resetBtn,
                { borderColor: c.border, backgroundColor: c.background, opacity: isHandoffApproved ? 0.6 : 1 },
              ]}
              activeOpacity={0.85}
              disabled={isHandoffApproved}
            >
              <Text style={[styles.resetText, { color: c.foreground }]}>Approve Handoff</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onApplyHandoff}
              style={[
                styles.resetBtn,
                { borderColor: c.border, backgroundColor: c.background, opacity: canApplyHandoff ? 1 : 0.6 },
              ]}
              activeOpacity={0.85}
              disabled={!canApplyHandoff}
            >
              <Text style={[styles.resetText, { color: c.foreground }]}>{canApplyHandoff ? "Finish Session & Save Archive" : "Finish Session"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={onReset}
        style={[styles.resetBtn, { borderColor: c.border, backgroundColor: c.background }]}
        activeOpacity={0.85}
      >
        <Text style={[styles.resetText, { color: c.foreground }]}>Reset Outcome State</Text>
      </TouchableOpacity>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 9,
    gap: 4,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  previewLine: {
    fontSize: 12,
    lineHeight: 17,
  },
  closedStamp: {
    fontSize: 11,
  },
  resetBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  resetText: {
    fontSize: 12,
    fontWeight: "700",
  },
  controlsRow: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
