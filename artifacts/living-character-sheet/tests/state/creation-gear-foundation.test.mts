import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATION_GEAR_FILTER_CATEGORIES,
  CREATION_GEAR_RARITIES,
  buildCreationGearCatalog,
  buildRandomCreationGearSelection,
  buildCreationGearLoadout,
  filterCreationGearCatalog,
  formatCreationGearCost,
  getCreationGearCatalogEntryWeightLbs,
  getCreationGearLoadPresetWeightLimit,
  getBackgroundAutoGear,
  getRaceAutoGear,
  getClassFreeChoiceBudgetGp,
  getClassPresetOptions,
  getClassStrictPackageOptions,
  getClassStartingWealthRule,
  getCreationCoverageSummary,
  sortCreationGearCatalogBySelections,
} from "../../utils/creationGear.ts";
import { ALL_BACKGROUNDS, ALL_CLASSES } from "../../data/dnd5e.ts";

test("all create-character classes have starting wealth and strict/preset options", () => {
  for (const entry of ALL_CLASSES) {
    const wealth = getClassStartingWealthRule(entry.name);
    const strictOptions = getClassStrictPackageOptions(entry.name);
    const presetOptions = getClassPresetOptions(entry.name);
    const freeBudget = getClassFreeChoiceBudgetGp(entry.name);

    assert.ok(wealth, `Missing wealth rule for ${entry.name}`);
    assert.equal(wealth?.supported, true);
    assert.ok(strictOptions.length >= 2, `Missing strict options for ${entry.name}`);
    assert.ok(presetOptions.length >= 2, `Missing preset options for ${entry.name}`);
    assert.ok(freeBudget >= 0, `Invalid free budget for ${entry.name}`);
  }
});

test("all create-character backgrounds have auto-gear coverage", () => {
  for (const background of ALL_BACKGROUNDS) {
    assert.ok(getBackgroundAutoGear(background).length > 0, `Missing background auto-gear for ${background}`);
  }
});

test("strict loadout includes class package plus background auto gear", () => {
  const strict = buildCreationGearLoadout({
    className: "Fighter",
    race: "Human",
    background: "Criminal",
    mode: "strict",
  });

  assert.ok(strict.items.some((item) => item.name === "Thieves' Tools"));
  assert.ok(strict.items.some((item) => item.category === "weapon"));
  assert.equal(strict.currency.gp, 0);
});

test("free-choice loadout applies class budget and converts leftover gp to currency", () => {
  const free = buildCreationGearLoadout({
    className: "Wizard",
    race: "Human",
    background: "Sage",
    mode: "free",
    freeChoices: [
      { name: "Dagger", quantity: 2 },
      { name: "Backpack", quantity: 1 },
    ],
  });

  assert.equal(free.mode, "free");
  assert.ok(free.spentGp > 0);
  assert.equal(free.currency.gp, Math.max(0, Math.floor(free.budgetGp - free.spentGp)));
});

test("free-choice loadout does not hard-cap picks at budget and treats budget as advisory", () => {
  const free = buildCreationGearLoadout({
    className: "Wizard",
    race: "Human",
    background: "Sage",
    mode: "free",
    freeChoices: [
      { name: "Longsword", quantity: 20 },
    ],
  });

  assert.equal(free.mode, "free");
  assert.ok(free.spentGp > free.budgetGp);
  assert.ok(free.items.some((item) => item.name.toLowerCase().includes("longsword") && item.quantity >= 20));
  assert.equal(free.currency.gp, 0);
});

test("randomized gear selection returns valid ids and non-empty free picks", () => {
  const randomGear = buildRandomCreationGearSelection({ className: "Fighter" });
  const strictIds = new Set(getClassStrictPackageOptions("Fighter").map((option) => option.id));
  const presetIds = new Set(getClassPresetOptions("Fighter").map((option) => option.id));

  assert.ok(["strict", "preset", "free"].includes(randomGear.mode));
  assert.ok(randomGear.strictPackageId === "" || strictIds.has(randomGear.strictPackageId));
  assert.ok(randomGear.presetId === "" || presetIds.has(randomGear.presetId));
  assert.ok(randomGear.freeChoices.length >= 1);
  assert.ok(randomGear.freeChoices.every((choice) => choice.quantity >= 1));
});

test("coverage summary reports complete class/background support", () => {
  const summary = getCreationCoverageSummary();

  assert.equal(summary.classesCovered, summary.classesTotal);
  assert.equal(summary.backgroundsCovered, summary.backgroundsTotal);
});

