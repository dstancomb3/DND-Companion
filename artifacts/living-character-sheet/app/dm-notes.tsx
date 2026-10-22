import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { useColors } from "@/hooks/useColors";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useCharacter } from "@/context/CharacterContext";
import { API_BASE_URL } from "@/utils/apiUrl";
import type { CampaignLocation, DmCampaignItem, DmCampaignItemLootRole, LocationAction, Note, NpcPerson, PersonAction, Plane, Quest, QuestAction, QuestLocationLinkMode, QuickUpdateResult } from "@/types";
import {
  deleteDmNote,
  deleteDmLocation,
  deleteDmItem,
  deleteDmPerson,
  deleteDmPlane,
  deleteDmQuest,
  getDmNotesPayload,
  upsertDmNote,
  upsertDmLocation,
  upsertDmPerson,
  upsertDmPlane,
  upsertDmQuest,
  upsertDmItem,
  saveDmNotesPayload,
} from "@/utils/dmNotesStorage";
import { buildEffectiveLocationQuestLinks, buildLocationHierarchy, getLocationDescendantIds } from "@/utils/locationHierarchy";

type TabId = "notes" | "quests" | "parser" | "people" | "locations" | "items" | "planes";
type ParserIntent = "" | "new" | "active" | "completed" | "failed";
type DraftQuestAction = QuestAction & { linkedPersonNames: string[]; linkedLocationNames: string[] };
type DraftPersonAction = PersonAction & { linkedQuestNames: string[]; linkedLocationNames: string[] };
type DraftLocationAction = LocationAction & { linkedQuestNames: string[]; linkedPersonNames: string[] };

const PARSER_QUEST_TYPE_OPTIONS: Array<{ value: Quest["type"]; label: string }> = [
  { value: "main", label: "Main" },
  { value: "side", label: "Side" },
  { value: "personal", label: "Personal" },
];

