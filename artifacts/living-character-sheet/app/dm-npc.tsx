import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, Alert, Share, Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { DmNpcGearPicker } from "@/components/DmNpcGearPicker";
import { CharacterSheetFormCore, type CharacterSheetFormData, type CharacterSheetFormSection } from "@/components/CharacterSheetFormCore";
import { API_BASE_URL } from "@/utils/apiUrl";
import { normalizeSavedDmNpcRecord } from "@/utils/dmNpcStorage";
import { getDmNotesPayload } from "@/utils/dmNotesStorage";
import { buildRandomCreationGearSelection, type CreationGearFilterCategory, type GearSelectionMode } from "@/utils/creationGear";
import { getRaceLifespan, computeAgeCategory, getLifespanHint, type AgeCategory } from "@/utils/raceLifespan";
import {
  RACE_GROUPS, ALL_BACKGROUNDS, ALL_CLASSES,
} from "@/data/dnd5e";
import {
  generateRandomNPC, roll, rollMany,
  generateRandomName, NPC_GENDERS, NPC_AGES,
  NPC_ALIGNMENTS, NPC_OCCUPATIONS, NPC_PERSONALITY_TRAITS,
  NPC_IDEALS, NPC_BONDS, NPC_FLAWS, NPC_APPEARANCE, NPC_SECRETS,
  roll4d6DropLowest,
} from "@/data/dmTables";
import type { InventoryItem, Quest, NpcPerson, CampaignLocation, Plane } from "@/types";

const ALL_RACE_NAMES = RACE_GROUPS.flatMap((g) => g.races.flatMap((r) => r.subraces ?? [r.base]));

const NPC_RACE_DESCRIPTIONS: Record<string, string> = {
  Human: "Versatile and adaptable, Humans fit almost any role, culture, and social niche.",
  Dragonborn: "Proud draconic descendants with strong honor traditions and forceful presence.",
  Dwarf: "Sturdy and resilient, Dwarves are durable artisans tied to stone, clan, and tradition.",
  "Hill Dwarf": "Wise and enduring Dwarves with a patient temperament and exceptional staying power.",
  "Mountain Dwarf": "Broad-shouldered Dwarves known for martial tradition, armor craft, and front-line grit.",
  Duergar: "Underdark Dwarves with grim discipline, harsh survival instincts, and stern pragmatism.",
  Elf: "Graceful and long-lived, Elves are known for keen senses, poise, and fey ancestry.",
  "High Elf": "Arcane-leaning Elves often shaped by scholarship, refinement, and practiced spellcraft.",
  "Wood Elf": "Fleet, perceptive Elves with strong wilderness instincts and subtle fieldcraft.",
  Drow: "Shadow-adapted Elves with intense presence, deep-dark vision, and dangerous precision.",
  Eladrin: "Feywild Elves whose mood and bearing often shift with a seasonal identity.",
  "Sea Elf": "Aquatic Elves attuned to tides, reefs, and fluid movement through water.",
  "Shadar-Kai": "Shadow-touched Elves with restrained demeanor and a reputation for grim resolve.",
  Gnome: "Curious and clever, Gnomes blend intelligence with eccentric creativity and tinkering.",
  "Forest Gnome": "Stealthy Gnomes with a playful nature and close affinity for beasts and illusions.",
  "Rock Gnome": "Inventive Gnomes known for practical engineering, gadgets, and methodical craft.",
  "Deep Gnome": "Subterranean Gnomes with quiet discipline and survival instincts honed underground.",
  "Half-Elf": "Half-Elves blend human adaptability with elven grace and social versatility.",
  "Half-Orc": "Fierce survivors with imposing strength, directness, and battle-tested toughness.",
  Halfling: "Small but lucky, Halflings are nimble, brave, and hard to keep down.",
  "Lightfoot Halfling": "Quick-witted social Halflings who excel at charm, hiding, and quick exits.",
  "Stout Halfling": "Hardy Halflings with practical instincts and uncommon resilience under pressure.",
  "Ghostwise Halfling": "Reclusive Halflings with quiet intuition, tribal roots, and subtle communication.",
  Tiefling: "Marked by infernal bloodlines, Tieflings bring charisma, style, and supernatural edge.",
  "Asmodeus Tiefling": "Classic infernal lineage known for disciplined ambition and hellfire flavor.",
  "Baalzebul Tiefling": "Silver-tongued infernal lineage associated with corruption, bargains, and persuasion.",
  "Dispater Tiefling": "Secretive lineage with calculating minds, caution, and manipulative finesse.",
  "Fierna Tiefling": "Passionate infernal lineage with social influence and bold emotional intensity.",
  "Glasya Tiefling": "Roguish infernal lineage that favors stealth, trickery, and opportunistic tactics.",
  "Levistus Tiefling": "Cold-themed infernal lineage associated with endurance, patience, and retaliation.",
  "Mammon Tiefling": "Mercantile infernal lineage inclined toward greed, leverage, and material cunning.",
  "Mephistopheles Tiefling": "Arcane-leaning infernal lineage with heavy magical curiosity and control.",
  "Zariel Tiefling": "Martial infernal lineage with aggressive momentum and battlefield confidence.",
  Aasimar: "Celestially touched mortals known for radiant presence and moral gravity.",
  "Protector Aasimar": "Aasimar lineage associated with guardianship, guidance, and protective radiance.",
  "Scourge Aasimar": "Aasimar lineage that channels fierce inner light with volatile intensity.",
  "Fallen Aasimar": "Aasimar lineage marked by fracture, conflict, and ominous celestial remnants.",
  Bugbear: "Long-limbed ambushers who combine brute force with predatory stealth.",
  Centaur: "Powerful equine-bodied wanderers with speed, momentum, and open-ground confidence.",
  Changeling: "Shapechangers by nature, identity-fluid and socially adaptive across many roles.",
  Fairy: "Tiny fey beings with whimsical demeanor, flight, and old-world magical aura.",
  Firbolg: "Gentle giant-kin tied to nature, calm judgment, and deliberate action.",
  Genasi: "Elementally attuned people expressing air, earth, fire, or water heritage.",
  "Air Genasi": "Wind-touched lineage with restless mobility, agility, and storm-sense flavor.",
  "Earth Genasi": "Stone-touched lineage with grounded durability and stubborn determination.",
  "Fire Genasi": "Flame-touched lineage with heat, intensity, and forceful personal style.",
  "Water Genasi": "Wave-touched lineage with fluid adaptability and calm, depth-oriented focus.",
  Githyanki: "Astral warrior lineage known for military discipline, steel, and psionic edge.",
  Githzerai: "Monastic psionic lineage defined by focus, discipline, and mental control.",
  Goblin: "Scrappy and quick, Goblins excel through speed, nerve, and improvisation.",
  Goliath: "Towering and hardy mountain folk renowned for endurance and athletic might.",
  Harengon: "Quick-footed rabbitfolk with alert instincts, charm, and explosive movement.",
  Hobgoblin: "Disciplined tacticians who value drill, logistics, and coordinated force.",
  Kalashtar: "Dream-linked lineage balancing serene self-control with deep psychic undercurrents.",
  Kenku: "Mimicry masters with sharp observation, social adaptability, and unusual speech patterns.",
  Kobold: "Small draconic survivors thriving on traps, teamwork, and relentless cunning.",
  Leonin: "Proud lionfolk with commanding presence, fierce courage, and territorial confidence.",
  Lizardfolk: "Pragmatic survivalists who solve problems with cold logic and measured efficiency.",
  Loxodon: "Massive, thoughtful elephantine folk known for patience, memory, and reliability.",
  Minotaur: "Powerful horned warriors built for momentum, intimidation, and close-quarters pressure.",
  Orc: "Powerful and direct, Orcs are formidable in physical confrontations and hard campaigns.",
  Owlin: "Nocturnal owlfolk with silent movement, keen perception, and airy composure.",
  Plasmoid: "Amorphous beings with fluid forms, unconventional movement, and adaptable physiology.",
  Satyr: "Fey revelers of wit and passion, mixing charm, confidence, and magical resilience.",
  Shifter: "Bestial bloodline wanderers who channel primal instincts in bursts of transformation.",
  "Beasthide Shifter": "Shifter lineage emphasizing toughness, resilience, and blunt staying power.",
  "Longtooth Shifter": "Shifter lineage focused on aggression, pursuit, and close-combat ferocity.",
  "Swiftstride Shifter": "Shifter lineage tuned for speed, evasion, and hit-and-fade tactics.",
  "Wildhunt Shifter": "Shifter lineage centered on tracking, awareness, and relentless focus.",
  "Simic Hybrid": "Bio-altered lineage with adaptive body mods and engineered versatility.",
  Tabaxi: "Curious and fast, Tabaxi excel at mobility, scouting, and opportunistic action.",
  "Thri-kreen": "Alien insectoid hunters with rapid reflexes and deeply non-human instincts.",
  Tortle: "Shell-backed travelers with steady temperament and natural defensive confidence.",
  Triton: "Sea-born guardians often carrying noble duty and disciplined martial bearing.",
  Vedalken: "Analytical, methodical thinkers who prioritize precision and long-horizon planning.",
  Warforged: "Constructed beings with living minds, disciplined habits, and durable frames.",
  "Yuan-Ti Pureblood": "Serpentine bloodline known for controlled affect, subtle influence, and dangerous poise.",
};

