import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  evaluateCriticalCoverage,
  formatCriticalCoverageReport,
} from "./critical-coverage-gate.mjs";

function writeFixtureFile(rootDir, relativePath, content) {
  const filePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

test("critical coverage gate passes when required modules have tests", () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), "critical-coverage-pass-"));
  writeFixtureFile(rootDir, "src/auth.ts", "export const ok = true;\n");
  writeFixtureFile(rootDir, "src/auth.test.ts", "import { test } from 'node:test';\ntest('auth', () => {});\n");

  const result = evaluateCriticalCoverage({
    rootDir,
    areas: [
      {
        name: "auth",
        minModuleCoverage: 1,
        modules: [
          {
            name: "auth module",
            sources: ["src/auth.ts"],
            tests: ["src/auth.test.ts"],
          },
        ],
      },
    ],
  });

  assert.equal(result.passed, true);
  assert.match(formatCriticalCoverageReport(result), /Status: PASS/);
});

test("critical coverage gate fails when a critical test is missing", () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), "critical-coverage-fail-"));
  writeFixtureFile(rootDir, "src/delivery.ts", "export const ok = true;\n");

  const result = evaluateCriticalCoverage({
    rootDir,
    areas: [
      {
        name: "delivery",
        minModuleCoverage: 1,
        modules: [
          {
            name: "delivery module",
            sources: ["src/delivery.ts"],
            tests: ["src/delivery.test.ts"],
          },
        ],
      },
    ],
  });

  assert.equal(result.passed, false);
  const report = formatCriticalCoverageReport(result);
  assert.match(report, /missing test: src\/delivery\.test\.ts/);
  assert.match(report, /Status: FAIL/);
});
