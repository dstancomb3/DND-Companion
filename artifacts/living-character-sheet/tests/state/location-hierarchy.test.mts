import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignLocation, Quest, QuestGraphRelationshipRecord } from "../../types/index.ts";
import {
  buildEffectiveLocationQuestLinks,
  buildLocationBreadcrumb,
  buildLocationHierarchy,
  normalizeLocationHierarchyRecords,
} from "../../utils/locationHierarchy.ts";

function makeRelationship(partial: Partial<QuestGraphRelationshipRecord>): QuestGraphRelationshipRecord {
  return {
    relationshipType: partial.relationshipType ?? "related_to",
    direction: partial.direction ?? "outgoing",
    otherKind: partial.otherKind ?? "location",
    otherId: partial.otherId ?? "",
    source: "parser_graph_v2",
    reviewState: "confirmed",
    confidence: "high",
    updatedAt: 1,
    ...(partial.otherName ? { otherName: partial.otherName } : {}),
  };
}

function makeLocation(partial: Partial<CampaignLocation> & { id: string; name: string }): CampaignLocation {
  return {
    id: partial.id,
    name: partial.name,
    description: partial.description,
    questTags: partial.questTags ?? [],
    parentLocationId: partial.parentLocationId,
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
    type: partial.type ?? "side",
    status: partial.status ?? "active",
    description: partial.description,
    notes: partial.notes,
    locationTags: partial.locationTags ?? [],
    locationLinkModes: partial.locationLinkModes,
    createdAt: partial.createdAt ?? 1,
    pinned: partial.pinned,
  };
}

test("normalization infers parentLocationId from contained_in relationship", () => {
  const city = makeLocation({ id: "loc-city", name: "Yor" });
  const cave = makeLocation({
    id: "loc-cave",
    name: "Caves of Draggar",
    relationships: [
      makeRelationship({ relationshipType: "contained_in", direction: "outgoing", otherId: "loc-city" }),
    ],
  });

  const normalized = normalizeLocationHierarchyRecords([city, cave]);
  const caveAfter = normalized.find((location) => location.id === "loc-cave");

  assert.equal(caveAfter?.parentLocationId, "loc-city");
});

test("normalization clears cyclic parent chains", () => {
  const a = makeLocation({ id: "a", name: "A", parentLocationId: "b" });
  const b = makeLocation({ id: "b", name: "B", parentLocationId: "a" });

  const normalized = normalizeLocationHierarchyRecords([a, b]);
  const aAfter = normalized.find((location) => location.id === "a");
  const bAfter = normalized.find((location) => location.id === "b");

  assert.equal(aAfter?.parentLocationId, undefined);
  assert.equal(bAfter?.parentLocationId, undefined);
});

test("hierarchy builder emits nested order and breadcrumb", () => {
  const root = makeLocation({ id: "loc-root", name: "Ironveil", createdAt: 100 });
  const child = makeLocation({ id: "loc-child", name: "Blackwater Docks", parentLocationId: "loc-root", createdAt: 90 });
  const leaf = makeLocation({ id: "loc-leaf", name: "Guild Hall", parentLocationId: "loc-child", createdAt: 80 });

  const hierarchy = buildLocationHierarchy([leaf, child, root]);

  assert.deepEqual(hierarchy.map((entry) => entry.location.id), ["loc-root", "loc-child", "loc-leaf"]);
  assert.deepEqual(hierarchy.map((entry) => entry.depth), [0, 1, 2]);

  const byId = new Map(hierarchy.map((entry) => [entry.location.id, entry.location] as const));
  assert.equal(buildLocationBreadcrumb("loc-leaf", byId), "Ironveil > Blackwater Docks > Guild Hall");
});

test("effective quest links inherit only when mode enables descendants", () => {
  const root = makeLocation({ id: "root", name: "Ironveil" });
  const child = makeLocation({ id: "child", name: "Docks", parentLocationId: "root" });

  const directQuest = makeQuest({ id: "q-direct", name: "Direct", locationTags: ["root"] });
  const inheritingQuest = makeQuest({
    id: "q-inherit",
    name: "Inherited",
    locationTags: ["root"],
    locationLinkModes: { root: "inherit_to_descendants" },
  });

  const links = buildEffectiveLocationQuestLinks([directQuest, inheritingQuest], [root, child]);
  const rootLinks = links.get("root");
  const childLinks = links.get("child");

  assert.deepEqual(rootLinks?.directQuestIds.sort(), ["q-direct", "q-inherit"]);
  assert.deepEqual(rootLinks?.inheritedQuestIds, []);
  assert.deepEqual(childLinks?.directQuestIds, []);
  assert.deepEqual(childLinks?.inheritedQuestIds, ["q-inherit"]);
});

test("effective quest links avoid duplicate inherited tags when quest is also direct on child", () => {
  const root = makeLocation({ id: "root", name: "Root" });
  const child = makeLocation({ id: "child", name: "Child", parentLocationId: "root" });

  const quest = makeQuest({
    id: "q-1",
    name: "Quest",
    locationTags: ["root", "child"],
    locationLinkModes: { root: "inherit_to_descendants" },
  });

  const links = buildEffectiveLocationQuestLinks([quest], [root, child]);
  const childLinks = links.get("child");

  assert.deepEqual(childLinks?.directQuestIds, ["q-1"]);
  assert.deepEqual(childLinks?.inheritedQuestIds, []);
});
