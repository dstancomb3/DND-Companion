export interface AiDmJournalSceneSummary {
  sceneId: string;
  title?: string;
  summary: string;
  locationRefId?: string;
  createdAt: number;
}

export interface AiDmJournalUnresolvedHook {
  hookId: string;
  label: string;
  sourceSceneId?: string;
  priority?: "low" | "normal" | "high";
  status: "open" | "deferred" | "resolved";
  updatedAt: number;
}

export interface AiDmJournalNpcFact {
  npcId: string;
  fact: string;
  confidence?: "low" | "medium" | "high";
  sourceSceneId?: string;
  updatedAt: number;
}

export interface AiDmJournalDecision {
  decisionId: string;
  sceneId?: string;
  summary: string;
  impactTags?: string[];
  createdAt: number;
}

export interface AiDmJournalRollingRecapEntry {
  entryId: string;
  summary: string;
  sceneId?: string;
  createdAt: number;
}

export interface AiDmJournalSummaryRef {
  summaryId: string;
  summaryType: "scene" | "session" | "arc";
  label: string;
  updatedAt: number;
}

export interface AiDmSessionJournal {
  sceneSummaries: AiDmJournalSceneSummary[];
  unresolvedHooks: AiDmJournalUnresolvedHook[];
  npcFacts: AiDmJournalNpcFact[];
  importantDecisions: AiDmJournalDecision[];
  rollingRecap: AiDmJournalRollingRecapEntry[];
  sessionSummaryRefs: AiDmJournalSummaryRef[];
}
