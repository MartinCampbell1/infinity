import React from "react";

import { ExecutionRunComposer } from "@/components/execution/execution-run-composer";
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
  buildExecutionEventsScopeHref,
  buildExecutionWorkspaceScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import {
  getExecutionSessionEvents,
  getExecutionSessionSummaries,
} from "@/lib/server/control-plane/sessions";

type ExecutionIntakeSessionSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionIntakeSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams?: ExecutionIntakeSessionSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(resolvedSearchParams);

  const [sessions, events] = await Promise.all([
    getExecutionSessionSummaries(),
    getExecutionSessionEvents(),
  ]);
  const session =
    sessions.find((candidate) => candidate.id === resolvedParams.sessionId) ?? null;
  const sessionEvents = events.filter(
    (candidate) => candidate.sessionId === resolvedParams.sessionId
  );

  return (
    <ExecutionDetailPage
      eyebrow="Execution"
      title="Intake session alias"
      description="Shell-first runs do not keep a separate durable intake transcript yet. This route resolves the requested session id against current execution truth and keeps the composer available for follow-up work."
    >
      <ExecutionDetailMetricGrid>
        <ExecutionDetailMetric
          label="Session"
          value={session?.title ?? resolvedParams.sessionId}
        />
        <ExecutionDetailMetric
          label="Status"
          value={<ExecutionDetailStatusPill value={session?.status ?? "unknown"} />}
        />
        <ExecutionDetailMetric label="Events" value={String(sessionEvents.length)} />
      </ExecutionDetailMetricGrid>

      <ExecutionDetailSection title="Current binding">
        {session ? (
          <ExecutionDetailList>
            <ExecutionDetailListItem
              title={session.title}
              detail={`${session.projectName} · ${session.provider}`}
              meta={session.status}
            />
          </ExecutionDetailList>
        ) : (
          <div className="text-sm text-white/58">
            No current durable execution session resolves to this intake-session id.
          </div>
        )}
      </ExecutionDetailSection>

      <ExecutionRunComposer routeScope={routeScope} compact />

      <ExecutionDetailSection title="Actions">
        <div className="flex flex-wrap gap-3">
          {session ? (
            <ExecutionDetailActionLink
              href={buildExecutionWorkspaceScopeHref(session.id, routeScope)}
            >
              Open workspace
            </ExecutionDetailActionLink>
          ) : null}
          <ExecutionDetailActionLink
            href={buildExecutionEventsScopeHref(routeScope, {
              orchestratorSessionId: resolvedParams.sessionId,
            })}
          >
            Open session events
          </ExecutionDetailActionLink>
        </div>
      </ExecutionDetailSection>
    </ExecutionDetailPage>
  );
}
