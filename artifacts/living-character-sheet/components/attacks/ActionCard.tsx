import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { ActionType, ItemEffectType } from "@/types";
import { useCombat } from "@/context/CombatContext";
import { useParty } from "@/context/PartyContext";
import { ACTION_TYPE_COLORS } from "@/constants/semanticColors";
import { actionKindFromActionType, buildCombatActionCommand } from "@/utils/combat/buildCombatActionCommand";
import { buildDeclaredReaction } from "@/utils/combat/buildDeclaredReaction";
import { getCombatRejectMessage, formatOutcomeSummary } from "@/utils/combat/combatFeedback";
import type { CombatActionResult } from "@/types/combatResolution";

interface ActionCardProps {
  label: string;
  description?: string;
  sourceItemName: string;
  actionType: ActionType;
  effectType: ItemEffectType;
  maxTargets?: number;
  resourceCost?: string;
  pinned?: boolean;
  onTogglePin?: () => void;
  onConsumeUse?: () => void;
  remainingUses?: number;
}

const ACTION_META: Record<ActionType, { label: string; color: string; icon: string }> = {
  action:       { label: "Action",    color: ACTION_TYPE_COLORS.action, icon: "circle" },
  bonus_action: { label: "Bonus",     color: ACTION_TYPE_COLORS.bonus_action, icon: "zap" },
  reaction:     { label: "Reaction",  color: ACTION_TYPE_COLORS.reaction, icon: "shield" },
  free:         { label: "Free",      color: ACTION_TYPE_COLORS.free, icon: "wind" },
};

