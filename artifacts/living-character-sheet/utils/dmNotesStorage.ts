import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CampaignLocation, DmCampaignItem, Note, NpcPerson, Plane, Quest } from "@/types";
import { normalizeLocationHierarchyRecords } from "@/utils/locationHierarchy";

const DM_NOTES_KEY = "dm_notes_payload_v1";

export interface DmNotesPayload {
  notes: Note[];
  quests: Quest[];
  people: NpcPerson[];
  locations: CampaignLocation[];
  items: DmCampaignItem[];
  planes: Plane[];
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeQuest(input: Partial<Quest>): Quest {
  const locationTags = Array.isArray(input.locationTags) ? input.locationTags.filter((x): x is string => typeof x === "string") : [];
  const locationTagSet = new Set(locationTags);
  const locationLinkModes = (() => {
    const raw = input.locationLinkModes;
    if (!raw || typeof raw !== "object") return undefined;
    const entries = Object.entries(raw)
      .filter(([locationId, mode]) => locationTagSet.has(locationId) && (mode === "direct_only" || mode === "inherit_to_descendants"));
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries) as Quest["locationLinkModes"];
  })();
  return {
    id: input.id || makeId("q"),
    name: (input.name || "Untitled Quest").trim(),
    type: input.type || "side",
    status: input.status || "active",
    description: input.description?.trim() || undefined,
    locationTags,
    ...(locationLinkModes ? { locationLinkModes } : {}),
    peopleTags: Array.isArray(input.peopleTags) ? input.peopleTags.filter((x): x is string => typeof x === "string") : undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: typeof input.createdAt === "number" ? input.createdAt : Date.now(),
    pinned: !!input.pinned,
  };
}

function normalizePerson(input: Partial<NpcPerson>): NpcPerson {
  return {
    id: input.id || makeId("p"),
    name: (input.name || "Unnamed Person").trim(),
    role: input.role?.trim() || undefined,
    relationship: input.relationship || "unknown",
    description: input.description?.trim() || undefined,
    questTags: Array.isArray(input.questTags) ? input.questTags.filter((x): x is string => typeof x === "string") : [],
    locationTags: Array.isArray(input.locationTags) ? input.locationTags.filter((x): x is string => typeof x === "string") : undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: typeof input.createdAt === "number" ? input.createdAt : Date.now(),
    pinned: !!input.pinned,
    deceased: !!input.deceased,
    deceasedNote: input.deceasedNote?.trim() || undefined,
  };
}

function normalizeLocation(input: Partial<CampaignLocation>): CampaignLocation {
  const id = input.id || makeId("l");
  const parentLocationId = typeof input.parentLocationId === "string" && input.parentLocationId !== id
    ? input.parentLocationId
    : undefined;
  return {
    id,
    name: (input.name || "Unnamed Location").trim(),
    parentLocationId,
    description: input.description?.trim() || undefined,
    mapImageUri: input.mapImageUri?.trim() || undefined,
    questTags: Array.isArray(input.questTags) ? input.questTags.filter((x): x is string => typeof x === "string") : [],
    notes: input.notes?.trim() || undefined,
    createdAt: typeof input.createdAt === "number" ? input.createdAt : Date.now(),
    pinned: !!input.pinned,
  };
}

function normalizePlane(input: Partial<Plane>): Plane {
  return {
    id: input.id || makeId("plane"),
    name: (input.name || "Unnamed Plane").trim(),
    aliases: Array.isArray(input.aliases) ? input.aliases.filter((x): x is string => typeof x === "string") : undefined,
    description: input.description?.trim() || undefined,
    questTags: Array.isArray(input.questTags) ? input.questTags.filter((x): x is string => typeof x === "string") : [],
    locationTags: Array.isArray(input.locationTags) ? input.locationTags.filter((x): x is string => typeof x === "string") : [],
    notes: input.notes?.trim() || undefined,
    createdAt: typeof input.createdAt === "number" ? input.createdAt : Date.now(),
    pinned: !!input.pinned,
  };
}