test("creation gear catalog includes rarity metadata and supports max-rarity filtering", () => {
  const catalog = buildCreationGearCatalog();
  assert.ok(catalog.length > 0);
  for (const item of catalog) {
    assert.ok(CREATION_GEAR_RARITIES.includes(item.rarity), `Invalid rarity for ${item.name}`);
  }

  const commonOnly = filterCreationGearCatalog("all", { maxRarity: "Common" });
  assert.ok(commonOnly.length > 0);
  assert.ok(commonOnly.every((item) => item.rarity === "Common"));
});

test("randomized free-choice gear respects load preset weight limits", () => {
  const randomGear = buildRandomCreationGearSelection({
    className: "Fighter",
    mode: "free",
    loadPreset: "light",
    maxRarity: "Artifact",
  });
  const catalogByName = new Map(buildCreationGearCatalog().map((entry) => [entry.name, entry]));
  const totalWeight = randomGear.freeChoices.reduce((sum, choice) => {
    const entry = catalogByName.get(choice.name);
    if (!entry) return sum;
    return sum + getCreationGearCatalogEntryWeightLbs(entry) * Math.max(1, choice.quantity);
  }, 0);

  assert.equal(randomGear.mode, "free");
  assert.ok(totalWeight <= getCreationGearLoadPresetWeightLimit("light"));
});

test("strict randomization emits rarity-capped bonus loot and strict loadout consumes it", () => {
  const randomGear = buildRandomCreationGearSelection({
    className: "Fighter",
    mode: "strict",
    maxRarity: "Very Rare",
    loadPreset: "heavy",
  });

  assert.equal(randomGear.mode, "strict");
  assert.ok(randomGear.bonusChoices.length > 0);

  const catalogByName = new Map(buildCreationGearCatalog().map((entry) => [entry.name, entry]));
  const rarityIndex = new Map(CREATION_GEAR_RARITIES.map((rarity, idx) => [rarity, idx] as const));
  for (const choice of randomGear.bonusChoices) {
    const entry = catalogByName.get(choice.name);
    assert.ok(entry, `Missing catalog entry for ${choice.name}`);
    assert.ok((rarityIndex.get(entry!.rarity) ?? 0) <= (rarityIndex.get("Very Rare") ?? 0));
  }

  const loadout = buildCreationGearLoadout({
    className: "Fighter",
    race: "Human",
    background: "Soldier",
    mode: "strict",
    strictPackageId: randomGear.strictPackageId,
    bonusChoices: randomGear.bonusChoices,
  });

  const bonusCountInLoadout = randomGear.bonusChoices
    .map((choice) => loadout.items.find((item) => item.name === choice.name)?.quantity ?? 0)
    .reduce((sum, qty) => sum + qty, 0);
  assert.ok(bonusCountInLoadout > 0);
});

test("encumbered load preset randomizes significantly more bonus weight than light", () => {
  const catalogByName = new Map(buildCreationGearCatalog().map((entry) => [entry.name, entry]));
  const sampleSize = 24;

  const sampleWeight = (loadPreset: "light" | "encumbered") => {
    let total = 0;
    for (let i = 0; i < sampleSize; i += 1) {
      const randomGear = buildRandomCreationGearSelection({
        className: "Fighter",
        mode: "strict",
        maxRarity: "Very Rare",
        loadPreset,
      });
      const weight = randomGear.bonusChoices.reduce((sum, choice) => {
        const entry = catalogByName.get(choice.name);
        if (!entry) return sum;
        return sum + getCreationGearCatalogEntryWeightLbs(entry) * Math.max(1, choice.quantity);
      }, 0);
      total += weight;
    }
    return total / sampleSize;
  };

  const avgLight = sampleWeight("light");
  const avgEncumbered = sampleWeight("encumbered");

  assert.ok(avgEncumbered > avgLight * 2, `Expected encumbered avg ${avgEncumbered} to be > 2x light avg ${avgLight}`);
});

