import assert from "node:assert/strict";
import test from "node:test";
import Module from "node:module";

const original = (Module as unknown as { _load: (...args: any[]) => any })._load;
let values: unknown[] = [], refs: Array<{ current: unknown }> = [], slot = 0, refSlot = 0;
const saved: any[] = [];
const react = {
  createContext: () => ({ Provider: "provider" }), useContext: () => ({}), useEffect: () => {},
  useCallback: (f: unknown) => f, createElement: (_type: unknown, props: unknown) => ({ props }),
  useState: (initial: unknown) => {
    const i = slot++;
    if (!(i in values)) values[i] = typeof initial === "function" ? initial() : initial;
    return [values[i], (next: any) => { values[i] = typeof next === "function" ? next(values[i]) : next; }];
  },
  useRef: (initial: unknown) => { const i = refSlot++; return refs[i] ?? (refs[i] = { current: initial }); },
};
(Module as unknown as { _load: (...args: any[]) => any })._load = function(id: string, ...args: any[]) {
  if (id === "react") return react;
  if (id === "react/jsx-runtime") return { jsx: (_type: unknown, props: unknown) => ({ props }) };
  if (id === "@/utils/characterStorage") return {
    saveCharacter: async (snapshot: unknown) => { saved.push(structuredClone(snapshot)); },
    getAllCharacters: async () => [], getLastActiveId: async () => null,
  };
  return original.call(this, id, ...args);
};
const { CharacterProvider } = require("../../context/CharacterContext");
const { mockLyraSnapshot } = require("../../data/mockCharacter");
(Module as unknown as { _load: (...args: any[]) => any })._load = original;
function render() { slot = 0; refSlot = 0; return CharacterProvider({ children: null }).props.value; }

test("actual provider retains exhausted/partial uses through load, spend, save, reorder, clear and character switch", async () => {
  values = []; refs = []; saved.length = 0;
  let provider = render();
  const snapshot = { ...structuredClone(mockLyraSnapshot), spellEffectUses: { spell: 2, empty: 0 }, itemActionUses: { item: 1, empty: 0 } };
  provider.loadCharacter(snapshot);
  provider = render();
  assert.deepEqual(provider.spellEffectUses, snapshot.spellEffectUses);
  assert.deepEqual(provider.itemActionUses, snapshot.itemActionUses);
  provider.useSpellEffect("spell"); provider.useSpellEffect("empty"); provider.useItemEffect("item"); provider.useItemEffect("empty");
  provider = render();
  await provider.saveCurrentCharacter();
  assert.deepEqual(saved.at(-1).spellEffectUses, { spell: 1, empty: 0 });
  assert.deepEqual(saved.at(-1).itemActionUses, { item: 0, empty: 0 });
  provider.reorderInventory([...provider.inventory].reverse());
  assert.deepEqual(saved.at(-1).spellEffectUses, { spell: 1, empty: 0 });
  const roundTrip = saved.at(-1);
  provider.clearCharacter(); provider = render();
  assert.deepEqual(provider.spellEffectUses, {});
  provider.loadCharacter(roundTrip); provider = render();
  assert.deepEqual(provider.itemActionUses, { item: 0, empty: 0 });
  provider.loadCharacter({ ...mockLyraSnapshot, character: { ...mockLyraSnapshot.character, id: "other" } }); provider = render();
  assert.deepEqual(provider.spellEffectUses, {});
  assert.deepEqual(provider.itemActionUses, {});
});

test("malformed usage is rejected before changing an already loaded character", () => {
  const provider = render(), before = provider.character;
  assert.throws(() => provider.loadCharacter({ ...mockLyraSnapshot, spellEffectUses: { spell: -1 } }), /Invalid spellEffectUses/);
  assert.deepEqual(render().character, before);
});
