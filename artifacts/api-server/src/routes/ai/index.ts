import { validateCreationItem, itemProposalVariantKey, hasUnsupportedDamageResponse } from "../../lib/mechanics/itemProposalValidation";
import { Router } from "express";
import multer from "multer";
import OpenAI from "openai";
import { AI_UPSTREAM_REQUEST_OPTIONS } from "../../lib/aiUpstreamRequestOptions";
import { normalizeParserItemMechanics } from "../../lib/mechanics/itemMechanicsBoundary";
import {
  completeAICallIdempotency,
  startAICallIdempotency,
} from "../../lib/aiIdempotencyStore";
import { computeAICallRequestHash } from "../../lib/aiIdempotencyHash";

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseBooleanLike(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const normalized = v.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  }
  if (typeof v === "number") return v === 1;
  return false;
}

function getIdempotencyKeyFromHeader(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

type StartIdempotencyFn = typeof startAICallIdempotency;
type CompleteIdempotencyFn = typeof completeAICallIdempotency;

export type BeginRouteIdempotencyResult =
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

export async function beginRouteIdempotency(input: {
  headerValue: unknown;
  endpoint: string;
  requestHash: string;
  startFn?: StartIdempotencyFn;
}): Promise<BeginRouteIdempotencyResult> {
  const key = getIdempotencyKeyFromHeader(input.headerValue);
  if (!key) {
    return { kind: "continue", key: null, canPersist: false };
  }

  const start = input.startFn ?? startAICallIdempotency;

  let startResult: Awaited<ReturnType<StartIdempotencyFn>>;
  try {
    startResult = await start({
      key,
      endpoint: input.endpoint,
      requestHash: input.requestHash,
    });
  } catch (error) {
    // Idempotency is best-effort; route behavior should continue safely when persistence fails.
    console.warn("[ai] idempotency start unavailable; continuing without persistence", error);
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

export async function completeRouteIdempotency(input: {
  key: string | null;
  canPersist: boolean;
  endpoint: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
  completeFn?: CompleteIdempotencyFn;
}): Promise<void> {
  if (!input.key || !input.canPersist) return;

  const complete = input.completeFn ?? completeAICallIdempotency;
  try {
    await complete({
      key: input.key,
      endpoint: input.endpoint,
      requestHash: input.requestHash,
      statusCode: input.statusCode,
      responseBody: input.responseBody,
    });
  } catch (error) {
    // Completion persistence must not mutate route success/failure behavior.
    console.warn("[ai] idempotency completion unavailable; response already computed", error);
  }
}

function normalizeHpChange(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const delta = typeof raw["delta"] === "number" ? raw["delta"] : 0;
  const type = raw["type"] === "heal" ? "heal" : "damage";
  return { delta, type };
}

function normalizeCurrencyChange(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const coin = (key: string): number | null => {
    const v = raw[key];
    return typeof v === "number" ? v : null;
  };
  return { cp: coin("cp"), sp: coin("sp"), ep: coin("ep"), gp: coin("gp"), pp: coin("pp") };
}

function normalizeAttackCalc(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  return {
    attackName: typeof raw["attackName"] === "string" ? raw["attackName"] : "",
    rawRoll: typeof raw["rawRoll"] === "number" ? raw["rawRoll"] : 0,
    attackBonus: typeof raw["attackBonus"] === "number" ? raw["attackBonus"] : 0,
    totalToHit: typeof raw["totalToHit"] === "number" ? raw["totalToHit"] : 0,
  };
}

export function normalizeQuickUpdateResult(parsed: unknown): Record<string, unknown> {
  if (!isRecord(parsed)) {
    throw new Error("AI response is not a JSON object");
  }
  const proposedInventoryChanges = (Array.isArray(parsed["proposedInventoryChanges"]) ? parsed["proposedInventoryChanges"] : []).map(normalizeInventoryChange).filter((x): x is Record<string, unknown> => x !== null);
  return {
    rawInput: typeof parsed["rawInput"] === "string" ? parsed["rawInput"] : "",
    summary: typeof parsed["summary"] === "string" ? parsed["summary"] : "Update processed",
    type: typeof parsed["type"] === "string" && VALID_UPDATE_TYPES.has(parsed["type"]) ? parsed["type"] : "unknown",
    proposedHpChange: normalizeHpChange(parsed["proposedHpChange"]),
    proposedCurrencyChange: normalizeCurrencyChange(parsed["proposedCurrencyChange"]),
    proposedResourceChanges: (Array.isArray(parsed["proposedResourceChanges"]) ? parsed["proposedResourceChanges"] : []).map(normalizeResourceChange).filter(Boolean),
    proposedInventoryChanges,
    proposedAttackCalc: normalizeAttackCalc(parsed["proposedAttackCalc"]),
    proposedConditionChanges: (Array.isArray(parsed["proposedConditionChanges"]) ? parsed["proposedConditionChanges"] : []).map(normalizeConditionChange).filter(Boolean),
    questActions: (Array.isArray(parsed["questActions"]) ? parsed["questActions"] : []).map(normalizeQuestActionShared).filter(Boolean),
    personActions: (Array.isArray(parsed["personActions"]) ? parsed["personActions"] : []).map(normalizePersonActionShared).filter(Boolean),
    locationActions: (Array.isArray(parsed["locationActions"]) ? parsed["locationActions"] : []).map(normalizeLocationActionShared).filter(Boolean),
    // realmActions parity: was previously omitted; restored here alongside Phase 1 questGraphResult.
    realmActions: (Array.isArray(parsed["realmActions"]) ? parsed["realmActions"] : []).map(normalizeRealmActionShared).filter(Boolean),
    // Phase 1 additive output — null on any malformed input; legacy outputs above are unaffected.
    questGraphResult: normalizeQuestGraphResult(parsed["questGraphResult"], proposedInventoryChanges) ?? null,
  };
}

const VALID_CATEGORIES = new Set(["weapon", "armor", "accessory", "consumable", "quest", "magic", "gear", "treasure", "map", "currency", "component", "junk", "other"]);
const VALID_CONFIDENCES = new Set(["high", "medium", "low"]);
const VALID_UPDATE_TYPES = new Set(["hp", "resource", "inventory", "currency", "attack", "condition", "quest", "mixed", "unknown"]);
const VALID_CONDITION_REMOVAL = new Set(["short_rest", "long_rest", "save", "manual"]);
const VALID_Q_TYPES = new Set(["main", "side", "personal"]);
const VALID_Q_STATUS = new Set(["active", "completed", "failed"]);
const VALID_RELS = new Set(["unknown", "ally", "neutral", "hostile"]);
const VALID_ACT = new Set(["create", "update"]);

function normalizeConditionRemoval(arr: unknown): string[] {
  if (!Array.isArray(arr)) return ["manual"];
  return arr.filter((v): v is string => typeof v === "string" && VALID_CONDITION_REMOVAL.has(v));
}

function normalizeConditionChange(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) return null;
  const action = item["action"] === "remove" ? "remove" : "add";
  const removeOn = normalizeConditionRemoval(item["removeOn"]);
  return {
    name: typeof item["name"] === "string" ? item["name"] : "Unknown",
    action,
    source: typeof item["source"] === "string" ? item["source"] : null,
    removeOn: removeOn.length > 0 ? removeOn : ["manual"],
    notes: typeof item["notes"] === "string" ? item["notes"] : null,
  };
}

function sanitizeCategory(v: unknown): string {
  return typeof v === "string" && VALID_CATEGORIES.has(v) ? v : "other";
}

function sanitizeConfidence(v: unknown): string {
  return typeof v === "string" && VALID_CONFIDENCES.has(v) ? v : "medium";
}

const VALID_ABILITIES = new Set(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]);
const VALID_EFFECT_TYPES = new Set(["stat_bonus", "attack_damage", "spell", "buff", "feature", "note"]);
const VALID_STAT_KEYS = new Set([
  "armorClass", "speed", "initiative", "maxHp", "passivePerception", "proficiencyBonus",
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
]);

const VALID_RESET_ON = new Set(["short_rest", "long_rest", "dawn"]);

const CONDITION_CANONICAL_BY_LOWER = new Map<string, string>([
  ["blinded", "Blinded"],
  ["charmed", "Charmed"],
  ["deafened", "Deafened"],
  ["exhaustion", "Exhaustion"],
  ["frightened", "Frightened"],
  ["grappled", "Grappled"],
  ["incapacitated", "Incapacitated"],
  ["invisible", "Invisible"],
  ["paralyzed", "Paralyzed"],
  ["petrified", "Petrified"],
  ["poisoned", "Poisoned"],
  ["prone", "Prone"],
  ["restrained", "Restrained"],
  ["stunned", "Stunned"],
  ["unconscious", "Unconscious"],
]);

function parseBoundedLimitedUseFromText(text: string): { uses: number; resetOn: "short_rest" | "long_rest" | "dawn" } | null {
  const normalized = text.toLowerCase();
  if (/\bonce per\s+short\s+rest\b/.test(normalized) || /\bonce per\s+short\/long\s+rest\b/.test(normalized)) {
    return { uses: 1, resetOn: "short_rest" };
  }
  if (/\bonce per\s+long\s+rest\b/.test(normalized)) {
    return { uses: 1, resetOn: "long_rest" };
  }
  if (/\bonce per\s+day\b/.test(normalized) || /\bonce daily\b/.test(normalized)) {
    return { uses: 1, resetOn: "dawn" };
  }
  return null;
}

function extractBoundedVsConditionTrigger(text: string): string | null {
  const normalized = text.toLowerCase();
  for (const [lowerName, canonicalName] of CONDITION_CANONICAL_BY_LOWER.entries()) {
    const pattern = new RegExp(
      `\\b(?:against|vs\\.?|versus|if the target is|if a target is|when the target is|when a target is|against targets? (?:that are|who are)|vs\\.? targets? (?:that are|who are))\\s+${lowerName}\\b`,
      "i",
    );
    if (pattern.test(normalized)) {
      return canonicalName;
    }
  }
  return null;
}

function hasConditionalLanguage(text: string): boolean {
  return /\b(?:if|when|against|versus|vs\.?)\b/i.test(text);
}

function effectHasUnresolvedConditionalTrigger(effect: Record<string, unknown>): boolean {
  if (effect["type"] !== "attack_damage") return false;
  if (effect["triggerType"] === "vs_condition" && typeof effect["triggerCondition"] === "string") {
    return false;
  }
  const text = `${typeof effect["label"] === "string" ? effect["label"] : ""} ${typeof effect["description"] === "string" ? effect["description"] : ""}`.trim();
  if (!text) return false;
  return hasConditionalLanguage(text);
}

function normalizeItemEffect(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const type = typeof raw["type"] === "string" && VALID_EFFECT_TYPES.has(raw["type"]) ? raw["type"] : "note";
  const label = typeof raw["label"] === "string" && raw["label"].trim() ? raw["label"].trim() : null;
  if (!label) return null;
  const description = typeof raw["description"] === "string" ? raw["description"].trim() : undefined;
  const effectText = `${label} ${description ?? ""}`.trim();
  const statKey = type === "stat_bonus" && typeof raw["statKey"] === "string" && VALID_STAT_KEYS.has(raw["statKey"]) ? raw["statKey"] : undefined;
  const statValue = statKey != null && typeof raw["statValue"] === "number" ? raw["statValue"] : undefined;
  const attackDamageDice = type === "attack_damage" && typeof raw["attackDamageDice"] === "string" ? raw["attackDamageDice"].trim() || undefined : undefined;
  const attackDamageType = type === "attack_damage" && typeof raw["attackDamageType"] === "string" ? raw["attackDamageType"].trim() || undefined : undefined;
  // Feature: resource max bonus
  const resourceName = type === "feature" && typeof raw["resourceName"] === "string" ? raw["resourceName"].trim() || undefined : undefined;
  const resourceMaxBonus = resourceName != null && typeof raw["resourceMaxBonus"] === "number" ? raw["resourceMaxBonus"] : undefined;
  // Phase A (bounded): promote explicit once-per-rest/day phrasing to structured usage.
  const explicitUses = typeof raw["uses"] === "number" && raw["uses"] > 0 ? raw["uses"] : undefined;
  const explicitResetOn = typeof raw["resetOn"] === "string" && VALID_RESET_ON.has(raw["resetOn"]) ? raw["resetOn"] : undefined;
  const inferredUsage = effectText ? parseBoundedLimitedUseFromText(effectText) : null;
  const uses = explicitUses ?? inferredUsage?.uses;
  const resetOn = explicitResetOn ?? inferredUsage?.resetOn ?? (type === "spell" && uses != null ? "long_rest" : undefined);
  // Phase B (bounded): only support explicit vs_condition trigger extraction.
  const explicitTriggerType = raw["triggerType"] === "vs_condition" ? "vs_condition" : undefined;
  const explicitTriggerConditionRaw = typeof raw["triggerCondition"] === "string" ? raw["triggerCondition"].trim().toLowerCase() : undefined;
  const explicitTriggerCondition = explicitTriggerConditionRaw ? CONDITION_CANONICAL_BY_LOWER.get(explicitTriggerConditionRaw) : undefined;
  const inferredTriggerCondition = type === "attack_damage" ? extractBoundedVsConditionTrigger(effectText) : null;
  const triggerType = type === "attack_damage" && (explicitTriggerType || inferredTriggerCondition) ? "vs_condition" : undefined;
  const triggerCondition = explicitTriggerCondition ?? inferredTriggerCondition ?? undefined;
  const id = `eff${Date.now()}${Math.random().toString(36).substr(2, 5)}`;
  return {
    id,
    type,
    label,
    ...(description ? { description } : {}),
    ...(statKey ? { statKey } : {}),
    ...(statValue != null ? { statValue } : {}),
    ...(attackDamageDice ? { attackDamageDice } : {}),
    ...(attackDamageType ? { attackDamageType } : {}),
    ...(typeof raw["attackDamageBonus"] === "number" ? { attackDamageBonus: raw["attackDamageBonus"] } : {}),
    ...(typeof raw["attackToHitBonus"] === "number" ? { attackToHitBonus: raw["attackToHitBonus"] } : {}),
    ...(typeof raw["actionType"] === "string" && ["action", "bonus_action", "reaction", "free"].includes(raw["actionType"]) ? { actionType: raw["actionType"] } : {}),
    ...(resourceName ? { resourceName } : {}),
    ...(resourceMaxBonus != null ? { resourceMaxBonus } : {}),
    ...(uses != null ? { uses } : {}),
    ...(resetOn ? { resetOn } : {}),
    ...(triggerType ? { triggerType } : {}),
    ...(triggerCondition ? { triggerCondition } : {}),
  };
}

function normalizeEquippedEffects(arr: unknown): Record<string, unknown>[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeItemEffect).filter(Boolean) as Record<string, unknown>[];
}

function normalizeAdditionalDamage(arr: unknown): Record<string, unknown>[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(isRecord)
    .filter((entry) => typeof entry["dice"] === "string" && typeof entry["damageType"] === "string")
    .map((entry) => ({
      dice: entry["dice"] as string,
      damageType: entry["damageType"] as string,
      damageModifier: typeof entry["damageModifier"] === "number" ? entry["damageModifier"] : undefined,
    }));
}

