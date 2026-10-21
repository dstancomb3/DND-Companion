import type {
  AbilityScores,
  Character,
  CompendiumMonster,
  LootRecommendationContext,
  NpcPerson,
  ProposedInventoryItem,
  InventoryItem,
} from "@/types";
import { searchItemsByFilter } from "./lootGeneratorFilters";

function generateId(): string {
  return `tailor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function titleCase(value: string): string {
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function pickRandomUnique<T>(items: T[], limit: number): T[] {
  if (limit <= 0 || items.length === 0) return [];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(limit, copy.length));
}

function toProposedInventoryItem(item: InventoryItem | ProposedInventoryItem): ProposedInventoryItem {
  if ("confidence" in item && "needsReview" in item) {
    return item;
  }
  return {
    ...item,
    confidence: "medium",
    needsReview: true,
  };
}

function pickItems(
  availableItems: (InventoryItem | ProposedInventoryItem)[],
  criteria: Parameters<typeof searchItemsByFilter>[1],
  limit: number,
): ProposedInventoryItem[] {
  const primaryMatches = searchItemsByFilter(availableItems, criteria);
  if (primaryMatches.length > 0) {
    return pickRandomUnique(primaryMatches, limit).map(toProposedInventoryItem);
  }

  // Fallback strategy: if strict tag matching fails, retry by broad category/rarity/name only.
  const relaxedCriteria = {
    ...criteria,
    tags: undefined,
  };
  const relaxedMatches = searchItemsByFilter(availableItems, relaxedCriteria);
  if (relaxedMatches.length > 0) {
    return pickRandomUnique(relaxedMatches, limit).map(toProposedInventoryItem);
  }

  return [];
}

function inferredDamageType(context: LootRecommendationContext): string {
  if ((context.damageImmunities ?? []).some((entry) => /fire/i.test(entry))) return "radiant";
  if ((context.damageResistances ?? []).some((entry) => /necrotic|poison/i.test(entry))) return "force";
  if (context.primaryAbility === "dexterity") return "piercing";
  if (context.primaryAbility === "intelligence") return "force";
  if (context.primaryAbility === "wisdom") return "radiant";
  if (context.primaryAbility === "charisma") return "psychic";
  return "slashing";
}

function inferredAttackAbility(context: LootRecommendationContext): "strength" | "dexterity" {
  return context.primaryAbility === "dexterity" ? "dexterity" : "strength";
}

const PERSONALIZED_ADJECTIVES = [
  "Emberforged",
  "Nightglass",
  "Stormbound",
  "Moonlit",
  "Gilded",
  "Wyrm-sung",
  "Dawnforged",
  "Ashen",
  "Runescar",
  "Star-threaded",
  "Oathbound",
  "Void-touched",
];

const PERSONALIZED_TITLES = [
  "Oath",
  "Sigil",
  "Aegis",
  "Whisper",
  "Crown",
  "Echo",
  "Vow",
  "Brand",
  "Warden",
  "Pulse",
];

function buildPersonalizedName(
  context: LootRecommendationContext,
  category: "weapon" | "accessory" | "consumable",
  index: number,
): string {
  const seedName = titleCase(context.name?.trim() || "Companion");
  const classLabel = titleCase(context.characterClass || context.entityType || "Wanderer");
  const adjective = PERSONALIZED_ADJECTIVES[index % PERSONALIZED_ADJECTIVES.length];
  const title = PERSONALIZED_TITLES[(index + classLabel.length) % PERSONALIZED_TITLES.length];

  const nounsByCategory: Record<typeof category, string[]> = {
    weapon: ["Edge", "Fang", "Lance", "Glaive", "Blade", "Spear", "Longbow"],
    accessory: ["Ward", "Band", "Charm", "Amulet", "Brooch", "Talisman"],
    consumable: ["Tonic", "Elixir", "Draught", "Phial", "Tincture"],
  };

  const noun = nounsByCategory[category][(index + seedName.length) % nounsByCategory[category].length];
  const pattern = (index + seedName.length + classLabel.length) % 5;

  if (pattern === 0) return `${adjective} ${classLabel} ${noun}`;
  if (pattern === 1) return `${noun} of the ${title}`;
  if (pattern === 2) return `${seedName}'s ${title} ${noun}`;
  if (pattern === 3) return `${adjective} ${noun} of ${seedName}`;
  return `${classLabel} ${noun} of the ${title}`;
}

