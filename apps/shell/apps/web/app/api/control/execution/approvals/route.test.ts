import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../lib/server/control-plane/state/test-helpers";
import {
  readControlPlaneState,
  resetControlPlaneStateForTests,
  updateControlPlaneState,
} from "../../../../../lib/server/control-plane/state/store";
import { TENANT_METADATA_KEY } from "../../../../../lib/server/control-plane/state/tenancy";

import { GET as getApprovalsDirectory, POST as postApprovalRequest } from "./route";
import { POST as postApprovalRespond } from "./[approvalId]/respond/route";

let restoreStateDir: (() => void) | null = null;
const OPERATOR_ACTOR_HEADERS = {
  "x-founderos-actor-type": "operator",
  "x-founderos-actor-id": "operator-approval-test",
  "x-founderos-tenant-id": "tenant-test",
  "x-founderos-request-id": "request-approval-route-test",
  "x-founderos-auth-boundary": "token",
};
const TENANT_ENV_KEYS = [
  "FOUNDEROS_ENABLE_TENANT_ISOLATION",
  "FOUNDEROS_CONTROL_PLANE_TENANT_ID",
] as const;
const ORIGINAL_TENANT_ENV = Object.fromEntries(
  TENANT_ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof TENANT_ENV_KEYS)[number], string | undefined>;

