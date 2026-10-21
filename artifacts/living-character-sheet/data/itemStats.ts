import type { EquippedStatKey } from "@/types";

export const STAT_KEY_LABELS: Record<EquippedStatKey, string> = {
  armorClass: "AC",
  speed: "Speed",
  initiative: "Initiative",
  maxHp: "Max HP",
  passivePerception: "Pass. Perc.",
  proficiencyBonus: "Prof. Bonus",
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

export const STAT_KEY_ORDER: EquippedStatKey[] = [
  "armorClass",
  "speed",
  "initiative",
  "maxHp",
  "passivePerception",
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
  "proficiencyBonus",
];

export function statBonusLabel(statKey: EquippedStatKey, statValue: number): string {
  const name = STAT_KEY_LABELS[statKey];
  return statValue >= 0 ? `+${statValue} to ${name}` : `${statValue} to ${name}`;
}
