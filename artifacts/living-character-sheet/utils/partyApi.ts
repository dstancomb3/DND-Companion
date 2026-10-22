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
    if (res.status === 403 && typeof data === "object" && data !== null && (data as { code?: string }).code === "party_member_required") {
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

export async function fetchPartyMembers(code: string): Promise<{ code: string; members: PartyMemberSummary[] }> {
  const response = await apiRequest<{ code: string; members: PartyMemberSummary[] }>(`/party/${code}/members`);
  const members = [...response.members].sort((a, b) => {
    const nameCompare = a.characterName.localeCompare(b.characterName, undefined, { sensitivity: "base" });
    if (nameCompare !== 0) return nameCompare;
    return a.id.localeCompare(b.id);
  });
  return { ...response, members };
}

export const leaveParty = memberApi.leaveParty;

export const disbandParty = hostApi.disbandParty;

export async function fetchPartyCombatState(code: string): Promise<PartyCombatState> {
  return apiRequest<PartyCombatState>(`/party/${code}/combat-state`);
}

export async function startPartyInitiative(
  code: string,
  includeEnvironment = true,
  targetMemberIds?: string[],
  targetNpcIds?: string[]
): Promise<{
  ok: true;
  battleId: string;
  currentTurnId: string | null;
  currentTurnIdByBattle: Record<string, string | null>;
  turnOrder: string[];
  battleTurnOrderById: Record<string, string[]>;
}> {
  return apiRequest(`/party/${code}/initiative/start`, {
    method: "POST",
    body: JSON.stringify({ includeEnvironment, targetMemberIds, targetNpcIds }),
  });
}

export async function addCombatNpc(
  code: string,
  payload: {
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
  }
): Promise<{ ok: true; npc: CombatNpc }> {
  return apiRequest<{ ok: true; npc: CombatNpc }>(`/party/${code}/combat-npcs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCombatNpcVisibleStats(
  code: string,
  npcId: string,
  payload: { visibleStatKeys: CombatNpcStatKey[] }
): Promise<{ ok: true; npc: CombatNpc }> {
  return apiRequest<{ ok: true; npc: CombatNpc }>(`/party/${code}/combat-npcs/${npcId}/visible-stats`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateCombatNpcDummyState(
  code: string,
  npcId: string,
  payload: Partial<CombatNpcDummyState>
): Promise<{ ok: true; npc: CombatNpc }> {
  return apiRequest<{ ok: true; npc: CombatNpc }>(`/party/${code}/combat-npcs/${npcId}/dummy-state`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateCombatNpcGear(
  code: string,
  npcId: string,
  payload: { gear: CombatNpcGearItem[] }
): Promise<{ ok: true; npc: CombatNpc }> {
  return apiRequest<{ ok: true; npc: CombatNpc }>(`/party/${code}/combat-npcs/${npcId}/gear`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function removeCombatNpc(code: string, npcId: string): Promise<void> {
  await apiRequest(`/party/${code}/combat-npcs/${npcId}`, {
    method: "DELETE",
  });
}

export async function endEncounter(code: string, battleId: string): Promise<void> {
  await apiRequest(`/party/${code}/encounters/${battleId}`, {
    method: "DELETE",
  });
}

export async function addToEncounter(
  code: string,
  battleId: string,
  memberIds: string[],
  npcIds: string[]
): Promise<void> {
  await apiRequest(`/party/${code}/encounters/${battleId}/participants`, {
    method: "POST",
    body: JSON.stringify({ memberIds, npcIds }),
  });
}

export async function rollNpcInitiative(
  code: string,
  npcId: string,
  initiativeRoll: number,
  initiativeBonus?: number
): Promise<{ initiativeTotal: number }> {
  return apiRequest(`/party/${code}/combat-npcs/${npcId}/initiative`, {
    method: "PUT",
    body: JSON.stringify({ initiativeRoll, initiativeBonus }),
  });
}

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
  await apiRequest(`/party/${code}/end-turn`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function getMemberEconomyFromCombatState(
  state: PartyCombatState | null | undefined,
  memberId: string | null | undefined
): PlayerTurnEconomy | null {
  if (!state || !memberId) return null;
  return state.playerEconomyByMember?.[memberId] ?? null;
}

export async function spendPlayerEconomy(
  code: string,
  memberId: string,
  slot: "action" | "bonusAction" | "reaction" | "movement",
  amount?: number,
  options?: { actionLimit?: number; bonusActionLimit?: number }
): Promise<PlayerTurnEconomy> {
  const res = await apiRequest<{ ok: true; economy: PlayerTurnEconomy }>(
    `/party/${code}/economy/spend`,
    {
      method: "POST",
      body: JSON.stringify({
        memberId,
        slot,
        amount,
        actionLimit: options?.actionLimit,
        bonusActionLimit: options?.bonusActionLimit,
      }),
    }
  );
  return res.economy;
}

export async function resetPlayerEconomy(
  code: string,
  memberId: string
): Promise<PlayerTurnEconomy> {
  const res = await apiRequest<{ ok: true; economy: PlayerTurnEconomy }>(
    `/party/${code}/economy/reset`,
    { method: "POST", body: JSON.stringify({ memberId }) }
  );
  return res.economy;
}

export interface ApplyRemoteCombatOutcomesPayload {
  commandId: string;
  sourceMemberId: string;
  targetResults: CombatTargetResolutionResult[];
}

export async function applyRemoteCombatOutcomes(
  code: string,
  payload: ApplyRemoteCombatOutcomesPayload,
): Promise<{ ok: true; appliedCount: number; replayed: boolean }> {
  return apiRequest<{ ok: true; appliedCount: number; replayed: boolean }>(
    `/party/${code}/combat/apply-outcomes`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function createPartyRollRequest(
  code: string,
  payload: { statKey: PartyStatKey; label?: string; targetMemberIds: string[]; battleId?: string }
): Promise<{ ok: true; request: PartyRollRequest }> {
  return apiRequest<{ ok: true; request: PartyRollRequest }>(`/party/${code}/roll-requests`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export const submitPartyRollResponse = memberApi.submitPartyRollResponse;

export const createPartyRestRequest = memberApi.createPartyRestRequest;

export const resolvePartyRestRequest = hostApi.resolvePartyRestRequest;

export const acknowledgePartyRestRequest = memberApi.acknowledgePartyRestRequest;

export async function appendPartyEvent(
  code: string,
  payload: { type: string; message: string; memberId?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  await apiRequest(`/party/${code}/events`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createPartyLootAssignments(
  code: string,
  payload: { targetMemberIds: string[]; items: LootAssignmentItem[]; assignedBy?: string }
): Promise<{ ok: true; assignments: LootAssignment[] }> {
  return apiRequest<{ ok: true; assignments: LootAssignment[] }>(`/party/${code}/loot-assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export const claimPartyLootAssignment = memberApi.claimPartyLootAssignment;

export const createPartyNoteAssignments = hostApi.createPartyNoteAssignments;

export const acceptPartyNoteAssignment = memberApi.acceptPartyNoteAssignment;
export const declinePartyNoteAssignment = memberApi.declinePartyNoteAssignment;

export { PartyMemberAccessError } from "./partyMemberApi";
