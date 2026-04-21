import Link from "next/link";

import {
  buildExecutionWorkspaceScopeHref,
  type ShellRouteScope,
  withShellRouteScope,
} from "@/lib/route-scope";
import { PlaneRootComposer } from "@/components/frontdoor/plane-root-composer";
import { PlaneShellSectionCard } from "@/components/shell/plane-shell-primitives";
import type { ExecutionSessionSummary } from "@/lib/server/control-plane/contracts/session-events";
import type { ExecutionKernelAvailability } from "@/lib/server/orchestration/batches";

export function PlaneAiHomeSurface({
  leadSession,
  routeScope,
  kernelAvailability,
}: {
  leadSession: ExecutionSessionSummary | null;
  routeScope?: ShellRouteScope;
  kernelAvailability: ExecutionKernelAvailability;
}) {
  const workspaceHref = leadSession
    ? buildExecutionWorkspaceScopeHref(leadSession.id, routeScope)
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
      ? "execution-kernel retryable"
    : kernelAvailability.runtimeState === "blocked"
      ? "execution-kernel blocked"
      : kernelAvailability.restartRecoverable
        ? "execution-kernel restart-recoverable"
        : "execution-kernel ready";

  return (
    <PlaneShellSectionCard className="max-w-[1120px]">
      <PlaneRootComposer routeScope={routeScope ?? undefined} />

      <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">
            Quicklinks
          </div>
          <div className="mt-2 text-[15px] font-medium text-white">
            Shell-owned entry points
          </div>
          <div className="mt-2 max-w-2xl text-[12px] leading-6 text-white/52">
            Keep the frontdoor close to the operator surfaces you actually revisit: work board,
            embedded workspace, and the execution hub.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={withShellRouteScope("/work-items", routeScope)}
              className="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-3.5 py-2 text-[12px] font-medium text-white/88 transition hover:bg-white/12"
            >
              Open work items
            </Link>
            {workspaceHref ? (
              <Link
                href={workspaceHref}
                className="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-3.5 py-2 text-[12px] font-medium text-white/88 transition hover:bg-white/12"
              >
                Open workspace
              </Link>
            ) : null}
            <Link
              href={withShellRouteScope("/execution", routeScope)}
              className="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-3.5 py-2 text-[12px] font-medium text-white/88 transition hover:bg-white/12"
            >
              Open execution hub
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">
              Live session
            </div>
            <div className="mt-2 text-[15px] font-medium text-white">
              {leadSession?.title ?? "No live session yet"}
            </div>
            <div className="mt-2 text-[12px] leading-6 text-white/52">
              {leadSession
                ? `${leadSession.status} · ${leadSession.pendingApprovals} approvals · ${leadSession.toolActivityCount} tool events · quota ${leadSession.quotaPressure}`
                : "Start an autonomous run from the composer or open the execution hub to inspect existing work."}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 font-medium ${kernelTone}`}>
                {kernelLabel}
              </span>
              <span className="text-white/52">{kernelAvailability.baseUrl}</span>
            </div>
            <div className="mt-2 text-[12px] leading-6 text-white/48">
              {kernelAvailability.detail}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/62">
              {kernelAvailability.recoveryState === "retryable" ? (
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                  retryable
                </span>
              ) : null}
              {kernelAvailability.restartRecoverable ? (
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                  restart-recoverable
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </PlaneShellSectionCard>
  );
}
