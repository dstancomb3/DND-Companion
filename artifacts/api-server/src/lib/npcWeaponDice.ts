/** Strict bounded dice expressions used by the first NPC weapon executor. */
export function parseNpcWeaponDice(value: unknown):
  { count: number; sides: number; flatModifier: number } | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2})d(4|6|8|10|12)(?:\s*([+-])\s*(\d{1,2}))?$/i.exec(value.trim());
  if (!match) return null;
  const count = Number(match[1]);
  if (count < 1 || count > 20) return null;
  return {
    count, sides: Number(match[2]),
    flatModifier: match[3] ? (match[3] === "-" ? -1 : 1) * Number(match[4]) : 0,
  };
}
