import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../../lib/server/control-plane/state/test-helpers";
import { readControlPlaneState } from "../../../../../../lib/server/control-plane/state/store";

import { POST as postInitiatives } from "../../../orchestration/initiatives/route";
import { POST as postBriefs } from "../../../orchestration/briefs/route";
import { POST as postTaskGraphs } from "../../../orchestration/task-graphs/route";
import { GET as getWorkUnits } from "../../../orchestration/work-units/route";
import { PATCH as patchWorkUnit } from "../../../orchestration/work-units/[workUnitId]/route";
import { POST as postAssembly } from "../../../orchestration/assembly/route";
import { POST as postVerification } from "../../../orchestration/verification/route";
import { POST as postRecoveryAction } from "./route";

let restoreStateDir: (() => void) | null = null;

const ORIGINAL_VALIDATION_COMMANDS =
  process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
const ORIGINAL_VALIDATION_COMMANDS_ALLOWED =
  process.env.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
const OPERATOR_ACTOR_HEADERS = {
  "x-founderos-actor-type": "operator",
  "x-founderos-actor-id": "operator-test",
  "x-founderos-tenant-id": "tenant-test",
  "x-founderos-request-id": "request-recovery-test",
  "x-founderos-auth-boundary": "token",
};

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
  if (ORIGINAL_VALIDATION_COMMANDS === undefined) {
    delete process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
  } else {
    process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON =
      ORIGINAL_VALIDATION_COMMANDS;
  }
  if (ORIGINAL_VALIDATION_COMMANDS_ALLOWED === undefined) {
    delete process.env.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
  } else {
    process.env.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON =
      ORIGINAL_VALIDATION_COMMANDS_ALLOWED;
  }
});

function setValidationCommands(exitCode: number) {
  process.env.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON = "1";
  process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON = JSON.stringify(
    [
      {
        name: "static-smoke",
        bucket: "static",
        cwd: "/Users/martin/infinity",
        command: ["node", "-e", "process.exit(0)"],
      },
      {
        name: "test-smoke",
        bucket: "test",
        cwd: "/Users/martin/infinity",
        command: [
          "node",
          "-e",
          exitCode === 0
            ? "process.exit(0)"
            : "process.stderr.write('retry target failed'); process.exit(7)",
        ],
      },
    ],
  );
}

