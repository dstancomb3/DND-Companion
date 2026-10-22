import type { MutationBatch } from "@/types";

export interface UndoUnavailable {
  status: "unavailable";
  reason: string;
}

// Existing records lack complete after-state, revisions and dependent effects.
// Never infer reversibility from display deltas or a caller-supplied flag.
export function getLocalUndoAvailability(batch?: MutationBatch): UndoUnavailable {
  if (!batch) return { status: "unavailable", reason: "No recorded change was found." };
  if (!batch.applied) return { status: "unavailable", reason: "This change was not applied." };
  if (batch.undone) return { status: "unavailable", reason: "This change was already marked undone." };
  return {
    status: "unavailable",
    reason: "Undo unavailable: this record lacks verified before/after state and cannot safely reverse later changes. Correct the affected values manually.",
  };
}
