import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import type { MutationBatch, MutationBatchSnapshot, MutationDelta, NpcPerson, PersonAction, Quest, QuestAction, QuickUpdateResult, QuestUpdateResult, QuestType, QuestStatus } from "@/types";
import { Card } from "@/components/ui/Card";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { API_BASE_URL } from "@/utils/apiUrl";
import { useSync } from "@/context/SyncContext";
import { useMutationHistory, buildMutationBatch } from "@/context/MutationHistoryContext";
import { SyncStatusBadge } from "@/components/ui/SyncStatusBadge";
import { AiDmSessionAwarenessPlaceholderStrip } from "@/components/adventure/AiDmSessionAwarenessPlaceholderStrip";
import { useAdventureSessionAwareness } from "@/context/AdventureSessionContext";
import { enqueueAICall } from "@/utils/aiQueue";
import { partitionQuickUpdateInventoryChanges } from "@/utils/quickUpdateInventorySafety";

type InferredDeathConsequence = {
  personId: string | null;
  name: string;
  deceasedNote: string;
};

type InferredWorldConsequences = {
  personDeaths: InferredDeathConsequence[];
  questActions: QuestAction[];
  personActions: PersonAction[];
  killCountDelta: number;
  summaryFragments: string[];
};

const EMPTY_INFERRED_CONSEQUENCES: InferredWorldConsequences = {
  personDeaths: [],
  questActions: [],
  personActions: [],
  killCountDelta: 0,
  summaryFragments: [],
};

const TITLE_PREFIX_RE = /^(captain|lord|lady|sir|dame|elder|sister|brother|master|mistress|general|sergeant|commander)\s+/i;
const DEATH_RE = /\b(kill(?:ed|s|ing)?|slay(?:s|ing|n)?|slew|murder(?:ed|s|ing)?|assassinat(?:e|ed|es|ing)|execut(?:e|ed|es|ing)|dead|died|finish(?:ed)? off)\b/i;
const QUEST_COMPLETE_ON_DEATH_RE = /\b(kill|slay|assassinat|proof of death|death of|must be killed|wants .* dead|bounty|eliminate|ended[\s\S]*permanently)\b/i;
const QUEST_FAIL_ON_DEATH_RE = /\b(alive|meet|negotiat|broker|deal with|talk to|speak to|question|interview|rescue|protect|escort|bring home safely|arrange a meeting)\b/i;

type MentionSuggestion = {
  id: string;
  name: string;
  type: "person" | "location";
};

type MentionContext = {
  start: number;
  end: number;
  query: string;
};

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function personAliases(person: NpcPerson): string[] {
  const full = normalizeMatchText(person.name);
  const withoutTitle = normalizeMatchText(person.name.replace(TITLE_PREFIX_RE, ""));
  const parts = withoutTitle.split(" ").filter((part) => part.length >= 3);
  return [...new Set([full, withoutTitle, ...parts].filter(Boolean))];
}

function personMentionedInInput(person: NpcPerson, normalizedInput: string): boolean {
  const aliases = personAliases(person);
  if (aliases.some((alias) => alias.length > 0 && normalizedInput.includes(alias))) {
    return true;
  }

  const noTitle = normalizeMatchText(person.name.replace(TITLE_PREFIX_RE, ""));
  const tokens = noTitle.split(" ").filter((token) => token.length >= 3);
  if (tokens.length >= 2 && tokens.every((token) => normalizedInput.includes(token))) {
    return true;
  }

  return false;
}

function questMentionsPerson(quest: Quest, person: NpcPerson): boolean {
  const haystack = normalizeMatchText([quest.name, quest.description ?? "", quest.notes ?? ""].join(" "));
  return personAliases(person).some((alias) => alias.length > 0 && haystack.includes(alias));
}

function mergeQuestActions(existing: QuestAction[], incoming: QuestAction[]): QuestAction[] {
  const merged = [...existing];
  for (const action of incoming) {
    const idx = merged.findIndex((candidate) =>
      (action.questId != null && candidate.questId === action.questId) ||
      candidate.name.toLowerCase() === action.name.toLowerCase()
    );
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...action };
    } else {
      merged.push(action);
    }
  }
  return merged;
}

function mergePersonActions(existing: PersonAction[], incoming: PersonAction[]): PersonAction[] {
  const merged = [...existing];
  for (const action of incoming) {
    const idx = merged.findIndex((candidate) =>
      (action.personId != null && candidate.personId === action.personId) ||
      candidate.name.toLowerCase() === action.name.toLowerCase()
    );
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...action };
    } else {
      merged.push(action);
    }
  }
  return merged;
}

