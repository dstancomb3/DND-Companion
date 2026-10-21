import type { QuantitySpec, RangeSpec, ShapeSpec } from "./common";
import type {
  LegalityFilterCategory,
  LegalityOperator,
  MechanicCreatureType,
  MechanicDisposition,
  MechanicSize,
  MechanicTargetIdentity,
  TargetKind,
  TargetSelectionMode,
} from "./enums";

interface LegalityFilterBase<TCategory extends LegalityFilterCategory, TValue> {
  category: TCategory;
  operator: LegalityOperator;
  values: TValue[];
  customLabel?: string;
  notes?: string;
}

export type AllegianceValue = "self" | "ally" | "enemy" | "creature" | "object" | "willing";

export type ConditionStateValue =
  | "blinded"
  | "charmed"
  | "deafened"
  | "exhausted"
  | "frightened"
  | "grappled"
  | "incapacitated"
  | "invisible"
  | "paralyzed"
  | "petrified"
  | "poisoned"
  | "prone"
  | "restrained"
  | "stunned"
  | "unconscious"
  | "hidden"
  | "concentrating"
  | "bloodied"
  | "custom";

export type AllegianceLegalityFilter = LegalityFilterBase<"allegiance", AllegianceValue>;

export type CreatureTypeLegalityFilter = LegalityFilterBase<"creature_type", MechanicCreatureType>;

export type CreatureTagLegalityFilter = LegalityFilterBase<"creature_tag", string>;

export type ConditionStateLegalityFilter = LegalityFilterBase<"condition_state", ConditionStateValue>;

export type SizeLegalityFilter = LegalityFilterBase<"size", MechanicSize>;

export type DispositionLegalityFilter = LegalityFilterBase<"disposition", MechanicDisposition>;

export type TargetIdentityLegalityFilter = LegalityFilterBase<"target_identity", MechanicTargetIdentity>;

export type LegalityFilter =
  | AllegianceLegalityFilter
  | CreatureTypeLegalityFilter
  | CreatureTagLegalityFilter
  | ConditionStateLegalityFilter
  | SizeLegalityFilter
  | DispositionLegalityFilter
  | TargetIdentityLegalityFilter;

export interface TargetSpec {
  selectionMode: TargetSelectionMode;
  targetKinds: TargetKind[];
  quantity: QuantitySpec;
  range?: RangeSpec;
  shape?: ShapeSpec;
  legality?: LegalityFilter[];
  promptText?: string;
  canSelectSelf?: boolean;
  canSelectDuplicates?: boolean;
}