import type {
  AutopilotExecutionAgentActionRunSummaryRecord,
  AutopilotExecutionAgentActionRunsSummary,
  AutopilotExecutionAgentsSummary,
  AutopilotExecutionRuntimeAgentRecord,
  AutopilotProjectSummary,
} from "@founderos/api-clients";

import type { ControlPlaneState } from "@/lib/server/control-plane/state/types";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";
import { formatUpstreamErrorMessage, requestUpstreamJson } from "@/lib/upstream";
import {
  emptyShellExecutionAgentsSnapshot,
  type ShellExecutionAgentsSnapshot,
} from "./execution-agents-shared";

export { emptyShellExecutionAgentsSnapshot, type ShellExecutionAgentsSnapshot };

function sortProjects(items: AutopilotProjectSummary[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.last_activity_at ?? "") || 0;
    const rightTime = Date.parse(right.last_activity_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function sortActionRuns(items: AutopilotExecutionAgentActionRunSummaryRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? left.updated_at ?? "") || 0;
    const rightTime = Date.parse(right.created_at ?? right.updated_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function countBy(items: string[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {});
}

function latestIso(...values: Array<string | null | undefined>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? new Date(0).toISOString()
  );
}

function buildLocalExecutionAgentsSnapshot(
  state: ControlPlaneState
): ShellExecutionAgentsSnapshot {
  const orchestration = state.orchestration;
  const initiatives = orchestration.initiatives ?? [];
  const runs = orchestration.runs ?? [];
  const taskGraphs = orchestration.taskGraphs ?? [];
  const workUnits = orchestration.workUnits ?? [];
  const batches = orchestration.batches ?? [];
  const agentSessions = orchestration.agentSessions ?? [];

  const projects = initiatives.map((initiative): AutopilotProjectSummary => {
    const initiativeRuns = runs.filter((run) => run.initiativeId === initiative.id);
    const latestRun = [...initiativeRuns].sort((left, right) =>
      latestIso(right.updatedAt, right.createdAt).localeCompare(latestIso(left.updatedAt, left.createdAt))
    )[0];
    const graphIds = new Set(
      taskGraphs
        .filter((taskGraph) => taskGraph.initiativeId === initiative.id)
        .map((taskGraph) => taskGraph.id)
    );
    const projectWorkUnits = workUnits.filter((unit) => graphIds.has(unit.taskGraphId));
    const done = projectWorkUnits.filter((unit) => unit.status === "completed").length;
    const total = projectWorkUnits.length;

    return {
      id: initiative.id,
      name: initiative.title,
      path: "/Users/martin/infinity",
      priority: initiative.priority ?? "normal",
      archived: false,
      status: latestRun?.currentStage ?? initiative.status,
      paused: false,
      stories_done: done,
      stories_total: total,
      current_story_title:
        projectWorkUnits.find((unit) => unit.status === "running")?.title ??
        projectWorkUnits.find((unit) => unit.status !== "completed")?.title ??
        projectWorkUnits[0]?.title ??
        null,
      last_activity_at: latestIso(latestRun?.updatedAt, initiative.updatedAt),
      last_message: latestRun?.title ?? initiative.userRequest,
      runtime_session_id: latestRun?.id,
      runtime_control_available: true,
      task_source: {
        source_kind: "local_shell",
        external_id: initiative.id,
        repo: "infinity",
        branch_policy: "local",
        brief_ref: initiative.id,
      },
    };
  });

  const agents = agentSessions.map((session): AutopilotExecutionRuntimeAgentRecord => {
    const run = runs.find((candidate) => candidate.id === session.runId);
    const initiative = initiatives.find((candidate) => candidate.id === run?.initiativeId);
    const workUnit = workUnits.find((candidate) => candidate.id === session.workItemId);
    const active = session.status === "starting" || session.status === "running";
    const blocked = session.status === "failed" || session.status === "refused";

    return {
      agent_id: session.id,
      role: session.agentKind,
      label: `${session.agentKind} · ${workUnit?.title ?? session.workItemId}`,
      provider: "local_shell",
      profile_name: workUnit?.executorType ?? "local",
      status: active ? "active" : session.status,
      story_title: workUnit?.title ?? null,
      story_status: workUnit?.status ?? null,
      open_issue_count: blocked ? 1 : 0,
      pending_approval_count: 0,
      active_async_task_count: active ? 1 : 0,
      pending_async_run_count: session.status === "queued" ? 1 : 0,
      project_id: initiative?.id ?? run?.initiativeId ?? "",
      project_name: initiative?.title ?? run?.title ?? "Local shell run",
      project_status: run?.currentStage ?? initiative?.status,
      project_paused: false,
      attention: blocked
        ? {
            state: "blocked",
            recommended_action: "Inspect the local shell run and retry from the run surface.",
            reasons: ["local shell agent session ended without a successful status"],
          }
        : undefined,
    };
  });

  const actionRuns = batches.map((batch): AutopilotExecutionAgentActionRunSummaryRecord => {
    const run = runs.find((candidate) => candidate.initiativeId === batch.initiativeId);
    const sessions = agentSessions.filter((session) => session.batchId === batch.id);
    const initiative = initiatives.find((candidate) => candidate.id === batch.initiativeId);
    const completed = batch.status === "completed";
    const failed = batch.status === "failed" || batch.status === "blocked";

    return {
      id: batch.id,
      run_kind: "local_shell_batch",
      orchestrator_session_id: run?.id ?? batch.id,
      actor: "shell",
      mode: "local",
      reason: "Local shell orchestration batch",
      dry_run: false,
      policy_profile: "localhost_solo",
      summary: {
        message: `${initiative?.title ?? batch.initiativeId} · ${batch.workUnitIds.length} work units`,
      } as never,
      approval_required: false,
      status: batch.status,
      completion_state: completed ? "ok" : failed ? "error" : "pending_async",
      completion_message: completed
        ? "Local shell batch completed."
        : failed
          ? "Local shell batch needs attention."
          : "Local shell batch is in progress.",
      shadow_audits: [],
      open_shadow_audit_count: 0,
      handoff_state: run?.handoffStatus,
      handoff_blocked: false,
      project_ids: [batch.initiativeId],
      orchestrators: ["shell"],
      runtime_agent_ids: sessions.map((session) => session.id),
      created_at: batch.startedAt ?? run?.createdAt ?? new Date(0).toISOString(),
      updated_at: batch.finishedAt ?? run?.updatedAt ?? batch.startedAt ?? new Date(0).toISOString(),
      completed_at: batch.finishedAt ?? null,
    };
  });

  const agentsSummary: AutopilotExecutionAgentsSummary = {
    totals: {
      agents: agents.length,
      active: agents.filter((agent) => agent.status === "active").length,
      blocked: agents.filter((agent) => agent.status === "failed" || agent.attention?.state === "blocked").length,
      needs_approval: agents.reduce((total, agent) => total + agent.pending_approval_count, 0),
      waiting_async: agents.reduce((total, agent) => total + (agent.pending_async_run_count ?? 0), 0),
      budget_risk: 0,
      budget_exhausted: 0,
      actionable: agents.filter((agent) => agent.attention?.recommended_action).length,
      with_suggested_commands: 0,
      approval_required_suggestions: 0,
    },
    by_attention_state: countBy(agents.map((agent) => agent.attention?.state ?? "none")),
    by_role: countBy(agents.map((agent) => agent.role)),
    by_project: countBy(agents.map((agent) => agent.project_id ?? "unknown")),
    by_recommendation_kind: {},
    by_suggested_command: {},
  };

  const actionRunsSummary: AutopilotExecutionAgentActionRunsSummary = {
    totals: {
      runs: actionRuns.length,
      dry_runs: actionRuns.filter((run) => run.dry_run).length,
      executions: actionRuns.filter((run) => !run.dry_run).length,
      single_action_runs: 0,
      batch_runs: actionRuns.length,
      ok: actionRuns.filter((run) => run.completion_state === "ok").length,
      partial: 0,
      error: actionRuns.filter((run) => run.completion_state === "error").length,
      pending_async: actionRuns.filter((run) => run.completion_state === "pending_async").length,
      quarantined: 0,
    },
    by_status: countBy(actionRuns.map((run) => run.status)),
    by_completion_state: countBy(actionRuns.map((run) => run.completion_state)),
    by_run_kind: countBy(actionRuns.map((run) => run.run_kind)),
    by_actor: countBy(actionRuns.map((run) => run.actor)),
    by_policy_profile: countBy(actionRuns.map((run) => run.policy_profile)),
    by_project: countBy(actionRuns.flatMap((run) => run.project_ids)),
    by_orchestrator: countBy(actionRuns.flatMap((run) => run.orchestrators)),
    result_status_counts: {},
    latest_run_at: actionRuns[0]?.updated_at ?? null,
  };

  return {
    generatedAt: new Date().toISOString(),
    projects: sortProjects(projects),
    projectsError: null,
    projectsLoadState: "ready",
    agents,
    agentsError: null,
    agentsLoadState: "ready",
    agentsSummary,
    agentsSummaryError: null,
    agentsSummaryLoadState: "ready",
    actionRuns: sortActionRuns(actionRuns),
    actionRunsError: null,
    actionRunsLoadState: "ready",
    actionRunsSummary,
    actionRunsSummaryError: null,
    actionRunsSummaryLoadState: "ready",
  };
}

export async function buildExecutionAgentsSnapshot(): Promise<ShellExecutionAgentsSnapshot> {
  const localSnapshot = await readControlPlaneState()
    .then(buildLocalExecutionAgentsSnapshot)
    .catch(() => emptyShellExecutionAgentsSnapshot());
  const [
    projectsResult,
    agentsResult,
    agentsSummaryResult,
    actionRunsResult,
    actionRunsSummaryResult,
  ] = await Promise.allSettled([
    requestUpstreamJson<{ projects: AutopilotProjectSummary[] }>("autopilot", "projects/"),
    requestUpstreamJson<{ agents: AutopilotExecutionRuntimeAgentRecord[] }>(
      "autopilot",
      "execution-plane/agents",
      undefined,
      { timeoutMs: 5000 }
    ),
    requestUpstreamJson<AutopilotExecutionAgentsSummary>(
      "autopilot",
      "execution-plane/agents/summary",
      undefined,
      { timeoutMs: 5000 }
    ),
    requestUpstreamJson<{ runs: AutopilotExecutionAgentActionRunSummaryRecord[] }>(
      "autopilot",
      "execution-plane/agents/action-runs?summary=true",
      undefined,
      { timeoutMs: 5000 }
    ),
    requestUpstreamJson<AutopilotExecutionAgentActionRunsSummary>(
      "autopilot",
      "execution-plane/agents/action-runs/summary",
      undefined,
      { timeoutMs: 5000 }
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    projects:
      projectsResult.status === "fulfilled"
        ? sortProjects(projectsResult.value.projects)
        : localSnapshot.projects,
    projectsError:
      projectsResult.status === "fulfilled" || localSnapshot.projects.length > 0
        ? null
        : formatUpstreamErrorMessage("Autopilot projects", projectsResult.reason),
    projectsLoadState:
      projectsResult.status === "fulfilled" || localSnapshot.projects.length > 0 ? "ready" : "error",
    agents: agentsResult.status === "fulfilled" ? agentsResult.value.agents : localSnapshot.agents,
    agentsError:
      agentsResult.status === "fulfilled" || localSnapshot.agents.length > 0
        ? null
        : formatUpstreamErrorMessage("Execution runtime agents", agentsResult.reason),
    agentsLoadState:
      agentsResult.status === "fulfilled" || localSnapshot.agents.length > 0 ? "ready" : "error",
    agentsSummary:
      agentsSummaryResult.status === "fulfilled"
        ? agentsSummaryResult.value
        : localSnapshot.agentsSummary,
    agentsSummaryError:
      agentsSummaryResult.status === "fulfilled" || localSnapshot.agentsSummary
        ? null
        : formatUpstreamErrorMessage(
            "Execution runtime agent summary",
            agentsSummaryResult.reason
          ),
    agentsSummaryLoadState:
      agentsSummaryResult.status === "fulfilled" || localSnapshot.agentsSummary
        ? "ready"
        : "error",
    actionRuns:
      actionRunsResult.status === "fulfilled"
        ? sortActionRuns(actionRunsResult.value.runs)
        : localSnapshot.actionRuns,
    actionRunsError:
      actionRunsResult.status === "fulfilled" || localSnapshot.actionRuns.length > 0
        ? null
        : formatUpstreamErrorMessage(
            "Execution runtime agent action runs",
            actionRunsResult.reason
          ),
    actionRunsLoadState:
      actionRunsResult.status === "fulfilled" || localSnapshot.actionRuns.length > 0
        ? "ready"
        : "error",
    actionRunsSummary:
      actionRunsSummaryResult.status === "fulfilled"
        ? actionRunsSummaryResult.value
        : localSnapshot.actionRunsSummary,
    actionRunsSummaryError:
      actionRunsSummaryResult.status === "fulfilled" || localSnapshot.actionRunsSummary
        ? null
        : formatUpstreamErrorMessage(
            "Execution runtime agent action run summary",
            actionRunsSummaryResult.reason
          ),
    actionRunsSummaryLoadState:
      actionRunsSummaryResult.status === "fulfilled" || localSnapshot.actionRunsSummary
        ? "ready"
        : "error",
  };
}
