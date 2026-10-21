import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEncounterGateVisibilityState,
  canAcknowledgeMissingTargetOverride,
  describeEncounterGateHealthReason,
  getEncounterGateTimeoutState,
  getEncounterRollCompletionState,
  getRequiredEncounterRolls,
  orchestrateCampaignEncounterIntent,
  recoverEncounterGateBattleContext,
  selectRankedBattleCandidates,
  determineBestBattleCandidate,
  type CampaignEncounterOrchestrationDeps,
} from "../../utils/adventure/campaignEncounterRuntime.ts";
import type { CampaignRuntimeTurnEncounterIntent } from "../../utils/adventure/aiDmCampaignRuntimeApi.ts";
import type { PartyCombatState } from "../../utils/partyApi.ts";

function buildEncounterIntent(overrides?: Partial<CampaignRuntimeTurnEncounterIntent>): CampaignRuntimeTurnEncounterIntent {
  return {
    requiresEncounterStart: true,
    hostileCreatureName: "Goblin Raider",
    promptRolls: [{ statKey: "perception", label: "Spot movement" }],
    narrationBlockedUntilResolved: true,
    intentKey: "enc-visibility",
    ...overrides,
  };
}

function buildCombatState(): PartyCombatState {
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
    combatNpcs: [],
    rollRequests: [],
    lootAssignments: [],
    noteAssignments: [],
    restRequests: [],
    eventLog: [],
    updatedAt: new Date().toISOString(),
  };
}

function buildDeps(input?: { failStatKeys?: string[] }): CampaignEncounterOrchestrationDeps {
  return {
    startPartyInitiative: async () => ({ battleId: "battle-new" }),
    addCombatNpc: async () => ({ ok: true }),
    createPartyRollRequest: async (_code, payload) => {
      if (input?.failStatKeys?.includes(payload.statKey)) {
        throw new Error("forced roll failure");
      }
      return { ok: true };
    },
    refreshCombatState: async () => ({ ok: true }),
  };
}

test("pending gate reason and required rolls are deterministic before orchestration", () => {
  const encounterIntent = buildEncounterIntent();
  const required = getRequiredEncounterRolls(encounterIntent);
  const visibility = buildEncounterGateVisibilityState({
    reason: `Encounter pending: ${encounterIntent.hostileCreatureName}. Resolve required encounter prompts before continuing story turns.`,
    requiredRolls: required,
    createdRolls: [],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
  });

  assert.deepEqual(required, ["initiative", "perception"]);
  assert.equal(visibility.isActive, true);
  assert.equal(visibility.status, "pending");
  assert.match(visibility.reason, /Encounter pending/i);
  assert.equal(visibility.summary, "Resolved 0/2 required prompts.");
  assert.equal(visibility.completionSummary, "Roll completion 0/2.");
});

test("gate progress reports created and failed required prompts deterministically", () => {
  const visibility = buildEncounterGateVisibilityState({
    reason: "Encounter pending: Goblin Raider. Resolve required encounter prompts before continuing story turns.",
    requiredRolls: ["initiative", "perception"],
    createdRolls: ["initiative"],
    failedRolls: ["perception"],
    resolvedRolls: ["initiative"],
    clearEncounterGate: false,
  });

  assert.equal(visibility.isActive, true);
  assert.equal(visibility.status, "blocked");
  assert.deepEqual(visibility.createdRolls, ["initiative"]);
  assert.deepEqual(visibility.failedRolls, ["perception"]);
  assert.deepEqual(visibility.resolvedRolls, ["initiative"]);
  assert.deepEqual(visibility.unresolvedRolls, ["perception"]);
  assert.equal(visibility.summary, "Resolved 1/2 required prompts.");
  assert.equal(visibility.completionSummary, "Roll completion 1/2.");
});

