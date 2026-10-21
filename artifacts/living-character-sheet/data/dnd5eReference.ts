// ─── Currency ─────────────────────────────────────────────────────────────────

export const CURRENCY_TABLE = [
  { coin: "Copper (cp)", abbr: "cp", inGold: "1/100 gp", inSilver: "1/10 sp", exchange: "100 cp = 1 gp" },
  { coin: "Silver (sp)", abbr: "sp", inGold: "1/10 gp", inSilver: "1 sp", exchange: "10 sp = 1 gp" },
  { coin: "Electrum (ep)", abbr: "ep", inGold: "1/2 gp", inSilver: "5 sp", exchange: "2 ep = 1 gp" },
  { coin: "Gold (gp)", abbr: "gp", inGold: "1 gp", inSilver: "10 sp", exchange: "1 gp" },
  { coin: "Platinum (pp)", abbr: "pp", inGold: "10 gp", inSilver: "100 sp", exchange: "1 pp = 10 gp" },
];

export const CURRENCY_WEIGHTS = [
  { note: "50 coins = 1 lb", detail: "All coin types weigh the same — 50 to the pound." },
  { note: "1,000 cp = 20 lbs", detail: "A full backpack of copper can be surprisingly heavy." },
  { note: "500 gp = 10 lbs", detail: "A modest fortune in gold." },
];

// ─── Lifestyle Expenses ───────────────────────────────────────────────────────

export const LIFESTYLE_EXPENSES = [
  { lifestyle: "Wretched", cost: "—", notes: "Begging, scavenging. No fixed expenses." },
  { lifestyle: "Squalid", cost: "1 sp/day", notes: "Flea-infested stable or floor space in a tavern." },
  { lifestyle: "Poor", cost: "2 sp/day", notes: "Simple inns, basic food, worn clothes." },
  { lifestyle: "Modest", cost: "1 gp/day", notes: "Comfortable inn room, decent food." },
  { lifestyle: "Comfortable", cost: "2 gp/day", notes: "Good food, private room, comfortable clothes." },
  { lifestyle: "Wealthy", cost: "4 gp/day", notes: "Fine dining, private suite, servants." },
  { lifestyle: "Aristocratic", cost: "10 gp+/day", notes: "The finest of everything; a manor, servants, prestige." },
];

// ─── Common Equipment Prices ──────────────────────────────────────────────────

export const WEAPON_PRICES = [
  { item: "Club", cost: "1 sp", damage: "1d4 B", properties: "Light" },
  { item: "Mace", cost: "5 gp", damage: "1d6 B", properties: "—" },
  { item: "Dagger", cost: "2 gp", damage: "1d4 P", properties: "Finesse, Light, Thrown" },
  { item: "Handaxe", cost: "5 gp", damage: "1d6 S", properties: "Light, Thrown" },
  { item: "Javelin", cost: "5 sp", damage: "1d6 P", properties: "Thrown" },
  { item: "Shortsword", cost: "10 gp", damage: "1d6 P", properties: "Finesse, Light" },
  { item: "Longsword", cost: "15 gp", damage: "1d8 S", properties: "Versatile (1d10)" },
  { item: "Rapier", cost: "25 gp", damage: "1d8 P", properties: "Finesse" },
  { item: "Greatsword", cost: "50 gp", damage: "2d6 S", properties: "Heavy, Two-handed" },
  { item: "Light Crossbow", cost: "25 gp", damage: "1d8 P", properties: "Ammunition, Two-handed" },
  { item: "Shortbow", cost: "25 gp", damage: "1d6 P", properties: "Ammunition, Two-handed" },
  { item: "Longbow", cost: "50 gp", damage: "1d8 P", properties: "Ammunition, Heavy, Two-handed" },
  { item: "Hand Crossbow", cost: "75 gp", damage: "1d6 P", properties: "Ammunition, Light" },
  { item: "Heavy Crossbow", cost: "50 gp", damage: "1d10 P", properties: "Ammunition, Heavy, Two-handed" },
  { item: "Quarterstaff", cost: "2 sp", damage: "1d6 B", properties: "Versatile (1d8)" },
  { item: "Battleaxe", cost: "10 gp", damage: "1d8 S", properties: "Versatile (1d10)" },
  { item: "Warhammer", cost: "15 gp", damage: "1d8 B", properties: "Versatile (1d10)" },
  { item: "Greataxe", cost: "30 gp", damage: "1d12 S", properties: "Heavy, Two-handed" },
  { item: "Maul", cost: "10 gp", damage: "2d6 B", properties: "Heavy, Two-handed" },
  { item: "Glaive", cost: "20 gp", damage: "1d10 S", properties: "Heavy, Reach, Two-handed" },
  { item: "Pike", cost: "5 gp", damage: "1d10 P", properties: "Heavy, Reach, Two-handed" },
];

