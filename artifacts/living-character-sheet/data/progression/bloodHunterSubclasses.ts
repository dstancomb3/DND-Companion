import type { ProgressionSheet } from "./types";

/** Blood Hunter subclass milestones: 3, 7, 11, 15, 18 */
function bloodHunterSheet(
  subclass: string,
  f3: string,
  f7: string,
  f11: string,
  f15: string,
  f18: string
): ProgressionSheet {
  return {
    key: `blood hunter:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "blood hunter", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 3, proficiencyBonus: 2, hitDie: 10,
        summary: `${subclass} grants its Order features and hemocraft rituals at level 3.`,
        features: [
          { kind: "passive", name: `${subclass}: Order Feature`, description: f3 },
        ],
      },
      {
        level: 7, proficiencyBonus: 3, hitDie: 10,
        summary: `${subclass} expands its Order identity at level 7.`,
        features: [
          { kind: "passive", name: `${subclass}: Order Expansion`, description: f7 },
        ],
      },
      {
        level: 11, proficiencyBonus: 4, hitDie: 10,
        summary: `${subclass} advanced Order feature unlocks at tier 3.`,
        features: [
          { kind: "passive", name: `${subclass}: Order Mastery`, description: f11 },
        ],
      },
      {
        level: 15, proficiencyBonus: 5, hitDie: 10,
        summary: `${subclass} senior Order feature deepens hemocraft mastery.`,
        features: [
          { kind: "passive", name: `${subclass}: Senior Order Feature`, description: f15 },
        ],
      },
      {
        level: 18, proficiencyBonus: 6, hitDie: 10,
        summary: `${subclass} capstone Order feature unlocks the pinnacle of the order's arts.`,
        features: [
          { kind: "passive", name: `${subclass}: Order Capstone`, description: f18 },
        ],
      },
    ],
  };
}

export const ORDER_OF_THE_GHOSTSLAYER_PROGRESSION = bloodHunterSheet(
  "order of the ghostslayer",
  "Rite of the Dawn: Learn the Rite of the Dawn (imbue your weapon with radiant energy; Crimson Rite deals radiant damage and deals max damage against undead). Curse Specialist: Gain advantage on saving throws against being cursed, and your Crimson Rite psionic tendrils can seek out incorporeal undead within 30 ft.",
  "Ethereal Step: At the start of your turn, you can spend 1 Blood Point to become ethereal until start of your next turn (move through solid objects, immune to non-magical damage). You must appear in an unoccupied space at the end of each turn.",
  "Brand of Sundering: Your blood curse brand tears the veil—a creature branded with your Blood Curse of the Eyeless is also partially ethereal and cannot take Reactions. Rite of the Dawn: now also frees trapped souls when an undead dies to your Rite-imbued weapon.",
  "Blood Curse of the Exorcist: Your curses repel undead with extreme force. When you start applying a Blood Curse, undead within 30 ft have disadvantage on saving throws against it.",
  "Rite Revival: When you reduce an undead to 0 HP with your Rite of the Dawn weapon, regain HP equal to your Intelligence modifier + half Blood Hunter level. Additionally, your Rite of the Dawn weapon deals an extra die of Crimson Rite damage to undead."
);

export const ORDER_OF_THE_PROFANE_SOUL_PROGRESSION = bloodHunterSheet(
  "order of the profane soul",
  "Otherworldly Patron: Choose a Warlock patron (Archfey, Fiend, or Great Old One). Gain that patron's Expanded Spell list. Pact Magic: Gain Warlock spell slots (1 slot at level 3, scaling up). Intelligence is your spellcasting ability for Blood Hunter spells; Wisdom for Profane Soul Warlock features. Eldritch Invocations: Gain one Eldritch Invocation from the Warlock list at level 3.",
  "Mystic Frenzy: When you use your action to cast a cantrip, make one weapon attack as a bonus action.",
  "Revealed Arcana: Once per long rest, cast one of your patron's normally-restricted spells (from expanded list if available) without a spell slot.",
  "Blood Curse of the Souleater: When a creature dies within 30 ft, you can use a reaction to absorb part of its soul—regain one expended Pact Magic spell slot.",
  "Vessel Impervious: You gain resistance to one damage type based on your patron (Archfey = psychic, Fiend = fire, Great Old One = necrotic). Additionally, your Pact Magic slot count increases by 1."
);

