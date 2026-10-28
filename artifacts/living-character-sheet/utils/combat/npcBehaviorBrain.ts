import type { NpcAttackChoice, NpcTurnReadiness } from "./npcTurnReadiness";

export type NpcBehaviorProfile = "aggressive" | "cautious" | "sneaky" | "defensive" | "passive";

export interface NpcBrainDecision {
  kind: "attack" | "hold" | "seek_cover" | "retreat" | "reposition";
  choice?: NpcAttackChoice;
  reason: string;
}

/** Characterization from established NPC labels; owners may later override it. */
export function inferNpcBehaviorProfile(input: { name: string; disposition: string }): NpcBehaviorProfile {
  if (input.disposition !== "hostile") return "passive";
  const name = input.name.toLowerCase();
  if (/assassin|rogue|thief|shadow|scout|stalker/.test(name)) return "sneaky";
  if (/sniper|archer|lookout|watcher/.test(name)) return "cautious";
  if (/guardian|protector|defender|shieldbearer|sentinel/.test(name)) return "defensive";
  return "aggressive";
}

/** A tactical *proposal*, not permission to commit an attack or skip initiative. */
export function planNpcBehavior(input: {
  profile: NpcBehaviorProfile;
  readiness: NpcTurnReadiness;
  hpFraction?: number;
  commandSeed: string;
}): NpcBrainDecision {
  const { profile, readiness } = input;
  if (readiness.status === "not_npc_turn") return { kind: "hold", reason: "not_npc_turn" };
  if (readiness.status === "needs_adjudication" && readiness.reason === "incapacitated") {
    return { kind: "hold", reason: "incapacitated" };
  }
  if (profile === "passive") return { kind: "hold", reason: "avoids_hostilities" };
  const hp = input.hpFraction ?? 1;
  if ((profile === "cautious" || profile === "defensive" || profile === "sneaky") && hp <= 0.25) {
    return { kind: "retreat", reason: "preserve_self" };
  }
  // Intention does not confer movement authority; callers must secure a
  // committed spatial action before reporting any change in position.
  if (readiness.status === "needs_adjudication") {
    if (readiness.reason === "no_valid_attack" || readiness.reason === "no_eligible_targets") {
      if (profile === "aggressive") return { kind: "reposition", reason: "close_distance" };
      if (profile === "sneaky") return { kind: "reposition", reason: "seek_sightline" };
      if (profile === "defensive") return { kind: "seek_cover", reason: "avoid_exposure" };
      if (profile === "cautious") return { kind: "retreat", reason: "avoid_unwinnable_exchange" };
    }
    return { kind: "hold", reason: readiness.reason };
  }
  const moodSeed = [...input.commandSeed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  if (profile === "sneaky" && moodSeed % 3 === 0) return { kind: "reposition", reason: "seek_advantage_before_attack" };
  if (profile === "defensive" && moodSeed % 4 === 0) return { kind: "seek_cover", reason: "prioritize_cover" };
  const choices = readiness.choices;
  if (!choices.length) return { kind: "hold", reason: "no_valid_attack" };
  const seed = moodSeed;
  const ranked = [...choices].sort((a, b) => {
    const powerA = a.attackBonus + a.damageModifier;
    const powerB = b.attackBonus + b.damageModifier;
    return profile === "aggressive" ? powerB - powerA : powerA - powerB;
  });
  return { kind: "attack", choice: ranked[seed % Math.min(3, ranked.length)], reason: profile === "aggressive" ? "pressure_target" : "controlled_attack" };
}
