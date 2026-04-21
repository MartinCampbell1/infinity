import React from "react";

import {
  buildExecutionEventsScopeHref,
  buildExecutionSessionsScopeHref,
  buildExecutionWorkspaceScopeHref,
  readShellRouteScopeFromQueryRecord,
  routeScopeFromProjectRef,
} from "@/lib/route-scope";
import {
  ExecutionDetailActionLink,
  ExecutionDetailList,
  ExecutionDetailListItem,
  ExecutionDetailMetric,
  ExecutionDetailMetricGrid,
  ExecutionDetailPage,
  ExecutionDetailSection,
  ExecutionDetailStatusPill,
} from "../../../../../components/execution/detail-primitives";
import {
  getExecutionSessionEvents,
  getExecutionSessionSummaries,
} from "@/lib/server/control-plane/sessions";

type ExecutionProjectSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: ExecutionProjectSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const intakeSessionId = Array.isArray(resolvedSearchParams?.intake_session_id)
    ? resolvedSearchParams?.intake_session_id[0]
    : resolvedSearchParams?.intake_session_id;
  const routeScope = routeScopeFromProjectRef(
    resolvedParams.projectId,
    intakeSessionId,
    readShellRouteScopeFromQueryRecord(resolvedSearchParams)
  );

  const [sessions, events] = await Promise.all([
    getExecutionSessionSummaries(),
    getExecutionSessionEvents(),
  ]);
  const projectSessions = sessions.filter(
    (session) => session.projectId === resolvedParams.projectId
  );
  const projectEvents = events.filter(
    (event) => event.projectId === resolvedParams.projectId
  );
  const latestSession = projectSessions[0] ?? null;

  return (
    <ExecutionDetailPage
      eyebrow="Execution"
      title="Project execution"
      description={`Shell-scoped summary for project ${resolvedParams.projectId} using the current durable session and event truth.`}
    >
      <ExecutionDetailMetricGrid>
        <ExecutionDetailMetric label="Sessions" value={String(projectSessions.length)} />
        <ExecutionDetailMetric label="Events" value={String(projectEvents.length)} />
        <ExecutionDetailMetric
          label="Latest session"
          value={latestSession?.title ?? "No session bound to this project"}
        />
      </ExecutionDetailMetricGrid>

      <ExecutionDetailSection title="Sessions">
        {projectSessions.length > 0 ? (
          <ExecutionDetailList>
            {projectSessions.map((session) => (
              <ExecutionDetailListItem
                key={session.id}
                title={session.title}
                detail={`${session.provider} · ${session.projectName}`}
                meta={
                  <div className="flex flex-wrap items-center gap-2">
                    <ExecutionDetailStatusPill value={session.status} />
                    <span>{session.id}</span>
                  </div>
                }
                action={
                  <ExecutionDetailActionLink
                    href={buildExecutionWorkspaceScopeHref(session.id, routeScope)}
                  >
                    Open workspace
                  </ExecutionDetailActionLink>
                }
              />
            ))}
          </ExecutionDetailList>
        ) : (
          <div className="text-sm text-white/58">
            No durable execution sessions currently resolve to this project id.
          </div>
        )}
      </ExecutionDetailSection>

      <ExecutionDetailSection title="Recent events">
        {projectEvents.length > 0 ? (
          <ExecutionDetailList>
            {projectEvents.slice(0, 10).map((event) => (
              <ExecutionDetailListItem
                key={event.id}
                title={event.summary}
                detail={event.kind}
                meta={event.timestamp}
              />
            ))}
          </ExecutionDetailList>
        ) : (
          <div className="text-sm text-white/58">
            No normalized execution events currently resolve to this project id.
          </div>
        )}
      </ExecutionDetailSection>

      <ExecutionDetailSection title="Actions">
        <div className="flex flex-wrap gap-3">
          <ExecutionDetailActionLink href={buildExecutionSessionsScopeHref(routeScope)}>
            Open sessions
          </ExecutionDetailActionLink>
          <ExecutionDetailActionLink
            href={buildExecutionEventsScopeHref(routeScope, {
              orchestratorSessionId: latestSession?.id ?? null,
            })}
          >
            Open scoped events
          </ExecutionDetailActionLink>
        </div>
      </ExecutionDetailSection>
    </ExecutionDetailPage>
  );
}
