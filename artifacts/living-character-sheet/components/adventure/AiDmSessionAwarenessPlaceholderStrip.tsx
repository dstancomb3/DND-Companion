import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

import type { AiDmSessionAwarenessPlaceholder } from "@/types";
import { useColors } from "@/hooks/useColors";

export interface AiDmSessionAwarenessPlaceholderStripProps {
  placeholder?: AiDmSessionAwarenessPlaceholder | null;
  onEndSession?: () => void;
}

export function AiDmSessionAwarenessPlaceholderStrip({
  placeholder,
  onEndSession,
}: AiDmSessionAwarenessPlaceholderStripProps) {
  const c = useColors();

  if (!placeholder?.isAiDmActive) return null;
  if (placeholder.showContextStrip === false) return null;

  const badgeLabel = placeholder.activeBadgeLabel?.trim() || "AI DM Active";
  const hasReturnPath = typeof placeholder.returnToSessionPath === "string" && placeholder.returnToSessionPath.length > 0;

  return (
    <View style={[styles.container, { borderColor: c.border, backgroundColor: c.card }]}>
      <View style={[styles.badge, { borderColor: c.primary + "66", backgroundColor: c.primary + "14" }]}>
        <Feather name="cpu" size={12} color={c.primary} />
        <Text style={[styles.badgeText, { color: c.primary }]}>{badgeLabel}</Text>
      </View>

      {placeholder.sessionLabel ? (
        <Text style={[styles.contextText, { color: c.mutedForeground }]} numberOfLines={1}>
          {placeholder.sessionLabel}
        </Text>
      ) : null}

      {hasReturnPath ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={() => router.push(placeholder.returnToSessionPath as any)}
            style={[styles.returnButton, { borderColor: c.border }]}
            activeOpacity={0.8}
          >
            <Feather name="corner-up-left" size={12} color={c.foreground} />
            <Text style={[styles.returnText, { color: c.foreground }]}>Return to Session</Text>
          </TouchableOpacity>

          {onEndSession ? (
            <TouchableOpacity
              onPress={onEndSession}
              style={[styles.endButton, { borderColor: c.destructive + "66", backgroundColor: c.destructive + "14" }]}
              activeOpacity={0.8}
            >
              <Feather name="x-circle" size={12} color={c.destructive} />
              <Text style={[styles.endText, { color: c.destructive }]}>End Session</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  contextText: {
    fontSize: 12,
  },
  returnButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  returnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  endButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  endText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
