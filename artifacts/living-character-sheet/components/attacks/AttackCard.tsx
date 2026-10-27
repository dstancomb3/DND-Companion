import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  ScrollView,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { useColors } from "@/hooks/useColors";
import type { Attack, AdditionalDamage } from "@/types";
import { Card } from "@/components/ui/Card";
import { ATTACK_COLOR } from "@/constants/semanticColors";
import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useCombat } from "@/context/CombatContext";
import { useParty } from "@/context/PartyContext";
import { buildAttackDamagePackets } from "@/utils/combat/attackExecution";
import { buildCombatActionCommand } from "@/utils/combat/buildCombatActionCommand";
import { formatOutcomeSummary, getCombatRejectMessage } from "@/utils/combat/combatFeedback";
import { triggerEffect } from "@/utils/triggerEffect";
import type { CombatActionResult } from "@/types/combatResolution";

import { ConcentrationSaveModal } from "./ConcentrationSaveModal";

interface AttackCardProps {
  attack: Attack;
  pinned?: boolean;
  compact?: boolean;
  onTogglePin?: () => void;
  onResolved?: (result: CombatActionResult) => void;
}

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function AttackCard({ attack, pinned = false, compact = false, onTogglePin, onResolved }: AttackCardProps) {
  const c = useColors();
  const { updateAttack, updateItem, resources, decrementResource, incrementResource, character, conditions } = useCharacter();
  const combat = useCombat();
  const { isInParty, memberId, combatState, members } = useParty();
  const extras = attack.additionalDamage ?? [];
  const [attackActionUsed, setAttackActionUsed] = useState(false);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const submissionInFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attackFeedback, setAttackFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [usedRiderIds, setUsedRiderIds] = useState<Set<string>>(new Set());

  // Concentration save modal state
  const [showConcentrationModal, setShowConcentrationModal] = useState(false);
  const [concentrationDC, setConcentrationDC] = useState(10);
  const [concentrationDamage, setConcentrationDamage] = useState(0);
  // Track which spell to break if failed
  const [concentrationSpellId, setConcentrationSpellId] = useState<string | null>(null);
  // For auto mode: store con mod
  const [concentrationConMod, setConcentrationConMod] = useState(0);
  const { settings } = useAppSettings();

  // Reset when combat turn ends
  useEffect(() => {
    setAttackActionUsed(false);
    setAttackFeedback(null);
    setUsedRiderIds(new Set());
    setShowConcentrationModal(false);
    setConcentrationSpellId(null);
  }, [combat.turnKey]);

  // Parse "1 Focus Point" → { amount: 1, label: "Focus Point" }
  function parseResourceCost(cost: string): { amount: number; label: string } {
    const m = cost.trim().match(/^(\d+)\s+(.+)$/i);
    if (m) return { amount: parseInt(m[1], 10), label: m[2] };
    return { amount: 1, label: cost };
  }

  // Fuzzy-match resource by name (case-insensitive partial)
  function findResourceByLabel(label: string) {
    const lower = label.toLowerCase();
    return resources.find((r) => {
      const rName = r.name.toLowerCase();
      return rName.includes(lower) || lower.includes(rName) ||
        rName.includes("ki") && lower.includes("focus") ||
        rName.includes("focus") && lower.includes("ki");
    });
  }

  async function handleUseRider(riderId: string, resourceCost: string, description: string) {
    const desc = description.toLowerCase();
    if (combat.active && desc.includes("bonus action")) {
      const command = buildCombatActionCommand({
        sourceType: "attack",
        sourceId: attack.id,
        sourceName: `${attack.name} rider`,
        actionKind: "bonus_action",
        targetIds: typeof attack.maxTargets === "number" && attack.maxTargets > 0
          ? [...combat.selectedTargetIds].slice(0, attack.maxTargets)
          : [...combat.selectedTargetIds],
        maxTargets: attack.maxTargets,
        metadata: {
          eventType: "player_bonus_action_used",
          eventMessage: `Bonus Action: ${attack.name} rider`,
          eventMetadata: {
            attackId: attack.id,
            riderId,
            riderDescription: description,
          },
        },
      });
      const result = await combat.resolveCombatAction(command);
      if (result.status !== "accepted") {
        Alert.alert("Action Rejected", getCombatRejectMessage(result.reasonCode));
        return;
      }
    }

    const { amount, label } = parseResourceCost(resourceCost);
    const res = findResourceByLabel(label);
    if (res && res.current > 0) {
      for (let i = 0; i < amount; i++) decrementResource(res.id);
    }

    setUsedRiderIds((prev) => new Set([...prev, riderId]));
  }

  // --- Hook up to damage roll ---
  // Find where damage is finalized (primaryTotal, combinedTotal)
  // We'll call handleAfterDamage when attack is used and damage is present

  function handleUndoRider(riderId: string, resourceCost: string, description: string) {
    if (combat.active) return;
    const { amount, label } = parseResourceCost(resourceCost);
    const res = findResourceByLabel(label);
    if (res) {
      for (let i = 0; i < amount; i++) incrementResource(res.id);
    }
    const desc = description.toLowerCase();
    if (combat.active && desc.includes("bonus action")) combat.refundBonusAction();
    setUsedRiderIds((prev) => { const next = new Set(prev); next.delete(riderId); return next; });
  }

  const [rawAttackRoll, setRawAttackRoll] = useState("");
  const [damageRolls, setDamageRolls] = useState<string[]>(() =>
    Array(1 + extras.length).fill("")
  );
  const [showReminders, setShowReminders] = useState(false);
  const canUndoAttack = !combat.active;

  const setMaxTargets = useCallback((value: number | undefined) => {
    updateAttack(attack.id, { maxTargets: value });
  }, [attack.id, updateAttack]);

  function rollDice(formula: string): number {
    const m = formula.trim().match(/^(\d+)d(\d+)$/i);
    if (m) {
      const count = parseInt(m[1], 10);
      const sides = parseInt(m[2], 10);
      let total = 0;
      for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
      return total;
    }
    const flat = parseInt(formula.trim(), 10);
    return isNaN(flat) ? 1 : flat;
  }

  // Edit extra damage modal
  const [showEditModal, setShowEditModal] = useState(false);
  // Own extras = those without a sourceLabel (user-added or item-based, not from accessories)
  const [editOwnExtras, setEditOwnExtras] = useState<AdditionalDamage[]>([]);
  const [newDice, setNewDice] = useState("");
  const [newDmgType, setNewDmgType] = useState("");

  const openEditModal = () => {
    const ownExtras = extras.filter((e) => !e.sourceLabel);
    setEditOwnExtras(ownExtras);
    setNewDice("");
    setNewDmgType("");
    setShowEditModal(true);
  };

  const handleAddExtra = () => {
    if (!newDice.trim() || !newDmgType.trim()) return;
    setEditOwnExtras((prev) => [
      ...prev,
      { dice: newDice.trim(), damageType: newDmgType.trim() },
    ]);
    setNewDice("");
    setNewDmgType("");
  };

  const handleRemoveExtra = (idx: number) => {
    setEditOwnExtras((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveExtras = () => {
    // Auto-commit any pending input
    const pending =
      newDice.trim() && newDmgType.trim()
        ? [{ dice: newDice.trim(), damageType: newDmgType.trim() }]
        : [];
    const finalExtras = [...editOwnExtras, ...pending];

    if (attack.linkedInventoryItemId) {
      updateItem(attack.linkedInventoryItemId, {
        additionalDamage: finalExtras.length > 0 ? finalExtras : undefined,
      });
    } else {
      updateAttack(attack.id, {
        additionalDamage: finalExtras.length > 0 ? finalExtras : undefined,
      });
    }
    setShowEditModal(false);
  };

  const setRoll = useCallback((idx: number, val: string) => {
    setDamageRolls((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }, []);

  const totalHit =
    rawAttackRoll !== "" ? parseInt(rawAttackRoll || "0") + attack.attackBonus : null;

  const primaryRaw = damageRolls[0];
  const primaryTotal =
    primaryRaw !== "" ? parseInt(primaryRaw || "0") + attack.damageModifier : null;

  const extraTotals = extras.map((extra, i) => {
    const raw = damageRolls[i + 1] ?? "";
    return raw !== "" ? parseInt(raw || "0") + (extra.damageModifier ?? 0) : null;
  });

  const hasSomeRoll = primaryTotal !== null || extraTotals.some((t) => t !== null);
  const combinedTotal = hasSomeRoll
    ? (primaryTotal ?? 0) + extraTotals.reduce<number>((sum, t) => sum + (t ?? 0), 0)
    : null;

  const isCritical = rawAttackRoll === "20";

  // Injected extras (from accessories) for display-only in the modal
  const injectedExtras = extras.filter((e) => !!e.sourceLabel);
  const myBattleId = memberId ? combatState?.participantBattleById?.[memberId] ?? null : null;
  const canonicalCurrentTurnId = isInParty
    ? (myBattleId ? combatState?.currentTurnIdByBattle?.[myBattleId] ?? null : null)
    : combat.currentTurnId;
  const selectedTargetIds = [...combat.selectedTargetIds];
  const resolvedTargetIds = typeof attack.maxTargets === "number" && attack.maxTargets > 0
    ? selectedTargetIds.slice(0, attack.maxTargets)
    : selectedTargetIds;
  const isMyTurn = !canonicalCurrentTurnId || canonicalCurrentTurnId === memberId;
  const canShowUseButtons = !(combat.active && isInParty && !isMyTurn);
  const shouldShowTargetHint = combat.active && combat.partyTargets.length > 0 && selectedTargetIds.length === 0;

  const maybePlayCritFailEffect = useCallback((roll: number) => {
    if (!settings.effects.enabled || !settings.effects.critFailBurst) return;
    if (roll === 20) triggerEffect("nat_20");
    if (roll === 1) triggerEffect("nat_1");
  }, [settings.effects.critFailBurst, settings.effects.enabled]);

  async function handleUseAttack() {
    if (submissionInFlight.current || attackActionUsed || !canShowUseButtons) return;
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setAttackFeedback(null);
    try {
      await submitAttack();
    } catch (error) {
      setAttackFeedback({ error: true, message: `Attack could not be confirmed: ${error instanceof Error ? error.message : "Unknown error"}. Check the encounter state before retrying.` });
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  async function submitAttack() {
    // An explicit attack click rolls missing inputs once, using the same dice
    // helper as the individual roll buttons. Retain them for deliberate retries.
    const parsedAttackRoll = rawAttackRoll.trim() !== "" ? parseInt(rawAttackRoll, 10) : rollDice("1d20");
    if (rawAttackRoll.trim() === "") setRawAttackRoll(String(parsedAttackRoll));
    const submittedDamageRolls = [...damageRolls];
    if ((submittedDamageRolls[0] ?? "").trim() === "" && /^(?:[1-9]\d*d[1-9]\d*|\d+)$/i.test(attack.damageDice.trim())) {
      submittedDamageRolls[0] = String(rollDice(attack.damageDice));
      setDamageRolls(submittedDamageRolls);
    }
    if (typeof parsedAttackRoll === "number" && !isNaN(parsedAttackRoll)) {
      maybePlayCritFailEffect(parsedAttackRoll);
    }
    const parsedDamageRolls = submittedDamageRolls.map((value) => parseInt(value, 10));
    const declaredDamageRolls = parsedDamageRolls.filter((value) => !isNaN(value));
    const primaryRoll = parsedDamageRolls[0];

    const memberById = new Map(members.map((member) => [member.id, member]));
    const npcById = new Map(combat.combatNpcs.map((npc) => [npc.id, npc]));
    const targetConditionsById = resolvedTargetIds.reduce<Record<string, string[]>>((acc, targetId) => {
      if (targetId === memberId) {
        acc[targetId] = conditions.map((condition) => condition.name);
        return acc;
      }
      const member = memberById.get(targetId);
      if (member) {
        acc[targetId] = (member.conditions ?? []).map((condition) => condition.name);
        return acc;
      }
      const npc = npcById.get(targetId);
      if (npc) {
        acc[targetId] = (npc.conditions ?? []).map((condition) => condition.name);
      }
      return acc;
    }, {});

    const packets = buildAttackDamagePackets({
      attack,
      parsedDamageRolls,
      selectedTargetIds: resolvedTargetIds,
      targetConditionsById,
    });

    if (typeof parsedAttackRoll !== "number" || Number.isNaN(parsedAttackRoll)) {
      setAttackFeedback({ error: true, message: "Roll or enter the d20 To Hit result before using this attack." });
      return;
    }
    if (!Number.isFinite(primaryRoll) || packets.length === 0) {
      setAttackFeedback({ error: true, message: "Roll or enter the primary Damage dice total before using this attack. Use the Damage row above." });
      return;
    }

    const command = buildCombatActionCommand({
      sourceType: "attack",
      sourceId: attack.id,
      sourceName: attack.name,
      itemId: attack.linkedInventoryItemId,
      actionKind: "action",
      targetIds: resolvedTargetIds,
      maxTargets: attack.maxTargets,
      declared: {
        attackRoll: parsedAttackRoll,
        damageRolls: declaredDamageRolls.length > 0 ? declaredDamageRolls : undefined,
        damagePackets: packets,
      },
      metadata: {
        requiresResolution: true,
        eventType: "player_attack_used",
        eventMessage: `Attack: ${attack.name}`,
        eventMetadata: {
          attackName: attack.name,
          damageType: attack.damageType,
          attackBonus: attack.attackBonus,
        },
      },
    });

    const result = await combat.resolveCombatAction(command);
    if (result.status !== "accepted") {
      setAttackFeedback({ error: true, message: getCombatRejectMessage(result.reasonCode) });
      return;
    }

    const outcomeSummary = formatOutcomeSummary(result);
    setAttackFeedback({ error: false, message: outcomeSummary || "Attack accepted." });

    setAttackActionUsed(true);
    onResolved?.(result);

    const resolvedTotalDamage = (result.targetResults ?? []).reduce((sum, target) => {
      return sum + Math.max(0, target.damageBreakdown?.hpDamage ?? 0);
    }, 0);
    let totalDmg = resolvedTotalDamage;
    if (totalDmg <= 0 && (result.targetResults?.length ?? 0) === 0) {
      if (extras.length > 0 && combinedTotal !== null) totalDmg = isCritical ? combinedTotal * 2 : combinedTotal;
      else if (primaryTotal !== null) totalDmg = isCritical ? primaryTotal * 2 : primaryTotal;
    }
    // Phase D: consume resolver-surfaced concentration check instead of the old local post-damage path.
    if (result.concentrationCheckNeeded) {
      const { dc, spellId, damageTaken } = result.concentrationCheckNeeded;
      setConcentrationDC(dc);
      setConcentrationDamage(damageTaken || totalDmg);
      setConcentrationSpellId(spellId);
      let conMod = 0;
      if (character && typeof character.abilityScores?.constitution === "number") {
        conMod = Math.floor((character.abilityScores.constitution - 10) / 2);
      }
      setConcentrationConMod(conMod);
      setShowConcentrationModal(true);
    }
  }

  async function handleUndoAttack() {
    const command = buildCombatActionCommand({
      sourceType: "attack",
      sourceId: attack.id,
      sourceName: attack.name,
      itemId: attack.linkedInventoryItemId,
      actionKind: "action",
      mode: "undo",
      targetIds: resolvedTargetIds,
      maxTargets: attack.maxTargets,
      metadata: {
        eventType: "player_attack_used",
        eventMessage: `Undo Attack: ${attack.name}`,
      },
    });

    const result = await combat.resolveCombatAction(command);
    if (result.status !== "accepted") {
      Alert.alert("Undo Rejected", getCombatRejectMessage(result.reasonCode));
      return;
    }

    setAttackActionUsed(false);
    setRawAttackRoll("");
    setDamageRolls(Array(1 + extras.length).fill(""));
  }

  return (
    <>
      <Card style={[styles.card, compact && { marginBottom: 5, padding: 8 }, { borderLeftWidth: 3, borderLeftColor: attackActionUsed ? c.mutedForeground : ATTACK_COLOR }]}>
        {/* Header */}
        <View style={[styles.header, compact && { marginBottom: 4 }]}>
          <View style={[styles.titleRow, compact && { marginBottom: 4 }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onLongPress={onTogglePin}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={styles.titlePressArea}
            >
              <Text
                style={[styles.name, compact && { fontSize: 14, lineHeight: 19 }, { color: c.foreground }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {attack.name}
              </Text>
            </TouchableOpacity>
            <View style={styles.headerActions}>
              {pinned ? (
                <View style={[styles.pinnedBanner, { backgroundColor: c.primary + "15" }]}>
                  <MaterialCommunityIcons name="pin" size={11} color={c.primary} />
                  <Text style={[styles.pinnedText, { color: c.primary }]}>PINNED</Text>
                </View>
              ) : null}
              <View style={[styles.badge, { backgroundColor: c.secondary }]}>
                <Text style={[styles.badgeText, { color: c.secondaryForeground }]}>
                  {attack.damageType}
                </Text>
              </View>
              <TouchableOpacity
                onPress={openEditModal}
                style={[styles.editBtn, { backgroundColor: c.secondary }]}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={13} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.statRow, compact && { gap: 8 }]}>
            <View style={styles.statChip}>
              <Text style={[styles.statLabel, { color: c.mutedForeground }]}>ATK</Text>
              <Text style={[styles.statValue, { color: c.primary }]}>{fmtMod(attack.attackBonus)}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={[styles.statLabel, { color: c.mutedForeground }]}>DMG</Text>
              <Text style={[styles.statValue, { color: c.primary }]}>
                {attack.damageDice}{fmtMod(attack.damageModifier)}
              </Text>
            </View>
            {extras.map((extra, i) => (
              <View key={i} style={styles.statChip}>
                <Text style={[styles.statLabel, { color: c.mutedForeground }]}>
                  +{extra.damageType.toUpperCase().slice(0, 5)}
                </Text>
                <Text style={[styles.statValue, { color: "#A78BFA" }]}>
                  {extra.dice}
                  {extra.damageModifier != null && extra.damageModifier !== 0
                    ? fmtMod(extra.damageModifier)
                    : ""}
                </Text>
                {extra.sourceLabel ? (
                  <Text style={[styles.statLabel, { color: "#A78BFA", fontSize: 9, marginTop: 1 }]}>
                    {extra.sourceLabel}
                  </Text>
                ) : null}
              </View>
            ))}
            {attack.range && (
              <View style={styles.statChip}>
                <Text style={[styles.statLabel, { color: c.mutedForeground }]}>RANGE</Text>
                <Text style={[styles.statValue, { color: c.foreground }]}>{attack.range}</Text>
              </View>
            )}
            {typeof attack.maxTargets === "number" && attack.maxTargets > 1 && (
              <View style={styles.statChip}>
                <Text style={[styles.statLabel, { color: c.mutedForeground }]}>TARGETS</Text>
                <Text style={[styles.statValue, { color: "#F97316" }]}>×{attack.maxTargets}</Text>
              </View>
            )}
          </View>
        </View>

        {compact ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${compactExpanded ? "Collapse" : "Expand"} ${attack.name} attack controls`} accessibilityState={{ expanded: compactExpanded }} onPress={() => setCompactExpanded(value => !value)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
          <Text style={{ color: c.primary, fontSize: 11, fontWeight: "700" }}>{compactExpanded ? "Hide dice and attack controls" : "Roll and attack"}</Text>
          <Feather name={compactExpanded ? "chevron-up" : "chevron-down"} size={15} color={c.primary} />
        </TouchableOpacity> : null}
        {(!compact || compactExpanded) ? <>
        {/* Calculator */}
        <View style={[styles.calcSection, compact && { paddingTop: 5, marginBottom: 3 }, { borderTopColor: c.border }]}>
          {/* To Hit */}
          <View style={[styles.calcRow, compact && { minHeight: 34 }]}>
            <Text style={[styles.calcLabel, { color: c.mutedForeground }]}>To Hit</Text>
            <View style={styles.calcRight}>
              <TouchableOpacity
                disabled={rawAttackRoll !== ""}
                onPress={() => {
                  const roll = rollDice("1d20");
                  setRawAttackRoll(String(roll));
                  maybePlayCritFailEffect(roll);
                }}
                style={[styles.dieBtn, { backgroundColor: rawAttackRoll !== "" ? c.muted : c.secondary, borderRadius: c.radius }]}
                activeOpacity={0.65}
              >
                <Text style={[styles.dieBtnText, { opacity: rawAttackRoll !== "" ? 0.35 : 1 }]}>🎲</Text>
              </TouchableOpacity>
              <TextInput accessibilityLabel={`${attack.name} d20 attack roll`}
                editable={!isSubmitting && !attackActionUsed}
                value={rawAttackRoll}
                onChangeText={setRawAttackRoll}
                keyboardType="number-pad"
                placeholder="d20"
                placeholderTextColor={c.mutedForeground}
                style={[styles.rollInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius }]}
                maxLength={3}
              />
              <Text style={[styles.bonusText, { color: c.mutedForeground }]}>{fmtMod(attack.attackBonus)}</Text>
              <Text style={[styles.equalsText, { color: c.mutedForeground }]}>=</Text>
              <View style={[styles.resultBox, { backgroundColor: c.muted, borderRadius: c.radius }]}>
                <Text style={[styles.resultText, { color: totalHit !== null ? c.primary : c.mutedForeground }]}>
                  {totalHit !== null ? totalHit : "—"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.calcRow}>
            <Text style={[styles.calcLabel, { color: c.mutedForeground }]}>Damage</Text>
            <View style={styles.calcRight}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Roll ${attack.name} damage`}
                disabled={isSubmitting || (damageRolls[0] ?? "") !== ""}
                onPress={() => setRoll(0, String(rollDice(attack.damageDice)))}
                style={[styles.dieBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                activeOpacity={0.65}>
                <Text style={styles.dieBtnText}>🎲</Text>
              </TouchableOpacity>
              <TextInput accessibilityLabel={`${attack.name} primary damage dice total`}
                value={damageRolls[0] ?? ""} onChangeText={value => setRoll(0, value)}
                keyboardType="number-pad" placeholder={attack.damageDice}
                placeholderTextColor={c.mutedForeground} editable={!isSubmitting && !attackActionUsed}
                style={[styles.rollInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius }]}
                maxLength={4} />
              <Text style={[styles.bonusText, { color: c.mutedForeground }]}>{fmtMod(attack.damageModifier)}</Text>
              <Text style={[styles.equalsText, { color: c.mutedForeground }]}>=</Text>
              <View style={[styles.resultBox, { backgroundColor: c.muted, borderRadius: c.radius }]}>
                <Text style={[styles.resultText, { color: c.primary }]}>{primaryTotal ?? "—"}</Text>
              </View>
            </View>
          </View>
                {/* Concentration Save Modal */}
                <ConcentrationSaveModal
                  visible={showConcentrationModal}
                  dc={concentrationDC}
                  damage={concentrationDamage}
                  conMod={concentrationConMod}
                  onClose={() => setShowConcentrationModal(false)}
                  onSaveResult={(success) => {
                    if (!success && concentrationSpellId) {
                      combat.breakConcentration(concentrationSpellId);
                    }
                    setShowConcentrationModal(false);
                  }}
                />
          </View>

          {/* Additional damage rows */}
          {extras.map((extra, i) => (
            <View key={i} style={[styles.calcRow, { marginTop: 8 }]}>
              <Text style={[styles.calcLabel, { color: c.mutedForeground }]}>
                {extra.damageType.slice(0, 6)}
                {extra.sourceLabel ? `\n(${extra.sourceLabel})` : ""}
              </Text>
              <View style={styles.calcRight}>
                <TouchableOpacity
                  disabled={(damageRolls[i + 1] ?? "") !== ""}
                  onPress={() => setRoll(i + 1, String(rollDice(extra.dice ?? "1")))}
                  style={[styles.dieBtn, { backgroundColor: (damageRolls[i + 1] ?? "") !== "" ? c.muted : c.secondary, borderRadius: c.radius }]}
                  activeOpacity={0.65}
                >
                  <Text style={[styles.dieBtnText, { opacity: (damageRolls[i + 1] ?? "") !== "" ? 0.35 : 1 }]}>🎲</Text>
                </TouchableOpacity>
                <TextInput
                  value={damageRolls[i + 1] ?? ""}
                  onChangeText={(v) => setRoll(i + 1, v)}
                  keyboardType="number-pad"
                  placeholder={extra.dice}
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.rollInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius }]}
                  maxLength={3}
                />
                {extra.damageModifier != null && extra.damageModifier !== 0 ? (
                  <Text style={[styles.bonusText, { color: c.mutedForeground }]}>{fmtMod(extra.damageModifier)}</Text>
                ) : (
                  <Text style={[styles.bonusText, { color: "transparent" }]}>+0</Text>
                )}
                {isCritical && extraTotals[i] !== null && (
                  <Text style={styles.critMultiplier}>×2</Text>
                )}
                <Text style={[styles.equalsText, { color: c.mutedForeground }]}>=</Text>
                <View style={[styles.resultBox, { backgroundColor: isCritical && extraTotals[i] !== null ? "#A78BFA20" : c.muted, borderRadius: c.radius }]}>
                  <Text style={[styles.resultText, { color: extraTotals[i] !== null ? "#A78BFA" : c.mutedForeground }]}>
                    {extraTotals[i] !== null ? (isCritical ? extraTotals[i]! * 2 : extraTotals[i]) : "—"}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {/* Combined total */}
          {extras.length > 0 && (
            <View style={[styles.totalRow, { borderTopColor: c.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.totalLabel, { color: c.mutedForeground }]}>Total DMG</Text>
                {isCritical && combinedTotal !== null && (
                  <Text style={styles.critMultiplier}>×2</Text>
                )}
              </View>
              <View style={[styles.totalBox, { backgroundColor: combinedTotal !== null ? "#F8717120" : c.muted, borderRadius: c.radius }]}>
                <Text style={[styles.totalText, { color: combinedTotal !== null ? "#F87171" : c.mutedForeground }]}>
                  {combinedTotal !== null ? (isCritical ? combinedTotal * 2 : combinedTotal) : "—"}
                </Text>
              </View>
            </View>
          )}

        <Text style={[styles.notes, { color: c.mutedForeground }]}>Use Attack rolls any missing To Hit and primary Damage dice. Existing rolls are kept.</Text>
        {attackFeedback ? (
          <Text accessibilityRole={attackFeedback.error ? "alert" : "text"} accessibilityLiveRegion="polite"
            style={[styles.notes, { color: attackFeedback.error ? c.destructive : c.primary }]}>
            {attackFeedback.message}
          </Text>
        ) : null}
          {/* Use Action row */}
          <View style={[styles.useActionRow, { borderTopColor: c.border }]}>
            {attackActionUsed && canUndoAttack ? (
              <TouchableOpacity
                onPress={() => { void handleUndoAttack(); }}
                activeOpacity={0.8}
                style={[styles.useActionBtn, { backgroundColor: c.muted, borderColor: c.border }]}
              >
                <Feather name="rotate-ccw" size={12} color={c.mutedForeground} />
                <Text style={[styles.useActionText, { color: c.mutedForeground }]}>Undo Attack</Text>
              </TouchableOpacity>
            ) : !attackActionUsed ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Use ${attack.name} attack`}
                disabled={isSubmitting || !canShowUseButtons}
                onPress={() => { void handleUseAttack(); }}
                activeOpacity={0.8}
                style={[
                  styles.useActionBtn,
                  { backgroundColor: "#3B82F622", borderColor: "#3B82F655" },
                ]}
              >
                <Feather name="play" size={12} color="#3B82F6" />
                <Text style={[styles.useActionText, { color: "#3B82F6" }]}>{isSubmitting ? "Submitting…" : "Use Attack"}</Text>
                {combat.active && (
                  <View style={[styles.combatPip, { backgroundColor: "#3B82F6" }]} />
                )}
              </TouchableOpacity>
            ) : null}
            {attackActionUsed && (
              <View style={[styles.usedBadge, { backgroundColor: c.muted }]}>
                <Feather name="check" size={11} color={c.mutedForeground} />
                <Text style={[styles.usedBadgeText, { color: c.mutedForeground }]}>{combat.active ? "Attack locked in combat" : "Action used"}</Text>
              </View>
            )}
            {!canShowUseButtons && combat.active ? (
              <View style={[styles.usedBadge, { backgroundColor: c.muted }]}>
                <Feather name="clock" size={11} color={c.mutedForeground} />
                <Text style={[styles.usedBadgeText, { color: c.mutedForeground }]}>Waiting for your turn.</Text>
              </View>
            ) : null}
          </View>

        {combat.active && combat.partyTargets.length > 0 && (
          <View style={[styles.targetSection, { borderTopColor: c.border }]}>
            <Text style={[styles.targetHeader, { color: c.mutedForeground }]}>USING COMBAT TARGETS {typeof attack.maxTargets === "number" && attack.maxTargets > 0 ? `(${Math.min(selectedTargetIds.length, attack.maxTargets)}/${attack.maxTargets})` : selectedTargetIds.length > 0 ? `(${selectedTargetIds.length})` : ""}</Text>
            <Text style={[styles.notes, { color: c.mutedForeground }]}>Target selection is shared from the combat target picker above.</Text>
          </View>
        )}

        {shouldShowTargetHint && (
          <View style={[styles.usedBadge, { backgroundColor: c.secondary }]}>
            <Feather name="crosshair" size={11} color={c.mutedForeground} />
            <Text style={[styles.usedBadgeText, { color: c.mutedForeground }]}>Select targets to avoid ambiguous outcomes.</Text>
          </View>
        )}

        {/* Notes */}
        {attack.notes && (
          <Text style={[styles.notes, { color: c.mutedForeground }]}>{attack.notes}</Text>
        )}

        {/* Reminders toggle */}
        {attack.reminders.length > 0 && (
          <TouchableOpacity
            onPress={() => setShowReminders(!showReminders)}
            style={[styles.reminderToggle, { borderTopColor: c.border }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.reminderToggleText, { color: c.primary }]}>
              {attack.reminders.length} rider{attack.reminders.length !== 1 ? "s" : ""} / effects
            </Text>
            <Feather name={showReminders ? "chevron-up" : "chevron-down"} size={16} color={c.primary} />
          </TouchableOpacity>
        )}

        {/* Reminders expanded */}
        {showReminders && (
          <View style={[styles.reminders, { borderTopColor: c.border }]}>
            {attack.reminders.map((r) => {
              const isUsed = usedRiderIds.has(r.id);
              const hasResource = !!r.resourceCost;
              const res = hasResource ? findResourceByLabel(parseResourceCost(r.resourceCost!).label) : null;
              const canAfford = res ? res.current >= parseResourceCost(r.resourceCost!).amount : false;
              return (
                <View
                  key={r.id}
                  style={[styles.reminder, {
                    backgroundColor: isUsed ? c.muted : c.secondary,
                    borderRadius: c.radius,
                    opacity: isUsed ? 0.75 : 1,
                  }]}
                >
                  <View style={styles.reminderHeader}>
                    <Text style={[styles.reminderName, { color: isUsed ? c.mutedForeground : c.foreground }]}>
                      {r.name}
                    </Text>
                    {r.resourceCost && (
                      <View style={[styles.costBadge, {
                        backgroundColor: isUsed ? c.muted : "#7C3AED20",
                      }]}>
                        <Text style={[styles.costText, { color: isUsed ? c.mutedForeground : "#A78BFA" }]}>
                          {r.resourceCost}
                        </Text>
                      </View>
                    )}
                  </View>
                  {r.condition && (
                    <Text style={[styles.condition, { color: c.primary }]}>When: {r.condition}</Text>
                  )}
                  <Text style={[styles.reminderDesc, { color: c.mutedForeground }]}>{r.description}</Text>

                  {/* Interactive Use button for riders with a resource cost */}
                  {hasResource && (
                    <View style={styles.riderActions}>
                      {isUsed ? (
                        <>
                          <View style={[styles.usedRiderBadge, { backgroundColor: c.muted }]}>
                            <Feather name="check" size={11} color={c.mutedForeground} />
                            <Text style={[styles.usedRiderText, { color: c.mutedForeground }]}>Used</Text>
                          </View>
                          {!combat.active ? (
                            <TouchableOpacity
                              onPress={() => handleUndoRider(r.id, r.resourceCost!, r.description)}
                              activeOpacity={0.7}
                              style={[styles.undoRiderBtn, { backgroundColor: c.secondary }]}
                            >
                              <Feather name="rotate-ccw" size={11} color={c.mutedForeground} />
                              <Text style={[styles.undoRiderText, { color: c.mutedForeground }]}>Undo</Text>
                            </TouchableOpacity>
                          ) : null}
                        </>
                      ) : (
                        <TouchableOpacity
                          onPress={() => { void handleUseRider(r.id, r.resourceCost!, r.description); }}
                          activeOpacity={0.8}
                          disabled={!canAfford && !!res}
                          style={[styles.useRiderBtn, {
                            backgroundColor: canAfford || !res ? "#7C3AED22" : c.muted,
                            borderColor: canAfford || !res ? "#A78BFA55" : c.border,
                          }]}
                        >
                          <Feather name="zap" size={11} color={canAfford || !res ? "#A78BFA" : c.mutedForeground} />
                          <Text style={[styles.useRiderText, { color: canAfford || !res ? "#A78BFA" : c.mutedForeground }]}>
                            {!res ? "Use" : canAfford ? `Use (${res.current} left)` : "No points left"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        </> : null}
      </Card>

      {/* Extra Damage Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.card, borderRadius: c.radius * 2 }]}>
            <ScrollHintScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: c.foreground }]}>Extra Damage</Text>
              <Text style={[styles.modalSub, { color: c.mutedForeground }]}>
                Additional damage dice applied on top of the base roll.
              </Text>

              {/* Own extras — editable */}
              {editOwnExtras.map((extra, i) => (
                <View
                  key={i}
                  style={[styles.extraRow, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                >
                  <Text style={[styles.extraText, { color: "#A78BFA" }]}>
                    {extra.dice} {extra.damageType}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveExtra(i)}
                    style={[styles.removeBtn, { backgroundColor: c.muted, borderRadius: 6 }]}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={14} color={c.destructive} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Injected extras from accessories — read-only */}
              {injectedExtras.map((extra, i) => (
                <View
                  key={`inj-${i}`}
                  style={[styles.extraRow, { backgroundColor: c.muted, borderRadius: c.radius, opacity: 0.6 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.extraText, { color: c.mutedForeground }]}>
                      {extra.dice} {extra.damageType}
                    </Text>
                    <Text style={{ fontSize: 10, color: c.mutedForeground, marginTop: 1 }}>
                      From: {extra.sourceLabel}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: c.mutedForeground, paddingRight: 4 }}>auto</Text>
                </View>
              ))}

              {editOwnExtras.length === 0 && injectedExtras.length === 0 && (
                <Text style={{ color: c.mutedForeground, fontSize: 13, marginBottom: 12 }}>
                  No extra damage yet.
                </Text>
              )}

              {/* Add row */}
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Add extra damage</Text>
              <View style={styles.addRow}>
                <TextInput
                  value={newDice}
                  onChangeText={setNewDice}
                  placeholder="Dice (e.g. 1d4)"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.addInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius }]}
                />
                <TextInput
                  value={newDmgType}
                  onChangeText={setNewDmgType}
                  placeholder="Type (e.g. fire)"
                  placeholderTextColor={c.mutedForeground}
                  autoCapitalize="none"
                  style={[styles.addInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius }]}
                />
                <TouchableOpacity
                  onPress={handleAddExtra}
                  disabled={!newDice.trim() || !newDmgType.trim()}
                  style={[
                    styles.addBtn,
                    { backgroundColor: newDice.trim() && newDmgType.trim() ? c.primary : c.muted, borderRadius: c.radius },
                  ]}
                  activeOpacity={0.7}
                >
                  <Feather
                    name="plus"
                    size={18}
                    color={newDice.trim() && newDmgType.trim() ? c.primaryForeground : c.mutedForeground}
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginTop: 14 }]}>Max targets</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => setMaxTargets(undefined)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: !attack.maxTargets ? c.primary : c.border,
                    backgroundColor: !attack.maxTargets ? c.primary + "22" : c.secondary,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: !attack.maxTargets ? c.primary : c.mutedForeground }}>Any</Text>
                </TouchableOpacity>
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = (attack.maxTargets ?? 1) === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setMaxTargets(n)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.primary + "22" : c.secondary,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: active ? c.primary : c.mutedForeground }}>×{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollHintScrollView>

            {/* Footer buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={handleSaveExtras}
                style={[styles.saveBtn, { backgroundColor: c.primary, borderRadius: c.radius }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveBtnText, { color: c.primaryForeground }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={[styles.cancelBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, { color: c.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  header: { marginBottom: 12 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  titlePressArea: { flex: 1, minWidth: 0 },
  name: { fontSize: 18, fontWeight: "700", flexShrink: 1, lineHeight: 24 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
    rowGap: 8,
    flexShrink: 0,
    maxWidth: "48%",
  },
  pinnedBanner: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pinnedText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  editBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  statChip: { alignItems: "center" },
  statLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: "700" },

  calcSection: { borderTopWidth: 1, paddingTop: 12, marginBottom: 8 },
  calcRow: { flexDirection: "row", alignItems: "center" },
  calcLabel: { fontSize: 12, fontWeight: "600", width: 58 },
  calcRight: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  dieBtn: {
    width: 34,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dieBtnText: { fontSize: 18 },
  rollInput: {
    width: 60,
    height: 40,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  bonusText: { fontSize: 14, fontWeight: "600", minWidth: 28, textAlign: "center" },
  equalsText: { fontSize: 14, color: "#6B7280" },
  resultBox: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  resultText: { fontSize: 20, fontWeight: "800" },

  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  totalLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  totalBox: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 72,
    alignItems: "center",
  },
  totalText: { fontSize: 22, fontWeight: "800" },

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

  useActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  useActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
  },
  useActionText: { fontSize: 12, fontWeight: "700" },
  combatPip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  usedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  usedBadgeText: { fontSize: 11, fontWeight: "600" },

  critBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 2,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F59E0B22",
  },
  critText: { fontSize: 15, fontWeight: "800", color: "#F59E0B", letterSpacing: 1.5 },
  critSub: { fontSize: 11, fontWeight: "600", color: "#F59E0B99" },
  critMultiplier: { fontSize: 13, fontWeight: "800", color: "#F59E0B" },

  notes: { fontSize: 12, fontStyle: "italic", marginBottom: 8 },
  reminderToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  reminderToggleText: { fontSize: 13, fontWeight: "600" },
  reminders: { marginTop: 10, borderTopWidth: 1, paddingTop: 10, gap: 8 },
  reminder: { padding: 10 },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  reminderName: { fontSize: 13, fontWeight: "700", flex: 1 },
  costBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  costText: { fontSize: 11, fontWeight: "600" },
  condition: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  reminderDesc: { fontSize: 12, lineHeight: 17 },
  riderActions: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  useRiderBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1,
  },
  useRiderText: { fontSize: 11, fontWeight: "700" },
  usedRiderBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5,
  },
  usedRiderText: { fontSize: 11, fontWeight: "600" },
  undoRiderBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5,
  },
  undoRiderText: { fontSize: 11, fontWeight: "600" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  modalContent: { padding: 20, maxHeight: "80%", margin: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  extraRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  extraText: { flex: 1, fontSize: 14, fontWeight: "700" },
  removeBtn: { padding: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  addRow: { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 16 },
  addInput: { flex: 1, padding: 10, fontSize: 13 },
  addBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  modalFooter: { flexDirection: "row", gap: 10, paddingTop: 8 },
  saveBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { fontSize: 15, fontWeight: "700" },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontWeight: "600" },
});
