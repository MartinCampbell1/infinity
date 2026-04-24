import {
  createExecutionKernelClient,
  type ExecutionKernelAttemptRecord,
} from "@founderos/api-clients";

import type {
  AttemptRecord,
  CreateExecutionBatchRequest,
  ExecutionBatchDetailResponse,
  ExecutionBatchMutationResponse,
  ExecutionBatchRecord,
  ExecutionBatchesDirectoryResponse,
  TaskGraphRecord,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";

import { buildTaskGraphDetailResponse } from "./task-graphs";
import {
  appendAutonomousRunEvent,
  findAutonomousRunByInitiativeId,
  materializeExecutionEvidence,
  syncAutonomousRunTimeline,
  updateAutonomousRunStage,
  upsertAgentSessionRecord,
} from "./autonomous-run";
import {
  buildOrchestrationDirectoryMeta,
  buildOrchestrationId,
  nowIso,
} from "./shared";
import { buildSupervisorActionRecord, cloneSupervisorAction } from "./supervisor-shared";

const DEFAULT_EXECUTION_KERNEL_BASE_URL = "http://127.0.0.1:8798";
export const EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY =
  "FOUNDEROS_EXECUTION_KERNEL_SERVICE_AUTH_SECRET";
export const LEGACY_EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY =
  "EXECUTION_KERNEL_SERVICE_AUTH_SECRET";

export type ExecutionKernelAvailability = {
  available: boolean;
  baseUrl: string;
  detail: string;
  generatedAt?: string | null;
  authMode?: string | null;
  deploymentScope?: string | null;
  maturity?: string | null;
  storageKind?: string | null;
  durabilityTier?: string | null;
  statePath?: string | null;
  stateConfigured?: boolean | null;
  runtimeState?: string | null;
  recoveryState?: string | null;
  restartRecoverable?: boolean | null;
  failureState?: string | null;
  blockedBatchIds?: string[] | null;
  failedAttemptIds?: string[] | null;
  resumableBatchIds?: string[] | null;
  latestFailure?: {
    attemptId: string;
    batchId?: string | null;
    workUnitId: string;
    errorCode?: string | null;
    errorSummary?: string | null;
    finishedAt?: string | null;
  } | null;
  recoveryHint?: string | null;
};

function cloneBatch(value: ExecutionBatchRecord) {
  return JSON.parse(JSON.stringify(value)) as ExecutionBatchRecord;
}

export function resolveExecutionKernelBaseUrl() {
  const explicit = process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL?.trim();
  if (explicit) {
    return explicit;
  }
  const fallback = process.env.MULTICA_KERNEL_BASE_URL?.trim();
  if (fallback) {
    return fallback;
  }
  return DEFAULT_EXECUTION_KERNEL_BASE_URL;
}

function resolveExecutionKernelServiceAuth() {
  const secret =
    process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY]?.trim() ||
    process.env[LEGACY_EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY]?.trim();
  if (!secret) {
    return null;
  }
  return { secret };
}

export function createServerExecutionKernelClient() {
  return createExecutionKernelClient({
    baseUrl: resolveExecutionKernelBaseUrl(),
    serviceAuth: resolveExecutionKernelServiceAuth(),
  });
}

export async function getExecutionKernelAvailability(): Promise<ExecutionKernelAvailability> {
  const baseUrl = resolveExecutionKernelBaseUrl();
  const kernel = createServerExecutionKernelClient();

  try {
    const health = await kernel.getHealth();
    return {
      available: true,
      baseUrl,
      detail: health.detail?.trim() || `${health.service} is reachable.`,
      generatedAt: health.generatedAt,
      authMode: health.authMode ?? null,
      deploymentScope: health.deploymentScope ?? null,
      maturity: health.maturity ?? null,
      storageKind: health.storageKind ?? null,
      durabilityTier: health.durabilityTier ?? null,
      statePath: health.statePath ?? null,
      stateConfigured: health.stateConfigured ?? null,
      runtimeState: health.runtimeState ?? null,
      recoveryState: health.recoveryState ?? null,
      restartRecoverable: health.restartRecoverable ?? null,
      failureState: health.failureState ?? null,
      blockedBatchIds: health.blockedBatchIds ?? null,
      failedAttemptIds: health.failedAttemptIds ?? null,
      resumableBatchIds: health.resumableBatchIds ?? null,
      latestFailure: health.latestFailure ?? null,
      recoveryHint: health.recoveryHint ?? null,
    };
  } catch (error) {
    const cause =
      error && typeof error === "object" && "cause" in error
        ? (error as { cause?: { code?: string } }).cause
        : null;
    const message =
      cause?.code === "ECONNREFUSED"
        ? `Kernel is offline at ${baseUrl}. Start ./services/execution-kernel/scripts/run-local.sh before launching autonomous runs.`
        : error instanceof Error
          ? error.message
          : `Kernel is unavailable at ${baseUrl}.`;

    return {
      available: false,
      baseUrl,
      detail: message,
      generatedAt: null,
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
    };
  }
}

