import type { ProgressionSheet } from "./types";

/** Warlock subclass milestones: 1, 6, 10, 14 */
function warlockSheet(
  subclass: string,
  f1: string,
  f6: string,
  f10: string,
  f14: string
): ProgressionSheet {
  return {
    key: `warlock:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "warlock", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 1, proficiencyBonus: 2, hitDie: 8,
        summary: `${subclass} grants its foundational Patron boon and Expanded Spell List at level 1.`,
        features: [
          { kind: "passive", name: `${subclass}: Patron Boon`, description: f1 },
        ],
      },
      {
        level: 6, proficiencyBonus: 3, hitDie: 8,
        summary: `${subclass} deepens its Patron relationship with a new ability.`,
        features: [
          { kind: "passive", name: `${subclass}: Patron Gift`, description: f6 },
        ],
      },
      {
        level: 10, proficiencyBonus: 4, hitDie: 8,
        summary: `${subclass} grants an advanced Patron power at tier 3.`,
        features: [
          { kind: "passive", name: `${subclass}: Patron Power`, description: f10 },
        ],
      },
      {
        level: 14, proficiencyBonus: 5, hitDie: 8,
        summary: `${subclass} unlocks its capstone Patron capstone ability.`,
        features: [
          { kind: "passive", name: `${subclass}: Patron Capstone`, description: f14 },
        ],
      },
    ],
  };
}

export const THE_FIEND_PROGRESSION = warlockSheet(
  "the fiend",
  "Expanded Spells: Burning Hands, Command, Blindness/Deafness, Scorching Ray, Fireball, Stinking Cloud, Fire Shield, Wall of Fire always added to spell list. Dark One's Blessing: When you reduce a hostile creature to 0 HP, gain temporary HP equal to Charisma modifier + Warlock level.",
  "Dark One's Own Luck: Once per short rest, add 1d10 to an ability check or saving throw.",
  "Fiendish Resilience: Choose one damage type at the end of a short or long rest. Gain resistance to that damage type until you choose a different type.",
  "Hurl Through Hell: When you hit a creature with an attack, teleport it through a horrific extraplanar space. The creature disappears and returns at the end of your next turn, taking 10d10 psychic damage (no save) unless it's a Fiend. Usable once per long rest."
);

export const THE_ARCHFEY_PROGRESSION = warlockSheet(
  "the archfey",
  "Expanded Spells: Faerie Fire, Sleep, Calm Emotions, Phantasmal Force, Blink, Plant Growth, Dominate Beast, Seeming always added to spell list. Fey Presence: Action to force each creature in a 10-ft cube to make a Wisdom save or be charmed or frightened (your choice) until end of your next turn. Usable once per short rest.",
  "Misty Escape: When you take damage, use a reaction to turn invisible and teleport up to 60 ft to an unoccupied space you can see. Invisibility lasts until end of your next turn or until you attack/cast. Usable once per short rest.",
  "Beguiling Defenses: Immune to being charmed. When a creature tries to charm you, it must succeed on a Wisdom save or be charmed by you for 1 minute.",
  "Dark Delirium: Send a creature within 60 ft into a phantasmagoric state for 1 minute (Wisdom save). The creature is charmed or frightened (your choice), incapacitated, and can't take reactions. At the end of each turn the creature takes damage, it repeats the save. Usable once per short rest."
);

export const THE_GREAT_OLD_ONE_PROGRESSION = warlockSheet(
  "the great old one",
  "Expanded Spells: Dissonant Whispers, Tashas Hideous Laughter, Detect Thoughts, Phantasmal Force, Clairvoyance, Sending, Dominate Beast, Evard's Black Tentacles always added. Awakened Mind: Telepathically communicate with any creature you can see within 30 ft in a language you know (doesn't require the creature to share a language).",
  "Entropic Ward: When a creature makes an attack roll against you, use a reaction to impose disadvantage on the roll. If it misses, gain advantage on your next attack against it before end of your next turn. Usable once per short rest.",
  "Thought Shield: Thoughts can't be read by telepathy or similar means unless you allow it. Gain resistance to psychic damage. When a creature deals psychic damage to you, it takes the same amount of psychic damage.",
  "Create Thrall: Touch an incapacitated humanoid to charm it until a Remove Curse spell is cast on it. The charmed creature is friendly to you. While charmed, you have a telepathic link with it as long as you're on the same plane."
);

export const THE_HEXBLADE_PROGRESSION = warlockSheet(
  "the hexblade",
  "Expanded Spells: Shield, Wrathful Smite, Blur, Branding Smite, Blink, Elemental Weapon, Phantasmal Killer, Staggering Smite always added. Hexblade's Curse: Bonus action to curse one creature within 30 ft for 1 minute. Gain bonus to damage rolls against it equal to Proficiency Bonus; spell attacks score a critical hit on 19–20; when it dies, regain HP equal to Warlock level + Charisma modifier. Usable once per short rest. Hex Warrior: Proficiency in medium armor, shields, and martial weapons. Choose one weapon when you finish a long rest—attacks with it use Charisma instead of Strength or Dexterity.",
  "Accursed Specter: When you slay a humanoid, you can cause its spirit to rise as a specter under your control. It adds your Proficiency Bonus to its attack and damage rolls; has HP equal to half its maximum. Specter lasts until long rest.",
  "Armor of Hexes: Once per turn when a target cursed by your Hexblade's Curse hits you with an attack, roll a d6. On 4 or higher, the attack misses regardless of the roll.",
  "Master of Hexes: When a creature cursed by Hexblade's Curse dies, you can apply the curse to a new creature within 30 ft (no action required). You can't do this when the original target was killed by your Accursed Specter."
);

export const THE_UNDYING_PROGRESSION = warlockSheet(
  "the undying",
  "Expanded Spells: False Life, Ray of Sickness, Blindness/Deafness, Silence, Feign Death, Speak with Dead, Aura of Life, Death Ward, Contagion, Legend Lore always added. Among the Dead: Learn Spare the Dying cantrip. Undead have disadvantage on attack rolls against you unless the controlling creature succeeds on a Wisdom save. Defy Death: When you succeed on a death saving throw or stabilize a creature, regain HP equal to 1d8 + Charisma modifier. Usable once per long rest.",
  "Undying Nature: Cease to require food, water, air, and sleep (still take long rests for spell recovery). Can't be aged magically. Immune to disease. Death saving throws don't count normal failures—each roll is independent.",
  "Indestructible Life: Once per short rest, regain 1d8 + Warlock level HP as a bonus action. Additionally, if you have a missing limb, regrow it in 1 minute.",
  "Undying Servitude: Once per long rest, cast Animate Dead without expending a spell slot. Creatures animated this way add your Proficiency Bonus to their attack and damage rolls."
);

export const THE_CELESTIAL_PROGRESSION = warlockSheet(
  "the celestial",
  "Expanded Spells: Cure Wounds, Guiding Bolt, Flaming Sphere, Lesser Restoration, Daylight, Revivify, Guardian of Faith, Wall of Fire, Flame Strike, Greater Restoration always added. Bonus Cantrips: Learn Light and Sacred Flame if not already known. Healing Light: Pool of d6s equal to 1 + Warlock level. Bonus action to heal a creature within 60 ft by spending dice (up to Charisma modifier dice per use). Replenish pool on long rest.",
  "Radiant Soul: Gain resistance to radiant damage. Once per turn, add Charisma modifier to one radiant or fire damage roll of a cantrip or spell.",
  "Celestial Resilience: When you finish a short or long rest, gain temporary HP equal to Warlock level + Charisma modifier. Up to 5 creatures you can see within 30 ft also gain temporary HP equal to half that.",
  "Searing Vengeance: When you start your turn at 0 HP and must make a death save, you can instead spring to your feet—regain HP equal to half your HP maximum, and each creature within 30 ft that you choose takes 2d8 + Charisma modifier radiant damage and is blinded until end of your current turn. Usable once per long rest."
);

export const THE_FATHOMLESS_PROGRESSION = warlockSheet(
  "the fathomless",
  "Expanded Spells: Create or Destroy Water, Thunderwave, Gust of Wind, Silence, Lightning Bolt, Sleet Storm, Control Water, Summon Elemental (water only), Cone of Cold, Commune with Nature always added. Tentacle of the Deeps: Bonus action to summon a spectral tentacle within 10 ft of you. The tentacle lasts for 1 minute; once per turn when you hit with an attack you can deal 1d8 cold damage and reduce the target's speed by 10 ft until start of your next turn. Moves with you on your turn (bonus action). Gift of the Sea: Gain 40 ft swim speed and breathe underwater.",
  "Oceanic Soul: Gain resistance to cold damage. Creatures with a swim speed can understand your speech and you can understand theirs telepathically.",
  "Guardian Coil: When you or a creature within 10 ft of your Tentacle takes damage, use a reaction to reduce that damage by 1d8. Increases as Warlock level rises.",
  "Fathomless Plunge: Action to teleport yourself and up to 5 willing creatures within 30 ft to a body of water within 1 mile that you've seen. All teleport to the water's edge nearest your intended destination. Usable once per short rest."
);

export const THE_GENIE_PROGRESSION = warlockSheet(
  "the genie",
  "Choose a Genie kind (Dao, Djinni, Efreeti, Marid)—determines your Expanded Spell List and damage type. Genie's Vessel: Tiny vessel grants: Bottled Respite (bonus action to enter the vessel as a refuge for Charisma modifier hours; up to 10 ft cube, cast as normal inside), Genie's Wrath (once per turn add Proficiency Bonus damage of your Genie's type to one damage roll).",
  "Elemental Gift: Gain resistance to your Genie's damage type. Fly speed 30 ft (hover), usable for Proficiency Bonus minutes per day (can be split into 1-minute increments).",
  "Sanctuary Vessel: When entering Bottled Respite, invite up to 5 willing creatures with you. Short rest inside takes only 10 minutes. Each creature inside can gain the benefit of a short rest without expending Hit Dice once per long rest.",
  "Limited Wish: Once per 1d4 long rests, you may request the use of a spell of 6th level or lower from any class spell list. Casting time is 1 minute regardless of the spell; no components required; it's cast as if using a spell slot of the appropriate level."
);

export const THE_UNDEAD_PROGRESSION = warlockSheet(
  "the undead",
  "Expanded Spells: Bane, False Life, Blindness/Deafness, Phantasmal Force, Phantom Steed, Speak with Dead, Death Ward, Greater Invisibility, Antilife Shell, Cloudkill always added. Form of Dread: Bonus action to transform for 1 minute: gain temp HP equal to 1d10 + Warlock level; once per turn on hit, make the target frightened of you until end of your next turn (Wisdom save). Immune to frightened while in Form of Dread. Usable Proficiency Bonus times per long rest.",
  "Grave Touched: No longer need to eat, drink, or breathe. Once per turn, when you hit a creature with an attack and are in Form of Dread, replace the attack's damage type with necrotic.",
  "Necrotic Husk: While not in Form of Dread, gain resistance to necrotic damage and immunity to the poisoned condition. While in Form of Dread, upgrade resistance to immunity to necrotic damage.",
  "Spirit Projection: Bonus action, project your spirit from your body. Your body enters unconscious stasis; your spirit can move, cast spells, and use class features. Your spirit deals necrotic damage instead of normal types. While projected, gain resistance to all damage and fly speed equal to walking speed (hover). Lasts 1 hour or until you end it. Usable once per long rest."
);

export const WARLOCK_SUBCLASS_SHEETS: ProgressionSheet[] = [
  THE_FIEND_PROGRESSION,
  THE_ARCHFEY_PROGRESSION,
  THE_GREAT_OLD_ONE_PROGRESSION,
  THE_HEXBLADE_PROGRESSION,
  THE_UNDYING_PROGRESSION,
  THE_CELESTIAL_PROGRESSION,
  THE_FATHOMLESS_PROGRESSION,
  THE_GENIE_PROGRESSION,
  THE_UNDEAD_PROGRESSION,
];
