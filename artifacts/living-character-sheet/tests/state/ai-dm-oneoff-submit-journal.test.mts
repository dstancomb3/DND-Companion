import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOneOffSubmitJournalEntry,
  trimOneOffSubmitJournal,
} from "../../utils/adventure/aiDmOneOffSubmitJournal.ts";
import {
  appendOneOffSubmitJournalEntry,
  clearOneOffSubmitJournalEntries,
  getOneOffSubmitJournalEntries,
  getOneOffSubmitJournalPreferences,
  setOneOffSubmitJournalPreferences,
} from "../../utils/adventure/aiDmOneOffSubmitJournalStorage.ts";

function installWindowStorage(seed: Record<string, string> = {}) {
  const originalWindow = (globalThis as Record<string, unknown>).window;
  const store = new Map<string, string>(Object.entries(seed));
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };

  (globalThis as Record<string, unknown>).window = { localStorage };

  return {
    store,
    restore: () => {
      (globalThis as Record<string, unknown>).window = originalWindow;
    },
  };
}

test("buildOneOffSubmitJournalEntry includes trace id when provided", () => {
  const entry = buildOneOffSubmitJournalEntry({
    sessionId: "oneoff-1",
    outcome: "submitted",
    message: "Submitted",
    ingestTraceId: "ingest_abc123",
    now: 123,
  });

  assert.equal(entry.sessionId, "oneoff-1");
  assert.equal(entry.outcome, "submitted");
  assert.equal(entry.message, "Submitted");
  assert.equal(entry.ingestTraceId, "ingest_abc123");
  assert.equal(entry.at, 123);
});

test("trimOneOffSubmitJournal returns latest entries capped to max", () => {
  const entries = [
    buildOneOffSubmitJournalEntry({ sessionId: "a", outcome: "failed", message: "m1", now: 100 }),
    buildOneOffSubmitJournalEntry({ sessionId: "b", outcome: "replay", message: "m2", now: 300 }),
    buildOneOffSubmitJournalEntry({ sessionId: "c", outcome: "submitted", message: "m3", now: 200 }),
  ];

  const trimmed = trimOneOffSubmitJournal(entries, 2);
  assert.equal(trimmed.length, 2);
  assert.equal(trimmed[0]?.sessionId, "b");
  assert.equal(trimmed[1]?.sessionId, "c");
});

test("getOneOffSubmitJournalEntries returns empty list for malformed payload", async () => {
  const env = installWindowStorage({ "@ai_dm_oneoff_submit_journal_v1": "{not-json" });
  try {
    const entries = await getOneOffSubmitJournalEntries();
    assert.deepEqual(entries, []);
  } finally {
    env.restore();
  }
});

test("appendOneOffSubmitJournalEntry keeps latest-first order and max 80 entries", async () => {
  const existing = Array.from({ length: 80 }).map((_, idx) =>
    buildOneOffSubmitJournalEntry({
      sessionId: `s${idx}`,
      outcome: "submitted",
      message: `m${idx}`,
      now: idx + 1,
    }),
  );

  const env = installWindowStorage({
    "@ai_dm_oneoff_submit_journal_v1": JSON.stringify(existing),
  });

  try {
    const newest = buildOneOffSubmitJournalEntry({
      sessionId: "newest",
      outcome: "replay",
      message: "new message",
      now: 999,
    });

    await appendOneOffSubmitJournalEntry(newest);
    const persistedRaw = env.store.get("@ai_dm_oneoff_submit_journal_v1") ?? "[]";
    const persisted = JSON.parse(persistedRaw) as Array<{ sessionId: string; at: number }>;
    assert.equal(persisted.length, 80);
    assert.equal(persisted[0]?.sessionId, "newest");
    assert.equal(persisted[0]?.at, 999);
  } finally {
    env.restore();
  }
});

test("clearOneOffSubmitJournalEntries removes persisted submit journal entries", async () => {
  const seeded = [
    buildOneOffSubmitJournalEntry({
      sessionId: "clear-1",
      outcome: "submitted",
      message: "m1",
      now: 10,
    }),
  ];

  const env = installWindowStorage({
    "@ai_dm_oneoff_submit_journal_v1": JSON.stringify(seeded),
  });

  try {
    await clearOneOffSubmitJournalEntries();
    const persistedRaw = env.store.get("@ai_dm_oneoff_submit_journal_v1");
    assert.equal(persistedRaw, undefined);
    const entries = await getOneOffSubmitJournalEntries();
    assert.deepEqual(entries, []);
  } finally {
    env.restore();
  }
});

test("submit journal preferences roundtrip and malformed fallback", async () => {
  const env = installWindowStorage({
    "@ai_dm_oneoff_submit_journal_prefs_v1": "{bad-json",
  });

  try {
    const defaultsFromMalformed = await getOneOffSubmitJournalPreferences();
    assert.deepEqual(defaultsFromMalformed, {
      outcomeFilter: "all",
      showTraceIds: false,
    });

    await setOneOffSubmitJournalPreferences({
      outcomeFilter: "failures",
      showTraceIds: true,
    });
    const reloaded = await getOneOffSubmitJournalPreferences();
    assert.deepEqual(reloaded, {
      outcomeFilter: "failures",
      showTraceIds: true,
    });
  } finally {
    env.restore();
  }
});

test("submit journal preferences falls back per-field for malformed object payload", async () => {
  const env = installWindowStorage({
    "@ai_dm_oneoff_submit_journal_prefs_v1": JSON.stringify({
      outcomeFilter: "not-a-filter",
      showTraceIds: "yes",
    }),
  });

  try {
    const prefs = await getOneOffSubmitJournalPreferences();
    assert.deepEqual(prefs, {
      outcomeFilter: "all",
      showTraceIds: false,
    });
  } finally {
    env.restore();
  }
});
