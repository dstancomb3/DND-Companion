import AsyncStorage from "@react-native-async-storage/async-storage";
import { partyHostApi } from "./partyHostApi";
import { partyMemberApi, PartyMemberAccessError } from "./partyMemberApi";
import { API_BASE_URL } from "./apiUrl";
import type { CampaignLocation, NpcPerson, Quest, Note, Companion, InventoryItem } from "@/types";
import type { CombatTargetResolutionResult } from "@/types/combatOutcome";

export interface PartyMemberSummary {
  id: string;
  partyCode: string;
  characterName: string;
  characterClass: string;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  armorClass: number;
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  coreStats?: {
    speed: number;
    initiativeBonus: number;
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  } | null;
  presentation?: {
    themeId?: string | null;
    accentHex?: string | null;
    profileImageUri?: string | null;
  } | null;
  conditions: Array<{ id: string; name: string }>;
  companions?: Companion[];
  updatedAt: string;
}

export type PartyStatKey =
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

export interface InitiativeEntry {
  memberId: string;
  initiativeRoll: number;
  initiativeBonus: number;
  initiativeTotal: number;
}

export interface RollRequestResponse {
  memberId: string;
  roll: number;
  modifier: number;
  total: number;
  respondedAt: string;
}

export interface PartyRollRequest {
  id: string;
  statKey: PartyStatKey;
  label: string;
  targetMemberIds: string[];
  battleId?: string;
  createdAt: string;
  responses: RollRequestResponse[];
}

