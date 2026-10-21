/**
 * Phase 1 quest parser contract types.
 *
 * These types define the shape of `questGraphResult` emitted alongside the
 * legacy parser outputs (questActions, personActions, locationActions,
 * realmActions). They carry structured graph intent from the parser but do
 * NOT trigger any apply, persistence, or review UI behavior in Phase 1.
 *
 * Consumers MUST treat questGraphResult as optional/nullable. All legacy
 * parser fields continue to be emitted and remain the source of truth for
 * any apply pipeline until Phase 2.
 */

// ---------------------------------------------------------------------------
// Review / confidence scaffolding
// ---------------------------------------------------------------------------

/** High-level review disposition for a parsed entity or operation. */
export type ParserReviewState =
  | "auto_apply"     // parser is confident; safe to apply without review
  | "needs_review"   // parser is uncertain; human confirmation required
  | "ambiguous"      // insufficient evidence; cannot determine intent
  | "unsupported";   // recognized but outside what the apply pipeline handles

/** A piece of source text that grounds a parser decision. */
export interface ParserSourceEvidence {
  /** Verbatim excerpt from player input that supports this decision. */
  excerpt: string;
  /** Confidence the excerpt actually supports the decision. */
  confidence: "high" | "medium" | "low";
}

/** A field whose value could not be resolved from the input. */
export interface ParserUnresolvedField {
  /** Name of the field that could not be resolved. */
  field: string;
  /** Human-readable reason why it is unresolved. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Graph entity scaffolding
// ---------------------------------------------------------------------------

/**
 * A reference to an entity that already exists in the player's campaign data.
 * When the parser matches a named entity to an existing record it emits a ref
 * rather than a candidate.
 */
export interface GraphEntityRef {
  /** Entity kind — aligns with the four legacy action categories. */
  kind: "quest" | "person" | "location" | "realm";
  /** Persistent id of the existing entity. */
  id: string;
  /** Display name at parse time (may differ from stored name). */
  name: string;
}

/**
 * An entity the parser believes should be created because no matching record
 * was found in context. The parser does NOT create it — Phase 2 apply does.
 */
export interface GraphEntityCandidate {
  /** Entity kind. */
  kind: "quest" | "person" | "location" | "realm";
  /**
   * Stable token for this candidate within the parser response.
   * Used to cross-reference from relationshipsToCreate, inventoryLinks, etc.
   */
  localKey: string;
  /** Proposed display name. */
  name: string;
  /** Additional attributes to populate on creation; shape varies by kind. */
  proposedAttributes: Record<string, unknown>;
  reviewState: ParserReviewState;
  evidence: ParserSourceEvidence[];
  unresolvedFields: ParserUnresolvedField[];
}

/**
 * A link from a named entity in the input to an already-existing record.
 * The parser is confident this is the same entity as an existing one.
 */
export interface GraphEntityLink {
  /** The entity kind. */
  kind: "quest" | "person" | "location" | "realm";
  /** Verbatim name as it appeared in the input. */
  mentionedName: string;
  /** The existing record being linked to. */
  resolvedRef: GraphEntityRef;
  reviewState: ParserReviewState;
  evidence: ParserSourceEvidence[];
}

// ---------------------------------------------------------------------------
// Relationship scaffolding
// ---------------------------------------------------------------------------

/**
 * A directional relationship the parser detected between two entities.
 * Both sides can point to either a GraphEntityRef (existing) or a
 * GraphEntityCandidate.localKey (to-be-created).
 */
export interface GraphRelationshipOperation {
  /**
   * Relationship verb: what kind of connection is being described.
    * Known values: "quest_giver", "located_in", "related_to", "part_of", "involves",
    * "contained_in", "contains_location".
   * Unknown values from the AI are preserved verbatim and will always have
   * `relationshipTypeKnown: false` and `reviewState: "needs_review"`.
   */
  relationshipType: string;
  /**
   * True if relationshipType is in the recognized vocabulary.
   * False for AI-generated types not in the known set — Phase 2 must not
   * route apply behavior on unknown types without review.
   */
  relationshipTypeKnown: boolean;
  /**
   * Source entity: either an existing entity ref id or candidate localKey.
   */
  fromEntityId: string;
  /**
   * Target entity: either an existing entity ref id or candidate localKey.
   */
  toEntityId: string;
  /** Optional human-readable label for the relationship. */
  label?: string;
  reviewState: ParserReviewState;
  evidence: ParserSourceEvidence[];
}

// ---------------------------------------------------------------------------
// Quest patch scaffolding
// ---------------------------------------------------------------------------

/**
 * A proposed change to a quest record.
 * Either points to an existing quest (via questId) or to a candidate
 * (via candidateLocalKey).
 */
export interface QuestObjectiveCandidate {
  /** Brief description of the objective. */
  description: string;
  /** Whether this objective is already completed. */
  completed: boolean;
}

export interface QuestGraphPatch {
  /**
   * Id of an existing quest being updated, or null if this is a new quest.
   */
  questId: string | null;
  /**
   * localKey of the corresponding GraphEntityCandidate if questId is null.
   */
  candidateLocalKey: string | null;
  name: string;
  type: "main" | "side" | "personal";
  status: "active" | "completed" | "failed";
  description: string | null;
  notes: string | null;
  objectives: QuestObjectiveCandidate[];
  reviewState: ParserReviewState;
  evidence: ParserSourceEvidence[];
}

// ---------------------------------------------------------------------------
// Inventory link scaffolding
// ---------------------------------------------------------------------------

/**
 * A reference to a proposed inventory item that the parser believes is
 * relevant to a quest or entity.
 * Links by the item id emitted in proposedInventoryChanges.
 */
export interface GraphItemRelevanceRef {
  /** The id from the corresponding ProposedInventoryItem. */
  itemId: string;
  /** Optional item display name, used when the item is mentioned but not yet owned. */
  itemName?: string;
  /** In what sense the item is relevant to this quest/entity. */
  relevanceRole: "quest_item" | "reward" | "key_item" | "other";
  notes: string | null;
}

/**
 * A proposed link between an inventory item and a quest or entity.
 */
export interface QuestInventoryLinkCandidate {
  /**
   * Id of an existing quest, or localKey of a GraphEntityCandidate.
   */
  questRef: string;
  /** Item references relevant to this quest. */
  items: GraphItemRelevanceRef[];
  reviewState: ParserReviewState;
}

// ---------------------------------------------------------------------------
// Ambiguity scaffolding
// ---------------------------------------------------------------------------

/**
 * An ambiguity the parser could not resolve from the input alone.
 * Preserved so a review step can present it to the user.
 */
export interface QuestParserAmbiguity {
  /** Short stable code for the kind of ambiguity. */
  kind:
    | "entity_match_conflict"  // multiple existing records match the name
    | "entity_type_unclear"    // unclear if person/location/realm/etc.
    | "relationship_unclear"   // relationship between entities is ambiguous
    | "intent_unclear"         // overall intent of the update is unclear
    | "other";
  /** Human-readable description of the ambiguity. */
  description: string;
  /** Which entities or fields are involved. */
  involvedKeys: string[];
}

// ---------------------------------------------------------------------------
// Apply hints (Phase 2 surface — present but empty/null in Phase 1)
// ---------------------------------------------------------------------------

/**
 * Hints the parser emits to guide the Phase 2 apply pipeline.
 * All fields optional — future phases may populate them.
 * Consumers MUST treat this as fully optional.
 */
export interface QuestParserApplyHints {
  /** Whether all entities are sufficiently resolved to auto-apply. */
  safeToAutoApply: boolean;
  /** Reason auto-apply is not safe, if applicable. */
  blockerReason: string | null;
}

// ---------------------------------------------------------------------------
// Top-level quest graph result
// ---------------------------------------------------------------------------

/**
 * The Phase 1 additive parser output field.
 *
 * Emitted by the /api/ai/parse-update endpoint alongside (not instead of)
 * the legacy questActions, personActions, locationActions, and realmActions
 * fields.
 *
 * Null if the parser produced no structured graph output or if the graph
 * block was malformed and could not be safely normalized.
 */
export interface QuestParserGraphResult {
  /**
   * Proposed changes to quest records.
   * May be empty if no quest changes were detected.
   */
  questPatch: QuestGraphPatch | null;
  /**
   * New entities the parser believes should be created.
   * The apply pipeline (Phase 2) is responsible for actually creating them.
   */
  entitiesToCreate: GraphEntityCandidate[];
  /**
   * Existing entities the parser has matched by name.
   */
  entitiesToLink: GraphEntityLink[];
  /**
   * Directional relationships between entities detected in the input.
   */
  relationshipsToCreate: GraphRelationshipOperation[];
  /**
   * Proposed links between inventory items and quest entities.
   */
  inventoryLinks: QuestInventoryLinkCandidate[];
  /**
   * Ambiguities the parser could not resolve.
   */
  ambiguities: QuestParserAmbiguity[];
  /**
   * Overall review disposition for the entire graph result.
   */
  reviewState: ParserReviewState;
  /**
   * Optional hints for the Phase 2 apply pipeline.
   */
  applyHints: QuestParserApplyHints | null;
}
