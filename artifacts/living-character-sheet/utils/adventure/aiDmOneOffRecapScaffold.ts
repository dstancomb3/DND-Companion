import type { AiDmOneOffOutcomeState } from "@/utils/adventure/aiDmOneOffOutcomeScaffold";
import type { AiDmSessionFeedEntry } from "@/utils/adventure/aiDmSessionFeedScaffold";

export interface AiDmOneOffRecapInput {
  sessionId: string;
  title: string;
  difficulty: string;
  stylePreset: string;
  guidanceSource: "user" | "fallback";
  startInCombat: boolean;
  entries: AiDmSessionFeedEntry[];
  outcomeState: AiDmOneOffOutcomeState;
}

export interface AiDmOneOffSessionHandoffPayload {
  schemaVersion: "oneoff-handoff.v1";
  sessionId: string;
  title: string;
  mode: "one_off";
  difficulty: string;
  stylePreset: string;
  guidanceSource: "user" | "fallback";
  startInCombat: boolean;
  finalOutcomeStatus: AiDmOneOffOutcomeState["status"];
  hasLootPreview: boolean;
  entryCount: number;
  closedAt?: number;
}

export interface AiDmOneOffRecapResult {
  recapLines: string[];
  handoff: AiDmOneOffSessionHandoffPayload;
}

export function canApplyOneOffHandoff(input: {
  outcomeStatus: AiDmOneOffOutcomeState["status"];
  isApproved: boolean;
}): boolean {
  return input.outcomeStatus === "encounter_closed" && input.isApproved;
}

function summarizeRoleCounts(entries: AiDmSessionFeedEntry[]): string {
  const counts = entries.reduce(
    (acc, entry) => {
      acc[entry.role] += 1;
      return acc;
    },
    { system: 0, dm: 0, player: 0, tool: 0 } as Record<AiDmSessionFeedEntry["role"], number>,
  );

  return `Feed roles: system ${counts.system}, dm ${counts.dm}, player ${counts.player}, tool ${counts.tool}.`;
}

export function buildOneOffSessionRecap(input: AiDmOneOffRecapInput): AiDmOneOffRecapResult {
  const recapLines: string[] = [
    `One-off \"${input.title}\" closed at ${input.difficulty} difficulty with ${input.stylePreset} tone.`,
    input.startInCombat
      ? "Entry path was combat-first and remained in bounded MVP authority flow."
      : "Entry path was narrative-first and remained in bounded MVP authority flow.",
    input.guidanceSource === "user"
      ? "Session guidance source: user-authored encounter guidance."
      : "Session guidance source: deterministic fallback seed.",
    summarizeRoleCounts(input.entries),
  ];

  if (input.outcomeState.lootPreview) {
    recapLines.push(`Loot preview tier captured: ${input.outcomeState.lootPreview.rewardTier}.`);
  } else {
    recapLines.push("No loot preview was captured before closure.");
  }

  const handoff: AiDmOneOffSessionHandoffPayload = {
    schemaVersion: "oneoff-handoff.v1",
    sessionId: input.sessionId,
    title: input.title,
    mode: "one_off",
    difficulty: input.difficulty,
    stylePreset: input.stylePreset,
    guidanceSource: input.guidanceSource,
    startInCombat: input.startInCombat,
    finalOutcomeStatus: input.outcomeState.status,
    hasLootPreview: Boolean(input.outcomeState.lootPreview),
    entryCount: input.entries.length,
    closedAt: input.outcomeState.closedAt,
  };

  return {
    recapLines,
    handoff,
  };
}
