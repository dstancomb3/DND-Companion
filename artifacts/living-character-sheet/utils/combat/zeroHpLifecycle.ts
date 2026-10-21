import type { ActiveCondition, DeathSaveState } from "@/types";

export type ZeroHpState = "conscious" | "dying" | "stable" | "dead";

export const DEFAULT_DEATH_SAVE_STATE: DeathSaveState = {
  successes: 0,
  failures: 0,
  stable: false,
  dead: false,
};

export function normalizeDeathSaveState(state: DeathSaveState | undefined): DeathSaveState {
  if (!state) return { ...DEFAULT_DEATH_SAVE_STATE };
  const successes = Math.max(0, Math.min(3, Math.floor(state.successes ?? 0)));
  const failures = Math.max(0, Math.min(3, Math.floor(state.failures ?? 0)));
  const dead = state.dead === true || failures >= 3;
  return {
    successes,
    failures,
    stable: dead ? false : (state.stable === true || successes >= 3),
    dead,
  };
}

export function resetDeathSaveState(): DeathSaveState {
  return { ...DEFAULT_DEATH_SAVE_STATE };
}

export function getZeroHpState(input: {
  currentHp: number;
  deathSaves: DeathSaveState | undefined;
}): ZeroHpState {
  if (Math.max(0, Math.floor(input.currentHp)) > 0) return "conscious";

  const state = normalizeDeathSaveState(input.deathSaves);
  if (state.dead) return "dead";
  if (state.stable) return "stable";
  return "dying";
}

export function recordDeathSaveOutcome(input: {
  previous: DeathSaveState | undefined;
  outcome: "success" | "failure";
}): DeathSaveState {
  const prevState = normalizeDeathSaveState(input.previous);
  if (prevState.stable || prevState.dead) return prevState;

  if (input.outcome === "success") {
    const successes = Math.max(0, Math.min(3, prevState.successes + 1));
    return {
      successes,
      failures: prevState.failures,
      stable: successes >= 3,
      dead: false,
    };
  }

  const failures = Math.max(0, Math.min(3, prevState.failures + 1));

  return {
    successes: prevState.successes,
    failures,
    stable: false,
    dead: failures >= 3,
  };
}

export function stabilizeDeathSaveState(previous: DeathSaveState | undefined): DeathSaveState {
  const prevState = normalizeDeathSaveState(previous);
  if (prevState.dead) return prevState;
  return {
    successes: prevState.successes,
    failures: prevState.failures,
    stable: true,
    dead: false,
  };
}

export function computeDeathSaveStateAfterHpChange(input: {
  previous: DeathSaveState | undefined;
  prevHp: number;
  nextHp: number;
  tookDamageWhileDowned: boolean;
}): DeathSaveState {
  const prevState = normalizeDeathSaveState(input.previous);
  const prevHp = Math.max(0, Math.floor(input.prevHp));
  const nextHp = Math.max(0, Math.floor(input.nextHp));

  if (nextHp > 0) return resetDeathSaveState();

  if (prevHp > 0 && nextHp === 0) {
    return resetDeathSaveState();
  }

  if (nextHp === 0 && input.tookDamageWhileDowned) {
    if (prevState.dead) return prevState;
    const failures = Math.max(0, Math.min(3, prevState.failures + 1));
    return {
      successes: prevState.successes,
      failures,
      stable: false,
      dead: failures >= 3,
    };
  }

  return prevState;
}

export function hasConditionNamed(conditions: ActiveCondition[], conditionName: string): boolean {
  const normalized = conditionName.trim().toLowerCase();
  if (!normalized) return false;
  return conditions.some((condition) => condition.name.trim().toLowerCase() === normalized);
}
