import type { CampaignLocation, NpcPerson, Quest, QuestLocationLinkMode } from "@/types";
import type { NotesAssignmentPayload } from "@/utils/partyApi";
import { normalizeLocationHierarchyRecords } from "@/utils/locationHierarchy";

export type PartyNotesMergeWarningCode =
  | "unknown_location_parent"
  | "cycle_safe_parent_reset"
  | "invalid_location_link_mode"
  | "link_mode_without_location_tag";

export interface PartyNotesMergeWarning {
  code: PartyNotesMergeWarningCode;
  message: string;
}

interface UpsertQuestOperation {
  id?: string;
  data: Omit<Quest, "id" | "createdAt">;
}

interface UpsertPersonOperation {
  id?: string;
  data: Omit<NpcPerson, "id" | "createdAt">;
}

interface UpsertLocationOperation {
  id?: string;
  data: Omit<CampaignLocation, "id" | "createdAt">;
}

export interface MergeAssignedNotesPayloadResult {
  quests: UpsertQuestOperation[];
  people: UpsertPersonOperation[];
  locations: UpsertLocationOperation[];
  warnings: PartyNotesMergeWarning[];
}

function keyForName(name: string): string {
  return name.trim().toLowerCase();
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function isValidQuestLocationLinkMode(mode: unknown): mode is QuestLocationLinkMode {
  return mode === "direct_only" || mode === "inherit_to_descendants";
}

function mapLocationReference(
  locationId: string,
  payloadToCanonicalLocationId: Map<string, string>,
  existingLocationsById: Map<string, CampaignLocation>,
): string {
  return payloadToCanonicalLocationId.get(locationId) ?? (existingLocationsById.has(locationId) ? locationId : locationId);
}

export function mergeAssignedNotesPayload(input: {
  payload: NotesAssignmentPayload;
  existingQuests: Quest[];
  existingPeople: NpcPerson[];
  existingLocations: CampaignLocation[];
}): MergeAssignedNotesPayloadResult {
  const warnings: PartyNotesMergeWarning[] = [];
  const existingQuestsById = new Map(input.existingQuests.map((quest) => [quest.id, quest] as const));
  const existingQuestsByName = new Map(input.existingQuests.map((quest) => [keyForName(quest.name), quest] as const));
  const existingPeopleById = new Map(input.existingPeople.map((person) => [person.id, person] as const));
  const existingPeopleByName = new Map(input.existingPeople.map((person) => [keyForName(person.name), person] as const));
  const existingLocationsById = new Map(input.existingLocations.map((location) => [location.id, location] as const));
  const existingLocationsByName = new Map(input.existingLocations.map((location) => [keyForName(location.name), location] as const));

  const payloadLocations = input.payload.locations ?? [];
  const payloadToCanonicalLocationId = new Map<string, string>();
  const canonicalLocationCandidates = new Map<string, { base: CampaignLocation; fromPayload: boolean }>();

  for (const location of payloadLocations) {
    const existing = existingLocationsById.get(location.id) ?? existingLocationsByName.get(keyForName(location.name));
    const canonicalId = existing?.id ?? location.id;
    payloadToCanonicalLocationId.set(location.id, canonicalId);

    const candidateBase: CampaignLocation = {
      ...(existing ?? location),
      ...location,
      id: canonicalId,
      questTags: uniqueStrings([...(existing?.questTags ?? []), ...(location.questTags ?? [])]),
      parentLocationId: existing?.parentLocationId,
    };

    canonicalLocationCandidates.set(canonicalId, {
      base: candidateBase,
      fromPayload: true,
    });
  }

  // Apply parent links only when they can be resolved safely by id to avoid silently dropping structure.
  for (const location of payloadLocations) {
    const canonicalId = payloadToCanonicalLocationId.get(location.id);
    if (!canonicalId) continue;
    const candidate = canonicalLocationCandidates.get(canonicalId);
    if (!candidate) continue;

    if (!location.parentLocationId) {
      candidate.base.parentLocationId = undefined;
      continue;
    }

    const mappedParentId = payloadToCanonicalLocationId.get(location.parentLocationId)
      ?? (existingLocationsById.has(location.parentLocationId) ? location.parentLocationId : undefined);

    if (!mappedParentId || mappedParentId === canonicalId) {
      warnings.push({
        code: "unknown_location_parent",
        message: `Deferred unsupported location parent link for ${location.name}.`,
      });
      continue;
    }

    candidate.base.parentLocationId = mappedParentId;
  }

  const mergedLocationWorkingSet = new Map<string, CampaignLocation>(
    input.existingLocations.map((location) => [location.id, location] as const),
  );
  canonicalLocationCandidates.forEach(({ base }, canonicalId) => {
    mergedLocationWorkingSet.set(canonicalId, base);
  });

  const normalizedLocations = normalizeLocationHierarchyRecords([...mergedLocationWorkingSet.values()]);
  const normalizedLocationsById = new Map(normalizedLocations.map((location) => [location.id, location] as const));

  canonicalLocationCandidates.forEach(({ base }, canonicalId) => {
    const normalized = normalizedLocationsById.get(canonicalId);
    if (!normalized) return;
    const intendedParent = base.parentLocationId;
    const actualParent = normalized.parentLocationId;
    if (intendedParent && intendedParent !== actualParent) {
      warnings.push({
        code: "cycle_safe_parent_reset",
        message: `Deferred unsafe location parent update for ${normalized.name} to prevent hierarchy breakage.`,
      });
    }
  });

  const locationOps = payloadLocations
    .map((location): UpsertLocationOperation | null => {
      const existing = existingLocationsById.get(location.id) ?? existingLocationsByName.get(keyForName(location.name));
      const canonicalId = payloadToCanonicalLocationId.get(location.id) ?? location.id;
      const normalized = normalizedLocationsById.get(canonicalId);
      if (!normalized) return null;

      return {
        id: existing?.id,
        data: {
          name: normalized.name,
          aliases: normalized.aliases,
          parentLocationId: normalized.parentLocationId,
          description: normalized.description,
          mapImageUri: normalized.mapImageUri,
          questTags: normalized.questTags ?? [],
          relationships: normalized.relationships,
          notes: normalized.notes,
          pinned: normalized.pinned,
        },
      };
    })
    .filter((op): op is UpsertLocationOperation => op !== null);

  const questOps: UpsertQuestOperation[] = (input.payload.quests ?? []).map((quest) => {
    const existing = existingQuestsById.get(quest.id) ?? existingQuestsByName.get(keyForName(quest.name));
    const canonicalIncomingLocationTags = uniqueStrings((quest.locationTags ?? []).map((locationId) => (
      mapLocationReference(locationId, payloadToCanonicalLocationId, existingLocationsById)
    )));

    const mergedLocationTags = uniqueStrings([...(existing?.locationTags ?? []), ...canonicalIncomingLocationTags]);
    const mergedLocationTagSet = new Set(mergedLocationTags);

    const mergedLocationLinkModes: Record<string, QuestLocationLinkMode> = {
      ...(existing?.locationLinkModes ?? {}),
    };

    if (quest.locationLinkModes && typeof quest.locationLinkModes === "object") {
      for (const [rawLocationId, mode] of Object.entries(quest.locationLinkModes)) {
        const canonicalLocationId = mapLocationReference(rawLocationId, payloadToCanonicalLocationId, existingLocationsById);
        if (!isValidQuestLocationLinkMode(mode)) {
          warnings.push({
            code: "invalid_location_link_mode",
            message: `Quest ${quest.name} has unsupported location link mode for ${rawLocationId}; deferred.`,
          });
          continue;
        }
        if (!mergedLocationTagSet.has(canonicalLocationId)) {
          warnings.push({
            code: "link_mode_without_location_tag",
            message: `Quest ${quest.name} location link mode for ${rawLocationId} was deferred because the location is not linked.`,
          });
          continue;
        }
        mergedLocationLinkModes[canonicalLocationId] = mode;
      }
    }

    // Keep only supported modes attached to linked locations.
    Object.keys(mergedLocationLinkModes).forEach((locationId) => {
      if (!mergedLocationTagSet.has(locationId) || !isValidQuestLocationLinkMode(mergedLocationLinkModes[locationId])) {
        delete mergedLocationLinkModes[locationId];
      }
    });

    return {
      id: existing?.id,
      data: {
        name: quest.name,
        aliases: quest.aliases ?? existing?.aliases,
        type: quest.type,
        status: quest.status,
        description: quest.description ?? existing?.description,
        objectives: quest.objectives ?? existing?.objectives,
        locationTags: mergedLocationTags,
        locationLinkModes: Object.keys(mergedLocationLinkModes).length > 0 ? mergedLocationLinkModes : undefined,
        peopleTags: quest.peopleTags ?? existing?.peopleTags,
        relationships: quest.relationships ?? existing?.relationships,
        referenceItems: quest.referenceItems ?? existing?.referenceItems,
        notes: quest.notes ?? existing?.notes,
        pinned: quest.pinned ?? existing?.pinned,
      },
    } satisfies UpsertQuestOperation;
  });

  const peopleOps: UpsertPersonOperation[] = (input.payload.people ?? []).map((person) => {
    const existing = existingPeopleById.get(person.id) ?? existingPeopleByName.get(keyForName(person.name));
    const mergedLocationTags = uniqueStrings([
      ...(existing?.locationTags ?? []),
      ...(person.locationTags ?? []).map((locationId) => mapLocationReference(locationId, payloadToCanonicalLocationId, existingLocationsById)),
    ]);
    const mergedQuestTags = uniqueStrings([...(existing?.questTags ?? []), ...(person.questTags ?? [])]);

    return {
      id: existing?.id,
      data: {
        name: person.name,
        aliases: person.aliases ?? existing?.aliases,
        role: person.role,
        relationship: person.relationship,
        description: person.description ?? existing?.description,
        questTags: mergedQuestTags,
        locationTags: mergedLocationTags.length > 0 ? mergedLocationTags : undefined,
        relationships: person.relationships ?? existing?.relationships,
        notes: person.notes ?? existing?.notes,
        pinned: person.pinned ?? existing?.pinned,
        deceased: person.deceased ?? existing?.deceased,
        deceasedNote: person.deceasedNote ?? existing?.deceasedNote,
      },
    } satisfies UpsertPersonOperation;
  });

  return {
    quests: questOps,
    people: peopleOps,
    locations: locationOps,
    warnings,
  };
}