function effectSemanticKey(effect: Record<string, unknown>): string {
  const type = typeof effect["type"] === "string" ? effect["type"].toLowerCase() : "note";
  const label = typeof effect["label"] === "string" ? effect["label"].trim().toLowerCase() : "";
  const statKey = typeof effect["statKey"] === "string" ? effect["statKey"].toLowerCase() : "";
  const statValue = typeof effect["statValue"] === "number" ? String(effect["statValue"]) : "";
  const attackDice = typeof effect["attackDamageDice"] === "string" ? effect["attackDamageDice"].trim().toLowerCase() : "";
  const attackType = typeof effect["attackDamageType"] === "string" ? effect["attackDamageType"].trim().toLowerCase() : "";
  const resourceName = typeof effect["resourceName"] === "string" ? effect["resourceName"].trim().toLowerCase() : "";
  const resourceMaxBonus = typeof effect["resourceMaxBonus"] === "number" ? String(effect["resourceMaxBonus"]) : "";
  const uses = typeof effect["uses"] === "number" ? String(effect["uses"]) : "";
  const resetOn = typeof effect["resetOn"] === "string" ? effect["resetOn"].trim().toLowerCase() : "";
  const triggerType = typeof effect["triggerType"] === "string" ? effect["triggerType"].trim().toLowerCase() : "";
  const triggerCondition = typeof effect["triggerCondition"] === "string" ? effect["triggerCondition"].trim().toLowerCase() : "";
  return [type, label, statKey, statValue, attackDice, attackType, resourceName, resourceMaxBonus, uses, resetOn, triggerType, triggerCondition].join("|");
}

function countEffectSpecificFields(effect: Record<string, unknown>): number {
  let score = 0;
  if (typeof effect["description"] === "string" && effect["description"].trim().length > 0) score += 1;
  if (typeof effect["statKey"] === "string") score += 1;
  if (typeof effect["statValue"] === "number") score += 1;
  if (typeof effect["attackDamageDice"] === "string") score += 1;
  if (typeof effect["attackDamageType"] === "string") score += 1;
  if (typeof effect["resourceName"] === "string") score += 1;
  if (typeof effect["resourceMaxBonus"] === "number") score += 1;
  if (typeof effect["uses"] === "number") score += 1;
  if (typeof effect["resetOn"] === "string") score += 1;
  if (typeof effect["triggerType"] === "string") score += 1;
  if (typeof effect["triggerCondition"] === "string") score += 1;
  return score;
}

function dedupeItemEffects(effects: Record<string, unknown>[]): Record<string, unknown>[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const effect of effects) {
    const key = effectSemanticKey(effect);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, effect);
      continue;
    }
    if (countEffectSpecificFields(effect) > countEffectSpecificFields(existing)) {
      byKey.set(key, effect);
    }
  }
  return [...byKey.values()];
}

function mergeUniqueNotes(first: unknown, second: unknown): string | null {
  const left = typeof first === "string" ? first.trim() : "";
  const right = typeof second === "string" ? second.trim() : "";
  if (!left && !right) return null;
  if (!left) return right;
  if (!right) return left;
  if (left.toLowerCase() === right.toLowerCase()) return left;
  return `${left} ${right}`;
}

function parseStatBonusEffectFromNotes(notes: string): Record<string, unknown> | null {
  const statPatterns: Array<{ regex: RegExp; statKey: string; label: string }> = [
    { regex: /\+(\d+)\s*(?:to\s*)?(?:ac|armor class)\b/i, statKey: "armorClass", label: "AC Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?(?:hp|hit points?|max hp)\b/i, statKey: "maxHp", label: "HP Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?initiative\b/i, statKey: "initiative", label: "Initiative Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?speed\b/i, statKey: "speed", label: "Speed Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?(?:passive perception)\b/i, statKey: "passivePerception", label: "Perception Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?(?:proficiency|proficiency bonus)\b/i, statKey: "proficiencyBonus", label: "Proficiency Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?(?:str|strength)\b/i, statKey: "strength", label: "Strength Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?(?:dex|dexterity)\b/i, statKey: "dexterity", label: "Dexterity Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?(?:con|constitution)\b/i, statKey: "constitution", label: "Constitution Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?(?:int|intelligence)\b/i, statKey: "intelligence", label: "Intelligence Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?(?:wis|wisdom)\b/i, statKey: "wisdom", label: "Wisdom Bonus" },
    { regex: /\+(\d+)\s*(?:to\s*)?(?:cha|charisma)\b/i, statKey: "charisma", label: "Charisma Bonus" },
  ];

  for (const candidate of statPatterns) {
    const match = notes.match(candidate.regex);
    if (!match) continue;
    const rawValue = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(rawValue) || rawValue <= 0) continue;
    return normalizeItemEffect({
      type: "stat_bonus",
      label: candidate.label,
      description: notes,
      statKey: candidate.statKey,
      statValue: rawValue,
    });
  }

  return null;
}

function hasMechanicalClaimInNotes(notes: string): boolean {
  return /\+\d+\s*(?:to\s*)?(?:ac|armor class|hp|hit points?|initiative|speed|passive perception|proficiency|str|strength|dex|dexterity|con|constitution|int|intelligence|wis|wisdom|cha|charisma)\b/i.test(notes);
}