const NPC_CLASS_DESCRIPTIONS: Record<string, string> = {
  Artificer: "Inventive support casters who blend magic with crafted tools and infused gear.",
  Barbarian: "Durable frontliners who trade finesse for raw damage and survivability through rage.",
  Bard: "Versatile performers who support allies and solve problems with broad utility magic.",
  "Blood Hunter": "Risk-reward martial specialists who channel forbidden rites into weapon combat.",
  Cleric: "Divine casters with strong healing, support, and domain-based combat tools.",
  Druid: "Nature spellcasters with adaptable magic and shapeshifting flexibility.",
  Fighter: "Reliable martial experts with strong action economy and broad weapon mastery.",
  Monk: "Mobile martial artists using ki for speed, control, and defensive tricks.",
  Paladin: "Armored holy warriors combining weapon pressure, auras, and burst smites.",
  Ranger: "Hunters and scouts blending martial pressure with terrain-aware utility magic.",
  Rogue: "Skill-focused skirmishers who excel at precision damage and infiltration.",
  Sorcerer: "Innate spellcasters with fewer spells but high flexibility through metamagic.",
  Warlock: "Pact casters with short-rest spell slots, strong cantrips, and patron-driven flavor.",
  Wizard: "Broadest arcane toolkit with unmatched spellbook flexibility and specialization schools.",
};

const NPC_SUBCLASS_DESCRIPTIONS: Record<string, string> = {
  Berserker: "A relentless rage path focused on all-out offense and intimidation.",
  "Path of the Totem Warrior": "A spiritual barbarian path channeling animal totems for distinct playstyles.",
  Champion: "A fighter archetype focused on straightforward consistency and critical pressure.",
  "Battle Master": "A tactical fighter archetype using maneuvers for control and precision.",
  "Eldritch Knight": "A martial fighter archetype that blends weapon combat with arcane casting.",
  Thief: "A rogue archetype built around agility, utility actions, and infiltration flow.",
  Assassin: "A rogue archetype optimized for ambushes, disguise play, and opening burst.",
  "Arcane Trickster": "A rogue archetype adding illusion/enchantment magic to stealth play.",
};

const SELECTABLE_NPC_SUBRACE_PARENT = new Map(
  RACE_GROUPS
    .flatMap((group) => group.races)
    .flatMap((raceEntry) => (raceEntry.subraces ?? []).map((subrace) => [subrace, raceEntry.base] as const)),
);

const SELECTABLE_NPC_SUBCLASS_PARENT = new Map(
  ALL_CLASSES
    .flatMap((entry) => entry.subclasses.map((subclassName) => [subclassName, entry.name] as const)),
);

function buildTailoredNpcSubraceDescription(subrace: string, parentRace: string): string {
  const lowered = subrace.toLowerCase();
  if (parentRace === "Tiefling") {
    const infernalPatron = subrace.replace(/\s*Tiefling$/i, "").trim();
    return `${subrace} is the ${infernalPatron} infernal lineage, giving this NPC a distinct devil-touched flavor that differs from other tiefling bloodlines in tone, magic style, and social pressure.`;
  }
  if (lowered.includes("sea") || lowered.includes("water")) {
    return `${subrace} is an aquatic ${parentRace} lineage tailored for oceanic adaptation, fluid movement, and maritime encounter flavor.`;
  }
  if (lowered.includes("shadow") || lowered.includes("shadar") || lowered.includes("drow") || lowered.includes("dark")) {
    return `${subrace} is a shadow-adapted ${parentRace} lineage with stealth-forward behavior, altered senses, and high-contrast social presence.`;
  }
  if (lowered.includes("high") || lowered.includes("rock") || lowered.includes("deep") || lowered.includes("arc")) {
    return `${subrace} is an intellectual ${parentRace} lineage focused on discipline, technical precision, and practiced magical or craft identity.`;
  }
  if (lowered.includes("wood") || lowered.includes("forest") || lowered.includes("wild") || lowered.includes("swift")) {
    return `${subrace} is a wilderness-oriented ${parentRace} lineage tuned for scouting tempo, tracking instincts, and terrain-aware movement.`;
  }
  return `${subrace} is a distinct ${parentRace} lineage with a tailored identity, tactical niche, and roleplay profile separate from sibling lineages.`;
}

