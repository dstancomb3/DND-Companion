import assert from "node:assert/strict";
import test from "node:test";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { normalizeLootAnalysisResult, normalizeQuickUpdateResult } = await import("./index");
const { normalizeParserItemMechanics } = await import("../../lib/mechanics/itemMechanicsBoundary");
const item = (extra = {}) => ({ id: "a", name: "Ward", category: "magic", quantity: 1, confidence: "high", needsReview: false, ...extra });
const normalize = (items: unknown[]) => normalizeLootAnalysisResult({ proposedItems: items }).proposedItems as Record<string, unknown>[];
for (const quantity of [-1, 0, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "2"]) {
  test(`rejects invalid creation quantity ${quantity}`, () => assert.throws(() => normalize([item({ quantity })]), /quantity/));
}
test("empty object and malformed entries cannot become successful empty loot", () => {
  assert.throws(() => normalizeLootAnalysisResult({}), /proposed items/);
  assert.throws(() => normalize([null]), /object/);
  assert.throws(() => normalize([item({ name: " " })]), /name/);
});
for (const extra of [{equippedEffects:42},{equippedEffects:[{type:"invented",label:"Effect"}]},{equippedEffects:[{type:"stat_bonus",label:"AC",statKey:"armorClass"}]},{damageDice:"not-dice"},{damageDice:"0d6"},{damageDice:"101d6"},{damageType:"invented-type"},{weight:-1},{value:Infinity},{equippedEffects:[{type:"spell",label:"Spell",uses:1.5}]},{equippedEffects:[{type:"attack_damage",label:"Hit",attackDamageDice:"oops"}]}]) {
  test(`rejects malformed supplied fields ${JSON.stringify(extra)}`, () => assert.throws(() => normalize([item(extra)])));
}
test("preserves zero value, weight and subtype", () => {
  const result = normalize([item({ value: 0, weight: 0, subtype: "Ring" })])[0]!;
  assert.equal(result.value, 0); assert.equal(result.weight, 0); assert.equal(result.subtype, "Ring");
});
test("separates weapon, metadata and provenance variants", () => {
  for (const extra of [{damageDice:"1d8"},{damageType:"cold"},{weight:2},{officialMatch:true},{notes:"Silvered"}]) {
    assert.equal(normalize([item({category:"weapon",damageDice:"1d6",damageType:"fire"}),item({category:"weapon",damageDice:"1d6",damageType:"fire",...extra})]).length, 2);
  }
});
test("compatible quantities combine without effect IDs changing identity; overflow fails", () => {
  const effect = {type:"stat_bonus",label:"AC",statKey:"armorClass",statValue:1};
  assert.equal(normalize([item({equippedEffects:[effect]}),item({equippedEffects:[effect],quantity:2})])[0]!.quantity,3);
  assert.throws(() => normalize([item({quantity:Number.MAX_SAFE_INTEGER}),item()]), /safe integer/);
});
test("unsupported damage response requires review even beside a supported stat bonus", () => {
  const ward = item({notes:"Negates fire damage and reflects 1d8 fire damage to its source.",equippedEffects:[{type:"stat_bonus",label:"AC",statKey:"armorClass",statValue:1}]});
  assert.equal(normalize([ward])[0]!.needsReview,true);
  const quick = normalizeQuickUpdateResult({proposedInventoryChanges:[ward]});
  assert.equal((quick.proposedInventoryChanges as Record<string,unknown>[])[0]!.needsReview,true);
});
test("malformed mechanics are quarantined instead of retained as verified", () => {
  for (const raw of [{schemaVersion:"v999",ownerType:"other",mechanics:[{nonsense:true}]},{schemaVersion:"v1",ownerType:"item",mechanics:[{nonsense:true}]}]) {
    const result=normalizeParserItemMechanics({...raw,review:{reviewStatus:"verified",confidence:"high"}})!;
    assert.deepEqual(result.mechanics,[]);assert.equal(result.review.reviewStatus,"unsupported");assert.ok(result.review.unsupportedSegments?.length);
  }
});
test("a model cannot verify even structurally admissible mechanics", () => {
  const result=normalizeParserItemMechanics({schemaVersion:"v1",ownerType:"item",mechanics:[],review:{reviewStatus:"verified",confidence:"high"}})!;
  assert.equal(result.review.reviewStatus,"needs_review");
});

test("signed inventory removals keep their separate quick-update contract", () => {
  const result=normalizeQuickUpdateResult({proposedInventoryChanges:[item({quantity:-2})]});
  assert.equal((result.proposedInventoryChanges as Record<string,unknown>[])[0]!.quantity,-2);
});

test("generation route rejects invalid model loot before a success response", async () => {
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY="test-placeholder-not-a-real-key";
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL="https://test.invalid/v1";
  const { default: OpenAI }=await import("openai");
  const { default: router }=await import("./index");
  const transport=OpenAI.prototype as unknown as {post:(...args:unknown[])=>Promise<unknown>};
  const originalPost=transport.post, originalFetch=globalThis.fetch;
  const stack=router as unknown as {stack:Array<{route?:{path:string;stack:Array<{handle:(req:unknown,res:unknown)=>Promise<void>}>}}>};
  const handler=stack.stack.find(layer=>layer.route?.path==="/generate-loot")!.route!.stack.at(-1)!.handle;
  let modelOutput:unknown;
  transport.post=async()=>({choices:[{message:{content:JSON.stringify(modelOutput)}}]});
  globalThis.fetch=async()=>{throw new Error("Unexpected network in test");};
  try {
    for(const output of [{}, {proposedItems:[item({quantity:-1})]}, {proposedItems:[item({damageDice:"not-dice"})]}]) {
      modelOutput=output;
      const response={statusCode:200,body:null as unknown,status(code:number){this.statusCode=code;return this;},json(body:unknown){this.body=body;return this;}};
      await handler({body:{prompt:"Generate one item"},headers:{}},response);
      assert.equal(response.statusCode,502);
    }
    modelOutput={proposedItems:[item({notes:"Negates fire damage and reflects 1d8 fire damage to its source."})]};
    const response={statusCode:200,body:null as unknown,status(code:number){this.statusCode=code;return this;},json(body:unknown){this.body=body;return this;}};
    await handler({body:{prompt:"Generate a ward"},headers:{}},response);
    assert.equal(response.statusCode,200);
    assert.equal((response.body as {proposedItems:Array<{needsReview:boolean}>}).proposedItems[0]!.needsReview,true);
  } finally {transport.post=originalPost;globalThis.fetch=originalFetch;}
});

 test("legacy attack bonus and action type fields survive creation", () => {
  const result=normalize([item({equippedEffects:[{type:"attack_damage",label:"Hit",attackDamageDice:"1d8",attackDamageBonus:2,attackToHitBonus:1,actionType:"reaction"}]})])[0]!;
  const effect=(result.equippedEffects as Record<string,unknown>[])[0]!;
  assert.equal(effect.attackDamageBonus,2);assert.equal(effect.attackToHitBonus,1);assert.equal(effect.actionType,"reaction");
});
