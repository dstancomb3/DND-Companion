import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  Alert,
  ScrollView,
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { AttackCard } from "@/components/attacks/AttackCard";
import { ActionCard } from "@/components/attacks/ActionCard";
import { CombatHUD } from "@/components/attacks/CombatHUD";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { useCombat } from "@/context/CombatContext";
import { useParty } from "@/context/PartyContext";
import type { Attack, InventoryItem, ClassFeature, PreparedSpell, SpellSlotLevel } from "@/types";
import type { CombatActionResult } from "@/types/combatResolution";
import { getCombatRejectMessage, formatOutcomeSummary, formatReactionWindowMessage } from "@/utils/combat/combatFeedback";
import { useEquippedEffects, SpellEffectEntry } from "@/hooks/useEquippedEffects";
import { SPELL_LIST } from "@/data/spellList";
import { buildSpellDeclaredPayload } from "@/utils/combat/buildSpellDeclaredPayload";
import { buildDeclaredReaction } from "@/utils/combat/buildDeclaredReaction";
import { formatDeclaredSpellSummary, formatSpellCastEventMessage } from "@/utils/combat/spellMetadataPresentation";
import { ATTACK_COLOR, CONSUMABLE_COLOR, SPELL_COLOR, BONUS_ACTION_COLOR, REACTION_COLOR, FREE_ACTION_COLOR } from "@/constants/semanticColors";
import { collectActionableItemEffects } from "@/utils/combat/actionableItemEffects";
import { applyEquippedAttackAugments, collectEquippedAttackAugments } from "@/utils/combat/itemAttackAugments";
import {
  buildProjectedEffectPinUpdate,
} from "@/utils/mechanics/runtimeMechanicsCompatibility";
import { buildCombatActionCommand } from "@/utils/combat/buildCombatActionCommand";
import { buildWeaponAttackProfile } from "@/utils/combat/weaponAttackProfile";
import {
  appendCombatReadinessNotes,
  buildInventoryCombatReadinessNotes,
} from "@/utils/combat/inventoryCombatReadiness";
import { getCombatNpcPresentation } from "@/utils/combat/companionCombatPresentation";

const SLOT_LABEL: Record<number, string> = {
  1:"1st",2:"2nd",3:"3rd",4:"4th",5:"5th",6:"6th",7:"7th",8:"8th",9:"9th",
};

const CUSTOM_SPELLS_STORAGE_KEY = "@custom_spell_catalog_v1";

type CatalogSpell = {
  name: string;
  level: number;
  school?: string;
  castingTime?: string;
  range?: string;
  duration?: string;
  concentration?: boolean;
  ritual?: boolean;
  desc?: string;
  source: "official" | "custom";
};

function normalizeSpellKey(name: string, level: number) {
  return `${name.trim().toLowerCase()}::${level}`;
}

function actionKindForSpellCastingTime(castingTime?: string): "action" | "bonus_action" | "reaction" {
  const value = (castingTime ?? "").toLowerCase();
  if (value.includes("bonus")) return "bonus_action";
  if (value.includes("reaction")) return "reaction";
  return "action";
}

function parseDurationToRounds(duration?: string): number {
  if (!duration) return 10;
  const lower = duration.toLowerCase();
  if (lower.includes("hour")) return 600;
  if (lower.includes("minute")) {
    const m = lower.match(/(\d+)/);
    return m ? parseInt(m[1], 10) * 10 : 10;
  }
  if (lower.includes("round")) {
    const m = lower.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }
  return 10;
}

function SourceTag({ sourceTag, mode }: { sourceTag: "official" | "custom"; mode: "full" | "compact" | "dot" | "hidden" }) {
  const c = useColors();
  const sc = useMemo(() => makeSc(c), [c]);
  if (mode === "hidden") return null;
  if (mode === "dot") {
    return <View style={sourceTag === "custom" ? sc.customDot : sc.officialDot} />;
  }
  const label = mode === "compact" ? (sourceTag === "custom" ? "C" : "O") : (sourceTag === "custom" ? "CUSTOM" : "OFFICIAL");
  return (
    <View style={sourceTag === "custom" ? sc.customBadge : sc.officialBadge}>
      <Text style={sourceTag === "custom" ? sc.customBadgeText : sc.officialBadgeText}>{label}</Text>
    </View>
  );
}

function showCombatRejectAlert(reasonCode?: string, title = "Action Rejected") {
  Alert.alert(title, getCombatRejectMessage(reasonCode));
}

function wasCombatActionAccepted(result: CombatActionResult, title = "Action Rejected"): boolean {
  if (result.status === "accepted") {
    const summary = formatOutcomeSummary(result);
    if (summary) {
      Alert.alert("Action Outcome", summary);
    }
    return true;
  }
  showCombatRejectAlert(result.reasonCode, title);
  return false;
}

function applyInventoryCombatReadinessNotes(attack: Attack, inventory: InventoryItem[]): Attack {
  if (!attack.linkedInventoryItemId) return attack;
  const sourceItem = inventory.find((item) => item.id === attack.linkedInventoryItemId);
  if (!sourceItem) return attack;

  const readinessNotes = buildInventoryCombatReadinessNotes(sourceItem, inventory);
  if (readinessNotes.length === 0) return attack;

  return {
    ...attack,
    notes: appendCombatReadinessNotes(attack.notes, readinessNotes),
  };
}

