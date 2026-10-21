import AsyncStorage from "@react-native-async-storage/async-storage";
import { CompendiumMonster, CustomMonster, Open5eMonster } from "@/types/index";
import { fetchOpen5eMonsters } from "./open5eApi";

const OFFICIAL_MONSTERS_CACHE_KEY = "official_monsters_cache";
const OFFICIAL_MONSTERS_TIMESTAMP_KEY = "official_monsters_timestamp";
const CUSTOM_MONSTERS_KEY = "custom_monsters";
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type OfficialMonstersFetchSource =
  | "memory_fresh"
  | "persisted_fresh"
  | "persisted_stale"
  | "network_fresh"
  | "fallback_memory_stale"
  | "fallback_persisted_stale"
  | "empty";

export interface OfficialMonstersFetchMeta {
  source: OfficialMonstersFetchSource;
  isStale: boolean;
  isRefreshingInBackground: boolean;
  timestamp: number | null;
  reusedInFlightRefresh: boolean;
}

export interface CompendiumLoadResult {
  monsters: CompendiumMonster[];
  officialMeta: OfficialMonstersFetchMeta;
}

type OfficialMonstersFetchPlan = {
  serveImmediately: "memory" | "persisted" | "none";
  refreshMode: "none" | "background" | "await";
  reusedInFlightRefresh: boolean;
};

let officialMonstersMemoryCache: Open5eMonster[] | null = null;
let officialMonstersMemoryTimestamp = 0;
let officialMonstersRefreshPromise: Promise<Open5eMonster[]> | null = null;
let customMonstersMemoryCache: CustomMonster[] | null = null;

function normalizeMonsterText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildOfficialMonsterDedupKey(monster: Open5eMonster): string {
  const actionSig = Array.isArray(monster.actions)
    ? monster.actions
      .map((action) => `${normalizeMonsterText(action?.name)}:${normalizeMonsterText(action?.desc)}`)
      .join("|")
    : "";

  const abilitySig = [
    monster.strength,
    monster.dexterity,
    monster.constitution,
    monster.intelligence,
    monster.wisdom,
    monster.charisma,
  ].join(":");

  return [
    normalizeMonsterText(monster.name),
    normalizeMonsterText(monster.size),
    normalizeMonsterText(monster.type),
    normalizeMonsterText(monster.subtype),
    normalizeMonsterText(monster.alignment),
    String(monster.armor_class ?? ""),
    String(monster.hit_points ?? ""),
    normalizeMonsterText(monster.hit_dice),
    normalizeMonsterText(monster.challenge_rating),
    abilitySig,
    normalizeMonsterText((monster as { desc?: string }).desc),
    actionSig,
  ].join("::");
}

function dedupeOfficialMonsters(monsters: Open5eMonster[]): Open5eMonster[] {
  const seen = new Set<string>();
  const deduped: Open5eMonster[] = [];

  for (const monster of monsters) {
    const key = buildOfficialMonsterDedupKey(monster);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(monster);
  }

  return deduped;
}

function isFresh(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION_MS;
}

export function decideOfficialMonstersFetchPlan(input: {
  forceRefresh: boolean;
  hasFreshMemory: boolean;
  hasFreshPersisted: boolean;
  hasPersisted: boolean;
  hasInFlightRefresh: boolean;
}): OfficialMonstersFetchPlan {
  if (!input.forceRefresh && input.hasFreshMemory) {
    return { serveImmediately: "memory", refreshMode: "none", reusedInFlightRefresh: false };
  }

  if (!input.forceRefresh && input.hasFreshPersisted) {
    return { serveImmediately: "persisted", refreshMode: "none", reusedInFlightRefresh: false };
  }

  if (!input.forceRefresh && input.hasPersisted) {
    return {
      serveImmediately: "persisted",
      refreshMode: "background",
      reusedInFlightRefresh: input.hasInFlightRefresh,
    };
  }

  return {
    serveImmediately: "none",
    refreshMode: "await",
    reusedInFlightRefresh: input.hasInFlightRefresh,
  };
}

async function readPersistedOfficialMonsters(): Promise<{ monsters: Open5eMonster[]; timestamp: number } | null> {
  try {
    const [cached, timestamp] = await Promise.all([
      AsyncStorage.getItem(OFFICIAL_MONSTERS_CACHE_KEY),
      AsyncStorage.getItem(OFFICIAL_MONSTERS_TIMESTAMP_KEY),
    ]);

    if (!cached || !timestamp) {
      return null;
    }

    const parsedTimestamp = parseInt(timestamp, 10);
    if (!Number.isFinite(parsedTimestamp) || parsedTimestamp <= 0) {
      return null;
    }

    const parsed = JSON.parse(cached) as Open5eMonster[];
    if (!Array.isArray(parsed)) {
      return null;
    }

    const deduped = dedupeOfficialMonsters(parsed);

    return {
      monsters: deduped,
      timestamp: parsedTimestamp,
    };
  } catch (error) {
    console.error("Failed to read persisted official monsters cache:", error);
    return null;
  }
}

