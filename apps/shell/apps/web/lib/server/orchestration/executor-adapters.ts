import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type {
  AttemptRecord,
  ExecutorProofBundle,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";

import { resolveInfinityRoot, storeFileArtifact } from "./artifacts";
import { materializeAttemptArtifacts } from "./attempt-artifacts";
import { nowIso } from "./shared";

const execFileAsync = promisify(execFile);

export type ExecutorAdapterKind =
  | "codex"
  | "claude"
  | "local_command"
  | "webhook"
  | "synthetic";

export type ExecutorAttemptInput = {
  initiativeId: string;
  taskGraphId: string;
  batchId: string;
  workUnit: WorkUnitRecord;
  attempt: AttemptRecord;
};

export interface ExecutorAdapter {
  kind: ExecutorAdapterKind;
  run(input: ExecutorAttemptInput): Promise<ExecutorProofBundle>;
}

function deploymentEnv() {
  return (process.env.FOUNDEROS_DEPLOYMENT_ENV ?? "local").trim().toLowerCase();
}

export function syntheticExecutionAllowed() {
  if (process.env.FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION !== "1") {
    return false;
  }
  return deploymentEnv() !== "production" && deploymentEnv() !== "staging";
}

function proofPath(input: ExecutorAttemptInput) {
  return path.join(
    resolveInfinityRoot(),
    ".local-state",
    "orchestration",
    "executor-proofs",
    input.initiativeId,
    `${input.attempt.id}.json`
  );
}

async function persistProofBundle(input: ExecutorAttemptInput, proof: ExecutorProofBundle) {
  const outputPath = proofPath(input);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(proof, null, 2));
  const storedProof = await storeFileArtifact({
    key: `executor-proofs/${input.initiativeId}/${input.attempt.id}.json`,
    filePath: outputPath,
    contentType: "application/json",
  });
  const persisted = {
    ...proof,
    artifactUris: [...proof.artifactUris, storedProof.uri],
  };
  writeFileSync(outputPath, JSON.stringify(persisted, null, 2));
  await storeFileArtifact({
    key: `executor-proofs/${input.initiativeId}/${input.attempt.id}.json`,
    filePath: outputPath,
    contentType: "application/json",
  });
  return persisted;
}

class SyntheticExecutorAdapter implements ExecutorAdapter {
  kind = "synthetic" as const;

  async run(input: ExecutorAttemptInput) {
    const artifacts = await materializeAttemptArtifacts({
      initiativeId: input.initiativeId,
      taskGraphId: input.taskGraphId,
      batchId: input.batchId,
      workUnit: input.workUnit,
      attemptId: input.attempt.id,
    });
    return persistProofBundle(input, {
      executorKind: this.kind,
      summary: artifacts.summary,
      changedFiles: [],
      logs: [
        {
          name: "synthetic-execution",
          content:
            "Synthetic local demo execution was explicitly enabled with FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION=1.",
        },
      ],
      tests: [
        {
          name: "synthetic-proof",
          status: "passed",
          output: "Local demo scaffold materialized.",
        },
      ],
      artifactUris: artifacts.artifactUris,
      exitCode: 0,
      completedAt: nowIso(),
    });
  }
}

function parseLocalCommand() {
  if (process.env.FOUNDEROS_ALLOW_LOCAL_EXECUTOR_COMMAND !== "1") {
    return null;
  }
  const raw = process.env.FOUNDEROS_EXECUTOR_LOCAL_COMMAND_JSON;
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((part) => typeof part !== "string")) {
    throw new Error("FOUNDEROS_EXECUTOR_LOCAL_COMMAND_JSON must be a non-empty JSON string array.");
  }
  return parsed as string[];
}

async function gitChangedFiles(root: string) {
  const [tracked, untracked] = await Promise.all([
    execFileAsync("git", ["-C", root, "diff", "--name-only", "HEAD", "--"]).catch(() => ({
      stdout: "",
    })),
    execFileAsync("git", ["-C", root, "ls-files", "--others", "--exclude-standard"]).catch(() => ({
      stdout: "",
    })),
  ]);
  return [...new Set(`${tracked.stdout}\n${untracked.stdout}`.split("\n").map((item) => item.trim()).filter(Boolean))];
}

class LocalCommandExecutorAdapter implements ExecutorAdapter {
  kind = "local_command" as const;

  constructor(private readonly command: string[]) {}

  async run(input: ExecutorAttemptInput) {
    const root = resolveInfinityRoot();
    const startedAt = nowIso();
    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    try {
      const result = await execFileAsync(this.command[0] ?? "", this.command.slice(1), {
        cwd: root,
        timeout: 60_000,
        maxBuffer: 1024 * 1024 * 4,
        env: {
          ...process.env,
          FOUNDEROS_EXECUTION_ATTEMPT_ID: input.attempt.id,
          FOUNDEROS_EXECUTION_WORK_UNIT_ID: input.workUnit.id,
          FOUNDEROS_EXECUTION_BATCH_ID: input.batchId,
        },
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      const failure = error as {
        code?: number | string;
        stdout?: string;
        stderr?: string;
      };
      stdout = failure.stdout ?? "";
      stderr = failure.stderr ?? "";
      exitCode = typeof failure.code === "number" ? failure.code : 1;
    }

    const changedFiles = await gitChangedFiles(root);
    return persistProofBundle(input, {
      executorKind: this.kind,
      summary:
        exitCode === 0
          ? `Local command executor completed ${input.workUnit.id}.`
          : `Local command executor failed ${input.workUnit.id}.`,
      changedFiles,
      logs: [
        { name: "stdout", content: stdout },
        { name: "stderr", content: stderr },
      ],
      tests: [
        {
          name: "local-command",
          status: exitCode === 0 ? "passed" : "failed",
          command: this.command,
          output: stdout || stderr || `started at ${startedAt}`,
        },
      ],
      artifactUris: [],
      exitCode,
      completedAt: nowIso(),
    });
  }
}

export function createExecutorAdapter() {
  const configured = (process.env.FOUNDEROS_EXECUTOR_ADAPTER ?? "").trim();
  if (configured === "local_command") {
    const command = parseLocalCommand();
    if (!command) {
      throw new Error("local_command executor requires explicit local command env configuration.");
    }
    return new LocalCommandExecutorAdapter(command);
  }
  if (configured === "codex" || configured === "claude" || configured === "webhook") {
    throw new Error(`${configured} executor adapter is declared but not configured in this build.`);
  }
  if (syntheticExecutionAllowed()) {
    return new SyntheticExecutorAdapter();
  }
  return null;
}
