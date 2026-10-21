import type {
  Character,
  CharacterSnapshot,
  Attack,
  Resource,
  InventoryItem,
  ActiveCondition,
  SpellSlotLevel,
  ClassFeature,
  PreparedSpell,
  CombatLogEntry,
  SessionLog,
  Quest,
  NpcPerson,
  CampaignLocation,
  Note,
  JournalArc,
  WishlistItem,
  Plane,
  Companion,
} from "@/types";

export const mockCharacter: Character = {
  id: "char-001",
  name: "Lyra Shadowstep",
  class: "Monk",
  subclass: "Way of the Open Hand",
  level: 7,
  race: "Wood Elf",
  background: "Outlander",
  proficiencyBonus: 3,
  armorClass: 17,
  currentHp: 52,
  maxHp: 57,
  tempHp: 0,
  speed: 40,
  initiative: 3,
  abilityScores: {
    strength: 12,
    dexterity: 18,
    constitution: 14,
    intelligence: 10,
    wisdom: 16,
    charisma: 10,
  },
  savingThrows: [
    { ability: "strength", proficient: true, modifier: 4 },
    { ability: "dexterity", proficient: false, modifier: 4 },
    { ability: "constitution", proficient: false, modifier: 2 },
    { ability: "intelligence", proficient: false, modifier: 0 },
    { ability: "wisdom", proficient: true, modifier: 6 },
    { ability: "charisma", proficient: false, modifier: 0 },
  ],
  skills: [
    { name: "Acrobatics", ability: "dexterity", proficient: true, expertise: false, modifier: 7 },
    { name: "Animal Handling", ability: "wisdom", proficient: false, expertise: false, modifier: 3 },
    { name: "Arcana", ability: "intelligence", proficient: false, expertise: false, modifier: 0 },
    { name: "Athletics", ability: "strength", proficient: true, expertise: false, modifier: 4 },
    { name: "Deception", ability: "charisma", proficient: false, expertise: false, modifier: 0 },
    { name: "History", ability: "intelligence", proficient: false, expertise: false, modifier: 0 },
    { name: "Insight", ability: "wisdom", proficient: true, expertise: false, modifier: 6 },
    { name: "Intimidation", ability: "charisma", proficient: false, expertise: false, modifier: 0 },
    { name: "Investigation", ability: "intelligence", proficient: false, expertise: false, modifier: 0 },
    { name: "Medicine", ability: "wisdom", proficient: false, expertise: false, modifier: 3 },
    { name: "Nature", ability: "wisdom", proficient: true, expertise: false, modifier: 6 },
    { name: "Perception", ability: "wisdom", proficient: true, expertise: false, modifier: 6 },
    { name: "Performance", ability: "charisma", proficient: false, expertise: false, modifier: 0 },
    { name: "Persuasion", ability: "charisma", proficient: false, expertise: false, modifier: 0 },
    { name: "Religion", ability: "intelligence", proficient: false, expertise: false, modifier: 0 },
    { name: "Sleight of Hand", ability: "dexterity", proficient: false, expertise: false, modifier: 4 },
    { name: "Stealth", ability: "dexterity", proficient: true, expertise: false, modifier: 7 },
    { name: "Survival", ability: "wisdom", proficient: true, expertise: false, modifier: 6 },
  ],
  passivePerception: 16,
  currency: {
    cp: 14,
    sp: 30,
    ep: 0,
    gp: 120,
    pp: 2,
  },
  notes: "Member of the Order of the Jade Fist. Traveling to recover stolen monastery relics. Has a contact named Bren in Thistlewick.",
};

export const mockAttacks: Attack[] = [
  {
    id: "atk-001",
    name: "Unarmed Strike",
    attackBonus: 7,
    damageDice: "1d8",
    damageModifier: 4,
    damageType: "bludgeoning",
    range: "5 ft",
    notes: "Martial Arts die scales with level",
    reminders: [
      {
        id: "rem-001",
        name: "Stunning Strike",
        description: "On a hit, spend 1 Focus Point. Target must succeed DC 14 CON save or be stunned until end of your next turn.",
        resourceCost: "1 Focus Point",
        condition: "On a hit",
      },
      {
        id: "rem-002",
        name: "Open Hand Technique",
        description: "On a hit with Flurry of Blows: Knock prone (DEX save DC 14), push 15 ft, or prevent reactions until your next turn.",
        condition: "Flurry of Blows hit",
      },
      {
        id: "rem-003",
        name: "Flurry of Blows",
        description: "After Attack action, spend 1 Focus Point to make 2 unarmed strikes as a bonus action.",
        resourceCost: "1 Focus Point",
      },
    ],
  },
  {
    id: "atk-002",
    name: "Quarterstaff",
    attackBonus: 7,
    damageDice: "1d8",
    damageModifier: 4,
    damageType: "bludgeoning",
    range: "5 ft",
    notes: "Can use Martial Arts with this weapon",
    linkedInventoryItemId: "inv-001",
    reminders: [
      {
        id: "rem-004",
        name: "Stunning Strike",
        description: "On a hit, spend 1 Focus Point. Target must succeed DC 14 CON save or be stunned until end of your next turn.",
        resourceCost: "1 Focus Point",
        condition: "On a hit",
      },
      {
        id: "rem-005",
        name: "Bonus Unarmed Strike",
        description: "After attacking with quarterstaff, make one unarmed strike as a bonus action (Martial Arts).",
        condition: "After Attack action",
      },
    ],
  },
  {
    id: "atk-003",
    name: "Deflect Missiles (Return)",
    attackBonus: 7,
    damageDice: "1d10",
    damageModifier: 7,
    damageType: "varies",
    range: "20/60 ft",
    notes: "Only usable after catching a ranged attack. Costs 1 Focus.",
    reminders: [
      {
        id: "rem-006",
        name: "Deflect & Return",
        description: "After catching a missile, spend 1 Focus Point to throw it back. Uses monk weapon attack stats.",
        resourceCost: "1 Focus Point",
        condition: "After catching a ranged attack",
      },
    ],
  },
];

