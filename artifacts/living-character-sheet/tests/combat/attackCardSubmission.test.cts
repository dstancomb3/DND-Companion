import assert from "node:assert/strict";
import test from "node:test";
const Module = require("node:module"), path = require("node:path");
const React = require("react"), Renderer = require("react-test-renderer");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = Renderer;
let resolveAction: (command: any) => Promise<any>;
const commands: any[] = [];
const combat: any = { active: true, turnKey: "turn-1", currentTurnId: "player", selectedTargetIds: new Set(["wolf"]), combatNpcs: [{ id: "wolf", name: "Wolf", conditions: [] }], partyTargets: [{ id: "wolf" }], resolveCombatAction: (command: any) => { commands.push(command); return resolveAction(command); } };
const originalLoad = Module._load;
let AttackCard: any;
try {
  Module._load = function(name: string, ...args: unknown[]) {
    if (name === "react-native") return { View: "View", Text: "Text", TextInput: "Input", TouchableOpacity: "Button", Modal: "Modal", ScrollView: "Scroll", StyleSheet: { create: (x: any) => x }, Alert: { alert: () => { throw Error("Attack submission must not require platform alerts"); } } };
    if (name === "@expo/vector-icons") return { Feather: "Icon", MaterialCommunityIcons: "Icon" };
    if (name === "@/hooks/useColors") return { useColors: () => ({}) };
    if (name === "@/context/CharacterContext") return { useCharacter: () => ({ resources: [], conditions: [], character: { abilityScores: {} }, updateAttack() {}, updateItem() {} }) };
    if (name === "@/context/AppSettingsContext") return { useAppSettings: () => ({ settings: { effects: { enabled: false } } }) };
    if (name === "@/context/CombatContext") return { useCombat: () => combat };
    if (name === "@/context/PartyContext") return { useParty: () => ({ isInParty: true, memberId: "player", members: [], combatState: { participantBattleById: { player: "battle" }, currentTurnIdByBattle: { battle: "player" } } }) };
    if (name === "@/components/ui/Card") return { Card: (p: any) => React.createElement("View", p, p.children) };
    if (name === "@/components/ScrollHintScrollView") return { ScrollHintScrollView: "Scroll" };
    if (name === "./ConcentrationSaveModal") return { ConcentrationSaveModal: () => null };
    if (name === "@/utils/triggerEffect") return { triggerEffect() {} };
    if (name.startsWith("@/")) return originalLoad.call(this, path.resolve(__dirname, "../..", name.slice(2)), ...args);
    return originalLoad.call(this, name, ...args);
  };
  AttackCard = require("../../components/attacks/AttackCard").AttackCard;
} finally { Module._load = originalLoad; }
function setup() {
  commands.length = 0;
  resolveAction = async () => ({ status: "accepted", targetResults: [] });
  let tree: any;
  const attack = { id: "strike", name: "Unarmed Strike", attackBonus: 7, damageDice: "1d6", damageModifier: 4, damageType: "bludgeoning", reminders: [], additionalDamage: [] };
  act(() => { tree = Renderer.create(React.createElement(AttackCard, { attack })); });
  const input = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
  const type = (label: string, value: string) => act(() => input(label).props.onChangeText(value));
  const use = () => tree.root.findByProps({ accessibilityLabel: "Use Unarmed Strike attack" });
  const press = async () => act(async () => { use().props.onPress(); });
  const text = () => tree.root.findAllByType("Text").map((n: any) => n.children.join("")).join(" ");
  const ready = () => { type("Unarmed Strike d20 attack roll", "12"); type("Unarmed Strike primary damage dice total", "3"); };
  return { tree, input, type, use, press, text, ready, close: () => act(() => tree.unmount()) };
}

test("Use Attack works in one click with missing rolls and preserves explicit To Hit", async () => {
  const f = setup();
  try {
    assert.ok(f.input("Unarmed Strike primary damage dice total"));
    f.type("Unarmed Strike d20 attack roll", "12");
    await f.press();
    assert.equal(commands.length, 1);
    assert.equal(commands[0].declared.attackRoll, 12);
    const rolled = Number(f.input("Unarmed Strike primary damage dice total").props.value);
    assert.ok(rolled >= 1 && rolled <= 6);
    assert.equal(commands[0].declared.damagePackets[0].rawAmount, rolled + 4);
    assert.match(f.text(), /Attack accepted/);
  } finally { f.close(); }
});
test("Use Attack rolls both missing dice without a separate setup sequence", async () => {
  const f = setup();
  try {
    await f.press(); assert.equal(commands.length, 1);
    assert.ok(commands[0].declared.attackRoll >= 1 && commands[0].declared.attackRoll <= 20);
    assert.ok(commands[0].declared.damagePackets[0].rawAmount >= 5 && commands[0].declared.damagePackets[0].rawAmount <= 10);
  } finally { f.close(); }
});
test("explicit damage roll fills its input, then Use Attack sends selected target and declared damage", async () => {
  const f = setup();
  try {
    f.type("Unarmed Strike d20 attack roll", "12");
    act(() => f.tree.root.findByProps({ accessibilityLabel: "Roll Unarmed Strike damage" }).props.onPress());
    const damage = Number(f.input("Unarmed Strike primary damage dice total").props.value);
    assert.ok(damage >= 1 && damage <= 6);
    await f.press();
    assert.equal(commands.length, 1);
    assert.deepEqual(commands[0].targets.targetIds, ["wolf"]);
    assert.equal(commands[0].declared.attackRoll, 12);
    assert.equal(commands[0].declared.damagePackets[0].rawAmount, damage + 4);
    assert.match(f.text(), /Attack accepted/);
    assert.match(f.text(), /Attack locked in combat/);
  } finally { f.close(); }
});
test("resolver rejection is visible and retains inputs for correction", async () => {
  const f = setup(); resolveAction = async () => ({ status: "rejected", reasonCode: "no_action_available" });
  try {
    f.ready(); await f.press();
    assert.match(f.text(), /No action is available/);
    assert.equal(f.input("Unarmed Strike primary damage dice total").props.value, "3");
    assert.ok(f.use()); assert.doesNotMatch(f.text(), /Attack locked/);
  } finally { f.close(); }
});
test("unexpected failure is surfaced and a later deliberate retry remains available", async () => {
  const f = setup(); resolveAction = async () => { throw Error("Network unavailable"); };
  try {
    await f.press(); assert.match(f.text(), /Network unavailable/); assert.equal(f.use().props.disabled, false);
    resolveAction = async () => ({ status: "accepted", targetResults: [] });
    await f.press(); assert.equal(commands.length, 2); assert.deepEqual(commands[1].declared, commands[0].declared); assert.match(f.text(), /Attack accepted/);
  } finally { f.close(); }
});
test("rapid repeated clicks submit once while awaiting acknowledgement", async () => {
  const f = setup(); let finish!: (value: any) => void;
  resolveAction = () => new Promise(resolve => { finish = resolve; });
  try {
    f.ready(); const click = f.use().props.onPress;
    act(() => { click(); click(); });
    assert.equal(commands.length, 1); assert.equal(f.use().props.disabled, true);
    await act(async () => finish({ status: "accepted", targetResults: [] }));
    assert.match(f.text(), /Attack locked/);
  } finally { f.close(); }
});
