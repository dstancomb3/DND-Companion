/** Informational range assessment; never substitutes for attack resolution. */
export type TargetRangeStatus = "normal" | "long_disadvantage" | "out_of_range" | "unknown";
export function assessTargetRange(range: string | null | undefined, distanceFeet: number | null): TargetRangeStatus {
  if (distanceFeet === null || !Number.isFinite(distanceFeet) || distanceFeet < 0 || !range) return "unknown";
  const r = range.trim().toLowerCase();
  const melee = /^(?:melee|reach)(?:\s*\(?\s*(\d+)\s*(?:ft|feet)\s*\)?)?$/.exec(r);
  if (melee) return distanceFeet <= Number(melee[1] ?? 5) ? "normal" : "out_of_range";
  const ranged = /^(\d+)\s*(?:\/\s*(\d+))?\s*(?:ft\.?|feet)?$/.exec(r);
  if (!ranged) return "unknown";
  const normal = Number(ranged[1]), maximum = Number(ranged[2] ?? ranged[1]);
  if (normal <= 0 || maximum < normal || !Number.isFinite(maximum)) return "unknown";
  if (distanceFeet <= normal) return "normal";
  return distanceFeet <= maximum && ranged[2] ? "long_disadvantage" : "out_of_range";
}
export const rangeStatusLabel: Record<TargetRangeStatus, string> = {
  normal: "Within normal range", long_disadvantage: "Long range · disadvantage",
  out_of_range: "Outside weapon range", unknown: "Range unconfirmed",
};