export const mockResources: Resource[] = [
  {
    id: "res-001",
    name: "Focus Points",
    current: 5,
    max: 7,
    resetOn: "short_rest",
    color: "#7C3AED",
    notes: "Ki / Focus — used for Stunning Strike, Flurry, Step of Wind, etc.",
  },
  {
    id: "res-002",
    name: "Wholeness of Body",
    current: 0,
    max: 1,
    resetOn: "long_rest",
    color: "#059669",
    notes: "Bonus action: Regain HP equal to 3x monk level (21 HP)",
  },
  {
    id: "res-003",
    name: "Step of Wind Uses",
    current: 2,
    max: 2,
    resetOn: "short_rest",
    color: "#0EA5E9",
    notes: "Tracked separately for convenience. Disengage or Dash as bonus action.",
  },
  {
    id: "res-004",
    name: "Diamond Soul (Lucky)",
    current: 1,
    max: 1,
    resetOn: "long_rest",
    color: "#F59E0B",
    notes: "Can reroll a failed saving throw once per long rest (available at level 14)",
  },
  {
    id: "res-005",
    name: "Hit Dice (d8)",
    current: 7,
    max: 7,
    resetOn: "long_rest",
    color: "#EF4444",
    notes: "Spend during short rest to regain HP. Regain half on long rest.",
  },
];

export const mockConditions: ActiveCondition[] = [
  {
    id: "cond-001",
    name: "Hunter's Mark",
    source: "Party Ranger: Kael",
    removeOn: ["short_rest", "long_rest", "manual"],
    notes: "Tracking target: Guild Enforcer",
    durationType: "concentration",
    tickTiming: "manualOnly",
    concentrationLink: "party-kael-hunters-mark",
  },
  {
    id: "cond-002",
    name: "Blessed",
    source: "Sister Elara",
    removeOn: ["short_rest", "long_rest", "manual"],
    notes: "+1d4 on attack rolls and saving throws",
    durationType: "turns",
    durationValue: 10,
    remainingDuration: 4,
    tickTiming: "onRoundAdvance",
  },
];

export const mockSpellSlots: SpellSlotLevel[] = [
  { level: 1, total: 2, used: 1 },
  { level: 2, total: 1, used: 0 },
  { level: 3, total: 0, used: 0 },
  { level: 4, total: 0, used: 0 },
  { level: 5, total: 0, used: 0 },
  { level: 6, total: 0, used: 0 },
  { level: 7, total: 0, used: 0 },
  { level: 8, total: 0, used: 0 },
  { level: 9, total: 0, used: 0 },
];

export const mockClassFeatures: ClassFeature[] = [
  {
    id: "cf-001",
    name: "Stunning Strike",
    description: "When you hit with a melee weapon attack, spend 1 Focus to force a CON save or the target is stunned until end of your next turn.",
    actionType: "free",
    source: "class",
    originKind: "progression_generated",
    levelGained: 5,
  },
  {
    id: "cf-002",
    name: "Flurry of Blows",
    description: "After taking the Attack action, spend 1 Focus to make two unarmed strikes as a bonus action.",
    actionType: "bonus_action",
    source: "class",
    originKind: "progression_generated",
    levelGained: 2,
  },
  {
    id: "cf-003",
    name: "Wholeness of Body",
    description: "As an action, regain HP equal to three times your monk level once per long rest.",
    actionType: "action",
    source: "class",
    originKind: "progression_generated",
    levelGained: 6,
  },
];

export const mockPassiveFeatures: ClassFeature[] = [
  {
    id: "pf-001",
    name: "Deflect Missiles",
    description: "Use your reaction to reduce ranged weapon attack damage and potentially throw the missile back.",
    source: "class",
    originKind: "progression_generated",
    levelGained: 3,
  },
  {
    id: "pf-002",
    name: "Evasion",
    description: "Take no damage on successful DEX save for half-damage effects, and half damage on failure.",
    source: "class",
    originKind: "progression_generated",
    levelGained: 7,
  },
  {
    id: "pf-003",
    name: "Stillness of Mind",
    description: "Use your action to end one effect causing you to be charmed or frightened.",
    source: "class",
    originKind: "progression_generated",
    levelGained: 7,
  },
];

export const mockPreparedSpells: PreparedSpell[] = [
  {
    id: "spl-001",
    name: "Pass without Trace",
    level: 2,
    school: "Abjuration",
    castingTime: "1 action",
    range: "Self",
    duration: "Concentration, up to 1 hour",
    concentration: true,
    ritual: false,
    description: "A veil of shadows and silence radiates from you, granting +10 to Stealth checks.",
    prepared: true,
    createdAt: 1700005000000,
  },
  {
    id: "spl-002",
    name: "Absorb Elements",
    level: 1,
    school: "Abjuration",
    castingTime: "1 reaction",
    range: "Self",
    duration: "1 round",
    concentration: false,
    ritual: false,
    description: "Capture incoming elemental energy, gaining resistance and empowering your next melee hit.",
    prepared: true,
    createdAt: 1700005001000,
  },
  {
    id: "spl-003",
    name: "Guidance",
    level: 0,
    school: "Divination",
    castingTime: "1 action",
    range: "Touch",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    description: "Touch one willing creature; once before spell ends, target adds 1d4 to an ability check.",
    prepared: true,
    createdAt: 1700005002000,
  },
];

export const mockCompanions: Companion[] = [
  {
    id: "cmp-001",
    characterId: "char-001",
    name: "Whisper",
    type: "Beast",
    size: "Small",
    alignment: "Neutral",
    armor_class: 14,
    hit_points: 24,
    max_hit_points: 24,
    hit_dice: "5d6+5",
    speed: "40 ft., climb 30 ft.",
    strength: 8,
    dexterity: 16,
    constitution: 12,
    intelligence: 6,
    wisdom: 14,
    charisma: 8,
    challenge_rating: "1/2",
    actions: [
      {
        name: "Bite",
        desc: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) piercing damage.",
      },
      {
        name: "Harrying Dash",
        desc: "Whisper moves up to half speed without provoking opportunity attacks from one creature it has damaged this turn.",
      },
    ],
    special_abilities: [
      {
        name: "Keen Hearing and Smell",
        desc: "Whisper has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
      },
    ],
    notes: "Scout wolf from the monastery foothills. Frequently used for recon and tracking.",
    createdAt: 1700005100000,
    updatedAt: 1700005100000,
  },
  {
    id: "cmp-002",
    characterId: "char-001",
    name: "Lantern Sprite",
    type: "Fey",
    size: "Tiny",
    alignment: "Chaotic Good",
    armor_class: 15,
    hit_points: 17,
    max_hit_points: 17,
    hit_dice: "5d4+5",
    speed: "10 ft., fly 40 ft.",
    strength: 4,
    dexterity: 18,
    constitution: 12,
    intelligence: 10,
    wisdom: 13,
    charisma: 16,
    challenge_rating: "1",
    actions: [
      {
        name: "Spark Bolt",
        desc: "Ranged Spell Attack: +6 to hit, range 60 ft., one target. Hit: 6 (1d6 + 3) radiant damage.",
      },
      {
        name: "Distracting Gleam",
        desc: "One creature within 30 ft. has disadvantage on its next attack roll before the sprite's next turn.",
      },
    ],
    special_abilities: [
      {
        name: "Illuminating Aura",
        desc: "The sprite sheds dim light in a 20-foot radius and can dim or brighten it as a bonus action.",
      },
    ],
    notes: "Bound during a moonlit rite. Great for dark tunnels and support utility.",
    createdAt: 1700005101000,
    updatedAt: 1700005102000,
  },
];

