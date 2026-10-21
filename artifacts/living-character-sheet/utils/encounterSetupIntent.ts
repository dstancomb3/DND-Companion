/**
 * encounterSetupIntent.ts
 *
 * Lightweight, transient carrier for encounter setup context when navigating
 * from DM Monsters selection to DM Party import flow.
 *
 * This is NOT persistent storage—it survives screen navigation briefly,
 * then clears on successful import, explicit cancel, or stale/invalid detection.
 */

import type { CombatNpcDisposition } from "./partyApi";

export interface EncounterSetupMonsterSelection {
  /**
   * Compendium or custom monster ID (e.g., "goblin" from compendium, or UUID for custom)
   */
  monsterId: string;

  /**
   * How many of this monster to add
   */
  quantity: number;

  /**
   * Hostile, passive, or neutral disposition
   */
  disposition: CombatNpcDisposition;

  /**
   * Optional custom name override (e.g., "Goblin Boss")
   */
  customName?: string;
}

export interface EncounterSetupHandoff {
  /**
   * List of monsters selected in DM Monsters screen with quantities/dispositions
   */
  selectedMonsters: EncounterSetupMonsterSelection[];

  /**
   * Which battle ID to add these to (if DM already has an active encounter selected)
   * If null, DM Party will ask the user to select or create a battle
   */
  targetBattleId: string | null;

  /**
   * Marker that this came from dm-monsters (for safety/clarity)
   */
  sourceScreen: "dm-monsters";

  /**
   * Timestamp when handoff was created; used to detect stale handoffs
   */
  createdAt: number;
}

/**
 * Global transient store for encounter setup handoff.
 * Stored in module scope (not React state, not persistence).
 * Cleared by explicit calls or automatic staleness detection.
 */
let currentHandoff: EncounterSetupHandoff | null = null;

/**
 * Store a new encounter setup handoff context.
 * Replaces any previous handoff.
 */
export function setEncounterSetupHandoff(
  selectedMonsters: EncounterSetupMonsterSelection[],
  targetBattleId: string | null
): void {
  currentHandoff = {
    selectedMonsters,
    targetBattleId,
    sourceScreen: "dm-monsters",
    createdAt: Date.now(),
  };
}

/**
 * Retrieve the current encounter setup handoff, if any.
 * Returns null if:
 * - No handoff has been set
 * - Handoff is stale (older than 2 minutes)
 */
export function getEncounterSetupHandoff(): EncounterSetupHandoff | null {
  if (!currentHandoff) return null;

  const ageMs = Date.now() - currentHandoff.createdAt;
  const twoMinutesMs = 2 * 60 * 1000;

  if (ageMs > twoMinutesMs) {
    // Handoff is stale; clear and return null
    currentHandoff = null;
    return null;
  }

  return currentHandoff;
}

/**
 * Clear the current encounter setup handoff.
 * Call this after:
 * - Successfully importing monsters to a battle
 * - Explicit user cancel/discard
 * - Detecting that target battle no longer exists
 */
export function clearEncounterSetupHandoff(): void {
  currentHandoff = null;
}

/**
 * Check if a handoff exists and is valid (not stale).
 */
export function hasValidEncounterSetupHandoff(): boolean {
  return getEncounterSetupHandoff() !== null;
}
