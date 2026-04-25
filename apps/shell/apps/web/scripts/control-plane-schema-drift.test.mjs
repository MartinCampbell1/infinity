import assert from "node:assert/strict";
import test from "node:test";

import {
  compareSchemaSnapshots,
  formatSchemaDriftReport,
} from "./control-plane-schema-drift.mjs";

const baseSnapshot = {
  snapshotVersion: 1,
  manifest: {
    latestVersion: 1,
    migrations: [
      {
        version: 1,
        file: "001_control_plane_state.sql",
        checksum: "abc123",
      },
    ],
  },
  tables: {
    execution_sessions: {
      columns: [
        { name: "tenant_id", dataType: "text", nullable: false },
        { name: "id", dataType: "text", nullable: false },
        { name: "status", dataType: "text", nullable: false },
      ],
      primaryKey: ["tenant_id", "id"],
      rowLevelSecurity: true,
      policies: ["execution_sessions_tenant_isolation"],
      explicitIndexes: ["idx_execution_sessions_tenant_updated"],
    },
  },
};

test("schema drift comparison passes identical snapshots", () => {
  assert.deepEqual(compareSchemaSnapshots(baseSnapshot, baseSnapshot), []);
  assert.match(formatSchemaDriftReport([]), /passed/);
});

test("schema drift comparison reports table and column changes", () => {
  const actual = structuredClone(baseSnapshot);
  actual.tables.execution_sessions.columns = actual.tables.execution_sessions.columns.filter(
    (column) => column.name !== "status",
  );

  const diffs = compareSchemaSnapshots(baseSnapshot, actual);

  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].path, "tables.execution_sessions.columns");
  assert.match(formatSchemaDriftReport(diffs), /schema drift detected/i);
});

test("schema drift comparison reports manifest and security changes", () => {
  const actual = structuredClone(baseSnapshot);
  actual.manifest.migrations[0].checksum = "changed";
  actual.tables.execution_sessions.rowLevelSecurity = false;
  actual.tables.execution_sessions.policies = [];

  const diffs = compareSchemaSnapshots(baseSnapshot, actual);
  const paths = diffs.map((diff) => diff.path);

  assert.deepEqual(paths, [
    "manifest",
    "tables.execution_sessions.rowLevelSecurity",
    "tables.execution_sessions.policies",
  ]);
});