function inferDeathConsequences(rawInput: string, people: NpcPerson[], quests: Quest[]): InferredWorldConsequences {
  const normalizedInput = normalizeMatchText(rawInput);
  if (!DEATH_RE.test(normalizedInput)) {
    return EMPTY_INFERRED_CONSEQUENCES;
  }

  const matchedPeople = people.filter((person) => !person.deceased && personMentionedInInput(person, normalizedInput));

  const personDeaths: InferredDeathConsequence[] = [];
  const questActions: QuestAction[] = [];
  const personActions: PersonAction[] = [];
  const summaryFragments: string[] = [];

  if (matchedPeople.length === 0) {
    const unknownMatch = rawInput.match(/\b(?:killed|slew|murdered|assassinated|executed)\s+([A-Za-z][A-Za-z'\-\s]{2,60})/i);
    const rawName = unknownMatch?.[1]?.trim() ?? "";
    const cleanedName = rawName.replace(/\s+(in|at|near|with|for|after|before|during)\b.*$/i, "").trim();
    if (cleanedName.length > 1) {
      const deceasedNote = "Killed by the player.";
      personDeaths.push({ personId: null, name: cleanedName, deceasedNote });
      personActions.push({
        action: "create",
        personId: null,
        name: cleanedName,
        role: "Unknown",
        relationship: "hostile",
        description: null,
        notes: deceasedNote,
      });
      summaryFragments.push(`${cleanedName} marked deceased`);
      return {
        personDeaths,
        questActions,
        personActions,
        killCountDelta: 1,
        summaryFragments,
      };
    }
    return EMPTY_INFERRED_CONSEQUENCES;
  }

  for (const person of matchedPeople) {
    const deceasedNote = "Killed by the player.";
    personDeaths.push({ personId: person.id, name: person.name, deceasedNote });
    personActions.push({
      action: "update",
      personId: person.id,
      name: person.name,
      role: person.role ?? null,
      relationship: person.relationship,
      description: person.description ?? null,
      notes: deceasedNote,
    });
    summaryFragments.push(`${person.name} marked deceased`);

    const relatedActiveQuests = quests.filter((quest) =>
      quest.status === "active" && (person.questTags.includes(quest.id) || questMentionsPerson(quest, person))
    );

    for (const quest of relatedActiveQuests) {
      const questText = [quest.name, quest.description ?? "", quest.notes ?? ""].join(" ").toLowerCase();
      const wantsDeath = QUEST_COMPLETE_ON_DEATH_RE.test(questText);
      const needsAlive = QUEST_FAIL_ON_DEATH_RE.test(questText);
      const status: QuestStatus = wantsDeath ? "completed" : "failed";
      const note = wantsDeath
        ? `Completed because ${person.name} was killed.`
        : needsAlive
          ? `Failed because ${person.name} must be alive for this quest.`
          : `Failed because ${person.name} is deceased.`;

      questActions.push({
        action: "update",
        questId: quest.id,
        name: quest.name,
        type: quest.type,
        status,
        description: quest.description ?? null,
        notes: note,
        locationNames: [],
        personNames: [person.name],
      });
      summaryFragments.push(`${quest.name} ${status}`);
    }
  }

  return {
    personDeaths,
    questActions,
    personActions,
    killCountDelta: personDeaths.length,
    summaryFragments,
  };
}

function augmentQuickUpdateResult(base: QuickUpdateResult, inferred: InferredWorldConsequences): QuickUpdateResult {
  if (
    inferred.personDeaths.length === 0 &&
    inferred.questActions.length === 0 &&
    inferred.personActions.length === 0
  ) {
    return base;
  }

  const questActions = mergeQuestActions(base.questActions ?? [], inferred.questActions);
  const personActions = mergePersonActions(base.personActions ?? [], inferred.personActions);
  const existingSummary = base.summary?.trim() || "Update processed";
  const additions = inferred.summaryFragments.filter((fragment) => !existingSummary.toLowerCase().includes(fragment.toLowerCase()));
  const summary = additions.length > 0 ? `${existingSummary} · ${additions.join(" · ")}` : existingSummary;

  let type = base.type;
  if ((questActions.length > 0 || personActions.length > 0) && type === "unknown") {
    type = "quest";
  } else if ((questActions.length > 0 || personActions.length > 0) && type !== "quest" && type !== "mixed") {
    type = "mixed";
  }

  return {
    ...base,
    summary,
    type,
    questActions,
    personActions,
  };
}

function getMentionContext(text: string, cursor: number): MentionContext | null {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  const head = text.slice(0, safeCursor);
  const boundary = Math.max(head.lastIndexOf(" "), head.lastIndexOf("\n"), head.lastIndexOf("\t"));
  const tokenStart = boundary + 1;
  const token = head.slice(tokenStart);
  if (!token.startsWith("@")) return null;
  const query = token.slice(1);
  if (/\s/.test(query)) return null;
  return { start: tokenStart, end: safeCursor, query };
}

// ── Quest Update Block ────────────────────────────────────────────────────────

const QUEST_TYPE_OPTS: { value: QuestType; label: string; color: string }[] = [
  { value: "main",     label: "Main",     color: "#8B5CF6" },
  { value: "side",     label: "Side",     color: "#3B82F6" },
  { value: "personal", label: "Personal", color: "#14B8A6" },
];

const QUEST_INTENT_OPTS: { value: QuestStatus | "new"; label: string; icon: string; color: string }[] = [
  { value: "new",       label: "New Quest",  icon: "plus-circle",  color: "#10B981" },
  { value: "active",    label: "Update",     icon: "edit-2",       color: "#3B82F6" },
  { value: "completed", label: "Completed",  icon: "check-circle", color: "#6B7280" },
  { value: "failed",    label: "Failed",     icon: "x-circle",     color: "#EF4444" },
];

function QuestUpdateBlock() {
  const c = useColors();
  const { quests, people, locations, realms, applyQuestUpdate } = useCharacter();
  const [expanded, setExpanded] = useState(false);
  const [typeHint, setTypeHint] = useState<QuestType | "">("");
  const [intentHint, setIntentHint] = useState<QuestStatus | "new" | "">("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuestUpdateResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    setApplied(false);
    setError(null);
    try {
      // Build hint prefix for the AI
      const hints: string[] = [];
      if (typeHint) hints.push(`Quest type hint: ${typeHint}`);
      if (intentHint) hints.push(`Intent hint: ${intentHint === "new" ? "create a new quest" : intentHint === "active" ? "update an existing quest" : intentHint === "completed" ? "mark as completed" : "mark as failed"}`);
      const fullText = hints.length > 0 ? `[${hints.join(", ")}] ${text.trim()}` : text.trim();

      const resp = await fetch(`${API_BASE_URL}/api/ai/parse-quest-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullText,
          questContext: quests.map(q => ({ id: q.id, name: q.name, status: q.status, type: q.type })),
          peopleContext: people.map(p => ({ id: p.id, name: p.name, role: p.role })),
          locationContext: locations.map(l => ({ id: l.id, name: l.name })),
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Server error ${resp.status}`);
      }
      setResult(await resp.json() as QuestUpdateResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    applyQuestUpdate(result);
    setApplied(true);
  };

  const handleReset = () => {
    setText("");
    setResult(null);
    setApplied(false);
    setError(null);
    setTypeHint("");
    setIntentHint("");
  };

  const totalActions = result
    ? result.questActions.length + result.personActions.length + result.locationActions.length + (result.realmActions?.length ?? 0)
    : 0;

  return (
    <View style={[qStyles.wrapper, { backgroundColor: c.card, borderColor: c.border }]}>
      {/* Header row */}
      <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.8} style={qStyles.header}>
        <View style={qStyles.headerLeft}>
          <View style={[qStyles.headerIcon, { backgroundColor: "#8B5CF620" }]}>
            <Feather name="flag" size={16} color="#8B5CF6" />
          </View>
          <View>
            <Text style={[qStyles.headerTitle, { color: c.foreground }]}>Quest Log Update</Text>
            <Text style={[qStyles.headerSub, { color: c.mutedForeground }]}>
              Tell the AI about a quest, person, or location
            </Text>
          </View>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />
      </TouchableOpacity>

      {expanded && (
        <View style={qStyles.body}>
          {/* Type hint chips */}
          <Text style={[qStyles.chipLabel, { color: c.mutedForeground }]}>QUEST TYPE (optional)</Text>
          <View style={qStyles.chipRow}>
            {QUEST_TYPE_OPTS.map(opt => {
              const sel = typeHint === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setTypeHint(sel ? "" : opt.value)}
                  activeOpacity={0.8}
                  style={[qStyles.chip, { borderColor: sel ? opt.color : c.border, backgroundColor: sel ? opt.color + "25" : c.secondary }]}
                >
                  <Text style={[qStyles.chipText, { color: sel ? opt.color : c.mutedForeground }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Intent chips */}
          <Text style={[qStyles.chipLabel, { color: c.mutedForeground }]}>INTENT (optional)</Text>
          <View style={qStyles.chipRow}>
            {QUEST_INTENT_OPTS.map(opt => {
              const sel = intentHint === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setIntentHint(sel ? "" : opt.value)}
                  activeOpacity={0.8}
                  style={[qStyles.chip, { borderColor: sel ? opt.color : c.border, backgroundColor: sel ? opt.color + "25" : c.secondary }]}
                >
                  <Feather name={opt.icon as any} size={12} color={sel ? opt.color : c.mutedForeground} />
                  <Text style={[qStyles.chipText, { color: sel ? opt.color : c.mutedForeground }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Text input */}
          <TextInput
            value={text}
            onChangeText={t => { setText(t); setResult(null); setApplied(false); setError(null); }}
            placeholder="e.g. I have a new quest to collect 100 gp from Greg in Honordale"
            placeholderTextColor={c.mutedForeground}
            multiline
            numberOfLines={3}
            style={[qStyles.input, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border }]}
          />

          {/* Parse button */}
          <TouchableOpacity
            onPress={handleParse}
            disabled={!text.trim() || loading}
            activeOpacity={0.8}
            style={[qStyles.parseBtn, { backgroundColor: text.trim() ? "#8B5CF6" : c.secondary, opacity: loading ? 0.7 : 1 }]}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <><Feather name="cpu" size={15} color={text.trim() ? "#fff" : c.mutedForeground} />
                  <Text style={[qStyles.parseBtnText, { color: text.trim() ? "#fff" : c.mutedForeground }]}>Parse with AI</Text></>
            }
          </TouchableOpacity>

          {/* Error */}
          {error && (
            <View style={[qStyles.errorBox, { backgroundColor: "#EF444420", borderColor: "#EF444460" }]}>
              <Feather name="alert-circle" size={14} color="#EF4444" />
              <Text style={[qStyles.errorText, { color: "#EF4444" }]}>{error}</Text>
            </View>
          )}

          {/* Result preview */}
          {result && totalActions > 0 && (
            <View style={[qStyles.previewBox, { backgroundColor: c.secondary, borderColor: c.border }]}>
              <Text style={[qStyles.previewSummary, { color: c.foreground }]}>{result.summary}</Text>

              {result.questActions.map((qa, i) => {
                const typeConf = QUEST_TYPE_OPTS.find(t => t.value === qa.type);
                return (
                  <View key={i} style={qStyles.actionRow}>
                    <Feather name="flag" size={13} color="#8B5CF6" />
                    <View style={{ flex: 1 }}>
                      <Text style={[qStyles.actionTitle, { color: c.foreground }]}>
                        {qa.action === "create" ? "New quest: " : "Update quest: "}
                        <Text style={{ color: "#8B5CF6" }}>{qa.name}</Text>
                      </Text>
                      <Text style={[qStyles.actionMeta, { color: c.mutedForeground }]}>
                        {typeConf?.label ?? qa.type} · {qa.status}
                        {qa.description ? ` · ${qa.description}` : ""}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {result.personActions.map((pa, i) => (
                <View key={i} style={qStyles.actionRow}>
                  <Feather name="user" size={13} color="#3B82F6" />
                  <View style={{ flex: 1 }}>
                    <Text style={[qStyles.actionTitle, { color: c.foreground }]}>
                      {pa.action === "create" ? "New person: " : "Update person: "}
                      <Text style={{ color: "#3B82F6" }}>{pa.name}</Text>
                    </Text>
                    {pa.role && (
                      <Text style={[qStyles.actionMeta, { color: c.mutedForeground }]}>{pa.role}</Text>
                    )}
                  </View>
                </View>
              ))}

              {result.locationActions.map((la, i) => (
                <View key={i} style={qStyles.actionRow}>
                  <Feather name="map-pin" size={13} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={[qStyles.actionTitle, { color: c.foreground }]}>
                      {la.action === "create" ? "New location: " : "Update location: "}
                      <Text style={{ color: "#F59E0B" }}>{la.name}</Text>
                    </Text>
                    {la.description && (
                      <Text style={[qStyles.actionMeta, { color: c.mutedForeground }]}>{la.description}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {result && totalActions === 0 && !applied && (
            <View style={[qStyles.errorBox, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B60" }]}>
              <Feather name="info" size={14} color="#F59E0B" />
              <Text style={[qStyles.errorText, { color: "#F59E0B" }]}>No quest changes detected. Try rephrasing.</Text>
            </View>
          )}

          {/* Apply / Applied */}
          {result && totalActions > 0 && !applied && (
            <TouchableOpacity onPress={handleApply} activeOpacity={0.8} style={[qStyles.applyBtn, { backgroundColor: "#8B5CF6" }]}>
              <Feather name="check" size={15} color="#fff" />
              <Text style={qStyles.applyBtnText}>Apply to Journal ({totalActions} change{totalActions !== 1 ? "s" : ""})</Text>
            </TouchableOpacity>
          )}

          {applied && (
            <View style={[qStyles.appliedRow, { backgroundColor: "#10B98120", borderColor: "#10B98150" }]}>
              <Feather name="check-circle" size={15} color="#10B981" />
              <Text style={[qStyles.appliedText, { color: "#10B981" }]}>
                Journal updated! {result?.questActions.length ? `${result.questActions.length} quest${result.questActions.length !== 1 ? "s" : ""}` : ""}
                {result?.personActions.length ? `, ${result.personActions.length} person${result.personActions.length !== 1 ? "s" : ""}` : ""}
                {result?.locationActions.length ? `, ${result.locationActions.length} location${result.locationActions.length !== 1 ? "s" : ""}` : ""} added/updated.
              </Text>
              <TouchableOpacity onPress={handleReset} activeOpacity={0.7} style={{ marginLeft: "auto" }}>
                <Text style={[qStyles.resetText, { color: "#10B981" }]}>New</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const qStyles = StyleSheet.create({
  wrapper: { borderWidth: 1, borderRadius: 12, overflow: "hidden", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 14, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  chipLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: -4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 72, textAlignVertical: "top", lineHeight: 20 },
  parseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, padding: 13, borderRadius: 10 },
  parseBtnText: { fontSize: 14, fontWeight: "700" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  errorText: { fontSize: 13, flex: 1, lineHeight: 18 },
  previewBox: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  previewSummary: { fontSize: 14, fontWeight: "600", lineHeight: 20, marginBottom: 2 },
  actionRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  actionTitle: { fontSize: 13, fontWeight: "600" },
  actionMeta: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  applyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 13, borderRadius: 10 },
  applyBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  appliedRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  appliedText: { fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 18 },
  resetText: { fontSize: 13, fontWeight: "700" },
});

const EXAMPLES = [
  "Lyra got hit by a fireball for 23 points of damage",
  "bought 2 healing potions and spent 50 gp",
  "quarterstaff attack rolled 14",
  "used 1 Focus",
  "found 10 gold and got a quest to speak to Goldie in the city of Everhaven",
  "completed the quest to rescue the blacksmith, got 200 gp reward",
  "met a merchant named Torvan in Millhaven who wants us to find his stolen wagon",
  "took 8 damage",
  "healed 12 hp",
  "took a short rest",
];

export default function QuickUpdateScreen() {
  const { awarenessPlaceholder, clearActiveSession } = useAdventureSessionAwareness();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const {
    character, resources, quests, people, locations, realms,
    updateHp, updateCurrency, applyResourceChanges, applyProposedItems, applyConditionChanges, applyQuestUpdate, updatePerson, addPerson, incrementKillCount,
  } = useCharacter();
  const { isOnline } = useSync();
  const { appendBatch } = useMutationHistory();

  const [input, setInput] = useState("");
  const [inputSelection, setInputSelection] = useState({ start: 0, end: 0 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickUpdateResult | null>(null);
  const [inferredConsequences, setInferredConsequences] = useState<InferredWorldConsequences>(EMPTY_INFERRED_CONSEQUENCES);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-delta approval state: map of deltaId → approved
  const [deltaApproved, setDeltaApproved] = useState<Record<string, boolean>>({});
  // Per-delta edit state: map of deltaId → edited "after" string
  const [deltaEdits, setDeltaEdits] = useState<Record<string, string>>({});
  // Which delta is being inline-edited
  const [editingDeltaId, setEditingDeltaId] = useState<string | null>(null);

  // Undo toast
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const undoToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Offline manual fallback state
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualHpDelta, setManualHpDelta] = useState("");
  const [manualGpDelta, setManualGpDelta] = useState("");
  const [manualResourceName, setManualResourceName] = useState("");
  const [manualResourceDelta, setManualResourceDelta] = useState("");
  const [manualConditionName, setManualConditionName] = useState("");
  const [manualConditionAction, setManualConditionAction] = useState<"add" | "remove">("add");

  // Build preview deltas from result whenever result changes
  const previewDeltas: MutationDelta[] = useMemo(() => {
    if (!result) return [];
    const deltas: MutationDelta[] = [];

    if (result.proposedHpChange) {
      const id = `hp_${result.proposedHpChange.delta}`;
      const sign = result.proposedHpChange.delta >= 0 ? "+" : "";
      deltas.push({
        id,
        label: result.proposedHpChange.type === "damage" ? "Damage" : "Heal",
        before: String(character.currentHp),
        after: String(Math.max(0, Math.min(character.maxHp, character.currentHp + result.proposedHpChange.delta))),
        approved: true,
      });
    }

    if (result.proposedCurrencyChange) {
      Object.entries(result.proposedCurrencyChange).forEach(([coin, amt]) => {
        if (amt == null || amt === 0) return;
        const priorVal = character.currency[coin as keyof typeof character.currency] ?? 0;
        deltas.push({
          id: `currency_${coin}`,
          label: coin.toUpperCase(),
          before: String(priorVal),
          after: String(priorVal + (amt as number)),
          approved: true,
        });
      });
    }

    result.proposedResourceChanges.forEach((rc, i) => {
      const res = resources.find((r) => r.id === rc.resourceId || r.name.toLowerCase() === rc.resourceName.toLowerCase());
      const prior = res?.current ?? 0;
      deltas.push({
        id: `resource_${rc.resourceId || i}`,
        label: rc.resourceName,
        before: String(prior),
        after: String(Math.max(0, prior + rc.delta)),
        approved: true,
      });
    });

    result.proposedConditionChanges.forEach((cc, i) => {
      deltas.push({
        id: `condition_${i}_${cc.name}`,
        label: `Condition`,
        before: cc.action === "add" ? "—" : cc.name,
        after: cc.action === "add" ? cc.name : "—",
        approved: true,
      });
    });

    return deltas;
  }, [result, character, resources]);

  // Sync approval state when parsed deltas change.
  // Using ids+after avoids stale unchecked state when a new parse has same count.
  const previewDeltaSignature = useMemo(
    () => previewDeltas.map((d) => `${d.id}:${d.after}`).join("|"),
    [previewDeltas]
  );

  useEffect(() => {
    if (previewDeltas.length === 0) return;
    const initApproved: Record<string, boolean> = {};
    const initEdits: Record<string, string> = {};
    for (const d of previewDeltas) {
      initApproved[d.id] = true;
      initEdits[d.id] = d.after;
    }
    setDeltaApproved(initApproved);
    setDeltaEdits(initEdits);
    setEditingDeltaId(null);
  }, [previewDeltaSignature]);

  const approvedCount = previewDeltas.filter((d) => deltaApproved[d.id] !== false).length;

  const mentionCursor = useMemo(() => {
    // RN web can intermittently skip selection updates for multiline inputs.
    // Fallback to end-of-input so @mentions still work while typing.
    if (inputSelection.start === 0 && inputSelection.end === 0 && input.length > 0) {
      return input.length;
    }
    return inputSelection.start;
  }, [input.length, inputSelection.end, inputSelection.start]);

  const mentionContext = useMemo(() => getMentionContext(input, mentionCursor), [input, mentionCursor]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionContext) return [] as MentionSuggestion[];
    const query = mentionContext.query.trim().toLowerCase();
    const all: MentionSuggestion[] = [
      ...people.map((p) => ({ id: `person:${p.id}`, name: p.name, type: "person" as const })),
      ...locations.map((l) => ({ id: `location:${l.id}`, name: l.name, type: "location" as const })),
    ];

    const filtered = query.length === 0
      ? all
      : all.filter((entry) => entry.name.toLowerCase().includes(query));

    const deduped = filtered.filter((entry, index, arr) =>
      arr.findIndex((candidate) => candidate.name.toLowerCase() === entry.name.toLowerCase() && candidate.type === entry.type) === index
    );

    deduped.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aStarts = query.length > 0 && aName.startsWith(query);
      const bStarts = query.length > 0 && bName.startsWith(query);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return deduped.slice(0, 8);
  }, [locations, mentionContext, people]);

  const insertMention = (suggestion: MentionSuggestion) => {
    if (!mentionContext) return;
    const before = input.slice(0, mentionContext.start);
    const after = input.slice(mentionContext.end);
    const inserted = `@${suggestion.name} `;
    const next = `${before}${inserted}${after}`;
    const cursor = before.length + inserted.length;
    setInput(next);
    setInputSelection({ start: cursor, end: cursor });
    setResult(null);
    setInferredConsequences(EMPTY_INFERRED_CONSEQUENCES);
    setApplied(false);
    setError(null);
  };

  const handleParse = async () => {
    if (!input.trim()) return;

    // If offline, show manual entry fallback immediately
    if (!isOnline) {
      setShowManualFallback(true);
      return;
    }

    setLoading(true);
    setResult(null);
    setInferredConsequences(EMPTY_INFERRED_CONSEQUENCES);
    setApplied(false);
    setError(null);

    try {
      const characterContext = {
        name: character.name,
        class: character.class,
        level: character.level,
        currentHp: character.currentHp,
        maxHp: character.maxHp,
        proficiencyBonus: character.proficiencyBonus,
        resources: resources.map((r) => ({
          id: r.id,
          name: r.name,
          current: r.current,
          max: r.max,
        })),
      };

      const payload = JSON.stringify({
        text: input.trim(),
        characterContext,
        questContext: quests.map(q => ({ id: q.id, name: q.name, status: q.status, type: q.type })),
        peopleContext: people.map(p => ({ id: p.id, name: p.name, role: p.role })),
        locationContext: locations.map(l => ({ id: l.id, name: l.name })),
        realmContext: realms.map(r => ({ id: r.id, name: r.name })),
      });

      const resp = await fetch(`${API_BASE_URL}/api/ai/parse-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? `Server error: ${resp.status}`);
      }

      const parsed = (await resp.json()) as QuickUpdateResult;
      const inferred = inferDeathConsequences(input.trim(), people, quests);
      setInferredConsequences(inferred);
      setResult(augmentQuickUpdateResult(parsed, inferred));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Network failure → queue for retry and offer manual fallback
      await enqueueAICall({
        type: "parse-update",
        payload: JSON.stringify({ text: input.trim() }),
        characterId: character.id,
        label: `"${input.trim().slice(0, 60)}"`,
      });
      setError(`AI unavailable (${msg}). Enter changes manually below or wait for connection.`);
      setShowManualFallback(true);
    } finally {
      setLoading(false);
    }
  };

  /** Build a QuickUpdateResult from the manual offline form fields */
  const handleManualApply = () => {
    const hpVal = parseInt(manualHpDelta);
    const gpVal = parseInt(manualGpDelta);
    const resVal = parseInt(manualResourceDelta);
    const hasHp = !isNaN(hpVal) && hpVal !== 0;
    const hasGp = !isNaN(gpVal) && gpVal !== 0;
    const hasRes = manualResourceName.trim() && !isNaN(resVal) && resVal !== 0;
    const hasCond = manualConditionName.trim().length > 0;

    if (!hasHp && !hasGp && !hasRes && !hasCond) return;

    const manualResult: QuickUpdateResult = {
      rawInput: `[Manual] ${input.trim() || "offline entry"}`,
      summary: "Manual entry",
      type: "mixed",
      proposedInventoryChanges: [],
      proposedResourceChanges: hasRes
        ? [{
            resourceId: resources.find((r) => r.name.toLowerCase() === manualResourceName.toLowerCase())?.id ?? manualResourceName,
            resourceName: manualResourceName.trim(),
            delta: resVal,
          }]
        : [],
      proposedConditionChanges: hasCond
        ? [{
            name: manualConditionName.trim(),
            action: manualConditionAction,
            removeOn: ["manual"],
          }]
        : [],
      proposedHpChange: hasHp ? { delta: hpVal, type: hpVal < 0 ? "damage" : "heal" } : undefined,
      proposedCurrencyChange: hasGp ? { gp: gpVal } : undefined,
    };

    setResult(manualResult);
    setShowManualFallback(false);
    setApplied(false);
  };

  const handleApply = () => {
    if (!result) return;

    // Capture before-state snapshot for undo
    const beforeSnapshot: MutationBatchSnapshot = {
      currentHp: character.currentHp,
      tempHp: character.tempHp,
      currency: { ...character.currency },
      resourceStates: resources.map((r) => ({ id: r.id, name: r.name, priorCurrent: r.current })),
      conditionsBefore: [],
    };

    const applyInput = result.rawInput?.trim() || input.trim();
    const recalculatedConsequences = inferDeathConsequences(applyInput, people, quests);
    const effectiveConsequences = recalculatedConsequences.personDeaths.length > 0
      ? recalculatedConsequences
      : inferredConsequences;

    const { autoApplicable: autoApplicableInventoryChanges, requiresReview: requiresReviewInventoryChanges } =
      partitionQuickUpdateInventoryChanges(result.proposedInventoryChanges);
    const hasNewItems = result.proposedInventoryChanges.some((i) => i.quantity > 0);

    // Apply only approved deltas
    const isDeltaApproved = (id: string) => deltaApproved[id] !== false;

    const hpDeltaId = previewDeltas.find((d) => d.label === "Damage" || d.label === "Heal")?.id;
    if (result.proposedHpChange && hpDeltaId && isDeltaApproved(hpDeltaId)) {
      updateHp(result.proposedHpChange.delta, "ai");
    }

    const approvedCurrencyCoins = new Set(
      previewDeltas.filter((d) => isDeltaApproved(d.id) && /^[A-Z]{2}$/.test(d.label)).map((d) => d.label.toLowerCase())
    );
    if (result.proposedCurrencyChange) {
      const filteredCurrency = Object.fromEntries(
        Object.entries(result.proposedCurrencyChange).filter(([k]) => approvedCurrencyCoins.has(k))
      );
      if (Object.keys(filteredCurrency).length > 0) {
        updateCurrency(filteredCurrency);
      }
    }

    const approvedResourceChanges = result.proposedResourceChanges.filter((rc, i) => {
      const id = `resource_${rc.resourceId || i}`;
      return isDeltaApproved(id);
    });
    if (approvedResourceChanges.length > 0) {
      applyResourceChanges(approvedResourceChanges, "ai");
    }

    const approvedConditionChanges = result.proposedConditionChanges.filter((_, i) => {
      const cc = result.proposedConditionChanges[i];
      const id = `condition_${i}_${cc.name}`;
      return isDeltaApproved(id);
    });
    if (approvedConditionChanges.length > 0) {
      applyConditionChanges(approvedConditionChanges, "ai");
    }
    const hasQuestChanges =
      (result.questActions?.length ?? 0) > 0 ||
      (result.personActions?.length ?? 0) > 0 ||
      (result.locationActions?.length ?? 0) > 0 ||
      (result.realmActions?.length ?? 0) > 0 ||
      result.questGraphResult != null;

    // Phase 2.5 ordering safety: when items are being directly applied in this
    // request (not routed to loot-review), apply baseline inventory first so
    // graph inventory-link resolution can deterministically resolve same-request items.
    if (!hasNewItems && autoApplicableInventoryChanges.length > 0) {
      applyProposedItems(autoApplicableInventoryChanges);
    }

    if (!hasNewItems && requiresReviewInventoryChanges.length > 0) {
      setError(
        `${requiresReviewInventoryChanges.length} inventory change${requiresReviewInventoryChanges.length === 1 ? "" : "s"} require review and were not auto-applied. Use Loot Review for manual confirmation.`,
      );
    }

    const plannedPersonNames = new Set(
      (result.personActions ?? [])
        .map((action) => normalizeMatchText(action.name ?? ""))
        .filter(Boolean)
    );

    const findExistingPersonByName = (name: string) => {
      const normalizedName = normalizeMatchText(name);
      return people.find((person) => normalizeMatchText(person.name) === normalizedName);
    };

    const questApplyReport = hasQuestChanges
      ? applyQuestUpdate({
        summary: result.summary,
        questActions: result.questActions ?? [],
        personActions: result.personActions ?? [],
        locationActions: result.locationActions ?? [],
        realmActions: result.realmActions ?? [],
        questGraphResult: result.questGraphResult ?? null,
      }, { enableInventoryLinking: !hasNewItems, sourceType: "quick_update" })
      : null;

    if (effectiveConsequences.personDeaths.length > 0) {
      for (const death of effectiveConsequences.personDeaths) {
        if (death.personId) {
          const existing = people.find((person) => person.id === death.personId);
          const mergedNotes = existing?.notes?.includes(death.deceasedNote)
            ? existing.notes
            : existing?.notes
              ? `${existing.notes}\n${death.deceasedNote}`
              : death.deceasedNote;
          updatePerson(death.personId, {
            deceased: true,
            deceasedNote: death.deceasedNote,
            notes: mergedNotes,
          });
        } else {
          const existingByName = findExistingPersonByName(death.name);
          if (existingByName) {
            const mergedNotes = existingByName.notes?.includes(death.deceasedNote)
              ? existingByName.notes
              : existingByName.notes
                ? `${existingByName.notes}\n${death.deceasedNote}`
                : death.deceasedNote;
            updatePerson(existingByName.id, {
              deceased: true,
              deceasedNote: death.deceasedNote,
              notes: mergedNotes,
            });
          } else if (!plannedPersonNames.has(normalizeMatchText(death.name))) {
            addPerson({
              name: death.name,
              role: "Unknown",
              relationship: "hostile",
              description: undefined,
              notes: death.deceasedNote,
              questTags: [],
              deceased: true,
              deceasedNote: death.deceasedNote,
              pinned: false,
            });
          }
        }
      }
    }

    for (let index = 0; index < effectiveConsequences.killCountDelta; index += 1) {
      incrementKillCount();
    }

    // Keep diagnostic history even when item review continues in another screen.
    const appliedDeltas = previewDeltas.filter((d) => isDeltaApproved(d.id));
    if (appliedDeltas.length > 0 || hasQuestChanges || effectiveConsequences.personDeaths.length > 0 || effectiveConsequences.killCountDelta > 0 || (!hasNewItems && autoApplicableInventoryChanges.length > 0)) {
      const batch = buildMutationBatch({
        source: "ai",
        description: applyInput.slice(0, 80) || "AI update",
        deltas: appliedDeltas,
        snapshot: beforeSnapshot,
      });
      batch.recordingStage = hasNewItems ? "awaiting_item_review" : "applied";
      void appendBatch(batch);

      // Explain the current undo limitation without promising a partial reversal.
      setUndoToastVisible(true);
      if (undoToastTimer.current) clearTimeout(undoToastTimer.current);
      undoToastTimer.current = setTimeout(() => setUndoToastVisible(false), 4000);
    }

    if (hasNewItems) {
      // Route to loot-review for item confirmation only.
      // Strip already-applied fields so loot-review doesn't re-apply them.
      const itemsOnlyData = {
        ...result,
        proposedHpChange: null,
        proposedCurrencyChange: null,
        proposedResourceChanges: [],
      };
      setApplied(true);
      router.push({
        pathname: "/loot-review",
        params: {
          source: "text",
          data: JSON.stringify(itemsOnlyData),
          questBatchId: questApplyReport?.batchId,
        },
      });
      return;
    }

    setApplied(true);
  };

  const handleLootPhoto = () => {
    router.push({
      pathname: "/loot-generator",
      params: { tab: "photo_text" },
    });
  };

  const handleEndAdventureSession = () => {
    Alert.alert("End Adventure Session", "Clear active adventure session awareness on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Session",
        style: "destructive",
        onPress: () => {
          void clearActiveSession();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollHintScrollView
        style={[styles.container, { backgroundColor: c.background }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + 72,
            paddingTop: c.densitySpace(12),
            paddingHorizontal: c.densitySpace(16),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
      {/* Sync status (offline/pending indicator) */}
      <SyncStatusBadge />
      <AiDmSessionAwarenessPlaceholderStrip
        placeholder={awarenessPlaceholder}
        onEndSession={handleEndAdventureSession}
      />

      {/* Input area */}
      <Card>
        <Text style={[styles.label, { color: c.foreground, fontSize: c.scaleFont(15) }]}>What happened?</Text>
        <TextInput
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setResult(null);
            setInferredConsequences(EMPTY_INFERRED_CONSEQUENCES);
            setApplied(false);
            setError(null);
          }}
          selection={inputSelection}
          onSelectionChange={(e) => setInputSelection(e.nativeEvent.selection)}
          placeholder="Type a quick update..."
          placeholderTextColor={c.mutedForeground}
          multiline
          numberOfLines={3}
          style={[
            styles.textInput,
            {
              backgroundColor: c.secondary,
              color: c.foreground,
              borderRadius: c.radius,
              fontSize: c.scaleFont(15),
              lineHeight: c.scaleLineHeight(22),
              padding: c.densitySpace(12),
              minHeight: c.densitySpace(80),
            },
          ]}
        />

        {mentionContext && (
          <View style={[styles.mentionBox, { backgroundColor: c.secondary, borderColor: c.border, borderRadius: c.radius }]}> 
            <Text style={[styles.mentionTitle, { color: c.mutedForeground, fontSize: c.scaleFont(10) }]}>Insert Mention</Text>
            {mentionSuggestions.length > 0 ? (
              mentionSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.id}
                  onPress={() => insertMention(suggestion)}
                  activeOpacity={0.75}
                  style={[styles.mentionRow, { borderBottomColor: c.border }]}
                >
                  <Feather name={suggestion.type === "person" ? "user" : "map-pin"} size={13} color={c.primary} />
                  <Text style={[styles.mentionName, { color: c.foreground, fontSize: c.scaleFont(13) }]}>{suggestion.name}</Text>
                  <Text style={[styles.mentionType, { color: c.mutedForeground, fontSize: c.scaleFont(11) }]}>{suggestion.type}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={[styles.mentionEmpty, { color: c.mutedForeground, fontSize: c.scaleFont(12), lineHeight: c.scaleLineHeight(18) }]}>No people or locations available yet. Add them in Notes first.</Text>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={handleParse}
          disabled={!input.trim() || loading}
          activeOpacity={0.8}
          style={[
            styles.parseBtn,
            {
              backgroundColor: input.trim() ? c.primary : c.secondary,
              borderRadius: c.radius,
              opacity: loading ? 0.7 : 1,
              padding: c.densitySpace(14),
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={c.primaryForeground} />
          ) : (
            <Text style={[styles.parseBtnText, { color: input.trim() ? c.primaryForeground : c.mutedForeground, fontSize: c.scaleFont(15) }]}>
              Parse with AI
            </Text>
          )}
        </TouchableOpacity>
      </Card>

      {/* Error card */}
      {error && (
        <View style={[styles.errorCard, { backgroundColor: "#EF444420", borderColor: "#EF4444", borderRadius: c.radius }]}>
          <Feather name="alert-circle" size={16} color="#EF4444" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.errorTitle, { color: "#EF4444", fontSize: c.scaleFont(13) }]}>AI parsing failed</Text>
            <Text style={[styles.errorMsg, { color: "#EF4444", fontSize: c.scaleFont(12), lineHeight: c.scaleLineHeight(18) }]}>{error}</Text>
          </View>
          <TouchableOpacity onPress={handleParse} activeOpacity={0.7}>
            <Feather name="refresh-cw" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* Quest Log Update block */}
      <QuestUpdateBlock />

      {/* Loot photo button */}
      <TouchableOpacity
        onPress={handleLootPhoto}
        activeOpacity={0.8}
        style={[
          styles.photoBtn,
          { backgroundColor: "#8B5CF620", borderColor: "#8B5CF6", borderRadius: c.radius },
        ]}
      >
        <Feather name="camera" size={18} color="#8B5CF6" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.photoBtnTitle, { color: "#8B5CF6", fontSize: c.scaleFont(14) }]}>Analyze Loot Photo</Text>
          <Text style={[styles.photoBtnSub, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}> 
            Take or pick a photo to identify items
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color="#8B5CF6" />
      </TouchableOpacity>


      {/* Result */}
      {result && !applied && (
        <Card style={{ marginTop: 4 }}>
          <View style={styles.resultHeader}>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: getTypeColor(result.type) + "20" },
              ]}
            >
              <Text style={[styles.typeBadgeText, { color: getTypeColor(result.type) }]}>
                {result.type.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.summary, { color: c.foreground, fontSize: c.scaleFont(16), lineHeight: c.scaleLineHeight(22) }]}>{result.summary}</Text>
          </View>

          {/* Per-delta review — approve / edit each change before applying */}
          {previewDeltas.length > 0 && (
            <View style={{ marginTop: 8, gap: 4 }}>
              {previewDeltas.map((delta) => {
                const approved = deltaApproved[delta.id] !== false;
                const isEditing = editingDeltaId === delta.id;
                return (
                  <View key={delta.id} style={[styles.deltaRow, { opacity: approved ? 1 : 0.45 }]}>
                    <TouchableOpacity
                      onPress={() => setDeltaApproved((prev) => ({ ...prev, [delta.id]: !approved }))}
                      style={[
                        styles.deltaCheckbox,
                        {
                          borderColor: approved ? c.primary : c.mutedForeground,
                          backgroundColor: approved ? c.primary + "20" : "transparent",
                        },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {approved && <Feather name="check" size={11} color={c.primary} />}
                    </TouchableOpacity>
                    <Text style={[styles.deltaLabel, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}>{delta.label}</Text>
                    <Text style={[styles.deltaArrow, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}>
                      {delta.before} {"\u2192"}
                    </Text>
                    {isEditing ? (
                      <TextInput
                        style={[styles.deltaEditInput, { color: c.foreground, borderColor: c.primary, fontSize: c.scaleFont(13) }]}
                        value={deltaEdits[delta.id] ?? delta.after}
                        onChangeText={(t) => setDeltaEdits((prev) => ({ ...prev, [delta.id]: t }))}
                        onBlur={() => setEditingDeltaId(null)}
                        autoFocus
                        keyboardType="numeric"
                      />
                    ) : (
                      <Text style={[styles.deltaAfter, { color: c.foreground, fontSize: c.scaleFont(13) }]}>
                        {deltaEdits[delta.id] ?? delta.after}
                      </Text>
                    )}
                    <TouchableOpacity
                      onPress={() => setEditingDeltaId(isEditing ? null : delta.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name={isEditing ? "check" : "edit-2"} size={13} color={c.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* Attack calc — read-only info */}
          {result.proposedAttackCalc && (
            <View style={[styles.attackCalcBox, { backgroundColor: c.secondary, borderRadius: c.radius }]}>
              <Text style={[styles.attackCalcTitle, { color: c.foreground, fontSize: c.scaleFont(14) }]}>
                {result.proposedAttackCalc.attackName}
              </Text>
              <Text style={[styles.attackCalcDetail, { color: c.mutedForeground, fontSize: c.scaleFont(13), lineHeight: c.scaleLineHeight(18) }]}> 
                Roll {result.proposedAttackCalc.rawRoll} + {result.proposedAttackCalc.attackBonus} ={" "}
                <Text style={[styles.attackTotal, { color: c.primary }]}>
                  {result.proposedAttackCalc.totalToHit} to hit
                </Text>
              </Text>
            </View>
          )}

          {/* Quest / people / location changes */}
          {((result.questActions?.length ?? 0) > 0 || (result.personActions?.length ?? 0) > 0 || (result.locationActions?.length ?? 0) > 0) && (
            <View style={[styles.questPreview, { backgroundColor: "#8B5CF620", borderRadius: c.radius }]}>
              <Text style={[styles.previewLabel, { color: "#8B5CF6", fontSize: c.scaleFont(11) }]}>Journal changes:</Text>
              {result.questActions?.map((qa, i) => (
                <View key={i} style={styles.changeRow}>
                  <Feather name="flag" size={13} color="#8B5CF6" />
                  <Text style={[styles.changeText, { color: "#8B5CF6", fontSize: c.scaleFont(13) }]}> 
                    {qa.action === "create" ? "New quest" : "Updated quest"}: {qa.name}
                    {qa.type !== "side" ? ` (${qa.type})` : ""}
                  </Text>
                </View>
              ))}
              {result.personActions?.map((pa, i) => (
                <View key={i} style={styles.changeRow}>
                  <Feather name="user" size={13} color="#8B5CF6" />
                  <Text style={[styles.changeText, { color: "#8B5CF6", fontSize: c.scaleFont(13) }]}> 
                    {pa.action === "create" ? "New person" : "Updated"}: {pa.name}
                    {pa.role ? ` · ${pa.role}` : ""}
                  </Text>
                </View>
              ))}
              {result.locationActions?.map((la, i) => (
                <View key={i} style={styles.changeRow}>
                  <Feather name="map-pin" size={13} color="#8B5CF6" />
                  <Text style={[styles.changeText, { color: "#8B5CF6", fontSize: c.scaleFont(13) }]}> 
                    {la.action === "create" ? "New location" : "Updated"}: {la.name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Inventory changes */}
          {result.proposedInventoryChanges.length > 0 && (
            <View style={[styles.inventoryPreview, { backgroundColor: c.secondary, borderRadius: c.radius }]}>
              <Text style={[styles.previewLabel, { color: c.mutedForeground, fontSize: c.scaleFont(11) }]}> 
                Inventory changes:
              </Text>
              {result.proposedInventoryChanges.map((item) => (
                <Text key={item.id} style={[styles.previewItem, { color: c.foreground, fontSize: c.scaleFont(13) }]}> 
                  {item.quantity > 0 ? "+" : ""}{item.quantity}{"\u00D7"} {item.name}
                </Text>
              ))}
            </View>
          )}

          {/* Apply button */}
          <TouchableOpacity
            onPress={handleApply}
            activeOpacity={0.8}
            style={[
              styles.applyBtn,
              {
                backgroundColor:
                  approvedCount === 0 && result.proposedInventoryChanges.length === 0
                    ? c.secondary
                    : c.primary,
                borderRadius: c.radius,
              },
            ]}
            disabled={approvedCount === 0 && result.proposedInventoryChanges.length === 0}
          >
            <Text
              style={[
                styles.applyBtnText,
                {
                  fontSize: c.scaleFont(15),
                  color:
                    approvedCount === 0 && result.proposedInventoryChanges.length === 0
                      ? c.mutedForeground
                      : c.primaryForeground,
                },
              ]}
            >
              {result.proposedInventoryChanges.some((i) => i.quantity > 0)
                ? `Review Items${approvedCount > 0 ? ` \u00B7 ${approvedCount} stat${approvedCount !== 1 ? "s" : ""}` : ""}`
                : approvedCount > 0
                ? `Apply ${approvedCount} Change${approvedCount !== 1 ? "s" : ""}`
                : "Nothing Selected"}
            </Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* Examples */}
      <View style={styles.examplesSection}>
        <Text style={[styles.examplesTitle, { color: c.mutedForeground, fontSize: c.scaleFont(11) }]}>Examples</Text>
        {EXAMPLES.map((ex) => (
          <TouchableOpacity
            key={ex}
            onPress={() => {
              setInput(ex);
              setResult(null);
              setApplied(false);
              setError(null);
            }}
            activeOpacity={0.7}
            style={[styles.exampleChip, { backgroundColor: c.secondary, borderRadius: c.radius, padding: c.densitySpace(12) }]}
          >
            <Text style={[styles.exampleText, { color: c.mutedForeground, fontSize: c.scaleFont(13), lineHeight: c.scaleLineHeight(18) }]}>{ex}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Offline manual fallback */}
      {showManualFallback && (
        <Card style={{ marginTop: 8 }}>
          <Text style={[styles.label, { color: "#F59E0B", marginBottom: 6, fontSize: c.scaleFont(15) }]}>Offline — Enter Manually</Text>
          <Text style={{ fontSize: c.scaleFont(12), lineHeight: c.scaleLineHeight(18), color: c.mutedForeground, marginBottom: 10 }}>
            AI is unavailable. Your input will be queued and retried when online.
          </Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius, minHeight: c.densitySpace(40), fontSize: c.scaleFont(15), lineHeight: c.scaleLineHeight(22), padding: c.densitySpace(12) }]}
            placeholder="HP change (e.g. -12, +5)"
            placeholderTextColor={c.mutedForeground}
            value={manualHpDelta}
            onChangeText={setManualHpDelta}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            style={[styles.textInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius, minHeight: c.densitySpace(40), fontSize: c.scaleFont(15), lineHeight: c.scaleLineHeight(22), padding: c.densitySpace(12) }]}
            placeholder="GP change (e.g. +10, -3)"
            placeholderTextColor={c.mutedForeground}
            value={manualGpDelta}
            onChangeText={setManualGpDelta}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            style={[styles.textInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius, minHeight: c.densitySpace(40), fontSize: c.scaleFont(15), lineHeight: c.scaleLineHeight(22), padding: c.densitySpace(12) }]}
            placeholder="Resource name (e.g. Rage)"
            placeholderTextColor={c.mutedForeground}
            value={manualResourceName}
            onChangeText={setManualResourceName}
          />
          <TextInput
            style={[styles.textInput, { backgroundColor: c.secondary, color: c.foreground, borderRadius: c.radius, minHeight: c.densitySpace(40), fontSize: c.scaleFont(15), lineHeight: c.scaleLineHeight(22), padding: c.densitySpace(12) }]}
            placeholder="Resource delta (e.g. -1)"
            placeholderTextColor={c.mutedForeground}
            value={manualResourceDelta}
            onChangeText={setManualResourceDelta}
            keyboardType="numbers-and-punctuation"
          />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <TouchableOpacity
              onPress={handleManualApply}
              activeOpacity={0.8}
              style={[styles.applyBtn, { flex: 1, backgroundColor: c.primary, borderRadius: c.radius }]}
            >
              <Text style={[styles.applyBtnText, { color: c.primaryForeground, fontSize: c.scaleFont(15) }]}>Apply Manual</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowManualFallback(false)}
              activeOpacity={0.8}
              style={[styles.applyBtn, { flex: 1, backgroundColor: c.secondary, borderRadius: c.radius }]}
            >
              <Text style={[styles.applyBtnText, { color: c.mutedForeground, fontSize: c.scaleFont(15) }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Undo toast */}
      {undoToastVisible && (
        <View
          style={[
            styles.undoToast,
            { backgroundColor: c.secondary, borderColor: c.border, borderRadius: c.radius },
          ]}
        >
          <Feather name="check-circle" size={14} color="#10B981" />
          <Text style={[styles.undoToastText, { color: c.foreground, fontSize: c.scaleFont(13) }]}>Applied. Undo unavailable for this update.</Text>
        </View>
      )}
      </ScrollHintScrollView>
    </KeyboardAvoidingView>
  );
}

function getTypeColor(type: string): string {
  switch (type) {
    case "hp": return "#EF4444";
    case "resource": return "#8B5CF6";
    case "inventory": return "#10B981";
    case "currency": return "#F59E0B";
    case "attack": return "#3B82F6";
    case "quest": return "#8B5CF6";
    case "mixed": return "#0EA5E9";
    default: return "#6B7280";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  textInput: {
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 8,
    lineHeight: 22,
  },
  mentionBox: {
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  mentionTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  mentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  mentionName: { flex: 1, fontSize: 13, fontWeight: "600" },
  mentionType: { fontSize: 11, textTransform: "capitalize" },
  mentionEmpty: { fontSize: 12, paddingHorizontal: 10, paddingBottom: 10, lineHeight: 18 },
  parseBtn: { padding: 14, alignItems: "center" },
  parseBtnText: { fontSize: 15, fontWeight: "700" },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  errorMsg: { fontSize: 12, lineHeight: 18 },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  photoBtnTitle: { fontSize: 14, fontWeight: "700" },
  photoBtnSub: { fontSize: 12, marginTop: 2 },
  resultHeader: { marginBottom: 12 },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 6 },
  typeBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  summary: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  changeText: { fontSize: 13, fontWeight: "600" },
  attackCalcBox: { padding: 10, marginTop: 8 },
  attackCalcTitle: { fontSize: 14, fontWeight: "700" },
  attackCalcDetail: { fontSize: 13, marginTop: 2 },
  attackTotal: { fontWeight: "700" },
  questPreview: { padding: 10, marginTop: 8 },
  conditionPreview: { padding: 10, marginTop: 8 },
  conditionRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 },
  conditionText: { fontSize: 13, flex: 1, lineHeight: 18 },
  inventoryPreview: { padding: 10, marginTop: 8 },
  previewLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  previewItem: { fontSize: 13, marginTop: 4 },
  applyBtn: { padding: 14, alignItems: "center", marginTop: 10 },
  applyBtnText: { fontSize: 15, fontWeight: "700" },
  examplesSection: { marginTop: 8 },
  examplesTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  exampleChip: { padding: 12, marginBottom: 6 },
  exampleText: { fontSize: 13, lineHeight: 18 },
  // Delta review styles
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  deltaCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  deltaLabel: { fontSize: 12, fontWeight: "600", minWidth: 60 },
  deltaArrow: { fontSize: 12 },
  deltaAfter: { flex: 1, fontSize: 13, fontWeight: "700" },
  deltaEditInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    borderBottomWidth: 1,
    paddingVertical: 2,
    minWidth: 60,
  },
  // Undo toast
  undoToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  undoToastText: { flex: 1, fontSize: 13, fontWeight: "600" },
  undoToastBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  undoToastBtnText: { fontSize: 13, fontWeight: "700" },
});
