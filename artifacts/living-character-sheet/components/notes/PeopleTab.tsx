import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform,
  Switch,
  Animated, Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useFilterPanelMotion } from "@/hooks/useFilterPanelMotion";
import { useSwipeActions } from "@/hooks/useSwipeActions";
import type { NpcPerson, NpcRelationship } from "@/types";
import { createShadowStyle } from "../../utils/shadow";

const RELATIONSHIPS: { value: NpcRelationship; label: string; color: string }[] = [
  { value: "unknown",  label: "Unknown",  color: "#6B7280" },
  { value: "ally",     label: "Ally",     color: "#10B981" },
  { value: "neutral",  label: "Neutral",  color: "#F59E0B" },
  { value: "hostile",  label: "Hostile",  color: "#EF4444" },
];

function relColor(r: NpcRelationship): string {
  return RELATIONSHIPS.find(x => x.value === r)?.color ?? "#6B7280";
}
function relLabel(r: NpcRelationship): string {
  return RELATIONSHIPS.find(x => x.value === r)?.label ?? "Unknown";
}

interface PersonModalProps {
  visible: boolean;
  person: NpcPerson | null;
  quests: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: Omit<NpcPerson, "id" | "createdAt">) => void;
  onDelete?: () => void;
  onPin?: () => void;
}

