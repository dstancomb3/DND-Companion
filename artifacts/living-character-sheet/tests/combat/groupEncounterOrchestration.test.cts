import assert from "node:assert/strict";
import test from "node:test";
const { orchestrateCampaignEncounterIntent } = require("../../utils/adventure/campaignEncounterRuntime");

test("a narrated group spawns each hostile and reuses the roster on retry", async () => {
  const npcs: Array<{ id: string; name: string; disposition: string; sourceType: string }> = [];
  const participantBattleById: Record<string, string> = { player: "battle" };
  let created = 0;
  const deps = {
    startPartyInitiative: async () => { throw new Error("Existing battle should be reused"); },
    addCombatNpc: async (_code: string, payload: { name: string }) => {
      created++;
      const npc = { id: `wolf-${created}`, name: payload.name, disposition: "hostile", sourceType: "manual" };
      npcs.push(npc);
      participantBattleById[npc.id] = "battle";
      return { npc };
    },
    createPartyRollRequest: async () => ({ ok: true }),
    refreshCombatState: async () => ({}),
  };
  const encounterIntent = {
    requiresEncounterStart: true, hostileCreatureName: "Wolf", hostileCreatureCount: 3,
    promptRolls: [], narrationBlockedUntilResolved: false, intentKey: "wolves-1",
  };
  const state = () => ({
    combatNpcs: npcs, participantBattleById,
    battleTurnOrderById: { battle: ["player"] }, currentTurnIdByBattle: { battle: "player" },
    rollRequests: [],
  });
  const run = () => orchestrateCampaignEncounterIntent({
    partyCode: "PARTY", memberIds: ["player"], combatState: state(),
    encounterIntent, deps,
  });
  const first = await run();
  assert.equal(created, 3);
  assert.deepEqual(npcs.map(n => n.name), ["Wolf 1", "Wolf 2", "Wolf 3"]);
  assert.equal(first.hostileNpcIds.length, 3);
  const retry = await run();
  assert.equal(created, 3, "retry must not spawn duplicate enemies");
  assert.deepEqual(retry.hostileNpcIds, first.hostileNpcIds);
});
