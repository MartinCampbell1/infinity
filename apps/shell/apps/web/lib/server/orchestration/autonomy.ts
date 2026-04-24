import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";

import { listAssemblies, createAssembly } from "./assembly";
import {
  buildExecutionBatchDetailResponse,
  createExecutionBatch,
  resolveExecutionKernelBaseUrl,
} from "./batches";
import { updateOrchestrationBrief } from "./briefs";
import { createDelivery, listDeliveries } from "./delivery";
import {
  buildTaskGraphDetailResponse,
  createTaskGraphFromBrief,
  listOrchestrationTaskGraphs,
} from "./task-graphs";
import { createVerification, listVerifications } from "./verification";
import { performSupervisorAction } from "./supervisor";
import {
  appendAutonomousRunEvent,
  updateAutonomousRunStage,
} from "./autonomous-run";
import { createExecutorAdapter } from "./executor-adapters";

const AUTONOMOUS_BRIEF_AUTHOR = "hermes-intake";
const AUTONOMOUS_REPO_SCOPE = [
  "/Users/martin/infinity/apps/shell",
  "/Users/martin/infinity/apps/work-ui",
  "/Users/martin/infinity/services/execution-kernel",
] as const;

const MAX_AUTONOMOUS_PASSES = 24;

function yieldAutonomousLoopTurn() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function autonomyFailureDetail(error: unknown, kernelBaseUrl: string) {
  const message = error instanceof Error ? error.message : "Autonomous orchestration failed.";
  const cause =
    error && typeof error === "object" && "cause" in error
      ? (error as { cause?: { code?: string } }).cause
      : null;

  if (cause?.code === "ECONNREFUSED" || message.includes("fetch failed")) {
    return `Cannot reach the local execution kernel at ${kernelBaseUrl}. Start it and retry the run.`;
  }

  if (message.includes("Execution kernel request failed")) {
    return `The execution kernel at ${kernelBaseUrl} rejected the request. Inspect the kernel and retry the run.`;
  }

  return message;
}

function normalizeList(values: readonly string[], fallback: readonly string[]) {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : [...fallback];
}

function isAutonomousBriefAuthor(authoredBy?: string | null) {
  return authoredBy?.trim() === AUTONOMOUS_BRIEF_AUTHOR;
}

