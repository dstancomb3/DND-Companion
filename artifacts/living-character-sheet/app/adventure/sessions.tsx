import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Share } from "react-native";
import { router } from "expo-router";
import { AdventureHeaderBackButton } from "@/components/adventure/AdventureHeaderBackButton";
import { useColors } from "@/hooks/useColors";
import { AI_DM_ROUTES, buildAiDmSessionPath, buildAiDmSessionRouteParams } from "@/utils/aiDmRouteDefs";
import {
  clearArchivedOneOffSessions,
  deleteArchivedOneOffSession,
  getArchivedOneOffSessions,
  type AiDmArchivedOneOffSession,
} from "@/utils/adventure/aiDmOneOffSessionArchiveStorage";
import {
  clearArchivedCampaignSessions,
  deleteArchivedCampaignSession,
  getArchivedCampaignSessions,
  upsertArchivedCampaignSession,
  type AiDmArchivedCampaignSession,
} from "@/utils/adventure/aiDmCampaignSessionArchiveStorage";
import {
  fetchCampaignContinuationHydrateSeed,
  submitArchivedCampaignSessionToServer,
} from "@/utils/adventure/aiDmCampaignSessionSync";
import {
  submitArchivedOneOffHandoffDetailed,
  SubmitOneOffHandoffError,
} from "@/utils/adventure/aiDmOneOffHandoffApi";
import { SubmitCampaignContinuationError } from "@/utils/adventure/aiDmCampaignContinuationApi";
import { buildOneOffSubmitJournalEntry } from "@/utils/adventure/aiDmOneOffSubmitJournal";
import {
  appendOneOffSubmitJournalEntry,
  clearOneOffSubmitJournalEntries,
  getOneOffSubmitJournalEntries,
  getOneOffSubmitJournalPreferences,
  setOneOffSubmitJournalPreferences,
} from "@/utils/adventure/aiDmOneOffSubmitJournalStorage";
import type { AiDmOneOffSubmitJournalEntry } from "@/utils/adventure/aiDmOneOffSubmitJournal";
import {
  buildSubmitJournalEmptyActionStatus,
  buildSubmitJournalExportPayload,
  deriveHasDiagnosticsContext,
  filterSubmitJournalEntries,
  formatSubmitJournalEntryLine,
  formatSubmitJournalRefreshedAt,
  formatSubmitJournalTime,
  shouldShowSubmitJournalFilterHiddenNotice,
  type SubmitJournalOutcomeFilter,
} from "@/utils/adventure/aiDmOneOffSubmitJournalPresentation";
const SUBMIT_JOURNAL_PREVIEW_LIMIT = 6;

function formatSavedAt(value: number): string {
  return new Date(value).toLocaleString();
}

interface CampaignSyncMeta {
  lastSyncedAt?: number;
  lastRefreshedFromServerAt?: number;
  serverCheckpointIndex?: number;
  serverContinuityStatus?: "active" | "checkpoint" | "chapter_complete";
}