export const mockCombatLogEntries: CombatLogEntry[] = [
  {
    id: "cl-001",
    timestamp: 1700005200000,
    sessionId: "sess-001",
    type: "session_start",
    description: "Session started in Blackwater Docks ambush.",
    source: "manual",
  },
  {
    id: "cl-002",
    timestamp: 1700005205000,
    sessionId: "sess-001",
    type: "resource_spend",
    description: "Spent 1 Focus Point for Stunning Strike.",
    source: "manual",
  },
  {
    id: "cl-003",
    timestamp: 1700005209000,
    sessionId: "sess-001",
    type: "condition_add",
    description: "Applied Stunned to Guild Enforcer.",
    source: "manual",
  },
  {
    id: "cl-004",
    timestamp: 1700005212000,
    sessionId: "sess-001",
    type: "hp_damage",
    description: "Took 11 slashing damage from Bandit Captain.",
    source: "manual",
  },
  {
    id: "cl-005",
    timestamp: 1700005218000,
    sessionId: "sess-001",
    type: "hp_heal",
    description: "Recovered 8 HP from Potion of Healing.",
    source: "manual",
  },
  {
    id: "cl-006",
    timestamp: 1700005300000,
    sessionId: "sess-002",
    type: "session_start",
    description: "Session started at the guild vault breach.",
    source: "manual",
  },
  {
    id: "cl-007",
    timestamp: 1700005307000,
    sessionId: "sess-002",
    type: "long_rest",
    description: "Took a long rest at The Dusty Flagon safe room.",
    source: "manual",
  },
];

export const mockCombatLogSessions: SessionLog[] = [
  { id: "sess-001", startedAt: 1700005200000, label: "Session 8 - Dockside Ambush" },
  { id: "sess-002", startedAt: 1700005300000, label: "Session 9 - Vault Breach" },
];

export const mockInventory: InventoryItem[] = [
  {
    id: "inv-001",
    name: "Quarterstaff",
    quantity: 1,
    equipped: true,
    category: "weapon",
    notes: "Simple wooden staff, well-worn",
    weight: 4,
    value: 2,
    attackAbility: "dexterity",
    isProficient: true,
    damageDice: "1d8",
    damageModifier: 4,
    damageType: "bludgeoning",
    weaponRange: "5 ft",
  },
  {
    id: "inv-002",
    name: "Explorer's Pack",
    quantity: 1,
    equipped: false,
    category: "gear",
    notes: "Backpack, bedroll, mess kit, tinderbox, 10 torches, 10 days rations, waterskin, 50ft hemp rope",
    weight: 59,
    value: 10,
  },
  {
    id: "inv-003",
    name: "Healing Potion",
    quantity: 3,
    equipped: false,
    category: "consumable",
    notes: "Restores 2d4+2 HP",
    weight: 0.5,
    value: 50,
    sourceTag: "official",
    tags: ["common", "potion"],
  },
  {
    id: "inv-004",
    name: "Jade Medallion",
    quantity: 1,
    equipped: true,
    category: "quest",
    notes: "Order of the Jade Fist emblem. Proof of membership.",
    weight: 0,
    value: 0,
  },
  {
    id: "inv-005",
    name: "Potion of Speed",
    quantity: 1,
    equipped: false,
    category: "consumable",
    notes: "Grants Haste for 1 minute. Bonus action to drink.",
    weight: 0.5,
    value: 500,
  },
  {
    id: "inv-006",
    name: "Thieves' Tools",
    quantity: 1,
    equipped: false,
    category: "gear",
    notes: "For picking locks and disarming traps",
    weight: 1,
    value: 25,
  },
  {
    id: "inv-007",
    name: "Rope of Climbing",
    quantity: 1,
    equipped: false,
    category: "magic",
    notes: "60ft magical rope. Animates on command. Attunes — not currently attuned.",
    weight: 3,
    value: 2000,
    sourceTag: "official",
    tags: ["uncommon", "wondrous"],
  },
  {
    id: "inv-008",
    name: "Silk Rope (50ft)",
    quantity: 1,
    equipped: false,
    category: "gear",
    weight: 5,
    value: 10,
  },
  {
    id: "inv-009",
    name: "Silver Key",
    quantity: 1,
    equipped: false,
    category: "quest",
    notes: "Found in the ruined monastery. Unknown lock.",
    weight: 0,
    value: 0,
  },
  {
    id: "inv-010",
    name: "Amulet of Inner Peace",
    quantity: 1,
    equipped: true,
    category: "accessory",
    notes: "Wondrous item, very rare (requires attunement by a monk). Crafted from polished jade and engraved with ancient runes; emits a gentle calming aura.",
    weight: 0,
    value: 4500,
    equippedEffects: [
      {
        id: "eff-aip-001",
        type: "feature",
        label: "Enhanced Ki",
        description: "While attuned to this amulet, your maximum Ki points increase by 3.",
        resourceName: "Focus Points",
        resourceMaxBonus: 3,
      },
      {
        id: "eff-aip-002",
        type: "buff",
        label: "Iron Will",
        description: "You gain advantage on saving throws against being charmed or frightened, and magic can't put you asleep.",
      },
      {
        id: "eff-aip-003",
        type: "spell",
        label: "Pass without Trace",
        description: "You can cast the pass without trace spell once per long rest without expending a spell slot or requiring material components.",
        uses: 1,
        resetOn: "long_rest",
      },
      {
        id: "eff-aip-004",
        type: "feature",
        label: "Unyielding Resolve",
        description: "When you roll for initiative, you can choose to gain temporary hit points equal to your Monk level + your Wisdom modifier OR gain a bonus to the roll equal to your Wisdom modifier. This ability can be used once per long rest.",
      },
      {
        id: "eff-aip-005",
        type: "feature",
        label: "River of Serenity",
        description: "As a bonus action, you can spend 1 Ki point to enter a state of heightened awareness and inner peace. For the next minute, you have advantage on Wisdom (Perception) checks and Dexterity (Acrobatics) checks. You can use this ability a number of times equal to your Wisdom modifier (minimum of once) per long rest.",
      },
    ],
    sourceTag: "custom",
    tags: ["very rare", "attunement", "monk"],
  },
  {
    id: "inv-011",
    name: "Cloak of Protection",
    quantity: 1,
    equipped: false,
    category: "magic",
    notes: "+1 bonus to AC and all saving throws while worn (requires attunement).",
    weight: 1,
    value: 3500,
    sourceTag: "official",
    tags: ["uncommon", "wondrous", "attunement"],
  },
  {
    id: "inv-012",
    name: "Skyglass Grapnel",
    quantity: 1,
    equipped: false,
    category: "gear",
    notes: "Custom foldable climbing hook made by Mira. Grants advantage on checks to secure rope in stone or timber.",
    weight: 2,
    value: 180,
    sourceTag: "custom",
    tags: ["custom", "traversal"],
  },
];

