import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type {
  Character,
  CharacterStatistics,
  Attack,
  Resource,
  InventoryItem,
  ActiveCondition,
  ConditionDurationType,
  CharacterSnapshot,
  ProposedInventoryItem,
  ProposedCurrencyChange,
  ProposedResourceChange,
  ProposedHpChange,
  ProposedConditionChange,
  Note,
  JournalArc,
  WishlistItem,
  SpellSlotLevel,
  CombatLogEntry,
  SessionLog,
  ClassFeature,
  PreparedSpell,
  RulesEngineState,
  NpcPerson,
  Quest,
  CampaignLocation,
  Plane,
  QuestUpdateResult,
  QuestGraphApplyReceipt,
  QuestGraphApplyReport,
  QuestGraphApplySection,
  QuestGraphApplyReasonCode,
  QuestGraphDeferredOperation,
  QuestGraphRelationshipRecord,
  QuestGraphResolutionDecision,
  QuestGraphResolutionResult,
  QuestGraphReviewBatch,
  QuestParserGraphResult,
  QuestReferenceItem,
  Companion,
} from "@/types";
import type { CombatTargetResolutionResult } from "@/types/combatOutcome";
import type { CompendiumMonster } from "@/types";
import { getConditionInfo } from "@/data/conditions";
import { getDefaultSpellSlots } from "@/data/spellSlots";
import {
  mockCharacter,
  mockAttacks,
  mockResources,
  mockInventory,
} from "@/data/mockCharacter";
import { saveCharacter } from "@/utils/characterStorage";
import { getAllCharacters, getLastActiveId } from "@/utils/characterStorage";
import { triggerEffect } from "@/utils/triggerEffect";
import { isEquippableCategory } from "@/data/itemCategoryRules";
import { normalizeEquippedInventorySlots } from "@/utils/equipment/equipmentSlotRules";
import {
  buildInventoryStackKey,
  mergeInventoryItemIntoMatchingUnequippedStack,
  splitInventoryStackForEquip,
  splitInventoryStack,
} from "@/utils/equipment/inventoryStacks";
import { getFeatureFlag } from "@/utils/featureFlags";
import { getActiveRules } from "@/rules/registry";
import { compileRules } from "@/rules/compiler";
import { evaluateRules } from "@/rules/evaluator";
import {
  assemblePortableCharacterSnapshot,
  normalizeCharacterSnapshotMechanics,
} from "@/utils/mechanics/characterSnapshotMechanicsAdapters";
import {
  computeDeathSaveStateAfterHpChange,
  getZeroHpState,
  hasConditionNamed,
  normalizeDeathSaveState,
  recordDeathSaveOutcome,
  resetDeathSaveState,
  stabilizeDeathSaveState,
} from "@/utils/combat/zeroHpLifecycle";
import {
  decrementConditionDuration,
  normalizeConditionDuration,
  shouldConditionExpire,
} from "@/utils/combat/conditionDurationLifecycle";
import { applyLocalResolvedHpMutation } from "@/utils/combat/localResolvedHpMutation";
import {
  getRuntimeItemProjectedEffects,
  mergeItemMechanicsBlocks,
  normalizeRuntimeInventoryItem,
} from "@/utils/mechanics/runtimeMechanicsCompatibility";
import {
  canArchiveQuestGraphBatch,
  getQuestGraphBatchStatus,
  getRelationshipConfidence,
  makeQuestGraphPayloadFingerprint,
  mergeQuestAliases,
  normalizeQuestMatchText,
  resolveQuestEntityByName,
  summarizeQuestGraphBatch,
  upsertQuestGraphRelationships,
  upsertQuestReferenceItems,
} from "@/utils/questGraphReview";

export interface StatusPillEvent {
  id: string;
  message: string;
  tone: "positive" | "neutral" | "negative";
}

interface CharacterContextType {
  character: Character;
  attacks: Attack[];
  resources: Resource[];
  inventory: InventoryItem[];
  conditions: ActiveCondition[];
  notes: Note[];
  wishlist: WishlistItem[];
  classFeatures: ClassFeature[];
  passiveFeatures: ClassFeature[];
  spellEffectUses: Record<string, number>;
  itemActionUses: Record<string, number>;
  spellSlots: SpellSlotLevel[];
  rulesState: RulesEngineState;

  // Combat log
  combatLogEntries: CombatLogEntry[];
  combatLogSessions: SessionLog[];

  currentCharacterId: string | null;
  hasCharacter: boolean;

  // Multi-character
  loadCharacter: (snapshot: CharacterSnapshot) => void;
  saveCurrentCharacter: () => Promise<void>;
  clearCharacter: () => void;

  // Full import
  importAll: (snapshot: CharacterSnapshot) => void;

  // Character mutations
  updateCharacter: (updates: Partial<Character>) => void;
  updateHp: (delta: number, source?: "manual" | "ai") => void;
  updateTempHp: (value: number) => void;
  updateNotes: (notes: string) => void;
  updateCurrency: (change: ProposedCurrencyChange) => void;
  recordDeathSaveSuccess: () => void;
  recordDeathSaveFailure: () => void;
  stabilizeAtZeroHp: () => void;
  resetDeathSaveTracking: () => void;

  // Resource mutations
  incrementResource: (id: string, effectiveMax?: number) => void;
  decrementResource: (id: string) => void;
  resetResource: (id: string, effectiveMax?: number) => void;
  applyResourceChanges: (changes: ProposedResourceChange[], source?: "manual" | "ai") => void;
  addResource: (resource: Omit<Resource, "id">) => void;
  upsertResourceByName: (name: string, updates: Partial<Omit<Resource, "id">>) => void;

  // Spell effect mutations
  useSpellEffect: (effectId: string) => void;
  rechargeSpellEffects: (resetOn: "short_rest" | "long_rest" | "dawn") => void;

  // Item action uses mutations
  useItemEffect: (effectId: string) => void;
  rechargeItemEffects: (resetOn: "short_rest" | "long_rest" | "dawn") => void;

  // Spell slot mutations
  expendSpellSlot: (level: number) => void;
  restoreSpellSlot: (level: number) => void;
  restoreAllSpellSlots: () => void;
  updateSpellSlotTotal: (level: number, total: number) => void;

  // Condition mutations
  addCondition: (cond: Omit<ActiveCondition, "id">, source?: "manual" | "ai") => void;
  removeCondition: (id: string) => void;
  applyConditionChanges: (changes: ProposedConditionChange[], source?: "manual" | "ai") => void;
  clearConditionsOnRest: (restType: "short_rest" | "long_rest") => void;
  tickConditions: (timing: "onTargetTurnEnd" | "onRoundAdvance") => void;
  decrementCondition: (id: string) => void;
  setConditionDuration: (id: string, durationType: ConditionDurationType, value?: number) => void;
  removeConditionsByConcentrationLink: (spellId: string) => void;

  // Attack mutations
  addAttack: (attack: Omit<Attack, "id">) => void;
  updateAttack: (id: string, updates: Partial<Attack>) => void;
  removeAttack: (id: string) => void;

  // Companion mutations
  companions: Companion[];
  addCompanion: (companionData: Omit<Companion, "id" | "createdAt" | "updatedAt">) => void;
  updateCompanion: (id: string, updates: Partial<Omit<Companion, "id" | "characterId" | "createdAt">>) => void;
  deleteCompanion: (id: string) => void;
  addCompanionFromMonster: (monster: CompendiumMonster) => void;

  // Inventory mutations
  addItem: (item: Omit<InventoryItem, "id">) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  toggleEquipped: (id: string) => void;
  splitStackItem: (id: string, splitQty: number) => void;
  mergeStackItem: (id: string) => void;
  dispatchRuleTrigger: (currentAction: string, item?: InventoryItem) => void;
  applyProposedItems: (items: ProposedInventoryItem[]) => void;
  reorderInventory: (newOrder: InventoryItem[]) => void;
  applyHpChange: (change: ProposedHpChange, source?: "manual" | "ai") => void;
  applyResolvedLocalDamage: (result: CombatTargetResolutionResult, source?: "manual" | "ai") => void;

  // Note mutations
  addNote: (note: Omit<Note, "id" | "createdAt" | "updatedAt">) => void;
  updateNote: (id: string, updates: Partial<Omit<Note, "id" | "createdAt">>) => void;
  deleteNote: (id: string) => void;
  pinNote: (id: string, pinned: boolean) => void;

  // Journal arcs
  journalArcs: JournalArc[];
  addJournalArc: (arc: Omit<JournalArc, "id">) => void;
  updateJournalArc: (id: string, updates: Partial<Omit<JournalArc, "id">>) => void;
  removeJournalArc: (id: string) => void;
  appendQuickEntry: (text: string, sessionNumber?: number) => void;

  // Wishlist mutations
  addWishlistItem: (item: Omit<WishlistItem, "id" | "createdAt" | "updatedAt">) => void;
  updateWishlistItem: (id: string, updates: Partial<Omit<WishlistItem, "id" | "createdAt">>) => void;
  removeWishlistItem: (id: string) => void;
  convertWishlistItemToInventory: (
    id: string,
    options?: { keepAsAcquired?: boolean; archiveAfterConvert?: boolean }
  ) => void;

  // Pin mutations (people / quests / locations)
  pinPerson: (id: string, pinned: boolean) => void;
  pinQuest: (id: string, pinned: boolean) => void;
  pinLocation: (id: string, pinned: boolean) => void;

  // Statistics
  updateStatistics: (updates: Partial<CharacterStatistics>) => void;
  incrementKillCount: () => void;

  // Class feature mutations
  addClassFeature: (feature: Omit<ClassFeature, "id">) => void;
  updateClassFeature: (id: string, updates: Partial<Omit<ClassFeature, "id">>) => void;
  removeClassFeature: (id: string) => void;
  setClassFeatures: (features: ClassFeature[]) => void;
  setPassiveFeatures: (features: ClassFeature[]) => void;

  // Spells
  preparedSpells: PreparedSpell[];
  addSpell: (s: Omit<PreparedSpell, "id" | "createdAt">) => void;
  updateSpell: (id: string, updates: Partial<Omit<PreparedSpell, "id" | "createdAt">>) => void;
  removeSpell: (id: string) => void;
  toggleSpellPrepared: (id: string) => void;

  // World journal — people, quests, locations
  people: NpcPerson[];
  addPerson: (p: Omit<NpcPerson, "id" | "createdAt">) => void;
  updatePerson: (id: string, updates: Partial<Omit<NpcPerson, "id" | "createdAt">>) => void;
  deletePerson: (id: string) => void;

  quests: Quest[];
  addQuest: (q: Omit<Quest, "id" | "createdAt">) => void;
  updateQuest: (id: string, updates: Partial<Omit<Quest, "id" | "createdAt">>) => void;
  deleteQuest: (id: string) => void;

  locations: CampaignLocation[];
  addLocation: (l: Omit<CampaignLocation, "id" | "createdAt">) => void;
  updateLocation: (id: string, updates: Partial<Omit<CampaignLocation, "id" | "createdAt">>) => void;
  deleteLocation: (id: string) => void;

  realms: Plane[];
  addRealm: (r: Omit<Plane, "id" | "createdAt">) => void;
  updateRealm: (id: string, updates: Partial<Omit<Plane, "id" | "createdAt">>) => void;
  deleteRealm: (id: string) => void;
  pinRealm: (id: string, pinned: boolean) => void;

  applyQuestUpdate: (
    result: QuestUpdateResult,
    options?: { enableInventoryLinking?: boolean; sourceType?: "quick_update" | "loot_review" }
  ) => QuestGraphApplyReport;
  getReviewBatches: () => QuestGraphReviewBatch[];
  resolveDeferredOperation: (batchId: string, operationId: string, decision: QuestGraphResolutionDecision) => void;
  resolveBatch: (batchId: string, decisions: Array<{ operationId: string; decision: QuestGraphResolutionDecision }>) => void;
  applyResolvedOperations: (batchId: string) => QuestGraphResolutionResult;
  markBatchArchived: (batchId: string) => void;
  applyDeferredInventoryLinksForBatch: (batchId: string, acceptedItemIds: string[]) => QuestGraphResolutionResult;

  // Level-up queue (for characters created above level 1)
  pendingLevelUps: number;
  queueLevelUps: (count: number) => void;
  decrementPendingLevelUps: () => void;

  // Combat log mutations
  addLogNote: (entryId: string, note: string) => void;
  clearCombatLog: () => void;
  startNewSession: (label?: string) => void;

  // UI status pill
  statusPill: StatusPillEvent | null;
  showStatusPill: (message: string, tone?: "positive" | "neutral" | "negative") => void;
  clearStatusPill: () => void;
}

const CharacterContext = createContext<CharacterContextType | null>(null);

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function makeSessionId(): string {
  return "session_" + Date.now().toString() + Math.random().toString(36).substr(2, 5);
}

