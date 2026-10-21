import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { partyRuntimeSnapshots } from "@workspace/db/schema";
import {
  CURRENT_PARTY_RUNTIME_SCHEMA_VERSION,
  type RuntimeSnapshotPayload,
  normalizeRuntimeSnapshotPayload,
} from "./partyRuntimeSchema";

export interface LoadedRuntimeSnapshot {
  partyCode: string;
  schemaVersion: number;
  stateRevision: number;
  snapshot: RuntimeSnapshotPayload;
  updatedAt: string;
}

export interface SaveSnapshotInput {
  partyCode: string;
  snapshot: RuntimeSnapshotPayload;
  expectedRevision: number;
}

export type SaveSnapshotResult =
  | { ok: true; value: LoadedRuntimeSnapshot }
  | { ok: false; conflictRevision: number | null };

function toLoadedSnapshot(row: typeof partyRuntimeSnapshots.$inferSelect): LoadedRuntimeSnapshot {
  const updatedAtIso = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date().toISOString();
  return {
    partyCode: row.partyCode,
    schemaVersion: row.schemaVersion,
    stateRevision: row.stateRevision,
    snapshot: normalizeRuntimeSnapshotPayload(row.partyCode, row.snapshot, updatedAtIso),
    updatedAt: updatedAtIso,
  };
}

export async function loadPartyRuntimeSnapshot(partyCode: string): Promise<LoadedRuntimeSnapshot | null> {
  const rows = await db
    .select()
    .from(partyRuntimeSnapshots)
    .where(eq(partyRuntimeSnapshots.partyCode, partyCode))
    .limit(1);
  if (rows.length === 0) return null;
  return toLoadedSnapshot(rows[0]);
}

export async function savePartyRuntimeSnapshot(input: SaveSnapshotInput): Promise<SaveSnapshotResult> {
  const existing = await loadPartyRuntimeSnapshot(input.partyCode);

  if (!existing) {
    if (input.expectedRevision !== 0) {
      return { ok: false, conflictRevision: null };
    }

    const now = new Date();
    const normalized = normalizeRuntimeSnapshotPayload(input.partyCode, input.snapshot, now.toISOString());
    const insertRows = await db
      .insert(partyRuntimeSnapshots)
      .values({
        partyCode: input.partyCode,
        schemaVersion: CURRENT_PARTY_RUNTIME_SCHEMA_VERSION,
        stateRevision: 1,
        snapshot: normalized,
        updatedAt: now,
      })
      .returning();

    return { ok: true, value: toLoadedSnapshot(insertRows[0]) };
  }

  if (existing.stateRevision !== input.expectedRevision) {
    return { ok: false, conflictRevision: existing.stateRevision };
  }

  const nextRevision = existing.stateRevision + 1;
  const now = new Date();
  const normalized = normalizeRuntimeSnapshotPayload(input.partyCode, input.snapshot, now.toISOString());

  const updatedRows = await db
    .update(partyRuntimeSnapshots)
    .set({
      schemaVersion: CURRENT_PARTY_RUNTIME_SCHEMA_VERSION,
      stateRevision: nextRevision,
      snapshot: normalized,
      updatedAt: now,
    })
    .where(
      and(
        eq(partyRuntimeSnapshots.partyCode, input.partyCode),
        eq(partyRuntimeSnapshots.stateRevision, input.expectedRevision),
      ),
    )
    .returning();

  if (updatedRows.length === 0) {
    const latest = await loadPartyRuntimeSnapshot(input.partyCode);
    return { ok: false, conflictRevision: latest?.stateRevision ?? null };
  }

  return { ok: true, value: toLoadedSnapshot(updatedRows[0]) };
}

export async function deletePartyRuntimeSnapshot(partyCode: string): Promise<void> {
  await db.delete(partyRuntimeSnapshots).where(eq(partyRuntimeSnapshots.partyCode, partyCode));
}
