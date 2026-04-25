import Link from "next/link";

import {
  buildExecutionContinuityScopeHref,
  buildExecutionDeliveryScopeHref,
  buildExecutionBatchScopeHref,
  buildExecutionTaskGraphScopeHref,
  buildExecutionWorkspaceScopeHref,
  routeScopeFromExecutionBindingRef,
  withShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  isDeliveryPrimaryHandoffReady,
  resolveDeliveryReadinessCopy,
  type DeliveryReadinessCopy,
} from "../../lib/delivery-readiness";
import { isStrictRolloutEnv } from "../../lib/server/control-plane/workspace/rollout-config";
import { ReadinessBadge } from "../orchestration/readiness-badge";
import {
  PlaneButton,
  PlaneDisabledAction,
  PlaneProgressBar,
  PlaneStatusPill,
} from "@/components/execution/plane-run-primitives";
import { RecoveryActionStrip } from "@/components/execution/operator-action-controls";
import { RunLiveRefresh } from "./run-live-refresh";
import { getClaudeDisplayRunId } from "@/lib/server/orchestration/claude-design-presentation";
import type { ApprovalRequest } from "@/lib/server/control-plane/contracts/approvals";
import type {
  AssemblyRecord,
  DeliveryRecord,
  ExecutionBatchRecord,
  InitiativeRecord,
  TaskGraphRecord,
  WorkUnitRecord,
  WorkUnitStatus,
} from "@/lib/server/control-plane/contracts/orchestration";
import type { RecoveryIncident } from "@/lib/server/control-plane/contracts/recoveries";
import type {
  AutonomousAgentSessionRecord,
  AutonomousRefusalRecord,
  AutonomousHandoffPacketRecord,
  AutonomousPreviewTargetRecord,
  AutonomousRunEventRecord,
  AutonomousRunRecord,
} from "@/lib/server/control-plane/state/types";
import type { SessionWorkspaceHostContext } from "@/lib/server/control-plane/contracts/workspace-launch";

