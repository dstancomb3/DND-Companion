import { and, eq, lt } from "drizzle-orm";
import { db } from "@workspace/db";
import { aiIdempotencyRecords } from "@workspace/db/schema";
import { computeAICallRequestHash } from "./aiIdempotencyHash";

export type IdempotencyDatabase = Pick<typeof db, "select" | "insert" | "update" | "delete">;

const AI_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type AIIdempotencyStartResult =
  | { kind: "disabled" }
  | { kind: "started" }
  | { kind: "replay"; statusCode: number; responseBody: unknown }
  | { kind: "in_progress" }
  | { kind: "payload_conflict" };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isMissingTableError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error["code"] === "42P01";
}

async function pruneExpiredRows(database: IdempotencyDatabase): Promise<void> {
  await database.delete(aiIdempotencyRecords).where(lt(aiIdempotencyRecords.expiresAt, new Date()));
}

export async function startAICallIdempotency(input: {
  key: string;
  endpoint: string;
  requestHash: string;
}, database: IdempotencyDatabase = db): Promise<AIIdempotencyStartResult> {
  try {
    await pruneExpiredRows(database);

    const existingRows = await database
      .select()
      .from(aiIdempotencyRecords)
      .where(eq(aiIdempotencyRecords.key, input.key))
      .limit(1);

    const existing = existingRows[0];
    if (existing) {
      if (existing.endpoint !== input.endpoint || existing.requestHash !== input.requestHash) {
        return { kind: "payload_conflict" };
      }
      if (existing.status === "completed" && existing.statusCode != null) {
        return {
          kind: "replay",
          statusCode: existing.statusCode,
          responseBody: existing.responseBody,
        };
      }
      return { kind: "in_progress" };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + AI_IDEMPOTENCY_TTL_MS);

    const inserted = await database
      .insert(aiIdempotencyRecords)
      .values({
        key: input.key,
        endpoint: input.endpoint,
        requestHash: input.requestHash,
        status: "processing",
        createdAt: now,
        updatedAt: now,
        expiresAt,
      })
      .onConflictDoNothing()
      .returning({ key: aiIdempotencyRecords.key });

    if (inserted.length > 0) {
      return { kind: "started" };
    }

    // Race fallback: if another request inserted first, re-resolve deterministically.
    const racedRows = await database
      .select()
      .from(aiIdempotencyRecords)
      .where(eq(aiIdempotencyRecords.key, input.key))
      .limit(1);
    const raced = racedRows[0];
    if (!raced) return { kind: "in_progress" };

    if (raced.endpoint !== input.endpoint || raced.requestHash !== input.requestHash) {
      return { kind: "payload_conflict" };
    }
    if (raced.status === "completed" && raced.statusCode != null) {
      return { kind: "replay", statusCode: raced.statusCode, responseBody: raced.responseBody };
    }
    return { kind: "in_progress" };
  } catch (error) {
    // Fallback for environments where the table is not provisioned yet.
    if (database === db && isMissingTableError(error)) {
      return { kind: "disabled" };
    }
    throw error;
  }
}

export async function completeAICallIdempotency(input: {
  key: string;
  endpoint: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
}, database: IdempotencyDatabase = db): Promise<void> {
  try {
    await database
      .update(aiIdempotencyRecords)
      .set({
        status: "completed",
        statusCode: input.statusCode,
        responseBody: input.responseBody,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiIdempotencyRecords.key, input.key),
          eq(aiIdempotencyRecords.endpoint, input.endpoint),
          eq(aiIdempotencyRecords.requestHash, input.requestHash),
        ),
      );
  } catch (error) {
    if (database !== db || !isMissingTableError(error)) {
      throw error;
    }
  }
}
