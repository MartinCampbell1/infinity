#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import pg from "pg";

const { Pool } = pg;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const migrationsDir = path.join(webRoot, "db", "migrations", "control-plane");
const manifestPath = path.join(migrationsDir, "manifest.json");
const schemaSnapshotPath = path.join(migrationsDir, "schema-snapshot.json");

function databaseUrl() {
  const value = process.env.FOUNDEROS_MIGRATION_TEST_DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "FOUNDEROS_MIGRATION_TEST_DATABASE_URL is required for migration schema drift checks.",
    );
  }
  return value;
}

async function resetPublicSchema(pool) {
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
}

function runApply(url) {
  const result = spawnSync(
    process.execPath,
    [path.join(scriptDir, "control-plane-migrations.mjs"), "apply"],
    {
      cwd: webRoot,
      env: {
        ...process.env,
        FOUNDEROS_CONTROL_PLANE_DATABASE_URL: url,
      },
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `Migration apply failed before schema drift capture.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }
}

function groupRows(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const groupKey = row[key];
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey).push(row);
  }
  return grouped;
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortObject(nested)]),
  );
}

async function loadManifest() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return {
    latestVersion: manifest.latestVersion,
    migrations: manifest.migrations.map((migration) => ({
      version: migration.version,
      file: migration.file,
      checksum: migration.checksum,
    })),
  };
}

export async function captureControlPlaneSchemaSnapshot(pool) {
  const client = await pool.connect();
  try {
    const manifest = await loadManifest();
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);
    const columns = groupRows(
      (
        await client.query(`
          SELECT table_name, column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name ASC, ordinal_position ASC
        `)
      ).rows,
      "table_name",
    );
    const primaryKeys = groupRows(
      (
        await client.query(`
          SELECT tc.table_name, kcu.column_name, kcu.ordinal_position
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
           AND tc.table_name = kcu.table_name
          WHERE tc.table_schema = 'public'
            AND tc.constraint_type = 'PRIMARY KEY'
          ORDER BY tc.table_name ASC, kcu.ordinal_position ASC
        `)
      ).rows,
      "table_name",
    );
    const rowLevelSecurity = new Map(
      (
        await client.query(`
          SELECT c.relname AS table_name, c.relrowsecurity AS enabled
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind = 'r'
          ORDER BY c.relname ASC
        `)
      ).rows.map((row) => [row.table_name, row.enabled]),
    );
    const policies = groupRows(
      (
        await client.query(`
          SELECT tablename AS table_name, policyname
          FROM pg_policies
          WHERE schemaname = 'public'
          ORDER BY tablename ASC, policyname ASC
        `)
      ).rows,
      "table_name",
    );
    const explicitIndexes = groupRows(
      (
        await client.query(`
          SELECT tablename AS table_name, indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname LIKE 'idx_%'
          ORDER BY tablename ASC, indexname ASC
        `)
      ).rows,
      "table_name",
    );

    const snapshotTables = {};
    for (const table of tables.rows) {
      const tableName = table.table_name;
      snapshotTables[tableName] = {
        columns: (columns.get(tableName) ?? []).map((column) => ({
          name: column.column_name,
          dataType: column.data_type,
          nullable: column.is_nullable === "YES",
        })),
        primaryKey: (primaryKeys.get(tableName) ?? []).map(
          (row) => row.column_name,
        ),
        rowLevelSecurity: rowLevelSecurity.get(tableName) === true,
        policies: (policies.get(tableName) ?? []).map((row) => row.policyname),
        explicitIndexes: (explicitIndexes.get(tableName) ?? []).map(
          (row) => row.indexname,
        ),
      };
    }

    return sortObject({
      snapshotVersion: 1,
      manifest,
      tables: snapshotTables,
    });
  } finally {
    client.release();
  }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function addArrayDiff(diffs, pathLabel, expected, actual) {
  if (!sameJson(expected, actual)) {
    diffs.push({ path: pathLabel, expected, actual });
  }
}

export function compareSchemaSnapshots(expectedSnapshot, actualSnapshot) {
  const expected = sortObject(expectedSnapshot);
  const actual = sortObject(actualSnapshot);
  const diffs = [];

  if (expected.snapshotVersion !== actual.snapshotVersion) {
    diffs.push({
      path: "snapshotVersion",
      expected: expected.snapshotVersion,
      actual: actual.snapshotVersion,
    });
  }

  if (!sameJson(expected.manifest, actual.manifest)) {
    diffs.push({
      path: "manifest",
      expected: expected.manifest,
      actual: actual.manifest,
    });
  }

  const expectedTableNames = Object.keys(expected.tables ?? {}).sort();
  const actualTableNames = Object.keys(actual.tables ?? {}).sort();
  addArrayDiff(diffs, "tables", expectedTableNames, actualTableNames);

  for (const tableName of expectedTableNames) {
    const expectedTable = expected.tables?.[tableName];
    const actualTable = actual.tables?.[tableName];
    if (!actualTable) {
      continue;
    }

    for (const field of [
      "columns",
      "primaryKey",
      "rowLevelSecurity",
      "policies",
      "explicitIndexes",
    ]) {
      if (!sameJson(expectedTable[field], actualTable[field])) {
        diffs.push({
          path: `tables.${tableName}.${field}`,
          expected: expectedTable[field],
          actual: actualTable[field],
        });
      }
    }
  }

  return diffs;
}

function compact(value) {
  return JSON.stringify(value);
}

export function formatSchemaDriftReport(diffs) {
  if (diffs.length === 0) {
    return "Control-plane migration schema drift check passed.";
  }

  const lines = [
    "Control-plane migration schema drift detected.",
    "Refresh db/migrations/control-plane/schema-snapshot.json only after reviewing the migration change.",
  ];
  for (const diff of diffs) {
    lines.push(`- ${diff.path}`);
    lines.push(`  expected: ${compact(diff.expected)}`);
    lines.push(`  actual:   ${compact(diff.actual)}`);
  }
  return lines.join("\n");
}

async function runSchemaDriftCheck({ writeSnapshot = false } = {}) {
  const url = databaseUrl();
  const pool = new Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });

  try {
    await resetPublicSchema(pool);
    runApply(url);
    const actual = await captureControlPlaneSchemaSnapshot(pool);

    if (writeSnapshot) {
      await writeFile(schemaSnapshotPath, `${JSON.stringify(actual, null, 2)}\n`);
      console.log(`Wrote ${path.relative(webRoot, schemaSnapshotPath)}`);
      return;
    }

    const expected = JSON.parse(await readFile(schemaSnapshotPath, "utf8"));
    const diffs = compareSchemaSnapshots(expected, actual);
    const report = formatSchemaDriftReport(diffs);
    if (diffs.length > 0) {
      throw new Error(report);
    }
    console.log(report);
  } finally {
    await resetPublicSchema(pool).catch(() => {});
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSchemaDriftCheck({ writeSnapshot: process.argv.includes("--write-snapshot") }).catch(
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
