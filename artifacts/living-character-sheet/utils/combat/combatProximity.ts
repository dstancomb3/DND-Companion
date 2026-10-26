/** Relative distances are informational until backed by authoritative
 * encounter movement and geometry; never infer them from narrative text. */
export interface CombatantDistanceObservation {
  viewerId: string;
  targetId: string;
  distanceFeet: number;
  source: "dm_confirmed" | "grid_authority";
  battleId: string;
}
export interface EncounterPosition {
  battleId: string;
  combatantId: string;
  xFeet: number;
  yFeet: number;
  source: "dm_confirmed" | "grid_authority";
}
export function measuredDistanceBetween(
  positions: EncounterPosition[], battleId: string | null | undefined,
  viewerId: string | null | undefined, targetId: string,
): number | null {
  const a = positions.find(p => p.battleId === battleId && p.combatantId === viewerId);
  const b = positions.find(p => p.battleId === battleId && p.combatantId === targetId);
  if (!a || !b || ![a.xFeet, a.yFeet, b.xFeet, b.yFeet].every(Number.isFinite)) return null;
  return Math.hypot(a.xFeet - b.xFeet, a.yFeet - b.yFeet);
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
  positions?: EncounterPosition[];
}): ProximityRow[] {
  const rows = input.targets.filter(t => t.id !== input.viewerId).map(target => {
    const observation = input.observations?.find(o =>
      o.viewerId === input.viewerId && o.targetId === target.id &&
      o.battleId === input.battleId && Number.isFinite(o.distanceFeet) &&
      o.distanceFeet >= 0 && o.distanceFeet <= 10000 &&
      (o.source === "dm_confirmed" || o.source === "grid_authority"));
    const coordinateDistance = measuredDistanceBetween(input.positions ?? [], input.battleId, input.viewerId, target.id);
    const distance = coordinateDistance ?? observation?.distanceFeet ?? null;
    return {
      ...target,
      distanceFeet: distance,
      distanceLabel: distance === null ? "Distance unknown" : `${Math.round(distance * 10) / 10} ft`,
      distanceKnown: distance !== null,
      ...(coordinateDistance !== null ? { distanceSource: "grid_authority" as const } : observation ? { distanceSource: observation.source } : {}),
    };
  });
  return rows.sort((a,b) => {
    if (a.distanceKnown !== b.distanceKnown) return a.distanceKnown ? -1 : 1;
    if (a.distanceKnown && b.distanceKnown && a.distanceFeet !== b.distanceFeet)
      return a.distanceFeet! - b.distanceFeet!;
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