test("encounter orchestration does not clear gate during prompt creation pass", async () => {
  const encounterIntent = buildEncounterIntent();
  const partyCode = "ABCD";
  const memberIds = ["member-1"];
  const combatState = buildCombatState();

  const partialOutcome = await orchestrateCampaignEncounterIntent({
    partyCode,
    memberIds,
    combatState,
    encounterIntent,
    deps: buildDeps({ failStatKeys: ["perception"] }),
  });
  assert.equal(partialOutcome.clearEncounterGate, false);
  assert.deepEqual(partialOutcome.requiredRolls, ["initiative", "perception"]);
  assert.deepEqual(partialOutcome.createdRolls, ["initiative"]);

  const fullOutcome = await orchestrateCampaignEncounterIntent({
    partyCode,
    memberIds,
    combatState,
    encounterIntent,
    deps: buildDeps(),
  });
  assert.equal(fullOutcome.clearEncounterGate, false);
  assert.deepEqual(fullOutcome.requiredRolls, ["initiative", "perception"]);
  assert.deepEqual(fullOutcome.createdRolls, ["initiative", "perception"]);
});

test("required roll completion resolves only after all targeted members respond", () => {
  const completion = getEncounterRollCompletionState({
    combatState: {
      ...buildCombatState(),
      rollRequests: [
        {
          id: "req-1",
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
          ],
          createdAt: new Date().toISOString(),
        },
      ],
    },
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    requiredRolls: ["initiative"],
  });

  assert.deepEqual(completion.resolvedRolls, []);
  assert.deepEqual(completion.unresolvedRolls, ["initiative"]);
  assert.equal(completion.canEvaluate, true);
});

