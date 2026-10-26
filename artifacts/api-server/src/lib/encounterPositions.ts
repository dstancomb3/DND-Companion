/** Authoritative encounter-space points, in feet. These are not geographic coordinates. */
export interface EncounterPosition {
  battleId: string;
  combatantId: string;
  xFeet: number;
  yFeet: number;
  source: "dm_confirmed" | "grid_authority";
}
export function normalizeEncounterPositions(input: unknown): EncounterPosition[] {
  if (!Array.isArray(input)) return [];
  const result: EncounterPosition[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    if (typeof p.battleId !== "string" || !p.battleId.trim() || p.battleId.length > 128 ||
      typeof p.combatantId !== "string" || !p.combatantId.trim() || p.combatantId.length > 128 ||
      typeof p.xFeet !== "number" || !Number.isFinite(p.xFeet) || Math.abs(p.xFeet) > 10000 ||
      typeof p.yFeet !== "number" || !Number.isFinite(p.yFeet) || Math.abs(p.yFeet) > 10000 ||
      (p.source !== "dm_confirmed" && p.source !== "grid_authority")) continue;
    const key = JSON.stringify([p.battleId, p.combatantId]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ battleId: p.battleId, combatantId: p.combatantId,
      xFeet: p.xFeet, yFeet: p.yFeet, source: p.source });
    if (result.length >= 500) break;
  }
  return result;
}
export function distanceBetweenPositions(a: EncounterPosition, b: EncounterPosition): number | null {
  if (a.battleId !== b.battleId) return null;
  return Math.hypot(a.xFeet - b.xFeet, a.yFeet - b.yFeet);
}
