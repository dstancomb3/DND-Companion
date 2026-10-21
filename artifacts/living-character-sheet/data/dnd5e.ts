export interface RaceOption {
  base: string;
  subraces?: string[];
}

export interface RaceGroup {
  label: string;
  races: RaceOption[];
}

export const RACE_GROUPS: RaceGroup[] = [
  {
    label: "PHB Core",
    races: [
      { base: "Human" },
      { base: "Dragonborn" },
      {
        base: "Dwarf",
        subraces: ["Hill Dwarf", "Mountain Dwarf", "Duergar"],
      },
      {
        base: "Elf",
        subraces: ["High Elf", "Wood Elf", "Drow", "Eladrin", "Sea Elf", "Shadar-Kai"],
      },
      {
        base: "Gnome",
        subraces: ["Forest Gnome", "Rock Gnome", "Deep Gnome"],
      },
      { base: "Half-Elf" },
      { base: "Half-Orc" },
      {
        base: "Halfling",
        subraces: ["Lightfoot Halfling", "Stout Halfling", "Ghostwise Halfling"],
      },
      {
        base: "Tiefling",
        subraces: [
          "Asmodeus Tiefling", "Baalzebul Tiefling", "Dispater Tiefling",
          "Fierna Tiefling", "Glasya Tiefling", "Levistus Tiefling",
          "Mammon Tiefling", "Mephistopheles Tiefling", "Zariel Tiefling",
        ],
      },
    ],
  },
  {
    label: "Monsters / Supplement",
    races: [
      {
        base: "Aasimar",
        subraces: ["Protector Aasimar", "Scourge Aasimar", "Fallen Aasimar"],
      },
      { base: "Bugbear" },
      { base: "Centaur" },
      { base: "Changeling" },
      { base: "Fairy" },
      { base: "Firbolg" },
      {
        base: "Genasi",
        subraces: ["Air Genasi", "Earth Genasi", "Fire Genasi", "Water Genasi"],
      },
      { base: "Githyanki" },
      { base: "Githzerai" },
      { base: "Goblin" },
      { base: "Goliath" },
      { base: "Harengon" },
      { base: "Hobgoblin" },
      { base: "Kalashtar" },
      { base: "Kenku" },
      { base: "Kobold" },
      { base: "Leonin" },
      { base: "Lizardfolk" },
      { base: "Loxodon" },
      { base: "Minotaur" },
      { base: "Orc" },
      { base: "Owlin" },
      { base: "Plasmoid" },
      { base: "Satyr" },
      {
        base: "Shifter",
        subraces: [
          "Beasthide Shifter", "Longtooth Shifter",
          "Swiftstride Shifter", "Wildhunt Shifter",
        ],
      },
      { base: "Simic Hybrid" },
      { base: "Tabaxi" },
      { base: "Thri-kreen" },
      { base: "Tortle" },
      { base: "Triton" },
      { base: "Vedalken" },
      { base: "Warforged" },
      { base: "Yuan-Ti Pureblood" },
    ],
  },
];

export interface ClassEntry {
  name: string;
  subclasses: string[];
  subclassLabel?: string;
}