test("required roll completion clears when all required rolls have full responses", () => {
  const completion = getEncounterRollCompletionState({
    combatState: {
      ...buildCombatState(),
      rollRequests: [
        {
          id: "req-1",
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
              roll: 13,
              modifier: 1,
              total: 14,
              respondedAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
    },
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    requiredRolls: ["initiative"],
  });

  assert.deepEqual(completion.resolvedRolls, ["initiative"]);
  assert.deepEqual(completion.unresolvedRolls, []);
  assert.equal(completion.canEvaluate, true);
});

test("duplicate same-stat requests resolve when one exact-target request is fully answered", () => {
  const completion = getEncounterRollCompletionState({
    combatState: {
      ...buildCombatState(),
      rollRequests: [
        {
          id: "req-1",
          statKey: "initiative",
          label: "Roll initiative",
          targetMemberIds: ["member-1", "member-2"],
          battleId: "battle-1",
          responses: [
            {
              memberId: "member-1",
              roll: 9,
              modifier: 1,
              total: 10,
              respondedAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
        },
        {
          id: "req-2",
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
              roll: 13,
              modifier: 1,
              total: 14,
              respondedAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
    },
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    requiredRolls: ["initiative"],
  });

  assert.deepEqual(completion.resolvedRolls, ["initiative"]);
  assert.deepEqual(completion.unresolvedRolls, []);
  assert.equal(completion.canEvaluate, true);
});

test("mismatched target-member set does not satisfy required roll completion", () => {
  const completion = getEncounterRollCompletionState({
    combatState: {
      ...buildCombatState(),
      rollRequests: [
        {
          id: "req-1",
          statKey: "initiative",
          label: "Roll initiative",
          targetMemberIds: ["member-1"],
          battleId: "battle-1",
          responses: [
            {
              memberId: "member-1",
              roll: 11,
              modifier: 1,
              total: 12,
              respondedAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
    },
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    requiredRolls: ["initiative"],
  });

  assert.deepEqual(completion.resolvedRolls, []);
  assert.deepEqual(completion.unresolvedRolls, ["initiative"]);
  assert.equal(completion.canEvaluate, true);
});

test("null battle context remains pending and reports health reason", () => {
  const completion = getEncounterRollCompletionState({
    combatState: buildCombatState(),
    battleId: null,
    targetMemberIds: ["member-1"],
    requiredRolls: ["initiative"],
  });

  assert.deepEqual(completion.resolvedRolls, []);
  assert.deepEqual(completion.unresolvedRolls, ["initiative"]);
  assert.equal(completion.canEvaluate, false);
  assert.equal(completion.healthReasonCode, "missing_battle_context");
  assert.equal(completion.healthReason, "Waiting for authoritative battle context.");
});

test("stale battle context remains pending and reports stale reason code", () => {
  const completion = getEncounterRollCompletionState({
    combatState: {
      ...buildCombatState(),
      participantBattleById: {
        "member-1": "battle-2",
        "npc-1": "battle-2",
      },
      battleTurnOrderById: {
        "battle-2": ["member-1", "npc-1"],
      },
    },
    battleId: "battle-1",
    targetMemberIds: ["member-1"],
    requiredRolls: ["initiative"],
  });

  assert.deepEqual(completion.resolvedRolls, []);
  assert.deepEqual(completion.unresolvedRolls, ["initiative"]);
  assert.equal(completion.canEvaluate, false);
  assert.equal(completion.healthReasonCode, "stale_battle_context");
  assert.equal(completion.healthReason, "Waiting for refreshed battle context after encounter state changed.");
});

test("recovery helper promotes stale battle context to active member battle", () => {
  const recovery = recoverEncounterGateBattleContext({
    combatState: {
      ...buildCombatState(),
      participantBattleById: {
        "member-1": "battle-2",
        "npc-1": "battle-2",
      },
      battleTurnOrderById: {
        "battle-2": ["member-1", "npc-1"],
      },
      currentTurnIdByBattle: {
        "battle-2": "member-1",
      },
    },
    battleId: "battle-1",
    targetMemberIds: ["member-1"],
  });

  assert.equal(recovery.recovered, true);
  assert.equal(recovery.battleId, "battle-2");
});

test("timeout state becomes watch at 30s and delayed at 90s", () => {
  const normal = getEncounterGateTimeoutState(29_999);
  const watch = getEncounterGateTimeoutState(30_000);
  const delayed = getEncounterGateTimeoutState(90_000);

  assert.equal(normal.status, "normal");
  assert.equal(watch.status, "watch");
  assert.match(watch.summary ?? "", /30s/i);
  assert.equal(delayed.status, "delayed");
  assert.match(delayed.summary ?? "", /90s/i);
});

test("health reason description mapping is stable for taxonomy codes", () => {
  assert.equal(describeEncounterGateHealthReason("missing_combat_state"), "Waiting for live combat state.");
  assert.equal(describeEncounterGateHealthReason("missing_battle_context"), "Waiting for authoritative battle context.");
  assert.equal(describeEncounterGateHealthReason("missing_targets"), "Waiting for target member resolution.");
  assert.equal(describeEncounterGateHealthReason("stale_battle_context"), "Waiting for refreshed battle context after encounter state changed.");
  assert.equal(describeEncounterGateHealthReason("awaiting_responses"), "Waiting for required roll responses.");
});

// Phase 21: Confirmation-aware gate clear semantics

test("cleared gate remains active until clear is confirmed", () => {
  const visibility = buildEncounterGateVisibilityState({
    reason: "Encounter pending: Goblin Raider. Resolve required encounter prompts before continuing story turns.",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: ["initiative"],
    clearEncounterGate: true,
  });

  assert.equal(visibility.status, "cleared");
  assert.equal(visibility.clearConfirmed, false);
  assert.equal(visibility.isActive, true);
  assert.match(visibility.summary, /confirm to continue story narration/i);
});

test("confirmed cleared gate becomes inactive", () => {
  const visibility = buildEncounterGateVisibilityState({
    reason: "Encounter pending: Goblin Raider. Resolve required encounter prompts before continuing story turns.",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: ["initiative"],
    clearEncounterGate: true,
    clearConfirmed: true,
  });

  assert.equal(visibility.status, "cleared");
  assert.equal(visibility.clearConfirmed, true);
  assert.equal(visibility.isActive, false);
  assert.match(visibility.summary, /story narration can continue/i);
});

test("confirmation flag controls active state transition deterministically", () => {
  const preConfirm = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative", "perception"],
    createdRolls: ["initiative", "perception"],
    failedRolls: [],
    resolvedRolls: ["initiative", "perception"],
    clearEncounterGate: true,
    clearConfirmed: false,
  });

  const postConfirm = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative", "perception"],
    createdRolls: ["initiative", "perception"],
    failedRolls: [],
    resolvedRolls: ["initiative", "perception"],
    clearEncounterGate: true,
    clearConfirmed: true,
  });

  assert.equal(preConfirm.isActive, true);
  assert.equal(postConfirm.isActive, false);
  assert.equal(preConfirm.status, "cleared");
  assert.equal(postConfirm.status, "cleared");
});

test("refresh-style re-evaluation preserves cleared-unconfirmed state", () => {
  const firstPass = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: ["initiative"],
    gateAgeMs: 42_000,
    clearEncounterGate: true,
    clearConfirmed: false,
  });
  const refreshedPass = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: ["initiative"],
    gateAgeMs: 43_000,
    clearEncounterGate: true,
    clearConfirmed: false,
  });

  assert.equal(firstPass.status, "cleared");
  assert.equal(firstPass.isActive, true);
  assert.equal(refreshedPass.status, "cleared");
  assert.equal(refreshedPass.isActive, true);
  assert.equal(refreshedPass.clearConfirmed, false);
});

// Phase 22: confirmation audit trail + reopen semantics

test("confirmation metadata is preserved when clear is confirmed", () => {
  const visibility = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: ["initiative"],
    clearEncounterGate: true,
    clearConfirmed: true,
    confirmedAtMs: 123456,
    confirmedBy: "dm_local",
    confirmationSource: "ui_confirm_action",
  });

  assert.equal(visibility.clearConfirmed, true);
  assert.equal(visibility.confirmedAtMs, 123456);
  assert.equal(visibility.confirmedBy, "dm_local");
  assert.equal(visibility.confirmationSource, "ui_confirm_action");
});

