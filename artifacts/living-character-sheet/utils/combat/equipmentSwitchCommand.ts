import type { InventoryItem } from "../../types";
import {
  parseGameplayRulesProfile,
  previewEquipmentSwitch,
  type GameplayRulesProfile,
  type EquipCostKind,
} from "./gameplayProfile";

/**
 * Prepare an equipment-switch request without mutating state. In multiplayer,
 * server-authoritative economy spending and equipping must commit atomically.
 * Never call CharacterContext.updateItem from this preview.
 */
export interface EquipmentSwitchCommand {
  requestId: string;
  battleId: string;
  actorMemberId: string;
  itemId: string;
  /** Host-approved rules snapshot; no player-supplied override is accepted. */
  rulesProfile: GameplayRulesProfile;
  expectedEquipmentVersion: number;
  expectedTurnId: string;
}

export type EquipmentSwitchRejectedReason =
  | "invalid_request"
  | "invalid_profile"
  | "missing_weapon"
  | "already_equipped"
  | "not_your_turn"
  | "incapacitated"
  | "no_action_available"
  | "object_interaction_used";

export type EquipmentSwitchPreflight =
  | { ok: true; cost: EquipCostKind; command: EquipmentSwitchCommand }
  | { ok: false; reason: EquipmentSwitchRejectedReason };

/**
 * The actual executor must revalidate these predicates against canonical
 * server state, commit both economy and inventory once keyed by requestId,
 * then return a receipt. This read-only helper is NOT an executor.
 */
export function preflightEquipmentSwitch(
  proposed: EquipmentSwitchCommand,
  state: {
    inventory: InventoryItem[];
    currentTurnId: string | null;
    isActiveBattle: boolean;
    incapacitated: boolean;
    remainingActions: number;
    objectInteractionUsed: boolean;
    equipmentVersion: number;
  },
): EquipmentSwitchPreflight {
  if (!proposed || !proposed.requestId?.trim() || !proposed.itemId?.trim()
      || !proposed.battleId?.trim() || !proposed.actorMemberId?.trim()
      || !proposed.expectedTurnId?.trim()
      || !Number.isSafeInteger(proposed.expectedEquipmentVersion)
      || proposed.expectedEquipmentVersion < 0
      || proposed.expectedEquipmentVersion !== state.equipmentVersion) {
    return { ok: false, reason: "invalid_request" };
  }
  const profile = parseGameplayRulesProfile(proposed.rulesProfile);
  if (!profile) return { ok: false, reason: "invalid_profile" };
  const item = state.inventory.find((candidate) => candidate.id === proposed.itemId);
  if (!item || item.category !== "weapon" || item.quantity <= 0) return { ok: false, reason: "missing_weapon" };
  if (item.equipped) return { ok: false, reason: "already_equipped" };

  const economy = previewEquipmentSwitch(profile, {
    isMyTurn: state.isActiveBattle && state.currentTurnId === proposed.actorMemberId
      && proposed.expectedTurnId === state.currentTurnId,
    incapacitated: state.incapacitated,
    remainingActions: state.remainingActions,
    objectInteractionUsed: state.objectInteractionUsed,
  });
  if (!economy.available) return { ok: false, reason: economy.reason };
  return { ok: true, cost: economy.cost, command: { ...proposed, rulesProfile: profile } };
}
