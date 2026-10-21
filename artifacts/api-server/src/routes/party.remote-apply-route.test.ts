import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";

const partyModule = await import("./party");

const {
  buildRemoteApplyPayloadHash,
  buildRemoteOutcomeOperations,
  evaluateRemoteApplyReplay,
  isRemoteApplyReplay,
  normalizeCombatNpcProjection,
  validateRemotePreviewOutcomeBatch,
  validateRemoteApplyAuthority,
  validateRemotePreviewOutcome,
} = partyModule;

function makeState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    partyCode: "P-1",
    schemaVersion: 1,
    stateRevision: 1,
    activeMemberIds: ["member-1", "member-2"],
    participantBattleById: {
      "member-1": "battle-1",
      "member-2": "battle-1",
    },
    battleTurnOrderById: {
      "battle-1": ["member-1", "member-2"],
    },
    turnOrder: ["member-1", "member-2"],
    currentTurnIdByBattle: { "battle-1": "member-1" },
    currentTurnId: "member-1",
    includeEnvironment: true,
    initiativeByMember: {},
    combatNpcs: [
      {
        id: "npc-1",
        name: "Goblin",
        sourceType: "manual",
        disposition: "hostile",
        coreStats: {
          speed: 30,
          initiativeBonus: 0,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        visibleStatKeys: ["speed"],
        dummyState: {
          maxHp: 12,
          currentHp: 12,
          armorClass: 13,
          actionUsed: false,
        },
        createdAt: new Date().toISOString(),
      },
    ],
    memberStatsById: {},
    memberDefensesById: {},
    memberSyncClockById: {},
    memberPresentationById: {},
    rollRequests: [],
    lootAssignments: [],
    noteAssignments: [],
    restRequests: [],
    eventLog: [],
    playerEconomyByMember: {},
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("remote apply authority rejects invalid source member", () => {
  const result = validateRemoteApplyAuthority({
    sourceMemberId: "intruder",
    state: makeState() as never,
    liveMemberIds: new Set(["member-1", "member-2"]),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
  }
});

test("remote apply authority rejects source member when turn proof is ambiguous", () => {
  const state = makeState({
    participantBattleById: {},
    currentTurnIdByBattle: {},
    currentTurnId: null,
  });
  const result = validateRemoteApplyAuthority({
    sourceMemberId: "member-1",
    state: state as never,
    liveMemberIds: new Set(["member-1", "member-2"]),
  });

  assert.equal(result.ok, false);
});

test("remote apply authority rejects unauthorized turn ownership", () => {
  const state = makeState({ currentTurnIdByBattle: { "battle-1": "member-2" }, currentTurnId: "member-2" });
  const result = validateRemoteApplyAuthority({
    sourceMemberId: "member-1",
    state: state as never,
    liveMemberIds: new Set(["member-1", "member-2"]),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
  }
});

test("remote apply validation rejects invalid preview/apply cases", () => {
  const invalid = validateRemotePreviewOutcome({
    applyState: "applied_local",
    authority: { reason: "remote_member_preview_only" },
    targetType: "member",
    targetId: "member-1",
    damageBreakdown: { hpDamage: 3, tempHpAbsorbed: 0 },
  });

  assert.equal(invalid.ok, false);
});

test("remote apply validation accepts condition-only supported outcomes", () => {
  const valid = validateRemotePreviewOutcome({
    applyState: "preview_only",
    authority: { reason: "remote_member_preview_only" },
    targetType: "member",
    targetId: "member-2",
    damageBreakdown: { hpDamage: 0, tempHpAbsorbed: 0 },
    conditionResults: [
      {
        effectType: "apply_condition",
        conditionName: "Poisoned",
        status: "applied",
      },
    ],
  });

  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.conditionChanges.length, 1);
    assert.equal(valid.value.conditionChanges[0]?.effectType, "apply_condition");
  }
});

test("remote apply validation accepts heal-only preview outcomes", () => {
  const valid = validateRemotePreviewOutcome({
    applyState: "preview_only",
    authority: { reason: "remote_member_preview_only" },
    targetType: "member",
    targetId: "member-2",
    damageBreakdown: { hpDamage: 0, tempHpAbsorbed: 0, hpHealing: 0 },
    hpDeltaPreview: 6,
  });

  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.hpHealing, 6);
  }
});

