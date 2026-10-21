import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignLocation, NpcPerson, Quest } from "../../types/index.ts";
import type { NotesAssignmentPayload } from "../../utils/partyApi.ts";
import { mergeAssignedNotesPayload } from "../../utils/partyNotesMerge.ts";

function makeLocation(partial: Partial<CampaignLocation> & { id: string; name: string }): CampaignLocation {
  return {
    id: partial.id,
    name: partial.name,
    aliases: partial.aliases,
    parentLocationId: partial.parentLocationId,
    description: partial.description,
    mapImageUri: partial.mapImageUri,
    questTags: partial.questTags ?? [],
    relationships: partial.relationships,
    notes: partial.notes,
    createdAt: partial.createdAt ?? 1,
    pinned: partial.pinned,
  };
}

function makeQuest(partial: Partial<Quest> & { id: string; name: string }): Quest {
  return {
    id: partial.id,
    name: partial.name,
    aliases: partial.aliases,
    type: partial.type ?? "side",
    status: partial.status ?? "active",
    description: partial.description,
    objectives: partial.objectives,
    locationTags: partial.locationTags ?? [],
    locationLinkModes: partial.locationLinkModes,
    peopleTags: partial.peopleTags,
    relationships: partial.relationships,
    referenceItems: partial.referenceItems,
    notes: partial.notes,
    createdAt: partial.createdAt ?? 1,
    pinned: partial.pinned,
  };
}

function makePerson(partial: Partial<NpcPerson> & { id: string; name: string }): NpcPerson {
  return {
    id: partial.id,
    name: partial.name,
    aliases: partial.aliases,
    role: partial.role,
    relationship: partial.relationship ?? "unknown",
    description: partial.description,
    questTags: partial.questTags ?? [],
    locationTags: partial.locationTags,
    relationships: partial.relationships,
    notes: partial.notes,
    createdAt: partial.createdAt ?? 1,
    pinned: partial.pinned,
    deceased: partial.deceased,
    deceasedNote: partial.deceasedNote,
  };
}

test("shared note merge preserves location parent hierarchy updates", () => {
  const existingLocations = [
    makeLocation({ id: "loc-parent", name: "Ironveil" }),
    makeLocation({ id: "loc-child", name: "Docks" }),
  ];
  const payload: NotesAssignmentPayload = {
    quests: [],
    people: [],
    locations: [
      makeLocation({ id: "loc-child", name: "Docks", parentLocationId: "loc-parent" }),
    ],
  };

  const result = mergeAssignedNotesPayload({
    payload,
    existingQuests: [],
    existingPeople: [],
    existingLocations,
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.locations.length, 1);
  assert.equal(result.locations[0].id, "loc-child");
  assert.equal(result.locations[0].data.parentLocationId, "loc-parent");
});

test("shared note merge preserves quest location-link mode metadata", () => {
  const existingQuest = makeQuest({
    id: "quest-1",
    name: "Reclaim the Docks",
    locationTags: ["loc-parent"],
    locationLinkModes: { "loc-parent": "inherit_to_descendants" },
  });

  const payload: NotesAssignmentPayload = {
    quests: [
      makeQuest({
        id: "quest-1",
        name: "Reclaim the Docks",
        locationTags: ["loc-parent", "loc-child"],
        locationLinkModes: {
          "loc-parent": "inherit_to_descendants",
          "loc-child": "direct_only",
        },
      }),
    ],
    people: [],
    locations: [],
  };

  const result = mergeAssignedNotesPayload({
    payload,
    existingQuests: [existingQuest],
    existingPeople: [],
    existingLocations: [],
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.quests.length, 1);
  assert.deepEqual(result.quests[0].data.locationTags.sort(), ["loc-child", "loc-parent"]);
  assert.deepEqual(result.quests[0].data.locationLinkModes, {
    "loc-parent": "inherit_to_descendants",
    "loc-child": "direct_only",
  });
});

test("unsupported link-mode updates are explicit and do not silently overwrite", () => {
  const existingQuest = makeQuest({
    id: "quest-1",
    name: "Vault Hunt",
    locationTags: ["loc-existing"],
    locationLinkModes: { "loc-existing": "inherit_to_descendants" },
  });

  const payload: NotesAssignmentPayload = {
    quests: [
      {
        ...makeQuest({ id: "quest-1", name: "Vault Hunt", locationTags: ["loc-existing"] }),
        locationLinkModes: {
          "loc-missing": "inherit_to_descendants",
          "loc-existing": "direct_only",
        },
      },
    ],
    people: [
      makePerson({
        id: "person-1",
        name: "Captain Rhea",
        questTags: ["quest-1"],
        locationTags: ["loc-existing"],
      }),
    ],
    locations: [],
  };

  const result = mergeAssignedNotesPayload({
    payload,
    existingQuests: [existingQuest],
    existingPeople: [],
    existingLocations: [],
  });

  assert.ok(result.warnings.some((warning) => warning.code === "link_mode_without_location_tag"));
  assert.deepEqual(result.quests[0].data.locationLinkModes, {
    "loc-existing": "direct_only",
  });
  assert.deepEqual(result.people[0].data.locationTags, ["loc-existing"]);
});

test("cycle-unsafe hierarchy updates stay explicit", () => {
  const existingLocations = [
    makeLocation({ id: "a", name: "A", parentLocationId: "b" }),
    makeLocation({ id: "b", name: "B" }),
  ];

  const payload: NotesAssignmentPayload = {
    quests: [],
    people: [],
    locations: [
      makeLocation({ id: "b", name: "B", parentLocationId: "a" }),
    ],
  };

  const result = mergeAssignedNotesPayload({
    payload,
    existingQuests: [],
    existingPeople: [],
    existingLocations,
  });

  assert.ok(result.warnings.some((warning) => warning.code === "cycle_safe_parent_reset"));
  assert.equal(result.locations[0].data.parentLocationId, undefined);
});