function hasContradictoryMechanicalClaimInNotes(notes: string): boolean {
  const contradictoryPatterns: RegExp[] = [
    /(?:no\s+bonus|does(?:\s+not|n't)\s+grant\s+(?:a\s+)?bonus|without\s+(?:a\s+)?bonus).{0,40}\+\d+/i,
    /\+\d+.{0,40}(?:no\s+bonus|does(?:\s+not|n't)\s+grant\s+(?:a\s+)?bonus|without\s+(?:a\s+)?bonus)/i,
    /(?:bonus|grants?).{0,40}\b(?:unknown|unclear|unconfirmed|unsure|maybe)\b/i,
  ];
  return contradictoryPatterns.some((pattern) => pattern.test(notes));
}

function mergeAdditionalDamageEntries(
  first: Record<string, unknown>[],
  second: Record<string, unknown>[],
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const merged: Record<string, unknown>[] = [];
  for (const entry of [...first, ...second]) {
    const dice = typeof entry["dice"] === "string" ? entry["dice"].trim().toLowerCase() : "";
    const damageType = typeof entry["damageType"] === "string" ? entry["damageType"].trim().toLowerCase() : "";
    const modifier = typeof entry["damageModifier"] === "number" ? String(entry["damageModifier"]) : "";
    const key = `${dice}|${damageType}|${modifier}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }
  return merged;
}

function confidenceRank(v: unknown): number {
  if (v === "high") return 3;
  if (v === "medium") return 2;
  return 1;
}

function repairAndDedupeLootItems(items: Record<string, unknown>[]): Record<string, unknown>[] {
  const mergedByName = new Map<string, Record<string, unknown>>();

  for (const item of items) {
    const category = typeof item["category"] === "string" ? item["category"] : "other";
    const name = typeof item["name"] === "string" ? item["name"].trim() : "Unknown Item";
    const dedupeKey = itemProposalVariantKey(item);
    const existing = mergedByName.get(dedupeKey);

    const normalizedExistingEffects = normalizeEquippedEffects(existing?.["equippedEffects"] ?? []);
    const normalizedItemEffects = normalizeEquippedEffects(item["equippedEffects"] ?? []);
    const mergedEffects = dedupeItemEffects([...normalizedExistingEffects, ...normalizedItemEffects]);

    const notes = mergeUniqueNotes(existing?.["notes"], item["notes"]);
    const promotedEffect = notes ? parseStatBonusEffectFromNotes(notes) : null;
    const effectsWithPromotion = promotedEffect ? dedupeItemEffects([...mergedEffects, promotedEffect]) : mergedEffects;
    const confidence =
      confidenceRank(existing?.["confidence"]) >= confidenceRank(item["confidence"])
        ? existing?.["confidence"] ?? item["confidence"]
        : item["confidence"];
    const hasUnresolvedMechanicalClaim = !!notes && hasMechanicalClaimInNotes(notes) && effectsWithPromotion.length === 0;
    const lowConfidenceUnresolvedClaim = confidence === "low" && hasUnresolvedMechanicalClaim;
    const contradictoryMechanicalClaim = !!notes && hasContradictoryMechanicalClaimInNotes(notes);
    const needsReview =
      (typeof existing?.["needsReview"] === "boolean" ? existing["needsReview"] : false) ||
      (typeof item["needsReview"] === "boolean" ? item["needsReview"] : false) ||
      hasUnresolvedMechanicalClaim ||
      lowConfidenceUnresolvedClaim ||
      contradictoryMechanicalClaim ||
      effectsWithPromotion.some(effectHasUnresolvedConditionalTrigger) ||
      hasUnsupportedDamageResponse(JSON.stringify({ notes, effects: effectsWithPromotion, mechanics: item["mechanics"] }));

    const next: Record<string, unknown> = {
      ...(existing ?? item),
      ...item,
      id: typeof (existing ?? item)["id"] === "string" ? (existing ?? item)["id"] : "",
      name,
      category,
      quantity:
        (typeof existing?.["quantity"] === "number" ? existing["quantity"] : 0) +
        (typeof item["quantity"] === "number" ? item["quantity"] : 1),
      notes,
      needsReview,
      confidence,
      officialMatch:
        (typeof existing?.["officialMatch"] === "boolean" && existing["officialMatch"] === true) ||
        (typeof item["officialMatch"] === "boolean" && item["officialMatch"] === true),
    };

    const tags = normalizeTags([...(Array.isArray(existing?.["tags"]) ? existing["tags"] : []), ...(Array.isArray(item["tags"]) ? item["tags"] : [])]);
    if (tags.length > 0) {
      next["tags"] = tags;
    }

    const damageDice = typeof existing?.["damageDice"] === "string" ? existing["damageDice"] : item["damageDice"];
    const damageType = typeof existing?.["damageType"] === "string" ? existing["damageType"] : item["damageType"];
    const damageModifier = typeof existing?.["damageModifier"] === "number" ? existing["damageModifier"] : item["damageModifier"];
    const attackAbility = typeof existing?.["attackAbility"] === "string" ? existing["attackAbility"] : item["attackAbility"];
    const isProficient = typeof existing?.["isProficient"] === "boolean" ? existing["isProficient"] : item["isProficient"];
    const weaponRange = typeof existing?.["weaponRange"] === "string" ? existing["weaponRange"] : item["weaponRange"];
    const additionalDamage = mergeAdditionalDamageEntries(
      normalizeAdditionalDamage(existing?.["additionalDamage"] ?? []),
      normalizeAdditionalDamage(item["additionalDamage"] ?? []),
    );

    if (typeof damageDice === "string") next["damageDice"] = damageDice;
    if (typeof damageType === "string") next["damageType"] = damageType;
    if (typeof damageModifier === "number") next["damageModifier"] = damageModifier;
    if (typeof attackAbility === "string") next["attackAbility"] = attackAbility;
    if (typeof isProficient === "boolean") next["isProficient"] = isProficient;
    if (typeof weaponRange === "string") next["weaponRange"] = weaponRange;
    if (additionalDamage.length > 0) next["additionalDamage"] = additionalDamage;

    if (effectsWithPromotion.length > 0) {
      next["equippedEffects"] = effectsWithPromotion;
    }

    if (!next["mechanics"]) {
      next["mechanics"] = existing?.["mechanics"] ?? item["mechanics"];
    }

    if (!Number.isSafeInteger(next["quantity"])) throw new Error("Combined item quantity exceeds safe integer range");
    mergedByName.set(dedupeKey, next);
  }

  return [...mergedByName.values()];
}

const ITEM_TAG_CANONICAL: Record<string, string> = {
  // Rarity
  "common": "Common",
  "uncommon": "Uncommon",
  "rare": "Rare",
  "very rare": "Very Rare",
  "legendary": "Legendary",
  "artifact": "Artifact",
  // Item type / category
  "consumable": "Consumable",
  "potion": "Potion",
  "scroll": "Scroll",
  "ammunition": "Ammunition",
  "poison": "Poison",
  "wondrous item": "Wondrous Item",
  "armor": "Armor",
  "weapon": "Weapon",
  "shield": "Shield",
  "ring": "Ring",
  "rod": "Rod",
  "staff": "Staff",
  "wand": "Wand",
  // Weapon properties (D&D 5e official)
  "finesse": "Finesse",
  "light": "Light",
  "heavy": "Heavy",
  "thrown": "Thrown",
  "two-handed": "Two-Handed",
  "versatile": "Versatile",
  "loading": "Loading",
  "reach": "Reach",
  "special": "Special",
  // Material / quality
  "magical": "Magical",
  "silvered": "Silvered",
  "adamantine": "Adamantine",
  "mithral": "Mithral",
  "masterwork": "Masterwork",
  // Armor-specific
  "stealth disadvantage": "Stealth Disadvantage",
  // Magic properties
  "cursed": "Cursed",
  "requires attunement": "Requires Attunement",
  "attunement": "Requires Attunement",
  "returning": "Returning",
  // Class-specific weapon tags
  "monk weapon": "Monk Weapon",
  "unarmed weapon": "Unarmed Weapon",
  // Usability
  "single use": "Single Use",
};

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of raw) {
    if (typeof t !== "string") continue;
    const canonical = ITEM_TAG_CANONICAL[t.toLowerCase().trim()];
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
  }
  return result;
}

function normalizedNotes(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isCustomMagicalWeaponOrArmor(input: {
  category: string;
  name: string;
  officialMatch: boolean;
  tags: string[];
  equippedEffects: Record<string, unknown>[];
}): boolean {
  if (!(input.category === "weapon" || input.category === "armor")) return false;
  if (input.officialMatch) return false;

  const name = input.name.toLowerCase();
  const hasMagicTag = input.tags.some((tag) => {
    const t = tag.toLowerCase();
    return t === "magical" || t === "cursed" || t === "requires attunement" || t.includes("rare") || t === "legendary" || t === "artifact";
  });
  const hasMagicName = /\+\d|enchant|enchanted|arcane|runic|magic|flame|frost|shadow|radiant|infernal|holy|cursed/.test(name);
  return hasMagicTag || hasMagicName || input.equippedEffects.length > 0;
}

function defaultItemDescription(nameRaw: string, category: string): string {
  const name = nameRaw.trim();
  const lower = name.toLowerCase();

  if (/\b(gold|gp|silver|sp|copper|cp|platinum|pp|electrum|ep|coin|coins)\b/.test(lower)) {
    return "Currency and valuables that can be spent with merchants, services, and downtime activities.";
  }
  if (lower.includes("scroll")) {
    return "A scroll that carries written instructions or magic; identify its purpose before use.";
  }
  if (lower.includes("soap")) {
    return "A mundane bar of soap useful for cleaning gear, disguises, and camp hygiene.";
  }

  switch (category) {
    case "weapon":
      return "A weapon intended for combat attacks.";
    case "armor":
      return "Protective armor that can be equipped to improve defense.";
    case "consumable":
      return "A consumable item that is used up when activated.";
    case "accessory":
      return "A wearable accessory that may provide passive benefits.";
    case "magic":
      return "A magical item with special properties; attunement may be required.";
    case "gear":
      return "General adventuring gear with practical utility.";
    case "treasure":
      return "Valuable treasure that can be traded, sold, or banked.";
    case "quest":
      return "A quest-related item tied to story objectives or clues.";
    default:
      return `An adventuring item: ${name || "unknown"}.`;
  }
}

function coerceItemNotes(input: {
  notesRaw: unknown;
  name: string;
  category: string;
  officialMatch: boolean;
  tags: string[];
  equippedEffects: Record<string, unknown>[];
}): string | null {
  const existing = normalizedNotes(input.notesRaw);
  if (existing) return existing;
  if (isCustomMagicalWeaponOrArmor(input)) return null;
  return defaultItemDescription(input.name, input.category);
}

function normalizeProposedItem(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) throw new Error("Item proposal must be an object");
  validateCreationItem(item);
  if (item["equippedEffects"] != null) {
    if (!Array.isArray(item["equippedEffects"])) throw new Error("Item effects must be an array");
    for (const effect of item["equippedEffects"]) {
      if (!isRecord(effect) || typeof effect["type"] !== "string" || !VALID_EFFECT_TYPES.has(effect["type"])
        || typeof effect["label"] !== "string" || !effect["label"].trim()) throw new Error("Invalid item effect");
      if (effect["type"] === "stat_bonus" && (typeof effect["statKey"] !== "string" || !VALID_STAT_KEYS.has(effect["statKey"])
        || typeof effect["statValue"] !== "number")) throw new Error("Invalid stat bonus effect");
    }
  }

  const category = sanitizeCategory(item["category"]);
  const isWeapon = category === "weapon";
  const name = typeof item["name"] === "string" ? item["name"].trim() : "Unknown Item";
  const damageDice = typeof item["damageDice"] === "string" ? item["damageDice"] : null;
  const damageModifier = typeof item["damageModifier"] === "number" ? item["damageModifier"] : null;
  const damageType = typeof item["damageType"] === "string" ? item["damageType"] : null;
  const abilityRaw = item["attackAbility"];
  const attackAbility = typeof abilityRaw === "string" && VALID_ABILITIES.has(abilityRaw) ? abilityRaw : null;
  const isProficient = typeof item["isProficient"] === "boolean" ? item["isProficient"] : null;
  const weaponRange = typeof item["weaponRange"] === "string" ? item["weaponRange"] : null;
  const additionalDamage = normalizeAdditionalDamage(item["additionalDamage"]);
  const equippedEffects = normalizeEquippedEffects(item["equippedEffects"]);
  const mechanics = normalizeParserItemMechanics(item["mechanics"]);
  const tags = normalizeTags(item["tags"]);
  const officialMatch = typeof item["officialMatch"] === "boolean" ? item["officialMatch"] : false;
  const notes = coerceItemNotes({
    notesRaw: item["notes"],
    name,
    category,
    officialMatch,
    tags,
    equippedEffects,
  });

  return {
    id: typeof item["id"] === "string" ? item["id"] : "",
    name,
    quantity: typeof item["quantity"] === "number" ? item["quantity"] : 1,
    category,
    notes,
    confidence: sanitizeConfidence(item["confidence"]),
    needsReview: item["needsReview"] === true || (mechanics != null && mechanics.review.reviewStatus !== "verified")
      || hasUnsupportedDamageResponse(JSON.stringify(item)),
    ...(typeof item["value"] === "number" ? { value: item["value"] } : {}),
    ...(typeof item["weight"] === "number" ? { weight: item["weight"] } : {}),
    ...(typeof item["subtype"] === "string" ? { subtype: item["subtype"].trim() } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(officialMatch ? { officialMatch } : {}),
    ...(isWeapon && damageDice ? { damageDice } : {}),
    ...(isWeapon && damageModifier !== null ? { damageModifier } : {}),
    ...(isWeapon && damageType ? { damageType } : {}),
    ...(isWeapon && attackAbility ? { attackAbility } : {}),
    ...(isWeapon && isProficient !== null ? { isProficient } : {}),
    ...(isWeapon && weaponRange ? { weaponRange } : {}),
    ...(isWeapon && additionalDamage.length > 0 ? { additionalDamage } : {}),
    ...(equippedEffects.length > 0 ? { equippedEffects } : {}),
    ...(mechanics ? { mechanics } : {}),
  };
}

function normalizeInventoryChange(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) return null;
  const category = sanitizeCategory(item["category"]);
  const name = typeof item["name"] === "string" ? item["name"] : "Unknown Item";
  const tags = normalizeTags(item["tags"]);
  const mechanics = normalizeParserItemMechanics(item["mechanics"]);
  const officialMatch = typeof item["officialMatch"] === "boolean" ? item["officialMatch"] : false;
  const notes = coerceItemNotes({
    notesRaw: item["notes"],
    name,
    category,
    officialMatch,
    tags,
    equippedEffects: [],
  });
  return {
    id: typeof item["id"] === "string" ? item["id"] : "",
    name,
    quantity: typeof item["quantity"] === "number" ? item["quantity"] : 1,
    category,
    notes,
    confidence: sanitizeConfidence(item["confidence"]),
    needsReview: item["needsReview"] === true || (mechanics != null && mechanics.review.reviewStatus !== "verified")
      || hasUnsupportedDamageResponse(JSON.stringify(item)),
    ...(tags.length > 0 ? { tags } : {}),
    ...(officialMatch ? { officialMatch } : {}),
    ...(mechanics ? { mechanics } : {}),
  };
}

function normalizeResourceChange(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) return null;
  return {
    resourceId: typeof item["resourceId"] === "string" ? item["resourceId"] : "",
    resourceName: typeof item["resourceName"] === "string" ? item["resourceName"] : "",
    delta: typeof item["delta"] === "number" ? item["delta"] : 0,
  };
}

function normalizeQuestActionShared(r: unknown): Record<string, unknown> | null {
  if (!isRecord(r)) return null;
  const name = typeof r["name"] === "string" ? r["name"].trim() : null;
  if (!name) return null;
  return {
    action: typeof r["action"] === "string" && VALID_ACT.has(r["action"]) ? r["action"] : "create",
    questId: typeof r["questId"] === "string" ? r["questId"] : null,
    name,
    type: typeof r["type"] === "string" && VALID_Q_TYPES.has(r["type"]) ? r["type"] : "side",
    status: typeof r["status"] === "string" && VALID_Q_STATUS.has(r["status"]) ? r["status"] : "active",
    description: typeof r["description"] === "string" ? r["description"].trim() || null : null,
    notes: typeof r["notes"] === "string" ? r["notes"].trim() || null : null,
    locationNames: Array.isArray(r["locationNames"]) ? r["locationNames"].filter((v): v is string => typeof v === "string") : [],
    personNames: Array.isArray(r["personNames"]) ? r["personNames"].filter((v): v is string => typeof v === "string") : [],
  };
}

function normalizePersonActionShared(r: unknown): Record<string, unknown> | null {
  if (!isRecord(r)) return null;
  const name = typeof r["name"] === "string" ? r["name"].trim() : null;
  if (!name) return null;
  return {
    action: typeof r["action"] === "string" && VALID_ACT.has(r["action"]) ? r["action"] : "create",
    personId: typeof r["personId"] === "string" ? r["personId"] : null,
    name,
    role: typeof r["role"] === "string" ? r["role"].trim() || null : null,
    relationship: typeof r["relationship"] === "string" && VALID_RELS.has(r["relationship"]) ? r["relationship"] : "unknown",
    description: typeof r["description"] === "string" ? r["description"].trim() || null : null,
    notes: typeof r["notes"] === "string" ? r["notes"].trim() || null : null,
  };
}

function normalizeLocationActionShared(r: unknown): Record<string, unknown> | null {
  if (!isRecord(r)) return null;
  const name = typeof r["name"] === "string" ? r["name"].trim() : null;
  if (!name) return null;
  return {
    action: typeof r["action"] === "string" && VALID_ACT.has(r["action"]) ? r["action"] : "create",
    locationId: typeof r["locationId"] === "string" ? r["locationId"] : null,
    name,
    description: typeof r["description"] === "string" ? r["description"].trim() || null : null,
  };
}

function normalizeRealmActionShared(r: unknown): Record<string, unknown> | null {
  if (!isRecord(r)) return null;
  const name = typeof r["name"] === "string" ? r["name"].trim() : null;
  if (!name) return null;
  return {
    action: typeof r["action"] === "string" && VALID_ACT.has(r["action"]) ? r["action"] : "create",
    realmId: typeof r["realmId"] === "string" ? r["realmId"] : null,
    name,
    description: typeof r["description"] === "string" ? r["description"].trim() || null : null,
    locationNames: Array.isArray(r["locationNames"]) ? r["locationNames"].filter((v): v is string => typeof v === "string") : [],
  };
}

// ---------------------------------------------------------------------------
// Phase 1 quest graph normalizers
// ---------------------------------------------------------------------------

const VALID_PARSER_REVIEW_STATES = new Set(["auto_apply", "needs_review", "ambiguous", "unsupported"]);
const VALID_EVIDENCE_CONFIDENCES = new Set(["high", "medium", "low"]);
const VALID_RELATIONSHIP_TYPES = new Set(["quest_giver", "located_in", "related_to", "part_of", "involves", "contained_in", "contains_location"]);
const VALID_RELEVANCE_ROLES = new Set(["quest_item", "reward", "key_item", "other"]);
const VALID_AMBIGUITY_KINDS = new Set(["entity_match_conflict", "entity_type_unclear", "relationship_unclear", "intent_unclear", "other"]);
const VALID_ENTITY_KINDS = new Set(["quest", "person", "location", "realm"]);

function normalizeParserReviewState(v: unknown): string {
  return typeof v === "string" && VALID_PARSER_REVIEW_STATES.has(v) ? v : "needs_review";
}

function normalizeQuestEvidenceArray(arr: unknown): Record<string, unknown>[] {
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((item) => {
    if (!isRecord(item)) return [];
    const excerpt = typeof item["excerpt"] === "string" ? item["excerpt"].trim() : null;
    if (!excerpt) return [];
    const confidence = typeof item["confidence"] === "string" && VALID_EVIDENCE_CONFIDENCES.has(item["confidence"]) ? item["confidence"] : "medium";
    return [{ excerpt, confidence }];
  });
}

function normalizeQuestUnresolvedFields(arr: unknown): Record<string, unknown>[] {
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((item) => {
    if (!isRecord(item)) return [];
    const field = typeof item["field"] === "string" ? item["field"].trim() : null;
    if (!field) return [];
    const reason = typeof item["reason"] === "string" ? item["reason"].trim() : "Unspecified";
    return [{ field, reason }];
  });
}

function normalizeGraphEntityRef(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const kind = typeof raw["kind"] === "string" && VALID_ENTITY_KINDS.has(raw["kind"]) ? raw["kind"] : null;
  const id = typeof raw["id"] === "string" ? raw["id"].trim() : null;
  const name = typeof raw["name"] === "string" ? raw["name"].trim() : null;
  if (!kind || !id || !name) return null;
  return { kind, id, name };
}

function normalizeGraphEntityCandidate(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const kind = typeof raw["kind"] === "string" && VALID_ENTITY_KINDS.has(raw["kind"]) ? raw["kind"] : null;
  const localKey = typeof raw["localKey"] === "string" ? raw["localKey"].trim() : null;
  const name = typeof raw["name"] === "string" ? raw["name"].trim() : null;
  if (!kind || !localKey || !name) return null;
  const proposedAttributes = isRecord(raw["proposedAttributes"]) ? raw["proposedAttributes"] : {};
  return {
    kind,
    localKey,
    name,
    proposedAttributes,
    reviewState: normalizeParserReviewState(raw["reviewState"]),
    evidence: normalizeQuestEvidenceArray(raw["evidence"]),
    unresolvedFields: normalizeQuestUnresolvedFields(raw["unresolvedFields"]),
  };
}

function normalizeGraphEntityLink(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const kind = typeof raw["kind"] === "string" && VALID_ENTITY_KINDS.has(raw["kind"]) ? raw["kind"] : null;
  const mentionedName = typeof raw["mentionedName"] === "string" ? raw["mentionedName"].trim() : null;
  const resolvedRef = normalizeGraphEntityRef(raw["resolvedRef"]);
  if (!kind || !mentionedName || !resolvedRef) return null;
  return {
    kind,
    mentionedName,
    resolvedRef,
    reviewState: normalizeParserReviewState(raw["reviewState"]),
    evidence: normalizeQuestEvidenceArray(raw["evidence"]),
  };
}

function normalizeGraphRelationshipOperation(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const rawType = typeof raw["relationshipType"] === "string" ? raw["relationshipType"].trim() : null;
  // Reject entries with no relationship type at all.
  if (!rawType) return null;
  const fromEntityId = typeof raw["fromEntityId"] === "string" ? raw["fromEntityId"].trim() : null;
  const toEntityId = typeof raw["toEntityId"] === "string" ? raw["toEntityId"].trim() : null;
  if (!fromEntityId || !toEntityId) return null;
  // Preserve the raw relationship type verbatim — do NOT coerce unknowns.
  // If the type is not in the recognized set, override reviewState to
  // "needs_review" so Phase 2 never silently routes on an unvalidated type.
  const typeIsKnown = VALID_RELATIONSHIP_TYPES.has(rawType);
  const callerReviewState = normalizeParserReviewState(raw["reviewState"]);
  const reviewState = typeIsKnown ? callerReviewState : "needs_review";
  return {
    relationshipType: rawType,
    relationshipTypeKnown: typeIsKnown,
    fromEntityId,
    toEntityId,
    label: typeof raw["label"] === "string" ? raw["label"].trim() || null : null,
    reviewState,
    evidence: normalizeQuestEvidenceArray(raw["evidence"]),
  };
}

function normalizeQuestObjectiveCandidate(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const description = typeof raw["description"] === "string" ? raw["description"].trim() : null;
  if (!description) return null;
  return {
    description,
    completed: parseBooleanLike(raw["completed"]),
  };
}

function normalizeQuestGraphPatch(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw["name"] === "string" ? raw["name"].trim() : null;
  if (!name) return null;
  return {
    questId: typeof raw["questId"] === "string" ? raw["questId"] : null,
    candidateLocalKey: typeof raw["candidateLocalKey"] === "string" ? raw["candidateLocalKey"].trim() || null : null,
    name,
    type: typeof raw["type"] === "string" && VALID_Q_TYPES.has(raw["type"]) ? raw["type"] : "side",
    status: typeof raw["status"] === "string" && VALID_Q_STATUS.has(raw["status"]) ? raw["status"] : "active",
    description: typeof raw["description"] === "string" ? raw["description"].trim() || null : null,
    notes: typeof raw["notes"] === "string" ? raw["notes"].trim() || null : null,
    objectives: (Array.isArray(raw["objectives"]) ? raw["objectives"] : []).map(normalizeQuestObjectiveCandidate).filter(Boolean),
    reviewState: normalizeParserReviewState(raw["reviewState"]),
    evidence: normalizeQuestEvidenceArray(raw["evidence"]),
  };
}

function normalizeGraphItemRelevanceRef(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const itemId = typeof raw["itemId"] === "string" ? raw["itemId"].trim() : null;
  if (!itemId) return null;
  const relevanceRole = typeof raw["relevanceRole"] === "string" && VALID_RELEVANCE_ROLES.has(raw["relevanceRole"]) ? raw["relevanceRole"] : "other";
  return {
    itemId,
    relevanceRole,
    notes: typeof raw["notes"] === "string" ? raw["notes"].trim() || null : null,
  };
}

function normalizeQuestInventoryLinkCandidate(raw: unknown, proposedItemsById: Map<string, string>): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const questRef = typeof raw["questRef"] === "string" ? raw["questRef"].trim() : null;
  if (!questRef) return null;
  const items = (Array.isArray(raw["items"]) ? raw["items"] : [])
    .map(normalizeGraphItemRelevanceRef)
    .filter((x): x is Record<string, unknown> => x !== null)
    .map((item) => {
      const itemId = typeof item["itemId"] === "string" ? item["itemId"] : null;
      if (!itemId) return item;
      const itemName = proposedItemsById.get(itemId);
      if (!itemName) return item;
      return { ...item, itemName };
    });
  return {
    questRef,
    items,
    reviewState: normalizeParserReviewState(raw["reviewState"]),
  };
}

function normalizeQuestParserAmbiguity(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const description = typeof raw["description"] === "string" ? raw["description"].trim() : null;
  if (!description) return null;
  const kind = typeof raw["kind"] === "string" && VALID_AMBIGUITY_KINDS.has(raw["kind"]) ? raw["kind"] : "other";
  const involvedKeys = Array.isArray(raw["involvedKeys"]) ? raw["involvedKeys"].filter((v): v is string => typeof v === "string") : [];
  return { kind, description, involvedKeys };
}

function normalizeQuestParserApplyHints(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  return {
    safeToAutoApply: parseBooleanLike(raw["safeToAutoApply"]),
    blockerReason: typeof raw["blockerReason"] === "string" ? raw["blockerReason"].trim() || null : null,
  };
}

/**
 * Normalize the questGraphResult block from the AI response.
 * Returns null (not throws) on any malformed input so legacy output is unaffected.
 */
export function normalizeQuestGraphResult(raw: unknown, proposedItems: Record<string, unknown>[] = []): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;
  try {
    const proposedItemsById = new Map(
      proposedItems.flatMap((item) => {
        const itemId = typeof item["id"] === "string" ? item["id"].trim() : null;
        const itemName = typeof item["name"] === "string" ? item["name"].trim() : null;
        return itemId && itemName ? [[itemId, itemName] as const] : [];
      })
    );
    return {
      questPatch: normalizeQuestGraphPatch(raw["questPatch"]) ?? null,
      entitiesToCreate: (Array.isArray(raw["entitiesToCreate"]) ? raw["entitiesToCreate"] : []).map(normalizeGraphEntityCandidate).filter(Boolean),
      entitiesToLink: (Array.isArray(raw["entitiesToLink"]) ? raw["entitiesToLink"] : []).map(normalizeGraphEntityLink).filter(Boolean),
      relationshipsToCreate: (Array.isArray(raw["relationshipsToCreate"]) ? raw["relationshipsToCreate"] : []).map(normalizeGraphRelationshipOperation).filter(Boolean),
      inventoryLinks: (Array.isArray(raw["inventoryLinks"]) ? raw["inventoryLinks"] : []).map((entry) => normalizeQuestInventoryLinkCandidate(entry, proposedItemsById)).filter(Boolean),
      ambiguities: (Array.isArray(raw["ambiguities"]) ? raw["ambiguities"] : []).map(normalizeQuestParserAmbiguity).filter(Boolean),
      reviewState: normalizeParserReviewState(raw["reviewState"]),
      applyHints: normalizeQuestParserApplyHints(raw["applyHints"]) ?? null,
    };
  } catch {
    // Malformed questGraphResult must not propagate — legacy output survives.
    return null;
  }
}

export function normalizeLootAnalysisResult(parsed: unknown): Record<string, unknown> {
  if (!isRecord(parsed)) {
    throw new Error("AI response is not a JSON object");
  }
  if (!Array.isArray(parsed["proposedItems"]) || parsed["proposedItems"].length > 100) throw new Error("Expected at most 100 proposed items");
  const rawItems = parsed["proposedItems"];
  const normalizedItems = rawItems.map(normalizeProposedItem).filter((item): item is Record<string, unknown> => item !== null);
  return {
    sourceType: "photo",
    summary: typeof parsed["summary"] === "string" ? parsed["summary"] : "Loot analyzed",
    confidence: sanitizeConfidence(parsed["confidence"]),
    rawAnalysis: typeof parsed["rawAnalysis"] === "string" ? parsed["rawAnalysis"] : null,
    proposedItems: repairAndDedupeLootItems(normalizedItems),
    proposedCurrencyChange: normalizeCurrencyChange(parsed["proposedCurrencyChange"]),
  };
}

const AI_MODEL = process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";
const AI_VISION_MODEL = process.env["OPENAI_VISION_MODEL"] ?? "gpt-4o-mini";

function parseNumberEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (typeof raw !== "string") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseIntegerEnv(name: string): number | null {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

const AI_TEMPERATURE = parseNumberEnv("AI_TEMPERATURE", 0.1, 0, 2);
const AI_TOP_P = parseNumberEnv("AI_TOP_P", 0.95, 0, 1);
const AI_SEED = parseIntegerEnv("AI_SEED");

function getDeterministicDecodeOptions(): { temperature: number; top_p: number; seed?: number } {
  if (AI_SEED === null) {
    return {
      temperature: AI_TEMPERATURE,
      top_p: AI_TOP_P,
    };
  }

  return {
    temperature: AI_TEMPERATURE,
    top_p: AI_TOP_P,
    seed: AI_SEED,
  };
}

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 8, fieldSize: 16 * 1024, parts: 9 },
});

type CharacterContext = {
  name?: string;
  class?: string;
  level?: number;
  currentHp?: number;
  maxHp?: number;
  proficiencyBonus?: number;
  resources?: Array<{ id: string; name: string; current: number; max: number }>;
};

router.post("/parse-update", async (req, res) => {
  const { text, characterContext, questContext, peopleContext, locationContext, realmContext, snarkyParseMode } = req.body as {
    text: string;
    characterContext?: CharacterContext;
    questContext?: { id: string; name: string; status: string; type: string }[];
    peopleContext?: { id: string; name: string; role?: string }[];
    locationContext?: { id: string; name: string }[];
    realmContext?: { id: string; name: string }[];
    snarkyParseMode?: boolean | string | number;
  };
  const snarkyMode = parseBooleanLike(snarkyParseMode);

  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Missing required field: text" });
    return;
  }

  const requestHash = computeAICallRequestHash({ body: req.body });
  const idempotencyStart = await beginRouteIdempotency({
    headerValue: req.headers["x-idempotency-key"],
    endpoint: "parse-update",
    requestHash,
  });
  if (idempotencyStart.kind === "respond") {
    if (idempotencyStart.replayHeader) {
      res.setHeader("X-Idempotency-Replay", "true");
    }
    res.status(idempotencyStart.statusCode).json(idempotencyStart.body);
    return;
  }

  const idempotencyKey = idempotencyStart.key;

  const persistIdempotentResponse = async (statusCode: number, body: unknown): Promise<void> => {
    await completeRouteIdempotency({
      key: idempotencyKey,
      canPersist: idempotencyStart.canPersist,
      endpoint: "parse-update",
      requestHash,
      statusCode,
      responseBody: body,
    });
  };

  const ctxLines: string[] = [];
  if (characterContext) {
    if (characterContext.name) ctxLines.push(`Character name: ${characterContext.name}`);
    if (characterContext.class) ctxLines.push(`Class: ${characterContext.class} (level ${characterContext.level ?? "?"})`);
    if (characterContext.currentHp != null) ctxLines.push(`HP: ${characterContext.currentHp}/${characterContext.maxHp ?? "?"}`);
    if (characterContext.proficiencyBonus) ctxLines.push(`Proficiency bonus: +${characterContext.proficiencyBonus}`);
    if (characterContext.resources?.length) {
      ctxLines.push("Resources (id | name | current/max):\n" + characterContext.resources.map((r) => `  - id="${r.id}" name="${r.name}" ${r.current}/${r.max}`).join("\n"));
    }
  }

  const qLines = (questContext ?? []).map(q => `  id="${q.id}" name="${q.name}" type="${q.type}" status="${q.status}"`).join("\n");
  const pLines = (peopleContext ?? []).map(p => `  id="${p.id}" name="${p.name}"${p.role ? ` role="${p.role}"` : ""}`).join("\n");
  const lLines = (locationContext ?? []).map(l => `  id="${l.id}" name="${l.name}"`).join("\n");
  const rLines = (realmContext ?? []).map(r => `  id="${r.id}" name="${r.name}"`).join("\n");

  const systemPrompt = `You are a D&D 5e character sheet assistant. Parse the player's natural language update and return a JSON object representing EVERYTHING that changed — stats, inventory, currency, and also any new quests, people, locations, or realms mentioned.

${ctxLines.length > 0 ? `Character context:\n${ctxLines.join("\n")}\n` : ""}${qLines ? `Existing quests:\n${qLines}\n` : ""}${pLines ? `Existing people:\n${pLines}\n` : ""}${lLines ? `Existing locations:\n${lLines}\n` : ""}${rLines ? `Existing realms:\n${rLines}\n` : ""}
Return ONLY a valid JSON object with this exact shape (include all fields even if empty):
{
  "rawInput": "<the original text>",
  "summary": "<concise human-readable summary of everything that happened>",
  "type": "<one of: hp | resource | inventory | currency | attack | condition | quest | mixed | unknown>",
  "proposedHpChange": null or { "delta": <number, negative=damage, positive=heal>, "type": "damage" or "heal" },
  "proposedCurrencyChange": null or { "cp": <number or null>, "sp": <number or null>, "ep": <number or null>, "gp": <number or null>, "pp": <number or null> },
  "proposedResourceChanges": [ { "resourceId": "<id if known else empty string>", "resourceName": "<name>", "delta": <number> } ],
  "proposedInventoryChanges": [ { "id": "<unique string>", "name": "<official D&D 5e item name if a match exists, else descriptive name>", "quantity": <number>, "category": "<weapon|armor|accessory|consumable|quest|magic|gear|treasure|map|currency|component|junk|other>", "notes": "<official item description if officialMatch true, else brief notes or null>", "confidence": "high or medium or low", "needsReview": <bool>, "officialMatch": <true if this is an exact official D&D 5e item>, "tags": ["<include ALL that apply — see tag rules below>"] } ],
  "proposedAttackCalc": null or { "attackName": "<name>", "rawRoll": <number>, "attackBonus": <number>, "totalToHit": <number> },
  "proposedConditionChanges": [ { "name": "<D&D 5e condition name e.g. Frightened, Poisoned, Prone>", "action": "add" or "remove", "source": "<what caused it, e.g. Ghoul's Gaze, or null>", "removeOn": [ <array of: "short_rest" | "long_rest" | "save" | "manual"> ], "notes": "<e.g. until end of next turn, or null>" } ],
  "questActions": [
    {
      "action": "create" or "update",
      "questId": "<existing quest id from context if updating, null if new>",
      "name": "<short descriptive quest name>",
      "type": "main" or "side" or "personal",
      "status": "active" or "completed" or "failed",
      "description": "<quest objective or null>",
      "notes": "<additional context or null>",
      "locationNames": ["<location names involved>"],
      "personNames": ["<person names involved>"]
    }
  ],
  "personActions": [
    {
      "action": "create" or "update",
      "personId": "<existing person id if found by name match, null if new>",
      "name": "<person name>",
      "role": "<e.g. Quest Giver, Merchant, Guard Captain — or null>",
      "relationship": "unknown" or "ally" or "neutral" or "hostile",
      "description": "<brief description or null>"
    }
  ],
  "locationActions": [
    {
      "action": "create" or "update",
      "locationId": "<existing location id if found by name match, null if new>",
      "name": "<location name>",
      "description": "<brief description or null>"
    }
  ],
  "realmActions": [
    {
      "action": "create" or "update",
      "realmId": "<existing realm id if found by name match, null if new>",
      "name": "<realm name>",
      "description": "<brief description or null>",
      "locationNames": ["<names of specific locations that are within or part of this realm>"]
    }
  ],
  "questGraphResult": null or {
    "questPatch": null or {
      "questId": "<existing quest id or null if new>",
      "candidateLocalKey": "<local key matching an entitiesToCreate entry if questId is null, else null>",
      "name": "<quest name>",
      "type": "main" or "side" or "personal",
      "status": "active" or "completed" or "failed",
      "description": "<quest objective or null>",
      "notes": "<extra context or null>",
      "objectives": [ { "description": "<objective text>", "completed": <bool> } ],
      "reviewState": "auto_apply" or "needs_review" or "ambiguous" or "unsupported",
      "evidence": [ { "excerpt": "<verbatim text from input>", "confidence": "high" or "medium" or "low" } ]
    },
    "entitiesToCreate": [
      {
        "kind": "quest" or "person" or "location" or "realm",
        "localKey": "<stable token, e.g. person_jacobs>",
        "name": "<entity name>",
        "proposedAttributes": { "<kind-specific fields>" },
        "reviewState": "auto_apply" or "needs_review" or "ambiguous" or "unsupported",
        "evidence": [ { "excerpt": "<verbatim text>", "confidence": "high" or "medium" or "low" } ],
        "unresolvedFields": [ { "field": "<field name>", "reason": "<why unclear>" } ]
      }
    ],
    "entitiesToLink": [
      {
        "kind": "quest" or "person" or "location" or "realm",
        "mentionedName": "<name as it appeared in input>",
        "resolvedRef": { "kind": "<same kind>", "id": "<existing id>", "name": "<stored name>" },
        "reviewState": "auto_apply" or "needs_review" or "ambiguous" or "unsupported",
        "evidence": [ { "excerpt": "<verbatim text>", "confidence": "high" or "medium" or "low" } ]
      }
    ],
    "relationshipsToCreate": [
      {
        "relationshipType": "quest_giver" or "located_in" or "related_to" or "part_of" or "involves" or any descriptive string (e.g. \"sibling_of\", \"enemy_of\", \"buried_at\"),
        "fromEntityId": "<existing entity id or candidateLocalKey>",
        "toEntityId": "<existing entity id or candidateLocalKey>",
        "label": "<optional human-readable label or null>",
        "reviewState": "auto_apply" or "needs_review" or "ambiguous" or "unsupported",
        "evidence": [ { "excerpt": "<verbatim text>", "confidence": "high" or "medium" or "low" } ]
      }
    ],
    "inventoryLinks": [
      {
        "questRef": "<existing quest id or candidateLocalKey>",
        "items": [ { "itemId": "<id from proposedInventoryChanges>", "relevanceRole": "quest_item" or "reward" or "key_item" or "other", "notes": "<or null>" } ],
        "reviewState": "auto_apply" or "needs_review" or "ambiguous" or "unsupported"
      }
    ],
    "ambiguities": [
      {
        "kind": "entity_match_conflict" or "entity_type_unclear" or "relationship_unclear" or "intent_unclear" or "other",
        "description": "<human-readable description>",
        "involvedKeys": ["<entity ids or localKeys involved>"]
      }
    ],
    "reviewState": "auto_apply" or "needs_review" or "ambiguous" or "unsupported",
    "applyHints": null or { "safeToAutoApply": <bool>, "blockerReason": "<or null>" }
  }
}

Rules:
- delta for HP is negative for damage, positive for healing
- For resources, use the exact id string from the context when you can match by name; use empty string for resourceId only if the resource is not in the context
- For inventory removals (consumed items), use negative quantity
- For attack roll parsing: if the user says they rolled a specific number for an attack, parse rawRoll, infer attackBonus from character context, compute totalToHit
- For any item added to inventory: check if it matches an official D&D 5e item (PHB/DMG/SRD). If so, set name to the exact official name, notes to the official description, confidence "high", and officialMatch true. For non-official items set officialMatch false. For ALL items (official or not), populate tags with every applicable label from these categories — include all that fit, omit none that apply:
  • Rarity (exactly one if known): Common | Uncommon | Rare | Very Rare | Legendary | Artifact
  • Item type (one or more if applicable): Potion | Scroll | Ammunition | Poison | Wondrous Item | Ring | Rod | Staff | Wand | Shield | Consumable
  • Weapon properties (all that apply to this specific weapon — do not guess, only include properties the item actually has): Finesse | Light | Heavy | Thrown | Two-Handed | Versatile | Loading | Reach | Special | Monk Weapon
  • Material / quality (only if the item is explicitly described as such): Magical | Silvered | Adamantine | Mithral | Masterwork
  • Magic properties: Requires Attunement | Cursed | Returning
  • Armor property: Stealth Disadvantage (only for armor/shields with this property)
  • Usability: Single Use (potions, one-use scrolls, etc.)
  Do NOT add tags that are not supported by the item's actual D&D 5e description.
- Only include items that are clearly mentioned; mark uncertain items with confidence "low" and needsReview true
- Always provide non-empty notes for each item. Exception: custom magical/enchanted weapon or armor can leave notes null if details are unknown. Coins/currency-like loot and scrolls must still receive a short default notes description.
- For conditions: detect any D&D 5e condition being applied or removed. Set removeOn based on the usual cure.
- For quests: if the player mentions receiving, accepting, completing, or failing a quest — add a questAction. Default type to "side" unless context implies main or personal. Match existing quests by name. Link to mentioned people and locations via personNames and locationNames.
- For people: if a named NPC is mentioned (quest giver, merchant, enemy, ally, etc.) and they are not in the existing people list, add a personAction with action "create". If they are already known, use action "update" with their existing id. Infer relationship from context (enemy → hostile, helped you → ally, etc.).
- REALM vs LOCATION — strict hierarchy you must follow: (1) Planes of existence (Shadow Realm, Astral Plane, Nine Hells, Feywild, Shadowfell, Mechanus, Limbo, etc.), kingdoms, empires, nations, continents, and large governing territories → ALWAYS use realmActions, NEVER locationActions. (2) Specific settlements (cities, towns, villages), dungeons, buildings, forests, roads, and geographic sub-features within a realm → use locationActions. When a player "travels through" or "visits" a named dimensional plane or kingdom-scale entity, it is a REALM. Examples: "Shadow Realm" → realmAction; "dark city of Scrill" → locationAction; "Kingdom of Ironhold" → realmAction; "Ironhold Castle" → locationAction.
- For locations: if a specific named place (city, town, dungeon, building, forest, road, etc.) is mentioned and is NOT a realm-scale entity, add a locationAction. Do NOT create locationActions for planes of existence, kingdoms, empires, or any realm-scale entity.
- For realms: create a realmAction for any plane of existence, kingdom, empire, nation, or large governing territory. In the locationNames array, include the names of any specific locations (cities, dungeons, etc.) explicitly mentioned as being within, inside, or part of that realm in the same update.
- Match existing quests, people, locations, and realms by name (case-insensitive) to their ids from context.
- Use "quest" as the type when the primary change is quest-related with no stat changes; use "mixed" when combining quest changes with other changes (gold found + quest received = mixed).
- If nothing changed, set type to "unknown" and leave all change arrays empty
- Do not hallucinate; only extract what is explicitly mentioned
- For location containment in questGraphResult.relationshipsToCreate: use "contained_in" when a specific location is inside a broader location (child -> parent), for example "Caves of Draggar" contained_in "Yor". Use "contains_location" only for the inverse parent -> child direction if that phrasing is more natural. Do not invent alternate containment verbs.
- questGraphResult rules: populate questGraphResult whenever questActions, personActions, locationActions, or realmActions are non-empty. If not applicable, set questGraphResult to null. Always mirror entities found in legacy arrays into entitiesToCreate or entitiesToLink — do not add entities to questGraphResult that are not also in the legacy arrays. Use entitiesToCreate for any entity with no context id match; use entitiesToLink for entities with a matching context id. Populate relationshipsToCreate to model directional links that are explicit in the text (e.g. quest giver relationship, location containment). Set reviewState "needs_review" on any entity or relationship where the input is ambiguous; use "auto_apply" only when the parser is confident. Set questGraphResult reviewState to "needs_review" if any member has reviewState "needs_review" or "ambiguous". Populate ambiguities for any uncertainty that could not be resolved. Do not invent entities that are not explicitly mentioned in the input.

Return ONLY the JSON, no explanation, no markdown fences.`;

  const toneInstruction = snarkyMode
    ? "Use a playful snarky tone for the summary field only. Keep the rest strictly machine-readable JSON."
    : "Use a neutral, concise tone for the summary field.";

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 4096,
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: `${systemPrompt}\n\n${toneInstruction}` },
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const responseBody = { error: "AI returned invalid JSON", raw };
      await persistIdempotentResponse(500, responseBody);
      res.status(500).json(responseBody);
      return;
    }
    try {
      const responseBody = normalizeQuickUpdateResult(parsed);
      await persistIdempotentResponse(200, responseBody);
      res.json(responseBody);
    } catch (normErr: unknown) {
      const msg = normErr instanceof Error ? normErr.message : String(normErr);
      const responseBody = { error: "AI response has unexpected shape", detail: msg, raw };
      await persistIdempotentResponse(502, responseBody);
      res.status(502).json(responseBody);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AI request failed:", message);
    // Fallback to mock response for demo purposes
    const mockResponse = {
      rawInput: text,
      summary: "Mock update: No changes detected (AI unavailable)",
      type: "unknown" as const,
      proposedHpChange: null,
      proposedCurrencyChange: null,
      proposedResourceChanges: [],
      proposedInventoryChanges: [],
      proposedAttackCalc: null,
      proposedConditionChanges: [],
      questActions: [],
      personActions: [],
      locationActions: [],
      realmActions: [],
      questGraphResult: null,
    };
    await persistIdempotentResponse(200, mockResponse);
    res.json(mockResponse);
  }
});

router.post("/analyze-loot", upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Missing image file" });
    return;
  }

  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const mimeType = req.file.mimetype || "image/jpeg";
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    res.status(400).json({ error: `Unsupported image type: ${mimeType}. Allowed: jpeg, png, webp, gif.` });
    return;
  }

  const requestHash = computeAICallRequestHash({
    body: req.body,
    fileBuffer: req.file.buffer,
    fileMimeType: mimeType,
  });
  const idempotencyStart = await beginRouteIdempotency({
    headerValue: req.headers["x-idempotency-key"],
    endpoint: "analyze-loot",
    requestHash,
  });
  if (idempotencyStart.kind === "respond") {
    if (idempotencyStart.replayHeader) {
      res.setHeader("X-Idempotency-Replay", "true");
    }
    res.status(idempotencyStart.statusCode).json(idempotencyStart.body);
    return;
  }

  const idempotencyKey = idempotencyStart.key;

  const persistIdempotentResponse = async (statusCode: number, body: unknown): Promise<void> => {
    await completeRouteIdempotency({
      key: idempotencyKey,
      canPersist: idempotencyStart.canPersist,
      endpoint: "analyze-loot",
      requestHash,
      statusCode,
      responseBody: body,
    });
  };

  const imageBase64 = req.file.buffer.toString("base64");
  const snarkyMode = parseBooleanLike(req.body?.["snarkyParseMode"]);

  const systemPrompt = `You are a D&D 5e loot identification assistant. The user has taken a photo of items they found (loot, dungeon chest, enemy drops, shop wares, magic item cards, spell scrolls, etc.).

Analyze the image and identify all D&D-relevant items visible. Return ONLY a valid JSON object with this exact shape:
{
  "sourceType": "photo",
  "summary": "<brief summary of what you see in the image>",
  "confidence": "high or medium or low",
  "rawAnalysis": "<1-2 sentence description of what you observe in the image>",
  "proposedItems": [
    {
      "id": "<unique string like item1 item2 etc>",
      "name": "<official D&D 5e item name if one exists, otherwise descriptive name>",
      "quantity": <number>,
      "category": "<weapon|armor|accessory|consumable|quest|magic|gear|treasure|map|currency|component|junk|other>",
      "notes": "<official item description/properties if officialMatch is true, otherwise brief description>",
      "confidence": "high or medium or low",
      "needsReview": <bool>,
      "officialMatch": <true if this item matches an official D&D 5e SRD/PHB item exactly, false otherwise>,
      "tags": ["<include ALL that apply — see tagging rules below>"],

      // For WEAPON category items only — include all that apply:
      "damageDice": "<primary damage dice e.g. 1d6, 2d4, 1d8+1d4>",
      "damageModifier": <flat bonus added to primary damage roll, usually 0>,
      "damageType": "<primary damage type e.g. slashing, bludgeoning, piercing, fire>",
      "attackAbility": "<strength or dexterity — which ability is used for attack rolls>",
      "isProficient": <true if a typical character is likely proficient>,
      "weaponRange": "<e.g. 5 ft or 60 ft or 80/320 ft>",
      "additionalDamage": [
        // Additional damage dice applied ON TOP of the primary damage.
        // Use this whenever a weapon deals more than one damage type, has
        // on-hit bonus dice (e.g. +1d4 fire), or is a paired set used together.
        { "dice": "<e.g. 1d4>", "damageType": "<e.g. psychic>", "damageModifier": <number or omit> }
      ],

      // For MAGIC, ACCESSORY, or ARMOR items — extract each passive property/feature into equippedEffects:
      "equippedEffects": [
        // Each named property or benefit the item grants becomes one effect entry.
        // Effect types:
        //   "stat_bonus"    — numeric modifier to a specific stat. Set statKey and statValue.
        //                     statKey must be one of: armorClass, speed, initiative, maxHp,
        //                     passivePerception, proficiencyBonus, strength, dexterity,
        //                     constitution, intelligence, wisdom, charisma
        //   "attack_damage" — bonus dice added to all attacks when equipped. Set attackDamageDice and attackDamageType.
        //   "spell"         — grants a spell (once per rest, at will, etc). Use label = spell name, description = usage.
        //   "buff"          — passive advantage, immunity, resistance, or conditional benefit.
        //   "feature"       — class feature extension or resource increase (e.g. +3 Ki points, extra spell slot).
        //   "note"          — general lore or property that does not fit above types.
        {
          "type": "<stat_bonus|attack_damage|spell|buff|feature|note>",
          "label": "<short name of the effect, e.g. Enhanced Ki, Iron Will, Tranquil Step>",
          "description": "<full text of what the effect does>",
          // Only for stat_bonus:
          "statKey": "<one of the valid stat keys above>",
          "statValue": <number — the bonus amount, e.g. 2 for +2 AC>,
          // Only for attack_damage:
          "attackDamageDice": "<e.g. 1d4>",
          "attackDamageType": "<e.g. radiant>",
          // Only for feature type — when the effect increases a tracked resource maximum:
          "resourceName": "<name of the resource this boosts, e.g. Ki, Focus, Spell Slots — match what a player would name their resource>",
          "resourceMaxBonus": <number — how much to add to the resource max, e.g. 3 for +3 Ki>,
          // Only for spell type — trackable limited-use spells:
          "uses": <number — how many times the spell can be used per rest, usually 1>,
          "resetOn": "<short_rest|long_rest|dawn — when uses recharge>"
        }
      ]
    }
  ],
  "proposedCurrencyChange": null or { "cp": <number or null>, "sp": <number or null>, "ep": <number or null>, "gp": <number or null>, "pp": <number or null> }
}

Rules:
- OFFICIAL ITEM VERIFICATION (highest priority): For every item you identify — especially potions, scrolls, spell components, named magic items, weapons, armor, and adventuring gear — first ask yourself: "Does an official D&D 5e item with this exact name or a very close match exist in the SRD, PHB, DMG, or Xanathar's Guide?" If yes:
  a) Use the exact official name (e.g. "Potion of Healing" not "Healing Potion", "Bag of Holding" not "Magic Bag")
  b) Set "notes" to the official item's description/properties
  c) Set "confidence" to "high" and "officialMatch" to true
  d) Populate "tags" with ALL applicable labels from every relevant category — include all that fit:
     • Rarity (exactly one if known): Common | Uncommon | Rare | Very Rare | Legendary | Artifact
     • Item type (one or more): Potion | Scroll | Ammunition | Poison | Wondrous Item | Ring | Rod | Staff | Wand | Shield | Consumable
     • Weapon properties (only those this item actually has — do not guess): Finesse | Light | Heavy | Thrown | Two-Handed | Versatile | Loading | Reach | Special | Monk Weapon
     • Material / quality (only if explicitly part of the item): Magical | Silvered | Adamantine | Mithral | Masterwork
     • Magic properties: Requires Attunement | Cursed | Returning
     • Armor: Stealth Disadvantage (only armor/shields with this property)
     • Usability: Single Use (potions, one-time-use scrolls, etc.)
  e) For non-official items or uncertain matches, set "officialMatch" to false. Still apply any tags that are clearly supported by what you can observe.
- Be specific about D&D item names (e.g. "Longsword +1", "Rope, Hempen (50 feet)")
- Use category "accessory" for wondrous items, rings, amulets, cloaks, boots, and similar wearable non-armor magic items
- If you see coins, estimate type and quantity, put in proposedCurrencyChange
- Mark items you are uncertain about as confidence "low" and needsReview true
- If the image is unclear or not loot-related, still return valid JSON with empty proposedItems and a helpful summary
- Do not make up items that are not visible; only propose items you can reasonably identify
- IMPORTANT: If the same item name appears more than once in the image (e.g. a card shown from two angles, a partially cropped stat block that continues elsewhere, or duplicate entries for the same item), consolidate all its properties into ONE entry. Merge their equippedEffects lists (union, no duplicates), combine notes, and prefer the most complete weapon stats. Never return two entries with the same item name.
- Always provide non-empty notes for each item. Exception: custom magical/enchanted weapon or armor can leave notes null if details are unknown. Coins/currency-like loot and scrolls must still receive a short default notes description.
- For each named property on a magic item card (bolded features, bullet points), create one effect entry in equippedEffects
- For weapon pairs that are intended to be used together (e.g. twin weapons that explicitly state combined damage rules), ALWAYS offer a single merged weapon entry as one of your proposals (in addition to, or instead of, the individual items). When merged: use the combined damage dice as the primary damageDice, and use additionalDamage for any secondary damage types from the individual pieces (e.g. one piece deals psychic, the other radiant — the merged weapon has both as additionalDamage entries).
- For any weapon with on-hit bonus damage (e.g. +1d4 radiant on a successful melee attack), put the bonus dice in additionalDamage, not in damageDice. The damageDice should be the base weapon damage only.
- Always populate damageDice, damageType, and additionalDamage for weapons whenever the information is available in the image.
- For stat_bonus effects, only use the listed statKey values. Resource increases (e.g. more Ki, more spell slots) should use type "feature" instead.

Return ONLY the JSON, no explanation, no markdown fences.`;

  const toneInstruction = snarkyMode
    ? "Use a playful snarky tone in summary/rawAnalysis only, while still returning strict valid JSON."
    : "Use a neutral, concise tone in summary/rawAnalysis.";

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_VISION_MODEL,
      max_completion_tokens: 8192,
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: `${systemPrompt}\n\n${toneInstruction}` },
        {
          role: "user",
          content: [
            { type: "text", text: "Please analyze this loot photo and identify the D&D items." },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const responseBody = { error: "AI returned invalid JSON", raw };
      await persistIdempotentResponse(500, responseBody);
      res.status(500).json(responseBody);
      return;
    }
    try {
      const responseBody = normalizeLootAnalysisResult(parsed);
      await persistIdempotentResponse(200, responseBody);
      res.json(responseBody);
    } catch (normErr: unknown) {
      const msg = normErr instanceof Error ? normErr.message : String(normErr);
      const responseBody = { error: "AI response has unexpected shape", detail: msg, raw };
      await persistIdempotentResponse(502, responseBody);
      res.status(502).json(responseBody);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const lowerMessage = message.toLowerCase();
    const modelCapabilityError = lowerMessage.includes("image_url is only supported") || lowerMessage.includes("invalid content type");
    const responseBody = modelCapabilityError
      ? {
          error: "AI request failed",
          detail:
            `Configured model (${AI_VISION_MODEL}) does not support image inputs. ` +
            `Set OPENAI_VISION_MODEL to a vision-capable model (for example gpt-4o-mini).`,
        }
      : { error: "AI request failed", detail: message };
    await persistIdempotentResponse(500, responseBody);
    res.status(500).json(responseBody);
  }
});

router.post("/generate-loot", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const rarity = Array.isArray(req.body?.rarity)
    ? req.body.rarity.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const categories = Array.isArray(req.body?.categories)
    ? req.body.categories.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const snarkyMode = parseBooleanLike(req.body?.snarkyParseMode);

  if (!prompt) {
    res.status(400).json({ error: "Missing required field: prompt" });
    return;
  }

  const rarityBlock = rarity.length > 0 ? `\nAllowed rarity tags: ${rarity.join(", ")}` : "";
  const categoryBlock = categories.length > 0 ? `\nAllowed item categories: ${categories.join(", ")}` : "";
  const toneInstruction = snarkyMode
    ? "Use playful snark in summary/rawAnalysis only while keeping strict valid JSON."
    : "Use neutral concise summary/rawAnalysis. Return strict valid JSON.";

  const systemPrompt = `You are a D&D 5e loot generation assistant for a DM.
Generate practical loot that fits the DM's prompt and constraints.

Return ONLY a valid JSON object with this exact shape:
{
  "sourceType": "text",
  "summary": "<1 sentence>",
  "confidence": "high or medium or low",
  "rawAnalysis": "<1-2 sentence rationale>",
  "proposedItems": [
    {
      "id": "<unique id>",
      "name": "<item name>",
      "quantity": <number>,
      "category": "<weapon|armor|accessory|consumable|quest|magic|gear|treasure|map|currency|component|junk|other>",
      "notes": "<short note>",
      "confidence": "high or medium or low",
      "needsReview": <boolean>,
      "tags": ["<rarity/type tags>"]
    }
  ],
  "proposedCurrencyChange": null
}

Rules:
- Only return item categories from the allowed categories when provided.
- Include rarity tags from allowed rarity when provided.
- Keep generated items useful and coherent for the DM's request.
- Avoid duplicate item names.
- Return 3-8 items unless prompt explicitly asks otherwise.${rarityBlock}${categoryBlock}
${toneInstruction}

Return ONLY JSON.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 4096,
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    try {
      res.json(normalizeLootAnalysisResult(parsed));
    } catch (normErr: unknown) {
      const msg = normErr instanceof Error ? normErr.message : String(normErr);
      res.status(502).json({ error: "AI response has unexpected shape", detail: msg, raw });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "AI request failed", detail: message });
  }
});

