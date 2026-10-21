import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import type { Note, JournalArc } from "@/types";
import { PeopleTab } from "@/components/notes/PeopleTab";
import { QuestsTab } from "@/components/notes/QuestsTab";
import { LocationsTab } from "@/components/notes/LocationsTab";
import { RealmsTab } from "@/components/notes/RealmsTab";
import { StatsTab } from "@/components/notes/StatsTab";
import { useSwipeActions } from "@/hooks/useSwipeActions";
import { createShadowStyle } from "../../utils/shadow";

// ── Tabs config ───────────────────────────────────────────────────────────────

type TabId = "notes" | "people" | "quests" | "locations" | "realms" | "stats";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "notes",     label: "Notes",     icon: "book-open" },
  { id: "people",    label: "People",    icon: "users" },
  { id: "quests",    label: "Quests",    icon: "flag" },
  { id: "locations", label: "Locations", icon: "map-pin" },
  { id: "realms",    label: "Planes",    icon: "globe" },
  { id: "stats",     label: "Stats",     icon: "bar-chart-2" },
];

// ── Date helper ───────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Note editor modal ─────────────────────────────────────────────────────────

interface NoteEditorModalProps {
  visible: boolean;
  note: Note | null;
  onClose: () => void;
  onSave: (title: string, body: string, meta: { sessionNumber?: number; tags?: string[] }) => void;
  onDelete?: () => void;
  onPin?: () => void;
  journalArcs: JournalArc[];
}

