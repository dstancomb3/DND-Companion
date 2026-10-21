import type { AiDmDifficultyProfile, AiDmStylePreset } from "@/types";

export interface AiDmOneOffSetupInput {
  title: string;
  guidanceText?: string;
  difficultyProfile: AiDmDifficultyProfile;
  stylePreset: AiDmStylePreset;
  startInCombat: boolean;
}

export interface AiDmOneOffSessionBootstrapResult {
  sessionId: string;
  sessionLabel: string;
  setup: AiDmOneOffSetupInput;
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

  return normalized || "one-off";
}

export function createAiDmOneOffSessionBootstrap(
  input: AiDmOneOffSetupInput,
  now = Date.now(),
): AiDmOneOffSessionBootstrapResult {
  const trimmedTitle = input.title.trim() || "One-Off Encounter";
  const sessionSlug = slugify(trimmedTitle);
  const sessionId = `oneoff-${sessionSlug}-${now.toString(36)}`;

  return {
    sessionId,
    sessionLabel: trimmedTitle,
    setup: {
      title: trimmedTitle,
      guidanceText: (input.guidanceText ?? "").trim(),
      difficultyProfile: input.difficultyProfile,
      stylePreset: input.stylePreset,
      startInCombat: input.startInCombat,
    },
    createdAt: now,
  };
}
