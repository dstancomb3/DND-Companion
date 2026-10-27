import type { CombatActionResult } from "@/types/combatResolution";

/** Stable variation: revisiting the same committed action never changes its narration. */
function variant(commandId: string, count: number): number {
  let hash = 2166136261;
  for (let index = 0; index < commandId.length; index++) {
    hash ^= commandId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

function weaponMotion(name: string): string {
  const lower = name.toLowerCase();
  if (/quarterstaff|staff|club|mace|hammer/.test(lower)) return "brings the weapon around in a deliberate arc";
  if (/bow|crossbow/.test(lower)) return "takes aim and releases a shot";
  if (/dagger|knife|rapier|spear/.test(lower)) return "drives forward with a quick thrust";
  if (/sword|axe|scimitar/.test(lower)) return "cuts through the space between them";
  if (/unarmed|fist|punch/.test(lower)) return "steps in close and throws a sharp strike";
  if (/spell|bolt|blast|ray/.test(lower)) return "channels the attack toward the opening";
  return "commits to a measured strike";
}

/** Describe only acknowledged target updates, never promote an attempt to a confirmed hit. */
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

  const subject = names.length === 1 ? names[0] : names.join(", ");
  const openings = [
    `${input.actorName} squares up to ${subject}, watching for the smallest opening.`,
    `${input.actorName} shifts their footing, keeping ${subject} in sight.`,
    `${input.actorName} moves with purpose as ${subject} comes into range.`,
    `${input.actorName} fixes their attention on ${subject} and commits to the attack.`,
    `${input.actorName} closes the moment of hesitation, turning toward ${subject}.`,
  ];
  const movement = weaponMotion(input.attackName);
  const approaches = [
    `With ${input.attackName}, ${input.actorName} ${movement}.`,
    `The ${input.attackName} comes into play as ${input.actorName} ${movement}.`,
    `${input.actorName} ${movement} with ${input.attackName}.`,
  ];
  const outcome = receipt.appliedCount === 0
    ? "The exchange leaves no confirmed change in the target's condition."
    : "The strike resolves, and the encounter shifts with the outcome.";
  return `${openings[variant(input.result.commandId, openings.length)]} ${approaches[variant(input.result.commandId + ":motion", approaches.length)]} ${outcome}`;
}