function makeInitialSession(): SessionLog {
  return { id: makeSessionId(), startedAt: Date.now(), label: "Session 1" };
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeRuleFeatureId(ruleId: string, actionType: string, actionName: string): string {
  return `rule-feature-${toSlug(ruleId)}-${toSlug(actionType)}-${toSlug(actionName)}`;
}

function makeRuleSpellId(ruleId: string, spellName: string): string {
  return `rule-spell-${toSlug(ruleId)}-${toSlug(spellName)}`;
}

function normalizeKey(value: string | null | undefined): string {
  return normalizeQuestMatchText(value);
}

function upsertNetworkLine(notes: string | undefined, label: string, values: string[]): string | undefined {
  const deduped = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (deduped.length === 0) return notes;
  const line = `${label}: ${deduped.join(", ")}`;
  const current = (notes || "").trim();
  if (!current) return line;

  const lines = current.split("\n").map((linePart) => linePart.trim()).filter(Boolean);
  const existingIdx = lines.findIndex((linePart) => linePart.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  if (existingIdx >= 0) {
    lines[existingIdx] = line;
    return lines.join("\n");
  }
  return `${current}\n${line}`;
}

function buildQuestDescriptionFallback(
  questName: string,
  summary: string,
  personNames: string[],
  locationNames: string[]
): string | undefined {
  const base = summary.trim() || questName.trim();
  if (!base) return undefined;
  const peoplePart = personNames.length > 0 ? `People: ${personNames.join(", ")}.` : "";
  const locationsPart = locationNames.length > 0 ? `Locations: ${locationNames.join(", ")}.` : "";
  return `${base}${peoplePart || locationsPart ? ` ${peoplePart} ${locationsPart}`.trim() : ""}`.trim();
}

function makeQuestGraphApplyReport(): QuestGraphApplyReport {
  return {
    applied: [],
    deferred: [],
    skipped: [],
    summary: { applied: 0, deferred: 0, skipped: 0 },
  };
}

function finalizeQuestGraphApplyReport(report: QuestGraphApplyReport): QuestGraphApplyReport {
  return {
    ...report,
    summary: {
      applied: report.applied.length,
      deferred: report.deferred.length,
      skipped: report.skipped.length,
    },
  };
}

function makeReviewBatchId(): string {
  return `qg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const REVIEW_BATCH_SESSION_DEDUPE_WINDOW_MS = 5 * 60 * 1000;

function isReplaySupportedSection(section: QuestGraphApplySection): boolean {
  return section === "inventory_link" || section === "relationship";
}

function isLocationContainmentRelationshipSnapshot(snapshot: unknown): snapshot is {
  relationshipType: string;
  fromEntityId: string;
  toEntityId: string;
} {
  if (!snapshot || typeof snapshot !== "object") return false;
  const value = snapshot as { relationshipType?: unknown; fromEntityId?: unknown; toEntityId?: unknown };
  if (typeof value.relationshipType !== "string" || typeof value.fromEntityId !== "string" || typeof value.toEntityId !== "string") {
    return false;
  }
  return value.relationshipType === "contained_in" || value.relationshipType === "contains_location";
}

function isReplaySupportedOperation(op: QuestGraphDeferredOperation, decision: QuestGraphResolutionDecision): boolean {
  if (op.section === "inventory_link") {
    return decision.action === "apply_inventory_link";
  }
  if (op.section === "relationship") {
    if (decision.action !== "apply_location_parent" && decision.action !== "keep_location_unparented") return false;
    return isLocationContainmentRelationshipSnapshot(op.payloadSnapshot);
  }
  return false;
}

function makeDeferredReceiptDedupeToken(receipt: {
  section: QuestGraphApplySection;
  key: string;
  detail: string;
  reasonCode?: QuestGraphApplyReasonCode;
}): string {
  return [receipt.section, receipt.key, receipt.reasonCode ?? "", receipt.detail].join("|");
}

function makeReviewBatchDedupeKeyFromReport(input: {
  sourceType: "quick_update" | "loot_review";
  summary: string;
  report: QuestGraphApplyReport;
}): string {
  const tokens = [...input.report.deferred, ...input.report.skipped]
    .filter((receipt) => receipt.reasonCode != null)
    .map((receipt) => makeDeferredReceiptDedupeToken(receipt))
    .sort();
  return [input.sourceType, normalizeKey(input.summary), tokens.join("||")].join("::");
}

function makeReviewBatchDedupeKeyFromBatch(batch: QuestGraphReviewBatch): string {
  const tokens = batch.operations
    .map((op) => makeDeferredReceiptDedupeToken(op))
    .sort();
  return [batch.sourceType, normalizeKey(batch.rawInputSummary), tokens.join("||")].join("::");
}

function updateReviewBatchStatus(batch: QuestGraphReviewBatch): QuestGraphReviewBatch {
  if (batch.status === "archived") return batch;
  return { ...batch, status: getQuestGraphBatchStatus(batch) };
}

function findPayloadSnapshotForReceipt(
  graph: QuestParserGraphResult,
  receipt: QuestGraphApplyReceipt
): unknown {
  if (receipt.section === "entity_create") {
    return (graph.entitiesToCreate ?? []).find((entry) => entry.localKey === receipt.key) ?? null;
  }

  if (receipt.section === "entity_link") {
    const idx = receipt.key.indexOf(":");
    const kind = idx >= 0 ? receipt.key.slice(0, idx) : "";
    const mentionedName = idx >= 0 ? receipt.key.slice(idx + 1) : receipt.key;
    return (graph.entitiesToLink ?? []).find((entry) => entry.kind === kind && entry.mentionedName === mentionedName) ?? null;
  }

  if (receipt.section === "relationship") {
    const firstColon = receipt.key.indexOf(":");
    const arrow = receipt.key.indexOf("->");
    if (firstColon < 0 || arrow < 0 || arrow <= firstColon) return null;
    const relationshipType = receipt.key.slice(0, firstColon);
    const fromEntityId = receipt.key.slice(firstColon + 1, arrow);
    const toEntityId = receipt.key.slice(arrow + 2);
    return (graph.relationshipsToCreate ?? []).find(
      (entry) => entry.relationshipType === relationshipType && entry.fromEntityId === fromEntityId && entry.toEntityId === toEntityId
    ) ?? null;
  }

  if (receipt.section === "inventory_link") {
    // questRef:<ref>|item:<itemId>
    const itemMarker = "|item:";
    const questPrefix = "questRef:";
    if (!receipt.key.startsWith(questPrefix)) return null;
    const itemIdx = receipt.key.indexOf(itemMarker);
    const questRef = itemIdx >= 0
      ? receipt.key.slice(questPrefix.length, itemIdx)
      : receipt.key.slice(questPrefix.length);
    const itemId = itemIdx >= 0 ? receipt.key.slice(itemIdx + itemMarker.length) : null;
    const link = (graph.inventoryLinks ?? []).find((entry) => entry.questRef === questRef);
    if (!link) return null;
    if (!itemId) return link;
    const item = (link.items ?? []).find((entry) => entry.itemId === itemId) ?? null;
    return { questRef: link.questRef, reviewState: link.reviewState, item };
  }

  return null;
}

function buildReviewBatchFromGraphReport(input: {
  graph: QuestParserGraphResult;
  report: QuestGraphApplyReport;
  summary: string;
  sourceType: "quick_update" | "loot_review";
    dedupeKey?: string; // Optional deduplication key for batch review
}): QuestGraphReviewBatch | null {
  const deferredOps = [...input.report.deferred, ...input.report.skipped]
    .filter((receipt) => receipt.reasonCode != null)
    .map((receipt) => ({
      operationId: generateId(),
      section: receipt.section,
      key: receipt.key,
      reasonCode: receipt.reasonCode,
      detail: receipt.detail,
      payloadSnapshot: findPayloadSnapshotForReceipt(input.graph, receipt),
      payloadFingerprint: makeQuestGraphPayloadFingerprint(findPayloadSnapshotForReceipt(input.graph, receipt)),
      replayable: isReplaySupportedSection(receipt.section),
      attemptCount: 0,
      resolutionState: "pending" as const,
    } satisfies QuestGraphDeferredOperation));

  if (deferredOps.length === 0) return null;

  return {
    batchId: makeReviewBatchId(),
    createdAt: Date.now(),
    schemaVersion: 2,
    sourceType: input.sourceType,
    rawInputSummary: input.summary,
    ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    status: "open",
    operations: deferredOps,
  };
}

function formatCurrencyDelta(change: ProposedCurrencyChange): string {
  const parts: string[] = [];
  const push = (key: keyof ProposedCurrencyChange, label: string) => {
    const v = change[key] ?? 0;
    if (!v) return;
    parts.push(`${v > 0 ? "+" : ""}${v} ${label}`);
  };
  push("cp", "cp");
  push("sp", "sp");
  push("ep", "ep");
  push("gp", "gp");
  push("pp", "pp");
  return parts.join(", ");
}

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [character, setCharacter] = useState<Character>(mockCharacter);
  const [attacks, setAttacks] = useState<Attack[]>(mockAttacks);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [resources, setResources] = useState<Resource[]>(mockResources);
  const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory);
  const [conditions, setConditions] = useState<ActiveCondition[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [journalArcs, setJournalArcs] = useState<JournalArc[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [classFeatures, setClassFeaturesState] = useState<ClassFeature[]>([]);
  const [passiveFeatures, setPassiveFeaturesState] = useState<ClassFeature[]>([]);
  const [preparedSpells, setPreparedSpells] = useState<PreparedSpell[]>([]);
  const [people, setPeople] = useState<NpcPerson[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [locations, setLocations] = useState<CampaignLocation[]>([]);
  const [realms, setRealms] = useState<Plane[]>([]);
  const [spellEffectUses, setSpellEffectUses] = useState<Record<string, number>>({});
  const [itemActionUses, setItemActionUses] = useState<Record<string, number>>({});
  const [spellSlots, setSpellSlots] = useState<SpellSlotLevel[]>([]);
  const [rulesState, setRulesState] = useState<RulesEngineState>({
    schemaVersion: 1,
    appliedEffects: [],
    activeProvenances: [],
  });
  const [hasCharacter, setHasCharacter] = useState(false);
  const [currentCharacterId, setCurrentCharacterId] = useState<string | null>(null);
  const [combatLogEntries, setCombatLogEntries] = useState<CombatLogEntry[]>([]);
  const [combatLogSessions, setCombatLogSessions] = useState<SessionLog[]>([makeInitialSession()]);
  const [pendingLevelUps, setPendingLevelUps] = useState(0);
  const [statusPill, setStatusPill] = useState<StatusPillEvent | null>(null);
  const [questGraphReviewQueue, setQuestGraphReviewQueue] = useState<QuestGraphReviewBatch[]>([]);
  const characterHydrationAttemptedRef = useRef(false);
  const hasCharacterRef = useRef(false);

  useEffect(() => {
    hasCharacterRef.current = hasCharacter;
  }, [hasCharacter]);

  const showStatusPill = useCallback((message: string, tone: "positive" | "neutral" | "negative" = "neutral") => {
    setStatusPill({ id: generateId(), message, tone });
  }, []);

  const clearStatusPill = useCallback(() => {
    setStatusPill(null);
  }, []);

  const normalizeInventoryEquipment = useCallback((items: InventoryItem[], preferredItemId?: string) => {
    return normalizeEquippedInventorySlots(items, preferredItemId ? { preferredItemId } : undefined);
  }, []);

  const loadCharacter = useCallback((snapshot: CharacterSnapshot) => {
    const normalizedSnapshot = normalizeCharacterSnapshotMechanics(snapshot);

    setCharacter(normalizedSnapshot.character);
    setAttacks(normalizedSnapshot.attacks ?? []);
    setCompanions(normalizedSnapshot.companions ?? []);
    setResources(normalizedSnapshot.resources ?? []);
    setInventory(normalizeInventoryEquipment(normalizedSnapshot.inventory ?? []).inventory);
    setConditions(normalizedSnapshot.conditions ?? []);
    setNotes(normalizedSnapshot.notes ?? []);
    setWishlist(normalizedSnapshot.wishlist ?? []);
    setJournalArcs(normalizedSnapshot.journalArcs ?? []);
    setClassFeaturesState(normalizedSnapshot.classFeatures ?? []);
    setPassiveFeaturesState(normalizedSnapshot.passiveFeatures ?? []);
    setPreparedSpells(normalizedSnapshot.preparedSpells ?? []);
    setPeople(normalizedSnapshot.people ?? []);
    setQuests(normalizedSnapshot.quests ?? []);
    setLocations(normalizedSnapshot.locations ?? []);

    // Build the planes list — always include Material Plane; add race-based plane if applicable
    const RACE_PLANES: Record<string, { name: string; description: string }> = {
      "Githyanki":  { name: "Astral Plane", description: "The silvery void between dimensions, home of the Githyanki and their astral fortresses." },
      "Githzerai":  { name: "Limbo", description: "The plane of uncontrolled chaos shaped by the will of its inhabitants, home of Githzerai monasteries." },
      "Tiefling":   { name: "Nine Hells", description: "The infernal realm of Asmodeus and the archdevils — a place of iron law and eternal punishment where Tiefling bloodlines originate." },
      "Aasimar":    { name: "Upper Planes", description: "The heavenly realms of celestials and divine beings beyond the mortal world, source of Aasimar celestial heritage." },
      "Satyr":      { name: "Feywild", description: "The mirror of the Material Plane suffused with wild magic and heightened emotion, home of the fey." },
      "Genasi":     { name: "Elemental Planes", description: "The four elemental planes of Air, Earth, Fire, and Water — the fundamental forces of creation from which Genasi draw their power." },
    };
    const savedPlanes: Plane[] = normalizedSnapshot.realms ?? [];
    const hasNamed = (name: string) => savedPlanes.some(p => p.name.toLowerCase() === name.toLowerCase());
    const extraPlanes: Plane[] = [];
    if (!hasNamed("Material Plane")) {
      extraPlanes.push({ id: "plane-material", name: "Material Plane", description: "The primary plane of existence where most mortal life resides.", questTags: [], locationTags: [], createdAt: 0, pinned: true });
    }
    const charRace = normalizedSnapshot.character.race ?? "";
    const racePlane = Object.entries(RACE_PLANES).find(([key]) =>
      charRace.toLowerCase().includes(key.toLowerCase())
    )?.[1];
    if (racePlane && !hasNamed(racePlane.name)) {
      extraPlanes.push({ id: `plane-${racePlane.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`, name: racePlane.name, description: racePlane.description, questTags: [], locationTags: [], createdAt: 0 });
    }
    setRealms([...extraPlanes, ...savedPlanes]);
    setSpellEffectUses(normalizedSnapshot.spellEffectUses ?? {});
    setItemActionUses(normalizedSnapshot.itemActionUses ?? {});
    setRulesState(normalizedSnapshot.rulesState ?? {
      schemaVersion: 1,
      appliedEffects: [],
      activeProvenances: [],
    });
    setQuestGraphReviewQueue(normalizedSnapshot.questGraphReviewQueue ?? []);
    const savedSlots = normalizedSnapshot.spellSlots;
    if (savedSlots && savedSlots.length > 0) {
      setSpellSlots(savedSlots);
    } else {
      setSpellSlots(getDefaultSpellSlots(normalizedSnapshot.character.class, normalizedSnapshot.character.level));
    }
    setHasCharacter(true);
    setCurrentCharacterId(normalizedSnapshot.character.id);
    if (normalizedSnapshot.combatLog) {
      setCombatLogEntries(normalizedSnapshot.combatLog.entries);
      setCombatLogSessions(
        normalizedSnapshot.combatLog.sessions.length > 0
          ? normalizedSnapshot.combatLog.sessions
          : [makeInitialSession()]
      );
    } else {
      setCombatLogEntries([]);
      setCombatLogSessions([makeInitialSession()]);
    }
  }, [normalizeInventoryEquipment]);

  useEffect(() => {
    if (characterHydrationAttemptedRef.current) return;
    characterHydrationAttemptedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const lastId = await getLastActiveId();
        if (!lastId || cancelled || hasCharacterRef.current) return;
        const all = await getAllCharacters();
        if (cancelled || hasCharacterRef.current) return;
        const found = all.find((saved) => saved.id === lastId);
        if (found) {
          loadCharacter(found.snapshot);
        }
      } catch {
        // Keep provider resilient if local storage read fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadCharacter]);

  const clearCharacter = useCallback(() => {
    setCharacter(mockCharacter);
    setAttacks(mockAttacks);
    setCompanions([]);
    setResources(mockResources);
    setInventory(normalizeInventoryEquipment(mockInventory).inventory);
    setConditions([]);
    setNotes([]);
    setWishlist([]);
    setJournalArcs([]);
    setClassFeaturesState([]);
    setPassiveFeaturesState([]);
    setPreparedSpells([]);
    setPeople([]);
    setQuests([]);
    setLocations([]);
    setRealms([]);
    setSpellEffectUses({});
    setItemActionUses({});
    setRulesState({ schemaVersion: 1, appliedEffects: [], activeProvenances: [] });
    setSpellSlots([]);
    setHasCharacter(false);
    setCurrentCharacterId(null);
    setCombatLogEntries([]);
    setCombatLogSessions([makeInitialSession()]);
    setPendingLevelUps(0);
    setQuestGraphReviewQueue([]);
  }, [normalizeInventoryEquipment]);

  const saveCurrentCharacter = useCallback(async (): Promise<void> => {
    if (!hasCharacter) return;
    const snapshot = assemblePortableCharacterSnapshot({
      _version: 1,
      character,
      attacks,
      companions,
      resources,
      inventory,
      conditions,
      notes,
      wishlist,
      journalArcs,
      spellSlots,
      spellEffectUses,
      itemActionUses,
      classFeatures,
      passiveFeatures,
      preparedSpells,
      people,
      quests,
      locations,
      realms,
      rulesState,
      combatLog: {
        entries: combatLogEntries,
        sessions: combatLogSessions,
      },
      questGraphReviewQueue,
    });
    await saveCharacter(snapshot);
  }, [hasCharacter, character, attacks, companions, resources, inventory, conditions, notes, wishlist, journalArcs, spellSlots, spellEffectUses, itemActionUses, classFeatures, passiveFeatures, preparedSpells, people, quests, locations, realms, rulesState, combatLogEntries, combatLogSessions, questGraphReviewQueue]);

  const importAll = useCallback((snapshot: CharacterSnapshot) => {
    const normalizedSnapshot = normalizeCharacterSnapshotMechanics(snapshot);
    loadCharacter(normalizedSnapshot);
    saveCharacter(normalizedSnapshot).catch(() => {});
  }, [loadCharacter]);

  const updateCharacter = useCallback((updates: Partial<Character>) => {
    setCharacter((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateHp = useCallback((delta: number, source: "manual" | "ai" = "manual") => {
    let blockedDeadHealing = false;

    setCharacter((prev) => {
      const deathSaveState = normalizeDeathSaveState(prev.deathSaves);
      if (delta > 0 && deathSaveState.dead) {
        blockedDeadHealing = true;
        return prev;
      }

      const newHp = Math.min(prev.maxHp, Math.max(0, prev.currentHp + delta));
      const actualDelta = newHp - prev.currentHp;
      if (actualDelta !== 0) {
        const sessId = combatLogSessions[combatLogSessions.length - 1]?.id ?? "default";
        const type = actualDelta < 0 ? "hp_damage" : "hp_heal";
        const absDelta = Math.abs(actualDelta);
        const desc = actualDelta < 0
          ? `Took ${absDelta} damage · HP ${prev.currentHp}→${newHp}`
          : `Healed ${absDelta} HP · HP ${prev.currentHp}→${newHp}`;
        setCombatLogEntries((ent) => [
          ...ent,
          { id: generateId(), timestamp: Date.now(), sessionId: sessId, type, description: desc, source },
        ]);
      }
      const stats = prev.statistics ?? { killCount: 0, totalGoldEarned: 0, lootItemsAdded: 0, nearDeaths: 0, totalHpHealed: 0, totalDamageTaken: 0 };
      const wasSafe = prev.currentHp > 5;
      const isNearDeath = newHp <= 5 && newHp > 0;
      const nearDeathInc = wasSafe && isNearDeath ? 1 : 0;
      const damageInc = actualDelta < 0 ? Math.abs(actualDelta) : 0;
      const healInc    = actualDelta > 0 ? actualDelta : 0;

      const transitionedToZero = prev.currentHp > 0 && newHp === 0;
      const recoveredFromZero = prev.currentHp === 0 && newHp > 0;
      const tookDamageWhileDowned = prev.currentHp === 0 && actualDelta < 0;

      if (transitionedToZero) {
        setConditions((priorConditions) => {
          if (hasConditionNamed(priorConditions, "Unconscious")) return priorConditions;
          return [
            ...priorConditions,
            {
              id: generateId(),
              name: "Unconscious",
              source: "0 HP lifecycle",
              removeOn: ["manual"],
              notes: "Auto-applied at 0 HP.",
            },
          ];
        });
      }

      if (recoveredFromZero) {
        setConditions((priorConditions) => priorConditions.filter((condition) => condition.name.trim().toLowerCase() !== "unconscious"));
      }

      const nextDeathSaves = computeDeathSaveStateAfterHpChange({
        previous: prev.deathSaves,
        prevHp: prev.currentHp,
        nextHp: newHp,
        tookDamageWhileDowned,
      });

      return {
        ...prev,
        currentHp: newHp,
        deathSaves: nextDeathSaves,
        statistics: {
          ...stats,
          nearDeaths: stats.nearDeaths + nearDeathInc,
          totalDamageTaken: stats.totalDamageTaken + damageInc,
          totalHpHealed: stats.totalHpHealed + healInc,
        },
      };
    });

    if (blockedDeadHealing) {
      showStatusPill("Character is dead. Healing is blocked in this workflow until an explicit out-of-band recovery path is used.", "negative");
    }
  }, [combatLogSessions, showStatusPill]);

  const updateTempHp = useCallback((value: number) => {
    setCharacter((prev) => ({ ...prev, tempHp: Math.max(0, value) }));
  }, []);

  const recordDeathSave = useCallback((outcome: "success" | "failure") => {
    let didRecord = false;
    let nextState = resetDeathSaveState();

    setCharacter((prev) => {
      if (prev.currentHp !== 0) return prev;

      const currentState = normalizeDeathSaveState(prev.deathSaves);
      const computedState = recordDeathSaveOutcome({ previous: prev.deathSaves, outcome });
      if (
        computedState.successes === currentState.successes
        && computedState.failures === currentState.failures
        && computedState.stable === currentState.stable
      ) {
        return prev;
      }

      didRecord = true;
      nextState = computedState;
      return {
        ...prev,
        deathSaves: computedState,
      };
    });

    if (!didRecord) return;

    if (outcome === "success") {
      showStatusPill(
        nextState.stable
          ? "Death save success recorded. Character is now stable."
          : `Death save success recorded (${nextState.successes}/3).`,
        "positive"
      );
      return;
    }

    showStatusPill(
      nextState.dead
        ? "Death save failure recorded (3/3). Character is now dead."
        : `Death save failure recorded (${nextState.failures}/3).`,
      "negative"
    );
  }, [showStatusPill]);

  const recordDeathSaveSuccess = useCallback(() => {
    recordDeathSave("success");
  }, [recordDeathSave]);

  const recordDeathSaveFailure = useCallback(() => {
    recordDeathSave("failure");
  }, [recordDeathSave]);

  const stabilizeAtZeroHp = useCallback(() => {
    let didStabilize = false;

    setCharacter((prev) => {
      if (prev.currentHp !== 0) return prev;

      const currentState = normalizeDeathSaveState(prev.deathSaves);
      const nextState = stabilizeDeathSaveState(prev.deathSaves);
      if (
        nextState.successes === currentState.successes
        && nextState.failures === currentState.failures
        && nextState.stable === currentState.stable
      ) {
        return prev;
      }

      didStabilize = true;
      return {
        ...prev,
        deathSaves: nextState,
      };
    });

    if (!didStabilize) return;

    setConditions((priorConditions) => {
      if (hasConditionNamed(priorConditions, "Unconscious")) return priorConditions;
      return [
        ...priorConditions,
        {
          id: generateId(),
          name: "Unconscious",
          source: "0 HP lifecycle",
          removeOn: ["manual"],
          notes: "Auto-applied at 0 HP.",
        },
      ];
    });

    showStatusPill("Character stabilized at 0 HP.", "neutral");
  }, [showStatusPill]);

  const resetDeathSaveTracking = useCallback(() => {
    let didReset = false;

    setCharacter((prev) => {
      const currentState = normalizeDeathSaveState(prev.deathSaves);
      if (
        currentState.successes === 0
        && currentState.failures === 0
        && currentState.stable === false
      ) {
        return prev;
      }

      didReset = true;
      return {
        ...prev,
        deathSaves: resetDeathSaveState(),
      };
    });

    if (didReset) {
      showStatusPill("Death save tracking reset.", "neutral");
    }
  }, [showStatusPill]);

  const updateNotes = useCallback((notes: string) => {
    setCharacter((prev) => ({ ...prev, notes }));
  }, []);

  const updateCurrency = useCallback((change: ProposedCurrencyChange) => {
    const summary = formatCurrencyDelta(change);
    setCharacter((prev) => {
      const earned =
        Math.max(0, change.gp ?? 0) +
        Math.max(0, change.pp ?? 0) * 10 +
        Math.max(0, change.ep ?? 0) * 0.5 +
        Math.max(0, change.sp ?? 0) * 0.1 +
        Math.max(0, change.cp ?? 0) * 0.01;
      const stats = prev.statistics ?? { killCount: 0, totalGoldEarned: 0, lootItemsAdded: 0, nearDeaths: 0, totalHpHealed: 0, totalDamageTaken: 0 };
      return {
        ...prev,
        currency: {
          cp: Math.max(0, prev.currency.cp + (change.cp ?? 0)),
          sp: Math.max(0, prev.currency.sp + (change.sp ?? 0)),
          ep: Math.max(0, prev.currency.ep + (change.ep ?? 0)),
          gp: Math.max(0, prev.currency.gp + (change.gp ?? 0)),
          pp: Math.max(0, prev.currency.pp + (change.pp ?? 0)),
        },
        statistics: { ...stats, totalGoldEarned: Math.round((stats.totalGoldEarned + earned) * 100) / 100 },
      };
    });
    if (summary) {
      const gainedTotal = (change.gp ?? 0) + (change.sp ?? 0) + (change.cp ?? 0) + (change.ep ?? 0) + (change.pp ?? 0);
      showStatusPill(`Currency update: ${summary}`, gainedTotal >= 0 ? "positive" : "negative");
    }
  }, [showStatusPill]);

  const incrementResource = useCallback((id: string, effectiveMax?: number) => {
    setResources((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, current: Math.min(effectiveMax ?? r.max, r.current + 1) } : r
      )
    );
  }, []);

  const decrementResource = useCallback((id: string) => {
    setResources((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, current: Math.max(0, r.current - 1) } : r
      )
    );
  }, []);

  const resetResource = useCallback((id: string, effectiveMax?: number) => {
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, current: effectiveMax ?? r.max } : r))
    );
  }, []);

  const addResource = useCallback((resource: Omit<Resource, "id">) => {
    setResources((prev) => [...prev, { ...resource, id: generateId() }]);
  }, []);

  const upsertResourceByName = useCallback((name: string, updates: Partial<Omit<Resource, "id">>) => {
    setResources((prev) => {
      const lower = name.toLowerCase();
      const idx = prev.findIndex((r) => r.name.toLowerCase() === lower);
      if (idx >= 0) {
        const existing = prev[idx];
        const newMax = updates.max ?? existing.max;
        const updated = { ...existing, ...updates, max: newMax, current: Math.min(existing.current, newMax) };
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
      }
      return [...prev, { id: generateId(), name, current: updates.max ?? 0, max: updates.max ?? 0, resetOn: "short_rest", ...updates }];
    });
  }, []);

  const applyResourceChanges = useCallback((changes: ProposedResourceChange[], source: "manual" | "ai" = "manual") => {
    const sessId = combatLogSessions[combatLogSessions.length - 1]?.id ?? "default";
    setResources((prev) => {
      const next = prev.map((r) => {
        const change = changes.find((c) => c.resourceId === r.id);
        if (!change) return r;
        const newCurrent = Math.min(r.max, Math.max(0, r.current + change.delta));
        const actualDelta = newCurrent - r.current;
        if (actualDelta !== 0) {
          const type = actualDelta < 0 ? "resource_spend" : "resource_restore";
          const desc = actualDelta < 0
            ? `Spent ${Math.abs(actualDelta)} ${r.name} · ${r.current}→${newCurrent}`
            : `Restored ${actualDelta} ${r.name} · ${r.current}→${newCurrent}`;
          setCombatLogEntries((ent) => [
            ...ent,
            { id: generateId(), timestamp: Date.now(), sessionId: sessId, type, description: desc, source },
          ]);
        }
        return { ...r, current: newCurrent };
      });
      return next;
    });
  }, [combatLogSessions]);

  const useSpellEffect = useCallback((effectId: string) => {
    setSpellEffectUses((prev) => {
      let maxUses = 1;
      for (const item of inventory) {
        if (!item.equipped) continue;
        const effects = getRuntimeItemProjectedEffects(item);
        const eff = effects.find((e) => e.id === effectId);
        if (eff?.type === "spell" && eff.uses) { maxUses = eff.uses; break; }
      }
      const current = prev[effectId] ?? maxUses;
      if (current <= 0) return prev;
      return { ...prev, [effectId]: current - 1 };
    });
  }, [inventory]);

  const rechargeSpellEffects = useCallback((resetOn: "short_rest" | "long_rest" | "dawn") => {
    setSpellEffectUses((prev) => {
      const next = { ...prev };
      for (const item of inventory) {
        if (!item.equipped) continue;
        for (const eff of getRuntimeItemProjectedEffects(item)) {
          if (eff.type !== "spell" || !eff.uses) continue;
          const effResetOn = eff.resetOn ?? "long_rest";
          if (resetOn === "long_rest" || effResetOn === resetOn) {
            next[eff.id] = eff.uses;
          }
        }
      }
      return next;
    });
  }, [inventory]);

  const useItemEffect = useCallback((effectId: string) => {
    setItemActionUses((prev) => {
      let maxUses = 1;
      for (const item of inventory) {
        if (!item.equipped) continue;
        const effects = getRuntimeItemProjectedEffects(item);
        const eff = effects.find((e) => e.id === effectId);
        if (eff && eff.type !== "spell" && eff.uses) { maxUses = eff.uses; break; }
      }
      const current = prev[effectId] ?? maxUses;
      if (current <= 0) return prev;
      return { ...prev, [effectId]: current - 1 };
    });
  }, [inventory]);

  const rechargeItemEffects = useCallback((resetOn: "short_rest" | "long_rest" | "dawn") => {
    setItemActionUses((prev) => {
      const next = { ...prev };
      for (const item of inventory) {
        if (!item.equipped) continue;
        for (const eff of getRuntimeItemProjectedEffects(item)) {
          if (eff.type === "spell" || !eff.uses) continue;
          const effResetOn = eff.resetOn ?? "long_rest";
          if (resetOn === "long_rest" || effResetOn === resetOn) {
            next[eff.id] = eff.uses;
          }
        }
      }
      return next;
    });
  }, [inventory]);

  const addCondition = useCallback((cond: Omit<ActiveCondition, "id">, source: "manual" | "ai" = "manual") => {
    const sessId = combatLogSessions[combatLogSessions.length - 1]?.id ?? "default";
    setConditions((prev) => {
      if (prev.some((c) => c.name.toLowerCase() === cond.name.toLowerCase())) return prev;
      setCombatLogEntries((ent) => [
        ...ent,
        { id: generateId(), timestamp: Date.now(), sessionId: sessId, type: "condition_add", description: `Condition added: ${cond.name}`, source },
      ]);
      showStatusPill(`Condition gained: ${cond.name}`, "positive");
      return [...prev, { ...cond, id: generateId() }];
    });
  }, [combatLogSessions, showStatusPill]);

  const removeCondition = useCallback((id: string) => {
    const sessId = combatLogSessions[combatLogSessions.length - 1]?.id ?? "default";
    setConditions((prev) => {
      const cond = prev.find((c) => c.id === id);
      if (cond) {
        setCombatLogEntries((ent) => [
          ...ent,
          { id: generateId(), timestamp: Date.now(), sessionId: sessId, type: "condition_remove", description: `Condition removed: ${cond.name}`, source: "manual" },
        ]);
        showStatusPill(`Condition removed: ${cond.name}`, "negative");
      }
      return prev.filter((c) => c.id !== id);
    });
  }, [combatLogSessions, showStatusPill]);

  const applyConditionChanges = useCallback((changes: ProposedConditionChange[], source: "manual" | "ai" = "manual") => {
    const sessId = combatLogSessions[combatLogSessions.length - 1]?.id ?? "default";
    setConditions((prev) => {
      let next = [...prev];
      for (const change of changes) {
        if (change.action === "add") {
          const alreadyActive = next.some((c) => c.name.toLowerCase() === change.name.toLowerCase());
          if (!alreadyActive) {
            const info = getConditionInfo(change.name);
            next.push({
              id: generateId(),
              name: change.name,
              source: change.source,
              removeOn: change.removeOn.length > 0 ? change.removeOn : info.defaultRemoveOn,
              notes: change.notes,
            });
            setCombatLogEntries((ent) => [
              ...ent,
              { id: generateId(), timestamp: Date.now(), sessionId: sessId, type: "condition_add", description: `Condition added: ${change.name}`, source },
            ]);
            showStatusPill(`Condition gained: ${change.name}`, "positive");
          }
        } else {
          const wasActive = next.some((c) => c.name.toLowerCase() === change.name.toLowerCase());
          if (wasActive) {
            setCombatLogEntries((ent) => [
              ...ent,
              { id: generateId(), timestamp: Date.now(), sessionId: sessId, type: "condition_remove", description: `Condition removed: ${change.name}`, source },
            ]);
            showStatusPill(`Condition removed: ${change.name}`, "negative");
          }
          next = next.filter((c) => c.name.toLowerCase() !== change.name.toLowerCase());
        }
      }
      return next;
    });
  }, [combatLogSessions, showStatusPill]);

  const clearConditionsOnRest = useCallback((restType: "short_rest" | "long_rest") => {
    const durMap: Record<"short_rest" | "long_rest", ConditionDurationType> = {
      short_rest: "untilShortRest",
      long_rest: "untilLongRest",
    };
    setConditions((prev) =>
      prev.filter(
        (c) => !c.removeOn.includes(restType) && c.durationType !== durMap[restType]
      )
    );
  }, []);

  const tickConditions = useCallback((timing: "onTargetTurnEnd" | "onRoundAdvance") => {
    const sessId = combatLogSessions[combatLogSessions.length - 1]?.id ?? "default";
    setConditions((prev) => {
      const next: ActiveCondition[] = [];
      for (const cond of prev) {
        // Check if this tick type should process this condition's countdown
        const matchTiming =
          (timing === "onTargetTurnEnd" && (!cond.tickTiming || cond.tickTiming === "onTargetTurnEnd")) ||
          (timing === "onRoundAdvance" && cond.tickTiming === "onRoundAdvance");

        if (!matchTiming) {
          next.push(cond);
          continue;
        }

        // Normalize duration to ensure it's safe to process
        const normalized = normalizeConditionDuration(cond);

        // Only decrement and potentially expire if this is a timed condition
        if (
          normalized.durationType !== "manual" &&
          normalized.durationType !== "permanent" &&
          normalized.durationType !== "concentration" &&
          normalized.remainingDuration !== undefined
        ) {
          const { condition: decremented, expired } = decrementConditionDuration(normalized);
          if (expired) {
            setCombatLogEntries((ent) => [
              ...ent,
              {
                id: generateId(),
                timestamp: Date.now(),
                sessionId: sessId,
                type: "condition_remove",
                description: `${decremented.name} expired (${normalized.durationType} duration ended)`,
                source: "manual" as const,
              },
            ]);
            // Condition expired — don't push to next
          } else {
            next.push(decremented);
          }
        } else {
          // Manual, permanent, or concentration conditions don't tick down
          next.push(normalized);
        }
      }
      return next;
    });
  }, [combatLogSessions]);

  const decrementCondition = useCallback((id: string) => {
    const sessId = combatLogSessions[combatLogSessions.length - 1]?.id ?? "default";
    setConditions((prev) => {
      const cond = prev.find((c) => c.id === id);
      if (!cond || cond.remainingDuration === undefined) return prev;
      const newRemaining = cond.remainingDuration - 1;
      if (newRemaining <= 0) {
        setCombatLogEntries((ent) => [
          ...ent,
          { id: generateId(), timestamp: Date.now(), sessionId: sessId, type: "condition_remove", description: `${cond.name} expired`, source: "manual" as const },
        ]);
        return prev.filter((c) => c.id !== id);
      }
      return prev.map((c) => c.id === id ? { ...c, remainingDuration: newRemaining } : c);
    });
  }, [combatLogSessions]);

  const setConditionDuration = useCallback((id: string, durationType: ConditionDurationType, value?: number) => {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        // Use safe initialization helper (Phase B3)
        const cond = { ...c };
        if (durationType === "manual" || durationType === "permanent") {
          return { ...cond, durationType };
        }
        const duration = value ?? 1;
        if (duration <= 0) return cond;
        return {
          ...cond,
          durationType,
          durationValue: duration,
          remainingDuration: duration,
          tickTiming: cond.tickTiming ?? "onTargetTurnEnd",
        };
      })
    );
  }, []);

  // Phase D: remove all ActiveCondition entries linked to a concentration spell when it breaks.
  const removeConditionsByConcentrationLink = useCallback((spellId: string) => {
    const sessId = combatLogSessions[combatLogSessions.length - 1]?.id ?? "default";
    setConditions((prev) => {
      const toRemove = prev.filter((c) => c.concentrationLink === spellId);
      if (toRemove.length === 0) return prev;
      for (const cond of toRemove) {
        setCombatLogEntries((ent) => [
          ...ent,
          {
            id: generateId(),
            timestamp: Date.now(),
            sessionId: sessId,
            type: "condition_remove" as const,
            description: `${cond.name} removed (concentration broken)`,
            source: "manual" as const,
          },
        ]);
      }
      return prev.filter((c) => c.concentrationLink !== spellId);
    });
  }, [combatLogSessions]);

  const expendSpellSlot = useCallback((level: number) => {
    setSpellSlots((prev) =>
      prev.map((s) =>
        s.level === level && s.used < s.total ? { ...s, used: s.used + 1 } : s
      )
    );
  }, []);

  const restoreSpellSlot = useCallback((level: number) => {
    setSpellSlots((prev) =>
      prev.map((s) =>
        s.level === level && s.used > 0 ? { ...s, used: s.used - 1 } : s
      )
    );
  }, []);

  const restoreAllSpellSlots = useCallback(() => {
    setSpellSlots((prev) => prev.map((s) => ({ ...s, used: 0 })));
  }, []);

  const updateSpellSlotTotal = useCallback((level: number, total: number) => {
    setSpellSlots((prev) => {
      const exists = prev.find((s) => s.level === level);
      if (exists) {
        return prev.map((s) =>
          s.level === level ? { ...s, total, used: Math.min(s.used, total) } : s
        );
      }
      const next = [...prev, { level, total, used: 0 }];
      return next.sort((a, b) => a.level - b.level);
    });
  }, []);

  const addAttack = useCallback((attack: Omit<Attack, "id">) => {
    setAttacks((prev) => [...prev, { ...attack, id: generateId() }]);
  }, []);

  const updateAttack = useCallback((id: string, updates: Partial<Attack>) => {
    setAttacks((prev) =>
      prev.map((atk) => (atk.id === id ? { ...atk, ...updates } : atk))
    );
  }, []);

  const removeAttack = useCallback((id: string) => {
    setAttacks((prev) => prev.filter((atk) => atk.id !== id));
  }, []);

  const addCompanion = useCallback(
    (companionData: Omit<Companion, "id" | "createdAt" | "updatedAt">) => {
      const id = generateId();
      const now = Date.now();
      const newCompanion: Companion = {
        ...companionData,
        id,
        createdAt: now,
        updatedAt: now,
      };
      setCompanions((prev) => [...prev, newCompanion]);
      showStatusPill(`Companion added: ${companionData.name}`, "positive");
    },
    [showStatusPill]
  );

  const updateCompanion = useCallback(
    (id: string, updates: Partial<Omit<Companion, "id" | "characterId" | "createdAt">>) => {
      setCompanions((prev) =>
        prev.map((companion) => {
          if (companion.id !== id) return companion;
          return {
            ...companion,
            ...updates,
            updatedAt: Date.now(),
          };
        })
      );
    },
    []
  );

  const deleteCompanion = useCallback((id: string) => {
    setCompanions((prev) => prev.filter((companion) => companion.id !== id));
    showStatusPill("Companion removed", "neutral");
  }, [showStatusPill]);

  const addCompanionFromMonster = useCallback(
    (monster: CompendiumMonster) => {
      const companion: Omit<Companion, "id" | "createdAt" | "updatedAt"> = {
        characterId: character.id,
        name: monster.name,
        type: monster.type,
        size: monster.size,
        alignment: monster.alignment,
        armor_class: monster.armor_class,
        hit_points: monster.hit_points,
        max_hit_points: monster.hit_points,
        hit_dice: monster.hit_dice ?? "1d8",
        speed: monster.speed,
        strength: monster.strength,
        dexterity: monster.dexterity,
        constitution: monster.constitution,
        intelligence: monster.intelligence,
        wisdom: monster.wisdom,
        charisma: monster.charisma,
        challenge_rating: monster.challenge_rating,
        actions: monster.actions,
        special_abilities: monster.special_abilities,
        notes: `Summoned from ${monster.name} (CR ${monster.challenge_rating})`,
      };
      addCompanion(companion);
    },
    [character.id, addCompanion]
  );

  const addItem = useCallback((item: Omit<InventoryItem, "id">) => {
    const sanitized: Omit<InventoryItem, "id"> = {
      ...item,
      equipped: isEquippableCategory(item.category) ? item.equipped : false,
      sourceTag: item.sourceTag ?? "custom",
    };
    setInventory((prev) => {
      const withId: InventoryItem = { ...sanitized, id: generateId() };
      const next = [...prev, normalizeRuntimeInventoryItem(withId)];
      return normalizeInventoryEquipment(next, withId.equipped ? withId.id : undefined).inventory;
    });
    setCharacter((prev) => {
      const stats = prev.statistics ?? { killCount: 0, totalGoldEarned: 0, lootItemsAdded: 0, nearDeaths: 0, totalHpHealed: 0, totalDamageTaken: 0 };
      return { ...prev, statistics: { ...stats, lootItemsAdded: stats.lootItemsAdded + 1 } };
    });
    showStatusPill(`Item gained: ${item.quantity}x ${item.name}`, "positive");
  }, [normalizeInventoryEquipment, showStatusPill]);

  const removeItem = useCallback((id: string) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<InventoryItem>) => {
    setInventory((prev) => {
      const existing = prev.find((item) => item.id === id);
      if (
        existing &&
        existing.category === "consumable" &&
        typeof updates.quantity === "number" &&
        updates.quantity < existing.quantity
      ) {
        triggerEffect("potion");
      }
      const next = prev.map((item) => {
        if (item.id !== id) return item;
        const merged = { ...item, ...updates };
        if (!isEquippableCategory(merged.category)) {
          return normalizeRuntimeInventoryItem({ ...merged, equipped: false });
        }
        return normalizeRuntimeInventoryItem(merged);
      });

      const preferUpdatedItem = updates.equipped === true ? id : undefined;
      return normalizeInventoryEquipment(next, preferUpdatedItem).inventory;
    });
  }, [normalizeInventoryEquipment]);

  const dispatchRuleTrigger = useCallback((currentAction: string, item?: InventoryItem) => {
    if (!getFeatureFlag("rulesEngineV1")) return;

    const activeRuleSet = getActiveRules({
      character,
      currentAction,
      item,
      includeDemoFallback: true,
    });

    const compiled = compileRules(activeRuleSet.rules);
    if (compiled.compiled.length === 0) return;

    const results = evaluateRules(compiled.compiled, {
      character,
      item,
      currentAction,
    });

    const appliedEffects = results
      .flatMap((r) => r.effects)
      .map((eff) => ({
        id: eff.id,
        ruleId: eff.ruleId,
        effectType: eff.effectDefinition.type,
        label: eff.effectDefinition.label,
        statKey: eff.effectDefinition.statKey,
        statValue: eff.effectDefinition.statValue,
        actionName: eff.effectDefinition.actionName,
        resourceId: eff.effectDefinition.resourceId,
        resourceName: eff.effectDefinition.resourceName,
        amount: eff.effectDefinition.amount,
        actionType: eff.effectDefinition.actionType,
        spellId: eff.effectDefinition.spellId,
        spellName: eff.effectDefinition.spellName,
        conditionName: eff.effectDefinition.conditionName,
        lifetime: eff.lifetime,
        linkedEntity: eff.linkedEntity,
        appliedAt: eff.appliedAt,
      }));

    const activeProvenances = results
      .filter((r) => r.applied)
      .map((r) => ({
        ruleId: r.ruleId,
        ruleName: activeRuleSet.byId[r.ruleId]?.name ?? r.ruleId,
        trigger: currentAction,
        condition: r.trace?.condition ? "true" : (r.trace?.conditionReason ?? "false"),
        appliedEffectIds: r.effects.map((eff) => eff.id),
      }));

    setRulesState((prevState) => ({
      ...prevState,
      appliedEffects,
      activeProvenances,
    }));

    // Apply resource effects via existing resource state (non-destructive, additive path)
    setResources((prev) => {
      const next = [...prev];
      for (const result of results) {
        if (!result.applied) continue;
        for (const applied of result.effects) {
          const effect = applied.effectDefinition;
          if (effect.type !== "restore_resource" && effect.type !== "consume_resource") continue;
          const amount = Math.max(0, effect.amount ?? 0);
          if (amount === 0) continue;

          const delta = effect.type === "consume_resource" ? -amount : amount;
          const idx = next.findIndex((res) =>
            effect.resourceId ? res.id === effect.resourceId :
              effect.resourceName ? res.name.toLowerCase() === effect.resourceName.toLowerCase() : false
          );
          if (idx < 0) continue;

          const target = next[idx];
          const updatedCurrent = Math.max(0, Math.min(target.max, target.current + delta));
          next[idx] = { ...target, current: updatedCurrent };
        }
      }
      return next;
    });

    // Apply condition effects via condition state (add/remove by canonical condition name)
    setConditions((prev) => {
      let next = [...prev];
      for (const result of results) {
        if (!result.applied) continue;
        for (const applied of result.effects) {
          const effect = applied.effectDefinition;
          const conditionName = effect.conditionName?.trim();
          if (!conditionName) continue;

          if (effect.type === "add_condition") {
            const alreadyActive = next.some((c) => c.name.toLowerCase() === conditionName.toLowerCase());
            if (!alreadyActive) {
              next.push({
                id: generateId(),
                name: conditionName,
                source: `rule:${result.ruleId}`,
                removeOn: effect.removeOn ?? ["manual"],
                durationType: effect.durationRounds ? "rounds" : "manual",
                durationValue: effect.durationRounds,
                remainingDuration: effect.durationRounds,
                notes: effect.description,
              });
            }
          }

          if (effect.type === "remove_condition") {
            next = next.filter((c) => c.name.toLowerCase() !== conditionName.toLowerCase());
          }
        }
      }
      return next;
    });

    // Apply action effects into class features so Actions tab can render them.
    setClassFeaturesState((prev) => {
      let next = [...prev];
      for (const result of results) {
        if (!result.applied) continue;
        for (const applied of result.effects) {
          const effect = applied.effectDefinition;
          const actionName = (effect.actionName ?? effect.label ?? "").trim();
          if (!actionName) continue;
          if (!effect.actionType) continue;

          const featureId = makeRuleFeatureId(result.ruleId, effect.actionType, actionName);

          if (effect.type === "add_action") {
            const existing = next.find((f) => f.id === featureId);
            if (!existing) {
              next.push({
                id: featureId,
                name: actionName,
                description: effect.description ?? `Granted by rule: ${result.ruleId}`,
                actionType: effect.actionType,
                source: `rule:${result.ruleId}`,
                originKind: "rules_generated",
                explanation: `Rules runtime added action from ${result.ruleId} on trigger '${currentAction}'.`,
              });
            }
          }

          if (effect.type === "remove_action") {
            next = next.filter((f) => f.id !== featureId);
          }
        }
      }
      return next;
    });

    // Apply spell effects to prepared spells with deterministic IDs for idempotency.
    setPreparedSpells((prev) => {
      let next = [...prev];
      for (const result of results) {
        if (!result.applied) continue;
        for (const applied of result.effects) {
          const effect = applied.effectDefinition;
          const spellName = (effect.spellName ?? effect.label ?? "").trim();
          if (!spellName) continue;
          const spellId = makeRuleSpellId(result.ruleId, spellName);

          if (effect.type === "grant_spell") {
            const exists = next.some((s) => s.id === spellId);
            if (!exists) {
              next.push({
                id: spellId,
                name: spellName,
                level: 0,
                prepared: true,
                description: effect.description,
                createdAt: Date.now(),
              });
            }
          }

          if (effect.type === "revoke_spell") {
            next = next.filter((s) => s.id !== spellId);
          }
        }
      }
      return next;
    });
  }, [character]);

  const toggleEquipped = useCallback((id: string) => {
    let actionType: "equip_item" | "unequip_item" = "equip_item";
    let evaluatedItem: InventoryItem | undefined;
    let autoUnequippedNames: string[] = [];

    setInventory((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      if (!isEquippableCategory(item.category)) return prev;
      actionType = item.equipped ? "unequip_item" : "equip_item";

      if (item.equipped) {
        const unequippedItem = normalizeRuntimeInventoryItem({ ...item, equipped: false });
        const withoutTarget = prev.filter((entry) => entry.id !== id);
        const mergedResult = mergeInventoryItemIntoMatchingUnequippedStack(withoutTarget, unequippedItem);
        const nextInventory = mergedResult.inventory.map((entry) => normalizeRuntimeInventoryItem(entry));
        evaluatedItem = nextInventory.find((entry) => entry.id === mergedResult.mergedIntoId);
        return nextInventory;
      }

      let preferredItemId = id;
      const intendedInventory = item.quantity > 1
        ? (() => {
            const splitResult = splitInventoryStackForEquip(prev, id, generateId());
            preferredItemId = splitResult.equippedItemId;
            return splitResult.inventory;
          })()
        : prev.map((entry) =>
            entry.id === id ? normalizeRuntimeInventoryItem({ ...entry, equipped: true }) : entry
          );

      const normalizationResult = normalizeInventoryEquipment(intendedInventory, preferredItemId);
      const autoUnequippedIds = normalizationResult.autoUnequippedIds.filter((unequippedId) => unequippedId !== preferredItemId);
      if (autoUnequippedIds.length > 0) {
        const byId = new Map(prev.map((entry) => [entry.id, entry.name] as const));
        autoUnequippedNames = autoUnequippedIds
          .map((unequippedId) => byId.get(unequippedId) ?? "Unknown item");
      }

      const nextInventory = normalizationResult.inventory.map((entry) => normalizeRuntimeInventoryItem(entry));
      evaluatedItem = nextInventory.find((entry) => entry.id === preferredItemId);

      return nextInventory;
    });

    if (actionType === "equip_item" && autoUnequippedNames.length > 0) {
      const listed = autoUnequippedNames.slice(0, 2).join(", ");
      const suffix = autoUnequippedNames.length > 2 ? ", ..." : "";
      showStatusPill(`Adjusted equipment slots: unequipped ${listed}${suffix}.`, "neutral");
    }

    dispatchRuleTrigger(actionType, evaluatedItem);
  }, [dispatchRuleTrigger, normalizeInventoryEquipment, showStatusPill]);

  const splitStackItem = useCallback((id: string, splitQty: number) => {
    setInventory((prev) => {
      const result = splitInventoryStack(prev, id, splitQty, generateId());
      if (!result) return prev;
      return result.inventory;
    });
  }, []);

  const mergeStackItem = useCallback((id: string) => {
    setInventory((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (!item || item.equipped) return prev;

      const sourceStackKey = buildInventoryStackKey({ ...item, equipped: false });
      const matchingIds = new Set(
        prev
          .filter((entry) => (
            !entry.equipped
            && buildInventoryStackKey({ ...entry, equipped: false }) === sourceStackKey
          ))
          .map((entry) => entry.id),
      );
      if (matchingIds.size <= 1) return prev;

      const mergedQuantity = prev.reduce((total, entry) => (
        matchingIds.has(entry.id) ? total + Math.max(1, entry.quantity) : total
      ), 0);

      const next = prev.flatMap((entry) => {
        if (!matchingIds.has(entry.id)) return [entry];
        if (entry.id !== id) return [];
        return [{ ...entry, quantity: mergedQuantity, equipped: false }];
      });

      return next.map((entry) => normalizeRuntimeInventoryItem(entry));
    });
  }, []);

  const applyProposedItems = useCallback((proposed: ProposedInventoryItem[]) => {
    let gainedCount = 0;
    let removedCount = 0;
    let skipped = false;
    const gainedNames: string[] = [];
    setInventory((prev) => {
      const updated = [...prev];
      for (const p of proposed) {
        if (!Number.isSafeInteger(p.quantity) || p.quantity === 0) { skipped = true; continue; }
        if (p.quantity < 0) {
          // A name-only removal cannot choose between distinct variants.
          const matches = updated.filter(i => i.name.toLowerCase() === p.name.toLowerCase());
          if (matches.length !== 1) { skipped = true; continue; }
          removedCount += Math.abs(p.quantity);
          const existingIndex = updated.findIndex(
            (i) => i.name.toLowerCase() === p.name.toLowerCase()
          );
          if (existingIndex >= 0) {
            const existing = updated[existingIndex];
            const newQty = existing.quantity + p.quantity;
            if (newQty <= 0) updated.splice(existingIndex, 1);
            else updated[existingIndex] = { ...existing, quantity: newQty };
          }
        } else {
          const candidate = normalizeRuntimeInventoryItem({
              id: generateId(),
              name: p.name,
              pinned: false,
              quantity: p.quantity,
              equipped: false,
              category: p.category,
              value: p.value,
              weight: p.weight,
              subtype: p.subtype,
              useAbilityModifierForDamage: p.useAbilityModifierForDamage,
              notes: p.notes,
              sourceTag: p.sourceTag ?? (p.officialMatch ? "official" : "custom"),
              attackAbility: p.attackAbility,
              isProficient: p.isProficient,
              damageDice: p.damageDice,
              damageModifier: p.damageModifier,
              damageType: p.damageType,
              additionalDamage: p.additionalDamage,
              weaponRange: p.weaponRange,
              equippedEffects: p.equippedEffects,
              tags: p.tags && p.tags.length > 0 ? p.tags : undefined,
              mechanics: p.mechanics,
          });
          const key = buildInventoryStackKey(candidate);
          const existingIndex = updated.findIndex(i => !i.equipped && buildInventoryStackKey(i) === key);
          if (existingIndex >= 0) {
            const quantity = updated[existingIndex].quantity + p.quantity;
            if (!Number.isSafeInteger(quantity)) { skipped = true; continue; }
            updated[existingIndex] = { ...updated[existingIndex], quantity };
          } else {
            updated.push(candidate);
          }
          gainedCount += p.quantity;
          gainedNames.push(p.name);
        }
      }
      return updated;
    });
    if (skipped) {
      showStatusPill("Some item changes were skipped: invalid quantity or ambiguous item. Review inventory manually.", "neutral");
    } else if (gainedCount > 0) {
      const uniqueNames = [...new Set(gainedNames)].slice(0, 3);
      const suffix = uniqueNames.length > 0 ? ` (${uniqueNames.join(", ")}${gainedNames.length > uniqueNames.length ? ", ..." : ""})` : "";
      showStatusPill(`Loot gained: ${gainedCount} item${gainedCount === 1 ? "" : "s"}${suffix}`, "positive");
    } else if (removedCount > 0) {
      showStatusPill(`Inventory updated: ${removedCount} item${removedCount === 1 ? "" : "s"} removed`, "neutral");
    }
  }, [showStatusPill]);

  const applyHpChange = useCallback((change: ProposedHpChange, source: "manual" | "ai" = "manual") => {
    updateHp(change.delta, source);
  }, [updateHp]);

  const applyResolvedLocalDamage = useCallback((result: CombatTargetResolutionResult, source: "manual" | "ai" = "manual") => {
    if (result.applyState !== "applied_local") return;
    if (!result.authority.canApplyLocally) return;
    const conditionResults = result.conditionResults ?? [];
    const breakdown = result.damageBreakdown;

    for (const conditionResult of conditionResults) {
      if (conditionResult.status !== "applied") continue;
      const conditionName = conditionResult.conditionName.trim();
      if (!conditionName) continue;
      const normalizedImmunities = new Set((character.conditionImmunities ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
      if (normalizedImmunities.has(conditionName.toLowerCase())) continue;

      const removeOn = conditionResult.durationHint?.saveEnds ? (["save", "manual"] as const) : (["manual"] as const);
      addCondition({
        name: conditionName,
        source: conditionResult.sourceName ?? conditionResult.sourceLabel,
        removeOn: [...removeOn],
        notes: conditionResult.reason,
        durationType: conditionResult.durationHint?.durationType,
        durationValue: conditionResult.durationHint?.durationValue,
        remainingDuration: conditionResult.durationHint?.durationValue,
        tickTiming: conditionResult.durationHint?.tickTiming,
        concentrationLink: conditionResult.concentrationLinked ? conditionResult.concentrationLinkId : undefined,
      }, source);
    }

    for (const conditionResult of conditionResults) {
      if (conditionResult.status !== "removed") continue;
      const normalizedName = conditionResult.conditionName.trim().toLowerCase();
      if (!normalizedName) continue;
      setConditions((prev) => prev.filter((cond) => cond.name.trim().toLowerCase() !== normalizedName));
    }

    if (!breakdown) return;

    const requestedTempAbsorbed = Math.max(0, Math.floor(breakdown.tempHpAbsorbed));
    const requestedHpDamage = Math.max(0, Math.floor(breakdown.hpDamage));
    const requestedHpHealing = Math.max(0, Math.floor(breakdown.hpHealing ?? 0));
    if (requestedTempAbsorbed <= 0 && requestedHpDamage <= 0 && requestedHpHealing <= 0) return;

    const sessId = combatLogSessions[combatLogSessions.length - 1]?.id ?? "default";

    setCharacter((prev) => {
      const prevTempHp = Math.max(0, prev.tempHp);
      const prevHp = Math.max(0, prev.currentHp);

      const hpMutation = applyLocalResolvedHpMutation({
        prevHp,
        maxHp: prev.maxHp,
        prevTempHp,
        requestedHpDamage,
        requestedHpHealing,
        requestedTempAbsorbed,
      });
      const {
        actualTempAbsorbed,
        nextTempHp,
        actualHpDamage,
        actualHpHealing,
        nextHp,
        changed,
      } = hpMutation;

      if (!changed) return prev;

      const targetLabel = result.targetType === "self" ? "self" : `${result.targetType}:${result.targetId}`;
      const summaryBits: string[] = [];
      if (actualHpDamage > 0) summaryBits.push(`HP -${actualHpDamage} (${prevHp}->${nextHp})`);
      if (actualHpHealing > 0) summaryBits.push(`HP +${actualHpHealing} (${prevHp}->${nextHp})`);
      if (actualTempAbsorbed > 0) summaryBits.push(`Temp -${actualTempAbsorbed} (${prevTempHp}->${nextTempHp})`);
      const hpLogType = actualHpDamage > actualHpHealing ? "hp_damage" : "hp_heal";

      setCombatLogEntries((ent) => [
        ...ent,
        {
          id: generateId(),
          timestamp: Date.now(),
          sessionId: sessId,
          type: hpLogType,
          description: `Resolver outcome applied to ${targetLabel} · ${summaryBits.join(" · ")}`,
          source,
        },
      ]);

      const stats = prev.statistics ?? {
        killCount: 0,
        totalGoldEarned: 0,
        lootItemsAdded: 0,
        nearDeaths: 0,
        totalHpHealed: 0,
        totalDamageTaken: 0,
      };
      const wasSafe = prevHp > 5;
      const isNearDeath = nextHp <= 5 && nextHp > 0;
      const nearDeathInc = wasSafe && isNearDeath ? 1 : 0;

      const transitionedToZero = prevHp > 0 && nextHp === 0;
      const recoveredFromZero = prevHp === 0 && nextHp > 0;
      const tookDamageWhileDowned = prevHp === 0 && actualHpDamage > 0;

      if (transitionedToZero) {
        setConditions((priorConditions) => {
          if (hasConditionNamed(priorConditions, "Unconscious")) return priorConditions;
          return [
            ...priorConditions,
            {
              id: generateId(),
              name: "Unconscious",
              source: "0 HP lifecycle",
              removeOn: ["manual"],
              notes: "Auto-applied at 0 HP.",
            },
          ];
        });
      }

      if (recoveredFromZero) {
        setConditions((priorConditions) => priorConditions.filter((condition) => condition.name.trim().toLowerCase() !== "unconscious"));
      }

      const nextDeathSaves = computeDeathSaveStateAfterHpChange({
        previous: prev.deathSaves,
        prevHp,
        nextHp,
        tookDamageWhileDowned,
      });

      return {
        ...prev,
        currentHp: nextHp,
        tempHp: nextTempHp,
        deathSaves: nextDeathSaves,
        statistics: {
          ...stats,
          nearDeaths: stats.nearDeaths + nearDeathInc,
          totalHpHealed: stats.totalHpHealed + actualHpHealing,
          totalDamageTaken: stats.totalDamageTaken + actualHpDamage,
        },
      };
    });
  }, [addCondition, character.conditionImmunities, combatLogSessions]);

  const addLogNote = useCallback((entryId: string, note: string) => {
    setCombatLogEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, userNote: note } : e))
    );
  }, []);

  const clearCombatLog = useCallback(() => {
    const newSession: SessionLog = { id: makeSessionId(), startedAt: Date.now(), label: `Session ${combatLogSessions.length + 1}` };
    setCombatLogEntries([]);
    setCombatLogSessions([newSession]);
  }, [combatLogSessions]);

  const startNewSession = useCallback((label?: string) => {
    const sessionNumber = combatLogSessions.length + 1;
    const newSession: SessionLog = {
      id: makeSessionId(),
      startedAt: Date.now(),
      label: label ?? `Session ${sessionNumber}`,
    };
    const sessId = newSession.id;
    setCombatLogSessions((prev) => [...prev, newSession]);
    setCombatLogEntries((prev) => [
      ...prev,
      { id: generateId(), timestamp: Date.now(), sessionId: sessId, type: "session_start", description: `Started ${newSession.label}`, source: "manual" },
    ]);
  }, [combatLogSessions]);

  const addClassFeature = useCallback((feature: Omit<ClassFeature, "id">) => {
    setClassFeaturesState((prev) => [...prev, { ...feature, id: generateId() }]);
  }, []);

  const updateClassFeature = useCallback((id: string, updates: Partial<Omit<ClassFeature, "id">>) => {
    setClassFeaturesState((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  const removeClassFeature = useCallback((id: string) => {
    setClassFeaturesState((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const setClassFeatures = useCallback((features: ClassFeature[]) => {
    setClassFeaturesState(features);
  }, []);

  const setPassiveFeatures = useCallback((features: ClassFeature[]) => {
    setPassiveFeaturesState(features);
  }, []);

  const addNote = useCallback((note: Omit<Note, "id" | "createdAt" | "updatedAt">) => {
    const now = Date.now();
    setNotes((prev) => [...prev, { ...note, id: generateId(), createdAt: now, updatedAt: now }]);
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Omit<Note, "id" | "createdAt">>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n))
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const pinNote = useCallback((id: string, pinned: boolean) => {
    setNotes((prev) =>
      prev.map((n) => n.id === id ? { ...n, pinned, updatedAt: Date.now() } : pinned ? { ...n, pinned: false } : n)
    );
  }, []);

  const addJournalArc = useCallback((arc: Omit<JournalArc, "id">) => {
    setJournalArcs((prev) => [...prev, { ...arc, id: generateId() }]);
  }, []);

  const updateJournalArc = useCallback((id: string, updates: Partial<Omit<JournalArc, "id">>) => {
    setJournalArcs((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, []);

  const removeJournalArc = useCallback((id: string) => {
    setJournalArcs((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const appendQuickEntry = useCallback((text: string, sessionNumber?: number) => {
    const now = Date.now();
    const firstLine = text.split("\n")[0].trim().slice(0, 60) || "Quick Entry";
    setNotes((prev) => [
      ...prev,
      {
        id: generateId(),
        title: firstLine,
        body: text,
        pinned: false,
        createdAt: now,
        updatedAt: now,
        ...(sessionNumber !== undefined ? { sessionNumber } : {}),
      },
    ]);
  }, []);

  const addWishlistItem = useCallback((item: Omit<WishlistItem, "id" | "createdAt" | "updatedAt">) => {
    const now = Date.now();
    setWishlist((prev) => [
      ...prev,
      {
        ...item,
        id: generateId(),
        status: item.status ?? "wanted",
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }, []);

  const updateWishlistItem = useCallback((id: string, updates: Partial<Omit<WishlistItem, "id" | "createdAt">>) => {
    setWishlist((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, ...updates, updatedAt: Date.now() }
          : entry
      )
    );
  }, []);

  const removeWishlistItem = useCallback((id: string) => {
    setWishlist((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const convertWishlistItemToInventory = useCallback((
    id: string,
    options?: { keepAsAcquired?: boolean; archiveAfterConvert?: boolean }
  ) => {
    const keepAsAcquired = options?.keepAsAcquired ?? true;
    const archiveAfterConvert = options?.archiveAfterConvert ?? false;

    setWishlist((prev) => {
      const entry = prev.find((w) => w.id === id);
      if (!entry) return prev;

      setInventory((invPrev) => [
        ...invPrev,
        {
          id: generateId(),
          name: entry.name,
          pinned: false,
          quantity: 1,
          equipped: false,
          category: entry.category ?? "gear",
          notes: entry.notes ? `[Wishlist] ${entry.notes}${entry.source ? `\nSource: ${entry.source}` : ""}` : (entry.source ? `Source: ${entry.source}` : undefined),
          tags: entry.rarityTarget ? [entry.rarityTarget] : undefined,
          sourceTag: "custom",
        },
      ]);

      if (!keepAsAcquired) {
        return prev.filter((w) => w.id !== id);
      }

      return prev.map((w) =>
        w.id === id
          ? {
              ...w,
              status: "acquired",
              archived: archiveAfterConvert ? true : w.archived,
              updatedAt: Date.now(),
            }
          : w
      );
    });
  }, []);

  const pinPerson = useCallback((id: string, pinned: boolean) => {
    setPeople((prev) => prev.map((p) => p.id === id ? { ...p, pinned } : pinned ? { ...p, pinned: false } : p));
  }, []);

  const pinQuest = useCallback((id: string, pinned: boolean) => {
    setQuests((prev) => {
      const targetType = prev.find(q => q.id === id)?.type;
      return prev.map((q) =>
        q.id === id
          ? { ...q, pinned }
          : pinned && q.type === targetType ? { ...q, pinned: false } : q
      );
    });
  }, []);

  const reorderInventory = useCallback((newOrder: InventoryItem[]) => {
    setInventory(newOrder);
    if (!hasCharacter) return;

    const snapshot = assemblePortableCharacterSnapshot({
      _version: 1,
      character,
      attacks,
      companions,
      resources,
      inventory: newOrder,
      conditions,
      notes,
      wishlist,
      journalArcs,
      spellSlots,
      spellEffectUses,
      itemActionUses,
      classFeatures,
      passiveFeatures,
      preparedSpells,
      people,
      quests,
      locations,
      realms,
      rulesState,
      combatLog: {
        entries: combatLogEntries,
        sessions: combatLogSessions,
      },
      questGraphReviewQueue,
    });
    saveCharacter(snapshot).catch(() => {});
  }, [hasCharacter, character, attacks, companions, resources, conditions, notes, wishlist, journalArcs, spellSlots, spellEffectUses, itemActionUses, classFeatures, passiveFeatures, preparedSpells, people, quests, locations, realms, rulesState, combatLogEntries, combatLogSessions, questGraphReviewQueue]);

  const pinLocation = useCallback((id: string, pinned: boolean) => {
    setLocations((prev) => prev.map((l) => l.id === id ? { ...l, pinned } : pinned ? { ...l, pinned: false } : l));
  }, []);

  const updateStatistics = useCallback((updates: Partial<CharacterStatistics>) => {
    setCharacter((prev) => {
      const stats = prev.statistics ?? { killCount: 0, totalGoldEarned: 0, lootItemsAdded: 0, nearDeaths: 0, totalHpHealed: 0, totalDamageTaken: 0 };
      return { ...prev, statistics: { ...stats, ...updates } };
    });
  }, []);

  const incrementKillCount = useCallback(() => {
    setCharacter((prev) => {
      const stats = prev.statistics ?? { killCount: 0, totalGoldEarned: 0, lootItemsAdded: 0, nearDeaths: 0, totalHpHealed: 0, totalDamageTaken: 0 };
      return { ...prev, statistics: { ...stats, killCount: stats.killCount + 1 } };
    });
  }, []);

  // ── Spells CRUD ──────────────────────────────────────────────────────────────
  const addSpell = useCallback((s: Omit<PreparedSpell, "id" | "createdAt">) => {
    setPreparedSpells((prev) => [...prev, { ...s, id: generateId(), createdAt: Date.now() }]);
  }, []);

  const updateSpell = useCallback((id: string, updates: Partial<Omit<PreparedSpell, "id" | "createdAt">>) => {
    setPreparedSpells((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const removeSpell = useCallback((id: string) => {
    setPreparedSpells((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const toggleSpellPrepared = useCallback((id: string) => {
    setPreparedSpells((prev) => prev.map((s) => (s.id === id ? { ...s, prepared: !s.prepared } : s)));
  }, []);

  // ── People CRUD ──────────────────────────────────────────────────────────────
  const addPerson = useCallback((p: Omit<NpcPerson, "id" | "createdAt">) => {
    setPeople((prev) => [...prev, { ...p, id: generateId(), createdAt: Date.now() }]);
  }, []);

  const updatePerson = useCallback((id: string, updates: Partial<Omit<NpcPerson, "id" | "createdAt">>) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const deletePerson = useCallback((id: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Quests CRUD ──────────────────────────────────────────────────────────────
  const addQuest = useCallback((q: Omit<Quest, "id" | "createdAt">) => {
    setQuests((prev) => [...prev, { ...q, id: generateId(), createdAt: Date.now() }]);
    showStatusPill(`Quest gained: ${q.name}`, "positive");
  }, [showStatusPill]);

  const updateQuest = useCallback((id: string, updates: Partial<Omit<Quest, "id" | "createdAt">>) => {
    setQuests((prev) => {
      const existing = prev.find((q) => q.id === id);
      const next = prev.map((q) => (q.id === id ? { ...q, ...updates } : q));
      if (existing) {
        const nextStatus = updates.status ?? existing.status;
        if (nextStatus !== existing.status) {
          if (nextStatus === "completed") showStatusPill(`Quest completed: ${existing.name}`, "positive");
          else if (nextStatus === "failed") showStatusPill(`Quest failed: ${existing.name}`, "negative");
          else showStatusPill(`Quest updated: ${existing.name} (${nextStatus})`, "neutral");
        } else {
          showStatusPill(`Quest updated: ${existing.name}`, "neutral");
        }
      }
      return next;
    });
  }, [showStatusPill]);

  const deleteQuest = useCallback((id: string) => {
    setQuests((prev) => {
      const existing = prev.find((q) => q.id === id);
      if (existing) showStatusPill(`Quest removed: ${existing.name}`, "negative");
      return prev.filter((q) => q.id !== id);
    });
  }, [showStatusPill]);

  // ── Locations CRUD ───────────────────────────────────────────────────────────
  const addLocation = useCallback((l: Omit<CampaignLocation, "id" | "createdAt">) => {
    const id = generateId();
    setLocations((prev) => [...prev, {
      ...l,
      parentLocationId: l.parentLocationId && l.parentLocationId !== id ? l.parentLocationId : undefined,
      id,
      createdAt: Date.now(),
    }]);
  }, []);

  const updateLocation = useCallback((id: string, updates: Partial<Omit<CampaignLocation, "id" | "createdAt">>) => {
    setLocations((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const parentLocationId = updates.parentLocationId === id ? undefined : updates.parentLocationId;
      return { ...l, ...updates, ...(updates.parentLocationId !== undefined ? { parentLocationId } : {}) };
    }));
  }, []);

  const deleteLocation = useCallback((id: string) => {
    setLocations((prev) => prev
      .filter((l) => l.id !== id)
      .map((l) => (l.parentLocationId === id ? { ...l, parentLocationId: undefined } : l)));
  }, []);

  // ── Realms CRUD ─────────────────────────────────────────────────────────────
  const addRealm = useCallback((r: Omit<Plane, "id" | "createdAt">) => {
    setRealms((prev) => [...prev, { ...r, id: generateId(), createdAt: Date.now() }]);
  }, []);

  const updateRealm = useCallback((id: string, updates: Partial<Omit<Plane, "id" | "createdAt">>) => {
    setRealms((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }, []);

  const deleteRealm = useCallback((id: string) => {
    setRealms((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const pinRealm = useCallback((id: string, pinned: boolean) => {
    setRealms((prev) => prev.map((r) => (r.id === id ? { ...r, pinned } : r)));
  }, []);

  const getReviewBatches = useCallback(() => questGraphReviewQueue, [questGraphReviewQueue]);

  const resolveDeferredOperation = useCallback((batchId: string, operationId: string, decision: QuestGraphResolutionDecision) => {
    const now = Date.now();
    setQuestGraphReviewQueue((prev) =>
      prev.map((batch) => {
        if (batch.batchId !== batchId) return batch;
        const nextBatch = {
          ...batch,
          operations: batch.operations.map((op): QuestGraphDeferredOperation => {
            if (op.operationId !== operationId) return op;
            if (decision.action !== "reject" && !isReplaySupportedOperation(op, decision)) {
              return {
                ...op,
                failureReason: "Selected resolution action is not replayable for this deferred operation",
              };
            }
            const nextState: QuestGraphDeferredOperation["resolutionState"] = decision.action === "reject" ? "rejected" : "approved";
            return {
              ...op,
              resolutionDecision: decision,
              resolutionState: nextState,
              resolvedAt: now,
              failureReason: undefined,
            };
          }),
        };
        return updateReviewBatchStatus(nextBatch);
      })
    );
  }, []);

  const resolveBatch = useCallback((batchId: string, decisions: Array<{ operationId: string; decision: QuestGraphResolutionDecision }>) => {
    if (decisions.length === 0) return;
    const decisionMap = new Map(decisions.map((entry) => [entry.operationId, entry.decision]));
    const now = Date.now();
    setQuestGraphReviewQueue((prev) =>
      prev.map((batch) => {
        if (batch.batchId !== batchId) return batch;
        const nextBatch = {
          ...batch,
          operations: batch.operations.map((op): QuestGraphDeferredOperation => {
            const decision = decisionMap.get(op.operationId);
            if (!decision) return op;
            if (decision.action !== "reject" && !isReplaySupportedOperation(op, decision)) {
              return {
                ...op,
                failureReason: "Selected resolution action is not replayable for this deferred operation",
              };
            }
            const nextState: QuestGraphDeferredOperation["resolutionState"] = decision.action === "reject" ? "rejected" : "approved";
            return {
              ...op,
              resolutionDecision: decision,
              resolutionState: nextState,
              resolvedAt: now,
              failureReason: undefined,
            };
          }),
        };
        return updateReviewBatchStatus(nextBatch);
      })
    );
  }, []);

  const applyResolvedOperations = useCallback((batchId: string): QuestGraphResolutionResult => {
    const batch = questGraphReviewQueue.find((entry) => entry.batchId === batchId);
    if (!batch) {
      return { batchId, applied: 0, rejected: 0, failed: 0, pending: 0 };
    }

    const now = Date.now();
    const inventoryById = new Map(inventory.map((item) => [item.id, item] as const));
    const locationsById = new Map(locations.map((location) => [location.id, location] as const));
    const parentByLocationId = new Map(locations.map((location) => [location.id, location.parentLocationId] as const));
    let inventoryChanged = false;
    let locationsChanged = false;
    const questReferenceItemsById = new Map<string, QuestReferenceItem[]>();

    const resolveQuestRefToId = (questRef: string | undefined): string | null => {
      if (!questRef) return null;
      if (quests.some((quest) => quest.id === questRef)) return questRef;
      const resolution = resolveQuestEntityByName(questRef, quests.map((quest) => ({ id: quest.id, name: quest.name, aliases: quest.aliases })));
      return resolution.status === "resolved" ? resolution.resolvedId ?? null : null;
    };

    const parseItemIdFromKey = (key: string): string | null => {
      const marker = "|item:";
      const idx = key.indexOf(marker);
      if (idx < 0) return null;
      return key.slice(idx + marker.length) || null;
    };

    const resolveContainmentFromSnapshot = (snapshot: unknown): { childId: string; parentId: string } | null => {
      if (!isLocationContainmentRelationshipSnapshot(snapshot)) return null;
      return snapshot.relationshipType === "contained_in"
        ? { childId: snapshot.fromEntityId, parentId: snapshot.toEntityId }
        : { childId: snapshot.toEntityId, parentId: snapshot.fromEntityId };
    };

    const nextOperations: QuestGraphDeferredOperation[] = batch.operations.map((op): QuestGraphDeferredOperation => {
      if (op.resolutionState === "rejected") return op;
      if (op.resolutionState === "applied" || op.resolutionState === "failed") return op;
      if (op.resolutionState !== "approved") return op;

      if (op.appliedAt != null) {
        return { ...op, resolutionState: "applied" };
      }

      if (op.section === "inventory_link") {
        const snapshot = (op.payloadSnapshot ?? {}) as {
          questRef?: string;
          item?: { itemId?: string; itemName?: string; relevanceRole?: "quest_item" | "reward" | "key_item" | "other"; notes?: string };
        };
        const decision = op.resolutionDecision;
        const itemId = decision?.inventoryItemId ?? snapshot.item?.itemId ?? parseItemIdFromKey(op.key);
        const questId = decision?.questId ?? resolveQuestRefToId(snapshot.questRef);
        const relevanceRole = decision?.newRelevanceRole ?? snapshot.item?.relevanceRole;

        if (!itemId || !questId || !relevanceRole) {
          return {
            ...op,
            resolutionState: "failed",
            appliedAt: now,
            failureReason: "Missing resolved item, quest, or relevance role",
          };
        }

        const existingItem = inventoryById.get(itemId);
        if (!existingItem) {
          return {
            ...op,
            resolutionState: "failed",
            appliedAt: now,
            failureReason: "Inventory item not found",
          };
        }

        const nextReferenceItem: QuestReferenceItem = {
          itemId,
          itemName: snapshot.item?.itemName ?? existingItem.name,
          relevanceRole,
          ...(snapshot.item?.notes != null && snapshot.item.notes.trim() ? { notes: snapshot.item.notes.trim() } : {}),
          source: "parser_graph_v2",
          resolutionState: "linked_inventory",
          linkedAt: now,
        };
        const existingReferences = questReferenceItemsById.get(questId) ?? [];
        questReferenceItemsById.set(questId, [...existingReferences, nextReferenceItem]);

        const nextLink: NonNullable<InventoryItem["questLink"]> = {
          questId,
          relevanceRole,
          ...(snapshot.item?.notes != null && snapshot.item.notes.trim() ? { notes: snapshot.item.notes.trim() } : {}),
          source: "parser_graph_v2",
          linkedAt: now,
        };

        const unchanged =
          existingItem.questLink?.questId === nextLink.questId &&
          existingItem.questLink?.relevanceRole === nextLink.relevanceRole &&
          (existingItem.questLink?.notes ?? "") === (nextLink.notes ?? "");

        if (!unchanged) {
          inventoryById.set(itemId, { ...existingItem, questLink: nextLink });
          inventoryChanged = true;
        }

        return {
          ...op,
          resolutionState: "applied",
          appliedAt: now,
          failureReason: undefined,
        };
      }

      if (op.section === "relationship") {
        const decision = op.resolutionDecision;
        if (!decision) {
          return {
            ...op,
            resolutionState: "failed",
            appliedAt: now,
            failureReason: "Missing containment resolution decision",
          };
        }
        const containment = resolveContainmentFromSnapshot(op.payloadSnapshot);
        if (!containment) {
          return {
            ...op,
            resolutionState: "failed",
            appliedAt: now,
            failureReason: "Deferred relationship is not a supported location containment operation",
          };
        }

        const childId = decision.targetEntityId ?? containment.childId;
        const parentId = decision.action === "keep_location_unparented"
          ? undefined
          : (decision.resolvedEntityId ?? containment.parentId);

        const existingChild = locationsById.get(childId);
        if (!existingChild) {
          return {
            ...op,
            resolutionState: "failed",
            appliedAt: now,
            failureReason: "Child location could not be resolved",
          };
        }

        if (parentId != null) {
          if (parentId === childId) {
            return {
              ...op,
              resolutionState: "failed",
              appliedAt: now,
              failureReason: "Location cannot be its own parent",
            };
          }
          if (!locationsById.has(parentId)) {
            return {
              ...op,
              resolutionState: "failed",
              appliedAt: now,
              failureReason: "Parent location could not be resolved",
            };
          }
          const seen = new Set<string>([childId]);
          let cursor: string | undefined = parentId;
          while (cursor) {
            if (seen.has(cursor)) {
              return {
                ...op,
                resolutionState: "failed",
                appliedAt: now,
                failureReason: "Applying this parent assignment would create a cycle",
              };
            }
            seen.add(cursor);
            cursor = parentByLocationId.get(cursor);
          }
        }

        const nextParent = parentId ?? undefined;
        if ((existingChild.parentLocationId ?? undefined) !== nextParent) {
          parentByLocationId.set(childId, nextParent);
          locationsChanged = true;
        }

        return {
          ...op,
          resolutionState: "applied",
          appliedAt: now,
          failureReason: undefined,
        };
      }

      return {
        ...op,
        resolutionState: "failed",
        appliedAt: now,
        failureReason: "Deferred operation section is not supported for replay",
      };
    });

    const nextBatch = updateReviewBatchStatus({ ...batch, operations: nextOperations });
    setQuestGraphReviewQueue((prev) => prev.map((entry) => (entry.batchId === batchId ? nextBatch : entry)));

    if (inventoryChanged) {
      setInventory((prev) => prev.map((item) => inventoryById.get(item.id) ?? item));
    }

    if (locationsChanged) {
      setLocations((prev) =>
        prev.map((location) => {
          const nextParentLocationId = parentByLocationId.get(location.id) ?? undefined;
          if ((location.parentLocationId ?? undefined) === nextParentLocationId) return location;
          return { ...location, parentLocationId: nextParentLocationId };
        })
      );
    }

    if (questReferenceItemsById.size > 0) {
      setQuests((prev) =>
        prev.map((quest) => {
          const nextReferenceItems = upsertQuestReferenceItems(quest.referenceItems, questReferenceItemsById.get(quest.id) ?? []);
          return nextReferenceItems === quest.referenceItems ? quest : { ...quest, referenceItems: nextReferenceItems };
        })
      );
    }

    return {
      batchId,
      applied: nextBatch.operations.filter((op) => op.resolutionState === "applied").length,
      rejected: nextBatch.operations.filter((op) => op.resolutionState === "rejected").length,
      failed: nextBatch.operations.filter((op) => op.resolutionState === "failed").length,
      pending: nextBatch.operations.filter((op) => op.resolutionState === "pending" || op.resolutionState === "approved").length,
    };
  }, [inventory, locations, questGraphReviewQueue, quests]);

  const markBatchArchived = useCallback((batchId: string) => {
    setQuestGraphReviewQueue((prev) =>
      prev.map((batch) => {
        if (batch.batchId !== batchId) return batch;
        if (!canArchiveQuestGraphBatch(batch)) {
          const counts = summarizeQuestGraphBatch(batch);
          showStatusPill(
            `Review batch still has ${counts.unresolved} unresolved operation${counts.unresolved === 1 ? "" : "s"}`,
            "negative"
          );
          return batch;
        }
        return { ...batch, status: "archived", archivedAt: Date.now() };
      })
    );
  }, [showStatusPill]);

  const applyDeferredInventoryLinksForBatch = useCallback((batchId: string, acceptedItemIds: string[]): QuestGraphResolutionResult => {
    const accepted = new Set(acceptedItemIds);
    const now = Date.now();
    const batch = questGraphReviewQueue.find((entry) => entry.batchId === batchId);
    if (!batch) {
      return { batchId, applied: 0, rejected: 0, failed: 0, pending: 0 };
    }

    const itemIdFromKey = (key: string): string | null => {
      const marker = "|item:";
      const idx = key.indexOf(marker);
      if (idx < 0) return null;
      return key.slice(idx + marker.length) || null;
    };

    const autoDecisions: Array<{ operationId: string; decision: QuestGraphResolutionDecision }> = [];
    for (const op of batch.operations) {
      if (op.section !== "inventory_link" || op.resolutionState !== "pending") continue;
      const snapshot = (op.payloadSnapshot ?? {}) as { item?: { itemId?: string } };
      const itemId = snapshot.item?.itemId ?? itemIdFromKey(op.key);
      if (!itemId || !accepted.has(itemId)) continue;
      autoDecisions.push({
        operationId: op.operationId,
        decision: {
          action: "apply_inventory_link",
          inventoryItemId: itemId,
        },
      });
    }

    const decisionMap = new Map(autoDecisions.map((entry) => [entry.operationId, entry.decision]));
    const inventoryById = new Map(inventory.map((item) => [item.id, item] as const));
    let inventoryChanged = false;
    const questReferenceItemsById = new Map<string, QuestReferenceItem[]>();
    const addQuestReferenceItem = (questId: string, ref: QuestReferenceItem) => {
      const existing = questReferenceItemsById.get(questId) ?? [];
      questReferenceItemsById.set(questId, [...existing, ref]);
    };

    const questIdsByName = new Map<string, string[]>();
    for (const quest of quests) {
      const key = normalizeKey(quest.name);
      const next = questIdsByName.get(key) ?? [];
      next.push(quest.id);
      questIdsByName.set(key, next);
    }

    const resolveQuestRefToId = (questRef: string | undefined): string | null => {
      if (!questRef) return null;
      if (quests.some((quest) => quest.id === questRef)) return questRef;
      const byName = questIdsByName.get(normalizeKey(questRef)) ?? [];
      if (byName.length !== 1) return null;
      return byName[0];
    };

    const nextOperations: QuestGraphDeferredOperation[] = batch.operations.map((op): QuestGraphDeferredOperation => {
      const decision = decisionMap.get(op.operationId);
      const normalizedOp = decision
        ? {
            ...op,
            resolutionDecision: decision,
            resolutionState: "approved" as const,
            resolvedAt: now,
            failureReason: undefined,
          }
        : op;

      if (normalizedOp.resolutionState !== "approved") return normalizedOp;
      if (normalizedOp.section !== "inventory_link") return normalizedOp;

      const snapshot = (normalizedOp.payloadSnapshot ?? {}) as {
        questRef?: string;
        item?: { itemId?: string; relevanceRole?: "quest_item" | "reward" | "key_item" | "other"; notes?: string };
      };

      const itemId = normalizedOp.resolutionDecision?.inventoryItemId ?? snapshot.item?.itemId ?? itemIdFromKey(normalizedOp.key);
      const questId = normalizedOp.resolutionDecision?.questId ?? resolveQuestRefToId(snapshot.questRef);
      const relevanceRole = normalizedOp.resolutionDecision?.newRelevanceRole ?? snapshot.item?.relevanceRole;

      if (!itemId || !questId || !relevanceRole) {
        return {
          ...normalizedOp,
          resolutionState: "failed",
          appliedAt: now,
          failureReason: "Missing resolved item, quest, or relevance role",
        };
      }

      const existingItem = inventoryById.get(itemId);
      if (!existingItem) {
        return {
          ...normalizedOp,
          resolutionState: "failed",
          appliedAt: now,
          failureReason: "Inventory item not found",
        };
      }

      const nextLink: NonNullable<InventoryItem["questLink"]> = {
        questId,
        relevanceRole,
        ...(snapshot.item?.notes != null && snapshot.item.notes.trim() ? { notes: snapshot.item.notes.trim() } : {}),
        source: "parser_graph_v2",
        linkedAt: now,
      };

      const unchanged =
        existingItem.questLink?.questId === nextLink.questId &&
        existingItem.questLink?.relevanceRole === nextLink.relevanceRole &&
        (existingItem.questLink?.notes ?? "") === (nextLink.notes ?? "");

      if (!unchanged) {
        inventoryById.set(itemId, { ...existingItem, questLink: nextLink });
        inventoryChanged = true;
      }

      addQuestReferenceItem(questId, {
        itemName: existingItem.name,
        itemId,
        relevanceRole: relevanceRole as QuestReferenceItem["relevanceRole"],
        notes: snapshot.item?.notes?.trim() || undefined,
        source: "parser_graph_v2",
        resolutionState: "linked_inventory",
        linkedAt: now,
      });

      return {
        ...normalizedOp,
        resolutionState: "applied",
        appliedAt: now,
        failureReason: undefined,
      };
    });

    const nextBatch = updateReviewBatchStatus({ ...batch, operations: nextOperations });
    setQuestGraphReviewQueue((prev) => prev.map((entry) => (entry.batchId === batchId ? nextBatch : entry)));

    if (inventoryChanged) {
      setInventory((prev) => prev.map((item) => inventoryById.get(item.id) ?? item));
    }

    if (questReferenceItemsById.size > 0) {
      setQuests((prev) =>
        prev.map((quest) => {
          const nextReferenceItems = upsertQuestReferenceItems(quest.referenceItems, questReferenceItemsById.get(quest.id) ?? []);
          return nextReferenceItems === quest.referenceItems ? quest : { ...quest, referenceItems: nextReferenceItems };
        })
      );
    }

    return {
      batchId,
      applied: nextBatch.operations.filter((op) => op.resolutionState === "applied").length,
      rejected: nextBatch.operations.filter((op) => op.resolutionState === "rejected").length,
      failed: nextBatch.operations.filter((op) => op.resolutionState === "failed").length,
      pending: nextBatch.operations.filter((op) => op.resolutionState === "pending" || op.resolutionState === "approved").length,
    };
  }, [inventory, questGraphReviewQueue, quests]);

  const applyQuestUpdate = useCallback((
    result: QuestUpdateResult,
    options?: { enableInventoryLinking?: boolean; sourceType?: "quick_update" | "loot_review" }
  ): QuestGraphApplyReport => {
    const now = Date.now();
    const enableInventoryLinking = options?.enableInventoryLinking ?? true;
    const sourceType = options?.sourceType ?? "quick_update";
    const graphReport = makeQuestGraphApplyReport();
    const pushReceipt = (
      target: "applied" | "deferred" | "skipped",
      receipt: QuestGraphApplyReceipt
    ) => {
      graphReport[target].push(receipt);
    };

    const defer = (
      section: QuestGraphApplyReceipt["section"],
      key: string,
      detail: string,
      reasonCode: QuestGraphApplyReasonCode
    ) => pushReceipt("deferred", { section, key, detail, reasonCode });

    const skip = (
      section: QuestGraphApplyReceipt["section"],
      key: string,
      detail: string,
      reasonCode: QuestGraphApplyReasonCode
    ) => pushReceipt("skipped", { section, key, detail, reasonCode });

    const apply = (
      section: QuestGraphApplyReceipt["section"],
      key: string,
      detail: string
    ) => pushReceipt("applied", { section, key, detail });

    // Pre-generate IDs for all legacy creates so we can cross-link deterministically.
    const locIdMap = new Map<string, string>(); // normalized name → id
    const personIdMap = new Map<string, string>();
    const questIdMap = new Map<string, string>();
    const realmIdMap = new Map<string, string>();

    for (const location of locations) {
      locIdMap.set(normalizeKey(location.name), location.id);
    }
    for (const person of people) {
      personIdMap.set(normalizeKey(person.name), person.id);
    }
    for (const quest of quests) {
      questIdMap.set(normalizeKey(quest.name), quest.id);
    }
    for (const realm of realms) {
      realmIdMap.set(normalizeKey(realm.name), realm.id);
    }

    const personNamesByQuest = new Map<string, string[]>();
    const locationNamesByQuest = new Map<string, string[]>();
    const peopleNamesByLocation = new Map<string, Set<string>>();
    for (const qa of result.questActions) {
      const questKey = normalizeKey(qa.name);
      const personNames = [...new Set((qa.personNames ?? []).map((name) => name.trim()).filter(Boolean))];
      const locationNames = [...new Set((qa.locationNames ?? []).map((name) => name.trim()).filter(Boolean))];
      personNamesByQuest.set(questKey, personNames);
      locationNamesByQuest.set(questKey, locationNames);

      for (const locationName of locationNames) {
        const locationKey = normalizeKey(locationName);
        if (!locationKey) continue;
        const existing = peopleNamesByLocation.get(locationKey) ?? new Set<string>();
        for (const personName of personNames) {
          existing.add(personName);
        }
        peopleNamesByLocation.set(locationKey, existing);
      }
    }

    for (const la of result.locationActions) {
      const id = la.action === "update" && la.locationId ? la.locationId : generateId();
      locIdMap.set(normalizeKey(la.name), id);
    }
    for (const pa of result.personActions) {
      const id = pa.action === "update" && pa.personId ? pa.personId : generateId();
      personIdMap.set(normalizeKey(pa.name), id);
    }
    for (const qa of result.questActions) {
      const id = qa.action === "update" && qa.questId ? qa.questId : generateId();
      questIdMap.set(normalizeKey(qa.name), id);
    }
    for (const ra of result.realmActions ?? []) {
      const id = ra.action === "update" && ra.realmId ? ra.realmId : generateId();
      realmIdMap.set(normalizeKey(ra.name), id);
    }

    // Apply legacy locations.
    setLocations((prev) => {
      const next = [...prev];
      for (const la of result.locationActions) {
        const resolvedId = locIdMap.get(la.name.toLowerCase())!;
        const existingIdx = next.findIndex((l) => l.id === resolvedId);
        if (existingIdx >= 0) {
          next[existingIdx] = {
            ...next[existingIdx],
            name: la.name,
            ...(la.description != null && { description: la.description }),
          };
        } else {
          next.push({ id: resolvedId, name: la.name, description: la.description ?? undefined, questTags: [], createdAt: now });
        }
      }
      return next;
    });

    // Apply legacy quests.
    setQuests((prev) => {
      const next = [...prev];
      for (const qa of result.questActions) {
        const resolvedId = questIdMap.get(normalizeKey(qa.name))!;
        const locationTags = qa.locationNames
          .map((n) => locIdMap.get(normalizeKey(n)))
          .filter((id): id is string => !!id);
        const existingIdx = next.findIndex((q) => q.id === resolvedId);
        const questKey = normalizeKey(qa.name);
        const resolvedDescription = qa.description?.trim() || (existingIdx >= 0 ? next[existingIdx].description : undefined) || buildQuestDescriptionFallback(
          qa.name,
          result.summary,
          personNamesByQuest.get(questKey) ?? [],
          locationNamesByQuest.get(questKey) ?? []
        );
        if (existingIdx >= 0) {
          const existing = next[existingIdx];
          const mergedLocTags = [...new Set([...existing.locationTags, ...locationTags])];
          let mergedQDesc: string | undefined = existing.description;
          if (resolvedDescription != null && resolvedDescription.trim()) {
            const inc = resolvedDescription.trim();
            if (!mergedQDesc) mergedQDesc = inc;
            else if (!mergedQDesc.includes(inc)) mergedQDesc = `${mergedQDesc}\n${inc}`;
          }
          let mergedQNotes: string | undefined = existing.notes;
          if (qa.notes != null && qa.notes.trim()) {
            const inc = qa.notes.trim();
            if (!mergedQNotes) mergedQNotes = inc;
            else if (!mergedQNotes.includes(inc)) mergedQNotes = `${mergedQNotes}\n${inc}`;
          }
          const updates = {
            name: qa.name,
            type: qa.type,
            status: qa.status,
            ...(mergedQDesc != null && { description: mergedQDesc }),
            ...(mergedQNotes != null && { notes: mergedQNotes }),
            locationTags: mergedLocTags,
          };
          next[existingIdx] = { ...existing, ...updates };
        } else {
          next.push({
            id: resolvedId,
            createdAt: now,
            name: qa.name,
            type: qa.type,
            status: qa.status,
            description: resolvedDescription,
            notes: qa.notes ?? undefined,
            locationTags,
          });
        }
      }
      return next;
    });

    // Apply legacy people — also link questTags.
    setPeople((prev) => {
      const next = [...prev];
      for (const pa of result.personActions) {
        const personKey = normalizeKey(pa.name);
        const resolvedId = personIdMap.get(personKey)!;
        const newQuestTags = result.questActions
          .filter((qa) => qa.personNames.map((n) => normalizeKey(n)).includes(personKey))
          .map((qa) => questIdMap.get(normalizeKey(qa.name)))
          .filter((id): id is string => !!id);
        const personLocations = [...new Set(
          result.questActions
            .filter((qa) => (qa.personNames ?? []).some((name) => normalizeKey(name) === personKey))
            .flatMap((qa) => qa.locationNames ?? [])
            .map((locationName) => locationName.trim())
            .filter(Boolean)
        )];
        const mergedNotesFromNetwork = upsertNetworkLine(pa.notes ?? undefined, "Linked locations", personLocations);
        const existingIdx = next.findIndex((p) => p.id === resolvedId);
        if (existingIdx >= 0) {
          const existing = next[existingIdx];
          const mergedQTags = [...new Set([...existing.questTags, ...newQuestTags])];
          let mergedDesc: string | undefined = existing.description;
          if (pa.description != null && pa.description.trim()) {
            const incoming = pa.description.trim();
            if (!mergedDesc) mergedDesc = incoming;
            else if (!mergedDesc.includes(incoming)) mergedDesc = `${mergedDesc}\n${incoming}`;
          }
          let mergedNotes: string | undefined = existing.notes;
          if (mergedNotesFromNetwork != null && mergedNotesFromNetwork.trim()) {
            const incoming = mergedNotesFromNetwork.trim();
            if (!mergedNotes) mergedNotes = incoming;
            else if (!mergedNotes.includes(incoming)) mergedNotes = `${mergedNotes}\n${incoming}`;
          }
          next[existingIdx] = {
            ...existing,
            name: pa.name,
            ...(pa.role != null && { role: pa.role }),
            relationship: pa.relationship,
            ...(mergedDesc != null && { description: mergedDesc }),
            ...(mergedNotes != null && { notes: mergedNotes }),
            questTags: mergedQTags,
          };
        } else {
          next.push({
            id: resolvedId,
            name: pa.name,
            role: pa.role ?? undefined,
            relationship: pa.relationship,
            description: pa.description ?? undefined,
            notes: mergedNotesFromNetwork,
            questTags: newQuestTags,
            createdAt: now,
          });
        }
      }
      return next;
    });

    // Back-link questTags onto locations from legacy pass.
    setLocations((prev) =>
      prev.map((l) => {
        const newQTags = result.questActions
          .filter((qa) => qa.locationNames.map((n) => locIdMap.get(normalizeKey(n))).includes(l.id))
          .map((qa) => questIdMap.get(normalizeKey(qa.name)))
          .filter((id): id is string => !!id);
        const linkedPeopleNames = [...(peopleNamesByLocation.get(normalizeKey(l.name)) ?? new Set<string>())];
        const nextNotes = upsertNetworkLine(l.notes, "Linked people", linkedPeopleNames);
        if (newQTags.length === 0 && nextNotes === l.notes) return l;
        return {
          ...l,
          notes: nextNotes,
          questTags: [...new Set([...l.questTags, ...newQTags])],
        };
      })
    );

    // Apply legacy realms.
    if (result.realmActions?.length) {
      setRealms((prev) => {
        const next = [...prev];
        for (const ra of result.realmActions) {
          const resolvedId = ra.action === "update" && ra.realmId ? ra.realmId : realmIdMap.get(normalizeKey(ra.name)) ?? generateId();
          const newLocTags = (ra.locationNames ?? [])
            .map((n) => locIdMap.get(normalizeKey(n)))
            .filter((id): id is string => !!id);
          const existingIdx = next.findIndex((r) => r.id === resolvedId);
          if (existingIdx >= 0) {
            const merged = [...new Set([...(next[existingIdx].locationTags ?? []), ...newLocTags])];
            next[existingIdx] = {
              ...next[existingIdx],
              name: ra.name,
              ...(ra.description != null && { description: ra.description }),
              locationTags: merged,
            };
          } else {
            next.push({ id: resolvedId, name: ra.name, description: ra.description ?? undefined, questTags: [], locationTags: newLocTags, createdAt: now });
          }
        }
        return next;
      });
    }

    const created = result.questActions.filter((q) => q.action === "create").length;
    const updated = result.questActions.filter((q) => q.action === "update").length;
    const completed = result.questActions.filter((q) => q.status === "completed").length;
    const failed = result.questActions.filter((q) => q.status === "failed").length;

    if (result.questActions.length > 0) {
      const parts: string[] = [];
      if (created > 0) parts.push(`+${created} new`);
      if (updated > 0) parts.push(`${updated} updated`);
      if (completed > 0) parts.push(`${completed} completed`);
      if (failed > 0) parts.push(`${failed} failed`);
      const tone = failed > 0 && completed === 0 && created === 0 ? "negative" : completed > 0 || created > 0 ? "positive" : "neutral";
      showStatusPill(`Quest update: ${parts.join(" · ") || `${result.questActions.length} changed`}`, tone);
    }

    // ── Phase 2 graph apply second pass (legacy remains authoritative) ─────
    const graph = result.questGraphResult;
    const finalizeWithReviewBatch = (): QuestGraphApplyReport => {
      const finalized = finalizeQuestGraphApplyReport(graphReport);
      if (!graph) return finalized;
      const dedupeKey = makeReviewBatchDedupeKeyFromReport({
        sourceType,
        summary: result.summary,
        report: finalized,
      });
      const duplicateBatch = questGraphReviewQueue.find((entry) => {
        if (now - entry.createdAt > REVIEW_BATCH_SESSION_DEDUPE_WINDOW_MS) return false;
        return makeReviewBatchDedupeKeyFromBatch(entry) === dedupeKey;
      });
      if (duplicateBatch) {
        return { ...finalized, batchId: duplicateBatch.batchId, sourceType };
      }
      const batch = buildReviewBatchFromGraphReport({
        graph,
        report: finalized,
        summary: result.summary,
        sourceType,
        dedupeKey,
      });
      if (!batch) {
        return { ...finalized, sourceType };
      }
      setQuestGraphReviewQueue((prev) => [batch, ...prev]);
      return { ...finalized, batchId: batch.batchId, sourceType };
    };

    if (!graph) {
      return finalizeWithReviewBatch();
    }

    if (graph.reviewState === "ambiguous") {
      defer("relationship", "graph:root", "Top-level graph reviewState is ambiguous", "near_match_requires_review");
      return finalizeWithReviewBatch();
    }

    type EntityKind = "quest" | "person" | "location" | "realm";
    type ResolvedEntity = { kind: EntityKind; id: string; name: string };

    const byId = {
      quest: new Map<string, string>(),
      person: new Map<string, string>(),
      location: new Map<string, string>(),
      realm: new Map<string, string>(),
    };
    const byName = {
      quest: new Map<string, string[]>(),
      person: new Map<string, string[]>(),
      location: new Map<string, string[]>(),
      realm: new Map<string, string[]>(),
    };

    const registerEntity = (kind: EntityKind, id: string, name: string) => {
      byId[kind].set(id, name);
      const key = normalizeKey(name);
      if (!key) return;
      const current = byName[kind].get(key) ?? [];
      if (!current.includes(id)) byName[kind].set(key, [...current, id]);
    };

    for (const quest of quests) registerEntity("quest", quest.id, quest.name);
    for (const person of people) registerEntity("person", person.id, person.name);
    for (const location of locations) registerEntity("location", location.id, location.name);
    for (const realm of realms) registerEntity("realm", realm.id, realm.name);
    for (const qa of result.questActions) {
      const id = questIdMap.get(normalizeKey(qa.name));
      if (id) registerEntity("quest", id, qa.name);
    }
    for (const pa of result.personActions) {
      const id = personIdMap.get(normalizeKey(pa.name));
      if (id) registerEntity("person", id, pa.name);
    }
    for (const la of result.locationActions) {
      const id = locIdMap.get(normalizeKey(la.name));
      if (id) registerEntity("location", id, la.name);
    }
    for (const ra of result.realmActions ?? []) {
      const id = realmIdMap.get(normalizeKey(ra.name));
      if (id) registerEntity("realm", id, ra.name);
    }

    const localKeyResolution = new Map<string, ResolvedEntity>();
    const aliasUpdates = {
      quest: new Map<string, Set<string>>(),
      person: new Map<string, Set<string>>(),
      location: new Map<string, Set<string>>(),
      realm: new Map<string, Set<string>>(),
    };
    const relationshipUpdates = {
      quest: new Map<string, QuestGraphRelationshipRecord[]>(),
      person: new Map<string, QuestGraphRelationshipRecord[]>(),
      location: new Map<string, QuestGraphRelationshipRecord[]>(),
      realm: new Map<string, QuestGraphRelationshipRecord[]>(),
    };
    const questReferenceItemsById = new Map<string, QuestReferenceItem[]>();

    const addAliasUpdate = (kind: EntityKind, id: string, alias: string) => {
      const normalizedAlias = alias.trim();
      if (!normalizedAlias) return;
      const next = aliasUpdates[kind].get(id) ?? new Set<string>();
      next.add(normalizedAlias);
      aliasUpdates[kind].set(id, next);
    };

    const addRelationshipUpdate = (kind: EntityKind, id: string, relationship: QuestGraphRelationshipRecord) => {
      const next = relationshipUpdates[kind].get(id) ?? [];
      next.push(relationship);
      relationshipUpdates[kind].set(id, next);
    };

    const addQuestReferenceItem = (questId: string, reference: QuestReferenceItem) => {
      const next = questReferenceItemsById.get(questId) ?? [];
      next.push(reference);
      questReferenceItemsById.set(questId, next);
    };

    const entityCandidatesByKind: Record<EntityKind, Array<{ id: string; name: string; aliases?: string[] }>> = {
      quest: [
        ...quests.map((quest) => ({ id: quest.id, name: quest.name, aliases: quest.aliases })),
        ...result.questActions.map((action) => ({ id: questIdMap.get(normalizeKey(action.name)) ?? action.questId ?? generateId(), name: action.name })),
      ],
      person: [
        ...people.map((person) => ({ id: person.id, name: person.name, aliases: person.aliases })),
        ...result.personActions.map((action) => ({ id: personIdMap.get(normalizeKey(action.name)) ?? action.personId ?? generateId(), name: action.name })),
      ],
      location: [
        ...locations.map((location) => ({ id: location.id, name: location.name, aliases: location.aliases })),
        ...result.locationActions.map((action) => ({ id: locIdMap.get(normalizeKey(action.name)) ?? action.locationId ?? generateId(), name: action.name })),
      ],
      realm: [
        ...realms.map((realm) => ({ id: realm.id, name: realm.name, aliases: realm.aliases })),
        ...(result.realmActions ?? []).map((action) => ({ id: realmIdMap.get(normalizeKey(action.name)) ?? action.realmId ?? generateId(), name: action.name })),
      ],
    };

    const resolveNamedEntity = (kind: EntityKind, name: string) => resolveQuestEntityByName(name, entityCandidatesByKind[kind]);

    for (const candidate of graph.entitiesToCreate ?? []) {
      const key = candidate.localKey || candidate.name || "unknown";
      if (!candidate.kind || !candidate.localKey || !candidate.name?.trim()) {
        skip("entity_create", key, "Malformed entity candidate", "malformed_graph_fragment");
        continue;
      }
      const resolution = resolveNamedEntity(candidate.kind, candidate.name);
      if (resolution.status === "ambiguous") {
        defer(
          "entity_create",
          candidate.localKey,
          `Multiple baseline candidates match ${candidate.name}${resolution.suggestions.length > 0 ? ` (${resolution.suggestions.map((entry) => entry.name).join(", ")})` : ""}`,
          "ambiguous_entity_tie"
        );
        continue;
      }
      if (resolution.status === "resolved" && resolution.resolvedId) {
        localKeyResolution.set(candidate.localKey, {
          kind: candidate.kind,
          id: resolution.resolvedId,
          name: resolution.resolvedName ?? candidate.name,
        });
        defer(
          "entity_create",
          candidate.localKey,
          `Create deferred: ${candidate.name} already matches ${resolution.resolvedName ?? candidate.name} via ${resolution.matchedBy ?? "exact_name"}`,
          "near_match_requires_review"
        );
        continue;
      }
      if (resolution.status === "suggest") {
        defer(
          "entity_create",
          candidate.localKey,
          `Create deferred: ${candidate.name} is close to ${resolution.suggestions.map((entry) => entry.name).join(", ")} and needs review`,
          "near_match_requires_review"
        );
        continue;
      }
      defer("entity_create", candidate.localKey, `Graph create deferred in Phase 4 (reviewState=${candidate.reviewState})`, "near_match_requires_review");
    }

    for (const link of graph.entitiesToLink ?? []) {
      const linkKey = `${link.kind}:${link.mentionedName}`;
      let resolvedId = link.resolvedRef?.id;
      let resolvedName = link.resolvedRef?.name ?? link.mentionedName;
      let matchedBy = "resolved_ref";
      if (!resolvedId || !byId[link.kind].has(resolvedId)) {
        const resolution = resolveNamedEntity(link.kind, link.mentionedName);
        if (resolution.status === "ambiguous") {
          defer(
            "entity_link",
            linkKey,
            `Entity link is ambiguous for ${link.mentionedName}${resolution.suggestions.length > 0 ? ` (${resolution.suggestions.map((entry) => entry.name).join(", ")})` : ""}`,
            "ambiguous_entity_tie"
          );
          continue;
        }
        if (resolution.status !== "resolved" || !resolution.resolvedId) {
          defer("entity_link", linkKey, "Resolved reference is missing in current state", "unresolved_entity_ref");
          continue;
        }
        resolvedId = resolution.resolvedId;
        resolvedName = resolution.resolvedName ?? link.mentionedName;
        matchedBy = resolution.matchedBy ?? "derived_alias";
      }
      addAliasUpdate(link.kind, resolvedId, link.mentionedName);
      apply("entity_link", linkKey, `Linked ${link.mentionedName} to ${resolvedName} via ${matchedBy}`);
    }

    const relationshipAllowList = new Set(["quest_giver", "located_in", "part_of", "related_to", "involves", "contained_in", "contains_location"]);
    const questGiversByQuestId = new Map<string, Set<string>>();
    const questLocationLinks = new Map<string, Set<string>>();
    const locationQuestLinks = new Map<string, Set<string>>();
    const locationParentById = new Map<string, string>();
    const realmLocationLinks = new Map<string, Set<string>>();
    const personQuestLinks = new Map<string, Set<string>>();
    const realmQuestLinks = new Map<string, Set<string>>();
    const entityNotesByEntity = new Map<string, Set<string>>();

    const addSetValue = (target: Map<string, Set<string>>, key: string, value: string) => {
      const current = target.get(key) ?? new Set<string>();
      current.add(value);
      target.set(key, current);
    };

    const resolveEntityToken = (token: string): ResolvedEntity | "ambiguous" | null => {
      const byLocal = localKeyResolution.get(token);
      if (byLocal) return byLocal;

      const hits: ResolvedEntity[] = [];
      (Object.keys(byId) as EntityKind[]).forEach((kind) => {
        const name = byId[kind].get(token);
        if (name) hits.push({ kind, id: token, name });
      });

      if (hits.length > 1) return "ambiguous";
      if (hits.length === 1) return hits[0];
      return null;
    };

    const hasStrongEvidence = (evidence: QuestParserGraphResult["relationshipsToCreate"][number]["evidence"]): boolean => {
      if (!Array.isArray(evidence) || evidence.length === 0) return false;
      return evidence.some((entry) => entry.confidence === "high" || entry.confidence === "medium");
    };

    for (const rel of graph.relationshipsToCreate ?? []) {
      const relKey = `${rel.relationshipType}:${rel.fromEntityId}->${rel.toEntityId}`;
      const relType = rel.relationshipType?.trim();
      if (!relType || !rel.fromEntityId || !rel.toEntityId) {
        skip("relationship", relKey, "Malformed relationship operation", "malformed_graph_fragment");
        continue;
      }
      if (!rel.relationshipTypeKnown || !relationshipAllowList.has(relType)) {
        defer("relationship", relKey, `Unknown relationship type ${relType}`, "unknown_relationship_type");
        continue;
      }

      if (rel.reviewState === "ambiguous" || rel.reviewState === "unsupported") {
        defer("relationship", relKey, `Review state ${rel.reviewState} is not safe`, "low_confidence_relationship");
        continue;
      }

      if ((rel.reviewState === "needs_review" && !hasStrongEvidence(rel.evidence)) || (rel.evidence?.length ?? 0) > 0 && rel.evidence.every((entry) => entry.confidence === "low")) {
        defer("relationship", relKey, "Relationship confidence is too low", "low_confidence_relationship");
        continue;
      }

      const fromResolved = resolveEntityToken(rel.fromEntityId);
      const toResolved = resolveEntityToken(rel.toEntityId);
      if (fromResolved === "ambiguous" || toResolved === "ambiguous") {
        defer("relationship", relKey, "Relationship endpoint resolved to multiple entities", "ambiguous_entity_tie");
        continue;
      }
      if (!fromResolved || !toResolved) {
        defer("relationship", relKey, "Relationship endpoint could not be resolved", "unresolved_entity_ref");
        continue;
      }

      const relationshipConfidence = getRelationshipConfidence(rel.evidence);
      const evidenceExcerpts = (rel.evidence ?? []).map((entry) => entry.excerpt).filter((entry): entry is string => entry.trim().length > 0);
      addRelationshipUpdate(fromResolved.kind, fromResolved.id, {
        relationshipType: relType,
        direction: "outgoing",
        otherKind: toResolved.kind,
        otherId: toResolved.id,
        otherName: toResolved.name,
        ...(rel.label ? { label: rel.label } : {}),
        source: "parser_graph_v2",
        reviewState: "confirmed",
        confidence: relationshipConfidence,
        ...(evidenceExcerpts.length > 0 ? { evidenceExcerpts } : {}),
        updatedAt: now,
      });
      addRelationshipUpdate(toResolved.kind, toResolved.id, {
        relationshipType: relType,
        direction: "incoming",
        otherKind: fromResolved.kind,
        otherId: fromResolved.id,
        otherName: fromResolved.name,
        ...(rel.label ? { label: rel.label } : {}),
        source: "parser_graph_v2",
        reviewState: "confirmed",
        confidence: relationshipConfidence,
        ...(evidenceExcerpts.length > 0 ? { evidenceExcerpts } : {}),
        updatedAt: now,
      });

      if (relType === "quest_giver") {
        const questEntity = fromResolved.kind === "quest" ? fromResolved : toResolved.kind === "quest" ? toResolved : null;
        const personEntity = fromResolved.kind === "person" ? fromResolved : toResolved.kind === "person" ? toResolved : null;
        if (!questEntity || !personEntity) {
          skip("relationship", relKey, "quest_giver requires one quest and one person", "malformed_graph_fragment");
          continue;
        }
        addSetValue(questGiversByQuestId, questEntity.id, personEntity.name);
        addSetValue(personQuestLinks, personEntity.id, questEntity.id);
      } else if (relType === "located_in") {
        const questEntity = fromResolved.kind === "quest" ? fromResolved : toResolved.kind === "quest" ? toResolved : null;
        const locationEntity = fromResolved.kind === "location" ? fromResolved : toResolved.kind === "location" ? toResolved : null;
        if (!questEntity || !locationEntity) {
          skip("relationship", relKey, "located_in requires one quest and one location", "malformed_graph_fragment");
          continue;
        }
        addSetValue(questLocationLinks, questEntity.id, locationEntity.id);
        addSetValue(locationQuestLinks, locationEntity.id, questEntity.id);
      } else if (relType === "part_of") {
        const realmEntity = fromResolved.kind === "realm" ? fromResolved : toResolved.kind === "realm" ? toResolved : null;
        const locationEntity = fromResolved.kind === "location" ? fromResolved : toResolved.kind === "location" ? toResolved : null;
        if (!realmEntity || !locationEntity) {
          skip("relationship", relKey, "part_of requires one realm and one location", "malformed_graph_fragment");
          continue;
        }
        addSetValue(realmLocationLinks, realmEntity.id, locationEntity.id);
      } else if (relType === "contained_in" || relType === "contains_location") {
        if (fromResolved.kind !== "location" || toResolved.kind !== "location") {
          skip("relationship", relKey, `${relType} requires two locations`, "malformed_graph_fragment");
          continue;
        }
        const childId = relType === "contained_in" ? fromResolved.id : toResolved.id;
        const parentId = relType === "contained_in" ? toResolved.id : fromResolved.id;
        if (childId === parentId) {
          skip("relationship", relKey, "Location containment cannot point to self", "malformed_graph_fragment");
          continue;
        }
        const existingParentId = locationParentById.get(childId);
        if (existingParentId && existingParentId !== parentId) {
          defer("relationship", relKey, "Location containment conflicts with another parsed parent", "near_match_requires_review");
          continue;
        }
        locationParentById.set(childId, parentId);
      } else if (relType === "involves") {
        const questEntity = fromResolved.kind === "quest" ? fromResolved : toResolved.kind === "quest" ? toResolved : null;
        const personEntity = fromResolved.kind === "person" ? fromResolved : toResolved.kind === "person" ? toResolved : null;
        const locationEntity = fromResolved.kind === "location" ? fromResolved : toResolved.kind === "location" ? toResolved : null;
        const realmEntity = fromResolved.kind === "realm" ? fromResolved : toResolved.kind === "realm" ? toResolved : null;
        if (questEntity && personEntity) addSetValue(personQuestLinks, personEntity.id, questEntity.id);
        if (questEntity && locationEntity) {
          addSetValue(questLocationLinks, questEntity.id, locationEntity.id);
          addSetValue(locationQuestLinks, locationEntity.id, questEntity.id);
        }
        if (questEntity && realmEntity) {
          addSetValue(realmQuestLinks, realmEntity.id, questEntity.id);
        }
        addSetValue(entityNotesByEntity, `${fromResolved.kind}:${fromResolved.id}`, toResolved.name);
      } else {
        addSetValue(entityNotesByEntity, `${fromResolved.kind}:${fromResolved.id}`, toResolved.name);
      }

      apply("relationship", relKey, `Applied relationship ${relType}`);
    }

    const pendingQuestPatchById = new Map<string, Partial<Quest>>();
    const questPatch = graph.questPatch;
    if (questPatch) {
      const resolvedQuestId = (() => {
        if (questPatch.questId && byId.quest.has(questPatch.questId)) return questPatch.questId;
        if (questPatch.candidateLocalKey) {
          const localResolved = localKeyResolution.get(questPatch.candidateLocalKey);
          if (localResolved?.kind === "quest") return localResolved.id;
        }
        const namedResolution = resolveNamedEntity("quest", questPatch.name);
        return namedResolution.status === "resolved" ? namedResolution.resolvedId ?? null : null;
      })();

      if (!resolvedQuestId) {
        defer("quest_patch", questPatch.candidateLocalKey ?? questPatch.name, `Quest patch could not resolve quest ${questPatch.name}`, "unresolved_entity_ref");
      } else if (questPatch.reviewState === "ambiguous" || questPatch.reviewState === "unsupported") {
        defer("quest_patch", resolvedQuestId, `Quest patch for ${questPatch.name} needs review (${questPatch.reviewState})`, "near_match_requires_review");
      } else {
        pendingQuestPatchById.set(resolvedQuestId, {
          ...(questPatch.description != null ? { description: questPatch.description ?? undefined } : {}),
          ...(questPatch.notes != null ? { notes: questPatch.notes ?? undefined } : {}),
          objectives: (questPatch.objectives ?? []).map((objective) => ({
            description: objective.description,
            completed: objective.completed,
            source: "parser_graph_v2" as const,
            updatedAt: now,
          })),
          aliases: mergeQuestAliases(undefined, [questPatch.name]),
        });
        apply("quest_patch", resolvedQuestId, `Applied quest patch for ${questPatch.name}`);
      }
    }

    if (questGiversByQuestId.size > 0 || questLocationLinks.size > 0 || entityNotesByEntity.size > 0 || relationshipUpdates.quest.size > 0 || questReferenceItemsById.size > 0 || pendingQuestPatchById.size > 0 || aliasUpdates.quest.size > 0) {
      setQuests((prev) =>
        prev.map((quest) => {
          const newLocationTags = [...(questLocationLinks.get(quest.id) ?? new Set<string>())];
          const giverNames = [...(questGiversByQuestId.get(quest.id) ?? new Set<string>())];
          const linkedEntities = [...(entityNotesByEntity.get(`quest:${quest.id}`) ?? new Set<string>())];
          const nextNotes = upsertNetworkLine(
            upsertNetworkLine(quest.notes, "Quest giver", giverNames),
            "Linked entities",
            linkedEntities
          );
          const patch = pendingQuestPatchById.get(quest.id);
          const nextObjectives = patch?.objectives ?? quest.objectives;
          const nextAliases = mergeQuestAliases(quest.aliases, [
            ...(aliasUpdates.quest.get(quest.id) ?? new Set<string>()),
            ...(patch?.aliases ?? []),
          ]);
          const nextRelationships = upsertQuestGraphRelationships(quest.relationships, relationshipUpdates.quest.get(quest.id) ?? []);
          const nextReferenceItems = upsertQuestReferenceItems(quest.referenceItems, questReferenceItemsById.get(quest.id) ?? []);
          const nextDescription = patch?.description ?? quest.description;
          const nextQuestNotes = patch?.notes
            ? nextNotes && nextNotes.includes(patch.notes)
              ? nextNotes
              : nextNotes
                ? `${nextNotes}\n${patch.notes}`
                : patch.notes
            : nextNotes;
          if (
            newLocationTags.length === 0 &&
            nextQuestNotes === quest.notes &&
            nextDescription === quest.description &&
            nextObjectives === quest.objectives &&
            nextAliases === quest.aliases &&
            nextRelationships === quest.relationships &&
            nextReferenceItems === quest.referenceItems
          ) return quest;
          return {
            ...quest,
            notes: nextQuestNotes,
            description: nextDescription,
            objectives: nextObjectives,
            aliases: nextAliases,
            relationships: nextRelationships,
            referenceItems: nextReferenceItems,
            locationTags: [...new Set([...(quest.locationTags ?? []), ...newLocationTags])],
          };
         })
       );
     }

    if (locationQuestLinks.size > 0 || locationParentById.size > 0 || entityNotesByEntity.size > 0 || relationshipUpdates.location.size > 0 || aliasUpdates.location.size > 0) {
      setLocations((prev) =>
        prev.map((location) => {
          const newQuestTags = [...(locationQuestLinks.get(location.id) ?? new Set<string>())];
          const linkedEntities = [...(entityNotesByEntity.get(`location:${location.id}`) ?? new Set<string>())];
          const nextNotes = upsertNetworkLine(location.notes, "Linked entities", linkedEntities);
          const nextAliases = mergeQuestAliases(location.aliases, [...(aliasUpdates.location.get(location.id) ?? new Set<string>())]);
          const nextRelationships = upsertQuestGraphRelationships(location.relationships, relationshipUpdates.location.get(location.id) ?? []);
          const nextParentLocationId = (() => {
            const parsedParentId = locationParentById.get(location.id);
            if (!parsedParentId || parsedParentId === location.id) return location.parentLocationId;
            return parsedParentId;
          })();
          if (newQuestTags.length === 0 && nextNotes === location.notes && nextAliases === location.aliases && nextRelationships === location.relationships && nextParentLocationId === location.parentLocationId) return location;
          return {
            ...location,
            notes: nextNotes,
            aliases: nextAliases,
            parentLocationId: nextParentLocationId,
            relationships: nextRelationships,
            questTags: [...new Set([...(location.questTags ?? []), ...newQuestTags])],
          };
        })
      );
    }

    if (personQuestLinks.size > 0 || entityNotesByEntity.size > 0 || relationshipUpdates.person.size > 0 || aliasUpdates.person.size > 0) {
      setPeople((prev) =>
        prev.map((person) => {
          const newQuestTags = [...(personQuestLinks.get(person.id) ?? new Set<string>())];
          const linkedEntities = [...(entityNotesByEntity.get(`person:${person.id}`) ?? new Set<string>())];
          const nextNotes = upsertNetworkLine(person.notes, "Linked entities", linkedEntities);
          const nextAliases = mergeQuestAliases(person.aliases, [...(aliasUpdates.person.get(person.id) ?? new Set<string>())]);
          const nextRelationships = upsertQuestGraphRelationships(person.relationships, relationshipUpdates.person.get(person.id) ?? []);
          if (newQuestTags.length === 0 && nextNotes === person.notes && nextAliases === person.aliases && nextRelationships === person.relationships) return person;
          return {
            ...person,
            notes: nextNotes,
            aliases: nextAliases,
            relationships: nextRelationships,
            questTags: [...new Set([...(person.questTags ?? []), ...newQuestTags])],
          };
        })
      );
    }

    if (realmLocationLinks.size > 0 || realmQuestLinks.size > 0 || entityNotesByEntity.size > 0 || relationshipUpdates.realm.size > 0 || aliasUpdates.realm.size > 0) {
      setRealms((prev) =>
        prev.map((realm) => {
          const newLocationTags = [...(realmLocationLinks.get(realm.id) ?? new Set<string>())];
          const newQuestTags = [...(realmQuestLinks.get(realm.id) ?? new Set<string>())];
          const linkedEntities = [...(entityNotesByEntity.get(`realm:${realm.id}`) ?? new Set<string>())];
          const nextNotes = upsertNetworkLine(realm.notes, "Linked entities", linkedEntities);
          const nextAliases = mergeQuestAliases(realm.aliases, [...(aliasUpdates.realm.get(realm.id) ?? new Set<string>())]);
          const nextRelationships = upsertQuestGraphRelationships(realm.relationships, relationshipUpdates.realm.get(realm.id) ?? []);
          if (newLocationTags.length === 0 && newQuestTags.length === 0 && nextNotes === realm.notes && nextAliases === realm.aliases && nextRelationships === realm.relationships) return realm;
          return {
            ...realm,
            notes: nextNotes,
            aliases: nextAliases,
            relationships: nextRelationships,
            questTags: [...new Set([...(realm.questTags ?? []), ...newQuestTags])],
            locationTags: [...new Set([...(realm.locationTags ?? []), ...newLocationTags])],
          };
        })
      );
    }

    if (!enableInventoryLinking) {
      for (const link of graph.inventoryLinks ?? []) {
        defer("inventory_link", `questRef:${link.questRef}`, "Inventory linking deferred: disabled for this apply pass", "near_match_requires_review");
      }
      return finalizeWithReviewBatch();
    }

    const inventoryById = new Map(inventory.map((item) => [item.id, item] as const));

    const resolveQuestRef = (ref: string): string | "ambiguous" | null => {
      const localResolved = localKeyResolution.get(ref);
      if (localResolved?.kind === "quest") return localResolved.id;
      if (byId.quest.has(ref)) return ref;
      const resolution = resolveNamedEntity("quest", ref);
      if (resolution.status === "ambiguous") return "ambiguous";
      if (resolution.status === "resolved") return resolution.resolvedId ?? null;
      return null;
    };

    const pendingInventoryLinks = new Map<string, NonNullable<InventoryItem["questLink"]>>();

    for (const link of graph.inventoryLinks ?? []) {
      const linkKey = `questRef:${link.questRef}`;
      if (!link.questRef || !Array.isArray(link.items)) {
        skip("inventory_link", linkKey, "Malformed inventory link candidate", "malformed_graph_fragment");
        continue;
      }
      if (link.reviewState === "ambiguous" || link.reviewState === "unsupported") {
        defer("inventory_link", linkKey, `Inventory link reviewState=${link.reviewState}`, "near_match_requires_review");
        continue;
      }

      const resolvedQuestId = resolveQuestRef(link.questRef);
      if (resolvedQuestId === "ambiguous") {
        defer("inventory_link", linkKey, "Quest reference resolves to multiple quests", "ambiguous_entity_tie");
        continue;
      }
      if (!resolvedQuestId) {
        defer("inventory_link", linkKey, "Quest reference could not be resolved", "unresolved_entity_ref");
        continue;
      }

      for (const itemRef of link.items) {
        const itemKey = `${linkKey}|item:${itemRef.itemId}`;
        if (!itemRef.itemId || !itemRef.relevanceRole) {
          skip("inventory_link", itemKey, "Malformed graph item relevance reference", "malformed_graph_fragment");
          continue;
        }

        const resolvedItemId: string | null = inventoryById.has(itemRef.itemId) ? itemRef.itemId : null;
        const itemName = itemRef.itemName ?? inventoryById.get(itemRef.itemId)?.name ?? `Item ${itemRef.itemId}`;
        const referenceBase: QuestReferenceItem = {
          itemId: resolvedItemId ?? itemRef.itemId,
          itemName,
          relevanceRole: itemRef.relevanceRole,
          ...(itemRef.notes != null && itemRef.notes.trim() ? { notes: itemRef.notes.trim() } : {}),
          source: "parser_graph_v2",
          resolutionState: resolvedItemId ? "linked_inventory" : "mentioned_only",
          linkedAt: now,
        };

        if (!resolvedItemId) {
          addQuestReferenceItem(resolvedQuestId, referenceBase);
          defer("inventory_link", itemKey, "Item reference could not be resolved by id; stored as mentioned-only reference", "unresolved_entity_ref");
          continue;
        }

        const baseline = pendingInventoryLinks.get(resolvedItemId) ?? inventoryById.get(resolvedItemId)?.questLink;
        if (baseline?.questId && baseline.questId !== resolvedQuestId) {
          addQuestReferenceItem(resolvedQuestId, { ...referenceBase, resolutionState: "needs_review" });
          defer("inventory_link", itemKey, "Conflicting existing quest link on inventory item", "conflicting_item_link");
          continue;
        }

        addQuestReferenceItem(resolvedQuestId, referenceBase);
        pendingInventoryLinks.set(resolvedItemId, {
          questId: resolvedQuestId,
          relevanceRole: itemRef.relevanceRole,
          ...(itemRef.notes != null && itemRef.notes.trim() ? { notes: itemRef.notes.trim() } : {}),
          source: "parser_graph_v2",
          linkedAt: now,
        });
        apply("inventory_link", itemKey, `Linked inventory item ${resolvedItemId} to quest ${resolvedQuestId}`);
      }
    }

    if (pendingInventoryLinks.size > 0) {
      setInventory((prev) =>
        prev.map((item) => {
          const nextLink = pendingInventoryLinks.get(item.id);
          if (!nextLink) return item;
          if (
            item.questLink?.questId === nextLink.questId &&
            item.questLink?.relevanceRole === nextLink.relevanceRole &&
            (item.questLink?.notes ?? "") === (nextLink.notes ?? "")
          ) {
            return item;
          }
          return { ...item, questLink: nextLink };
        })
      );
    }

    if (questReferenceItemsById.size > 0) {
      setQuests((prev) =>
        prev.map((quest) => {
          const nextReferenceItems = upsertQuestReferenceItems(quest.referenceItems, questReferenceItemsById.get(quest.id) ?? []);
          return nextReferenceItems === quest.referenceItems ? quest : { ...quest, referenceItems: nextReferenceItems };
        })
      );
    }

    return finalizeWithReviewBatch();
  }, [inventory, locations, people, questGraphReviewQueue, quests, realms, showStatusPill]);

  return (
    <CharacterContext.Provider
      value={{
        character,
        attacks,
        resources,
        inventory,
        conditions,
        notes,
        wishlist,
        classFeatures,
        passiveFeatures,
        spellEffectUses,
        itemActionUses,
        spellSlots,
        rulesState,
        combatLogEntries,
        combatLogSessions,
        currentCharacterId,
        hasCharacter,
        loadCharacter,
        saveCurrentCharacter,
        clearCharacter,
        importAll,
        updateCharacter,
        updateHp,
        updateTempHp,
        updateNotes,
        updateCurrency,
        recordDeathSaveSuccess,
        recordDeathSaveFailure,
        stabilizeAtZeroHp,
        resetDeathSaveTracking,
        incrementResource,
        decrementResource,
        resetResource,
        applyResourceChanges,
        addResource,
        upsertResourceByName,
        useSpellEffect,
        rechargeSpellEffects,
        useItemEffect,
        rechargeItemEffects,
        expendSpellSlot,
        restoreSpellSlot,
        restoreAllSpellSlots,
        updateSpellSlotTotal,
        addCondition,
        removeCondition,
        applyConditionChanges,
        clearConditionsOnRest,
        tickConditions,
        decrementCondition,
        setConditionDuration,
        removeConditionsByConcentrationLink,
        addAttack,
        updateAttack,
        removeAttack,
        companions,
        addCompanion,
        updateCompanion,
        deleteCompanion,
        addCompanionFromMonster,
        addItem,
        removeItem,
        updateItem,
        toggleEquipped,
        splitStackItem,
        mergeStackItem,
        dispatchRuleTrigger,
        applyProposedItems,
        reorderInventory,
        applyHpChange,
        applyResolvedLocalDamage,
        addNote,
        updateNote,
        deleteNote,
        pinNote,
        journalArcs,
        addJournalArc,
        updateJournalArc,
        removeJournalArc,
        appendQuickEntry,
        addWishlistItem,
        updateWishlistItem,
        removeWishlistItem,
        convertWishlistItemToInventory,
        pinPerson,
        pinQuest,
        pinLocation,
        updateStatistics,
        incrementKillCount,
        addClassFeature,
        updateClassFeature,
        removeClassFeature,
        setClassFeatures,
        setPassiveFeatures,
        preparedSpells,
        addSpell,
        updateSpell,
        removeSpell,
        toggleSpellPrepared,
        people,
        addPerson,
        updatePerson,
        deletePerson,
        quests,
        addQuest,
        updateQuest,
        deleteQuest,
        locations,
        addLocation,
        updateLocation,
        deleteLocation,
        realms,
        addRealm,
        updateRealm,
        deleteRealm,
        pinRealm,
        applyQuestUpdate,
        getReviewBatches,
        resolveDeferredOperation,
        resolveBatch,
        applyResolvedOperations,
        markBatchArchived,
        applyDeferredInventoryLinksForBatch,
        pendingLevelUps,
        queueLevelUps: (count: number) => setPendingLevelUps(count),
        decrementPendingLevelUps: () => setPendingLevelUps((p) => Math.max(0, p - 1)),
        addLogNote,
        clearCombatLog,
        startNewSession,
        statusPill,
        showStatusPill,
        clearStatusPill,
      }}
    >
      {children}
    </CharacterContext.Provider>
  );
}

export function useCharacter(): CharacterContextType {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error("useCharacter must be used within CharacterProvider");
  return ctx;
}
