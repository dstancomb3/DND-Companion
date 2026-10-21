import assert from "node:assert/strict";
import test from "node:test";

import type { PartyMemberSummary } from "../../utils/partyApi.ts";
import {
  buildPartyMemberSheetPath,
  normalizeMemberIdParam,
  resolvePartyMemberForSheet,
} from "../../utils/partyMemberSheetNavigation.ts";

const members: PartyMemberSummary[] = [
  {
    id: "m-1",
    partyCode: "ABCD",
    characterName: "Aria",
    characterClass: "Rogue",
    currentHp: 18,
    maxHp: 24,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
  {
    id: "m-2",
    partyCode: "ABCD",
    characterName: "Borin",
    characterClass: "Fighter",
    currentHp: 28,
    maxHp: 35,
    tempHp: 3,
    armorClass: 17,
    conditions: [{ id: "cond-1", name: "Blessed" }],
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
];

test("buildPartyMemberSheetPath encodes params for routing", () => {
  const path = buildPartyMemberSheetPath("m-1", "party");
  assert.equal(path, "/party-member?memberId=m-1&source=party");
});

test("normalizeMemberIdParam handles missing and blank ids safely", () => {
  assert.equal(normalizeMemberIdParam(undefined), null);
  assert.equal(normalizeMemberIdParam(""), null);
  assert.equal(normalizeMemberIdParam("   "), null);
  assert.equal(normalizeMemberIdParam([" m-2 "]), "m-2");
});

test("resolvePartyMemberForSheet finds the expected member", () => {
  const member = resolvePartyMemberForSheet(members, "m-2");
  assert.ok(member);
  assert.equal(member.characterName, "Borin");
});

test("resolvePartyMemberForSheet returns null for invalid member id", () => {
  const member = resolvePartyMemberForSheet(members, "does-not-exist");
  assert.equal(member, null);
});

test("resolvePartyMemberForSheet returns null for missing member id param", () => {
  const member = resolvePartyMemberForSheet(members, undefined);
  assert.equal(member, null);
});
