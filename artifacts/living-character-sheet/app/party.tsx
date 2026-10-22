import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useParty } from "@/context/PartyContext";
import { useCharacter } from "@/context/CharacterContext";
import { THEMES, useAppSettings } from "@/context/AppSettingsContext";
import { useEffectiveStats } from "@/hooks/useEffectiveStats";
import {
  acceptPartyNoteAssignment,
  claimPartyLootAssignment,
  createPartyLootAssignments,
  declinePartyNoteAssignment,
  submitPartyRollResponse,
  type LootAssignment,
  type NotesAssignment,
  type NotesAssignmentPayload,
  type PartyMemberSummary,
  type PartyRollRequest,
} from "@/utils/partyApi";
import { triggerEffect } from "@/utils/triggerEffect";
import { mergeAssignedNotesPayload } from "@/utils/partyNotesMerge";
import {
  buildPartyEventHistoryView,
  type PartyEventRelevanceFilter,
} from "@/utils/partyEventHistory";
import { buildPartyMemberSheetPath } from "@/utils/partyMemberSheetNavigation";
import {
  buildLootAssignmentItemFromInventory,
  getRemainingQuantityAfterTransfer,
  getTransferableInventoryItems,
} from "@/utils/partyItemTransfer";
import type { InventoryItem, ItemCategory, ProposedInventoryItem } from "@/types";
import { AiDmSessionAwarenessPlaceholderStrip } from "@/components/adventure/AiDmSessionAwarenessPlaceholderStrip";
import { useAdventureSessionAwareness } from "@/context/AdventureSessionContext";

function HpBar({ current, max, tempHp, labelColor, valueColor, trackColor }: { current: number; max: number; tempHp: number; labelColor: string; valueColor: string; trackColor: string }) {
  const pct = max > 0 ? Math.min(1, current / max) : 0;
  const hpColor = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#f87171";

  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 11, color: labelColor }}>HP</Text>
        <Text style={{ fontSize: 11, color: valueColor, fontWeight: "700" }}>
          {current}/{max}{tempHp > 0 ? ` +${tempHp}` : ""}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: trackColor, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: hpColor, borderRadius: 3 }} />
      </View>
    </View>
  );
}

function MemberCard({ member, initiativeTotal, onPressName }: { member: PartyMemberSummary; initiativeTotal?: number; onPressName?: () => void }) {
  const c = useColors();
  const { settings } = useAppSettings();
  const conditions = (member.conditions ?? []) as Array<{ id: string; name: string }>;
  const profileUri = member.presentation?.profileImageUri?.trim() || "";
  const personalTheme = !settings.disablePartyCardThemes && member.presentation?.themeId
    ? THEMES[member.presentation.themeId as keyof typeof THEMES]
    : null;
  const accent = member.presentation?.accentHex || personalTheme?.palette.primary || c.primary;
  const cardBg = personalTheme?.palette.card || c.card;
  const localBg = personalTheme?.palette.background || c.background;
  const localBorder = personalTheme?.palette.border || c.border;
  const localMuted = personalTheme?.palette.mutedForeground || c.mutedForeground;
  const localFg = personalTheme?.palette.foreground || c.foreground;
  const stat = (value: number | null | undefined) => (typeof value === "number" ? `${value >= 0 ? "+" : ""}${value}` : "--");

  const cardContent = (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: accent + "66" }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
          {profileUri ? (
            <Image source={{ uri: profileUri }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { borderColor: accent + "66", backgroundColor: accent + "1A" }]}>
              <Feather name="user" size={16} color={accent} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: localFg }} numberOfLines={1}>
              {member.characterName}
            </Text>
            <Text style={{ fontSize: 12, color: localMuted }}>{member.characterClass}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {typeof initiativeTotal === "number" && (
            <View style={[styles.acBadge, { backgroundColor: "#22C55E22", borderColor: "#22C55E55" }]}>
              <Text style={{ fontSize: 10, color: localMuted, fontWeight: "600" }}>INIT</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#22C55E" }}>{initiativeTotal}</Text>
            </View>
          )}
          <View style={[styles.acBadge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
            <Text style={{ fontSize: 10, color: localMuted, fontWeight: "600" }}>AC</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: accent }}>{member.armorClass}</Text>
          </View>
        </View>
      </View>

      <HpBar
        current={member.currentHp}
        max={member.maxHp}
        tempHp={member.tempHp}
        labelColor={localMuted}
        valueColor={localFg}
        trackColor={localBorder}
      />

      {member.coreStats && (
        <View style={{ marginTop: 8, gap: 6 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
              <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>SPD {member.coreStats.speed ?? "--"}</Text>
            </View>
            <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
              <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>INIT {stat(member.coreStats.initiativeBonus)}</Text>
            </View>
            <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
              <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>STR {stat(member.coreStats.strength)}</Text>
            </View>
            <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
              <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>DEX {stat(member.coreStats.dexterity)}</Text>
            </View>
            <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
              <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>CON {stat(member.coreStats.constitution)}</Text>
            </View>
            <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
              <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>INT {stat(member.coreStats.intelligence)}</Text>
            </View>
            <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
              <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>WIS {stat(member.coreStats.wisdom)}</Text>
            </View>
            <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
              <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>CHA {stat(member.coreStats.charisma)}</Text>
            </View>
          </View>
        </View>
      )}

      {conditions.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {conditions.map((cond) => (
            <View key={cond.id} style={[styles.conditionBadge, { backgroundColor: "#f97316" + "22", borderColor: "#f97316" + "55" }]}>
              <Text style={{ fontSize: 10, color: "#f97316", fontWeight: "600" }}>{cond.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (!onPressName) return cardContent;

  return (
    <TouchableOpacity onPress={onPressName} activeOpacity={0.85}>
      {cardContent}
    </TouchableOpacity>
  );
}

function PartyScreenHeader({
  cardColor,
  borderColor,
  foregroundColor,
}: {
  cardColor?: string;
  borderColor?: string;
  foregroundColor?: string;
}) {
  const c = useColors();
  const resolvedCardColor = cardColor ?? c.card;
  const resolvedBorderColor = borderColor ?? c.border;
  const resolvedForegroundColor = foregroundColor ?? c.foreground;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 }}>
      <TouchableOpacity
        onPress={handleBack}
        activeOpacity={0.75}
        style={[styles.backBtn, { backgroundColor: resolvedCardColor, borderColor: resolvedBorderColor }]}
      >
        <Feather name="arrow-left" size={14} color={resolvedForegroundColor} />
        <Text style={{ color: resolvedForegroundColor, fontSize: 13, fontWeight: "700" }}>Back to Sheet</Text>
      </TouchableOpacity>
    </View>
  );
}

function JoinCodeInput({ onSubmit }: { onSubmit: (code: string) => void }) {
  const c = useColors();
  const [code, setCode] = useState("");

  const handleSubmit = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert("Enter a code", "Please enter a party code to join.");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 12 }}>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Enter party code"
        placeholderTextColor={c.mutedForeground}
        style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, color: c.foreground, backgroundColor: c.card, fontSize: 16 }}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="join"
        onSubmitEditing={handleSubmit}
      />
      <TouchableOpacity onPress={handleSubmit} style={[styles.btn, { backgroundColor: c.primary }]}> 
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Join</Text>
      </TouchableOpacity>
    </View>
  );
}

function isPortableMapImageUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  return /^data:image\//i.test(trimmed) || /^https?:\/\//i.test(trimmed);
}

export default function PartyScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ section?: string }>();
  const { settings, updateSettings } = useAppSettings();
  const { awarenessPlaceholder, clearActiveSession } = useAdventureSessionAwareness();
  const {
    quests,
    people,
    locations,
    inventory,
    addNote,
    addQuest,
    updateQuest,
    addPerson,
    updatePerson,
    addLocation,
    updateLocation,
    addItem,
    removeItem,
    updateItem,
    applyProposedItems,
    character,
  } = useCharacter();
  const eff = useEffectiveStats();
  const {
    partyCode,
    memberId,
    members,
    combatState,
    isInParty,
    isLoading,
    error,
    createAndJoinParty,
    joinExistingParty,
    leaveCurrentParty,
    refreshMembers,
  } = useParty();

  const activeMemberTheme = useMemo(() => {
    if (settings.disablePartyCardThemes || !memberId) return null;
    const currentMember = members.find((m) => m.id === memberId);
    const themeId = currentMember?.presentation?.themeId as keyof typeof THEMES | undefined;
    return themeId ? THEMES[themeId] : null;
  }, [memberId, members, settings.disablePartyCardThemes]);

  const headerCardColor = activeMemberTheme?.palette.card || c.card;
  const headerBorderColor = activeMemberTheme?.palette.border || c.border;
  const headerForegroundColor = activeMemberTheme?.palette.foreground || c.foreground;
  const headerMutedColor = activeMemberTheme?.palette.mutedForeground || c.mutedForeground;
  const headerPrimaryColor = activeMemberTheme?.palette.primary || c.primary;

  const [refreshing, setRefreshing] = useState(false);
  const [actingAssignmentId, setActingAssignmentId] = useState<string | null>(null);
  const [claimingLootAssignmentId, setClaimingLootAssignmentId] = useState<string | null>(null);
  const [rollingRequestId, setRollingRequestId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"overview" | "events">(
    params.section === "events" ? "events" : "overview"
  );
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [eventActorFilter, setEventActorFilter] = useState<string>("all");
  const [eventRelevanceFilter, setEventRelevanceFilter] = useState<PartyEventRelevanceFilter>("all");
  const [showImportantOnly, setShowImportantOnly] = useState(false);
  const [sendingItem, setSendingItem] = useState(false);
  const [isSendItemOpen, setIsSendItemOpen] = useState(false);
  const [sendItemId, setSendItemId] = useState<string | null>(null);
  const [sendTargetMemberId, setSendTargetMemberId] = useState<string | null>(null);
  const [sendQuantityInput, setSendQuantityInput] = useState("1");
  const eventLogPreviewRef = useRef<ScrollView | null>(null);

  React.useEffect(() => {
    setActiveSection(params.section === "events" ? "events" : "overview");
  }, [params.section]);

  const eventHistoryView = useMemo(() => {
    return buildPartyEventHistoryView({
      events: combatState?.eventLog ?? [],
      members,
      npcs: combatState?.combatNpcs ?? [],
      filters: {
        type: eventTypeFilter,
        actor: eventActorFilter,
        relevance: eventRelevanceFilter,
        importantOnly: showImportantOnly,
      },
    });
  }, [combatState?.combatNpcs, combatState?.eventLog, eventActorFilter, eventRelevanceFilter, eventTypeFilter, members, showImportantOnly]);

  const applyEventFocusPreset = (preset: "all" | "combat" | "important") => {
    if (preset === "all") {
      setEventRelevanceFilter("all");
      setShowImportantOnly(false);
      setEventTypeFilter("all");
      setEventActorFilter("all");
    } else if (preset === "combat") {
      setEventRelevanceFilter("combat");
      setShowImportantOnly(false);
    } else {
      setShowImportantOnly(true);
    }

    requestAnimationFrame(() => {
      eventLogPreviewRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  React.useEffect(() => {
    if (!eventHistoryView.typeOptions.some((option) => option.value === eventTypeFilter)) {
      setEventTypeFilter("all");
    }
    if (!eventHistoryView.actorOptions.some((option) => option.value === eventActorFilter)) {
      setEventActorFilter("all");
    }
  }, [eventActorFilter, eventHistoryView.actorOptions, eventHistoryView.typeOptions, eventTypeFilter]);

  const handleOpenMemberSheet = (targetMemberId: string) => {
    router.push(buildPartyMemberSheetPath(targetMemberId, "party") as any);
  };

  const transferableItems = useMemo(
    () => getTransferableInventoryItems(inventory),
    [inventory],
  );

  const recipientMembers = useMemo(
    () => members.filter((m) => m.id !== memberId),
    [memberId, members],
  );

  React.useEffect(() => {
    if (!sendItemId || !transferableItems.some((item) => item.id === sendItemId)) {
      setSendItemId(transferableItems[0]?.id ?? null);
      setSendQuantityInput("1");
    }
  }, [sendItemId, transferableItems]);

  React.useEffect(() => {
    if (!sendTargetMemberId || !recipientMembers.some((member) => member.id === sendTargetMemberId)) {
      setSendTargetMemberId(recipientMembers[0]?.id ?? null);
    }
  }, [recipientMembers, sendTargetMemberId]);

  React.useEffect(() => {
    if (activeSection !== "events" || eventHistoryView.items.length === 0) return;
    const frame = requestAnimationFrame(() => {
      eventLogPreviewRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeSection, eventHistoryView.items.length]);

  const pendingRollRequests = useMemo((): PartyRollRequest[] => {
    if (!memberId) return [];
    return (combatState?.rollRequests ?? []).filter(
      (req) =>
        req.targetMemberIds.includes(memberId) &&
        !req.responses.some((r) => r.memberId === memberId)
    );
  }, [combatState?.rollRequests, memberId]);

  const getModifierForStatKey = (statKey: string): number => {
    if (statKey === "initiative") return eff.initiative;
    if (["strength","dexterity","constitution","intelligence","wisdom","charisma"].includes(statKey)) {
      return eff.abilityScores[statKey as keyof typeof eff.abilityScores];
    }
    if (statKey.endsWith("_save")) {
      const ability = statKey.replace("_save", "") as keyof typeof eff.abilityScores;
      const save = character.savingThrows.find((s) => s.ability === ability);
      return save ? save.modifier : eff.abilityScores[ability] ?? 0;
    }
    // skill
    const skillName = statKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const skill = character.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
    return skill ? skill.modifier : 0;
  };

  const handleRollResponse = async (request: PartyRollRequest) => {
    if (!partyCode || !memberId) return;
    setRollingRequestId(request.id);
    try {
      const d20 = Math.floor(Math.random() * 20) + 1;
      const isSkillCheck = ![
        "initiative",
        "strength",
        "dexterity",
        "constitution",
        "intelligence",
        "wisdom",
        "charisma",
      ].includes(request.statKey) && !request.statKey.endsWith("_save");
      if (isSkillCheck && settings.effects.enabled && settings.effects.critFailBurst) {
        if (d20 === 20) triggerEffect("nat_20");
        if (d20 === 1) triggerEffect("nat_1");
      }
      const modifier = getModifierForStatKey(request.statKey);
      const total = Math.max(1, d20 + modifier);
      await submitPartyRollResponse(partyCode, request.id, {
        memberId,
        roll: d20,
        modifier,
        total,
      });
      await refreshMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit roll.";
      Alert.alert("Roll failed", message);
    } finally {
      setRollingRequestId(null);
    }
  };

  const pendingNoteAssignments = useMemo(() => {
    if (!memberId) return [] as NotesAssignment[];
    const rows = combatState?.noteAssignments ?? [];
    return rows
      .filter((assignment) => assignment.targetMemberId === memberId && !assignment.acceptedAt && !assignment.declinedAt)
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
  }, [combatState?.noteAssignments, memberId]);

  const pendingLootAssignments = useMemo(() => {
    if (!memberId) return [] as LootAssignment[];
    const rows = combatState?.lootAssignments ?? [];
    return rows
      .filter((assignment) => assignment.targetMemberId === memberId && !assignment.claimedAt)
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
  }, [combatState?.lootAssignments, memberId]);

  const applyAssignedNotesPayload = (payload: NotesAssignmentPayload) => {
    const merged = mergeAssignedNotesPayload({
      payload,
      existingQuests: quests,
      existingPeople: people,
      existingLocations: locations,
    });

    merged.notes.forEach((note) => addNote(note));

    merged.quests.forEach((op) => {
      if (op.id) {
        updateQuest(op.id, op.data);
      } else {
        addQuest(op.data);
      }
    });

    merged.people.forEach((op) => {
      if (op.id) {
        updatePerson(op.id, op.data);
      } else {
        addPerson(op.data);
      }
    });

    merged.locations.forEach((op) => {
      if (op.id) {
        updateLocation(op.id, op.data);
      } else {
        addLocation(op.data);
      }
    });

    return merged.warnings;
  };

  const handleAcceptNotesAssignment = async (assignment: NotesAssignment) => {
    if (!partyCode || !memberId) return;
    setActingAssignmentId(assignment.id);
    try {
      const result = await acceptPartyNoteAssignment(partyCode, assignment.id, { memberId });
      const warnings = applyAssignedNotesPayload(result.assignment.payload);
      await refreshMembers();
      if (warnings.length === 0) {
        Alert.alert("Journal updated", "DM notes were added to your Quests and Notes journal.");
      } else {
        const preview = warnings.slice(0, 2).map((warning) => warning.message).join("\n");
        const remaining = warnings.length - 2;
        Alert.alert(
          "Journal updated with deferred graph changes",
          `${preview}${remaining > 0 ? `\n+${remaining} additional graph update(s) deferred.` : ""}`,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to accept notes.";
      Alert.alert("Could not accept", message);
    } finally {
      setActingAssignmentId(null);
    }
  };

  const handleDeclineNotesAssignment = async (assignment: NotesAssignment) => {
    if (!partyCode || !memberId) return;
    setActingAssignmentId(assignment.id);
    try {
      await declinePartyNoteAssignment(partyCode, assignment.id, { memberId });
      await refreshMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to decline notes.";
      Alert.alert("Could not decline", message);
    } finally {
      setActingAssignmentId(null);
    }
  };

  const handleClaimLootAssignment = async (assignment: LootAssignment) => {
    if (!partyCode || !memberId) return;
    setClaimingLootAssignmentId(assignment.id);
    try {
      await claimPartyLootAssignment(partyCode, assignment.id, { memberId });
      const toInventoryCategory = (category: LootAssignment["item"]["category"]): ItemCategory => {
        if (category === "currency") return "treasure";
        if (category === "component" || category === "junk") return "gear";
        return category as ItemCategory;
      };

      const quantity = Number.isFinite(assignment.item.quantity)
        ? Math.max(1, Math.floor(assignment.item.quantity))
        : 1;
      const inventoryCategory = toInventoryCategory(assignment.item.category);
      const itemSnapshot = assignment.item.inventoryItem;

      if (itemSnapshot && typeof itemSnapshot === "object" && !Array.isArray(itemSnapshot)) {
        const snapshotCandidate = itemSnapshot as Partial<InventoryItem> & { id?: string };
        const { id: _ignoredId, ...snapshotWithoutId } = snapshotCandidate;
        const snapshotCategory = typeof snapshotCandidate.category === "string"
          ? (snapshotCandidate.category as ItemCategory)
          : inventoryCategory;
        addItem({
          ...(snapshotWithoutId as Omit<InventoryItem, "id">),
          name: typeof snapshotCandidate.name === "string" ? snapshotCandidate.name : assignment.item.name,
          quantity,
          equipped: false,
          category: snapshotCategory,
        });
      } else if (inventoryCategory === "map") {
        const rawNotes = assignment.item.notes ?? "";
        const legacyMapImageMatch = rawNotes.match(/^Map Image:\s*(.+)$/im);
        const legacyMapImageUri = legacyMapImageMatch?.[1]?.trim();
        const directMapImageUri = assignment.item.imageUri?.trim();
        const portableDirectMapImageUri = directMapImageUri && isPortableMapImageUri(directMapImageUri)
          ? directMapImageUri
          : undefined;
        const portableLegacyMapImageUri = legacyMapImageUri && isPortableMapImageUri(legacyMapImageUri)
          ? legacyMapImageUri
          : undefined;
        const resolvedMapImageUri = portableDirectMapImageUri || portableLegacyMapImageUri;
        const cleanedNotes = rawNotes
          .replace(/^Map Image:\s*.+$/gim, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        addItem({
          name: assignment.item.name,
          quantity,
          equipped: false,
          category: "map",
          value: assignment.item.value,
          notes: cleanedNotes || undefined,
          imageUri: resolvedMapImageUri,
          imageSource: resolvedMapImageUri ? "dm" : undefined,
          sourceTag: "custom",
        });
      } else {
        const claimedItem: ProposedInventoryItem = {
          id: assignment.id,
          name: assignment.item.name,
          quantity,
          category: inventoryCategory,
          value: assignment.item.value,
          notes: assignment.item.notes,
          confidence: "high",
          needsReview: false,
        };
        applyProposedItems([claimedItem]);
      }
      await refreshMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to claim loot.";
      Alert.alert("Could not claim loot", message);
    } finally {
      setClaimingLootAssignmentId(null);
    }
  };

  const handleSendItemToMember = async () => {
    if (!partyCode || !memberId) return;

    const selectedItem = transferableItems.find((item) => item.id === sendItemId);
    if (!selectedItem) {
      Alert.alert("Choose an item", "Select an inventory item to send.");
      return;
    }
    if (!sendTargetMemberId) {
      Alert.alert("Choose a recipient", "Select a party member to receive the item.");
      return;
    }

    const requestedQuantity = Number.parseInt(sendQuantityInput, 10);
    const quantity = Number.isFinite(requestedQuantity)
      ? Math.max(1, Math.floor(requestedQuantity))
      : 1;

    if (quantity > selectedItem.quantity) {
      Alert.alert("Quantity too high", "You do not have that many items to send.");
      return;
    }

    setSendingItem(true);
    try {
      await createPartyLootAssignments(partyCode, {
        targetMemberIds: [sendTargetMemberId],
        items: [buildLootAssignmentItemFromInventory(selectedItem, quantity)],
        assignedBy: memberId,
      });

      const remaining = getRemainingQuantityAfterTransfer(selectedItem.quantity, quantity);
      if (remaining === 0) {
        removeItem(selectedItem.id);
      } else {
        updateItem(selectedItem.id, { quantity: remaining });
      }

      setSendQuantityInput("1");
      await refreshMembers();
      Alert.alert("Item sent", `${quantity}x ${selectedItem.name} sent successfully.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send item.";
      Alert.alert("Could not send item", message);
    } finally {
      setSendingItem(false);
    }
  };

  const handleCreate = async () => {
    await createAndJoinParty();
  };

  const handleJoin = async (code: string) => {
    await joinExistingParty(code);
  };

  const handleLeave = () => {
    if (Platform.OS === "web") {
      const shouldLeave = typeof window !== "undefined"
        ? window.confirm("Are you sure you want to leave the current party?")
        : true;
      if (shouldLeave) {
        void leaveCurrentParty();
      }
      return;
    }

    Alert.alert(
      "Leave Party",
      "Are you sure you want to leave the current party?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: leaveCurrentParty },
      ]
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshMembers();
    setRefreshing(false);
  };

  const handleEndAdventureSession = () => {
    Alert.alert("End Adventure Session", "Clear active adventure session awareness on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Session",
        style: "destructive",
        onPress: () => {
          void clearActiveSession();
        },
      },
    ]);
  };

  if (isInParty) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["bottom"]}>
        <PartyScreenHeader
          cardColor={headerCardColor}
          borderColor={headerBorderColor}
          foregroundColor={headerForegroundColor}
        />
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={c.primary}
            />
          }
        >
          <AiDmSessionAwarenessPlaceholderStrip
            placeholder={awarenessPlaceholder}
            onEndSession={handleEndAdventureSession}
          />
          <View style={[styles.partyHeader, { backgroundColor: headerCardColor, borderColor: headerBorderColor }]}>
            <View>
              <Text style={{ fontSize: 12, color: headerMutedColor, fontWeight: "600", letterSpacing: 1 }}>PARTY CODE</Text>
              <Text style={{ fontSize: 28, fontWeight: "900", color: headerPrimaryColor, letterSpacing: 2 }}>{partyCode}</Text>
              <Text style={{ fontSize: 12, color: headerMutedColor }}>{members.length} member{members.length !== 1 ? "s" : ""} • auto-refreshes every 30s</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 8 }}>
              <TouchableOpacity
                onPress={() => updateSettings({ disablePartyCardThemes: !settings.disablePartyCardThemes })}
                style={[styles.leaveBtn, { borderColor: settings.disablePartyCardThemes ? c.primary : headerBorderColor, backgroundColor: settings.disablePartyCardThemes ? c.primary + "22" : "transparent" }]}
              >
                <Feather name="droplet" size={14} color={settings.disablePartyCardThemes ? c.primary : headerMutedColor} />
                <Text style={{ fontSize: 13, color: settings.disablePartyCardThemes ? c.primary : headerMutedColor, fontWeight: "700" }}>
                  Disable Themes: {settings.disablePartyCardThemes ? "ON" : "OFF"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLeave} style={[styles.leaveBtn, { borderColor: "#f87171" + "55" }]}>
                <Feather name="log-out" size={14} color="#f87171" />
                <Text style={{ fontSize: 13, color: "#f87171", fontWeight: "700" }}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.segmentedControl, { backgroundColor: c.card, borderColor: c.border }]}> 
            <TouchableOpacity
              onPress={() => setActiveSection("overview")}
              style={[
                styles.segmentBtn,
                {
                  backgroundColor: activeSection === "overview" ? c.primary + "22" : "transparent",
                  borderColor: activeSection === "overview" ? c.primary + "66" : "transparent",
                },
              ]}
            >
              <Feather name="users" size={14} color={activeSection === "overview" ? c.primary : c.mutedForeground} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: activeSection === "overview" ? c.primary : c.mutedForeground }}>
                Party
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveSection("events")}
              style={[
                styles.segmentBtn,
                {
                  backgroundColor: activeSection === "events" ? c.primary + "22" : "transparent",
                  borderColor: activeSection === "events" ? c.primary + "66" : "transparent",
                },
              ]}
            >
              <Feather name="clock" size={14} color={activeSection === "events" ? c.primary : c.mutedForeground} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: activeSection === "events" ? c.primary : c.mutedForeground }}>
                Events
              </Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.errorBox, { borderColor: "#f87171" + "55", backgroundColor: "#f87171" + "11" }]}>
              <Feather name="alert-circle" size={14} color="#f87171" />
              <Text style={{ fontSize: 13, color: "#f87171", flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          {activeSection === "overview" && pendingRollRequests.length > 0 && (
            <View style={[styles.section, { backgroundColor: c.card, borderColor: "#f59e0b55" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Feather name="target" size={16} color="#f59e0b" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>DM Roll Request</Text>
              </View>
              {pendingRollRequests.map((request) => {
                const modifier = getModifierForStatKey(request.statKey);
                const isRolling = rollingRequestId === request.id;
                return (
                  <View key={request.id} style={[styles.card, { backgroundColor: c.background, borderColor: "#f59e0b44", marginBottom: 8 }]}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: c.foreground }}>{request.label}</Text>
                    <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                      Your modifier: {modifier >= 0 ? `+${modifier}` : `${modifier}`}
                    </Text>
                    <TouchableOpacity
                      disabled={isRolling}
                      onPress={() => void handleRollResponse(request)}
                      style={[styles.btn, { marginTop: 10, backgroundColor: "#f59e0b", opacity: isRolling ? 0.6 : 1, justifyContent: "center" }]}
                    >
                      <Feather name="zap" size={14} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                        {isRolling ? "Rolling…" : `Roll d20 + ${modifier >= 0 ? modifier : `(${modifier})`}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {activeSection === "overview" && pendingNoteAssignments.length > 0 && (
            <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>DM Notes & Quests</Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/notes")}
                  style={[styles.leaveBtn, { borderColor: c.primary + "55", paddingHorizontal: 10, paddingVertical: 6 }]}
                >
                  <Feather name="book-open" size={13} color={c.primary} />
                  <Text style={{ fontSize: 12, color: c.primary, fontWeight: "700" }}>Open Notes</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: c.mutedForeground, marginBottom: 10 }}>
                You have {pendingNoteAssignments.length} pending assignment{pendingNoteAssignments.length === 1 ? "" : "s"}.
              </Text>

              {pendingNoteAssignments.map((assignment) => {
                const questNames = assignment.payload.quests.map((q) => q.name).slice(0, 3);
                const isActing = actingAssignmentId === assignment.id;
                return (
                  <View key={assignment.id} style={[styles.card, { backgroundColor: c.background, borderColor: c.border, marginBottom: 8 }]}> 
                    <Text style={{ fontSize: 12, color: c.mutedForeground, marginBottom: 4 }}>
                      Sent {new Date(assignment.assignedAt).toLocaleString()}
                    </Text>
                    <Text style={{ fontSize: 13, color: c.foreground, fontWeight: "700" }}>
                      {assignment.payload.notes?.length ?? 0} notes, {assignment.payload.quests.length} quest{assignment.payload.quests.length === 1 ? "" : "s"}, {assignment.payload.people.length} people, {assignment.payload.locations.length} locations
                    </Text>
                    {(assignment.payload.notes ?? []).map((note) => (
                      <Text key={note.id} style={{ color: c.mutedForeground, fontSize: 11 }}>{note.title}</Text>
                    ))}
                    {assignment.payload.quests.map((quest) => (
                      <Text key={quest.id} style={{ color: c.mutedForeground, fontSize: 11 }}>
                        {quest.name}: {quest.status.toUpperCase()}
                      </Text>
                    ))}
                    {questNames.length > 0 && (
                      <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 4 }}>
                        Quests: {questNames.join(", ")}{assignment.payload.quests.length > questNames.length ? "..." : ""}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <TouchableOpacity
                        disabled={isActing}
                        onPress={() => void handleAcceptNotesAssignment(assignment)}
                        style={[styles.btn, { flex: 1, backgroundColor: c.primary, opacity: isActing ? 0.6 : 1 }]}
                      >
                        <Feather name="check" size={14} color="#fff" />
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={isActing}
                        onPress={() => void handleDeclineNotesAssignment(assignment)}
                        style={[styles.btn, { flex: 1, backgroundColor: "#ef444422", borderWidth: 1, borderColor: "#ef444455", opacity: isActing ? 0.6 : 1 }]}
                      >
                        <Feather name="x" size={14} color="#ef4444" />
                        <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 13 }}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {activeSection === "overview" && pendingLootAssignments.length > 0 && (
            <View style={[styles.section, { backgroundColor: c.card, borderColor: "#22c55e55" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Feather name="gift" size={16} color="#22c55e" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>Pending Loot</Text>
              </View>
              <Text style={{ fontSize: 12, color: c.mutedForeground, marginBottom: 10 }}>
                You have {pendingLootAssignments.length} pending loot assignment{pendingLootAssignments.length === 1 ? "" : "s"}.
              </Text>

              {pendingLootAssignments.map((assignment) => {
                const isClaiming = claimingLootAssignmentId === assignment.id;
                return (
                  <View key={assignment.id} style={[styles.card, { backgroundColor: c.background, borderColor: "#22c55e44", marginBottom: 8 }]}> 
                    <Text style={{ fontSize: 12, color: c.mutedForeground, marginBottom: 4 }}>
                      Sent {new Date(assignment.assignedAt).toLocaleString()}
                    </Text>
                    <Text style={{ fontSize: 13, color: c.foreground, fontWeight: "700" }}>
                      {assignment.item.quantity}x {assignment.item.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 2, textTransform: "capitalize" }}>
                      Category: {assignment.item.category}
                    </Text>
                    {assignment.item.notes ? (
                      <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 4 }}>
                        {assignment.item.notes}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      disabled={isClaiming}
                      onPress={() => void handleClaimLootAssignment(assignment)}
                      style={[styles.btn, { marginTop: 10, backgroundColor: "#22c55e", opacity: isClaiming ? 0.6 : 1, justifyContent: "center" }]}
                    >
                      <Feather name="check" size={14} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                        {isClaiming ? "Claiming…" : "Claim Loot"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {activeSection === "overview" && (
            <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}> 
              <TouchableOpacity
                onPress={() => setIsSendItemOpen((prev) => !prev)}
                activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: isSendItemOpen ? 8 : 0 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="send" size={16} color={c.primary} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>Send Item</Text>
                </View>
                <Feather name={isSendItemOpen ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />
              </TouchableOpacity>
              {!isSendItemOpen ? (
                <Text style={{ fontSize: 12, color: c.mutedForeground }}>
                  Minimized by default. Tap to choose an item, recipient, and quantity.
                </Text>
              ) : recipientMembers.length === 0 ? (
                <Text style={{ fontSize: 12, color: c.mutedForeground }}>
                  Another party member must be online before you can send items.
                </Text>
              ) : transferableItems.length === 0 ? (
                <Text style={{ fontSize: 12, color: c.mutedForeground }}>
                  No transferable inventory items found. Equipped or empty stacks cannot be sent.
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>ITEM</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {transferableItems.map((item) => {
                      const selected = item.id === sendItemId;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => {
                            setSendItemId(item.id);
                            setSendQuantityInput("1");
                          }}
                          style={[
                            styles.filterChip,
                            {
                              borderColor: selected ? c.primary + "66" : c.border,
                              backgroundColor: selected ? c.primary + "1A" : c.background,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: selected ? c.primary : c.mutedForeground }}>
                            {item.name} x{item.quantity}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>RECIPIENT</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {recipientMembers.map((member) => {
                      const selected = member.id === sendTargetMemberId;
                      return (
                        <TouchableOpacity
                          key={member.id}
                          onPress={() => setSendTargetMemberId(member.id)}
                          style={[
                            styles.filterChip,
                            {
                              borderColor: selected ? c.primary + "66" : c.border,
                              backgroundColor: selected ? c.primary + "1A" : c.background,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: selected ? c.primary : c.mutedForeground }}>
                            {member.characterName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", minWidth: 58 }}>QTY</Text>
                    <TextInput
                      value={sendQuantityInput}
                      onChangeText={setSendQuantityInput}
                      keyboardType="numeric"
                      style={{
                        width: 90,
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        color: c.foreground,
                        backgroundColor: c.background,
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    />
                    <TouchableOpacity
                      disabled={sendingItem}
                      onPress={() => void handleSendItemToMember()}
                      style={[styles.btn, { marginLeft: "auto", backgroundColor: c.primary, opacity: sendingItem ? 0.6 : 1 }]}
                    >
                      <Feather name="send" size={14} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                        {sendingItem ? "Sending..." : "Send"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {activeSection === "events" && (
            <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}> 
              <View style={styles.eventHeaderRow}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>Party Event Log</Text>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>
                    {eventHistoryView.hasActiveFilters
                      ? `${eventHistoryView.items.length} of ${eventHistoryView.totalUnfilteredCount} event${eventHistoryView.totalUnfilteredCount === 1 ? "" : "s"} shown`
                      : `${eventHistoryView.items.length} event${eventHistoryView.items.length === 1 ? "" : "s"} shown`}
                  </Text>
                </View>
                <View style={styles.eventQuickActions}>
                  <TouchableOpacity
                    onPress={() => applyEventFocusPreset("all")}
                    style={[styles.eventQuickBtn, { borderColor: eventHistoryView.hasActiveFilters ? c.primary + "55" : c.border, backgroundColor: eventHistoryView.hasActiveFilters ? c.primary + "14" : c.background }]}
                  >
                    <Text style={{ color: eventHistoryView.hasActiveFilters ? c.primary : c.mutedForeground, fontSize: 11, fontWeight: "700" }}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => applyEventFocusPreset("combat")}
                    style={[styles.eventQuickBtn, { borderColor: c.primary + "55", backgroundColor: c.primary + "14" }]}
                  >
                    <Text style={{ color: c.primary, fontSize: 11, fontWeight: "700" }}>Combat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => applyEventFocusPreset("important")}
                    style={[styles.eventQuickBtn, { borderColor: "#f59e0b55", backgroundColor: "#f59e0b14" }]}
                  >
                    <Text style={{ color: "#f59e0b", fontSize: 11, fontWeight: "700" }}>Important</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {eventHistoryView.recentImportant.length > 0 && !showImportantOnly && (
                <View style={[styles.highlightStrip, { borderColor: "#f59e0b55", backgroundColor: "#f59e0b14" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 11, color: "#f59e0b", fontWeight: "800" }}>Recent Highlights</Text>
                    <Text style={{ fontSize: 10, color: c.mutedForeground }}>
                      {eventHistoryView.recentImportant.length} recent
                    </Text>
                  </View>
                  {eventHistoryView.recentImportant.slice(0, 3).map((item) => (
                    <Text key={`highlight-${item.id}`} style={{ fontSize: 11, color: c.foreground, lineHeight: 16 }} numberOfLines={2}>
                      [{item.timestampLabel}] {item.actorLabel}: {item.message}
                    </Text>
                  ))}
                </View>
              )}

              <View style={{ gap: 8, marginBottom: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.5, marginBottom: -2 }}>RELEVANCE</Text>
                <View style={styles.filterRow}>
                  <TouchableOpacity
                    onPress={() => setEventRelevanceFilter("all")}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: eventRelevanceFilter === "all" ? c.primary + "66" : c.border,
                        backgroundColor: eventRelevanceFilter === "all" ? c.primary + "1A" : c.background,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: eventRelevanceFilter === "all" ? c.primary : c.mutedForeground }}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEventRelevanceFilter("combat")}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: eventRelevanceFilter === "combat" ? c.primary + "66" : c.border,
                        backgroundColor: eventRelevanceFilter === "combat" ? c.primary + "1A" : c.background,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: eventRelevanceFilter === "combat" ? c.primary : c.mutedForeground }}>Combat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEventRelevanceFilter("general")}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: eventRelevanceFilter === "general" ? c.primary + "66" : c.border,
                        backgroundColor: eventRelevanceFilter === "general" ? c.primary + "1A" : c.background,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: eventRelevanceFilter === "general" ? c.primary : c.mutedForeground }}>General</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowImportantOnly((prev) => !prev)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: showImportantOnly ? "#f59e0b55" : c.border,
                        backgroundColor: showImportantOnly ? "#f59e0b14" : c.background,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: showImportantOnly ? "#f59e0b" : c.mutedForeground }}>
                      Important
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 10, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.5, marginBottom: -2 }}>TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {eventHistoryView.typeOptions.map((option) => {
                    const isActive = eventTypeFilter === option.value;
                    return (
                      <TouchableOpacity
                        key={`type-${option.value}`}
                        onPress={() => setEventTypeFilter(option.value)}
                        style={[
                          styles.filterChip,
                          {
                            borderColor: isActive ? c.primary + "66" : c.border,
                            backgroundColor: isActive ? c.primary + "1A" : c.background,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: isActive ? c.primary : c.mutedForeground }}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={{ fontSize: 10, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.5, marginBottom: -2 }}>SOURCE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {eventHistoryView.actorOptions.map((option) => {
                    const isActive = eventActorFilter === option.value;
                    return (
                      <TouchableOpacity
                        key={`actor-${option.value}`}
                        onPress={() => setEventActorFilter(option.value)}
                        style={[
                          styles.filterChip,
                          {
                            borderColor: isActive ? c.primary + "66" : c.border,
                            backgroundColor: isActive ? c.primary + "1A" : c.background,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: isActive ? c.primary : c.mutedForeground }}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={[styles.eventPreviewFrame, { borderColor: c.border, backgroundColor: c.background }]}> 
                <ScrollView
                  ref={eventLogPreviewRef}
                  showsVerticalScrollIndicator={eventHistoryView.items.length > 5}
                  onContentSizeChange={() => eventLogPreviewRef.current?.scrollTo({ y: 0, animated: true })}
                  contentContainerStyle={{ padding: 10, gap: 6 }}
                >
                  {eventHistoryView.items.length === 0 ? (
                    <View style={{ padding: 12, gap: 8, alignItems: "flex-start" }}>
                      {eventHistoryView.totalUnfilteredCount === 0 ? (
                        <Text style={{ fontSize: 13, color: c.mutedForeground }}>
                          No party events recorded yet. Events appear here during live sessions.
                        </Text>
                      ) : (
                        <>
                          <Text style={{ fontSize: 13, color: c.mutedForeground }}>
                            {eventHistoryView.totalUnfilteredCount} event{eventHistoryView.totalUnfilteredCount === 1 ? "" : "s"} exist but are hidden by current filters.
                          </Text>
                          <TouchableOpacity
                            onPress={() => applyEventFocusPreset("all")}
                            style={[styles.eventQuickBtn, { borderColor: c.primary + "55", backgroundColor: c.primary + "14" }]}
                          >
                            <Text style={{ color: c.primary, fontSize: 11, fontWeight: "700" }}>Clear Filters</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ) : (
                    eventHistoryView.sections.map((section) => (
                      <View key={`section-${section.key}`} style={{ gap: 6 }}>
                        <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "800", letterSpacing: 0.6 }}>
                          {section.label}
                        </Text>
                        {section.items.map((item) => (
                          <View
                            key={item.id}
                            style={[
                              styles.eventRow,
                              {
                                borderColor: item.isImportant ? "#f59e0b55" : c.border,
                                backgroundColor: item.isImportant ? "#f59e0b10" : c.card,
                              },
                            ]}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>
                                {item.timestampLabel}
                              </Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <View
                                  style={[
                                    styles.eventBadge,
                                    {
                                      borderColor: item.isCombatRelevant ? c.primary + "55" : c.border,
                                      backgroundColor: item.isCombatRelevant ? c.primary + "14" : c.background,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: "700",
                                      color: item.isCombatRelevant ? c.primary : c.mutedForeground,
                                    }}
                                  >
                                    {item.typeLabel}
                                  </Text>
                                </View>
                                {item.isImportant && (
                                  <View style={[styles.eventBadge, { borderColor: "#f59e0b55", backgroundColor: "#f59e0b14" }]}>
                                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#f59e0b" }}>Key</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700", marginTop: 3 }}>
                              {item.actorLabel}
                            </Text>
                            <Text style={{ fontSize: 12, color: c.mutedForeground, lineHeight: 17, marginTop: 2 }}>
                              {item.message}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>

              <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 8 }}>
                Filtered live session history from the existing party event stream.
              </Text>
            </View>
          )}

          {activeSection === "overview" && (members.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
              <Feather name="users" size={32} color={c.mutedForeground} />
              <Text style={{ color: c.mutedForeground, fontSize: 14, textAlign: "center" }}>
                No party members yet.{"\n"}Share your code so others can join!
              </Text>
            </View>
          ) : (
            members.map((m) => {
              const entry = (combatState?.initiative ?? []).find((e) => e.memberId === m.id);
              return (
                <MemberCard
                  key={m.id}
                  member={m}
                  initiativeTotal={entry?.initiativeTotal}
                  onPressName={() => handleOpenMemberSheet(m.id)}
                />
              );
            })
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["bottom"]}>
      <PartyScreenHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 24 }}>
        <AiDmSessionAwarenessPlaceholderStrip
          placeholder={awarenessPlaceholder}
          onEndSession={handleEndAdventureSession}
        />
        <View style={{ alignItems: "center", paddingTop: 6, gap: 8 }}>
          <View style={[styles.iconCircle, { backgroundColor: c.primary + "22" }]}>
            <Feather name="users" size={32} color={c.primary} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: c.foreground }}>Party View</Text>
          <Text style={{ fontSize: 14, color: c.mutedForeground, textAlign: "center", lineHeight: 20 }}>
            Share your character stats with your party and see everyone's HP, AC, and conditions in one place.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground, marginBottom: 4 }}>Create a Party</Text>
          <Text style={{ fontSize: 13, color: c.mutedForeground, marginBottom: 12 }}>
            Start a new session and get a join code to share with your group.
          </Text>
          {isLoading ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <TouchableOpacity onPress={handleCreate} style={[styles.btn, { backgroundColor: c.primary }]}>
              <Feather name="plus-circle" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Create Party</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground, marginBottom: 4 }}>Join a Party</Text>
          <Text style={{ fontSize: 13, color: c.mutedForeground, marginBottom: 12 }}>
            Enter the code shared by another player to join their session.
          </Text>
          {isLoading ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <JoinCodeInput onSubmit={handleJoin} />
          )}
        </View>

        {error ? (
          <View style={[styles.errorBox, { borderColor: "#f87171" + "55", backgroundColor: "#f87171" + "11" }]}>
            <Feather name="alert-circle" size={14} color="#f87171" />
            <Text style={{ fontSize: 13, color: "#f87171", flex: 1 }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  acBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 50,
  },
  conditionBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  partyHeader: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  leaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  errorBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  segmentedControl: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    flexDirection: "row",
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "System",
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  eventPreviewFrame: {
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 320,
    minHeight: 220,
  },
  eventHeaderRow: {
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  eventQuickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 6,
  },
  eventQuickBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  highlightStrip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 5,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 4,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eventRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  eventBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
