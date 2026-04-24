import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "vitest";

import type { AttemptRecord, WorkUnitRecord } from "../control-plane/contracts/orchestration";

import { createExecutorAdapter, syntheticExecutionAllowed } from "./executor-adapters";

const ORIGINAL_ADAPTER = process.env.FOUNDEROS_EXECUTOR_ADAPTER;
const ORIGINAL_LOCAL_COMMAND = process.env.FOUNDEROS_EXECUTOR_LOCAL_COMMAND_JSON;
const ORIGINAL_ALLOW_LOCAL_COMMAND = process.env.FOUNDEROS_ALLOW_LOCAL_EXECUTOR_COMMAND;
const ORIGINAL_ALLOW_SYNTHETIC = process.env.FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION;
const ORIGINAL_DEPLOYMENT_ENV = process.env.FOUNDEROS_DEPLOYMENT_ENV;
const ORIGINAL_INTEGRATION_ROOT = process.env.FOUNDEROS_INTEGRATION_ROOT;

afterEach(() => {
  if (ORIGINAL_ADAPTER === undefined) {
    delete process.env.FOUNDEROS_EXECUTOR_ADAPTER;
  } else {
    process.env.FOUNDEROS_EXECUTOR_ADAPTER = ORIGINAL_ADAPTER;
  }
  if (ORIGINAL_LOCAL_COMMAND === undefined) {
    delete process.env.FOUNDEROS_EXECUTOR_LOCAL_COMMAND_JSON;
  } else {
    process.env.FOUNDEROS_EXECUTOR_LOCAL_COMMAND_JSON = ORIGINAL_LOCAL_COMMAND;
  }
  if (ORIGINAL_ALLOW_LOCAL_COMMAND === undefined) {
    delete process.env.FOUNDEROS_ALLOW_LOCAL_EXECUTOR_COMMAND;
  } else {
    process.env.FOUNDEROS_ALLOW_LOCAL_EXECUTOR_COMMAND = ORIGINAL_ALLOW_LOCAL_COMMAND;
  }
  if (ORIGINAL_ALLOW_SYNTHETIC === undefined) {
    delete process.env.FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION;
  } else {
    process.env.FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION = ORIGINAL_ALLOW_SYNTHETIC;
  }
  if (ORIGINAL_DEPLOYMENT_ENV === undefined) {
    delete process.env.FOUNDEROS_DEPLOYMENT_ENV;
  } else {
    process.env.FOUNDEROS_DEPLOYMENT_ENV = ORIGINAL_DEPLOYMENT_ENV;
  }
  if (ORIGINAL_INTEGRATION_ROOT === undefined) {
    delete process.env.FOUNDEROS_INTEGRATION_ROOT;
  } else {
    process.env.FOUNDEROS_INTEGRATION_ROOT = ORIGINAL_INTEGRATION_ROOT;
  }
});

function workUnit(): WorkUnitRecord {
  const timestamp = "2026-04-24T12:00:00.000Z";
  return {
    id: "work-unit-executor-001",
    taskGraphId: "task-graph-executor-001",
    title: "Executor proof",
    description: "Verify executor adapter proof bundle.",
    executorType: "codex",
    scopePaths: ["/Users/martin/infinity"],
    dependencies: [],
    acceptanceCriteria: ["Executor returns proof"],
    estimatedComplexity: "small",
    status: "running",
    latestAttemptId: "attempt-executor-001",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function attempt(): AttemptRecord {
  return {
    id: "attempt-executor-001",
    workUnitId: "work-unit-executor-001",
    batchId: "batch-executor-001",
    executorType: "codex",
    status: "running",
    startedAt: "2026-04-24T12:00:00.000Z",
    finishedAt: null,
    summary: null,
    artifactUris: [],
    errorCode: null,
    errorSummary: null,
  };
}

describe("executor adapters", () => {
  test("local command adapter returns a proof bundle with logs, exit code, and artifact URI", async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "infinity-executor-"));
    process.env.FOUNDEROS_INTEGRATION_ROOT = tempRoot;
    process.env.FOUNDEROS_EXECUTOR_ADAPTER = "local_command";
    process.env.FOUNDEROS_ALLOW_LOCAL_EXECUTOR_COMMAND = "1";
    process.env.FOUNDEROS_EXECUTOR_LOCAL_COMMAND_JSON = JSON.stringify([
      "node",
      "-e",
      "console.log('executor proof ok')",
    ]);

    try {
      const adapter = createExecutorAdapter();
      expect(adapter?.kind).toBe("local_command");
      const proof = await adapter?.run({
        initiativeId: "initiative-executor-001",
        taskGraphId: "task-graph-executor-001",
        batchId: "batch-executor-001",
        workUnit: workUnit(),
        attempt: attempt(),
      });

      expect(proof).toEqual(
        expect.objectContaining({
          executorKind: "local_command",
          exitCode: 0,
          summary: expect.stringContaining("completed"),
        })
      );
      expect(proof?.logs.find((log) => log.name === "stdout")?.content).toContain(
        "executor proof ok"
      );
      expect(proof?.tests[0]).toEqual(
        expect.objectContaining({
          name: "local-command",
          status: "passed",
        })
      );
      expect(
        proof?.artifactUris.some((uri) => uri.startsWith(`file://${tempRoot}/`))
      ).toBe(true);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("synthetic execution is disabled for production even when the local flag is present", () => {
    process.env.FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION = "1";
    process.env.FOUNDEROS_DEPLOYMENT_ENV = "production";

    expect(syntheticExecutionAllowed()).toBe(false);
    expect(createExecutorAdapter()).toBeNull();
  });
});
