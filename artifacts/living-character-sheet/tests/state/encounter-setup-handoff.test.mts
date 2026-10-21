/**
 * tests/state/encounter-setup-handoff.test.mts
 *
 * Tests for P2 Encounter Flow Unification handoff carrier.
 * Validates state continuity when navigating from DM Monsters to DM Party,
 * including monster selection preservation, battle targeting, and explicit clearing.
 */

import { describe, it, beforeEach } from "node:test";
import * as assert from "node:assert";
import {
  setEncounterSetupHandoff,
  getEncounterSetupHandoff,
  clearEncounterSetupHandoff,
  hasValidEncounterSetupHandoff,
  type EncounterSetupMonsterSelection,
  type EncounterSetupHandoff,
} from "@/utils/encounterSetupIntent";

describe("EncounterSetupHandoff", () => {
  beforeEach(() => {
    // Clear any existing handoff before each test
    clearEncounterSetupHandoff();
  });

  describe("setEncounterSetupHandoff", () => {
    it("should store a new handoff with monsters and target battle", () => {
      const monsters: EncounterSetupMonsterSelection[] = [
        {
          monsterId: "goblin",
          quantity: 2,
          disposition: "hostile",
        },
      ];

      setEncounterSetupHandoff(monsters, "battle-123");

      const handoff = getEncounterSetupHandoff();
      assert.ok(handoff, "Handoff should be defined");
      assert.deepStrictEqual(handoff.selectedMonsters, monsters);
      assert.strictEqual(handoff.targetBattleId, "battle-123");
      assert.strictEqual(handoff.sourceScreen, "dm-monsters");
    });

    it("should allow null targetBattleId for cases where user hasn't selected battle yet", () => {
      const monsters: EncounterSetupMonsterSelection[] = [
        {
          monsterId: "ogre",
          quantity: 1,
          disposition: "passive",
        },
      ];

      setEncounterSetupHandoff(monsters, null);

      const handoff = getEncounterSetupHandoff();
      assert.strictEqual(handoff?.targetBattleId, null);
      assert.deepStrictEqual(handoff?.selectedMonsters, monsters);
    });

    it("should handle multiple monsters with different quantities and dispositions", () => {
      const monsters: EncounterSetupMonsterSelection[] = [
        {
          monsterId: "goblin",
          quantity: 3,
          disposition: "hostile",
        },
        {
          monsterId: "dire-wolf",
          quantity: 2,
          disposition: "hostile",
        },
        {
          monsterId: "town-guard",
          quantity: 4,
          disposition: "friendly",
          customName: "Town Guard",
        },
      ];

      setEncounterSetupHandoff(monsters, "battle-456");

      const handoff = getEncounterSetupHandoff();
      assert.strictEqual(handoff?.selectedMonsters.length, 3);
      assert.strictEqual(handoff?.selectedMonsters[0].quantity, 3);
      assert.strictEqual(handoff?.selectedMonsters[2].customName, "Town Guard");
    });

    it("should replace previous handoff when called multiple times", () => {
      const first: EncounterSetupMonsterSelection[] = [
        { monsterId: "goblin", quantity: 1, disposition: "hostile" },
      ];
      const second: EncounterSetupMonsterSelection[] = [
        { monsterId: "dragon", quantity: 1, disposition: "hostile" },
      ];

      setEncounterSetupHandoff(first, "battle-1");
      let handoff = getEncounterSetupHandoff();
      assert.strictEqual(handoff?.selectedMonsters[0].monsterId, "goblin");

      setEncounterSetupHandoff(second, "battle-2");
      handoff = getEncounterSetupHandoff();
      assert.strictEqual(handoff?.selectedMonsters[0].monsterId, "dragon");
      assert.strictEqual(handoff?.targetBattleId, "battle-2");
    });
  });

  describe("getEncounterSetupHandoff", () => {
    it("should return null if no handoff has been set", () => {
      const handoff = getEncounterSetupHandoff();
      assert.strictEqual(handoff, null);
    });

    it("should return null if handoff is stale (older than 2 minutes)", () => {
      const monsters: EncounterSetupMonsterSelection[] = [
        { monsterId: "goblin", quantity: 1, disposition: "hostile" },
      ];

      setEncounterSetupHandoff(monsters, "battle-123");

      // Mock Date.now() to return time 2+ minutes in the future
      const originalNow = Date.now;
      (Date as any).now = () => originalNow() + 121 * 1000; // 121 seconds later

      try {
        const handoff = getEncounterSetupHandoff();
        assert.strictEqual(handoff, null);
      } finally {
        (Date as any).now = originalNow;
      }
    });

    it("should return handoff if it's less than 2 minutes old", () => {
      const monsters: EncounterSetupMonsterSelection[] = [
        { monsterId: "goblin", quantity: 1, disposition: "hostile" },
      ];

      setEncounterSetupHandoff(monsters, "battle-123");

      // Mock Date.now() to return time 1 minute in the future
      const originalNow = Date.now;
      (Date as any).now = () => originalNow() + 60 * 1000; // 60 seconds later

      try {
        const handoff = getEncounterSetupHandoff();
        assert.ok(handoff, "Handoff should be defined");
        assert.strictEqual(handoff?.selectedMonsters[0].monsterId, "goblin");
      } finally {
        (Date as any).now = originalNow;
      }
    });

    it("should clear stale handoff automatically when retrieved past 2 minutes", () => {
      const monsters: EncounterSetupMonsterSelection[] = [
        { monsterId: "goblin", quantity: 1, disposition: "hostile" },
      ];

      setEncounterSetupHandoff(monsters, "battle-123");
      assert.ok(getEncounterSetupHandoff(), "Handoff should exist initially");

      // Mock Date.now() to return time 2+ minutes in the future
      const originalNow = Date.now;
      (Date as any).now = () => originalNow() + 121 * 1000; // 121 seconds later

      try {
        const staleHandoff = getEncounterSetupHandoff();
        assert.strictEqual(staleHandoff, null);

        // Reset time and verify handoff is still cleared
        (Date as any).now = () => originalNow();
        const afterClear = getEncounterSetupHandoff();
        assert.strictEqual(afterClear, null);
      } finally {
        (Date as any).now = originalNow;
      }
    });
  });

  describe("clearEncounterSetupHandoff", () => {
    it("should clear the current handoff", () => {
      const monsters: EncounterSetupMonsterSelection[] = [
        { monsterId: "goblin", quantity: 1, disposition: "hostile" },
      ];

      setEncounterSetupHandoff(monsters, "battle-123");
      assert.ok(getEncounterSetupHandoff(), "Handoff should exist");

      clearEncounterSetupHandoff();
      assert.strictEqual(getEncounterSetupHandoff(), null);
    });

    it("should be idempotent (safe to call multiple times)", () => {
      const monsters: EncounterSetupMonsterSelection[] = [
        { monsterId: "goblin", quantity: 1, disposition: "hostile" },
      ];

      setEncounterSetupHandoff(monsters, "battle-123");
      clearEncounterSetupHandoff();
      clearEncounterSetupHandoff(); // Second call
      clearEncounterSetupHandoff(); // Third call

      assert.strictEqual(getEncounterSetupHandoff(), null);
    });
  });

  describe("hasValidEncounterSetupHandoff", () => {
    it("should return true when a valid, non-stale handoff exists", () => {
      const monsters: EncounterSetupMonsterSelection[] = [
        { monsterId: "goblin", quantity: 1, disposition: "hostile" },
      ];

      setEncounterSetupHandoff(monsters, "battle-123");
      assert.strictEqual(hasValidEncounterSetupHandoff(), true);
    });

    it("should return false when no handoff exists", () => {
      assert.strictEqual(hasValidEncounterSetupHandoff(), false);
    });

    it("should return false when handoff is stale", () => {
      const monsters: EncounterSetupMonsterSelection[] = [
        { monsterId: "goblin", quantity: 1, disposition: "hostile" },
      ];

      setEncounterSetupHandoff(monsters, "battle-123");

      const originalNow = Date.now;
      (Date as any).now = () => originalNow() + 121 * 1000;

      try {
        assert.strictEqual(hasValidEncounterSetupHandoff(), false);
      } finally {
        (Date as any).now = originalNow;
      }
    });
  });

  describe("Workflow: Monster Selection → Navigation → Import", () => {
    it("should preserve monster selections across screen navigation", () => {
      // Simulate dm-monsters screen creating handoff
      const selectedMonsters: EncounterSetupMonsterSelection[] = [
        { monsterId: "goblin", quantity: 2, disposition: "hostile" },
        { monsterId: "dire-wolf", quantity: 1, disposition: "hostile" },
      ];

      setEncounterSetupHandoff(selectedMonsters, "battle-alpha");

      // Simulate navigation to dm-party and retrieval
      const handoff = getEncounterSetupHandoff();
      assert.ok(handoff, "Handoff should exist");
      assert.deepStrictEqual(handoff?.selectedMonsters, selectedMonsters);
      assert.strictEqual(handoff?.targetBattleId, "battle-alpha");

      // Verify banner context is available
      assert.strictEqual(handoff?.sourceScreen, "dm-monsters");
      assert.ok(handoff?.createdAt, "Handoff should have createdAt timestamp");
    });

    it("should allow battle ID to be discovered vs pre-selected", () => {
      // Case 1: User knows which battle (pre-selected in handoff)
      const selectiveMonsters = [
        { monsterId: "orc", quantity: 3, disposition: "hostile" },
      ];
      setEncounterSetupHandoff(selectiveMonsters, "battle-known");

      let handoff = getEncounterSetupHandoff();
      assert.strictEqual(handoff?.targetBattleId, "battle-known");

      clearEncounterSetupHandoff();

      // Case 2: User discovers battle in dm-party (null in handoff)
      setEncounterSetupHandoff(selectiveMonsters, null);

      handoff = getEncounterSetupHandoff();
      assert.strictEqual(handoff?.targetBattleId, null);
      assert.deepStrictEqual(handoff?.selectedMonsters, selectiveMonsters);
    });

    it("should support explicit discard before import", () => {
      const monsters = [{ monsterId: "troll", quantity: 1, disposition: "hostile" }];
      setEncounterSetupHandoff(monsters, "battle-123");

      assert.strictEqual(hasValidEncounterSetupHandoff(), true);

      // User clicks "Discard"
      clearEncounterSetupHandoff();

      assert.strictEqual(hasValidEncounterSetupHandoff(), false);
      assert.strictEqual(getEncounterSetupHandoff(), null);
    });

    it("should support successful import clearing", () => {
      const monsters = [{ monsterId: "ogre", quantity: 1, disposition: "hostile" }];
      setEncounterSetupHandoff(monsters, "battle-456");

      assert.strictEqual(hasValidEncounterSetupHandoff(), true);

      // Simulate successful import in dm-party
      clearEncounterSetupHandoff();

      assert.strictEqual(hasValidEncounterSetupHandoff(), false);
    });
  });
});
