import { expect, test, type APIRequestContext } from "@playwright/test";

type CreatePartyResponse = { code: string };
type LootAssignmentItem = {
  name: string;
  quantity: number;
  category: string;
  notes?: string;
};
type LootAssignment = {
  id: string;
  targetMemberId: string;
  assignedBy?: string;
  claimedAt?: string;
  claimedBy?: string;
  item: LootAssignmentItem;
};
type LootAssignmentsResponse = {
  ok: boolean;
  assignments: LootAssignment[];
};
type ClaimAssignmentResponse = {
  ok: boolean;
  assignment: LootAssignment;
};
type CombatEvent = {
  type: string;
  metadata?: Record<string, unknown>;
  message?: string;
};
type CombatStateResponse = {
  lootAssignments?: LootAssignment[];
  eventLog?: CombatEvent[];
};

const SMOKE_API_BASE_URL = process.env.SMOKE_API_BASE_URL || "http://localhost:3000";

function toApiUrl(path: string): string {
  return new URL(path, `${SMOKE_API_BASE_URL}/`).toString();
}

async function parseJsonOrThrow<T>(
  response: Awaited<ReturnType<APIRequestContext["fetch"]>>,
  method: string,
  targetUrl: string,
): Promise<T> {
  const status = response.status();
  const contentType = response.headers()["content-type"] ?? "(missing)";
  if (!contentType.toLowerCase().includes("json")) {
    const preview = (await response.text()).slice(0, 160).replace(/\s+/g, " ").trim();
    throw new Error(
      `Smoke API request hit non-JSON content: ${method} ${targetUrl} returned status ${status} ` +
        `with content-type "${contentType}". Preview: ${preview || "(empty body)"}`,
    );
  }
  return (await response.json()) as T;
}

async function postJson<T>(
  request: APIRequestContext,
  path: string,
  body: unknown,
): Promise<{ status: number; data: T }> {
  const targetUrl = toApiUrl(path);
  const response = await request.post(targetUrl, { data: body });
  const data = await parseJsonOrThrow<T>(response, "POST", targetUrl);
  return { status: response.status(), data };
}

async function putJson<T>(
  request: APIRequestContext,
  path: string,
  body: unknown,
): Promise<{ status: number; data: T }> {
  const targetUrl = toApiUrl(path);
  const response = await request.put(targetUrl, { data: body });
  const data = await parseJsonOrThrow<T>(response, "PUT", targetUrl);
  return { status: response.status(), data };
}

async function getJson<T>(
  request: APIRequestContext,
  path: string,
): Promise<{ status: number; data: T }> {
  const targetUrl = toApiUrl(path);
  const response = await request.get(targetUrl);
  const data = await parseJsonOrThrow<T>(response, "GET", targetUrl);
  return { status: response.status(), data };
}

test.describe("Party Item Transfer Smoke", () => {
  test("party members can join, send assigned loot, and claim it", async ({ request }) => {
    const create = await postJson<CreatePartyResponse>(request, "/api/party/create", {});
    test.skip(create.status >= 500, "API server unavailable in this environment");

    expect(create.status).toBe(200);
    const code = create.data.code;
    const senderId = `member:${code.toLowerCase()}:sender`;
    const recipientId = `member:${code.toLowerCase()}:recipient`;

    try {
      const senderSync = await putJson<{ ok: boolean }>(request, "/api/party/sync", {
        memberId: senderId,
        partyCode: code,
        characterName: "Smoke Sender",
        characterClass: "Rogue 5",
        currentHp: 31,
        maxHp: 31,
        tempHp: 0,
        armorClass: 15,
        conditions: [],
        snapshotUpdatedAt: Date.now(),
      });
      expect(senderSync.status).toBe(200);
      expect(senderSync.data.ok).toBe(true);

      const recipientSync = await putJson<{ ok: boolean }>(request, "/api/party/sync", {
        memberId: recipientId,
        partyCode: code,
        characterName: "Smoke Recipient",
        characterClass: "Cleric 5",
        currentHp: 34,
        maxHp: 34,
        tempHp: 0,
        armorClass: 16,
        conditions: [],
        snapshotUpdatedAt: Date.now() + 1,
      });
      expect(recipientSync.status).toBe(200);
      expect(recipientSync.data.ok).toBe(true);

      const assign = await postJson<LootAssignmentsResponse>(request, `/api/party/${code}/loot-assignments`, {
        targetMemberIds: [recipientId],
        items: [
          {
            name: "Potion of Healing",
            quantity: 2,
            category: "consumable",
            notes: "Smoke transfer",
          },
        ],
        assignedBy: senderId,
      });

      expect(assign.status).toBe(200);
      expect(assign.data.ok).toBe(true);
      expect(assign.data.assignments.length).toBe(1);

      const assignment = assign.data.assignments[0];
      expect(assignment.targetMemberId).toBe(recipientId);
      expect(assignment.assignedBy).toBe(senderId);
      expect(assignment.item.name).toBe("Potion of Healing");
      expect(assignment.item.quantity).toBe(2);

      const afterAssignState = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
      expect(afterAssignState.status).toBe(200);

      const liveAssignment = (afterAssignState.data.lootAssignments ?? []).find((entry) => entry.id === assignment.id);
      expect(liveAssignment).toBeTruthy();
      expect(liveAssignment?.claimedAt).toBeFalsy();

      const assignmentEvent = (afterAssignState.data.eventLog ?? []).find((event) => {
        if (event.type !== "loot_assigned") return false;
        return event.metadata?.assignedBy === senderId;
      });
      expect(assignmentEvent).toBeTruthy();

      const claim = await putJson<ClaimAssignmentResponse>(
        request,
        `/api/party/${code}/loot-assignments/${assignment.id}/claim`,
        { memberId: recipientId },
      );

      expect(claim.status).toBe(200);
      expect(claim.data.ok).toBe(true);
      expect(claim.data.assignment.claimedBy).toBe(recipientId);
      expect(claim.data.assignment.claimedAt).toBeTruthy();

      const afterClaimState = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
      expect(afterClaimState.status).toBe(200);

      const claimedAssignment = (afterClaimState.data.lootAssignments ?? []).find((entry) => entry.id === assignment.id);
      expect(claimedAssignment?.claimedBy).toBe(recipientId);
      expect(claimedAssignment?.claimedAt).toBeTruthy();

      const claimEvent = (afterClaimState.data.eventLog ?? []).find((event) => {
        if (event.type !== "loot_claimed") return false;
        return event.metadata?.assignmentId === assignment.id;
      });
      expect(claimEvent).toBeTruthy();
    } finally {
      await postJson<{ ok: boolean }>(request, `/api/party/${code}/disband`, {});
    }
  });
});
