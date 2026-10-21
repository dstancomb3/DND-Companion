import { estimateItemPriceFromResources } from "./itemPricing";
import { RACE_GROUPS } from "./dnd5e";

// ─── Random Roll Helpers ──────────────────────────────────────────────────────

export function roll<T>(arr: T[]): T {
  if (arr.length === 0) {
    throw new Error("Cannot roll from an empty array");
  }
  if (arr.length === 1) {
    return arr[0];
  }

  const cacheKey = arr as unknown as object;
  const prior = (ROLL_RECENT_CACHE.get(cacheKey) as T[] | undefined) ?? [];
  const avoidCount = Math.min(3, arr.length - 1);
  const recent = prior.slice(-avoidCount);

  const pool = arr.filter((item) => !recent.includes(item));
  const choices = pool.length > 0 ? pool : arr;
  const picked = choices[Math.floor(Math.random() * choices.length)];

  ROLL_RECENT_CACHE.set(cacheKey, [...recent, picked]);
  return picked;
}

export function rollMany<T>(arr: T[], n: number): T[] {
  if (n <= 0 || arr.length === 0) return [];
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

const ROLL_RECENT_CACHE = new WeakMap<object, unknown[]>();

export function rollDice(sides: number, count = 1): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
  return total;
}

export function roll4d6DropLowest(): number {
  const rolls = [rollDice(6), rollDice(6), rollDice(6), rollDice(6)];
  rolls.sort((a, b) => a - b);
  return rolls.slice(1).reduce((a, b) => a + b, 0);
}

// ─── NPC Tables ──────────────────────────────────────────────────────────────

export const MALE_NAMES = [
  "Aldric", "Brennus", "Casimir", "Dorin", "Edric", "Ferris", "Garrett",
  "Harlow", "Ivan", "Joran", "Kylen", "Loric", "Malvyn", "Norrik", "Orin",
  "Perrin", "Quill", "Rowan", "Soren", "Talvan", "Ulric", "Varis", "Wren",
  "Xander", "Yoren", "Zeb", "Aladar", "Boros", "Crest", "Davan", "Elmric",
  "Fendrel", "Gavyn", "Hadrim", "Imrin", "Jarvin", "Keth", "Lorin", "Maren",
  "Nyle", "Oskar", "Pell", "Radik", "Simeon", "Torvald", "Urgon", "Varek",
  "Wendell", "Yorick", "Aeron", "Bastian", "Corvin", "Daelen", "Eldon",
  "Fenric", "Garran", "Hadrian", "Ilyan", "Jareth", "Kaelin", "Leoric",
  "Merek", "Nethan", "Orrin", "Paxton", "Quorin", "Roderic", "Sylas",
  "Theron", "Urik", "Valen", "Weston", "Xael", "Yaric", "Zorin", "Ansel",
  "Branok", "Caius", "Draven", "Eamon", "Faelan", "Gideon", "Halric",
  "Isen", "Jovik", "Kieran", "Lucan", "Maddox", "Nikolai", "Orson",
  "Pryce", "Quade", "Ronan", "Stellan", "Tristan", "Upton", "Viggo",
  "Wyatt", "Zephan",
];

export const FEMALE_NAMES = [
  "Aela", "Brynn", "Celia", "Dara", "Eira", "Faya", "Gwen", "Hara",
  "Isidra", "Jessa", "Kyra", "Lyra", "Mira", "Nira", "Ora", "Pella",
  "Quinn", "Riven", "Syla", "Tara", "Ula", "Vex", "Wyla", "Xira",
  "Yeva", "Zara", "Amara", "Britta", "Cael", "Delara", "Eryn", "Fela",
  "Gwynna", "Haela", "Ilara", "Jora", "Kessa", "Liris", "Maela", "Navara",
  "Opal", "Priya", "Riva", "Selene", "Thalia", "Ulara", "Vanya", "Wren",
  "Ysolde", "Zarela", "Adira", "Briala", "Coris", "Daphne", "Elowen",
  "Fiora", "Greta", "Helena", "Ione", "Junia", "Kaia", "Lunara", "Maris",
  "Nadia", "Odette", "Petra", "Quella", "Rhea", "Sabrina", "Talia", "Uma",
  "Verena", "Winry", "Xanthe", "Yara", "Zinnia", "Anika", "Bianca", "Cora",
  "Daria", "Elara", "Freya", "Gianna", "Hestia", "Iris", "Juno", "Kara",
  "Leona", "Mina", "Noelle", "Oriana", "Portia", "Quinley", "Rosalind",
  "Seraphine", "Tess", "Ursa", "Valora", "Willow", "Zadie",
];