export async function listSupervisorActionsForBatch(batchId: string) {
  const state = await readControlPlaneState();
  return [...state.orchestration.supervisorActions]
    .filter((action) => action.batchId === batchId)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .map(cloneSupervisorAction);
}

function toAttemptRecord(value: ExecutionKernelAttemptRecord): AttemptRecord {
  return {
    id: value.id,
    workUnitId: value.workUnitId,
    batchId: value.batchId ?? null,
    executorType: value.executorType,
    status: value.status,
    attemptNumber: value.attemptNumber,
    parentAttemptId: value.parentAttemptId ?? null,
    retryReason: value.retryReason ?? null,
    retryBackoffUntil: value.retryBackoffUntil ?? null,
    startedAt: value.startedAt,
    finishedAt: value.finishedAt ?? null,
    summary: value.summary ?? null,
    artifactUris: value.artifactUris,
    errorCode: value.errorCode ?? null,
    errorSummary: value.errorSummary ?? null,
    leaseHolder: value.leaseHolder ?? null,
    leaseExpiresAt: value.leaseExpiresAt ?? null,
    lastHeartbeatAt: value.lastHeartbeatAt ?? null,
  };
}

function workUnitStatusForAttemptStatus(status: ExecutionKernelAttemptRecord["status"]) {
  if (status === "completed" || status === "succeeded") {
    return "completed" as const;
  }
  if (status === "failed") {
    return "retryable" as const;
  }
  if (status === "blocked") {
    return "blocked" as const;
  }
  if (status === "canceled" || status === "abandoned") {
    return "failed" as const;
  }
  if (status === "leased" || status === "running" || status === "started") {
    return "running" as const;
  }
  return "queued" as const;
}

function isActiveKernelAttempt(status: ExecutionKernelAttemptRecord["status"]) {
  return status === "leased" || status === "running" || status === "started";
}

async function readTaskGraphContext(taskGraphId: string) {
  const detail = await buildTaskGraphDetailResponse(taskGraphId);
  if (!detail || !detail.initiative) {
    return null;
  }

  return {
    taskGraph: detail.taskGraph,
    initiative: detail.initiative,
    workUnits: detail.workUnits,
    runnableWorkUnitIds: detail.runnableWorkUnitIds,
  };
}

export async function listExecutionBatches(filters?: {
  initiativeId?: string | null;
  taskGraphId?: string | null;
}) {
  const state = await readControlPlaneState();
  return [...state.orchestration.batches]
    .filter((batch) => {
      if (filters?.initiativeId && batch.initiativeId !== filters.initiativeId) {
        return false;
      }
      if (filters?.taskGraphId && batch.taskGraphId !== filters.taskGraphId) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const leftAt = left.startedAt ?? left.finishedAt ?? left.id;
      const rightAt = right.startedAt ?? right.finishedAt ?? right.id;
      return rightAt.localeCompare(leftAt);
    })
    .map(cloneBatch);
}

export async function findExecutionBatch(batchId: string) {
  return (await listExecutionBatches()).find((batch) => batch.id === batchId) ?? null;
}

export async function buildExecutionBatchesDirectoryResponse(filters?: {
  initiativeId?: string | null;
  taskGraphId?: string | null;
}): Promise<ExecutionBatchesDirectoryResponse> {
  return {
    ...(await buildOrchestrationDirectoryMeta([
      "Batches are persisted in the shell and launched through the typed execution-kernel client.",
    ])),
    batches: await listExecutionBatches(filters),
  };
}

