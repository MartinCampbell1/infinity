import { NextResponse } from "next/server";

import {
  buildProjectBriefMutationResponse,
  buildProjectBriefsDirectoryResponse,
  createOrchestrationBrief,
} from "../../../../../lib/server/orchestration/briefs";
import { triggerAutonomousLoopSafely } from "../../../../../lib/server/orchestration/autonomy";
import { isCreateProjectBriefRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";
import {
  apiErrorResponse,
  withControlPlaneStorageGuard,
} from "../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return withControlPlaneStorageGuard(async () =>
    NextResponse.json(await buildProjectBriefsDirectoryResponse()),
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isCreateProjectBriefRequest(body)) {
    return apiErrorResponse({
      code: "invalid_brief_creation_body",
      message:
        "Brief creation requires initiativeId, summary, list fields, clarificationLog, and authoredBy.",
      status: 400,
    });
  }

  return withControlPlaneStorageGuard(async () => {
    const result = await createOrchestrationBrief(body);
    if (!result.brief) {
      return apiErrorResponse({
        code: "initiative_not_found",
        message: `Initiative ${body.initiativeId} is not present in the shell orchestration directory.`,
        status: 404,
      });
    }

    await triggerAutonomousLoopSafely(result.brief.initiativeId);

    return NextResponse.json(await buildProjectBriefMutationResponse(result.brief.id), {
      status: 201,
    });
  }, { accepted: false });
}