export const SURNAMES = [
  "Ashbend", "Blackwood", "Coldwater", "Darkstone", "Emberfall", "Frostmantle",
  "Goldvein", "Highpeak", "Ironwall", "Jadewing", "Keenspire", "Lighthollow",
  "Moonrise", "Nightfall", "Oakheart", "Pilgrim", "Quicksilver", "Redthorn",
  "Stonewall", "Thornback", "Umbra", "Valorhands", "Willowmere", "Zephyrblade",
  "Crowley", "Dimsworth", "Edgewise", "Falkner", "Greymantle", "Harwick",
  "Ironcroft", "Jaspervale", "Knightley", "Larkfield", "Mossbridge", "Netherby",
  "Oldbury", "Pennywhistle", "Ravenscroft", "Saltmere", "Tidewatch", "Underhill",
  "Windermere", "Foxhollow", "Gablewick", "Aldercrest", "Briarstone",
  "Cindervale", "Dawntracker", "Eaglecrest", "Flintmoor", "Grimward",
  "Hawkridge", "Ivorybrook", "Juniper", "Kingswell", "Longstride", "Mistbloom",
  "Northgate", "Oathkeeper", "Pineward", "Quickstep", "Rimewell", "Stormborn",
  "Thistledown", "Umberfield", "Valeguard", "Wintermere", "Yewbranch",
  "Amberhide", "Bracken", "Cloudbreaker", "Deepmere", "Evenwood", "Farrow",
  "Gravesend", "Hollowbrook", "Icevein", "Keenblade", "Lightfoot", "Marrowind",
  "Nightsong", "Oakenford", "Proudmore", "Rookhaven", "Starling", "Truehart",
  "Umbermoor", "Voss", "Wolfsbane",
];

type WeightedNameStyle = "classic" | "noble" | "wild";
export type NameStyle = WeightedNameStyle | "any";

const WEIGHTED_NAME_STYLES: WeightedNameStyle[] = ["classic", "noble", "wild"];

function splitIntoStylePools(values: string[]): Record<WeightedNameStyle, string[]> {
  if (values.length < 3) {
    return {
      classic: [...values],
      noble: [...values],
      wild: [...values],
    };
  }

  const chunkSize = Math.ceil(values.length / 3);
  const classic = values.slice(0, chunkSize);
  const noble = values.slice(chunkSize, chunkSize * 2);
  const wild = values.slice(chunkSize * 2);

  return {
    classic: classic.length > 0 ? classic : [...values],
    noble: noble.length > 0 ? noble : [...values],
    wild: wild.length > 0 ? wild : [...values],
  };
}

const MALE_NAME_STYLE_POOLS = splitIntoStylePools(MALE_NAMES);
const FEMALE_NAME_STYLE_POOLS = splitIntoStylePools(FEMALE_NAMES);
const SURNAME_STYLE_POOLS = splitIntoStylePools(SURNAMES);

function rollWeightedNameStyle(): WeightedNameStyle {
  const value = Math.random();
  if (value < 0.52) return "classic";
  if (value < 0.82) return "noble";
  return "wild";
}

export function generateRandomName(input: {
  gender: string;
  style?: NameStyle;
}): { fullName: string; firstName: string; surname: string; style: WeightedNameStyle } {
  const resolvedStyle: WeightedNameStyle =
    input.style && input.style !== "any" ? input.style : rollWeightedNameStyle();

  const firstNamePool =
    input.gender === "Female"
      ? FEMALE_NAME_STYLE_POOLS[resolvedStyle]
      : input.gender === "Male"
        ? MALE_NAME_STYLE_POOLS[resolvedStyle]
        : [...MALE_NAME_STYLE_POOLS[resolvedStyle], ...FEMALE_NAME_STYLE_POOLS[resolvedStyle]];

  const firstName = roll(firstNamePool);
  const surname = roll(SURNAME_STYLE_POOLS[resolvedStyle]);

  return {
    fullName: `${firstName} ${surname}`,
    firstName,
    surname,
    style: resolvedStyle,
  };
}

export const NPC_RACES = [
  "Human", "High Elf", "Wood Elf", "Drow", "Hill Dwarf", "Mountain Dwarf",
  "Lightfoot Halfling", "Rock Gnome", "Half-Elf", "Half-Orc", "Tiefling",
  "Dragonborn", "Aasimar", "Tabaxi", "Goliath", "Firbolg", "Genasi",
  "Kenku", "Lizardfolk", "Orc", "Goblin", "Kobold",
];

// Flatten all races and subraces from RACE_GROUPS for expanded NPC generation
export const ALL_NPC_RACES = RACE_GROUPS.flatMap((group) =>
  group.races.flatMap((race) => race.subraces ?? [race.base])
);

export const NPC_GENDERS = ["Male", "Female", "Non-binary"];

export const NPC_AGES = [
  "Teen (14–16)",
  "Young (17–25)",
  "Adult (26–40)",
  "Middle-aged (41–60)",
  "Elder (61–80)",
  "Ancient (81+)",
  "Venerable (100+)",
];

export const NPC_ALIGNMENTS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil",
];

export const NPC_OCCUPATIONS = [
  "Innkeeper", "Blacksmith", "Merchant", "Farmer", "City Guard", "Temple Priest",
  "Scholar", "Sailor", "Traveling Bard", "Herbalist", "Tailor", "Scribe",
  "Hunter", "Fisher", "Cook", "Beggar", "Minor Noble", "Retired Soldier",
  "Alchemist", "Cartographer", "Jeweler", "Tanner", "Brewer", "Baker",
  "Gravedigger", "Dockworker", "Apothecary", "Moneylender", "Street Performer",
  "Bounty Hunter", "Thieves' Guild Member", "Cult Devotee", "Wandering Monk",
  "Disgraced Knight", "Hedge Wizard", "Witch Doctor", "Oracle", "Assassin",
  "Spy", "Fence", "Torturer", "Gladiator", "Pit Fighter",
  "Stablehand", "Librarian", "Messenger", "Lamplighter", "Undertaker",
  "Falconer", "Beast Trainer", "Fortune Teller", "Courtier", "Town Crier",
  "Shipwright", "Mason", "Locksmith", "Accountant", "Smuggler",
  "Perfumer", "Glassblower", "Clockmaker", "Poacher", "Pilgrim Guide",
  "Fence Scout", "Bodyguard", "Debt Collector", "Relic Appraiser", "Archivist",
];

