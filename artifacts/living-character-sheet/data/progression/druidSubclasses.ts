import type { ProgressionSheet } from "./types";

/** Druid subclass milestones: 2, 6, 10, 14 */
function druidSheet(
  subclass: string,
  f2: string,
  f6: string,
  f10: string,
  f14: string
): ProgressionSheet {
  return {
    key: `druid:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "druid", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 2, proficiencyBonus: 2, hitDie: 8,
        summary: `${subclass} grants its foundational Circle feature at Wild Shape entry.`,
        features: [
          { kind: "passive", name: `${subclass}: Circle Feature`, description: f2 },
        ],
      },
      {
        level: 6, proficiencyBonus: 3, hitDie: 8,
        summary: `${subclass} mid-tier Circle feature expands core identity.`,
        features: [
          { kind: "passive", name: `${subclass}: Circle Expansion`, description: f6 },
        ],
      },
      {
        level: 10, proficiencyBonus: 4, hitDie: 8,
        summary: `${subclass} advanced Circle feature deepens tier-3 utility.`,
        features: [
          { kind: "passive", name: `${subclass}: Advanced Circle Feature`, description: f10 },
        ],
      },
      {
        level: 14, proficiencyBonus: 5, hitDie: 8,
        summary: `${subclass} capstone Circle feature unlocks peak Circle power.`,
        features: [
          { kind: "passive", name: `${subclass}: Circle Mastery`, description: f14 },
        ],
      },
    ],
  };
}

export const CIRCLE_OF_THE_MOON_PROGRESSION = druidSheet(
  "circle of the moon",
  "Combat Wild Shape: Use Wild Shape as a bonus action. While Wild Shaped, you can expend a spell slot as a bonus action to regain 1d8 HP per slot level. Shapes include CR 1 beasts at level 2 (max CR = floor(level/3) for most beasts).",
  "Primal Strike: Your Wild Shape attacks count as magical for overcoming resistance.",
  "Elemental Wild Shape: Expend two uses of Wild Shape to transform into an air, earth, fire, or water elemental.",
  "Thousand Forms: You can cast Alter Self at will without expending a spell slot."
);

export const CIRCLE_OF_THE_LAND_PROGRESSION = druidSheet(
  "circle of the land",
  "Natural Recovery: Once per short rest, regain expended spell slots totaling up to half your druid level (rounded up). Bonus Circle Spells always prepared based on your chosen land type (Arctic, Coast, Desert, Forest, Grassland, Mountain, Swamp, or Underdark).",
  "Land's Stride: Moving through nonmagical difficult terrain costs no extra movement. You can pass through nonmagical plants without being slowed or damaged.",
  "Nature's Ward: Immune to poison and disease. Immune to charm/frightened effects from fey and elementals.",
  "Nature's Sanctuary: Beasts and plants must succeed on a Wisdom save or be unable to attack you (once attacked they can repeat the save)."
);

export const CIRCLE_OF_SPORES_PROGRESSION = druidSheet(
  "circle of spores",
  "Halo of Spores: Passive reaction aura—when a creature within 10 ft moves, uses Reaction, or stands up from prone, deal 1d4 necrotic damage (Constitution save, scales with level). Symbiotic Entity: Expend a Wild Shape use to gain temp HP (4 × Druid level), enhance Halo of Spores damage to 1d6, and add 1d6 necrotic to melee weapon attacks for 10 minutes.",
  "Fungal Infestation: When a Small or Medium beast or humanoid dies within 10 ft, you can use your reaction to raise it as a zombie under your control for 1 hour (once per corpse, up to Wisdom modifier zombies active).",
  "Spreading Spores: While Symbiotic Entity is active, replace Halo of Spores with Concentration: plant a 10-ft-cube of spores that automatically harms creatures that enter or start their turn there.",
  "Fungal Body: Gain immunity to blinded, deafened, frightened, and poisoned conditions. Critical hits against you become normal hits unless you're incapacitated."
);

export const CIRCLE_OF_STARS_PROGRESSION = druidSheet(
  "circle of stars",
  "Star Map: Gain a star map focus that always has Guidance and Guiding Bolt prepared. Guiding Bolt is cast without a spell slot once per long rest. Starry Form: Expend a Wild Shape use to take a constellation form for 10 minutes: Archer (bonus action radiant attack each turn), Chalice (heal self or adjacent ally when casting concentration spell), Dragon (see starlight—no disadvantage on Perception in dim light, minimum d6 on Wisdom checks).",
  "Cosmic Omen: On a long rest, roll a die: odd = Weal, even = Woe. Reaction to add/subtract 1d6 to any roll you can see (Weal = add, Woe = subtract). Usable Proficiency Bonus times per long rest.",
  "Twinkling Constellations: While in Starry Form, Archer deals 2d8 radiant/bonus action, Chalice heals 2d8+Wis, Dragon enables flight 20 ft. Each turn you can switch constellation form.",
  "Full of Stars: While in Starry Form, you become partially incorporeal—gain resistance to bludgeoning, piercing, and slashing damage."
);

export const CIRCLE_OF_WILDFIRE_PROGRESSION = druidSheet(
  "circle of wildfire",
  "Circle Spells: Burning Hands, Cure Wounds, Flaming Sphere, Scorching Ray, Plant Growth, Revivify, Aura of Life, Fire Shield always prepared. Summon Wildfire Spirit: Expend a Wild Shape use to summon a CR-1 Wildfire Spirit companion (acts on your initiative, obeys your commands, teleports allies from fire).",
  "Enhanced Bond: When you cast a spell that deals fire damage or restores HP, add 1d8 to the roll if your Wildfire Spirit is within 60 ft.",
  "Cauterizing Flames: When a Small or larger creature dies within 30 ft, a spectral flame appears there. You or an ally within 60 ft can use a bonus action to touch it and regain 2d10 + Wisdom modifier HP (usable Wisdom modifier times per long rest).",
  "Blazing Revival: Wildfire Spirit can save you from death once per long rest—when you drop to 0 HP within 120 ft of the spirit, it moves to you, you drop to 1 HP, and the spirit vanishes."
);

export const CIRCLE_OF_DREAMS_PROGRESSION = druidSheet(
  "circle of dreams",
  "Balm of the Summer Court: Pool of healing = Druid level × d6. Use a bonus action to spend dice from this pool to heal a creature you can see within 120 ft (total restored = dice roll + Wisdom modifier; also grant temp HP equal to dice roll).",
  "Hearth of Moonlight and Shadow: During a short or long rest, create a 30-ft-radius magical aura. Dim light within; invisible from outside; difficult to penetrate with Perception from beyond.",
  "Hidden Paths: Use a bonus action to teleport up to 60 ft to a visible unoccupied space. Or as a reaction when a creature you can see moves, teleport that creature up to 30 ft to an unoccupied space it can see. Usable Wisdom modifier times per long rest.",
  "Walker in Dreams: After a short rest, can cast Dream, Scrying, or Teleportation Circle without a spell slot (target = current location or somewhere known). Usable once per long rest."
);

export const CIRCLE_OF_SHEPHERD_PROGRESSION = druidSheet(
  "circle of shepherd",
  "Speech of the Woods: Speak with animals as always-prepared spell; comprehend speech of beasts at will. Spirit Totem: Bonus action—summon a spirit totem in a 30-ft aura for 1 minute: Bear (grant HP equal to 5 + double Druid level to all in aura), Hawk (give advantage on attack rolls vs. one target per turn via reaction), Unicorn (grant advantage on all ability checks to detect creatures in aura; spells that restore HP heal each creature in aura for 1d8 extra).",
  "Mighty Summoner: Beasts and fey summoned by your spells have +2 HP per Hit Die and their natural weapons count as magical.",
  "Guardian Spirit: Beasts and fey summoned by your spells gain resistance to all damage while in your Spirit Totem aura.",
  "Faithful Summons: If you are incapacitated or die, you immediately summon 4 guardian spirits equivalent to CR 2 beast/fey. They appear in unoccupied spaces within 20 ft and act on your initiative, lasting 1 hour or until dismissed."
);

export const DRUID_SUBCLASS_SHEETS: ProgressionSheet[] = [
  CIRCLE_OF_THE_MOON_PROGRESSION,
  CIRCLE_OF_THE_LAND_PROGRESSION,
  CIRCLE_OF_SPORES_PROGRESSION,
  CIRCLE_OF_STARS_PROGRESSION,
  CIRCLE_OF_WILDFIRE_PROGRESSION,
  CIRCLE_OF_DREAMS_PROGRESSION,
  CIRCLE_OF_SHEPHERD_PROGRESSION,
];
