import type { ActiveCondition, ConditionDurationType } from "@/types";

/**
 * Initialize duration metadata safely on a condition.
 * Sets durationType, durationValue, and remainingDuration.
 * No-op if durationType is "manual" or "permanent".
 */
export function initializeConditionDuration(
  condition: ActiveCondition,
  durationType: ConditionDurationType,
  durationValue?: number
): ActiveCondition {
  if (durationType === "manual" || durationType === "permanent") {
    return condition;
  }

  const value = durationValue ?? 1;
  if (value <= 0) return condition;

  return {
    ...condition,
    durationType,
    durationValue: value,
    remainingDuration: value,
    tickTiming: condition.tickTiming ?? "onTargetTurnEnd",
  };
}

/**
 * Normalize condition duration fields.
 * Fixes missing or invalid duration metadata to ensure safe processing.
 */
export function normalizeConditionDuration(condition: ActiveCondition): ActiveCondition {
  const durationType = condition.durationType ?? "manual";
  const durationValue = condition.durationValue ?? 1;
  const remainingDuration =
    condition.remainingDuration !== undefined && condition.remainingDuration > 0
      ? condition.remainingDuration
      : (durationValue > 0 ? durationValue : 1);

  return {
    ...condition,
    durationType,
    durationValue: durationValue > 0 ? durationValue : 1,
    remainingDuration,
    tickTiming: condition.tickTiming ?? "onTargetTurnEnd",
  };
}

/**
 * Determine whether a condition should expire and be removed.
 * Returns true if the condition has reached zero remaining duration.
 */
export function shouldConditionExpire(condition: ActiveCondition): boolean {
  if (condition.durationType === "manual" || condition.durationType === "permanent") {
    return false;
  }
  if (condition.remainingDuration === undefined) return false;
  return condition.remainingDuration <= 0;
}

/**
 * Decrement a condition's remaining duration by one tick.
 * Returns the updated condition and a boolean indicating if it expired.
 */
export function decrementConditionDuration(condition: ActiveCondition): {
  condition: ActiveCondition;
  expired: boolean;
} {
  if (condition.durationType === "manual" || condition.durationType === "permanent") {
    return { condition, expired: false };
  }

  if (condition.remainingDuration === undefined || condition.remainingDuration <= 0) {
    return { condition, expired: false };
  }

  const newRemaining = condition.remainingDuration - 1;
  const expired = newRemaining <= 0;

  return {
    condition: {
      ...condition,
      remainingDuration: newRemaining,
    },
    expired,
  };
}

/**
 * Get human-readable remaining duration display.
 * Returns a string like "2 rounds remaining" or "until short rest".
 * Returns empty string for manual/permanent conditions.
 */
export function getConditionDurationDisplay(condition: ActiveCondition): string {
  const durationType = condition.durationType ?? "manual";

  if (durationType === "manual" || durationType === "permanent") {
    return "";
  }

  if (durationType === "rounds" || durationType === "turns") {
    const remaining = condition.remainingDuration ?? 1;
    const label = durationType === "rounds" ? "round" : "turn";
    return remaining === 1 ? `1 ${label} remaining` : `${remaining} ${label}s remaining`;
  }

  if (durationType === "untilShortRest") {
    return "until short rest";
  }

  if (durationType === "untilLongRest") {
    return "until long rest";
  }

  if (durationType === "encounter") {
    return "until encounter ends";
  }

  if (durationType === "concentration") {
    return "while concentrating";
  }

  return "";
}
