import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActiveAdventureSessionRecord,
  buildAdventureAwarenessPlaceholder,
  buildAdventureAwarenessReturnPath,
  parseActiveAdventureSessionRecord,
} from "../../context/AdventureSessionContext.tsx";

test("buildAdventureAwarenessReturnPath includes canonical session path and encoded route params", () => {
  const path = buildAdventureAwarenessReturnPath({
    sessionId: "campaign-abc",
    mode: "campaign_scaffold",
    title: "Shattered Crown",
    difficulty: "balanced",
    stylePreset: "heroic",
    startInCombat: false,
    guidanceText: "Keep continuity",
    campaignId: "campaign-abc",
    campaignLabel: "Shattered Crown",
    chapterLabel: "Chapter 2",
  });

  assert.match(path, /^\/adventure\/session\/campaign-abc\?/);
  assert.match(path, /source=session-awareness/);
  assert.match(path, /mode=campaign_scaffold/);
  assert.match(path, /title=Shattered%20Crown/);
  assert.match(path, /campaignId=campaign-abc/);
  assert.match(path, /chapterLabel=Chapter%202/);
});

test("buildAdventureAwarenessPlaceholder returns null for missing active session", () => {
  const placeholder = buildAdventureAwarenessPlaceholder(null);
  assert.equal(placeholder, null);
});

test("buildAdventureAwarenessPlaceholder builds active strip contract", () => {
  const placeholder = buildAdventureAwarenessPlaceholder({
    sessionId: "campaign-xyz",
    sessionLabel: "Shattered Crown",
    returnToSessionPath: "/adventure/session/campaign-xyz?mode=campaign_scaffold",
    updatedAtMs: Date.now(),
  });

  assert.ok(placeholder);
  assert.equal(placeholder?.isAiDmActive, true);
  assert.equal(placeholder?.sessionId, "campaign-xyz");
  assert.equal(placeholder?.sessionLabel, "Shattered Crown");
  assert.equal(placeholder?.showContextStrip, true);
  assert.equal(
    placeholder?.returnToSessionPath,
    "/adventure/session/campaign-xyz?mode=campaign_scaffold",
  );
});

test("parseActiveAdventureSessionRecord returns null for empty or invalid payloads", () => {
  assert.equal(parseActiveAdventureSessionRecord(null), null);
  assert.equal(parseActiveAdventureSessionRecord(""), null);
  assert.equal(parseActiveAdventureSessionRecord("{not-json}"), null);
  assert.equal(parseActiveAdventureSessionRecord(JSON.stringify({ foo: "bar" })), null);
});

test("parseActiveAdventureSessionRecord accepts valid persisted payload", () => {
  const updatedAtMs = 1746700000123;
  const parsed = parseActiveAdventureSessionRecord(
    JSON.stringify({
      sessionId: "campaign-parse-ok",
      sessionLabel: "Parsed Label",
      returnToSessionPath: "/adventure/session/campaign-parse-ok?mode=campaign_scaffold",
      updatedAtMs,
    }),
  );

  assert.deepEqual(parsed, {
    sessionId: "campaign-parse-ok",
    sessionLabel: "Parsed Label",
    returnToSessionPath: "/adventure/session/campaign-parse-ok?mode=campaign_scaffold",
    updatedAtMs,
  });
});

test("buildActiveAdventureSessionRecord prefers campaign label and keeps canonical return path", () => {
  const updatedAtMs = 1746700000222;
  const built = buildActiveAdventureSessionRecord(
    {
      sessionId: "campaign-build-ok",
      mode: "campaign_scaffold",
      title: "Fallback Title",
      difficulty: "balanced",
      stylePreset: "heroic",
      startInCombat: false,
      campaignId: "campaign-build-ok",
      campaignLabel: "Campaign Label Preferred",
      chapterLabel: "Chapter 3",
    },
    updatedAtMs,
  );

  assert.equal(built.sessionId, "campaign-build-ok");
  assert.equal(built.sessionLabel, "Campaign Label Preferred");
  assert.equal(built.updatedAtMs, updatedAtMs);
  assert.match(built.returnToSessionPath, /^\/adventure\/session\/campaign-build-ok\?/);
  assert.match(built.returnToSessionPath, /source=session-awareness/);
});
