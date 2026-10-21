import type { ProgressionSheet } from "./types";

/** Sorcerer subclass milestones: 1, 6, 14, 18 */
function sorcererSheet(
  subclass: string,
  f1: string,
  f6: string,
  f14: string,
  f18: string
): ProgressionSheet {
  return {
    key: `sorcerer:${subclass.toLowerCase()}`,
    source: "subclass",
    appliesTo: { class: "sorcerer", subclass: subclass.toLowerCase() },
    levels: [
      {
        level: 1, proficiencyBonus: 2, hitDie: 6,
        summary: `${subclass} grants its defining bloodline or origin feature at character creation.`,
        features: [
          { kind: "passive", name: `${subclass}: Origin Feature`, description: f1 },
        ],
      },
      {
        level: 6, proficiencyBonus: 3, hitDie: 6,
        summary: `${subclass} expands its power at tier 2.`,
        features: [
          { kind: "passive", name: `${subclass}: Origin Expansion`, description: f6 },
        ],
      },
      {
        level: 14, proficiencyBonus: 5, hitDie: 6,
        summary: `${subclass} reaches apex expression of its origin.`,
        features: [
          { kind: "passive", name: `${subclass}: Origin Apex`, description: f14 },
        ],
      },
      {
        level: 18, proficiencyBonus: 6, hitDie: 6,
        summary: `${subclass} grants its capstone origin power.`,
        features: [
          { kind: "passive", name: `${subclass}: Origin Capstone`, description: f18 },
        ],
      },
    ],
  };
}

export const DRACONIC_BLOODLINE_PROGRESSION = sorcererSheet(
  "draconic bloodline",
  "Dragon Ancestor: Choose a dragon type; gain that damage type for Draconic Resilience and Elemental Affinity. Draconic Resilience: HP max increases by 1 per Sorcerer level; when not wearing armor, AC = 13 + Dexterity modifier.",
  "Elemental Affinity: When you cast a spell dealing damage matching your dragon ancestor's type, add Charisma modifier to one damage roll. Spend 1 sorcery point to gain resistance to that damage type for 1 hour.",
  "Dragon Wings: Bonus action to sprout dragon wings, gaining fly speed equal to your walking speed. Wings appear unless wearing armor not designed for them.",
  "Draconic Presence: Spend 5 sorcery points to exude an aura of awe or fear in a 60-ft radius for 1 minute. Each hostile creature that starts its turn in the aura must succeed on a Wisdom save or be charmed (awe) or frightened (fear) for the duration."
);

export const WILD_MAGIC_PROGRESSION = sorcererSheet(
  "wild magic",
  "Wild Magic Surge: After casting a 1st-level or higher spell, the DM can ask you to roll a d20; on a 1, roll on the Wild Magic Surge table. Tides of Chaos: Once per long rest, gain advantage on one attack roll, ability check, or saving throw. After using Tides of Chaos, the DM may trigger a Wild Magic Surge without the roll.",
  "Bend Luck: Spend 2 sorcery points as a reaction to add or subtract 1d4 from another creature's attack roll, ability check, or saving throw.",
  "Controlled Chaos: Whenever you roll on the Wild Magic Surge table, roll twice and choose either result.",
  "Spell Bombardment: Once per turn, when you roll damage for a spell and roll the highest possible result on any die, roll that die again and add it to the total."
);

export const STORM_SORCERY_PROGRESSION = sorcererSheet(
  "storm sorcery",
  "Wind Speaker: You can speak, read, and write Primordial (and its four dialects). Tempestuous Magic: Immediately after casting a 1st-level or higher spell, you can use a bonus action to fly up to 10 ft without provoking opportunity attacks.",
  "Heart of the Storm: Gain resistance to lightning and thunder damage. When you cast a 1st-level or higher spell that deals lightning or thunder damage, creatures of your choice within 10 ft take lightning or thunder damage equal to half your Sorcerer level.",
  "Storm's Fury: When hit by a melee attack, use a reaction to deal lightning damage equal to your Sorcerer level to the attacker (Constitution save for half) and push them up to 20 ft away on a failed save.",
  "Wind Soul: Gain immunity to lightning and thunder damage and a fly speed of 60 ft. As an action, reduce your fly speed to 30 ft for 1 hour and give up to 3 willing creatures you can see a 30-ft fly speed for the same duration."
);

