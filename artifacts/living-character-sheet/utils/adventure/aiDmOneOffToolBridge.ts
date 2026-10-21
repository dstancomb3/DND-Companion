import type { AiDmConfirmationPolicyKey } from "@/types/aiDmPolicy";
import type { AiDmToolCall, AiDmToolResult } from "@/types/aiDmContracts";
import { createFeedEntryId } from "@/utils/adventure/aiDmSessionFeedScaffold";

export const AI_DM_ONE_OFF_ALLOWED_TOOLS = [
  "session.append_player_input",
  "session.advance_scene",
  "session.offer_choices",
  "combat.start_oneoff_encounter",
  "combat.resolve_turn",
  "outcome.loot_hook",
  "session.end_encounter",
] as const;

export type AiDmOneOffToolName = (typeof AI_DM_ONE_OFF_ALLOWED_TOOLS)[number];

export function isAiDmOneOffToolAllowed(toolName: string): toolName is AiDmOneOffToolName {
  return (AI_DM_ONE_OFF_ALLOWED_TOOLS as readonly string[]).includes(toolName);
}

export function policyForOneOffTool(toolName: string): AiDmConfirmationPolicyKey {
  if (!isAiDmOneOffToolAllowed(toolName)) return "deny_unsupported";
  if (toolName === "combat.start_oneoff_encounter" || toolName === "session.end_encounter") {
    return "confirm_high_impact";
  }
  if (toolName === "outcome.loot_hook") {
    return "confirm_party_mutation";
  }
  return "safe_auto_apply";
}

export function buildOneOffToolCall(input: {
  toolName: string;
  payload: unknown;
  actorId?: string;
  sessionId?: string;
}): AiDmToolCall {
  const now = Date.now();
  const callId = createFeedEntryId("tool-call");
  return {
    toolName: input.toolName,
    callId,
    input: input.payload,
    idempotencyKey: `${input.toolName}:${input.sessionId ?? "session"}:${now.toString(36)}`,
    confirmationPolicyKey: policyForOneOffTool(input.toolName),
    requestedBy: {
      actorType: "player",
      actorId: input.actorId,
    },
    authorityScope: {
      route: {
        routeKey: "/adventure/session/[sessionId]",
        sessionId: input.sessionId,
        mode: "one_off",
      },
    },
  };
}

export function executeOneOffToolCall(call: AiDmToolCall): AiDmToolResult {
  if (!isAiDmOneOffToolAllowed(call.toolName)) {
    return {
      status: "rejected",
      outcomeSummary: `Rejected unsupported tool: ${call.toolName}`,
      warnings: ["Tool is outside Phase 1 one-off allowlist."],
      requiresFollowUp: false,
      structuredResult: { reason: "unsupported_tool" },
    };
  }

  switch (call.toolName) {
    case "session.append_player_input": {
      const payload = (call.input ?? {}) as { playerText?: string; title?: string; stylePreset?: string; difficulty?: string };
      const playerText = (payload.playerText ?? "").trim();
      const title = payload.title ?? "One-Off Encounter";
      const stylePreset = payload.stylePreset ?? "cinematic";
      const difficulty = payload.difficulty ?? "balanced";
      return {
        status: "applied",
        outcomeSummary: `Acknowledged: \"${playerText}\". Continuing ${title} with a ${stylePreset} tone at ${difficulty} pressure.`,
        requiresFollowUp: false,
        structuredResult: { kind: "player_input_ack" },
      };
    }
    case "session.advance_scene":
      return {
        status: "applied",
        outcomeSummary: "Tool queued: advance scene beat and refresh immediate situation.",
        requiresFollowUp: false,
        structuredResult: { kind: "advance_scene" },
      };
    case "session.offer_choices":
      return {
        status: "applied",
        outcomeSummary: "Tool queued: generate three short player choices with clear tradeoffs.",
        requiresFollowUp: false,
        structuredResult: { kind: "offer_choices" },
      };
    case "combat.start_oneoff_encounter":
      return {
        status: "needs_follow_up",
        outcomeSummary: "Tool queued: prepare one-off combat submode handoff (bounded MVP path).",
        requiresFollowUp: true,
        structuredResult: { kind: "start_oneoff_encounter" },
      };
    case "combat.resolve_turn":
      return {
        status: "applied",
        outcomeSummary: "Tool queued: resolve current beat and summarize immediate consequences.",
        requiresFollowUp: false,
        structuredResult: { kind: "resolve_turn" },
      };
    case "outcome.loot_hook":
      return {
        status: "needs_follow_up",
        outcomeSummary: "Tool queued: produce bounded encounter reward and loot handoff summary.",
        requiresFollowUp: true,
        structuredResult: { kind: "loot_hook_preview" },
      };
    case "session.end_encounter":
      return {
        status: "needs_follow_up",
        outcomeSummary: "Encounter marked for closure in MVP session lifecycle.",
        requiresFollowUp: true,
        structuredResult: { kind: "encounter_closed" },
      };
    default:
      return {
        status: "error",
        outcomeSummary: "Tool bridge could not resolve the requested tool.",
        requiresFollowUp: false,
      };
  }
}
