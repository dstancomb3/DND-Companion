import React, { useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useCombat } from "@/context/CombatContext";
import { useColors } from "@/hooks/useColors";

export function SessionTurnControls({ isPlayerTurn }: { isPlayerTurn: boolean }) {
  const c = useColors(), combat = useCombat();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  async function end() {
    if (!isPlayerTurn || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(false);
    try { setError(!(await combat.endTurn())); }
    catch { setError(true); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
      {Math.max(0, combat.actionsTotal - combat.actionsUsed)} actions · {Math.max(0, combat.bonusActionsTotal - combat.bonusActionsUsed)} bonus actions remaining
    </Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="End your turn"
      disabled={!isPlayerTurn || busy} onPress={() => void end()}
      style={{ backgroundColor: c.primary, padding: 12, borderRadius: 10, opacity: isPlayerTurn && !busy ? 1 : 0.5 }}>
      <Text style={{ color: c.primaryForeground, fontWeight: "700", textAlign: "center" }}>{busy ? "Ending turn…" : isPlayerTurn ? "End Turn" : "Waiting for your turn"}</Text>
    </TouchableOpacity>
    {error ? <Text accessibilityRole="alert" style={{ color: c.destructive }}>Turn update was not confirmed. Refresh the encounter before retrying.</Text> : null}
  </View>;
}