test("confirmed gate reopens when unresolved rolls reappear", () => {
  const reopened = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative", "perception"],
    createdRolls: ["initiative", "perception"],
    failedRolls: [],
    resolvedRolls: ["initiative"],
    clearEncounterGate: false,
    clearConfirmed: true,
    confirmedAtMs: 123456,
    confirmedBy: "dm_local",
    confirmationSource: "ui_confirm_action",
  });

  assert.equal(reopened.status, "partially_ready");
  assert.equal(reopened.isActive, true);
  assert.equal(reopened.clearConfirmed, false);
});

test("reopen clears confirmation metadata in visibility output", () => {
  const reopened = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
    clearConfirmed: true,
    confirmedAtMs: 123456,
    confirmedBy: "dm_local",
    confirmationSource: "ui_confirm_action",
  });

  assert.equal(reopened.clearConfirmed, false);
  assert.equal(reopened.confirmedAtMs, undefined);
  assert.equal(reopened.confirmedBy, undefined);
  assert.equal(reopened.confirmationSource, undefined);
});

test("refresh with stable cleared state preserves confirmation metadata", () => {
  const firstPass = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: ["initiative"],
    clearEncounterGate: true,
    clearConfirmed: true,
    confirmedAtMs: 123456,
    confirmedBy: "dm_local",
    confirmationSource: "ui_confirm_action",
  });
  const refreshedPass = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: ["initiative"],
    clearEncounterGate: true,
    clearConfirmed: true,
    confirmedAtMs: 123456,
    confirmedBy: "dm_local",
    confirmationSource: "ui_confirm_action",
  });

  assert.equal(firstPass.clearConfirmed, true);
  assert.equal(refreshedPass.clearConfirmed, true);
  assert.equal(refreshedPass.confirmedAtMs, 123456);
  assert.equal(refreshedPass.confirmationSource, "ui_confirm_action");
});

