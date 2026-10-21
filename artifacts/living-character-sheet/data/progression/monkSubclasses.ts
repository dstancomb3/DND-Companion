import type { ProgressionSheet } from "./types";

/**
 * Monk subclass milestones: 3, 6, 11, 17
 * Way of the Open Hand is already authored in monk.ts; excluded here.
 */
function monkSheet(
  subclass: string,
  f3: string,
  f6: string,
  f11: string,
  f17: string
): ProgressionSheet {
  return {
    key: `monk:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "monk", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 3, proficiencyBonus: 2, hitDie: 8,
        summary: `${subclass} grants its core Monastic Tradition features at level 3.`,
        features: [
          { kind: "passive", name: `${subclass}: Tradition Feature`, description: f3 },
        ],
      },
      {
        level: 6, proficiencyBonus: 3, hitDie: 8,
        summary: `${subclass} expands Monastic Tradition mastery.`,
        features: [
          { kind: "passive", name: `${subclass}: Tradition Expansion`, description: f6 },
        ],
      },
      {
        level: 11, proficiencyBonus: 4, hitDie: 8,
        summary: `${subclass} advanced Tradition feature unlocks at tier 3.`,
        features: [
          { kind: "passive", name: `${subclass}: Tradition Mastery`, description: f11 },
        ],
      },
      {
        level: 17, proficiencyBonus: 6, hitDie: 8,
        summary: `${subclass} capstone Tradition feature reaches its apex.`,
        features: [
          { kind: "passive", name: `${subclass}: Tradition Capstone`, description: f17 },
        ],
      },
    ],
  };
}

export const WAY_OF_SHADOW_PROGRESSION = monkSheet(
  "way of shadow",
  "Shadow Arts: Spend 2 ki to cast Darkness, Darkvision, Pass Without Trace, or Silence (no spell slots). Shadow Step: While in dim light or darkness, bonus action to teleport up to 60 ft to an unoccupied space in dim light or darkness you can see; gain advantage on first melee attack this turn.",
  "Shadow Step already unlocked at level 3. At level 6 you gain: Shadow Step now costs 0 ki; you benefit from advantage on Stealth checks while in dim light or darkness.",
  "Cloak of Shadows: While in dim light or darkness, use your action to become invisible. Invisibility ends when you attack, cast a spell, or enter bright light.",
  "Opportunist: Use a reaction to make one melee attack against a creature within 5 ft that was just attacked by another creature."
);

export const WAY_OF_THE_FOUR_ELEMENTS_PROGRESSION = monkSheet(
  "way of the four elements",
  "Disciple of the Elements: Learn 2 Elemental Disciplines from the list (Elemental Attunement cantrip always available for free). Each discipline costs ki when used. Examples: Fangs of the Fire Snake (2 ki: reach 10 ft, 1d10 fire on unarmed strike), Fist of Four Thunders (2 ki: Thunderwave), Ride the Wind (4 ki: Fly speed), Touch of the Long Death (1+ ki: necrotic damage on touch), Water Whip (2 ki: ranged ki attack, 3d10 + Wis, knockdown/pull), etc. Learn 1 more at 6, 11, and 17.",
  "Additional Elemental Discipline: Learn 1 more discipline. Some disciplines have minimum level requirements. Can replace one known discipline when gaining a level.",
  "Additional Elemental Discipline at level 11. Disciplines requiring 11th level become available (e.g., Ride the Wind, Breath of Winter).",
  "Additional Elemental Discipline at level 17. Disciplines requiring 17th level become available (e.g., Avatar of the Elements: cast Elemental Evil spells, 5 ki each)."
);

export const WAY_OF_THE_LONG_DEATH_PROGRESSION = monkSheet(
  "way of the long death",
  "Touch of Death: When you reduce a creature within 5 ft to 0 HP, gain temporary HP equal to your Wisdom modifier + Monk level (minimum 1). Hour of Reaping: Action to force each creature within 30 ft to make a Wisdom save or be frightened until end of your next turn.",
  "Mastery of Death: When you're reduced to 0 HP, spend 1 ki to instead drop to 1 HP.",
  "Touch of the Long Death: Action, spend 1–10 ki. Touch a creature—it takes 2d10 necrotic damage per ki point spent (Constitution save for half). DC = 8 + PB + Wisdom modifier.",
  "Hollow Shell: While you are incapacitated, you can still take reactions. Additionally, when you are reduced to 0 HP, you can choose to go to 1 HP (costs no ki but can only be used once per turn regardless of Mastery of Death)."
);

export const WAY_OF_THE_SUN_SOUL_PROGRESSION = monkSheet(
  "way of the sun soul",
  "Radiant Sun Bolt: Ranged spell attack using Dexterity or Strength with your ki save DC as the baseline. Range 30 ft, 1d4 + Dex modifier radiant damage. Can spend 1 ki to make 2 additional bolts as a bonus action when you use it as an action.",
  "Searing Arc Strike: Spend 2–6 ki immediately after attacking with Flurry of Blows to cast Burning Hands (DC = ki save DC) at a spell slot level equal to the ki spent minus 1 (minimum 1st level).",
  "Searing Sunburst: Action—hurl a ball of radiant energy to a point within 150 ft: 20-ft-radius sphere, Constitution save or take 2d6 radiant damage (on a failed save; half on success). Spend 0–3 ki to increase by 2d6 per ki point. You can cast this without spending ki.",
  "Sun Shield: Emit bright light 30 ft (dim 30 ft beyond). Reaction when hit by a melee attack: deal 5 + Wisdom modifier radiant damage to the attacker."
);

export const WAY_OF_THE_DRUNKEN_MASTER_PROGRESSION = monkSheet(
  "way of the drunken master",
  "Bonus Proficiencies: Performance, brewer's supplies. Drunken Technique: When you use Flurry of Blows, gain Disengage and 10 ft bonus to walking speed until end of turn.",
  "Tipsy Sway: Leap to Your Feet (when prone, stand for 5 ft of movement instead of half speed). Redirect Attack (when missed by a melee attack, spend 1 ki as a reaction to make the attacker repeat the attack against another creature of your choice within 5 ft).",
  "Drunkard's Luck: Spend 2 ki to remove disadvantage on one attack roll, ability check, or saving throw you make.",
  "Intoxicated Frenzy: When using Flurry of Blows, make up to 3 additional attacks (total of 5 unarmed strikes) provided each attack targets a different creature."
);

export const WAY_OF_THE_KENSEI_PROGRESSION = monkSheet(
  "way of the kensei",
  "Path of the Kensei: Choose 2 weapons (one ranged, one melee must be non-heavy) as Kensei Weapons—they become monk weapons. Agile Parry: If you make an unarmed strike as part of the Attack action on your turn and you're holding a Kensei weapon, gain +2 AC until start of next turn. Kensei's Shot: Bonus action to add 1d4 damage to next successful ranged Kensei weapon hit this turn. Way of the Brush: Gain proficiency with calligrapher's supplies or painter's supplies.",
  "One with the Blade: Kensei attacks count as magical. Sharpen the Blade: Spend 1–3 ki as a bonus action to grant a +1/+2/+3 bonus to attack and damage rolls with a Kensei weapon (lasts 1 minute). Not stackable with existing magical bonuses.",
  "Unerring Accuracy: Once per turn, if you miss with a monk weapon attack, reroll and use the new result.",
  "No additional level 17 feature listed in standard rules beyond Unerring Accuracy carry-forward; ki savings and sharpen-the-blade at +3 continue to define the capstone power ceiling."
);

export const MONK_SUBCLASS_SHEETS: ProgressionSheet[] = [
  WAY_OF_SHADOW_PROGRESSION,
  WAY_OF_THE_FOUR_ELEMENTS_PROGRESSION,
  WAY_OF_THE_LONG_DEATH_PROGRESSION,
  WAY_OF_THE_SUN_SOUL_PROGRESSION,
  WAY_OF_THE_DRUNKEN_MASTER_PROGRESSION,
  WAY_OF_THE_KENSEI_PROGRESSION,
];
