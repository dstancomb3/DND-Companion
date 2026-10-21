import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform } from "react-native";
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

  const handleEndAdventureSession = React.useCallback(() => {
    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined"
        ? window.confirm("Clear active adventure session awareness on this device?")
        : false;
      if (confirmed) {
        void clearActiveSession();
      }
      return;
    }

    Alert.alert("End Adventure Session", "Clear active adventure session awareness on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Session",
        style: "destructive",
        onPress: () => {
          void clearActiveSession();
        },
      },
    ]);
  }, [clearActiveSession]);

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
