/**
 * Only a server-issued, committed turn receipt may authorize AI DM
 * narration. Client-side previews and declared NPC intentions are not events.
 * The executor and party sync layer must eventually supply these receipts.
 */
export interface CommittedNpcTurnReceipt {
  schemaVersion: 1;
  status: "committed";
  commandId: string;
  battleId: string;
  npcId: string;
  actionId: string;
  sourceRevision: number;
  committedRevision: number;
  result: {
    kind: "attack" | "spell" | "feat" | "item" | "feature" | "other";
    outcome: "hit" | "miss" | "saved" | "failed_save" | "applied" | "no_effect";
    targetIds: string[];
    damageApplied?: number;
    damageType?: string;
  };
  nextTurnId: string | null;
}

export interface NpcNarrationFacts {
  receiptId: string;
  npcId: string;
  actionId: string;
  outcome: CommittedNpcTurnReceipt["result"]["outcome"];
  targetIds: string[];
  damageApplied?: number;
  damageType?: string;
}

/** Produces facts, not story text. AI DM may embellish description only. */
export function extractCommittedNpcNarrationFacts(value: unknown): NpcNarrationFacts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const receipt = value as Partial<CommittedNpcTurnReceipt>;
  if (receipt.schemaVersion !== 1 || receipt.status !== "committed" ||
      typeof receipt.commandId !== "string" || !receipt.commandId.trim() ||
      typeof receipt.npcId !== "string" || !receipt.npcId.trim() ||
      typeof receipt.battleId !== "string" || !receipt.battleId.trim() ||
      typeof receipt.actionId !== "string" || !receipt.actionId.trim() ||
      !Number.isSafeInteger(receipt.sourceRevision) ||
      !Number.isSafeInteger(receipt.committedRevision) ||
      receipt.committedRevision! <= receipt.sourceRevision! ||
      !receipt.result || !Array.isArray(receipt.result.targetIds) ||
      !receipt.result.targetIds.every(id => typeof id === "string" && id.trim()) ||
      !["hit", "miss", "saved", "failed_save", "applied", "no_effect"].includes(receipt.result.outcome)) {
    return null;
  }
  const result = receipt.result;
  if (result.damageApplied !== undefined &&
    (!Number.isFinite(result.damageApplied) || result.damageApplied < 0)) return null;
  return {
    receiptId: receipt.commandId,
    npcId: receipt.npcId,
    actionId: receipt.actionId,
    outcome: result.outcome,
    targetIds: [...result.targetIds],
    ...(result.damageApplied !== undefined ? { damageApplied: result.damageApplied } : {}),
    ...(result.damageType ? { damageType: result.damageType } : {}),
  };
}