export const NPC_PERSONALITY_TRAITS = [
  "I always have a plan for what to do when things go wrong.",
  "I am always calm, no matter the situation.",
  "I pocket anything I see that might have some use.",
  "I always say exactly what's on my mind.",
  "I have a tell that reveals when I'm lying.",
  "I am blunt to the point of rudeness — but I mean no harm.",
  "I laugh loudly and often, sometimes at inappropriate times.",
  "I am suspicious of strangers and expect the worst of them.",
  "I tend to collect small, worthless keepsakes.",
  "I quote famous sages and philosophers at every opportunity.",
  "I always look for the angles in a deal.",
  "I talk too much when nervous.",
  "I would rather make a new friend than make an enemy.",
  "I am slow to form opinions but firm once they're set.",
  "I have a weakness for flattery.",
  "I don't trust anyone who hasn't earned it.",
  "I tell colorful stories from my past that may or may not be true.",
  "I sleep poorly and have vivid dreams.",
  "I am fastidiously clean and uncomfortable around dirt.",
  "I am fiercely protective of those I consider my people.",
  "I hum or whistle quietly when deep in thought.",
  "I prefer action over talking things through.",
  "I will share anything I have with a friend — and nothing with a stranger.",
  "I eat with gusto and find food deeply comforting.",
  "I speak in whispers even when no one is listening.",
  "I avoid giving a direct answer unless pressed.",
  "I treat every meeting like a negotiation.",
  "I keep careful track of favors owed and favors granted.",
  "I apologize quickly, even when I have done nothing wrong.",
  "I always stand where I can see every exit.",
  "I judge people by their hands before their words.",
  "I use humor to dodge serious questions.",
  "I get deeply focused and tune out the world around me.",
  "I tend to mirror the speech patterns of whoever I'm talking to.",
  "I am generous with advice and stingy with trust.",
  "I keep my promises, but only literally.",
  "I speak to animals as if they understand every word.",
  "I avoid touching people, even in crowds.",
  "I praise discipline and quietly resent authority.",
  "I can't resist testing people's patience.",
  "I act bored when I am actually frightened.",
  "I brag about tiny achievements as if they were legends.",
  "I treat strangers like old friends until proven otherwise.",
  "I overprepare for simple tasks and underprepare for hard ones.",
];

export const NPC_IDEALS = [
  "Justice: People deserve to be treated fairly, no matter their station. (Good)",
  "Freedom: No one should be forced to live under tyranny. (Chaotic)",
  "Order: Society can only thrive if everyone follows the rules. (Lawful)",
  "Ambition: I'll do whatever it takes to reach the top. (Evil)",
  "Balance: Everything has a price, everything has a cost. (Neutral)",
  "Honor: My word is my bond — I never break it. (Lawful)",
  "Charity: Those who have should give to those who have not. (Good)",
  "Knowledge: Truth is the most valuable thing in the world. (Any)",
  "Power: The strong should rule the weak — it's the natural order. (Evil)",
  "Redemption: I have made mistakes, and I must make up for them. (Good)",
  "Survival: I'll do what I must to live another day. (Neutral)",
  "Greed: Wealth is the only real measure of success. (Evil)",
  "Beauty: Life is short — fill it with beautiful things. (Neutral)",
  "Community: The group matters more than the individual. (Lawful)",
  "Mercy: A spared enemy can become tomorrow's ally. (Good)",
  "Legacy: I want to leave something that outlives me. (Any)",
  "Self-Reliance: Depend on no one and you'll never be betrayed. (Neutral)",
  "Tradition: What endured for centuries deserves respect. (Lawful)",
  "Innovation: Old methods hold us back from better futures. (Chaotic)",
  "Glory: Deeds matter only if they are remembered. (Any)",
  "Stability: Predictable lives are safer lives. (Lawful)",
  "Vengeance: Wrongs must be repaid in full. (Evil)",
  "Curiosity: The unknown calls to me more than comfort ever could. (Any)",
  "Duty: I serve because someone must. (Lawful)",
];

export const NPC_BONDS = [
  "I owe a life debt to someone who saved me.",
  "My family was destroyed by war — I will have vengeance.",
  "I love someone I can never be with.",
  "I would do anything to protect the village I grew up in.",
  "I carry a message that must reach its destination, no matter what.",
  "I am searching for a sibling who went missing years ago.",
  "I owe a massive debt to a powerful figure.",
  "I am haunted by memories of an atrocity I witnessed.",
  "A sacred item in my possession must be protected at all costs.",
  "I once made a terrible bargain and am still paying for it.",
  "Everything I do is in memory of someone I've lost.",
  "I am loyal to a faction, no matter the cost.",
  "I will do anything to prove myself to those who doubted me.",
  "A prophecy has shaped my life, whether I believe it or not.",
  "I secretly support someone who would be branded a traitor.",
  "I promised to return a relic to its rightful home.",
  "A child depends on me, even if they do not know it.",
  "I am bound by an oath I no longer believe in.",
  "I guard a map others would kill to possess.",
  "My mentor vanished, and I still search for answers.",
  "I send money to family under a false name.",
  "An old rival saved my life once, and I owe them.",
  "I am trying to rebuild something my ancestors destroyed.",
  "I carry a key but have never found the lock.",
];

