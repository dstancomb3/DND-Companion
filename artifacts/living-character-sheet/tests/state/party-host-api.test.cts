import assert from "node:assert/strict";
import test from "node:test";
import { partyHostApi } from "../../utils/partyHostApi";

function fixture() {
  const rows = new Map<string, string>();
  const calls: Array<{ path: string; options?: RequestInit }> = [];
  const storage = {
    getItem: async (key: string) => rows.get(key) ?? null,
    setItem: async (key: string, value: string) => { rows.set(key, value); },
    removeItem: async (key: string) => { rows.delete(key); },
  };
  let reject = false;
  const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
    calls.push({ path, options });
    if (reject) throw new Error("Server unavailable");
    return { code: "PARTY", hostToken: "private-token" } as T;
  };
  return { rows, calls, storage, request, fail: () => { reject = true; } };
}

test("create stores capability outside shareable response; a new adapter can disband after reload", async () => {
  const f = fixture();
  assert.deepEqual(await partyHostApi(f.request, f.storage).createParty(), { code: "PARTY" });
  assert.equal(f.rows.size, 1);
  await partyHostApi(f.request, f.storage).disbandParty("PARTY");
  assert.deepEqual(f.calls[1], { path: "/party/PARTY/disband", options: { method: "POST", headers: { Authorization: "Bearer private-token" } } });
  assert.equal(f.rows.size, 0);
});

test("knowing another party code cannot send a disband request", async () => {
  const f = fixture(), api = partyHostApi(f.request, f.storage);
  await api.createParty();
  await assert.rejects(api.disbandParty("OTHER"), /Only the device/);
  assert.equal(f.calls.length, 1);
});

test("failed disband keeps the credential for retry", async () => {
  const f = fixture(), api = partyHostApi(f.request, f.storage);
  await api.createParty();
  f.fail();
  await assert.rejects(api.disbandParty("PARTY"), /Server unavailable/);
  assert.equal(f.rows.size, 1);
});

test("storage failure prevents a false successful create", async () => {
  const f = fixture();
  f.storage.setItem = async () => { throw new Error("Storage unavailable"); };
  await assert.rejects(partyHostApi(f.request, f.storage).createParty(), /Storage unavailable/);
});

test("host removal uses the private host token and never a caller role flag", async () => {
  const f = fixture(), api = partyHostApi(f.request, f.storage);
  await api.createParty();
  await api.removePartyMember("other-member", "PARTY");
  assert.deepEqual(f.calls[1], { path: "/party/leave", options: {
    method: "DELETE", headers: { Authorization: "Bearer private-token", "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: "other-member", partyCode: "PARTY" }),
  } });
  assert.equal(f.rows.size, 1);
  await assert.rejects(api.removePartyMember("other-member", "OTHER"), /Only the device/);
  assert.equal(f.calls.length, 2);
});