function NoteEditorModal({ visible, note, onClose, onSave, onDelete, onPin, journalArcs }: NoteEditorModalProps) {
  const c = useColors();
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [sessionNumber, setSessionNumber] = useState<string>(note?.sessionNumber?.toString() ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [metaOpen, setMetaOpen] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setTitle(note?.title ?? "");
      setBody(note?.body ?? "");
      setSessionNumber(note?.sessionNumber?.toString() ?? "");
      setTags(note?.tags ?? []);
      setMetaOpen(!note);
    }
  }, [visible, note]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handleSave = () => {
    onSave(title.trim(), body.trim(), {
      sessionNumber: sessionNumber ? parseInt(sessionNumber, 10) : undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.editorHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.editorHeaderBtn}>
            <Text style={[styles.editorHeaderBtnText, { color: c.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.editorHeaderTitle, { color: c.foreground }]}>
            {note ? "Edit Note" : "New Note"}
          </Text>
          <TouchableOpacity onPress={handleSave} activeOpacity={0.7} style={styles.editorHeaderBtn}>
            <Text style={[styles.editorHeaderBtnText, { color: c.primary, fontWeight: "700" }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollHintScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.editorTitleRow, { borderBottomColor: c.border }]}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={c.mutedForeground}
              style={[styles.editorTitleInput, { color: c.foreground }]}
              maxLength={100}
              returnKeyType="next"
            />
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write your note here..."
            placeholderTextColor={c.mutedForeground}
            style={[styles.editorBodyInput, { color: c.foreground }]}
            multiline
            textAlignVertical="top"
            autoFocus={!note}
          />
          {/* Journal metadata panel */}
          <TouchableOpacity
            onPress={() => setMetaOpen((v) => !v)}
            activeOpacity={0.8}
            style={[styles.metaToggleRow, { borderTopColor: c.border }]}
          >
            <Feather name={metaOpen ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
            <Text style={[styles.metaToggleText, { color: c.mutedForeground }]}>Journal metadata</Text>
            {(sessionNumber || tags.length > 0) && (
              <View style={[styles.metaBadge, { backgroundColor: c.primary + "22" }]}>
                <Text style={[styles.metaBadgeText, { color: c.primary }]}>
                  {[sessionNumber ? `S${sessionNumber}` : "", tags.length > 0 ? `${tags.length} tag${tags.length !== 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ")}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {metaOpen && (
            <View style={[styles.metaPanel, { borderTopColor: c.border, backgroundColor: c.card }]}>
              <Text style={[styles.metaLabel, { color: c.mutedForeground }]}>Session number</Text>
              <TextInput
                value={sessionNumber}
                onChangeText={setSessionNumber}
                placeholder="e.g. 5"
                placeholderTextColor={c.mutedForeground}
                style={[styles.metaInput, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]}
                keyboardType="number-pad"
                maxLength={4}
              />
              {journalArcs.length > 0 && (
                <>
                  <Text style={[styles.metaLabel, { color: c.mutedForeground, marginTop: 10 }]}>Arc</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {journalArcs.map((arc) => {
                        const arcSess = sessionNumber ? parseInt(sessionNumber, 10) : NaN;
                        const inArc =
                          !isNaN(arcSess) &&
                          arc.sessionStart !== undefined &&
                          arcSess >= arc.sessionStart &&
                          (arc.sessionEnd === undefined || arcSess <= arc.sessionEnd);
                        return (
                          <View key={arc.id} style={[styles.arcChip, { backgroundColor: inArc ? c.primary + "22" : c.border + "44", borderColor: inArc ? c.primary : c.border }]}>
                            <Text style={[styles.arcChipText, { color: inArc ? c.primary : c.mutedForeground }]}>{arc.name}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </>
              )}
              <Text style={[styles.metaLabel, { color: c.mutedForeground, marginTop: 10 }]}>Tags</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={addTag}
                  placeholder="Add tag…"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.metaInput, { flex: 1, color: c.foreground, borderColor: c.border, backgroundColor: c.background }]}
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={addTag} activeOpacity={0.8}
                  style={[styles.metaAddBtn, { backgroundColor: c.primary }]}>
                  <Feather name="plus" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
              {tags.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {tags.map((t) => (
                    <TouchableOpacity key={t} onPress={() => removeTag(t)} activeOpacity={0.8}
                      style={[styles.tagChip, { backgroundColor: c.primary + "18", borderColor: c.primary + "44" }]}>
                      <Text style={[styles.tagChipText, { color: c.primary }]}>{t}</Text>
                      <Feather name="x" size={11} color={c.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {note && (
            <View style={styles.editorActions}>
              {onPin && (
                <TouchableOpacity onPress={() => { onClose(); onPin(); }} activeOpacity={0.8}
                  style={[styles.editorActionBtn, { borderColor: c.primary + "50", backgroundColor: c.primary + "10" }]}>
                  <MaterialCommunityIcons name={note.pinned ? "pin" : "pin-outline"} size={16} color={c.primary} />
                  <Text style={[styles.editorActionBtnText, { color: c.primary }]}>{note.pinned ? "Unpin" : "Pin"}</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity onPress={() => { onClose(); onDelete(); }} activeOpacity={0.8}
                  style={[styles.editorActionBtn, { borderColor: "#EF444450", backgroundColor: "#EF444410" }]}>
                  <Feather name="trash-2" size={15} color="#EF4444" />
                  <Text style={[styles.editorActionBtnText, { color: "#EF4444" }]}>Delete Note</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollHintScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Swipeable note card ───────────────────────────────────────────────────────

interface SwipeableNoteCardProps {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  colors: ReturnType<typeof useColors>;
}

function SwipeableNoteCard({ note, onEdit, onDelete, onPin, colors: c }: SwipeableNoteCardProps) {
  const { settings } = useAppSettings();
  const ACTION_WIDTH = 80;
  const { animatedStyle, panHandlers, revealed, close: closeSwipe } = useSwipeActions({
    actionWidth: ACTION_WIDTH,
    actionCount: 2,
    motionIntensity: settings.motionIntensity,
  });

  return (
    <View style={[styles.swipeContainer, { backgroundColor: c.background }]}>
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: c.primary + "22", width: ACTION_WIDTH }]}
          onPress={() => { closeSwipe(); onPin(); }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name={note.pinned ? "pin" : "pin-outline"} size={20} color={note.pinned ? c.primary : c.mutedForeground} />
          <Text style={[styles.actionBtnText, { color: note.pinned ? c.primary : c.mutedForeground }]}>
            {note.pinned ? "Unpin" : "Pin"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#ef444422", width: ACTION_WIDTH }]}
          onPress={() => { closeSwipe(); onDelete(); }}
          activeOpacity={0.8}
        >
          <Feather name="trash-2" size={18} color="#ef4444" />
          <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={animatedStyle} {...panHandlers}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { if (revealed) { closeSwipe(); } else { onEdit(); } }}
          onLongPress={() => {
            Alert.alert(
              note.title || "Untitled",
              "What would you like to do?",
              [
                { text: note.pinned ? "Unpin" : "Pin", onPress: onPin },
                { text: "Edit", onPress: onEdit },
                { text: "Delete", style: "destructive", onPress: onDelete },
                { text: "Cancel", style: "cancel" },
              ]
            );
          }}
          style={[styles.noteCard, { backgroundColor: c.card, borderColor: note.pinned ? c.primary + "55" : c.border }]}
        >
          {note.pinned && (
            <View style={[styles.notePinnedBanner, { backgroundColor: c.primary + "15" }]}>
              <MaterialCommunityIcons name="pin" size={11} color={c.primary} />
              <Text style={[styles.notePinnedText, { color: c.primary }]}>PINNED</Text>
            </View>
          )}
          <View style={styles.noteCardHeader}>
            <Text style={[styles.noteTitle, { color: c.foreground, flex: 1 }]} numberOfLines={1}>
              {note.title || "Untitled"}
            </Text>
          </View>
          <Text style={[styles.noteDate, { color: c.mutedForeground, marginBottom: 2 }]}>{formatDate(note.createdAt)}</Text>
          {!!note.body && (
            <Text style={[styles.noteBody, { color: c.mutedForeground }]} numberOfLines={2}>
              {note.body}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Journal view: grouped by session ────────────────────────────────────────

type NoteViewMode = "list" | "journal";

interface JournalGroupProps {
  sessionNumber: number | null;
  arcName: string | null;
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onPin: (note: Note) => void;
  colors: ReturnType<typeof useColors>;
}

function JournalGroup({ sessionNumber, arcName, notes, onEdit, onDelete, onPin, colors: c }: JournalGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const header = sessionNumber !== null ? `Session ${sessionNumber}` : "General";
  return (
    <View style={{ marginBottom: 16 }}>
      <TouchableOpacity onPress={() => setCollapsed((v) => !v)} activeOpacity={0.8}
        style={[styles.journalGroupHeader, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.journalGroupTitle, { color: c.foreground }]}>{header}</Text>
          {arcName && <Text style={[styles.journalGroupArc, { color: c.primary }]}>{arcName}</Text>}
        </View>
        <Text style={[styles.journalGroupCount, { color: c.mutedForeground }]}>{notes.length}</Text>
        <Feather name={collapsed ? "chevron-down" : "chevron-up"} size={14} color={c.mutedForeground} style={{ marginLeft: 6 }} />
      </TouchableOpacity>
      {!collapsed && notes.map((n) => (
        <SwipeableNoteCard key={n.id} note={n} onEdit={() => onEdit(n)} onDelete={() => onDelete(n.id)} onPin={() => onPin(n)} colors={c} />
      ))}
    </View>
  );
}

// ── Notes tab content ─────────────────────────────────────────────────────────

function NotesTab() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { notes, addNote, updateNote, deleteNote, pinNote, journalArcs } = useCharacter();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<NoteViewMode>("list");
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const filteredNotes = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.body.toLowerCase().includes(q) ||
            n.tags?.some((t) => t.toLowerCase().includes(q))
        )
      : notes;
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes, search]);

  // Journal view: group by sessionNumber
  const journalGroups = useMemo(() => {
    if (viewMode !== "journal") return [];
    const bySession = new Map<number | null, Note[]>();
    for (const n of filteredNotes) {
      const key = n.sessionNumber ?? null;
      if (!bySession.has(key)) bySession.set(key, []);
      bySession.get(key)!.push(n);
    }
    // Sort: numbered sessions descending, null at end
    const entries = [...bySession.entries()].sort(([a], [b]) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return b - a;
    });
    return entries.map(([sessionNum, sessionNotes]) => {
      let arcName: string | null = null;
      if (sessionNum !== null) {
        const arc = journalArcs.find(
          (a) =>
            a.sessionStart !== undefined &&
            sessionNum >= a.sessionStart &&
            (a.sessionEnd === undefined || sessionNum <= a.sessionEnd)
        );
        arcName = arc?.name ?? null;
      }
      return { sessionNum, arcName, sessionNotes };
    });
  }, [filteredNotes, journalArcs, viewMode]);

  const openNew = () => {
    setEditingNote(null);
    setEditorVisible(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setEditorVisible(true);
  };

  const handleSave = (title: string, body: string, meta: { sessionNumber?: number; tags?: string[] }) => {
    if (editingNote) {
      updateNote(editingNote.id, { title, body, ...meta });
    } else {
      addNote({ title, body, pinned: false, ...meta });
    }
    setEditorVisible(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteNote(id) },
    ]);
  };

  const handlePin = (note: Note) => {
    pinNote(note.id, !note.pinned);
  };

  const fabBottom = Platform.OS === "web" ? 8 : tabBarHeight + 8;
  const listBottomPadding = fabBottom + 74;

  return (
    <View style={{ flex: 1 }}>
      {/* View mode toggle */}
      <View style={[styles.viewModeRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {(["list", "journal"] as NoteViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            onPress={() => setViewMode(mode)}
            activeOpacity={0.8}
            style={[styles.viewModeBtn, viewMode === mode && { backgroundColor: c.primary + "18", borderColor: c.primary }]}
          >
            <Feather
              name={mode === "list" ? "list" : "book"}
              size={13}
              color={viewMode === mode ? c.primary : c.mutedForeground}
            />
            <Text style={[styles.viewModeBtnText, { color: viewMode === mode ? c.primary : c.mutedForeground }]}>
              {mode === "list" ? "List" : "Journal"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.searchRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <Feather name="search" size={16} color={c.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search notes..."
          placeholderTextColor={c.mutedForeground}
          style={[styles.searchInput, { color: c.foreground }]}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {search.length > 0 && Platform.OS !== "ios" && (
          <TouchableOpacity onPress={() => setSearch("")} activeOpacity={0.7}>
            <Feather name="x" size={16} color={c.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {filteredNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="book-open" size={48} color={c.mutedForeground + "66"} />
          <Text style={[styles.emptyTitle, { color: c.mutedForeground }]}>
            {search ? "No notes match your search" : "No notes yet"}
          </Text>
          {!search && (
            <Text style={[styles.emptySubtitle, { color: c.mutedForeground + "99" }]}>
              Tap the + button to add your first note
            </Text>
          )}
        </View>
      ) : viewMode === "journal" ? (
        <ScrollView contentContainerStyle={[styles.listContent, { paddingTop: 12, paddingBottom: listBottomPadding }]}> 
          {journalGroups.map(({ sessionNum, arcName, sessionNotes }) => (
            <JournalGroup
              key={sessionNum?.toString() ?? "general"}
              sessionNumber={sessionNum}
              arcName={arcName}
              notes={sessionNotes}
              onEdit={openEdit}
              onDelete={(id) => handleDelete(id)}
              onPin={handlePin}
              colors={c}
            />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginBottom: 6 }}>
              <Feather name="chevrons-left" size={12} color={c.mutedForeground + "88"} />
              <Text style={{ fontSize: 11, color: c.mutedForeground + "88", fontStyle: "italic" }}>long press to pin • swipe to delete</Text>
            </View>
          }
          renderItem={({ item }) => (
            <SwipeableNoteCard
              note={item}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              onPin={() => handlePin(item)}
              colors={c}
            />
          )}
        />
      )}


      <TouchableOpacity
        style={[styles.fab, { backgroundColor: c.primary, bottom: fabBottom }]}
        onPress={openNew}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <NoteEditorModal
        visible={editorVisible}
        note={editingNote}
        onClose={() => setEditorVisible(false)}
        onSave={handleSave}
        onDelete={editingNote ? () => handleDelete(editingNote.id) : undefined}
        onPin={editingNote ? () => handlePin(editingNote) : undefined}
        journalArcs={journalArcs}
      />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function NotesScreen() {
  const c = useColors();
  const [activeTab, setActiveTab] = useState<TabId>("notes");

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
              style={[styles.tabBtn, active && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}
            >
              <Feather
                name={tab.icon as any}
                size={15}
                color={active ? c.primary : c.mutedForeground}
              />
              <Text style={[styles.tabLabel, { color: active ? c.primary : c.mutedForeground }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === "notes"     && <NotesTab />}
      {activeTab === "people"    && <PeopleTab />}
      {activeTab === "quests"    && <QuestsTab />}
      {activeTab === "locations" && <LocationsTab />}
      {activeTab === "realms"    && <RealmsTab />}
      {activeTab === "stats"     && <StatsTab />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingTop: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 11,
    gap: 3,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 12, fontWeight: "700" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  listContent: { paddingHorizontal: 12, paddingBottom: 72, paddingTop: 4 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, paddingBottom: 80 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  emptySubtitle: { fontSize: 13 },

  swipeContainer: { borderRadius: 12, overflow: "hidden" },
  actionsContainer: { position: "absolute", right: 0, top: 0, bottom: 0, flexDirection: "row" },
  actionBtn: { justifyContent: "center", alignItems: "center", gap: 4 },
  actionBtnText: { fontSize: 11, fontWeight: "600" },
  noteCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
  notePinnedBanner: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8, alignSelf: "flex-start" },
  notePinnedText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  noteCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  noteCardTitleRow: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 },
  noteTitle: { fontSize: 15, fontWeight: "700" },
  noteDate: { fontSize: 11 },
  noteBody: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  pinBtn: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", marginLeft: 8 },

  fab: {
    position: "absolute", bottom: 90, right: 20,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: "center", alignItems: "center",
    ...createShadowStyle({ y: 4, blur: 8, opacity: 0.3, elevation: 8 }),
  },

  editorHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  editorHeaderTitle: { fontSize: 16, fontWeight: "700" },
  editorHeaderBtn: { minWidth: 60, alignItems: "center" },
  editorHeaderBtnText: { fontSize: 15 },
  editorTitleRow: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  editorTitleInput: { fontSize: 20, fontWeight: "700" },
  editorBodyInput: { flex: 1, fontSize: 15, lineHeight: 22, padding: 16, minHeight: 300 },
  editorActions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
  editorActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderWidth: 1, borderRadius: 10 },
  editorActionBtnText: { fontSize: 14, fontWeight: "600" },

  // Journal metadata panel
  metaToggleRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  metaToggleText: { fontSize: 13, flex: 1 },
  metaBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  metaBadgeText: { fontSize: 11, fontWeight: "600" },
  metaPanel: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  metaLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  metaInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  metaAddBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  arcChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  arcChipText: { fontSize: 12, fontWeight: "600" },
  tagChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  tagChipText: { fontSize: 12, fontWeight: "500" },

  // Journal view
  viewModeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  viewModeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "transparent" },
  viewModeBtnText: { fontSize: 13, fontWeight: "600" },
  journalGroupHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  journalGroupTitle: { fontSize: 14, fontWeight: "700" },
  journalGroupArc: { fontSize: 11, marginTop: 1 },
  journalGroupCount: { fontSize: 12 },
});
