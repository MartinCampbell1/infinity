import { NextResponse } from "next/server";

import { buildTaskGraphDetailResponse } from "../../../../../../lib/server/orchestration/task-graphs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskGraphId: string }> }
) {
  const { taskGraphId } = await params;
  const response = await buildTaskGraphDetailResponse(taskGraphId);

  if (!response) {
    return NextResponse.json(
      {
        detail: `Task graph ${taskGraphId} is not present in the shell orchestration directory.`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json(response);
}
