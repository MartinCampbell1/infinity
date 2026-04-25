import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { GET as getExecutionEvents } from "./route";
import { POST as postAccountQuotas } from "../../../control/accounts/quotas/route";
import { POST as postWorkspaceRuntimeIngest } from "../../../control/execution/workspace/[sessionId]/runtime/route";
import { respondToMockApprovalRequest } from "../../../../../lib/server/control-plane/approvals/mock";
import { recordMockRecoveryAction } from "../../../../../lib/server/control-plane/recoveries/mock";
import { createIsolatedControlPlaneStateDir } from "../../../../../lib/server/control-plane/state/test-helpers";

let restoreStateDir: (() => void) | null = null;

const SERVICE_ACTOR_HEADERS = {
  "x-founderos-actor-type": "service",
  "x-founderos-actor-id": "events-route-test-producer",
  "x-founderos-tenant-id": "default",
  "x-founderos-request-id": "request-events-route-test",
  "x-founderos-auth-boundary": "token",
};

beforeEach(() => {
  const { restore } = createIsolatedControlPlaneStateDir();
  restoreStateDir = restore;
});

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("/api/shell/execution/events", () => {
  test("returns a snapshot built from normalized mock events", async () => {
    const response = await getExecutionEvents(
      new Request("http://localhost/api/shell/execution/events?limit=5")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.eventsLoadState).toBe("ready");
    expect(body.eventsError).toBeNull();
    expect(body.totalEvents).toBeGreaterThanOrEqual(body.filteredEvents);
    expect(body.filteredEvents).toBeGreaterThan(0);
    expect(body.events).toHaveLength(5);
    expect(body.pageInfo).toEqual(
      expect.objectContaining({
        limit: 5,
        cursor: null,
        totalItems: body.filteredEvents,
      })
    );
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{24}"$/);
    expect(body.events[0]).toEqual(
      expect.objectContaining({
        event: expect.any(String),
        project_id: expect.any(String),
        orchestrator_session_id: expect.any(String),
        source: expect.any(String),
      })
    );
  });

  test("uses an opaque cursor for the next events page", async () => {
    const firstResponse = await getExecutionEvents(
      new Request("http://localhost/api/shell/execution/events?limit=2")
    );
    const firstBody = await firstResponse.json();
    const cursor = firstBody.pageInfo.nextCursor;

    const secondResponse = await getExecutionEvents(
      new Request(`http://localhost/api/shell/execution/events?limit=2&cursor=${cursor}`)
    );
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(cursor).toEqual(expect.any(String));
    expect(secondBody.filters.cursor).toBe(cursor);
    expect(secondBody.events[0]?.event).toBeTruthy();
    expect(secondBody.events).not.toEqual(firstBody.events);
  });

  test("honors project and session filters", async () => {
    const response = await getExecutionEvents(
      new Request(
        "http://localhost/api/shell/execution/events?project_id=project-borealis&orchestrator_session_id=session-2026-04-11-002"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.filters.projectId).toBe("project-borealis");
    expect(body.filters.orchestratorSessionId).toBe("session-2026-04-11-002");
    expect(body.events.length).toBeGreaterThan(0);
    expect(
      body.events.every(
        (event: { project_id: string; orchestrator_session_id: string }) =>
          event.project_id === "project-borealis" &&
          event.orchestrator_session_id === "session-2026-04-11-002"
      )
    ).toBe(true);
  });

  test("applies exact filters and search before paginating events", async () => {
    const response = await getExecutionEvents(
      new Request(
        "http://localhost/api/shell/execution/events?initiative_id=project-borealis&group_id=group-core-02&provider=codex&source=manual&kind=error.raised&status=failed&q=validation&limit=2"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.filters.initiativeId).toBe("project-borealis");
    expect(body.filters.groupId).toBe("group-core-02");
    expect(body.filters.provider).toBe("codex");
    expect(body.filters.source).toBe("manual");
    expect(body.filters.kind).toBe("error.raised");
    expect(body.filters.status).toBe("failed");
    expect(body.filters.query).toBe("validation");
    expect(body.filteredEvents).toBeGreaterThan(0);
    expect(
      body.events.every(
        (event: {
          event: string;
          project_id: string;
          status: string;
          message: string;
          source: string;
        }) =>
          event.event === "error.raised" &&
          event.project_id === "project-borealis" &&
          event.status === "failed" &&
          event.source === "manual" &&
          event.message.toLowerCase().includes("validation")
      )
    ).toBe(true);
  });

  test("exports approval.resolved after an approval resolve action", async () => {
    const result = await respondToMockApprovalRequest("approval-001", "approve_once");

    const response = await getExecutionEvents(
      new Request(
        "http://localhost/api/shell/execution/events?orchestrator_session_id=session-2026-04-11-001&limit=20"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.eventsLoadState).toBe("ready");
    expect(result?.accepted).toBe(true);
    expect(
      body.events.some(
        (event: {
          event: string;
          approval_id: string | null;
          orchestrator_session_id: string;
          status: string;
        }) =>
          event.event === "approval.resolved" &&
          event.approval_id === "approval-001" &&
          event.status === "completed" &&
          event.orchestrator_session_id === "session-2026-04-11-001"
      )
    ).toBe(true);
  });

  test("exports recovery.started after a failover recovery action", async () => {
    const result = await recordMockRecoveryAction("recovery-001", "failover", {
      targetAccountId: "account-chatgpt-03",
    });

    const response = await getExecutionEvents(
      new Request(
        "http://localhost/api/shell/execution/events?orchestrator_session_id=session-2026-04-11-001&limit=20"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.eventsLoadState).toBe("ready");
    expect(result?.accepted).toBe(true);
    expect(
      body.events.some(
        (event: {
          event: string;
          orchestrator_session_id: string;
          status: string;
        }) =>
          event.event === "recovery.started" &&
          event.status === "in_progress" &&
          event.orchestrator_session_id === "session-2026-04-11-001"
      )
    ).toBe(true);
  });

  test("exports recovery.completed after a resolve recovery action", async () => {
    const result = await recordMockRecoveryAction("recovery-002", "resolve");

    const response = await getExecutionEvents(
      new Request(
        "http://localhost/api/shell/execution/events?orchestrator_session_id=session-2026-04-11-002&limit=20"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.eventsLoadState).toBe("ready");
    expect(result?.accepted).toBe(true);
    expect(
      body.events.some(
        (event: {
          event: string;
          orchestrator_session_id: string;
          status: string;
        }) =>
          event.event === "recovery.completed" &&
          event.status === "completed" &&
          event.orchestrator_session_id === "session-2026-04-11-002"
      )
    ).toBe(true);
  });

  test("exports quota.updated after a quota producer ingest", async () => {
    const ingestResponse = await postAccountQuotas(
      new Request("http://localhost/api/control/accounts/quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...SERVICE_ACTOR_HEADERS },
        body: JSON.stringify({
          producer: "openai_app_server",
          snapshot: {
            accountId: "account-chatgpt-02",
            authMode: "chatgptAuthTokens",
            source: "openai_app_server",
            observedAt: "2026-04-11T15:10:00.000Z",
            buckets: [
              {
                limitId: "req_5h",
                usedPercent: 95,
                resetsAt: "2026-04-11T15:25:00.000Z",
              },
            ],
            raw: {
              endpoint: "account/rateLimits/updated",
            },
          },
        }),
      })
    );
    const ingestBody = await ingestResponse.json();

    const response = await getExecutionEvents(
      new Request(
        "http://localhost/api/shell/execution/events?orchestrator_session_id=session-2026-04-11-002&limit=20"
      )
    );
    const body = await response.json();

    expect(ingestResponse.status).toBe(200);
    expect(ingestBody.accepted).toBe(true);
    expect(response.status).toBe(200);
    expect(
      body.events.some(
        (event: {
          event: string;
          orchestrator_session_id: string;
          status: string;
          source: string;
        }) =>
          event.event === "quota.updated" &&
          event.orchestrator_session_id === "session-2026-04-11-002" &&
          event.status === "info" &&
          event.source === "codex_app_server"
      )
    ).toBe(true);
  });

  test("exports tool runtime events with operator-friendly statuses", async () => {
    const ingestResponse = await postWorkspaceRuntimeIngest(
      new Request(
        "http://localhost/api/control/execution/workspace/session-2026-04-11-001/runtime",
        {
          method: "POST",
          headers: { "content-type": "application/json", ...SERVICE_ACTOR_HEADERS },
          body: JSON.stringify({
            hostContext: {
              projectId: "project-atlas",
              projectName: "Atlas Launch",
              sessionId: "session-2026-04-11-001",
              groupId: "group-ops-01",
              accountId: "account-chatgpt-01",
              workspaceId: "workspace-atlas-main",
              openedFrom: "execution_board",
            },
            producer: "workspace_runtime_bridge",
            messages: [
              {
                type: "workspace.tool.started",
                payload: {
                  toolName: "route-test-tool",
                  eventId: "evt-route-test-001",
                },
              },
              {
                type: "workspace.tool.completed",
                payload: {
                  toolName: "route-test-tool",
                  eventId: "evt-route-test-001",
                  status: "completed",
                },
              },
            ],
          }),
        }
      ),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );
    const ingestBody = await ingestResponse.json();

    const response = await getExecutionEvents(
      new Request(
        "http://localhost/api/shell/execution/events?orchestrator_session_id=session-2026-04-11-001&limit=30"
      )
    );
    const body = await response.json();

    expect(ingestResponse.status).toBe(200);
    expect(ingestBody.accepted).toBe(true);
    expect(response.status).toBe(200);
    expect(
      body.events.some(
        (event: {
          event: string;
          status: string;
          tool_name: string | null;
        }) =>
          event.event === "tool.started" &&
          event.status === "in_progress" &&
          event.tool_name === "route-test-tool"
      )
    ).toBe(true);
    expect(
      body.events.some(
        (event: {
          event: string;
          status: string;
          tool_name: string | null;
        }) =>
          event.event === "tool.completed" &&
          event.status === "completed" &&
          event.tool_name === "route-test-tool"
      )
    ).toBe(true);
  });
});
