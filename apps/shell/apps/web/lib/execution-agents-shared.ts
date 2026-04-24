import type {
  AutopilotExecutionAgentActionRunSummaryRecord,
  AutopilotExecutionAgentActionRunsSummary,
  AutopilotExecutionAgentsSummary,
  AutopilotExecutionRuntimeAgentRecord,
  AutopilotProjectSummary,
} from "@founderos/api-clients";

export interface ShellExecutionAgentsSnapshot {
  generatedAt: string;
  projects: AutopilotProjectSummary[];
  projectsError: string | null;
  projectsLoadState: "ready" | "error";
  agents: AutopilotExecutionRuntimeAgentRecord[];
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