export const ARMOR_PRICES = [
  { item: "Padded", cost: "5 gp", ac: "11 + Dex", stealth: "Disadvantage", weight: "8 lbs" },
  { item: "Leather", cost: "10 gp", ac: "11 + Dex", stealth: "—", weight: "10 lbs" },
  { item: "Studded Leather", cost: "45 gp", ac: "12 + Dex", stealth: "—", weight: "13 lbs" },
  { item: "Hide", cost: "10 gp", ac: "12 + Dex (max 2)", stealth: "—", weight: "12 lbs" },
  { item: "Chain Shirt", cost: "50 gp", ac: "13 + Dex (max 2)", stealth: "—", weight: "20 lbs" },
  { item: "Scale Mail", cost: "50 gp", ac: "14 + Dex (max 2)", stealth: "Disadvantage", weight: "45 lbs" },
  { item: "Breastplate", cost: "400 gp", ac: "14 + Dex (max 2)", stealth: "—", weight: "20 lbs" },
  { item: "Half Plate", cost: "750 gp", ac: "15 + Dex (max 2)", stealth: "Disadvantage", weight: "40 lbs" },
  { item: "Ring Mail", cost: "30 gp", ac: "14", stealth: "Disadvantage", weight: "40 lbs" },
  { item: "Chain Mail", cost: "75 gp", ac: "16", stealth: "Disadvantage", weight: "55 lbs" },
  { item: "Splint", cost: "200 gp", ac: "17", stealth: "Disadvantage", weight: "60 lbs" },
  { item: "Plate", cost: "1,500 gp", ac: "18", stealth: "Disadvantage", weight: "65 lbs" },
  { item: "Shield", cost: "10 gp", ac: "+2", stealth: "—", weight: "6 lbs" },
];

export const ADVENTURING_GEAR = [
  { item: "Backpack", cost: "2 gp", notes: "Holds 30 lbs / 1 cubic foot" },
  { item: "Bedroll", cost: "1 gp", notes: "" },
  { item: "Candle", cost: "1 cp", notes: "5-ft radius, 1 hr" },
  { item: "Crowbar", cost: "2 gp", notes: "+Advantage on Str checks to open things" },
  { item: "Healer's Kit", cost: "5 gp", notes: "10 uses; stabilize dying creature" },
  { item: "Lantern (hooded)", cost: "5 gp", notes: "60-ft bright, 60-ft dim. Oil 1 hr" },
  { item: "Lantern (bullseye)", cost: "10 gp", notes: "60-ft cone bright, 60-ft dim. Oil 1 hr" },
  { item: "Oil (flask)", cost: "1 sp", notes: "Lantern fuel, or splash weapon (1d4+fire)" },
  { item: "Rope (hempen, 50 ft)", cost: "1 gp", notes: "AC 11, 2 HP, DC 17 Str to break" },
  { item: "Rope (silk, 50 ft)", cost: "10 gp", notes: "Lighter, stronger" },
  { item: "Tent (2-person)", cost: "2 gp", notes: "" },
  { item: "Torch", cost: "1 cp", notes: "20-ft bright, 20-ft dim. 1 hr" },
  { item: "Waterskin", cost: "2 sp", notes: "4 pints" },
  { item: "Rations (1 day)", cost: "5 sp", notes: "Dry food for travel" },
  { item: "Tinderbox", cost: "5 sp", notes: "Start a fire (1 action, or 1 min in wind)" },
  { item: "Grappling Hook", cost: "2 gp", notes: "" },
  { item: "Thieves' Tools", cost: "25 gp", notes: "Pick locks, disarm traps. Proficiency required." },
  { item: "Climber's Kit", cost: "25 gp", notes: "Pitons, boots, gloves, harness" },
  { item: "Herbalism Kit", cost: "5 gp", notes: "Craft antitoxin, potions (healing)" },
  { item: "Poisoner's Kit", cost: "50 gp", notes: "Craft and apply poisons" },
  { item: "Alchemist's Supplies", cost: "50 gp", notes: "" },
  { item: "Disguise Kit", cost: "25 gp", notes: "" },
  { item: "Forgery Kit", cost: "15 gp", notes: "" },
];

