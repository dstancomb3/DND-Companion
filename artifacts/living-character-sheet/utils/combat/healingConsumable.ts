/** Only mechanically identified consumables restore HP; descriptions alone are not a healing command. */
export type HealingRoll = { dice: number; sides: number; bonus: number };

export function getConsumableHealingRoll(input: { name: string; notes?: string }): HealingRoll | null {
  const name = input.name.trim().toLowerCase();
  const tiers: Array<[RegExp, HealingRoll]> = [
    [/^(?:potion of healing|healing potion|health potion)$/i, { dice: 2, sides: 4, bonus: 2 }],
    [/^(?:potion of greater healing|greater healing potion)$/i, { dice: 4, sides: 4, bonus: 4 }],
    [/^(?:potion of superior healing|superior healing potion)$/i, { dice: 8, sides: 4, bonus: 8 }],
    [/^(?:potion of supreme healing|supreme healing potion)$/i, { dice: 10, sides: 4, bonus: 20 }],
  ];
  const known = tiers.find(([pattern]) => pattern.test(name));
  if (known) return known[1];
  const notes = input.notes ?? "";
  const match = /(?:regain|restore|heal(?:s|ing)?)\s+(\d{1,2})d(4|6|8|10|12)(?:\s*\+\s*(\d{1,2}))?\s*(?:hit points|hp)/i.exec(notes);
  if (!match) return null;
  const dice = Number(match[1]), sides = Number(match[2]), bonus = Number(match[3] ?? 0);
  if (!dice || dice > 12 || bonus > 50) return null;
  return { dice, sides, bonus };
}

export function rollConsumableHealing(roll: HealingRoll, random = Math.random): number {
  let total = roll.bonus;
  for (let i = 0; i < roll.dice; i++) total += 1 + Math.floor(Math.min(0.999999, Math.max(0, random())) * roll.sides);
  return total;
}
