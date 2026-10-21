import type { ProgressionSheet } from "./types";

function oathSheet(subclass: string, f3: string, f7: string, f15: string, f20: string): ProgressionSheet {
  return {
    key: `paladin:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "paladin", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 3, proficiencyBonus: 2, hitDie: 10,
        summary: `${subclass} grants oath spells and Channel Divinity options at oath initiation.`,
        features: [
          { kind: "passive", name: `${subclass}: Oath Spells`, description: `You gain always-prepared oath spells tied to ${subclass} at specified paladin levels.` },
          { kind: "active_action", name: `${subclass}: Channel Divinity`, description: f3, resetsOn: "short_rest" },
        ],
      },
      {
        level: 7, proficiencyBonus: 3, hitDie: 10,
        summary: `${subclass} aura feature comes online and shapes your team role.`,
        features: [
          { kind: "passive", name: `${subclass}: Aura Feature`, description: f7 },
        ],
      },
      {
        level: 15, proficiencyBonus: 5, hitDie: 10,
        summary: `${subclass} grants a high-tier defensive or offensive identity feature.`,
        features: [
          { kind: "passive", name: `${subclass}: High Oath Feature`, description: f15 },
        ],
      },
      {
        level: 20, proficiencyBonus: 6, hitDie: 10,
        summary: `${subclass} capstone transformation/empowerment is unlocked.`,
        features: [
          { kind: "active_action", name: `${subclass}: Oath Capstone`, description: f20, resetsOn: "long_rest" },
        ],
      },
    ],
  };
}

export const OATH_OF_DEVOTION_PROGRESSION = oathSheet(
  "oath of devotion",
  "You can invoke Sacred Weapon to empower attacks with radiant conviction or Turn the Unholy to repel fiends and undead.",
  "Aura of Devotion prevents charm effects on you and nearby allies while conscious.",
  "Purity of Spirit keeps you under a permanent Protection from Evil and Good effect.",
  "Holy Nimbus surrounds you with radiant light that damages hostile creatures and boosts your defensive presence."
);

export const OATH_OF_THE_ANCIENTS_PROGRESSION = oathSheet(
  "oath of the ancients",
  "You can use Nature's Wrath to restrain foes or Turn the Faithless to drive away fey/fiends.",
  "Aura of Warding grants spell damage resistance to you and nearby allies.",
  "Undying Sentinel helps you remain standing at 1 HP when dropped, and mitigates age effects.",
  "Elder Champion heightens regeneration and casting tempo under your primal-radiant form."
);

export const OATH_OF_VENGEANCE_PROGRESSION = oathSheet(
  "oath of vengeance",
  "You can Abjure Enemy to hinder a target or apply Vow of Enmity for single-target focus pressure.",
  "Relentless Avenger lets opportunity strikes translate into repositioning mobility.",
  "Soul of Vengeance enables reaction attacks against your Vow of Enmity target.",
  "Avenging Angel grants fear aura and aerial pursuit in your capstone state."
);

export const OATH_OF_CONQUEST_PROGRESSION = oathSheet(
  "oath of conquest",
  "You can use Conquering Presence to frighten and Guided Strike to guarantee key hits.",
  "Aura of Conquest locks frightened enemies with control damage and movement suppression.",
  "Scornful Rebuke punishes incoming hits with psychic retaliation.",
  "Invincible Conqueror grants resistance, extra attacks, and expanded critical reliability."
);

export const OATH_OF_REDEMPTION_PROGRESSION = oathSheet(
  "oath of redemption",
  "You can Emissary of Peace for social leverage or Rebuke the Violent to reflect burst damage.",
  "Aura of the Guardian lets you absorb ally damage to preserve the team.",
  "Protective Spirit provides end-of-turn regeneration while injured.",
  "Emissary of Redemption turns incoming aggression into self-protection and reflection pressure."
);

export const OATH_OF_GLORY_PROGRESSION = oathSheet(
  "oath of glory",
  "You can use Peerless Athlete for physical bursts and Inspiring Smite for temporary HP support.",
  "Aura of Alacrity accelerates nearby allies to improve initiative and positioning.",
  "Glorious Defense improves AC reaction defense and gives follow-up strike windows.",
  "Living Legend grants reroll control and near-heroic combat consistency."
);

export const OATH_OF_THE_WATCHERS_PROGRESSION = oathSheet(
  "oath of the watchers",
  "You can use Watcher's Will for mental defenses and Abjure the Extraplanar for control.",
  "Aura of the Sentinel improves initiative for you and nearby allies.",
  "Vigilant Rebuke punishes enemy mental pressure with reactive force.",
  "Mortal Bulwark grants anti-extraplanar dominance and stronger control uptime."
);

export const OATHBREAKER_PROGRESSION = oathSheet(
  "oathbreaker",
  "You gain Control Undead and Dreadful Aspect to command or terrify in necrotic style.",
  "Aura of Hate boosts melee damage for you and nearby fiends/undead allies.",
  "Supernatural Resistance grants broad nonmagical weapon durability.",
  "Dread Lord creates darkness-linked fear pressure and persistent necrotic attrition."
);

export const OATH_OF_THE_CROWN_PROGRESSION = oathSheet(
  "oath of the crown",
  "You gain Champion Challenge for area lockdown and Turn the Tide for emergency sustain.",
  "Divine Allegiance lets you redirect ally damage to yourself with reaction defense.",
  "Unyielding Spirit improves control resilience through save rerolls.",
  "Exalted Champion grants high-tier team defense aura and incoming damage mitigation."
);

export const PALADIN_SUBCLASS_SHEETS: ProgressionSheet[] = [
  OATH_OF_DEVOTION_PROGRESSION,
  OATH_OF_THE_ANCIENTS_PROGRESSION,
  OATH_OF_VENGEANCE_PROGRESSION,
  OATH_OF_CONQUEST_PROGRESSION,
  OATH_OF_REDEMPTION_PROGRESSION,
  OATH_OF_GLORY_PROGRESSION,
  OATH_OF_THE_WATCHERS_PROGRESSION,
  OATHBREAKER_PROGRESSION,
  OATH_OF_THE_CROWN_PROGRESSION,
];