export type RollContinuationReceipt = "dispatching" | "completed";

export function rollContinuationReceiptKey(sessionId: string, memberId: string, requestId: string): string {
  return `@ai_dm_roll_continuation_v1:${encodeURIComponent(sessionId)}:${encodeURIComponent(memberId)}:${encodeURIComponent(requestId)}`;
}

/**
 * Claims a roll continuation before an outbound model call. The backing store
 * must be durable for this client; an uncertain dispatch is never auto-retried.
 */
export async function claimRollContinuation(
  key: string,
  store: { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<unknown> },
): Promise<boolean> {
  if (await store.getItem(key) !== null) return false;
  await store.setItem(key, "dispatching");
  return true;
}
