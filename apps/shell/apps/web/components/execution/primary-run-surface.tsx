import Link from "next/link";

import {
  buildExecutionAgentScopeHref,
  buildExecutionAuditsScopeHref,
  buildExecutionBatchScopeHref,
  buildExecutionContinuityScopeHref,
  buildExecutionDeliveryScopeHref,
  buildExecutionRecoveryScopeHref,
  buildExecutionRecoveriesScopeHref,
  buildExecutionReviewScopeHref,
  buildExecutionTaskGraphScopeHref,
  buildExecutionWorkspaceScopeHref,
  routeScopeFromExecutionBindingRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type { ApprovalRequest } from "@/lib/server/control-plane/contracts/approvals";
import type {
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

function statusTone(value: string | null | undefined) {
  switch (value) {
    case "running":
    case "acting":
    case "executing":
    case "healthy":
    case "ready":
    case "completed":
    case "recovered":
      return "border-emerald-500/20 bg-emerald-500/12 text-emerald-100";
    case "planning":
    case "starting":
    case "clarifying":
    case "assembly":
    case "verifying":
    case "building":
      return "border-sky-500/20 bg-sky-500/12 text-sky-100";
    case "blocked":
    case "retryable":
    case "pending":
    case "failing_over":
      return "border-amber-500/20 bg-amber-500/12 text-amber-100";
    case "failed":
    case "dead":
    case "cancelled":
      return "border-rose-500/20 bg-rose-500/12 text-rose-100";
    default:
      return "border-white/10 bg-white/8 text-white/72";
  }
}

function buildWorkUnitSessionMap(agentSessions: AutonomousAgentSessionRecord[]) {
  const map = new Map<string, AutonomousAgentSessionRecord>();

  agentSessions.forEach((session) => {
    const previous = map.get(session.workItemId);
    if (!previous) {
      map.set(session.workItemId, session);
      return;
    }

    const previousAt = previous.startedAt ?? "";
    const nextAt = session.startedAt ?? "";
    if (nextAt.localeCompare(previousAt) >= 0) {
      map.set(session.workItemId, session);
    }
  });

  return map;
}

function formatWorkspaceAccount(context: SessionWorkspaceHostContext | null) {
  if (!context) {
    return "Not linked yet";
  }

  const parts = [context.accountLabel, context.accountId].filter(
    (value): value is string => Boolean(value)
  );

  return parts.length > 0 ? parts.join(" · ") : "Unknown";
}

function formatWorkspaceQuota(context: SessionWorkspaceHostContext | null) {
  if (!context?.quotaState) {
    return "Unknown";
  }

  const parts = [titleCase(context.quotaState.pressure)];
  if (typeof context.quotaState.usedPercent === "number") {
    parts.push(`${Math.round(context.quotaState.usedPercent)}% used`);
  }

  return parts.join(" · ");
}

function formatLaunchState(
  previewTarget: AutonomousPreviewTargetRecord | null,
  delivery: DeliveryRecord | null
) {
  if (
    delivery?.launchProofKind === "runnable_result" &&
    delivery.launchProofAt
  ) {
    return "Runnable";
  }
  if (delivery?.launchProofKind === "synthetic_wrapper") {
    return "Synthetic wrapper";
  }
  if (previewTarget?.healthStatus) {
    return titleCase(previewTarget.healthStatus);
  }
  if (delivery?.status) {
    return titleCase(delivery.status);
  }
  return "Not ready";
}

function formatResultReadiness(
  delivery: DeliveryRecord | null,
  handoffPacket: AutonomousHandoffPacketRecord | null
) {
  if (
    delivery?.launchProofKind === "runnable_result" &&
    delivery.launchProofAt &&
    handoffPacket?.status === "ready"
  ) {
    return "Runnable + handoff ready";
  }
  if (
    delivery?.launchProofKind === "runnable_result" &&
    delivery.launchProofAt
  ) {
    return "Runnable";
  }
  if (delivery?.launchProofKind === "synthetic_wrapper" && handoffPacket?.status === "ready") {
    return "Wrapper + handoff ready";
  }
  if (delivery?.launchProofKind === "synthetic_wrapper") {
    return "Wrapper only";
  }
  if (delivery?.localOutputPath || handoffPacket) {
    return "Partial";
  }
  return "Not published";
}

function metricTile(label: string, value: string | number, detail: string) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">{label}</div>
      <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-white">{value}</div>
      <div className="mt-1 text-[12px] leading-5 text-white/56">{detail}</div>
    </div>
  );
}

