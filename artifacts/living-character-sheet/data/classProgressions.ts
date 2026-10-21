export interface FeatureEntry {
  name: string;
  description: string;
  type: "passive" | "active" | "choice" | "spellcasting";
  actionType?: "action" | "bonus_action" | "reaction" | "free";
  resetsOn?: "short_rest" | "long_rest";
}

export interface LevelEntry {
  level: number;
  features: FeatureEntry[];
  asi?: boolean;
  subclass?: boolean;
  spellSlotsIncrease?: boolean;
  spellsKnownGain?: number;
  cantripsKnownGain?: number;
}

export interface ClassProgressionData {
  class: string;
  spellcastingAbility?: "INT" | "WIS" | "CHA";
  isSpellcaster: boolean;
  casterType?: "full" | "half" | "warlock" | "third";
  spellLearningType?: "known" | "prepared";
  subclassLabel: string;
  subclassLevel: number;
  progression: LevelEntry[];
}

const ARTIFICER: ClassProgressionData = {
  class: "Artificer",
  spellcastingAbility: "INT",
  isSpellcaster: true,
  casterType: "half",
  spellLearningType: "prepared",
  subclassLabel: "Artificer Specialist",
  subclassLevel: 3,
  progression: [
    { level: 1, cantripsKnownGain: 2, spellSlotsIncrease: true, features: [
      { name: "Magical Tinkering", type: "passive", description: "Imbue tiny nonmagical objects with minor magical effects such as light, recorded messages, simple animations, or sensory cues." },
      { name: "Spellcasting", type: "spellcasting", description: "You know 2 cantrips and prepare artificer spells using INT. You can use artisan's tools as a spellcasting focus." },
    ]},
    { level: 2, features: [
      { name: "Infuse Item", type: "choice", description: "Learn infusions and apply them to nonmagical items after a long rest to create temporary magic items." },
    ]},
    { level: 3, subclass: true, spellSlotsIncrease: true, features: [
      { name: "Artificer Specialist", type: "choice", description: "Choose your Specialist (Alchemist, Armorer, Artillerist, or Battle Smith). You gain specialist features now and again at higher levels." },
      { name: "The Right Tool for the Job", type: "passive", description: "With tinker's tools, you can create one set of artisan's tools over a short rest." },
    ]},
    { level: 4, asi: true, features: [] },
    { level: 5, spellSlotsIncrease: true, features: [
      { name: "Specialist Feature", type: "passive", description: "You gain a feature from your chosen Artificer Specialist." },
    ]},
    { level: 6, features: [
      { name: "Tool Expertise", type: "passive", description: "Your proficiency bonus is doubled for checks using any tool with which you are proficient." },
    ]},
    { level: 7, features: [
      { name: "Flash of Genius", type: "active", resetsOn: "long_rest", description: "When you or a creature within 30 feet makes an ability check or saving throw, you can use your reaction to add your INT modifier." },
    ]},
    { level: 8, asi: true, features: [] },
    { level: 9, spellSlotsIncrease: true, features: [
      { name: "Specialist Feature", type: "passive", description: "You gain another feature from your chosen Artificer Specialist." },
    ]},
    { level: 10, features: [
      { name: "Magic Item Adept", type: "passive", description: "Craft common/uncommon magic items faster and attune to up to 4 magic items at once." },
    ]},
    { level: 11, features: [
      { name: "Spell-Storing Item", type: "choice", description: "Store a 1st- or 2nd-level artificer spell in an object so it can be cast repeatedly without expending your spell slots." },
    ]},
    { level: 12, asi: true, features: [] },
    { level: 13, spellSlotsIncrease: true, features: [] },
    { level: 14, features: [
      { name: "Magic Item Savant", type: "passive", description: "Attune to up to 5 magic items and ignore class/race/level attunement requirements." },
      { name: "Specialist Feature", type: "passive", description: "You gain another feature from your chosen Artificer Specialist." },
    ]},
    { level: 15, features: [
      { name: "Specialist Feature", type: "passive", description: "You gain another feature from your chosen Artificer Specialist." },
    ]},
    { level: 16, asi: true, features: [] },
    { level: 17, spellSlotsIncrease: true, features: [] },
    { level: 18, features: [
      { name: "Magic Item Master", type: "passive", description: "Attune to up to 6 magic items at once." },
    ]},
    { level: 19, asi: true, features: [] },
    { level: 20, features: [
      { name: "Soul of Artifice", type: "passive", description: "Gain +1 to all saving throws per attuned magic item and can sacrifice an infusion to stay at 1 HP instead of dropping to 0 HP." },
    ]},
  ],
};

const BLOOD_HUNTER: ClassProgressionData = {
  class: "Blood Hunter",
  isSpellcaster: false,
  subclassLabel: "Order",
  subclassLevel: 3,
  progression: [
    { level: 1, features: [
      { name: "Hunter's Bane", type: "passive", description: "Gain insight and resilience against supernatural creatures, including improved tracking and lore checks." },
      { name: "Crimson Rite", type: "active", description: "Hemocraft empowers your weapon with elemental or arcane damage by sacrificing your vitality." },
    ]},
    { level: 2, features: [
      { name: "Fighting Style", type: "choice", description: "Choose a combat style to specialize in weapon use and battlefield role." },
      { name: "Blood Maledict", type: "active", resetsOn: "short_rest", description: "Invoke blood curses to hinder enemies; amplify effects by taking damage." },
    ]},
    { level: 3, subclass: true, features: [
      { name: "Order", type: "choice", description: "Choose your Order (Ghostslayer, Lycan, Mutant, or Profane Soul), granting core features now and at later levels." },
    ]},
    { level: 4, asi: true, features: [] },
    { level: 5, features: [
      { name: "Extra Attack", type: "passive", description: "You can attack twice when you take the Attack action on your turn." },
    ]},
    { level: 6, features: [
      { name: "Brand of Castigation", type: "active", description: "Brand marked foes to track them and punish movement or escape attempts." },
    ]},
    { level: 7, features: [
      { name: "Order Feature", type: "passive", description: "You gain a feature from your chosen Order." },
    ]},
    { level: 8, asi: true, features: [] },
    { level: 9, features: [
      { name: "Grim Psychometry", type: "passive", description: "Sense lingering supernatural influences and gain insight from locations and objects." },
    ]},
    { level: 10, features: [
      { name: "Dark Augmentation", type: "passive", description: "Gain increased speed and improved physical saving throws via hemocraft-enhanced reflexes." },
    ]},
    { level: 11, features: [
      { name: "Brand of Tethering", type: "passive", description: "Your Brand of Castigation improves and can prevent branded creatures from teleporting or escaping." },
      { name: "Order Feature", type: "passive", description: "You gain a feature from your chosen Order." },
    ]},
    { level: 12, asi: true, features: [] },
    { level: 13, features: [
      { name: "Brand of Axiom", type: "active", description: "Use your brand to disrupt enemy deception, shapechanging, or defensive effects." },
    ]},
    { level: 14, features: [
      { name: "Hardened Soul", type: "passive", description: "Gain stronger mental resilience against fear and charm effects." },
    ]},
    { level: 15, features: [
      { name: "Order Feature", type: "passive", description: "You gain a feature from your chosen Order." },
    ]},
    { level: 16, asi: true, features: [] },
    { level: 17, features: [
      { name: "Blood Curse Improvement", type: "passive", description: "Your blood curses grow in power and can be used more flexibly in combat." },
    ]},
    { level: 18, features: [
      { name: "Order Feature", type: "passive", description: "You gain a feature from your chosen Order." },
    ]},
    { level: 19, asi: true, features: [] },
    { level: 20, features: [
      { name: "Sanguine Mastery", type: "passive", description: "Your hemocraft reaches its apex, improving curse recovery and reducing self-damage costs." },
    ]},
  ],
};