afterEach(() => {
  resetControlPlaneStateForTests();
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
  for (const key of TENANT_ENV_KEYS) {
    const value = ORIGINAL_TENANT_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("/api/control/execution/approvals", () => {
  test("creates a durable pending approval that can be resolved through the response API", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const createResponse = await postApprovalRequest(
      new Request("http://localhost/api/control/execution/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "approval-validation-001",
          sessionId: "session-validation-001",
          projectId: "project-validation",
          projectName: "Validation project",
          requestKind: "command",
          title: "Validation pending approval",
          summary: "Approve the validation command before delivery can continue.",
          reason: "browser_e2e_pending_approval_probe",
        }),
      })
    );
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createBody.approvalRequest).toEqual(
      expect.objectContaining({
        id: "approval-validation-001",
        sessionId: "session-validation-001",
        projectId: "project-validation",
        requestKind: "command",
        status: "pending",
        title: "Validation pending approval",
      })
    );
    expect(createBody.summary.pending).toBeGreaterThanOrEqual(1);

    const directoryResponse = await getApprovalsDirectory();
    const directoryBody = await directoryResponse.json();
    expect(directoryResponse.status).toBe(200);
    expect(directoryBody.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "approval-validation-001",
          status: "pending",
        }),
      ])
    );

    const respondResponse = await postApprovalRespond(
      new Request(
        "http://localhost/api/control/execution/approvals/approval-validation-001/respond",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...OPERATOR_ACTOR_HEADERS,
          },
          body: JSON.stringify({
            decision: "approve_once",
          }),
        }
      ),
      { params: Promise.resolve({ approvalId: "approval-validation-001" }) }
    );
    const respondBody = await respondResponse.json();

    expect(respondResponse.status).toBe(200);
    expect(respondBody.accepted).toBe(true);
    expect(respondBody.approvalRequest).toEqual(
      expect.objectContaining({
        id: "approval-validation-001",
        status: "approved",
        decision: "approve_once",
      })
    );
    expect(respondBody.runtimeSnapshot.session).toEqual(
      expect.objectContaining({
        id: "session-validation-001",
        pendingApprovals: 0,
      })
    );
  });

  test("does not lose records when approval creation POSTs run concurrently", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    const approvalIds = Array.from({ length: 10 }, (_, index) =>
      `approval-concurrent-${index}`,
    );

    const responses = await Promise.all(
      approvalIds.map((approvalId, index) =>
        postApprovalRequest(
          new Request("http://localhost/api/control/execution/approvals", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              id: approvalId,
              sessionId: `session-concurrent-${index}`,
              projectId: "project-concurrent",
              projectName: "Concurrent project",
              requestKind: "command",
              title: `Concurrent approval ${index}`,
              summary: `Concurrent approval ${index} must survive parallel mutation.`,
            }),
          }),
        ),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual(
      Array(approvalIds.length).fill(201),
    );
    const state = await readControlPlaneState();
    expect(
      approvalIds.every((approvalId) =>
        state.approvals.requests.some((request) => request.id === approvalId),
      ),
    ).toBe(true);
  });

  test("filters reads and mutations to the active tenant", async () => {
    process.env.FOUNDEROS_ENABLE_TENANT_ISOLATION = "1";
    process.env.FOUNDEROS_CONTROL_PLANE_TENANT_ID = "tenant-a";
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const tenantAHeaders = {
      "content-type": "application/json",
      "x-founderos-actor-type": "operator",
      "x-founderos-actor-id": "operator-a",
      "x-founderos-tenant-id": "tenant-a",
      "x-founderos-request-id": "request-tenant-a",
      "x-founderos-auth-boundary": "token",
    };

    const createTenantA = await postApprovalRequest(
      new Request("http://localhost/api/control/execution/approvals", {
        method: "POST",
        headers: tenantAHeaders,
        body: JSON.stringify({
          id: "approval-tenant-a",
          sessionId: "session-tenant-a",
          projectId: "project-tenant-a",
          projectName: "Tenant A project",
          requestKind: "command",
          title: "Tenant A approval",
          summary: "Tenant A can see and resolve this approval.",
        }),
      }),
    );
    expect(createTenantA.status).toBe(201);

    await updateControlPlaneState((draft) => {
      draft.approvals.requests.push({
        id: "approval-tenant-b",
        tenantId: "tenant-b",
        createdBy: "operator-b",
        updatedBy: "operator-b",
        sessionId: "session-tenant-b",
        externalSessionId: null,
        projectId: "project-tenant-b",
        projectName: "Tenant B project",
        groupId: null,
        accountId: null,
        workspaceId: null,
        requestKind: "command",
        title: "Tenant B approval",
        summary: "Tenant A must not see or resolve this approval.",
        reason: null,
        status: "pending",
        decision: null,
        requestedAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
        resolvedAt: null,
        resolvedBy: null,
        expiresAt: null,
        revision: 1,
        raw: {
          [TENANT_METADATA_KEY]: {
            tenantId: "tenant-b",
            createdBy: "operator-b",
            updatedBy: "operator-b",
            requestId: "request-tenant-b",
            authBoundary: "token",
          },
        },
      });
    });

    const directoryResponse = await getApprovalsDirectory();
    const directoryBody = await directoryResponse.json();
    expect(directoryResponse.status).toBe(200);
    expect(directoryBody.requests.map((request: { id: string }) => request.id)).toEqual([
      "approval-tenant-a",
    ]);

    const crossTenantRespond = await postApprovalRespond(
      new Request(
        "http://localhost/api/control/execution/approvals/approval-tenant-b/respond",
        {
          method: "POST",
          headers: tenantAHeaders,
          body: JSON.stringify({
            decision: "approve_once",
          }),
        },
      ),
      { params: Promise.resolve({ approvalId: "approval-tenant-b" }) },
    );
    expect(crossTenantRespond.status).toBe(404);
  });

  test("does not treat another tenant's approval id as a duplicate or mutation target", async () => {
    process.env.FOUNDEROS_ENABLE_TENANT_ISOLATION = "1";
    process.env.FOUNDEROS_CONTROL_PLANE_TENANT_ID = "tenant-a";
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const tenantAHeaders = {
      "content-type": "application/json",
      "x-founderos-actor-type": "operator",
      "x-founderos-actor-id": "operator-a",
      "x-founderos-tenant-id": "tenant-a",
      "x-founderos-request-id": "request-tenant-a-shared",
      "x-founderos-auth-boundary": "token",
    };

    await updateControlPlaneState((draft) => {
      draft.approvals.requests.push({
        id: "approval-shared-id",
        tenantId: "tenant-b",
        createdBy: "operator-b",
        updatedBy: "operator-b",
        sessionId: "session-tenant-b-shared",
        externalSessionId: null,
        projectId: "project-tenant-b",
        projectName: "Tenant B project",
        groupId: null,
        accountId: null,
        workspaceId: null,
        requestKind: "command",
        title: "Tenant B shared-id approval",
        summary: "Tenant A may create the same logical id without mutating this record.",
        reason: null,
        status: "pending",
        decision: null,
        requestedAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
        resolvedAt: null,
        resolvedBy: null,
        expiresAt: null,
        revision: 1,
        raw: {
          [TENANT_METADATA_KEY]: {
            tenantId: "tenant-b",
            createdBy: "operator-b",
            updatedBy: "operator-b",
            requestId: "request-tenant-b-shared",
            authBoundary: "token",
          },
        },
      });
    });

    const createTenantA = await postApprovalRequest(
      new Request("http://localhost/api/control/execution/approvals", {
        method: "POST",
        headers: tenantAHeaders,
        body: JSON.stringify({
          id: "approval-shared-id",
          sessionId: "session-tenant-a-shared",
          projectId: "project-tenant-a",
          projectName: "Tenant A project",
          requestKind: "command",
          title: "Tenant A shared-id approval",
          summary: "Tenant A owns this same logical approval id.",
        }),
      }),
    );
    expect(createTenantA.status).toBe(201);

    const respondTenantA = await postApprovalRespond(
      new Request(
        "http://localhost/api/control/execution/approvals/approval-shared-id/respond",
        {
          method: "POST",
          headers: tenantAHeaders,
          body: JSON.stringify({
            decision: "approve_once",
          }),
        },
      ),
      { params: Promise.resolve({ approvalId: "approval-shared-id" }) },
    );
    expect(respondTenantA.status).toBe(200);
    const tenantAResponseBody = await respondTenantA.json();
    expect(tenantAResponseBody.approvalRequest.sessionId).toBe(
      "session-tenant-a-shared",
    );

    process.env.FOUNDEROS_CONTROL_PLANE_TENANT_ID = "tenant-b";
    const tenantBDirectory = await getApprovalsDirectory();
    const tenantBDirectoryBody = await tenantBDirectory.json();
    expect(tenantBDirectoryBody.requests).toEqual([
      expect.objectContaining({
        id: "approval-shared-id",
        sessionId: "session-tenant-b-shared",
        status: "pending",
      }),
    ]);
  });
});