router.post("/parse-quest-reward", async (req, res) => {
  const { text, questName, questContext, peopleContext } = req.body as {
    text?: string;
    questName?: string;
    questContext?: Array<{ id: string; name: string; description?: string; notes?: string }>;
    peopleContext?: Array<{ id: string; name: string; role?: string }>;
  };

  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Missing required field: text" });
    return;
  }

  const otherQuests = (questContext ?? [])
    .map(q => `  id="${q.id}" name="${q.name}"${q.description ? ` desc="${q.description}"` : ""}${q.notes ? ` notes="${q.notes}"` : ""}`)
    .join("\n");
  const knownPeople = (peopleContext ?? [])
    .map(p => `  id="${p.id}" name="${p.name}"${p.role ? ` role="${p.role}"` : ""}`)
    .join("\n");

  const contextBlock = [
    questName ? `Quest being completed: "${questName}"` : "",
    otherQuests ? `Other active quests:\n${otherQuests}` : "",
    knownPeople ? `Known people:\n${knownPeople}` : "",
  ].filter(Boolean).join("\n\n");

  const systemPrompt = `You are a D&D 5e quest resolution engine. Given a quest being completed and its description/notes, determine:
1. Any explicit rewards the player receives (currency, items)
2. Any people who are killed or die as a direct result of completing this quest
3. Other active quests that become impossible to complete as a consequence

${contextBlock}

Return ONLY a valid JSON object with this exact shape:
{
  "hasRewards": <true if any explicit rewards are found, false otherwise>,
  "summary": "<one sentence describing rewards, e.g. '1000 gp from Jack Scurvy', or 'No rewards mentioned' if none>",
  "proposedCurrencyChange": null or { "cp": <number or null>, "sp": <number or null>, "ep": <number or null>, "gp": <number or null>, "pp": <number or null> },
  "proposedInventoryChanges": [
    {
      "id": "<unique string like item1, item2>",
      "name": "<official D&D 5e item name if a match exists, else descriptive name>",
      "quantity": <positive number>,
      "category": "<weapon|armor|accessory|consumable|quest|magic|gear|treasure|map|currency|component|junk|other>",
      "notes": "<official item description if officialMatch true, else brief description or null>",
      "confidence": "high or medium or low",
      "needsReview": <true if uncertain>,
      "officialMatch": <true if exact official D&D 5e item>,
      "tags": ["<all applicable — see tag rules>"]
    }
  ],
  "killedPeople": [
    {
      "personId": "<id from Known people if name matches, otherwise null>",
      "name": "<person's name>",
      "killedBy": "<concise description, e.g. 'the player', 'poisoned by the player', 'the player's party'>"
    }
  ],
  "questsToFail": [
    {
      "questId": "<id from Other active quests — must be exact>",
      "questName": "<quest name>",
      "reason": "<one sentence explaining why, e.g. 'The mayor was the quest giver and can no longer reward the player'>"
    }
  ],
  "realmActions": [
    {
      "action": "create" or "update",
      "realmId": "<existing realm id if found by name match, null if new>",
      "name": "<realm name>",
      "description": "<brief description or null>"
    }
  ]
}

Tag rules for items — include all that apply:
  • Rarity: Common | Uncommon | Rare | Very Rare | Legendary | Artifact
  • Item type: Potion | Scroll | Ammunition | Poison | Wondrous Item | Ring | Rod | Staff | Wand | Shield | Consumable
  • Weapon properties (only those the item actually has): Finesse | Light | Heavy | Thrown | Two-Handed | Versatile | Loading | Reach | Special
  • Material: Magical | Silvered | Adamantine | Mithral | Masterwork
  • Magic: Requires Attunement | Cursed | Returning
  • Armor: Stealth Disadvantage | Single Use

Rules for rewards:
- Extract ONLY explicit rewards — bounty payments, stated treasure, items given as prizes
- Do NOT treat quest objectives as rewards (the stolen sword is not yours, it's the quest item)
- Currency: gold/gp → gp; silver/sp → sp; copper/cp → cp; platinum/pp → pp; electrum/ep → ep
- If no rewards mentioned, hasRewards false, null currency, empty items

Rules for killedPeople:
- Only include people explicitly killed or dying as a DIRECT result of completing this quest
- Match by name (case-insensitive) to Known people to find their id
- killedBy should be concise and accurate (usually "the player" or "the player's party")
- Do NOT include enemies killed in passing; focus on named NPCs the player deliberately kills

Rules for questsToFail:
- Only include quests from the Other active quests list (never the quest being completed)
- Only fail a quest if completing the current quest makes it LOGICALLY IMPOSSIBLE:
  * A key living NPC required to complete the other quest is now dead (quest giver who must pay out, a person who must be rescued, someone who must be spoken to)
  * The current quest's outcome directly contradicts the other quest's objective
- Do NOT fail quests that are merely related, thematically connected, or given by the same faction
- Use the exact questId from the provided list
- Return an empty array if no quests become impossible

Return ONLY the JSON, no explanation, no markdown fences`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 2048,
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text || "(no quest description provided)" },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    if (!isRecord(parsed)) {
      res.status(502).json({ error: "AI response is not a JSON object" });
      return;
    }

    const rawItems = Array.isArray(parsed["proposedInventoryChanges"]) ? parsed["proposedInventoryChanges"] : [];
    const currency = normalizeCurrencyChange(parsed["proposedCurrencyChange"]);
    const items = rawItems.map(normalizeProposedItem).filter(Boolean);
    const hasRewards = typeof parsed["hasRewards"] === "boolean"
      ? parsed["hasRewards"]
      : items.length > 0 || currency !== null;

    const normalizeKilledPerson = (r: unknown) => {
      if (!isRecord(r)) return null;
      const name = typeof r["name"] === "string" ? r["name"].trim() : null;
      if (!name) return null;
      return {
        personId: typeof r["personId"] === "string" ? r["personId"] : null,
        name,
        killedBy: typeof r["killedBy"] === "string" ? r["killedBy"].trim() || "the player" : "the player",
      };
    };

    const normalizeQuestToFail = (r: unknown) => {
      if (!isRecord(r)) return null;
      const questId = typeof r["questId"] === "string" ? r["questId"].trim() : null;
      const questName = typeof r["questName"] === "string" ? r["questName"].trim() : null;
      if (!questId || !questName) return null;
      return {
        questId,
        questName,
        reason: typeof r["reason"] === "string" ? r["reason"].trim() || "Quest is no longer completable" : "Quest is no longer completable",
      };
    };

    res.json({
      hasRewards,
      summary: typeof parsed["summary"] === "string" ? parsed["summary"] : "Quest completed",
      proposedCurrencyChange: currency,
      proposedInventoryChanges: items,
      killedPeople: (Array.isArray(parsed["killedPeople"]) ? parsed["killedPeople"] : []).map(normalizeKilledPerson).filter(Boolean),
      questsToFail: (Array.isArray(parsed["questsToFail"]) ? parsed["questsToFail"] : []).map(normalizeQuestToFail).filter(Boolean),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "AI request failed", detail: message });
  }
});

