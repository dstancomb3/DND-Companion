import { pgTable, text, timestamp, jsonb, integer, bigint } from "drizzle-orm/pg-core";

export const campaignContinuationSnapshots = pgTable("campaign_continuation_snapshots", {
  sessionId: text("session_id").primaryKey(),
  schemaVersion: text("schema_version").notNull().default("campaign-continuation.v1"),
  campaignId: text("campaign_id").notNull(),
  campaignLabel: text("campaign_label").notNull(),
  chapterLabel: text("chapter_label").notNull(),
  checkpointIndex: integer("checkpoint_index").notNull(),
  continuityStatus: text("continuity_status").notNull(),
  progressSummary: text("progress_summary").notNull(),
  clientSavedAt: bigint("client_saved_at", { mode: "number" }).notNull(),
  recapLines: jsonb("recap_lines").notNull().default([]),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  ingestTraceId: text("ingest_trace_id").notNull(),
  submissionId: text("submission_id").notNull(),
  snapshot: jsonb("snapshot").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CampaignContinuationSnapshot = typeof campaignContinuationSnapshots.$inferSelect;
