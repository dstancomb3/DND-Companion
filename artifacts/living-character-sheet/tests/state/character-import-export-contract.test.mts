import assert from "node:assert/strict";
import test from "node:test";

import type { CharacterSnapshot, Companion } from "../../types/index.ts";
import {
  buildImportedCharacterSnapshot,
  buildPortableCharacterExport,
  parseCharacterImportText,
} from "../../utils/characterImportExport.ts";
import { buildCompanionCombatNpcPayload, parseCompanionSpeedFeet } from "../../utils/combat/companionProjection.ts";
import { getCombatNpcPresentation } from "../../utils/combat/companionCombatPresentation.ts";
import type { CombatNpc, PartyMemberSummary } from "../../utils/partyApi.ts";

const baseSnapshot: CharacterSnapshot = {
  _version: 1,
  character: {
    id: "char-1",
    name: "Ari",
    class: "Rogue",
    level: 3,
    race: "Human",
    background: "Urchin",
    proficiencyBonus: 2,
    armorClass: 14,
    currentHp: 18,
    maxHp: 18,
    tempHp: 0,
    speed: 30,
    initiative: 3,
    abilityScores: {
      strength: 10,
      dexterity: 16,
      constitution: 12,
      intelligence: 11,
      wisdom: 12,
      charisma: 13,
    },
    savingThrows: [],
    skills: [],
    passivePerception: 11,
    currency: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 },
    notes: "",
  },
  attacks: [],
  resources: [],
  inventory: [
    {
      id: "inv-1",
      name: "Dagger",
      quantity: 1,
      equipped: true,
      category: "weapon",
    },
  ],
  conditions: [],
  notes: [],
  wishlist: [],
  journalArcs: [],
};

test("parseCharacterImportText rejects malformed JSON", () => {
  const result = parseCharacterImportText("{not-json");
  assert.equal(result.ok, false);
});

test("buildImportedCharacterSnapshot accepts full portable snapshot", () => {
  const parsed: CharacterSnapshot = {
    ...baseSnapshot,
    character: {
      ...baseSnapshot.character,
      name: "Mira",
      class: "Wizard",
    },
    inventory: [
      {
        id: "inv-scroll",
        name: "Scroll of Identify",
        quantity: 1,
        equipped: false,
        category: "consumable",
        notes: "",
      },
    ],
  };

  const result = buildImportedCharacterSnapshot({ parsed, baseSnapshot });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.snapshot.character.name, "Mira");
  assert.equal(result.snapshot.character.class, "Wizard");
  assert.equal(result.snapshot.inventory.length, 1);
});

test("buildImportedCharacterSnapshot accepts bare character payload", () => {
  const result = buildImportedCharacterSnapshot({
    parsed: { name: "Bran", class: "Fighter", level: 4 },
    baseSnapshot,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.snapshot.character.name, "Bran");
  assert.equal(result.snapshot.character.class, "Fighter");
  assert.equal(result.snapshot.character.level, 4);
  assert.equal(result.snapshot.inventory.length, 1);
  assert.equal(result.snapshot.inventory[0]?.name, "Dagger");
});

test("buildPortableCharacterExport returns portable snapshot envelope", () => {
  const exported = buildPortableCharacterExport(baseSnapshot);

  assert.equal(exported.character.name, "Ari");
  assert.ok(Array.isArray(exported.inventory));
  assert.equal(exported.inventory.length, 1);
});

test("buildCompanionCombatNpcPayload maps companion into combat NPC projection payload", () => {
  const companion: Companion = {
    id: "comp-1",
    characterId: "char-1",
    name: "Moss Wolf",
    type: "beast",
    size: "Medium",
    alignment: "unaligned",
    armor_class: 14,
    hit_points: 16,
    max_hit_points: 18,
    hit_dice: "4d8",
    speed: "40 ft.",
    strength: 14,
    dexterity: 15,
    constitution: 13,
    intelligence: 3,
    wisdom: 12,
    charisma: 7,
    challenge_rating: "1/2",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const payload = buildCompanionCombatNpcPayload({
    companion,
    ownerMemberId: "member-1",
    ownerCharacterId: "char-1",
    battleId: "battle-1",
  });

  assert.equal(payload.sourceType, "character");
  assert.equal(payload.sourceId, "comp-1");
  assert.equal(payload.disposition, "friendly");
  assert.equal(payload.coreStats.speed, 40);
  assert.equal(payload.coreStats.initiativeBonus, 2);
  assert.equal(payload.dummyState?.maxHp, 18);
  assert.equal(payload.dummyState?.currentHp, 16);
  assert.equal(payload.projection?.combatantKind, "companion");
  assert.equal(payload.projection?.companionId, "comp-1");
  assert.equal(payload.projection?.ownerMemberId, "member-1");
  assert.equal(payload.projection?.ownerCharacterId, "char-1");
  assert.equal(payload.battleId, "battle-1");
});

test("parseCompanionSpeedFeet falls back for malformed values", () => {
  assert.equal(parseCompanionSpeedFeet("50 ft., fly 80 ft."), 50);
  assert.equal(parseCompanionSpeedFeet(""), 30);
  assert.equal(parseCompanionSpeedFeet(undefined), 30);
  assert.equal(parseCompanionSpeedFeet("fast"), 30);
});

test("getCombatNpcPresentation labels companion with owner", () => {
  const members: PartyMemberSummary[] = [
    {
      id: "member-1",
      partyCode: "ABC",
      characterName: "Aria",
      characterClass: "Ranger 5",
      currentHp: 35,
      maxHp: 35,
      tempHp: 0,
      armorClass: 16,
      conditions: [],
      updatedAt: new Date().toISOString(),
    },
  ];
  const npc: CombatNpc = {
    id: "npc-comp-1",
    name: "Wolf Companion",
    sourceType: "character",
    sourceId: "comp-1",
    disposition: "friendly",
    coreStats: {
      speed: 40,
      initiativeBonus: 2,
      strength: 14,
      dexterity: 15,
      constitution: 13,
      intelligence: 3,
      wisdom: 12,
      charisma: 7,
    },
    visibleStatKeys: ["speed"],
    projection: {
      combatantKind: "companion",
      companionId: "comp-1",
      ownerMemberId: "member-1",
      ownerCharacterId: "char-1",
    },
    createdAt: new Date().toISOString(),
  };

  const presentation = getCombatNpcPresentation(npc, members, "member-1");
  assert.equal(presentation.kind, "companion");
  assert.equal(presentation.isOwnedByLocalMember, true);
  assert.equal(presentation.displayName, "Wolf Companion (Companion - Aria)");
});

test("getCombatNpcPresentation keeps non-companion classification distinct", () => {
  const npc: CombatNpc = {
    id: "npc-mon-1",
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
    createdAt: new Date().toISOString(),
  };

  const presentation = getCombatNpcPresentation(npc, [], null);
  assert.equal(presentation.kind, "monster");
  assert.equal(presentation.badgeLabel, "Monster");
  assert.equal(presentation.displayName, "Goblin");
});