type WorkUnitLane = {
  label: string;
  statuses: readonly WorkUnitStatus[];
};

const WORK_UNIT_LANES: WorkUnitLane[] = [
  { label: "Backlog", statuses: ["queued", "ready"] },
  { label: "Todo", statuses: ["dispatched"] },
  { label: "In Progress", statuses: ["running", "blocked", "retryable"] },
  { label: "Done", statuses: ["completed", "failed"] },
];

export function PrimaryRunSurface({
  routeScope,
  initiative,
  currentRun,
  currentTaskGraph,
  currentBatch,
  currentDelivery,
  currentPreviewTarget,
  latestRunEvent,
  currentHandoffPacket,
  plannerNotes,
  workUnits,
  agentSessions,
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
  plannerNotes: string[];
  workUnits: WorkUnitRecord[];
  agentSessions: AutonomousAgentSessionRecord[];
  recoveryIncidents: RecoveryIncident[];
  approvalRequests: ApprovalRequest[];
  workspaceHostContext: SessionWorkspaceHostContext | null;
}) {
  const workUnitSessionMap = buildWorkUnitSessionMap(agentSessions);
  const activeAgents = agentSessions.filter((session) =>
    ["starting", "running"].includes(session.status)
  ).length;
  const pendingApprovals = approvalRequests.filter((request) => request.status === "pending");
  const activeRecoveries = recoveryIncidents.filter((incident) =>
    ["open", "retryable", "failing_over"].includes(incident.status)
  );
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
  const deliveryHref = currentDelivery
    ? buildExecutionDeliveryScopeHref(currentDelivery.id, scopedRoute, {
        initiativeId: initiative.id,
      })
    : null;
  const lanePreview = WORK_UNIT_LANES.map((lane) => ({
    label: lane.label,
    items: workUnits.filter((workUnit) => lane.statuses.includes(workUnit.status)),
  }));
  const runtimeUnavailable =
    latestRunEvent?.kind === "runtime.unavailable" ? latestRunEvent : null;

  return (
    <main className="mx-auto grid max-w-[1520px] gap-5 xl:grid-cols-[minmax(0,1.55fr)_340px]">
      <div className="grid gap-5">
        <section className="overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0)),#111827]">
          <div className="border-b border-white/8 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Execution / Primary run
                </div>
                <div>
                  <h1 className="truncate text-[28px] font-semibold tracking-[-0.05em] text-white">
                    {initiative.title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-[13px] leading-6 text-white/58">
                    {currentRun?.originalPrompt ?? initiative.userRequest}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${statusTone(currentRun?.currentStage ?? initiative.status)}`}>
                    {titleCase(currentRun?.currentStage ?? initiative.status)}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${statusTone(currentRun?.health)}`}>
                    {titleCase(currentRun?.health ?? "unknown")}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${statusTone(currentRun?.previewStatus)}`}>
                    Preview {titleCase(currentRun?.previewStatus ?? "none")}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${statusTone(currentRun?.handoffStatus)}`}>
                    Handoff {titleCase(currentRun?.handoffStatus ?? "none")}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {workspaceHref ? (
                  <Link
                    href={workspaceHref}
                    className="inline-flex items-center rounded-full border border-sky-500/20 bg-sky-500/15 px-3.5 py-2 text-[12px] font-medium text-sky-100"
                  >
                    Open workspace
                  </Link>
                ) : null}
                <Link
                  href={buildExecutionContinuityScopeHref(initiative.id, scopedRoute)}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3.5 py-2 text-[12px] font-medium text-white/82"
                >
                  Continuity
                </Link>
                <Link
                  href={buildExecutionReviewScopeHref(scopedRoute, "approvals")}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3.5 py-2 text-[12px] font-medium text-white/82"
                >
                  Review
                </Link>
                <Link
                  href={buildExecutionAuditsScopeHref(scopedRoute)}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3.5 py-2 text-[12px] font-medium text-white/82"
                >
                  Audits
                </Link>
              </div>
            </div>
          </div>

          {runtimeUnavailable ? (
            <div className="border-b border-amber-500/15 bg-amber-500/10 px-6 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-amber-200">
                Runtime unavailable
              </div>
              <div className="mt-1 text-[14px] text-amber-50">
                {runtimeUnavailable.summary}
              </div>
              <div className="mt-2 text-[12px] leading-5 text-amber-100/80">
                {typeof runtimeUnavailable.payload.detail === "string"
                  ? runtimeUnavailable.payload.detail
                  : "Autonomous dispatch could not reach the local execution kernel."}
              </div>
              {typeof runtimeUnavailable.payload.recoveryCommand === "string" ? (
                <div className="mt-3 break-all rounded-[14px] border border-amber-400/20 bg-black/10 px-3 py-2 font-mono text-[11px] leading-5 text-amber-50">
                  {runtimeUnavailable.payload.recoveryCommand}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
            {metricTile("Current stage", titleCase(currentRun?.currentStage ?? initiative.status), currentTaskGraph ? `Task graph ${titleCase(currentTaskGraph.status)}` : "Task graph not generated yet")}
            {metricTile("Task board", workUnits.length, workUnits.length ? `${workUnits.filter((workUnit) => ["running", "blocked", "retryable"].includes(workUnit.status)).length} active or attention items` : "No work units yet")}
            {metricTile("Agent activity", activeAgents, agentSessions.length ? `${agentSessions.length} recorded agent sessions` : "No agent sessions yet")}
            {metricTile("Recoveries", activeRecoveries.length, activeRecoveries.length ? `${pendingApprovals.length} approvals and recoveries visible without route hopping` : "No open recovery incidents")}
          </div>
        </section>

        <section className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/8 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">Task board</div>
                <div className="mt-1 text-[16px] font-medium text-white">Current execution lanes</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[12px] text-white/52">
                  {currentBatch ? `Batch ${titleCase(currentBatch.status)}` : "Waiting for batch"}
                </div>
                {taskGraphHref ? (
                  <Link
                    href={taskGraphHref}
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/82"
                  >
                    Task graph
                  </Link>
                ) : null}
                {batchHref ? (
                  <Link
                    href={batchHref}
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/82"
                  >
                    Batch
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
          <div>
            {lanePreview.map((lane) => (
              <div key={lane.label} className="border-t border-white/8 first:border-t-0">
                <div className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="text-[15px] font-medium text-white">{lane.label}</div>
                    <div className="text-[13px] text-white/46">{lane.items.length}</div>
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/36">
                    work-unit status
                  </div>
                </div>
                {lane.items.length > 0 ? (
                  lane.items.map((workUnit) => {
                    const latestAgent = workUnitSessionMap.get(workUnit.id) ?? null;

                    return (
                      <div
                        key={workUnit.id}
                        className="grid grid-cols-[88px_minmax(0,1fr)_120px] items-center gap-3 border-t border-white/8 px-5 py-3.5"
                      >
                        <div className="text-[12px] text-white/48">{workUnit.id}</div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] text-white/88">{workUnit.title}</div>
                          <div className="mt-1 truncate text-[12px] text-white/48">
                            {workUnit.description || "No work-unit description"}
                          </div>
                        </div>
                        <div className="text-[12px] text-white/56">
                          {latestAgent?.runtimeRef ??
                            titleCase(latestAgent?.status ?? workUnit.executorType)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="border-t border-white/8 px-5 py-3 text-[13px] text-white/42">
                    No items in this lane
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/8 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">Agent activity</div>
                  <div className="mt-1 text-[16px] font-medium text-white">Latest worker sessions</div>
                </div>
                <Link
                  href={buildExecutionReviewScopeHref(scopedRoute, "attention")}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/82"
                >
                  Agent board
                </Link>
              </div>
            </div>
            <div>
              {agentSessions.length > 0 ? (
                [...agentSessions]
                  .sort((left, right) =>
                    (right.startedAt ?? right.id).localeCompare(left.startedAt ?? left.id)
                  )
                  .slice(0, 6)
                  .map((agentSession) => (
                    <div
                      key={agentSession.id}
                      className="grid grid-cols-[minmax(0,1fr)_120px] gap-3 border-t border-white/8 px-5 py-3.5 first:border-t-0"
                    >
                      <div className="min-w-0">
                        {agentSession.id ? (
                          <Link
                            href={buildExecutionAgentScopeHref(agentSession.id, scopedRoute)}
                            className="truncate text-[13px] text-white/88 underline-offset-4 hover:underline"
                          >
                            {agentSession.runtimeRef ?? agentSession.id}
                          </Link>
                        ) : (
                          <div className="truncate text-[13px] text-white/88">
                            {agentSession.runtimeRef ?? agentSession.id}
                          </div>
                        )}
                        <div className="mt-1 truncate text-[12px] text-white/48">
                          work unit {agentSession.workItemId}
                        </div>
                      </div>
                      <div className="text-[12px] text-white/62">
                        {titleCase(agentSession.status)}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="px-5 py-4 text-[13px] text-white/42">
                  Agent sessions will appear here once the first batch is dispatched.
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/8 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">Localhost result</div>
                  <div className="mt-1 text-[16px] font-medium text-white">Artifact, launch, and handoff state</div>
                </div>
                {deliveryHref ? (
                  <Link
                    href={deliveryHref}
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/82"
                  >
                    Delivery
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 px-5 py-4 text-[12px] text-white/62">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Evidence wrapper</div>
                  <div className="mt-2 text-[14px] text-white">
                    {currentDelivery?.previewUrl ? "Available" : "Pending"}
                  </div>
                  <div className="mt-2 break-all text-[11px] leading-5 text-white/68">
                    {currentDelivery?.previewUrl ??
                      currentPreviewTarget?.sourcePath ??
                      "No shell evidence wrapper emitted yet"}
                  </div>
                  <div className="mt-3 break-all text-[11px] leading-5 text-white/48">
                    local bundle {currentDelivery?.localOutputPath ?? "pending"}
                  </div>
                  <div className="mt-1 break-all text-[11px] leading-5 text-white/48">
                    manifest {currentDelivery?.manifestPath ?? "pending"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentDelivery?.previewUrl ? (
                      <Link
                        href={currentDelivery.previewUrl}
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/82"
                      >
                        Open evidence wrapper
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Runnable result</div>
                  <div className="mt-2 text-[14px] text-white">
                    {formatLaunchState(currentPreviewTarget, currentDelivery)}
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-white/48">
                    {currentDelivery?.launchTargetLabel ??
                      (currentDelivery?.launchProofKind === "runnable_result"
                        ? "Actual runnable target"
                        : currentDelivery?.launchProofKind === "synthetic_wrapper"
                          ? "Shell evidence wrapper"
                          : "Launch target not classified")}
                  </div>
                  <div className="mt-2 break-all font-mono text-[11px] leading-5 text-white/68">
                    {currentPreviewTarget?.launchCommand ??
                      currentDelivery?.command ??
                      "Launch command not available yet"}
                  </div>
                  <div className="mt-3 break-all text-[11px] leading-5 text-white/48">
                    manifest {currentDelivery?.launchManifestPath ?? "pending"}
                  </div>
                  <div className="mt-1 break-all text-[11px] leading-5 text-white/48">
                    proof {currentDelivery?.launchProofUrl ?? "not proven yet"}
                  </div>
                </div>

                <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Handoff metadata</div>
                  <div className="mt-2 text-[14px] text-white">
                    {titleCase(currentHandoffPacket?.status ?? currentRun?.handoffStatus ?? "none")}
                  </div>
                  <div className="mt-2 break-all text-[11px] leading-5 text-white/68">
                    {currentHandoffPacket?.rootPath ??
                      currentDelivery?.manifestPath ??
                      "No evidence bundle yet"}
                  </div>
                  <div className="mt-3 break-all text-[11px] leading-5 text-white/48">
                    final summary {currentHandoffPacket?.finalSummaryPath ?? "pending"}
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Overall readiness</div>
                <div className="mt-2 text-[14px] text-white">
                  {formatResultReadiness(currentDelivery, currentHandoffPacket)}
                </div>
                <div className="mt-2 text-[11px] leading-5 text-white/56">
                  Shell wrapper evidence and handoff metadata can be ready independently. The shell only promotes the result to ready after a real runnable target is proven locally.
                </div>
              </div>
            </div>
          </div>
        </section>

        {plannerNotes.length > 0 ? (
          <section className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/8 px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">Planner metadata</div>
              <div className="mt-1 text-[16px] font-medium text-white">Critical path and planning risk</div>
            </div>
            <ul className="space-y-2 px-5 py-4 text-[12px] leading-6 text-white/58">
              {plannerNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <aside className="grid gap-5">
        <section className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/8 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">Live recovery stream</div>
                <div className="mt-1 text-[16px] font-medium text-white">Current recoveries</div>
              </div>
              <Link
                href={buildExecutionRecoveriesScopeHref(scopedRoute)}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/82"
              >
                Recoveries
              </Link>
            </div>
          </div>
          <div>
            {recoveryIncidents.length > 0 ? (
              recoveryIncidents
                .slice()
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
                .slice(0, 5)
                .map((incident) => (
                  <div key={incident.id} className="border-t border-white/8 px-5 py-3.5 first:border-t-0">
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={buildExecutionRecoveryScopeHref(incident.id, scopedRoute)}
                        className="text-[13px] text-white/88 underline-offset-4 hover:underline"
                      >
                        {incident.summary}
                      </Link>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusTone(incident.status)}`}>
                        {titleCase(incident.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-white/48">
                      {incident.recommendedAction ?? incident.rootCause ?? "Awaiting operator action"}
                    </div>
                  </div>
                ))
            ) : (
              <div className="px-5 py-4 text-[13px] text-white/42">
                No live recoveries for this run.
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/8 px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">Approvals</div>
            <div className="mt-1 text-[16px] font-medium text-white">Pending decisions</div>
          </div>
          <div>
            {pendingApprovals.length > 0 ? (
              pendingApprovals.slice(0, 4).map((approval) => (
                <div key={approval.id} className="border-t border-white/8 px-5 py-3.5 first:border-t-0">
                  <div className="text-[13px] text-white/88">{approval.title}</div>
                  <div className="mt-1 text-[12px] leading-5 text-white/48">{approval.summary}</div>
                </div>
              ))
            ) : (
              <div className="px-5 py-4 text-[13px] text-white/42">
                No pending approvals for this run.
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/8 px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">Run context</div>
            <div className="mt-1 text-[16px] font-medium text-white">Shell-linked workspace state</div>
          </div>
          <div className="grid gap-3 px-5 py-4 text-[12px] text-white/62">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Workspace session</div>
              <div className="mt-1 break-all text-[11px] leading-5 text-white/68">
                {workspaceSessionId ?? "No linked session"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Account</div>
              <div className="mt-1 text-[14px] text-white">{formatWorkspaceAccount(workspaceHostContext)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Quota</div>
              <div className="mt-1 text-[14px] text-white">{formatWorkspaceQuota(workspaceHostContext)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Opened from</div>
              <div className="mt-1 text-[14px] text-white">{titleCase(workspaceHostContext?.openedFrom)}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href={buildExecutionRecoveriesScopeHref(scopedRoute)}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-2 text-[12px] text-white/82"
              >
                Open recoveries
              </Link>
              <Link
                href={buildExecutionReviewScopeHref(scopedRoute, "approvals")}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-2 text-[12px] text-white/82"
              >
                Open approvals
              </Link>
            </div>
          </div>
        </section>
      </aside>
    </main>
  );
}
