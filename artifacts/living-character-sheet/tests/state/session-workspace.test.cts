import assert from "node:assert/strict";
import test from "node:test";
const Module = require("node:module");
const React = require("react");
const Renderer = require("react-test-renderer");
const { projectSessionAuthority, projectSessionView } = require("../../utils/adventure/sessionWorkspace");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = Renderer;
let party: any = {
  partyCode: "A", memberId: "player", isInParty: true,
  members: [{ id: "player", partyCode: "A", characterName: "Ranger" }],
  combatState: { code: "A", stateRevision: 4, participantBattleById: { player: "battle", wolf: "battle" },
    battleTurnOrderById: { battle: ["wolf", "player"] }, currentTurnIdByBattle: { battle: "wolf" },
    combatNpcs: [{ id: "wolf", name: "Wolf" }], encounterPositions: [] },
  refreshCombatState: async () => {},
};
let lookup: (code: string) => Promise<boolean> = async () => false;
const calls: any[] = [];
const originalLoad = Module._load;
let Panel: any;
try {
  Module._load = function(name: string, ...args: unknown[]) {
    if (name === "react-native") return { View: "View", Text: "Text", TextInput: "Input", TouchableOpacity: "Button", StyleSheet: { create: (x: any) => x } };
    if (name === "@/hooks/useColors") return { useColors: () => ({}) };
    if (name === "@/context/PartyContext") return { useParty: () => party };
    if (name === "@/utils/partyApi") return {
      hasLocalPartyHostCapability: (code: string) => lookup(code),
      ...Object.fromEntries(["confirmEncounterPositions", "startPartyInitiative", "endEncounter", "endPartyTurnForBattle", "addToEncounter"].map(key => [key, async (...args: any[]) => { calls.push([key, ...args]); return { battleId: "battle", turnOrder: [] }; }])),
    };
    if (name.startsWith("@/")) return originalLoad.call(this, require("node:path").resolve(__dirname, "../..", name.slice(2)), ...args);
    return originalLoad.call(this, name, ...args);
  };
  Panel = require("../../components/adventure/session/AiDmCombatSubmodePanel").AiDmCombatSubmodePanel;
} finally { Module._load = originalLoad; }

const text = (tree: any) => tree.root.findAllByType("Text").map((n: any) => n.children.join("")).join(" ");
function button(tree: any, label: string) {
  return tree.root.findAllByType("Button").find((n: any) => n.findAllByType("Text").some((t: any) => t.children.join("") === label));
}

test("only present host capability offers DM tools in any session mode", () => {
  for (const mode of ["human_dm", "ai_one_off", "ai_campaign"]) {
    for (const status of ["checking", "absent", "present"]) {
      const a = projectSessionAuthority({ mode, connected: true, hostCapability: status });
      assert.equal(a.canManageEncounter, status === "present");
      assert.equal(a.canOrchestrateAi, status === "present" && mode !== "human_dm");
      assert.equal(projectSessionAuthority({ mode, connected: false, hostCapability: status }).canManageEncounter, false);
    }
  }
});

test("shared encounter projection uses current party, battle and committed turn", () => {
  for (const mode of ["human_dm", "ai_one_off", "ai_campaign"]) {
    const view = projectSessionView({ ...party, mode });
    assert.equal(view.encounter.status, "combat");
    assert.equal(view.encounter.currentActorName, "Wolf");
    assert.equal(view.encounter.participantCount, 2);
    assert.equal(view.encounter.isPlayerTurn, false);
    assert.equal(projectSessionView({ ...party, mode, memberId: "wolf" }).encounter.isPlayerTurn, true);
    assert.equal(projectSessionView({ ...party, mode, partyCode: "B" }).encounter.status, "loading");
    assert.equal(projectSessionView({ ...party, mode, partyCode: null }).encounter.currentActorName, null);
    assert.equal(projectSessionView({ ...party, mode, memberId: "outsider" }).encounter.status, "exploration");
  }
});

test("joined player retains read-only turn and refresh with no DM mutation controls", async () => {
  lookup = async () => false;
  let tree: any;
  await act(async () => { tree = Renderer.create(React.createElement(Panel, { onToolEvent: () => {} })); });
  try {
    assert.match(text(tree), /Wolf's turn/);
    assert.ok(button(tree, "Refresh encounter"));
    assert.doesNotMatch(text(tree), /Start Encounter|End Encounter|Add Members|Recover stuck|combatant positions|DM encounter tools/);
    assert.equal(tree.root.findAllByType("Input").length, 0);
  } finally { act(() => tree.unmount()); }
});

test("host can confirm shared coordinates and all DM tools are hidden on party switch", async () => {
  calls.length = 0;
  lookup = async code => code === "A";
  let tree: any;
  const props = { onToolEvent: () => {} };
  await act(async () => { tree = Renderer.create(React.createElement(Panel, props)); });
  const previous = party;
  try {
    assert.ok(button(tree, "Start Encounter"));
    assert.ok(button(tree, "End Encounter"));
    assert.ok(button(tree, "Add Members"));
    assert.match(text(tree), /Recover stuck NPC/);
    act(() => button(tree, "Edit combatant positions").props.onPress());
    const inputs = tree.root.findAllByType("Input");
    act(() => { inputs[0].props.onChangeText("5"); inputs[1].props.onChangeText("10"); });
    await act(async () => { await button(tree, "Confirm positions").props.onPress(); });
    assert.deepEqual(calls[0], ["confirmEncounterPositions", "A", { expectedRevision: 4, positions: [{ battleId: "battle", combatantId: "player", xFeet: 5, yFeet: 10, source: "dm_confirmed" }] }]);
    party = { ...previous, partyCode: "B" };
    await act(async () => tree.update(React.createElement(Panel, props)));
    assert.doesNotMatch(text(tree), /Start Encounter|Confirm positions|DM encounter tools/);
  } finally { party = previous; act(() => tree.unmount()); }
});

test("pending, rejected and obsolete host lookups fail closed", async () => {
  const previous = party;
  let resolveA!: (present: boolean) => void;
  lookup = code => code === "A" ? new Promise(resolve => { resolveA = resolve; }) : Promise.reject(Error("storage unavailable"));
  let tree: any;
  const props = { onToolEvent: () => {} };
  await act(async () => { tree = Renderer.create(React.createElement(Panel, props)); });
  try {
    assert.equal(button(tree, "Start Encounter"), undefined);
    party = { ...previous, partyCode: "B" };
    await act(async () => tree.update(React.createElement(Panel, props)));
    await act(async () => resolveA(true));
    assert.equal(button(tree, "Start Encounter"), undefined);
    assert.equal(button(tree, "End Encounter"), undefined);
  } finally { party = previous; act(() => tree.unmount()); }
});
