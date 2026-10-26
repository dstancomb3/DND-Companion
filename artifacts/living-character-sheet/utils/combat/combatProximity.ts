/** Relative distances are informational until backed by authoritative
 * encounter movement and geometry; never infer them from narrative text. */
export interface CombatantDistanceObservation {
  viewerId: string;
  targetId: string;
  distanceFeet: number;
  source: "dm_confirmed" | "grid_authority";
  battleId: string;
}
export interface ProximityTarget {
  id: string;
  name: string;
  type: "npc" | "member";
}
export interface ProximityRow extends ProximityTarget {
  distanceFeet: number | null;
  distanceLabel: string;
  distanceKnown: boolean;
  distanceSource?: CombatantDistanceObservation["source"];
}
export function buildCombatProximityRows(input: {
  viewerId: string | null | undefined;
  battleId: string | null | undefined;
  targets: ProximityTarget[];
  observations?: CombatantDistanceObservation[];
}): ProximityRow[] {
  const rows = input.targets.filter(t => t.id !== input.viewerId).map(target => {
    const observation = input.observations?.find(o =>
      o.viewerId === input.viewerId && o.targetId === target.id &&
      o.battleId === input.battleId && Number.isFinite(o.distanceFeet) &&
      o.distanceFeet >= 0 && o.distanceFeet <= 10000 &&
      (o.source === "dm_confirmed" || o.source === "grid_authority"));
    return {
      ...target,
      distanceFeet: observation?.distanceFeet ?? null,
      distanceLabel: observation ? `${observation.distanceFeet} ft` : "Distance unknown",
      distanceKnown: Boolean(observation),
      ...(observation ? { distanceSource: observation.source } : {}),
    };
  });
  return rows.sort((a,b) => {
    if (a.distanceKnown !== b.distanceKnown) return a.distanceKnown ? -1 : 1;
    if (a.distanceKnown && b.distanceKnown && a.distanceFeet !== b.distanceFeet)
      return a.distanceFeet! - b.distanceFeet!;
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
