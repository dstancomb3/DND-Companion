import type { ProgressionSheet } from "./types";

/** Artificer subclass milestones: 3, 5, 9, 15 */
function artificerSheet(
  subclass: string,
  f3: string,
  f5: string,
  f9: string,
  f15: string
): ProgressionSheet {
  return {
    key: `artificer:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "artificer", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 3, proficiencyBonus: 2, hitDie: 8,
        summary: `${subclass} grants its Specialist features at level 3.`,
        features: [
          { kind: "passive", name: `${subclass}: Specialist Feature`, description: f3 },
        ],
      },
      {
        level: 5, proficiencyBonus: 3, hitDie: 8,
        summary: `${subclass} expands with an additional Specialist ability.`,
        features: [
          { kind: "passive", name: `${subclass}: Specialist Expansion`, description: f5 },
        ],
      },
      {
        level: 9, proficiencyBonus: 4, hitDie: 8,
        summary: `${subclass} advanced Specialist feature unlocks at tier 3.`,
        features: [
          { kind: "passive", name: `${subclass}: Specialist Mastery`, description: f9 },
        ],
      },
      {
        level: 15, proficiencyBonus: 5, hitDie: 8,
        summary: `${subclass} capstone Specialist feature reaches its apex.`,
        features: [
          { kind: "passive", name: `${subclass}: Specialist Capstone`, description: f15 },
        ],
      },
    ],
  };
}

export const ALCHEMIST_PROGRESSION = artificerSheet(
  "alchemist",
  "Alchemist Spells: Healing Word, Ray of Sickness, Flaming Sphere, Melf's Acid Arrow, Gaseous Form, Mass Healing Word, Blight, Death Ward, Cloudkill, Raise Dead—always prepared. Tool Proficiency: Alchemist's supplies. Experimental Elixir: After each long rest, create Artificer level / 2 experimental elixirs using alchemist's supplies (or spend a spell slot for more). Roll d6 to determine effect: Healing (2d4+Int mod), Swiftness (+10 ft speed), Resilience (resistance to one damage type until next rest), Boldness (Bless effect for 1 minute), Flight (10 ft fly speed for 10 minutes), Transformation (Alter Self for 10 minutes).",
  "Alchemical Savant: When you cast a spell using alchemist's supplies as the spellcasting focus, add Intelligence modifier bonus to one damage or healing roll of the spell.",
  "Restorative Reagents: Spend 1 minute and alchemist's supplies to create a potion of healing (2d4+2 HP) without a spell slot. Additionally, cast Lesser Restoration without a spell slot (Intelligence modifier times per long rest).",
  "Chemical Mastery: Gain resistance to acid and poison damage and immunity to the poisoned condition. Cast Greater Restoration and Heal once each without a spell slot per long rest (use alchemist's supplies as the material component)."
);

export const ARMORER_PROGRESSION = artificerSheet(
  "armorer",
  "Armorer Spells: Magic Missile, Thunderwave, Mirror Image, Shatter, Hypnotic Pattern, Lightning Bolt, Fire Shield, Greater Invisibility, Passwall, Wall of Force—always prepared. Tool Proficiency: Smith's tools (and proficiency in heavy armor if not already). Arcane Armor: Infuse a suit of armor as your arcane armor—it can't be removed against your will, counts as a spellcasting focus, replaces missing limbs, and you can don/doff it as an action. Choose a model: Guardian (Thunder Gauntlets—target has disadvantage on attacks not aimed at you; Defensive Field—bonus action for temp HP = Artificer level) or Infiltrator (Lightning Launcher—ranged attack 30/90 ft for 1d6 lightning; Powered Steps—+5 ft speed; Dampening Field—advantage on Stealth checks despite armor).",
  "Armor Model: Switch armor model when you use Arcane Armor. Extra Attack: Attack twice when you take the Attack action.",
  "Armor Modifications: Your arcane armor can hold up to 4 infusions at once (normally armor counts as one object).",
  "Perfected Armor: Guardian = magical force field reacts when a creature within 30 ft is hit—use a reaction to pull it 30 ft toward you and make an attack against it (1d6 + Int mod force). Infiltrator = when you hit a creature with Lightning Launcher, mark it for 1 minute; attacks against marked creature deal +1d6 lightning once per turn (yours or an ally's)."
);

export const ARTILLERIST_PROGRESSION = artificerSheet(
  "artillerist",
  "Artillerist Spells: Shield, Thunderwave, Scorching Ray, Shatter, Fireball, Wind Wall, Ice Storm, Wall of Fire, Cone of Cold, Wall of Force—always prepared. Tool Proficiency: Woodcarver's tools. Eldritch Cannon: Use an action and woodcarver's tools or smith's tools to create a Small/Tiny Eldritch Cannon in an unoccupied space within 5 ft. Choose type: Flamethrower (15-ft cone, Dex save or 2d8 fire), Force Ballista (ranged spell attack, 2d8 force + push 5 ft), Protector (all creatures of choice within 10 ft gain 1d8 + Int mod temp HP each turn). Cannon has AC 18, HP = 5 × Artificer level; bonus action to activate it. Lasts 1 hour.",
  "Explosive Cannon: Your Eldritch Cannon's damage increases to 3d8. As an action, boom the cannon—it explodes in a 20-ft radius (Dex save or 3d8 force damage, destroyed after). This deals damage instead of the cannon's regular attack.",
  "Fortified Position: Can create two Eldritch Cannons at once. While within 10 ft of at least one of your cannons, you and your allies have half cover.",
  "Master Artillerist (not a standard level 15 feature in base UA—capstone): Eldritch Cannon damage increases to 4d8. Additionally, your cannon's activation is a free object interaction rather than a bonus action once per turn."
);

export const BATTLE_SMITH_PROGRESSION = artificerSheet(
  "battle smith",
  "Battle Smith Spells: Heroism, Shield, Branding Smite, Warding Bond, Aura of Vitality, Conjure Barrage, Aura of Purity, Fire Shield, Banishing Smite, Mass Cure Wounds—always prepared. Tool Proficiency: Smith's tools. Battle Ready: Gain martial weapon proficiency. When attacking with a magic weapon, can use Intelligence instead of Strength or Dexterity for attack and damage rolls. Steel Defender: Bonus action after a long rest to create a Steel Defender (uses stat block). Shares your initiative, obeys your verbal commands. It can move and use its reaction. You use a bonus action to command it to move or attack; otherwise spends its turns Dodging.",
  "Extra Attack: Attack twice when you take the Attack action.",
  "Arcane Jolt: Once per turn when your Steel Defender or a magic weapon you wield hits, deal an extra 2d6 force damage to the target OR cause the hit to restore 2d6 HP to a creature within 30 ft of the target. Usable Intelligence modifier times per long rest.",
  "Improved Defender: Steel Defender's Deflect Attack reaction now reduces damage by 1d4 + Intelligence modifier. Steel Defender's attacks deal +4 force damage. Arcane Jolt increases to 4d6."
);

export const ARTIFICER_SUBCLASS_SHEETS: ProgressionSheet[] = [
  ALCHEMIST_PROGRESSION,
  ARMORER_PROGRESSION,
  ARTILLERIST_PROGRESSION,
  BATTLE_SMITH_PROGRESSION,
];
