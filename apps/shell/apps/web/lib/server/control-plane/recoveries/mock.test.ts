import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../state/test-helpers";
import {
  getMockExecutionSessionSummaries,
  getMockNormalizedExecutionEvents,
} from "../sessions/mock";
import {
  buildMockRecoveryIncidentDetailResponse,
  buildMockRecoveryIncidentsDirectory,
  recordMockRecoveryAction,
} from "./mock";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("recovery mock store integration", () => {
  test("failover requires a target account id", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const result = await recordMockRecoveryAction("recovery-001", "failover");

    expect(result?.accepted).toBe(false);
    expect(result?.idempotent).toBe(false);
    expect(result?.rejectedReason).toBe("Failover action requires targetAccountId.");
  });

  test("accepted failover appends a recovery.started session event and stays idempotent on repeat", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const beforeEvents = await getMockNormalizedExecutionEvents();
    const beforeCount = beforeEvents.filter((event) => event.sessionId === "session-2026-04-11-001").length;

    const result = await recordMockRecoveryAction("recovery-001", "failover", {
      targetAccountId: "account-chatgpt-03",
    });
    const afterFirstEvents = await getMockNormalizedExecutionEvents();
    const afterFirstCount = afterFirstEvents.filter(
      (event) => event.sessionId === "session-2026-04-11-001"
    ).length;
    const detail = await buildMockRecoveryIncidentDetailResponse("recovery-001");
    const directory = await buildMockRecoveryIncidentsDirectory();
    const summaries = await getMockExecutionSessionSummaries();
    const summary = summaries.find((entry) => entry.id === "session-2026-04-11-001");
    const recoveryEvent = afterFirstEvents
      .filter((event) => event.sessionId === "session-2026-04-11-001")
      .at(-1);

    const idempotentResult = await recordMockRecoveryAction("recovery-001", "failover", {
      targetAccountId: "account-chatgpt-03",
    });
    const afterSecondEvents = await getMockNormalizedExecutionEvents();
    const afterSecondCount = afterSecondEvents.filter(
      (event) => event.sessionId === "session-2026-04-11-001"
    ).length;

    expect(result?.accepted).toBe(true);
    expect(result?.idempotent).toBe(false);
    expect(result?.recoveryIncident.status).toBe("failing_over");
    expect(result?.recoveryIncident.accountId).toBe("account-chatgpt-03");
    expect(result?.operatorAction.kind).toBe("recovery.failover_requested");
    expect(afterFirstCount).toBe(beforeCount + 1);
    expect(recoveryEvent?.kind).toBe("recovery.started");
    expect(recoveryEvent?.payload.recoveryId).toBe("recovery-001");
    expect(recoveryEvent?.payload.recoveryActionKind).toBe("failover");
    expect(recoveryEvent?.payload.previousRecoveryStatus).toBe("retryable");
    expect(recoveryEvent?.payload.recoveryStatus).toBe("failing_over");
    expect(recoveryEvent?.payload.accountId).toBe("account-chatgpt-03");
    expect(recoveryEvent?.payload.targetAccountId).toBe("account-chatgpt-03");
    expect(summary?.recoveryState).toBe("failing_over");
    expect(summary?.retryCount).toBe(1);
    expect(idempotentResult?.accepted).toBe(true);
    expect(idempotentResult?.idempotent).toBe(true);
    expect(afterSecondCount).toBe(afterFirstCount);
    expect(detail?.recoveryIncident.accountId).toBe("account-chatgpt-03");
    expect(detail?.operatorActions).toHaveLength(1);
    expect(directory.storageKind).toBe("file_backed");
    expect(
      directory.notes.some((note) =>
        note.includes("unified shell-owned control-plane state file")
      )
    ).toBe(true);
  });

  test("accepted resolve appends a recovery.completed session event and updates the projection", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const beforeEvents = await getMockNormalizedExecutionEvents();
    const beforeCount = beforeEvents.filter((event) => event.sessionId === "session-2026-04-11-002").length;

    const result = await recordMockRecoveryAction("recovery-002", "resolve");
    const afterEvents = await getMockNormalizedExecutionEvents();
    const afterCount = afterEvents.filter((event) => event.sessionId === "session-2026-04-11-002").length;
    const summary = (await getMockExecutionSessionSummaries()).find(
      (entry) => entry.id === "session-2026-04-11-002"
    );
    const recoveryEvent = afterEvents
      .filter((event) => event.sessionId === "session-2026-04-11-002")
      .at(-1);

    expect(result?.accepted).toBe(true);
    expect(result?.recoveryIncident.status).toBe("recovered");
    expect(result?.operatorAction.kind).toBe("recovery.resolved");
    expect(afterCount).toBe(beforeCount + 1);
    expect(recoveryEvent?.kind).toBe("recovery.completed");
    expect(recoveryEvent?.payload.recoveryActionKind).toBe("resolve");
    expect(recoveryEvent?.payload.previousRecoveryStatus).toBe("failing_over");
    expect(recoveryEvent?.payload.recoveryStatus).toBe("recovered");
    expect(summary?.status).toBe("recovered");
    expect(summary?.recoveryState).toBe("recovered");
  });

  test("rejected failover does not append a session event", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const beforeEvents = await getMockNormalizedExecutionEvents();
    const beforeCount = beforeEvents.filter((event) => event.sessionId === "session-2026-04-11-001").length;

    const result = await recordMockRecoveryAction("recovery-001", "failover");
    const afterEvents = await getMockNormalizedExecutionEvents();
    const afterCount = afterEvents.filter((event) => event.sessionId === "session-2026-04-11-001").length;
    const summary = (await getMockExecutionSessionSummaries()).find(
      (entry) => entry.id === "session-2026-04-11-001"
    );

    expect(result?.accepted).toBe(false);
    expect(result?.rejectedReason).toBe("Failover action requires targetAccountId.");
    expect(afterCount).toBe(beforeCount);
    expect(summary?.recoveryState).toBe("none");
  });
});