// Phase 23: locked-target override path

test("override acknowledge action is unavailable outside locked_targets policy", () => {
  const canOverride = canAcknowledgeMissingTargetOverride({
    targetPolicyMode: "live_targets",
    healthReasonCode: "missing_targets",
    isActive: true,
  });

  assert.equal(canOverride, false);
});

test("override acknowledge action is available for locked_targets stale/missing context", () => {
  const staleAllowed = canAcknowledgeMissingTargetOverride({
    targetPolicyMode: "locked_targets",
    healthReasonCode: "stale_battle_context",
    isActive: true,
  });
  const missingAllowed = canAcknowledgeMissingTargetOverride({
    targetPolicyMode: "locked_targets",
    healthReasonCode: "missing_targets",
    isActive: true,
  });

  assert.equal(staleAllowed, true);
  assert.equal(missingAllowed, true);
});

test("override marks gate inactive and records override metadata", () => {
  const visibility = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: [],
    healthReasonCode: "missing_targets",
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 777,
    overrideBy: "dm_local",
  });

  assert.equal(visibility.isActive, false);
  assert.equal(visibility.overrideMode, "acknowledge_missing_targets");
  assert.equal(visibility.overrideReasonCode, "missing_target_departed");
  assert.equal(visibility.overrideAtMs, 777);
  assert.equal(visibility.overrideBy, "dm_local");
  assert.match(visibility.summary, /override acknowledged/i);
});

test("override resets when next encounter context does not carry override metadata", () => {
  const withOverride = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 777,
    overrideBy: "dm_local",
  });
  const resetForNextEncounter = buildEncounterGateVisibilityState({
    reason: "Encounter pending: New battle",
    requiredRolls: ["initiative"],
    createdRolls: [],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
  });

  assert.equal(withOverride.overrideMode, "acknowledge_missing_targets");
  assert.equal(resetForNextEncounter.overrideMode, "none");
  assert.equal(resetForNextEncounter.isActive, true);
});

// Phase 24: override lifecycle safety window

test("active override exposes revoke path conditions", () => {
  const activeOverride = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideStatus: "active",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 100,
    overrideExpiresAtMs: 5 * 60 * 1000 + 100,
    overrideBy: "dm_local",
  });

  assert.equal(activeOverride.isActive, false);
  assert.equal(activeOverride.overrideStatus, "active");
  assert.equal(activeOverride.overrideExpiresAtMs, 5 * 60 * 1000 + 100);
});

test("revoked override returns gate to active unresolved behavior", () => {
  const revoked = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideStatus: "revoked",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 100,
    overrideRevokedAtMs: 200,
    overrideRevokedBy: "dm_local",
  });

  assert.equal(revoked.isActive, true);
  assert.equal(revoked.overrideStatus, "revoked");
  assert.equal(revoked.overrideRevokedAtMs, 200);
  assert.equal(revoked.overrideRevokedBy, "dm_local");
  assert.match(revoked.summary, /revoked/i);
});

test("expired override clears override effect and restores gate blocking", () => {
  const expired = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideStatus: "expired",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 100,
    overrideExpiresAtMs: 300,
    overrideBy: "dm_local",
  });

  assert.equal(expired.isActive, true);
  assert.equal(expired.overrideStatus, "expired");
  assert.equal(expired.overrideMode, "acknowledge_missing_targets");
  assert.equal(expired.overrideAtMs, undefined);
  assert.equal(expired.overrideExpiresAtMs, 300);
  assert.match(expired.summary, /expired/i);
});

