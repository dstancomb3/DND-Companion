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

function describeOutcome(row: CombatTargetResolutionResult, targetName: string, seed: string, defeated?: boolean): string {
  const hit = row.hitOutcome;
  if (hit.status === "miss") {
    return pick(seed + ":miss", [
      `The attack misses ${targetName}, passing harmlessly by.`,
      `${targetName} avoids the strike; it fails to connect.`,
      `The blow goes wide of ${targetName}, leaving them untouched.`,
    ]);
  }
  if (hit.status === "unresolved") return `The result against ${targetName} remains unresolved.`;

  const critical = hit.status === "hit" && hit.attackRoll === 20;
  const criticalLead = critical ? "A critical strike! " : "";
  const damage = row.damageBreakdown;
  if (!damage) {
    return hit.status === "hit"
      ? `${criticalLead}The attack connects with ${targetName}, but its effect is not yet established.`
      : `The attack reaches ${targetName}; the outcome is not fully established.`;
  }
  const immune = damage.packets.length > 0 && damage.packets.every(packet => packet.immune || packet.adjustedAmount === 0 && packet.immune);
  const resisted = damage.packets.some(packet => packet.resisted);
  const type = damage.packets.find(packet => packet.damageType)?.damageType;
  const magnitude = damage.hpDamage;
  if (immune && damage.adjustedTotal === 0) return `${criticalLead}The strike connects, but ${targetName} is immune to the damage.`;
  if (magnitude > 0) {
    const impact = pick(seed + ":impact", [
      `The blow lands against ${targetName}`,
      `The attack connects with ${targetName}`,
      `${targetName} takes the impact`,
    ]);
    const result = `${impact}, dealing ${magnitude}${type ? ` ${type}` : ""} damage.`;
    const aftermath = defeated === true ? ` ${targetName} falls, unable to continue the fight.` : "";
    return criticalLead + (resisted ? `${result} Some of the force is resisted.` : result) + aftermath;
  }
  if (damage.tempHpAbsorbed > 0) return `${criticalLead}The hit catches ${targetName}, but ${damage.tempHpAbsorbed} damage is absorbed by temporary protection.`;
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
  sceneContext?: string;
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
  // A committed target may disappear from the active NPC projection on defeat.
  // Missing display metadata must not suppress narration of an accepted attack.
  const affected = [...committed].filter((id): id is string => typeof id === "string" && names.has(id));
  if (!affected.length) return null;
  const targets = affected.map(id => names.get(id) ?? "the target");
  const destination = targets.length === 1 ? targets[0] : targets.join(", ");
  const style = styleForWeapon(input.attackName);
  const gestures: Record<ReturnType<typeof styleForWeapon>, readonly string[]> = {
    blunt: [
      `sweeps the ${input.attackName} toward ${destination} in a sharp arc`,
      `steps into range and drives the ${input.attackName} at ${destination}`,
      `turns into a heavy swing with the ${input.attackName}, aiming for ${destination}`,
    ],
    blade: [
      `slashes toward ${destination} with the ${input.attackName}`,
      `lunges at ${destination}, leading with the ${input.attackName}`,
      `cuts across ${destination}'s guard with the ${input.attackName}`,
    ],
    pierce: [
      `thrusts the ${input.attackName} toward ${destination}`,
      `feints, then drives the ${input.attackName} at ${destination}`,
      `steps forward and jabs at ${destination} with the ${input.attackName}`,
    ],
    ranged: [
      `takes aim at ${destination} and fires the ${input.attackName}`,
      `tracks ${destination} and releases a shot from the ${input.attackName}`,
      `steadies the ${input.attackName} before firing at ${destination}`,
    ],
    unarmed: [
      `closes the distance and strikes at ${destination}`,
      `steps inside ${destination}'s reach and throws a quick blow`,
      `shifts their weight into a sharp strike against ${destination}`,
    ],
    magic: [
      `directs ${input.attackName} toward ${destination}`,
      `channels ${input.attackName} and releases it at ${destination}`,
      `focuses their magic into ${input.attackName}, aimed at ${destination}`,
    ],
    generic: [
      `moves against ${destination} with ${input.attackName}`,
      `commits to a swift ${input.attackName} against ${destination}`,
      `presses forward with ${input.attackName}, targeting ${destination}`,
    ],
  };
  const action = `${input.actorName} ${pick(result.commandId + ":action", gestures[style])}.`;
  const defeatedByTarget = new Map(receipt.targetResults?.filter(row => row.status === "applied" && typeof row.defeated === "boolean").map(row => [row.targetId, row.defeated]) ?? []);
  const details = rows.length
    ? rows.map(row => describeOutcome(row, names.get(row.targetId) ?? "the target", result.commandId + ":" + row.targetId, defeatedByTarget.get(row.targetId))).join(" ")
    : "The action is recorded, but its exact impact has not been confirmed.";
  const scene = (input.sceneContext ?? "").toLowerCase()
    .replace(/\\b(?:no|without|lack of)\\s+(?:rain|downpour|storm|fog|mist|fire|flames|darkness|shadows)\\b/g, "");
  const atmosphere = /\b(rain|downpour|storm)\b/.test(scene) ? "Rain slicks the ground beneath the combatants." :
    /\b(fog|mist)\b/.test(scene) ? "The figures move through the haze." :
    /\b(fire|flames|burning)\b/.test(scene) ? "Firelight flickers across the battlefield." :
    /\b(darkness|torchlight|shadows)\b/.test(scene) ? "The movement cuts across shifting shadows." : "";
  return `${atmosphere ? atmosphere + " " : ""}${action} ${details}`;
}
