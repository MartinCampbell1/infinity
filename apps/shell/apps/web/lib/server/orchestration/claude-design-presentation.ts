import { buildExecutionRunScopeHref, type ShellRouteScope } from "../../route-scope";
import type { ControlPlaneState } from "../control-plane/state/types";
import { listAutonomousRuns } from "./autonomous-run";

export type ClaudeDisplayTask = {
  id: string;
  code: string;
  tag: string;
  title: string;
  agent: string;
  status: string;
  pct: number;
  attempts: string;
  value: number;
  total: number;
};

type DisplayRun = {
  actualRunId?: string | null;
  actualInitiativeId?: string | null;
  displayId: string;
  title: string;
  stage: string;
  preview: string;
  tasks: string;
  agent: string;
  updated: string;
  group: "running" | "attention" | "completed";
  attempts: string;
  repo: string;
  assignment: string;
  backend: string;
  sessions: number;
  startedAt: string;
  workspacePath: string;
  featured?: boolean;
  requestedBy?: string;
  workspace?: string | null;
  taskItems?: ClaudeDisplayTask[];
};

export type FrontdoorRecentRunCard = {
  id: string;
  title: string;
  status: string;
  updatedLabel: string;
  href: string;
};

type DisplayRunGroup = "running" | "attention" | "completed";

export const CLAUDE_HABIT_RUN_TASKS: ClaudeDisplayTask[] = [
  {
    id: "task-habit-api",
    code: "t05",
    tag: "habit_api",
    title: "Habit CRUD routes + zod validators",
    agent: "implementer",
    status: "completed",
    pct: 100,
    attempts: "1/1",
    value: 1,
    total: 1,
  },
  {
    id: "task-auth",
    code: "t04",
    tag: "auth",
    title: "Supabase auth + row-level security policies",
    agent: "implementer",
    status: "completed",
    pct: 100,
    attempts: "1/1",
    value: 1,
    total: 1,
  },
  {
    id: "task-schema",
    code: "t03",
    tag: "schema",
    title: "Postgres schema — habits, entries, streaks",
    agent: "droid",
    status: "completed",
    pct: 100,
    attempts: "1/1",
    value: 1,
    total: 1,
  },
  {
    id: "task-streaks",
    code: "t06",
    tag: "streaks",
    title: "Streak computation — rolling windows + weekly insights",
    agent: "implementer",
    status: "running",
    pct: 72,
    attempts: "1/2",
    value: 1,
    total: 2,
  },
  {
    id: "task-preview",
    code: "t12",
    tag: "preview",
    title: "Vercel preview deployment + smoke test",
    agent: "task-runner",
    status: "running",
    pct: 34,
    attempts: "0/0",
    value: 0,
    total: 1,
  },
  {
    id: "task-notifications",
    code: "t08",
    tag: "notifications",
    title: "Notification scheduler — per-habit cron with quiet hrs",
    agent: "task-runner",
    status: "completed",
    pct: 100,
    attempts: "1/1",
    value: 1,
    total: 1,
  },
];

function fallbackRunHref(
  routeScope: ShellRouteScope | undefined,
  initiativeId: string | null | undefined
) {
  if (!initiativeId) {
    return null;
  }
  return buildExecutionRunScopeHref(initiativeId, routeScope);
}

function firstInitiative(state: ControlPlaneState, initiativeId: string) {
  return state.orchestration.initiatives.find((initiative) => initiative.id === initiativeId) ?? null;
}