const BARBARIAN: ClassProgressionData = {
  class: "Barbarian",
  isSpellcaster: false,
  subclassLabel: "Primal Path",
  subclassLevel: 3,
  progression: [
    { level: 1, features: [
      { name: "Rage", type: "active", actionType: "bonus_action", resetsOn: "long_rest", description: "Enter a rage for 1 minute. While raging: advantage on STR checks/saves, +2 damage on STR melee attacks, resistance to bludgeoning/piercing/slashing damage. Rages per long rest: 2 (lv1-2), 3 (lv3-5), 4 (lv6-11), 5 (lv12-16), 6 (lv17-19), unlimited (lv20)." },
      { name: "Unarmored Defense", type: "passive", description: "While not wearing armor, your AC equals 10 + DEX modifier + CON modifier. You can use a shield and still gain this benefit." },
    ]},
    { level: 2, features: [
      { name: "Reckless Attack", type: "active", description: "When you make your first attack on your turn, you can attack recklessly — you have advantage on all melee weapon attack rolls during this turn, but attack rolls against you have advantage until your next turn." },
      { name: "Danger Sense", type: "passive", description: "You have advantage on DEX saving throws against effects you can see, such as traps and spells, while not blinded, deafened, or incapacitated." },
    ]},
    { level: 3, subclass: true, features: [
      { name: "Primal Path", type: "choice", description: "Choose your Primal Path subclass, which grants features at levels 3, 6, 10, and 14. Options include Path of the Berserker, Path of the Totem Warrior, Path of the Battlerager, and more." },
    ]},
    { level: 4, asi: true, features: [] },
    { level: 5, features: [
      { name: "Extra Attack", type: "passive", description: "You can attack twice instead of once when you take the Attack action on your turn." },
      { name: "Fast Movement", type: "passive", description: "Your speed increases by 10 feet while you aren't wearing heavy armor." },
    ]},
    { level: 6, features: [
      { name: "Path Feature", type: "passive", description: "You gain a feature from your chosen Primal Path." },
    ]},
    { level: 7, features: [
      { name: "Feral Instinct", type: "passive", description: "You have advantage on initiative rolls. If you are surprised at the start of combat, you can still act on your first turn if you enter your rage before doing anything else." },
    ]},
    { level: 8, asi: true, features: [] },
    { level: 9, features: [
      { name: "Brutal Critical", type: "passive", description: "You can roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack. This increases to two additional dice at level 13 and three at level 17." },
    ]},
    { level: 10, features: [
      { name: "Path Feature", type: "passive", description: "You gain a feature from your chosen Primal Path." },
    ]},
    { level: 11, features: [
      { name: "Relentless Rage", type: "passive", description: "If you drop to 0 HP while raging and don't die, you can make a DC 10 CON save (DC increases by 5 each time you use this). On success you drop to 1 HP instead. Reset on short or long rest." },
    ]},
    { level: 12, asi: true, features: [] },
    { level: 13, features: [
      { name: "Brutal Critical (2 dice)", type: "passive", description: "You now roll two additional weapon damage dice on a critical hit melee attack." },
    ]},
    { level: 14, features: [
      { name: "Path Feature", type: "passive", description: "You gain a feature from your chosen Primal Path." },
    ]},
    { level: 15, features: [
      { name: "Persistent Rage", type: "passive", description: "Your rage can no longer be ended early by the normal conditions (not attacking / not taking damage). Your rage now ends only when you choose to end it or you fall unconscious." },
    ]},
    { level: 16, asi: true, features: [] },
    { level: 17, features: [
      { name: "Brutal Critical (3 dice)", type: "passive", description: "You now roll three additional weapon damage dice on a critical hit melee attack." },
    ]},
    { level: 18, features: [
      { name: "Indomitable Might", type: "passive", description: "If your total for a STR check is less than your STR score, you can use your STR score in place of the total." },
    ]},
    { level: 19, asi: true, features: [] },
    { level: 20, features: [
      { name: "Primal Champion", type: "passive", description: "Your STR score increases by 4 and your CON score increases by 4. Your maximum for those scores also increases by 4." },
    ]},
  ],
};

const BARD: ClassProgressionData = {
  class: "Bard",
  spellcastingAbility: "CHA",
  isSpellcaster: true,
  casterType: "full",
  spellLearningType: "known",
  subclassLabel: "Bard College",
  subclassLevel: 3,
  progression: [
    { level: 1, cantripsKnownGain: 2, spellsKnownGain: 4, spellSlotsIncrease: true, features: [
      { name: "Spellcasting", type: "spellcasting", description: "You know 2 cantrips and 4 bard spells. CHA is your spellcasting ability." },
      { name: "Bardic Inspiration", type: "active", actionType: "bonus_action", resetsOn: "long_rest", description: "As a bonus action, give a creature within 60 ft a d6 Bardic Inspiration die. They can add it to one ability check, attack, or saving throw in the next 10 minutes. You have CHA modifier (min 1) uses. At 5th level: d8; 10th: d10; 15th: d12." },
    ]},
    { level: 2, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Jack of All Trades", type: "passive", description: "You can add half your proficiency bonus (rounded down) to any ability check that doesn't already use your proficiency bonus." },
      { name: "Song of Rest", type: "passive", description: "During a short rest, you can use soothing music or oration to help allies expend hit dice. Each creature that hears you regains an extra 1d6 HP. Increases to d8 at 9th, d10 at 13th, d12 at 17th." },
    ]},
    { level: 3, subclass: true, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Bard College", type: "choice", description: "Choose your Bard College (College of Lore, Valor, Glamour, Swords, Whispers, Eloquence, etc.). Grants features at levels 3, 6, and 14." },
      { name: "Expertise", type: "passive", description: "Choose two skill proficiencies or a skill and Thieves' Tools. Your proficiency bonus is doubled for those skills." },
    ]},
    { level: 4, asi: true, cantripsKnownGain: 1, spellsKnownGain: 1, features: [] },
    { level: 5, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Bardic Inspiration (d8)", type: "passive", description: "Your Bardic Inspiration die improves to a d8. Also: Font of Inspiration — you now regain Bardic Inspiration uses on a short or long rest." },
      { name: "Font of Inspiration", type: "passive", description: "You regain Bardic Inspiration uses on a short or long rest (instead of only long rest)." },
    ]},
    { level: 6, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Countercharm", type: "active", actionType: "action", description: "You can start a performance as an action. Until the end of your next turn, any friendly creature within 30 ft that can hear you has advantage on saves against being frightened or charmed." },
      { name: "Bard College Feature", type: "passive", description: "You gain a feature from your chosen Bard College." },
    ]},
    { level: 7, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 8, asi: true, spellsKnownGain: 1, features: [] },
    { level: 9, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Song of Rest (d8)", type: "passive", description: "Your Song of Rest die improves to a d8." },
    ]},
    { level: 10, cantripsKnownGain: 1, spellsKnownGain: 2, spellSlotsIncrease: true, features: [
      { name: "Bardic Inspiration (d10)", type: "passive", description: "Your Bardic Inspiration die improves to a d10." },
      { name: "Expertise (2nd)", type: "passive", description: "You choose two more skills to gain expertise in." },
      { name: "Magical Secrets", type: "choice", description: "Choose 2 spells from any class spell list. They count as bard spells for you. You can do this again at 14th and 18th level." },
    ]},
    { level: 11, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 12, asi: true, features: [] },
    { level: 13, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Song of Rest (d10)", type: "passive", description: "Your Song of Rest die improves to a d10." },
    ]},
    { level: 14, spellsKnownGain: 1, features: [
      { name: "Magical Secrets (2nd)", type: "choice", description: "Choose 2 more spells from any class spell list." },
      { name: "Bard College Feature", type: "passive", description: "You gain a feature from your chosen Bard College." },
    ]},
    { level: 15, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Bardic Inspiration (d12)", type: "passive", description: "Your Bardic Inspiration die improves to a d12." },
    ]},
    { level: 16, asi: true, features: [] },
    { level: 17, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Song of Rest (d12)", type: "passive", description: "Your Song of Rest die improves to a d12." },
    ]},
    { level: 18, spellsKnownGain: 2, features: [
      { name: "Magical Secrets (3rd)", type: "choice", description: "Choose 2 more spells from any class spell list." },
    ]},
    { level: 19, asi: true, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 20, spellsKnownGain: 1, features: [
      { name: "Superior Inspiration", type: "passive", description: "When you roll initiative and have no uses of Bardic Inspiration left, you regain one use." },
    ]},
  ],
};