function PersonModal({ visible, person, quests, locations, onClose, onSave, onDelete, onPin }: PersonModalProps) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [relationship, setRelationship] = useState<NpcRelationship>("unknown");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [questTags, setQuestTags] = useState<string[]>([]);
  const [locationTags, setLocationTags] = useState<string[]>([]);
  const [deceased, setDeceased] = useState(false);
  const [deceasedNote, setDeceasedNote] = useState("");

  React.useEffect(() => {
    if (visible) {
      setName(person?.name ?? "");
      setRole(person?.role ?? "");
      setRelationship(person?.relationship ?? "unknown");
      setDescription(person?.description ?? "");
      setNotes(person?.notes ?? "");
      setQuestTags(person?.questTags ?? []);
      setLocationTags(person?.locationTags ?? []);
      setDeceased(person?.deceased ?? false);
      setDeceasedNote(person?.deceasedNote ?? "");
    }
  }, [visible, person]);

  function toggleQuest(qid: string) {
    setQuestTags(prev => prev.includes(qid) ? prev.filter(x => x !== qid) : [...prev, qid]);
  }

  function toggleLocation(lid: string) {
    setLocationTags(prev => prev.includes(lid) ? prev.filter(x => x !== lid) : [...prev, lid]);
  }

  function handleSave() {
    if (!name.trim()) return Alert.alert("Name required", "Please enter a name.");
    onSave({
      name: name.trim(),
      role: role.trim() || undefined,
      relationship,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      questTags,
      locationTags: locationTags.length > 0 ? locationTags : undefined,
      deceased,
      deceasedNote: deceased ? (deceasedNote.trim() || undefined) : undefined,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[s.modalHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose} style={s.modalHeaderBtn}>
            <Text style={[s.modalHeaderBtnText, { color: c.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[s.modalHeaderTitle, { color: c.foreground }]}>{person ? "Edit Person" : "New Person"}</Text>
          <TouchableOpacity onPress={handleSave} style={s.modalHeaderBtn}>
            <Text style={[s.modalHeaderBtnText, { color: c.primary, fontWeight: "700" }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          {person?.deceased && (
            <View style={[s.deceasedBanner, { backgroundColor: "#EF444415", borderColor: "#EF444440" }]}>
              <Text style={s.deceasedBannerIcon}>💀</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.deceasedBannerTitle, { color: "#EF4444" }]}>Deceased</Text>
                {person.deceasedNote ? (
                  <Text style={[s.deceasedBannerNote, { color: c.mutedForeground }]}>{person.deceasedNote}</Text>
                ) : null}
              </View>
            </View>
          )}

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>NAME *</Text>
          <TextInput style={[s.input, { backgroundColor: c.card, borderColor: name.trim() ? c.primary : c.border, color: c.foreground }]}
            placeholder="Character name" placeholderTextColor={c.mutedForeground} value={name} onChangeText={setName} />

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>ROLE</Text>
          <TextInput style={[s.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="Quest Giver, Merchant, Guard..." placeholderTextColor={c.mutedForeground} value={role} onChangeText={setRole} />

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>RELATIONSHIP</Text>
          <View style={s.relRow}>
            {RELATIONSHIPS.map(r => (
              <TouchableOpacity key={r.value} onPress={() => setRelationship(r.value)} activeOpacity={0.8}
                style={[s.relChip, { borderColor: r.color, backgroundColor: relationship === r.value ? r.color + "30" : c.card }]}>
                <Text style={[s.relChipText, { color: relationship === r.value ? r.color : c.mutedForeground }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>STATUS</Text>
          <View style={[s.statusRow, { backgroundColor: c.card, borderColor: deceased ? "#EF444480" : c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.statusTitle, { color: deceased ? "#EF4444" : c.foreground }]}>
                {deceased ? "Deceased" : "Alive"}
              </Text>
              <Text style={[s.statusDesc, { color: c.mutedForeground }]}>
                Marking a person as deceased adjusts card behavior and visuals.
              </Text>
            </View>
            <Switch
              value={deceased}
              onValueChange={setDeceased}
              trackColor={{ false: c.muted, true: "#EF4444" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={c.muted}
            />
          </View>

          {deceased && (
            <>
              <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>DECEASED NOTE</Text>
              <TextInput
                style={[s.input, s.inputMulti, { backgroundColor: c.card, borderColor: "#EF444450", color: c.foreground }]}
                placeholder="Cause of death, circumstance, or aftermath..."
                placeholderTextColor={c.mutedForeground}
                value={deceasedNote}
                onChangeText={setDeceasedNote}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </>
          )}

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>DESCRIPTION</Text>
          <TextInput style={[s.input, s.inputMulti, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="Appearance, personality, history..." placeholderTextColor={c.mutedForeground}
            value={description} onChangeText={setDescription} multiline numberOfLines={3} textAlignVertical="top" />

          {questTags.length > 0 && (
            <>
              <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>RELATED QUESTS</Text>
              <View style={s.tagRow}>
                {quests.filter(q => questTags.includes(q.id)).map(q => (
                  <TouchableOpacity key={q.id} onPress={() => toggleQuest(q.id)} activeOpacity={0.8}
                    style={[s.tagChip, { borderColor: c.primary, backgroundColor: c.primary + "20" }]}>
                    <Feather name="flag" size={11} color={c.primary} />
                    <Text style={[s.tagChipText, { color: c.primary }]}>{q.name}</Text>
                    <Feather name="x" size={10} color={c.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          {quests.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Link Quest",
                  "Select a quest to link to this person:",
                  [
                    ...quests.filter(q => !questTags.includes(q.id)).map(q => ({
                      text: q.name,
                      onPress: () => toggleQuest(q.id),
                    })),
                    { text: "Cancel", style: "cancel" as const },
                  ]
                );
              }}
              activeOpacity={0.8}
              style={[s.tagChip, { borderColor: c.border, backgroundColor: c.secondary, alignSelf: "flex-start" }]}
            >
              <Feather name="plus" size={11} color={c.mutedForeground} />
              <Text style={[s.tagChipText, { color: c.mutedForeground }]}>Link quest</Text>
            </TouchableOpacity>
          )}

          {locationTags.length > 0 && (
            <>
              <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>LINKED LOCATIONS</Text>
              <View style={s.tagRow}>
                {locations.filter(l => locationTags.includes(l.id)).map(l => (
                  <TouchableOpacity key={l.id} onPress={() => toggleLocation(l.id)} activeOpacity={0.8}
                    style={[s.tagChip, { borderColor: "#F59E0B", backgroundColor: "#F59E0B20" }]}>
                    <Feather name="map-pin" size={11} color="#F59E0B" />
                    <Text style={[s.tagChipText, { color: "#F59E0B" }]}>{l.name}</Text>
                    <Feather name="x" size={10} color="#F59E0B" />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          {locations.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Link Location",
                  "Select a location to link to this person:",
                  [
                    ...locations.filter(l => !locationTags.includes(l.id)).map(l => ({
                      text: l.name,
                      onPress: () => toggleLocation(l.id),
                    })),
                    { text: "Cancel", style: "cancel" as const },
                  ]
                );
              }}
              activeOpacity={0.8}
              style={[s.tagChip, { borderColor: c.border, backgroundColor: c.secondary, alignSelf: "flex-start" }]}
            >
              <Feather name="plus" size={11} color={c.mutedForeground} />
              <Text style={[s.tagChipText, { color: c.mutedForeground }]}>Link location</Text>
            </TouchableOpacity>
          )}

          <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>NOTES</Text>
          <TextInput style={[s.input, s.inputMulti, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            placeholder="Additional notes..." placeholderTextColor={c.mutedForeground}
            value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" />

          {person && (onPin || onDelete) && (
            <View style={s.modalActions}>
              {onPin && (
                <TouchableOpacity
                  onPress={() => { onClose(); onPin(); }}
                  activeOpacity={0.8}
                  style={[s.modalActionBtn, { borderColor: c.primary + "50", backgroundColor: c.primary + "10" }]}
                >
                  <MaterialCommunityIcons name={person.pinned ? "pin" : "pin-outline"} size={16} color={c.primary} />
                  <Text style={[s.modalActionBtnText, { color: c.primary }]}>{person.pinned ? "Unpin" : "Pin"}</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  onPress={() => { onClose(); onDelete(); }}
                  activeOpacity={0.8}
                  style={[s.modalActionBtn, { borderColor: "#EF444440", backgroundColor: "#EF444410" }]}
                >
                  <Feather name="trash-2" size={15} color="#EF4444" />
                  <Text style={[s.modalActionBtnText, { color: "#EF4444" }]}>Delete Person</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SwipeablePersonCard({ person, questNameById, locationNameById, onEdit, onPin, onDelete }: {
  person: NpcPerson;
  questNameById: Record<string, string>;
  locationNameById: Record<string, string>;
  onEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { settings } = useAppSettings();
  const isDeceased = person.deceased === true;
  const rel = RELATIONSHIPS.find(r => r.value === person.relationship);
  const ACTION_WIDTH = 80;
  const canSwipeActions = !isDeceased;
  const { animatedStyle, panHandlers, revealed, close } = useSwipeActions({
    actionWidth: ACTION_WIDTH,
    canSwipe: canSwipeActions,
    motionIntensity: settings.motionIntensity,
  });

  return (
    <View style={{ borderRadius: c.radiusXl, overflow: "hidden" }}>
      {canSwipeActions && (
        <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
          <TouchableOpacity
            style={[psw.action, { backgroundColor: "#ef444422", width: ACTION_WIDTH }]}
            onPress={() => { close(); onDelete(); }}
            activeOpacity={0.8}
          >
            <Feather name="trash-2" size={18} color="#ef4444" />
            <Text style={[psw.actionText, { color: "#ef4444" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      <Animated.View style={animatedStyle} {...(canSwipeActions ? panHandlers : {})}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { if (revealed) { close(); } else { onEdit(); } }}
          onLongPress={() => {
            if (!canSwipeActions) return;
            onPin();
          }}
          style={[s.card, isDeceased
            ? { backgroundColor: "#6B728018", borderColor: "#6B728040" }
            : { backgroundColor: c.card, borderColor: person.pinned ? c.primary + "60" : c.border }
          ]}
        >
          {person.pinned && !isDeceased && (
            <View style={[s.pinnedBanner, { backgroundColor: c.primary + "15" }]}>
              <MaterialCommunityIcons name="pin" size={11} color={c.primary} />
              <Text style={[s.pinnedText, { color: c.primary }]}>PINNED</Text>
            </View>
          )}
          <View style={s.cardHeader}>
            <View style={s.cardLeft}>
              <View style={s.nameRow}>
                <Text style={[s.cardName, { color: isDeceased ? "#9CA3AF" : c.foreground, textDecorationLine: isDeceased ? "line-through" : "none" }]} numberOfLines={1}>{person.name}</Text>
                {rel && (
                  <View style={[s.relBadge, { backgroundColor: rel.color + "22", borderColor: rel.color + "55", marginLeft: 8 }]}> 
                    <Text style={[s.relText, { color: rel.color }]}>{rel.label}</Text>
                  </View>
                )}
              </View>
              {isDeceased && (
                <View style={s.deceasedPill}>
                  <Text style={s.deceasedPillText}>💀 DECEASED</Text>
                </View>
              )}
              {person.role && <Text style={[s.cardRole, { color: c.mutedForeground }]} numberOfLines={1}>{person.role}</Text>}
            </View>
            {isDeceased ? (
              <TouchableOpacity
                onPress={onDelete}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={s.cardHeaderAction}
              >
                <Feather name="trash-2" size={14} color="#EF4444" />
              </TouchableOpacity>
            ) : null}
          </View>
          {person.description && <Text style={[s.cardDesc, { color: c.mutedForeground }]} numberOfLines={2}>{person.description}</Text>}
          {person.questTags.filter((id) => questNameById[id]).length > 0 && (
            <View style={s.tagRow}>
              {person.questTags
                .filter((id) => questNameById[id])
                .map((id) => (
                  <View key={id} style={[s.tagChip, { borderColor: c.primary + "50", backgroundColor: c.primary + "15" }]}>
                    <Feather name="flag" size={10} color={c.primary} />
                    <Text style={[s.tagChipText, { color: c.primary }]}>{questNameById[id]}</Text>
                  </View>
                ))}
            </View>
          )}
          {(person.locationTags ?? []).filter((id) => locationNameById[id]).length > 0 && (
            <View style={s.tagRow}>
              {(person.locationTags ?? [])
                .filter((id) => locationNameById[id])
                .map((id) => (
                  <View key={id} style={[s.tagChip, { borderColor: "#F59E0B50", backgroundColor: "#F59E0B15" }]}>
                    <Feather name="map-pin" size={10} color="#F59E0B" />
                    <Text style={[s.tagChipText, { color: "#F59E0B" }]}>{locationNameById[id]}</Text>
                  </View>
                ))}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export function PeopleTab() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { settings } = useAppSettings();
  const { people, quests, locations, addPerson, updatePerson, deletePerson, pinPerson } = useCharacter();
  const questNameById = useMemo(() => {
    const map: Record<string, string> = {};
    quests.forEach((q) => { map[q.id] = q.name; });
    return map;
  }, [quests]);
  const locationNameById = useMemo(() => {
    const map: Record<string, string> = {};
    locations.forEach((l) => { map[l.id] = l.name; });
    return map;
  }, [locations]);
  const [search, setSearch] = useState("");
  const [showDeceased, setShowDeceased] = useState(true);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [relationshipFilter, setRelationshipFilter] = useState<"all" | NpcRelationship>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<NpcPerson | null>(null);
  const { filterPanelAnimatedStyle } = useFilterPanelMotion(showFilters, settings);

  const filtered = useMemo(() => {
    let list = showDeceased ? people : people.filter(p => !p.deceased);
    if (pinnedOnly) list = list.filter((p) => p.pinned);
    if (relationshipFilter !== "all") list = list.filter((p) => p.relationship === relationshipFilter);
    const q = search.toLowerCase().trim();
    const matched = q ? list.filter(p =>
      p.name.toLowerCase().includes(q) || (p.role ?? "").toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q)
    ) : list;

    const keyFor = (p: NpcPerson) => p.name.toLowerCase().trim().replace(/\s+/g, " ");
    const scoreFor = (p: NpcPerson) =>
      (p.deceased ? 4 : 0) +
      (p.pinned ? 2 : 0) +
      (p.role ? 1 : 0) +
      (p.description ? 1 : 0) +
      (p.notes ? 1 : 0);

    const dedupedByName = new Map<string, NpcPerson>();
    for (const person of matched) {
      const key = keyFor(person);
      const existing = dedupedByName.get(key);
      if (!existing) {
        dedupedByName.set(key, person);
        continue;
      }

      const existingScore = scoreFor(existing);
      const nextScore = scoreFor(person);
      if (nextScore > existingScore || (nextScore === existingScore && person.createdAt > existing.createdAt)) {
        dedupedByName.set(key, person);
      }
    }

    return [...dedupedByName.values()].sort((a, b) => {
      if ((a.pinned ? 0 : 1) !== (b.pinned ? 0 : 1)) return (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1);
      return b.createdAt - a.createdAt;
    });
  }, [people, pinnedOnly, relationshipFilter, search, showDeceased]);

  const deceasedCount = useMemo(() => people.filter(p => p.deceased).length, [people]);
  const fabBottom = Platform.OS === "web" ? 8 : tabBarHeight + 8;
  const listBottomPadding = fabBottom + 74;

  function openNew() { setEditing(null); setModalVisible(true); }
  function openEdit(p: NpcPerson) { setEditing(p); setModalVisible(true); }

  function handleSave(data: Omit<NpcPerson, "id" | "createdAt">) {
    if (editing) updatePerson(editing.id, data);
    else addPerson(data);
    setModalVisible(false);
  }

  function handleDelete(p: NpcPerson) {
    Alert.alert("Remove Person", `Remove "${p.name}" from your journal?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deletePerson(p.id) },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.searchRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <Feather name="search" size={15} color={c.mutedForeground} />
        <TextInput style={[s.searchInput, { color: c.foreground }]} placeholder="Search people..."
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
          <View style={s.filterRow}> 
            <Text style={[s.filterLabel, { color: c.mutedForeground }]}>Show deceased</Text>
            <TouchableOpacity onPress={() => setShowDeceased((v) => !v)} style={[s.inlinePill, { borderColor: showDeceased ? "#EF4444" : c.border, backgroundColor: showDeceased ? "#EF444420" : c.secondary }]}>
              <Text style={[s.inlinePillText, { color: showDeceased ? "#EF4444" : c.mutedForeground }]}>💀 {deceasedCount}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.filterRow}> 
            <Text style={[s.filterLabel, { color: c.mutedForeground }]}>Pinned only</Text>
            <Switch
              value={pinnedOnly}
              onValueChange={setPinnedOnly}
              trackColor={{ false: c.muted, true: c.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={c.muted}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={[s.filterLabel, { color: c.mutedForeground }]}>Relationship</Text>
            <View style={s.filterChipRow}>
              <TouchableOpacity
                onPress={() => setRelationshipFilter("all")}
                style={[s.filterChip, { borderColor: relationshipFilter === "all" ? c.primary : c.border, backgroundColor: relationshipFilter === "all" ? c.primary + "20" : c.secondary }]}
              >
                <Text style={[s.filterChipText, { color: relationshipFilter === "all" ? c.primary : c.mutedForeground }]}>All</Text>
              </TouchableOpacity>
              {RELATIONSHIPS.map((rel) => {
                const active = relationshipFilter === rel.value;
                return (
                  <TouchableOpacity
                    key={rel.value}
                    onPress={() => setRelationshipFilter(rel.value)}
                    style={[s.filterChip, { borderColor: active ? rel.color : c.border, backgroundColor: active ? rel.color + "20" : c.secondary }]}
                  >
                    <Text style={[s.filterChipText, { color: active ? rel.color : c.mutedForeground }]}>{rel.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      )}

      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Feather name="users" size={44} color={c.mutedForeground + "55"} />
          <Text style={[s.emptyTitle, { color: c.mutedForeground }]}>{search ? "No matches" : "No people yet"}</Text>
          {!search && <Text style={[s.emptySub, { color: c.mutedForeground + "99" }]}>Track NPCs, allies, and enemies</Text>}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.id}
          contentContainerStyle={[s.list, { paddingBottom: listBottomPadding }]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginBottom: 6 }}>
              <Feather name="chevrons-left" size={12} color={c.mutedForeground + "88"} />
              <Text style={{ fontSize: 11, color: c.mutedForeground + "88", fontStyle: "italic" }}>long press to pin • swipe to delete</Text>
            </View>
          }
          renderItem={({ item: p }) => (
            <SwipeablePersonCard
              person={p}
              questNameById={questNameById}
              locationNameById={locationNameById}
              onEdit={() => openEdit(p)}
              onPin={() => pinPerson(p.id, !p.pinned)}
              onDelete={() => handleDelete(p)}
            />
          )}
        />
      )}

      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary, bottom: fabBottom }]} onPress={openNew} activeOpacity={0.85}>
        <Feather name="user-plus" size={24} color="#fff" />
      </TouchableOpacity>

      <PersonModal visible={modalVisible} person={editing} quests={quests} locations={locations}
        onClose={() => setModalVisible(false)} onSave={handleSave}
        onDelete={editing ? () => handleDelete(editing) : undefined}
        onPin={editing && !editing.deceased ? () => { pinPerson(editing.id, !editing.pinned); setModalVisible(false); } : undefined} />
    </View>
  );
}

const psw = StyleSheet.create({
  action: { alignItems: "center", justifyContent: "center", gap: 4, height: "100%" },
  actionText: { fontSize: 11, fontWeight: "600" },
});

const makeS = (c: { radiusPill: number; radiusXl: number; radiusMd: number; radiusSm: number }) => StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: c.radiusMd, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  filterToggle: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 9, paddingVertical: 5 },
  filterToggleText: { fontSize: 11, fontWeight: "700" },
  filterPanel: { marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderRadius: c.radiusMd, padding: 10, gap: 10 },
  filterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  filterLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  inlinePill: { borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 10, paddingVertical: 5 },
  inlinePillText: { fontSize: 11, fontWeight: "700" },
  filterChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterChip: { borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 9, paddingVertical: 5 },
  filterChipText: { fontSize: 11, fontWeight: "700" },
  deceasedToggle: { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: c.radiusXl, paddingHorizontal: 7, paddingVertical: 3 },
  deceasedToggleText: { fontSize: 11, fontWeight: "700" },
  list: { paddingHorizontal: 12, paddingBottom: 100, paddingTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 80 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  emptySub: { fontSize: 13 },
  pinnedBanner: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: c.radiusSm, marginBottom: 6, alignSelf: "flex-start" },
  pinnedText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: c.radiusXl, padding: 14, gap: 6 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardHeaderAction: { marginLeft: 8 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, padding: 13, borderRadius: c.radiusMd, borderWidth: 1 },
  deleteBtnText: { fontSize: 14, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 8 },
  modalActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderWidth: 1, borderRadius: c.radiusMd },
  modalActionBtnText: { fontSize: 14, fontWeight: "600" },
  cardLeft: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardRole: { fontSize: 12 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  deceasedNote: { fontSize: 12, fontStyle: "italic", marginTop: 1, color: "#9CA3AF" },
  relBadge: { borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 9, paddingVertical: 3, flexShrink: 0 },
  relBadgeText: { fontSize: 11, fontWeight: "700" },
  relText: { fontSize: 11, fontWeight: "700" },
  deceasedPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#EF444425", borderColor: "#EF444460", borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 9, paddingVertical: 3, marginTop: 3 },
  deceasedPillText: { fontSize: 10, fontWeight: "700", color: "#EF4444", letterSpacing: 0.5 },
  deceasedBadge: { borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 9, paddingVertical: 3, flexShrink: 0, backgroundColor: "#6B728025", borderColor: "#6B728055" },
  deceasedBadgeText: { fontSize: 11, fontWeight: "700", color: "#9CA3AF" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  tagChip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: c.radiusPill, paddingHorizontal: 8, paddingVertical: 3 },
  tagChipText: { fontSize: 11, fontWeight: "600" },
  fab: { position: "absolute", bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", ...createShadowStyle({ y: 4, blur: 8, opacity: 0.3, elevation: 8 }) },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalHeaderTitle: { fontSize: 16, fontWeight: "700" },
  modalHeaderBtn: { minWidth: 60, alignItems: "center" },
  modalHeaderBtnText: { fontSize: 15 },
  modalBody: { padding: 16, paddingBottom: 60, gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: c.radiusMd, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  relRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  relChip: { borderWidth: 1.5, borderRadius: c.radiusPill, paddingHorizontal: 12, paddingVertical: 6 },
  relChipText: { fontSize: 13, fontWeight: "600" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: c.radiusMd, paddingHorizontal: 12, paddingVertical: 10 },
  statusTitle: { fontSize: 14, fontWeight: "700" },
  statusDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  deceasedBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: c.radiusMd, padding: 12, marginBottom: 4 },
  deceasedBannerIcon: { fontSize: 20 },
  deceasedBannerTitle: { fontSize: 14, fontWeight: "700" },
  deceasedBannerNote: { fontSize: 12, marginTop: 2 },
});