function latestTaskGraph(state: ControlPlaneState, initiativeId: string) {
  return [...state.orchestration.taskGraphs]
    .filter((taskGraph) => taskGraph.initiativeId === initiativeId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

function latestDelivery(state: ControlPlaneState, initiativeId: string) {
  return [...state.orchestration.deliveries]
    .filter((delivery) => delivery.initiativeId === initiativeId)
    .sort((left, right) => (right.deliveredAt ?? right.id).localeCompare(left.deliveredAt ?? left.id))[0] ?? null;
}

function latestAssembly(state: ControlPlaneState, initiativeId: string) {
  return [...state.orchestration.assemblies]
    .filter((assembly) => assembly.initiativeId === initiativeId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

function taskStatus(workUnitStatus: string) {
  if (workUnitStatus === "completed") {
    return "completed";
  }
  if (workUnitStatus === "blocked" || workUnitStatus === "retryable" || workUnitStatus === "failed") {
    return "blocked";
  }
  return "running";
}

function stageFromRun(state: ControlPlaneState, initiativeId: string, runStage: string) {
  const initiative = firstInitiative(state, initiativeId);
  if (initiative?.status) {
    return initiative.status;
  }

  const mapping: Record<string, string> = {
    specing: "clarifying",
    planning: "planning",
    queued: "planning",
    executing: "running",
    assembling: "assembly",
    verifying: "verifying",
    delivering: "verifying",
    preview_ready: "ready",
    handed_off: "ready",
    blocked: "blocked",
    failed: "failed",
    cancelled: "cancelled",
    intake: "clarifying",
  };
  return mapping[runStage] ?? runStage;
}

function previewLabel(runPreviewStatus: string, deliveryKind: string | null | undefined, deliveryStatus: string | null | undefined) {
  if (deliveryKind === "runnable_result" && deliveryStatus === "ready") {
    return "localhost";
  }
  if (deliveryKind === "attempt_scaffold") {
    return "scaffold";
  }
  if (runPreviewStatus === "ready") {
    return "preview";
  }
  if (runPreviewStatus === "building") {
    return "building";
  }
  if (runPreviewStatus === "failed") {
    return "failed";
  }
  return "none";
}

function groupForDisplayStage(stage: string, health: string): DisplayRunGroup {
  if (stage === "ready" || stage === "completed" || stage === "preview_ready" || stage === "handed_off") {
    return "completed";
  }
  if (
    stage === "blocked" ||
    stage === "failed" ||
    stage === "cancelled" ||
    stage === "retryable" ||
    health === "blocked" ||
    health === "failed"
  ) {
    return "attention";
  }
  return "running";
}

function workspacePathForRun(
  deliveryPath: string | null | undefined,
  assemblyPath: string | null | undefined,
  scopePath: string | null | undefined
) {
  return deliveryPath ?? assemblyPath ?? scopePath ?? null;
}

function relativeAge(value: string, suffix: boolean) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) {
    return suffix ? "recently" : "recent";
  }

  const deltaSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (deltaSeconds < 60) {
    return suffix ? `${deltaSeconds}s ago` : `${deltaSeconds}s`;
  }
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return suffix ? `${deltaMinutes}m ago` : `${deltaMinutes}m`;
  }
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return suffix ? `${deltaHours}h ago` : `${deltaHours}h`;
  }
  const deltaDays = Math.floor(deltaHours / 24);
  return suffix ? `${deltaDays}d ago` : `${deltaDays}d`;
}

