import type { EncounterPosition } from "./combatProximity";

/** Plans a bounded displacement only when both combatants have confirmed coordinates. */
export function planNpcTacticalMovement(input: {
  battleId: string; npcId: string; targetIds: readonly string[];
  positions: readonly EncounterPosition[]; speedFeet: number;
  stance: "reposition" | "retreat" | "seek_cover";
}): { xFeet: number; yFeet: number } | null {
  if (input.stance === "seek_cover" || !Number.isFinite(input.speedFeet) ||
      input.speedFeet <= 0 || input.speedFeet > 200) return null;
  const eligible = input.positions.filter(p => p.battleId === input.battleId &&
    (p.source === "dm_confirmed" || p.source === "grid_authority"));
  const start = eligible.find(p => p.combatantId === input.npcId);
  if (!start) return null;
  const nearest = eligible.filter(p => input.targetIds.includes(p.combatantId))
    .map(p => ({ p, distance: Math.hypot(p.xFeet - start.xFeet, p.yFeet - start.yFeet) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest || nearest.distance < 0.01) return null;
  const sign = input.stance === "retreat" ? -1 : 1;
  const step = input.stance === "retreat"
    ? Math.min(input.speedFeet, 30)
    : Math.min(input.speedFeet, Math.max(0, nearest.distance - 5));
  if (step < 0.01) return null;
  const xFeet = start.xFeet + sign * step * (nearest.p.xFeet - start.xFeet) / nearest.distance;
  const yFeet = start.yFeet + sign * step * (nearest.p.yFeet - start.yFeet) / nearest.distance;
  if (!Number.isFinite(xFeet) || !Number.isFinite(yFeet)) return null;
  // A straight-line move is only safe to propose when its endpoint is free.
  // In the absence of a map/pathfinder, do not teleport into occupied space.
  const destinationOccupied = eligible.some(p =>
    p.combatantId !== input.npcId &&
    Math.hypot(p.xFeet - xFeet, p.yFeet - yFeet) < 5
  );
  if (destinationOccupied) return null;
  return { xFeet, yFeet };
}
