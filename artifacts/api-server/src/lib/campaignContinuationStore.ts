import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { campaignContinuationSnapshots, type CampaignContinuationSnapshot } from "@workspace/db/schema";

export type CampaignContinuationSnapshotRecord = {
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
  receivedAt: string;
  ingestTraceId: string;
  submissionId: string;
};

const fallbackSnapshotsBySession = new Map<string, CampaignContinuationSnapshotRecord>();

function cloneSnapshot(snapshot: CampaignContinuationSnapshotRecord): CampaignContinuationSnapshotRecord {
  return {
    continuation: { ...snapshot.continuation },
    recapLines: [...snapshot.recapLines],
    clientSavedAt: snapshot.clientSavedAt,
    receivedAt: snapshot.receivedAt,
    ingestTraceId: snapshot.ingestTraceId,
    submissionId: snapshot.submissionId,
  };
}

function isMissingTableError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "42P01";
}

function toSnapshotRecord(row: CampaignContinuationSnapshot): CampaignContinuationSnapshotRecord | null {
  const snapshot = row.snapshot as unknown;
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const candidate = snapshot as Partial<CampaignContinuationSnapshotRecord>;
  if (
    !candidate.continuation ||
    !Array.isArray(candidate.recapLines) ||
    typeof candidate.clientSavedAt !== "number" ||
    typeof candidate.receivedAt !== "string" ||
    typeof candidate.ingestTraceId !== "string" ||
    typeof candidate.submissionId !== "string"
  ) {
    return null;
  }

  return {
    continuation: candidate.continuation,
    recapLines: candidate.recapLines.filter((line): line is string => typeof line === "string"),
    clientSavedAt: candidate.clientSavedAt,
    receivedAt: candidate.receivedAt,
    ingestTraceId: candidate.ingestTraceId,
    submissionId: candidate.submissionId,
  };
}

async function loadFromDatabase(sessionId: string): Promise<CampaignContinuationSnapshotRecord | null> {
  const rows = await db.select().from(campaignContinuationSnapshots).where(eq(campaignContinuationSnapshots.sessionId, sessionId)).limit(1);
  if (rows.length === 0) return null;
  return toSnapshotRecord(rows[0]);
}

async function saveToDatabase(snapshot: CampaignContinuationSnapshotRecord): Promise<void> {
  const now = new Date();
  const row = {
    sessionId: snapshot.continuation.sessionId,
    schemaVersion: snapshot.continuation.schemaVersion,
    campaignId: snapshot.continuation.campaignId,
    campaignLabel: snapshot.continuation.campaignLabel,
    chapterLabel: snapshot.continuation.chapterLabel,
    checkpointIndex: snapshot.continuation.checkpointIndex,
    continuityStatus: snapshot.continuation.continuityStatus,
    progressSummary: snapshot.continuation.progressSummary,
    clientSavedAt: snapshot.clientSavedAt,
    recapLines: snapshot.recapLines,
    receivedAt: new Date(snapshot.receivedAt),
    ingestTraceId: snapshot.ingestTraceId,
    submissionId: snapshot.submissionId,
    snapshot,
    createdAt: now,
    updatedAt: now,
  };
  const updateRow = {
    ...row,
    updatedAt: now,
  };
  delete (updateRow as Partial<typeof row>).createdAt;

  await db
    .insert(campaignContinuationSnapshots)
    .values(row)
    .onConflictDoUpdate({
      target: campaignContinuationSnapshots.sessionId,
      set: updateRow,
    });
}

export async function loadCampaignContinuationSnapshot(sessionId: string): Promise<CampaignContinuationSnapshotRecord | null> {
  try {
    const loaded = await loadFromDatabase(sessionId);
    if (loaded) {
      // Read the cache after the await: another save may have completed while
      // this database read was in flight. A recovered database can also still
      // contain the snapshot from before an outage.
      const cached = fallbackSnapshotsBySession.get(sessionId);
      if (cached && cached.clientSavedAt > loaded.clientSavedAt) {
        return cloneSnapshot(cached);
      }
      fallbackSnapshotsBySession.set(sessionId, cloneSnapshot(loaded));
      return cloneSnapshot(loaded);
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[adventure] continuation snapshot load unavailable; using in-memory fallback", error);
    }
  }

  const fallback = fallbackSnapshotsBySession.get(sessionId) ?? null;
  return fallback ? cloneSnapshot(fallback) : null;
}

export async function saveCampaignContinuationSnapshot(snapshot: CampaignContinuationSnapshotRecord): Promise<void> {
  const sessionId = snapshot.continuation.sessionId;
  const cached = fallbackSnapshotsBySession.get(sessionId);
  if (!cached || snapshot.clientSavedAt >= cached.clientSavedAt) {
    fallbackSnapshotsBySession.set(sessionId, cloneSnapshot(snapshot));
  }
  try {
    await saveToDatabase(snapshot);
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[adventure] continuation snapshot save unavailable; using in-memory fallback", error);
    }
  }
}

export async function deleteCampaignContinuationSnapshot(sessionId: string): Promise<void> {
  fallbackSnapshotsBySession.delete(sessionId);
  try {
    await db.delete(campaignContinuationSnapshots).where(eq(campaignContinuationSnapshots.sessionId, sessionId));
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[adventure] continuation snapshot delete unavailable; using in-memory fallback", error);
    }
  }
}
