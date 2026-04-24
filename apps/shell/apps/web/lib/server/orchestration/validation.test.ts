import { describe, expect, test } from "vitest";

import {
  buildRuntimeValidationEnvironment,
  resolveValidationCommandSpecs,
  runValidationChecks,
} from "./validation";

describe("runtime validation environment", () => {
  test("keeps only runtime essentials and injects the intended run endpoints", () => {
    const env = buildRuntimeValidationEnvironment({
      baseEnv: {
        PATH: "/usr/local/bin:/usr/bin",
        HOME: "/Users/martin",
        NODE_ENV: "test",
        npm_config_cache: "/tmp/npm-cache",
        NODE_OPTIONS: "--max-old-space-size=1280",
        FOUNDEROS_CONTROL_PLANE_STATE_DIR: "/tmp/live-shell-state",
        FOUNDEROS_EXECUTION_KERNEL_BASE_URL: "http://127.0.0.1:9998",
        FOUNDEROS_WORK_UI_BASE_URL: "http://127.0.0.1:9997",
        FOUNDEROS_SHELL_PUBLIC_ORIGIN: "http://127.0.0.1:9996",
        FOUNDEROS_WEB_PORT: "9996",
        NEXT_PUBLIC_FOUNDEROS_WORK_UI_BASE_URL: "http://127.0.0.1:9997",
        FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON: '[{"bucket":"test"}]',
      },
      stateDir: "/tmp/intended-run-state",
      kernelBaseUrl: "http://127.0.0.1:8798",
      workUiBaseUrl: "http://127.0.0.1:3101",
      shellOrigin: "http://127.0.0.1:3737",
    });

    expect(env.PATH).toBe("/usr/local/bin:/usr/bin");
    expect(env.HOME).toBe("/Users/martin");
    expect(env.NODE_ENV).toBe("test");
    expect(env.npm_config_cache).toBe("/tmp/npm-cache");
    expect(env.NODE_OPTIONS).toBe("--max-old-space-size=1280");
    expect(env.FOUNDEROS_CONTROL_PLANE_STATE_DIR).toBe(
      "/tmp/intended-run-state",
    );
    expect(env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL).toBe(
      "http://127.0.0.1:8798",
    );
    expect(env.FOUNDEROS_WORK_UI_BASE_URL).toBe("http://127.0.0.1:3101");
    expect(env.FOUNDEROS_SHELL_PUBLIC_ORIGIN).toBe("http://127.0.0.1:3737");
    expect(env.FOUNDEROS_WEB_PORT).toBeUndefined();
    expect(env.NEXT_PUBLIC_FOUNDEROS_WORK_UI_BASE_URL).toBeUndefined();
    expect(
      env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON,
    ).toBeUndefined();
  });

  test("ignores configured validation commands unless a fixture explicitly allows them", () => {
    const fixtureCommandsJson = JSON.stringify([
      {
        name: "fixture-noop",
        bucket: "test",
        cwd: "/Users/martin/infinity",
        command: ["node", "-e", "process.exit(0)"],
      },
    ]);
    const baseEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON: fixtureCommandsJson,
    };

    expect(
      resolveValidationCommandSpecs({ baseEnv }).map((command) => command.name),
    ).toEqual([
      "shell:typecheck",
      "work-ui:check",
      "shell:test:orchestration-readiness",
      "kernel:test",
    ]);
    expect(
      resolveValidationCommandSpecs({
        baseEnv,
        allowValidationCommandOverride: true,
      }).map((command) => command.name),
    ).toEqual(["fixture-noop"]);
  });

  test("failed validation checks retain the exact failing command, cwd, snippets, and artifact path", () => {
    const fixtureCommandsJson = JSON.stringify([
      {
        name: "static-pass",
        bucket: "static",
        cwd: "/Users/martin/infinity",
        command: ["node", "-e", "process.exit(0)"],
      },
      {
        name: "static-fail",
        bucket: "static",
        cwd: "/Users/martin/infinity/apps/shell",
        command: [
          "node",
          "-e",
          "process.stdout.write('fail-out'); process.stderr.write('fail-err'); process.exit(7)",
        ],
      },
    ]);

    const result = runValidationChecks("/tmp/assembly-manifest.json", {
      baseEnv: {
        NODE_ENV: "test",
        PATH: process.env.PATH,
      },
      allowValidationCommandOverride: true,
      validationCommandsJson: fixtureCommandsJson,
    });

    const failedCheck = result.checks.find(
      (check) => check.name === "static_checks_passed",
    );
    expect(failedCheck).toEqual(
      expect.objectContaining({
        status: "failed",
        command:
          "node -e process.stdout.write('fail-out'); process.stderr.write('fail-err'); process.exit(7)",
        cwd: "/Users/martin/infinity/apps/shell",
        exitCode: 7,
        stdoutSnippet: "fail-out",
        stderrSnippet: "fail-err",
        artifactPath: "/tmp/assembly-manifest.json",
      }),
    );
  });
});