export function generatePersonalizedTailorItems(
  context: LootRecommendationContext,
  count = 2,
): ProposedInventoryItem[] {
  const classLabel = context.characterClass ? titleCase(context.characterClass) : titleCase(context.entityType);
  const nameSeed = context.name?.trim() || "Companion";
  const dmgType = inferredDamageType(context);
  const level = Math.max(1, context.level ?? 1);
  const bonus = level >= 10 ? 2 : 1;

  const offenseItem: ProposedInventoryItem = {
    id: generateId(),
    name: buildPersonalizedName(context, "weapon", 0),
    quantity: 1,
    category: "weapon",
    value: 180 + level * 35,
    notes: `Tailored for ${nameSeed}. Built around ${context.primaryAbility ?? "strength"} with ${dmgType} offense and ${classLabel.toLowerCase()} combat pacing.`,
    confidence: "medium",
    needsReview: true,
    sourceTag: "custom",
    damageDice: level >= 8 ? "1d8" : "1d6",
    damageModifier: bonus,
    damageType: dmgType,
    attackAbility: inferredAttackAbility(context),
    isProficient: true,
    weaponRange: context.primaryAbility === "dexterity" ? "30 ft / 60 ft" : "5 ft",
    tags: ["Tailored", classLabel, titleCase(context.primaryAbility ?? "strength")],
    equippedEffects: [
      {
        id: generateId(),
        type: "stat_bonus",
        label: "Tailored Combat Rhythm",
        description: `Grants +${bonus} to initiative or handling checks aligned to ${context.primaryAbility ?? "strength"}.`,
        statKey: context.primaryAbility === "dexterity" ? "initiative" : "strength",
        statValue: bonus,
      },
    ],
  };

  const defenseItem: ProposedInventoryItem = {
    id: generateId(),
    name: buildPersonalizedName(context, "accessory", 1),
    quantity: 1,
    category: "accessory",
    value: 140 + level * 30,
    notes: `Tailored for ${nameSeed}. Compensates for ${context.gearGaps?.join(", ") || "survivability gaps"} and reinforces field endurance.`,
    confidence: "medium",
    needsReview: true,
    sourceTag: "custom",
    tags: ["Tailored", "Defense", classLabel],
    equippedEffects: [
      {
        id: generateId(),
        type: "stat_bonus",
        label: "Adaptive Ward",
        description: `Improves durability for ${nameSeed} in prolonged encounters.`,
        statKey: "armorClass",
        statValue: (context.armorClass ?? 10) <= 13 ? 2 : 1,
      },
      {
        id: generateId(),
        type: "buff",
        label: "Steady Resolve",
        description: `A stabilizing aura tuned to ${classLabel.toLowerCase()} tempo.`,
      },
    ],
  };

  const sustainItem: ProposedInventoryItem = {
    id: generateId(),
    name: buildPersonalizedName(context, "consumable", 2),
    quantity: level >= 7 ? 2 : 1,
    category: "consumable",
    value: 75 + level * 12,
    notes: `Tailored sustain consumable for ${nameSeed}; intended to cover HP/resource pressure windows.`,
    confidence: "medium",
    needsReview: true,
    sourceTag: "custom",
    tags: ["Tailored", "Sustain", "Consumable"],
    equippedEffects: [
      {
        id: generateId(),
        type: "spell",
        label: "Recovery Pulse",
        description: "Single-use restorative surge with short tactical uptime.",
        uses: 1,
        resetOn: "dawn",
      },
    ],
  };

  return [offenseItem, defenseItem, sustainItem].slice(0, Math.max(1, count));
}

/**
 * Analyze a character, NPC, or beast and extract recommendation context.
 */
