import type { ProgressionSheet } from "./types";

// ── Cleric core ───────────────────────────────────────────────────────────────

export const CLERIC_PROGRESSION: ProgressionSheet = {
  key: "cleric",
  source: "class",
  appliesTo: { class: "cleric" },
  levels: [
    {
      level: 1, proficiencyBonus: 2, hitDie: 8,
      summary: "You choose your Divine Domain at level 1 and gain access to Channel Divinity to turn undead or invoke domain-specific effects.",
      features: [
        { kind: "subclass", prompt: "Choose your Divine Domain. Your domain grants spells, Channel Divinity options, and features at levels 1, 2, 6, 8, and 17." },
        { kind: "passive", name: "Spellcasting", description: "You prepare spells equal to your WIS modifier + your cleric level. You prepare spells from the cleric spell list using WIS as your spellcasting ability." },
        { kind: "active_action", name: "Channel Divinity: Turn Undead", description: "As an action, you present your holy symbol and speak a prayer censuring the undead. Each undead that can see or hear you within 30 feet must make a WIS saving throw. If the creature fails its save, it must flee for 1 minute or until it takes any damage." },
      ],
    },
    {
      level: 2, proficiencyBonus: 2, hitDie: 8,
      summary: "Additional Channel Divinity options from your Domain unlock powerful class abilities.",
      features: [
        { kind: "passive", name: "Channel Divinity Uses", description: "You gain an additional Channel Divinity use. You regain all expended uses when you finish a short or long rest. At 6th level you gain another use, at 18th level you gain two more." },
      ],
    },
    {
      level: 3, proficiencyBonus: 2, hitDie: 8,
      summary: "Your Divine Domain grants features that define your combat and out-of-combat capabilities.",
      features: [
        { kind: "passive", name: "Divine Domain Feature", description: "You gain an additional feature from your chosen Divine Domain." },
      ],
    },
    {
      level: 4, proficiencyBonus: 2, hitDie: 8,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 5, proficiencyBonus: 3, hitDie: 8,
      summary: "Destroy Undead lets you automatically destroy undead of CR 1/8 and below when they fail Turn Undead saves.",
      features: [
        { kind: "passive", name: "Destroy Undead (CR 1/8)", description: "When an undead fails its saving throw against your Turn Undead feature, the creature is instantly destroyed if its challenge is 1/8 or lower." },
      ],
    },
    {
      level: 6, proficiencyBonus: 3, hitDie: 8,
      summary: "Channel Divinity uses increase. Your Divine Domain grants another feature.",
      features: [
        { kind: "passive", name: "Divine Domain Feature", description: "You gain another feature from your chosen Divine Domain." },
      ],
    },
    {
      level: 7, proficiencyBonus: 3, hitDie: 8,
      summary: "No new features—your ability to utilize existing ones scales with your spell slots.",
      features: [],
    },
    {
      level: 8, proficiencyBonus: 3, hitDie: 8,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 9, proficiencyBonus: 4, hitDie: 8,
      summary: "No new features—your spell-casting and channel divinity options continue to scale.",
      features: [],
    },
    {
      level: 10, proficiencyBonus: 4, hitDie: 8,
      summary: "Divine Intervention allows you to call upon your deity for aid once per long rest.",
      features: [
        { kind: "active_action", name: "Divine Intervention", description: "You can ask your deity to intervene on your behalf. Describe what help you seek, and roll a percentile die. If the result is less than or equal to your cleric level, your deity intervenes. If your deity intervenes, you can't use this feature again until you finish a long rest. Otherwise, you can use it again after you finish a long rest." },
      ],
    },
    {
      level: 11, proficiencyBonus: 4, hitDie: 8,
      summary: "Destroy Undead improves—you now instantly destroy undead of CR 1/4 or below.",
      features: [
        { kind: "passive", name: "Destroy Undead (CR 1/4)", description: "The CR limit for your Destroy Undead feature increases to 1/4." },
      ],
    },
    {
      level: 12, proficiencyBonus: 4, hitDie: 8,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 13, proficiencyBonus: 5, hitDie: 8,
      summary: "No new features—your spellcasting power continues to grow with higher-level spell slots.",
      features: [],
    },
    {
      level: 14, proficiencyBonus: 5, hitDie: 8,
      summary: "Restore Life and Limb allows you to cast revivify without expending a spell slot once per day.",
      features: [
        { kind: "passive", name: "Restore Life and Limb", description: "You can cast the revify spell without expending a spell slot. You can do so a number of times equal to your WIS modifier (minimum once), and you regain all expended uses when you finish a long rest." },
      ],
    },
    {
      level: 15, proficiencyBonus: 5, hitDie: 8,
      summary: "Destroy Undead improves further—you now instantly destroy undead of CR 1 or below.",
      features: [
        { kind: "passive", name: "Destroy Undead (CR 1)", description: "The CR limit for your Destroy Undead feature increases to 1." },
      ],
    },
    {
      level: 16, proficiencyBonus: 5, hitDie: 8,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 17, proficiencyBonus: 6, hitDie: 8,
      summary: "Your Divine Domain grants one final signature feature.",
      features: [
        { kind: "passive", name: "Divine Domain Feature", description: "You gain your final feature from your chosen Divine Domain." },
      ],
    },
    {
      level: 18, proficiencyBonus: 6, hitDie: 8,
      summary: "Channel Divinity uses increase again, granting more flexibility in combat.",
      features: [
        { kind: "passive", name: "Channel Divinity Uses", description: "You gain two more Channel Divinity uses (total of 4 at this level)." },
      ],
    },
    {
      level: 19, proficiencyBonus: 6, hitDie: 8,
      summary: "Ability Score Improvement or Feat.",
      features: [
        { kind: "asi" },
      ],
    },
    {
      level: 20, proficiencyBonus: 6, hitDie: 8,
      summary: "Divine Intervention Improvement makes your deity more likely to respond to your pleas.",
      features: [
        { kind: "passive", name: "Divine Intervention (Improved)", description: "Your Divine Intervention feature now works on a result of 2 or lower instead of a number equal to your cleric level." },
      ],
    },
  ],
};
