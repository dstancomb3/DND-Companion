import type { NotesAssignment, LootAssignment, PartyRollRequest, PartyRestRequest, PartyRestType, EndPartyTurnPayload, PlayerTurnEconomy, ApplyRemoteCombatOutcomesPayload, LootAssignmentItem, CreateCombatNpcPayload, CompanionProjectionResult } from "./partyApi";

interface MemberStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
const tokenKey = (code: string, memberId: string) => `party-member-token.v1:${code}:${memberId}`;
const identityKey = (code: string, characterId: string) => `party-member-id.v1:${code}:${characterId}`;

export class PartyMemberAccessError extends Error {
  constructor(message: string) { super(message); this.name = "PartyMemberAccessError"; }
}

export function partyMemberApi(request: Request, storage: MemberStorage) {
  async function memberHeaders(code: string, memberId: string) {
    const token = await storage.getItem(tokenKey(code, memberId));
    if (!token) throw new PartyMemberAccessError("Member access is missing. Rejoin this party.");
    return { Authorization: `Bearer ${token}` };
  }
  async function authorizedRequest<T = void>(code: string, memberId: string, path: string, options: RequestInit) {
    try {
      return await request<T>(path, { ...options, headers: { ...options.headers, ...await memberHeaders(code, memberId) } });
    } catch (error) {
      if (error instanceof PartyMemberAccessError) await storage.removeItem(tokenKey(code, memberId));
      throw error;
    }
  }
  return {
    async registerPartyMember(code: string, characterId: string): Promise<{ memberId: string }> {
      const savedId = await storage.getItem(identityKey(code, characterId));
      if (savedId && await storage.getItem(tokenKey(code, savedId))) return { memberId: savedId };
      const result = await request<{ memberId: string; memberToken: string }>(`/party/${code}/register-member`, { method: "POST" });
      if (!result.memberId || !result.memberToken) throw new Error("The server must be updated before joining a party.");
      await storage.setItem(tokenKey(code, result.memberId), result.memberToken);
      await storage.setItem(identityKey(code, characterId), result.memberId);
      return { memberId: result.memberId };
    },
    async hasPartyMemberAccess(code: string, memberId: string): Promise<boolean> {
      return Boolean(await storage.getItem(tokenKey(code, memberId)));
    },
    async syncPartyMember<T extends { memberId: string; partyCode: string }>(payload: T): Promise<void> {
      await authorizedRequest(payload.partyCode, payload.memberId, "/party/sync", { method: "PUT", body: JSON.stringify(payload) });
    },
    async submitInitiativeRoll(code: string, payload: { memberId: string; initiativeRoll: number; initiativeBonus: number }): Promise<void> {
      await authorizedRequest(code, payload.memberId, `/party/${code}/initiative/roll`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async submitPartyRollResponse(code: string, requestId: string, payload: { memberId: string; roll: number; modifier: number; total: number }): Promise<{ ok: true; request: PartyRollRequest }> {
      return authorizedRequest(code, payload.memberId, `/party/${code}/roll-requests/${requestId}/respond`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async createPartyRestRequest(code: string, payload: { memberId: string; restType: PartyRestType }): Promise<{ ok: true; request: PartyRestRequest }> {
      return authorizedRequest(code, payload.memberId, `/party/${code}/rest-requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async acknowledgePartyRestRequest(code: string, requestId: string, payload: { memberId: string }): Promise<{ ok: true; request: PartyRestRequest }> {
      return authorizedRequest(code, payload.memberId, `/party/${code}/rest-requests/${requestId}/ack`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async claimPartyLootAssignment(code: string, assignmentId: string, payload: { memberId: string }): Promise<{ ok: true; assignment: LootAssignment }> {
      return authorizedRequest(code, payload.memberId, `/party/${code}/loot-assignments/${assignmentId}/claim`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async acceptPartyNoteAssignment(code: string, assignmentId: string, payload: { memberId: string }): Promise<{ ok: true; assignment: NotesAssignment }> {
      return authorizedRequest(code, payload.memberId, `/party/${code}/note-assignments/${assignmentId}/accept`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async declinePartyNoteAssignment(code: string, assignmentId: string, payload: { memberId: string }): Promise<{ ok: true; assignmentId: string }> {
      return authorizedRequest(code, payload.memberId, `/party/${code}/note-assignments/${assignmentId}/decline`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async projectPartyCompanion(code: string, payload: CreateCombatNpcPayload): Promise<CompanionProjectionResult> {
      const memberId = payload.projection?.ownerMemberId;
      if (!memberId || !payload.projection?.companionId) throw new Error("Companion and owner member IDs are required");
      return authorizedRequest(code, memberId, `/party/${code}/combat-npcs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async sendPartyEndTurn(code: string, payload: EndPartyTurnPayload & { memberId: string }): Promise<void> {
      await authorizedRequest(code, payload.memberId, `/party/${code}/end-turn`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async spendPlayerEconomy(code: string, memberId: string, slot: "action" | "bonusAction" | "reaction" | "movement", amount?: number, options?: { actionLimit?: number; bonusActionLimit?: number }): Promise<PlayerTurnEconomy> {
      const result = await authorizedRequest<{ ok: true; economy: PlayerTurnEconomy }>(code, memberId, `/party/${code}/economy/spend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, slot, amount, actionLimit: options?.actionLimit, bonusActionLimit: options?.bonusActionLimit }) });
      return result.economy;
    },
    async resetPlayerEconomy(code: string, memberId: string): Promise<PlayerTurnEconomy> {
      const result = await authorizedRequest<{ ok: true; economy: PlayerTurnEconomy }>(code, memberId, `/party/${code}/economy/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId }) });
      return result.economy;
    },
    async applyRemoteCombatOutcomes(code: string, payload: ApplyRemoteCombatOutcomesPayload): Promise<{ ok: true; appliedCount: number; replayed: boolean }> {
      return authorizedRequest(code, payload.sourceMemberId, `/party/${code}/combat/apply-outcomes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async appendPartyEvent(code: string, payload: { type: string; message: string; memberId: string; metadata?: Record<string, unknown> }): Promise<void> {
      await authorizedRequest(code, payload.memberId, `/party/${code}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async createPartyLootAssignments(code: string, payload: { targetMemberIds: string[]; items: LootAssignmentItem[]; assignedBy: string }): Promise<{ ok: true; assignments: LootAssignment[] }> {
      return authorizedRequest(code, payload.assignedBy, `/party/${code}/loot-assignments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    async leaveParty(memberId: string, code: string): Promise<void> {
      await authorizedRequest(code, memberId, "/party/leave", { method: "DELETE", body: JSON.stringify({ memberId, partyCode: code }) });
      await storage.removeItem(tokenKey(code, memberId));
    },
  };
}
