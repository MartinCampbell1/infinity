import { NextResponse } from "next/server";

import {
  buildProjectBriefMutationResponse,
  buildProjectBriefsDirectoryResponse,
  createOrchestrationBrief,
} from "../../../../../lib/server/orchestration/briefs";
import { triggerAutonomousLoopSafely } from "../../../../../lib/server/orchestration/autonomy";
import { isCreateProjectBriefRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildProjectBriefsDirectoryResponse());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isCreateProjectBriefRequest(body)) {
    return NextResponse.json(
      {
        detail:
          "Brief creation requires initiativeId, summary, list fields, clarificationLog, and authoredBy.",
      },
      { status: 400 }
    );
  }

  const result = await createOrchestrationBrief(body);
  if (!result.brief) {
    return NextResponse.json(
      {
        detail: `Initiative ${body.initiativeId} is not present in the shell orchestration directory.`,
      },
      { status: 404 }
    );
  }

  await triggerAutonomousLoopSafely(result.brief.initiativeId);

  return NextResponse.json(await buildProjectBriefMutationResponse(result.brief.id), {
    status: 201,
  });
}
