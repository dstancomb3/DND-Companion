// Counts are remaining uses. Zero must survive serialization and reload.
export function readSnapshotEffectUsage(value: unknown, field: string): Record<string, number> {
  if (value === undefined) return {}; // Legacy saves did not capture this state.
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${field}: expected a map of remaining uses.`);
  }
  const entries = Object.entries(value);
  for (const [id, remaining] of entries) {
    if (!id || typeof remaining !== "number" || !Number.isSafeInteger(remaining) || remaining < 0) {
      throw new Error(`Invalid ${field}: remaining uses must be nonnegative safe integers.`);
    }
  }
  return Object.fromEntries(entries) as Record<string, number>;
}
