import type { Companion } from "@/types";
import type { CombatNpc, CombatNpcStatKey } from "@/utils/partyApi";

const COMPANION_VISIBLE_STAT_KEYS: CombatNpcStatKey[] = [
  "speed",
  "initiativeBonus",
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

function toInt(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
}

export function parseCompanionSpeedFeet(speed: string | undefined): number {
  if (!speed) return 30;
  const match = speed.match(/\d+/);
  if (!match) return 30;
  const parsed = Number.parseInt(match[0], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return parsed;
}

export function buildCompanionCombatNpcPayload(input: {
  companion: Companion;
  ownerMemberId: string;
  ownerCharacterId: string;
  battleId?: string;
}): Omit<CombatNpc, "id" | "createdAt"> & { battleId?: string } {
  const maxHp = Math.max(1, toInt(input.companion.max_hit_points, 1));
  const currentHp = Math.max(0, Math.min(maxHp, toInt(input.companion.hit_points, maxHp)));
  const dexterity = toInt(input.companion.dexterity, 10);
  const initiativeBonus = Math.floor((dexterity - 10) / 2);

  return {
    name: input.companion.name,
    sourceType: "character",
    sourceId: input.companion.id,
    disposition: "friendly",
    coreStats: {
      speed: parseCompanionSpeedFeet(input.companion.speed),
      initiativeBonus,
      strength: toInt(input.companion.strength, 10),
      dexterity,
      constitution: toInt(input.companion.constitution, 10),
      intelligence: toInt(input.companion.intelligence, 10),
      wisdom: toInt(input.companion.wisdom, 10),
      charisma: toInt(input.companion.charisma, 10),
    },
    visibleStatKeys: COMPANION_VISIBLE_STAT_KEYS,
    dummyState: {
      maxHp,
      currentHp,
      armorClass: Math.max(1, toInt(input.companion.armor_class, 10)),
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      movementUsed: 0,
    },
    conditions: [],
    projection: {
      combatantKind: "companion",
      companionId: input.companion.id,
      ownerMemberId: input.ownerMemberId,
      ownerCharacterId: input.ownerCharacterId,
    },
    battleId: input.battleId,
  };
}
