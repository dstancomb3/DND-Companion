import type { DamagePart, HealingPart, SummonProfile } from "./common";
import type { EffectSpec } from "./effects";
import type {
  MechanicAbility,
  MechanicAttackResolutionType,
  MechanicBonusSource,
  MechanicDcSource,
  MechanicOnSaveOutcome,
  MechanicResolutionMode,
  MechanicUtilityKind,
} from "./enums";

interface ResolutionSpecBase<TMode extends MechanicResolutionMode> {
  mode: TMode;
  requiresAttackRoll?: boolean;
  requiresSave?: boolean;
  notes?: string;
}

export interface AttackRollResolutionSpec extends ResolutionSpecBase<"attack_roll"> {
  attackType: MechanicAttackResolutionType;
  attackAbility?: MechanicAbility | "spellcasting";
  proficiencyApplied?: boolean;
  bonusSource?: MechanicBonusSource;
  explicitHitBonus?: number;
  damageParts?: DamagePart[];
}

export interface SavingThrowResolutionSpec extends ResolutionSpecBase<"saving_throw"> {
  saveAbility: MechanicAbility;
  dcSource: MechanicDcSource;
  explicitDc?: number;
  onSave: MechanicOnSaveOutcome;
  successEffects?: EffectSpec[];
  failureEffects?: EffectSpec[];
}

export interface AutoResolutionSpec extends ResolutionSpecBase<"auto"> {
  outcomeEffects?: EffectSpec[];
}

export interface HealResolutionSpec extends ResolutionSpecBase<"heal"> {
  healParts: HealingPart[];
}

export interface UtilityResolutionSpec extends ResolutionSpecBase<"utility"> {
  utilityKind: MechanicUtilityKind;
  outcomeEffects?: EffectSpec[];
}

export interface SummonResolutionSpec extends ResolutionSpecBase<"summon"> {
  summonProfile: SummonProfile;
  outcomeEffects?: EffectSpec[];
}

export interface NoResolutionSpec extends ResolutionSpecBase<"none"> {}

export type ResolutionSpec =
  | AttackRollResolutionSpec
  | SavingThrowResolutionSpec
  | AutoResolutionSpec
  | HealResolutionSpec
  | UtilityResolutionSpec
  | SummonResolutionSpec
  | NoResolutionSpec;