export function ActionCard({
  label,
  description,
  sourceItemName,
  actionType,
  effectType,
  maxTargets,
  resourceCost,
  pinned = false,
  onTogglePin,
  onConsumeUse,
  remainingUses,
}: ActionCardProps) {
  const c = useColors();
  const combat = useCombat();
  const { isInParty, memberId, members, combatState } = useParty();

  const [expanded, setExpanded] = useState(false);
  const [localUsed, setLocalUsed] = useState(false);
  const canExpand = Boolean(description?.trim());

  const myBattleId = memberId ? combatState?.participantBattleById?.[memberId] ?? null : null;
  const encounterCurrentTurnId = isInParty
    ? (myBattleId ? combatState?.currentTurnIdByBattle?.[myBattleId] ?? null : null)
    : combat.currentTurnId;
  const visibleMembers = React.useMemo(() => {
    if (!myBattleId) return members;
    const participantBattle = combatState?.participantBattleById ?? {};
    return members.filter((member) => participantBattle[member.id] === myBattleId);
  }, [members, combatState?.participantBattleById, myBattleId]);
  const visibleCombatNpcs = React.useMemo(() => {
    if (!myBattleId) return combatState?.combatNpcs ?? [];
    const participantBattle = combatState?.participantBattleById ?? {};
    return (combatState?.combatNpcs ?? []).filter((npc) => participantBattle[npc.id] === myBattleId);
  }, [combatState?.combatNpcs, combatState?.participantBattleById, myBattleId]);
  const selectedTargetIds = [...combat.selectedTargetIds];
  const resolvedTargetIds = typeof maxTargets === "number" && maxTargets > 0
    ? selectedTargetIds.slice(0, maxTargets)
    : selectedTargetIds;

  // Reset when the combat turn ends
  useEffect(() => { setLocalUsed(false); }, [combat.turnKey]);

  const meta = ACTION_META[actionType];
  const isUsed = localUsed;
  const isExhausted = typeof remainingUses === "number" && remainingUses <= 0;
  const canUndoDuringThisState = !combat.active;
  const isMyTurn = !encounterCurrentTurnId || encounterCurrentTurnId === memberId;
  const canShowUseButtons = !(combat.active && isInParty && !isMyTurn);
  const hasCombatTargets = visibleMembers.length > 0 || visibleCombatNpcs.length > 0;
  const shouldShowTargetHint = combat.active && hasCombatTargets && selectedTargetIds.length === 0;

  async function handleUse() {
    if (typeof remainingUses === "number" && remainingUses <= 0) return;
    const reactionWindow = actionType === "reaction" ? combat.pendingReactionWindow : null;
    const commandSourceType = effectType === "feature"
      ? "class_feature"
      : actionType === "free"
        ? "free_action"
        : "item_action";
    const reactionDeclaration = actionType === "reaction"
      ? buildDeclaredReaction({
          triggerType: reactionWindow?.triggerType,
          sourceType: commandSourceType,
          sourceName: label,
        })
      : undefined;
    const command = buildCombatActionCommand({
      sourceType: commandSourceType,
      sourceId: `${sourceItemName}:${label}:${actionType}`,
      sourceName: label,
      actionKind: actionKindFromActionType(actionType),
      targetIds: resolvedTargetIds,
      maxTargets,
      reaction: reactionWindow
        ? {
            windowId: reactionWindow.windowId,
            triggerType: reactionWindow.triggerType,
            sourceCommandId: reactionWindow.sourceCommandId,
            decision: "accept",
            declared: reactionDeclaration?.declared,
          }
        : undefined,
      metadata: {
        eventType:
          actionType === "bonus_action"
            ? "player_bonus_action_used"
            : actionType === "reaction"
              ? "player_reaction_used"
              : "player_action_used",
        eventMessage:
          actionType === "bonus_action"
            ? `Bonus Action: ${label}`
            : actionType === "reaction"
              ? `Reaction: ${label}`
              : actionType === "free"
                ? `Free Action: ${label}`
                : `Action: ${label}`,
        eventMetadata: {
          actionLabel: label,
          actionType,
          sourceItemName,
          activeActorLabel: combat.activeActorLabel,
          resourceModel: "player_turn_economy",
          ...(reactionDeclaration?.declared
            ? {
                reactionDeclaredName: reactionDeclaration.declared.reactionName,
                reactionDeclaredKind: reactionDeclaration.declared.reactionKind,
              }
            : {}),
          ...(reactionDeclaration?.limitation
            ? { reactionDeclarationLimitation: reactionDeclaration.limitation }
            : {}),
          ...(reactionWindow
            ? {
                reactionWindowId: reactionWindow.windowId,
                reactionTriggerType: reactionWindow.triggerType,
              }
            : {}),
        },
      },
    });

    const result = await combat.resolveCombatAction(command);
    if (result.status !== "accepted") {
      Alert.alert("Action Rejected", getCombatRejectMessage(result.reasonCode));
      return;
    }
    const summary = formatOutcomeSummary(result);
    if (summary) {
      Alert.alert("Action Outcome", summary);
    }
    setLocalUsed(true);
    onConsumeUse?.();
  }

  async function handleUndo() {
    const command = buildCombatActionCommand({
      sourceType: effectType === "feature" ? "class_feature" : actionType === "free" ? "free_action" : "item_action",
      sourceId: `${sourceItemName}:${label}:${actionType}`,
      sourceName: label,
      actionKind: actionKindFromActionType(actionType),
      mode: "undo",
      targetIds: resolvedTargetIds,
      maxTargets,
      metadata: {
        eventType:
          actionType === "bonus_action"
            ? "player_bonus_action_used"
            : actionType === "reaction"
              ? "player_reaction_used"
              : "player_action_used",
        eventMessage: `Undo ${meta.label}: ${label}`,
        eventMetadata: {
          actionLabel: label,
          actionType,
          sourceItemName,
          activeActorLabel: combat.activeActorLabel,
          resourceModel: "player_turn_economy",
        },
      },
    });

    const result = await combat.resolveCombatAction(command);
    if (result.status !== "accepted") {
      Alert.alert("Undo Rejected", getCombatRejectMessage(result.reasonCode));
      return;
    }
    setLocalUsed(false);
  }

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => { if (canExpand) setExpanded((v) => !v); }}
      onLongPress={onTogglePin}
      style={[
        styles.card,
        {
          backgroundColor: (isUsed || isExhausted) ? c.secondary : c.card,
          borderColor: c.border,
          borderLeftColor: pinned ? meta.color : (isUsed || isExhausted) ? c.mutedForeground : meta.color,
          opacity: (isUsed || isExhausted) ? 0.7 : 1,
        },
      ]}
    >
      {/* ── Header row ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: (isUsed || isExhausted) ? c.muted : meta.color + "22" }]}>
          <Feather
            name={isUsed ? "check" : isExhausted ? "slash" : (meta.icon as any)}
            size={11}
            color={(isUsed || isExhausted) ? c.mutedForeground : meta.color}
          />
          <Text style={[styles.badgeText, { color: (isUsed || isExhausted) ? c.mutedForeground : meta.color }]}>
            {isUsed ? "USED" : isExhausted ? "NO USES" : meta.label}
          </Text>
        </View>

        <Text
          style={[styles.label, { color: (isUsed || isExhausted) ? c.mutedForeground : c.foreground }]}
          numberOfLines={expanded ? undefined : 1}
        >
          {label}
        </Text>

        {typeof maxTargets === "number" && maxTargets > 1 ? (
          <View style={[styles.badge, { backgroundColor: c.primary + "22" }]}> 
            <Text style={[styles.badgeText, { color: c.primary }]}>×{maxTargets}</Text>
          </View>
        ) : null}

        {typeof remainingUses === "number" ? (
          <View style={[styles.badge, { backgroundColor: isExhausted ? c.muted : meta.color + "22" }]}>
            <Text style={[styles.badgeText, { color: isExhausted ? c.mutedForeground : meta.color }]}>
              {remainingUses} left
            </Text>
          </View>
        ) : null}

        {pinned ? (
          <View style={[styles.pinnedBanner, { backgroundColor: c.primary + "15" }]}>
            <MaterialCommunityIcons name="pin" size={11} color={c.primary} />
            <Text style={[styles.pinnedText, { color: c.primary }]}>PINNED</Text>
          </View>
        ) : null}

        {canExpand ? (
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={c.mutedForeground}
          />
        ) : null}
      </View>

      {/* ── Source item ─────────────────────────────────────────────── */}
      <Text style={[styles.source, { color: c.mutedForeground }]}>
        From: {sourceItemName}
        {resourceCost ? `  ·  ${resourceCost}` : ""}
      </Text>

      {/* ── Description ─────────────────────────────────────────────── */}
      {expanded && description ? (
        <Text style={[styles.desc, { color: c.foreground }]}>{description}</Text>
      ) : null}
      {!expanded && description ? (
        <Text style={[styles.preview, { color: c.mutedForeground }]} numberOfLines={2}>
          {description}
        </Text>
      ) : null}

      {expanded && combat.active && hasCombatTargets ? (
        <View style={[styles.targetSection, { borderTopColor: c.border }]}>
          <Text style={[styles.targetHeader, { color: c.mutedForeground }]}>USING COMBAT TARGETS {typeof maxTargets === "number" && maxTargets > 0 ? `(${Math.min(selectedTargetIds.length, maxTargets)}/${maxTargets})` : selectedTargetIds.length > 0 ? `(${selectedTargetIds.length})` : ""}</Text>
          <Text style={[styles.preview, { color: c.mutedForeground }]}>Target selection is shared from the combat target picker above.</Text>
        </View>
      ) : null}

      {shouldShowTargetHint && (
        <View style={[styles.undoBtn, { backgroundColor: c.secondary, borderColor: c.border, marginTop: 4 }]}> 
          <Feather name="crosshair" size={12} color={c.mutedForeground} />
          <Text style={[styles.undoBtnText, { color: c.mutedForeground }]}>Select targets for clearer, resolver-validated outcomes.</Text>
        </View>
      )}

      {/* ── Use / Undo button ───────────────────────────────────────── */}
      <View style={styles.actionRow}>
        {isUsed && canUndoDuringThisState ? (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); void handleUndo(); }}
            activeOpacity={0.8}
            style={[styles.undoBtn, { backgroundColor: c.muted, borderColor: c.border }]}
          >
            <Feather name="rotate-ccw" size={12} color={c.mutedForeground} />
            <Text style={[styles.undoBtnText, { color: c.mutedForeground }]}>Undo</Text>
          </TouchableOpacity>
        ) : !isUsed && !isExhausted ? (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); void handleUse(); }}
            activeOpacity={0.8}
            style={[
              styles.useBtn,
              {
                backgroundColor: meta.color + "22",
                borderColor: meta.color + "55",
              },
            ]}
          >
            <Feather name="play" size={12} color={meta.color} />
            <Text style={[styles.useBtnText, { color: meta.color }]}> 
              Use {meta.label}
            </Text>
            {combat.active && (
              <View style={[styles.combatPip, { backgroundColor: meta.color }]} />
            )}
          </TouchableOpacity>
        ) : isExhausted ? (
          <View style={[styles.undoBtn, { backgroundColor: c.muted, borderColor: c.border }]}>
            <Feather name="slash" size={12} color={c.mutedForeground} />
            <Text style={[styles.undoBtnText, { color: c.mutedForeground }]}>No uses remaining</Text>
          </View>
        ) : null}
        {isUsed && combat.active && (
          <View style={[styles.undoBtn, { backgroundColor: c.muted, borderColor: c.border }]}> 
            <Feather name="lock" size={12} color={c.mutedForeground} />
            <Text style={[styles.undoBtnText, { color: c.mutedForeground }]}>Locked In Combat</Text>
          </View>
        )}
        {!canShowUseButtons && combat.active ? (
          <View style={[styles.undoBtn, { backgroundColor: c.muted, borderColor: c.border }]}> 
            <Feather name="clock" size={12} color={c.mutedForeground} />
            <Text style={[styles.undoBtnText, { color: c.mutedForeground }]}>Waiting for your turn.</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  pinnedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pinnedText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  source: {
    fontSize: 11,
    marginLeft: 2,
  },
  desc: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  preview: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  useBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
  },
  useBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  combatPip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  undoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
  },
  undoBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  targetSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  targetHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  targetSubheader: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6,
  },
  targetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  targetButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: "30%",
    alignItems: "center",
  },
  targetButtonText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
