import { expect, test, type APIRequestContext } from "@playwright/test";
import { resolveCombatAction } from "../../utils/combat/resolveCombatAction";
import type { CombatActionCommand } from "../../types/combatResolution";

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

test.describe("Party Combat Economy Smoke", () => {
  test("economy spend mutates canonical state once and end-turn reset is canonical", async ({ request }) => {
    const create = await postJson<CreatePartyResponse>(request, "/api/party/create", {});
    test.skip(create.status >= 500, "API server unavailable in this environment");

    expect(create.status).toBe(200);
    const code = create.data.code;
    const memberId = `member:${code.toLowerCase()}:solo`;

    await putJson(request, "/api/party/sync", {
      memberId,
      partyCode: code,
      characterName: "Solo",
      characterClass: "Ranger 3",
      currentHp: 24,
      maxHp: 24,
      tempHp: 0,
      armorClass: 15,
      conditions: [],
    });

    const started = await postJson<StartInitiativeResponse>(request, `/api/party/${code}/initiative/start`, {
      includeEnvironment: false,
      targetMemberIds: [memberId],
    });
    expect(started.status).toBe(200);
    const battleId = started.data.battleId;

    await putJson(request, `/api/party/${code}/initiative/roll`, {
      memberId,
      initiativeRoll: 14,
      initiativeBonus: 3,
    });

    const spendAction = await postJson<{ ok: boolean; economy: { actionsUsed: number } }>(
      request,
      `/api/party/${code}/economy/spend`,
      { memberId, slot: "action" }
    );
    expect(spendAction.status).toBe(200);
    expect(spendAction.data.ok).toBe(true);
    expect(spendAction.data.economy.actionsUsed).toBe(1);

    const spendActionAgain = await postJson<{ ok: boolean; economy: { actionsUsed: number } }>(
      request,
      `/api/party/${code}/economy/spend`,
      { memberId, slot: "action" }
    );
    expect(spendActionAgain.status).toBe(200);
    expect(spendActionAgain.data.economy.actionsUsed).toBe(1);

    const spendActionWithExtraSlot = await postJson<{ ok: boolean; economy: { actionsUsed: number } }>(
      request,
      `/api/party/${code}/economy/spend`,
      { memberId, slot: "action", actionLimit: 2 }
    );
    expect(spendActionWithExtraSlot.status).toBe(200);
    expect(spendActionWithExtraSlot.data.economy.actionsUsed).toBe(2);

    const spendActionWithExtraSlotAgain = await postJson<{ ok: boolean; economy: { actionsUsed: number } }>(
      request,
      `/api/party/${code}/economy/spend`,
      { memberId, slot: "action", actionLimit: 2 }
    );
    expect(spendActionWithExtraSlotAgain.status).toBe(200);
    expect(spendActionWithExtraSlotAgain.data.economy.actionsUsed).toBe(2);

    const spendBonusActionWithExtraSlot = await postJson<{ ok: boolean; economy: { bonusActionsUsed: number } }>(
      request,
      `/api/party/${code}/economy/spend`,
      { memberId, slot: "bonusAction", bonusActionLimit: 2 }
    );
    expect(spendBonusActionWithExtraSlot.status).toBe(200);
    expect(spendBonusActionWithExtraSlot.data.economy.bonusActionsUsed).toBe(1);

    const spendBonusActionWithExtraSlotAgain = await postJson<{ ok: boolean; economy: { bonusActionsUsed: number } }>(
      request,
      `/api/party/${code}/economy/spend`,
      { memberId, slot: "bonusAction", bonusActionLimit: 2 }
    );
    expect(spendBonusActionWithExtraSlotAgain.status).toBe(200);
    expect(spendBonusActionWithExtraSlotAgain.data.economy.bonusActionsUsed).toBe(2);

    const spendBonusActionWithExtraSlotThird = await postJson<{ ok: boolean; economy: { bonusActionsUsed: number } }>(
      request,
      `/api/party/${code}/economy/spend`,
      { memberId, slot: "bonusAction", bonusActionLimit: 2 }
    );
    expect(spendBonusActionWithExtraSlotThird.status).toBe(200);
    expect(spendBonusActionWithExtraSlotThird.data.economy.bonusActionsUsed).toBe(2);

    const spendMovement = await postJson<{ ok: boolean; economy: { movementUsedFeet: number } }>(
      request,
      `/api/party/${code}/economy/spend`,
      { memberId, slot: "movement", amount: 15 }
    );
    expect(spendMovement.status).toBe(200);
    expect(spendMovement.data.economy.movementUsedFeet).toBe(15);

    const stateAfterSpend = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
    expect(stateAfterSpend.status).toBe(200);
    expect(typeof stateAfterSpend.data.stateRevision).toBe("number");
    expect(stateAfterSpend.data.playerEconomyByMember?.[memberId]?.actionsUsed).toBe(2);
    expect(stateAfterSpend.data.playerEconomyByMember?.[memberId]?.bonusActionsUsed).toBe(2);
    expect(stateAfterSpend.data.playerEconomyByMember?.[memberId]?.movementUsedFeet).toBe(15);

    const advance = await postJson<{ ok: boolean }>(request, `/api/party/${code}/end-turn`, {
      memberId,
      battleId,
    });
    expect(advance.status).toBe(200);
    expect(advance.data.ok).toBe(true);

    const stateAfterTurn = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
    expect(stateAfterTurn.status).toBe(200);
    expect((stateAfterTurn.data.stateRevision ?? 0)).toBeGreaterThan(stateAfterSpend.data.stateRevision ?? 0);
    expect(stateAfterTurn.data.playerEconomyByMember?.[memberId]?.actionsUsed).toBe(0);
    expect(stateAfterTurn.data.playerEconomyByMember?.[memberId]?.bonusActionsUsed).toBe(0);
    expect(stateAfterTurn.data.playerEconomyByMember?.[memberId]?.reactionUsed).toBe(false);
    expect(stateAfterTurn.data.playerEconomyByMember?.[memberId]?.movementUsedFeet).toBe(0);
  });

  test("resolver accepted actions sync to canonical party state with bounded action limit and reject overflow", async ({ request }) => {
    const create = await postJson<CreatePartyResponse>(request, "/api/party/create", {});
    test.skip(create.status >= 500, "API server unavailable in this environment");

    expect(create.status).toBe(200);
    const code = create.data.code;
    const memberId = `member:${code.toLowerCase()}:resolver`;

    await putJson(request, "/api/party/sync", {
      memberId,
      partyCode: code,
      characterName: "Resolver",
      characterClass: "Fighter 5",
      currentHp: 42,
      maxHp: 42,
      tempHp: 0,
      armorClass: 17,
      conditions: [],
    });

    const started = await postJson<StartInitiativeResponse>(request, `/api/party/${code}/initiative/start`, {
      includeEnvironment: false,
      targetMemberIds: [memberId],
    });
    expect(started.status).toBe(200);
    const battleId = started.data.battleId;

    await putJson(request, `/api/party/${code}/initiative/roll`, {
      memberId,
      initiativeRoll: 16,
      initiativeBonus: 2,
    });

    const actionLimit = 2;
    let localActionsUsed = 0;
    let localBonusActionsUsed = 0;
    let localReactionUsed = false;
    let localMovementUsedFeet = 0;
    let acceptedServerSpendCalls = 0;

    const buildActionCommand = (suffix: string): CombatActionCommand => ({
      commandId: `resolver-action-${suffix}`,
      issuedAt: Date.now(),
      actor: { memberId, battleId },
      source: {
        sourceType: "attack",
        sourceId: "resolver-attack",
        sourceName: "Resolver Attack",
      },
      action: {
        actionKind: "action",
        mode: "use",
      },
      targets: {
        targetIds: [],
      },
    });

    const buildDeps = () => ({
      active: true,
      isPartyAuthoritative: true,
      actorMemberId: memberId,
      currentTurnId: memberId,
      actionsUsed: localActionsUsed,
      actionsTotal: actionLimit,
      bonusActionsUsed: localBonusActionsUsed,
      bonusActionsTotal: 1,
      reactionUsed: localReactionUsed,
      remainingMovementFeet: Math.max(0, 30 - localMovementUsedFeet),
      useAction: () => {
        localActionsUsed += 1;
      },
      refundAction: () => {
        localActionsUsed = Math.max(0, localActionsUsed - 1);
      },
      useBonusAction: () => {
        localBonusActionsUsed += 1;
      },
      refundBonusAction: () => {
        localBonusActionsUsed = Math.max(0, localBonusActionsUsed - 1);
      },
      toggleReaction: () => {
        localReactionUsed = !localReactionUsed;
      },
      spendMovement: (feet: number) => {
        localMovementUsedFeet += Math.max(0, feet);
      },
      refundMovement: (feet: number) => {
        localMovementUsedFeet = Math.max(0, localMovementUsedFeet - Math.max(0, feet));
      },
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const command = buildActionCommand(String(attempt));
      const result = resolveCombatAction(command, buildDeps());

      if (attempt <= 2) {
        expect(result.status).toBe("accepted");

        const spend = await postJson<{ ok: boolean; economy: { actionsUsed: number } }>(
          request,
          `/api/party/${code}/economy/spend`,
          { memberId, slot: "action", actionLimit }
        );
        acceptedServerSpendCalls += 1;
        expect(spend.status).toBe(200);
        expect(spend.data.ok).toBe(true);
        expect(spend.data.economy.actionsUsed).toBe(attempt);

        // Keep local/client-side counters synchronized to canonical server economy.
        localActionsUsed = spend.data.economy.actionsUsed;

        const stateAfterAcceptedSpend = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
        expect(stateAfterAcceptedSpend.status).toBe(200);
        expect(stateAfterAcceptedSpend.data.playerEconomyByMember?.[memberId]?.actionsUsed).toBe(attempt);
        continue;
      }

      expect(result.status).toBe("rejected");
      expect(result.reasonCode).toBe("no_action_available");

      const stateAfterRejectedAttempt = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
      expect(stateAfterRejectedAttempt.status).toBe(200);
      expect(stateAfterRejectedAttempt.data.playerEconomyByMember?.[memberId]?.actionsUsed).toBe(2);
    }

    expect(acceptedServerSpendCalls).toBe(2);

    const advance = await postJson<{ ok: boolean }>(request, `/api/party/${code}/end-turn`, {
      memberId,
      battleId,
    });
    expect(advance.status).toBe(200);
    expect(advance.data.ok).toBe(true);

    const stateAfterTurn = await getJson<CombatStateResponse>(request, `/api/party/${code}/combat-state`);
    expect(stateAfterTurn.status).toBe(200);
    expect(stateAfterTurn.data.playerEconomyByMember?.[memberId]?.actionsUsed).toBe(0);
  });
});
