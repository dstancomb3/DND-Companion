import type { LegalityFilter } from "./targets";
import type { UsageLimit } from "./resources";
import type { MechanicTriggerType } from "./enums";

export interface TriggerSpec {
  triggerType: MechanicTriggerType;
  timing?: string;
  event?: string;
  qualifier?: string;
  limit?: UsageLimit[];
  legality?: LegalityFilter[];
}