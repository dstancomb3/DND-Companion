/** What kind of feature this is for categorisation. */
export type FeatureKind =
  | "passive"       // always-on, shown in passive features list
  | "active_action"       // action in the Actions tab
  | "active_bonus"        // bonus action in the Actions tab
  | "active_reaction"     // reaction in the Actions tab
  | "resource"      // creates/updates a tracked resource
  | "choice"        // requires the player to make a selection
  | "subclass"      // triggers subclass selection step
  | "asi";          // triggers ASI / Feat choice step

export type ResetType = "short_rest" | "long_rest";

export interface PassiveFeatureEntry {
  kind: "passive";
  name: string;
  description: string;
}

export interface ActionFeatureEntry {
  kind: "active_action" | "active_bonus" | "active_reaction";
  name: string;
  description: string;
  resetsOn?: ResetType;
}

export interface ResourceFeatureEntry {
  kind: "resource";
  name: string;
  description: string;
  /** "level" means max = current monk/class level */
  maxFormula: "level" | number;
  resetsOn: ResetType;
  color?: string;
}

export interface SubclassEntry {
  kind: "subclass";
  prompt: string;
}

export interface AsiEntry {
  kind: "asi";
}

export type LevelFeatureEntry =
  | PassiveFeatureEntry
  | ActionFeatureEntry
  | ResourceFeatureEntry
  | SubclassEntry
  | AsiEntry;

export interface LevelRow {
  level: number;
  proficiencyBonus: number;
  hitDie: number;
  features: LevelFeatureEntry[];
  /** Brief text summarising this level for the overview screen */
  summary: string;
}

export interface ProgressionSheet {
  key: string;           // e.g. "monk", "monk:open_hand", "race:human"
  source: "class" | "subclass" | "race";
  appliesTo?: {
    class?: string;
    subclass?: string;
    race?: string;
  };
  levels: LevelRow[];
  /**
   * Resources whose max equals the character level (or another continuous formula).
   * The engine will emit a ResourceGain for these on every level-up once unlocked.
   */
  scalingResources?: ScalingResource[];
}

/** A resource whose maximum scales continuously with character/class level. */
export interface ScalingResource {
  name: string;
  /** "level" = max equals the new class level number */
  formula: "level";
  resetsOn: ResetType;
  color?: string;
  /** Character level at which this resource is first granted */
  unlocksAtLevel: number;
}

// ── Audit result ──────────────────────────────────────────────────────────────

export interface PassiveGain {
  kind: "passive";
  name: string;
  description: string;
}

export interface ActionGain {
  kind: "action";
  name: string;
  description: string;
  actionType: "action" | "bonus_action" | "reaction";
  resetsOn?: ResetType;
}

export interface ResourceGain {
  kind: "resource";
  name: string;
  description: string;
  newMax: number;
  resetsOn: ResetType;
  color?: string;
}

export interface ChoiceRequired {
  kind: "subclass" | "asi" | "feature";
  prompt: string;
}

export interface OptionalReplacement {
  kind: "replacement";
  prompt: string;
  options: string[];
}

export interface DerivedUpdate {
  kind: "rebuild_actions" | "rebuild_resources" | "rebuild_passives" | "sync_spellcasting";
  description: string;
}

export interface SpellSlotSummary {
  level: number;
  total: number;
}

export interface SpellSlotGainSummary {
  level: number;
  gained: number;
}

export interface SpellcastingProgression {
  spellcastingAbility?: "INT" | "WIS" | "CHA";
  casterType?: "full" | "half" | "warlock" | "third";
  spellLearningType?: "known" | "prepared";
  newSpellSlots: SpellSlotSummary[];
  spellSlotsGained: SpellSlotGainSummary[];
  spellsKnownGained: number;
  cantripsKnownGained: number;
  maxLearnableSpellLevel: number;
}

export type AutomaticGain = PassiveGain | ActionGain | ResourceGain;

export type DeterministicCoverageLevel = "none" | "baseline" | "detailed";

export interface DeterministicCoverageSummary {
  class: DeterministicCoverageLevel;
  subclass: DeterministicCoverageLevel;
  race: DeterministicCoverageLevel;
}

export interface LevelUpAuditResult {
  /** Whether this class/subclass/race combo is supported deterministically. */
  supported: boolean;
  /** Explicit non-support reason so callers can enforce honest guardrails. */
  unsupportedReason?: "multiclass_unsupported" | "unknown_class" | "missing_level_row";
  /** Coverage quality for class/subclass/race progression in this audit. */
  coverage: DeterministicCoverageSummary;
  newLevel: number;
  proficiencyBonus: number;
  hitDie: number;
  automaticGains: AutomaticGain[];
  choices: ChoiceRequired[];
  optionalReplacements: OptionalReplacement[];
  derivedUpdates: DerivedUpdate[];
  spellcasting?: SpellcastingProgression;
  /** Summary text for the overview screen. */
  summary: string;
}
