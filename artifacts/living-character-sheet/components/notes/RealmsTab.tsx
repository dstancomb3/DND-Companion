import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform,
  Animated, Easing, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useFilterPanelMotion } from "@/hooks/useFilterPanelMotion";
import { useSwipeActions } from "@/hooks/useSwipeActions";
import type { Plane } from "@/types";
import { createShadowStyle } from "../../utils/shadow";

interface RealmModalProps {
  visible: boolean;
  realm: Plane | null;
  quests: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: Omit<Plane, "id" | "createdAt">) => void;
  onDelete?: () => void;
  onPin?: () => void;
}

function RealmModal({ visible, realm, quests, locations, onClose, onSave, onDelete, onPin }: RealmModalProps) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [questTags, setQuestTags] = useState<string[]>([]);

  React.useEffect(() => {
    if (visible) {
      setName(realm?.name ?? "");
      setDescription(realm?.description ?? "");
      setNotes(realm?.notes ?? "");
      setQuestTags(realm?.questTags ?? []);
    }
  }, [visible, realm]);

  function toggleQuest(qid: string) {
    setQuestTags(prev => prev.includes(qid) ? prev.filter(x => x !== qid) : [...prev, qid]);
  }

  function handleSave() {
    if (!name.trim()) return Alert.alert("Name required", "Please enter a plane name.");
    onSave({ name: name.trim(), description: description.trim() || undefined,
             notes: notes.trim() || undefined, questTags, locationTags: realm?.locationTags ?? [], pinned: realm?.pinned ?? false });
  }

  function handleDelete() {
    Alert.alert("Remove Plane", `Remove "${realm?.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { onClose(); onDelete?.(); } },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[s.modalHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose} style={s.modalHeaderBtn}>
            <Text style={[s.modalHeaderBtnText, { color: c.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[s.modalHeaderTitle, { color: c.foreground }]}>{realm ? "Edit Plane" : "New Plane"}</Text>
          <TouchableOpacity onPress={handleSave} style={s.modalHeaderBtn}>
            <Text style={[s.modalHeaderBtnText, { color: c.primary, fontWeight: "700" }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>PLANE NAME *</Text>
          <TextInput style={[s.input, { backgroundColor: c.card, borderColor: name.trim() ? c.primary : c.border, color: c.foreground }]}
            placeholder="Plane, kingdom, dimension..." placeholderTextColor={c.mutedForeground} value={name} onChangeText={setName} />

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>DESCRIPTION</Text>
          <TextInput style={[s.input, s.inputMulti, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="What is this plane? Who rules it? What is it known for?" placeholderTextColor={c.mutedForeground}
            value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />

          {quests.length > 0 && (
            <>
              <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>RELATED QUESTS</Text>
              <View style={s.chipRow}>
                {quests.map(q => {
                  const sel = questTags.includes(q.id);
                  return (
                    <TouchableOpacity key={q.id} onPress={() => toggleQuest(q.id)} activeOpacity={0.8}
                      style={[s.chip, { borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primary + "20" : c.card }]}>
                      <Feather name="flag" size={11} color={sel ? c.primary : c.mutedForeground} />
                      <Text style={[s.chipText, { color: sel ? c.primary : c.mutedForeground }]}>{q.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {(realm?.locationTags?.length ?? 0) > 0 && (
            <>
              <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>LOCATIONS IN THIS PLANE</Text>
              <View style={s.chipRow}>
                {(realm?.locationTags ?? []).map(lid => {
                  const loc = locations.find(l => l.id === lid);
                  if (!loc) return null;
                  return (
                    <View key={lid} style={[s.chip, { borderColor: c.primary + "50", backgroundColor: c.primary + "12" }]}>
                      <Feather name="map-pin" size={11} color={c.primary} />
                      <Text style={[s.chipText, { color: c.primary }]}>{loc.name}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>NOTES</Text>
          <TextInput style={[s.input, s.inputMulti, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="Factions, history, dangers, secrets..." placeholderTextColor={c.mutedForeground}
            value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" />

          {realm && (onDelete || onPin) && (
            <View style={s.modalActions}>
              {onPin && (
                <TouchableOpacity onPress={() => { onClose(); onPin(); }} activeOpacity={0.8}
                  style={[s.modalActionBtn, { borderColor: c.primary + "50", backgroundColor: c.primary + "10" }]}>
                  <MaterialCommunityIcons name={realm.pinned ? "pin" : "pin-outline"} size={16} color={c.primary} />
                  <Text style={[s.modalActionBtnText, { color: c.primary }]}>{realm.pinned ? "Unpin" : "Pin"}</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity onPress={handleDelete} activeOpacity={0.8}
                  style={[s.modalActionBtn, { borderColor: "#EF444450", backgroundColor: "#EF444410" }]}>
                  <Feather name="trash-2" size={15} color="#EF4444" />
                  <Text style={[s.modalActionBtnText, { color: "#EF4444" }]}>Remove Plane</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SwipeableRealmCard({ realm, locations, onEdit, onPin, onDelete }: {
  realm: Plane;
  locations: { id: string; name: string }[];
  onEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { settings } = useAppSettings();
  const ACTION_WIDTH = 80;
  const { animatedStyle, panHandlers, revealed, close } = useSwipeActions({
    actionWidth: ACTION_WIDTH,
    motionIntensity: settings.motionIntensity,
  });

  return (
    <View style={{ borderRadius: c.radiusXl, overflow: "hidden" }}>
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
        <TouchableOpacity style={[rsw.action, { backgroundColor: "#ef444422", width: ACTION_WIDTH }]}
          onPress={() => { close(); onDelete(); }} activeOpacity={0.8}>
          <Feather name="trash-2" size={18} color="#ef4444" />
          <Text style={[rsw.actionText, { color: "#ef4444" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={animatedStyle} {...panHandlers}>
        <TouchableOpacity activeOpacity={0.85}
          onPress={() => { if (revealed) { close(); } else { onEdit(); } }}
          onLongPress={onPin}
          style={[s.card, { backgroundColor: c.card, borderColor: realm.pinned ? c.primary + "60" : c.border }]}>
          {realm.pinned && (
            <View style={[s.pinnedBanner, { backgroundColor: c.primary + "15" }]}>
              <MaterialCommunityIcons name="pin" size={11} color={c.primary} />
              <Text style={[s.pinnedText, { color: c.primary }]}>PINNED</Text>
            </View>
          )}
          <View style={s.cardNameRow}>
            <MaterialCommunityIcons name="earth" size={14} color={c.primary} />
            <Text style={[s.cardName, { color: c.foreground }]}>{realm.name}</Text>
          </View>
          {realm.description ? (
            <Text style={[s.cardDesc, { color: c.mutedForeground }]} numberOfLines={2}>
              {realm.description}
            </Text>
          ) : null}
          {(realm.locationTags?.length ?? 0) > 0 && (
            <View style={s.chipRow}>
              {(realm.locationTags ?? []).slice(0, 3).map(lid => {
                const loc = locations.find(l => l.id === lid);
                if (!loc) return null;
                return (
                  <View key={lid} style={[s.chip, { borderColor: c.primary + "50", backgroundColor: c.primary + "12" }]}>
                    <Feather name="map-pin" size={10} color={c.primary} />
                    <Text style={[s.chipText, { color: c.primary }]}>{loc.name}</Text>
                  </View>
                );
              })}
              {(realm.locationTags ?? []).length > 3 && (
                <Text style={[s.chipText, { color: c.mutedForeground }]}>+{realm.locationTags.length - 3} more</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const rsw = StyleSheet.create({
  action: { alignItems: "center", justifyContent: "center", gap: 4, height: "100%" },
  actionText: { fontSize: 11, fontWeight: "600" },
});

export function RealmsTab() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { settings } = useAppSettings();
  const { realms, quests, locations, addRealm, updateRealm, deleteRealm, pinRealm } = useCharacter();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [withLocationsOnly, setWithLocationsOnly] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Plane | null>(null);
  const { filterPanelAnimatedStyle } = useFilterPanelMotion(showFilters, settings);

  const filtered = useMemo(() => {
    let list = realms;
    if (pinnedOnly) list = list.filter((r) => r.pinned);
    if (withLocationsOnly) list = list.filter((r) => (r.locationTags?.length ?? 0) > 0);
    const q = search.toLowerCase().trim();
    const matched = q
      ? list.filter(r => r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q))
      : list;
    return [...matched].sort((a, b) => {
      if ((a.pinned ? 0 : 1) !== (b.pinned ? 0 : 1)) return (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1);
      return b.createdAt - a.createdAt;
    });
  }, [pinnedOnly, realms, search, withLocationsOnly]);

  const fabBottom = Platform.OS === "web" ? 8 : tabBarHeight + 8;
  const listBottomPadding = fabBottom + 74;

  function openNew() { setEditing(null); setModalVisible(true); }
  function openEdit(r: Plane) { setEditing(r); setModalVisible(true); }

  function handleSave(data: Omit<Plane, "id" | "createdAt">) {
    if (editing) updateRealm(editing.id, data);
    else addRealm(data);
    setModalVisible(false);
  }

  function handleDelete(r: Plane) {
    Alert.alert("Remove Plane", `Remove "${r.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteRealm(r.id) },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.searchRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <Feather name="search" size={15} color={c.mutedForeground} />
        <TextInput style={[s.searchInput, { color: c.foreground }]} placeholder="Search planes..."
          placeholderTextColor={c.mutedForeground} value={search} onChangeText={setSearch} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={15} color={c.mutedForeground} /></TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setShowFilters((prev) => !prev)}
          activeOpacity={0.8}
          style={[s.filterToggle, { borderColor: showFilters ? c.primary : c.border, backgroundColor: showFilters ? c.primary + "18" : c.secondary }]}
        >
          <Feather name="filter" size={12} color={showFilters ? c.primary : c.mutedForeground} />
          <Text style={[s.filterToggleText, { color: showFilters ? c.primary : c.mutedForeground }]}>Filters</Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <Animated.View
          style={[
            s.filterPanel,
            {
              backgroundColor: c.card,
              borderColor: c.border,
              ...filterPanelAnimatedStyle,
            },
          ]}
        >
          <View style={s.filterPanelRow}>
            <Text style={[s.filterPanelLabel, { color: c.mutedForeground }]}>Pinned only</Text>
            <Switch
              value={pinnedOnly}
              onValueChange={setPinnedOnly}
              trackColor={{ false: c.muted, true: c.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={c.muted}
            />
          </View>
          <View style={s.filterPanelRow}>
            <Text style={[s.filterPanelLabel, { color: c.mutedForeground }]}>Has linked locations</Text>
            <Switch
              value={withLocationsOnly}
              onValueChange={setWithLocationsOnly}
              trackColor={{ false: c.muted, true: c.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={c.muted}
            />
          </View>
        </Animated.View>
      )}

      {filtered.length === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="earth" size={44} color={c.mutedForeground + "55"} />
          <Text style={[s.emptyTitle, { color: c.mutedForeground }]}>{search ? "No matches" : "No planes yet"}</Text>
          {!search && <Text style={[s.emptySub, { color: c.mutedForeground + "99" }]}>Track planes, kingdoms, and dimensions</Text>}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => r.id}
          contentContainerStyle={[s.list, { paddingBottom: listBottomPadding }]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginBottom: 6 }}>
              <Feather name="chevrons-left" size={12} color={c.mutedForeground + "88"} />
              <Text style={{ fontSize: 11, color: c.mutedForeground + "88", fontStyle: "italic" }}>long press to pin • swipe to delete</Text>
            </View>
          }
          renderItem={({ item: realm }) => (
            <SwipeableRealmCard
              realm={realm}
              locations={locations}
              onEdit={() => openEdit(realm)}
              onPin={() => pinRealm(realm.id, !realm.pinned)}
              onDelete={() => handleDelete(realm)}
            />
          )}
        />
      )}

      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary, bottom: fabBottom }]} onPress={openNew} activeOpacity={0.85}>
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <RealmModal visible={modalVisible} realm={editing} quests={quests} locations={locations}
        onClose={() => setModalVisible(false)} onSave={handleSave}
        onDelete={editing ? () => { deleteRealm(editing.id); } : undefined}
        onPin={editing ? () => pinRealm(editing.id, !editing.pinned) : undefined} />
    </View>
  );
}

