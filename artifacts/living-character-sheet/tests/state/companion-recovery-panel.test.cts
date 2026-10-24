import assert from "node:assert/strict";
import test from "node:test";
const Module = require("node:module");
const React = require("react");
const Renderer = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const originalLoad = Module._load;
let Panel: any;
try {
  Module._load = function(name: string, ...args: unknown[]) {
    if (name === "react-native") return { View: "View", Text: "Text", TextInput: "TextInput", TouchableOpacity: "Button" };
    return originalLoad.call(this, name, ...args);
  };
  Panel = require("../../components/CompanionRecoveryPanel").CompanionRecoveryPanel;
} finally { Module._load = originalLoad; }
const { act } = Renderer;
function setup(onRecover = async (_payload: any) => {}) {
  let tree: any;
  const props: any = {
    npc: { id: "npc", name: "Wolf", companionAdmission: { schemaVersion: "companion-admission.v1", memberId: "old", companionId: "pet", detachedAt: "stamp" } },
    members: [{ id: "new-owner", characterName: "Ranger" }], revision: 4,
    colors: { foreground: "white", mutedForeground: "gray", primary: "purple", border: "gray", background: "black" }, onRecover,
  };
  act(() => { tree = Renderer.create(React.createElement(Panel, props)); });
  const buttons = () => tree.root.findAllByType("Button");
  const button = (label: string) => buttons().find((b: any) => b.findAllByType("Text").some((n: any) => n.children.join("").includes(label)));
  const type = (text: string) => act(() => tree.root.findByType("TextInput").props.onChangeText(text));
  const press = (label: string) => act(() => button(label).props.onPress());
  const review = () => { press("Ranger"); type("Owner rejoined"); press("Review recovery"); };
  const update = (changes: any) => { Object.assign(props, changes); act(() => tree.update(React.createElement(Panel, props))); };
  const close = () => act(() => tree.unmount());
  return { tree, props, button, type, press, review, update, close };
}
test("recovery requires recipient, reason and a separate confirmation before sending exact reviewed state", async () => {
  const sent: any[] = [], f = setup(async payload => { sent.push(payload); });
  try {
    assert.equal(f.button("Review recovery").props.disabled, true);
    f.press("Ranger"); f.type("ok"); assert.equal(f.button("Review recovery").props.disabled, true);
    f.type("Owner rejoined"); assert.equal(f.button("Review recovery").props.disabled, false);
    f.press("Review recovery"); assert.equal(sent.length, 0);
    await act(async () => f.button("Confirm recovery").props.onPress());
    assert.deepEqual(sent, [{ targetMemberId: "new-owner", expectedRevision: 4, expectedDetachedAt: "stamp", reason: "Owner rejoined" }]);
  } finally { f.close(); }
});
test("new revision, recipient disappearance and cancellation invalidate the reviewed confirmation", () => {
  const f = setup();
  try {
    f.review(); f.update({ revision: 5 }); assert.equal(f.button("Confirm recovery"), undefined);
    f.press("Review recovery"); f.press("Cancel"); assert.equal(f.button("Confirm recovery"), undefined);
    f.press("Review recovery"); f.update({ members: [] }); assert.equal(f.button("Confirm recovery"), undefined);
    assert.equal(f.button("Review recovery").props.disabled, true);
  } finally { f.close(); }
});
test("recovery error preserves draft, displays error and requires fresh review without retry", async () => {
  let calls = 0; const f = setup(async () => { calls++; throw Error("Conflict: refresh and review"); });
  try {
    f.review(); await act(async () => f.button("Confirm recovery").props.onPress());
    assert.equal(calls, 1); assert.equal(f.button("Confirm recovery"), undefined);
    assert.equal(f.tree.root.findByType("TextInput").props.value, "Owner rejoined");
    assert.equal(f.tree.root.findAllByType("Text").some((n: any) => n.props.accessibilityRole === "alert"), true);
  } finally { f.close(); }
});
test("double confirm sends one request and disables the form while awaiting acknowledgement", async () => {
  let calls = 0, release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const f = setup(async () => { calls++; await wait; });
  try {
    f.review(); const confirm = f.button("Confirm recovery").props.onPress;
    act(() => { confirm(); confirm(); });
    assert.equal(calls, 1); assert.equal(f.tree.root.findByType("TextInput").props.editable, false);
    await act(async () => { release(); await wait; });
  } finally { f.close(); }
});
test("non-detached companion has no recovery controls", () => {
  const f = setup();
  try { f.update({ npc: { ...f.props.npc, companionAdmission: { memberId: "new-owner" } } }); assert.equal(f.tree.toJSON(), null); }
  finally { f.close(); }
});
