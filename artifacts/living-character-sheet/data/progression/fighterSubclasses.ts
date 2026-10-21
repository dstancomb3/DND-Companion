import type { ProgressionSheet } from "./types";

export const BATTLE_MASTER_PROGRESSION: ProgressionSheet = {
  key: "fighter:battle master",
  source: "subclass",
  appliesTo: { class: "fighter", subclass: "battle master" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "Combat Superiority grants maneuvers and superiority dice as your tactical core.",
      features: [
        { kind: "resource", name: "Superiority Dice", description: "You gain 4 superiority dice (d8). You expend them to fuel maneuvers and regain all expended dice on a short or long rest.", maxFormula: 4, resetsOn: "short_rest", color: "#3B82F6" },
        { kind: "passive", name: "Maneuvers Known", description: "You learn 3 maneuvers of your choice from the Battle Master list. Each maneuver defines its own trigger and effect." },
        { kind: "passive", name: "Student of War", description: "You gain proficiency with one type of artisan's tools of your choice." },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "Know Your Enemy adds tactical battlefield reading outside direct attacks.",
      features: [
        { kind: "active_action", name: "Know Your Enemy", description: "If you spend at least 1 minute observing or interacting with another creature outside combat, you can learn whether it is your equal, superior, or inferior in two characteristics of your choice.", resetsOn: "short_rest" },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Improved Combat Superiority upgrades your superiority dice.",
      features: [
        { kind: "passive", name: "Improved Combat Superiority (d10)", description: "Your superiority dice become d10s." },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 10,
      summary: "Relentless lets you recover tactical tempo when low on dice.",
      features: [
        { kind: "passive", name: "Relentless", description: "When you roll initiative and have no superiority dice remaining, you regain 1 superiority die." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 10,
      summary: "Combat Superiority reaches its final die improvement.",
      features: [
        { kind: "passive", name: "Improved Combat Superiority (d12)", description: "Your superiority dice become d12s." },
      ],
    },
  ],
};

export const ELDRITCH_KNIGHT_PROGRESSION: ProgressionSheet = {
  key: "fighter:eldritch knight",
  source: "subclass",
  appliesTo: { class: "fighter", subclass: "eldritch knight" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "Weapon Bond and arcane casting define your hybrid martial style.",
      features: [
        { kind: "passive", name: "Weapon Bond", description: "You can bond with up to two weapons. You cannot be disarmed of a bonded weapon unless incapacitated, and can summon one bonded weapon to your hand as a bonus action." },
        { kind: "passive", name: "Eldritch Knight Spellcasting", description: "You gain wizard-based third-caster spell progression focused on abjuration and evocation, with limited off-school choices at specified levels." },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "War Magic blends cantrips and weapon attacks in one turn.",
      features: [
        { kind: "active_bonus", name: "War Magic", description: "When you use your action to cast a cantrip, you can make one weapon attack as a bonus action." },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Eldritch Strike weakens enemy saves after your weapon hits.",
      features: [
        { kind: "passive", name: "Eldritch Strike", description: "When you hit a creature with a weapon attack, that creature has disadvantage on the next saving throw it makes against a spell you cast before the end of your next turn." },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 10,
      summary: "Arcane Charge improves Action Surge mobility.",
      features: [
        { kind: "passive", name: "Arcane Charge", description: "When you use Action Surge, you can teleport up to 30 feet to an unoccupied space you can see before or after the additional action." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 10,
      summary: "Improved War Magic lets spells and attacks chain more effectively.",
      features: [
        { kind: "active_bonus", name: "Improved War Magic", description: "When you use your action to cast a spell, you can make one weapon attack as a bonus action." },
      ],
    },
  ],
};

export const ARCANE_ARCHER_PROGRESSION: ProgressionSheet = {
  key: "fighter:arcane archer",
  source: "subclass",
  appliesTo: { class: "fighter", subclass: "arcane archer" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "Arcane Shot gives magical arrow options and a short-rest resource loop.",
      features: [
        { kind: "resource", name: "Arcane Shot Uses", description: "You can use Arcane Shot twice, and regain all expended uses on a short or long rest.", maxFormula: 2, resetsOn: "short_rest", color: "#8B5CF6" },
        { kind: "passive", name: "Arcane Shot Options", description: "You learn 2 Arcane Shot options. You learn additional options at higher levels and can replace one option whenever you gain a level in this class." },
        { kind: "passive", name: "Arcane Archer Lore", description: "You gain proficiency in either Arcana or Nature and learn Prestidigitation or Druidcraft." },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "Magic Arrow and Curving Shot improve reliability with ranged attacks.",
      features: [
        { kind: "passive", name: "Magic Arrow", description: "Your nonmagical arrows become magical for overcoming resistance and immunity." },
        { kind: "active_bonus", name: "Curving Shot", description: "When you make an attack roll with a magic arrow and miss, you can use a bonus action to reroll the attack against a different target within 60 feet of the original target." },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Arcane Shot options expand and improve at this tier.",
      features: [
        { kind: "passive", name: "Arcane Shot Improvement", description: "You learn an additional Arcane Shot option and your Arcane Shot damage scales upward where applicable." },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 10,
      summary: "Ever-Ready Shot stabilizes your Arcane Shot economy.",
      features: [
        { kind: "passive", name: "Ever-Ready Shot", description: "When you roll initiative and have no Arcane Shot uses remaining, you regain 1 use." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 10,
      summary: "Arcane Shot reaches peak scaling and consistency.",
      features: [
        { kind: "passive", name: "Arcane Shot Mastery", description: "Your Arcane Shot options are at full scaling and remain a core tactical damage/control package." },
      ],
    },
  ],
};

export const BANNERET_PROGRESSION: ProgressionSheet = {
  key: "fighter:banneret",
  source: "subclass",
  appliesTo: { class: "fighter", subclass: "banneret" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "Rallying Cry turns your Second Wind into group sustain.",
      features: [
        { kind: "passive", name: "Rallying Cry", description: "When you use Second Wind, up to three allies within 60 feet who can see or hear you regain hit points equal to your fighter level." },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "Royal Envoy improves social and leadership utility.",
      features: [
        { kind: "passive", name: "Royal Envoy", description: "You gain proficiency in Persuasion, and your proficiency bonus is doubled for Persuasion checks." },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Inspiring Surge lets allies attack off your Action Surge.",
      features: [
        { kind: "active_bonus", name: "Inspiring Surge", description: "When you use Action Surge, choose one ally within 60 feet who can see or hear you. That ally can use its reaction to make one weapon attack." },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 10,
      summary: "Bulwark strengthens allied saving throw resilience.",
      features: [
        { kind: "active_reaction", name: "Bulwark", description: "When an ally you can see within 60 feet fails a saving throw, you can use your reaction to let it reroll the saving throw and take the new result." },
      ],
    },
  ],
};

export const CAVALIER_PROGRESSION: ProgressionSheet = {
  key: "fighter:cavalier",
  source: "subclass",
  appliesTo: { class: "fighter", subclass: "cavalier" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "Unwavering Mark and mounted control establish your defender role.",
      features: [
        { kind: "passive", name: "Born to the Saddle", description: "You have advantage on saves to avoid falling off your mount and can mount/dismount with only 5 feet of movement." },
        { kind: "passive", name: "Unwavering Mark", description: "When you hit a creature with a melee weapon attack, you can mark it. Marked targets have disadvantage on attacks against creatures other than you, and you can punish them if they ignore the mark." },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "Warding Maneuver lets you protect nearby allies with reactions.",
      features: [
        { kind: "active_reaction", name: "Warding Maneuver", description: "When you or a creature within 5 feet is hit by an attack, you can use your reaction to roll 1d8 and add the number to AC against that attack, potentially causing it to miss." },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Hold the Line locks enemies in your threat range.",
      features: [
        { kind: "passive", name: "Hold the Line", description: "Creatures provoke an opportunity attack from you when they move 5 feet or more while within your reach, and your opportunity attacks reduce speed to 0 on a hit." },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 10,
      summary: "Ferocious Charger adds forced movement and knockdown pressure.",
      features: [
        { kind: "active_bonus", name: "Ferocious Charger", description: "If you move at least 10 feet in a straight line before hitting with an attack, you can force the target to make a Strength save or be knocked prone." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 10,
      summary: "Vigilant Defender massively expands reaction-based control.",
      features: [
        { kind: "passive", name: "Vigilant Defender", description: "You gain a special reaction on each creature's turn, usable only for opportunity attacks." },
      ],
    },
  ],
};

export const ECHO_KNIGHT_PROGRESSION: ProgressionSheet = {
  key: "fighter:echo knight",
  source: "subclass",
  appliesTo: { class: "fighter", subclass: "echo knight" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "Manifest Echo creates your core position-control and extra-attack identity.",
      features: [
        { kind: "active_bonus", name: "Manifest Echo", description: "As a bonus action, create an echo in an unoccupied space you can see. The echo enables attack origin swaps, opportunity attack control, and teleport repositioning through your subclass rules." },
        { kind: "passive", name: "Unleash Incarnation", description: "When you take the Attack action, you can make one additional melee attack from the echo's position a limited number of times per long rest." },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "Echo Avatar extends scouting and remote presence.",
      features: [
        { kind: "active_action", name: "Echo Avatar", description: "As an action, transfer your consciousness to your echo. You can see and hear through it while your senses from your own body are limited during this effect.", resetsOn: "short_rest" },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Shadow Martyr adds high-value defensive interception.",
      features: [
        { kind: "active_reaction", name: "Shadow Martyr", description: "You can use your reaction to teleport your echo to an ally's space and have the echo take a hit in their place.", resetsOn: "short_rest" },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 10,
      summary: "Reclaim Potential improves durability through echo usage.",
      features: [
        { kind: "active_reaction", name: "Reclaim Potential", description: "When your echo is destroyed by taking damage, you can gain temporary hit points through this reaction-based recovery feature." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 10,
      summary: "Legion of One allows multiple echoes and stronger battlefield control.",
      features: [
        { kind: "passive", name: "Legion of One", description: "You can sustain two echoes at once and your Unleash Incarnation improves at this tier." },
      ],
    },
  ],
};

export const PSI_WARRIOR_PROGRESSION: ProgressionSheet = {
  key: "fighter:psi warrior",
  source: "subclass",
  appliesTo: { class: "fighter", subclass: "psi warrior" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "Psionic Power grants dice-fueled offense, defense, and mobility tools.",
      features: [
        { kind: "passive", name: "Psionic Power", description: "You gain a pool of psionic energy dice used for Protective Field, Psionic Strike, and Telekinetic Movement. Dice scale by level and recover according to subclass rules." },
        { kind: "active_action", name: "Telekinetic Movement", description: "As an action, move an object or willing creature a short distance with telekinetic force.", resetsOn: "short_rest" },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "Telekinetic Adept upgrades your movement and force tools.",
      features: [
        { kind: "passive", name: "Psi-Powered Leap", description: "As a bonus action, gain a flying speed until the end of your current turn using psionic energy." },
        { kind: "active_bonus", name: "Telekinetic Thrust", description: "When you deal damage with Psionic Strike, you can force the target to make a save or be knocked prone/pushed." },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Guarded Mind improves mental defense and condition recovery.",
      features: [
        { kind: "passive", name: "Guarded Mind", description: "You gain resistance to psychic damage, and can spend psionic energy to end charm or frighten effects on yourself." },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 10,
      summary: "Bulwark of Force provides teamwide force-based defense.",
      features: [
        { kind: "active_bonus", name: "Bulwark of Force", description: "As a bonus action, grant half cover to yourself and selected allies within range for 1 minute using psionic force.", resetsOn: "long_rest" },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 10,
      summary: "Telekinetic Master grants persistent telekinetic battlefield control.",
      features: [
        { kind: "active_action", name: "Telekinetic Master", description: "You can cast Telekinesis and empower attacks while concentrating, according to subclass rules.", resetsOn: "long_rest" },
      ],
    },
  ],
};

export const RUNE_KNIGHT_PROGRESSION: ProgressionSheet = {
  key: "fighter:rune knight",
  source: "subclass",
  appliesTo: { class: "fighter", subclass: "rune knight" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "Runes and Giant's Might define your empowered frontline toolkit.",
      features: [
        { kind: "active_bonus", name: "Giant's Might", description: "As a bonus action, become magically Large (if possible), gain advantage on Strength checks/saves, and add extra damage once per turn while active.", resetsOn: "short_rest" },
        { kind: "passive", name: "Rune Carver", description: "You inscribe magical runes and gain passive and active rune effects that recharge by rest according to rune rules." },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "Runic Shield gives reaction-based ally protection.",
      features: [
        { kind: "active_reaction", name: "Runic Shield", description: "When a creature you can see within 60 feet is hit by an attack roll, you can force the attacker to reroll the d20 and use the new roll.", resetsOn: "short_rest" },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Great Stature and extra runes expand your giant-themed control package.",
      features: [
        { kind: "passive", name: "Great Stature", description: "You grow and gain a permanent increase in height along with improved Giant's Might damage." },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 10,
      summary: "Master of Runes improves active rune cadence.",
      features: [
        { kind: "passive", name: "Master of Runes", description: "You can invoke each rune's active effect more frequently according to subclass limits." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 10,
      summary: "Runic Juggernaut unlocks your strongest giant-form scaling.",
      features: [
        { kind: "passive", name: "Runic Juggernaut", description: "Giant's Might scales up again, increasing size/force impact and strengthening your battlefield presence." },
      ],
    },
  ],
};

export const SAMURAI_PROGRESSION: ProgressionSheet = {
  key: "fighter:samurai",
  source: "subclass",
  appliesTo: { class: "fighter", subclass: "samurai" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "Fighting Spirit grants on-demand advantage and temporary durability.",
      features: [
        { kind: "resource", name: "Fighting Spirit Uses", description: "You can use Fighting Spirit three times, and regain all expended uses on a long rest.", maxFormula: 3, resetsOn: "long_rest", color: "#F59E0B" },
        { kind: "active_bonus", name: "Fighting Spirit", description: "As a bonus action, gain advantage on weapon attack rolls until end of current turn and gain temporary hit points.", resetsOn: "long_rest" },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "Elegant Courtier improves social reliability and Wisdom saves.",
      features: [
        { kind: "passive", name: "Elegant Courtier", description: "You gain proficiency in Wisdom saving throws and add your Wisdom modifier to Persuasion checks." },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Tireless Spirit ensures at least one Fighting Spirit in key fights.",
      features: [
        { kind: "passive", name: "Tireless Spirit", description: "When you roll initiative and have no Fighting Spirit uses remaining, you regain one use." },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 10,
      summary: "Rapid Strike trades advantage for additional attack pressure.",
      features: [
        { kind: "passive", name: "Rapid Strike", description: "If you have advantage on a weapon attack roll, you can forgo advantage to make one additional weapon attack against the same target." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 10,
      summary: "Strength Before Death grants a final turn when reduced to 0 HP.",
      features: [
        { kind: "active_reaction", name: "Strength Before Death", description: "When you take damage that would reduce you to 0 hit points, you can use your reaction to take an entire extra turn immediately before falling unconscious.", resetsOn: "long_rest" },
      ],
    },
  ],
};

export const FIGHTER_SUBCLASS_SHEETS: ProgressionSheet[] = [
  BATTLE_MASTER_PROGRESSION,
  ELDRITCH_KNIGHT_PROGRESSION,
  ARCANE_ARCHER_PROGRESSION,
  BANNERET_PROGRESSION,
  CAVALIER_PROGRESSION,
  ECHO_KNIGHT_PROGRESSION,
  PSI_WARRIOR_PROGRESSION,
  RUNE_KNIGHT_PROGRESSION,
  SAMURAI_PROGRESSION,
];