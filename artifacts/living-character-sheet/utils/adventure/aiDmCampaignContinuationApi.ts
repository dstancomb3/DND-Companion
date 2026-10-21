import { API_BASE_URL } from "@/utils/apiUrl";

export interface SubmitCampaignContinuationResponse {
  ok: true;
  ingested: true;
  submissionId: string;
  ingestTraceId?: string;
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
}

export interface CampaignContinuationSnapshot {
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
}

export interface CampaignContinuationSnapshotResponse {
  ok: true;
  found: true;
  sessionId: string;
  snapshot: CampaignContinuationSnapshot;
}

export type SubmitCampaignContinuationErrorCode =
  | "idempotency_in_progress"
  | "idempotency_payload_mismatch"
  | "invalid_handoff_payload"
  | "campaign_continuation_not_found"
  | "invalid_response_payload"
  | "request_failed";

export class SubmitCampaignContinuationError extends Error {
  readonly code: SubmitCampaignContinuationErrorCode;
  readonly statusCode: number | null;
  constructor(input: { message: string; code: SubmitCampaignContinuationErrorCode; statusCode?: number | null }) {
    super(input.message);
    this.name = "SubmitCampaignContinuationError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? null;
  }
}

function isSubmitCampaignContinuationResponse(value: unknown): value is SubmitCampaignContinuationResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.ok !== true || v.ingested !== true) return false;
  if (typeof v.submissionId !== "string" || typeof v.receivedAt !== "string") return false;
  if (typeof v.ingestTraceId !== "undefined" && typeof v.ingestTraceId !== "string") return false;
  if (typeof v.continuation !== "object" || v.continuation === null) return false;

  const continuation = v.continuation as Record<string, unknown>;
  const continuityStatus = continuation.continuityStatus;
  return (
    continuation.schemaVersion === "campaign-continuation.v1" &&
    typeof continuation.sessionId === "string" &&
    typeof continuation.campaignId === "string" &&
    typeof continuation.chapterLabel === "string" &&
    continuation.mode === "campaign_continuation" &&
    typeof continuation.checkpointIndex === "number" &&
    (continuityStatus === "active" || continuityStatus === "checkpoint" || continuityStatus === "chapter_complete")
  );
}

function isCampaignContinuationSnapshotResponse(value: unknown): value is CampaignContinuationSnapshotResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.ok !== true || v.found !== true || typeof v.sessionId !== "string") return false;
  if (typeof v.snapshot !== "object" || v.snapshot === null) return false;

  const snapshot = v.snapshot as Record<string, unknown>;
  const continuityStatus = snapshot.continuityStatus;
  return (
    snapshot.schemaVersion === "campaign-continuation.v1" &&
    typeof snapshot.sessionId === "string" &&
    typeof snapshot.campaignId === "string" &&
    typeof snapshot.campaignLabel === "string" &&
    typeof snapshot.chapterLabel === "string" &&
    snapshot.mode === "campaign_continuation" &&
    typeof snapshot.difficulty === "string" &&
    typeof snapshot.stylePreset === "string" &&
    (snapshot.guidanceSource === "user" || snapshot.guidanceSource === "fallback") &&
    typeof snapshot.entryCount === "number" &&
    typeof snapshot.checkpointIndex === "number" &&
    (continuityStatus === "active" || continuityStatus === "checkpoint" || continuityStatus === "chapter_complete") &&
    typeof snapshot.progressSummary === "string" &&
    Array.isArray(snapshot.recapLines) &&
    snapshot.recapLines.every((line) => typeof line === "string") &&
    typeof snapshot.clientSavedAt === "number" &&
    typeof snapshot.receivedAt === "string" &&
    typeof snapshot.ingestTraceId === "string" &&
    typeof snapshot.submissionId === "string"
  );
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

function mapErrorCode(rawCode: unknown): SubmitCampaignContinuationErrorCode {
  if (rawCode === "idempotency_in_progress") return "idempotency_in_progress";
  if (rawCode === "idempotency_payload_mismatch") return "idempotency_payload_mismatch";
  if (rawCode === "invalid_handoff_payload") return "invalid_handoff_payload";
  if (rawCode === "campaign_continuation_not_found") return "campaign_continuation_not_found";
  return "request_failed";
}

export async function fetchCampaignContinuationSnapshot(input: {
  sessionId: string;
}): Promise<{ found: false } | { found: true; response: CampaignContinuationSnapshotResponse }> {
  const sessionId = input.sessionId.trim();
  if (!sessionId) {
    throw new SubmitCampaignContinuationError({
      message: "Campaign continuation snapshot read requires a session id.",
      code: "request_failed",
      statusCode: null,
    });
  }

  const res = await fetch(`${API_BASE_URL}/api/adventure/campaign-continuations/${encodeURIComponent(sessionId)}`);
  const raw = await res.text();
  const data = parsePossiblyJson(raw);

  if (res.status === 404) {
    const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
    if (body?.code === "campaign_continuation_not_found") {
      return { found: false };
    }
  }

  if (!res.ok) {
    const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
    const message =
      (body && typeof body.error === "string" ? body.error : null) ??
      (body && typeof body.message === "string" ? body.message : null) ??
      `Campaign continuation snapshot read failed (${res.status}).`;
    const code = mapErrorCode(body?.code);
    throw new SubmitCampaignContinuationError({ message, code, statusCode: res.status });
  }

  if (!isCampaignContinuationSnapshotResponse(data)) {
    throw new SubmitCampaignContinuationError({
      message: "Campaign continuation snapshot read returned an unexpected response shape.",
      code: "invalid_response_payload",
      statusCode: res.status,
    });
  }

  return {
    found: true,
    response: data,
  };
}

export async function submitCampaignContinuationDetailed(input: {
  continuation: {
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
  };
  recapLines: string[];
  clientSavedAt: number;
}): Promise<{ response: SubmitCampaignContinuationResponse; replayed: boolean }> {
  const idempotencyKey = `campaign-continuation:${input.continuation.sessionId}:${input.clientSavedAt}`;

  const res = await fetch(`${API_BASE_URL}/api/adventure/campaign-continuations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });

  const raw = await res.text();
  const data = parsePossiblyJson(raw);

  if (!res.ok) {
    const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
    const message =
      (body && typeof body.error === "string" ? body.error : null) ??
      (body && typeof body.message === "string" ? body.message : null) ??
      `Campaign continuation ingest failed (${res.status}).`;
    const code = mapErrorCode(body?.code);
    throw new SubmitCampaignContinuationError({ message, code, statusCode: res.status });
  }

  if (!isSubmitCampaignContinuationResponse(data)) {
    throw new SubmitCampaignContinuationError({
      message: "Campaign continuation ingest returned an unexpected response shape.",
      code: "invalid_response_payload",
      statusCode: res.status,
    });
  }

  return {
    response: data,
    replayed: res.headers.get("X-Idempotent-Replay") === "true",
  };
}
