import { claimRollContinuation, rollContinuationReceiptKey } from "@/utils/adventure/aiDmRollContinuationReceipt";
import { shouldBlockStoryInputForPendingRolls } from "@/utils/adventure/oneOffPendingRollGate";
import { shouldAutoCreateOneOffParty } from "@/utils/adventure/oneOffPartyRecovery";
import { createRollSubmissionGate } from "@/utils/adventure/aiDmRollSubmissionGate";
import { shouldResumeNarrationAfterRoll } from "@/utils/adventure/aiDmRollContinuation";
import React, { useMemo, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";

function safeSetupString(str: string | undefined, fallback = "", max = 600): string {
  return (str ?? fallback).trim().slice(0, max);
}
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AdventureHeaderBackButton } from "@/components/adventure/AdventureHeaderBackButton";
import { AiDmSessionFeedShell } from "@/components/adventure/session/AiDmSessionFeedShell";
import { AiDmSessionInputComposer } from "@/components/adventure/session/AiDmSessionInputComposer";
import { AiDmSessionQuickActionsRow } from "@/components/adventure/session/AiDmSessionQuickActionsRow";
import { AiDmCombatSubmodePanel } from "@/components/adventure/session/AiDmCombatSubmodePanel";
import { AiDmSessionOutcomeShell } from "@/components/adventure/session/AiDmSessionOutcomeShell";
import { PartyMiniList } from "@/components/attacks/PartyMiniList";
import { AiDmCombatTargetPicker } from "@/components/adventure/session/AiDmCombatTargetPicker";
import { AttackCard } from "@/components/attacks/AttackCard";
import { ActionCard } from "@/components/attacks/ActionCard";
import { ResourceRow } from "@/components/resources/ResourceRow";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useParty } from "@/context/PartyContext";
import { useAdventureSessionAwareness } from "@/context/AdventureSessionContext";
import { useEquippedEffects, getResourceExtraMax } from "@/hooks/useEquippedEffects";
import { AI_DM_ROUTES, buildAiDmSessionPath, buildAiDmSessionRouteParams } from "@/utils/aiDmRouteDefs";
import {
  buildAiDmCampaignFeedSeed,
  buildAiDmOneOffFeedSeed,
  buildQuickActionPlayerIntentText,
  createFeedEntryId,
  type AiDmQuickActionKey,
} from "@/utils/adventure/aiDmSessionFeedScaffold";
import { buildOneOffToolCall, executeOneOffToolCall } from "@/utils/adventure/aiDmOneOffToolBridge";
import {
  createInitialOneOffOutcomeState,
  reduceOneOffOutcomeState,
} from "@/utils/adventure/aiDmOneOffOutcomeScaffold";
import { buildOneOffSessionRecap, canApplyOneOffHandoff } from "@/utils/adventure/aiDmOneOffRecapScaffold";
import { upsertArchivedOneOffSession } from "@/utils/adventure/aiDmOneOffSessionArchiveStorage";
import {
  getArchivedCampaignSession,
  upsertArchivedCampaignSession,
} from "@/utils/adventure/aiDmCampaignSessionArchiveStorage";
import {
  fetchCampaignContinuationHydrateSeed,
  resolveCampaignHydrationSource,
} from "@/utils/adventure/aiDmCampaignSessionSync";
import {
  submitCampaignScaffoldDetailed,
  SubmitCampaignScaffoldError,
} from "@/utils/adventure/aiDmCampaignScaffoldApi";
import {
  fetchCampaignContinuationSnapshot,
  submitCampaignContinuationDetailed,
  SubmitCampaignContinuationError,
} from "@/utils/adventure/aiDmCampaignContinuationApi";
import {
  type CampaignRuntimeTurnAdjudicationRequest,
  type CampaignRuntimeTurnResponse,
  CampaignRuntimeTurnError,
  runCampaignRuntimeTurn,
} from "@/utils/adventure/aiDmCampaignRuntimeApi";
import {
  requestLiveResponse,
  type LiveResponseProgressUpdate,
} from "@/utils/adventure/aiDmLiveResponseApi";
import { buildCampaignChoiceOptions } from "@/utils/adventure/aiDmCampaignChoicePresentation";
import {
  addCombatNpc,
  createPartyRollRequest,
  fetchPartyMembers,
  rollNpcInitiative,
  startPartyInitiative,
  submitPartyRollResponse,
  type CombatNpcCoreStats,
  type CombatNpcDummyState,
  type CombatNpcStatKey,
  type PartyCombatState,
  type PartyRollRequest,
} from "@/utils/partyApi";
import { collectActionableItemEffects } from "@/utils/combat/actionableItemEffects";
import { getCompendium } from "@/utils/monsterApi";
import type { CompendiumMonster } from "@/types";
import {
  buildEncounterGateVisibilityState,
  canAcknowledgeMissingTargetOverride,
  getEncounterRollCompletionState,
  getRequiredEncounterRolls,
  orchestrateCampaignEncounterIntent,
  recoverEncounterGateBattleContext,
  type EncounterGateOverrideMode,
  type EncounterGateOverrideReasonCode,
  type EncounterRollStatKey,
  type EncounterGateVisibilityState,
  type TargetPolicyMode,
} from "@/utils/adventure/campaignEncounterRuntime";
import { ATTACK_COLOR, BONUS_ACTION_COLOR } from "@/constants/semanticColors";

function buildInventorySummary(inventory: Array<{ name: string; quantity: number; category: string; notes?: string }>): string {
  const consumables = inventory.filter((i) => i.quantity > 0 && (i.category === "consumable" || i.category === "potion" || i.notes?.toLowerCase().includes("consumable")));
  const equipment = inventory.filter((i) => !consumables.includes(i) && i.quantity > 0);
  const parts: string[] = [];
  if (consumables.length > 0) {
    parts.push("Consumables: " + consumables.map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", "));
  }
  if (equipment.length > 0) {
    parts.push("Equipment: " + equipment.slice(0, 15).map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", "));
  }
  return parts.length > 0 ? parts.join(". ") : "No items in inventory.";
}

function buildActiveHostileActorsSummary(
  combatState: PartyCombatState | null | undefined,
  preferredBattleId: string | null | undefined,
): string | null {
  if (!combatState) return null;
  const hostiles = (combatState.combatNpcs ?? [])
    .filter((npc) => npc.disposition === "hostile")
    .filter((npc) => {
      if (!preferredBattleId) return true;
      return combatState.participantBattleById?.[npc.id] === preferredBattleId;
    })
    .slice(0, 8)
    .map((npc) => {
      const battleId = combatState.participantBattleById?.[npc.id] ?? "none";
      const source = npc.sourceType === "monster" && npc.sourceId?.trim()
        ? `${npc.sourceType}:${npc.sourceId.trim()}`
        : npc.sourceType;
      return `${npc.id}=${npc.name} [${source}] @${battleId}`;
    });

  if (hostiles.length === 0) return null;
  return `CURRENT HOSTILE ACTORS: ${hostiles.join(" | ")}. Reuse these identities in narration; do not rename or duplicate active hostiles.`;
}

function buildEncounterActorRegistrySummary(
  registry: Map<string, { npcId: string; name: string; sourceType: "manual" | "monster"; sourceId?: string }>,
): string | null {
  const entries = [...registry.values()]
    .slice(-8)
    .map((entry) => {
      const source = entry.sourceType === "monster" && entry.sourceId?.trim()
        ? `${entry.sourceType}:${entry.sourceId.trim()}`
        : entry.sourceType;
      return `${entry.npcId}=${entry.name} [${source}]`;
    });
  if (entries.length === 0) return null;
  return `KNOWN ENCOUNTER ACTORS: ${entries.join(" | ")}. Preserve actor continuity with these canonical identities.`;
}

