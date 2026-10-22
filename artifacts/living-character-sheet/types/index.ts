import type {
  CharacterMechanicsBlock,
  ItemMechanicsBlock,
  ItemMechanicsImportExportEnvelope,
  ParsedItemMechanicsCandidate,
} from "./mechanics";
import type { QuestParserGraphResult } from "./questParser";

export * from "./mechanics";
export * from "./questParser";
export * from "./combatResolution";
export * from "./aiDmContracts";
export * from "./aiDmStyle";
export * from "./aiDmJournal";
export * from "./aiDmPolicy";

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface SavingThrow {
  ability: keyof AbilityScores;
  proficient: boolean;
  modifier: number;
}

export interface Skill {
  name: string;
  ability: keyof AbilityScores;
  proficient: boolean;
  expertise: boolean;
  modifier: number;
}

export interface OptionalEffectReminder {
  id: string;
  name: string;
  description: string;
  resourceCost?: string;
  condition?: string;
}

export interface AdditionalDamage {
  dice?: string;
  damageModifier?: number;
  damageType: string;
  /** Set when this entry is auto-injected from an equipped item's attack_damage effect */
  sourceLabel?: string;
  /** Bounded conditional support: apply this extra only when attacking a target with the named condition. */
  triggerType?: "vs_condition";
  triggerCondition?: string;
}

export interface Attack {
  id: string;
  name: string;
  pinned?: boolean;
  attackBonus: number;
  damageDice: string;
  damageModifier: number;
  damageType: string;
  additionalDamage?: AdditionalDamage[];
  range?: string;
  notes?: string;
  reminders: OptionalEffectReminder[];
  linkedInventoryItemId?: string;
  maxTargets?: number;
}

export type ResourceResetType = "short_rest" | "long_rest" | "dawn" | "custom";

export interface Resource {
  id: string;
  name: string;
  current: number;
  max: number;
  resetOn: ResourceResetType;
  color?: string;
  notes?: string;
}

export type ItemCategory =
  | "weapon"
  | "armor"
  | "accessory"
  | "consumable"
  | "quest"
  | "magic"
  | "gear"
  | "treasure"
  | "map"
  | "other";

export type ItemEffectType = "stat_bonus" | "attack_damage" | "spell" | "buff" | "feature" | "note";

/** Stats that equipped items can numerically modify */
export type EquippedStatKey =
  | "armorClass"
  | "speed"
  | "initiative"
  | "maxHp"
  | "passivePerception"
  | "proficiencyBonus"
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export type ActionType = "action" | "bonus_action" | "reaction" | "free";

export interface ItemEffect {
  id: string;
  type: ItemEffectType;
  label: string;
  pinned?: boolean;
  description?: string;
  /** Explicit action economy type. When set, surfaces this effect in the Actions tab. */
  actionType?: ActionType;
  /** Structured stat bonus — present when type === "stat_bonus" and a specific stat was selected */
  statKey?: EquippedStatKey;
  statValue?: number;
  /** Attack effect bonuses — present when type === "attack_damage" */
  attackDamageDice?: string;
  attackDamageBonus?: number;
  attackDamageType?: string;
  /** Bounded conditional support: only apply when target has a specific condition. */
  triggerType?: "vs_condition";
  triggerCondition?: string;
  attackToHitBonus?: number;
  /**
   * Resource max bonus — present when type === "feature" and the effect increases a tracked resource.
   * resourceName is matched case-insensitively against Resource.name.
   */
  resourceName?: string;
  resourceMaxBonus?: number;
  /**
   * Spell grant — present when type === "spell". Tracks limited-use spells from equipment.
   */
  uses?: number;
  resetOn?: "short_rest" | "long_rest" | "dawn";
  maxTargets?: number;
}

