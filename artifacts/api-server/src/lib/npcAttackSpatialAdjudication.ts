/** Host DM attestation is not automated spatial proof.
 * AI clients must not invent these fields. Future map authority can replace it. */
export interface NpcAttackSpatialAdjudication {
  source: "host_dm";
  distanceFeet: number;
  clearLineOfSight: true;
}
export function validateNpcAttackSpatialAdjudication(
  range: unknown,
  input: unknown,
): { ok: true; distanceFeet: number } | { ok: false; reason: string } {
  if (typeof range !== "string" || !range.trim()) return { ok: false, reason: "missing_weapon_range" };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, reason: "spatial_adjudication_required" };
  const a = input as Partial<NpcAttackSpatialAdjudication>;
  if (a.source !== "host_dm" || a.clearLineOfSight !== true ||
      typeof a.distanceFeet !== "number" || !Number.isFinite(a.distanceFeet) ||
      a.distanceFeet < 0 || a.distanceFeet > 10000) return { ok: false, reason: "invalid_spatial_adjudication" };
  const normalized = range.trim().toLowerCase();
  const melee = /^(?:melee|reach)(?:\\s*\\(?\\s*(\\d+)\\s*(?:ft|feet)\\s*\\)?)?$/i.exec(normalized);
  const ranged = /^(\\d+)\\s*(?:\\/\\s*(\\d+))?\\s*(?:ft|feet|ft\\.)?$/i.exec(normalized);
  const maxFeet = melee ? (melee[1] ? Number(melee[1]) : 5) : ranged ? Number(ranged[2] ?? ranged[1]) : NaN;
  if (!Number.isFinite(maxFeet) || maxFeet <= 0) return { ok: false, reason: "unsupported_range_notation" };
  if (a.distanceFeet > maxFeet) return { ok: false, reason: "target_out_of_range" };
  return { ok: true, distanceFeet: a.distanceFeet };
}
