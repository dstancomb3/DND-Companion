import { Router, type IRouter } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { partySessions } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hasPartyHostToken } from "../lib/partyHostToken";
import { AI_UPSTREAM_REQUEST_OPTIONS } from "../lib/aiUpstreamRequestOptions";
import { randomUUID } from "node:crypto";

import { startAICallIdempotency, completeAICallIdempotency } from "../lib/aiIdempotencyStore";
import { computeAICallRequestHash } from "../lib/aiIdempotencyHash";
import {
  loadDurableCampaignContinuationSnapshot,
  type CampaignContinuationSnapshotRecord,
} from "../lib/campaignContinuationStore";

import { commitCampaignCheckpoint } from "../lib/commitCampaignCheckpoint";

const router: IRouter = Router();

const ONE_OFF_HANDOFF_INGEST_ENDPOINT = "adventure.oneoff-handoff-ingest";
const CAMPAIGN_SCAFFOLD_INGEST_ENDPOINT = "adventure.campaign-scaffold-ingest";
const CAMPAIGN_CONTINUATION_INGEST_ENDPOINT = "adventure.campaign-continuation-ingest";
const ADVENTURE_CAMPAIGN_TURN_MODEL = process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";
type StartIdempotencyFn = typeof startAICallIdempotency;
type CompleteIdempotencyFn = typeof completeAICallIdempotency;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  if (!apiKey || !baseURL) {
    throw new Error("AI integration is not configured. Missing OpenAI env vars.");
  }
  _openai = new OpenAI({ apiKey, baseURL, ...AI_UPSTREAM_REQUEST_OPTIONS });
  return _openai;
}

let oneOffHandoffRouteStartOverride: StartIdempotencyFn | null = null;
let campaignScaffoldRouteStartOverride: StartIdempotencyFn | null = null;
let campaignContinuationRouteStartOverride: StartIdempotencyFn | null = null;

export function setOneOffHandoffRouteIdempotencyStartOverrideForTests(fn: StartIdempotencyFn | null): void {
  oneOffHandoffRouteStartOverride = fn;
}

export function setCampaignScaffoldRouteIdempotencyStartOverrideForTests(fn: StartIdempotencyFn | null): void {
  campaignScaffoldRouteStartOverride = fn;
}

export function setCampaignContinuationRouteIdempotencyStartOverrideForTests(fn: StartIdempotencyFn | null): void {
  campaignContinuationRouteStartOverride = fn;
}

const oneOffHandoffPayloadSchema = z.object({
  schemaVersion: z.literal("oneoff-handoff.v1"),
  sessionId: z.string().min(1),
  title: z.string().min(1),
  mode: z.literal("one_off"),
  difficulty: z.string().min(1),
  stylePreset: z.string().min(1),
  guidanceSource: z.enum(["user", "fallback"]),
  startInCombat: z.boolean(),
  finalOutcomeStatus: z.enum(["idle", "loot_ready", "encounter_closed"]),
  hasLootPreview: z.boolean(),
  entryCount: z.number().int().min(0),
  closedAt: z.number().int().positive().optional(),
});

export const oneOffHandoffIngestRequestSchema = z.object({
  handoff: oneOffHandoffPayloadSchema,
  recapLines: z.array(z.string().min(1)).max(24),
  clientSavedAt: z.number().int().positive(),
});

export type OneOffHandoffIngestRequest = z.infer<typeof oneOffHandoffIngestRequestSchema>;

const campaignScaffoldPayloadSchema = z.object({
  schemaVersion: z.literal("campaign-scaffold.v1"),
  sessionId: z.string().min(1),
  campaignId: z.string().min(1),
  campaignLabel: z.string().min(1),
  chapterLabel: z.string().min(1),
  mode: z.literal("campaign_scaffold"),
  difficulty: z.string().min(1),
  stylePreset: z.string().min(1),
  guidanceSource: z.enum(["user", "fallback"]),
  entryCount: z.number().int().min(0),
  scaffoldStatus: z.enum(["active", "checkpoint"]),
});

const campaignScaffoldIngestRequestSchema = z.object({
  scaffold: campaignScaffoldPayloadSchema,
  recapLines: z.array(z.string().min(1)).max(32),
  clientSavedAt: z.number().int().positive(),
});

export type CampaignScaffoldIngestRequest = z.infer<typeof campaignScaffoldIngestRequestSchema>;

const campaignContinuationPayloadSchema = z.object({
  schemaVersion: z.literal("campaign-continuation.v1"),
  sessionId: z.string().min(1),
  campaignId: z.string().min(1),
  campaignLabel: z.string().min(1),
  chapterLabel: z.string().min(1),
  mode: z.literal("campaign_continuation"),
  difficulty: z.string().min(1),
  stylePreset: z.string().min(1),
  guidanceSource: z.enum(["user", "fallback"]),
  entryCount: z.number().int().min(0),
  checkpointIndex: z.number().int().min(0),
  continuityStatus: z.enum(["active", "checkpoint", "chapter_complete"]),
  progressSummary: z.string().min(1),
});

const campaignContinuationIngestRequestSchema = z.object({
  continuation: campaignContinuationPayloadSchema,
  recapLines: z.array(z.string().min(1)).max(40),
  clientSavedAt: z.number().int().positive(),
  expectedSubmissionId: z.string().min(1).nullable().optional(),
});

const campaignRuntimeTurnRequestSchema = z.object({
  sessionId: z.string().min(1),
  campaignId: z.string().min(1),
  campaignLabel: z.string().min(1),
  chapterLabel: z.string().min(1),
  difficulty: z.string().min(1),
  stylePreset: z.string().min(1),
  guidance: z.string().max(800).optional(),
  playerInput: z.string().min(1).max(600),
  recentEntries: z.array(z.object({
    role: z.enum(["system", "dm", "player", "tool"]),
    text: z.string().min(1).max(1500),
  })).max(30),
});

type CampaignRuntimeTurnRequest = z.infer<typeof campaignRuntimeTurnRequestSchema>;

type CampaignRuntimeTurnItemChange = {
  action: "consume" | "add" | "remove";
  name: string;
  quantity: number;
};

type CampaignRuntimeTurnRollPrompt = {
  statKey: "initiative" | "perception" | "dexterity" | "dexterity_save";
  label: string;
};

type CampaignRuntimeTurnEncounterIntent = {
  requiresEncounterStart: boolean;
  hostileCreatureName: string;
  hostileCreatureCount?: number;
  hostileCreatureSourceType?: "monster";
  hostileCreatureSourceId?: string;
  promptRolls: CampaignRuntimeTurnRollPrompt[];
  narrationBlockedUntilResolved: boolean;
  intentKey: string;
};

