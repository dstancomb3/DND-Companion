import type { ProgressionSheet } from "./types";

/** Wizard subclass milestones: 2, 6, 10, 14 */
function wizardSheet(
  subclass: string,
  f2: string,
  f6: string,
  f10: string,
  f14: string
): ProgressionSheet {
  return {
    key: `wizard:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "wizard", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 2, proficiencyBonus: 2, hitDie: 6,
        summary: `${subclass} grants its Arcane Tradition features at tier 1.`,
        features: [
          { kind: "passive", name: `${subclass}: Tradition Feature`, description: f2 },
        ],
      },
      {
        level: 6, proficiencyBonus: 3, hitDie: 6,
        summary: `${subclass} expands Arcane Tradition mastery at tier 2.`,
        features: [
          { kind: "passive", name: `${subclass}: Tradition Expansion`, description: f6 },
        ],
      },
      {
        level: 10, proficiencyBonus: 4, hitDie: 6,
        summary: `${subclass} reaches advanced Arcane Tradition power at tier 3.`,
        features: [
          { kind: "passive", name: `${subclass}: Tradition Mastery`, description: f10 },
        ],
      },
      {
        level: 14, proficiencyBonus: 5, hitDie: 6,
        summary: `${subclass} unlocks its Arcane Tradition capstone.`,
        features: [
          { kind: "passive", name: `${subclass}: Tradition Capstone`, description: f14 },
        ],
      },
    ],
  };
}

export const SCHOOL_OF_ABJURATION_PROGRESSION = wizardSheet(
  "school of abjuration",
  "Abjuration Savant: Half the gold and time to copy Abjuration spells into spellbook. Arcane Ward: When you cast an Abjuration spell of 1st level or higher, create a magical ward with HP = 2 × Wizard level + Intelligence modifier. Ward absorbs damage before you do; recharge by casting an Abjuration spell of 1st-level+ (ward regains 2× the spell's level in HP, up to maximum).",
  "Projected Ward: When a creature within 30 ft takes damage, use a reaction to have your Arcane Ward absorb that damage instead.",
  "Improved Abjuration: When you cast an Abjuration spell requiring a spellcasting ability check (like counterspell), add Proficiency Bonus to the check.",
  "Spell Resistance: Gain advantage on saving throws against spells. Gain resistance to damage from spells."
);

export const SCHOOL_OF_CONJURATION_PROGRESSION = wizardSheet(
  "school of conjuration",
  "Conjuration Savant: Half gold/time for Conjuration spells. Minor Conjuration: Action to conjure a Tiny, non-magical object in an unoccupied space within 10 ft. Object lasts 1 hour, disappears if you use this feature again or take damage. Value ≤ 5 gp, no food/drink/weapons.",
  "Benign Transposition: Teleport up to 30 ft to an unoccupied space you can see, OR swap positions with a willing Small/Medium creature within 30 ft. Recharges when you cast a Conjuration spell of 1st-level+.",
  "Focused Conjuration: While concentrating on a Conjuration spell, your concentration can't be broken by taking damage from any source.",
  "Durable Summons: Any creature you summon or create with a Conjuration spell gains 30 temporary HP."
);

export const SCHOOL_OF_DIVINATION_PROGRESSION = wizardSheet(
  "school of divination",
  "Divination Savant: Half gold/time for Divination spells. Portent: After a long rest, roll two d20s and record them. Before end of next long rest, you can replace any attack roll, saving throw, or ability check made by you or a creature you can see with one of these rolls (must declare before the roll; each Portent die can be used once).",
  "Expert Divination: When you cast a Divination spell of 2nd level or higher using a spell slot, regain one expended spell slot of a level lower than the spell cast (maximum 5th level).",
  "The Third Eye: Once per short rest, use an action to gain one of the following benefits until your next short rest: Darkvision 60 ft, see invisible within 10 ft, read any language, or see into the Ethereal Plane out to 60 ft.",
  "Greater Portent: Roll three d20s instead of two for Portent feature."
);

export const SCHOOL_OF_ENCHANTMENT_PROGRESSION = wizardSheet(
  "school of enchantment",
  "Enchantment Savant: Half gold/time for Enchantment spells. Hypnotic Gaze: Action to charm a creature within 5 ft (Wisdom save); while charmed and within 5 ft, it is incapacitated and has speed 0. Effect ends if you move more than 5 ft away or the creature takes damage. Must be re-applied each turn (bonus action after first). Recharges on short rest.",
  "Instinctive Charm: When a creature within 30 ft makes an attack against you, use a reaction to divert the attack to the nearest other creature (Wisdom save to negate). Recharges on short rest.",
  "Split Enchantment: When you cast a 1st-level or higher Enchantment spell targeting one creature, you can target a second creature within range with the same spell (no additional slot required).",
  "Alter Memories: When you cast an Enchantment spell, you can make one of its targets unaware of having been charmed. Also, cast Modify Memory on an affected creature without using a spell slot using the target's full duration regardless of Concentration loss."
);

export const SCHOOL_OF_EVOCATION_PROGRESSION = wizardSheet(
  "school of evocation",
  "Evocation Savant: Half gold/time for Evocation spells. Sculpt Spells: When you cast an Evocation spell affecting an area, choose a number of creatures up to 1 + the spell's level. Those creatures automatically succeed on saving throws and take no damage from the spell even on a failed save.",
  "Potent Cantrip: When a creature succeeds on a saving throw against a cantrip you cast, it takes half the cantrip's damage (if any) instead of no damage.",
  "Empowered Evocation: Add your Intelligence modifier to the damage roll of any Evocation spell you cast.",
  "Overchannel: When you cast a 1st–5th level Evocation spell, treat dice rolls of 1–4 as 5s. On a subsequent use before a long rest, you take 2d12 necrotic damage per spell level (no save); each additional overchanneling multiplies the damage by 2."
);

export const SCHOOL_OF_ILLUSION_PROGRESSION = wizardSheet(
  "school of illusion",
  "Illusion Savant: Half gold/time for Illusion spells. Improved Minor Illusion: Learn Minor Illusion if not known; cast it to create both a sound and an image simultaneously.",
  "Malleable Illusions: When you cast an Illusion spell with a duration of 1 minute or more, use an action to change the nature of the illusion.",
  "Illusory Self: When a creature makes an attack roll against you, use a reaction to interpose an illusory duplicate. The attack automatically misses. Recharges on short rest.",
  "Illusory Reality: Once per round when you cast an Illusion spell of 1st level or higher, choose one nonliving, inanimate object within the illusion and make it real for 1 minute. The object can't deal damage or directly harm creatures."
);

export const SCHOOL_OF_NECROMANCY_PROGRESSION = wizardSheet(
  "school of necromancy",
  "Necromancy Savant: Half gold/time for Necromancy spells. Grim Harvest: Once per turn when you kill a creature with a spell, regain HP equal to twice the spell's level (or three times for a Necromancy spell). Doesn't apply to undead or constructs.",
  "Undead Thralls: Add Animate Dead to spellbook for free. Cast it to animate one additional corpse. All undead you create from spells add your Proficiency Bonus to damage rolls and have HP maximums increased by your Wizard level.",
  "Inured to Undeath: Gain resistance to necrotic damage and your HP maximum can't be reduced.",
  "Command Undead: As an action, choose an undead within 60 ft and assert magical dominance over it (Charisma save, DC = your Wizard spell save DC). On a failure, it obeys your commands for 24 hours. If the undead has Intelligence 8 or higher, it has advantage on the save. On a success it is immune to this feature for 24 hours."
);

export const SCHOOL_OF_TRANSMUTATION_PROGRESSION = wizardSheet(
  "school of transmutation",
  "Transmutation Savant: Half gold/time for Transmutation spells. Minor Alchemy: Over 10 minutes, temporarily alter a nonmagical object made of one material (wood, stone, iron, copper, silver) into one of the other materials. Reverts after 1 hour or if you use this feature again.",
  "Transmuter's Stone: Create a fist-sized stone storing transmutation magic over 8 hours. While held the stone grants one of four benefits (darkvision 60 ft, 10 ft speed bonus, proficiency in Con saves, resistance to acid/cold/fire/lightin/thunder—pick when creating). Transfer stone as action; new holder gains the benefit. Destroy and remake on a long rest.",
  "Shapechanger: Add Polymorph to your spellbook. Cast Polymorph on yourself without a spell slot, only affecting yourself, and can only transform into a CR ≤ your level / 4 (min 1) beast. Recharges on short rest.",
  "Master Transmuter: Destroy your Transmuter's Stone as an action to produce one of four effects: Major Transformation (cast Polymorph without slot), Panacea (end all curses, diseases, and poisons on a creature; restore to max HP), Restore Life (cast Raise Dead without components or material cost), Restore Youth (reduce apparent age of a willing creature by 3d10 years, minimum 13)."
);

export const BLADESINGING_PROGRESSION = wizardSheet(
  "bladesinging",
  "Training in War and Song: Gain proficiency in light armor (and if an elf, one type of one-handed melee weapon). Bladesong: Bonus action to start Bladesong for 1 minute. While active: add Intelligence modifier to AC, walking speed increases by 10 ft, advantage on Acrobatics checks, Intelligence modifier bonus to Constitution saves for Concentration. Ends early if you wear medium/heavy armor, use a shield, are incapacitated, or use two hands. Usable twice per short rest.",
  "Extra Attack: Attack twice when taking the Attack action. Additionally, when you cast a cantrip on your turn as an action, you can make one weapon attack as a bonus action.",
  "Song of Defense: While Bladesong is active, use a reaction when you take damage to expend a spell slot and reduce the damage by 5 × the slot level.",
  "Song of Victory: While Bladesong is active, add Intelligence modifier to melee weapon attack damage."
);

export const ORDER_OF_SCRIBES_PROGRESSION = wizardSheet(
  "order of scribes",
  "Wizardly Quill: Free bonus action to summon a magical quill. Transcribe spells in half the time and for free (gold). Spellbook doesn't need ink. Awakened Spellbook: Your spellbook becomes sentient and a spellcasting focus. Once per long rest when you cast a Wizard spell using a spell slot, temporarily replace its damage type with one from another spell in your spellbook (must use a slot of same level). Ritual spells in your book can be cast as rituals without preparing them.",
  "Manifest Mind: Bonus action to manifest a spectral mind from your spellbook within 300 ft. Through the mind, you can cast Wizard spells originating from its location instead of your own; the mind can fly 30 ft per round. Lasts until you dismiss it, manifest again, or it's 1 mile away. Usable once per short rest.",
  "Master Scrivener: Once per long rest, transcribe a prepared spell of 1st or 2nd level onto a special scroll stored in your Awakened Spellbook at no cost. Only you can use it; treat as a spell slot of the appropriate level; crumbles after use.",
  "One with the Word: While your spellbook is on your person, gain advantage on Intelligence (Arcana) checks. If you take damage while concentrating on a spell, make a Wisdom save vs. your own spell save DC to maintain concentration. If the spellbook is destroyed, you can prevent this by taking 3d6 psychic damage per spell level in the book—the books re-forms in your hands with spells intact after 1d8 days. Usable once per long rest."
);

export const WAR_MAGIC_PROGRESSION = wizardSheet(
  "war magic",
  "Arcane Deflection: When you're hit by an attack or fail a saving throw, use a reaction to gain +2 AC against that attack or +4 bonus to that saving throw. If you use this feature, you can only cast cantrips until end of your next turn. Tactical Wit: Add Intelligence modifier to initiative rolls.",
  "Power Surge: Store power in your spellcasting focus. Power surge count = 1 (max = your Proficiency Bonus). Regain 1 when you successfully counterspell or Dispel Magic a spell. Expend a surge when casting a damaging Wizard spell to add half your Wizard level extra force damage. Regain all surges on a long rest, and regain 1 on a short rest if you have none.",
  "Durable Magic: While concentrating on a spell, gain +2 bonus to AC and saving throws.",
  "Deflecting Shroud: When you use Arcane Deflection, magical energy erupts from you: each creature of your choice within 10 ft takes force damage equal to half your Wizard level."
);

export const CHRONURGY_MAGIC_PROGRESSION = wizardSheet(
  "chronurgy magic",
  "Chronal Shift: Twice per long rest, use a reaction after a creature within 30 ft makes an attack, ability check, or saving throw—force the creature to reroll and use the new roll. Temporal Awareness: Add Intelligence modifier to initiative rolls (replaces Dex for initiative).",
  "Momentary Stasis: Action to force a Large or smaller creature within 60 ft to make a Constitution save or be incapacitated and speed 0 until end of your next turn (or takes damage). Usable Intelligence modifier times per long rest.",
  "Arcane Abeyance: Once per short rest, when you cast a 4th-level or lower spell using a slot, condense the spell into a mote. One willing creature within 30 ft can hold the mote (max 1 hour). The holder can cast the spell (using your spell save DC and attack bonus, no slot needed) as an action.",
  "Convergent Future: Once per long rest, when you or a creature within 60 ft makes an attack roll, ability check, or saving throw, you may replace the result with whatever number you choose. Each use causes one level of exhaustion (removed only by a long rest)."
);

export const GRAVITURGY_MAGIC_PROGRESSION = wizardSheet(
  "graviturgy magic",
  "Adjust Density: Action to magically alter the weight of one creature or object within 30 ft for up to 1 minute. Halved weight: fly speed 10 ft (hover), disadvantage on Strength checks/saves. Doubled weight: speed reduced by 10 ft, advantage on Strength checks/saves vs. being moved. Usable Intelligence modifier times per long rest.",
  "Gravity Well: Whenever you cast a spell targeting a creature, you can move the target 5 ft toward or away from you (if a willing creature, or if the spell requires it to save). Violent Attraction: Once per turn when a weapon attack hits within 60 ft, use a reaction to increase the attack's damage by 1d10. Or when a creature within 60 ft falls, reduce fall damage by 2d10. Usable Intelligence modifier times per long rest.",
  "Event Horizon: Action to emit a powerful field for 1 minute: each creature within 30 ft that starts its turn there must make a Strength save or take 2d10 force damage and have its speed reduced to 0 until start of its next turn. On a successful save, it takes half damage and speed is not reduced. Usable once per short rest.",
  "Reverse Gravity: Add Reverse Gravity to your spellbook for free. Cast it once per long rest without using a spell slot."
);

export const WIZARD_SUBCLASS_SHEETS: ProgressionSheet[] = [
  SCHOOL_OF_ABJURATION_PROGRESSION,
  SCHOOL_OF_CONJURATION_PROGRESSION,
  SCHOOL_OF_DIVINATION_PROGRESSION,
  SCHOOL_OF_ENCHANTMENT_PROGRESSION,
  SCHOOL_OF_EVOCATION_PROGRESSION,
  SCHOOL_OF_ILLUSION_PROGRESSION,
  SCHOOL_OF_NECROMANCY_PROGRESSION,
  SCHOOL_OF_TRANSMUTATION_PROGRESSION,
  BLADESINGING_PROGRESSION,
  ORDER_OF_SCRIBES_PROGRESSION,
  WAR_MAGIC_PROGRESSION,
  CHRONURGY_MAGIC_PROGRESSION,
  GRAVITURGY_MAGIC_PROGRESSION,
];
