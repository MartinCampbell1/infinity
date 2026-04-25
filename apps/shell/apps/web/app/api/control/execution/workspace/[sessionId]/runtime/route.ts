import { NextResponse } from "next/server";

import {
  getControlPlaneIntegrationState,
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
} from "../../../../../../../lib/server/control-plane/state/store";
import {
  isWorkspaceRuntimeBridgeIngestRequest,
  persistWorkspaceRuntimeBridgeMessage,
} from "../../../../../../../lib/server/control-plane/workspace/runtime-ingest";
import type { WorkspaceRuntimeIngestResponse } from "../../../../../../../lib/server/control-plane/contracts/workspace-launch";
import { controlPlaneMutationActorFromRequest } from "../../../../../../../lib/server/http/control-plane-auth";
import { apiErrorResponse } from "../../../../../../../lib/server/http/api-error-response";
import { controlPlaneStorageUnavailableResponse } from "../../../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  if (!isWorkspaceRuntimeBridgeIngestRequest(body)) {
    return apiErrorResponse({
      code: "invalid_workspace_runtime_body",
      message:
        "Request body must include hostContext and one supported workspace or host bridge message, or a workspace runtime producer batch.",
      status: 400,
    });
  }

  if (body.hostContext.sessionId !== sessionId) {
    return apiErrorResponse({
      code: "session_id_mismatch",
      message:
        "Route sessionId must match body.hostContext.sessionId for runtime ingest.",
      status: 400,
      details: { routeSessionId: sessionId, bodySessionId: body.hostContext.sessionId },
    });
  }

  try {
    const actor = controlPlaneMutationActorFromRequest(request);
    if (!actor) {
      return apiErrorResponse({
        code: "missing_actor",
        message: "Workspace runtime ingest requires an authenticated actor.",
        status: 401,
      });
    }

    const result = await persistWorkspaceRuntimeBridgeMessage(
      body,
      actor,
    );
    const response: WorkspaceRuntimeIngestResponse = {
      source: getControlPlaneStorageSource(),
      storageKind: getControlPlaneStorageKind(),
      integrationState: getControlPlaneIntegrationState(),
      canonicalTruth: "sessionId",
      accepted: true,
      persistedEvents: result.persistedEvents,
      touchedApprovals: result.touchedApprovals,
      touchedRecoveries: result.touchedRecoveries,
      runtimeSnapshot: result.runtimeSnapshot,
    };

    return NextResponse.json(response);
  } catch (error) {
    const storageResponse = controlPlaneStorageUnavailableResponse(error, {
      accepted: false,
    });
    if (storageResponse) {
      return storageResponse;
    }

    if (error instanceof Error && error.message.startsWith("Unsupported workspace runtime bridge message")) {
      return apiErrorResponse({
        code: "unsupported_workspace_runtime_message",
        message: error.message,
        status: 400,
      });
    }

    return apiErrorResponse({
      code: "workspace_runtime_ingest_failed",
      message:
        error instanceof Error
          ? error.message
          : "Workspace runtime ingest failed.",
      status: 500,
    });
  }
}
