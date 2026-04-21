import {
  buildExecutionApprovalsScopeHref,
  buildExecutionAuditScopeHref,
  buildExecutionAuditsScopeHref,
  buildExecutionRecoveriesScopeHref,
  buildExecutionSessionsScopeHref,
  buildExecutionWorkspaceScopeHref,
  routeScopeFromExecutionBindingRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type {
  OperatorActionAuditDetailResponse,
  OperatorActionAuditDirectory,
  OperatorActionAuditEvent,
  OperatorActionAuditTargetSummary,
} from "@/lib/server/control-plane/contracts/operator-actions";
import type { ExecutionSessionSummary } from "@/lib/server/control-plane/contracts/session-events";
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
    value === "applied" ||
    value === "approved" ||
    value === "resolved" ||
    value === "recovered" ||
    value === "completed"
  ) {
    return "border border-emerald-500/20 bg-emerald-500/12 text-emerald-100";
  }

  if (
    value === "idempotent" ||
    value === "retryable" ||
    value === "pending" ||
    value === "acting"
  ) {
    return "border border-amber-500/20 bg-amber-500/12 text-amber-100";
  }

  if (
    value === "rejected" ||
    value === "failed" ||
    value === "dead" ||
    value === "denied" ||
    value === "blocked" ||
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
          <PlaneRunPillLink href={buildExecutionApprovalsScopeHref(routeScope)}>
            Approvals
          </PlaneRunPillLink>
          <PlaneRunPillLink href={buildExecutionRecoveriesScopeHref(routeScope)}>
            Recoveries
          </PlaneRunPillLink>
        </>
      }
    />
  );
}

function auditScope(
  event: OperatorActionAuditEvent,
  routeScope?: Partial<ShellRouteScope> | null
) {
  return routeScopeFromExecutionBindingRef(
    {
      sessionId: event.sessionId,
      groupId: event.groupId ?? null,
    },
    routeScope
  );
}

function targetScope(
  target: OperatorActionAuditTargetSummary | null,
  routeScope?: Partial<ShellRouteScope> | null
) {
  if (!target) {
    return routeScopeFromExecutionBindingRef({}, routeScope);
  }

  return routeScopeFromExecutionBindingRef(
    {
      sessionId: target.sessionId,
      groupId: target.groupId ?? null,
      accountId: target.accountId ?? null,
      workspaceId: target.workspaceId ?? null,
    },
    routeScope
  );
}

function targetBoardHref(
  target: OperatorActionAuditTargetSummary | null,
  routeScope?: Partial<ShellRouteScope> | null
) {
  const scoped = targetScope(target, routeScope);

  if (!target) {
    return buildExecutionAuditsScopeHref(scoped);
  }

  if (target.targetKind === "approval_request") {
    return buildExecutionApprovalsScopeHref(scoped);
  }

  return buildExecutionRecoveriesScopeHref(scoped);
}

