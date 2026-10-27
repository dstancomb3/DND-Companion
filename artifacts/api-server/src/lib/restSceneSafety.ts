export type RestSceneSafety = {
  dangerScore: number;
  shortRestFeasible: boolean;
  longRestFeasible: boolean;
  reason: string;
};

/** AI-DM approval gate. A human DM can separately resolve the request. */
export function validateAiRestApproval(restType: "short_rest" | "long_rest", raw: unknown):
  { ok: true; safety: RestSceneSafety } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "Scene safety has not been assessed." };
  const value = raw as Record<string, unknown>;
  if (typeof value.dangerScore !== "number" || !Number.isInteger(value.dangerScore) ||
    value.dangerScore < 0 || value.dangerScore > 100 ||
    typeof value.shortRestFeasible !== "boolean" ||
    typeof value.longRestFeasible !== "boolean" ||
    typeof value.reason !== "string" || !value.reason.trim() || value.reason.length > 500) {
    return { ok: false, reason: "Scene safety assessment is incomplete." };
  }
  const safety: RestSceneSafety = {
    dangerScore: value.dangerScore, shortRestFeasible: value.shortRestFeasible,
    longRestFeasible: value.longRestFeasible, reason: value.reason.trim(),
  };
  const permitted = restType === "short_rest"
    ? safety.shortRestFeasible && safety.dangerScore <= 30
    : safety.longRestFeasible && safety.dangerScore <= 10;
  return permitted ? { ok: true, safety } :
    { ok: false, reason: `Unsafe for ${restType === "short_rest" ? "short" : "long"} rest: ${safety.reason}` };
}