export interface ItemMechanicsCompatibilityShape {
  notes?: string;
  attackAbility?: keyof AbilityScores;
  isProficient?: boolean;
  /** When false, generated weapon attacks omit ability modifier from damage. */
  useAbilityModifierForDamage?: boolean;
  damageDice?: string;
  damageModifier?: number;
  damageType?: string;
  additionalDamage?: AdditionalDamage[];
  weaponRange?: string;
  equippedEffects?: ItemEffect[];
}

export interface ItemMechanicsCompatibilityCarrier extends ItemMechanicsCompatibilityShape {
  mechanics?: ItemMechanicsBlock;
}

export type ItemMechanicsParserPayloadCandidate = ParsedItemMechanicsCandidate | ItemMechanicsBlock;

export interface ItemMechanicsEnvelopeRoundTrip {
  envelope: ItemMechanicsImportExportEnvelope;
  compatibilityShape: ItemMechanicsCompatibilityShape;
}

export interface InventoryItem {
  id: string;
  name: string;
  pinned?: boolean;
  quantity: number;
  equipped: boolean;
  category: ItemCategory;
  notes?: string;
  weight?: number;
  value?: number;
  /**
   * @deprecated Backward-compat projection only. Canonical source is `InventoryItem.mechanics`.
   * Runtime reads should use `getRuntimeItemProjectedEffects` from
   * `@/utils/mechanics/runtimeMechanicsCompatibility` instead of reading this field directly.
   * Retained for compatibility with saved character data that pre-dates the mechanics block;
   * must not be removed until a DB migration is separately tracked.
   */
  equippedEffects?: ItemEffect[];
  // Weapon stats — if set, auto-generates an attack card when equipped
  attackAbility?: keyof AbilityScores;  // which ability mod to use (auto-computes bonus)
  isProficient?: boolean;               // omitted = true by default
  /** When false, generated weapon attacks omit ability modifier from damage. */
  useAbilityModifierForDamage?: boolean;
  damageDice?: string;
  damageModifier?: number;
  damageType?: string;
  additionalDamage?: AdditionalDamage[];
  weaponRange?: string;
  imageUri?: string;
  imageSource?: "dm" | "player";
  suppressWeaponCard?: boolean;         // when true, no attack card generated (damage merges via equippedEffects)
  subtype?: string;                     // e.g. "Knuckle Dusters", "Longsword", "Leather Armor"
  tags?: string[];                      // rarity, weapon properties, attunement, etc.
  sourceTag?: "official" | "custom";
  mechanics?: ItemMechanicsBlock;
  /**
   * Phase 2 additive quest-link metadata from questGraphResult inventoryLinks.
   * This never changes item identity or combat mechanics.
   */
  questLink?: InventoryQuestLinkMetadata;
}

export interface InventoryQuestLinkMetadata {
  questId: string;
  relevanceRole: "quest_item" | "reward" | "key_item" | "other";
  notes?: string;
  source: "parser_graph_v2";
  linkedAt: number;
}

export interface QuestObjectiveRecord {
  description: string;
  completed: boolean;
  source: "manual" | "parser_graph_v2";
  updatedAt: number;
}

export interface QuestReferenceItem {
  itemName: string;
  itemId?: string;
  relevanceRole: "quest_item" | "reward" | "key_item" | "other";
  notes?: string;
  source: "parser_graph_v2";
  resolutionState: "linked_inventory" | "mentioned_only" | "needs_review";
  linkedAt: number;
}

export interface QuestGraphRelationshipRecord {
  relationshipType: string;
  direction: "outgoing" | "incoming";
  otherKind: "quest" | "person" | "location" | "realm";
  otherId: string;
  otherName?: string;
  label?: string;
  source: "parser_graph_v2";
  reviewState: "confirmed" | "needs_review";
  confidence: "high" | "medium" | "low";
  evidenceExcerpts?: string[];
  updatedAt: number;
}

export type QuestGraphApplyReasonCode =
  | "unknown_relationship_type"
  | "low_confidence_relationship"
  | "unresolved_entity_ref"
  | "ambiguous_entity_tie"
  | "near_match_requires_review"
  | "conflicting_item_link"
  | "malformed_graph_fragment";

