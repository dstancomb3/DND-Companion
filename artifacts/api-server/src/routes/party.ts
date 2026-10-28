import { validateAiRestApproval } from "../lib/restSceneSafety";
import { canTransferNpcGear } from "../lib/lootEligibility";
import { normalizeEncounterDistances } from "../lib/encounterDistances";
import { classifyRepeatedRoll } from "../lib/rollResponseReplay";
import { randomUUID, randomInt } from "node:crypto";
import { parseNpcWeaponDice } from "../lib/npcWeaponDice";
import { validateNpcAttackSpatialAdjudication } from "../lib/npcAttackSpatialAdjudication";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { partySessions, partyMembers } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  CURRENT_PARTY_RUNTIME_SCHEMA_VERSION,
  normalizeRuntimeSnapshotPayload,
  type RuntimeSnapshotPayload,
  type CompanionAdmission,
} from "../lib/partyRuntimeSchema";
import {
  deletePartyRuntimeSnapshot,
  loadPartyRuntimeSnapshot,
  savePartyRuntimeSnapshot,
  type RuntimeExecutor,
} from "../lib/partyRuntimeStore";
import { decideMemberSync, type MemberSyncClock } from "../lib/partySyncGuard";

import { issuePartyHostToken, hasPartyHostToken } from "../lib/partyHostToken";

const router: IRouter = Router();

const ENVIRONMENT_TURN_ID = "environment";

type StatKey =
  | "initiative"
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma"
  | "strength_save"
  | "dexterity_save"
  | "constitution_save"
  | "intelligence_save"
  | "wisdom_save"
  | "charisma_save"
  | "acrobatics"
  | "animal_handling"
  | "arcana"
  | "athletics"
  | "deception"
  | "history"
  | "insight"
  | "intimidation"
  | "investigation"
  | "medicine"
  | "nature"
  | "perception"
  | "performance"
  | "persuasion"
  | "religion"
  | "sleight_of_hand"
  | "stealth"
  | "survival";

interface InitiativeEntry {
  memberId: string;
  initiativeRoll: number;
  initiativeBonus: number;
  initiativeTotal: number;
}

interface RollRequestResponse {
  memberId: string;
  roll: number;
  modifier: number;
  total: number;
  respondedAt: string;
}

interface RollRequest {
  id: string;
  statKey: StatKey;
  label: string;
  targetMemberIds: string[];
  battleId?: string;
  createdAt: string;
  responses: RollRequestResponse[];
}

interface PartyEvent {
  id: string;
  type: string;
  message: string;
  memberId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface LootAssignmentItem {
  name: string;
  quantity: number;
  category: "weapon" | "armor" | "accessory" | "consumable" | "quest" | "magic" | "gear" | "treasure" | "map" | "currency" | "component" | "junk" | "other";
  notes?: string;
  value?: number;
  imageUri?: string;
  imageSource?: "dm" | "player";
  inventoryItem?: Record<string, unknown>;
}

interface LootAssignment {
  id: string;
  targetMemberId: string;
  item: LootAssignmentItem;
  assignedBy?: string;
  assignedAt: string;
  claimedBy?: string;
  claimedAt?: string;
}

interface NotesPayloadQuest {
  id: string;
  name: string;
  type: "main" | "side" | "personal";
  status: "active" | "completed" | "failed";
  description?: string;
  locationTags: string[];
  notes?: string;
  createdAt: number;
  pinned?: boolean;
}

interface NotesPayloadPerson {
  id: string;
  name: string;
  role?: string;
  relationship: "ally" | "neutral" | "hostile" | "unknown";
  description?: string;
  questTags: string[];
  notes?: string;
  createdAt: number;
  pinned?: boolean;
  deceased?: boolean;
  deceasedNote?: string;
}

interface NotesPayloadLocation {
  id: string;
  name: string;
  description?: string;
  mapImageUri?: string;
  questTags: string[];
  notes?: string;
  createdAt: number;
  pinned?: boolean;
}

interface NotesPayloadNote {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  sessionNumber?: number;
  arcName?: string;
  tags?: string[];
  linkedNpcs?: string[];
  linkedLocations?: string[];
  linkedQuests?: string[];
}

interface NotesAssignmentPayload {
  notes?: NotesPayloadNote[];
  quests: NotesPayloadQuest[];
  people: NotesPayloadPerson[];
  locations: NotesPayloadLocation[];
}

interface NotesAssignment {
  id: string;
  targetMemberId: string;
  payload: NotesAssignmentPayload;
  assignedBy?: string;
  assignedAt: string;
  acceptedBy?: string;
  acceptedAt?: string;
  declinedBy?: string;
  declinedAt?: string;
}

type RestType = "short_rest" | "long_rest";

interface RestRequest {
  id: string;
  restType: RestType;
  requestedByMemberId: string;
  targetMemberIds: string[];
  requestedAt: string;
  status: "pending" | "approved" | "denied";
  resolvedAt?: string;
  resolvedBy?: string;
  acknowledgements: string[];
  provisions?: { enabled: boolean; itemIds: string[] };
}

interface PartyMemberCombatStats {
  speed: number;
  initiativeBonus: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

interface PartyMemberDefenses {
  damageResistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
}

interface PartyMemberPresentation {
  themeId?: string | null;
  accentHex?: string | null;
  profileImageUri?: string | null;
}

type CombatNpcStatKey =
  | "speed"
  | "initiativeBonus"
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

interface CombatNpcCoreStats {
  speed: number;
  initiativeBonus: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

interface CombatNpcDummyState {
  maxHp: number;
  currentHp: number;
  armorClass: number;
  actionUsed: boolean;
  bonusActionUsed?: boolean;
  reactionUsed?: boolean;
  movementUsed?: number;
}

interface CombatNpcGearItem {
  id: string;
  name: string;
  category: "weapon" | "armor" | "gear";
  equipped: boolean;
  attackBonus?: number;
  damageDice?: string;
  damageModifier?: number;
  damageType?: string;
  range?: string;
  armorClassBonus?: number;
  notes?: string;
}

interface CombatConditionSummary {
  id: string;
  name: string;
}

interface CombatNpcProjectionMetadata {
  combatantKind: "companion";
  companionId?: string;
  ownerMemberId?: string;
  ownerCharacterId?: string;
}

interface PlayerTurnEconomy {
  actionsUsed: number;
  bonusActionsUsed: number;
  reactionUsed: boolean;
  movementUsedFeet: number;
}

const MAX_SUPPORTED_PARTY_ECONOMY_SLOTS = 2;

interface PartyCombatState {
  partyCode: string;
  schemaVersion: number;
  stateRevision: number;
  activeMemberIds: string[];
  participantBattleById: Record<string, string>;
  encounterDistances: import("../lib/encounterDistances").EncounterDistance[];
  encounterPositions: import("../lib/encounterPositions").EncounterPosition[];
  battleTurnOrderById: Record<string, string[]>;
  turnOrder: string[];
  currentTurnIdByBattle: Record<string, string | null>;
  currentTurnId: string | null;
  includeEnvironment: boolean;
  initiativeByMember: Record<string, InitiativeEntry>;
  combatNpcs: Array<{
    id: string;
    name: string;
    sourceType: "dm-npc" | "character" | "manual" | "monster";
    sourceId?: string;
    disposition: "hostile" | "passive" | "friendly";
    coreStats: CombatNpcCoreStats;
    visibleStatKeys: CombatNpcStatKey[];
    dummyState?: CombatNpcDummyState;
    gear?: CombatNpcGearItem[];
    conditions?: CombatConditionSummary[];
    projection?: CombatNpcProjectionMetadata;
    companionAdmission?: CompanionAdmission;
    createdAt: string;
  }>;
  memberStatsById: Record<string, PartyMemberCombatStats>;
  memberDefensesById: Record<string, PartyMemberDefenses>;
  memberSyncClockById: Record<string, MemberSyncClock>;
  memberPresentationById: Record<string, PartyMemberPresentation>;
  rollRequests: RollRequest[];
  lootAssignments: LootAssignment[];
  noteAssignments: NotesAssignment[];
  restRequests: RestRequest[];
  eventLog: PartyEvent[];
  playerEconomyByMember: Record<string, PlayerTurnEconomy>;
  updatedAt: string;
}

type RemoteApplyAuthorityResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

type ValidatedRemoteOutcome = {
  targetType: "member" | "npc";
  targetId: string;
  hpDamage: number;
  hpHealing: number;
  tempHpAbsorbed: number;
  conditionChanges: ValidatedConditionChange[];
};

type ValidatedConditionChange = {
  effectType: "apply_condition" | "remove_condition";
  conditionName: string;
};

type RemoteOutcomeValidationResult =
  | { ok: true; value: ValidatedRemoteOutcome }
  | { ok: false; error: string };

type RemoteApplyReplayDecision =
  | { kind: "new" }
  | { kind: "replay"; payloadHash?: string }
  | { kind: "conflict"; previousPayloadHash?: string };

type RemoteApplyAcceptedTarget = {
  requestIndex: number;
  value: ValidatedRemoteOutcome;
};

type RemoteApplyRejectedTarget = {
  requestIndex: number;
  targetType?: string;
  targetId?: string;
  reason: string;
};

type RemoteApplyTargetResultEntry = {
  requestIndex: number;
  defeated?: boolean;
  targetType?: string;
  targetId?: string;
  status: "applied" | "skipped_invalid" | "skipped_missing_target" | "skipped_noop";
  reason?: string;
};

type RemoteApplyBatchValidation = {
  accepted: RemoteApplyAcceptedTarget[];
  rejected: RemoteApplyRejectedTarget[];
};

type RemoteOutcomeOperation =
  | {
      kind: "member";
      memberId: string;
      nextHp: number;
      nextTempHp: number;
      nextConditions: CombatConditionSummary[];
    }
  | {
      kind: "npc";
      npcId: string;
      nextHp: number | null;
      nextConditions: CombatConditionSummary[];
    };

const combatStates = new Map<string, PartyCombatState>();
const COMBAT_NPC_STAT_KEYS: CombatNpcStatKey[] = [
  "speed",
  "initiativeBonus",
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

const DEFAULT_COMBAT_NPC_STATS: CombatNpcCoreStats = {
  speed: 30,
  initiativeBonus: 0,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function isCombatNpcStatKey(value: unknown): value is CombatNpcStatKey {
  return typeof value === "string" && COMBAT_NPC_STAT_KEYS.includes(value as CombatNpcStatKey);
}

function normalizeCombatNpcStats(input: unknown): CombatNpcCoreStats {
  const raw = typeof input === "object" && input ? (input as Record<string, unknown>) : {};
  const get = (key: CombatNpcStatKey): number => {
    const value = raw[key];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : DEFAULT_COMBAT_NPC_STATS[key];
  };

  return {
    speed: get("speed"),
    initiativeBonus: get("initiativeBonus"),
    strength: get("strength"),
    dexterity: get("dexterity"),
    constitution: get("constitution"),
    intelligence: get("intelligence"),
    wisdom: get("wisdom"),
    charisma: get("charisma"),
  };
}

function normalizeVisibleNpcStatKeys(input: unknown): CombatNpcStatKey[] {
  if (!Array.isArray(input)) return [];
  const deduped = new Set<CombatNpcStatKey>();
  for (const value of input) {
    if (isCombatNpcStatKey(value)) deduped.add(value);
  }
  return [...deduped];
}

function isDummySourceId(sourceId: unknown): sourceId is string {
  return typeof sourceId === "string" && sourceId.startsWith("dummy:");
}

function parseDummyMetaFromSourceId(sourceId: unknown): { maxHp: number; armorClass: number } | null {
  if (!isDummySourceId(sourceId)) return null;
  const parts = sourceId.split(":");
  const rawMaxHp = Number.parseInt(parts[1] ?? "", 10);
  const rawArmorClass = Number.parseInt(parts[2] ?? "", 10);
  return {
    maxHp: Number.isFinite(rawMaxHp) && rawMaxHp > 0 ? rawMaxHp : 20,
    armorClass: Number.isFinite(rawArmorClass) && rawArmorClass > 0 ? rawArmorClass : 12,
  };
}

function normalizeDummyState(
  input: unknown,
  fallback: { maxHp: number; armorClass: number }
): CombatNpcDummyState {
  const raw = typeof input === "object" && input ? (input as Record<string, unknown>) : {};
  const maxHp = typeof raw.maxHp === "number" && Number.isFinite(raw.maxHp)
    ? Math.max(1, Math.floor(raw.maxHp))
    : fallback.maxHp;
  const armorClass = typeof raw.armorClass === "number" && Number.isFinite(raw.armorClass)
    ? Math.max(1, Math.floor(raw.armorClass))
    : fallback.armorClass;
  const currentHp = typeof raw.currentHp === "number" && Number.isFinite(raw.currentHp)
    ? Math.max(0, Math.min(maxHp, Math.floor(raw.currentHp)))
    : maxHp;
  const actionUsed = typeof raw.actionUsed === "boolean" ? raw.actionUsed : false;
  const bonusActionUsed = typeof raw.bonusActionUsed === "boolean" ? raw.bonusActionUsed : false;
  const reactionUsed = typeof raw.reactionUsed === "boolean" ? raw.reactionUsed : false;
  const movementUsed = typeof raw.movementUsed === "number" && Number.isFinite(raw.movementUsed)
    ? Math.max(0, Math.floor(raw.movementUsed))
    : 0;

  return {
    maxHp,
    currentHp,
    armorClass,
    actionUsed,
    bonusActionUsed,
    reactionUsed,
    movementUsed,
  };
}

function normalizeCombatNpcGear(input: unknown): CombatNpcGearItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => (typeof entry === "object" && entry ? entry as Record<string, unknown> : null))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => {
      const category = entry.category === "weapon" || entry.category === "armor" ? entry.category : "gear";
      const numberOrUndefined = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : undefined;
      return {
        id: typeof entry.id === "string" && entry.id.trim() ? entry.id : generateId(),
        name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : "Gear",
        category,
        equipped: typeof entry.equipped === "boolean" ? entry.equipped : true,
        attackBonus: numberOrUndefined(entry.attackBonus),
        damageDice: typeof entry.damageDice === "string" && entry.damageDice.trim() ? entry.damageDice.trim() : undefined,
        damageModifier: numberOrUndefined(entry.damageModifier),
        damageType: typeof entry.damageType === "string" && entry.damageType.trim() ? entry.damageType.trim() : undefined,
        range: typeof entry.range === "string" && entry.range.trim() ? entry.range.trim() : undefined,
        armorClassBonus: numberOrUndefined(entry.armorClassBonus),
        notes: typeof entry.notes === "string" && entry.notes.trim() ? entry.notes.trim() : undefined,
      };
    });
}

function normalizeCombatConditions(input: unknown): CombatConditionSummary[] {
  if (!Array.isArray(input)) return [];
  const normalized: CombatConditionSummary[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const rawId = (entry as Record<string, unknown>).id;
    const rawName = (entry as Record<string, unknown>).name;
    const id = typeof rawId === "string" ? rawId.trim() : "";
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!id || !name) continue;
    normalized.push({ id, name });
  }
  return normalized;
}

export function normalizeCombatNpcProjection(input: unknown): CombatNpcProjectionMetadata | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  if (record.combatantKind !== "companion") return undefined;

  const readNonEmpty = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  return {
    combatantKind: "companion",
    companionId: readNonEmpty(record.companionId),
    ownerMemberId: readNonEmpty(record.ownerMemberId),
    ownerCharacterId: readNonEmpty(record.ownerCharacterId),
  };
}

