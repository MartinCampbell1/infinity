import Link from "next/link";

import {
  buildExecutionWorkspaceScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { listAssemblies } from "@/lib/server/orchestration/assembly";
import { listDeliveries } from "@/lib/server/orchestration/delivery";
import { listOrchestrationInitiatives } from "@/lib/server/orchestration/initiatives";
import { listVerifications } from "@/lib/server/orchestration/verification";

type ExecutionReviewSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionReviewPage({
  searchParams,
}: {
  searchParams?: ExecutionReviewSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const [initiatives, assemblies, verifications, deliveries] = await Promise.all([
    listOrchestrationInitiatives(),
    listAssemblies(),
    listVerifications(),
    listDeliveries(),
  ]);
  const currentInitiative =
    initiatives.find((initiative) =>
      ["assembly", "verifying", "ready", "failed"].includes(initiative.status)
    ) ??
    initiatives[0] ??
    null;
  const currentAssembly =
    (currentInitiative
      ? assemblies.find((assembly) => assembly.initiativeId === currentInitiative.id)
      : null) ?? null;
  const currentVerification =
    (currentInitiative
      ? verifications.find(
          (verification) => verification.initiativeId === currentInitiative.id
        )
      : null) ?? null;
  const currentDelivery =
    (currentInitiative
      ? deliveries.find((delivery) => delivery.initiativeId === currentInitiative.id)
      : null) ?? null;
  const workspaceSessionId = routeScope.sessionId || currentInitiative?.workspaceSessionId || null;

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-5">
      <header className="shell-surface-elevated space-y-4 px-5 py-5">
        <div className="space-y-2">
          <div className="shell-section-header">Execution / Review</div>
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-foreground">
            Review
          </h1>
          <p className="max-w-3xl text-[13px] leading-5 text-muted-foreground">
            Read-only review surface over live orchestration objects. It exposes the
            latest initiative, assembly, verification status, delivery readiness, and
            deep links back into the workspace path without falling back to placeholder
            UI.
          </p>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="shell-surface-card space-y-4 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Current initiative
              </div>
              <h2 className="text-[20px] font-semibold text-foreground">
                {currentInitiative?.title ?? "No initiative ready for review"}
              </h2>
            </div>
            <span className="inline-flex rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1 text-[11px] text-muted-foreground">
              {currentInitiative?.status ?? "idle"}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[20px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Assembly
              </div>
              <div className="mt-2 text-sm text-foreground">
                {currentAssembly?.id ?? "Missing"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {currentAssembly?.status ?? "No assembly recorded yet"}
              </div>
            </div>
            <div className="rounded-[20px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Verification
              </div>
              <div className="mt-2 text-sm text-foreground">
                {currentVerification?.id ?? "Missing"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {currentVerification?.overallStatus ?? "Verification not started"}
              </div>
            </div>
            <div className="rounded-[20px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Delivery
              </div>
              <div className="mt-2 text-sm text-foreground">
                {currentDelivery?.id ?? "Pending"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {currentDelivery?.status ?? "Delivery blocked until verification passes"}
              </div>
            </div>
          </div>

          {currentVerification ? (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Verification checks
              </div>
              <div className="grid gap-2">
                {currentVerification.checks.map((check) => (
                  <div
                    key={check.name}
                    className="rounded-[18px] border border-[color:var(--shell-control-border)] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">
                        {check.name}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        {check.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                      {check.details ?? "No details recorded."}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="shell-surface-card space-y-4 px-5 py-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Deep links
            </div>
            <div className="mt-3 grid gap-2">
              {currentInitiative && workspaceSessionId ? (
                <Link
                  className="rounded-[18px] border border-[color:var(--shell-control-border)] px-4 py-3 text-sm text-foreground transition hover:bg-[color:var(--shell-control-bg)]"
                  href={buildExecutionWorkspaceScopeHref(workspaceSessionId, {
                    ...routeScope,
                    sessionId: workspaceSessionId,
                  })}
                >
                  Open workspace
                </Link>
              ) : null}
              {currentInitiative ? (
                <Link
                  className="rounded-[18px] border border-[color:var(--shell-control-border)] px-4 py-3 text-sm text-foreground transition hover:bg-[color:var(--shell-control-bg)]"
                  href={`/project-run/${encodeURIComponent(currentInitiative.id)}`}
                >
                  Open run
                </Link>
              ) : null}
              {currentInitiative ? (
                <Link
                  className="rounded-[18px] border border-[color:var(--shell-control-border)] px-4 py-3 text-sm text-foreground transition hover:bg-[color:var(--shell-control-bg)]"
                  href={`/project-result/${encodeURIComponent(currentInitiative.id)}`}
                >
                  Open result
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-[20px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 py-4 text-[12px] leading-5 text-muted-foreground">
            Route scope stays shell-owned. Workspace remains embedded and is entered
            only through the session workspace route.
          </div>
        </aside>
      </section>
    </main>
  );
}
