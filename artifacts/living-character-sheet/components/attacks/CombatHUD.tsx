import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCombat } from "@/context/CombatContext";
import { useCharacter } from "@/context/CharacterContext";
import { useEffectiveStats } from "@/hooks/useEffectiveStats";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useParty } from "@/context/PartyContext";
import { BONUS_ACTION_COLOR } from "@/constants/semanticColors";
import { PartyMiniList } from "./PartyMiniList";
import { buildCombatActionCommand } from "@/utils/combat/buildCombatActionCommand";
import { buildDeclaredReaction } from "@/utils/combat/buildDeclaredReaction";
import { getCombatRejectMessage, formatReactionWindowMessage } from "@/utils/combat/combatFeedback";
import { getCombatNpcPresentation } from "@/utils/combat/companionCombatPresentation";

interface SlotConfig {
  label: string;
  subLabel: string;
  color: string;
  icon: string;
}

const ACTION_SLOT: SlotConfig = { label: "Action", subLabel: "Main", color: "#EF4444", icon: "circle" };
const BONUS_SLOT: SlotConfig = { label: "Bonus", subLabel: "Action", color: BONUS_ACTION_COLOR, icon: "zap" };
const REACT_SLOT: SlotConfig = { label: "Reaction", subLabel: "1/Round", color: "#3B82F6", icon: "shield" };

function CountSlot({ cfg, used, isExtra, onToggle }: { cfg: SlotConfig; used: boolean; isExtra: boolean; onToggle: () => void }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isBonus = cfg.label === "Bonus";
  const outlineStyle = isBonus && !used ? { textShadowColor: "#b58900", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 1 } : {};
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onToggle} style={[styles.slot, { backgroundColor: used ? c.secondary : cfg.color + "18", borderColor: used ? c.border : "#222" }]}>
      <View style={styles.slotIcon}>
        {used ? (
          <View style={[styles.checkCircle, { backgroundColor: c.muted }]}>
            <Feather name="check" size={13} color={c.mutedForeground} />
          </View>
        ) : (
          <View style={[styles.checkCircle, { backgroundColor: cfg.color + "33", borderColor: cfg.color }]}>
            <Feather name={cfg.icon as any} size={12} color={cfg.color} style={outlineStyle} />
          </View>
        )}
      </View>
      <Text style={[styles.slotLabel, { color: used ? c.mutedForeground : cfg.color }, outlineStyle]}>{cfg.label}{isExtra ? " *" : ""}</Text>
      <Text style={[styles.slotSub, { color: c.mutedForeground }]}>{used ? "USED" : isExtra ? "EXTRA" : cfg.subLabel}</Text>
    </TouchableOpacity>
  );
}

