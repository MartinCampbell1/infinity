import { NextResponse } from "next/server";

import { buildExecutionAgentsSnapshot } from "@/lib/execution-agents";
import {
  directoryCacheHeaders,
  matchesDirectorySearchQuery,
  paginateDirectoryItems,
  parseDirectoryPagination,
  readDirectoryFilter,
  readDirectorySearchQuery,
} from "../../../../../lib/server/http/directory-pagination";

export const dynamic = "force-dynamic";

function matchesAgentFilters(
  agent: Awaited<ReturnType<typeof buildExecutionAgentsSnapshot>>["agents"][number],
  filters: {
    projectId: string | null;
    runtimeAgentId: string | null;
    status: string | null;
    role: string | null;
    provider: string | null;
    query: string | null;
  },
) {
  if (filters.projectId && (agent.project_id ?? "") !== filters.projectId) {
    return false;
  }
  if (filters.runtimeAgentId && agent.agent_id !== filters.runtimeAgentId) {
    return false;
  }
  if (filters.status && agent.status !== filters.status) {
    return false;
  }
  if (filters.role && agent.role !== filters.role) {
    return false;
  }
  if (filters.provider && (agent.provider ?? "") !== filters.provider) {
    return false;
  }

  return matchesDirectorySearchQuery(
    [
      agent.agent_id,
      agent.label,
      agent.project_id,
      agent.project_name,
      agent.role,
      agent.status,
      agent.story_title,
      agent.story_status,
      agent.attention?.state,
      agent.attention?.recommended_action,
      agent.attention?.reasons,
      agent.provider,
      agent.profile_name,
    ],
    filters.query,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pagination = parseDirectoryPagination(searchParams, {
    defaultLimit: 50,
    maxLimit: 200,
  });
  const filters = {
    projectId: readDirectoryFilter(searchParams, "project_id"),
    runtimeAgentId:
      readDirectoryFilter(searchParams, "runtime_agent_id") ??
      readDirectoryFilter(searchParams, "agent_id"),
    status: readDirectoryFilter(searchParams, "status"),
    role: readDirectoryFilter(searchParams, "role"),
    provider: readDirectoryFilter(searchParams, "provider"),
    query: readDirectorySearchQuery(searchParams),
  };
  const snapshot = await buildExecutionAgentsSnapshot();
  const matchingAgents = snapshot.agents.filter((agent) =>
    matchesAgentFilters(agent, filters)
  );
  const page = paginateDirectoryItems(matchingAgents, pagination);
  const response = {
    ...snapshot,
    agents: page.items,
    agentsTotal: snapshot.agents.length,
    agentsFiltered: matchingAgents.length,
    agentsPageInfo: page.pageInfo,
    agentsFilters: {
      ...filters,
      limit: pagination.limit,
      cursor: pagination.cursor,
    },
  };

  return NextResponse.json(response, {
    headers: directoryCacheHeaders({
      route: "/api/shell/execution/agents",
      generatedAt: response.generatedAt,
      itemCount: page.pageInfo.totalItems,
    }),
  });
}
