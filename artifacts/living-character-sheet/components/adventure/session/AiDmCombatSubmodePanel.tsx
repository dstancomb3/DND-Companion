import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useParty } from "@/context/PartyContext";
import {
  addToEncounter,
  endEncounter,
  startPartyInitiative,
} from "@/utils/partyApi";
import {
  selectBattleCurrentTurnId,
  selectBattleNpcs,
  selectBattleTurnOrder,
  selectMemberBattleId,
} from "@/context/combatRuntimeSelectors";

export interface AiDmCombatSubmodePanelProps {
  onToolEvent: (text: string) => void;
}

export function AiDmCombatSubmodePanel({ onToolEvent }: AiDmCombatSubmodePanelProps) {
  const c = useColors();
  const { partyCode, memberId, members, combatState, isInParty, refreshCombatState } = useParty();
  const [busy, setBusy] = useState(false);

  const battleId = useMemo(() => selectMemberBattleId(combatState, memberId), [combatState, memberId]);
  const turnOrder = useMemo(() => selectBattleTurnOrder(combatState, battleId), [combatState, battleId]);
  const currentTurnId = useMemo(() => selectBattleCurrentTurnId(combatState, battleId), [combatState, battleId]);
  const battleNpcs = useMemo(() => selectBattleNpcs(combatState, battleId), [combatState, battleId]);

  const hasActiveBattle = Boolean(battleId);

  async function handleStartEncounter() {
    if (!partyCode || busy) {
      onToolEvent("Combat submode: party not connected, start encounter remains preview-only.");
      return;
    }

    setBusy(true);
    try {
      const initiative = await startPartyInitiative(partyCode, true);
      await refreshCombatState(partyCode);
      onToolEvent(`Combat submode: started encounter ${initiative.battleId} with ${initiative.turnOrder.length} turn participants.`);
    } catch (error) {
      onToolEvent(`Combat submode start failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    if (!partyCode || busy) return;
    setBusy(true);
    try {
      await refreshCombatState(partyCode);
      onToolEvent("Combat submode: refreshed combat state from party authority.");
    } catch (error) {
      onToolEvent(`Combat submode refresh failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleEndEncounter() {
    if (!partyCode || !battleId || busy) {
      onToolEvent("Combat submode: no active encounter available to end.");
      return;
    }

    setBusy(true);
    try {
      await endEncounter(partyCode, battleId);
      await refreshCombatState(partyCode);
      onToolEvent(`Combat submode: ended encounter ${battleId}.`);
    } catch (error) {
      onToolEvent(`Combat submode end failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMissingMembers() {
    if (!partyCode || !battleId || busy) return;
    const participantMap = combatState?.participantBattleById ?? {};
    const missingMemberIds = members
      .map((member) => member.id)
      .filter((id) => participantMap[id] !== battleId);

    if (missingMemberIds.length === 0) {
      onToolEvent("Combat submode: all current party members already in this encounter.");
      return;
    }

    setBusy(true);
    try {
      await addToEncounter(partyCode, battleId, missingMemberIds, []);
      await refreshCombatState(partyCode);
      onToolEvent(`Combat submode: added ${missingMemberIds.length} missing party members to encounter.`);
    } catch (error) {
      onToolEvent(`Combat submode add members failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card }]}> 
      <Text style={[styles.title, { color: c.foreground }]}>Combat Submode</Text>
      <Text style={[styles.body, { color: c.mutedForeground }]}>Bounded integration using existing party combat authority paths only.</Text>

      <View style={[styles.metaCard, { borderColor: c.border, backgroundColor: c.background }]}> 
        <Text style={[styles.metaLabel, { color: c.mutedForeground }]}>Party Connected</Text>
        <Text style={[styles.metaValue, { color: c.foreground }]}>{isInParty && partyCode ? `yes (${partyCode})` : "no"}</Text>
        <Text style={[styles.metaLabel, { color: c.mutedForeground, marginTop: 8 }]}>Active Battle</Text>
        <Text style={[styles.metaValue, { color: c.foreground }]}>{hasActiveBattle ? battleId : "none"}</Text>
        <Text style={[styles.metaLabel, { color: c.mutedForeground, marginTop: 8 }]}>Turn / NPC Count</Text>
        <Text style={[styles.metaValue, { color: c.foreground }]}>{`${turnOrder.length} turns, ${battleNpcs.length} npcs`}</Text>
        <Text style={[styles.metaLabel, { color: c.mutedForeground, marginTop: 8 }]}>Current Turn Actor</Text>
        <Text style={[styles.metaValue, { color: c.foreground }]}>{currentTurnId ?? "n/a"}</Text>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={() => void handleStartEncounter()}
          style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
          activeOpacity={0.85}
          disabled={busy}
        >
          <Text style={[styles.actionText, { color: c.foreground }]}>Start Encounter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => void handleRefresh()}
          style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
          activeOpacity={0.85}
          disabled={busy || !isInParty}
        >
          <Text style={[styles.actionText, { color: c.foreground }]}>Refresh</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => void handleAddMissingMembers()}
          style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
          activeOpacity={0.85}
          disabled={busy || !hasActiveBattle}
        >
          <Text style={[styles.actionText, { color: c.foreground }]}>Add Members</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => void handleEndEncounter()}
          style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
          activeOpacity={0.85}
          disabled={busy || !hasActiveBattle}
        >
          <Text style={[styles.actionText, { color: c.foreground }]}>End Encounter</Text>
        </TouchableOpacity>
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
  title: {
    fontSize: 14,
    fontWeight: "800",
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionBtn: {
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
