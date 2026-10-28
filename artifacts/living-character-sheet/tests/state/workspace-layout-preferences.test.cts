import assert from "node:assert/strict";
import test from "node:test";
const Module = require("node:module"), React = require("react"), Renderer = require("react-test-renderer");
const { defaultWorkspacePreferences, parseWorkspacePreferences, presetWorkspaceLayout, swapWorkspacePanels, toggleWorkspacePanel, saveCustomWorkspace, selectWorkspacePreset } = require("../../utils/adventure/workspaceLayoutPreferences");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = Renderer;
const stored = new Map<string, string>();
let read = async (key: string): Promise<string | null> => stored.get(key) ?? null;
let write = async (key: string, value: string) => { stored.set(key, value); };
const originalLoad = Module._load; let Shell: any, usePreferences: any;
try {
  Module._load = function(name: string, ...args: unknown[]) {
    if (name === "react-native") return { View: "View", Text: "Text", ScrollView: "Scroll", TouchableOpacity: "Button", PanResponder: { create: () => ({ panHandlers: {} }) }, Platform: { OS: "test" }, TextInput: "Input", StyleSheet: { create: (x: any) => x } };
    if (name === "@/hooks/useColors") return { useColors: () => ({}) };
    if (name === "@react-native-async-storage/async-storage") return { getItem: (key: string) => read(key), setItem: (key: string, value: string) => write(key, value) };
    return originalLoad.call(this, name, ...args);
  };
  Shell = require("../../components/adventure/workspace/AdventureWorkspace").AdventureWorkspace;
  usePreferences = require("../../hooks/useWorkspacePreferences").useWorkspacePreferences;
} finally { Module._load = originalLoad; }
function reset() { stored.clear(); read = async key => stored.get(key) ?? null; write = async (key, value) => { stored.set(key, value); }; }
const button = (tree: any, label: string) => tree.root.findByProps({ accessibilityLabel: label });
const click = async (tree: any, label: string) => act(async () => { button(tree, label).props.onPress(); });

test("invalid or obsolete preferences recover to Balanced without retaining gameplay fields", () => {
  for (const raw of [null, "bad", "null", JSON.stringify({ version: 2 }), "x".repeat(17000)]) assert.deepEqual(parseWorkspacePreferences(raw), defaultWorkspacePreferences());
  const value = defaultWorkspacePreferences(); value.layout.positions.party = value.layout.positions.narrative;
  assert.deepEqual(parseWorkspacePreferences(JSON.stringify(value)), defaultWorkspacePreferences());
  const clean = parseWorkspacePreferences(JSON.stringify({ ...defaultWorkspacePreferences(), hostToken: "forged", hp: 999, role: "DM" }));
  assert.equal(clean.hostToken, undefined); assert.equal(clean.hp, undefined); assert.equal(clean.role, undefined);
  const collapsed = defaultWorkspacePreferences(); collapsed.layout.collapsed = ["actions"];
  assert.deepEqual(parseWorkspacePreferences(JSON.stringify(collapsed)), defaultWorkspacePreferences());
});
test("preset switches retain custom placements/collapse settings and Simplify does not overwrite them", () => {
  let p = defaultWorkspacePreferences();
  const custom = toggleWorkspacePanel(swapWorkspacePanels(p.layout, "party", "events"), "inventory");
  p = saveCustomWorkspace(p, custom);
  for (const preset of ["tactical", "immersive", "balanced"]) {
    p = selectWorkspacePreset(p, preset); assert.deepEqual(p.custom, custom);
  }
  p = { ...p, simplify: true }; p = selectWorkspacePreset(p, "custom");
  assert.deepEqual(p.layout, custom); assert.equal(p.simplify, true);
  assert.deepEqual(toggleWorkspacePanel(p.layout, "actions"), p.layout);
});
test("swap, collapse and preset selection preserve a live composer and survive remount", async () => {
  reset(); let tree: any, mounts = 0;
  function Composer() { const [value, set] = React.useState(""); React.useEffect(() => { mounts++; }, []); return React.createElement("Input", { value, onChangeText: set }); }
  const panels = Object.fromEntries(["narrative", "actions", "encounter", "party", "inventory", "events"].map(id => [id, { title: id, content: id === "actions" ? React.createElement(Composer) : React.createElement("Text", null, id) }]));
  const mount = async () => act(async () => { tree = Renderer.create(React.createElement(Shell, { panels, preferenceKey: "hero" })); });
  await mount();
  try {
    act(() => tree.root.findByType("Input").props.onChangeText("I hold my action"));
    await click(tree, "Move party"); await click(tree, "Swap with events");
    await click(tree, "Collapse inventory"); await click(tree, "Simplify");
    assert.equal(tree.root.findAllByProps({ accessibilityLabel: "Collapse actions" }).length, 0);
    assert.equal(tree.root.findAllByProps({ accessibilityLabel: "Collapse narrative" }).length, 0);
    await click(tree, "My layout");
    assert.equal(tree.root.findByType("Input").props.value, "I hold my action"); assert.equal(mounts, 1);
    const saved = parseWorkspacePreferences(stored.get("adventure-workspace.v1:hero"));
    assert.equal(saved.layout.positions.party, "bottom_right"); assert.ok(saved.layout.collapsed.includes("inventory"));
    await act(async () => tree.unmount()); await mount();
    assert.ok(button(tree, "Expand inventory"));
    await click(tree, "Tactical"); await click(tree, "My layout");
    const restored = parseWorkspacePreferences(stored.get("adventure-workspace.v1:hero"));
    assert.equal(restored.layout.positions.party, "bottom_right"); assert.ok(restored.layout.collapsed.includes("inventory"));
  } finally { act(() => tree.unmount()); }
});
test("slow loads stay bound to their character; writes are serialized and save failures can retry", async () => {
  reset(); let tree: any, api: any, resolveA!: (raw: string | null) => void;
  read = key => key.endsWith(":A") ? new Promise(resolve => { resolveA = resolve; }) : Promise.resolve(null);
  function Probe({ scope }: { scope: string }) { api = usePreferences(scope); return null; }
  await act(async () => { tree = Renderer.create(React.createElement(Probe, { scope: "A" })); });
  try {
    assert.equal(api.ready, false);
    await act(async () => tree.update(React.createElement(Probe, { scope: "B" })));
    await act(async () => resolveA(JSON.stringify({ ...defaultWorkspacePreferences(), simplify: true })));
    assert.equal(api.preferences.simplify, false);
    const writes: string[] = []; let release!: () => void;
    write = async (_key, value) => { writes.push(value); if (writes.length === 1) await new Promise<void>(resolve => { release = resolve; }); };
    await act(async () => { api.update((p: any) => ({ ...p, simplify: true })); api.update((p: any) => ({ ...p, simplify: false })); });
    assert.equal(writes.length, 1);
    await act(async () => release()); assert.equal(writes.length, 2);
    assert.equal(JSON.parse(writes[1]).simplify, false);
    write = async () => { throw Error("disk full"); };
    await act(async () => api.update((p: any) => ({ ...p, simplify: true })));
    assert.match(api.error, /could not be saved/);
    write = async (key, value) => { stored.set(key, value); };
    await act(async () => api.retry());
    assert.equal(api.error, ""); assert.equal(JSON.parse(stored.get("adventure-workspace.v1:B")!).simplify, true);
  } finally { act(() => tree.unmount()); }
});