async function refreshOfficialMonstersFromNetwork(): Promise<Open5eMonster[]> {
  if (officialMonstersRefreshPromise) {
    return officialMonstersRefreshPromise;
  }

  officialMonstersRefreshPromise = (async () => {
    const monsters = dedupeOfficialMonsters(await fetchOpen5eMonsters());
    const timestamp = Date.now();

    officialMonstersMemoryCache = monsters;
    officialMonstersMemoryTimestamp = timestamp;

    await Promise.all([
      AsyncStorage.setItem(OFFICIAL_MONSTERS_CACHE_KEY, JSON.stringify(monsters)),
      AsyncStorage.setItem(OFFICIAL_MONSTERS_TIMESTAMP_KEY, timestamp.toString()),
    ]);

    return monsters;
  })();

  try {
    return await officialMonstersRefreshPromise;
  } finally {
    officialMonstersRefreshPromise = null;
  }
}

async function fetchOfficialMonstersWithMeta(forceRefresh = false): Promise<{ monsters: Open5eMonster[]; meta: OfficialMonstersFetchMeta }> {
  const hasFreshMemory = !!officialMonstersMemoryCache && isFresh(officialMonstersMemoryTimestamp);
  const persisted = await readPersistedOfficialMonsters();
  const hasFreshPersisted = !!persisted && isFresh(persisted.timestamp);
  const hasPersisted = !!persisted;

  const plan = decideOfficialMonstersFetchPlan({
    forceRefresh,
    hasFreshMemory,
    hasFreshPersisted,
    hasPersisted,
    hasInFlightRefresh: !!officialMonstersRefreshPromise,
  });

  if (plan.serveImmediately === "memory" && officialMonstersMemoryCache) {
    const dedupedMemory = dedupeOfficialMonsters(officialMonstersMemoryCache);
    officialMonstersMemoryCache = dedupedMemory;
    return {
      monsters: dedupedMemory,
      meta: {
        source: "memory_fresh",
        isStale: false,
        isRefreshingInBackground: false,
        timestamp: officialMonstersMemoryTimestamp,
        reusedInFlightRefresh: false,
      },
    };
  }

  if (plan.serveImmediately === "persisted" && persisted) {
    const dedupedPersisted = dedupeOfficialMonsters(persisted.monsters);
    officialMonstersMemoryCache = dedupedPersisted;
    officialMonstersMemoryTimestamp = persisted.timestamp;
    const persistedIsStale = !isFresh(persisted.timestamp);

    if (plan.refreshMode === "background") {
      void refreshOfficialMonstersFromNetwork().catch((error) => {
        console.error("Background refresh of official monsters failed:", error);
      });
    }

    return {
      monsters: dedupedPersisted,
      meta: {
        source: persistedIsStale ? "persisted_stale" : "persisted_fresh",
        isStale: persistedIsStale,
        isRefreshingInBackground: plan.refreshMode === "background",
        timestamp: persisted.timestamp,
        reusedInFlightRefresh: plan.reusedInFlightRefresh,
      },
    };
  }

  try {
    const monsters = dedupeOfficialMonsters(await refreshOfficialMonstersFromNetwork());
    return {
      monsters,
      meta: {
        source: "network_fresh",
        isStale: false,
        isRefreshingInBackground: false,
        timestamp: officialMonstersMemoryTimestamp,
        reusedInFlightRefresh: plan.reusedInFlightRefresh,
      },
    };
  } catch (error) {
    console.error("Failed to fetch official monsters from Open5e:", error);

    if (officialMonstersMemoryCache) {
      const dedupedMemory = dedupeOfficialMonsters(officialMonstersMemoryCache);
      officialMonstersMemoryCache = dedupedMemory;
      return {
        monsters: dedupedMemory,
        meta: {
          source: "fallback_memory_stale",
          isStale: true,
          isRefreshingInBackground: false,
          timestamp: officialMonstersMemoryTimestamp,
          reusedInFlightRefresh: plan.reusedInFlightRefresh,
        },
      };
    }

    if (persisted) {
      const dedupedPersisted = dedupeOfficialMonsters(persisted.monsters);
      officialMonstersMemoryCache = dedupedPersisted;
      officialMonstersMemoryTimestamp = persisted.timestamp;
      return {
        monsters: dedupedPersisted,
        meta: {
          source: "fallback_persisted_stale",
          isStale: true,
          isRefreshingInBackground: false,
          timestamp: persisted.timestamp,
          reusedInFlightRefresh: plan.reusedInFlightRefresh,
        },
      };
    }

    return {
      monsters: [],
      meta: {
        source: "empty",
        isStale: true,
        isRefreshingInBackground: false,
        timestamp: null,
        reusedInFlightRefresh: plan.reusedInFlightRefresh,
      },
    };
  }
}

/**
 * Normalize a monster's numeric values for consistency.
 * Handles null, undefined, and string conversions gracefully.
 */
