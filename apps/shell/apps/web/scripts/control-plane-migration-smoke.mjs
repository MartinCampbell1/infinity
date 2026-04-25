import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Pool } = pg;

const MIGRATIONS_TABLE = "shell_control_plane_schema_migrations";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const manifestPath = path.join(
  webRoot,
  "db",
  "migrations",
  "control-plane",
  "manifest.json",
);

function databaseUrl() {
  const value = process.env.FOUNDEROS_MIGRATION_TEST_DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "FOUNDEROS_MIGRATION_TEST_DATABASE_URL is required for live migration smoke tests.",
    );
  }
  return value;
}

async function resetPublicSchema(pool) {
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
}

async function seedOldRuntimeSchema(pool) {
  await pool.query(`
    CREATE TABLE shell_control_plane_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      state_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE account_quota_updates (
      sequence BIGINT PRIMARY KEY,
      account_id TEXT NOT NULL,
      source TEXT NOT NULL,
      observed_at TIMESTAMPTZ NOT NULL,
      summary TEXT NOT NULL,
      snapshot_json JSONB NOT NULL
    )
  `);
}

function runApply() {
  const result = spawnSync(
    process.execPath,
    [path.join(scriptDir, "control-plane-migrations.mjs"), "apply"],
    {
      cwd: webRoot,
      env: {
        ...process.env,
        FOUNDEROS_CONTROL_PLANE_DATABASE_URL: databaseUrl(),
      },
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `Migration apply failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }
}

async function assertLatestMigration(pool) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const latest = manifest.migrations.find(
    (migration) => migration.version === manifest.latestVersion,
  );
  const result = await pool.query(
    `SELECT version, name, checksum FROM ${MIGRATIONS_TABLE} ORDER BY version DESC LIMIT 1`,
  );
  const observed = result.rows[0];

  if (
    Number(observed?.version) !== latest.version ||
    observed?.checksum !== latest.checksum
  ) {
    throw new Error(
      `Latest migration mismatch: observed ${JSON.stringify(observed)}, expected ${JSON.stringify(latest)}.`,
    );
  }
}

async function assertUpgradedColumn(pool) {
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'account_quota_updates'
      AND column_name = 'actor_context'
  `);
  if (result.rows.length !== 1) {
    throw new Error("Upgraded runtime schema is missing account_quota_updates.actor_context.");
  }
}

async function assertTenantRbacSchema(pool) {
  const tenantColumns = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_name IN (
      'execution_sessions',
      'execution_session_events',
      'approval_requests',
      'recovery_incidents',
      'account_quota_snapshots',
      'account_quota_updates',
      'operator_action_audit_events'
    )
      AND column_name IN ('tenant_id', 'created_by', 'updated_by')
  `);
  if (tenantColumns.rows.length !== 21) {
    throw new Error(
      `Tenant/RBAC migration did not add all scoped columns; observed ${tenantColumns.rows.length}.`,
    );
  }

  const rls = await pool.query(`
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relname IN (
      'execution_sessions',
      'execution_session_events',
      'approval_requests',
      'recovery_incidents',
      'account_quota_snapshots',
      'account_quota_updates',
      'operator_action_audit_events'
    )
      AND relrowsecurity = true
  `);
  if (rls.rows.length !== 7) {
    throw new Error(`Tenant/RBAC migration did not enable expected RLS tables.`);
  }

  const primaryKeys = await pool.query(`
    SELECT tc.table_name, array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) AS columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
     AND tc.table_name = kcu.table_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_name IN (
        'execution_sessions',
        'execution_session_events',
        'approval_requests',
        'recovery_incidents',
        'account_quota_snapshots',
        'account_quota_updates',
        'operator_action_audit_events'
      )
    GROUP BY tc.table_name
  `);
  const compositeTables = new Map(
    primaryKeys.rows.map((row) => [row.table_name, row.columns]),
  );
  for (const tableName of [
    "execution_sessions",
    "execution_session_events",
    "approval_requests",
    "recovery_incidents",
    "account_quota_snapshots",
    "operator_action_audit_events",
  ]) {
    const columns = compositeTables.get(tableName);
    if (JSON.stringify(columns) !== JSON.stringify(["tenant_id", "id"])) {
      throw new Error(`${tableName} primary key is not tenant-scoped.`);
    }
  }
  const quotaUpdateColumns = compositeTables.get("account_quota_updates");
  if (
    JSON.stringify(quotaUpdateColumns) !==
    JSON.stringify(["tenant_id", "sequence"])
  ) {
    throw new Error("account_quota_updates primary key is not tenant-scoped.");
  }
}

async function assertMutationJournalSchema(pool) {
  const columns = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_name IN (
      'control_plane_mutation_events',
      'control_plane_idempotency_records'
    )
      AND column_name IN (
        'tenant_id',
        'idempotency_key',
        'request_hash',
        'response_json',
        'status_code'
      )
  `);
  if (columns.rows.length !== 10) {
    throw new Error(
      `Mutation journal migration did not add expected idempotency columns; observed ${columns.rows.length}.`,
    );
  }

  const rls = await pool.query(`
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relname IN (
      'control_plane_mutation_events',
      'control_plane_idempotency_records'
    )
      AND relrowsecurity = true
  `);
  if (rls.rows.length !== 2) {
    throw new Error("Mutation journal migration did not enable expected RLS tables.");
  }

  const primaryKeys = await pool.query(`
    SELECT tc.table_name, array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) AS columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
     AND tc.table_name = kcu.table_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_name IN (
        'control_plane_mutation_events',
        'control_plane_idempotency_records'
      )
    GROUP BY tc.table_name
  `);
  const compositeTables = new Map(
    primaryKeys.rows.map((row) => [row.table_name, row.columns]),
  );
  if (
    JSON.stringify(compositeTables.get("control_plane_mutation_events")) !==
    JSON.stringify(["tenant_id", "id"])
  ) {
    throw new Error("control_plane_mutation_events primary key is not tenant-scoped.");
  }
  if (
    JSON.stringify(compositeTables.get("control_plane_idempotency_records")) !==
    JSON.stringify(["tenant_id", "idempotency_key"])
  ) {
    throw new Error("control_plane_idempotency_records primary key is not tenant-scoped.");
  }
}

async function rollbackSmoke(pool) {
  await pool.query("BEGIN");
  try {
    await pool.query("DROP TABLE IF EXISTS operator_action_audit_events");
    await pool.query("DROP TABLE IF EXISTS account_quota_updates");
    await pool.query("ROLLBACK");
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    throw error;
  }
  await assertLatestMigration(pool);
}

async function runScenario(name, setup) {
  const pool = new Pool({
    connectionString: databaseUrl(),
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });

  try {
    await resetPublicSchema(pool);
    await setup(pool);
    runApply();
    await assertLatestMigration(pool);
    await assertUpgradedColumn(pool);
    await assertTenantRbacSchema(pool);
    await assertMutationJournalSchema(pool);
    await rollbackSmoke(pool);
    console.log(`control-plane migration smoke passed: ${name}`);
  } finally {
    await resetPublicSchema(pool).catch(() => {});
    await pool.end();
  }
}

await runScenario("empty-db", async () => {});
await runScenario("upgraded-runtime-db", seedOldRuntimeSchema);
