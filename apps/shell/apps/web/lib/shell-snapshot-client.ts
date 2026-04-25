import type { ShellExecutionAgentSnapshot } from "@/lib/execution-agent-model";
import type { ShellExecutionAgentsSnapshot } from "@/lib/execution-agents-shared";
import type { ShellExecutionEventsSnapshot } from "@/lib/execution-events-model";
import type { ShellExecutionHandoffsSnapshot } from "@/lib/execution-handoffs-model";

async function parseSnapshotError(response: Response) {
  const fallback = `Snapshot request failed: ${response.status}`;
  const raw = (await response.text()).trim();

  if (!raw) {
    return fallback;
  }

  try {
    const payload = JSON.parse(raw) as {
      detail?: string;
      error?: string | { message?: string };
      message?: string;
    };
    if (payload.error && typeof payload.error === "object" && payload.error.message) {
      return payload.error.message;
    }
    if (payload.detail) {
      return payload.detail;
    }
    if (payload.message) {
      return payload.message;
    }
  } catch {
    // Fall back to raw response body.
  }

  return raw;
}

async function requestShellSnapshotJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseSnapshotError(response));
  }

  return (await response.json()) as T;
}

export function fetchShellExecutionEventsSnapshot(
  input: RequestInfo | URL = "/api/shell/execution/events",
  init?: RequestInit
): Promise<ShellExecutionEventsSnapshot> {
  return requestShellSnapshotJson<ShellExecutionEventsSnapshot>(input, init);
}

export function fetchShellExecutionHandoffsSnapshot(
  input: RequestInfo | URL = "/api/shell/execution/handoffs",
  init?: RequestInit
): Promise<ShellExecutionHandoffsSnapshot> {
  return requestShellSnapshotJson<ShellExecutionHandoffsSnapshot>(input, init).catch(
    (error) => ({
      generatedAt: new Date().toISOString(),
      handoffs: [],
      handoffsError:
        error instanceof Error
          ? `Execution handoffs: ${error.message}`
          : "Execution handoffs: request failed.",
      handoffsLoadState: "error" as const,
    })
  );
}

export function fetchShellExecutionAgentsSnapshot(
  input: RequestInfo | URL = "/api/shell/execution/agents",
  init?: RequestInit
): Promise<ShellExecutionAgentsSnapshot> {
  return requestShellSnapshotJson<ShellExecutionAgentsSnapshot>(input, init).catch(
    (error) => ({
      generatedAt: new Date().toISOString(),
      projects: [],
      projectsError:
        error instanceof Error
          ? `Autopilot projects: ${error.message}`
          : "Autopilot projects: request failed.",
      projectsLoadState: "error" as const,
      agents: [],
      agentsError:
        error instanceof Error
          ? `Execution runtime agents: ${error.message}`
          : "Execution runtime agents: request failed.",
      agentsLoadState: "error" as const,
      agentsSummary: null,
      agentsSummaryError:
        error instanceof Error
          ? `Execution runtime agent summary: ${error.message}`
          : "Execution runtime agent summary: request failed.",
      agentsSummaryLoadState: "error" as const,
      actionRuns: [],
      actionRunsError:
        error instanceof Error
          ? `Execution runtime agent action runs: ${error.message}`
          : "Execution runtime agent action runs: request failed.",
      actionRunsLoadState: "error" as const,
      actionRunsSummary: null,
      actionRunsSummaryError:
        error instanceof Error
          ? `Execution runtime agent action run summary: ${error.message}`
          : "Execution runtime agent action run summary: request failed.",
      actionRunsSummaryLoadState: "error" as const,
    })
  );
}

export function fetchShellExecutionAgentSnapshot(
  runtimeAgentId: string,
  init?: RequestInit
): Promise<ShellExecutionAgentSnapshot> {
  return requestShellSnapshotJson<ShellExecutionAgentSnapshot>(
    `/api/shell/execution/agents/${encodeURIComponent(runtimeAgentId)}`,
    init
  ).catch((error) => ({
    generatedAt: new Date().toISOString(),
    runtimeAgentId,
    agent: null,
    agentError:
      error instanceof Error
        ? `Execution runtime agent: ${error.message}`
        : "Execution runtime agent: request failed.",
    agentLoadState: "error" as const,
  }));
}