export type QuestGraphApplySection =
  | "quest_patch"
  | "entity_create"
  | "entity_link"
  | "relationship"
  | "inventory_link";

export interface QuestGraphApplyReceipt {
  section: QuestGraphApplySection;
  key: string;
  detail: string;
  reasonCode?: QuestGraphApplyReasonCode;
}

export interface QuestGraphApplyReport {
  applied: QuestGraphApplyReceipt[];
  deferred: QuestGraphApplyReceipt[];
  skipped: QuestGraphApplyReceipt[];
  batchId?: string;
  sourceType?: "quick_update" | "loot_review";
  summary: {
    applied: number;
    deferred: number;
    skipped: number;
  };
}

export type QuestGraphReviewBatchStatus =
  | "open"
  | "ready_to_apply"
  | "partially_resolved"
  | "resolved"
  | "resolved_with_failures"
  | "archived";

export type QuestGraphResolutionState =
  | "pending"
  | "approved"
  | "rejected"
  | "applied"
  | "failed";

export type QuestGraphResolutionAction =
  | "confirm_create"
  | "confirm_link"
  | "reject"
  | "downgrade_to_note_only"
  | "reclassify_item_relevance"
  | "apply_inventory_link"
  | "apply_location_parent"
  | "keep_location_unparented";

export interface QuestGraphResolutionDecision {
  action: QuestGraphResolutionAction;
  resolvedEntityId?: string;
  fromEntityId?: string;
  toEntityId?: string;
  targetEntityId?: string;
  noteText?: string;
  approvedName?: string;
  approvedKind?: "quest" | "person" | "location" | "realm";
  questId?: string;
  inventoryItemId?: string;
  newRelevanceRole?: "quest_item" | "reward" | "key_item" | "other";
}

export interface QuestGraphDeferredOperation {
  operationId: string;
  section: QuestGraphApplySection;
  key: string;
  reasonCode?: QuestGraphApplyReasonCode;
  detail: string;
  payloadSnapshot?: unknown;
  payloadFingerprint?: string;
  replayable?: boolean;
  attemptCount?: number;
  lastAttemptedAt?: number;
  resolutionState: QuestGraphResolutionState;
  resolutionDecision?: QuestGraphResolutionDecision;
  resolvedAt?: number;
  appliedAt?: number;
  failureReason?: string;
}

export interface QuestGraphReviewBatch {
  batchId: string;
  createdAt: number;
  schemaVersion?: number;
  sourceType: "quick_update" | "loot_review";
  rawInputSummary: string;
  dedupeKey?: string;
  status: QuestGraphReviewBatchStatus;
  operations: QuestGraphDeferredOperation[];
  lastAppliedAt?: number;
  archivedAt?: number;
}

export interface QuestGraphResolutionResult {
  batchId: string;
  applied: number;
  rejected: number;
  failed: number;
  pending: number;
}

export interface CharacterStatistics {
  /** Enemies killed — incremented manually */
  killCount: number;
  /** Total gold pieces earned (gp + pp*10 + ep*0.5 + sp*0.1 + cp*0.01), accumulated as positive currency changes */
  totalGoldEarned: number;
  /** Total inventory items added to the sheet */
  lootItemsAdded: number;
  /** Times HP dropped to 5 or below from a higher value */
  nearDeaths: number;
  /** Total HP recovered via healing */
  totalHpHealed: number;
  /** Total HP lost to damage */
  totalDamageTaken: number;
}

export interface DeathSaveState {
  successes: number;
  failures: number;
  stable: boolean;
  dead?: boolean;
}

