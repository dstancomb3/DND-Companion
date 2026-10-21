import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { API_BASE_URL } from "@/utils/apiUrl";
import { fetchOpen5eFeats } from "@/utils/open5eApi";
import { PHB_FEATS } from "@/data/phbFeats";
import {
  inferFeatSpellProgression,
  type FeatSpellFilter,
  type FeatSpellProgression,
} from "@/data/featProgression";
import type { AbilityScores, Open5eFeat } from "@/types";
import { auditLevelUp, getDeterministicSubclassCoverage } from "@/data/progression/engine";
import type {
  LevelUpAuditResult,
  AutomaticGain,
  ResourceGain,
  ActionGain,
  PassiveGain,
  ChoiceRequired,
  DeterministicCoverageLevel,
  SpellcastingProgression,
} from "@/data/progression/types";
import { ALL_CLASSES } from "@/data/dnd5e";
import { getSpellsForClass, SCHOOL_COLORS, SPELL_LIST } from "@/data/spellList";
import type { SpellEntry } from "@/data/spellList";
import type { SpellSchool } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LevelFeature { name: string; description: string; }
interface SpellSlotInfo { level: number; total: number; }
interface SpellSlotGained { level: number; gained: number; }

/** Shape returned by the AI endpoint (kept for non-supported classes) */
interface AiLevelUpData {
  newLevel: number;
  proficiencyBonus: number;
  hitDie: number;
  abilityScoreImprovement: boolean;
  newFeatures: LevelFeature[];
  casterType: string;
  newSpellSlots: SpellSlotInfo[];
  spellSlotsGained: SpellSlotGained[];
  spellsKnownGained: number | null;
  cantripsKnownGained: number | null;
  notes: string;
}

interface SpellChoiceRequirement {
  id: string;
  source: "class" | "feat";
  title: string;
  classOptions: string[];
  spellsKnownGained: number;
  cantripsKnownGained: number;
  maxSpellLevel: number;
  spellFilter: FeatSpellFilter;
}

function toSpellcastingProgression(aiData: AiLevelUpData | null): SpellcastingProgression | null {
  if (!aiData) return null;
  return {
    newSpellSlots: aiData.newSpellSlots,
    spellSlotsGained: aiData.spellSlotsGained,
    spellsKnownGained: aiData.spellsKnownGained ?? 0,
    cantripsKnownGained: aiData.cantripsKnownGained ?? 0,
    maxLearnableSpellLevel: aiData.newSpellSlots.reduce((max, slot) => Math.max(max, slot.level), 0),
  };
}

type WizardStep = "loading" | "error" | "overview" | "subclass" | "hp" | "asi" | "spells" | "rebuild" | "done";
type AsiMode = "two" | "one_one" | "feat";
type HpChoiceMode = "roll" | "average";
type FeatViewMode = "list" | "two" | "three";
type FeatPrereqFilter = "all" | "none" | "spellcasting" | "str" | "dex" | "con" | "int" | "wis" | "cha" | "proficiency";

const STAT_KEYS: Array<keyof AbilityScores> = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
];
const STAT_ABBR: Record<keyof AbilityScores, string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
};
const SLOT_ORDINAL: Record<number, string> = {
  1:"1st",2:"2nd",3:"3rd",4:"4th",5:"5th",6:"6th",7:"7th",8:"8th",9:"9th",
};
const ASI_CONFIRM_ANCHOR_ID = "asi-confirm-anchor";
const ASI_BOTTOM_ANCHOR_ID = "asi-bottom-anchor";
const ASI_SCROLL_HINT_AUTO_HIDE_MS = 4500;

interface ClassStatTip {
  primary: string[];
  also: string[];
  note?: string;
}

const CLASS_STAT_TIPS: Record<string, ClassStatTip> = {
  Artificer: { primary: ["Intelligence"], also: ["Constitution"] },
  Barbarian: { primary: ["Strength", "Constitution"], also: ["Dexterity"] },
  Bard: { primary: ["Charisma"], also: ["Dexterity"] },
  "Blood Hunter": { primary: ["Strength", "Dexterity"], also: ["Intelligence"] },
  Cleric: { primary: ["Wisdom"], also: ["Constitution"] },
  Druid: { primary: ["Wisdom"], also: ["Constitution"] },
  Fighter: { primary: ["Strength", "Dexterity"], also: ["Constitution"], note: "STR for melee, DEX for ranged/finesse" },
  Monk: { primary: ["Dexterity", "Wisdom"], also: ["Constitution"] },
  Paladin: { primary: ["Strength", "Charisma"], also: ["Constitution"] },
  Ranger: { primary: ["Dexterity", "Wisdom"], also: ["Constitution"] },
  Rogue: { primary: ["Dexterity"], also: ["Intelligence", "Charisma"] },
  Sorcerer: { primary: ["Charisma"], also: ["Constitution"] },
  Warlock: { primary: ["Charisma"], also: ["Constitution"] },
  Wizard: { primary: ["Intelligence"], also: ["Dexterity"] },
};

const ABILITY_NAME_TO_KEY: Record<string, keyof AbilityScores> = {
  strength: "strength",
  dexterity: "dexterity",
  constitution: "constitution",
  intelligence: "intelligence",
  wisdom: "wisdom",
  charisma: "charisma",
};

const RACE_STAT_FOCUS: Record<string, string[]> = {
  human: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"],
  "variant human": ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"],
  dragonborn: ["Strength", "Charisma"],
  dwarf: ["Constitution"],
  "hill dwarf": ["Constitution", "Wisdom"],
  "mountain dwarf": ["Strength", "Constitution"],
  duergar: ["Strength", "Constitution"],
  elf: ["Dexterity"],
  "high elf": ["Dexterity", "Intelligence"],
  "wood elf": ["Dexterity", "Wisdom"],
  drow: ["Dexterity", "Charisma"],
  eladrin: ["Dexterity", "Charisma"],
  "sea elf": ["Dexterity", "Constitution"],
  "shadar-kai": ["Dexterity", "Constitution"],
  gnome: ["Intelligence"],
  "forest gnome": ["Intelligence", "Dexterity"],
  "rock gnome": ["Intelligence", "Constitution"],
  "deep gnome": ["Dexterity", "Intelligence"],
  "half-elf": ["Charisma"],
  "half-orc": ["Strength", "Constitution"],
  halfling: ["Dexterity"],
  "lightfoot halfling": ["Dexterity", "Charisma"],
  "stout halfling": ["Dexterity", "Constitution"],
  "ghostwise halfling": ["Dexterity", "Wisdom"],
  tiefling: ["Charisma", "Intelligence"],
  aasimar: ["Charisma", "Constitution"],
  genasi: ["Constitution"],
  goliath: ["Strength", "Constitution"],
  tabaxi: ["Dexterity", "Charisma"],
  warforged: ["Constitution"],
  tortle: ["Strength", "Wisdom"],
  kenku: ["Dexterity", "Wisdom"],
  lizardfolk: ["Constitution", "Wisdom"],
  changeling: ["Charisma"],
  kobold: ["Dexterity"],
  goblin: ["Dexterity", "Constitution"],
  orc: ["Strength", "Constitution"],
  bugbear: ["Strength", "Dexterity"],
  hobgoblin: ["Constitution", "Intelligence"],
  "yuan-ti pureblood": ["Charisma", "Intelligence"],
  firbolg: ["Wisdom", "Strength"],
  satyr: ["Charisma", "Dexterity"],
  triton: ["Strength", "Constitution", "Charisma"],
};

function getRaceFocusStats(race: string): string[] {
  const lower = race.trim().toLowerCase();
  if (!lower) return [];
  if (RACE_STAT_FOCUS[lower]) return RACE_STAT_FOCUS[lower];
  const key = Object.keys(RACE_STAT_FOCUS)
    .sort((a, b) => b.length - a.length)
    .find((k) => lower.includes(k));
  return key ? RACE_STAT_FOCUS[key] : [];
}

