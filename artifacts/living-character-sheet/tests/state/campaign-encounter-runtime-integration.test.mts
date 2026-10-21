import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEncounterGateVisibilityState,
  canAcknowledgeMissingTargetOverride,
  getEncounterRollCompletionState,
  orchestrateCampaignEncounterIntent,
  recoverEncounterGateBattleContext,
  type CampaignEncounterOrchestrationDeps,
} from "../../utils/adventure/campaignEncounterRuntime.ts";
import type { CampaignRuntimeTurnEncounterIntent } from "../../utils/adventure/aiDmCampaignRuntimeApi.ts";
import type { PartyCombatState } from "../../utils/partyApi.ts";

type DepCalls = {
  startCalls: Array<{ code: string; targetMemberIds?: string[] }>;
  addNpcCalls: Array<{ code: string; name: string; battleId: string }>;
  rollCalls: Array<{ code: string; statKey: string; battleId: string; targetMemberIds: string[] }>;
  refreshCalls: string[];
};

function buildDeps(input?: {
  startBattleId?: string;
  failRollStatKeys?: string[];
}): { deps: CampaignEncounterOrchestrationDeps; calls: DepCalls } {
  const calls: DepCalls = {
    startCalls: [],
    addNpcCalls: [],
    rollCalls: [],
    refreshCalls: [],
  };

  const deps: CampaignEncounterOrchestrationDeps = {
    startPartyInitiative: async (code, _includeEnvironment, targetMemberIds) => {
      calls.startCalls.push({ code, targetMemberIds });
      return { battleId: input?.startBattleId ?? "battle-new" };
    },
    addCombatNpc: async (code, payload) => {
      calls.addNpcCalls.push({ code, name: payload.name, battleId: payload.battleId });
      return { ok: true };
    },
    createPartyRollRequest: async (code, payload) => {
      calls.rollCalls.push({
        code,
        statKey: payload.statKey,
        battleId: payload.battleId,
        targetMemberIds: payload.targetMemberIds,
      });
      if (input?.failRollStatKeys?.includes(payload.statKey)) {
        throw new Error("forced roll request failure");
      }
      return { ok: true };
    },
    refreshCombatState: async (code) => {
      calls.refreshCalls.push(code);
      return { ok: true };
    },
  };

  return { deps, calls };
}

function buildEncounterIntent(overrides?: Partial<CampaignRuntimeTurnEncounterIntent>): CampaignRuntimeTurnEncounterIntent {
  return {
    requiresEncounterStart: true,
    hostileCreatureName: "Goblin Raider",
    promptRolls: [{ statKey: "initiative", label: "Roll initiative" }],
    narrationBlockedUntilResolved: true,
    intentKey: "enc-test",
    ...overrides,
  };
}

