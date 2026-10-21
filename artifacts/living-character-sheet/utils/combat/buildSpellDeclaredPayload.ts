import type { AbilityScores, PreparedSpell } from "@/types";
import type { CombatActionCommand } from "@/types/combatResolution";
import type { CombatDeclaredConditionEffect } from "@/types/combatConditions";

const SPELLCASTING_ABILITY_BY_CLASS: Record<string, keyof AbilityScores> = {
  artificer: "intelligence",
  bard: "charisma",
  cleric: "wisdom",
  druid: "wisdom",
  paladin: "charisma",
  ranger: "wisdom",
  sorcerer: "charisma",
  warlock: "charisma",
  wizard: "intelligence",
};

const DAMAGE_TYPE_PATTERN = /(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder|bludgeoning|piercing|slashing)/i;
const DICE_PATTERN = /\b\d+d\d+\b/i;
const DICE_DAMAGE_PATTERN = /(\d+d\d+(?:\s*\+\s*\d+)?)\s+(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder|bludgeoning|piercing|slashing)\s+damage/gi;
const FIXED_DAMAGE_PATTERN = /\b(\d+)\s+(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder|bludgeoning|piercing|slashing)\s+damage\b/gi;

type DeclaredPayload = NonNullable<CombatActionCommand["declared"]>;
type DeclaredDamagePacket = NonNullable<DeclaredPayload["damagePackets"]>[number];

type SupportedConditionRule = {
  effectType: "apply_condition" | "remove_condition";
  conditionName: string;
  applyWhen: CombatDeclaredConditionEffect["applyWhen"];
  targetScope?: CombatDeclaredConditionEffect["targetScope"];
  concentrationLinked?: boolean;
  durationHint?: CombatDeclaredConditionEffect["durationHint"];
  requiresDeclaredChoice?: boolean;
};

type UpcastRule = {
  mode: "add_dice_per_level" | "add_packet_per_level";
  baseLevel: number;
  diceExpression: string;
  damageType: string;
  sourceLabel: string;
};

const EXPLICIT_UPCAST_RULES: Record<string, UpcastRule> = {
  "burning hands": { mode: "add_dice_per_level", baseLevel: 1, diceExpression: "1d6", damageType: "fire", sourceLabel: "spell_upcast_increment" },
  "thunderwave": { mode: "add_dice_per_level", baseLevel: 1, diceExpression: "1d8", damageType: "thunder", sourceLabel: "spell_upcast_increment" },
  "fireball": { mode: "add_dice_per_level", baseLevel: 3, diceExpression: "1d6", damageType: "fire", sourceLabel: "spell_upcast_increment" },
  "lightning bolt": { mode: "add_dice_per_level", baseLevel: 3, diceExpression: "1d6", damageType: "lightning", sourceLabel: "spell_upcast_increment" },
  "guiding bolt": { mode: "add_dice_per_level", baseLevel: 1, diceExpression: "1d6", damageType: "radiant", sourceLabel: "spell_upcast_increment" },
  "inflict wounds": { mode: "add_dice_per_level", baseLevel: 1, diceExpression: "1d10", damageType: "necrotic", sourceLabel: "spell_upcast_increment" },
  "hellish rebuke": { mode: "add_dice_per_level", baseLevel: 1, diceExpression: "1d10", damageType: "fire", sourceLabel: "spell_upcast_increment" },
  "ice storm": { mode: "add_dice_per_level", baseLevel: 4, diceExpression: "1d8", damageType: "bludgeoning", sourceLabel: "spell_upcast_increment" },
  "magic missile": { mode: "add_packet_per_level", baseLevel: 1, diceExpression: "1d4+1", damageType: "force", sourceLabel: "spell_upcast_missile" },
  "scorching ray": { mode: "add_packet_per_level", baseLevel: 2, diceExpression: "2d6", damageType: "fire", sourceLabel: "spell_upcast_ray" },
};

const CHOICE_DAMAGE_TYPE_UPCAST_SPELLS = new Set([
  "chromatic orb",
]);

