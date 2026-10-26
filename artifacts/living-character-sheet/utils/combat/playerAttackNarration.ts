import type { CombatActionResult } from "@/types/combatResolution";

/** Describe only acknowledged target updates, never promote a preview to a hit. */
export function buildConfirmedPlayerAttackNarration(input: {
  actorName: string; attackName: string; result: CombatActionResult;
  targets: readonly { id: string; name: string }[];
}): string | null {
  const receipt = input.result.remoteApplication;
  if (input.result.status !== "accepted" || input.result.remoteApplicationError ||
      !receipt?.ok || receipt.replayed) return null;
  const ids = new Set(receipt.targetResults?.filter(row => row.status === "applied" || row.status === "skipped_noop").map(row => row.targetId));
  const names = input.targets.filter(target => ids.has(target.id)).map(target => target.name);
  if (!names.length) return null;
  return `${input.actorName} attacks ${names.join(", ")} with ${input.attackName}.${receipt.appliedCount === 0 ? " The attack has no recorded effect." : ""}`;
}
