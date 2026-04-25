import { NextResponse } from "next/server";

import {
  buildInitiativeDetailResponse,
  buildInitiativeMutationResponse,
  updateOrchestrationInitiative,
} from "../../../../../../lib/server/orchestration/initiatives";
import { isUpdateInitiativeRequest } from "../../../../../../lib/server/control-plane/contracts/orchestration";
import {
  apiErrorResponse,
  withControlPlaneStorageGuard,
} from "../../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ initiativeId: string }> }
) {
  const { initiativeId } = await params;
  return withControlPlaneStorageGuard(async () => {
    const response = await buildInitiativeDetailResponse(initiativeId);

    if (!response) {
      return apiErrorResponse({
        code: "initiative_not_found",
        message: `Initiative ${initiativeId} is not present in the shell orchestration directory.`,
        status: 404,
      });
    }

    return NextResponse.json(response);
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ initiativeId: string }> }
) {
  const { initiativeId } = await params;
  const body = await request.json().catch(() => null);

  if (!isUpdateInitiativeRequest(body)) {
    return apiErrorResponse({
      code: "invalid_initiative_update_body",
      message:
        "Initiative updates accept optional title, userRequest, requestedBy, status, priority, and workspaceSessionId fields.",
      status: 400,
    });
  }

  return withControlPlaneStorageGuard(async () => {
    const initiative = await updateOrchestrationInitiative(initiativeId, body);
    if (!initiative) {
      return apiErrorResponse({
        code: "initiative_not_found",
        message: `Initiative ${initiativeId} is not present in the shell orchestration directory.`,
        status: 404,
      });
    }

    return NextResponse.json(await buildInitiativeMutationResponse(initiativeId));
  }, { accepted: false });
}
