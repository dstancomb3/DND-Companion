import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.env.DATABASE_URL ??= "postgres://audit:audit@localhost:5432/audit";
process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "audit-placeholder-not-a-real-key";
process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://audit.invalid/v1";
const { default: OpenAI } = await import("../../artifacts/api-server/node_modules/openai/index.mjs");
const { default: router, normalizeLootAnalysisResult } = await import("../../artifacts/api-server/src/routes/ai/index.ts");
const { normalizeParserItemMechanics } = await import("../../artifacts/api-server/src/lib/mechanics/itemMechanicsBoundary.ts");
const results: Array<Record<string, unknown>> = [];
const input = (items: unknown[], extra: Record<string, unknown> = {}) => ({ proposedItems: items, ...extra });
const normalize = (value: unknown) => normalizeLootAnalysisResult(value) as { sourceType: string; proposedItems: Array<Record<string, any>> };
const item = (extra: Record<string, unknown> = {}) => ({ id: "item", name: "Sword", category: "weapon", quantity: 1, confidence: "high", needsReview: false, notes: "An iron sword.", ...extra });

const empty = normalize({}); assert.equal(empty.proposedItems.length, 0);
results.push({ probe: "empty model object normalizes as success-shaped empty loot", output: empty });
const quantities = normalize(input([item({ name: "Negative", quantity: -2 }), item({ name: "Fraction", quantity: 0.5 })])).proposedItems;
assert.deepEqual(quantities.map(i => i.quantity), [-2, 0.5]);
results.push({ probe: "invalid creation quantities survive", quantities: quantities.map(i => i.quantity) });
const invalidDice = normalize(input([item({ damageDice: "not-dice", damageType: "invented-type" })])).proposedItems[0];
assert.equal(invalidDice.damageDice, "not-dice");
results.push({ probe: "weapon strings are not dice/rules validation", output: invalidDice });
const merged = normalize(input([item({ id: "fire", damageDice: "1d6", damageType: "fire", officialMatch: true }), item({ id: "cold", damageDice: "1d8", damageType: "cold", confidence: "low" })])).proposedItems;
assert.equal(merged.length, 1); assert.equal(merged[0].quantity, 2);
results.push({ probe: "different same-name weapon variants merge and confidence/provenance promote", output: merged[0] });
const metadata = normalize(input([item({ value: 50, weight: 3, subtype: "Longsword", attunement: true })])).proposedItems[0];
assert.equal(metadata.value, undefined); assert.equal(metadata.weight, undefined);
results.push({ probe: "proposed-item normalization omits supplied metadata", dropped: ["value", "weight", "subtype", "attunement"].filter(key => !(key in metadata)) });
const ward = normalize(input([item({ name: "Fire Ward", category: "magic", notes: "Negates fire damage and reflects 1d8 fire damage to its source." })])).proposedItems[0];
assert.equal(ward.needsReview, false); assert.equal(ward.equippedEffects, undefined);
results.push({ probe: "immunity/reflection prose remains unimplemented without required review", output: ward });
const source = normalize(input([item()], { sourceType: "text" })); assert.equal(source.sourceType, "photo");
results.push({ probe: "text generation provenance becomes photo", sourceType: source.sourceType });
const mechanics = normalizeParserItemMechanics({ schemaVersion: "v999", ownerType: "other", mechanics: [{ nonsense: true }], review: { reviewStatus: "verified", confidence: "high" } });
assert.equal(mechanics?.review.reviewStatus, "verified"); assert.deepEqual(mechanics?.mechanics, [{ nonsense: true }]);
results.push({ probe: "bad envelope and arbitrary mechanic object retain verified review label", output: mechanics });

function handler(routePath: string) {
  return (router as any).stack.find((layer: any) => layer.route?.path === routePath).route.stack.at(-1).handle;
}
function response() { return { statusCode: 200, body: null as any, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } }; }
const originalPost = OpenAI.prototype.post;
const originalFetch = globalThis.fetch;
let modelResult: unknown = {}, calls: any[] = [];
(OpenAI.prototype as any).post = async (_url: string, options: unknown) => { calls.push(options); return { choices: [{ message: { content: JSON.stringify(modelResult) } }] }; };
globalThis.fetch = (() => { throw new Error("Unexpected network access in audit probe"); }) as any;
try {
  modelResult = input([item({ category: "weapon", tags: ["legendary"] })], { sourceType: "text" });
  const a = response(), b = response();
  const request = { body: { prompt: "One common potion", categories: ["consumable"], rarity: ["common"] }, headers: { "x-idempotency-key": "same-audit-command" } };
  await handler("/generate-loot")(request, a); await handler("/generate-loot")(request, b);
  assert.equal(a.statusCode, 200); assert.equal(a.body.proposedItems[0].category, "weapon"); assert.equal(calls.length, 2);
  results.push({ probe: "generation constraints and repeated request key are not enforced", status: a.statusCode, category: a.body.proposedItems[0].category, tags: a.body.proposedItems[0].tags, modelCalls: calls.length });
  calls = []; modelResult = { properties: "Reflects 99d99 damage", description: " " };
  const description = response();
  await handler("/item-properties")({ body: { item: { name: "Ward", equippedEffects: [{ label: "Fireproof", description: "Negates fire and reflects 1d8" }] } } }, description);
  const prompt = JSON.stringify(calls);
  assert.equal(prompt.includes("Fireproof"), false); assert.equal(description.statusCode, 200); assert.equal(description.body.description, "");
  results.push({ probe: "item-properties omits supplied effects and accepts empty flavor/unchecked mechanical prose", status: description.statusCode, effectsPresentInPrompt: false, body: description.body });
  let threw = false;
  try { await handler("/item-properties")({ body: undefined }, response()); } catch { threw = true; }
  assert.equal(threw, true); results.push({ probe: "missing request body throws before route validation", threw });
} finally { OpenAI.prototype.post = originalPost; globalThis.fetch = originalFetch; }
await mkdir(path.join(root, "docs/audits"), { recursive: true });
await writeFile(path.join(root, "docs/audits/item-api-probes.json"), JSON.stringify({ baseline: "d4cacecb75bc408f13fc90809e9f364e7899f805", method: "Actual route handlers/normalizers; SDK transport mocked; network blocked; no AI or database calls. Assertions characterize current gaps.", results }, null, 2) + "\n");
console.log(`Item API audit probes passed: ${results.length}`);
