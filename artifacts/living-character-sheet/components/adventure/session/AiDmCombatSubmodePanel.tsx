import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useParty } from "@/context/PartyContext";
import {
  addToEncounter,
  confirmEncounterPositions,
  hasLocalPartyHostCapability,
  endEncounter,
  endPartyTurnForBattle,
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
  const [confirmSkipActorId, setConfirmSkipActorId] = useState<string | null>(null);
  const [positionDrafts, setPositionDrafts] = useState<Record<string, { x: string; y: string }>>({});
  const [isHostDevice, setIsHostDevice] = useState(false);
  React.useEffect(() => {
    let active = true;
    setIsHostDevice(false);
    if (partyCode) void hasLocalPartyHostCapability(partyCode).then(ok => { if (active) setIsHostDevice(ok); }).catch(() => {});
    return () => { active = false; };
  }, [partyCode]);
  const [positionsOpen, setPositionsOpen] = useState(false);

  const battleId = useMemo(() => selectMemberBattleId(combatState, memberId), [combatState, memberId]);
  const turnOrder = useMemo(() => selectBattleTurnOrder(combatState, battleId), [combatState, battleId]);
  const currentTurnId = useMemo(() => selectBattleCurrentTurnId(combatState, battleId), [combatState, battleId]);
  const battleNpcs = useMemo(() => selectBattleNpcs(combatState, battleId), [combatState, battleId]);

  const hasActiveBattle = Boolean(battleId);
  const currentNpc = battleNpcs.find((npc) => npc.id === currentTurnId) ?? null;

  const positionTargets = [
    ...members.filter((m) => combatState?.participantBattleById?.[m.id] === battleId)
      .map((m) => ({ id: m.id, label: m.characterName })),
    ...battleNpcs.map((n) => ({ id: n.id, label: n.name })),
  ];

  async function saveConfirmedPositions() {
    if (!partyCode || !battleId || !combatState || busy || !isHostDevice) return;
    const draftRows = Object.entries(positionDrafts)
      .filter(([, value]) => value.x.trim() !== "" || value.y.trim() !== "");
    if (!draftRows.length) {
      onToolEvent("Enter an X and Y coordinate for at least one combatant.");
      return;
    }
    if (draftRows.some(([id, value]) =>
      !positionTargets.some(target => target.id === id) ||
      value.x.trim() === "" || value.y.trim() === "" ||
      !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y)) ||
      Math.abs(Number(value.x)) > 10000 || Math.abs(Number(value.y)) > 10000)) {
      onToolEvent("Each edited combatant needs valid X and Y coordinates between -10,000 and 10,000 feet.");
      return;
    }
    if (!Number.isSafeInteger(combatState.stateRevision) || (combatState.stateRevision ?? 0) < 1) {
      onToolEvent("Refresh the combat state before confirming positions.");
      return;
    }
    setBusy(true);
    try {
      await confirmEncounterPositions(partyCode, {
        expectedRevision: combatState.stateRevision!,
        positions: draftRows.map(([combatantId, value]) => ({
          battleId, combatantId, xFeet: Number(value.x), yFeet: Number(value.y),
          source: "dm_confirmed" as const,
        })),
      });
      await refreshCombatState(partyCode);
      setPositionDrafts({});
      onToolEvent(`Confirmed positions for ${draftRows.length} combatant(s). All pairwise distances now derive from these shared coordinates.`);
    } catch (error) {
      onToolEvent(`Position confirmation failed: ${error instanceof Error ? error.message : "unknown error"}. Refresh and retry.`);
    } finally {
      setBusy(false);
    }
  }

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

  async function handleSkipStalledNpc() {
    if (!partyCode || !battleId || !currentNpc || busy) return;
    if (confirmSkipActorId !== currentNpc.id) {
      setConfirmSkipActorId(currentNpc.id);
      return;
    }
    setBusy(true);
    setConfirmSkipActorId(null);
    try {
      // Host-authorized operation: never impersonate a member or advance a
      // player's turn. Server checks original host credentials.
      await endPartyTurnForBattle(partyCode, battleId, true);
      await refreshCombatState(partyCode);
      onToolEvent(`Advanced past stalled NPC turn (${currentNpc.name}) without taking its actions. This is manual recovery, not AI NPC combat.`);
    } catch (error) {
      onToolEvent(`NPC turn recovery failed: ${error instanceof Error ? error.message : "unknown error"}`);
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

      {hasActiveBattle && isHostDevice ? (
        <View style={[styles.metaCard, { borderColor: c.border, backgroundColor: c.background }]}>
          <TouchableOpacity accessibilityRole="button" onPress={() => setPositionsOpen(v => !v)}>
            <Text style={[styles.title, { color: c.foreground }]}>
              {positionsOpen ? "Hide" : "Edit"} combatant positions
            </Text>
          </TouchableOpacity>
          {positionsOpen ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Text style={[styles.body, { color: c.mutedForeground }]}>
                Host-only encounter coordinates in feet. Set positions once; moving one creature updates its distance to every other creature automatically. Leave both fields blank to preserve an existing position.
              </Text>
              {positionTargets.map(target => {
                const current = combatState?.encounterPositions?.find(x =>
                  x.battleId === battleId && x.combatantId === target.id);
                const draft = positionDrafts[target.id];
                return (
                  <View key={target.id} style={{ gap: 4 }}>
                    <Text style={[styles.metaLabel, { color: c.foreground }]}>
                      {target.label} · {current ? `(${current.xFeet}, ${current.yFeet}) ft` : "Position unknown"}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {(["x", "y"] as const).map(axis => (
                        <TextInput key={axis} keyboardType="numbers-and-punctuation"
                          accessibilityLabel={`${target.label} ${axis.toUpperCase()} coordinate in feet`}
                          placeholder={axis.toUpperCase() + " ft"} placeholderTextColor={c.mutedForeground}
                          value={draft?.[axis] ?? ""}
                          onChangeText={value => setPositionDrafts(prev => ({
                            ...prev, [target.id]: { x: prev[target.id]?.x ?? "", y: prev[target.id]?.y ?? "", [axis]: value },
                          }))}
                          editable={!busy}
                          style={{ flex: 1, color: c.foreground, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 8 }} />
                      ))}
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void saveConfirmedPositions()}
                style={[styles.actionBtn, { borderColor: c.primary, alignSelf: "flex-start" }]}>
                <Text style={[styles.actionText, { color: c.primary }]}>Confirm positions</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

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

        {currentNpc ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={confirmSkipActorId === currentNpc.id ? `Confirm skip ${currentNpc.name} turn` : `Skip stalled NPC turn for ${currentNpc.name}`}
            onPress={() => void handleSkipStalledNpc()}
            style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
            activeOpacity={0.85} disabled={busy}>
            <Text style={[styles.actionText, { color: c.foreground }]}>
              {confirmSkipActorId === currentNpc.id ? `Confirm skip: ${currentNpc.name}` : `Recover stuck NPC: ${currentNpc.name}`}
            </Text>
          </TouchableOpacity>
        ) : null}
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