export const NPC_FLAWS = [
  "I can't resist a pretty face.",
  "I am easily distracted by the promise of wealth.",
  "I am arrogant and believe few are my equal.",
  "I panic when I feel outnumbered.",
  "I am secretly terrified of dying.",
  "I hold grudges far too long.",
  "I talk before I think.",
  "I have a powerful addiction (drink, gambling, etc.).",
  "I am naive about how the world really works.",
  "I assume the worst about everyone around me.",
  "I am a terrible liar, and everyone knows it.",
  "I will do anything to avoid physical conflict.",
  "I am deeply envious of those better off than me.",
  "My pride will be the death of me someday.",
  "I cannot say no when someone flatters me.",
  "I am terrified of a specific mundane thing (cats, heights, water).",
  "I turn every disagreement into a personal contest.",
  "I hoard supplies and hate sharing them.",
  "I forgive dangerous people too easily.",
  "I sabotage good opportunities by overthinking.",
  "I confuse secrecy with wisdom and hide too much.",
  "I cling to routines even when they harm me.",
  "I underestimate quiet people and overestimate loud ones.",
  "I need to be liked, even by people I don't respect.",
  "I cannot stop digging once I suspect a lie.",
  "I resent being helped and push allies away.",
];

export const NPC_APPEARANCE = [
  "A deep scar runs from chin to left ear.",
  "Mismatched eyes — one brown, one silver-grey.",
  "A heavy jawline and high cheekbones.",
  "Exceptionally tall for their race.",
  "Exceptionally short for their race.",
  "Silver hair despite appearing quite young.",
  "Hands roughened from years of hard labor.",
  "Missing two fingers on the left hand.",
  "A brand or tattoo on the neck or wrist.",
  "A pronounced limp with one leg set slightly shorter.",
  "A shaved head marked with ritual scar lines.",
  "Patchy beard growth with a distinctive white streak.",
  "Immaculate clothing with elaborate stitching and trim.",
  "Travel-stained cloak over dented leather armor.",
  "Has an unusual birthmark in a visible location.",
  "Burn scars along one forearm and shoulder.",
  "A prosthetic hand carved from dark wood.",
  "A gold-capped canine tooth that flashes when they speak.",
  "Cloudy cataract in one eye.",
  "A split lower lip from an old injury.",
  "Keeps sleeves rolled down even in hot weather.",
  "Has ink-stained fingertips no matter how often they wash.",
  "Boots are immaculate even when the rest is muddy.",
  "Wears a cracked signet ring on a chain.",
  "Pronounced adam's apple and a rough, weathered neck.",
  "A faded military tattoo peeks from under their collar.",
  "Crooked nose set badly after an old break.",
  "Salt-bleached hair with sun-darkened skin.",
  "One ear is nicked as if from an old blade wound.",
  "A wide, flat scar across the back of one hand.",
  "Unnaturally pale skin with prominent blue veins.",
  "Freckles densely scattered across nose and cheeks.",
  "A long braid threaded with bone beads.",
  "Callused knuckles and cracked fingernails.",
  "A missing eyebrow replaced by a thin scar line.",
  "A jaw tattoo framing the mouth like fangs.",
  "One shoulder sits noticeably higher than the other.",
];

export const NPC_SECRETS = [
  "They are working as an informant for a rival faction.",
  "They owe a massive debt to a criminal organization.",
  "Their true identity is completely fabricated.",
  "They witnessed a murder and said nothing.",
  "They are in hiding from someone very dangerous.",
  "They are not who they claim to be — same name, different person.",
  "They once betrayed a close friend for personal gain.",
  "They have been slowly stealing from their employer.",
  "They worship a forbidden deity in secret.",
  "They know the location of something very valuable — and very dangerous.",
  "They are related to a famous (or infamous) person they've never met.",
  "They are afflicted with a curse they haven't told anyone about.",
  "They have a second life no one in their current circle knows about.",
  "They survived something they shouldn't have — and don't know why.",
  "They are blackmailing someone in local leadership.",
  "They forged a document that changed a noble line of succession.",
  "They accidentally caused a deadly fire years ago.",
  "They are hiding a runaway heir under a fake identity.",
  "They have been receiving letters from someone long believed dead.",
  "They sold a cursed item and know where it ended up.",
  "They once served the villain they now claim to oppose.",
  "They possess evidence that could topple a guild master.",
  "They smuggle messages for a rebellion they don't fully trust.",
  "They are secretly planning to leave before disaster strikes.",
];

// ─── Item Tables ──────────────────────────────────────────────────────────────

export type ItemQuality = "Common" | "Uncommon" | "Rare" | "Very Rare" | "Legendary" | "Artifact";
export type ItemCategory = "Weapon" | "Armor" | "Accessory" | "Magic" | "Consumable" | "Gear" | "Treasure" | "Map" | "Other" | "Currency" | "Component" | "Junk";

export const ITEM_QUALITIES: ItemQuality[] = [
  "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact",
];