test("remote apply validation accepts heal-only preview outcomes without damageBreakdown", () => {
  const valid = validateRemotePreviewOutcome({
    applyState: "preview_only",
    authority: { reason: "remote_npc_preview_only" },
    targetType: "npc",
    targetId: "npc-1",
    hpDeltaPreview: 4,
  });

  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.hpHealing, 4);
    assert.equal(valid.value.hpDamage, 0);
  }
});

test("remote apply validation rejects targetType/authority mismatches", () => {
  const invalid = validateRemotePreviewOutcome({
    applyState: "preview_only",
    authority: { reason: "remote_member_preview_only" },
    targetType: "npc",
    targetId: "npc-1",
    damageBreakdown: { hpDamage: 2, tempHpAbsorbed: 0 },
  });

  assert.equal(invalid.ok, false);
});

test("remote apply validation still rejects non-member/non-npc target types", () => {
  const invalid = validateRemotePreviewOutcome({
    applyState: "preview_only",
    authority: { reason: "remote_npc_preview_only" },
    targetType: "companion" as never,
    targetId: "comp-1",
    damageBreakdown: { hpDamage: 2, tempHpAbsorbed: 0 },
  } as never);

  assert.equal(invalid.ok, false);
});

test("remote apply replay dedupe is commandId-based", () => {
  const state = makeState({
    eventLog: [
      {
        id: "evt-1",
        type: "combat_remote_outcome_applied",
        message: "Applied",
        metadata: { commandId: "cmd-123" },
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(isRemoteApplyReplay(state as never, "cmd-123"), true);
  assert.equal(isRemoteApplyReplay(state as never, "cmd-456"), false);
});

test("same commandId with identical payload hash resolves as replay", () => {
  const accepted = [
    {
      requestIndex: 0,
      value: {
        targetType: "member",
        targetId: "member-1",
        hpDamage: 4,
        hpHealing: 0,
        tempHpAbsorbed: 0,
        conditionChanges: [],
      },
    },
  ];
  const rejected: Array<{ requestIndex: number; reason: string }> = [];
  const payloadHash = buildRemoteApplyPayloadHash({
    sourceMemberId: "member-1",
    accepted: accepted as never,
    rejected: rejected as never,
  });

  const state = makeState({
    eventLog: [
      {
        id: "evt-1",
        type: "combat_remote_outcome_applied",
        message: "Applied",
        metadata: { commandId: "cmd-123", payloadHash },
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const decision = evaluateRemoteApplyReplay(state as never, "cmd-123", payloadHash);
  assert.equal(decision.kind, "replay");
});

test("same commandId with different payload hash resolves as conflict", () => {
  const acceptedA = [
    {
      requestIndex: 0,
      value: {
        targetType: "member",
        targetId: "member-1",
        hpDamage: 4,
        hpHealing: 0,
        tempHpAbsorbed: 0,
        conditionChanges: [],
      },
    },
  ];
  const acceptedB = [
    {
      requestIndex: 0,
      value: {
        targetType: "member",
        targetId: "member-1",
        hpDamage: 7,
        hpHealing: 0,
        tempHpAbsorbed: 0,
        conditionChanges: [],
      },
    },
  ];
  const payloadHashA = buildRemoteApplyPayloadHash({
    sourceMemberId: "member-1",
    accepted: acceptedA as never,
    rejected: [] as never,
  });
  const payloadHashB = buildRemoteApplyPayloadHash({
    sourceMemberId: "member-1",
    accepted: acceptedB as never,
    rejected: [] as never,
  });

  const state = makeState({
    eventLog: [
      {
        id: "evt-1",
        type: "combat_remote_outcome_applied",
        message: "Applied",
        metadata: { commandId: "cmd-123", payloadHash: payloadHashA },
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const decision = evaluateRemoteApplyReplay(state as never, "cmd-123", payloadHashB);
  assert.equal(decision.kind, "conflict");
});

test("batch validation keeps valid targets, skips invalid targets, and is deterministically ordered", () => {
  const batch = validateRemotePreviewOutcomeBatch([
    {
      applyState: "preview_only",
      authority: { reason: "remote_npc_preview_only" },
      targetType: "npc",
      targetId: "npc-1",
      damageBreakdown: { hpDamage: 2, tempHpAbsorbed: 0 },
    },
    {
      applyState: "applied_local",
      authority: { reason: "remote_member_preview_only" },
      targetType: "member",
      targetId: "member-1",
      damageBreakdown: { hpDamage: 3, tempHpAbsorbed: 0 },
    },
    {
      applyState: "preview_only",
      authority: { reason: "remote_member_preview_only" },
      targetType: "member",
      targetId: "member-1",
      damageBreakdown: { hpDamage: 1, tempHpAbsorbed: 0 },
    },
  ]);

  assert.equal(batch.accepted.length, 2);
  assert.equal(batch.rejected.length, 1);
  assert.equal(batch.rejected[0]?.requestIndex, 1);
  assert.equal(batch.accepted[0]?.value.targetType, "member");
  assert.equal(batch.accepted[0]?.value.targetId, "member-1");
  assert.equal(batch.accepted[1]?.value.targetType, "npc");
});

test("multi-target batch with one invalid still builds operations for valid targets only", () => {
  const state = makeState();
  const memberById = new Map<string, Record<string, unknown>>([
    [
      "member-1",
      {
        id: "member-1",
        maxHp: 30,
        tempHp: 0,
        currentHp: 20,
        conditions: [],
      },
    ],
  ]);

  const batch = validateRemotePreviewOutcomeBatch([
    {
      applyState: "preview_only",
      authority: { reason: "remote_member_preview_only" },
      targetType: "member",
      targetId: "member-1",
      damageBreakdown: { hpDamage: 4, tempHpAbsorbed: 0 },
    },
    {
      applyState: "preview_only",
      authority: { reason: "remote_member_preview_only" },
      targetType: "member",
      targetId: "",
      damageBreakdown: { hpDamage: 4, tempHpAbsorbed: 0 },
    },
  ]);

  const operations = buildRemoteOutcomeOperations({
    validatedResults: batch.accepted.map((entry) => entry.value) as never,
    memberById: memberById as never,
    state: state as never,
  });

  assert.equal(batch.rejected.length, 1);
  assert.equal(operations.length, 1);
  assert.equal(operations[0]?.kind, "member");
  if (operations[0]?.kind === "member") {
    assert.equal(operations[0].memberId, "member-1");
  }
});

test("invalid target does not produce a mutation operation for that target", () => {
  const state = makeState();
  const memberById = new Map<string, Record<string, unknown>>([
    [
      "member-1",
      {
        id: "member-1",
        maxHp: 30,
        tempHp: 0,
        currentHp: 20,
        conditions: [],
      },
    ],
  ]);

  const batch = validateRemotePreviewOutcomeBatch([
    {
      applyState: "preview_only",
      authority: { reason: "remote_member_preview_only" },
      targetType: "member",
      targetId: "member-1",
      damageBreakdown: { hpDamage: 2, tempHpAbsorbed: 0 },
    },
    {
      applyState: "preview_only",
      authority: { reason: "remote_npc_preview_only" },
      targetType: "npc",
      targetId: "npc-1",
      damageBreakdown: "invalid",
    },
  ]);

  const operations = buildRemoteOutcomeOperations({
    validatedResults: batch.accepted.map((entry) => entry.value) as never,
    memberById: memberById as never,
    state: state as never,
  });

  assert.equal(batch.rejected.length, 1);
  assert.equal(operations.length, 1);
  const hasNpcMutation = operations.some((entry) => entry.kind === "npc" && entry.npcId === "npc-1");
  assert.equal(hasNpcMutation, false);
});

test("remote apply operations include only supported member/NPC damage consequences", () => {
  const state = makeState();
  const memberById = new Map<string, Record<string, unknown>>([
    [
      "member-1",
      {
        id: "member-1",
        maxHp: 30,
        tempHp: 4,
        currentHp: 20,
      },
    ],
  ]);

  const operations = buildRemoteOutcomeOperations({
    validatedResults: [
      {
        targetType: "member",
        targetId: "member-1",
        hpDamage: 5,
        hpHealing: 0,
        tempHpAbsorbed: 2,
        conditionChanges: [],
      },
      {
        targetType: "npc",
        targetId: "npc-1",
        hpDamage: 3,
        hpHealing: 0,
        tempHpAbsorbed: 0,
        conditionChanges: [],
      },
      {
        targetType: "member",
        targetId: "unknown-member",
        hpDamage: 9,
        hpHealing: 0,
        tempHpAbsorbed: 0,
        conditionChanges: [],
      },
    ] as never,
    memberById: memberById as never,
    state: state as never,
  });

  assert.equal(operations.length, 2);
  assert.equal(operations[0]?.kind, "member");
  assert.equal(operations[1]?.kind, "npc");
} );

test("remote apply operations include bounded condition mutations for members and NPCs", () => {
  const state = makeState({
    combatNpcs: [
      {
        id: "npc-1",
        name: "Goblin",
        sourceType: "manual",
        disposition: "hostile",
        coreStats: {
          speed: 30,
          initiativeBonus: 0,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        visibleStatKeys: ["speed"],
        dummyState: {
          maxHp: 12,
          currentHp: 12,
          armorClass: 13,
          actionUsed: false,
        },
        conditions: [{ id: "cond:grappled", name: "Grappled" }],
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const memberById = new Map<string, Record<string, unknown>>([
    [
      "member-1",
      {
        id: "member-1",
        maxHp: 30,
        tempHp: 0,
        currentHp: 20,
        conditions: [{ id: "cond:poisoned", name: "Poisoned" }],
      },
    ],
  ]);

  const operations = buildRemoteOutcomeOperations({
    validatedResults: [
      {
        targetType: "member",
        targetId: "member-1",
        hpDamage: 0,
        hpHealing: 0,
        tempHpAbsorbed: 0,
        conditionChanges: [
          { effectType: "remove_condition", conditionName: "Poisoned" },
          { effectType: "apply_condition", conditionName: "Prone" },
        ],
      },
      {
        targetType: "npc",
        targetId: "npc-1",
        hpDamage: 0,
        hpHealing: 0,
        tempHpAbsorbed: 0,
        conditionChanges: [{ effectType: "remove_condition", conditionName: "Grappled" }],
      },
    ] as never,
    memberById: memberById as never,
    state: state as never,
  });

  assert.equal(operations.length, 2);
  assert.equal(operations[0]?.kind, "member");
  assert.equal(operations[1]?.kind, "npc");
  if (operations[0]?.kind === "member") {
    assert.deepEqual(operations[0].nextConditions.map((entry) => entry.name), ["Prone"]);
  }
  if (operations[1]?.kind === "npc") {
    assert.deepEqual(operations[1].nextConditions, []);
  }
});

test("remote apply operations cap bounded healing for members and NPCs", () => {
  const state = makeState({
    combatNpcs: [
      {
        id: "npc-1",
        name: "Goblin",
        sourceType: "manual",
        disposition: "hostile",
        coreStats: {
          speed: 30,
          initiativeBonus: 0,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        visibleStatKeys: ["speed"],
        dummyState: {
          maxHp: 12,
          currentHp: 10,
          armorClass: 13,
          actionUsed: false,
        },
        conditions: [],
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const memberById = new Map<string, Record<string, unknown>>([
    [
      "member-1",
      {
        id: "member-1",
        maxHp: 30,
        tempHp: 0,
        currentHp: 27,
        conditions: [],
      },
    ],
  ]);

  const operations = buildRemoteOutcomeOperations({
    validatedResults: [
      {
        targetType: "member",
        targetId: "member-1",
        hpDamage: 0,
        hpHealing: 8,
        tempHpAbsorbed: 0,
        conditionChanges: [],
      },
      {
        targetType: "npc",
        targetId: "npc-1",
        hpDamage: 0,
        hpHealing: 5,
        tempHpAbsorbed: 0,
        conditionChanges: [],
      },
    ] as never,
    memberById: memberById as never,
    state: state as never,
  });

  assert.equal(operations.length, 2);
  if (operations[0]?.kind === "member") {
    assert.equal(operations[0].nextHp, 30);
  }
  if (operations[1]?.kind === "npc") {
    assert.equal(operations[1].nextHp, 12);
  }
});

test("combat npc projection normalization preserves companion metadata", () => {
  const projection = normalizeCombatNpcProjection({
    combatantKind: "companion",
    companionId: "comp-1",
    ownerMemberId: "member-1",
    ownerCharacterId: "char-1",
  });

  assert.deepEqual(projection, {
    combatantKind: "companion",
    companionId: "comp-1",
    ownerMemberId: "member-1",
    ownerCharacterId: "char-1",
  });
  assert.equal(normalizeCombatNpcProjection({ combatantKind: "other" }), undefined);
});
