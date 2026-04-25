import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  INCIDENT_ALERTS,
  INCIDENT_RUNBOOK_DOC_PATH,
  INCIDENT_RUNBOOKS,
  buildIncidentRunbookDiagnostics,
} from "./incident-runbooks";

function resolveRepoRoot() {
  let cursor = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(cursor, INCIDENT_RUNBOOK_DOC_PATH))) {
      return cursor;
    }
    cursor = resolve(cursor, "..");
  }
  throw new Error(`Could not locate ${INCIDENT_RUNBOOK_DOC_PATH} from ${process.cwd()}`);
}

describe("incident runbook catalog", () => {
  test("covers P1-OPS-02 incidents and links every alert to a runbook", () => {
    const diagnostics = buildIncidentRunbookDiagnostics();

    expect(diagnostics.ready).toBe(true);
    expect(diagnostics.requiredRunbooks).toEqual([
      "kernel-down",
      "db-down",
      "delivery-stuck",
      "auth-failure",
    ]);
    expect(diagnostics.missingRunbooks).toEqual([]);
    expect(diagnostics.missingAlertLinks).toEqual([]);
    expect(diagnostics.missingAlertCoverage).toEqual([]);
    expect(INCIDENT_ALERTS).toHaveLength(4);

    for (const alert of INCIDENT_ALERTS) {
      expect(alert.runbookPath).toMatch(/^docs\/ops\/incident-runbooks\.md#/);
      expect(INCIDENT_RUNBOOKS.some((runbook) => runbook.id === alert.runbookId)).toBe(true);
    }
  });

  test("published runbook document contains each linked anchor", () => {
    const repoRoot = resolveRepoRoot();
    const contents = readFileSync(resolve(repoRoot, INCIDENT_RUNBOOK_DOC_PATH), "utf8");

    for (const runbook of INCIDENT_RUNBOOKS) {
      expect(contents).toContain(`<a id="${runbook.anchor}"></a>`);
    }
  });
});
