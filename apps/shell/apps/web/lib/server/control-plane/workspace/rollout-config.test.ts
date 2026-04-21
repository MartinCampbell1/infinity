import { describe, expect, test } from "vitest";

import {
  CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
  CANONICAL_WORK_UI_BASE_URL_ENV_KEY,
  LEGACY_CONTROL_PLANE_SECRET_ENV_KEY,
  STRICT_ROLLOUT_ENV_KEY,
  WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
  WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
  WORKSPACE_LAUNCH_SECRET_ENV_KEY,
  isStrictRolloutEnv,
  resolveShellPublicOriginForLaunch,
  resolveWorkUiBaseUrlForLaunch,
  resolveWorkspaceSessionGrantSecret,
  resolveWorkspaceSessionTokenSecret,
  resolveWorkspaceSessionTokenSecretEnvKey,
  resolveWorkspaceLaunchSecret,
} from "./rollout-config";

describe("workspace rollout config", () => {
  test("keeps localhost defaults outside strict rollout mode", () => {
    expect(resolveWorkUiBaseUrlForLaunch({})).toBe("http://127.0.0.1:5173");
    expect(resolveShellPublicOriginForLaunch({})).toBe("http://127.0.0.1:3737");
    expect(resolveWorkspaceLaunchSecret({})).toBeNull();
    expect(resolveWorkspaceSessionGrantSecret({})).toBeNull();
    expect(resolveWorkspaceSessionTokenSecret({})).toBeNull();
    expect(isStrictRolloutEnv({})).toBe(false);
  });

  test("detects explicit strict rollout mode", () => {
    expect(isStrictRolloutEnv({ [STRICT_ROLLOUT_ENV_KEY]: "1" })).toBe(true);
    expect(isStrictRolloutEnv({ [STRICT_ROLLOUT_ENV_KEY]: "0" })).toBe(false);
  });

  test("requires canonical work-ui base url in strict rollout mode", () => {
    expect(() =>
      resolveWorkUiBaseUrlForLaunch({ [STRICT_ROLLOUT_ENV_KEY]: "1" })
    ).toThrowError(new RegExp(CANONICAL_WORK_UI_BASE_URL_ENV_KEY));

    expect(
      resolveWorkUiBaseUrlForLaunch({
        [STRICT_ROLLOUT_ENV_KEY]: "1",
        [CANONICAL_WORK_UI_BASE_URL_ENV_KEY]: "https://work-ui.infinity.local",
      })
    ).toBe("https://work-ui.infinity.local");
  });

  test("requires canonical shell public origin in strict rollout mode", () => {
    expect(() =>
      resolveShellPublicOriginForLaunch({ [STRICT_ROLLOUT_ENV_KEY]: "1" })
    ).toThrowError(new RegExp(CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY));

    expect(
      resolveShellPublicOriginForLaunch({
        [STRICT_ROLLOUT_ENV_KEY]: "1",
        [CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY]: "https://shell.infinity.local",
      })
    ).toBe("https://shell.infinity.local");
  });

  test("requires launch secret in strict rollout mode but still accepts compatibility alias", () => {
    expect(() =>
      resolveWorkspaceLaunchSecret({ [STRICT_ROLLOUT_ENV_KEY]: "1" })
    ).toThrowError(new RegExp(WORKSPACE_LAUNCH_SECRET_ENV_KEY));

    expect(
      resolveWorkspaceLaunchSecret({
        [STRICT_ROLLOUT_ENV_KEY]: "1",
        [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "canonical-secret",
      })
    ).toBe("canonical-secret");

    expect(
      resolveWorkspaceLaunchSecret({
        [STRICT_ROLLOUT_ENV_KEY]: "1",
        [LEGACY_CONTROL_PLANE_SECRET_ENV_KEY]: "legacy-secret",
      })
    ).toBe("legacy-secret");
  });

  test("resolves the session grant secret from its canonical env and falls back to launch secret", () => {
    expect(
      resolveWorkspaceSessionGrantSecret({
        [WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY]: "grant-secret",
      })
    ).toBe("grant-secret");

    expect(
      resolveWorkspaceSessionGrantSecret({
        [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "launch-secret",
      })
    ).toBe("launch-secret");
  });

  test("resolves the embedded session token secret from its canonical env and falls back to launch secret", () => {
    expect(
      resolveWorkspaceSessionTokenSecret({
        [WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY]: "session-secret",
      })
    ).toBe("session-secret");

    expect(
      resolveWorkspaceSessionTokenSecret({
        [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "launch-secret",
      })
    ).toBe("launch-secret");
  });

  test("reports which env key provided the embedded session token secret", () => {
    expect(
      resolveWorkspaceSessionTokenSecretEnvKey({
        [WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY]: "session-secret",
      })
    ).toBe(WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY);

    expect(
      resolveWorkspaceSessionTokenSecretEnvKey({
        [WORKSPACE_LAUNCH_SECRET_ENV_KEY]: "launch-secret",
      })
    ).toBe(WORKSPACE_LAUNCH_SECRET_ENV_KEY);

    expect(
      resolveWorkspaceSessionTokenSecretEnvKey({
        [LEGACY_CONTROL_PLANE_SECRET_ENV_KEY]: "legacy-secret",
      })
    ).toBe(LEGACY_CONTROL_PLANE_SECRET_ENV_KEY);
  });
});