test("catalog sorting moves selected items to top", () => {
  const catalog = [
    { name: "Backpack", category: "gear", costGp: 2, rarity: "Common", source: "gear" },
    { name: "Longsword", category: "weapon", costGp: 15, rarity: "Common", source: "weapon" },
    { name: "Chain Mail", category: "armor", costGp: 75, rarity: "Common", source: "armor" },
  ] as const;

  const sorted = sortCreationGearCatalogBySelections(catalog as any, {
    Backpack: 0,
    Longsword: 2,
    "Chain Mail": 1,
  });

  assert.equal(sorted[0]?.name, "Chain Mail");
  assert.equal(sorted[1]?.name, "Longsword");
  assert.equal(sorted[2]?.name, "Backpack");
});

test("catalog sorting keeps alphabetical order inside selected and unselected groups", () => {
  const catalog = [
    { name: "Torch", category: "gear", costGp: 0.01, rarity: "Common", source: "gear" },
    { name: "Backpack", category: "gear", costGp: 2, rarity: "Common", source: "gear" },
    { name: "Arrow", category: "weapon", costGp: 0.05, rarity: "Common", source: "weapon" },
    { name: "Dagger", category: "weapon", costGp: 2, rarity: "Common", source: "weapon" },
  ] as const;

  const sorted = sortCreationGearCatalogBySelections(catalog as any, {
    Dagger: 1,
    Torch: 3,
  });

  assert.deepEqual(sorted.map((entry) => entry.name), ["Dagger", "Torch", "Arrow", "Backpack"]);
});

test("creation gear filter categories include requested extended catalog buckets", () => {
  assert.ok(CREATION_GEAR_FILTER_CATEGORIES.includes("consumable"));
  assert.ok(CREATION_GEAR_FILTER_CATEGORIES.includes("magic"));
  assert.ok(CREATION_GEAR_FILTER_CATEGORIES.includes("treasure"));
  assert.ok(CREATION_GEAR_FILTER_CATEGORIES.includes("accessory"));
  assert.ok(CREATION_GEAR_FILTER_CATEGORIES.includes("component"));
  assert.ok(CREATION_GEAR_FILTER_CATEGORIES.includes("junk"));
  assert.ok(CREATION_GEAR_FILTER_CATEGORIES.includes("other"));
});

test("sub-gp cost formatting uses sp or cp without decimal gp", () => {
  assert.equal(formatCreationGearCost(0), "free");
  assert.equal(formatCreationGearCost(0.5), "5 sp");
  assert.equal(formatCreationGearCost(0.01), "1 cp");
});

test("catalog contains no zero or negative prices", () => {
  const catalog = buildCreationGearCatalog();
  const zeroOrNegative = catalog.filter((item) => item.costGp <= 0);
  assert.equal(
    zeroOrNegative.length,
    0,
    `Expected no free/zero-cost catalog entries, found: ${zeroOrNegative.map((item) => item.name).join(", ")}`,
  );
});

test("all class/background/race referenced gear items resolve to priced catalog entries", () => {
  const catalog = buildCreationGearCatalog();
  const costByName = new Map(catalog.map((item) => [item.name.toLowerCase(), item.costGp]));
  const referencedNames = new Set<string>();

  for (const classEntry of ALL_CLASSES) {
    for (const option of getClassStrictPackageOptions(classEntry.name)) {
      for (const item of option.items) referencedNames.add(item.name);
    }
    for (const option of getClassPresetOptions(classEntry.name)) {
      for (const item of option.items) referencedNames.add(item.name);
    }
  }

  for (const background of ALL_BACKGROUNDS) {
    for (const item of getBackgroundAutoGear(background)) referencedNames.add(item.name);
  }

  const raceAutoGearChecks = [
    "Deep Gnome",
    "Ghostwise Halfling",
    "Duergar",
    "Fairy",
    "Owlin",
    "Tortle",
    "Triton",
    "Warforged",
  ];
  for (const race of raceAutoGearChecks) {
    for (const item of getRaceAutoGear(race)) referencedNames.add(item.name);
  }

  const missingPrices: string[] = [];
  const nonPositivePrices: string[] = [];

  for (const itemName of referencedNames) {
    const cost = costByName.get(itemName.toLowerCase());
    if (cost == null) {
      missingPrices.push(itemName);
      continue;
    }
    if (cost <= 0) {
      nonPositivePrices.push(`${itemName}=${cost}`);
    }
  }

  assert.equal(
    missingPrices.length,
    0,
    `Expected all referenced items to exist in priced catalog, missing: ${missingPrices.sort().join(", ")}`,
  );
  assert.equal(
    nonPositivePrices.length,
    0,
    `Expected all referenced items to have positive prices, found: ${nonPositivePrices.sort().join(", ")}`,
  );
});