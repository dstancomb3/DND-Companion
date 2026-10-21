/**
 * aiQueue – lightweight AsyncStorage queue for AI API calls that failed
 * because the device was offline.  Each item carries the minimum payload
 * needed to replay the request when connectivity is restored.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "@lcs_ai_queue";
const MAX_RETRIES = 3;

export type AICallType = "parse-update" | "analyze-loot" | "parse-quest-update";

export interface PendingAICall {
  id: string;
  type: AICallType;
  /** Serialised request body that was originally sent (or intended to be sent). */
  payload: string;
  enqueuedAt: number;
  retries: number;
  characterId: string | null;
  /** Human-readable description shown in the sync UI. */
  label: string;
  /** Deterministic dedupe key for retry-safe enqueue/replay. */
  idempotencyKey: string;
}

function generateId(): string {
  return `aiq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function hashText(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function computeAICallIdempotencyKey(input: {
  type: AICallType;
  payload: string;
  characterId: string | null;
}): string {
  const characterPart = input.characterId ?? "global";
  return `${input.type}:${characterPart}:${hashText(input.payload)}`;
}

function normalizeQueueItems(items: unknown): PendingAICall[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry) => {
      const type =
        entry.type === "parse-update" || entry.type === "analyze-loot" || entry.type === "parse-quest-update"
          ? entry.type
          : "parse-update";
      const payload = typeof entry.payload === "string" ? entry.payload : "{}";
      const characterId = typeof entry.characterId === "string" ? entry.characterId : null;
      return {
        id: typeof entry.id === "string" ? entry.id : generateId(),
        type,
        payload,
        enqueuedAt: typeof entry.enqueuedAt === "number" ? entry.enqueuedAt : Date.now(),
        retries: typeof entry.retries === "number" ? entry.retries : 0,
        characterId,
        label: typeof entry.label === "string" ? entry.label : "Queued AI request",
        idempotencyKey:
          typeof entry.idempotencyKey === "string" && entry.idempotencyKey
            ? entry.idempotencyKey
            : computeAICallIdempotencyKey({ type, payload, characterId }),
      };
    });
}

export function dedupePendingAICalls(items: PendingAICall[]): PendingAICall[] {
  const byKey = new Map<string, PendingAICall>();
  for (const item of items) {
    const existing = byKey.get(item.idempotencyKey);
    if (!existing) {
      byKey.set(item.idempotencyKey, item);
      continue;
    }
    // Keep the newest attempt and highest retry count for resilient replay.
    if (item.enqueuedAt > existing.enqueuedAt || item.retries > existing.retries) {
      byKey.set(item.idempotencyKey, item);
    }
  }
  return [...byKey.values()].sort((a, b) => a.enqueuedAt - b.enqueuedAt);
}

async function readQueue(): Promise<PendingAICall[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return dedupePendingAICalls(normalizeQueueItems(parsed));
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingAICall[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Storage failures should never crash the app
  }
}

export async function enqueueAICall(
  item: Omit<PendingAICall, "id" | "enqueuedAt" | "retries" | "idempotencyKey"> & { idempotencyKey?: string }
): Promise<PendingAICall> {
  const idempotencyKey = item.idempotencyKey || computeAICallIdempotencyKey(item);
  const full: PendingAICall = {
    ...item,
    idempotencyKey,
    id: generateId(),
    enqueuedAt: Date.now(),
    retries: 0,
  };
  const queue = await readQueue();
  const existing = queue.find((entry) => entry.idempotencyKey === idempotencyKey);
  if (existing) return existing;

  const next = dedupePendingAICalls([...queue, full]);
  await writeQueue(next);
  return full;
}

export async function dequeueAICall(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((q) => q.id !== id));
}

export async function getAllPendingCalls(): Promise<PendingAICall[]> {
  return readQueue();
}

export async function incrementRetries(id: string): Promise<void> {
  const queue = await readQueue();
  const updated = queue.map((item) =>
    item.id === id ? { ...item, retries: item.retries + 1 } : item
  );
  await writeQueue(updated);
}

export async function pruneFailed(): Promise<void> {
  const queue = await readQueue();
  // Remove items that have exhausted all retries
  await writeQueue(queue.filter((q) => q.retries < MAX_RETRIES));
}

export async function clearAllPending(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export { MAX_RETRIES };
