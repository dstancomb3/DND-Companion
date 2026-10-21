/**
 * Race lifespan and age categorization utility
 * Provides age ranges, lifespan hints, and age category classification for D&D races
 */

export interface RaceLifespan {
  adulthood: number; // age when considered adult
  maxAge: number; // natural lifespan max
}

export type AgeCategory =
  | "Child"
  | "Teen"
  | "Young Adult"
  | "Adult"
  | "Middle Age"
  | "Elder"
  | "Ancient"
  | "Venerable"
  | "Extended"
  | "Deific";

/** Canonical D&D 5e race lifespan data */
const RACE_LIFESPANS: Record<string, RaceLifespan> = {
  // PHB Core
  Human: { adulthood: 18, maxAge: 80 },
  Dragonborn: { adulthood: 18, maxAge: 80 },
  Dwarf: { adulthood: 50, maxAge: 350 },
  "Hill Dwarf": { adulthood: 50, maxAge: 350 },
  "Mountain Dwarf": { adulthood: 50, maxAge: 350 },
  Duergar: { adulthood: 50, maxAge: 350 },
  Elf: { adulthood: 100, maxAge: 750 },
  "High Elf": { adulthood: 100, maxAge: 750 },
  "Wood Elf": { adulthood: 100, maxAge: 750 },
  Drow: { adulthood: 100, maxAge: 750 },
  Eladrin: { adulthood: 100, maxAge: 750 },
  "Sea Elf": { adulthood: 100, maxAge: 750 },
  "Shadar-Kai": { adulthood: 100, maxAge: 750 },
  Gnome: { adulthood: 40, maxAge: 500 },
  "Forest Gnome": { adulthood: 40, maxAge: 500 },
  "Rock Gnome": { adulthood: 40, maxAge: 500 },
  "Deep Gnome": { adulthood: 40, maxAge: 500 },
  "Half-Elf": { adulthood: 20, maxAge: 180 },
  "Half-Orc": { adulthood: 14, maxAge: 75 },
  Halfling: { adulthood: 20, maxAge: 150 },
  "Lightfoot Halfling": { adulthood: 20, maxAge: 150 },
  "Stout Halfling": { adulthood: 20, maxAge: 150 },
  "Ghostwise Halfling": { adulthood: 20, maxAge: 150 },
  Tiefling: { adulthood: 20, maxAge: 150 },
  "Asmodeus Tiefling": { adulthood: 20, maxAge: 150 },
  "Baalzebul Tiefling": { adulthood: 20, maxAge: 150 },
  "Dispater Tiefling": { adulthood: 20, maxAge: 150 },
  "Fierna Tiefling": { adulthood: 20, maxAge: 150 },
  "Glasya Tiefling": { adulthood: 20, maxAge: 150 },
  "Levistus Tiefling": { adulthood: 20, maxAge: 150 },
  "Mammon Tiefling": { adulthood: 20, maxAge: 150 },
  "Mephistopheles Tiefling": { adulthood: 20, maxAge: 150 },
  "Zariel Tiefling": { adulthood: 20, maxAge: 150 },

  // Monsters / Supplement
  Aasimar: { adulthood: 20, maxAge: 180 },
  "Protector Aasimar": { adulthood: 20, maxAge: 180 },
  "Scourge Aasimar": { adulthood: 20, maxAge: 180 },
  "Fallen Aasimar": { adulthood: 20, maxAge: 180 },
  Bugbear: { adulthood: 16, maxAge: 80 },
  Centaur: { adulthood: 30, maxAge: 220 },
  Changeling: { adulthood: 18, maxAge: 120 },
  Fairy: { adulthood: 100, maxAge: 600 },
  Firbolg: { adulthood: 100, maxAge: 500 },
  Genasi: { adulthood: 20, maxAge: 180 },
  "Air Genasi": { adulthood: 20, maxAge: 180 },
  "Earth Genasi": { adulthood: 20, maxAge: 180 },
  "Fire Genasi": { adulthood: 20, maxAge: 180 },
  "Water Genasi": { adulthood: 20, maxAge: 180 },
  Githyanki: { adulthood: 30, maxAge: 200 },
  Githzerai: { adulthood: 30, maxAge: 200 },
  Goblin: { adulthood: 12, maxAge: 60 },
  Goliath: { adulthood: 16, maxAge: 100 },
  Harengon: { adulthood: 20, maxAge: 120 },
  Hobgoblin: { adulthood: 14, maxAge: 80 },
  Kalashtar: { adulthood: 18, maxAge: 120 },
  Kenku: { adulthood: 12, maxAge: 60 },
  Kobold: { adulthood: 12, maxAge: 50 },
  Leonin: { adulthood: 16, maxAge: 75 },
  Lizardfolk: { adulthood: 14, maxAge: 80 },
  Loxodon: { adulthood: 60, maxAge: 500 },
  Minotaur: { adulthood: 16, maxAge: 100 },
  Orc: { adulthood: 14, maxAge: 80 },
  Owlin: { adulthood: 18, maxAge: 120 },
  Plasmoid: { adulthood: 20, maxAge: 150 },
  Satyr: { adulthood: 100, maxAge: 800 },
  Shifter: { adulthood: 18, maxAge: 120 },
  "Beasthide Shifter": { adulthood: 18, maxAge: 120 },
  "Longtooth Shifter": { adulthood: 18, maxAge: 120 },
  "Swiftstride Shifter": { adulthood: 18, maxAge: 120 },
  "Wildhunt Shifter": { adulthood: 18, maxAge: 120 },
  "Simic Hybrid": { adulthood: 18, maxAge: 150 },
  Tabaxi: { adulthood: 18, maxAge: 100 },
  "Thri-kreen": { adulthood: 16, maxAge: 70 },
  Tortle: { adulthood: 25, maxAge: 150 },
  Triton: { adulthood: 20, maxAge: 180 },
  Vedalken: { adulthood: 40, maxAge: 500 },
  Warforged: { adulthood: 2, maxAge: 35 },
  "Yuan-Ti Pureblood": { adulthood: 20, maxAge: 150 },
};