export interface PartyEvent {
  id: string;
  type: string;
  message: string;
  memberId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type LootAssignmentCategory = "weapon" | "armor" | "accessory" | "consumable" | "quest" | "magic" | "gear" | "treasure" | "map" | "currency" | "component" | "junk" | "other";

export interface LootAssignmentItem {
  name: string;
  quantity: number;
  category: LootAssignmentCategory;
  notes?: string;
  value?: number;
  imageUri?: string;
  imageSource?: "dm" | "player";
  inventoryItem?: Omit<InventoryItem, "id">;
}

export interface LootAssignment {
  id: string;
  targetMemberId: string;
  item: LootAssignmentItem;
  assignedBy?: string;
  assignedAt: string;
  claimedBy?: string;
  claimedAt?: string;
}

export interface NotesAssignmentPayload {
  notes?: Note[];
  quests: Quest[];
  people: NpcPerson[];
  locations: CampaignLocation[];
}

export interface NotesAssignment {
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

export type PartyRestType = "short_rest" | "long_rest";

export interface PartyRestRequest {
  id: string;
  restType: PartyRestType;
  requestedByMemberId: string;
  targetMemberIds: string[];
  requestedAt: string;
  status: "pending" | "approved" | "denied";
  resolvedAt?: string;
  resolvedBy?: string;
  acknowledgements: string[];
}

export type CombatNpcDisposition = "hostile" | "passive" | "friendly";

export type CombatNpcStatKey =
  | "speed"
  | "initiativeBonus"
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export interface CombatNpcCoreStats {
  speed: number;
  initiativeBonus: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface CombatNpcDummyState {
  maxHp: number;
  currentHp: number;
  armorClass: number;
  actionUsed: boolean;
  bonusActionUsed?: boolean;
  reactionUsed?: boolean;
  movementUsed?: number;
}

export interface CombatNpcGearItem {
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

export interface CombatConditionSummary {
  id: string;
  name: string;
}

export interface PlayerTurnEconomy {
  actionsUsed: number;
  bonusActionsUsed: number;
  reactionUsed: boolean;
  movementUsedFeet: number;
}

export interface CombatNpcProjectionMetadata {
  combatantKind: "companion";
  companionId?: string;
  ownerMemberId?: string;
  ownerCharacterId?: string;
}

export interface CombatNpc {
  id: string;
  name: string;
  sourceType: "dm-npc" | "character" | "manual" | "monster";
  sourceId?: string;
  disposition: CombatNpcDisposition;
  coreStats: CombatNpcCoreStats;
  visibleStatKeys: CombatNpcStatKey[];
  dummyState?: CombatNpcDummyState;
  gear?: CombatNpcGearItem[];
  conditions?: CombatConditionSummary[];
  projection?: CombatNpcProjectionMetadata;
  companionAdmission?: { schemaVersion: "companion-admission.v1"; memberId: string; companionId: string; detachedAt?: string; recoveredFrom?: { memberId: string; detachedAt: string; recoveredAt: string } };
  createdAt: string;
}

export interface PartyCombatState {
  code: string;
  environmentTurnId: string;
  schemaVersion?: number;
  stateRevision?: number;
  currentTurnIdByBattle: Record<string, string | null>;
  currentTurnId: string | null;
  battleTurnOrderById: Record<string, string[]>;
  turnOrder: string[];
  initiative: InitiativeEntry[];
  activeMemberIds: string[];
  participantBattleById: Record<string, string>;
  combatNpcs: CombatNpc[];
  rollRequests: PartyRollRequest[];
  lootAssignments: LootAssignment[];
  noteAssignments: NotesAssignment[];
  restRequests: PartyRestRequest[];
  eventLog: PartyEvent[];
  playerEconomyByMember?: Record<string, PlayerTurnEconomy>;
  updatedAt: string;
}

export interface EndPartyTurnPayload {
  memberId?: string;
  battleId?: string;
  isDmOverride?: boolean;
}

export interface SyncPayload {
  memberId: string;
  partyCode: string;
  characterName: string;
  characterClass: string;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  armorClass: number;
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  /** Client snapshot timestamp used for stale-update conflict guardrails. */
  snapshotUpdatedAt: number;
  coreStats?: {
    speed: number;
    initiativeBonus: number;
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  presentation?: {
    themeId?: string | null;
    accentHex?: string | null;
    profileImageUri?: string | null;
  };
  conditions: Array<{ id: string; name: string }>;
}

export class PartyConflictError extends Error {
  readonly conflictCode: "revision_conflict" | "stale_runtime_state" | "stale_member_snapshot";
  readonly expectedRevision: number | null;
  readonly currentRevision: number | null;
  readonly latestSnapshotUpdatedAt: number | null;
  constructor(payload: {
    code: "revision_conflict" | "stale_runtime_state" | "stale_member_snapshot";
    expectedRevision?: number | null;
    currentRevision?: number | null;
    latestSnapshotUpdatedAt?: number | null;
  }) {
    super(payload.code);
    this.name = "PartyConflictError";
    this.conflictCode = payload.code;
    this.expectedRevision = payload.expectedRevision ?? null;
    this.currentRevision = payload.currentRevision ?? null;
    this.latestSnapshotUpdatedAt = payload.latestSnapshotUpdatedAt ?? null;
  }
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}/api${path}`;
  const mergedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, {
    ...options,
    headers: mergedHeaders,
  });
  const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
  const isJson = contentType.includes("application/json");
  const raw = await res.text();
  let data: unknown = {};

  if (raw) {
    if (isJson) {
      try {
        data = JSON.parse(raw);
      } catch {
        const preview = raw.slice(0, 180).replace(/\s+/g, " ").trim();
        throw new Error(`Invalid JSON response from ${path}: ${preview || "<empty>"}`);
      }
    } else {
      data = { raw };
    }
  }

  if (!res.ok) {
    if (
      res.status === 409 &&
      typeof data === "object" &&
      data !== null &&
      ((data as { code?: unknown }).code === "revision_conflict" ||
        (data as { code?: unknown }).code === "stale_runtime_state" ||
        (data as { code?: unknown }).code === "stale_member_snapshot")
    ) {
      const conflict = data as {
        code: "revision_conflict" | "stale_runtime_state" | "stale_member_snapshot";
        expectedRevision?: number | null;
        currentRevision?: number | null;
        latestSnapshotUpdatedAt?: number | null;
      };
      throw new PartyConflictError({
        code: conflict.code,
        expectedRevision: conflict.expectedRevision,
        currentRevision: conflict.currentRevision,
        latestSnapshotUpdatedAt: conflict.latestSnapshotUpdatedAt,
      });
    }
    const errorMessage =
      (typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : null) ??
      (raw
        ? `Request failed (${res.status}): ${raw.slice(0, 180).replace(/\s+/g, " ").trim()}`
        : `Request failed: ${res.status}`);
    if (
      res.status === 403 &&
      typeof data === "object" &&
      data !== null &&
      ((data as { code?: string }).code === "party_member_required" ||
        (data as { code?: string }).code === "party_read_required")
    ) {
      throw new PartyMemberAccessError(errorMessage);
    }
    throw new Error(errorMessage);
  }

  if (!isJson) {
    const preview = raw.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(`Expected JSON from ${path} but received ${contentType || "unknown content type"}: ${preview || "<empty>"}`);
  }

  return data as T;
}

const hostApi = partyHostApi(apiRequest, AsyncStorage);
export interface RecoverCompanionPayload {
  targetMemberId: string;
  expectedRevision: number;
  expectedDetachedAt: string;
  reason: string;
}
export const recoverPartyCompanion = hostApi.recoverPartyCompanion;
export const createParty = hostApi.createParty;
export const removePartyMember = hostApi.removePartyMember;
const memberApi = partyMemberApi(apiRequest, AsyncStorage);
export const registerPartyMember = memberApi.registerPartyMember;
export const hasPartyMemberAccess = memberApi.hasPartyMemberAccess;

export async function joinParty(code: string): Promise<{ code: string; memberCount: number }> {
  return apiRequest<{ code: string; memberCount: number }>(`/party/join/${code}`, { method: "POST" });
}

export async function syncPartyMember(payload: SyncPayload): Promise<void> {
  await memberApi.syncPartyMember(payload);
}

async function partyReadHeaders(code: string, memberId?: string): Promise<Record<string, string>> {
  if (memberId) {
    const memberToken = await AsyncStorage.getItem(`party-member-token.v1:${code}:${memberId}`);
    if (memberToken) return { Authorization: `Bearer ${memberToken}`, "X-Party-Member-Id": memberId };
  }

  const hostToken = await AsyncStorage.getItem(`party-host-token.v1:${code}`);
  if (hostToken) return { Authorization: `Bearer ${hostToken}` };

  const memberPrefix = `party-member-token.v1:${code}:`;
  const memberKey = (await AsyncStorage.getAllKeys()).find((key) => key.startsWith(memberPrefix));
  if (memberKey) {
    const token = await AsyncStorage.getItem(memberKey);
    const storedMemberId = memberKey.slice(memberPrefix.length);
    if (token && storedMemberId) return { Authorization: `Bearer ${token}`, "X-Party-Member-Id": storedMemberId };
  }

  throw new PartyMemberAccessError("Party access is missing. Rejoin this party or open it from the host device.");
}

export async function fetchPartyMembers(code: string, memberId?: string): Promise<{ code: string; members: PartyMemberSummary[] }> {
  const response = await apiRequest<{ code: string; members: PartyMemberSummary[] }>(`/party/${code}/members`, {
    headers: await partyReadHeaders(code, memberId),
  });
  const members = [...response.members].sort((a, b) => {
    const nameCompare = a.characterName.localeCompare(b.characterName, undefined, { sensitivity: "base" });
    if (nameCompare !== 0) return nameCompare;
    return a.id.localeCompare(b.id);
  });
  return { ...response, members };
}

export const leaveParty = memberApi.leaveParty;

export const disbandParty = hostApi.disbandParty;

export async function fetchPartyCombatState(code: string, memberId?: string): Promise<PartyCombatState> {
  return apiRequest<PartyCombatState>(`/party/${code}/combat-state`, {
    headers: await partyReadHeaders(code, memberId),
  });
}

export interface PartyInitiativeStartResult {
  ok: true;
  battleId: string;
  currentTurnId: string | null;
  currentTurnIdByBattle: Record<string, string | null>;
  turnOrder: string[];
  battleTurnOrderById: Record<string, string[]>;
}

export const startPartyInitiative = hostApi.startPartyInitiative;
export const executeNpcWeaponTurn = hostApi.executeNpcWeaponTurn;

export type CreateCombatNpcPayload = {
  name: string;
  sourceType?: "dm-npc" | "character" | "manual" | "monster";
  sourceId?: string;
  disposition: CombatNpcDisposition;
  initiativeTotal?: number;
  battleId?: string;
  coreStats?: Partial<CombatNpcCoreStats>;
  dummyState?: Partial<CombatNpcDummyState>;
  visibleStatKeys?: CombatNpcStatKey[];
  gear?: CombatNpcGearItem[];
  conditions?: CombatConditionSummary[];
  projection?: CombatNpcProjectionMetadata;
};

export const addCombatNpc = hostApi.addCombatNpc;
export interface CompanionProjectionResult { ok: true; npc: CombatNpc; reused: boolean }
export const projectPartyCompanion = memberApi.projectPartyCompanion;

export const updateCombatNpcVisibleStats = hostApi.updateCombatNpcVisibleStats;

export const updateCombatNpcDummyState = hostApi.updateCombatNpcDummyState;

export const updateCombatNpcGear = hostApi.updateCombatNpcGear;

export const removeCombatNpc = hostApi.removeCombatNpc;

export const endEncounter = hostApi.endEncounter;

export const addToEncounter = hostApi.addToEncounter;

export const rollNpcInitiative = hostApi.rollNpcInitiative;

export const submitInitiativeRoll = memberApi.submitInitiativeRoll;

export async function endPartyTurn(code: string, memberId?: string): Promise<void> {
  await sendPartyEndTurn(code, memberId ? { memberId } : {});
}

export async function endPartyTurnForBattle(code: string, battleId?: string, isDmOverride?: boolean): Promise<void> {
  await sendPartyEndTurn(code, {
    ...(battleId ? { battleId } : {}),
    ...(isDmOverride ? { isDmOverride: true } : {}),
  });
}

export async function sendPartyEndTurn(code: string, payload?: EndPartyTurnPayload): Promise<void> {
  if (payload?.memberId) return memberApi.sendPartyEndTurn(code, { ...payload, memberId: payload.memberId });
  return hostApi.sendPartyEndTurn(code, payload);
}

export function getMemberEconomyFromCombatState(
  state: PartyCombatState | null | undefined,
  memberId: string | null | undefined
): PlayerTurnEconomy | null {
  if (!state || !memberId) return null;
  return state.playerEconomyByMember?.[memberId] ?? null;
}

export const spendPlayerEconomy = memberApi.spendPlayerEconomy;
export const resetPlayerEconomy = memberApi.resetPlayerEconomy;

export interface ApplyRemoteCombatOutcomesPayload {
  commandId: string;
  sourceMemberId: string;
  targetResults: CombatTargetResolutionResult[];
}

export const applyRemoteCombatOutcomes = memberApi.applyRemoteCombatOutcomes;

export const createPartyRollRequest = hostApi.createPartyRollRequest;

export const submitPartyRollResponse = memberApi.submitPartyRollResponse;

export const createPartyRestRequest = memberApi.createPartyRestRequest;

export const resolvePartyRestRequest = hostApi.resolvePartyRestRequest;

export const acknowledgePartyRestRequest = memberApi.acknowledgePartyRestRequest;

export async function appendPartyEvent(
  code: string,
  payload: { type: string; message: string; memberId?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  if (payload.memberId) return memberApi.appendPartyEvent(code, { ...payload, memberId: payload.memberId });
  return hostApi.appendPartyEvent(code, payload);
}

export async function createPartyLootAssignments(
  code: string,
  payload: { targetMemberIds: string[]; items: LootAssignmentItem[]; assignedBy?: string }
): Promise<{ ok: true; assignments: LootAssignment[] }> {
  if (payload.assignedBy && payload.assignedBy !== "dm") {
    return memberApi.createPartyLootAssignments(code, { ...payload, assignedBy: payload.assignedBy });
  }
  return hostApi.createPartyLootAssignments(code, payload);
}

export const claimPartyLootAssignment = memberApi.claimPartyLootAssignment;

export const createPartyNoteAssignments = hostApi.createPartyNoteAssignments;

export const acceptPartyNoteAssignment = memberApi.acceptPartyNoteAssignment;
export const declinePartyNoteAssignment = memberApi.declinePartyNoteAssignment;

export { PartyMemberAccessError } from "./partyMemberApi";
