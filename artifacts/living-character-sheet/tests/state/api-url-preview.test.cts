import assert from "node:assert/strict";
import test from "node:test";
const keys = ["EXPO_PUBLIC_API_SAME_ORIGIN", "EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_API_BASE_URL", "EXPO_PUBLIC_DOMAIN"];
function resolve(env: Record<string, string>, origin?: string) {
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]])); const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
    if (origin) Object.defineProperty(globalThis, "window", { value: { location: { origin } }, configurable: true }); else Reflect.deleteProperty(globalThis, "window");
    delete require.cache[require.resolve("../../utils/apiUrl")]; return require("../../utils/apiUrl").API_BASE_URL;
  } finally {
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor); else Reflect.deleteProperty(globalThis, "window");
    delete require.cache[require.resolve("../../utils/apiUrl")];
  }
}
test("cloud preview calls its own browser origin instead of baked local/domain overrides", () => {
  assert.equal(resolve({ EXPO_PUBLIC_API_SAME_ORIGIN: "true", EXPO_PUBLIC_API_URL: "http://localhost:3000", EXPO_PUBLIC_DOMAIN: "old.example" }, "https://phone-preview.example"), "https://phone-preview.example");
});
test("local and native defaults remain compatible", () => {
  assert.equal(resolve({}), "http://localhost:3000"); assert.equal(resolve({ EXPO_PUBLIC_DOMAIN: "localhost:8082" }), "http://localhost:3000");
  assert.equal(resolve({ EXPO_PUBLIC_API_URL: "https://api.example" }), "https://api.example");
  assert.equal(resolve({ EXPO_PUBLIC_API_SAME_ORIGIN: "true" }), "http://localhost:3000");
});
