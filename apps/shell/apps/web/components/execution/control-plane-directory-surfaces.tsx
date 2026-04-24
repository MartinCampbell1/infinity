import {
  buildExecutionAccountsScopeHref,
  buildExecutionRecoveriesScopeHref,
  buildExecutionSessionsScopeHref,
  buildExecutionWorkspaceScopeHref,
  routeScopeFromExecutionBindingRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type { ControlPlaneAccountRecord } from "@/lib/server/control-plane/accounts";
import type {
  ApprovalRequest,
  ApprovalRequestsDirectory,
} from "@/lib/server/control-plane/contracts/approvals";
import type {
  OperatorActionAuditEvent,
} from "@/lib/server/control-plane/contracts/operator-actions";
import type {
  RecoveryIncident,
  RecoveryIncidentsDirectory,
} from "@/lib/server/control-plane/contracts/recoveries";
import {
  ApprovalActionStrip,
  RecoveryActionStrip,
} from "./operator-action-controls";
import {
  PlaneRunHeader,
  PlaneRunPillLink,
} from "./plane-run-primitives";

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

function statusTone(value: string) {
  if (
    value === "completed" ||
    value === "approved" ||
    value === "resolved" ||
    value === "recovered" ||
    value === "low"
  ) {
    return "border border-emerald-500/20 bg-emerald-500/12 text-emerald-100";
  }

  if (
    value === "pending" ||
    value === "waiting_for_approval" ||
    value === "medium" ||
    value === "retryable"
  ) {
    return "border border-amber-500/20 bg-amber-500/12 text-amber-100";
  }

  if (
    value === "failed" ||
    value === "blocked" ||
    value === "high" ||
    value === "exhausted" ||
    value === "denied" ||
    value === "dead" ||
    value === "failing_over"
  ) {
    return "border border-rose-500/20 bg-rose-500/12 text-rose-100";
  }

  return "border border-white/12 bg-white/[0.03] text-white/72";
}

function sectionHeader(
  routeScope: ShellRouteScope | undefined,
  title: string,
  description: string
) {
  return (
    <PlaneRunHeader
      eyebrow="Execution"
      title={title}
      description={description}
      actions={
        <>
          <PlaneRunPillLink href={buildExecutionSessionsScopeHref(routeScope)}>
            Sessions
          </PlaneRunPillLink>
          <PlaneRunPillLink href={buildExecutionAccountsScopeHref(routeScope)}>
            Accounts
          </PlaneRunPillLink>
          <PlaneRunPillLink href={buildExecutionRecoveriesScopeHref(routeScope)}>
            Recoveries
          </PlaneRunPillLink>
        </>
      }
    />
  );
}

function latestAction(
  actions: OperatorActionAuditEvent[],
  targetId: string
): OperatorActionAuditEvent | null {
  return (
    actions
      .filter((action) => action.targetId === targetId)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0] ??
    null
  );
}

