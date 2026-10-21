import type { CampaignLocation, Quest } from "@/types";

export interface LocationHierarchyEntry {
  location: CampaignLocation;
  depth: number;
  breadcrumb: string;
  parentBreadcrumb?: string;
}

export interface EffectiveLocationQuestLinks {
  directQuestIds: string[];
  inheritedQuestIds: string[];
}

function compareLocations(a: CampaignLocation, b: CampaignLocation): number {
  if ((a.pinned ? 0 : 1) !== (b.pinned ? 0 : 1)) return (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1);
  const createdDiff = b.createdAt - a.createdAt;
  if (createdDiff !== 0) return createdDiff;
  return a.name.localeCompare(b.name);
}

function getValidParentId(location: CampaignLocation, byId: Map<string, CampaignLocation>): string | undefined {
  if (!location.parentLocationId || location.parentLocationId === location.id) return undefined;
  return byId.has(location.parentLocationId) ? location.parentLocationId : undefined;
}

function inferParentFromRelationships(location: CampaignLocation, byId: Map<string, CampaignLocation>): string | undefined {
  const candidates = new Set<string>();
  (location.relationships ?? []).forEach((relationship) => {
    if (relationship.otherKind !== "location") return;
    if (!relationship.otherId || relationship.otherId === location.id) return;
    if (!byId.has(relationship.otherId)) return;

    const isContainedIn = relationship.relationshipType === "contained_in" && relationship.direction === "outgoing";
    const isIncomingContains = relationship.relationshipType === "contains_location" && relationship.direction === "incoming";
    if (isContainedIn || isIncomingContains) {
      candidates.add(relationship.otherId);
    }
  });

  if (candidates.size !== 1) return undefined;
  return [...candidates][0];
}

function resolveCycleSafeParentId(
  locationId: string,
  parentById: Map<string, string | undefined>
): string | undefined {
  const directParentId = parentById.get(locationId);
  if (!directParentId) return undefined;

  const seen = new Set<string>([locationId]);
  let current: string | undefined = directParentId;
  while (current) {
    if (seen.has(current)) return undefined;
    seen.add(current);
    current = parentById.get(current);
  }

  return directParentId;
}

export function normalizeLocationHierarchyRecords(locations: CampaignLocation[]): CampaignLocation[] {
  if (!Array.isArray(locations) || locations.length === 0) return [];

  const byId = new Map(locations.map((location) => [location.id, location] as const));
  const parentById = new Map<string, string | undefined>();

  locations.forEach((location) => {
    const explicitParent = getValidParentId(location, byId);
    if (explicitParent) {
      parentById.set(location.id, explicitParent);
      return;
    }
    parentById.set(location.id, inferParentFromRelationships(location, byId));
  });

  return locations.map((location) => {
    const safeParentId = resolveCycleSafeParentId(location.id, parentById);
    if (safeParentId === location.parentLocationId) return location;
    return { ...location, parentLocationId: safeParentId };
  });
}

export function buildLocationBreadcrumb(locationId: string, locationById: Map<string, CampaignLocation>): string {
  const trail: string[] = [];
  const seen = new Set<string>();
  let current = locationById.get(locationId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift(current.name);
    const parentId = getValidParentId(current, locationById);
    current = parentId ? locationById.get(parentId) : undefined;
  }

  return trail.join(" > ");
}

export function getLocationDescendantIds(locationId: string, locations: CampaignLocation[]): Set<string> {
  const byParent = new Map<string, CampaignLocation[]>();
  locations.forEach((location) => {
    if (!location.parentLocationId || location.parentLocationId === location.id) return;
    byParent.set(location.parentLocationId, [...(byParent.get(location.parentLocationId) ?? []), location]);
  });

  const descendants = new Set<string>();
  const stack = [...(byParent.get(locationId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || descendants.has(current.id)) continue;
    descendants.add(current.id);
    stack.push(...(byParent.get(current.id) ?? []));
  }

  return descendants;
}

export function buildLocationHierarchy(locations: CampaignLocation[]): LocationHierarchyEntry[] {
  const normalizedLocations = normalizeLocationHierarchyRecords(locations);
  const byId = new Map(normalizedLocations.map((location) => [location.id, location] as const));
  const byParent = new Map<string, CampaignLocation[]>();
  const roots: CampaignLocation[] = [];

  normalizedLocations.forEach((location) => {
    const parentId = getValidParentId(location, byId);
    if (!parentId) {
      roots.push(location);
      return;
    }
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), location]);
  });

  roots.sort(compareLocations);
  byParent.forEach((children, key) => {
    byParent.set(key, [...children].sort(compareLocations));
  });

  const entries: LocationHierarchyEntry[] = [];
  const visited = new Set<string>();

  const visit = (location: CampaignLocation, depth: number) => {
    if (visited.has(location.id)) return;
    visited.add(location.id);
    const breadcrumb = buildLocationBreadcrumb(location.id, byId);
    const parentBreadcrumb = breadcrumb.includes(" > ") ? breadcrumb.slice(0, breadcrumb.lastIndexOf(" > ")) : undefined;
    entries.push({ location, depth, breadcrumb, parentBreadcrumb });
    (byParent.get(location.id) ?? []).forEach((child) => visit(child, depth + 1));
  };

  roots.forEach((root) => visit(root, 0));
  normalizedLocations
    .filter((location) => !visited.has(location.id))
    .sort(compareLocations)
    .forEach((location) => visit(location, 0));

  return entries;
}

export function buildEffectiveLocationQuestLinks(
  quests: Quest[],
  locations: CampaignLocation[]
): Map<string, EffectiveLocationQuestLinks> {
  const normalizedLocations = normalizeLocationHierarchyRecords(locations);
  const locationIds = new Set(normalizedLocations.map((location) => location.id));
  const descendantsById = new Map<string, Set<string>>();
  normalizedLocations.forEach((location) => {
    descendantsById.set(location.id, getLocationDescendantIds(location.id, normalizedLocations));
  });

  const directByLocation = new Map<string, Set<string>>();
  const inheritedByLocation = new Map<string, Set<string>>();

  const addTo = (target: Map<string, Set<string>>, locationId: string, questId: string) => {
    const existing = target.get(locationId) ?? new Set<string>();
    existing.add(questId);
    target.set(locationId, existing);
  };

  normalizedLocations.forEach((location) => {
    (location.questTags ?? []).forEach((questId) => addTo(directByLocation, location.id, questId));
  });

  quests.forEach((quest) => {
    (quest.locationTags ?? []).forEach((locationId) => {
      if (!locationIds.has(locationId)) return;
      addTo(directByLocation, locationId, quest.id);

      const mode = quest.locationLinkModes?.[locationId] ?? "direct_only";
      if (mode !== "inherit_to_descendants") return;
      const descendants = descendantsById.get(locationId) ?? new Set<string>();
      descendants.forEach((descendantId) => {
        if (descendantId === locationId) return;
        addTo(inheritedByLocation, descendantId, quest.id);
      });
    });
  });

  const result = new Map<string, EffectiveLocationQuestLinks>();
  normalizedLocations.forEach((location) => {
    const directQuestIds = [...(directByLocation.get(location.id) ?? new Set<string>())];
    const inheritedQuestIds = [...(inheritedByLocation.get(location.id) ?? new Set<string>())]
      .filter((questId) => !directQuestIds.includes(questId));
    result.set(location.id, { directQuestIds, inheritedQuestIds });
  });

  return result;
}