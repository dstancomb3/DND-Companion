import assert from "node:assert/strict";
import test from "node:test";
import Module from "node:module";

const original = (Module as unknown as { _load: (...args: any[]) => any })._load;
const writes: unknown[] = [];
const batches = [{ id: "legacy", applied: true, undone: false, beforeSnapshot: { currentHp: 10, tempHp: 7, currency: { gp: 10 }, resourceStates: [{ id: "r", priorCurrent: 5 }], conditionsBefore: [{ id: "condition", name: "Prone" }] }, deltas: [] }];
const react = { createContext: () => ({ Provider: "provider" }), useCallback: (f: unknown) => f,
  useEffect: () => {}, useState: () => [batches, (...args: unknown[]) => writes.push(args)],
  createElement: (_type: unknown, props: unknown) => ({ props }) };
(Module as unknown as { _load: (...args: any[]) => any })._load = function(id: string, ...args: any[]) {
  if (id === "react") return react;
  if (id === "react/jsx-runtime") return { jsx: (_type: unknown, props: unknown) => ({ props }) };
  if (id === "@/context/CharacterContext") return { useCharacter: () => ({ currentCharacterId: "character",
    character: { currentHp: 15, tempHp: 0, currency: { cp: 0, sp: 0, ep: 0, gp: 30, pp: 0 } },
    resources: [{ id: "r", name: "R", current: 2 }],
    updateHp: () => assert.fail("HP must not change"), updateCurrency: () => assert.fail("Currency must not change"),
    applyResourceChanges: () => assert.fail("Resources must not change"), updateTempHp: () => assert.fail("Temporary HP must not change"),
    addCondition: () => assert.fail("Conditions must not change"), removeCondition: () => assert.fail("Conditions must not change") }) };
  if (id === "@react-native-async-storage/async-storage") return { setItem: (...values: unknown[]) => { writes.push(values); return Promise.resolve(); } };
  return original.call(this, id, ...args);
};
const { MutationHistoryProvider } = require("../../context/MutationHistoryContext");
(Module as unknown as { _load: (...args: any[]) => any })._load = original;

test("direct undo, repeated undo, undoLast and missing records never mutate character or mark history undone", async () => {
  const before = JSON.stringify(batches);
  const value = MutationHistoryProvider({ children: null }).props.value;
  for (const result of await Promise.all([value.undoBatch("legacy"), value.undoBatch("legacy"), value.undoLast(), value.undoBatch("missing")])) {
    assert.equal(result.status, "unavailable");
    assert.equal(typeof result.reason, "string");
  }
  assert.equal(JSON.stringify(batches), before);
  assert.deepEqual(writes, []);
});
