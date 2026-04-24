import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../../../lib/server/control-plane/state/test-helpers";
import {
  readControlPlaneState,
  resetControlPlaneStateForTests,
} from "../../../../../../../lib/server/control-plane/state/store";

import { POST as postApprovalRespond } from "./route";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  resetControlPlaneStateForTests();
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("/api/control/execution/approvals/[approvalId]/respond", () => {
  test("returns a runtimeSnapshot with the approved session state", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const response = await postApprovalRespond(
      new Request("http://localhost/api/control/execution/approvals/approval-001/respond", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-founderos-actor-type": "operator",
          "x-founderos-actor-id": "operator-test",
          "x-founderos-tenant-id": "tenant-test",
          "x-founderos-request-id": "request-approval-test",
          "x-founderos-auth-boundary": "token",
        },
        body: JSON.stringify({
          decision: "approve_once",
        }),
      }),
      { params: Promise.resolve({ approvalId: "approval-001" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.approvalRequest.resolvedBy).toBe("operator-test");
    expect(body.operatorAction).toEqual(
      expect.objectContaining({
        actorType: "operator",
        actorId: "operator-test",
        payload: expect.objectContaining({
          actorContext: {
            actorType: "operator",
            actorId: "operator-test",
            tenantId: "tenant-test",
            requestId: "request-approval-test",
            authBoundary: "token",
          },
        }),
      }),
    );
    expect(body.runtimeSnapshot).toEqual(
      expect.objectContaining({
        latestEvent: expect.objectContaining({
          sessionId: "session-2026-04-11-001",
          kind: "approval.resolved",
        }),
        session: expect.objectContaining({
          id: "session-2026-04-11-001",
          projectId: "project-atlas",
          status: "acting",
          phase: "acting",
          pendingApprovals: 0,
        }),
      })
    );
  });

  test("replays the same approval response for a repeated Idempotency-Key", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const headers = {
      "content-type": "application/json",
      "idempotency-key": "approval-respond-key-001",
      "x-founderos-actor-type": "operator",
      "x-founderos-actor-id": "operator-test",
      "x-founderos-tenant-id": "tenant-test",
      "x-founderos-request-id": "request-approval-idempotency",
      "x-founderos-auth-boundary": "token",
    };

    const firstResponse = await postApprovalRespond(
      new Request("http://localhost/api/control/execution/approvals/approval-001/respond", {
        method: "POST",
        headers,
        body: JSON.stringify({
          decision: "approve_once",
        }),
      }),
      { params: Promise.resolve({ approvalId: "approval-001" }) },
    );
    const firstBody = await firstResponse.json();
    const secondResponse = await postApprovalRespond(
      new Request("http://localhost/api/control/execution/approvals/approval-001/respond", {
        method: "POST",
        headers,
        body: JSON.stringify({
          decision: "approve_once",
        }),
      }),
      { params: Promise.resolve({ approvalId: "approval-001" }) },
    );
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondBody).toEqual(firstBody);

    const state = await readControlPlaneState();
    expect(
      state.approvals.operatorActions.filter(
        (action) => action.targetId === "approval-001",
      ),
    ).toHaveLength(1);
    expect(state.mutations.idempotency).toEqual([
      expect.objectContaining({
        idempotencyKey: "approval-respond-key-001",
        statusCode: 200,
      }),
    ]);
    expect(state.mutations.events).toEqual([
      expect.objectContaining({
        mutationKind: "approval.respond",
        resourceKind: "approval",
        resourceId: "approval-001",
        idempotencyKey: "approval-respond-key-001",
      }),
    ]);
  });

  test("rejects an Idempotency-Key reused with a different approval payload", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const headers = {
      "content-type": "application/json",
      "idempotency-key": "approval-respond-key-conflict",
      "x-founderos-actor-type": "operator",
      "x-founderos-actor-id": "operator-test",
      "x-founderos-tenant-id": "tenant-test",
      "x-founderos-request-id": "request-approval-conflict",
      "x-founderos-auth-boundary": "token",
    };

    await postApprovalRespond(
      new Request("http://localhost/api/control/execution/approvals/approval-001/respond", {
        method: "POST",
        headers,
        body: JSON.stringify({
          decision: "approve_once",
        }),
      }),
      { params: Promise.resolve({ approvalId: "approval-001" }) },
    );
    const conflictResponse = await postApprovalRespond(
      new Request("http://localhost/api/control/execution/approvals/approval-001/respond", {
        method: "POST",
        headers,
        body: JSON.stringify({
          decision: "deny",
        }),
      }),
      { params: Promise.resolve({ approvalId: "approval-001" }) },
    );
    const conflictBody = await conflictResponse.json();

    expect(conflictResponse.status).toBe(409);
    expect(conflictBody).toEqual(
      expect.objectContaining({
        code: "idempotency_key_conflict",
        accepted: false,
      }),
    );
  });
});
