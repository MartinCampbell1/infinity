import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
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
const migrationsDir = path.join(webRoot, "db", "migrations", "control-plane");
const manifestPath = path.join(migrationsDir, "manifest.json");

function usage() {
  return [
    "Usage:",
    "  node ./scripts/control-plane-migrations.mjs --dry-run",
    "  node ./scripts/control-plane-migrations.mjs apply",
    "  node ./scripts/control-plane-migrations.mjs status",
    "",
    "Set FOUNDEROS_CONTROL_PLANE_DATABASE_URL or FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL for apply/status.",
  ].join("\n");
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

function checksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

async function loadMigrations() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const manifestByFile = new Map(
    manifest.migrations.map((migration) => [migration.file, migration]),
  );
  const migrations = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) {
      continue;
    }

    const match = /^(\d+)_([a-z0-9_]+)\.sql$/i.exec(entry.name);
    if (!match) {
      throw new Error(
        `Migration file ${entry.name} must use NNN_name.sql naming.`,
      );
    }

    const filePath = path.join(migrationsDir, entry.name);
    const sql = await readFile(filePath, "utf8");
    migrations.push({
      version: Number.parseInt(match[1], 10),
      name: match[2],
      fileName: entry.name,
      filePath,
      sql,
      checksum: checksum(sql),
    });
  }

  const sorted = migrations.sort((left, right) => left.version - right.version);
  for (const migration of sorted) {
    const manifestEntry = manifestByFile.get(migration.fileName);
    if (!manifestEntry) {
      throw new Error(`Migration ${migration.fileName} is missing from manifest.json.`);
    }
    if (
      manifestEntry.version !== migration.version ||
      manifestEntry.name !== migration.name ||
      manifestEntry.checksum !== migration.checksum
    ) {
      throw new Error(
        `Migration ${migration.fileName} does not match manifest.json version/name/checksum.`,
      );
    }
  }
  if (manifest.latestVersion !== sorted.at(-1)?.version) {
    throw new Error("manifest.json latestVersion does not match latest migration.");
  }

  return sorted;
}

async function readAppliedMigrations(client) {
  try {
    const result = await client.query(
      `SELECT version, name, checksum, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY version ASC`,
    );
    return new Map(result.rows.map((row) => [Number(row.version), row]));
  } catch (error) {
    if (error?.code === "42P01") {
      return new Map();
    }
    throw error;
  }
}

async function applyMigrations() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("No control-plane Postgres URL configured.");
  }

  const migrations = await loadMigrations();
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });
  const client = await pool.connect();

  try {
    const applied = await readAppliedMigrations(client);
    for (const migration of migrations) {
      const existing = applied.get(migration.version);
      if (existing) {
        if (existing.checksum !== migration.checksum) {
          throw new Error(
            `Applied migration ${migration.version} checksum ${existing.checksum} does not match ${migration.checksum}.`,
          );
        }
        console.log(`already applied ${migration.fileName}`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          `
            INSERT INTO ${MIGRATIONS_TABLE} (version, name, checksum, applied_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (version) DO NOTHING
          `,
          [migration.version, migration.name, migration.checksum],
        );
        await client.query("COMMIT");
        console.log(`applied ${migration.fileName}`);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function printStatus() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("No control-plane Postgres URL configured.");
  }

  const migrations = await loadMigrations();
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });
  const client = await pool.connect();

  try {
    const applied = await readAppliedMigrations(client);
    for (const migration of migrations) {
      const existing = applied.get(migration.version);
      const state = existing
        ? existing.checksum === migration.checksum
          ? "applied"
          : "checksum-mismatch"
        : "pending";
      console.log(`${migration.fileName}\t${state}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function printDryRun() {
  const migrations = await loadMigrations();
  console.log("control-plane migrations dry-run; no SQL executed");
  for (const migration of migrations) {
    console.log(
      `${migration.fileName}\tversion=${migration.version}\tchecksum=${migration.checksum}`,
    );
  }
}

const command = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");

try {
  if (dryRun || command === "dry-run") {
    await printDryRun();
  } else if (command === "apply") {
    await applyMigrations();
  } else if (command === "status") {
    await printStatus();
  } else {
    console.error(usage());
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
