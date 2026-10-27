import type { NpcAttackChoice, NpcTurnReadiness } from "./npcTurnReadiness";

export type NpcBehaviorProfile = "aggressive" | "cautious" | "sneaky" | "defensive" | "passive";

export interface NpcBrainDecision {
  kind: "attack" | "hold" | "seek_cover" | "retreat" | "reposition";
  choice?: NpcAttackChoice;
  reason: string;
}

/** A tactical *proposal*, not permission to commit an attack or skip initiative. */
export function planNpcBehavior(input: {
  profile: NpcBehaviorProfile;
  readiness: NpcTurnReadiness;
  hpFraction?: number;
  commandSeed: string;
}): NpcBrainDecision {
  const { profile, readiness } = input;
  if (readiness.status !== "ready") {
    return { kind: "hold", reason: readiness.status === "needs_adjudication" ? readiness.reason : "not_npc_turn" };
  }
  if (profile === "passive") return { kind: "hold", reason: "avoids_hostilities" };
  const hp = input.hpFraction ?? 1;
  if ((profile === "cautious" || profile === "defensive" || profile === "sneaky") && hp <= 0.25) {
    return { kind: "retreat", reason: "preserve_self" };
  }
  if (profile === "sneaky") return { kind: "reposition", reason: "seek_advantage_before_attack" };
  if (profile === "defensive") return { kind: "seek_cover", reason: "prioritize_cover" };
  const choices = readiness.choices;
  if (!choices.length) return { kind: "hold", reason: "no_valid_attack" };
  const seed = [...input.commandSeed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const ranked = [...choices].sort((a, b) => {
    const powerA = a.attackBonus + a.damageModifier;
    const powerB = b.attackBonus + b.damageModifier;
    return profile === "aggressive" ? powerB - powerA : powerA - powerB;
  });
  return { kind: "attack", choice: ranked[seed % Math.min(3, ranked.length)], reason: profile === "aggressive" ? "pressure_target" : "controlled_attack" };
}