export const ITEM_CATEGORIES: ItemCategory[] = [
  "Weapon", "Armor", "Magic", "Consumable", "Currency", "Component", "Junk",
];

export const QUALITY_VALUE_RANGES: Record<ItemQuality, [number, number]> = {
  Common: [1, 50],
  Uncommon: [50, 300],
  Rare: [300, 3000],
  "Very Rare": [3000, 15000],
  Legendary: [15000, 150000],
  Artifact: [150000, 750000],
};

export const RANDOM_ITEMS: Record<ItemCategory, Record<ItemQuality, string[]>> = {
  Weapon: {
    Common: [
      "Handaxe", "Club", "Dagger", "Javelin", "Light Crossbow", "Shortbow",
      "Quarterstaff", "Shortsword", "Spear", "Light Hammer",
    ],
    Uncommon: [
      "Sword of Warning", "+1 Shortsword", "+1 Handaxe", "Javelin of Lightning",
      "+1 Dagger", "Trident of Fish Command", "Mace of Smiting (basic)",
    ],
    Rare: [
      "+2 Longsword", "Flametongue", "Sunblade", "Sword of Sharpness",
      "+2 Battleaxe", "Dwarven Thrower", "Oathbow", "Flame-Tongue Shortsword",
    ],
    "Very Rare": [
      "+3 Greatsword", "Sword of Life Stealing", "Dancing Sword",
      "+3 Warhammer", "Nine Lives Stealer", "Frost Brand",
    ],
    Legendary: [
      "Vorpal Sword", "Holy Avenger", "Luck Blade", "Sword of Answering",
      "Staff of the Magi", "Staff of Power",
    ],
    Artifact: [
      "Blackrazor", "Wave", "Whelm", "Sword of Kas", "Eye and Hand of Vecna",
    ],
  },
  Armor: {
    Common: [
      "Leather Armor", "Studded Leather", "Scale Mail", "Chain Mail",
      "Ring Mail", "Shield", "Splint Armor",
    ],
    Uncommon: [
      "+1 Leather Armor", "Mithral Chain Mail", "Adamantine Scale Mail",
      "+1 Shield", "Mithral Breastplate",
    ],
    Rare: [
      "+2 Chain Mail", "Armor of Resistance (random element)", "+2 Breastplate",
      "Demon Armor", "Dragon Scale Mail",
    ],
    "Very Rare": [
      "+3 Plate Armor", "Armor of Invulnerability", "+3 Chain Mail",
      "Efreeti Chain", "Shield of Missile Attraction",
    ],
    Legendary: [
      "Plate Armor of Etherealness", "Armor of Invulnerability (attuned)",
      "Demon Armor (legendary version)",
    ],
    Artifact: [
      "Armor of Achilles", "Shield of Pelor", "Robe of the Archmagi (Artifact tier)",
    ],
  },
  Magic: {
    Common: [
      "Candle of the Deep", "Cloak of Billowing", "Cloak of Many Fashions",
      "Driftglobe", "Hat of Wizardry", "Rope of Mending",
      "Smoldering Armor (cosmetic)", "Wand of Scowls",
    ],
    Uncommon: [
      "Bag of Holding", "Boots of Elvenkind", "Cloak of Protection",
      "Eyes of Charming", "Immovable Rod", "Ring of Jumping",
      "Rope of Climbing", "Sending Stones (pair)", "Wand of Magic Detection",
    ],
    Rare: [
      "Amulet of Health", "Belt of Hill Giant Strength", "Boots of Speed",
      "Brooch of Shielding", "Cloak of Displacement", "Crystal Ball (basic)",
      "Ring of Evasion", "Ring of Protection", "Robe of Eyes",
    ],
    "Very Rare": [
      "Amulet of the Planes", "Belt of Frost Giant Strength", "Cloak of Invisibility",
      "Efreeti Bottle", "Ring of Regeneration", "Ring of Shooting Stars",
      "Robe of Stars", "Staff of Fire",
    ],
    Legendary: [
      "Apparatus of Kwalish", "Belt of Storm Giant Strength", "Cubic Gate",
      "Ring of Three Wishes", "Ring of Djinni Summoning", "Talisman of Pure Good",
    ],
    Artifact: [
      "Eye of Vecna", "Hand of Vecna", "Orb of Dragonkind",
      "Sphere of Annihilation", "Talisman of Ultimate Evil",
    ],
  },
  Consumable: {
    Common: [
      "Potion of Healing (2d4+2 HP)", "Vial of Holy Water", "Antitoxin",
      "Potion of Climbing", "Alchemist's Fire",
    ],
    Uncommon: [
      "Potion of Greater Healing (4d4+4 HP)", "Potion of Animal Friendship",
      "Potion of Fire Breath", "Potion of Invisibility (1 min)",
      "Potion of Resistance", "Potion of Water Breathing", "Elixir of Health",
    ],
    Rare: [
      "Potion of Superior Healing (8d4+8 HP)", "Potion of Clairvoyance",
      "Potion of Diminution", "Potion of Gaseous Form", "Potion of Heroism",
      "Potion of Invulnerability", "Potion of Mind Reading",
    ],
    "Very Rare": [
      "Potion of Supreme Healing (10d4+20 HP)", "Potion of Speed",
      "Potion of Flying", "Potion of Storm Giant Strength",
      "Oil of Etherealness",
    ],
    Legendary: [
      "Potion of Longevity", "Potion of Vitality", "Oil of Sharpness",
      "Potion of Storm Giant Strength (permanent dose)", "Potion of Dragon's Majesty",
    ],
    Artifact: [
      "Ambrosia of the Gods", "Nectar of Immortality", "Philosopher's Elixir",
    ],
  },
  Currency: {
    Common: [
      "3d6 copper pieces", "2d6 silver pieces", "1d6 × 5 copper pieces",
      "A handful of mixed copper and silver (1d4 sp)", "A single gold piece",
    ],
    Uncommon: [
      "2d10 gold pieces", "1d6 × 10 silver pieces", "A small pouch of gold (2d6 gp)",
      "Electrum coins (1d6 × 5 ep)", "A trader's letter worth 20 gp",
    ],
    Rare: [
      "1d4 × 100 gold pieces", "A gemstone worth 50 gp", "A gemstone worth 100 gp",
      "Small chest of mixed coin (100d4 gp value)", "A sealed promissory note worth 200 gp",
    ],
    "Very Rare": [
      "A diamond worth 1,000 gp", "A ruby worth 500 gp", "1d4 × 100 pp",
      "A sack of gems (1,000–3,000 gp total)", "An ancient coin collection worth 2,000 gp",
    ],
    Legendary: [
      "A flawless sapphire worth 10,000 gp", "A legendary lost coin worth a fortune",
      "Treasury chest (100,000 gp in assorted valuables)",
    ],
    Artifact: [
      "The Dragon's Hoard (incalculable value)", "The Golden Fleece (priceless)",
    ],
  },
  Component: {
    Common: [
      "Bat guano", "Newt eyes (3)", "Bundle of dried herbs", "Vial of sulfur",
      "Small lodestone", "Powdered chalk", "Jar of sand", "Tallow candle",
    ],
    Uncommon: [
      "Powdered iron worth 5 gp", "Silver mirror worth 10 gp", "Owl feather",
      "Spider silk (harvested)", "Rare herb bundle worth 25 gp",
      "Piece of obsidian", "Mandrake root",
    ],
    Rare: [
      "Dragon scale (shed)", "Unicorn hair strand", "Phoenix ash",
      "Demon ichor (vial)", "Ruby dust worth 100 gp",
      "Powdered moonstone worth 150 gp",
    ],
    "Very Rare": [
      "Dragon tooth (adult)", "Beholder eye (preserved)", "Angel feather",
      "Powdered diamond worth 1,000 gp", "Lich phylactery shard",
    ],
    Legendary: [
      "Ancient dragon heart (petrified)", "True name of a fiend",
      "Strand from the Weave itself", "Powdered star metal worth 10,000 gp",
    ],
    Artifact: [
      "A shard of the original creation", "Tear of a god",
      "Fragment of pure elemental chaos",
    ],
  },
  Junk: {
    Common: [
      "Old boot (single)", "Broken axe handle", "Tattered cloak (heavily patched)",
      "Rat skeleton (mostly intact)", "Moldy wheel of cheese",
      "Cracked chamber pot", "Soggy scroll (unreadable)",
      "Bent copper fork", "Dead canary in a cracked cage",
      "Half-eaten ration (questionable)", "Bag of soot",
      "Three-legged stool", "Jar of pickled tentacles (unlabeled)",
      "Fake gemstone (glass)", "Snapped bowstring", "Dog collar (no dog)",
    ],
    Uncommon: [
      "A taxidermied rabbit posed to look angry",
      "A collection of pressed flowers — all the same, mundane type",
      "A journal full of detailed accounts of completely uneventful days",
      "Someone's old left boot (very high quality, size 14)",
      "A masterwork portrait of a stranger looking proud",
    ],
    Rare: [
      "A mysteriously heavy lead box with nothing inside",
      "A perfectly preserved fish — frozen in time, always cold to touch",
      "A painting that somehow always faces you",
    ],
    "Very Rare": [
      "A coin that always lands on its edge",
      "A spoon that tastes of whatever you last ate",
    ],
    Legendary: [
      "The world's most average pebble — indistinguishably ordinary",
      "A button that has no coat it belongs to",
    ],
    Artifact: [
      "A truly unremarkable stick",
    ],
  },
  Accessory: {
    Common: [
      "Simple leather belt", "Cotton scarf", "Rope bracelet", "Wooden comb",
      "Horn buttons (set of 5)", "Bone ring", "Leather gloves (worn)",
    ],
    Uncommon: [
      "Silk scarf (vibrant colors)", "Silver-buckled belt", "Jade pendant",
      "Gold-threaded bracers", "Ornate hair comb", "Pearl brooch",
    ],
    Rare: [
      "Enchanted amulet (shimmers faintly)", "Cloak of rich fabric",
      "Diamond tiara", "Mithral circlet", "Esteemed signet ring",
    ],
    "Very Rare": [
      "Cloak of the Protector", "Amulet of True Names",
      "Belt of ancient make", "Circlet of Wisdom",
    ],
    Legendary: [
      "Cloak of etherealness", "Amulet of omniscience",
      "Legendary signet ring", "Crown of the ages",
    ],
    Artifact: [
      "The One True Ring", "Eternal Crown",
    ],
  },
  Gear: {
    Common: [
      "Rope (50 ft)", "Backpack", "Lantern (oil)", "Bedroll",
      "Grappling hook", "Waterskin", "Tinderbox", "Torches (5)",
    ],
    Uncommon: [
      "Silk rope (50 ft)", "Explorer's pack (quality)", "Alchemist's supplies",
      "Climbing kit", "Thieves' tools", "Healer's kit",
    ],
    Rare: [
      "Enchanted rope (50 ft, magical)", "Portable hole", "Bag of holding",
      "Rope of entanglement", "Adventurer's ultimate pack",
    ],
    "Very Rare": [
      "Immovable rod", "Handy haversack", "Rope of the ages",
      "Portable sanctuary", "Enchanted explorer's kit",
    ],
    Legendary: [
      "The Legendary Pack", "Infinite rope",
      "Sanctuary of legend", "Bag of infinite holding",
    ],
    Artifact: [
      "The Original Gateway", "The Eternal Pack",
    ],
  },
  Treasure: {
    Common: [
      "Copper coins (handful)", "Silver coins (pouch)", "Jade stone", "Smooth river rock",
      "Copper bracelet", "Tin figurine", "Base metal jewelry",
    ],
    Uncommon: [
      "Powdered diamond worth 1,000 gp", "Emerald worth 500 gp", "Ruby worth 750 gp",
      "Sapphire (small)", "Carved gem", "Ornate box",
    ],
    Rare: [
      "Diamond worth 2,500 gp", "Emerald cluster worth 5,000 gp",
      "Jeweled crown worth 3,000 gp", "Ancient gemstone", "Treasure chest (full)",
    ],
    "Very Rare": [
      "Perfect diamond worth 10,000 gp", "Ruby cluster worth 15,000 gp",
      "Legendary gem worth 12,000 gp", "Queen's tiara (golden)",
    ],
    Legendary: [
      "Flawless diamond worth 50,000 gp", "Perfect emerald worth 75,000 gp",
      "Royal crown worth 100,000 gp", "Ancient treasure hoard",
    ],
    Artifact: [
      "The crown of kings (priceless)", "Infinite treasure",
    ],
  },
  Map: {
    Common: [
      "Hand-drawn map (local area)", "Torn map (partial)", "Faded parchment map",
      "Sketch map (villages)", "Local trade route map",
    ],
    Uncommon: [
      "Detailed kingdom map", "Clear regional map", "Trade route atlas",
      "Merchant's marked map", "Cartographer's map",
    ],
    Rare: [
      "Map with secret locations marked", "Ancient world map",
      "Magical map (shows more detail)", "Legendary route map",
    ],
    "Very Rare": [
      "Enchanted map (reveals secrets)", "Map of hidden places",
      "Ancient world treasure map", "Magical navigation scroll",
    ],
    Legendary: [
      "Legendary treasure map (authentic)", "Map of the gods",
      "Ancient route to lost civilizations", "Divine navigation chart",
    ],
    Artifact: [
      "The Original World Map", "Map of destiny",
    ],
  },
  Other: {
    Common: [
      "Random household item", "Common tool", "Basic supplies",
      "Simple craft material", "Ordinary wood carving",
    ],
    Uncommon: [
      "Unusual artifact", "Interesting curio", "Exotic material",
      "Peculiar craftwork", "Strange trinket",
    ],
    Rare: [
      "Mysterious device", "Rare material sample", "Unusual mechanism",
      "Curious artifact", "Perplexing object",
    ],
    "Very Rare": [
      "Bewildering artifact", "Impossible mechanism",
      "Reality-bending device", "Mysterious ancient object",
    ],
    Legendary: [
      "Legendary mechanism (unknown purpose)", "Artifact of power",
      "Reality-altering object", "Device of ages",
    ],
    Artifact: [
      "The Ultimate Unknown", "Reality itself (bottled)",
    ],
  },
};