function operatorPayloadValue(
  action: OperatorActionAuditEvent | null,
  key: string
) {
  if (!action) {
    return null;
  }

  const value = action.payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function approvalScope(
  request: ApprovalRequest,
  routeScope?: Partial<ShellRouteScope> | null
) {
  return routeScopeFromExecutionBindingRef(
    {
      sessionId: request.sessionId,
      groupId: request.groupId,
      accountId: request.accountId,
      workspaceId: request.workspaceId,
    },
    routeScope
  );
}

function recoveryScope(
  incident: RecoveryIncident,
  routeScope?: Partial<ShellRouteScope> | null
) {
  return routeScopeFromExecutionBindingRef(
    {
      sessionId: incident.sessionId,
      groupId: incident.groupId,
      accountId: incident.accountId,
      workspaceId: incident.workspaceId,
    },
    routeScope
  );
}

export function ExecutionAccountsDirectorySurface({
  accounts,
  routeScope,
}: {
  accounts: ControlPlaneAccountRecord[];
  routeScope?: ShellRouteScope;
}) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      {sectionHeader(
        routeScope,
        "Accounts",
        "Capacity board backed by local quota snapshots and derived schedulable pressure state."
      )}

      <section className="space-y-3">
        {accounts.map((account) => {
          const scoped = routeScopeFromExecutionBindingRef(
            { accountId: account.id },
            routeScope
          );

          return (
            <article
              key={account.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                    {account.provider} · {account.authMode}
                  </div>
                  <h2 className="text-lg font-medium text-white">
                    {account.label}
                  </h2>
                  <p className="text-sm text-white/58">{account.id}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={`rounded-full px-2.5 py-1 ${statusTone(
                      account.capacity.pressure
                    )}`}
                  >
                    pressure: {account.capacity.pressure}
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-white/72">
                    schedulable: {account.capacity.schedulable ? "yes" : "no"}
                  </span>
                  {account.capacity.preferredForNewSessions ? (
                    <span className="rounded-full bg-sky-500/90 px-2.5 py-1 text-white">
                      preferred
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  <div className="text-sm text-white/58">
                    {account.capacity.reason ?? "No capacity note available."}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-white/58">
                    {account.capacity.reasonCodes?.map((reasonCode) => (
                      <span
                        key={reasonCode}
                        className="rounded-full border border-white/12 px-2.5 py-1"
                      >
                        {reasonCode}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-white/42">
                    source: {account.quota.source} · observed{" "}
                    {formatTimestamp(account.quota.observedAt)} · next reset{" "}
                    {formatTimestamp(account.capacity.nextResetAt)}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                    Buckets
                  </div>
                  <div className="mt-3 space-y-2">
                    {account.quota.buckets.length ? (
                      account.quota.buckets.map((bucket) => (
                        <div
                          key={bucket.limitId}
                          className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-white/88">
                              {bucket.limitName ?? bucket.limitId}
                            </div>
                            <div className="text-xs text-white/42">
                              {bucket.usedPercent ?? "?"}%
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-white/42">
                            reset {formatTimestamp(bucket.resetsAt)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.03] p-3 text-sm text-white/42">
                        No ChatGPT-style buckets. This account uses runtime capacity
                        signals.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a
                  className="rounded-full bg-sky-500/90 px-4 py-2 text-white"
                  href={buildExecutionSessionsScopeHref(scoped)}
                >
                  Open scoped sessions
                </a>
                <a
                  className="rounded-full border border-white/12 px-4 py-2 text-white/78"
                  href={buildExecutionAccountsScopeHref(scoped)}
                >
                  Keep account scope
                </a>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

export function ExecutionApprovalsDirectorySurface({
  directory,
  routeScope,
}: {
  directory: ApprovalRequestsDirectory;
  routeScope?: ShellRouteScope;
}) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      {sectionHeader(
        routeScope,
        "Approvals",
        "Durable approval queue backed by local control-plane state and explicit operator audit events."
      )}

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Queue summary
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-white/42">
                total
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {directory.summary.total}
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-white/42">
                pending
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {directory.summary.pending}
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-white/42">
                resolved
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {directory.summary.resolved}
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-white/42">
            storage: {directory.storageKind} · integration: {directory.integrationState}
          </div>
        </article>

        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Directory notes
          </div>
          <ul className="mt-3 space-y-2 text-sm text-white/58">
            {directory.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="space-y-3">
        {directory.requests.length === 0 ? (
          <article className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-5">
            <div className="text-sm font-medium text-white">
              No approval requests match the current scope.
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/54">
              The queue was checked against the durable approvals directory and
              there are no pending operator decisions for this scope.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10.5px] text-white/42">
              <span className="rounded-full border border-white/10 px-2.5 py-1">
                source: {directory.storageKind}
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-1">
                scope: {routeScope?.sessionId || routeScope?.projectId || "all"}
              </span>
            </div>
          </article>
        ) : null}
        {directory.requests.map((request) => {
          const scoped = approvalScope(request, routeScope);
          const lastAction = latestAction(directory.operatorActions, request.id);
          const actionReason = operatorPayloadValue(lastAction, "reason");
          return (
            <article
              key={request.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                    {request.projectName} · {request.requestKind}
                  </div>
                  <h2 className="text-lg font-medium text-white">
                    {request.title}
                  </h2>
                  <p className="text-sm text-white/58">{request.summary}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${statusTone(
                    request.status
                  )}`}
                >
                  {request.status}
                </span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <dl className="grid grid-cols-2 gap-3 text-sm text-white/58">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                      session
                    </dt>
                    <dd>{request.sessionId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                      account
                    </dt>
                    <dd>{request.accountId ?? "n/a"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                      requested
                    </dt>
                    <dd>{formatTimestamp(request.requestedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                      decision
                    </dt>
                    <dd>{request.decision ?? "pending"}</dd>
                  </div>
                </dl>

                <div className="rounded-2xl bg-white/[0.03] p-4 text-sm text-white/58">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                    Operator audit
                  </div>
                  <div className="mt-2">
                    {lastAction ? (
                      <>
                        <div className="font-medium text-white/88">
                          {lastAction.summary}
                        </div>
                        <div className="mt-1 text-xs text-white/42">
                          {lastAction.kind} · {lastAction.outcome} ·{" "}
                          {formatTimestamp(lastAction.occurredAt)}
                        </div>
                        {actionReason ? (
                          <div className="mt-2 text-xs text-white/42">
                            reason code: {actionReason}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-white/42">
                        No operator action recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {request.reason ? (
                <div className="mt-4 text-sm text-white/58">
                  reason: {request.reason}
                </div>
              ) : null}

              {request.status === "pending" ? (
                <ApprovalActionStrip approvalId={request.id} />
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a
                  className="rounded-full bg-sky-500/90 px-4 py-2 text-white"
                  href={buildExecutionWorkspaceScopeHref(request.sessionId, scoped)}
                >
                  Open workspace
                </a>
                <a
                  className="rounded-full border border-white/12 px-4 py-2 text-white/78"
                  href={buildExecutionSessionsScopeHref(scoped)}
                >
                  Session lane
                </a>
                <span className="rounded-full border border-white/12 px-4 py-2 text-white/78">
                  revision: {request.revision}
                </span>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

export function ExecutionRecoveriesDirectorySurface({
  directory,
  routeScope,
  fallbackAccountIds,
}: {
  directory: RecoveryIncidentsDirectory;
  routeScope?: ShellRouteScope;
  fallbackAccountIds?: string[];
}) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      {sectionHeader(
        routeScope,
        "Recoveries",
        "Durable recovery lane showing retryable, failing-over, and recovered incidents with explicit operator audit history."
      )}

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Lane summary
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            {(
              [
                ["open", directory.summary.open],
                ["retryable", directory.summary.retryable],
                ["failingOver", directory.summary.failingOver],
                ["recovered", directory.summary.recovered],
                ["dead", directory.summary.dead],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-white/42">
                  {label}
                </div>
                <div className="mt-1 text-2xl font-semibold text-white">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Directory notes
          </div>
          <ul className="mt-3 space-y-2 text-sm text-white/58">
            {directory.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="space-y-3">
        {directory.incidents.map((incident) => {
          const scoped = recoveryScope(incident, routeScope);
          const lastAction = latestAction(directory.operatorActions, incident.id);
          const actionReason = operatorPayloadValue(lastAction, "reason");
          const targetAccountId = operatorPayloadValue(lastAction, "targetAccountId");
          const fallbackAccountId =
            fallbackAccountIds?.find((accountId) => accountId !== incident.accountId) ?? null;
          return (
            <article
              key={incident.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                    {incident.projectName} · severity {incident.severity}
                  </div>
                  <div className="font-mono text-[11px] text-white/42">
                    {incident.id}
                  </div>
                  <h2 className="text-lg font-medium text-white">
                    {incident.summary}
                  </h2>
                  <p className="text-sm text-white/58">
                    {incident.rootCause ?? "No root cause attached."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={`rounded-full px-2.5 py-1 ${statusTone(
                      incident.status
                    )}`}
                  >
                    {incident.status}
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-white/72">
                    action: {incident.recoveryActionKind}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <dl className="grid grid-cols-2 gap-3 text-sm text-white/58">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                      session
                    </dt>
                    <dd>{incident.sessionId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                      account
                    </dt>
                    <dd>{incident.accountId ?? "n/a"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                      retries
                    </dt>
                    <dd>{incident.retryCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                      last observed
                    </dt>
                    <dd>{formatTimestamp(incident.lastObservedAt)}</dd>
                  </div>
                </dl>

                <div className="rounded-2xl bg-white/[0.03] p-4 text-sm text-white/58">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                    Operator audit
                  </div>
                  <div className="mt-2">
                    {lastAction ? (
                      <>
                        <div className="font-medium text-white/88">
                          {lastAction.summary}
                        </div>
                        <div className="mt-1 text-xs text-white/42">
                          {lastAction.kind} · {lastAction.outcome} ·{" "}
                          {formatTimestamp(lastAction.occurredAt)}
                        </div>
                        {targetAccountId ? (
                          <div className="mt-2 text-xs text-white/42">
                            target account: {targetAccountId}
                          </div>
                        ) : null}
                        {actionReason ? (
                          <div className="mt-1 text-xs text-white/42">
                            reason code: {actionReason}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-white/42">
                        No operator action recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {incident.recommendedAction ? (
                <div className="mt-4 text-sm text-white/58">
                  recommended: {incident.recommendedAction}
                </div>
              ) : null}

              <RecoveryActionStrip
                recoveryId={incident.id}
                fallbackAccountId={fallbackAccountId}
                canRetry={incident.status === "retryable" || incident.status === "open"}
                canFailover={
                  incident.status === "retryable" ||
                  incident.status === "open" ||
                  incident.status === "failing_over"
                }
                canResolve={incident.status !== "recovered"}
                canReopen={incident.status === "recovered" || incident.status === "dead"}
              />

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a
                  className="rounded-full bg-sky-500/90 px-4 py-2 text-white"
                  href={buildExecutionWorkspaceScopeHref(incident.sessionId, scoped)}
                >
                  Open workspace
                </a>
                <a
                  className="rounded-full border border-white/12 px-4 py-2 text-white/78"
                  href={buildExecutionSessionsScopeHref(scoped)}
                >
                  Session lane
                </a>
                <span className="rounded-full border border-white/12 px-4 py-2 text-white/78">
                  revision: {incident.revision}
                </span>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
