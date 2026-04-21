import type { AutopilotExecutionEventRecord } from "@founderos/api-clients";

export type ShellSnapshotLoadState = "idle" | "loading" | "ready" | "error";

export interface ShellExecutionEventsSnapshot {
  generatedAt: string;
  events: AutopilotExecutionEventRecord[];
  totalEvents: number;
  filteredEvents: number;
  latestEventAt: string | null;
  eventsLoadState: ShellSnapshotLoadState;
  eventsError: string | null;
  filters: {
    projectId: string | null;
    orchestratorSessionId: string | null;
    runtimeAgentId: string | null;
    limit: number;
  };
}

export function emptyShellExecutionEventsSnapshot(): ShellExecutionEventsSnapshot {
  return {
    generatedAt: new Date(0).toISOString(),
    events: [],
    totalEvents: 0,
    filteredEvents: 0,
    latestEventAt: null,
    eventsLoadState: "idle",
    eventsError: null,
    filters: {
      projectId: null,
      orchestratorSessionId: null,
      runtimeAgentId: null,
      limit: 0,
    },
  };
}
