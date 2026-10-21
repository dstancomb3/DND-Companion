import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator, Animated, Easing, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useFilterPanelMotion } from "@/hooks/useFilterPanelMotion";
import { useSwipeActions } from "@/hooks/useSwipeActions";
import type { Quest, QuestType, QuestStatus, ProposedInventoryItem, ProposedCurrencyChange, QuestLocationLinkMode } from "@/types";
import { API_BASE_URL } from "@/utils/apiUrl";
import { buildLocationHierarchy } from "@/utils/locationHierarchy";
import { createShadowStyle } from "../../utils/shadow";

const QUEST_TYPES: { value: QuestType; label: string; color: string }[] = [
  { value: "main",     label: "Main",     color: "#8B5CF6" },
  { value: "side",     label: "Side",     color: "#3B82F6" },
  { value: "personal", label: "Personal", color: "#14B8A6" },
];

const QUEST_STATUSES: { value: QuestStatus; label: string; color: string; icon: string }[] = [
  { value: "active",    label: "Active",    color: "#10B981", icon: "play-circle" },
  { value: "completed", label: "Completed", color: "#6B7280", icon: "check-circle" },
  { value: "failed",    label: "Failed",    color: "#EF4444", icon: "x-circle" },
];

function typeColor(t: QuestType) { return QUEST_TYPES.find(x => x.value === t)?.color ?? "#6B7280"; }
function typeLabel(t: QuestType) { return QUEST_TYPES.find(x => x.value === t)?.label ?? t; }
function statusColor(s: QuestStatus) { return QUEST_STATUSES.find(x => x.value === s)?.color ?? "#6B7280"; }
function statusLabel(s: QuestStatus) { return QUEST_STATUSES.find(x => x.value === s)?.label ?? s; }
function statusIcon(s: QuestStatus): any { return QUEST_STATUSES.find(x => x.value === s)?.icon ?? "circle"; }

function formatCurrency(c: ProposedCurrencyChange): string {
  const parts: string[] = [];
  if (c.pp) parts.push(`${c.pp} pp`);
  if (c.gp) parts.push(`${c.gp} gp`);
  if (c.ep) parts.push(`${c.ep} ep`);
  if (c.sp) parts.push(`${c.sp} sp`);
  if (c.cp) parts.push(`${c.cp} cp`);
  return parts.join(", ");
}

type FilterTab = "all" | QuestStatus;

interface KilledPerson { personId: string | null; name: string; killedBy: string; }
interface QuestToFail  { questId: string; questName: string; reason: string; }

// ── Quest Edit Modal ──────────────────────────────────────────────────────────

interface QuestModalProps {
  visible: boolean;
  quest: Quest | null;
  locations: { id: string; name: string; label?: string }[];
  people: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: Omit<Quest, "id" | "createdAt">) => void;
  onDelete?: () => void;
  onTrack?: () => void;
}