function generateCode(): string {
  const adjectives = ["WOLF", "BEAR", "HAWK", "IRON", "GOLD", "DARK", "FIRE", "SAGE", "STORM", "FROST"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}-${num}`;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function hashMemberSyncPayload(payload: {
  characterName: string;
  characterClass: string;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  armorClass: number;
  conditions: unknown;
  coreStats: unknown;
  presentation: unknown;
  damageResistances: unknown;
  damageImmunities: unknown;
  conditionImmunities: unknown;
}): string {
  const normalized = JSON.stringify(payload);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isExpired(lastActivity: Date): boolean {
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return Date.now() - lastActivity.getTime() > twentyFourHours;
}

function buildDefaultCombatState(code: string): PartyCombatState {
  return {
    partyCode: code,
    schemaVersion: CURRENT_PARTY_RUNTIME_SCHEMA_VERSION,
    stateRevision: 0,
    activeMemberIds: [],
    participantBattleById: {},
    encounterDistances: [],
    encounterPositions: [],
    battleTurnOrderById: {},
    turnOrder: [],
    currentTurnIdByBattle: {},
    currentTurnId: null,
    includeEnvironment: true,
    initiativeByMember: {},
    combatNpcs: [],
    memberStatsById: {},
    memberDefensesById: {},
    memberSyncClockById: {},
    memberPresentationById: {},
    rollRequests: [],
    lootAssignments: [],
    noteAssignments: [],
    restRequests: [],
    eventLog: [],
    playerEconomyByMember: {},
    updatedAt: new Date().toISOString(),
  };
}

export function validateRemoteApplyAuthority(input: {
  sourceMemberId: string;
  state: PartyCombatState;
  liveMemberIds: Set<string>;
}): RemoteApplyAuthorityResult {
  if (!input.liveMemberIds.has(input.sourceMemberId)) {
    return { ok: false, status: 403, error: "sourceMemberId is not a live party member" };
  }

  const sourceBattleId = input.state.participantBattleById[input.sourceMemberId];
  if (!sourceBattleId) {
    // Fail closed when we cannot bind actor membership to an active battle context.
    return {
      ok: false,
      status: 403,
      error: "sourceMemberId is not an active participant in party combat",
    };
  }

  const scopedTurn = input.state.currentTurnIdByBattle[sourceBattleId] ?? null;
  const expectedTurnId = scopedTurn ?? input.state.currentTurnId;
  if (!expectedTurnId) {
    // Fail closed when turn ownership cannot be proven from current runtime state.
    return {
      ok: false,
      status: 409,
      error: "Unable to verify turn ownership for remote outcome apply",
    };
  }

  if (expectedTurnId !== input.sourceMemberId) {
    return { ok: false, status: 403, error: "Not source member turn" };
  }

  return { ok: true };
}

export function validateRemotePreviewOutcome(raw: unknown): RemoteOutcomeValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "targetResults entries must be objects" };
  }

  const result = raw as Record<string, unknown>;
  if (result["applyState"] !== "preview_only") {
    return { ok: false, error: "targetResults must only include preview_only outcomes" };
  }

  const authority = result["authority"];
  const authorityReason =
    authority && typeof authority === "object"
      ? (authority as Record<string, unknown>)["reason"]
      : undefined;
  if (authorityReason !== "remote_member_preview_only" && authorityReason !== "remote_npc_preview_only") {
    return { ok: false, error: "targetResults authority reason is not supported for remote apply" };
  }

  const targetType = result["targetType"];
  if (targetType !== "member" && targetType !== "npc") {
    return { ok: false, error: "targetResults targetType must be member or npc" };
  }

  if (
    (targetType === "member" && authorityReason !== "remote_member_preview_only")
    || (targetType === "npc" && authorityReason !== "remote_npc_preview_only")
  ) {
    return { ok: false, error: "targetResults authority reason does not match targetType" };
  }

  const targetId = typeof result["targetId"] === "string" ? result["targetId"].trim() : "";
  if (!targetId) {
    return { ok: false, error: "targetResults targetId is required" };
  }

  const damageBreakdown = result["damageBreakdown"];
  if (damageBreakdown !== undefined && (typeof damageBreakdown !== "object" || !damageBreakdown)) {
    return { ok: false, error: "targetResults damageBreakdown must be an object when provided" };
  }

  const breakdown = (damageBreakdown as Record<string, unknown> | undefined) ?? {};
  const hpDamage = typeof breakdown["hpDamage"] === "number"
    ? Math.max(0, Math.floor(breakdown["hpDamage"] as number))
    : 0;
  const hpHealingFromBreakdown = typeof breakdown["hpHealing"] === "number"
    ? Math.max(0, Math.floor(breakdown["hpHealing"] as number))
    : 0;
  const hpDeltaPreview = typeof result["hpDeltaPreview"] === "number"
    ? Math.floor(result["hpDeltaPreview"] as number)
    : 0;
  const hpHealingFromDelta = hpDeltaPreview > 0 ? hpDeltaPreview : 0;
  const hpHealing = Math.max(hpHealingFromBreakdown, hpHealingFromDelta);
  const tempHpAbsorbed = typeof breakdown["tempHpAbsorbed"] === "number"
    ? Math.max(0, Math.floor(breakdown["tempHpAbsorbed"] as number))
    : 0;

  const conditionChanges: ValidatedConditionChange[] = [];
  const rawConditionResults = result["conditionResults"];
  if (rawConditionResults !== undefined) {
    if (!Array.isArray(rawConditionResults)) {
      return { ok: false, error: "targetResults conditionResults must be an array when provided" };
    }

    for (const rawConditionResult of rawConditionResults) {
      if (!rawConditionResult || typeof rawConditionResult !== "object") {
        return { ok: false, error: "targetResults conditionResults entries must be objects" };
      }

      const conditionResult = rawConditionResult as Record<string, unknown>;
      const status = conditionResult["status"];
      if (status !== "applied" && status !== "removed") {
        continue;
      }

      const effectType = conditionResult["effectType"];
      if (effectType !== "apply_condition" && effectType !== "remove_condition") {
        return {
          ok: false,
          error: "targetResults conditionResults effectType must be apply_condition or remove_condition",
        };
      }

      if (
        (status === "applied" && effectType !== "apply_condition")
        || (status === "removed" && effectType !== "remove_condition")
      ) {
        return {
          ok: false,
          error: "targetResults conditionResults status and effectType are incompatible",
        };
      }

      const conditionName = typeof conditionResult["conditionName"] === "string"
        ? conditionResult["conditionName"].trim()
        : "";
      if (!conditionName) {
        return { ok: false, error: "targetResults conditionResults conditionName is required" };
      }

      conditionChanges.push({
        effectType,
        conditionName,
      });
    }
  }

  if (hpDamage === 0 && hpHealing === 0 && tempHpAbsorbed === 0 && conditionChanges.length === 0) {
    return {
      ok: false,
      error: "targetResults must include non-zero remote damage/healing or supported condition changes",
    };
  }

  return {
    ok: true,
    value: {
      targetType,
      targetId,
      hpDamage,
      hpHealing,
      tempHpAbsorbed,
      conditionChanges,
    },
  };
}

function normalizeConditionName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function conditionKey(input: string): string {
  return normalizeConditionName(input).toLowerCase();
}

function buildConditionId(input: string): string {
  const slug = normalizeConditionName(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `cond:${slug || "condition"}`;
}

function normalizeMemberConditions(input: unknown): CombatConditionSummary[] {
  if (!Array.isArray(input)) return [];

  const normalized: CombatConditionSummary[] = [];
  for (const rawCondition of input) {
    if (typeof rawCondition === "string") {
      const name = normalizeConditionName(rawCondition);
      if (!name) continue;
      normalized.push({ id: buildConditionId(name), name });
      continue;
    }

    if (!rawCondition || typeof rawCondition !== "object") continue;
    const condition = rawCondition as Record<string, unknown>;
    const name = typeof condition["name"] === "string"
      ? normalizeConditionName(condition["name"])
      : "";
    if (!name) continue;
    const id = typeof condition["id"] === "string" && condition["id"].trim().length > 0
      ? condition["id"].trim()
      : buildConditionId(name);
    normalized.push({ id, name });
  }

  return normalized;
}

function applyConditionChanges(
  current: CombatConditionSummary[],
  conditionChanges: ValidatedConditionChange[],
): CombatConditionSummary[] {
  const byKey = new Map<string, CombatConditionSummary>();
  for (const condition of current) {
    const key = conditionKey(condition.name || condition.id);
    if (!key) continue;
    byKey.set(key, condition);
  }

  for (const change of conditionChanges) {
    const normalizedName = normalizeConditionName(change.conditionName);
    const key = conditionKey(normalizedName);
    if (!key) continue;

    if (change.effectType === "apply_condition") {
      byKey.set(key, {
        id: buildConditionId(normalizedName),
        name: normalizedName,
      });
      continue;
    }

    byKey.delete(key);
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function isRemoteApplyReplay(state: PartyCombatState, commandId: string): boolean {
  return state.eventLog.some((entry) => {
    if (entry.type !== "combat_remote_outcome_applied") return false;
    const metadata = entry.metadata;
    if (!metadata || typeof metadata !== "object") return false;
    return (metadata as Record<string, unknown>)["commandId"] === commandId;
  });
}

function compareRemoteOutcomeDeterministic(
  a: RemoteApplyAcceptedTarget,
  b: RemoteApplyAcceptedTarget,
): number {
  if (a.value.targetType !== b.value.targetType) {
    return a.value.targetType.localeCompare(b.value.targetType);
  }
  if (a.value.targetId !== b.value.targetId) {
    return a.value.targetId.localeCompare(b.value.targetId);
  }
  return a.requestIndex - b.requestIndex;
}

export function validateRemotePreviewOutcomeBatch(targetResults: unknown[]): RemoteApplyBatchValidation {
  const accepted: RemoteApplyAcceptedTarget[] = [];
  const rejected: RemoteApplyRejectedTarget[] = [];
  const seenTargets = new Set<string>();

  for (let i = 0; i < targetResults.length; i += 1) {
    const rawResult = targetResults[i];
    const asRecord = rawResult && typeof rawResult === "object"
      ? (rawResult as Record<string, unknown>)
      : null;
    const targetType = typeof asRecord?.targetType === "string" ? asRecord.targetType : undefined;
    const targetId = typeof asRecord?.targetId === "string" ? asRecord.targetId.trim() : undefined;

    const validation = validateRemotePreviewOutcome(rawResult);
    if (!validation.ok) {
      rejected.push({
        requestIndex: i,
        targetType,
        targetId,
        reason: validation.error,
      });
      continue;
    }

    const dedupeKey = `${validation.value.targetType}:${validation.value.targetId}`;
    if (seenTargets.has(dedupeKey)) {
      rejected.push({
        requestIndex: i,
        targetType: validation.value.targetType,
        targetId: validation.value.targetId,
        reason: "targetResults duplicate target is not supported in a single batch",
      });
      continue;
    }

    seenTargets.add(dedupeKey);
    accepted.push({ requestIndex: i, value: validation.value });
  }

  accepted.sort(compareRemoteOutcomeDeterministic);

  return { accepted, rejected };
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

function fnv1aHash36(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildRemoteApplyPayloadHash(input: {
  sourceMemberId: string;
  accepted: RemoteApplyAcceptedTarget[];
  rejected: RemoteApplyRejectedTarget[];
}): string {
  const accepted = input.accepted.map((entry) => ({
    targetType: entry.value.targetType,
    targetId: entry.value.targetId,
    hpDamage: entry.value.hpDamage,
    hpHealing: entry.value.hpHealing,
    tempHpAbsorbed: entry.value.tempHpAbsorbed,
    conditionChanges: entry.value.conditionChanges.map((change) => ({
      effectType: change.effectType,
      conditionName: normalizeConditionName(change.conditionName),
    })),
  }));

  const rejected = input.rejected.map((entry) => ({
    requestIndex: entry.requestIndex,
    targetType: entry.targetType,
    targetId: entry.targetId,
    reason: entry.reason,
  }));

  return fnv1aHash36(stableSerialize({
    sourceMemberId: input.sourceMemberId,
    accepted,
    rejected,
  }));
}

export function evaluateRemoteApplyReplay(
  state: PartyCombatState,
  commandId: string,
  payloadHash: string,
): RemoteApplyReplayDecision {
  for (const entry of state.eventLog) {
    if (entry.type !== "combat_remote_outcome_applied") continue;
    const metadata = entry.metadata;
    if (!metadata || typeof metadata !== "object") continue;
    const metadataRecord = metadata as Record<string, unknown>;
    if (metadataRecord["commandId"] !== commandId) continue;

    const previousPayloadHash = typeof metadataRecord["payloadHash"] === "string"
      ? metadataRecord["payloadHash"]
      : undefined;
    if (!previousPayloadHash || previousPayloadHash === payloadHash) {
      return { kind: "replay", payloadHash: previousPayloadHash };
    }
    return { kind: "conflict", previousPayloadHash };
  }

  return { kind: "new" };
}

export function buildRemoteOutcomeOperations(input: {
  validatedResults: ValidatedRemoteOutcome[];
  memberById: Map<string, Awaited<ReturnType<typeof getLiveMembers>>[number]>;
  state: PartyCombatState;
}): RemoteOutcomeOperation[] {
  const operations: RemoteOutcomeOperation[] = [];

  for (const result of input.validatedResults) {
    const { targetType, targetId, hpDamage, hpHealing, tempHpAbsorbed } = result;

    if (targetType === "member") {
      const member = input.memberById.get(targetId);
      if (!member) continue;

      const nextTempHp = Math.max(0, member.tempHp - tempHpAbsorbed);
      const nextHp = Math.min(member.maxHp, Math.max(0, member.currentHp - hpDamage + hpHealing));
      const currentConditions = normalizeMemberConditions(member.conditions);
      const nextConditions = applyConditionChanges(currentConditions, result.conditionChanges);
      const conditionsChanged = JSON.stringify(nextConditions) !== JSON.stringify(currentConditions);
      if (nextTempHp === member.tempHp && nextHp === member.currentHp && !conditionsChanged) continue;

      operations.push({
        kind: "member",
        memberId: targetId,
        nextHp,
        nextTempHp,
        nextConditions,
      });
      continue;
    }

    const npc = input.state.combatNpcs.find((entry) => entry.id === targetId);
    if (!npc) continue;

    const nextHp = npc.dummyState
      ? Math.min(npc.dummyState.maxHp, Math.max(0, npc.dummyState.currentHp - hpDamage + hpHealing))
      : null;
    const currentConditions = normalizeCombatConditions(npc.conditions);
    const nextConditions = applyConditionChanges(currentConditions, result.conditionChanges);
    const hpChanged = nextHp !== null && npc.dummyState ? nextHp !== npc.dummyState.currentHp : false;
    const conditionsChanged = JSON.stringify(nextConditions) !== JSON.stringify(currentConditions);
    if (!hpChanged && !conditionsChanged) continue;

    operations.push({
      kind: "npc",
      npcId: targetId,
      nextHp,
      nextConditions,
    });
  }

  return operations;
}

function toRuntimeSnapshotPayload(state: PartyCombatState): RuntimeSnapshotPayload {
  return normalizeRuntimeSnapshotPayload(
    state.partyCode,
    {
      partyCode: state.partyCode,
      activeMemberIds: state.activeMemberIds,
      participantBattleById: state.participantBattleById,
      encounterDistances: state.encounterDistances,
      encounterPositions: state.encounterPositions,
      battleTurnOrderById: state.battleTurnOrderById,
      turnOrder: state.turnOrder,
      currentTurnIdByBattle: state.currentTurnIdByBattle,
      currentTurnId: state.currentTurnId,
      includeEnvironment: state.includeEnvironment,
      initiativeByMember: state.initiativeByMember,
      combatNpcs: state.combatNpcs,
      memberStatsById: state.memberStatsById,
      memberDefensesById: state.memberDefensesById,
      memberSyncClockById: state.memberSyncClockById,
      memberPresentationById: state.memberPresentationById,
      rollRequests: state.rollRequests,
      lootAssignments: state.lootAssignments,
      noteAssignments: state.noteAssignments,
      restRequests: state.restRequests,
      eventLog: state.eventLog,
      playerEconomyByMember: state.playerEconomyByMember,
      updatedAt: state.updatedAt,
    },
    state.updatedAt,
  );
}

function hydrateRuntimeSnapshotToCombatState(code: string, snapshot: RuntimeSnapshotPayload): PartyCombatState {
  const normalized = normalizeRuntimeSnapshotPayload(code, snapshot, new Date().toISOString());
  return {
    partyCode: code,
    schemaVersion: CURRENT_PARTY_RUNTIME_SCHEMA_VERSION,
    stateRevision: 0,
    activeMemberIds: normalized.activeMemberIds,
    participantBattleById: normalized.participantBattleById,
    encounterDistances: normalized.encounterDistances,
    encounterPositions: normalized.encounterPositions,
    battleTurnOrderById: normalized.battleTurnOrderById,
    turnOrder: normalized.turnOrder,
    currentTurnIdByBattle: normalized.currentTurnIdByBattle,
    currentTurnId: normalized.currentTurnId,
    includeEnvironment: normalized.includeEnvironment,
    initiativeByMember: normalized.initiativeByMember,
    combatNpcs: normalized.combatNpcs.map((npc) => ({
      ...npc,
      visibleStatKeys: normalizeVisibleNpcStatKeys(npc.visibleStatKeys),
      gear: normalizeCombatNpcGear(npc.gear),
      conditions: normalizeCombatConditions(npc.conditions),
    })),
    memberStatsById: normalized.memberStatsById,
    memberDefensesById: normalized.memberDefensesById,
    memberSyncClockById: normalized.memberSyncClockById,
    memberPresentationById: normalized.memberPresentationById,
    rollRequests: normalized.rollRequests as unknown as RollRequest[],
    lootAssignments: normalized.lootAssignments as unknown as LootAssignment[],
    noteAssignments: normalized.noteAssignments as unknown as NotesAssignment[],
    restRequests: normalized.restRequests as unknown as RestRequest[],
    eventLog: normalized.eventLog as unknown as PartyEvent[],
    playerEconomyByMember: normalized.playerEconomyByMember,
    updatedAt: normalized.updatedAt,
  };
}

// Companion admission/reuse reads committed state, not a possibly in-flight cached mutation.
async function getCommittedCombatState(code: string, executor?: RuntimeExecutor): Promise<PartyCombatState> {
  const durable = await loadPartyRuntimeSnapshot(code, executor);
  if (!durable) return buildDefaultCombatState(code);
  const state = hydrateRuntimeSnapshotToCombatState(code, durable.snapshot);
  state.schemaVersion = durable.schemaVersion;
  state.stateRevision = durable.stateRevision;
  state.updatedAt = durable.updatedAt;
  return state;
}

async function getOrHydrateCombatState(code: string): Promise<PartyCombatState> {
  const cached = combatStates.get(code);
  if (cached) return cached;

  const durable = await loadPartyRuntimeSnapshot(code);
  if (durable) {
    const hydrated = hydrateRuntimeSnapshotToCombatState(code, durable.snapshot);
    hydrated.schemaVersion = durable.schemaVersion;
    hydrated.stateRevision = durable.stateRevision;
    hydrated.updatedAt = durable.updatedAt;
    combatStates.set(code, hydrated);
    return hydrated;
  }

  const state = buildDefaultCombatState(code);
  combatStates.set(code, state);
  return state;
}

function transactionFailureCode(error: unknown): string | undefined {
  let failure = error as { code?: string; cause?: unknown } | undefined;
  for (let depth = 0; failure && depth < 5; depth++) {
    if (failure.code) return failure.code;
    failure = failure.cause as typeof failure;
  }
  return undefined;
}

class CompanionLifecycleError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export class RuntimeConflictError extends Error {
  readonly expectedRevision: number;
  readonly currentRevision: number | null;
  constructor(expectedRevision: number, currentRevision: number | null) {
    super("Runtime state revision conflict");
    this.name = "RuntimeConflictError";
    this.expectedRevision = expectedRevision;
    this.currentRevision = currentRevision;
  }
}

async function persistRuntimeState(code: string, state: PartyCombatState): Promise<void> {
  const expectedRevision = state.stateRevision;
  state.updatedAt = new Date().toISOString();
  const result = await savePartyRuntimeSnapshot({
    partyCode: code,
    snapshot: toRuntimeSnapshotPayload(state),
    expectedRevision,
  });

  if (!result.ok) {
    const latest = await loadPartyRuntimeSnapshot(code);
    if (latest) {
      const hydrated = hydrateRuntimeSnapshotToCombatState(code, latest.snapshot);
      hydrated.schemaVersion = latest.schemaVersion;
      hydrated.stateRevision = latest.stateRevision;
      hydrated.updatedAt = latest.updatedAt;
      combatStates.set(code, hydrated);
    }
    throw new RuntimeConflictError(expectedRevision, result.conflictRevision);
  }

  state.schemaVersion = result.value.schemaVersion;
  state.stateRevision = result.value.stateRevision;
  state.updatedAt = result.value.updatedAt;
  combatStates.set(code, state);
}

function getOrInitPlayerEconomy(state: PartyCombatState, memberId: string): PlayerTurnEconomy {
  if (!state.playerEconomyByMember) state.playerEconomyByMember = {};
  if (!state.playerEconomyByMember[memberId]) {
    state.playerEconomyByMember[memberId] = {
      actionsUsed: 0,
      bonusActionsUsed: 0,
      reactionUsed: false,
      movementUsedFeet: 0,
    };
  }
  return state.playerEconomyByMember[memberId];
}

function parseBoundedEconomyLimit(rawLimit: unknown): number {
  if (typeof rawLimit !== "number" || !Number.isFinite(rawLimit)) return 1;
  const rounded = Math.floor(rawLimit);
  if (rounded < 1) return 1;
  return Math.min(rounded, MAX_SUPPORTED_PARTY_ECONOMY_SLOTS);
}

function appendEvent(
  state: PartyCombatState,
  input: Omit<PartyEvent, "id" | "createdAt">
) {
  const event: PartyEvent = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.eventLog.unshift(event);
  if (state.eventLog.length > 200) {
    state.eventLog = state.eventLog.slice(0, 200);
  }
  state.updatedAt = new Date().toISOString();
}

function resolveCombatParticipantLabel(
  participantId: string | null | undefined,
  members: Array<{ id: string; characterName: string }>,
  state: PartyCombatState
) {
  if (!participantId) return "none";
  if (participantId === ENVIRONMENT_TURN_ID) return "DM";

  const member = members.find((entry) => entry.id === participantId);
  if (member?.characterName?.trim()) return member.characterName.trim();

  const combatNpc = state.combatNpcs.find((entry) => entry.id === participantId);
  if (combatNpc?.name?.trim()) return combatNpc.name.trim();

  return participantId;
}

function sortInitiativeEntries(entries: InitiativeEntry[]) {
  return entries.sort((a, b) => {
    if (b.initiativeTotal !== a.initiativeTotal) return b.initiativeTotal - a.initiativeTotal;
    if (b.initiativeBonus !== a.initiativeBonus) return b.initiativeBonus - a.initiativeBonus;
    return a.memberId.localeCompare(b.memberId);
  });
}

function orderedBattleIdsFromParticipants(
  participantBattleById: Record<string, string>,
  participantIds: string[]
) {
  const battleIds = new Set<string>();
  for (const id of participantIds) {
    const battleId = participantBattleById[id];
    if (battleId) battleIds.add(battleId);
  }
  return [...battleIds].sort((a, b) => a.localeCompare(b));
}

function syncLegacyTurnState(state: PartyCombatState) {
  const primaryBattleId = orderedBattleIdsFromParticipants(
    state.participantBattleById,
    Object.keys(state.participantBattleById)
  )[0] ?? null;

  if (!primaryBattleId) {
    state.turnOrder = [];
    state.currentTurnId = null;
    return;
  }

  state.turnOrder = state.battleTurnOrderById[primaryBattleId] ?? [];
  state.currentTurnId = state.currentTurnIdByBattle[primaryBattleId] ?? null;
}

function rebuildTurnOrder(state: PartyCombatState, liveMemberIds: string[]) {
  const liveSet = new Set(liveMemberIds);
  const activeNpcIds = new Set(state.combatNpcs.filter((npc) => !npc.companionAdmission?.detachedAt).map((npc) => npc.id));

  for (const key of Object.keys(state.initiativeByMember)) {
    if (!liveSet.has(key) && !activeNpcIds.has(key)) delete state.initiativeByMember[key];
  }
  for (const key of Object.keys(state.memberStatsById)) {
    if (!liveSet.has(key)) delete state.memberStatsById[key];
  }
  for (const key of Object.keys(state.memberDefensesById)) {
    if (!liveSet.has(key)) delete state.memberDefensesById[key];
  }
  for (const key of Object.keys(state.memberSyncClockById)) {
    if (!liveSet.has(key)) delete state.memberSyncClockById[key];
  }
  for (const key of Object.keys(state.memberPresentationById)) {
    if (!liveSet.has(key)) delete state.memberPresentationById[key];
  }
  for (const key of Object.keys(state.participantBattleById)) {
    if (!liveSet.has(key) && !activeNpcIds.has(key)) delete state.participantBattleById[key];
  }

  const activeParticipantIds = Object.keys(state.participantBattleById).filter(
    (id) => liveSet.has(id) || activeNpcIds.has(id)
  );
  state.activeMemberIds = activeParticipantIds.filter((id) => liveSet.has(id));

  const rolled = sortInitiativeEntries(Object.values(state.initiativeByMember))
    .map((x) => x.memberId)
    .filter((id) => activeParticipantIds.includes(id));

  const battleIds = orderedBattleIdsFromParticipants(state.participantBattleById, activeParticipantIds);
  state.battleTurnOrderById = Object.fromEntries(
    battleIds.map((battleId) => {
      const participantIds = activeParticipantIds.filter((id) => state.participantBattleById[id] === battleId);
      const rolledIds = rolled.filter((id) => state.participantBattleById[id] === battleId);
      const unrolledIds = participantIds.filter((id) => !rolledIds.includes(id));
      const order = [...rolledIds, ...unrolledIds];
      // The DM acts through NPC turns. Conditions tick at turn boundaries, not in an extra initiative slot.
      return [battleId, order];
    })
  );

  state.currentTurnIdByBattle = Object.fromEntries(
    battleIds.map((battleId) => {
      const order = state.battleTurnOrderById[battleId] ?? [];
      const previousTurnId = state.currentTurnIdByBattle[battleId];
      return [battleId, previousTurnId && order.includes(previousTurnId) ? previousTurnId : order[0] ?? null];
    })
  );
  syncLegacyTurnState(state);

  state.rollRequests = state.rollRequests
    .map((request) => ({
      ...request,
      targetMemberIds: request.targetMemberIds.filter((id) => liveSet.has(id)),
      responses: request.responses.filter((r) => liveSet.has(r.memberId)),
    }))
    .filter((request) => request.targetMemberIds.length > 0);

  state.lootAssignments = state.lootAssignments.filter((assignment) => {
    const targetIsLive = liveSet.has(assignment.targetMemberId);
    const claimantIsLive = assignment.claimedBy ? liveSet.has(assignment.claimedBy) : true;
    return targetIsLive && claimantIsLive;
  });

  state.noteAssignments = state.noteAssignments.filter((assignment) => {
    const targetIsLive = liveSet.has(assignment.targetMemberId);
    const accepterIsLive = assignment.acceptedBy ? liveSet.has(assignment.acceptedBy) : true;
    const declinerIsLive = assignment.declinedBy ? liveSet.has(assignment.declinedBy) : true;
    return targetIsLive && accepterIsLive && declinerIsLive;
  });

  state.restRequests = state.restRequests
    .map((request) => ({
      ...request,
      targetMemberIds: request.targetMemberIds.filter((id) => liveSet.has(id)),
      acknowledgements: request.acknowledgements.filter((id) => liveSet.has(id)),
    }))
    .filter((request) => request.targetMemberIds.length > 0);

  state.updatedAt = new Date().toISOString();
}

function addMemberToActiveEncounter(state: PartyCombatState, memberId: string) {
  if (state.activeMemberIds.includes(memberId)) return;

  state.activeMemberIds = [...state.activeMemberIds, memberId];

  const existingBattleId = selectedBattleIdFromRequest(null, state.activeMemberIds, state.participantBattleById);
  if (existingBattleId) {
    state.participantBattleById[memberId] = existingBattleId;
  }
}

async function ensureActiveSession(code: string) {
  const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));
  if (sessions.length === 0) {
    return { ok: false as const, status: 404, error: "Party session not found" };
  }
  if (isExpired(sessions[0].lastActivityAt)) {
    await db.delete(partySessions).where(eq(partySessions.code, code));
    combatStates.delete(code);
    await deletePartyRuntimeSnapshot(code);
    return { ok: false as const, status: 404, error: "Party session has expired" };
  }
  await db.update(partySessions).set({ lastActivityAt: new Date() }).where(eq(partySessions.code, code));
  return { ok: true as const };
}

async function authorizePartyRead(req: { get(name: string): string | undefined }, code: string, session: { hostTokenHash?: string | null }) {
  const authorization = req.get("authorization");
  if (hasPartyHostToken(authorization, session.hostTokenHash)) return true;
  const memberId = req.get("x-party-member-id");
  if (!memberId) return false;
  const members = await db.select().from(partyMembers).where(
    and(eq(partyMembers.id, memberId), eq(partyMembers.partyCode, code))
  );
  return hasPartyHostToken(authorization, members[0]?.memberTokenHash);
}

async function getLiveMembers(code: string) {
  const members = await db.select().from(partyMembers).where(eq(partyMembers.partyCode, code));
  const state = await getOrHydrateCombatState(code);
  return dedupeMembersWithState(members, state);
}

// A member ID is the identity boundary. Matching names or combat stats do not
// prove that two players are the same character.
export function dedupeMembersWithState<T extends { id: string; characterName: string; characterClass: string; maxHp: number; armorClass: number; updatedAt: Date }>(
  members: T[],
  state: PartyCombatState
): T[] {
  const grouped = new Map<string, T[]>();

  for (const member of members) {
    const identity = member.id;
    const current = grouped.get(identity);
    if (current) current.push(member);
    else grouped.set(identity, [member]);
  }

  const deduped: T[] = [];
  const initiativeAliases: Record<string, InitiativeEntry> = {};
  const statsAliases: Record<string, PartyMemberCombatStats> = {};
  const defensesAliases: Record<string, PartyMemberDefenses> = {};
  const syncClockAliases: Record<string, MemberSyncClock> = {};
  const presentationAliases: Record<string, PartyMemberPresentation> = {};

  for (const candidates of grouped.values()) {
    const canonical = [...candidates].sort((a, b) => {
      const aScore =
        (state.initiativeByMember[a.id] ? 100 : 0) +
        (state.memberStatsById[a.id] ? 50 : 0) +
        (state.memberDefensesById[a.id] ? 30 : 0) +
        (state.memberPresentationById[a.id] ? 20 : 0) +
        a.updatedAt.getTime() / 1_000_000_000_000;
      const bScore =
        (state.initiativeByMember[b.id] ? 100 : 0) +
        (state.memberStatsById[b.id] ? 50 : 0) +
        (state.memberDefensesById[b.id] ? 30 : 0) +
        (state.memberPresentationById[b.id] ? 20 : 0) +
        b.updatedAt.getTime() / 1_000_000_000_000;
      return bScore - aScore;
    })[0];

    const ids = candidates.map((c) => c.id);
    const aliasedInitiative = ids.map((id) => state.initiativeByMember[id]).find(Boolean);
    const aliasedStats = ids.map((id) => state.memberStatsById[id]).find(Boolean);
    const aliasedDefenses = ids.map((id) => state.memberDefensesById[id]).find(Boolean);
    const aliasedSyncClock = ids.map((id) => state.memberSyncClockById[id]).find(Boolean);
    const aliasedPresentation = ids.map((id) => state.memberPresentationById[id]).find(Boolean);

    if (aliasedInitiative) initiativeAliases[canonical.id] = aliasedInitiative;
    if (aliasedStats) statsAliases[canonical.id] = aliasedStats;
    if (aliasedDefenses) defensesAliases[canonical.id] = aliasedDefenses;
    if (aliasedSyncClock) syncClockAliases[canonical.id] = aliasedSyncClock;
    if (aliasedPresentation) presentationAliases[canonical.id] = aliasedPresentation;

    for (const id of ids) {
      if (id === canonical.id) continue;
      delete state.initiativeByMember[id];
      delete state.memberStatsById[id];
      delete state.memberDefensesById[id];
      delete state.memberSyncClockById[id];
      delete state.memberPresentationById[id];
      state.turnOrder = state.turnOrder.filter((turnId) => turnId !== id);
      state.rollRequests = state.rollRequests.map((request) => ({
        ...request,
        targetMemberIds: request.targetMemberIds.filter((memberId) => memberId !== id),
        responses: request.responses.filter((response) => response.memberId !== id),
      }));
    }

    deduped.push(canonical);
  }

  state.initiativeByMember = { ...state.initiativeByMember, ...initiativeAliases };
  state.memberStatsById = { ...state.memberStatsById, ...statsAliases };
  state.memberDefensesById = { ...state.memberDefensesById, ...defensesAliases };
  state.memberSyncClockById = { ...state.memberSyncClockById, ...syncClockAliases };
  state.memberPresentationById = { ...state.memberPresentationById, ...presentationAliases };

  return deduped;
}

router.post("/party/create", async (req, res) => {
  try {
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.select().from(partySessions).where(eq(partySessions.code, code));
      if (existing.length === 0) break;
      if (existing.length > 0 && isExpired(existing[0].lastActivityAt)) {
        await db.delete(partySessions).where(eq(partySessions.code, code));
        break;
      }
      code = generateCode();
      attempts++;
    }

    const { hostToken, hostTokenHash } = issuePartyHostToken();
    await db.insert(partySessions).values({
      code,
      hostTokenHash,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    });

    res.setHeader("Cache-Control", "no-store");
    res.json({ code, hostToken });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    req.log?.error({ err }, "Failed to create party session");
    res.status(500).json({ error: "Failed to create party session" });
  }
});

router.post("/party/join/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));

    if (sessions.length === 0) {
      res.status(404).json({ error: "Party session not found" });
      return;
    }

    if (isExpired(sessions[0].lastActivityAt)) {
      await db.delete(partySessions).where(eq(partySessions.code, code));
      await deletePartyRuntimeSnapshot(code);
      res.status(404).json({ error: "Party session has expired" });
      return;
    }

    await db.update(partySessions).set({ lastActivityAt: new Date() })
      .where(eq(partySessions.code, code));

    const members = await db.select().from(partyMembers).where(eq(partyMembers.partyCode, code));

    res.json({ code, memberCount: members.length });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to join party session" });
  }
});

// Enrollment is open to invite-code holders, but grants a new server identity only.
router.post("/party/:code/register-member", async (req, res) => {
  try {
    const { code } = req.params;
    const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));
    if (sessions.length === 0 || isExpired(sessions[0].lastActivityAt)) {
      res.status(404).json({ error: "Party session not found or expired" });
      return;
    }
    const memberId = randomUUID();
    const { hostToken: memberToken, hostTokenHash: memberTokenHash } = issuePartyHostToken();
    await db.insert(partyMembers).values({
      id: memberId, partyCode: code, memberTokenHash,
      characterName: "Joining player", characterClass: "Unknown",
      currentHp: 0, maxHp: 1, tempHp: 0, armorClass: 10, conditions: [],
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ code, memberId, memberToken });
  } catch (err) {
    req.log?.error({ err }, "Failed to register party member");
    res.status(500).json({ error: "Failed to register party member" });
  }
});

router.put("/party/sync", async (req, res) => {
  try {
    const {
      memberId,
      partyCode,
      characterName,
      characterClass,
      currentHp,
      maxHp,
      tempHp,
      expectedCurrentHp,
      expectedTempHp,
      armorClass,
      conditions,
      coreStats,
      presentation,
      damageResistances,
      damageImmunities,
      conditionImmunities,
      snapshotUpdatedAt,
    } = req.body;

    if (!memberId || !partyCode) {
      res.status(400).json({ error: "memberId and partyCode are required" });
      return;
    }

    const sessions = await db.select().from(partySessions).where(eq(partySessions.code, partyCode));
    if (sessions.length === 0) {
      res.status(404).json({ error: "Party session not found" });
      return;
    }

    const existing = await db.select().from(partyMembers)
      .where(and(eq(partyMembers.id, memberId), eq(partyMembers.partyCode, partyCode)));
    if (!hasPartyHostToken(req.get("authorization"), existing[0]?.memberTokenHash)) {
      res.status(403).json({ code: "party_member_required", error: "Member access is missing or expired. Leave locally and rejoin this party." });
      return;
    }

    if (isExpired(sessions[0].lastActivityAt)) {
      await db.delete(partySessions).where(eq(partySessions.code, partyCode));
      await deletePartyRuntimeSnapshot(partyCode);
      res.status(404).json({ error: "Party session has expired" });
      return;
    }

    const state = await getOrHydrateCombatState(partyCode);
    const incomingSnapshotUpdatedAt =
      typeof snapshotUpdatedAt === "number" && Number.isFinite(snapshotUpdatedAt)
        ? Math.floor(snapshotUpdatedAt)
        : Date.now();
    const incomingPayloadHash = hashMemberSyncPayload({
      characterName: characterName ?? "Unknown",
      characterClass: characterClass ?? "Unknown",
      currentHp: currentHp ?? 0,
      maxHp: maxHp ?? 1,
      tempHp: tempHp ?? 0,
      armorClass: armorClass ?? 10,
      conditions: conditions ?? [],
      coreStats: coreStats ?? null,
      presentation: presentation ?? null,
      damageResistances: damageResistances ?? [],
      damageImmunities: damageImmunities ?? [],
      conditionImmunities: conditionImmunities ?? [],
    });
    const previousSyncClock = state.memberSyncClockById[memberId];

    {
      const decision = decideMemberSync(previousSyncClock, incomingSnapshotUpdatedAt, incomingPayloadHash);
      if (decision.status === "reject_stale") {
        res.status(409).json({
          code: "stale_member_snapshot",
          latestSnapshotUpdatedAt: decision.latestSnapshotUpdatedAt,
          error:
            decision.reason === "timestamp_collision"
              ? "Conflicting member sync payload detected at the same snapshot timestamp."
              : "Member sync payload is stale — refresh latest state before retrying.",
        });
        return;
      }

      if (decision.status === "idempotent_replay") {
        res.json({ ok: true, idempotentReplay: true });
        return;
      }
    }

    const inActiveCombat = Boolean(state.participantBattleById[memberId]);
    const baseMatches = expectedCurrentHp === existing[0].currentHp &&
      expectedTempHp === existing[0].tempHp;
    const hpChanged = currentHp !== existing[0].currentHp || tempHp !== existing[0].tempHp;
    if (inActiveCombat && hpChanged && !baseMatches) {
      res.status(409).json({
        code: "stale_member_snapshot",
        error: "Combat HP changed since this character last observed the server. Refresh before applying a health effect.",
      });
      return;
    }

    const memberData = {
      id: memberId,
      partyCode,
      characterName: characterName ?? "Unknown",
      characterClass: characterClass ?? "Unknown",
      // During an active encounter, HP and temporary HP are owned by the combat executor.
      // A stale character-sheet sync must not silently heal away committed NPC damage.
      currentHp: currentHp ?? 0,
      maxHp: maxHp ?? 1,
      tempHp: tempHp ?? 0,
      armorClass: armorClass ?? 10,
      conditions: conditions ?? [],
      updatedAt: new Date(),
    };

    // Never recreate a removed member, even if removal races this sync.
    const updated = await db.update(partyMembers).set(memberData).where(
      and(eq(partyMembers.id, memberId), eq(partyMembers.partyCode, partyCode),
        eq(partyMembers.memberTokenHash, existing[0].memberTokenHash!))
    ).returning({ id: partyMembers.id });
    if (updated.length === 0) {
      res.status(403).json({ code: "party_member_required", error: "Member access has ended. Rejoin this party." });
      return;
    }

    await db.update(partySessions).set({ lastActivityAt: new Date() })
      .where(eq(partySessions.code, partyCode));

    state.memberStatsById[memberId] = {
      speed: typeof coreStats?.speed === "number" ? Math.floor(coreStats.speed) : 30,
      initiativeBonus:
        typeof coreStats?.initiativeBonus === "number" ? Math.floor(coreStats.initiativeBonus) : 0,
      strength: typeof coreStats?.strength === "number" ? Math.floor(coreStats.strength) : 0,
      dexterity: typeof coreStats?.dexterity === "number" ? Math.floor(coreStats.dexterity) : 0,
      constitution: typeof coreStats?.constitution === "number" ? Math.floor(coreStats.constitution) : 0,
      intelligence: typeof coreStats?.intelligence === "number" ? Math.floor(coreStats.intelligence) : 0,
      wisdom: typeof coreStats?.wisdom === "number" ? Math.floor(coreStats.wisdom) : 0,
      charisma: typeof coreStats?.charisma === "number" ? Math.floor(coreStats.charisma) : 0,
    };
    state.memberDefensesById[memberId] = {
      damageResistances: Array.isArray(damageResistances)
        ? damageResistances.filter((entry): entry is string => typeof entry === "string")
        : [],
      damageImmunities: Array.isArray(damageImmunities)
        ? damageImmunities.filter((entry): entry is string => typeof entry === "string")
        : [],
      conditionImmunities: Array.isArray(conditionImmunities)
        ? conditionImmunities.filter((entry): entry is string => typeof entry === "string")
        : [],
    };
    state.memberSyncClockById[memberId] = {
      snapshotUpdatedAt: incomingSnapshotUpdatedAt,
      payloadHash: incomingPayloadHash,
    };
    state.memberPresentationById[memberId] = {
      themeId: typeof presentation?.themeId === "string" ? presentation.themeId : null,
      accentHex: typeof presentation?.accentHex === "string" ? presentation.accentHex : null,
      profileImageUri: typeof presentation?.profileImageUri === "string" ? presentation.profileImageUri : null,
    };
    state.updatedAt = new Date().toISOString();
    await persistRuntimeState(partyCode, state);

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to sync party member" });
  }
});

router.get("/party/:code/members", async (req, res) => {
  try {
    const { code } = req.params;
    const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));

    if (sessions.length === 0) {
      res.status(404).json({ error: "Party session not found" });
      return;
    }

    if (!await authorizePartyRead(req, code, sessions[0])) {
      res.status(403).json({ code: "party_read_required", error: "Party membership or host access is required to read party state." });
      return;
    }

    if (isExpired(sessions[0].lastActivityAt)) {
      await db.delete(partySessions).where(eq(partySessions.code, code));
      await deletePartyRuntimeSnapshot(code);
      res.status(404).json({ error: "Party session has expired" });
      return;
    }

    await db.update(partySessions).set({ lastActivityAt: new Date() })
      .where(eq(partySessions.code, code));

    const rawMembers = await db.select().from(partyMembers).where(eq(partyMembers.partyCode, code));
    const state = await getOrHydrateCombatState(code);
    const members = dedupeMembersWithState(rawMembers, state);
    rebuildTurnOrder(state, members.map((m) => m.id));
    const membersWithStats = members.map(({ memberTokenHash: _privateHash, ...member }) => ({
      ...member,
      coreStats: state.memberStatsById[member.id] ?? null,
      damageResistances: state.memberDefensesById[member.id]?.damageResistances ?? [],
      damageImmunities: state.memberDefensesById[member.id]?.damageImmunities ?? [],
      conditionImmunities: state.memberDefensesById[member.id]?.conditionImmunities ?? [],
      presentation: state.memberPresentationById[member.id] ?? null,
    }));

    res.json({ code, members: membersWithStats });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to fetch party members" });
  }
});

router.delete("/party/leave", async (req, res) => {
  try {
    const { memberId, partyCode } = req.body;

    if (!memberId || !partyCode) {
      res.status(400).json({ error: "memberId and partyCode are required" });
      return;
    }

    const sessions = await db.select().from(partySessions).where(eq(partySessions.code, partyCode));
    const existing = await db.select().from(partyMembers)
      .where(and(eq(partyMembers.id, memberId), eq(partyMembers.partyCode, partyCode)));
    const header = req.get("authorization");
    const isHost = hasPartyHostToken(header, sessions[0]?.hostTokenHash);
    const isMember = hasPartyHostToken(header, existing[0]?.memberTokenHash);
    if (!isHost && !isMember) {
      res.status(403).json({ code: "party_member_required", error: "Only this member or the original host can remove a player." });
      return;
    }
    // Revalidate proof and clean durable state on one connection. Never derive
    // departure cleanup from a warm or possibly in-flight cache entry.
    await db.transaction(async (tx) => {
      const lockedSessions = await tx.select().from(partySessions)
        .where(eq(partySessions.code, partyCode)).for("update");
      const lockedMembers = await tx.select().from(partyMembers)
        .where(and(eq(partyMembers.id, memberId), eq(partyMembers.partyCode, partyCode))).for("update");
      const hostAllowed = hasPartyHostToken(header, lockedSessions[0]?.hostTokenHash);
      const memberAllowed = hasPartyHostToken(header, lockedMembers[0]?.memberTokenHash);
      if (!hostAllowed && !memberAllowed) {
        throw Object.assign(new Error("Membership proof changed"), { code: "party_member_required" });
      }
      // A host's retry after a lost acknowledgement must not append another
      // event or detach anything belonging to a newly enrolled identity.
      if (lockedMembers.length === 0) return;
      const durable = await loadPartyRuntimeSnapshot(partyCode, tx);
      if (durable) {
        const state = hydrateRuntimeSnapshotToCombatState(partyCode, durable.snapshot);
        state.stateRevision = durable.stateRevision;
        const detachedAt = new Date().toISOString();
        const detachedIds: string[] = [];
        for (const npc of state.combatNpcs) {
          const binding = npc.companionAdmission;
          if (binding?.schemaVersion !== "companion-admission.v1" || binding.memberId !== memberId) continue;
          binding.detachedAt ??= detachedAt;
          detachedIds.push(npc.id);
          delete state.initiativeByMember[npc.id];
          delete state.participantBattleById[npc.id];
          delete state.playerEconomyByMember[npc.id];
        }
        delete state.initiativeByMember[memberId];
        delete state.participantBattleById[memberId];
        delete state.playerEconomyByMember[memberId];
        const remaining = await tx.select().from(partyMembers).where(eq(partyMembers.partyCode, partyCode));
        rebuildTurnOrder(state, remaining.filter(m => m.id !== memberId).map(m => m.id));
        appendEvent(state, {
          type: "party_member_left", memberId,
          message: detachedIds.length
            ? `A party member left; ${detachedIds.length} companion(s) retained outside combat for DM review.`
            : "A party member left the party.",
        });
        const saved = await savePartyRuntimeSnapshot({
          partyCode, snapshot: toRuntimeSnapshotPayload(state), expectedRevision: durable.stateRevision,
        }, tx);
        if (!saved.ok) throw new RuntimeConflictError(durable.stateRevision, saved.conflictRevision);
      }
      await tx.delete(partyMembers).where(
        and(eq(partyMembers.id, memberId), eq(partyMembers.partyCode, partyCode))
      );
    }, { isolationLevel: "serializable" });
    // Publish no transaction-local state. The next read hydrates the committed
    // snapshot, including changes made by another writer after this commit.
    combatStates.delete(partyCode);

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    const code = transactionFailureCode(err);
    if (code === "party_member_required") {
      res.status(403).json({ code, error: "Only this member or the original host can remove a player." });
      return;
    }
    if (code === "40001" || code === "40P01") throw new RuntimeConflictError(0, null);
    res.status(500).json({ error: "Failed to leave party" });
  }
});

router.post("/party/:code/disband", async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      res.status(400).json({ error: "Party code is required" });
      return;
    }

    const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));
    if (sessions.length === 0) {
      res.status(404).json({ error: "Party session not found" });
      return;
    }

    if (!hasPartyHostToken(req.get("authorization"), sessions[0].hostTokenHash)) {
      res.status(403).json({ error: "Only the original party host can disband this party. Older parties must expire or be recreated.", code: "party_host_required" });
      return;
    }

    await db.delete(partyMembers).where(eq(partyMembers.partyCode, code));
    await db.delete(partySessions).where(eq(partySessions.code, code));
    combatStates.delete(code);
    await deletePartyRuntimeSnapshot(code);

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to disband party" });
  }
});

router.get("/party/:code/combat-state", async (req, res) => {
  try {
    const { code } = req.params;
    const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));
    if (sessions.length === 0) {
      res.status(404).json({ error: "Party session not found" });
      return;
    }
    if (!await authorizePartyRead(req, code, sessions[0])) {
      res.status(403).json({ code: "party_read_required", error: "Party membership or host access is required to read party state." });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    // A different API process can commit departure/recovery while this process
    // has a warm cache. Read durable state without exposing in-flight mutations.
    const state = await getCommittedCombatState(code);
    const rawMembers = await db.select().from(partyMembers).where(eq(partyMembers.partyCode, code));
    const members = dedupeMembersWithState(rawMembers, state);
    rebuildTurnOrder(state, members.map((m) => m.id));

    res.json({
      code,
      environmentTurnId: ENVIRONMENT_TURN_ID,
      schemaVersion: state.schemaVersion,
      stateRevision: state.stateRevision,
      currentTurnIdByBattle: state.currentTurnIdByBattle,
      currentTurnId: state.currentTurnId,
      battleTurnOrderById: state.battleTurnOrderById,
      turnOrder: state.turnOrder,
      initiative: Object.values(state.initiativeByMember),
      activeMemberIds: state.activeMemberIds,
      participantBattleById: state.participantBattleById,
      encounterDistances: state.encounterDistances,
      combatNpcs: state.combatNpcs,
      rollRequests: state.rollRequests,
      lootAssignments: state.lootAssignments,
      noteAssignments: state.noteAssignments,
      restRequests: state.restRequests,
      eventLog: state.eventLog,
      playerEconomyByMember: state.playerEconomyByMember ?? {},
      updatedAt: state.updatedAt,
    });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to fetch combat state" });
  }
});

router.put("/party/:code/encounter-positions", async (req, res) => {
  const { code } = req.params;
  const expectedRevision = req.body?.expectedRevision;
  const { normalizeEncounterPositions } = await import("../lib/encounterPositions");
  const positions = normalizeEncounterPositions(req.body?.positions);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
      !Array.isArray(req.body?.positions) || !req.body.positions.length ||
      positions.length !== req.body.positions.length) {
    res.status(400).json({ error: "Valid expected revision and confirmed positions required." }); return;
  }
  try {
    const result = await db.transaction(async tx => {
      const sessions = await tx.select().from(partySessions).where(eq(partySessions.code, code)).for("update");
      if (!hasPartyHostToken(req.get("authorization"), sessions[0]?.hostTokenHash)) {
        throw new CompanionLifecycleError(403, "party_host_required", "Only the original host may confirm encounter positions.");
      }
      if (!sessions[0] || isExpired(sessions[0].lastActivityAt)) {
        throw new CompanionLifecycleError(404, "party_not_found", "Party unavailable.");
      }
      const durable = await loadPartyRuntimeSnapshot(code, tx);
      if (!durable || durable.stateRevision !== expectedRevision)
        throw new RuntimeConflictError(expectedRevision, durable?.stateRevision ?? null);
      const state = hydrateRuntimeSnapshotToCombatState(code, durable.snapshot);
      state.stateRevision = durable.stateRevision;
      for (const p of positions) {
        if (p.source !== "dm_confirmed" || state.participantBattleById[p.combatantId] !== p.battleId)
          throw new CompanionLifecycleError(409, "position_participant_conflict", "Positions must identify current battle participants and have DM confirmation.");
      }
      const keys = new Set(positions.map(p => JSON.stringify([p.battleId, p.combatantId])));
      state.encounterPositions = [
        ...state.encounterPositions.filter(p => !keys.has(JSON.stringify([p.battleId, p.combatantId]))), ...positions,
      ];
      const saved = await savePartyRuntimeSnapshot({
        partyCode: code, snapshot: toRuntimeSnapshotPayload(state), expectedRevision,
      }, tx);
      if (!saved.ok) throw new RuntimeConflictError(expectedRevision, saved.conflictRevision);
      return { revision: saved.value.stateRevision };
    }, { isolationLevel: "serializable" });
    combatStates.delete(code);
    res.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RuntimeConflictError) throw error;
    if (error instanceof CompanionLifecycleError) {
      res.status(error.status).json({ code: error.code, error: error.message }); return;
    }
    res.status(500).json({ error: "Could not commit encounter positions." });
  }
});

router.put("/party/:code/encounter-distances", async (req, res) => {
  const { code } = req.params;
  const expectedRevision = req.body?.expectedRevision;
  const distances = normalizeEncounterDistances(req.body?.distances);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
      !Array.isArray(req.body?.distances) || distances.length !== req.body.distances.length) {
    res.status(400).json({ error: "Valid expected revision and distance observations required." }); return;
  }
  try {
    const result = await db.transaction(async tx => {
      const sessions = await tx.select().from(partySessions).where(eq(partySessions.code, code)).for("update");
      if (!hasPartyHostToken(req.get("authorization"), sessions[0]?.hostTokenHash)) {
        throw new CompanionLifecycleError(403, "party_host_required", "Only the original host may confirm distances.");
      }
      if (!sessions[0] || isExpired(sessions[0].lastActivityAt)) {
        throw new CompanionLifecycleError(404, "party_not_found", "Party unavailable.");
      }
      const durable = await loadPartyRuntimeSnapshot(code, tx);
      if (!durable || durable.stateRevision !== expectedRevision)
        throw new RuntimeConflictError(expectedRevision, durable?.stateRevision ?? null);
      const state = hydrateRuntimeSnapshotToCombatState(code, durable.snapshot);
      state.stateRevision = durable.stateRevision;
      for (const item of distances) {
        if (state.participantBattleById[item.viewerId] !== item.battleId ||
            state.participantBattleById[item.targetId] !== item.battleId)
          throw new CompanionLifecycleError(409, "distance_participant_conflict", "Distance participants must share an active battle.");
      }
      const updatedKeys = new Set(distances.map(item => JSON.stringify([item.battleId, item.viewerId, item.targetId])));
      state.encounterDistances = [
        ...state.encounterDistances.filter(item => !updatedKeys.has(JSON.stringify([item.battleId, item.viewerId, item.targetId]))),
        ...distances,
      ];
      const saved = await savePartyRuntimeSnapshot({
        partyCode: code, snapshot: toRuntimeSnapshotPayload(state), expectedRevision,
      }, tx);
      if (!saved.ok) throw new RuntimeConflictError(expectedRevision, saved.conflictRevision);
      return { revision: saved.value.stateRevision };
    }, { isolationLevel: "serializable" });
    combatStates.delete(code);
    res.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RuntimeConflictError) throw error;
    if (error instanceof CompanionLifecycleError) {
      res.status(error.status).json({ code: error.code, error: error.message }); return;
    }
    res.status(500).json({ error: "Could not commit encounter distances." });
  }
});

router.post("/party/:code/initiative/start", async (req, res) => {
  try {
    const { code } = req.params;
    // Authenticate before session refresh/expiry cleanup or runtime work.
    const access = await authorizePartyHost(code, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const includeEnvironment = req.body?.includeEnvironment !== false;
    const targetMemberIds: string[] | null = Array.isArray(req.body?.targetMemberIds)
      ? req.body.targetMemberIds.filter((id: unknown): id is string => typeof id === "string")
      : null;
    const targetNpcIds: string[] = Array.isArray(req.body?.targetNpcIds)
      ? req.body.targetNpcIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const members = await getLiveMembers(code);
    const validMemberIds = new Set(members.map((m) => m.id));
    const selectedMemberIds = (targetMemberIds && targetMemberIds.length > 0
      ? targetMemberIds.filter((id: string) => validMemberIds.has(id))
      : members.map((m) => m.id));
    const state = await getOrHydrateCombatState(code);
    const validNpcIds = new Set(state.combatNpcs.filter((npc) => !npc.companionAdmission?.detachedAt).map((npc) => npc.id));
    const selectedNpcIds = targetNpcIds.filter((id) => validNpcIds.has(id));
    if (selectedMemberIds.length === 0 && selectedNpcIds.length === 0 && validNpcIds.size === 0) {
      res.status(400).json({ error: "Cannot start initiative with no combat participants" });
      return;
    }

    const battleId = `battle_${generateId()}`;
    const movedFromBattleIds = new Set(
      selectedMemberIds
        .map((id) => state.participantBattleById[id])
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    );
    state.activeMemberIds = [...new Set([...state.activeMemberIds, ...selectedMemberIds])];
    for (const id of selectedMemberIds) {
      state.participantBattleById[id] = battleId;
      delete state.initiativeByMember[id];
    }
    state.includeEnvironment = includeEnvironment;
    // Explicitly selected NPCs always join this battle
    for (const npcId of selectedNpcIds) {
      state.participantBattleById[npcId] = battleId;
    }
    // NPCs that were already in one of the moved-from battles also follow
    for (const npc of state.combatNpcs) {
      if (selectedNpcIds.includes(npc.id)) continue; // already handled above
      const npcBattleId = state.participantBattleById[npc.id];
      if (npcBattleId && movedFromBattleIds.has(npcBattleId)) {
        state.participantBattleById[npc.id] = battleId;
      }
    }
    state.rollRequests = state.rollRequests.filter(
      (request) => request.statKey !== "initiative" || !request.targetMemberIds.some((id) => selectedMemberIds.includes(id))
    );
    rebuildTurnOrder(state, members.map((m) => m.id));
    state.currentTurnIdByBattle[battleId] = state.battleTurnOrderById[battleId]?.[0] ?? null;
    syncLegacyTurnState(state);
    appendEvent(state, {
      type: "initiative_started",
      message: includeEnvironment
        ? `DM started initiative for ${selectedMemberIds.length} player(s) and ${selectedNpcIds.length} NPC(s) with an Environment turn.`
        : `DM started initiative for ${selectedMemberIds.length} player(s) and ${selectedNpcIds.length} NPC(s).`,
      metadata: { battleId, participantCount: selectedMemberIds.length + selectedNpcIds.length },
    });
    await persistRuntimeState(code, state);

    res.json({
      ok: true,
      battleId,
      currentTurnId: state.currentTurnIdByBattle[battleId] ?? null,
      currentTurnIdByBattle: state.currentTurnIdByBattle,
      turnOrder: state.battleTurnOrderById[battleId] ?? [],
      battleTurnOrderById: state.battleTurnOrderById,
    });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to start initiative" });
  }
});

router.put("/party/:code/initiative/roll", async (req, res) => {
  try {
    const { code } = req.params;
    const authMemberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
    if (!authMemberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }
    const access = await authorizePartyMember(code, authMemberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const { memberId, initiativeRoll, initiativeBonus } = req.body ?? {};
    if (!memberId || typeof initiativeRoll !== "number") {
      res.status(400).json({ error: "memberId and initiativeRoll are required" });
      return;
    }

    const roll = Math.max(1, Math.min(20, Math.floor(initiativeRoll)));
    const bonus = typeof initiativeBonus === "number" ? Math.floor(initiativeBonus) : 0;
    const initiativeTotal = Math.max(1, roll + bonus);

    const members = await getLiveMembers(code);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(memberId)) {
      res.status(404).json({ error: "Member not in party" });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const hasActiveEncounter = state.activeMemberIds.length > 0 || state.combatNpcs.length > 0;
    if (hasActiveEncounter) {
      addMemberToActiveEncounter(state, memberId);
    }
    const hasExistingInitiative = !!state.initiativeByMember[memberId];
    const hasPendingInitiativeRequest = state.rollRequests.some(
      (request) =>
        request.statKey === "initiative" &&
        request.targetMemberIds.includes(memberId) &&
        !request.responses.some((response) => response.memberId === memberId)
    );

    if (hasExistingInitiative && !hasPendingInitiativeRequest) {
      res.status(409).json({ error: "Initiative already rolled. Wait for a DM initiative prompt to reroll." });
      return;
    }

    state.initiativeByMember[memberId] = {
      memberId,
      initiativeRoll: roll,
      initiativeBonus: bonus,
      initiativeTotal,
    };
    rebuildTurnOrder(state, memberIds);
    appendEvent(state, {
      type: "initiative_rolled",
      memberId,
      message: `Member rolled initiative ${roll}${bonus >= 0 ? ` + ${bonus}` : ` - ${Math.abs(bonus)}`} = ${initiativeTotal}.`,
      metadata: { roll, bonus, total: initiativeTotal },
    });
    await persistRuntimeState(code, state);

    res.json({
      ok: true,
      initiative: state.initiativeByMember[memberId],
      turnOrder: state.turnOrder,
      battleTurnOrderById: state.battleTurnOrderById,
      currentTurnId: state.currentTurnId,
      currentTurnIdByBattle: state.currentTurnIdByBattle,
    });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to record initiative roll" });
  }
});

/**
 * Host-authorized atomic NPC weapon turn, first executable NPC action family.
 * The AI DM must select from canonical weapon IDs; it cannot supply rolls,
 * damage, attacker modifiers, narration or player HP.
 */
/** NPC movement: atomic, bounded and based on established encounter coordinates. */
router.post("/party/:code/npc-move-turn", async (req, res) => {
  const { code } = req.params;
  const { commandId, battleId, npcId, expectedRevision, destination, stance } = req.body ?? {};
  if (typeof commandId !== "string" || commandId.length < 1 || commandId.length > 128 ||
      typeof battleId !== "string" || !battleId || typeof npcId !== "string" || !npcId ||
      !Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
      !["reposition", "retreat", "seek_cover"].includes(stance) ||
      !destination || typeof destination.xFeet !== "number" || typeof destination.yFeet !== "number" ||
      !Number.isFinite(destination.xFeet) || !Number.isFinite(destination.yFeet) ||
      Math.abs(destination.xFeet) > 10000 || Math.abs(destination.yFeet) > 10000) {
    res.status(400).json({ error: "Valid NPC turn, bounded destination, and stance required." }); return;
  }
  try {
    const result = await db.transaction(async tx => {
      const sessions = await tx.select().from(partySessions).where(eq(partySessions.code, code)).for("update");
      if (!hasPartyHostToken(req.get("authorization"), sessions[0]?.hostTokenHash))
        throw new CompanionLifecycleError(403, "party_host_required", "Only the encounter host controls NPC movement.");
      if (!sessions[0] || isExpired(sessions[0].lastActivityAt))
        throw new CompanionLifecycleError(404, "party_not_found", "Party unavailable.");
      const durable = await loadPartyRuntimeSnapshot(code, tx);
      if (!durable) throw new CompanionLifecycleError(409, "combat_state_missing", "Encounter state unavailable.");
      const state = hydrateRuntimeSnapshotToCombatState(code, durable.snapshot);
      const prior = state.eventLog.find(event => event.type === "npc_move_turn_committed" && event.metadata?.commandId === commandId);
      if (prior) {
        if (prior.metadata?.npcId !== npcId || prior.metadata?.battleId !== battleId ||
          prior.metadata?.stance !== stance ||
          prior.metadata?.xFeet !== destination.xFeet || prior.metadata?.yFeet !== destination.yFeet)
          throw new CompanionLifecycleError(409, "command_id_conflict", "Movement command reused with different parameters.");
        return { replayed: true, receipt: prior.metadata };
      }
      if (durable.stateRevision !== expectedRevision) throw new RuntimeConflictError(expectedRevision, durable.stateRevision);
      if (state.currentTurnIdByBattle[battleId] !== npcId || state.participantBattleById[npcId] !== battleId)
        throw new CompanionLifecycleError(409, "npc_turn_changed", "The NPC no longer owns this turn.");
      const npc = state.combatNpcs.find(entry => entry.id === npcId);
      if (!npc || npc.projection?.combatantKind === "companion" || npc.disposition !== "hostile" ||
        (npc.dummyState?.currentHp ?? 0) <= 0 ||
        npc.conditions?.some(c => /^(stunned|paralyzed|incapacitated|petrified|unconscious|grappled|restrained)$/i.test(c.name)))
        throw new CompanionLifecycleError(409, "npc_unavailable", "This NPC cannot move.");
      // Cover requires an authoritative terrain/obstruction record. Encounter
      // combatant coordinates alone cannot establish that a destination is safe.
      if (stance === "seek_cover") {
        throw new CompanionLifecycleError(409, "cover_geometry_missing",
          "No confirmed cover terrain exists for this NPC movement decision.");
      }
      const current = state.encounterPositions.find(p => p.battleId === battleId && p.combatantId === npcId);
      if (!current || !["dm_confirmed", "grid_authority"].includes(current.source))
        throw new CompanionLifecycleError(409, "position_unconfirmed", "Confirm NPC starting position before movement.");
      const feet = Math.hypot(destination.xFeet - current.xFeet, destination.yFeet - current.yFeet);
      const speed = npc.coreStats.speed;
      if (!Number.isFinite(speed) || speed <= 0 || speed > 200 || feet < 0.01 || feet > speed + 0.001)
        throw new CompanionLifecycleError(422, "movement_out_of_range", "Movement exceeds NPC speed or has no displacement.");
      // Client plans are untrusted: revalidate occupied destinations inside
      // the same transaction that moves the NPC and advances initiative.
      if (state.encounterPositions.some(point => point.battleId === battleId &&
          point.combatantId !== npcId &&
          state.participantBattleById[point.combatantId] === battleId &&
          (point.source === "dm_confirmed" || point.source === "grid_authority") &&
          Math.hypot(point.xFeet - destination.xFeet, point.yFeet - destination.yFeet) < 5)) {
        throw new CompanionLifecycleError(409, "npc_destination_occupied",
          "Another combatant occupies the proposed destination.");
      }
      // A straight-line move may not pass through another occupied square.
      const pathBlocked = state.encounterPositions.some(point => {
        if (point.battleId !== battleId || point.combatantId === npcId ||
            state.participantBattleById[point.combatantId] !== battleId ||
            (point.source !== "dm_confirmed" && point.source !== "grid_authority")) return false;
        const dx = destination.xFeet - current.xFeet;
        const dy = destination.yFeet - current.yFeet;
        const t = Math.max(0, Math.min(1,
          ((point.xFeet - current.xFeet) * dx + (point.yFeet - current.yFeet) * dy) /
          (dx * dx + dy * dy)));
        return Math.hypot(point.xFeet - (current.xFeet + t * dx),
          point.yFeet - (current.yFeet + t * dy)) < 5;
      });
      if (pathBlocked) throw new CompanionLifecycleError(409, "npc_path_blocked",
        "An occupied combatant space blocks the proposed movement path.");
      const order = state.battleTurnOrderById[battleId] ?? [];
      const index = order.indexOf(npcId);
      if (index < 0 || order.length < 2) throw new CompanionLifecycleError(409, "turn_order_invalid", "Cannot advance initiative.");
      state.encounterPositions = state.encounterPositions.map(p => p === current
        ? { ...p, xFeet: destination.xFeet, yFeet: destination.yFeet, source: "dm_confirmed" as const } : p);
      // Distances touching the moved NPC are stale; only confirmed positions remain authoritative.
      state.encounterDistances = state.encounterDistances.filter(d => d.viewerId !== npcId && d.targetId !== npcId);
      const nextTurnId = order[(index + 1) % order.length];
      state.currentTurnIdByBattle[battleId] = nextTurnId;
      syncLegacyTurnState(state);
      const receipt = { commandId, battleId, npcId, stance, xFeet: destination.xFeet,
        yFeet: destination.yFeet, movedFeet: feet, nextTurnId };
      appendEvent(state, { type: "npc_move_turn_committed",
        message: `${npc.name} moves ${Math.round(feet)} feet to ${stance.replace("_", " ")}.`, metadata: receipt });
      const saved = await savePartyRuntimeSnapshot({
        partyCode: code, snapshot: toRuntimeSnapshotPayload(state), expectedRevision,
      }, tx);
      if (!saved.ok) throw new RuntimeConflictError(expectedRevision, saved.conflictRevision);
      return { replayed: false, receipt };
    }, { isolationLevel: "serializable" });
    combatStates.delete(code);
    res.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RuntimeConflictError) throw error;
    if (error instanceof CompanionLifecycleError) {
      res.status(error.status).json({ code: error.code, error: error.message }); return;
    }
    res.status(500).json({ error: "NPC movement could not be committed." });
  }
});

router.post("/party/:code/npc-weapon-turn", async (req, res) => {
  const { code } = req.params;
  const commandId = typeof req.body?.commandId === "string" ? req.body.commandId.trim() : "";
  const battleId = typeof req.body?.battleId === "string" ? req.body.battleId.trim() : "";
  const npcId = typeof req.body?.npcId === "string" ? req.body.npcId.trim() : "";
  const weaponId = typeof req.body?.weaponId === "string" ? req.body.weaponId.trim() : "";
  const targetMemberId = typeof req.body?.targetMemberId === "string" ? req.body.targetMemberId.trim() : "";
  const expectedRevision = req.body?.expectedRevision;
  if (![commandId, battleId, npcId, weaponId, targetMemberId].every(x => x.length > 0 && x.length <= 128) ||
      !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    res.status(400).json({ error: "Valid command, battle, NPC, weapon, target and expected revision are required." });
    return;
  }
  try {
    const receipt = await db.transaction(async tx => {
      const sessions = await tx.select().from(partySessions).where(eq(partySessions.code, code)).for("update");
      if (!hasPartyHostToken(req.get("authorization"), sessions[0]?.hostTokenHash)) {
        throw new CompanionLifecycleError(403, "party_host_required", "Only the original host may execute NPC turns.");
      }
      if (!sessions[0] || isExpired(sessions[0].lastActivityAt)) {
        throw new CompanionLifecycleError(404, "party_not_found", "Party unavailable.");
      }
      const durable = await loadPartyRuntimeSnapshot(code, tx);
      if (!durable) throw new CompanionLifecycleError(409, "combat_state_missing", "No committed combat state.");
      const state = hydrateRuntimeSnapshotToCombatState(code, durable.snapshot);
      state.stateRevision = durable.stateRevision;
      // Idempotency: an already committed command must never re-roll or re-apply HP.
      const replay = state.eventLog.find(entry =>
        entry.type === "npc_weapon_turn_committed" &&
        entry.metadata?.commandId === commandId);
      if (replay) {
        const priorSpatial = replay.metadata?.spatialAdjudication as { distanceFeet?: number } | undefined;
        if (replay.metadata?.battleId !== battleId || replay.metadata?.npcId !== npcId ||
            replay.metadata?.weaponId !== weaponId || replay.metadata?.targetMemberId !== targetMemberId ||
            priorSpatial?.distanceFeet !== req.body?.spatialAdjudication?.distanceFeet) {
          throw new CompanionLifecycleError(409, "command_id_conflict", "Command ID already used with different parameters.");
        }
        return { replayed: true, receipt: replay.metadata };
      }
      if (durable.stateRevision !== expectedRevision) throw new RuntimeConflictError(expectedRevision, durable.stateRevision);
      if (state.currentTurnIdByBattle[battleId] !== npcId || state.participantBattleById[npcId] !== battleId ||
          state.participantBattleById[targetMemberId] !== battleId) {
        throw new CompanionLifecycleError(409, "npc_turn_changed", "NPC turn or target battle changed.");
      }
      const npc = state.combatNpcs.find(entry => entry.id === npcId);
      if (!npc || npc.disposition !== "hostile" || npc.projection?.combatantKind === "companion" ||
          npc.dummyState?.currentHp !== undefined && npc.dummyState.currentHp <= 0 ||
          (npc.conditions ?? []).some(c => /^(incapacitated|stunned|paralyzed|petrified|unconscious)$/i.test(c.name))) {
        throw new CompanionLifecycleError(409, "npc_unavailable", "NPC cannot use this hostile action.");
      }
      const weapon = (npc.gear ?? []).find(entry => entry.id === weaponId && entry.category === "weapon" && entry.equipped);
      const dice = parseNpcWeaponDice(weapon?.damageDice);
      if (!weapon || !dice ||
          !Number.isInteger(weapon.attackBonus) || Math.abs(weapon.attackBonus!) > 40 ||
          !Number.isInteger(weapon.damageModifier ?? 0) || Math.abs(weapon.damageModifier ?? 0) > 40 ||
          !weapon.range?.trim() || !weapon.damageType?.trim()) {
        throw new CompanionLifecycleError(422, "unsupported_npc_weapon", "Equipped weapon lacks supported mechanics.");
      }
      const spatial = validateNpcAttackSpatialAdjudication(weapon.range, req.body?.spatialAdjudication);
      if (!spatial.ok) {
        throw new CompanionLifecycleError(422, spatial.reason,
          "A host DM must verify distance and line of sight before this weapon attack can execute.");
      }
      const targets = await tx.select().from(partyMembers)
        .where(and(eq(partyMembers.id, targetMemberId), eq(partyMembers.partyCode, code))).for("update");
      const target = targets[0];
      if (!target || target.currentHp === null || target.armorClass === null ||
          !Number.isFinite(target.currentHp) || !Number.isFinite(target.armorClass)) {
        throw new CompanionLifecycleError(409, "target_unavailable", "Target has no authoritative HP/AC.");
      }
      const naturalRoll = randomInt(1, 21);
      const hit = naturalRoll === 20 || (naturalRoll !== 1 && naturalRoll + weapon.attackBonus! >= target.armorClass);
      const critical = naturalRoll === 20;
      const count = dice.count * (critical ? 2 : 1), sides = dice.sides;
      let rawDamage = 0;
      if (hit) {
        for (let i = 0; i < count; i++) rawDamage += randomInt(1, sides + 1);
        rawDamage += (weapon.damageModifier ?? 0) + dice.flatModifier;
      }
      const defenses = state.memberDefensesById[targetMemberId];
      const damageType = weapon.damageType.trim().toLowerCase();
      const immune = defenses?.damageImmunities.some(type => type.toLowerCase() === damageType) ?? false;
      const resistant = defenses?.damageResistances.some(type => type.toLowerCase() === damageType) ?? false;
      const appliedDamage = !hit || immune ? 0 : resistant ? Math.floor(Math.max(0, rawDamage) / 2) : Math.max(0, rawDamage);
      const absorbedTempHp = Math.min(Math.max(0, target.tempHp ?? 0), appliedDamage);
      const nextTempHp = Math.max(0, (target.tempHp ?? 0) - absorbedTempHp);
      const nextHp = Math.max(0, target.currentHp - (appliedDamage - absorbedTempHp));
      if (hit) {
        await tx.update(partyMembers).set({ currentHp: nextHp, tempHp: nextTempHp, updatedAt: new Date() })
          .where(and(eq(partyMembers.id, targetMemberId), eq(partyMembers.partyCode, code)));
      }
      const order = state.battleTurnOrderById[battleId] ?? [];
      const idx = order.indexOf(npcId);
      if (idx < 0 || order.length < 2) throw new CompanionLifecycleError(409, "turn_order_invalid", "Initiative order cannot advance.");
      const nextTurnId = order[(idx + 1) % order.length];
      state.currentTurnIdByBattle[battleId] = nextTurnId;
      syncLegacyTurnState(state);
      const result = {
        schemaVersion: 1, status: "committed", commandId, battleId, npcId, weaponId, targetMemberId,
        sourceRevision: durable.stateRevision, committedRevision: durable.stateRevision + 1,
        spatialAdjudication: { source: "host_dm", distanceFeet: spatial.distanceFeet },
        naturalRoll, attackTotal: naturalRoll + weapon.attackBonus!, hit, critical,
        damageApplied: appliedDamage, damageToHp: appliedDamage - absorbedTempHp,
        damageType: weapon.damageType, nextTurnId,
      };
      appendEvent(state, { type: "npc_weapon_turn_committed",
        message: `${npc.name} ${hit ? "hit" : "missed"} ${target.characterName} with ${weapon.name}.`,
        metadata: result });
      const saved = await savePartyRuntimeSnapshot({
        partyCode: code, snapshot: toRuntimeSnapshotPayload(state), expectedRevision: durable.stateRevision,
      }, tx);
      if (!saved.ok) throw new RuntimeConflictError(durable.stateRevision, saved.conflictRevision);
      return { replayed: false, receipt: result };
    }, { isolationLevel: "serializable" });
    combatStates.delete(code);
    res.json({ ok: true, ...receipt });
  } catch (error) {
    if (error instanceof RuntimeConflictError) throw error;
    if (error instanceof CompanionLifecycleError) {
      res.status(error.status).json({ code: error.code, error: error.message }); return;
    }
    const failureCode = transactionFailureCode(error);
    if (failureCode === "40001" || failureCode === "40P01") throw new RuntimeConflictError(expectedRevision, null);
    res.status(500).json({ error: "NPC attack could not commit; refresh before retrying." });
  }
});

router.post("/party/:code/end-turn", async (req, res) => {
  try {
    const { code } = req.params;

    const requestedMemberId = typeof req.body?.memberId === "string" && req.body.memberId.trim().length > 0
      ? req.body.memberId.trim()
      : null;
    const isDmOverride = req.body?.isDmOverride === true;

    const access = await authorizePartyActor(code, requestedMemberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    if (isDmOverride && access.role !== "host") {
      res.status(403).json({ error: "Only the original party host can override turns", code: "party_host_required" });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const members = await getLiveMembers(code);
    const state = await getOrHydrateCombatState(code);
    rebuildTurnOrder(state, members.map((m) => m.id));

    const requestedBattleId = typeof req.body?.battleId === "string" && req.body.battleId.trim().length > 0
      ? req.body.battleId.trim()
      : (access.role === "member" && requestedMemberId ? state.participantBattleById[requestedMemberId] : undefined) ?? orderedBattleIdsFromParticipants(state.participantBattleById, Object.keys(state.participantBattleById))[0] ?? null;

    // Member proof grants only the current turn in that member's own battle.
    if (access.role === "member" && (!requestedMemberId || !requestedBattleId ||
      state.participantBattleById[requestedMemberId] !== requestedBattleId ||
      state.currentTurnIdByBattle[requestedBattleId] !== requestedMemberId)) {
      res.status(403).json({ error: "Not your turn in this battle" });
      return;
    }

    if (!requestedBattleId) {
      state.currentTurnId = null;
      state.currentTurnIdByBattle = {};
      await persistRuntimeState(code, state);
      // turnOrder/currentTurnId are compatibility projections; canonical state is battle-scoped.
      res.json({
        ok: true,
        battleId: null,
        currentTurnId: null,
        currentTurnIdByBattle: {},
        turnOrder: [],
        battleTurnOrderById: {},
      });
      return;
    }

    const battleTurnOrder = state.battleTurnOrderById[requestedBattleId] ?? [];
    if (battleTurnOrder.length === 0) {
      state.currentTurnIdByBattle[requestedBattleId] = null;
      syncLegacyTurnState(state);
      await persistRuntimeState(code, state);
      res.json({
        ok: true,
        battleId: requestedBattleId,
        // currentTurnId/currentTurnIdByBattle remain for compatibility; battle-scoped map is canonical.
        currentTurnId: null,
        currentTurnIdByBattle: state.currentTurnIdByBattle,
        turnOrder: [],
        battleTurnOrderById: state.battleTurnOrderById,
      });
      return;
    }

    const previousTurnId = state.currentTurnIdByBattle[requestedBattleId] ?? null;
    if (req.body?.expectedCurrentTurnId !== undefined && (access.role !== "host" || req.body.expectedCurrentTurnId !== previousTurnId)) {
      res.status(409).json({ code: "turn_changed", error: "The expected combatant is no longer taking this turn." });
      return;
    }
    const idx = previousTurnId ? battleTurnOrder.indexOf(previousTurnId) : -1;
    const nextIdx = idx >= 0 ? (idx + 1) % battleTurnOrder.length : 0;
    state.currentTurnIdByBattle[requestedBattleId] = battleTurnOrder[nextIdx];

    // Phase 1: reset economy for the player whose turn just ended.
    if (
      previousTurnId &&
      previousTurnId !== ENVIRONMENT_TURN_ID &&
      !state.combatNpcs.some((npc) => npc.id === previousTurnId)
    ) {
      const prevEconomy = getOrInitPlayerEconomy(state, previousTurnId);
      prevEconomy.actionsUsed = 0;
      prevEconomy.bonusActionsUsed = 0;
      prevEconomy.reactionUsed = false;
      prevEconomy.movementUsedFeet = 0;
    }

    syncLegacyTurnState(state);
    const nextTurnId = state.currentTurnIdByBattle[requestedBattleId] ?? null;
    appendEvent(state, {
      type: "turn_advanced",
      message: `Turn advanced from ${resolveCombatParticipantLabel(previousTurnId, members, state)} to ${resolveCombatParticipantLabel(nextTurnId, members, state)}.`,
      metadata: { battleId: requestedBattleId, from: previousTurnId, to: nextTurnId },
    });
    await persistRuntimeState(code, state);

    res.json({
      ok: true,
      battleId: requestedBattleId,
      // currentTurnId/currentTurnIdByBattle remain for compatibility; battle-scoped map is canonical.
      currentTurnId: state.currentTurnIdByBattle[requestedBattleId] ?? null,
      currentTurnIdByBattle: state.currentTurnIdByBattle,
      turnOrder: battleTurnOrder,
      battleTurnOrderById: state.battleTurnOrderById,
    });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to end turn" });
  }
});

// Phase 1: economy spend endpoint
router.post("/party/:code/economy/spend", async (req, res) => {
  try {
    const { code } = req.params;

    const memberId = typeof req.body?.memberId === "string" && req.body.memberId.trim().length > 0
      ? req.body.memberId.trim()
      : null;
    if (!memberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }

    const access = await authorizePartyMember(code, memberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const validSlots = ["action", "bonusAction", "reaction", "movement"] as const;
    type EconomySlot = typeof validSlots[number];
    const slot = req.body?.slot as unknown;
    if (typeof slot !== "string" || !(validSlots as readonly string[]).includes(slot)) {
      res.status(400).json({ error: `slot must be one of: ${validSlots.join(", ")}` });
      return;
    }
    const validSlot = slot as EconomySlot;

    const rawAmount = req.body?.amount;
    const amount = typeof rawAmount === "number" && Number.isFinite(rawAmount)
      ? Math.max(1, Math.floor(rawAmount))
      : 1;

    const state = await getOrHydrateCombatState(code);
    const economy = getOrInitPlayerEconomy(state, memberId);

    let appliedActionLimit = 1;
    let appliedBonusActionLimit = 1;

    if (validSlot === "action") {
      appliedActionLimit = parseBoundedEconomyLimit(req.body?.actionLimit);
      const cappedLimit = Math.max(appliedActionLimit, economy.actionsUsed);
      economy.actionsUsed = Math.min(economy.actionsUsed + 1, cappedLimit);
    } else if (validSlot === "bonusAction") {
      appliedBonusActionLimit = parseBoundedEconomyLimit(req.body?.bonusActionLimit);
      const cappedLimit = Math.max(appliedBonusActionLimit, economy.bonusActionsUsed);
      economy.bonusActionsUsed = Math.min(economy.bonusActionsUsed + 1, cappedLimit);
    } else if (validSlot === "reaction") {
      economy.reactionUsed = true;
    } else if (validSlot === "movement") {
      economy.movementUsedFeet += amount;
    }

    appendEvent(state, {
      type: "player_economy_spend",
      message: `Player used ${validSlot}`,
      memberId,
      metadata: {
        slot: validSlot,
        amount,
        ...(validSlot === "action" ? { actionLimit: appliedActionLimit } : {}),
        ...(validSlot === "bonusAction" ? { bonusActionLimit: appliedBonusActionLimit } : {}),
      },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true, economy });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to record economy spend" });
  }
});

// Phase 1: economy reset endpoint
router.post("/party/:code/economy/reset", async (req, res) => {
  try {
    const { code } = req.params;

    const memberId = typeof req.body?.memberId === "string" && req.body.memberId.trim().length > 0
      ? req.body.memberId.trim()
      : null;
    if (!memberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }

    const access = await authorizePartyMember(code, memberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const economy = getOrInitPlayerEconomy(state, memberId);
    economy.actionsUsed = 0;
    economy.bonusActionsUsed = 0;
    economy.reactionUsed = false;
    economy.movementUsedFeet = 0;

    appendEvent(state, {
      type: "player_economy_reset",
      message: "Player turn economy reset",
      memberId,
      metadata: {},
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true, economy });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to reset economy" });
  }
});

router.post("/party/:code/combat/apply-outcomes", async (req, res) => {
  try {
    const { code } = req.params;

    const commandId = typeof req.body?.commandId === "string" ? req.body.commandId.trim() : "";
    const sourceMemberId = typeof req.body?.sourceMemberId === "string" ? req.body.sourceMemberId.trim() : "";
    const targetResults = Array.isArray(req.body?.targetResults) ? req.body.targetResults : [];

    if (!commandId || !sourceMemberId) {
      res.status(400).json({ error: "commandId and sourceMemberId are required" });
      return;
    }

    if (targetResults.length === 0) {
      res.status(400).json({ error: "targetResults are required" });
      return;
    }

    const access = await authorizePartyMember(code, sourceMemberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const members = await getLiveMembers(code);
    const liveMemberIds = new Set(members.map((member) => member.id));

    const authorityCheck = validateRemoteApplyAuthority({
      sourceMemberId,
      state,
      liveMemberIds,
    });
    if (!authorityCheck.ok) {
      res.status(authorityCheck.status).json({ error: authorityCheck.error });
      return;
    }

    const memberById = new Map(members.map((member) => [member.id, member]));

    const batchValidation = validateRemotePreviewOutcomeBatch(targetResults);
    const payloadHash = buildRemoteApplyPayloadHash({
      sourceMemberId,
      accepted: batchValidation.accepted,
      rejected: batchValidation.rejected,
    });

    const replayDecision = evaluateRemoteApplyReplay(state, commandId, payloadHash);
    if (replayDecision.kind === "conflict") {
      res.status(409).json({
        error: "commandId payload conflict",
        commandId,
      });
      return;
    }

    if (replayDecision.kind === "replay") {
      res.json({ ok: true, appliedCount: 0, replayed: true });
      return;
    }

    const operations = buildRemoteOutcomeOperations({
      validatedResults: batchValidation.accepted.map((entry) => entry.value),
      memberById,
      state,
    });

    const operationByKey = new Map<string, RemoteOutcomeOperation>();
    for (const operation of operations) {
      if (operation.kind === "member") {
        operationByKey.set(`member:${operation.memberId}`, operation);
      } else {
        operationByKey.set(`npc:${operation.npcId}`, operation);
      }
    }

    const targetResultsSummary: RemoteApplyTargetResultEntry[] = batchValidation.rejected.map((entry) => ({
      requestIndex: entry.requestIndex,
      targetType: entry.targetType,
      targetId: entry.targetId,
      status: "skipped_invalid",
      reason: entry.reason,
    }));

    let appliedCount = 0;
    for (const acceptedTarget of batchValidation.accepted) {
      const key = `${acceptedTarget.value.targetType}:${acceptedTarget.value.targetId}`;
      const operation = operationByKey.get(key);
      if (!operation) {
        if (acceptedTarget.value.targetType === "member" && !memberById.has(acceptedTarget.value.targetId)) {
          targetResultsSummary.push({
            requestIndex: acceptedTarget.requestIndex,
            targetType: acceptedTarget.value.targetType,
            targetId: acceptedTarget.value.targetId,
            status: "skipped_missing_target",
            reason: "target member not found",
          });
          continue;
        }

        if (acceptedTarget.value.targetType === "npc" && !state.combatNpcs.some((entry) => entry.id === acceptedTarget.value.targetId)) {
          targetResultsSummary.push({
            requestIndex: acceptedTarget.requestIndex,
            targetType: acceptedTarget.value.targetType,
            targetId: acceptedTarget.value.targetId,
            status: "skipped_missing_target",
            reason: "target npc not found",
          });
          continue;
        }

        targetResultsSummary.push({
          requestIndex: acceptedTarget.requestIndex,
          targetType: acceptedTarget.value.targetType,
          targetId: acceptedTarget.value.targetId,
          status: "skipped_noop",
          reason: "no remote state change",
        });
        continue;
      }

      if (operation.kind === "member") {
        const member = memberById.get(operation.memberId);
        if (!member) {
          targetResultsSummary.push({
            requestIndex: acceptedTarget.requestIndex,
            targetType: "member",
            targetId: operation.memberId,
            status: "skipped_missing_target",
            reason: "target member not found",
          });
          continue;
        }
        await db
          .update(partyMembers)
          .set({
            tempHp: operation.nextTempHp,
            currentHp: operation.nextHp,
            conditions: operation.nextConditions,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(partyMembers.id, member.id),
              eq(partyMembers.partyCode, code),
            ),
          );

        memberById.set(operation.memberId, {
          ...member,
          tempHp: operation.nextTempHp,
          currentHp: operation.nextHp,
          conditions: operation.nextConditions,
          updatedAt: new Date(),
        });
        appliedCount += 1;
        targetResultsSummary.push({
          requestIndex: acceptedTarget.requestIndex,
          targetType: "member",
          targetId: operation.memberId,
          status: "applied",
          defeated: member.currentHp > 0 && operation.nextHp === 0,
        });
        continue;
      }

      const npc = state.combatNpcs.find((entry) => entry.id === operation.npcId);
      if (!npc) {
        targetResultsSummary.push({
          requestIndex: acceptedTarget.requestIndex,
          targetType: "npc",
          targetId: operation.npcId,
          status: "skipped_missing_target",
          reason: "target npc not found",
        });
        continue;
      }
      const npcWasStanding = typeof npc.dummyState?.currentHp === "number" && npc.dummyState.currentHp > 0;
      if (npc.dummyState && operation.nextHp !== null) {
        npc.dummyState.currentHp = operation.nextHp;
      }
      if (npcWasStanding && operation.nextHp === 0) {
        appendEvent(state, { type: "npc_defeated", message: `${npc.name} was defeated.`,
          memberId: sourceMemberId, metadata: { npcId: npc.id, commandId } });
      }
      npc.conditions = operation.nextConditions;
      appliedCount += 1;
      targetResultsSummary.push({
        requestIndex: acceptedTarget.requestIndex,
        targetType: "npc",
        targetId: operation.npcId,
        status: "applied",
        ...(operation.nextHp !== null ? { defeated: npcWasStanding && operation.nextHp === 0 } : {}),
      });
    }

    // Reconcile battle completion from authoritative HP, not just a newly
    // emitted defeat event. An earlier failed closure must be recoverable on
    // the next committed NPC outcome without reviving the combat loop.
    const affectedBattleIds = new Set(targetResultsSummary
      .filter(row => row.targetType === "npc" && row.status === "applied")
      .map(row => state.participantBattleById[row.targetId])
      .filter((id): id is string => typeof id === "string" && !!id));
    for (const battleId of affectedBattleIds) {
      const hostiles = state.combatNpcs.filter(npc =>
        state.participantBattleById[npc.id] === battleId && npc.disposition === "hostile");
      if (!hostiles.length || hostiles.some(npc => npc.dummyState?.currentHp === undefined ||
          npc.dummyState.currentHp > 0)) continue;
      const participantIds = Object.keys(state.participantBattleById)
        .filter(id => state.participantBattleById[id] === battleId);
      for (const id of participantIds) {
        delete state.participantBattleById[id];
        delete state.initiativeByMember[id];
      }
      state.activeMemberIds = state.activeMemberIds.filter(id => !participantIds.includes(id));
      delete state.battleTurnOrderById[battleId];
      delete state.currentTurnIdByBattle[battleId];
      appendEvent(state, { type: "encounter_ended",
        message: "The last hostile falls. Combat ends; defeated enemies can still be looted.",
        metadata: { battleId, cause: "all_hostiles_defeated" } });
    }
    // Completion clears the authoritative battle, not the corpse instances.
    syncLegacyTurnState(state);

    targetResultsSummary.sort((a, b) => a.requestIndex - b.requestIndex);

    appendEvent(state, {
      type: "combat_remote_outcome_applied",
      message: `Applied ${appliedCount} remote combat target outcome(s).`,
      memberId: sourceMemberId,
      metadata: {
        commandId,
        sourceMemberId,
        appliedCount,
        payloadHash,
      },
    });
    await persistRuntimeState(code, state);

    res.json({
      ok: true,
      appliedCount,
      replayed: false,
      targetResults: targetResultsSummary,
    });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to apply remote combat outcomes" });
  }
});

router.post("/party/:code/roll-requests", async (req, res) => {
    try {
      const { code } = req.params;
      // A requested target or AI DM label is not authority to issue prompts.
      const access = await authorizePartyHost(code, req.get("authorization"), "create roll prompts");
      if (!access.ok) {
        res.status(access.status).json({ error: access.error, code: access.code });
        return;
      }
      const session = await ensureActiveSession(code);
      if (!session.ok) {
        res.status(session.status).json({ error: session.error });
        return;
      }

      const { statKey, label, targetMemberIds } = req.body ?? {};
      const battleId = typeof req.body?.battleId === "string" && req.body.battleId.trim().length > 0
        ? req.body.battleId.trim()
        : undefined;
      if (!statKey || !Array.isArray(targetMemberIds) || targetMemberIds.length === 0) {
        res.status(400).json({ error: "statKey and targetMemberIds are required" });
        return;
      }

      const members = await getLiveMembers(code);
      const memberSet = new Set(members.map((m) => m.id));
      const targets = targetMemberIds.filter((id: string) => memberSet.has(id));
      if (targets.length === 0) {
        res.status(400).json({ error: "No valid target members" });
        return;
      }

      const state = await getOrHydrateCombatState(code);

      if (statKey === "initiative") {
        // Keep only one active initiative prompt per player target to avoid duplicate initiative cards.
        state.rollRequests = state.rollRequests.filter((existing) => {
          if (existing.statKey !== "initiative") return true;
          const unresolvedTargetOverlap = existing.targetMemberIds.some(
            (targetId) =>
              targets.includes(targetId) &&
              !existing.responses.some((response) => response.memberId === targetId)
          );
          return !unresolvedTargetOverlap;
        });
      }

      const request: RollRequest = {
        id: generateId(),
        statKey,
        label: typeof label === "string" && label.trim().length > 0 ? label.trim() : statKey,
        targetMemberIds: targets,
        battleId,
        createdAt: new Date().toISOString(),
        responses: [],
      };
      state.rollRequests.unshift(request);
      appendEvent(state, {
        type: "roll_prompt_created",
        message: `DM prompted ${request.label} for ${targets.length} player(s).`,
        metadata: { requestId: request.id, statKey: request.statKey, targetCount: targets.length },
      });
      await persistRuntimeState(code, state);

      res.json({ ok: true, request });
    } catch (err) {
      if (err instanceof RuntimeConflictError) throw err;
      res.status(500).json({ error: "Failed to create roll request" });
    }
  });

router.put("/party/:code/roll-requests/:requestId/respond", async (req, res) => {
  try {
    const { code, requestId } = req.params;
    const authMemberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
    if (!authMemberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }
    const access = await authorizePartyMember(code, authMemberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const { memberId, roll, modifier, total } = req.body ?? {};
    if (!memberId || typeof roll !== "number") {
      res.status(400).json({ error: "memberId and roll are required" });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const request = state.rollRequests.find((r) => r.id === requestId);
    if (!request) {
      res.status(404).json({ error: "Roll request not found" });
      return;
    }

    if (!request.targetMemberIds.includes(memberId)) {
      res.status(403).json({ error: "Member is not targeted for this request" });
      return;
    }

    const cleanRoll = Math.max(1, Math.min(20, Math.floor(roll)));
    const cleanModifier = typeof modifier === "number" ? Math.floor(modifier) : 0;
    // Never trust client totals; always derive from sanitized d20 roll and modifier.
    const cleanTotal = Math.max(1, cleanRoll + cleanModifier);

    const existingResponse = request.responses.find((r) => r.memberId === memberId);
    const repeated = classifyRepeatedRoll(existingResponse, {
      roll: cleanRoll, modifier: cleanModifier, total: cleanTotal,
    });
    if (repeated === "replay") {
      // A retry after a lost HTTP acknowledgment must not append another event.
      res.json({ ok: true, request, replayed: true });
      return;
    }
    if (repeated === "conflict") {
      res.status(409).json({
        code: "roll_response_already_recorded",
        error: "This member's roll is already recorded and cannot be replaced.",
      });
      return;
    }
    const response: RollRequestResponse = {
      memberId,
      roll: cleanRoll,
      modifier: cleanModifier,
      total: cleanTotal,
      respondedAt: new Date().toISOString(),
    };
    request.responses.push(response);

    if (request.statKey === "initiative") {
      if (request.battleId) {
        state.participantBattleById[memberId] = request.battleId;
        if (!state.activeMemberIds.includes(memberId)) {
          state.activeMemberIds = [...state.activeMemberIds, memberId];
        }
      } else if (state.activeMemberIds.length > 0 || state.combatNpcs.length > 0) {
        addMemberToActiveEncounter(state, memberId);
      }
      state.initiativeByMember[memberId] = {
        memberId,
        initiativeRoll: cleanRoll,
        initiativeBonus: cleanModifier,
        initiativeTotal: cleanTotal,
      };
      const members = await getLiveMembers(code);
      rebuildTurnOrder(state, members.map((m) => m.id));
    }

    appendEvent(state, {
      type: "roll_prompt_responded",
      memberId,
      message: `A player submitted a ${request.label} roll (${cleanTotal}).`,
      metadata: { requestId: request.id, roll: cleanRoll, modifier: cleanModifier, total: cleanTotal },
    });
    await persistRuntimeState(code, state);
    res.json({ ok: true, request });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to submit roll response" });
  }
});

router.post("/party/:code/rest-requests", async (req, res) => {
  try {
    const { code } = req.params;
    const authMemberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
    if (!authMemberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }
    const access = await authorizePartyMember(code, authMemberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const { memberId, restType } = req.body ?? {};
    if (typeof memberId !== "string" || (restType !== "short_rest" && restType !== "long_rest")) {
      res.status(400).json({ error: "memberId and restType are required" });
      return;
    }

    const members = await getLiveMembers(code);
    const memberIds = members.map((m) => m.id);
    if (!memberIds.includes(memberId)) {
      res.status(404).json({ error: "Member not in party" });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const existing = state.restRequests.find(
      request => request.requestedByMemberId === memberId &&
        request.restType === restType &&
        (request.status === "pending" ||
          (request.status === "approved" &&
            request.targetMemberIds.some(id => !request.acknowledgements.includes(id))))
    );
    if (existing) {
      res.json({ ok: true, request: existing });
      return;
    }

    // Provisions are strictly opt-in; requesting a rest never consumes items.
    const provisionsInput = req.body?.provisions;
    if (provisionsInput !== undefined && (
      !provisionsInput || typeof provisionsInput !== "object" ||
      typeof provisionsInput.enabled !== "boolean" ||
      !Array.isArray(provisionsInput.itemIds) ||
      provisionsInput.itemIds.length > 30 ||
      provisionsInput.itemIds.some((id: unknown) => typeof id !== "string" || !id.trim() || id.length > 128) ||
      new Set(provisionsInput.itemIds).size !== provisionsInput.itemIds.length ||
      (!provisionsInput.enabled && provisionsInput.itemIds.length > 0)
    )) {
      res.status(400).json({ code: "invalid_rest_provisions",
        error: "Provisions must be explicitly enabled and contain unique, bounded inventory IDs." });
      return;
    }
    const request: RestRequest = {
      ...(provisionsInput ? { provisions: { enabled: provisionsInput.enabled,
        itemIds: provisionsInput.itemIds } } : {}),
      id: generateId(),
      restType,
      requestedByMemberId: memberId,
      targetMemberIds: memberIds,
      requestedAt: new Date().toISOString(),
      status: "pending",
      acknowledgements: [],
    };
    state.restRequests.unshift(request);
    if (state.restRequests.length > 100) {
      state.restRequests = state.restRequests.slice(0, 100);
    }

    appendEvent(state, {
      type: "rest_requested",
      memberId,
      message: `${restType === "short_rest" ? "Short" : "Long"} rest requested for the party.`,
      metadata: { requestId: request.id, restType },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true, request });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to create rest request" });
  }
});

router.put("/party/:code/rest-requests/:requestId", async (req, res) => {
  try {
    const { code, requestId } = req.params;
    // Host proof must precede activity refresh, expiration cleanup and runtime work.
    const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));
    if (sessions.length === 0) {
      res.status(404).json({ error: "Party session not found" });
      return;
    }
    if (!hasPartyHostToken(req.get("authorization"), sessions[0].hostTokenHash)) {
      res.status(403).json({ error: "Only the original party host can approve or deny rest. Older parties must expire or be recreated.", code: "party_host_required" });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const { status } = req.body ?? {};
    if (status !== "approved" && status !== "denied") {
      res.status(400).json({ error: "status must be approved or denied" });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const request = state.restRequests.find((entry) => entry.id === requestId);
    if (!request) {
      res.status(404).json({ error: "Rest request not found" });
      return;
    }

    // A resolution is a state transition, not a repeatable command. Replay
    // of the same decision is harmless; contradictory decisions are rejected.
    if (request.status !== "pending") {
      if (request.status === status) { res.json({ ok: true, request, replayed: true }); return; }
      res.status(409).json({ code: "rest_already_resolved",
        error: "This rest request has already been resolved." });
      return;
    }
    if (status === "approved" && request.targetMemberIds.some(id => {
      const battleId = state.participantBattleById[id];
      if (!battleId) return false;
      return state.combatNpcs.some(npc => state.participantBattleById[npc.id] === battleId &&
        npc.disposition === "hostile" && (npc.dummyState?.currentHp ?? 1) > 0);
    })) {
      res.status(409).json({ code: "rest_unsafe_active_combat",
        error: "Cannot approve rest while a hostile encounter is still active." });
      return;
    }
    if (status === "approved" && req.body?.automatic === true) {
      const safety = validateAiRestApproval(request.restType, req.body?.sceneSafety);
      if (!safety.ok) {
        res.status(409).json({ code: "rest_scene_unsafe", error: safety.reason });
        return;
      }
    }
    request.status = status;
    request.resolvedAt = new Date().toISOString();
    request.resolvedBy = "dm"; // Derived from host proof, not caller labels.

    appendEvent(state, {
      type: status === "approved" ? "rest_approved" : "rest_denied",
      message: `DM ${status} ${request.restType === "short_rest" ? "Short" : "Long"} Rest for the party.`,
      metadata: { requestId: request.id, restType: request.restType, status },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true, request });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to resolve rest request" });
  }
});

router.put("/party/:code/rest-requests/:requestId/ack", async (req, res) => {
  try {
    const { code, requestId } = req.params;
    const authMemberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
    if (!authMemberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }
    const access = await authorizePartyMember(code, authMemberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const { memberId } = req.body ?? {};
    if (typeof memberId !== "string") {
      res.status(400).json({ error: "memberId is required" });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const request = state.restRequests.find((entry) => entry.id === requestId);
    if (!request) {
      res.status(404).json({ error: "Rest request not found" });
      return;
    }
    if (request.status !== "approved") {
      res.status(409).json({ error: "Rest request is not approved" });
      return;
    }
    if (!request.targetMemberIds.includes(memberId)) {
      res.status(403).json({ error: "Member is not targeted for this rest request" });
      return;
    }

    if (request.acknowledgements.includes(memberId)) {
      res.json({ ok: true, request, replayed: true });
      return;
    }
    request.acknowledgements.push(memberId);
    await persistRuntimeState(code, state);

    res.json({ ok: true, request });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to acknowledge rest request" });
  }
});

router.post("/party/:code/events", async (req, res) => {
  try {
    const { code } = req.params;

    const { type, message, metadata } = req.body ?? {};
    const memberId = typeof req.body?.memberId === "string" ? req.body.memberId.trim() || null : null;
    const access = await authorizePartyActor(code, memberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    if (typeof type !== "string" || typeof message !== "string" || type.length === 0 || message.length === 0) {
      res.status(400).json({ error: "type and message are required" });
      return;
    }

    // Reports are not receipts for server-owned actions, even when posted by a host.
    const reportTypes = ["player_action_used", "player_bonus_action_used", "player_reaction_used",
      "player_object_interaction_used", "player_movement_used", "player_attack_used", "player_spell_cast"];
    if (!reportTypes.includes(type)) {
      res.status(400).json({ error: "This event type must be emitted by its authoritative action route" });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    appendEvent(state, {
      type,
      message,
      memberId: access.role === "member" && memberId ? memberId : undefined,
      metadata: { ...(typeof metadata === "object" && metadata && !Array.isArray(metadata) ? metadata : {}), reportedBy: access.role },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to append party event" });
  }
});

/** Loot only server-confirmed defeated NPC gear, and reserve each item exactly once. */
router.post("/party/:code/defeated-npc/:npcId/loot", async (req, res) => {
  const { code, npcId } = req.params;
  const memberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
  const itemIds: string[] = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
  if (!memberId || !itemIds.length || itemIds.length > 40 ||
      !itemIds.every(id => typeof id === "string" && id.length > 0 && id.length <= 128) ||
      new Set(itemIds).size !== itemIds.length) {
    res.status(400).json({ error: "Select valid, distinct loot items and a recipient." }); return;
  }
  try {
    const access = await authorizePartyMember(code, memberId, req.get("authorization"));
    if (!access.ok) { res.status(access.status).json({ error: access.error, code: access.code }); return; }
    const outcome = await db.transaction(async tx => {
      const sessions = await tx.select().from(partySessions).where(eq(partySessions.code, code)).for("update");
      if (!sessions[0] || isExpired(sessions[0].lastActivityAt)) throw new CompanionLifecycleError(404, "party_not_found", "Party unavailable.");
      const durable = await loadPartyRuntimeSnapshot(code, tx);
      if (!durable) throw new CompanionLifecycleError(409, "combat_state_missing", "Encounter state unavailable.");
      const state = hydrateRuntimeSnapshotToCombatState(code, durable.snapshot);
      state.stateRevision = durable.stateRevision;
      const npc = state.combatNpcs.find(entry => entry.id === npcId);
      const confirmedDefeat = state.eventLog.some(event =>
        event.type === "npc_defeated" && event.metadata?.npcId === npcId);
      if (!npc || !npc.dummyState || npc.dummyState.currentHp !== 0 ||
          npc.projection?.combatantKind === "companion" || !confirmedDefeat) {
        throw new CompanionLifecycleError(409, "npc_not_defeated", "This combatant has not been confirmed defeated.");
      }
      const selected = (npc.gear ?? []).filter(gear => itemIds.includes(gear.id) && canTransferNpcGear(gear));
      if (selected.length !== itemIds.length) throw new CompanionLifecycleError(409, "loot_unavailable", "One or more items were already taken.");
      const now = new Date().toISOString();
      const assignments: LootAssignment[] = selected.map(gear => ({
        id: generateId(), targetMemberId: memberId,
        item: { name: gear.name, quantity: 1, category: gear.category, notes: gear.notes,
          inventoryItem: { name: gear.name, quantity: 1, equipped: false, category: gear.category,
            notes: gear.notes, damageDice: gear.damageDice, damageModifier: gear.damageModifier,
            damageType: gear.damageType, weaponRange: gear.range } },
        assignedBy: `defeated_npc:${npcId}`, assignedAt: now,
      }));
      npc.gear = (npc.gear ?? []).filter(gear => !itemIds.includes(gear.id));
      state.lootAssignments.unshift(...assignments);
      appendEvent(state, { type: "loot_assigned", memberId, message: `Loot collected from ${npc.name}.`,
        metadata: { npcId, itemIds, assignmentIds: assignments.map(a => a.id) } });
      const saved = await savePartyRuntimeSnapshot({ partyCode: code,
        snapshot: toRuntimeSnapshotPayload(state), expectedRevision: durable.stateRevision }, tx);
      if (!saved.ok) throw new RuntimeConflictError(durable.stateRevision, saved.conflictRevision);
      return assignments;
    }, { isolationLevel: "serializable" });
    combatStates.delete(code);
    res.json({ ok: true, assignments: outcome });
  } catch (error) {
    if (error instanceof RuntimeConflictError) throw error;
    if (error instanceof CompanionLifecycleError) { res.status(error.status).json({ code: error.code, error: error.message }); return; }
    res.status(500).json({ error: "Could not collect NPC loot." });
  }
});

router.post("/party/:code/loot-assignments", async (req, res) => {
  try {
    const { code } = req.params;

    const targetMemberIds: string[] = Array.isArray(req.body?.targetMemberIds)
      ? req.body.targetMemberIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const requestedAuthor = typeof req.body?.assignedBy === "string" ? req.body.assignedBy.trim() : "";
    const memberId = requestedAuthor && requestedAuthor !== "dm" ? requestedAuthor : null;
    const access = await authorizePartyActor(code, memberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const assignedBy = access.role === "host" ? "dm" : memberId!;
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }


    if (targetMemberIds.length === 0 || items.length === 0) {
      res.status(400).json({ error: "targetMemberIds and items are required" });
      return;
    }

    const members = await getLiveMembers(code);
    const liveMemberSet = new Set(members.map((m) => m.id));
    const validTargets = targetMemberIds.filter((id: string) => liveMemberSet.has(id));
    if (validTargets.length === 0) {
      res.status(400).json({ error: "No valid target members" });
      return;
    }

    const isPortableMapImageUri = (uri: string): boolean => /^data:image\//i.test(uri) || /^https?:\/\//i.test(uri);

    const normalizedItems: LootAssignmentItem[] = items
      .map((item: any) => {
        const name = typeof item?.name === "string" ? item.name.trim() : "";
        if (!name) return null;
        const quantity = typeof item?.quantity === "number" ? Math.max(1, Math.floor(item.quantity)) : 1;
        const categoryRaw = typeof item?.category === "string" ? item.category : "other";
        const allowedCategories: LootAssignmentItem["category"][] = ["weapon", "armor", "accessory", "consumable", "quest", "magic", "gear", "treasure", "map", "currency", "component", "junk", "other"];
        const category = (allowedCategories.includes(categoryRaw) ? categoryRaw : "other") as LootAssignmentItem["category"];
        const notes = typeof item?.notes === "string" ? item.notes.trim() : undefined;
        const value = typeof item?.value === "number" ? item.value : undefined;
        let imageUri = typeof item?.imageUri === "string" && item.imageUri.trim() ? item.imageUri.trim() : undefined;
        let normalizedNotes = notes;

        if (category === "map") {
          const legacyMapImageMatch = typeof normalizedNotes === "string"
            ? normalizedNotes.match(/^Map Image:\s*(.+)$/im)
            : null;
          const legacyMapImageUri = legacyMapImageMatch?.[1]?.trim();

          if (!imageUri && legacyMapImageUri && isPortableMapImageUri(legacyMapImageUri)) {
            imageUri = legacyMapImageUri;
          }

          if (typeof normalizedNotes === "string") {
            const cleaned = normalizedNotes
              .replace(/^Map Image:\s*.+$/gim, "")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
            normalizedNotes = cleaned || undefined;
          }

          const hasNonPortableImageUri = Boolean(imageUri && !isPortableMapImageUri(imageUri));
          const hasLegacyNonPortableUri = Boolean(
            legacyMapImageUri && !isPortableMapImageUri(legacyMapImageUri) && !imageUri,
          );
          if (hasNonPortableImageUri || hasLegacyNonPortableUri) {
            throw new Error("NON_PORTABLE_MAP_IMAGE");
          }
        }

        const imageSource = item?.imageSource === "dm" || item?.imageSource === "player"
          ? item.imageSource
          : imageUri ? "dm" : undefined;
        const inventoryItem = item?.inventoryItem && typeof item.inventoryItem === "object" && !Array.isArray(item.inventoryItem)
          ? { ...(item.inventoryItem as Record<string, unknown>) }
          : undefined;
        return { name, quantity, category, notes: normalizedNotes, value, imageUri, imageSource, inventoryItem };
      })
      .filter(Boolean) as LootAssignmentItem[];

    if (normalizedItems.length === 0) {
      res.status(400).json({ error: "No valid loot items found" });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const now = new Date().toISOString();
    const assignments: LootAssignment[] = [];

    for (const targetMemberId of validTargets) {
      for (const item of normalizedItems) {
        assignments.push({
          id: generateId(),
          targetMemberId,
          item,
          assignedBy,
          assignedAt: now,
        });
      }
    }

    state.lootAssignments.unshift(...assignments);
    if (state.lootAssignments.length > 400) {
      state.lootAssignments = state.lootAssignments.slice(0, 400);
    }

    const assignmentSource = access.role === "host" ? "DM" : "A party member";
    appendEvent(state, {
      type: "loot_assigned",
      message: `${assignmentSource} assigned ${normalizedItems.length} loot item(s) to ${validTargets.length} player(s).`,
      metadata: { targetCount: validTargets.length, itemCount: normalizedItems.length, assignedBy },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true, assignments });
  } catch (error) {
    if (error instanceof RuntimeConflictError) throw error;
    if (error instanceof Error && error.message === "NON_PORTABLE_MAP_IMAGE") {
      res.status(400).json({
        error: "Map images must use a portable URL (http/https) or data URL. Please reselect the image before assigning loot.",
      });
      return;
    }
    res.status(500).json({ error: "Failed to assign loot" });
  }
});

router.put("/party/:code/loot-assignments/:assignmentId/claim", async (req, res) => {
  try {
    const { code, assignmentId } = req.params;
    const authMemberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
    if (!authMemberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }
    const access = await authorizePartyMember(code, authMemberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const memberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
    if (!memberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const assignment = state.lootAssignments.find((entry) => entry.id === assignmentId);
    if (!assignment) {
      res.status(404).json({ error: "Loot assignment not found" });
      return;
    }

    if (assignment.targetMemberId !== memberId) {
      res.status(403).json({ error: "Loot assignment is not for this member" });
      return;
    }

    if (!assignment.claimedAt) {
      assignment.claimedAt = new Date().toISOString();
      assignment.claimedBy = memberId;
      appendEvent(state, {
        type: "loot_claimed",
        memberId,
        message: `A player claimed ${assignment.item.quantity}x ${assignment.item.name}.`,
        metadata: { assignmentId: assignment.id, itemName: assignment.item.name },
      });
    }
    await persistRuntimeState(code, state);

    res.json({ ok: true, assignment });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to claim loot assignment" });
  }
});

router.post("/party/:code/note-assignments", async (req, res) => {
  try {
    const { code } = req.params;
    // Authenticate before ensureActiveSession: it refreshes activity and may
    // delete expired sessions/runtime. A party code or DM label is not proof.
    const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));
    if (sessions.length === 0) {
      res.status(404).json({ error: "Party session not found" });
      return;
    }
    if (!hasPartyHostToken(req.get("authorization"), sessions[0].hostTokenHash)) {
      res.status(403).json({ error: "Only the original party host can send DM notes. Older parties must expire or be recreated.", code: "party_host_required" });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const targetMemberIds: string[] = Array.isArray(req.body?.targetMemberIds)
      ? req.body.targetMemberIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const payloadRaw = req.body?.payload;
    const assignedBy = "dm"; // Derived from host proof, never a caller role flag.

    if (targetMemberIds.length === 0 || typeof payloadRaw !== "object" || !payloadRaw) {
      res.status(400).json({ error: "targetMemberIds and payload are required" });
      return;
    }

    const members = await getLiveMembers(code);
    const liveMemberSet = new Set(members.map((m) => m.id));
    const validTargets = targetMemberIds.filter((id: string) => liveMemberSet.has(id));
    if (validTargets.length === 0) {
      res.status(400).json({ error: "No valid target members" });
      return;
    }

    const payloadObj = payloadRaw as Record<string, unknown>;
    const normalizeNote = (value: unknown): NotesPayloadNote | null => {
      if (!value || typeof value !== "object") return null;
      const note = value as Record<string, unknown>;
      const title = typeof note.title === "string" ? note.title.trim() : "";
      if (!title) return null;
      const strings = (value: unknown) => Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string") : undefined;
      return {
        id: typeof note.id === "string" && note.id.trim() ? note.id : `note_${generateId()}`,
        title,
        body: typeof note.body === "string" ? note.body : "",
        pinned: note.pinned === true,
        createdAt: typeof note.createdAt === "number" && Number.isFinite(note.createdAt) ? note.createdAt : Date.now(),
        updatedAt: typeof note.updatedAt === "number" && Number.isFinite(note.updatedAt) ? note.updatedAt : Date.now(),
        sessionNumber: typeof note.sessionNumber === "number" && Number.isSafeInteger(note.sessionNumber) && note.sessionNumber >= 0 ? note.sessionNumber : undefined,
        arcName: typeof note.arcName === "string" ? note.arcName : undefined,
        tags: strings(note.tags), linkedNpcs: strings(note.linkedNpcs),
        linkedLocations: strings(note.linkedLocations), linkedQuests: strings(note.linkedQuests),
      };
    };

    const normalizeQuest = (q: any): NotesPayloadQuest | null => {
      if (!q || typeof q !== "object") return null;
      const name = typeof q.name === "string" ? q.name.trim() : "";
      if (!name) return null;
      const type = q.type === "main" || q.type === "personal" ? q.type : "side";
      const status = q.status === "completed" || q.status === "failed" ? q.status : "active";
      return {
        id: typeof q.id === "string" && q.id.trim() ? q.id : `quest_${generateId()}`,
        name,
        type,
        status,
        description: typeof q.description === "string" ? q.description.trim() || undefined : undefined,
        locationTags: Array.isArray(q.locationTags) ? q.locationTags.filter((x: unknown): x is string => typeof x === "string") : [],
        notes: typeof q.notes === "string" ? q.notes.trim() || undefined : undefined,
        createdAt: typeof q.createdAt === "number" ? q.createdAt : Date.now(),
        pinned: !!q.pinned,
      };
    };

    const normalizePerson = (p: any): NotesPayloadPerson | null => {
      if (!p || typeof p !== "object") return null;
      const name = typeof p.name === "string" ? p.name.trim() : "";
      if (!name) return null;
      const relationship = p.relationship === "ally" || p.relationship === "neutral" || p.relationship === "hostile" ? p.relationship : "unknown";
      return {
        id: typeof p.id === "string" && p.id.trim() ? p.id : `person_${generateId()}`,
        name,
        role: typeof p.role === "string" ? p.role.trim() || undefined : undefined,
        relationship,
        description: typeof p.description === "string" ? p.description.trim() || undefined : undefined,
        questTags: Array.isArray(p.questTags) ? p.questTags.filter((x: unknown): x is string => typeof x === "string") : [],
        notes: typeof p.notes === "string" ? p.notes.trim() || undefined : undefined,
        createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
        pinned: !!p.pinned,
        deceased: !!p.deceased,
        deceasedNote: typeof p.deceasedNote === "string" ? p.deceasedNote.trim() || undefined : undefined,
      };
    };

    const normalizeLocation = (l: any): NotesPayloadLocation | null => {
      if (!l || typeof l !== "object") return null;
      const name = typeof l.name === "string" ? l.name.trim() : "";
      if (!name) return null;
      return {
        id: typeof l.id === "string" && l.id.trim() ? l.id : `location_${generateId()}`,
        name,
        description: typeof l.description === "string" ? l.description.trim() || undefined : undefined,
        mapImageUri: typeof l.mapImageUri === "string" ? l.mapImageUri : undefined,
        questTags: Array.isArray(l.questTags) ? l.questTags.filter((x: unknown): x is string => typeof x === "string") : [],
        notes: typeof l.notes === "string" ? l.notes.trim() || undefined : undefined,
        createdAt: typeof l.createdAt === "number" ? l.createdAt : Date.now(),
        pinned: !!l.pinned,
      };
    };

    const payload: NotesAssignmentPayload = {
      notes: Array.isArray(payloadObj.notes) ? payloadObj.notes.map(normalizeNote).filter((note): note is NotesPayloadNote => note !== null) : [],
      quests: Array.isArray(payloadObj.quests) ? payloadObj.quests.map(normalizeQuest).filter(Boolean) as NotesPayloadQuest[] : [],
      people: Array.isArray(payloadObj.people) ? payloadObj.people.map(normalizePerson).filter(Boolean) as NotesPayloadPerson[] : [],
      locations: Array.isArray(payloadObj.locations) ? payloadObj.locations.map(normalizeLocation).filter(Boolean) as NotesPayloadLocation[] : [],
    };

    if ((payload.notes?.length ?? 0) === 0 && payload.quests.length === 0 && payload.people.length === 0 && payload.locations.length === 0) {
      res.status(400).json({ error: "No valid notes payload content found" });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const now = new Date().toISOString();
    const assignments: NotesAssignment[] = validTargets.map((targetMemberId) => ({
      id: generateId(),
      targetMemberId,
      payload,
      assignedBy,
      assignedAt: now,
    }));

    state.noteAssignments.unshift(...assignments);
    if (state.noteAssignments.length > 400) {
      state.noteAssignments = state.noteAssignments.slice(0, 400);
    }

    appendEvent(state, {
      type: "notes_assigned",
      message: `DM sent notes to ${validTargets.length} player(s).`,
      metadata: {
        targetCount: validTargets.length,
        noteCount: payload.notes?.length ?? 0,
        questCount: payload.quests.length,
        peopleCount: payload.people.length,
        locationCount: payload.locations.length,
      },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true, assignments });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to assign notes" });
  }
});

// Encounter and roll-prompt control belong to the persisted host capability.
// AI DM calls use the host device; caller labels do not establish delegation.
async function authorizePartyHost(code: string, authorization: string | undefined, action = "manage encounters") {
  const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));
  if (sessions.length === 0) {
    return { ok: false as const, status: 404, code: "party_not_found", error: "Party session not found" };
  }
  if (!hasPartyHostToken(authorization, sessions[0].hostTokenHash)) {
    return { ok: false as const, status: 403, code: "party_host_required", error: `Only the original party host can ${action}. Run DM or AI DM controls from the device that created this party.` };
  }
  return { ok: true as const };
}

// Mixed host/member operations authenticate the origin, never a body role flag.
async function authorizePartyActor(code: string, memberId: string | null, authorization: string | undefined) {
  const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));
  if (!sessions.length) return { ok: false as const, status: 404, code: "party_not_found", error: "Party session not found" };
  if (hasPartyHostToken(authorization, sessions[0].hostTokenHash)) return { ok: true as const, role: "host" as const };
  if (!memberId) return { ok: false as const, status: 403, code: "party_host_required", error: "Original party host proof is required for this action." };
  const members = await db.select().from(partyMembers)
    .where(and(eq(partyMembers.id, memberId), eq(partyMembers.partyCode, code)));
  if (!hasPartyHostToken(authorization, members[0]?.memberTokenHash)) {
    return { ok: false as const, status: 403, code: "party_member_required", error: "Member access is missing or expired. Rejoin this party." };
  }
  return { ok: true as const, role: "member" as const };
}

// Member IDs are not credentials. Check live party/member proof before
// ensureActiveSession can refresh activity or remove expired state.
async function authorizePartyMember(code: string, memberId: string, authorization: string | undefined) {
  const sessions = await db.select().from(partySessions).where(eq(partySessions.code, code));
  if (!sessions.length) return { ok: false as const, status: 404, error: "Party session not found", code: "party_not_found" };
  const members = await db.select().from(partyMembers)
    .where(and(eq(partyMembers.id, memberId), eq(partyMembers.partyCode, code)));
  if (!hasPartyHostToken(authorization, members[0]?.memberTokenHash)) {
    return { ok: false as const, status: 403, code: "party_member_required", error: "Member access is missing or expired. Rejoin this party." };
  }
  return { ok: true as const };
}

router.put("/party/:code/note-assignments/:assignmentId/accept", async (req, res) => {
  try {
    const { code, assignmentId } = req.params;
    const memberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
    if (!memberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }
    const access = await authorizePartyMember(code, memberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const assignment = state.noteAssignments.find((entry) => entry.id === assignmentId);
    if (!assignment) {
      res.status(404).json({ error: "Note assignment not found" });
      return;
    }

    if (assignment.targetMemberId !== memberId) {
      res.status(403).json({ error: "Note assignment is not for this member" });
      return;
    }

    if (!assignment.acceptedAt) {
      assignment.acceptedAt = new Date().toISOString();
      assignment.acceptedBy = memberId;
      appendEvent(state, {
        type: "notes_accepted",
        memberId,
        message: "A player accepted DM notes into their journal.",
        metadata: { assignmentId: assignment.id },
      });
    }
    await persistRuntimeState(code, state);

    res.json({ ok: true, assignment });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to accept note assignment" });
  }
});

router.put("/party/:code/note-assignments/:assignmentId/decline", async (req, res) => {
  try {
    const { code, assignmentId } = req.params;
    const memberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
    if (!memberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }
    const access = await authorizePartyMember(code, memberId, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const idx = state.noteAssignments.findIndex((entry) => entry.id === assignmentId);
    if (idx === -1) {
      res.status(404).json({ error: "Note assignment not found" });
      return;
    }

    const assignment = state.noteAssignments[idx];
    if (assignment.targetMemberId !== memberId) {
      res.status(403).json({ error: "Note assignment is not for this member" });
      return;
    }

    if (assignment.acceptedAt) {
      res.status(409).json({ error: "Accepted assignments cannot be declined" });
      return;
    }

    assignment.declinedAt = new Date().toISOString();
    assignment.declinedBy = memberId;
    state.noteAssignments.splice(idx, 1);

    appendEvent(state, {
      type: "notes_declined",
      memberId,
      message: "A player declined DM notes.",
      metadata: { assignmentId },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true, assignmentId });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to decline note assignment" });
  }
});

router.post("/party/:code/combat-npcs", async (req, res) => {
  try {
    const { code } = req.params;
    const projection = normalizeCombatNpcProjection(req.body?.projection);
    const companionMemberId = projection?.ownerMemberId;
    if (projection && (!companionMemberId || !projection.companionId)) {
      res.status(400).json({ error: "Companion and owner member IDs are required" });
      return;
    }
    const access = projection
      ? await authorizePartyMember(code, companionMemberId!, req.get("authorization"))
      : await authorizePartyHost(code, req.get("authorization"), "create combat NPCs");
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    // Companion metadata selects the credential; it never proves character ownership.
    if (req.body?.projection !== undefined && !projection) {
      res.status(400).json({ error: "Unsupported NPC projection" });
      return;
    }
    if (projection && (req.body?.sourceType !== "character" || req.body?.sourceId !== projection.companionId ||
      req.body?.disposition !== "friendly" || req.body?.initiativeTotal !== undefined ||
      (req.body?.gear !== undefined && (!Array.isArray(req.body.gear) || req.body.gear.length > 0)) ||
      (req.body?.conditions !== undefined && (!Array.isArray(req.body.conditions) || req.body.conditions.length > 0)))) {
      res.status(400).json({ error: "Companion projection must be a friendly character source without gear, conditions or an initiative override" });
      return;
    }
    // Companion admission refreshes activity only after locked proof inside
    // its transaction. Keep ordinary host NPC creation on its existing path.
    if (!projection) {
      const session = await ensureActiveSession(code);
      if (!session.ok) { res.status(session.status).json({ error: session.error }); return; }
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const sourceType = req.body?.sourceType === "dm-npc"
      || req.body?.sourceType === "character"
      || req.body?.sourceType === "monster"
      ? req.body.sourceType
      : "manual";
    const sourceId = typeof req.body?.sourceId === "string" ? req.body.sourceId : undefined;
    const disposition = req.body?.disposition === "hostile" || req.body?.disposition === "friendly" ? req.body.disposition : "passive";
    const coreStats = normalizeCombatNpcStats(req.body?.coreStats);
    const visibleStatKeys = normalizeVisibleNpcStatKeys(req.body?.visibleStatKeys);
    const conditions = normalizeCombatConditions(req.body?.conditions);
    const dummyMeta = parseDummyMetaFromSourceId(sourceId);
    const dummyState = dummyMeta
      ? normalizeDummyState(req.body?.dummyState, dummyMeta)
      : req.body?.dummyState
        ? normalizeDummyState(req.body?.dummyState, {
          maxHp: 20,
          armorClass: Math.max(10, 10 + Math.floor((coreStats.dexterity - 10) / 2)),
        })
        : undefined;
    const gear = normalizeCombatNpcGear(req.body?.gear);
    const initiativeTotal = typeof req.body?.initiativeTotal === "number"
      ? Math.floor(req.body.initiativeTotal)
      : coreStats.initiativeBonus;

    const executeCreation = async (tx?: RuntimeExecutor) => {
      if (tx) {
        // Same lock order as member departure and host recovery. Reuse also
        // revalidates membership and responds only after transaction commit.
        const sessions = await tx.select().from(partySessions)
          .where(eq(partySessions.code, code)).for("update");
        const owners = await tx.select().from(partyMembers)
          .where(and(eq(partyMembers.id, companionMemberId!), eq(partyMembers.partyCode, code))).for("update");
        if (!hasPartyHostToken(req.get("authorization"), owners[0]?.memberTokenHash)) {
          throw new CompanionLifecycleError(403, "party_member_required", "Member access is missing or expired. Rejoin this party.");
        }
        if (!sessions[0] || isExpired(sessions[0].lastActivityAt)) {
          throw new CompanionLifecycleError(404, "party_not_found", "Party is absent or expired.");
        }
        await tx.update(partySessions).set({ lastActivityAt: new Date() }).where(eq(partySessions.code, code));
      }
      const state = tx ? await getCommittedCombatState(code, tx) : await getOrHydrateCombatState(code);
      const ownerBattleId = companionMemberId ? state.participantBattleById[companionMemberId] : undefined;
      const requestedBattleId = typeof req.body?.battleId === "string" ? req.body.battleId.trim() : undefined;
      if (projection && requestedBattleId && requestedBattleId !== ownerBattleId) {
        throw new CompanionLifecycleError(403, "companion_battle_required", "A companion can only join its submitting member's battle");
      }
      if (projection) {
        const existing = state.combatNpcs.find((entry) =>
          entry.companionAdmission?.schemaVersion === "companion-admission.v1" &&
          entry.companionAdmission.memberId === companionMemberId &&
          entry.companionAdmission.companionId === projection.companionId);
        if (existing) {
          // Reuse preserves live HP, spent economy, DM edits, battle placement and history.
          if (existing.companionAdmission?.detachedAt) {
            throw new CompanionLifecycleError(409, "companion_recovery_conflict", "This retained companion requires host review.");
          }
          return { ok: true, npc: existing, reused: true };
        }
      }
      const companionAdmission: CompanionAdmission | undefined = projection ? {
        schemaVersion: "companion-admission.v1",
        memberId: companionMemberId!,
        companionId: projection.companionId!,
      } : undefined;
      const npcId = `npc_${generateId()}`;
      const npc = {
        id: npcId,
        name,
        sourceType,
        sourceId,
        disposition,
        coreStats,
        visibleStatKeys,
        dummyState,
        gear,
        conditions,
        projection,
        companionAdmission,
        createdAt: new Date().toISOString(),
      };
      state.combatNpcs.push(npc);
      const targetBattleId = projection ? ownerBattleId : selectedBattleIdFromRequest(req.body?.battleId, state.activeMemberIds, state.participantBattleById);
      if (targetBattleId) {
        state.participantBattleById[npcId] = targetBattleId;
      }
      if (initiativeTotal !== null) {
        state.initiativeByMember[npcId] = {
          memberId: npcId,
          initiativeRoll: 0,
          initiativeBonus: coreStats.initiativeBonus,
          initiativeTotal,
        };
      }

      const members = tx
        ? await tx.select().from(partyMembers).where(eq(partyMembers.partyCode, code))
        : await getLiveMembers(code);
      rebuildTurnOrder(state, members.map((m) => m.id));
      appendEvent(state, {
        type: "combat_npc_added",
        message: projection ? `A party member projected ${name} as a companion.` : `DM added ${name} as a ${disposition} combat NPC.`,
        memberId: companionMemberId,
        metadata: {
          npcId,
          sourceType,
          disposition,
          combatantKind: projection?.combatantKind,
          companionId: projection?.companionId,
        },
      });
      if (tx) {
        const saved = await savePartyRuntimeSnapshot({
          partyCode: code, snapshot: toRuntimeSnapshotPayload(state), expectedRevision: state.stateRevision,
        }, tx);
        if (!saved.ok) throw new RuntimeConflictError(state.stateRevision, saved.conflictRevision);
      } else {
        await persistRuntimeState(code, state);
      }
      return { ok: true, npc, ...(projection ? { reused: false } : {}) };
    };
    const result = projection
      ? await db.transaction(tx => executeCreation(tx), { isolationLevel: "serializable" })
      : await executeCreation();
    if (projection) combatStates.delete(code);
    res.json(result);
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    if (err instanceof CompanionLifecycleError) {
      res.status(err.status).json({ code: err.code, error: err.message }); return;
    }
    const failureCode = transactionFailureCode(err);
    if (normalizeCombatNpcProjection(req.body?.projection) && (failureCode === "40001" || failureCode === "40P01" || failureCode === "23505")) {
      throw new RuntimeConflictError(0, null);
    }
    res.status(500).json({ error: "Failed to add combat NPC" });
  }
});

router.post("/party/:code/combat-npcs/:npcId/recover-companion", async (req, res) => {
  try {
    const { code, npcId } = req.params;
    const access = await authorizePartyHost(code, req.get("authorization"), "recover companions");
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code }); return;
    }
    const { expectedRevision, expectedDetachedAt, targetMemberId } = req.body ?? {};
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
        typeof expectedDetachedAt !== "string" || !expectedDetachedAt || expectedDetachedAt.length > 64 ||
        typeof targetMemberId !== "string" || !targetMemberId || targetMemberId.length > 128 ||
        reason.length < 3 || reason.length > 240) {
      res.status(400).json({ error: "Review the retained companion, choose a member and provide a reason (3–240 characters)." }); return;
    }
    const npc = await db.transaction(async tx => {
      const sessions = await tx.select().from(partySessions).where(eq(partySessions.code, code)).for("update");
      if (!hasPartyHostToken(req.get("authorization"), sessions[0]?.hostTokenHash)) {
        throw new CompanionLifecycleError(403, "party_host_required", "Only the original host can recover companions.");
      }
      if (!sessions[0] || isExpired(sessions[0].lastActivityAt)) {
        throw new CompanionLifecycleError(404, "party_not_found", "Party is absent or expired.");
      }
      const targets = await tx.select().from(partyMembers)
        .where(and(eq(partyMembers.id, targetMemberId), eq(partyMembers.partyCode, code))).for("update");
      if (!targets[0] || typeof targets[0].memberTokenHash !== "string" || !/^[a-f0-9]{64}$/.test(targets[0].memberTokenHash)) {
        throw new CompanionLifecycleError(400, "recovery_target_required", "Choose a currently enrolled member of this party.");
      }
      const durable = await loadPartyRuntimeSnapshot(code, tx);
      if (!durable || durable.stateRevision !== expectedRevision) {
        throw new RuntimeConflictError(expectedRevision, durable?.stateRevision ?? null);
      }
      const state = hydrateRuntimeSnapshotToCombatState(code, durable.snapshot);
      const retained = state.combatNpcs.find(entry => entry.id === npcId);
      const binding = retained?.companionAdmission;
      if (!retained || binding?.schemaVersion !== "companion-admission.v1" ||
          !binding.detachedAt || binding.detachedAt !== expectedDetachedAt ||
          typeof binding.companionId !== "string" || !binding.companionId) {
        throw new CompanionLifecycleError(409, "companion_recovery_conflict", "This companion is no longer the retained instance you reviewed.");
      }
      if (state.combatNpcs.some(entry => entry.id !== npcId &&
          entry.companionAdmission?.schemaVersion === "companion-admission.v1" &&
          entry.companionAdmission.memberId === targetMemberId &&
          entry.companionAdmission.companionId === binding.companionId)) {
        throw new CompanionLifecycleError(409, "companion_recovery_conflict", "That member already has a bound instance of this companion. Review duplicates before recovery.");
      }
      const previousMemberId = binding.memberId, detachedAt = binding.detachedAt;
      const recoveredAt = new Date().toISOString();
      retained.companionAdmission = {
        schemaVersion: "companion-admission.v1", memberId: targetMemberId, companionId: binding.companionId,
        recoveredFrom: { memberId: previousMemberId, detachedAt, recoveredAt },
      };
      if (retained.projection) retained.projection = { ...retained.projection, ownerMemberId: targetMemberId };
      // Restore ownership only. Encounter admission is a separate explicit action.
      delete state.participantBattleById[npcId];
      delete state.initiativeByMember[npcId];
      delete state.playerEconomyByMember[npcId];
      const members = await tx.select().from(partyMembers).where(eq(partyMembers.partyCode, code));
      rebuildTurnOrder(state, members.map(member => member.id));
      appendEvent(state, {
        type: "companion_recovered", memberId: targetMemberId,
        message: `DM restored ${retained.name} to ${targets[0].characterName || "an enrolled member"}: ${reason}`,
        metadata: { npcId, actor: "original_host", previousMemberId, targetMemberId,
          companionId: binding.companionId, detachedAt, recoveredAt, reason },
      });
      const saved = await savePartyRuntimeSnapshot({
        partyCode: code, snapshot: toRuntimeSnapshotPayload(state), expectedRevision,
      }, tx);
      if (!saved.ok) throw new RuntimeConflictError(expectedRevision, saved.conflictRevision);
      return retained;
    }, { isolationLevel: "serializable" });
    combatStates.delete(code);
    res.json({ ok: true, npc });
  } catch (error) {
    if (error instanceof RuntimeConflictError) throw error;
    if (error instanceof CompanionLifecycleError) {
      res.status(error.status).json({ code: error.code, error: error.message }); return;
    }
    const code = transactionFailureCode(error);
    if (code === "40001" || code === "40P01") throw new RuntimeConflictError(0, null);
    res.status(500).json({ error: "Failed to recover companion. Refresh and review before trying again." });
  }
});

router.put("/party/:code/combat-npcs/:npcId/dummy-state", async (req, res) => {
  try {
    const { code, npcId } = req.params;
    const access = await authorizePartyHost(code, req.get("authorization"), "manage NPC instances");
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const npc = state.combatNpcs.find((entry) => entry.id === npcId);
    if (!npc) {
      res.status(404).json({ error: "Combat NPC not found" });
      return;
    }

    const fallbackMeta = parseDummyMetaFromSourceId(npc.sourceId) ?? {
      maxHp: npc.dummyState?.maxHp ?? 20,
      armorClass: npc.dummyState?.armorClass ?? Math.max(10, 10 + Math.floor((npc.coreStats.dexterity - 10) / 2)),
    };
    const baseline = npc.dummyState ?? normalizeDummyState(undefined, fallbackMeta);
    npc.dummyState = normalizeDummyState(
      {
        ...baseline,
        ...(typeof req.body === "object" && req.body ? req.body : {}),
      },
      fallbackMeta
    );

    state.updatedAt = new Date().toISOString();
    await persistRuntimeState(code, state);
    res.json({ ok: true, npc });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to update dummy state" });
  }
});

router.put("/party/:code/combat-npcs/:npcId/gear", async (req, res) => {
  try {
    const { code, npcId } = req.params;
    const access = await authorizePartyHost(code, req.get("authorization"), "manage NPC instances");
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const npc = state.combatNpcs.find((entry) => entry.id === npcId);
    if (!npc) {
      res.status(404).json({ error: "Combat NPC not found" });
      return;
    }

    npc.gear = normalizeCombatNpcGear(req.body?.gear);
    state.updatedAt = new Date().toISOString();
    await persistRuntimeState(code, state);
    res.json({ ok: true, npc });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to update combat NPC gear" });
  }
});

router.put("/party/:code/combat-npcs/:npcId/visible-stats", async (req, res) => {
  try {
    const { code, npcId } = req.params;
    const access = await authorizePartyHost(code, req.get("authorization"), "manage NPC instances");
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const npc = state.combatNpcs.find((entry) => entry.id === npcId);
    if (!npc) {
      res.status(404).json({ error: "Combat NPC not found" });
      return;
    }

    npc.visibleStatKeys = normalizeVisibleNpcStatKeys(req.body?.visibleStatKeys);
    state.updatedAt = new Date().toISOString();
    await persistRuntimeState(code, state);

    res.json({ ok: true, npc });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to update combat NPC visible stats" });
  }
});

router.delete("/party/:code/combat-npcs/:npcId", async (req, res) => {
  try {
    const { code, npcId } = req.params;
    const access = await authorizePartyHost(code, req.get("authorization"), "manage NPC instances");
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const existing = state.combatNpcs.find((npc) => npc.id === npcId);
    if (!existing) {
      res.status(404).json({ error: "Combat NPC not found" });
      return;
    }

    state.combatNpcs = state.combatNpcs.filter((npc) => npc.id !== npcId);
    delete state.initiativeByMember[npcId];
    delete state.participantBattleById[npcId];

    const members = await getLiveMembers(code);
    rebuildTurnOrder(state, members.map((m) => m.id));
    appendEvent(state, {
      type: "combat_npc_removed",
      message: `DM removed ${existing.name} from combat NPCs.`,
      metadata: { npcId: existing.id },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to remove combat NPC" });
  }
});

router.delete("/party/:code/encounters/:battleId", async (req, res) => {
  try {
    const { code, battleId } = req.params;
    // Authenticate before session refresh/expiry cleanup or runtime work.
    const access = await authorizePartyHost(code, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);

    // Collect member and NPC participants in this battle
    const memberIdsInBattle = Object.entries(state.participantBattleById)
      .filter(([, bid]) => bid === battleId)
      .map(([id]) => id);
    const npcsInBattle = state.combatNpcs.filter((npc) => state.participantBattleById[npc.id] === battleId);
    const npcIdsInBattle = npcsInBattle.map((npc) => npc.id);
    const allIdsInBattle = new Set([...memberIdsInBattle, ...npcIdsInBattle]);

    if (allIdsInBattle.size === 0) {
      res.status(404).json({ error: "Encounter not found or has no participants" });
      return;
    }

    // Preserve confirmed defeated NPCs outside initiative, including their
    // unclaimed physical gear. Manual DM closure must not erase corpse loot.
    const defeatedNpcIds = new Set(state.eventLog.filter(event =>
      event.type === "npc_defeated" &&
      typeof event.metadata?.npcId === "string").map(event => String(event.metadata!.npcId)));
    const retainedCorpseIds = npcIdsInBattle.filter(id => {
      const npc = state.combatNpcs.find(entry => entry.id === id);
      return npc?.projection?.combatantKind !== "companion" &&
        defeatedNpcIds.has(id) && npc?.dummyState?.currentHp === 0;
    });
    state.combatNpcs = state.combatNpcs.filter(npc =>
      !npcIdsInBattle.includes(npc.id) || retainedCorpseIds.includes(npc.id));

    // Un-assign all participants from this battle
    for (const id of allIdsInBattle) {
      delete state.participantBattleById[id];
      delete state.initiativeByMember[id];
    }

    // Remove members from active list
    state.activeMemberIds = state.activeMemberIds.filter((id) => !allIdsInBattle.has(id));

    // Clean up battle turn tracking
    delete state.battleTurnOrderById[battleId];
    delete state.currentTurnIdByBattle[battleId];

    const members = await getLiveMembers(code);
    rebuildTurnOrder(state, members.map((m) => m.id));
    syncLegacyTurnState(state);

    appendEvent(state, {
      type: "encounter_ended",
      message: `DM ended encounter (${memberIdsInBattle.length} player(s) exited, ${npcIdsInBattle.length - retainedCorpseIds.length} NPC(s) removed, ${retainedCorpseIds.length} defeated NPC(s) retained for loot).`,
      metadata: { battleId, memberCount: memberIdsInBattle.length, npcCount: npcIdsInBattle.length, retainedCorpseIds },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to end encounter" });
  }
});

// Add players/NPCs to an already-running encounter
router.post("/party/:code/encounters/:battleId/participants", async (req, res) => {
  try {
    const { code, battleId } = req.params;
    // Authenticate before session refresh/expiry cleanup or runtime work.
    const access = await authorizePartyHost(code, req.get("authorization"));
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    if (!state.battleTurnOrderById[battleId]) {
      res.status(404).json({ error: "Encounter not found" });
      return;
    }

    const members = await getLiveMembers(code);
    const validMemberIds = new Set(members.map((m) => m.id));
    const validNpcIds = new Set(state.combatNpcs.filter((npc) => !npc.companionAdmission?.detachedAt).map((npc) => npc.id));

    const addMemberIds: string[] = Array.isArray(req.body?.memberIds)
      ? req.body.memberIds.filter((id: unknown): id is string => typeof id === "string" && validMemberIds.has(id))
      : [];
    const addNpcIds: string[] = Array.isArray(req.body?.npcIds)
      ? req.body.npcIds.filter((id: unknown): id is string => typeof id === "string" && validNpcIds.has(id))
      : [];

    if (addMemberIds.length === 0 && addNpcIds.length === 0) {
      res.status(400).json({ error: "No valid participants to add" });
      return;
    }

    for (const id of addMemberIds) {
      state.participantBattleById[id] = battleId;
      if (!state.activeMemberIds.includes(id)) state.activeMemberIds.push(id);
      delete state.initiativeByMember[id];
    }
    for (const id of addNpcIds) {
      state.participantBattleById[id] = battleId;
    }

    rebuildTurnOrder(state, members.map((m) => m.id));
    syncLegacyTurnState(state);
    appendEvent(state, {
      type: "participants_added",
      message: `DM added ${addMemberIds.length} player(s) and ${addNpcIds.length} NPC(s) to the encounter.`,
      metadata: { battleId, addMemberIds, addNpcIds },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to add participants to encounter" });
  }
});

// Roll initiative for an NPC (DM-side)
router.put("/party/:code/combat-npcs/:npcId/initiative", async (req, res) => {
  try {
    const { code, npcId } = req.params;
    const access = await authorizePartyHost(code, req.get("authorization"), "manage NPC instances");
    if (!access.ok) {
      res.status(access.status).json({ error: access.error, code: access.code });
      return;
    }
    const session = await ensureActiveSession(code);
    if (!session.ok) {
      res.status(session.status).json({ error: session.error });
      return;
    }

    const state = await getOrHydrateCombatState(code);
    const npc = state.combatNpcs.find((n) => n.id === npcId);
    if (!npc) {
      res.status(404).json({ error: "Combat NPC not found" });
      return;
    }

    const { initiativeRoll, initiativeBonus } = req.body ?? {};
    if (typeof initiativeRoll !== "number") {
      res.status(400).json({ error: "initiativeRoll is required" });
      return;
    }

    const roll = Math.max(1, Math.min(20, Math.floor(initiativeRoll)));
    const bonus = typeof initiativeBonus === "number" ? Math.floor(initiativeBonus) : (npc.coreStats.initiativeBonus ?? 0);
    const initiativeTotal = Math.max(1, roll + bonus);
    state.initiativeByMember[npcId] = {
      memberId: npcId,
      initiativeRoll: roll,
      initiativeBonus: bonus,
      initiativeTotal,
    };

    const members = await getLiveMembers(code);
    rebuildTurnOrder(state, members.map((m) => m.id));
    appendEvent(state, {
      type: "initiative_rolled",
      message: `${npc.name} rolled initiative ${roll}${bonus >= 0 ? ` + ${bonus}` : ` - ${Math.abs(bonus)}`} = ${initiativeTotal}.`,
      metadata: { npcId, roll, bonus, total: initiativeTotal },
    });
    await persistRuntimeState(code, state);

    res.json({ ok: true, initiativeTotal });
  } catch (err) {
    if (err instanceof RuntimeConflictError) throw err;
    res.status(500).json({ error: "Failed to roll NPC initiative" });
  }
});

export default router;

function selectedBattleIdFromRequest(
  incomingBattleId: unknown,
  activeMemberIds: string[],
  participantBattleById: Record<string, string>
): string | null {
  if (typeof incomingBattleId === "string" && incomingBattleId.trim().length > 0) {
    if (incomingBattleId === "manual" || incomingBattleId === "no-battle") return null;
    return incomingBattleId;
  }
  for (const id of activeMemberIds) {
    const battleId = participantBattleById[id];
    if (battleId) return battleId;
  }
  return null;
}

