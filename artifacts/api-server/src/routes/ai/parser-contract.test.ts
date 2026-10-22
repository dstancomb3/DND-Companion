import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";

const aiModule = await import("./index");

const { normalizeQuickUpdateResult, normalizeLootAnalysisResult } = aiModule;

test("quick update normalization preserves deferred-review quest graph contracts", () => {
  const normalized = normalizeQuickUpdateResult({
    rawInput: "We got a quest scroll in Scrill.",
    summary: "Quest mention with unresolved intent",
    type: "mixed",
    proposedInventoryChanges: [
      {
        id: "item_scroll_1",
        name: "Sealed Quest Scroll",
        quantity: 1,
        category: "quest",
        confidence: "medium",
        needsReview: true,
        notes: "",
        tags: ["scroll", "single use"],
      },
    ],
    questActions: [
      {
        action: "create",
        questId: null,
        name: "Find the Relic",
        type: "side",
        status: "active",
        description: null,
        notes: null,
        locationNames: ["Scrill"],
        personNames: ["Mayor"],
      },
    ],
    locationActions: [
      {
        action: "create",
        locationId: null,
        name: "Scrill",
        description: null,
      },
    ],
    questGraphResult: {
      questPatch: {
        questId: null,
        candidateLocalKey: "quest_find_relic",
        name: "Find the Relic",
        type: "side",
        status: "active",
        description: null,
        notes: null,
        objectives: [],
        reviewState: "needs_review",
        evidence: [{ excerpt: "Find the relic", confidence: "medium" }],
      },
      entitiesToCreate: [
        {
          kind: "location",
          localKey: "loc_scrill",
          name: "Scrill",
          proposedAttributes: {},
          reviewState: "needs_review",
          evidence: [{ excerpt: "Scrill", confidence: "medium" }],
          unresolvedFields: [{ field: "region", reason: "not specified" }],
        },
      ],
      entitiesToLink: [],
      relationshipsToCreate: [
        {
          relationshipType: "quest_giver",
          fromEntityId: "quest_find_relic",
          toEntityId: "person_mayor",
          label: null,
          reviewState: "needs_review",
          evidence: [{ excerpt: "Mayor asked", confidence: "medium" }],
        },
      ],
      inventoryLinks: [
        {
          questRef: "quest_find_relic",
          items: [{ itemId: "item_scroll_1", relevanceRole: "quest_item", notes: null }],
          reviewState: "needs_review",
        },
      ],
      ambiguities: [
        {
          kind: "intent_unclear",
          description: "Not sure the quest was accepted yet",
          involvedKeys: ["quest_find_relic"],
        },
      ],
      reviewState: "needs_review",
      applyHints: { safeToAutoApply: false, blockerReason: "Needs confirmation" },
    },
  }) as Record<string, unknown>;

  const questGraphResult = normalized["questGraphResult"] as Record<string, unknown> | null;
  assert.ok(questGraphResult);
  assert.equal(questGraphResult?.["reviewState"], "needs_review");

  const proposedInventoryChanges = normalized["proposedInventoryChanges"] as Record<string, unknown>[];
  assert.equal(proposedInventoryChanges.length, 1);
  assert.equal(proposedInventoryChanges[0]?.["name"], "Sealed Quest Scroll");
  assert.equal(proposedInventoryChanges[0]?.["notes"], "A scroll that carries written instructions or magic; identify its purpose before use.");
});

test("loot normalization keeps review-safe defaults for missing optional fields", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "One suspicious wand-like object",
    confidence: "low",
    proposedItems: [
      {
        id: "loot1",
        name: "Unknown Wand",
        quantity: 1,
        category: "magic",
        notes: "",
        needsReview: true,
      },
    ],
    proposedCurrencyChange: { gp: 25, sp: 3 },
  }) as Record<string, unknown>;

  assert.equal(normalized["sourceType"], "photo");
  assert.equal(normalized["confidence"], "low");

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  assert.equal(items.length, 1);
  assert.equal(items[0]?.["needsReview"], true);
  assert.equal(items[0]?.["notes"], "A magical item with special properties; attunement may be required.");

  const currency = normalized["proposedCurrencyChange"] as Record<string, unknown>;
  assert.equal(currency["gp"], 25);
  assert.equal(currency["sp"], 3);
  assert.equal(currency["cp"], null);
});

