import type { AiDmOneOffSubmitJournalEntry } from "@/utils/adventure/aiDmOneOffSubmitJournal";

export type SubmitJournalOutcomeFilter = "all" | "submitted" | "replay" | "failures";

export function formatSubmitJournalTime(at: number): string {
  return new Date(at).toLocaleTimeString();
}

export function formatSubmitJournalRefreshedAt(
  refreshedAt: number | null,
  formatTime: (value: number) => string = formatSubmitJournalTime,
): string {
  if (!refreshedAt) return "Not refreshed yet.";
  return `Last refreshed ${formatTime(refreshedAt)}.`;
}

export function formatSubmitJournalEntryLine(
  entry: AiDmOneOffSubmitJournalEntry,
  formatTime: (value: number) => string = formatSubmitJournalTime,
): string {
  return `${formatTime(entry.at)} - ${entry.sessionId} - ${entry.outcome}: ${entry.message}`;
}

export function filterSubmitJournalEntries(
  entries: AiDmOneOffSubmitJournalEntry[],
  filter: SubmitJournalOutcomeFilter,
): AiDmOneOffSubmitJournalEntry[] {
  if (filter === "all") return entries;
  if (filter === "submitted") {
    return entries.filter((entry) => entry.outcome === "submitted");
  }
  if (filter === "replay") {
    return entries.filter((entry) => entry.outcome === "replay");
  }
  return entries.filter(
    (entry) =>
      entry.outcome === "conflict_in_progress" ||
      entry.outcome === "conflict_payload_mismatch" ||
      entry.outcome === "invalid_payload" ||
      entry.outcome === "failed",
  );
}

export function shouldShowSubmitJournalFilterHiddenNotice(totalCount: number, visibleCount: number): boolean {
  return totalCount > 0 && visibleCount === 0;
}

export function buildSubmitJournalExportPayload(input: {
  visibleEntries: AiDmOneOffSubmitJournalEntry[];
  totalEntries: number;
  filter: SubmitJournalOutcomeFilter;
  refreshedAt: number | null;
  includeTraceIds: boolean;
  formatTime?: (value: number) => string;
}): string {
  const formatTime = input.formatTime ?? formatSubmitJournalTime;
  const lines: string[] = [
    "One-Off Submit Journal Export",
    `Filter: ${input.filter}`,
    `Entries: ${input.visibleEntries.length} of ${input.totalEntries}`,
    formatSubmitJournalRefreshedAt(input.refreshedAt, formatTime),
    `Generated at ${formatTime(Date.now())}`,
    "",
  ];

  if (input.visibleEntries.length === 0) {
    lines.push("No visible submit journal entries for the current filter.");
    return lines.join("\n");
  }

  for (const entry of input.visibleEntries) {
    const trace = input.includeTraceIds && entry.ingestTraceId ? ` [trace ${entry.ingestTraceId}]` : "";
    lines.push(`- ${formatSubmitJournalEntryLine(entry, formatTime)}${trace}`);
  }

  return lines.join("\n");
}

export function buildSubmitJournalEmptyActionStatus(input: {
  action: "copy" | "export";
  visibleCount: number;
  totalCount: number;
  filter: SubmitJournalOutcomeFilter;
}): string | null {
  if (input.visibleCount > 0) return null;
  if (input.totalCount > 0 && input.filter !== "all") {
    return `No visible submit journal entries for current filter to ${input.action}.`;
  }
  return `No submit journal entries to ${input.action}.`;
}

export function deriveHasDiagnosticsContext(input: {
  sessionCount: number;
  journalCount: number;
}): boolean {
  const safeSessionCount = Number.isFinite(input.sessionCount) ? Math.max(0, input.sessionCount) : 0;
  const safeJournalCount = Number.isFinite(input.journalCount) ? Math.max(0, input.journalCount) : 0;
  return safeSessionCount > 0 || safeJournalCount > 0;
}