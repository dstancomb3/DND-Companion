import type { ProgressionSheet } from "./types";

// ── Monk core ─────────────────────────────────────────────────────────────────

export const MONK_PROGRESSION: ProgressionSheet = {
  key: "monk",
  source: "class",
  appliesTo: { class: "monk" },
  // Ki points = monk level (unlocks at level 2, scales every level thereafter)
  scalingResources: [
    { name: "Ki", formula: "level", resetsOn: "short_rest", color: "#8B5CF6", unlocksAtLevel: 2 },
  ],
  levels: [
    {
      level: 1, proficiencyBonus: 2, hitDie: 8,
      summary: "You gain Unarmored Defense and Martial Arts, the foundation of your monk training.",
      features: [
        { kind: "passive", name: "Unarmored Defense", description: "While you aren't wearing armor or wielding a shield, your AC equals 10 + your DEX modifier + your WIS modifier." },
        { kind: "passive", name: "Martial Arts (d4)", description: "You can use DEX instead of STR for attack and damage rolls with unarmed strikes and monk weapons. Your unarmed strikes deal 1d4 damage. After attacking with a monk weapon or unarmed strike, you can make one unarmed strike as a bonus action." },
      ],
    },
    {
      level: 2, proficiencyBonus: 2, hitDie: 8,
      summary: "Ki unlocks your core combat options: Flurry of Blows, Patient Defense, and Step of the Wind. Your movement speed begins to increase.",
      features: [
        {
          kind: "resource", name: "Ki", description: "Ki points fuel your special monk abilities. You have a number of ki points equal to your monk level. They recharge on a short or long rest. Ki save DC = 8 + proficiency bonus + WIS modifier.",
          maxFormula: "level", resetsOn: "short_rest", color: "#8B5CF6",
        },
        { kind: "active_bonus", name: "Flurry of Blows", description: "Immediately after you take the Attack action on your turn, you can spend 1 ki point to make two unarmed strikes as a bonus action.", resetsOn: "short_rest" },
        { kind: "active_bonus", name: "Patient Defense", description: "You can spend 1 ki point to take the Dodge action as a bonus action on your turn.", resetsOn: "short_rest" },
        { kind: "active_bonus", name: "Step of the Wind", description: "You can spend 1 ki point to take the Disengage or Dash action as a bonus action on your turn, and your jump distance is doubled for the turn.", resetsOn: "short_rest" },
        { kind: "passive", name: "Unarmored Movement (+10 ft)", description: "Your speed increases by 10 feet while you aren't wearing armor or wielding a shield. This bonus increases as you gain monk levels (to +15 at 6th, +20 at 10th, +25 at 14th, +30 at 18th)." },
      ],
    },
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "You choose your Monastic Tradition (subclass) and gain Deflect Missiles — a powerful reaction that can even let you throw a missile back.",
      features: [
        { kind: "subclass", prompt: "Choose your Monastic Tradition. This shapes your monk training and grants additional features at levels 3, 6, 11, and 17." },
        { kind: "active_reaction", name: "Deflect Missiles", description: "When you are hit by a ranged weapon attack, you can use your reaction to deflect or catch the missile. The damage is reduced by 1d10 + your DEX modifier + your monk level. If reduced to 0, you can catch the missile and immediately make a ranged attack (range 20/60 ft) by spending 1 ki point, dealing 1d6 + DEX modifier damage." },
        { kind: "active_reaction", name: "Slow Fall", description: "You can use your reaction when you fall to reduce any falling damage you take by an amount equal to five times your monk level." },
      ],
    },
    {
      level: 4, proficiencyBonus: 2, hitDie: 8,
      summary: "Ability Score Improvement. You also learn Stunning Strike — a powerful on-hit effect that can incapacitate an enemy.",
      features: [
        { kind: "asi" },
        { kind: "passive", name: "Stunning Strike", description: "When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike. The target must make a CON saving throw. On a failed save, it is stunned until the end of your next turn." },
      ],
    },
    {
      level: 5, proficiencyBonus: 3, hitDie: 8,
      summary: "A major power spike: Extra Attack lets you attack twice, your Martial Arts die improves to d6, and your Ki pool grows to 5.",
      features: [
        { kind: "passive", name: "Extra Attack", description: "You can attack twice, instead of once, whenever you take the Attack action on your turn." },
        { kind: "passive", name: "Martial Arts (d6)", description: "Your Martial Arts damage die improves from d4 to d6." },
      ],
    },
    {
      level: 6, proficiencyBonus: 3, hitDie: 8,
      summary: "Your unarmed strikes become magical. Your Monastic Tradition grants a new feature. Movement bonus increases to +15 ft.",
      features: [
        { kind: "passive", name: "Ki-Empowered Strikes", description: "Your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage." },
        { kind: "passive", name: "Unarmored Movement (+15 ft)", description: "Your Unarmored Movement bonus increases to +15 feet." },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 8,
      summary: "Evasion makes you nearly untouchable by area spells. Stillness of Mind lets you break free of charm and fear effects.",
      features: [
        { kind: "passive", name: "Evasion", description: "When you are subjected to an effect that allows a DEX saving throw to take only half damage, you instead take no damage if you succeed, and only half damage if you fail. You can't use this feature while incapacitated." },
        { kind: "active_action", name: "Stillness of Mind", description: "You can use your action to end one effect on yourself that is causing you to be charmed or frightened." },
      ],
    },
    {
      level: 8, proficiencyBonus: 3, hitDie: 8,
      summary: "Ability Score Improvement.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "You can now run up walls and across liquids — your movement becomes truly extraordinary.",
      features: [
        { kind: "passive", name: "Unarmored Movement (Vertical Surfaces)", description: "You gain the ability to move along vertical surfaces and across liquids on your turn without falling during the move, as long as you begin and end the turn on a horizontal surface." },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 8,
      summary: "Purity of Body makes you immune to poison and disease. Movement bonus increases to +20 ft.",
      features: [
        { kind: "passive", name: "Purity of Body", description: "Your mastery of the ki flowing through you makes you immune to disease and poison." },
        { kind: "passive", name: "Unarmored Movement (+20 ft)", description: "Your Unarmored Movement bonus increases to +20 feet." },
      ],
    },
    {
      level: 11, proficiencyBonus: 4, hitDie: 8,
      summary: "Your Martial Arts die improves to d8. Your Monastic Tradition grants a new feature.",
      features: [
        { kind: "passive", name: "Martial Arts (d8)", description: "Your Martial Arts damage die improves from d6 to d8." },
      ],
    },
    {
      level: 12, proficiencyBonus: 4, hitDie: 8,
      summary: "Ability Score Improvement.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "You can now understand and be understood by any creature that speaks at least one language. Movement bonus increases to +25 ft.",
      features: [
        { kind: "passive", name: "Tongue of the Sun and Moon", description: "You learn to touch the ki of other minds so that you understand all spoken languages. Moreover, any creature that can understand a language can understand what you say." },
        { kind: "passive", name: "Unarmored Movement (+25 ft)", description: "Your Unarmored Movement bonus increases to +25 feet." },
      ],
    },
    {
      level: 14, proficiencyBonus: 5, hitDie: 8,
      summary: "Diamond Soul grants proficiency in all saving throws, and lets you spend 1 ki to reroll a failed save.",
      features: [
        { kind: "passive", name: "Diamond Soul", description: "Your mastery of ki grants you proficiency in all saving throws. Additionally, whenever you make a saving throw and fail, you can spend 1 ki point to reroll it and take the second result." },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 8,
      summary: "Timeless Body lets you ignore aging effects. You no longer need food or water.",
      features: [
        { kind: "passive", name: "Timeless Body", description: "Your ki sustains you so that you suffer none of the frailty of old age. You can't be aged magically. You still die of old age. Additionally, you no longer need food or water." },
      ],
    },
    {
      level: 16, proficiencyBonus: 5, hitDie: 8,
      summary: "Ability Score Improvement.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Your Martial Arts die improves to d10. Your Monastic Tradition grants its final feature. Movement bonus increases to +35 ft.",
      features: [
        { kind: "passive", name: "Martial Arts (d10)", description: "Your Martial Arts damage die improves from d8 to d10." },
        { kind: "passive", name: "Unarmored Movement (+35 ft)", description: "Your Unarmored Movement bonus increases to +35 feet." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 8,
      summary: "Empty Body lets you become invisible at the cost of 4 ki points — or project your soul astrally for 8 ki. Movement bonus reaches +40 ft.",
      features: [
        { kind: "active_action", name: "Empty Body", description: "You can use your action to spend 4 ki points to become invisible for 1 minute. During that time, you also have resistance to all damage but force damage. Additionally, you can spend 8 ki points to cast the Astral Projection spell, without needing material components. When you do so, you can't take any other creatures with you.", resetsOn: "short_rest" },
        { kind: "passive", name: "Unarmored Movement (+40 ft)", description: "Your Unarmored Movement bonus increases to +40 feet." },
      ],
    },
    {
      level: 19, proficiencyBonus: 6, hitDie: 8,
      summary: "Ability Score Improvement.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 20, proficiencyBonus: 6, hitDie: 8,
      summary: "Perfect Self: if you start initiative with no ki, you regain 4 ki points. A fitting capstone for a true master.",
      features: [
        { kind: "passive", name: "Perfect Self", description: "When you roll for initiative and have no ki points remaining, you regain 4 ki points." },
      ],
    },
  ],
};

// ── Way of the Open Hand ──────────────────────────────────────────────────────

export const OPEN_HAND_PROGRESSION: ProgressionSheet = {
  key: "monk:open_hand",
  source: "subclass",
  appliesTo: { class: "monk", subclass: "way of the open hand" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Open Hand Technique lets you apply powerful riders to your Flurry of Blows attacks: knocking prone, pushing away, or preventing reactions.",
      features: [
        {
          kind: "passive",
          name: "Open Hand Technique",
          description: "Whenever you hit a creature with one of the attacks granted by your Flurry of Blows, you can impose one of the following effects on that target: (1) It must succeed on a DEX saving throw or be knocked prone. (2) It must make a STR saving throw. If it fails, you can push it up to 15 feet away from you. (3) It can't take reactions until the end of your next turn.",
        },
      ],
    },
    {
      level: 6, proficiencyBonus: 3, hitDie: 8,
      summary: "Wholeness of Body: once per long rest, heal yourself for triple your monk level with an action.",
      features: [
        {
          kind: "active_action",
          name: "Wholeness of Body",
          description: "You gain the ability to heal yourself. As an action, you can regain hit points equal to three times your monk level. You must finish a long rest before you can use this feature again.",
          resetsOn: "long_rest",
        },
      ],
    },
    {
      level: 11, proficiencyBonus: 4, hitDie: 8,
      summary: "Tranquility: when you finish a long rest, you gain the Sanctuary spell effect until your next long rest or until you attack.",
      features: [
        {
          kind: "passive",
          name: "Tranquility",
          description: "At the end of a long rest, you gain the effect of a Sanctuary spell (save DC = your ki save DC) that lasts until the start of your next long rest or until you make an attack roll, deal damage, or force a saving throw. Any creature that tries to attack you must make a WIS saving throw; on a failure, it must choose a new target or waste its attack.",
        },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Quivering Palm: the ultimate ki technique — with a touch, plant a lethal vibration that can kill instantly on your command.",
      features: [
        {
          kind: "active_action",
          name: "Quivering Palm",
          description: "You gain the ability to set up lethal vibrations in someone's body. When you hit a creature with an unarmed strike, you can spend 3 ki points to start these imperceptible vibrations, which last for a number of days equal to your monk level. The vibrations are harmless unless you use your action to end them. You can have only one creature under this effect at a time. You can choose to end the vibrations harmlessly, or you can use your action to end them and deal 10d10 necrotic damage. If this reduces the target to 0 HP, it dies. Otherwise a CON save (your ki DC) halves the damage. Constructs and undead are immune.",
          resetsOn: "long_rest",
        },
      ],
    },
  ],
};