type CampaignRuntimeTurnAdjudicationStatKey =
  | "initiative"
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma"
  | "strength_save"
  | "dexterity_save"
  | "constitution_save"
  | "intelligence_save"
  | "wisdom_save"
  | "charisma_save"
  | "acrobatics"
  | "animal_handling"
  | "arcana"
  | "athletics"
  | "deception"
  | "history"
  | "insight"
  | "intimidation"
  | "investigation"
  | "medicine"
  | "nature"
  | "perception"
  | "performance"
  | "persuasion"
  | "religion"
  | "sleight_of_hand"
  | "stealth"
  | "survival";

type CampaignRuntimeTurnAdjudicationRequest = {
  statKey: CampaignRuntimeTurnAdjudicationStatKey;
  label: string;
  reason: string;
};

function isGenericHostileLabel(name: string): boolean {
  const lowered = name.trim().toLowerCase();
  return lowered === "unknown beast" || lowered === "unknown creature" || lowered === "hostile creature";
}

function isLikelyExplorationInput(playerInput: string): boolean {
  const lowered = playerInput.trim().toLowerCase();
  if (!lowered) return false;
  const explorationHints = ["inspect", "investigate", "identify", "observe", "study", "examine", "look", "watch", "sneak", "retreat", "reason", "talk"];
  const directCombatHints = ["attack", "strike", "shoot", "stab", "charge", "cast", "fight", "swing", "lunge"];
  if (directCombatHints.some((hint) => lowered.includes(hint))) return false;
  return explorationHints.some((hint) => lowered.includes(hint));
}

type CampaignRuntimeTurnResponse = {
  ok: true;
  turn: {
    sessionId: string;
    dmText: string;
    choices: string[];
    stateTags: string[];
    sceneSafety: { dangerScore: number; shortRestFeasible: boolean; longRestFeasible: boolean; reason: string };
    itemChanges: CampaignRuntimeTurnItemChange[];
    encounterIntent: CampaignRuntimeTurnEncounterIntent | null;
    adjudicationRequests: CampaignRuntimeTurnAdjudicationRequest[];
  };
};

export type CampaignContinuationIngestRequest = z.infer<typeof campaignContinuationIngestRequestSchema>;

export function parseOneOffHandoffIngestRequest(body: unknown):
  | { ok: true; value: OneOffHandoffIngestRequest }
  | { ok: false; error: string } {
  const parsed = oneOffHandoffIngestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid handoff payload." };
  }
  return { ok: true, value: parsed.data };
}

export function parseCampaignScaffoldIngestRequest(body: unknown):
  | { ok: true; value: CampaignScaffoldIngestRequest }
  | { ok: false; error: string } {
  const parsed = campaignScaffoldIngestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign scaffold payload." };
  }
  return { ok: true, value: parsed.data };
}

export function parseCampaignContinuationIngestRequest(body: unknown):
  | { ok: true; value: CampaignContinuationIngestRequest }
  | { ok: false; error: string } {
  const parsed = campaignContinuationIngestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign continuation payload." };
  }
  return { ok: true, value: parsed.data };
}

function parseCampaignRuntimeTurnRequest(body: unknown):
  | { ok: true; value: CampaignRuntimeTurnRequest }
  | { ok: false; error: string } {
  const parsed = campaignRuntimeTurnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign runtime turn payload." };
  }
  return { ok: true, value: parsed.data };
}

function coerceStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, max);
}

function toStableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

export function buildStableEncounterIntentKey(input: {
  sessionId: string;
  playerInput: string;
  hostileCreatureName: string;
  promptRolls: CampaignRuntimeTurnRollPrompt[];
}): string {
  const source = [
    input.sessionId.trim().toLowerCase(),
    input.playerInput.trim().toLowerCase(),
    input.hostileCreatureName.trim().toLowerCase(),
    input.promptRolls.map((r) => `${r.statKey}:${r.label.trim().toLowerCase()}`).join("|"),
  ].join("::");
  return `enc-${toStableHash(source)}`;
}

export function normalizeCampaignRuntimeEncounterIntent(input: {
  rawEncounterIntent: Record<string, unknown> | null;
  sessionId: string;
  playerInput: string;
}): CampaignRuntimeTurnEncounterIntent | null {
  const allowedStatKeys = new Set<CampaignRuntimeTurnRollPrompt["statKey"]>([
    "initiative",
    "perception",
    "dexterity",
    "dexterity_save",
  ]);

  const promptRolls: CampaignRuntimeTurnRollPrompt[] = Array.isArray(input.rawEncounterIntent?.promptRolls)
    ? input.rawEncounterIntent.promptRolls
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .filter((entry) => typeof entry.statKey === "string" && allowedStatKeys.has(entry.statKey as CampaignRuntimeTurnRollPrompt["statKey"]))
      .map((entry) => ({
        statKey: entry.statKey as CampaignRuntimeTurnRollPrompt["statKey"],
        label: typeof entry.label === "string" && entry.label.trim().length > 0 ? entry.label.trim().slice(0, 80) : "Check",
      }))
      .slice(0, 4)
    : [];

  if (!input.rawEncounterIntent || input.rawEncounterIntent.requiresEncounterStart !== true) {
    return null;
  }

  const hostileCreatureName =
    typeof input.rawEncounterIntent.hostileCreatureName === "string" && input.rawEncounterIntent.hostileCreatureName.trim().length > 0
      ? input.rawEncounterIntent.hostileCreatureName.trim().slice(0, 80)
      : "Hostile Creature";

  if (isLikelyExplorationInput(input.playerInput) && isGenericHostileLabel(hostileCreatureName)) {
    return null;
  }

  const hostileCreatureSourceType =
    input.rawEncounterIntent.hostileCreatureSourceType === "monster"
      ? "monster"
      : undefined;
  const hostileCreatureSourceId =
    hostileCreatureSourceType === "monster" && typeof input.rawEncounterIntent.hostileCreatureSourceId === "string"
      ? input.rawEncounterIntent.hostileCreatureSourceId.trim().slice(0, 120)
      : "";

  const fallbackIntentKey = buildStableEncounterIntentKey({
    sessionId: input.sessionId,
    playerInput: input.playerInput,
    hostileCreatureName,
    promptRolls,
  });

  return {
    requiresEncounterStart: true,
    hostileCreatureName,
    hostileCreatureCount: typeof input.rawEncounterIntent.hostileCreatureCount === "number" && Number.isInteger(input.rawEncounterIntent.hostileCreatureCount)
      ? Math.max(1, Math.min(8, input.rawEncounterIntent.hostileCreatureCount)) : 1,
    ...(hostileCreatureSourceType && hostileCreatureSourceId
      ? {
        hostileCreatureSourceType,
        hostileCreatureSourceId,
      }
      : {}),
    promptRolls,
    narrationBlockedUntilResolved: input.rawEncounterIntent.narrationBlockedUntilResolved !== false,
    intentKey:
      typeof input.rawEncounterIntent.intentKey === "string" && input.rawEncounterIntent.intentKey.trim().length > 0
        ? input.rawEncounterIntent.intentKey.trim().slice(0, 120)
        : fallbackIntentKey,
  };
}

