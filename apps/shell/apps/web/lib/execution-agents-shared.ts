import type {
  AutopilotExecutionAgentActionRunSummaryRecord,
  AutopilotExecutionAgentActionRunsSummary,
  AutopilotExecutionAgentsSummary,
  AutopilotExecutionRuntimeAgentRecord,
  AutopilotProjectSummary,
} from "@founderos/api-clients";
import type { DirectoryPageInfo } from "@/lib/server/http/directory-pagination";

export interface ShellExecutionAgentsSnapshot {
  generatedAt: string;
  projects: AutopilotProjectSummary[];
  projectsError: string | null;
  projectsLoadState: "ready" | "error";
  agents: AutopilotExecutionRuntimeAgentRecord[];
  agentsTotal?: number;
  agentsFiltered?: number;
  agentsPageInfo?: DirectoryPageInfo;
  agentsFilters?: {
    projectId: string | null;
    runtimeAgentId: string | null;
    status: string | null;
    role: string | null;
    provider: string | null;
    query: string | null;
    limit: number;
    cursor?: string | null;
  };
  agentsError: string | null;
  agentsLoadState: "ready" | "error";
  agentsSummary: AutopilotExecutionAgentsSummary | null;
  agentsSummaryError: string | null;
  agentsSummaryLoadState: "ready" | "error";
  actionRuns: AutopilotExecutionAgentActionRunSummaryRecord[];
  actionRunsError: string | null;
  actionRunsLoadState: "ready" | "error";
  actionRunsSummary: AutopilotExecutionAgentActionRunsSummary | null;
  actionRunsSummaryError: string | null;
  actionRunsSummaryLoadState: "ready" | "error";
}

export function emptyShellExecutionAgentsSnapshot(): ShellExecutionAgentsSnapshot {
  return {
    generatedAt: "",
    projects: [],
    projectsError: null,
    projectsLoadState: "ready",
    agents: [],
    agentsTotal: 0,
    agentsFiltered: 0,
    agentsPageInfo: {
      limit: 0,
      cursor: null,
      nextCursor: null,
      hasNextPage: false,
      totalItems: 0,
    },
    agentsFilters: {
      projectId: null,
      runtimeAgentId: null,
      status: null,
      role: null,
      provider: null,
      query: null,
      limit: 0,
      cursor: null,
    },
    agentsError: null,
    agentsLoadState: "ready",
    agentsSummary: null,
    agentsSummaryError: null,
    agentsSummaryLoadState: "ready",
    actionRuns: [],
    actionRunsError: null,
    actionRunsLoadState: "ready",
    actionRunsSummary: null,
    actionRunsSummaryError: null,
    actionRunsSummaryLoadState: "ready",
  };
}
