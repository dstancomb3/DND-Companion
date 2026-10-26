import assert from "node:assert/strict";
import test from "node:test";
const Module = require("node:module");
const React = require("react");
const Renderer = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = Renderer;
let Shell: any, frames: any, Feed: any, EventPanel: any;
const originalLoad = Module._load;
try {
  Module._load = function(name: string, ...args: unknown[]) {
    if (name === "react-native") return { View: "View", Text: "Text", ScrollView: "Scroll", TextInput: "Input", ActivityIndicator: "Spinner", TouchableOpacity: "Button", StyleSheet: { create: (x: any) => x } };
    if (name === "@/hooks/useColors") return { useColors: () => ({}) };
    return originalLoad.call(this, name, ...args);
  };
  const m = require("../../components/adventure/workspace/AdventureWorkspace");
  Shell = m.AdventureWorkspace; frames = m.workspacePanelFrames;
  Feed = require("../../components/adventure/session/AiDmSessionFeedShell").AiDmSessionFeedShell;
  EventPanel = require("../../components/adventure/workspace/SessionSupportingPanels").SessionEventLogPanel;
} finally { Module._load = originalLoad; }

test("Balanced six slots fit desktop bounds without overlap, with the story widest", () => {
  assert.equal(frames(375, 700), null);
  assert.equal(frames(1366, 400), null);
  for (const [width, height] of [[1100, 480], [1366, 740], [1920, 900]]) {
    const all = frames(width, height);
    assert.equal(Object.keys(all).length, 6);
    assert.ok(all.narrative.width > all.party.width * 2);
    assert.ok(all.narrative.height > all.actions.height);
    for (const [id, box] of Object.entries(all) as any) {
      assert.ok(box.left >= 0 && box.top >= 0 && box.width > 0 && box.height > 0);
      assert.ok(box.left + box.width <= width && box.top + box.height <= height);
      for (const [otherId, other] of Object.entries(all) as any) {
        if (id === otherId) continue;
        assert.ok(box.left + box.width <= other.left || other.left + other.width <= box.left || box.top + box.height <= other.top || other.top + other.height <= box.top);
      }
    }
  }
});

test("resizing preserves a composer draft and mounts each panel once", () => {
  let mounts = 0, tree: any;
  function Composer() {
    const [draft, setDraft] = React.useState("");
    React.useEffect(() => { mounts++; }, []);
    return React.createElement("Input", { value: draft, onChangeText: setDraft });
  }
  const ids = ["narrative", "actions", "party", "inventory", "encounter", "events"];
  const panels = Object.fromEntries(ids.map(id => [id, { title: id, content: id === "actions" ? React.createElement(Composer) : React.createElement("Text", null, id) }]));
  act(() => { tree = Renderer.create(React.createElement(Shell, { panels })); });
  try {
    const resize = (width: number, height: number) => act(() => tree.root.findByProps({ testID: "adventure-workspace" }).props.onLayout({ nativeEvent: { layout: { width, height } } }));
    act(() => tree.root.findByType("Input").props.onChangeText("I examine the door"));
    resize(1366, 740); resize(375, 700); resize(1366, 740);
    assert.equal(tree.root.findByType("Input").props.value, "I examine the door");
    assert.equal(mounts, 1);
    for (const id of ids) assert.equal(tree.root.findAllByProps({ testID: `workspace-${id}` }).length, 1);
  } finally { act(() => tree.unmount()); }
});

test("reading older story stops streaming auto-scroll until Jump to latest", () => {
  let tree: any, scrolls = 0;
  const props: any = { entries: [{ id: "dm-1", role: "dm", text: "The old hall" }], guidanceSource: "user", isStreaming: true, streamingText: "Footsteps" };
  act(() => { tree = Renderer.create(React.createElement(Feed, props), { createNodeMock: (e: any) => e.type === "Scroll" ? { scrollToEnd: () => scrolls++ } : null }); });
  try {
    const scroll = () => tree.root.findByType("Scroll");
    act(() => scroll().props.onContentSizeChange());
    assert.equal(scrolls, 1);
    act(() => scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 50 }, contentSize: { height: 1500 }, layoutMeasurement: { height: 300 } } }));
    act(() => tree.update(React.createElement(Feed, { ...props, streamingText: "Footsteps approach" })));
    act(() => scroll().props.onContentSizeChange());
    assert.equal(scrolls, 1);
    const jump = tree.root.findByProps({ accessibilityLabel: "Jump to latest story" });
    act(() => jump.props.onPress());
    assert.equal(scrolls, 2);
    assert.equal(tree.root.findAllByType("Button").length, 0);
    act(() => scroll().props.onContentSizeChange());
    assert.equal(scrolls, 3);
  } finally { act(() => tree.unmount()); }
});

test("event widget keeps server newest-first order and limits its snapshot", () => {
  let tree: any;
  const events = Array.from({ length: 25 }, (_, i) => ({ id: String(i), type: "turn_advanced", message: `Event ${i}` }));
  act(() => { tree = Renderer.create(React.createElement(EventPanel, { events })); });
  try {
    const messages = tree.root.findAllByType("Text").map((n: any) => n.children.join("")).filter((s: string) => s.startsWith("Event"));
    assert.equal(messages.length, 20); assert.equal(messages[0], "Event 0"); assert.equal(messages.at(-1), "Event 19");
  } finally { act(() => tree.unmount()); }
});

test("required-action navigation scrolls to its actual action-panel offset", () => {
  const ref = React.createRef(); let tree: any;
  const scrolls: any[] = [];
  const ids = ["narrative", "actions", "party", "inventory", "encounter", "events"];
  const panels = Object.fromEntries(ids.map(id => [id, { title: id, content: React.createElement("Text", null, id) }]));
  act(() => { tree = Renderer.create(React.createElement(Shell, { panels, ref }), { createNodeMock: (e: any) => e.type === "Scroll" ? { scrollTo: (payload: any) => scrolls.push(payload) } : null }); });
  try {
    act(() => tree.root.findByProps({ testID: "workspace-actions" }).props.onLayout({ nativeEvent: { layout: { y: 420 } } }));
    act(() => ref.current.focusActions(135));
    assert.deepEqual(scrolls, [{ y: 420, animated: true }, { y: 135, animated: true }]);
    scrolls.length = 0;
    act(() => tree.root.findByProps({ testID: "adventure-workspace" }).props.onLayout({ nativeEvent: { layout: { width: 1366, height: 740 } } }));
    act(() => ref.current.focusActions(200));
    assert.deepEqual(scrolls, [{ y: 200, animated: true }]);
  } finally { act(() => tree.unmount()); }
});

test("turn footer stays outside the action scroll so End Turn remains visible", () => {
  let tree: any;
  const ids = ["narrative", "actions", "party", "inventory", "encounter", "events"];
  const panels: any = Object.fromEntries(ids.map(id => [id, { title: id, content: React.createElement("Text", null, id) }]));
  panels.actions.footer = React.createElement("Text", { testID: "turn-footer" }, "End Turn");
  act(() => { tree = Renderer.create(React.createElement(Shell, { panels })); });
  try {
    const actionPanel = tree.root.findByProps({ testID: "workspace-actions" });
    assert.equal(actionPanel.findAllByProps({ testID: "turn-footer" }).length, 1);
    assert.equal(actionPanel.findByType("Scroll").findAllByProps({ testID: "turn-footer" }).length, 0);
  } finally { act(() => tree.unmount()); }
});
