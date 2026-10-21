export interface AiDmOneOffGuidanceSeedInput {
  title: string;
  difficulty: string;
  stylePreset: string;
  guidanceText?: string;
}

export interface AiDmOneOffGuidanceSeedResult {
  source: "user" | "fallback";
  guidance: string;
}

export interface AiDmCampaignGuidanceSeedInput {
  campaignName: string;
  chapterTitle: string;
  difficulty: string;
  stylePreset: string;
  guidanceText?: string;
}

export function buildAiDmOneOffGuidanceSeed(input: AiDmOneOffGuidanceSeedInput): AiDmOneOffGuidanceSeedResult {
  const userGuidance = (input.guidanceText ?? "").trim();
  if (userGuidance.length > 0) {
    return {
      source: "user",
      guidance: userGuidance,
    };
  }

  const title = input.title.trim() || "One-Off Encounter";
  const difficulty = input.difficulty.trim() || "balanced";
  const stylePreset = input.stylePreset.trim() || "cinematic";

  return {
    source: "fallback",
    guidance:
      `Run a ${stylePreset} one-off encounter titled "${title}" at ${difficulty} difficulty. ` +
      "Open with a clear situation, provide 2-3 immediate player choices, and keep pacing quick.",
  };
}

export function buildAiDmCampaignGuidanceSeed(
  input: AiDmCampaignGuidanceSeedInput,
): AiDmOneOffGuidanceSeedResult {
  const userGuidance = (input.guidanceText ?? "").trim();
  if (userGuidance.length > 0) {
    return {
      source: "user",
      guidance: userGuidance,
    };
  }

  const campaignName = input.campaignName.trim() || "Campaign Scaffold";
  const chapterTitle = input.chapterTitle.trim() || "Chapter 1";
  const difficulty = input.difficulty.trim() || "balanced";
  const stylePreset = input.stylePreset.trim() || "cinematic";

  return {
    source: "fallback",
    guidance:
      `Run the ${stylePreset} campaign scaffold for "${campaignName}", starting with ${chapterTitle} at ${difficulty} pressure. ` +
      "Establish continuity goals, surface two immediate narrative options, and keep outcomes reversible in this scaffold phase.",
  };
}
