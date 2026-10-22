import { db } from "@workspace/db";
import { startAICallIdempotency, completeAICallIdempotency } from "./aiIdempotencyStore";
import { compareAndSaveCampaignContinuation, type CampaignContinuationSnapshotRecord } from "./campaignContinuationStore";

export type CheckpointCommitResult = {
  statusCode: number;
  body: unknown;
  replayed: boolean;
};

class CheckpointConflictError extends Error {}

/** Snapshot and replay receipt either commit together or both roll back. */
export async function commitCampaignCheckpoint(input: {
  snapshot: CampaignContinuationSnapshotRecord;
  responseBody: unknown;
  idempotencyKey: string | null;
  endpoint: string;
  requestHash: string;
  expectedSubmissionId?: string | null;
  startOverride?: typeof startAICallIdempotency;
}): Promise<CheckpointCommitResult> {
  try {
    return await db.transaction(async (tx) => {
      if (input.idempotencyKey) {
        const start = await (input.startOverride ?? startAICallIdempotency)({
          key: input.idempotencyKey, endpoint: input.endpoint, requestHash: input.requestHash,
        }, tx);
        if (start.kind === "replay") {
          return { statusCode: start.statusCode, body: start.responseBody, replayed: true };
        }
        if (start.kind === "payload_conflict" || start.kind === "in_progress") {
          return {
            statusCode: 409, replayed: false,
            body: {
              error: start.kind === "payload_conflict"
                ? "Idempotency key was already used with a different request payload."
                : "A request with this idempotency key is still in progress.",
              code: start.kind === "payload_conflict" ? "idempotency_payload_mismatch" : "idempotency_in_progress",
            },
          };
        }
        // A missing receipt table must not silently weaken checkpoint durability.
        if (start.kind !== "started") throw new Error("Checkpoint idempotency storage is unavailable");
      }

      const saved = await compareAndSaveCampaignContinuation(input.snapshot, input.expectedSubmissionId ?? null, tx);
      if (!saved) throw new CheckpointConflictError();
      if (input.idempotencyKey) {
        await completeAICallIdempotency({
          key: input.idempotencyKey, endpoint: input.endpoint, requestHash: input.requestHash,
          statusCode: 200, responseBody: input.responseBody,
        }, tx);
      }
      return { statusCode: 200, body: input.responseBody, replayed: false };
    });
  } catch (error) {
    if (!(error instanceof CheckpointConflictError)) throw error;
    return {
      statusCode: 409, replayed: false,
      body: {
        code: "campaign_checkpoint_conflict",
        error: "Another checkpoint has been saved or removed. Reopen this session and review the latest checkpoint before retrying. Your local work has not been replaced.",
      },
    };
  }
}
