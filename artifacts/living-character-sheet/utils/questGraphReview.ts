import type {
  QuestGraphDeferredOperation,
  QuestGraphRelationshipRecord,
  QuestGraphReviewBatch,
  QuestGraphReviewBatchStatus,
  QuestReferenceItem,
} from "@/types";

const TITLE_PREFIX_RE = /^(captain|lord|lady|sir|dame|elder|sister|brother|master|mistress|general|sergeant|commander)\s+/i;
const LEADING_ARTICLE_RE = /^(the|a|an)\s+/i;
const TOKEN_STOP_WORDS = new Set(["the", "a", "an", "of", "and", "for", "from", "into", "with", "at", "in", "on"]);

export type QuestEntityKind = "quest" | "person" | "location" | "realm";

export interface QuestEntityMatchCandidate {
  id: string;
  name: string;
  aliases?: string[];
}

export interface QuestEntitySuggestion {
  id: string;
  name: string;
  reason: "exact_name" | "stored_alias" | "derived_alias" | "token_subset";
  score: number;
}

export interface QuestEntityResolution {
  status: "resolved" | "ambiguous" | "suggest" | "none";
  resolvedId?: string;
  resolvedName?: string;
  matchedBy?: QuestEntitySuggestion["reason"];
  suggestions: QuestEntitySuggestion[];
}

export interface QuestGraphBatchCounts {
  pending: number;
  approved: number;
  rejected: number;
  applied: number;
  failed: number;
  unresolved: number;
  replayablePending: number;
  replayableApproved: number;
}

export function normalizeQuestMatchText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeQuestMatchText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !TOKEN_STOP_WORDS.has(token));
}

export function deriveEntityAliasKeys(name: string | null | undefined): string[] {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return [];

  const normalized = normalizeQuestMatchText(trimmed);
  const withoutTitle = normalizeQuestMatchText(trimmed.replace(TITLE_PREFIX_RE, ""));
  const withoutArticle = normalizeQuestMatchText(trimmed.replace(LEADING_ARTICLE_RE, ""));
  const parts = tokenize(withoutTitle);

  return [...new Set([
    normalized,
    withoutTitle,
    withoutArticle,
    ...parts,
  ].filter((entry) => entry.length > 0))];
}

export function mergeQuestAliases(existing: string[] | undefined, incoming: Array<string | null | undefined>): string[] | undefined {
  const merged = [...new Set([
    ...(existing ?? []).map((value) => value.trim()),
    ...incoming.map((value) => (value ?? "").trim()),
  ].filter((value) => value.length > 0))];
  return merged.length > 0 ? merged : undefined;
}

function collectSuggestionReason(candidate: QuestEntityMatchCandidate, queryKey: string): QuestEntitySuggestion["reason"] | null {
  const normalizedName = normalizeQuestMatchText(candidate.name);
  if (normalizedName === queryKey) return "exact_name";

  const storedAliases = (candidate.aliases ?? []).map(normalizeQuestMatchText);
  if (storedAliases.includes(queryKey)) return "stored_alias";

  const derivedAliases = deriveEntityAliasKeys(candidate.name);
  if (derivedAliases.includes(queryKey)) return "derived_alias";

  return null;
}

export function resolveQuestEntityByName(
  mentionedName: string | null | undefined,
  entries: QuestEntityMatchCandidate[]
): QuestEntityResolution {
  const queryKey = normalizeQuestMatchText(mentionedName);
  if (!queryKey) {
    return { status: "none", suggestions: [] };
  }

  const exactMatches = entries.flatMap((entry) => {
    const reason = collectSuggestionReason(entry, queryKey);
    return reason ? [{ id: entry.id, name: entry.name, reason, score: 100 }] : [];
  });

  const dedupedExact = Array.from(new Map(exactMatches.map((match) => [match.id, match])).values());
  if (dedupedExact.length === 1) {
    return {
      status: "resolved",
      resolvedId: dedupedExact[0].id,
      resolvedName: dedupedExact[0].name,
      matchedBy: dedupedExact[0].reason,
      suggestions: dedupedExact,
    };
  }
  if (dedupedExact.length > 1) {
    return { status: "ambiguous", suggestions: dedupedExact };
  }

  const queryTokens = new Set(tokenize(mentionedName));
  if (queryTokens.size === 0) {
    return { status: "none", suggestions: [] };
  }

  const scored = entries.flatMap((entry) => {
    const entryTokens = new Set([
      ...tokenize(entry.name),
      ...(entry.aliases ?? []).flatMap((alias) => tokenize(alias)),
    ]);
    if (entryTokens.size === 0) return [];

    const overlap = [...queryTokens].filter((token) => entryTokens.has(token)).length;
    const subset = [...queryTokens].every((token) => entryTokens.has(token)) || [...entryTokens].every((token) => queryTokens.has(token));
    const singleLongToken = queryTokens.size === 1 && [...queryTokens][0].length >= 6 && overlap === 1;
    if (!(subset && overlap >= 2) && !singleLongToken) return [];

    return [{
      id: entry.id,
      name: entry.name,
      reason: "token_subset" as const,
      score: overlap,
    }];
  }).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  const dedupedScored = Array.from(new Map(scored.map((match) => [match.id, match])).values());
  if (dedupedScored.length === 0) {
    return { status: "none", suggestions: [] };
  }
  if (dedupedScored.length === 1) {
    return { status: "suggest", suggestions: dedupedScored };
  }
  if (dedupedScored[0].score > dedupedScored[1].score) {
    return { status: "suggest", suggestions: [dedupedScored[0]] };
  }
  return { status: "ambiguous", suggestions: dedupedScored.slice(0, 3) };
}

