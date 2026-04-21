import type {
  CreateWorkUnitRequest,
  TaskGraphRecord,
  UpdateWorkUnitRequest,
  WorkUnitDetailResponse,
  WorkUnitMutationResponse,
  WorkUnitRecord,
  WorkUnitsDirectoryResponse,
} from "../control-plane/contracts/orchestration";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";

import {
  buildTaskGraphDetailResponse,
  findOrchestrationTaskGraph,
  reconcileWorkUnitReadiness,
  runnableWorkUnitIdsFromRecords,
} from "./task-graphs";
import {
  buildOrchestrationDirectoryMeta,
  normalizeStringList,
  nowIso,
  sortByUpdatedAtDesc,
  trimRequiredString,
} from "./shared";

function cloneWorkUnit(value: WorkUnitRecord) {
  return JSON.parse(JSON.stringify(value)) as WorkUnitRecord;
}

function cloneTaskGraph(value: TaskGraphRecord | null) {
  return value ? (JSON.parse(JSON.stringify(value)) as TaskGraphRecord) : null;
}

export async function listOrchestrationWorkUnits(filters?: {
  taskGraphId?: string | null;
}) {
  const state = await readControlPlaneState();
  return sortByUpdatedAtDesc(
    state.orchestration.workUnits.filter((workUnit) => {
      if (filters?.taskGraphId && workUnit.taskGraphId !== filters.taskGraphId) {
        return false;
      }
      return true;
    })
  ).map(cloneWorkUnit);
}

export async function findOrchestrationWorkUnit(workUnitId: string) {
  return (await listOrchestrationWorkUnits()).find((workUnit) => workUnit.id === workUnitId) ?? null;
}

async function listGraphAwareWorkUnits(taskGraphId?: string | null) {
  const workUnits = await listOrchestrationWorkUnits({ taskGraphId });
  const reconciled = reconcileWorkUnitReadiness(workUnits);
  return sortByUpdatedAtDesc(reconciled).map(cloneWorkUnit);
}

export async function buildWorkUnitsDirectoryResponse(filters?: {
  taskGraphId?: string | null;
}): Promise<WorkUnitsDirectoryResponse> {
  const workUnits = await listGraphAwareWorkUnits(filters?.taskGraphId);
  return {
    ...(await buildOrchestrationDirectoryMeta([
      "Work units are derived from the shell-owned planner graph and reconcile readiness deterministically.",
    ])),
    workUnits,
    runnableWorkUnitIds: runnableWorkUnitIdsFromRecords(workUnits),
  };
}

export async function buildWorkUnitDetailResponse(
  workUnitId: string
): Promise<WorkUnitDetailResponse | null> {
  const workUnit = await findOrchestrationWorkUnit(workUnitId);
  if (!workUnit) {
    return null;
  }

  const workUnits = await listGraphAwareWorkUnits(workUnit.taskGraphId);
  const resolvedWorkUnit = workUnits.find((candidate) => candidate.id === workUnitId) ?? workUnit;
  const taskGraph = await findOrchestrationTaskGraph(workUnit.taskGraphId);

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Work unit ${workUnitId} is resolved from the shell-owned planner slice.`,
    ])),
    workUnit: resolvedWorkUnit,
    taskGraph: cloneTaskGraph(taskGraph),
    runnableWorkUnitIds: runnableWorkUnitIdsFromRecords(workUnits),
  };
}

export async function buildWorkUnitMutationResponse(
  workUnitId: string
): Promise<WorkUnitMutationResponse | null> {
  return buildWorkUnitDetailResponse(workUnitId);
}

export async function createOrchestrationWorkUnit(input: CreateWorkUnitRequest) {
  const taskGraph = await findOrchestrationTaskGraph(input.taskGraphId);
  if (!taskGraph) {
    return null;
  }

  const occurredAt = nowIso();
  const workUnit: WorkUnitRecord = {
    id: `work-unit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    taskGraphId: input.taskGraphId,
    title: trimRequiredString(input.title),
    description: trimRequiredString(input.description),
    executorType: input.executorType,
    scopePaths: normalizeStringList(input.scopePaths),
    dependencies: normalizeStringList(input.dependencies),
    acceptanceCriteria: normalizeStringList(input.acceptanceCriteria),
    estimatedComplexity: input.estimatedComplexity,
    status: input.status ?? (input.dependencies.length === 0 ? "ready" : "queued"),
    latestAttemptId: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };

  await updateControlPlaneState((draft) => {
    draft.orchestration.workUnits = [workUnit, ...draft.orchestration.workUnits];
    draft.orchestration.taskGraphs = draft.orchestration.taskGraphs.map((candidate) =>
      candidate.id === taskGraph.id
        ? {
            ...candidate,
            nodeIds: [...candidate.nodeIds, workUnit.id],
            updatedAt: occurredAt,
          }
        : candidate
    );
  });

  return buildWorkUnitMutationResponse(workUnit.id);
}

export async function updateOrchestrationWorkUnit(
  workUnitId: string,
  patch: UpdateWorkUnitRequest
) {
  let updatedTaskGraphId: string | null = null;
  const occurredAt = nowIso();

  await updateControlPlaneState((draft) => {
    const current = draft.orchestration.workUnits.find((candidate) => candidate.id === workUnitId);
    if (!current) {
      return;
    }

    updatedTaskGraphId = current.taskGraphId;

    draft.orchestration.workUnits = reconcileWorkUnitReadiness(
      draft.orchestration.workUnits.map((candidate): WorkUnitRecord => {
        if (candidate.id !== workUnitId) {
          return candidate;
        }

        return {
          ...candidate,
          title: patch.title !== undefined ? trimRequiredString(patch.title) : candidate.title,
          description:
            patch.description !== undefined
              ? trimRequiredString(patch.description)
              : candidate.description,
          executorType: patch.executorType ?? candidate.executorType,
          scopePaths:
            patch.scopePaths !== undefined
              ? normalizeStringList(patch.scopePaths)
              : candidate.scopePaths,
          dependencies:
            patch.dependencies !== undefined
              ? normalizeStringList(patch.dependencies)
              : candidate.dependencies,
          acceptanceCriteria:
            patch.acceptanceCriteria !== undefined
              ? normalizeStringList(patch.acceptanceCriteria)
              : candidate.acceptanceCriteria,
          estimatedComplexity: patch.estimatedComplexity ?? candidate.estimatedComplexity,
          status: patch.status ?? candidate.status,
          latestAttemptId:
            patch.latestAttemptId !== undefined
              ? patch.latestAttemptId
              : candidate.latestAttemptId ?? null,
          updatedAt: occurredAt,
        };
      })
    );
    draft.orchestration.taskGraphs = draft.orchestration.taskGraphs.map((candidate) =>
      candidate.id === updatedTaskGraphId
        ? {
            ...candidate,
            updatedAt: occurredAt,
          }
        : candidate
    );
  });

  if (!updatedTaskGraphId) {
    return null;
  }

  const detail = await buildTaskGraphDetailResponse(updatedTaskGraphId);
  if (!detail) {
    return null;
  }

  const workUnit = detail.workUnits.find((candidate) => candidate.id === workUnitId);
  if (!workUnit) {
    return null;
  }

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Work unit ${workUnitId} was updated through the shell-owned planner slice.`,
    ])),
    workUnit,
    taskGraph: detail.taskGraph,
    runnableWorkUnitIds: detail.runnableWorkUnitIds,
  } satisfies WorkUnitMutationResponse;
}
