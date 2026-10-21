import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AiDmOneOffSessionHandoffPayload } from "@/utils/adventure/aiDmOneOffRecapScaffold";

const ONE_OFF_ARCHIVE_KEY = "@ai_dm_oneoff_archive_v1";
const MAX_ARCHIVE_ITEMS = 40;

export interface AiDmArchivedOneOffSession {
  sessionId: string;
  savedAt: number;
  handoff: AiDmOneOffSessionHandoffPayload;
  recapLines: string[];
}

export async function getArchivedOneOffSessions(): Promise<AiDmArchivedOneOffSession[]> {
  try {
    const raw = await AsyncStorage.getItem(ONE_OFF_ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiDmArchivedOneOffSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => !!entry && typeof entry.sessionId === "string")
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function upsertArchivedOneOffSession(input: {
  handoff: AiDmOneOffSessionHandoffPayload;
  recapLines: string[];
  now?: number;
}): Promise<AiDmArchivedOneOffSession> {
  const savedAt = input.now ?? Date.now();
  const nextEntry: AiDmArchivedOneOffSession = {
    sessionId: input.handoff.sessionId,
    savedAt,
    handoff: input.handoff,
    recapLines: input.recapLines,
  };

  const all = await getArchivedOneOffSessions();
  const withoutCurrent = all.filter((entry) => entry.sessionId !== nextEntry.sessionId);
  const next = [nextEntry, ...withoutCurrent].slice(0, MAX_ARCHIVE_ITEMS);

  await AsyncStorage.setItem(ONE_OFF_ARCHIVE_KEY, JSON.stringify(next));
  return nextEntry;
}

export async function deleteArchivedOneOffSession(sessionId: string): Promise<void> {
  const all = await getArchivedOneOffSessions();
  const next = all.filter((entry) => entry.sessionId !== sessionId);
  await AsyncStorage.setItem(ONE_OFF_ARCHIVE_KEY, JSON.stringify(next));
}

export async function clearArchivedOneOffSessions(): Promise<void> {
  await AsyncStorage.removeItem(ONE_OFF_ARCHIVE_KEY);
}
