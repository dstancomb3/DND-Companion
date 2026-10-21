export const AI_DM_STYLE_PRESETS = ["cinematic", "grounded", "heroic", "grim", "mystery"] as const;
export type AiDmStylePreset = (typeof AI_DM_STYLE_PRESETS)[number];

export const AI_DM_DIFFICULTY_PROFILES = ["story", "balanced", "tactical", "deadly"] as const;
export type AiDmDifficultyProfile = (typeof AI_DM_DIFFICULTY_PROFILES)[number];

export const AI_DM_HINT_STYLES = ["minimal", "contextual", "guided"] as const;
export type AiDmHintStyle = (typeof AI_DM_HINT_STYLES)[number];

export const AI_DM_RULES_STRICTNESS_LEVELS = ["strict", "balanced", "rule_of_cool"] as const;
export type AiDmRulesStrictness = (typeof AI_DM_RULES_STRICTNESS_LEVELS)[number];

export const AI_DM_NARRATIVE_PRESSURE_LEVELS = ["low", "moderate", "high"] as const;
export type AiDmNarrativePressure = (typeof AI_DM_NARRATIVE_PRESSURE_LEVELS)[number];

export interface AiDmFocusWeights {
  exploration?: number;
  social?: number;
  combat?: number;
  mystery?: number;
  resourcePressure?: number;
  puzzle?: number;
}

export interface AiDmStyleConfig {
  stylePreset: AiDmStylePreset;
  difficultyProfile: AiDmDifficultyProfile;
  hintStyle: AiDmHintStyle;
  focusWeights?: AiDmFocusWeights;
  rulesStrictness: AiDmRulesStrictness;
  narrativePressure: AiDmNarrativePressure;
}