test("override metadata transitions active to revoked and active to expired", () => {
  const active = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideStatus: "active",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 100,
    overrideExpiresAtMs: 300,
    overrideBy: "dm_local",
  });
  const revoked = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideStatus: "revoked",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 100,
    overrideRevokedAtMs: 200,
    overrideRevokedBy: "dm_local",
  });
  const expired = buildEncounterGateVisibilityState({
    reason: "Encounter pending",
    requiredRolls: ["initiative"],
    createdRolls: ["initiative"],
    failedRolls: [],
    resolvedRolls: [],
    clearEncounterGate: false,
    targetPolicyMode: "locked_targets",
    overrideMode: "acknowledge_missing_targets",
    overrideStatus: "expired",
    overrideReasonCode: "missing_target_departed",
    overrideAtMs: 100,
    overrideExpiresAtMs: 300,
    overrideBy: "dm_local",
  });

  assert.equal(active.overrideStatus, "active");
  assert.equal(revoked.overrideStatus, "revoked");
  assert.equal(expired.overrideStatus, "expired");
});

// Phase 20: Multi-battle and membership churn tests

test("deterministic battle candidate ranking with 3 battles and overlapping coverage", () => {
  const combatState = {
    ...buildCombatState(),
    participantBattleById: {
      "member-1": "battle-1",
      "member-2": "battle-2",
      "member-3": "battle-2",
      "npc-1": "battle-1",
      "npc-2": "battle-2",
      "npc-3": "battle-3",
    },
    currentTurnIdByBattle: {
      "battle-1": "member-1",
      "battle-2": "member-2",
      "battle-3": "npc-3",
    },
    currentTurnId: "member-2",
    battleTurnOrderById: {
      "battle-1": ["member-1", "npc-1"],
      "battle-2": ["member-2", "member-3", "npc-2"],
      "battle-3": ["npc-3"],
    },
  };

  const candidates = selectRankedBattleCandidates(combatState, ["member-1", "member-2", "member-3"]);

  // battle-2 should rank first: 2 target members (member-2, member-3)
  // battle-1 should rank second: 1 target member (member-1)
  // battle-3 should not appear: 0 target members
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].battleId, "battle-2");
  assert.equal(candidates[0].targetMemberCount, 2);
  assert.equal(candidates[1].battleId, "battle-1");
  assert.equal(candidates[1].targetMemberCount, 1);
});

test("tie-break stability with same target count prefers active turn holder", () => {
  const combatState = {
    ...buildCombatState(),
    participantBattleById: {
      "member-1": "battle-1",
      "member-2": "battle-2",
      "npc-1": "battle-1",
      "npc-2": "battle-2",
    },
    currentTurnIdByBattle: {
      "battle-1": "member-1",
      "battle-2": "member-2",
    },
    currentTurnId: "member-2",
    battleTurnOrderById: {
      "battle-1": ["member-1", "npc-1"],
      "battle-2": ["member-2", "npc-2"],
    },
  };

  const candidates = selectRankedBattleCandidates(combatState, ["member-1", "member-2"]);

  // Both have 1 target member. battle-2's active turn holder (member-2) should win.
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].battleId, "battle-2");
  assert.equal(candidates[0].hasActiveTurnTarget, true);
  assert.equal(candidates[1].battleId, "battle-1");
  assert.equal(candidates[1].hasActiveTurnTarget, false);
});

test("determineBestBattleCandidate prefers current battle if it covers targets", () => {
  const combatState = {
    ...buildCombatState(),
    participantBattleById: {
      "member-1": "battle-1",
      "member-2": "battle-2",
      "npc-1": "battle-1",
      "npc-2": "battle-2",
    },
    currentTurnIdByBattle: {
      "battle-1": "member-1",
      "battle-2": "member-2",
    },
    currentTurnId: "member-2",
    battleTurnOrderById: {
      "battle-1": ["member-1", "npc-1"],
      "battle-2": ["member-2", "npc-2"],
    },
  };

  const candidates = selectRankedBattleCandidates(combatState, ["member-1", "member-2"]);
  const best = determineBestBattleCandidate(candidates, "battle-1");

  // Even though battle-2 ranks higher, battle-1 is current and covers a target, so prefer it.
  assert.equal(best?.battleId, "battle-1");
  assert.equal(best?.rationale, "preferred_current_battle");
});

