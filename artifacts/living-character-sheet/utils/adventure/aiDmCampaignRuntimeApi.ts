import { API_BASE_URL } from "@/utils/apiUrl";
import type { PartyStatKey } from "@/utils/partyApi";

export interface CampaignRuntimeTurnItemChange {
  action: "consume" | "add" | "remove";
  name: string;
  quantity: number;
}

export interface CampaignRuntimeTurnRollPrompt {
  statKey: "initiative" | "perception" | "dexterity" | "dexterity_save";
  label: string;
}

export interface CampaignRuntimeTurnEncounterIntent {
  requiresEncounterStart: boolean;
  hostileCreatureName: string;
  hostileCreatureSourceType?: "monster";
  hostileCreatureSourceId?: string;
  promptRolls: CampaignRuntimeTurnRollPrompt[];
  narrationBlockedUntilResolved: boolean;
  intentKey: string;
}

export interface CampaignRuntimeTurnAdjudicationRequest {
  statKey: PartyStatKey;
  label: string;
  reason: string;
}

export interface CampaignRuntimeTurnResponse {
  ok: true;
  turn: {
    sessionId: string;
    dmText: string;
    choices: string[];
    stateTags: string[];
    sceneSafety?: { dangerScore: number; shortRestFeasible: boolean; longRestFeasible: boolean; reason: string };
    itemChanges: CampaignRuntimeTurnItemChange[];
    encounterIntent: CampaignRuntimeTurnEncounterIntent | null;
    adjudicationRequests: CampaignRuntimeTurnAdjudicationRequest[];
  };
}

const ALLOWED_ADJUDICATION_STAT_KEYS: Set<PartyStatKey> = new Set<PartyStatKey>([
  "initiative",
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
  "strength_save",
  "dexterity_save",
  "constitution_save",
  "intelligence_save",
  "wisdom_save",
  "charisma_save",
  "acrobatics",
  "animal_handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight_of_hand",
  "stealth",
  "survival",
]);

export class CampaignRuntimeTurnError extends Error {
  readonly code: string;
  readonly statusCode: number | null;
  constructor(input: { message: string; code: string; statusCode?: number | null }) {
    super(input.message);
    this.name = "CampaignRuntimeTurnError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? null;
  }
}

function parsePossiblyJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return { raw: trimmed };
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

function isCampaignRuntimeTurnResponse(value: unknown): value is CampaignRuntimeTurnResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.ok !== true || typeof v.turn !== "object" || v.turn === null) return false;
  const turn = v.turn as Record<string, unknown>;
  return (
    typeof turn.sessionId === "string" &&
    typeof turn.dmText === "string" &&
    Array.isArray(turn.choices) &&
    turn.choices.every((entry) => typeof entry === "string") &&
    Array.isArray(turn.stateTags) &&
    turn.stateTags.every((entry) => typeof entry === "string")
    // itemChanges is optional for backward compat — normalize on read
  );
}

export async function runCampaignRuntimeTurn(input: {
  sessionId: string;
  campaignId: string;
  campaignLabel: string;
  chapterLabel: string;
  difficulty: string;
  stylePreset: string;
  guidance?: string;
  playerInput: string;
  recentEntries: Array<{ role: "system" | "dm" | "player" | "tool"; text: string }>;
}): Promise<CampaignRuntimeTurnResponse> {
  const res = await fetch(`${API_BASE_URL}/api/adventure/campaign-runtime/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const raw = await res.text();
  const data = parsePossiblyJson(raw);

  if (!res.ok) {
    const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
    const message =
      (body && typeof body.error === "string" ? body.error : null) ??
      (body && typeof body.detail === "string" ? body.detail : null) ??
      `Campaign runtime turn failed (${res.status}).`;
    const code = body && typeof body.code === "string" ? body.code : "campaign_runtime_turn_failed";
    throw new CampaignRuntimeTurnError({ message, code, statusCode: res.status });
  }

  if (!isCampaignRuntimeTurnResponse(data)) {
    throw new CampaignRuntimeTurnError({
      message: "Campaign runtime turn returned an unexpected response shape.",
      code: "invalid_response_payload",
      statusCode: res.status,
    });
  }

  // Normalize itemChanges to always be an array
  const normalized: CampaignRuntimeTurnResponse = {
    ...data,
    turn: {
      ...data.turn,
      itemChanges: Array.isArray(data.turn.itemChanges) ? data.turn.itemChanges : [],
      encounterIntent:
        data.turn.encounterIntent?.requiresEncounterStart === true
          ? {
            requiresEncounterStart: true,
            hostileCreatureName: data.turn.encounterIntent.hostileCreatureName || "Hostile Creature",
            ...(data.turn.encounterIntent.hostileCreatureSourceType === "monster"
              && typeof data.turn.encounterIntent.hostileCreatureSourceId === "string"
              && data.turn.encounterIntent.hostileCreatureSourceId.trim().length > 0
              ? {
                hostileCreatureSourceType: "monster" as const,
                hostileCreatureSourceId: data.turn.encounterIntent.hostileCreatureSourceId.trim().slice(0, 120),
              }
              : {}),
            promptRolls: Array.isArray(data.turn.encounterIntent.promptRolls)
              ? data.turn.encounterIntent.promptRolls.filter((entry) =>
                entry.statKey === "initiative" ||
                entry.statKey === "perception" ||
                entry.statKey === "dexterity" ||
                entry.statKey === "dexterity_save",
              )
              : [],
            narrationBlockedUntilResolved:
              data.turn.encounterIntent.narrationBlockedUntilResolved !== false,
            intentKey: data.turn.encounterIntent.intentKey || `intent-${Date.now().toString(36)}`,
          }
          : null,
      adjudicationRequests: Array.isArray((data.turn as Record<string, unknown>).adjudicationRequests)
        ? ((data.turn as Record<string, unknown>).adjudicationRequests as unknown[])
          .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
          .filter((entry) => typeof entry.statKey === "string" && ALLOWED_ADJUDICATION_STAT_KEYS.has(entry.statKey as PartyStatKey))
          .map((entry) => ({
            statKey: entry.statKey as PartyStatKey,
            label: typeof entry.label === "string" && entry.label.trim().length > 0 ? entry.label.trim().slice(0, 100) : "Ability check",
            reason: typeof entry.reason === "string" && entry.reason.trim().length > 0 ? entry.reason.trim().slice(0, 180) : "Outcome is uncertain.",
          }))
          .slice(0, 4)
        : [],
    },
  };
  return normalized;
}
