import assert from "node:assert/strict";
import test from "node:test";

import { resolveCombatAction } from "../../utils/combat/resolveCombatAction.ts";
import { formatOutcomeSummary } from "../../utils/combat/combatFeedback.ts";

function makeCommand(overrides = {}) {
  return {
    commandId: "cmd-1",
    issuedAt: Date.now(),
    actor: { memberId: "member-1" },
    source: {
      sourceType: "attack",
      sourceId: "attack-1",
      sourceName: "Longsword",
    },
    action: {
      actionKind: "action",
      mode: "use",
    },
    targets: {
      targetIds: [],
    },
    ...overrides,
  };
}

function makeDeps(overrides = {}) {
  const calls = {
    useAction: 0,
    refundAction: 0,
    useBonusAction: 0,
    refundBonusAction: 0,
    toggleReaction: 0,
    spendMovement: 0,
    refundMovement: 0,
    applyLocalTargetResult: 0,
  };

  const deps = {
    active: true,
    isPartyAuthoritative: false,
    actorMemberId: "member-1",
    currentTurnId: "member-1",
    actionsUsed: 0,
    actionsTotal: 1,
    bonusActionsUsed: 0,
    bonusActionsTotal: 1,
    reactionUsed: false,
    remainingMovementFeet: 30,
    useAction: () => {
      calls.useAction += 1;
    },
    refundAction: () => {
      calls.refundAction += 1;
    },
    useBonusAction: () => {
      calls.useBonusAction += 1;
    },
    refundBonusAction: () => {
      calls.refundBonusAction += 1;
    },
    toggleReaction: () => {
      calls.toggleReaction += 1;
    },
    spendMovement: () => {
      calls.spendMovement += 1;
    },
    refundMovement: () => {
      calls.refundMovement += 1;
    },
    targetSnapshotsById: {},
    applyLocalTargetResult: () => {
      calls.applyLocalTargetResult += 1;
    },
    actorConditions: [],
    pendingReactionWindowId: null,
    pendingReactionExpiresAtTurnKey: null,
    currentTurnKey: 0,
    ...overrides,
  };

  return { deps, calls };
}

test("accepts basic action and consumes one action when available", () => {
  const command = makeCommand();
  const { deps, calls } = makeDeps();

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "accepted");
  assert.equal(result.economyDelta.actionUsedDelta, 1);
  assert.equal(calls.useAction, 1);
});

test("rejects action when no action remains", () => {
  const command = makeCommand();
  const { deps, calls } = makeDeps({ actionsUsed: 1, actionsTotal: 1 });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "rejected");
  assert.equal(result.reasonCode, "no_action_available");
  assert.equal(calls.useAction, 0);
});

test("rejects command when actor does not own current turn", () => {
  const command = makeCommand();
  const { deps, calls } = makeDeps({ currentTurnId: "member-2" });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "rejected");
  assert.equal(result.reasonCode, "not_your_turn");
  assert.equal(calls.useAction, 0);
});

