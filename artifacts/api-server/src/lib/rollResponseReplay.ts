export type SubmittedRoll = { roll: number; modifier: number; total: number };

export function classifyRepeatedRoll(
  existing: SubmittedRoll | undefined,
  submitted: SubmittedRoll,
): "new" | "replay" | "conflict" {
  if (!existing) return "new";
  return existing.roll === submitted.roll &&
    existing.modifier === submitted.modifier &&
    existing.total === submitted.total ? "replay" : "conflict";
}
