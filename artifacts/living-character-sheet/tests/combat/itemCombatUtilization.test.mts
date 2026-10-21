import assert from "node:assert/strict";
import test from "node:test";

import { collectActionableItemEffects } from "../../utils/combat/actionableItemEffects.ts";
import { buildAttackDamagePackets } from "../../utils/combat/attackExecution.ts";
import { applyEquippedAttackAugments, collectEquippedAttackAugments } from "../../utils/combat/itemAttackAugments.ts";
import { resolveHitSaveDamage } from "../../utils/combat/resolveHitSaveDamage.ts";

test("equipped non-weapon attack effects contribute to-hit, flat bonus, and conditional extra damage", () => {
  const inventory = [
    {
      id: "ring-1",
      name: "Ring of Venom",
      quantity: 1,
      equipped: true,
      category: "accessory",
      equippedEffects: [
        {
          id: "eff-1",
          type: "attack_damage",
          label: "Venom Strike",
          attackDamageDice: "1d4",
          attackDamageBonus: 2,
          attackDamageType: "poison",
          attackToHitBonus: 1,
          triggerType: "vs_condition",
          triggerCondition: "poisoned",
        },
      ],
    },
  ];

  const augments = collectEquippedAttackAugments(inventory as any);
  assert.equal(augments.attackBonusBonus, 1);
  assert.equal(augments.additionalDamage.length, 1);
  assert.equal(augments.additionalDamage[0]?.damageModifier, 2);
  assert.equal(augments.additionalDamage[0]?.sourceLabel, "Venom Strike");
  assert.equal(augments.additionalDamage[0]?.triggerCondition, "poisoned");

  const attack = applyEquippedAttackAugments({
    id: "attack-1",
    name: "Longsword",
    attackBonus: 5,
    damageDice: "1d8",
    damageModifier: 3,
    damageType: "slashing",
    reminders: [],
  }, augments);

  assert.equal(attack.attackBonus, 6);
  assert.equal(attack.additionalDamage?.length, 1);

  const skippedPackets = buildAttackDamagePackets({
    attack,
    parsedDamageRolls: [6, 4],
    selectedTargetIds: ["enemy-1"],
    targetConditionsById: { "enemy-1": [] },
  });
  assert.equal(skippedPackets.length, 1);
  assert.equal(skippedPackets[0]?.rawAmount, 9);

  const appliedPackets = buildAttackDamagePackets({
    attack,
    parsedDamageRolls: [6, 4],
    selectedTargetIds: ["enemy-1"],
    targetConditionsById: { "enemy-1": ["poisoned"] },
  });
  assert.deepEqual(
    appliedPackets.map((packet) => ({ amount: packet.rawAmount, type: packet.damageType, source: packet.sourceLabel })),
    [
      { amount: 9, type: "slashing", source: "Longsword" },
      { amount: 6, type: "poison", source: "Venom Strike" },
    ],
  );
});

test("non-weapon additionalDamage entries are injected into live attacks", () => {
  const inventory = [
    {
      id: "amulet-1",
      name: "Frost Charm",
      quantity: 1,
      equipped: true,
      category: "accessory",
      additionalDamage: [
        {
          dice: "1d6",
          damageModifier: 1,
          damageType: "cold",
          sourceLabel: "Frost Charm",
        },
      ],
    },
  ];

  const augments = collectEquippedAttackAugments(inventory as any);
  assert.equal(augments.attackBonusBonus, 0);
  assert.equal(augments.additionalDamage.length, 1);
  assert.equal(augments.additionalDamage[0]?.damageType, "cold");
  assert.equal(augments.additionalDamage[0]?.damageModifier, 1);
});

test("resolver uses augmented attack bonus and packet totals from equipped item effects", () => {
  const inventory = [
    {
      id: "ring-1",
      name: "Ring of Venom",
      quantity: 1,
      equipped: true,
      category: "accessory",
      equippedEffects: [
        {
          id: "eff-1",
          type: "attack_damage",
          label: "Venom Strike",
          attackDamageDice: "1d4",
          attackDamageBonus: 2,
          attackDamageType: "poison",
          attackToHitBonus: 1,
          triggerType: "vs_condition",
          triggerCondition: "poisoned",
        },
      ],
    },
  ];
  const attack = applyEquippedAttackAugments({
    id: "attack-1",
    name: "Longsword",
    attackBonus: 5,
    damageDice: "1d8",
    damageModifier: 3,
    damageType: "slashing",
    reminders: [],
  }, collectEquippedAttackAugments(inventory as any));

  const command = {
    commandId: "cmd-attack-1",
    issuedAt: Date.now(),
    actor: { memberId: "member-1" },
    source: {
      sourceType: "attack",
      sourceId: attack.id,
      sourceName: attack.name,
    },
    action: {
      actionKind: "action",
      mode: "use",
    },
    targets: {
      targetIds: ["enemy-1"],
      maxTargets: 1,
    },
    declared: {
      attackRoll: 12,
      damagePackets: buildAttackDamagePackets({
        attack,
        parsedDamageRolls: [6, 4],
        selectedTargetIds: ["enemy-1"],
        targetConditionsById: { "enemy-1": ["poisoned"] },
      }),
    },
    metadata: {
      eventMetadata: {
        attackBonus: attack.attackBonus,
      },
    },
  };

  const result = resolveHitSaveDamage({
    command: command as any,
    targetSnapshotsById: {
      "enemy-1": {
        targetId: "enemy-1",
        targetType: "npc",
        armorClass: 17,
        currentHp: 40,
        tempHp: 0,
        isLocalCharacter: true,
        conditions: [{ id: "cond-1", name: "Poisoned" }],
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, undefined);
  assert.equal(result.targetResults[0]?.hitOutcome.status, "hit");
  assert.equal(result.targetResults[0]?.hitOutcome.totalToHit, 18);
  assert.equal(result.targetResults[0]?.damageBreakdown?.hpDamage, 15);
});

test("limited-use non-spell item actions stay explicit about unsupported tracking", () => {
  const actionable = collectActionableItemEffects([
    {
      id: "boots-1",
      name: "Boots of Escape",
      quantity: 1,
      equipped: true,
      category: "accessory",
      equippedEffects: [
        {
          id: "eff-1",
          type: "feature",
          label: "Quickstep",
          description: "As a bonus action, move up to your speed without provoking opportunity attacks.",
          actionType: "bonus_action",
          uses: 2,
        },
      ],
    },
  ] as any);

  assert.equal(actionable.length, 1);
  assert.equal(actionable[0]?.uses, 2, "uses should be exposed for tracking");
  assert.equal(actionable[0]?.resetOn, undefined, "resetOn defaults to undefined when not set");
  assert.ok(
    !(actionable[0]?.description ?? "").includes("not auto-tracked"),
    "description should not contain the old placeholder note",
  );
});