const CLERIC: ClassProgressionData = {
  class: "Cleric",
  spellcastingAbility: "WIS",
  isSpellcaster: true,
  casterType: "full",
  spellLearningType: "prepared",
  subclassLabel: "Divine Domain",
  subclassLevel: 1,
  progression: [
    { level: 1, subclass: true, cantripsKnownGain: 3, spellSlotsIncrease: true, features: [
      { name: "Spellcasting", type: "spellcasting", description: "You know 3 cantrips and can prepare WIS mod + level cleric spells each day. WIS is your spellcasting ability." },
      { name: "Divine Domain", type: "choice", description: "Choose your Divine Domain (Life, Light, Knowledge, Nature, Tempest, Trickery, War, Forge, Grave, Order, Peace, Twilight, etc.). Grants domain spells and features at 1, 2, 6, 8, and 17." },
    ]},
    { level: 2, spellSlotsIncrease: true, features: [
      { name: "Channel Divinity (1/rest)", type: "active", actionType: "action", resetsOn: "short_rest", description: "Use Channel Divinity once per short/long rest. All clerics can Turn Undead; your domain grants additional options." },
      { name: "Turn Undead", type: "active", actionType: "action", resetsOn: "short_rest", description: "Each undead within 30 ft must make a WIS save. Failed: the creature is turned for 1 minute or until it takes damage." },
    ]},
    { level: 3, spellSlotsIncrease: true, features: [] },
    { level: 4, asi: true, cantripsKnownGain: 1, features: [] },
    { level: 5, spellSlotsIncrease: true, features: [
      { name: "Destroy Undead (CR 1/2)", type: "passive", description: "When an undead fails its save against your Turn Undead and its CR is 1/2 or lower, it is instantly destroyed." },
    ]},
    { level: 6, spellSlotsIncrease: true, features: [
      { name: "Channel Divinity (2/rest)", type: "passive", description: "You can now use Channel Divinity twice per short/long rest." },
      { name: "Domain Feature", type: "passive", description: "You gain a feature from your chosen Divine Domain." },
    ]},
    { level: 7, spellSlotsIncrease: true, features: [] },
    { level: 8, asi: true, features: [
      { name: "Destroy Undead (CR 1)", type: "passive", description: "Your Destroy Undead now affects undead of CR 1 or lower." },
      { name: "Domain Feature", type: "passive", description: "You gain a feature from your chosen Divine Domain." },
    ]},
    { level: 9, spellSlotsIncrease: true, features: [] },
    { level: 10, cantripsKnownGain: 1, features: [
      { name: "Divine Intervention", type: "active", actionType: "action", resetsOn: "long_rest", description: "Implore your deity to intervene. Roll percentile dice — if the result is equal to or lower than your cleric level, your deity intervenes. At 20th level, it succeeds automatically." },
    ]},
    { level: 11, spellSlotsIncrease: true, features: [
      { name: "Destroy Undead (CR 2)", type: "passive", description: "Your Destroy Undead now affects undead of CR 2 or lower." },
    ]},
    { level: 12, asi: true, features: [] },
    { level: 13, spellSlotsIncrease: true, features: [] },
    { level: 14, features: [
      { name: "Destroy Undead (CR 3)", type: "passive", description: "Your Destroy Undead now affects undead of CR 3 or lower." },
      { name: "Domain Feature", type: "passive", description: "You gain a feature from your chosen Divine Domain." },
    ]},
    { level: 15, spellSlotsIncrease: true, features: [] },
    { level: 16, asi: true, features: [] },
    { level: 17, spellSlotsIncrease: true, features: [
      { name: "Destroy Undead (CR 4)", type: "passive", description: "Your Destroy Undead now affects undead of CR 4 or lower." },
      { name: "Domain Feature", type: "passive", description: "You gain a feature from your chosen Divine Domain." },
    ]},
    { level: 18, features: [
      { name: "Channel Divinity (3/rest)", type: "passive", description: "You can now use Channel Divinity three times per short/long rest." },
    ]},
    { level: 19, asi: true, spellSlotsIncrease: true, features: [] },
    { level: 20, features: [
      { name: "Divine Intervention (Guaranteed)", type: "passive", description: "When you use Divine Intervention, it now succeeds automatically — no roll required." },
    ]},
  ],
};

const DRUID: ClassProgressionData = {
  class: "Druid",
  spellcastingAbility: "WIS",
  isSpellcaster: true,
  casterType: "full",
  spellLearningType: "prepared",
  subclassLabel: "Druid Circle",
  subclassLevel: 2,
  progression: [
    { level: 1, cantripsKnownGain: 2, spellSlotsIncrease: true, features: [
      { name: "Druidic", type: "passive", description: "You know Druidic, the secret language of druids. You can speak it and leave hidden messages in nature detectable only by druids." },
      { name: "Spellcasting", type: "spellcasting", description: "You know 2 cantrips and can prepare WIS mod + level druid spells each day. WIS is your spellcasting ability." },
    ]},
    { level: 2, subclass: true, spellSlotsIncrease: true, features: [
      { name: "Wild Shape", type: "active", actionType: "action", resetsOn: "short_rest", description: "Transform into a beast you have seen (CR 1/4, no fly/swim at lv2). Twice per short rest. At lv4: CR 1/2 (swim), lv8: CR 1 (fly). You retain your INT/WIS/CHA and class features, use beast stats otherwise. Lasts 2× druid level hours." },
      { name: "Druid Circle", type: "choice", description: "Choose your Druid Circle (Circle of the Land, Moon, Dreams, Shepherd, Spores, Stars, Wildfire, etc.). Grants features at 2, 6, 10, and 14." },
    ]},
    { level: 3, spellSlotsIncrease: true, features: [] },
    { level: 4, asi: true, cantripsKnownGain: 1, features: [
      { name: "Wild Shape Improvement", type: "passive", description: "Your Wild Shape CR limit increases to 1/2 and you can now assume a beast form with a swimming speed." },
    ]},
    { level: 5, spellSlotsIncrease: true, features: [] },
    { level: 6, spellSlotsIncrease: true, features: [
      { name: "Druid Circle Feature", type: "passive", description: "You gain a feature from your chosen Druid Circle." },
    ]},
    { level: 7, spellSlotsIncrease: true, features: [] },
    { level: 8, asi: true, features: [
      { name: "Wild Shape Improvement (Fly)", type: "passive", description: "Your Wild Shape CR limit increases to 1 and you can now assume a beast form with a flying speed." },
    ]},
    { level: 9, spellSlotsIncrease: true, features: [] },
    { level: 10, features: [
      { name: "Druid Circle Feature", type: "passive", description: "You gain a feature from your chosen Druid Circle." },
    ]},
    { level: 11, spellSlotsIncrease: true, features: [] },
    { level: 12, asi: true, features: [] },
    { level: 13, spellSlotsIncrease: true, features: [] },
    { level: 14, features: [
      { name: "Druid Circle Feature", type: "passive", description: "You gain a feature from your chosen Druid Circle." },
    ]},
    { level: 15, spellSlotsIncrease: true, features: [] },
    { level: 16, asi: true, features: [] },
    { level: 17, spellSlotsIncrease: true, features: [] },
    { level: 18, features: [
      { name: "Timeless Body", type: "passive", description: "The primal magic makes you age more slowly. For every 10 years that pass, your body ages only 1 year." },
      { name: "Beast Spells", type: "passive", description: "You can cast druid spells in your beast form, as long as the spell doesn't require material components." },
    ]},
    { level: 19, asi: true, spellSlotsIncrease: true, features: [] },
    { level: 20, features: [
      { name: "Archdruid", type: "passive", description: "You can use your Wild Shape an unlimited number of times. Additionally, you can ignore the verbal and somatic components of your druid spells when in beast form." },
    ]},
  ],
};