const DEFAULT_LIFESPAN: RaceLifespan = { adulthood: 18, maxAge: 80 };

/**
 * Get lifespan data for a race (with fallback to defaults)
 */
export function getRaceLifespan(race: string): RaceLifespan {
  if (!race) return DEFAULT_LIFESPAN;
  const lifespan = RACE_LIFESPANS[race];
  return lifespan || DEFAULT_LIFESPAN;
}

/**
 * Compute age category based on age and race lifespan
 * User-provided formula with race-scaled tiers:
 * - Child: 0 to 10% of adulthood
 * - Teen: 10% to 60% of adulthood
 * - Young Adult: 60% to 100% of adulthood (i.e., to adulthood)
 * - Adult: adulthood to 200% of adulthood
 * - Middle Age: 200% of adulthood to 50% of maxAge
 * - Elder: 50% of maxAge to 75% of maxAge
 * - Ancient: 75% of maxAge to 100% of maxAge
 * - Venerable: 100% of maxAge to 150% of maxAge (extended)
 * - Extended: 150% of maxAge to 200% of maxAge
 * - Deific: 200%+ of maxAge
 */
export function computeAgeCategory(age: number, race: string): AgeCategory {
  const lifespan = getRaceLifespan(race);
  const { adulthood, maxAge } = lifespan;

  if (age < 0) return "Child";

  const childUpperBound = adulthood * 0.1; // 10% of adulthood
  const teenUpperBound = adulthood * 0.6;  // 60% of adulthood
  const youngAdultUpperBound = adulthood;  // 100% of adulthood
  const adultUpperBound = adulthood * 2;   // 200% of adulthood
  const middleAgeUpperBound = maxAge * 0.5; // 50% of maxAge
  const elderUpperBound = maxAge * 0.75;   // 75% of maxAge
  const ancientUpperBound = maxAge;        // 100% of maxAge
  const venerableUpperBound = maxAge * 1.5; // 150% of maxAge
  const extendedUpperBound = maxAge * 2;   // 200% of maxAge

  if (age < childUpperBound) return "Child";
  if (age < teenUpperBound) return "Teen";
  if (age < youngAdultUpperBound) return "Young Adult";
  if (age < adultUpperBound) return "Adult";
  if (age < middleAgeUpperBound) return "Middle Age";
  if (age < elderUpperBound) return "Elder";
  if (age < ancientUpperBound) return "Ancient";
  if (age < venerableUpperBound) return "Venerable";
  if (age < extendedUpperBound) return "Extended";
  return "Deific";
}

/**
 * Get a human-readable lifespan hint for display
 */
export function getLifespanHint(race: string): string {
  const lifespan = getRaceLifespan(race);
  return `Avg Lifespan: 0-${lifespan.maxAge}`;
}
