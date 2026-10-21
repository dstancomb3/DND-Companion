import { expect, test, type APIRequestContext } from "@playwright/test";

type CreatePartyResponse = { code: string };
type StartInitiativeResponse = { battleId: string };
type CombatStateResponse = {
  stateRevision?: number;
  updatedAt?: string;
  playerEconomyByMember?: Record<
    string,
    { actionsUsed: number; bonusActionsUsed: number; reactionUsed: boolean; movementUsedFeet: number }
  >;
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

test.describe("Party Combat Recovery Smoke", () => {
  test("durable state revision is monotonic and combat economy remains stable across subsequent reads", async ({ request }) => {
    const create = await postJson<CreatePartyResponse>(request, "/api/party/create", {});
    test.skip(create.status >= 500, "API server unavailable in this environment");

    expect(create.status).toBe(200);
    const code = create.data.code;
    const memberId = `member:${code.toLowerCase()}:recovery`;

    await putJson(request, "/api/party/sync", {
      memberId,
      partyCode: code,
      characterName: "Recovery",
      characterClass: "Cleric 3",
      currentHp: 22,
      maxHp: 22,
      tempHp: 0,
      armorClass: 16,
      conditions: [],
    });

    const started = await postJson<StartInitiativeResponse>(request, `/api/party/${code}/initiative/start`, {
      includeEnvironment: false,
      targetMemberIds: [memberId],
    });
    expect(started.status).toBe(200);

    await putJson(request, `/api/party/${code}/initiative/roll`, {
      memberId,
      initiativeRoll: 12,
      initiativeBonus: 2,
    });

    await postJson(request, `/api/party/${code}/economy/spend`, {
      memberId,
      slot: "movement",
      amount: 10,
    });

    const first = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
    expect(first.status).toBe(200);
    expect(first.data.playerEconomyByMember?.[memberId]?.movementUsedFeet).toBe(10);
    expect(typeof first.data.stateRevision).toBe("number");

    const second = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
    expect(second.status).toBe(200);
    expect((second.data.stateRevision ?? 0)).toBeGreaterThanOrEqual(first.data.stateRevision ?? 0);
    expect(second.data.playerEconomyByMember?.[memberId]?.movementUsedFeet).toBe(10);

    await postJson(request, `/api/party/${code}/end-turn`, {
      memberId,
      battleId: started.data.battleId,
    });

    const third = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
    expect(third.status).toBe(200);
    expect((third.data.stateRevision ?? 0)).toBeGreaterThan(second.data.stateRevision ?? 0);
    expect(third.data.playerEconomyByMember?.[memberId]?.movementUsedFeet).toBe(0);
  });
});
