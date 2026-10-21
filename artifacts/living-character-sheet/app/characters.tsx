import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useParty } from "@/context/PartyContext";
import { getAllCharacters, deleteCharacter } from "@/utils/characterStorage";
import { buildPortableCharacterExport } from "@/utils/characterImportExport";
import type { SavedCharacter } from "@/utils/characterStorage";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";

export default function CharactersScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { loadCharacter, currentCharacterId, saveCurrentCharacter } = useCharacter();
  const { isInParty } = useParty();

  const [characters, setCharacters] = useState<SavedCharacter[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all = await getAllCharacters();
    setCharacters(all.sort((a, b) => b.savedAt - a.savedAt));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSelect = (saved: SavedCharacter) => {
    loadCharacter(saved.snapshot);
    router.replace("/(tabs)");
  };

  const handleDelete = async (id: string) => {
    await deleteCharacter(id);
    setConfirmDeleteId(null);
    await load();
  };

  const handleExport = async (char: SavedCharacter) => {
    setExportingId(char.id);
    try {
      // If this is the currently-loaded character, flush live state to storage
      // first so people, quests, locations and other recent changes are included.
      let snapshot = char.snapshot;
      if (char.id === currentCharacterId) {
        await saveCurrentCharacter();
        const fresh = await getAllCharacters();
        const updated = fresh.find((c) => c.id === char.id);
        if (updated) snapshot = updated.snapshot;
      }
      const json = JSON.stringify(buildPortableCharacterExport(snapshot), null, 2);
      const safeName = char.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const filename = `${safeName}_lcs.json`;

      if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Export",
          "Copy the filename, then share via another method. (Sharing is not available on this platform.)",
          [{ text: "OK" }]
        );
        return;
      }

      const path = (FileSystem.cacheDirectory ?? "") + filename;
      await FileSystem.writeAsStringAsync(path, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(path, {
        mimeType: "application/json",
        dialogTitle: `Export ${char.name}`,
        UTI: "public.json",
      });
    } catch (e) {
      Alert.alert("Export failed", String(e));
    } finally {
      setExportingId(null);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const topPad = Platform.OS === "web" ? 16 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: c.border }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>My Characters</Text>
        <TouchableOpacity
          onPress={() => router.push("/create-character")}
          style={[styles.addBtn, { backgroundColor: c.primary + "20" }]}
        >
          <Feather name="plus" size={20} color={c.primary} />
        </TouchableOpacity>
      </View>

      <ScrollHintScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
            colors={[c.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {characters.length === 0 ? (
          <EmptyState onCreateNew={() => router.push("/create-character")} />
        ) : (
          characters.map((char) => (
            <CharacterCard
              key={char.id}
              char={char}
              isActive={char.id === currentCharacterId}
              isInPartyCharacter={isInParty && char.id === currentCharacterId}
              isConfirmingDelete={confirmDeleteId === char.id}
              isExporting={exportingId === char.id}
              onPress={() => handleSelect(char)}
              onDeletePress={() =>
                setConfirmDeleteId(confirmDeleteId === char.id ? null : char.id)
              }
              onConfirmDelete={() => handleDelete(char.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onExportPress={() => handleExport(char)}
              formatDate={formatDate}
            />
          ))
        )}
      </ScrollHintScrollView>
    </View>
  );
}

function CharacterCard({
  char,
  isActive,
  isInPartyCharacter,
  isConfirmingDelete,
  isExporting,
  onPress,
  onDeletePress,
  onConfirmDelete,
  onCancelDelete,
  onExportPress,
  formatDate,
}: {
  char: SavedCharacter;
  isActive: boolean;
  isInPartyCharacter: boolean;
  isConfirmingDelete: boolean;
  isExporting: boolean;
  onPress: () => void;
  onDeletePress: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onExportPress: () => void;
  formatDate: (ts: number) => string;
}) {
  const c = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: isActive ? c.primary : c.border,
          borderRadius: c.radius * 1.5,
        },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.cardMain}>
        {/* Avatar */}
        <View
          style={[
            styles.avatar,
            { backgroundColor: c.primary + "20", borderRadius: c.radius },
          ]}
        >
          {char.snapshot.character.profileImageUri ? (
            <Image source={{ uri: char.snapshot.character.profileImageUri }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Feather name="user" size={20} color={c.primary} />
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={[styles.cardName, { color: c.foreground }]}>{char.name}</Text>
            {isActive && (
              <View style={[styles.activeBadge, { backgroundColor: c.primary + "25" }]}>
                <Text style={[styles.activeBadgeText, { color: c.primary }]}>Active</Text>
              </View>
            )}
            {isInPartyCharacter && (
              <View style={[styles.activeBadge, { backgroundColor: "#22C55E25" }]}>
                <Text style={[styles.activeBadgeText, { color: "#22C55E" }]}>In a Party</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
            {char.characterClass}{char.level ? ` · Level ${char.level}` : ""}
          </Text>
          <Text style={[styles.cardSub, { color: c.mutedForeground }]}>
            {char.race} · Saved {formatDate(char.savedAt)}
          </Text>
        </View>

        <Feather name="chevron-right" size={18} color={c.mutedForeground} />
      </TouchableOpacity>

      {/* Action buttons & delete confirm */}
      {!isConfirmingDelete ? (
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={onExportPress}
            disabled={isExporting}
            style={[styles.cardActionBtn, { borderColor: c.border }]}
            activeOpacity={0.7}
          >
            <Feather
              name={isExporting ? "loader" : "share-2"}
              size={14}
              color={c.mutedForeground}
            />
            <Text style={[styles.cardActionBtnText, { color: c.mutedForeground }]}>
              {isExporting ? "Exporting…" : "Export JSON"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDeletePress} style={styles.deleteIconBtn}>
            <Feather name="trash-2" size={16} color={c.mutedForeground} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.confirmRow, { borderTopColor: c.border }]}>
          <Text style={[styles.confirmText, { color: c.mutedForeground }]}>
            Delete {char.name}?
          </Text>
          <TouchableOpacity onPress={onCancelDelete} style={[styles.confirmBtn, { borderColor: c.border }]}>
            <Text style={[styles.confirmBtnText, { color: c.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirmDelete}
            style={[styles.confirmBtn, { backgroundColor: "#EF4444", borderColor: "#EF4444" }]}
          >
            <Text style={[styles.confirmBtnText, { color: "#FFFFFF" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.card, borderColor: c.border }]}>
        <Feather name="users" size={32} color={c.mutedForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: c.foreground }]}>No saved characters</Text>
      <Text style={[styles.emptySubtitle, { color: c.mutedForeground }]}>
        Create your first character to get started
      </Text>
      <TouchableOpacity
        onPress={onCreateNew}
        activeOpacity={0.8}
        style={[styles.emptyButton, { backgroundColor: c.primary, borderRadius: c.radius * 1.5 }]}
      >
        <Feather name="plus" size={16} color="#FFFFFF" />
        <Text style={styles.emptyButtonText}>Create Character</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700" },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  scrollContent: { padding: 16, gap: 12 },

  card: {
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 0,
    overflow: "hidden",
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  avatar: { width: 48, height: 48, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  cardInfo: { flex: 1, gap: 2 },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardName: { fontSize: 16, fontWeight: "700" },
  activeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  activeBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  cardMeta: { fontSize: 13, fontWeight: "600" },
  cardSub: { fontSize: 11 },

  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "transparent",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  cardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
  },
  cardActionBtnText: { fontSize: 12, fontWeight: "600" },
  deleteIconBtn: { marginLeft: "auto" as const, padding: 6 },

  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  confirmText: { flex: 1, fontSize: 13 },
  confirmBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  confirmBtnText: { fontSize: 13, fontWeight: "600" },

  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 20 },
  emptyButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  emptyButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
