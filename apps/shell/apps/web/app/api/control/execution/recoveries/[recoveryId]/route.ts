import { NextResponse } from "next/server";

import {
  buildRecoveryIncidentDetailResponse,
  isRecoveryRecordActionRequest,
  recordRecoveryAction,
} from "../../../../../../lib/server/control-plane/recoveries";
import type { RecoveryRecordActionResponse } from "../../../../../../lib/server/control-plane/contracts/recoveries";
import {
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
  readControlPlaneState,
} from "../../../../../../lib/server/control-plane/state/store";
import { buildWorkspaceRuntimeSnapshot } from "../../../../../../lib/server/control-plane/workspace/runtime-ingest";
import type { SessionWorkspaceHostContext } from "../../../../../../lib/server/control-plane/contracts/workspace-launch";
import { controlPlaneMutationActorFromRequest } from "../../../../../../lib/server/http/control-plane-auth";
import { controlPlaneStorageUnavailableResponse } from "../../../../../../lib/server/http/control-plane-storage-response";
import { retryOrchestrationRecovery } from "../../../../../../lib/server/orchestration/retry";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recoveryId: string }> }
) {
  const { recoveryId } = await params;
  let response;
  try {
    response = await buildRecoveryIncidentDetailResponse(recoveryId);
  } catch (error) {
    const storageResponse = controlPlaneStorageUnavailableResponse(error);
    if (storageResponse) {
      return storageResponse;
    }
    throw error;
  }

  if (!response) {
    return NextResponse.json(
      {
        detail: `Recovery incident ${recoveryId} is not present in the shell control-plane directory.`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json(response);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recoveryId: string }> }
) {
  const { recoveryId } = await params;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  if (!isRecoveryRecordActionRequest(body) || body.actionKind === "unknown") {
    return NextResponse.json(
      {
        detail:
          "Request body must include actionKind with one of retry, failover, resolve, or reopen.",
      },
      { status: 400 }
    );
  }

  const targetAccountId = body.targetAccountId;

  if (targetAccountId !== undefined && typeof targetAccountId !== "string") {
    return NextResponse.json(
      {
        detail: "targetAccountId must be a string when provided.",
      },
      { status: 400 }
    );
  }

  const actor = controlPlaneMutationActorFromRequest(request);
  if (!actor) {
    return NextResponse.json(
      {
        code: "missing_actor",
        detail: "Recovery action requires an authenticated actor.",
      },
      { status: 401 },
    );
  }

  let result;
  try {
    result = await recordRecoveryAction(
      recoveryId,
      body.actionKind,
      {
        targetAccountId:
          typeof targetAccountId === "string" && targetAccountId.trim().length > 0
            ? targetAccountId.trim()
            : null,
      },
      actor,
    );
  } catch (error) {
    const storageResponse = controlPlaneStorageUnavailableResponse(error, {
      accepted: false,
    });
    if (storageResponse) {
      return storageResponse;
    }
    throw error;
  }

  if (!result) {
    return NextResponse.json(
      {
        detail: `Recovery incident ${recoveryId} is not present in the shell control-plane directory.`,
      },
      { status: 404 }
    );
  }

  const orchestrationRetry =
    result.accepted && !result.idempotent && body.actionKind === "retry"
      ? await retryOrchestrationRecovery(result.recoveryIncident)
      : null;
  const statusCode = result.accepted ? 200 : 409;
  let state;
  try {
    state = await readControlPlaneState();
  } catch (error) {
    const storageResponse = controlPlaneStorageUnavailableResponse(error, {
      accepted: false,
    });
    if (storageResponse) {
      return storageResponse;
    }
    throw error;
  }
  const responseRecoveryIncident =
    state.recoveries.incidents.find(
      (incident) => incident.id === result.recoveryIncident.id
    ) ?? result.recoveryIncident;
  const runtimeSnapshot = buildWorkspaceRuntimeSnapshot(
    state,
    {
      projectId: responseRecoveryIncident.projectId,
      projectName: responseRecoveryIncident.projectName,
      sessionId: responseRecoveryIncident.sessionId,
      externalSessionId: responseRecoveryIncident.externalSessionId ?? null,
      groupId: responseRecoveryIncident.groupId ?? null,
      accountId: responseRecoveryIncident.accountId ?? null,
      workspaceId: responseRecoveryIncident.workspaceId ?? null,
      openedFrom: "execution_board",
    } satisfies SessionWorkspaceHostContext
  );

  const response: RecoveryRecordActionResponse = {
    generatedAt: "2026-04-11T12:05:00.000Z",
    source: getControlPlaneStorageSource(),
    storageKind: getControlPlaneStorageKind(),
    integrationState: result.integrationState,
    canonicalTruth: "sessionId",
    recoveryIncident: responseRecoveryIncident,
    operatorAction: result.operatorAction,
    idempotent: result.idempotent,
    accepted: result.accepted,
    rejectedReason: result.rejectedReason ?? null,
    orchestrationRetry,
    runtimeSnapshot,
    notes: [
      getControlPlaneStorageKind() === "postgres"
        ? "Recovery action endpoint is writing through the shell-owned Postgres durability boundary."
        : "Recovery action endpoint is writing through the unified local shell-owned state file.",
      "sessionId remains the canonical truth key; external bindings stay attached to the incident payload.",
    ],
  };

  return NextResponse.json(response, { status: statusCode });
}
