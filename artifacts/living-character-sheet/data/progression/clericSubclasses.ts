import type { ProgressionSheet } from "./types";

/**
 * Cleric subclass (Divine Domain) milestones: 1, 2, 6, 8, 17
 * Level 1 = Domain Spells + bonus feature; level 2 = Channel Divinity option;
 * level 6 = Domain feature; level 8 = Divine Strike or Potent Cantrip; level 17 = capstone.
 */
function clericSheet(
  subclass: string,
  f1: string,
  f2: string,
  f6: string,
  f8: string,
  f17: string
): ProgressionSheet {
  return {
    key: `cleric:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "cleric", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 1, proficiencyBonus: 2, hitDie: 8,
        summary: `${subclass} grants Domain Spells and its level 1 Domain feature.`,
        features: [
          { kind: "passive", name: `${subclass}: Domain Spells & Feature`, description: f1 },
        ],
      },
      {
        level: 2, proficiencyBonus: 2, hitDie: 8,
        summary: `${subclass} grants a Channel Divinity option at level 2.`,
        features: [
          { kind: "active_action", name: `${subclass}: Channel Divinity`, description: f2 },
        ],
      },
      {
        level: 6, proficiencyBonus: 3, hitDie: 8,
        summary: `${subclass} mid-tier Domain feature deepens identity.`,
        features: [
          { kind: "passive", name: `${subclass}: Domain Expansion`, description: f6 },
        ],
      },
      {
        level: 8, proficiencyBonus: 3, hitDie: 8,
        summary: `${subclass} grants Divine Strike or Potent Cantrip.`,
        features: [
          { kind: "passive", name: `${subclass}: Divine Strike / Potent Cantrip`, description: f8 },
        ],
      },
      {
        level: 17, proficiencyBonus: 6, hitDie: 8,
        summary: `${subclass} capstone Domain feature unlocks ultimate holy power.`,
        features: [
          { kind: "passive", name: `${subclass}: Domain Capstone`, description: f17 },
        ],
      },
    ],
  };
}

export const LIFE_DOMAIN_PROGRESSION = clericSheet(
  "life domain",
  "Domain Spells: Bless, Cure Wounds, Lesser Restoration, Spiritual Weapon, Beacon of Hope, Revivify, Death Ward, Guardian of Faith, Mass Cure Wounds, Raise Dead. Bonus Proficiency: Heavy armor. Disciple of Life: Whenever you use a spell of 1st level or higher to restore HP, the creature regains additional HP equal to 2 + the spell's level.",
  "Preserve Life: Channel Divinity to restore HP among creatures within 30 ft. Total HP restored = 5 × Cleric level; can't bring any creature above half its maximum HP.",
  "Blessed Healer: When you cast a spell of 1st level or higher that restores HP to another creature, you regain HP equal to 2 + the spell's level.",
  "Divine Strike: Once per turn when you hit with a weapon attack, deal +1d8 radiant damage (increases to +2d8 at level 14).",
  "Supreme Healing: Instead of rolling dice to restore HP with a spell, use the highest possible number for each die."
);

export const LIGHT_DOMAIN_PROGRESSION = clericSheet(
  "light domain",
  "Domain Spells: Burning Hands, Faerie Fire, Flaming Sphere, Scorching Ray, Daylight, Fireball, Guardian of Faith, Wall of Fire, Flame Strike, Scrying. Bonus Cantrip: Light. Warding Flare: Reaction when attacked—impose disadvantage on the attack roll (usable Wisdom modifier times per long rest).",
  "Radiance of the Dawn: Channel Divinity—dispel magical darkness in a 30-ft radius; hostile creatures within 30 ft make a Constitution save or take 2d10 + Cleric level radiant damage (success = half).",
  "Improved Flare: Warding Flare can now be used when a creature within 30 ft that you can see is attacked (not just yourself).",
  "Potent Cantrip: Your damaging cantrips affect targets even on a successful saving throw—they take half the cantrip's damage.",
  "Corona of Light: Action to activate an aura of sunlight for 1 minute. 60-ft radius bright light, additional 30 ft dim. Enemies within the bright light have disadvantage on saves vs. spells that deal fire or radiant damage."
);

export const TRICKERY_DOMAIN_PROGRESSION = clericSheet(
  "trickery domain",
  "Domain Spells: Charm Person, Disguise Self, Mirror Image, Pass Without Trace, Blink, Dispel Magic, Dimension Door, Polymorph, Dominate Person, Modify Memory. Blessing of the Trickster: Touch a willing creature to grant advantage on Dexterity (Stealth) checks for 1 hour. Usable once until next use.",
  "Invoke Duplicity: Channel Divinity—create an illusory duplicate of yourself for 1 minute. Bonus action to move it up to 30 ft; grant advantage on attacks made from within 5 ft of the duplicate; can cast spells as if from the duplicate's space; creatures within 5 ft of both you and your duplicate have disadvantage on saves vs. your spells.",
  "Cloak of Shadows: Channel Divinity—become invisible until end of next turn or until attacking/casting.",
  "Divine Strike: Once per turn when you hit with a weapon attack, deal +1d8 poison damage (+2d8 at level 14).",
  "Improved Duplicity: Create up to four duplicates with Invoke Duplicity instead of one."
);

export const KNOWLEDGE_DOMAIN_PROGRESSION = clericSheet(
  "knowledge domain",
  "Domain Spells: Command, Identify, Augury, Suggestion, Nondetection, Speak with Dead, Arcane Eye, Confusion, Legend Lore, Scrying. Blessings of Knowledge: Learn two languages and gain proficiency in two skills from: Arcana, History, Nature, Religion. Your proficiency bonus is doubled for those skill checks.",
  "Knowledge of the Ages: Channel Divinity—gain proficiency in any one skill or tool for 10 minutes. Read Thoughts: Channel Divinity—choose a creature within 60 ft; it makes a Wisdom save (your DC). On a fail, read its surface thoughts for 1 minute; use an action to cast Suggestion on it without expending a slot.",
  "Visions of the Past: Channel Divinity to see recent events tied to an object or location. Object Reading: hold an object for 1 minute and learn how it was made, used, and last 6 days of its history. Area Reading: meditate 1 minute in a location to see events of the last 24 hours as a brief vision.",
  "Potent Cantrip: Your damaging cantrips affect even creatures that succeed on their saving throw (half damage).",
  "Mind of the Master: You can use Channel Divinity twice between rests (if you only have one use, gain an extra one)."
);

export const WAR_DOMAIN_PROGRESSION = clericSheet(
  "war domain",
  "Domain Spells: Divine Favor, Shield of Faith, Magic Weapon, Spiritual Weapon, Crusader's Mantle, Spirit Guardians, Freedom of Movement, Stoneskin, Flame Strike, Hold Monster. Bonus Proficiencies: Martial weapons and heavy armor. War Priest: When you use the Attack action, make a weapon attack as a bonus action (usable Wisdom modifier times per long rest).",
  "Guided Strike: Channel Divinity—when you or an ally within 30 ft makes an attack roll, use a reaction to grant +10 to the roll (after seeing the roll, before knowing if it hits). War God's Blessing: Channel Divinity—same +10 bonus granted to any ally within 30 ft.",
  "War God's Blessing (see level 2). Additional use: Cleric of the War Domain, when you use Spirit Guardians or cast Divine Favor, the effect lasts one round longer.",
  "Divine Strike: Once per turn when you hit with a weapon attack, deal +1d8 damage of the weapon's type (+2d8 at level 14).",
  "Avatar of Battle: Gain resistance to bludgeoning, piercing, and slashing damage from nonmagical weapons."
);

export const NATURE_DOMAIN_PROGRESSION = clericSheet(
  "nature domain",
  "Domain Spells: Animal Friendship, Speak with Animals, Barkskin, Spike Growth, Plant Growth, Wind Wall, Dominate Beast, Grasping Vine, Insect Plague, Tree Stride. Acolyte of Nature: Learn one Druid cantrip. Gain proficiency in one of: Animal Handling, Nature, or Survival. Bonus Proficiency: Heavy armor.",
  "Charm Animals and Plants: Channel Divinity—present your holy symbol as an action; all beasts and plant creatures within 30 ft that can see you are charmed until end of your next turn.",
  "Dampen Elements: Reaction when you or a creature within 30 ft takes acid, cold, fire, lightning, or thunder damage—grant resistance to one instance of that damage.",
  "Divine Strike: Once per turn when you hit with a weapon attack, deal +1d8 cold, fire, or lightning damage (+2d8 at level 14).",
  "Master of Nature: Bonus action to verbally command charmed beasts and plants (from Charm Animals and Plants) each turn."
);

export const TEMPEST_DOMAIN_PROGRESSION = clericSheet(
  "tempest domain",
  "Domain Spells: Fog Cloud, Thunderwave, Gust of Wind, Shatter, Call Lightning, Sleet Storm, Control Water, Ice Storm, Destructive Wave, Insect Plague. Bonus Proficiencies: Martial weapons and heavy armor. Wrath of the Storm: Reaction when hit by an attacker within 5 ft—deal 2d8 lightning or thunder damage (Dex save for half, usable Wisdom modifier times per long rest).",
  "Destructive Wrath: Channel Divinity—when you roll lightning or thunder damage, maximize all dice (no rolling) instead.",
  "Thunderbolt Strike: When you deal lightning damage to a Large or smaller creature, push it up to 10 ft away in any horizontal direction.",
  "Divine Strike: Once per turn when you hit with a weapon attack, deal +1d8 thunder damage (+2d8 at level 14).",
  "Stormborn: You have a fly speed equal to your walking speed whenever you are outdoors and not underground."
);

export const DEATH_DOMAIN_PROGRESSION = clericSheet(
  "death domain",
  "Domain Spells: False Life, Ray of Sickness, Blindness/Deafness, Ray of Enfeeblement, Animate Dead, Vampiric Touch, Blight, Death Ward, Antilife Shell, Cloudkill. Bonus Proficiency: Martial weapons. Reaper: Learn one Necromancy cantrip. When casting a Necromancy cantrip targeting one creature, target two creatures within range instead.",
  "Touch of Death: Channel Divinity—when you hit with a melee attack, deal maximum damage plus 5 + (2 × Cleric level) necrotic damage.",
  "Inescapable Destruction: Necrotic damage you deal with spells and Channel Divinity options ignores resistance.",
  "Divine Strike: Once per turn when you hit with a weapon attack, deal +1d8 necrotic damage (+2d8 at level 14).",
  "Improved Reaper: When casting a spell of 1st through 5th level that targets one creature in the Death Domain spell list, target two creatures within range. Both must be within range of each other. Expend only one spell slot."
);

export const ARCANA_DOMAIN_PROGRESSION = clericSheet(
  "arcana domain",
  "Domain Spells: Detect Magic, Magic Missile, Magic Weapon, Nystul's Magic Aura, Dispel Magic, Magic Circle, Arcane Eye, Leomund's Secret Chest, Planar Binding, Teleportation Circle. Arcane Initiate: Gain proficiency in the Arcana skill. Learn two Wizard cantrips.",
  "Arcane Abjuration: Channel Divinity—present holy symbol to turn celestials, elementals, fey, or fiends within 30 ft (Wisdom save, DC = your spell save DC). Turned creatures must flee. Creatures of CR ≤ a threshold banished entirely until short rest.",
  "Spell Breaker: When restoring HP to an ally with a spell of 1st level or higher, also end one spell effect on them of level ≤ the healing spell's level.",
  "Potent Cantrip: Your damaging cantrips affect targets even on a successful saving throw (half damage).",
  "Arcane Mastery: Choose 4 spells from the Wizard spell list (one each of 6th, 7th, 8th, 9th level). They count as Cleric spells for you and are always prepared."
);

export const FORGE_DOMAIN_PROGRESSION = clericSheet(
  "forge domain",
  "Domain Spells: Identify, Searing Smite, Heat Metal, Magic Weapon, Elemental Weapon, Protection from Energy, Fabricate, Wall of Fire, Animate Objects, Creation. Bonus Proficiency: Heavy armor and smith's tools. Blessing of the Forge: At end of a long rest, give a magic item property to a nonmagical weapon or armor (+1 modifier). This lasts until next long rest.",
  "Artisan's Blessing: Channel Divinity—conduct a 1-hour ceremony to create a metal item worth ≤ 100 gp (including simple weapons/tools). Item must contain at least 1 gp of metal.",
  "Soul of the Forge: Gain resistance to fire damage. While wearing heavy armor, gain +1 to AC.",
  "Divine Strike: Once per turn when you hit with a weapon attack, deal +1d8 fire damage (+2d8 at level 14).",
  "Saint of Forge and Fire: Gain immunity to fire damage. While wearing heavy armor, gain resistance to bludgeoning, piercing, and slashing damage from nonmagical weapons."
);

export const GRAVE_DOMAIN_PROGRESSION = clericSheet(
  "grave domain",
  "Domain Spells: Bane, False Life, Gentle Repose, Ray of Enfeeblement, Revivify, Vampiric Touch, Blight, Death Ward, Antilife Shell, Raise Dead. Circle of Mortality: When you would normally roll one or more dice to restore HP with a spell to a creature at 0 HP, use the maximum value for each die instead. Also learn Spare the Dying cantrip, which now has range 30 ft and can be cast as a bonus action.",
  "Eyes of the Grave: Channel Divinity—detect undead within 60 ft (their location and number, not type/stats) until end of your next turn. Path to the Grave: Channel Divinity—curse one creature as a reaction or bonus action when it takes damage; the next attack that hits it deals double damage. Curse ends after the first hit or 1 minute.",
  "Sentinel at Death's Door: Reaction when you or an ally within 30 ft is hit by a critical hit—turn it into a normal hit instead. Usable Wisdom modifier times per long rest.",
  "Potent Cantrip: Your damaging cantrips affect targets even on a successful saving throw (half damage).",
  "Keeper of Souls: When a creature dies within 60 ft, you can use your reaction to capture its departing soul energy and immediately restore HP to one creature within 60 ft equal to the dead creature's number of Hit Dice. This feature can only be used while not incapacitated."
);

export const ORDER_DOMAIN_PROGRESSION = clericSheet(
  "order domain",
  "Domain Spells: Command, Heroism, Hold Person, Zone of Truth, Mass Healing Word, Slow, Compulsion, Locate Creature, Dominate Person, Hold Monster. Bonus Proficiencies: Heavy armor and the Persuasion skill. Voice of Authority: When you cast a spell of 1st level or higher on an ally, that ally can use a reaction to make one weapon attack against a target of your choice within range.",
  "Order's Demand: Channel Divinity—all creatures of your choice within 30 ft make a Wisdom save or be charmed until end of next turn or until they take damage. A charmed creature drops what it's holding.",
  "Embodiment of the Law: When you cast an Enchantment spell of 1st level or higher, you can cast it as a bonus action. Usable Wisdom modifier times per long rest.",
  "Divine Strike: Once per turn when you hit with a weapon attack, deal +1d8 psychic damage (+2d8 at level 14).",
  "Order's Wrath: When allies hit a creature affected by your Divine Strike's psychic damage, they deal an extra 2d8 psychic damage (once per turn)."
);

export const PEACE_DOMAIN_PROGRESSION = clericSheet(
  "peace domain",
  "Domain Spells: Heroism, Sanctuary, Aid, Warding Bond, Beacon of Hope, Sending, Aura of Purity, Otiluke's Resilient Sphere, Greater Restoration, Rary's Telepathic Bond. Implement of Peace: Gain proficiency in Insight, Performance, or Persuasion (your choice). Emboldening Bond: Action—create a bond between up to PB willing creatures (including yourself) within 30 ft for 10 minutes. When bonded creatures make attack rolls, ability checks, or saving throws, they can add 1d4 to the roll if bonded creature is within 30 ft. Each creature can only be in one bond at a time. Usable PB times per long rest.",
  "Balm of Peace: Channel Divinity—move up to your speed without provoking opportunity attacks; when you move within 5 ft of a creature during this movement, restore 2d6 + Wisdom modifier HP to it (each creature can only be healed once per use).",
  "Protective Bond: While creatures are bonded via Emboldening Bond, if one takes damage while within 60 ft of a bonded creature, the bonded creature can use a reaction to teleport to a space within 5 ft of the damaged creature and take all the damage instead.",
  "Potent Cantrip: Your damaging cantrips affect targets even on a successful saving throw (half damage).",
  "Expansive Bond: Protective Bond now works at any distance on the same plane. Additionally, bonded creatures also gain resistance to all damage while within 30 ft of another bonded creature."
);

export const TWILIGHT_DOMAIN_PROGRESSION = clericSheet(
  "twilight domain",
  "Domain Spells: Faerie Fire, Sleep, Moonbeam, See Invisibility, Aura of Vitality, Leomund's Tiny Hut, Aura of Life, Greater Invisibility, Circle of Power, Modify Memory. Bonus Proficiencies: Martial weapons and heavy armor. Eyes of Night: Gain darkvision 300 ft. Bonus action to extend darkvision 300 ft to up to PB willing creatures within 10 ft for 1 hour. Vigilant Blessing: Touch a creature to grant them advantage on the next initiative roll they make. Expends when used.",
  "Twilight Sanctuary: Channel Divinity—present holy symbol to create a 30-ft radius sphere of twilight centered on you for 1 minute. At end of each turn, choose one effect on each creature in the sphere: grant 1d6 + Cleric level temp HP, or end one effect causing the frightened or charmed condition.",
  "Steps of Night: While in dim light or darkness, bonus action to fly up to your walking speed until end of the turn. Usable PB times per long rest.",
  "Divine Strike: Once per turn when you hit with a weapon attack, deal +1d8 radiant or necrotic damage (+2d8 at level 14).",
  "Twilight Shroud: Creatures in Twilight Sanctuary have half cover."
);

export const CLERIC_SUBCLASS_SHEETS: ProgressionSheet[] = [
  LIFE_DOMAIN_PROGRESSION,
  LIGHT_DOMAIN_PROGRESSION,
  TRICKERY_DOMAIN_PROGRESSION,
  KNOWLEDGE_DOMAIN_PROGRESSION,
  WAR_DOMAIN_PROGRESSION,
  NATURE_DOMAIN_PROGRESSION,
  TEMPEST_DOMAIN_PROGRESSION,
  DEATH_DOMAIN_PROGRESSION,
  ARCANA_DOMAIN_PROGRESSION,
  FORGE_DOMAIN_PROGRESSION,
  GRAVE_DOMAIN_PROGRESSION,
  ORDER_DOMAIN_PROGRESSION,
  PEACE_DOMAIN_PROGRESSION,
  TWILIGHT_DOMAIN_PROGRESSION,
];
