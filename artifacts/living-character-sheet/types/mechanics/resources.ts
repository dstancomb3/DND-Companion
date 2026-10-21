import type {
  MechanicResourceSpendWhen,
  MechanicResourceType,
  MechanicUsageLimitType,
  MechanicUsageResetType,
  MechanicUsageScope,
} from "./enums";

export interface ResourceCost {
  resourceType: MechanicResourceType;
  amount: number;
  resourceId?: string;
  spendWhen?: MechanicResourceSpendWhen;
  recoveryHint?: string;
}

export interface UsageLimit {
  limitType: MechanicUsageLimitType;
  maxUses: number;
  reset: MechanicUsageResetType;
  linkedResourceId?: string;
  consumesCharges?: boolean;
  per?: MechanicUsageScope;
  sharedPoolKey?: string;
}