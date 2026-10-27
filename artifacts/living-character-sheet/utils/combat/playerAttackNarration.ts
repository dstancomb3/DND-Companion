import type { CombatActionResult } from "@/types/combatResolution";
import type { CombatTargetResolutionResult } from "@/types/combatOutcome";

function pick(seed: string, choices: readonly string[]): string {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return choices[(hash >>> 0) % choices.length];
}

function styleForWeapon(name: string): "blunt" | "blade" | "pierce" | "ranged" | "unarmed" | "magic" | "generic" {
  const weapon = name.toLowerCase();
  if (/bow|crossbow|sling|firearm|pistol|rifle/.test(weapon)) return "ranged";
  if (/unarmed|fist|punch|kick|claw/.test(weapon)) return "unarmed";
  if (/quarterstaff|staff|club|mace|hammer|maul/.test(weapon)) return "blunt";
  if (/dagger|knife|rapier|spear|lance|pike|javelin/.test(weapon)) return "pierce";
  if (/sword|axe|scimitar|glaive|halberd/.test(weapon)) return "blade";
  if (/spell|bolt|blast|ray|beam|eldritch/.test(weapon)) return "magic";
  return "generic";
}

const motions: Record<ReturnType<typeof styleForWeapon>, readonly string[]> = {
  blunt: ["whips the weapon across in a tight arc", "turns their hips and drives the weapon forward", "brings the weapon down in a controlled sweep"],
  blade: ["draws the edge across the opening", "cuts forward in one clean motion", "twists into a quick, measured slash"],
  pierce: ["feints high, then thrusts into the opening", "drives the point forward", "steps in with a sudden, narrow thrust"],
  ranged: ["steadies their aim and looses the shot", "tracks the movement and releases", "raises the weapon and fires"],
  unarmed: ["darts inside their opponent's reach with a sharp strike", "shifts their weight into a quick punch", "steps close and throws a compact blow"],
  magic: ["focuses the energy into a directed burst", "extends a hand and releases the spell", "sends the gathered magic toward the target"],
  generic: ["commits to a swift attack", "moves into position and strikes", "takes the opening and attacks"],
};

function describeOutcome(row: CombatTargetResolutionResult, targetName: string, seed: string): string {
  const hit = row.hitOutcome;
  if (hit.status === "miss") {
    return pick(seed + ":miss", [
      `The attack misses ${targetName}, passing harmlessly by.`,
      `${targetName} avoids the strike; it fails to connect.`,
      `The blow goes wide of ${targetName}, leaving them untouched.`,
    ]);
  }
  if (hit.status === "unresolved") return `The result against ${targetName} remains unresolved.`;

  const damage = row.damageBreakdown;
  if (!damage) {
    return hit.status === "hit"
      ? `The attack connects with ${targetName}, but its effect is not yet established.`
      : `The attack reaches ${targetName}; the outcome is not fully established.`;
  }
  const immune = damage.packets.length > 0 && damage.packets.every(packet => packet.immune || packet.adjustedAmount === 0 && packet.immune);
  const resisted = damage.packets.some(packet => packet.resisted);
  const type = damage.packets.find(packet => packet.damageType)?.damageType;
  const magnitude = damage.hpDamage;
  if (immune && damage.adjustedTotal === 0) return `The strike connects, but ${targetName} is immune to the damage.`;
  if (magnitude > 0) {
    const impact = pick(seed + ":impact", [
      `The blow lands against ${targetName}`,
      `The attack connects with ${targetName}`,
      `${targetName} takes the impact`,
    ]);
    const result = `${impact}, dealing ${magnitude}${type ? ` ${type}` : ""} damage.`;
    return resisted ? `${result} Some of the force is resisted.` : result;
  }
  if (damage.tempHpAbsorbed > 0) return `The hit catches ${targetName}, but ${damage.tempHpAbsorbed} damage is absorbed by temporary protection.`;
  if (damage.hpHealing && damage.hpHealing > 0) return `The effect restores ${damage.hpHealing} hit points to ${targetName}.`;
  if (damage.adjustedTotal === 0 && damage.rawTotal > 0) return `The strike lands, but no damage gets through ${targetName}'s defenses.`;
  return `The attack connects with ${targetName}, without any confirmed loss of hit points.`;
}

/**
 * Pure, deterministic narration for a remotely acknowledged attack.
 * Never translate a preview, rejected action or a replay into a second story event.
 * The receipt authorizes the affected targets; the engine's resolution describes outcomes.
 */
export function buildConfirmedPlayerAttackNarration(input: {
  actorName: string;
  attackName: string;
  result: CombatActionResult;
  targets: readonly { id: string; name: string }[];
}): string | null {
  const { result } = input;
  const receipt = result.remoteApplication;
  if (result.status !== "accepted" || result.remoteApplicationError || !receipt?.ok || receipt.replayed) return null;
  const committed = new Set(
    receipt.targetResults?.filter(target => target.status === "applied" || target.status === "skipped_noop").map(target => target.targetId)
  );
  if (!committed.size) return null;
  const names = new Map(input.targets.map(target => [target.id, target.name]));
  const rows = (result.targetResults ?? []).filter(target => committed.has(target.targetId));
  const affected = [...committed].filter((id): id is string => typeof id === "string");
  const targets = affected.map(id => names.get(id) ?? "the target");
  const destination = targets.length === 1 ? targets[0] : targets.join(", ");
  const style = styleForWeapon(input.attackName);
  const opening = pick(result.commandId + ":opening", [
    `${input.actorName} shifts their stance, watching ${destination} for an opening.`,
    `${input.actorName} turns toward ${destination} and commits to the exchange.`,
    `With ${destination} in sight, ${input.actorName} moves to strike.`,
    `${input.actorName} measures the distance to ${destination}, then acts.`,
  ]);
  const movement = pick(result.commandId + ":weapon", motions[style]);
  const action = `Using ${input.attackName}, ${input.actorName} ${movement}.`;
  const details = rows.length
    ? rows.map(row => describeOutcome(row, names.get(row.targetId) ?? "the target", result.commandId + ":" + row.targetId)).join(" ")
    : "The action is recorded, but its exact impact has not been confirmed.";
  return `${opening} ${action} ${details}`;
}
