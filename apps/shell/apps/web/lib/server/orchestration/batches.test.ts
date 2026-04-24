import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { signExecutionKernelServiceToken } from "@founderos/api-clients";
import { afterEach, describe, expect, test } from "vitest";

import {
  EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
  LEGACY_EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
  createServerExecutionKernelClient,
  getExecutionKernelAvailability,
  resolveExecutionKernelBaseUrl,
} from "./batches";

const ORIGINAL_EXECUTION_KERNEL_BASE_URL = process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
const ORIGINAL_MULTICA_KERNEL_BASE_URL = process.env.MULTICA_KERNEL_BASE_URL;
const ORIGINAL_EXECUTION_KERNEL_SERVICE_AUTH_SECRET =
  process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY];
const ORIGINAL_LEGACY_EXECUTION_KERNEL_SERVICE_AUTH_SECRET =
  process.env[LEGACY_EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY];

afterEach(() => {
  if (ORIGINAL_EXECUTION_KERNEL_BASE_URL === undefined) {
    delete process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
  } else {
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = ORIGINAL_EXECUTION_KERNEL_BASE_URL;
  }
  if (ORIGINAL_MULTICA_KERNEL_BASE_URL === undefined) {
    delete process.env.MULTICA_KERNEL_BASE_URL;
  } else {
    process.env.MULTICA_KERNEL_BASE_URL = ORIGINAL_MULTICA_KERNEL_BASE_URL;
  }
  if (ORIGINAL_EXECUTION_KERNEL_SERVICE_AUTH_SECRET === undefined) {
    delete process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY];
  } else {
    process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY] =
      ORIGINAL_EXECUTION_KERNEL_SERVICE_AUTH_SECRET;
  }
  if (ORIGINAL_LEGACY_EXECUTION_KERNEL_SERVICE_AUTH_SECRET === undefined) {
    delete process.env[LEGACY_EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY];
  } else {
    process.env[LEGACY_EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY] =
      ORIGINAL_LEGACY_EXECUTION_KERNEL_SERVICE_AUTH_SECRET;
  }
});

describe("getExecutionKernelAvailability", () => {
  test("signs a Go-compatible service token fixture", async () => {
    await expect(
      signExecutionKernelServiceToken({
        secret: "shell-client-secret",
        scopes: ["kernel.batch.create"],
        now: () => new Date("2026-04-24T12:00:00.000Z"),
        expiresInSeconds: 300,
      })
    ).resolves.toBe(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJmb3VuZGVyb3Mtc2hlbGwiLCJhdWQiOiJleGVjdXRpb24ta2VybmVsIiwic2NwIjpbImtlcm5lbC5iYXRjaC5jcmVhdGUiXSwiaWF0IjoxNzc3MDMyMDAwLCJleHAiOjE3NzcwMzIzMDB9.j2gTlfwLSZ0-zHZnq2CYs0FicLr21KT6A3uB4534gxM"
    );
  });

  test("defaults to the canonical localhost kernel fallback when no env override is present", () => {
    delete process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
    process.env.MULTICA_KERNEL_BASE_URL = "";

    expect(resolveExecutionKernelBaseUrl()).toBe("http://127.0.0.1:8798");
  });

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
        deploymentScope: null,
        maturity: null,
        storageKind: null,
        durabilityTier: null,
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

  test("sends scoped service auth credentials when a kernel secret is configured", async () => {
    let observedAuthorization: string | undefined;
    const kernelServer = createServer(
      (request: IncomingMessage, response: ServerResponse) => {
        observedAuthorization = request.headers.authorization;
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
      throw new Error("Kernel auth test server did not bind to an ephemeral port.");
    }
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;
    process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY] = "kernel-secret";

    try {
      await getExecutionKernelAvailability();

      expect(observedAuthorization).toMatch(/^Bearer [^.]+\.[^.]+\.[^.]+$/);
      const token = observedAuthorization?.replace(/^Bearer /, "") ?? "";
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")
      ) as { aud: string; scp: string[] };
      expect(payload.aud).toBe("execution-kernel");
      expect(payload.scp).toEqual(["kernel.health.read"]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        kernelServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  test("sends mutation-scoped service auth for batch creation", async () => {
    let observedAuthorization: string | undefined;
    const kernelServer = createServer(
      (request: IncomingMessage, response: ServerResponse) => {
        observedAuthorization = request.headers.authorization;
        response.writeHead(201, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            batch: {
              id: "batch-auth-001",
              initiativeId: "initiative-auth-001",
              taskGraphId: "task-graph-auth-001",
              workUnitIds: ["work-unit-auth-001"],
              concurrencyLimit: 1,
              status: "running",
              recoveryState: "retryable",
              startedAt: "2026-04-24T12:00:00.000Z",
              finishedAt: null,
            },
            attempts: [
              {
                id: "attempt-auth-001",
                workUnitId: "work-unit-auth-001",
                batchId: "batch-auth-001",
                executorType: "codex",
                status: "leased",
                recoveryState: "retryable",
                startedAt: "2026-04-24T12:00:00.000Z",
                finishedAt: null,
                summary: null,
                artifactUris: [],
                errorCode: null,
                errorSummary: null,
                leaseHolder: "execution-kernel-scheduler",
                leaseExpiresAt: "2026-04-24T12:00:30.000Z",
                lastHeartbeatAt: "2026-04-24T12:00:00.000Z",
              },
            ],
          })
        );
      }
    );

    await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
    const address = kernelServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Kernel mutation auth test server did not bind to an ephemeral port.");
    }
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;
    process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY] = "kernel-secret";

    try {
      await createServerExecutionKernelClient().launchBatch({
        batchId: "batch-auth-001",
        initiativeId: "initiative-auth-001",
        taskGraphId: "task-graph-auth-001",
        concurrencyLimit: 1,
        workUnits: [
          {
            id: "work-unit-auth-001",
            title: "Auth",
            description: "Verify mutation auth scope",
            executorType: "codex",
            scopePaths: ["/Users/martin/infinity/services/execution-kernel"],
            dependencies: [],
            acceptanceCriteria: ["Scoped token is present"],
          },
        ],
      });

      const token = observedAuthorization?.replace(/^Bearer /, "") ?? "";
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")
      ) as { scp: string[] };
      expect(payload.scp).toEqual(["kernel.batch.create"]);
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
    expect(availability.deploymentScope).toBeNull();
    expect(availability.durabilityTier).toBeNull();
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
            deploymentScope: "localhost_only_solo",
            maturity: "localhost_solo_v1",
            storageKind: "file",
            durabilityTier: "local_file_snapshot",
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
              "execution-kernel is reachable as a localhost-only solo-v1 runtime with local_file_snapshot-backed local state configured=true, runtime blocked, recovery retryable, restart-recoverable true, 1 blocked batch(es), and 1 failed attempt(s), and next action: Restart the kernel if needed, then retry blocked batches from the shell: batch-health-001.",
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
      expect(availability.deploymentScope).toBe("localhost_only_solo");
      expect(availability.maturity).toBe("localhost_solo_v1");
      expect(availability.durabilityTier).toBe("local_file_snapshot");
      expect(availability.blockedBatchIds).toEqual(["batch-health-001"]);
      expect(availability.failedAttemptIds).toEqual(["attempt-health-001"]);
      expect(availability.resumableBatchIds).toEqual(["batch-health-001"]);
      expect(availability.latestFailure?.errorCode).toBe("HEALTH_CHECK");
      expect(availability.recoveryHint).toContain("retry blocked batches");
      expect(availability.detail).toContain("solo-v1 runtime");
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