const FIGHTER: ClassProgressionData = {
  class: "Fighter",
  isSpellcaster: false,
  subclassLabel: "Martial Archetype",
  subclassLevel: 3,
  progression: [
    { level: 1, features: [
      { name: "Fighting Style", type: "choice", description: "Choose a fighting style: Archery (+2 ranged attack rolls), Defense (+1 AC in armor), Dueling (+2 melee damage one-handed), Great Weapon Fighting (reroll 1s/2s on damage with 2H), Protection (impose disadvantage on attacks vs adjacent allies), Two-Weapon Fighting (add ability mod to off-hand attacks), Blind Fighting, Thrown Weapon Fighting, Interception, Superior Technique, Unarmed Fighting." },
      { name: "Second Wind", type: "active", actionType: "bonus_action", resetsOn: "short_rest", description: "Regain 1d10 + fighter level HP as a bonus action. Once per short or long rest." },
    ]},
    { level: 2, features: [
      { name: "Action Surge", type: "active", actionType: "free", resetsOn: "short_rest", description: "Take one additional action on your turn. Once per short or long rest (twice at 17th level)." },
    ]},
    { level: 3, subclass: true, features: [
      { name: "Martial Archetype", type: "choice", description: "Choose your Martial Archetype (Champion, Battle Master, Eldritch Knight, Arcane Archer, Cavalier, Echo Knight, Psi Warrior, Rune Knight, Samurai, etc.). Grants features at 3, 7, 10, 15, and 18." },
    ]},
    { level: 4, asi: true, features: [] },
    { level: 5, features: [
      { name: "Extra Attack", type: "passive", description: "You can attack twice instead of once when you take the Attack action on your turn." },
    ]},
    { level: 6, asi: true, features: [] },
    { level: 7, features: [
      { name: "Archetype Feature", type: "passive", description: "You gain a feature from your chosen Martial Archetype." },
    ]},
    { level: 8, asi: true, features: [] },
    { level: 9, features: [
      { name: "Indomitable (1/rest)", type: "active", resetsOn: "long_rest", description: "Reroll a saving throw. You must use the new roll. Once per long rest (twice at 13th, three times at 17th)." },
    ]},
    { level: 10, features: [
      { name: "Archetype Feature", type: "passive", description: "You gain a feature from your chosen Martial Archetype." },
    ]},
    { level: 11, features: [
      { name: "Extra Attack (2)", type: "passive", description: "You can attack three times whenever you take the Attack action on your turn." },
    ]},
    { level: 12, asi: true, features: [] },
    { level: 13, features: [
      { name: "Indomitable (2/rest)", type: "passive", description: "You can now use Indomitable twice per long rest." },
    ]},
    { level: 14, asi: true, features: [] },
    { level: 15, features: [
      { name: "Archetype Feature", type: "passive", description: "You gain a feature from your chosen Martial Archetype." },
    ]},
    { level: 16, asi: true, features: [] },
    { level: 17, features: [
      { name: "Action Surge (2/rest)", type: "passive", description: "You can now use Action Surge twice per short or long rest." },
      { name: "Indomitable (3/rest)", type: "passive", description: "You can now use Indomitable three times per long rest." },
    ]},
    { level: 18, features: [
      { name: "Archetype Feature", type: "passive", description: "You gain a feature from your chosen Martial Archetype." },
    ]},
    { level: 19, asi: true, features: [] },
    { level: 20, features: [
      { name: "Extra Attack (3)", type: "passive", description: "You can attack four times whenever you take the Attack action on your turn." },
    ]},
  ],
};

