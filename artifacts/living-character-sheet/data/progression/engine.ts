import type {
  LevelFeatureEntry,
  AutomaticGain,
  ChoiceRequired,
  OptionalReplacement,
  DerivedUpdate,
  LevelUpAuditResult,
  ProgressionSheet,
  LevelRow,
  DeterministicCoverageLevel,
  ResourceGain,
  ScalingResource,
  SpellcastingProgression,
} from "./types";
import { MONK_PROGRESSION, OPEN_HAND_PROGRESSION } from "./monk";
import { FIGHTER_PROGRESSION } from "./fighter";
import { CHAMPION_PROGRESSION } from "./champion";
import { CLERIC_PROGRESSION } from "./cleric";
import { ARTIFICER_SUBCLASS_SHEETS } from "./artificerSubclasses";
import { BARBARIAN_SUBCLASS_SHEETS } from "./barbarianSubclasses";
import { BARD_SUBCLASS_SHEETS } from "./bardSubclasses";
import { BLOOD_HUNTER_SUBCLASS_SHEETS } from "./bloodHunterSubclasses";
import { CLERIC_SUBCLASS_SHEETS } from "./clericSubclasses";
import { DRUID_SUBCLASS_SHEETS } from "./druidSubclasses";
import { FIGHTER_SUBCLASS_SHEETS } from "./fighterSubclasses";
import { MONK_SUBCLASS_SHEETS } from "./monkSubclasses";
import { PALADIN_SUBCLASS_SHEETS } from "./paladinSubclasses";
import { RANGER_SUBCLASS_SHEETS } from "./rangerSubclasses";
import { ROGUE_SUBCLASS_SHEETS } from "./rogueSubclasses";
import { SORCERER_SUBCLASS_SHEETS } from "./sorcererSubclasses";
import { WARLOCK_SUBCLASS_SHEETS } from "./warlockSubclasses";
import { WIZARD_SUBCLASS_SHEETS } from "./wizardSubclasses";
import { GENERATED_SUBCLASS_SHEETS } from "./subclasses";
import { getRaceProgression } from "./races";
import { getClassProgression as getGenericClassProgression } from "@/data/classProgressions";
import { ALL_CLASSES } from "@/data/dnd5e";
import { getDefaultSpellSlots } from "@/data/spellSlots";

// ── Supported class progression sheets ────────────────────────────────────────

const CLASS_SHEETS: Record<string, ProgressionSheet> = {
  monk: MONK_PROGRESSION,
  fighter: FIGHTER_PROGRESSION,
  cleric: CLERIC_PROGRESSION,
};

/** Normalise a class/subclass name to a stable key */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function matchesClass(sheet: ProgressionSheet, cls: string): boolean {
  return !!sheet.appliesTo?.class && normalise(cls).includes(sheet.appliesTo.class);
}

function matchesSubclass(sheet: ProgressionSheet, sub: string): boolean {
  return !!sheet.appliesTo?.subclass && normalise(sub).includes(sheet.appliesTo.subclass);
}

function getSubclassCoverageLevel(charClass: string, subclass: string): DeterministicCoverageLevel {
  if (!subclass.trim()) return "baseline";
  return SUBCLASS_SHEETS.some((s) => matchesClass(s, charClass) && matchesSubclass(s, subclass))
    ? "detailed"
    : "baseline";
}

export function getDeterministicSubclassCoverage(charClass: string, subclass: string): DeterministicCoverageLevel {
  return getSubclassCoverageLevel(charClass, subclass);
}

/** All subclass sheets indexed by their key */
const SUBCLASS_SHEETS: ProgressionSheet[] = [
  OPEN_HAND_PROGRESSION,
  CHAMPION_PROGRESSION,
  ...ARTIFICER_SUBCLASS_SHEETS,
  ...BARBARIAN_SUBCLASS_SHEETS,
  ...BARD_SUBCLASS_SHEETS,
  ...BLOOD_HUNTER_SUBCLASS_SHEETS,
  ...CLERIC_SUBCLASS_SHEETS,
  ...DRUID_SUBCLASS_SHEETS,
  ...FIGHTER_SUBCLASS_SHEETS,
  ...MONK_SUBCLASS_SHEETS,
  ...PALADIN_SUBCLASS_SHEETS,
  ...RANGER_SUBCLASS_SHEETS,
  ...ROGUE_SUBCLASS_SHEETS,
  ...SORCERER_SUBCLASS_SHEETS,
  ...WARLOCK_SUBCLASS_SHEETS,
  ...WIZARD_SUBCLASS_SHEETS,
  ...GENERATED_SUBCLASS_SHEETS,
];