type CanonicalEncounterActor = {
  npcId: string;
  name: string;
  sourceType: "manual" | "monster";
  sourceId?: string;
};

function normalizeActorName(value: string): string {
  return value.trim().toLowerCase();
}

export function parseCanonicalEncounterActorsFromRecentEntries(
  recentEntries: CampaignRuntimeTurnRequest["recentEntries"],
): CanonicalEncounterActor[] {
  const actors: CanonicalEncounterActor[] = [];
  const seen = new Set<string>();

  for (const entry of recentEntries) {
    if (entry.role !== "system") continue;
    const text = entry.text;
    if (!(text.includes("CURRENT HOSTILE ACTORS:") || text.includes("KNOWN ENCOUNTER ACTORS:"))) continue;

    const matches = text.matchAll(/([^\s=|]+)=([^\[]+)\[([^\]]+)\]/g);
    for (const match of matches) {
      const npcId = (match[1] ?? "").trim();
      const name = (match[2] ?? "").trim();
      const sourceToken = (match[3] ?? "").trim();
      if (!npcId || !name || !sourceToken) continue;

      let sourceType: "manual" | "monster" = "manual";
      let sourceId: string | undefined;
      if (sourceToken.startsWith("monster:")) {
        sourceType = "monster";
        const parsedSourceId = sourceToken.slice("monster:".length).trim();
        sourceId = parsedSourceId.length > 0 ? parsedSourceId : undefined;
      }

      const key = `${npcId}::${sourceType}::${sourceId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      actors.push({ npcId, name, sourceType, sourceId });
    }
  }

  return actors;
}

export function alignEncounterIntentWithCanonicalActors(input: {
  encounterIntent: CampaignRuntimeTurnEncounterIntent | null;
  canonicalActors: CanonicalEncounterActor[];
}): CampaignRuntimeTurnEncounterIntent | null {
  const encounterIntent = input.encounterIntent;
  if (!encounterIntent || input.canonicalActors.length === 0) return encounterIntent;

  const intentSourceType = encounterIntent.hostileCreatureSourceType;
  const intentSourceId = encounterIntent.hostileCreatureSourceId?.trim();

  const matchedBySource =
    intentSourceType === "monster" && typeof intentSourceId === "string" && intentSourceId.length > 0
      ? input.canonicalActors.find((actor) => actor.sourceType === "monster" && actor.sourceId === intentSourceId)
      : undefined;

  const matchedByName = matchedBySource
    ? matchedBySource
    : input.canonicalActors.find((actor) => normalizeActorName(actor.name) === normalizeActorName(encounterIntent.hostileCreatureName));

  if (!matchedByName) return encounterIntent;

  return {
    ...encounterIntent,
    hostileCreatureName: matchedByName.name,
    ...(matchedByName.sourceType === "monster" && matchedByName.sourceId
      ? {
        hostileCreatureSourceType: "monster" as const,
        hostileCreatureSourceId: matchedByName.sourceId,
      }
      : {
        hostileCreatureSourceType: encounterIntent.hostileCreatureSourceType,
        hostileCreatureSourceId: encounterIntent.hostileCreatureSourceId,
      }),
  };
}

function normalizeCampaignRuntimeAdjudicationRequests(value: unknown): CampaignRuntimeTurnAdjudicationRequest[] {
  const allowedStatKeys = new Set<CampaignRuntimeTurnAdjudicationStatKey>([
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

  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .filter((entry) => typeof entry.statKey === "string" && allowedStatKeys.has(entry.statKey as CampaignRuntimeTurnAdjudicationStatKey))
    .map((entry) => ({
      statKey: entry.statKey as CampaignRuntimeTurnAdjudicationStatKey,
      label: typeof entry.label === "string" && entry.label.trim().length > 0 ? entry.label.trim().slice(0, 100) : "Ability check",
      reason: typeof entry.reason === "string" && entry.reason.trim().length > 0 ? entry.reason.trim().slice(0, 180) : "Outcome is uncertain.",
    }))
    .slice(0, 4);
}

async function runCampaignRuntimeTurn(input: CampaignRuntimeTurnRequest): Promise<CampaignRuntimeTurnResponse> {
  const recentTranscript = input.recentEntries
    .slice(-10)
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`)
    .join("\n");

  const dmCount = input.recentEntries.filter((e) => e.role === "dm").length;
  const playerCount = input.recentEntries.filter((e) => e.role === "player").length;
  const isKickoff = dmCount === 0;
  const isPrologueTransition = dmCount === 1 && playerCount === 0; // auto second turn

  let systemPrompt: string;
  let userPrompt: string;

  if (isKickoff) {
    // Randomly pick an opening angle so each prologue feels structurally different
    const openingAngles = [
      "Start IN MOTION — the character is already doing something physical (riding, running, climbing, eating at a fire). Drop us mid-action, then pull back to paint the world around them.",
      "Start WITH A SOUND or SMELL before the visual — let the player's senses arrive before their eyes adjust. Build the setting from sensation outward.",
      "Start WITH A STRANGER — someone or something the character notices before anything else is revealed. Who is this person, what are they doing, why does it matter?",
      "Start WITH A MEMORY OR RUMOR — a line someone told the character, a story they heard, a scar they carry. Let the past bleed into the present moment.",
      "Start WITH THE WORLD'S MOOD — weather, light, the behavior of animals or crowds — as if the world itself knows something the character doesn't yet.",
      "Start WITH AN OBJECT — something the character holds, finds, or sees that immediately raises a question. Let curiosity do the work before tension arrives.",
      "Start WITH THE CHARACTER'S BODY — exhaustion, hunger, a wound half-healed, the weight of armor. Ground us in physical reality before the larger world comes into focus.",
    ];
    const chosenAngle = openingAngles[Math.floor(Math.random() * openingAngles.length)];

    systemPrompt = [
      "You are an expert D&D 5e Dungeon Master opening a brand new session.",
      "Write ONLY the opening prologue. Do NOT present any choices yet.",
      "",
      `OPENING ANGLE FOR THIS SESSION: ${chosenAngle}`,
      "",
      "Using that angle, write 3 paragraphs that together establish:",
      "- Where & when this is happening (setting, time, atmosphere)",
      "- Who the player character is and why they are here",
      "- A moment of tension or strangeness that closes the prologue on an unresolved note",
      "",
      "Rules:",
      "- Present tense. Literary, immersive prose. No game mechanics, no numbered lists.",
      "- Each prologue must feel like the first paragraph of a different book — not a formula.",
      "- Vary sentence length. Use the senses. Make it specific, not generic.",
      "- The Session Setup is authoritative. Only use facts explicitly present there for appearance, gear, possessions, and capabilities.",
      "- Do not infer weapons, armor, packs, holy symbols, mounts, or other visible equipment from class, background, or archetype alone.",
      "- If the Session Setup says the inventory is empty, do not describe worn or carried gear.",
      "- If a physical detail is unknown, leave it undescribed instead of inventing it.",
      "- Never repeat Session Setup verbatim and never output a raw stat/inventory dump.",
      "- Do not start dmText with labels like 'Character:' or 'Session Setup:'.",
      "- Final consistency check before output: remove any gear or item references not present in Session Setup.",
      "",
      "Return ONLY valid JSON — no markdown, no code fences:",
      '{"dmText":"...","choices":[],"stateTags":["..."],"encounterIntent":null}',
      "",
      "- dmText: 3 paragraphs separated by \\n\\n. Total 130-220 words.",
      "- choices: MUST be empty array []",
      "- stateTags: 1-3 mood tags from: tension, exploration, mystery, social, foreboding, discovery.",
      "- encounterIntent: MUST be null in kickoff prologue turns.",
    ].join("\n");

    userPrompt = [
      `Style: ${input.stylePreset} | Difficulty: ${input.difficulty}`,
      input.guidance?.trim() ? `Session Setup: ${input.guidance.trim()}` : "Begin an original D&D 5e session.",
    ].join("\n\n");

  } else if (isPrologueTransition) {
    const incitingAngles = [
      "A SUDDEN INTERRUPTION — something breaks the calm without warning. No build-up. Just: it happens.",
      "A SLOW REVEAL — something has been wrong for a moment, and the character only now realizes it. Creeping dread.",
      "A STRANGER ARRIVES — someone approaches with urgency, fear, or a weapon drawn. Their first words matter.",
      "SOMETHING IS MISSING — an absence that shouldn't be there. Silence where there should be sound. A door open that should be locked.",
      "AN APPEAL — someone or something needs the character's help right now, with no time to think.",
      "A THREAT MADE VISIBLE — the danger the prologue hinted at steps fully into the light.",
    ];
    const chosenInciting = incitingAngles[Math.floor(Math.random() * incitingAngles.length)];

    systemPrompt = [
      "You are an expert D&D 5e Dungeon Master. The opening scene has just been set.",
      "Now write the inciting incident — the moment the world demands a response.",
      "",
      `INCITING ANGLE FOR THIS BEAT: ${chosenInciting}`,
      "",
      "Write 2 punchy paragraphs:",
      "1. The incident itself — immediate, specific, no hedging. Drop us into it.",
      "2. The pressure it creates — what does the character now face? End with the moment frozen at peak tension.",
      "",
      "Then give 2-3 choices that feel meaningfully different in approach (aggressive / cautious / lateral).",
      "",
      "Grounding rules:",
      "- The Session Setup is authoritative. Use only facts explicitly present there for character description and gear.",
      "- Do not infer weapons, armor, or carried gear from class or archetype if they are not stated.",
      "- If the Session Setup says the inventory is empty, do not describe the character as visibly armed or equipped.",
      "- If a detail is unknown, leave it undescribed instead of inventing it.",
      "- Never repeat Session Setup verbatim and never output a raw stat/inventory dump.",
      "- Do not start dmText with labels like 'Character:' or 'Session Setup:'.",
      "- Final consistency check before output: remove any gear or item references not present in Session Setup.",
      "",
      "Return ONLY valid JSON — no markdown, no code fences:",
      '{"dmText":"...","choices":["...","...","..."],"stateTags":["..."],"encounterIntent":null}',
      "",
      "- dmText: 2 paragraphs separated by \\n\\n. Present tense. 60-110 words.",
      "- choices: 2-3 options, each 4-10 words.",
      "- stateTags: 1-4 tags from: tension, exploration, social, combat_risk, chase, puzzle, trap, negotiation, discovery.",
      "- sceneSafety: object with dangerScore (integer 1-100), shortRestFeasible (boolean), longRestFeasible (boolean), reason (one short sentence). Assess the actual situation AFTER narrating this turn; active combat, falling/flying unprotected, pursuit, imminent threats or unstable ground are unsafe. Long rest requires a secure location and sufficient uninterrupted time. Do not claim a rest happened.",
      "- encounterIntent: set null unless immediate hostile encounter setup is explicitly required.",
    ].join("\n");

    userPrompt = [
      `Style: ${input.stylePreset} | Difficulty: ${input.difficulty}`,
      input.guidance?.trim() ? `Session Setup: ${input.guidance.trim()}` : null,
      recentTranscript ? `Prologue:\n${recentTranscript}` : null,
    ].filter(Boolean).join("\n\n");

  } else {
    systemPrompt = [
      "You are an expert D&D 5e Dungeon Master running a live session.",
      "",
      "Each turn:",
      "1. Show the consequence of the player's last action — what changed, what happened.",
      "2. Describe the new situation with sensory detail.",
      "3. Introduce or escalate a pressure, threat, or discovery.",
      "4. End on a moment that demands a choice.",
      "",
      "Give 2-3 distinct choices. Honor continuity. Never repeat a choice already taken.",
      "",
      "INVENTORY RULES (CRITICAL):",
      "- A CURRENT INVENTORY system entry will be present in the context. This is the player's real item list.",
      "- The Session Setup is authoritative for baseline character facts. If it does not mention a weapon, armor piece, or item, do not invent one.",
      "- If the player attempts to use, consume, or rely on an item NOT in that inventory, narrate that they don't have it.",
      "- Do not invent items the player doesn't own. Do not allow potion use if they have no potions.",
      "- If CURRENT INVENTORY says there are no items, do not describe visible carried or worn gear unless it was explicitly acquired during play.",
      "- If an item has a quantity (e.g. x2), each use reduces that count — narrate accordingly.",
      "- When an item is consumed or lost, note it clearly in your dmText (e.g. 'You use your last healing potion.').",
      "- Final consistency check before output: remove any gear or item references not present in Session Setup or CURRENT INVENTORY.",
      "",
      "COMBAT-FLOW RULES (CRITICAL):",
      "- Emit encounterIntent only for immediate hostile engagement that has already begun this beat (for example a direct attack/lunge/exchange).",
      "- Do NOT emit encounterIntent for mere suspicion, distant growls, tracking, inspection, social probing, or identification beats.",
      "- In that case, do not narrate completed attack outcomes yet. Stop at imminent danger.",
      "- Include promptRolls needed now. Use initiative for turn order, perception for awareness checks, and dexterity or dexterity_save for evade moments.",
      "- When the hostile creature is known from the monster compendium, include hostileCreatureSourceType=\"monster\" and hostileCreatureSourceId with the exact compendium id.",
      "- If the compendium id is unknown, omit hostileCreatureSourceType/hostileCreatureSourceId and provide only hostileCreatureName.",
      "- For groups, set hostileCreatureCount to the number of hostiles actually entering combat (1 to 8). A pack must not be represented by only its leader. Use 1 for a solo creature.",
      "- A CURRENT HOSTILE ACTORS or KNOWN ENCOUNTER ACTORS system entry may be present. Treat those actor identities as canonical continuity anchors.",
      "- Do not rename, split, merge, or replace canonical hostile actors unless encounterIntent explicitly starts a new hostile arrival.",
      "- If no new hostile arrival occurs this turn, continue with existing hostile actor identities in context.",
      "- Do not emit encounterIntent for an already-active hostile unless you are explicitly escalating with a new immediate hostile arrival.",
      "- Never force initiative repeatedly for the same active hostile encounter unless a new hostile arrival changes battle state.",
      "",
      "ADJUDICATION RULES (CRITICAL):",
      "- If the player asks to identify, recall, notice, track, inspect, or otherwise learn uncertain information, emit adjudicationRequests instead of silently deciding success.",
      "- Use one request per needed check with the best-fit DnD stat/skill key (for example: nature, arcana, history, insight, investigation, perception, survival).",
      "- Keep DM narration consistent with uncertainty while waiting on rolls. Do not claim certain success or failure for those checks yet.",
      "",
      "Return ONLY valid JSON — no markdown, no code fences:",
      '{"dmText":"...","choices":["...","...","..."],"stateTags":["..."],"itemChanges":[],"encounterIntent":null,"adjudicationRequests":[]}',
      "",
      "- dmText: 3-5 sentences, present tense.",
      "- Only act upon creatures established in the current story or an explicitly narrated discovery. A player declaring an attack against an unseen or unintroduced creature does NOT create that creature. Explain what is actually visible; do not create an encounterIntent just to satisfy an attack declaration.",
      "- choices: 2-3 options, each 4-10 words.",
      "- stateTags: 1-4 tags from: tension, exploration, social, combat_risk, chase, puzzle, trap, negotiation, discovery.",
      '- itemChanges: array of item mutations this turn. Each entry: {"action":"consume"|"add"|"remove","name":"item name","quantity":1}.',
      "  'consume' = item used/expended from inventory. 'add' = loot found or item given. 'remove' = item lost/stolen/destroyed.",
      "  Match item names exactly as they appear in CURRENT INVENTORY. Empty array [] if no items changed.",
      '  - encounterIntent: null if no immediate hostile encounter setup is required, else {"requiresEncounterStart":true,"hostileCreatureName":"...","hostileCreatureCount":1,"hostileCreatureSourceType":"monster"?,"hostileCreatureSourceId":"compendium-id"?,"promptRolls":[{"statKey":"initiative"|"perception"|"dexterity"|"dexterity_save","label":"..."}],"narrationBlockedUntilResolved":true,"intentKey":"short-stable-key"}.',
      '  - adjudicationRequests: [] when no extra checks are needed. Otherwise: [{"statKey":"nature"|"arcana"|"history"|"insight"|"investigation"|"perception"|"survival"|"...","label":"short check label","reason":"why this roll is required now"}].',
    ].join("\n");

    userPrompt = [
      `Style: ${input.stylePreset} | Difficulty: ${input.difficulty}`,
      input.guidance?.trim() ? `Session Setup: ${input.guidance.trim()}` : null,
      recentTranscript ? `Recent Transcript:\n${recentTranscript}` : null,
      `Player Action: ${input.playerInput}`,
    ].filter(Boolean).join("\n\n");
  }

  // JSON mode prevents markdown fences and free-form prose from breaking turns.
  // A bounded retry covers incomplete responses, including token truncation.
  let parsed: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await getOpenAI().chat.completions.create({
      model: ADVENTURE_CAMPAIGN_TURN_MODEL,
      response_format: { type: "json_object" },
      max_completion_tokens: 2200,
      temperature: attempt === 0 ? (isKickoff || isPrologueTransition ? 0.8 : 0.55) : 0.2,
      messages: [
        { role: "system", content: systemPrompt + "\\nAlways return a single syntactically valid JSON object, never markdown." },
        { role: "user", content: userPrompt },
        ...(attempt ? [{ role: "user" as const, content: "The previous answer could not be parsed. Return the full, complete JSON object only." }] : []),
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    try {
      const candidate: unknown = JSON.parse(raw);
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate) &&
          typeof (candidate as Record<string, unknown>).dmText === "string" &&
          (candidate as Record<string, unknown>).dmText) {
        parsed = candidate;
        break;
      }
    } catch { /* Retry once, without returning invalid content to the player. */ }
  }
  if (!parsed) throw new Error("The DM response was incomplete or malformed after retry. Please try the action again.");

  const parsedRecord = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null;
  const dmText = (parsedRecord && typeof parsedRecord.dmText === "string" ? parsedRecord.dmText : "").trim();
  if (!dmText) {
    throw new Error("AI response missing dmText.");
  }

  const choices = coerceStringArray(parsedRecord?.choices, 3);
  const stateTags = coerceStringArray(parsedRecord?.stateTags, 6);
  const safety = parsedRecord?.sceneSafety && typeof parsedRecord.sceneSafety === "object" ? parsedRecord.sceneSafety as Record<string, unknown> : {};
  const dangerScore = typeof safety.dangerScore === "number" && Number.isFinite(safety.dangerScore) ? Math.min(100, Math.max(1, Math.round(safety.dangerScore))) : 100;
  const sceneSafety = {
    dangerScore,
    shortRestFeasible: safety.shortRestFeasible === true && dangerScore <= 30,
    longRestFeasible: safety.longRestFeasible === true && dangerScore <= 10,
    reason: typeof safety.reason === "string" ? safety.reason.slice(0, 200) : "The situation has not been assessed for a safe rest.",
  };

  // Parse itemChanges from AI output
  const rawItemChanges = Array.isArray(parsedRecord?.itemChanges) ? parsedRecord.itemChanges : [];
  const itemChanges: CampaignRuntimeTurnItemChange[] = rawItemChanges
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .filter((c) => (c.action === "consume" || c.action === "add" || c.action === "remove") && typeof c.name === "string" && c.name.length > 0)
    .map((c) => ({
      action: c.action as "consume" | "add" | "remove",
      name: String(c.name).trim(),
      quantity: typeof c.quantity === "number" && c.quantity > 0 ? Math.floor(c.quantity) : 1,
    }));

  const rawEncounterIntent =
    parsedRecord && typeof parsedRecord.encounterIntent === "object" && parsedRecord.encounterIntent !== null
      ? (parsedRecord.encounterIntent as Record<string, unknown>)
      : null;

  const rawEncounterIntentNormalized = normalizeCampaignRuntimeEncounterIntent({
    rawEncounterIntent,
    sessionId: input.sessionId,
    playerInput: input.playerInput,
  });
  const canonicalActors = parseCanonicalEncounterActorsFromRecentEntries(input.recentEntries);
  const encounterIntent = alignEncounterIntentWithCanonicalActors({
    encounterIntent: rawEncounterIntentNormalized,
    canonicalActors,
  });
  const adjudicationRequests = normalizeCampaignRuntimeAdjudicationRequests(parsedRecord?.adjudicationRequests);

  // Only inject fallback choices for non-prologue turns
  const finalChoices = (isKickoff || choices.length > 0) ? choices : ["Continue forward", "Ask for more detail"];

  return {
    ok: true,
    turn: {
      sessionId: input.sessionId,
      dmText,
      choices: finalChoices,
      stateTags,
      sceneSafety,
      itemChanges,
      encounterIntent,
      adjudicationRequests,
    },
  };
}

export function buildOneOffHandoffIngestResponse(input: OneOffHandoffIngestRequest): {
  ok: true;
  ingested: true;
  submissionId: string;
  ingestTraceId: string;
  receivedAt: string;
  handoff: {
    schemaVersion: "oneoff-handoff.v1";
    sessionId: string;
    title: string;
    mode: "one_off";
  };
} {
  const now = Date.now().toString(36);
  return {
    ok: true,
    ingested: true,
    submissionId: `handoff_${now}`,
    ingestTraceId: `ingest_${now}_${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: new Date().toISOString(),
    handoff: {
      schemaVersion: input.handoff.schemaVersion,
      sessionId: input.handoff.sessionId,
      title: input.handoff.title,
      mode: input.handoff.mode,
    },
  };
}

export function buildCampaignScaffoldIngestResponse(input: CampaignScaffoldIngestRequest): {
  ok: true;
  ingested: true;
  submissionId: string;
  ingestTraceId: string;
  receivedAt: string;
  scaffold: {
    schemaVersion: "campaign-scaffold.v1";
    sessionId: string;
    campaignId: string;
    chapterLabel: string;
    mode: "campaign_scaffold";
  };
} {
  const now = Date.now().toString(36);
  return {
    ok: true,
    ingested: true,
    submissionId: `campaign_${now}`,
    ingestTraceId: `ingest_${now}_${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: new Date().toISOString(),
    scaffold: {
      schemaVersion: input.scaffold.schemaVersion,
      sessionId: input.scaffold.sessionId,
      campaignId: input.scaffold.campaignId,
      chapterLabel: input.scaffold.chapterLabel,
      mode: input.scaffold.mode,
    },
  };
}

export function buildCampaignContinuationIngestResponse(input: CampaignContinuationIngestRequest): {
  ok: true;
  ingested: true;
  submissionId: string;
  ingestTraceId: string;
  receivedAt: string;
  continuation: {
    schemaVersion: "campaign-continuation.v1";
    sessionId: string;
    campaignId: string;
    chapterLabel: string;
    mode: "campaign_continuation";
    checkpointIndex: number;
    continuityStatus: "active" | "checkpoint" | "chapter_complete";
  };
} {
  const now = Date.now().toString(36);
  return {
    ok: true,
    ingested: true,
    submissionId: `continuation_${randomUUID()}`,
    ingestTraceId: `ingest_${now}_${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: new Date().toISOString(),
    continuation: {
      schemaVersion: input.continuation.schemaVersion,
      sessionId: input.continuation.sessionId,
      campaignId: input.continuation.campaignId,
      chapterLabel: input.continuation.chapterLabel,
      mode: input.continuation.mode,
      checkpointIndex: input.continuation.checkpointIndex,
      continuityStatus: input.continuation.continuityStatus,
    },
  };
}

export function buildCampaignContinuationSnapshotResponse(input: { sessionId: string; snapshot: CampaignContinuationSnapshotRecord }): {
  ok: true;
  found: true;
  sessionId: string;
  snapshot: {
    schemaVersion: "campaign-continuation.v1";
    sessionId: string;
    campaignId: string;
    campaignLabel: string;
    chapterLabel: string;
    mode: "campaign_continuation";
    difficulty: string;
    stylePreset: string;
    guidanceSource: "user" | "fallback";
    entryCount: number;
    checkpointIndex: number;
    continuityStatus: "active" | "checkpoint" | "chapter_complete";
    progressSummary: string;
    recapLines: string[];
    clientSavedAt: number;
    receivedAt: string;
    ingestTraceId: string;
    submissionId: string;
  };
} {
  return {
    ok: true,
    found: true,
    sessionId: input.sessionId,
    snapshot: {
      ...input.snapshot.continuation,
      recapLines: [...input.snapshot.recapLines],
      clientSavedAt: input.snapshot.clientSavedAt,
      receivedAt: input.snapshot.receivedAt,
      ingestTraceId: input.snapshot.ingestTraceId,
      submissionId: input.snapshot.submissionId,
    },
  };
}


function getIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildInvalidHandoffPayloadResponse(error: string): {
  statusCode: 400;
  body: {
    error: string;
    code: "invalid_handoff_payload";
  };
} {
  return {
    statusCode: 400,
    body: {
      error,
      code: "invalid_handoff_payload",
    },
  };
}

export type BeginOneOffHandoffRouteIdempotencyResult =
  | {
      kind: "continue";
      key: string | null;
      canPersist: boolean;
    }
  | {
      kind: "respond";
      statusCode: number;
      body: unknown;
      replayHeader: boolean;
    };

export async function beginOneOffHandoffRouteIdempotency(input: {
  headerValue: unknown;
  requestHash: string;
  endpoint?: string;
  startFn?: StartIdempotencyFn;
}): Promise<BeginOneOffHandoffRouteIdempotencyResult> {
  const key = getIdempotencyKey(input.headerValue);
  if (!key) {
    return { kind: "continue", key: null, canPersist: false };
  }

  const start = input.startFn ?? startAICallIdempotency;

  let startResult: Awaited<ReturnType<StartIdempotencyFn>>;
  try {
    startResult = await start({
      key,
      endpoint: input.endpoint ?? ONE_OFF_HANDOFF_INGEST_ENDPOINT,
      requestHash: input.requestHash,
    });
  } catch (error) {
    // Idempotency persistence is best-effort; the route must still behave safely.
    console.warn("[adventure] idempotency start unavailable; continuing without persistence", error);
    return { kind: "continue", key, canPersist: false };
  }

  if (startResult.kind === "replay") {
    return {
      kind: "respond",
      statusCode: startResult.statusCode,
      body: startResult.responseBody,
      replayHeader: true,
    };
  }
  if (startResult.kind === "payload_conflict") {
    return {
      kind: "respond",
      statusCode: 409,
      body: {
        error: "Idempotency key was already used with a different request payload.",
        code: "idempotency_payload_mismatch",
      },
      replayHeader: false,
    };
  }
  if (startResult.kind === "in_progress") {
    return {
      kind: "respond",
      statusCode: 409,
      body: {
        error: "A request with this idempotency key is still in progress.",
        code: "idempotency_in_progress",
      },
      replayHeader: false,
    };
  }

  return {
    kind: "continue",
    key,
    canPersist: startResult.kind === "started",
  };
}

export async function completeOneOffHandoffRouteIdempotency(input: {
  key: string | null;
  canPersist: boolean;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
  endpoint?: string;
  completeFn?: CompleteIdempotencyFn;
}): Promise<void> {
  if (!input.key || !input.canPersist) return;

  const complete = input.completeFn ?? completeAICallIdempotency;
  try {
    await complete({
      key: input.key,
      endpoint: input.endpoint ?? ONE_OFF_HANDOFF_INGEST_ENDPOINT,
      requestHash: input.requestHash,
      statusCode: input.statusCode,
      responseBody: input.responseBody,
    });
  } catch (error) {
    // Completion persistence must not alter already-computed route behavior.
    console.warn("[adventure] idempotency completion unavailable; response already computed", error);
  }
}

router.post("/adventure/oneoff-handoffs", async (req, res) => {
  const parsed = parseOneOffHandoffIngestRequest(req.body);
  if (!parsed.ok) {
    const invalid = buildInvalidHandoffPayloadResponse(parsed.error);
    res.status(invalid.statusCode).json(invalid.body);
    return;
  }

  const requestHash = computeAICallRequestHash({ body: parsed.value });
  const idempotencyStart = await beginOneOffHandoffRouteIdempotency({
    headerValue: req.get("Idempotency-Key"),
    requestHash,
    startFn: oneOffHandoffRouteStartOverride ?? undefined,
  });
  if (idempotencyStart.kind === "respond") {
    if (idempotencyStart.replayHeader) {
      res.setHeader("X-Idempotent-Replay", "true");
    }
    res.status(idempotencyStart.statusCode).json(idempotencyStart.body);
    return;
  }

  const responseBody = buildOneOffHandoffIngestResponse(parsed.value);
  res.status(200).json(responseBody);

  await completeOneOffHandoffRouteIdempotency({
    key: idempotencyStart.key,
    canPersist: idempotencyStart.canPersist,
    requestHash,
    statusCode: 200,
    responseBody,
  });
});

router.post("/adventure/campaign-scaffolds", async (req, res) => {
  const parsed = parseCampaignScaffoldIngestRequest(req.body);
  if (!parsed.ok) {
    const invalid = buildInvalidHandoffPayloadResponse(parsed.error);
    res.status(invalid.statusCode).json(invalid.body);
    return;
  }

  const requestHash = computeAICallRequestHash({ body: parsed.value });
  const idempotencyStart = await beginOneOffHandoffRouteIdempotency({
    headerValue: req.get("Idempotency-Key"),
    requestHash,
    endpoint: CAMPAIGN_SCAFFOLD_INGEST_ENDPOINT,
    startFn: campaignScaffoldRouteStartOverride ?? undefined,
  });
  if (idempotencyStart.kind === "respond") {
    if (idempotencyStart.replayHeader) {
      res.setHeader("X-Idempotent-Replay", "true");
    }
    res.status(idempotencyStart.statusCode).json(idempotencyStart.body);
    return;
  }

  const responseBody = buildCampaignScaffoldIngestResponse(parsed.value);
  res.status(200).json(responseBody);

  await completeOneOffHandoffRouteIdempotency({
    key: idempotencyStart.key,
    canPersist: idempotencyStart.canPersist,
    requestHash,
    statusCode: 200,
    responseBody,
    endpoint: CAMPAIGN_SCAFFOLD_INGEST_ENDPOINT,
  });
});

router.post("/adventure/campaign-continuations", async (req, res) => {
  const parsed = parseCampaignContinuationIngestRequest(req.body);
  if (!parsed.ok) {
    const invalid = buildInvalidHandoffPayloadResponse(parsed.error);
    res.status(invalid.statusCode).json(invalid.body);
    return;
  }

  const requestHash = computeAICallRequestHash({ body: parsed.value });
  const responseBody = buildCampaignContinuationIngestResponse(parsed.value);
  try {
    const result = await commitCampaignCheckpoint({
      snapshot: {
        continuation: parsed.value.continuation,
        recapLines: [...parsed.value.recapLines],
        clientSavedAt: parsed.value.clientSavedAt,
        receivedAt: responseBody.receivedAt,
        ingestTraceId: responseBody.ingestTraceId,
        submissionId: responseBody.submissionId,
      },
      responseBody,
      expectedSubmissionId: parsed.value.expectedSubmissionId ?? null,
      idempotencyKey: getIdempotencyKey(req.get("Idempotency-Key")),
      endpoint: CAMPAIGN_CONTINUATION_INGEST_ENDPOINT,
      requestHash,
      startOverride: campaignContinuationRouteStartOverride ?? undefined,
    });
    if (result.replayed) res.setHeader("X-Idempotent-Replay", "true");
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    req.log?.error({ err: error }, "Campaign checkpoint durable commit failed");
    res.setHeader("Retry-After", "3");
    res.status(503).json({
      code: "campaign_checkpoint_unavailable",
      error: "Checkpoint could not be saved to the server. Keep this session open and retry.",
      retryable: true,
    });
  }
});

router.get("/adventure/campaign-continuations/:sessionId", async (req, res) => {
  const parsedSessionId = z.string().min(1).safeParse(req.params.sessionId);
  if (!parsedSessionId.success) {
    res.status(400).json({
      error: "Session id is required.",
      code: "invalid_campaign_session_id",
    });
    return;
  }

  const sessionId = parsedSessionId.data;
  let snapshot: CampaignContinuationSnapshotRecord | null;
  try {
    snapshot = await loadDurableCampaignContinuationSnapshot(sessionId);
  } catch (error) {
    req.log?.error({ err: error }, "Campaign checkpoint read failed");
    res.setHeader("Retry-After", "3");
    res.status(503).json({
      code: "campaign_checkpoint_unavailable",
      error: "The latest checkpoint could not be loaded from the server. Keep this session open and retry.",
      retryable: true,
    });
    return;
  }
  if (!snapshot) {
    res.status(404).json({
      error: "No campaign continuation snapshot found for this session.",
      code: "campaign_continuation_not_found",
      sessionId,
    });
    return;
  }

  const responseBody = buildCampaignContinuationSnapshotResponse({
    sessionId,
    snapshot,
  });
  res.status(200).json(responseBody);
});

router.post("/adventure/campaign-runtime/turn", async (req, res) => {
  const parsed = parseCampaignRuntimeTurnRequest(req.body);
  if (!parsed.ok) {
    res.status(400).json({
      error: parsed.error,
      code: "invalid_campaign_runtime_turn_payload",
    });
    return;
  }

  try {
    const responseBody = await runCampaignRuntimeTurn(parsed.value);
    res.status(200).json(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = /not configured/i.test(message) ? 503 : 500;
    res.status(statusCode).json({
      error: "Campaign runtime turn failed.",
      detail: message,
      code: statusCode === 503 ? "ai_not_configured" : "campaign_runtime_turn_failed",
    });
  }
});

/**
 * Host-authenticated AI DM spatial adjudication. The model proposes a
 * line-of-sight and distance ruling; the atomic party executor still owns
 * initiative, weapon stats, dice, HP, and validation.
 */
const npcAdjudicationSchema = z.object({
  partyCode: z.string().trim().min(1).max(128),
  battleId: z.string().trim().min(1).max(128),
  npcId: z.string().trim().min(1).max(128),
  npcName: z.string().trim().min(1).max(120),
  profile: z.enum(["aggressive", "cautious", "defensive", "sneaky", "passive"]),
  sceneText: z.string().max(3500),
  choices: z.array(z.object({
    weaponId: z.string().min(1).max(128),
    weaponName: z.string().min(1).max(120),
    targetMemberId: z.string().min(1).max(128),
    targetName: z.string().min(1).max(120),
    range: z.string().max(80),
  })).min(1).max(24),
});

router.post("/adventure/npc-turn-adjudication", async (req, res) => {
  const parsed = npcAdjudicationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid NPC turn adjudication request." }); return; }
  const input = parsed.data;
  try {
    const sessions = await db.select().from(partySessions).where(eq(partySessions.code, input.partyCode));
    if (!sessions[0] || !hasPartyHostToken(req.get("authorization"), sessions[0].hostTokenHash)) {
      res.status(403).json({ error: "Only the authenticated AI DM host may request NPC adjudication." }); return;
    }
    const prompt = [
      "You are the D&D Dungeon Master adjudicating a single NPC weapon turn.",
      "Use only the established scene and canonical action choices below. Do not invent an intervening movement action or ignore cover.",
      "A tactical personality influences which valid attack is preferred, but it never overrides range or sight.",
      "If distance or line of sight cannot be fairly determined from the scene, choose HOLD. Never guess a measured distance.",
      "Output JSON only: {\"kind\":\"attack\"|\"hold\",\"weaponId\":\"...\",\"targetMemberId\":\"...\",\"distanceFeet\":0,\"clearLineOfSight\":true,\"reason\":\"...\"}.",
      "For HOLD, omit weaponId, targetMemberId and distanceFeet. Attacks require clearLineOfSight exactly true.",
      `NPC: ${input.npcName}; profile: ${input.profile}.`,
      `Recent scene: ${input.sceneText.slice(0, 3500)}`,
      `Available weapon/target pairings: ${JSON.stringify(input.choices)}`,
    ].join("\n");
    const result = await getOpenAI().chat.completions.create({
      model: ADVENTURE_CAMPAIGN_TURN_MODEL,
      max_completion_tokens: 200,
      temperature: 0.15,
      messages: [{ role: "system", content: prompt }],
    });
    const raw = result.choices[0]?.message?.content ?? "";
    let decision: Record<string, unknown> = {};
    try { const value = JSON.parse(raw); if (value && typeof value === "object" && !Array.isArray(value)) decision = value; }
    catch { /* Malformed model output always holds rather than inventing an attack. */ }
    const chosen = input.choices.find(choice =>
      choice.weaponId === decision.weaponId && choice.targetMemberId === decision.targetMemberId);
    const distance = decision.distanceFeet;
    if (decision.kind !== "attack" || !chosen || decision.clearLineOfSight !== true ||
        typeof distance !== "number" || !Number.isFinite(distance) || distance < 0 || distance > 10000) {
      res.json({ ok: true, kind: "hold", reason: typeof decision.reason === "string" ? decision.reason.slice(0, 180) : "No verified attack available." });
      return;
    }
    res.json({ ok: true, kind: "attack", weaponId: chosen.weaponId, targetMemberId: chosen.targetMemberId,
      distanceFeet: distance, reason: typeof decision.reason === "string" ? decision.reason.slice(0, 180) : "DM-verified range and sightline." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "NPC adjudication unavailable.";
    res.status(/not configured/i.test(message) ? 503 : 500).json({ error: "NPC adjudication failed.", detail: message });
  }
});

export default router;
