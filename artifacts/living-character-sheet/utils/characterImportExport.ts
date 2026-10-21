import type { Character, CharacterSnapshot } from "@/types";
import {
  assemblePortableCharacterSnapshot,
  normalizeCharacterSnapshotMechanics,
} from "@/utils/mechanics/characterSnapshotMechanicsAdapters";

export type ImportParseResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export type ImportSnapshotResult =
  | { ok: true; snapshot: CharacterSnapshot }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCharacterImportText(rawText: string): ImportParseResult {
  try {
    return { ok: true, data: JSON.parse(rawText.trim()) };
  } catch {
    return { ok: false, error: "Could not parse this text as JSON. Make sure it's valid." };
  }
}

export function buildImportedCharacterSnapshot(input: {
  parsed: unknown;
  baseSnapshot: CharacterSnapshot;
}): ImportSnapshotResult {
  const { parsed, baseSnapshot } = input;

  if (isRecord(parsed) && "character" in parsed) {
    const snapshot = parsed as Partial<CharacterSnapshot>;
    const importedCharacter = snapshot.character as Character | undefined;
    if (!importedCharacter?.name || !importedCharacter?.class) {
      return { ok: false, error: "Snapshot is missing character name or class." };
    }
    return {
      ok: true,
      snapshot: normalizeCharacterSnapshotMechanics({
        _version: snapshot._version ?? 1,
        character: importedCharacter,
        attacks: snapshot.attacks ?? [],
        resources: snapshot.resources ?? [],
        inventory: snapshot.inventory ?? [],
        conditions: snapshot.conditions ?? [],
        notes: snapshot.notes ?? [],
        wishlist: snapshot.wishlist ?? [],
        journalArcs: snapshot.journalArcs ?? [],
        spellSlots: snapshot.spellSlots,
        classFeatures: snapshot.classFeatures,
        passiveFeatures: snapshot.passiveFeatures,
        preparedSpells: snapshot.preparedSpells,
        people: snapshot.people,
        quests: snapshot.quests,
        locations: snapshot.locations,
        realms: snapshot.realms,
        companions: snapshot.companions,
        rulesState: snapshot.rulesState,
        combatLog: snapshot.combatLog,
        questGraphReviewQueue: snapshot.questGraphReviewQueue,
        mechanics: snapshot.mechanics,
      }),
    };
  }

  const bareCharacter = parsed as Partial<Character>;
  if (!bareCharacter?.name || !bareCharacter?.class) {
    return { ok: false, error: "This doesn't look like a character sheet - missing name or class field." };
  }

  const mergedCharacter: Character = {
    ...baseSnapshot.character,
    ...bareCharacter,
  };

  return {
    ok: true,
    snapshot: normalizeCharacterSnapshotMechanics({
      ...baseSnapshot,
      _version: 0,
      character: mergedCharacter,
      mechanics: mergedCharacter.mechanics,
    }),
  };
}

export function buildPortableCharacterExport(snapshot: CharacterSnapshot): CharacterSnapshot {
  return assemblePortableCharacterSnapshot(snapshot);
}