// ─── Common Potions & Magic Item Prices ──────────────────────────────────────

export const POTION_PRICES = [
  { item: "Potion of Healing", rarity: "Common", heal: "2d4+2 HP", cost: "50 gp" },
  { item: "Potion of Greater Healing", rarity: "Uncommon", heal: "4d4+4 HP", cost: "150 gp" },
  { item: "Potion of Superior Healing", rarity: "Rare", heal: "8d4+8 HP", cost: "500 gp" },
  { item: "Potion of Supreme Healing", rarity: "Very Rare", heal: "10d4+20 HP", cost: "5,000 gp" },
  { item: "Potion of Animal Friendship", rarity: "Uncommon", heal: "—", cost: "200 gp" },
  { item: "Potion of Climbing", rarity: "Common", heal: "—", cost: "75 gp" },
  { item: "Potion of Flying", rarity: "Very Rare", heal: "—", cost: "3,000 gp" },
  { item: "Potion of Heroism", rarity: "Rare", heal: "+10 Temp HP, Bless", cost: "300 gp" },
  { item: "Potion of Invisibility", rarity: "Very Rare", heal: "—", cost: "2,500 gp" },
  { item: "Potion of Speed", rarity: "Very Rare", heal: "—", cost: "4,000 gp" },
  { item: "Antitoxin", rarity: "Common", heal: "—", cost: "50 gp" },
];

export const MAGIC_ITEM_PRICE_GUIDE = [
  { rarity: "Common", avgCost: "50–100 gp", attunement: "Rarely" },
  { rarity: "Uncommon", avgCost: "101–500 gp", attunement: "Sometimes" },
  { rarity: "Rare", avgCost: "501–5,000 gp", attunement: "Usually" },
  { rarity: "Very Rare", avgCost: "5,001–50,000 gp", attunement: "Almost always" },
  { rarity: "Legendary", avgCost: "50,001+ gp", attunement: "Always" },
  { rarity: "Artifact", avgCost: "Priceless", attunement: "Always" },
];

// ─── Conditions Reference ─────────────────────────────────────────────────────

