import { useCharacter } from "@/context/CharacterContext";
import type { InventoryItem, EquippedStatKey, Character, RulesEngineState } from "@/types";
import { getFeatureFlag } from "@/utils/featureFlags";
import { getRuntimeItemProjectedEffects } from "@/utils/mechanics/runtimeMechanicsCompatibility";

export type StatBonuses = Partial<Record<EquippedStatKey, number>>;

/** Map of label keywords to EquippedStatKey for parsing legacy buff labels */
const LABEL_STAT_MAP: Array<{ patterns: string[]; key: EquippedStatKey }> = [
  { patterns: ["armor class", " ac ", "ac "], key: "armorClass" },
  { patterns: ["initiative"], key: "initiative" },
  { patterns: ["speed"], key: "speed" },
  { patterns: ["max hp", "maximum hp", "hit point"], key: "maxHp" },
  { patterns: ["passive perception"], key: "passivePerception" },
  { patterns: ["proficiency"], key: "proficiencyBonus" },
  { patterns: ["strength", " str "], key: "strength" },
  { patterns: ["dexterity", " dex "], key: "dexterity" },
  { patterns: ["constitution", " con "], key: "constitution" },
  { patterns: ["intelligence", " int "], key: "intelligence" },
  { patterns: ["wisdom", " wis "], key: "wisdom" },
  { patterns: ["charisma", " cha "], key: "charisma" },
];

/**
 * Try to parse a numeric stat bonus from a free-text label like "+4 to Initiative"
 * or "+1 Dex". Returns null if no pattern matches.
 */
function parseLabelBonus(label: string): { key: EquippedStatKey; value: number } | null {
  const lower = " " + label.toLowerCase() + " ";
  // Match optional sign + digit(s) anywhere in the string
  const numMatch = lower.match(/([+-]?\d+)/);
  if (!numMatch) return null;
  const value = parseInt(numMatch[1], 10);
  if (isNaN(value) || value === 0) return null;
  for (const { patterns, key } of LABEL_STAT_MAP) {
    if (patterns.some((p) => lower.includes(p))) {
      return { key, value };
    }
  }
  return null;
}

/**
 * Sums all structured and parseable stat bonuses from currently-equipped items.
 * Accepts any effect type that carries statKey+statValue, and falls back to
 * label-parsing for "buff" effects without explicit stat fields (backwards compat).
 */
export function computeStatBonuses(inventory: InventoryItem[]): StatBonuses {
  const bonuses: StatBonuses = {};
  for (const item of inventory) {
    if (!item.equipped) continue;
    for (const effect of getRuntimeItemProjectedEffects(item)) {
      if (effect.statKey != null && effect.statValue != null) {
        // Explicit stat fields present — applies regardless of effect type
        bonuses[effect.statKey] = (bonuses[effect.statKey] ?? 0) + effect.statValue;
      } else if (effect.type === "buff" || effect.type === "stat_bonus") {
        // No explicit statKey — try to parse the label for backward compat
        const parsed = parseLabelBonus(effect.label);
        if (parsed) {
          bonuses[parsed.key] = (bonuses[parsed.key] ?? 0) + parsed.value;
        }
      }
    }
  }
  return bonuses;
}

/**
 * Trait contributions for AC calculation (for explainability)
 */
export interface ACContribution {
  source: "base" | "armor" | "ability" | "item" | "rule";
  sourceId?: string;
  sourceLabel: string;
  value: number;
  active: boolean;
}

export interface EffectiveStats {
  bonuses: StatBonuses;
  /** True when at least one equipped item is contributing a numeric bonus */
  hasItemBonuses: boolean;
  ac: number;
  speed: number;
  initiative: number;
  maxHp: number;
  passivePerception: number;
  proficiencyBonus: number;
  abilityScores: Character["abilityScores"];
  /** AC contribution breakdown (when rulesEngineV1 enabled) */
  acContributions?: ACContribution[];
}

