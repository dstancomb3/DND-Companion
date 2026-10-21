import assert from "node:assert/strict";
import test from "node:test";

import {
  findHostileNpcInBattle,
  getConnectedTargetMemberIds,
  hasHostileNpcInBattle,
  selectReusableBattleId,
} from "../../utils/adventure/campaignEncounterRuntime.ts";
import type { PartyCombatState } from "../../utils/partyApi.ts";

function buildState(): PartyCombatState {
  return {
    code: "ABCD",
    environmentTurnId: "env-1",
    currentTurnIdByBattle: { "battle-1": "member-1" },
    currentTurnId: "member-1",
    battleTurnOrderById: { "battle-1": ["member-1", "npc-1"] },
    turnOrder: ["member-1", "npc-1"],
    initiative: [],
    activeMemberIds: ["member-1"],
    participantBattleById: {
      "member-1": "battle-1",
      "npc-1": "battle-1",
    },
    combatNpcs: [
      {
        id: "npc-1",
        name: "Goblin Raider",
        sourceType: "manual",
        disposition: "hostile",
        coreStats: {
          speed: 30,
          initiativeBonus: 1,
          strength: 10,
          dexterity: 12,
          constitution: 10,
          intelligence: 8,
          wisdom: 8,
          charisma: 8,
        },
        visibleStatKeys: ["speed", "initiativeBonus"],
        createdAt: new Date().toISOString(),
      },
    ],
    rollRequests: [],
    lootAssignments: [],
    noteAssignments: [],
    restRequests: [],
    eventLog: [],
    updatedAt: new Date().toISOString(),
  };
}

test("selectReusableBattleId prefers member-linked battle", () => {
  const state = buildState();
  assert.equal(selectReusableBattleId(state, ["member-1"]), "battle-1");
});

test("selectReusableBattleId falls back to available battle when member not linked", () => {
  const state = buildState();
  assert.equal(selectReusableBattleId(state, ["member-999"]), "battle-1");
});

test("hasHostileNpcInBattle matches hostile creature names case-insensitively", () => {
  const state = buildState();
  assert.equal(
    hasHostileNpcInBattle(state, "battle-1", {
      requiresEncounterStart: true,
      hostileCreatureName: "goblin raider",
      promptRolls: [{ statKey: "initiative", label: "Roll initiative" }],
      narrationBlockedUntilResolved: true,
      intentKey: "enc-1",
    }),
    true,
  );
  assert.equal(
    hasHostileNpcInBattle(state, "battle-1", {
      requiresEncounterStart: true,
      hostileCreatureName: "Ogre",
      promptRolls: [{ statKey: "initiative", label: "Roll initiative" }],
      narrationBlockedUntilResolved: true,
      intentKey: "enc-2",
    }),
    false,
  );
});

test("findHostileNpcInBattle prefers source id matches when monster source metadata is available", () => {
  const state = buildState();
  state.combatNpcs[0] = {
    ...state.combatNpcs[0],
    sourceType: "monster",
    sourceId: "goblin-raider",
  };

  const found = findHostileNpcInBattle(state, "battle-1", {
    requiresEncounterStart: true,
    hostileCreatureName: "Any Name",
    hostileCreatureSourceType: "monster",
    hostileCreatureSourceId: "goblin-raider",
    promptRolls: [{ statKey: "initiative", label: "Roll initiative" }],
    narrationBlockedUntilResolved: true,
    intentKey: "enc-3",
  });

  assert.ok(found);
  assert.equal(found?.id, "npc-1");
  assert.equal(found?.sourceType, "monster");
  assert.equal(found?.sourceId, "goblin-raider");
});

test("findHostileNpcInBattle reuses single hostile actor when intent upgrades from generic to specific name", () => {
  const state = buildState();
  state.combatNpcs[0] = {
    ...state.combatNpcs[0],
    name: "Unknown Beast",
  };

  const found = findHostileNpcInBattle(state, "battle-1", {
    requiresEncounterStart: true,
    hostileCreatureName: "Werebear",
    promptRolls: [{ statKey: "initiative", label: "Roll initiative" }],
    narrationBlockedUntilResolved: true,
    intentKey: "enc-4",
  });

  assert.ok(found);
  assert.equal(found?.id, "npc-1");
  assert.equal(found?.name, "Werebear");
});

test("getConnectedTargetMemberIds trims, de-duplicates, and drops empty ids", () => {
  const result = getConnectedTargetMemberIds([" member-1 ", "", "member-2", "member-1"]);
  assert.deepEqual(result.sort(), ["member-1", "member-2"]);
});