export const ORDER_OF_THE_MUTANT_PROGRESSION = bloodHunterSheet(
  "order of the mutant",
  "Mutagen Synthesis: Learn the art of hemocraft mutagens. After a long rest, create a number of mutagens equal to your Intelligence modifier. Each mutagen provides a benefit and a drawback simultaneously. Choose from the full mutagen list (examples: Aether—flight 20 ft + vulnerability to force; Embers—fire damage immunity + vulnerability to cold; Potency—Strength +3 + disadvantage on Dex saves; Reconstruction—regain 1d6 HP at turn start + cannot regain HP in other ways, etc.). Apply as a bonus action; lasts 1 hour.",
  "Strange Metabolism: Gain immunity to the poisoned condition and resistance to poison damage. Additionally, your mutagens last until dispelled or you create new ones (no longer expire after 1 hour).",
  "Brand of Axiom: Creatures affected by your Blood Curse cannot benefit from illusion spells or magic. Additionally, when you cast a spell on a cursed creature, treat all 1s and 2s on damage dice as 3s.",
  "Exquisite Mutation: When you take the bonus action to apply a mutagen, apply two mutagens simultaneously (and suffer both drawbacks). Additionally, you have advantage on saving throws vs. your own mutagen drawbacks.",
  "Mutation Master: Craft a number of mutagens equal to double your Intelligence modifier. When you apply a mutagen you can ignore the drawback for one turn (Intelligence modifier times per long rest)."
);

export const ORDER_OF_THE__LYCAN_PROGRESSION = bloodHunterSheet(
  "order of the lycan",
  "Heightened Senses: Advantage on Perception checks using sight or smell. Hybrid Transformation: Use a bonus action to enter a Hybrid form for 1 hour (or until knocked unconscious or transformed back). While hybrid: natural weapons count as magical, gain one Hybrid Transformation Benefit per upgrade level (Predatory Strikes—unarmed strikes deal 1d6 slashing; Improved Defense—AC bonus +1; Lycan Regeneration—regain 1 HP at start of turn if above 0 HP). Cursed Weakness: Vulnerability to silvered weapons while Hybrid.",
  "Stalker's Prowess: Speed increases by 10 ft. Add Wisdom modifier to Stealth checks. In Hybrid form, bonus action to Charge—move up to 20 ft in a straight line toward a creature and make one melee attack with advantage on the same turn.",
  "Advanced Transformation: Gain Lycan Regeneration in Hybrid form (regain 1 HP per turn). Increase unarmed strike damage die to 1d8. An additional Hybrid Transformation Benefit: Beastly Precision—advantage on melee attack rolls in hybrid form.",
  "Lycan Curse Defense: When in Hybrid form, gain resistance to bludgeoning, piercing, and slashing from nonmagical, non-silvered weapons.",
  "The Pack Leader: While in Hybrid form, allies within 30 ft gain advantage on melee attack rolls against creatures you've attacked this turn. Additionally, Hybrid Transformation no longer causes you to lose control—the Feral Impulse table no longer applies for you."
);

export const BLOOD_HUNTER_SUBCLASS_SHEETS: ProgressionSheet[] = [
  ORDER_OF_THE_GHOSTSLAYER_PROGRESSION,
  ORDER_OF_THE_PROFANE_SOUL_PROGRESSION,
  ORDER_OF_THE_MUTANT_PROGRESSION,
  ORDER_OF_THE__LYCAN_PROGRESSION,
];
