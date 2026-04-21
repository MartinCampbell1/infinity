import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { listExecutionBriefHandoffs } from "./execution-brief-handoffs";

const ORIGINAL_HANDOFF_STORE_PATH =
  process.env.FOUNDEROS_EXECUTION_HANDOFF_STORE_PATH;

afterEach(() => {
  if (ORIGINAL_HANDOFF_STORE_PATH === undefined) {
    delete process.env.FOUNDEROS_EXECUTION_HANDOFF_STORE_PATH;
  } else {
    process.env.FOUNDEROS_EXECUTION_HANDOFF_STORE_PATH =
      ORIGINAL_HANDOFF_STORE_PATH;
  }
});

describe("execution brief handoff store", () => {
  test("does not swallow malformed store reads as an empty queue", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "infinity-handoffs-"));
    const storePath = join(tempDir, "execution-brief-handoffs.json");
    writeFileSync(storePath, "{not-valid-json", "utf8");
    process.env.FOUNDEROS_EXECUTION_HANDOFF_STORE_PATH = storePath;

    expect(() => listExecutionBriefHandoffs()).toThrow();

    rmSync(tempDir, { recursive: true, force: true });
  });
});