async function latestInitiativeSnapshot(initiativeId: string) {
  const state = await readControlPlaneState();
  const initiative =
    state.orchestration.initiatives.find((candidate) => candidate.id === initiativeId) ?? null;
  const briefs = [...state.orchestration.briefs]
    .filter((candidate) => candidate.initiativeId === initiativeId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return {
    initiative,
    brief: briefs[0] ?? null,
  };
}

async function initiativeRunsAutonomously(initiativeId: string) {
  const snapshot = await latestInitiativeSnapshot(initiativeId);
  return !!snapshot.brief && isAutonomousBriefAuthor(snapshot.brief.authoredBy);
}

async function latestTaskGraphDetailForInitiative(initiativeId: string) {
  const taskGraph = (await listOrchestrationTaskGraphs({ initiativeId }))[0] ?? null;
  if (!taskGraph) {
    return null;
  }

  return buildTaskGraphDetailResponse(taskGraph.id);
}

function buildAutonomousClarificationLog(userRequest: string) {
  return [
    {
      question: "Can Infinity proceed without extra operator clarification on the happy path?",
      answer: `Yes. Autonomous one-prompt mode treats the original request as the initial executable brief: ${userRequest.trim()}`,
    },
  ];
}

async function maybeNormalizeAndApproveBrief(initiativeId: string) {
  const snapshot = await latestInitiativeSnapshot(initiativeId);
  if (!snapshot.initiative || !snapshot.brief || !isAutonomousBriefAuthor(snapshot.brief.authoredBy)) {
    return false;
  }

  const { initiative, brief } = snapshot;
  const desiredSummary = brief.summary.trim() || initiative.userRequest.trim();
  const desiredGoals = normalizeList(brief.goals, [
    `Deliver the requested Infinity project outcome for: ${initiative.title}`,
    initiative.userRequest.trim(),
  ]);
  const desiredNonGoals = normalizeList(brief.nonGoals, [
    "Do not require manual happy-path stage clicks.",
  ]);
  const desiredConstraints = normalizeList(brief.constraints, [
    "Preserve the existing Infinity shell/work-ui architecture.",
    "Keep implementation inside /Users/martin/infinity.",
  ]);
  const desiredAssumptions = normalizeList(brief.assumptions, [
    "The shell owns orchestration truth and may progress the happy path automatically.",
    "Operator controls remain available as override and recovery surfaces.",
  ]);
  const desiredAcceptance = normalizeList(brief.acceptanceCriteria, [
    "One prompt can progress from intake to ready delivery without required manual stage clicks.",
    "A local preview artifact and a handoff pack exist for the completed run.",
  ]);
  const desiredRepoScope = normalizeList(brief.repoScope, AUTONOMOUS_REPO_SCOPE);
  const desiredDeliverables = normalizeList(brief.deliverables, [
    "Approved brief",
    "Task graph",
    "Completed execution batches",
    "Assembly package",
    "Verification report",
    "Delivery handoff pack",
    "Local preview artifact",
  ]);
  const desiredClarificationLog =
    brief.clarificationLog.length > 0
      ? brief.clarificationLog
      : buildAutonomousClarificationLog(initiative.userRequest);

  const needsUpdate =
    brief.status !== "approved" ||
    brief.summary !== desiredSummary ||
    JSON.stringify(brief.goals) !== JSON.stringify(desiredGoals) ||
    JSON.stringify(brief.nonGoals) !== JSON.stringify(desiredNonGoals) ||
    JSON.stringify(brief.constraints) !== JSON.stringify(desiredConstraints) ||
    JSON.stringify(brief.assumptions) !== JSON.stringify(desiredAssumptions) ||
    JSON.stringify(brief.acceptanceCriteria) !== JSON.stringify(desiredAcceptance) ||
    JSON.stringify(brief.repoScope) !== JSON.stringify(desiredRepoScope) ||
    JSON.stringify(brief.deliverables) !== JSON.stringify(desiredDeliverables) ||
    JSON.stringify(brief.clarificationLog) !== JSON.stringify(desiredClarificationLog);

  if (!needsUpdate) {
    return false;
  }

  const updated = await updateOrchestrationBrief(brief.id, {
    summary: desiredSummary,
    goals: desiredGoals,
    nonGoals: desiredNonGoals,
    constraints: desiredConstraints,
    assumptions: desiredAssumptions,
    acceptanceCriteria: desiredAcceptance,
    repoScope: desiredRepoScope,
    deliverables: desiredDeliverables,
    clarificationLog: desiredClarificationLog,
    status: "approved",
  });

  return !!updated.brief;
}

async function maybePlanApprovedBrief(initiativeId: string) {
  const snapshot = await latestInitiativeSnapshot(initiativeId);
  if (!snapshot.brief || !isAutonomousBriefAuthor(snapshot.brief.authoredBy)) {
    return false;
  }

  const existingTaskGraph = (await listOrchestrationTaskGraphs({ initiativeId }))[0] ?? null;
  if (existingTaskGraph || snapshot.brief.status !== "approved") {
    return false;
  }

  const created = await createTaskGraphFromBrief({ briefId: snapshot.brief.id });
  return !!created?.taskGraph;
}

async function maybeLaunchRunnableBatch(initiativeId: string) {
  const detail = await latestTaskGraphDetailForInitiative(initiativeId);
  if (!detail || !detail.taskGraph) {
    return false;
  }

  if (detail.runnableWorkUnitIds.length === 0) {
    return false;
  }

  const response = await createExecutionBatch({
    taskGraphId: detail.taskGraph.id,
    workUnitIds: detail.runnableWorkUnitIds,
    concurrencyLimit: detail.runnableWorkUnitIds.length,
  });

  return !!response?.batch;
}

async function maybeRunExecutorAttempts(initiativeId: string) {
  const detail = await latestTaskGraphDetailForInitiative(initiativeId);
  if (!detail?.taskGraph) {
    return false;
  }

  const adapter = createExecutorAdapter();
  if (!adapter) {
    return false;
  }

  const state = await readControlPlaneState();
  const batches = [...state.orchestration.batches]
    .filter(
      (candidate) =>
        candidate.initiativeId === initiativeId &&
        candidate.taskGraphId === detail.taskGraph.id &&
        candidate.status === "running"
    )
    .sort((left, right) => (right.startedAt ?? right.id).localeCompare(left.startedAt ?? left.id));

  let progressed = false;

  for (const batch of batches) {
    const batchDetail = await buildExecutionBatchDetailResponse(batch.id);
    if (!batchDetail) {
      continue;
    }

    for (const attempt of batchDetail.attempts.filter((candidate) =>
      ["leased", "running", "started"].includes(candidate.status)
    )) {
      const workUnit =
        batchDetail.workUnits.find((candidate) => candidate.id === attempt.workUnitId) ?? null;
      if (!workUnit) {
        continue;
      }

      const proof = await adapter.run({
        initiativeId: batch.initiativeId,
        taskGraphId: batch.taskGraphId,
        batchId: batch.id,
        workUnit,
        attempt,
      });

      const result =
        proof.exitCode === 0
          ? await performSupervisorAction({
              actionKind: "complete_attempt",
              batchId: batch.id,
              attemptId: attempt.id,
              workUnitId: attempt.workUnitId,
              executorProof: proof,
            })
          : await performSupervisorAction({
              actionKind: "fail_attempt",
              batchId: batch.id,
              attemptId: attempt.id,
              workUnitId: attempt.workUnitId,
              errorCode: "EXECUTOR_FAILED",
              errorSummary: proof.summary,
            });

      if (result) {
        progressed = true;
      }
    }
  }

  return progressed;
}

async function maybeAssembleCompletedRun(initiativeId: string) {
  const detail = await latestTaskGraphDetailForInitiative(initiativeId);
  if (!detail?.taskGraph || detail.taskGraph.status !== "completed") {
    return false;
  }

  const existing = (await listAssemblies({ initiativeId }))[0] ?? null;
  if (
    existing &&
    existing.taskGraphId === detail.taskGraph.id &&
    existing.status === "assembled"
  ) {
    return false;
  }

  const created = await createAssembly({ initiativeId });
  return !!created?.assembly;
}

async function maybeVerifyAssembly(initiativeId: string) {
  const assemblies = await listAssemblies({ initiativeId });
  const assembly = assemblies[0] ?? null;
  if (!assembly || assembly.status !== "assembled") {
    return false;
  }

  const verification = (await listVerifications({ initiativeId }))[0] ?? null;
  if (
    verification &&
    verification.assemblyId === assembly.id &&
    (verification.overallStatus === "passed" || verification.overallStatus === "failed")
  ) {
    return false;
  }

  const created = await createVerification({ initiativeId });
  return !!created?.verification;
}

async function maybeCreateReadyDelivery(initiativeId: string) {
  const verification = (await listVerifications({ initiativeId }))[0] ?? null;
  if (!verification || verification.overallStatus !== "passed") {
    return false;
  }

  const delivery = (await listDeliveries({ initiativeId }))[0] ?? null;
  if (
    delivery &&
    delivery.verificationRunId === verification.id &&
    delivery.status === "ready"
  ) {
    return false;
  }

  const created = await createDelivery({ initiativeId });
  return !!created?.delivery;
}

export async function runAutonomousLoopForInitiative(initiativeId: string) {
  if (!(await initiativeRunsAutonomously(initiativeId))) {
    return false;
  }

  let progressedAny = false;

  for (let pass = 0; pass < MAX_AUTONOMOUS_PASSES; pass += 1) {
    let progressed = false;

    progressed = (await maybeNormalizeAndApproveBrief(initiativeId)) || progressed;
    progressed = (await maybePlanApprovedBrief(initiativeId)) || progressed;
    progressed = (await maybeLaunchRunnableBatch(initiativeId)) || progressed;
    progressed = (await maybeRunExecutorAttempts(initiativeId)) || progressed;
    progressed = (await maybeLaunchRunnableBatch(initiativeId)) || progressed;
    progressed = (await maybeAssembleCompletedRun(initiativeId)) || progressed;
    progressed = (await maybeVerifyAssembly(initiativeId)) || progressed;
    progressed = (await maybeCreateReadyDelivery(initiativeId)) || progressed;

    progressedAny = progressedAny || progressed;
    if (!progressed) {
      break;
    }
    if (!shouldRunAutonomousLoopInline()) {
      await yieldAutonomousLoopTurn();
    }
  }

  return progressedAny;
}

export async function runAutonomousLoopSafely(initiativeId?: string | null) {
  if (!initiativeId) {
    return false;
  }

  try {
    return await runAutonomousLoopForInitiative(initiativeId);
  } catch (error) {
    const kernelBaseUrl = resolveExecutionKernelBaseUrl();
    const detail = autonomyFailureDetail(error, kernelBaseUrl);
    const kernelUnavailable =
      detail.includes("Cannot reach the local execution kernel") ||
      detail.includes("execution kernel at");

    await updateControlPlaneState((draft) => {
      updateAutonomousRunStage(draft, initiativeId, {
        stage: "blocked",
        health: "blocked",
      });
      appendAutonomousRunEvent(draft, initiativeId, {
        kind: kernelUnavailable ? "runtime.unavailable" : "run.blocked",
        stage: "blocked",
        summary: kernelUnavailable
          ? `Execution kernel unavailable at ${kernelBaseUrl}.`
          : "Autonomous run blocked by a runtime failure.",
        payload: kernelUnavailable
          ? {
              dependency: "execution-kernel",
              baseUrl: kernelBaseUrl,
              recoveryCommand:
                "cd /Users/martin/infinity/services/execution-kernel && ./scripts/run-local.sh",
              detail,
            }
          : {
              detail,
            },
      });
    });
    console.error("Autonomous orchestration loop failed", {
      initiativeId,
      error,
    });
    return false;
  }
}

function shouldRunAutonomousLoopInline() {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

export async function triggerAutonomousLoopSafely(initiativeId?: string | null) {
  if (!initiativeId) {
    return false;
  }

  if (shouldRunAutonomousLoopInline()) {
    return runAutonomousLoopSafely(initiativeId);
  }

  setTimeout(() => {
    void runAutonomousLoopSafely(initiativeId).catch((error) => {
      console.error("Autonomous orchestration loop trigger failed", {
        initiativeId,
        error,
      });
    });
  }, 0);

  return false;
}
