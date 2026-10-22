import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  MutationBatch,
  MutationBatchSnapshot,
  ProposedHpChange,
  ProposedCurrencyChange,
  ProposedResourceChange,
  ProposedConditionChange,
} from "@/types";
import { useCharacter } from "@/context/CharacterContext";
import { getLocalUndoAvailability, type UndoUnavailable } from "@/utils/mutationUndoSafety";

const MAX_HISTORY = 20;
const KEY_PREFIX = "@lcs_mutation_history_";

interface MutationHistoryContextType {
  history: MutationBatch[];
  /** Append a fully-constructed batch AFTER it has been applied. */
  appendBatch: (batch: MutationBatch) => Promise<void>;
  /** Refuse unverified reversals without modifying character or history. */
  undoLast: () => Promise<UndoUnavailable>;
  /** Return the safety refusal for a specific batch by ID. */
  undoBatch: (id: string) => Promise<UndoUnavailable>;
  clearHistory: () => Promise<void>;
}

const DEFAULT_CTX: MutationHistoryContextType = {
  history: [],
  appendBatch: async () => {},
  undoLast: async () => getLocalUndoAvailability(),
  undoBatch: async () => getLocalUndoAvailability(),
  clearHistory: async () => {},
};

const MutationHistoryContext = createContext<MutationHistoryContextType>(DEFAULT_CTX);

function storageKey(characterId: string | null) {
  return `${KEY_PREFIX}${characterId ?? "default"}`;
}

export function MutationHistoryProvider({ children }: { children: ReactNode }) {
  const { currentCharacterId } = useCharacter();
  const [history, setHistory] = useState<MutationBatch[]>([]);

  // Load history when character changes
  useEffect(() => {
    AsyncStorage.getItem(storageKey(currentCharacterId)).then((raw) => {
      if (!raw) { setHistory([]); return; }
      try {
        const parsed = JSON.parse(raw);
        setHistory(Array.isArray(parsed) ? parsed : []);
      } catch {
        setHistory([]);
      }
    });
  }, [currentCharacterId]);

  const persist = useCallback(async (batches: MutationBatch[]) => {
    setHistory(batches);
    try {
      await AsyncStorage.setItem(storageKey(currentCharacterId), JSON.stringify(batches));
    } catch {}
  }, [currentCharacterId]);

  const appendBatch = useCallback(async (batch: MutationBatch) => {
    setHistory((prev) => {
      const next = [batch, ...prev].slice(0, MAX_HISTORY);
      AsyncStorage.setItem(storageKey(currentCharacterId), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [currentCharacterId]);

  const undoBatch = useCallback(async (id: string): Promise<UndoUnavailable> => {
    return getLocalUndoAvailability(history.find((batch) => batch?.id === id));
  }, [history]);

  const undoLast = useCallback(async (): Promise<UndoUnavailable> => {
    const last = history.find((batch) => batch?.applied && !batch.undone);
    return getLocalUndoAvailability(last);
  }, [history]);

  const clearHistory = useCallback(async () => {
    await persist([]);
  }, [persist]);

  return (
    <MutationHistoryContext.Provider value={{ history, appendBatch, undoLast, undoBatch, clearHistory }}>
      {children}
    </MutationHistoryContext.Provider>
  );
}

export function useMutationHistory(): MutationHistoryContextType {
  return useContext(MutationHistoryContext);
}

// ── Helpers for capturing snapshots and building batches ──────────────────

let _batchCounter = 0;
function generateBatchId(): string {
  _batchCounter += 1;
  return `batch_${Date.now()}_${_batchCounter}`;
}

function generateDeltaId(): string {
  return `delta_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
}

export function buildMutationBatch({
  source,
  description,
  deltas,
  hpChange,
  currencyChange,
  resourceChanges,
  conditionChanges,
  snapshot,
}: {
  source: "manual" | "ai";
  description: string;
  deltas?: MutationBatch["deltas"];
  hpChange?: ProposedHpChange;
  currencyChange?: ProposedCurrencyChange;
  resourceChanges?: ProposedResourceChange[];
  conditionChanges?: ProposedConditionChange[];
  snapshot: MutationBatchSnapshot;
}): MutationBatch {
  const builtDeltas = deltas ? [...deltas] : [];

  if (!deltas && hpChange) {
    const sign = hpChange.delta >= 0 ? "+" : "";
    void sign;
    builtDeltas.push({
      id: generateDeltaId(),
      label: "HP",
      before: String(snapshot.currentHp ?? "?"),
      after: String((snapshot.currentHp ?? 0) + hpChange.delta),
      sourceText: undefined,
      approved: true,
    });
  }

  if (!deltas && currencyChange) {
    const coins = Object.entries(currencyChange).filter(([, v]) => v != null && v !== 0);
    for (const [coin, amt] of coins) {
      const priorVal = (snapshot.currency as Record<string, number> | undefined)?.[coin] ?? 0;
      builtDeltas.push({
        id: generateDeltaId(),
        label: `${coin.toUpperCase()}`,
        before: String(priorVal),
        after: String(priorVal + (amt as number)),
        approved: true,
      });
    }
  }

  if (!deltas) {
    for (const rc of resourceChanges ?? []) {
      const priorState = snapshot.resourceStates?.find((rs) => rs.id === rc.resourceId);
      const prior = priorState?.priorCurrent ?? 0;
      builtDeltas.push({
        id: generateDeltaId(),
        label: rc.resourceName,
        before: String(prior),
        after: String(prior + rc.delta),
        approved: true,
      });
    }
  }

  if (!deltas) {
    for (const cc of conditionChanges ?? []) {
      builtDeltas.push({
        id: generateDeltaId(),
        label: `Condition: ${cc.name}`,
        before: cc.action === "add" ? "—" : cc.name,
        after: cc.action === "add" ? cc.name : "—",
        approved: true,
      });
    }
  }

  return {
    id: generateBatchId(),
    timestamp: Date.now(),
    source,
    description,
    deltas: builtDeltas,
    beforeSnapshot: snapshot,
    applied: true,
    undone: false,
  };
}