export function analyzeCombatantForLoot(
  entity: Character | NpcPerson | CompendiumMonster,
  _allItems: (InventoryItem | ProposedInventoryItem)[] = []
): LootRecommendationContext {
  // Determine entity type and extract common fields
  const isCharacter = "class" in entity && "abilityScores" in entity;
  const isNpc = "name" in entity && "role" in entity && !("abilityScores" in entity);
  const isMonster = "challenge_rating" in entity;

  const name = entity.name || "Unknown Entity";
  const level =
    ("level" in entity && typeof entity.level === "number" ? entity.level : undefined) ||
    ("challenge_rating" in entity && typeof entity.challenge_rating === "string"
      ? parseInt(entity.challenge_rating, 10)
      : undefined) ||
    1;

  // Extract ability scores
  const abilityScores: Partial<AbilityScores> = {};
  if ("abilityScores" in entity && entity.abilityScores) {
    Object.assign(abilityScores, entity.abilityScores);
  } else if (isMonster && "strength" in entity) {
    // Monster has individual ability fields
    abilityScores.strength = entity.strength;
    abilityScores.dexterity = entity.dexterity;
    abilityScores.constitution = entity.constitution;
    abilityScores.intelligence = entity.intelligence;
    abilityScores.wisdom = entity.wisdom;
    abilityScores.charisma = entity.charisma;
  }

  // Derive primary and secondary abilities
  const abilityArray = Object.entries(abilityScores)
    .filter(([, score]) => typeof score === "number" && score > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  const primaryAbility = (abilityArray[0]?.[0] as keyof AbilityScores) || "strength";
  const secondaryAbilities = abilityArray.slice(1, 3).map(([key]) => key as keyof AbilityScores);

  // Extract defensive stats
  const armorClass =
    ("armorClass" in entity && typeof entity.armorClass === "number" ? entity.armorClass : undefined) ||
    ("armor_class" in entity && typeof entity.armor_class === "number" ? entity.armor_class : undefined) ||
    10;

  const maxHp =
    ("maxHp" in entity && typeof entity.maxHp === "number" ? entity.maxHp : undefined) ||
    ("hit_points" in entity && typeof entity.hit_points === "number" ? entity.hit_points : undefined) ||
    10;

  const currentHp = "currentHp" in entity && typeof entity.currentHp === "number" ? entity.currentHp : maxHp;

  // Extract damage resistances/immunities
  const damageResistances =
    ("damageResistances" in entity && Array.isArray(entity.damageResistances) ? entity.damageResistances : []) ||
    ("damage_resistances" in entity && typeof entity.damage_resistances === "string"
      ? entity.damage_resistances.split(",").map((s) => s.trim())
      : []);

  const damageImmunities =
    ("damageImmunities" in entity && Array.isArray(entity.damageImmunities) ? entity.damageImmunities : []) ||
    ("damage_immunities" in entity && typeof entity.damage_immunities === "string"
      ? entity.damage_immunities.split(",").map((s) => s.trim())
      : []);

  // Extract traits/actions as special abilities
  const specialAbilities: string[] = [];
  if ("actions" in entity && Array.isArray(entity.actions)) {
    specialAbilities.push(
      ...entity.actions.map((a: { name?: string; desc?: string }) => a.name || "Unknown Action").slice(0, 5)
    );
  }
  if ("legendary_actions" in entity && Array.isArray(entity.legendary_actions)) {
    specialAbilities.push(
      ...entity.legendary_actions.map((a: { name?: string }) => `Legendary: ${a.name || "Action"}`).slice(0, 3)
    );
  }

  // Extract personality hints from description
  const personalityHints: string[] = [];
  if ("description" in entity && typeof entity.description === "string") {
    // Simple extraction: look for personality/motivation clues
    if (/(brave|bold|courageous)/i.test(entity.description)) personalityHints.push("Courageous");
    if (/(cunning|clever|strategic)/i.test(entity.description)) personalityHints.push("Strategic");
    if (/(noble|honorable|righteous)/i.test(entity.description)) personalityHints.push("Honorable");
    if (/(evil|dark|cruel)/i.test(entity.description)) personalityHints.push("Malicious");
    if (/(nature|wild|primal)/i.test(entity.description)) personalityHints.push("Primal");
  }

  // Infer gear gaps based on AC, class, and abilities
  const gearGaps: string[] = [];
  if (armorClass <= 12) gearGaps.push("AC improvement");
  if (primaryAbility === "dexterity" && !(damageResistances.includes("piercing") || damageImmunities.includes("piercing"))) {
    gearGaps.push("Evasion or dodge enhancement");
  }
  if (level && level >= 5 && !specialAbilities.some((a) => a.toLowerCase().includes("damage"))) {
    gearGaps.push("Damage boost");
  }
  if (maxHp && maxHp <= 20 * level) gearGaps.push("HP boost");

  return {
    name,
    entityType: isCharacter ? "character" : isNpc ? "npc" : "beast",
    level,
    characterClass: "class" in entity && typeof entity.class === "string" ? entity.class : undefined,
    race: "race" in entity && typeof entity.race === "string" ? entity.race : undefined,
    primaryAbility,
    secondaryAbilities,
    armorClass,
    currentHp,
    maxHp,
    challengeRating: "challenge_rating" in entity ? entity.challenge_rating : undefined,
    damageResistances,
    damageImmunities,
    skills: [],
    spells: [],
    specialAbilities,
    personalityHints,
    gearGaps,
  };
}

/**
 * Generate loot suggestions tailored to an entity's profile.
 */
export function generateTailorSuggestions(
  context: LootRecommendationContext,
  availableItems: (InventoryItem | ProposedInventoryItem)[] = []
): ProposedInventoryItem[] {
  if (availableItems.length === 0) return [];

  const suggestions: ProposedInventoryItem[] = [];
  const personalityHints = context.personalityHints ?? [];
  const className = (context.characterClass ?? "").toLowerCase();

  // Tier 1: Primary ability and archetype alignment
  if (context.primaryAbility === "dexterity") {
    suggestions.push(...pickItems(availableItems, { category: ["weapon", "accessory"], tags: ["Dexterity", "Agility", "Speed", "Finesse"] }, 2));
  } else if (context.primaryAbility === "strength") {
    suggestions.push(...pickItems(availableItems, { category: ["weapon", "armor"], tags: ["Strength", "Power", "Might", "Heavy"] }, 2));
  } else if (context.primaryAbility === "wisdom") {
    suggestions.push(...pickItems(availableItems, { category: ["accessory", "magic"], tags: ["Wisdom", "Insight", "Perception"] }, 2));
  } else if (context.primaryAbility === "intelligence") {
    suggestions.push(...pickItems(availableItems, { category: ["magic", "gear"], tags: ["Intelligence", "Knowledge", "Arcane"] }, 2));
  } else if (context.primaryAbility === "charisma") {
    suggestions.push(...pickItems(availableItems, { category: ["accessory", "magic"], tags: ["Charisma", "Charm"] }, 2));
  }

  if (className.includes("rogue") || className.includes("ranger") || className.includes("monk")) {
    suggestions.push(...pickItems(availableItems, { category: ["weapon"], tags: ["Finesse", "Light", "Dexterity"] }, 1));
  } else if (className.includes("barbarian") || className.includes("fighter") || className.includes("paladin")) {
    suggestions.push(...pickItems(availableItems, { category: ["weapon", "armor"], tags: ["Strength", "Heavy", "Martial"] }, 1));
  } else if (className.includes("wizard") || className.includes("sorcerer") || className.includes("warlock")) {
    suggestions.push(...pickItems(availableItems, { category: ["magic", "accessory"], tags: ["Arcane", "Focus", "Spell"] }, 1));
  } else if (className.includes("cleric") || className.includes("druid") || className.includes("bard")) {
    suggestions.push(...pickItems(availableItems, { category: ["magic", "consumable", "accessory"], tags: ["Holy", "Nature", "Charm", "Support"] }, 1));
  }

  // Tier 2: AC/Defense items if AC is low.
  if ((context.armorClass || 10) <= 12) {
    suggestions.push(...pickItems(availableItems, { category: ["armor", "accessory"], tags: ["AC", "Defense", "Ward", "Shield"] }, 2));
  }

  // Tier 3: Sustain and utility are always useful.
  suggestions.push(...pickItems(availableItems, { category: ["consumable"], tags: ["Healing", "Potion", "Tonic", "Elixir"] }, 2));
  suggestions.push(...pickItems(availableItems, { category: ["gear", "magic"] }, 1));

  // Tier 4: Offensive items (weapons, damage boost)
  if (context.primaryAbility === "dexterity") {
    suggestions.push(...pickItems(availableItems, { category: ["weapon"], tags: ["Finesse", "Ranged"] }, 1));
  } else if (context.primaryAbility === "strength") {
    suggestions.push(...pickItems(availableItems, { category: ["weapon"], tags: ["Heavy", "Power", "Great"] }, 1));
  }

  // Tier 5: Rarity-appropriate loot with a slight upward spread.
  const rarityByLevel = context.level && context.level >= 12
    ? ["Rare", "Very Rare"]
    : context.level && context.level >= 7
      ? ["Uncommon", "Rare"]
      : ["Common", "Uncommon"];
  suggestions.push(...pickItems(availableItems, { rarity: rarityByLevel }, 3));

  // Tier 6: Thematic items based on personality.
  if (personalityHints.includes("Honorable") || personalityHints.includes("Courageous")) {
    suggestions.push(...pickItems(availableItems, { tags: ["Holy", "Sacred", "Blessed", "Valor"] }, 1));
  }
  if (personalityHints.includes("Malicious") || personalityHints.includes("Strategic")) {
    suggestions.push(...pickItems(availableItems, { tags: ["Cursed", "Dark", "Shadow", "Tactical"] }, 1));
  }

  // Tier 7: Gear-gap hints.
  if ((context.gearGaps ?? []).some((gap) => /ac|defense/i.test(gap))) {
    suggestions.push(...pickItems(availableItems, { category: ["armor", "accessory"], tags: ["Ward", "Defense", "Shield"] }, 1));
  }
  if ((context.gearGaps ?? []).some((gap) => /damage/i.test(gap))) {
    suggestions.push(...pickItems(availableItems, { category: ["weapon", "magic"], tags: ["Damage", "Strike", "Power"] }, 1));
  }
  if ((context.gearGaps ?? []).some((gap) => /hp/i.test(gap))) {
    suggestions.push(...pickItems(availableItems, { category: ["consumable", "accessory"], tags: ["Healing", "Vitality", "Fortitude"] }, 1));
  }

  // Final fallback: guarantee enough options with broad random picks.
  if (suggestions.length < 6) {
    const broadFallback = pickItems(availableItems, { category: ["weapon", "armor", "accessory", "consumable", "magic", "gear"] }, 6 - suggestions.length);
    suggestions.push(...broadFallback);
  }
  if (suggestions.length < 4) {
    suggestions.push(...pickRandomUnique(availableItems, 4 - suggestions.length).map(toProposedInventoryItem));
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return suggestions.filter((item) => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Parse JSON entity input and validate against known entity shapes.
 */
export function parseEntityFromJson(json: unknown): Character | NpcPerson | CompendiumMonster | null {
  if (!json || typeof json !== "object") return null;

  const obj = json as Record<string, unknown>;

  // Try to match Character shape
  if ("name" in obj && "class" in obj && "abilityScores" in obj) {
    return obj as unknown as Character;
  }

  // Try to match NpcPerson shape
  if ("name" in obj && "role" in obj && !("abilityScores" in obj)) {
    return obj as unknown as NpcPerson;
  }

  // Try to match CompendiumMonster shape
  if ("name" in obj && "challenge_rating" in obj && "armor_class" in obj) {
    return obj as unknown as CompendiumMonster;
  }

  // Fallback: if it has a name and some ability-like fields, treat as generic
  if ("name" in obj && (("strength" in obj && typeof obj.strength === "number") || "hit_points" in obj)) {
    return obj as unknown as CompendiumMonster;
  }

  return null;
}