const EXPLICIT_CONDITION_RULES: Record<string, SupportedConditionRule[]> = {
  "ray of sickness": [
    {
      effectType: "apply_condition",
      conditionName: "Poisoned",
      applyWhen: "on_hit_and_failed_save",
      targetScope: "single",
      durationHint: {
        text: "until the end of your next turn",
      },
    },
  ],
  "tasha's hideous laughter": [
    {
      effectType: "apply_condition",
      conditionName: "Prone",
      applyWhen: "on_failed_save",
      targetScope: "single",
      concentrationLinked: true,
      durationHint: {
        durationType: "concentration",
        text: "up to 1 minute",
      },
    },
    {
      effectType: "apply_condition",
      conditionName: "Incapacitated",
      applyWhen: "on_failed_save",
      targetScope: "single",
      concentrationLinked: true,
      durationHint: {
        durationType: "concentration",
        text: "up to 1 minute",
      },
    },
  ],
  "hold person": [
    {
      effectType: "apply_condition",
      conditionName: "Paralyzed",
      applyWhen: "on_failed_save",
      targetScope: "single",
      concentrationLinked: true,
      durationHint: {
        durationType: "concentration",
        text: "up to 1 minute",
        saveEnds: true,
      },
    },
  ],
  "hold monster": [
    {
      effectType: "apply_condition",
      conditionName: "Paralyzed",
      applyWhen: "on_failed_save",
      targetScope: "single",
      concentrationLinked: true,
      durationHint: {
        durationType: "concentration",
        text: "up to 1 minute",
        saveEnds: true,
      },
    },
  ],
  web: [
    {
      effectType: "apply_condition",
      conditionName: "Restrained",
      applyWhen: "on_failed_save",
      targetScope: "area",
      concentrationLinked: true,
      durationHint: {
        durationType: "concentration",
        text: "up to 1 hour while in the web",
      },
    },
  ],
  "hypnotic pattern": [
    {
      effectType: "apply_condition",
      conditionName: "Charmed",
      applyWhen: "on_failed_save",
      targetScope: "area",
      concentrationLinked: true,
      durationHint: {
        durationType: "concentration",
        text: "up to 1 minute",
      },
    },
    {
      effectType: "apply_condition",
      conditionName: "Incapacitated",
      applyWhen: "on_failed_save",
      targetScope: "area",
      concentrationLinked: true,
      durationHint: {
        durationType: "concentration",
        text: "up to 1 minute",
      },
    },
  ],
};

function buildDeclaredConditionEffects(input: {
  spell: PreparedSpell;
  description: string;
  limitations: string[];
}): CombatDeclaredConditionEffect[] {
  const { spell, description, limitations } = input;
  const normalizedName = spell.name.trim().toLowerCase();
  const explicitRules = EXPLICIT_CONDITION_RULES[normalizedName];
  if (explicitRules) {
    return explicitRules.map((rule) => ({
      effectType: rule.effectType,
      conditionName: rule.conditionName,
      applyWhen: rule.applyWhen,
      targetScope: rule.targetScope,
      sourceLabel: "spell_condition_rule",
      durationHint: rule.durationHint,
      concentrationLinked: rule.concentrationLinked,
    }));
  }

  if (/blind(?:ed|ness)|deaf(?:ened|ness)/i.test(description) && /choose/i.test(description)) {
    limitations.push("Spell condition choice was detected, but the chosen condition is not declared in the current cast flow.");
  }

  return [];
}

function abilityModifier(score: number | undefined): number {
  if (typeof score !== "number" || !Number.isFinite(score)) return 0;
  return Math.floor((score - 10) / 2);
}

function parseDiceExpression(expression: string): { count: number; sides: number; modifier: number } | null {
  const match = expression.replace(/\s+/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  const count = Number.parseInt(match[1], 10);
  const sides = Number.parseInt(match[2], 10);
  const modifier = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) return null;
  return { count, sides, modifier };
}

function averageDiceExpression(expression: string): number | null {
  const parsed = parseDiceExpression(expression);
  if (!parsed) return null;
  const average = parsed.count * ((parsed.sides + 1) / 2) + parsed.modifier;
  return Math.max(0, Math.floor(average));
}

function normalizeClassKey(characterClass: string | undefined): string {
  return (characterClass ?? "")
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ");
}

function extractSaveAbility(description: string): string | undefined {
  const match = description.match(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s+save\b/i);
  if (!match) return undefined;
  const value = match[1].toLowerCase();
  if (value === "strength" || value === "str") return "str";
  if (value === "dexterity" || value === "dex") return "dex";
  if (value === "constitution" || value === "con") return "con";
  if (value === "intelligence" || value === "int") return "int";
  if (value === "wisdom" || value === "wis") return "wis";
  if (value === "charisma" || value === "cha") return "cha";
  return undefined;
}