function normalizeItem(input: Partial<DmCampaignItem>): DmCampaignItem {
  return {
    equippedEffects: input.equippedEffects,
    consumptionEffects: input.consumptionEffects,
    mechanics: input.mechanics,
    damageDice: input.damageDice,
    damageModifier: input.damageModifier,
    damageType: input.damageType,
    id: input.id || makeId("item"),
    name: (input.name || "Unnamed Item").trim(),
    quality: input.quality?.trim() || undefined,
    category: input.category?.trim() || undefined,
    subtype: input.subtype?.trim() || undefined,
    tags: Array.isArray(input.tags) ? input.tags.filter((x): x is string => typeof x === "string") : undefined,
    value: input.value?.trim() || undefined,
    valueCurrency: input.valueCurrency || undefined,
    weight: input.weight?.trim() || undefined,
    attunement: input.attunement || undefined,
    attunementReq: input.attunementReq?.trim() || undefined,
    properties: input.properties?.trim() || undefined,
    description: input.description?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    questTags: Array.isArray(input.questTags) ? input.questTags.filter((x): x is string => typeof x === "string") : undefined,
    peopleTags: Array.isArray(input.peopleTags) ? input.peopleTags.filter((x): x is string => typeof x === "string") : undefined,
    locationTags: Array.isArray(input.locationTags) ? input.locationTags.filter((x): x is string => typeof x === "string") : undefined,
    lootRole: input.lootRole || undefined,
    createdAt: typeof input.createdAt === "number" ? input.createdAt : Date.now(),
    pinned: !!input.pinned,
  };
}

function normalizeNote(input: Partial<Note>): Note {
  const now = Date.now();
  return {
    id: input.id || makeId("n"),
    title: (input.title || "Untitled Note").trim(),
    body: (input.body || "").trim(),
    pinned: !!input.pinned,
    createdAt: typeof input.createdAt === "number" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : now,
    sessionNumber: input.sessionNumber,
    arcName: input.arcName,
    tags: Array.isArray(input.tags) ? input.tags.filter((x): x is string => typeof x === "string") : undefined,
    linkedNpcs: Array.isArray(input.linkedNpcs) ? input.linkedNpcs.filter((x): x is string => typeof x === "string") : undefined,
    linkedLocations: Array.isArray(input.linkedLocations) ? input.linkedLocations.filter((x): x is string => typeof x === "string") : undefined,
    linkedQuests: Array.isArray(input.linkedQuests) ? input.linkedQuests.filter((x): x is string => typeof x === "string") : undefined,
  };
}

function normalizePayload(raw: unknown): DmNotesPayload {
  const payload = (typeof raw === "object" && raw ? raw : {}) as Partial<DmNotesPayload>;
  const notes = Array.isArray(payload.notes) ? payload.notes.map((n) => normalizeNote(n)) : [];
  const quests = Array.isArray(payload.quests) ? payload.quests.map((q) => normalizeQuest(q)) : [];
  const people = Array.isArray(payload.people) ? payload.people.map((p) => normalizePerson(p)) : [];
  const normalizedLocations = Array.isArray(payload.locations) ? payload.locations.map((l) => normalizeLocation(l)) : [];
  const locations = normalizeLocationHierarchyRecords(normalizedLocations);
  const items = Array.isArray(payload.items) ? payload.items.map((i) => normalizeItem(i)) : [];
  const planes = Array.isArray(payload.planes) ? payload.planes.map((p) => normalizePlane(p)) : [];
  return { notes, quests, people, locations, items, planes };
}

export async function getDmNotesPayload(): Promise<DmNotesPayload> {
  try {
    const raw = await AsyncStorage.getItem(DM_NOTES_KEY);
    if (!raw) return { notes: [], quests: [], people: [], locations: [], items: [], planes: [] };
    return normalizePayload(JSON.parse(raw));
  } catch {
    return { notes: [], quests: [], people: [], locations: [], items: [], planes: [] };
  }
}

