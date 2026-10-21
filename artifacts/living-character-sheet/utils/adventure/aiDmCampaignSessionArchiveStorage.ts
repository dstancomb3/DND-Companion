import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AiDmSessionFeedEntry } from "@/utils/adventure/aiDmSessionFeedScaffold";

const CAMPAIGN_ARCHIVE_KEY = "@ai_dm_campaign_archive_v1";
const MAX_ARCHIVE_ITEMS = 40;

export interface AiDmArchivedCampaignSession {
  sessionId: string;
  savedAt: number;
  session: {
    mode: "campaign_scaffold";
    title: string;
    difficulty: string;
    stylePreset: string;
    startInCombat: boolean;
    guidance: string;
    campaignId: string;
    campaignLabel: string;
    chapterLabel: string;
  };
  entries: AiDmSessionFeedEntry[];
  pendingChoices: string[];
  prologueDone: boolean;
}

function normalizeFeedEntries(value: unknown): AiDmSessionFeedEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .filter(
      (entry) =>
        typeof entry.id === "string" &&
        (entry.role === "system" || entry.role === "dm" || entry.role === "player" || entry.role === "tool") &&
        typeof entry.text === "string",
    )
    .map((entry) => ({
      id: String(entry.id),
      role: entry.role as AiDmSessionFeedEntry["role"],
      text: String(entry.text),
    }));
}

function normalizeArchiveEntry(value: unknown): AiDmArchivedCampaignSession | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  const session = typeof entry.session === "object" && entry.session !== null ? (entry.session as Record<string, unknown>) : null;
  if (!session) return null;
  if (
    typeof entry.sessionId !== "string" ||
    typeof entry.savedAt !== "number" ||
    session.mode !== "campaign_scaffold" ||
    typeof session.title !== "string" ||
    typeof session.difficulty !== "string" ||
    typeof session.stylePreset !== "string" ||
    typeof session.startInCombat !== "boolean" ||
    typeof session.guidance !== "string" ||
    typeof session.campaignId !== "string" ||
    typeof session.campaignLabel !== "string" ||
    typeof session.chapterLabel !== "string"
  ) {
    return null;
  }

  return {
    sessionId: entry.sessionId,
    savedAt: entry.savedAt,
    session: {
      mode: "campaign_scaffold",
      title: session.title,
      difficulty: session.difficulty,
      stylePreset: session.stylePreset,
      startInCombat: session.startInCombat,
      guidance: session.guidance,
      campaignId: session.campaignId,
      campaignLabel: session.campaignLabel,
      chapterLabel: session.chapterLabel,
    },
    entries: normalizeFeedEntries(entry.entries),
    pendingChoices: Array.isArray(entry.pendingChoices)
      ? entry.pendingChoices.filter((choice): choice is string => typeof choice === "string")
      : [],
    prologueDone: entry.prologueDone === true,
  };
}

export async function getArchivedCampaignSessions(): Promise<AiDmArchivedCampaignSession[]> {
  try {
    const raw = await AsyncStorage.getItem(CAMPAIGN_ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeArchiveEntry)
      .filter((entry): entry is AiDmArchivedCampaignSession => entry !== null)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function getArchivedCampaignSession(sessionId: string): Promise<AiDmArchivedCampaignSession | null> {
  const all = await getArchivedCampaignSessions();
  return all.find((entry) => entry.sessionId === sessionId) ?? null;
}

export async function upsertArchivedCampaignSession(input: {
  sessionId: string;
  session: AiDmArchivedCampaignSession["session"];
  entries: AiDmSessionFeedEntry[];
  pendingChoices: string[];
  prologueDone: boolean;
  now?: number;
}): Promise<AiDmArchivedCampaignSession> {
  const savedAt = input.now ?? Date.now();
  const nextEntry: AiDmArchivedCampaignSession = {
    sessionId: input.sessionId,
    savedAt,
    session: input.session,
    entries: input.entries,
    pendingChoices: input.pendingChoices,
    prologueDone: input.prologueDone,
  };

  const all = await getArchivedCampaignSessions();
  const withoutCurrent = all.filter((entry) => entry.sessionId !== nextEntry.sessionId);
  const next = [nextEntry, ...withoutCurrent].slice(0, MAX_ARCHIVE_ITEMS);

  await AsyncStorage.setItem(CAMPAIGN_ARCHIVE_KEY, JSON.stringify(next));
  return nextEntry;
}

export async function deleteArchivedCampaignSession(sessionId: string): Promise<void> {
  const all = await getArchivedCampaignSessions();
  const next = all.filter((entry) => entry.sessionId !== sessionId);
  await AsyncStorage.setItem(CAMPAIGN_ARCHIVE_KEY, JSON.stringify(next));
}

export async function clearArchivedCampaignSessions(): Promise<void> {
  await AsyncStorage.removeItem(CAMPAIGN_ARCHIVE_KEY);
}