function buildTailoredNpcSubclassDescription(subclass: string, className: string): string {
  const lowered = subclass.toLowerCase();
  if (className === "Wizard" && subclass.startsWith("School of ")) {
    const school = subclass.replace(/^School of\s+/i, "");
    return `${subclass} is the wizard discipline focused on ${school.toLowerCase()} specialization, giving this NPC a clearer arcane signature than a generalist mage.`;
  }
  if (lowered.includes("shadow") || lowered.includes("assassin") || lowered.includes("necrom") || lowered.includes("phantom")) {
    return `${subclass} is a ${className} path built around pressure through fear, secrecy, or attrition, making this NPC feel dangerous before direct confrontation starts.`;
  }
  if (lowered.includes("battle") || lowered.includes("champion") || lowered.includes("war") || lowered.includes("berserker")) {
    return `${subclass} is a ${className} specialization tuned for direct combat tempo, reliable action economy, and consistent battlefield impact.`;
  }
  if (lowered.includes("arcane") || lowered.includes("eldritch") || lowered.includes("scribe") || lowered.includes("hex")) {
    return `${subclass} is a ${className} hybrid track combining martial cadence with expanded magical expression and layered tactical choices.`;
  }
  return `${subclass} is a tailored ${className} specialization with its own encounter rhythm, feature priorities, and narrative identity.`;
}

const NPC_ELF_LINEAGE_TRAITS: Record<string, Array<{ name: string; description: string }>> = {
  "High Elf": [
    { name: "Cantrip", description: "Knows one wizard cantrip by lineage." },
    { name: "Extra Language", description: "Commonly trained with an extra language." },
  ],
  "Wood Elf": [
    { name: "Fleet of Foot", description: "Typically faster base movement than most humanoids." },
    { name: "Mask of the Wild", description: "Naturally adept at hiding in lightly obscured terrain." },
  ],
  Drow: [
    { name: "Superior Darkvision", description: "Exceptional darkvision adapted for subterranean life." },
    { name: "Sunlight Sensitivity", description: "May struggle in direct, bright sunlight conditions." },
    { name: "Drow Magic", description: "Innate spellcasting tendencies appear in many lineages." },
  ],
  Eladrin: [
    { name: "Fey Step", description: "Short-range magical repositioning tied to fey lineage." },
  ],
  "Sea Elf": [
    { name: "Child of the Sea", description: "Strong adaptation to aquatic environments." },
    { name: "Friend of the Sea", description: "Natural affinity communicating with marine beasts." },
  ],
  "Shadar-Kai": [
    { name: "Raven Queen Blessing", description: "Shadow-touched mobility and defensive resilience." },
  ],
};

function resolveNpcRaceDescription(race: string): string | undefined {
  const trimmed = race.trim();
  if (!trimmed) return undefined;
  if (NPC_RACE_DESCRIPTIONS[trimmed]) return NPC_RACE_DESCRIPTIONS[trimmed];

  const selectableParent = SELECTABLE_NPC_SUBRACE_PARENT.get(trimmed);
  if (selectableParent) return buildTailoredNpcSubraceDescription(trimmed, selectableParent);

  const parent = RACE_GROUPS
    .flatMap((g) => g.races)
    .find((r) => r.base === trimmed || r.subraces?.includes(trimmed));
  if (parent?.base && NPC_RACE_DESCRIPTIONS[parent.base]) return NPC_RACE_DESCRIPTIONS[parent.base];
  if (parent?.base) return `${trimmed} is a ${parent.base} lineage with distinct heritage traits and roleplay flavor.`;
  return `${trimmed} has distinct lineage traits, cultural flavor, and mechanical identity in most 5e settings.`;
}

function resolveNpcClassDescription(className: string): string | undefined {
  const trimmed = className.trim();
  if (!trimmed) return undefined;
  if (NPC_CLASS_DESCRIPTIONS[trimmed]) return NPC_CLASS_DESCRIPTIONS[trimmed];
  return `${trimmed} defines a clear role through feature cadence, action economy, and growth path.`;
}

function resolveNpcSubclassDescription(subclass: string, className: string): string | undefined {
  const trimmedSubclass = subclass.trim();
  if (!trimmedSubclass) return undefined;
  if (NPC_SUBCLASS_DESCRIPTIONS[trimmedSubclass]) return NPC_SUBCLASS_DESCRIPTIONS[trimmedSubclass];

  const canonicalClass = SELECTABLE_NPC_SUBCLASS_PARENT.get(trimmedSubclass);
  if (canonicalClass) return buildTailoredNpcSubclassDescription(trimmedSubclass, canonicalClass);

  const trimmedClass = className.trim();
  if (!trimmedClass) return `${trimmedSubclass} is a specialization path with unique feature and flavor hooks.`;
  return `${trimmedSubclass} is a ${trimmedClass} specialization with unique feature and progression hooks.`;
}

function deriveNpcLineageTraits(race: string): Array<{ name: string; description: string; source: string }> {
  const normalized = race.trim().toLowerCase();
  if (!normalized) return [];

  const traits: Array<{ name: string; description: string; source: string }> = [];
  if (normalized.includes("elf") || normalized.includes("eladrin") || normalized.includes("shadar-kai") || normalized.includes("drow")) {
    traits.push(
      {
        name: "Darkvision",
        description: "Can see in darkness as dim light within racial range.",
        source: race,
      },
      {
        name: "Fey Ancestry",
        description: "Strong resistance to charm effects and magical sleep.",
        source: race,
      },
      {
        name: "Trance",
        description: "Rest cycle often uses meditative semi-consciousness.",
        source: race,
      },
    );
  }

  const lineageEntry = Object.entries(NPC_ELF_LINEAGE_TRAITS).find(([k]) => normalized.includes(k.toLowerCase()));
  if (lineageEntry) {
    for (const trait of lineageEntry[1]) {
      traits.push({
        name: trait.name,
        description: trait.description,
        source: lineageEntry[0],
      });
    }
  }

  return traits;
}

interface NPCState {
  inventory: InventoryItem[];
  name: string;
  gender: string;
  race: string;
  age: string;
  alignment: string;
  occupation: string;
  background: string;
  charClass: string;
  subclass: string;
  level: string;
  personalityTrait1: string;
  personalityTrait2: string;
  ideal: string;
  bond: string;
  flaw: string;
  questTags: string[];
  peopleTags: string[];
  locationTags: string[];
  planeTags: string[];
  appearance: string;
  secret: string;
  notes: string;
  str: string; dex: string; con: string;
  int: string; wis: string; cha: string;
}

