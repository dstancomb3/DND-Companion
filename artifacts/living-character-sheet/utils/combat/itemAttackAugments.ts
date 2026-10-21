import type { AdditionalDamage, Attack, InventoryItem } from "@/types";
import { getRuntimeItemProjectedEffects } from "@/utils/mechanics/runtimeMechanicsCompatibility";

export interface EquippedAttackAugments {
  attackBonusBonus: number;
  additionalDamage: AdditionalDamage[];
}

function toAdditionalDamageSignature(itemId: string, damage: AdditionalDamage): string {
  return [
    itemId,
    damage.sourceLabel ?? "",
    damage.dice ?? "",
    String(damage.damageModifier ?? 0),
    damage.damageType,
    damage.triggerType ?? "",
    damage.triggerCondition ?? "",
  ].join("|");
}

function normalizeEffectExtra(item: InventoryItem, effect: NonNullable<ReturnType<typeof getRuntimeItemProjectedEffects>[number]>): AdditionalDamage | null {
  if (effect.type !== "attack_damage") {
    return null;
  }
  if (!effect.attackDamageDice || !effect.attackDamageType) {
    return null;
  }
  return {
    dice: effect.attackDamageDice,
    damageModifier: effect.attackDamageBonus,
    damageType: effect.attackDamageType,
    sourceLabel: effect.label || item.name,
    triggerType: effect.triggerType,
    triggerCondition: effect.triggerCondition,
  };
}

function normalizeItemExtra(item: InventoryItem, extra: AdditionalDamage): AdditionalDamage {
  return {
    ...extra,
    sourceLabel: extra.sourceLabel ?? item.name,
  };
}

export function collectEquippedAttackAugments(inventory: InventoryItem[]): EquippedAttackAugments {
  const seen = new Set<string>();
  const additionalDamage: AdditionalDamage[] = [];
  let attackBonusBonus = 0;

  for (const item of inventory) {
    if (!item.equipped || item.category === "weapon") {
      continue;
    }

    for (const effect of getRuntimeItemProjectedEffects(item)) {
      if (effect.type !== "attack_damage") {
        continue;
      }
      if (typeof effect.attackToHitBonus === "number") {
        attackBonusBonus += effect.attackToHitBonus;
      }
      const normalized = normalizeEffectExtra(item, effect);
      if (!normalized) {
        continue;
      }
      const signature = toAdditionalDamageSignature(item.id, normalized);
      if (seen.has(signature)) {
        continue;
      }
      seen.add(signature);
      additionalDamage.push(normalized);
    }

    for (const extra of item.additionalDamage ?? []) {
      const normalized = normalizeItemExtra(item, extra);
      const signature = toAdditionalDamageSignature(item.id, normalized);
      if (seen.has(signature)) {
        continue;
      }
      seen.add(signature);
      additionalDamage.push(normalized);
    }
  }

  return { attackBonusBonus, additionalDamage };
}

export function applyEquippedAttackAugments(attack: Attack, augments: EquippedAttackAugments): Attack {
  if (augments.attackBonusBonus === 0 && augments.additionalDamage.length === 0) {
    return attack;
  }

  return {
    ...attack,
    attackBonus: attack.attackBonus + augments.attackBonusBonus,
    additionalDamage: [...(attack.additionalDamage ?? []), ...augments.additionalDamage],
  };
}