router.post("/repair-import", async (req, res) => {
  const { rawText } = req.body as { rawText?: string };

  if (!rawText || typeof rawText !== "string") {
    res.status(400).json({ error: "Missing required field: rawText" });
    return;
  }

  const systemPrompt = `You are a D&D 5e character sheet data repair assistant.
The user has pasted text that is supposed to be a character sheet export but it failed to parse.
Your job is to extract as much useful data as possible and return a valid CharacterSnapshot JSON.

The CharacterSnapshot schema is:
{
  "_version": 1,
  "character": {
    "id": "<string>",
    "name": "<string — REQUIRED>",
    "class": "<string — REQUIRED, e.g. Fighter, Wizard, Monk>",
    "subclass": "<string or omit>",
    "level": <number 1-20>,
    "race": "<string>",
    "background": "<string>",
    "proficiencyBonus": <number>,
    "armorClass": <number>,
    "currentHp": <number>,
    "maxHp": <number>,
    "tempHp": <number default 0>,
    "speed": <number, usually 30>,
    "initiative": <number>,
    "abilityScores": { "strength": <n>, "dexterity": <n>, "constitution": <n>, "intelligence": <n>, "wisdom": <n>, "charisma": <n> },
    "savingThrows": [ { "ability": "<str|dex|con|int|wis|cha>", "proficient": <bool>, "modifier": <number> } ],
    "skills": [ { "name": "<skill name>", "ability": "<str|dex|con|int|wis|cha>", "proficient": <bool>, "expertise": <bool>, "modifier": <number> } ],
    "passivePerception": <number>,
    "currency": { "cp": <n>, "sp": <n>, "ep": <n>, "gp": <n>, "pp": <n> },
    "notes": "<string>"
  },
  "attacks": [
    { "id": "<string>", "name": "<string>", "attackBonus": <number>, "damageDice": "<e.g. 1d8>", "damageModifier": <number>, "damageType": "<e.g. slashing>", "range": "<optional>", "notes": "<optional>", "reminders": [] }
  ],
  "resources": [
    { "id": "<string>", "name": "<string>", "current": <number>, "max": <number>, "resetOn": "<short_rest|long_rest|dawn|custom>" }
  ],
  "inventory": [
    { "id": "<string>", "name": "<string>", "quantity": <number>, "equipped": <bool>, "category": "<weapon|armor|accessory|consumable|quest|magic|gear|treasure|map|currency|component|junk|other>", "notes": "<optional>" }
  ],
  "conditions": [
    { "id": "<string>", "name": "<D&D 5e condition name>", "removeOn": ["manual"], "source": "<optional>", "notes": "<optional>" }
  ]
}

Rules:
- Extract as much data as you can from the input text even if it is malformed JSON, truncated, or from a different format
- Always include character.name and character.class — infer them if you can, otherwise use "Unknown"
- For missing numeric fields use sensible defaults (level 1, AC 10, HP 10, speed 30, all ability scores 10)
- For missing arrays (savingThrows, skills) use empty arrays []
- For missing currency use all zeros
- Generate a unique id for each entity that doesn't have one (use simple strings like "c1", "atk1", "res1", "inv1")
- Do not invent attacks, resources, or inventory items that are not mentioned in the input
- Return ONLY valid JSON, no explanation, no markdown fences`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 8192,
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Please repair this character data:\n\n${rawText}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    if (!isRecord(parsed)) {
      res.status(500).json({ error: "AI response is not a JSON object" });
      return;
    }

    // Light normalization — ensure required structure exists
    const character = isRecord(parsed["character"]) ? parsed["character"] : {};
    const charName = typeof character["name"] === "string" ? character["name"] : "Unknown";
    const charClass = typeof character["class"] === "string" ? character["class"] : "Unknown";

    const snapshot = {
      _version: 1,
      character: { ...character, name: charName, class: charClass },
      attacks: Array.isArray(parsed["attacks"]) ? parsed["attacks"] : [],
      resources: Array.isArray(parsed["resources"]) ? parsed["resources"] : [],
      inventory: Array.isArray(parsed["inventory"]) ? parsed["inventory"] : [],
      conditions: Array.isArray(parsed["conditions"]) ? parsed["conditions"] : [],
    };

    res.json(snapshot);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "AI request failed", detail: message });
  }
});

