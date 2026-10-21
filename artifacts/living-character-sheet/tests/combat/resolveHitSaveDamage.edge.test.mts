import assert from "node:assert/strict";
import test from "node:test";

import { resolveHitSaveDamage } from "../../utils/combat/resolveHitSaveDamage.ts";

function makeCommand(overrides = {}) {
  return {
    commandId: "cmd-resolver-1",
    issuedAt: Date.now(),
    actor: { memberId: "member-1" },
    source: {
      sourceType: "prepared_spell",
      sourceId: "spell-1",
      sourceName: "Resolver Spell",
    },
    action: {
      actionKind: "action",
      mode: "use",
    },
    targets: {
      targetIds: ["self"],
      maxTargets: 1,
    },
    ...overrides,
  };
}

function makeSnapshots(overrides = {}) {
  return {
    self: {
      targetId: "self",
      targetType: "self",
      armorClass: 12,
      currentHp: 20,
      tempHp: 0,
      isLocalCharacter: true,
    },
    ...overrides,
  };
}

test("fails closed when save data is unresolved and does not apply damage", () => {
  const command = makeCommand({
    declared: {
      spell: { mode: "save" },
      save: { saveAbility: "dex", dc: 14, onSave: "half" },
      damagePackets: [{ rawAmount: 8, damageType: "radiant" }],
    },
  });

  const result = resolveHitSaveDamage({
    command,
    targetSnapshotsById: makeSnapshots(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, "unresolved_target_stats");
  assert.equal(result.targetResults[0]?.saveOutcome.status, "unresolved");
  assert.equal(result.targetResults[0]?.applyState, "skipped");
  assert.equal(result.targetResults[0]?.damageBreakdown, undefined);
  assert.equal(result.summary.resolvedCount, 0);
  assert.equal(result.summary.appliedLocalCount, 0);
});

test("applies save-half behavior when save passes", () => {
  const command = makeCommand({
    declared: {
      spell: { mode: "save" },
      save: { saveAbility: "dex", dc: 14, onSave: "half", targetRolls: { self: 15 } },
      damagePackets: [{ rawAmount: 9, damageType: "fire" }],
    },
  });

  const result = resolveHitSaveDamage({
    command,
    targetSnapshotsById: makeSnapshots(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, undefined);
  assert.equal(result.targetResults[0]?.saveOutcome.status, "passed");
  assert.equal(result.targetResults[0]?.applyState, "applied_local");
  assert.equal(result.targetResults[0]?.damageBreakdown?.hpDamage, 4);
  assert.equal(result.targetResults[0]?.hpDeltaPreview, -4);
});

test("applies save-negates behavior when save passes", () => {
  const command = makeCommand({
    declared: {
      spell: { mode: "save" },
      save: { saveAbility: "dex", dc: 14, onSave: "negates", targetRolls: { self: 15 } },
      damagePackets: [{ rawAmount: 11, damageType: "cold" }],
    },
  });

  const result = resolveHitSaveDamage({
    command,
    targetSnapshotsById: makeSnapshots(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, undefined);
  assert.equal(result.targetResults[0]?.saveOutcome.status, "passed");
  assert.equal(result.targetResults[0]?.applyState, "applied_local");
  assert.equal(result.targetResults[0]?.damageBreakdown?.hpDamage, 0);
  assert.equal(result.targetResults[0]?.hpDeltaPreview, 0);
});

test("transitions from unresolved save to resolved save when roll data becomes available", () => {
  const unresolvedCommand = makeCommand({
    declared: {
      spell: { mode: "save" },
      save: { saveAbility: "wis", dc: 13, onSave: "full" },
      damagePackets: [{ rawAmount: 7, damageType: "psychic" }],
    },
  });

  const unresolved = resolveHitSaveDamage({
    command: unresolvedCommand,
    targetSnapshotsById: makeSnapshots(),
  });

  assert.equal(unresolved.reasonCode, "unresolved_target_stats");
  assert.equal(unresolved.targetResults[0]?.saveOutcome.status, "unresolved");
  assert.equal(unresolved.targetResults[0]?.applyState, "skipped");
  assert.equal(unresolved.targetResults[0]?.damageBreakdown, undefined);

  const resolvedCommand = makeCommand({
    declared: {
      spell: { mode: "save" },
      save: { saveAbility: "wis", dc: 13, onSave: "full", targetRolls: { self: 8 } },
      damagePackets: [{ rawAmount: 7, damageType: "psychic" }],
    },
  });

  const resolved = resolveHitSaveDamage({
    command: resolvedCommand,
    targetSnapshotsById: makeSnapshots(),
  });

  assert.equal(resolved.reasonCode, undefined);
  assert.equal(resolved.targetResults[0]?.saveOutcome.status, "failed");
  assert.equal(resolved.targetResults[0]?.applyState, "applied_local");
  assert.equal(resolved.targetResults[0]?.damageBreakdown?.hpDamage, 7);
  assert.equal(resolved.summary.resolvedCount, 1);
  assert.equal(resolved.summary.appliedLocalCount, 1);
});

test("keeps healing packets effective across save-pass half behavior", () => {
  const command = makeCommand({
    declared: {
      spell: { mode: "save" },
      save: { saveAbility: "wis", dc: 14, onSave: "half", targetRolls: { self: 16 } },
      damagePackets: [{ rawAmount: -6, damageType: "healing" }],
    },
  });

  const result = resolveHitSaveDamage({
    command,
    targetSnapshotsById: makeSnapshots({
      self: {
        targetId: "self",
        targetType: "self",
        armorClass: 12,
        currentHp: 5,
        tempHp: 0,
        isLocalCharacter: true,
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, undefined);
  assert.equal(result.targetResults[0]?.saveOutcome.status, "passed");
  assert.equal(result.targetResults[0]?.damageBreakdown?.hpHealing, 6);
  assert.equal(result.targetResults[0]?.hpDeltaPreview, 6);
  assert.equal(result.summary.appliedLocalCount, 1);
});