// ── Campaign Locations ─────────────────────────────────────────────────────────

export const mockLocations: CampaignLocation[] = [
  {
    id: "loc-001",
    name: "Ironveil",
    description: "A sprawling port city governed by a merchant council. Known for its layered politics, busy harbour, and flourishing criminal underworld. The Order of the Jade Fist has no official presence here.",
    notes: "City guard are paid to look the other way in the docks district. The Blackwater Thieves' Guild effectively runs half the city.",
    questTags: ["q-005"],
    createdAt: 1700000001000,
  },
  {
    id: "loc-002",
    name: "Blackwater Docks",
    parentLocationId: "loc-001",
    description: "The rough waterfront district of Ironveil. The air smells of salt, fish, and rotting timber. Guild enforcers patrol openly at night. The guild hall is hidden beneath a fishmonger's at 14 Anchor Street.",
    notes: "Secret entrance at 14 Anchor Street — requires a guild token (copper disc stamped with an anchor) to pass the inner guards. The vault is two levels below the main hall.",
    questTags: ["q-001", "q-002", "q-003", "q-006"],
    createdAt: 1700000002000,
  },
  {
    id: "loc-003",
    name: "The Jade Monastery",
    description: "A remote mountain monastery far to the east, home of the Order of the Jade Fist. Partially ransacked six months ago when thieves broke in and stole the three sacred relics.",
    notes: "Elder Shen remains at the monastery coordinating the search. Communication only by sending spell or messenger bird — takes 4–5 days.",
    questTags: ["q-001", "q-005"],
    createdAt: 1700000003000,
  },
  {
    id: "loc-004",
    name: "The Dusty Flagon",
    parentLocationId: "loc-001",
    description: "A cramped but lively tavern in Ironveil's market district. Run by old Garrett, a former sailor who asks no questions. Mira Voss holds court here most evenings at a corner table.",
    notes: "Safe to talk freely — Garrett sweeps for guild spies each morning. Good place to leave messages via the bartender.",
    questTags: ["q-004"],
    createdAt: 1700000004000,
  },
  {
    id: "loc-005",
    name: "Silvergate District",
    parentLocationId: "loc-001",
    description: "Ironveil's wealthiest quarter, where merchant lords maintain palatial townhouses. Heavily patrolled by private guards. Lord Cavendish's estate is the tall white-stone building beside the clock tower.",
    notes: "Lord Cavendish receives visitors by appointment only — Mira can arrange an introduction for 20 gp.",
    questTags: ["q-002"],
    createdAt: 1700000005000,
  },
];

// ── NPCs / People ──────────────────────────────────────────────────────────────

export const mockPeople: NpcPerson[] = [
  {
    id: "p-001",
    name: "Elder Shen",
    role: "Quest Giver — Order of the Jade Fist",
    relationship: "ally",
    description: "Lyra's master and head of the Order of the Jade Fist. A tall, weathered man in his seventies with calm grey eyes and slow deliberate movements. He radiates quiet authority.",
    notes: "Elder Shen has authorised up to 400 gp as a bribe to recover the relics peacefully. He will pay 500 gp reward upon safe return of all three relics. He does not condone unnecessary killing.",
    questTags: ["q-001", "q-003"],
    createdAt: 1700000010000,
  },
  {
    id: "p-002",
    name: "Captain Harlan Vex",
    role: "Guild Master — Ironveil Thieves' Guild",
    relationship: "hostile",
    description: "A stocky, cold-eyed man of about fifty with cropped silver hair and a scar running through his left eyebrow. Professionally ruthless. Runs the guild like a business — no sentiment, only profit.",
    notes: "Harlan took the relics on commission from an unknown buyer who vanished before paying. He may be willing to sell them back at a price. He is never seen without two bodyguards. Operates from the guild hall at Blackwater Docks.",
    questTags: ["q-001", "q-002"],
    createdAt: 1700000011000,
  },
  {
    id: "p-003",
    name: "Lord Aldric Cavendish",
    role: "Merchant Lord — Silvergate District",
    relationship: "neutral",
    description: "An immaculately dressed merchant lord, mid-forties, with an oiled beard and cold calculating eyes. He masks cruelty behind impeccable manners. His shipping empire has been bleeding gold to guild extortion for three years.",
    notes: "Cavendish is offering 800 gp for proof of Harlan Vex's death — his guild signet ring. Payment on delivery. He will leave Ironveil in approximately 10 days. He does not know about the relics.",
    questTags: ["q-002"],
    createdAt: 1700000012000,
  },
  {
    id: "p-004",
    name: "Mira Voss",
    role: "Information Broker — The Dusty Flagon",
    relationship: "ally",
    description: "A quick-witted half-elf woman in her thirties. Sharp eyes that miss nothing, and a warm laugh that disarms people before they realise they've said too much. Knows everyone worth knowing in Ironveil.",
    notes: "Provided the guild hall location and tunnel entrance details in exchange for settling her debt with The Needle. She can arrange a meeting with Harlan Vex if needed but says it will cost at least 150 gp in introductions.",
    questTags: ["q-001", "q-004"],
    createdAt: 1700000013000,
  },
  {
    id: "p-005",
    name: "Bren Ashford",
    role: "Contact — Thistlewick",
    relationship: "ally",
    description: "An unassuming middle-aged man who deals in information and oddities out of a cramped bookshop in Thistlewick. An old friend who owes Lyra a favour from two years ago.",
    notes: "Bren confirmed the relics passed through Thistlewick headed for Ironveil. He also mentioned Sister Yeva was asking questions about the same shipment two weeks before she went missing.",
    questTags: ["q-003"],
    createdAt: 1700000014000,
  },
  {
    id: "p-006",
    name: "Sister Yeva",
    role: "Missing Monk — Order of the Jade Fist",
    relationship: "ally",
    description: "A young monk from the order, twenty-two years old, slight build but remarkably fast. She volunteered to track the relics ahead of Lyra. Has been missing for three weeks.",
    notes: "Last known location: Blackwater Docks, asking about recent cargo shipments. Bren believes she was captured by guild enforcers. She may be held in the guild hall's lower level — same floor as the vault.",
    questTags: ["q-003"],
    createdAt: 1700000015000,
  },
];

