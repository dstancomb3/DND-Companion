import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const partySessions = pgTable("party_sessions", {
  code: text("code").primaryKey(),
  hostTokenHash: text("host_token_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
});

export const partyMembers = pgTable("party_members", {
  id: text("id").primaryKey(),
  partyCode: text("party_code").notNull().references(() => partySessions.code, { onDelete: "cascade" }),
  memberTokenHash: text("member_token_hash"),
  characterName: text("character_name").notNull(),
  characterClass: text("character_class").notNull(),
  currentHp: integer("current_hp").notNull(),
  maxHp: integer("max_hp").notNull(),
  tempHp: integer("temp_hp").notNull().default(0),
  armorClass: integer("armor_class").notNull(),
  conditions: jsonb("conditions").notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const partyRuntimeSnapshots = pgTable("party_runtime_snapshots", {
  partyCode: text("party_code").primaryKey().references(() => partySessions.code, { onDelete: "cascade" }),
  schemaVersion: integer("schema_version").notNull().default(1),
  stateRevision: integer("state_revision").notNull().default(1),
  snapshot: jsonb("snapshot").notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPartyMemberSchema = createInsertSchema(partyMembers).omit({
  updatedAt: true,
  memberTokenHash: true,
});

export type PartySession = typeof partySessions.$inferSelect;
export type PartyMember = typeof partyMembers.$inferSelect;
export type PartyRuntimeSnapshot = typeof partyRuntimeSnapshots.$inferSelect;
export type InsertPartyMember = z.infer<typeof insertPartyMemberSchema>;