// ── Cantrip action card ────────────────────────────────────────────────────────
function CantripCard({ spell, sourceTag, sourceTagMode, onCast, onUndo }: {
  spell: PreparedSpell;
  sourceTag: "official" | "custom";
  sourceTagMode: "full" | "compact" | "dot" | "hidden";
  onCast: (spell: PreparedSpell) => Promise<boolean>;
  onUndo: (spell: PreparedSpell) => Promise<boolean>;
}) {
  const c = useColors();
  const sc = useMemo(() => makeSc(c), [c]);
  const combat = useCombat();
  const { isInParty, memberId, members } = useParty();
  const [used, setUsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const canExpand = Boolean(spell.description?.trim());
  const isMyTurn = !combat.currentTurnId || combat.currentTurnId === memberId;
  const canShowUseButtons = !(combat.active && isInParty && !isMyTurn);
  const canUndo = !combat.active;
  useEffect(() => { setUsed(false); }, [combat.turnKey]);

  async function handleCast() {
    const accepted = await onCast(spell);
    if (accepted) setUsed(true);
  }

  async function handleUndo() {
    const accepted = await onUndo(spell);
    if (accepted) setUsed(false);
  }

  return (
    <TouchableOpacity
      onPress={() => { if (canExpand) setExpanded(v => !v); }}
      activeOpacity={0.75}
      style={[sc.card, {
        backgroundColor: used ? c.secondary : c.card,
        borderColor: c.border,
        borderLeftColor: used ? c.mutedForeground : "#A78BFA",
        opacity: used ? 0.7 : 1,
      }]}
    >
      <View style={sc.row}>
        <View style={[sc.badge, { backgroundColor: used ? c.muted : "#A78BFA22" }]}>
          <Feather name={used ? "check" : "zap"} size={11} color={used ? c.mutedForeground : "#A78BFA"} />
          <Text style={[sc.badgeText, { color: used ? c.mutedForeground : "#A78BFA" }]}>
            {used ? "USED" : "CANTRIP"}
          </Text>
        </View>
        <Text style={[sc.name, { color: used ? c.mutedForeground : c.foreground }]} numberOfLines={expanded ? undefined : 1}>
          {spell.name}
        </Text>
        <SourceTag sourceTag={sourceTag} mode={sourceTagMode} />
        {canExpand ? <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} /> : null}
      </View>
      <Text style={[sc.source, { color: c.mutedForeground }]}>
        Cantrip{spell.school ? `  ·  ${spell.school}` : ""}
        {spell.castingTime ? `  ·  ${spell.castingTime}` : ""}
      </Text>
      {expanded && spell.description ? (
        <Text style={[sc.desc, { color: c.foreground }]}>{spell.description}</Text>
      ) : null}
      <View style={sc.actionRow}>
        {used && canUndo ? (
          <TouchableOpacity onPress={e => { e.stopPropagation?.(); void handleUndo(); }} activeOpacity={0.8}
            style={[sc.undoBtn, { backgroundColor: c.muted, borderColor: c.border }]}>
            <Feather name="rotate-ccw" size={12} color={c.mutedForeground} />
            <Text style={[sc.undoBtnText, { color: c.mutedForeground }]}>Undo</Text>
          </TouchableOpacity>
        ) : !used ? (
          <TouchableOpacity onPress={e => { e.stopPropagation?.(); void handleCast(); }} activeOpacity={0.8}
            style={[sc.castBtn, { backgroundColor: "#A78BFA22", borderColor: "#A78BFA55" }]}>
            <Feather name="zap" size={12} color="#A78BFA" />
            <Text style={[sc.castBtnText, { color: "#A78BFA" }]}>Cast</Text>
            {combat.active && <View style={[sc.combatPip, { backgroundColor: "#A78BFA" }]} />}
          </TouchableOpacity>
        ) : null}
        {!canShowUseButtons && combat.active ? (
          <View style={[sc.undoBtn, { backgroundColor: c.muted, borderColor: c.border }]}> 
            <Feather name="info" size={12} color={c.mutedForeground} />
            <Text style={[sc.undoBtnText, { color: c.mutedForeground }]}>Out of turn (resolver will validate)</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Leveled spell card ─────────────────────────────────────────────────────────
function SpellCastCard({
  spell, spellSlots, onCastRequest, onUndo, sourceTag, sourceTagMode,
}: {
  spell: PreparedSpell;
  spellSlots: SpellSlotLevel[];
  onCastRequest: (sp: PreparedSpell) => void;
  onUndo: (sp: PreparedSpell) => Promise<boolean>;
  sourceTag: "official" | "custom";
  sourceTagMode: "full" | "compact" | "dot" | "hidden";
}) {
  const c = useColors();
  const sc = useMemo(() => makeSc(c), [c]);
  const combat = useCombat();
  const { isInParty, memberId, members } = useParty();
  const [used, setUsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const canExpand = Boolean(spell.description?.trim());
  const isMyTurn = !combat.currentTurnId || combat.currentTurnId === memberId;
  const canShowUseButtons = !(combat.active && isInParty && !isMyTurn);
  const canUndo = !combat.active;
  useEffect(() => { setUsed(false); }, [combat.turnKey]);

  const available = spellSlots.filter(s => s.level >= spell.level && s.total - s.used > 0);
  const hasSlot = available.length > 0;

  async function handleCast() {
    onCastRequest(spell);
  }

  async function handleUndo() {
    const accepted = await onUndo(spell);
    if (accepted) setUsed(false);
  }

  return (
    <TouchableOpacity
      onPress={() => { if (canExpand) setExpanded(v => !v); }}
      activeOpacity={0.75}
      style={[sc.card, {
        backgroundColor: used ? c.secondary : c.card,
        borderColor: c.border,
        borderLeftColor: used ? c.mutedForeground : "#A78BFA",
        opacity: used || !hasSlot ? (used ? 0.7 : 0.5) : 1,
      }]}
    >
      <View style={sc.row}>
        <View style={[sc.badge, { backgroundColor: used ? c.muted : "#A78BFA22" }]}>
          <Text style={[sc.badgeText, { color: used ? c.mutedForeground : "#A78BFA" }]}>
            {used ? "USED" : SLOT_LABEL[spell.level] ?? `${spell.level}th`}
          </Text>
        </View>
        <Text style={[sc.name, { color: used ? c.mutedForeground : c.foreground }]} numberOfLines={expanded ? undefined : 1}>
          {spell.name}
        </Text>
        <SourceTag sourceTag={sourceTag} mode={sourceTagMode} />
        <Text style={[sc.slotCount, { color: hasSlot ? "#A78BFA" : c.mutedForeground }]}>
          {available.length > 0 ? `${available[0].total - available[0].used} left` : "no slots"}
        </Text>
        {canExpand ? <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} /> : null}
      </View>
      <Text style={[sc.source, { color: c.mutedForeground }]}>
        {spell.school ?? "Spell"}
        {spell.castingTime ? `  ·  ${spell.castingTime}` : ""}
        {spell.concentration ? "  ·  Conc" : ""}
      </Text>
      {expanded && spell.description ? (
        <Text style={[sc.desc, { color: c.foreground }]}>{spell.description}</Text>
      ) : null}
      <View style={sc.actionRow}>
        {used && canUndo ? (
          <TouchableOpacity onPress={e => { e.stopPropagation?.(); void handleUndo(); }} activeOpacity={0.8}
            style={[sc.undoBtn, { backgroundColor: c.muted, borderColor: c.border }]}>
            <Feather name="rotate-ccw" size={12} color={c.mutedForeground} />
            <Text style={[sc.undoBtnText, { color: c.mutedForeground }]}>Undo</Text>
          </TouchableOpacity>
        ) : !used ? (
          <TouchableOpacity onPress={e => { e.stopPropagation?.(); if (hasSlot) void handleCast(); }} activeOpacity={hasSlot ? 0.8 : 1}
            style={[sc.castBtn, {
              backgroundColor: hasSlot ? "#A78BFA22" : c.muted,
              borderColor: hasSlot ? "#A78BFA55" : c.border,
            }]}>
            <Feather name="zap" size={12} color={hasSlot ? "#A78BFA" : c.mutedForeground} />
            <Text style={[sc.castBtnText, { color: hasSlot ? "#A78BFA" : c.mutedForeground }]}>
              {hasSlot ? "Cast" : "No slots"}
            </Text>
            {combat.active && hasSlot && <View style={[sc.combatPip, { backgroundColor: "#A78BFA" }]} />}
          </TouchableOpacity>
        ) : null}
        {!canShowUseButtons && combat.active ? (
          <View style={[sc.undoBtn, { backgroundColor: c.muted, borderColor: c.border }]}> 
            <Feather name="info" size={12} color={c.mutedForeground} />
            <Text style={[sc.undoBtnText, { color: c.mutedForeground }]}>Out of turn (resolver will validate)</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Consumable card ────────────────────────────────────────────────────────────
function ConsumableCard({
  item, onUse,
}: { item: InventoryItem; onUse: () => void }) {
  const c = useColors();
  const sc = useMemo(() => makeSc(c), [c]);
  const combat = useCombat();
  const { isInParty, memberId, members } = useParty();
  const [used, setUsed] = useState(false);
  const qty = item.quantity ?? 1;
  const isMyTurn = !combat.currentTurnId || combat.currentTurnId === memberId;
  const canShowUseButtons = !(combat.active && isInParty && !isMyTurn);

  async function handleUse() {
    const command = buildCombatActionCommand({
      sourceType: "consumable",
      sourceId: item.id,
      sourceName: item.name,
      itemId: item.id,
      actionKind: "action",
      metadata: {
        eventType: "player_action_used",
        eventMessage: `Consumable: ${item.name}`,
        eventMetadata: {
          itemName: item.name,
          itemType: "consumable",
        },
      },
    });
    const result = await combat.resolveCombatAction(command);
    if (result.status !== "accepted") {
      showCombatRejectAlert(result.reasonCode);
      return;
    }
    setUsed(true);
    onUse();
  }

  return (
    <View style={[sc.card, {
      backgroundColor: used ? c.secondary : c.card,
      borderColor: c.border,
      borderLeftColor: used ? c.mutedForeground : CONSUMABLE_COLOR,
      opacity: used ? 0.7 : 1,
    }]}>
      <View style={sc.row}>
        <View style={[sc.badge, { backgroundColor: used ? c.muted : CONSUMABLE_COLOR + "22" }]}>
          <Feather name={used ? "check" : "package"} size={11} color={used ? c.mutedForeground : CONSUMABLE_COLOR} />
          <Text style={[sc.badgeText, { color: used ? c.mutedForeground : CONSUMABLE_COLOR }]}> 
            {used ? "USED" : "ITEM"}
          </Text>
        </View>
        <Text style={[sc.name, { color: used ? c.mutedForeground : c.foreground }]}>{item.name}</Text>
        <Text style={[sc.slotCount, { color: c.mutedForeground }]}>×{qty}</Text>
      </View>
      {item.notes ? (
        <Text style={[sc.preview, { color: c.mutedForeground }]} numberOfLines={2}>{item.notes}</Text>
      ) : null}
      <View style={sc.actionRow}>
        <TouchableOpacity onPress={() => { void handleUse(); }} disabled={used} activeOpacity={0.8}
          style={[sc.castBtn, {
            backgroundColor: used ? c.muted : CONSUMABLE_COLOR + "22",
            borderColor: used ? c.border : CONSUMABLE_COLOR + "55",
          }]}>
          <Feather name="zap" size={12} color={used ? c.mutedForeground : CONSUMABLE_COLOR} />
          <Text style={[sc.castBtnText, { color: used ? c.mutedForeground : CONSUMABLE_COLOR }]}> 
            {used ? "Used" : "Use Item"}
          </Text>
          {combat.active && !used && <View style={[sc.combatPip, { backgroundColor: CONSUMABLE_COLOR }]} />}
        </TouchableOpacity>
        {!canShowUseButtons && combat.active ? (
          <View style={[sc.undoBtn, { backgroundColor: c.muted, borderColor: c.border }]}> 
            <Feather name="info" size={12} color={c.mutedForeground} />
            <Text style={[sc.undoBtnText, { color: c.mutedForeground }]}>Out of turn (resolver will validate)</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Equipment Spell card ───────────────────────────────────────────────────────
const RESET_LABELS: Record<string, string> = {
  short_rest: "Short Rest",
  long_rest: "Long Rest",
  dawn: "Dawn",
};

function EquipmentSpellCard({
  spell, remaining, onCast,
}: { spell: SpellEffectEntry; remaining: number; onCast: () => void }) {
  const c = useColors();
  const sc = useMemo(() => makeSc(c), [c]);
  const combat = useCombat();
  const { isInParty, memberId, members } = useParty();
  const isEmpty = remaining <= 0;
  const isMyTurn = !combat.currentTurnId || combat.currentTurnId === memberId;
  const canShowUseButtons = !(combat.active && isInParty && !isMyTurn);

  async function handleCast() {
    if (isEmpty) return;
    const command = buildCombatActionCommand({
      sourceType: "item_spell",
      sourceId: spell.effectId,
      sourceName: spell.label,
      itemId: spell.itemId,
      actionKind: "action",
      metadata: {
        eventType: "player_spell_cast",
        eventMessage: `Cast item spell: ${spell.label}`,
        eventMetadata: {
          spellName: spell.label,
          sourceItem: spell.itemName,
        },
      },
    });
    const result = await combat.resolveCombatAction(command);
    if (result.status !== "accepted") {
      showCombatRejectAlert(result.reasonCode);
      return;
    }
    onCast();
  }

  return (
    <View style={[sc.card, {
      backgroundColor: c.card,
      borderColor: isEmpty ? c.border : "#8B5CF640",
      borderLeftColor: isEmpty ? c.border : "#8B5CF6",
      opacity: isEmpty ? 0.6 : 1,
    }]}>
      <View style={sc.row}>
        <View style={[sc.badge, { backgroundColor: isEmpty ? c.muted : "#8B5CF622" }]}>
          <Feather name="zap" size={11} color={isEmpty ? c.mutedForeground : "#8B5CF6"} />
          <Text style={[sc.badgeText, { color: isEmpty ? c.mutedForeground : "#8B5CF6" }]}>
            ITEM SPELL
          </Text>
        </View>
        <Text style={[sc.name, { color: isEmpty ? c.mutedForeground : c.foreground }]} numberOfLines={1}>
          {spell.label}
        </Text>
        <Text style={[sc.slotCount, { color: isEmpty ? c.mutedForeground : "#8B5CF6" }]}>
          {remaining}/{spell.uses}
        </Text>
      </View>
      <Text style={[sc.source, { color: "#8B5CF6" }]}>{spell.itemName}  ·  Resets: {RESET_LABELS[spell.resetOn] ?? spell.resetOn}</Text>
      {spell.description ? (
        <Text style={[sc.preview, { color: c.mutedForeground }]} numberOfLines={2}>{spell.description}</Text>
      ) : null}
      <View style={sc.actionRow}>
        <TouchableOpacity
          onPress={() => { void handleCast(); }}
          disabled={isEmpty}
          activeOpacity={0.8}
          style={[sc.castBtn, {
            backgroundColor: isEmpty ? c.muted : "#8B5CF622",
            borderColor: isEmpty ? c.border : "#8B5CF655",
          }]}
        >
          <Feather name="zap" size={12} color={isEmpty ? c.mutedForeground : "#8B5CF6"} />
          <Text style={[sc.castBtnText, { color: isEmpty ? c.mutedForeground : "#8B5CF6" }]}> 
            {isEmpty ? "No uses left" : "Cast"}
          </Text>
          {combat.active && !isEmpty && <View style={[sc.combatPip, { backgroundColor: "#8B5CF6" }]} />}
        </TouchableOpacity>
        {!canShowUseButtons && combat.active ? (
          <View style={[sc.undoBtn, { backgroundColor: c.muted, borderColor: c.border }]}> 
            <Feather name="info" size={12} color={c.mutedForeground} />
            <Text style={[sc.undoBtnText, { color: c.mutedForeground }]}>Out of turn (resolver will validate)</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Shared styles for spell/consumable cards
const makeSc = (c: { radiusMd: number; radiusPill: number; radiusSm: number }) => StyleSheet.create({
  card: { borderWidth: 1, borderLeftWidth: 3, borderRadius: c.radiusMd, padding: 14, marginBottom: 10, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  name: { flex: 1, fontSize: 14, fontWeight: "700" },
  source: { fontSize: 11, marginLeft: 2 },
  slotCount: { fontSize: 11, fontWeight: "600" },
  officialBadge: { backgroundColor: "#2563EB22", borderColor: "#2563EB", borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 7, paddingVertical: 2 },
  officialBadgeText: { color: "#2563EB", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  officialDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2563EB" },
  customBadge: { backgroundColor: "#EF444422", borderColor: "#EF4444", borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 7, paddingVertical: 2 },
  customBadgeText: { color: "#EF4444", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  customDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  desc: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  preview: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  actionRow: { flexDirection: "row", marginTop: 6 },
  castBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: c.radiusSm, borderWidth: 1 },
  castBtnText: { fontSize: 12, fontWeight: "700" },
  undoBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: c.radiusSm, borderWidth: 1 },
  undoBtnText: { fontSize: 12, fontWeight: "600" },
  combatPip: { width: 6, height: 6, borderRadius: 3, marginLeft: 2 },
});

function ViewToggleButton({
  viewMode,
  onPress,
  align = "right",
}: {
  viewMode: "full" | "compact";
  onPress: () => void;
  align?: "right" | "inline";
}) {
  const c = useColors();
  const styles = useMemo(() => makePageStyles(c), [c]);

  return (
    <View style={align === "right" ? styles.viewToggleWrap : undefined}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.viewToggleBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
      >
        <Feather name={viewMode === "full" ? "grid" : "list"} size={13} color={c.foreground} />
        <Text style={[styles.viewToggleText, { color: c.foreground }]}>
          {viewMode === "full" ? "Grid" : "Full"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Section header ──────────────────────────────────────────────────────────
function sortPinnedFirst<T extends { pinned?: boolean }>(items: T[], compare?: (a: T, b: T) => number): T[] {
  return [...items].sort((a, b) => {
    if ((a.pinned ? 0 : 1) !== (b.pinned ? 0 : 1)) {
      return (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1);
    }
    return compare ? compare(a, b) : 0;
  });
}

function SectionLabel({ label, color }: { label: string; color: string }) {
  const c = useColors();
  const styles = useMemo(() => makePageStyles(c), [c]);
  return (
    <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
  );
}

// ── Compact chip used in grid view ───────────────────────────────────────────
interface CompactChipProps {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  pinned?: boolean;
  onTogglePin?: () => void;
  quickActionIcon?: string;
  sub?: string;
  detail?: string;
  detailRows?: { label: string; value: string }[];
  onUse?: () => boolean | void | Promise<boolean | void>;
  onUndo?: () => boolean | void | Promise<boolean | void>;
  expanded?: boolean;
  onPress?: () => void;
  used?: boolean;
  onUsedChange?: (used: boolean) => void;
  disabled?: boolean;
  hideQuickUse?: boolean;
}
function CompactChip({ name, badge, badgeColor, pinned = false, onTogglePin, quickActionIcon = "play", sub, detail, detailRows, onUse, onUndo, expanded = false, onPress, used = false, onUsedChange, disabled = false, hideQuickUse = false }: CompactChipProps) {
  const c = useColors();
  const sc2 = useMemo(() => makeSc2(c), [c]);
  const combat = useCombat();
  const suppressNextPressRef = useRef(false);

  async function toggleQuickAction() {
    if (!onUse) return;
    if (used) {
      if (combat.active) return;
      const undone = await onUndo?.();
      if (undone !== false) onUsedChange?.(false);
      return;
    }
    const consumed = await onUse();
    if (consumed !== false) onUsedChange?.(true);
  }

  if (expanded) {
    return (
      <TouchableOpacity
        onPress={() => {
          if (suppressNextPressRef.current) {
            suppressNextPressRef.current = false;
            return;
          }
          onPress?.();
        }}
        activeOpacity={0.9}
        style={[sc2.sheetInline, {
          backgroundColor: (used || disabled) ? c.secondary : c.card,
          borderColor: (used || disabled) ? c.border : badgeColor + "55",
          opacity: used ? 0.65 : disabled ? 0.45 : 1,
        }]}
      >
        <View style={[sc2.sheetStrip, { backgroundColor: (used || disabled) ? c.mutedForeground : badgeColor }]} />
        <View style={sc2.sheetBody}>
          <View style={sc2.sheetHeader}>
            <View style={[sc2.sheetBadge, { backgroundColor: (used || disabled) ? c.muted : badgeColor + "22" }]}>
              <Text style={[sc2.badgeText, { color: (used || disabled) ? c.mutedForeground : badgeColor }]}>{used ? "USED" : disabled ? "NO USES" : badge}</Text>
            </View>
            <Text style={[sc2.sheetTitle, { color: (used || disabled) ? c.mutedForeground : c.foreground }]}>{name}</Text>
            {pinned && (
              <View style={[sc2.pinnedBanner, { backgroundColor: c.primary + "15" }]}> 
                <MaterialCommunityIcons name="pin" size={11} color={c.primary} />
                <Text style={[sc2.pinnedText, { color: c.primary }]}>PINNED</Text>
              </View>
            )}
            <Feather name="chevron-up" size={16} color={c.mutedForeground} />
          </View>
          {!!sub && <Text style={[sc2.sheetSub, { color: c.mutedForeground }]}>{sub}</Text>}
          {detailRows && detailRows.length > 0 && (
            <View style={[sc2.detailBox, { backgroundColor: c.secondary }]}> 
              {detailRows.map((r, i) => (
                <View key={i} style={sc2.detailRow}>
                  <Text style={[sc2.detailLabel, { color: c.mutedForeground }]}>{r.label}</Text>
                  <Text style={[sc2.detailValue, { color: c.foreground }]}>{r.value}</Text>
                </View>
              ))}
            </View>
          )}
          {!!detail && (
            <Text style={[sc2.sheetDetail, { color: c.foreground }]}>{detail}</Text>
          )}
          <View style={sc2.sheetActions}>
            {onUse && !hideQuickUse && !(used && combat.active) && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  suppressNextPressRef.current = true;
                    void toggleQuickAction();
                }}
                style={[sc2.useBtn, {
                  backgroundColor: (used || disabled) ? c.muted : badgeColor + "22",
                  borderColor: (used || disabled) ? c.border : badgeColor + "55",
                }]}
              >
                <Text style={[sc2.useBtnText, { color: (used || disabled) ? c.mutedForeground : badgeColor }]}>{used ? "Undo" : disabled ? "No Uses" : "Use"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => {
        if (suppressNextPressRef.current) {
          suppressNextPressRef.current = false;
          return;
        }
        onPress?.();
      }}
      onLongPress={onTogglePin}
      activeOpacity={0.75}
      style={[sc2.chip, {
        backgroundColor: (used || disabled) ? c.secondary : c.card,
        borderColor: (used || disabled) ? c.border : badgeColor + "55",
        borderLeftColor: (used || disabled) ? c.border : badgeColor,
        opacity: used ? 0.65 : disabled ? 0.45 : 1,
      }]}
    >
      <View style={[sc2.badge, { backgroundColor: (used || disabled) ? c.muted : badgeColor + "22" }]}>
        <Text style={[sc2.badgeText, { color: (used || disabled) ? c.mutedForeground : badgeColor }]}>{used ? "USED" : disabled ? "NO USES" : badge}</Text>
      </View>
      {pinned && (
        <View style={[sc2.pinnedBanner, { backgroundColor: c.primary + "15" }]}> 
          <MaterialCommunityIcons name="pin" size={11} color={c.primary} />
          <Text style={[sc2.pinnedText, { color: c.primary }]}>PINNED</Text>
        </View>
      )}
      <Text style={[sc2.name, { color: c.foreground }]} numberOfLines={2}>{name}</Text>
      {!!sub && <Text style={[sc2.sub, { color: c.mutedForeground }]} numberOfLines={1}>{sub}</Text>}
      {used && (
        <View style={[sc2.usedBadge, { backgroundColor: c.muted }]}> 
          <Text style={[sc2.usedText, { color: c.mutedForeground }]}>USED</Text>
        </View>
      )}
      {onUse && !hideQuickUse && !(used && combat.active) && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            suppressNextPressRef.current = true;
            void toggleQuickAction();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
          style={[
            sc2.quickUseCorner,
            {
              borderColor: (used || disabled) ? c.border : badgeColor + "55",
              backgroundColor: (used || disabled) ? c.muted : badgeColor + "22",
            },
          ]}
        >
          <Feather name={quickActionIcon as React.ComponentProps<typeof Feather>["name"]} size={11} color={(used || disabled) ? c.mutedForeground : badgeColor} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
const makeSc2 = (c: { radiusMd: number; radiusXl: number; radiusSm: number }) => StyleSheet.create({
  chip: {
    flex: 1,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: c.radiusMd,
    padding: 10,
    gap: 4,
    minHeight: 80,
  },
  sheetInline: {
    borderWidth: 1,
    borderRadius: c.radiusXl,
    overflow: "hidden",
  },
  badge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  quickUseCorner: { position: "absolute", right: 8, bottom: 8, width: 22, height: 22, borderRadius: c.radiusSm, borderWidth: 1, alignItems: "center", justifyContent: "center", zIndex: 3 },
  pinnedBanner: { position: "absolute", top: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: c.radiusSm, zIndex: 2 },
  pinnedText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  name: { fontSize: 12, fontWeight: "700", lineHeight: 16, flex: 1, paddingRight: 76 },
  sub: { fontSize: 10, lineHeight: 13, paddingRight: 76 },
  usedBadge: { marginTop: 2, alignSelf: "flex-start", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  usedText: { fontSize: 9, fontWeight: "700" },
  sheetStrip: { height: 4, width: "100%" },
  sheetBody: { padding: 18 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sheetBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: c.radiusSm },
  sheetTitle: { fontSize: 17, fontWeight: "700", flex: 1, lineHeight: 21 },
  sheetSub: { fontSize: 13, marginBottom: 10 },
  detailBox: { borderRadius: c.radiusMd, padding: 12, marginBottom: 10, gap: 6 },
  detailRow: { flexDirection: "row", gap: 10 },
  detailLabel: { fontSize: 12, width: 90 },
  detailValue: { fontSize: 12, flex: 1, fontWeight: "600" },
  sheetDetail: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  useBtn: { flex: 1, paddingVertical: 10, borderRadius: c.radiusMd, alignItems: "center", borderWidth: 1 },
  useBtnText: { fontSize: 13, fontWeight: "700" },
});

// ── Compact section wrapper ───────────────────────────────────────────────────
function CompactSection({ label, color, items, hideQuickUse = false }: { label: string; color: string; items: CompactChipProps[]; hideQuickUse?: boolean }) {
  const c = useColors();
  const styles = useMemo(() => makePageStyles(c), [c]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [usedIds, setUsedIds] = useState<Record<string, boolean>>({});
  const combat = useCombat();
  useEffect(() => { setUsedIds({}); }, [combat.turnKey]);
  if (items.length === 0) return null;

  function setItemUsed(id: string, val: boolean) {
    setUsedIds(prev => ({ ...prev, [id]: val }));
  }
  return (
    <>
      <Text style={[styles.sectionLabel, { color, marginTop: 12, marginBottom: 6 }]}>{label}</Text>
      <View style={{ width: "100%" }}>
        {(() => {
          const rows = [];
          let compactRow: CompactChipProps[] = [];

          const flushCompactRow = (keyPrefix: string) => {
            if (compactRow.length === 0) return;
            const rowItems = compactRow;
            rows.push(
              <View key={`${label}-${keyPrefix}-${rowItems.map((item) => item.id).join("-")}`} style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                {rowItems.map((item) => (
                  <View key={item.id} style={{ flex: 1 }}>
                    <CompactChip
                      {...item}
                      hideQuickUse={hideQuickUse}
                      used={!!usedIds[item.id]}
                      onUsedChange={(val) => setItemUsed(item.id, val)}
                      onPress={() => setExpandedId((prev) => prev === item.id ? null : item.id)}
                    />
                  </View>
                ))}
                {Array.from({ length: Math.max(0, 3 - rowItems.length) }).map((_, spacerIdx) => (
                  <View key={`${label}-${keyPrefix}-spacer-${spacerIdx}`} style={{ flex: 1 }} />
                ))}
              </View>
            );
            compactRow = [];
          };

          for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            if (item.id === expandedId) {
              flushCompactRow(`before-${i}`);
              rows.push(
                <View key={`${label}-expanded-${item.id}`} style={{ width: "100%", marginBottom: 10 }}>
                  <CompactChip
                    {...item}
                    hideQuickUse={hideQuickUse}
                    expanded
                    used={!!usedIds[item.id]}
                    onUsedChange={(val) => setItemUsed(item.id, val)}
                    onPress={() => setExpandedId(null)}
                  />
                </View>
              );
              continue;
            }
            compactRow.push(item);
            if (compactRow.length === 3) flushCompactRow(`row-${i}`);
          }
          flushCompactRow("tail");
          return rows;
        })()}
      </View>
    </>
  );
}

export default function ActionsScreen() {
  const c = useColors();
  const styles = useMemo(() => makePageStyles(c), [c]);
  const params = useLocalSearchParams<{ navNotice?: string | string[]; navTick?: string | string[] }>();
  const { settings } = useAppSettings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    attacks, character, inventory, classFeatures,
    passiveFeatures, preparedSpells, spellSlots, expendSpellSlot, updateItem,
    updateAttack, updateSpell, updateClassFeature,
    spellEffectUses, useSpellEffect,
    itemActionUses, useItemEffect,
  } = useCharacter();

  const { spellEffects: equipmentSpells } = useEquippedEffects();
  const combat = useCombat();
  const { isInParty, memberId, members } = useParty();
  const [customCatalog, setCustomCatalog] = useState<CatalogSpell[]>([]);
  const [navNoticeText, setNavNoticeText] = useState<string | null>(null);
  const isMyTurn = !combat.currentTurnId || combat.currentTurnId === memberId;
  const actionRemaining = Math.max(0, combat.actionsTotal - combat.actionsUsed);
  const bonusRemaining = Math.max(0, combat.bonusActionsTotal - combat.bonusActionsUsed);
  const hasSpentEconomyThisTurn = combat.actionsUsed > 0
    || combat.bonusActionsUsed > 0
    || combat.reactionUsed
    || combat.movementUsed > 0;
  const reactionState = combat.pendingReactionWindow ? "pending" : combat.reactionUsed ? "spent" : "ready";
  const combatFlowText = !combat.active
    ? null
    : combat.pendingReactionWindow
      ? formatReactionWindowMessage(combat.pendingReactionWindow)
      : isMyTurn
        ? "Your turn: resolve one main action flow at a time. Resolver validates legality and authority."
        : "Waiting for active actor. You can review options and targets before your turn.";
  const npcPresentationById = useMemo(() => {
    return new Map(
      combat.combatNpcs.map((npc) => [npc.id, getCombatNpcPresentation(npc, members, memberId)])
    );
  }, [combat.combatNpcs, memberId, members]);
  const activeActorHint = useMemo(() => {
    if (combat.activeActorOptionId === "self") return "Self";
    const selected = combat.actorOptions.find((entry) => entry.id === combat.activeActorOptionId);
    return selected?.label ?? "Self";
  }, [combat.activeActorOptionId, combat.actorOptions]);

  useEffect(() => {
    const navNotice = Array.isArray(params.navNotice) ? params.navNotice[0] : params.navNotice;
    if (navNotice === "no-active-encounter" && !combat.active) {
      setNavNoticeText("No active encounter");
      return;
    }
    setNavNoticeText(null);
  }, [combat.active, params.navNotice, params.navTick]);

  useEffect(() => {
    if (!navNoticeText) return;
    const id = setTimeout(() => setNavNoticeText(null), 4500);
    return () => clearTimeout(id);
  }, [navNoticeText]);
  const selectedTargetSummary = useMemo(() => {
    if (combat.selectedTargetIds.size === 0) return "No targets selected";
    const names = combat.partyTargets
      .filter((target) => combat.selectedTargetIds.has(target.id))
      .map((target) => {
        if (target.type === "member" && target.id === memberId) return "Self";
        if (target.type === "npc") return npcPresentationById.get(target.id)?.displayName ?? target.name;
        return target.name;
      });
    if (names.length === 0) return "No targets selected";
    if (names.length <= 2) return names.join(" | ");
    return `${names.slice(0, 2).join(" | ")} +${names.length - 2} more`;
  }, [combat.partyTargets, combat.selectedTargetIds, memberId, npcPresentationById]);

  const handleActorSwitchRequest = (nextActorOptionId: string) => {
    if (nextActorOptionId === combat.activeActorOptionId) return;
    if (!hasSpentEconomyThisTurn) {
      combat.setActiveActorOptionId(nextActorOptionId);
      return;
    }

    Alert.alert(
      "Switch actor context?",
      "You already spent turn economy this turn. Switching only changes acting context and does not reset action, bonus action, reaction, or movement usage.",
      [
        { text: "Keep Current", style: "cancel" },
        { text: "Switch", style: "default", onPress: () => combat.setActiveActorOptionId(nextActorOptionId) },
      ]
    );
  };

  const [viewMode, setViewMode] = useState<"full" | "compact">("full");
  const isNarrowAttackGrid = width < 430;

  // Slot picker for leveled spells
  const [castingSpell, setCastingSpell] = useState<PreparedSpell | null>(null);
  const [castAttackRollInput, setCastAttackRollInput] = useState("");
  const [castAttackIsCritical, setCastAttackIsCritical] = useState(false);
  const [castSaveRollInputs, setCastSaveRollInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    async function loadCustomCatalog() {
      try {
        const raw = await AsyncStorage.getItem(CUSTOM_SPELLS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as CatalogSpell[]) : [];
        if (mounted) setCustomCatalog(Array.isArray(parsed) ? parsed.filter((s) => s?.name) : []);
      } catch {
        if (mounted) setCustomCatalog([]);
      }
    }
    loadCustomCatalog();
    return () => {
      mounted = false;
    };
  }, [preparedSpells.length]);

  useEffect(() => {
    if (!castingSpell) return;
    setCastAttackRollInput("");
    setCastAttackIsCritical(false);
    setCastSaveRollInputs({});
  }, [castingSpell?.id]);

  const officialCatalogMap = useMemo(() => {
    const map = new Map<string, CatalogSpell>();
    SPELL_LIST.forEach((entry) => {
      map.set(normalizeSpellKey(entry.name, entry.level), {
        name: entry.name,
        level: entry.level,
        school: entry.school,
        desc: entry.desc,
        source: "official",
      });
    });
    return map;
  }, []);

  const customCatalogSet = useMemo(() => {
    const set = new Set<string>();
    customCatalog.forEach((entry) => set.add(normalizeSpellKey(entry.name, entry.level)));
    return set;
  }, [customCatalog]);

  async function resolvePreparedSpellCast(
    spell: PreparedSpell,
    castAtLevel: number,
    attackRoll?: { total: number; isCritical?: boolean },
    saveRolls?: Record<string, number>,
  ): Promise<boolean> {
    const actionKind = actionKindForSpellCastingTime(spell.castingTime);
    const reactionWindow = actionKind === "reaction" ? combat.pendingReactionWindow : null;
    const selectedTargetIds = [...combat.selectedTargetIds];
    const officialSpellData = officialCatalogMap.get(normalizeSpellKey(spell.name, spell.level));
    const spellResolution = buildSpellDeclaredPayload({
      spell,
      characterClass: character.class,
      proficiencyBonus: character.proficiencyBonus,
      abilityScores: character.abilityScores,
      officialDescription: officialSpellData?.desc,
      castAtLevel,
      attackRollTotal: attackRoll?.total,
      attackRollIsCritical: attackRoll?.isCritical,
    });
    const declared = spellResolution.declared.save && saveRolls && Object.keys(saveRolls).length > 0
      ? {
          ...spellResolution.declared,
          save: {
            ...spellResolution.declared.save,
            targetRolls: saveRolls,
          },
        }
      : spellResolution.declared;
    const reactionDeclaration = actionKind === "reaction"
      ? buildDeclaredReaction({
          triggerType: reactionWindow?.triggerType,
          sourceType: "prepared_spell",
          sourceName: spell.name,
          spellLevel: castAtLevel,
        })
      : undefined;

    const command = buildCombatActionCommand({
      sourceType: "prepared_spell",
      sourceId: spell.id,
      sourceName: spell.name,
      actionKind,
      targetIds: selectedTargetIds,
      declared,
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
        eventType: "player_spell_cast",
        eventMessage: formatSpellCastEventMessage(spell.name, castAtLevel),
        eventMetadata: {
          spellName: spell.name,
          spellLevel: castAtLevel,
          activeActorLabel: combat.activeActorLabel,
          resourceModel: "player_turn_economy",
          selectedTargetIds,
          ...(reactionDeclaration?.declared
            ? {
                reactionDeclaredName: reactionDeclaration.declared.reactionName,
                reactionDeclaredKind: reactionDeclaration.declared.reactionKind,
                reactionTriggerType: reactionDeclaration.inferredTriggerType,
              }
            : {}),
          ...(reactionDeclaration?.limitation
            ? { reactionDeclarationLimitation: reactionDeclaration.limitation }
            : {}),
          ...(spellResolution.declared.save
            ? {
                declaredSaveAbility: spellResolution.declared.save.saveAbility,
                declaredSaveDc: spellResolution.declared.save.dc,
                declaredOnSave: spellResolution.declared.save.onSave,
                ...(saveRolls && Object.keys(saveRolls).length > 0
                  ? {
                      declaredTargetSaveRollCount: Object.keys(saveRolls).length,
                    }
                  : {}),
              }
            : {}),
          ...(spellResolution.declared.damagePackets?.length
            ? {
                declaredDamagePacketCount: spellResolution.declared.damagePackets.length,
              }
            : {}),
          ...(spellResolution.declared.spell
            ? {
                declaredSpellMode: spellResolution.declared.spell.mode,
                declaredTargetScopeHint: spellResolution.declared.spell.targetScopeHint,
                declaredDamageModel: spellResolution.declared.spell.damageModel,
                declaredParsingConfidence: spellResolution.declared.spell.parsingConfidence,
                declaredScalingSupported: spellResolution.declared.spell.scaling?.supported === true,
                declaredScalingSource: spellResolution.declared.spell.scaling?.source,
                declaredScalingLevelsAboveBase: spellResolution.declared.spell.scaling?.levelsAboveBase,
                declaredConcentrationRequired: spellResolution.declared.spell.concentration?.required === true,
                declaredConcentrationDuration: spellResolution.declared.spell.concentration?.durationText,
              }
            : {}),
          ...(spellResolution.spellAttack.detected
            ? {
                spellAttackDetected: true,
                ...(typeof spellResolution.spellAttack.attackBonus === "number"
                  ? { spellAttackBonus: spellResolution.spellAttack.attackBonus }
                  : {}),
                ...(typeof spellResolution.spellAttack.declaredAttackRoll === "number"
                  ? {
                      declaredAttackRoll: spellResolution.spellAttack.declaredAttackRoll,
                      declaredAttackRollCritical: spellResolution.spellAttack.declaredCritical === true,
                    }
                  : {}),
              }
            : {}),
          ...(spellResolution.resolutionLimitations.length > 0
            ? {
                resolutionLimitations: spellResolution.resolutionLimitations,
              }
            : {}),
          ...(reactionWindow
            ? {
                reactionWindowId: reactionWindow.windowId,
                reactionTriggerType: reactionWindow.triggerType,
              }
            : {}),
        },
        requiresResolution: spellResolution.requiresResolution,
        ...(spellResolution.resolutionLimitations.length > 0
          ? {
              resolutionLimitations: spellResolution.resolutionLimitations,
            }
          : {}),
      },
    });

    const result = await combat.resolveCombatAction(command);
    if (result.status !== "accepted") {
      showCombatRejectAlert(result.reasonCode, "Cast Rejected");
      return false;
    }

    const summaryText = formatOutcomeSummary(result);
    const targetNameById = Object.fromEntries(
      combat.partyTargets.map((target) => [target.id, target.name])
    ) as Record<string, string>;
    const declaredSummary = formatDeclaredSpellSummary({
      declared,
      resolutionLimitations: spellResolution.resolutionLimitations,
      targetNameById,
      targetOrderIds: selectedTargetIds,
      spellAttack: spellResolution.spellAttack,
    });
    const castDetails = [summaryText, declaredSummary].filter(Boolean).join("\n\n");
    if (castDetails) {
      Alert.alert("Cast Outcome", castDetails);
    }

    if (castAtLevel > 0) {
      expendSpellSlot(castAtLevel);
    }

    if (spell.concentration) {
      combat.addConcentrationSpell({
        id: spell.id,
        name: spell.name,
        rounds: parseDurationToRounds(spell.duration),
        casterId: character.id,
      });
    }

    return true;
  }

  async function undoPreparedSpellCast(spell: PreparedSpell): Promise<boolean> {
    const actionKind = actionKindForSpellCastingTime(spell.castingTime);
    const command = buildCombatActionCommand({
      sourceType: "prepared_spell",
      sourceId: spell.id,
      sourceName: spell.name,
      actionKind,
      mode: "undo",
      declared: { spellLevel: !spell.level || Number(spell.level) < 1 ? 0 : spell.level },
      metadata: {
        eventType: "player_spell_cast",
        eventMessage: `Undo spell: ${spell.name}`,
      },
    });
    const result = await combat.resolveCombatAction(command);
    if (result.status !== "accepted") {
      showCombatRejectAlert(result.reasonCode, "Undo Rejected");
      return false;
    }
    return true;
  }

  async function handleConfirmLeveledSpellCast(
    slotLevel: number,
    attackRoll?: { total: number; isCritical?: boolean },
    saveRolls?: Record<string, number>,
  ): Promise<void> {
    if (!castingSpell) return;
    const spell = castingSpell;
    setCastingSpell(null);
    await resolvePreparedSpellCast(spell, slotLevel, attackRoll, saveRolls);
  }

  const castTargetAttackHint = useMemo(() => {
    if (!castingSpell) return { requiresAttackRoll: false as const, suggestedAttackBonus: undefined as number | undefined };
    const officialSpellData = officialCatalogMap.get(normalizeSpellKey(castingSpell.name, castingSpell.level));
    const preview = buildSpellDeclaredPayload({
      spell: castingSpell,
      characterClass: character.class,
      proficiencyBonus: character.proficiencyBonus,
      abilityScores: character.abilityScores,
      officialDescription: officialSpellData?.desc,
      castAtLevel: !castingSpell.level || Number(castingSpell.level) < 1 ? 0 : castingSpell.level,
    });
    return {
      requiresAttackRoll: preview.spellAttack.detected,
      suggestedAttackBonus: preview.spellAttack.attackBonus,
    };
  }, [castingSpell, officialCatalogMap, character.class, character.proficiencyBonus, character.abilityScores]);

  const castTargetSaveHint = useMemo(() => {
    if (!castingSpell) {
      return {
        requiresSaveRolls: false as const,
        saveAbility: undefined as string | undefined,
        saveDc: undefined as number | undefined,
        saveTargets: [] as Array<{ id: string; name: string }>,
      };
    }
    const officialSpellData = officialCatalogMap.get(normalizeSpellKey(castingSpell.name, castingSpell.level));
    const preview = buildSpellDeclaredPayload({
      spell: castingSpell,
      characterClass: character.class,
      proficiencyBonus: character.proficiencyBonus,
      abilityScores: character.abilityScores,
      officialDescription: officialSpellData?.desc,
      castAtLevel: !castingSpell.level || Number(castingSpell.level) < 1 ? 0 : castingSpell.level,
    });
    const selectedTargetIds = new Set(combat.selectedTargetIds);
    const saveTargets = combat.partyTargets
      .filter((target) => selectedTargetIds.has(target.id))
      .map((target) => ({ id: target.id, name: target.name }));
    return {
      requiresSaveRolls: Boolean(preview.declared.save),
      saveAbility: preview.declared.save?.saveAbility,
      saveDc: preview.declared.save?.dc,
      saveTargets,
    };
  }, [castingSpell, officialCatalogMap, character.class, character.proficiencyBonus, character.abilityScores, combat.selectedTargetIds, combat.partyTargets]);

  function getSpellSourceTag(spell: PreparedSpell): "official" | "custom" {
    const key = normalizeSpellKey(spell.name, spell.level);
    if (customCatalogSet.has(key)) return "custom";
    const official = officialCatalogMap.get(key);
    if (!official) return "custom";
    const schoolMatches = (official.school ?? "") === (spell.school ?? "");
    const descMatches = (official.desc ?? "").trim() === (spell.description ?? "").trim();
    const hasCustomOverrides = Boolean(
      (spell.castingTime ?? "1 action") !== "1 action" ||
      (spell.range ?? "").trim() ||
      (spell.duration ?? "").trim() ||
      spell.concentration ||
      spell.ritual
    );
    return schoolMatches && descMatches && !hasCustomOverrides ? "official" : "custom";
  }

  function toggleItemPinned(itemId: string, pinned: boolean) {
    updateItem(itemId, { pinned });
  }

  function togglePreparedSpellPinned(spellId: string, pinned: boolean) {
    updateSpell(spellId, { pinned });
  }

  function toggleClassFeaturePinned(featureId: string, pinned: boolean) {
    updateClassFeature(featureId, { pinned });
  }

  function toggleItemEffectPinned(itemId: string, effectId: string, pinned: boolean) {
    const item = inventory.find((entry) => entry.id === itemId);
    if (!item) return;
    updateItem(itemId, buildProjectedEffectPinUpdate(item, effectId, pinned));
  }

  function getAttackPinned(attack: Attack): boolean {
    if (attack.linkedInventoryItemId) {
      const sourceItem = inventory.find((item) => item.id === attack.linkedInventoryItemId);
      return sourceItem?.pinned === true;
    }
    return attack.pinned === true;
  }

  function toggleAttackPinned(attack: Attack) {
    if (attack.linkedInventoryItemId) {
      const sourceItem = inventory.find((item) => item.id === attack.linkedInventoryItemId);
      if (!sourceItem) return;
      toggleItemPinned(sourceItem.id, !(sourceItem.pinned === true));
      return;
    }
    if (attack.id === "unarmed-strike") return;
    updateAttack(attack.id, { pinned: !attack.pinned });
  }

  // ── Spells partitioned by level (prepared only) ────────────────────────────
  const cantripSpells = sortPinnedFirst(
    preparedSpells.filter(sp => sp.prepared && (!sp.level || Number(sp.level) < 1)),
    (a, b) => a.name.localeCompare(b.name),
  );
  const leveledSpells = sortPinnedFirst(
    preparedSpells.filter(sp => sp.prepared && sp.level && Number(sp.level) > 0),
    (a, b) => a.level - b.level || a.name.localeCompare(b.name),
  );

  // ── Consumables (shown in combat) ──────────────────────────────────────────
  const consumables = sortPinnedFirst(
    inventory.filter(item => item.category === "consumable" && (item.quantity ?? 1) > 0),
    (a, b) => a.name.localeCompare(b.name),
  );

  // ── Unarmed Strike (hidden only when a two-handed weapon is equipped — free hand gone) ──
  const equippedWeapons = inventory.filter(item => item.equipped && item.category === "weapon");
  const hasNonUnarmedWeapon = equippedWeapons.some(
    item =>
      !(item.tags ?? []).includes("Unarmed Weapon") &&
      (item.tags ?? []).includes("Two-Handed")
  );
  const showUnarmed = !hasNonUnarmedWeapon;

  // A "merge weapon" is an equipped Unarmed Weapon item with suppressWeaponCard=true.
  // It is excluded from weaponAttacks but should power the unarmed strike card.
  const mergeWeapon = inventory.find(
    item =>
      item.equipped &&
      item.category === "weapon" &&
      (item.tags ?? []).includes("Unarmed Weapon") &&
      item.suppressWeaponCard === true
  ) ?? null;

  function buildUnarmedAttack(): Attack {
    // ── Merge weapon path: use the weapon's stats, subtitle the card ──────────
    if (mergeWeapon) {
      const ability = mergeWeapon.attackAbility ?? "strength";
      const proficient = mergeWeapon.isProficient !== false;
      const profile = buildWeaponAttackProfile({
        abilityScore: character.abilityScores[ability],
        proficiencyBonus: character.proficiencyBonus,
        isProficient: proficient,
        includeAbilityModifierInDamage: mergeWeapon.useAbilityModifierForDamage !== false,
        weaponDamageBonus: mergeWeapon.damageModifier ?? 0,
      });
      return {
        id: "unarmed-strike",
        name: mergeWeapon.name,
        attackBonus: profile.attackBonus,
        damageDice: mergeWeapon.damageDice ?? "1d4",
        damageModifier: profile.damageModifier,
        damageType: mergeWeapon.damageType ?? "bludgeoning",
        additionalDamage: mergeWeapon.additionalDamage,
        range: mergeWeapon.weaponRange,
        reminders: [],
        notes: "Replacing Unarmed Strike",
        linkedInventoryItemId: mergeWeapon.id,
      };
    }

    // ── Default path: standard unarmed strike scaled by class/level ──────────
    const isMonk = /monk/i.test(character.class ?? "");
    const strScore = character.abilityScores.strength;
    const dexScore = character.abilityScores.dexterity;
    const strMod = Math.floor((strScore - 10) / 2);
    const dexMod = Math.floor((dexScore - 10) / 2);
    const abilityMod = isMonk ? Math.max(strMod, dexMod) : strMod;
    const attackBonus = abilityMod + character.proficiencyBonus;
    let damageDice: string;
    if (isMonk) {
      const lvl = character.level;
      damageDice = lvl >= 17 ? "1d10" : lvl >= 11 ? "1d8" : lvl >= 5 ? "1d6" : "1d4";
    } else {
      damageDice = "1";
    }
    return {
      id: "unarmed-strike",
      name: "Unarmed Strike",
      attackBonus,
      damageDice,
      damageModifier: abilityMod,
      damageType: "bludgeoning",
      reminders: [],
      notes: isMonk ? `Martial Arts d${damageDice.replace("1d", "")} · STR or DEX (scales with level)` : undefined,
    };
  }

  const unarmedAttack = showUnarmed ? buildUnarmedAttack() : null;

  // ── Attack section (unchanged logic) ──────────────────────────────────────
  const staticAttacks = attacks.filter((atk) => {
    if (!atk.linkedInventoryItemId) return true;
    const linked = inventory.find((i) => i.id === atk.linkedInventoryItemId);
    return linked?.equipped === true;
  });

  const coveredItemIds = new Set(
    attacks
      .filter((a) => a.linkedInventoryItemId)
      .map((a) => a.linkedInventoryItemId as string)
  );

  const weaponAttacks: Attack[] = inventory
    .filter(
      (item) =>
        item.equipped &&
        item.category === "weapon" &&
        item.damageDice &&
        !item.suppressWeaponCard &&
        !coveredItemIds.has(item.id)
    )
    .map((item) => {
      const ability = item.attackAbility ?? "strength";
      const proficient = item.isProficient !== false;
      const profile = buildWeaponAttackProfile({
        abilityScore: character.abilityScores[ability],
        proficiencyBonus: character.proficiencyBonus,
        isProficient: proficient,
        includeAbilityModifierInDamage: item.useAbilityModifierForDamage !== false,
        weaponDamageBonus: item.damageModifier ?? 0,
      });
      return {
        id: `weapon-atk-${item.id}`,
        name: item.name,
        attackBonus: profile.attackBonus,
        damageDice: item.damageDice ?? "1d4",
        damageModifier: profile.damageModifier,
        damageType: item.damageType ?? "damage",
        additionalDamage: item.additionalDamage,
        range: item.weaponRange,
        notes: item.notes,
        reminders: [],
        linkedInventoryItemId: item.id,
      };
    });

  const equippedAttackAugments = collectEquippedAttackAugments(inventory);

  const visibleAttacks = sortPinnedFirst(
    [
      ...(unarmedAttack ? [unarmedAttack] : []),
      ...staticAttacks,
      ...weaponAttacks,
    ]
      .map((attack) => applyEquippedAttackAugments(attack, equippedAttackAugments))
      .map((attack) => applyInventoryCombatReadinessNotes(attack, inventory))
      .map((attack) => ({ ...attack, pinned: getAttackPinned(attack) })),
    (a, b) => a.name.localeCompare(b.name),
  );

  // ── Bonus action / reaction / action sections ──────────────────────────────
  const allActionable = collectActionableItemEffects(inventory);
  const bonusActions  = sortPinnedFirst(allActionable.filter((e) => e.actionType === "bonus_action"), (a, b) => a.label.localeCompare(b.label));
  const reactions     = sortPinnedFirst(allActionable.filter((e) => e.actionType === "reaction"), (a, b) => a.label.localeCompare(b.label));
  const freeActions   = sortPinnedFirst(allActionable.filter((e) => e.actionType === "free"), (a, b) => a.label.localeCompare(b.label));
  const otherActions  = sortPinnedFirst(allActionable.filter((e) => e.actionType === "action"), (a, b) => a.label.localeCompare(b.label));

  // Class features partitioned by action type (only real usable actions live here now)
  const cfBonusActions   = sortPinnedFirst(classFeatures.filter((f) => f.actionType === "bonus_action"), (a, b) => a.name.localeCompare(b.name));
  const cfReactions      = sortPinnedFirst(classFeatures.filter((f) => f.actionType === "reaction"), (a, b) => a.name.localeCompare(b.name));
  const cfFreeActions    = sortPinnedFirst(classFeatures.filter((f) => f.actionType === "free"), (a, b) => a.name.localeCompare(b.name));
  const cfOtherActions   = sortPinnedFirst(classFeatures.filter((f) => f.actionType === "action"), (a, b) => a.name.localeCompare(b.name));

  const isEmpty =
    visibleAttacks.length === 0 &&
    allActionable.length === 0 &&
    classFeatures.length === 0 &&
    preparedSpells.length === 0 &&
    equipmentSpells.length === 0;

  const modalIsCantrip = Boolean(castingSpell && (!castingSpell.level || Number(castingSpell.level) < 1));
  const modalAvailableSlots = castingSpell
    ? spellSlots.filter((slot) => slot.level >= castingSpell.level && slot.total - slot.used > 0)
    : [];

  function parseCastModalAttackRoll(): { total: number; isCritical?: boolean } | undefined {
    const trimmedRoll = castAttackRollInput.trim();
    if (trimmedRoll.length === 0) return undefined;
    const parsed = Number.parseInt(trimmedRoll, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      Alert.alert("Invalid Attack Roll", "Enter a positive attack roll total or leave it blank.");
      return null as never;
    }
    return { total: parsed, isCritical: castAttackIsCritical };
  }

  function parseCastModalSaveRolls(): Record<string, number> | undefined {
    if (!castTargetSaveHint.requiresSaveRolls || castTargetSaveHint.saveTargets.length === 0) return undefined;
    const parsedSaveRolls: Record<string, number> = {};
    for (const target of castTargetSaveHint.saveTargets) {
      const value = (castSaveRollInputs[target.id] ?? "").trim();
      if (!value) continue;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        Alert.alert("Invalid Save Roll", `Enter a positive save roll total for ${target.name}, or leave it blank.`);
        return null as never;
      }
      parsedSaveRolls[target.id] = parsed;
    }
    return Object.keys(parsedSaveRolls).length > 0 ? parsedSaveRolls : undefined;
  }

  function handleModalCastConfirm(atLevel: number) {
    const attackRoll = parseCastModalAttackRoll();
    if (attackRoll === null) return;
    const saveRolls = parseCastModalSaveRolls();
    if (saveRolls === null) return;
    void handleConfirmLeveledSpellCast(atLevel, attackRoll, saveRolls);
  }

  return (
    <>
      {/* ── Spell Slot Picker Modal ────────────────────────────────────────── */}
      <Modal visible={castingSpell !== null} animationType="slide" transparent onRequestClose={() => setCastingSpell(null)}>
        <TouchableOpacity style={styles.castOverlay} activeOpacity={1} onPress={() => setCastingSpell(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.castSheet, { backgroundColor: c.card, borderTopColor: c.border }]}>
            <View style={[styles.castHandle, { backgroundColor: c.border }]} />
            {castingSpell && (
              <>
                <Text style={[styles.castTitle, { color: c.foreground }]}>{castingSpell.name}</Text>
                <Text style={[styles.castSub, { color: c.mutedForeground }]}>
                  {modalIsCantrip ? "Cantrip - no slot needed" : "Choose a slot level to cast at"}
                </Text>
                {castTargetAttackHint.requiresAttackRoll ? (
                  <View style={[styles.castAttackInputCard, { backgroundColor: c.background, borderColor: c.border }]}> 
                    <Text style={[styles.castAttackInputTitle, { color: c.foreground }]}>Spell Attack Roll (optional)</Text>
                    <Text style={[styles.castAttackInputHint, { color: c.mutedForeground }]}>
                      Enter your final d20 total for this cast
                      {typeof castTargetAttackHint.suggestedAttackBonus === "number"
                        ? ` (suggested bonus +${castTargetAttackHint.suggestedAttackBonus})`
                        : ""}.
                    </Text>
                    <TextInput
                      style={[styles.attackRollInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                      placeholder="e.g. 19"
                      placeholderTextColor={c.mutedForeground}
                      keyboardType="number-pad"
                      value={castAttackRollInput}
                      onChangeText={setCastAttackRollInput}
                    />
                    <View style={styles.castAttackCritRow}>
                      <Text style={[styles.castAttackCritLabel, { color: c.foreground }]}>Critical hit</Text>
                      <Switch
                        value={castAttackIsCritical}
                        onValueChange={setCastAttackIsCritical}
                        trackColor={{ false: c.muted, true: "#EF4444" }}
                        thumbColor="#fff"
                      />
                    </View>
                  </View>
                ) : null}
                {castTargetSaveHint.requiresSaveRolls && castTargetSaveHint.saveTargets.length > 0 ? (
                  <View style={[styles.castSaveInputCard, { backgroundColor: c.background, borderColor: c.border }]}> 
                    <Text style={[styles.castAttackInputTitle, { color: c.foreground }]}>Target Save Rolls (optional)</Text>
                    <Text style={[styles.castAttackInputHint, { color: c.mutedForeground }]}>Enter final totals for each selected target.</Text>
                    <Text style={[styles.castSaveMeta, { color: c.mutedForeground }]}>Save: {(castTargetSaveHint.saveAbility ?? "?").toUpperCase()}{typeof castTargetSaveHint.saveDc === "number" ? ` DC ${castTargetSaveHint.saveDc}` : ""}</Text>
                    {castTargetSaveHint.saveTargets.map((target) => (
                      <View key={target.id} style={styles.castSaveRow}>
                        <Text style={[styles.castSaveTargetName, { color: c.foreground }]} numberOfLines={1}>{target.name}</Text>
                        <TextInput
                          style={[styles.castSaveInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                          placeholder="e.g. 14"
                          placeholderTextColor={c.mutedForeground}
                          keyboardType="number-pad"
                          value={castSaveRollInputs[target.id] ?? ""}
                          onChangeText={(value) => {
                            setCastSaveRollInputs((prev) => ({ ...prev, [target.id]: value }));
                          }}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
                {modalIsCantrip ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleModalCastConfirm(0)}
                    style={[styles.castSlotBtn, { backgroundColor: "#A78BFA22", borderColor: "#A78BFA" }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.castSlotLabel, { color: "#A78BFA" }]}>Cast Cantrip (no slot used)</Text>
                    </View>
                  </TouchableOpacity>
                ) : modalAvailableSlots.length === 0 ? (
                  <View style={[styles.castNoSlots, { backgroundColor: c.muted + "40", borderColor: c.border }]}>
                    <Feather name="alert-circle" size={20} color={c.mutedForeground} />
                    <Text style={[styles.castNoSlotsText, { color: c.mutedForeground }]}>
                      No {SLOT_LABEL[castingSpell.level] ?? `${castingSpell.level}th`}-level slots remaining
                    </Text>
                  </View>
                ) : (
                  modalAvailableSlots.map(slot => {
                    const remaining = slot.total - slot.used;
                    const isMin = slot.level === castingSpell.level;
                    return (
                      <TouchableOpacity key={slot.level} activeOpacity={0.8}
                        onPress={() => handleModalCastConfirm(slot.level)}
                        style={[styles.castSlotBtn, {
                          backgroundColor: isMin ? "#A78BFA22" : c.background,
                          borderColor: isMin ? "#A78BFA" : c.border,
                        }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.castSlotLabel, { color: isMin ? "#A78BFA" : c.foreground }]}>
                            {SLOT_LABEL[slot.level]} Level Slot{slot.level > castingSpell.level ? " (upcast)" : ""}
                          </Text>
                          <Text style={[styles.castSlotSub, { color: c.mutedForeground }]}>
                            {remaining} of {slot.total} remaining
                          </Text>
                        </View>
                        <View style={styles.castPips}>
                          {Array.from({ length: Math.min(slot.total, 5) }).map((_, i) => (
                            <View key={i} style={[styles.castPip, {
                              backgroundColor: i < remaining ? "#A78BFA" : c.muted,
                            }]} />
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
                <TouchableOpacity onPress={() => setCastingSpell(null)}
                  style={[styles.castCancelBtn, { borderColor: c.border }]} activeOpacity={0.8}>
                  <Text style={[styles.castCancelText, { color: c.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ScrollHintScrollView
        style={[styles.container, { backgroundColor: c.background }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Platform.OS === "web" ? 76 : 92,
            paddingTop: 12,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
      {/* ── Combat HUD ────────────────────────────────────────────────────── */}
      {combat.active && <CombatHUD />}

      {navNoticeText && (
        <View
          style={[
            styles.combatFlowBanner,
            {
              borderColor: c.border,
              backgroundColor: c.card,
            },
          ]}
        >
          <View style={styles.combatFlowHeader}>
            <Text style={[styles.combatFlowTitle, { color: c.foreground }]}>BATTLE</Text>
          </View>
          <Text style={[styles.combatFlowText, { color: c.mutedForeground }]}>{navNoticeText}</Text>
        </View>
      )}

      {combat.active && combat.actionFeedback && (
        <View
          style={[
            styles.combatFlowBanner,
            {
              borderColor: combat.actionFeedback.level === "error" ? "#ef4444" : "#16a34a",
              backgroundColor: combat.actionFeedback.level === "error" ? "#FEE2E2" : "#DCFCE7",
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text
              style={[
                styles.combatFlowTitle,
                { color: combat.actionFeedback.level === "error" ? "#7F1D1D" : "#14532D" },
              ]}
            >
              {combat.actionFeedback.title}
            </Text>
            <TouchableOpacity onPress={combat.dismissActionFeedback} activeOpacity={0.8}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: combat.actionFeedback.level === "error" ? "#7F1D1D" : "#14532D",
                }}
              >
                Dismiss
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.combatFlowText, { color: combat.actionFeedback.level === "error" ? "#450A0A" : "#052E16" }]}> 
            {combat.actionFeedback.message}
          </Text>
        </View>
      )}

      {combat.active && combat.remoteApplyFailureMessage && (
        <View style={[styles.combatFlowBanner, { borderColor: "#ef4444", backgroundColor: "#FEE2E2" }]}> 
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text style={[styles.combatFlowTitle, { color: "#7F1D1D" }]}>REMOTE APPLY WARNING</Text>
            <TouchableOpacity onPress={combat.dismissRemoteApplyFailure} activeOpacity={0.8}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#7F1D1D" }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.combatFlowText, { color: "#450A0A" }]}>{combat.remoteApplyFailureMessage}</Text>
          <Text style={[styles.combatFlowText, { color: "#450A0A" }]}>Retry only after confirming target HP/conditions were not already applied by the DM.</Text>
        </View>
      )}

      {/* ── Party Target Selector ─────────────────────────────────────────── */}
      {combat.active && isInParty && combat.partyTargets.length > 0 && isMyTurn && (
        <View style={[styles.targetPicker, { backgroundColor: c.card, borderColor: c.border }]}>
          {combat.actorOptions.length > 1 && (
            <View style={{ marginBottom: 10 }}>
              <Text style={[styles.targetPickerLabel, { color: c.mutedForeground }]}>ACTING AS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetPickerRow}>
                {combat.actorOptions.map((option) => {
                  const selected = option.id === combat.activeActorOptionId;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => handleActorSwitchRequest(option.id)}
                      activeOpacity={0.85}
                      style={[
                        styles.targetChip,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? `${c.primary}22` : c.background,
                        },
                      ]}
                    >
                      <Feather name={option.kind === "companion" ? "shield" : "user"} size={12} color={selected ? c.primary : c.mutedForeground} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? c.primary : c.mutedForeground }} numberOfLines={1}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 6 }}>
                Actions still use your player turn economy while acting through a companion.
              </Text>
              <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 4 }}>
                Remote party condition durations remain manual and DM-resolved in this combat flow.
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={[styles.targetPickerLabel, { color: c.mutedForeground }]}>ACTION TARGETS {combat.selectedTargetIds.size > 0 ? `(${combat.selectedTargetIds.size})` : ""}</Text>
            {combat.selectedTargetIds.size > 0 && (
              <TouchableOpacity onPress={() => combat.clearTargetIds()} activeOpacity={0.8}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: c.mutedForeground }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Party Members Section */}
          {combat.partyTargets.filter(t => t.type !== "npc").length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, marginBottom: 6 }]}>Party Members</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetPickerRow}>
                {combat.partyTargets.filter(t => t.type !== "npc").map((target) => {
                  const selected = combat.selectedTargetIds.has(target.id);
                  return (
                    <TouchableOpacity
                      key={target.id}
                      onPress={() => combat.toggleTargetId(target.id)}
                      activeOpacity={0.85}
                      style={[
                        styles.targetChip,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? `${c.primary}22` : c.background,
                        },
                      ]}
                    >
                      <Feather name="user" size={12} color={selected ? c.primary : c.mutedForeground} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? c.primary : c.mutedForeground }}>
                        {target.id === memberId ? "Self" : target.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
          
          {/* Combatants Section */}
          {combat.partyTargets.filter(t => t.type === "npc").length > 0 && (
            <View>
              <Text style={[{ fontSize: 11, fontWeight: "600", color: c.mutedForeground, marginBottom: 6 }]}>Combatants</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetPickerRow}>
                {combat.partyTargets.filter(t => t.type === "npc").map((target) => {
                  const selected = combat.selectedTargetIds.has(target.id);
                  return (
                    <TouchableOpacity
                      key={target.id}
                      onPress={() => combat.toggleTargetId(target.id)}
                      activeOpacity={0.85}
                      style={[
                        styles.targetChip,
                        {
                          borderColor: selected ? "#f97316" : c.border,
                          backgroundColor: selected ? "#f9731622" : c.background,
                        },
                      ]}
                    >
                      <Feather name="crosshair" size={12} color={selected ? "#f97316" : c.mutedForeground} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? "#f97316" : c.mutedForeground }}>
                        {npcPresentationById.get(target.id)?.displayName ?? target.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 10 }}>
            Current actor context: {activeActorHint}
          </Text>
        </View>
      )}

      {combat.active && combatFlowText && (
        <View style={[styles.combatFlowBanner, { borderColor: c.border, backgroundColor: c.card }]}> 
          <View style={styles.combatFlowHeader}>
            <Text style={[styles.combatFlowTitle, { color: c.foreground }]}>COMBAT FLOW</Text>
            <View style={styles.combatFlowPills}>
              <View style={[styles.combatFlowPill, { borderColor: c.border, backgroundColor: c.secondary }]}> 
                <Text style={[styles.combatFlowPillText, { color: c.mutedForeground }]}>Action {actionRemaining > 0 ? "ready" : "spent"}</Text>
              </View>
              <View style={[styles.combatFlowPill, { borderColor: c.border, backgroundColor: c.secondary }]}> 
                <Text style={[styles.combatFlowPillText, { color: c.mutedForeground }]}>Bonus {bonusRemaining > 0 ? "ready" : "spent"}</Text>
              </View>
              <View style={[styles.combatFlowPill, { borderColor: c.border, backgroundColor: c.secondary }]}> 
                <Text style={[styles.combatFlowPillText, { color: c.mutedForeground }]}>Reaction {reactionState}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.combatFlowText, { color: c.mutedForeground }]}>{combatFlowText}</Text>
          <View style={styles.contextSummaryRow}>
            <View style={[styles.contextSummaryChip, { borderColor: c.border, backgroundColor: c.secondary }]}> 
              <Text style={[styles.contextSummaryChipText, { color: c.mutedForeground }]}>Acting As: {activeActorHint}</Text>
            </View>
            <View
              style={[
                styles.contextSummaryChip,
                {
                  borderColor: combat.selectedTargetIds.size > 0 ? "#f97316" : c.border,
                  backgroundColor: combat.selectedTargetIds.size > 0 ? "#f9731622" : c.secondary,
                },
              ]}
            >
              <Text style={[styles.contextSummaryChipText, { color: combat.selectedTargetIds.size > 0 ? "#f97316" : c.mutedForeground }]}>
                Targets: {selectedTargetSummary}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Compact grid view ─────────────────────────────────────────────── */}
      {viewMode === "compact" && (
        <>
          {!isEmpty && <ViewToggleButton viewMode={viewMode} onPress={() => setViewMode(v => v === "full" ? "compact" : "full")} />}
          <CompactSection label="ATTACKS" color={c.mutedForeground} items={visibleAttacks.map(a => ({
            id: a.id,
            name: a.name,
            badge: "ATTACK",
            badgeColor: "#EF4444",
            pinned: a.pinned === true,
            onTogglePin: () => toggleAttackPinned(a),
            quickActionIcon: "play",
            onUse: async () => {
              const command = buildCombatActionCommand({
                sourceType: "attack",
                sourceId: a.id,
                sourceName: a.name,
                actionKind: "action",
                selectedTargetIds: [...combat.selectedTargetIds],
                metadata: {
                  eventType: "player_attack_used",
                  eventMessage: `Attack: ${a.name}`,
                  eventMetadata: { attackName: a.name },
                },
              });
              const result = await combat.resolveCombatAction(command);
              return wasCombatActionAccepted(result);
            },
            onUndo: async () => {
              const command = buildCombatActionCommand({
                sourceType: "attack",
                sourceId: a.id,
                sourceName: a.name,
                actionKind: "action",
                mode: "undo",
              });
              const result = await combat.resolveCombatAction(command);
              return wasCombatActionAccepted(result);
            },
            sub: `+${a.attackBonus} · ${a.damageDice}${a.damageModifier ? (a.damageModifier > 0 ? `+${a.damageModifier}` : `${a.damageModifier}`) : ""} ${a.damageType}`,
            detailRows: [
              { label: "To Hit", value: `+${a.attackBonus}` },
              { label: "Damage", value: `${a.damageDice}${a.damageModifier ? (a.damageModifier > 0 ? `+${a.damageModifier}` : `${a.damageModifier}`) : ""} ${a.damageType}` },
              ...(a.range ? [{ label: "Range", value: a.range }] : []),
              ...(a.additionalDamage?.length ? a.additionalDamage.map(d => ({ label: "Extra Dmg", value: `${d.dice} ${d.damageType}` })) : []),
            ],
            detail: a.notes,
          }))} />
          <CompactSection label="CANTRIPS" color="#A78BFA" items={cantripSpells.map(sp => ({
            id: sp.id,
            name: sp.name,
            badge: "CANTRIP",
            badgeColor: "#A78BFA",
            pinned: sp.pinned === true,
            onTogglePin: () => togglePreparedSpellPinned(sp.id, !(sp.pinned === true)),
            quickActionIcon: "zap",
            onUse: async () => {
              setCastingSpell(sp);
              return false;
            },
            onUndo: async () => undoPreparedSpellCast(sp),
            detailRows: [
              ...(sp.castingTime ? [{ label: "Cast Time", value: sp.castingTime }] : []),
              ...(sp.range ? [{ label: "Range", value: sp.range }] : []),
              ...(sp.duration ? [{ label: "Duration", value: sp.duration }] : []),
              ...(sp.school ? [{ label: "School", value: sp.school }] : []),
            ],
            detail: sp.description,
          }))} />
          <CompactSection label="SPELLS" color="#A78BFA" items={leveledSpells.map(sp => {
            const hasSlot = spellSlots.some(s => s.level >= sp.level && s.total - s.used > 0);
            return {
            id: sp.id,
            name: sp.name,
            badge: `LVL ${sp.level}`,
            badgeColor: "#A78BFA",
            pinned: sp.pinned === true,
            disabled: !hasSlot,
            onTogglePin: () => togglePreparedSpellPinned(sp.id, !(sp.pinned === true)),
            quickActionIcon: "zap",
            onUse: async () => {
              if (!hasSlot) return false;
              setCastingSpell(sp);
              return false;
            },
            onUndo: async () => undoPreparedSpellCast(sp),
            detailRows: [
              ...(sp.castingTime ? [{ label: "Cast Time", value: sp.castingTime }] : []),
              ...(sp.range ? [{ label: "Range", value: sp.range }] : []),
              ...(sp.duration ? [{ label: "Duration", value: `${sp.concentration ? "Concentration, " : ""}${sp.duration}` }] : []),
              ...(sp.school ? [{ label: "School", value: sp.school }] : []),
            ],
            detail: sp.description,
          };})} />
          <CompactSection label="ITEM SPELLS" color={SPELL_COLOR} items={equipmentSpells.map(sp => {
            const remaining = spellEffectUses[sp.effectId] ?? sp.uses;
            return {
            id: sp.effectId,
            name: sp.label,
            badge: "ITEM",
            badgeColor: SPELL_COLOR,
            pinned: sp.pinned === true,
            disabled: remaining != null && remaining <= 0,
            onTogglePin: () => toggleItemEffectPinned(sp.itemId, sp.effectId, !(sp.pinned === true)),
            quickActionIcon: "zap",
            onUse: async () => {
              if (remaining != null && remaining <= 0) return false;
              const command = buildCombatActionCommand({
                sourceType: "item_spell",
                sourceId: sp.effectId,
                sourceName: sp.label,
                itemId: sp.itemId,
                actionKind: "action",
                metadata: {
                  eventType: "player_spell_cast",
                  eventMessage: `Cast item spell: ${sp.label}`,
                  eventMetadata: { spellName: sp.label, sourceItem: sp.itemName },
                },
              });
              const result = await combat.resolveCombatAction(command);
              if (!wasCombatActionAccepted(result)) return false;
              useSpellEffect(sp.effectId);
            },
            onUndo: async () => {
              const command = buildCombatActionCommand({
                sourceType: "item_spell",
                sourceId: sp.effectId,
                sourceName: sp.label,
                itemId: sp.itemId,
                actionKind: "action",
                mode: "undo",
              });
              const result = await combat.resolveCombatAction(command);
              return wasCombatActionAccepted(result);
            },
            sub: sp.itemName,
            detailRows: [
              { label: "Source", value: sp.itemName },
              ...(sp.uses != null ? [{ label: "Uses", value: `${sp.uses}${sp.resetOn ? ` / ${sp.resetOn.replace("_", " ")}` : ""}` }] : []),
            ],
            detail: sp.description,
          };})} />
          <CompactSection label="CONSUMABLES" color={CONSUMABLE_COLOR} items={consumables.map(item => ({
            id: item.id,
            name: item.name,
            badge: `QTY ${item.quantity ?? 1}`,
            badgeColor: CONSUMABLE_COLOR,
            pinned: item.pinned === true,
            disabled: (item.quantity ?? 1) <= 0,
            onTogglePin: () => toggleItemPinned(item.id, !(item.pinned === true)),
            quickActionIcon: "package",
            onUse: async () => {
              const qty = item.quantity ?? 1;
              if (qty <= 0) return false;
              const command = buildCombatActionCommand({
                sourceType: "consumable",
                sourceId: item.id,
                sourceName: item.name,
                itemId: item.id,
                actionKind: "action",
                metadata: {
                  eventType: "player_action_used",
                  eventMessage: `Consumable: ${item.name}`,
                  eventMetadata: { itemName: item.name, itemType: "consumable" },
                },
              });
              const result = await combat.resolveCombatAction(command);
              if (!wasCombatActionAccepted(result)) return false;
              if (qty <= 1) updateItem(item.id, { quantity: 0 });
              else updateItem(item.id, { quantity: qty - 1 });
            },
            onUndo: async () => {
              const qty = item.quantity ?? 1;
              const command = buildCombatActionCommand({
                sourceType: "consumable",
                sourceId: item.id,
                sourceName: item.name,
                itemId: item.id,
                actionKind: "action",
                mode: "undo",
              });
              const result = await combat.resolveCombatAction(command);
              if (!wasCombatActionAccepted(result)) return false;
              updateItem(item.id, { quantity: qty + 1 });
            },
            detailRows: [
              { label: "Quantity", value: String(item.quantity ?? 1) },
              ...(item.damageDice ? [{ label: "Damage", value: `${item.damageDice}${item.damageType ? ` ${item.damageType}` : ""}` }] : []),
              ...(item.value != null ? [{ label: "Value", value: `${item.value} gp` }] : []),
            ],
            detail: item.notes,
          }))} />
          <CompactSection label="BONUS ACTIONS" color={BONUS_ACTION_COLOR} items={[
            ...cfBonusActions.map(f => ({
              id: f.id,
              name: f.name,
              badge: "BA",
              badgeColor: BONUS_ACTION_COLOR,
              pinned: f.pinned === true,
              onTogglePin: () => toggleClassFeaturePinned(f.id, !(f.pinned === true)),
              quickActionIcon: "play",
              onUse: async () => {
                const command = buildCombatActionCommand({
                  sourceType: "class_feature",
                  sourceId: f.id,
                  sourceName: f.name,
                  actionKind: "bonus_action",
                  metadata: {
                    eventType: "player_bonus_action_used",
                    eventMessage: `Bonus Action: ${f.name}`,
                    eventMetadata: { actionLabel: f.name, source: f.source },
                  },
                });
                const result = await combat.resolveCombatAction(command);
                return wasCombatActionAccepted(result);
              },
              onUndo: async () => {
                const command = buildCombatActionCommand({
                  sourceType: "class_feature",
                  sourceId: f.id,
                  sourceName: f.name,
                  actionKind: "bonus_action",
                  mode: "undo",
                });
                const result = await combat.resolveCombatAction(command);
                return wasCombatActionAccepted(result);
              },
              sub: f.source,
              detail: f.description,
              detailRows: [{ label: "Source", value: f.source }],
            })),
            ...bonusActions.map(e => ({
              id: e.effectId,
              name: e.label,
              badge: "BA",
              badgeColor: BONUS_ACTION_COLOR,
              pinned: e.pinned === true,
              onTogglePin: () => toggleItemEffectPinned(e.itemId, e.effectId, !(e.pinned === true)),
              quickActionIcon: "play",
              onUse: async () => {
                const command = buildCombatActionCommand({
                  sourceType: "item_action",
                  sourceId: e.effectId,
                  sourceName: e.label,
                  itemId: e.itemId,
                  actionKind: "bonus_action",
                  metadata: {
                    eventType: "player_bonus_action_used",
                    eventMessage: `Bonus Action: ${e.label}`,
                    eventMetadata: { actionLabel: e.label, sourceItem: e.itemName },
                  },
                });
                const result = await combat.resolveCombatAction(command);
                return wasCombatActionAccepted(result);
              },
              onUndo: async () => {
                const command = buildCombatActionCommand({
                  sourceType: "item_action",
                  sourceId: e.effectId,
                  sourceName: e.label,
                  itemId: e.itemId,
                  actionKind: "bonus_action",
                  mode: "undo",
                });
                const result = await combat.resolveCombatAction(command);
                return wasCombatActionAccepted(result);
              },
              sub: e.itemName,
              detail: e.description,
              detailRows: [{ label: "Item", value: e.itemName }],
            })),
          ]} />
          <CompactSection label="REACTIONS" color={REACTION_COLOR} items={[
            ...cfReactions.map(f => ({
              id: f.id,
              name: f.name,
              badge: "REACT",
              badgeColor: REACTION_COLOR,
              pinned: f.pinned === true,
              onTogglePin: () => toggleClassFeaturePinned(f.id, !(f.pinned === true)),
              quickActionIcon: "play",
              onUse: async () => {
                const reactionWindow = combat.pendingReactionWindow;
                const reactionDeclaration = buildDeclaredReaction({
                  triggerType: reactionWindow?.triggerType,
                  sourceType: "class_feature",
                  sourceName: f.name,
                });
                const command = buildCombatActionCommand({
                  sourceType: "class_feature",
                  sourceId: f.id,
                  sourceName: f.name,
                  actionKind: "reaction",
                  reaction: reactionWindow
                    ? {
                        windowId: reactionWindow.windowId,
                        triggerType: reactionWindow.triggerType,
                        sourceCommandId: reactionWindow.sourceCommandId,
                        decision: "accept",
                        declared: reactionDeclaration.declared,
                      }
                    : undefined,
                  metadata: {
                    eventType: "player_reaction_used",
                    eventMessage: `Reaction: ${f.name}`,
                    eventMetadata: {
                      actionLabel: f.name,
                      source: f.source,
                      ...(reactionDeclaration.declared
                        ? {
                            reactionDeclaredName: reactionDeclaration.declared.reactionName,
                            reactionDeclaredKind: reactionDeclaration.declared.reactionKind,
                          }
                        : {}),
                      ...(reactionDeclaration.limitation
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
                return wasCombatActionAccepted(result);
              },
              onUndo: async () => {
                const command = buildCombatActionCommand({
                  sourceType: "class_feature",
                  sourceId: f.id,
                  sourceName: f.name,
                  actionKind: "reaction",
                  mode: "undo",
                });
                const result = await combat.resolveCombatAction(command);
                return wasCombatActionAccepted(result);
              },
              sub: f.source,
              detail: f.description,
              detailRows: [{ label: "Source", value: f.source }],
            })),
            ...reactions.map(e => ({
              id: e.effectId,
              name: e.label,
              badge: "REACT",
              badgeColor: REACTION_COLOR,
              pinned: e.pinned === true,
              onTogglePin: () => toggleItemEffectPinned(e.itemId, e.effectId, !(e.pinned === true)),
              quickActionIcon: "play",
              onUse: async () => {
                const reactionWindow = combat.pendingReactionWindow;
                const reactionDeclaration = buildDeclaredReaction({
                  triggerType: reactionWindow?.triggerType,
                  sourceType: "item_action",
                  sourceName: e.label,
                });
                const command = buildCombatActionCommand({
                  sourceType: "item_action",
                  sourceId: e.effectId,
                  sourceName: e.label,
                  itemId: e.itemId,
                  actionKind: "reaction",
                  reaction: reactionWindow
                    ? {
                        windowId: reactionWindow.windowId,
                        triggerType: reactionWindow.triggerType,
                        sourceCommandId: reactionWindow.sourceCommandId,
                        decision: "accept",
                        declared: reactionDeclaration.declared,
                      }
                    : undefined,
                  metadata: {
                    eventType: "player_reaction_used",
                    eventMessage: `Reaction: ${e.label}`,
                    eventMetadata: {
                      actionLabel: e.label,
                      sourceItem: e.itemName,
                      ...(reactionDeclaration.declared
                        ? {
                            reactionDeclaredName: reactionDeclaration.declared.reactionName,
                            reactionDeclaredKind: reactionDeclaration.declared.reactionKind,
                          }
                        : {}),
                      ...(reactionDeclaration.limitation
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
                return wasCombatActionAccepted(result);
              },
              onUndo: async () => {
                const command = buildCombatActionCommand({
                  sourceType: "item_action",
                  sourceId: e.effectId,
                  sourceName: e.label,
                  itemId: e.itemId,
                  actionKind: "reaction",
                  mode: "undo",
                });
                const result = await combat.resolveCombatAction(command);
                return wasCombatActionAccepted(result);
              },
              sub: e.itemName,
              detail: e.description,
              detailRows: [{ label: "Item", value: e.itemName }],
            })),
          ]} />
          <CompactSection label="ACTIONS" color={ATTACK_COLOR} items={[
            ...cfOtherActions.map(f => ({
              id: f.id,
              name: f.name,
              badge: "ACTION",
              badgeColor: ATTACK_COLOR,
              pinned: f.pinned === true,
              onTogglePin: () => toggleClassFeaturePinned(f.id, !(f.pinned === true)),
              quickActionIcon: "play",
              onUse: async () => {
                const command = buildCombatActionCommand({
                  sourceType: "class_feature",
                  sourceId: f.id,
                  sourceName: f.name,
                  actionKind: "action",
                  metadata: {
                    eventType: "player_action_used",
                    eventMessage: `Action: ${f.name}`,
                    eventMetadata: { actionLabel: f.name, source: f.source },
                  },
                });
                const result = await combat.resolveCombatAction(command);
                return wasCombatActionAccepted(result);
              },
              onUndo: async () => {
                const command = buildCombatActionCommand({
                  sourceType: "class_feature",
                  sourceId: f.id,
                  sourceName: f.name,
                  actionKind: "action",
                  mode: "undo",
                });
                const result = await combat.resolveCombatAction(command);
                return wasCombatActionAccepted(result);
              },
              sub: f.source,
              detail: f.description,
              detailRows: [{ label: "Source", value: f.source }],
            })),
            ...otherActions.map(e => ({
              id: e.effectId,
              name: e.label,
              badge: "ACTION",
              badgeColor: ATTACK_COLOR,
              pinned: e.pinned === true,
              onTogglePin: () => toggleItemEffectPinned(e.itemId, e.effectId, !(e.pinned === true)),
              quickActionIcon: "play",
              onUse: async () => {
                const command = buildCombatActionCommand({
                  sourceType: "item_action",
                  sourceId: e.effectId,
                  sourceName: e.label,
                  itemId: e.itemId,
                  actionKind: "action",
                  metadata: {
                    eventType: "player_action_used",
                    eventMessage: `Action: ${e.label}`,
                    eventMetadata: { actionLabel: e.label, sourceItem: e.itemName },
                  },
                });
                const result = await combat.resolveCombatAction(command);
                return wasCombatActionAccepted(result);
              },
              onUndo: async () => {
                const command = buildCombatActionCommand({
                  sourceType: "item_action",
                  sourceId: e.effectId,
                  sourceName: e.label,
                  itemId: e.itemId,
                  actionKind: "action",
                  mode: "undo",
                });
                const result = await combat.resolveCombatAction(command);
                return wasCombatActionAccepted(result);
              },
              sub: e.itemName,
              detail: e.description,
              detailRows: [{ label: "Item", value: e.itemName }],
            })),
          ]} />
          <CompactSection label="FREE ACTIONS" color={FREE_ACTION_COLOR} items={[
            ...cfFreeActions.map(f => ({ id: f.id, name: f.name, badge: "FREE", badgeColor: FREE_ACTION_COLOR, pinned: f.pinned === true, onTogglePin: () => toggleClassFeaturePinned(f.id, !(f.pinned === true)), quickActionIcon: "play", onUse: () => {}, onUndo: () => {}, sub: f.source, detail: f.description, detailRows: [{ label: "Source", value: f.source }] })),
            ...freeActions.map(e => ({ id: e.effectId, name: e.label, badge: "FREE", badgeColor: FREE_ACTION_COLOR, pinned: e.pinned === true, onTogglePin: () => toggleItemEffectPinned(e.itemId, e.effectId, !(e.pinned === true)), quickActionIcon: "play", onUse: () => {}, onUndo: () => {}, sub: e.itemName, detail: e.description, detailRows: [{ label: "Item", value: e.itemName }] })),
          ]} />
          {passiveFeatures.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground, marginTop: 12, marginBottom: 6 }]}>PASSIVE</Text>
              <CompactSection label="PASSIVE" color={c.mutedForeground} items={passiveFeatures.map(f => ({ id: f.id, name: f.name, badge: "PASSIVE", badgeColor: c.mutedForeground, pinned: f.pinned === true, onTogglePin: () => toggleClassFeaturePinned(f.id, !(f.pinned === true)), sub: f.source, detail: f.description, detailRows: [{ label: "Source", value: f.source }] }))} />
            </>
          )}
        </>
      )}

      {/* ── Full view ─────────────────────────────────────────────────────── */}
      {viewMode === "full" && (
        <>
      {visibleAttacks.length === 0 && !isEmpty && <ViewToggleButton viewMode={viewMode} onPress={() => setViewMode(v => v === "full" ? "compact" : "full")} />}
      {/* ── Attacks ───────────────────────────────────────────────────────── */}
      {visibleAttacks.length > 0 && (
        <>
          <SectionLabel label="ATTACKS" color={c.mutedForeground} />
          <View style={styles.headerNote}>
            <View style={styles.headerNoteInfo}>
              <Text style={[styles.noteText, { color: c.mutedForeground }]}> 
                Enter your raw dice roll — modifiers are added automatically.
              </Text>
              <Text style={[styles.profNote, { color: c.primary }]}> 
                Prof +{character.proficiencyBonus}
              </Text>
            </View>
            <ViewToggleButton viewMode={viewMode} onPress={() => setViewMode(v => v === "full" ? "compact" : "full")} align="inline" />
          </View>
          <View style={styles.attackGrid}>
            {visibleAttacks.map((attack) => (
              <View key={attack.id} style={[styles.attackGridItem, isNarrowAttackGrid ? styles.attackGridItemSingle : null]}>
                <AttackCard
                  attack={attack}
                  pinned={attack.pinned === true}
                  onTogglePin={() => toggleAttackPinned(attack)}
                />
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Cantrips ──────────────────────────────────────────────────────── */}
      {cantripSpells.length > 0 && (
        <>
          <SectionLabel label="CANTRIPS" color="#A78BFA" />
          {cantripSpells.map(sp => (
            <CantripCard
              key={sp.id}
              spell={sp}
              sourceTag={getSpellSourceTag(sp)}
              sourceTagMode={settings.spellSourceTagStyle}
              onCast={async (preparedSpell) => {
                setCastingSpell(preparedSpell);
                return false;
              }}
              onUndo={undoPreparedSpellCast}
            />
          ))}
        </>
      )}

      {/* ── Leveled Spells ────────────────────────────────────────────────── */}
      {leveledSpells.length > 0 && (
        <>
          <SectionLabel label="SPELLS" color="#A78BFA" />
          {leveledSpells.map(sp => (
            <SpellCastCard
              key={sp.id}
              spell={sp}
              spellSlots={spellSlots}
              onCastRequest={setCastingSpell}
              onUndo={undoPreparedSpellCast}
              sourceTag={getSpellSourceTag(sp)}
              sourceTagMode={settings.spellSourceTagStyle}
            />
          ))}
        </>
      )}

      {/* ── Equipment Spells ──────────────────────────────────────────────── */}
      {equipmentSpells.length > 0 && (
        <>
          <SectionLabel label="ITEM SPELLS" color={SPELL_COLOR} />
          {equipmentSpells.map((spell) => (
            <EquipmentSpellCard
              key={spell.effectId}
              spell={spell}
              remaining={spellEffectUses[spell.effectId] ?? spell.uses}
              onCast={() => useSpellEffect(spell.effectId)}
            />
          ))}
        </>
      )}

      {/* ── Consumables (always shown if any, but more prominent in combat) ── */}
      {consumables.length > 0 && (
        <>
          <SectionLabel label="CONSUMABLES" color={CONSUMABLE_COLOR} />
          {consumables.map(item => (
            <ConsumableCard key={item.id} item={item}
              onUse={() => {
                const qty = item.quantity ?? 1;
                if (qty <= 1) updateItem(item.id, { quantity: 0 });
                else updateItem(item.id, { quantity: qty - 1 });
              }}
            />
          ))}
        </>
      )}

      {/* ── Bonus Actions ─────────────────────────────────────────────────── */}
      {(bonusActions.length > 0 || cfBonusActions.length > 0) && (
        <>
          <SectionLabel label={`BONUS ACTIONS${combat.active ? ` (${bonusRemaining > 0 ? "READY" : "SPENT"})` : ""}`} color={BONUS_ACTION_COLOR} />
          {cfBonusActions.map((f) => (
            <ActionCard
              key={f.id}
              label={f.name}
              description={f.description}
              sourceItemName={f.source}
              actionType="bonus_action"
              effectType="feature"
              maxTargets={f.maxTargets}
              pinned={f.pinned === true}
              onTogglePin={() => toggleClassFeaturePinned(f.id, !(f.pinned === true))}
            />
          ))}
          {bonusActions.map((e) => (
            <ActionCard
              key={e.key}
              label={e.label}
              description={e.description}
              sourceItemName={e.itemName}
              actionType="bonus_action"
              effectType={e.effectType as any}
              maxTargets={e.maxTargets}
              pinned={e.pinned === true}
              onTogglePin={() => toggleItemEffectPinned(e.itemId, e.effectId, !(e.pinned === true))}
              remainingUses={e.uses !== undefined ? (itemActionUses[e.effectId] ?? e.uses) : undefined}
              onConsumeUse={e.uses !== undefined ? () => useItemEffect(e.effectId) : undefined}
            />
          ))}
        </>
      )}

      {/* ── Reactions ─────────────────────────────────────────────────────── */}
      {(reactions.length > 0 || cfReactions.length > 0) && (
        <>
          <SectionLabel label={`REACTIONS${combat.active ? ` (${reactionState.toUpperCase()})` : ""}`} color={REACTION_COLOR} />
          {cfReactions.map((f) => (
            <ActionCard
              key={f.id}
              label={f.name}
              description={f.description}
              sourceItemName={f.source}
              actionType="reaction"
              effectType="feature"
              maxTargets={f.maxTargets}
              pinned={f.pinned === true}
              onTogglePin={() => toggleClassFeaturePinned(f.id, !(f.pinned === true))}
            />
          ))}
          {reactions.map((e) => (
            <ActionCard
              key={e.key}
              label={e.label}
              description={e.description}
              sourceItemName={e.itemName}
              actionType="reaction"
              effectType={e.effectType as any}
              maxTargets={e.maxTargets}
              pinned={e.pinned === true}
              onTogglePin={() => toggleItemEffectPinned(e.itemId, e.effectId, !(e.pinned === true))}
              remainingUses={e.uses !== undefined ? (itemActionUses[e.effectId] ?? e.uses) : undefined}
              onConsumeUse={e.uses !== undefined ? () => useItemEffect(e.effectId) : undefined}
            />
          ))}
        </>
      )}

      {/* ── Other Actions ─────────────────────────────────────────────────── */}
      {(otherActions.length > 0 || cfOtherActions.length > 0) && (
        <>
          <SectionLabel label={`ACTIONS${combat.active ? ` (${actionRemaining > 0 ? "READY" : "SPENT"})` : ""}`} color={ATTACK_COLOR} />
          {cfOtherActions.map((f) => (
            <ActionCard
              key={f.id}
              label={f.name}
              description={f.description}
              sourceItemName={f.source}
              actionType="action"
              effectType="feature"
              maxTargets={f.maxTargets}
              pinned={f.pinned === true}
              onTogglePin={() => toggleClassFeaturePinned(f.id, !(f.pinned === true))}
            />
          ))}
          {otherActions.map((e) => (
            <ActionCard
              key={e.key}
              label={e.label}
              description={e.description}
              sourceItemName={e.itemName}
              actionType="action"
              effectType={e.effectType as any}
              maxTargets={e.maxTargets}
              pinned={e.pinned === true}
              onTogglePin={() => toggleItemEffectPinned(e.itemId, e.effectId, !(e.pinned === true))}
              remainingUses={e.uses !== undefined ? (itemActionUses[e.effectId] ?? e.uses) : undefined}
              onConsumeUse={e.uses !== undefined ? () => useItemEffect(e.effectId) : undefined}
            />
          ))}
        </>
      )}

      {/* ── Free Actions ──────────────────────────────────────────────────── */}
      {(freeActions.length > 0 || cfFreeActions.length > 0) && (
        <>
          <SectionLabel label="FREE ACTIONS" color={FREE_ACTION_COLOR} />
          {cfFreeActions.map((f) => (
            <ActionCard
              key={f.id}
              label={f.name}
              description={f.description}
              sourceItemName={f.source}
              actionType="free"
              effectType="feature"
              maxTargets={f.maxTargets}
              pinned={f.pinned === true}
              onTogglePin={() => toggleClassFeaturePinned(f.id, !(f.pinned === true))}
            />
          ))}
          {freeActions.map((e) => (
            <ActionCard
              key={e.key}
              label={e.label}
              description={e.description}
              sourceItemName={e.itemName}
              actionType="free"
              effectType={e.effectType as any}
              maxTargets={e.maxTargets}
              pinned={e.pinned === true}
              onTogglePin={() => toggleItemEffectPinned(e.itemId, e.effectId, !(e.pinned === true))}
              remainingUses={e.uses !== undefined ? (itemActionUses[e.effectId] ?? e.uses) : undefined}
              onConsumeUse={e.uses !== undefined ? () => useItemEffect(e.effectId) : undefined}
            />
          ))}
        </>
      )}
        </>
      )}

{/* ── Empty state ───────────────────────────────────────────────────── */}
      {isEmpty && (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: c.foreground }]}>No actions yet</Text>
          <Text style={[styles.emptyText, { color: c.mutedForeground }]}> 
            Equip a weapon to generate attack cards automatically.{"\n"}
            Class actions and features are added through leveling.
          </Text>
        </View>
      )}

      {/* Attacks empty but actions present — hint for weapons */}
      {visibleAttacks.length === 0 && (allActionable.length > 0 || classFeatures.length > 0) && (
        <View style={[styles.hintBox, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.hintText, { color: c.mutedForeground }]}>
            No weapons equipped. Equip a weapon to see attack cards here.
          </Text>
        </View>
      )}

      {!isEmpty && (
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: c.mutedForeground }}>
            Tip: long press cards to pin them to the top.
          </Text>
        </View>
      )}
      </ScrollHintScrollView>
    </>
  );
}

const makePageStyles = (c: { radiusXl: number; radiusPill: number; radiusSm: number; radiusMd: number }) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  combatFlowBanner: {
    borderWidth: 1,
    borderRadius: c.radiusXl,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  combatFlowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  combatFlowTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  combatFlowPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
    flex: 1,
  },
  combatFlowPill: {
    borderWidth: 1,
    borderRadius: c.radiusPill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  combatFlowPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  combatFlowText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  contextSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  contextSummaryChip: {
    borderWidth: 1,
    borderRadius: c.radiusPill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  contextSummaryChipText: {
    fontSize: 10,
    fontWeight: "700",
  },
  targetPicker: {
    borderWidth: 1,
    borderRadius: c.radiusXl,
    padding: 10,
    marginBottom: 10,
  },
  targetPickerLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  targetPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 6,
  },
  targetChip: {
    borderWidth: 1,
    borderRadius: c.radiusPill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 2,
  },
  headerNote: {
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  headerNoteInfo: {
    flex: 1,
    gap: 2,
  },
  attackGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  attackGridItem: {
    width: "49%",
  },
  attackGridItemSingle: {
    width: "100%",
  },
  noteText: { fontSize: 12, flex: 1, lineHeight: 17 },
  profNote: { fontSize: 13, fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  hintBox: {
    borderWidth: 1,
    borderRadius: c.radiusSm,
    padding: 14,
    marginTop: 16,
  },
  hintText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  viewToggleWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  viewToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: c.radiusSm,
    borderWidth: 1,
  },
  viewToggleText: { fontSize: 11, fontWeight: "600" },

  // Spell slot picker
  castOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  castSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, gap: 10, borderTopWidth: 1 },
  castHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 6 },
  castTitle: { fontSize: 18, fontWeight: "800" },
  castSub: { fontSize: 13, marginBottom: 4 },
  castAttackInputCard: { borderWidth: 1, borderRadius: c.radiusMd, padding: 10, gap: 8 },
  castSaveInputCard: { borderWidth: 1, borderRadius: c.radiusMd, padding: 10, gap: 8 },
  castAttackInputTitle: { fontSize: 13, fontWeight: "700" },
  castAttackInputHint: { fontSize: 12, lineHeight: 17 },
  castSaveMeta: { fontSize: 11 },
  castSaveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  castSaveTargetName: { flex: 1, fontSize: 12, fontWeight: "600" },
  castSaveInput: {
    width: 90,
    borderWidth: 1,
    borderRadius: c.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 14,
  },
  attackRollInput: {
    borderWidth: 1,
    borderRadius: c.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 14,
  },
  castAttackCritRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  castAttackCritLabel: { fontSize: 12, fontWeight: "600" },
  castSlotBtn: { borderWidth: 1, borderRadius: c.radiusXl, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  castSlotLabel: { fontSize: 15, fontWeight: "700" },
  castSlotSub: { fontSize: 12, marginTop: 2 },
  castPips: { flexDirection: "row", gap: 4 },
  castPip: { width: 10, height: 10, borderRadius: 5 },
  castNoSlots: { borderWidth: 1, borderRadius: c.radiusXl, padding: 16, alignItems: "center", gap: 8 },
  castNoSlotsText: { fontSize: 13, textAlign: "center" },
  castCancelBtn: { borderWidth: 1, borderRadius: c.radiusXl, padding: 14, alignItems: "center", marginTop: 4 },
  castCancelText: { fontSize: 15, fontWeight: "600" },

});