const CLASS_HIT_DIE: Record<string, number> = {
  artificer: 8,
  barbarian: 12,
  bard: 8,
  "blood hunter": 10,
  cleric: 8,
  druid: 8,
  fighter: 10,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6,
};

const STANDARD_ASI_LEVELS = new Set([4, 8, 12, 16, 19]);

function getProficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

function mapGenericActionType(actionType?: string): "action" | "bonus_action" | "reaction" {
  if (actionType === "bonus_action") return "bonus_action";
  if (actionType === "reaction") return "reaction";
  return "action";
}

function getSubclassChoiceLevelFromLabel(label?: string): number {
  if (!label) return 3;
  const match = label.match(/lv\s*(\d+)/i);
  if (!match) return 3;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 3;
}

function mapGenericFeatureKind(featureType: string, actionType?: string): string {
  if (featureType === "active") return mapGenericActionType(actionType);
  if (featureType === "spellcasting") return "passive";
  return featureType;
}

function buildSpellcastingProgression(
  charClass: string,
  currentLevel: number,
  newLevel: number,
): SpellcastingProgression | undefined {
  const generic = getGenericClassProgression(charClass);
  if (!generic?.isSpellcaster) return undefined;

  const row = generic.progression.find((entry) => entry.level === newLevel);
  const previousSlots = getDefaultSpellSlots(charClass, currentLevel);
  const nextSlots = getDefaultSpellSlots(charClass, newLevel);
  const previousTotals = new Map(previousSlots.map((slot) => [slot.level, slot.total]));
  const spellSlotsGained = nextSlots
    .map((slot) => ({
      level: slot.level,
      gained: Math.max(0, slot.total - (previousTotals.get(slot.level) ?? 0)),
    }))
    .filter((slot) => slot.gained > 0);

  return {
    spellcastingAbility: generic.spellcastingAbility,
    casterType: generic.casterType,
    spellLearningType: generic.spellLearningType,
    newSpellSlots: nextSlots.map((slot) => ({ level: slot.level, total: slot.total })),
    spellSlotsGained,
    spellsKnownGained: generic.spellLearningType === "known" ? row?.spellsKnownGain ?? 0 : 0,
    cantripsKnownGained: row?.cantripsKnownGain ?? 0,
    maxLearnableSpellLevel: nextSlots.reduce((max, slot) => Math.max(max, slot.level), 0),
  };
}

// ── Feature → gain conversion ─────────────────────────────────────────────────

function featureToGain(f: LevelFeatureEntry, level: number): AutomaticGain | ChoiceRequired | null {
  switch (f.kind) {
    case "passive":
      return { kind: "passive", name: f.name, description: f.description };

    case "active_action":
      return { kind: "action", name: f.name, description: f.description, actionType: "action", resetsOn: f.resetsOn };

    case "active_bonus":
      return { kind: "action", name: f.name, description: f.description, actionType: "bonus_action", resetsOn: f.resetsOn };

    case "active_reaction":
      return { kind: "action", name: f.name, description: f.description, actionType: "reaction", resetsOn: f.resetsOn };

    case "resource": {
      const newMax = f.maxFormula === "level" ? level : f.maxFormula;
      return { kind: "resource", name: f.name, description: f.description, newMax, resetsOn: f.resetsOn, color: f.color };
    }

    case "subclass":
      return { kind: "subclass", prompt: f.prompt };

    case "asi":
      return { kind: "asi", prompt: "Choose +2 to one ability score, +1 to two different ability scores, or take a feat." };

    default:
      return null;
  }
}