export default function AdventureSessionsScreen() {
  const c = useColors();
  const [sessions, setSessions] = React.useState<AiDmArchivedOneOffSession[]>([]);
  const [campaignSessions, setCampaignSessions] = React.useState<AiDmArchivedCampaignSession[]>([]);
  const [statusBySession, setStatusBySession] = React.useState<Record<string, string>>({});
  const [campaignStatusBySession, setCampaignStatusBySession] = React.useState<Record<string, string>>({});
  const [campaignSyncMetaBySession, setCampaignSyncMetaBySession] = React.useState<Record<string, CampaignSyncMeta>>({});
  const [submittingBySession, setSubmittingBySession] = React.useState<Record<string, boolean>>({});
  const [submittingCampaignBySession, setSubmittingCampaignBySession] = React.useState<Record<string, boolean>>({});
  const [submitJournalEntries, setSubmitJournalEntries] = React.useState<AiDmOneOffSubmitJournalEntry[]>([]);
  const [journalStatus, setJournalStatus] = React.useState<string>("");
  const [lastJournalRefreshAt, setLastJournalRefreshAt] = React.useState<number | null>(null);
  const [journalOutcomeFilter, setJournalOutcomeFilter] = React.useState<SubmitJournalOutcomeFilter>("all");
  const [showTraceIds, setShowTraceIds] = React.useState<boolean>(false);
  const [journalPrefsHydrated, setJournalPrefsHydrated] = React.useState<boolean>(false);

  const visibleSubmitJournalEntries = React.useMemo(
    () => filterSubmitJournalEntries(submitJournalEntries, journalOutcomeFilter),
    [submitJournalEntries, journalOutcomeFilter],
  );
  const hasDiagnosticsContext = deriveHasDiagnosticsContext({
    sessionCount: sessions.length + campaignSessions.length,
    journalCount: submitJournalEntries.length,
  });

  const refreshSessions = React.useCallback(async () => {
    const [oneOffRecords, campaignRecords] = await Promise.all([
      getArchivedOneOffSessions(),
      getArchivedCampaignSessions(),
    ]);
    setSessions(oneOffRecords);
    setCampaignSessions(campaignRecords);
  }, []);

  const refreshSubmitJournal = React.useCallback(async () => {
    const entries = await getOneOffSubmitJournalEntries();
    setSubmitJournalEntries(entries.slice(0, SUBMIT_JOURNAL_PREVIEW_LIMIT));
    setLastJournalRefreshAt(Date.now());
  }, []);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      const [records, journal, prefs] = await Promise.all([
        Promise.all([getArchivedOneOffSessions(), getArchivedCampaignSessions()]),
        getOneOffSubmitJournalEntries(),
        getOneOffSubmitJournalPreferences(),
      ]);
      if (!mounted) return;
      setSessions(records[0]);
      setCampaignSessions(records[1]);
      setSubmitJournalEntries(journal.slice(0, SUBMIT_JOURNAL_PREVIEW_LIMIT));
      setLastJournalRefreshAt(Date.now());
      setJournalOutcomeFilter(prefs.outcomeFilter);
      setShowTraceIds(prefs.showTraceIds);
      setJournalPrefsHydrated(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!journalPrefsHydrated) return;
    void setOneOffSubmitJournalPreferences({
      outcomeFilter: journalOutcomeFilter,
      showTraceIds,
    });
  }, [journalOutcomeFilter, showTraceIds, journalPrefsHydrated]);

  async function handleDelete(sessionId: string) {
    setJournalStatus("");
    await deleteArchivedOneOffSession(sessionId);
    await refreshSessions();
  }

  async function handleClearArchive() {
    setJournalStatus("");
    await clearArchivedOneOffSessions();
    setStatusBySession({});
    setSubmittingBySession({});
    await refreshSessions();
  }

  async function handleDeleteCampaign(sessionId: string) {
    setJournalStatus("");
    await deleteArchivedCampaignSession(sessionId);
    await refreshSessions();
  }

  async function handleClearCampaignArchive() {
    setJournalStatus("");
    await clearArchivedCampaignSessions();
    setCampaignStatusBySession({});
    setCampaignSyncMetaBySession({});
    setSubmittingCampaignBySession({});
    await refreshSessions();
  }

  async function handleSyncCampaignToServer(session: AiDmArchivedCampaignSession) {
    setJournalStatus("");
    setSubmittingCampaignBySession((prev) => ({ ...prev, [session.sessionId]: true }));
    setCampaignStatusBySession((prev) => ({ ...prev, [session.sessionId]: "Submitting campaign snapshot..." }));
    try {
      const result = await submitArchivedCampaignSessionToServer(session);
      const statusMessage = result.replayed
        ? `Replay acknowledged (${result.response.continuation.schemaVersion}) at ${new Date(result.response.receivedAt).toLocaleTimeString()}`
        : `Submitted (${result.response.continuation.schemaVersion}) at ${new Date(result.response.receivedAt).toLocaleTimeString()}`;
      const statusWithTrace = result.response.ingestTraceId
        ? `${statusMessage} [trace ${result.response.ingestTraceId}]`
        : statusMessage;
      setCampaignStatusBySession((prev) => ({
        ...prev,
        [session.sessionId]: statusWithTrace,
      }));
      setCampaignSyncMetaBySession((prev) => ({
        ...prev,
        [session.sessionId]: {
          ...prev[session.sessionId],
          lastSyncedAt: Date.now(),
          serverCheckpointIndex: result.response.continuation.checkpointIndex,
          serverContinuityStatus: result.response.continuation.continuityStatus,
        },
      }));
    } catch (error) {
      if (error instanceof SubmitCampaignContinuationError) {
        const mappedMessage =
          error.code === "idempotency_in_progress"
            ? "Submit blocked: another campaign snapshot request with this key is still in progress."
            : error.code === "idempotency_payload_mismatch"
              ? "Submit blocked: campaign snapshot idempotency key conflicts with a different payload."
              : error.code === "invalid_handoff_payload"
                ? "Submit rejected: archived campaign payload is invalid."
                : `Submit failed: ${error.message}`;
        setCampaignStatusBySession((prev) => ({ ...prev, [session.sessionId]: mappedMessage }));
      } else {
        const message = error instanceof Error ? error.message : "Submit failed";
        setCampaignStatusBySession((prev) => ({ ...prev, [session.sessionId]: `Submit failed: ${message}` }));
      }
    } finally {
      setSubmittingCampaignBySession((prev) => ({ ...prev, [session.sessionId]: false }));
    }
  }

  async function handleRefreshCampaignFromServer(session: AiDmArchivedCampaignSession) {
    setJournalStatus("");
    setSubmittingCampaignBySession((prev) => ({ ...prev, [session.sessionId]: true }));
    setCampaignStatusBySession((prev) => ({ ...prev, [session.sessionId]: "Refreshing from server snapshot..." }));
    try {
      const snapshotSeed = await fetchCampaignContinuationHydrateSeed({ sessionId: session.sessionId });
      if (!snapshotSeed.found) {
        setCampaignStatusBySession((prev) => ({
          ...prev,
          [session.sessionId]: "No continuation snapshot found on server for this session.",
        }));
        return;
      }

      await upsertArchivedCampaignSession({
        sessionId: session.sessionId,
        session: session.session,
        entries: snapshotSeed.seed.entries,
        pendingChoices: [],
        prologueDone: snapshotSeed.seed.entries.length > 0,
      });

      setCampaignStatusBySession((prev) => ({
        ...prev,
        [session.sessionId]: `Refreshed from server: checkpoint ${snapshotSeed.seed.checkpointIndex} (${snapshotSeed.seed.continuityStatus}).`,
      }));
      setCampaignSyncMetaBySession((prev) => ({
        ...prev,
        [session.sessionId]: {
          ...prev[session.sessionId],
          lastRefreshedFromServerAt: Date.now(),
          serverCheckpointIndex: snapshotSeed.seed.checkpointIndex,
          serverContinuityStatus: snapshotSeed.seed.continuityStatus,
        },
      }));
      await refreshSessions();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setCampaignStatusBySession((prev) => ({
        ...prev,
        [session.sessionId]: `Server refresh failed: ${message}`,
      }));
    } finally {
      setSubmittingCampaignBySession((prev) => ({ ...prev, [session.sessionId]: false }));
    }
  }

  async function handleSubmitToServer(session: AiDmArchivedOneOffSession) {
    setJournalStatus("");
    setSubmittingBySession((prev) => ({ ...prev, [session.sessionId]: true }));
    setStatusBySession((prev) => ({ ...prev, [session.sessionId]: "Submitting handoff..." }));
    try {
      const result = await submitArchivedOneOffHandoffDetailed({ archive: session });
      const statusMessage = result.replayed
        ? `Replay acknowledged (${result.response.handoff.schemaVersion}) at ${new Date(result.response.receivedAt).toLocaleTimeString()}`
        : `Submitted (${result.response.handoff.schemaVersion}) at ${new Date(result.response.receivedAt).toLocaleTimeString()}`;
      const statusWithTrace = result.response.ingestTraceId
        ? `${statusMessage} [trace ${result.response.ingestTraceId}]`
        : statusMessage;
      setStatusBySession((prev) => ({
        ...prev,
        [session.sessionId]: statusWithTrace,
      }));
      await appendOneOffSubmitJournalEntry(
        buildOneOffSubmitJournalEntry({
          sessionId: session.sessionId,
          outcome: result.replayed ? "replay" : "submitted",
          message: statusMessage,
          ingestTraceId: result.response.ingestTraceId,
        }),
      );
      await refreshSubmitJournal();
    } catch (error) {
      if (error instanceof SubmitOneOffHandoffError) {
        const mappedMessage =
          error.code === "idempotency_in_progress"
            ? "Submit blocked: another request with this handoff key is still in progress."
            : error.code === "idempotency_payload_mismatch"
              ? "Submit blocked: idempotency key conflicts with a different payload."
              : error.code === "invalid_handoff_payload"
                ? "Submit rejected: archived handoff payload is invalid."
                : `Submit failed: ${error.message}`;
        setStatusBySession((prev) => ({ ...prev, [session.sessionId]: mappedMessage }));
        await appendOneOffSubmitJournalEntry(
          buildOneOffSubmitJournalEntry({
            sessionId: session.sessionId,
            outcome:
              error.code === "idempotency_in_progress"
                ? "conflict_in_progress"
                : error.code === "idempotency_payload_mismatch"
                  ? "conflict_payload_mismatch"
                  : error.code === "invalid_handoff_payload"
                    ? "invalid_payload"
                    : "failed",
            message: mappedMessage,
          }),
        );
        await refreshSubmitJournal();
      } else {
        const message = error instanceof Error ? error.message : "Submit failed";
        const mappedMessage = `Submit failed: ${message}`;
        setStatusBySession((prev) => ({ ...prev, [session.sessionId]: mappedMessage }));
        await appendOneOffSubmitJournalEntry(
          buildOneOffSubmitJournalEntry({
            sessionId: session.sessionId,
            outcome: "failed",
            message: mappedMessage,
          }),
        );
        await refreshSubmitJournal();
      }
    } finally {
      setSubmittingBySession((prev) => ({ ...prev, [session.sessionId]: false }));
    }
  }

  async function handleClearSubmitJournal() {
    await clearOneOffSubmitJournalEntries();
    await refreshSubmitJournal();
    setJournalOutcomeFilter("all");
    setJournalStatus("Submit journal cleared.");
  }

  async function handleRefreshSubmitJournal() {
    await refreshSubmitJournal();
    setJournalStatus("Submit journal refreshed.");
  }

  async function handleCopySubmitJournal() {
    const emptyStatus = buildSubmitJournalEmptyActionStatus({
      action: "copy",
      visibleCount: visibleSubmitJournalEntries.length,
      totalCount: submitJournalEntries.length,
      filter: journalOutcomeFilter,
    });
    if (emptyStatus) {
      setJournalStatus(emptyStatus);
      return;
    }

    const journalText = visibleSubmitJournalEntries
      .map((entry) => {
        const trace = showTraceIds && entry.ingestTraceId ? ` [trace ${entry.ingestTraceId}]` : "";
        return `${formatSubmitJournalEntryLine(entry)}${trace}`;
      })
      .join("\n");

    try {
      const maybeNavigator = (globalThis as { navigator?: { clipboard?: { writeText?: (text: string) => Promise<void> } } }).navigator;
      if (!maybeNavigator?.clipboard?.writeText) {
        setJournalStatus("Clipboard is unavailable on this platform.");
        return;
      }
      await maybeNavigator.clipboard.writeText(journalText);
      setJournalStatus("Submit journal copied.");
    } catch {
      setJournalStatus("Could not copy submit journal.");
    }
  }

  async function handleExportSubmitJournal() {
    const emptyStatus = buildSubmitJournalEmptyActionStatus({
      action: "export",
      visibleCount: visibleSubmitJournalEntries.length,
      totalCount: submitJournalEntries.length,
      filter: journalOutcomeFilter,
    });
    if (emptyStatus) {
      setJournalStatus(emptyStatus);
      return;
    }

    const exportPayload = buildSubmitJournalExportPayload({
      visibleEntries: visibleSubmitJournalEntries,
      totalEntries: submitJournalEntries.length,
      filter: journalOutcomeFilter,
      refreshedAt: lastJournalRefreshAt,
      includeTraceIds: showTraceIds,
    });

    try {
      await Share.share({
        title: "One-Off Submit Journal Export",
        message: exportPayload,
      });
      setJournalStatus("Submit journal export opened.");
      return;
    } catch {
      // Fall back to clipboard copy when share is unavailable.
    }

    try {
      const maybeNavigator = (globalThis as { navigator?: { clipboard?: { writeText?: (text: string) => Promise<void> } } }).navigator;
      if (!maybeNavigator?.clipboard?.writeText) {
        setJournalStatus("Export unavailable on this platform.");
        return;
      }
      await maybeNavigator.clipboard.writeText(exportPayload);
      setJournalStatus("Submit journal export copied.");
    } catch {
      setJournalStatus("Could not export submit journal.");
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AdventureHeaderBackButton destination={AI_DM_ROUTES.adventure.home} />

        <Text style={[styles.title, { color: c.foreground }]}>Saved Sessions</Text>
        <Text style={[styles.subtitle, { color: c.mutedForeground }]}>Finished one-off finales and campaign resumes saved on this device.</Text>

        {hasDiagnosticsContext ? (
          <TouchableOpacity
            onPress={() => router.replace(AI_DM_ROUTES.adventure.sessions as any)}
            style={[styles.clearBtn, { borderColor: c.border, backgroundColor: c.card }]}
            activeOpacity={0.82}
          >
            <Text style={[styles.clearBtnText, { color: c.foreground }]}>Return to Saved Sessions</Text>
          </TouchableOpacity>
        ) : null}

        {campaignSessions.length > 0 ? (
          <TouchableOpacity
            onPress={() => void handleClearCampaignArchive()}
            style={[styles.clearBtn, { borderColor: c.border, backgroundColor: c.card }]}
            activeOpacity={0.82}
          >
            <Text style={[styles.clearBtnText, { color: c.foreground }]}>Clear Campaign Archive</Text>
          </TouchableOpacity>
        ) : null}

        {campaignSessions.length === 0 ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
            <Text style={[styles.cardTitle, { color: c.foreground }]}>No Saved Campaign Sessions Yet</Text>
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>Starting an adventure now creates a resumable campaign record here automatically.</Text>
          </View>
        ) : null}

        {campaignSessions.map((session) => (
          <View
            key={session.sessionId}
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          >
            {(() => {
              const meta = campaignSyncMetaBySession[session.sessionId];
              const hasMeta = Boolean(meta?.lastSyncedAt || meta?.lastRefreshedFromServerAt || typeof meta?.serverCheckpointIndex === "number");
              return hasMeta ? (
                <>
                  {typeof meta?.serverCheckpointIndex === "number" ? (
                    <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>Server checkpoint {meta.serverCheckpointIndex} ({meta.serverContinuityStatus ?? "active"})</Text>
                  ) : null}
                  {meta?.lastSyncedAt ? (
                    <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>Last synced {formatSavedAt(meta.lastSyncedAt)}</Text>
                  ) : null}
                  {meta?.lastRefreshedFromServerAt ? (
                    <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>Last refreshed from server {formatSavedAt(meta.lastRefreshedFromServerAt)}</Text>
                  ) : null}
                </>
              ) : null;
            })()}
            <Text style={[styles.cardTitle, { color: c.foreground }]}>{session.session.campaignLabel || session.session.title}</Text>
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>{session.session.chapterLabel} · campaign_scaffold · {session.session.difficulty} · {session.session.stylePreset}</Text>
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>{session.entries.length} entries · {session.pendingChoices.length} pending choices</Text>
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>Saved {formatSavedAt(session.savedAt)}</Text>
            {campaignStatusBySession[session.sessionId] ? (
              <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>{campaignStatusBySession[session.sessionId]}</Text>
            ) : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: buildAiDmSessionPath(session.sessionId),
                    params: buildAiDmSessionRouteParams({
                      source: "saved-campaign-archive",
                      mode: session.session.mode,
                      title: session.session.title,
                      difficulty: session.session.difficulty,
                      stylePreset: session.session.stylePreset,
                      startInCombat: session.session.startInCombat,
                      guidanceText: session.session.guidance,
                      campaignId: session.session.campaignId,
                      campaignLabel: session.session.campaignLabel,
                      chapterLabel: session.session.chapterLabel,
                    }),
                  } as any)
                }
                style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
                activeOpacity={0.82}
              >
                <Text style={[styles.actionBtnText, { color: c.foreground }]}>Resume Session</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => void handleSyncCampaignToServer(session)}
                style={[
                  styles.actionBtn,
                  {
                    borderColor: c.border,
                    backgroundColor: c.background,
                    opacity: submittingCampaignBySession[session.sessionId] ? 0.6 : 1,
                  },
                ]}
                activeOpacity={0.82}
                disabled={Boolean(submittingCampaignBySession[session.sessionId])}
              >
                <Text style={[styles.actionBtnText, { color: c.foreground }]}>Sync to Server</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => void handleRefreshCampaignFromServer(session)}
                style={[
                  styles.actionBtn,
                  {
                    borderColor: c.border,
                    backgroundColor: c.background,
                    opacity: submittingCampaignBySession[session.sessionId] ? 0.6 : 1,
                  },
                ]}
                activeOpacity={0.82}
                disabled={Boolean(submittingCampaignBySession[session.sessionId])}
              >
                <Text style={[styles.actionBtnText, { color: c.foreground }]}>Refresh from Server</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => void handleDeleteCampaign(session.sessionId)}
                style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
                activeOpacity={0.82}
              >
                <Text style={[styles.actionBtnText, { color: c.foreground }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {sessions.length > 0 ? (
          <TouchableOpacity
            onPress={() => void handleClearArchive()}
            style={[styles.clearBtn, { borderColor: c.border, backgroundColor: c.card }]}
            activeOpacity={0.82}
          >
            <Text style={[styles.clearBtnText, { color: c.foreground }]}>Clear Archive</Text>
          </TouchableOpacity>
        ) : null}

        {sessions.length === 0 ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
            <Text style={[styles.cardTitle, { color: c.foreground }]}>No Completed One-Off Sessions Yet</Text>
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>Finish an Adventure one-off and save the archive to see it here.</Text>
          </View>
        ) : null}

        {sessions.map((session) => (
          <View
            key={session.sessionId}
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <Text style={[styles.cardTitle, { color: c.foreground }]}>{session.handoff.title}</Text>
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>Completed one-off · {session.handoff.difficulty} · {session.handoff.stylePreset}</Text>
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>Saved {formatSavedAt(session.savedAt)}</Text>
            {statusBySession[session.sessionId] ? (
              <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>{statusBySession[session.sessionId]}</Text>
            ) : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: `/adventure/session/${session.sessionId}`,
                    params: {
                      mode: session.handoff.mode,
                      title: session.handoff.title,
                      difficulty: session.handoff.difficulty,
                      stylePreset: session.handoff.stylePreset,
                      startInCombat: session.handoff.startInCombat ? "1" : "0",
                      source: "saved-session-archive",
                    },
                  } as any)
                }
                style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
                activeOpacity={0.82}
              >
                  <Text style={[styles.actionBtnText, { color: c.foreground }]}>Reopen Finale</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => void handleSubmitToServer(session)}
                style={[
                  styles.actionBtn,
                  {
                    borderColor: c.border,
                    backgroundColor: c.background,
                    opacity: submittingBySession[session.sessionId] ? 0.6 : 1,
                  },
                ]}
                activeOpacity={0.82}
                disabled={Boolean(submittingBySession[session.sessionId])}
              >
                <Text style={[styles.actionBtnText, { color: c.foreground }]}>Submit to Server</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => void handleDelete(session.sessionId)}
                style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
                activeOpacity={0.82}
              >
                <Text style={[styles.actionBtnText, { color: c.foreground }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.foreground }]}>Recent Submit Journal</Text>
          <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
            Showing latest {visibleSubmitJournalEntries.length} of {submitJournalEntries.length} entries.
          </Text>
          <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>{formatSubmitJournalRefreshedAt(lastJournalRefreshAt)}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => setJournalOutcomeFilter("all")}
              style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
              activeOpacity={0.82}
            >
              <Text style={[styles.actionBtnText, { color: c.foreground }]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setJournalOutcomeFilter("submitted")}
              style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
              activeOpacity={0.82}
            >
              <Text style={[styles.actionBtnText, { color: c.foreground }]}>Submitted</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setJournalOutcomeFilter("replay")}
              style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
              activeOpacity={0.82}
            >
              <Text style={[styles.actionBtnText, { color: c.foreground }]}>Replay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setJournalOutcomeFilter("failures")}
              style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
              activeOpacity={0.82}
            >
              <Text style={[styles.actionBtnText, { color: c.foreground }]}>Failures</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowTraceIds((prev) => !prev)}
              style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
              activeOpacity={0.82}
            >
              <Text style={[styles.actionBtnText, { color: c.foreground }]}>
                {showTraceIds ? "Hide Trace IDs" : "Show Trace IDs"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => void handleRefreshSubmitJournal()}
              style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
              activeOpacity={0.82}
            >
              <Text style={[styles.actionBtnText, { color: c.foreground }]}>Refresh Journal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleCopySubmitJournal()}
              style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
              activeOpacity={0.82}
            >
              <Text style={[styles.actionBtnText, { color: c.foreground }]}>Copy Journal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleExportSubmitJournal()}
              style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
              activeOpacity={0.82}
            >
              <Text style={[styles.actionBtnText, { color: c.foreground }]}>Export Journal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleClearSubmitJournal()}
              style={[styles.actionBtn, { borderColor: c.border, backgroundColor: c.background }]}
              activeOpacity={0.82}
            >
              <Text style={[styles.actionBtnText, { color: c.foreground }]}>Clear Journal</Text>
            </TouchableOpacity>
          </View>
          {journalStatus ? (
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>{journalStatus}</Text>
          ) : null}
          {shouldShowSubmitJournalFilterHiddenNotice(
            submitJournalEntries.length,
            visibleSubmitJournalEntries.length,
          ) ? (
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
              Current filter hides all entries. Change filter to view available history.
            </Text>
          ) : null}
          {visibleSubmitJournalEntries.length === 0 ? (
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>No submit attempts recorded yet.</Text>
          ) : (
            visibleSubmitJournalEntries.map((entry, index) => (
              <View key={`${entry.sessionId}-${entry.at}-${index}`} style={styles.journalRow}>
                <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
                  {formatSubmitJournalTime(entry.at)} - {entry.sessionId} - {entry.outcome}
                </Text>
                <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>{entry.message}</Text>
                {showTraceIds && entry.ingestTraceId ? (
                  <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>trace {entry.ingestTraceId}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 14, marginBottom: 4 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardMeta: { fontSize: 12 },
  journalRow: {
    marginTop: 4,
    gap: 2,
  },
  clearBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 2,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionsRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
