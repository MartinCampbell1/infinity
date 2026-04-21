import { NextResponse } from "next/server";

import type { AutopilotExecutionEventRecord } from "@founderos/api-clients";

import type { ShellExecutionEventsSnapshot } from "../../../../../lib/execution-events-model";
import type { NormalizedExecutionEvent } from "../../../../../lib/server/control-plane/events";
import { getExecutionSessionEvents } from "../../../../../lib/server/control-plane/sessions";

export const dynamic = "force-dynamic";

function parseLimit(searchParams: URLSearchParams) {
  const raw = Number(searchParams.get("limit") ?? 250);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 250;
  }
  return Math.min(Math.floor(raw), 500);
}

function parseOptional(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

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

function matchesFilter(
  record: AutopilotExecutionEventRecord,
  filters: {
    projectId: string | null;
    orchestratorSessionId: string | null;
    runtimeAgentId: string | null;
  }
) {
  if (filters.projectId && record.project_id !== filters.projectId) {
    return false;
  }
  if (
    filters.orchestratorSessionId &&
    record.orchestrator_session_id !== filters.orchestratorSessionId
  ) {
    return false;
  }
  if (filters.runtimeAgentId) {
    const runtimeAgentIds = [
      record.runtime_agent_id,
      ...(record.runtime_agent_ids ?? []),
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (!runtimeAgentIds.includes(filters.runtimeAgentId)) {
      return false;
    }
  }
  return true;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);
  const filters = {
    projectId: parseOptional(searchParams, "project_id"),
    orchestratorSessionId: parseOptional(searchParams, "orchestrator_session_id"),
    runtimeAgentId: parseOptional(searchParams, "runtime_agent_id"),
  };

  const allEvents = (await getExecutionSessionEvents()).map(toAutopilotExecutionEventRecord);
  const filteredEvents = allEvents.filter((event) => matchesFilter(event, filters)).slice(0, limit);

  const response: ShellExecutionEventsSnapshot = {
    generatedAt: new Date().toISOString(),
    events: filteredEvents,
    totalEvents: allEvents.length,
    filteredEvents: filteredEvents.length,
    latestEventAt: filteredEvents[0]?.timestamp ?? null,
    eventsLoadState: "ready",
    eventsError: null,
    filters: {
      ...filters,
      limit,
    },
  };

  return NextResponse.json(response);
}