function taskItemsForInitiative(state: ControlPlaneState, initiativeId: string): ClaudeDisplayTask[] {
  const taskGraph = latestTaskGraph(state, initiativeId);
  if (!taskGraph) {
    return [];
  }

  return state.orchestration.workUnits
    .filter((workUnit) => workUnit.taskGraphId === taskGraph.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((workUnit, index) => {
      const status = taskStatus(workUnit.status);
      return {
        id: workUnit.id,
        code: `t${String(index + 1).padStart(2, "0")}`,
        tag: workUnit.id.split("-").at(-1) ?? "task",
        title: workUnit.title,
        agent: workUnit.executorType,
        status,
        pct: status === "completed" ? 100 : status === "blocked" ? 20 : 55,
        attempts: workUnit.latestAttemptId ? (status === "completed" ? "1/1" : "1/2") : "0/0",
        value: status === "completed" ? 1 : 0,
        total: 1,
      };
    });
}

export function getClaudeDisplayRunId(runId: string | null | undefined) {
  if (!runId) {
    return "run";
  }

  const mapping: Record<string, string> = {
    "run-1776694558235-b174rlaq": "hb4mq7",
    "run-1776692809111-fhobsn92": "wvn4z3",
    "run-1776692650934-y8ubjqm6": "q7xdh1",
    "run-1776689179469-j61mlmln": "7hk2m8",
    "run-1776688410867-j6l9cewa": "bv4x9q",
    "run-1776687601791-bksymcoe": "r1m3g8",
    "run-1776687210225-p5gqon56": "c9k4n1",
    "run-1776685933761-xwrkkve6": "dy5fb0",
    "display-passive-sessions": "f7na3k",
  };

  return mapping[runId] ?? ((runId.split("-").at(-1) ?? runId).slice(0, 6));
}

export function buildClaudeDesignRunsBoardItems(
  state: ControlPlaneState,
  routeScope?: ShellRouteScope
) {
  return listAutonomousRuns(state).map((run, index) => {
    const initiative = firstInitiative(state, run.initiativeId);
    const taskGraph = latestTaskGraph(state, run.initiativeId);
    const workUnits = taskGraph
      ? state.orchestration.workUnits.filter((workUnit) => workUnit.taskGraphId === taskGraph.id)
      : [];
    const completedUnits = workUnits.filter((workUnit) => workUnit.status === "completed").length;
    const delivery = latestDelivery(state, run.initiativeId);
    const assembly = latestAssembly(state, run.initiativeId);
    const displayStage = stageFromRun(state, run.initiativeId, run.currentStage);
    const leadWorkUnit =
      workUnits.find((workUnit) => workUnit.status !== "completed") ?? workUnits[0] ?? null;
    const agentSessions = state.orchestration.agentSessions.filter(
      (session) => session.runId === run.id
    );

    return {
      id: run.id,
      displayId: getClaudeDisplayRunId(run.id),
      title: initiative?.title ?? run.title,
      prompt: initiative?.userRequest ?? run.originalPrompt,
      stage: displayStage,
      health: run.health,
      preview: previewLabel(run.previewStatus, delivery?.launchProofKind, delivery?.status),
      handoff: run.handoffStatus,
      updated: relativeAge(run.updatedAt, false),
      tasks: `${completedUnits} / ${workUnits.length}`,
      agent: leadWorkUnit?.executorType ?? "worker",
      requestedBy: initiative?.requestedBy ?? "martin",
      workspace: initiative?.workspaceSessionId ?? null,
      sessions: agentSessions.length,
      startedAt: run.createdAt,
      repo: "infinity",
      assignment: leadWorkUnit?.executorType ?? "worker",
      backend: leadWorkUnit ? `${leadWorkUnit.executorType} runtime` : "shell runtime",
      attempts: leadWorkUnit?.latestAttemptId ? "1/1" : null,
      workspacePath: workspacePathForRun(
        delivery?.localOutputPath,
        assembly?.outputLocation,
        leadWorkUnit?.scopePaths[0] ?? null
      ),
      href: fallbackRunHref(routeScope, run.initiativeId) ?? "/execution/runs",
      group: groupForDisplayStage(displayStage, run.health),
      featured: index === 0,
      taskItems: taskItemsForInitiative(state, run.initiativeId),
    };
  });
}

export function buildClaudeDesignFrontdoorRecentRuns(
  state: ControlPlaneState,
  routeScope?: ShellRouteScope
): FrontdoorRecentRunCard[] {
  return listAutonomousRuns(state)
    .slice(0, 5)
    .map((run) => {
      const initiative = firstInitiative(state, run.initiativeId);
      return {
        id: getClaudeDisplayRunId(run.id),
        title: initiative?.title ?? run.title,
        status: stageFromRun(state, run.initiativeId, run.currentStage),
        updatedLabel: relativeAge(run.updatedAt, true),
        href: buildExecutionRunScopeHref(run.initiativeId, routeScope),
      };
    });
}
