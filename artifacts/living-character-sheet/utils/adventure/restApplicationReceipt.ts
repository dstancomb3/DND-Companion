/** Crash-aware local rest receipt. Incomplete applications require review rather than blind replay. */
export type RestApplicationPhase = "unstarted" | "applying" | "applied";
export function readRestApplicationPhase(stored: string | null): RestApplicationPhase {
  if (stored === null) return "unstarted";
  if (stored === "applied" || stored === "1") return "applied"; // legacy receipt
  return "applying"; // fail closed on an interrupted or unknown record
}
export function restApplicationNextStep(phase: RestApplicationPhase): "apply" | "ack" | "review" {
  return phase === "unstarted" ? "apply" : phase === "applied" ? "ack" : "review";
}