export async function saveDmNotesPayload(payload: DmNotesPayload): Promise<void> {
  await AsyncStorage.setItem(DM_NOTES_KEY, JSON.stringify(normalizePayload(payload)));
}

export async function upsertDmQuest(input: Partial<Quest>): Promise<Quest> {
  const data = await getDmNotesPayload();
  const quest = normalizeQuest(input);
  const idx = data.quests.findIndex((q) => q.id === quest.id);
  if (idx >= 0) data.quests[idx] = quest;
  else data.quests.unshift(quest);
  await saveDmNotesPayload(data);
  return quest;
}

export async function upsertDmNote(input: Partial<Note>): Promise<Note> {
  const data = await getDmNotesPayload();
  const note = normalizeNote(input);
  const idx = data.notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) data.notes[idx] = { ...note, updatedAt: Date.now() };
  else data.notes.unshift(note);
  await saveDmNotesPayload(data);
  return note;
}

export async function upsertDmPerson(input: Partial<NpcPerson>): Promise<NpcPerson> {
  const data = await getDmNotesPayload();
  const person = normalizePerson(input);
  const idx = data.people.findIndex((p) => p.id === person.id);
  if (idx >= 0) data.people[idx] = person;
  else data.people.unshift(person);
  await saveDmNotesPayload(data);
  return person;
}

export async function upsertDmLocation(input: Partial<CampaignLocation>): Promise<CampaignLocation> {
  const data = await getDmNotesPayload();
  const location = normalizeLocation(input);
  const idx = data.locations.findIndex((l) => l.id === location.id);
  if (idx >= 0) data.locations[idx] = location;
  else data.locations.unshift(location);
  await saveDmNotesPayload(data);
  return location;
}

export async function deleteDmQuest(id: string): Promise<void> {
  const data = await getDmNotesPayload();
  data.quests = data.quests.filter((q) => q.id !== id);
  await saveDmNotesPayload(data);
}

export async function deleteDmNote(id: string): Promise<void> {
  const data = await getDmNotesPayload();
  data.notes = data.notes.filter((n) => n.id !== id);
  await saveDmNotesPayload(data);
}

export async function deleteDmPerson(id: string): Promise<void> {
  const data = await getDmNotesPayload();
  data.people = data.people.filter((p) => p.id !== id);
  await saveDmNotesPayload(data);
}

export async function deleteDmLocation(id: string): Promise<void> {
  const data = await getDmNotesPayload();
  data.locations = data.locations.filter((l) => l.id !== id);
  data.locations = data.locations.map((location) => (
    location.parentLocationId === id
      ? { ...location, parentLocationId: undefined }
      : location
  ));
  await saveDmNotesPayload(data);
}

export async function upsertDmItem(input: Partial<DmCampaignItem>): Promise<DmCampaignItem> {
  const data = await getDmNotesPayload();
  const item = normalizeItem(input);
  const idx = data.items.findIndex((i) => i.id === item.id);
  if (idx >= 0) data.items[idx] = item;
  else data.items.unshift(item);
  await saveDmNotesPayload(data);
  return item;
}

export async function deleteDmItem(id: string): Promise<void> {
  const data = await getDmNotesPayload();
  data.items = data.items.filter((i) => i.id !== id);
  await saveDmNotesPayload(data);
}

export async function upsertDmPlane(input: Partial<Plane>): Promise<Plane> {
  const data = await getDmNotesPayload();
  const plane = normalizePlane(input);
  const idx = data.planes.findIndex((p) => p.id === plane.id);
  if (idx >= 0) data.planes[idx] = plane;
  else data.planes.unshift(plane);
  await saveDmNotesPayload(data);
  return plane;
}

export async function deleteDmPlane(id: string): Promise<void> {
  const data = await getDmNotesPayload();
  data.planes = data.planes.filter((p) => p.id !== id);
  await saveDmNotesPayload(data);
}
