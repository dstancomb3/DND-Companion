export function shouldBlockStoryInputForPendingRolls(input: {
  isOneOff: boolean;
  pendingTargetedRollCount: number;
}): boolean {
  return input.isOneOff && input.pendingTargetedRollCount > 0;
}
