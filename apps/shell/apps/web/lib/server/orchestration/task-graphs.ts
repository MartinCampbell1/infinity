import type {
  CreateTaskGraphRequest,
  InitiativeRecord,
  ProjectBriefRecord,
  TaskGraphDetailResponse,
  TaskGraphMutationResponse,
  TaskGraphRecord,
  TaskGraphsDirectoryResponse,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";
import {
  appendAutonomousRunEvent,
  findAutonomousRunByInitiativeId,
  materializePlanningEvidence,
  syncAutonomousRunTimeline,
  updateAutonomousRunStage,
} from "./autonomous-run";

import { buildPlannerNotes, planTaskGraphFromBrief } from "./planner";
import { buildOrchestrationDirectoryMeta, nowIso, sortByUpdatedAtDesc } from "./shared";

type PlanningContext = {
  initiative: InitiativeRecord;
  brief: ProjectBriefRecord;
  taskGraph: TaskGraphRecord;
  workUnits: WorkUnitRecord[];
  runnableWorkUnitIds: string[];
};

function cloneTaskGraph(value: TaskGraphRecord) {
  return JSON.parse(JSON.stringify(value)) as TaskGraphRecord;
}

function cloneWorkUnit(value: WorkUnitRecord) {
  return JSON.parse(JSON.stringify(value)) as WorkUnitRecord;
}

export function runnableWorkUnitIdsFromRecords(
  workUnits: readonly WorkUnitRecord[]
) {
  const byId = new Map(workUnits.map((workUnit) => [workUnit.id, workUnit]));

  return sortByUpdatedAtDesc(workUnits)
    .filter((workUnit) => {
      if (workUnit.status !== "ready") {
        return false;
      }

      return workUnit.dependencies.every((dependencyId) => {
        const dependency = byId.get(dependencyId);
        return dependency?.status === "completed";
      });
    })
    .map((workUnit) => workUnit.id);
}

export function reconcileWorkUnitReadiness(
  workUnits: readonly WorkUnitRecord[]
): WorkUnitRecord[] {
  const byId = new Map(workUnits.map((workUnit) => [workUnit.id, workUnit]));

  return workUnits.map((workUnit) => {
    if (workUnit.status !== "queued") {
      return workUnit;
    }

    const ready = workUnit.dependencies.every((dependencyId) => {
      const dependency = byId.get(dependencyId);
      return dependency?.status === "completed";
    });

    return ready
      ? ({
          ...workUnit,
          status: "ready",
          updatedAt: nowIso(),
        } satisfies WorkUnitRecord)
      : workUnit;
  });
}

function deriveTaskGraphStatus(workUnits: readonly WorkUnitRecord[]) {
  if (workUnits.every((workUnit) => workUnit.status === "completed")) {
    return "completed" as const;
  }
  if (workUnits.some((workUnit) => workUnit.status === "failed")) {
    return "failed" as const;
  }
  if (
    workUnits.some((workUnit) =>
      ["running", "dispatched", "blocked", "retryable", "completed"].includes(
        workUnit.status
      )
    )
  ) {
    return "active" as const;
  }
  return "ready" as const;
}

function graphContextFromState(
  taskGraphId: string,
  state: Awaited<ReturnType<typeof readControlPlaneState>>
): PlanningContext | null {
  const taskGraph =
    state.orchestration.taskGraphs.find((candidate) => candidate.id === taskGraphId) ?? null;
  if (!taskGraph) {
    return null;
  }

  const initiative =
    state.orchestration.initiatives.find(
      (candidate) => candidate.id === taskGraph.initiativeId
    ) ?? null;
  const brief =
    state.orchestration.briefs.find((candidate) => candidate.id === taskGraph.briefId) ?? null;

  if (!initiative || !brief) {
    return null;
  }

  const workUnits = reconcileWorkUnitReadiness(
    state.orchestration.workUnits.filter((candidate) => candidate.taskGraphId === taskGraph.id)
  ).map(cloneWorkUnit);

  return {
    initiative: JSON.parse(JSON.stringify(initiative)) as InitiativeRecord,
    brief: JSON.parse(JSON.stringify(brief)) as ProjectBriefRecord,
    taskGraph: cloneTaskGraph({
      ...taskGraph,
      status: deriveTaskGraphStatus(workUnits),
    }),
    workUnits,
    runnableWorkUnitIds: runnableWorkUnitIdsFromRecords(workUnits),
  };
}

export async function listOrchestrationTaskGraphs(filters?: {
  initiativeId?: string | null;
  briefId?: string | null;
}) {
  const state = await readControlPlaneState();
  const taskGraphs = state.orchestration.taskGraphs
    .filter((taskGraph) => {
      if (filters?.initiativeId && taskGraph.initiativeId !== filters.initiativeId) {
        return false;
      }
      if (filters?.briefId && taskGraph.briefId !== filters.briefId) {
        return false;
      }
      return true;
    })
    .map((taskGraph) => {
      const workUnits = reconcileWorkUnitReadiness(
        state.orchestration.workUnits.filter(
          (candidate) => candidate.taskGraphId === taskGraph.id
        )
      );

      return cloneTaskGraph({
        ...taskGraph,
        status: deriveTaskGraphStatus(workUnits),
      });
    });

  return sortByUpdatedAtDesc(taskGraphs);
}

export async function findOrchestrationTaskGraph(taskGraphId: string) {
  return (await listOrchestrationTaskGraphs()).find((taskGraph) => taskGraph.id === taskGraphId) ?? null;
}

export async function findTaskGraphByBriefId(briefId: string) {
  return (await listOrchestrationTaskGraphs({ briefId }))[0] ?? null;
}

export async function buildTaskGraphsDirectoryResponse(filters?: {
  initiativeId?: string | null;
  briefId?: string | null;
}): Promise<TaskGraphsDirectoryResponse> {
  return {
    ...(await buildOrchestrationDirectoryMeta([
      "Task graphs are generated by the shell-owned planner service.",
    ])),
    taskGraphs: await listOrchestrationTaskGraphs(filters),
  };
}

export async function buildTaskGraphDetailResponse(
  taskGraphId: string
): Promise<TaskGraphDetailResponse | null> {
  const state = await readControlPlaneState();
  const context = graphContextFromState(taskGraphId, state);
  if (!context) {
    return null;
  }

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Task graph ${taskGraphId} is resolved from the shell-owned planner slice.`,
      ...buildPlannerNotes(context.workUnits),
    ])),
    taskGraph: context.taskGraph,
    initiative: context.initiative,
    brief: context.brief,
    workUnits: context.workUnits,
    runnableWorkUnitIds: context.runnableWorkUnitIds,
  };
}

export async function buildTaskGraphMutationResponse(
  taskGraphId: string
): Promise<TaskGraphMutationResponse | null> {
  return buildTaskGraphDetailResponse(taskGraphId);
}

async function planTaskGraphForApprovedBrief(briefId: string) {
  const existing = await findTaskGraphByBriefId(briefId);
  if (existing) {
    return buildTaskGraphMutationResponse(existing.id);
  }

  const state = await readControlPlaneState();
  const brief =
    state.orchestration.briefs.find((candidate) => candidate.id === briefId) ?? null;
  if (!brief || brief.status !== "approved") {
    return null;
  }

  const initiative =
    state.orchestration.initiatives.find(
      (candidate) => candidate.id === brief.initiativeId
    ) ?? null;
  if (!initiative) {
    return null;
  }

  const planned = planTaskGraphFromBrief(initiative, brief);

  await updateControlPlaneState((draft) => {
    if (draft.orchestration.taskGraphs.some((candidate) => candidate.briefId === briefId)) {
      return;
    }

    draft.orchestration.taskGraphs = [planned.taskGraph, ...draft.orchestration.taskGraphs];
    draft.orchestration.workUnits = [...planned.workUnits, ...draft.orchestration.workUnits];
    draft.orchestration.initiatives = draft.orchestration.initiatives.map((candidate) =>
      candidate.id === initiative.id
        ? {
            ...candidate,
            status: "planning",
            updatedAt: planned.taskGraph.updatedAt,
          }
        : candidate
    );
    updateAutonomousRunStage(draft, initiative.id, {
      stage: "queued",
    });
    appendAutonomousRunEvent(draft, initiative.id, {
      kind: "planner.started",
      stage: "planning",
      summary: `Planner started for brief ${brief.id}.`,
      payload: {
        briefId: brief.id,
      },
    });
    appendAutonomousRunEvent(draft, initiative.id, {
      kind: "planner.completed",
      stage: "planning",
      summary: `Planner completed for brief ${brief.id}.`,
      payload: {
        briefId: brief.id,
        taskGraphId: planned.taskGraph.id,
      },
    });
    appendAutonomousRunEvent(draft, initiative.id, {
      kind: "taskgraph.created",
      stage: "queued",
      summary: `Task graph ${planned.taskGraph.id} was created.`,
      payload: {
        taskGraphId: planned.taskGraph.id,
        workUnitIds: planned.workUnits.map((workUnit) => workUnit.id),
      },
    });
    appendAutonomousRunEvent(draft, initiative.id, {
      kind: "batches.materialized",
      stage: "queued",
      summary: "Initial batch candidates were materialized from the planner graph.",
      payload: {
        runnableWorkUnitIds: planned.workUnits
          .filter((workUnit) => workUnit.status === "ready")
          .map((workUnit) => workUnit.id),
      },
    });
    appendAutonomousRunEvent(draft, initiative.id, {
      kind: "run.stage.changed",
      stage: "queued",
      summary: "Run advanced from planning to queued.",
      payload: {
        fromStage: "planning",
        toStage: "queued",
      },
    });
  });

  const nextState = await readControlPlaneState();
  const run = findAutonomousRunByInitiativeId(nextState, initiative.id);
  if (run) {
    materializePlanningEvidence(
      run,
      planned.taskGraph,
      planned.workUnits,
      nextState.orchestration.batches.filter(
        (candidate) => candidate.initiativeId === initiative.id
      )
    );
    syncAutonomousRunTimeline(nextState, initiative.id);
  }

  return buildTaskGraphMutationResponse(planned.taskGraph.id);
}

export async function createTaskGraphFromBrief(input: CreateTaskGraphRequest) {
  return planTaskGraphForApprovedBrief(input.briefId);
}
