import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, Switch,
  Animated, Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useFilterPanelMotion } from "@/hooks/useFilterPanelMotion";
import { useSwipeActions } from "@/hooks/useSwipeActions";
import type { CampaignLocation } from "@/types";
import { buildEffectiveLocationQuestLinks, buildLocationHierarchy, getLocationDescendantIds } from "@/utils/locationHierarchy";
import { createShadowStyle } from "../../utils/shadow";

interface LocationModalProps {
  visible: boolean;
  location: CampaignLocation | null;
  locations: CampaignLocation[];
  quests: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: Omit<CampaignLocation, "id" | "createdAt">) => void;
  onDelete?: () => void;
  onPin?: () => void;
}

function LocationModal({ visible, location, locations, quests, onClose, onSave, onDelete, onPin }: LocationModalProps) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [mapImageUri, setMapImageUri] = useState<string | undefined>();
  const [parentLocationId, setParentLocationId] = useState<string>("");
  const [questTags, setQuestTags] = useState<string[]>([]);

  const blockedParentIds = useMemo(() => {
    if (!location) return new Set<string>();
    return getLocationDescendantIds(location.id, locations);
  }, [location, locations]);

  const parentOptions = useMemo(() => (
    buildLocationHierarchy(locations).filter(({ location: option }) => option.id !== location?.id && !blockedParentIds.has(option.id))
  ), [blockedParentIds, location, locations]);

  React.useEffect(() => {
    if (visible) {
      setName(location?.name ?? "");
      setDescription(location?.description ?? "");
      setNotes(location?.notes ?? "");
      setMapImageUri(location?.mapImageUri);
      setParentLocationId(location?.parentLocationId ?? "");
      setQuestTags(location?.questTags ?? []);
    }
  }, [visible, location]);

  async function pickMap() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to attach a map image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setMapImageUri(result.assets[0].uri);
    }
  }

  function toggleQuest(qid: string) {
    setQuestTags(prev => prev.includes(qid) ? prev.filter(x => x !== qid) : [...prev, qid]);
  }

  function handleSave() {
    if (!name.trim()) return Alert.alert("Name required", "Please enter a location name.");
    onSave({ name: name.trim(), description: description.trim() || undefined,
             notes: notes.trim() || undefined, mapImageUri, parentLocationId: parentLocationId || undefined, questTags });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[s.modalHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose} style={s.modalHeaderBtn}>
            <Text style={[s.modalHeaderBtnText, { color: c.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[s.modalHeaderTitle, { color: c.foreground }]}>{location ? "Edit Location" : "New Location"}</Text>
          <TouchableOpacity onPress={handleSave} style={s.modalHeaderBtn}>
            <Text style={[s.modalHeaderBtnText, { color: c.primary, fontWeight: "700" }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>LOCATION NAME *</Text>
          <TextInput style={[s.input, { backgroundColor: c.card, borderColor: name.trim() ? c.primary : c.border, color: c.foreground }]}
            placeholder="Village, dungeon, city..." placeholderTextColor={c.mutedForeground} value={name} onChangeText={setName} />

          {parentOptions.length > 0 && (
            <>
              <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>PARENT LOCATION</Text>
              <View style={s.parentPicker}>
                <TouchableOpacity
                  onPress={() => setParentLocationId("")}
                  activeOpacity={0.8}
                  style={[s.parentOption, { borderColor: !parentLocationId ? c.primary : c.border, backgroundColor: !parentLocationId ? c.primary + "16" : c.card }]}
                >
                  <Text style={[s.parentOptionText, { color: !parentLocationId ? c.primary : c.foreground }]}>No parent</Text>
                  <Text style={[s.parentOptionMeta, { color: c.mutedForeground }]}>Keep this as a top-level location.</Text>
                </TouchableOpacity>
                {parentOptions.map((entry) => {
                  const selected = parentLocationId === entry.location.id;
                  return (
                    <TouchableOpacity
                      key={entry.location.id}
                      onPress={() => setParentLocationId(entry.location.id)}
                      activeOpacity={0.8}
                      style={[
                        s.parentOption,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "16" : c.card,
                          marginLeft: Math.min(entry.depth * 14, 42),
                        },
                      ]}
                    >
                      <Text style={[s.parentOptionText, { color: selected ? c.primary : c.foreground }]} numberOfLines={1}>{entry.location.name}</Text>
                      {entry.parentBreadcrumb ? (
                        <Text style={[s.parentOptionMeta, { color: c.mutedForeground }]} numberOfLines={1}>In {entry.parentBreadcrumb}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>DESCRIPTION</Text>
          <TextInput style={[s.input, s.inputMulti, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="What does this place look like? Who lives here?" placeholderTextColor={c.mutedForeground}
            value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>MAP IMAGE</Text>
          {mapImageUri ? (
            <View style={s.mapPreviewWrap}>
              <Image source={{ uri: mapImageUri }} style={s.mapPreview} resizeMode="cover" />
              <View style={s.mapActions}>
                <TouchableOpacity onPress={pickMap} style={[s.mapBtn, { backgroundColor: c.card, borderColor: c.border }]} activeOpacity={0.8}>
                  <Feather name="refresh-cw" size={14} color={c.foreground} />
                  <Text style={[s.mapBtnText, { color: c.foreground }]}>Replace</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMapImageUri(undefined)} style={[s.mapBtn, { backgroundColor: "#EF444420", borderColor: "#EF444450" }]} activeOpacity={0.8}>
                  <Feather name="trash-2" size={14} color="#EF4444" />
                  <Text style={[s.mapBtnText, { color: "#EF4444" }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={pickMap} activeOpacity={0.8}
              style={[s.mapPickerBtn, { backgroundColor: c.card, borderColor: c.border }]}>
              <Feather name="image" size={22} color={c.mutedForeground} />
              <Text style={[s.mapPickerText, { color: c.mutedForeground }]}>Add Map Image</Text>
              <Text style={[s.mapPickerSub, { color: c.mutedForeground + "88" }]}>Tap to pick from your photo library</Text>
            </TouchableOpacity>
          )}

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

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>NOTES</Text>
          <TextInput style={[s.input, s.inputMulti, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="Secrets, points of interest, dangers..." placeholderTextColor={c.mutedForeground}
            value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" />

          {location && (
            <View style={s.modalActions}>
              {onPin && (
                <TouchableOpacity onPress={() => { onClose(); onPin(); }} activeOpacity={0.8}
                  style={[s.modalActionBtn, { borderColor: c.primary + "50", backgroundColor: c.primary + "10" }]}>
                  <MaterialCommunityIcons name={location.pinned ? "pin" : "pin-outline"} size={16} color={c.primary} />
                  <Text style={[s.modalActionBtnText, { color: c.primary }]}>{location.pinned ? "Unpin" : "Pin"}</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity onPress={() => { onClose(); onDelete(); }} activeOpacity={0.8}
                  style={[s.modalActionBtn, { borderColor: "#EF444450", backgroundColor: "#EF444410" }]}>
                  <Feather name="trash-2" size={15} color="#EF4444" />
                  <Text style={[s.modalActionBtnText, { color: "#EF4444" }]}>Remove Location</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SwipeableLocationCard({ location, depth, parentBreadcrumb, questNameById, directQuestIds, inheritedQuestIds, onEdit, onPin, onDelete }: {
  location: CampaignLocation;
  depth: number;
  parentBreadcrumb?: string;
  questNameById: Record<string, string>;
  directQuestIds: string[];
  inheritedQuestIds: string[];
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
    <View style={{ borderRadius: c.radiusXl, overflow: "hidden", marginLeft: Math.min(depth * 14, 42) }}>
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
        <TouchableOpacity style={[lsw.action, { backgroundColor: "#ef444422", width: ACTION_WIDTH }]}
          onPress={() => { close(); onDelete(); }} activeOpacity={0.8}>
          <Feather name="trash-2" size={18} color="#ef4444" />
          <Text style={[lsw.actionText, { color: "#ef4444" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={animatedStyle} {...panHandlers}>
        <TouchableOpacity activeOpacity={0.85}
          onPress={() => { if (revealed) { close(); } else { onEdit(); } }}
          onLongPress={onPin}
          style={[s.card, { backgroundColor: c.card, borderColor: location.pinned ? c.primary + "60" : c.border }]}>
          {location.pinned && (
            <View style={[s.pinnedBanner, { backgroundColor: c.primary + "15" }]}>
              <MaterialCommunityIcons name="pin" size={11} color={c.primary} />
              <Text style={[s.pinnedText, { color: c.primary }]}>PINNED</Text>
            </View>
          )}
          <View style={s.cardRow}>
            {location.mapImageUri && (
              <Image source={{ uri: location.mapImageUri }} style={s.cardThumb} resizeMode="cover" />
            )}
            <View style={s.cardBody}>
              <View style={s.cardNameRow}>
                <Feather name="map-pin" size={13} color={c.primary} />
                <Text style={[s.cardName, { color: c.foreground }]}>{location.name}</Text>
              </View>
              {parentBreadcrumb ? (
                <Text style={[s.cardMeta, { color: c.mutedForeground }]} numberOfLines={1}>In {parentBreadcrumb}</Text>
              ) : null}
              {location.description && (
                <Text style={[s.cardDesc, { color: c.mutedForeground }]} numberOfLines={location.mapImageUri ? 1 : 2}>
                  {location.description}
                </Text>
              )}
              {(directQuestIds.length > 0 || inheritedQuestIds.length > 0) && (
                <View style={s.tagRow}>
                  {directQuestIds
                    .filter((id) => questNameById[id])
                    .map((id) => (
                      <View key={id} style={[s.tagChip, { borderColor: c.primary + "50", backgroundColor: c.primary + "15" }]}>
                        <Feather name="flag" size={10} color={c.primary} />
                        <Text style={[s.tagChipText, { color: c.primary }]}>{questNameById[id]}</Text>
                      </View>
                    ))}
                  {inheritedQuestIds
                    .filter((id) => questNameById[id])
                    .map((id) => (
                      <View key={`inherited-${id}`} style={[s.tagChip, { borderColor: c.mutedForeground + "44", backgroundColor: c.mutedForeground + "14" }]}>
                        <Feather name="corner-down-right" size={10} color={c.mutedForeground} />
                        <Text style={[s.tagChipText, { color: c.mutedForeground }]}>{questNameById[id]} [Inherited]</Text>
                      </View>
                    ))}
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const lsw = StyleSheet.create({
  action: { alignItems: "center", justifyContent: "center", gap: 4, height: "100%" },
  actionText: { fontSize: 11, fontWeight: "600" },
});

export function LocationsTab() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { settings } = useAppSettings();
  const { locations, quests, addLocation, updateLocation, deleteLocation, pinLocation } = useCharacter();
  const hierarchy = useMemo(() => buildLocationHierarchy(locations), [locations]);
  const effectiveQuestLinks = useMemo(() => buildEffectiveLocationQuestLinks(quests, locations), [quests, locations]);
  const questNameById = useMemo(() => {
    const map: Record<string, string> = {};
    quests.forEach((q) => {
      map[q.id] = q.name;
    });
    return map;
  }, [quests]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [hasMapOnly, setHasMapOnly] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<CampaignLocation | null>(null);
  const { filterPanelAnimatedStyle } = useFilterPanelMotion(showFilters, settings);

  const filtered = useMemo(() => {
    let list = hierarchy;
    if (pinnedOnly) list = list.filter(({ location }) => location.pinned);
    if (hasMapOnly) list = list.filter(({ location }) => Boolean(location.mapImageUri));
    const q = search.toLowerCase().trim();
    return q
      ? list.filter(({ location }) => location.name.toLowerCase().includes(q) || (location.description ?? "").toLowerCase().includes(q))
      : list;
  }, [hasMapOnly, hierarchy, pinnedOnly, search]);

  const fabBottom = Platform.OS === "web" ? 8 : tabBarHeight + 8;
  const listBottomPadding = fabBottom + 74;

  function openNew() { setEditing(null); setModalVisible(true); }
  function openEdit(l: CampaignLocation) { setEditing(l); setModalVisible(true); }

  function handleSave(data: Omit<CampaignLocation, "id" | "createdAt">) {
    if (editing) updateLocation(editing.id, data);
    else addLocation(data);
    setModalVisible(false);
  }

  function handleDelete(l: CampaignLocation) {
    Alert.alert("Remove Location", `Remove "${l.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteLocation(l.id) },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.searchRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <Feather name="search" size={15} color={c.mutedForeground} />
        <TextInput style={[s.searchInput, { color: c.foreground }]} placeholder="Search locations..."
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
            <Text style={[s.filterPanelLabel, { color: c.mutedForeground }]}>Has map image</Text>
            <Switch
              value={hasMapOnly}
              onValueChange={setHasMapOnly}
              trackColor={{ false: c.muted, true: c.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={c.muted}
            />
          </View>
        </Animated.View>
      )}

      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Feather name="map-pin" size={44} color={c.mutedForeground + "55"} />
          <Text style={[s.emptyTitle, { color: c.mutedForeground }]}>{search ? "No matches" : "No locations yet"}</Text>
          {!search && <Text style={[s.emptySub, { color: c.mutedForeground + "99" }]}>Record cities, dungeons, points of interest</Text>}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={({ location }) => location.id}
          contentContainerStyle={[s.list, { paddingBottom: listBottomPadding }]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginBottom: 6 }}>
              <Feather name="chevrons-left" size={12} color={c.mutedForeground + "88"} />
              <Text style={{ fontSize: 11, color: c.mutedForeground + "88", fontStyle: "italic" }}>long press to pin • swipe to delete</Text>
            </View>
          }
          renderItem={({ item }) => (
            <SwipeableLocationCard
              location={item.location}
              depth={item.depth}
              parentBreadcrumb={item.parentBreadcrumb}
              questNameById={questNameById}
              directQuestIds={effectiveQuestLinks.get(item.location.id)?.directQuestIds ?? []}
              inheritedQuestIds={effectiveQuestLinks.get(item.location.id)?.inheritedQuestIds ?? []}
              onEdit={() => openEdit(item.location)}
              onPin={() => pinLocation(item.location.id, !item.location.pinned)}
              onDelete={() => handleDelete(item.location)}
            />
          )}
        />
      )}

      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary, bottom: fabBottom }]} onPress={openNew} activeOpacity={0.85}>
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <LocationModal visible={modalVisible} location={editing} locations={locations} quests={quests}
        onClose={() => setModalVisible(false)} onSave={handleSave}
        onDelete={editing ? () => handleDelete(editing) : undefined}
        onPin={editing ? () => pinLocation(editing.id, !editing.pinned) : undefined} />
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
  card: { borderWidth: 1, borderRadius: c.radiusXl, padding: 12, overflow: "hidden" },
  cardRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  cardBody: { flex: 1, gap: 4 },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardName: { fontSize: 16, fontWeight: "700", flex: 1 },
  cardMeta: { fontSize: 11, fontWeight: "600" },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardThumb: { width: 72, height: 72, borderRadius: c.radiusSm },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  tagChip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 8, paddingVertical: 3 },
  tagChipText: { fontSize: 11, fontWeight: "600" },
  parentPicker: { gap: 8 },
  parentOption: { borderWidth: 1, borderRadius: c.radiusMd, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  parentOptionText: { fontSize: 14, fontWeight: "700" },
  parentOptionMeta: { fontSize: 11 },
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
  mapPickerBtn: { borderWidth: 1, borderRadius: c.radiusXl, borderStyle: "dashed", padding: 20, alignItems: "center", gap: 6 },
  mapPickerText: { fontSize: 15, fontWeight: "600" },
  mapPickerSub: { fontSize: 12 },
  mapPreviewWrap: { gap: 8 },
  mapPreview: { width: "100%", height: 180, borderRadius: c.radiusXl },
  mapActions: { flexDirection: "row", gap: 8 },
  mapBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: c.radiusSm, paddingVertical: 9 },
  mapBtnText: { fontSize: 13, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 8 },
  modalActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderWidth: 1, borderRadius: c.radiusMd },
  modalActionBtnText: { fontSize: 14, fontWeight: "600" },
});