function extractOnSave(description: string): NonNullable<NonNullable<CombatActionCommand["declared"]>["save"]>["onSave"] | undefined {
  const lower = description.toLowerCase();
  if (!lower.includes("save")) return undefined;
  if (/save(?:\s+for)?\s+half|half\s+as\s+much\s+damage|half\s+damage\s+on\s+(?:a\s+)?success/.test(lower)) {
    return "half";
  }
  if (/save\s+negates|on\s+a\s+successful\s+save[^.]*no\s+damage|no\s+effect\s+on\s+a\s+successful\s+save/.test(lower)) {
    return "negates";
  }
  return "full";
}

function detectTargetScopeHint(spell: PreparedSpell, description: string): NonNullable<DeclaredPayload["spell"]>["targetScopeHint"] {
  const lower = description.toLowerCase();
  const rangeLower = (spell.range ?? "").toLowerCase();
  if (rangeLower === "self") {
    if (/cone|line|radius|sphere|cube/.test(lower)) return "area";
    return "self";
  }
  if (/cone|line|radius|sphere|cube|creatures? in the area|within \d+\s*ft\.?\s*of/.test(lower)) return "area";
  if (/up to \d+ creatures?|one or two creatures?|each creature|creatures? within/.test(lower)) return "multi";
  if (/one creature|a creature/.test(lower)) return "single";
  return "unknown";
}

function buildDamagePacketsFromDescription(description: string): {
  packets: DeclaredDamagePacket[];
  sawDiceDamageText: boolean;
  sawFixedDamageText: boolean;
} {
  const packets: DeclaredDamagePacket[] = [];
  let sawDiceDamageText = false;
  let sawFixedDamageText = false;

  for (const match of description.matchAll(DICE_DAMAGE_PATTERN)) {
    const diceExpression = (match[1] ?? "").replace(/\s+/g, "");
    const damageType = (match[2] ?? "").toLowerCase();
    sawDiceDamageText = true;
    const averageAmount = averageDiceExpression(diceExpression);
    if (averageAmount == null) continue;
    packets.push({
      sourceLabel: "spell_text_dice_damage",
      rawAmount: averageAmount,
      damageType,
      criticalEligible: false,
      diceExpression,
      resolutionModel: "dice_average",
      scalingSource: "base",
    });
  }

  for (const match of description.matchAll(FIXED_DAMAGE_PATTERN)) {
    const rawAmount = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) continue;
    sawFixedDamageText = true;
    packets.push({
      sourceLabel: "spell_text_fixed_damage",
      rawAmount,
      damageType: (match[2] ?? "").toLowerCase(),
      criticalEligible: false,
      resolutionModel: "fixed",
      scalingSource: "base",
    });
  }

  return {
    packets,
    sawDiceDamageText,
    sawFixedDamageText,
  };
}

