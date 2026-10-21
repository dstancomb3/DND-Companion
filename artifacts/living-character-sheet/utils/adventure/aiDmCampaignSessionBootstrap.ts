import type { AiDmDifficultyProfile, AiDmStylePreset } from "@/types";

export interface AiDmCampaignScaffoldInput {
  campaignName: string;
  chapterTitle?: string;
  guidanceText?: string;
  difficultyProfile: AiDmDifficultyProfile;
  stylePreset: AiDmStylePreset;
}

export interface AiDmCampaignSessionBootstrapResult {
  sessionId: string;
  sessionLabel: string;
  setup: {
    campaignName: string;
    chapterTitle: string;
    guidanceText: string;
    difficultyProfile: AiDmDifficultyProfile;
    stylePreset: AiDmStylePreset;
  };
  createdAt: number;
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "campaign";
}

export function createAiDmCampaignSessionBootstrap(
  input: AiDmCampaignScaffoldInput,
  now = Date.now(),
): AiDmCampaignSessionBootstrapResult {
  const campaignName = input.campaignName.trim() || "Campaign Scaffold";
  const chapterTitle = input.chapterTitle?.trim() || "Chapter 1";
  const sessionId = `campaign-${slugify(campaignName)}-${now.toString(36)}`;
  return {
    sessionId,
    sessionLabel: `${campaignName} - ${chapterTitle}`,
    setup: {
      campaignName,
      chapterTitle,
      guidanceText: (input.guidanceText ?? "").trim(),
      difficultyProfile: input.difficultyProfile,
      stylePreset: input.stylePreset,
    },
    createdAt: now,
  };
}