// ─── POST /api/ai/level-up ───────────────────────────────────────────────────
// Body: { character: { level, class, subclass, race } }
// Returns comprehensive D&D 5e level-up data with hardcoded rules + AI feature descriptions

// ── Hardcoded D&D 5e mechanical tables ────────────────────────────────────────

const HIT_DIE_BY_CLASS: Record<string, number> = {
  barbarian: 12,
  fighter: 10, paladin: 10, ranger: 10,
  bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8, artificer: 8,
  sorcerer: 6, wizard: 6,
};

const ASI_LEVELS_BY_CLASS: Record<string, number[]> = {
  fighter: [4, 6, 8, 12, 14, 16, 19],
  rogue:   [4, 8, 10, 12, 16, 19],
  _default:[4, 8, 12, 16, 19],
};

function luProfBonus(level: number): number {
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

function luHitDie(cls: string): number {
  const c = cls.toLowerCase();
  for (const [key, die] of Object.entries(HIT_DIE_BY_CLASS)) {
    if (c.includes(key)) return die;
  }
  return 8;
}

function luIsAsi(cls: string, level: number): boolean {
  const c = cls.toLowerCase();
  const table = c.includes("fighter") ? ASI_LEVELS_BY_CLASS.fighter
    : c.includes("rogue") ? ASI_LEVELS_BY_CLASS.rogue
    : ASI_LEVELS_BY_CLASS._default;
  return table.includes(level);
}

// Full caster (Bard, Cleric, Druid, Sorcerer, Wizard) slot counts [level][slotLevel-1]
const LU_FULL: Record<number, number[]> = {
  1: [2,0,0,0,0,0,0,0,0], 2: [3,0,0,0,0,0,0,0,0], 3: [4,2,0,0,0,0,0,0,0],
  4: [4,3,0,0,0,0,0,0,0], 5: [4,3,2,0,0,0,0,0,0], 6: [4,3,3,0,0,0,0,0,0],
  7: [4,3,3,1,0,0,0,0,0], 8: [4,3,3,2,0,0,0,0,0], 9: [4,3,3,3,1,0,0,0,0],
  10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0],
  13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0],
  16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1],
  19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1],
};

