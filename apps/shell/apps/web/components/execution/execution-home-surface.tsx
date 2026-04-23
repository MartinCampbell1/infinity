import {
  buildExecutionAccountsScopeHref,
  buildExecutionApprovalsScopeHref,
  buildExecutionAuditsScopeHref,
  buildExecutionBatchScopeHref,
  buildExecutionContinuityScopeHref,
  buildExecutionDeliveryScopeHref,
  buildExecutionEventsScopeHref,
  buildExecutionHandoffsScopeHref,
  buildExecutionRecoveriesScopeHref,
  buildExecutionAgentsScopeHref,
  buildExecutionIssuesScopeHref,
  buildExecutionSessionsScopeHref,
  buildExecutionTaskGraphScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type { ControlPlaneAccountRecord } from "@/lib/server/control-plane/accounts";
import type { ApprovalRequestsDirectory } from "@/lib/server/control-plane/contracts/approvals";
import type { RecoveryIncidentsDirectory } from "@/lib/server/control-plane/contracts/recoveries";
import type { OperatorActionAuditDirectory } from "@/lib/server/control-plane/contracts/operator-actions";
import type { ExecutionSessionSummary } from "@/lib/server/control-plane/contracts/session-events";
import type {
  DeliveryRecord,
  ExecutionBatchRecord,
  InitiativeRecord,
} from "@/lib/server/control-plane/contracts/orchestration";
import type { ExecutionKernelAvailability } from "@/lib/server/orchestration/batches";

import { ExecutionRunComposer } from "./execution-run-composer";
import {
  PlaneRunHeader,
  PlaneRunMetricTile,
  PlaneRunModule,
  PlaneRunPillLink,
} from "./plane-run-primitives";

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

type ExecutionHomeSurfaceProps = {
  routeScope?: ShellRouteScope;
  sessions: ExecutionSessionSummary[];
  approvals: ApprovalRequestsDirectory;
  recoveries: RecoveryIncidentsDirectory;
  audits: OperatorActionAuditDirectory;
  accounts: ControlPlaneAccountRecord[];
  currentInitiative: InitiativeRecord | null;
  currentBatch: ExecutionBatchRecord | null;
  currentDelivery: DeliveryRecord | null;
  kernelAvailability: ExecutionKernelAvailability;
};

export function ExecutionHomeSurface({
  routeScope,
  sessions,
  approvals,
  recoveries,
  audits,
  accounts,
  currentInitiative,
  currentBatch,
  currentDelivery,
  kernelAvailability,
}: ExecutionHomeSurfaceProps) {
  const activeSessions = sessions.filter((session) =>
    ["starting", "planning", "acting", "validating"].includes(session.status)
  ).length;
  const leadSession =
    sessions.find((session) =>
      ["starting", "planning", "acting", "validating", "waiting_for_approval", "blocked"].includes(
        session.status
      )
    ) ?? sessions[0] ?? null;
  const pendingApproval =
    approvals.requests.find((request) => request.status === "pending") ?? null;
  const activeRecovery =
    recoveries.incidents.find((incident) =>
      ["retryable", "failing_over", "open"].includes(incident.status)
    ) ?? null;
  const retryableRecoveries = recoveries.incidents.filter((incident) =>
    ["retryable", "failing_over"].includes(incident.status)
  ).length;
  const schedulableAccounts = accounts.filter((account) => account.capacity.schedulable).length;
  const preferredAccount =
    accounts.find((account) => account.capacity.preferredForNewSessions) ?? null;
  const pressuredAccount =
    accounts.find((account) => !account.capacity.schedulable) ??
    accounts.find((account) => account.capacity.pressure === "high") ??
    null;
  const kernelGeneratedAt = kernelAvailability.generatedAt
    ? new Date(kernelAvailability.generatedAt).toLocaleTimeString("en", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const kernelTone = !kernelAvailability.available
    ? "border-amber-500/20 bg-amber-500/12 text-amber-100"
    : kernelAvailability.recoveryState === "retryable"
      ? "border-amber-500/20 bg-amber-500/12 text-amber-100"
    : kernelAvailability.runtimeState === "blocked" || kernelAvailability.failureState === "failed"
      ? "border-rose-500/20 bg-rose-500/12 text-rose-100"
      : kernelAvailability.restartRecoverable
        ? "border-sky-500/20 bg-sky-500/12 text-sky-100"
        : "border-emerald-500/20 bg-emerald-500/12 text-emerald-100";
  const kernelLabel = !kernelAvailability.available
    ? "execution-kernel offline"
    : kernelAvailability.recoveryState === "retryable"
      ? "execution-kernel local scaffold retryable"
    : kernelAvailability.runtimeState === "blocked"
      ? "execution-kernel local scaffold blocked"
    : kernelAvailability.restartRecoverable
        ? "execution-kernel local scaffold restart-recoverable"
        : "execution-kernel local scaffold";

  return (
    <main className="mx-auto flex max-w-[1480px] flex-col gap-5">
      <header className="shell-surface-elevated space-y-5 px-5 py-5">
        <PlaneRunHeader
          eyebrow="Execution"
          title="Operator hub"
          description="FounderOS-first shell for active execution, approvals, recoveries, audits, capacity, and the embedded work-ui session that carries live project work."
          actions={
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/62">
                shell truth = durable control plane
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/62">
                work-ui = embedded workspace / session canvas
              </span>
            </>
          }
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <PlaneRunMetricTile label="Active sessions" value={activeSessions} detail="Runs still moving" />
          <PlaneRunMetricTile label="Pending approvals" value={approvals.summary.pending} detail="Operator decisions waiting" />
          <PlaneRunMetricTile label="Retryable recoveries" value={retryableRecoveries} detail="Sessions needing intervention" />
          <PlaneRunMetricTile label="Schedulable accounts" value={schedulableAccounts} detail="Capacity available for new work" />
          <PlaneRunMetricTile label="Audit events" value={audits.summary.total} detail="Durable operator trail" />
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <div className="grid gap-5">
          <PlaneRunModule title="Continue work">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="rounded-2xl bg-[color:var(--shell-control-bg)] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Lead session
                </div>
                <div className="mt-3 text-[18px] font-medium text-foreground">
                  {leadSession?.title ?? "No live session"}
                </div>
                <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                  {leadSession
                    ? `${titleCase(leadSession.status)} · ${leadSession.projectName} · ${leadSession.toolActivityCount} tool events`
                    : "No non-archived session is available yet."}
                </div>
                {leadSession ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1">
                      {leadSession.pendingApprovals} approvals
                    </span>
                    <span className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1">
                      quota {leadSession.quotaPressure}
                    </span>
                    <span className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1">
                      {leadSession.provider}
                    </span>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <PlaneRunPillLink href={buildExecutionSessionsScopeHref(routeScope)}>
                    Session lane
                  </PlaneRunPillLink>
                  {currentInitiative ? (
                    <PlaneRunPillLink
                      href={buildExecutionContinuityScopeHref(currentInitiative.id, routeScope)}
                    >
                      Continue initiative
                    </PlaneRunPillLink>
                  ) : null}
                  {currentDelivery ? (
                    <PlaneRunPillLink
                      href={buildExecutionDeliveryScopeHref(currentDelivery.id, routeScope, {
                        initiativeId: currentDelivery.initiativeId,
                      })}
                    >
                      Review delivery
                    </PlaneRunPillLink>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl bg-[color:var(--shell-control-bg)] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Active initiative
                </div>
                <div className="mt-3 text-[18px] font-medium text-foreground">
                  {currentInitiative?.title ?? "No active initiative"}
                </div>
                <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                  {currentInitiative
                    ? `${titleCase(currentInitiative.status)} · requested by ${currentInitiative.requestedBy}`
                    : "No active initiative is bound to the execution hub."}
                </div>
                {currentInitiative?.userRequest ? (
                  <div className="mt-3 max-w-3xl text-[13px] leading-6 text-muted-foreground">
                    {currentInitiative.userRequest}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {currentBatch ? (
                    <PlaneRunPillLink
                      href={buildExecutionBatchScopeHref(currentBatch.id, routeScope, {
                        initiativeId: currentBatch.initiativeId,
                        taskGraphId: currentBatch.taskGraphId,
                      })}
                    >
                      Open batch
                    </PlaneRunPillLink>
                  ) : null}
                  {currentBatch ? (
                    <PlaneRunPillLink
                      href={buildExecutionTaskGraphScopeHref(currentBatch.taskGraphId, routeScope, {
                        initiativeId: currentBatch.initiativeId,
                      })}
                    >
                      Open task graph
                    </PlaneRunPillLink>
                  ) : null}
                  <PlaneRunPillLink href={buildExecutionEventsScopeHref(routeScope)}>
                    Event timeline
                  </PlaneRunPillLink>
                </div>
              </div>
            </div>
          </PlaneRunModule>

          <ExecutionRunComposer routeScope={routeScope} />

          <PlaneRunModule title="Runtime dependency">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${kernelTone}`}>
                  {kernelLabel}
                </div>
                <div className="text-[13px] text-white/78">{kernelAvailability.baseUrl}</div>
                <div className="max-w-3xl text-[12px] leading-6 text-white/56">
                  {kernelAvailability.detail}
                </div>
                {kernelAvailability.recoveryHint ? (
                  <div className="max-w-3xl text-[12px] leading-6 text-white/62">
                    {kernelAvailability.recoveryHint}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {kernelAvailability.recoveryState === "retryable" ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/62">
                      retryable
                    </span>
                  ) : null}
                  {kernelAvailability.maturity ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/62">
                      {kernelAvailability.maturity.replace(/_/g, "-")}
                    </span>
                  ) : null}
                  {kernelAvailability.deploymentScope ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/62">
                      {kernelAvailability.deploymentScope.replace(/_/g, "-")}
                    </span>
                  ) : null}
                  {kernelAvailability.durabilityTier ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/62">
                      {kernelAvailability.durabilityTier.replace(/_/g, "-")}
                    </span>
                  ) : null}
                  {kernelAvailability.restartRecoverable ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/62">
                      restart-recoverable
                    </span>
                  ) : null}
                  {kernelAvailability.blockedBatchIds?.length ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/62">
                      blocked {kernelAvailability.blockedBatchIds.length}
                    </span>
                  ) : null}
                  {kernelAvailability.failedAttemptIds?.length ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/62">
                      failed attempts {kernelAvailability.failedAttemptIds.length}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {!kernelAvailability.available ? (
                    <PlaneRunPillLink href={buildExecutionIssuesScopeHref(routeScope)}>
                      Open issues
                    </PlaneRunPillLink>
                  ) : null}
                  {kernelAvailability.available && kernelGeneratedAt ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] text-white/62">
                      healthy at {kernelGeneratedAt}
                    </span>
                  ) : null}
                </div>
              </div>
              {!kernelAvailability.available ? (
                <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3 font-mono text-[11px] leading-5 text-white/72">
                  cd /Users/martin/infinity/services/execution-kernel{"\n"}./scripts/run-local.sh
                </div>
              ) : null}
            </div>
          </PlaneRunModule>

          <PlaneRunModule title="Primary routes">
            <div className="flex flex-wrap gap-2">
              <PlaneRunPillLink href={buildExecutionSessionsScopeHref(routeScope)} active>
                Sessions
              </PlaneRunPillLink>
              <PlaneRunPillLink href={buildExecutionApprovalsScopeHref(routeScope)}>
                Approvals
              </PlaneRunPillLink>
              <PlaneRunPillLink href={buildExecutionAgentsScopeHref(routeScope)}>
                Agents
              </PlaneRunPillLink>
              <PlaneRunPillLink href={buildExecutionEventsScopeHref(routeScope)}>
                Events
              </PlaneRunPillLink>
              <PlaneRunPillLink href={buildExecutionHandoffsScopeHref(routeScope)}>
                Handoffs
              </PlaneRunPillLink>
              <PlaneRunPillLink href={buildExecutionRecoveriesScopeHref(routeScope)}>
                Recoveries
              </PlaneRunPillLink>
              <PlaneRunPillLink href={buildExecutionAccountsScopeHref(routeScope)}>
                Accounts
              </PlaneRunPillLink>
              <PlaneRunPillLink href={buildExecutionAuditsScopeHref(routeScope)}>
                Audits
              </PlaneRunPillLink>
            </div>
          </PlaneRunModule>

          <PlaneRunModule title="Control plane snapshot">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="rounded-2xl bg-[color:var(--shell-control-bg)] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Delivery readiness
                </div>
                <div className="mt-3 text-[16px] font-medium text-foreground">
                  {currentDelivery?.launchProofKind === "runnable_result" &&
                  currentDelivery.launchProofAt
                    ? "Runnable localhost result"
                    : currentDelivery?.launchProofKind === "attempt_scaffold"
                      ? "Attempt scaffold only"
                    : currentDelivery?.launchProofKind === "synthetic_wrapper"
                      ? "Evidence wrapper only"
                      : currentDelivery?.status
                      ? titleCase(currentDelivery.status)
                      : "No delivery yet"}
                </div>
                <div className="mt-2 text-[12px] text-muted-foreground">
                  {(currentDelivery?.launchTargetLabel
                    ? `${currentDelivery.launchTargetLabel} · `
                    : "") +
                    (currentDelivery?.launchProofUrl ??
                    currentDelivery?.previewUrl ??
                    currentDelivery?.localOutputPath ??
                    "No artifact bundle or localhost proof is attached yet.")}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentDelivery ? (
                    <PlaneRunPillLink
                      href={buildExecutionDeliveryScopeHref(currentDelivery.id, routeScope, {
                        initiativeId: currentDelivery.initiativeId,
                      })}
                    >
                      Open delivery
                    </PlaneRunPillLink>
                  ) : null}
                  <PlaneRunPillLink href={buildExecutionHandoffsScopeHref(routeScope)}>
                    Handoff lane
                  </PlaneRunPillLink>
                </div>
              </div>

              <div className="rounded-2xl bg-[color:var(--shell-control-bg)] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Shell truth
                </div>
                <div className="mt-3 text-[15px] font-medium text-foreground">
                  {activeSessions} active sessions · {approvals.summary.pending} pending approvals
                </div>
                <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                  {retryableRecoveries} recoveries need attention. {schedulableAccounts} accounts can still take new work.
                </div>
              </div>
            </div>
          </PlaneRunModule>
        </div>

        <aside className="grid gap-5">
          <PlaneRunModule title="Attention queue">
            <div className="grid gap-3">
              <div className="rounded-2xl bg-[color:var(--shell-control-bg)] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Pending approvals
                </div>
                <div className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                  {approvals.summary.pending}
                </div>
                <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                  {pendingApproval
                    ? `${pendingApproval.title} · ${pendingApproval.projectName}`
                    : "No approval is currently blocking the operator queue."}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PlaneRunPillLink href={buildExecutionApprovalsScopeHref(routeScope)}>
                    Open approvals
                  </PlaneRunPillLink>
                </div>
              </div>
              <div className="rounded-2xl bg-[color:var(--shell-control-bg)] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Retryable recoveries
                </div>
                <div className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                  {retryableRecoveries}
                </div>
                <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                  {activeRecovery
                    ? `${activeRecovery.summary} · severity ${activeRecovery.severity}`
                    : "No open retry or failover incident needs operator action."}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PlaneRunPillLink href={buildExecutionRecoveriesScopeHref(routeScope)}>
                    Open recoveries
                  </PlaneRunPillLink>
                  <PlaneRunPillLink href={buildExecutionIssuesScopeHref(routeScope)}>
                    Open issues
                  </PlaneRunPillLink>
                </div>
              </div>
              <div className="rounded-2xl bg-[color:var(--shell-control-bg)] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Capacity snapshot
                </div>
                <div className="mt-2 text-[15px] font-medium text-foreground">
                  {preferredAccount?.label ?? "No preferred account"}
                </div>
                <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                  {pressuredAccount
                    ? `Pressure watch: ${pressuredAccount.label} · ${pressuredAccount.capacity.pressure}`
                    : `${schedulableAccounts} schedulable accounts currently available.`}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PlaneRunPillLink href={buildExecutionAccountsScopeHref(routeScope)}>
                    Open accounts
                  </PlaneRunPillLink>
                  <PlaneRunPillLink href={buildExecutionAuditsScopeHref(routeScope)}>
                    Open audits
                  </PlaneRunPillLink>
                </div>
              </div>
            </div>
          </PlaneRunModule>
        </aside>
      </section>
    </main>
  );
}
