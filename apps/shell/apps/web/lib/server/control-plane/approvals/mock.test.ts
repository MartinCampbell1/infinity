import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../state/test-helpers";
import { materializeSessionProjections } from "../events/store";
import { readControlPlaneState } from "../state/store";
import {
  buildMockApprovalRequestDetailResponse,
  buildMockApprovalRequestsDirectory,
  respondToMockApprovalRequest,
} from "./mock";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("approval mock store integration", () => {
  test("responding to an approval mutates the unified shell state", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const result = await respondToMockApprovalRequest("approval-001", "approve_once");
    const detail = await buildMockApprovalRequestDetailResponse("approval-001");
    const directory = await buildMockApprovalRequestsDirectory();
    const state = await readControlPlaneState();
    const sessionEvents = state.sessions.events.filter(
      (event) => event.sessionId === "session-2026-04-11-001"
    );
    const approvalResolvedEvents = sessionEvents.filter(
      (event) => event.kind === "approval.resolved"
    );
    const projection = materializeSessionProjections(state.sessions.events)[
      "session-2026-04-11-001"
    ];

    expect(result?.accepted).toBe(true);
    expect(result?.idempotent).toBe(false);
    expect(result?.approvalRequest.status).toBe("approved");
    expect(result?.approvalRequest.decision).toBe("approve_once");
    expect(result?.operatorAction.kind).toBe("approval.responded");
    expect(detail?.approvalRequest.status).toBe("approved");
    expect(detail?.operatorActions).toHaveLength(1);
    expect(directory.storageKind).toBe("file_backed");
    expect(directory.summary.pending).toBe(1);
    expect(
      directory.notes.some((note) =>
        note.includes("unified shell-owned control-plane state file")
      )
    ).toBe(true);
    expect(approvalResolvedEvents).toHaveLength(1);
    expect(approvalResolvedEvents[0]?.provider).toBe("hermes");
    expect(approvalResolvedEvents[0]?.kind).toBe("approval.resolved");
    expect(approvalResolvedEvents[0]?.status).toBe("completed");
    expect(approvalResolvedEvents[0]?.payload).toMatchObject({
      approvalId: "approval-001",
      decision: "approve_once",
      approvalStatus: "approved",
      requestStatus: "approved",
      sessionId: "session-2026-04-11-001",
      projectId: "project-atlas",
      resolvedBy: "infinity-operator",
    });
    expect(projection?.pendingApprovals).toBe(0);
  });

  test("repeating the same decision is idempotent after resolution", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    await respondToMockApprovalRequest("approval-001", "approve_once");
    const repeated = await respondToMockApprovalRequest("approval-001", "approve_once");
    const conflicting = await respondToMockApprovalRequest("approval-001", "deny");
    const state = await readControlPlaneState();
    const approvalResolvedEvents = state.sessions.events.filter(
      (event) =>
        event.sessionId === "session-2026-04-11-001" && event.kind === "approval.resolved"
    );
    const projection = materializeSessionProjections(state.sessions.events)[
      "session-2026-04-11-001"
    ];

    expect(repeated?.accepted).toBe(true);
    expect(repeated?.idempotent).toBe(true);
    expect(repeated?.rejectedReason).toBeNull();
    expect(conflicting?.accepted).toBe(false);
    expect(conflicting?.idempotent).toBe(false);
    expect(conflicting?.rejectedReason).toMatch(
      /already resolved and cannot change decision/
    );
    expect(approvalResolvedEvents).toHaveLength(1);
    expect(projection?.pendingApprovals).toBe(0);
  });

  test("deny appends a declined approval event and leaves the session blocked", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const beforeCount = (await readControlPlaneState()).sessions.events.filter(
      (event) => event.sessionId === "session-2026-04-11-002"
    ).length;

    const result = await respondToMockApprovalRequest("approval-002", "deny");
    const state = await readControlPlaneState();
    const sessionEvents = state.sessions.events.filter(
      (event) => event.sessionId === "session-2026-04-11-002"
    );
    const projection = materializeSessionProjections(state.sessions.events)[
      "session-2026-04-11-002"
    ];
    const approvalResolvedEvent = sessionEvents.at(-1);

    expect(result?.accepted).toBe(true);
    expect(result?.idempotent).toBe(false);
    expect(result?.approvalRequest.status).toBe("denied");
    expect(sessionEvents).toHaveLength(beforeCount + 1);
    expect(approvalResolvedEvent?.kind).toBe("approval.resolved");
    expect(approvalResolvedEvent?.status).toBe("declined");
    expect(approvalResolvedEvent?.payload).toMatchObject({
      approvalId: "approval-002",
      decision: "deny",
      approvalStatus: "denied",
      requestStatus: "denied",
    });
    expect(projection?.pendingApprovals).toBe(0);
    expect(projection?.status).toBe("blocked");
    expect(projection?.phase).toBe("blocked");
  });
});