async function createAssembledOrchestrationRun() {
  const initiativeResponse = await postInitiatives(
    new Request("http://localhost/api/control/orchestration/initiatives", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Retryable tip calculator",
        userRequest: "Build a tiny tip calculator web app.",
        requestedBy: "martin",
      }),
    }),
  );
  const initiativeBody = await initiativeResponse.json();
  const initiativeId = initiativeBody.initiative.id as string;

  const briefResponse = await postBriefs(
    new Request("http://localhost/api/control/orchestration/briefs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        initiativeId,
        summary: "Build a tiny tip calculator web app.",
        goals: ["Generate a retryable runnable result"],
        nonGoals: ["Manual recreation of the initiative"],
        constraints: ["Stay inside /Users/martin/infinity"],
        assumptions: ["Retry can reuse the completed assembly"],
        acceptanceCriteria: ["Retry creates a fresh verification"],
        repoScope: ["/Users/martin/infinity/apps/shell"],
        deliverables: ["Runnable result"],
        clarificationLog: [],
        authoredBy: "retry-test",
        status: "approved",
      }),
    }),
  );
  const briefBody = await briefResponse.json();

  const taskGraphResponse = await postTaskGraphs(
    new Request("http://localhost/api/control/orchestration/task-graphs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ briefId: briefBody.brief.id }),
    }),
  );
  const taskGraphBody = await taskGraphResponse.json();
  const taskGraphId = taskGraphBody.taskGraph.id as string;

  const workUnitsResponse = await getWorkUnits(
    new Request(
      `http://localhost/api/control/orchestration/work-units?task_graph_id=${taskGraphId}`,
    ),
  );
  const workUnitsBody = await workUnitsResponse.json();
  for (const [index, workUnit] of workUnitsBody.workUnits.entries()) {
    await patchWorkUnit(
      new Request(
        `http://localhost/api/control/orchestration/work-units/${workUnit.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            latestAttemptId: `attempt-retry-${index + 1}`,
          }),
        },
      ),
      { params: Promise.resolve({ workUnitId: workUnit.id }) },
    );
  }

  const assemblyResponse = await postAssembly(
    new Request("http://localhost/api/control/orchestration/assembly", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initiativeId }),
    }),
  );
  expect(assemblyResponse.status).toBe(201);

  return { initiativeId };
}

describe("/api/control/execution/recoveries/[recoveryId]", () => {
  test("returns a runtimeSnapshot with the updated recovery session state", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const response = await postRecoveryAction(
      new Request("http://localhost/api/control/execution/recoveries/recovery-001", {
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
      { params: Promise.resolve({ recoveryId: "recovery-001" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.operatorAction).toEqual(
      expect.objectContaining({
        actorType: "operator",
        actorId: "operator-test",
        payload: expect.objectContaining({
          actorContext: {
            actorType: "operator",
            actorId: "operator-test",
            tenantId: "tenant-test",
            requestId: "request-recovery-test",
            authBoundary: "token",
          },
        }),
      }),
    );
    expect(body.runtimeSnapshot).toEqual(
      expect.objectContaining({
        latestEvent: expect.objectContaining({
          sessionId: "session-2026-04-11-001",
          kind: "recovery.started",
        }),
        session: expect.objectContaining({
          id: "session-2026-04-11-001",
          projectId: "project-atlas",
          recoveryState: "failing_over",
          retryCount: 1,
        }),
      })
    );
  });

  test("retry action reruns orchestration verification and creates ready delivery when the gate is fixed", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    setValidationCommands(7);

    const { initiativeId } = await createAssembledOrchestrationRun();
    const failedVerificationResponse = await postVerification(
      new Request("http://localhost/api/control/orchestration/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const failedVerificationBody = await failedVerificationResponse.json();
    expect(failedVerificationBody.verification.overallStatus).toBe("failed");

    const stateAfterFailure = await readControlPlaneState();
    const recoveryIncident = stateAfterFailure.recoveries.incidents.find(
      (incident) =>
        incident.raw?.source === "orchestration.verification" &&
        incident.raw?.verificationId === failedVerificationBody.verification.id,
    );
    expect(recoveryIncident?.status).toBe("retryable");

    setValidationCommands(0);
    const retryResponse = await postRecoveryAction(
      new Request(
        `http://localhost/api/control/execution/recoveries/${recoveryIncident?.id}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...OPERATOR_ACTOR_HEADERS,
          },
          body: JSON.stringify({ actionKind: "retry" }),
        },
      ),
      { params: Promise.resolve({ recoveryId: recoveryIncident?.id ?? "" }) },
    );
    const retryBody = await retryResponse.json();

    expect(retryResponse.status).toBe(200);
    expect(retryBody.accepted).toBe(true);
    expect(retryBody.operatorAction.kind).toBe("recovery.retry_requested");
    expect(retryBody.recoveryIncident.retryCount).toBe(1);
    expect(retryBody.recoveryIncident.status).toBe("recovered");
    expect(retryBody.recoveryIncident.resolvedAt).toBeTruthy();
    expect(retryBody.orchestrationRetry).toEqual(
      expect.objectContaining({
        initiativeId,
        verificationStatus: "passed",
        deliveryStatus: "ready",
        launchProofKind: "runnable_result",
      }),
    );
    expect(retryBody.orchestrationRetry.verificationId).not.toBe(
      failedVerificationBody.verification.id,
    );
    expect(retryBody.runtimeSnapshot.latestEvent.kind).toBe("recovery.completed");
    expect(retryBody.runtimeSnapshot.session.recoveryState).toBe("recovered");

    const finalState = await readControlPlaneState();
    expect(
      finalState.recoveries.incidents.find(
        (incident) => incident.id === recoveryIncident?.id,
      )?.status,
    ).toBe("recovered");
    expect(
      finalState.orchestration.verifications.some(
        (verification) => verification.id === failedVerificationBody.verification.id,
      ),
    ).toBe(true);
    expect(
      finalState.orchestration.verifications.some(
        (verification) =>
          verification.id === retryBody.orchestrationRetry.verificationId &&
          verification.overallStatus === "passed",
      ),
    ).toBe(true);
    expect(
      finalState.orchestration.deliveries.some(
        (delivery) =>
          delivery.id === retryBody.orchestrationRetry.deliveryId &&
          delivery.status === "ready",
      ),
    ).toBe(true);
    expect(
      finalState.recoveries.operatorActions.some(
        (action) =>
          action.targetId === recoveryIncident?.id &&
          action.kind === "recovery.retry_requested" &&
          action.outcome === "applied",
      ),
    ).toBe(true);
  });

  test("retry action preserves failed evidence and opens a new incident when verification still fails", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    setValidationCommands(7);

    const { initiativeId } = await createAssembledOrchestrationRun();
    const failedVerificationResponse = await postVerification(
      new Request("http://localhost/api/control/orchestration/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const failedVerificationBody = await failedVerificationResponse.json();
    const stateAfterFailure = await readControlPlaneState();
    const recoveryIncident = stateAfterFailure.recoveries.incidents.find(
      (incident) =>
        incident.raw?.source === "orchestration.verification" &&
        incident.raw?.verificationId === failedVerificationBody.verification.id,
    );
    expect(recoveryIncident?.status).toBe("retryable");

    const retryResponse = await postRecoveryAction(
      new Request(
        `http://localhost/api/control/execution/recoveries/${recoveryIncident?.id}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...OPERATOR_ACTOR_HEADERS,
          },
          body: JSON.stringify({ actionKind: "retry" }),
        },
      ),
      { params: Promise.resolve({ recoveryId: recoveryIncident?.id ?? "" }) },
    );
    const retryBody = await retryResponse.json();

    expect(retryResponse.status).toBe(200);
    expect(retryBody.accepted).toBe(true);
    expect(retryBody.recoveryIncident.status).toBe("open");
    expect(retryBody.orchestrationRetry).toEqual(
      expect.objectContaining({
        initiativeId,
        verificationStatus: "failed",
        deliveryId: null,
        deliveryStatus: null,
      }),
    );
    expect(retryBody.orchestrationRetry.verificationId).not.toBe(
      failedVerificationBody.verification.id,
    );
    expect(retryBody.orchestrationRetry.newRecoveryIncidentId).toBeTruthy();
    expect(retryBody.orchestrationRetry.newRecoveryIncidentId).not.toBe(
      recoveryIncident?.id,
    );

    const finalState = await readControlPlaneState();
    expect(
      finalState.orchestration.verifications.some(
        (verification) => verification.id === failedVerificationBody.verification.id,
      ),
    ).toBe(true);
    expect(
      finalState.recoveries.incidents.find(
        (incident) =>
          incident.id === retryBody.orchestrationRetry.newRecoveryIncidentId,
      ),
    ).toEqual(
      expect.objectContaining({
        status: "retryable",
        recoveryActionKind: "retry",
      }),
    );
  });
});