export function normalizeMonsterNumbers(monster: Partial<Open5eMonster | CustomMonster>) {
  return {
    armor_class: typeof monster.armor_class === "number" ? monster.armor_class : 10,
    hit_points: typeof monster.hit_points === "number" ? monster.hit_points : 1,
    challenge_rating: String(monster.challenge_rating ?? "0"),
    strength: typeof monster.strength === "number" ? monster.strength : 10,
    dexterity: typeof monster.dexterity === "number" ? monster.dexterity : 10,
    constitution: typeof monster.constitution === "number" ? monster.constitution : 10,
    intelligence: typeof monster.intelligence === "number" ? monster.intelligence : 10,
    wisdom: typeof monster.wisdom === "number" ? monster.wisdom : 10,
    charisma: typeof monster.charisma === "number" ? monster.charisma : 10,
  };
}

/**
 * Helper: check if a monster is custom (has id + createdAt) or official.
 */
export function isCustomMonster(monster: CompendiumMonster): monster is CustomMonster {
  return "id" in monster && "createdAt" in monster;
}

/**
 * Fetch official monsters from Open5e API with caching.
 * Returns cached version if available and not stale; otherwise fetches fresh.
 */
export async function fetchOfficialMonsters(forceRefresh = false): Promise<Open5eMonster[]> {
  const result = await fetchOfficialMonstersWithMeta(forceRefresh);
  return result.monsters;
}

/**
 * Get all custom monsters from AsyncStorage.
 */
export async function getCustomMonsters(): Promise<CustomMonster[]> {
  if (customMonstersMemoryCache) {
    return customMonstersMemoryCache;
  }

  try {
    const stored = await AsyncStorage.getItem(CUSTOM_MONSTERS_KEY);
    const parsed = stored ? (JSON.parse(stored) as CustomMonster[]) : [];
    customMonstersMemoryCache = parsed;
    return parsed;
  } catch (error) {
    console.error("Failed to get custom monsters:", error);
    return [];
  }
}

/**
 * Save a new custom monster.
 */
export async function saveCustomMonster(
  monster: Omit<CustomMonster, "id" | "createdAt" | "updatedAt">
): Promise<CustomMonster> {
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = Date.now();

  const newMonster: CustomMonster = {
    ...monster,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const existing = await getCustomMonsters();
  const updated = [...existing, newMonster];

  await AsyncStorage.setItem(CUSTOM_MONSTERS_KEY, JSON.stringify(updated));
  customMonstersMemoryCache = updated;
  return newMonster;
}

/**
 * Update an existing custom monster.
 */
export async function updateCustomMonster(id: string, updates: Partial<Omit<CustomMonster, "id" | "createdAt">>): Promise<CustomMonster | null> {
  const existing = await getCustomMonsters();
  const index = existing.findIndex((m) => m.id === id);

  if (index === -1) {
    console.warn(`Custom monster with id ${id} not found`);
    return null;
  }

  const updated = {
    ...existing[index],
    ...updates,
    updatedAt: Date.now(),
  };

  existing[index] = updated;
  await AsyncStorage.setItem(CUSTOM_MONSTERS_KEY, JSON.stringify(existing));
  customMonstersMemoryCache = existing;

  return updated;
}

/**
 * Delete a custom monster.
 */
export async function deleteCustomMonster(id: string): Promise<boolean> {
  const existing = await getCustomMonsters();
  const filtered = existing.filter((m) => m.id !== id);

  if (filtered.length === existing.length) {
    console.warn(`Custom monster with id ${id} not found`);
    return false;
  }

  await AsyncStorage.setItem(CUSTOM_MONSTERS_KEY, JSON.stringify(filtered));
  customMonstersMemoryCache = filtered;
  return true;
}

/**
 * Get a merged compendium view: official + custom monsters.
 * Useful for UI that displays both sources together.
 */
export async function getCompendium(options?: {
  forceRefresh?: boolean;
}): Promise<CompendiumMonster[]> {
  const result = await getCompendiumWithMeta(options);
  return result.monsters;
}

export async function getCompendiumWithMeta(options?: {
  forceRefresh?: boolean;
}): Promise<CompendiumLoadResult> {
  const [official, custom] = await Promise.all([
    fetchOfficialMonstersWithMeta(options?.forceRefresh),
    getCustomMonsters(),
  ]);

  return {
    monsters: [...official.monsters, ...custom],
    officialMeta: official.meta,
  };
}

/**
 * Search the compendium by name (case-insensitive).
 */
export async function searchCompendium(query: string): Promise<CompendiumMonster[]> {
  const compendium = await getCompendium();
  const lowerQuery = query.toLowerCase();

  return compendium.filter((m) =>
    m.name.toLowerCase().includes(lowerQuery) ||
    m.type?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Filter compendium by challenge rating (e.g., "1/4" or "5" or "10").
 */
export async function filterByChallenge(minCr: number, maxCr: number): Promise<CompendiumMonster[]> {
  const compendium = await getCompendium();

  return compendium.filter((m) => {
    const cr = parseFloat(m.challenge_rating);
    return cr >= minCr && cr <= maxCr;
  });
}
