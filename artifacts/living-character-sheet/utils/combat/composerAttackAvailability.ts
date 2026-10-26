import type { Attack, InventoryItem } from "../../types";

/** UI projection only. Legal actions still pass through combat.resolveCombatAction. */
export type AttackComposerGroup = "melee" | "ranged" | "other";

export interface ComposerAttackOption {
  attack: Attack;
  group: AttackComposerGroup;
}

/**
 * Conservative classification: ambiguous custom attacks are never guessed to
 * be ranged. The underlying AttackCard and combat engine retain authority.
 */
export function classifyAttackForComposer(attack: Attack, linkedItem?: InventoryItem): AttackComposerGroup {
  const range = (attack.range ?? linkedItem?.weaponRange ?? "").trim().toLowerCase();
  if (!range) return "other";
  if (/\b(thrown|ranged)\b/.test(range)) return "ranged";
  if (/\b(melee|reach)\b/.test(range)) return "melee";
  // "80/320 ft", "30 ft", etc. specify attack range without a weapon type:
  // do not infer these indicate a weapon available in inventory.
  if (/^\d+\s*\/\s*\d+\s*(ft\.?|feet)?$/.test(range)) return "ranged";
  if (/^\d+\s*(ft\.?|feet)$/.test(range)) {
    const distance = parseInt(range, 10);
    return distance <= 15 ? "melee" : "ranged";
  }
  return "other";
}

/**
 * Exclude stale weapon attack projections whose linked inventory weapon is
 * absent, consumed, suppressed, or unequipped. Standalone/custom attacks stay
 * visible in "Other" if classification is not known.
 *
 * Equipping is intentionally not offered here: profile-specific equip costs
 * require an authoritative mutation path not yet implemented.
 */
export function buildComposerAttackOptions(
  attacks: Attack[],
  inventory: InventoryItem[],
): ComposerAttackOption[] {
  const itemsById = new Map(inventory.map((item) => [item.id, item]));
  return attacks.flatMap((attack) => {
    const item = attack.linkedInventoryItemId
      ? itemsById.get(attack.linkedInventoryItemId)
      : undefined;
    if (attack.linkedInventoryItemId) {
      if (!item || item.category !== "weapon" || !item.equipped || item.quantity <= 0 || item.suppressWeaponCard) {
        return [];
      }
    }
    return [{ attack, group: classifyAttackForComposer(attack, item) }];
  });
}

export function getAvailableAttackGroups(options: ComposerAttackOption[]): AttackComposerGroup[] {
  const groups: AttackComposerGroup[] = ["melee", "ranged", "other"];
  return groups.filter((group) => options.some((option) => option.group === group));
}
