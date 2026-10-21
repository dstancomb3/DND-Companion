import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useParty } from "@/context/PartyContext";
import { useToastAnimation } from "@/hooks/useToastAnimation";
import { fetchPartyCombatState, type PartyCombatState } from "@/utils/partyApi";
import { createShadowStyle } from "@/utils/shadow";

const POLL_INTERVAL_MS = 3000;

type PillTone = "info" | "positive" | "negative";

export function PartyStatusPill() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings } = useAppSettings();
  const { isInParty, partyCode, memberId, members } = useParty();

  const [pill, setPill] = useState<{ message: string; tone: PillTone } | null>(null);
  const { animatedStyle } = useToastAnimation({
    visible: Boolean(pill),
    dismissAfterMs: 4500,
    onDismiss: () => setPill(null),
    entryOpacityDuration: 180,
    entryTranslateDuration: 220,
    exitDuration: 240,
    motionIntensity: settings.motionIntensity,
    motionsEnabled: settings.motions?.enabled,
  });

  const initialSyncDoneRef = useRef(false);
  const lastTopEventIdRef = useRef<string | null>(null);
  const pendingPromptIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!isInParty || !partyCode || !memberId || !settings.showPartyEventPills) return;

    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const syncNotifications = (state: PartyCombatState) => {
      const pendingTargeted = state.rollRequests.filter((request) =>
        request.targetMemberIds.includes(memberId) &&
        !request.responses.some((response) => response.memberId === memberId)
      );

      if (!initialSyncDoneRef.current) {
        initialSyncDoneRef.current = true;
        pendingPromptIdsRef.current = pendingTargeted.map((r) => r.id);
        lastTopEventIdRef.current = state.eventLog[0]?.id ?? null;
        return;
      }

      const previousPending = new Set(pendingPromptIdsRef.current);
      const newlyPending = pendingTargeted.filter((request) => !previousPending.has(request.id));
      if (newlyPending.length > 0) {
        setPill({ message: `DM Prompt: ${newlyPending[0].label}`, tone: "info" });
      } else {
        const newestEvent = state.eventLog[0];
        if (newestEvent && newestEvent.id !== lastTopEventIdRef.current) {
          const actorName = newestEvent.memberId
            ? members.find((m) => m.id === newestEvent.memberId)?.characterName ?? "Party"
            : "Party";
          setPill({ message: `${actorName}: ${newestEvent.message}`, tone: "info" });
          lastTopEventIdRef.current = newestEvent.id;
        }
      }

      pendingPromptIdsRef.current = pendingTargeted.map((r) => r.id);
    };

    const poll = async () => {
      try {
        const state = await fetchPartyCombatState(partyCode);
        if (cancelled) return;
        syncNotifications(state);
      } catch {
        // Keep UI resilient if party combat sync is temporarily unavailable.
      }
    };

    poll();
    pollId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
    };
  }, [isInParty, partyCode, memberId, members, settings.showPartyEventPills]);

  useEffect(() => {
    if (isInParty) return;
    setPill(null);
    initialSyncDoneRef.current = false;
    lastTopEventIdRef.current = null;
    pendingPromptIdsRef.current = [];
  }, [isInParty]);

  if (!settings.showPartyEventPills || !pill) return null;

  const isTop = settings.statusPillPosition === "top";
  const toneColor = pill.tone === "positive" ? c.primary : pill.tone === "negative" ? c.destructive : c.primary;
  const iconName = pill.tone === "positive" ? "check-circle" : pill.tone === "negative" ? "minus-circle" : "info";

  return (
    <View
      style={[styles.host, { pointerEvents: "none" }, isTop ? { top: insets.top + 12 } : { bottom: insets.bottom + 14 }]}
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
          {pill.message}
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
    zIndex: 145,
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
