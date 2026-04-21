import { buildExecutionRunScopeHref, type ShellRouteScope } from "@/lib/route-scope";
import type { ControlPlaneState } from "../control-plane/state/types";

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
  const rows: DisplayRun[] = [
    {
      actualRunId: "run-1776694558235-b174rlaq",
      actualInitiativeId: "initiative-1776694558232-k5xf24ym",
      displayId: "hb4mq7",
      title: "Habit tracker — streaks, weekly insights, notifications",
      stage: "clarifying",
      preview: "none",
      tasks: "0 / 12",
      agent: "implementer",
      updated: "20s",
      group: "running",
      attempts: "1/3",
      repo: "habit-runway",
      assignment: "implementer",
      backend: "codex · gpt-5.1 · high",
      sessions: 3,
      startedAt: "Apr 21, 12:38 PM",
      workspacePath: "~/worktrees/infinity/hb4mq7",
      featured: true,
      requestedBy: "martin",
      workspace: "session-2026-04-11-001",
      taskItems: CLAUDE_HABIT_RUN_TASKS,
    },
    {
      actualRunId: "run-1776692809111-fhobsn92",
      actualInitiativeId: "initiative-1776692809107-v182kvc5",
      displayId: "wvn4z3",
      title: "Add real-time collaborative editing to doc surface",
      stage: "running",
      preview: "building",
      tasks: "8 / 13",
      agent: "implementer",
      updated: "48s",
      group: "running",
      attempts: "1/3",
      repo: "habit-runway",
      assignment: "implementer",
      backend: "codex · gpt-5.1 · high",
      sessions: 2,
      startedAt: "Apr 21, 12:37 PM",
      workspacePath: "~/worktrees/infinity/wvn4z3",
    },
    {
      actualRunId: "run-1776692650934-y8ubjqm6",
      actualInitiativeId: "initiative-1776692650931-10l0jkmm",
      displayId: "q7xdh1",
      title: "Recovery review surface with approval routing",
      stage: "verifying",
      preview: "ready",
      tasks: "11 / 14",
      agent: "planner",
      updated: "2m",
      group: "running",
      attempts: "1/3",
      repo: "habit-runway",
      assignment: "planner",
      backend: "codex · gpt-5.1 · high",
      sessions: 1,
      startedAt: "Apr 21, 12:36 PM",
      workspacePath: "~/worktrees/infinity/q7xdh1",
    },
    {
      actualRunId: "run-1776689179469-j61mlmln",
      actualInitiativeId: "initiative-1776689179464-i9bxyguz",
      displayId: "7hk2m8",
      title: "Dedupe initiative search index on backfill",
      stage: "retryable",
      preview: "none",
      tasks: "4 / 9",
      agent: "task-runner",
      updated: "6m",
      group: "attention",
      attempts: "1/2",
      repo: "habit-runway",
      assignment: "task-runner",
      backend: "codex · gpt-5.1 · high",
      sessions: 1,
      startedAt: "Apr 21, 12:32 PM",
      workspacePath: "~/worktrees/infinity/7hk2m8",
    },
    {
      actualRunId: "run-1776688410867-j6l9cewa",
      actualInitiativeId: "initiative-1776688410865-vh5g5o4n",
      displayId: "bv4x9q",
      title: "Delivery handoff template for docs-only outputs",
      stage: "blocked",
      preview: "none",
      tasks: "1 / 5",
      agent: "planner",
      updated: "11m",
      group: "attention",
      attempts: "1/3",
      repo: "habit-runway",
      assignment: "planner",
      backend: "codex · gpt-5.1 · high",
      sessions: 1,
      startedAt: "Apr 21, 12:27 PM",
      workspacePath: "~/worktrees/infinity/bv4x9q",
    },
    {
      actualRunId: "run-1776687601791-bksymcoe",
      actualInitiativeId: "initiative-1776687601787-2qhodzm2",
      displayId: "r1m3g8",
      title: "Prompt library ingestion with tag normalization",
      stage: "ready",
      preview: "localhost",
      tasks: "14 / 14",
      agent: "implementer",
      updated: "28m",
      group: "completed",
      attempts: "1/1",
      repo: "habit-runway",
      assignment: "implementer",
      backend: "codex · gpt-5.1 · high",
      sessions: 1,
      startedAt: "Apr 21, 12:10 PM",
      workspacePath: "~/worktrees/infinity/r1m3g8",
    },
    {
      actualRunId: "run-1776687210225-p5gqon56",
      actualInitiativeId: "initiative-1776687210223-9nxrx0uo",
      displayId: "c9k4n1",
      title: "Runs board density pass + keyboard navigation",
      stage: "completed",
      preview: "delivered",
      tasks: "16 / 16",
      agent: "task-runner",
      updated: "1h",
      group: "completed",
      attempts: "1/1",
      repo: "habit-runway",
      assignment: "task-runner",
      backend: "codex · gpt-5.1 · high",
      sessions: 1,
      startedAt: "Apr 21, 11:38 AM",
      workspacePath: "~/worktrees/infinity/c9k4n1",
    },
    {
      actualRunId: "run-1776685933761-xwrkkve6",
      actualInitiativeId: "initiative-1776685933760-xb9alzg0",
      displayId: "dy5fb0",
      title: "Attachment group view redesign",
      stage: "completed",
      preview: "delivered",
      tasks: "12 / 12",
      agent: "code-review",
      updated: "3h",
      group: "completed",
      attempts: "1/1",
      repo: "habit-runway",
      assignment: "code-review",
      backend: "codex · gpt-5.1 · high",
      sessions: 1,
      startedAt: "Apr 21, 09:41 AM",
      workspacePath: "~/worktrees/infinity/dy5fb0",
    },
    {
      actualRunId: "display-passive-sessions",
      actualInitiativeId: null,
      displayId: "f7na3k",
      title: "Passive session IDs for idle workers",
      stage: "completed",
      preview: "delivered",
      tasks: "13 / 13",
      agent: "task-runner",
      updated: "6h",
      group: "completed",
      attempts: "1/1",
      repo: "habit-runway",
      assignment: "task-runner",
      backend: "codex · gpt-5.1 · high",
      sessions: 1,
      startedAt: "Apr 21, 06:25 AM",
      workspacePath: "~/worktrees/infinity/f7na3k",
    },
  ];

  return rows.map((row) => {
    const run = row.actualRunId ? state.orchestration.runs.find((item) => item.id === row.actualRunId) ?? null : null;
    const initiative = row.actualInitiativeId ? firstInitiative(state, row.actualInitiativeId) : null;

    return {
      id: run?.id ?? row.actualRunId ?? row.displayId,
      displayId: row.displayId,
      title: row.title,
      prompt: initiative?.userRequest ?? row.title,
      stage: row.stage,
      health: row.group === "attention" ? "blocked" : "healthy",
      preview: row.preview,
      handoff: row.group === "completed" ? "ready" : "none",
      updated: row.updated,
      tasks: row.tasks,
      agent: row.agent,
      requestedBy: row.requestedBy ?? initiative?.requestedBy ?? "martin",
      workspace: row.workspace ?? initiative?.workspaceSessionId ?? null,
      sessions: row.sessions,
      startedAt: run?.createdAt ?? row.startedAt,
      repo: row.repo,
      assignment: row.assignment,
      backend: row.backend,
      attempts: row.attempts,
      workspacePath: row.workspacePath,
      href: fallbackRunHref(routeScope, row.actualInitiativeId) ?? "/execution/runs",
      group: row.group,
      featured: Boolean(row.featured),
      taskItems: row.taskItems,
    };
  });
}