test("rejects movement when actor condition blocks speed", () => {
  const command = makeCommand({
    action: { actionKind: "movement", mode: "use", movementFeet: 10 },
  });

  const { deps, calls } = makeDeps({
    actorConditions: ["Grappled"],
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "rejected");
  assert.equal(result.reasonCode, "movement_blocked_by_condition");
  assert.equal(calls.spendMovement, 0);
});

test("resolves outcomes as applied_local vs preview_only and only applies local targets", () => {
  const command = makeCommand({
    declared: {
      attackRoll: 14,
      damagePackets: [{ rawAmount: 8, damageType: "slashing" }],
    },
    targets: { targetIds: ["self", "ally"], maxTargets: 2 },
  });

  const { deps, calls } = makeDeps({
    targetSnapshotsById: {
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 10,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: true,
      },
      ally: {
        targetId: "ally",
        targetType: "member",
        armorClass: 10,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: false,
      },
    },
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "accepted");
  assert.equal(result.resolutionSummary?.appliedLocalCount, 1);
  assert.equal(result.resolutionSummary?.previewOnlyCount, 1);
  assert.deepEqual(result.targetResults?.map((target) => target.authority.reason), [
    "local_character",
    "remote_member_preview_only",
  ]);
  assert.deepEqual(result.targetResults?.map((target) => target.authority.certainty), [
    "confirmed",
    "confirmed",
  ]);
  assert.equal(calls.applyLocalTargetResult, 1);
});

test("explicit preview-only authority overrides legacy local-character hint", () => {
  const command = makeCommand({
    declared: {
      attackRoll: 14,
      damagePackets: [{ rawAmount: 8, damageType: "slashing" }],
    },
    targets: { targetIds: ["self"], maxTargets: 1 },
  });

  const { deps, calls } = makeDeps({
    targetSnapshotsById: {
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 10,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: true,
        authority: {
          mode: "preview_only",
          canApplyLocally: false,
          certainty: "confirmed",
          reason: "remote_member_preview_only",
        },
      },
    },
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "accepted");
  assert.equal(result.targetResults?.[0]?.applyState, "preview_only");
  assert.equal(result.targetResults?.[0]?.authority.canApplyLocally, false);
  assert.equal(calls.applyLocalTargetResult, 0);
});

test("healing packet projects positive preview delta for remote targets", () => {
  const command = makeCommand({
    source: {
      sourceType: "spell",
      sourceId: "spell-heal",
      sourceName: "Healing Word",
    },
    declared: {
      damagePackets: [{ rawAmount: -6, damageType: "healing" }],
    },
    targets: { targetIds: ["ally"], maxTargets: 1 },
  });

  const { deps, calls } = makeDeps({
    targetSnapshotsById: {
      ally: {
        targetId: "ally",
        targetType: "member",
        armorClass: 10,
        currentHp: 8,
        tempHp: 0,
        isLocalCharacter: false,
      },
    },
  });

  const result = resolveCombatAction(command, deps);
  const summary = formatOutcomeSummary(result) ?? "";

  assert.equal(result.status, "accepted");
  assert.equal(result.targetResults?.[0]?.applyState, "preview_only");
  assert.equal(result.targetResults?.[0]?.hpDeltaPreview, 6);
  assert.equal(result.targetResults?.[0]?.damageBreakdown?.hpHealing, 6);
  assert.match(summary, /6 heal/);
  assert.equal(calls.applyLocalTargetResult, 0);
});

test("rejects reaction use when pending window is required but missing", () => {
  const command = makeCommand({
    action: { actionKind: "reaction", mode: "use" },
    reaction: {},
  });

  const { deps, calls } = makeDeps({
    pendingReactionWindowId: "window-1",
    pendingReactionExpiresAtTurnKey: 10,
    currentTurnKey: 10,
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "rejected");
  assert.equal(result.reasonCode, "reaction_window_required");
  assert.equal(calls.toggleReaction, 0);
});

test("rejects reaction use when provided window id mismatches", () => {
  const command = makeCommand({
    action: { actionKind: "reaction", mode: "use" },
    reaction: { windowId: "window-2" },
  });

  const { deps } = makeDeps({
    pendingReactionWindowId: "window-1",
    pendingReactionExpiresAtTurnKey: 10,
    currentTurnKey: 10,
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "rejected");
  assert.equal(result.reasonCode, "reaction_window_mismatch");
});

test("rejects reaction use when declared trigger mismatches pending trigger", () => {
  const command = makeCommand({
    action: { actionKind: "reaction", mode: "use" },
    reaction: { windowId: "window-1", triggerType: "shield" },
  });

  const { deps, calls } = makeDeps({
    pendingReactionWindowId: "window-1",
    pendingReactionTriggerType: "counterspell",
    pendingReactionExpiresAtTurnKey: 10,
    currentTurnKey: 10,
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "rejected");
  assert.equal(result.reasonCode, "reaction_trigger_mismatch");
  assert.equal(calls.toggleReaction, 0);
});

test("rejects reaction use when declared reaction kind mismatches pending trigger", () => {
  const command = makeCommand({
    action: { actionKind: "reaction", mode: "use" },
    reaction: {
      windowId: "window-1",
      triggerType: "shield",
      declared: {
        reactionKind: "counterspell",
        reactionName: "Counterspell",
        triggerKind: "shield",
      },
    },
  });

  const { deps, calls } = makeDeps({
    pendingReactionWindowId: "window-1",
    pendingReactionTriggerType: "shield",
    pendingReactionExpiresAtTurnKey: 10,
    currentTurnKey: 10,
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "rejected");
  assert.equal(result.reasonCode, "reaction_declaration_mismatch");
  assert.equal(calls.toggleReaction, 0);
});

test("rejects reaction use when pending window has expired", () => {
  const command = makeCommand({
    action: { actionKind: "reaction", mode: "use" },
    reaction: { windowId: "window-1" },
  });

  const { deps, calls } = makeDeps({
    pendingReactionWindowId: "window-1",
    pendingReactionExpiresAtTurnKey: 9,
    currentTurnKey: 10,
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "rejected");
  assert.equal(result.reasonCode, "reaction_window_expired");
  assert.equal(calls.toggleReaction, 0);
});

test("accepts reaction use when window matches and is not expired", () => {
  const command = makeCommand({
    action: { actionKind: "reaction", mode: "use" },
    reaction: { windowId: "window-1" },
  });

  const { deps, calls } = makeDeps({
    pendingReactionWindowId: "window-1",
    pendingReactionExpiresAtTurnKey: 10,
    currentTurnKey: 10,
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "accepted");
  assert.equal(result.economyDelta.reactionUsedChanged, true);
  assert.equal(calls.toggleReaction, 1);
});

test("accepts reaction use with compatible declared reaction", () => {
  const command = makeCommand({
    action: { actionKind: "reaction", mode: "use" },
    reaction: {
      windowId: "window-1",
      triggerType: "shield",
      declared: {
        reactionKind: "shield",
        reactionName: "Shield",
        triggerKind: "shield",
        effectHints: [{ effectType: "ac_bonus", bonus: 5 }],
      },
    },
    metadata: {
      eventType: "player_reaction_used",
      eventMetadata: {
        reactionDeclaredName: "Shield",
        reactionTriggerType: "shield",
      },
    },
  });

  const { deps, calls } = makeDeps({
    pendingReactionWindowId: "window-1",
    pendingReactionTriggerType: "shield",
    pendingReactionExpiresAtTurnKey: 10,
    currentTurnKey: 10,
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "accepted");
  assert.equal(result.economyDelta.reactionUsedChanged, true);
  assert.equal(calls.toggleReaction, 1);
});

test("includes reaction trigger and reaction name in shared outcome summary", () => {
  const command = makeCommand({
    action: { actionKind: "reaction", mode: "use" },
    reaction: {
      windowId: "window-1",
      triggerType: "shield",
      declared: {
        reactionKind: "shield",
        reactionName: "Shield",
        triggerKind: "shield",
      },
    },
    declared: {
      attackRoll: 15,
      damagePackets: [{ rawAmount: 4, damageType: "force" }],
    },
    targets: { targetIds: ["self"], maxTargets: 1 },
    metadata: {
      eventType: "player_reaction_used",
      eventMetadata: {
        reactionDeclaredName: "Shield",
        reactionTriggerType: "shield",
      },
    },
  });

  const { deps } = makeDeps({
    pendingReactionWindowId: "window-1",
    pendingReactionTriggerType: "shield",
    pendingReactionExpiresAtTurnKey: 10,
    currentTurnKey: 10,
    targetSnapshotsById: {
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 10,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: true,
      },
    },
  });

  const result = resolveCombatAction(command, deps);
  const summary = formatOutcomeSummary(result) ?? "";

  assert.equal(result.status, "accepted");
  assert.match(summary, /Reaction used: Shield \(trigger: Shield\)/);
});

test("notes when preview-only mitigation data is unavailable for a remote target", () => {
  const command = makeCommand({
    declared: {
      attackRoll: 14,
      damagePackets: [{ rawAmount: 8, damageType: "fire" }],
    },
    targets: { targetIds: ["npc-1"], maxTargets: 1 },
  });

  const { deps } = makeDeps({
    targetSnapshotsById: {
      "npc-1": {
        targetId: "npc-1",
        targetType: "npc",
        armorClass: 10,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: false,
        mitigationKnown: false,
      },
    },
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "accepted");
  assert.equal(result.targetResults?.[0]?.authority.reason, "remote_npc_preview_only");
  assert.equal(result.targetResults?.[0]?.authority.certainty, "limited");
  assert.match(result.resolutionSummary?.notes?.join("\n") ?? "", /Preview damage may ignore unknown resistances or immunities/);
});

test("formats shared outcome summary for partial preview results", () => {
  const command = makeCommand({
    declared: {
      attackRoll: 14,
      damagePackets: [{ rawAmount: 8, damageType: "fire" }],
    },
    targets: { targetIds: ["npc-1"], maxTargets: 1 },
  });

  const { deps } = makeDeps({
    targetSnapshotsById: {
      "npc-1": {
        targetId: "npc-1",
        targetType: "npc",
        armorClass: 10,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: false,
        mitigationKnown: false,
      },
    },
  });

  const result = resolveCombatAction(command, deps);
  const summary = formatOutcomeSummary(result);

  assert.match(summary ?? "", /Preview only: 1/);
  assert.match(summary ?? "", /Preview damage may ignore unknown resistances or immunities/);
});

test("returns structured condition outcomes for supported spell declarations", () => {
  const command = makeCommand({
    source: {
      sourceType: "prepared_spell",
      sourceId: "hold-person",
      sourceName: "Hold Person",
    },
    declared: {
      spell: {
        mode: "save",
      },
      save: {
        saveAbility: "wis",
        dc: 15,
        onSave: "negates",
        targetRolls: { self: 8 },
      },
      conditionEffects: [
        {
          effectType: "apply_condition",
          conditionName: "Paralyzed",
          applyWhen: "on_failed_save",
          targetScope: "single",
          concentrationLinked: true,
          durationHint: {
            durationType: "concentration",
            text: "up to 1 minute",
            saveEnds: true,
          },
        },
      ],
    },
    targets: { targetIds: ["self"], maxTargets: 1 },
  });

  const { deps, calls } = makeDeps({
    targetSnapshotsById: {
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 12,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: true,
        conditions: [],
        conditionImmunities: [],
      },
    },
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "accepted");
  assert.equal(result.targetResults?.[0]?.conditionResults?.[0]?.status, "applied");
  assert.equal(result.targetResults?.[0]?.conditionResults?.[0]?.conditionName, "Paralyzed");
  assert.equal(result.targetResults?.[0]?.conditionResults?.[0]?.concentrationLinkId, "hold-person");
  assert.equal(calls.applyLocalTargetResult, 1);
});

test("blocks declared condition application when target is condition-immune", () => {
  const command = makeCommand({
    source: {
      sourceType: "prepared_spell",
      sourceId: "ray-of-sickness",
      sourceName: "Ray of Sickness",
    },
    declared: {
      spell: {
        mode: "attack_and_save",
      },
      attackRoll: 16,
      save: {
        saveAbility: "con",
        dc: 14,
        targetRolls: { self: 6 },
      },
      damagePackets: [{ rawAmount: 9, damageType: "poison" }],
      conditionEffects: [
        {
          effectType: "apply_condition",
          conditionName: "Poisoned",
          applyWhen: "on_hit_and_failed_save",
          targetScope: "single",
          durationHint: { text: "until the end of your next turn" },
        },
      ],
    },
    targets: { targetIds: ["self"], maxTargets: 1 },
  });

  const { deps } = makeDeps({
    targetSnapshotsById: {
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 10,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: true,
        conditionImmunities: ["Poisoned"],
      },
    },
  });

  const result = resolveCombatAction(command, deps);
  const summary = formatOutcomeSummary(result) ?? "";

  assert.equal(result.status, "accepted");
  assert.equal(result.targetResults?.[0]?.conditionResults?.[0]?.status, "blocked");
  assert.match(summary, /Poisoned blocked/);
});

test("resolves remove_condition effects when the condition is currently active", () => {
  const command = makeCommand({
    source: {
      sourceType: "feature",
      sourceId: "cleanse-poison",
      sourceName: "Cleanse Poison",
    },
    declared: {
      conditionEffects: [
        {
          effectType: "remove_condition",
          conditionName: "Poisoned",
          applyWhen: "always",
          targetScope: "single",
          durationHint: { text: "immediate" },
        },
      ],
    },
    metadata: {
      requiresResolution: true,
    },
    targets: { targetIds: ["self"], maxTargets: 1 },
  });

  const { deps } = makeDeps({
    targetSnapshotsById: {
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 10,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: true,
        conditions: ["Poisoned"],
      },
    },
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "accepted");
  assert.equal(result.targetResults?.[0]?.conditionResults?.[0]?.effectType, "remove_condition");
  assert.equal(result.targetResults?.[0]?.conditionResults?.[0]?.status, "removed");
  assert.equal(result.targetResults?.[0]?.conditionResults?.[0]?.conditionName, "Poisoned");
});

test("keeps prepared spell attack unresolved when declared attack roll is missing", () => {
  const command = makeCommand({
    source: {
      sourceType: "prepared_spell",
      sourceId: "spell-1",
      sourceName: "Ray of Frost",
    },
    declared: {
      spell: {
        mode: "attack",
      },
      damagePackets: [{ rawAmount: 4, damageType: "cold", resolutionModel: "dice_average", diceExpression: "1d8" }],
    },
    targets: { targetIds: ["self"], maxTargets: 1 },
  });

  const { deps, calls } = makeDeps({
    targetSnapshotsById: {
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 12,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: true,
      },
    },
  });

  const result = resolveCombatAction(command, deps);
  const summary = formatOutcomeSummary(result) ?? "";

  assert.equal(result.status, "accepted");
  assert.equal(result.targetResults?.[0]?.hitOutcome.status, "unresolved");
  assert.equal(result.targetResults?.[0]?.hitOutcome.reason, "spell attack roll missing");
  assert.equal(result.targetResults?.[0]?.applyState, "skipped");
  assert.match(summary, /\(skipped,/);
  assert.equal(calls.applyLocalTargetResult, 0);
  assert.match(result.resolutionSummary?.notes?.join("\n") ?? "", /spell attack roll was required/i);
});

test("does not apply save spell damage when target save data is unresolved", () => {
  const command = makeCommand({
    source: {
      sourceType: "prepared_spell",
      sourceId: "spell-2",
      sourceName: "Sacred Flame",
    },
    declared: {
      spell: {
        mode: "save",
      },
      save: {
        saveAbility: "dex",
        dc: 14,
      },
      damagePackets: [{ rawAmount: 8, damageType: "radiant" }],
    },
    targets: { targetIds: ["self"], maxTargets: 1 },
  });

  const { deps, calls } = makeDeps({
    targetSnapshotsById: {
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 12,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: true,
      },
    },
  });

  const result = resolveCombatAction(command, deps);
  const summary = formatOutcomeSummary(result) ?? "";

  assert.equal(result.status, "accepted");
  assert.equal(result.reasonCode, undefined);
  assert.equal(result.targetResults?.[0]?.saveOutcome.status, "unresolved");
  assert.equal(result.targetResults?.[0]?.applyState, "skipped");
  assert.equal(result.targetResults?.[0]?.damageBreakdown, undefined);
  assert.match(summary, /\(skipped,/);
  assert.match(summary, /reason: save dc\/roll unavailable/);
  assert.equal(calls.applyLocalTargetResult, 0);
});

test("duplicate apply_condition effects are reported as not_triggered when already active", () => {
  const command = makeCommand({
    source: {
      sourceType: "prepared_spell",
      sourceId: "ray-of-sickness",
      sourceName: "Ray of Sickness",
    },
    declared: {
      attackRoll: 18,
      spell: {
        mode: "attack_and_save",
      },
      save: {
        saveAbility: "con",
        dc: 14,
        targetRolls: { self: 5 },
      },
      damagePackets: [{ rawAmount: 7, damageType: "poison" }],
      conditionEffects: [
        {
          effectType: "apply_condition",
          conditionName: "Poisoned",
          applyWhen: "on_hit_and_failed_save",
          targetScope: "single",
        },
      ],
    },
    targets: { targetIds: ["self"], maxTargets: 1 },
  });

  const { deps } = makeDeps({
    targetSnapshotsById: {
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 12,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: true,
        conditions: ["Poisoned"],
        conditionImmunities: [],
      },
    },
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "accepted");
  assert.equal(result.targetResults?.[0]?.conditionResults?.[0]?.status, "not_triggered");
  assert.match(result.targetResults?.[0]?.conditionResults?.[0]?.reason ?? "", /already active/i);
});

test("remove_condition is safely not_triggered when the target condition is absent", () => {
  const command = makeCommand({
    source: {
      sourceType: "feature",
      sourceId: "cleanse-poison",
      sourceName: "Cleanse Poison",
    },
    declared: {
      conditionEffects: [
        {
          effectType: "remove_condition",
          conditionName: "Poisoned",
          applyWhen: "always",
          targetScope: "single",
        },
      ],
    },
    metadata: {
      requiresResolution: true,
    },
    targets: { targetIds: ["self"], maxTargets: 1 },
  });

  const { deps } = makeDeps({
    targetSnapshotsById: {
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 12,
        currentHp: 20,
        tempHp: 0,
        isLocalCharacter: true,
        conditions: [],
      },
    },
  });

  const result = resolveCombatAction(command, deps);

  assert.equal(result.status, "accepted");
  assert.equal(result.targetResults?.[0]?.conditionResults?.[0]?.effectType, "remove_condition");
  assert.equal(result.targetResults?.[0]?.conditionResults?.[0]?.status, "not_triggered");
  assert.match(result.targetResults?.[0]?.conditionResults?.[0]?.reason ?? "", /not currently active/i);
});