const MONK: ClassProgressionData = {
  class: "Monk",
  isSpellcaster: false,
  subclassLabel: "Monastic Tradition",
  subclassLevel: 3,
  progression: [
    { level: 1, features: [
      { name: "Unarmored Defense", type: "passive", description: "While not wearing armor or wielding a shield, your AC equals 10 + DEX modifier + WIS modifier." },
      { name: "Martial Arts", type: "passive", description: "Use DEX instead of STR for unarmed strikes and monk weapons. Roll a d4 (increases with level: d6 at 5, d8 at 11, d10 at 17) instead of normal damage. When you use the Attack action with a monk weapon or unarmed strike, you can make one unarmed strike as a bonus action." },
    ]},
    { level: 2, features: [
      { name: "Ki", type: "active", resetsOn: "short_rest", description: "You have ki points equal to your monk level (2 at 2nd level). You can spend ki to fuel special features. Recharges on short or long rest. Save DC = 8 + prof + WIS mod." },
      { name: "Flurry of Blows", type: "active", actionType: "bonus_action", description: "Immediately after taking the Attack action, spend 1 ki point to make 2 unarmed strikes as a bonus action." },
      { name: "Patient Defense", type: "active", actionType: "bonus_action", description: "Spend 1 ki point to take the Dodge action as a bonus action." },
      { name: "Step of the Wind", type: "active", actionType: "bonus_action", description: "Spend 1 ki point to take the Disengage or Dash action as a bonus action. Your jump distance is also doubled for the turn." },
      { name: "Unarmored Movement (+10 ft)", type: "passive", description: "Your speed increases by 10 feet while not wearing armor or wielding a shield. Increases at higher levels." },
    ]},
    { level: 3, subclass: true, features: [
      { name: "Monastic Tradition", type: "choice", description: "Choose your Monastic Tradition (Way of the Open Hand, Shadow, Four Elements, Sun Soul, Drunken Master, Kensei, Mercy, Astral Self, etc.). Grants features at 3, 6, 11, and 17." },
      { name: "Deflect Missiles", type: "active", actionType: "reaction", description: "When hit by a ranged weapon attack, use a reaction to reduce damage by 1d10 + DEX mod + monk level. If reduced to 0, you catch the missile and can throw it back as a ranged attack (spending 1 ki point) for 1d6 + DEX mod damage." },
      { name: "Slow Fall", type: "active", actionType: "reaction", description: "Use a reaction to reduce fall damage by an amount equal to 5 × your monk level." },
    ]},
    { level: 4, asi: true, features: [
      { name: "Stunning Strike", type: "active", description: "When you hit a creature with a melee weapon attack, spend 1 ki point to attempt to stun it. The target must make a CON save or be stunned until the end of your next turn." },
    ]},
    { level: 5, features: [
      { name: "Extra Attack", type: "passive", description: "You can attack twice instead of once when you take the Attack action on your turn." },
      { name: "Stunning Strike", type: "passive", description: "Stunning Strike was gained at 4th level — now fully available with your extra attack." },
      { name: "Ki-Empowered Strikes", type: "passive", description: "Your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage." },
    ]},
    { level: 6, features: [
      { name: "Monastic Tradition Feature", type: "passive", description: "You gain a feature from your chosen Monastic Tradition." },
      { name: "Unarmored Movement (+15 ft)", type: "passive", description: "Your Unarmored Movement speed bonus increases to +15 feet." },
    ]},
    { level: 7, features: [
      { name: "Evasion", type: "passive", description: "When you are subjected to an effect that allows a DEX saving throw for half damage, you instead take no damage on a success, and only half damage on a failure. Not while incapacitated." },
      { name: "Stillness of Mind", type: "active", actionType: "action", description: "You can end one effect on yourself that is causing you to be charmed or frightened." },
    ]},
    { level: 8, asi: true, features: [] },
    { level: 9, features: [
      { name: "Unarmored Movement (vertical surfaces)", type: "passive", description: "You gain the ability to move along vertical surfaces and across liquids without falling during your move." },
      { name: "Martial Arts (d6)", type: "passive", description: "Your Martial Arts die increases to d6." },
    ]},
    { level: 10, features: [
      { name: "Purity of Body", type: "passive", description: "Your mastery of ki gives you immunity to disease and poison." },
      { name: "Unarmored Movement (+20 ft)", type: "passive", description: "Your Unarmored Movement speed bonus increases to +20 feet." },
    ]},
    { level: 11, features: [
      { name: "Monastic Tradition Feature", type: "passive", description: "You gain a feature from your chosen Monastic Tradition." },
    ]},
    { level: 12, asi: true, features: [] },
    { level: 13, features: [
      { name: "Tongue of the Sun and Moon", type: "passive", description: "You learn to touch the ki of other minds, allowing you to understand all spoken languages and be understood by any creature that speaks at least one language." },
      { name: "Unarmored Movement (+25 ft)", type: "passive", description: "Your Unarmored Movement speed bonus increases to +25 feet." },
    ]},
    { level: 14, features: [
      { name: "Diamond Soul", type: "passive", description: "You gain proficiency in all saving throws. Additionally, whenever you fail a saving throw, you can spend 1 ki point to reroll it and take the second result." },
      { name: "Unarmored Movement (+30 ft)", type: "passive", description: "Your Unarmored Movement speed bonus increases to +30 feet." },
    ]},
    { level: 15, features: [
      { name: "Timeless Body", type: "passive", description: "Your ki sustains you so that you suffer none of the frailty of old age. You can't be aged magically. You still die of old age, but you no longer need food or water." },
      { name: "Martial Arts (d8)", type: "passive", description: "Your Martial Arts die increases to d8." },
    ]},
    { level: 16, asi: true, features: [] },
    { level: 17, features: [
      { name: "Monastic Tradition Feature", type: "passive", description: "You gain a feature from your chosen Monastic Tradition." },
      { name: "Unarmored Movement (+35 ft)", type: "passive", description: "Your Unarmored Movement speed bonus increases to +35 feet." },
    ]},
    { level: 18, features: [
      { name: "Empty Body", type: "active", actionType: "action", description: "Spend 4 ki points to become invisible for 1 minute. During that time, you have resistance to all damage except force. Additionally, you can spend 8 ki points to cast the Astral Projection spell, affecting only yourself." },
      { name: "Unarmored Movement (+40 ft)", type: "passive", description: "Your Unarmored Movement speed bonus increases to +40 feet." },
    ]},
    { level: 19, asi: true, features: [] },
    { level: 20, features: [
      { name: "Perfect Self", type: "passive", description: "When you roll for initiative and have no ki points remaining, you regain 4 ki points." },
      { name: "Martial Arts (d10)", type: "passive", description: "Your Martial Arts die increases to d10." },
    ]},
  ],
};

const PALADIN: ClassProgressionData = {
  class: "Paladin",
  spellcastingAbility: "CHA",
  isSpellcaster: true,
  casterType: "half",
  spellLearningType: "prepared",
  subclassLabel: "Sacred Oath",
  subclassLevel: 3,
  progression: [
    { level: 1, features: [
      { name: "Divine Sense", type: "active", actionType: "action", resetsOn: "long_rest", description: "Until the end of your next turn, know the location of any celestial, fiend, or undead within 60 ft (not behind total cover). Also detects consecrated/desecrated objects. Uses: 1 + CHA modifier per long rest." },
      { name: "Lay on Hands", type: "active", actionType: "action", resetsOn: "long_rest", description: "Touch a creature to restore HP from your pool of 5 × paladin level HP. Can also spend 5 HP from pool to cure a disease or neutralize one poison." },
    ]},
    { level: 2, spellSlotsIncrease: true, features: [
      { name: "Fighting Style", type: "choice", description: "Choose a fighting style: Defense, Dueling, Great Weapon Fighting, Protection, Blessed Warrior, Blind Fighting, Interception." },
      { name: "Spellcasting", type: "spellcasting", description: "You can prepare CHA mod + half your paladin level spells. CHA is your spellcasting ability." },
      { name: "Divine Smite", type: "active", description: "When you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target (2d8 + 1d8 per slot level above 1st, max +5d8). +1d8 vs undead or fiends. Max 6d8." },
    ]},
    { level: 3, subclass: true, spellSlotsIncrease: true, features: [
      { name: "Divine Health", type: "passive", description: "The divine magic flowing through you makes you immune to disease." },
      { name: "Sacred Oath", type: "choice", description: "Choose your Sacred Oath (Devotion, Ancients, Vengeance, Conquest, Redemption, Glory, Watchers, Oathbreaker, Crown). Grants Oath Spells and Channel Divinity options. Features at 3, 7, 15, and 20." },
      { name: "Channel Divinity (1/rest)", type: "active", actionType: "action", resetsOn: "short_rest", description: "Use a Channel Divinity option granted by your Sacred Oath. Sacred Weapon or Turn the Unholy for Oath of Devotion as examples." },
    ]},
    { level: 4, asi: true, spellSlotsIncrease: true, features: [] },
    { level: 5, spellSlotsIncrease: true, features: [
      { name: "Extra Attack", type: "passive", description: "You can attack twice instead of once when you take the Attack action on your turn." },
    ]},
    { level: 6, features: [
      { name: "Aura of Protection", type: "passive", description: "While conscious, you and friendly creatures within 10 ft add your CHA modifier (min +1) to saving throws. At 18th level, the aura extends to 30 ft." },
    ]},
    { level: 7, spellSlotsIncrease: true, features: [
      { name: "Sacred Oath Feature", type: "passive", description: "You gain a feature from your Sacred Oath." },
    ]},
    { level: 8, asi: true, features: [] },
    { level: 9, spellSlotsIncrease: true, features: [] },
    { level: 10, features: [
      { name: "Aura of Courage", type: "passive", description: "While conscious, you and friendly creatures within 10 ft can't be frightened. At 18th level, extends to 30 ft." },
    ]},
    { level: 11, features: [
      { name: "Improved Divine Smite", type: "passive", description: "Whenever you hit a creature with a melee weapon, you deal an extra 1d8 radiant damage (in addition to your Divine Smite bonus)." },
    ]},
    { level: 12, asi: true, spellSlotsIncrease: true, features: [] },
    { level: 13, spellSlotsIncrease: true, features: [] },
    { level: 14, features: [
      { name: "Cleansing Touch", type: "active", actionType: "action", resetsOn: "long_rest", description: "End one spell on yourself or, by touch, on one willing creature. Uses: CHA modifier (min 1) per long rest." },
    ]},
    { level: 15, features: [
      { name: "Sacred Oath Feature", type: "passive", description: "You gain a feature from your Sacred Oath." },
    ]},
    { level: 16, asi: true, spellSlotsIncrease: true, features: [] },
    { level: 17, spellSlotsIncrease: true, features: [] },
    { level: 18, features: [
      { name: "Aura Improvements", type: "passive", description: "Your Aura of Protection and Aura of Courage now extend to 30 feet instead of 10 feet." },
    ]},
    { level: 19, asi: true, spellSlotsIncrease: true, features: [] },
    { level: 20, features: [
      { name: "Sacred Oath Capstone", type: "passive", description: "You gain the 20th-level capstone feature from your Sacred Oath." },
    ]},
  ],
};