test("loot normalization merges duplicate items and sums quantity", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "Duplicate rations listed twice",
    proposedItems: [
      {
        id: "loot_ration_a",
        name: "Ration Pack",
        quantity: 2,
        category: "gear",
        notes: "Travel-ready food.",
        tags: ["common", "consumable"],
      },
      {
        id: "loot_ration_b",
        name: "Ration Pack",
        quantity: 3,
        category: "gear",
        notes: "Travel-ready food.",
        tags: ["consumable", "common"],
      },
    ],
  }) as Record<string, unknown>;

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  assert.equal(items.length, 1);
  assert.equal(items[0]?.["name"], "Ration Pack");
  assert.equal(items[0]?.["quantity"], 5);
});

test("loot normalization dedupes semantically identical effects and keeps richer variant", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "Ring with duplicated AC effect",
    proposedItems: [
      {
        id: "ring_1",
        name: "Ring of Guarding",
        quantity: 1,
        category: "magic",
        notes: "Protective enchantment.",
        equippedEffects: [
          { type: "stat_bonus", label: "AC Bonus", statKey: "armorClass", statValue: 1 },
          {
            type: "stat_bonus",
            label: "AC Bonus",
            statKey: "armorClass",
            statValue: 1,
            description: "While worn, grants +1 AC.",
          },
        ],
      },
    ],
  }) as Record<string, unknown>;

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  const effects = (items[0]?.["equippedEffects"] ?? []) as Record<string, unknown>[];
  assert.equal(effects.length, 1);
  assert.equal(effects[0]?.["description"], "While worn, grants +1 AC.");
});

test("loot normalization promotes simple stat bonus from notes", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "Cloak has explicit AC bonus in notes",
    proposedItems: [
      {
        id: "cloak_1",
        name: "Cloak of Warding",
        quantity: 1,
        category: "magic",
        notes: "Grants +2 to AC while worn.",
      },
    ],
  }) as Record<string, unknown>;

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  const effects = (items[0]?.["equippedEffects"] ?? []) as Record<string, unknown>[];
  assert.equal(effects.length, 1);
  assert.equal(effects[0]?.["type"], "stat_bonus");
  assert.equal(effects[0]?.["statKey"], "armorClass");
  assert.equal(effects[0]?.["statValue"], 2);
});

test("loot normalization escalates review for unresolved mechanical notes", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "Malformed mechanical claim",
    proposedItems: [
      {
        id: "amulet_1",
        name: "Amulet of Hints",
        quantity: 1,
        category: "magic",
        needsReview: false,
        notes: "Supposedly grants +0 to AC.",
      },
    ],
  }) as Record<string, unknown>;

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  assert.equal(items[0]?.["needsReview"], true);
  const effects = (items[0]?.["equippedEffects"] ?? []) as Record<string, unknown>[];
  assert.equal(effects.length, 0);
});

test("loot normalization escalates review for contradictory mechanical notes", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "Contradictory claim in note text",
    proposedItems: [
      {
        id: "brooch_1",
        name: "Brooch of Maybe Shielding",
        quantity: 1,
        category: "magic",
        needsReview: false,
        notes: "No bonus to AC, but maybe grants +1 AC.",
      },
    ],
  }) as Record<string, unknown>;

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  assert.equal(items[0]?.["needsReview"], true);
});

test("loot normalization keeps low-confidence unresolved mechanical claims in review", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "Low-confidence unresolved mechanical claim",
    proposedItems: [
      {
        id: "amulet_2",
        name: "Amulet of Rumors",
        quantity: 1,
        category: "magic",
        confidence: "low",
        needsReview: false,
        notes: "Believed to grant +0 to initiative.",
      },
    ],
  }) as Record<string, unknown>;

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  assert.equal(items[0]?.["confidence"], "low");
  assert.equal(items[0]?.["needsReview"], true);
  const effects = (items[0]?.["equippedEffects"] ?? []) as Record<string, unknown>[];
  assert.equal(effects.length, 0);
});

