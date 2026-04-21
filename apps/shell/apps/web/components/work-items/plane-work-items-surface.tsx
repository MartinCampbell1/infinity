import Link from "next/link";

import {
  buildExecutionContinuityScopeHref,
  buildExecutionTaskGraphScopeHref,
  buildExecutionWorkspaceScopeHref,
  routeScopeFromExecutionBindingRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type {
  DeliveryRecord,
  ExecutionBatchRecord,
  InitiativeRecord,
  TaskGraphRecord,
  WorkUnitRecord,
  WorkUnitStatus,
} from "@/lib/server/control-plane/contracts/orchestration";
import type {
  AutonomousAgentSessionRecord,
  AutonomousHandoffPacketRecord,
  AutonomousPreviewTargetRecord,
  AutonomousRunRecord,
} from "@/lib/server/control-plane/state/types";
import type { SessionWorkspaceHostContext } from "@/lib/server/control-plane/contracts/workspace-launch";

function titleCase(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildWorkUnitSessionMap(agentSessions: AutonomousAgentSessionRecord[]) {
  const map = new Map<string, AutonomousAgentSessionRecord>();
  for (const session of agentSessions) {
    const previous = map.get(session.workItemId);
    if (!previous) {
      map.set(session.workItemId, session);
      continue;
    }
    const previousAt = previous.startedAt ?? "";
    const nextAt = session.startedAt ?? "";
    if (nextAt.localeCompare(previousAt) >= 0) {
      map.set(session.workItemId, session);
    }
  }
  return map;
}

function formatWorkspaceAccount(context: SessionWorkspaceHostContext | null) {
  if (!context) {
    return "Not available";
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

function formatPendingApprovals(context: SessionWorkspaceHostContext | null) {
  if (!context) {
    return "Not available";
  }

  return String(context.pendingApprovals ?? 0);
}

function formatResultState(
  delivery: DeliveryRecord | null,
  handoff: AutonomousHandoffPacketRecord | null
) {
  if (delivery?.launchProofAt && handoff?.status === "ready") {
    return "Runnable + handoff ready";
  }
  if (delivery?.launchProofAt) {
    return "Runnable";
  }
  if (delivery?.localOutputPath || handoff) {
    return "Artifact only";
  }
  return "No result yet";
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function PlaneWorkItemsSurface({
  routeScope,
  currentInitiative,
  currentRun,
  currentTaskGraph,
  currentBatch,
  currentDelivery,
  currentPreviewTarget,
  currentHandoffPacket,
  workUnits,
  agentSessions,
  workspaceHostContext,
}: {
  routeScope?: ShellRouteScope;
  currentInitiative: InitiativeRecord | null;
  currentRun: AutonomousRunRecord | null;
  currentTaskGraph: TaskGraphRecord | null;
  currentBatch: ExecutionBatchRecord | null;
  currentDelivery: DeliveryRecord | null;
  currentPreviewTarget: AutonomousPreviewTargetRecord | null;
  currentHandoffPacket: AutonomousHandoffPacketRecord | null;
  workUnits: WorkUnitRecord[];
  agentSessions: AutonomousAgentSessionRecord[];
  workspaceHostContext: SessionWorkspaceHostContext | null;
}) {
  const workUnitSessionMap = buildWorkUnitSessionMap(agentSessions);
  const boardWorkUnits = [...workUnits].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const recentWorkItems = boardWorkUnits.slice(0, 3);
  const activeWorkItems = boardWorkUnits.filter((workUnit) =>
    ["running", "blocked", "retryable"].includes(workUnit.status)
  ).length;
  const workspaceSessionId =
    workspaceHostContext?.sessionId ??
    currentInitiative?.workspaceSessionId ??
    routeScope?.sessionId ??
    null;
  const workspaceRouteScope = routeScopeFromExecutionBindingRef(
    {
      sessionId: workspaceSessionId,
      groupId: workspaceHostContext?.groupId,
      accountId: workspaceHostContext?.accountId,
      workspaceId: workspaceHostContext?.workspaceId,
    },
    routeScope
  );
  const workspaceHref = workspaceSessionId
    ? buildExecutionWorkspaceScopeHref(workspaceSessionId, workspaceRouteScope)
    : null;
  const continuityHref = currentInitiative
    ? buildExecutionContinuityScopeHref(currentInitiative.id, routeScope)
    : null;
  const taskGraphHref = currentTaskGraph
    ? buildExecutionTaskGraphScopeHref(currentTaskGraph.id, routeScope, {
        initiativeId: currentInitiative?.id ?? currentTaskGraph.initiativeId,
      })
    : null;
  const laneDefinitions: Array<{
    label: string;
    statuses: readonly WorkUnitStatus[];
  }> = [
    { label: "Backlog", statuses: ["queued", "ready"] },
    { label: "Todo", statuses: ["dispatched"] },
    { label: "In Progress", statuses: ["running", "blocked", "retryable"] },
    { label: "Done", statuses: ["completed", "failed"] },
  ];
  const lanePreview = laneDefinitions.map((lane) => {
    const items = boardWorkUnits.filter((workUnit) => lane.statuses.includes(workUnit.status));

    return {
      label: lane.label,
      count: items.length,
      items,
    };
  });

  return (
    <main className="mx-auto grid max-w-[1520px] gap-5 xl:grid-cols-[minmax(0,1.55fr)_340px]">
      <section className="overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0)),#111827]">
        <div className="border-b border-white/8 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                Work items
              </div>
              <div className="mt-2 truncate text-[26px] font-semibold tracking-[-0.04em] text-white">
                {currentInitiative?.title ?? "No live initiative"}
              </div>
              <div className="mt-2 text-[13px] text-white/52">
                {titleCase(currentRun?.currentStage ?? currentInitiative?.status)} · {titleCase(currentTaskGraph?.status ?? "draft")} · Batch {titleCase(currentBatch?.status ?? "not_started")}
              </div>
              <div className="mt-3 max-w-3xl text-[13px] leading-6 text-white/56">
                Shell board for live work items with the linked work-ui session available as
                the embedded workspace.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[12px] text-white/82">
              <span className="inline-flex items-center rounded-[10px] border border-white/10 bg-white/5 px-3 py-2">
                task graph truth
              </span>
              <span className="inline-flex items-center rounded-[10px] border border-white/10 bg-white/5 px-3 py-2">
                status lanes derived from work-unit state
              </span>
              {workspaceHref ? (
                <Link
                  href={workspaceHref}
                  className="inline-flex items-center rounded-[10px] border border-sky-500/20 bg-sky-500/15 px-3 py-2 text-sky-100"
                >
                  Open workspace
                </Link>
              ) : null}
              {continuityHref ? (
                <Link
                  href={continuityHref}
                  className="inline-flex items-center rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/82"
                >
                  Continuity
                </Link>
              ) : null}
              {taskGraphHref ? (
                <Link
                  href={taskGraphHref}
                  className="inline-flex items-center rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/82"
                >
                  Task graph
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-white/8 px-4 py-4 md:grid-cols-3">
          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Board health</div>
            <div className="mt-2 text-[18px] font-medium text-white">{activeWorkItems} active</div>
            <div className="mt-1 text-[12px] leading-5 text-white/56">
              {boardWorkUnits.length} tracked work items across the current task graph.
            </div>
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Result state</div>
            <div className="mt-2 text-[18px] font-medium text-white">
              {formatResultState(currentDelivery, currentHandoffPacket)}
            </div>
            <div className="mt-1 text-[12px] leading-5 text-white/56">
              {currentDelivery?.launchProofUrl ??
                currentDelivery?.localOutputPath ??
                "No localhost proof or artifact bundle yet."}
            </div>
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Session context</div>
            <div className="mt-2 text-[18px] font-medium text-white">
              {workspaceHostContext?.accountLabel ?? currentInitiative?.requestedBy ?? "Not linked"}
            </div>
            <div className="mt-1 text-[12px] leading-5 text-white/56">
              {workspaceHostContext
                ? `${titleCase(workspaceHostContext.executionMode)} · ${formatWorkspaceQuota(workspaceHostContext)}`
                : "Open workspace once the shell binds a live session."}
            </div>
          </div>
        </div>

        <div>
          {lanePreview.map((lane) => (
            <div key={lane.label} className="border-t border-white/8 first:border-t-0">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="text-[15px] font-medium text-white">{lane.label}</div>
                  <div className="text-[13px] text-white/46">{lane.count}</div>
                </div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/36">
                  work-unit status
                </div>
              </div>
              {lane.items.length > 0 ? (
                lane.items.map((workUnit) => {
                  const agentSession = workUnitSessionMap.get(workUnit.id) ?? null;
                  const runtimeLabel =
                    agentSession?.runtimeRef ??
                    (agentSession?.status ? titleCase(agentSession.status) : titleCase(workUnit.executorType));

                  return (
                    <div
                      key={workUnit.id}
                      className="grid grid-cols-[96px_minmax(0,1fr)_110px_28px] items-center border-t border-white/8 px-4 py-3.5"
                    >
                      <div className="text-[12px] text-white/52">{workUnit.id}</div>
                      <div className="min-w-0 text-[13px] text-white/84">{workUnit.title}</div>
                      <div className="text-[12px] text-white/52">{runtimeLabel}</div>
                      <div className="text-right text-[18px] text-white/42">⋯</div>
                    </div>
                  );
                })
              ) : (
                <div className="border-t border-white/8 px-4 py-3.5 text-[13px] text-white/42">
                  No items
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="overflow-hidden rounded-[16px] border border-white/10 bg-white/4">
          <div className="px-4 py-4">
            <div className="text-[12px] font-medium text-white">Embedded workspace</div>
            <div className="mt-2 text-[13px] leading-6 text-white/62">
              Work-ui stays mounted as the live session canvas while the shell tracks the
              task board, preview status, and delivery artifacts.
            </div>
            {workspaceHref ? (
              <Link
                href={workspaceHref}
                className="mt-4 inline-flex items-center rounded-[10px] border border-white/10 bg-white/6 px-3 py-2 text-[12px] text-white/86"
              >
                Open workspace
              </Link>
            ) : (
              <div className="mt-4 inline-flex items-center rounded-[10px] border border-white/10 bg-white/4 px-3 py-2 text-[12px] text-white/48">
                Workspace session not linked yet
              </div>
            )}
          </div>
          <div className="border-t border-white/8 px-4 py-4 text-[12px] text-white/62">
            <div className="grid gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Stage</div>
                <div className="mt-1 text-[14px] text-white">{titleCase(currentRun?.currentStage ?? currentInitiative?.status)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Workspace session</div>
                <div className="mt-1 break-all text-[11px] leading-5 text-white/68">
                  {workspaceSessionId ?? "No linked session"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Account</div>
                <div className="mt-1 break-all text-[11px] leading-5 text-white/68">
                  {formatWorkspaceAccount(workspaceHostContext)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Model</div>
                <div className="mt-1 break-all text-[11px] leading-5 text-white/68">
                  {workspaceHostContext?.model ?? "Unknown"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Execution mode</div>
                <div className="mt-1 text-[14px] text-white">
                  {titleCase(workspaceHostContext?.executionMode)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Quota</div>
                <div className="mt-1 text-[14px] text-white">
                  {formatWorkspaceQuota(workspaceHostContext)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Pending approvals</div>
                <div className="mt-1 text-[14px] text-white">
                  {formatPendingApprovals(workspaceHostContext)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Opened from</div>
                <div className="mt-1 text-[14px] text-white">
                  {titleCase(workspaceHostContext?.openedFrom)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Batch</div>
                <div className="mt-1 text-[14px] text-white">{titleCase(currentBatch?.status ?? "not_started")}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[16px] border border-white/10 bg-white/4">
          <div className="border-b border-white/8 px-4 py-4">
            <div className="text-[12px] font-medium text-white">Recent changes</div>
            <div className="mt-2 text-[13px] leading-6 text-white/62">
              Most recently touched work items across the current task graph.
            </div>
          </div>
          <div>
            {recentWorkItems.length > 0 ? (
              recentWorkItems.map((workUnit) => {
                const agentSession = workUnitSessionMap.get(workUnit.id) ?? null;
                const runtimeLabel =
                  agentSession?.runtimeRef ??
                  (agentSession?.status
                    ? titleCase(agentSession.status)
                    : titleCase(workUnit.executorType));

                return (
                  <div
                    key={workUnit.id}
                    className="border-t border-white/8 px-4 py-3 first:border-t-0"
                  >
                    <div className="text-[12px] font-medium text-white">{workUnit.title}</div>
                    <div className="mt-1 text-[11px] leading-5 text-white/58">
                      {titleCase(workUnit.status)} · {runtimeLabel}
                    </div>
                    <div className="mt-1 text-[10px] text-white/42">
                      Updated {formatTimestamp(workUnit.updatedAt)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {taskGraphHref ? (
                        <Link
                          href={taskGraphHref}
                          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/72"
                        >
                          Open graph
                        </Link>
                      ) : null}
                      {continuityHref ? (
                        <Link
                          href={continuityHref}
                          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/72"
                        >
                          Open run
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-4 text-[12px] text-white/48">
                No work-item activity yet.
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[16px] border border-white/10 bg-white/4">
          <div className="border-b border-white/8 px-4 py-4">
            <div className="text-[12px] font-medium text-white">Result readiness</div>
            <div className="mt-2 text-[13px] leading-6 text-white/62">
              Shell-side read on artifact, localhost proof, and handoff state.
            </div>
          </div>
          <div className="grid gap-3 px-4 py-4 text-[12px] text-white/62">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Delivery</div>
              <div className="mt-1 text-[14px] text-white">
                {formatResultState(currentDelivery, currentHandoffPacket)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Artifact bundle</div>
              <div className="mt-1 break-all text-[11px] leading-5 text-white/68">
                {currentDelivery?.localOutputPath ?? "No artifact bundle yet"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Launch proof</div>
              <div className="mt-1 break-all text-[11px] leading-5 text-white/68">
                {currentDelivery?.launchProofUrl ?? "No localhost proof yet"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Handoff packet</div>
              <div className="mt-1 break-all text-[11px] leading-5 text-white/68">
                {currentHandoffPacket?.rootPath ?? "No handoff packet yet"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {continuityHref ? (
                <Link
                  href={continuityHref}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/72"
                >
                  Open run
                </Link>
              ) : null}
              {workspaceHref ? (
                <Link
                  href={workspaceHref}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/72"
                >
                  Workspace
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </aside>
    </main>
  );
}
