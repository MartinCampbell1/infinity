import { beforeEach, describe, expect, test, vi } from "vitest";

const { readControlPlaneSchemaStatusFromPostgres } = vi.hoisted(() => ({
  readControlPlaneSchemaStatusFromPostgres: vi.fn(),
}));

vi.mock("../../../../../lib/server/control-plane/state/postgres", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../../lib/server/control-plane/state/postgres")
  >("../../../../../lib/server/control-plane/state/postgres");
  return {
    ...actual,
    readControlPlaneSchemaStatusFromPostgres,
  };
});

import {
  CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
  CANONICAL_WORK_UI_BASE_URL_ENV_KEY,
  CONTROL_PLANE_DATABASE_URL_ENV_KEY,
  CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
  CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
  ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY,
  ARTIFACT_SIGNED_URL_BASE_ENV_KEY,
  ARTIFACT_SIGNING_SECRET_ENV_KEY,
  ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY,
  ARTIFACT_STORE_MODE_ENV_KEY,
  DEPLOYMENT_ENV_KEY,
  EXECUTION_KERNEL_BASE_URL_ENV_KEY,
  EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
  EXTERNAL_DELIVERY_MODE_ENV_KEY,
  GITHUB_BASE_BRANCH_ENV_KEY,
  GITHUB_REPOSITORY_ENV_KEY,
  GITHUB_TOKEN_ENV_KEY,
  PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY,
  STRICT_ROLLOUT_ENV_KEY,
  VERCEL_GIT_REPO_ID_ENV_KEY,
  VERCEL_PROJECT_ID_ENV_KEY,
  VERCEL_TOKEN_ENV_KEY,
  WORKSPACE_LAUNCH_SECRET_ENV_KEY,
  WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
  WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
} from "../../../../../lib/server/control-plane/workspace/rollout-config";
import {
  CONTROL_PLANE_SCHEMA_CHECKSUM,
  CONTROL_PLANE_SCHEMA_NAME,
  CONTROL_PLANE_SCHEMA_VERSION,
} from "../../../../../lib/server/control-plane/state/schema";
import { GET } from "./route";

