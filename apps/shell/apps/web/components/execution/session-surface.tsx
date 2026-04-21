import {
  buildExecutionAccountsScopeHref,
  buildExecutionGroupsScopeHref,
  buildExecutionRecoveriesScopeHref,
  buildExecutionSessionsScopeHref,
  buildExecutionWorkspaceScopeHref,
  routeScopeFromExecutionBindingRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  getExecutionSessionSummaries,
  type ExecutionSessionSummary,
} from "@/lib/server/control-plane/sessions";

type ExecutionBoardMode = "sessions" | "groups" | "accounts" | "recoveries";

function scopeForSession(
  session: ExecutionSessionSummary,
  routeScope?: Partial<ShellRouteScope> | null
) {
  return routeScopeFromExecutionBindingRef(
    {
      sessionId: session.id,
      groupId: session.groupId,
      accountId: session.accountId,
      workspaceId: session.workspaceId,
    },
    routeScope
  );
}

function pressureRank(pressure: ExecutionSessionSummary["quotaPressure"]) {
  if (pressure === "exhausted") return 4;
  if (pressure === "high") return 3;
  if (pressure === "medium") return 2;
  if (pressure === "low") return 1;
  return 0;
}

function buildGroupRows(executionSessionSummaries: ExecutionSessionSummary[]) {
  const grouped = new Map<
    string,
    {
      groupId: string;
      sessions: ExecutionSessionSummary[];
      pendingApprovals: number;
      retryableCount: number;
      blockedCount: number;
      highestPressure: ExecutionSessionSummary["quotaPressure"];
      latestUpdatedAt: string;
    }
  >();

  for (const session of executionSessionSummaries) {
    const groupId = session.groupId || "ungrouped";
    const existing = grouped.get(groupId);
    if (!existing) {
      grouped.set(groupId, {
        groupId,
        sessions: [session],
        pendingApprovals: session.pendingApprovals,
        retryableCount: session.recoveryState === "retryable" ? 1 : 0,
        blockedCount: session.status === "blocked" || session.status === "failed" ? 1 : 0,
        highestPressure: session.quotaPressure,
        latestUpdatedAt: session.updatedAt,
      });
      continue;
    }

    existing.sessions.push(session);
    existing.pendingApprovals += session.pendingApprovals;
    existing.retryableCount += session.recoveryState === "retryable" ? 1 : 0;
    existing.blockedCount += session.status === "blocked" || session.status === "failed" ? 1 : 0;
    if (pressureRank(session.quotaPressure) > pressureRank(existing.highestPressure)) {
      existing.highestPressure = session.quotaPressure;
    }
    if (session.updatedAt > existing.latestUpdatedAt) {
      existing.latestUpdatedAt = session.updatedAt;
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    b.latestUpdatedAt.localeCompare(a.latestUpdatedAt)
  );
}

function buildAccountRows(executionSessionSummaries: ExecutionSessionSummary[]) {
  const byAccount = new Map<
    string,
    {
      accountId: string;
      sessions: ExecutionSessionSummary[];
      activeSessions: number;
      pendingApprovals: number;
      retryableCount: number;
      exhausted: boolean;
      highestPressure: ExecutionSessionSummary["quotaPressure"];
      preferredForNewSessions: boolean;
    }
  >();

  for (const session of executionSessionSummaries) {
    const accountId = session.accountId || "unassigned";
    const existing = byAccount.get(accountId);
    if (!existing) {
      byAccount.set(accountId, {
        accountId,
        sessions: [session],
        activeSessions:
          session.status === "acting" || session.status === "planning" || session.status === "starting"
            ? 1
            : 0,
        pendingApprovals: session.pendingApprovals,
        retryableCount: session.recoveryState === "retryable" ? 1 : 0,
        exhausted: session.quotaPressure === "exhausted",
        highestPressure: session.quotaPressure,
        preferredForNewSessions: session.quotaPressure === "low" || session.quotaPressure === "medium",
      });
      continue;
    }

    existing.sessions.push(session);
    existing.activeSessions +=
      session.status === "acting" || session.status === "planning" || session.status === "starting"
        ? 1
        : 0;
    existing.pendingApprovals += session.pendingApprovals;
    existing.retryableCount += session.recoveryState === "retryable" ? 1 : 0;
    existing.exhausted = existing.exhausted || session.quotaPressure === "exhausted";
    if (pressureRank(session.quotaPressure) > pressureRank(existing.highestPressure)) {
      existing.highestPressure = session.quotaPressure;
    }
    if (session.quotaPressure === "high" || session.quotaPressure === "exhausted") {
      existing.preferredForNewSessions = false;
    }
  }

  return Array.from(byAccount.values()).sort((a, b) => {
    const pressureDelta = pressureRank(b.highestPressure) - pressureRank(a.highestPressure);
    if (pressureDelta !== 0) {
      return pressureDelta;
    }
    return b.activeSessions - a.activeSessions;
  });
}

function buildRecoveryRows(executionSessionSummaries: ExecutionSessionSummary[]) {
  return executionSessionSummaries
    .filter(
      (session) =>
        session.recoveryState !== "none" ||
        session.status === "failed" ||
        session.status === "blocked"
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function ExecutionSessionsSurface({
  routeScope,
  mode = "sessions",
  title = "Sessions",
  description = "Shell-backed execution board for the local Infinity control plane.",
}: {
  routeScope?: ShellRouteScope;
  mode?: ExecutionBoardMode;
  title?: string;
  description?: string;
}) {
  const executionSessionSummaries = await getExecutionSessionSummaries();
  const groupRows = mode === "groups" ? buildGroupRows(executionSessionSummaries) : [];
  const accountRows = mode === "accounts" ? buildAccountRows(executionSessionSummaries) : [];
  const recoveryRows =
    mode === "recoveries" ? buildRecoveryRows(executionSessionSummaries) : [];
  const pendingApprovalCount = executionSessionSummaries.reduce(
    (total, session) => total + session.pendingApprovals,
    0
  );
  const retryableCount = executionSessionSummaries.filter(
    (session) => session.recoveryState === "retryable"
  ).length;
  const exhaustedCount = executionSessionSummaries.filter(
    (session) => session.quotaPressure === "exhausted"
  ).length;
  const boardTabs = [
    {
      id: "sessions" as const,
      label: "Sessions",
      href: buildExecutionSessionsScopeHref(routeScope),
    },
    {
      id: "groups" as const,
      label: "Groups",
      href: buildExecutionGroupsScopeHref(routeScope),
    },
    {
      id: "accounts" as const,
      label: "Accounts",
      href: buildExecutionAccountsScopeHref(routeScope),
    },
    {
      id: "recoveries" as const,
      label: "Recoveries",
      href: buildExecutionRecoveriesScopeHref(routeScope),
    },
  ];

  return (
    <main className="mx-auto flex max-w-[1480px] flex-col gap-5">
      <header className="shell-surface-elevated space-y-5 px-5 py-5">
        <div className="space-y-2">
          <div className="shell-section-header">Execution</div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-foreground">
                {title}
              </h1>
              <p className="max-w-3xl text-[13px] leading-5 text-muted-foreground">
                {description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5">
                session truth = shell
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5">
                route scope preserved
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <div className="shell-surface-card px-3 py-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Sessions
            </div>
            <div className="mt-2 shell-stat-value">{executionSessionSummaries.length}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Shell-visible runs in the local corpus
            </div>
          </div>
          <div className="shell-surface-card px-3 py-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Pending approvals
            </div>
            <div className="mt-2 shell-stat-value">{pendingApprovalCount}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Operator actions still waiting on a decision
            </div>
          </div>
          <div className="shell-surface-card px-3 py-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Retryable
            </div>
            <div className="mt-2 shell-stat-value">{retryableCount}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Sessions that can be recovered immediately
            </div>
          </div>
          <div className="shell-surface-card px-3 py-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Exhausted accounts
            </div>
            <div className="mt-2 shell-stat-value">{exhaustedCount}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Capacity pressure already visible in routing decisions
            </div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2">
          {boardTabs.map((tab) => {
            const active = tab.id === mode;
            return (
              <a
                key={tab.id}
                className={
                  active
                    ? "inline-flex items-center rounded-full bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground"
                    : "inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-2 text-[12px] font-medium text-foreground"
                }
                href={tab.href}
              >
                {tab.label}
              </a>
            );
          })}
        </nav>
      </header>

      {mode === "sessions" ? (
        <section className="grid gap-4 lg:grid-cols-3">
          {executionSessionSummaries.map((session) => {
            const scoped = scopeForSession(session, routeScope);
            return (
              <article
                key={session.id}
                className="shell-surface-card space-y-4 px-4 py-4"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {session.projectName}
                      </div>
                      <h2 className="text-[17px] font-medium tracking-[-0.02em] text-foreground">
                        {session.title}
                      </h2>
                    </div>
                    <span className="inline-flex rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1 text-[11px] text-foreground">
                      {session.status}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-[12px] text-muted-foreground">
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                        sessionId
                      </dt>
                      <dd className="mt-1 text-foreground">{session.id}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                        account
                      </dt>
                      <dd className="mt-1 text-foreground">{session.accountId ?? "n/a"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                        provider
                      </dt>
                      <dd className="mt-1 text-foreground">{session.provider}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                        approvals
                      </dt>
                      <dd className="mt-1 text-foreground">{session.pendingApprovals}</dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    {session.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-1 text-[12px]">
                    <a
                      className="inline-flex items-center rounded-full bg-primary px-3.5 py-2 font-medium text-primary-foreground"
                      href={buildExecutionWorkspaceScopeHref(session.id, scoped)}
                    >
                      Open workspace
                    </a>
                    <a
                      className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-2 text-foreground"
                      href={buildExecutionGroupsScopeHref(scoped)}
                    >
                      Group lane
                    </a>
                    <a
                      className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-2 text-foreground"
                      href={buildExecutionAccountsScopeHref(scoped)}
                    >
                      Account lane
                    </a>
                    <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-2 text-foreground">
                      recovery: {session.recoveryState}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {mode === "groups" ? (
        <section className="space-y-3">
          {groupRows.map((group) => {
            const primarySession = group.sessions[0];
            if (!primarySession) {
              return null;
            }
            const scoped = scopeForSession(primarySession, routeScope);
            return (
              <article
                key={group.groupId}
                className="shell-surface-card px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-[17px] font-medium tracking-[-0.02em] text-foreground">{group.groupId}</h2>
                    <p className="text-[12px] text-muted-foreground">
                      {group.sessions.length} sessions, {group.pendingApprovals} pending approvals
                    </p>
                  </div>
                  <span className="inline-flex rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1 text-[11px] text-foreground">
                    pressure: {group.highestPressure}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5 text-[12px]">
                  <a
                    className="inline-flex items-center rounded-full bg-primary px-3.5 py-2 font-medium text-primary-foreground"
                    href={buildExecutionWorkspaceScopeHref(primarySession.id, scoped)}
                  >
                    Open primary workspace
                  </a>
                  <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-2 text-foreground">
                    retryable: {group.retryableCount}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-2 text-foreground">
                    blocked/failed: {group.blockedCount}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {mode === "accounts" ? (
        <section className="space-y-3">
          {accountRows.map((account) => {
            const primarySession = account.sessions[0];
            if (!primarySession) {
              return null;
            }
            const scoped = scopeForSession(primarySession, routeScope);
            return (
              <article
                key={account.accountId}
                className="shell-surface-card px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-[17px] font-medium tracking-[-0.02em] text-foreground">{account.accountId}</h2>
                    <p className="text-[12px] text-muted-foreground">
                      active: {account.activeSessions} · sessions: {account.sessions.length}
                    </p>
                  </div>
                  <span className="inline-flex rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1 text-[11px] text-foreground">
                    {account.exhausted ? "exhausted" : `pressure: ${account.highestPressure}`}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5 text-[12px]">
                  <a
                    className="inline-flex items-center rounded-full bg-primary px-3.5 py-2 font-medium text-primary-foreground"
                    href={buildExecutionWorkspaceScopeHref(primarySession.id, scoped)}
                  >
                    Open latest workspace
                  </a>
                  <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-2 text-foreground">
                    schedulable: {account.preferredForNewSessions ? "yes" : "no"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-2 text-foreground">
                    pending approvals: {account.pendingApprovals}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {mode === "recoveries" ? (
        <section className="space-y-3">
          {recoveryRows.map((session) => {
            const scoped = scopeForSession(session, routeScope);
            const nextAction =
              session.recoveryState === "retryable"
                ? "Retry same account"
                : session.recoveryState === "failing_over"
                ? "Fail over account"
                : "Inspect failure";
            return (
              <article
                key={session.id}
                className="shell-surface-card px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {session.projectName}
                    </div>
                    <h2 className="text-[17px] font-medium tracking-[-0.02em] text-foreground">{session.title}</h2>
                    <p className="text-[12px] text-muted-foreground">
                      state: {session.recoveryState} · retries: {session.retryCount}
                    </p>
                  </div>
                  <span className="inline-flex rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1 text-[11px] text-foreground">
                    {session.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5 text-[12px]">
                  <a
                    className="inline-flex items-center rounded-full bg-primary px-3.5 py-2 font-medium text-primary-foreground"
                    href={buildExecutionWorkspaceScopeHref(session.id, scoped)}
                  >
                    Open workspace
                  </a>
                  <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-2 text-foreground">
                    {nextAction}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-2 text-foreground">
                    account: {session.accountId ?? "n/a"}
                  </span>
                </div>
              </article>
            );
          })}
          {!recoveryRows.length ? (
            <article className="shell-surface-card px-4 py-4 text-[13px] text-muted-foreground">
              No active recovery incidents right now.
            </article>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
