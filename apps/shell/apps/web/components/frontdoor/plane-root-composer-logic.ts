import type { ShellRouteScope } from "../../lib/route-scope";

export function deriveTitleFromPrompt(prompt: string) {
  const normalized = prompt.trim().split("\n")[0]?.trim() ?? "";
  if (!normalized) {
    return "Untitled autonomous run";
  }

  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

export function buildInitiativeCreateRequest(
  prompt: string,
  requestedBy: string,
  routeScope?: ShellRouteScope
) {
  const normalizedPrompt = prompt.trim();

  return {
    title: deriveTitleFromPrompt(normalizedPrompt),
    userRequest: normalizedPrompt,
    requestedBy: requestedBy.trim() || "operator",
    workspaceSessionId: routeScope?.sessionId || null,
  };
}

export function buildAutonomousBriefCreateRequest(
  initiativeId: string,
  prompt: string
) {
  return {
    initiativeId,
    summary: prompt,
    goals: [],
    nonGoals: [],
    constraints: [],
    assumptions: [],
    acceptanceCriteria: [],
    repoScope: [],
    deliverables: [],
    clarificationLog: [],
    authoredBy: "hermes-intake",
    status: "clarifying" as const,
  };
}
