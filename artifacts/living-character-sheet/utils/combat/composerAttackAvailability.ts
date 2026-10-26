import type { Attack, InventoryItem, Character } from "../../types";
import { buildWeaponAttackProfile } from "./weaponAttackProfile";
import { collectEquippedAttackAugments, applyEquippedAttackAugments } from "./itemAttackAugments";

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

/**
 * Project the same ready weapon attacks and baseline unarmed option that the
 * character-sheet Attacks tab provides. Never create an attack from an
 * unequipped weapon; equipment costs remain a separate authoritative concern.
 */
export function buildSessionCombatAttacks(
  savedAttacks: Attack[],
  inventory: InventoryItem[],
  character: Pick<Character, "abilityScores" | "proficiencyBonus" | "class" | "level">,
): Attack[] {
  const equippedWeapons = inventory.filter((item) =>
    item.category === "weapon" && item.equipped && item.quantity > 0,
  );
  const coveredIds = new Set(savedAttacks.map((attack) => attack.linkedInventoryItemId).filter(Boolean));
  const attackForItem = (item: InventoryItem): Attack => {
    const ability = item.attackAbility ?? "strength";
    const profile = buildWeaponAttackProfile({
      abilityScore: character.abilityScores[ability] ?? 10,
      proficiencyBonus: character.proficiencyBonus,
      isProficient: item.isProficient !== false,
      includeAbilityModifierInDamage: item.useAbilityModifierForDamage !== false,
      weaponDamageBonus: item.damageModifier ?? 0,
    });
    return {
      id: `weapon-atk-${item.id}`,
      name: item.name,
      attackBonus: profile.attackBonus,
      damageDice: item.damageDice ?? "1d4",
      damageModifier: profile.damageModifier,
      damageType: item.damageType ?? "bludgeoning",
      additionalDamage: item.additionalDamage,
      range: item.weaponRange,
      notes: item.notes,
      reminders: [],
      linkedInventoryItemId: item.id,
    };
  };
  const generated = equippedWeapons
    .filter((item) => item.damageDice && !item.suppressWeaponCard && !coveredIds.has(item.id))
    .map(attackForItem);

  // Unarmed attacks are derived on the sheet rather than stored in attacks.
  const hasTwoHandedWeapon = equippedWeapons.some((item) =>
    !(item.tags ?? []).includes("Unarmed Weapon") && (item.tags ?? []).includes("Two-Handed"),
  );
  const mergeWeapon = equippedWeapons.find((item) =>
    (item.tags ?? []).includes("Unarmed Weapon") && item.suppressWeaponCard,
  );
  let unarmed: Attack[] = [];
  if (!hasTwoHandedWeapon && !savedAttacks.some((attack) => attack.id === "unarmed-strike")) {
    if (mergeWeapon) {
      unarmed = [{ ...attackForItem(mergeWeapon), id: "unarmed-strike", notes: "Replacing Unarmed Strike" }];
    } else {
      const monk = /monk/i.test(character.class ?? "");
      const strengthMod = Math.floor(((character.abilityScores.strength ?? 10) - 10) / 2);
      const dexterityMod = Math.floor(((character.abilityScores.dexterity ?? 10) - 10) / 2);
      const abilityMod = monk ? Math.max(strengthMod, dexterityMod) : strengthMod;
      const level = character.level ?? 1;
      const damageDice = monk ? (level >= 17 ? "1d10" : level >= 11 ? "1d8" : level >= 5 ? "1d6" : "1d4") : "1";
      unarmed = [{
        id: "unarmed-strike", name: "Unarmed Strike",
        attackBonus: abilityMod + character.proficiencyBonus,
        damageDice, damageModifier: abilityMod, damageType: "bludgeoning", reminders: [],
        range: "5 ft",
      }];
    }
  }
  const augments = collectEquippedAttackAugments(inventory);
  return [...unarmed, ...savedAttacks, ...generated]
    .map((attack) => applyEquippedAttackAugments(attack, augments));
}
