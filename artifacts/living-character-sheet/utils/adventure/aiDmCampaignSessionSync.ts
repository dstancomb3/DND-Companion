import type { AiDmArchivedCampaignSession } from "@/utils/adventure/aiDmCampaignSessionArchiveStorage";
import {
  fetchCampaignContinuationSnapshot,
  type CampaignContinuationSnapshot,
  submitCampaignContinuationDetailed,
  type SubmitCampaignContinuationResponse,
} from "@/utils/adventure/aiDmCampaignContinuationApi";
import { createFeedEntryId, type AiDmSessionFeedEntry } from "@/utils/adventure/aiDmSessionFeedScaffold";

export interface SubmitArchivedCampaignSessionResult {
  response: SubmitCampaignContinuationResponse;
  replayed: boolean;
}

export interface CampaignContinuationHydrateSeed {
  entries: AiDmSessionFeedEntry[];
  checkpointIndex: number;
  continuityStatus: "active" | "checkpoint" | "chapter_complete";
  statusMessage: string;
}

export function resolveCampaignHydrationSource(input: {
  archived: AiDmArchivedCampaignSession | null;
}): "local_archive" | "server_snapshot_fallback" {
  const archived = input.archived;
  if (archived && archived.entries.length > 0) {
    return "local_archive";
  }
  return "server_snapshot_fallback";
}

function buildHydrateStatusMessage(snapshot: CampaignContinuationSnapshot): string {
  const summary = snapshot.progressSummary.trim().slice(0, 120);
  const suffix = snapshot.progressSummary.trim().length > 120 ? "..." : "";
  return `Continuation snapshot loaded: checkpoint ${snapshot.checkpointIndex} (${snapshot.continuityStatus}) - ${summary}${suffix}`;
}

function buildHydrateEntries(snapshot: CampaignContinuationSnapshot): AiDmSessionFeedEntry[] {
  const summary = snapshot.progressSummary.trim();
  const recapLines = snapshot.recapLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(-6);

  const summaryEntry: AiDmSessionFeedEntry = {
    id: createFeedEntryId("campaign-server-summary"),
    role: "system",
    text:
      summary.length > 0
        ? `Server resume checkpoint ${snapshot.checkpointIndex}: ${summary}`
        : `Server resume checkpoint ${snapshot.checkpointIndex} loaded.`,
  };

  const recapEntries: AiDmSessionFeedEntry[] = recapLines.map((line) => ({
    id: createFeedEntryId("campaign-server-recap"),
    role: "dm",
    text: line,
  }));

  return [summaryEntry, ...recapEntries];
}

function buildCampaignContinuationSubmissionInput(session: AiDmArchivedCampaignSession) {
  const recapLines = session.entries
    .slice(-12)
    .map((entry) => entry.text.trim())
    .filter((line) => line.length > 0)
    .slice(0, 24);

  const summarySeed = session.entries
    .slice(-3)
    .map((entry) => entry.text.trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .slice(0, 220);

  const checkpointIndex = Math.max(0, Math.ceil(session.entries.length / 4));
  const continuityStatus: "active" | "checkpoint" | "chapter_complete" =
    session.entries.length > 10 ? "checkpoint" : "active";

  return {
    continuation: {
      schemaVersion: "campaign-continuation.v1" as const,
      sessionId: session.sessionId,
      campaignId: session.session.campaignId || session.sessionId,
      campaignLabel: session.session.campaignLabel || session.session.title,
      chapterLabel: session.session.chapterLabel || "Chapter 1",
      mode: "campaign_continuation" as const,
      difficulty: session.session.difficulty,
      stylePreset: session.session.stylePreset,
      guidanceSource: session.session.guidance.trim().length > 0 ? ("user" as const) : ("fallback" as const),
      entryCount: session.entries.length,
      checkpointIndex,
      continuityStatus,
      progressSummary: summarySeed || "Campaign progression checkpoint submitted.",
    },
    recapLines: recapLines.length > 0 ? recapLines : ["Campaign continuation checkpoint submitted."],
    clientSavedAt: session.savedAt,
  };
}

export async function submitArchivedCampaignSessionToServer(
  session: AiDmArchivedCampaignSession,
): Promise<SubmitArchivedCampaignSessionResult> {
  const submissionInput = buildCampaignContinuationSubmissionInput(session);
  return submitCampaignContinuationDetailed(submissionInput);
}

export async function fetchCampaignContinuationHydrateSeed(input: {
  sessionId: string;
}): Promise<{ found: false } | { found: true; seed: CampaignContinuationHydrateSeed }> {
  const snapshotOutcome = await fetchCampaignContinuationSnapshot({ sessionId: input.sessionId });
  if (!snapshotOutcome.found) {
    return { found: false };
  }

  const snapshot = snapshotOutcome.response.snapshot;
  return {
    found: true,
    seed: {
      entries: buildHydrateEntries(snapshot),
      checkpointIndex: snapshot.checkpointIndex,
      continuityStatus: snapshot.continuityStatus,
      statusMessage: buildHydrateStatusMessage(snapshot),
    },
  };
}