export interface Character {
  id: string;
  name: string;
  profileImageUri?: string;
  class: string;
  subclass?: string;
  level: number;
  race: string;
  background: string;
  alignment?: string;
  proficiencyBonus: number;
  armorClass: number;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  speed: number;
  initiative: number;
  abilityScores: AbilityScores;
  savingThrows: SavingThrow[];
  skills: Skill[];
  passivePerception: number;
  currency: {
    cp: number;
    sp: number;
    ep: number;
    gp: number;
    pp: number;
  };
  notes: string;
  personalityTrait?: string;
  ideal?: string;
  bond?: string;
  flaw?: string;
  languages?: string[];
  toolProficiencies?: string[];
  weaponMasteries?: string[];
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  /** Optional homebrew rule definitions consumed by the runtime rules registry. */
  homebrewRules?: Array<Record<string, unknown>>;
  mechanics?: CharacterMechanicsBlock;
  feats?: Feat[];
  asiHistory?: AbilityScoreIncreaseRecord[];
  statistics?: CharacterStatistics;
  deathSaves?: DeathSaveState;
}

export interface ProposedInventoryItem {
  id: string;
  name: string;
  quantity: number;
  category: ItemCategory;
  value?: number;
  weight?: number;
  subtype?: string;
  notes?: string;
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  // Optional weapon stats — user can set these during review before adding
  attackAbility?: keyof AbilityScores;
  isProficient?: boolean;
  useAbilityModifierForDamage?: boolean;
  damageDice?: string;
  damageModifier?: number;
  damageType?: string;
  additionalDamage?: AdditionalDamage[];
  weaponRange?: string;
  // Optional effects — parsed from magic/accessory item cards
  equippedEffects?: ItemEffect[];
  /** Set when this item was automatically merged from multiple scan results */
  _mergedCount?: number;
  /** Tags from official D&D 5e item verification: rarity, type, attunement, cursed */
  tags?: string[];
  /** True when the AI matched this to an exact official D&D 5e item */
  officialMatch?: boolean;
  sourceTag?: "official" | "custom";
  mechanics?: ItemMechanicsBlock;
}

export interface ProposedCurrencyChange {
  cp?: number;
  sp?: number;
  ep?: number;
  gp?: number;
  pp?: number;
}

export interface ProposedResourceChange {
  resourceId: string;
  resourceName: string;
  delta: number;
}

export interface ProposedHpChange {
  delta: number;
  type: "damage" | "heal";
}

export interface ProposedAttackCalc {
  attackName: string;
  rawRoll: number;
  attackBonus: number;
  totalToHit: number;
}

export type ConditionRemoval = "short_rest" | "long_rest" | "save" | "manual";

export type ConditionDurationType =
  | "rounds"
  | "turns"
  | "untilShortRest"
  | "untilLongRest"
  | "encounter"
  | "concentration"
  | "manual"
  | "permanent";

export type ConditionTickTiming = "onTargetTurnEnd" | "onRoundAdvance" | "manualOnly";

export interface ActiveCondition {
  id: string;
  name: string;
  source?: string;
  removeOn: ConditionRemoval[];
  notes?: string;
  /** Optional duration tracking — backward-compatible, all fields optional */
  durationType?: ConditionDurationType;
  durationValue?: number;
  remainingDuration?: number;
  tickTiming?: ConditionTickTiming;
  concentrationLink?: string;
}

export interface ProposedConditionChange {
  name: string;
  action: "add" | "remove";
  source?: string;
  removeOn: ConditionRemoval[];
  notes?: string;
}

export interface QuickUpdateResult {
  rawInput: string;
  summary: string;
  type:
    | "inventory"
    | "currency"
    | "resource"
    | "hp"
    | "attack"
    | "condition"
    | "quest"
    | "mixed"
    | "unknown";
  proposedInventoryChanges: ProposedInventoryItem[];
  proposedCurrencyChange?: ProposedCurrencyChange;
  proposedResourceChanges: ProposedResourceChange[];
  proposedHpChange?: ProposedHpChange;
  proposedAttackCalc?: ProposedAttackCalc;
  proposedConditionChanges: ProposedConditionChange[];
  questActions?: QuestAction[];
  personActions?: PersonAction[];
  locationActions?: LocationAction[];
  realmActions?: PlaneAction[];
  /** Phase 1 additive quest graph output. Null if parser produced no graph or graph was malformed. */
  questGraphResult?: QuestParserGraphResult | null;
}

