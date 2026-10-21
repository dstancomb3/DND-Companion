import { API_BASE_URL } from "@/utils/apiUrl";
import type { AiDmArchivedOneOffSession } from "@/utils/adventure/aiDmOneOffSessionArchiveStorage";

export interface SubmitOneOffHandoffResponse {
  ok: true;
  ingested: true;
  submissionId: string;
  ingestTraceId?: string;
  receivedAt: string;
  handoff: {
    schemaVersion: "oneoff-handoff.v1";
    sessionId: string;
    title: string;
    mode: "one_off";
  };
}

export type SubmitOneOffHandoffErrorCode =
  | "idempotency_in_progress"
  | "idempotency_payload_mismatch"
  | "invalid_handoff_payload"
  | "invalid_response_payload"
  | "request_failed";

export class SubmitOneOffHandoffError extends Error {
  readonly code: SubmitOneOffHandoffErrorCode;
  readonly statusCode: number | null;
  constructor(input: { message: string; code: SubmitOneOffHandoffErrorCode; statusCode?: number | null }) {
    super(input.message);
    this.name = "SubmitOneOffHandoffError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? null;
  }
}

export interface SubmitArchivedOneOffHandoffDetailedResult {
  response: SubmitOneOffHandoffResponse;
  replayed: boolean;
}

function isSubmitOneOffHandoffResponse(value: unknown): value is SubmitOneOffHandoffResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.ok !== true || v.ingested !== true) return false;
  if (typeof v.submissionId !== "string" || typeof v.receivedAt !== "string") return false;
  if (typeof v.ingestTraceId !== "undefined" && typeof v.ingestTraceId !== "string") return false;
  if (typeof v.handoff !== "object" || v.handoff === null) return false;
  const handoff = v.handoff as Record<string, unknown>;
  return (
    handoff.schemaVersion === "oneoff-handoff.v1" &&
    typeof handoff.sessionId === "string" &&
    typeof handoff.title === "string" &&
    handoff.mode === "one_off"
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

function mapErrorCode(rawCode: unknown): SubmitOneOffHandoffErrorCode {
  if (rawCode === "idempotency_in_progress") return "idempotency_in_progress";
  if (rawCode === "idempotency_payload_mismatch") return "idempotency_payload_mismatch";
  if (rawCode === "invalid_handoff_payload") return "invalid_handoff_payload";
  return "request_failed";
}

export async function submitArchivedOneOffHandoffDetailed(input: {
  archive: AiDmArchivedOneOffSession;
}): Promise<SubmitArchivedOneOffHandoffDetailedResult> {
  const { archive } = input;
  const idempotencyKey = `oneoff-handoff:${archive.sessionId}:${archive.savedAt}`;
  const res = await fetch(`${API_BASE_URL}/api/adventure/oneoff-handoffs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      handoff: archive.handoff,
      recapLines: archive.recapLines,
      clientSavedAt: archive.savedAt,
    }),
  });

  const raw = await res.text();
  const data = parsePossiblyJson(raw);

  if (!res.ok) {
    const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
    const message =
      (body && typeof body.error === "string" ? body.error : null) ??
      (body && typeof body.message === "string" ? body.message : null) ??
      `Handoff ingest failed (${res.status}).`;
    const code = mapErrorCode(body?.code);
    throw new SubmitOneOffHandoffError({ message, code, statusCode: res.status });
  }

  if (!isSubmitOneOffHandoffResponse(data)) {
    throw new SubmitOneOffHandoffError({
      message: "Handoff ingest returned an unexpected response shape.",
      code: "invalid_response_payload",
      statusCode: res.status,
    });
  }

  return {
    response: data,
    replayed: res.headers.get("X-Idempotent-Replay") === "true",
  };
}

export async function submitArchivedOneOffHandoff(input: {
  archive: AiDmArchivedOneOffSession;
}): Promise<SubmitOneOffHandoffResponse> {
  const outcome = await submitArchivedOneOffHandoffDetailed(input);
  return outcome.response;
}
