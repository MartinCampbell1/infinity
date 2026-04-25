import { NextResponse } from "next/server";

import type { AutopilotExecutionEventRecord } from "@founderos/api-clients";

import type { ShellExecutionEventsSnapshot } from "../../../../../lib/execution-events-model";
import type { NormalizedExecutionEvent } from "../../../../../lib/server/control-plane/events";
import { getExecutionSessionEvents } from "../../../../../lib/server/control-plane/sessions";
import {
  directoryCacheHeaders,
  matchesDirectorySearchQuery,
  paginateDirectoryItems,
  parseDirectoryPagination,
  readDirectoryFilter,
  readDirectorySearchQuery,
} from "../../../../../lib/server/http/directory-pagination";

export const dynamic = "force-dynamic";

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function eventStatus(event: NormalizedExecutionEvent) {
  if (event.status) {
    return event.status;
  }
  if (event.kind === "approval.requested") {
    return "pending";
  }
  if (event.kind === "approval.resolved") {
    return "completed";
  }
  if (event.kind === "tool.started") {
    return "in_progress";
  }
  if (event.kind === "tool.completed") {
    return "completed";
  }
  if (event.kind === "error.raised") {
    return "failed";
  }
  if (event.kind === "recovery.started") {
    return "running";
  }
  if (event.kind === "recovery.completed" || event.kind === "turn.completed") {
    return "completed";
  }
  return "info";
}

function toAutopilotExecutionEventRecord(event: NormalizedExecutionEvent): AutopilotExecutionEventRecord {
  return {
    event: event.kind,
    project_id: event.projectId,
    project_name: asString(event.payload.projectName),
    status: eventStatus(event),
    message: event.summary,
    timestamp: event.timestamp,
    runtime_agent_id: asString(event.payload.runtimeAgentId),
    runtime_agent_ids: Array.isArray(event.payload.runtimeAgentIds)
      ? event.payload.runtimeAgentIds.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        )
      : undefined,
    agent_action_run_id: asString(event.payload.agentActionRunId),
    orchestrator_session_id: event.sessionId,
    tool_name: asString(event.payload.toolName),
    approval_id: asString(event.payload.approvalId),
    issue_id: asString(event.payload.issueId),
    actor: event.provider,
    source: event.source,
  };
}

function eventRuntimeAgentIds(event: NormalizedExecutionEvent) {
  const primary = asString(event.payload.runtimeAgentId);
  const many = Array.isArray(event.payload.runtimeAgentIds)
    ? event.payload.runtimeAgentIds.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];
  return [primary, ...many].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

function matchesFilter(
  event: NormalizedExecutionEvent,
  filters: {
    projectId: string | null;
    groupId: string | null;
    orchestratorSessionId: string | null;
    runtimeAgentId: string | null;
    initiativeId: string | null;
    orchestrator: string | null;
    kind: string | null;
    status: string | null;
    source: string | null;
    provider: string | null;
    query: string | null;
  }
) {
  if (filters.projectId && event.projectId !== filters.projectId) {
    return false;
  }
  if (filters.groupId && (event.groupId ?? "") !== filters.groupId) {
    return false;
  }
  if (
    filters.orchestratorSessionId &&
    event.sessionId !== filters.orchestratorSessionId
  ) {
    return false;
  }
  if (filters.runtimeAgentId) {
    const runtimeAgentIds = eventRuntimeAgentIds(event);
    if (!runtimeAgentIds.includes(filters.runtimeAgentId)) {
      return false;
    }
  }
  if (
    filters.initiativeId &&
    event.projectId !== filters.initiativeId &&
    asString(event.payload.initiativeId) !== filters.initiativeId
  ) {
    return false;
  }
  if (
    filters.orchestrator &&
    event.provider !== filters.orchestrator &&
    event.source !== filters.orchestrator &&
    asString(event.payload.orchestrator) !== filters.orchestrator
  ) {
    return false;
  }
  if (filters.kind && event.kind !== filters.kind) {
    return false;
  }
  if (filters.status && eventStatus(event) !== filters.status) {
    return false;
  }
  if (filters.source && event.source !== filters.source) {
    return false;
  }
  if (filters.provider && event.provider !== filters.provider) {
    return false;
  }

  return matchesDirectorySearchQuery(
    [
      event.id,
      event.sessionId,
      event.projectId,
      event.groupId,
      event.source,
      event.provider,
      event.kind,
      eventStatus(event),
      event.phase,
      event.summary,
      event.payload.projectName,
      event.payload.title,
      event.payload.runtimeAgentId,
      event.payload.runtimeAgentIds,
      event.payload.agentActionRunId,
      event.payload.toolName,
      event.payload.approvalId,
      event.payload.issueId,
      event.payload.accountId,
      event.payload.workspaceId,
      event.payload.initiativeId,
      event.payload.orchestrator,
    ],
    filters.query,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pagination = parseDirectoryPagination(searchParams, {
    defaultLimit: 250,
    maxLimit: 500,
  });
  const filters = {
    projectId: readDirectoryFilter(searchParams, "project_id"),
    groupId: readDirectoryFilter(searchParams, "group_id"),
    orchestratorSessionId: readDirectoryFilter(searchParams, "orchestrator_session_id"),
    runtimeAgentId: readDirectoryFilter(searchParams, "runtime_agent_id"),
    initiativeId: readDirectoryFilter(searchParams, "initiative_id"),
    orchestrator: readDirectoryFilter(searchParams, "orchestrator"),
    kind: readDirectoryFilter(searchParams, "kind") ?? readDirectoryFilter(searchParams, "event"),
    status: readDirectoryFilter(searchParams, "status"),
    source: readDirectoryFilter(searchParams, "source"),
    provider: readDirectoryFilter(searchParams, "provider"),
    query: readDirectorySearchQuery(searchParams),
  };

  const normalizedEvents = await getExecutionSessionEvents();
  const matchingEvents = normalizedEvents
    .filter((event) => matchesFilter(event, filters))
    .map(toAutopilotExecutionEventRecord);
  const page = paginateDirectoryItems(matchingEvents, pagination);
  const generatedAt = new Date().toISOString();

  const response: ShellExecutionEventsSnapshot = {
    generatedAt,
    events: page.items,
    totalEvents: normalizedEvents.length,
    filteredEvents: matchingEvents.length,
    pageInfo: page.pageInfo,
    latestEventAt: page.items[0]?.timestamp ?? null,
    eventsLoadState: "ready",
    eventsError: null,
    filters: {
      ...filters,
      limit: pagination.limit,
      cursor: pagination.cursor,
    },
  };

  return NextResponse.json(response, {
    headers: directoryCacheHeaders({
      route: "/api/shell/execution/events",
      generatedAt,
      itemCount: matchingEvents.length,
    }),
  });
}
