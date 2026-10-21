import assert from "node:assert/strict";
import test from "node:test";

import { decideOfficialMonstersFetchPlan } from "../../utils/monsterApi.ts";

test("serves fresh memory cache immediately", () => {
  const plan = decideOfficialMonstersFetchPlan({
    forceRefresh: false,
    hasFreshMemory: true,
    hasFreshPersisted: true,
    hasPersisted: true,
    hasInFlightRefresh: false,
  });

  assert.deepEqual(plan, {
    serveImmediately: "memory",
    refreshMode: "none",
    reusedInFlightRefresh: false,
  });
});

test("serves fresh persisted cache when memory is cold", () => {
  const plan = decideOfficialMonstersFetchPlan({
    forceRefresh: false,
    hasFreshMemory: false,
    hasFreshPersisted: true,
    hasPersisted: true,
    hasInFlightRefresh: false,
  });

  assert.deepEqual(plan, {
    serveImmediately: "persisted",
    refreshMode: "none",
    reusedInFlightRefresh: false,
  });
});

test("serves stale persisted cache and schedules background refresh", () => {
  const plan = decideOfficialMonstersFetchPlan({
    forceRefresh: false,
    hasFreshMemory: false,
    hasFreshPersisted: false,
    hasPersisted: true,
    hasInFlightRefresh: false,
  });

  assert.deepEqual(plan, {
    serveImmediately: "persisted",
    refreshMode: "background",
    reusedInFlightRefresh: false,
  });
});

test("marks stale-cache path as in-flight reused when refresh already running", () => {
  const plan = decideOfficialMonstersFetchPlan({
    forceRefresh: false,
    hasFreshMemory: false,
    hasFreshPersisted: false,
    hasPersisted: true,
    hasInFlightRefresh: true,
  });

  assert.deepEqual(plan, {
    serveImmediately: "persisted",
    refreshMode: "background",
    reusedInFlightRefresh: true,
  });
});

test("force refresh waits for network and reuses in-flight refresh", () => {
  const plan = decideOfficialMonstersFetchPlan({
    forceRefresh: true,
    hasFreshMemory: true,
    hasFreshPersisted: true,
    hasPersisted: true,
    hasInFlightRefresh: true,
  });

  assert.deepEqual(plan, {
    serveImmediately: "none",
    refreshMode: "await",
    reusedInFlightRefresh: true,
  });
});
