import assert from "node:assert/strict";
import test from "node:test";

import {
  getRaceLifespan,
  computeAgeCategory,
  getLifespanHint,
  type AgeCategory,
} from "../../utils/raceLifespan.ts";

test("getRaceLifespan returns correct lifespans for common races", () => {
  const human = getRaceLifespan("Human");
  assert.equal(human.adulthood, 18);
  assert.equal(human.maxAge, 80);

  const elf = getRaceLifespan("Elf");
  assert.equal(elf.adulthood, 100);
  assert.equal(elf.maxAge, 750);

  const dwarf = getRaceLifespan("Dwarf");
  assert.equal(dwarf.adulthood, 50);
  assert.equal(dwarf.maxAge, 350);
});

test("getRaceLifespan returns fallback for unknown race", () => {
  const unknown = getRaceLifespan("CustomDragon");
  assert.equal(unknown.adulthood, 18);
  assert.equal(unknown.maxAge, 80);
});

test("computeAgeCategory classifies human ages correctly", () => {
  // Human: adulthood 18, maxAge 80
  // Child: 0-1.8, Teen: 1.8-10.8, Young Adult: 10.8-18, Adult: 18-36
  // Middle Age: 36-40, Elder: 40-60, Ancient: 60-80, Venerable: 80-120, Extended: 120-160, Deific: 160+

  assert.equal(computeAgeCategory(1, "Human"), "Child");
  assert.equal(computeAgeCategory(5, "Human"), "Teen");
  assert.equal(computeAgeCategory(15, "Human"), "Young Adult");
  assert.equal(computeAgeCategory(25, "Human"), "Adult");
  assert.equal(computeAgeCategory(38, "Human"), "Middle Age");
  assert.equal(computeAgeCategory(50, "Human"), "Elder");
  assert.equal(computeAgeCategory(70, "Human"), "Ancient");
  assert.equal(computeAgeCategory(100, "Human"), "Venerable");
  assert.equal(computeAgeCategory(150, "Human"), "Extended");
  assert.equal(computeAgeCategory(200, "Human"), "Deific");
});

test("computeAgeCategory classifies elf ages correctly (longer lifespan)", () => {
  // Elf: adulthood 100, maxAge 750
  // Child: 0-10, Teen: 10-60, Young Adult: 60-100, Adult: 100-200
  // Middle Age: 200-375, Elder: 375-562.5, Ancient: 562.5-750, Venerable: 750-1125
  const elfChild = computeAgeCategory(5, "Elf");
  assert.equal(elfChild, "Child");

  const elfTeen = computeAgeCategory(30, "Elf");
  assert.equal(elfTeen, "Teen");

  const elfAdult = computeAgeCategory(150, "Elf");
  assert.equal(elfAdult, "Adult");

  const elfMiddleAge = computeAgeCategory(250, "Elf");
  assert.equal(elfMiddleAge, "Middle Age");

  const elfElder = computeAgeCategory(400, "Elf");
  assert.equal(elfElder, "Elder");

  const elfAncient = computeAgeCategory(700, "Elf");
  assert.equal(elfAncient, "Ancient");

  const elfVenerable = computeAgeCategory(800, "Elf");
  assert.equal(elfVenerable, "Venerable");
});

test("getLifespanHint returns formatted hint", () => {
  const humanHint = getLifespanHint("Human");
  assert.equal(humanHint, "Avg Lifespan: 0-80");

  const elfHint = getLifespanHint("Elf");
  assert.equal(elfHint, "Avg Lifespan: 0-750");

  const dwarfHint = getLifespanHint("Dwarf");
  assert.equal(dwarfHint, "Avg Lifespan: 0-350");
});

test("computeAgeCategory handles boundary values", () => {
  // Test exact boundaries for Human
  // Child: 0-1.8, Teen: 1.8-10.8, Young Adult: 10.8-18, Adult: 18-36
  // Middle Age: 36-40, Elder: 40-60, Ancient: 60-80, Venerable: 80-120
  assert.equal(computeAgeCategory(0, "Human"), "Child");
  assert.equal(computeAgeCategory(1, "Human"), "Child");
  assert.equal(computeAgeCategory(18, "Human"), "Adult");
  assert.equal(computeAgeCategory(36, "Human"), "Middle Age");
  assert.equal(computeAgeCategory(40, "Human"), "Elder");
  assert.equal(computeAgeCategory(79, "Human"), "Ancient");
  assert.equal(computeAgeCategory(80, "Human"), "Venerable"); // Exactly at maxAge, goes to Venerable
});

test("computeAgeCategory handles short-lived races", () => {
  // Half-Orc: adulthood 14, maxAge 75
  // childUpperBound = 1.4, teenUpperBound = 8.4, youngAdultUpperBound = 14
  // adultUpperBound = 28, middleAgeUpperBound = 37.5, elderUpperBound = 56.25, ancientUpperBound = 75
  const orcChild = computeAgeCategory(1, "Half-Orc");
  assert.equal(orcChild, "Child");

  const orcTeen = computeAgeCategory(5, "Half-Orc");
  assert.equal(orcTeen, "Teen");

  const orcAdult = computeAgeCategory(20, "Half-Orc");
  assert.equal(orcAdult, "Adult");

  const orcElder = computeAgeCategory(50, "Half-Orc");
  assert.equal(orcElder, "Elder");

  const orcAncient = computeAgeCategory(70, "Half-Orc");
  assert.equal(orcAncient, "Ancient");
});

test("computeAgeCategory handles very long-lived races", () => {
  // Satyr: adulthood 100, maxAge 800
  const satyrVenerable = computeAgeCategory(900, "Satyr");
  assert.equal(satyrVenerable, "Venerable");

  const satyrDeific = computeAgeCategory(1600, "Satyr");
  assert.equal(satyrDeific, "Deific");
});