const RANGER: ClassProgressionData = {
  class: "Ranger",
  spellcastingAbility: "WIS",
  isSpellcaster: true,
  casterType: "half",
  spellLearningType: "known",
  subclassLabel: "Ranger Archetype",
  subclassLevel: 3,
  progression: [
    { level: 1, features: [
      { name: "Favored Enemy", type: "passive", description: "Choose a type of favored enemy: aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants, or undead (or two humanoid races). Advantage on Survival checks to track and on INT checks to recall information. You learn one language spoken by them." },
      { name: "Natural Explorer", type: "passive", description: "Choose a favored terrain type. When in that terrain: double proficiency on related INT/WIS checks, difficult terrain doesn't slow your group, always alert to danger, excellent at foraging and navigation. Extra benefits while traveling." },
    ]},
    { level: 2, spellSlotsIncrease: true, spellsKnownGain: 2, features: [
      { name: "Fighting Style", type: "choice", description: "Choose a fighting style: Archery, Defense, Dueling, Two-Weapon Fighting, Blind Fighting, Druidic Warrior, Thrown Weapon." },
      { name: "Spellcasting", type: "spellcasting", description: "You know 2 ranger spells. WIS is your spellcasting ability." },
    ]},
    { level: 3, subclass: true, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Ranger Archetype", type: "choice", description: "Choose your Ranger Archetype (Hunter, Beast Master, Gloom Stalker, Horizon Walker, Monster Slayer, Fey Wanderer, Swarmkeeper). Features at 3, 7, 11, and 15." },
      { name: "Primeval Awareness", type: "active", actionType: "action", description: "Expend a spell slot to sense within 1 mile (6 miles in your favored terrain) if any aberrations, celestials, dragons, elementals, fey, fiends, or undead are present for 1 minute per spell level." },
    ]},
    { level: 4, asi: true, spellsKnownGain: 1, features: [] },
    { level: 5, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Extra Attack", type: "passive", description: "You can attack twice instead of once when you take the Attack action on your turn." },
    ]},
    { level: 6, spellsKnownGain: 1, features: [
      { name: "Favored Enemy Improvement", type: "passive", description: "You choose one additional favored enemy and one additional language for them." },
      { name: "Natural Explorer Improvement", type: "passive", description: "You choose one additional favored terrain." },
    ]},
    { level: 7, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Ranger Archetype Feature", type: "passive", description: "You gain a feature from your chosen Ranger Archetype." },
    ]},
    { level: 8, asi: true, spellsKnownGain: 1, features: [
      { name: "Land's Stride", type: "passive", description: "Moving through nonmagical difficult terrain costs you no extra movement. You can also pass through nonmagical plants without being slowed and without damage (thorns/briars). Advantage on saves vs magically created or manipulated plants." },
    ]},
    { level: 9, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 10, spellsKnownGain: 1, features: [
      { name: "Natural Explorer Improvement", type: "passive", description: "You choose one additional favored terrain." },
      { name: "Hide in Plain Sight", type: "active", description: "Spend 1 minute to camouflage yourself. You can try to hide against natural surfaces as long as you remain still. Gain +10 to Stealth checks while motionless." },
    ]},
    { level: 11, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Ranger Archetype Feature", type: "passive", description: "You gain a feature from your chosen Ranger Archetype." },
    ]},
    { level: 12, asi: true, spellsKnownGain: 1, features: [] },
    { level: 13, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 14, spellsKnownGain: 1, features: [
      { name: "Favored Enemy Improvement", type: "passive", description: "You choose one additional favored enemy and one additional language." },
      { name: "Vanish", type: "passive", description: "You can use the Hide action as a bonus action on your turn. Also, you can't be tracked by nonmagical means unless you choose to leave a trail." },
    ]},
    { level: 15, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Ranger Archetype Feature", type: "passive", description: "You gain a feature from your chosen Ranger Archetype." },
    ]},
    { level: 16, asi: true, spellsKnownGain: 1, features: [] },
    { level: 17, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 18, spellsKnownGain: 1, features: [
      { name: "Feral Senses", type: "passive", description: "You gain preternatural senses that help you fight creatures you can't see. No disadvantage from being blinded or when attacking invisible/unseen creatures. You're also aware of invisible creatures within 30 ft if you aren't blinded or deafened." },
    ]},
    { level: 19, asi: true, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 20, spellsKnownGain: 1, features: [
      { name: "Foe Slayer", type: "passive", description: "You become an unparalleled hunter. Once on each of your turns, you can add your WIS modifier to either the attack roll or the damage roll of an attack you make against your favored enemy." },
    ]},
  ],
};

