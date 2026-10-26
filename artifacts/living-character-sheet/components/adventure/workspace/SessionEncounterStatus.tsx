import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { SessionViewModel } from "@/utils/adventure/sessionWorkspace";

const modeLabels = { human_dm: "Human DM", ai_one_off: "AI DM · One-off", ai_campaign: "AI DM · Campaign" };

// Read-only widget shared by hosted parties and AI adventures. It receives a
// projection, never host credentials, private NPC details or mutation functions.
export function SessionEncounterStatus({ session, showMode = true }: { session: SessionViewModel; showMode?: boolean }) {
  const c = useColors();
  const encounter = session.encounter;
  const status = encounter.status === "disconnected" ? "Connect to a party to share encounter state."
    : encounter.status === "loading" ? "Loading encounter…"
    : encounter.status === "exploration" ? "Outside combat"
    : encounter.isPlayerTurn ? "Your turn"
    : encounter.currentActorName ? `${encounter.currentActorName}'s turn` : "Waiting for initiative";
  return (
    <View accessibilityLabel="Session encounter status" style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      {showMode ? <Text style={[styles.mode, { color: c.mutedForeground }]}>{modeLabels[session.mode]}</Text> : null}
      <Text accessibilityLiveRegion="polite" style={[styles.status, { color: encounter.isPlayerTurn ? c.primary : c.foreground }]}>{status}</Text>
      {encounter.status === "combat" ? <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{encounter.participantCount} in initiative</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  mode: { fontSize: 11, fontWeight: "700" },
  status: { fontSize: 14, fontWeight: "700" },
});
