import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  clearAllPending,
  dequeueAICall,
  getAllPendingCalls,
  incrementRetries,
  MAX_RETRIES,
  pruneFailed,
  type PendingAICall,
} from "@/utils/aiQueue";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { API_BASE_URL } from "@/utils/apiUrl";

interface SyncContextType {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  failedItems: PendingAICall[];
  /** Attempt to replay all queued (non-failed) calls now. */
  retryAll: () => Promise<void>;
  /** Remove a specific failed item without retrying. */
  dismissFailed: (id: string) => Promise<void>;
  /** Remove all failed items. */
  dismissAllFailed: () => Promise<void>;
  /** Refresh the in-memory queue state from AsyncStorage. */
  refresh: () => Promise<void>;
}

const DEFAULT_CTX: SyncContextType = {
  isOnline: true,
  pendingCount: 0,
  failedCount: 0,
  failedItems: [],
  retryAll: async () => {},
  dismissFailed: async () => {},
  dismissAllFailed: async () => {},
  refresh: async () => {},
};

const SyncContext = createContext<SyncContextType>(DEFAULT_CTX);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { isOnline } = useNetworkStatus();
  const [allItems, setAllItems] = useState<PendingAICall[]>([]);
  const isRetrying = useRef(false);

  const load = useCallback(async () => {
    const items = await getAllPendingCalls();
    setAllItems(items);
  }, []);

  // Load on mount
  useEffect(() => { load(); }, [load]);

  // Auto-retry when we come back online
  const prevOnline = useRef(isOnline);
  useEffect(() => {
    const wasOffline = !prevOnline.current;
    prevOnline.current = isOnline;
    if (isOnline && wasOffline) {
      retryAllInternal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  async function retryAllInternal() {
    if (isRetrying.current) return;
    isRetrying.current = true;
    try {
      const items = await getAllPendingCalls();
      const eligible = items.filter((i) => i.retries < MAX_RETRIES);
      await Promise.allSettled(eligible.map(replayCall));
      await pruneFailed();
    } finally {
      isRetrying.current = false;
      await load();
    }
  }

  async function replayCall(item: PendingAICall): Promise<void> {
    const endpoint = item.type === "parse-update"
      ? `${API_BASE_URL}/api/ai/parse-update`
      : item.type === "analyze-loot"
      ? `${API_BASE_URL}/api/ai/analyze-loot`
      : `${API_BASE_URL}/api/ai/parse-quest-update`;

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Forward the deterministic idempotency key so the server can guard
          // against duplicate application if it later gains per-request dedup.
          "X-Idempotency-Key": item.idempotencyKey,
        },
        body: item.payload,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      // Success — remove from queue
      await dequeueAICall(item.id);
    } catch {
      await incrementRetries(item.id);
    }
  }

  const pendingItems = allItems.filter((i) => i.retries < MAX_RETRIES);
  const failedItems  = allItems.filter((i) => i.retries >= MAX_RETRIES);

  const dismissFailed = useCallback(async (id: string) => {
    await dequeueAICall(id);
    await load();
  }, [load]);

  const dismissAllFailed = useCallback(async () => {
    const items = await getAllPendingCalls();
    const failed = items.filter((i) => i.retries >= MAX_RETRIES);
    await Promise.all(failed.map((i) => dequeueAICall(i.id)));
    await load();
  }, [load]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        pendingCount: pendingItems.length,
        failedCount: failedItems.length,
        failedItems,
        retryAll: retryAllInternal,
        dismissFailed,
        dismissAllFailed,
        refresh: load,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextType {
  return useContext(SyncContext);
}
