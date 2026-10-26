import type { Attack, InventoryItem } from "../../types";
import type { CombatNpcGearItem } from "../partyApi";

/**
 * Rules-neutral attack capability. Shared between player session projections
 * and DM-owned combatant planning. Availability is a snapshot, not authority
 * to execute: the server must revalidate current gear, economy and targets.
 */
export interface CombatantAttackCapability {
  id: string;
  name: string;
  source: "player_attack" | "npc_weapon";
  sourceItemId?: string;
  attackBonus: number;
  damageDice: string;
  damageModifier: number;
  damageType: string;
  range?: string;
}

const DICE = /^(?:[1-9]\d*d(?:4|6|8|10|12|20)|[1-9]\d*)(?:\s*[+\-]\s*\d+)?$/i;
function validAttack(attackBonus: number, dice: string, modifier: number, damageType: string): boolean {
  return Number.isFinite(attackBonus) && Number.isFinite(modifier)
    && DICE.test(dice.trim()) && damageType.trim().length > 0;
}

/** The player's normal AttackCard remains the executing UI. */
export function projectPlayerAttackCapabilities(
  attacks: Attack[],
  inventory: InventoryItem[],
): CombatantAttackCapability[] {
  const byId = new Map(inventory.map((item) => [item.id, item]));
  return attacks.flatMap((attack) => {
    const item = attack.linkedInventoryItemId ? byId.get(attack.linkedInventoryItemId) : undefined;
    if (attack.linkedInventoryItemId &&
      (!item || item.category !== "weapon" || !item.equipped || item.quantity <= 0 || item.suppressWeaponCard)) return [];
    if (!validAttack(attack.attackBonus, attack.damageDice, attack.damageModifier, attack.damageType)) return [];
    return [{
      id: attack.id, name: attack.name, source: "player_attack" as const,
      sourceItemId: attack.linkedInventoryItemId, attackBonus: attack.attackBonus,
      damageDice: attack.damageDice, damageModifier: attack.damageModifier,
      damageType: attack.damageType, range: attack.range,
    }];
  });
}

/** NPC gear already contains resolved attack modifiers; don't guess stats. */
export function projectNpcWeaponAttackCapabilities(gear: CombatNpcGearItem[]): CombatantAttackCapability[] {
  return gear.flatMap((item) => {
    if (item.category !== "weapon" || !item.equipped
      || typeof item.attackBonus !== "number" || typeof item.damageDice !== "string"
      || typeof item.damageType !== "string"
      || !item.range?.trim()
      || !validAttack(item.attackBonus, item.damageDice, item.damageModifier ?? 0, item.damageType)) return [];
    return [{
      id: `npc-weapon:${item.id}`, name: item.name, source: "npc_weapon" as const,
      sourceItemId: item.id, attackBonus: item.attackBonus,
      damageDice: item.damageDice, damageModifier: item.damageModifier ?? 0,
      damageType: item.damageType, range: item.range,
    }];
  });
}
