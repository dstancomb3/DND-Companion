import type { AttackProfileRef, DamagePart, DurationSpec, HealingPart, SaveProfileRef } from "./common";
import type { ConditionSpec } from "./conditions";
import type { TriggerSpec } from "./triggers";
import type { ReviewState } from "./review";
import type {
  MechanicAdvantageScope,
  MechanicEffectApplication,
  MechanicEffectStacking,
  MechanicEffectType,
  MechanicModifyResourceOperation,
  MechanicMovementDirection,
  MechanicMovementModifierMode,
  MechanicResourceType,
  MechanicUnsupportedReason,
} from "./enums";

interface EffectSpecBase<TType extends MechanicEffectType> {
  effectType: TType;
  duration?: DurationSpec;
  timing?: TriggerSpec;
  saveOverride?: SaveProfileRef;
  attackOverride?: AttackProfileRef;
  application?: MechanicEffectApplication;
  stacking?: MechanicEffectStacking;
  review?: ReviewState;
}

export interface DamageEffectSpec extends EffectSpecBase<"damage"> {
  damage: DamagePart;
}

export interface HealingEffectSpec extends EffectSpecBase<"healing"> {
  heal: HealingPart;
}

export interface ApplyConditionEffectSpec extends EffectSpecBase<"apply_condition"> {
  condition: ConditionSpec;
}

export interface RemoveConditionEffectSpec extends EffectSpecBase<"remove_condition"> {
  removeCondition: {
    conditionName?: string;
    conditionId?: string;
    filterTags?: string[];
  };
}

interface AdvantageModifierSpec {
  scope: MechanicAdvantageScope;
  appliesTo?: string[];
}

export interface GrantAdvantageEffectSpec extends EffectSpecBase<"grant_advantage"> {
  modifier: AdvantageModifierSpec;
}

export interface GrantDisadvantageEffectSpec extends EffectSpecBase<"grant_disadvantage"> {
  modifier: AdvantageModifierSpec;
}

export interface ModifyResourceEffectSpec extends EffectSpecBase<"modify_resource"> {
  resourceDelta: {
    resourceType: MechanicResourceType;
    resourceId?: string;
    amount: number;
    operation: MechanicModifyResourceOperation;
  };
}

export interface ForcedMovementEffectSpec extends EffectSpecBase<"forced_movement"> {
  movement: {
    distanceFeet: number;
    direction: MechanicMovementDirection;
  };
}

export interface MovementModifierEffectSpec extends EffectSpecBase<"movement_modifier"> {
  modifier: {
    mode: MechanicMovementModifierMode;
    amount?: number;
  };
}

export interface CreateAuraEffectSpec extends EffectSpecBase<"create_aura"> {
  aura: {
    radiusFeet: number;
    effects: EffectSpec[];
    duration?: DurationSpec;
  };
}

export interface SummonEntityEffectSpec extends EffectSpecBase<"summon_entity"> {
  summon: {
    label: string;
    quantity?: number;
  };
}

export interface CreateLightEffectSpec extends EffectSpecBase<"create_light"> {
  light: {
    radiusFeet?: number;
    brightFeet?: number;
    dimFeet?: number;
  };
}

export interface NarrativeOnlyEffectSpec extends EffectSpecBase<"narrative_only"> {
  narrative: {
    summary: string;
  };
}

export interface UnsupportedEffectSpec extends EffectSpecBase<"unsupported"> {
  unsupported: {
    reason: MechanicUnsupportedReason;
    rawText: string;
  };
}

export type EffectSpec =
  | DamageEffectSpec
  | HealingEffectSpec
  | ApplyConditionEffectSpec
  | RemoveConditionEffectSpec
  | GrantAdvantageEffectSpec
  | GrantDisadvantageEffectSpec
  | ModifyResourceEffectSpec
  | ForcedMovementEffectSpec
  | MovementModifierEffectSpec
  | CreateAuraEffectSpec
  | SummonEntityEffectSpec
  | CreateLightEffectSpec
  | NarrativeOnlyEffectSpec
  | UnsupportedEffectSpec;