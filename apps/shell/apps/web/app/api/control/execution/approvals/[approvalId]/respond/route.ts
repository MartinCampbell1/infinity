import { NextResponse } from "next/server";

import {
  isApprovalRespondRequest,
  respondToApprovalRequest,
} from "../../../../../../../lib/server/control-plane/approvals";
import type { ApprovalRespondResponse } from "../../../../../../../lib/server/control-plane/contracts/approvals";
import {
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
  readControlPlaneState,
} from "../../../../../../../lib/server/control-plane/state/store";
import {
  controlPlaneIdempotencyKeyFromRequest,
  hashControlPlaneMutationRequest,
  isControlPlaneIdempotencyConflictError,
  readControlPlaneIdempotentMutationResult,
  recordControlPlaneMutationResult,
} from "../../../../../../../lib/server/control-plane/state/mutations";
import { buildWorkspaceRuntimeSnapshot } from "../../../../../../../lib/server/control-plane/workspace/runtime-ingest";
import type { SessionWorkspaceHostContext } from "../../../../../../../lib/server/control-plane/contracts/workspace-launch";
import { controlPlaneMutationActorFromRequest } from "../../../../../../../lib/server/http/control-plane-auth";
import { controlPlaneStorageUnavailableResponse } from "../../../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const { approvalId } = await params;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  if (!isApprovalRespondRequest(body)) {
    return NextResponse.json(
      {
        detail:
          "Request body must include decision with one of approve_once, approve_session, approve_always, or deny.",
      },
      { status: 400 }
    );
  }

  const actor = controlPlaneMutationActorFromRequest(request);
  if (!actor) {
    return NextResponse.json(
      {
        code: "missing_actor",
        detail: "Approval response requires an authenticated actor.",
      },
      { status: 401 },
    );
  }

  const idempotencyKey = controlPlaneIdempotencyKeyFromRequest(request);
  const requestHash = idempotencyKey
    ? hashControlPlaneMutationRequest({
        route: "approval.respond",
        approvalId,
        body,
      })
    : null;
  if (idempotencyKey && requestHash) {
    try {
      const replay =
        await readControlPlaneIdempotentMutationResult<ApprovalRespondResponse>({
          tenantId: actor.tenantId,
          idempotencyKey,
          requestHash,
        });
      if (replay) {
        return NextResponse.json(replay.responseJson, {
          status: replay.statusCode,
        });
      }
    } catch (error) {
      const storageResponse = controlPlaneStorageUnavailableResponse(error, {
        accepted: false,
      });
      if (storageResponse) {
        return storageResponse;
      }
      if (isControlPlaneIdempotencyConflictError(error)) {
        return NextResponse.json(
          {
            code: error.code,
            detail: error.message,
            accepted: false,
          },
          { status: error.status },
        );
      }
      throw error;
    }
  }

  let result;
  try {
    result = await respondToApprovalRequest(approvalId, body.decision, actor);
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
        detail: `Approval request ${approvalId} is not present in the shell control-plane directory.`,
      },
      { status: 404 }
    );
  }

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
  const runtimeSnapshot = buildWorkspaceRuntimeSnapshot(
    state,
    {
      projectId: result.approvalRequest.projectId,
      projectName: result.approvalRequest.projectName,
      sessionId: result.approvalRequest.sessionId,
      externalSessionId: result.approvalRequest.externalSessionId ?? null,
      groupId: result.approvalRequest.groupId ?? null,
      accountId: result.approvalRequest.accountId ?? null,
      workspaceId: result.approvalRequest.workspaceId ?? null,
      openedFrom: "review",
    } satisfies SessionWorkspaceHostContext
  );

  const response: ApprovalRespondResponse = {
    generatedAt: "2026-04-11T12:00:00.000Z",
    source: getControlPlaneStorageSource(),
    storageKind: getControlPlaneStorageKind(),
    integrationState: result.integrationState,
    canonicalTruth: "sessionId",
    approvalRequest: result.approvalRequest,
    operatorAction: result.operatorAction,
    idempotent: result.idempotent,
    accepted: result.accepted,
    rejectedReason: result.rejectedReason ?? null,
    runtimeSnapshot,
    notes: [
      getControlPlaneStorageKind() === "postgres"
        ? "Approval response endpoint is writing through the shell-owned Postgres durability boundary."
        : "Approval response endpoint is writing through the unified local shell-owned state file.",
      "sessionId remains the canonical truth key; external bindings stay attached to the request payload.",
    ],
  };

  if (idempotencyKey && requestHash) {
    try {
      await recordControlPlaneMutationResult({
        tenantId: actor.tenantId,
        idempotencyKey,
        requestHash,
        mutationKind: "approval.respond",
        resourceKind: "approval",
        resourceId: approvalId,
        actorId: actor.actorId,
        statusCode,
        payload: {
          approvalId,
          decision: body.decision,
        },
        responseJson: response as unknown as Record<string, unknown>,
      });
    } catch (error) {
      const storageResponse = controlPlaneStorageUnavailableResponse(error, {
        accepted: false,
      });
      if (storageResponse) {
        return storageResponse;
      }
      if (isControlPlaneIdempotencyConflictError(error)) {
        return NextResponse.json(
          {
            code: error.code,
            detail: error.message,
            accepted: false,
          },
          { status: error.status },
        );
      }
      throw error;
    }
  }

  return NextResponse.json(response, { status: statusCode });
}
