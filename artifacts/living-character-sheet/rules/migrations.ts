/**
 * Migration Registry & Schema Versions
 * 
 * Handles versioning and migration of durable payloads across feature releases.
 * Lazy-applied at load time, persisted on save.
 */

import type { RulesEngineState, CharacterSnapshot } from "@/types";

/**
 * Migration type
 */
export type Migration<From = any, To = any> = (data: From) => To;

/**
 * Migration registry entry
 */
interface MigrationEntry {
  fromVersion: number;
  toVersion: number;
  migrate: Migration;
  name: string;
}

/**
 * Registry for all migrations by entity type
 */
const migrations: Record<string, MigrationEntry[]> = {
  CharacterSnapshot: [],
  RulesEngineState: [],
  RuntimeEntity: [],
  BuildPlan: [],
  SnapshotRecord: [],
  ExportManifest: [],
};

/**
 * Register a migration
 */
export function registerMigration(
  entityType: string,
  fromVersion: number,
  toVersion: number,
  migrate: Migration,
  name?: string
): void {
  migrations[entityType] = migrations[entityType] || [];
  migrations[entityType].push({
    fromVersion,
    toVersion,
    migrate,
    name: name || `${fromVersion}->${toVersion}`,
  });
  // Sort by version for proper ordering
  migrations[entityType].sort((a, b) => a.fromVersion - b.fromVersion);
}

/**
 * Apply migrations to bring data from one version to another
 */
export function applyMigrations<T>(
  entityType: string,
  data: any,
  targetVersion: number
): { migrated: T; appliedMigrations: string[] } {
  let currentData = data;
  const currentVersion = data?._version || data?.schemaVersion || 1;
  const applied: string[] = [];

  if (currentVersion >= targetVersion) {
    return { migrated: currentData, appliedMigrations: applied };
  }

  const entityMigrations = migrations[entityType] || [];
  for (const { fromVersion, toVersion, migrate, name } of entityMigrations) {
    if (currentVersion >= toVersion) continue; // Already past this migration
    if (fromVersion !== currentVersion) continue; // Not the right migration for current version

    try {
      currentData = migrate(currentData);
      currentData._version = toVersion;
      currentData.schemaVersion = toVersion;
      applied.push(name);
    } catch (err) {
      console.error(`[Migration] Failed to apply ${name}:`, err);
      throw err;
    }
  }

  return { migrated: currentData, appliedMigrations: applied };
}

/**
 * No-op migration for testing
 */
export const NOOP_MIGRATION: Migration = (data) => data;

/**
 * Register initial (test) migrations
 */
registerMigration(
  "CharacterSnapshot",
  1,
  2,
  (data: any) => ({
    ...data,
    rulesState: data.rulesState || {
      schemaVersion: 1,
      appliedEffects: [],
      activeProvenances: [],
    },
  }),
  "add-rules-state"
);

/**
 * Test the migration system
 */
export function testMigrations(): { passed: boolean; message: string } {
  try {
    const snapshotV1 = {
      _version: 1,
      character: { id: "test" },
    } as any;

    const { migrated, appliedMigrations } = applyMigrations<any>("CharacterSnapshot", snapshotV1, 2);

    if (migrated._version !== 2) {
      return { passed: false, message: "Version not updated to 2" };
    }

    if (!migrated.rulesState) {
      return { passed: false, message: "rulesState field not added" };
    }

    if (appliedMigrations.length === 0) {
      return { passed: false, message: "No migrations were recorded as applied" };
    }

    return { passed: true, message: `Migrations passed: ${appliedMigrations.join(", ")}` };
  } catch (err) {
    return { passed: false, message: `Error: ${String(err)}` };
  }
}
