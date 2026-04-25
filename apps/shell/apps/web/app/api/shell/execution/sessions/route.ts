import { NextResponse } from "next/server";

import type { ExecutionSessionSummary } from "@/lib/server/control-plane/contracts/session-events";
import { getExecutionSessionSummaries } from "../../../../../lib/server/control-plane/sessions/index";
import {
  directoryCacheHeaders,
  matchesDirectorySearchQuery,
  paginateDirectoryItems,
  parseDirectoryPagination,
  readDirectoryFilter,
  readDirectorySearchQuery,
} from "../../../../../lib/server/http/directory-pagination";

export const dynamic = "force-dynamic";

function parseArchivedFilter(searchParams: URLSearchParams) {
  const archived = readDirectoryFilter(searchParams, "archived");
  if (archived === "all" || archived === "*") {
    return "all" as const;
  }
  if (archived === "true" || archived === "1") {
    return "true" as const;
  }
  return "false" as const;
}

function matchesSessionFilters(
  session: ExecutionSessionSummary,
  filters: {
    projectId: string | null;
    sessionId: string | null;
    groupId: string | null;
    accountId: string | null;
    workspaceId: string | null;
    status: string | null;
    provider: string | null;
    recoveryState: string | null;
    quotaPressure: string | null;
    archived: "all" | "true" | "false";
    query: string | null;
  },
) {
  if (filters.archived !== "all") {
    const expectedArchived = filters.archived === "true";
    if (session.archived !== expectedArchived) {
      return false;
    }
  }
  if (filters.projectId && session.projectId !== filters.projectId) {
    return false;
  }
  if (filters.sessionId && session.id !== filters.sessionId) {
    return false;
  }
  if (filters.groupId && (session.groupId ?? "") !== filters.groupId) {
    return false;
  }
  if (filters.accountId && (session.accountId ?? "") !== filters.accountId) {
    return false;
  }
  if (filters.workspaceId && (session.workspaceId ?? "") !== filters.workspaceId) {
    return false;
  }
  if (filters.status && session.status !== filters.status) {
    return false;
  }
  if (filters.provider && session.provider !== filters.provider) {
    return false;
  }
  if (filters.recoveryState && session.recoveryState !== filters.recoveryState) {
    return false;
  }
  if (filters.quotaPressure && session.quotaPressure !== filters.quotaPressure) {
    return false;
  }

  return matchesDirectorySearchQuery(
    [
      session.id,
      session.externalSessionId,
      session.projectId,
      session.projectName,
      session.groupId,
      session.workspaceId,
      session.accountId,
      session.provider,
      session.model,
      session.title,
      session.status,
      session.phase,
      session.tags,
      session.recoveryState,
      session.quotaPressure,
    ],
    filters.query,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pagination = parseDirectoryPagination(searchParams, {
    defaultLimit: 8,
    maxLimit: 20,
  });
  const filters = {
    projectId: readDirectoryFilter(searchParams, "project_id"),
    sessionId: readDirectoryFilter(searchParams, "session_id"),
    groupId: readDirectoryFilter(searchParams, "group_id"),
    accountId: readDirectoryFilter(searchParams, "account_id"),
    workspaceId: readDirectoryFilter(searchParams, "workspace_id"),
    status: readDirectoryFilter(searchParams, "status"),
    provider: readDirectoryFilter(searchParams, "provider"),
    recoveryState: readDirectoryFilter(searchParams, "recovery_state"),
    quotaPressure: readDirectoryFilter(searchParams, "quota_pressure"),
    archived: parseArchivedFilter(searchParams),
    query: readDirectorySearchQuery(searchParams),
  };
  const allSessions = await getExecutionSessionSummaries();
  const availableSessions = allSessions.filter((session: ExecutionSessionSummary) =>
    matchesSessionFilters(session, filters)
  );
  const page = paginateDirectoryItems(availableSessions, pagination);
  const generatedAt = new Date().toISOString();

  return NextResponse.json({
    generatedAt,
    sessions: page.items,
    totalSessions: allSessions.length,
    filteredSessions: availableSessions.length,
    pageInfo: page.pageInfo,
    sessionsLoadState: "ready",
    sessionsError: null,
    filters: {
      ...filters,
      limit: pagination.limit,
      cursor: pagination.cursor,
    },
  }, {
    headers: directoryCacheHeaders({
      route: "/api/shell/execution/sessions",
      generatedAt,
      itemCount: availableSessions.length,
    }),
  });
}
