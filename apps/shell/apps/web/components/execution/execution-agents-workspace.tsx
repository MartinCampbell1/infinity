"use client";

import type {
  AutopilotExecutionAgentActionRunSummaryRecord,
  AutopilotExecutionRuntimeAgentRecord,
  AutopilotProjectSummary,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { AlertTriangle, Bot, Clock3, PlayCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellActionLink,
  ShellDetailCard,
  ShellEmptyState,
  ShellHero,
  ShellHeroSearchField,
  ShellListLink,
  ShellMetricCard,
  ShellPage,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import {
  emptyShellExecutionAgentsSnapshot,
  type ShellExecutionAgentsSnapshot,
} from "@/lib/execution-agents";
import {
  buildExecutionAgentScopeHref,
  buildExecutionEventsScopeHref,
  buildExecutionProjectScopeHref,
  routeScopeFromProjectRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { fetchShellExecutionAgentsSnapshot } from "@/lib/shell-snapshot-client";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

const EMPTY_AGENTS_SNAPSHOT = emptyShellExecutionAgentsSnapshot();

function statusTone(
  status?: string | null
): "neutral" | "success" | "warning" | "danger" | "info" {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "running" || normalized === "active" || normalized === "ok") {
    return "success";
  }
  if (
    normalized === "paused" ||
    normalized === "partial" ||
    normalized === "needs_approval" ||
    normalized === "budget_risk"
  ) {
    return "warning";
  }
  if (
    normalized === "failed" ||
    normalized === "error" ||
    normalized === "blocked" ||
    normalized === "budget_exhausted"
  ) {
    return "danger";
  }
  if (normalized === "completed") {
    return "info";
  }
  return "neutral";
}

function relativeTime(value?: string | null, fallback = "No timestamp yet") {
  if (!value) return fallback;

  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

function matchesValues(
  values: Array<string | number | boolean | null | undefined>,
  query: string
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return values.some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(normalized)
  );
}

function matchesProject(project: AutopilotProjectSummary, query: string) {
  return matchesValues(
    [
      project.name,
      project.status,
      project.current_story_title,
      project.runtime_session_id,
      project.last_message,
      project.task_source?.source_kind,
      project.task_source?.external_id,
    ],
    query
  );
}

function matchesAgent(agent: AutopilotExecutionRuntimeAgentRecord, query: string) {
  return matchesValues(
    [
      agent.agent_id,
      agent.label,
      agent.project_name,
      agent.role,
      agent.status,
      agent.story_title,
      agent.attention?.state,
      agent.attention?.recommended_action,
      agent.provider,
      agent.profile_name,
    ],
    query
  );
}

function matchesRun(
  run: AutopilotExecutionAgentActionRunSummaryRecord,
  query: string
) {
  return matchesValues(
    [
      run.id,
      run.run_kind,
      run.actor,
      run.status,
      run.completion_state,
      run.completion_message,
      run.orchestrator_session_id,
      run.project_ids.join(" "),
      run.runtime_agent_ids.join(" "),
    ],
    query
  );
}

function ProjectCard({
  project,
  routeScope,
}: {
  project: AutopilotProjectSummary;
  routeScope: ShellRouteScope;
}) {
  const href = buildExecutionProjectScopeHref(
    project.id,
    routeScopeFromProjectRef(project.id, "", routeScope)
  );
  return (
    <ShellListLink href={href} className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[13px] font-medium text-foreground">
            {project.name}
          </div>
          <div className="text-[11px] leading-4 text-muted-foreground">
            {project.current_story_title || project.last_message || "No current story headline."}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={statusTone(project.status)}>{project.status}</Badge>
          {project.priority === "high" ? <Badge tone="warning">high priority</Badge> : null}
        </div>
      </div>
      <div className="grid gap-1.5 text-[11px] text-muted-foreground md:grid-cols-2">
        <span>{project.stories_done}/{project.stories_total} stories</span>
        <span>{relativeTime(project.last_activity_at)}</span>
        {project.runtime_session_id ? <span className="md:col-span-2">{project.runtime_session_id}</span> : null}
      </div>
    </ShellListLink>
  );
}

function RuntimeAgentCard({
  agent,
  routeScope,
}: {
  agent: AutopilotExecutionRuntimeAgentRecord;
  routeScope: ShellRouteScope;
}) {
  const scopedRouteScope = routeScopeFromProjectRef(agent.project_id ?? "", "", routeScope);
  const href = buildExecutionAgentScopeHref(agent.agent_id, scopedRouteScope);
  return (
    <ShellListLink href={href} className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[13px] font-medium text-foreground">
            {agent.project_name || agent.project_id || "Unknown project"}
          </div>
          <div className="text-[11px] leading-4 text-muted-foreground">
            {agent.label}
            {agent.story_title ? ` · ${agent.story_title}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={statusTone(agent.status)}>{agent.status}</Badge>
          {agent.attention?.state ? (
            <Badge tone={statusTone(agent.attention.state)}>{agent.attention.state}</Badge>
          ) : null}
        </div>
      </div>
      <div className="grid gap-1.5 text-[11px] text-muted-foreground md:grid-cols-2">
        <span>{agent.role}</span>
        <span>{agent.open_issue_count} issues</span>
        <span>{agent.pending_approval_count} approvals</span>
        <span>{agent.active_async_task_count ?? 0} async tasks</span>
        {agent.attention?.recommended_action ? (
          <span className="md:col-span-2 line-clamp-2">
            Next step: {agent.attention.recommended_action}
          </span>
        ) : null}
      </div>
    </ShellListLink>
  );
}

function ActionRunCard({
  run,
  routeScope,
}: {
  run: AutopilotExecutionAgentActionRunSummaryRecord;
  routeScope: ShellRouteScope;
}) {
  const href = buildExecutionEventsScopeHref(routeScope, {
    orchestratorSessionId: run.orchestrator_session_id || null,
  });
  return (
    <ShellListLink href={href} className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[13px] font-medium text-foreground">
            {run.dry_run ? "Dry run" : "Apply run"} · {run.run_kind}
          </div>
          <div className="text-[11px] leading-4 text-muted-foreground">
            {run.completion_message || "No completion message recorded."}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={statusTone(run.status)}>{run.status}</Badge>
          <Badge tone={statusTone(run.completion_state)}>{run.completion_state}</Badge>
        </div>
      </div>
      <div className="grid gap-1.5 text-[11px] text-muted-foreground md:grid-cols-2">
        <span>{run.project_ids.length} projects</span>
        <span>{run.runtime_agent_ids.length} agents</span>
        <span>{relativeTime(run.created_at)}</span>
        {run.orchestrator_session_id ? (
          <span className="md:col-span-2 break-all">{run.orchestrator_session_id}</span>
        ) : null}
      </div>
    </ShellListLink>
  );
}

export function ExecutionAgentsWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellExecutionAgentsSnapshot | null;
  routeScope?: ShellRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollIntervalMs = getShellPollInterval(
    "execution_projects",
    preferences.refreshProfile
  );
  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh();
  const [query, setQuery] = useState("");

  const loadSnapshot = useCallback(() => fetchShellExecutionAgentsSnapshot(), []);
  const selectLoadState = useCallback(
    (snapshot: ShellExecutionAgentsSnapshot) => snapshot.projectsLoadState,
    []
  );

  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_AGENTS_SNAPSHOT,
    initialSnapshot,
    refreshNonce,
    pollIntervalMs,
    loadSnapshot,
    selectLoadState,
  });

  const errorMessages = useMemo(
    () =>
      [
        snapshot.projectsError,
        snapshot.agentsError,
        snapshot.agentsSummaryError,
        snapshot.actionRunsError,
        snapshot.actionRunsSummaryError,
      ].filter((value): value is string => Boolean(value)),
    [
      snapshot.actionRunsError,
      snapshot.actionRunsSummaryError,
      snapshot.agentsError,
      snapshot.agentsSummaryError,
      snapshot.projectsError,
    ]
  );

  const projects = useMemo(
    () => snapshot.projects.filter((project) => matchesProject(project, query)).slice(0, 8),
    [query, snapshot.projects]
  );
  const agents = useMemo(
    () => snapshot.agents.filter((agent) => matchesAgent(agent, query)).slice(0, 8),
    [query, snapshot.agents]
  );
  const actionRuns = useMemo(
    () => snapshot.actionRuns.filter((run) => matchesRun(run, query)).slice(0, 8),
    [query, snapshot.actionRuns]
  );

  return (
    <ShellPage>
      <ShellHero
        title="Agents"
        description="Runtime visibility across execution projects, live runtime agents, and recent execution-plane runs."
        meta={
          <>
            <span>{snapshot.projects.length} tracked projects</span>
            <span>{snapshot.agentsSummary?.totals.agents ?? snapshot.agents.length} runtime agents</span>
            <span>{snapshot.actionRunsSummary?.totals.runs ?? snapshot.actionRuns.length} action runs</span>
          </>
        }
        actions={
          <>
            <ShellActionLink
              href={buildExecutionEventsScopeHref(routeScope)}
              label="Open events"
            />
            <ShellRefreshButton
              busy={isRefreshing || loadState === "loading"}
              onClick={refresh}
              compact
            />
          </>
        }
      />

      {errorMessages.map((message) => (
        <ShellStatusBanner key={message} tone="danger">
          {message}
        </ShellStatusBanner>
      ))}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ShellMetricCard
          label="Projects"
          value={String(snapshot.projects.length)}
          detail="Tracked execution projects in the runtime fleet."
        />
        <ShellMetricCard
          label="Active agents"
          value={String(snapshot.agentsSummary?.totals.active ?? 0)}
          detail="Runtime agents currently executing or holding an active role."
        />
        <ShellMetricCard
          label="Needs attention"
          value={String((snapshot.agentsSummary?.totals.blocked ?? 0) + (snapshot.agentsSummary?.totals.needs_approval ?? 0))}
          detail="Blocked or approval-gated runtime agents."
        />
        <ShellMetricCard
          label="Action runs"
          value={String(snapshot.actionRunsSummary?.totals.runs ?? snapshot.actionRuns.length)}
          detail="Recent execution-plane action runs."
        />
      </div>

      <ShellSectionCard
        title="Runtime board"
        description="Search by project, runtime agent, session, provider, or execution context."
        contentClassName="space-y-4"
      >
        <ShellHeroSearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search projects, agents, action runs, provider, or source..."
        />

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ShellSectionCard
            title={`Runtime agents (${agents.length})`}
            description="Execution-plane ordered runtime agents."
            contentClassName="grid gap-2.5"
          >
            {agents.length > 0 ? (
              agents.map((agent) => (
                <RuntimeAgentCard
                  key={agent.agent_id}
                  agent={agent}
                  routeScope={routeScope}
                />
              ))
            ) : (
              <ShellEmptyState
                centered
                icon={<Bot className="h-5 w-5" />}
                title="No runtime agents in view"
                description="No runtime agents match the current search."
                className="py-10"
              />
            )}
          </ShellSectionCard>

          <ShellSectionCard
            title={`Recent action runs (${actionRuns.length})`}
            description="Latest execution-plane action batches and single-agent runs."
            contentClassName="grid gap-2.5"
          >
            {actionRuns.length > 0 ? (
              actionRuns.map((run) => (
                <ActionRunCard
                  key={run.id}
                  run={run}
                  routeScope={routeScope}
                />
              ))
            ) : (
              <ShellEmptyState
                centered
                icon={<Clock3 className="h-5 w-5" />}
                title="No action runs in view"
                description="No action runs match the current search."
                className="py-10"
              />
            )}
          </ShellSectionCard>
        </div>

        <ShellSectionCard
          title={`Projects (${projects.length})`}
          description="Current project runtime status across the execution fleet."
          contentClassName="grid gap-2.5"
        >
          {projects.length > 0 ? (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                routeScope={routeScope}
              />
            ))
          ) : (
            <ShellEmptyState
              centered
              icon={<PlayCircle className="h-5 w-5" />}
              title="No projects in view"
              description="No projects match the current search."
              className="py-10"
            />
          )}
        </ShellSectionCard>

        {projects.length === 0 && agents.length === 0 && actionRuns.length === 0 && loadState !== "loading" ? (
          <ShellEmptyState
            centered
            icon={<AlertTriangle className="h-5 w-5" />}
            title="No matching runtime records"
            description="The runtime board is empty for the current search."
            className="py-12"
          />
        ) : null}
      </ShellSectionCard>
    </ShellPage>
  );
}