function applyUpcastScaling(input: {
  spellName: string;
  description: string;
  baseLevel: number;
  selectedLevel: number;
  existingDamagePackets: DeclaredDamagePacket[];
}): {
  upcastPackets: DeclaredDamagePacket[];
  scaling: NonNullable<DeclaredPayload["spell"]>["scaling"];
  limitations: string[];
} {
  const { spellName, description, baseLevel, selectedLevel, existingDamagePackets } = input;
  const levelsAboveBase = Math.max(0, selectedLevel - baseLevel);
  const limitations: string[] = [];

  if (baseLevel < 1 || levelsAboveBase <= 0) {
    return {
      upcastPackets: [],
      scaling: {
        supported: false,
        source: "none",
        baseLevel,
        castLevel: selectedLevel,
        levelsAboveBase,
      },
      limitations,
    };
  }

  const normalizedName = spellName.trim().toLowerCase();
  if (CHOICE_DAMAGE_TYPE_UPCAST_SPELLS.has(normalizedName)) {
    limitations.push("Spell upcast scaling depends on a chosen damage type, but the chosen type is not declared in the current cast payload.");
    return {
      upcastPackets: [],
      scaling: {
        supported: false,
        source: "none",
        baseLevel,
        castLevel: selectedLevel,
        levelsAboveBase,
      },
      limitations,
    };
  }

  const rule = EXPLICIT_UPCAST_RULES[normalizedName];
  if (rule && selectedLevel > rule.baseLevel) {
    const levelsApplied = selectedLevel - rule.baseLevel;
    const packetAmount = averageDiceExpression(rule.diceExpression);
    const upcastPackets: DeclaredDamagePacket[] = [];
    if (packetAmount != null) {
      for (let i = 0; i < levelsApplied; i += 1) {
        upcastPackets.push({
          sourceLabel: rule.sourceLabel,
          rawAmount: packetAmount,
          damageType: rule.damageType,
          criticalEligible: false,
          diceExpression: rule.diceExpression,
          resolutionModel: "dice_average",
          scalingSource: "upcast",
        });
      }
    }
    return {
      upcastPackets,
      scaling: {
        supported: true,
        source: "name_rule",
        baseLevel,
        castLevel: selectedLevel,
        levelsAboveBase,
        summary: `Applied explicit ${rule.mode} upcast scaling (+${levelsApplied} x ${rule.diceExpression}).`,
      },
      limitations,
    };
  }

  const textRule = description.match(/damage increases by\s+(\d+d\d+(?:\s*\+\s*\d+)?)\s+for each slot level above\s+(\d+)(?:st|nd|rd|th)/i);
  if (textRule) {
    const diceExpression = (textRule[1] ?? "").replace(/\s+/g, "");
    const ruleBaseLevel = Number.parseInt(textRule[2] ?? "", 10);
    if (Number.isFinite(ruleBaseLevel) && selectedLevel > ruleBaseLevel) {
      const packetAmount = averageDiceExpression(diceExpression);
      const levelsApplied = selectedLevel - ruleBaseLevel;
      const fallbackType = existingDamagePackets[0]?.damageType;
      if (packetAmount != null && fallbackType) {
        const upcastPackets: DeclaredDamagePacket[] = [];
        for (let i = 0; i < levelsApplied; i += 1) {
          upcastPackets.push({
            sourceLabel: "spell_upcast_text_pattern",
            rawAmount: packetAmount,
            damageType: fallbackType,
            criticalEligible: false,
            diceExpression,
            resolutionModel: "dice_average",
            scalingSource: "upcast",
          });
        }
        return {
          upcastPackets,
          scaling: {
            supported: true,
            source: "text_pattern",
            baseLevel,
            castLevel: selectedLevel,
            levelsAboveBase,
            summary: `Applied text-pattern scaling (+${levelsApplied} x ${diceExpression}).`,
          },
          limitations,
        };
      }
      limitations.push("Upcast text pattern detected, but scaling damage type could not be derived safely.");
    }
  }

  if (existingDamagePackets.length > 0) {
    limitations.push(`Spell was cast at level ${selectedLevel}, but no safe upcast scaling rule is implemented for this spell.`);
  }

  return {
    upcastPackets: [],
    scaling: {
      supported: false,
      source: "none",
      baseLevel,
      castLevel: selectedLevel,
      levelsAboveBase,
    },
    limitations,
  };
}