test("determineBestBattleCandidate switches to highest coverage when current lacks targets", () => {
  const combatState = {
    ...buildCombatState(),
    participantBattleById: {
      "member-1": "battle-2",
      "member-2": "battle-2",
      "npc-1": "battle-1",
      "npc-2": "battle-2",
    },
    currentTurnIdByBattle: {
      "battle-1": "npc-1",
      "battle-2": "member-2",
    },
    currentTurnId: "member-2",
    battleTurnOrderById: {
      "battle-1": ["npc-1"],
      "battle-2": ["member-2", "member-1", "npc-2"],
    },
  };

  const candidates = selectRankedBattleCandidates(combatState, ["member-1", "member-2"]);
  const best = determineBestBattleCandidate(candidates, "battle-1");

  // battle-1 has no targets, so switch to battle-2 (coverage rationale).
  assert.equal(best?.battleId, "battle-2");
  assert.equal(best?.rationale, "target_coverage");
});

test("membership churn under locked_targets keeps gate pending if member leaves", () => {
  const combatState = {
    ...buildCombatState(),
    participantBattleById: {
      "member-1": "battle-1",
      "npc-1": "battle-1",
    },
    battleTurnOrderById: {
      "battle-1": ["member-1", "npc-1"],
    },
  };

  const recovery = recoverEncounterGateBattleContext({
    combatState,
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    targetPolicyMode: "locked_targets",
  });

  // member-2 is gone but policy is locked, so no recovery switch.
  assert.equal(recovery.recovered, false);
  assert.equal(recovery.targetMemberIds.length, 2);
  assert.deepEqual(recovery.targetMemberIds, ["member-1", "member-2"]);
});

test("membership churn under live_targets recomputes targets when member leaves", () => {
  const combatState = {
    ...buildCombatState(),
    participantBattleById: {
      "member-1": "battle-1",
      "npc-1": "battle-1",
    },
    battleTurnOrderById: {
      "battle-1": ["member-1", "npc-1"],
    },
  };

  const recovery = recoverEncounterGateBattleContext({
    combatState,
    battleId: "battle-1",
    targetMemberIds: ["member-1", "member-2"],
    targetPolicyMode: "live_targets",
  });

  // member-2 is gone and policy is live, so target list shrinks.
  assert.equal(recovery.targetMemberIds.length, 1);
  assert.deepEqual(recovery.targetMemberIds, ["member-1"]);
});

test("recovery metadata contract includes evaluated battle, target count, and rationale", () => {
  const combatState = {
    ...buildCombatState(),
    participantBattleById: {
      "member-1": "battle-1",
      "member-2": "battle-2",
      "member-3": "battle-2",
      "npc-1": "battle-1",
      "npc-2": "battle-2",
    },
    currentTurnIdByBattle: {
      "battle-1": "member-1",
      "battle-2": "member-2",
    },
    currentTurnId: "member-2",
    battleTurnOrderById: {
      "battle-1": ["member-1", "npc-1"],
      "battle-2": ["member-2", "member-3", "npc-2"],
    },
  };

  const completion = getEncounterRollCompletionState({
    combatState,
    battleId: "battle-2",
    targetMemberIds: ["member-1", "member-2", "member-3"],
    requiredRolls: ["initiative"],
    targetPolicyMode: "locked_targets",
  });

  assert.equal(completion.evaluatedBattleId, "battle-2");
  assert.equal(completion.evaluatedTargetCount, 3);
  assert.equal(completion.targetPolicyMode, "locked_targets");
  assert.equal(completion.evaluationRationale, "preferred_current_battle");
});
