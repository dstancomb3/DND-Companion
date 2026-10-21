export const AI_DM_ROUTES = {
  adventure: {
    home: "/adventure",
    newSession: "/adventure/new",
    sessions: "/adventure/sessions",
    sessionByIdPattern: "/adventure/session/[sessionId]",
  },
} as const;

export type AiDmAdventureHomeRoute = (typeof AI_DM_ROUTES)["adventure"]["home"];

export const AI_DM_SESSION_AWARENESS_QUERY_KEYS = {
  active: "aiDmActive",
  sessionId: "aiDmSessionId",
  sessionLabel: "aiDmSessionLabel",
  source: "source",
  mode: "mode",
  title: "title",
  difficulty: "difficulty",
  stylePreset: "stylePreset",
  startInCombat: "startInCombat",
  guidance: "guidance",
  campaignId: "campaignId",
  campaignLabel: "campaignLabel",
  chapterLabel: "chapterLabel",
} as const;

export function buildAiDmSessionPath(sessionId: string): string {
  return `/adventure/session/${sessionId}`;
}

export function buildAiDmSessionRouteParams(params: {
  source: string;
  mode: string;
  title: string;
  difficulty: string;
  stylePreset: string;
  startInCombat: boolean;
  guidanceText?: string;
  campaignId?: string;
  campaignLabel?: string;
  chapterLabel?: string;
}): Record<string, string> {
  return {
    [AI_DM_SESSION_AWARENESS_QUERY_KEYS.source]: params.source,
    [AI_DM_SESSION_AWARENESS_QUERY_KEYS.mode]: params.mode,
    [AI_DM_SESSION_AWARENESS_QUERY_KEYS.title]: params.title,
    [AI_DM_SESSION_AWARENESS_QUERY_KEYS.difficulty]: params.difficulty,
    [AI_DM_SESSION_AWARENESS_QUERY_KEYS.stylePreset]: params.stylePreset,
    [AI_DM_SESSION_AWARENESS_QUERY_KEYS.startInCombat]: params.startInCombat ? "1" : "0",
    [AI_DM_SESSION_AWARENESS_QUERY_KEYS.guidance]: (params.guidanceText ?? "").trim(),
    [AI_DM_SESSION_AWARENESS_QUERY_KEYS.campaignId]: (params.campaignId ?? "").trim(),
    [AI_DM_SESSION_AWARENESS_QUERY_KEYS.campaignLabel]: (params.campaignLabel ?? "").trim(),
    [AI_DM_SESSION_AWARENESS_QUERY_KEYS.chapterLabel]: (params.chapterLabel ?? "").trim(),
  };
}
