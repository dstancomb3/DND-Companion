import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CharacterSnapshot } from "@/types";

const STORAGE_KEY = "@lcs_saved_characters";
const LAST_ACTIVE_KEY = "@lcs_last_active_id";

export interface SavedCharacterMeta {
  id: string;
  name: string;
  characterClass: string;
  level: number;
  race: string;
  savedAt: number;
}

export interface SavedCharacter extends SavedCharacterMeta {
  snapshot: CharacterSnapshot;
}

export async function getAllCharacters(): Promise<SavedCharacter[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedCharacter[];
  } catch {
    return [];
  }
}

export async function saveCharacter(snapshot: CharacterSnapshot): Promise<void> {
  const all = await getAllCharacters();
  const id = snapshot.character.id;
  const entry: SavedCharacter = {
    id,
    name: snapshot.character.name,
    characterClass: snapshot.character.class,
    level: snapshot.character.level,
    race: snapshot.character.race,
    savedAt: Date.now(),
    snapshot,
  };
  const idx = all.findIndex((c) => c.id === id);
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.push(entry);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  await AsyncStorage.setItem(LAST_ACTIVE_KEY, id);
}

export async function deleteCharacter(id: string): Promise<void> {
  const all = await getAllCharacters();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((c) => c.id !== id)));
  const lastActive = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
  if (lastActive === id) await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
}

export async function getLastActiveId(): Promise<string | null> {
  try {
    return AsyncStorage.getItem(LAST_ACTIVE_KEY);
  } catch {
    return null;
  }
}

export async function setLastActiveId(id: string): Promise<void> {
  return AsyncStorage.setItem(LAST_ACTIVE_KEY, id);
}
