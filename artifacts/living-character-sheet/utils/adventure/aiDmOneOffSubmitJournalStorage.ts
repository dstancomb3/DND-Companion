import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  trimOneOffSubmitJournal,
  type AiDmOneOffSubmitJournalEntry,
} from "@/utils/adventure/aiDmOneOffSubmitJournal";
import type { SubmitJournalOutcomeFilter } from "@/utils/adventure/aiDmOneOffSubmitJournalPresentation";

const ONE_OFF_SUBMIT_JOURNAL_KEY = "@ai_dm_oneoff_submit_journal_v1";
const ONE_OFF_SUBMIT_JOURNAL_PREFS_KEY = "@ai_dm_oneoff_submit_journal_prefs_v1";

export interface OneOffSubmitJournalPreferences {
  outcomeFilter: SubmitJournalOutcomeFilter;
  showTraceIds: boolean;
}

const DEFAULT_ONE_OFF_SUBMIT_JOURNAL_PREFERENCES: OneOffSubmitJournalPreferences = {
  outcomeFilter: "all",
  showTraceIds: false,
};

function isSubmitJournalOutcomeFilter(value: unknown): value is SubmitJournalOutcomeFilter {
  return value === "all" || value === "submitted" || value === "replay" || value === "failures";
}

export async function getOneOffSubmitJournalEntries(): Promise<AiDmOneOffSubmitJournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ONE_OFF_SUBMIT_JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiDmOneOffSubmitJournalEntry[];
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter(
      (entry) =>
        !!entry &&
        typeof entry.sessionId === "string" &&
        typeof entry.at === "number" &&
        typeof entry.outcome === "string" &&
        typeof entry.message === "string",
    );
    return trimOneOffSubmitJournal(filtered);
  } catch {
    return [];
  }
}

export async function appendOneOffSubmitJournalEntry(entry: AiDmOneOffSubmitJournalEntry): Promise<void> {
  const existing = await getOneOffSubmitJournalEntries();
  const next = trimOneOffSubmitJournal([entry, ...existing]);
  await AsyncStorage.setItem(ONE_OFF_SUBMIT_JOURNAL_KEY, JSON.stringify(next));
}

export async function clearOneOffSubmitJournalEntries(): Promise<void> {
  await AsyncStorage.removeItem(ONE_OFF_SUBMIT_JOURNAL_KEY);
}

export async function getOneOffSubmitJournalPreferences(): Promise<OneOffSubmitJournalPreferences> {
  try {
    const raw = await AsyncStorage.getItem(ONE_OFF_SUBMIT_JOURNAL_PREFS_KEY);
    if (!raw) return DEFAULT_ONE_OFF_SUBMIT_JOURNAL_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<OneOffSubmitJournalPreferences>;
    if (!parsed || typeof parsed !== "object") return DEFAULT_ONE_OFF_SUBMIT_JOURNAL_PREFERENCES;
    const outcomeFilter = isSubmitJournalOutcomeFilter(parsed.outcomeFilter)
      ? parsed.outcomeFilter
      : DEFAULT_ONE_OFF_SUBMIT_JOURNAL_PREFERENCES.outcomeFilter;
    const showTraceIds =
      typeof parsed.showTraceIds === "boolean"
        ? parsed.showTraceIds
        : DEFAULT_ONE_OFF_SUBMIT_JOURNAL_PREFERENCES.showTraceIds;
    return {
      outcomeFilter,
      showTraceIds,
    };
  } catch {
    return DEFAULT_ONE_OFF_SUBMIT_JOURNAL_PREFERENCES;
  }
}

export async function setOneOffSubmitJournalPreferences(
  prefs: OneOffSubmitJournalPreferences,
): Promise<void> {
  const next: OneOffSubmitJournalPreferences = {
    outcomeFilter: isSubmitJournalOutcomeFilter(prefs.outcomeFilter)
      ? prefs.outcomeFilter
      : DEFAULT_ONE_OFF_SUBMIT_JOURNAL_PREFERENCES.outcomeFilter,
    showTraceIds: Boolean(prefs.showTraceIds),
  };
  await AsyncStorage.setItem(ONE_OFF_SUBMIT_JOURNAL_PREFS_KEY, JSON.stringify(next));
}
