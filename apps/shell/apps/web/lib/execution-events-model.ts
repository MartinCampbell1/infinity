import type { AutopilotExecutionEventRecord } from "@founderos/api-clients";
import type { DirectoryPageInfo } from "@/lib/server/http/directory-pagination";

export type ShellSnapshotLoadState = "idle" | "loading" | "ready" | "error";

export interface ShellExecutionEventsSnapshot {
  generatedAt: string;
  events: AutopilotExecutionEventRecord[];
  totalEvents: number;
  filteredEvents: number;
  pageInfo?: DirectoryPageInfo;
  latestEventAt: string | null;
  eventsLoadState: ShellSnapshotLoadState;
  eventsError: string | null;
  filters: {
    projectId: string | null;
    groupId?: string | null;
    orchestratorSessionId: string | null;
    runtimeAgentId: string | null;
    initiativeId?: string | null;
    orchestrator?: string | null;
    kind?: string | null;
    status?: string | null;
    source?: string | null;
    provider?: string | null;
    query?: string | null;
    limit: number;
    cursor?: string | null;
  };
}

export function emptyShellExecutionEventsSnapshot(): ShellExecutionEventsSnapshot {
  return {
    generatedAt: new Date(0).toISOString(),
    events: [],
    totalEvents: 0,
    filteredEvents: 0,
    pageInfo: {
      limit: 0,
      cursor: null,
      nextCursor: null,
      hasNextPage: false,
      totalItems: 0,
    },
    latestEventAt: null,
    eventsLoadState: "idle",
    eventsError: null,
    filters: {
      projectId: null,
      groupId: null,
      orchestratorSessionId: null,
      runtimeAgentId: null,
      initiativeId: null,
      orchestrator: null,
      kind: null,
      status: null,
      source: null,
      provider: null,
      query: null,
      limit: 0,
      cursor: null,
    },
  };
}
