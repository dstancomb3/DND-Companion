import type { DurationSpec, MechanicProvenance, RangeSpec, SaveProfileRef, ScalingSpec, AttackProfileRef } from "./common";
import type { EffectSpec } from "./effects";
import type { ResolutionSpec } from "./resolution";
import type { ResourceCost, UsageLimit } from "./resources";
import type { LegalityFilter, TargetSpec } from "./targets";
import type { TriggerSpec } from "./triggers";
import type { ReviewState } from "./review";
import type {
  MechanicActionSubtype,
  MechanicActionType,
  MechanicActivationType,
  MechanicDefinitionKind,
  MechanicPassiveType,
  MechanicsSchemaVersion,
  MechanicSourceType,
  MechanicReferenceOrigin,
} from "./enums";

export interface MechanicReference {
  mechanicId: string;
  origin?: MechanicReferenceOrigin;
  alias?: string;
}

export interface ActionDefinition {
  actionType: MechanicActionType;
  activation: MechanicActivationType;
  target: TargetSpec;
  resolution: ResolutionSpec;
  effects: EffectSpec[];
  subtype?: MechanicActionSubtype;
  range?: RangeSpec;
  resourceCosts?: ResourceCost[];
  usage?: UsageLimit[];
  legality?: LegalityFilter[];
  duration?: DurationSpec;
  concentration?: boolean;
  attackProfile?: AttackProfileRef;
  saveProfile?: SaveProfileRef;
  scaling?: ScalingSpec;
  grantedBy?: MechanicReference;
  keywords?: string[];
}

export interface PassiveDefinition {
  passiveType: MechanicPassiveType;
  effects: EffectSpec[];
  trigger?: TriggerSpec;
  legality?: LegalityFilter[];
  duration?: DurationSpec;
  notes?: string;
}

interface MechanicDefinitionBase<TKind extends MechanicDefinitionKind> {
  schemaVersion: MechanicsSchemaVersion;
  mechanicId: string;
  kind: TKind;
  name: string;
  sourceType: MechanicSourceType;
  review: ReviewState;
  sourceLabel?: string;
  description?: string;
  tags?: string[];
  provenance?: MechanicProvenance;
  references?: string[];
}

export interface ActionMechanicDefinition extends MechanicDefinitionBase<"action"> {
  action: ActionDefinition;
}

export interface PassiveMechanicDefinition extends MechanicDefinitionBase<"passive"> {
  passive: PassiveDefinition;
}

export type MechanicDefinition = ActionMechanicDefinition | PassiveMechanicDefinition;