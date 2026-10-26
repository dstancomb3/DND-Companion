/** Confirmed player-facing relative distances (not hidden positions or LOS). */
export interface EncounterDistance {
  battleId: string;
  viewerId: string;
  targetId: string;
  distanceFeet: number;
  source: "dm_confirmed";
}
export function normalizeEncounterDistances(input: unknown): EncounterDistance[] {
  if (!Array.isArray(input)) return [];
  const rows: EncounterDistance[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>;
    const { battleId, viewerId, targetId, distanceFeet, source } = value;
    if (typeof battleId !== "string" || !battleId.trim() || battleId.length > 128 ||
        typeof viewerId !== "string" || !viewerId.trim() || viewerId.length > 128 ||
        typeof targetId !== "string" || !targetId.trim() || targetId.length > 128 ||
        viewerId === targetId || source !== "dm_confirmed" ||
        typeof distanceFeet !== "number" || !Number.isFinite(distanceFeet) ||
        distanceFeet < 0 || distanceFeet > 10000) continue;
    const key = JSON.stringify([battleId, viewerId, targetId]);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ battleId, viewerId, targetId, distanceFeet, source });
    if (rows.length >= 500) break;
  }
  return rows;
}
