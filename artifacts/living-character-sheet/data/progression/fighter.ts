import type { ProgressionSheet } from "./types";

// ── Fighter core ──────────────────────────────────────────────────────────────

export const FIGHTER_PROGRESSION: ProgressionSheet = {
  key: "fighter",
  source: "class",
  appliesTo: { class: "fighter" },
  levels: [
    {
      level: 1, proficiencyBonus: 2, hitDie: 10,
      summary: "You master a Fighting Style—choose your specialization: Archery, Defense, Dueling, Great Weapon Fighting, or Two-Weapon Fighting.",
      features: [
        {
          kind: "passive", name: "Fighting Style", description:
            "You adopt a particular style of fighting as your specialty. You choose one of five fighting styles:\n" +
            "• Archery: +2 bonus to attack rolls with ranged weapons\n" +
            "• Defense: While wearing armor, gain +1 to AC\n" +
            "• Dueling: While wielding a melee weapon in one hand, gain +2 to damage rolls\n" +
            "• Great Weapon Fighting: When you roll a 1 or 2 on any damage die, reroll and use the new result\n" +
            "• Two-Weapon Fighting: When fighting with two weapons, add your ability modifier to the second attack's damage",
        },
      ],
    },
    {
      level: 2, proficiencyBonus: 2, hitDie: 10,
      summary: "Second Wind grants per-turn HP recovery. You have discovered an inner reserve of stamina.",
      features: [
        { kind: "active_bonus", name: "Second Wind", description: "On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.", resetsOn: "short_rest" },
      ],
    },
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "You choose your Martial Archetype (subclass). Your specialization grants unique abilities and combat styles at levels 3, 7, 10, 15, and 18.",
      features: [
        { kind: "subclass", prompt: "Choose your Martial Archetype. Options include Champion (crit expert), Battle Master (superiority maneuvers), Eldritch Knight (spellcasting), and others. Each grants unique features." },
      ],
    },
    {
      level: 4, proficiencyBonus: 2, hitDie: 10,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 5, proficiencyBonus: 3, hitDie: 10,
      summary: "Extra Attack lets you attack twice instead of once when taking the Attack action. Your martial experience translates to multiple strikes.",
      features: [
        { kind: "passive", name: "Extra Attack", description: "Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn. This increases to three attacks at 11th level and four at 20th level." },
      ],
    },
    {
      level: 6, proficiencyBonus: 3, hitDie: 10,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "Your Martial Archetype grants a new feature.",
      features: [
        { kind: "passive", name: "Martial Archetype Feature", description: "You gain an additional feature from your chosen Martial Archetype." },
      ],
    },
    {
      level: 8, proficiencyBonus: 3, hitDie: 10,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 10,
      summary: "Indomitable: your inner fortitude allows you to reroll a failed saving throw once per rest.",
      features: [
        { kind: "active_reaction", name: "Indomitable", description: "You can reroll a saving throw that you fail. You must use the new roll, and you can't use this feature again until you finish a long rest. You can use this feature twice between long rests starting at 13th level and three times at 17th level.", resetsOn: "long_rest" },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Your Martial Archetype grants another feature, improving your specialization.",
      features: [
        { kind: "passive", name: "Martial Archetype Feature", description: "You gain an additional feature from your chosen Martial Archetype." },
      ],
    },
    {
      level: 11, proficiencyBonus: 4, hitDie: 10,
      summary: "Extra Attack now grants three attacks instead of two when using the Attack action.",
      features: [
        { kind: "passive", name: "Extra Attack (x3)", description: "You can now make three attacks when you take the Attack action on your turn, instead of two." },
      ],
    },
    {
      level: 12, proficiencyBonus: 4, hitDie: 10,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 10,
      summary: "Indomitable improves—you can now reroll saving throws twice per long rest.",
      features: [
        { kind: "passive", name: "Indomitable (x2 uses)", description: "You can now use your Indomitable feature twice between long rests instead of once." },
      ],
    },
    {
      level: 14, proficiencyBonus: 5, hitDie: 10,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 10,
      summary: "Your Martial Archetype grants another significant feature.",
      features: [
        { kind: "passive", name: "Martial Archetype Feature", description: "You gain an additional feature from your chosen Martial Archetype." },
      ],
    },
    {
      level: 16, proficiencyBonus: 5, hitDie: 10,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 10,
      summary: "Indomitable improves further—you can now reroll saving throws three times per long rest.",
      features: [
        { kind: "passive", name: "Indomitable (x3 uses)", description: "You can now use your Indomitable feature three times between long rests instead of twice." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 10,
      summary: "Your Martial Archetype grants one final feature at this level.",
      features: [
        { kind: "passive", name: "Martial Archetype Feature", description: "You gain an additional feature from your chosen Martial Archetype." },
      ],
    },
    {
      level: 19, proficiencyBonus: 6, hitDie: 10,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 20, proficiencyBonus: 6, hitDie: 10,
      summary: "Extra Attack reaches its apex—you can now make four attacks instead of one when using the Attack action.",
      features: [
        { kind: "passive", name: "Extra Attack (x4)", description: "You can now make four attacks when you take the Attack action on your turn, instead of three." },
      ],
    },
  ],
};
