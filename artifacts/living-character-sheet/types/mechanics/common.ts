import type {
  MechanicAbility,
  MechanicAttackResolutionType,
  MechanicBonusSource,
  MechanicDamageType,
  MechanicDcSource,
  MechanicDurationUnit,
  MechanicEndRule,
  MechanicOnSaveOutcome,
  MechanicQuantityMode,
  MechanicRangeOrigin,
  MechanicScalingKind,
  MechanicShapeType,
} from "./enums";

export interface QuantitySpec {
  mode: MechanicQuantityMode;
  value: number | null;
}

export interface RangeSpec {
  distanceFeet?: number;
  origin: MechanicRangeOrigin;
  text?: string;
}

export interface ShapeSpec {
  shapeType: MechanicShapeType;
  sizeFeet?: number | null;
  text?: string;
}

export interface DurationSpec {
  unit: MechanicDurationUnit;
  amount?: number | null;
  endRules: MechanicEndRule[];
  text?: string;
}

export interface ScalingSpec {
  kind: MechanicScalingKind;
  value?: number;
  text?: string;
}

export interface DamagePart {
  dice?: string;
  flat?: number;
  damageType: MechanicDamageType;
  scaling?: ScalingSpec;
}

export interface HealingPart {
  dice?: string;
  flat?: number;
  scaling?: ScalingSpec;
}

export interface AttackProfileRef {
  attackType?: MechanicAttackResolutionType;
  attackAbility?: MechanicAbility | "spellcasting";
  bonusSource?: MechanicBonusSource;
  explicitHitBonus?: number | null;
}

export interface SaveProfileRef {
  saveAbility?: MechanicAbility;
  dcSource?: MechanicDcSource;
  explicitDc?: number | null;
  onSave?: MechanicOnSaveOutcome;
}

export interface SummonProfile {
  label: string;
  quantity?: number;
  notes?: string;
}

export interface MechanicProvenance {
  sourceId?: string;
  sourceCollection?: string;
  sourceText?: string;
  createdBy?: "manual" | "parser" | "import";
}