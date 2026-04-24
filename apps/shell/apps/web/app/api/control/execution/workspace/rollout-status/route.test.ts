import { existsSync } from "node:fs";

import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../../lib/server/control-plane/state/test-helpers";
import {
  getControlPlaneStatePath,
  resetControlPlaneStateForTests,
} from "../../../../../../lib/server/control-plane/state/store";
import {
  CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
  CANONICAL_WORK_UI_BASE_URL_ENV_KEY,
  STRICT_ROLLOUT_ENV_KEY,
  CONTROL_PLANE_DATABASE_URL_ENV_KEY,
  CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
  CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
  DEPLOYMENT_ENV_KEY,
  EXECUTION_KERNEL_BASE_URL_ENV_KEY,
  EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
  PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY,
  WORKSPACE_LAUNCH_SECRET_ENV_KEY,
  WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
  WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
} from "../../../../../../lib/server/control-plane/workspace/rollout-config";
import { GET } from "./route";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  resetControlPlaneStateForTests();
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

function configureProductionControlPlaneEnv() {
  process.env[DEPLOYMENT_ENV_KEY] = "production";
  process.env[STRICT_ROLLOUT_ENV_KEY] = "1";
  process.env[CONTROL_PLANE_DATABASE_URL_ENV_KEY] =
    "postgres://127.0.0.1:1/infinity_control_plane";
  process.env[CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY] =
    "https://shell.infinity.example";
  process.env[CANONICAL_WORK_UI_BASE_URL_ENV_KEY] =
    "https://work.infinity.example";
  process.env[EXECUTION_KERNEL_BASE_URL_ENV_KEY] =
    "https://kernel.infinity.example";
  process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY] = "kernel-secret";
  process.env[PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY] =
    "https://shell.infinity.example,https://work.infinity.example";
  process.env[WORKSPACE_LAUNCH_SECRET_ENV_KEY] = "launch-secret";
  process.env[WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY] = "grant-secret";
  process.env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY] = "session-secret";
  process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY] = "operator-secret";
  process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY] = "service-secret";
}

describe("/api/control/execution/workspace/rollout-status", () => {
  test("reports ready status when strict rollout env is fully configured", async () => {
    const previous = { ...process.env };
    process.env[STRICT_ROLLOUT_ENV_KEY] = "1";
    process.env[CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY] =
      "https://shell.infinity.local";
    process.env[CANONICAL_WORK_UI_BASE_URL_ENV_KEY] =
      "https://work-ui.infinity.local";
    process.env[WORKSPACE_LAUNCH_SECRET_ENV_KEY] = "launch-secret";
    process.env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY] = "session-secret";

    try {
      const response = await GET();
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.ready).toBe(true);
      expect(payload.strictEnv).toBe(true);
      expect(payload.shellPublicOrigin).toBe("https://shell.infinity.local");
      expect(payload.workUiBaseUrl).toBe("https://work-ui.infinity.local");
      expect(payload.sessionAuthMode).toBe("shell_issued");
      expect(payload.sessionSecretEnvKey).toBe(
        WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY
      );
    } finally {
      process.env = previous;
    }
  });

  test("reports shell-issued session readiness outside strict rollout mode", async () => {
    const previous = { ...process.env };
    delete process.env[STRICT_ROLLOUT_ENV_KEY];
    delete process.env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY];
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    try {
      const response = await GET();
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.strictEnv).toBe(false);
      expect(payload.sessionAuthMode).toBe("shell_issued");
      expect(payload.sessionSecretEnvKey).toBeNull();
      expect(payload.integrationState).toBe("wired");
      expect(payload.storageKind).toBe("file_backed");
      expect(typeof payload.shellPublicOrigin).toBe("string");
      expect(typeof payload.workUiBaseUrl).toBe("string");
    } finally {
      process.env = previous;
    }
  });

  test("reports degraded read-only storage policy with 503 when production Postgres is unavailable", async () => {
    const previous = { ...process.env };
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    configureProductionControlPlaneEnv();

    try {
      resetControlPlaneStateForTests();
      const response = await GET();
      const payload = await response.json();

      expect(response.status).toBe(503);
      expect(payload.ready).toBe(false);
      expect(payload.readOnly).toBe(true);
      expect(payload.degraded).toBe(true);
      expect(payload.storagePolicy).toEqual(
        expect.objectContaining({
          deploymentEnv: "production",
          localFileAllowed: false,
          postgresRequired: true,
          degradedMode: "read_only",
        }),
      );
      expect(payload.notes.join(" ")).toMatch(/refusing local file fallback/i);
      expect(existsSync(getControlPlaneStatePath())).toBe(false);
    } finally {
      process.env = previous;
    }
  });

  test("reports degraded read-only storage policy with 503 when production Postgres URL is missing", async () => {
    const previous = { ...process.env };
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    configureProductionControlPlaneEnv();
    delete process.env[CONTROL_PLANE_DATABASE_URL_ENV_KEY];

    try {
      resetControlPlaneStateForTests();
      const response = await GET();
      const payload = await response.json();

      expect(response.status).toBe(503);
      expect(payload.ready).toBe(false);
      expect(payload.readOnly).toBe(true);
      expect(payload.storagePolicy).toEqual(
        expect.objectContaining({
          deploymentEnv: "production",
          localFileAllowed: false,
          postgresRequired: true,
          degradedMode: "read_only",
        }),
      );
      expect(payload.notes.join(" ")).toMatch(/missing env/i);
      expect(existsSync(getControlPlaneStatePath())).toBe(false);
    } finally {
      process.env = previous;
    }
  });

  test("fails closed as not-ready instead of throwing when strict rollout env is incomplete", async () => {
    const previous = { ...process.env };
    process.env[STRICT_ROLLOUT_ENV_KEY] = "1";
    delete process.env[CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY];
    delete process.env[CANONICAL_WORK_UI_BASE_URL_ENV_KEY];
    delete process.env[WORKSPACE_LAUNCH_SECRET_ENV_KEY];
    delete process.env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY];

    try {
      const response = await GET();
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.ready).toBe(false);
      expect(Array.isArray(payload.notes)).toBe(true);
      expect(payload.notes.join(" ")).toMatch(/strict rollout configuration error/i);
    } finally {
      process.env = previous;
    }
  });
});
