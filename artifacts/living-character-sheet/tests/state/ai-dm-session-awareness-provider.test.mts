import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  AdventureSessionProvider,
  useAdventureSessionAwareness,
  type AdventureSessionStorage,
  type AdventureSessionContextValue,
} from "../../context/AdventureSessionContext.tsx";

const STORAGE_KEY = "@ai_dm_active_adventure_session_v1";

const memoryStore = new Map<string, string>();

let latestContext: AdventureSessionContextValue | null = null;

function Probe() {
  latestContext = useAdventureSessionAwareness();
  return null;
}

function flushEffects() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

const storage: AdventureSessionStorage = {
  getItem: async (key: string) => (memoryStore.has(key) ? memoryStore.get(key)! : null),
  setItem: async (key: string, value: string) => {
    memoryStore.set(key, value);
  },
  removeItem: async (key: string) => {
    memoryStore.delete(key);
  },
};

async function mountProvider() {
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        AdventureSessionProvider,
        { storage },
        React.createElement(Probe),
      ),
    );
  });
  await act(async () => {
    await flushEffects();
    await flushEffects();
  });
  return renderer!;
}

test.beforeEach(() => {
  latestContext = null;
  memoryStore.clear();
});

test("AdventureSessionProvider hydrates empty storage as null active session", async () => {
  const renderer = await mountProvider();

  assert.ok(latestContext);
  assert.equal(latestContext?.isHydrated, true);
  assert.equal(latestContext?.activeSession, null);
  assert.equal(latestContext?.awarenessPlaceholder, null);

  renderer.unmount();
});

test("AdventureSessionProvider hydrates a valid persisted active session record", async () => {
  memoryStore.set(
    STORAGE_KEY,
    JSON.stringify({
      sessionId: "campaign-hydrated",
      sessionLabel: "Hydrated Session",
      returnToSessionPath: "/adventure/session/campaign-hydrated?mode=campaign_scaffold",
      updatedAtMs: 1746700000999,
    }),
  );

  const renderer = await mountProvider();

  assert.ok(latestContext);
  assert.equal(latestContext?.isHydrated, true);
  assert.equal(latestContext?.activeSession?.sessionId, "campaign-hydrated");
  assert.equal(latestContext?.activeSession?.sessionLabel, "Hydrated Session");
  assert.match(latestContext?.activeSession?.returnToSessionPath ?? "", /^\/adventure\/session\/campaign-hydrated\?/);
  assert.equal(latestContext?.awarenessPlaceholder?.isAiDmActive, true);

  renderer.unmount();
});

test("AdventureSessionProvider setActiveSession updates context and persists record", async () => {
  const renderer = await mountProvider();

  assert.ok(latestContext);
  await act(async () => {
    await latestContext?.setActiveSession({
      sessionId: "campaign-set",
      mode: "campaign_scaffold",
      title: "Set Session",
      difficulty: "balanced",
      stylePreset: "heroic",
      startInCombat: false,
      campaignId: "campaign-set",
      campaignLabel: "Set Session Label",
      chapterLabel: "Chapter 4",
    });
  });

  assert.equal(latestContext?.activeSession?.sessionId, "campaign-set");
  assert.equal(latestContext?.activeSession?.sessionLabel, "Set Session Label");
  assert.match(latestContext?.activeSession?.returnToSessionPath ?? "", /source=session-awareness/);
  assert.match(latestContext?.activeSession?.returnToSessionPath ?? "", /chapterLabel=Chapter%204/);
  assert.ok(memoryStore.has(STORAGE_KEY));

  renderer.unmount();
});

test("AdventureSessionProvider clearActiveSession clears context and persisted record", async () => {
  const renderer = await mountProvider();

  assert.ok(latestContext);
  await act(async () => {
    await latestContext?.setActiveSession({
      sessionId: "campaign-clear",
      mode: "campaign_scaffold",
      title: "Clear Session",
      difficulty: "balanced",
      stylePreset: "heroic",
      startInCombat: false,
      campaignId: "campaign-clear",
      campaignLabel: "Clear Session Label",
      chapterLabel: "Chapter 5",
    });
  });

  assert.equal(latestContext?.activeSession?.sessionId, "campaign-clear");
  assert.ok(memoryStore.has(STORAGE_KEY));

  await act(async () => {
    await latestContext?.clearActiveSession();
  });

  assert.equal(latestContext?.activeSession, null);
  assert.equal(latestContext?.awarenessPlaceholder, null);
  assert.equal(memoryStore.has(STORAGE_KEY), false);

  renderer.unmount();
});
