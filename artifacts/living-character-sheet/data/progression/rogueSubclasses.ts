import type { ProgressionSheet } from "./types";

export const THIEF_PROGRESSION: ProgressionSheet = {
  key: "rogue:thief",
  source: "subclass",
  appliesTo: { class: "rogue", subclass: "thief" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Fast Hands and Second-Story Work reinforce mobility and utility actions.",
      features: [
        { kind: "active_bonus", name: "Fast Hands", description: "You can use the bonus action from Cunning Action to make a Dexterity (Sleight of Hand) check, use thieves' tools to disarm a trap or open a lock, or take the Use an Object action." },
        { kind: "passive", name: "Second-Story Work", description: "Climbing no longer costs extra movement, and your running jump distance increases by a number of feet equal to your Dexterity modifier." },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "Supreme Sneak rewards slow stealth approach with major bonuses.",
      features: [
        { kind: "passive", name: "Supreme Sneak", description: "You have advantage on Dexterity (Stealth) checks if you move no more than half your speed on the same turn." },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "Use Magic Device broadens item attunement and activation access.",
      features: [
        { kind: "passive", name: "Use Magic Device", description: "You ignore class, race, and level requirements on the use of magic items." },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Thief's Reflexes gives an extra first-round turn in combat.",
      features: [
        { kind: "passive", name: "Thief's Reflexes", description: "You can take two turns during the first round of any combat. You take your first turn at your normal initiative and your second turn at initiative minus 10." },
      ],
    },
  ],
};

export const ASSASSIN_PROGRESSION: ProgressionSheet = {
  key: "rogue:assassin",
  source: "subclass",
  appliesTo: { class: "rogue", subclass: "assassin" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Assassinate and disguise/poison proficiencies define the kill-window playstyle.",
      features: [
        { kind: "passive", name: "Assassinate", description: "You have advantage on attack rolls against creatures that haven't taken a turn yet, and any hit against a surprised creature is a critical hit." },
        { kind: "passive", name: "Bonus Proficiencies", description: "You gain proficiency with the disguise kit and the poisoner's kit." },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "Infiltration Expertise improves social-identity insertion play.",
      features: [
        { kind: "active_action", name: "Infiltration Expertise", description: "You can establish a false identity and supporting documents through downtime preparation.", resetsOn: "long_rest" },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "Impostor gives high-confidence mimicry of speech and behavior.",
      features: [
        { kind: "passive", name: "Impostor", description: "You can unerringly mimic another person's speech, writing, and behavior after studying them for at least 3 hours." },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Death Strike massively amplifies surprise-round lethality.",
      features: [
        { kind: "passive", name: "Death Strike", description: "When you attack and hit a surprised creature, it must make a Constitution saving throw. On a failure, double the damage of your attack against it." },
      ],
    },
  ],
};

export const ARCANE_TRICKSTER_PROGRESSION: ProgressionSheet = {
  key: "rogue:arcane trickster",
  source: "subclass",
  appliesTo: { class: "rogue", subclass: "arcane trickster" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Arcane Trickster Spellcasting and Mage Hand Legerdemain define magical trick play.",
      features: [
        { kind: "passive", name: "Arcane Trickster Spellcasting", description: "You gain wizard-based third-caster spell progression, primarily enchantment and illusion with limited off-school picks at specified levels." },
        { kind: "active_action", name: "Mage Hand Legerdemain", description: "Your Mage Hand is improved for stealthy manipulation, lock interaction, and remote sleight of hand." },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "Magical Ambush increases save pressure from hidden casting.",
      features: [
        { kind: "passive", name: "Magical Ambush", description: "If you are hidden from a creature when you cast a spell on it, that creature has disadvantage on any saving throw it makes against the spell this turn." },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "Versatile Trickster converts Mage Hand positioning into advantage.",
      features: [
        { kind: "active_bonus", name: "Versatile Trickster", description: "As a bonus action, designate a creature within 5 feet of your Mage Hand. Attack rolls against that creature have advantage until end of turn." },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Spell Thief allows reactive spell interception and learning.",
      features: [
        { kind: "active_reaction", name: "Spell Thief", description: "When a creature casts a spell targeting you or including you in its area, you can force a save to negate the spell for yourself and potentially steal spell knowledge.", resetsOn: "long_rest" },
      ],
    },
  ],
};

export const INQUISITIVE_PROGRESSION: ProgressionSheet = {
  key: "rogue:inquisitive",
  source: "subclass",
  appliesTo: { class: "rogue", subclass: "inquisitive" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Insight-focused tools enable read-based combat and investigation precision.",
      features: [
        { kind: "passive", name: "Ear for Deceit", description: "When you make an Insight check to determine if a creature is lying, rolls of 7 or lower on the d20 count as 8." },
        { kind: "active_bonus", name: "Eye for Detail", description: "As a bonus action, make a Perception check to spot hidden creatures/objects or an Investigation check to uncover clues." },
        { kind: "active_bonus", name: "Insightful Fighting", description: "As a bonus action, make an Insight check contested by a creature's Deception. On success, you can Sneak Attack that creature without advantage for 1 minute under subclass rules." },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "Steady Eye rewards immobility with superior perception.",
      features: [
        { kind: "passive", name: "Steady Eye", description: "You have advantage on Perception and Investigation checks if you move no more than half your speed on the same turn." },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "Unerring Eye lets you pierce illusions and shapechanging.",
      features: [
        { kind: "active_action", name: "Unerring Eye", description: "As an action, you sense the presence of illusions, shapechanging magic, and other deceptions within range according to subclass rules.", resetsOn: "short_rest" },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Eye for Weakness increases sustained damage against studied targets.",
      features: [
        { kind: "passive", name: "Eye for Weakness", description: "While using Insightful Fighting, your Sneak Attack deals additional damage to the studied target." },
      ],
    },
  ],
};

export const MASTERMIND_PROGRESSION: ProgressionSheet = {
  key: "rogue:mastermind",
  source: "subclass",
  appliesTo: { class: "rogue", subclass: "mastermind" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Social infiltration and ranged Help actions define your tactical support style.",
      features: [
        { kind: "passive", name: "Master of Intrigue", description: "You gain disguise/forgery/language proficiencies and improved mimicry for social infiltration." },
        { kind: "active_bonus", name: "Master of Tactics", description: "You can use the Help action as a bonus action, and when helping an ally attack a creature, the target can be within 30 feet rather than 5 feet." },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "Insightful Manipulator provides capability comparison intel.",
      features: [
        { kind: "active_action", name: "Insightful Manipulator", description: "After at least 1 minute of observation, you can learn whether a creature is your equal, superior, or inferior in certain capability categories.", resetsOn: "short_rest" },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "Misdirection lets you redirect attacks through positional trickery.",
      features: [
        { kind: "active_reaction", name: "Misdirection", description: "When a creature grants you cover against an attacker and the attacker misses you, you can use your reaction to cause the attack to hit the covering creature instead." },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Soul of Deceit makes your thoughts and intent harder to read.",
      features: [
        { kind: "passive", name: "Soul of Deceit", description: "Your thoughts cannot be read by telepathy or similar effects unless you allow it, and you can present false thoughts to probing effects." },
      ],
    },
  ],
};

export const SCOUT_PROGRESSION: ProgressionSheet = {
  key: "rogue:scout",
  source: "subclass",
  appliesTo: { class: "rogue", subclass: "scout" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Skirmisher and Survivalist create a mobile wilderness specialist.",
      features: [
        { kind: "active_reaction", name: "Skirmisher", description: "When an enemy ends its turn within 5 feet of you, you can move up to half your speed as a reaction without provoking opportunity attacks from that creature." },
        { kind: "passive", name: "Survivalist", description: "You gain proficiency and expertise in Nature and Survival if you are proficient." },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "Superior Mobility improves all movement modes.",
      features: [
        { kind: "passive", name: "Superior Mobility", description: "Your walking speed increases by 10 feet, and your climbing and swimming speeds increase by 10 feet if you have them." },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "Ambush Master improves first-contact pressure for your team.",
      features: [
        { kind: "passive", name: "Ambush Master", description: "You gain advantage on initiative rolls, and creatures you hit during the first round of combat become easier for your allies to attack." },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Sudden Strike adds extra pressure when splitting attacks.",
      features: [
        { kind: "active_bonus", name: "Sudden Strike", description: "If you take the Attack action, you can make one additional attack as a bonus action. This extra attack can trigger Sneak Attack against a different target under subclass rules." },
      ],
    },
  ],
};

export const SWASHBUCKLER_PROGRESSION: ProgressionSheet = {
  key: "rogue:swashbuckler",
  source: "subclass",
  appliesTo: { class: "rogue", subclass: "swashbuckler" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Fancy Footwork and Rakish Audacity reinforce duelist mobility and initiative.",
      features: [
        { kind: "passive", name: "Fancy Footwork", description: "During your turn, if you make a melee attack against a creature, that creature cannot make opportunity attacks against you for the rest of your turn." },
        { kind: "passive", name: "Rakish Audacity", description: "You add your Charisma modifier to initiative rolls and can apply Sneak Attack in one-on-one melee situations without advantage under subclass conditions." },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "Panache grants social and combat taunt control.",
      features: [
        { kind: "active_action", name: "Panache", description: "Use a Persuasion check contested by Insight to charm non-hostiles or taunt hostiles into focusing on you under subclass rules." },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "Elegant Maneuver boosts athletic precision in key moments.",
      features: [
        { kind: "active_bonus", name: "Elegant Maneuver", description: "As a bonus action, gain advantage on the next Acrobatics or Athletics check you make during the same turn." },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Master Duelist grants controlled rerolls on key attacks.",
      features: [
        { kind: "active_action", name: "Master Duelist", description: "If you miss with an attack, you can reroll it with advantage once per rest according to subclass rules.", resetsOn: "short_rest" },
      ],
    },
  ],
};

export const PHANTOM_PROGRESSION: ProgressionSheet = {
  key: "rogue:phantom",
  source: "subclass",
  appliesTo: { class: "rogue", subclass: "phantom" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Whispers of the Dead and Wails from the Grave add spirit-linked utility and splash damage.",
      features: [
        { kind: "passive", name: "Whispers of the Dead", description: "After rest-based communion with spirits, gain one skill/tool proficiency of your choice that changes each time you use this feature." },
        { kind: "passive", name: "Wails from the Grave", description: "Immediately after dealing Sneak Attack damage, you can deal necrotic damage to a second creature within range a limited number of times." },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "Tokens of the Departed improves soul-economy utility and scaling.",
      features: [
        { kind: "passive", name: "Tokens of the Departed", description: "You can collect soul trinkets from creatures that die and use them for information, resource recovery, and additional phantom effects under subclass rules." },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "Ghost Walk grants temporary incorporeal movement and resistance tools.",
      features: [
        { kind: "active_bonus", name: "Ghost Walk", description: "As a bonus action, become spectral for 10 minutes, gaining movement through creatures/objects and resistance effects under subclass rules.", resetsOn: "long_rest" },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Death's Friend boosts both Wails and soul-trinket flow.",
      features: [
        { kind: "passive", name: "Death's Friend", description: "Wails from the Grave improves and you gain additional soul-trinket generation utility at this tier." },
      ],
    },
  ],
};

export const SOULKNIFE_PROGRESSION: ProgressionSheet = {
  key: "rogue:soulknife",
  source: "subclass",
  appliesTo: { class: "rogue", subclass: "soulknife" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Psychic Blades and psionic dice define your core attack loop.",
      features: [
        { kind: "active_action", name: "Psychic Blades", description: "When you take the Attack action, you can manifest psychic blades for melee/ranged attacks with a bonus-action off-hand blade option." },
        { kind: "passive", name: "Psionic Power", description: "You gain psionic energy dice used by Psi-Bolstered Knack and Psychic Whispers; dice and recovery scale with level." },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "Soul Blades improves mobility and attack recovery through psionics.",
      features: [
        { kind: "passive", name: "Soul Blades", description: "You can use psionic dice for homing strikes and short-range teleport movement tied to your psychic blades." },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "Psychic Veil adds tactical invisibility windows.",
      features: [
        { kind: "active_action", name: "Psychic Veil", description: "As an action, become invisible for 1 hour or until dismissed/interrupted under subclass rules.", resetsOn: "long_rest" },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Rend Mind converts hit sequences into potent disable pressure.",
      features: [
        { kind: "active_action", name: "Rend Mind", description: "After using Psychic Blades and meeting hit conditions, force a high-impact Wisdom save that can stun the target under subclass rules.", resetsOn: "short_rest" },
      ],
    },
  ],
};

export const ROGUE_SUBCLASS_SHEETS: ProgressionSheet[] = [
  THIEF_PROGRESSION,
  ASSASSIN_PROGRESSION,
  ARCANE_TRICKSTER_PROGRESSION,
  INQUISITIVE_PROGRESSION,
  MASTERMIND_PROGRESSION,
  SCOUT_PROGRESSION,
  SWASHBUCKLER_PROGRESSION,
  PHANTOM_PROGRESSION,
  SOULKNIFE_PROGRESSION,
];