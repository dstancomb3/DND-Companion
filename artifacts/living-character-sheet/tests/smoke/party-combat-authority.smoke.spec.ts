import { expect, test, type APIRequestContext } from "@playwright/test";

type CreatePartyResponse = { code: string };
type MembersResponse = { members: Array<{ id: string }> };
type StartInitiativeResponse = { battleId: string };
type CombatStateResponse = {
  stateRevision?: number;
  updatedAt?: string;
  currentTurnIdByBattle: Record<string, string | null>;
};

const SMOKE_API_BASE_URL = process.env.SMOKE_API_BASE_URL || "http://localhost:3000";

function toApiUrl(path: string): string {
  return new URL(path, `${SMOKE_API_BASE_URL}/`).toString();
}

async function parseJsonOrThrow<T>(response: Awaited<ReturnType<APIRequestContext["fetch"]>>, method: string, targetUrl: string): Promise<T> {
  const status = response.status();
  const contentType = response.headers()["content-type"] ?? "(missing)";

  if (!contentType.toLowerCase().includes("json")) {
    const preview = (await response.text()).slice(0, 160).replace(/\s+/g, " ").trim();
    throw new Error(
      `Smoke API request hit non-JSON content: ${method} ${targetUrl} returned status ${status} with content-type "${contentType}". Preview: ${preview || "(empty body)"}`
    );
  }

  return (await response.json()) as T;
}

async function postJson<T>(request: APIRequestContext, path: string, body: unknown): Promise<{ status: number; data: T }> {
  const targetUrl = toApiUrl(path);
  const response = await request.post(targetUrl, { data: body });
  const data = await parseJsonOrThrow<T>(response, "POST", targetUrl);
  return { status: response.status(), data };
}

async function putJson<T>(request: APIRequestContext, path: string, body: unknown): Promise<{ status: number; data: T }> {
  const targetUrl = toApiUrl(path);
  const response = await request.put(targetUrl, { data: body });
  const data = await parseJsonOrThrow<T>(response, "PUT", targetUrl);
  return { status: response.status(), data };
}

async function getJson<T>(request: APIRequestContext, path: string): Promise<{ status: number; data: T }> {
  const targetUrl = toApiUrl(path);
  const response = await request.get(targetUrl);
  const data = await parseJsonOrThrow<T>(response, "GET", targetUrl);
  return { status: response.status(), data };
}

test.describe("Party Combat Authority Smoke", () => {
  test("active player can end turn, non-active is rejected, DM override can advance", async ({ request }) => {
    const create = await postJson<CreatePartyResponse>(request, "/api/party/create", {});
    test.skip(create.status >= 500, "API server unavailable in this environment");

    expect(create.status).toBe(200);
    const code = create.data.code;

    const memberA = `member:${code.toLowerCase()}:a`;
    const memberB = `member:${code.toLowerCase()}:b`;

    await putJson(request, "/api/party/sync", {
      memberId: memberA,
      partyCode: code,
      characterName: "Alpha",
      characterClass: "Fighter 3",
      currentHp: 20,
      maxHp: 20,
      tempHp: 0,
      armorClass: 16,
      conditions: [],
    });

    await putJson(request, "/api/party/sync", {
      memberId: memberB,
      partyCode: code,
      characterName: "Bravo",
      characterClass: "Rogue 3",
      currentHp: 16,
      maxHp: 16,
      tempHp: 0,
      armorClass: 14,
      conditions: [],
    });

    const started = await postJson<StartInitiativeResponse>(request, `/api/party/${code}/initiative/start`, {
      includeEnvironment: false,
      targetMemberIds: [memberA, memberB],
    });
    expect(started.status).toBe(200);

    const battleId = started.data.battleId;

    await putJson(request, `/api/party/${code}/initiative/roll`, {
      memberId: memberA,
      initiativeRoll: 18,
      initiativeBonus: 2,
    });

    await putJson(request, `/api/party/${code}/initiative/roll`, {
      memberId: memberB,
      initiativeRoll: 8,
      initiativeBonus: 1,
    });

    const initial = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
    expect(initial.status).toBe(200);
    expect(typeof initial.data.stateRevision).toBe("number");

    const activeTurnId = initial.data.currentTurnIdByBattle[battleId];
    expect(activeTurnId).toBeTruthy();

    const nonActive = activeTurnId === memberA ? memberB : memberA;

    const rejected = await postJson<{ error: string }>(request, `/api/party/${code}/end-turn`, {
      memberId: nonActive,
      battleId,
    });
    expect(rejected.status).toBe(403);
    expect(rejected.data.error).toContain("Not your turn");

    const advanced = await postJson<{ ok: boolean; currentTurnId: string | null }>(request, `/api/party/${code}/end-turn`, {
      memberId: activeTurnId,
      battleId,
    });
    expect(advanced.status).toBe(200);
    expect(advanced.data.ok).toBe(true);
    expect(advanced.data.currentTurnId).not.toBe(activeTurnId);

    const afterAdvance = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
    expect(afterAdvance.status).toBe(200);
    expect((afterAdvance.data.stateRevision ?? 0)).toBeGreaterThan(initial.data.stateRevision ?? 0);

    const override = await postJson<{ ok: boolean }>(request, `/api/party/${code}/end-turn`, {
      memberId: nonActive,
      battleId,
      isDmOverride: true,
    });
    expect(override.status).toBe(200);
    expect(override.data.ok).toBe(true);
  });
});