export function CombatHUD() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const combat = useCombat();
  const { settings, updateSettings } = useAppSettings();
  const { memberId, combatState, isInParty, members } = useParty();
  const { character } = useCharacter();
  const eff = useEffectiveStats();
  const [isPartyLogExpanded, setIsPartyLogExpanded] = React.useState(true);
  const [encounterEntryPillText, setEncounterEntryPillText] = React.useState<string | null>(null);
  const previousBattleIdRef = React.useRef<string | null | undefined>(undefined);

  const myBattleId = memberId ? combatState?.participantBattleById?.[memberId] ?? null : null;
  const encounterCurrentTurnId = isInParty
    ? (myBattleId ? combatState?.currentTurnIdByBattle?.[myBattleId] ?? null : null)
    : combat.currentTurnId;
  const sortedEventLog = React.useMemo(() => {
    const rows = combatState?.eventLog ?? [];
    return [...rows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [combatState?.eventLog]);

  React.useEffect(() => {
    const previousBattleId = previousBattleIdRef.current;
    if (previousBattleId === undefined) {
      previousBattleIdRef.current = myBattleId;
      return;
    }

    if (previousBattleId !== myBattleId) {
      if (myBattleId) {
        setEncounterEntryPillText("Entered encounter");
      } else {
        setEncounterEntryPillText(null);
      }
      previousBattleIdRef.current = myBattleId;
    }
  }, [myBattleId]);

  React.useEffect(() => {
    if (!encounterEntryPillText) return;
    const id = setTimeout(() => setEncounterEntryPillText(null), 4500);
    return () => clearTimeout(id);
  }, [encounterEntryPillText]);

  const isMyTurn = !encounterCurrentTurnId || encounterCurrentTurnId === memberId;
  const movementTotal = Math.max(0, eff.speed || character.speed || 0);
  const remainingMovement = Math.max(0, movementTotal - combat.movementUsed);
  const activeActorName = React.useMemo(() => {
    if (!encounterCurrentTurnId) return "No active actor";
    if (combatState?.environmentTurnId && encounterCurrentTurnId === combatState.environmentTurnId) {
      return "Environment";
    }
    const member = members.find((entry) => entry.id === encounterCurrentTurnId);
    if (member) return member.characterName;
    const npc = (combatState?.combatNpcs ?? []).find((entry) => entry.id === encounterCurrentTurnId);
    if (npc) return getCombatNpcPresentation(npc, members, memberId).displayName;
    return "Unknown actor";
  }, [encounterCurrentTurnId, combatState?.environmentTurnId, combatState?.combatNpcs, memberId, members]);

  const tacticalStatusText = combat.pendingReactionWindow
    ? `Reaction window open: ${combat.pendingReactionWindow.triggerType.replace(/_/g, " ")}`
    : isMyTurn
      ? "Your turn: choose an action, bonus action, reaction, or movement."
      : `Waiting: ${activeActorName} is acting.`;
  const selectedTargetSummary = React.useMemo(() => {
    if (combat.selectedTargetIds.size === 0) return "No targets selected";
    const names = combat.partyTargets
      .filter((target) => combat.selectedTargetIds.has(target.id))
      .map((target) => {
        if (target.type === "member" && target.id === memberId) return "Self";
        if (target.type === "npc") {
          const npc = (combatState?.combatNpcs ?? []).find((entry) => entry.id === target.id);
          return npc ? getCombatNpcPresentation(npc, members, memberId).displayName : target.name;
        }
        return target.name;
      });
    if (names.length === 0) return "No targets selected";
    if (names.length <= 2) return names.join(" | ");
    return `${names.slice(0, 2).join(" | ")} +${names.length - 2} more`;
  }, [combat.selectedTargetIds, combat.partyTargets, combatState?.combatNpcs, memberId, members]);

  const actionSlots = Array.from({ length: combat.actionsTotal }, (_, i) => ({ cfg: ACTION_SLOT, used: i < combat.actionsUsed, isExtra: i > 0, onToggle: () => (i === combat.actionsUsed ? combat.useAction() : i === combat.actionsUsed - 1 ? combat.refundAction() : null) }));
  const bonusSlots = Array.from({ length: combat.bonusActionsTotal }, (_, i) => ({ cfg: BONUS_SLOT, used: i < combat.bonusActionsUsed, isExtra: i > 0, onToggle: () => (i === combat.bonusActionsUsed ? combat.useBonusAction() : i === combat.bonusActionsUsed - 1 ? combat.refundBonusAction() : null) }));
  const acceptPendingReaction = React.useCallback(async () => {
    const pending = combat.pendingReactionWindow;
    if (!pending) return;

    const reactionDeclaration = buildDeclaredReaction({
      triggerType: pending.triggerType,
      sourceType: "free_action",
      sourceName: `Reaction (${pending.triggerType})`,
    });

    const command = buildCombatActionCommand({
      sourceType: "free_action",
      sourceId: `reaction-window:${pending.windowId}`,
      sourceName: `Reaction (${pending.triggerType})`,
      actionKind: "reaction",
      reaction: {
        windowId: pending.windowId,
        triggerType: pending.triggerType,
        sourceCommandId: pending.sourceCommandId,
        decision: "accept",
        declared: reactionDeclaration.declared,
      },
      metadata: {
        eventType: "player_reaction_used",
        eventMessage: `Reaction: ${pending.triggerType}`,
        eventMetadata: {
          reactionWindowId: pending.windowId,
          triggerType: pending.triggerType,
          sourceCommandId: pending.sourceCommandId,
          reactionTriggerType: reactionDeclaration.inferredTriggerType ?? pending.triggerType,
          reactionDeclaredName: reactionDeclaration.declared?.reactionName,
          reactionDeclaredKind: reactionDeclaration.declared?.reactionKind,
          ...(reactionDeclaration.limitation
            ? { reactionDeclarationLimitation: reactionDeclaration.limitation }
            : {}),
        },
      },
    });
    const result = await combat.resolveCombatAction(command);
    if (result.status !== "accepted") {
      console.warn("[combat-hud] reaction rejected", getCombatRejectMessage(result.reasonCode));
    }
  }, [combat]);

  const onReactionSlotPress = () => {
    if (combat.pendingReactionWindow) return;
    combat.toggleReaction();
  };
  const reactionSlotConfig: SlotConfig = combat.pendingReactionWindow
    ? { ...REACT_SLOT, subLabel: "PENDING" }
    : REACT_SLOT;
  const allSlots = [...actionSlots, ...bonusSlots, { cfg: reactionSlotConfig, used: combat.reactionUsed, isExtra: false, onToggle: onReactionSlotPress }];

  if (isInParty && !myBattleId) {
    return (
      <View style={[styles.hud, { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 }]}> 
        <View style={[styles.hudHeader, { borderBottomColor: c.border, borderBottomWidth: 1 }]}> 
          <View style={styles.hudTitleRow}>
            <Feather name="crosshair" size={13} color={c.primary} />
            <Text style={[styles.hudTitle, { color: c.foreground }]}>COMBAT HUD</Text>
          </View>
        </View>

        <View style={[styles.idleStateWrap, { borderBottomColor: c.border, backgroundColor: c.background }]}> 
          <View style={[styles.idleStateIcon, { backgroundColor: c.primary + "18", borderColor: c.primary + "44" }]}> 
            <Feather name="info" size={16} color={c.primary} />
          </View>
          <Text style={[styles.idleStateText, { color: c.foreground }]}>you are not currently in an encounter</Text>
        </View>

        <View style={styles.partyLogSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsPartyLogExpanded((prev) => !prev)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[styles.partyLogTitle, { color: c.mutedForeground }]}>PARTY LOG</Text>
              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>({sortedEventLog.length})</Text>
            </View>
            <Feather name={isPartyLogExpanded ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
          </TouchableOpacity>
          {isPartyLogExpanded && (
            <View style={[styles.partyLogBox, { borderColor: c.border, backgroundColor: c.background }]}> 
              <ScrollView
                style={{ maxHeight: 180 }}
                contentContainerStyle={{ padding: 10, gap: 6 }}
                showsVerticalScrollIndicator={sortedEventLog.length > 5}
              >
                {sortedEventLog.length === 0 ? (
                  <Text style={{ fontSize: 12, color: c.mutedForeground }}>No party activity yet.</Text>
                ) : (
                  sortedEventLog.map((evt) => {
                    const actorName = evt.memberId ? members.find((m) => m.id === evt.memberId)?.characterName ?? "Player" : "System";
                    return (
                      <Text key={evt.id} style={{ fontSize: 12, color: c.mutedForeground, lineHeight: 17 }}>
                        [{new Date(evt.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}] {actorName}: {evt.message}
                      </Text>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.hud, { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 }]}>
      <View style={[styles.hudHeader, { borderBottomColor: c.border, borderBottomWidth: 1 }]}>
        <View style={styles.hudTitleRow}>
          <Feather name="crosshair" size={13} color={c.primary} />
          <Text style={[styles.hudTitle, { color: c.foreground }]}>COMBAT HUD</Text>
        </View>
        {isMyTurn && (
          <TouchableOpacity activeOpacity={0.7} onPress={combat.endTurn} style={[styles.endTurnBtn, { borderColor: c.border, backgroundColor: c.secondary }]}>
            <Feather name="skip-forward" size={12} color={c.foreground} />
            <Text style={[styles.endTurnText, { color: c.foreground }]}>End Turn</Text>
          </TouchableOpacity>
        )}
        {!isMyTurn && encounterCurrentTurnId === combatState?.environmentTurnId && (
          <Text style={[styles.waitText, { color: c.mutedForeground }]}>Environment turn - waiting for DM</Text>
        )}
      </View>

      <View style={[styles.tacticalStrip, { borderBottomColor: c.border, backgroundColor: c.background }]}> 
        <View style={styles.tacticalTitleRow}>
          <Text style={[styles.tacticalTitle, { color: c.foreground }]}>Active: {activeActorName}</Text>
          <View style={[styles.turnStatePill, { borderColor: isMyTurn ? "#22C55E" : c.border, backgroundColor: isMyTurn ? "#22C55E22" : c.secondary }]}> 
            <Text style={[styles.turnStateText, { color: isMyTurn ? "#22C55E" : c.mutedForeground }]}> 
              {isMyTurn ? "YOUR TURN" : "WAIT"}
            </Text>
          </View>
        </View>
        <Text style={[styles.tacticalSub, { color: c.mutedForeground }]}>{tacticalStatusText}</Text>
        <Text style={[styles.tacticalSub, { color: c.mutedForeground }]}>Acting as: {combat.activeActorLabel}</Text>
        <Text style={[styles.tacticalSub, { color: combat.selectedTargetIds.size > 0 ? "#f97316" : c.mutedForeground }]}>Targets: {selectedTargetSummary}</Text>
      </View>

      <View style={{ paddingHorizontal: 10, paddingTop: 8 }}><PartyMiniList /></View>

      {encounterEntryPillText && (
        <View style={{ paddingHorizontal: 10, paddingTop: 6 }}>
          <View style={[styles.encounterPill, { borderColor: c.primary + "66", backgroundColor: c.primary + "14" }]}>
            <Feather name="zap" size={12} color={c.primary} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: c.primary }}>{encounterEntryPillText}</Text>
          </View>
        </View>
      )}

      {combat.pendingReactionWindow && (
        <View style={[styles.reactionWindowCard, { borderColor: "#3B82F666", backgroundColor: "#3B82F612" }]}> 
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="shield" size={14} color="#3B82F6" />
            <Text style={[styles.reactionWindowTitle, { color: "#3B82F6" }]}>Reaction Available</Text>
          </View>
          <Text style={[styles.reactionWindowMessage, { color: c.mutedForeground }]}>
            {formatReactionWindowMessage(combat.pendingReactionWindow)}
          </Text>
          <View style={styles.reactionActionsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => combat.declineReactionWindow(combat.pendingReactionWindow!.windowId)}
              style={[styles.reactionActionBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
            >
              <Text style={[styles.reactionActionText, { color: c.mutedForeground }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => void acceptPendingReaction()}
              style={[styles.reactionActionBtn, { borderColor: "#3B82F655", backgroundColor: "#3B82F622" }]}
            >
              <Text style={[styles.reactionActionText, { color: "#3B82F6" }]}>Use Reaction</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <Text style={{ color: c.mutedForeground, fontSize: 12, marginRight: 8 }}>Auto-roll Concentration Save</Text>
          <TouchableOpacity onPress={() => updateSettings({ autoConcentrationSave: !settings.autoConcentrationSave })} style={{ width: 38, height: 22, borderRadius: 12, backgroundColor: settings.autoConcentrationSave ? c.primary : c.muted, justifyContent: "center", padding: 2 }} activeOpacity={0.7}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: settings.autoConcentrationSave ? c.primaryForeground : c.mutedForeground, marginLeft: settings.autoConcentrationSave ? 16 : 2 }} />
          </TouchableOpacity>
        </View>
      </View>

      {isMyTurn ? (
        <>
          <View style={styles.legendRow}>
            <View style={[styles.legendChip, { backgroundColor: c.secondary, borderColor: c.border }]}>
              <Text style={[styles.legendChipText, { color: c.mutedForeground }]}>Action {Math.max(0, combat.actionsTotal - combat.actionsUsed) > 0 ? "available" : "spent"}</Text>
            </View>
            <View style={[styles.legendChip, { backgroundColor: c.secondary, borderColor: c.border }]}>
              <Text style={[styles.legendChipText, { color: c.mutedForeground }]}>Bonus {Math.max(0, combat.bonusActionsTotal - combat.bonusActionsUsed) > 0 ? "available" : "spent"}</Text>
            </View>
            <View style={[styles.legendChip, { backgroundColor: c.secondary, borderColor: c.border }]}>
              <Text style={[styles.legendChipText, { color: c.mutedForeground }]}>Reaction {combat.pendingReactionWindow ? "pending" : combat.reactionUsed ? "spent" : "ready"}</Text>
            </View>
          </View>

          <View style={styles.slots}>
            {allSlots.map((s, idx) => <CountSlot key={`${s.cfg.label}-${idx}`} cfg={s.cfg} used={s.used} isExtra={s.isExtra} onToggle={s.onToggle} />)}
          </View>

          <View style={[styles.moveSection, { borderTopColor: c.border }]}>
            <View style={styles.moveHeader}>
              <Feather name="wind" size={12} color={c.mutedForeground} />
              <Text style={[styles.moveLabel, { color: c.mutedForeground }]}>Movement</Text>
              <Text style={[styles.moveFeet, { color: c.foreground }]}>{remainingMovement} / {movementTotal} ft</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.border, overflow: "hidden", marginTop: 6 }}>
              <View style={{ width: movementTotal > 0 ? `${Math.min(1, remainingMovement / movementTotal) * 100}%` : "0%", height: "100%", backgroundColor: remainingMovement > 0 ? "#22C55E" : "#f87171", borderRadius: 3 }} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {[5, 10, 15, 30].map((ft) => (
                <TouchableOpacity
                  key={ft}
                  onPress={() => combat.spendMovement(ft)}
                  disabled={remainingMovement < ft}
                  style={[styles.moveBtn, { backgroundColor: c.secondary, borderColor: c.border, opacity: remainingMovement < ft ? 0.4 : 1 }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: c.foreground }}>-{ft}ft</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => combat.refundMovement(5)}
                disabled={combat.movementUsed === 0}
                style={[styles.moveBtn, { backgroundColor: c.secondary, borderColor: "#22C55E55", opacity: combat.movementUsed === 0 ? 0.4 : 1 }]}
                activeOpacity={0.7}
              >
                <Feather name="rotate-ccw" size={11} color="#22C55E" />
              </TouchableOpacity>
            </View>
          </View>

              <TouchableOpacity activeOpacity={0.7} onPress={combat.toggleObjectInteraction} style={[styles.objectRow, { borderTopColor: c.border }]}>
            <View style={[styles.objectCheckbox, { borderColor: combat.objectInteractionUsed ? c.mutedForeground : c.border, backgroundColor: combat.objectInteractionUsed ? c.muted : "transparent" }]}>
              {combat.objectInteractionUsed && <Feather name="check" size={11} color={c.mutedForeground} />}
            </View>
            <Text style={[styles.objectLabel, { color: c.mutedForeground }]}>Free Object Interaction used</Text>
          </TouchableOpacity>
        </>
      ) : encounterCurrentTurnId === combatState?.environmentTurnId ? (
        <View style={[styles.environmentCard, { borderTopColor: c.border, backgroundColor: "#78350f22" }]}>
          <View style={styles.environmentCardHeader}>
            <View style={styles.environmentIcon}>
              <Feather name="cloud" size={16} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#f59e0b" }}>Environment</Text>
                <View style={{ backgroundColor: "#22C55E22", borderColor: "#22C55E", borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 9, fontWeight: "800", color: "#22C55E", letterSpacing: 0.5 }}>CURRENT TURN</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: "#f59e0b99", fontWeight: "600" }}>DM-controlled — waiting for DM to advance turn</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.notYourTurnBanner, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <Feather name="clock" size={13} color={c.mutedForeground} />
          <Text style={{ fontSize: 12, color: c.mutedForeground, fontWeight: "600" }}>Waiting for your turn…</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: { radiusLg: number; radiusSm: number; radiusPill: number; radiusMd: number }) => StyleSheet.create({
  hud: { borderRadius: c.radiusLg, marginBottom: 16, overflow: "hidden" },
  hudHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11 },
  hudTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  hudTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  waitText: { fontSize: 11, fontWeight: "600" },
  endTurnBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: c.radiusSm, borderWidth: 1 },
  endTurnText: { fontSize: 12, fontWeight: "700" },
  tacticalStrip: { borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 9, gap: 5 },
  tacticalTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tacticalTitle: { fontSize: 12, fontWeight: "700" },
  tacticalSub: { fontSize: 11, fontWeight: "600", lineHeight: 16 },
  turnStatePill: { borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 8, paddingVertical: 3 },
  turnStateText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  reactionWindowCard: { marginHorizontal: 10, marginTop: 8, borderWidth: 1, borderRadius: c.radiusMd, padding: 10, gap: 8 },
  reactionWindowTitle: { fontSize: 12, fontWeight: "700" },
  reactionWindowMessage: { fontSize: 11, lineHeight: 16 },
  reactionActionsRow: { flexDirection: "row", gap: 8 },
  reactionActionBtn: { flex: 1, borderWidth: 1, borderRadius: c.radiusSm, paddingVertical: 7, alignItems: "center" },
  reactionActionText: { fontSize: 12, fontWeight: "700" },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 10, paddingBottom: 8 },
  legendChip: { borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 8, paddingVertical: 4 },
  legendChipText: { fontSize: 10, fontWeight: "700" },
  slots: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
  slot: { minWidth: 72, flex: 1, borderWidth: 1, borderRadius: c.radiusMd, padding: 10, alignItems: "center", gap: 5 },
  slotIcon: { marginBottom: 2 },
  checkCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center", borderColor: "transparent" },
  slotLabel: { fontSize: 12, fontWeight: "700" },
  slotSub: { fontSize: 9, fontWeight: "600", letterSpacing: 0.5 },
  moveSection: { borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 8 },
  moveHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  moveLabel: { fontSize: 11, fontWeight: "600", flex: 1 },
  moveFeet: { fontSize: 13, fontWeight: "700" },
  objectRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  objectCheckbox: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center", borderColor: "#222" },
  objectLabel: { fontSize: 12, fontWeight: "600" },
  moveBtn: { borderRadius: c.radiusSm, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, alignItems: "center", justifyContent: "center" },
  encounterPill: {
    borderRadius: c.radiusPill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  notYourTurnBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  environmentCard: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  environmentCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  environmentIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f59e0b22", borderWidth: 1, borderColor: "#f59e0b66", alignItems: "center", justifyContent: "center" },
  idleStateWrap: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
  },
  idleStateIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  idleStateText: {
    fontSize: 13,
    fontWeight: "700",
  },
  partyLogSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  partyLogTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  partyLogBox: {
    borderWidth: 1,
    borderRadius: c.radiusMd,
    overflow: "hidden",
  },
});