const PARSER_INTENT_OPTIONS: Array<{ value: Exclude<ParserIntent, "">; label: string }> = [
  { value: "new", label: "New Quest" },
  { value: "active", label: "Update" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const PLANE_PRESETS: Array<{ name: string; description: string }> = [
  { name: "Material Plane", description: "The ordinary mortal world where most adventures begin." },
  { name: "Feywild", description: "A vivid, magical echo of the world filled with fey courts and wild emotion." },
  { name: "Shadowfell", description: "A dark reflection of the world steeped in gloom, spirits, and decay." },
  { name: "Astral Plane", description: "A timeless silvery void connecting worlds, gods, and forgotten ruins." },
  { name: "Nine Hells", description: "A lawful infernal realm of devils, contracts, and brutal hierarchies." },
  { name: "Elemental Planes", description: "The raw realms of Fire, Water, Air, and Earth." },
];

function normalizeKey(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function upsertNetworkLine(notes: string | undefined, label: string, values: string[]): string | undefined {
  const deduped = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  if (deduped.length === 0) return notes;
  const line = `${label}: ${deduped.join(", ")}`;
  const current = (notes || "").trim();
  if (!current) return line;

  const lines = current.split("\n").map((l) => l.trim()).filter(Boolean);
  const existingIdx = lines.findIndex((l) => l.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  if (existingIdx >= 0) {
    lines[existingIdx] = line;
    return lines.join("\n");
  }
  return `${current}\n${line}`;
}

function buildQuestDescriptionFallback(
  questName: string,
  parserText: string,
  summary: string,
  personNames: string[],
  locationNames: string[]
): string | undefined {
  const sourceText = parserText.trim();
  const normalizedQuest = normalizeKey(questName);
  const sentence = sourceText
    .split(/(?<=[.!?])\s+/)
    .find((part) => normalizeKey(part).includes(normalizedQuest));
  const base = (sentence || summary || sourceText).trim();
  if (!base) return undefined;

  const peoplePart = personNames.length > 0 ? `People: ${personNames.join(", ")}.` : "";
  const locationsPart = locationNames.length > 0 ? `Locations: ${locationNames.join(", ")}.` : "";
  return `${base}${peoplePart || locationsPart ? ` ${peoplePart} ${locationsPart}`.trim() : ""}`.trim();
}

const TITLE_WORDS = new Set(["captain", "sir", "lady", "lord", "master", "archmage", "priest", "baron", "duke", "king", "queen"]);
const LOCATION_HINTS = ["in", "at", "near", "to", "from", "inside", "within", "beneath", "under", "around"];

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function toSentenceChunks(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

function extractCapitalizedPhrases(text: string): string[] {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) ?? [];
  return uniq(matches.filter((m) => m.length > 2));
}

function getContainmentEndpoints(snapshot: {
  relationshipType?: string;
  fromEntityId?: string;
  toEntityId?: string;
} | null): { childId: string; parentId: string } | null {
  if (!snapshot) return null;
  if (!snapshot.fromEntityId || !snapshot.toEntityId) return null;
  if (snapshot.relationshipType === "contained_in") {
    return { childId: snapshot.fromEntityId, parentId: snapshot.toEntityId };
  }
  if (snapshot.relationshipType === "contains_location") {
    return { childId: snapshot.toEntityId, parentId: snapshot.fromEntityId };
  }
  return null;
}

function augmentQuickUpdateResult(
  result: QuickUpdateResult,
  sourceText: string,
  questContext: Quest[],
  peopleContext: NpcPerson[],
  locationContext: CampaignLocation[]
): QuickUpdateResult {
  const questActions = [...(result.questActions ?? [])];
  const personActions = [...(result.personActions ?? [])];
  const locationActions = [...(result.locationActions ?? [])];

  const existingPeopleByName = new Map(peopleContext.map((p) => [normalizeKey(p.name), p]));
  const existingLocationsByName = new Map(locationContext.map((l) => [normalizeKey(l.name), l]));
  const existingQuestsByName = new Map(questContext.map((q) => [normalizeKey(q.name), q]));

  const source = sourceText.trim();
  const sourceLower = source.toLowerCase();
  const candidatePhrases = extractCapitalizedPhrases(source);
  const sentences = toSentenceChunks(source);

  // Pull in known entities from context if the text explicitly names them.
  const matchedPeople = peopleContext
    .filter((p) => normalizeKey(p.name) && sourceLower.includes(normalizeKey(p.name)))
    .map((p) => p.name);
  const matchedLocations = locationContext
    .filter((l) => normalizeKey(l.name) && sourceLower.includes(normalizeKey(l.name)))
    .map((l) => l.name);

  // Light heuristic for unseen entities if AI misses them.
  const heuristicPeople: string[] = [];
  const heuristicLocations: string[] = [];
  for (const sentence of sentences) {
    const phrases = extractCapitalizedPhrases(sentence);
    for (const phrase of phrases) {
      const lower = phrase.toLowerCase();
      const isLocationHinted = LOCATION_HINTS.some((hint) => sentence.toLowerCase().includes(`${hint} ${lower}`));
      const firstWord = lower.split(" ")[0];
      const isPersonHinted = TITLE_WORDS.has(firstWord) || /(met|spoke|talked|asked|told|hired|helped)\s+/.test(sentence.toLowerCase());
      if (isLocationHinted) heuristicLocations.push(phrase);
      else if (isPersonHinted) heuristicPeople.push(phrase);
    }
  }

  const allPersonNames = uniq([
    ...personActions.map((p) => p.name),
    ...matchedPeople,
    ...heuristicPeople,
    ...candidatePhrases.filter((name) => existingPeopleByName.has(normalizeKey(name))).map((n) => existingPeopleByName.get(normalizeKey(n))!.name),
  ]);
  const allLocationNames = uniq([
    ...locationActions.map((l) => l.name),
    ...matchedLocations,
    ...heuristicLocations,
    ...candidatePhrases.filter((name) => existingLocationsByName.has(normalizeKey(name))).map((n) => existingLocationsByName.get(normalizeKey(n))!.name),
  ]);

  const normalizedPeopleInActions = new Set(personActions.map((p) => normalizeKey(p.name)));
  for (const personName of allPersonNames) {
    const key = normalizeKey(personName);
    if (!key || normalizedPeopleInActions.has(key)) continue;
    const existing = existingPeopleByName.get(key);
    personActions.push({
      action: existing ? "update" : "create",
      personId: existing?.id ?? null,
      name: existing?.name ?? personName,
      role: existing?.role ?? null,
      relationship: existing?.relationship ?? "unknown",
      description: existing?.description ?? null,
      notes: existing?.notes ?? null,
    });
    normalizedPeopleInActions.add(key);
  }

  const normalizedLocationsInActions = new Set(locationActions.map((l) => normalizeKey(l.name)));
  for (const locationName of allLocationNames) {
    const key = normalizeKey(locationName);
    if (!key || normalizedLocationsInActions.has(key)) continue;
    const existing = existingLocationsByName.get(key);
    locationActions.push({
      action: existing ? "update" : "create",
      locationId: existing?.id ?? null,
      name: existing?.name ?? locationName,
      description: existing?.description ?? null,
    });
    normalizedLocationsInActions.add(key);
  }

  if (questActions.length === 0 && source) {
    const inferredQuestName = source.split(/[.!?\n]/)[0]?.trim();
    if (inferredQuestName) {
      const existing = existingQuestsByName.get(normalizeKey(inferredQuestName));
      questActions.push({
        action: existing ? "update" : "create",
        questId: existing?.id ?? null,
        name: inferredQuestName,
        type: existing?.type ?? "side",
        status: existing?.status ?? "active",
        description: source,
        notes: null,
        locationNames: allLocationNames,
        personNames: allPersonNames,
      });
    }
  }

  const patchedQuestActions = questActions.map((quest) => ({
    ...quest,
    personNames: uniq([...(quest.personNames ?? []), ...allPersonNames]),
    locationNames: uniq([...(quest.locationNames ?? []), ...allLocationNames]),
  }));

  return {
    ...result,
    questActions: patchedQuestActions,
    personActions,
    locationActions,
  };
}

function buildDraftsFromResult(result: QuickUpdateResult): {
  questDrafts: DraftQuestAction[];
  personDrafts: DraftPersonAction[];
  locationDrafts: DraftLocationAction[];
} {
  const questDrafts: DraftQuestAction[] = (result.questActions ?? []).map((q) => ({
    ...q,
    linkedPersonNames: uniq(q.personNames ?? []),
    linkedLocationNames: uniq(q.locationNames ?? []),
  }));
  const personDrafts: DraftPersonAction[] = (result.personActions ?? []).map((p) => ({
    ...p,
    linkedQuestNames: uniq(
      questDrafts
        .filter((q) => q.linkedPersonNames.some((name) => normalizeKey(name) === normalizeKey(p.name)))
        .map((q) => q.name)
    ),
    linkedLocationNames: uniq(
      questDrafts
        .filter((q) => q.linkedPersonNames.some((name) => normalizeKey(name) === normalizeKey(p.name)))
        .flatMap((q) => q.linkedLocationNames)
    ),
  }));
  const locationDrafts: DraftLocationAction[] = (result.locationActions ?? []).map((l) => ({
    ...l,
    linkedQuestNames: uniq(
      questDrafts
        .filter((q) => q.linkedLocationNames.some((name) => normalizeKey(name) === normalizeKey(l.name)))
        .map((q) => q.name)
    ),
    linkedPersonNames: uniq(
      questDrafts
        .filter((q) => q.linkedLocationNames.some((name) => normalizeKey(name) === normalizeKey(l.name)))
        .flatMap((q) => q.linkedPersonNames)
    ),
  }));
  return { questDrafts, personDrafts, locationDrafts };
}

export default function DmNotesScreen() {
  const c = useColors();
  const { settings } = useAppSettings();
  const {
    getReviewBatches,
    resolveDeferredOperation,
    applyResolvedOperations,
    markBatchArchived,
  } = useCharacter();
  const [tab, setTab] = useState<TabId>("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [people, setPeople] = useState<NpcPerson[]>([]);
  const [locations, setLocations] = useState<CampaignLocation[]>([]);
  const [items, setItems] = useState<DmCampaignItem[]>([]);
  const [planes, setPlanes] = useState<Plane[]>([]);

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showPlaneModal, setShowPlaneModal] = useState(false);
  const [showPlanePickerModal, setShowPlanePickerModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [editingPerson, setEditingPerson] = useState<NpcPerson | null>(null);
  const [editingLocation, setEditingLocation] = useState<CampaignLocation | null>(null);
  const [editingPlane, setEditingPlane] = useState<Plane | null>(null);
  const [editingItem, setEditingItem] = useState<DmCampaignItem | null>(null);

  const [pnName, setPnName] = useState("");
  const [pnDescription, setPnDescription] = useState("");
  const [pnQuestTags, setPnQuestTags] = useState<string[]>([]);
  const [pnLocationTags, setPnLocationTags] = useState<string[]>([]);

  const [itName, setItName] = useState("");
  const [itDescription, setItDescription] = useState("");
  const [itProperties, setItProperties] = useState("");
  const [itQuality, setItQuality] = useState("");
  const [itCategory, setItCategory] = useState("");
  const [itLootRole, setItLootRole] = useState<DmCampaignItemLootRole>("loot");
  const [itQuestTags, setItQuestTags] = useState<string[]>([]);
  const [itPeopleTags, setItPeopleTags] = useState<string[]>([]);

  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");

  const [qName, setQName] = useState("");
  const [qType, setQType] = useState<Quest["type"]>("side");
  const [qDescription, setQDescription] = useState("");
  const [qNotes, setQNotes] = useState("");

  const [pName, setPName] = useState("");
  const [pRole, setPRole] = useState("");
  const [pRelationship, setPRelationship] = useState<NpcPerson["relationship"]>("unknown");
  const [pDescription, setPDescription] = useState("");
  const [pNotes, setPNotes] = useState("");

  const [lName, setLName] = useState("");
  const [lDescription, setLDescription] = useState("");
  const [lNotes, setLNotes] = useState("");
  const [lParentLocationId, setLParentLocationId] = useState("");

  const [qLocationTags, setQLocationTags] = useState<string[]>([]);
  const [qLocationLinkModes, setQLocationLinkModes] = useState<Record<string, QuestLocationLinkMode>>({});
  const [qPeopleTags, setQPeopleTags] = useState<string[]>([]);
  const [pQuestTags, setPQuestTags] = useState<string[]>([]);
  const [pLocationTags, setPLocationTags] = useState<string[]>([]);

  const [parserText, setParserText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [applyingParser, setApplyingParser] = useState(false);
  const [parserSummary, setParserSummary] = useState<string | null>(null);
  const [parserError, setParserError] = useState<string | null>(null);
  const [parserResult, setParserResult] = useState<QuickUpdateResult | null>(null);
  const [parserQuestDrafts, setParserQuestDrafts] = useState<DraftQuestAction[]>([]);
  const [parserPersonDrafts, setParserPersonDrafts] = useState<DraftPersonAction[]>([]);
  const [parserLocationDrafts, setParserLocationDrafts] = useState<DraftLocationAction[]>([]);
  const [parserApplied, setParserApplied] = useState(false);
  const [parserTypeHint, setParserTypeHint] = useState<"" | Quest["type"]>("");
  const [parserIntentHint, setParserIntentHint] = useState<ParserIntent>("");

  const refresh = useCallback(async () => {
    const payload = await getDmNotesPayload();
    setNotes(payload.notes);
    setQuests(payload.quests);
    setPeople(payload.people);
    setLocations(payload.locations);
    setItems(payload.items ?? []);
    setPlanes(payload.planes ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sortedNotes = useMemo(() => [...notes].sort((a, b) => b.updatedAt - a.updatedAt), [notes]);
  const sortedQuests = useMemo(() => [...quests].sort((a, b) => b.createdAt - a.createdAt), [quests]);
  const sortedPeople = useMemo(() => [...people].sort((a, b) => b.createdAt - a.createdAt), [people]);
  const locationHierarchyEntries = useMemo(() => buildLocationHierarchy(locations), [locations]);
  const sortedLocations = locationHierarchyEntries;
  const blockedLocationParentIds = useMemo(() => {
    if (!editingLocation) return new Set<string>();
    return getLocationDescendantIds(editingLocation.id, locations);
  }, [editingLocation, locations]);
  const locationParentOptions = useMemo(() => (
    locationHierarchyEntries.filter(({ location }) => location.id !== editingLocation?.id && !blockedLocationParentIds.has(location.id))
  ), [blockedLocationParentIds, editingLocation, locationHierarchyEntries]);
  const locationById = useMemo(() => {
    const map = new Map<string, CampaignLocation>();
    locations.forEach((location) => {
      map.set(location.id, location);
    });
    return map;
  }, [locations]);
  const reviewBatches = getReviewBatches();

  const questNameById = useMemo(() => {
    const map: Record<string, string> = {};
    quests.forEach((q) => {
      map[q.id] = q.name;
    });
    return map;
  }, [quests]);
  const effectiveQuestLinks = useMemo(() => buildEffectiveLocationQuestLinks(quests, locations), [quests, locations]);

  const locationNameById = useMemo(() => {
    const map: Record<string, string> = {};
    locations.forEach((l) => {
      map[l.id] = l.name;
    });
    return map;
  }, [locations]);

  const personNameById = useMemo(() => {
    const map: Record<string, string> = {};
    people.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [people]);

  const peopleByQuestId = useMemo(() => {
    const map: Record<string, string[]> = {};
    people.forEach((p) => {
      (p.questTags ?? []).forEach((questId) => {
        map[questId] = map[questId] ?? [];
        if (!map[questId].includes(p.name)) map[questId].push(p.name);
      });
    });
    return map;
  }, [people]);

  const openNoteModal = (note?: Note) => {
    setEditingNote(note ?? null);
    setNTitle(note?.title ?? "");
    setNBody(note?.body ?? "");
    setShowNoteModal(true);
  };

  const openQuestModal = (quest?: Quest) => {
    setEditingQuest(quest ?? null);
    setQName(quest?.name ?? "");
    setQType(quest?.type ?? "side");
    setQDescription(quest?.description ?? "");
    setQNotes(quest?.notes ?? "");
    setQLocationTags(quest?.locationTags ?? []);
    setQLocationLinkModes(quest?.locationLinkModes ?? {});
    setQPeopleTags(quest?.peopleTags ?? []);
    setShowQuestModal(true);
  };

  const openPersonModal = (person?: NpcPerson) => {
    setEditingPerson(person ?? null);
    setPName(person?.name ?? "");
    setPRole(person?.role ?? "");
    setPRelationship(person?.relationship ?? "unknown");
    setPDescription(person?.description ?? "");
    setPNotes(person?.notes ?? "");
    setPQuestTags(person?.questTags ?? []);
    setPLocationTags(person?.locationTags ?? []);
    setShowPersonModal(true);
  };

  const openLocationModal = (location?: CampaignLocation) => {
    setEditingLocation(location ?? null);
    setLName(location?.name ?? "");
    setLDescription(location?.description ?? "");
    setLNotes(location?.notes ?? "");
    setLParentLocationId(location?.parentLocationId ?? "");
    setShowLocationModal(true);
  };

  const openPlaneModal = (plane?: Plane) => {
    setEditingPlane(plane ?? null);
    setPnName(plane?.name ?? "");
    setPnDescription(plane?.description ?? "");
    setPnQuestTags(plane?.questTags ?? []);
    setPnLocationTags(plane?.locationTags ?? []);
    setShowPlaneModal(true);
  };

  const openItemModal = (item?: DmCampaignItem) => {
    setEditingItem(item ?? null);
    setItName(item?.name ?? "");
    setItDescription(item?.description ?? "");
    setItProperties(item?.properties ?? "");
    setItQuality(item?.quality ?? "");
    setItCategory(item?.category ?? "");
    setItLootRole(item?.lootRole ?? "loot");
    setItQuestTags(item?.questTags ?? []);
    setItPeopleTags(item?.peopleTags ?? []);
    setShowItemModal(true);
  };

  const seedTestData = async () => {
    const now = Date.now();
    const questId = "seed_quest_001";
    const personId = "seed_person_001";
    const locationId = "seed_location_001";
    const planeId = "seed_plane_001";
    const itemQuestId = "seed_item_qi_001";
    const itemRewardId = "seed_item_rw_001";

    const data = await getDmNotesPayload();

    // Avoid duplicating seeds
    if (data.quests.some((q) => q.id === questId)) return;

    const seedQuest = {
      id: questId,
      name: "Shadows of the Past",
      type: "main" as const,
      status: "active" as const,
      description: "The party must investigate a ruined temple in the Shadowfell, where an exiled scholar named Mira may hold the key to stopping an ancient ritual.",
      locationTags: [locationId],
      peopleTags: [personId],
      createdAt: now,
      pinned: false,
    };
    const seedPerson = {
      id: personId,
      name: "Mira the Exile",
      role: "Scholar & Guide",
      relationship: "ally" as const,
      description: "A former court mage exiled to the Shadowfell after discovering forbidden knowledge. She knows the layout of the temple and can translate the ritual texts.",
      questTags: [questId],
      createdAt: now,
      pinned: false,
    };
    const seedLocation = {
      id: locationId,
      name: "The Ruined Temple of Keth",
      description: "An ancient crumbling temple deep in the Shadowfell, once dedicated to a forgotten god. Its inner sanctum still holds active ritual circles.",
      questTags: [questId],
      createdAt: now,
      pinned: false,
    };
    const seedPlane = {
      id: planeId,
      name: "The Shadowfell",
      description: "A dark mirror of the Material Plane, suffused with shadow energy and home to undead, dark fey, and wandering souls. The Ruined Temple of Keth lies here.",
      questTags: [questId],
      locationTags: [locationId],
      createdAt: now,
      pinned: false,
    };
    const seedQuestItem = {
      id: itemQuestId,
      name: "Ancient Medallion of Keth",
      quality: "Rare",
      category: "magic",
      description: "A tarnished silver medallion bearing a broken circle — the seal of the forgotten god Keth. Required to deactivate the ritual circle in the temple sanctum.",
      properties: "Quest item. Bearer is immune to the spectral binding effect inside the temple. Cannot be attuned.",
      lootRole: "quest_item" as const,
      questTags: [questId],
      locationTags: [locationId],
      createdAt: now,
      pinned: false,
    };
    const seedReward = {
      id: itemRewardId,
      name: "Shadowweave Cloak",
      quality: "Rare",
      category: "armor",
      subtype: "cloak",
      description: "A cloak woven from shadow essence. Mira offers this as payment for helping her return from the Shadowfell.",
      properties: "+1 to Stealth checks. Once per long rest, you may cast Pass Without Trace on yourself (no concentration). Requires attunement.",
      value: "2500",
      valueCurrency: "gp" as const,
      lootRole: "reward" as const,
      questTags: [questId],
      peopleTags: [personId],
      createdAt: now,
      pinned: false,
    };

    data.quests.unshift(seedQuest);
    data.people.unshift(seedPerson);
    data.locations.unshift(seedLocation);
    data.planes.unshift(seedPlane);
    data.items.unshift(seedQuestItem, seedReward);
    await saveDmNotesPayload(data);
    void refresh();
  };

  const confirm = (title: string, message: string, action: () => void, enabled = true) => {
    if (!enabled) {
      action();
      return;
    }
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" ? window.confirm(message) : true;
      if (ok) action();
      return;
    }
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: action },
    ]);
  };

  const applyParserResult = useCallback(async (result: QuickUpdateResult) => {
    const now = Date.now();
    const graph = result.questGraphResult;

    const locationByName = new Map(locations.map((l) => [normalizeKey(l.name), l]));
    const questByName = new Map(quests.map((q) => [normalizeKey(q.name), q]));
    const personByName = new Map(people.map((p) => [normalizeKey(p.name), p]));

    const personNamesByQuest = new Map<string, string[]>();
    const locationNamesByQuest = new Map<string, string[]>();
    for (const qa of result.questActions ?? []) {
      personNamesByQuest.set(normalizeKey(qa.name), [...new Set((qa.personNames ?? []).map((p) => p.trim()).filter(Boolean))]);
      locationNamesByQuest.set(normalizeKey(qa.name), [...new Set((qa.locationNames ?? []).map((l) => l.trim()).filter(Boolean))]);
    }

    for (const la of result.locationActions ?? []) {
      const key = normalizeKey(la.name);
      const existing = (la.locationId && locations.find((l) => l.id === la.locationId)) || locationByName.get(key);
      await upsertDmLocation({
        id: existing?.id,
        name: la.name,
        description: la.description ?? existing?.description,
        notes: existing?.notes,
        questTags: existing?.questTags ?? [],
        pinned: existing?.pinned,
        createdAt: existing?.createdAt ?? now,
      });
    }

    const refreshedAfterLocations = await getDmNotesPayload();
    const locationIdByName = new Map(refreshedAfterLocations.locations.map((l) => [normalizeKey(l.name), l.id]));
    const locationParentById = new Map<string, string>();
    const graphLocationCandidateByLocalKey = new Map(
      (graph?.entitiesToCreate ?? [])
        .filter((entity) => entity.kind === "location")
        .map((entity) => [entity.localKey, entity.name] as const)
    );

    const hasStrongGraphEvidence = (evidence: NonNullable<NonNullable<QuickUpdateResult["questGraphResult"]>["relationshipsToCreate"]>[number]["evidence"]): boolean => {
      if (!Array.isArray(evidence) || evidence.length === 0) return false;
      return evidence.some((entry) => entry.confidence === "high" || entry.confidence === "medium");
    };

    const resolveGraphLocationToken = (token: string): string | null => {
      if (refreshedAfterLocations.locations.some((location) => location.id === token)) return token;
      const candidateName = graphLocationCandidateByLocalKey.get(token);
      if (candidateName) return locationIdByName.get(normalizeKey(candidateName)) ?? null;
      return null;
    };

    for (const relationship of graph?.relationshipsToCreate ?? []) {
      if (relationship.reviewState === "ambiguous" || relationship.reviewState === "unsupported") continue;
      if (relationship.reviewState === "needs_review" && !hasStrongGraphEvidence(relationship.evidence)) continue;
      if (relationship.relationshipType !== "contained_in" && relationship.relationshipType !== "contains_location") continue;

      const fromId = resolveGraphLocationToken(relationship.fromEntityId);
      const toId = resolveGraphLocationToken(relationship.toEntityId);
      if (!fromId || !toId || fromId === toId) continue;

      const childId = relationship.relationshipType === "contained_in" ? fromId : toId;
      const parentId = relationship.relationshipType === "contained_in" ? toId : fromId;
      if (locationParentById.has(childId) && locationParentById.get(childId) !== parentId) continue;
      locationParentById.set(childId, parentId);
    }

    for (const qa of result.questActions ?? []) {
      const key = normalizeKey(qa.name);
      const existing = (qa.questId && quests.find((q) => q.id === qa.questId)) || questByName.get(key);
      const linkedLocationIds = (qa.locationNames ?? [])
        .map((name) => locationIdByName.get(normalizeKey(name)))
        .filter((id): id is string => !!id);
      const resolvedDescription = qa.description?.trim() || existing?.description || buildQuestDescriptionFallback(
        qa.name,
        parserText,
        result.summary,
        personNamesByQuest.get(key) ?? [],
        locationNamesByQuest.get(key) ?? []
      );

      await upsertDmQuest({
        id: existing?.id,
        name: qa.name,
        type: qa.type,
        status: qa.status,
        description: resolvedDescription,
        notes: qa.notes ?? existing?.notes,
        locationTags: [...new Set([...(existing?.locationTags ?? []), ...linkedLocationIds])],
        pinned: existing?.pinned,
        createdAt: existing?.createdAt ?? now,
      });
    }

    const refreshedAfterQuests = await getDmNotesPayload();
    const questIdByName = new Map(refreshedAfterQuests.quests.map((q) => [normalizeKey(q.name), q.id]));
    const peopleNamesByLocation = new Map<string, Set<string>>();

    for (const pa of result.personActions ?? []) {
      const key = normalizeKey(pa.name);
      const existing = (pa.personId && people.find((p) => p.id === pa.personId)) || personByName.get(key);
      const linkedQuestIds = (result.questActions ?? [])
        .filter((q) => (q.personNames ?? []).some((n) => normalizeKey(n) === key))
        .map((q) => questIdByName.get(normalizeKey(q.name)))
        .filter((id): id is string => !!id);

      const personLocations = new Set<string>();
      for (const qa of result.questActions ?? []) {
        if (!(qa.personNames ?? []).some((n) => normalizeKey(n) === key)) continue;
        for (const locName of qa.locationNames ?? []) {
          const normalizedLoc = normalizeKey(locName);
          if (!normalizedLoc) continue;
          personLocations.add(locName.trim());
          const existingPeople = peopleNamesByLocation.get(normalizedLoc) ?? new Set<string>();
          existingPeople.add(pa.name.trim());
          peopleNamesByLocation.set(normalizedLoc, existingPeople);
        }
      }
      const mergedNotes = upsertNetworkLine(pa.notes ?? existing?.notes, "Linked locations", [...personLocations]);

      await upsertDmPerson({
        id: existing?.id,
        name: pa.name,
        role: pa.role ?? existing?.role,
        relationship: pa.relationship,
        description: pa.description ?? existing?.description,
        notes: mergedNotes,
        questTags: [...new Set([...(existing?.questTags ?? []), ...linkedQuestIds])],
        pinned: existing?.pinned,
        createdAt: existing?.createdAt ?? now,
        deceased: existing?.deceased,
        deceasedNote: existing?.deceasedNote,
      });
    }

    const refreshedAfterPeople = await getDmNotesPayload();
    const questIdByNameAfterPeople = new Map(refreshedAfterPeople.quests.map((q) => [normalizeKey(q.name), q.id]));

    for (const location of refreshedAfterPeople.locations) {
      const locKey = normalizeKey(location.name);
      const linkedQuestIdsFromParser = (result.questActions ?? [])
        .filter((qa) => (qa.locationNames ?? []).some((locName) => normalizeKey(locName) === locKey))
        .map((qa) => questIdByNameAfterPeople.get(normalizeKey(qa.name)))
        .filter((id): id is string => !!id);

      const linkedPeopleNames = [...(peopleNamesByLocation.get(locKey) ?? new Set<string>())];
      const locationNotes = upsertNetworkLine(location.notes, "Linked people", linkedPeopleNames);

      await upsertDmLocation({
        ...location,
        notes: locationNotes,
        parentLocationId: locationParentById.get(location.id) ?? location.parentLocationId,
        questTags: [...new Set([...(location.questTags ?? []), ...linkedQuestIdsFromParser])],
      });
    }

    await refresh();
  }, [locations, quests, people, refresh, parserText]);

  const handleParseQuestText = useCallback(async () => {
    const text = parserText.trim();
    if (!text) {
      Alert.alert("Missing text", "Paste update text to parse first.");
      return;
    }

    setParsing(true);
    setParserError(null);
    setParserApplied(false);
    setParserResult(null);
    setParserSummary(null);
    try {
      const hints: string[] = [];
      if (parserTypeHint) hints.push(`Quest type hint: ${parserTypeHint}`);
      if (parserIntentHint) {
        const intentHint =
          parserIntentHint === "new"
            ? "create a new quest"
            : parserIntentHint === "active"
              ? "update an existing quest"
              : parserIntentHint === "completed"
                ? "mark as completed"
                : "mark as failed";
        hints.push(`Intent hint: ${intentHint}`);
      }
      const fullText = hints.length > 0 ? `[${hints.join(", ")}] ${text}` : text;

      const resp = await fetch(`${API_BASE_URL}/api/ai/parse-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullText,
          questContext: quests.map((q) => ({ id: q.id, name: q.name, status: q.status, type: q.type })),
          peopleContext: people.map((p) => ({ id: p.id, name: p.name, role: p.role })),
          locationContext: locations.map((l) => ({ id: l.id, name: l.name })),
        }),
      });

      const parsed = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error((parsed as { error?: string }).error || `Parse failed (${resp.status})`);
      }

      const result = parsed as QuickUpdateResult;
      const augmented = augmentQuickUpdateResult(result, text, quests, people, locations);
      const { questDrafts, personDrafts, locationDrafts } = buildDraftsFromResult(augmented);
      const questCount = questDrafts.length;
      const peopleCount = personDrafts.length;
      const locationCount = locationDrafts.length;
      const itemCount = result.proposedInventoryChanges?.filter((item) => item.quantity > 0).length ?? 0;
      setParserResult(augmented);
      setParserQuestDrafts(questDrafts);
      setParserPersonDrafts(personDrafts);
      setParserLocationDrafts(locationDrafts);
      setParserSummary(`${augmented.summary}\nDetected: ${questCount} quest(s), ${peopleCount} people, ${locationCount} location(s), ${itemCount} item(s).`);
    } catch (err: unknown) {
      setParserError(err instanceof Error ? err.message : "Failed to parse quest update text.");
    } finally {
      setParsing(false);
    }
  }, [parserText, parserTypeHint, parserIntentHint, quests, people, locations]);

  const handleApplyParsedResult = useCallback(async () => {
    if (!parserResult) return;
    setApplyingParser(true);
    setParserError(null);
    try {
      const questActionsBase: QuestAction[] = parserQuestDrafts.map((q) => ({
        ...q,
        personNames: uniq(q.linkedPersonNames),
        locationNames: uniq(q.linkedLocationNames),
      }));
      const questByName = new Map(questActionsBase.map((q, i) => [normalizeKey(q.name), i]));
      const questActions = [...questActionsBase];

      for (const person of parserPersonDrafts) {
        for (const questName of person.linkedQuestNames) {
          const idx = questByName.get(normalizeKey(questName));
          if (idx === undefined) continue;
          const target = questActions[idx];
          target.personNames = uniq([...(target.personNames ?? []), person.name]);
          target.locationNames = uniq([...(target.locationNames ?? []), ...person.linkedLocationNames]);
        }
      }
      for (const location of parserLocationDrafts) {
        for (const questName of location.linkedQuestNames) {
          const idx = questByName.get(normalizeKey(questName));
          if (idx === undefined) continue;
          const target = questActions[idx];
          target.locationNames = uniq([...(target.locationNames ?? []), location.name]);
          target.personNames = uniq([...(target.personNames ?? []), ...location.linkedPersonNames]);
        }
      }

      const personActions: PersonAction[] = parserPersonDrafts.map((p) => ({
        action: p.action,
        personId: p.personId,
        name: p.name,
        role: p.role,
        relationship: p.relationship,
        description: p.description,
        notes: upsertNetworkLine(p.notes ?? undefined, "Linked locations", p.linkedLocationNames) ?? null,
      }));
      const locationActions: LocationAction[] = parserLocationDrafts.map((l) => ({
        action: l.action,
        locationId: l.locationId,
        name: l.name,
        description: l.description,
      }));

      const mergedResult: QuickUpdateResult = {
        ...parserResult,
        questActions,
        personActions,
        locationActions,
      };

      await applyParserResult(mergedResult);
      const hasLootItems = (mergedResult.proposedInventoryChanges ?? []).some((item) => item.quantity > 0);
      if (hasLootItems) {
        const itemsOnlyData = {
          ...mergedResult,
          proposedHpChange: null,
          proposedCurrencyChange: null,
          proposedResourceChanges: [],
        };
        router.push({
          pathname: "/loot-review",
          params: {
            source: "text",
            data: JSON.stringify(itemsOnlyData),
          },
        });
      }
      setParserApplied(true);
    } catch (err: unknown) {
      setParserError(err instanceof Error ? err.message : "Failed to apply parser result.");
    } finally {
      setApplyingParser(false);
    }
  }, [applyParserResult, parserLocationDrafts, parserPersonDrafts, parserQuestDrafts, parserResult]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["bottom"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/landing"))} style={[styles.backBtn, { backgroundColor: c.card, borderColor: c.border }]}>
          <Feather name="arrow-left" size={14} color={c.foreground} />
          <Text style={{ color: c.foreground, fontWeight: "700", fontSize: 13 }}>Back to DM Tools</Text>
        </TouchableOpacity>
      </View>

      <ScrollHintScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <View style={[styles.headerCard, { borderColor: c.border, backgroundColor: c.card }]}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: c.foreground }}>DM Notes</Text>
          <Text style={{ fontSize: 12, color: c.mutedForeground }}>
            Build quest, people, and location notes just like player notes, then send them from Party Observer.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {([
            { id: "notes" as TabId, label: "Notes", icon: "book-open" },
            { id: "quests" as TabId, label: "Quests", icon: "flag" },
            { id: "parser" as TabId, label: "Quest Parser", icon: "cpu" },
            { id: "people" as TabId, label: "People", icon: "users" },
            { id: "locations" as TabId, label: "Locations", icon: "map-pin" },
            { id: "items" as TabId, label: "Items", icon: "package" },
            { id: "planes" as TabId, label: "Planes", icon: "globe" },
          ]).map((entry) => (
            <TouchableOpacity
              key={entry.id}
              onPress={() => setTab(entry.id)}
              style={[
                styles.tabBtn,
                {
                  borderColor: tab === entry.id ? c.primary : c.border,
                  backgroundColor: tab === entry.id ? c.primary + "22" : c.card,
                },
              ]}
            >
              <Feather name={entry.icon as any} size={13} color={tab === entry.id ? c.primary : c.mutedForeground} />
              <Text style={{ fontSize: 12, color: tab === entry.id ? c.primary : c.mutedForeground, fontWeight: "700" }}>{entry.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {tab === "notes" && (
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => openNoteModal()} style={[styles.primaryBtn, { backgroundColor: c.primary }]}>
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.primaryBtnText}>New Note</Text>
            </TouchableOpacity>
            {sortedNotes.map((note) => (
              <View key={note.id} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.background }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 14, color: c.foreground, fontWeight: "700" }}>{note.title}</Text>
                  <Text numberOfLines={2} style={{ fontSize: 11, color: c.mutedForeground }}>{note.body || "(empty note)"}</Text>
                </View>
                <TouchableOpacity onPress={() => openNoteModal(note)} style={[styles.rowBtn, { borderColor: c.border }]}>
                  <Feather name="edit-3" size={13} color={c.foreground} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirm("Delete Note", `Delete ${note.title}?`, () => {
                    void deleteDmNote(note.id).then(refresh);
                  }, settings.confirmDmDeleteActions)}
                  style={[styles.rowBtn, { borderColor: "#f87171" + "66" }]}
                >
                  <Feather name="trash-2" size={13} color="#f87171" />
                </TouchableOpacity>
              </View>
            ))}
            {sortedNotes.length === 0 && (
              <Text style={{ fontSize: 12, color: c.mutedForeground }}>No DM notes yet. Add one to start planning sessions.</Text>
            )}
          </View>
        )}

        {tab === "quests" && (
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => openQuestModal()} style={[styles.primaryBtn, { backgroundColor: c.primary }]}>
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.primaryBtnText}>New Quest</Text>
            </TouchableOpacity>
            {sortedQuests.map((quest) => (
              <View key={quest.id} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.background }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 14, color: c.foreground, fontWeight: "700" }}>{quest.name}</Text>
                  <Text style={{ fontSize: 11, color: c.mutedForeground }}>{quest.type.toUpperCase()} · {quest.status.toUpperCase()}</Text>
                  {quest.description ? (
                    <Text numberOfLines={2} style={{ fontSize: 11, color: c.mutedForeground }}>{quest.description}</Text>
                  ) : null}
                  {(quest.locationTags?.length ?? 0) > 0 && (
                    <Text style={{ fontSize: 11, color: c.primary }}>
                      Locations: {(quest.locationTags ?? []).map((id) => locationNameById[id] || "Unknown").join(", ")}
                    </Text>
                  )}
                  {(quest.peopleTags ?? []).filter(id => personNameById[id]).length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                      {(quest.peopleTags ?? [])
                        .filter(id => personNameById[id])
                        .map(id => (
                          <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderColor: c.primary + "50", backgroundColor: c.primary + "15" }}>
                            <Feather name="user" size={9} color={c.primary} />
                            <Text style={{ fontSize: 10, fontWeight: "600", color: c.primary }}>{personNameById[id]}</Text>
                          </View>
                        ))}
                    </View>
                  )}
                  {(quest.peopleTags ?? []).filter(id => personNameById[id]).length === 0 && (peopleByQuestId[quest.id]?.length ?? 0) > 0 && (
                    <Text style={{ fontSize: 11, color: c.primary }}>
                      People: {(peopleByQuestId[quest.id] ?? []).join(", ")}
                    </Text>
                  )}
                  {quest.notes ? (
                    <Text numberOfLines={2} style={{ fontSize: 11, color: c.mutedForeground }}>{quest.notes}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => openQuestModal(quest)} style={[styles.rowBtn, { borderColor: c.border }]}>
                  <Feather name="edit-3" size={13} color={c.foreground} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirm("Delete Quest", `Delete ${quest.name}?`, () => {
                    void deleteDmQuest(quest.id).then(refresh);
                  }, settings.confirmDmDeleteActions)}
                  style={[styles.rowBtn, { borderColor: "#f87171" + "66" }]}
                >
                  <Feather name="trash-2" size={13} color="#f87171" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {tab === "people" && (
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => openPersonModal()} style={[styles.primaryBtn, { backgroundColor: c.primary }]}>
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.primaryBtnText}>New Person</Text>
            </TouchableOpacity>
            {sortedPeople.map((person) => (
              <View key={person.id} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.background }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 14, color: c.foreground, fontWeight: "700" }}>{person.name}</Text>
                  <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                    {(person.role || "No role")} · {(person.relationship || "unknown").toUpperCase()}
                  </Text>
                  {person.questTags.filter((id) => questNameById[id]).length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                      {person.questTags
                        .filter((id) => questNameById[id])
                        .map((id) => (
                          <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderColor: c.primary + "50", backgroundColor: c.primary + "15" }}>
                            <Feather name="flag" size={9} color={c.primary} />
                            <Text style={{ fontSize: 10, fontWeight: "600", color: c.primary }}>{questNameById[id]}</Text>
                          </View>
                        ))}
                    </View>
                  )}
                  {(person.locationTags ?? []).filter((id) => locationNameById[id]).length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                      {(person.locationTags ?? [])
                        .filter((id) => locationNameById[id])
                        .map((id) => (
                          <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderColor: "#F59E0B50", backgroundColor: "#F59E0B15" }}>
                            <Feather name="map-pin" size={9} color="#F59E0B" />
                            <Text style={{ fontSize: 10, fontWeight: "600", color: "#F59E0B" }}>{locationNameById[id]}</Text>
                          </View>
                        ))}
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => openPersonModal(person)} style={[styles.rowBtn, { borderColor: c.border }]}>
                  <Feather name="edit-3" size={13} color={c.foreground} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirm("Delete Person", `Delete ${person.name}?`, () => {
                    void deleteDmPerson(person.id).then(refresh);
                  }, settings.confirmDmDeleteActions)}
                  style={[styles.rowBtn, { borderColor: "#f87171" + "66" }]}
                >
                  <Feather name="trash-2" size={13} color="#f87171" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {tab === "locations" && (
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => openLocationModal()} style={[styles.primaryBtn, { backgroundColor: c.primary }]}>
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.primaryBtnText}>New Location</Text>
            </TouchableOpacity>
            {sortedLocations.map((entry) => {
              const location = entry.location;
              const directQuestIds = effectiveQuestLinks.get(location.id)?.directQuestIds ?? [];
              const inheritedQuestIds = effectiveQuestLinks.get(location.id)?.inheritedQuestIds ?? [];
              return (
              <View key={location.id} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.background, marginLeft: Math.min(entry.depth * 14, 42) }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 14, color: c.foreground, fontWeight: "700" }}>{location.name}</Text>
                  {entry.parentBreadcrumb ? <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "600" }}>In {entry.parentBreadcrumb}</Text> : null}
                  {location.description ? <Text style={{ fontSize: 11, color: c.mutedForeground }}>{location.description}</Text> : null}
                  {(directQuestIds.length > 0 || inheritedQuestIds.length > 0) && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                      {directQuestIds
                        .filter((id) => questNameById[id])
                        .map((id) => (
                          <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderColor: c.primary + "50", backgroundColor: c.primary + "15" }}>
                            <Feather name="flag" size={9} color={c.primary} />
                            <Text style={{ fontSize: 10, fontWeight: "600", color: c.primary }}>{questNameById[id]}</Text>
                          </View>
                        ))}
                      {inheritedQuestIds
                        .filter((id) => questNameById[id])
                        .map((id) => (
                          <View key={`inherited-${id}`} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderColor: c.mutedForeground + "44", backgroundColor: c.mutedForeground + "14" }}>
                            <Feather name="corner-down-right" size={9} color={c.mutedForeground} />
                            <Text style={{ fontSize: 10, fontWeight: "600", color: c.mutedForeground }}>{questNameById[id]} [Inherited]</Text>
                          </View>
                        ))}
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => openLocationModal(location)} style={[styles.rowBtn, { borderColor: c.border }]}>
                  <Feather name="edit-3" size={13} color={c.foreground} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirm("Delete Location", `Delete ${location.name}?`, () => {
                    void deleteDmLocation(location.id).then(refresh);
                  }, settings.confirmDmDeleteActions)}
                  style={[styles.rowBtn, { borderColor: "#f87171" + "66" }]}
                >
                  <Feather name="trash-2" size={13} color="#f87171" />
                </TouchableOpacity>
              </View>
            )})}
          </View>
        )}

        {tab === "items" && (
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
              Saved items can be edited here after using Item Creator.
            </Text>
            {items.length === 0 ? (
              <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
                No items saved yet. Use the Item Creator and save items to DM Notes via the Quest Tie-In tab.
              </Text>
            ) : (
              items.map((dmItem) => {
                const linkedQuestNames = (dmItem.questTags ?? []).map((id: string) => quests.find((q) => q.id === id)?.name).filter(Boolean);
                const linkedPeopleNames = (dmItem.peopleTags ?? []).map((id: string) => people.find((p) => p.id === id)?.name).filter(Boolean);
                const lootRoleLabels: Record<string, string> = { quest_item: "Quest Item", reward: "Reward", loot: "Loot", other: "Other" };
                return (
                  <View key={dmItem.id} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.background }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Text style={{ fontSize: 14, color: c.foreground, fontWeight: "700" }}>{dmItem.name}</Text>
                        {dmItem.lootRole && (
                          <View style={{ borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: c.primary + "22" }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: c.primary }}>{lootRoleLabels[dmItem.lootRole] ?? dmItem.lootRole}</Text>
                          </View>
                        )}
                        {dmItem.quality && (
                          <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "600" }}>{dmItem.quality}{dmItem.category ? ` · ${dmItem.category}` : ""}</Text>
                        )}
                      </View>
                      {dmItem.description ? <Text style={{ fontSize: 11, color: c.mutedForeground }}>{dmItem.description}</Text> : null}
                      {dmItem.properties ? <Text style={{ fontSize: 11, color: c.foreground, fontStyle: "italic" }}>{dmItem.properties}</Text> : null}
                      {(dmItem.value || dmItem.weight) ? (
                        <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                          {dmItem.value ? `${dmItem.value} ${dmItem.valueCurrency ?? "gp"}` : ""}
                          {dmItem.value && dmItem.weight ? "  ·  " : ""}
                          {dmItem.weight ? `${dmItem.weight} lbs` : ""}
                        </Text>
                      ) : null}
                      {linkedQuestNames.length > 0 && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                          {linkedQuestNames.map((name: string | undefined, i: number) => (
                            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderColor: c.primary + "50", backgroundColor: c.primary + "15" }}>
                              <Feather name="flag" size={9} color={c.primary} />
                              <Text style={{ fontSize: 10, fontWeight: "600", color: c.primary }}>{name}</Text>
                            </View>
                          ))}
                          {linkedPeopleNames.map((name: string | undefined, i: number) => (
                            <View key={`p${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderColor: c.mutedForeground + "44", backgroundColor: c.mutedForeground + "14" }}>
                              <Feather name="user" size={9} color={c.mutedForeground} />
                              <Text style={{ fontSize: 10, fontWeight: "600", color: c.mutedForeground }}>{name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => openItemModal(dmItem)} style={[styles.rowBtn, { borderColor: c.border }]}> 
                      <Feather name="edit-3" size={13} color={c.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert("Delete Item", `Delete "${dmItem.name}"?`, [
                          { text: "Cancel", style: "cancel" },
                          { text: "Delete", style: "destructive", onPress: async () => { await deleteDmItem(dmItem.id); void refresh(); } },
                        ]);
                      }}
                      style={[styles.rowBtn, { borderColor: "#f87171" + "55" }]}
                    >
                      <Feather name="trash-2" size={13} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {tab === "planes" && (
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: c.foreground }}>Campaign Planes</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {planes.length === 0 && quests.length === 0 && people.length === 0 && locations.length === 0 && (
                  <TouchableOpacity
                    onPress={() => { void seedTestData(); }}
                    style={[styles.chip, { borderColor: "#22c55e88", backgroundColor: "#22c55e14" }]}
                  >
                    <Feather name="zap" size={12} color="#22c55e" />
                    <Text style={{ color: "#22c55e", fontWeight: "700", fontSize: 12 }}>Load Test Data</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowPlanePickerModal(true)}
                  style={[styles.chip, { borderColor: c.primary + "88", backgroundColor: c.primary + "14" }]}
                >
                  <Feather name="plus" size={12} color={c.primary} />
                  <Text style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}>Add Plane</Text>
                </TouchableOpacity>
              </View>
            </View>
            {planes.length === 0 ? (
              <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
                No planes defined yet. Add planes from your campaign setting here, or use "Load Test Data" to seed sample linked data.
              </Text>
            ) : (
              planes.map((plane) => {
                const linkedQuestNames = plane.questTags.map((id) => quests.find((q) => q.id === id)?.name).filter(Boolean);
                const linkedLocationNames = plane.locationTags.map((id) => locations.find((l) => l.id === id)?.name).filter(Boolean);
                return (
                  <View key={plane.id} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.background }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 14, color: c.foreground, fontWeight: "700" }}>{plane.name}</Text>
                      {plane.description ? <Text style={{ fontSize: 11, color: c.mutedForeground }}>{plane.description}</Text> : null}
                      {(linkedQuestNames.length > 0 || linkedLocationNames.length > 0) && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                          {linkedQuestNames.map((name, i) => (
                            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderColor: c.primary + "50", backgroundColor: c.primary + "15" }}>
                              <Feather name="flag" size={9} color={c.primary} />
                              <Text style={{ fontSize: 10, fontWeight: "600", color: c.primary }}>{name}</Text>
                            </View>
                          ))}
                          {linkedLocationNames.map((name, i) => (
                            <View key={"l" + i} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderColor: "#F59E0B66", backgroundColor: "#F59E0B15" }}>
                              <Feather name="map-pin" size={9} color="#F59E0B" />
                              <Text style={{ fontSize: 10, fontWeight: "600", color: "#F59E0B" }}>{name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => openPlaneModal(plane)} style={[styles.rowBtn, { borderColor: c.border }]}>
                      <Feather name="edit-3" size={13} color={c.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirm("Delete Plane", `Delete "${plane.name}"?`, () => {
                        void deleteDmPlane(plane.id).then(refresh);
                      }, settings.confirmDmDeleteActions)}
                      style={[styles.rowBtn, { borderColor: "#f87171" + "55" }]}
                    >
                      <Feather name="trash-2" size={13} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {tab === "parser" && (
          <View style={[styles.section, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={{ fontSize: 14, color: c.foreground, fontWeight: "700" }}>Complex Quest Parser</Text>
            <Text style={{ fontSize: 12, color: c.mutedForeground }}>
              Paste narrative or session notes. Parse first, review the result, then apply when ready.
            </Text>
            {reviewBatches.length > 0 && (
              <View style={[styles.previewBox, { borderColor: c.border, backgroundColor: c.background }]}>
                <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>Deferred Graph Review Queue</Text>
                {reviewBatches.map((batch) => (
                  <View key={batch.batchId} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.card, alignItems: "flex-start", flexDirection: "column" }]}>
                    <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>
                      {batch.sourceType === "loot_review" ? "Loot review" : "Quick update"} · {batch.status}
                    </Text>
                    <Text style={{ fontSize: 11, color: c.mutedForeground }} numberOfLines={2}>{batch.rawInputSummary}</Text>
                    {batch.operations.map((op) => {
                      const relationshipSnapshot = op.payloadSnapshot as {
                        relationshipType?: string;
                        fromEntityId?: string;
                        toEntityId?: string;
                        label?: string;
                      } | null;
                      const containmentEndpoints = getContainmentEndpoints(relationshipSnapshot);
                      const isContainmentRelationship = op.section === "relationship" && (
                        relationshipSnapshot?.relationshipType === "contained_in" || relationshipSnapshot?.relationshipType === "contains_location"
                      );
                      const childLocation = containmentEndpoints ? locationById.get(containmentEndpoints.childId) : undefined;
                      const parsedParentLocation = containmentEndpoints ? locationById.get(containmentEndpoints.parentId) : undefined;
                      const blockedParentIds = childLocation ? getLocationDescendantIds(childLocation.id, locations) : new Set<string>();
                      const containmentParentOptions = childLocation
                        ? locationHierarchyEntries.filter(({ location }) => location.id !== childLocation.id && !blockedParentIds.has(location.id))
                        : [];
                      const replaySupported = op.section === "inventory_link" || isContainmentRelationship;
                      const canApproveInventory = op.section === "inventory_link" && op.resolutionState === "pending";
                      const canRetryInventory = op.section === "inventory_link" && op.resolutionState === "failed";
                      const canApproveContainment = isContainmentRelationship && op.resolutionState === "pending";
                      const canRetryContainment = isContainmentRelationship && op.resolutionState === "failed";
                      const containmentLabel = isContainmentRelationship
                        ? `${relationshipSnapshot?.relationshipType}: ${relationshipSnapshot?.fromEntityId} -> ${relationshipSnapshot?.toEntityId}`
                        : null;
                      const canReject = op.resolutionState === "pending" || canRetryInventory || canRetryContainment;
                      return (
                        <View key={op.operationId} style={{ width: "100%", borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, marginTop: 8, gap: 6 }}>
                          <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>{op.section} · {op.resolutionState}</Text>
                          <Text style={{ fontSize: 11, color: c.mutedForeground }}>{op.detail}</Text>
                          {containmentLabel ? (
                            <Text style={{ fontSize: 11, color: c.mutedForeground }}>Containment: {containmentLabel}</Text>
                          ) : null}
                          {isContainmentRelationship ? (
                            <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                              {childLocation ? `Child: ${childLocation.name}` : `Child token: ${containmentEndpoints?.childId ?? "unknown"}`}
                              {parsedParentLocation ? ` · Parsed parent: ${parsedParentLocation.name}` : containmentEndpoints?.parentId ? ` · Parsed parent token: ${containmentEndpoints.parentId}` : ""}
                            </Text>
                          ) : null}
                          {!replaySupported ? (
                            <Text style={{ fontSize: 11, color: c.mutedForeground }}>Deferred only: replay for this operation type is not supported yet.</Text>
                          ) : null}
                          {op.failureReason ? (
                            <Text style={{ fontSize: 11, color: "#f87171" }}>{op.failureReason}</Text>
                          ) : null}
                          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                            {canApproveInventory ? (
                              <TouchableOpacity
                                onPress={() => resolveDeferredOperation(batch.batchId, op.operationId, { action: "apply_inventory_link" })}
                                style={[styles.rowBtn, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                              >
                                <Feather name="check" size={13} color={c.foreground} />
                                <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>Approve</Text>
                              </TouchableOpacity>
                            ) : null}
                            {canRetryInventory ? (
                              <TouchableOpacity
                                onPress={() => resolveDeferredOperation(batch.batchId, op.operationId, { action: "apply_inventory_link" })}
                                style={[styles.rowBtn, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                              >
                                <Feather name="rotate-cw" size={13} color={c.foreground} />
                                <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>Retry</Text>
                              </TouchableOpacity>
                            ) : null}
                            {canApproveContainment ? (
                              <TouchableOpacity
                                onPress={() => resolveDeferredOperation(batch.batchId, op.operationId, {
                                  action: "apply_location_parent",
                                  targetEntityId: childLocation?.id ?? containmentEndpoints?.childId,
                                  resolvedEntityId: parsedParentLocation?.id ?? containmentEndpoints?.parentId,
                                })}
                                style={[styles.rowBtn, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                              >
                                <Feather name="corner-down-right" size={13} color={c.foreground} />
                                <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>Apply Parent</Text>
                              </TouchableOpacity>
                            ) : null}
                            {canRetryContainment ? (
                              <TouchableOpacity
                                onPress={() => resolveDeferredOperation(batch.batchId, op.operationId, {
                                  action: "apply_location_parent",
                                  targetEntityId: childLocation?.id ?? containmentEndpoints?.childId,
                                  resolvedEntityId: parsedParentLocation?.id ?? containmentEndpoints?.parentId,
                                })}
                                style={[styles.rowBtn, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                              >
                                <Feather name="rotate-cw" size={13} color={c.foreground} />
                                <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>Retry Parent</Text>
                              </TouchableOpacity>
                            ) : null}
                            {(canApproveContainment || canRetryContainment) ? (
                              <TouchableOpacity
                                onPress={() => resolveDeferredOperation(batch.batchId, op.operationId, {
                                  action: "keep_location_unparented",
                                  targetEntityId: childLocation?.id ?? containmentEndpoints?.childId,
                                })}
                                style={[styles.rowBtn, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                              >
                                <Feather name="minus-circle" size={13} color={c.foreground} />
                                <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>Keep Separate</Text>
                              </TouchableOpacity>
                            ) : null}
                            {canReject ? (
                              <TouchableOpacity
                                onPress={() => resolveDeferredOperation(batch.batchId, op.operationId, { action: "reject" })}
                                style={[styles.rowBtn, { borderColor: "#f87171" + "66", flexDirection: "row", alignItems: "center", gap: 6 }]}
                              >
                                <Feather name="x" size={13} color="#f87171" />
                                <Text style={{ fontSize: 11, color: "#f87171", fontWeight: "700" }}>Reject</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                          {(canApproveContainment || canRetryContainment) && childLocation && containmentParentOptions.length > 0 ? (
                            <View style={{ gap: 6 }}>
                              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>Override parent</Text>
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                {containmentParentOptions.map((entry) => (
                                  <TouchableOpacity
                                    key={`${op.operationId}-${entry.location.id}`}
                                    onPress={() => resolveDeferredOperation(batch.batchId, op.operationId, {
                                      action: "apply_location_parent",
                                      targetEntityId: childLocation.id,
                                      resolvedEntityId: entry.location.id,
                                    })}
                                    style={[
                                      styles.chip,
                                      {
                                        borderColor: c.border,
                                        backgroundColor: parsedParentLocation?.id === entry.location.id ? c.primary + "20" : c.card,
                                        marginLeft: Math.min(entry.depth * 12, 36),
                                      },
                                    ]}
                                  >
                                    <Text style={{ color: parsedParentLocation?.id === entry.location.id ? c.primary : c.foreground, fontWeight: "700", fontSize: 11 }}>
                                      {entry.location.name}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    {(() => {
                      const hasApprovedReplayableOps = batch.operations.some(
                        (op) =>
                          op.resolutionState === "approved" && (
                            op.section === "inventory_link" ||
                            (op.section === "relationship" && ((op.payloadSnapshot as { relationshipType?: string } | null)?.relationshipType === "contained_in" || (op.payloadSnapshot as { relationshipType?: string } | null)?.relationshipType === "contains_location"))
                          )
                      );
                      return (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        onPress={() => applyResolvedOperations(batch.batchId)}
                        disabled={!hasApprovedReplayableOps}
                        style={[styles.rowBtn, { borderColor: c.border, opacity: hasApprovedReplayableOps ? 1 : 0.5, flexDirection: "row", alignItems: "center", gap: 6 }]}
                      >
                        <Feather name="play" size={13} color={c.foreground} />
                        <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>Apply Approved</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => markBatchArchived(batch.batchId)}
                        style={[styles.rowBtn, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                      >
                        <Feather name="archive" size={13} color={c.foreground} />
                        <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>Archive</Text>
                      </TouchableOpacity>
                    </View>
                      );
                    })()}
                  </View>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", marginTop: 4 }}>QUEST TYPE (optional)</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {PARSER_QUEST_TYPE_OPTIONS.map((opt) => {
                const selected = parserTypeHint === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setParserTypeHint(selected ? "" : opt.value)}
                    style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + "20" : c.card }]}
                  >
                    <Text style={{ color: selected ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>INTENT (optional)</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {PARSER_INTENT_OPTIONS.map((opt) => {
                const selected = parserIntentHint === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setParserIntentHint(selected ? "" : opt.value)}
                    style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + "20" : c.card }]}
                  >
                    <Text style={{ color: selected ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              value={parserText}
              onChangeText={(text) => {
                setParserText(text);
                setParserResult(null);
                setParserQuestDrafts([]);
                setParserPersonDrafts([]);
                setParserLocationDrafts([]);
                setParserSummary(null);
                setParserApplied(false);
                setParserError(null);
              }}
              multiline
              placeholder="Example: We accepted a side quest from Captain Verin to clear the Silk Caves near Greymoor..."
              placeholderTextColor={c.mutedForeground}
              style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.background, minHeight: 180 }]}
            />
            <TouchableOpacity
              onPress={() => void handleParseQuestText()}
              disabled={parsing}
              style={[styles.primaryBtn, { backgroundColor: c.primary, opacity: parsing ? 0.7 : 1 }]}
            >
              {parsing ? <ActivityIndicator color="#fff" /> : <Feather name="cpu" size={14} color="#fff" />}
              <Text style={styles.primaryBtnText}>{parsing ? "Parsing..." : "Parse with AI"}</Text>
            </TouchableOpacity>
            {!!parserError && (
              <View style={[styles.errorBox, { borderColor: "#ef444455", backgroundColor: "#ef444422" }]}>
                <Feather name="alert-circle" size={14} color="#ef4444" />
                <Text style={{ fontSize: 12, color: "#ef4444", flex: 1 }}>{parserError}</Text>
              </View>
            )}
            {!!parserSummary && (
              <View style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.background }]}>
                <Text style={{ fontSize: 12, color: c.foreground, lineHeight: 18 }}>{parserSummary}</Text>
              </View>
            )}
            {!!parserResult && (
              <View style={[styles.previewBox, { borderColor: c.border, backgroundColor: c.background }]}>
                <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>Review & Edit Parsed Items</Text>

                {parserQuestDrafts.map((qa, idx) => (
                  <View key={`qa_${idx}`} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.card, alignItems: "flex-start", flexDirection: "column" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name="flag" size={13} color="#8B5CF6" />
                      <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>
                        {qa.action === "create" ? "New quest" : "Update quest"}
                      </Text>
                    </View>
                    <TextInput
                      value={qa.name}
                      onChangeText={(value) => setParserQuestDrafts((prev) => prev.map((item, i) => i === idx ? { ...item, name: value } : item))}
                      placeholder="Quest name"
                      placeholderTextColor={c.mutedForeground}
                      style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background, width: "100%" }]}
                    />
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      {(["main", "side", "personal"] as const).map((type) => (
                        <TouchableOpacity
                          key={`${qa.name}-type-${type}`}
                          onPress={() => setParserQuestDrafts((prev) => prev.map((item, i) => i === idx ? { ...item, type } : item))}
                          style={[styles.chip, { borderColor: qa.type === type ? c.primary : c.border, backgroundColor: qa.type === type ? c.primary + "20" : c.background }]}
                        >
                          <Text style={{ color: qa.type === type ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 11 }}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                      {(["active", "completed", "failed"] as const).map((status) => (
                        <TouchableOpacity
                          key={`${qa.name}-status-${status}`}
                          onPress={() => setParserQuestDrafts((prev) => prev.map((item, i) => i === idx ? { ...item, status } : item))}
                          style={[styles.chip, { borderColor: qa.status === status ? c.primary : c.border, backgroundColor: qa.status === status ? c.primary + "20" : c.background }]}
                        >
                          <Text style={{ color: qa.status === status ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 11 }}>{status}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      value={qa.description ?? ""}
                      onChangeText={(value) => setParserQuestDrafts((prev) => prev.map((item, i) => i === idx ? { ...item, description: value } : item))}
                      placeholder="Quest description"
                      placeholderTextColor={c.mutedForeground}
                      multiline
                      style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.background, width: "100%", minHeight: 80 }]}
                    />
                    <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>Link People</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {[...new Set([...parserPersonDrafts.map((p) => p.name), ...people.map((p) => p.name)])].map((name) => {
                        const selected = qa.linkedPersonNames.some((value) => normalizeKey(value) === normalizeKey(name));
                        return (
                          <TouchableOpacity
                            key={`${qa.name}-person-${name}`}
                            onPress={() => setParserQuestDrafts((prev) => prev.map((item, i) => {
                              if (i !== idx) return item;
                              const has = item.linkedPersonNames.some((value) => normalizeKey(value) === normalizeKey(name));
                              return { ...item, linkedPersonNames: has ? item.linkedPersonNames.filter((value) => normalizeKey(value) !== normalizeKey(name)) : [...item.linkedPersonNames, name] };
                            }))}
                            style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + "20" : c.background }]}
                          >
                            <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>{name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>Link Locations</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {[...new Set([...parserLocationDrafts.map((l) => l.name), ...locations.map((l) => l.name)])].map((name) => {
                        const selected = qa.linkedLocationNames.some((value) => normalizeKey(value) === normalizeKey(name));
                        return (
                          <TouchableOpacity
                            key={`${qa.name}-location-${name}`}
                            onPress={() => setParserQuestDrafts((prev) => prev.map((item, i) => {
                              if (i !== idx) return item;
                              const has = item.linkedLocationNames.some((value) => normalizeKey(value) === normalizeKey(name));
                              return { ...item, linkedLocationNames: has ? item.linkedLocationNames.filter((value) => normalizeKey(value) !== normalizeKey(name)) : [...item.linkedLocationNames, name] };
                            }))}
                            style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + "20" : c.background }]}
                          >
                            <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>{name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {parserPersonDrafts.map((pa, idx) => (
                  <View key={`pa_${idx}`} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.card, alignItems: "flex-start", flexDirection: "column" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name="user" size={13} color="#3B82F6" />
                      <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>
                        {pa.action === "create" ? "New person" : "Update person"}
                      </Text>
                    </View>
                    <TextInput value={pa.name} onChangeText={(value) => setParserPersonDrafts((prev) => prev.map((item, i) => i === idx ? { ...item, name: value } : item))} placeholder="Name" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background, width: "100%" }]} />
                    <TextInput value={pa.role ?? ""} onChangeText={(value) => setParserPersonDrafts((prev) => prev.map((item, i) => i === idx ? { ...item, role: value } : item))} placeholder="Role" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background, width: "100%" }]} />
                    <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>Link Locations</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {[...new Set([...parserLocationDrafts.map((l) => l.name), ...locations.map((l) => l.name)])].map((name) => {
                        const selected = pa.linkedLocationNames.some((value) => normalizeKey(value) === normalizeKey(name));
                        return (
                          <TouchableOpacity
                            key={`${pa.name}-location-${name}`}
                            onPress={() => setParserPersonDrafts((prev) => prev.map((item, i) => {
                              if (i !== idx) return item;
                              const has = item.linkedLocationNames.some((value) => normalizeKey(value) === normalizeKey(name));
                              return { ...item, linkedLocationNames: has ? item.linkedLocationNames.filter((value) => normalizeKey(value) !== normalizeKey(name)) : [...item.linkedLocationNames, name] };
                            }))}
                            style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + "20" : c.background }]}
                          >
                            <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>{name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {parserLocationDrafts.map((la, idx) => (
                  <View key={`la_${idx}`} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.card, alignItems: "flex-start", flexDirection: "column" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name="map-pin" size={13} color="#f59e0b" />
                      <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>
                        {la.action === "create" ? "New location" : "Update location"}
                      </Text>
                    </View>
                    <TextInput value={la.name} onChangeText={(value) => setParserLocationDrafts((prev) => prev.map((item, i) => i === idx ? { ...item, name: value } : item))} placeholder="Location" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background, width: "100%" }]} />
                    <TextInput value={la.description ?? ""} onChangeText={(value) => setParserLocationDrafts((prev) => prev.map((item, i) => i === idx ? { ...item, description: value } : item))} placeholder="Description" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.background, width: "100%", minHeight: 70 }]} />
                    <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>Link Quests</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {[...new Set([...parserQuestDrafts.map((q) => q.name), ...quests.map((q) => q.name)])].map((name) => {
                        const selected = la.linkedQuestNames.some((value) => normalizeKey(value) === normalizeKey(name));
                        return (
                          <TouchableOpacity
                            key={`${la.name}-quest-${name}`}
                            onPress={() => setParserLocationDrafts((prev) => prev.map((item, i) => {
                              if (i !== idx) return item;
                              const has = item.linkedQuestNames.some((value) => normalizeKey(value) === normalizeKey(name));
                              return { ...item, linkedQuestNames: has ? item.linkedQuestNames.filter((value) => normalizeKey(value) !== normalizeKey(name)) : [...item.linkedQuestNames, name] };
                            }))}
                            style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + "20" : c.background }]}
                          >
                            <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>{name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {(parserResult.proposedInventoryChanges ?? []).filter((item) => item.quantity > 0).map((item, idx) => (
                  <View key={`item_${idx}`} style={styles.previewRow}>
                    <Feather name="package" size={13} color="#10b981" />
                    <Text style={{ fontSize: 12, color: c.foreground, flex: 1 }}>
                      Loot candidate: <Text style={{ fontWeight: "700" }}>{item.name}</Text>
                      {` x${item.quantity}`}
                    </Text>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => void handleApplyParsedResult()}
                  disabled={applyingParser || parserApplied}
                  style={[styles.primaryBtn, { backgroundColor: c.primary, opacity: applyingParser || parserApplied ? 0.7 : 1 }]}
                >
                  {applyingParser ? <ActivityIndicator color="#fff" /> : <Feather name="check" size={14} color="#fff" />}
                  <Text style={styles.primaryBtnText}>
                    {parserApplied ? "Applied" : applyingParser ? "Applying..." : "Apply Parsed Changes"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollHintScrollView>

      <Modal visible={showNoteModal} animationType="slide" onRequestClose={() => setShowNoteModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => setShowNoteModal(false)}><Text style={{ color: c.mutedForeground }}>Cancel</Text></TouchableOpacity>
            <Text style={{ color: c.foreground, fontWeight: "800" }}>{editingNote ? "Edit Note" : "New Note"}</Text>
            <TouchableOpacity
              onPress={() => {
                if (!nTitle.trim()) {
                  Alert.alert("Missing title", "Note title is required.");
                  return;
                }
                void upsertDmNote({
                  id: editingNote?.id,
                  title: nTitle,
                  body: nBody,
                  pinned: editingNote?.pinned ?? false,
                  createdAt: editingNote?.createdAt,
                  updatedAt: editingNote?.updatedAt,
                }).then(() => {
                  setShowNoteModal(false);
                  void refresh();
                });
              }}
            >
              <Text style={{ color: c.primary, fontWeight: "700" }}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollHintScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <TextInput value={nTitle} onChangeText={setNTitle} placeholder="Note title" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <TextInput value={nBody} onChangeText={setNBody} placeholder="Note body" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.card, minHeight: 220 }]} />
          </ScrollHintScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showQuestModal} animationType="slide" onRequestClose={() => setShowQuestModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => setShowQuestModal(false)}><Text style={{ color: c.mutedForeground }}>Cancel</Text></TouchableOpacity>
            <Text style={{ color: c.foreground, fontWeight: "800" }}>{editingQuest ? "Edit Quest" : "New Quest"}</Text>
            <TouchableOpacity
              onPress={() => {
                if (!qName.trim()) {
                  Alert.alert("Missing name", "Quest name is required.");
                  return;
                }
                void upsertDmQuest({
                  id: editingQuest?.id,
                  name: qName,
                  type: qType,
                  status: editingQuest?.status ?? "active",
                  description: qDescription,
                  notes: qNotes,
                  locationTags: qLocationTags,
                  locationLinkModes: qLocationLinkModes,
                  peopleTags: qPeopleTags.length > 0 ? qPeopleTags : undefined,
                  pinned: editingQuest?.pinned,
                  createdAt: editingQuest?.createdAt,
                }).then(() => {
                  setShowQuestModal(false);
                  void refresh();
                });
              }}
            >
              <Text style={{ color: c.primary, fontWeight: "700" }}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollHintScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <TextInput value={qName} onChangeText={setQName} placeholder="Quest name" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["main", "side", "personal"] as const).map((t) => (
                <TouchableOpacity key={t} onPress={() => setQType(t)} style={[styles.chip, { borderColor: qType === t ? c.primary : c.border, backgroundColor: qType === t ? c.primary + "20" : c.card }]}>
                  <Text style={{ color: qType === t ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {locationHierarchyEntries.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" }}>Linked Locations</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {locationHierarchyEntries.map(({ location }) => {
                    const sel = qLocationTags.includes(location.id);
                    const mode = qLocationLinkModes[location.id] ?? "direct_only";
                    return (
                      <TouchableOpacity
                        key={location.id}
                        onPress={() => {
                          setQLocationTags(prev => sel ? prev.filter(x => x !== location.id) : [...prev, location.id]);
                          if (sel) {
                            setQLocationLinkModes(prev => { const n = { ...prev }; delete n[location.id]; return n; });
                          } else {
                            setQLocationLinkModes(prev => ({ ...prev, [location.id]: prev[location.id] ?? "direct_only" }));
                          }
                        }}
                        onLongPress={() => {
                          if (!sel) return;
                          setQLocationLinkModes(prev => ({ ...prev, [location.id]: prev[location.id] === "inherit_to_descendants" ? "direct_only" : "inherit_to_descendants" }));
                        }}
                        activeOpacity={0.8}
                        style={[styles.chip, { borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primary + "20" : c.card }]}
                      >
                        <Feather name="map-pin" size={11} color={sel ? c.primary : c.mutedForeground} />
                        <Text style={{ color: sel ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>
                          {location.name}{sel ? (mode === "inherit_to_descendants" ? " [Desc]" : " [Direct]") : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 11, color: c.mutedForeground }}>Long press a selected location to toggle inheritance.</Text>
              </>
            )}
            {people.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" }}>Linked People</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {people.map((person) => {
                    const sel = qPeopleTags.includes(person.id);
                    return (
                      <TouchableOpacity
                        key={person.id}
                        onPress={() => setQPeopleTags(prev => sel ? prev.filter(x => x !== person.id) : [...prev, person.id])}
                        activeOpacity={0.8}
                        style={[styles.chip, { borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primary + "20" : c.card }]}
                      >
                        <Feather name="user" size={11} color={sel ? c.primary : c.mutedForeground} />
                        <Text style={{ color: sel ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{person.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <TextInput value={qDescription} onChangeText={setQDescription} placeholder="Description" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <TextInput value={qNotes} onChangeText={setQNotes} placeholder="Notes" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
          </ScrollHintScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showPersonModal} animationType="slide" onRequestClose={() => setShowPersonModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => setShowPersonModal(false)}><Text style={{ color: c.mutedForeground }}>Cancel</Text></TouchableOpacity>
            <Text style={{ color: c.foreground, fontWeight: "800" }}>{editingPerson ? "Edit Person" : "New Person"}</Text>
            <TouchableOpacity
              onPress={() => {
                if (!pName.trim()) {
                  Alert.alert("Missing name", "Person name is required.");
                  return;
                }
                void upsertDmPerson({
                  id: editingPerson?.id,
                  name: pName,
                  role: pRole,
                  relationship: pRelationship,
                  description: pDescription,
                  notes: pNotes,
                  questTags: pQuestTags,
                  locationTags: pLocationTags.length > 0 ? pLocationTags : undefined,
                  pinned: editingPerson?.pinned,
                  createdAt: editingPerson?.createdAt,
                }).then(() => {
                  setShowPersonModal(false);
                  void refresh();
                });
              }}
            >
              <Text style={{ color: c.primary, fontWeight: "700" }}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollHintScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <TextInput value={pName} onChangeText={setPName} placeholder="Person name" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <TextInput value={pRole} onChangeText={setPRole} placeholder="Role" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(["unknown", "ally", "neutral", "hostile"] as const).map((rel) => (
                <TouchableOpacity key={rel} onPress={() => setPRelationship(rel)} style={[styles.chip, { borderColor: pRelationship === rel ? c.primary : c.border, backgroundColor: pRelationship === rel ? c.primary + "20" : c.card }]}>
                  <Text style={{ color: pRelationship === rel ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{rel}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {quests.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" }}>Linked Quests</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {quests.map((quest) => {
                    const sel = pQuestTags.includes(quest.id);
                    return (
                      <TouchableOpacity
                        key={quest.id}
                        onPress={() => setPQuestTags(prev => sel ? prev.filter(x => x !== quest.id) : [...prev, quest.id])}
                        activeOpacity={0.8}
                        style={[styles.chip, { borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primary + "20" : c.card }]}
                      >
                        <Feather name="flag" size={11} color={sel ? c.primary : c.mutedForeground} />
                        <Text style={{ color: sel ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{quest.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {locationHierarchyEntries.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" }}>Linked Locations</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {locationHierarchyEntries.map(({ location }) => {
                    const sel = pLocationTags.includes(location.id);
                    return (
                      <TouchableOpacity
                        key={location.id}
                        onPress={() => setPLocationTags(prev => sel ? prev.filter(x => x !== location.id) : [...prev, location.id])}
                        activeOpacity={0.8}
                        style={[styles.chip, { borderColor: sel ? "#F59E0B" : c.border, backgroundColor: sel ? "#F59E0B20" : c.card }]}
                      >
                        <Feather name="map-pin" size={11} color={sel ? "#F59E0B" : c.mutedForeground} />
                        <Text style={{ color: sel ? "#F59E0B" : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{location.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <TextInput value={pDescription} onChangeText={setPDescription} placeholder="Description" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <TextInput value={pNotes} onChangeText={setPNotes} placeholder="Notes" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
          </ScrollHintScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showLocationModal} animationType="slide" onRequestClose={() => setShowLocationModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => setShowLocationModal(false)}><Text style={{ color: c.mutedForeground }}>Cancel</Text></TouchableOpacity>
            <Text style={{ color: c.foreground, fontWeight: "800" }}>{editingLocation ? "Edit Location" : "New Location"}</Text>
            <TouchableOpacity
              onPress={() => {
                if (!lName.trim()) {
                  Alert.alert("Missing name", "Location name is required.");
                  return;
                }
                void upsertDmLocation({
                  id: editingLocation?.id,
                  name: lName,
                  description: lDescription,
                  notes: lNotes,
                  parentLocationId: lParentLocationId || undefined,
                  questTags: editingLocation?.questTags ?? [],
                  pinned: editingLocation?.pinned,
                  createdAt: editingLocation?.createdAt,
                }).then(() => {
                  setShowLocationModal(false);
                  void refresh();
                });
              }}
            >
              <Text style={{ color: c.primary, fontWeight: "700" }}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollHintScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <TextInput value={lName} onChangeText={setLName} placeholder="Location name" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            {locationParentOptions.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground }}>PARENT LOCATION</Text>
                <TouchableOpacity onPress={() => setLParentLocationId("")} style={[styles.itemRow, { borderColor: !lParentLocationId ? c.primary : c.border, backgroundColor: !lParentLocationId ? c.primary + "14" : c.card }]}>
                  <View style={{ gap: 2 }}>
                    <Text style={{ color: !lParentLocationId ? c.primary : c.foreground, fontWeight: "700" }}>No parent</Text>
                    <Text style={{ color: c.mutedForeground, fontSize: 11 }}>Keep this as a top-level location.</Text>
                  </View>
                </TouchableOpacity>
                {locationParentOptions.map((entry) => {
                  const selected = lParentLocationId === entry.location.id;
                  return (
                    <TouchableOpacity
                      key={entry.location.id}
                      onPress={() => setLParentLocationId(entry.location.id)}
                      style={[
                        styles.itemRow,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "14" : c.card,
                          marginLeft: Math.min(entry.depth * 14, 42),
                        },
                      ]}
                    >
                      <View style={{ gap: 2 }}>
                        <Text style={{ color: selected ? c.primary : c.foreground, fontWeight: "700" }}>{entry.location.name}</Text>
                        {entry.parentBreadcrumb ? <Text style={{ color: c.mutedForeground, fontSize: 11 }}>In {entry.parentBreadcrumb}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
            <TextInput value={lDescription} onChangeText={setLDescription} placeholder="Description" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <TextInput value={lNotes} onChangeText={setLNotes} placeholder="Notes" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
          </ScrollHintScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showPlaneModal} animationType="slide" onRequestClose={() => setShowPlaneModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => setShowPlaneModal(false)}><Text style={{ color: c.mutedForeground }}>Cancel</Text></TouchableOpacity>
            <Text style={{ color: c.foreground, fontWeight: "800" }}>{editingPlane ? "Edit Plane" : "New Plane"}</Text>
            <TouchableOpacity
              onPress={() => {
                if (!pnName.trim()) {
                  Alert.alert("Missing name", "Plane name is required.");
                  return;
                }
                void upsertDmPlane({
                  id: editingPlane?.id,
                  name: pnName,
                  description: pnDescription,
                  questTags: pnQuestTags,
                  locationTags: pnLocationTags,
                  pinned: editingPlane?.pinned,
                  createdAt: editingPlane?.createdAt,
                }).then(() => {
                  setShowPlaneModal(false);
                  void refresh();
                });
              }}
            >
              <Text style={{ color: c.primary, fontWeight: "700" }}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollHintScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <TextInput value={pnName} onChangeText={setPnName} placeholder="Plane name (e.g. The Shadowfell)" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <TextInput value={pnDescription} onChangeText={setPnDescription} placeholder="Description" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            {quests.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" }}>Linked Quests</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {quests.map((quest) => {
                    const sel = pnQuestTags.includes(quest.id);
                    return (
                      <TouchableOpacity
                        key={quest.id}
                        onPress={() => setPnQuestTags((prev) => sel ? prev.filter((id) => id !== quest.id) : [...prev, quest.id])}
                        activeOpacity={0.8}
                        style={[styles.chip, { borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primary + "20" : c.card }]}
                      >
                        <Feather name="flag" size={11} color={sel ? c.primary : c.mutedForeground} />
                        <Text style={{ color: sel ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{quest.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {locations.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" }}>Linked Locations</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {locations.map((location) => {
                    const sel = pnLocationTags.includes(location.id);
                    return (
                      <TouchableOpacity
                        key={location.id}
                        onPress={() => setPnLocationTags((prev) => sel ? prev.filter((id) => id !== location.id) : [...prev, location.id])}
                        activeOpacity={0.8}
                        style={[styles.chip, { borderColor: sel ? "#F59E0B" : c.border, backgroundColor: sel ? "#F59E0B20" : c.card }]}
                      >
                        <Feather name="map-pin" size={11} color={sel ? "#F59E0B" : c.mutedForeground} />
                        <Text style={{ color: sel ? "#F59E0B" : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{location.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollHintScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showPlanePickerModal} animationType="slide" onRequestClose={() => setShowPlanePickerModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => setShowPlanePickerModal(false)}><Text style={{ color: c.mutedForeground }}>Close</Text></TouchableOpacity>
            <Text style={{ color: c.foreground, fontWeight: "800" }}>Add Plane</Text>
            <TouchableOpacity
              onPress={() => {
                setShowPlanePickerModal(false);
                openPlaneModal();
              }}
            >
              <Text style={{ color: c.primary, fontWeight: "700" }}>Custom</Text>
            </TouchableOpacity>
          </View>
          <ScrollHintScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {PLANE_PRESETS.map((preset) => {
              const existing = planes.find((p) => normalizeKey(p.name) === normalizeKey(preset.name));
              return (
                <TouchableOpacity
                  key={preset.name}
                  disabled={!!existing}
                  onPress={() => {
                    setShowPlanePickerModal(false);
                    openPlaneModal({
                      id: "",
                      name: preset.name,
                      description: preset.description,
                      questTags: [],
                      locationTags: [],
                      createdAt: Date.now(),
                    });
                  }}
                  style={[styles.itemRow, { borderColor: existing ? c.mutedForeground + "44" : c.border, backgroundColor: existing ? c.muted + "44" : c.card, opacity: existing ? 0.7 : 1 }]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: c.foreground, fontWeight: "700", fontSize: 14 }}>{preset.name}</Text>
                    <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{preset.description}</Text>
                  </View>
                  {existing ? (
                    <Text style={{ color: c.mutedForeground, fontSize: 11, fontWeight: "700" }}>Added</Text>
                  ) : (
                    <Feather name="plus-circle" size={16} color={c.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollHintScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showItemModal} animationType="slide" onRequestClose={() => setShowItemModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border, backgroundColor: c.card }]}>
            <TouchableOpacity onPress={() => setShowItemModal(false)}><Text style={{ color: c.mutedForeground }}>Cancel</Text></TouchableOpacity>
            <Text style={{ color: c.foreground, fontWeight: "800" }}>{editingItem ? "Edit Item" : "New Item"}</Text>
            <TouchableOpacity
              onPress={() => {
                if (!itName.trim()) {
                  Alert.alert("Missing name", "Item name is required.");
                  return;
                }
                void upsertDmItem({
                  ...editingItem,
                  id: editingItem?.id,
                  name: itName,
                  description: itDescription,
                  properties: itProperties,
                  quality: itQuality,
                  category: itCategory,
                  lootRole: itLootRole,
                  questTags: itQuestTags,
                  peopleTags: itPeopleTags,
                  locationTags: editingItem?.locationTags,
                  value: editingItem?.value,
                  valueCurrency: editingItem?.valueCurrency,
                  weight: editingItem?.weight,
                  attunement: editingItem?.attunement,
                  attunementReq: editingItem?.attunementReq,
                  notes: editingItem?.notes,
                  pinned: editingItem?.pinned,
                  createdAt: editingItem?.createdAt,
                }).then(() => {
                  setShowItemModal(false);
                  void refresh();
                });
              }}
            >
              <Text style={{ color: c.primary, fontWeight: "700" }}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollHintScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <TextInput value={itName} onChangeText={setItName} placeholder="Item name" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <TextInput value={itQuality} onChangeText={setItQuality} placeholder="Quality (e.g. Rare)" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <TextInput value={itCategory} onChangeText={setItCategory} placeholder="Category (weapon, armor, magic...)" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <TextInput value={itDescription} onChangeText={setItDescription} placeholder="Description" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
            <TextInput value={itProperties} onChangeText={setItProperties} placeholder="Properties / mechanics" placeholderTextColor={c.mutedForeground} multiline style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />

            <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" }}>Role</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(["quest_item", "reward", "loot", "other"] as DmCampaignItemLootRole[]).map((role) => {
                const selected = itLootRole === role;
                const labels: Record<DmCampaignItemLootRole, string> = {
                  quest_item: "Quest Item",
                  reward: "Reward",
                  loot: "Loot",
                  other: "Other",
                };
                return (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setItLootRole(role)}
                    style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + "20" : c.card }]}
                  >
                    <Text style={{ color: selected ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{labels[role]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {quests.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" }}>Linked Quests</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {quests.map((quest) => {
                    const sel = itQuestTags.includes(quest.id);
                    return (
                      <TouchableOpacity
                        key={quest.id}
                        onPress={() => setItQuestTags((prev) => sel ? prev.filter((id) => id !== quest.id) : [...prev, quest.id])}
                        activeOpacity={0.8}
                        style={[styles.chip, { borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primary + "20" : c.card }]}
                      >
                        <Feather name="flag" size={11} color={sel ? c.primary : c.mutedForeground} />
                        <Text style={{ color: sel ? c.primary : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{quest.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {people.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" }}>Linked People</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {people.map((person) => {
                    const sel = itPeopleTags.includes(person.id);
                    return (
                      <TouchableOpacity
                        key={person.id}
                        onPress={() => setItPeopleTags((prev) => sel ? prev.filter((id) => id !== person.id) : [...prev, person.id])}
                        activeOpacity={0.8}
                        style={[styles.chip, { borderColor: sel ? "#F59E0B" : c.border, backgroundColor: sel ? "#F59E0B20" : c.card }]}
                      >
                        <Feather name="user" size={11} color={sel ? "#F59E0B" : c.mutedForeground} />
                        <Text style={{ color: sel ? "#F59E0B" : c.mutedForeground, fontWeight: "700", fontSize: 12 }}>{person.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollHintScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  headerCard: {
    borderRadius: 10 * 1.5,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  tabBtn: {
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  section: {
    borderWidth: 1,
    borderRadius: 10 * 1.5,
    padding: 12,
    gap: 8,
  },
  primaryBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  itemRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modalHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  previewBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
