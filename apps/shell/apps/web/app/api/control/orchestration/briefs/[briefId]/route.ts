import { NextResponse } from "next/server";

import {
  buildProjectBriefDetailResponse,
  buildProjectBriefMutationResponse,
  updateOrchestrationBrief,
} from "../../../../../../lib/server/orchestration/briefs";
import { triggerAutonomousLoopSafely } from "../../../../../../lib/server/orchestration/autonomy";
import { isUpdateProjectBriefRequest } from "../../../../../../lib/server/control-plane/contracts/orchestration";
import {
  apiErrorResponse,
  withControlPlaneStorageGuard,
} from "../../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ briefId: string }> }
) {
  const { briefId } = await params;
  return withControlPlaneStorageGuard(async () => {
    const response = await buildProjectBriefDetailResponse(briefId);

    if (!response) {
      return apiErrorResponse({
        code: "brief_not_found",
        message: `Brief ${briefId} is not present in the shell orchestration directory.`,
        status: 404,
      });
    }

    return NextResponse.json(response);
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ briefId: string }> }
) {
  const { briefId } = await params;
  const body = await request.json().catch(() => null);

  if (!isUpdateProjectBriefRequest(body)) {
    return apiErrorResponse({
      code: "invalid_brief_update_body",
      message:
        "Brief updates accept optional summary, list fields, clarificationLog, status, and authoredBy.",
      status: 400,
    });
  }

  return withControlPlaneStorageGuard(async () => {
    const result = await updateOrchestrationBrief(briefId, body);
    if (!result.brief) {
      return apiErrorResponse({
        code: "brief_not_found",
        message: `Brief ${briefId} is not present in the shell orchestration directory.`,
        status: 404,
      });
    }

    await triggerAutonomousLoopSafely(result.brief.initiativeId);

    return NextResponse.json(await buildProjectBriefMutationResponse(briefId));
  }, { accepted: false });
}
