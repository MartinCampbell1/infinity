import { spawnSync } from "node:child_process";

import type { VerificationCheck } from "../control-plane/contracts/orchestration";

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
  exitCode: number | null;
  stdoutSnippet: string | null;
  stderrSnippet: string | null;
};

function snippet(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 400);
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

function parseConfiguredValidationCommands(): ValidationCommandSpec[] {
  const raw = process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
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
        candidate.command.every((part) => typeof part === "string" && part.length > 0)
    );
  } catch {
    return defaultValidationCommands();
  }
}

function executeValidationCommand(spec: ValidationCommandSpec): ValidationOutcome {
  const [command, ...args] = spec.command;
  const result = spawnSync(command ?? "", args, {
    cwd: spec.cwd,
    encoding: "utf8",
    env: process.env,
  });

  return {
    bucket: spec.bucket,
    passed: result.status === 0,
    command: spec.command.join(" "),
    exitCode: result.status,
    stdoutSnippet: snippet(result.stdout),
    stderrSnippet: snippet(result.stderr),
  };
}

function aggregateValidationCheck(
  name: "static_checks_passed" | "targeted_tests_passed",
  outcomes: ValidationOutcome[],
  artifactPath: string | null
): VerificationCheck {
  const relevant = outcomes.filter((outcome) =>
    name === "static_checks_passed"
      ? outcome.bucket === "static"
      : outcome.bucket === "test"
  );
  const firstFailure = relevant.find((outcome) => !outcome.passed) ?? null;

  return {
    name,
    status: relevant.length > 0 && !firstFailure ? "passed" : "failed",
    details:
      relevant.length === 0
        ? "No validation commands were configured for this bucket."
        : firstFailure
          ? `${firstFailure.command} failed with exit code ${firstFailure.exitCode ?? "unknown"}.`
          : `${relevant.length} validation command(s) passed.`,
    command: relevant.map((outcome) => outcome.command).join("\n"),
    exitCode: firstFailure?.exitCode ?? 0,
    stdoutSnippet: firstFailure?.stdoutSnippet ?? relevant.at(-1)?.stdoutSnippet ?? null,
    stderrSnippet: firstFailure?.stderrSnippet ?? null,
    artifactPath,
  };
}

export function runValidationChecks(artifactPath: string | null) {
  const outcomes = parseConfiguredValidationCommands().map(executeValidationCommand);

  return {
    outcomes,
    checks: [
      aggregateValidationCheck("static_checks_passed", outcomes, artifactPath),
      aggregateValidationCheck("targeted_tests_passed", outcomes, artifactPath),
    ],
  };
}
