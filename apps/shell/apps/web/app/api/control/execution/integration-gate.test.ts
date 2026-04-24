import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../lib/server/control-plane/state/test-helpers";

import { POST as postAccountQuotas } from "../accounts/quotas/route";
import { GET as getExecutionEvents } from "../../shell/execution/events/route";
import { GET as getAuditDetail } from "./audits/[auditId]/route";
import { GET as getAuditsDirectory } from "./audits/route";
import { POST as postApprovalRespond } from "./approvals/[approvalId]/respond/route";
import { POST as postRecoveryAction } from "./recoveries/[recoveryId]/route";
import { POST as postWorkspaceRuntimeIngest } from "./workspace/[sessionId]/runtime/route";

let restoreStateDir: (() => void) | null = null;
const OPERATOR_ACTOR_HEADERS = {
  "x-founderos-actor-type": "operator",
  "x-founderos-actor-id": "operator-integration",
  "x-founderos-tenant-id": "tenant-integration",
  "x-founderos-request-id": "request-integration-operator",
  "x-founderos-auth-boundary": "token",
};
const SERVICE_ACTOR_HEADERS = {
  "x-founderos-actor-type": "service",
  "x-founderos-actor-id": "service-integration",
  "x-founderos-tenant-id": "tenant-integration",
  "x-founderos-request-id": "request-integration-service",
  "x-founderos-auth-boundary": "token",
};

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("shell control-plane integration gate", () => {
  test("keeps runtime, operator actions, quotas, audits, and execution exports aligned by sessionId", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const sessionId = "session-2026-04-11-001";
    const approvalId = "approval-integration-001";
    const recoveryId = "recovery-001";

    const runtimeResponse = await postWorkspaceRuntimeIngest(
      new Request(`http://localhost/api/control/execution/workspace/${sessionId}/runtime`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...SERVICE_ACTOR_HEADERS,
        },
        body: JSON.stringify({
          hostContext: {
            projectId: "project-atlas",
            projectName: "Atlas Launch",
            sessionId,
            externalSessionId: "hermes-8842",
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
                toolName: "integration-gate",
                eventId: "evt-integration-001",
              },
            },
            {
              type: "workspace.approval.requested",
              payload: {
                approvalId,
                summary: "Approve integration gate mutation",
                reason: "The integration gate exercises the live shell operator path.",
              },
            },
            {
              type: "workspace.tool.completed",
              payload: {
                toolName: "integration-gate",
                eventId: "evt-integration-001",
                status: "completed",
              },
            },
          ],
        }),
      }),
      { params: Promise.resolve({ sessionId }) }
    );
    const runtimeBody = await runtimeResponse.json();

    expect(runtimeResponse.status).toBe(200);
    expect(runtimeBody.accepted).toBe(true);
    expect(runtimeBody.persistedEvents).toHaveLength(3);
    expect(
      runtimeBody.persistedEvents.map((event: { kind: string }) => event.kind)
    ).toEqual(["tool.started", "approval.requested", "tool.completed"]);
    expect(runtimeBody.touchedApprovals).toEqual([
      expect.objectContaining({
        id: approvalId,
        sessionId,
        status: "pending",
      }),
    ]);
    expect(runtimeBody.runtimeSnapshot).toEqual(
      expect.objectContaining({
        latestEvent: expect.objectContaining({
          kind: "tool.completed",
          sessionId,
        }),
        session: expect.objectContaining({
          id: sessionId,
          projectId: "project-atlas",
        }),
      })
    );

    const approvalResponse = await postApprovalRespond(
      new Request(`http://localhost/api/control/execution/approvals/${approvalId}/respond`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...OPERATOR_ACTOR_HEADERS,
        },
        body: JSON.stringify({
          decision: "approve_session",
        }),
      }),
      { params: Promise.resolve({ approvalId }) }
    );
    const approvalBody = await approvalResponse.json();

    expect(approvalResponse.status).toBe(200);
    expect(approvalBody.accepted).toBe(true);
    expect(approvalBody.approvalRequest).toEqual(
      expect.objectContaining({
        id: approvalId,
        sessionId,
        status: "approved",
        decision: "approve_session",
      })
    );
    expect(approvalBody.operatorAction).toEqual(
      expect.objectContaining({
        targetKind: "approval_request",
        targetId: approvalId,
      })
    );
    expect(approvalBody.runtimeSnapshot).toEqual(
      expect.objectContaining({
        latestEvent: expect.objectContaining({
          kind: "approval.resolved",
          sessionId,
        }),
        session: expect.objectContaining({
          id: sessionId,
          pendingApprovals: 1,
        }),
      })
    );

    const quotaResponse = await postAccountQuotas(
      new Request("http://localhost/api/control/accounts/quotas", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...SERVICE_ACTOR_HEADERS,
        },
        body: JSON.stringify({
          producer: "openai_app_server",
          snapshot: {
            accountId: "account-chatgpt-01",
            authMode: "chatgpt",
            source: "openai_app_server",
            observedAt: "2026-04-11T16:05:00.000Z",
            buckets: [
              {
                limitId: "req_5h",
                limitName: "Requests / 5h",
                usedPercent: 96,
                windowDurationMins: 300,
                resetsAt: "2026-04-11T16:30:00.000Z",
              },
            ],
            raw: {
              endpoint: "account/rateLimits/updated",
              canonical: true,
            },
          },
          sessionIds: [sessionId],
          summary: "Integration gate raised quota pressure for session-2026-04-11-001.",
        }),
      })
    );
    const quotaBody = await quotaResponse.json();

    expect(quotaResponse.status).toBe(200);
    expect(quotaBody.accepted).toBe(true);
    expect(quotaBody.capacity).toEqual(
      expect.objectContaining({
        accountId: "account-chatgpt-01",
        pressure: "high",
        schedulable: true,
      })
    );
    expect(quotaBody.affectedSessionIds).toEqual([sessionId]);
    expect(quotaBody.persistedEvents).toEqual([
      expect.objectContaining({
        kind: "quota.updated",
        sessionId,
        source: "codex_app_server",
      }),
    ]);

    const recoveryResponse = await postRecoveryAction(
      new Request(`http://localhost/api/control/execution/recoveries/${recoveryId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...OPERATOR_ACTOR_HEADERS,
        },
        body: JSON.stringify({
          actionKind: "failover",
          targetAccountId: "account-chatgpt-03",
        }),
      }),
      { params: Promise.resolve({ recoveryId }) }
    );
    const recoveryBody = await recoveryResponse.json();

    expect(recoveryResponse.status).toBe(200);
    expect(recoveryBody.accepted).toBe(true);
    expect(recoveryBody.recoveryIncident).toEqual(
      expect.objectContaining({
        id: recoveryId,
        sessionId,
        status: "failing_over",
        accountId: "account-chatgpt-03",
      })
    );
    expect(recoveryBody.operatorAction).toEqual(
      expect.objectContaining({
        targetKind: "recovery_incident",
        targetId: recoveryId,
      })
    );
    expect(recoveryBody.runtimeSnapshot).toEqual(
      expect.objectContaining({
        latestEvent: expect.objectContaining({
          kind: "recovery.started",
          sessionId,
        }),
        session: expect.objectContaining({
          id: sessionId,
          recoveryState: "failing_over",
          retryCount: 1,
        }),
      })
    );

    const auditsDirectoryResponse = await getAuditsDirectory();
    const auditsDirectoryBody = await auditsDirectoryResponse.json();

    expect(auditsDirectoryResponse.status).toBe(200);
    expect(auditsDirectoryBody.summary).toEqual(
      expect.objectContaining({
        total: 2,
        approvals: 1,
        recoveries: 1,
        applied: 2,
      })
    );

    const auditDetailResponse = await getAuditDetail(
      new Request(
        `http://localhost/api/control/execution/audits/${recoveryBody.operatorAction.id}`
      ),
      { params: Promise.resolve({ auditId: recoveryBody.operatorAction.id }) }
    );
    const auditDetailBody = await auditDetailResponse.json();

    expect(auditDetailResponse.status).toBe(200);
    expect(auditDetailBody.auditEvent).toEqual(
      expect.objectContaining({
        id: recoveryBody.operatorAction.id,
        targetKind: "recovery_incident",
        targetId: recoveryId,
      })
    );
    expect(auditDetailBody.target).toEqual(
      expect.objectContaining({
        id: recoveryId,
        targetKind: "recovery_incident",
        status: "failing_over",
        accountId: "account-chatgpt-03",
      })
    );
    expect(auditDetailBody.session).toEqual(
      expect.objectContaining({
        id: sessionId,
        recoveryState: "failing_over",
      })
    );

    const executionEventsResponse = await getExecutionEvents(
      new Request(
        `http://localhost/api/shell/execution/events?orchestrator_session_id=${sessionId}&limit=50`
      )
    );
    const executionEventsBody = await executionEventsResponse.json();

    expect(executionEventsResponse.status).toBe(200);
    expect(executionEventsBody.eventsLoadState).toBe("ready");
    expect(
      executionEventsBody.events.every(
        (event: { orchestrator_session_id: string }) =>
          event.orchestrator_session_id === sessionId
      )
    ).toBe(true);
    expect(
      executionEventsBody.events.some(
        (event: {
          event: string;
          approval_id: string | null;
          orchestrator_session_id: string;
        }) =>
          event.event === "approval.requested" &&
          event.approval_id === approvalId &&
          event.orchestrator_session_id === sessionId
      )
    ).toBe(true);
    expect(
      executionEventsBody.events.some(
        (event: {
          event: string;
          approval_id: string | null;
          status: string;
        }) =>
          event.event === "approval.resolved" &&
          event.approval_id === approvalId &&
          event.status === "completed"
      )
    ).toBe(true);
    expect(
      executionEventsBody.events.some(
        (event: {
          event: string;
          tool_name: string | null;
          status: string;
        }) =>
          event.event === "tool.started" &&
          event.tool_name === "integration-gate" &&
          event.status === "in_progress"
      )
    ).toBe(true);
    expect(
      executionEventsBody.events.some(
        (event: {
          event: string;
          tool_name: string | null;
          status: string;
        }) =>
          event.event === "tool.completed" &&
          event.tool_name === "integration-gate" &&
          event.status === "completed"
      )
    ).toBe(true);
    expect(
      executionEventsBody.events.some(
        (event: {
          event: string;
          source: string;
          status: string;
        }) =>
          event.event === "quota.updated" &&
          event.source === "codex_app_server" &&
          event.status === "info"
      )
    ).toBe(true);
    expect(
      executionEventsBody.events.some(
        (event: {
          event: string;
          status: string;
        }) => event.event === "recovery.started" && event.status === "in_progress"
      )
    ).toBe(true);
  });
});
