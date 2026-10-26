import assert from "node:assert/strict";
import test from "node:test";
const Module = require("node:module"), React = require("react"), Renderer = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = Renderer;
const { buildConfirmedPlayerAttackNarration } = require("../../utils/combat/playerAttackNarration");
const { formatOutcomeSummary } = require("../../utils/combat/combatFeedback");
let end: () => Promise<boolean>, calls = 0;
let Controls: any;
const originalLoad = Module._load;
try {
  Module._load = function(name: string, ...args: unknown[]) {
    if (name === "react-native") return { View: "View", Text: "Text", TouchableOpacity: "Button" };
    if (name === "@/hooks/useColors") return { useColors: () => ({}) };
    if (name === "@/context/CombatContext") return { useCombat: () => ({ actionsTotal: 1, actionsUsed: 1, bonusActionsTotal: 1, bonusActionsUsed: 0, endTurn: () => { calls++; return end(); } }) };
    return originalLoad.call(this, name, ...args);
  };
  Controls = require("../../components/adventure/workspace/SessionTurnControls").SessionTurnControls;
} finally { Module._load = originalLoad; }
const receipt = { ok: true, appliedCount: 1, replayed: false, targetResults: [{ requestIndex: 0, targetId: "wolf", status: "applied" }] };
const input = { actorName: "Lyra", attackName: "Quarterstaff", targets: [{ id: "wolf", name: "Shadow Creature" }] };
test("story uses acknowledged target identity, never invented damage or preview-only results", () => {
  assert.equal(buildConfirmedPlayerAttackNarration({ ...input, result: { status: "accepted" } }), null);
  assert.equal(buildConfirmedPlayerAttackNarration({ ...input, result: { status: "rejected", remoteApplication: receipt } }), null);
  assert.equal(buildConfirmedPlayerAttackNarration({ ...input, result: { status: "accepted", remoteApplication: { ...receipt, replayed: true } } }), null);
  assert.equal(buildConfirmedPlayerAttackNarration({ ...input, result: { status: "accepted", remoteApplication: receipt } }), "Lyra attacks Shadow Creature with Quarterstaff.");
  assert.equal(buildConfirmedPlayerAttackNarration({ ...input, targets: [], result: { status: "accepted", remoteApplication: receipt } }), null);
  assert.equal(buildConfirmedPlayerAttackNarration({ ...input, result: { status: "accepted", remoteApplication: receipt, remoteApplicationError: "refresh failed" } }), null);
});
test("acknowledged no-effect attacks get story text while invalid/missing targets do not", () => {
  const result = { status: "accepted", remoteApplication: { ...receipt, appliedCount: 0, targetResults: [{ targetId: "wolf", status: "skipped_noop" }] } };
  assert.match(buildConfirmedPlayerAttackNarration({ ...input, result }), /no recorded effect/);
  result.remoteApplication.targetResults[0].status = "skipped_invalid";
  assert.equal(buildConfirmedPlayerAttackNarration({ ...input, result }), null);
});
test("receipt feedback distinguishes server updates, skipped results, replay and uncertainty", () => {
  assert.equal(formatOutcomeSummary({ remoteApplication: receipt }), "Action confirmed for 1 target(s).");
  assert.match(formatOutcomeSummary({ remoteApplication: { ...receipt, appliedCount: 0, replayed: true } }), /already processed/);
  assert.match(formatOutcomeSummary({ remoteApplication: { ...receipt, appliedCount: 0, targetResults: [{ status: "skipped_invalid" }] } }), /not applied/);
  assert.equal(formatOutcomeSummary({ remoteApplication: receipt, remoteApplicationError: "Refresh needed" }), "Refresh needed");
});
function setup(isPlayerTurn = true) {
  calls = 0; end = async () => true; let tree: any;
  act(() => { tree = Renderer.create(React.createElement(Controls, { isPlayerTurn })); });
  return { tree, button: () => tree.root.findByType("Button"), close: () => act(() => tree.unmount()) };
}
test("End Turn remains usable after spending the action and sends once while pending", async () => {
  const f = setup(); let finish!: (ok: boolean) => void;
  end = () => new Promise(resolve => { finish = resolve; });
  try {
    assert.equal(f.button().props.disabled, false);
    act(() => { f.button().props.onPress(); f.button().props.onPress(); });
    assert.equal(calls, 1); assert.equal(f.button().props.disabled, true);
    await act(async () => finish(true)); assert.equal(f.button().props.disabled, false);
  } finally { f.close(); }
});
test("End Turn cannot advance another actor, and failed acknowledgement stays visible", async () => {
  const f = setup(false);
  try { act(() => f.button().props.onPress()); assert.equal(calls, 0); assert.equal(f.button().props.disabled, true); }
  finally { f.close(); }
  const g = setup(); end = async () => false;
  try {
    await act(async () => g.button().props.onPress());
    assert.equal(g.tree.root.findAllByProps({ accessibilityRole: "alert" }).length, 1);
    assert.equal(g.button().props.disabled, false);
  } finally { g.close(); }
});