// ── Quests ─────────────────────────────────────────────────────────────────────
//
//  ⚠ CONFLICTING QUESTS:
//    q-001 "Broker a Deal with Harlan Vex" requires Harlan alive to negotiate.
//    q-002 "The Merchant's Revenge"         requires Harlan alive to assassinate.
//
//  Completing q-001 (deal struck, Harlan flees the city) → q-002 fails.
//  Completing q-002 (Harlan assassinated)                → q-001 fails.

export const mockQuests: Quest[] = [
  {
    id: "q-001",
    name: "Broker a Deal with Harlan Vex",
    type: "main",
    status: "active",
    description: "Elder Shen believes the relics can be recovered without bloodshed. I need to meet with Captain Harlan Vex, the guild master, and negotiate their return — offering payment if necessary.",
    notes: "Harlan must be alive and in Ironveil for this to work. Mira Voss can arrange a meeting for 150 gp. Elder Shen has authorised up to 400 gp as a bribe, plus I can offer to call off any outside pressure on the guild. Reward from Elder Shen: 500 gp and the blessed Ring of the Open Palm upon delivery of all three relics to the monastery.",
    locationTags: ["loc-002", "loc-003"],
    createdAt: 1700001000000,
  },
  {
    id: "q-002",
    name: "The Merchant's Revenge",
    type: "side",
    status: "active",
    description: "Lord Aldric Cavendish is paying 800 gp for the death of Captain Harlan Vex. The guild has been extorting his shipping empire for years and Cavendish wants it ended — permanently.",
    notes: "Proof of death required: Harlan's guild signet ring (gold, anchor engraving). Payment on delivery at Cavendish's estate in Silvergate District. Harlan must be killed before Cavendish leaves the city in approximately 10 days. This must be done quietly — Cavendish cannot be implicated. ⚠ Warning: killing Harlan before brokering the relic deal will make recovering the relics through negotiation impossible.",
    locationTags: ["loc-002", "loc-005"],
    createdAt: 1700001001000,
  },
  {
    id: "q-003",
    name: "Find Sister Yeva",
    type: "main",
    status: "active",
    description: "Sister Yeva, a monk of the Order of the Jade Fist, went missing three weeks ago while tracking the stolen relics in Ironveil. She must be found and brought home safely.",
    notes: "Last seen at the Blackwater Docks asking about cargo manifests. Bren Ashford believes she was taken by the guild. She may be held in the lower level of the guild hall — the same floor as Harlan's vault. If I'm already planning to infiltrate the guild hall for the relics, I should look for her there.",
    locationTags: ["loc-002"],
    createdAt: 1700001002000,
  },
  {
    id: "q-004",
    name: "Settle Mira's Debt",
    type: "side",
    status: "active",
    description: "In exchange for guild hall intelligence, Mira Voss asked me to convince a loan shark called 'The Needle' to forgive her debt of 200 gp. He operates from a laundry near the market district.",
    notes: "Mira says The Needle is reasonable if approached correctly — he values reputation over coin. She also claims he owes her a favour from years ago. A persuasion check or subtle intimidation should work without violence. Reward: Mira provides ongoing intelligence contacts and 150 gp cash for my trouble.",
    locationTags: ["loc-004"],
    createdAt: 1700001003000,
  },
  {
    id: "q-005",
    name: "Recover the Jade Serpent Staff",
    type: "main",
    status: "completed",
    description: "One of the three stolen relics — the Jade Serpent Staff — had been separated from the others and sold to a private collector in Ironveil named Corvin Blunt.",
    notes: "Successfully recovered. The staff was in Blunt's private study. He surrendered it after I demonstrated its monastic seal matched documents Elder Shen had provided. The other two relics (Mirror of Shen, Lotus Seal) remain in Harlan Vex's vault. Reward received: 80 gp from Elder Shen's emergency fund and a Potion of Greater Healing.",
    locationTags: ["loc-001"],
    createdAt: 1700001004000,
  },
  {
    id: "q-006",
    name: "Rescue the Dockmaster's Son",
    type: "side",
    status: "failed",
    description: "A dockworker pleaded for help after his son was taken during a gang raid near Blackwater Docks.",
    notes: "Failed after a delayed response. The gang moved captives upriver before I reached the safehouse. This failure damaged trust with several dock families.",
    locationTags: ["loc-002"],
    createdAt: 1700001004500,
  },
];

// ── Notes ──────────────────────────────────────────────────────────────────────