export function buildSpellDeclaredPayload(input: {
  spell: PreparedSpell;
  characterClass: string;
  proficiencyBonus: number;
  abilityScores: AbilityScores;
  officialDescription?: string;
  castAtLevel?: number;
  attackRollTotal?: number;
  attackRollIsCritical?: boolean;
}): {
  declared: NonNullable<CombatActionCommand["declared"]>;
  requiresResolution: boolean;
  resolutionLimitations: string[];
  spellAttack: {
    detected: boolean;
    attackBonus?: number;
    declaredAttackRoll?: number;
    declaredCritical?: boolean;
  };
} {
  const {
    spell,
    characterClass,
    proficiencyBonus,
    abilityScores,
    officialDescription,
    castAtLevel,
    attackRollTotal,
    attackRollIsCritical,
  } = input;
  const description = (spell.description ?? "").trim() || (officialDescription ?? "").trim();
  const limitations: string[] = [];
  const classKey = normalizeClassKey(characterClass);
  const spellcastingAbility = SPELLCASTING_ABILITY_BY_CLASS[classKey];
  const baseSpellLevel = !spell.level || Number(spell.level) < 1 ? 0 : spell.level;
  const selectedLevel = typeof castAtLevel === "number" && Number.isFinite(castAtLevel)
    ? Math.max(baseSpellLevel, Math.floor(castAtLevel))
    : baseSpellLevel;
  const declared: NonNullable<CombatActionCommand["declared"]> = {
    spellLevel: selectedLevel,
    spell: {
      concentration: {
        required: spell.concentration === true,
        durationText: spell.duration,
      },
      targetScopeHint: "unknown",
      mode: "effect_only",
      scaling: {
        supported: false,
        source: "none",
        baseLevel: baseSpellLevel,
        castLevel: selectedLevel,
        levelsAboveBase: Math.max(0, selectedLevel - baseSpellLevel),
      },
      damageModel: "none",
      parsingConfidence: "limited",
    },
  };
  const spellAttack: {
    detected: boolean;
    attackBonus?: number;
    declaredAttackRoll?: number;
    declaredCritical?: boolean;
  } = {
    detected: false,
  };

  if (!description) {
    limitations.push("No structured spell text is available for resolver payload extraction.");
    return {
      declared,
      requiresResolution: false,
      resolutionLimitations: limitations,
      spellAttack,
    };
  }

  const hasSpellAttack = /\b(?:melee|ranged)?\s*spell attack\b/i.test(description);
  spellAttack.detected = hasSpellAttack;
  const saveAbility = extractSaveAbility(description);
  const mode: NonNullable<DeclaredPayload["spell"]>["mode"] = hasSpellAttack
    ? (saveAbility ? "attack_and_save" : "attack")
    : (saveAbility ? "save" : "effect_only");
  declared.spell = {
    ...declared.spell,
    mode,
    targetScopeHint: detectTargetScopeHint(spell, description),
  };

  if (hasSpellAttack) {
    if (spellcastingAbility) {
      spellAttack.attackBonus = proficiencyBonus + abilityModifier(abilityScores[spellcastingAbility]);
    }
    if (typeof attackRollTotal === "number" && Number.isFinite(attackRollTotal)) {
      const normalizedRoll = Math.max(1, Math.floor(attackRollTotal));
      declared.attackRoll = normalizedRoll;
      spellAttack.declaredAttackRoll = normalizedRoll;
      spellAttack.declaredCritical = attackRollIsCritical === true;
    } else {
      const attackBonusText = typeof spellAttack.attackBonus === "number"
        ? ` (suggested bonus +${spellAttack.attackBonus})`
        : "";
      limitations.push(`Spell uses a spell attack roll, but no declared roll input exists in current cast flow${attackBonusText}.`);
    }
  }

  if (saveAbility) {
    if (spellcastingAbility) {
      const dc = 8 + proficiencyBonus + abilityModifier(abilityScores[spellcastingAbility]);
      declared.save = {
        saveAbility,
        dc,
        onSave: extractOnSave(description),
      };
    } else {
      declared.save = {
        saveAbility,
        onSave: extractOnSave(description),
      };
      limitations.push("Spell save ability was detected, but spell save DC is unknown for this class shape.");
    }
  }

  const damageExtraction = buildDamagePacketsFromDescription(description);
  const conditionEffects = buildDeclaredConditionEffects({
    spell,
    description,
    limitations,
  });
  if (conditionEffects.length > 0) {
    declared.conditionEffects = conditionEffects;
  }
  const upcastResult = applyUpcastScaling({
    spellName: spell.name,
    description,
    baseLevel: baseSpellLevel,
    selectedLevel,
    existingDamagePackets: damageExtraction.packets,
  });
  limitations.push(...upcastResult.limitations);

  const allDamagePackets = [...damageExtraction.packets, ...upcastResult.upcastPackets];
  if (allDamagePackets.length > 0) {
    declared.damagePackets = allDamagePackets;
    const hasDice = allDamagePackets.some((packet) => packet.resolutionModel === "dice_average" || packet.resolutionModel === "dice_declared_roll");
    const hasFixed = allDamagePackets.some((packet) => packet.resolutionModel === "fixed");
    declared.spell = {
      ...declared.spell,
      scaling: upcastResult.scaling,
      damageModel: hasDice && hasFixed ? "mixed" : hasDice ? "dice" : "fixed",
      parsingConfidence: "high",
    };
    if (hasDice) {
      limitations.push("Spell damage dice were interpreted using deterministic average values (no explicit damage roll input yet).");
    }
  } else if (DICE_PATTERN.test(description) && DAMAGE_TYPE_PATTERN.test(description)) {
    limitations.push("Spell damage dice detected in text, but no safe resolver-ready damage packet could be derived.");
    declared.spell = {
      ...declared.spell,
      scaling: upcastResult.scaling,
      damageModel: "none",
      parsingConfidence: "partial",
    };
  } else {
    declared.spell = {
      ...declared.spell,
      scaling: upcastResult.scaling,
      parsingConfidence: declared.save || declared.attackRoll ? "partial" : "limited",
    };
  }

  const requiresResolution = Boolean(
    declared.attackRoll != null
    || declared.save
    || (declared.damagePackets?.length ?? 0) > 0
    || (declared.conditionEffects?.length ?? 0) > 0
  );
  return {
    declared,
    requiresResolution,
    resolutionLimitations: limitations,
    spellAttack,
  };
}