function QuestModal({ visible, quest, locations, people, onClose, onSave, onDelete, onTrack }: QuestModalProps) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const [name, setName] = useState("");
  const [type, setType] = useState<QuestType>("side");
  const [status, setStatus] = useState<QuestStatus>("active");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [locationTags, setLocationTags] = useState<string[]>([]);
  const [locationLinkModes, setLocationLinkModes] = useState<Record<string, QuestLocationLinkMode>>({});
  const [peopleTags, setPeopleTags] = useState<string[]>([]);

  React.useEffect(() => {
    if (visible) {
      setName(quest?.name ?? "");
      setType(quest?.type ?? "side");
      setStatus(quest?.status ?? "active");
      setDescription(quest?.description ?? "");
      setNotes(quest?.notes ?? "");
      setLocationTags(quest?.locationTags ?? []);
      setLocationLinkModes(quest?.locationLinkModes ?? {});
      setPeopleTags(quest?.peopleTags ?? []);
    }
  }, [visible, quest]);

  function toggleLocation(lid: string) {
    setLocationTags((prev) => {
      const selected = prev.includes(lid);
      if (selected) {
        setLocationLinkModes((current) => {
          const next = { ...current };
          delete next[lid];
          return next;
        });
        return prev.filter((x) => x !== lid);
      }
      setLocationLinkModes((current) => ({ ...current, [lid]: current[lid] ?? "direct_only" }));
      return [...prev, lid];
    });
  }

  function cycleLocationMode(lid: string) {
    if (!locationTags.includes(lid)) return;
    setLocationLinkModes((prev) => ({
      ...prev,
      [lid]: prev[lid] === "inherit_to_descendants" ? "direct_only" : "inherit_to_descendants",
    }));
  }

  function togglePerson(pid: string) {
    setPeopleTags(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]);
  }

  function handleSave() {
    if (!name.trim()) return Alert.alert("Name required", "Please enter a quest name.");
    const selectedIds = new Set(locationTags);
    const sanitizedModes = Object.fromEntries(
      Object.entries(locationLinkModes).filter(([locationId, mode]) => selectedIds.has(locationId) && (mode === "direct_only" || mode === "inherit_to_descendants"))
    ) as Record<string, QuestLocationLinkMode>;
    onSave({ name: name.trim(), type, status, description: description.trim() || undefined,
             notes: notes.trim() || undefined, locationTags, locationLinkModes: sanitizedModes,
             peopleTags: peopleTags.length > 0 ? peopleTags : undefined });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[s.modalHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose} style={s.modalHeaderBtn}>
            <Text style={[s.modalHeaderBtnText, { color: c.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[s.modalHeaderTitle, { color: c.foreground }]}>{quest ? "Edit Quest" : "New Quest"}</Text>
          <TouchableOpacity onPress={handleSave} style={s.modalHeaderBtn}>
            <Text style={[s.modalHeaderBtnText, { color: c.primary, fontWeight: "700" }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>QUEST NAME *</Text>
          <TextInput style={[s.input, { backgroundColor: c.card, borderColor: name.trim() ? c.primary : c.border, color: c.foreground }]}
            placeholder="Enter quest name" placeholderTextColor={c.mutedForeground} value={name} onChangeText={setName} />

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>TYPE</Text>
          <View style={s.chipRow}>
            {QUEST_TYPES.map(t => (
              <TouchableOpacity key={t.value} onPress={() => setType(t.value)} activeOpacity={0.8}
                style={[s.chip, { borderColor: t.color, backgroundColor: type === t.value ? t.color + "30" : c.card }]}>
                <Text style={[s.chipText, { color: type === t.value ? t.color : c.mutedForeground }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>STATUS</Text>
          <View style={s.chipRow}>
            {QUEST_STATUSES.map(st => (
              <TouchableOpacity key={st.value} onPress={() => setStatus(st.value)} activeOpacity={0.8}
                style={[s.chip, { borderColor: st.color, backgroundColor: status === st.value ? st.color + "30" : c.card }]}>
                <Feather name={st.icon as any} size={13} color={status === st.value ? st.color : c.mutedForeground} />
                <Text style={[s.chipText, { color: status === st.value ? st.color : c.mutedForeground }]}>{st.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>DESCRIPTION</Text>
          <TextInput style={[s.input, s.inputMulti, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="Objectives, background, context..." placeholderTextColor={c.mutedForeground}
            value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />

          {locations.length > 0 && (
            <>
              <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>LINKED LOCATIONS</Text>
              <View style={s.chipRow}>
                {locations.map(l => {
                  const sel = locationTags.includes(l.id);
                  const mode = locationLinkModes[l.id] ?? "direct_only";
                  return (
                    <TouchableOpacity key={l.id} onPress={() => toggleLocation(l.id)} onLongPress={() => cycleLocationMode(l.id)} activeOpacity={0.8}
                      style={[s.chip, { borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primary + "20" : c.card }]}>
                      <Feather name="map-pin" size={11} color={sel ? c.primary : c.mutedForeground} />
                      <Text style={[s.chipText, { color: sel ? c.primary : c.mutedForeground }]}>
                        {l.label ?? l.name}{sel ? (mode === "inherit_to_descendants" ? " [Desc]" : " [Direct]") : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[s.helperText, { color: c.mutedForeground }]}>Long press a selected location to toggle inheritance to sublocations.</Text>
            </>
          )}

          {people.length > 0 && (
            <>
              <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>LINKED PEOPLE</Text>
              <View style={s.chipRow}>
                {people.map(p => {
                  const sel = peopleTags.includes(p.id);
                  return (
                    <TouchableOpacity key={p.id} onPress={() => togglePerson(p.id)} activeOpacity={0.8}
                      style={[s.chip, { borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primary + "20" : c.card }]}>
                      <Feather name="user" size={11} color={sel ? c.primary : c.mutedForeground} />
                      <Text style={[s.chipText, { color: sel ? c.primary : c.mutedForeground }]}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>NOTES</Text>
          <TextInput style={[s.input, s.inputMulti, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="Clues, NPCs involved, rewards..." placeholderTextColor={c.mutedForeground}
            value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" />

          {quest && (
            <View style={s.modalActions}>
              {onTrack && (
                <TouchableOpacity onPress={() => { onClose(); onTrack(); }} activeOpacity={0.8}
                  style={[s.modalActionBtn, { borderColor: c.primary + "50", backgroundColor: c.primary + "10" }]}>
                  <Feather name={quest.pinned ? "bookmark" : "bookmark"} size={15} color={c.primary} />
                  <Text style={[s.modalActionBtnText, { color: c.primary }]}>{quest.pinned ? "Untrack" : "Track Quest"}</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity onPress={() => { onClose(); onDelete(); }} activeOpacity={0.8}
                  style={[s.modalActionBtn, { borderColor: "#EF444450", backgroundColor: "#EF444410" }]}>
                  <Feather name="trash-2" size={15} color="#EF4444" />
                  <Text style={[s.modalActionBtnText, { color: "#EF4444" }]}>Delete Quest</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Complete Quest Modal ──────────────────────────────────────────────────────

interface RewardState {
  loading: boolean;
  hasRewards: boolean;
  summary: string;
  currency: ProposedCurrencyChange | null;
  items: ProposedInventoryItem[];
  killedPeople: KilledPerson[];
  questsToFail: QuestToFail[];
  error?: string;
}

interface CompleteQuestModalProps {
  quest: Quest | null;
  rewardState: RewardState | null;
  onClaimAndComplete: () => void;
  onCompleteWithoutRewards: () => void;
  onCancel: () => void;
}

function CompleteQuestModal({ quest, rewardState, onClaimAndComplete, onCompleteWithoutRewards, onCancel }: CompleteQuestModalProps) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  if (!quest) return null;

  const visible = rewardState !== null;
  const loading = rewardState?.loading ?? false;
  const hasRewards = rewardState?.hasRewards ?? false;
  const currencyStr = rewardState?.currency ? formatCurrency(rewardState.currency) : "";
  const items = rewardState?.items ?? [];
  const killedPeople = rewardState?.killedPeople ?? [];
  const questsToFail = rewardState?.questsToFail ?? [];
  const hasCascade = killedPeople.length > 0 || questsToFail.length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[s.modalHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onCancel} style={s.modalHeaderBtn} disabled={loading}>
            <Text style={[s.modalHeaderBtnText, { color: loading ? c.mutedForeground + "55" : c.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[s.modalHeaderTitle, { color: c.foreground }]}>Complete Quest</Text>
          <View style={{ minWidth: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={[s.questNameBanner, { backgroundColor: "#10B98115", borderColor: "#10B98140" }]}>
            <Feather name="check-circle" size={18} color="#10B981" />
            <Text style={[s.questNameBannerText, { color: c.foreground }]} numberOfLines={2}>{quest.name}</Text>
          </View>

          {loading && (
            <View style={s.loadingBox}>
              <ActivityIndicator size="small" color={c.primary} />
              <Text style={[s.loadingText, { color: c.mutedForeground }]}>Analysing quest consequences…</Text>
            </View>
          )}

          {!loading && rewardState?.error && (
            <View style={[s.infoBox, { backgroundColor: "#EF444415", borderColor: "#EF444440" }]}>
              <Feather name="alert-circle" size={15} color="#EF4444" />
              <Text style={{ color: "#EF4444", fontSize: 13, flex: 1 }}>{rewardState.error}</Text>
            </View>
          )}

          {!loading && !rewardState?.error && !hasRewards && !hasCascade && (
            <View style={[s.infoBox, { backgroundColor: c.card, borderColor: c.border }]}>
              <Feather name="info" size={15} color={c.mutedForeground} />
              <Text style={[s.infoBoxText, { color: c.mutedForeground }]}>No rewards or consequences found in quest notes.</Text>
            </View>
          )}

          {/* ── Rewards ─────────────────────────────────────────────────── */}
          {!loading && hasRewards && (
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: c.foreground }]}>Rewards</Text>
              <Text style={[s.sectionSub, { color: c.mutedForeground }]}>{rewardState?.summary}</Text>
              {currencyStr ? (
                <View style={[s.effectRow, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" }]}>
                  <Text style={s.effectRowIcon}>🪙</Text>
                  <Text style={[s.effectRowText, { color: c.foreground }]}>{currencyStr}</Text>
                </View>
              ) : null}
              {items.map((item, idx) => (
                <View key={item.id ?? idx} style={[s.effectRow, { backgroundColor: c.card, borderColor: c.border }]}>
                  <Text style={s.effectRowIcon}>🎒</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.effectRowText, { color: c.foreground }]}>
                      {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}
                    </Text>
                    {item.notes ? <Text style={[s.effectRowNote, { color: c.mutedForeground }]} numberOfLines={2}>{item.notes}</Text> : null}
                    {item.tags && item.tags.length > 0 && (
                      <View style={s.tagRow}>
                        {item.tags.slice(0, 4).map(tag => (
                          <View key={tag} style={[s.tagChip, { borderColor: c.border, backgroundColor: c.background }]}>
                            <Text style={[s.tagChipText, { color: c.mutedForeground }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Cascade — Killed people ──────────────────────────────────── */}
          {!loading && killedPeople.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: "#EF4444" }]}>People Killed</Text>
              <Text style={[s.sectionSub, { color: c.mutedForeground }]}>These NPCs will be marked as deceased in your journal.</Text>
              {killedPeople.map((kp, idx) => (
                <View key={kp.personId ?? idx} style={[s.effectRow, { backgroundColor: "#EF444415", borderColor: "#EF444440" }]}>
                  <Text style={s.effectRowIcon}>💀</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.effectRowText, { color: "#EF4444" }]}>{kp.name}</Text>
                    <Text style={[s.effectRowNote, { color: c.mutedForeground }]}>Killed by {kp.killedBy}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Cascade — Quests that fail ───────────────────────────────── */}
          {!loading && questsToFail.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: "#F59E0B" }]}>Quests That Will Fail</Text>
              <Text style={[s.sectionSub, { color: c.mutedForeground }]}>These quests become impossible to complete.</Text>
              {questsToFail.map((qf, idx) => (
                <View key={qf.questId ?? idx} style={[s.effectRow, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" }]}>
                  <Text style={s.effectRowIcon}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.effectRowText, { color: "#F59E0B" }]}>{qf.questName}</Text>
                    <Text style={[s.effectRowNote, { color: c.mutedForeground }]}>{qf.reason}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[s.completeActions, { borderTopColor: c.border, backgroundColor: c.card }]}>
          {!loading && (hasRewards || hasCascade) && (
            <TouchableOpacity onPress={onClaimAndComplete} activeOpacity={0.85} style={[s.claimBtn, { backgroundColor: "#10B981" }]}>
              <Feather name="check-circle" size={16} color="#fff" />
              <Text style={s.claimBtnText}>
                {hasRewards ? "Claim Rewards & Complete" : "Confirm & Complete"}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onCompleteWithoutRewards}
            activeOpacity={0.85}
            disabled={loading}
            style={[s.noRewardBtn, { borderColor: loading ? c.border + "55" : c.border }]}
          >
            <Feather name="check" size={15} color={loading ? c.mutedForeground + "55" : c.mutedForeground} />
            <Text style={[s.noRewardBtnText, { color: loading ? c.mutedForeground + "55" : c.mutedForeground }]}>
              {(hasRewards || hasCascade) ? "Complete Without Applying" : "Complete Quest"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Swipeable quest card ──────────────────────────────────────────────────────

function SwipeableQuestCard({ quest, locations, locationLabelById, personNameById, onEdit, onTrack, onDelete, onCycleStatus, onComplete }: {
  quest: Quest;
  locations: { id: string; name: string }[];
  locationLabelById: Record<string, string>;
  personNameById: Record<string, string>;
  onEdit: () => void;
  onTrack: () => void;
  onDelete: () => void;
  onCycleStatus: () => void;
  onComplete: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { settings } = useAppSettings();
  const ACTION_WIDTH = 88;
  const isActive = quest.status === "active";
  const tColor = typeColor(quest.type);
  const canTrack = quest.status === "active";
  const { animatedStyle, panHandlers, revealed, close } = useSwipeActions({
    actionWidth: ACTION_WIDTH,
    motionIntensity: settings.motionIntensity,
  });

  const linkedLocs = locations.filter(l => quest.locationTags.includes(l.id));

  return (
    <View style={{ borderRadius: c.radiusXl, overflow: "hidden" }}>
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
        <TouchableOpacity style={[qsw.action, { backgroundColor: "#ef444422", width: ACTION_WIDTH }]}
          onPress={() => { close(); onDelete(); }} activeOpacity={0.8}>
          <Feather name="trash-2" size={18} color="#ef4444" />
          <Text style={[qsw.actionText, { color: "#ef4444" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={animatedStyle} {...panHandlers}>
        <TouchableOpacity activeOpacity={0.85}
          onPress={() => { if (revealed) { close(); } else { onEdit(); } }}
          onLongPress={() => {
            if (!canTrack) {
              Alert.alert("Only active quests can be tracked", "Set this quest to Active to track it on your sheet.");
              return;
            }
            onTrack();
          }}
          style={[s.card, { backgroundColor: c.card, borderColor: quest.pinned ? c.primary + "60" : c.border, opacity: quest.status !== "active" ? 0.75 : 1 }]}>
          {quest.pinned && (
            <View style={[s.pinnedBanner, { backgroundColor: c.primary + "15" }]}>
              <Feather name="bookmark" size={11} color={c.primary} />
              <Text style={[s.pinnedText, { color: c.primary }]}>TRACKED</Text>
            </View>
          )}
          <View style={s.cardHeader}>
            <View style={s.cardLeft}>
              <Text style={[s.cardName, { color: c.foreground, textDecorationLine: quest.status === "failed" ? "line-through" : "none" }]}>
                {quest.name}
              </Text>
            </View>
            <View style={s.badgesRow}>
              <View style={[s.badge, { backgroundColor: tColor + "20", borderColor: tColor + "50" }]}>
                <Text style={[s.badgeText, { color: tColor }]}>{typeLabel(quest.type).toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={onCycleStatus} activeOpacity={0.8}
                style={[s.badge, { backgroundColor: statusColor(quest.status) + "20", borderColor: statusColor(quest.status) + "50" }]}>
                <Feather name={statusIcon(quest.status)} size={10} color={statusColor(quest.status)} />
                <Text style={[s.badgeText, { color: statusColor(quest.status) }]}>{statusLabel(quest.status).toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {quest.description && (
            <Text style={[s.cardDesc, { color: c.mutedForeground }]} numberOfLines={2}>{quest.description}</Text>
          )}
          {linkedLocs.length > 0 && (
            <View style={s.tagRow}>
              {linkedLocs.map(l => (
                <View key={l.id} style={[s.tagChip, { borderColor: "#F59E0B50", backgroundColor: "#F59E0B15" }]}>
                  <Feather name="map-pin" size={10} color="#F59E0B" />
                  <Text style={[s.tagChipText, { color: "#F59E0B" }]}>{locationLabelById[l.id] ?? l.name}</Text>
                  {quest.locationLinkModes?.[l.id] === "inherit_to_descendants" ? (
                    <Text style={[s.modeChipText, { color: "#F59E0B" }]}>DESC</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
          {(quest.peopleTags ?? []).filter(id => personNameById[id]).length > 0 && (
            <View style={s.tagRow}>
              {(quest.peopleTags ?? [])
                .filter(id => personNameById[id])
                .map(id => (
                  <View key={id} style={[s.tagChip, { borderColor: c.primary + "50", backgroundColor: c.primary + "15" }]}>
                    <Feather name="user" size={10} color={c.primary} />
                    <Text style={[s.tagChipText, { color: c.primary }]}>{personNameById[id]}</Text>
                  </View>
                ))}
            </View>
          )}
          {isActive && (
            <View style={s.actionRow}>
              {quest.pinned && (
                <TouchableOpacity onPress={onTrack} activeOpacity={0.8}
                  style={[s.trackBtn, { borderColor: c.primary + "60", backgroundColor: c.primary + "15" }]}>
                  <Feather name="bookmark" size={13} color={c.primary} />
                  <Text style={[s.completeBtnText, { color: c.primary }]}>Untrack</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onComplete} activeOpacity={0.8}
                style={[s.completeBtn, { borderColor: "#10B98160", backgroundColor: "#10B98110" }]}>
                <Feather name="check-circle" size={13} color="#10B981" />
                <Text style={[s.completeBtnText, { color: "#10B981" }]}>Complete</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const qsw = StyleSheet.create({
  action: { alignItems: "center", justifyContent: "center", gap: 4, height: "100%" },
  actionText: { fontSize: 11, fontWeight: "600" },
});

// ── QuestsTab ─────────────────────────────────────────────────────────────────

export function QuestsTab() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { settings } = useAppSettings();
  const { quests, locations, people, addQuest, updateQuest, deleteQuest, updateCurrency, applyProposedItems, updatePerson, pinQuest } = useCharacter();
  const locationHierarchy = useMemo(() => buildLocationHierarchy(locations), [locations]);
  const locationLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    locationHierarchy.forEach(({ location, breadcrumb }) => {
      map[location.id] = breadcrumb || location.name;
    });
    return map;
  }, [locationHierarchy]);
  const locationOptions = useMemo(() => locationHierarchy.map(({ location, breadcrumb }) => ({
    id: location.id,
    name: location.name,
    label: breadcrumb || location.name,
  })), [locationHierarchy]);
  const personNameById = useMemo(() => {
    const map: Record<string, string> = {};
    people.forEach((p) => { map[p.id] = p.name; });
    return map;
  }, [people]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | QuestType>("all");
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Quest | null>(null);

  const [completing, setCompleting] = useState<Quest | null>(null);
  const [rewardState, setRewardState] = useState<RewardState | null>(null);
  const { filterPanelAnimatedStyle } = useFilterPanelMotion(showFilters, settings);

  const filtered = useMemo(() => {
    let list = filter === "all" ? quests : quests.filter(q => q.status === filter);
    if (trackedOnly) list = list.filter((q) => q.pinned);
    if (typeFilter !== "all") list = list.filter((q) => q.type === typeFilter);
    const q = search.toLowerCase().trim();
    if (q) list = list.filter(quest => quest.name.toLowerCase().includes(q) || (quest.description ?? "").toLowerCase().includes(q));
    const statusOrder: Record<string, number> = { active: 0, completed: 1, failed: 2 };
    const typeOrder: Record<string, number>   = { main: 0, side: 1, personal: 2 };
    return [...list].sort((a, b) => {
      if ((a.pinned ? 0 : 1) !== (b.pinned ? 0 : 1)) return (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1);
      const sd = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (sd !== 0) return sd;
      const td = (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
      if (td !== 0) return td;
      return b.createdAt - a.createdAt;
    });
  }, [quests, filter, trackedOnly, search, typeFilter]);

  function openNew() { setEditing(null); setModalVisible(true); }
  function openEdit(q: Quest) { setEditing(q); setModalVisible(true); }

  function handleSave(data: Omit<Quest, "id" | "createdAt">) {
    if (editing) updateQuest(editing.id, data);
    else addQuest(data);
    setModalVisible(false);
  }

  function handleDelete(q: Quest) {
    Alert.alert("Remove Quest", `Remove "${q.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteQuest(q.id) },
    ]);
  }

  function cycleStatus(q: Quest) {
    const order: QuestStatus[] = ["active", "completed", "failed"];
    const next = order[(order.indexOf(q.status) + 1) % order.length];
    updateQuest(q.id, { status: next });
  }

  async function handleCompletePress(q: Quest) {
    setCompleting(q);
    const questText = [q.description, q.notes].filter(Boolean).join("\n\n").trim();

    if (!questText) {
      setRewardState({ loading: false, hasRewards: false, summary: "", currency: null, items: [], killedPeople: [], questsToFail: [] });
      return;
    }

    setRewardState({ loading: true, hasRewards: false, summary: "", currency: null, items: [], killedPeople: [], questsToFail: [] });

    const otherActiveQuests = quests.filter(oq => oq.id !== q.id && oq.status === "active").map(oq => ({
      id: oq.id, name: oq.name, description: oq.description, notes: oq.notes,
    }));

    const peopleContext = people.filter(p => !p.deceased).map(p => ({
      id: p.id, name: p.name, role: p.role,
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/parse-quest-reward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: questText,
          questName: q.name,
          questContext: otherActiveQuests,
          peopleContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setRewardState({
        loading: false,
        hasRewards: data.hasRewards ?? false,
        summary: data.summary ?? "Quest completed",
        currency: data.proposedCurrencyChange ?? null,
        items: data.proposedInventoryChanges ?? [],
        killedPeople: data.killedPeople ?? [],
        questsToFail: data.questsToFail ?? [],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach the AI server";
      setRewardState({ loading: false, hasRewards: false, summary: "", currency: null, items: [], killedPeople: [], questsToFail: [], error: msg });
    }
  }

  function applyCompletion(applyEffects: boolean) {
    if (!completing) return;

    if (applyEffects && rewardState) {
      if (rewardState.currency) updateCurrency(rewardState.currency);
      if (rewardState.items.length) applyProposedItems(rewardState.items);

      for (const kp of rewardState.killedPeople) {
        if (kp.personId) {
          const existing = people.find(p => p.id === kp.personId);
          const deceasedNote = `Killed by ${kp.killedBy}`;
          const newNotes = existing?.notes
            ? `${existing.notes}\n${deceasedNote}`
            : deceasedNote;
          updatePerson(kp.personId, { deceased: true, deceasedNote, notes: newNotes });
        }
      }

      for (const qf of rewardState.questsToFail) {
        const existingQ = quests.find(oq => oq.id === qf.questId);
        if (existingQ) {
          const failNote = `Failed: ${qf.reason}`;
          const newNotes = existingQ.notes ? `${existingQ.notes}\n${failNote}` : failNote;
          updateQuest(qf.questId, { status: "failed", notes: newNotes });
        }
      }
    }

    updateQuest(completing.id, { status: "completed" });
    setCompleting(null);
    setRewardState(null);
  }

  const FILTER_TABS: { value: FilterTab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Done" },
    { value: "failed", label: "Failed" },
  ];
  const fabBottom = Platform.OS === "web" ? 8 : tabBarHeight + 8;
  const listBottomPadding = fabBottom + 74;

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.searchRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <Feather name="search" size={15} color={c.mutedForeground} />
        <TextInput style={[s.searchInput, { color: c.foreground }]} placeholder="Search quests..."
          placeholderTextColor={c.mutedForeground} value={search} onChangeText={setSearch} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={15} color={c.mutedForeground} /></TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setShowFilters((prev) => !prev)}
          activeOpacity={0.8}
          style={[s.filterToggle, { borderColor: showFilters ? c.primary : c.border, backgroundColor: showFilters ? c.primary + "18" : c.secondary }]}
        >
          <Feather name="filter" size={12} color={showFilters ? c.primary : c.mutedForeground} />
          <Text style={[s.filterToggleText, { color: showFilters ? c.primary : c.mutedForeground }]}>Filters</Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <Animated.View
          style={[
            s.filterPanel,
            {
              backgroundColor: c.card,
              borderColor: c.border,
              ...filterPanelAnimatedStyle,
            },
          ]}
        >
          <View style={s.filterPanelRow}>
            <Text style={[s.filterPanelLabel, { color: c.mutedForeground }]}>Tracked only</Text>
            <Switch
              value={trackedOnly}
              onValueChange={setTrackedOnly}
              trackColor={{ false: c.muted, true: c.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={c.muted}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={[s.filterPanelLabel, { color: c.mutedForeground }]}>Quest type</Text>
            <View style={s.filterTypeRow}>
              <TouchableOpacity
                onPress={() => setTypeFilter("all")}
                style={[s.filterTypeChip, { borderColor: typeFilter === "all" ? c.primary : c.border, backgroundColor: typeFilter === "all" ? c.primary + "20" : c.secondary }]}
              >
                <Text style={[s.filterTypeText, { color: typeFilter === "all" ? c.primary : c.mutedForeground }]}>All</Text>
              </TouchableOpacity>
              {QUEST_TYPES.map((qt) => {
                const active = typeFilter === qt.value;
                return (
                  <TouchableOpacity
                    key={qt.value}
                    onPress={() => setTypeFilter(qt.value)}
                    style={[s.filterTypeChip, { borderColor: active ? qt.color : c.border, backgroundColor: active ? qt.color + "20" : c.secondary }]}
                  >
                    <Text style={[s.filterTypeText, { color: active ? qt.color : c.mutedForeground }]}>{qt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      )}

      <View style={s.filterRow}>
        {FILTER_TABS.map(ft => {
          const active = filter === ft.value;
          const count = ft.value === "all" ? quests.length : quests.filter(q => q.status === ft.value).length;
          return (
            <TouchableOpacity key={ft.value} onPress={() => setFilter(ft.value)} activeOpacity={0.8}
              style={[s.filterChip, { backgroundColor: active ? c.primary : c.card, borderColor: active ? c.primary : c.border }]}>
              <Text style={[s.filterChipText, { color: active ? c.primaryForeground : c.mutedForeground }]}>
                {ft.label}{count > 0 ? ` (${count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Feather name="flag" size={44} color={c.mutedForeground + "55"} />
          <Text style={[s.emptyTitle, { color: c.mutedForeground }]}>{search || filter !== "all" ? "No matching quests" : "No quests yet"}</Text>
          {!search && filter === "all" && <Text style={[s.emptySub, { color: c.mutedForeground + "99" }]}>Track your main and side quests</Text>}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={q => q.id}
          contentContainerStyle={[s.list, { paddingBottom: listBottomPadding }]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginBottom: 6 }}>
              <Feather name="chevrons-left" size={12} color={c.mutedForeground + "88"} />
              <Text style={{ fontSize: 11, color: c.mutedForeground + "88", fontStyle: "italic" }}>long press to track • swipe to delete</Text>
            </View>
          }
          renderItem={({ item: q }) => (
            <SwipeableQuestCard
              quest={q}
              locations={locations}
              locationLabelById={locationLabelById}
              personNameById={personNameById}
              onEdit={() => openEdit(q)}
              onTrack={() => pinQuest(q.id, !q.pinned)}
              onDelete={() => handleDelete(q)}
              onCycleStatus={() => cycleStatus(q)}
              onComplete={() => handleCompletePress(q)}
            />
          )}
        />
      )}

      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary, bottom: fabBottom }]} onPress={openNew} activeOpacity={0.85}>
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <QuestModal visible={modalVisible} quest={editing} locations={locationOptions} people={people}
        onClose={() => setModalVisible(false)} onSave={handleSave}
        onDelete={editing ? () => handleDelete(editing) : undefined}
        onTrack={editing ? () => { pinQuest(editing.id, !editing.pinned); setModalVisible(false); } : undefined} />

      <CompleteQuestModal
        quest={completing}
        rewardState={rewardState}
        onClaimAndComplete={() => applyCompletion(true)}
        onCompleteWithoutRewards={() => applyCompletion(false)}
        onCancel={() => { setCompleting(null); setRewardState(null); }}
      />
    </View>
  );
}

const makeS = (c: { radiusPill: number; radiusXl: number; radiusMd: number; radiusSm: number }) => StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: c.radiusMd, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  filterToggle: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 9, paddingVertical: 5 },
  filterToggleText: { fontSize: 11, fontWeight: "700" },
  filterPanel: { marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderRadius: c.radiusMd, padding: 10, gap: 10 },
  filterPanelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  filterPanelLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  filterTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterTypeChip: { borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 10, paddingVertical: 5 },
  filterTypeText: { fontSize: 11, fontWeight: "700" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  filterChip: { borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 12, paddingVertical: 6 },
  filterChipText: { fontSize: 12, fontWeight: "600" },
  list: { paddingHorizontal: 12, paddingBottom: 100, paddingTop: 4 },
  pinnedBanner: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: c.radiusSm, marginBottom: 8, alignSelf: "flex-start" },
  pinnedText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  trackBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: c.radiusSm, borderWidth: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 80 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  emptySub: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: c.radiusXl, padding: 14, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  badgesRow: { flexDirection: "row", gap: 6, flexShrink: 0 },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagChip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 8, paddingVertical: 3 },
  tagChipText: { fontSize: 11, fontWeight: "600" },
  modeChipText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  completeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: c.radiusSm, paddingVertical: 8, paddingHorizontal: 12, marginTop: 2 },
  completeBtnText: { fontSize: 13, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 8 },
  modalActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderWidth: 1, borderRadius: c.radiusMd },
  modalActionBtnText: { fontSize: 14, fontWeight: "600" },
  fab: { position: "absolute", bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", ...createShadowStyle({ y: 4, blur: 8, opacity: 0.3, elevation: 8 }) },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalHeaderTitle: { fontSize: 16, fontWeight: "700" },
  modalHeaderBtn: { minWidth: 60, alignItems: "center" },
  modalHeaderBtnText: { fontSize: 15 },
  modalBody: { padding: 16, paddingBottom: 60, gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  helperText: { fontSize: 11, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: c.radiusMd, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderRadius: c.radiusPill, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: "600" },
  // Complete modal
  questNameBanner: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: c.radiusMd, padding: 14 },
  questNameBannerText: { flex: 1, fontSize: 16, fontWeight: "700" },
  loadingBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 14 },
  infoBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: c.radiusMd, padding: 14 },
  infoBoxText: { flex: 1, fontSize: 14 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionSub: { fontSize: 13, lineHeight: 18 },
  effectRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: c.radiusMd, padding: 12 },
  effectRowIcon: { fontSize: 18, lineHeight: 22 },
  effectRowText: { fontSize: 14, fontWeight: "600" },
  effectRowNote: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  completeActions: { borderTopWidth: 1, padding: 16, paddingBottom: Platform.OS === "ios" ? 34 : 16, gap: 10 },
  claimBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: c.radiusXl, paddingVertical: 15 },
  claimBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  noRewardBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: c.radiusXl, borderWidth: 1, paddingVertical: 12 },
  noRewardBtnText: { fontSize: 15, fontWeight: "600" },
});