function parseNumberish(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function parseSpeedFromMonster(speed: unknown): number {
  if (typeof speed === "number" && Number.isFinite(speed)) return Math.max(0, Math.floor(speed));
  if (typeof speed === "string") {
    const match = speed.match(/(\d+)/);
    if (match) {
      const parsed = Number.parseInt(match[1] ?? "", 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  if (Array.isArray(speed)) {
    for (const value of speed) {
      if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
      if (typeof value === "string") {
        const match = value.match(/(\d+)/);
        if (match) {
          const parsed = Number.parseInt(match[1] ?? "", 10);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    }
  }
  return 30;
}

function buildMonsterCoreStats(monster: CompendiumMonster): CombatNpcCoreStats {
  const dexterity = parseNumberish(monster.dexterity, 10);
  return {
    speed: parseSpeedFromMonster(monster.speed),
    initiativeBonus: abilityModifier(dexterity),
    strength: parseNumberish(monster.strength, 10),
    dexterity,
    constitution: parseNumberish(monster.constitution, 10),
    intelligence: parseNumberish(monster.intelligence, 10),
    wisdom: parseNumberish(monster.wisdom, 10),
    charisma: parseNumberish(monster.charisma, 10),
  };
}

function buildMonsterDummyState(monster: CompendiumMonster): CombatNpcDummyState {
  const maxHp = Math.max(1, parseNumberish(monster.hit_points, 20));
  return {
    maxHp,
    currentHp: maxHp,
    armorClass: Math.max(1, parseNumberish(monster.armor_class, 12)),
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
  };
}

const DEFAULT_VISIBLE_MONSTER_STATS: CombatNpcStatKey[] = [
  "speed",
  "initiativeBonus",
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

async function buildEncounterNpcSeed(encounterIntent: CampaignRuntimeTurnResponse["turn"]["encounterIntent"]): Promise<{
  coreStats: CombatNpcCoreStats;
  dummyState: CombatNpcDummyState;
  visibleStatKeys: CombatNpcStatKey[];
}> {
  if (
    encounterIntent?.hostileCreatureSourceType === "monster"
    && typeof encounterIntent.hostileCreatureSourceId === "string"
    && encounterIntent.hostileCreatureSourceId.trim().length > 0
  ) {
    try {
      const compendium = await getCompendium();
      const monster = compendium.find((entry) => {
        if ("slug" in entry && typeof entry.slug === "string" && entry.slug.trim() === encounterIntent.hostileCreatureSourceId?.trim()) {
          return true;
        }
        if (typeof entry.id === "string" && entry.id.trim() === encounterIntent.hostileCreatureSourceId?.trim()) {
          return true;
        }
        return entry.name.trim().toLowerCase() === encounterIntent.hostileCreatureName.trim().toLowerCase();
      });
      if (monster) {
        return {
          coreStats: buildMonsterCoreStats(monster),
          dummyState: buildMonsterDummyState(monster),
          visibleStatKeys: DEFAULT_VISIBLE_MONSTER_STATS,
        };
      }
    } catch {
      // Fall through to conservative defaults.
    }
  }

  return {
    coreStats: {
      speed: 30,
      initiativeBonus: 1,
      strength: 12,
      dexterity: 12,
      constitution: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    dummyState: {
      maxHp: 20,
      currentHp: 20,
      armorClass: 12,
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      movementUsed: 0,
    },
    visibleStatKeys: ["speed", "initiativeBonus", "strength", "dexterity", "constitution"],
  };
}

const DM_WATCH_KEY = "@dm_party_watch";
const ONE_OFF_SESSION_STATE_PREFIX = "@ai_dm_oneoff_active_session_v1:";

interface PersistedOneOffSessionState {
  entries: ReturnType<typeof buildAiDmOneOffFeedSeed>["entries"];
  outcomeState: ReturnType<typeof createInitialOneOffOutcomeState>;
  isHandoffApproved: boolean;
  pendingChoices: string[];
  prologueDone: boolean;
  encounterGateStatus: string;
  encounterGateVisibility: EncounterGateVisibilityState | null;
  encounterGateConfirmation: {
    clearConfirmed: boolean;
    confirmedAtMs?: number;
    confirmedBy?: "dm_local";
    confirmationSource?: "ui_confirm_action";
    reopenedAfterConfirmation?: boolean;
  };
  encounterGateOverride: {
    overrideMode: EncounterGateOverrideMode;
    overrideStatus?: "active" | "revoked" | "expired";
    overrideReasonCode?: EncounterGateOverrideReasonCode;
    overrideAtMs?: number;
    overrideExpiresAtMs?: number;
    overrideRevokedAtMs?: number;
    overrideRevokedBy?: "dm_local";
    overrideBy?: "dm_local";
  };
  encounterGateContext: {
    reason: string;
    requiredRolls: EncounterRollStatKey[];
    createdRolls: EncounterRollStatKey[];
    failedRolls: EncounterRollStatKey[];
    battleId: string | null;
    targetMemberIds: string[];
    targetPolicyMode: TargetPolicyMode;
    confirmedAtMs?: number;
    confirmedBy?: "dm_local";
    confirmationSource?: "ui_confirm_action";
    openedAt: number;
  } | null;
  handledEncounterIntentKeys: string[];
  canonicalEncounterActors: Array<[string, { npcId: string; name: string; sourceType: "manual" | "monster"; sourceId?: string }]>;
}

function buildOneOffSessionStateKey(sessionId: string): string {
  return `${ONE_OFF_SESSION_STATE_PREFIX}${sessionId}`;
}

export default function AdventureSessionPlaceholderScreen() {
  const c = useColors();
  const {
    inventory,
    attacks,
    classFeatures,
    resources,
    itemActionUses,
    addItem,
    removeItem,
    updateItem,
    incrementResource,
    decrementResource,
    resetResource,
    useItemEffect,
    character,
  } = useCharacter();
  const { resourceMaxBonuses } = useEquippedEffects();
  const {
    isHydrated: isPartyHydrated,
    partyCode,
    memberId,
    members,
    combatState,
    refreshCombatState,
    createAndJoinParty,
  } = useParty();
  const { setActiveSession, clearActiveSession } = useAdventureSessionAwareness();
  const params = useLocalSearchParams<{
    sessionId?: string;
    source?: string;
    mode?: string;
    title?: string;
    difficulty?: string;
    stylePreset?: string;
    startInCombat?: string;
    guidance?: string;
    campaignId?: string;
    campaignLabel?: string;
    chapterLabel?: string;
  }>();
  const sessionId = params.sessionId ?? "unknown";
  const title = params.title ?? "One-Off Encounter";
  const source = params.source ?? "";
  const difficulty = params.difficulty ?? "balanced";
  const stylePreset = params.stylePreset ?? "cinematic";
  const guidance = params.guidance ?? "";
  const mode = params.mode ?? "one_off";
  const startInCombat = params.startInCombat === "1";
  const campaignId = params.campaignId ?? "";
  const campaignLabel = params.campaignLabel ?? "";
  const chapterLabel = params.chapterLabel ?? "";
  const isCampaignScaffold = mode === "campaign_scaffold";

  const feedSeed = useMemo(
    () => {
      if (isCampaignScaffold) {
        return buildAiDmCampaignFeedSeed({
          sessionId,
          campaignName: campaignLabel || title,
          chapterTitle: chapterLabel || "Chapter 1",
          difficulty,
          stylePreset,
          guidanceText: guidance,
        });
      }

      return buildAiDmOneOffFeedSeed({
        sessionId,
        title,
        difficulty,
        stylePreset,
        guidanceText: guidance,
        startInCombat,
      });
    },
    [isCampaignScaffold, sessionId, title, campaignLabel, chapterLabel, difficulty, stylePreset, guidance, startInCombat],
  );

  const [entries, setEntries] = useState(feedSeed.entries);
  const [outcomeState, setOutcomeState] = useState(createInitialOneOffOutcomeState());
  const [isHandoffApproved, setIsHandoffApproved] = useState(false);
  const [campaignSubmitStatus, setCampaignSubmitStatus] = useState<string>("");
  const [checkpointBase, setCheckpointBase] = useState<{ sessionId: string; submissionId: string | null } | null>(null);
  const checkpointSessionRef = useRef(sessionId);
  checkpointSessionRef.current = sessionId;
  const [campaignContinuationSubmitStatus, setCampaignContinuationSubmitStatus] = useState<string>("");
  const [campaignContinuationHydrateStatus, setCampaignContinuationHydrateStatus] = useState<string>("");
  const [campaignRuntimeStatus, setCampaignRuntimeStatus] = useState<string>("");
  const [dmWatchPartyCode, setDmWatchPartyCode] = useState<string | null>(null);
  const [isCampaignSubmitting, setIsCampaignSubmitting] = useState(false);
  const [isCampaignContinuationSubmitting, setIsCampaignContinuationSubmitting] = useState(false);
  const [isCampaignHydrating, setIsCampaignHydrating] = useState(false);
  const [isCampaignRuntimeTurnPending, setIsCampaignRuntimeTurnPending] = useState(false);
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [streamingResponseText, setStreamingResponseText] = useState("");
  const [rollingRequestId, setRollingRequestId] = useState<string | null>(null);
  const sessionScrollRef = useRef<ScrollView>(null);
  const combatSectionYRef = useRef<number | null>(null);
  const rollSubmissionGateRef = useRef(createRollSubmissionGate());
  const reportedUncertainRollsRef = useRef(new Set<string>());
  const [pendingChoices, setPendingChoices] = useState<string[]>([]);
  const [prologueDone, setPrologueDone] = useState(false);
  const [isCampaignArchiveHydrated, setIsCampaignArchiveHydrated] = useState(!isCampaignScaffold);
  const [encounterGateStatus, setEncounterGateStatus] = useState<string>("");
  const [encounterGateVisibility, setEncounterGateVisibility] = useState<EncounterGateVisibilityState | null>(null);
  const [encounterGateConfirmation, setEncounterGateConfirmation] = useState<{
    clearConfirmed: boolean;
    confirmedAtMs?: number;
    confirmedBy?: "dm_local";
    confirmationSource?: "ui_confirm_action";
    reopenedAfterConfirmation?: boolean;
  }>({
    clearConfirmed: false,
  });
  const [encounterGateOverride, setEncounterGateOverride] = useState<{
    overrideMode: EncounterGateOverrideMode;
    overrideStatus?: "active" | "revoked" | "expired";
    overrideReasonCode?: EncounterGateOverrideReasonCode;
    overrideAtMs?: number;
    overrideExpiresAtMs?: number;
    overrideRevokedAtMs?: number;
    overrideRevokedBy?: "dm_local";
    overrideBy?: "dm_local";
  }>({
    overrideMode: "none",
  });
  const [encounterGateContext, setEncounterGateContext] = useState<{
    reason: string;
    requiredRolls: EncounterRollStatKey[];
    createdRolls: EncounterRollStatKey[];
    failedRolls: EncounterRollStatKey[];
    battleId: string | null;
    targetMemberIds: string[];
    targetPolicyMode: TargetPolicyMode;
    confirmedAtMs?: number;
    confirmedBy?: "dm_local";
    confirmationSource?: "ui_confirm_action";
    openedAt: number;
  } | null>(null);
  const [encounterGateNowMs, setEncounterGateNowMs] = useState(() => Date.now());
  const [isOneOffSessionHydrated, setIsOneOffSessionHydrated] = useState(isCampaignScaffold);
  const [isRebindingOneOffParty, setIsRebindingOneOffParty] = useState(false);
  const handledEncounterIntentKeysRef = useRef<Set<string>>(new Set());
  const canonicalEncounterActorRegistryRef = useRef<
    Map<string, { npcId: string; name: string; sourceType: "manual" | "monster"; sourceId?: string }>
  >(new Map());
  const autoKickoffAttemptedRef = useRef(false);
  const handleCampaignRuntimeTurnRef = useRef(handleCampaignRuntimeTurn);
  const autoPartyBootstrapStartedRef = useRef(false);

  const recap = useMemo(() => {
    if (isCampaignScaffold) return undefined;
    if (outcomeState.status !== "encounter_closed") return undefined;
    return buildOneOffSessionRecap({
      sessionId,
      title,
      difficulty,
      stylePreset,
      guidanceSource: feedSeed.guidanceSource,
      startInCombat,
      entries,
      outcomeState,
    });
  }, [isCampaignScaffold, sessionId, title, difficulty, stylePreset, feedSeed.guidanceSource, startInCombat, entries, outcomeState]);

  const campaignChoiceOptions = useMemo(() => {
    return buildCampaignChoiceOptions(pendingChoices);
  }, [pendingChoices]);

  const hasSessionConversationEntry = useMemo(
    () => entries.some((entry) => entry.role === "dm" || entry.role === "player"),
    [entries],
  );

  const hasPlayerConversationEntry = useMemo(
    () => entries.some((entry) => entry.role === "player"),
    [entries],
  );

  const pendingRollRequests = useMemo((): PartyRollRequest[] => {
    if (isCampaignScaffold || !memberId) return [];
    return (combatState?.rollRequests ?? []).filter(
      (request) => request.targetMemberIds.includes(memberId) && !request.responses.some((response) => response.memberId === memberId),
    );
  }, [isCampaignScaffold, combatState?.rollRequests, memberId]);

  React.useEffect(() => {
    if (isCampaignScaffold || !isOneOffSessionHydrated || !memberId) return;
    let cancelled = false;
    void (async () => {
      for (const request of combatState?.rollRequests ?? []) {
        if (!request.targetMemberIds.includes(memberId) ||
            !request.responses.some((response) => response.memberId === memberId) ||
            request.statKey === "initiative") continue;
        const key = rollContinuationReceiptKey(sessionId, memberId, request.id);
        if (reportedUncertainRollsRef.current.has(key)) continue;
        const receipt = await AsyncStorage.getItem(key);
        if (cancelled) return;
        if (receipt === "dispatching") {
          reportedUncertainRollsRef.current.add(key);
          setEntries((prev) => [...prev, {
            id: createFeedEntryId("roll-recovery-warning"),
            role: "system",
            text: `The ${request.label} roll is recorded, but the prior DM narration may have been interrupted. Check the last DM response before choosing to continue; narration will not replay automatically.`,
          }]);
        }
      }
    })().catch(() => { /* Missing local storage must not invent a roll outcome. */ });
    return () => { cancelled = true; };
  }, [isCampaignScaffold, isOneOffSessionHydrated, memberId, sessionId, combatState?.rollRequests]);

  // Only the party combat projection can establish that this member is in a battle.
  // AI narration / encounter text must never be treated as an attack result.
  const activeOneOffBattleId = !isCampaignScaffold && memberId
    ? combatState?.participantBattleById?.[memberId] ?? null
    : null;

  const goToCombatControls = () => {
    if (combatSectionYRef.current !== null) {
      sessionScrollRef.current?.scrollTo({ y: combatSectionYRef.current, animated: true });
    }
  };

  const shouldShowEncounterSnapshot = useMemo(() => {
    if (isCampaignScaffold) return false;
    if (isRebindingOneOffParty) return false;
    if (!hasPlayerConversationEntry) return false;
    if (!combatState) return false;
    const activeBattleId = memberId ? combatState.participantBattleById?.[memberId] ?? null : null;
    if (activeBattleId) return true;
    return (combatState.combatNpcs?.length ?? 0) > 0 || pendingRollRequests.length > 0;
  }, [isCampaignScaffold, isRebindingOneOffParty, hasPlayerConversationEntry, combatState, memberId, pendingRollRequests.length]);

  const encounterCombatActions = useMemo(() => {
    const actionable = collectActionableItemEffects(inventory);
    return {
      bonus: actionable.filter((effect) => effect.actionType === "bonus_action"),
      actions: actionable.filter((effect) => effect.actionType === "action"),
    };
  }, [inventory]);

  const encounterFeatureActions = useMemo(() => {
    return {
      bonus: classFeatures.filter((feature) => feature.actionType === "bonus_action"),
      actions: classFeatures.filter((feature) => feature.actionType === "action"),
    };
  }, [classFeatures]);

  const encounterConsumables = useMemo(
    () => inventory.filter((item) => item.category === "consumable" && item.quantity > 0),
    [inventory],
  );

  const npcNameOverridesById = useMemo(() => {
    const overrides: Record<string, string> = {};
    for (const actor of canonicalEncounterActorRegistryRef.current.values()) {
      const npcId = actor.npcId?.trim();
      const name = actor.name?.trim();
      if (!npcId || !name) continue;
      overrides[npcId] = name;
    }
    return overrides;
  }, [entries]);

  const effectivePartyCode = useMemo(() => {
    const primary = partyCode?.trim();
    if (primary && primary.length > 0) return primary;
    if (!isCampaignScaffold) return null;
    const fallback = dmWatchPartyCode?.trim();
    return fallback && fallback.length > 0 ? fallback : null;
  }, [partyCode, dmWatchPartyCode, isCampaignScaffold]);

  const connectedMemberIds = useMemo(() => {
    const fromMembers = members
      .map((member) => member.id.trim())
      .filter((id) => id.length > 0);
    if (fromMembers.length > 0) {
      return [...new Set(fromMembers)];
    }

    const fromCombatState = (combatState?.activeMemberIds ?? [])
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    return [...new Set(fromCombatState)];
  }, [members, combatState]);

  function formatRollCheckName(statKey: string): string {
    if (statKey === "initiative") return "Initiative check";
    const abilities: Record<string, string> = { strength: "Strength", dexterity: "Dexterity", constitution: "Constitution", intelligence: "Intelligence", wisdom: "Wisdom", charisma: "Charisma" };
    if (statKey.endsWith("_save")) return (abilities[statKey.slice(0, -5)] ?? statKey) + " saving throw";
    if (abilities[statKey]) return abilities[statKey] + " ability check";
    const skillAbilities: Record<string, string> = {
      acrobatics: "Dexterity", animal_handling: "Wisdom", arcana: "Intelligence", athletics: "Strength", deception: "Charisma",
      history: "Intelligence", insight: "Wisdom", intimidation: "Charisma", investigation: "Intelligence", medicine: "Wisdom",
      nature: "Intelligence", perception: "Wisdom", performance: "Charisma", persuasion: "Charisma", religion: "Intelligence",
      sleight_of_hand: "Dexterity", stealth: "Dexterity", survival: "Wisdom",
    };
    const skill = statKey.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());
    return skillAbilities[statKey] ? skillAbilities[statKey] + " (" + skill + ") check" : skill + " check";
  }
  function getModifierForStatKey(statKey: string): number {
    if (statKey === "initiative") return character.initiative ?? 0;

    if (["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].includes(statKey)) {
      const abilityScore = character.abilityScores[statKey as keyof typeof character.abilityScores] ?? 10;
      return Math.floor((abilityScore - 10) / 2);
    }

    if (statKey.endsWith("_save")) {
      const ability = statKey.replace("_save", "") as keyof typeof character.abilityScores;
      const save = character.savingThrows.find((entry) => entry.ability === ability);
      if (save) return save.modifier;
      const abilityScore = character.abilityScores[ability] ?? 10;
      return Math.floor((abilityScore - 10) / 2);
    }

    const skillName = statKey.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());
    const skill = character.skills.find((entry) => entry.name.toLowerCase() === skillName.toLowerCase());
    return skill ? skill.modifier : 0;
  }

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(DM_WATCH_KEY);
        if (!mounted) return;
        const normalized = typeof stored === "string" ? stored.trim().toUpperCase() : "";
        setDmWatchPartyCode(normalized.length > 0 ? normalized : null);
      } catch {
        if (!mounted) return;
        setDmWatchPartyCode(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (isCampaignScaffold) {
      setIsOneOffSessionHydrated(true);
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(buildOneOffSessionStateKey(sessionId));
        if (!mounted) return;
        if (raw) {
          const parsed = JSON.parse(raw) as PersistedOneOffSessionState;
          setEntries(Array.isArray(parsed.entries) ? parsed.entries : feedSeed.entries);
          setOutcomeState(parsed.outcomeState ?? createInitialOneOffOutcomeState());
          setIsHandoffApproved(Boolean(parsed.isHandoffApproved));
          setPendingChoices(Array.isArray(parsed.pendingChoices) ? parsed.pendingChoices : []);
          setPrologueDone(Boolean(parsed.prologueDone));
          setEncounterGateStatus(parsed.encounterGateStatus ?? "");
          setEncounterGateVisibility(parsed.encounterGateVisibility ?? null);
          setEncounterGateConfirmation(parsed.encounterGateConfirmation ?? { clearConfirmed: false });
          setEncounterGateOverride(parsed.encounterGateOverride ?? { overrideMode: "none" });
          setEncounterGateContext(parsed.encounterGateContext ?? null);
          handledEncounterIntentKeysRef.current = new Set(parsed.handledEncounterIntentKeys ?? []);
          canonicalEncounterActorRegistryRef.current = new Map(parsed.canonicalEncounterActors ?? []);
        }
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setIsOneOffSessionHydrated(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isCampaignScaffold, sessionId, feedSeed.entries]);

  React.useEffect(() => {
    if (isCampaignScaffold || !isOneOffSessionHydrated) return;
    const payload: PersistedOneOffSessionState = {
      entries,
      outcomeState,
      isHandoffApproved,
      pendingChoices,
      prologueDone,
      encounterGateStatus,
      encounterGateVisibility,
      encounterGateConfirmation,
      encounterGateOverride,
      encounterGateContext,
      handledEncounterIntentKeys: [...handledEncounterIntentKeysRef.current],
      canonicalEncounterActors: [...canonicalEncounterActorRegistryRef.current.entries()],
    };
    void AsyncStorage.setItem(buildOneOffSessionStateKey(sessionId), JSON.stringify(payload));
  }, [
    isCampaignScaffold,
    isOneOffSessionHydrated,
    sessionId,
    entries,
    outcomeState,
    isHandoffApproved,
    pendingChoices,
    prologueDone,
    encounterGateStatus,
    encounterGateVisibility,
    encounterGateConfirmation,
    encounterGateOverride,
    encounterGateContext,
  ]);

  React.useEffect(() => {
    if (isCampaignScaffold || !isPartyHydrated || !isOneOffSessionHydrated) return;

    const hasActivePartySession = Boolean(partyCode?.trim() && memberId?.trim());
    const shouldForceFreshPartyForNewOneOff = source === "new-oneoff" && !hasPlayerConversationEntry;
    if (!shouldAutoCreateOneOffParty({
      hasSavedConversation: hasPlayerConversationEntry,
      hasActivePartySession,
      launchedAsNewOneOff: shouldForceFreshPartyForNewOneOff,
    })) return;
    if (autoPartyBootstrapStartedRef.current) return;

    autoPartyBootstrapStartedRef.current = true;
    if (shouldForceFreshPartyForNewOneOff) {
      setIsRebindingOneOffParty(true);
    }
    void (async () => {
      try {
        await createAndJoinParty();
        setEntries((prev) => {
          if (prev.some((entry) => entry.role === "system" && /auto-connected party/i.test(entry.text))) {
            return prev;
          }
          return [
            ...prev,
            {
              id: createFeedEntryId("oneoff-party-bootstrap"),
              role: "system",
              text: shouldForceFreshPartyForNewOneOff
                ? "Started a fresh party session for this new one-off so previous encounters do not carry over."
                : "Auto-connected party session for this one-off so encounter rolls and combat authority stay in-session.",
            },
          ];
        });
      } catch (error) {
        autoPartyBootstrapStartedRef.current = false;
        const message = error instanceof Error ? error.message : "Failed to auto-connect party session.";
        setEntries((prev) => [
          ...prev,
          {
            id: createFeedEntryId("oneoff-party-bootstrap-error"),
            role: "system",
            text: `Party auto-connect failed: ${message}`,
          },
        ]);
      } finally {
        if (shouldForceFreshPartyForNewOneOff) {
          setIsRebindingOneOffParty(false);
        }
      }
    })();
  }, [
    isCampaignScaffold,
    isPartyHydrated,
    isOneOffSessionHydrated,
    partyCode,
    memberId,
    source,
    hasPlayerConversationEntry,
    createAndJoinParty,
  ]);

  React.useEffect(() => {
    void setActiveSession({
      sessionId,
      mode,
      title,
      difficulty,
      stylePreset,
      startInCombat,
      guidanceText: guidance,
      campaignId,
      campaignLabel,
      chapterLabel,
    });
  }, [setActiveSession, sessionId, mode, title, difficulty, stylePreset, startInCombat, guidance, campaignId, campaignLabel, chapterLabel]);

  React.useEffect(() => {
    setEntries(feedSeed.entries);
    setOutcomeState(createInitialOneOffOutcomeState());
    setIsHandoffApproved(false);
    setPendingChoices([]);
    setPrologueDone(false);
    setIsCampaignArchiveHydrated(!isCampaignScaffold);
    setEncounterGateStatus("");
    setEncounterGateVisibility(null);
    setEncounterGateConfirmation({ clearConfirmed: false });
    setEncounterGateOverride({ overrideMode: "none" });
    setEncounterGateContext(null);
    handledEncounterIntentKeysRef.current.clear();
    canonicalEncounterActorRegistryRef.current.clear();
    autoKickoffAttemptedRef.current = false;
    autoPartyBootstrapStartedRef.current = false;
    setIsOneOffSessionHydrated(isCampaignScaffold);
    setIsRebindingOneOffParty(false);
  }, [feedSeed, isCampaignScaffold]);

  React.useEffect(() => {
    if (!isCampaignScaffold) return;
    let mounted = true;
    void (async () => {
      const archived = await getArchivedCampaignSession(sessionId);
      if (!mounted) return;

      const hydrationSource = resolveCampaignHydrationSource({ archived });

      if (hydrationSource === "local_archive" && archived) {
        setEntries(archived.entries);
        setPendingChoices(archived.pendingChoices);
        setPrologueDone(archived.prologueDone);
        setCampaignContinuationHydrateStatus(`Loaded local campaign archive (${archived.entries.length} entries).`);
      } else {
        try {
          const snapshotSeed = await fetchCampaignContinuationHydrateSeed({ sessionId });
          if (!mounted) return;
          if (snapshotSeed.found) {
            setEntries(snapshotSeed.seed.entries);
            setPendingChoices([]);
            setPrologueDone(snapshotSeed.seed.entries.length > 0);
            setCampaignContinuationHydrateStatus(snapshotSeed.seed.statusMessage);
          } else {
            setCampaignContinuationHydrateStatus("No local archive found. No continuation snapshot found yet for this session.");
          }
        } catch (error) {
          if (!mounted) return;
          const message = error instanceof Error ? error.message : "Unknown error";
          setCampaignContinuationHydrateStatus(`Server resume snapshot read failed: ${message}`);
        }
      }

      setIsCampaignArchiveHydrated(true);
    })();

    return () => {
      mounted = false;
    };
  }, [isCampaignScaffold, sessionId]);

  React.useEffect(() => {
    if (!isCampaignScaffold || !isCampaignArchiveHydrated) return;
    void upsertArchivedCampaignSession({
      sessionId,
      session: {
        mode: "campaign_scaffold",
        title,
        difficulty,
        stylePreset,
        startInCombat,
        guidance,
        campaignId: campaignId || sessionId,
        campaignLabel: campaignLabel || title,
        chapterLabel: chapterLabel || "Chapter 1",
      },
      entries,
      pendingChoices,
      prologueDone,
    });
  }, [
    isCampaignScaffold,
    isCampaignArchiveHydrated,
    sessionId,
    title,
    difficulty,
    stylePreset,
    startInCombat,
    guidance,
    campaignId,
    campaignLabel,
    chapterLabel,
    entries,
    pendingChoices,
    prologueDone,
  ]);

  async function refreshCampaignContinuationSnapshot(options?: { silentNotFound?: boolean }) {
    if (!isCampaignScaffold) return;
    setIsCampaignHydrating(true);
    setCampaignContinuationHydrateStatus("Loading continuation snapshot...");
    try {
      const outcome = await fetchCampaignContinuationSnapshot({ sessionId });
      if (checkpointSessionRef.current !== sessionId) return;
      if (!outcome.found) {
        setCheckpointBase({ sessionId, submissionId: null });
        if (options?.silentNotFound) {
          setCampaignContinuationHydrateStatus("No continuation snapshot found yet for this session.");
        } else {
          setCampaignContinuationHydrateStatus("No continuation snapshot found yet for this session.");
        }
        return;
      }

      const snapshot = outcome.response.snapshot;
      setCheckpointBase({ sessionId, submissionId: snapshot.submissionId });
      const summary = snapshot.progressSummary.slice(0, 120);
      const summarySuffix = snapshot.progressSummary.length > 120 ? "..." : "";
      setCampaignContinuationHydrateStatus(
        `Continuation snapshot loaded: checkpoint ${snapshot.checkpointIndex} (${snapshot.continuityStatus}) - ${summary}${summarySuffix}`,
      );
    } catch (error) {
      if (checkpointSessionRef.current !== sessionId) return;
      const message = error instanceof Error ? error.message : "Unknown error";
      setCampaignContinuationHydrateStatus(`Continuation snapshot read failed: ${message}`);
    } finally {
      if (checkpointSessionRef.current === sessionId) setIsCampaignHydrating(false);
    }
  }

  React.useEffect(() => {
    if (!isCampaignScaffold) return;
    void refreshCampaignContinuationSnapshot({ silentNotFound: true });
  }, [isCampaignScaffold, sessionId]);

  const hasCampaignConversationEntry = hasSessionConversationEntry;

  // Always keep the ref pointing at the latest version so the auto-kickoff
  // effect never calls a stale closure.
  React.useEffect(() => {
    handleCampaignRuntimeTurnRef.current = handleCampaignRuntimeTurn;
  });

  React.useEffect(() => {
    if (!isCampaignScaffold) return;
    if (!isCampaignArchiveHydrated) return;
    if (hasCampaignConversationEntry) return;
    if (autoKickoffAttemptedRef.current) return;

    autoKickoffAttemptedRef.current = true;
    const encounterIntent = guidance.trim() || "Begin the session.";
    void handleCampaignRuntimeTurnRef.current(encounterIntent, { silent: true });
  }, [
    isCampaignScaffold,
    isCampaignArchiveHydrated,
    hasCampaignConversationEntry,
    guidance,
  ]);

  React.useEffect(() => {
    if (!encounterGateContext) return;
    const normalizedTargetMemberIds = [...new Set(encounterGateContext.targetMemberIds.map((id) => id.trim()).filter((id) => id.length > 0))];
    const recovery = recoverEncounterGateBattleContext({
      combatState,
      battleId: encounterGateContext.battleId,
      targetMemberIds: normalizedTargetMemberIds,
      targetPolicyMode: encounterGateContext.targetPolicyMode,
    });
    const recoveredBattleId = recovery.battleId;
    const recoveredTargetMemberIds = recovery.targetMemberIds;

    if (
      recovery.recovered ||
      recoveredTargetMemberIds.length !== encounterGateContext.targetMemberIds.length ||
      recoveredTargetMemberIds.some((id, index) => id !== encounterGateContext.targetMemberIds[index])
    ) {
      setEncounterGateContext((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          battleId: recoveredBattleId,
          targetMemberIds: recoveredTargetMemberIds,
        };
      });
    }

    const completion = getEncounterRollCompletionState({
      combatState,
      battleId: recoveredBattleId,
      targetMemberIds: recoveredTargetMemberIds,
      requiredRolls: encounterGateContext.requiredRolls,
      targetPolicyMode: encounterGateContext.targetPolicyMode,
    });
    const clearEncounterGate =
      completion.canEvaluate &&
      encounterGateContext.requiredRolls.length > 0 &&
      completion.unresolvedRolls.length === 0;

    const now = encounterGateNowMs;
    const overrideEligible =
      encounterGateOverride.overrideMode === "acknowledge_missing_targets" &&
      encounterGateOverride.overrideStatus === "active";
    const overrideExpired =
      overrideEligible && typeof encounterGateOverride.overrideExpiresAtMs === "number" && now >= encounterGateOverride.overrideExpiresAtMs;

    let nextOverride = encounterGateOverride;
    if (overrideExpired) {
      nextOverride = {
        ...encounterGateOverride,
        overrideStatus: "expired",
      };
      setEncounterGateOverride(nextOverride);
    }

    // Fail-closed reopen: any regression after confirmation reactivates the gate and clears audit metadata.
    let nextConfirmation = encounterGateConfirmation;
    if (!clearEncounterGate && encounterGateConfirmation.clearConfirmed) {
      nextConfirmation = {
        clearConfirmed: false,
        reopenedAfterConfirmation: true,
      };
      setEncounterGateConfirmation(nextConfirmation);
      setEncounterGateContext((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          confirmedAtMs: undefined,
          confirmedBy: undefined,
          confirmationSource: undefined,
        };
      });
    }

    const gateAgeMs = Math.max(0, encounterGateNowMs - encounterGateContext.openedAt);
    const visibility = buildEncounterGateVisibilityState({
      reason: encounterGateContext.reason,
      requiredRolls: encounterGateContext.requiredRolls,
      createdRolls: encounterGateContext.createdRolls,
      failedRolls: encounterGateContext.failedRolls,
      resolvedRolls: completion.resolvedRolls,
      healthReasonCode: completion.healthReasonCode,
      healthReason: completion.healthReason,
      gateAgeMs,
      clearEncounterGate,
      clearConfirmed: nextConfirmation.clearConfirmed,
      confirmedAtMs: nextConfirmation.confirmedAtMs,
      confirmedBy: nextConfirmation.confirmedBy,
      confirmationSource: nextConfirmation.confirmationSource,
      targetPolicyMode: encounterGateContext.targetPolicyMode,
      overrideMode: nextOverride.overrideMode,
      overrideStatus: nextOverride.overrideStatus,
      overrideReasonCode: nextOverride.overrideReasonCode,
      overrideAtMs: nextOverride.overrideAtMs,
      overrideExpiresAtMs: nextOverride.overrideExpiresAtMs,
      overrideRevokedAtMs: nextOverride.overrideRevokedAtMs,
      overrideRevokedBy: nextOverride.overrideRevokedBy,
      overrideBy: nextOverride.overrideBy,
    });
    setEncounterGateVisibility(visibility);
    const statusMessage = nextConfirmation.reopenedAfterConfirmation
      ? "Encounter gate reopened after combat updates. Resolve prompts again before continuing."
      : visibility.status === "cleared" && !visibility.clearConfirmed
      ? "Encounter prompts resolved. Confirm and continue to unblock story turns."
      : visibility.overrideStatus === "active"
        ? `Override active, expires in ${Math.max(0, Math.ceil(((visibility.overrideExpiresAtMs ?? now) - now) / 1000))}s.`
        : visibility.overrideStatus === "revoked"
          ? "Override revoked."
          : visibility.overrideStatus === "expired"
            ? "Override expired, gate re-evaluated."
      : visibility.reason;
    setEncounterGateStatus(visibility.isActive ? statusMessage : "");
  }, [encounterGateContext, combatState, encounterGateNowMs, encounterGateConfirmation, encounterGateOverride]);

  React.useEffect(() => {
    if (!encounterGateVisibility?.isActive || !encounterGateContext) return;
    setEncounterGateNowMs(Date.now());
    const timer = setInterval(() => {
      setEncounterGateNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [encounterGateVisibility?.isActive, encounterGateContext]);

  const canApplyHandoff = useMemo(
    () => canApplyOneOffHandoff({ outcomeStatus: outcomeState.status, isApproved: isHandoffApproved }),
    [outcomeState.status, isHandoffApproved],
  );

  function handleInputSubmit(playerText: string) {
    if (activeOneOffBattleId) {
      setEntries((prev) => [...prev, {
        id: createFeedEntryId("combat-action-block"),
        role: "system",
        text: "Combat is active. Choose a target and resolve your attack or action using Combat / Targets below. The AI DM cannot adjudicate an attack from story text.",
      }]);
      goToCombatControls();
      return;
    }
    if (shouldBlockStoryInputForPendingRolls({
      isOneOff: !isCampaignScaffold,
      pendingTargetedRollCount: pendingRollRequests.length,
    })) {
      setEntries((prev) => [...prev, {
        id: createFeedEntryId("pending-roll-block"),
        role: "system",
        text: "The DM is waiting for your roll. Use the Roll button above before taking another story action.",
      }]);
      return;
    }
    if (isCampaignScaffold) {
      if (encounterGateVisibility?.isActive) {
        setEntries((prev) => [
          ...prev,
          {
            id: createFeedEntryId("encounter-gate-block"),
            role: "system",
            text: "Encounter setup is pending. Resolve initiative prompt flow before continuing story turns.",
          },
        ]);
        return;
      }
      setPendingChoices([]);
      void handleCampaignRuntimeTurn(playerText, {});
      return;
    }

    setPendingChoices([]);
    void handleCampaignRuntimeTurn(playerText, {});
  }

  function handleChoiceSelect(choice: string) {
    if (isCampaignRuntimeTurnPending) return;
    if (activeOneOffBattleId) {
      setEntries((prev) => [...prev, {
        id: createFeedEntryId("combat-choice-block"),
        role: "system",
        text: "Combat is active. Use the Combat / Targets controls to resolve your turn.",
      }]);
      goToCombatControls();
      return;
    }
    if (shouldBlockStoryInputForPendingRolls({
      isOneOff: !isCampaignScaffold,
      pendingTargetedRollCount: pendingRollRequests.length,
    })) {
      setEntries((prev) => [...prev, {
        id: createFeedEntryId("pending-roll-block"),
        role: "system",
        text: "Resolve the DM roll request before choosing the next action.",
      }]);
      return;
    }
    if (isCampaignScaffold && encounterGateVisibility?.isActive) {
      setEntries((prev) => [
        ...prev,
        {
          id: createFeedEntryId("encounter-gate-block"),
          role: "system",
          text: "Encounter setup is pending. Resolve initiative prompt flow before continuing story turns.",
        },
      ]);
      return;
    }
    setPendingChoices([]);
    void handleCampaignRuntimeTurn(choice, {});
  }

  function handleRefreshEncounterGate() {
    setEncounterGateNowMs(Date.now());
  }

  function handleConfirmEncounterGateClear() {
    const confirmedAtMs = Date.now();
    setEncounterGateConfirmation({
      clearConfirmed: true,
      confirmedAtMs,
      confirmedBy: "dm_local",
      confirmationSource: "ui_confirm_action",
      reopenedAfterConfirmation: false,
    });
    setEncounterGateContext((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        confirmedAtMs,
        confirmedBy: "dm_local",
        confirmationSource: "ui_confirm_action",
      };
    });
    setEncounterGateNowMs(Date.now());
  }

  function handleAcknowledgeMissingTargetOverride() {
    const overrideAtMs = Date.now();
    setEncounterGateOverride({
      overrideMode: "acknowledge_missing_targets",
      overrideStatus: "active",
      overrideReasonCode: "missing_target_departed",
      overrideAtMs,
      overrideExpiresAtMs: overrideAtMs + 5 * 60 * 1000,
      overrideBy: "dm_local",
    });
    setEncounterGateNowMs(overrideAtMs);
  }

  function handleRevokeEncounterGateOverride() {
    const revokedAtMs = Date.now();
    setEncounterGateOverride((prev) => ({
      ...prev,
      overrideStatus: "revoked",
      overrideRevokedAtMs: revokedAtMs,
      overrideRevokedBy: "dm_local",
    }));
    setEncounterGateNowMs(revokedAtMs);
  }

  async function handlePendingRollResponse(request: PartyRollRequest) {
    if (!rollSubmissionGateRef.current.begin(request.id)) return;
    if (!partyCode || !memberId) {
      setEntries((prev) => [
        ...prev,
        {
          id: createFeedEntryId("roll-request-missing-party"),
          role: "system",
          text: "Roll request is pending, but this session is not connected as a party member.",
        },
      ]);
      rollSubmissionGateRef.current.end(request.id);
      return;
    }

    setRollingRequestId(request.id);
    try {
      const roll = Math.floor(Math.random() * 20) + 1;
      const modifier = getModifierForStatKey(request.statKey);
      const total = Math.max(1, roll + modifier);
      await submitPartyRollResponse(partyCode, request.id, {
        memberId,
        roll,
        modifier,
        total,
      });
      const refreshedState = await refreshCombatState(partyCode);
      const rollSummary = `Roll submitted for ${request.label}: ${roll} ${modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`} = ${total}.`;
      setEntries((prev) => [
        ...prev,
        {
          id: createFeedEntryId("roll-response"),
          role: "tool",
          text: rollSummary,
        },
      ]);
      // Resume narrative only after authoritative acknowledgment and when every
      // targeted roll has a response. Initiative/encounter gates retain their
      // separate authoritative resolution path.
      const remainingChecks = (refreshedState?.rollRequests ?? []).filter(
        (pending) => pending.targetMemberIds.includes(memberId) &&
          !pending.responses.some((response) => response.memberId === memberId),
      );
      const acknowledgedRoll = refreshedState?.rollRequests.some(
        (pending) => pending.id === request.id &&
          pending.responses.some((response) => response.memberId === memberId),
      ) === true;
      if (shouldResumeNarrationAfterRoll({
        confirmed: acknowledgedRoll,
        isInitiative: request.statKey === "initiative",
        encounterGateActive: encounterGateVisibility?.isActive === true,
        remainingTargetedRolls: remainingChecks.length,
      })) {
        const receiptKey = rollContinuationReceiptKey(sessionId, memberId, request.id);
        if (await claimRollContinuation(receiptKey, AsyncStorage)) {
          const completed = await handleCampaignRuntimeTurn(
            `The requested ${request.label} check has been rolled: d20 ${roll}, modifier ${modifier}, total ${total}. Continue the scene and adjudicate this result without requesting the same roll again.`,
            { silent: true },
          );
          if (completed) {
            await AsyncStorage.setItem(receiptKey, "completed");
          } else {
            setEntries((prev) => [...prev, {
              id: createFeedEntryId("roll-continuation-uncertain"),
              role: "system",
              text: "Roll saved, but DM continuation could not be confirmed. The session will not automatically replay it; review the narrative before continuing.",
            }]);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit roll response.";
      setEntries((prev) => [
        ...prev,
        {
          id: createFeedEntryId("roll-response-error"),
          role: "system",
          text: `Roll response failed: ${message}`,
        },
      ]);
    } finally {
      rollSubmissionGateRef.current.end(request.id);
      setRollingRequestId(null);
    }
  }

  async function submitAdjudicationRollRequests(adjudicationRequests: CampaignRuntimeTurnAdjudicationRequest[]) {
    if (adjudicationRequests.length === 0) return;

    if (!effectivePartyCode) {
      setEntries((prev) => [
        ...prev,
        {
          id: createFeedEntryId("adjudication-skip"),
          role: "system",
          text: "Adjudication checks were requested, but no party session is connected.",
        },
      ]);
      return;
    }

    // A newly bootstrapped one-off can have a registered member before the
    // separate party-members projection/poll has hydrated.
    let targetMemberIds = connectedMemberIds.length > 0 ? connectedMemberIds : memberId ? [memberId] : [];
    if (targetMemberIds.length === 0) {
      try {
        const liveMembers = await fetchPartyMembers(effectivePartyCode);
        targetMemberIds = [...new Set(liveMembers.members.map((member) => member.id.trim()).filter((id) => id.length > 0))];
      } catch {
        // Keep fallback behavior deterministic and user-visible below.
      }
    }

    if (targetMemberIds.length === 0) {
      setEntries((prev) => [
        ...prev,
        {
          id: createFeedEntryId("adjudication-skip"),
          role: "system",
          text: "Adjudication checks were requested, but no connected party members are available.",
        },
      ]);
      return;
    }

    const battleId = encounterGateContext?.battleId ?? undefined;
    const createdLabels: string[] = [];
    const failedLabels: string[] = [];

    for (const request of adjudicationRequests) {
      try {
        await createPartyRollRequest(effectivePartyCode, {
          statKey: request.statKey,
          label: request.label,
          targetMemberIds,
          ...(battleId ? { battleId } : {}),
        });
        createdLabels.push(request.label);
      } catch {
        failedLabels.push(request.label);
      }
    }

    if (createdLabels.length > 0) {
      try {
        await refreshCombatState(effectivePartyCode);
      } catch {
        // Best-effort refresh only; roll requests are already submitted.
      }
    }

    const summaryParts: string[] = [];
    if (createdLabels.length > 0) {
      summaryParts.push(`Created adjudication checks: ${createdLabels.join(", ")}.`);
    }
    if (failedLabels.length > 0) {
      summaryParts.push(`Failed to create checks: ${failedLabels.join(", ")}.`);
    }

    if (summaryParts.length > 0) {
      setEntries((prev) => [
        ...prev,
        {
          id: createFeedEntryId("adjudication-status"),
          role: failedLabels.length > 0 ? "system" : "tool",
          text: summaryParts.join(" "),
        },
      ]);
    }
  }

  async function handleCampaignRuntimeTurn(playerText: string, options: { silent?: boolean }): Promise<boolean> {
    if (isCampaignRuntimeTurnPending) return false;
    setIsCampaignRuntimeTurnPending(true);
    setIsStreamingResponse(true);
    setStreamingResponseText("");
    setCampaignRuntimeStatus("");

    const pendingPlayerEntry = options.silent
      ? null
      : { id: createFeedEntryId("player"), role: "player" as const, text: playerText };
    if (pendingPlayerEntry) {
      setEntries((prev) => [...prev, pendingPlayerEntry]);
    }


    try {
      const baseEntries = pendingPlayerEntry ? [...entries, pendingPlayerEntry] : entries;
      const inventorySummary = buildInventorySummary(inventory);
      const hostileActorsSummary = buildActiveHostileActorsSummary(combatState, encounterGateContext?.battleId ?? null);
      const knownActorRegistrySummary = buildEncounterActorRegistrySummary(canonicalEncounterActorRegistryRef.current);
      const recentEntries: Array<{ role: "system" | "dm" | "player" | "tool"; text: string }> = [
        ...(inventorySummary ? [{ role: "system" as const, text: `CURRENT INVENTORY: ${inventorySummary}` }] : []),
        ...(hostileActorsSummary ? [{ role: "system" as const, text: hostileActorsSummary }] : []),
        ...(knownActorRegistrySummary ? [{ role: "system" as const, text: knownActorRegistrySummary }] : []),
        ...baseEntries
          .slice(-12)
          .map((entry): { role: "system" | "dm" | "player" | "tool"; text: string } => ({
            role:
              entry.role === "dm"
                ? "dm"
                : entry.role === "player"
                  ? "player"
                  : entry.role === "tool"
                    ? "tool"
                    : "system",
            text: entry.text.slice(0, 1400),
          })),
      ];

      // Defensive: trim and limit all session setup strings to 600 chars
      const safeSessionId = safeSetupString(sessionId);
      const safeCampaignId = safeSetupString(campaignId || sessionId);
      const safeCampaignLabel = safeSetupString(campaignLabel || title);
      const safeChapterLabel = safeSetupString(chapterLabel || "Chapter 1");
      const safeDifficulty = safeSetupString(difficulty);
      const safeStylePreset = safeSetupString(stylePreset);
      const safeGuidance = safeSetupString(guidance);

      // Capture completed turn here so async effects run after requestLiveResponse awaits,
      // keeping isCampaignRuntimeTurnPending true until all side-effects finish (Slice B).
      // Using an object wrapper avoids TypeScript's control-flow collapse of let-in-callback assignments.
      const completedTurnRef: { outcome: CampaignRuntimeTurnResponse["turn"] | null } = { outcome: null };
      // Track whether onProgress has already emitted a terminal error entry (Slice D).
      let terminalErrorPosted = false;

      // Use live response API for streaming
      await requestLiveResponse(
        {
          sessionId: safeSessionId,
          campaignId: safeCampaignId,
          campaignLabel: safeCampaignLabel,
          chapterLabel: safeChapterLabel,
          difficulty: safeDifficulty,
          stylePreset: safeStylePreset,
          guidance: safeGuidance,
          playerInput: playerText.trim().slice(0, 600) || "continue",
          recentEntries,
        },
        {
          onProgress: (update: LiveResponseProgressUpdate) => {
            if (update.kind === "text_chunk" && update.text) {
              setStreamingResponseText((prev) => prev + update.text);
            } else if (update.kind === "completed" && update.response) {
              const outcome = update.response.turn;
              // Capture for post-await async processing (Slice B)
              completedTurnRef.outcome = outcome;
              // Sync-safe state updates only — no await inside onProgress
              setEntries((prev) => [
                ...prev,
                {
                  id: createFeedEntryId("dm-live"),
                  role: "dm",
                  text: outcome.dmText,
                },
              ]);
              setPendingChoices(outcome.choices);
              if (outcome.choices.length > 0) {
                setPrologueDone(true);
              }
            } else if (update.kind === "error" || update.kind === "timeout") {
              const errorMessage = update.error || "Unknown error";
              terminalErrorPosted = true;
              setEntries((prev) => [
                ...prev,
                {
                  id: createFeedEntryId("dm-live-error"),
                  role: "system",
                  text: errorMessage,
                },
              ]);
              setCampaignRuntimeStatus(errorMessage);
            }
          },
          onError: (error) => {
            // Only append feed entry if onProgress has not already emitted a terminal error (Slice D)
            if (terminalErrorPosted) {
              setCampaignRuntimeStatus(error instanceof Error ? error.message : "Unknown error");
              return;
            }
            const message = error instanceof Error ? error.message : "Unknown error";
            const runtimeMessage = `AI DM turn failed: ${message}`;
            setEntries((prev) => [
              ...prev,
              {
                id: createFeedEntryId("dm-live-error"),
                role: "system",
                text: runtimeMessage,
              },
            ]);
            setCampaignRuntimeStatus(runtimeMessage);
          },
        }
      );

      // Post-await async side effects — isCampaignRuntimeTurnPending stays true here (Slice B)
      // Copy to const so TypeScript control-flow can narrow correctly after the await boundary
      const resolvedTurnOutcome = completedTurnRef.outcome;
      if (resolvedTurnOutcome !== null) {
        const outcome = resolvedTurnOutcome;

        // Inventory mutations with snapshot — avoids stale closure across iterations (Slice E)
        const inventorySnapshot = new Map<string, { id: string; quantity: number }>(
          inventory.map((i) => [i.name.toLowerCase(), { id: i.id, quantity: i.quantity }]),
        );
        const pendingAdds: Array<{ name: string; quantity: number }> = [];

        for (const change of outcome.itemChanges) {
          const key = change.name.toLowerCase();
          if (change.action === "consume" || change.action === "remove") {
            const snapshotEntry = inventorySnapshot.get(key);
            if (snapshotEntry) {
              snapshotEntry.quantity -= change.quantity;
            }
          } else if (change.action === "add") {
            const snapshotEntry = inventorySnapshot.get(key);
            if (snapshotEntry) {
              snapshotEntry.quantity += change.quantity;
            } else {
              const existing = pendingAdds.find((a) => a.name.toLowerCase() === key);
              if (existing) {
                existing.quantity += change.quantity;
              } else {
                pendingAdds.push({ name: change.name, quantity: change.quantity });
              }
            }
          }
        }

        for (const [, snapshotEntry] of inventorySnapshot) {
          const original = inventory.find((i) => i.id === snapshotEntry.id);
          if (!original || snapshotEntry.quantity === original.quantity) continue;
          if (snapshotEntry.quantity <= 0) {
            removeItem(snapshotEntry.id);
          } else {
            updateItem(snapshotEntry.id, { quantity: snapshotEntry.quantity });
          }
        }
        for (const addition of pendingAdds) {
          addItem({ name: addition.name, quantity: addition.quantity, equipped: false, category: "gear" });
        }

        if (outcome.adjudicationRequests.length > 0) {
          await submitAdjudicationRollRequests(outcome.adjudicationRequests);
        }

        // Handle encounter intent
        const encounterIntent = outcome.encounterIntent;
        if (encounterIntent?.requiresEncounterStart === true) {
          const intentKey = encounterIntent.intentKey;
          if (!handledEncounterIntentKeysRef.current.has(intentKey)) {
            const gateOpenedAt = Date.now();
            if (encounterIntent.narrationBlockedUntilResolved) {
              let gateTargetMemberIds = connectedMemberIds;
              if (gateTargetMemberIds.length === 0 && effectivePartyCode) {
                try {
                  const liveMembers = await fetchPartyMembers(effectivePartyCode);
                  gateTargetMemberIds = [
                    ...new Set(liveMembers.members.map((member) => member.id.trim()).filter((id) => id.length > 0)),
                  ];
                } catch {
                  // Keep existing fallback behavior below.
                }
              }

              setEncounterGateConfirmation({ clearConfirmed: false });
              setEncounterGateOverride({ overrideMode: "none" });
              const reason = `Encounter pending: ${encounterIntent.hostileCreatureName}. Resolve required encounter prompts before continuing story turns.`;
              const requiredRolls = getRequiredEncounterRolls(encounterIntent);
              const pendingVisibility = buildEncounterGateVisibilityState({
                reason,
                requiredRolls,
                createdRolls: [],
                failedRolls: [],
                resolvedRolls: [],
                healthReasonCode: "missing_battle_context",
                healthReason: "Waiting for authoritative battle context.",
                gateAgeMs: 0,
                clearEncounterGate: false,
                clearConfirmed: false,
              });
              setEncounterGateVisibility(pendingVisibility);
              setEncounterGateStatus(reason);
              setEncounterGateContext({
                reason,
                requiredRolls,
                createdRolls: [],
                failedRolls: [],
                battleId: null,
                targetMemberIds: gateTargetMemberIds,
                targetPolicyMode: "locked_targets",
                openedAt: gateOpenedAt,
              });
            }

            try {
              let encounterMemberIds = connectedMemberIds;
              if (encounterMemberIds.length === 0 && effectivePartyCode) {
                try {
                  const liveMembers = await fetchPartyMembers(effectivePartyCode);
                  encounterMemberIds = [
                    ...new Set(liveMembers.members.map((member) => member.id.trim()).filter((id) => id.length > 0)),
                  ];
                } catch {
                  // Keep existing fallback behavior below.
                }
              }

              const latestCombatState = effectivePartyCode
                ? (await refreshCombatState(effectivePartyCode)) ?? combatState
                : combatState;

              const encounterOutcome = await orchestrateCampaignEncounterIntent({
                partyCode: effectivePartyCode,
                memberIds: encounterMemberIds,
                combatState: latestCombatState,
                encounterIntent,
                deps: {
                  startPartyInitiative,
                  addCombatNpc: async (code, payload) => {
                    const seed = await buildEncounterNpcSeed(encounterIntent);
                    return addCombatNpc(code, {
                      ...payload,
                      coreStats: seed.coreStats,
                      dummyState: seed.dummyState,
                      visibleStatKeys: seed.visibleStatKeys,
                    });
                  },
                  createPartyRollRequest,
                  refreshCombatState,
                },
              });

              if (effectivePartyCode && encounterOutcome.hostileNpcId) {
                try {
                  const initiativeRoll = Math.floor(Math.random() * 20) + 1;
                  await rollNpcInitiative(effectivePartyCode, encounterOutcome.hostileNpcId, initiativeRoll);
                  await refreshCombatState(effectivePartyCode);
                  setEntries((prev) => [
                    ...prev,
                    {
                      id: createFeedEntryId("npc-initiative-roll"),
                      role: "tool",
                      text: `${encounterOutcome.hostileNpcName ?? encounterIntent.hostileCreatureName} rolled initiative.`,
                    },
                  ]);
                } catch (err: unknown) {
                  // Preserve the active encounter, but expose capability/transport failure.
                  setEntries((prev) => [
                    ...prev,
                    {
                      id: createFeedEntryId("npc-initiative-error"),
                      role: "tool",
                      text: err instanceof Error ? err.message : "NPC initiative could not be recorded.",
                    },
                  ]);
                }
              }

              if (encounterIntent.narrationBlockedUntilResolved) {
                setEncounterGateConfirmation({ clearConfirmed: false });
                setEncounterGateOverride({ overrideMode: "none" });
                const reason = `Encounter pending: ${encounterIntent.hostileCreatureName}. Resolve required encounter prompts before continuing story turns.`;
                const completionCombatState = effectivePartyCode
                  ? (await refreshCombatState(effectivePartyCode)) ?? latestCombatState
                  : latestCombatState;
                const completion = getEncounterRollCompletionState({
                  combatState: completionCombatState,
                  battleId: encounterOutcome.battleId,
                  targetMemberIds: encounterOutcome.targetMemberIds,
                  requiredRolls: encounterOutcome.requiredRolls,
                  targetPolicyMode: "locked_targets",
                });
                const clearEncounterGate =
                  completion.canEvaluate &&
                  encounterOutcome.requiredRolls.length > 0 &&
                  completion.unresolvedRolls.length === 0;
                const nextGateContext = {
                  reason,
                  requiredRolls: encounterOutcome.requiredRolls,
                  createdRolls: encounterOutcome.createdRolls,
                  failedRolls: encounterOutcome.failedRolls,
                  battleId: encounterOutcome.battleId,
                  targetMemberIds: encounterOutcome.targetMemberIds,
                  targetPolicyMode: "locked_targets" as const,
                  confirmedAtMs: undefined,
                  confirmedBy: undefined,
                  confirmationSource: undefined,
                  openedAt: gateOpenedAt,
                };
                const visibility = buildEncounterGateVisibilityState({
                  reason,
                  requiredRolls: encounterOutcome.requiredRolls,
                  createdRolls: encounterOutcome.createdRolls,
                  failedRolls: encounterOutcome.failedRolls,
                  resolvedRolls: completion.resolvedRolls,
                  healthReasonCode: completion.healthReasonCode,
                  healthReason: completion.healthReason,
                  gateAgeMs: encounterIntent.narrationBlockedUntilResolved ? Math.max(0, Date.now() - gateOpenedAt) : 0,
                  clearEncounterGate,
                  clearConfirmed: false,
                });
                setEncounterGateVisibility(visibility);
                setEncounterGateStatus(visibility.isActive ? visibility.reason : "");
                setEncounterGateContext(nextGateContext);
              } else {
                setEncounterGateConfirmation({ clearConfirmed: false });
                setEncounterGateOverride({ overrideMode: "none" });
                setEncounterGateContext(null);
                setEncounterGateVisibility(null);
                setEncounterGateStatus("");
              }

              if (encounterOutcome.handled) {
                handledEncounterIntentKeysRef.current.add(intentKey);
                if (encounterOutcome.hostileNpcId && encounterOutcome.hostileNpcName) {
                  canonicalEncounterActorRegistryRef.current.set(intentKey, {
                    npcId: encounterOutcome.hostileNpcId,
                    name: encounterOutcome.hostileNpcName,
                    sourceType: encounterOutcome.hostileNpcSourceType === "monster" ? "monster" : "manual",
                    sourceId: encounterOutcome.hostileNpcSourceId,
                  });
                }
              }

              const encounterSystemMessage = encounterOutcome.systemMessage;
              if (encounterSystemMessage) {
                setEntries((prev) => [
                  ...prev,
                  {
                    id: createFeedEntryId("encounter-gate-status"),
                    role: "system",
                    text: encounterSystemMessage,
                  },
                ]);
              }

              const encounterToolMessage = encounterOutcome.toolMessage;
              if (encounterToolMessage) {
                setEntries((prev) => [
                  ...prev,
                  {
                    id: createFeedEntryId("encounter-started"),
                    role: "tool",
                    text: encounterToolMessage,
                  },
                ]);
              }
            } catch (encounterError) {
              const encounterMessage = encounterError instanceof Error ? encounterError.message : "Unknown encounter error";
              setEntries((prev) => [
                ...prev,
                {
                  id: createFeedEntryId("encounter-start-failed"),
                  role: "system",
                  text: `Encounter setup failed: ${encounterMessage}`,
                },
              ]);
            }
          }
        }

        setCampaignRuntimeStatus("");
      }

      setIsStreamingResponse(false);
      setStreamingResponseText("");
      return resolvedTurnOutcome !== null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const runtimeMessage = `AI DM turn failed: ${message}`;
      setEntries((prev) => [
        ...prev,
        {
          id: createFeedEntryId("dm-live-error"),
          role: "system",
          text: runtimeMessage,
        },
      ]);
      setCampaignRuntimeStatus(runtimeMessage);
      return false;
    } finally {
      setIsCampaignRuntimeTurnPending(false);
      setIsStreamingResponse(false);
      setStreamingResponseText("");
    }
  }

  function handleQuickAction(action: AiDmQuickActionKey) {
    // For narration-focused actions, call AI with intent text
    if (action === "advance_scene" || action === "offer_choices" || action === "resolve_turn") {
      const intentText = buildQuickActionPlayerIntentText(action);
      if (intentText.trim().length > 0) {
        setPendingChoices([]);
        void handleCampaignRuntimeTurn(intentText, {});
      }
      return;
    }

    // For outcome mutations, use stub execution
    const toolNameByAction: Record<AiDmQuickActionKey, string> = {
      advance_scene: "session.advance_scene",
      offer_choices: "session.offer_choices",
      start_combat: "combat.start_oneoff_encounter",
      resolve_turn: "combat.resolve_turn",
      loot_hook: "outcome.loot_hook",
      end_encounter: "session.end_encounter",
    };
    const toolName = toolNameByAction[action];

    const toolCall = buildOneOffToolCall({
      toolName,
      payload: { sessionId, action },
      sessionId,
    });
    const toolResult = executeOneOffToolCall(toolCall);
    const role = toolResult.status === "rejected" ? "system" : "tool";
    setEntries((prev) => [...prev, { id: createFeedEntryId("action"), role, text: toolResult.outcomeSummary }]);

    const structuredKind =
      toolResult.structuredResult && typeof toolResult.structuredResult.kind === "string"
        ? toolResult.structuredResult.kind
        : undefined;

    setOutcomeState((prev) =>
      reduceOneOffOutcomeState(prev, {
        toolName,
        structuredKind,
        toolStatus: toolResult.status,
        title,
        difficulty,
        stylePreset,
        startInCombat,
      }),
    );
  }

  function handleCombatPanelToolEvent(text: string) {
    setEntries((prev) => [...prev, { id: createFeedEntryId("combat"), role: "tool", text }]);
  }

  function handleApproveHandoff() {
    if (!recap || isHandoffApproved) return;
    setIsHandoffApproved(true);
    setEntries((prev) => [
      ...prev,
      {
        id: createFeedEntryId("handoff-approve"),
        role: "system",
        text: "Handoff payload approved for deferred apply path.",
      },
    ]);
  }

  async function handleApplyHandoff() {
    if (!recap || !canApplyHandoff) return;
    try {
      await upsertArchivedOneOffSession({
        handoff: recap.handoff,
        recapLines: recap.recapLines,
      });
      setEntries((prev) => [
        ...prev,
        {
          id: createFeedEntryId("handoff-apply"),
          role: "tool",
          text: "Local handoff snapshot saved. Server apply remains deferred in this phase.",
        },
      ]);
      await AsyncStorage.removeItem(buildOneOffSessionStateKey(sessionId));
      await clearActiveSession();
      router.replace(AI_DM_ROUTES.adventure.sessions as any);
    } catch {
      setEntries((prev) => [
        ...prev,
        {
          id: createFeedEntryId("handoff-apply-error"),
          role: "system",
          text: "Could not save local handoff snapshot. Deferred apply path remains unchanged.",
        },
      ]);
    }
  }

  async function handleSubmitCampaignScaffold() {
    if (!isCampaignScaffold || isCampaignSubmitting) return;
    setIsCampaignSubmitting(true);
    setCampaignSubmitStatus("Submitting campaign scaffold...");

    try {
      const recapLines = entries
        .slice(-10)
        .map((entry) => entry.text.trim())
        .filter((line) => line.length > 0)
        .slice(0, 20);

      const outcome = await submitCampaignScaffoldDetailed({
        scaffold: {
          schemaVersion: "campaign-scaffold.v1",
          sessionId,
          campaignId: campaignId || sessionId,
          campaignLabel: campaignLabel || title,
          chapterLabel: chapterLabel || "Chapter 1",
          mode: "campaign_scaffold",
          difficulty,
          stylePreset,
          guidanceSource: feedSeed.guidanceSource,
          entryCount: entries.length,
          scaffoldStatus: "active",
        },
        recapLines: recapLines.length > 0 ? recapLines : ["Campaign scaffold session initialized."],
        clientSavedAt: Date.now(),
      });

      const base = outcome.replayed ? "Campaign scaffold replay acknowledged." : "Campaign scaffold submitted.";
      const withTrace = outcome.response.ingestTraceId ? `${base} [trace ${outcome.response.ingestTraceId}]` : base;
      setCampaignSubmitStatus(withTrace);
    } catch (error) {
      if (error instanceof SubmitCampaignScaffoldError) {
        setCampaignSubmitStatus(`Campaign scaffold submit failed: ${error.message}`);
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        setCampaignSubmitStatus(`Campaign scaffold submit failed: ${message}`);
      }
    } finally {
      setIsCampaignSubmitting(false);
    }
  }

  async function handleSubmitCampaignContinuation() {
    if (!isCampaignScaffold || isCampaignContinuationSubmitting) return;
    if (!checkpointBase || checkpointBase.sessionId !== sessionId) {
      setCampaignContinuationSubmitStatus("Load the latest checkpoint before saving. If loading failed, reopen this session and try again.");
      return;
    }
    setIsCampaignContinuationSubmitting(true);
    setCampaignContinuationSubmitStatus("Submitting campaign continuation checkpoint...");

    try {
      const recapLines = entries
        .slice(-12)
        .map((entry) => entry.text.trim())
        .filter((line) => line.length > 0)
        .slice(0, 24);

      const summarySeed = entries
        .slice(-3)
        .map((entry) => entry.text.trim())
        .filter((line) => line.length > 0)
        .join(" ")
        .slice(0, 220);

      const checkpointIndex = Math.max(0, Math.ceil(entries.length / 4));
      const continuityStatus = entries.length > 10 ? "checkpoint" : "active";

      const outcome = await submitCampaignContinuationDetailed({
        continuation: {
          schemaVersion: "campaign-continuation.v1",
          sessionId,
          campaignId: campaignId || sessionId,
          campaignLabel: campaignLabel || title,
          chapterLabel: chapterLabel || "Chapter 1",
          mode: "campaign_continuation",
          difficulty,
          stylePreset,
          guidanceSource: feedSeed.guidanceSource,
          entryCount: entries.length,
          checkpointIndex,
          continuityStatus,
          progressSummary: summarySeed || "Campaign progression checkpoint submitted.",
        },
        recapLines: recapLines.length > 0 ? recapLines : ["Campaign continuation checkpoint submitted."],
        clientSavedAt: Date.now(),
        expectedSubmissionId: checkpointBase.submissionId,
      });

      if (checkpointSessionRef.current !== sessionId) return;
      setCheckpointBase({ sessionId, submissionId: outcome.response.submissionId });
      const base = outcome.replayed ? "Campaign continuation replay acknowledged." : "Campaign continuation submitted.";
      const withTrace = outcome.response.ingestTraceId ? `${base} [trace ${outcome.response.ingestTraceId}]` : base;
      setCampaignContinuationSubmitStatus(withTrace);
      setCampaignContinuationHydrateStatus("Current checkpoint saved to the server.");
    } catch (error) {
      if (error instanceof SubmitCampaignContinuationError) {
        setCampaignContinuationSubmitStatus(`Campaign continuation submit failed: ${error.message}`);
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        setCampaignContinuationSubmitStatus(`Campaign continuation submit failed: ${message}`);
      }
    } finally {
      setIsCampaignContinuationSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView ref={sessionScrollRef} contentContainerStyle={styles.content}>
        <View style={styles.sessionHeader}>
          <AdventureHeaderBackButton destination={AI_DM_ROUTES.adventure.home} />
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(tabs)",
                params: {
                  aiDmReturnSessionId: sessionId,
                  aiDmReturnTitle: title,
                  aiDmReturnMode: mode,
                  aiDmReturnDifficulty: difficulty,
                  aiDmReturnStylePreset: stylePreset,
                  aiDmReturnStartInCombat: startInCombat ? "1" : "0",
                  aiDmReturnGuidance: guidance,
                  aiDmReturnCampaignId: campaignId,
                  aiDmReturnCampaignLabel: campaignLabel,
                  aiDmReturnChapterLabel: chapterLabel,
                },
              } as any)
            }
            style={[styles.sheetBtn, { borderColor: c.border, backgroundColor: c.card }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.sheetBtnText, { color: c.foreground }]}>Character Sheet</Text>
          </TouchableOpacity>
        </View>

        {!isCampaignScaffold ? (
          <>
            <Text style={[styles.title, { color: c.foreground }]}>Adventure Session</Text>
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.label, { color: c.mutedForeground }]}>Title</Text>
              <Text style={[styles.value, { color: c.foreground }]}>{params.title ?? "n/a"}</Text>
              <Text style={[styles.label, { color: c.mutedForeground, marginTop: 8 }]}>Difficulty / Style</Text>
              <Text style={[styles.value, { color: c.foreground }]}>{`${params.difficulty ?? "n/a"} / ${params.stylePreset ?? "n/a"}`}</Text>
            </View>
          </>
        ) : null}

        {!isCampaignScaffold && shouldShowEncounterSnapshot ? (
          <View style={[styles.rollPromptCard, { backgroundColor: c.card, borderColor: c.primary }]}>
            <Text style={[styles.rollPromptTitle, { color: c.foreground }]}>
              {activeOneOffBattleId ? "Combat in progress" : "Encounter controls available"}
            </Text>
            <Text style={[styles.rollPromptBody, { color: c.mutedForeground }]}>
              {activeOneOffBattleId
                ? "Use the combat controls to select a target, roll attacks, and apply outcomes. Story text cannot resolve hits or damage."
                : "An encounter has been detected. Open the controls below to review targets and available actions."}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open combat controls"
              onPress={goToCombatControls}
              style={[styles.rollPromptButton, { backgroundColor: c.primary }]}
              activeOpacity={0.85}
            >
              <Text style={styles.rollPromptButtonText}>Open Combat / Targets</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!isCampaignScaffold && shouldShowEncounterSnapshot ? (
          <View style={styles.encounterGateActionsRow}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go to story"
              onPress={() => sessionScrollRef.current?.scrollTo({ y: 0, animated: true })}
              style={[styles.encounterGateActionBtn, { borderColor: c.border, backgroundColor: c.card }]}>
              <Text style={[styles.encounterGateActionBtnText, { color: c.foreground }]}>Story</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go to combat actions and targets"
              onPress={goToCombatControls}
              style={[styles.encounterGateActionBtn, { borderColor: c.primary, backgroundColor: c.primary + "1A" }]}>
              <Text style={[styles.encounterGateActionBtnText, { color: c.primary }]}>Combat / Targets</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <AiDmSessionFeedShell
          entries={entries}
          guidanceSource={feedSeed.guidanceSource}
          campaignMode={isCampaignScaffold}
          isStreaming={isStreamingResponse}
          streamingText={streamingResponseText}
        />

        {isCampaignScaffold && isCampaignArchiveHydrated && !hasCampaignConversationEntry && !isStreamingResponse && !isCampaignRuntimeTurnPending ? (
          <View style={[styles.kickoffCard, { borderColor: c.border, backgroundColor: c.card }]}>
            {campaignRuntimeStatus ? (
              <Text style={[styles.kickoffError, { color: c.mutedForeground }]}>{campaignRuntimeStatus}</Text>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                autoKickoffAttemptedRef.current = true;
                void handleCampaignRuntimeTurn(guidance.trim() || "Begin the session.", { silent: true });
              }}
              style={[styles.kickoffBtn, { borderColor: c.primary, backgroundColor: c.primary + "1A" }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.kickoffBtnText, { color: c.primary }]}>Begin the session</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isCampaignScaffold && !prologueDone && entries.some((e) => e.role === "dm") && pendingChoices.length === 0 && !isCampaignRuntimeTurnPending ? (
          <TouchableOpacity
            onPress={() => void handleCampaignRuntimeTurn("", { silent: true })}
            style={[styles.continueBtn, { borderColor: c.primary, backgroundColor: c.primary + "1A" }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.continueBtnText, { color: c.primary }]}>Continue the story →</Text>
          </TouchableOpacity>
        ) : null}

        {campaignChoiceOptions.length > 0 ? (
          <View style={[styles.choicesCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.choicesLabel, { color: c.mutedForeground }]}>WHAT DO YOU DO?</Text>
            {campaignChoiceOptions.map((choice, index) => (
              <TouchableOpacity
                key={choice.id}
                onPress={() => handleChoiceSelect(choice.rawChoice)}
                style={[
                  styles.choiceBtn,
                  {
                    borderColor: c.primary,
                    backgroundColor: c.primary + "1A",
                    opacity:
                      isCampaignRuntimeTurnPending || (isCampaignScaffold && !!encounterGateVisibility?.isActive)
                        ? 0.5
                        : 1,
                  },
                ]}
                activeOpacity={0.75}
                disabled={isCampaignRuntimeTurnPending || (isCampaignScaffold && !!encounterGateVisibility?.isActive)}
              >
                <Text style={[styles.choiceIndexText, { color: c.primary }]}>Choice {index + 1}</Text>
                <Text style={[styles.choiceBtnText, { color: c.primary }]}>{choice.label}</Text>
                {choice.detail ? (
                  <Text style={[styles.choiceDetailText, { color: c.mutedForeground }]}>{choice.detail}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {isCampaignScaffold && isCampaignRuntimeTurnPending ? (
          <Text style={[styles.dmThinking, { color: c.mutedForeground }]}>The DM is deciding your fate...</Text>
        ) : null}

        {encounterGateVisibility ? (
          <View style={[styles.encounterGateCard, { borderColor: c.border, backgroundColor: c.card }]}> 
            <Text style={[styles.encounterGateLabel, { color: c.foreground }]}>
              {encounterGateVisibility.isActive ? "Encounter Gate Progress" : "Encounter Gate Cleared"}
            </Text>
            {encounterGateVisibility.isActive && encounterGateVisibility.status !== "cleared" ? (
              <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>{encounterGateVisibility.reason}</Text>
            ) : null}
            <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>Required rolls: {encounterGateVisibility.requiredRolls.join(", ") || "none"}</Text>
            <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>Created rolls: {encounterGateVisibility.createdRolls.join(", ") || "none"}</Text>
            <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>Failed rolls: {encounterGateVisibility.failedRolls.join(", ") || "none"}</Text>
            <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>Resolved rolls: {encounterGateVisibility.resolvedRolls.join(", ") || "none"}</Text>
            <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>Unresolved rolls: {encounterGateVisibility.unresolvedRolls.join(", ") || "none"}</Text>
            <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>{encounterGateVisibility.completionSummary}</Text>
            {typeof encounterGateVisibility.gateAgeMs === "number" && encounterGateVisibility.isActive ? (
              <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>Gate age: {Math.floor(encounterGateVisibility.gateAgeMs / 1000)}s</Text>
            ) : null}
            {encounterGateVisibility.healthReason ? (
              <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>
                Gate health{encounterGateVisibility.healthReasonCode ? ` (${encounterGateVisibility.healthReasonCode})` : ""}: {encounterGateVisibility.healthReason}
              </Text>
            ) : null}
            {encounterGateContext?.targetPolicyMode && encounterGateContext?.targetMemberIds ? (
              <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]} numberOfLines={1}>
                Policy: {encounterGateContext.targetPolicyMode === "live_targets" ? "live" : "locked"} ({encounterGateContext.targetMemberIds.length} tgt{encounterGateContext.targetMemberIds.length === 1 ? "" : "s"})
              </Text>
            ) : null}
            {encounterGateVisibility.timeoutSummary ? (
              <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>Gate timing: {encounterGateVisibility.timeoutSummary}</Text>
            ) : null}
            {encounterGateVisibility.clearConfirmed && typeof encounterGateVisibility.confirmedAtMs === "number" ? (
              <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>
                Confirmed by DM ({encounterGateVisibility.confirmationSource ?? "ui_confirm_action"}) {Math.max(0, Math.floor((Date.now() - encounterGateVisibility.confirmedAtMs) / 1000))}s ago
              </Text>
            ) : null}
            {encounterGateVisibility.overrideMode === "acknowledge_missing_targets" ? (
              <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>
                {encounterGateVisibility.overrideStatus === "active"
                  ? `Override active, expires in ${Math.max(0, Math.ceil(((encounterGateVisibility.overrideExpiresAtMs ?? encounterGateNowMs) - encounterGateNowMs) / 1000))}s`
                  : encounterGateVisibility.overrideStatus === "revoked"
                    ? "Override revoked"
                    : "Override expired, gate re-evaluated"}
              </Text>
            ) : null}
            {encounterGateConfirmation.reopenedAfterConfirmation && encounterGateVisibility.isActive ? (
              <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>Gate reopened after combat update. Re-resolve required prompts.</Text>
            ) : null}
            {encounterGateVisibility.status === "cleared" && !encounterGateVisibility.clearConfirmed ? (
              <Text style={[styles.encounterGateBody, { color: c.mutedForeground }]}>Ready to continue. Confirm and continue to unblock narration.</Text>
            ) : null}
            {encounterGateVisibility.status === "cleared" && !encounterGateVisibility.clearConfirmed ? (
              <View style={styles.encounterGateActionsRow}>
                <TouchableOpacity
                  onPress={handleRefreshEncounterGate}
                  style={[styles.encounterGateActionBtn, { borderColor: c.border, backgroundColor: c.card }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.encounterGateActionBtnText, { color: c.mutedForeground }]}>Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmEncounterGateClear}
                  style={[styles.encounterGateActionBtn, { borderColor: c.primary, backgroundColor: c.primary + "1A" }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.encounterGateActionBtnText, { color: c.primary }]}>Confirm & Continue</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {canAcknowledgeMissingTargetOverride({
              targetPolicyMode: encounterGateContext?.targetPolicyMode,
              healthReasonCode: encounterGateVisibility.healthReasonCode,
              isActive: encounterGateVisibility.isActive,
            }) && encounterGateVisibility.overrideMode === "none" ? (
              <View style={styles.encounterGateActionsRow}>
                <TouchableOpacity
                  onPress={handleAcknowledgeMissingTargetOverride}
                  style={[styles.encounterGateActionBtn, { borderColor: c.primary, backgroundColor: c.primary + "1A" }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.encounterGateActionBtnText, { color: c.primary }]}>Acknowledge Missing Target</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {encounterGateVisibility.overrideMode === "acknowledge_missing_targets" && encounterGateVisibility.overrideStatus === "active" ? (
              <View style={styles.encounterGateActionsRow}>
                <TouchableOpacity
                  onPress={handleRevokeEncounterGateOverride}
                  style={[styles.encounterGateActionBtn, { borderColor: c.destructive, backgroundColor: c.destructive + "1A" }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.encounterGateActionBtnText, { color: c.destructive }]}>Revoke Override</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <Text style={[styles.encounterGateSummary, { color: encounterGateVisibility.isActive ? c.mutedForeground : c.primary }]}>
              {encounterGateVisibility.summary}
            </Text>
          </View>
        ) : null}

        {!isCampaignScaffold && isPartyHydrated && isOneOffSessionHydrated &&
          hasPlayerConversationEntry && (!partyCode?.trim() || !memberId?.trim()) ? (
          <View style={[styles.rollPromptCard, { backgroundColor: c.card, borderColor: c.destructive }]}>
            <Text style={[styles.rollPromptTitle, { color: c.foreground }]}>Session connection missing</Text>
            <Text style={[styles.rollPromptBody, { color: c.mutedForeground }]}>
              Your previous party connection is unavailable. Existing rolls and combat state have not been replaced.
              Reconnect to the original party before continuing this adventure.
            </Text>
          </View>
        ) : null}

        {!isCampaignScaffold && pendingRollRequests.length > 0 ? (
          <View style={[styles.rollPromptCard, { backgroundColor: c.card, borderColor: "#f59e0b55" }]}>
            <View style={styles.rollPromptHeaderRow}>
              <Feather name="target" size={16} color="#f59e0b" />
              <Text style={[styles.rollPromptTitle, { color: c.foreground }]}>DM Roll Request</Text>
            </View>
            {encounterGateVisibility?.isActive ? (
              <Text style={[styles.rollPromptBody, { color: c.mutedForeground }]}>{encounterGateVisibility.reason}</Text>
            ) : (
              <Text style={[styles.rollPromptBody, { color: c.mutedForeground }]}>Roll now to keep the scene moving.</Text>
            )}
            {pendingRollRequests.map((request) => {
              const modifier = getModifierForStatKey(request.statKey);
              const isRolling = rollingRequestId === request.id;
              return (
                <View key={request.id} style={[styles.rollPromptRequestCard, { backgroundColor: c.background, borderColor: "#f59e0b44" }]}>
                  <Text style={[styles.rollPromptRequestTitle, { color: c.foreground }]}>{request.label}</Text>
                  <Text style={[styles.rollPromptBody, { color: c.foreground }]}>{formatRollCheckName(request.statKey)}</Text>
                  <Text style={[styles.rollPromptBody, { color: c.mutedForeground }]}>
                    Your modifier: {modifier >= 0 ? `+${modifier}` : `${modifier}`}
                  </Text>
                  <TouchableOpacity
                    disabled={isRolling}
                    onPress={() => void handlePendingRollResponse(request)}
                    style={[styles.rollPromptButton, { backgroundColor: "#f59e0b", opacity: isRolling ? 0.6 : 1 }]}
                    activeOpacity={0.85}
                  >
                    <Feather name="zap" size={14} color="#fff" />
                    <Text style={styles.rollPromptButtonText}>
                      {isRolling ? "Rolling..." : `Roll d20 + ${modifier >= 0 ? modifier : `(${modifier})`}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : null}

        {!isCampaignScaffold && shouldShowEncounterSnapshot ? (
          <View onLayout={(event) => { combatSectionYRef.current = event.nativeEvent.layout.y; }} style={[styles.encounterSnapshotCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.encounterSnapshotHeaderRow}>
              <Feather name="crosshair" size={16} color={c.primary} />
              <Text style={[styles.encounterSnapshotTitle, { color: c.foreground }]}>Encounter Snapshot</Text>
            </View>
            <PartyMiniList npcNameOverridesById={npcNameOverridesById} />
          </View>
        ) : null}

        {!isCampaignScaffold && shouldShowEncounterSnapshot ? <AiDmCombatTargetPicker /> : null}

        {!isCampaignScaffold && shouldShowEncounterSnapshot ? (
          <View style={[styles.encounterToolsCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.encounterToolsHeaderRow}>
              <Feather name="crosshair" size={16} color={c.primary} />
              <Text style={[styles.encounterToolsTitle, { color: c.foreground }]}>Encounter Actions</Text>
            </View>

            {attacks.length > 0 ? (
              <>
                <Text style={[styles.encounterToolsSectionLabel, { color: c.mutedForeground }]}>ATTACKS</Text>
                {attacks.map((attack) => (
                  <AttackCard key={attack.id} attack={attack} pinned={attack.pinned === true} />
                ))}
              </>
            ) : null}

            {encounterConsumables.length > 0 ? (
              <>
                <Text style={[styles.encounterToolsSectionLabel, { color: c.mutedForeground }]}>CONSUMABLES</Text>
                {encounterConsumables.map((item) => (
                  <ActionCard
                    key={`consumable-${item.id}`}
                    label={item.name}
                    description={item.notes}
                    sourceItemName={item.name}
                    actionType="action"
                    effectType="note"
                    remainingUses={item.quantity}
                    onConsumeUse={() => {
                      const qty = item.quantity ?? 1;
                      updateItem(item.id, { quantity: Math.max(0, qty - 1) });
                    }}
                  />
                ))}
              </>
            ) : null}

            {encounterFeatureActions.actions.length > 0 || encounterCombatActions.actions.length > 0 ? (
              <>
                <Text style={[styles.encounterToolsSectionLabel, { color: ATTACK_COLOR }]}>ACTIONS</Text>
                {encounterFeatureActions.actions.map((feature) => (
                  <ActionCard
                    key={`feature-action-${feature.id}`}
                    label={feature.name}
                    description={feature.description}
                    sourceItemName={feature.source}
                    actionType="action"
                    effectType="feature"
                    maxTargets={feature.maxTargets}
                    pinned={feature.pinned === true}
                  />
                ))}
                {encounterCombatActions.actions.map((effect) => (
                  <ActionCard
                    key={effect.key}
                    label={effect.label}
                    description={effect.description}
                    sourceItemName={effect.itemName}
                    actionType="action"
                    effectType={effect.effectType as any}
                    maxTargets={effect.maxTargets}
                    pinned={effect.pinned === true}
                    remainingUses={effect.uses !== undefined ? (itemActionUses[effect.effectId] ?? effect.uses) : undefined}
                    onConsumeUse={effect.uses !== undefined ? () => useItemEffect(effect.effectId) : undefined}
                  />
                ))}
              </>
            ) : null}

            {encounterFeatureActions.bonus.length > 0 || encounterCombatActions.bonus.length > 0 ? (
              <>
                <Text style={[styles.encounterToolsSectionLabel, { color: BONUS_ACTION_COLOR }]}>BONUS ACTIONS</Text>
                {encounterFeatureActions.bonus.map((feature) => (
                  <ActionCard
                    key={`feature-bonus-${feature.id}`}
                    label={feature.name}
                    description={feature.description}
                    sourceItemName={feature.source}
                    actionType="bonus_action"
                    effectType="feature"
                    maxTargets={feature.maxTargets}
                    pinned={feature.pinned === true}
                  />
                ))}
                {encounterCombatActions.bonus.map((effect) => (
                  <ActionCard
                    key={effect.key}
                    label={effect.label}
                    description={effect.description}
                    sourceItemName={effect.itemName}
                    actionType="bonus_action"
                    effectType={effect.effectType as any}
                    maxTargets={effect.maxTargets}
                    pinned={effect.pinned === true}
                    remainingUses={effect.uses !== undefined ? (itemActionUses[effect.effectId] ?? effect.uses) : undefined}
                    onConsumeUse={effect.uses !== undefined ? () => useItemEffect(effect.effectId) : undefined}
                  />
                ))}
              </>
            ) : null}

            {resources.length > 0 ? (
              <>
                <Text style={[styles.encounterToolsSectionLabel, { color: c.mutedForeground }]}>RESOURCES</Text>
                {resources.map((resource) => {
                  const extraMax = getResourceExtraMax(resource, resourceMaxBonuses);
                  return (
                    <ResourceRow
                      key={`resource-${resource.id}`}
                      resource={resource}
                      extraMax={extraMax}
                      onIncrement={() => incrementResource(resource.id, resource.max + extraMax)}
                      onDecrement={() => decrementResource(resource.id)}
                      onReset={() => resetResource(resource.id, resource.max + extraMax)}
                    />
                  );
                })}
              </>
            ) : null}
          </View>
        ) : null}

        {!isCampaignScaffold ? <AiDmSessionQuickActionsRow onAction={handleQuickAction} /> : null}
        {!isCampaignScaffold ? <AiDmCombatSubmodePanel onToolEvent={handleCombatPanelToolEvent} /> : null}
        {isCampaignScaffold ? null : (
        <AiDmSessionOutcomeShell
          outcomeState={outcomeState}
          recap={recap}
          isHandoffApproved={isHandoffApproved}
          canApplyHandoff={canApplyHandoff}
          onApproveHandoff={handleApproveHandoff}
          onApplyHandoff={() => void handleApplyHandoff()}
          onReset={() => {
            setOutcomeState(createInitialOneOffOutcomeState());
            setIsHandoffApproved(false);
          }}
        />
        )}
        <AiDmSessionInputComposer 
          onSubmit={handleInputSubmit} 
          isPending={isCampaignRuntimeTurnPending}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 14 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  label: { fontSize: 12, fontWeight: "600" },
  value: { fontSize: 14, fontWeight: "700" },
  campaignSubmitBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  campaignSubmitBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  choicesCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  choicesLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 2,
  },
  choiceBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  choiceBtnText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  choiceIndexText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  choiceDetailText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  dmThinking: {
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 4,
  },
  kickoffCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    alignItems: "center",
  },
  kickoffError: {
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
  },
  kickoffBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  kickoffBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  continueBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  encounterGateCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  encounterGateLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  encounterGateBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  encounterGateSummary: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  encounterGateActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  encounterGateActionBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  encounterGateActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  rollPromptCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  rollPromptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rollPromptTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  rollPromptBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  rollPromptRequestCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  rollPromptRequestTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  rollPromptButton: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rollPromptButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  encounterSnapshotCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  encounterSnapshotHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  encounterSnapshotTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  encounterToolsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  encounterToolsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  encounterToolsTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  encounterToolsSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sheetBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