function buildCombatState(overrides?: Partial<PartyCombatState>): PartyCombatState {
  return {
    code: "ABCD",
    environmentTurnId: "env-1",
    currentTurnIdByBattle: { "battle-1": "member-1" },
    currentTurnId: "member-1",
    battleTurnOrderById: { "battle-1": ["member-1", "npc-x"] },
    turnOrder: ["member-1", "npc-x"],
    initiative: [],
    activeMemberIds: ["member-1"],
    participantBattleById: {
      "member-1": "battle-1",
      "npc-x": "battle-1",
    },
    combatNpcs: [],
    rollRequests: [],
    lootAssignments: [],
    noteAssignments: [],
    restRequests: [],
    eventLog: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("encounter orchestration: party missing path returns system message and does not call party APIs", async () => {
  const { deps, calls } = buildDeps();
  const result = await orchestrateCampaignEncounterIntent({
    partyCode: null,
    memberIds: ["member-1"],
    combatState: buildCombatState(),
    encounterIntent: buildEncounterIntent(),
    deps,
  });

  assert.equal(result.handled, false);
  assert.match(result.systemMessage ?? "", /Join or create a party/i);
  assert.equal(calls.startCalls.length, 0);
  assert.equal(calls.addNpcCalls.length, 0);
  assert.equal(calls.rollCalls.length, 0);
  assert.equal(calls.refreshCalls.length, 0);
});

test("encounter orchestration: no connected members path returns system message and does not start encounter", async () => {
  const { deps, calls } = buildDeps();
  const result = await orchestrateCampaignEncounterIntent({
    partyCode: "ABCD",
    memberIds: ["", "   "],
    combatState: buildCombatState(),
    encounterIntent: buildEncounterIntent(),
    deps,
  });

  assert.equal(result.handled, false);
  assert.match(result.systemMessage ?? "", /No connected party members/i);
  assert.equal(calls.startCalls.length, 0);
  assert.equal(calls.addNpcCalls.length, 0);
  assert.equal(calls.rollCalls.length, 0);
  assert.equal(calls.refreshCalls.length, 0);
});

test("encounter orchestration: reuses active battle instead of creating a new one", async () => {
  const { deps, calls } = buildDeps();
  const result = await orchestrateCampaignEncounterIntent({
    partyCode: "ABCD",
    memberIds: ["member-1"],
    combatState: buildCombatState(),
    encounterIntent: buildEncounterIntent(),
    deps,
  });

  assert.equal(result.handled, true);
  assert.equal(result.startedNewEncounter, false);
  assert.equal(result.battleId, "battle-1");
  assert.equal(calls.startCalls.length, 0);
  assert.equal(calls.addNpcCalls.length, 1);
  assert.equal(calls.rollCalls.length, 1);
  assert.equal(calls.refreshCalls.length, 1);
});

test("encounter orchestration: skips duplicate hostile NPC spawn when already present in battle", async () => {
  const { deps, calls } = buildDeps();
  const stateWithHostile = buildCombatState({
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
  });

  const result = await orchestrateCampaignEncounterIntent({
    partyCode: "ABCD",
    memberIds: ["member-1"],
    combatState: stateWithHostile,
    encounterIntent: buildEncounterIntent(),
    deps,
  });

  assert.equal(result.handled, true);
  assert.equal(result.npcAlreadyPresent, true);
  assert.equal(calls.addNpcCalls.length, 0);
  assert.equal(result.hostileNpcId, "npc-1");
  assert.equal(result.hostileNpcName, "Goblin Raider");
  assert.match(result.toolMessage ?? "", /duplicate spawn skipped/i);
});

test("encounter orchestration: returns canonical hostile actor metadata after spawn", async () => {
  const { deps, calls } = buildDeps();
  const result = await orchestrateCampaignEncounterIntent({
    partyCode: "ABCD",
    memberIds: ["member-1"],
    combatState: buildCombatState(),
    encounterIntent: buildEncounterIntent({
      hostileCreatureName: "Goblin Raider",
      hostileCreatureSourceType: "monster",
      hostileCreatureSourceId: "goblin-raider",
    }),
    deps: {
      ...deps,
      addCombatNpc: async (code, payload) => {
        calls.addNpcCalls.push({ code, name: payload.name, battleId: payload.battleId });
        return {
          ok: true,
          npc: {
            id: "npc-new",
            name: payload.name,
            sourceType: payload.sourceType,
            sourceId: payload.sourceId,
          },
        };
      },
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.npcAlreadyPresent, false);
  assert.equal(result.hostileNpcId, "npc-new");
  assert.equal(result.hostileNpcName, "Goblin Raider");
  assert.equal(result.hostileNpcSourceType, "monster");
  assert.equal(result.hostileNpcSourceId, "goblin-raider");
});

test("encounter orchestration: creates initiative roll request when narration is blocked and initiative prompt is missing", async () => {
  const { deps, calls } = buildDeps();
  const result = await orchestrateCampaignEncounterIntent({
    partyCode: "ABCD",
    memberIds: ["member-1"],
    combatState: buildCombatState(),
    encounterIntent: buildEncounterIntent({
      promptRolls: [{ statKey: "perception", label: "Spot movement" }],
      narrationBlockedUntilResolved: true,
    }),
    deps,
  });

  assert.equal(result.handled, true);
  assert.equal(result.clearEncounterGate, false);
  assert.deepEqual(
    calls.rollCalls.map((entry) => entry.statKey),
    ["initiative", "perception"],
  );
  assert.deepEqual(result.createdRolls, ["initiative", "perception"]);
});

test("encounter orchestration: skips duplicate roll requests when matching battle/stat/targets already exist", async () => {
  const { deps, calls } = buildDeps();
  const combatState = buildCombatState({
    rollRequests: [
      {
        id: "roll-1",
        statKey: "initiative",
        label: "Roll initiative",
        targetMemberIds: ["member-1"],
        battleId: "battle-1",
        createdAt: new Date().toISOString(),
        responses: [],
      },
      {
        id: "roll-2",
        statKey: "perception",
        label: "Spot movement",
        targetMemberIds: ["member-1"],
        battleId: "battle-1",
        createdAt: new Date().toISOString(),
        responses: [],
      },
    ],
  });

  const result = await orchestrateCampaignEncounterIntent({
    partyCode: "ABCD",
    memberIds: ["member-1"],
    combatState,
    encounterIntent: buildEncounterIntent({
      promptRolls: [{ statKey: "perception", label: "Spot movement" }],
      narrationBlockedUntilResolved: true,
    }),
    deps,
  });

  assert.equal(result.handled, true);
  assert.equal(calls.rollCalls.length, 0);
  assert.deepEqual(result.createdRolls, []);
});

test("encounter gate recovery: stale stored battle context recomputes to active target-member battle", () => {
  const combatState = buildCombatState({
    participantBattleById: {
      "member-1": "battle-2",
      "npc-x": "battle-2",
    },
    battleTurnOrderById: {
      "battle-2": ["member-1", "npc-x"],
    },
    currentTurnIdByBattle: {
      "battle-2": "member-1",
    },
  });

  const recovery = recoverEncounterGateBattleContext({
    combatState,
    battleId: "battle-1",
    targetMemberIds: ["member-1"],
  });

  assert.equal(recovery.recovered, true);
  assert.equal(recovery.battleId, "battle-2");
});

// Phase 20: Battle switch + member churn integration test

test("encounter gate integration: battle switch + member churn sequence under locked_targets", () => {
  // Scenario: Start with battle-1, both members present.
  // Then member-2 joins battle-2, so gate should switch to battle-2.
  // Then member-1 leaves (disconnects), so gate should remain pending under locked_targets.

  // Initial state: gate on battle-1 with both members.
  const initialCombatState = buildCombatState({
    participantBattleById: {
      "member-1": "battle-1",
      "member-2": "battle-1",
      "npc-x": "battle-1",
    },
    battleTurnOrderById: {
      "battle-1": ["member-1", "member-2", "npc-x"],
    },
    currentTurnIdByBattle: {
      "battle-1": "member-1",
    },
  });

  const recovery1 = recoverEncounterGateBattleContext({
    combatState: initialCombatState,
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    targetPolicyMode: "locked_targets",
  });

  assert.equal(recovery1.recovered, false);
  assert.equal(recovery1.battleId, "battle-1");

  // Member-2 joins battle-2, member-1 stays in battle-1. Gate still locked to original targets.
  const churnedCombatState = buildCombatState({
    participantBattleById: {
      "member-1": "battle-1",
      "member-2": "battle-2",
      "npc-x": "battle-1",
      "npc-y": "battle-2",
    },
    battleTurnOrderById: {
      "battle-1": ["member-1", "npc-x"],
      "battle-2": ["member-2", "npc-y"],
    },
    currentTurnIdByBattle: {
      "battle-1": "member-1",
      "battle-2": "member-2",
    },
    currentTurnId: "member-2",
  });

  const recovery2 = recoverEncounterGateBattleContext({
    combatState: churnedCombatState,
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    targetPolicyMode: "locked_targets",
  });

  // battle-1 still has member-1, so no recovery switch needed.
  assert.equal(recovery2.recovered, false);
  assert.equal(recovery2.battleId, "battle-1");

  // Member-1 leaves (disconnects). Locked_targets should keep gate pending.
  const leftCombatState = buildCombatState({
    participantBattleById: {
      "member-2": "battle-2",
      "npc-y": "battle-2",
    },
    battleTurnOrderById: {
      "battle-2": ["member-2", "npc-y"],
    },
    currentTurnIdByBattle: {
      "battle-2": "member-2",
    },
    currentTurnId: "member-2",
  });

  const recovery3 = recoverEncounterGateBattleContext({
    combatState: leftCombatState,
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    targetPolicyMode: "locked_targets",
  });

  // No target in battle-1, but battle-2 only has member-2 (not member-1).
  // Locked policy keeps original targets locked, so gate remains on battle-1, pending.
  assert.equal(recovery3.recovered, false);
  assert.equal(recovery3.battleId, "battle-1");
  assert.deepEqual(recovery3.targetMemberIds, ["member-1", "member-2"]);
});

test("encounter gate integration: battle switch + member churn sequence under live_targets", () => {
  // Same scenario as locked_targets, but with live_targets policy.
  // When member-1 leaves, gate should recompute to just member-2 and switch to battle-2.

  const leftCombatState = buildCombatState({
    participantBattleById: {
      "member-2": "battle-2",
      "npc-y": "battle-2",
    },
    battleTurnOrderById: {
      "battle-2": ["member-2", "npc-y"],
    },
    currentTurnIdByBattle: {
      "battle-2": "member-2",
    },
    currentTurnId: "member-2",
  });

  const recovery = recoverEncounterGateBattleContext({
    combatState: leftCombatState,
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    targetPolicyMode: "live_targets",
  });

  // Live policy recomputes targets. Only member-2 is connected.
  // Switch to battle-2 (where member-2 is).
  assert.equal(recovery.targetMemberIds.length, 1);
  assert.deepEqual(recovery.targetMemberIds, ["member-2"]);
  assert.equal(recovery.battleId, "battle-2");
  assert.equal(recovery.recovered, true);
});

// Phase 21: confirmation-aware narration unblock integration

test("encounter gate integration: resolved multi-roll gate stays active until confirmation", () => {
  const combatState = buildCombatState({
    participantBattleById: {
      "member-1": "battle-1",
      "member-2": "battle-1",
      "npc-x": "battle-1",
    },
    rollRequests: [
      {
        id: "req-initiative",
        statKey: "initiative",
        label: "Roll initiative",
        targetMemberIds: ["member-1", "member-2"],
        battleId: "battle-1",
        responses: [
          {
            memberId: "member-1",
            roll: 11,
            modifier: 1,
            total: 12,
            respondedAt: new Date().toISOString(),
          },
          {
            memberId: "member-2",
            roll: 15,
            modifier: 1,
            total: 16,
            respondedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: "req-perception",
        statKey: "perception",
        label: "Spot movement",
        targetMemberIds: ["member-1", "member-2"],
        battleId: "battle-1",
        responses: [
          {
            memberId: "member-1",
            roll: 10,
            modifier: 2,
            total: 12,
            respondedAt: new Date().toISOString(),
          },
          {
            memberId: "member-2",
            roll: 12,
            modifier: 3,
            total: 15,
            respondedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const completion = getEncounterRollCompletionState({
    combatState,
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    requiredRolls: ["initiative", "perception"],
  });
  const clearEncounterGate = completion.canEvaluate && completion.unresolvedRolls.length === 0;

  const visibilityPreConfirm = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative", "perception"],
    createdRolls: ["initiative", "perception"],
    failedRolls: [],
    resolvedRolls: completion.resolvedRolls,
    clearEncounterGate,
    clearConfirmed: false,
  });

  const visibilityPostConfirm = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative", "perception"],
    createdRolls: ["initiative", "perception"],
    failedRolls: [],
    resolvedRolls: completion.resolvedRolls,
    clearEncounterGate,
    clearConfirmed: true,
  });

  assert.equal(visibilityPreConfirm.status, "cleared");
  assert.equal(visibilityPreConfirm.isActive, true);
  assert.equal(visibilityPreConfirm.clearConfirmed, false);

  assert.equal(visibilityPostConfirm.status, "cleared");
  assert.equal(visibilityPostConfirm.isActive, false);
  assert.equal(visibilityPostConfirm.clearConfirmed, true);
});

test("encounter gate integration: confirmed gate reopens when later combat update is unresolved", () => {
  const resolvedCombatState = buildCombatState({
    participantBattleById: {
      "member-1": "battle-1",
      "member-2": "battle-1",
      "npc-x": "battle-1",
    },
    rollRequests: [
      {
        id: "req-initiative",
        statKey: "initiative",
        label: "Roll initiative",
        targetMemberIds: ["member-1", "member-2"],
        battleId: "battle-1",
        responses: [
          { memberId: "member-1", roll: 10, modifier: 1, total: 11, respondedAt: new Date().toISOString() },
          { memberId: "member-2", roll: 14, modifier: 1, total: 15, respondedAt: new Date().toISOString() },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const resolvedCompletion = getEncounterRollCompletionState({
    combatState: resolvedCombatState,
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    requiredRolls: ["initiative"],
  });

  const confirmedVisibility = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: resolvedCompletion.resolvedRolls,
    clearEncounterGate: resolvedCompletion.unresolvedRolls.length === 0,
    clearConfirmed: true,
    confirmedAtMs: 123456,
    confirmedBy: "dm_local",
    confirmationSource: "ui_confirm_action",
  });

  const unresolvedCombatState = buildCombatState({
    participantBattleById: {
      "member-1": "battle-1",
      "member-2": "battle-1",
      "npc-x": "battle-1",
    },
    rollRequests: [
      {
        id: "req-initiative",
        statKey: "initiative",
        label: "Roll initiative",
        targetMemberIds: ["member-1", "member-2"],
        battleId: "battle-1",
        responses: [
          { memberId: "member-1", roll: 10, modifier: 1, total: 11, respondedAt: new Date().toISOString() },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const unresolvedCompletion = getEncounterRollCompletionState({
    combatState: unresolvedCombatState,
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    requiredRolls: ["initiative"],
  });

  const reopenedVisibility = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: unresolvedCompletion.resolvedRolls,
    clearEncounterGate: unresolvedCompletion.unresolvedRolls.length === 0,
    clearConfirmed: true,
    confirmedAtMs: confirmedVisibility.confirmedAtMs,
    confirmedBy: confirmedVisibility.confirmedBy,
    confirmationSource: confirmedVisibility.confirmationSource,
  });

  assert.equal(confirmedVisibility.isActive, false);
  assert.equal(confirmedVisibility.clearConfirmed, true);

  assert.equal(reopenedVisibility.isActive, true);
  assert.equal(reopenedVisibility.clearConfirmed, false);
  assert.equal(reopenedVisibility.confirmedAtMs, undefined);
  assert.deepEqual(unresolvedCompletion.unresolvedRolls, ["initiative"]);
});

test("encounter gate integration: locked target departs, DM override unblocks, next encounter resets override", () => {
  const staleCompletion = getEncounterRollCompletionState({
    combatState: buildCombatState({
      participantBattleById: {
        "member-2": "battle-2",
        "npc-x": "battle-2",
      },
      battleTurnOrderById: {
        "battle-2": ["member-2", "npc-x"],
      },
    }),
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    requiredRolls: ["initiative"],
    targetPolicyMode: "locked_targets",
  });

  const preOverride = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: staleCompletion.resolvedRolls,
    healthReasonCode: staleCompletion.healthReasonCode,
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
  });

  const canOverride = canAcknowledgeMissingTargetOverride({
    targetPolicyMode: "locked_targets",
    healthReasonCode: preOverride.healthReasonCode,
    isActive: preOverride.isActive,
  });

  const postOverride = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: staleCompletion.resolvedRolls,
    healthReasonCode: staleCompletion.healthReasonCode,
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 222,
    overrideBy: "dm_local",
  });

  // Next encounter starts and override must reset.
  const nextEncounter = buildEncounterGateVisibilityState({
    reason: "Encounter pending: New scene",
    requiredRolls: ["initiative"],
    createdRolls: [],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
  });

  assert.equal(preOverride.isActive, true);
  assert.equal(canOverride, true);
  assert.equal(postOverride.isActive, false);
  assert.equal(postOverride.overrideMode, "acknowledge_missing_targets");
  assert.equal(nextEncounter.overrideMode, "none");
  assert.equal(nextEncounter.isActive, true);
});

test("encounter gate integration: override apply, revoke, reapply, and expiry transitions are deterministic", () => {
  const unresolvedCompletion = getEncounterRollCompletionState({
    combatState: buildCombatState({
      participantBattleById: {
        "member-2": "battle-2",
        "npc-x": "battle-2",
      },
      battleTurnOrderById: {
        "battle-2": ["member-2", "npc-x"],
      },
    }),
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    requiredRolls: ["initiative"],
    targetPolicyMode: "locked_targets",
  });

  const activeOverride = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: unresolvedCompletion.resolvedRolls,
    healthReasonCode: unresolvedCompletion.healthReasonCode,
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideStatus: "active",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 100,
    overrideExpiresAtMs: 100 + 5 * 60 * 1000,
    overrideBy: "dm_local",
  });

  const revokedOverride = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: unresolvedCompletion.resolvedRolls,
    healthReasonCode: unresolvedCompletion.healthReasonCode,
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideStatus: "revoked",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 100,
    overrideRevokedAtMs: 200,
    overrideRevokedBy: "dm_local",
  });

  const reappliedOverride = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: unresolvedCompletion.resolvedRolls,
    healthReasonCode: unresolvedCompletion.healthReasonCode,
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideStatus: "active",
    overrideReasonCode: "manual_dm_ack",
    overrideAtMs: 300,
    overrideExpiresAtMs: 300 + 5 * 60 * 1000,
    overrideBy: "dm_local",
  });

  const expiredOverride = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: unresolvedCompletion.resolvedRolls,
    healthReasonCode: unresolvedCompletion.healthReasonCode,
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideStatus: "expired",
    overrideReasonCode: "manual_dm_ack",
    overrideAtMs: 300,
    overrideExpiresAtMs: 300 + 5 * 60 * 1000,
    overrideBy: "dm_local",
  });

  assert.equal(activeOverride.isActive, false);
  assert.equal(activeOverride.overrideStatus, "active");

  assert.equal(revokedOverride.isActive, true);
  assert.equal(revokedOverride.overrideStatus, "revoked");

  assert.equal(reappliedOverride.isActive, false);
  assert.equal(reappliedOverride.overrideReasonCode, "manual_dm_ack");

  assert.equal(expiredOverride.isActive, true);
  assert.equal(expiredOverride.overrideStatus, "expired");
  assert.match(expiredOverride.summary, /expired/i);
});
