export type AiDmOneOffSubmitOutcome =
  | "submitted"
  | "replay"
  | "conflict_in_progress"
  | "conflict_payload_mismatch"
  | "invalid_payload"
  | "failed";

export interface AiDmOneOffSubmitJournalEntry {
  sessionId: string;
  at: number;
  outcome: AiDmOneOffSubmitOutcome;
  message: string;
  ingestTraceId?: string;
}

export function buildOneOffSubmitJournalEntry(input: {
  sessionId: string;
  outcome: AiDmOneOffSubmitOutcome;
  message: string;
  ingestTraceId?: string;
  now?: number;
}): AiDmOneOffSubmitJournalEntry {
  return {
    sessionId: input.sessionId,
    at: input.now ?? Date.now(),
    outcome: input.outcome,
    message: input.message,
    ingestTraceId: input.ingestTraceId,
  };
}

export function trimOneOffSubmitJournal(
  entries: AiDmOneOffSubmitJournalEntry[],
  maxItems = 80,
): AiDmOneOffSubmitJournalEntry[] {
  return entries
    .slice()
    .sort((a, b) => b.at - a.at)
    .slice(0, maxItems);
}
