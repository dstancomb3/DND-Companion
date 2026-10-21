import type { ProgressionSheet } from "./types";

/** Barbarian subclass milestones: 3, 6, 10, 14 */
function barbarianSheet(
  subclass: string,
  f3: string,
  f6: string,
  f10: string,
  f14: string
): ProgressionSheet {
  return {
    key: `barbarian:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "barbarian", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 3, proficiencyBonus: 2, hitDie: 12,
        summary: `${subclass} grants its defining Primal Path feature when Rage fully awakens.`,
        features: [
          { kind: "passive", name: `${subclass}: Path Feature`, description: f3 },
        ],
      },
      {
        level: 6, proficiencyBonus: 3, hitDie: 12,
        summary: `${subclass} deepens with an expanded Path ability.`,
        features: [
          { kind: "passive", name: `${subclass}: Path Expansion`, description: f6 },
        ],
      },
      {
        level: 10, proficiencyBonus: 4, hitDie: 12,
        summary: `${subclass} advanced Path feature unlocks at tier 3.`,
        features: [
          { kind: "passive", name: `${subclass}: Path Mastery`, description: f10 },
        ],
      },
      {
        level: 14, proficiencyBonus: 5, hitDie: 12,
        summary: `${subclass} capstone Path feature reaches its apex.`,
        features: [
          { kind: "passive", name: `${subclass}: Path Capstone`, description: f14 },
        ],
      },
    ],
  };
}

export const PATH_OF_THE_BERSERKER_PROGRESSION = barbarianSheet(
  "path of the berserker",
  "Frenzy: While raging, you can go into a frenzy. For the duration of your rage, you can make a single melee weapon attack as a bonus action on each of your turns after this one. When your rage ends, you suffer one level of exhaustion.",
  "Mindless Rage: You can't be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage.",
  "Intimidating Presence: Action to frighten one creature within 30 ft (Wisdom save, DC = 8 + Proficiency Bonus + Charisma modifier). On a failed save the creature is frightened until end of your next turn; on each subsequent turn you can use your action to extend the effect. Once a creature succeeds on the save, you can't use this feature on that creature for 24 hours.",
  "Retaliation: When you take damage from a creature within 5 ft, use a reaction to make one melee weapon attack against that creature."
);

export const PATH_OF_THE_TOTEM_WARRIOR_PROGRESSION = barbarianSheet(
  "path of the totem warrior",
  "Spirit Seeker: Cast Beast Sense and Speak with Animals as rituals. Totem Spirit (choose Bear, Eagle, or Wolf): Bear = resistance to all damage except psychic while raging; Eagle = Dash as bonus action while raging, no opportunity attacks from movement; Wolf = while raging, allies within 5 ft of a target you hit have advantage on melee attacks against it.",
  "Aspect of the Beast (choose): Bear = double carrying capacity, advantage on Strength checks; Eagle = see up to 1 mile clearly, dim light as bright light; Wolf = track at fast pace, stealth at normal pace. Can choose different totem than level 3.",
  "Spirit Walker: Cast Commune with Nature as a ritual.",
  "Totemic Attunement (choose): Bear = while raging, each creature within 5 ft is hostile to others and has disadvantage on attacks not targeting you; Eagle = while raging, fly speed equal to walking speed (must land at end of turn); Wolf = while raging, if you hit a Large or smaller creature, you can knock it prone as a bonus action."
);

export const PATH_OF_THE_ANCESTRAL_GUARDIAN_PROGRESSION = barbarianSheet(
  "path of the ancestral guardian",
  "Ancestral Protectors: While raging, the first creature you hit with an attack has disadvantage on all attack rolls that don't target you, and creatures other than you that the target attacks have resistance to the damage until start of your next turn.",
  "Spirit Shield: While raging, when another creature you can see within 30 ft takes damage, use a reaction to reduce that damage by 2d6 (increases to 3d6 at level 10, 4d6 at level 14).",
  "Consult the Spirits: Cast Clairvoyance once without a spell slot per short rest. When you cast it this way, its sensor takes the form of your ancestral spirits.",
  "Vengeful Ancestors: When you use Spirit Shield to reduce damage, the attacker takes the same amount of force damage."
);

export const PATH_OF_STORM_HERALD_PROGRESSION = barbarianSheet(
  "path of storm herald",
  "Storm Aura: While raging, emit a 10-ft aura. Choose Desert, Sea, or Tundra when learning this feature (changeable on level-up). Desert: each creature of your choice in aura takes 2 fire damage (no save) at start of your turn; Sea: bonus action to force Dex save or take 1d6 lightning on a creature; Tundra: bonus action to grant 2 temp HP to creature of choice in aura. Damage and temp HP scale with level.",
  "Storm Soul (persistent, even outside rage): Desert = fire resistance, can't ignite flammable objects by touching; Sea = lightning resistance, can breathe and swim at full speed underwater; Tundra = cold resistance, can touch water and turn it to ice (10 ft cube).",
  "Shielding Storm: While raging, all creatures of your choice in your Storm Aura gain the resistance from your Storm Soul (fire/lightning/cold).",
  "Raging Storm: Desert = bonus action to force a creature within 10 ft to make Str save or be knocked prone; Sea = when you hit with a melee attack, use bonus action to force creature to make Str save or be pushed 20 ft and knocked prone; Tundra = when you hit with a melee attack, target's speed is reduced to 0 until start of your next turn."
);

export const PATH_OF_THE_ZEALOT_PROGRESSION = barbarianSheet(
  "path of the zealot",
  "Divine Fury: While raging, first creature you hit each turn takes bonus necrotic or radiant damage (your choice when learning) = 1d6 + half Barbarian level. Warrior of the Gods: Spells that return you to life (like Revivify) require no material components when cast on you.",
  "Fanatical Focus: Once per rage, if you fail a saving throw, you can reroll it and must use the new roll.",
  "Zealous Presence: Once per long rest, bonus action to unleash a battle cry—up to 10 creatures of your choice within 60 ft gain advantage on attack rolls and saving throws until start of your next turn.",
  "Rage Beyond Death: While raging and at 0 HP, you can keep fighting. Any damage you take doesn't cause death saving throw failures; you don't die from accumulated failures while raging. You die immediately when your rage ends if still at 0 HP."
);

export const PATH_OF_THE_BEAST_PROGRESSION = barbarianSheet(
  "path of the beast",
  "Form of the Beast: While raging, you manifest one natural weapon (choose each time you rage): Bite (d8 piercing, once per turn on a hit, regain HP = PB if below half max HP), Claws (two d6 slashing attacks when you take the Attack action, replacing one attack—gives an extra swing), Tail (d8 piercing, 10 ft reach, reaction to give +1d8 AC bonus vs. one hit per turn).",
  "Bestial Soul: Natural weapons count as magical. Also choose one: swim speed = walking speed, climb speed = walking speed (including upside down), jump distance doubles.",
  "Infectious Fury: Once per rage when you hit with a natural weapon, target makes Wis save (DC = 8 + PB + Con) or you implant primal fury: target must use reaction to make one melee attack against a creature other than you, OR takes 2d12 psychic damage.",
  "Call the Hunt: When you enter rage, choose up to PB willing creatures within 30 ft. They each gain 5 temporary HP, and once per turn (for them) when they hit with a weapon attack, they deal bonus 1d6 damage of the weapon's type. Lasts for your rage. Usable PB times per long rest."
);

export const PATH_OF_WILD_MAGIC_PROGRESSION = barbarianSheet(
  "path of wild magic",
  "Magic Awareness: Action to sense magic in a 60-ft radius (as Detect Magic, but not a spell). Usable PB times per long rest. Wild Surge: When you enter rage, roll on the Wild Magic table (d8): 1=insubstantial wisps (half damage, 30 ft teleport reaction), 2=plant growth aura, 3=spectral shield +2 AC, 4=freed action (Dissonant Whispers effect), 5=healing spores aura (regain 1d6 HP), 6=summoned spirit (concentrating, 5 ft aura retaliation), 7=bolts of force, 8=flight 30 ft.",
  "Bolstering Magic: Bonus action to touch a creature (including yourself). Choose: roll d3 and add to next attack roll or ability check, OR expend one of your rage uses to have the creature regain one expended spell slot (up to 3rd level). Usable PB times per long rest.",
  "Unstable Backlash: When you take damage or fail a saving throw while raging, use a reaction to roll a new Wild Surge and replace the current one's effect.",
  "Controlled Surge: When you roll on the Wild Magic table, roll twice and choose either result. If both results are the same, pick any entry on the table."
);

export const PATH_OF_THE_GIANT_PROGRESSION = barbarianSheet(
  "path of the giant",
  "Giant Power: Learn one Giant language. Learn the Elementalism cantrip if not already known. Giant's Havoc: While raging, your reach increases by 5 ft, and you can use a bonus action to grow to Large size (or larger if space permits) for the duration—large-sized natural weapons deal one die size larger.",
  "Elemental Cleaver: While raging, infuse one weapon you're holding with elemental power—choose acid, cold, fire, lightning, or thunder. On a hit it deals one extra d6 of the chosen type. You can throw this weapon (20/60 range).",
  "Mighty Impel: While raging, as a bonus action, use your Strength to lift a Medium or smaller creature within your reach and move them. They land in an unoccupied space within 30 ft of you (Strength save negates, DC = 8 + PB + Str modifier). If landing in the air, they fall.",
  "Demiurgic Colossus: While raging, grow up to Huge size if possible. Reach now increases 10 ft. Giant's Havoc die grows to d8. Mighty Impel can affect Large or smaller creatures."
);

export const BARBARIAN_SUBCLASS_SHEETS: ProgressionSheet[] = [
  PATH_OF_THE_BERSERKER_PROGRESSION,
  PATH_OF_THE_TOTEM_WARRIOR_PROGRESSION,
  PATH_OF_THE_ANCESTRAL_GUARDIAN_PROGRESSION,
  PATH_OF_STORM_HERALD_PROGRESSION,
  PATH_OF_THE_ZEALOT_PROGRESSION,
  PATH_OF_THE_BEAST_PROGRESSION,
  PATH_OF_WILD_MAGIC_PROGRESSION,
  PATH_OF_THE_GIANT_PROGRESSION,
];
