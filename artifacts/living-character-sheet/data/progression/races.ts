import type { ProgressionSheet } from "./types";

// ── Human ─────────────────────────────────────────────────────────────────────

export const HUMAN_TRAITS: ProgressionSheet = {
  key: "race:human",
  source: "race",
  appliesTo: { race: "human" },
  levels: [
    {
      level: 1, proficiencyBonus: 2, hitDie: 0,
      summary: "Humans are versatile and ambitious, gaining a modest boost to all ability scores and one extra skill proficiency.",
      features: [
        { kind: "passive", name: "Human Versatility", description: "All six of your ability scores each increase by 1. You gain proficiency in one additional skill of your choice." },
        { kind: "passive", name: "Extra Language", description: "You can speak, read, and write one additional language of your choice." },
      ],
    },
  ],
};

// ── Githyanki ─────────────────────────────────────────────────────────────────
// Source: Mordenkainen Presents: Monsters of the Multiverse / Volo's Guide.
// Githyanki gain innate spells as they level: Mage Hand (1st), Jump (3rd), Misty Step (5th).
// These are granted by race, not class, so they are race features here.

export const GITHYANKI_TRAITS: ProgressionSheet = {
  key: "race:githyanki",
  source: "race",
  appliesTo: { race: "githyanki" },
  levels: [
    {
      level: 1, proficiencyBonus: 2, hitDie: 0,
      summary: "Githyanki are born warriors from the Astral Plane. At 1st level you gain Astral Knowledge and the Mage Hand cantrip.",
      features: [
        { kind: "active_action", name: "Githyanki Psionics: Mage Hand", description: "You can cast the Mage Hand cantrip using this trait. The hand is invisible when you cast it this way. Intelligence is your spellcasting ability for it. You can cast it a number of times equal to your proficiency bonus per long rest.", resetsOn: "long_rest" },
        { kind: "passive", name: "Astral Knowledge", description: "You can mystically reach into the Astral Plane to supplant your training. When you finish a long rest, you gain proficiency with one skill or tool of your choice and retain that proficiency until you finish your next long rest." },
        { kind: "passive", name: "Psychic Resilience", description: "You have resistance to psychic damage." },
        { kind: "passive", name: "Medium Armor Proficiency (Githyanki)", description: "Githyanki are proficient with medium armor and shortswords, longswords, and greatswords." },
      ],
    },
    {
      level: 3, proficiencyBonus: 2, hitDie: 0,
      summary: "At 3rd level your Githyanki Psionics expand: you can cast Jump once per long rest without using a spell slot.",
      features: [
        { kind: "active_action", name: "Githyanki Psionics: Jump", description: "You can cast the Jump spell with this trait, without expending a spell slot, and you must finish a long rest before you can cast it this way again. Intelligence is your spellcasting ability for it.", resetsOn: "long_rest" },
      ],
    },
    {
      level: 5, proficiencyBonus: 3, hitDie: 0,
      summary: "At 5th level your Githyanki Psionics expand further: you can cast Misty Step once per long rest without using a spell slot.",
      features: [
        { kind: "active_action", name: "Githyanki Psionics: Misty Step", description: "You can cast the Misty Step spell with this trait, without expending a spell slot, and you must finish a long rest before you can cast it this way again. Intelligence is your spellcasting ability for it.", resetsOn: "long_rest" },
      ],
    },
  ],
};

export const ALL_RACE_PROGRESSIONS: ProgressionSheet[] = [
  HUMAN_TRAITS,
  GITHYANKI_TRAITS,
];

export function getRaceProgression(race: string): ProgressionSheet | undefined {
  const lower = race.toLowerCase().trim();
  return ALL_RACE_PROGRESSIONS.find(
    (r) => r.appliesTo?.race && lower.includes(r.appliesTo.race)
  );
}