function getRuleStatBonuses(rulesState: RulesEngineState | undefined): StatBonuses {
  if (!rulesState) return {};

  const supportedStatKeys = new Set<EquippedStatKey>([
    "armorClass",
    "initiative",
    "speed",
    "maxHp",
    "proficiencyBonus",
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
  ]);

  const bonuses: StatBonuses = {};
  for (const effect of rulesState.appliedEffects) {
    if (effect.effectType !== "modify_stat") continue;
    if (!effect.statKey || effect.statValue == null) continue;
    if (!supportedStatKeys.has(effect.statKey as EquippedStatKey)) continue;

    const key = effect.statKey as EquippedStatKey;
    bonuses[key] = (bonuses[key] ?? 0) + effect.statValue;
  }

  return bonuses;
}

function getArmorClassRuleContributions(rulesState: RulesEngineState | undefined): ACContribution[] {
  if (!rulesState) return [];
  const contributions: ACContribution[] = [];

  for (const effect of rulesState.appliedEffects) {
    if (effect.effectType !== "modify_stat" || effect.statKey !== "armorClass" || effect.statValue == null) continue;
    const provenance = rulesState.activeProvenances.find((p) => p.ruleId === effect.ruleId);
    contributions.push({
      source: "rule",
      sourceId: effect.ruleId,
      sourceLabel: effect.label || provenance?.ruleName || `Rule ${effect.ruleId}`,
      value: effect.statValue,
      active: true,
    });
  }

  return contributions;
}

export function useEffectiveStats(): EffectiveStats {
  const { character, inventory, rulesState } = useCharacter();
  const itemBonuses = computeStatBonuses(inventory);
  const ruleBonuses = getRuleStatBonuses(getFeatureFlag("rulesEngineV1") ? rulesState : undefined);
  const bonuses: StatBonuses = { ...itemBonuses };
  for (const [k, v] of Object.entries(ruleBonuses)) {
    if (v == null) continue;
    const key = k as EquippedStatKey;
    bonuses[key] = (bonuses[key] ?? 0) + v;
  }
  const b = (key: EquippedStatKey) => bonuses[key] ?? 0;

  // Build AC contribution breakdown if feature enabled
  let acContributions: ACContribution[] | undefined;
  if (getFeatureFlag("rulesEngineV1")) {
    acContributions = [];
    
    // Base AC (from armor or 10+DEX)
    acContributions.push({
      source: "base",
      sourceLabel: `Base AC (${character.armorClass})`,
      value: character.armorClass,
      active: true,
    });

    // DEX bonus if AC uses modifiers
    const dexMod = character.abilityScores.dexterity;
    if (dexMod !== 0) {
      acContributions.push({
        source: "ability",
        sourceLabel: `Dexterity modifier (+${dexMod})`,
        value: dexMod,
        active: true,
      });
    }

    // Rule-evaluated contributions from persisted runtime effects/provenance
    acContributions.push(...getArmorClassRuleContributions(rulesState));
  }

  const finalAC = character.armorClass + b("armorClass");

  return {
    bonuses,
    hasItemBonuses: Object.keys(bonuses).length > 0,
    ac: finalAC,
    speed: character.speed + b("speed"),
    initiative: character.initiative + b("initiative"),
    maxHp: character.maxHp + b("maxHp"),
    passivePerception: character.passivePerception + b("passivePerception"),
    proficiencyBonus: character.proficiencyBonus + b("proficiencyBonus"),
    abilityScores: {
      strength: character.abilityScores.strength + b("strength"),
      dexterity: character.abilityScores.dexterity + b("dexterity"),
      constitution: character.abilityScores.constitution + b("constitution"),
      intelligence: character.abilityScores.intelligence + b("intelligence"),
      wisdom: character.abilityScores.wisdom + b("wisdom"),
      charisma: character.abilityScores.charisma + b("charisma"),
    },
    acContributions,
  };
}
