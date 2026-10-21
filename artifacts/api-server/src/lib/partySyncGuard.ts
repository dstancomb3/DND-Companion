export interface MemberSyncClock {
  snapshotUpdatedAt: number;
  payloadHash: string;
}

export type MemberSyncDecision =
  | { status: "accept" }
  | { status: "idempotent_replay" }
  | {
      status: "reject_stale";
      latestSnapshotUpdatedAt: number;
      reason: "older_snapshot" | "timestamp_collision";
    };

export function decideMemberSync(
  previous: MemberSyncClock | undefined,
  incomingSnapshotUpdatedAt: number,
  incomingPayloadHash: string
): MemberSyncDecision {
  if (!previous) return { status: "accept" };

  if (incomingSnapshotUpdatedAt < previous.snapshotUpdatedAt) {
    return {
      status: "reject_stale",
      latestSnapshotUpdatedAt: previous.snapshotUpdatedAt,
      reason: "older_snapshot",
    };
  }

  if (incomingSnapshotUpdatedAt === previous.snapshotUpdatedAt) {
    if (incomingPayloadHash === previous.payloadHash) {
      return { status: "idempotent_replay" };
    }
    return {
      status: "reject_stale",
      latestSnapshotUpdatedAt: previous.snapshotUpdatedAt,
      reason: "timestamp_collision",
    };
  }

  return { status: "accept" };
}
