import assert from "node:assert/strict";
import test from "node:test";
import { shouldAutoCreateOneOffParty } from "./oneOffPartyRecovery";

test("saved one-off conversations never silently create replacement parties", () => {
  for (const hasActivePartySession of [false, true]) {
    for (const launchedAsNewOneOff of [false, true]) {
      assert.equal(shouldAutoCreateOneOffParty({
        hasSavedConversation: true, hasActivePartySession, launchedAsNewOneOff,
      }), false);
    }
  }
});

test("fresh one-offs can bootstrap but an existing party is reused", () => {
  assert.equal(shouldAutoCreateOneOffParty({
    hasSavedConversation: false, hasActivePartySession: false, launchedAsNewOneOff: false,
  }), true);
  assert.equal(shouldAutoCreateOneOffParty({
    hasSavedConversation: false, hasActivePartySession: true, launchedAsNewOneOff: false,
  }), false);
  assert.equal(shouldAutoCreateOneOffParty({
    hasSavedConversation: false, hasActivePartySession: true, launchedAsNewOneOff: true,
  }), true);
});