export const ITEM_TYPES = [
  "Weapon", "Armor", "Helmet", "Shield", "Boots", "Gloves", "Cloak",
  "Ring", "Amulet / Necklace", "Belt / Girdle", "Bracers", "Wand",
  "Staff", "Orb / Focus", "Potion", "Scroll", "Book / Tome",
  "Tool", "Container / Bag", "Clothing", "Jewelry", "Trinket",
  "Component", "Currency", "Misc / Junk",
];

export const ITEM_ATTUNEMENT_REQUIREMENTS = [
  "None", "Any creature", "Spellcaster", "Cleric or Paladin",
  "Druid or Ranger", "Fighter or Barbarian", "Rogue or Monk",
  "Wizard or Sorcerer or Warlock", "Good-aligned creature",
  "Evil-aligned creature", "Creature of a specific race",
];

const ITEM_NAME_PREFIXES = [
  "Ancient", "Gilded", "Runebound", "Forgotten", "Moonlit", "Ashen",
  "Stormforged", "Wyrm-Touched", "Silent", "Bloodmarked", "Hollow", "Sun-Kissed",
];

const ITEM_NAME_SUFFIXES = [
  "of Embers", "of the Dawn", "of the Veil", "of Echoes", "of Oaths", "of Shifting Sands",
  "of Winter Breath", "of Iron Resolve", "of Whispering Stars", "of the Last King", "of Forgotten Paths", "of the Deep Vault",
];