export const mockNotes: Note[] = [
  {
    id: "note-001",
    title: "The Three Jade Relics",
    body: "The Order's three sacred relics were stolen six months ago. Two remain missing:\n\n• Jade Serpent Staff — RECOVERED from Corvin Blunt\n• Mirror of Shen — A hand-mirror of polished green jade, said to reveal lies. Believed to be in Harlan's vault.\n• Lotus Seal — A circular jade stamp used to authenticate the Order's scrolls. Also believed to be in the vault.\n\nAll three must be returned to the monastery for the ritual of re-consecration.",
    pinned: true,
    sessionNumber: 6,
    arcName: "Relics of the Jade Fist",
    tags: ["relics", "main-plot", "vault"],
    linkedQuests: ["q-001", "q-003", "q-005"],
    createdAt: 1700002000000,
    updatedAt: 1700002000000,
  },
  {
    id: "note-002",
    title: "Guild Hall — Entry & Layout",
    body: "From Mira Voss (reliable):\n\n• Main entrance on Anchor Street — guarded, requires guild membership.\n• Secret entrance: 14 Anchor Street (fishmonger's). Knock three times on the back door. A guild token (copper anchor disc) is needed to pass inner guards.\n• Layout: ground floor is common areas and offices. One level down is armoury and barracks. Two levels down is the vault and holding cells.\n\nSister Yeva and the relics may both be on the lower level.",
    pinned: true,
    sessionNumber: 7,
    arcName: "Ironveil Intrigue",
    tags: ["intel", "infiltration", "guild"],
    linkedLocations: ["loc-001", "loc-002"],
    linkedNpcs: ["npc-002", "npc-003"],
    createdAt: 1700002001000,
    updatedAt: 1700002001000,
  },
  {
    id: "note-003",
    title: "Key Decision: Deal or Kill?",
    body: "I am being pulled in two directions:\n\n→ Elder Shen wants a peaceful resolution — broker a deal with Harlan, pay him off, get the relics back. Reward: 500 gp + blessed ring.\n\n→ Lord Cavendish wants Harlan dead. Reward: 800 gp.\n\nThese are MUTUALLY EXCLUSIVE. If I kill Harlan, the peaceful relic negotiation is off the table. If I broker a deal (and Harlan leaves the city), Cavendish's contract becomes impossible.\n\nConsiderations:\n- The vault location is only known because of Mira's intel. If Harlan dies, his lieutenants will likely move the contents.\n- Sister Yeva's safety may depend on not triggering an all-out conflict with the guild.\n- Cavendish's money would fund the return journey and then some.",
    pinned: false,
    sessionNumber: 8,
    arcName: "Ironveil Intrigue",
    tags: ["decision", "contract", "harlan-vex"],
    linkedQuests: ["q-001", "q-002"],
    createdAt: 1700002002000,
    updatedAt: 1700002002000,
  },
];

export const mockJournalArcs: JournalArc[] = [
  {
    id: "arc-001",
    name: "Relics of the Jade Fist",
    description: "Recover the monastery relics and decide whether diplomacy or violence wins the city.",
    sessionStart: 4,
    sessionEnd: 10,
    pinned: true,
  },
  {
    id: "arc-002",
    name: "Ironveil Intrigue",
    description: "Navigate rival factions in Ironveil's guild district.",
    sessionStart: 6,
    pinned: false,
  },
  {
    id: "arc-003",
    name: "Debts and Favors",
    description: "Balance personal alliances with city politics and monastery obligations.",
    sessionStart: 7,
    pinned: false,
  },
];

export const mockWishlist: WishlistItem[] = [
  {
    id: "wish-001",
    name: "Bracers of Defense",
    category: "magic",
    rarityTarget: "Rare",
    notes: "Best upgrade if I stay unarmored. Prioritize before level 9.",
    priority: 5,
    source: "Official DMG item",
    status: "wanted",
    createdAt: 1700003000000,
    updatedAt: 1700003000000,
  },
  {
    id: "wish-002",
    name: "Monastery Safehouse Deed",
    category: "quest",
    rarityTarget: "Narrative reward",
    notes: "Discuss with DM as completion reward for relic arc.",
    priority: 4,
    source: "Campaign custom",
    status: "discussed",
    createdAt: 1700003001000,
    updatedAt: 1700003002000,
  },
  {
    id: "wish-003",
    name: "Potion Bandolier",
    category: "accessory",
    rarityTarget: "Uncommon",
    notes: "Custom utility item that lets one potion draw per turn as free object interaction.",
    priority: 3,
    source: "Homebrew crafter in Ironveil",
    status: "shopping",
    createdAt: 1700003003000,
    updatedAt: 1700003005000,
  },
  {
    id: "wish-004",
    name: "Boots of Elvenkind",
    category: "magic",
    rarityTarget: "Uncommon",
    notes: "Already acquired from Corvin Blunt's manor raid.",
    priority: 2,
    source: "Official DMG item",
    status: "acquired",
    archived: true,
    createdAt: 1700003006000,
    updatedAt: 1700003009000,
  },
];