export const DIVINE_SOUL_PROGRESSION = sorcererSheet(
  "divine soul",
  "Divine Magic: Add one spell from the Cleric spell list to your known spells (counts as a Sorcerer spell). Choose an affinity: Good (spare the dying), Evil (inflict wounds), Law (bless), Chaos (bane), or Neutrality (protection from evil and good) — you learn that spell and it doesn't count against spells known. Favored by the Gods: Once per short rest, add 2d4 to a failed saving throw or missed attack roll.",
  "Empowered Healing: Once per turn when you or an ally within 5 ft rolls dice to restore HP with a spell, you can spend 1 sorcery point to reroll any number of those dice (must use new rolls).",
  "Otherworldly Wings: Bonus action to manifest spectral wings, gaining 30-ft fly speed. Wings last until dismissed as a bonus action.",
  "Unearthly Recovery: Once per long rest, when you have fewer than half your HP remaining as a bonus action, regain HP equal to half your HP maximum."
);

export const SHADOW_MAGIC_PROGRESSION = sorcererSheet(
  "shadow magic",
  "Eyes of the Dark: Gain darkvision 120 ft. At level 3, spend 1 sorcery point to cast Darkness without components, and you can see through your own Darkness spell. Strength of the Grave: When damage reduces you to 0 HP (not radiant or a critical hit), make a Charisma save (DC 5 + damage dealt) to drop to 1 HP instead. Usable once per long rest.",
  "Hound of Ill Omen: Spend 3 sorcery points as a bonus action to summon a Hound of Ill Omen targeting one creature within 120 ft. The hound uses dire wolf stats with 50 HP, immunity to cold/fire/lightning, and causes the target to have disadvantage on saving throws against your spells while within 5 ft.",
  "Shadow Walk: When you're in dim light or darkness as a bonus action, teleport up to 120 ft to an unoccupied space in dim light or darkness you can see.",
  "Umbral Form: Spend 6 sorcery points as a bonus action to become a shadow form for 1 minute. You gain resistance to all damage except force and radiant, move through other creatures and objects as difficult terrain, and if you end your turn inside an object you take 5 force damage."
);

export const ABERRANT_MIND_PROGRESSION = sorcererSheet(
  "aberrant mind",
  "Psionic Spells: Gain bonus spells (Arms of Hadar, Dissonant Whispers, Mind Sliver, Calm Emotions, Detect Thoughts, Phantasmal Force, Hunger of Hadar, Sending, Telekinesis, Teleportation Circle, Mind Blank, Feeblemind) always prepared; you can replace one on a long rest. Telepathic Speech: As a bonus action, establish telepathic communication with one creature within 30 ft for Charisma modifier minutes.",
  "Psionic Sorcery: When you cast a spell from your Psionic Spells list, you can cast it by expending a spell slot as normal or by spending sorcery points equal to the spell's level. If you cast it with sorcery points, it requires no verbal or somatic components. Psychic Defenses: Gain resistance to psychic damage and advantage on saving throws against being charmed or frightened.",
  "Revelation in Flesh: Spend 1 or more sorcery points as a bonus action to manifest alien features for 10 minutes: 1 sp = swim speed + breathe water, 1 sp = 30 ft flying speed (hover), 1 sp = see invisible creatures, 1 sp = melee reach increases 10 ft.",
  "Warping Implosion: Teleport up to 120 ft as an action. Each creature within 30 ft of your previous location must make a Strength save or take 3d10 force damage and be pulled up to 30 ft toward your destination; on a success, half damage only. Usable once per long rest."
);

export const CLOCKWORK_SOUL_PROGRESSION = sorcererSheet(
  "clockwork soul",
  "Clockwork Magic: Gain bonus spells always prepared (Alarm, Protection from Evil and Good, Aid, Lesser Restoration, Dispel Magic, Protection from Energy, Freedom of Movement, Summon Construct, Dispel Evil and Good, Wall of Force, Globe of Invulnerability); can replace one per long rest. Restore Balance: When a creature within 60 ft rolls with advantage or disadvantage, use a reaction to cancel the advantage or disadvantage. Usable Proficiency Bonus times per long rest.",
  "Bastion of Law: Spend 1–5 sorcery points as an action to grant a creature within 30 ft a magical ward absorbing 5 damage per sorcery point spent. The ward lasts until you finish a long rest or use this feature again.",
  "Trance of Order: Bonus action to enter a regulated mental state for 1 minute. While in trance: treat rolls lower than 10 on the d20 as 10, and attacks against you cannot benefit from advantage. Usable once per long rest.",
  "Clockwork Cavalcade: Summon spirits of order in a 30-ft cube as an action: restore up to 100 HP distributed among creatures in the cube, repair all damaged objects, end every spell of 6th level or lower on objects and creatures in the cube. Usable once per long rest."
);

export const SORCERER_SUBCLASS_SHEETS: ProgressionSheet[] = [
  DRACONIC_BLOODLINE_PROGRESSION,
  WILD_MAGIC_PROGRESSION,
  STORM_SORCERY_PROGRESSION,
  DIVINE_SOUL_PROGRESSION,
  SHADOW_MAGIC_PROGRESSION,
  ABERRANT_MIND_PROGRESSION,
  CLOCKWORK_SOUL_PROGRESSION,
];
