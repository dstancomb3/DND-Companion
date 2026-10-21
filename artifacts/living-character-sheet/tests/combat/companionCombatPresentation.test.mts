import assert from "node:assert/strict";
import test from "node:test";

import { getCombatNpcPresentation } from "../../utils/combat/companionCombatPresentation.ts";

test("companion presentation includes owner label and local ownership flag", () => {
  const presentation = getCombatNpcPresentation(
    {
      id: "npc-companion-1",
      name: "Raven",
      sourceType: "manual",
      disposition: "friendly",
      coreStats: {
        speed: 30,
        initiativeBonus: 2,
        strength: 8,
        dexterity: 14,
        constitution: 10,
        intelligence: 4,
        wisdom: 12,
        charisma: 6,
      },
      visibleStatKeys: ["speed"],
      dummyState: {
        maxHp: 9,
        currentHp: 9,
        armorClass: 13,
        actionUsed: false,
      },
      projection: {
        combatantKind: "companion",
        companionId: "companion-1",
        ownerMemberId: "member-1",
        ownerCharacterId: "char-1",
      },
      createdAt: new Date().toISOString(),
    },
    [
      {
        id: "member-1",
        characterName: "Lyra Shadowstep",
        characterClass: "Monk 7",
        currentHp: 52,
        maxHp: 57,
        tempHp: 0,
        armorClass: 17,
        conditions: [],
      },
    ],
    "member-1",
  );

  assert.equal(presentation.kind, "companion");
  assert.equal(presentation.badgeLabel, "Companion");
  assert.equal(presentation.ownerMemberId, "member-1");
  assert.equal(presentation.ownerName, "Lyra Shadowstep");
  assert.equal(presentation.isOwnedByLocalMember, true);
  assert.equal(presentation.displayName, "Raven (Companion - Lyra Shadowstep)");
});

test("companion presentation remains companion when owner cannot be resolved", () => {
  const presentation = getCombatNpcPresentation(
    {
      id: "npc-companion-2",
      name: "Wolf",
      sourceType: "manual",
      disposition: "friendly",
      coreStats: {
        speed: 40,
        initiativeBonus: 2,
        strength: 12,
        dexterity: 15,
        constitution: 12,
        intelligence: 3,
        wisdom: 12,
        charisma: 6,
      },
      visibleStatKeys: ["speed"],
      dummyState: {
        maxHp: 11,
        currentHp: 11,
        armorClass: 13,
        actionUsed: false,
      },
      projection: {
        combatantKind: "companion",
        companionId: "companion-2",
        ownerMemberId: "missing-member",
      },
      createdAt: new Date().toISOString(),
    },
    [],
    "member-1",
  );

  assert.equal(presentation.kind, "companion");
  assert.equal(presentation.isOwnedByLocalMember, false);
  assert.equal(presentation.ownerName, undefined);
  assert.equal(presentation.displayName, "Wolf (Companion)");
});

test("non-companion NPC source types map to expected presentation badges", () => {
  const monster = getCombatNpcPresentation(
    {
      id: "npc-monster-1",
      name: "Goblin",
      sourceType: "monster",
      disposition: "hostile",
      coreStats: {
        speed: 30,
        initiativeBonus: 2,
        strength: 8,
        dexterity: 14,
        constitution: 10,
        intelligence: 10,
        wisdom: 8,
        charisma: 8,
      },
      visibleStatKeys: ["speed"],
      dummyState: {
        maxHp: 7,
        currentHp: 7,
        armorClass: 15,
        actionUsed: false,
      },
      createdAt: new Date().toISOString(),
    },
    [],
    "member-1",
  );

  assert.equal(monster.kind, "monster");
  assert.equal(monster.badgeLabel, "Monster");
  assert.equal(monster.displayName, "Goblin");
  assert.equal(monster.isOwnedByLocalMember, false);
});
