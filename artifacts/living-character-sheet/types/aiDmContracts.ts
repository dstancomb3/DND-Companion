import type { AiDmSessionJournal, AiDmJournalSummaryRef } from "./aiDmJournal";
import type { AiDmConfirmationPolicyKey } from "./aiDmPolicy";
import type { AiDmStyleConfig } from "./aiDmStyle";

export const AI_DM_MODES = ["solo", "party", "one_off"] as const;
export type AiDmMode = (typeof AI_DM_MODES)[number];

export const AI_DM_SESSION_LIFECYCLE_STATES = ["draft", "active", "paused", "completed", "archived"] as const;
export type AiDmSessionLifecycleState = (typeof AI_DM_SESSION_LIFECYCLE_STATES)[number];

export const AI_DM_ADVENTURE_ROUTE_KEYS = [
  "/adventure",
  "/adventure/new",
  "/adventure/sessions",
  "/adventure/session/[sessionId]",
] as const;

export type AiDmAdventureRouteKey = (typeof AI_DM_ADVENTURE_ROUTE_KEYS)[number];

export interface AiDmAdventureRouteRef {
  routeKey: AiDmAdventureRouteKey;
  sessionId?: string;
  mode?: AiDmMode;
}

export interface AiDmSceneMetadata {
  sceneId: string;
  title?: string;
  locationRefId?: string;
  encounterRefId?: string;
  startedAt?: number;
}

export interface AiDmPendingPromptMetadata {
  promptId: string;
  promptType: "narration" | "choice" | "confirmation" | "tool_follow_up";
  textPreview: string;
  createdAt: number;
}

export interface AiDmPendingChoiceMetadata {
  choiceId: string;
  label: string;
  consequenceHint?: string;
}

export interface AiDmObjectiveRef {
  objectiveId: string;
  label: string;
  status: "active" | "blocked" | "completed";
}

export interface AiDmContinuityRef {
  continuityId: string;
  continuityType: "rolling_recap" | "session_summary" | "arc_summary";
  updatedAt: number;
}

export interface AiDmSessionState {
  sessionId: string;
  mode: AiDmMode;
  lifecycleState: AiDmSessionLifecycleState;
  createdAt: number;
  updatedAt: number;
  styleConfig: AiDmStyleConfig;
  currentScene?: AiDmSceneMetadata;
  pendingPrompt?: AiDmPendingPromptMetadata;
  pendingChoices?: AiDmPendingChoiceMetadata[];
  activeObjectiveRefs: AiDmObjectiveRef[];
  continuityRefs: AiDmContinuityRef[];
  summaryRefs: AiDmJournalSummaryRef[];
}

export interface AiDmPartyMemberSummary {
  memberId: string;
  characterId?: string;
  name: string;
  className?: string;
  level?: number;
  hp?: { current: number; max: number; tempHp?: number };
}

export interface AiDmCharacterResourceSummary {
  memberId: string;
  resources: Array<{ resourceId: string; name: string; current: number; max: number; resetOn?: string }>;
}

export interface AiDmInventorySummaryHook {
  memberId: string;
  itemCount: number;
  equippedCount?: number;
  notableItemIds?: string[];
}

export interface AiDmEncounterSummaryHook {
  battleId?: string;
  inCombat: boolean;
  turnActorId?: string;
  roundNumber?: number;
}

export interface AiDmQuestSummaryHook {
  activeQuestIds?: string[];
  updatedQuestIds?: string[];
}

export interface AiDmNoteSummaryHook {
  recentNoteIds?: string[];
}

export interface AiDmLocationSummaryHook {
  activeLocationIds?: string[];
}

export interface AiDmNpcSummaryHook {
  activeNpcIds?: string[];
}

export interface AiDmRecentEventSummaryHook {
  eventRefs: string[];
  summary?: string;
  lastEventAt?: number;
}

export interface AiDmAuthoritySummary {
  previewOnly: boolean;
  authorityMode: "local_preview_only" | "mixed_authority" | "server_authoritative";
  toolCapabilityKeys?: string[];
}

export interface AiDmToolCapabilitySummary {
  toolName: string;
  supported: boolean;
  requiresConfirmation?: boolean;
}

export interface AiDmRuntimeSnapshot {
  partySummaries: AiDmPartyMemberSummary[];
  resourceSummaries: AiDmCharacterResourceSummary[];
  inventorySummaryHooks: AiDmInventorySummaryHook[];
  encounterSummaryHooks: AiDmEncounterSummaryHook[];
  questSummaryHooks?: AiDmQuestSummaryHook[];
  noteSummaryHooks?: AiDmNoteSummaryHook[];
  locationSummaryHooks?: AiDmLocationSummaryHook[];
  npcSummaryHooks?: AiDmNpcSummaryHook[];
  recentEventSummaryHooks?: AiDmRecentEventSummaryHook[];
  authoritySummary: AiDmAuthoritySummary;
  toolCapabilities?: AiDmToolCapabilitySummary[];
}

export interface AiDmToolCall {
  toolName: string;
  callId: string;
  input: unknown;
  idempotencyKey: string;
  confirmationPolicyKey: AiDmConfirmationPolicyKey;
  requestedBy: {
    actorType: "player" | "dm" | "system";
    actorId?: string;
  };
  authorityScope?: {
    partyCode?: string;
    memberId?: string;
    battleId?: string;
    route?: AiDmAdventureRouteRef;
  };
}

export interface AiDmToolResult {
  status: "applied" | "preview_only" | "rejected" | "error" | "needs_follow_up";
  outcomeSummary: string;
  warnings?: string[];
  emittedEventRefs?: string[];
  requiresFollowUp: boolean;
  structuredResult?: Record<string, unknown>;
}

export interface AiDmSessionRuntimeEnvelope {
  session: AiDmSessionState;
  snapshot: AiDmRuntimeSnapshot;
  journal?: AiDmSessionJournal;
}

// Slice D scaffold: lightweight placeholder contract for supporting-screen awareness,
// intentionally not tied to runtime stores or active session orchestration.
export interface AiDmSessionAwarenessPlaceholder {
  isAiDmActive: boolean;
  sessionId?: string;
  sessionLabel?: string;
  showContextStrip?: boolean;
  returnToSessionPath?: string;
  activeBadgeLabel?: string;
}