const makeS = (c: { radiusPill: number; radiusXl: number; radiusMd: number; radiusSm: number }) => StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: c.radiusMd, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  filterToggle: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 9, paddingVertical: 5 },
  filterToggleText: { fontSize: 11, fontWeight: "700" },
  filterPanel: { marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderRadius: c.radiusMd, padding: 10, gap: 10 },
  filterPanelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  filterPanelLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  list: { paddingHorizontal: 12, paddingBottom: 100, paddingTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 80 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  emptySub: { fontSize: 13 },
  pinnedBanner: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: c.radiusSm, marginBottom: 8, alignSelf: "flex-start" },
  pinnedText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: c.radiusXl, padding: 12, gap: 4, overflow: "hidden" },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardName: { fontSize: 16, fontWeight: "700", flex: 1 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  fab: { position: "absolute", bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", ...createShadowStyle({ y: 4, blur: 8, opacity: 0.3, elevation: 8 }) },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalHeaderTitle: { fontSize: 16, fontWeight: "700" },
  modalHeaderBtn: { minWidth: 60, alignItems: "center" },
  modalHeaderBtnText: { fontSize: 15 },
  modalBody: { padding: 16, paddingBottom: 60, gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: c.radiusMd, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderRadius: c.radiusPill, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: "600" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24, marginBottom: 8, paddingVertical: 14, borderWidth: 1, borderRadius: c.radiusMd },
  deleteBtnText: { fontSize: 15, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 8 },
  modalActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderWidth: 1, borderRadius: c.radiusMd },
  modalActionBtnText: { fontSize: 14, fontWeight: "600" },
});
