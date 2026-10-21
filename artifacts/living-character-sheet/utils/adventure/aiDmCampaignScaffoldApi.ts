import { API_BASE_URL } from "@/utils/apiUrl";

export interface SubmitCampaignScaffoldResponse {
  ok: true;
  ingested: true;
  submissionId: string;
  ingestTraceId?: string;
  receivedAt: string;
  scaffold: {
    schemaVersion: "campaign-scaffold.v1";
    sessionId: string;
    campaignId: string;
    chapterLabel: string;
    mode: "campaign_scaffold";
  };
}

export type SubmitCampaignScaffoldErrorCode =
  | "idempotency_in_progress"
  | "idempotency_payload_mismatch"
  | "invalid_handoff_payload"
  | "invalid_response_payload"
  | "request_failed";

export class SubmitCampaignScaffoldError extends Error {
  readonly code: SubmitCampaignScaffoldErrorCode;
  readonly statusCode: number | null;
  constructor(input: { message: string; code: SubmitCampaignScaffoldErrorCode; statusCode?: number | null }) {
    super(input.message);
    this.name = "SubmitCampaignScaffoldError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? null;
  }
}

function isSubmitCampaignScaffoldResponse(value: unknown): value is SubmitCampaignScaffoldResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.ok !== true || v.ingested !== true) return false;
  if (typeof v.submissionId !== "string" || typeof v.receivedAt !== "string") return false;
  if (typeof v.ingestTraceId !== "undefined" && typeof v.ingestTraceId !== "string") return false;
  if (typeof v.scaffold !== "object" || v.scaffold === null) return false;
  const scaffold = v.scaffold as Record<string, unknown>;
  return (
    scaffold.schemaVersion === "campaign-scaffold.v1" &&
    typeof scaffold.sessionId === "string" &&
    typeof scaffold.campaignId === "string" &&
    typeof scaffold.chapterLabel === "string" &&
    scaffold.mode === "campaign_scaffold"
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

function mapErrorCode(rawCode: unknown): SubmitCampaignScaffoldErrorCode {
  if (rawCode === "idempotency_in_progress") return "idempotency_in_progress";
  if (rawCode === "idempotency_payload_mismatch") return "idempotency_payload_mismatch";
  if (rawCode === "invalid_handoff_payload") return "invalid_handoff_payload";
  return "request_failed";
}

export async function submitCampaignScaffoldDetailed(input: {
  scaffold: {
    schemaVersion: "campaign-scaffold.v1";
    sessionId: string;
    campaignId: string;
    campaignLabel: string;
    chapterLabel: string;
    mode: "campaign_scaffold";
    difficulty: string;
    stylePreset: string;
    guidanceSource: "user" | "fallback";
    entryCount: number;
    scaffoldStatus: "active" | "checkpoint";
  };
  recapLines: string[];
  clientSavedAt: number;
}): Promise<{ response: SubmitCampaignScaffoldResponse; replayed: boolean }> {
  const idempotencyKey = `campaign-scaffold:${input.scaffold.sessionId}:${input.clientSavedAt}`;

  const res = await fetch(`${API_BASE_URL}/api/adventure/campaign-scaffolds`, {
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
      `Campaign scaffold ingest failed (${res.status}).`;
    const code = mapErrorCode(body?.code);
    throw new SubmitCampaignScaffoldError({ message, code, statusCode: res.status });
  }

  if (!isSubmitCampaignScaffoldResponse(data)) {
    throw new SubmitCampaignScaffoldError({
      message: "Campaign scaffold ingest returned an unexpected response shape.",
      code: "invalid_response_payload",
      statusCode: res.status,
    });
  }

  return {
    response: data,
    replayed: res.headers.get("X-Idempotent-Replay") === "true",
  };
}