function titleCase(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function stageOrder(currentStage: string | null | undefined, delivered: boolean) {
  const keys = ["clarifying", "planning", "running", "verifying", "delivered"] as const;
  const currentKey = delivered
    ? "delivered"
    : currentStage === "ready" || currentStage === "preview_ready" || currentStage === "handed_off"
      ? "delivered"
    : currentStage === "cancelled"
      ? "delivered"
    : currentStage === "starting" || currentStage === "clarifying"
      ? "clarifying"
    : currentStage === "brief_ready" || currentStage === "planning"
      ? "planning"
    : currentStage === "acting" || currentStage === "running"
      ? "running"
    : currentStage === "validating" || currentStage === "verifying"
      ? "verifying"
      : "running";
  const activeIndex = keys.indexOf(currentKey);

  return keys.map((key, index) => ({
    key,
    label: key === "delivered" ? (delivered ? "Delivered" : "Proof") : titleCase(key),
    state: index < activeIndex ? "done" : index === activeIndex ? "active" : "todo",
  }));
}

function workUnitGroup(status: WorkUnitStatus) {
  if (status === "completed" || status === "failed") {
    return "completed";
  }
  if (status === "running" || status === "blocked" || status === "retryable") {
    return "running";
  }
  return "pending";
}

function workUnitProgress(status: WorkUnitStatus) {
  if (status === "completed") {
    return { value: 1, total: 1 };
  }
  if (status === "running") {
    return { value: 1, total: 2 };
  }
  return { value: 0, total: 1 };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  return value.replace("T", " ").slice(0, 16);
}

function shortRunId(value: string | null | undefined) {
  return getClaudeDisplayRunId(value);
}

function workUnitCode(index: number) {
  return `t${String(index + 1).padStart(2, "0")}`;
}

function workUnitTag(unit: WorkUnitRecord) {
  const suffix = unit.id.split("-").at(-1) ?? "task";
  return `#${suffix.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
}

function workUnitAttemptLabel(status: WorkUnitStatus) {
  if (status === "completed") {
    return "1/1";
  }
  if (status === "running" || status === "blocked" || status === "retryable") {
    return "1/2";
  }
  return "0/0";
}

function uniqueAttemptIds(
  unit: WorkUnitRecord,
  agentSessions: AutonomousAgentSessionRecord[]
) {
  const ids = new Set<string>();
  if (unit.latestAttemptId) {
    ids.add(unit.latestAttemptId);
  }
  agentSessions
    .filter((session) => session.workItemId === unit.id && session.attemptId)
    .forEach((session) => ids.add(String(session.attemptId)));
  return [...ids];
}

function workUnitAttemptCount(
  unit: WorkUnitRecord,
  agentSessions: AutonomousAgentSessionRecord[]
) {
  const count = uniqueAttemptIds(unit, agentSessions).length;
  if (count > 0) {
    return String(count);
  }
  return workUnitAttemptLabel(unit.status).split("/")[0] ?? "0";
}

function artifactEvidenceForWorkUnit(
  unit: WorkUnitRecord,
  assembly: AssemblyRecord | null | undefined,
  index: number
) {
  if (!assembly?.artifactUris.length) {
    return null;
  }
  const latestAttemptId = unit.latestAttemptId ?? "";
  return (
    assembly.artifactUris.find((artifactUri) =>
      Boolean(latestAttemptId && artifactUri.includes(latestAttemptId))
    ) ??
    assembly.artifactUris.find((artifactUri) => artifactUri.includes(unit.id)) ??
    (assembly.inputWorkUnitIds[index] === unit.id
      ? assembly.artifactUris[index]
      : null) ??
    null
  );
}

function evidenceLabel(artifactUri: string) {
  const lastSegment = artifactUri.split("/").filter(Boolean).at(-1);
  return lastSegment ? decodeURIComponent(lastSegment) : artifactUri;
}

function failureReasonForWorkUnit(
  unit: WorkUnitRecord,
  refusals: AutonomousRefusalRecord[]
) {
  const refusal = refusals.find((candidate) => candidate.workItemId === unit.id);
  if (refusal?.reason) {
    return refusal.reason;
  }
  if (unit.status === "failed") {
    return "Work unit failed without a recorded refusal reason.";
  }
  if (unit.status === "blocked" || unit.status === "retryable") {
    return "Work unit is blocked and waiting for recovery.";
  }
  return null;
}

function buildBriefInspectionHref(
  taskGraph: TaskGraphRecord,
  scope?: Partial<ShellRouteScope> | null
) {
  const href = withShellRouteScope("/execution/planner", scope);
  const url = new URL(href, "http://founderos-shell.local");
  url.searchParams.set("brief_id", taskGraph.briefId);
  url.searchParams.set("initiative_id", taskGraph.initiativeId);
  return `${url.pathname}${url.search}`;
}

const PREFERRED_WORK_UNIT_SUFFIX_ORDER = [
  "final_integration",
  "qa_release_gate",
  "runtime_kernel",
  "orchestration_flow",
  "control_plane_data",
  "workspace_launch",
  "shell_ui",
  "work_ui",
  "topology_frontdoor",
] as const;

function workUnitOrder(unit: WorkUnitRecord) {
  const suffix = unit.id.split("-").at(-1) ?? "";
  const index = PREFERRED_WORK_UNIT_SUFFIX_ORDER.indexOf(
    suffix as (typeof PREFERRED_WORK_UNIT_SUFFIX_ORDER)[number]
  );
  return index === -1 ? PREFERRED_WORK_UNIT_SUFFIX_ORDER.length : index;
}

export function PrimaryRunSurface({
  routeScope,
  initiative,
  currentRun,
  currentTaskGraph,
  currentBatch,
  currentDelivery,
  currentAssembly,
  latestRunEvent,
  plannerNotes,
  workUnits,
  agentSessions,
  refusals,
  recoveryIncidents,
  approvalRequests,
  workspaceHostContext,
}: {
  routeScope?: ShellRouteScope;
  initiative: InitiativeRecord;
  currentRun: AutonomousRunRecord | null;
  currentTaskGraph: TaskGraphRecord | null;
  currentBatch: ExecutionBatchRecord | null;
  currentDelivery: DeliveryRecord | null;
  currentPreviewTarget: AutonomousPreviewTargetRecord | null;
  latestRunEvent: AutonomousRunEventRecord | null;
  currentHandoffPacket: AutonomousHandoffPacketRecord | null;
  currentAssembly?: AssemblyRecord | null;
  plannerNotes: string[];
  workUnits: WorkUnitRecord[];
  agentSessions: AutonomousAgentSessionRecord[];
  refusals?: AutonomousRefusalRecord[];
  recoveryIncidents: RecoveryIncident[];
  approvalRequests: ApprovalRequest[];
  workspaceHostContext: SessionWorkspaceHostContext | null;
}) {
  const scopedRefusals = refusals ?? [];
  const workspaceSessionId =
    workspaceHostContext?.sessionId ?? initiative.workspaceSessionId ?? routeScope?.sessionId ?? null;
  const scopedRoute = routeScopeFromExecutionBindingRef(
    {
      sessionId: workspaceSessionId,
      groupId: workspaceHostContext?.groupId,
      accountId: workspaceHostContext?.accountId,
      workspaceId: workspaceHostContext?.workspaceId,
    },
    routeScope
  );
  const workspaceHref = workspaceSessionId
    ? buildExecutionWorkspaceScopeHref(workspaceSessionId, scopedRoute)
    : null;
  const continuityHref = buildExecutionContinuityScopeHref(initiative.id, scopedRoute);
  const deliveryHref = currentDelivery
    ? buildExecutionDeliveryScopeHref(currentDelivery.id, scopedRoute, {
        initiativeId: initiative.id,
      })
    : null;
  const taskGraphHref = currentTaskGraph
    ? buildExecutionTaskGraphScopeHref(currentTaskGraph.id, scopedRoute, {
        initiativeId: initiative.id,
      })
    : null;
  const batchHref = currentBatch
    ? buildExecutionBatchScopeHref(currentBatch.id, scopedRoute, {
        initiativeId: initiative.id,
        taskGraphId: currentBatch.taskGraphId,
      })
    : null;
  const briefHref = currentTaskGraph
    ? buildBriefInspectionHref(currentTaskGraph, scopedRoute)
    : null;
  const displayStage =
    currentRun?.currentStage === "preview_ready" || currentRun?.currentStage === "handed_off"
      ? "verifying"
      : currentRun?.currentStage ?? initiative.status;
  const strictRolloutEnv = isStrictRolloutEnv();
  const deliveryReadinessCopy = currentDelivery
    ? resolveDeliveryReadinessCopy(currentDelivery, { strictRolloutEnv })
    : null;
  const deliveryHandoffReady = currentDelivery
    ? isDeliveryPrimaryHandoffReady(currentDelivery, { strictRolloutEnv })
    : false;
  const delivered =
    currentDelivery
      ? deliveryHandoffReady
      : false;
  const headlineStage = delivered ? "delivered" : displayStage;
  const stages = stageOrder(headlineStage, delivered);
  const activeAgentCount = agentSessions.filter((session) =>
    ["starting", "running"].includes(session.status)
  ).length;
  const recoveries = recoveryIncidents.filter((incident) =>
    ["open", "retryable", "failing_over"].includes(incident.status)
  );
  const pendingApprovals = approvalRequests.filter((approval) => approval.status === "pending");
  const orderedWorkUnits = [...workUnits].sort((left, right) => workUnitOrder(left) - workUnitOrder(right));
  const groupedWorkUnits = {
    running: orderedWorkUnits.filter((unit) => workUnitGroup(unit.status) === "running"),
    pending: orderedWorkUnits.filter((unit) => workUnitGroup(unit.status) === "pending"),
    completed: orderedWorkUnits.filter((unit) => workUnitGroup(unit.status) === "completed"),
  };
  const selectedWorkUnit =
    groupedWorkUnits.completed.find((unit) => unit.id.endsWith("final_integration")) ??
    groupedWorkUnits.running[0] ??
    groupedWorkUnits.pending[0] ??
    groupedWorkUnits.completed[0] ??
    null;
  const logLines = [
    latestRunEvent
      ? {
          label: titleCase(latestRunEvent.kind),
          body: latestRunEvent.summary,
          createdAt: latestRunEvent.createdAt,
        }
      : null,
    ...plannerNotes.slice(0, 2).map((note, index) => ({
      label: `Planner note ${index + 1}`,
      body: note,
      createdAt: currentBatch?.startedAt ?? initiative.updatedAt,
    })),
    ...recoveries.slice(0, 2).map((incident) => ({
      label: "Recovery",
      body: incident.summary,
      createdAt: incident.updatedAt,
    })),
  ].filter((value): value is { label: string; body: string; createdAt: string } => Boolean(value));
  const runIdLabel = shortRunId(currentRun?.id ?? initiative.id);
  const proofStripRows: Array<{
    label: string;
    value: string;
    href: string | null;
    tone: "success" | "pending";
    readiness?: DeliveryReadinessCopy | null;
  }> = [
    {
      label: currentAssembly?.status === "assembled" ? "Assembly ready" : "Assembly pending",
      value: currentAssembly?.manifestPath
        ? evidenceLabel(currentAssembly.manifestPath)
        : currentAssembly?.id ?? "not attached",
      href: taskGraphHref,
      tone: currentAssembly?.status === "assembled" ? "success" : "pending",
    },
    {
      label: currentDelivery ? "Verification passed" : "Verification pending",
      value: currentDelivery?.verificationRunId ?? "not attached",
      href: deliveryHref,
      tone: currentDelivery ? "success" : "pending",
    },
    {
      label:
        currentDelivery && deliveryReadinessCopy
          ? deliveryReadinessCopy.badgeLabel
          : "Missing proof",
      value: deliveryReadinessCopy
        ? deliveryReadinessCopy.missingProofItems.length
          ? `${deliveryReadinessCopy.missingProofItems.length} proof gates missing`
          : deliveryReadinessCopy.statusDetail
        : "not attached",
      href: deliveryHref,
      tone: deliveryHandoffReady ? "success" : "pending",
      readiness: deliveryReadinessCopy,
    },
  ];

  const liveRefreshEnabled = !delivered && initiative.status !== "cancelled";
  const taskMenuReason =
    "Task action menu requires a durable work-unit action route before it can be enabled.";
  const abortRunReason =
    "Abort run requires a durable run action route before it can be enabled.";
  const forceRetryReason =
    "Force retry is enabled through an open recovery incident with an action route.";
  const pauseForReviewReason =
    "Pause for review requires a durable run action route before it can be enabled.";

  return (
    <main className="mx-auto grid max-w-[1520px] gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <RunLiveRefresh enabled={liveRefreshEnabled} />
      <section className="min-w-0 space-y-5">
        <div className="flex items-center gap-2 text-[11px] text-white/56">
          <Link href={continuityHref} className="inline-flex items-center gap-1 transition hover:text-white">
            Runs
          </Link>
          <span>›</span>
          <span className="font-mono">{runIdLabel}</span>
          <PlaneStatusPill
            status={headlineStage}
            mono
            size="sm"
          >
            {headlineStage}
          </PlaneStatusPill>
        </div>

        <header className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
                Primary run · {runIdLabel}
              </div>
              <h1 className="mt-3 max-w-4xl text-[26px] font-semibold tracking-[-0.05em] text-white">
                {initiative.title}
              </h1>
              <p className="mt-3 max-w-4xl font-mono text-[12px] leading-8 text-white/54">
                {initiative.userRequest}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {briefHref ? (
                <Link href={briefHref}>
                  <PlaneButton variant="subtle" size="sm">
                    Open brief
                  </PlaneButton>
                </Link>
              ) : null}
              {taskGraphHref ? (
                <Link href={taskGraphHref}>
                  <PlaneButton variant="subtle" size="sm">
                    Open task graph
                  </PlaneButton>
                </Link>
              ) : null}
              {batchHref ? (
                <Link href={batchHref}>
                  <PlaneButton variant="subtle" size="sm">
                    Open batch
                  </PlaneButton>
                </Link>
              ) : null}
              <a href="#event-log">
                <PlaneButton variant="subtle" size="sm">
                  Logs
                </PlaneButton>
              </a>
              {workspaceHref ? (
                <Link href={workspaceHref}>
                  <PlaneButton variant="ghost" size="sm">
                    Workspace
                  </PlaneButton>
                </Link>
              ) : null}
              {deliveryHref ? (
                <Link href={deliveryHref}>
                  <PlaneButton variant={deliveryHandoffReady ? "primary" : "subtle"} size="sm">
                    Open delivery
                  </PlaneButton>
                </Link>
              ) : null}
            </div>
          </div>

          <div
            className="run-stage-strip flex items-center gap-3 rounded-[14px] border border-white/8 bg-[var(--shell-surface-card)] px-4 py-4"
            data-run-stage-strip
          >
            {stages.map((stage, index) => (
              <div
                key={stage.key}
                className="run-stage-step flex flex-1 items-center gap-3"
                data-stage-state={stage.state}
                aria-current={stage.state === "active" ? "step" : undefined}
              >
                <div
                  className={`run-stage-label inline-flex items-center gap-2 text-[11px] ${
                    stage.state === "active"
                      ? "font-medium text-white"
                      : stage.state === "done"
                        ? "text-white/78"
                        : "text-[var(--shell-sidebar-muted)]"
                  }`}
                >
                  <span
                    className={`run-stage-dot h-2 w-2 rounded-full ${
                      stage.state === "done"
                        ? "bg-emerald-400"
                        : stage.state === "active"
                          ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.55)]"
                          : "bg-white/15"
                    }`}
                  />
                  {stage.label}
                </div>
                {index < stages.length - 1 ? (
                  <div
                    className={`run-stage-connector h-px flex-1 ${
                      stage.state === "done" ? "bg-emerald-400/35" : "bg-white/8"
                    }`}
                    data-stage-connector-state={stage.state === "done" ? "complete" : "pending"}
                  />
                ) : null}
              </div>
            ))}
            <div className="h-5 w-px bg-white/8" />
            <div className="font-mono text-[10.5px] text-[var(--shell-sidebar-muted)]">
              elapsed {formatDateTime(currentRun?.updatedAt ?? initiative.updatedAt).slice(11, 16)}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {[
              {
                label: "Current stage",
                value: titleCase(headlineStage),
                detail: currentTaskGraph ? "task graph ready" : "task graph pending",
              },
              {
                label: "Tasks",
                value: `${groupedWorkUnits.completed.length} / ${workUnits.length}`,
                detail: `${groupedWorkUnits.running.length} active · ${groupedWorkUnits.pending.length} pending`,
              },
              {
                label: "Agents",
                value: activeAgentCount || agentSessions.length,
                detail: `${agentSessions.length} sessions`,
              },
              {
                label: "Recoveries",
                value: recoveries.length,
                detail: `${pendingApprovals.length} approvals pending`,
              },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
                  {metric.label}
                </div>
                <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-white">
                  {metric.value}
                </div>
                <div className="mt-1 text-[11px] text-white/56">{metric.detail}</div>
              </div>
            ))}
          </div>

          <div
            className="grid gap-3 rounded-[14px] border border-emerald-400/16 bg-emerald-400/[0.045] px-4 py-4 md:grid-cols-3"
            data-run-proof-strip="assembly-verification-delivery"
          >
            {proofStripRows.map((row) => {
              const content = (
                <>
                  <div
                    className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      row.tone === "success" ? "text-emerald-100/82" : "text-amber-100/78"
                    }`}
                  >
                    {row.readiness ? (
                      <ReadinessBadge readiness={row.readiness} />
                    ) : (
                      row.label
                    )}
                  </div>
                  <div className="mt-2 truncate font-mono text-[11px] leading-5 text-white/76">
                    {row.value}
                  </div>
                </>
              );

              return row.href ? (
                <Link
                  key={row.label}
                  href={row.href}
                  className="min-w-0 rounded-[10px] border border-white/7 bg-white/[0.025] px-3 py-3 transition hover:border-white/16 hover:bg-white/[0.045]"
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={row.label}
                  className="min-w-0 rounded-[10px] border border-white/7 bg-white/[0.025] px-3 py-3"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </header>

        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
              Runtime
            </div>
            <div className="text-[16px] font-medium tracking-[-0.02em] text-white">Task board</div>
            <div className="flex-1" />
            <span className="font-mono text-[10.5px] text-[var(--shell-sidebar-muted)]">
              group: lane
            </span>
          </div>

          <div data-task-board-layout="lane-columns" className="grid gap-3 lg:grid-cols-3">
            {[
              {
                label: "running",
                status: "running",
                items: groupedWorkUnits.running,
              },
              {
                label: "pending",
                status: "pending",
                items: groupedWorkUnits.pending,
              },
              {
                label: "completed",
                status: "completed",
                items: groupedWorkUnits.completed,
              },
            ].map((lane) => (
              <div
                key={lane.label}
                className="rounded-[14px] border border-white/6 bg-white/[0.02] px-4 py-4"
              >
                <div className="flex items-center justify-between">
                  <PlaneStatusPill status={lane.status} mono size="sm">
                    {lane.label}
                  </PlaneStatusPill>
                  <span className="font-mono text-[10px] text-[var(--shell-sidebar-muted)]">
                    {lane.items.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                {lane.items.length > 0 ? lane.items.map((unit, index) => {
                  const workUnit = unit as WorkUnitRecord;
                  const selected = selectedWorkUnit?.id === workUnit.id;
                  const progress = workUnitProgress(workUnit.status);
                  const pct = Math.round((progress.value / progress.total) * 100);
                  const attemptCount = workUnitAttemptCount(workUnit, agentSessions);
                  const artifactUri = artifactEvidenceForWorkUnit(
                    workUnit,
                    currentAssembly,
                    index
                  );
                  const failureReason = failureReasonForWorkUnit(workUnit, scopedRefusals);

                  return (
                    <div
                      key={workUnit.id}
                      className={`grid gap-3 rounded-[10px] border px-4 py-3 2xl:grid-cols-[74px_minmax(0,1fr)_174px] 2xl:items-center ${
                        selected
                          ? "border-[rgba(133,169,255,0.38)] bg-[rgba(133,169,255,0.06)]"
                          : "border-white/7 bg-white/[0.025]"
                      }`}
                    >
                      <div>
                        <div className="font-mono text-[10px] text-[var(--shell-sidebar-muted)]">
                          Task {workUnitCode(index)}
                        </div>
                        <div className="mt-1 font-mono text-[9.5px] text-white/46">
                          {workUnitTag(workUnit)}
                        </div>
                        <PlaneProgressBar
                          className="mt-3"
                          value={progress.value}
                          total={progress.total}
                          color={
                            workUnit.status === "completed"
                              ? "var(--status-running)"
                              : workUnit.status === "running"
                                ? "var(--status-planning)"
                                : "rgba(255,255,255,0.18)"
                          }
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium leading-5 text-white">
                          {workUnit.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/58">
                          {workUnit.acceptanceCriteria[0] ?? "Acceptance criteria pending."}
                        </div>
                        <div className="mt-1 truncate font-mono text-[10px] text-white/42">
                          {workUnit.scopePaths[0] ?? "scope pending"}
                        </div>
                        {artifactUri ? (
                          <a
                            className="mt-1 block truncate font-mono text-[10px] text-sky-200/82 transition hover:text-sky-100"
                            href={artifactUri}
                          >
                            Evidence {evidenceLabel(artifactUri)}
                          </a>
                        ) : (
                          <div className="mt-1 font-mono text-[10px] text-white/38">Evidence pending</div>
                        )}
                        {failureReason ? (
                          <div className="mt-1 text-[11px] text-rose-100/78">Failure {failureReason}</div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5 font-mono text-[9.5px] text-[var(--shell-sidebar-muted)] 2xl:justify-end">
                        <span className="inline-flex rounded-[4px] bg-white/[0.03] px-2 py-1">
                          Executor {workUnit.executorType}
                        </span>
                        <span className="inline-flex rounded-[4px] bg-white/[0.03] px-2 py-1">
                          Attempts {attemptCount}
                        </span>
                        <span className="inline-flex rounded-[4px] bg-white/[0.03] px-2 py-1">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-[10px] border border-dashed border-white/8 px-4 py-3 text-[12px] text-white/42">
                    No {lane.label} tasks.
                  </div>
                )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
              Runtime
            </div>
            <div className="text-[16px] font-medium tracking-[-0.02em] text-white">Agent sessions</div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {agentSessions.slice(0, 4).map((session) => (
              <div
                key={session.id}
                className={`rounded-[12px] border px-3 py-3 ${
                  ["starting", "running"].includes(session.status)
                    ? "border-sky-400/24 bg-sky-400/6"
                    : "border-white/7 bg-white/[0.025]"
                }`}
              >
                <div className="flex items-center gap-2 text-[12px] text-white">
                  <span>worker</span>
                  {["starting", "running"].includes(session.status) ? (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
                  ) : null}
                </div>
                <div className="mt-2 font-mono text-[10.5px] text-[var(--shell-sidebar-muted)]">
                  {session.id}
                </div>
                <div className="mt-1 font-mono text-[10.5px] text-[var(--shell-sidebar-muted)]">
                  {session.status} · {session.workItemId}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="event-log" className="overflow-hidden rounded-[14px] border border-white/8 bg-[rgba(8,11,15,0.78)]">
          <div className="flex items-center gap-2 border-b border-white/6 px-4 py-3 text-[11px] text-white/56">
            <span>Event log</span>
            <span className="font-mono text-[10px] text-emerald-300">● live</span>
            <div className="flex-1" />
            <span className="font-mono text-[10px] text-[var(--shell-sidebar-muted)]">
              {initiative.id} · shell
            </span>
          </div>
          <div className="space-y-2 px-4 py-4">
            {logLines.map((line, index) => (
              <div
                key={`${line.label}-${index}`}
                className="grid grid-cols-[70px_140px_minmax(0,1fr)] gap-3 font-mono text-[10.5px] leading-6"
              >
                <span className="text-[var(--shell-sidebar-muted)]">{formatDateTime(line.createdAt).slice(11, 16)}</span>
                <span className="text-sky-200">{line.label}</span>
                <span className="text-white/76">{line.body}</span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <aside className="hidden lg:block">
        <div className="sticky top-0 h-[calc(100vh-56px)] overflow-auto border-l border-[color:var(--shell-sidebar-border)] bg-[rgba(8,11,15,0.6)] px-5 py-5">
          {selectedWorkUnit ? (
            <>
              {(() => {
                const selectedAttemptIds = uniqueAttemptIds(selectedWorkUnit, agentSessions);
                const selectedArtifactUri = artifactEvidenceForWorkUnit(
                  selectedWorkUnit,
                  currentAssembly,
                  orderedWorkUnits.findIndex((unit) => unit.id === selectedWorkUnit.id)
                );
                const selectedFailureReason = failureReasonForWorkUnit(
                  selectedWorkUnit,
                  scopedRefusals
                );

                return (
                  <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shell-sidebar-muted)]">
                    Selected task
                  </div>
                  <div className="mt-3 text-[18px] font-semibold tracking-[-0.03em] text-white">
                    {selectedWorkUnit.title}
                  </div>
                </div>
                <PlaneDisabledAction
                  label="Task action menu"
                  reason={taskMenuReason}
                >
                  •••
                </PlaneDisabledAction>
              </div>

              <div className="mt-2 font-mono text-[10.5px] text-[var(--shell-sidebar-muted)]">
                {`${workUnitCode(workUnitOrder(selectedWorkUnit))} · ${workUnitTag(selectedWorkUnit)}`}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <PlaneStatusPill
                  status={selectedWorkUnit.status}
                  mono
                  size="sm"
                >
                  {selectedWorkUnit.status}
                </PlaneStatusPill>
                <PlaneStatusPill status="neutral" mono size="sm">
                  Attempts {workUnitAttemptCount(selectedWorkUnit, agentSessions)}
                </PlaneStatusPill>
                <PlaneStatusPill status="neutral" mono size="sm">
                  {selectedWorkUnit.executorType}
                </PlaneStatusPill>
              </div>

              <div className="mt-5 grid grid-cols-[90px_1fr] gap-x-4 gap-y-3 rounded-[12px] border border-white/8 bg-white/[0.025] px-4 py-4 text-[11px]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Scope</div>
                <div className="truncate font-mono text-white">{selectedWorkUnit.scopePaths[0] ?? "n/a"}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Executor</div>
                <div className="font-mono text-white">{selectedWorkUnit.executorType}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Started</div>
                <div className="text-white">{formatDateTime(currentRun?.createdAt ?? initiative.createdAt)}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Batch</div>
                <div className="truncate font-mono text-white/82">{currentBatch?.id ?? "n/a"}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Session</div>
                <div className="truncate font-mono text-white/82">
                  {workspaceHostContext?.sessionId ?? "n/a"}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Attempt</div>
                <div className="truncate font-mono text-white/82">
                  {selectedAttemptIds[0] ?? selectedWorkUnit.latestAttemptId ?? "n/a"}
                </div>
              </div>

              <div className="mt-5 rounded-[12px] border border-sky-400/22 bg-sky-400/[0.05] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-[12px] text-sky-100">
                    {latestRunEvent?.kind ?? "run-event"}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--shell-sidebar-muted)]">
                    {formatDateTime(latestRunEvent?.createdAt ?? currentRun?.updatedAt ?? initiative.updatedAt).slice(11, 16)}
                  </div>
                </div>
                <PlaneProgressBar
                  className="mt-3"
                  value={Math.round((workUnitProgress(selectedWorkUnit.status).value / workUnitProgress(selectedWorkUnit.status).total) * 100)}
                  total={100}
                  color="var(--status-planning)"
                />
                <div className="mt-3 text-[11px] leading-6 text-sky-100/82">
                  {latestRunEvent?.summary ?? "No live event detail captured yet."}
                </div>
                <div className="mt-3 grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 font-mono text-[10.5px] text-sky-100/80">
                  <span>file</span>
                  <span>{selectedWorkUnit.scopePaths[0] ?? "n/a"}</span>
                  <span>batch</span>
                  <span>{currentBatch?.id ?? "n/a"}</span>
                  <span>criteria</span>
                  <span>{selectedWorkUnit.acceptanceCriteria[0] ?? "n/a"}</span>
                  <span>evidence</span>
                  <span>
                    {selectedArtifactUri ? evidenceLabel(selectedArtifactUri) : "pending"}
                  </span>
                </div>
              </div>

              {selectedArtifactUri || selectedFailureReason ? (
                <div className="mt-5 rounded-[12px] border border-white/8 bg-white/[0.025] px-4 py-4 text-[11px] leading-6">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                    Attempt evidence
                  </div>
                  {selectedArtifactUri ? (
                    <a
                      className="mt-2 block truncate font-mono text-sky-200/82 transition hover:text-sky-100"
                      href={selectedArtifactUri}
                    >
                      Evidence {evidenceLabel(selectedArtifactUri)}
                    </a>
                  ) : null}
                  {selectedFailureReason ? (
                    <div className="mt-2 text-rose-100/78">
                      Failure {selectedFailureReason}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {recoveries[0] ? (
                <div className="mt-5 rounded-[12px] border border-amber-400/20 bg-amber-400/[0.05] px-4 py-4">
                  <div className="text-[11.5px] font-medium text-amber-100">
                    {recoveries[0].summary}
                  </div>
                  <p className="mt-2 text-[11px] leading-6 text-amber-100/82">
                    {recoveries[0].rootCause ??
                      recoveries[0].recommendedAction ??
                      "Recovery is durable and visible in both shell and workspace."}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <PlaneStatusPill status="pending" mono size="sm">
                      {recoveries[0].status}
                    </PlaneStatusPill>
                    <PlaneStatusPill status="neutral" mono size="sm">
                      {recoveries[0].recoveryActionKind}
                    </PlaneStatusPill>
                  </div>
                  <RecoveryActionStrip
                    recoveryId={recoveries[0].id}
                    canRetry={recoveries[0].status === "retryable" || recoveries[0].status === "open"}
                    canFailover={false}
                    canResolve={false}
                    canReopen={false}
                    retryLabel="Force retry"
                  />
                </div>
              ) : null}

              <div className="mt-5 rounded-[12px] border border-dashed border-white/10 px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                  Manual override
                </div>
                <p className="mt-3 text-[12px] leading-6 text-white/48">
                  Operator controls stay secondary while the system is still progressing autonomously.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <PlaneDisabledAction
                    label="Abort run"
                    reason={abortRunReason}
                  >
                    Abort run
                  </PlaneDisabledAction>
                  <PlaneDisabledAction
                    label="Force retry"
                    reason={forceRetryReason}
                  >
                    Force retry
                  </PlaneDisabledAction>
                  <PlaneDisabledAction
                    label="Pause for review"
                    reason={pauseForReviewReason}
                  >
                    Pause for review
                  </PlaneDisabledAction>
                </div>
              </div>

              <div className="mt-5 rounded-[12px] border border-white/8 bg-white/[0.025] px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                  Tweaks
                </div>
                <div className="mt-4 space-y-4 text-[12px] text-white/72">
                  <div>
                    <div className="text-white">Current surface</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["Frontdoor", "Board", "Run", "Result"].map((item) => (
                        <PlaneStatusPill
                          key={item}
                          status={item === "Run" ? "planning" : "neutral"}
                          mono
                          size="sm"
                        >
                          {item}
                        </PlaneStatusPill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-white">Live stage</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["clarifying", "planning", "running", "verifying"].map((item) => (
                        <PlaneStatusPill
                          key={item}
                          status={item === displayStage ? "planning" : "neutral"}
                          mono
                          size="sm"
                        >
                          {item}
                        </PlaneStatusPill>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </>
          ) : (
            <div className="rounded-[12px] border border-dashed border-white/10 px-4 py-4 text-[12px] text-white/48">
              No work units yet.
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}
