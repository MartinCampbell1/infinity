import { describe, expect, test } from "vitest";

import {
  CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
  CANONICAL_WORK_UI_BASE_URL_ENV_KEY,
  CONTROL_PLANE_DATABASE_URL_ENV_KEY,
  CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
  CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
  DEPLOYMENT_ENV_KEY,
  EXECUTION_KERNEL_BASE_URL_ENV_KEY,
  EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
  LEGACY_CONTROL_PLANE_SECRET_ENV_KEY,
  PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY,
  STRICT_ROLLOUT_ENV_KEY,
  WORKSPACE_LAUNCH_SECRET_ENV_KEY,
  WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
  WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
  assertDeploymentEnvReady,
  buildDeploymentEnvDiagnostics,
  isStrictRolloutEnv,
  requiresFullDeploymentEnv,
  resolveFounderOsDeploymentEnv,
  resolveShellPublicOriginForLaunch,
  resolveWorkUiBaseUrlForLaunch,
  resolveWorkspaceLaunchSecret,
  resolveWorkspaceSessionGrantSecret,
  resolveWorkspaceSessionTokenSecret,
  resolveWorkspaceSessionTokenSecretEnvKey,
} from "./rollout-config";

describe("workspace rollout config", () => {
  test("keeps localhost defaults outside strict rollout mode", () => {
    expect(resolveWorkUiBaseUrlForLaunch({})).toBe("http://127.0.0.1:3101");
    expect(resolveShellPublicOriginForLaunch({})).toBe("http://127.0.0.1:3737");
    expect(resolveWorkspaceLaunchSecret({})).toBeNull();
    expect(resolveWorkspaceSessionGrantSecret({})).toBeNull();
    expect(resolveWorkspaceSessionTokenSecret({})).toBeNull();
    expect(isStrictRolloutEnv({})).toBe(false);
    expect(resolveFounderOsDeploymentEnv({})).toBe("local");
    expect(requiresFullDeploymentEnv({})).toBe(false);
  });

  test("detects explicit strict rollout mode", () => {
    expect(isStrictRolloutEnv({ [STRICT_ROLLOUT_ENV_KEY]: "1" })).toBe(true);
    expect(isStrictRolloutEnv({ [STRICT_ROLLOUT_ENV_KEY]: "0" })).toBe(false);
  });

  test("requires canonical work-ui base url in strict rollout mode", () => {
    expect(() =>
      resolveWorkUiBaseUrlForLaunch({ [STRICT_ROLLOUT_ENV_KEY]: "1" }),
    ).toThrowError(new RegExp(CANONICAL_WORK_UI_BASE_URL_ENV_KEY));

    expect(
      resolveWorkUiBaseUrlForLaunch({
        [STRICT_ROLLOUT_ENV_KEY]: "1",
        [CANONICAL_WORK_UI_BASE_URL_ENV_KEY]: "https://work-ui.infinity.local",
      }),
    ).toBe("https://work-ui.infinity.local");
  });

  test("requires canonical shell public origin in strict rollout mode", () => {
    expect(() =>
      resolveShellPublicOriginForLaunch({ [STRICT_ROLLOUT_ENV_KEY]: "1" }),
    ).toThrowError(new RegExp(CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY));

    expect(
      resolveShellPublicOriginForLaunch({
        [STRICT_ROLLOUT_ENV_KEY]: "1",
        [CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY]: "https://shell.infinity.local",
      }),
    ).toBe("https://shell.infinity.local");
  });

  test("requires launch secret in strict rollout mode but still accepts compatibility alias", () => {
    expect(() =>
      resolveWorkspaceLaunchSecret({ [STRICT_ROLLOUT_ENV_KEY]: "1" }),
    ).toThrowError(new RegExp(WORKSPACE_LAUNCH_SECRET_ENV_KEY));

    expect(
      resolveWorkspaceLaunchSecret({
        [STRICT_ROLLOUT_ENV_KEY]: "1",
        [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "canonical-secret",
      }),
    ).toBe("canonical-secret");

    expect(
      resolveWorkspaceLaunchSecret({
        [STRICT_ROLLOUT_ENV_KEY]: "1",
        [LEGACY_CONTROL_PLANE_SECRET_ENV_KEY]: "legacy-secret",
      }),
    ).toBe("legacy-secret");
  });

  test("resolves the session grant secret from its canonical env and falls back to launch secret", () => {
    expect(
      resolveWorkspaceSessionGrantSecret({
        [WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY]: "grant-secret",
      }),
    ).toBe("grant-secret");

    expect(
      resolveWorkspaceSessionGrantSecret({
        [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "launch-secret",
      }),
    ).toBe("launch-secret");
  });

  test("resolves the embedded session token secret from its canonical env and falls back to launch secret", () => {
    expect(
      resolveWorkspaceSessionTokenSecret({
        [WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY]: "session-secret",
      }),
    ).toBe("session-secret");

    expect(
      resolveWorkspaceSessionTokenSecret({
        [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "launch-secret",
      }),
    ).toBe("launch-secret");
  });

  test("reports which env key provided the embedded session token secret", () => {
    expect(
      resolveWorkspaceSessionTokenSecretEnvKey({
        [WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY]: "session-secret",
      }),
    ).toBe(WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY);

    expect(
      resolveWorkspaceSessionTokenSecretEnvKey({
        [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "launch-secret",
      }),
    ).toBe(WORKSPACE_LAUNCH_SECRET_ENV_KEY);

    expect(
      resolveWorkspaceSessionTokenSecretEnvKey({
        [LEGACY_CONTROL_PLANE_SECRET_ENV_KEY]: "legacy-secret",
      }),
    ).toBe(LEGACY_CONTROL_PLANE_SECRET_ENV_KEY);
  });

  test("requires the full explicit env set in production deployment mode", () => {
    const diagnostics = buildDeploymentEnvDiagnostics({
      [DEPLOYMENT_ENV_KEY]: "production",
    });

    expect(diagnostics.ready).toBe(false);
    expect(diagnostics.missingEnvKeys).toEqual(
      expect.arrayContaining([
        STRICT_ROLLOUT_ENV_KEY,
        CONTROL_PLANE_DATABASE_URL_ENV_KEY,
        CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
        CANONICAL_WORK_UI_BASE_URL_ENV_KEY,
        EXECUTION_KERNEL_BASE_URL_ENV_KEY,
        EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
        PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY,
        WORKSPACE_LAUNCH_SECRET_ENV_KEY,
        WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
        WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
        CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
        CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
      ]),
    );
    expect(() =>
      assertDeploymentEnvReady({ [DEPLOYMENT_ENV_KEY]: "production" }),
    ).toThrowError(/not boot-ready/);
  });

  test("accepts a fully configured production deployment without exposing secret values", () => {
    const diagnostics = buildDeploymentEnvDiagnostics({
      [DEPLOYMENT_ENV_KEY]: "production",
      [STRICT_ROLLOUT_ENV_KEY]: "1",
      [CONTROL_PLANE_DATABASE_URL_ENV_KEY]:
        "postgres://user:password@db.infinity.example:5432/founderos",
      [CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY]: "https://shell.infinity.example",
      [CANONICAL_WORK_UI_BASE_URL_ENV_KEY]: "https://work.infinity.example",
      [EXECUTION_KERNEL_BASE_URL_ENV_KEY]: "https://kernel.infinity.example",
      [EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY]: "kernel-secret-value",
      [PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY]:
        "https://shell.infinity.example,https://work.infinity.example",
      [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "launch-secret-value",
      [WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY]: "grant-secret-value",
      [WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY]: "session-secret-value",
      [CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY]: "operator-secret-value",
      [CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY]: "service-secret-value",
    });

    expect(diagnostics.ready).toBe(true);
    expect(diagnostics.secretEnvKeys).toEqual([
      WORKSPACE_LAUNCH_SECRET_ENV_KEY,
      WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
      WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
      CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
      CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
      EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("secret-value");
    expect(
      assertDeploymentEnvReady({
        [DEPLOYMENT_ENV_KEY]: "production",
        [STRICT_ROLLOUT_ENV_KEY]: "1",
        [CONTROL_PLANE_DATABASE_URL_ENV_KEY]:
          "postgres://user:password@db.infinity.example:5432/founderos",
        [CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY]:
          "https://shell.infinity.example",
        [CANONICAL_WORK_UI_BASE_URL_ENV_KEY]: "https://work.infinity.example",
        [EXECUTION_KERNEL_BASE_URL_ENV_KEY]: "https://kernel.infinity.example",
        [EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY]: "kernel-secret-value",
        [PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY]:
          "https://shell.infinity.example,https://work.infinity.example",
        [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "launch-secret-value",
        [WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY]: "grant-secret-value",
        [WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY]: "session-secret-value",
        [CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY]: "operator-secret-value",
        [CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY]: "service-secret-value",
      }).ready,
    ).toBe(true);
  });

  test("rejects localhost origins in production deployment mode", () => {
    const diagnostics = buildDeploymentEnvDiagnostics({
      [DEPLOYMENT_ENV_KEY]: "production",
      [STRICT_ROLLOUT_ENV_KEY]: "1",
      [CONTROL_PLANE_DATABASE_URL_ENV_KEY]:
        "postgres://user:password@db.infinity.example:5432/founderos",
      [CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY]: "http://127.0.0.1:3737",
      [CANONICAL_WORK_UI_BASE_URL_ENV_KEY]: "https://work.infinity.example",
      [EXECUTION_KERNEL_BASE_URL_ENV_KEY]: "http://localhost:8798",
      [EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY]: "kernel-secret",
      [PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY]:
        "https://shell.infinity.example,http://127.0.0.1:3101",
      [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "launch-secret",
      [WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY]: "grant-secret",
      [WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY]: "session-secret",
      [CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY]: "operator-secret",
      [CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY]: "service-secret",
    });

    expect(diagnostics.ready).toBe(false);
    expect(diagnostics.localOnlyEnvKeys).toEqual(
      expect.arrayContaining([
        CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
        EXECUTION_KERNEL_BASE_URL_ENV_KEY,
        PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY,
      ]),
    );
  });

  test("requires explicit session secrets instead of launch-secret fallbacks in staging", () => {
    const env = {
      [DEPLOYMENT_ENV_KEY]: "staging",
      [CONTROL_PLANE_DATABASE_URL_ENV_KEY]:
        "postgres://user:password@db.infinity.example:5432/founderos",
      [CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY]: "http://127.0.0.1:3737",
      [CANONICAL_WORK_UI_BASE_URL_ENV_KEY]: "http://127.0.0.1:3101",
      [EXECUTION_KERNEL_BASE_URL_ENV_KEY]: "http://127.0.0.1:8798",
      [EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY]: "kernel-secret",
      [PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY]:
        "http://127.0.0.1:3737,http://127.0.0.1:3101",
      [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "launch-secret",
    };

    expect(requiresFullDeploymentEnv(env)).toBe(true);
    expect(() => resolveWorkspaceSessionGrantSecret(env)).toThrowError(
      new RegExp(WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY),
    );
    expect(() => resolveWorkspaceSessionTokenSecret(env)).toThrowError(
      new RegExp(WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY),
    );
  });
});