function emptyNPC(): NPCState {
  return {
    inventory: [],
    name: "", gender: "", race: "", age: "", alignment: "",
    occupation: "", background: "", charClass: "", subclass: "", level: "1",
    personalityTrait1: "", personalityTrait2: "",
    ideal: "", bond: "", flaw: "", questTags: [], peopleTags: [], locationTags: [], planeTags: [],
    appearance: "", secret: "", notes: "",
    str: "10", dex: "10", con: "10", int: "10", wis: "10", cha: "10",
  };
}

const DM_NPCS_KEY = "dm_saved_npcs";
const DM_NPC_EDIT_KEY = "dm_npc_edit_payload";

export interface SavedDmNpc extends NPCState {
  id: string;
  savedAt: number;
}

export async function getSavedDmNpcs(): Promise<SavedDmNpc[]> {
  try {
    const raw = await AsyncStorage.getItem(DM_NPCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedDmNpc[];
    return Array.isArray(parsed) ? parsed.map((entry) => normalizeSavedDmNpcRecord(entry)) : [];
  } catch {
    return [];
  }
}

async function saveDmNpcToStorage(npc: NPCState): Promise<void> {
  const all = await getSavedDmNpcs();
  const entry = normalizeSavedDmNpcRecord<SavedDmNpc>({
    ...npc,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    savedAt: Date.now(),
  });
  await AsyncStorage.setItem(DM_NPCS_KEY, JSON.stringify([entry, ...all]));
}

async function upsertSavedDmNpc(npc: NPCState, id?: string): Promise<"created" | "updated"> {
  if (!id) {
    await saveDmNpcToStorage(npc);
    return "created";
  }

  const all = await getSavedDmNpcs();
  const existing = all.find((entry) => entry.id === id);
  if (!existing) {
    await saveDmNpcToStorage(npc);
    return "created";
  }

  const updated = normalizeSavedDmNpcRecord<SavedDmNpc>({
    ...existing,
    ...npc,
    id,
    savedAt: Date.now(),
  });
  const next = all.map((entry) => (entry.id === id ? updated : entry));
  await AsyncStorage.setItem(DM_NPCS_KEY, JSON.stringify(next));
  return "updated";
}

export async function queueDmNpcForEditing(npc: SavedDmNpc): Promise<void> {
  await AsyncStorage.setItem(DM_NPC_EDIT_KEY, JSON.stringify(npc));
}

async function consumeQueuedDmNpcEdit(): Promise<SavedDmNpc | null> {
  try {
    const raw = await AsyncStorage.getItem(DM_NPC_EDIT_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(DM_NPC_EDIT_KEY);
    return normalizeSavedDmNpcRecord(JSON.parse(raw) as SavedDmNpc);
  } catch {
    return null;
  }
}

export async function deleteSavedDmNpc(id: string): Promise<void> {
  const all = await getSavedDmNpcs();
  await AsyncStorage.setItem(DM_NPCS_KEY, JSON.stringify(all.filter((n) => n.id !== id)));
}

function mod(score: number): string {
  const m = Math.floor((Number(score) - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function generateAppearanceFallback(npc: NPCState): string {
  const name = npc.name?.trim() || "This figure";
  const race = npc.race?.trim() || "humanoid";
  const age = npc.age?.trim() || "adult";
  const gender = npc.gender?.trim() || "";
  const str = Number(npc.str) || 10;
  const dex = Number(npc.dex) || 10;
  const con = Number(npc.con) || 10;

  const build = str >= 15
    ? "broad-shouldered and powerfully built"
    : dex >= 15
      ? "lean and quick-moving"
      : con >= 15
        ? "thick-set and sturdy"
        : "of average build";

  const bearing = dex >= 14
    ? "Every movement is measured and precise"
    : str >= 14
      ? "They carry themselves with grounded confidence"
      : "Their posture is relaxed but alert";

  const attire = npc.occupation
    ? `Their clothes and gear clearly reflect their work as a ${npc.occupation.toLowerCase()}`
    : npc.charClass
      ? `Their clothing and equipment suggest someone trained as a ${npc.charClass.toLowerCase()}`
      : "Their attire is practical and road-worn";

  const visibleDetail = npc.background
    ? `Small details in their dress hint at a ${npc.background.toLowerCase()} background.`
    : "A few small scars and worn details suggest long experience in dangerous places.";

  const intro = `${name} is ${gender ? `${gender.toLowerCase()} ` : ""}${race.toLowerCase()} (${age.toLowerCase()}), ${build}.`;
  return `${intro} ${bearing}. ${attire}. ${visibleDetail}`;
}

export default function DmNpcScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [dmQuests, setDmQuests] = useState<Quest[]>([]);
  const [dmPeople, setDmPeople] = useState<NpcPerson[]>([]);
  const [dmLocations, setDmLocations] = useState<CampaignLocation[]>([]);
  const [dmPlanes, setDmPlanes] = useState<Plane[]>([]);
  const [npc, setNpc] = useState<NPCState>(emptyNPC);
  const [section, setSection] = useState<"identity" | "stats" | "personality" | "quest" | "gear" | "secrets">("identity");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingNpcId, setEditingNpcId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [isGeneratingAppearance, setIsGeneratingAppearance] = useState(false);
  const clearStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gearMode, setGearMode] = useState<GearSelectionMode>("strict");
  const [strictPackageId, setStrictPackageId] = useState<string>("");
  const [presetId, setPresetId] = useState<string>("");
  const [category, setCategory] = useState<CreationGearFilterCategory>("all");
  const [freeSelections, setFreeSelections] = useState<Record<string, number>>({});
  
  // Race/class selector state
  const [raceGroup, setRaceGroup] = useState(RACE_GROUPS[0].label);
  const [activeParentRace, setActiveParentRace] = useState<string | null>(null);

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    if (clearStatusTimer.current) clearTimeout(clearStatusTimer.current);
    clearStatusTimer.current = setTimeout(() => setStatusMessage(null), 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (clearStatusTimer.current) clearTimeout(clearStatusTimer.current);
    };
  }, []);

  useEffect(() => {
    getDmNotesPayload().then((payload) => {
      setDmQuests(payload.quests);
      setDmPeople(payload.people);
      setDmLocations(payload.locations);
      setDmPlanes(payload.planes ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const pendingEdit = await consumeQueuedDmNpcEdit();
      if (!pendingEdit) return;
      const { id, savedAt: _savedAt, ...editable } = pendingEdit;
      setNpc({
        ...emptyNPC(),
        ...editable,
        level: String(editable.level ?? "1"),
      });
      setEditingNpcId(id);
      setSection("identity");
      showStatus(`Editing ${editable.name || "saved NPC"}.`);
    })();
  }, [showStatus]);

  const set = useCallback((key: keyof NPCState, val: string | string[]) => {
    setNpc((prev) => ({ ...prev, [key]: val }));
  }, []);

  // Compute current race group and parent/subrace state
  const currentRaceGroup = useMemo(
    () => RACE_GROUPS.find((g) => g.label === raceGroup) ?? RACE_GROUPS[0],
    [raceGroup],
  );

  const selectedParentRace = useMemo(() => {
    for (const g of RACE_GROUPS) {
      for (const r of g.races) {
        if (r.base === npc.race || r.subraces?.includes(npc.race)) return r;
      }
    }
    return null;
  }, [npc.race]);

  const expandedParentData = useMemo(
    () => RACE_GROUPS.flatMap((g) => g.races).find((r) => r.base === activeParentRace) ?? null,
    [activeParentRace],
  );

  const selectedClassEntry = useMemo(
    () => ALL_CLASSES.find((entry) => entry.name === npc.charClass) ?? null,
    [npc.charClass],
  );

  // Compute age category for display
  const ageCategory = useMemo(
    () => (npc.age && npc.race ? computeAgeCategory(Number(npc.age) || 0, npc.race) : null),
    [npc.age, npc.race],
  );

  const lifespan = useMemo(() => getRaceLifespan(npc.race), [npc.race]);
  const npcRaceDescription = useMemo(() => resolveNpcRaceDescription(npc.race), [npc.race]);
  const npcLineageTraits = useMemo(() => deriveNpcLineageTraits(npc.race), [npc.race]);
  const npcClassDescription = useMemo(() => resolveNpcClassDescription(npc.charClass), [npc.charClass]);
  const npcSubclassDescription = useMemo(
    () => resolveNpcSubclassDescription(npc.subclass, npc.charClass),
    [npc.subclass, npc.charClass],
  );

  const handleInventoryUpdate = useCallback((items: InventoryItem[]) => {
    setNpc((prev) => ({ ...prev, inventory: items }));
  }, []);

  const randomizeNpcGear = useCallback((className: string, forcedMode?: GearSelectionMode) => {
    const randomGear = buildRandomCreationGearSelection({
      className: className || "Fighter",
      mode: forcedMode,
    });
    setGearMode(randomGear.mode);
    setStrictPackageId(randomGear.strictPackageId);
    setPresetId(randomGear.presetId);
    setCategory(randomGear.category);
    const nextSelections = randomGear.mode === "free" ? randomGear.freeChoices : randomGear.bonusChoices;
    setFreeSelections(
      Object.fromEntries(nextSelections.map((choice) => [choice.name, Math.max(1, choice.quantity)])),
    );
  }, []);

  const generateAppearanceWithAiForNpc = useCallback(async (npcToGenerate: NPCState, showMessage = true) => {
    try {
      setIsGeneratingAppearance(true);
      const res = await fetch(`${API_BASE_URL}/api/ai/npc-appearance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npc: npcToGenerate }),
      });
      if (!res.ok) {
        const fallback = generateAppearanceFallback(npcToGenerate);
        set("appearance", fallback);
        if (showMessage) showStatus("AI unavailable - used smart local appearance.");
        return;
      }
      const data = (await res.json()) as { appearance?: string };
      const text = typeof data.appearance === "string" ? data.appearance.trim() : "";
      if (!text) {
        const fallback = generateAppearanceFallback(npcToGenerate);
        set("appearance", fallback);
        if (showMessage) showStatus("AI returned empty result - used local appearance.");
        return;
      }
      set("appearance", text);
      if (showMessage) showStatus("AI generated appearance.");
    } catch (err) {
      const fallback = generateAppearanceFallback(npcToGenerate);
      set("appearance", fallback);
      if (showMessage) showStatus("AI request failed - used smart local appearance.");
    } finally {
      setIsGeneratingAppearance(false);
    }
  }, [set, showStatus]);

  const randomizeAll = useCallback(() => {
    const gen = generateRandomNPC();
    const genderLabel = gen.gender === "Female" ? "Female" : gen.gender === "Non-binary" ? "Non-binary" : "Male";
    const randomClassEntry = roll(ALL_CLASSES);
    const randomClass = randomClassEntry.name;
    const randomSubclass = randomClassEntry.subclasses.length > 0 ? roll(randomClassEntry.subclasses) : "";
    const newNpc: NPCState = {
      inventory: [],
      name: gen.name,
      gender: genderLabel,
      race: gen.race,
      age: gen.age,
      alignment: gen.alignment,
      occupation: gen.occupation,
      background: roll(ALL_BACKGROUNDS),
      charClass: randomClass,
      subclass: randomSubclass,
      level: String(Math.floor(Math.random() * 5) + 1),
      personalityTrait1: gen.personalityTrait1,
      personalityTrait2: gen.personalityTrait2,
      ideal: gen.ideal,
      bond: gen.bond,
      flaw: gen.flaw,
      questTags: [], peopleTags: [], locationTags: [], planeTags: [],
      appearance: gen.appearance,
      secret: gen.secret,
      notes: "",
      str: String(gen.abilityScores.str),
      dex: String(gen.abilityScores.dex),
      con: String(gen.abilityScores.con),
      int: String(gen.abilityScores.int),
      wis: String(gen.abilityScores.wis),
      cha: String(gen.abilityScores.cha),
    };
    setNpc(newNpc);
    randomizeNpcGear(randomClass);
    generateAppearanceWithAiForNpc(newNpc, false);
  }, [generateAppearanceWithAiForNpc, randomizeNpcGear]);

  const rollScores = useCallback(() => {
    setNpc((prev) => ({
      ...prev,
      str: String(roll4d6DropLowest()),
      dex: String(roll4d6DropLowest()),
      con: String(roll4d6DropLowest()),
      int: String(roll4d6DropLowest()),
      wis: String(roll4d6DropLowest()),
      cha: String(roll4d6DropLowest()),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!npc.name.trim()) {
      Alert.alert("Name required", "Give the NPC a name before saving.");
      return;
    }
    try {
      const result = await upsertSavedDmNpc(npc, editingNpcId ?? undefined);
      if (result === "updated") {
        showStatus(`${npc.name} updated in DM Tools.`);
      } else {
        showStatus(`${npc.name} saved to DM Tools.`);
      }
    } catch {
      Alert.alert("Error", "Could not save NPC.");
    }
  }, [npc, editingNpcId, showStatus]);

  const generateAppearanceWithAi = useCallback(async () => {
    await generateAppearanceWithAiForNpc(npc);
  }, [npc, generateAppearanceWithAiForNpc]);

  const applyImportedNpc = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Partial<NPCState>;
      const merged: NPCState = {
        ...emptyNPC(),
        ...parsed,
        inventory: normalizeSavedDmNpcRecord({ inventory: parsed.inventory }).inventory,
        level: String(parsed.level ?? "1"),
      };
      setNpc(merged);
      setSection("identity");
      setImportModalOpen(false);
      setImportJsonText("");
      showStatus(`Imported ${merged.name || "NPC"} from JSON.`);
    } catch {
      Alert.alert("Invalid JSON", "Could not parse NPC JSON. Please paste valid JSON and try again.");
    }
  }, [showStatus]);

  const handleExport = useCallback(() => {
    const text = [
      `NPC: ${npc.name}`,
      `${npc.gender} ${npc.race} — ${npc.age}`,
      `Alignment: ${npc.alignment}`,
      `Occupation: ${npc.occupation}`,
      npc.background ? `Background: ${npc.background}` : "",
      npc.charClass ? `Class: ${npc.charClass}${npc.subclass ? ` (${npc.subclass})` : ""} (Level ${npc.level})` : "",
      "",
      "═══ PERSONALITY ═══",
      npc.personalityTrait1 ? `• ${npc.personalityTrait1}` : "",
      npc.personalityTrait2 ? `• ${npc.personalityTrait2}` : "",
      npc.ideal ? `Ideal: ${npc.ideal}` : "",
      npc.bond ? `Bond: ${npc.bond}` : "",
      npc.flaw ? `Flaw: ${npc.flaw}` : "",
      npc.questTags.length > 0 ? `Linked to ${npc.questTags.length} quest(s)` : "",
      "",
      "═══ APPEARANCE & SECRETS ═══",
      npc.appearance ? `Appearance: ${npc.appearance}` : "",
      npc.secret ? `Secret: ${npc.secret}` : "",
      "",
      "═══ ABILITY SCORES ═══",
      `STR ${npc.str} (${mod(Number(npc.str))})  DEX ${npc.dex} (${mod(Number(npc.dex))})  CON ${npc.con} (${mod(Number(npc.con))})`,
      `INT ${npc.int} (${mod(Number(npc.int))})  WIS ${npc.wis} (${mod(Number(npc.wis))})  CHA ${npc.cha} (${mod(Number(npc.cha))})`,
      npc.notes ? `\nNotes: ${npc.notes}` : "",
    ].filter(Boolean).join("\n");

    Share.share({ message: text });
  }, [npc]);

  const topPad = Platform.OS === "web" ? 16 : insets.top;

  const TABS = [
    { id: "identity", label: "Identity" },
    { id: "stats", label: "Stats" },
    { id: "personality", label: "Traits" },
    { id: "quest", label: "Quest Tie-In" },
    { id: "gear", label: "Gear" },
    { id: "secrets", label: "Secrets" },
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: c.border, backgroundColor: c.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.foreground }]}>NPC Creator</Text>
          <Text style={[styles.headerSub, { color: c.mutedForeground }]}>
            {editingNpcId ? "Edit saved NPC" : "Build or randomly generate NPCs"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={randomizeAll}
          style={[styles.randomBtn, { backgroundColor: c.primary }]}
        >
          <Feather name="shuffle" size={14} color="#fff" />
          <Text style={styles.randomBtnText}>Roll All</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} style={[styles.iconBtn, { borderColor: c.border }]}>
          <Feather name="save" size={18} color={c.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setImportModalOpen(true)} style={[styles.iconBtn, { borderColor: c.border }]}>
          <Feather name="download" size={18} color={c.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleExport} style={[styles.iconBtn, { borderColor: c.border }]}>
          <Feather name="share-2" size={18} color={c.foreground} />
        </TouchableOpacity>
      </View>

      <Modal visible={importModalOpen} transparent animationType="fade" onRequestClose={() => setImportModalOpen(false)}>
        <View style={styles.importBackdrop}>
          <View style={[styles.importCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.importTitle, { color: c.foreground }]}>Import NPC JSON</Text>
            <Text style={[styles.importHint, { color: c.mutedForeground }]}>Paste an NPC JSON object to load it into the editor.</Text>
            <TextInput
              value={importJsonText}
              onChangeText={setImportJsonText}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              placeholder='{"name":"Aela","race":"Wood Elf"}'
              placeholderTextColor={c.mutedForeground}
              style={[styles.importInput, { color: c.foreground, backgroundColor: c.background, borderColor: c.border }]}
            />
            <TouchableOpacity
              onPress={() => applyImportedNpc(importJsonText.trim())}
              style={[styles.importBtn, { backgroundColor: c.primary, borderColor: c.primary }]}
            >
              <Text style={[styles.importBtnText, { color: "#fff" }]}>Import</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Section tabs */}
      <View style={[styles.tabRow, { borderBottomColor: c.border, backgroundColor: c.card }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setSection(t.id)}
            style={[styles.tab, { borderBottomColor: section === t.id ? c.primary : "transparent" }]}
          >
            <Text style={[styles.tabText, { color: section === t.id ? c.primary : c.mutedForeground }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollHintScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {statusMessage ? (
          <View style={[styles.statusBanner, { backgroundColor: c.primary + "22", borderColor: c.primary + "55" }]}>
            <Feather name="check-circle" size={14} color={c.primary} />
            <Text style={[styles.statusBannerText, { color: c.foreground }]}>{statusMessage}</Text>
          </View>
        ) : null}

        {/* Shared form sections for identity/stats/personality */}
        {["identity", "stats", "personality"].includes(section) && (
          <CharacterSheetFormCore
            formData={{
              name: npc.name,
              gender: npc.gender,
              race: npc.race,
              charClass: npc.charClass,
              subclass: npc.subclass,
              level: npc.level,
              age: npc.age,
              alignment: npc.alignment,
              occupation: npc.occupation,
              background: npc.background,
              str: npc.str,
              dex: npc.dex,
              con: npc.con,
              int: npc.int,
              wis: npc.wis,
              cha: npc.cha,
              personalityTrait1: npc.personalityTrait1,
              personalityTrait2: npc.personalityTrait2,
              ideal: npc.ideal,
              bond: npc.bond,
              flaw: npc.flaw,
              appearance: npc.appearance,
            }}
            onChange={(key, value) => set(key as keyof NPCState, value)}
            section={section as CharacterSheetFormSection}
            onSectionChange={() => {}} // Tabs controlled by parent dm-npc component
            raceDescriptions={NPC_RACE_DESCRIPTIONS}
            classDescriptions={NPC_CLASS_DESCRIPTIONS}
            subclassDescriptions={NPC_SUBCLASS_DESCRIPTIONS}
            showTabs={false}
          />
        )}

        {section === "quest" && (
          <View style={styles.section}>
            <View style={[styles.questTieInIntro, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.fieldLabel, { color: c.foreground }]}>quest tie in (optional)</Text>
              <Text style={[styles.scoreHelp, { color: c.mutedForeground, marginBottom: 0 }]}>
                attatch this character to campaign quests,people,locations and planes
              </Text>
            </View>

            {dmQuests.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>Quests ({npc.questTags.length})</Text>
                <View style={styles.chipGroup}>
                  {dmQuests.map((quest: any) => (
                    <TouchableOpacity
                      key={quest.id}
                      style={[
                        styles.chip,
                        {
                          borderColor: npc.questTags.includes(quest.id) ? c.primary : c.border,
                          backgroundColor: npc.questTags.includes(quest.id) ? c.primary + "22" : c.card,
                        },
                      ]}
                      onPress={() => {
                        const isSelected = npc.questTags.includes(quest.id);
                        set("questTags", isSelected
                          ? npc.questTags.filter((id) => id !== quest.id)
                          : [...npc.questTags, quest.id]
                        );
                      }}
                    >
                      <Text style={[styles.chipText, { color: npc.questTags.includes(quest.id) ? c.primary : c.mutedForeground }]}>{quest.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {dmPeople.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>People ({npc.peopleTags.length})</Text>
                <View style={styles.chipGroup}>
                  {dmPeople.map((person: any) => (
                    <TouchableOpacity
                      key={person.id}
                      style={[
                        styles.chip,
                        {
                          borderColor: npc.peopleTags.includes(person.id) ? c.primary : c.border,
                          backgroundColor: npc.peopleTags.includes(person.id) ? c.primary + "22" : c.card,
                        },
                      ]}
                      onPress={() => {
                        const isSelected = npc.peopleTags.includes(person.id);
                        set("peopleTags", isSelected
                          ? npc.peopleTags.filter((id) => id !== person.id)
                          : [...npc.peopleTags, person.id]
                        );
                      }}
                    >
                      <Text style={[styles.chipText, { color: npc.peopleTags.includes(person.id) ? c.primary : c.mutedForeground }]}>{person.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {dmLocations.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>Locations ({npc.locationTags.length})</Text>
                <View style={styles.chipGroup}>
                  {dmLocations.map((location: any) => (
                    <TouchableOpacity
                      key={location.id}
                      style={[
                        styles.chip,
                        {
                          borderColor: npc.locationTags.includes(location.id) ? c.primary : c.border,
                          backgroundColor: npc.locationTags.includes(location.id) ? c.primary + "22" : c.card,
                        },
                      ]}
                      onPress={() => {
                        const isSelected = npc.locationTags.includes(location.id);
                        set("locationTags", isSelected
                          ? npc.locationTags.filter((id) => id !== location.id)
                          : [...npc.locationTags, location.id]
                        );
                      }}
                    >
                      <Text style={[styles.chipText, { color: npc.locationTags.includes(location.id) ? c.primary : c.mutedForeground }]}>{location.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {dmPlanes.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>Planes ({npc.planeTags.length})</Text>
                <View style={styles.chipGroup}>
                  {dmPlanes.map((plane) => (
                    <TouchableOpacity
                      key={plane.id}
                      style={[
                        styles.chip,
                        {
                          borderColor: npc.planeTags.includes(plane.id) ? c.primary : c.border,
                          backgroundColor: npc.planeTags.includes(plane.id) ? c.primary + "22" : c.card,
                        },
                      ]}
                      onPress={() => {
                        const isSelected = npc.planeTags.includes(plane.id);
                        set("planeTags", isSelected
                          ? npc.planeTags.filter((id) => id !== plane.id)
                          : [...npc.planeTags, plane.id]
                        );
                      }}
                    >
                      <Feather name="globe" size={11} color={npc.planeTags.includes(plane.id) ? c.primary : c.mutedForeground} />
                      <Text style={[styles.chipText, { color: npc.planeTags.includes(plane.id) ? c.primary : c.mutedForeground }]}>{plane.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {dmQuests.length === 0 && dmPeople.length === 0 && dmLocations.length === 0 && dmPlanes.length === 0 && (
              <Text style={[styles.scoreHelp, { color: c.mutedForeground }]}>
                No quests, people, locations, or planes defined yet. Create them in the campaign journal to link them here.
              </Text>
            )}
          </View>
        )}

        {section === "gear" && (
          <DmNpcGearPicker
            npc={npc}
            gearMode={gearMode}
            setGearMode={setGearMode}
            strictPackageId={strictPackageId}
            setStrictPackageId={setStrictPackageId}
            presetId={presetId}
            setPresetId={setPresetId}
            category={category}
            setCategory={setCategory}
            freeSelections={freeSelections}
            setFreeSelections={setFreeSelections}
            onInventoryUpdate={handleInventoryUpdate}
          />
        )}

        {section === "secrets" && (
          <View style={styles.section}>
            <FieldRow label="Appearance" hint="Best generated after identity and traits are filled.">
              <RowInput
                value={npc.appearance}
                onChange={(v) => set("appearance", v)}
                multiline
                placeholder="Distinctive features, clothing, and visible details..."
              />
              <RollBtn onPress={() => set("appearance", roll(NPC_APPEARANCE))} />
            </FieldRow>
            <TouchableOpacity
              onPress={generateAppearanceWithAi}
              disabled={isGeneratingAppearance}
              style={[
                styles.aiAppearanceBtn,
                { backgroundColor: c.card, borderColor: c.border, opacity: isGeneratingAppearance ? 0.6 : 1 },
              ]}
            >
              <Feather name="cpu" size={15} color={c.primary} />
              <Text style={[styles.aiAppearanceBtnText, { color: c.primary }]}>
                {isGeneratingAppearance ? "Generating appearance..." : "AI Generate Appearance"}
              </Text>
            </TouchableOpacity>

            <FieldRow label="Secret">
              <RowInput value={npc.secret} onChange={(v) => set("secret", v)} multiline placeholder="What they're hiding…" />
              <RollBtn onPress={() => set("secret", roll(NPC_SECRETS))} />
            </FieldRow>
            <FieldRow label="DM Notes">
              <RowInput
                value={npc.notes}
                onChange={(v) => set("notes", v)}
                multiline
                placeholder="Hooks, plot relevance, relationships…"
              />
            </FieldRow>

            {/* Summary preview */}
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.cardTitle, { color: c.foreground }]}>NPC Summary</Text>
              <SummaryRow label="Name" value={npc.name} c={c} />
              <SummaryRow label="Identity" value={[npc.gender, npc.race, npc.age].filter(Boolean).join(" · ")} c={c} />
              <SummaryRow label="Alignment" value={npc.alignment} c={c} />
              <SummaryRow label="Occupation" value={npc.occupation} c={c} />
              {npc.charClass && <SummaryRow label="Class" value={`${npc.charClass}${npc.subclass ? ` (${npc.subclass})` : ""} Lv${npc.level}`} c={c} />}
              <SummaryRow label="Trait" value={npc.personalityTrait1} c={c} />
              <SummaryRow label="Ideal" value={npc.ideal} c={c} />
              <SummaryRow label="Flaw" value={npc.flaw} c={c} />
              <SummaryRow label="Linked" value={`${npc.questTags.length} quest(s), ${npc.peopleTags.length} person(s), ${npc.locationTags.length} location(s), ${npc.planeTags.length} plane(s)`} c={c} />
              <SummaryRow label="Appearance" value={npc.appearance} c={c} />
              <SummaryRow label="Secret" value={npc.secret} c={c} />
            </View>

            <TouchableOpacity
              onPress={randomizeAll}
              style={[styles.bigBtn, { backgroundColor: c.primary }]}
            >
              <Feather name="shuffle" size={18} color="#fff" />
              <Text style={styles.bigBtnText}>Randomize Entire NPC</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              style={[styles.bigBtn, { backgroundColor: c.primary }]}
            >
              <Feather name="save" size={18} color="#fff" />
              <Text style={styles.bigBtnText}>Save to DM Tools</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExport}
              style={[styles.bigBtn, { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 }]}
            >
              <Feather name="share-2" size={18} color={c.foreground} />
              <Text style={[styles.bigBtnText, { color: c.foreground }]}>Share / Export</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollHintScrollView>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: c.foreground }]}>{label}</Text>
      {hint && <Text style={[styles.fieldHint, { color: c.mutedForeground }]}>{hint}</Text>}
      <View style={styles.fieldInput}>{children}</View>
    </View>
  );
}

function RowInput({
  value, onChange, placeholder, multiline,
}: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  const c = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.mutedForeground}
      multiline={multiline}
      style={[
        styles.rowInput,
        { color: c.foreground, backgroundColor: c.secondary, borderColor: c.border },
        multiline && { minHeight: 72, textAlignVertical: "top" },
      ]}
    />
  );
}

function RollBtn({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.rollBtn, { backgroundColor: c.primary + "20", borderColor: c.primary + "60" }]}
    >
      <Text style={[styles.rollBtnText, { color: c.primary }]}>🎲</Text>
    </TouchableOpacity>
  );
}

function ChipGroup({ chips, value, onChange }: { chips: readonly string[]; value: string; onChange: (v: string) => void }) {
  const c = useColors();
  return (
    <View style={styles.chipGroup}>
      {chips.map((chip) => (
        <TouchableOpacity
          key={chip}
          onPress={() => onChange(chip)}
          style={[
            styles.chip,
            {
              backgroundColor: value === chip ? c.primary + "25" : c.card,
              borderColor: value === chip ? c.primary : c.border,
            },
          ]}
        >
          <Text style={[styles.chipText, { color: value === chip ? c.primary : c.mutedForeground }]}>
            {chip}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SummaryRow({ label, value, c }: { label: string; value: string; c: ReturnType<typeof useColors> }) {
  if (!value) return null;
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: c.mutedForeground }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: c.foreground }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerSub: { fontSize: 11, marginTop: 1 },
  randomBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
  },
  randomBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  tabRow: {
    flexDirection: "row", borderBottomWidth: 1,
  },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2,
  },
  tabText: { fontSize: 13, fontWeight: "600" },

  content: { padding: 16, gap: 16 },
  section: { gap: 14 },
  statusBanner: {
    borderWidth: 1,
    borderRadius: 10 * 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBannerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  importBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 18,
  },
  importCard: {
    borderWidth: 1,
    borderRadius: 10 * 1.5,
    padding: 14,
    gap: 10,
  },
  importTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  importHint: {
    fontSize: 12,
  },
  importInput: {
    minHeight: 170,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    textAlignVertical: "top",
  },
  importActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  importBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  importBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },

  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  fieldHint: { fontSize: 11, marginTop: -2 },
  fieldInput: { flexDirection: "row", alignItems: "flex-start", gap: 8 },

  rowInput: {
    flex: 1, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14,
  },
  rollBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  rollBtnText: { fontSize: 18 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipGroup: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "500" },

  aiAppearanceBtn: {
    marginTop: -4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  aiAppearanceBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },

  alignGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  alignChip: {
    paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1, minWidth: 48, alignItems: "center",
  },
  alignChipText: { fontSize: 10, fontWeight: "700" },

  groupTabPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  groupTabHeading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  groupTabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  groupTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  groupTabText: { fontSize: 12, fontWeight: "600" },
  groupTabHint: { fontSize: 11 },

  raceSelectorStack: {
    width: "100%",
    gap: 8,
  },

  infoCard: { flexDirection: "row", gap: 7, padding: 10, borderRadius: 10, borderWidth: 1 },
  infoCardText: { flex: 1, fontSize: 12, lineHeight: 18 },

  levelChip: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  card: {
    borderWidth: 1, borderRadius: 10 * 1.5, padding: 14, gap: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  scoreHelp: { fontSize: 11, marginTop: -4, marginBottom: 2 },

  scoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    columnGap: 8,
    width: "100%",
    paddingHorizontal: 8,
  },
  scoreBox: {
    width: "24.8%",
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center", justifyContent: "center", gap: 0,
  },
  scoreLabel: { fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  scoreInputRow: { flexDirection: "row", alignItems: "center", gap: 1 },
  scoreAdjustBtn: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  scoreAdjustText: { fontSize: 18, fontWeight: "700", lineHeight: 18 },
  scoreInput: { fontSize: 27, fontWeight: "800", textAlign: "center", width: 40, paddingVertical: 0 },
  scoreMod: { fontSize: 18, fontWeight: "600" },

  summaryRow: { flexDirection: "row", gap: 8 },
  summaryLabel: { width: 80, fontSize: 12, fontWeight: "600", flexShrink: 0 },
  summaryValue: { flex: 1, fontSize: 12, lineHeight: 18 },

  bigBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16, borderRadius: 10 * 1.5,
  },
  bigBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  tagSection: { gap: 8, marginTop: 12 },
  questTieInIntro: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  tagSectionLabel: { fontSize: 12, fontWeight: "600" },
});