test("read failures never overwrite saved layouts and retry loads the original preferences", async () => {
  reset(); let tree: any, api: any, writes = 0;
  read = async () => { throw Error("storage busy"); };
  write = async () => { writes++; };
  function Probe() { api = usePreferences("recover"); return null; }
  await act(async () => { tree = Renderer.create(React.createElement(Probe)); });
  try {
    assert.equal(api.ready, false); assert.match(api.error, /could not be loaded/);
    act(() => api.update((p: any) => ({ ...p, simplify: true })));
    assert.equal(writes, 0);
    read = async () => JSON.stringify({ ...defaultWorkspacePreferences(), simplify: true });
    await act(async () => api.retry());
    assert.equal(api.ready, true); assert.equal(api.preferences.simplify, true); assert.equal(writes, 0);
  } finally { act(() => tree.unmount()); }
});

test("swapping panels in Immersive keeps saved placements when leaving Simplify", async () => {
  reset(); let tree: any;
  const panels = Object.fromEntries(["narrative", "actions", "encounter", "party", "inventory", "events"].map(id => [id, { title: id, content: React.createElement("Text", null, id) }]));
  await act(async () => { tree = Renderer.create(React.createElement(Shell, { panels, preferenceKey: "immersive" })); });
  try {
    act(() => tree.root.findByProps({ testID: "adventure-workspace" }).props.onLayout({ nativeEvent: { layout: { width: 1366, height: 740 } } }));
    await click(tree, "Immersive");
    await click(tree, "Move narrative"); await click(tree, "Swap with party");
    const panel = tree.root.findByProps({ testID: "workspace-narrative" });
    const frame = panel.props.style.find((style: any) => style?.position === "absolute");
    assert.equal(frame.left, 0);
    await click(tree, "Simplify");
    const focusFrame = tree.root.findByProps({ testID: "workspace-narrative" }).props.style.find((style: any) => style?.position === "absolute");
    assert.ok(focusFrame.left > 0);
    await click(tree, "My layout");
    const restored = tree.root.findByProps({ testID: "workspace-narrative" }).props.style.find((style: any) => style?.position === "absolute");
    assert.equal(restored.left, 0);
  } finally { act(() => tree.unmount()); }
});

