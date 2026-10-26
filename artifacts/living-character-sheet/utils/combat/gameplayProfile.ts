/**
 * Shared rules configuration contract for future authoritative combat commands.
 * This module describes profile policy; it does NOT spend economy or equip gear.
 * Session authority must validate the effective profile before mutations.
 */
export type GameplayRulesProfileId = "dnd5e_2014" | "tactical_bg3_inspired" | "custom";
export type EquipCostKind = "object_interaction" | "action";
export type GameplayPresentationMode = "standard" | "cinematic";

export interface GameplayRulesProfile {
  schemaVersion: 1;
  id: GameplayRulesProfileId;
  equipment: {
    /** Rules policy, not permission to mutate equipment client-side. */
    switchWeaponCost: EquipCostKind;
  };
}

export interface PersonalGameplayPreferences {
  schemaVersion: 1;
  presentation: GameplayPresentationMode;
  showDetailedCombatLog: boolean;
  showCombatEffectiveness: "off" | "discovered" | "assisted";
}

export const DEFAULT_GAMEPLAY_RULES_PROFILE: Readonly<GameplayRulesProfile> = Object.freeze({
  schemaVersion: 1,
  id: "dnd5e_2014",
  equipment: { switchWeaponCost: "object_interaction" },
});
export const TACTICAL_GAMEPLAY_RULES_PROFILE: Readonly<GameplayRulesProfile> = Object.freeze({
  schemaVersion: 1,
  id: "tactical_bg3_inspired",
  equipment: { switchWeaponCost: "action" },
});
export const DEFAULT_PERSONAL_GAMEPLAY_PREFERENCES: Readonly<PersonalGameplayPreferences> = Object.freeze({
  schemaVersion: 1,
  presentation: "standard",
  showDetailedCombatLog: false,
  showCombatEffectiveness: "discovered",
});

/**
 * This is a fail-closed read-only parser. A missing rules profile uses the
 * existing tabletop-style baseline; an invalid explicit profile must be
 * rejected, not silently replaced with a different action cost.
 */
export function parseGameplayRulesProfile(value: unknown): GameplayRulesProfile | null {
  if (value == null) return {
    schemaVersion: 1,
    id: DEFAULT_GAMEPLAY_RULES_PROFILE.id,
    equipment: { ...DEFAULT_GAMEPLAY_RULES_PROFILE.equipment },
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (p.schemaVersion !== 1 || !p.equipment || typeof p.equipment !== "object" || Array.isArray(p.equipment)) return null;
  const equipment = p.equipment as Record<string, unknown>;
  if (p.id === "dnd5e_2014" && equipment.switchWeaponCost === "object_interaction") {
    return { schemaVersion: 1, id: "dnd5e_2014", equipment: { switchWeaponCost: "object_interaction" } };
  }
  if (p.id === "tactical_bg3_inspired" && equipment.switchWeaponCost === "action") {
    return { schemaVersion: 1, id: "tactical_bg3_inspired", equipment: { switchWeaponCost: "action" } };
  }
  if (p.id === "custom" && (equipment.switchWeaponCost === "action" || equipment.switchWeaponCost === "object_interaction")) {
    return { schemaVersion: 1, id: "custom", equipment: { switchWeaponCost: equipment.switchWeaponCost } };
  }
  return null;
}

export type EquipmentSwitchAvailability =
  | { available: true; cost: EquipCostKind }
  | { available: false; cost: EquipCostKind; reason: "not_your_turn" | "no_action_available" | "object_interaction_used" | "incapacitated" };

export function previewEquipmentSwitch(
  profile: GameplayRulesProfile,
  state: { isMyTurn: boolean; incapacitated: boolean; remainingActions: number; objectInteractionUsed: boolean },
): EquipmentSwitchAvailability {
  const cost = profile.equipment.switchWeaponCost;
  if (!state.isMyTurn) return { available: false, cost, reason: "not_your_turn" };
  if (state.incapacitated) return { available: false, cost, reason: "incapacitated" };
  if (cost === "action" && state.remainingActions <= 0) return { available: false, cost, reason: "no_action_available" };
  if (cost === "object_interaction" && state.objectInteractionUsed) return { available: false, cost, reason: "object_interaction_used" };
  return { available: true, cost };
}