const ROGUE: ClassProgressionData = {
  class: "Rogue",
  isSpellcaster: false,
  subclassLabel: "Roguish Archetype",
  subclassLevel: 3,
  progression: [
    { level: 1, features: [
      { name: "Expertise", type: "passive", description: "Choose two skill proficiencies or a skill and Thieves' Tools. Your proficiency bonus is doubled for those skills." },
      { name: "Sneak Attack", type: "passive", description: "Once per turn, you can deal extra 1d6 damage when you hit with a finesse or ranged weapon and have advantage on the roll (or an ally is adjacent to the target). Increases by 1d6 every odd level (1d6 at 1, 2d6 at 3, 3d6 at 5, etc.)." },
      { name: "Thieves' Cant", type: "passive", description: "You know Thieves' Cant, a secret mix of dialect, jargon, and code you can use to hide messages in conversation." },
    ]},
    { level: 2, features: [
      { name: "Cunning Action", type: "active", actionType: "bonus_action", description: "Dash, Disengage, or Hide as a bonus action." },
    ]},
    { level: 3, subclass: true, features: [
      { name: "Roguish Archetype", type: "choice", description: "Choose your Roguish Archetype (Thief, Assassin, Arcane Trickster, Inquisitive, Mastermind, Scout, Swashbuckler, Phantom, Soulknife). Grants features at 3, 9, 13, and 17." },
      { name: "Sneak Attack (2d6)", type: "passive", description: "Sneak Attack increases to 2d6." },
    ]},
    { level: 4, asi: true, features: [] },
    { level: 5, features: [
      { name: "Uncanny Dodge", type: "active", actionType: "reaction", description: "When an attacker you can see hits you with an attack, use your reaction to halve the attack's damage." },
      { name: "Sneak Attack (3d6)", type: "passive", description: "Sneak Attack increases to 3d6." },
    ]},
    { level: 6, features: [
      { name: "Expertise (2nd)", type: "passive", description: "Choose two more skills to gain Expertise in." },
      { name: "Sneak Attack (4d6)", type: "passive", description: "Sneak Attack increases to 4d6." },
    ]},
    { level: 7, features: [
      { name: "Evasion", type: "passive", description: "When you are subjected to an effect that allows a DEX saving throw for half damage, you instead take no damage on a success, and only half damage on a failure." },
      { name: "Sneak Attack (4d6)", type: "passive", description: "Sneak Attack remains at 4d6." },
    ]},
    { level: 8, asi: true, features: [
      { name: "Sneak Attack (5d6)", type: "passive", description: "Sneak Attack increases to 5d6." },
    ]},
    { level: 9, features: [
      { name: "Roguish Archetype Feature", type: "passive", description: "You gain a feature from your chosen Roguish Archetype." },
      { name: "Sneak Attack (5d6)", type: "passive", description: "Sneak Attack remains at 5d6." },
    ]},
    { level: 10, asi: true, features: [
      { name: "Sneak Attack (6d6)", type: "passive", description: "Sneak Attack increases to 6d6." },
    ]},
    { level: 11, features: [
      { name: "Reliable Talent", type: "passive", description: "When you make an ability check that lets you add your proficiency bonus, a d20 roll of 9 or lower counts as a 10." },
      { name: "Sneak Attack (6d6)", type: "passive", description: "Sneak Attack remains at 6d6." },
    ]},
    { level: 12, asi: true, features: [
      { name: "Sneak Attack (7d6)", type: "passive", description: "Sneak Attack increases to 7d6." },
    ]},
    { level: 13, features: [
      { name: "Roguish Archetype Feature", type: "passive", description: "You gain a feature from your chosen Roguish Archetype." },
      { name: "Sneak Attack (7d6)", type: "passive", description: "Sneak Attack remains at 7d6." },
    ]},
    { level: 14, features: [
      { name: "Blindsense", type: "passive", description: "If you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you." },
      { name: "Sneak Attack (8d6)", type: "passive", description: "Sneak Attack increases to 8d6." },
    ]},
    { level: 15, features: [
      { name: "Slippery Mind", type: "passive", description: "You gain proficiency in WIS saving throws." },
      { name: "Sneak Attack (8d6)", type: "passive", description: "Sneak Attack remains at 8d6." },
    ]},
    { level: 16, asi: true, features: [
      { name: "Sneak Attack (9d6)", type: "passive", description: "Sneak Attack increases to 9d6." },
    ]},
    { level: 17, features: [
      { name: "Roguish Archetype Feature", type: "passive", description: "You gain a feature from your chosen Roguish Archetype." },
      { name: "Sneak Attack (9d6)", type: "passive", description: "Sneak Attack remains at 9d6." },
    ]},
    { level: 18, features: [
      { name: "Elusive", type: "passive", description: "No attack roll has advantage against you while you aren't incapacitated." },
      { name: "Sneak Attack (10d6)", type: "passive", description: "Sneak Attack increases to 10d6." },
    ]},
    { level: 19, asi: true, features: [
      { name: "Sneak Attack (10d6)", type: "passive", description: "Sneak Attack remains at 10d6." },
    ]},
    { level: 20, features: [
      { name: "Stroke of Luck", type: "active", resetsOn: "short_rest", description: "Turn a failed attack roll into a hit, or a failed ability check into a d20 roll of 20. Once per short or long rest." },
      { name: "Sneak Attack (11d6)", type: "passive", description: "Sneak Attack increases to 11d6." },
    ]},
  ],
};

const SORCERER: ClassProgressionData = {
  class: "Sorcerer",
  spellcastingAbility: "CHA",
  isSpellcaster: true,
  casterType: "full",
  spellLearningType: "known",
  subclassLabel: "Sorcerous Origin",
  subclassLevel: 1,
  progression: [
    { level: 1, subclass: true, cantripsKnownGain: 4, spellsKnownGain: 2, spellSlotsIncrease: true, features: [
      { name: "Spellcasting", type: "spellcasting", description: "You know 4 cantrips and 2 sorcerer spells. CHA is your spellcasting ability." },
      { name: "Sorcerous Origin", type: "choice", description: "Choose your Sorcerous Origin (Draconic Bloodline, Wild Magic, Aberrant Mind, Clockwork Soul, Divine Soul, Shadow Magic, Storm Sorcery). Grants features at 1, 6, 14, and 18." },
    ]},
    { level: 2, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Font of Magic", type: "passive", description: "You have sorcery points equal to your sorcerer level. You can convert spell slots to sorcery points (1 point per slot level) or convert points to spell slots (2pts=1st, 3pts=2nd, 5pts=3rd, 6pts=4th, 7pts=5th). Recharges on long rest." },
    ]},
    { level: 3, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Metamagic", type: "choice", description: "Choose 2 Metamagic options: Careful Spell, Distant Spell, Empowered Spell, Extended Spell, Heightened Spell, Quickened Spell, Seeking Spell, Subtle Spell, Transmuted Spell, Twinned Spell. Gain more at levels 10 and 17." },
    ]},
    { level: 4, asi: true, cantripsKnownGain: 1, spellsKnownGain: 1, features: [] },
    { level: 5, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 6, spellsKnownGain: 1, features: [
      { name: "Sorcerous Origin Feature", type: "passive", description: "You gain a feature from your Sorcerous Origin." },
    ]},
    { level: 7, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 8, asi: true, spellsKnownGain: 1, features: [] },
    { level: 9, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 10, cantripsKnownGain: 1, spellsKnownGain: 1, features: [
      { name: "Metamagic (3rd option)", type: "choice", description: "You learn one additional Metamagic option of your choice." },
    ]},
    { level: 11, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 12, asi: true, features: [] },
    { level: 13, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 14, spellsKnownGain: 1, features: [
      { name: "Sorcerous Origin Feature", type: "passive", description: "You gain a feature from your Sorcerous Origin." },
    ]},
    { level: 15, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 16, asi: true, features: [] },
    { level: 17, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Metamagic (4th option)", type: "choice", description: "You learn one additional Metamagic option of your choice." },
    ]},
    { level: 18, spellsKnownGain: 1, features: [
      { name: "Sorcerous Origin Feature", type: "passive", description: "You gain a feature from your Sorcerous Origin." },
    ]},
    { level: 19, asi: true, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 20, spellsKnownGain: 1, features: [
      { name: "Sorcerous Restoration", type: "passive", description: "You regain 4 expended sorcery points whenever you finish a short rest." },
    ]},
  ],
};

