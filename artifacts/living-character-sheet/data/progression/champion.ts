import type { ProgressionSheet } from "./types";

// ── Champion (Fighter Subclass) ───────────────────────────────────────────────

export const CHAMPION_PROGRESSION: ProgressionSheet = {
  key: "fighter:champion",
  source: "subclass",
  appliesTo: { class: "fighter", subclass: "champion" },
  levels: [
    {
      level: 3, proficiencyBonus: 2, hitDie: 10,
      summary: "Improved Critical triggers on rolls of 19-20 instead of just 20, making you more deadly in combat.",
      features: [
        { kind: "passive", name: "Improved Critical", description: "Your weapon attacks score a critical hit on a roll of 19 or 20. At 15th level, this improves to 18-20." },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 10,
      summary: "Remarkable Athlete lets you add your proficiency bonus to Strength, Dexterity, and Constitution checks you aren't already proficient in.",
      features: [
        { kind: "passive", name: "Remarkable Athlete", description: "You can add your proficiency bonus to any Strength, Dexterity, or Constitution check you make that doesn't already include your proficiency bonus. This bonus applies to initiative rolls." },
      ],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 10,
      summary: "Additional Fighting Style lets you choose another fighting style or improve an existing one.",
      features: [
        { kind: "passive", name: "Additional Fighting Style", description: "You can choose a second option from the Fighting Style class feature. If you already benefit from Fighting Style, you can choose to gain another benefit from that feature." },
      ],
    },
    {
      level: 15, proficiencyBonus: 4, hitDie: 10,
      summary: "Superior Critical improves your critical hit threshold to 18-20.",
      features: [
        { kind: "passive", name: "Superior Critical", description: "Your weapon attacks now score a critical hit on a roll of 18, 19, or 20." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 10,
      summary: "Survivor grants you the ability to regain hit points when you hit with an attack and have fewer than half your hit points remaining.",
      features: [
        { kind: "passive", name: "Survivor", description: "You attain the pinnacle of resilience in battle. At the start of each of your turns, you regain 5 hit points if you have at least 1 hit point and haven't moved since your last turn. If you have moved, you don't regain these hit points." },
      ],
    },
  ],
};
