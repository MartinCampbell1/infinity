import { NextResponse } from "next/server";

import {
  buildTaskGraphsDirectoryResponse,
  createTaskGraphFromBrief,
} from "../../../../../lib/server/orchestration/task-graphs";
import { triggerAutonomousLoopSafely } from "../../../../../lib/server/orchestration/autonomy";
import { isCreateTaskGraphRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";

export const dynamic = "force-dynamic";

function filterValue(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export async function GET(request: Request) {
  return NextResponse.json(
    await buildTaskGraphsDirectoryResponse({
      initiativeId: filterValue(request, "initiative_id"),
      briefId: filterValue(request, "brief_id"),
    })
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isCreateTaskGraphRequest(body)) {
    return NextResponse.json(
      {
        detail: "Task graph creation requires a briefId.",
      },
      { status: 400 }
    );
  }

  const response = await createTaskGraphFromBrief(body);
  if (!response) {
    return NextResponse.json(
      {
        detail: `Approved brief ${body.briefId} is required before generating a task graph.`,
      },
      { status: 404 }
    );
  }

  await triggerAutonomousLoopSafely(response.taskGraph.initiativeId);

  return NextResponse.json(response, { status: 201 });
}
