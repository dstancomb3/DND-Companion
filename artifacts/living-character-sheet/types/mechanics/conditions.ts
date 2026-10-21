import type { DurationSpec } from "./common";
import type { MechanicConditionApplication, MechanicConditionIntensity, MechanicConditionName, MechanicEndRule } from "./enums";

export interface ConditionSpec {
  conditionName: MechanicConditionName;
  application: MechanicConditionApplication;
  duration: DurationSpec;
  customLabel?: string;
  intensity?: MechanicConditionIntensity;
  endConditions?: MechanicEndRule[];
  notes?: string;
}