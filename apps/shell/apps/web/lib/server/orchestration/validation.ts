import { spawnSync } from "node:child_process";
import path from "node:path";

import type { VerificationCheck } from "../control-plane/contracts/orchestration";
import { getControlPlaneStatePath } from "../control-plane/state/store";

type ValidationBucket = "static" | "test";

type ValidationCommandSpec = {
  name: string;
  bucket: ValidationBucket;
  cwd: string;
  command: string[];
};

type ValidationOutcome = {
  bucket: ValidationBucket;
  passed: boolean;
  command: string;
  cwd: string;
  exitCode: number | null;
  stdoutSnippet: string | null;
  stderrSnippet: string | null;
};

type RuntimeValidationEnvironmentOptions = {
  baseEnv?: NodeJS.ProcessEnv;
  stateDir?: string | null;
  kernelBaseUrl?: string | null;
  workUiBaseUrl?: string | null;
  shellOrigin?: string | null;
};

type ValidationRunOptions = RuntimeValidationEnvironmentOptions & {
  allowValidationCommandOverride?: boolean;
  validationCommandsJson?: string | null;
};

const DEFAULT_KERNEL_BASE_URL = "http://127.0.0.1:8798";
const DEFAULT_WORK_UI_BASE_URL = "http://127.0.0.1:3101";
const DEFAULT_SHELL_PUBLIC_ORIGIN = "http://127.0.0.1:3737";

const ENV_PASSTHROUGH_KEYS = new Set([
  "CI",
  "HOME",
  "LANG",
  "LC_ALL",
  "LOGNAME",
  "NODE",
  "NODE_ENV",
  "NODE_OPTIONS",
  "PATH",
  "SHELL",
  "SSH_AUTH_SOCK",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "USER",
  "GOCACHE",
  "GOENV",
  "GOFLAGS",
  "GOMODCACHE",
  "GONOSUMDB",
  "GOPATH",
  "GOPRIVATE",
  "GOPROXY",
  "GOROOT",
  "GOSUMDB",
]);

const ENV_PASSTHROUGH_PREFIXES = [
  "COREPACK_",
  "LC_",
  "NPM_",
  "NVM_",
  "PNPM_",
  "YARN_",
  "npm_",
];

function snippet(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 400);
}

function optionalValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isPassthroughEnvKey(key: string) {
  return (
    ENV_PASSTHROUGH_KEYS.has(key) ||
    ENV_PASSTHROUGH_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

function setEnvValue(
  env: NodeJS.ProcessEnv,
  key: string,
  value: string | null | undefined,
) {
  const normalized = optionalValue(value);
  if (normalized) {
    env[key] = normalized;
  }
}

function resolveStateDir(baseEnv: NodeJS.ProcessEnv, explicit?: string | null) {
  return (
    optionalValue(explicit) ??
    optionalValue(baseEnv.FOUNDEROS_CONTROL_PLANE_STATE_DIR) ??
    path.dirname(getControlPlaneStatePath())
  );
}

function resolveShellOrigin(
  baseEnv: NodeJS.ProcessEnv,
  explicit?: string | null,
) {
  return (
    optionalValue(explicit) ??
    optionalValue(baseEnv.FOUNDEROS_SHELL_PUBLIC_ORIGIN) ??
    DEFAULT_SHELL_PUBLIC_ORIGIN
  );
}

export function buildRuntimeValidationEnvironment(
  options: RuntimeValidationEnvironmentOptions = {},
): NodeJS.ProcessEnv {
  const baseEnv = options.baseEnv ?? process.env;
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: baseEnv.NODE_ENV ?? process.env.NODE_ENV ?? "production",
  };

  for (const [key, value] of Object.entries(baseEnv)) {
    if (isPassthroughEnvKey(key)) {
      setEnvValue(env, key, value);
    }
  }

  setEnvValue(
    env,
    "FOUNDEROS_CONTROL_PLANE_STATE_DIR",
    resolveStateDir(baseEnv, options.stateDir),
  );
  setEnvValue(
    env,
    "FOUNDEROS_EXECUTION_KERNEL_BASE_URL",
    optionalValue(options.kernelBaseUrl) ??
      optionalValue(baseEnv.FOUNDEROS_EXECUTION_KERNEL_BASE_URL) ??
      DEFAULT_KERNEL_BASE_URL,
  );
  setEnvValue(
    env,
    "FOUNDEROS_WORK_UI_BASE_URL",
    optionalValue(options.workUiBaseUrl) ??
      optionalValue(baseEnv.FOUNDEROS_WORK_UI_BASE_URL) ??
      DEFAULT_WORK_UI_BASE_URL,
  );
  setEnvValue(
    env,
    "FOUNDEROS_SHELL_PUBLIC_ORIGIN",
    resolveShellOrigin(baseEnv, options.shellOrigin),
  );

  return env;
}

function defaultValidationCommands(): ValidationCommandSpec[] {
  return [
    {
      name: "shell:typecheck",
      bucket: "static",
      cwd: "/Users/martin/infinity",
      command: ["npm", "run", "shell:typecheck"],
    },
    {
      name: "work-ui:check",
      bucket: "static",
      cwd: "/Users/martin/infinity",
      command: ["npm", "run", "work-ui:check"],
    },
    {
      name: "shell:test:orchestration-readiness",
      bucket: "test",
      cwd: "/Users/martin/infinity",
      command: [
        "npm",
        "run",
        "test:orchestration-readiness",
        "--workspace",
        "@founderos/web",
      ],
    },
    {
      name: "kernel:test",
      bucket: "test",
      cwd: "/Users/martin/infinity/services/execution-kernel",
      command: ["go", "test", "./..."],
    },
  ];
}

function configuredValidationCommandsAllowed(baseEnv: NodeJS.ProcessEnv) {
  return baseEnv.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON === "1";
}

export function resolveValidationCommandSpecs(
  options: ValidationRunOptions = {},
): ValidationCommandSpec[] {
  const baseEnv = options.baseEnv ?? process.env;
  const allowOverride =
    options.allowValidationCommandOverride ??
    configuredValidationCommandsAllowed(baseEnv);
  const raw = allowOverride
    ? (options.validationCommandsJson ??
      baseEnv.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON)
    : null;
  if (!raw) {
    return defaultValidationCommands();
  }

  try {
    const parsed = JSON.parse(raw) as ValidationCommandSpec[];
    if (!Array.isArray(parsed)) {
      return defaultValidationCommands();
    }

    return parsed.filter(
      (candidate) =>
        !!candidate &&
        (candidate.bucket === "static" || candidate.bucket === "test") &&
        typeof candidate.cwd === "string" &&
        Array.isArray(candidate.command) &&
        candidate.command.every(
          (part) => typeof part === "string" && part.length > 0,
        ),
    );
  } catch {
    return defaultValidationCommands();
  }
}

function aggregateValidationCheck(
  name: "static_checks_passed" | "targeted_tests_passed",
  outcomes: ValidationOutcome[],
  artifactPath: string | null,
): VerificationCheck {
  const relevant = outcomes.filter((outcome) =>
    name === "static_checks_passed"
      ? outcome.bucket === "static"
      : outcome.bucket === "test",
  );
  const firstFailure = relevant.find((outcome) => !outcome.passed) ?? null;
  const representativeOutcome =
    firstFailure ?? (relevant.length === 1 ? (relevant[0] ?? null) : null);

  return {
    name,
    status: relevant.length > 0 && !firstFailure ? "passed" : "failed",
    details:
      relevant.length === 0
        ? "No validation commands were configured for this bucket."
        : firstFailure
          ? `${firstFailure.command} failed with exit code ${firstFailure.exitCode ?? "unknown"}.`
          : `${relevant.length} validation command(s) passed.`,
    command:
      firstFailure?.command ??
      relevant.map((outcome) => outcome.command).join("\n"),
    cwd: representativeOutcome?.cwd ?? null,
    exitCode: firstFailure?.exitCode ?? 0,
    stdoutSnippet:
      firstFailure?.stdoutSnippet ?? relevant.at(-1)?.stdoutSnippet ?? null,
    stderrSnippet: firstFailure?.stderrSnippet ?? null,
    artifactPath,
  };
}

export function runValidationChecks(
  artifactPath: string | null,
  options: ValidationRunOptions = {},
) {
  const runtimeEnv = buildRuntimeValidationEnvironment(options);
  const outcomes = resolveValidationCommandSpecs(options).map((spec) => {
    const [command, ...args] = spec.command;
    const result = spawnSync(command ?? "", args, {
      cwd: spec.cwd,
      encoding: "utf8",
      env: runtimeEnv,
    });

    return {
      bucket: spec.bucket,
      passed: result.status === 0,
      command: spec.command.join(" "),
      cwd: spec.cwd,
      exitCode: result.status,
      stdoutSnippet: snippet(result.stdout),
      stderrSnippet: snippet(result.stderr),
    };
  });

  return {
    outcomes,
    checks: [
      aggregateValidationCheck("static_checks_passed", outcomes, artifactPath),
      aggregateValidationCheck("targeted_tests_passed", outcomes, artifactPath),
    ],
  };
}
