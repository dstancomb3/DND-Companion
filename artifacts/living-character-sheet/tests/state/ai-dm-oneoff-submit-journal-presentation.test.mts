import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSubmitJournalEmptyActionStatus,
  buildSubmitJournalExportPayload,
  deriveHasDiagnosticsContext,
  filterSubmitJournalEntries,
  formatSubmitJournalEntryLine,
  formatSubmitJournalRefreshedAt,
  shouldShowSubmitJournalFilterHiddenNotice,
} from "../../utils/adventure/aiDmOneOffSubmitJournalPresentation.ts";

test("formatSubmitJournalRefreshedAt returns fallback when timestamp is absent", () => {
  assert.equal(formatSubmitJournalRefreshedAt(null), "Not refreshed yet.");
});

test("formatSubmitJournalRefreshedAt uses injected formatter for stable output", () => {
  const value = formatSubmitJournalRefreshedAt(1234, (at) => `T${at}`);
  assert.equal(value, "Last refreshed T1234.");
});

test("formatSubmitJournalEntryLine uses injected formatter and stable field order", () => {
  const line = formatSubmitJournalEntryLine(
    {
      sessionId: "oneoff-abc",
      at: 999,
      outcome: "submitted",
      message: "Submitted",
    },
    (at) => `T${at}`,
  );

  assert.equal(line, "T999 - oneoff-abc - submitted: Submitted");
});

test("filterSubmitJournalEntries returns matching outcomes for each bounded filter", () => {
  const entries = [
    { sessionId: "s1", at: 1, outcome: "submitted", message: "ok" },
    { sessionId: "s2", at: 2, outcome: "replay", message: "ok" },
    { sessionId: "s3", at: 3, outcome: "conflict_in_progress", message: "blocked" },
    { sessionId: "s4", at: 4, outcome: "failed", message: "failed" },
  ] as const;

  assert.equal(filterSubmitJournalEntries(entries as any, "all").length, 4);
  assert.deepEqual(
    filterSubmitJournalEntries(entries as any, "submitted").map((entry) => entry.sessionId),
    ["s1"],
  );
  assert.deepEqual(
    filterSubmitJournalEntries(entries as any, "replay").map((entry) => entry.sessionId),
    ["s2"],
  );
  assert.deepEqual(
    filterSubmitJournalEntries(entries as any, "failures").map((entry) => entry.sessionId),
    ["s3", "s4"],
  );
});

test("shouldShowSubmitJournalFilterHiddenNotice only returns true when filter hides existing entries", () => {
  assert.equal(shouldShowSubmitJournalFilterHiddenNotice(0, 0), false);
  assert.equal(shouldShowSubmitJournalFilterHiddenNotice(2, 1), false);
  assert.equal(shouldShowSubmitJournalFilterHiddenNotice(2, 0), true);
});

test("buildSubmitJournalExportPayload shapes compact diagnostics block with optional trace ids", () => {
  const payload = buildSubmitJournalExportPayload({
    visibleEntries: [
      {
        sessionId: "oneoff-a",
        at: 100,
        outcome: "submitted",
        message: "Submitted",
        ingestTraceId: "ingest_1",
      },
    ],
    totalEntries: 3,
    filter: "submitted",
    refreshedAt: 90,
    includeTraceIds: true,
    formatTime: (at) => `T${at}`,
  });

  assert.match(payload, /One-Off Submit Journal Export/);
  assert.match(payload, /Filter: submitted/);
  assert.match(payload, /Entries: 1 of 3/);
  assert.match(payload, /Last refreshed T90\./);
  assert.match(payload, /- T100 - oneoff-a - submitted: Submitted \[trace ingest_1\]/);
});

test("buildSubmitJournalEmptyActionStatus distinguishes empty-all vs hidden-by-filter states", () => {
  assert.equal(
    buildSubmitJournalEmptyActionStatus({
      action: "copy",
      visibleCount: 0,
      totalCount: 0,
      filter: "all",
    }),
    "No submit journal entries to copy.",
  );

  assert.equal(
    buildSubmitJournalEmptyActionStatus({
      action: "export",
      visibleCount: 0,
      totalCount: 2,
      filter: "failures",
    }),
    "No visible submit journal entries for current filter to export.",
  );

  assert.equal(
    buildSubmitJournalEmptyActionStatus({
      action: "copy",
      visibleCount: 1,
      totalCount: 2,
      filter: "all",
    }),
    null,
  );
});

test("deriveHasDiagnosticsContext handles positive and malformed counts safely", () => {
  assert.equal(deriveHasDiagnosticsContext({ sessionCount: 0, journalCount: 0 }), false);
  assert.equal(deriveHasDiagnosticsContext({ sessionCount: 1, journalCount: 0 }), true);
  assert.equal(deriveHasDiagnosticsContext({ sessionCount: 0, journalCount: 2 }), true);
  assert.equal(deriveHasDiagnosticsContext({ sessionCount: -1, journalCount: -3 }), false);
  assert.equal(deriveHasDiagnosticsContext({ sessionCount: Number.NaN, journalCount: Number.NaN }), false);
});