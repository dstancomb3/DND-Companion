import type { MutationBatchSnapshot, ProposedResourceChange, Resource } from "@/types";

/**
 * Derive deterministic reverse deltas to restore resources back to the snapshot state.
 */
export function buildResourceUndoChanges(
  snapshot: MutationBatchSnapshot,
  currentResources: Resource[]
): ProposedResourceChange[] {
  if (!snapshot.resourceStates || snapshot.resourceStates.length === 0) return [];

  const byId = new Map(currentResources.map((resource) => [resource.id, resource]));
  const changes: ProposedResourceChange[] = [];

  for (const prior of snapshot.resourceStates) {
    const existing = byId.get(prior.id);
    if (!existing) continue;
    const delta = prior.priorCurrent - existing.current;
    if (delta === 0) continue;
    changes.push({
      resourceId: existing.id,
      resourceName: existing.name,
      delta,
    });
  }

  return changes;
}