const WARLOCK: ClassProgressionData = {
  class: "Warlock",
  spellcastingAbility: "CHA",
  isSpellcaster: true,
  casterType: "warlock",
  spellLearningType: "known",
  subclassLabel: "Otherworldly Patron",
  subclassLevel: 1,
  progression: [
    { level: 1, subclass: true, spellsKnownGain: 2, spellSlotsIncrease: true, features: [
      { name: "Otherworldly Patron", type: "choice", description: "Choose your patron (The Archfey, The Fiend, The Great Old One, The Celestial, The Hexblade, The Fathomless, The Genie, The Undead, The Undying). Grants expanded spell list and features at 1, 6, 10, and 14." },
      { name: "Pact Magic", type: "spellcasting", description: "You know 2 warlock spells. CHA is your spellcasting ability. You have 1 pact magic spell slot (resets on short rest), at 1st level. Slots and spells scale with level." },
    ]},
    { level: 2, spellsKnownGain: 1, features: [
      { name: "Eldritch Invocations", type: "choice", description: "Choose 2 Eldritch Invocations (Agonizing Blast, Armor of Shadows, Ascendant Step, Beast Speech, Beguiling Influence, Bewitching Whispers, Book of Ancient Secrets, etc.). Gain more as you level." },
    ]},
    { level: 3, spellsKnownGain: 1, spellSlotsIncrease: true, features: [
      { name: "Pact Boon", type: "choice", description: "Choose a Pact Boon: Pact of the Blade (conjure a bound weapon), Pact of the Chain (familiar options), Pact of the Tome (3 extra cantrips and ritual casting), Pact of the Talisman." },
    ]},
    { level: 4, asi: true, cantripsKnownGain: 1, spellsKnownGain: 1, features: [] },
    { level: 5, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 6, spellsKnownGain: 1, features: [
      { name: "Patron Feature", type: "passive", description: "You gain a feature from your Otherworldly Patron." },
    ]},
    { level: 7, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 8, asi: true, spellsKnownGain: 1, features: [] },
    { level: 9, spellsKnownGain: 1, spellSlotsIncrease: true, features: [] },
    { level: 10, spellsKnownGain: 1, cantripsKnownGain: 1, features: [
      { name: "Patron Feature", type: "passive", description: "You gain a feature from your Otherworldly Patron." },
    ]},
    { level: 11, spellsKnownGain: 1, features: [
      { name: "Mystic Arcanum (6th)", type: "active", resetsOn: "long_rest", description: "Choose one 6th-level warlock spell as your Mystic Arcanum. You can cast it once without expending a spell slot. Recharges on long rest." },
    ]},
    { level: 12, asi: true, features: [] },
    { level: 13, spellsKnownGain: 1, features: [
      { name: "Mystic Arcanum (7th)", type: "active", resetsOn: "long_rest", description: "You gain a 7th-level Mystic Arcanum. Choose one 7th-level warlock spell. Cast once per long rest." },
    ]},
    { level: 14, features: [
      { name: "Patron Feature", type: "passive", description: "You gain a feature from your Otherworldly Patron." },
    ]},
    { level: 15, spellsKnownGain: 1, features: [
      { name: "Mystic Arcanum (8th)", type: "active", resetsOn: "long_rest", description: "You gain an 8th-level Mystic Arcanum. Choose one 8th-level warlock spell. Cast once per long rest." },
    ]},
    { level: 16, asi: true, features: [] },
    { level: 17, spellsKnownGain: 1, features: [
      { name: "Mystic Arcanum (9th)", type: "active", resetsOn: "long_rest", description: "You gain a 9th-level Mystic Arcanum. Choose one 9th-level warlock spell. Cast once per long rest." },
    ]},
    { level: 18, features: [] },
    { level: 19, asi: true, spellsKnownGain: 1, features: [] },
    { level: 20, spellsKnownGain: 1, features: [
      { name: "Eldritch Master", type: "active", resetsOn: "long_rest", description: "You can entreat your patron to regain all expended spell slots. Takes 1 minute. Once per long rest." },
    ]},
  ],
};

const WIZARD: ClassProgressionData = {
  class: "Wizard",
  spellcastingAbility: "INT",
  isSpellcaster: true,
  casterType: "full",
  spellLearningType: "prepared",
  subclassLabel: "Arcane Tradition",
  subclassLevel: 2,
  progression: [
    { level: 1, cantripsKnownGain: 3, spellSlotsIncrease: true, features: [
      { name: "Spellcasting", type: "spellcasting", description: "You know 3 cantrips. You have a spellbook with 6 wizard spells and can prepare INT mod + wizard level spells. INT is your spellcasting ability." },
      { name: "Arcane Recovery", type: "active", resetsOn: "long_rest", description: "Once per long rest after a short rest, recover spell slots with a combined level no greater than half your wizard level (rounded up). Slots can't be 6th level or higher." },
    ]},
    { level: 2, subclass: true, spellSlotsIncrease: true, features: [
      { name: "Arcane Tradition", type: "choice", description: "Choose your Arcane Tradition (Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation, Bladesinging, Chronurgy, Graviturgy, Order of Scribes, War Magic). Grants features at 2, 6, 10, and 14." },
    ]},
    { level: 3, spellSlotsIncrease: true, features: [] },
    { level: 4, asi: true, cantripsKnownGain: 1, features: [] },
    { level: 5, spellSlotsIncrease: true, features: [] },
    { level: 6, spellSlotsIncrease: true, features: [
      { name: "Arcane Tradition Feature", type: "passive", description: "You gain a feature from your chosen Arcane Tradition." },
    ]},
    { level: 7, spellSlotsIncrease: true, features: [] },
    { level: 8, asi: true, features: [] },
    { level: 9, spellSlotsIncrease: true, features: [] },
    { level: 10, cantripsKnownGain: 1, features: [
      { name: "Arcane Tradition Feature", type: "passive", description: "You gain a feature from your chosen Arcane Tradition." },
    ]},
    { level: 11, spellSlotsIncrease: true, features: [] },
    { level: 12, asi: true, features: [] },
    { level: 13, spellSlotsIncrease: true, features: [] },
    { level: 14, features: [
      { name: "Arcane Tradition Feature", type: "passive", description: "You gain a feature from your chosen Arcane Tradition." },
    ]},
    { level: 15, spellSlotsIncrease: true, features: [] },
    { level: 16, asi: true, features: [] },
    { level: 17, spellSlotsIncrease: true, features: [] },
    { level: 18, features: [
      { name: "Spell Mastery", type: "choice", description: "Choose one 1st-level and one 2nd-level wizard spell in your spellbook. You can cast these spells at their lowest level without expending a spell slot. You can swap them for other spells by spending 8 hours of study." },
    ]},
    { level: 19, asi: true, spellSlotsIncrease: true, features: [] },
    { level: 20, features: [
      { name: "Signature Spells", type: "choice", description: "Choose two 3rd-level wizard spells from your spellbook as your signature spells. You always have them prepared and can cast each once without using a spell slot. Regain uses on a short rest." },
    ]},
  ],
};

export const ALL_CLASS_PROGRESSIONS: ClassProgressionData[] = [
  ARTIFICER, BARBARIAN, BARD, BLOOD_HUNTER, CLERIC, DRUID, FIGHTER, MONK,
  PALADIN, RANGER, ROGUE, SORCERER, WARLOCK, WIZARD,
];

export function getClassProgression(className: string): ClassProgressionData | undefined {
  const lower = className.toLowerCase();
  return ALL_CLASS_PROGRESSIONS.find((c) => c.class.toLowerCase() === lower || lower.includes(c.class.toLowerCase()));
}

export const SPELLCASTER_CLASSES = new Set([
  "artificer", "bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard",
  "arcane trickster", "eldritch knight",
]);

export function isSpellcaster(className: string): boolean {
  const lower = className.toLowerCase();
  return [...SPELLCASTER_CLASSES].some((c) => lower.includes(c));
}
