// Deterministic rules helpers backed by local progression data.
// Used by legacy paths and utility screens.

import type { Character, Quest, NpcPerson, CampaignLocation } from "../types";
import { loadRules } from "./loadRules";

export interface ProgressionResult {
  level: number;
  class: string;
  subclass?: string;
  race: string;
  features: FeatureUnlock[];
  resources: ResourceUnlock[];
  actions: ActionUnlock[];
  requiredChoices: RequiredChoice[];
}

export interface FeatureUnlock {
  name: string;
  description: string;
  level: number;
  type: "passive" | "action" | "bonusAction" | "reaction" | "reminder";
  source: "class" | "subclass" | "race" | "feat" | "item";
}

export interface ResourceUnlock {
  name: string;
  max: number;
  current: number;
  scaling: string;
  source: "class" | "subclass" | "race" | "feat" | "item";
}

export interface ActionUnlock {
  name: string;
  type: "action" | "bonusAction" | "reaction" | "attack" | "spell";
  description: string;
  source: "class" | "subclass" | "race" | "feat" | "item";
}

export interface RequiredChoice {
  name: string;
  options: string[];
  description: string;
  type: "subclass" | "feat" | "asi" | "feature";
}

function mapActionUnlockType(actionType?: string): ActionUnlock["type"] {
  if (actionType === "bonus_action") return "bonusAction";
  if (actionType === "reaction") return "reaction";
  return "action";
}

function getRageUses(level: number): number {
  if (level >= 20) return 999;
  if (level >= 17) return 6;
  if (level >= 12) return 5;
  if (level >= 6) return 4;
  if (level >= 3) return 3;
  return 2;
}

function deriveProgressionResources(character: Character, featureNames: string[]): ResourceUnlock[] {
  const className = character.class.toLowerCase();
  const resources: ResourceUnlock[] = [];
  const hasFeature = (name: string) => featureNames.some((f) => f.toLowerCase() === name.toLowerCase());

  if (hasFeature("Ki") || className.includes("monk")) {
    if (character.level >= 2) {
      resources.push({
        name: "Ki",
        max: character.level,
        current: character.level,
        scaling: "class_level",
        source: "class",
      });
    }
  }

  if (hasFeature("Rage") || className.includes("barbarian")) {
    resources.push({
      name: "Rage",
      max: getRageUses(character.level),
      current: getRageUses(character.level),
      scaling: "tier_table",
      source: "class",
    });
  }

  if (hasFeature("Bardic Inspiration") || className.includes("bard")) {
    const chaMod = Math.floor((character.abilityScores.charisma - 10) / 2);
    const uses = Math.max(1, chaMod);
    resources.push({
      name: "Bardic Inspiration",
      max: uses,
      current: uses,
      scaling: "ability_modifier",
      source: "class",
    });
  }

  if (hasFeature("Second Wind") || className.includes("fighter")) {
    resources.push({
      name: "Second Wind",
      max: 1,
      current: 1,
      scaling: "fixed",
      source: "class",
    });
  }

  if (hasFeature("Action Surge") || className.includes("fighter")) {
    resources.push({
      name: "Action Surge",
      max: character.level >= 17 ? 2 : 1,
      current: character.level >= 17 ? 2 : 1,
      scaling: "level_threshold",
      source: "class",
    });
  }

  if (hasFeature("Channel Divinity (1/rest)") || hasFeature("Channel Divinity Uses") || className.includes("cleric")) {
    let uses = 1;
    if (character.level >= 18) uses = 3;
    else if (character.level >= 6) uses = 2;
    resources.push({
      name: "Channel Divinity",
      max: uses,
      current: uses,
      scaling: "level_threshold",
      source: "class",
    });
  }

  if (hasFeature("Wild Shape") || className.includes("druid")) {
    if (character.level >= 2) {
      resources.push({
        name: "Wild Shape",
        max: 2,
        current: 2,
        scaling: "fixed",
        source: "class",
      });
    }
  }

  if (hasFeature("Lay on Hands") || className.includes("paladin")) {
    resources.push({
      name: "Lay on Hands Pool",
      max: character.level * 5,
      current: character.level * 5,
      scaling: "class_level_x5",
      source: "class",
    });
  }

  return resources;
}

export function getClassProgression(character: Character): ProgressionResult {
  // Load class progression data (merged with overrides)
  const classData = loadRules("classProgressions.json");
  const className = character.class;
  const classProgression = classData[className];

  let features: FeatureUnlock[] = [];
  let actions: ActionUnlock[] = [];
  let requiredChoices: RequiredChoice[] = [];
  if (classProgression && classProgression.progression) {
    for (const entry of classProgression.progression) {
      if (entry.level <= character.level) {
        // Map features
        if (entry.features) {
          features.push(...entry.features.map((f: any) => ({
            name: f.name,
            description: f.description,
            level: entry.level,
            type:
              f.type === "active"
                ? f.actionType === "bonus_action"
                  ? "bonusAction"
                  : f.actionType === "reaction"
                    ? "reaction"
                    : "action"
                : f.type === "choice"
                  ? "reminder"
                  : f.type,
            source: "class"
          })));

          actions.push(
            ...entry.features
              .filter((f: any) => f.type === "active")
              .map((f: any) => ({
                name: f.name,
                description: f.description,
                source: "class" as const,
                type: mapActionUnlockType(f.actionType),
              }))
          );
        }
        // Map choices
        if (entry.subclass) {
          requiredChoices.push({
            name: classProgression.subclassLabel || "Subclass",
            options: classProgression.subclasses || [],
            description: `Choose a ${classProgression.subclassLabel || "Subclass"}`,
            type: "subclass"
          });
        }
        if (entry.asi) {
          requiredChoices.push({
            name: "Ability Score Improvement",
            options: ["+2 to one stat", "+1 to two stats", "Feat"],
            description: "Choose an ability score improvement or feat.",
            type: "asi"
          });
        }
      }
    }
  }
  const dedupedActions = Array.from(new Map(actions.map((a) => [a.name.toLowerCase(), a])).values());
  const dedupedChoices = Array.from(new Map(requiredChoices.map((c) => [`${c.type}:${c.name.toLowerCase()}`, c])).values());
  const resources = deriveProgressionResources(character, features.map((f) => f.name));

  return {
    level: character.level,
    class: character.class,
    subclass: character.subclass,
    race: character.race,
    features,
    resources,
    actions: dedupedActions,
    requiredChoices: dedupedChoices,
  };
}

export function getLevelUpChoices(character: Character): RequiredChoice[] {
  const progression = getClassProgression(character);
  return progression.requiredChoices;
}

export function applyLevelUp(character: Character, choices: RequiredChoice[]): Character {
  // Legacy helper: mutating level-up is handled by LevelUpModal + CharacterContext.
  // This function remains as a compatibility shim.
  return character;
}

export function generateActions(character: Character): ActionUnlock[] {
  const progression = getClassProgression(character);
  return progression.features
    .filter((feature) => feature.type === "action" || feature.type === "bonusAction" || feature.type === "reaction")
    .map((feature) => ({
      name: feature.name,
      description: feature.description,
      source: feature.source,
      type:
        feature.type === "bonusAction"
          ? "bonusAction"
          : feature.type === "reaction"
            ? "reaction"
            : "action",
    }));
}

export function classifyFeature(feature: FeatureUnlock): string {
  if (feature.type === "action" || feature.type === "bonusAction" || feature.type === "reaction") {
    return "usable";
  }
  if (feature.type === "passive") {
    return "passive";
  }
  return "reminder";
}
