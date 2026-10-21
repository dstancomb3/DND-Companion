import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const aiIdempotencyRecords = pgTable("ai_idempotency_records", {
  key: text("key").primaryKey(),
  endpoint: text("endpoint").notNull(),
  requestHash: text("request_hash").notNull(),
  status: text("status").notNull().default("processing"),
  statusCode: integer("status_code"),
  responseBody: jsonb("response_body"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type AIIdempotencyRecord = typeof aiIdempotencyRecords.$inferSelect;
