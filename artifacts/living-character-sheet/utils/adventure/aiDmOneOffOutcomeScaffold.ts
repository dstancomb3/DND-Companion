export type AiDmOneOffOutcomeStatus = "idle" | "loot_ready" | "encounter_closed";

export interface AiDmOneOffLootPreview {
  rewardTier: "lean" | "standard" | "rich";
  rewardLines: string[];
}

export interface AiDmOneOffOutcomeState {
  status: AiDmOneOffOutcomeStatus;
  summary: string;
  lootPreview?: AiDmOneOffLootPreview;
  closedAt?: number;
}

export function createInitialOneOffOutcomeState(): AiDmOneOffOutcomeState {
  return {
    status: "idle",
    summary: "No outcome package yet. Use Loot Hook or End Encounter to finalize this one-off.",
  };
}

export function buildOneOffLootPreview(input: {
  title: string;
  difficulty: string;
  stylePreset: string;
  startInCombat: boolean;
}): AiDmOneOffLootPreview {
  const normalizedDifficulty = input.difficulty.trim().toLowerCase();
  const rewardTier: AiDmOneOffLootPreview["rewardTier"] =
    normalizedDifficulty === "deadly" ? "rich" : normalizedDifficulty === "story" ? "lean" : "standard";

  const rewardLines: string[] = [
    `Encounter cache from \"${input.title.trim() || "One-Off Encounter"}\" (${input.stylePreset.trim() || "cinematic"}).`,
    input.startInCombat
      ? "Combat-first entry bonus: include one tactical consumable."
      : "Narrative-first entry bonus: include one social or clue-forward trinket.",
  ];

  if (rewardTier === "lean") {
    rewardLines.push("Lean reward profile: coin pouch, modest supplies, and one low-power keepsake.");
  } else if (rewardTier === "rich") {
    rewardLines.push("Rich reward profile: stronger coin value, one uncommon-grade item, and one hook clue.");
  } else {
    rewardLines.push("Standard reward profile: balanced coin value, one useful item, and one flavor memento.");
  }

  return {
    rewardTier,
    rewardLines,
  };
}

export function reduceOneOffOutcomeState(
  prev: AiDmOneOffOutcomeState,
  input: {
    toolName: string;
    structuredKind?: string;
    toolStatus: "applied" | "preview_only" | "rejected" | "error" | "needs_follow_up";
    title: string;
    difficulty: string;
    stylePreset: string;
    startInCombat: boolean;
    now?: number;
  },
): AiDmOneOffOutcomeState {
  const isLootHookResult = input.structuredKind === "loot_hook_preview" || input.toolName === "outcome.loot_hook";
  if (isLootHookResult && input.toolStatus !== "rejected" && input.toolStatus !== "error") {
    const lootPreview = buildOneOffLootPreview({
      title: input.title,
      difficulty: input.difficulty,
      stylePreset: input.stylePreset,
      startInCombat: input.startInCombat,
    });

    return {
      status: "loot_ready",
      summary: "Outcome package prepared. Review reward lines before applying to party flows.",
      lootPreview,
    };
  }

  const isEncounterClosedResult = input.structuredKind === "encounter_closed" || input.toolName === "session.end_encounter";
  if (isEncounterClosedResult && input.toolStatus !== "rejected" && input.toolStatus !== "error") {
    const closedAt = input.now ?? Date.now();
    return {
      status: "encounter_closed",
      summary: "Encounter closure marked. Session can hand off to recap/reward follow-up.",
      lootPreview: prev.lootPreview,
      closedAt,
    };
  }

  return prev;
}