function maybeEmbellishItemName(baseName: string): string {
  const withPrefix = Math.random() < 0.32 ? `${roll(ITEM_NAME_PREFIXES)} ${baseName}` : baseName;
  const withSuffix = Math.random() < 0.36 ? `${withPrefix} ${roll(ITEM_NAME_SUFFIXES)}` : withPrefix;
  return withSuffix;
}

// ─── Random NPC generator ────────────────────────────────────────────────────

export interface GeneratedNPC {
  name: string;
  gender: string;
  race: string;
  age: string;
  alignment: string;
  occupation: string;
  personalityTrait1: string;
  personalityTrait2: string;
  ideal: string;
  bond: string;
  flaw: string;
  appearance: string;
  secret: string;
  abilityScores: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
}

export function generateRandomNPC(): GeneratedNPC {
  const gender = roll(NPC_GENDERS);
  const randomName = generateRandomName({ gender });
  const traits = rollMany(NPC_PERSONALITY_TRAITS, 2);

  return {
    name: randomName.fullName,
    gender,
    race: roll(ALL_NPC_RACES),
    age: roll(NPC_AGES),
    alignment: roll(NPC_ALIGNMENTS),
    occupation: roll(NPC_OCCUPATIONS),
    personalityTrait1: traits[0],
    personalityTrait2: traits[1],
    ideal: roll(NPC_IDEALS),
    bond: roll(NPC_BONDS),
    flaw: roll(NPC_FLAWS),
    appearance: roll(NPC_APPEARANCE),
    secret: roll(NPC_SECRETS),
    abilityScores: {
      str: roll4d6DropLowest(),
      dex: roll4d6DropLowest(),
      con: roll4d6DropLowest(),
      int: roll4d6DropLowest(),
      wis: roll4d6DropLowest(),
      cha: roll4d6DropLowest(),
    },
  };
}