describe("/api/control/deployment/boot-diagnostics", () => {
  beforeEach(() => {
    readControlPlaneSchemaStatusFromPostgres.mockReset();
    readControlPlaneSchemaStatusFromPostgres.mockResolvedValue({
      expectedVersion: CONTROL_PLANE_SCHEMA_VERSION,
      observedVersion: CONTROL_PLANE_SCHEMA_VERSION,
      observedName: CONTROL_PLANE_SCHEMA_NAME,
      observedChecksum: CONTROL_PLANE_SCHEMA_CHECKSUM,
      checksumMatches: true,
      ready: true,
    });
  });

  test("reports production boot readiness without returning secret values", async () => {
    const previous = { ...process.env };
    process.env[DEPLOYMENT_ENV_KEY] = "production";
    process.env[STRICT_ROLLOUT_ENV_KEY] = "1";
    process.env[CONTROL_PLANE_DATABASE_URL_ENV_KEY] =
      "postgres://user:password@db.infinity.example:5432/founderos";
    process.env[CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY] =
      "https://shell.infinity.example";
    process.env[CANONICAL_WORK_UI_BASE_URL_ENV_KEY] =
      "https://work.infinity.example";
    process.env[EXECUTION_KERNEL_BASE_URL_ENV_KEY] =
      "https://kernel.infinity.example";
    process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY] =
      "kernel-secret-value";
    process.env[PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY] =
      "https://shell.infinity.example,https://work.infinity.example";
    process.env[WORKSPACE_LAUNCH_SECRET_ENV_KEY] = "launch-secret-value";
    process.env[WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY] = "grant-secret-value";
    process.env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY] =
      "session-secret-value";
    process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY] = "operator-secret-value";
    process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY] = "service-secret-value";
    process.env[ARTIFACT_STORE_MODE_ENV_KEY] = "r2";
    process.env[ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY] =
      "r2://infinity-artifacts/prod";
    process.env[ARTIFACT_SIGNED_URL_BASE_ENV_KEY] =
      "https://artifacts.infinity.example/download";
    process.env[ARTIFACT_SIGNING_SECRET_ENV_KEY] = "artifact-secret-value";
    process.env[ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY] = "/mnt/infinity-artifacts";
    process.env[EXTERNAL_DELIVERY_MODE_ENV_KEY] = "github_vercel";
    process.env[GITHUB_TOKEN_ENV_KEY] = "github-secret-value";
    process.env[GITHUB_REPOSITORY_ENV_KEY] = "founderos/infinity";
    process.env[GITHUB_BASE_BRANCH_ENV_KEY] = "main";
    process.env[VERCEL_TOKEN_ENV_KEY] = "vercel-secret-value";
    process.env[VERCEL_PROJECT_ID_ENV_KEY] = "prj_founderos_infinity";
    process.env[VERCEL_GIT_REPO_ID_ENV_KEY] = "123456789";

    try {
      const response = await GET();
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.deploymentEnv).toBe("production");
      expect(payload.ready).toBe(true);
      expect(payload.readOnly).toBe(false);
      expect(payload.degraded).toBe(false);
      expect(payload.storagePolicy).toEqual(
        expect.objectContaining({
          deploymentEnv: "production",
          localFileAllowed: false,
          postgresRequired: true,
          degradedMode: "read_only",
        }),
      );
      expect(payload.controlPlaneSchema).toEqual({
        expectedVersion: CONTROL_PLANE_SCHEMA_VERSION,
        migrationsTable: "shell_control_plane_schema_migrations",
        observed: expect.objectContaining({
          checked: true,
          observedVersion: CONTROL_PLANE_SCHEMA_VERSION,
          checksumMatches: true,
          ready: true,
        }),
      });
      expect(payload.secretEnvKeys).toEqual([
        WORKSPACE_LAUNCH_SECRET_ENV_KEY,
        WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
        WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
        CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
        CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
        ARTIFACT_SIGNING_SECRET_ENV_KEY,
        GITHUB_TOKEN_ENV_KEY,
        VERCEL_TOKEN_ENV_KEY,
        EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
      ]);
      expect(JSON.stringify(payload)).not.toContain("secret-value");
      expect(JSON.stringify(payload)).not.toContain("password");
    } finally {
      process.env = previous;
    }
  });

  test("reports missing production envs as not ready instead of exposing defaults", async () => {
    const previous = { ...process.env };
    process.env[DEPLOYMENT_ENV_KEY] = "production";
    delete process.env[STRICT_ROLLOUT_ENV_KEY];
    delete process.env[CONTROL_PLANE_DATABASE_URL_ENV_KEY];
    delete process.env[CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY];
    delete process.env[CANONICAL_WORK_UI_BASE_URL_ENV_KEY];
    delete process.env[EXECUTION_KERNEL_BASE_URL_ENV_KEY];
    delete process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY];
    delete process.env[PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY];
    delete process.env[WORKSPACE_LAUNCH_SECRET_ENV_KEY];
    delete process.env[WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY];
    delete process.env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY];
    delete process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY];
    delete process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY];
    delete process.env[EXTERNAL_DELIVERY_MODE_ENV_KEY];
    delete process.env[GITHUB_TOKEN_ENV_KEY];
    delete process.env[GITHUB_REPOSITORY_ENV_KEY];
    delete process.env[GITHUB_BASE_BRANCH_ENV_KEY];
    delete process.env[VERCEL_TOKEN_ENV_KEY];
    delete process.env[VERCEL_PROJECT_ID_ENV_KEY];
    delete process.env[VERCEL_GIT_REPO_ID_ENV_KEY];

    try {
      const response = await GET();
      const payload = await response.json();

      expect(response.status).toBe(200);
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
      expect(payload.controlPlaneSchema).toEqual({
        expectedVersion: CONTROL_PLANE_SCHEMA_VERSION,
        migrationsTable: "shell_control_plane_schema_migrations",
        observed: expect.objectContaining({
          checked: false,
          ready: false,
        }),
      });
      expect(payload.missingEnvKeys).toEqual(
        expect.arrayContaining([
          STRICT_ROLLOUT_ENV_KEY,
          CONTROL_PLANE_DATABASE_URL_ENV_KEY,
          WORKSPACE_LAUNCH_SECRET_ENV_KEY,
          ARTIFACT_STORE_MODE_ENV_KEY,
          ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY,
          ARTIFACT_SIGNED_URL_BASE_ENV_KEY,
          ARTIFACT_SIGNING_SECRET_ENV_KEY,
          ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY,
          EXTERNAL_DELIVERY_MODE_ENV_KEY,
        ]),
      );
    } finally {
      process.env = previous;
    }
  });

  test("marks production boot not ready when schema is missing or drifted", async () => {
    const previous = { ...process.env };
    process.env[DEPLOYMENT_ENV_KEY] = "production";
    process.env[STRICT_ROLLOUT_ENV_KEY] = "1";
    process.env[CONTROL_PLANE_DATABASE_URL_ENV_KEY] =
      "postgres://user:password@db.infinity.example:5432/founderos";
    process.env[CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY] =
      "https://shell.infinity.example";
    process.env[CANONICAL_WORK_UI_BASE_URL_ENV_KEY] =
      "https://work.infinity.example";
    process.env[EXECUTION_KERNEL_BASE_URL_ENV_KEY] =
      "https://kernel.infinity.example";
    process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY] =
      "kernel-secret-value";
    process.env[PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY] =
      "https://shell.infinity.example,https://work.infinity.example";
    process.env[WORKSPACE_LAUNCH_SECRET_ENV_KEY] = "launch-secret-value";
    process.env[WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY] = "grant-secret-value";
    process.env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY] =
      "session-secret-value";
    process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY] = "operator-secret-value";
    process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY] = "service-secret-value";
    process.env[ARTIFACT_STORE_MODE_ENV_KEY] = "r2";
    process.env[ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY] =
      "r2://infinity-artifacts/prod";
    process.env[ARTIFACT_SIGNED_URL_BASE_ENV_KEY] =
      "https://artifacts.infinity.example/download";
    process.env[ARTIFACT_SIGNING_SECRET_ENV_KEY] = "artifact-secret-value";
    process.env[ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY] = "/mnt/infinity-artifacts";
    process.env[EXTERNAL_DELIVERY_MODE_ENV_KEY] = "github_vercel";
    process.env[GITHUB_TOKEN_ENV_KEY] = "github-secret-value";
    process.env[GITHUB_REPOSITORY_ENV_KEY] = "founderos/infinity";
    process.env[GITHUB_BASE_BRANCH_ENV_KEY] = "main";
    process.env[VERCEL_TOKEN_ENV_KEY] = "vercel-secret-value";
    process.env[VERCEL_PROJECT_ID_ENV_KEY] = "prj_founderos_infinity";
    process.env[VERCEL_GIT_REPO_ID_ENV_KEY] = "123456789";
    readControlPlaneSchemaStatusFromPostgres.mockResolvedValue({
      expectedVersion: CONTROL_PLANE_SCHEMA_VERSION,
      observedVersion: 1,
      observedName: "control_plane_state",
      observedChecksum: "old-checksum",
      checksumMatches: false,
      ready: false,
    });

    try {
      const response = await GET();
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.ready).toBe(false);
      expect(payload.readOnly).toBe(true);
      expect(payload.degraded).toBe(true);
      expect(payload.controlPlaneSchema.observed).toEqual(
        expect.objectContaining({
          checked: true,
          observedVersion: 1,
          observedChecksum: "old-checksum",
          checksumMatches: false,
          ready: false,
        }),
      );
    } finally {
      process.env = previous;
    }
  });
});