export async function buildExecutionBatchDetailResponse(
  batchId: string
): Promise<ExecutionBatchDetailResponse | null> {
  const batch = await findExecutionBatch(batchId);
  if (!batch) {
    return null;
  }

  const taskGraphDetail = await buildTaskGraphDetailResponse(batch.taskGraphId);
  const taskGraph = taskGraphDetail?.taskGraph ?? null;
  const workUnits =
    taskGraphDetail?.workUnits.filter((workUnit) => batch.workUnitIds.includes(workUnit.id)) ?? [];

  const kernel = createServerExecutionKernelClient();
  const kernelBatch = await kernel.getBatch(batchId);
  const attempts = kernelBatch.attempts.map(toAttemptRecord);
  const supervisorActions = await listSupervisorActionsForBatch(batchId);

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Batch ${batchId} is persisted in the shell and enriched from the execution kernel.`,
    ])),
    batch,
    taskGraph,
    workUnits,
    attempts,
    supervisorActions,
  };
}

export async function createExecutionBatch(input: CreateExecutionBatchRequest) {
  const context = await readTaskGraphContext(input.taskGraphId);
  if (!context) {
    return null;
  }

  const selectedWorkUnits = (
    input.workUnitIds && input.workUnitIds.length > 0
      ? context.workUnits.filter((workUnit) => input.workUnitIds?.includes(workUnit.id))
      : context.workUnits.filter((workUnit) =>
          context.runnableWorkUnitIds.includes(workUnit.id)
        )
  ) as WorkUnitRecord[];

  if (
    input.workUnitIds &&
    input.workUnitIds.length > 0 &&
    selectedWorkUnits.length !== input.workUnitIds.length
  ) {
    const foundIds = new Set(selectedWorkUnits.map((workUnit) => workUnit.id));
    const missingIds = input.workUnitIds.filter((workUnitId) => !foundIds.has(workUnitId));
    throw new Error(
      `Task graph ${context.taskGraph.id} does not contain requested work units: ${missingIds.join(", ")}`
    );
  }

  if (selectedWorkUnits.length === 0) {
    return null;
  }

  const batchId = buildOrchestrationId("batch");
  const kernel = createServerExecutionKernelClient();
  const launched = await kernel.launchBatch({
    batchId,
    initiativeId: context.initiative.id,
    taskGraphId: context.taskGraph.id,
    concurrencyLimit: input.concurrencyLimit ?? 1,
    workUnits: selectedWorkUnits.map((workUnit) => ({
      id: workUnit.id,
      title: workUnit.title,
      description: workUnit.description,
      executorType: workUnit.executorType,
      scopePaths: workUnit.scopePaths,
      dependencies: workUnit.dependencies,
      acceptanceCriteria: workUnit.acceptanceCriteria,
      retryPolicy: workUnit.retryPolicy ?? {
        maxAttempts: 3,
        backoffSeconds: 0,
        executorPreference: [workUnit.executorType],
        failureClassification: "operator_retryable",
      },
    })),
  });

  const batch: ExecutionBatchRecord = {
    id: launched.batch.id,
    initiativeId: launched.batch.initiativeId,
    taskGraphId: launched.batch.taskGraphId,
    workUnitIds: launched.batch.workUnitIds,
    concurrencyLimit: launched.batch.concurrencyLimit,
    status: launched.batch.status,
    startedAt: launched.batch.startedAt ?? null,
    finishedAt: launched.batch.finishedAt ?? null,
  };

  const queuedAction = buildSupervisorActionRecord({
    batchId: batch.id,
    initiativeId: batch.initiativeId,
    taskGraphId: batch.taskGraphId,
    actionKind: "batch.queued",
    actorType: "system",
    actorId: "founderos-shell",
    summary: `Batch ${batch.id} queued for dispatch.`,
    fromStatus: null,
    toStatus: "queued",
  });

  const dispatchedAction = buildSupervisorActionRecord({
    batchId: batch.id,
    initiativeId: batch.initiativeId,
    taskGraphId: batch.taskGraphId,
    actionKind: "batch.dispatched",
    actorType: "system",
    actorId: "founderos-shell",
    summary: `Batch ${batch.id} dispatched to the execution kernel.`,
    fromStatus: "queued",
    toStatus: batch.status,
  });

  const occurredAt = batch.startedAt ?? nowIso();
  const attemptByWorkUnit = new Map(
    launched.attempts.map((attempt) => [attempt.workUnitId, attempt] as const)
  );
  const launchedWorkUnits = selectedWorkUnits.map((workUnit) => ({
    ...workUnit,
    status: workUnitStatusForAttemptStatus(
      attemptByWorkUnit.get(workUnit.id)?.status ?? "queued"
    ),
    latestAttemptId: attemptByWorkUnit.get(workUnit.id)?.id ?? workUnit.latestAttemptId ?? null,
    updatedAt: occurredAt,
  }));

  await updateControlPlaneState((draft) => {
    draft.orchestration.batches = [batch, ...draft.orchestration.batches];
    draft.orchestration.workUnits = draft.orchestration.workUnits.map((candidate) =>
      launchedWorkUnits.find((workUnit) => workUnit.id === candidate.id) ?? candidate
    );
    draft.orchestration.taskGraphs = draft.orchestration.taskGraphs.map((candidate) =>
      candidate.id === batch.taskGraphId
        ? {
            ...candidate,
            updatedAt: occurredAt,
          }
        : candidate
    );
    draft.orchestration.initiatives = draft.orchestration.initiatives.map((candidate) =>
      candidate.id === batch.initiativeId
        ? {
            ...candidate,
            status: "running",
            updatedAt: occurredAt,
          }
        : candidate
    );
    draft.orchestration.supervisorActions = [
      dispatchedAction,
      queuedAction,
      ...draft.orchestration.supervisorActions,
    ];
    updateAutonomousRunStage(draft, batch.initiativeId, {
      stage: "executing",
      health: "healthy",
    });
    launched.attempts
      .filter((attempt) => isActiveKernelAttempt(attempt.status))
      .forEach((attempt) => {
        upsertAgentSessionRecord(draft, batch.initiativeId, {
          batchId: batch.id,
          workItemId: attempt.workUnitId,
          attemptId: attempt.id,
          status: "running",
          runtimeRef: attempt.id,
        });
      });
    appendAutonomousRunEvent(draft, batch.initiativeId, {
      kind: "batch.queued",
      stage: "queued",
      summary: `Batch ${batch.id} queued.`,
      payload: {
        batchId: batch.id,
        workUnitIds: batch.workUnitIds,
      },
    });
    appendAutonomousRunEvent(draft, batch.initiativeId, {
      kind: "batch.started",
      stage: "executing",
      summary: `Batch ${batch.id} started.`,
      payload: {
        batchId: batch.id,
        workUnitIds: batch.workUnitIds,
      },
    });
    launched.attempts
      .filter((attempt) => isActiveKernelAttempt(attempt.status))
      .forEach((attempt) => {
        appendAutonomousRunEvent(draft, batch.initiativeId, {
          kind: "agent.started",
          stage: "executing",
          summary: `Agent attempt ${attempt.id} started for ${attempt.workUnitId}.`,
          payload: {
            batchId: batch.id,
            workUnitId: attempt.workUnitId,
            attemptId: attempt.id,
            executorType: attempt.executorType,
          },
        });
      });
  });

  const nextState = await readControlPlaneState();
  const run = findAutonomousRunByInitiativeId(nextState, batch.initiativeId);
  if (run) {
    const agentSessions = nextState.orchestration.agentSessions.filter(
      (candidate) => candidate.batchId === batch.id
    );
    materializeExecutionEvidence(run, batch, launchedWorkUnits, agentSessions);
    syncAutonomousRunTimeline(nextState, batch.initiativeId);
  }

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Batch ${batch.id} was created in the shell and dispatched to the execution kernel.`,
    ])),
    batch,
    taskGraph: context.taskGraph as TaskGraphRecord,
    workUnits: launchedWorkUnits,
    attempts: launched.attempts.map(toAttemptRecord),
    supervisorActions: [dispatchedAction, queuedAction],
  } satisfies ExecutionBatchMutationResponse;
}
