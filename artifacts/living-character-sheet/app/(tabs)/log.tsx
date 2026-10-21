import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import type { CombatLogEntry, MutationBatch, SessionLog } from "@/types";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { useMutationHistory } from "@/context/MutationHistoryContext";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function entryIcon(type: CombatLogEntry["type"]): { name: string; color: string } {
  switch (type) {
    case "hp_damage": return { name: "heart", color: "#ef4444" };
    case "hp_heal": return { name: "plus-circle", color: "#22c55e" };
    case "resource_spend": return { name: "minus-circle", color: "#f59e0b" };
    case "resource_restore": return { name: "refresh-cw", color: "#3b82f6" };
    case "condition_add": return { name: "alert-circle", color: "#a855f7" };
    case "condition_remove": return { name: "check-circle", color: "#6b7280" };
    case "session_start": return { name: "flag", color: "#14b8a6" };
    case "long_rest": return { name: "moon", color: "#6366f1" };
    default: return { name: "circle", color: "#6b7280" };
  }
}

interface NoteModalProps {
  visible: boolean;
  entry: CombatLogEntry | null;
  onClose: () => void;
  onSave: (note: string) => void;
}

function NoteModal({ visible, entry, onClose, onSave }: NoteModalProps) {
  const c = useColors();
  const [text, setText] = useState(entry?.userNote ?? "");

  React.useEffect(() => {
    if (visible) setText(entry?.userNote ?? "");
  }, [visible, entry]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[s.modalHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={{ color: c.mutedForeground, fontSize: c.scaleFont(15) }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[s.modalTitle, { color: c.foreground, fontSize: c.scaleFont(16) }]}>Add Note</Text>
          <TouchableOpacity onPress={() => { onSave(text.trim()); onClose(); }} activeOpacity={0.7}>
            <Text style={{ color: c.primary, fontSize: c.scaleFont(15), fontWeight: "700" }}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollHintScrollView style={{ flex: 1, padding: c.densitySpace(16) }}>
          {entry && (
            <View style={[s.noteEntryPreview, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[s.noteEntryDesc, { color: c.foreground, fontSize: c.scaleFont(14), lineHeight: c.scaleLineHeight(19) }]}>{entry.description}</Text>
              <Text style={[s.noteEntryTime, { color: c.mutedForeground, fontSize: c.scaleFont(11) }]}>{formatTime(entry.timestamp)}</Text>
            </View>
          )}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add a note to this entry…"
            placeholderTextColor={c.mutedForeground}
            multiline
            style={[s.noteInput, { color: c.foreground, borderColor: c.border, backgroundColor: c.card, fontSize: c.scaleFont(14), lineHeight: c.scaleLineHeight(20), padding: c.densitySpace(12) }]}
            autoFocus
          />
        </ScrollHintScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface NewSessionModalProps {
  visible: boolean;
  sessionNumber: number;
  onClose: () => void;
  onStart: (label: string) => void;
}

function NewSessionModal({ visible, sessionNumber, onClose, onStart }: NewSessionModalProps) {
  const c = useColors();
  const [label, setLabel] = useState(`Session ${sessionNumber}`);

  React.useEffect(() => {
    if (visible) setLabel(`Session ${sessionNumber}`);
  }, [visible, sessionNumber]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[s.modalHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={{ color: c.mutedForeground, fontSize: c.scaleFont(15) }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[s.modalTitle, { color: c.foreground, fontSize: c.scaleFont(16) }]}>New Session</Text>
          <TouchableOpacity onPress={() => { onStart(label.trim()); onClose(); }} activeOpacity={0.7}>
            <Text style={{ color: c.primary, fontSize: c.scaleFont(15), fontWeight: "700" }}>Start</Text>
          </TouchableOpacity>
        </View>

        <View style={{ padding: c.densitySpace(20) }}>
          <Text style={[s.fieldLabel, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}>Session Name</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={`Session ${sessionNumber}`}
            placeholderTextColor={c.mutedForeground}
            style={[s.fieldInput, { color: c.foreground, borderColor: c.border, backgroundColor: c.card, fontSize: c.scaleFont(15), paddingHorizontal: c.densitySpace(14), paddingVertical: c.densitySpace(12) }]}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => { onStart(label.trim()); onClose(); }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface EntryRowProps {
  entry: CombatLogEntry;
  onPress: (entry: CombatLogEntry) => void;
}

function EntryRow({ entry, onPress }: EntryRowProps) {
  const c = useColors();
  const icon = entryIcon(entry.type);
  const isSessionMarker = entry.type === "session_start" || entry.type === "long_rest";

  if (isSessionMarker) {
    return (
      <View style={[s.sessionMarkerRow, { borderColor: c.border }]}>
        <View style={[s.sessionMarkerLine, { backgroundColor: c.border }]} />
        <View style={[s.sessionMarkerBadge, { backgroundColor: c.card, borderColor: c.border }]}>
          <Feather name={icon.name as any} size={12} color={icon.color} style={{ marginRight: 4 }} />
          <Text style={[s.sessionMarkerText, { color: c.mutedForeground }]}>
            {entry.description}
          </Text>
          <Text style={[s.sessionMarkerTime, { color: c.mutedForeground }]}>
            {" · "}{formatTime(entry.timestamp)}
          </Text>
        </View>
        <View style={[s.sessionMarkerLine, { backgroundColor: c.border }]} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(entry)}
      style={[s.entryRow, { backgroundColor: c.card, borderColor: c.border }]}
    >
      <View style={[s.entryIconWrap, { backgroundColor: icon.color + "18" }]}>
        <Feather name={icon.name as any} size={14} color={icon.color} />
      </View>
      <View style={s.entryContent}>
        <Text style={[s.entryDesc, { color: c.foreground, fontSize: c.scaleFont(14), lineHeight: c.scaleLineHeight(19) }]}>{entry.description}</Text>
        {entry.userNote ? (
          <Text style={[s.entryNote, { color: c.mutedForeground, fontSize: c.scaleFont(12), lineHeight: c.scaleLineHeight(17) }]} numberOfLines={2}>
            "{entry.userNote}"
          </Text>
        ) : null}
        <View style={s.entryMeta}>
          <Text style={[s.entryTime, { color: c.mutedForeground, fontSize: c.scaleFont(11) }]}>{formatTime(entry.timestamp)}</Text>
          <View style={[s.sourceTag, { backgroundColor: entry.source === "ai" ? c.primary + "22" : c.border + "88" }]}>
            <Text style={[s.sourceTagText, { color: entry.source === "ai" ? c.primary : c.mutedForeground }]}>
              {entry.source === "ai" ? "AI" : "manual"}
            </Text>
          </View>
        </View>
      </View>
      <Feather name="edit-2" size={12} color={c.mutedForeground} style={{ marginLeft: 6, opacity: 0.5 }} />
    </TouchableOpacity>
  );
}

export default function LogTab() {
  const c = useColors();
  const { combatLogEntries, combatLogSessions, addLogNote, clearCombatLog, startNewSession } = useCharacter();

  const { history, undoBatch } = useMutationHistory();
  const [recentExpanded, setRecentExpanded] = useState(true);

  const recentBatches = useMemo(
    () => history.filter((b) => b.applied && !b.undone && b.deltas.length > 0).slice().reverse().slice(0, 5),
    [history]
  );

  const [noteModal, setNoteModal] = useState<{ visible: boolean; entry: CombatLogEntry | null }>({
    visible: false,
    entry: null,
  });
  const [sessionModal, setSessionModal] = useState(false);

  const sections = useMemo(() => {
    const sessionMap = new Map<string, { session: SessionLog; entries: CombatLogEntry[] }>();

    for (const session of combatLogSessions) {
      sessionMap.set(session.id, { session, entries: [] });
    }

    for (const entry of combatLogEntries) {
      const bucket = sessionMap.get(entry.sessionId);
      if (bucket) {
        bucket.entries.push(entry);
      } else {
        const fallback = sessionMap.get("default");
        if (fallback) fallback.entries.push(entry);
      }
    }

    return Array.from(sessionMap.values())
      .filter((b) => b.entries.length > 0)
      .reverse()
      .map((b) => ({
        title: b.session.label ?? `Session`,
        date: formatDate(b.session.startedAt),
        data: [...b.entries].reverse(),
      }));
  }, [combatLogEntries, combatLogSessions]);

  const handleClearLog = () => {
    Alert.alert(
      "Clear Log",
      "This will clear all log entries and start a fresh session. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => clearCombatLog() },
      ]
    );
  };

  const totalEntries = combatLogEntries.filter((e) => e.type !== "session_start").length;

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      {sections.length === 0 ? (
        <View style={s.emptyState}>
          <Feather name="clock" size={48} color={c.mutedForeground} style={{ opacity: 0.4 }} />
          <Text style={[s.emptyTitle, { color: c.foreground, fontSize: c.scaleFont(18) }]}>No Events Yet</Text>
          <Text style={[s.emptyBody, { color: c.mutedForeground, fontSize: c.scaleFont(14), lineHeight: c.scaleLineHeight(20) }]}> 
            HP changes, resource spending, and condition changes will appear here automatically.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.listContent, { paddingHorizontal: c.densitySpace(16), paddingTop: c.densitySpace(8) }]}
          renderSectionHeader={({ section }) => (
            <View style={[s.sectionHeader, { backgroundColor: c.background }]}>
              <Text style={[s.sectionTitle, { color: c.foreground, fontSize: c.scaleFont(15) }]}>{section.title}</Text>
              <Text style={[s.sectionDate, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}>{section.date}</Text>
            </View>
          )}
          ListHeaderComponent={
            recentBatches.length > 0 ? (
              <View style={[s.recentChanges, { borderColor: c.border }]}>
                <TouchableOpacity
                  onPress={() => setRecentExpanded((v) => !v)}
                  activeOpacity={0.7}
                  style={s.recentHeader}
                >
                  <Feather name="clock" size={13} color={c.primary} />
                  <Text style={[s.recentTitle, { color: c.foreground, fontSize: c.scaleFont(13) }]}>Recent Changes</Text>
                  <Feather name={recentExpanded ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
                </TouchableOpacity>
                {recentExpanded && recentBatches.map((batch) => (
                  <View key={batch.id} style={[s.recentRow, { borderTopColor: c.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.recentDesc, { color: c.foreground, fontSize: c.scaleFont(13) }]} numberOfLines={1}>
                        {batch.description}
                      </Text>
                      <Text style={[s.recentTime, { color: c.mutedForeground, fontSize: c.scaleFont(11) }]}> 
                        {new Date(batch.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        {" · "}{batch.deltas.length} change{batch.deltas.length !== 1 ? "s" : ""}
                        {batch.source === "ai" ? " · AI" : " · manual"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => undoBatch(batch.id)}
                      activeOpacity={0.7}
                      style={[s.undoBtn, { borderColor: c.border }]}
                    >
                      <Text style={[s.undoBtnText, { color: c.primary, fontSize: c.scaleFont(12) }]}>Undo</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <EntryRow
              entry={item}
              onPress={(e) => setNoteModal({ visible: true, entry: e })}
            />
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      <View style={[s.toolbar, { backgroundColor: c.card, borderTopColor: c.border }]}>
        <Text style={[s.toolbarCount, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}> 
          {totalEntries} event{totalEntries !== 1 ? "s" : ""}
        </Text>
        <View style={s.toolbarActions}>
          <TouchableOpacity
            onPress={() => setSessionModal(true)}
            activeOpacity={0.7}
            style={[s.toolbarBtn, { borderColor: c.border }]}
          >
            <Feather name="flag" size={14} color={c.primary} style={{ marginRight: 5 }} />
            <Text style={[s.toolbarBtnText, { color: c.primary, fontSize: c.scaleFont(12) }]}>New Session</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClearLog}
            activeOpacity={0.7}
            style={[s.toolbarBtn, { borderColor: c.border, marginLeft: 8 }]}
          >
            <Feather name="trash-2" size={14} color={c.mutedForeground} style={{ marginRight: 5 }} />
            <Text style={[s.toolbarBtnText, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}>Clear Log</Text>
          </TouchableOpacity>
        </View>
      </View>

      <NoteModal
        visible={noteModal.visible}
        entry={noteModal.entry}
        onClose={() => setNoteModal({ visible: false, entry: null })}
        onSave={(note) => {
          if (noteModal.entry) addLogNote(noteModal.entry.id, note);
        }}
      />

      <NewSessionModal
        visible={sessionModal}
        sessionNumber={combatLogSessions.length + 1}
        onClose={() => setSessionModal(false)}
        onStart={(label) => startNewSession(label)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  recentChanges: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  recentTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  recentDesc: {
    fontSize: 13,
    fontWeight: "600",
  },
  recentTime: {
    fontSize: 11,
    marginTop: 2,
  },
  undoBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  undoBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  emptyBody: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionDate: {
    fontSize: 12,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  entryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  entryContent: {
    flex: 1,
    gap: 3,
  },
  entryDesc: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 19,
  },
  entryNote: {
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 17,
  },
  entryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  entryTime: {
    fontSize: 11,
  },
  sourceTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: "600",
  },
  sessionMarkerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  sessionMarkerLine: {
    flex: 1,
    height: 1,
  },
  sessionMarkerBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 8,
  },
  sessionMarkerText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sessionMarkerTime: {
    fontSize: 11,
  },
  toolbar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  toolbarCount: {
    fontSize: 13,
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  toolbarBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  noteEntryPreview: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  noteEntryDesc: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  noteEntryTime: {
    fontSize: 12,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    fontSize: 15,
    textAlignVertical: "top",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
});