export function summarizeQuestGraphBatch(batch: QuestGraphReviewBatch): QuestGraphBatchCounts {
  return batch.operations.reduce<QuestGraphBatchCounts>((counts, operation) => {
    counts[operation.resolutionState] += 1;
    if ((operation.resolutionState === "pending" || operation.resolutionState === "approved") && operation.replayable) {
      if (operation.resolutionState === "pending") counts.replayablePending += 1;
      if (operation.resolutionState === "approved") counts.replayableApproved += 1;
    }
    if (operation.resolutionState === "pending" || operation.resolutionState === "approved") {
      counts.unresolved += 1;
    }
    return counts;
  }, {
    pending: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
    failed: 0,
    unresolved: 0,
    replayablePending: 0,
    replayableApproved: 0,
  });
}

export function getQuestGraphBatchStatus(batch: QuestGraphReviewBatch): QuestGraphReviewBatchStatus {
  if (batch.status === "archived") return "archived";
  const counts = summarizeQuestGraphBatch(batch);
  const total = batch.operations.length;
  if (total === 0) return "resolved";
  if (counts.failed > 0 && counts.pending === 0 && counts.approved === 0 && counts.applied + counts.rejected + counts.failed === total) {
    return "resolved_with_failures";
  }
  if (counts.approved > 0 && counts.pending === 0) {
    return "ready_to_apply";
  }
  if (counts.applied + counts.rejected === total) {
    return "resolved";
  }
  if (counts.pending === total) {
    return "open";
  }
  return "partially_resolved";
}

export function canArchiveQuestGraphBatch(batch: QuestGraphReviewBatch): boolean {
  const counts = summarizeQuestGraphBatch(batch);
  return counts.pending === 0 && counts.approved === 0;
}

function stableSerialize(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

export function makeQuestGraphPayloadFingerprint(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = 5381;
  for (let index = 0; index < serialized.length; index += 1) {
    hash = ((hash << 5) + hash) ^ serialized.charCodeAt(index);
  }
  return `qgf_${Math.abs(hash >>> 0).toString(36)}`;
}

export function upsertQuestGraphRelationships(
  existing: QuestGraphRelationshipRecord[] | undefined,
  incoming: QuestGraphRelationshipRecord[]
): QuestGraphRelationshipRecord[] | undefined {
  const next = [...(existing ?? [])];
  for (const relationship of incoming) {
    const index = next.findIndex((entry) =>
      entry.relationshipType === relationship.relationshipType &&
      entry.direction === relationship.direction &&
      entry.otherKind === relationship.otherKind &&
      entry.otherId === relationship.otherId
    );
    if (index >= 0) {
      next[index] = {
        ...next[index],
        ...relationship,
        evidenceExcerpts: relationship.evidenceExcerpts?.length
          ? [...new Set([...(next[index].evidenceExcerpts ?? []), ...relationship.evidenceExcerpts])]
          : next[index].evidenceExcerpts,
      };
      continue;
    }
    next.push(relationship);
  }
  return next.length > 0 ? next : undefined;
}

export function upsertQuestReferenceItems(
  existing: QuestReferenceItem[] | undefined,
  incoming: QuestReferenceItem[]
): QuestReferenceItem[] | undefined {
  const next = [...(existing ?? [])];
  for (const reference of incoming) {
    const index = next.findIndex((entry) =>
      (reference.itemId != null && entry.itemId === reference.itemId) ||
      normalizeQuestMatchText(entry.itemName) === normalizeQuestMatchText(reference.itemName)
    );
    if (index >= 0) {
      next[index] = { ...next[index], ...reference };
      continue;
    }
    next.push(reference);
  }
  return next.length > 0 ? next : undefined;
}

export function getRelationshipConfidence(evidence: Array<{ confidence?: string }> | undefined): "high" | "medium" | "low" {
  if (!Array.isArray(evidence) || evidence.length === 0) return "low";
  if (evidence.some((entry) => entry.confidence === "high")) return "high";
  if (evidence.some((entry) => entry.confidence === "medium")) return "medium";
  return "low";
}

export function markReplayAttempt(operation: QuestGraphDeferredOperation, timestamp: number): QuestGraphDeferredOperation {
  return {
    ...operation,
    attemptCount: (operation.attemptCount ?? 0) + 1,
    lastAttemptedAt: timestamp,
  };
}