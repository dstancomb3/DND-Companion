import type { RecoverCompanionPayload, NotesAssignment, NotesAssignmentPayload, PartyRestRequest, PartyInitiativeStartResult, PartyRollRequest, PartyStatKey, EndPartyTurnPayload, LootAssignment, LootAssignmentItem, CombatNpc, CombatNpcStatKey, CombatNpcDummyState, CombatNpcGearItem, CreateCombatNpcPayload } from "./partyApi";

// Keep host capabilities separate from shareable party codes and watch history.
interface HostTokenStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
const tokenKey = (code: string) => `party-host-token.v1:${code}`;

export function partyHostApi(request: Request, storage: HostTokenStorage) {
  async function encounterHeaders(code: string, action = "manage encounters"): Promise<Record<string, string>> {
    const token = await storage.getItem(tokenKey(code));
    if (!token) throw new Error(`Only the device that created this party can ${action}. Run DM or AI DM controls from that device. Older parties must expire or be recreated.`);
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }
  return {
    async recoverPartyCompanion(code: string, npcId: string, payload: RecoverCompanionPayload): Promise<{ ok: true; npc: CombatNpc }> {
      return request(`/party/${code}/combat-npcs/${npcId}/recover-companion`, {
        method: "POST", headers: await encounterHeaders(code, "recover companions"), body: JSON.stringify(payload),
      });
    },
    async createParty(): Promise<{ code: string }> {
      const { code, hostToken } = await request<{ code: string; hostToken: string }>("/party/create", { method: "POST" });
      if (!hostToken) throw new Error("The server must be updated before creating a hosted party.");
      await storage.setItem(tokenKey(code), hostToken);
      return { code };
    },
    async removePartyMember(memberId: string, code: string): Promise<void> {
      const token = await storage.getItem(tokenKey(code));
      if (!token) throw new Error("Only the device that created this party can remove another player.");
      await request("/party/leave", { method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ memberId, partyCode: code }) });
    },
    async createPartyNoteAssignments(code: string, payload: { targetMemberIds: string[]; payload: NotesAssignmentPayload; assignedBy?: string }): Promise<{ ok: true; assignments: NotesAssignment[] }> {
      const token = await storage.getItem(tokenKey(code));
      if (!token) throw new Error("Only the device that created this party can send DM notes. Older parties must expire or be recreated.");
      return request(`/party/${code}/note-assignments`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    },
    async resolvePartyRestRequest(code: string, requestId: string, payload: { status: "approved" | "denied"; resolvedBy?: string }): Promise<{ ok: true; request: PartyRestRequest }> {
      const token = await storage.getItem(tokenKey(code));
      if (!token) throw new Error("Only the device that created this party can approve or deny rest. Older parties must expire or be recreated.");
      return request(`/party/${code}/rest-requests/${requestId}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    },
    async createPartyRollRequest(code: string, payload: { statKey: PartyStatKey; label?: string; targetMemberIds: string[]; battleId?: string }): Promise<{ ok: true; request: PartyRollRequest }> {
      const token = await storage.getItem(tokenKey(code));
      if (!token) throw new Error("Only the device that created this party can create roll prompts. Run DM or AI DM controls from that device. Older parties must expire or be recreated.");
      return request(`/party/${code}/roll-requests`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    },
    async startPartyInitiative(code: string, includeEnvironment = true, targetMemberIds?: string[], targetNpcIds?: string[]): Promise<PartyInitiativeStartResult> {
      return request(`/party/${code}/initiative/start`, {
        method: "POST", headers: await encounterHeaders(code), body: JSON.stringify({ includeEnvironment, targetMemberIds, targetNpcIds }),
      });
    },
    async endEncounter(code: string, battleId: string): Promise<void> {
      await request(`/party/${code}/encounters/${battleId}`, { method: "DELETE", headers: await encounterHeaders(code) });
    },
    async addToEncounter(code: string, battleId: string, memberIds: string[], npcIds: string[]): Promise<void> {
      await request(`/party/${code}/encounters/${battleId}/participants`, {
        method: "POST", headers: await encounterHeaders(code), body: JSON.stringify({ memberIds, npcIds }),
      });
    },
    async addCombatNpc(code: string, payload: CreateCombatNpcPayload): Promise<{ ok: true; npc: CombatNpc }> {
      return request(`/party/${code}/combat-npcs`, { method: "POST", headers: await encounterHeaders(code, "create combat NPCs"), body: JSON.stringify(payload) });
    },
    async updateCombatNpcVisibleStats(code: string, npcId: string, payload: { visibleStatKeys: CombatNpcStatKey[] }): Promise<{ ok: true; npc: CombatNpc }> {
      return request(`/party/${code}/combat-npcs/${npcId}/visible-stats`, { method: "PUT", headers: await encounterHeaders(code, "manage NPC instances"), body: JSON.stringify(payload) });
    },
    async updateCombatNpcDummyState(code: string, npcId: string, payload: Partial<CombatNpcDummyState>): Promise<{ ok: true; npc: CombatNpc }> {
      return request(`/party/${code}/combat-npcs/${npcId}/dummy-state`, { method: "PUT", headers: await encounterHeaders(code, "manage NPC instances"), body: JSON.stringify(payload) });
    },
    async updateCombatNpcGear(code: string, npcId: string, payload: { gear: CombatNpcGearItem[] }): Promise<{ ok: true; npc: CombatNpc }> {
      return request(`/party/${code}/combat-npcs/${npcId}/gear`, { method: "PUT", headers: await encounterHeaders(code, "manage NPC instances"), body: JSON.stringify(payload) });
    },
    async removeCombatNpc(code: string, npcId: string): Promise<void> {
      await request(`/party/${code}/combat-npcs/${npcId}`, { method: "DELETE", headers: await encounterHeaders(code, "manage NPC instances") });
    },
    async rollNpcInitiative(code: string, npcId: string, initiativeRoll: number, initiativeBonus?: number): Promise<{ initiativeTotal: number }> {
      return request(`/party/${code}/combat-npcs/${npcId}/initiative`, { method: "PUT", headers: await encounterHeaders(code, "manage NPC instances"), body: JSON.stringify({ initiativeRoll, initiativeBonus }) });
    },
    async sendPartyEndTurn(code: string, payload: EndPartyTurnPayload = {}): Promise<void> {
      await request(`/party/${code}/end-turn`, { method: "POST", headers: await encounterHeaders(code), body: JSON.stringify(payload) });
    },
    async appendPartyEvent(code: string, payload: { type: string; message: string; memberId?: string; metadata?: Record<string, unknown> }): Promise<void> {
      await request(`/party/${code}/events`, { method: "POST", headers: await encounterHeaders(code), body: JSON.stringify(payload) });
    },
    async createPartyLootAssignments(code: string, payload: { targetMemberIds: string[]; items: LootAssignmentItem[]; assignedBy?: string }): Promise<{ ok: true; assignments: LootAssignment[] }> {
      return request(`/party/${code}/loot-assignments`, { method: "POST", headers: await encounterHeaders(code), body: JSON.stringify(payload) });
    },
    async disbandParty(code: string): Promise<void> {
      const token = await storage.getItem(tokenKey(code));
      if (!token) throw new Error("Only the device that created this party can end it. Older parties must expire or be recreated.");
      await request(`/party/${code}/disband`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      await storage.removeItem(tokenKey(code));
    },
  };
}
