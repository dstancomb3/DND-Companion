import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useCombat } from "@/context/CombatContext";
import { useParty } from "@/context/PartyContext";
import { useColors } from "@/hooks/useColors";

/** Uses the same selectedTargetIds consumed by AttackCard and ActionCard. */
export function AiDmCombatTargetPicker() {
  const combat = useCombat();
  const c = useColors();
  const { memberId } = useParty();
  // The default attack picker is for other combatants, not the actor.
  // Self-only abilities should resolve their own target without this list.
  const eligibleTargets = combat.partyTargets.filter((target) => target.id !== memberId);
  if (!combat.active || eligibleTargets.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.foreground }]}>Choose targets</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear combat targets"
          onPress={combat.clearTargetIds}>
          <Text style={{ color: c.primary }}>Clear</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
        Selected targets are used by the attack and action cards below.
      </Text>
      <View style={styles.targets}>
        {eligibleTargets.map((target) => {
          const selected = combat.selectedTargetIds.has(target.id);
          return (
            <TouchableOpacity key={target.id} accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`Target ${target.name}`}
              onPress={() => combat.toggleTargetId(target.id)}
              style={[styles.target, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + "1A" : c.background }]}>
              <Text style={{ color: selected ? c.primary : c.foreground, fontWeight: selected ? "700" : "500" }}>
                {selected ? "✓ " : ""}{target.name}
              </Text>
              <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{target.type === "npc" ? "Creature" : "Party"}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontWeight: "700", fontSize: 16 },
  targets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  target: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 96, gap: 2 },
});