export const CONDITIONS = [
  {
    name: "Blinded",
    effects: [
      "Can't see; auto-fails checks requiring sight.",
      "Attack rolls against you have Advantage.",
      "Your attack rolls have Disadvantage.",
    ],
  },
  {
    name: "Charmed",
    effects: [
      "Can't attack the charmer or target them with harmful effects.",
      "The charmer has Advantage on Charisma checks against you.",
    ],
  },
  {
    name: "Deafened",
    effects: [
      "Can't hear; auto-fails checks requiring hearing.",
    ],
  },
  {
    name: "Exhaustion",
    effects: [
      "Level 1: Disadvantage on ability checks.",
      "Level 2: Speed halved.",
      "Level 3: Disadvantage on attack rolls and saving throws.",
      "Level 4: Hit point maximum halved.",
      "Level 5: Speed reduced to 0.",
      "Level 6: Death.",
    ],
  },
  {
    name: "Frightened",
    effects: [
      "Disadvantage on ability checks and attacks while source is in line of sight.",
      "Can't willingly move closer to the source.",
    ],
  },
  {
    name: "Grappled",
    effects: [
      "Speed becomes 0.",
      "Ends if grappler becomes incapacitated, or creature is moved out of reach.",
    ],
  },
  {
    name: "Incapacitated",
    effects: [
      "Can't take actions or reactions.",
    ],
  },
  {
    name: "Invisible",
    effects: [
      "Can't be seen without magic or special senses.",
      "Your attacks have Advantage; attacks against you have Disadvantage.",
    ],
  },
  {
    name: "Paralyzed",
    effects: [
      "Incapacitated; can't move or speak.",
      "Auto-fail Str and Dex saves.",
      "Attacks against you have Advantage.",
      "Melee attacks that hit within 5 ft are critical hits.",
    ],
  },
  {
    name: "Petrified",
    effects: [
      "Transformed into a solid, inanimate substance.",
      "Incapacitated; weight increases tenfold.",
      "Resistance to all damage; immune to poison and disease (but suspended).",
    ],
  },
  {
    name: "Poisoned",
    effects: [
      "Disadvantage on attack rolls and ability checks.",
    ],
  },
  {
    name: "Prone",
    effects: [
      "Can only crawl (costs 1 extra foot per foot of movement) or stand up (half speed).",
      "Disadvantage on attack rolls.",
      "Attacks within 5 ft of you have Advantage; ranged attacks have Disadvantage.",
    ],
  },
  {
    name: "Restrained",
    effects: [
      "Speed becomes 0.",
      "Attack rolls against you have Advantage; your attacks have Disadvantage.",
      "Disadvantage on Dex saving throws.",
    ],
  },
  {
    name: "Stunned",
    effects: [
      "Incapacitated; can't move; can only speak falteringly.",
      "Auto-fail Str and Dex saves.",
      "Attacks against you have Advantage.",
    ],
  },
  {
    name: "Unconscious",
    effects: [
      "Incapacitated; can't move or speak; unaware of surroundings.",
      "Drops held items; falls prone.",
      "Auto-fail Str and Dex saves.",
      "Attacks have Advantage; melee within 5 ft auto-crits.",
    ],
  },
];

// ─── Encounter Difficulty ─────────────────────────────────────────────────────

export const ENCOUNTER_DIFFICULTY = [
  { difficulty: "Easy", xpMultiplier: "×1", description: "A minor threat with little or no risk." },
  { difficulty: "Medium", xpMultiplier: "×1.5", description: "A noticeable threat; may consume resources." },
  { difficulty: "Hard", xpMultiplier: "×2", description: "Seriously dangerous; significant resource expenditure." },
  { difficulty: "Deadly", xpMultiplier: "×2", description: "Potentially kill one or more characters." },
];

