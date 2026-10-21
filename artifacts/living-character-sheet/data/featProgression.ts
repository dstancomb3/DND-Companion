import type { Open5eFeat } from "@/types";

export type FeatSpellFilter = "any" | "attack-roll" | "ritual";

export interface FeatSpellProgression {
  featName: string;
  spellsKnownGained: number;
  cantripsKnownGained: number;
  maxSpellLevel: number;
  classOptions: string[];
  spellFilter: FeatSpellFilter;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
};

const SPELLCASTER_CLASSES = [
  "Artificer",
  "Bard",
  "Cleric",
  "Druid",
  "Paladin",
  "Ranger",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

const MAGIC_INITIATE_CLASSES = [
  "Bard",
  "Cleric",
  "Druid",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

const RITUAL_CASTER_CLASSES = [
  "Bard",
  "Cleric",
  "Druid",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function dedupe(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function parseCount(token?: string): number {
  if (!token) return 0;
  const lower = normalize(token);
  if (NUMBER_WORDS[lower] != null) return NUMBER_WORDS[lower];
  const numeric = Number(lower);
  return Number.isFinite(numeric) ? numeric : 0;
}

function extractClassOptions(text: string): string[] {
  const lower = normalize(text);
  return SPELLCASTER_CLASSES.filter((className) => {
    const classLower = className.toLowerCase();
    return lower.includes(classLower);
  });
}

function parseMaxSpellLevel(text: string): number {
  const matches = [...text.matchAll(/(\d)(?:st|nd|rd|th)-level spell/gi)];
  if (matches.length === 0) return 1;
  return Math.max(...matches.map((match) => Number(match[1]) || 1));
}

function parseSpellCount(text: string): number {
  const explicit = text.match(/\b(one|two|three|four|a|an|1|2|3|4)\b\s+(?:\d(?:st|nd|rd|th)-level\s+)?spells?\b/i);
  if (explicit) return parseCount(explicit[1]);
  const singular = text.match(/learn\s+(?:one|a|an)\s+(?:\d(?:st|nd|rd|th)-level\s+)?spell\b/i);
  if (singular) return 1;
  return 0;
}

function parseCantripCount(text: string): number {
  const explicit = text.match(/\b(one|two|three|four|a|an|1|2|3|4)\b\s+cantrips?\b/i);
  if (explicit) return parseCount(explicit[1]);
  const singular = text.match(/learn\s+(?:one|a|an)\s+cantrip\b/i);
  if (singular) return 1;
  return 0;
}

export function inferFeatSpellProgression(
  feat: Pick<Open5eFeat, "name" | "desc"> | { name: string; desc?: string }
): FeatSpellProgression | null {
  const featName = feat.name.trim();
  const desc = feat.desc?.trim() ?? "";
  const normalizedName = normalize(featName);
  const combinedText = `${featName} ${desc}`;
  const parsedClassOptions = dedupe(extractClassOptions(combinedText));

  const suffixClassMatch = featName.match(/\(([^)]+)\)/);
  const suffixClass = suffixClassMatch?.[1]?.trim();
  const suffixOptions = suffixClass ? dedupe(extractClassOptions(suffixClass)) : [];

  if (normalizedName.startsWith("magic initiate")) {
    return {
      featName,
      spellsKnownGained: 1,
      cantripsKnownGained: 2,
      maxSpellLevel: 1,
      classOptions: suffixOptions.length > 0 ? suffixOptions : (parsedClassOptions.length > 0 ? parsedClassOptions : MAGIC_INITIATE_CLASSES),
      spellFilter: "any",
    };
  }

  if (normalizedName === "ritual caster") {
    return {
      featName,
      spellsKnownGained: 2,
      cantripsKnownGained: 0,
      maxSpellLevel: 1,
      classOptions: parsedClassOptions.length > 0 ? parsedClassOptions : RITUAL_CASTER_CLASSES,
      spellFilter: "ritual",
    };
  }

  if (normalizedName === "spell sniper") {
    return {
      featName,
      spellsKnownGained: 0,
      cantripsKnownGained: 1,
      maxSpellLevel: 0,
      classOptions: parsedClassOptions.length > 0 ? parsedClassOptions : MAGIC_INITIATE_CLASSES,
      spellFilter: "attack-roll",
    };
  }

  if (normalizedName.includes("rite master")) {
    const cantripsKnownGained = parseCantripCount(desc);
    const spellsKnownGained = parseSpellCount(desc) || 1;
    return {
      featName,
      spellsKnownGained,
      cantripsKnownGained,
      maxSpellLevel: Math.max(1, parseMaxSpellLevel(desc)),
      classOptions: parsedClassOptions,
      spellFilter: /ritual/i.test(desc) ? "ritual" : "any",
    };
  }

  const cantripsKnownGained = parseCantripCount(desc);
  const spellsKnownGained = parseSpellCount(desc);
  if (cantripsKnownGained === 0 && spellsKnownGained === 0) return null;
  if (parsedClassOptions.length === 0) return null;

  return {
    featName,
    spellsKnownGained,
    cantripsKnownGained,
    maxSpellLevel: Math.max(spellsKnownGained > 0 ? 1 : 0, parseMaxSpellLevel(desc)),
    classOptions: parsedClassOptions,
    spellFilter: /attack roll/i.test(desc)
      ? "attack-roll"
      : /ritual/i.test(desc)
        ? "ritual"
        : "any",
  };
}