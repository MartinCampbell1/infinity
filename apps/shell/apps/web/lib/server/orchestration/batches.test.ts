import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { afterEach, describe, expect, test } from "vitest";

import { getExecutionKernelAvailability } from "./batches";

const ORIGINAL_EXECUTION_KERNEL_BASE_URL = process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;

afterEach(() => {
  if (ORIGINAL_EXECUTION_KERNEL_BASE_URL === undefined) {
    delete process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
  } else {
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = ORIGINAL_EXECUTION_KERNEL_BASE_URL;
  }
});

describe("getExecutionKernelAvailability", () => {
  test("reports the execution kernel as available when healthz responds", async () => {
    const kernelServer = createServer(
      (_request: IncomingMessage, response: ServerResponse) => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            status: "ok",
            service: "execution-kernel",
            generatedAt: "2026-04-20T12:00:00.000Z",
          })
        );
      }
    );

    await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
    const address = kernelServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Kernel health test server did not bind to an ephemeral port.");
    }
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

    try {
      const availability = await getExecutionKernelAvailability();

      expect(availability).toEqual({
        available: true,
        baseUrl: `http://127.0.0.1:${address.port}`,
        detail: "execution-kernel is reachable.",
        generatedAt: "2026-04-20T12:00:00.000Z",
        authMode: null,
        storageKind: null,
        statePath: null,
        stateConfigured: null,
        runtimeState: null,
        recoveryState: null,
        restartRecoverable: null,
        failureState: null,
        blockedBatchIds: null,
        failedAttemptIds: null,
        resumableBatchIds: null,
        latestFailure: null,
        recoveryHint: null,
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        kernelServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  test("reports the execution kernel as unavailable when the port is closed", async () => {
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = "http://127.0.0.1:65530";

    const availability = await getExecutionKernelAvailability();

    expect(availability.available).toBe(false);
    expect(availability.baseUrl).toBe("http://127.0.0.1:65530");
    expect(availability.detail).toContain("Kernel is offline");
    expect(availability.detail).toContain("./services/execution-kernel/scripts/run-local.sh");
    expect(availability.generatedAt).toBeNull();
    expect(availability.runtimeState).toBeNull();
    expect(availability.restartRecoverable).toBeNull();
  });

  test("surfaces degraded kernel state from healthz when runtime is reachable", async () => {
    const kernelServer = createServer(
      (_request: IncomingMessage, response: ServerResponse) => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            status: "degraded",
            service: "execution-kernel",
            generatedAt: "2026-04-20T12:00:00.000Z",
            authMode: "localhost_only",
            storageKind: "file",
            statePath: "/tmp/execution-kernel/state.json",
            stateConfigured: true,
            runtimeState: "blocked",
            recoveryState: "retryable",
            restartRecoverable: true,
            failureState: "failed",
            blockedBatchIds: ["batch-health-001"],
            failedAttemptIds: ["attempt-health-001"],
            resumableBatchIds: ["batch-health-001"],
            latestFailure: {
              attemptId: "attempt-health-001",
              batchId: "batch-health-001",
              workUnitId: "work-unit-health-001",
              errorCode: "HEALTH_CHECK",
              errorSummary: "blocked for health snapshot",
              finishedAt: "2026-04-20T12:00:00.000Z",
            },
            recoveryHint:
              "Restart the kernel if needed, then retry blocked batches from the shell: batch-health-001.",
            detail:
              "execution-kernel is reachable with localhost-only auth, file-backed state configured=true, runtime blocked, recovery retryable, restart-recoverable true, 1 blocked batch(es), and 1 failed attempt(s).",
          })
        );
      }
    );

    await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
    const address = kernelServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Kernel health test server did not bind to an ephemeral port.");
    }
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

    try {
      const availability = await getExecutionKernelAvailability();

      expect(availability.available).toBe(true);
      expect(availability.runtimeState).toBe("blocked");
      expect(availability.recoveryState).toBe("retryable");
      expect(availability.restartRecoverable).toBe(true);
      expect(availability.failureState).toBe("failed");
      expect(availability.blockedBatchIds).toEqual(["batch-health-001"]);
      expect(availability.failedAttemptIds).toEqual(["attempt-health-001"]);
      expect(availability.resumableBatchIds).toEqual(["batch-health-001"]);
      expect(availability.latestFailure?.errorCode).toBe("HEALTH_CHECK");
      expect(availability.recoveryHint).toContain("retry blocked batches");
      expect(availability.detail).toContain("runtime blocked");
      expect(availability.detail).toContain("recovery retryable");
      expect(availability.detail).toContain("restart-recoverable true");
    } finally {
      await new Promise<void>((resolve, reject) =>
        kernelServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