// Half caster (Paladin, Ranger) — starts at level 2
const LU_HALF: Record<number, number[]> = {
  1: [0,0,0,0,0,0,0,0,0], 2: [2,0,0,0,0,0,0,0,0], 3: [3,0,0,0,0,0,0,0,0],
  4: [3,0,0,0,0,0,0,0,0], 5: [4,2,0,0,0,0,0,0,0], 6: [4,2,0,0,0,0,0,0,0],
  7: [4,3,0,0,0,0,0,0,0], 8: [4,3,0,0,0,0,0,0,0], 9: [4,3,2,0,0,0,0,0,0],
  10:[4,3,2,0,0,0,0,0,0], 11:[4,3,3,0,0,0,0,0,0], 12:[4,3,3,0,0,0,0,0,0],
  13:[4,3,3,1,0,0,0,0,0], 14:[4,3,3,1,0,0,0,0,0], 15:[4,3,3,2,0,0,0,0,0],
  16:[4,3,3,2,0,0,0,0,0], 17:[4,3,3,3,1,0,0,0,0], 18:[4,3,3,3,1,0,0,0,0],
  19:[4,3,3,3,2,0,0,0,0], 20:[4,3,3,3,2,0,0,0,0],
};

// Warlock Pact Magic
const LU_WARLOCK: Record<number, number[]> = {
  1: [1,0,0,0,0,0,0,0,0], 2: [2,0,0,0,0,0,0,0,0], 3: [0,2,0,0,0,0,0,0,0],
  4: [0,2,0,0,0,0,0,0,0], 5: [0,0,2,0,0,0,0,0,0], 6: [0,0,2,0,0,0,0,0,0],
  7: [0,0,0,2,0,0,0,0,0], 8: [0,0,0,2,0,0,0,0,0], 9: [0,0,0,0,2,0,0,0,0],
  10:[0,0,0,0,2,0,0,0,0], 11:[0,0,0,0,3,0,0,0,0], 12:[0,0,0,0,3,0,0,0,0],
  13:[0,0,0,0,3,0,0,0,0], 14:[0,0,0,0,3,0,0,0,0], 15:[0,0,0,0,3,0,0,0,0],
  16:[0,0,0,0,3,0,0,0,0], 17:[0,0,0,0,4,0,0,0,0], 18:[0,0,0,0,4,0,0,0,0],
  19:[0,0,0,0,4,0,0,0,0], 20:[0,0,0,0,4,0,0,0,0],
};

// Third caster (Eldritch Knight Fighter, Arcane Trickster Rogue)
const LU_THIRD: Record<number, number[]> = {
  1: [0,0,0,0,0,0,0,0,0], 2: [0,0,0,0,0,0,0,0,0], 3: [2,0,0,0,0,0,0,0,0],
  4: [3,0,0,0,0,0,0,0,0], 5: [3,0,0,0,0,0,0,0,0], 6: [3,0,0,0,0,0,0,0,0],
  7: [4,2,0,0,0,0,0,0,0], 8: [4,2,0,0,0,0,0,0,0], 9: [4,2,0,0,0,0,0,0,0],
  10:[4,3,0,0,0,0,0,0,0], 11:[4,3,0,0,0,0,0,0,0], 12:[4,3,0,0,0,0,0,0,0],
  13:[4,3,2,0,0,0,0,0,0], 14:[4,3,2,0,0,0,0,0,0], 15:[4,3,2,0,0,0,0,0,0],
  16:[4,3,3,0,0,0,0,0,0], 17:[4,3,3,0,0,0,0,0,0], 18:[4,3,3,0,0,0,0,0,0],
  19:[4,3,3,1,0,0,0,0,0], 20:[4,3,3,1,0,0,0,0,0],
};

type LuCasterType = "full" | "half" | "warlock" | "third" | "none";

function luCasterType(cls: string, subclass: string): LuCasterType {
  const c = cls.toLowerCase();
  const s = subclass.toLowerCase();
  if (c.includes("wizard") || c.includes("sorcerer") || c.includes("bard") ||
      c.includes("cleric") || c.includes("druid")) return "full";
  if (c.includes("warlock")) return "warlock";
  if (c.includes("paladin") || c.includes("ranger") || c.includes("artificer")) return "half";
  if (s.includes("eldritch knight") || s.includes("arcane trickster")) return "third";
  return "none";
}

function luSlotTable(casterType: LuCasterType): Record<number, number[]> | null {
  if (casterType === "full") return LU_FULL;
  if (casterType === "half") return LU_HALF;
  if (casterType === "warlock") return LU_WARLOCK;
  if (casterType === "third") return LU_THIRD;
  return null;
}

function luSlots(casterType: LuCasterType, level: number): Array<{ level: number; total: number }> {
  const table = luSlotTable(casterType);
  if (!table) return [];
  const row = table[Math.max(1, Math.min(20, level))] ?? [];
  return row
    .map((total, idx) => ({ level: idx + 1, total }))
    .filter(s => s.total > 0);
}

router.post("/level-up", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const character = isRecord(body["character"]) ? body["character"] : {};
    const currentLevel = typeof character["level"] === "number" ? character["level"] : 1;
    const charClass = typeof character["class"] === "string" ? character["class"] : "Fighter";
    const charSubclass = typeof character["subclass"] === "string" ? character["subclass"] : "";
    const charRace = typeof character["race"] === "string" ? character["race"] : "Human";

    if (currentLevel >= 20) {
      res.status(400).json({ error: "Character is already at maximum level (20)." });
      return;
    }

    const newLevel = currentLevel + 1;
    const proficiencyBonus = luProfBonus(newLevel);
    const hitDie = luHitDie(charClass);
    const abilityScoreImprovement = luIsAsi(charClass, newLevel);
    const casterType = luCasterType(charClass, charSubclass);
    const newSpellSlots = luSlots(casterType, newLevel);
    const oldSpellSlots = luSlots(casterType, currentLevel);

    // Compute only the newly gained spell slots
    const spellSlotsGained: Array<{ level: number; gained: number }> = [];
    for (const s of newSpellSlots) {
      const old = oldSpellSlots.find(o => o.level === s.level);
      const gained = s.total - (old?.total ?? 0);
      if (gained > 0) spellSlotsGained.push({ level: s.level, gained });
    }

    // AI: feature names + descriptions at exactly this level
    const classDesc = charSubclass ? `${charClass} (${charSubclass})` : charClass;
    const systemPrompt = `You are a D&D 5e 2014 rules expert. A ${charRace} ${classDesc} is reaching level ${newLevel}.

List ONLY the class features, traits, or abilities gained at EXACTLY level ${newLevel} — not features from earlier levels.

Return ONLY valid JSON (no markdown fences):
{
  "newFeatures": [
    { "name": "Feature Name", "description": "1–2 sentence accurate description of what it does in D&D 5e 2014." }
  ],
  "spellsKnownGained": null or a number (how many new spells they may add to their known spells list, if applicable),
  "cantripsKnownGained": null or a number,
  "notes": "One sentence summary of the most impactful things gained at this level."
}

Rules:
- If this level gives an Ability Score Improvement, include it in newFeatures as: { "name": "Ability Score Improvement", "description": "You can increase one ability score by 2, or two different ability scores by 1 each. You may also take a Feat instead." }
- Include subclass features gained at this specific level if the subclass is known.
- For Fighters at level 5, include Extra Attack.
- For Monks at level 5, include Extra Attack and Stunning Strike.
- For Rogues at level 5, include Uncanny Dodge.
- Keep feature list accurate and concise. No invented features.
- spellsKnownGained only applies to known-spells classes (Sorcerer, Bard, Ranger, Warlock).
- cantripsKnownGained only if they actually gain a cantrip at this level.
Return ONLY the JSON.`;

    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 1500,
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Level ${newLevel} ${classDesc} features.` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON for level-up", raw });
      return;
    }

    if (!isRecord(parsed)) {
      res.status(500).json({ error: "AI level-up response not an object" });
      return;
    }

    const newFeatures = Array.isArray(parsed["newFeatures"])
      ? (parsed["newFeatures"] as unknown[]).map(f => {
          if (!isRecord(f)) return null;
          const name = typeof f["name"] === "string" ? f["name"].trim() : null;
          if (!name) return null;
          const description = typeof f["description"] === "string" ? f["description"].trim() : "";
          return { name, description };
        }).filter(Boolean)
      : [];

    const spellsKnownGained = typeof parsed["spellsKnownGained"] === "number" ? parsed["spellsKnownGained"] : null;
    const cantripsKnownGained = typeof parsed["cantripsKnownGained"] === "number" ? parsed["cantripsKnownGained"] : null;
    const notes = typeof parsed["notes"] === "string" ? parsed["notes"].trim() : `Level ${newLevel} achieved.`;

    res.json({
      newLevel,
      proficiencyBonus,
      hitDie,
      abilityScoreImprovement,
      newFeatures,
      casterType,
      newSpellSlots,
      spellSlotsGained,
      spellsKnownGained,
      cantripsKnownGained,
      notes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Level-up AI request failed", detail: message });
  }
});

// ─── POST /api/ai/recommend-feat ─────────────────────────────────────────────
// Body: { character: { level, class, subclass, race, abilityScores, skills, feats, inventory } }
// Returns: { featName: string; reason: string }
router.post("/recommend-feat", async (req, res) => {
  try {
    const openai = getOpenAI();
    const body = req.body as Record<string, unknown>;
    const ch = isRecord(body["character"]) ? body["character"] : {};
    const level = typeof ch["level"] === "number" ? ch["level"] : 1;
    const charClass = typeof ch["class"] === "string" ? ch["class"] : "Fighter";
    const subclass = typeof ch["subclass"] === "string" ? ch["subclass"] : "";
    const race = typeof ch["race"] === "string" ? ch["race"] : "Human";
    const abilityScores = isRecord(ch["abilityScores"]) ? ch["abilityScores"] : {};
    const skills = Array.isArray(ch["skills"]) ? (ch["skills"] as unknown[]).filter((s): s is string => typeof s === "string").join(", ") : "";
    const knownFeats = Array.isArray(ch["feats"]) ? (ch["feats"] as unknown[]).map((f) => (isRecord(f) && typeof f["name"] === "string" ? f["name"] : "")).filter(Boolean).join(", ") : "";
    const inventory = Array.isArray(ch["inventory"]) ? (ch["inventory"] as unknown[]).map((i) => (isRecord(i) && typeof i["name"] === "string" ? i["name"] : "")).filter(Boolean).slice(0, 20).join(", ") : "";

    const statsStr = Object.entries(abilityScores)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => `${k.toUpperCase().slice(0, 3)} ${v}`)
      .join(", ");

    const systemPrompt = `You are a D&D 5e character optimization expert. Given a character's details, recommend the single best feat for their next Ability Score Improvement. Return ONLY a JSON object with exactly two keys: "featName" (string, official D&D 5e feat name) and "reason" (string, 1-2 sentences explaining why it's the best pick for this character). No other text.`;

    const userPrompt = `Character: Level ${level} ${subclass ? subclass + " " : ""}${charClass} (${race})
Ability Scores: ${statsStr || "unknown"}
Proficient Skills: ${skills || "unknown"}
Already has feats: ${knownFeats || "none"}
Notable inventory: ${inventory || "none"}

Recommend the single best feat for this character.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    if (!isRecord(parsed)) {
      res.status(500).json({ error: "AI returned invalid response" });
      return;
    }
    res.json({
      featName: typeof parsed["featName"] === "string" ? parsed["featName"] : "",
      reason: typeof parsed["reason"] === "string" ? parsed["reason"] : "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Feat recommendation failed", detail: message });
  }
});