export const ALL_CLASSES: ClassEntry[] = [
  {
    name: "Artificer",
    subclassLabel: "Specialist (lv 3)",
    subclasses: ["Alchemist", "Armorer", "Artillerist", "Battle Smith"],
  },
  {
    name: "Barbarian",
    subclassLabel: "Primal Path (lv 3)",
    subclasses: [
      "Path of the Berserker",
      "Path of the Totem Warrior",
      "Path of the Ancestral Guardian",
      "Path of the Storm Herald",
      "Path of the Zealot",
      "Path of the Beast",
      "Path of Wild Magic",
      "Path of the Battlerager",
    ],
  },
  {
    name: "Bard",
    subclassLabel: "Bard College (lv 3)",
    subclasses: [
      "College of Lore",
      "College of Valor",
      "College of Glamour",
      "College of Swords",
      "College of Whispers",
      "College of Creation",
      "College of Eloquence",
    ],
  },
  {
    name: "Blood Hunter",
    subclassLabel: "Order (lv 3)",
    subclasses: [
      "Order of the Ghostslayer",
      "Order of the Lycan",
      "Order of the Mutant",
      "Order of the Profane Soul",
    ],
  },
  {
    name: "Cleric",
    subclassLabel: "Divine Domain (lv 1)",
    subclasses: [
      "Arcana Domain",
      "Death Domain",
      "Forge Domain",
      "Grave Domain",
      "Knowledge Domain",
      "Life Domain",
      "Light Domain",
      "Nature Domain",
      "Order Domain",
      "Peace Domain",
      "Tempest Domain",
      "Trickery Domain",
      "Twilight Domain",
      "War Domain",
    ],
  },
  {
    name: "Druid",
    subclassLabel: "Druid Circle (lv 2)",
    subclasses: [
      "Circle of the Land",
      "Circle of the Moon",
      "Circle of Dreams",
      "Circle of the Shepherd",
      "Circle of Spores",
      "Circle of Stars",
      "Circle of Wildfire",
    ],
  },
  {
    name: "Fighter",
    subclassLabel: "Martial Archetype (lv 3)",
    subclasses: [
      "Champion",
      "Battle Master",
      "Eldritch Knight",
      "Arcane Archer",
      "Banneret",
      "Cavalier",
      "Echo Knight",
      "Psi Warrior",
      "Rune Knight",
      "Samurai",
    ],
  },
  {
    name: "Monk",
    subclassLabel: "Monastic Tradition (lv 3)",
    subclasses: [
      "Way of the Open Hand",
      "Way of Shadow",
      "Way of the Four Elements",
      "Way of the Drunken Master",
      "Way of the Kensei",
      "Way of the Sun Soul",
      "Way of Mercy",
      "Way of the Astral Self",
    ],
  },
  {
    name: "Paladin",
    subclassLabel: "Sacred Oath (lv 3)",
    subclasses: [
      "Oath of Devotion",
      "Oath of the Ancients",
      "Oath of Vengeance",
      "Oath of Conquest",
      "Oath of Redemption",
      "Oath of Glory",
      "Oath of the Watchers",
      "Oathbreaker",
      "Oath of the Crown",
    ],
  },
  {
    name: "Ranger",
    subclassLabel: "Ranger Archetype (lv 3)",
    subclasses: [
      "Hunter",
      "Beast Master",
      "Gloom Stalker",
      "Horizon Walker",
      "Monster Slayer",
      "Fey Wanderer",
      "Swarmkeeper",
    ],
  },
  {
    name: "Rogue",
    subclassLabel: "Roguish Archetype (lv 3)",
    subclasses: [
      "Thief",
      "Assassin",
      "Arcane Trickster",
      "Inquisitive",
      "Mastermind",
      "Scout",
      "Swashbuckler",
      "Phantom",
      "Soulknife",
    ],
  },
  {
    name: "Sorcerer",
    subclassLabel: "Sorcerous Origin (lv 1)",
    subclasses: [
      "Draconic Bloodline",
      "Wild Magic",
      "Aberrant Mind",
      "Clockwork Soul",
      "Divine Soul",
      "Shadow Magic",
      "Storm Sorcery",
    ],
  },
  {
    name: "Warlock",
    subclassLabel: "Otherworldly Patron (lv 1)",
    subclasses: [
      "The Archfey",
      "The Fiend",
      "The Great Old One",
      "The Celestial",
      "The Hexblade",
      "The Fathomless",
      "The Genie",
      "The Undead",
      "The Undying",
    ],
  },
  {
    name: "Wizard",
    subclassLabel: "Arcane Tradition (lv 2)",
    subclasses: [
      "School of Abjuration",
      "School of Conjuration",
      "School of Divination",
      "School of Enchantment",
      "School of Evocation",
      "School of Illusion",
      "School of Necromancy",
      "School of Transmutation",
      "Bladesinging",
      "Chronurgy Magic",
      "Graviturgy Magic",
      "Order of Scribes",
      "War Magic",
    ],
  },
];

export const ALL_BACKGROUNDS = [
  "Acolyte", "Anthropologist", "Archaeologist",
  "Athlete", "Charlatan", "City Watch",
  "Clan Crafter", "Cloistered Scholar", "Courtier",
  "Criminal", "Entertainer", "Faction Agent",
  "Far Traveler", "Fisher", "Folk Hero",
  "Gladiator", "Guild Artisan", "Haunted One",
  "Hermit", "Inheritor", "Knight",
  "Knight of the Order", "Marine", "Mercenary Veteran",
  "Noble", "Outlander", "Pirate",
  "Sage", "Sailor", "Soldier",
  "Spy", "Urban Bounty Hunter", "Urchin",
  "Uthgardt Tribe Member", "Waterdhavian Noble",
];