// ─── Random Item generator ────────────────────────────────────────────────────

export interface GeneratedItem {
  name: string;
  quality: ItemQuality;
  category: ItemCategory;
  value: number;
  description: string;
}

const CATEGORY_VALUE_MULTIPLIER: Record<string, number> = {
  weapon: 1.12,
  armor: 1.08,
  magic: 1.28,
  consumable: 0.72,
  currency: 1.0,
  component: 0.88,
  junk: 0.2,
  accessory: 1.02,
  gear: 0.9,
  treasure: 1.42,
  map: 0.78,
  other: 1.0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function inferredNameMultiplier(name: string): number {
  let multiplier = 1;
  const n = name.toLowerCase();

  if (/\+3\b/.test(n)) multiplier *= 1.6;
  else if (/\+2\b/.test(n)) multiplier *= 1.35;
  else if (/\+1\b/.test(n)) multiplier *= 1.15;

  if (/(vorpal|holy avenger|blackrazor|luck blade|ring of three wishes|eye of vecna|hand of vecna)/.test(n)) {
    multiplier *= 1.3;
  }

  if (/(potion|elixir|oil|single use|dose)/.test(n)) {
    multiplier *= 0.7;
  }

  if (/(bag of holding|portable hole|immovable rod|staff of power|staff of the magi)/.test(n)) {
    multiplier *= 1.2;
  }

  return multiplier;
}

export function generateRandomItem(
  quality?: ItemQuality,
  category?: ItemCategory,
): GeneratedItem {
  const q: ItemQuality = quality ?? roll(ITEM_QUALITIES);
  const rawCat: ItemCategory = category ?? roll(ITEM_CATEGORIES);
  
  // Convert lowercase category to title-case for RANDOM_ITEMS lookup
  const catKey = rawCat.charAt(0).toUpperCase() + rawCat.slice(1) as ItemCategory;
  const pool = RANDOM_ITEMS[catKey]?.[q];
  const baseName = pool && pool.length > 0 ? roll(pool) : `${q} ${catKey} Item`;
  const name = maybeEmbellishItemName(baseName);

  const tableEstimate = estimateItemPriceFromResources({
    name: baseName,
    tags: [q],
  });

  if (tableEstimate) {
    const triangularPct = (Math.random() + Math.random()) / 2;
    const estimated = tableEstimate.minGp + triangularPct * (tableEstimate.maxGp - tableEstimate.minGp);
    const [min, max] = QUALITY_VALUE_RANGES[q];
    const softMin = Math.max(1, Math.floor(min * 0.5));
    const softMax = Math.ceil(max * 1.25);
    const value = Math.round(clamp(estimated, softMin, softMax));
    return { name, quality: q, category: catKey, value, description: "" };
  }

  const [min, max] = QUALITY_VALUE_RANGES[q];
  // Triangular roll (average of two random rolls) clusters around typical prices.
  const triangularPct = (Math.random() + Math.random()) / 2;
  const baseline = min + triangularPct * (max - min);

  const catMultiplier = CATEGORY_VALUE_MULTIPLIER[catKey.toLowerCase()] ?? 1;
  const nameMultiplier = inferredNameMultiplier(baseName);
  const rawValue = baseline * catMultiplier * nameMultiplier;

  // Keep rarity as the anchor while allowing modest over/under based on item traits.
  const softMin = Math.max(1, Math.floor(min * 0.65));
  const softMax = Math.ceil(max * 1.35);
  const value = Math.round(clamp(rawValue, softMin, softMax));

  return { name, quality: q, category: catKey, value, description: "" };
}