// ── /generate-class-features ─────────────────────────────────────────────────
router.post("/generate-class-features", async (req, res) => {
  const { className, subclassName, level, existingFeatureNames } = req.body as {
    className: string;
    subclassName?: string;
    level: number;
    existingFeatureNames?: string[];
  };

  if (!className || typeof className !== "string") {
    res.status(400).json({ error: "Missing required field: className" });
    return;
  }

  const existing = Array.isArray(existingFeatureNames) && existingFeatureNames.length > 0
    ? `\nExclude these features (already added): ${existingFeatureNames.join(", ")}`
    : "";

  const classDesc = subclassName ? `${className} (${subclassName})` : className;

  const systemPrompt = `You are a strict D&D 5e 2014 rules expert. Classify class features for a ${classDesc} at level ${level} into three separate categories.${existing}

CRITICAL RULE: Every feature MUST go in exactly ONE of the three arrays below.

═══════════════════════════════════════════════════════
CATEGORY 1 — "actions"
═══════════════════════════════════════════════════════
Features the player actively USES in play with a specific timing (action, bonus action, reaction, or free action).
actionType MUST be "action", "bonus_action", "reaction", or "free" — NEVER null.
Examples:
- Rage → bonus_action
- Second Wind → bonus_action
- Action Surge → free
- Wild Shape → action
- Eldritch Blast → action
- Hex → bonus_action
- Misty Step → bonus_action (if known as a spell)
- Hellish Rebuke → reaction
- Bardic Inspiration → bonus_action
- Channel Divinity → action (if a specific named use, e.g. "Sacred Flame")
- Flurry of Blows → bonus_action
- Patient Defense → bonus_action
- Step of the Wind → bonus_action
- Cunning Action → bonus_action
- Uncanny Dodge → reaction
- Lay on Hands → action
- Divine Smite → free (activates on hit)
- Sneak Attack → free (once per turn reminder)
- Extra Attack → free (reminder)
- Stunning Strike → free (reminder on hit)

═══════════════════════════════════════════════════════
CATEGORY 2 — "passiveFeatures"
═══════════════════════════════════════════════════════
Features that are always-on, grant a passive benefit, modify other abilities, or are informational.
These must NEVER show as action buttons.
actionType MUST be null.
Examples:
- Unarmored Defense
- Darkvision, Fey Ancestry, Trance
- Danger Sense
- Reckless Attack (reminder that you CAN attack recklessly — not itself an action)
- Martial Arts (modifies unarmed strikes)
- Jack of All Trades
- Song of Rest
- Otherworldly Patron: Expanded Spell List
- Dark One's Blessing (passive HP bonus on kill)
- Subclass flavor features (Expanded Spell Lists, resistances, immunities, persistent auras)
- Evasion (passive Dex save benefit)

═══════════════════════════════════════════════════════
CATEGORY 3 — "choiceFeatures"
═══════════════════════════════════════════════════════
Features that require the PLAYER to pick from a list of options.
Include ALL valid options so the player can choose.
Examples:
- Pact Boon → options: Pact of the Chain, Pact of the Blade, Pact of the Tome
- Eldritch Invocations → list all invocations the character qualifies for at this level
- Fighting Style → list all valid style options
- Expertise → describe skill doubling benefit
- Maneuvers → list Battle Master maneuvers
- Metamagic → list all Metamagic options
Each option must have its own name, description, and actionType.

═══════════════════════════════════════════════════════
ABSOLUTE EXCLUSIONS (never appear in any array):
- "Cantrips Known", "Spells Known", "Spells Prepared", "Spell Slots", "Pact Magic Slots"
- Generic "Spellcasting" entry
- Any feature already added: ${existing || "none"}

═══════════════════════════════════════════════════════
Return ONLY valid JSON (no markdown fences):
{
  "actions": [
    {
      "name": "<exact D&D 5e 2014 feature name>",
      "description": "<1–2 sentence accurate description of what the player does and when>",
      "actionType": "<'action' | 'bonus_action' | 'reaction' | 'free'>",
      "source": "<'class' | subclass name | 'race'>",
      "levelGained": <number>
    }
  ],
  "passiveFeatures": [
    {
      "name": "<exact D&D 5e 2014 feature name>",
      "description": "<1–2 sentence accurate description of the passive or informational effect>",
      "actionType": null,
      "source": "<'class' | subclass name | 'race'>",
      "levelGained": <number>
    }
  ],
  "choiceFeatures": [
    {
      "name": "<feature name, e.g. 'Pact Boon'>",
      "description": "<1 sentence explaining this is a player choice>",
      "chooseCount": <number of options the player picks, usually 1>,
      "source": "<'class' | subclass name | 'race'>",
      "levelGained": <number>,
      "options": [
        {
          "name": "<specific option name>",
          "description": "<1–2 sentence accurate description of what this option does>",
          "actionType": "<null | 'action' | 'bonus_action' | 'reaction' | 'free'>"
        }
      ]
    }
  ]
}

Return ONLY the JSON, no explanation, no markdown fences.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 4096,
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate all class features for a level ${level} ${classDesc}.` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON for class features", raw });
      return;
    }

    if (!isRecord(parsed)) {
      res.status(500).json({ error: "Unexpected AI response shape for class features", raw });
      return;
    }

    const VALID_ACTION_TYPES = new Set(["action", "bonus_action", "reaction", "free"]);

    // Names that are player-choice tracking items — never valid features
    const EXCLUDED_PATTERNS = [
      /cantrips?\s+known/i, /spells?\s+known/i, /spells?\s+prepared/i,
      /spell\s+slots?/i, /pact\s+magic\s+slots?/i, /^spellcasting$/i,
    ];
    function isExcluded(name: string): boolean {
      return EXCLUDED_PATTERNS.some(re => re.test(name));
    }

    function parseFeatureItem(f: unknown): { name: string; description: string; actionType: string | null; source: string; levelGained?: number } | null {
      if (!isRecord(f)) return null;
      const name = typeof f["name"] === "string" ? f["name"].trim() : null;
      if (!name || isExcluded(name)) return null;
      const description = typeof f["description"] === "string" ? f["description"].trim() : "";
      const source = typeof f["source"] === "string" ? f["source"].trim() : "class";
      const levelGained = typeof f["levelGained"] === "number" ? f["levelGained"] : undefined;
      const rawActionType = typeof f["actionType"] === "string" ? f["actionType"] : null;
      const actionType = rawActionType && VALID_ACTION_TYPES.has(rawActionType) ? rawActionType : null;
      return { name, description, actionType, source, levelGained };
    }

    // CATEGORY 1: actions — only items with a real actionType (enforce classification)
    const rawActions = Array.isArray(parsed["actions"]) ? parsed["actions"]
      : Array.isArray(parsed["features"]) ? parsed["features"] : []; // backward compat
    const actions = rawActions
      .map(parseFeatureItem)
      .filter((f): f is NonNullable<typeof f> => f !== null && f.actionType !== null);

    // CATEGORY 2: passiveFeatures — always-on, informational, passive benefits
    const rawPassive = Array.isArray(parsed["passiveFeatures"]) ? parsed["passiveFeatures"] : [];
    // Patch: Always force actionType: null for passives, even if AI returns 'free' or other value
    const passiveFeatures = rawPassive
      .map(parseFeatureItem)
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .map((f) => ({ ...f, actionType: null as null })); // force null for passives

    // CATEGORY 3: choiceFeatures — player must pick from options
    const rawChoiceFeatures = Array.isArray(parsed["choiceFeatures"]) ? parsed["choiceFeatures"] : [];
    const choiceFeatures = rawChoiceFeatures.map((cf: unknown) => {
      if (!isRecord(cf)) return null;
      const name = typeof cf["name"] === "string" ? cf["name"].trim() : null;
      if (!name || isExcluded(name)) return null;
      const description = typeof cf["description"] === "string" ? cf["description"].trim() : "";
      const chooseCount = typeof cf["chooseCount"] === "number" ? cf["chooseCount"] : 1;
      const source = typeof cf["source"] === "string" ? cf["source"].trim() : "class";
      const levelGained = typeof cf["levelGained"] === "number" ? cf["levelGained"] : undefined;
      const rawOptions = Array.isArray(cf["options"]) ? cf["options"] : [];
      const options = rawOptions.map((opt: unknown) => {
        if (!isRecord(opt)) return null;
        const optName = typeof opt["name"] === "string" ? opt["name"].trim() : null;
        if (!optName) return null;
        const optDesc = typeof opt["description"] === "string" ? opt["description"].trim() : "";
        const optAction =
          typeof opt["actionType"] === "string" && VALID_ACTION_TYPES.has(opt["actionType"])
            ? opt["actionType"]
            : null;
        return { name: optName, description: optDesc, actionType: optAction };
      }).filter(Boolean);
      if (options.length === 0) return null;
      return { name, description, chooseCount, source, levelGained, options };
    }).filter(Boolean);

    res.json({ actions, passiveFeatures, choiceFeatures });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Class features AI request failed", detail: message });
  }
});

// ── Parse Quest Update ─────────────────────────────────────────────────────
router.post("/parse-quest-update", async (req, res) => {
  const { text, questContext, peopleContext, locationContext, realmContext } = req.body as {
    text: string;
    questContext?: { id: string; name: string; status: string; type: string }[];
    peopleContext?: { id: string; name: string; role?: string }[];
    locationContext?: { id: string; name: string }[];
    realmContext?: { id: string; name: string }[];
  };

  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Missing required field: text" });
    return;
  }

  const requestHash = computeAICallRequestHash({ body: req.body });
  const idempotencyStart = await beginRouteIdempotency({
    headerValue: req.headers["x-idempotency-key"],
    endpoint: "parse-quest-update",
    requestHash,
  });
  if (idempotencyStart.kind === "respond") {
    if (idempotencyStart.replayHeader) {
      res.setHeader("X-Idempotency-Replay", "true");
    }
    res.status(idempotencyStart.statusCode).json(idempotencyStart.body);
    return;
  }

  const idempotencyKey = idempotencyStart.key;

  const persistIdempotentResponse = async (statusCode: number, body: unknown): Promise<void> => {
    await completeRouteIdempotency({
      key: idempotencyKey,
      canPersist: idempotencyStart.canPersist,
      endpoint: "parse-quest-update",
      requestHash,
      statusCode,
      responseBody: body,
    });
  };

  const qLines = (questContext ?? []).map(q => `  id="${q.id}" name="${q.name}" type="${q.type}" status="${q.status}"`).join("\n");
  const pLines = (peopleContext ?? []).map(p => `  id="${p.id}" name="${p.name}"${p.role ? ` role="${p.role}"` : ""}`).join("\n");
  const lLines = (locationContext ?? []).map(l => `  id="${l.id}" name="${l.name}"`).join("\n");
  const rLines2 = (realmContext ?? []).map(r => `  id="${r.id}" name="${r.name}"`).join("\n");

  const systemPrompt = `You are a D&D 5e world journal assistant. Parse the player's natural language entry and return a JSON object with all quest, people, location, and realm changes that should be applied.

${qLines ? `Existing quests:\n${qLines}\n` : "No existing quests.\n"}${pLines ? `Existing people:\n${pLines}\n` : "No existing people.\n"}${lLines ? `Existing locations:\n${lLines}\n` : "No existing locations.\n"}${rLines2 ? `Existing realms:\n${rLines2}\n` : ""}
Return ONLY a valid JSON object with this exact shape:
{
  "summary": "<concise human-readable description of all changes>",
  "questActions": [
    {
      "action": "create" or "update",
      "questId": "<existing quest id from context if updating, null if creating new>",
      "name": "<quest name — short, descriptive>",
      "type": "main" or "side" or "personal",
      "status": "active" or "completed" or "failed",
      "description": "<quest objective description, or null>",
      "notes": "<additional context or null>",
      "locationNames": ["<name of each location mentioned>"],
      "personNames": ["<name of each person involved>"]
    }
  ],
  "personActions": [
    {
      "action": "create" or "update",
      "personId": "<existing person id from context if found by name match, null if new>",
      "name": "<person's name>",
      "role": "<role e.g. Quest Giver, Merchant, Debtor, Villain — or null>",
      "relationship": "unknown" or "ally" or "neutral" or "hostile",
      "description": "<brief description or null>"
    }
  ],
  "locationActions": [
    {
      "action": "create" or "update",
      "locationId": "<existing location id from context if found by name match, null if new>",
      "name": "<location name>",
      "description": "<brief description e.g. 'A small trading town east of the river' or null>"
    }
  ],
  "realmActions": [
    {
      "action": "create" or "update",
      "realmId": "<existing realm id from context if found by name match, null if new>",
      "name": "<realm name>",
      "description": "<brief description or null>",
      "locationNames": ["<names of specific locations that are within or part of this realm>"]
    }
  ]
}

Rules:
- Match existing quests, people, locations, and realms by name (case-insensitive) to their ids from the context
- If the user mentions a new quest, add a questAction with action "create" and questId null
- If the user says they updated, completed, failed, or finished an existing quest, find it by name and use action "update" with its questId
- For people and locations mentioned: if name matches an existing entry, use action "update" with their id; otherwise use action "create" with id null
- REALM vs LOCATION — strict hierarchy: (1) Planes of existence (Shadow Realm, Astral Plane, Nine Hells, Feywild, Shadowfell, etc.), kingdoms, empires, nations, and large governing territories → ALWAYS realmActions, NEVER locationActions. (2) Specific settlements, dungeons, buildings, forests → locationActions. Examples: "Shadow Realm" → realmAction (not location); "city of Scrill" → locationAction; "Kingdom of Ironhold" → realmAction; "Ironhold Castle" → locationAction.
- For realms: in locationNames, include any specific locations mentioned as being within or part of that realm in the same update.
- Link people and locations to quests via personNames and locationNames arrays
- Default quest type to "side" if not specified
- Return ONLY the JSON, no explanation, no markdown fences`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 4096,
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const responseBody = { error: "AI returned invalid JSON", raw };
      await persistIdempotentResponse(500, responseBody);
      res.status(500).json(responseBody);
      return;
    }

    if (!isRecord(parsed)) {
      const responseBody = { error: "AI response is not a JSON object" };
      await persistIdempotentResponse(502, responseBody);
      res.status(502).json(responseBody);
      return;
    }

    const responseBody = {
      summary: typeof parsed["summary"] === "string" ? parsed["summary"] : "Quest update processed",
      questActions: (Array.isArray(parsed["questActions"]) ? parsed["questActions"] : []).map(normalizeQuestActionShared).filter(Boolean),
      personActions: (Array.isArray(parsed["personActions"]) ? parsed["personActions"] : []).map(normalizePersonActionShared).filter(Boolean),
      locationActions: (Array.isArray(parsed["locationActions"]) ? parsed["locationActions"] : []).map(normalizeLocationActionShared).filter(Boolean),
      realmActions: (Array.isArray(parsed["realmActions"]) ? parsed["realmActions"] : []).map(normalizeRealmActionShared).filter(Boolean),
    };
    await persistIdempotentResponse(200, responseBody);
    res.json(responseBody);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const responseBody = { error: "AI request failed", detail: message };
    await persistIdempotentResponse(500, responseBody);
    res.status(500).json(responseBody);
  }
});

// ── Generate NPC Appearance ───────────────────────────────────────────────
router.post("/npc-appearance", async (req, res) => {
  const { npc } = req.body as {
    npc?: {
      name?: string;
      race?: string;
      age?: string;
      gender?: string;
      alignment?: string;
      occupation?: string;
      charClass?: string;
      level?: string;
      personalityTrait1?: string;
      personalityTrait2?: string;
      ideal?: string;
      bond?: string;
      flaw?: string;
      secret?: string;
      notes?: string;
      quests?: string;
    };
  };

  if (!npc || !isRecord(npc)) {
    res.status(400).json({ error: "Missing required field: npc" });
    return;
  }

  const contextLines = [
    npc.name ? `Name: ${npc.name}` : null,
    npc.race ? `Race: ${npc.race}` : null,
    npc.age ? `Age: ${npc.age}` : null,
    npc.gender ? `Gender: ${npc.gender}` : null,
    npc.alignment ? `Alignment: ${npc.alignment}` : null,
    npc.occupation ? `Occupation: ${npc.occupation}` : null,
    npc.charClass ? `Class: ${npc.charClass} (Level ${npc.level ?? "?"})` : null,
    npc.personalityTrait1 ? `Trait 1: ${npc.personalityTrait1}` : null,
    npc.personalityTrait2 ? `Trait 2: ${npc.personalityTrait2}` : null,
    npc.ideal ? `Ideal: ${npc.ideal}` : null,
    npc.bond ? `Bond: ${npc.bond}` : null,
    npc.flaw ? `Flaw: ${npc.flaw}` : null,
    npc.quests ? `Quest links: ${npc.quests}` : null,
    npc.secret ? `Secret context: ${npc.secret}` : null,
    npc.notes ? `Notes: ${npc.notes}` : null,
  ].filter((line): line is string => Boolean(line));

  const systemPrompt = `You are a D&D 5e NPC appearance writer.
Generate a grounded VISUAL description of this NPC in exactly 3 to 4 sentences.

Rules:
- Focus on physical appearance only: build, face, hair, eyes, skin, clothing, posture, visible scars/tattoos, and notable worn gear.
- Do NOT describe personality, goals, backstory, secrets, or behavior unless visible in appearance.
- Keep tone suitable for a DM quick-reference card.
- Return ONLY JSON in this exact shape:
{ "appearance": "<3-4 sentence appearance description>" }`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 600,
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextLines.join("\n") || "Generate a generic fantasy NPC appearance." },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    if (!isRecord(parsed) || typeof parsed["appearance"] !== "string") {
      res.status(502).json({ error: "AI response missing appearance", raw });
      return;
    }

    res.json({ appearance: parsed["appearance"].trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "AI request failed", detail: message });
  }
});

router.post("/item-properties", async (req, res) => {
  const { item } = req.body as {
    item?: {
      name?: string;
      quality?: string;
      category?: string;
      type?: string;
      value?: number;
      weight?: number;
      attunement?: boolean;
      attunementReq?: string;
      notes?: string;
    };
  };

  if (!item || !isRecord(item)) {
    res.status(400).json({ error: "Missing required field: item" });
    return;
  }

  const contextLines = [
    item.name ? `Name: ${item.name}` : null,
    item.quality ? `Quality: ${item.quality}` : null,
    item.category ? `Category: ${item.category}` : null,
    item.type ? `Type: ${item.type}` : null,
    item.value ? `Value: ${item.value} gp` : null,
    item.weight ? `Weight: ${item.weight} lbs` : null,
    item.attunement ? `Requires attunement: ${item.attunementReq ?? "yes"}` : null,
    item.notes ? `Context: ${item.notes}` : null,
  ].filter((line): line is string => Boolean(line));

  const systemPrompt = `You are a D&D 5e magic item description writer.
Generate flavorful descriptions for a game item based on the provided details.

Rules:
- Properties/Effects: Describe what the item does mechanically - its abilities, bonuses, and effects. Be creative but balanced.
- Flavor Description: Describe how the item looks, feels, and seems. Include material, craftsmanship, and any mystical aura. Keep it 2-3 sentences.
- Return ONLY JSON in this exact shape:
{ "properties": "<describe mechanical effects and abilities>", "description": "<2-3 sentence description of appearance>" }`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      max_completion_tokens: 800,
      ...getDeterministicDecodeOptions(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextLines.join("\n") || "Generate a generic fantasy item description." },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    if (!isRecord(parsed) || typeof parsed["properties"] !== "string" || typeof parsed["description"] !== "string") {
      res.status(502).json({ error: "AI response missing properties or description", raw });
      return;
    }

    res.json({ properties: parsed["properties"].trim(), description: parsed["description"].trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "AI request failed", detail: message });
  }
});

export default router;
