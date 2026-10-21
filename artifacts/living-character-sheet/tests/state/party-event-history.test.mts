import assert from "node:assert/strict";
import test from "node:test";

import type { CombatNpc, PartyEvent, PartyMemberSummary } from "../../utils/partyApi.ts";
import { buildPartyEventHistoryView } from "../../utils/partyEventHistory.ts";

const members: PartyMemberSummary[] = [
  {
    id: "m1",
    partyCode: "ABCD",
    characterName: "Aria",
    characterClass: "Rogue",
    currentHp: 18,
    maxHp: 24,
    tempHp: 0,
    armorClass: 15,
    snapshotUpdatedAt: 1,
    conditions: [],
  },
];

const npcs: CombatNpc[] = [
  {
    id: "npc_1",
    name: "Goblin",
    sourceType: "monster",
    sourceId: "goblin",
    disposition: "hostile",
    coreStats: {
      speed: 30,
      initiativeBonus: 2,
      strength: 8,
      dexterity: 14,
      constitution: 10,
      intelligence: 8,
      wisdom: 8,
      charisma: 8,
    },
    visibleStatKeys: ["speed", "initiativeBonus", "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
    createdAt: "2026-04-28T09:00:00.000Z",
  },
];

function event(partial: Partial<PartyEvent> & { id: string; type: string; message: string; createdAt: string }): PartyEvent {
  return {
    id: partial.id,
    type: partial.type,
    message: partial.message,
    memberId: partial.memberId,
    metadata: partial.metadata,
    createdAt: partial.createdAt,
  };
}

test("filters by event type", () => {
  const events: PartyEvent[] = [
    event({ id: "1", type: "loot_assigned", message: "loot", createdAt: "2026-04-28T09:00:00.000Z" }),
    event({ id: "2", type: "initiative_started", message: "initiative", createdAt: "2026-04-28T09:10:00.000Z" }),
  ];

  const view = buildPartyEventHistoryView({
    events,
    members,
    npcs,
    filters: {
      type: "initiative_started",
      actor: "all",
      relevance: "all",
      importantOnly: false,
    },
  });

  assert.equal(view.items.length, 1);
  assert.equal(view.items[0].typeFilterValue, "initiative_started");
});

test("filters by actor/source where available", () => {
  const events: PartyEvent[] = [
    event({ id: "1", type: "initiative_rolled", message: "rolled", memberId: "m1", createdAt: "2026-04-28T09:00:00.000Z" }),
    event({ id: "2", type: "combat_remote_outcome_applied", message: "remote", metadata: { sourceMemberId: "m2" }, createdAt: "2026-04-28T09:10:00.000Z" }),
  ];

  const view = buildPartyEventHistoryView({
    events,
    members,
    npcs,
    filters: {
      type: "all",
      actor: "member:m1",
      relevance: "all",
      importantOnly: false,
    },
  });

  assert.equal(view.items.length, 1);
  assert.equal(view.items[0].actorLabel, "Aria");
});

test("filters combat-relevant vs general events", () => {
  const events: PartyEvent[] = [
    event({ id: "1", type: "turn_advanced", message: "turn", createdAt: "2026-04-28T09:00:00.000Z" }),
    event({ id: "2", type: "notes_assigned", message: "notes", createdAt: "2026-04-28T09:10:00.000Z" }),
  ];

  const combatOnly = buildPartyEventHistoryView({
    events,
    members,
    npcs,
    filters: {
      type: "all",
      actor: "all",
      relevance: "combat",
      importantOnly: false,
    },
  });

  const generalOnly = buildPartyEventHistoryView({
    events,
    members,
    npcs,
    filters: {
      type: "all",
      actor: "all",
      relevance: "general",
      importantOnly: false,
    },
  });

  assert.equal(combatOnly.items.length, 1);
  assert.equal(combatOnly.items[0].typeFilterValue, "turn_advanced");
  assert.equal(generalOnly.items.length, 1);
  assert.equal(generalOnly.items[0].typeFilterValue, "notes_assigned");
});

test("groups by date sections in descending order", () => {
  const events: PartyEvent[] = [
    event({ id: "1", type: "initiative_started", message: "a", createdAt: "2026-04-27T09:00:00.000Z" }),
    event({ id: "2", type: "initiative_rolled", message: "b", createdAt: "2026-04-28T09:10:00.000Z" }),
    event({ id: "3", type: "turn_advanced", message: "c", createdAt: "2026-04-28T09:12:00.000Z" }),
  ];

  const view = buildPartyEventHistoryView({
    events,
    members,
    npcs,
    filters: {
      type: "all",
      actor: "all",
      relevance: "all",
      importantOnly: false,
    },
  });

  assert.equal(view.sections.length, 2);
  assert.equal(view.sections[0].items.length, 2);
  assert.equal(view.sections[1].items.length, 1);
  assert.equal(view.sections[0].items[0].id, "3");
});

test("handles sparse metadata and fallback message safely", () => {
  const events: PartyEvent[] = [
    event({ id: "1", type: "custom_event", message: "", createdAt: "not-a-date" }),
  ];

  const view = buildPartyEventHistoryView({
    events,
    members,
    npcs,
    filters: {
      type: "all",
      actor: "all",
      relevance: "all",
      importantOnly: false,
    },
  });

  assert.equal(view.items.length, 1);
  assert.equal(view.items[0].actorLabel, "System");
  assert.equal(view.items[0].message, "Event: Custom Event");
  assert.equal(view.items[0].timestampLabel, "--:--");
});

test("shows 'Source unavailable' for unresolvable memberId", () => {
  const events: PartyEvent[] = [
    event({ id: "1", type: "initiative_rolled", message: "rolled", memberId: "unknown-uuid-999", createdAt: "2026-04-28T09:00:00.000Z" }),
  ];

  const view = buildPartyEventHistoryView({
    events,
    members,
    npcs,
    filters: {
      type: "all",
      actor: "all",
      relevance: "all",
      importantOnly: false,
    },
  });

  assert.equal(view.items.length, 1);
  assert.equal(view.items[0].actorLabel, "Source unavailable");
});

test("hasActiveFilters is false when all filters are default", () => {
  const events: PartyEvent[] = [
    event({ id: "1", type: "initiative_started", message: "a", createdAt: "2026-04-28T09:00:00.000Z" }),
  ];

  const view = buildPartyEventHistoryView({
    events,
    members,
    npcs,
    filters: { type: "all", actor: "all", relevance: "all", importantOnly: false },
  });

  assert.equal(view.hasActiveFilters, false);
  assert.equal(view.totalUnfilteredCount, 1);
});

test("hasActiveFilters is true when any filter is non-default", () => {
  const events: PartyEvent[] = [
    event({ id: "1", type: "initiative_started", message: "a", createdAt: "2026-04-28T09:00:00.000Z" }),
    event({ id: "2", type: "notes_assigned", message: "b", createdAt: "2026-04-28T09:01:00.000Z" }),
  ];

  const typeFiltered = buildPartyEventHistoryView({
    events,
    members,
    npcs,
    filters: { type: "initiative_started", actor: "all", relevance: "all", importantOnly: false },
  });

  assert.equal(typeFiltered.hasActiveFilters, true);
  assert.equal(typeFiltered.totalUnfilteredCount, 2);
  assert.equal(typeFiltered.items.length, 1);
});

test("turn_advanced message uses dashes for unresolvable participant IDs", () => {
  const events: PartyEvent[] = [
    event({
      id: "1",
      type: "turn_advanced",
      message: "",
      metadata: { from: "ghost-uuid", to: "another-ghost-uuid" },
      createdAt: "2026-04-28T09:00:00.000Z",
    }),
  ];

  const view = buildPartyEventHistoryView({
    events,
    members,
    npcs,
    filters: { type: "all", actor: "all", relevance: "all", importantOnly: false },
  });

  assert.equal(view.items.length, 1);
  assert.match(view.items[0].message, /Source unavailable/);
});
