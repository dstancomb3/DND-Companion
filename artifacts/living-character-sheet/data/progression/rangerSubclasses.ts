import type { ProgressionSheet } from "./types";

function rangerSheet(subclass: string, f3: string, f7: string, f11: string, f15: string): ProgressionSheet {
  return {
    key: `ranger:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "ranger", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 3, proficiencyBonus: 2, hitDie: 10,
        summary: `${subclass} core combat package and subclass spell identity begin here.`,
        features: [
          { kind: "passive", name: `${subclass}: Archetype Core`, description: f3 },
        ],
      },
      {
        level: 7, proficiencyBonus: 3, hitDie: 10,
        summary: `${subclass} defensive/mobility refinement comes online.`,
        features: [
          { kind: "passive", name: `${subclass}: Mid Archetype Feature`, description: f7 },
        ],
      },
      {
        level: 11, proficiencyBonus: 4, hitDie: 10,
        summary: `${subclass} major damage/control identity upgrade at tier 3.`,
        features: [
          { kind: "passive", name: `${subclass}: Advanced Archetype Feature`, description: f11 },
        ],
      },
      {
        level: 15, proficiencyBonus: 5, hitDie: 10,
        summary: `${subclass} capstone archetype feature unlocks.`,
        features: [
          { kind: "passive", name: `${subclass}: Capstone Archetype Feature`, description: f15 },
        ],
      },
    ],
  };
}

export const HUNTER_PROGRESSION = rangerSheet(
  "hunter",
  "Hunter's Prey grants a chosen damage/control rider (Colossus Slayer, Giant Killer, or Horde Breaker).",
  "Defensive Tactics grants a chosen defensive mode (Escape the Horde, Multiattack Defense, or Steel Will).",
  "Multiattack grants Volley or Whirlwind Attack for high-target pressure.",
  "Superior Hunter's Defense grants Evasion, Stand Against the Tide, or Uncanny Dodge style mitigation."
);

export const BEAST_MASTER_PROGRESSION = rangerSheet(
  "beast master",
  "Ranger's Companion binds a beast ally into your action economy and tactical plan.",
  "Exceptional Training improves beast command flexibility and utility in battle.",
  "Bestial Fury upgrades companion offense with extra attack cadence.",
  "Share Spells lets your self-target spells also affect your companion when nearby."
);

export const GLOOM_STALKER_PROGRESSION = rangerSheet(
  "gloom stalker",
  "Dread Ambusher and Umbral Sight establish alpha-strike tempo and darkness stealth pressure.",
  "Iron Mind grants Wisdom save proficiency for stronger control resistance.",
  "Stalker's Flurry smooths missed-attack variance with extra strike opportunities.",
  "Shadowy Dodge adds reaction-based miss pressure against hostile attacks."
);

export const HORIZON_WALKER_PROGRESSION = rangerSheet(
  "horizon walker",
  "Detect Portal and Planar Warrior define force-damage conversion and planar tracking utility.",
  "Ethereal Step grants short-range phase repositioning for safety and angles.",
  "Distant Strike adds teleport-linked multi-target offense during Attack actions.",
  "Spectral Defense grants reaction-based damage resistance after incoming hits."
);

export const MONSTER_SLAYER_PROGRESSION = rangerSheet(
  "monster slayer",
  "Hunter's Sense and Slayer's Prey establish mark-and-exploit monster hunting loops.",
  "Supernatural Defense improves saves and escape durability against marked threats.",
  "Magic-User's Nemesis interrupts hostile spellcasting and teleport attempts.",
  "Slayer's Counter enables reaction attacks or counter-pressure against forced-save effects."
);

export const FEY_WANDERER_PROGRESSION = rangerSheet(
  "fey wanderer",
  "Dreadful Strikes and Fey Wanderer magic create psychic rider pressure and charm identity.",
  "Beguiling Twist turns charm/fear saves into battlefield redirection opportunities.",
  "Fey Reinforcements upgrades summon cadence and control utility.",
  "Misty Wanderer grants team teleport utility and stronger battlefield repositioning."
);

export const SWARMKEEPER_PROGRESSION = rangerSheet(
  "swarmkeeper",
  "Gathered Swarm gives each hit push/drag/self-reposition options with swarm flavor.",
  "Writhing Tide adds temporary hover mobility and vertical control windows.",
  "Mighty Swarm upgrades Gathered Swarm with stronger movement and mitigation effects.",
  "Swarming Dispersal grants reaction reposition and damage reduction through swarm dispersal."
);

export const RANGER_SUBCLASS_SHEETS: ProgressionSheet[] = [
  HUNTER_PROGRESSION,
  BEAST_MASTER_PROGRESSION,
  GLOOM_STALKER_PROGRESSION,
  HORIZON_WALKER_PROGRESSION,
  MONSTER_SLAYER_PROGRESSION,
  FEY_WANDERER_PROGRESSION,
  SWARMKEEPER_PROGRESSION,
];