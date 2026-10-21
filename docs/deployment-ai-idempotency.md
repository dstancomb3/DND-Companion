# Deployment: AI Idempotency Table Provisioning

This guide covers provisioning the AI idempotency table across all environments.

## Overview

The AI idempotency system requires a PostgreSQL table `ai_idempotency_records` to persist request hashes and responses. Without this table, AI routes operate in **degraded mode** (responses are not cached and duplicate requests cannot be deduplicated).

**Status**:
- ✅ Table schema defined in `lib/db/src/schema/ai.ts`
- ✅ Graceful fallback implemented in `artifacts/api-server/src/lib/aiIdempotencyStore.ts`
- ✅ Health check available in `artifacts/api-server/src/lib/aiIdempotencyHealthCheck.ts`
- ✅ DB migration tooling configured via drizzle-kit

## Pre-Migration Checklist

Before running migrations in any environment:

- [ ] DATABASE_URL environment variable is set and points to a PostgreSQL database
- [ ] Database user has table creation permissions (usually automatic in managed PostgreSQL)
- [ ] Backup recent database state (if production/staging)
- [ ] Verify no critical AI routes are in-flight during migration
- [ ] Confirm team is aware of brief (< 10s) potential request latency during schema creation

## Migration: All Environments

Run the same command in **every** environment (dev, staging, production):

```bash
pnpm --filter @workspace/db run push
```

This command:
1. Connects to the database specified in DATABASE_URL
2. Compares current schema to target schema (ai_idempotency_records table)
3. Creates the table if it does not exist
4. Is idempotent: safe to run multiple times

**Example**:

```bash
# Development
export DATABASE_URL="postgresql://user:pass@localhost:5432/dev_db"
pnpm --filter @workspace/db run push

# Staging
export DATABASE_URL="postgresql://user:pass@staging.db.host:5432/staging_db"
pnpm --filter @workspace/db run push

# Production
export DATABASE_URL="postgresql://user:pass@prod.db.host:5432/prod_db"
pnpm --filter @workspace/db run push
```

## Post-Migration Verification

After migration, verify the table was created:

### 1. Database Query

```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'ai_idempotency_records';
```

Expected output:
```
         tablename
─────────────────────────────────────
 ai_idempotency_records
```

### 2. Server Health Check

Start the api-server and check logs for health status:

```bash
export DATABASE_URL="postgresql://..."
pnpm --filter @workspace/api-server run dev
```

Expected log output (within first 5 seconds):
```
[ai-idempotency] Health check passed
```

OR (acceptable degraded state):
```
[ai-idempotency] Health check degraded — operating without persistence
```

### 3. Functional Test

Make a test AI request with an idempotency key:

```bash
curl -X POST http://localhost:3000/api/ai/analyze-loot \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-$(date +%s)" \
  -d '{"inventoryText":"sword, shield"}'
```

Expected behavior:
- First request: Processes and returns response
- Second request with same key: Returns cached response from idempotency table
- Second request with different key: Processes normally

## Rollback (If Needed)

If migration fails or causes issues:

```bash
export DATABASE_URL="postgresql://..."
pnpm --filter @workspace/db run push --force
```

**Note**: Force push may require recreating the table. Backup your data first.

For manual rollback:

```sql
DROP TABLE IF EXISTS ai_idempotency_records CASCADE;
```

Then contact the team to re-run the migration.

## Graceful Degradation

If the table does not exist for any reason:

✅ AI routes **continue to work**  
✅ Responses are generated normally  
❌ Responses are NOT cached  
❌ Duplicate requests are NOT deduplicated  

This is safe but performance-degraded. Monitor server logs for warnings:

```
[ai-idempotency] Health check degraded — operating without persistence
```

## Monitoring

### Key Metrics to Track

1. **Table size growth**: Monitor `ai_idempotency_records` row count
   ```sql
   SELECT COUNT(*) FROM ai_idempotency_records;
   ```

2. **Idempotency hit rate**: Monitor server logs for "replay" occurrences
   ```
   grep -i replay /var/log/api-server.log
   ```

3. **Table age**: Rows older than 24 hours are automatically pruned on each request

### Expected Behavior

- Table size stabilizes around 1,000–10,000 rows (depends on request volume)
- Rows are automatically purged after 24 hours (TTL enforcement)
- No manual cleanup required

## Troubleshooting

### ❌ Migration fails with "database does not exist"
- Verify DATABASE_URL is correct
- Create the database: `createdb <dbname>`
- Re-run migration

### ❌ Health check shows "unhealthy"
- Check server logs for full error
- Verify DATABASE_URL and database credentials
- Ensure user has table creation permissions
- Run migration again: `pnpm --filter @workspace/db run push`

### ❌ Table exists but idempotency not working
- Verify api-server is using the correct DATABASE_URL
- Check for application-level errors in logs
- Restart api-server after migration

### ✅ Table exists and health check passes but high latency
- Monitor idempotency record count (may grow too large)
- Manually prune old records:
  ```sql
  DELETE FROM ai_idempotency_records
  WHERE expires_at < NOW();
  ```

## Next Steps

After provisioning the table:

- Monitor for 24 hours to confirm stable operation
- Document any issues in the team channel
- Update environment runbooks to include `pnpm --filter @workspace/db run push` as part of standard deployment
- Plan Phase 26 (live AI turn wiring) — full AI idempotency support enables server-side response caching

## References

- Schema definition: `lib/db/src/schema/ai.ts`
- Graceful fallback: `artifacts/api-server/src/lib/aiIdempotencyStore.ts`
- Health check: `artifacts/api-server/src/lib/aiIdempotencyHealthCheck.ts`
- Migration tool: Drizzle Kit (`lib/db/drizzle.config.ts`)