export interface LootAnalysisResult {
  sourceType: "photo" | "text";
  summary: string;
  proposedItems: ProposedInventoryItem[];
  proposedCurrencyChange?: ProposedCurrencyChange;
  confidence: "high" | "medium" | "low";
  rawAnalysis?: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  /** Journal optional metadata — backward-compatible */
  sessionNumber?: number;
  arcName?: string;
  tags?: string[];
  linkedNpcs?: string[];
  linkedLocations?: string[];
  linkedQuests?: string[];
}

export interface JournalArc {
  id: string;
  name: string;
  description?: string;
  sessionStart?: number;
  sessionEnd?: number;
  pinned: boolean;
}

export type WishlistStatus = "wanted" | "discussed" | "shopping" | "acquired";

export interface WishlistItem {
  id: string;
  name: string;
  category?: ItemCategory;
  rarityTarget?: string;
  notes?: string;
  priority?: number;
  source?: string;
  status: WishlistStatus;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type NpcRelationship = "ally" | "neutral" | "hostile" | "unknown";

export interface NpcPerson {
  id: string;
  name: string;
  aliases?: string[];
  role?: string;
  relationship: NpcRelationship;
  description?: string;
  questTags: string[];
  locationTags?: string[];
  peopleTags?: string[];
  planeTags?: string[];
  relationships?: QuestGraphRelationshipRecord[];
  notes?: string;
  createdAt: number;
  pinned?: boolean;
  /** Set when this person is killed or dies in-world */
  deceased?: boolean;
  /** Short note describing how/by whom they died */
  deceasedNote?: string;
}

export type QuestType = "main" | "side" | "personal";
export type QuestStatus = "active" | "completed" | "failed";
export type QuestLocationLinkMode = "direct_only" | "inherit_to_descendants";

export interface Quest {
  id: string;
  name: string;
  aliases?: string[];
  type: QuestType;
  status: QuestStatus;
  description?: string;
  objectives?: QuestObjectiveRecord[];
  locationTags: string[];
  locationLinkModes?: Record<string, QuestLocationLinkMode>;
  peopleTags?: string[];
  relationships?: QuestGraphRelationshipRecord[];
  referenceItems?: QuestReferenceItem[];
  notes?: string;
  createdAt: number;
  pinned?: boolean;
}

export interface CampaignLocation {
  id: string;
  name: string;
  aliases?: string[];
  parentLocationId?: string;
  description?: string;
  mapImageUri?: string;
  questTags: string[];
  relationships?: QuestGraphRelationshipRecord[];
  notes?: string;
  createdAt: number;
  pinned?: boolean;
}

export type DmCampaignItemLootRole = "quest_item" | "reward" | "loot" | "other";

export interface DmCampaignItem {
  equippedEffects?: ItemEffect[];
  consumptionEffects?: ItemEffect[];
  mechanics?: ItemMechanicsBlock;
  damageDice?: string;
  damageModifier?: number;
  damageType?: string;
  id: string;
  name: string;
  quality?: string;
  category?: string;
  subtype?: string;
  tags?: string[];
  value?: string;
  valueCurrency?: "cp" | "sp" | "gp" | "pp";
  weight?: string;
  attunement?: boolean;
  attunementReq?: string;
  properties?: string;
  description?: string;
  notes?: string;
  questTags?: string[];
  peopleTags?: string[];
  locationTags?: string[];
  lootRole?: DmCampaignItemLootRole;
  createdAt: number;
  pinned?: boolean;
}

export interface Plane {
  id: string;
  name: string;
  aliases?: string[];
  description?: string;
  questTags: string[];
  locationTags: string[];
  relationships?: QuestGraphRelationshipRecord[];
  notes?: string;
  createdAt: number;
  pinned?: boolean;
}

export type SpellSchool =
  | "Abjuration" | "Conjuration" | "Divination" | "Enchantment"
  | "Evocation" | "Illusion" | "Necromancy" | "Transmutation";

/** A spell the character knows or has prepared */
export interface PreparedSpell {
  id: string;
  name: string;
  pinned?: boolean;
  level: number;            // 0 = cantrip, 1–9 = leveled spell
  school?: SpellSchool;
  castingTime?: string;     // "1 action", "1 bonus action", "1 reaction", "1 minute", etc.
  range?: string;           // "Touch", "60 feet", "Self", etc.
  duration?: string;        // "Instantaneous", "Concentration, up to 1 minute", etc.
  concentration?: boolean;
  ritual?: boolean;
  description?: string;
  prepared: boolean;        // true = active/prepared; false = known but not prepared today
  createdAt: number;
}

/** Spell slot state — tracks used slots per level (1-9) */
export interface SpellSlotLevel {
  level: number;
  total: number;
  used: number;
}

export type CombatLogEntryType =
  | "hp_damage"
  | "hp_heal"
  | "resource_spend"
  | "resource_restore"
  | "condition_add"
  | "condition_remove"
  | "session_start"
  | "long_rest";

export interface CombatLogEntry {
  id: string;
  timestamp: number;
  sessionId: string;
  type: CombatLogEntryType;
  description: string;
  source: "manual" | "ai";
  userNote?: string;
}

export interface SessionLog {
  id: string;
  startedAt: number;
  label?: string;
}

export interface Feat {
  id: string;
  name: string;
  description?: string;
  source?: string; // "ASI", "class", "race", etc.
}

export interface AbilityScoreIncreaseRecord {
  level: number;
  changes: Partial<Record<keyof AbilityScores, number>>;
}

export interface ClassFeature {
  id: string;
  name: string;
  pinned?: boolean;
  description: string;
  actionType?: ActionType;
  source: string; // "class" | "subclass" | "race" | "background"
  /** Canonical source category for this feature record. */
  originKind?: "stored" | "derived" | "rules_generated" | "progression_generated" | "manual";
  /** Lightweight explainability detail for why/how the feature was added. */
  explanation?: string;
  levelGained?: number;
  maxTargets?: number;
}

/** Full serialisable snapshot used for import/export JSON */
/**
 * Rule engine types (for future rules-expression system)
 */
export interface RuleProvenance {
  ruleId: string;
  ruleName: string;
  trigger: string;
  condition: string;
  appliedEffectIds: string[];
}

export interface AppliedRuleEffect {
  id: string;
  ruleId: string;
  effectType: string;
  label?: string;
  statKey?: string;
  statValue?: number;
  actionName?: string;
  resourceId?: string;
  resourceName?: string;
  amount?: number;
  actionType?: ActionType;
  spellId?: string;
  spellName?: string;
  conditionName?: string;
  lifetime?: "permanent" | "until_unequip" | "until_remove_condition" | "concentration" | "rounds";
  linkedEntity?: string;
  appliedAt: number;
}

export interface RulesEngineState {
  schemaVersion: number;
  appliedEffects: AppliedRuleEffect[];
  activeProvenances: RuleProvenance[];
}

export interface CharacterSnapshot {
  _version: number;
  character: Character;
  attacks: Attack[];
  resources: Resource[];
  inventory: InventoryItem[];
  conditions: ActiveCondition[];
  notes: Note[];
  wishlist?: WishlistItem[];
  journalArcs?: JournalArc[];
  spellSlots?: SpellSlotLevel[];
  /** Remaining limited-use effects by stable effect ID; absent only in older saves. */
  spellEffectUses?: Record<string, number>;
  itemActionUses?: Record<string, number>;
  classFeatures?: ClassFeature[];
  passiveFeatures?: ClassFeature[];
  preparedSpells?: PreparedSpell[];
  people?: NpcPerson[];
  quests?: Quest[];
  locations?: CampaignLocation[];
  realms?: Plane[];
  companions?: Companion[];
  combatLog?: {
    entries: CombatLogEntry[];
    sessions: SessionLog[];
  };
  /** Rules engine state (feature-flagged, backward-compatible) */
  rulesState?: RulesEngineState;
  mechanics?: CharacterMechanicsBlock;
  /** Phase 3 additive deferred quest-graph review queue persistence. */
  questGraphReviewQueue?: QuestGraphReviewBatch[];
}

// ── Quest Update (AI parse result) ────────────────────────────────────────

// ── Open5e Types ──────────────────────────────────────────────────────────
export interface Open5eFeat {
  slug: string;
  name: string;
  desc: string;
  prerequisites?: string;
  reference_abr?: string;
}

export interface Open5eBackground {
  slug: string;
  name: string;
  desc: string;
  feature?: string;
  feature_desc?: string;
  reference_abr?: string;
}

export interface Open5eCondition {
  slug: string;
  name: string;
  desc: string;
  reference_abr?: string;
}

export interface Open5eMonster {
  slug: string;
  name: string;
  size: string;
  type: string;
  subtype: string;
  group?: string;
  alignment: string;
  armor_class: number;
  hit_points: number;
  hit_dice: string;
  speed: string;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  challenge_rating: string;
  actions?: Array<{ name: string; desc: string }>;
  legendary_actions?: Array<{ name: string; desc: string }>;
  special_abilities?: Array<{ name: string; desc: string }>;
  [key: string]: any;
}

export interface QuestAction {
  action: "create" | "update";
  questId: string | null;
  name: string;
  type: QuestType;
  status: QuestStatus;
  description: string | null;
  notes: string | null;
  locationNames: string[];
  personNames: string[];
}

export interface PersonAction {
  action: "create" | "update";
  personId: string | null;
  name: string;
  role: string | null;
  relationship: NpcRelationship;
  description: string | null;
  notes: string | null;
}

export interface LocationAction {
  action: "create" | "update";
  locationId: string | null;
  name: string;
  description: string | null;
}

export interface PlaneAction {
  action: "create" | "update";
  realmId: string | null;
  name: string;
  description: string | null;
  locationNames: string[];
}

export interface QuestUpdateResult {
  summary: string;
  questActions: QuestAction[];
  personActions: PersonAction[];
  locationActions: LocationAction[];
  realmActions: PlaneAction[];
  /**
   * Phase 2 additive graph payload consumed as a second-pass enrichment layer.
   */
  questGraphResult?: QuestParserGraphResult | null;
}

// ── Loot Generator Types ──────────────────────────────────────────────────

export type LootGeneratorMode = "single" | "batch";

export interface LootFilterCriteria {
  rarity?: string[];                // e.g. ["Common", "Uncommon", "Rare"]
  category?: ItemCategory[];        // e.g. ["weapon", "armor", "magic"]
  tags?: string[];                  // e.g. ["Magical", "Cursed", "Silvered"]
  valueRange?: { min: number; max: number }; // in GP
  planeOrigins?: string[];          // e.g. ["Material", "Shadowfell", "Custom"]
  name?: string;                    // optional search by name
}

export interface LootBuilderState {
  mode: LootGeneratorMode;
  filters: LootFilterCriteria;
  itemPool: InventoryItem[];        // all available items to search from
  selectedItems: (InventoryItem | ProposedInventoryItem)[]; // current draft
  customItems: InventoryItem[];     // items created/modified during this session
}

export interface TailorEntityInput {
  entityType: "npc" | "character" | "beast";
  entityId?: string;                // ID if loaded from app
  jsonData?: unknown;               // Raw JSON if uploaded
}

export interface LootRecommendationContext {
  name: string;
  entityType: "npc" | "character" | "beast";
  level?: number;
  characterClass?: string;
  race?: string;
  primaryAbility?: keyof AbilityScores;
  secondaryAbilities?: (keyof AbilityScores)[];
  armorClass?: number;
  currentHp?: number;
  maxHp?: number;
  challengeRating?: string;
  damageResistances?: string[];
  damageImmunities?: string[];
  skills?: string[];
  spells?: string[];
  specialAbilities?: string[];
  personalityHints?: string[];
  gearGaps?: string[];             // what this entity is missing (e.g., "AC boost", "damage output")
}

// ── Mutation History (undo/redo layer) ────────────────────────────────────

export interface MutationDelta {
  id: string;
  /** Short human label, e.g. "HP", "Gold (GP)", "Rage", "Poisoned" */
  label: string;
  /** Serialised "before" value for display and undo. */
  before: string;
  /** Serialised "after" value for display. */
  after: string;
  /** The raw fragment of source text responsible, if available. */
  sourceText?: string;
  /** Whether the user has approved this delta (default true). */
  approved: boolean;
}

export interface MutationBatchSnapshot {
  /** Partial snapshot of character fields BEFORE the batch was applied. */
  currentHp?: number;
  tempHp?: number;
  currency?: { cp: number; sp: number; ep: number; gp: number; pp: number };
  /** resource deltas stored as { id, prior current } */
  resourceStates?: Array<{ id: string; name: string; priorCurrent: number }>;
  /** condition ids that EXISTED before (conditions added by this batch can be removed on undo) */
  conditionsBefore?: Array<{ id: string; name: string }>;
}

export interface MutationBatch {
  id: string;
  /** Unix ms timestamp of application. */
  timestamp: number;
  /** "manual" or "ai" */
  source: "manual" | "ai";
  /** Summary description shown in history list. */
  description: string;
  /** Individual deltas shown in the review card. */
  deltas: MutationDelta[];
  /** Snapshot of relevant fields taken BEFORE apply, used for undo. */
  beforeSnapshot: MutationBatchSnapshot;
  /** Display-only history stage; neither stage proves reversibility. */
  recordingStage?: "applied" | "awaiting_item_review";
  /** True once all deltas have been applied to character state. */
  applied: boolean;
  /** Legacy undo marker. It does not establish that a reversal was complete. */
  undone: boolean;
}

/** Custom user-created monster for the compendium */
export interface CustomMonster {
  id: string;
  name: string;
  size: string;
  type: string;
  alignment: string;
  armor_class: number;
  hit_points: number;
  hit_dice: string;
  speed: string;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  challenge_rating: string;
  actions?: Array<{ name: string; desc: string }>;
  special_abilities?: Array<{ name: string; desc: string }>;
  notes?: string;
  level?: number;
  levelLabel?: string;
  loot?: Array<{ name: string; quantity: number; category?: string }>;
  createdAt: number;
  updatedAt: number;
}

/** Union of official and custom monsters for the compendium */
export type CompendiumMonster = Open5eMonster | CustomMonster;

/** Disposition of a creature in combat */
export type Disposition = "hostile" | "passive" | "friendly";

// ── Companion Types ──────────────────────────────────────────────────────────

/** A companion creature linked to a character (pet, familiar, mount, etc.) */
export interface Companion {
  id: string;
  characterId: string;
  name: string;
  type: string;
  size: string;
  alignment: string;
  armor_class: number;
  hit_points: number;
  max_hit_points: number;
  hit_dice: string;
  speed: string;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  challenge_rating: string;
  actions?: Array<{ name: string; desc: string }>;
  special_abilities?: Array<{ name: string; desc: string }>;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type CompanionAction = 
  | { action: "add"; companion: Omit<Companion, "id" | "createdAt" | "updatedAt"> }
  | { action: "update"; companionId: string; updates: Partial<Omit<Companion, "id" | "characterId" | "createdAt">> }
  | { action: "delete"; companionId: string };