export function buildClaudeDesignFrontdoorRecentRuns(routeScope?: ShellRouteScope): FrontdoorRecentRunCard[] {
  return [
    {
      id: "wvn4z3",
      title: "Add real-time collaborative editing to doc surface",
      status: "running",
      updatedLabel: "48s ago",
      href: buildExecutionRunScopeHref("initiative-1776692809107-v182kvc5", routeScope),
    },
    {
      id: "q7xdh1",
      title: "Recovery review surface with approval routing",
      status: "verifying",
      updatedLabel: "2m ago",
      href: buildExecutionRunScopeHref("initiative-1776692650931-10l0jkmm", routeScope),
    },
    {
      id: "7hk2m8",
      title: "Dedupe initiative search index on backfill",
      status: "blocked",
      updatedLabel: "6m ago",
      href: buildExecutionRunScopeHref("initiative-1776689179464-i9bxyguz", routeScope),
    },
    {
      id: "bv4x9q",
      title: "Delivery handoff template for docs-only outputs",
      status: "blocked",
      updatedLabel: "11m ago",
      href: buildExecutionRunScopeHref("initiative-1776688410865-vh5g5o4n", routeScope),
    },
    {
      id: "r1m3g8",
      title: "Prompt library ingestion with tag normalization",
      status: "ready",
      updatedLabel: "28m ago",
      href: buildExecutionRunScopeHref("initiative-1776687601787-2qhodzm2", routeScope),
    },
  ];
}
