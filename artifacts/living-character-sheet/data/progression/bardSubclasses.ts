import type { ProgressionSheet } from "./types";

/** Bard subclass milestones: 3, 6, 14 */
function bardSheet(
  subclass: string,
  f3: string,
  f6: string,
  f14: string
): ProgressionSheet {
  return {
    key: `bard:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "bard", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 3, proficiencyBonus: 2, hitDie: 8,
        summary: `${subclass} identity and core College feature unlocks here.`,
        features: [
          { kind: "passive", name: `${subclass}: College Feature`, description: f3 },
        ],
      },
      {
        level: 6, proficiencyBonus: 3, hitDie: 8,
        summary: `${subclass} mid-tier bonus feature expands College utility.`,
        features: [
          { kind: "passive", name: `${subclass}: College Expansion`, description: f6 },
        ],
      },
      {
        level: 14, proficiencyBonus: 5, hitDie: 8,
        summary: `${subclass} capstone College feature reaches peak expression.`,
        features: [
          { kind: "passive", name: `${subclass}: College Mastery`, description: f14 },
        ],
      },
    ],
  };
}

export const COLLEGE_OF_LORE_PROGRESSION = bardSheet(
  "college of lore",
  "Bonus Proficiencies in 3 skills of your choice. Cutting Words lets you use a Bardic Inspiration die as a reaction to subtract from an enemy's attack roll, ability check, or damage roll within 60 ft.",
  "Additional Magical Secrets lets you learn 2 spells from any class spell list, ignoring the normal Magical Secrets level restriction.",
  "Peerless Skill lets you add a Bardic Inspiration die to your own ability checks when you fail or need a boost."
);

export const COLLEGE_OF_VALOR_PROGRESSION = bardSheet(
  "college of valor",
  "Bonus Proficiencies in medium armor, shields, and martial weapons. Combat Inspiration lets allies add their Bardic Inspiration die to weapon damage rolls or AC against a triggering attack.",
  "Extra Attack: You can attack twice whenever you take the Attack action.",
  "Battle Magic: When you use your action to cast a bard spell, you can make one weapon attack as a bonus action."
);

export const COLLEGE_OF_GLAMOUR_PROGRESSION = bardSheet(
  "college of glamour",
  "Mantle of Inspiration (bonus action): Spend a Bardic Inspiration die to grant up to Charisma modifier creatures temporary HP equal to 1d6 + your Bard level and allow each to immediately move up to their speed without opportunity attacks.",
  "Enthralling Performance: After performing for 1 minute, charm up to Charisma modifier humanoids within 60 ft for 1 hour (Wisdom save).",
  "Unbreakable Majesty: As a bonus action, assume Unbreakable Majesty—creatures that attack you must succeed on a Charisma save or be forced to change targets. Lasts 1 minute, usable once per short rest."
);

export const COLLEGE_OF_WHISPERS_PROGRESSION = bardSheet(
  "college of whispers",
  "Psychic Blades: When you hit with a melee weapon attack, you can expend a Bardic Inspiration die to deal additional psychic damage (2d6 at level 3, scaling up). Words of Terror: After speaking privately with a humanoid for 1 minute, they are frightened of you for 1 hour (Wisdom save).",
  "Mantle of Whispers: When a humanoid dies within 30 ft, you can use a reaction to capture their shadow, then spend 1 minute wearing it to perfectly impersonate them. Lasts 1 hour.",
  "Shadow Lore: Whisper 30 ft away to force a creature to make a Wisdom save or be frightened and under your domination for 8 hours (usable once per long rest)."
);

export const COLLEGE_OF_SWORDS_PROGRESSION = bardSheet(
  "college of swords",
  "Bonus Proficiencies in medium armor and scimitars. Fighting Style (choose Dueling or Two-Weapon Fighting). Blade Flourish: When you take the Attack action, your walking speed increases 10 ft this turn and you can use Bardic Inspiration on a hit to add a Defensive, Slashing, or Mobile Flourish effect.",
  "Extra Attack: You can attack twice whenever you take the Attack action.",
  "Master's Flourish: When you use a Blade Flourish option, you can roll a d6 instead of expending a Bardic Inspiration die."
);

export const COLLEGE_OF_CREATION_PROGRESSION = bardSheet(
  "college of creation",
  "Mote of Potential: Bardic Inspiration dice grant bonus effects depending on recipient (attack roll: extra effect die on hit; ability check: additional die; saving throw: temp HP on success). Note of New Life: Once per long rest, animate a Medium or Small nonmagical item as a Dancing Item for 1 hour.",
  "Animating Performance: Animate one Large or smaller nonmagical item as a Dancing Item for 1 hour (bonus action, replaces Note of New Life at this tier).",
  "Creative Crescendo: Animate up to Charisma modifier objects simultaneously when using Animating Performance. If animating fewer than that many, excess are Tiny animated objects under your command."
);

export const COLLEGE_OF_ELOQUENCE_PROGRESSION = bardSheet(
  "college of eloquence",
  "Silver Tongue: When making a Persuasion or Deception check, treat a roll of 9 or less on the die as a 10. Unsettling Words: Expend a Bardic Inspiration die to subtract it from a creature's next saving throw before the end of your next turn.",
  "Unfailing Inspiration: When a creature uses your Bardic Inspiration and fails, they keep the die anyway. Universal Speech: Spend 1 minute speaking and spend a Bardic Inspiration die to make yourself understood by any creature regardless of language for 1 hour.",
  "Infectious Inspiration: When a creature uses your Bardic Inspiration die successfully, you can use your reaction to give another creature (not the original) a free Bardic Inspiration die without expending one of your own."
);

export const BARD_SUBCLASS_SHEETS: ProgressionSheet[] = [
  COLLEGE_OF_LORE_PROGRESSION,
  COLLEGE_OF_VALOR_PROGRESSION,
  COLLEGE_OF_GLAMOUR_PROGRESSION,
  COLLEGE_OF_WHISPERS_PROGRESSION,
  COLLEGE_OF_SWORDS_PROGRESSION,
  COLLEGE_OF_CREATION_PROGRESSION,
  COLLEGE_OF_ELOQUENCE_PROGRESSION,
];