export const mockRealms: Plane[] = [
  {
    id: "plane-material",
    name: "Material Plane",
    description: "The mundane world where Ironveil and the Jade Fist monastery stand.",
    questTags: ["q-001", "q-003", "q-006"],
    locationTags: ["loc-001", "loc-002", "loc-003"],
    notes: "Primary campaign plane.",
    createdAt: 1700004000000,
    pinned: true,
  },
  {
    id: "plane-feywild",
    name: "Feywild",
    description: "Mirror realm of heightened emotion and wild magic.",
    questTags: ["q-004"],
    locationTags: [],
    notes: "Rumored source of the Lotus Seal's enchantment.",
    createdAt: 1700004001000,
    pinned: false,
  },
  {
    id: "plane-shadowfell",
    name: "Shadowfell",
    description: "A bleak echo of the world where lost memories and dead bargains linger.",
    questTags: ["q-002"],
    locationTags: [],
    notes: "Cavendish's occult contacts may tie into this plane.",
    createdAt: 1700004002000,
    pinned: false,
  },
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildVariantSnapshot(input: {
  key: string;
  character: Character;
  attackNames: [string, string, string];
  resourceLabel: string;
  companionNames: [string, string];
}): CharacterSnapshot {
  const attacks = deepClone(mockAttacks).map((attack, index) => ({
    ...attack,
    id: `${input.key}-${attack.id}`,
    name: input.attackNames[index] ?? attack.name,
    linkedInventoryItemId: attack.linkedInventoryItemId ? `${input.key}-${attack.linkedInventoryItemId}` : undefined,
    reminders: attack.reminders?.map((reminder) => ({
      ...reminder,
      id: `${input.key}-${reminder.id}`,
    })),
  }));

  const resources = deepClone(mockResources).map((resource) => ({
    ...resource,
    id: `${input.key}-${resource.id}`,
    name: resource.name === "Focus Points" ? input.resourceLabel : resource.name,
  }));

  const inventory = deepClone(mockInventory).map((item) => ({
    ...item,
    id: `${input.key}-${item.id}`,
    equippedEffects: item.equippedEffects?.map((effect) => ({
      ...effect,
      id: `${input.key}-${effect.id}`,
      resourceName: effect.resourceName === "Focus Points" ? input.resourceLabel : effect.resourceName,
    })),
  }));

  const conditions = deepClone(mockConditions).map((condition) => ({
    ...condition,
    id: `${input.key}-${condition.id}`,
  }));

  const classFeatures = deepClone(mockClassFeatures).map((feature) => ({
    ...feature,
    id: `${input.key}-${feature.id}`,
    description: feature.description.replace(/Focus/g, input.resourceLabel.replace(/ Points$/, "")),
  }));

  const passiveFeatures = deepClone(mockPassiveFeatures).map((feature) => ({
    ...feature,
    id: `${input.key}-${feature.id}`,
  }));

  const preparedSpells = deepClone(mockPreparedSpells).map((spell) => ({
    ...spell,
    id: `${input.key}-${spell.id}`,
  }));

  const companions = deepClone(mockCompanions).map((companion, index) => ({
    ...companion,
    id: `${input.key}-${companion.id}`,
    characterId: input.character.id,
    name: input.companionNames[index] ?? companion.name,
  }));

  const combatLog = {
    entries: deepClone(mockCombatLogEntries).map((entry) => ({
      ...entry,
      id: `${input.key}-${entry.id}`,
      sessionId: `${input.key}-${entry.sessionId}`,
      description: entry.description.replace("Lyra", input.character.name),
    })),
    sessions: deepClone(mockCombatLogSessions).map((session) => ({
      ...session,
      id: `${input.key}-${session.id}`,
      label: `${session.label} (${input.character.name})`,
    })),
  };

  return {
    _version: 1,
    character: deepClone(input.character),
    attacks,
    resources,
    inventory,
    conditions,
    notes: deepClone(mockNotes),
    quests: deepClone(mockQuests),
    people: deepClone(mockPeople),
    locations: deepClone(mockLocations),
    wishlist: deepClone(mockWishlist),
    journalArcs: deepClone(mockJournalArcs),
    realms: deepClone(mockRealms),
    spellSlots: deepClone(mockSpellSlots),
    classFeatures,
    passiveFeatures,
    preparedSpells,
    companions,
    combatLog,
  };
}

export const mockLyraSnapshot: CharacterSnapshot = buildVariantSnapshot({
  key: "lyra",
  character: mockCharacter,
  attackNames: ["Unarmed Strike", "Quarterstaff", "Deflect Missiles (Return)"],
  resourceLabel: "Focus Points",
  companionNames: ["Whisper", "Lantern Sprite"],
});

export const mockDariusCharacter: Character = {
  ...deepClone(mockCharacter),
  id: "char-002",
  name: "Darius Emberward",
  class: "Paladin",
  subclass: "Oath of Vengeance",
  race: "Dragonborn",
  background: "Soldier",
  level: 7,
  armorClass: 19,
  currentHp: 64,
  maxHp: 64,
  tempHp: 5,
  speed: 30,
  initiative: 1,
  proficiencyBonus: 3,
  abilityScores: {
    strength: 18,
    dexterity: 12,
    constitution: 16,
    intelligence: 10,
    wisdom: 12,
    charisma: 16,
  },
  currency: { cp: 10, sp: 16, ep: 0, gp: 182, pp: 3 },
  notes:
    "Former city sentinel turned relic hunter. Built for front-line pressure testing and concentration checks under heavy incoming damage.",
};

export const mockDariusSnapshot: CharacterSnapshot = (() => {
  const snapshot = buildVariantSnapshot({
    key: "darius",
    character: mockDariusCharacter,
    attackNames: ["Longsword", "Javelin", "Opportunity Strike (Reaction Drill)"],
    resourceLabel: "Channel Divinity Points",
    companionNames: ["Ashclaw Hound", "Aegis Wisp"],
  });

  snapshot.resources = snapshot.resources.map((resource) => {
    if (resource.name === "Channel Divinity Points") {
      return {
        ...resource,
        current: 1,
        max: 2,
        resetOn: "short_rest",
        notes: "Starts at 1/2 to test short-rest recovery and action gating.",
      };
    }
    return resource;
  });

  snapshot.resources.push({
    id: "darius-res-lay-on-hands",
    name: "Lay on Hands Pool",
    current: 8,
    max: 35,
    resetOn: "long_rest",
    color: "#16A34A",
    notes: "Starts nearly depleted to test healing triage and spend-order decisions.",
  });

  snapshot.conditions = [
    {
      id: "darius-cond-shield-faith",
      name: "Shield of Faith",
      source: "Self",
      removeOn: ["manual", "long_rest"],
      notes: "Concentration active with 1 round left; ideal for concentration break verification.",
      durationType: "rounds",
      durationValue: 10,
      remainingDuration: 1,
      tickTiming: "onRoundAdvance",
      concentrationLink: "darius-shield-faith",
    },
    {
      id: "darius-cond-hunters-marked",
      name: "Marked by Hunter",
      source: "Enemy Ranger",
      removeOn: ["manual", "short_rest", "long_rest"],
      notes: "Used to validate incoming damage pressure and status persistence handling.",
      durationType: "turns",
      durationValue: 10,
      remainingDuration: 2,
      tickTiming: "onTargetTurnEnd",
    },
  ];

  snapshot.spellSlots = [
    { level: 1, total: 4, used: 3 },
    { level: 2, total: 3, used: 2 },
    { level: 3, total: 0, used: 0 },
    { level: 4, total: 0, used: 0 },
    { level: 5, total: 0, used: 0 },
    { level: 6, total: 0, used: 0 },
    { level: 7, total: 0, used: 0 },
    { level: 8, total: 0, used: 0 },
    { level: 9, total: 0, used: 0 },
  ];

  snapshot.preparedSpells = [
    {
      id: "darius-spl-shield-faith",
      name: "Shield of Faith",
      level: 1,
      school: "Abjuration",
      castingTime: "1 bonus action",
      range: "60 feet",
      duration: "Concentration, up to 10 minutes",
      concentration: true,
      ritual: false,
      description: "Bonus-action concentration spell used for concentration-retention edge testing.",
      prepared: true,
      createdAt: 1700006100000,
    },
    {
      id: "darius-spl-command",
      name: "Command",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      duration: "1 round",
      concentration: false,
      ritual: false,
      description: "Single-target control to test action economy plus save resolution.",
      prepared: true,
      createdAt: 1700006100100,
    },
    {
      id: "darius-spl-misty-step",
      name: "Misty Step",
      level: 2,
      school: "Conjuration",
      castingTime: "1 bonus action",
      range: "Self",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      description: "Mobility bailout for target/context switching validation.",
      prepared: true,
      createdAt: 1700006100200,
    },
  ];

  snapshot.attacks = snapshot.attacks.map((attack) => {
    if (attack.name === "Opportunity Strike (Reaction Drill)") {
      return {
        ...attack,
        notes: "Reaction-focused attack card for opportunity window testing.",
      };
    }
    return attack;
  });

  return snapshot;
})();

export const mockSeleneCharacter: Character = {
  ...deepClone(mockCharacter),
  id: "char-003",
  name: "Selene Nightglass",
  class: "Rogue",
  subclass: "Arcane Trickster",
  race: "Half-Elf",
  background: "Charlatan",
  level: 7,
  armorClass: 16,
  currentHp: 46,
  maxHp: 46,
  tempHp: 0,
  speed: 35,
  initiative: 5,
  proficiencyBonus: 3,
  abilityScores: {
    strength: 10,
    dexterity: 20,
    constitution: 14,
    intelligence: 14,
    wisdom: 12,
    charisma: 14,
  },
  currency: { cp: 22, sp: 44, ep: 0, gp: 238, pp: 1 },
  notes:
    "Infiltration specialist for edge-case combat testing: stealth openers, high initiative turns, and bonus-action economy.",
};

export const mockSeleneSnapshot: CharacterSnapshot = (() => {
  const snapshot = buildVariantSnapshot({
    key: "selene",
    character: mockSeleneCharacter,
    attackNames: ["Rapier (Sneak Attack)", "Hand Crossbow", "Uncanny Dodge Counterline"],
    resourceLabel: "Arcane Charges",
    companionNames: ["Needle Raven", "Glasscat Familiar"],
  });

  snapshot.resources = snapshot.resources.map((resource) => {
    if (resource.name === "Arcane Charges") {
      return {
        ...resource,
        current: 1,
        max: 4,
        resetOn: "long_rest",
        notes: "Low remaining charges to test depletion warnings and fallback action paths.",
      };
    }
    return resource;
  });

  snapshot.resources.push({
    id: "selene-res-reaction-drill",
    name: "Reaction Drill Charges",
    current: 1,
    max: 1,
    resetOn: "short_rest",
    color: "#2563EB",
    notes: "Used to validate reaction-spend and refund behavior in rapid combat loops.",
  });

  snapshot.conditions = [
    {
      id: "selene-cond-invisible",
      name: "Greater Invisibility",
      source: "Self",
      removeOn: ["manual", "long_rest"],
      notes: "Concentration state starts with 1 round remaining for expiry/break testing.",
      durationType: "rounds",
      durationValue: 10,
      remainingDuration: 1,
      tickTiming: "onRoundAdvance",
      concentrationLink: "selene-greater-invisibility",
    },
    {
      id: "selene-cond-revealed",
      name: "Faerie Fire (Revealed)",
      source: "Enemy Caster",
      removeOn: ["manual", "short_rest", "long_rest"],
      notes: "Competing visibility effects to validate condition apply/remove sequencing.",
      durationType: "turns",
      durationValue: 10,
      remainingDuration: 2,
      tickTiming: "onTargetTurnEnd",
    },
  ];

  snapshot.spellSlots = [
    { level: 1, total: 4, used: 4 },
    { level: 2, total: 2, used: 2 },
    { level: 3, total: 0, used: 0 },
    { level: 4, total: 0, used: 0 },
    { level: 5, total: 0, used: 0 },
    { level: 6, total: 0, used: 0 },
    { level: 7, total: 0, used: 0 },
    { level: 8, total: 0, used: 0 },
    { level: 9, total: 0, used: 0 },
  ];

  snapshot.preparedSpells = [
    {
      id: "selene-spl-shield",
      name: "Shield",
      level: 1,
      school: "Abjuration",
      castingTime: "1 reaction",
      range: "Self",
      duration: "1 round",
      concentration: false,
      ritual: false,
      description: "Reaction spell to stress reaction window timing and duplicate spend prevention.",
      prepared: true,
      createdAt: 1700006200000,
    },
    {
      id: "selene-spl-silvery-barbs",
      name: "Silvery Barbs",
      level: 1,
      school: "Enchantment",
      castingTime: "1 reaction",
      range: "60 feet",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      description: "Competing reaction option to validate reaction declaration mismatch handling.",
      prepared: true,
      createdAt: 1700006200100,
    },
    {
      id: "selene-spl-hold-person",
      name: "Hold Person",
      level: 2,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      duration: "Concentration, up to 1 minute",
      concentration: true,
      ritual: false,
      description: "Concentration control spell for remote preview and save-resolution edge cases.",
      prepared: true,
      createdAt: 1700006200200,
    },
  ];

  snapshot.attacks = snapshot.attacks.map((attack) => {
    if (attack.name === "Rapier (Sneak Attack)") {
      return {
        ...attack,
        notes: "Primary burst profile for initiative-first and single-target spike validation.",
      };
    }
    if (attack.name === "Uncanny Dodge Counterline") {
      return {
        ...attack,
        notes: "Use to validate reaction messaging while under conflicting status conditions.",
      };
    }
    return attack;
  });

  return snapshot;
})();

export type DemoCharacterProfile = {
  key: string;
  label: string;
  subtitle: string;
  snapshot: CharacterSnapshot;
};

export const demoCharacterProfiles: DemoCharacterProfile[] = [
  {
    key: "lyra",
    label: "Lyra Shadowstep",
    subtitle: "Monk 7 - mobile striker with condition pressure",
    snapshot: mockLyraSnapshot,
  },
  {
    key: "darius",
    label: "Darius Emberward",
    subtitle: "Paladin 7 - concentration pressure and reaction-window checks",
    snapshot: mockDariusSnapshot,
  },
  {
    key: "selene",
    label: "Selene Nightglass",
    subtitle: "Arcane Trickster 7 - initiative spikes and turn-economy exhaustion",
    snapshot: mockSeleneSnapshot,
  },
];
