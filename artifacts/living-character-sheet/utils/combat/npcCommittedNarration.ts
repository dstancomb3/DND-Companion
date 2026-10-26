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

/** Response from the host-only atomic weapon turn endpoint. */
export interface HostNpcWeaponTurnReceipt {
  schemaVersion: 1;
  status: "committed";
  commandId: string;
  battleId: string;
  npcId: string;
  weaponId: string;
  targetMemberId: string;
  sourceRevision: number;
  committedRevision: number;
  naturalRoll: number;
  attackTotal: number;
  hit: boolean;
  critical: boolean;
  damageApplied: number;
  damageToHp: number;
  damageType: string;
  nextTurnId: string | null;
}

/** Convert ONLY the exact committed server receipt, never an AI proposal. */
export function committedWeaponTurnToNarrationFacts(
  response: unknown,
): NpcNarrationFacts | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  const envelope = response as Record<string, unknown>;
  if (envelope.ok !== true || !envelope.receipt || typeof envelope.receipt !== "object") return null;
  const raw = envelope.receipt as Partial<HostNpcWeaponTurnReceipt>;
  if (raw.schemaVersion !== 1 || raw.status !== "committed"
    || typeof raw.weaponId !== "string" || !raw.weaponId.trim()
    || typeof raw.targetMemberId !== "string" || !raw.targetMemberId.trim()
    || typeof raw.hit !== "boolean" || typeof raw.critical !== "boolean"
    || !Number.isInteger(raw.naturalRoll) || raw.naturalRoll! < 1 || raw.naturalRoll! > 20
    || !Number.isFinite(raw.attackTotal)
    || !Number.isFinite(raw.damageToHp) || raw.damageToHp! < 0
    || !Number.isFinite(raw.damageApplied) || raw.damageApplied! < raw.damageToHp!
    || typeof raw.damageType !== "string" || !raw.damageType.trim()
    || raw.critical && !raw.hit) return null;
  return extractCommittedNpcNarrationFacts({
    schemaVersion: raw.schemaVersion, status: raw.status,
    commandId: raw.commandId, battleId: raw.battleId, npcId: raw.npcId,
    actionId: raw.weaponId, sourceRevision: raw.sourceRevision,
    committedRevision: raw.committedRevision, nextTurnId: raw.nextTurnId,
    result: {
      kind: "attack", outcome: raw.hit ? "hit" : "miss",
      targetIds: [raw.targetMemberId], damageApplied: raw.damageApplied,
      damageType: raw.damageType,
    },
  });
}
