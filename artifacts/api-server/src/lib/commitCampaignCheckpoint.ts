import { db } from "@workspace/db";
import { startAICallIdempotency, completeAICallIdempotency } from "./aiIdempotencyStore";
import { saveCampaignContinuationToDatabase, type CampaignContinuationSnapshotRecord } from "./campaignContinuationStore";

export type CheckpointCommitResult = {
  statusCode: number;
  body: unknown;
  replayed: boolean;
};

/** Snapshot and replay receipt either commit together or both roll back. */
export async function commitCampaignCheckpoint(input: {
  snapshot: CampaignContinuationSnapshotRecord;
  responseBody: unknown;
  idempotencyKey: string | null;
  endpoint: string;
  requestHash: string;
  startOverride?: typeof startAICallIdempotency;
}): Promise<CheckpointCommitResult> {
  return db.transaction(async (tx) => {
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

    await saveCampaignContinuationToDatabase(input.snapshot, tx);
    if (input.idempotencyKey) {
      await completeAICallIdempotency({
        key: input.idempotencyKey, endpoint: input.endpoint, requestHash: input.requestHash,
        statusCode: 200, responseBody: input.responseBody,
      }, tx);
    }
    return { statusCode: 200, body: input.responseBody, replayed: false };
  });
}
