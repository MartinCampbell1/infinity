import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Pool } = pg;

const MIGRATIONS_TABLE = "shell_control_plane_schema_migrations";
const DB_ENV_KEYS = [
  "FOUNDEROS_CONTROL_PLANE_DATABASE_URL",
  "FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL",
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const manifestPath = path.join(
  webRoot,
  "db",
  "migrations",
  "control-plane",
  "manifest.json",
);

function deploymentRequiresPreflight() {
  const deploymentEnv = process.env.FOUNDEROS_DEPLOYMENT_ENV?.trim();
  return deploymentEnv === "production" || deploymentEnv === "staging";
}

function resolveDatabaseUrl() {
  for (const key of DB_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

async function readExpectedMigration() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const latest = manifest.migrations.find(
    (migration) => migration.version === manifest.latestVersion,
  );
  if (!latest) {
    throw new Error("Control-plane migration manifest has no latest migration.");
  }
  return latest;
}

async function main() {
  if (!deploymentRequiresPreflight()) {
    console.log("control-plane schema preflight skipped outside production/staging");
    return;
  }

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("Production/staging control-plane schema preflight requires Postgres URL.");
  }

  const expected = await readExpectedMigration();
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });

  try {
    const result = await pool.query(
      `
        SELECT version, name, checksum
        FROM ${MIGRATIONS_TABLE}
        ORDER BY version DESC
        LIMIT 1
      `,
    );
    const observed = result.rows[0];
    if (
      Number(observed?.version) !== expected.version ||
      observed?.checksum !== expected.checksum
    ) {
      throw new Error(
        `Control-plane schema preflight failed: observed version=${observed?.version ?? "missing"} checksum=${observed?.checksum ?? "missing"}, expected version=${expected.version} checksum=${expected.checksum}.`,
      );
    }
    console.log(
      `control-plane schema preflight passed version=${expected.version} checksum=${expected.checksum}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