function auditLabel(event: OperatorActionAuditEvent) {
  return event.targetKind === "approval_request" ? "Approval" : "Recovery";
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function sessionFacts(session: ExecutionSessionSummary | null) {
  if (!session) {
    return [] as Array<[string, string]>;
  }

  return [
    ["status", session.status],
    ["phase", session.phase ?? "n/a"],
    ["pending approvals", String(session.pendingApprovals)],
    ["recovery", session.recoveryState],
    ["quota", session.quotaPressure],
    ["updated", formatTimestamp(session.updatedAt)],
  ];
}

export function ExecutionAuditsDirectorySurface({
  directory,
  routeScope,
}: {
  directory: OperatorActionAuditDirectory;
  routeScope?: ShellRouteScope;
}) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      {sectionHeader(
        routeScope,
        "Audits",
        "Operator audit lane for durable approval and recovery interventions. Every action is keyed by sessionId and linked back to the affected workspace object."
      )}

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Lane summary
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {(
              [
                ["total", directory.summary.total],
                ["approvals", directory.summary.approvals],
                ["recoveries", directory.summary.recoveries],
                ["applied", directory.summary.applied],
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
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {(
              [
                ["idempotent", directory.summary.idempotent],
                ["rejected", directory.summary.rejected],
                ["deferred", directory.summary.deferred],
                ["failed", directory.summary.failed],
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
        {directory.events.length ? (
          directory.events.map((event) => {
            const scoped = auditScope(event, routeScope);

            return (
              <article
                key={event.id}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                      {auditLabel(event)} audit · {event.kind}
                    </div>
                    <h2 className="text-lg font-medium text-white">
                      {event.summary}
                    </h2>
                    <p className="text-sm text-white/58">
                      target {event.targetId} · session {event.sessionId}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={`rounded-full px-2.5 py-1 ${statusTone(
                        event.outcome
                      )}`}
                    >
                      {event.outcome}
                    </span>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-white/72">
                      actor: {event.actorType}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <dl className="grid grid-cols-2 gap-3 text-sm text-white/58">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                        audit id
                      </dt>
                      <dd>{event.id}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                        occurred
                      </dt>
                      <dd>{formatTimestamp(event.occurredAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                        project
                      </dt>
                      <dd>{event.projectId}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                        group
                      </dt>
                      <dd>{event.groupId ?? "n/a"}</dd>
                    </div>
                  </dl>

                  <div className="rounded-2xl bg-white/[0.03] p-4 text-sm text-white/58">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                      Payload preview
                    </div>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-white/42">
                      {prettyJson(event.payload)}
                    </pre>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <a
                    className="rounded-full bg-sky-500/90 px-4 py-2 text-white"
                    href={buildExecutionAuditScopeHref(event.id, scoped)}
                  >
                    Open audit detail
                  </a>
                  <a
                    className="rounded-full border border-white/12 px-4 py-2 text-white/78"
                    href={buildExecutionWorkspaceScopeHref(event.sessionId, scoped)}
                  >
                    Open workspace
                  </a>
                  <a
                    className="rounded-full border border-white/12 px-4 py-2 text-white/78"
                    href={buildExecutionSessionsScopeHref(scoped)}
                  >
                    Session lane
                  </a>
                </div>
              </article>
            );
          })
        ) : (
          <section className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-6 text-sm text-white/42">
            No operator actions have been recorded yet. Approval and recovery
            interventions will appear here once the shell writes them.
          </section>
        )}
      </section>
    </main>
  );
}

export function ExecutionAuditDetailSurface({
  detail,
  routeScope,
}: {
  detail: OperatorActionAuditDetailResponse;
  routeScope?: ShellRouteScope;
}) {
  const scoped = auditScope(detail.auditEvent, routeScope);
  const targetScoped = targetScope(detail.target, routeScope);
  const targetHref = targetBoardHref(detail.target, routeScope);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      {sectionHeader(
        routeScope,
        "Audit Detail",
        "Single operator intervention record, linked back to its durable target and the affected session projection."
      )}

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.16em] text-white/42">
              {auditLabel(detail.auditEvent)} audit
            </div>
            <h2 className="text-2xl font-semibold text-white">
              {detail.auditEvent.summary}
            </h2>
            <p className="text-sm text-white/58">
              {detail.auditEvent.id} · {detail.auditEvent.kind} ·{" "}
              {formatTimestamp(detail.auditEvent.occurredAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 ${statusTone(
                detail.auditEvent.outcome
              )}`}
            >
              {detail.auditEvent.outcome}
            </span>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-white/72">
              actor: {detail.auditEvent.actorId ?? detail.auditEvent.actorType}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a
            className="rounded-full bg-sky-500/90 px-4 py-2 text-white"
            href={buildExecutionAuditsScopeHref(scoped)}
          >
            Back to audits
          </a>
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={buildExecutionWorkspaceScopeHref(detail.auditEvent.sessionId, scoped)}
          >
            Open workspace
          </a>
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={buildExecutionSessionsScopeHref(scoped)}
          >
            Session lane
          </a>
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={targetHref}
          >
            {detail.target?.targetKind === "approval_request"
              ? "Approval queue"
              : detail.target?.targetKind === "recovery_incident"
                ? "Recovery lane"
                : "Audit lane"}
          </a>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Audit facts
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/58">
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                target kind
              </dt>
              <dd>{detail.auditEvent.targetKind}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                target id
              </dt>
              <dd>{detail.auditEvent.targetId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                session
              </dt>
              <dd>{detail.auditEvent.sessionId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                project
              </dt>
              <dd>{detail.auditEvent.projectId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                summary
              </dt>
              <dd>{detail.auditEvent.summary}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                sequence
              </dt>
              <dd>{detail.auditEvent.sequence}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Directory summary
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/58">
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                total
              </dt>
              <dd>{detail.summary.total}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                approvals
              </dt>
              <dd>{detail.summary.approvals}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                recoveries
              </dt>
              <dd>{detail.summary.recoveries}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                applied
              </dt>
              <dd>{detail.summary.applied}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                rejected
              </dt>
              <dd>{detail.summary.rejected}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                failed
              </dt>
              <dd>{detail.summary.failed}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Target object
          </div>
          {detail.target ? (
            <>
              <div className="mt-3 text-lg font-medium text-white">
                {detail.target.title}
              </div>
              <p className="mt-1 text-sm text-white/58">{detail.target.summary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/58">
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                    status
                  </dt>
                  <dd>{detail.target.status}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                    revision
                  </dt>
                  <dd>{detail.target.revision ?? "n/a"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                    project
                  </dt>
                  <dd>{detail.target.projectName}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                    account
                  </dt>
                  <dd>{detail.target.accountId ?? "n/a"}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a
                  className="rounded-full border border-white/12 px-4 py-2 text-white/78"
                  href={targetHref}
                >
                  Open target lane
                </a>
                <a
                  className="rounded-full border border-white/12 px-4 py-2 text-white/78"
                  href={buildExecutionWorkspaceScopeHref(detail.target.sessionId, targetScoped)}
                >
                  Open target workspace
                </a>
              </div>
            </>
          ) : (
            <div className="mt-3 text-sm text-white/58">
              Target object is no longer present in the current shell directory,
              but the audit record remains durable.
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Session projection
          </div>
          {detail.session ? (
            <>
              <div className="mt-3 text-lg font-medium text-white">
                {detail.session.title}
              </div>
              <div className="mt-1 text-sm text-white/58">
                {detail.session.projectName} · {detail.session.id}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/58">
                {sessionFacts(detail.session).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/38">
                      {label}
                    </dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <div className="mt-3 text-sm text-white/58">
              Session projection is unavailable for this audit record.
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Payload
          </div>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-white/[0.03] p-4 text-xs text-white/58">
            {prettyJson(detail.auditEvent.payload)}
          </pre>
        </article>

        <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Raw
          </div>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-white/[0.03] p-4 text-xs text-white/58">
            {prettyJson(detail.auditEvent.raw)}
          </pre>
        </article>
      </section>
    </main>
  );
}
