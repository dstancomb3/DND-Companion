import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { aiIdempotencyRecords } from "@workspace/db/schema";
import { logger } from "./logger";

export type HealthCheckResult =
  | {
      status: "healthy";
      tableExists: true;
      message: string;
    }
  | {
      status: "degraded";
      tableExists: false;
      message: string;
    }
  | {
      status: "unhealthy";
      error: string;
    };

function isMissingTableError(error: unknown): boolean {
  const record = error as Record<string, unknown> | null;
  if (!record) return false;

  if (record["code"] === "42P01") {
    return true;
  }

  const message = typeof record["message"] === "string" ? record["message"] : "";
  if (/ai_idempotency_records/i.test(message) && /does not exist|missing|failed query/i.test(message)) {
    return true;
  }

  const cause = record["cause"];
  if (cause && cause !== error && isMissingTableError(cause)) {
    return true;
  }

  return false;
}

/**
 * Verify AI idempotency table exists and is accessible.
 * Returns healthy if table exists, degraded if missing (graceful fallback),
 * unhealthy if there's a real error.
 */
export async function checkAIIdempotencyHealth(): Promise<HealthCheckResult> {
  try {
    // Attempt a simple query to verify table accessibility.
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(aiIdempotencyRecords)
      .limit(1);

    if (!result || result.length === 0) {
      return {
        status: "healthy",
        tableExists: true,
        message: "AI idempotency table exists and is accessible.",
      };
    }

    return {
      status: "healthy",
      tableExists: true,
      message: "AI idempotency table exists and is accessible.",
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        status: "degraded",
        tableExists: false,
        message:
          "AI idempotency table does not exist. AI routes will operate without persistence. " +
          "Run `pnpm --filter @workspace/db run push` to provision the table.",
      };
    }

    const errorMessage =
      error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
    return {
      status: "unhealthy",
      error: errorMessage,
    };
  }
}

/**
 * Log health check result at server startup.
 */
export async function logAIIdempotencyHealthCheck(): Promise<void> {
  const result = await checkAIIdempotencyHealth();

  if (result.status === "healthy") {
    logger.info({ health: result }, "[ai-idempotency] Health check passed");
  } else if (result.status === "degraded") {
    logger.warn({ health: result }, "[ai-idempotency] Health check degraded — operating without persistence");
  } else {
    logger.error({ health: result }, "[ai-idempotency] Health check failed");
  }
}