function rollDie(sides: number): number { return Math.floor(Math.random() * sides) + 1; }
function genId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function getMod(score: number): string { const m = Math.floor((score - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; }

function getSubclassOptions(cls: string): string[] {
  const found = ALL_CLASSES.find((c) => c.name.toLowerCase() === cls.toLowerCase());
  return found?.subclasses ?? [];
}

function matchesFeatPrereqFilter(feat: Open5eFeat, filter: FeatPrereqFilter): boolean {
  if (filter === "all") return true;
  const prereq = (feat.prerequisites ?? "").toLowerCase().trim();

  if (filter === "none") return prereq.length === 0;
  if (filter === "spellcasting") return prereq.includes("spellcasting");
  if (filter === "proficiency") return prereq.includes("proficiency");
  if (filter === "str") return /strength|\bstr\b/.test(prereq);
  if (filter === "dex") return /dexterity|\bdex\b/.test(prereq);
  if (filter === "con") return /constitution|\bcon\b/.test(prereq);
  if (filter === "int") return /intelligence|\bint\b/.test(prereq);
  if (filter === "wis") return /wisdom|\bwis\b/.test(prereq);
  if (filter === "cha") return /charisma|\bcha\b/.test(prereq);
  return true;
}

function hasCompleteFeatDescription(desc: string | undefined): boolean {
  const normalized = (desc ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return false;

  // Open5e has some feat entries ending on intro stubs (for example, "You gain the following benefits:").
  if (/(you gain the following(?: benefits?)?|the benefits are as follows|choose one of the following):?$/i.test(normalized)) {
    return false;
  }
  if (/\bfollowin$/i.test(normalized)) return false;

  // Descriptions should end cleanly; missing terminal punctuation is a strong truncation signal.
  if (!/[.!?)]$/.test(normalized)) return false;

  return true;
}

function getCoverageBadge(coverage: DeterministicCoverageLevel): { label: string; icon: keyof typeof Feather.glyphMap; textColor: string; bg: string; border: string } {
  if (coverage === "detailed") {
    return {
      label: "Detailed support",
      icon: "check-circle",
      textColor: "#10B981",
      bg: "#10B98118",
      border: "#10B98140",
    };
  }
  if (coverage === "baseline") {
    return {
      label: "Baseline deterministic",
      icon: "shield",
      textColor: "#0EA5E9",
      bg: "#0EA5E918",
      border: "#0EA5E940",
    };
  }

  return {
    label: "AI fallback",
    icon: "cpu",
    textColor: "#F59E0B",
    bg: "#F59E0B18",
    border: "#F59E0B40",
  };
}

function formatProgressionChoiceLabel(kind: ChoiceRequired["kind"]): string {
  switch (kind) {
    case "subclass":
      return "Subclass choice";
    case "asi":
      return "ASI or feat";
    case "feature":
      return "Feature choice";
  }
}

function formatActionTypeLabel(actionType: ActionGain["actionType"]): string {
  return actionType === "bonus_action"
    ? "Bonus Action"
    : actionType === "reaction"
      ? "Reaction"
      : "Action";
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props { visible: boolean; onClose: () => void; }

// ── Component ─────────────────────────────────────────────────────────────────

export function LevelUpModal({ visible, onClose }: Props) {
  const c = useColors();
  const { settings } = useAppSettings();
  const {
    character, updateCharacter, updateSpellSlotTotal,
    addClassFeature, passiveFeatures, setPassiveFeatures,
    classFeatures, setClassFeatures, upsertResourceByName,
    addSpell, spellSlots, preparedSpells,
    pendingLevelUps, decrementPendingLevelUps, queueLevelUps,
  } = useCharacter();

  const [step, setStep] = useState<WizardStep>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [applied, setApplied] = useState(false);

  // Engine path state
  const [engineResult, setEngineResult] = useState<LevelUpAuditResult | null>(null);

  // AI fallback path state
  const [aiData, setAiData] = useState<AiLevelUpData | null>(null);

  // HP step
  const [rolledValue, setRolledValue] = useState<number | null>(null);
  const [hpGain, setHpGain] = useState<number | null>(null);
  const [hpChoiceMode, setHpChoiceMode] = useState<HpChoiceMode | null>(null);

  // ASI step
  const [asiMode, setAsiMode] = useState<AsiMode>("two");
  const [asiStat1, setAsiStat1] = useState<keyof AbilityScores | null>(null);
  const [asiStat2, setAsiStat2] = useState<keyof AbilityScores | null>(null);
  const [featName, setFeatName] = useState("");
  const [featDesc, setFeatDesc] = useState("");
  const [featSearch, setFeatSearch] = useState("");
  const [featViewMode, setFeatViewMode] = useState<FeatViewMode>("two");
  const [featPrereqFilter, setFeatPrereqFilter] = useState<FeatPrereqFilter>("all");
  const [availableFeats, setAvailableFeats] = useState<Open5eFeat[]>([]);
  const [loadingFeats, setLoadingFeats] = useState(false);
  const [featLoadError, setFeatLoadError] = useState("");
  const [featQualityNotice, setFeatQualityNotice] = useState("");
  const [featRecommendation, setFeatRecommendation] = useState<{ featName: string; reason: string } | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);

  // Subclass step
  const [chosenSubclass, setChosenSubclass] = useState<string>("");
  const [customSubclass, setCustomSubclass] = useState("");

  // Spell choice step (AI path)
  const [pendingSpells, setPendingSpells] = useState<{ name: string; level: number }[]>([]);
  const [pendingCantrips, setPendingCantrips] = useState<string[]>([]);
  const [spellInput, setSpellInput] = useState("");
  const [spellLevel, setSpellLevel] = useState(1);
  const [cantripInput, setCantripInput] = useState("");
  const [spellSearch, setSpellSearch] = useState("");
  const [cantripSearch, setCantripSearch] = useState("");
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const [spellChoiceQueue, setSpellChoiceQueue] = useState<SpellChoiceRequirement[]>([]);
  const [spellChoiceClass, setSpellChoiceClass] = useState("");

  const fetchedRef = useRef(false);
  const fetchedFeatsRef = useRef(false);
  const asiScrollRef = useRef<ScrollView | null>(null);
  const [asiAtBottom, setAsiAtBottom] = useState(false);
  const [asiScrollHintDismissed, setAsiScrollHintDismissed] = useState(false);
  const [asiScrollHintTimedOut, setAsiScrollHintTimedOut] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const currentLevel = character.level;
  const newLevel = (engineResult?.newLevel ?? aiData?.newLevel ?? currentLevel + 1);
  const hitDie = engineResult?.hitDie ?? aiData?.hitDie ?? 8;
  const profBonus = engineResult?.proficiencyBonus ?? aiData?.proficiencyBonus ?? character.proficiencyBonus;
  const conMod = Math.floor((character.abilityScores.constitution - 10) / 2);

  const hasAsiChoice = (engineResult?.choices.some((c) => c.kind === "asi") ?? aiData?.abilityScoreImprovement) ?? false;
  const hasSubclassChoice =
    (engineResult?.choices.some((c) => c.kind === "subclass") && !character.subclass) ?? false;
  const spellcastingProgression = engineResult?.spellcasting ?? toSpellcastingProgression(aiData);
  const hasSpellChoice = (spellcastingProgression?.spellsKnownGained ?? 0) > 0 || (spellcastingProgression?.cantripsKnownGained ?? 0) > 0;

  // Default spell level for newly learned spells — highest slot the character now has
  const defaultNewSpellLevel = Math.max(
    1,
    ...spellSlots.filter((s) => s.total > 0).map((s) => s.level),
    ...(spellcastingProgression?.newSpellSlots ?? []).map((s) => s.level),
    spellcastingProgression?.maxLearnableSpellLevel ?? 0,
  );
  const activeSpellChoice = spellChoiceQueue[0] ?? null;

  function buildOverviewCards() {
    if (engineResult) {
      const autoGains = engineResult.automaticGains;
      const passiveCount = autoGains.filter((gain) => gain.kind === "passive").length;
      const actionCount = autoGains.filter((gain) => gain.kind === "action").length;
      const resourceCount = autoGains.filter((gain) => gain.kind === "resource").length;
      const choiceCount = engineResult.choices.length;
      const spellCount = (engineResult.spellcasting?.spellsKnownGained ?? 0) + (engineResult.spellcasting?.cantripsKnownGained ?? 0);
      return [
        { label: "Features", count: passiveCount, note: "passives added to sheet", tone: "#10B981" },
        { label: "Abilities", count: actionCount, note: "actions added to attacks", tone: "#3B82F6" },
        { label: "Resources", count: resourceCount, note: "tracked maxima update automatically", tone: "#8B5CF6" },
        { label: "Choices", count: choiceCount, note: "decisions still required", tone: "#F59E0B" },
        { label: "Spells", count: spellCount, note: "new spells/cantrips to confirm", tone: "#EC4899" },
      ]
        .filter((card) => card.count > 0)
        .map((card) => ({
          label: card.label,
          value: String(card.count),
          note: card.note,
          tone: card.tone,
        }));
    }

    if (aiData) {
      const choiceCount =
        (aiData.abilityScoreImprovement ? 1 : 0) +
        ((spellcastingProgression?.spellsKnownGained ?? 0) > 0 || (spellcastingProgression?.cantripsKnownGained ?? 0) > 0 ? 1 : 0);
      const slotCount = spellcastingProgression?.spellSlotsGained.length ?? 0;
      return [
        { label: "Features", count: aiData.newFeatures.length, note: "review generated feature gains", tone: "#10B981" },
        { label: "Choices", count: choiceCount, note: "AI fallback stays explicit about required choices", tone: "#F59E0B" },
        { label: "Slots", count: slotCount, note: "spell slots update automatically", tone: "#8B5CF6" },
      ]
        .filter((card) => card.count > 0)
        .map((card) => ({
          label: card.label,
          value: String(card.count),
          note: card.note,
          tone: card.tone,
        }));
    }

    return [];
  }

  function buildWhatChangesLines() {
    if (engineResult) {
      const lines: string[] = [];
      if (engineResult.automaticGains.some((gain) => gain.kind === "passive")) {
        lines.push("Passive unlocks are added to the sheet's Class Features section.");
      }
      if (engineResult.automaticGains.some((gain) => gain.kind === "action")) {
        lines.push("New active abilities are rebuilt into the Attacks tab with their action economy tags.");
      }
      if (engineResult.automaticGains.some((gain) => gain.kind === "resource")) {
        lines.push("Tracked resources update automatically so you do not need to hand-edit maxima.");
      }
      if ((engineResult.spellcasting?.newSpellSlots.length ?? 0) > 0) {
        lines.push("Spell slot totals sync automatically; learned spells only change after you confirm spell picks.");
      }
      if (engineResult.choices.length > 0) {
        lines.push("Required choices stay explicit so unsupported rule certainty is never faked.");
      }
      return lines;
    }

    if (aiData) {
      return [
        "This class uses AI fallback for this level-up, so review the listed gains before applying them.",
        "HP, proficiency bonus, spell slots, and confirmed spell picks still update through the existing progression flow.",
      ];
    }

    return [];
  }

  function buildUpcomingStepLines() {
    const lines: string[] = [];
    if (hasSubclassChoice) lines.push("Choose subclass before HP and later unlocks are applied.");
    lines.push("Choose HP gain from average or one locked-in roll.");
    if (hasAsiChoice) lines.push("Choose ASI or feat and see the exact stat/feat consequence before continuing.");
    if (hasSpellChoice) lines.push("Confirm learned spells/cantrips explicitly; nothing is auto-guessed.");
    return lines;
  }

  function buildAppliedChangeLines() {
    const lines: string[] = [];
    if (hpGain !== null) {
      lines.push(`HP increased by ${hpGain} (${hpChoiceMode === "roll" ? "rolled" : "average"}).`);
    }
    if (chosenSubclass) {
      lines.push(`Subclass set to ${chosenSubclass}.`);
    }
    if (hasAsiChoice) {
      if (asiMode === "two" && asiStat1) {
        lines.push(`${STAT_ABBR[asiStat1]} increased by 2.`);
      } else if (asiMode === "one_one" && asiStat1 && asiStat2) {
        lines.push(`${STAT_ABBR[asiStat1]} +1 and ${STAT_ABBR[asiStat2]} +1 applied.`);
      } else if (asiMode === "feat" && featName.trim()) {
        lines.push(`Feat added: ${featName.trim()}.`);
      }
    }
    if (engineResult) {
      for (const gain of engineResult.automaticGains) {
        if (gain.kind === "passive") lines.push(`Passive feature unlocked: ${gain.name}.`);
        if (gain.kind === "action") lines.push(`${formatActionTypeLabel(gain.actionType)} unlocked: ${gain.name}.`);
        if (gain.kind === "resource") lines.push(`Resource updated: ${gain.name} max ${gain.newMax}.`);
      }
    } else if (aiData) {
      for (const feature of aiData.newFeatures) {
        if (feature.name !== "Ability Score Improvement") {
          lines.push(`Feature added: ${feature.name}.`);
        }
      }
    }
    for (const spell of pendingSpells) {
      lines.push(`Spell learned: ${spell.name} (${SLOT_ORDINAL[spell.level] ?? `${spell.level}th`} level).`);
    }
    for (const cantrip of pendingCantrips) {
      lines.push(`Cantrip learned: ${cantrip}.`);
    }
    return lines;
  }

  // ── Fetch / compute level-up data ─────────────────────────────────────────────

  const computeLevelUp = useCallback(async () => {
    setStep("loading");
    setEngineResult(null);
    setAiData(null);
    setErrorMsg("");
    setApplied(false);
    setRolledValue(null);
    setHpGain(null);
    setHpChoiceMode(null);
    setAsiAtBottom(false);
    setAsiScrollHintDismissed(false);
    setAsiScrollHintTimedOut(false);
    setAsiMode("two");
    setAsiStat1(null);
    setAsiStat2(null);
    setFeatName("");
    setFeatDesc("");
    setFeatSearch("");
    setFeatRecommendation(null);
    setLoadingRecommendation(false);
    setChosenSubclass("");
    setCustomSubclass("");
    setPendingSpells([]);
    setPendingCantrips([]);
    setSpellInput("");
    setSpellLevel(1);
    setCantripInput("");
    setSpellSearch("");
    setCantripSearch("");
    setExpandedSpell(null);
    setSpellChoiceQueue([]);
    setSpellChoiceClass("");

    if (currentLevel >= 20) {
      setErrorMsg("Your character is already at the maximum level (20).");
      setStep("error");
      return;
    }

    // Try deterministic engine first
    const audit = auditLevelUp({
      currentLevel,
      charClass: character.class,
      subclass: character.subclass ?? "",
      race: character.race,
    });

    if (audit.supported) {
      setEngineResult(audit);
      setStep("overview");
      return;
    }

    if (audit.unsupportedReason === "multiclass_unsupported") {
      setErrorMsg(audit.summary || "Multiclass deterministic progression is not supported yet.");
      setStep("error");
      return;
    }

    // Fall back to AI for unsupported classes
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/level-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: {
            level: character.level,
            class: character.class,
            subclass: character.subclass ?? "",
            race: character.race,
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as Record<string, string>).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AiLevelUpData;
      setAiData(data);
      setStep("overview");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to load level-up data.");
      setStep("error");
    }
  }, [currentLevel, character.level, character.class, character.subclass, character.race]);

  useEffect(() => {
    if (visible && !fetchedRef.current) {
      fetchedRef.current = true;
      computeLevelUp();
    }
    if (!visible) { fetchedRef.current = false; }
  }, [visible, computeLevelUp]);

  useEffect(() => {
    if (!visible || fetchedFeatsRef.current || loadingFeats || availableFeats.length > 0) return;
    fetchedFeatsRef.current = true;
    setLoadingFeats(true);
    setFeatLoadError("");
    setFeatQualityNotice("");
    fetchOpen5eFeats()
      .then((rows) => {
        const completeRows = rows.filter((feat) => hasCompleteFeatDescription(feat.desc));
        const excludedCount = rows.length - completeRows.length;
        const byName = new Map<string, Open5eFeat>();
        for (const feat of [...completeRows, ...PHB_FEATS]) {
          const key = feat.name.trim().toLowerCase();
          const prev = byName.get(key);
          const prevIsPhb = prev?.reference_abr?.toLowerCase() === "phb";
          const nextIsPhb = feat.reference_abr?.toLowerCase() === "phb";
          if (!prev || (!prevIsPhb && nextIsPhb)) {
            byName.set(key, feat);
          }
        }
        const sorted = [...byName.values()]
          .filter((feat) => hasCompleteFeatDescription(feat.desc))
          .sort((a, b) => a.name.localeCompare(b.name));
        setAvailableFeats(sorted);
        if (excludedCount > 0) {
          setFeatQualityNotice(`Excluded ${excludedCount} feats with incomplete source descriptions.`);
        }
      })
      .catch((e: unknown) => {
        // Still provide PHB feats if Open5e is unavailable.
        setAvailableFeats(PHB_FEATS.filter((feat) => hasCompleteFeatDescription(feat.desc)));
        setFeatLoadError("");
        setFeatQualityNotice("");
      })
      .finally(() => {
        setLoadingFeats(false);
      });
  }, [visible, loadingFeats, availableFeats.length]);

  // Once feats finish loading, compute recommendation if feat tab is already active
  useEffect(() => {
    if (asiMode === "feat" && availableFeats.length > 0 && !featRecommendation) {
      setFeatRecommendation(computeFeatRecommendation());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableFeats.length, asiMode]);

  // ── Apply engine-based level-up ────────────────────────────────────────────────

  function applyEngineChanges(hpGained: number) {
    if (!engineResult || applied) return;
    setApplied(true);

    const updates: Parameters<typeof updateCharacter>[0] = {
      level: engineResult.newLevel,
      proficiencyBonus: engineResult.proficiencyBonus,
      maxHp: character.maxHp + hpGained,
      currentHp: character.currentHp + hpGained,
    };

    // Subclass
    const subclassToApply = chosenSubclass || character.subclass;
    if (hasSubclassChoice && subclassToApply) {
      updates.subclass = subclassToApply;
    }

    // ASI / Feat
    if (hasAsiChoice) {
      if (asiMode === "two" && asiStat1) {
        const changes = { [asiStat1]: 2 } as Partial<Record<keyof AbilityScores, number>>;
        updates.abilityScores = { ...character.abilityScores, [asiStat1]: character.abilityScores[asiStat1] + 2 };
        updates.asiHistory = [...(character.asiHistory ?? []), { level: engineResult.newLevel, changes }];
      } else if (asiMode === "one_one" && asiStat1 && asiStat2) {
        const changes = {
          [asiStat1]: 1,
          [asiStat2]: 1,
        } as Partial<Record<keyof AbilityScores, number>>;
        updates.abilityScores = {
          ...character.abilityScores,
          [asiStat1]: character.abilityScores[asiStat1] + 1,
          [asiStat2]: character.abilityScores[asiStat2] + 1,
        };
        updates.asiHistory = [...(character.asiHistory ?? []), { level: engineResult.newLevel, changes }];
      } else if (asiMode === "feat" && featName.trim()) {
        updates.feats = [...(character.feats ?? []), {
          id: genId(), name: featName.trim(),
          description: featDesc.trim() || undefined, source: `Level ${engineResult.newLevel}`,
        }];
      }
    }

    updateCharacter(updates);

    for (const slot of engineResult.spellcasting?.newSpellSlots ?? []) {
      updateSpellSlotTotal(slot.level, slot.total);
    }

    // Apply automatic gains from engine
    const newPassives: typeof passiveFeatures = [...passiveFeatures];
    const newActions: typeof classFeatures = [...classFeatures];

    for (const gain of engineResult.automaticGains) {
      if (gain.kind === "passive") {
        const p = gain as PassiveGain;
        if (!newPassives.some((f) => f.name === p.name)) {
          newPassives.push({
            id: genId(),
            name: p.name,
            description: p.description,
            source: character.class,
            originKind: "progression_generated",
            explanation: `Deterministic progression gain at level ${engineResult.newLevel}`,
            levelGained: engineResult.newLevel,
          });
        }
      } else if (gain.kind === "action") {
        const a = gain as ActionGain;
        if (!newActions.some((f) => f.name === a.name)) {
          newActions.push({
            id: genId(),
            name: a.name,
            description: a.description,
            actionType: a.actionType,
            source: character.class,
            originKind: "progression_generated",
            explanation: `Deterministic progression gain at level ${engineResult.newLevel}`,
            levelGained: engineResult.newLevel,
          });
        }
      } else if (gain.kind === "resource") {
        const r = gain as ResourceGain;
        upsertResourceByName(r.name, {
          max: r.newMax,
          resetOn: r.resetsOn,
          color: r.color,
          notes: r.description,
        });
      }
    }

    setPassiveFeatures(newPassives);
    setClassFeatures(newActions);
  }

  // ── Apply AI-based level-up ────────────────────────────────────────────────────

  function applyAiChanges(hpGained: number) {
    if (!aiData || applied) return;
    setApplied(true);

    const updates: Parameters<typeof updateCharacter>[0] = {
      level: aiData.newLevel,
      proficiencyBonus: aiData.proficiencyBonus,
      maxHp: character.maxHp + hpGained,
      currentHp: character.currentHp + hpGained,
    };

    if (aiData.abilityScoreImprovement) {
      if (asiMode === "two" && asiStat1) {
        const changes = { [asiStat1]: 2 } as Partial<Record<keyof AbilityScores, number>>;
        updates.abilityScores = { ...character.abilityScores, [asiStat1]: character.abilityScores[asiStat1] + 2 };
        updates.asiHistory = [...(character.asiHistory ?? []), { level: aiData.newLevel, changes }];
      } else if (asiMode === "one_one" && asiStat1 && asiStat2) {
        const changes = {
          [asiStat1]: 1,
          [asiStat2]: 1,
        } as Partial<Record<keyof AbilityScores, number>>;
        updates.abilityScores = {
          ...character.abilityScores,
          [asiStat1]: character.abilityScores[asiStat1] + 1,
          [asiStat2]: character.abilityScores[asiStat2] + 1,
        };
        updates.asiHistory = [...(character.asiHistory ?? []), { level: aiData.newLevel, changes }];
      } else if (asiMode === "feat" && featName.trim()) {
        updates.feats = [...(character.feats ?? []), {
          id: genId(), name: featName.trim(),
          description: featDesc.trim() || undefined, source: `Level ${aiData.newLevel}`,
        }];
      }
    }

    updateCharacter(updates);

    for (const slot of aiData.newSpellSlots) {
      updateSpellSlotTotal(slot.level, slot.total);
    }

    for (const feature of aiData.newFeatures) {
      if (feature.name === "Ability Score Improvement") continue;
      addClassFeature({
        name: feature.name, description: feature.description,
        actionType: undefined,
        source: character.class,
        originKind: "progression_generated",
        explanation: `AI fallback progression gain at level ${aiData.newLevel}`,
        levelGained: aiData.newLevel,
      });
    }
  }

  // ── Step flow ─────────────────────────────────────────────────────────────────

  function goFromOverview() {
    if (hasSubclassChoice) { setStep("subclass"); }
    else { setStep("hp"); }
  }

  function goFromSubclass() {
    const sub = chosenSubclass || customSubclass.trim();
    if (!sub) return;
    setChosenSubclass(sub);
    setStep("hp");
  }

  function getSelectedFeatSpellProgression(): FeatSpellProgression | null {
    if (asiMode !== "feat" || featName.trim().length === 0) return null;
    return inferFeatSpellProgression({
      name: featName.trim(),
      desc: featDesc,
    });
  }

  function beginSpellChoiceFlow(queue: SpellChoiceRequirement[]) {
    if (queue.length === 0) return;
    setSpellChoiceQueue(queue);
    setPendingSpells([]);
    setPendingCantrips([]);
    setSpellInput("");
    setCantripInput("");
    setSpellSearch("");
    setCantripSearch("");
    setExpandedSpell(null);
    setSpellChoiceClass(queue[0].classOptions[0] ?? character.class);
    setSpellLevel(Math.max(1, queue[0].maxSpellLevel || 1));
    setStep("spells");
  }

  function buildSpellChoiceQueue(options?: { includeFeatChoice?: boolean }): SpellChoiceRequirement[] {
    const queue: SpellChoiceRequirement[] = [];
    if (options?.includeFeatChoice) {
      const featProgression = getSelectedFeatSpellProgression();
      if (featProgression && (featProgression.spellsKnownGained > 0 || featProgression.cantripsKnownGained > 0)) {
        queue.push({
          id: `feat-${featProgression.featName.toLowerCase()}`,
          source: "feat",
          title: `${featProgression.featName} Spell Choices`,
          classOptions: featProgression.classOptions.length > 0 ? featProgression.classOptions : [character.class],
          spellsKnownGained: featProgression.spellsKnownGained,
          cantripsKnownGained: featProgression.cantripsKnownGained,
          maxSpellLevel: featProgression.maxSpellLevel,
          spellFilter: featProgression.spellFilter,
        });
      }
    }

    if (hasSpellChoice) {
      queue.push({
        id: `class-${character.class.toLowerCase()}-${newLevel}`,
        source: "class",
        title: `${character.class} Spell Choices`,
        classOptions: [character.class],
        spellsKnownGained: spellcastingProgression?.spellsKnownGained ?? 0,
        cantripsKnownGained: spellcastingProgression?.cantripsKnownGained ?? 0,
        maxSpellLevel: spellcastingProgression?.maxLearnableSpellLevel ?? defaultNewSpellLevel,
        spellFilter: "any",
      });
    }

    return queue;
  }

  function finalizeLevelUp(hpGained: number) {
    if (engineResult) {
      applyEngineChanges(hpGained);
    } else if (aiData) {
      applyAiChanges(hpGained);
    }

    setStep("rebuild");
    setTimeout(() => {
      setStep("done");
    }, 450);
  }

  function goFromHp() {
    if (hpGain === null) return;
    if (hasAsiChoice) { setStep("asi"); return; }
    if (hasSpellChoice) {
      beginSpellChoiceFlow(buildSpellChoiceQueue());
      return;
    }
    finalizeLevelUp(hpGain);
  }

  function goFromAsi() {
    if (!asiNextReady() || hpGain === null) return;
    const spellChoiceQueue = buildSpellChoiceQueue({ includeFeatChoice: true });
    if (spellChoiceQueue.length > 0) {
      beginSpellChoiceFlow(spellChoiceQueue);
      return;
    }
    finalizeLevelUp(hpGain);
  }

  function goFromSpells() {
    // Add all pending spells to the character, enriched with description+school from database
    for (const s of pendingSpells) {
      const entry = SPELL_LIST.find((e) => e.name.toLowerCase() === s.name.toLowerCase());
      addSpell({
        name: s.name,
        level: s.level,
        prepared: true,
        description: entry?.desc,
        school: entry?.school as SpellSchool | undefined,
      });
    }
    for (const name of pendingCantrips) {
      const entry = SPELL_LIST.find((e) => e.name.toLowerCase() === name.toLowerCase());
      addSpell({
        name,
        level: 0,
        prepared: true,
        description: entry?.desc,
        school: entry?.school as SpellSchool | undefined,
      });
    }
    if (spellChoiceQueue.length > 1) {
      const [, ...rest] = spellChoiceQueue;
      setSpellChoiceQueue(rest);
      setSpellChoiceClass(rest[0]?.classOptions[0] ?? character.class);
      setPendingSpells([]);
      setPendingCantrips([]);
      setSpellInput("");
      setCantripInput("");
      setSpellSearch("");
      setCantripSearch("");
      setExpandedSpell(null);
      setSpellLevel(Math.max(1, rest[0]?.maxSpellLevel || 1));
      return;
    }
    if (hpGain === null) return;
    finalizeLevelUp(hpGain);
  }

  // ── HP helpers ─────────────────────────────────────────────────────────────────

  function handleRoll() {
    const roll = rollDie(hitDie);
    const total = Math.max(1, roll + conMod);
    setRolledValue(roll);
    setHpGain(total);
    setHpChoiceMode("roll");
  }

  function handleSelectRoll() {
    if (rolledValue === null) {
      handleRoll();
      return;
    }
    setHpGain(Math.max(1, rolledValue + conMod));
    setHpChoiceMode("roll");
  }

  function handleAverage() {
    const avg = Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
    setHpGain(avg);
    setHpChoiceMode("average");
  }

  function scrollAsiToBottom() {
    const scroller = asiScrollRef.current;
    const webScrollToAnchor = () => {
      if (Platform.OS !== "web") return;
      const doc = (globalThis as { document?: Document }).document;
      const anchor = doc?.getElementById(ASI_BOTTOM_ANCHOR_ID) ?? doc?.getElementById(ASI_CONFIRM_ANCHOR_ID);
      anchor?.scrollIntoView({ behavior: "smooth", block: "end" });
    };

    if (!scroller) {
      webScrollToAnchor();
      return;
    }

    const doScroll = () => {
      scroller.scrollToEnd?.({ animated: true });
      scroller.scrollTo?.({ y: 100000, animated: true });
      webScrollToAnchor();
    };

    doScroll();
    setTimeout(doScroll, 80);
    setTimeout(doScroll, 220);
  }

  // ── ASI helpers ───────────────────────────────────────────────────────────────

  function toggleStat(stat: keyof AbilityScores) {
    if (asiMode === "two") { setAsiStat1((prev) => (prev === stat ? null : stat)); }
    else if (asiMode === "one_one") {
      if (asiStat1 === stat) { setAsiStat1(null); return; }
      if (asiStat2 === stat) { setAsiStat2(null); return; }
      if (!asiStat1) { setAsiStat1(stat); return; }
      if (!asiStat2) { setAsiStat2(stat); return; }
      setAsiStat1(stat); setAsiStat2(null);
    }
  }

  function isStatSelected(stat: keyof AbilityScores) { return stat === asiStat1 || stat === asiStat2; }

    function getSuggestedAsiPlan(mode: "two" | "one_one" = asiMode === "feat" ? "two" : asiMode): { mode: "two" | "one_one"; stat1: keyof AbilityScores; stat2?: keyof AbilityScores } | null {
    const classTip = CLASS_STAT_TIPS[character.class ?? ""];
    const raceFocus = getRaceFocusStats(character.race ?? "");
    const orderedNames = [
      ...(classTip?.primary ?? []),
      ...(classTip?.also ?? []),
      ...raceFocus,
      "Constitution",
      "Dexterity",
      "Wisdom",
      "Intelligence",
      "Charisma",
      "Strength",
    ];

    const priority: Array<keyof AbilityScores> = [];
    for (const name of orderedNames) {
      const key = ABILITY_NAME_TO_KEY[name.trim().toLowerCase()];
      if (key && !priority.includes(key)) priority.push(key);
    }

    for (const fallback of STAT_KEYS) {
      if (!priority.includes(fallback)) priority.push(fallback);
    }

    const candidates = priority
      .map((key, idx) => ({ key, idx, score: character.abilityScores[key] }))
      .filter((entry) => entry.score < 20);

    if (candidates.length === 0) return null;

    if (mode === "two") {
      return {
        mode: "two",
        stat1: candidates[0].key,
      };
    }

    const oddCandidates = candidates.filter((entry) => entry.score % 2 === 1);
    if (oddCandidates.length >= 2) {
      return {
        mode: "one_one",
        stat1: oddCandidates[0].key,
        stat2: oddCandidates[1].key,
      };
    }

    if (candidates[0].score === 19 && candidates.length >= 2) {
      return {
        mode: "one_one",
        stat1: candidates[0].key,
        stat2: candidates[1].key,
      };
    }

    if (candidates.length >= 2) {
      return {
        mode: "one_one",
        stat1: candidates[0].key,
        stat2: candidates[1].key,
      };
    }

    return {
      mode: "one_one",
      stat1: candidates[0].key,
    };
  }

  function applySuggestedAsi() {
    const plan = getSuggestedAsiPlan();
    if (!plan) return;
    setAsiStat1(plan.stat1);
    setAsiStat2(plan.stat2 ?? null);
    setFeatName("");
    setFeatDesc("");
    setFeatSearch("");
    setAsiScrollHintDismissed(false);
    setAsiScrollHintTimedOut(false);
  }

  function asiNextReady(): boolean {
    if (asiMode === "two") return asiStat1 !== null;
    if (asiMode === "one_one") return asiStat1 !== null && asiStat2 !== null;
    return featName.trim().length > 0;
  }

  function computeFeatRecommendation(): { featName: string; reason: string } | null {
    if (availableFeats.length === 0) return null;
    const cls = (character.class ?? "").toLowerCase();
    const sub = (character.subclass ?? "").toLowerCase();
    const lvl = character.level;
    const as = character.abilityScores;
    const knownFeats = new Set((character.feats ?? []).map((f) => f.name.toLowerCase()));
    const availableNames = new Set(availableFeats.map((f) => f.name.toLowerCase()));

    // Helper: pick first candidate that is available in Open5e and not already known
    function pick(candidates: Array<{ featName: string; reason: string }>) {
      return candidates.find(
        (c) => availableNames.has(c.featName.toLowerCase()) && !knownFeats.has(c.featName.toLowerCase())
      );
    }

    // Identify highest ability score
    const scores = Object.entries(as) as Array<[keyof AbilityScores, number]>;
    const [highestStat] = scores.sort(([, a], [, b]) => b - a);

    // Ranged fighter indicators
    const isRanged = sub.includes("hunter") || sub.includes("scout") || sub.includes("gloomstalker") ||
      sub.includes("sharpshooter") || cls === "ranger" ||
      false;

    const isCaster = ["wizard","sorcerer","bard","cleric","druid","warlock","artificer"].some((c) => cls.includes(c)) ||
      sub.includes("eldritch knight") || sub.includes("arcane trickster");

    const isMelee = ["barbarian","fighter","paladin","monk"].some((c) => cls.includes(c)) && !isRanged;

    const hasTwoHanded = false;

    // Low constitution — Tough is universally valuable
    if (as.constitution < 14 && lvl <= 6) {
      const r = pick([{ featName: "Tough", reason: `With CON ${as.constitution} your HP is below average — Tough adds ${lvl * 2} HP immediately and keeps paying off every level.` }]);
      if (r) return r;
    }

    // Class-specific picks
    if (cls.includes("barbarian")) {
      const r = pick([
        { featName: "Great Weapon Master", reason: `Barbarians excel at power attacks — Great Weapon Master's −5/+10 swing synergizes perfectly with Reckless Attack granting advantage to cancel the penalty.` },
        { featName: "Polearm Master", reason: `Polearm Master gives you a bonus attack on every turn and opportunity attacks when enemies enter reach, filling Barbarian's action economy gaps.` },
        { featName: "Sentinel", reason: `Sentinel lets you lock down enemies in melee, keeping your Barbarian in the thick of combat where they thrive.` },
      ]);
      if (r) return r;
    }

    if (cls.includes("fighter")) {
      if (isRanged || sub.includes("archery")) {
        const r = pick([
          { featName: "Sharpshooter", reason: `Sharpshooter's −5/+10 is the ranged equivalent of Great Weapon Master. With Archery fighting style cancelling the attack roll penalty, this is the strongest damage feat for ranged Fighters.` },
          { featName: "Crossbow Expert", reason: `Crossbow Expert removes the loading property and lets you make a bonus attack with a hand crossbow, significantly boosting your action economy.` },
        ]);
        if (r) return r;
      }
      const r = pick([
        { featName: "Great Weapon Master", reason: `Great Weapon Master pairs perfectly with Fighter's Action Surge and multiple attacks for massive burst damage rounds.` },
        { featName: "Sentinel", reason: `Sentinel rewards Fighters for being controlling tanks — lockdown enemies and protect your allies.` },
        { featName: "Polearm Master", reason: `Polearm Master gives Fighters a bonus attack using their full attack modifier, maximizing their multiple-attack advantage.` },
      ]);
      if (r) return r;
    }

    if (cls.includes("paladin")) {
      const r = pick([
        { featName: "Great Weapon Master", reason: `Paladins concentrate their spell slots into Divine Smite, making each hit that much more impactful — Great Weapon Master's power attack maximizes smite value.` },
        { featName: "War Caster", reason: `War Caster lets you maintain concentration on spells like Bless or Wrathful Smite through hits, and cast spells as opportunity attacks.` },
        { featName: "Sentinel", reason: `Sentinel pairs brilliantly with a Paladin's high AC and tankiness — lock down enemies while your smites punish anything that dares attack your allies.` },
      ]);
      if (r) return r;
    }

    if (cls.includes("ranger")) {
      const r = pick([
        { featName: "Sharpshooter", reason: `With access to Hunter's Mark and Archery fighting style, Sharpshooter is a flat damage upgrade for Rangers every attack at long range.` },
        { featName: "Crossbow Expert", reason: `Crossbow Expert frees you from the loading restriction and adds a bonus attack, doubling your Hunter's Mark damage procs.` },
        { featName: "War Caster", reason: `Rangers rely on concentration spells like Hunter's Mark — War Caster keeps them active even after taking hits.` },
      ]);
      if (r) return r;
    }

    if (cls.includes("rogue")) {
      const r = pick([
        { featName: "Alert", reason: `Alert ensures you almost always act first, letting you sneak attack before enemies can move — critical for a class that relies on positioning.` },
        { featName: "Mobile", reason: `Mobile lets Rogues dart in, Sneak Attack, and retreat without provoking opportunity attacks — perfect hit-and-run gameplay.` },
        { featName: "Lucky", reason: `Lucky is incredibly strong on Rogues since rerolling attack dice maximizes Sneak Attack uptime.` },
      ]);
      if (r) return r;
    }

    if (cls.includes("monk")) {
      const r = pick([
        { featName: "Mobile", reason: `Mobile increases your speed and prevents opportunity attacks after Dashing or attacking — keeping the Monk's hit-and-run style flowing freely.` },
        { featName: "War Caster", reason: `War Caster's concentration protection keeps key spells or ki-powered abilities active through the melee brawl Monks live in.` },
        { featName: "Sentinel", reason: `With your high attack count, Sentinel is devastating — each opportunity attack can come with a bonus Flurry of Blows.` },
      ]);
      if (r) return r;
    }

    if (isCaster) {
      const r = pick([
        { featName: "War Caster", reason: `War Caster is the #1 caster feat — advantage on concentration saves, cast spells as opportunity attacks, and hold focus even when hitting hard.` },
        { featName: "Resilient (Constitution)", reason: `Resilient (CON) adds proficiency to Constitution saves, dramatically improving concentration spell survival at level ${lvl}.` },
        { featName: "Alert", reason: `Going first in combat lets casters set up control spells before enemies can act — Alert is a strong early investment.` },
        { featName: "Lucky", reason: `Lucky is universally powerful for casters, especially for rerolling failed concentration or crucial attack rolls.` },
      ]);
      if (r) return r;
    }

    // High-score based fallbacks
    if (highestStat && highestStat[1] >= 18) {
      // Already maxed out a stat — feats make more sense
      const r = pick([
        { featName: "Lucky", reason: `With ${highestStat[0]} already at ${highestStat[1]}, a feat outperforms another +1. Lucky is one of  the strongest feats in D&D 5e — reroll any die three times per day.` },
        { featName: "Alert", reason: `Alert's +5 to initiative is like an always-on spell — it fundamentally changes how often you act first in combat.` },
        { featName: "Sentinel", reason: `Sentinel shuts down enemy movement and punishes disengaging — a powerful control option for any build.` },
      ]);
      if (r) return r;
    }

    // Universal fallback — pick best available feat from the loaded list
    const universalCandidates = [
      { featName: "Lucky", reason: `Lucky (3 rerolls/day) is the most universally powerful feat in D&D 5e — useful for any class at any level.` },
      { featName: "Alert", reason: `+5 to initiative and immunity to surprise makes Alert a top-tier pick for any character.` },
      { featName: "Tough", reason: `Tough adds ${lvl * 2} HP now and +2 HP every future level — straightforward and always valuable.` },
      { featName: "War Caster", reason: `War Caster's advantage on concentration saves and ability to cast spells as opportunity attacks is valuable for nearly any class.` },
      { featName: "Sentinel", reason: `Sentinel shuts down enemy movement and punishes disengaging — a powerful control feat for any build.` },
    ];
    const r = pick(universalCandidates);
    if (r) return r;
    // Last resort: first available feat not already known
    const firstAvailable = availableFeats.find((f) => !knownFeats.has(f.name.toLowerCase()));
    return firstAvailable ? { featName: firstAvailable.name, reason: `${firstAvailable.name} is a strong choice for your character at level ${lvl}.` } : null;
  }

  function selectFeat(feat: Open5eFeat) {
    setAsiScrollHintDismissed(false);
    setAsiScrollHintTimedOut(false);
    setFeatName(feat.name);
    const parts = [
      feat.prerequisites ? `Prerequisites: ${feat.prerequisites}` : "",
      feat.desc?.trim() ?? "",
    ].filter(Boolean);
    setFeatDesc(parts.join("\n\n"));
  }

  function fetchFeatRecommendation() {
    if (featRecommendation) return;
    setFeatRecommendation(computeFeatRecommendation());
  }

  useEffect(() => {
    if (
      !visible ||
      !settings.showScrollHints ||
      asiMode !== "feat" ||
      featName.trim().length === 0 ||
      asiAtBottom ||
      asiScrollHintDismissed ||
      asiScrollHintTimedOut
    ) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setAsiScrollHintTimedOut(true);
    }, ASI_SCROLL_HINT_AUTO_HIDE_MS);

    return () => clearTimeout(timeoutId);
  }, [
    asiAtBottom,
    asiMode,
    asiScrollHintDismissed,
    asiScrollHintTimedOut,
    featName,
    settings.showScrollHints,
    visible,
  ]);

  // ── Shared UI ─────────────────────────────────────────────────────────────────

  function renderHeader(title: string) {
    return (
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <Feather name="x" size={22} color={c.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
  }

  function renderLevelBanner() {
    return (
      <View style={[styles.levelBanner, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={styles.levelCol}>
          <Text style={[styles.levelLabel, { color: c.mutedForeground }]}>CURRENT</Text>
          <Text style={[styles.levelNum, { color: c.mutedForeground }]}>{currentLevel}</Text>
        </View>
        <Feather name="arrow-right" size={22} color={c.primary} />
        <View style={styles.levelCol}>
          <Text style={[styles.levelLabel, { color: c.mutedForeground }]}>NEW LEVEL</Text>
          <Text style={[styles.levelNum, { color: c.primary }]}>{newLevel}</Text>
        </View>
        {engineResult && settings.showDevDeterministicDetails && (
          <View style={[styles.engineBadge, { backgroundColor: c.primary + "18", borderColor: c.primary + "44" }]}>
            <Feather name="cpu" size={11} color={c.primary} />
            <Text style={[styles.engineBadgeText, { color: c.primary }]}>Deterministic</Text>
          </View>
        )}
      </View>
    );
  }

  // ── Render: Loading ───────────────────────────────────────────────────────────

  function renderLoading() {
    return (
      <View style={styles.centerFill}>
        {renderHeader("Level Up")}
        <View style={styles.loadingBody}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={[styles.loadingText, { color: c.foreground }]}>Preparing level-up…</Text>
          <Text style={[styles.loadingSub, { color: c.mutedForeground }]}>
            Checking {character.class} progression to level {newLevel}
          </Text>
        </View>
      </View>
    );
  }

  // ── Render: Error ─────────────────────────────────────────────────────────────

  function renderError() {
    return (
      <View style={styles.centerFill}>
        {renderHeader("Level Up")}
        <View style={styles.loadingBody}>
          <Feather name="alert-circle" size={40} color="#EF4444" />
          <Text style={[styles.loadingText, { color: c.foreground }]}>Something went wrong</Text>
          <Text style={[styles.loadingSub, { color: c.mutedForeground }]}>{errorMsg}</Text>
          <TouchableOpacity
            onPress={computeLevelUp}
            style={[styles.primaryBtn, { backgroundColor: c.primary, marginTop: 16 }]}
            activeOpacity={0.8}
          >
            <Feather name="refresh-cw" size={16} color={c.primaryForeground} />
            <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render: Overview (engine path) ────────────────────────────────────────────

  function renderEngineOverview() {
    if (!engineResult) return null;
    const autoGains = engineResult.automaticGains;
    const spellcasting = engineResult.spellcasting;
    const passiveGains = autoGains.filter((g) => g.kind === "passive") as PassiveGain[];
    const actionGains = autoGains.filter((g) => g.kind === "action") as ActionGain[];
    const resourceGains = autoGains.filter((g) => g.kind === "resource") as ResourceGain[];
    const featureChoices = engineResult.choices.filter((c) => c.kind === "feature");
    const classCoverage = getCoverageBadge(engineResult.coverage.class);
    const subclassCoverage = getCoverageBadge(engineResult.coverage.subclass);
    const raceCoverage = getCoverageBadge(engineResult.coverage.race);
    const overviewCards = buildOverviewCards();
    const whatChanges = buildWhatChangesLines();
    const upcomingSteps = buildUpcomingStepLines();

    return (
      <View style={styles.centerFill}>
        {renderHeader(`Level ${newLevel} — What's New`)}
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {renderLevelBanner()}

          <View style={[styles.noteCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Feather name="info" size={14} color={c.primary} style={{ marginTop: 1 }} />
            <Text style={[styles.noteText, { color: c.mutedForeground }]}>{engineResult.summary}</Text>
          </View>

          {overviewCards.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>AT A GLANCE</Text>
              <View style={styles.overviewGrid}>
                {overviewCards.map((card) => (
                  <View key={card.label} style={[styles.overviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
                    <Text style={[styles.overviewCardLabel, { color: c.mutedForeground }]}>{card.label}</Text>
                    <Text style={[styles.overviewCardValue, { color: card.tone }]}>{card.value}</Text>
                    <Text style={[styles.overviewCardNote, { color: c.mutedForeground }]}>{card.note}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {whatChanges.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>WHAT CHANGES ON YOUR SHEET</Text>
              <View style={[styles.slotCard, { backgroundColor: c.card, borderColor: c.border }]}> 
                {whatChanges.map((item, idx) => (
                  <View key={`what-changes-${idx}`} style={[styles.slotRow, idx < whatChanges.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}> 
                    <Text style={[styles.slotGained, { color: c.mutedForeground, flex: 1, textAlign: "left" }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {upcomingSteps.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>GUIDED NEXT STEPS</Text>
              <View style={[styles.slotCard, { backgroundColor: c.card, borderColor: c.border }]}> 
                {upcomingSteps.map((item, idx) => (
                  <View key={`next-step-${idx}`} style={[styles.slotRow, idx < upcomingSteps.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}> 
                    <Text style={[styles.slotGained, { color: c.mutedForeground, flex: 1, textAlign: "left" }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {settings.showDevDeterministicDetails && (
            <View style={[styles.noteCard, { backgroundColor: c.card, borderColor: c.border }]}> 
              <Feather name="layers" size={14} color={c.primary} style={{ marginTop: 1 }} />
              <Text style={[styles.noteText, { color: c.mutedForeground }]}>Deterministic flow is active for this level-up. All classes and subclasses across all 14 supported classes have authored ProgressionSheets with full feature descriptions — no generated placeholders remain.</Text>
            </View>
          )}

          {/* Badges */}
          <View style={styles.badgesRow}>
            {profBonus > character.proficiencyBonus && (
              <View style={[styles.badge, { backgroundColor: "#8B5CF615", borderColor: "#8B5CF640" }]}>
                <Feather name="trending-up" size={12} color="#8B5CF6" />
                <Text style={[styles.badgeText, { color: "#8B5CF6" }]}>Prof +{profBonus}</Text>
              </View>
            )}
            {hasAsiChoice && (
              <View style={[styles.badge, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" }]}>
                <Feather name="star" size={12} color="#F59E0B" />
                <Text style={[styles.badgeText, { color: "#F59E0B" }]}>ASI / Feat</Text>
              </View>
            )}
            {hasSubclassChoice && (
              <View style={[styles.badge, { backgroundColor: "#EC489915", borderColor: "#EC489940" }]}>
                <Feather name="layers" size={12} color="#EC4899" />
                <Text style={[styles.badgeText, { color: "#EC4899" }]}>Choose Subclass</Text>
              </View>
            )}
            {resourceGains.map((r) => (
              <View key={r.name} style={[styles.badge, { backgroundColor: "#6366F115", borderColor: "#6366F140" }]}>
                <Feather name="zap" size={12} color="#6366F1" />
                <Text style={[styles.badgeText, { color: "#6366F1" }]}>{r.name} → {r.newMax}</Text>
              </View>
            ))}
            {(spellcasting?.spellSlotsGained.length ?? 0) > 0 && (
              <View style={[styles.badge, { backgroundColor: "#6366F115", borderColor: "#6366F140" }]}>
                <Feather name="zap" size={12} color="#6366F1" />
                <Text style={[styles.badgeText, { color: "#6366F1" }]}>New Spell Slots</Text>
              </View>
            )}
            {(spellcasting?.spellsKnownGained ?? 0) > 0 && (
              <View style={[styles.badge, { backgroundColor: "#10B98115", borderColor: "#10B98140" }]}>
                <Feather name="book-open" size={12} color="#10B981" />
                <Text style={[styles.badgeText, { color: "#10B981" }]}>+{spellcasting?.spellsKnownGained} Spell{(spellcasting?.spellsKnownGained ?? 0) > 1 ? "s" : ""}</Text>
              </View>
            )}
            {(spellcasting?.cantripsKnownGained ?? 0) > 0 && (
              <View style={[styles.badge, { backgroundColor: "#EC489915", borderColor: "#EC489940" }]}>
                <Feather name="circle" size={12} color="#EC4899" />
                <Text style={[styles.badgeText, { color: "#EC4899" }]}>+{spellcasting?.cantripsKnownGained} Cantrip{(spellcasting?.cantripsKnownGained ?? 0) > 1 ? "s" : ""}</Text>
              </View>
            )}
            {settings.showDevDeterministicDetails && (
              <>
                <View style={[styles.badge, { backgroundColor: classCoverage.bg, borderColor: classCoverage.border }]}> 
                  <Feather name={classCoverage.icon} size={12} color={classCoverage.textColor} />
                  <Text style={[styles.badgeText, { color: classCoverage.textColor }]}>Class: {classCoverage.label}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: subclassCoverage.bg, borderColor: subclassCoverage.border }]}> 
                  <Feather name={subclassCoverage.icon} size={12} color={subclassCoverage.textColor} />
                  <Text style={[styles.badgeText, { color: subclassCoverage.textColor }]}>Subclass: {subclassCoverage.label}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: raceCoverage.bg, borderColor: raceCoverage.border }]}> 
                  <Feather name={raceCoverage.icon} size={12} color={raceCoverage.textColor} />
                  <Text style={[styles.badgeText, { color: raceCoverage.textColor }]}>Race: {raceCoverage.label}</Text>
                </View>
              </>
            )}
          </View>

            {featureChoices.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>FEATURE CHOICES TO REVIEW</Text>
                {featureChoices.map((choice, idx) => (
                  <View key={`feature-choice-${idx}`} style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border }]}>
                    <View style={styles.featureRow}>
                      <View style={[styles.featureDot, { backgroundColor: "#F59E0B" }]} />
                      <Text style={[styles.featureName, { color: c.foreground }]}>{formatProgressionChoiceLabel(choice.kind)}</Text>
                    </View>
                    <Text style={[styles.featureDesc, { color: c.mutedForeground }]}>{choice.prompt}</Text>
                  </View>
                ))}
              </>
            )}

            {engineResult.optionalReplacements.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>OPTIONAL REPLACEMENTS</Text>
                {engineResult.optionalReplacements.map((replacement, idx) => (
                  <View key={`replacement-${idx}`} style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border }]}>
                    <View style={styles.featureRow}>
                      <View style={[styles.featureDot, { backgroundColor: "#EC4899" }]} />
                      <Text style={[styles.featureName, { color: c.foreground }]}>Optional Replacement</Text>
                    </View>
                    <Text style={[styles.featureDesc, { color: c.mutedForeground }]}>{replacement.prompt}</Text>
                  </View>
                ))}
              </>
            )}

            {settings.showDevRebuildSteps && engineResult.derivedUpdates.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>DERIVED REBUILD STEPS</Text>
                <View style={[styles.slotCard, { backgroundColor: c.card, borderColor: c.border }]}> 
                  {engineResult.derivedUpdates.map((update, idx) => (
                    <View key={`derived-${idx}`} style={[styles.slotRow, idx < engineResult.derivedUpdates.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}>
                      <Text style={[styles.slotLevel, { color: c.foreground }]}>{update.kind.replace(/_/g, " ")}</Text>
                      <Text style={[styles.slotGained, { color: c.mutedForeground }]}>{update.description}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

          {(spellcasting?.spellSlotsGained.length ?? 0) > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>NEW SPELL SLOTS</Text>
              <View style={[styles.slotCard, { backgroundColor: c.card, borderColor: c.border }]}> 
                {spellcasting?.spellSlotsGained.map((slot, idx) => (
                  <View key={`engine-slot-${slot.level}`} style={[styles.slotRow, idx < (spellcasting?.spellSlotsGained.length ?? 0) - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}> 
                    <Text style={[styles.slotLevel, { color: c.foreground }]}>{SLOT_ORDINAL[slot.level]} Level</Text>
                    <Text style={[styles.slotGained, { color: "#6366F1" }]}>+{slot.gained}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Usable abilities */}
          {actionGains.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>NEW ABILITIES</Text>
              {actionGains.map((g) => (
                <View key={g.name} style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={styles.featureRow}>
                    <View style={[styles.featureDot, { backgroundColor: "#10B981" }]} />
                    <Text style={[styles.featureName, { color: c.foreground }]}>{g.name}</Text>
                    <View style={[styles.actionTag, { backgroundColor: "#10B98120" }]}>
                      <Text style={[styles.actionTagText, { color: "#10B981" }]}>{g.actionType.replace("_", " ")}</Text>
                    </View>
                  </View>
                  <Text style={[styles.featureDesc, { color: c.mutedForeground }]}>{g.description}</Text>
                </View>
              ))}
            </>
          )}

          {/* Passive features */}
          {passiveGains.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>PASSIVE FEATURES</Text>
              {passiveGains.map((g) => (
                <View key={g.name} style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={styles.featureRow}>
                    <View style={[styles.featureDot, { backgroundColor: c.primary }]} />
                    <Text style={[styles.featureName, { color: c.foreground }]}>{g.name}</Text>
                  </View>
                  <Text style={[styles.featureDesc, { color: c.mutedForeground }]}>{g.description}</Text>
                </View>
              ))}
            </>
          )}

          {autoGains.length === 0 && (spellcasting?.spellSlotsGained.length ?? 0) === 0 && (
            <Text style={[styles.emptyNote, { color: c.mutedForeground }]}>
              This level your Ki pool grows and your existing abilities sharpen — no new standalone features.
            </Text>
          )}

          <TouchableOpacity onPress={goFromOverview} style={[styles.primaryBtn, { backgroundColor: c.primary, marginTop: 8 }]} activeOpacity={0.85}>
            <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>
              {hasSubclassChoice ? "Continue: Choose Subclass" : "Continue: Choose HP"}
            </Text>
            <Feather name="arrow-right" size={16} color={c.primaryForeground} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  function renderRebuild() {
    const items = engineResult?.derivedUpdates?.length
      ? engineResult.derivedUpdates.map((d) => d.description)
      : [
          "Rebuilding actions and abilities.",
          "Refreshing resource maxima and counters.",
          "Synchronizing derived sheet state.",
        ];

    return (
      <View style={styles.centerFill}>
        {renderHeader("Applying Level Up")}
        <View style={styles.loadingBody}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={[styles.loadingText, { color: c.foreground }]}>Rebuilding derived state...</Text>
          {items.map((item, idx) => (
            <Text key={`rebuild-item-${idx}`} style={[styles.loadingSub, { color: c.mutedForeground, textAlign: "center" }]}>
              • {item}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  // ── Render: Overview (AI fallback path) ───────────────────────────────────────

  function renderAiOverview() {
    if (!aiData) return null;
    const { newFeatures, notes } = aiData;
    const spellSlotsGained = spellcastingProgression?.spellSlotsGained ?? [];
    const spellsKnownGained = spellcastingProgression?.spellsKnownGained ?? 0;
    const cantripsKnownGained = spellcastingProgression?.cantripsKnownGained ?? 0;
    const profUp = profBonus > character.proficiencyBonus;
    const overviewCards = buildOverviewCards();
    const whatChanges = buildWhatChangesLines();
    const upcomingSteps = buildUpcomingStepLines();

    return (
      <View style={styles.centerFill}>
        {renderHeader(`Level ${newLevel} — What's New`)}
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {renderLevelBanner()}

          <View style={[styles.noteCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Feather name="info" size={14} color={c.primary} style={{ marginTop: 1 }} />
            <Text style={[styles.noteText, { color: c.mutedForeground }]}>{notes}</Text>
          </View>

          {overviewCards.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>AT A GLANCE</Text>
              <View style={styles.overviewGrid}>
                {overviewCards.map((card) => (
                  <View key={card.label} style={[styles.overviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
                    <Text style={[styles.overviewCardLabel, { color: c.mutedForeground }]}>{card.label}</Text>
                    <Text style={[styles.overviewCardValue, { color: card.tone }]}>{card.value}</Text>
                    <Text style={[styles.overviewCardNote, { color: c.mutedForeground }]}>{card.note}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {whatChanges.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>WHAT CHANGES ON YOUR SHEET</Text>
              <View style={[styles.slotCard, { backgroundColor: c.card, borderColor: c.border }]}> 
                {whatChanges.map((item, idx) => (
                  <View key={`ai-what-changes-${idx}`} style={[styles.slotRow, idx < whatChanges.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}> 
                    <Text style={[styles.slotGained, { color: c.mutedForeground, flex: 1, textAlign: "left" }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {upcomingSteps.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>GUIDED NEXT STEPS</Text>
              <View style={[styles.slotCard, { backgroundColor: c.card, borderColor: c.border }]}> 
                {upcomingSteps.map((item, idx) => (
                  <View key={`ai-next-step-${idx}`} style={[styles.slotRow, idx < upcomingSteps.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}> 
                    <Text style={[styles.slotGained, { color: c.mutedForeground, flex: 1, textAlign: "left" }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.badgesRow}>
            {profUp && (
              <View style={[styles.badge, { backgroundColor: "#8B5CF615", borderColor: "#8B5CF640" }]}>
                <Feather name="trending-up" size={12} color="#8B5CF6" />
                <Text style={[styles.badgeText, { color: "#8B5CF6" }]}>Prof +{profBonus}</Text>
              </View>
            )}
            {aiData.abilityScoreImprovement && (
              <View style={[styles.badge, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" }]}>
                <Feather name="star" size={12} color="#F59E0B" />
                <Text style={[styles.badgeText, { color: "#F59E0B" }]}>ASI / Feat</Text>
              </View>
            )}
            {spellSlotsGained.length > 0 && (
              <View style={[styles.badge, { backgroundColor: "#6366F115", borderColor: "#6366F140" }]}>
                <Feather name="zap" size={12} color="#6366F1" />
                <Text style={[styles.badgeText, { color: "#6366F1" }]}>New Spell Slots</Text>
              </View>
            )}
            {spellsKnownGained > 0 && (
              <View style={[styles.badge, { backgroundColor: "#10B98115", borderColor: "#10B98140" }]}>
                <Feather name="book-open" size={12} color="#10B981" />
                <Text style={[styles.badgeText, { color: "#10B981" }]}>+{spellsKnownGained} Spell{spellsKnownGained > 1 ? "s" : ""}</Text>
              </View>
            )}
            {cantripsKnownGained > 0 && (
              <View style={[styles.badge, { backgroundColor: "#EC489915", borderColor: "#EC489940" }]}>
                <Feather name="circle" size={12} color="#EC4899" />
                <Text style={[styles.badgeText, { color: "#EC4899" }]}>+{cantripsKnownGained} Cantrip{cantripsKnownGained > 1 ? "s" : ""}</Text>
              </View>
            )}
          </View>

          {newFeatures.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>FEATURES GAINED</Text>
              {newFeatures.map((f, i) => (
                <View key={i} style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={styles.featureRow}>
                    <View style={[styles.featureDot, { backgroundColor: c.primary }]} />
                    <Text style={[styles.featureName, { color: c.foreground }]}>{f.name}</Text>
                  </View>
                  <Text style={[styles.featureDesc, { color: c.mutedForeground }]}>{f.description}</Text>
                </View>
              ))}
            </>
          )}

          {spellSlotsGained.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>NEW SPELL SLOTS</Text>
              <View style={[styles.slotCard, { backgroundColor: c.card, borderColor: c.border }]}>
                {spellSlotsGained.map((s, i) => (
                  <View key={i} style={[styles.slotRow, i < spellSlotsGained.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}>
                    <Text style={[styles.slotLevel, { color: c.foreground }]}>{SLOT_ORDINAL[s.level]} Level</Text>
                    <Text style={[styles.slotGained, { color: "#6366F1" }]}>+{s.gained}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {newFeatures.length === 0 && spellSlotsGained.length === 0 && (
            <Text style={[styles.emptyNote, { color: c.mutedForeground }]}>
              This level brings incremental growth — check your class table for details.
            </Text>
          )}

          <TouchableOpacity onPress={goFromOverview} style={[styles.primaryBtn, { backgroundColor: c.primary, marginTop: 8 }]} activeOpacity={0.85}>
            <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>Continue: Choose HP</Text>
            <Feather name="arrow-right" size={16} color={c.primaryForeground} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Render: Subclass Step ─────────────────────────────────────────────────────

  function renderSubclass() {
    const options = getSubclassOptions(character.class);
    const canProceed = (chosenSubclass || customSubclass.trim()).length > 0;

    return (
      <KeyboardAvoidingView style={styles.centerFill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {renderHeader("Choose Subclass")}
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {renderLevelBanner()}

          <Text style={[styles.asiIntro, { color: c.mutedForeground }]}>
            At level {newLevel}, you choose your {character.class} subclass. This shapes your entire future progression.
          </Text>

          {options.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>SUBCLASS OPTIONS</Text>
              {options.map((sub) => {
                const coverage = getDeterministicSubclassCoverage(character.class, sub);
                const badge = getCoverageBadge(coverage);
                const selected = chosenSubclass === sub;
                return (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => { setChosenSubclass(sub); setCustomSubclass(""); }}
                    activeOpacity={0.75}
                    style={[
                      styles.subclassOption,
                      { backgroundColor: c.card, borderColor: selected ? c.primary : c.border },
                    ]}
                  >
                    <View style={styles.subclassOptionRow}>
                      <Text style={[styles.subclassOptionName, { color: selected ? c.primary : c.foreground }]}>{sub}</Text>
                      {settings.showDevDeterministicDetails && (
                        <View style={[styles.supportedBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}> 
                          <Feather name={badge.icon} size={11} color={badge.textColor} />
                          <Text style={[styles.supportedBadgeText, { color: badge.textColor }]}>{badge.label}</Text>
                        </View>
                      )}
                    </View>
                    {selected && <Feather name="check" size={18} color={c.primary} />}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <Text style={[styles.sectionLabel, { color: c.mutedForeground, marginTop: 12 }]}>OR TYPE A CUSTOM SUBCLASS</Text>
          <TextInput
            value={customSubclass}
            onChangeText={(t) => { setCustomSubclass(t); setChosenSubclass(""); }}
            placeholder="e.g. Way of the Astral Self"
            placeholderTextColor={c.mutedForeground}
            style={[styles.textInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
          />

          <TouchableOpacity
            onPress={goFromSubclass}
            disabled={!canProceed}
            style={[styles.primaryBtn, { backgroundColor: canProceed ? c.primary : c.muted, marginTop: 16, opacity: canProceed ? 1 : 0.5 }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryBtnText, { color: canProceed ? c.primaryForeground : c.mutedForeground }]}>
              Continue: Choose HP
            </Text>
            <Feather name="arrow-right" size={16} color={canProceed ? c.primaryForeground : c.mutedForeground} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: HP ────────────────────────────────────────────────────────────────

  function renderHp() {
    const avg = Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
    const rollLocked = rolledValue !== null;
    const isAvg = hpGain !== null && hpChoiceMode === "average";
    const isRoll = hpGain !== null && hpChoiceMode === "roll";

    return (
      <View style={styles.centerFill}>
        {renderHeader("Hit Points")}
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {renderLevelBanner()}
          <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>
            HIT DIE: d{hitDie} · CON: {getMod(character.abilityScores.constitution)}
          </Text>

          <View style={styles.hpOptions}>
            <TouchableOpacity
              onPress={handleAverage}
              activeOpacity={0.8}
              style={[styles.hpOption, { backgroundColor: c.card, borderColor: isAvg ? c.primary : c.border }]}
            >
              <Text style={[styles.hpOptionLabel, { color: c.mutedForeground }]}>TAKE AVERAGE</Text>
              <Text style={[styles.hpOptionValue, { color: isAvg ? c.primary : c.foreground }]}>+{avg}</Text>
              <Text style={[styles.hpOptionSub, { color: c.mutedForeground }]}>
                {Math.floor(hitDie / 2) + 1} + {conMod >= 0 ? `+${conMod}` : conMod} CON
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSelectRoll}
              activeOpacity={0.8}
              style={[styles.hpOption, { backgroundColor: c.card, borderColor: isRoll ? "#10B981" : c.border }]}
            >
              <Text style={[styles.hpOptionLabel, { color: c.mutedForeground }]}>ROLL d{hitDie}</Text>
              {rollLocked ? (
                <>
                  <Text style={[styles.hpOptionValue, { color: "#10B981" }]}>+{Math.max(1, rolledValue + conMod)}</Text>
                  <Text style={[styles.hpOptionSub, { color: c.mutedForeground }]}>
                    Rolled {rolledValue} + {conMod >= 0 ? `+${conMod}` : conMod} CON
                  </Text>
                  <View style={[styles.rolledLock, { backgroundColor: "#10B98118", borderColor: "#10B98140" }]}>
                    <Feather name="lock" size={11} color="#10B981" />
                    <Text style={[styles.rolledLockText, { color: "#10B981" }]}>Result locked in</Text>
                  </View>
                </>
              ) : (
                <>
                  <Feather name="shuffle" size={28} color={c.mutedForeground} style={{ marginVertical: 4 }} />
                  <Text style={[styles.hpOptionSub, { color: c.mutedForeground }]}>Tap to roll — once only</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {hpGain !== null && (
            <View style={[styles.hpSummary, { backgroundColor: "#10B98120", borderColor: "#10B98140" }]}>
              <Feather name="heart" size={14} color="#10B981" />
              <Text style={[styles.hpSummaryText, { color: "#10B981" }]}>
                Max HP: {character.maxHp} → {character.maxHp + hpGain} (+{hpGain})
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={goFromHp}
            disabled={hpGain === null}
            activeOpacity={0.85}
            style={[styles.primaryBtn, { backgroundColor: hpGain !== null ? c.primary : c.muted, opacity: hpGain !== null ? 1 : 0.5, marginTop: 8 }]}
          >
            <Text style={[styles.primaryBtnText, { color: hpGain !== null ? c.primaryForeground : c.mutedForeground }]}>
              {hasAsiChoice ? "Continue: Choose ASI / Feat" : "Confirm Level Up"}
            </Text>
            <Feather name="arrow-right" size={16} color={hpGain !== null ? c.primaryForeground : c.mutedForeground} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Render: ASI ───────────────────────────────────────────────────────────────

  function renderAsi() {
    const knownFeatNames = new Set((character.feats ?? []).map((f) => f.name.trim().toLowerCase()));
    const classTip = CLASS_STAT_TIPS[character.class ?? ""];
    const raceFocus = getRaceFocusStats(character.race ?? "");
    const suggestedAsiPlan = getSuggestedAsiPlan();
    const classPrimaryKeys = new Set(
      (classTip?.primary ?? [])
        .map((n) => ABILITY_NAME_TO_KEY[n.toLowerCase()])
        .filter((k): k is keyof AbilityScores => Boolean(k))
    );
    const desiredStatKeys = [
      ...(classTip?.primary ?? []),
      ...raceFocus,
      ...(classTip?.also ?? []),
    ]
      .map((n) => ABILITY_NAME_TO_KEY[n.toLowerCase()])
      .filter((k): k is keyof AbilityScores => Boolean(k))
      .filter((k, idx, arr) => arr.indexOf(k) === idx);
    const bestNextAsi = desiredStatKeys
      .map((k, idx) => {
        const score = character.abilityScores[k];
        const target = classPrimaryKeys.has(k) ? 16 : 14;
        return { k, score, gap: Math.max(0, target - score), idx };
      })
      .sort((a, b) => b.gap - a.gap || a.score - b.score || a.idx - b.idx)
      .slice(0, 3);
    const featSearchTerm = featSearch.trim().toLowerCase();
    const selectedFeatName = featName.trim().toLowerCase();
    const recommendedFeatName = featRecommendation?.featName.trim().toLowerCase() ?? "";
    const recommendedSelected = selectedFeatName.length > 0 && selectedFeatName === recommendedFeatName;
    const recommendedMatch = featRecommendation
      ? availableFeats.find((f) => f.name.toLowerCase() === recommendedFeatName) ?? null
      : null;
    const filteredFeats = availableFeats.filter((feat) => {
      if (!matchesFeatPrereqFilter(feat, featPrereqFilter)) return false;
      if (!featSearchTerm) return true;
      const haystack = [feat.name, feat.desc ?? "", feat.prerequisites ?? ""].join(" ").toLowerCase();
      return haystack.includes(featSearchTerm);
    });
    const selectedFeatProgression = getSelectedFeatSpellProgression();
    const featColumnCount =
      featViewMode === "list"
        ? 1
        : featViewMode === "two"
          ? 2
          : 3;
    const featCardWidth = `${100 / featColumnCount}%`;
    const isCompactFeatView = featColumnCount > 1;
    const showScrollHint =
      settings.showScrollHints &&
      asiMode === "feat" &&
      featName.trim().length > 0 &&
      !asiAtBottom &&
      !asiScrollHintDismissed &&
      !asiScrollHintTimedOut;

    return (
      <KeyboardAvoidingView style={styles.centerFill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {renderHeader("Ability Score Improvement")}
        <ScrollView
          ref={asiScrollRef}
          contentContainerStyle={[styles.body, showScrollHint ? { paddingBottom: 110 } : null]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(e) => {
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 140;
            if (nearBottom !== asiAtBottom) setAsiAtBottom(nearBottom);
          }}
        >
          {renderLevelBanner()}
          <Text style={[styles.asiIntro, { color: c.mutedForeground }]}>
            Choose how to spend your Ability Score Improvement at level {newLevel}.
          </Text>

          {asiMode !== "feat" && (classTip || raceFocus.length > 0) && (
            <View style={[styles.noteCard, { backgroundColor: c.primary + "10", borderColor: c.primary + "30", marginBottom: 10 }]}> 
              <Feather name="target" size={14} color={c.primary} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.primary, marginBottom: 4 }}>
                  Build Guidance ({character.class}{character.race ? ` / ${character.race}` : ""})
                </Text>
                {classTip && (
                  <Text style={{ fontSize: 12, color: c.foreground, lineHeight: 17, marginBottom: 2 }}>
                    Class priority: {classTip.primary.join(" · ")}
                    {classTip.also.length ? ` | Also useful: ${classTip.also.join(" · ")}` : ""}
                  </Text>
                )}
                {raceFocus.length > 0 && (
                  <Text style={{ fontSize: 12, color: c.foreground, lineHeight: 17, marginBottom: 2 }}>
                    Race synergy: {raceFocus.join(" · ")}
                  </Text>
                )}
                {bestNextAsi.length > 0 && (
                  <Text style={{ fontSize: 12, color: c.mutedForeground, lineHeight: 17 }}>
                    Best next ASI: {bestNextAsi.map((x) => `${STAT_ABBR[x.k]} (${x.score})`).join(" -> ")}
                  </Text>
                )}
                {suggestedAsiPlan ? (
                  <TouchableOpacity
                    onPress={applySuggestedAsi}
                    activeOpacity={0.82}
                    style={[
                      styles.secondaryBtn,
                      {
                        marginTop: 8,
                        alignSelf: "flex-start",
                        borderColor: c.primary + "55",
                        backgroundColor: c.primary + "14",
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                      },
                    ]}
                  >
                    <Feather name="zap" size={14} color={c.primary} />
                    <Text style={[styles.secondaryBtnText, { color: c.primary }]}> 
                      Assign Suggested: {suggestedAsiPlan.mode === "two"
                        ? `+2 ${STAT_ABBR[suggestedAsiPlan.stat1]}`
                        : `+1 ${STAT_ABBR[suggestedAsiPlan.stat1]} / +1 ${STAT_ABBR[suggestedAsiPlan.stat2!]}`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {classTip?.note ? (
                  <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>{classTip.note}</Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Mode tabs */}
          <View style={[styles.asiModes, { backgroundColor: c.card, borderColor: c.border }]}>
            {([["two", "+2 to One"], ["one_one", "+1 to Two"], ["feat", "Take Feat"]] as const).map(([mode, label]) => (
              <TouchableOpacity
                key={mode}
                onPress={() => {
                  setAsiMode(mode);
                  setAsiStat1(null);
                  setAsiStat2(null);
                  setFeatName("");
                  setFeatDesc("");
                  setFeatSearch("");
                  setFeatPrereqFilter("all");
                  setAsiScrollHintDismissed(false);
                  setAsiScrollHintTimedOut(false);
                  if (mode === "feat") fetchFeatRecommendation();
                }}
                style={[styles.asiModeTab, { borderColor: asiMode === mode ? c.primary : "transparent", backgroundColor: asiMode === mode ? c.primary + "18" : "transparent" }]}
                activeOpacity={0.75}
              >
                <Text style={[styles.asiModeLabel, { color: asiMode === mode ? c.primary : c.mutedForeground }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {(asiMode === "two" || asiMode === "one_one") && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>SELECT STAT{asiMode === "one_one" ? "S (CHOOSE 2)" : ""}</Text>
              <View style={styles.statGrid}>
                {STAT_KEYS.map((stat) => {
                  const selected = isStatSelected(stat);
                  return (
                    <TouchableOpacity
                      key={stat}
                      onPress={() => toggleStat(stat)}
                      activeOpacity={0.75}
                      style={[styles.statCell, { backgroundColor: c.card, borderColor: selected ? c.primary : c.border }]}
                    >
                      <Text style={[styles.statAbbr, { color: selected ? c.primary : c.mutedForeground }]}>{STAT_ABBR[stat]}</Text>
                      <Text style={[styles.statVal, { color: selected ? c.primary : c.foreground }]}>
                        {character.abilityScores[stat]}{selected ? ` → ${character.abilityScores[stat] + (asiMode === "two" ? 2 : 1)}` : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {asiMode === "feat" && (
            <>
              {/* ── AI Recommendation ── */}
              {(loadingFeats || featRecommendation) && (
                <View style={[
                  styles.noteCard,
                  {
                    backgroundColor: featRecommendation ? c.primary + "12" : c.card,
                    borderColor: featRecommendation ? c.primary + "55" : c.border,
                    marginBottom: 10,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  },
                ]}>
                  {loadingFeats && !featRecommendation ? (
                    <>
                      <ActivityIndicator size="small" color={c.primary} style={{ marginTop: 2 }} />
                      <Text style={[styles.noteText, { color: c.mutedForeground, flex: 1 }]}>Finding the best feat for your character...</Text>
                    </>
                  ) : featRecommendation ? (
                    <>
                      <Feather name="zap" size={16} color={c.primary} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: c.primary, marginBottom: 2 }}>
                          AI RECOMMENDATION: {featRecommendation.featName}
                        </Text>
                        <Text style={{ fontSize: 12, color: c.mutedForeground, lineHeight: 17 }}>{featRecommendation.reason}</Text>
                        {recommendedMatch && (
                          <TouchableOpacity
                            onPress={!recommendedSelected ? () => selectFeat(recommendedMatch) : undefined}
                            activeOpacity={0.8}
                            style={{
                              marginTop: 6,
                              alignSelf: "flex-start",
                              backgroundColor: recommendedSelected ? "#10B981" : c.primary,
                              borderRadius: 6,
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                            }}
                          >
                            <Text style={{ fontSize: 12, color: c.primaryForeground, fontWeight: "600" }}>
                              {recommendedSelected ? "Selected" : "Select this feat"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  ) : null}
                </View>
              )}

              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>BROWSE FEATS</Text>
              <View style={[styles.spellInputRow, { marginBottom: 6 }]}>
                <Feather name="search" size={14} color={c.mutedForeground} style={{ position: "absolute", left: 10, zIndex: 1 }} />
                <TextInput
                  value={featSearch}
                  onChangeText={setFeatSearch}
                  placeholder="Search feats..."
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.spellTextInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, paddingLeft: 30, flex: 1 }]}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", gap: 6, paddingRight: 6 }}>
                  {([
                    ["all", "All"],
                    ["none", "No Prereq"],
                    ["spellcasting", "Spellcasting"],
                    ["str", "STR"],
                    ["dex", "DEX"],
                    ["con", "CON"],
                    ["int", "INT"],
                    ["wis", "WIS"],
                    ["cha", "CHA"],
                    ["proficiency", "Proficiency"],
                  ] as const).map(([value, label]) => {
                    const selected = featPrereqFilter === value;
                    return (
                      <TouchableOpacity
                        key={`feat-filter-${value}`}
                        onPress={() => setFeatPrereqFilter(value)}
                        activeOpacity={0.78}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          borderWidth: 1,
                          backgroundColor: selected ? c.primary + "18" : c.card,
                          borderColor: selected ? c.primary : c.border,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "600", color: selected ? c.primary : c.mutedForeground }}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.featViewHeader}>
                <Text style={[styles.featViewLabel, { color: c.mutedForeground }]}>View</Text>
                <View style={[styles.featViewModes, { backgroundColor: c.card, borderColor: c.border }]}> 
                  {([
                    ["list", "List"],
                    ["two", "2 Col"],
                    ["three", "3 Col"],
                  ] as const).map(([mode, label]) => {
                    const selected = featViewMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        onPress={() => setFeatViewMode(mode)}
                        activeOpacity={0.78}
                        style={[
                          styles.featViewTab,
                          {
                            backgroundColor: selected ? c.primary + "18" : "transparent",
                            borderColor: selected ? c.primary : "transparent",
                          },
                        ]}
                      >
                        <Text style={[styles.featViewTabText, { color: selected ? c.primary : c.mutedForeground }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {loadingFeats && (
                <View style={[styles.noteCard, { backgroundColor: c.card, borderColor: c.border, marginBottom: 8 }]}>
                  <ActivityIndicator size="small" color={c.primary} />
                  <Text style={[styles.noteText, { color: c.mutedForeground }]}>Loading feats from Open5e...</Text>
                </View>
              )}

              {!loadingFeats && featLoadError ? (
                <Text style={[styles.emptyNote, { color: c.mutedForeground }]}>Could not load feat list ({featLoadError}). You can still enter a custom feat below.</Text>
              ) : null}

              {!loadingFeats && !featLoadError && featQualityNotice ? (
                <Text style={[styles.emptyNote, { color: c.mutedForeground }]}>{featQualityNotice}</Text>
              ) : null}

              {!loadingFeats && !featLoadError && filteredFeats.length === 0 ? (
                <Text style={[styles.emptyNote, { color: c.mutedForeground }]}>No feats match your search.</Text>
              ) : null}

              {!loadingFeats && !featLoadError && filteredFeats.length > 0 && (
                <View style={styles.featGrid}>
                  {filteredFeats.map((feat) => {
                    const selected = feat.name.trim().toLowerCase() === featName.trim().toLowerCase();
                    const isRecommended = featRecommendation?.featName.toLowerCase() === feat.name.toLowerCase();
                    const alreadyKnown = knownFeatNames.has(feat.name.trim().toLowerCase()) && !selected;

                    return (
                      <TouchableOpacity
                        key={feat.slug}
                        onPress={() => selectFeat(feat)}
                        activeOpacity={0.75}
                        disabled={alreadyKnown}
                        style={[
                          styles.featGridCell,
                          {
                            width: featCardWidth as any,
                            opacity: alreadyKnown ? 0.45 : 1,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.featCard,
                            {
                              backgroundColor: selected ? c.primary + "18" : c.card,
                              borderColor: selected ? c.primary : isRecommended ? c.primary + "55" : c.border,
                              minHeight: isCompactFeatView ? 108 : 132,
                            },
                          ]}
                        >
                          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: isCompactFeatView ? 12 : 13,
                                  fontWeight: "700",
                                  color: selected ? c.primary : c.foreground,
                                  lineHeight: isCompactFeatView ? 16 : 17,
                                }}
                                numberOfLines={isCompactFeatView ? 3 : 2}
                              >
                                {feat.name}
                              </Text>
                              {alreadyKnown && (
                                <View style={{ backgroundColor: c.muted, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, alignSelf: "flex-start", marginTop: 2 }}>
                                  <Text style={{ fontSize: 9, color: c.mutedForeground }}>Already known</Text>
                                </View>
                              )}
                              {isRecommended && !alreadyKnown && (
                                <View style={{ backgroundColor: c.primary + "22", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, alignSelf: "flex-start", marginTop: 2 }}>
                                  <Text style={{ fontSize: 9, color: c.primary, fontWeight: "600" }}>⚡ Recommended</Text>
                                </View>
                              )}
                            </View>
                            {selected ? <Feather name="check" size={14} color={c.primary} /> : null}
                          </View>
                          {feat.prerequisites ? (
                            <Text style={{ fontSize: 10, color: c.mutedForeground, marginTop: 3 }} numberOfLines={isCompactFeatView ? 2 : 1}>Req: {feat.prerequisites}</Text>
                          ) : null}
                          <Text
                            style={{
                              fontSize: isCompactFeatView ? 10 : 11,
                              color: c.mutedForeground,
                              marginTop: 3,
                              lineHeight: isCompactFeatView ? 14 : 15,
                            }}
                          >
                            {feat.desc || "No description available."}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.sectionLabel, { color: c.mutedForeground, marginTop: 4 }]}>FEAT NAME</Text>
              <TextInput
                value={featName}
                onChangeText={setFeatName}
                placeholder="e.g. Alert, War Caster, Lucky…"
                placeholderTextColor={c.mutedForeground}
                style={[styles.textInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
              />
              <Text style={[styles.sectionLabel, { color: c.mutedForeground, marginTop: 8 }]}>DESCRIPTION (OPTIONAL)</Text>
              <TextInput
                value={featDesc}
                onChangeText={setFeatDesc}
                placeholder="Brief feat description…"
                placeholderTextColor={c.mutedForeground}
                multiline
                numberOfLines={3}
                style={[styles.textInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, minHeight: 72 }]}
              />
              {selectedFeatProgression && (
                <View style={[styles.noteCard, { backgroundColor: c.primary + "12", borderColor: c.primary + "40", marginTop: 10 }]}> 
                  <Feather name="book-open" size={14} color={c.primary} style={{ marginTop: 1 }} />
                  <Text style={[styles.noteText, { color: c.foreground }]}> 
                    This feat grants spell progression: {selectedFeatProgression.cantripsKnownGained > 0 ? `${selectedFeatProgression.cantripsKnownGained} cantrip${selectedFeatProgression.cantripsKnownGained > 1 ? "s" : ""}` : ""}
                    {selectedFeatProgression.cantripsKnownGained > 0 && selectedFeatProgression.spellsKnownGained > 0 ? " and " : ""}
                    {selectedFeatProgression.spellsKnownGained > 0 ? `${selectedFeatProgression.spellsKnownGained} spell${selectedFeatProgression.spellsKnownGained > 1 ? "s" : ""}${selectedFeatProgression.maxSpellLevel > 0 ? ` up to level ${selectedFeatProgression.maxSpellLevel}` : ""}` : ""}.
                    {selectedFeatProgression.classOptions.length > 0 ? ` You'll choose from ${selectedFeatProgression.classOptions.join(", ")} next.` : ""}
                  </Text>
                </View>
              )}
            </>
          )}

          <TouchableOpacity
            onPress={goFromAsi}
            disabled={!asiNextReady()}
            activeOpacity={0.85}
            style={[styles.primaryBtn, { backgroundColor: asiNextReady() ? c.primary : c.muted, opacity: asiNextReady() ? 1 : 0.5, marginTop: 8 }]}
          >
            <Text style={[styles.primaryBtnText, { color: asiNextReady() ? c.primaryForeground : c.mutedForeground }]}>
              {selectedFeatProgression || hasSpellChoice ? "Continue: Learn Spells" : "Confirm Level Up"}
            </Text>
            <Feather name="check" size={16} color={asiNextReady() ? c.primaryForeground : c.mutedForeground} />
          </TouchableOpacity>
          <View nativeID={ASI_BOTTOM_ANCHOR_ID} style={{ height: 56 }} />
        </ScrollView>

        {showScrollHint && (
          <View
            style={{
              position: "absolute",
              bottom: 10,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setAsiAtBottom(true);
                setAsiScrollHintDismissed(true);
                setAsiScrollHintTimedOut(true);
                scrollAsiToBottom();
              }}
              activeOpacity={0.85}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: c.primary + "E6",
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Feather name="arrow-down" size={13} color={c.primaryForeground} />
              <Text style={{ color: c.primaryForeground, fontSize: 12, fontWeight: "600" }}>Scroll for more</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  // ── Render: Spell Choice ──────────────────────────────────────────────────────

  function renderSpells() {
    const spellsNeeded   = activeSpellChoice?.spellsKnownGained ?? aiData?.spellsKnownGained ?? 0;
    const cantripsNeeded = activeSpellChoice?.cantripsKnownGained ?? aiData?.cantripsKnownGained ?? 0;
    const maxLevel       = activeSpellChoice?.maxSpellLevel ?? defaultNewSpellLevel;
    const levelOptions   = Array.from({ length: maxLevel }, (_, i) => i + 1);

    const classOptions = activeSpellChoice?.classOptions?.length
      ? activeSpellChoice.classOptions
      : [character.class ?? ""];
    const cls = spellChoiceClass || classOptions[0] || character.class || "";

    // Build lists from the database — filtered by class and gated by maxLevel
    const rawLeveledSpells = getSpellsForClass(cls, 1, maxLevel);
    const rawCantripSpells = getSpellsForClass(cls, 0, 0);

    const matchesSpellFilter = (spell: SpellEntry) => {
      if (!activeSpellChoice || activeSpellChoice.spellFilter === "any") return true;
      if (activeSpellChoice.spellFilter === "attack-roll") {
        return /attack roll|spell attack/i.test(spell.desc);
      }
      if (activeSpellChoice.spellFilter === "ritual") {
        return /ritual/i.test(spell.desc);
      }
      return true;
    };

    const allLeveledSpells = rawLeveledSpells.filter(matchesSpellFilter);
    const allCantripSpells = rawCantripSpells.filter(matchesSpellFilter);

    // Names the character already knows (so we can mark duplicates)
    const knownNames = new Set(preparedSpells.map((s) => s.name.toLowerCase()));

    // Currently selected
    const selectedNames   = new Set(pendingSpells.map((s) => s.name));
    const selectedCantrips = new Set(pendingCantrips);

    // Leveled spells filtered by level chip + search
    const filteredLeveled = allLeveledSpells.filter((s) => {
      if (levelOptions.length > 1 && s.level !== spellLevel) return false;
      if (spellSearch.trim()) return s.name.toLowerCase().includes(spellSearch.trim().toLowerCase());
      return true;
    });

    // Cantrips filtered by search
    const filteredCantrips = allCantripSpells.filter((s) => {
      if (cantripSearch.trim()) return s.name.toLowerCase().includes(cantripSearch.trim().toLowerCase());
      return true;
    });

    const spellsDone   = pendingSpells.length >= spellsNeeded;
    const cantripsDone = pendingCantrips.length >= cantripsNeeded;
    const canConfirm   = (spellsNeeded === 0 || spellsDone) && (cantripsNeeded === 0 || cantripsDone);

    const toggleSpell = (sp: SpellEntry) => {
      if (selectedNames.has(sp.name)) {
        setPendingSpells((p) => p.filter((s) => s.name !== sp.name));
      } else if (pendingSpells.length < spellsNeeded) {
        setPendingSpells((p) => [...p, { name: sp.name, level: sp.level }]);
      }
    };

    const toggleCantrip = (sp: SpellEntry) => {
      if (selectedCantrips.has(sp.name)) {
        setPendingCantrips((p) => p.filter((n) => n !== sp.name));
      } else if (pendingCantrips.length < cantripsNeeded) {
        setPendingCantrips((p) => [...p, sp.name]);
      }
    };

    const renderSpellCard = (sp: SpellEntry, isSelected: boolean, isCantrip: boolean, onToggle: () => void) => {
      const schoolColor = SCHOOL_COLORS[sp.school] ?? "#6B7280";
      const isKnown     = knownNames.has(sp.name.toLowerCase()) && !isSelected;
      const isExpanded  = expandedSpell === sp.name;
      const canSelect   = isSelected || (!isCantrip ? pendingSpells.length < spellsNeeded : pendingCantrips.length < cantripsNeeded);

      return (
        <TouchableOpacity
          key={sp.name}
          onPress={onToggle}
          onLongPress={() => setExpandedSpell(isExpanded ? null : sp.name)}
          activeOpacity={0.75}
          disabled={isKnown || (!canSelect && !isSelected)}
          style={[
            styles.spellCard,
            {
              backgroundColor: isSelected ? c.primary + "18" : c.card,
              borderColor: isSelected ? c.primary : c.border,
              opacity: isKnown || (!canSelect && !isSelected) ? 0.4 : 1,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* School color dot */}
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: schoolColor, flexShrink: 0 }} />

            {/* Name + badges */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: isSelected ? c.primary : c.foreground }}>
                  {sp.name}
                </Text>
                {isKnown && (
                  <View style={{ backgroundColor: c.muted, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, color: c.mutedForeground }}>Known</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 1 }}>
                {sp.school}{isCantrip ? "" : ` · Level ${sp.level}`}
              </Text>
              {/* Description — always visible, truncated unless expanded */}
              <Text
                style={{ fontSize: 12, color: c.mutedForeground, marginTop: 3, lineHeight: 16 }}
                numberOfLines={isExpanded ? undefined : 2}
              >
                {sp.desc}
              </Text>
            </View>

            {/* Checkmark when selected */}
            {isSelected && (
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Feather name="check" size={13} color={c.primaryForeground} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <KeyboardAvoidingView style={styles.centerFill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {renderHeader("Learn Spells")}
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {renderLevelBanner()}

          {/* Summary banner */}
          <View style={[styles.noteCard, { backgroundColor: c.card, borderColor: c.border, marginTop: 4 }]}>
            <Feather name="book-open" size={14} color={c.primary} style={{ marginTop: 1 }} />
            <Text style={[styles.noteText, { color: c.mutedForeground }]}>
              {activeSpellChoice?.title ? `${activeSpellChoice.title} — ` : ""}
              {[
                spellsNeeded   > 0 ? `${spellsNeeded} new spell${spellsNeeded > 1 ? "s" : ""} (up to level ${maxLevel})` : "",
                cantripsNeeded > 0 ? `${cantripsNeeded} cantrip${cantripsNeeded > 1 ? "s" : ""}` : "",
              ].filter(Boolean).join(" · ")}
              {" — tap to select, hold any spell to read its full description."}
            </Text>
          </View>
          {classOptions.length > 1 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground, marginTop: 12 }]}>CHOOSE SPELL LIST</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", gap: 6, paddingRight: 6 }}>
                  {classOptions.map((option) => {
                    const selected = cls === option;
                    return (
                      <TouchableOpacity
                        key={`spell-class-${option}`}
                        onPress={() => {
                          setSpellChoiceClass(option);
                          setSpellSearch("");
                          setCantripSearch("");
                          setExpandedSpell(null);
                        }}
                        activeOpacity={0.78}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          borderWidth: 1,
                          backgroundColor: selected ? c.primary + "18" : c.card,
                          borderColor: selected ? c.primary : c.border,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "600", color: selected ? c.primary : c.mutedForeground }}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          )}
          {/* Long-press hint */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 2, marginTop: 4, marginBottom: 2 }}>
            <Feather name="info" size={11} color={c.mutedForeground} />
            <Text style={{ fontSize: 11, color: c.mutedForeground, fontStyle: "italic" }}>
              Hold any spell card to read its full description
            </Text>
          </View>

          {/* ── Leveled spells ─────────────────────────────────────────────────── */}
          {spellsNeeded > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground, marginTop: 12 }]}>
                SPELLS ({pendingSpells.length} / {spellsNeeded} selected · max level {maxLevel})
              </Text>

              {/* Level filter chips */}
              {levelOptions.length > 1 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {levelOptions.map((lv) => (
                    <TouchableOpacity
                      key={lv}
                      onPress={() => { setSpellLevel(lv); setSpellSearch(""); }}
                      style={[
                        styles.spellLevelChip,
                        {
                          backgroundColor: spellLevel === lv ? c.primary : c.card,
                          borderColor:     spellLevel === lv ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text style={[styles.spellLevelChipText, { color: spellLevel === lv ? c.primaryForeground : c.mutedForeground }]}>
                        {SLOT_ORDINAL[lv]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Search box */}
              <View style={[styles.spellInputRow, { marginBottom: 6 }]}>
                <Feather name="search" size={14} color={c.mutedForeground} style={{ position: "absolute", left: 10, zIndex: 1 }} />
                <TextInput
                  value={spellSearch}
                  onChangeText={setSpellSearch}
                  placeholder="Search spells…"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.spellTextInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, paddingLeft: 30, flex: 1 }]}
                />
              </View>

              {/* Spell list from database */}
              {filteredLeveled.length === 0 ? (
                <Text style={[styles.emptyNote, { color: c.mutedForeground }]}>
                  {allLeveledSpells.length === 0
                    ? `No ${cls} spells in the database for this progression filter and levels 1–${maxLevel}. Type a name below and tap + to add manually.`
                    : "No spells match your search."}
                </Text>
              ) : (
                filteredLeveled.map((sp) =>
                  renderSpellCard(sp, selectedNames.has(sp.name), false, () => toggleSpell(sp))
                )
              )}

              {/* Manual add fallback */}
              <View style={[styles.spellInputRow, { marginTop: 6 }]}>
                <TextInput
                  value={spellInput}
                  onChangeText={setSpellInput}
                  placeholder="Or type a spell name manually…"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.spellTextInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (spellInput.trim() && pendingSpells.length < spellsNeeded) {
                      setPendingSpells((p) => [...p, { name: spellInput.trim(), level: spellLevel }]);
                      setSpellInput("");
                    }
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (spellInput.trim() && pendingSpells.length < spellsNeeded) {
                      setPendingSpells((p) => [...p, { name: spellInput.trim(), level: spellLevel }]);
                      setSpellInput("");
                    }
                  }}
                  disabled={!spellInput.trim() || pendingSpells.length >= spellsNeeded}
                  style={[styles.spellAddBtn, { backgroundColor: spellInput.trim() && pendingSpells.length < spellsNeeded ? c.primary : c.muted }]}
                  activeOpacity={0.8}
                >
                  <Feather name="plus" size={18} color={c.primaryForeground} />
                </TouchableOpacity>
              </View>

              {/* Selected spells pills */}
              {pendingSpells.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {pendingSpells.map((s, i) => (
                    <View key={i} style={[styles.spellPill, { backgroundColor: c.primary + "18", borderColor: c.primary }]}>
                      <View style={[styles.spellLevelBadge, { backgroundColor: c.primary + "30" }]}>
                        <Text style={[styles.spellLevelBadgeText, { color: c.primary }]}>Lv {s.level}</Text>
                      </View>
                      <Text style={[styles.spellPillName, { color: c.primary }]}>{s.name}</Text>
                      <TouchableOpacity onPress={() => setPendingSpells((p) => p.filter((_, j) => j !== i))} style={styles.spellPillRemove}>
                        <Feather name="x" size={14} color={c.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* ── Cantrips ─────────────────────────────────────────────────────── */}
          {cantripsNeeded > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground, marginTop: 12 }]}>
                CANTRIPS ({pendingCantrips.length} / {cantripsNeeded} selected)
              </Text>

              {/* Search box */}
              <View style={[styles.spellInputRow, { marginBottom: 6 }]}>
                <Feather name="search" size={14} color={c.mutedForeground} style={{ position: "absolute", left: 10, zIndex: 1 }} />
                <TextInput
                  value={cantripSearch}
                  onChangeText={setCantripSearch}
                  placeholder="Search cantrips…"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.spellTextInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, paddingLeft: 30, flex: 1 }]}
                />
              </View>

              {/* Cantrip list from database */}
              {filteredCantrips.length === 0 ? (
                <Text style={[styles.emptyNote, { color: c.mutedForeground }]}>
                  {allCantripSpells.length === 0
                    ? `No ${cls} cantrips in the database for this progression filter. Type a name below and tap + to add manually.`
                    : "No cantrips match your search."}
                </Text>
              ) : (
                filteredCantrips.map((sp) =>
                  renderSpellCard(sp, selectedCantrips.has(sp.name), true, () => toggleCantrip(sp))
                )
              )}

              {/* Manual add fallback */}
              <View style={[styles.spellInputRow, { marginTop: 6 }]}>
                <TextInput
                  value={cantripInput}
                  onChangeText={setCantripInput}
                  placeholder="Or type a cantrip name manually…"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.spellTextInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (cantripInput.trim() && pendingCantrips.length < cantripsNeeded) {
                      setPendingCantrips((p) => [...p, cantripInput.trim()]);
                      setCantripInput("");
                    }
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (cantripInput.trim() && pendingCantrips.length < cantripsNeeded) {
                      setPendingCantrips((p) => [...p, cantripInput.trim()]);
                      setCantripInput("");
                    }
                  }}
                  disabled={!cantripInput.trim() || pendingCantrips.length >= cantripsNeeded}
                  style={[styles.spellAddBtn, { backgroundColor: cantripInput.trim() && pendingCantrips.length < cantripsNeeded ? "#EC4899" : c.muted }]}
                  activeOpacity={0.8}
                >
                  <Feather name="plus" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Selected cantrip pills */}
              {pendingCantrips.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {pendingCantrips.map((name, i) => (
                    <View key={i} style={[styles.spellPill, { backgroundColor: "#EC489918", borderColor: "#EC4899" }]}>
                      <View style={[styles.spellLevelBadge, { backgroundColor: "#EC489930" }]}>
                        <Text style={[styles.spellLevelBadgeText, { color: "#EC4899" }]}>Cantrip</Text>
                      </View>
                      <Text style={[styles.spellPillName, { color: "#EC4899" }]}>{name}</Text>
                      <TouchableOpacity onPress={() => setPendingCantrips((p) => p.filter((_, j) => j !== i))} style={styles.spellPillRemove}>
                        <Feather name="x" size={14} color="#EC4899" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {!canConfirm && (
            <Text style={[styles.emptyNote, { color: c.mutedForeground, fontSize: 12, marginTop: 8 }]}>
              You can also skip and add spells later from the Spells tab.
            </Text>
          )}

          <TouchableOpacity
            onPress={goFromSpells}
            activeOpacity={0.85}
            style={[styles.primaryBtn, { backgroundColor: c.primary, marginTop: 12 }]}
          >
            <Feather name="check" size={16} color={c.primaryForeground} />
            <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>
              {canConfirm
                ? spellChoiceQueue.length > 1
                  ? "Confirm — Next Spell Choice"
                  : "Confirm — Apply Level Up"
                : `Confirm (${pendingSpells.length + pendingCantrips.length} chosen)`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: Done ──────────────────────────────────────────────────────────────

  function renderDone() {
    const hasPending = pendingLevelUps > 0;
    const appliedLines = buildAppliedChangeLines();
    return (
      <View style={styles.centerFill}>
        {renderHeader("Level Up Complete!")}
        <View style={styles.loadingBody}>
          <View style={[styles.doneCircle, { backgroundColor: "#10B98118", borderColor: "#10B98140" }]}>
            <Feather name="award" size={40} color="#10B981" />
          </View>
          <Text style={[styles.loadingText, { color: c.foreground }]}>
            {character.class} · Level {newLevel}
          </Text>
          <Text style={[styles.loadingSub, { color: c.mutedForeground }]}>
            {chosenSubclass ? `${chosenSubclass} · ` : ""}Your sheet has been updated.
          </Text>
          {appliedLines.length > 0 && (
            <View style={[styles.doneSummaryCard, { backgroundColor: c.card, borderColor: c.border }]}> 
              <Text style={[styles.doneSummaryTitle, { color: c.foreground }]}>Applied changes</Text>
              {appliedLines.map((line, idx) => (
                <Text key={`applied-line-${idx}`} style={[styles.doneSummaryLine, { color: c.mutedForeground }]}>
                  • {line}
                </Text>
              ))}
            </View>
          )}
          {hasPending ? (
            <>
              <Text style={[styles.loadingSub, { color: c.mutedForeground, marginTop: 6 }]}>
                {pendingLevelUps} level{pendingLevelUps > 1 ? "s" : ""} remaining to apply.
              </Text>
              <TouchableOpacity
                onPress={() => { decrementPendingLevelUps(); computeLevelUp(); }}
                style={[styles.primaryBtn, { backgroundColor: c.primary, marginTop: 20, alignSelf: "stretch" }]}
                activeOpacity={0.85}
              >
                <Feather name="chevrons-up" size={16} color={c.primaryForeground} />
                <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>
                  Continue to Level {newLevel + 1}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { queueLevelUps(0); onClose(); }}
                style={[styles.secondaryBtn, { marginTop: 10, alignSelf: "stretch" }]}
                activeOpacity={0.85}
              >
                <Text style={[styles.secondaryBtnText, { color: c.mutedForeground }]}>
                  Skip remaining levels
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={onClose}
              style={[styles.primaryBtn, { backgroundColor: c.primary, marginTop: 20, alignSelf: "stretch" }]}
              activeOpacity={0.85}
            >
              <Feather name="check" size={16} color={c.primaryForeground} />
              <Text style={[styles.primaryBtnText, { color: c.primaryForeground }]}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Route steps ───────────────────────────────────────────────────────────────

  function renderContent() {
    switch (step) {
      case "loading":   return renderLoading();
      case "error":     return renderError();
      case "overview":  return engineResult ? renderEngineOverview() : renderAiOverview();
      case "subclass":  return renderSubclass();
      case "hp":        return renderHp();
      case "asi":       return renderAsi();
      case "spells":    return renderSpells();
      case "rebuild":   return renderRebuild();
      case "done":      return renderDone();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {renderContent()}
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centerFill: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  closeBtn: { padding: 4 },
  loadingBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  loadingText: { fontSize: 17, fontWeight: "600", textAlign: "center", marginTop: 8 },
  loadingSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  body: { padding: 20, gap: 12, paddingBottom: 60 },
  levelBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20,
    padding: 16, borderRadius: 12, borderWidth: 1,
  },
  levelCol: { alignItems: "center", gap: 2 },
  levelLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  levelNum: { fontSize: 32, fontWeight: "800" },
  engineBadge: {
    position: "absolute", right: 12, top: 12,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  engineBadgeText: { fontSize: 10, fontWeight: "600" },
  noteCard: {
    flexDirection: "row", gap: 8, padding: 12,
    borderRadius: 10, borderWidth: 1,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  overviewCard: { flexBasis: "48%", flexGrow: 1, flexShrink: 1, minWidth: 130, borderRadius: 10, borderWidth: 1, padding: 12, gap: 4 },
  overviewCardLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  overviewCardValue: { fontSize: 22, fontWeight: "800" },
  overviewCardNote: { fontSize: 11, lineHeight: 15 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: 4 },
  featureCard: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  featureDot: { width: 7, height: 7, borderRadius: 4 },
  featureName: { fontSize: 14, fontWeight: "700", flex: 1 },
  featureDesc: { fontSize: 13, lineHeight: 19 },
  actionTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  actionTagText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  slotCard: { borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  slotRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 },
  slotLevel: { fontSize: 14, fontWeight: "600" },
  slotGained: { fontSize: 14, fontWeight: "700" },
  emptyNote: { fontSize: 14, textAlign: "center", lineHeight: 20, marginVertical: 8 },
  hpOptions: { flexDirection: "row", gap: 12 },
  hpOption: {
    flex: 1, borderRadius: 12, borderWidth: 2, padding: 14,
    alignItems: "center", gap: 4,
  },
  hpOptionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  hpOptionValue: { fontSize: 32, fontWeight: "800" },
  hpOptionSub: { fontSize: 12, textAlign: "center" },
  rolledLock: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, marginTop: 4,
  },
  rolledLockText: { fontSize: 11, fontWeight: "600" },
  hpSummary: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  hpSummaryText: { fontSize: 14, fontWeight: "600" },
  asiIntro: { fontSize: 14, lineHeight: 20 },
  asiModes: {
    flexDirection: "row", borderRadius: 12, borderWidth: 1, overflow: "hidden",
  },
  asiModeTab: {
    flex: 1, paddingVertical: 10, alignItems: "center",
    borderWidth: 1.5, borderRadius: 0,
  },
  asiModeLabel: { fontSize: 13, fontWeight: "600" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCell: {
    width: "30%", borderRadius: 10, borderWidth: 1.5,
    paddingVertical: 10, alignItems: "center", gap: 2,
  },
  statAbbr: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  statVal: { fontSize: 18, fontWeight: "700" },
  textInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15,
  },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 12,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700" },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 12,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "500" },
  subclassOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderRadius: 10, padding: 14,
  },
  subclassOptionRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  subclassOptionName: { fontSize: 14, fontWeight: "600", flex: 1 },
  supportedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  supportedBadgeText: { fontSize: 10, fontWeight: "600" },
  doneCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, marginBottom: 8,
  },
  doneSummaryCard: { alignSelf: "stretch", borderWidth: 1, borderRadius: 12, padding: 14, gap: 6, marginTop: 6 },
  doneSummaryTitle: { fontSize: 13, fontWeight: "700" },
  doneSummaryLine: { fontSize: 13, lineHeight: 18 },
  spellLevelChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5,
  },
  spellLevelChipText: { fontSize: 12, fontWeight: "600" },
  spellInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  spellTextInput: {
    flex: 1, height: 44, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 14,
  },
  featViewHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 10, marginBottom: 8,
  },
  featViewLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  featViewModes: {
    flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden",
  },
  featViewTab: {
    paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1,
  },
  featViewTabText: { fontSize: 12, fontWeight: "600" },
  featGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  featGridCell: {
    paddingHorizontal: 4, paddingVertical: 4,
  },
  featCard: {
    flex: 1, borderWidth: 1, borderRadius: 10, padding: 8,
  },
  spellAddBtn: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  spellPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 10,
  },
  spellLevelBadge: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  spellLevelBadgeText: { fontSize: 11, fontWeight: "700" },
  spellPillName: { flex: 1, fontSize: 14, fontWeight: "500" },
  spellPillRemove: { padding: 2 },
  spellCard: {
    borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8,
  },
});
