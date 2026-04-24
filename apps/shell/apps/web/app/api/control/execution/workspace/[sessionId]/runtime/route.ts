import { NextResponse } from "next/server";

import {
  buildControlPlaneStorageUnavailableProblem,
  getControlPlaneIntegrationState,
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
  isControlPlaneStorageUnavailableError,
} from "../../../../../../../lib/server/control-plane/state/store";
import {
  isWorkspaceRuntimeBridgeIngestRequest,
  persistWorkspaceRuntimeBridgeMessage,
} from "../../../../../../../lib/server/control-plane/workspace/runtime-ingest";
import type { WorkspaceRuntimeIngestResponse } from "../../../../../../../lib/server/control-plane/contracts/workspace-launch";
import { controlPlaneMutationActorFromRequest } from "../../../../../../../lib/server/http/control-plane-auth";

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
    return NextResponse.json(
      {
        detail:
          "Request body must include hostContext and one supported workspace or host bridge message, or a workspace runtime producer batch.",
      },
      { status: 400 }
    );
  }

  if (body.hostContext.sessionId !== sessionId) {
    return NextResponse.json(
      {
        detail:
          "Route sessionId must match body.hostContext.sessionId for runtime ingest.",
      },
      { status: 400 }
    );
  }

  try {
    const actor = controlPlaneMutationActorFromRequest(request);
    if (!actor) {
      return NextResponse.json(
        {
          code: "missing_actor",
          detail: "Workspace runtime ingest requires an authenticated actor.",
        },
        { status: 401 },
      );
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
    if (isControlPlaneStorageUnavailableError(error)) {
      const problem = buildControlPlaneStorageUnavailableProblem(error);
      return NextResponse.json(
        {
          ...problem,
          accepted: false,
        },
        { status: error.status },
      );
    }

    if (error instanceof Error && error.message.startsWith("Unsupported workspace runtime bridge message")) {
      return NextResponse.json(
        {
          detail: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Workspace runtime ingest failed.",
      },
      { status: 500 }
    );
  }
}
