/**
 * A narrative continuation must follow a confirmed, completed non-encounter roll.
 * Combat initiative and encounter-gated checks are resolved by the battle flow.
 */
export function shouldResumeNarrationAfterRoll(input: {
  confirmed: boolean;
  isInitiative: boolean;
  encounterGateActive: boolean;
  remainingTargetedRolls: number;
}): boolean {
  return input.confirmed && !input.isInitiative && !input.encounterGateActive &&
    input.remainingTargetedRolls === 0;
}