export const XP_THRESHOLDS = [
  { level: 1, easy: 25, medium: 50, hard: 75, deadly: 100 },
  { level: 2, easy: 50, medium: 100, hard: 150, deadly: 200 },
  { level: 3, easy: 75, medium: 150, hard: 225, deadly: 400 },
  { level: 4, easy: 125, medium: 250, hard: 375, deadly: 500 },
  { level: 5, easy: 250, medium: 500, hard: 750, deadly: 1100 },
  { level: 6, easy: 300, medium: 600, hard: 900, deadly: 1400 },
  { level: 7, easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  { level: 8, easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  { level: 9, easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  { level: 10, easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  { level: 11, easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  { level: 12, easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  { level: 13, easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  { level: 14, easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  { level: 15, easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  { level: 16, easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  { level: 17, easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  { level: 18, easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  { level: 19, easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  { level: 20, easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
];

export const MONSTER_MULTIPLIERS = [
  { monsters: "1", multiplier: "×1" },
  { monsters: "2", multiplier: "×1.5" },
  { monsters: "3–6", multiplier: "×2" },
  { monsters: "7–10", multiplier: "×2.5" },
  { monsters: "11–14", multiplier: "×3" },
  { monsters: "15+", multiplier: "×4" },
];

// ─── Common CR / XP Table ─────────────────────────────────────────────────────

export const CR_XP_TABLE = [
  { cr: "0", xp: 0, profBonus: "+2" },
  { cr: "1/8", xp: 25, profBonus: "+2" },
  { cr: "1/4", xp: 50, profBonus: "+2" },
  { cr: "1/2", xp: 100, profBonus: "+2" },
  { cr: "1", xp: 200, profBonus: "+2" },
  { cr: "2", xp: 450, profBonus: "+2" },
  { cr: "3", xp: 700, profBonus: "+2" },
  { cr: "4", xp: 1100, profBonus: "+2" },
  { cr: "5", xp: 1800, profBonus: "+3" },
  { cr: "6", xp: 2300, profBonus: "+3" },
  { cr: "7", xp: 2900, profBonus: "+3" },
  { cr: "8", xp: 3900, profBonus: "+3" },
  { cr: "9", xp: 5000, profBonus: "+4" },
  { cr: "10", xp: 5900, profBonus: "+4" },
  { cr: "11", xp: 7200, profBonus: "+4" },
  { cr: "12", xp: 8400, profBonus: "+4" },
  { cr: "13", xp: 10000, profBonus: "+5" },
  { cr: "14", xp: 11500, profBonus: "+5" },
  { cr: "15", xp: 13000, profBonus: "+5" },
  { cr: "16", xp: 15000, profBonus: "+5" },
  { cr: "17", xp: 18000, profBonus: "+6" },
  { cr: "18", xp: 20000, profBonus: "+6" },
  { cr: "19", xp: 22000, profBonus: "+6" },
  { cr: "20", xp: 25000, profBonus: "+6" },
  { cr: "21", xp: 33000, profBonus: "+7" },
  { cr: "22", xp: 41000, profBonus: "+7" },
  { cr: "23", xp: 50000, profBonus: "+7" },
  { cr: "24", xp: 62000, profBonus: "+7" },
  { cr: "25", xp: 75000, profBonus: "+8" },
  { cr: "26", xp: 90000, profBonus: "+8" },
  { cr: "27", xp: 105000, profBonus: "+8" },
  { cr: "28", xp: 120000, profBonus: "+8" },
  { cr: "29", xp: 135000, profBonus: "+9" },
  { cr: "30", xp: 155000, profBonus: "+9" },
];

// ─── Rest & Recovery ──────────────────────────────────────────────────────────

export const REST_REFERENCE = [
  {
    type: "Short Rest",
    duration: "1 hour",
    benefits: [
      "Spend Hit Dice (d[Hit Die] + CON mod) to regain HP.",
      "Some class features recharge (Warlock spell slots, Fighter Second Wind, Monk Ki, etc.).",
    ],
  },
  {
    type: "Long Rest",
    duration: "8 hours (6 hrs sleep min)",
    benefits: [
      "Regain all lost HP.",
      "Regain all spent Hit Dice (up to half your total HD, min 1).",
      "Regain all expended spell slots.",
      "All class features that recharge on long rest reset.",
      "Can't benefit from more than one long rest per 24 hours.",
    ],
  },
];

// ─── Spell Slot Recovery (Short Rest) ─────────────────────────────────────────

export const WARLOCK_SLOTS = [
  { level: 1, slots: 1, spellLevel: "1st" },
  { level: 2, slots: 2, spellLevel: "1st" },
  { level: 3, slots: 2, spellLevel: "2nd" },
  { level: 4, slots: 2, spellLevel: "2nd" },
  { level: 5, slots: 2, spellLevel: "3rd" },
  { level: 6, slots: 2, spellLevel: "3rd" },
  { level: 7, slots: 2, spellLevel: "4th" },
  { level: 8, slots: 2, spellLevel: "4th" },
  { level: 9, slots: 2, spellLevel: "5th" },
  { level: 10, slots: 2, spellLevel: "5th" },
  { level: 11, slots: 3, spellLevel: "5th" },
  { level: 12, slots: 3, spellLevel: "5th" },
  { level: 13, slots: 3, spellLevel: "5th" },
  { level: 14, slots: 3, spellLevel: "5th" },
  { level: 15, slots: 3, spellLevel: "5th" },
  { level: 16, slots: 3, spellLevel: "5th" },
  { level: 17, slots: 4, spellLevel: "5th" },
  { level: 18, slots: 4, spellLevel: "5th" },
  { level: 19, slots: 4, spellLevel: "5th" },
  { level: 20, slots: 4, spellLevel: "5th" },
];

// ─── Gemstone Values ──────────────────────────────────────────────────────────

export const GEMSTONE_VALUES = [
  { value: "10 gp", examples: "Azurite, blue quartz, hematite, lapis lazuli, malachite, obsidian, rhodonite, turquoise" },
  { value: "50 gp", examples: "Bloodstone, carnelian, chalcedony, chrysoprase, citrine, moonstone, onyx, quartz, sardonyx, zircon" },
  { value: "100 gp", examples: "Amber, amethyst, chrysoberyl, coral, garnet, jade, jet, pearl, spinel, tourmaline" },
  { value: "500 gp", examples: "Alexandrite, aquamarine, violet garnet, black pearl, deep blue spinel, golden yellow topaz" },
  { value: "1,000 gp", examples: "Emerald, blue sapphire, fire opal, opal, star ruby, star sapphire" },
  { value: "5,000 gp", examples: "Black sapphire, diamond, jacinth, ruby" },
];

// ─── Common Services Costs ────────────────────────────────────────────────────

export const SERVICES_COSTS = [
  { service: "Coach travel (per mile)", cost: "3 cp" },
  { service: "Inn (squalid, per night)", cost: "7 cp" },
  { service: "Inn (modest, per night)", cost: "5 sp" },
  { service: "Inn (comfortable, per night)", cost: "8 sp" },
  { service: "Inn (wealthy, per night)", cost: "2 gp" },
  { service: "Messenger (local)", cost: "2 cp" },
  { service: "Road/gate toll", cost: "1 cp" },
  { service: "Skilled hireling (per day)", cost: "2 gp" },
  { service: "Unskilled hireling (per day)", cost: "2 sp" },
  { service: "Ship passage (per mile)", cost: "1 sp" },
  { service: "Spellcasting: Cure Wounds", cost: "10 gp" },
  { service: "Spellcasting: Identify", cost: "20 gp" },
  { service: "Spellcasting: Raise Dead", cost: "500 gp + material" },
  { service: "Spellcasting: Resurrection", cost: "1,000 gp + material" },
  { service: "Spellcasting: True Resurrection", cost: "25,000 gp + material" },
];

// ─── Common Lore & World Knowledge ───────────────────────────────────────────

export const LORE_ENTRIES = [
  {
    category: "Planes of Existence",
    entries: [
      "The Material Plane: The mortal world, seat of most civilizations.",
      "The Feywild: A parallel plane of nature, magic, and capricious fey. Time moves strangely here.",
      "The Shadowfell: A parallel dark reflection — cold, desolate, home to undead and shadow.",
      "Astral Plane: A silvery void connecting planes; the realm of thought and dream.",
      "Ethereal Plane: Coexists with material; used for ethereal travel and some hauntings.",
      "Elemental Planes: Air, Earth, Fire, and Water — raw elemental chaos.",
      "The Abyss: Infinite layers of demonic chaos; home of demons (chaotic evil).",
      "The Nine Hells (Baator): Nine layers of tyrannical order; home of devils (lawful evil).",
      "Mount Celestia: Lawful good divine realm; home of celestials and heavenly beings.",
      "Limbo: Pure chaotic neutral — swirling chaos; home of slaadi.",
      "Mechanus: Lawful neutral clockwork plane; home of modrons.",
      "Elysium: Chaotic good; warm, rolling fields — the realm of pure goodness.",
    ],
  },
  {
    category: "Common Deities (Forgotten Realms)",
    entries: [
      "Torm — God of Courage & Self-Sacrifice. (LG) Paladins, soldiers.",
      "Tyr — God of Justice. (LG) Judges, lawmakers.",
      "Lathander — God of Dawn & Renewal. (NG) Healers, farmers.",
      "Selûne — Goddess of the Moon. (CG) Travelers, sailors, lycanthropes.",
      "Mystra — Goddess of Magic. (NG) Wizards, sorcerers, all spellcasters.",
      "Helm — God of Protection & Watchfulness. (LN) Guards, protectors.",
      "Tempus — God of War. (N) Soldiers, warriors, mercenaries.",
      "Kelemvor — God of the Dead. (LN) The dead, judgment of souls.",
      "Shar — Goddess of Darkness & Loss. (NE) Shadows, secrets, grief.",
      "Bane — God of Tyranny. (LE) Conquerors, tyrants, fear.",
      "Cyric — God of Lies. (CE) Assassins, murderers, the deceptive.",
      "Umberlee — Goddess of the Sea. (CE) Sailors (who fear her), storms.",
    ],
  },
  {
    category: "Creature Types",
    entries: [
      "Aberration: Alien, mind-warping creatures (beholders, mind flayers, aboleths).",
      "Beast: Natural animals without magical origin.",
      "Celestial: Divine creatures from upper planes (angels, pegasi, unicorns).",
      "Construct: Artificially created creatures (golems, warforged, animated armor).",
      "Dragon: True dragons and dragonkind (wyverns, drakes).",
      "Elemental: Beings of pure elemental energy.",
      "Fey: Magical creatures tied to the Feywild (hags, pixies, dryads, satyrs).",
      "Fiend: Evil outsiders — devils, demons, yugoloths.",
      "Giant: Giants and giant-kin (trolls, ogres, ettins).",
      "Humanoid: Most civilized races (humans, elves, orcs, goblins, etc.).",
      "Monstrosity: Monsters with no clear category — created by magic or nature (manticore, owlbear).",
      "Ooze: Amorphous creatures (gelatinous cube, black pudding).",
      "Plant: Sentient or mobile plant life (treants, myconids, shambling mounds).",
      "Undead: Formerly living, now animated by dark magic (zombies, vampires, liches).",
    ],
  },
  {
    category: "Languages",
    entries: [
      "Common: Spoken by most humanoids; the trade tongue.",
      "Elvish: Musical, fluid; shared by all elves.",
      "Dwarvish: Gruff, consonant-heavy; cut into stone tablets.",
      "Gnomish: Rapid, technical; favored by tinkerers.",
      "Halfling: Comfortable, homey; rarely written down.",
      "Orc: Rough and aggressive; relies on grunts and growls.",
      "Goblin: Spoken by goblins, hobgoblins, and bugbears.",
      "Draconic: Ancient; used for magic, draconic spells, and draconic bloodlines.",
      "Abyssal: Demonic tongue; harsh and guttural.",
      "Infernal: Precise, structured; used by devils.",
      "Celestial: Flowing, divine; used by celestials.",
      "Deep Speech: Alien; used by aberrations and the Far Realm.",
      "Sylvan: Airy, melodic; language of the fey.",
      "Undercommon: Trade language of the Underdark.",
      "Primordial: Language of elementals (dialects: Aquan, Auran, Ignan, Terran).",
      "Thieves' Cant: Not a true language — coded slang and signs used by criminals.",
    ],
  },
];

// ─── DM Tips ─────────────────────────────────────────────────────────────────

export const DM_TIPS = [
  "Say 'yes, and…' more than you say 'no.' Build on player ideas.",
  "Prepare situations and factions, not scripts. Let the players surprise you.",
  "Failure should be interesting, not just a dead end. Every 'no' hides a 'but...' or 'and...'.",
  "Keep a list of 5 NPC names ready at all times — players will always name-drop.",
  "Know your monsters' motivations, not just their stats.",
  "Pause to describe the scene before asking what the players do.",
  "The Rule of Cool: if it's awesome, let it happen.",
  "Use all five senses in descriptions — not just what players see.",
  "Remind players what their character knows, not just what they know.",
  "Foreshadow threats at least two sessions before they arrive.",
  "Let players feel smart by solving your clues, not just rolling.",
  "Encounters are more interesting with terrain that creates tactical choices.",
  "If an encounter is going badly for the players, remember: villains can retreat too.",
  "The best twists recontextualize something the players already know.",
  "Travel montages are fine — not every mile needs a random encounter.",
  "A villain with understandable motivations is scarier than pure evil.",
  "Pace your sessions: action → exploration → social → repeat.",
  "Write session notes immediately after — memories fade fast.",
  "Ask your players what they want more of. It's their story too.",
  "It's okay to make rulings at the table and look up the RAW later.",
];
