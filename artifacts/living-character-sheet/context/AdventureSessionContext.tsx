import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AiDmSessionAwarenessPlaceholder } from "@/types";
import { buildAiDmSessionPath, buildAiDmSessionRouteParams } from "@/utils/aiDmRouteDefs";

const ACTIVE_ADVENTURE_SESSION_KEY = "@ai_dm_active_adventure_session_v1";

export interface ActiveAdventureSessionRecord {
  sessionId: string;
  sessionLabel: string;
  returnToSessionPath: string;
  updatedAtMs: number;
}

export interface AdventureSessionContextValue {
  isHydrated: boolean;
  activeSession: ActiveAdventureSessionRecord | null;
  awarenessPlaceholder: AiDmSessionAwarenessPlaceholder | null;
  setActiveSession: (input: {
    sessionId: string;
    mode: string;
    title: string;
    difficulty: string;
    stylePreset: string;
    startInCombat: boolean;
    guidanceText?: string;
    campaignId?: string;
    campaignLabel?: string;
    chapterLabel?: string;
  }) => Promise<void>;
  clearActiveSession: () => Promise<void>;
}

export interface AdventureSessionStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface BuildActiveAdventureSessionRecordInput {
  sessionId: string;
  mode: string;
  title: string;
  difficulty: string;
  stylePreset: string;
  startInCombat: boolean;
  guidanceText?: string;
  campaignId?: string;
  campaignLabel?: string;
  chapterLabel?: string;
}

const DEFAULT_CONTEXT: AdventureSessionContextValue = {
  isHydrated: false,
  activeSession: null,
  awarenessPlaceholder: null,
  setActiveSession: async () => {},
  clearActiveSession: async () => {},
};

const AdventureSessionContext = createContext<AdventureSessionContextValue>(DEFAULT_CONTEXT);

function isActiveAdventureSessionRecord(value: unknown): value is ActiveAdventureSessionRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.sessionId === "string" &&
    record.sessionId.trim().length > 0 &&
    typeof record.sessionLabel === "string" &&
    typeof record.returnToSessionPath === "string" &&
    typeof record.updatedAtMs === "number"
  );
}

export function buildAdventureAwarenessReturnPath(input: {
  sessionId: string;
  mode: string;
  title: string;
  difficulty: string;
  stylePreset: string;
  startInCombat: boolean;
  guidanceText?: string;
  campaignId?: string;
  campaignLabel?: string;
  chapterLabel?: string;
}): string {
  const path = buildAiDmSessionPath(input.sessionId);
  const params = buildAiDmSessionRouteParams({
    source: "session-awareness",
    mode: input.mode,
    title: input.title,
    difficulty: input.difficulty,
    stylePreset: input.stylePreset,
    startInCombat: input.startInCombat,
    guidanceText: input.guidanceText,
    campaignId: input.campaignId,
    campaignLabel: input.campaignLabel,
    chapterLabel: input.chapterLabel,
  });
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return query.length > 0 ? `${path}?${query}` : path;
}

export function parseActiveAdventureSessionRecord(raw: string | null): ActiveAdventureSessionRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isActiveAdventureSessionRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function buildActiveAdventureSessionRecord(
  input: BuildActiveAdventureSessionRecordInput,
  nowMs: number,
): ActiveAdventureSessionRecord {
  const sessionLabel = input.campaignLabel?.trim() || input.title.trim() || "Adventure Session";
  return {
    sessionId: input.sessionId,
    sessionLabel,
    returnToSessionPath: buildAdventureAwarenessReturnPath(input),
    updatedAtMs: nowMs,
  };
}

export function buildAdventureAwarenessPlaceholder(
  session: ActiveAdventureSessionRecord | null,
): AiDmSessionAwarenessPlaceholder | null {
  if (!session) return null;
  return {
    isAiDmActive: true,
    sessionId: session.sessionId,
    sessionLabel: session.sessionLabel,
    showContextStrip: true,
    returnToSessionPath: session.returnToSessionPath,
    activeBadgeLabel: "AI DM Active",
  };
}

export function AdventureSessionProvider({
  children,
  storage = AsyncStorage,
}: {
  children: ReactNode;
  storage?: AdventureSessionStorage;
}) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSession, setActiveSessionState] = useState<ActiveAdventureSessionRecord | null>(null);

  const hydrate = useCallback(async () => {
    try {
      const raw = await storage.getItem(ACTIVE_ADVENTURE_SESSION_KEY);
      setActiveSessionState(parseActiveAdventureSessionRecord(raw));
    } catch {
      setActiveSessionState(null);
    } finally {
      setIsHydrated(true);
    }
  }, [storage]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const setActiveSession = useCallback<AdventureSessionContextValue["setActiveSession"]>(async (input) => {
    const next = buildActiveAdventureSessionRecord(input, Date.now());

    setActiveSessionState(next);
    await storage.setItem(ACTIVE_ADVENTURE_SESSION_KEY, JSON.stringify(next));
  }, [storage]);

  const clearActiveSession = useCallback(async () => {
    setActiveSessionState(null);
    await storage.removeItem(ACTIVE_ADVENTURE_SESSION_KEY);
  }, [storage]);

  const awarenessPlaceholder = useMemo(
    () => buildAdventureAwarenessPlaceholder(activeSession),
    [activeSession],
  );

  const value = useMemo<AdventureSessionContextValue>(
    () => ({
      isHydrated,
      activeSession,
      awarenessPlaceholder,
      setActiveSession,
      clearActiveSession,
    }),
    [isHydrated, activeSession, awarenessPlaceholder, setActiveSession, clearActiveSession],
  );

  return <AdventureSessionContext.Provider value={value}>{children}</AdventureSessionContext.Provider>;
}

export function useAdventureSessionAwareness(): AdventureSessionContextValue {
  return useContext(AdventureSessionContext);
}