/** Collect automatic gains and choices from a list of level rows */
function collectFromRows(
  rows: LevelRow[],
  newLevel: number,
  existingLevel: number,
): { auto: AutomaticGain[]; choices: ChoiceRequired[] } {
  const auto: AutomaticGain[] = [];
  const choices: ChoiceRequired[] = [];

  for (const row of rows) {
    // For race sheets we apply all rows where row.level <= newLevel but > existingLevel
    // For class/subclass sheets we only apply the exact newLevel row
    if (row.level !== newLevel && !(row.level > existingLevel && row.level <= newLevel)) continue;
    // Deduplicate: for class sheets only the exact level; for race/subclass use range
    for (const f of row.features) {
      const result = featureToGain(f, newLevel);
      if (!result) continue;
      if ("kind" in result && (result.kind === "subclass" || result.kind === "asi")) {
        choices.push(result as ChoiceRequired);
      } else {
        auto.push(result as AutomaticGain);
      }
    }
  }

  return { auto, choices };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AuditParams {
  currentLevel: number;
  charClass: string;
  subclass?: string;
  race?: string;
}

function isLikelyMultiClass(classLabel: string): boolean {
  const normalized = classLabel.toLowerCase();
  return normalized.includes("/") || normalized.includes(",") || normalized.includes("+") || normalized.includes(" & ");
}

/**
 * Deterministic level-up audit for supported classes.
 * Returns `{ supported: false }` for unsupported classes so the caller can fall
 * back to the AI endpoint.
 */
export function auditLevelUp(params: AuditParams): LevelUpAuditResult {
  const { currentLevel, charClass, subclass = "", race = "" } = params;
  const newLevel = currentLevel + 1;

  if (isLikelyMultiClass(charClass)) {
    return {
      supported: false,
      unsupportedReason: "multiclass_unsupported",
      coverage: { class: "none", subclass: "none", race: "none" },
      newLevel,
      proficiencyBonus: 0,
      hitDie: 0,
      automaticGains: [],
      choices: [],
      optionalReplacements: [],
      derivedUpdates: [],
      spellcasting: undefined,
      summary: "Deterministic level-up is currently single-class only; multiclass progression must be handled manually.",
    };
  }

  // ── Check if class is supported ─────────────────────────────────────────────
  const classKey = Object.keys(CLASS_SHEETS).find((k) => normalise(charClass).includes(k));
  if (!classKey) {
    const generic = getGenericClassProgression(charClass);
    if (!generic) {
      const classEntry = ALL_CLASSES.find((c) => normalise(charClass).includes(normalise(c.name)));
      if (!classEntry) {
        return {
          supported: false,
          unsupportedReason: "unknown_class",
          coverage: { class: "none", subclass: "none", race: "none" },
          newLevel,
          proficiencyBonus: 0,
          hitDie: 0,
          automaticGains: [],
          choices: [],
          optionalReplacements: [],
          derivedUpdates: [],
          spellcasting: undefined,
          summary: "",
        };
      }

      const choices: ChoiceRequired[] = [];
      const subclassLevel = getSubclassChoiceLevelFromLabel(classEntry.subclassLabel);
      if (newLevel === subclassLevel && !subclass) {
        const subclassLabel = classEntry.subclassLabel?.split("(")[0].trim() || "Subclass";
        choices.push({ kind: "subclass", prompt: `Choose your ${subclassLabel}.` });
      }
      if (STANDARD_ASI_LEVELS.has(newLevel)) {
        choices.push({ kind: "asi", prompt: "Choose +2 to one ability score, +1 to two different ability scores, or take a feat." });
      }

      const classLower = normalise(classEntry.name);
      const hitDie = CLASS_HIT_DIE[classLower] ?? 8;

      return {
        supported: true,
        coverage: {
          class: "detailed",
          subclass: getSubclassCoverageLevel(charClass, subclass),
          race: race ? (getRaceProgression(race) ? "detailed" : "baseline") : "baseline",
        },
        newLevel,
        proficiencyBonus: getProficiencyBonus(newLevel),
        hitDie,
        automaticGains: [],
        choices,
        optionalReplacements: [],
        derivedUpdates: [
          { kind: "rebuild_actions", description: "Rebuild action list from updated class, subclass, and feature state." },
          { kind: "rebuild_resources", description: "Recalculate level-scaled resources and maxima." },
          { kind: "rebuild_passives", description: "Refresh passive feature registry to include newly unlocked entries." },
        ],
        spellcasting: buildSpellcastingProgression(charClass, currentLevel, newLevel),
        summary: "This class uses deterministic baseline progression with choices and derived rebuild steps while detailed feature data is expanded.",
      };
    }

    const row = generic.progression.find((entry) => entry.level === newLevel);
    if (!row) {
      return {
        supported: false,
        unsupportedReason: "missing_level_row",
        coverage: { class: "none", subclass: "none", race: "none" },
        newLevel,
        proficiencyBonus: 0,
        hitDie: 0,
        automaticGains: [],
        choices: [],
        optionalReplacements: [],
        derivedUpdates: [],
        spellcasting: undefined,
        summary: "",
      };
    }

    const auto: AutomaticGain[] = [];
    const choices: ChoiceRequired[] = [];

    for (const feature of row.features ?? []) {
      if (feature.type === "choice") {
        choices.push({ kind: "feature", prompt: feature.description || feature.name });
        continue;
      }

      if (feature.type === "active") {
        auto.push({
          kind: "action",
          name: feature.name,
          description: feature.description,
          actionType: mapGenericActionType(feature.actionType),
          resetsOn: feature.resetsOn,
        });
      } else {
        auto.push({
          kind: "passive",
          name: feature.name,
          description: feature.description,
        });
      }
    }

    if (row.subclass && !subclass) {
      const classEntry = ALL_CLASSES.find((c) => normalise(c.name) === normalise(generic.class));
      const subclassLabel = classEntry?.subclassLabel?.split("(")[0].trim() || "Subclass";
      choices.push({ kind: "subclass", prompt: `Choose your ${subclassLabel}.` });
    }

    if (row.asi) {
      choices.push({ kind: "asi", prompt: "Choose +2 to one ability score, +1 to two different ability scores, or take a feat." });
    }

    const summary =
      row.features.length > 0
        ? row.features.map((f) => f.name).join("; ")
        : "This level improves your core class scaling and progression.";

    const classLower = normalise(generic.class);
    const hitDie = CLASS_HIT_DIE[classLower] ?? 8;
    const spellcasting = buildSpellcastingProgression(charClass, currentLevel, newLevel);
    const derivedUpdates: DerivedUpdate[] = [
      { kind: "rebuild_actions", description: "Rebuild action list from updated class, subclass, and feature state." },
      { kind: "rebuild_resources", description: "Recalculate level-scaled resources and maxima." },
      { kind: "rebuild_passives", description: "Refresh passive feature registry to include newly unlocked entries." },
    ];
    if (spellcasting) {
      derivedUpdates.push({ kind: "sync_spellcasting", description: "Synchronize spell slots and class spell progression for the new level." });
    }

    return {
      supported: true,
      coverage: {
        class: "detailed",
        subclass: getSubclassCoverageLevel(charClass, subclass),
        race: race ? (getRaceProgression(race) ? "detailed" : "baseline") : "baseline",
      },
      newLevel,
      proficiencyBonus: getProficiencyBonus(newLevel),
      hitDie,
      automaticGains: auto,
      choices,
      optionalReplacements: [],
      derivedUpdates,
      spellcasting,
      summary,
    };
  }

  const classSheet = CLASS_SHEETS[classKey];

  // ── Find the exact class level row ─────────────────────────────────────────
  const classRow = classSheet.levels.find((r) => r.level === newLevel);
  if (!classRow) {
    return {
      supported: false,
      unsupportedReason: "missing_level_row",
      coverage: { class: "none", subclass: "none", race: "none" },
      newLevel,
      proficiencyBonus: 0,
      hitDie: 0,
      automaticGains: [],
      choices: [],
      optionalReplacements: [],
      derivedUpdates: [],
      spellcasting: undefined,
      summary: "",
    };
  }

  const auto: AutomaticGain[] = [];
  const choices: ChoiceRequired[] = [];

  // Class features at this exact level
  for (const f of classRow.features) {
    const result = featureToGain(f, newLevel);
    if (!result) continue;
    if ("kind" in result && (result.kind === "subclass" || result.kind === "asi")) {
      choices.push(result as ChoiceRequired);
    } else {
      auto.push(result as AutomaticGain);
    }
  }

  // ── Scaling resources (e.g. Ki = monk level) ────────────────────────────────
  if (classSheet.scalingResources) {
    for (const sr of classSheet.scalingResources) {
      if (newLevel >= sr.unlocksAtLevel) {
        // Only emit a resource gain if: (a) it was just unlocked (handled by the
        // level row entry already), or (b) we are scaling an already-unlocked resource.
        // To avoid duplicating from the level row, skip if the level row already
        // produced a resource gain with the same name.
        const alreadyInAuto = auto.some(
          (g) => g.kind === "resource" && (g as ResourceGain).name === sr.name
        );
        if (!alreadyInAuto) {
          auto.push({
            kind: "resource",
            name: sr.name,
            description: "",
            newMax: newLevel,
            resetsOn: sr.resetsOn,
            color: sr.color,
          });
        }
      }
    }
  }

  // ── Subclass features ────────────────────────────────────────────────────────
  if (subclass) {
    const subSheet = SUBCLASS_SHEETS.find(
      (s) => matchesClass(s, charClass) && matchesSubclass(s, subclass)
    );
    if (subSheet) {
      const subRow = subSheet.levels.find((r) => r.level === newLevel);
      if (subRow) {
        const { auto: subAuto, choices: subChoices } = collectFromRows([subRow], newLevel, currentLevel);
        auto.push(...subAuto);
        choices.push(...subChoices);
      }
    }
  }

  // ── Race features that unlock at this character level ────────────────────────
  if (race) {
    const raceSheet = getRaceProgression(race);
    if (raceSheet) {
      // Apply race rows where row.level > currentLevel && row.level <= newLevel
      const relevantRaceRows = raceSheet.levels.filter(
        (r) => r.level > currentLevel && r.level <= newLevel
      );
      const { auto: raceAuto } = collectFromRows(relevantRaceRows, newLevel, currentLevel);
      // Race features are always passive/auto — label them so UI can distinguish
      for (const g of raceAuto) {
        auto.push(g);
      }
    }
  }

  // Build summary: prefer the class row summary, append subclass note if applicable
  let summary = classRow.summary;
  if (subclass && newLevel === 3) {
    summary += ` (Subclass choice required.)`;
  }

  const spellcasting = buildSpellcastingProgression(charClass, currentLevel, newLevel);
  const derivedUpdates: DerivedUpdate[] = [
    { kind: "rebuild_actions", description: "Rebuild action list from updated class, subclass, and feature state." },
    { kind: "rebuild_resources", description: "Recalculate level-scaled resources and maxima." },
    { kind: "rebuild_passives", description: "Refresh passive feature registry to include newly unlocked entries." },
  ];
  if (spellcasting) {
    derivedUpdates.push({ kind: "sync_spellcasting", description: "Synchronize spell slots and class spell progression for the new level." });
  }

  return {
    supported: true,
    coverage: {
      class: "detailed",
      subclass: getSubclassCoverageLevel(charClass, subclass),
      race: race ? (getRaceProgression(race) ? "detailed" : "baseline") : "baseline",
    },
    newLevel,
    proficiencyBonus: classRow.proficiencyBonus,
    hitDie: classRow.hitDie,
    automaticGains: auto,
    choices,
    optionalReplacements: [],
    derivedUpdates,
    spellcasting,
    summary,
  };
}

/**
 * Identify which features the character appears to be missing for their current
 * level. Used for the "audit" display, not for level-up flow.
 */
export function auditCurrentState(params: {
  currentLevel: number;
  charClass: string;
  subclass?: string;
  race?: string;
  existingFeatureNames: string[];
}): { missingFeatures: { level: number; name: string; kind: string }[] } {
  const { currentLevel, charClass, subclass = "", race = "", existingFeatureNames } = params;
  const existing = new Set(existingFeatureNames.map((n) => n.toLowerCase().trim()));
  const missing: { level: number; name: string; kind: string }[] = [];

  const classKey = Object.keys(CLASS_SHEETS).find((k) => normalise(charClass).includes(k));
  if (!classKey) {
    const generic = getGenericClassProgression(charClass);
    if (!generic) return { missingFeatures: [] };

    for (const row of generic.progression) {
      if (row.level > currentLevel) break;
      for (const feature of row.features ?? []) {
        if (feature.type === "choice") continue;
        const featureName = feature.name;
        if (!featureName) continue;
        if (!existing.has(featureName.toLowerCase().trim())) {
          missing.push({
            level: row.level,
            name: featureName,
            kind: mapGenericFeatureKind(feature.type, feature.actionType),
          });
        }
      }
    }

    return { missingFeatures: missing };
  }

  const classSheet = CLASS_SHEETS[classKey];

  for (const row of classSheet.levels) {
    if (row.level > currentLevel) break;
    for (const f of row.features) {
      if (f.kind === "asi" || f.kind === "subclass") continue;
      const featureName = (f as { name: string }).name;
      if (!featureName) continue;
      if (!existing.has(featureName.toLowerCase().trim())) {
        missing.push({ level: row.level, name: featureName, kind: f.kind });
      }
    }
  }

  // Subclass features
  if (subclass) {
    const subSheet = SUBCLASS_SHEETS.find(
      (s) => matchesClass(s, charClass) && matchesSubclass(s, subclass)
    );
    if (subSheet) {
      for (const row of subSheet.levels) {
        if (row.level > currentLevel) break;
        for (const f of row.features) {
          if (f.kind === "asi" || f.kind === "subclass") continue;
          const featureName = (f as { name: string }).name;
          if (!featureName) continue;
          if (!existing.has(featureName.toLowerCase().trim())) {
            missing.push({ level: row.level, name: featureName, kind: f.kind });
          }
        }
      }
    }
  }

  return { missingFeatures: missing };
}