test("panel replacement is a validated saved view preference, preserved through presets", () => {
  const { replaceWorkspacePanel } = require("../../utils/adventure/workspaceLayoutPreferences");
  let p = defaultWorkspacePreferences();
  const changed = replaceWorkspacePanel(p.layout, "inventory", "character-summary");
  assert.equal(changed.replacements.inventory, "character-summary");
  assert.equal(p.layout.replacements.inventory, undefined);
  assert.deepEqual(replaceWorkspacePanel(changed, "actions", "character-summary"), changed);
  assert.deepEqual(replaceWorkspacePanel(changed, "inventory", "bogus"), changed);
  p = saveCustomWorkspace(p, changed);
  p = selectWorkspacePreset(p, "tactical");
  p = selectWorkspacePreset(p, "custom");
  assert.equal(parseWorkspacePreferences(JSON.stringify(p)).layout.replacements.inventory, "character-summary");
  const invalid = JSON.parse(JSON.stringify(p)); invalid.layout.replacements.actions = "character-summary";
  assert.deepEqual(parseWorkspacePreferences(JSON.stringify(invalid)), defaultWorkspacePreferences());
  assert.equal(replaceWorkspacePanel(changed, "inventory", null).replacements.inventory, undefined);
});

test("workspace sizing clamps invalid gestures and persists with custom layouts", () => {
  const { resizeWorkspaceLayout, DEFAULT_WORKSPACE_SIZING } = require("../../utils/adventure/workspaceLayoutPreferences");
  const initial = presetWorkspaceLayout();
  assert.deepEqual(initial.sizing, DEFAULT_WORKSPACE_SIZING);
  const wide = resizeWorkspaceLayout(initial, "left", 100);
  assert.equal(wide.sizing.left, 0.32);
  const narrow = resizeWorkspaceLayout(wide, "middleRow", -100);
  assert.equal(narrow.sizing.middleRow, 0.2);
  assert.deepEqual(resizeWorkspaceLayout(narrow, "right", NaN), narrow);
  const saved = saveCustomWorkspace(defaultWorkspacePreferences(), narrow);
  const parsed = parseWorkspacePreferences(JSON.stringify(saved));
  assert.deepEqual(parsed.layout.sizing, narrow.sizing);
  const invalid = JSON.parse(JSON.stringify(saved)); invalid.layout.sizing.left = "bad";
  assert.deepEqual(parseWorkspacePreferences(JSON.stringify(invalid)), defaultWorkspacePreferences());
});

test("direct layout resize persists without a Save button", async () => {
  reset(); let tree: any;
  const panels = Object.fromEntries(["narrative", "actions", "encounter", "party", "inventory", "events"].map(id => [id, { title: id, content: React.createElement("Text", null, id) }]));
  await act(async () => { tree = Renderer.create(React.createElement(Shell, { panels, preferenceKey: "resize" })); });
  try {
    act(() => tree.root.findByProps({ testID: "adventure-workspace" }).props.onLayout({ nativeEvent: { layout: { width: 1366, height: 740 } } }));
    await act(async () => button(tree, "Resize left column").props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));
    assert.ok(parseWorkspacePreferences(stored.get("adventure-workspace.v1:resize")).layout.sizing.left > 0.22);
  } finally { act(() => tree.unmount()); }
});

test("Simplify acts as a single-selection view; preset buttons exit directly without Undo", async () => {
  reset(); let tree: any;
  const panels = Object.fromEntries(["narrative", "actions", "encounter", "party", "inventory", "events"].map(id => [id, { title: id, content: React.createElement("Text", null, id) }]));
  await act(async () => { tree = Renderer.create(React.createElement(Shell, { panels, preferenceKey: "simplify-selector" })); });
  try {
    assert.equal(tree.root.findAllByProps({ accessibilityLabel: "Undo layout change" }).length, 0);
    await click(tree, "Simplify");
    assert.equal(parseWorkspacePreferences(stored.get("adventure-workspace.v1:simplify-selector")).simplify, true);
    await click(tree, "Tactical");
    let saved = parseWorkspacePreferences(stored.get("adventure-workspace.v1:simplify-selector"));
    assert.equal(saved.simplify, false); assert.equal(saved.selected, "tactical");
    await click(tree, "Simplify"); await click(tree, "Balanced");
    saved = parseWorkspacePreferences(stored.get("adventure-workspace.v1:simplify-selector"));
    assert.equal(saved.simplify, false); assert.equal(saved.selected, "balanced");
  } finally { act(() => tree.unmount()); }
});