test("loot normalization keeps incompatible mechanics and their review evidence separate", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "Mixed confidence duplicate parse rows",
    proposedItems: [
      {
        id: "ring_mixed_a",
        name: "Ring of Steady Aim",
        quantity: 1,
        category: "magic",
        confidence: "high",
        needsReview: false,
        notes: "Polished silver ring.",
        equippedEffects: [
          {
            type: "stat_bonus",
            label: "Initiative Bonus",
            statKey: "initiative",
            statValue: 1,
            description: "Adds +1 initiative.",
          },
        ],
      },
      {
        id: "ring_mixed_b",
        name: "Ring of Steady Aim",
        quantity: 2,
        category: "magic",
        confidence: "low",
        needsReview: false,
        notes: "No bonus to AC, maybe grants +1 AC.",
      },
    ],
  }) as Record<string, unknown>;

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(item => item["quantity"]), [1, 2]);
  assert.deepEqual(items.map(item => item["confidence"]), ["high", "low"]);
  assert.equal(items[1]?.["needsReview"], true);
  assert.equal((items[0]?.["equippedEffects"] as Record<string, unknown>[])[0]?.["statKey"], "initiative");
  assert.equal((items[1]?.["equippedEffects"] as Record<string, unknown>[])[0]?.["statKey"], "armorClass");
});

test("loot normalization promotes explicit once-per-rest spell usage text", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "Spell use described in plain text",
    proposedItems: [
      {
        id: "gloves_1",
        name: "Gloves of Jaunting",
        quantity: 1,
        category: "magic",
        notes: "Arcane gloves.",
        equippedEffects: [
          {
            type: "spell",
            label: "Misty Step",
            description: "You can cast Misty Step once per short rest.",
          },
        ],
      },
    ],
  }) as Record<string, unknown>;

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  const effects = (items[0]?.["equippedEffects"] ?? []) as Record<string, unknown>[];
  assert.equal(effects.length, 1);
  assert.equal(effects[0]?.["uses"], 1);
  assert.equal(effects[0]?.["resetOn"], "short_rest");
});

test("loot normalization extracts bounded vs_condition trigger for attack damage", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "Conditional damage parsed from description",
    proposedItems: [
      {
        id: "ring_venom_1",
        name: "Ring of Venomous Edge",
        quantity: 1,
        category: "magic",
        notes: "A ring humming with toxin.",
        equippedEffects: [
          {
            type: "attack_damage",
            label: "Venom Strike",
            attackDamageDice: "1d6",
            attackDamageType: "poison",
            description: "Deals +1d6 poison against poisoned targets.",
          },
        ],
      },
    ],
  }) as Record<string, unknown>;

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  const effects = (items[0]?.["equippedEffects"] ?? []) as Record<string, unknown>[];
  assert.equal(effects.length, 1);
  assert.equal(effects[0]?.["triggerType"], "vs_condition");
  assert.equal(effects[0]?.["triggerCondition"], "Poisoned");
  assert.equal(items[0]?.["needsReview"], false);
});

test("loot normalization escalates review for unresolved conditional attack damage language", () => {
  const normalized = normalizeLootAnalysisResult({
    summary: "Conditional wording without extractable condition",
    proposedItems: [
      {
        id: "band_1",
        name: "Band of Cruel Timing",
        quantity: 1,
        category: "magic",
        needsReview: false,
        notes: "Dark iron ring.",
        equippedEffects: [
          {
            type: "attack_damage",
            label: "Cruel Edge",
            attackDamageDice: "1d4",
            attackDamageType: "necrotic",
            description: "Deals extra damage when the target is vulnerable.",
          },
        ],
      },
    ],
  }) as Record<string, unknown>;

  const items = normalized["proposedItems"] as Record<string, unknown>[];
  assert.equal(items[0]?.["needsReview"], true);
  const effects = (items[0]?.["equippedEffects"] ?? []) as Record<string, unknown>[];
  assert.equal(effects[0]?.["triggerType"], undefined);
});
