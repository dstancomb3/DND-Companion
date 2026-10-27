import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal } from "react-native";
import { router } from "expo-router";
import { AdventureHeaderBackButton } from "@/components/adventure/AdventureHeaderBackButton";
import { AiDmSessionAwarenessPlaceholderStrip } from "@/components/adventure/AiDmSessionAwarenessPlaceholderStrip";
import { useAdventureSessionAwareness } from "@/context/AdventureSessionContext";
import { useColors } from "@/hooks/useColors";
import { AI_DM_ROUTES } from "@/utils/aiDmRouteDefs";
import { getArchivedOneOffSessions } from "@/utils/adventure/aiDmOneOffSessionArchiveStorage";
import { getOneOffSubmitJournalEntries } from "@/utils/adventure/aiDmOneOffSubmitJournalStorage";
import { deriveHasDiagnosticsContext } from "@/utils/adventure/aiDmOneOffSubmitJournalPresentation";

export default function AdventureHomeScreen() {
  const c = useColors();
  const { awarenessPlaceholder, clearActiveSession } = useAdventureSessionAwareness();
  const [hasDiagnosticsContext, setHasDiagnosticsContext] = React.useState<boolean>(false);
  const [showEndConfirmation, setShowEndConfirmation] = React.useState(false);
  const [endingSession, setEndingSession] = React.useState(false);

  const handleEndAdventureSession = React.useCallback(() => setShowEndConfirmation(true), []);
  const confirmEndAdventureSession = React.useCallback(async () => {
    if (endingSession) return;
    setEndingSession(true);
    try {
      await clearActiveSession();
      setShowEndConfirmation(false);
    } finally {
      setEndingSession(false);
    }
  }, [clearActiveSession, endingSession]);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      const [sessions, journalEntries] = await Promise.all([
        getArchivedOneOffSessions(),
        getOneOffSubmitJournalEntries(),
      ]);
      if (!mounted) return;
      setHasDiagnosticsContext(
        deriveHasDiagnosticsContext({
          sessionCount: sessions.length,
          journalCount: journalEntries.length,
        }),
      );
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AdventureHeaderBackButton destination="/landing" />

        <Text style={[styles.title, { color: c.foreground }]}>Adventure</Text>
        <Text style={[styles.subtitle, { color: c.mutedForeground }]}>Campaign sessions with local orchestration and encounter gating (server AI pending)</Text>

        <AiDmSessionAwarenessPlaceholderStrip
          placeholder={awarenessPlaceholder}
          onEndSession={handleEndAdventureSession}
        />

        <TouchableOpacity
          onPress={() => router.push("/adventure/new" as any)}
          style={[styles.button, { backgroundColor: c.primary }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: c.primaryForeground }]}>Start New Adventure</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/adventure/sessions" as any)}
          style={[styles.button, { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: c.foreground }]}>Saved Sessions</Text>
        </TouchableOpacity>

        {hasDiagnosticsContext ? (
          <View style={[styles.contextCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.contextTitle, { color: c.foreground }]}>Diagnostics Context Active</Text>
            <Text style={[styles.contextBody, { color: c.mutedForeground }]}>Local one-off archive or submit journal history is available.</Text>
            <TouchableOpacity
              onPress={() => router.push(AI_DM_ROUTES.adventure.sessions as any)}
              style={[styles.contextAction, { borderColor: c.border, backgroundColor: c.background }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.contextActionText, { color: c.foreground }]}>Return to Saved Sessions</Text>
            </TouchableOpacity>
          </View>
        ) : null}

      </ScrollView>
      <Modal visible={showEndConfirmation} transparent animationType="fade" onRequestClose={() => { if (!endingSession) setShowEndConfirmation(false); }}>
        <View style={styles.modalBackdrop}>
          <View accessibilityRole="alert" style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.modalTitle, { color: c.foreground }]}>End Adventure Session?</Text>
            <Text style={[styles.modalBody, { color: c.mutedForeground }]}>
              This clears the active adventure indicator on this device. It does not delete saved adventures.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel ending adventure" disabled={endingSession}
                onPress={() => setShowEndConfirmation(false)}
                style={[styles.modalButton, { borderColor: c.border }]}>
                <Text style={{ color: c.foreground, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Confirm end adventure" disabled={endingSession}
                onPress={() => void confirmEndAdventureSession()}
                style={[styles.modalButton, { backgroundColor: c.destructive, borderColor: c.destructive }]}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>{endingSession ? "Ending..." : "End Session"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "#000000AA", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 460, borderWidth: 1, borderRadius: 14, padding: 22, gap: 14 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalBody: { fontSize: 14, lineHeight: 21 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" },
  modalButton: { borderWidth: 1, borderRadius: 9, paddingVertical: 11, paddingHorizontal: 18 },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  contextCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  contextBody: {
    fontSize: 12,
  },
  contextAction: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  contextActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
