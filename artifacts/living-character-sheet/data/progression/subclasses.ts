import type { ProgressionSheet, LevelFeatureEntry } from "./types";
import { ALL_CLASSES } from "@/data/dnd5e";

const SUBCLASS_MILESTONES: Record<string, number[]> = {
  artificer: [3, 5, 9, 15],
  barbarian: [3, 6, 10, 14],
  bard: [3, 6, 14],
  "blood hunter": [3, 7, 11, 15, 18],
  cleric: [1, 2, 6, 8, 17],
  druid: [2, 6, 10, 14],
  fighter: [3, 7, 10, 15, 18],
  monk: [3, 6, 11, 17],
  paladin: [3, 7, 15, 20],
  ranger: [3, 7, 11, 15],
  rogue: [3, 9, 13, 17],
  sorcerer: [1, 6, 14, 18],
  warlock: [1, 6, 10, 14],
  wizard: [2, 6, 10, 14],
};

const EXPLICIT_SUBCLASS_KEYS = new Set([
  "fighter:champion",
  "monk:way of the open hand",
]);

const CLASS_TONE: Record<string, string> = {
  artificer: "inventive magic item play, specialist tools, and prepared spell support",
  barbarian: "rage-driven frontline pressure, resilience, and primal momentum",
  bard: "inspiration, support casting, social leverage, and expressive utility",
  "blood hunter": "hemocraft pressure, self-sacrifice, tracking, and anti-monster tools",
  cleric: "divine identity, domain magic, party support, and channel-based utility",
  druid: "nature magic, wild shape, terrain control, and adaptable utility",
  fighter: "martial mastery, action economy, battlefield control, and sustained offense",
  monk: "mobility, ki discipline, precision strikes, and action flexibility",
  paladin: "auras, smites, defense, and oath-driven battlefield presence",
  ranger: "tracking, ranged or skirmish combat, exploration, and targeted pressure",
  rogue: "precision damage, mobility, scouting, and tactical positioning",
  sorcerer: "innate spell power, metamagic, and explosive casting identity",
  warlock: "pact-driven spellcasting, invocations, and patron-specific pressure",
  wizard: "arcane specialization, ritual flexibility, and spellbook-driven control",
};

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function toKey(className: string, subclassName: string): string {
  return `${normalise(className)}:${normalise(subclassName)}`;
}

function getFeatureTierLabel(index: number, total: number): string {
  if (index === 0) return "Foundation";
  if (index === total - 1) return "Capstone";
  if (index === total - 2) return "Mastery";
  if (index === 1) return "Discipline";
  return `Feature ${index + 1}`;
}

function buildFeatureName(subclassName: string, index: number, total: number): string {
  const label = getFeatureTierLabel(index, total);
  return `${subclassName}: ${label}`;
}

function buildFeatureDescription(className: string, subclassName: string, level: number, index: number, total: number): string {
  const tone = CLASS_TONE[normalise(className)] ?? "class identity, subclass mechanics, and derived play patterns";
  const label = getFeatureTierLabel(index, total).toLowerCase();
  return `At level ${level}, ${subclassName} grants its ${label} feature package, expanding ${tone}. Apply the subclass-specific rules for actions, passive benefits, spell access, resources, and replacement choices tied to this milestone.`;
}

function buildSummary(className: string, subclassName: string, level: number, index: number, total: number): string {
  const tone = CLASS_TONE[normalise(className)] ?? "its subclass identity";
  const label = getFeatureTierLabel(index, total).toLowerCase();
  return `${subclassName} unlocks its ${label} milestone at level ${level}, deepening ${tone}.`;
}

function buildFeature(className: string, subclassName: string, level: number, index: number, total: number): LevelFeatureEntry {
  return {
    kind: "passive",
    name: buildFeatureName(subclassName, index, total),
    description: buildFeatureDescription(className, subclassName, level, index, total),
  };
}

function createSubclassSheet(className: string, subclassName: string): ProgressionSheet | null {
  const classKey = normalise(className);
  if (classKey === "artificer" || classKey === "barbarian" || classKey === "bard" || classKey === "blood hunter" || classKey === "cleric" || classKey === "druid" || classKey === "fighter" || classKey === "monk" || classKey === "rogue" || classKey === "paladin" || classKey === "ranger" || classKey === "sorcerer" || classKey === "warlock" || classKey === "wizard") return null;

  const levels = SUBCLASS_MILESTONES[classKey];
  if (!levels || levels.length === 0) return null;

  const key = toKey(className, subclassName);
  if (EXPLICIT_SUBCLASS_KEYS.has(key)) return null;

  return {
    key,
    source: "subclass",
    appliesTo: { class: classKey, subclass: normalise(subclassName) },
    levels: levels.map((level, index, allLevels) => ({
      level,
      proficiencyBonus: 2 + Math.floor((level - 1) / 4),
      hitDie: 0,
      summary: buildSummary(className, subclassName, level, index, allLevels.length),
      features: [buildFeature(className, subclassName, level, index, allLevels.length)],
    })),
  };
}

export const GENERATED_SUBCLASS_SHEETS: ProgressionSheet[] = ALL_CLASSES.flatMap((entry) =>
  entry.subclasses
    .map((subclassName) => createSubclassSheet(entry.name, subclassName))
    .filter((sheet): sheet is ProgressionSheet => sheet !== null)
);