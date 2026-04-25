import { NextResponse } from "next/server";

import {
  buildTaskGraphsDirectoryResponse,
  createTaskGraphFromBrief,
} from "../../../../../lib/server/orchestration/task-graphs";
import { triggerAutonomousLoopSafely } from "../../../../../lib/server/orchestration/autonomy";
import { isCreateTaskGraphRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";
import {
  apiErrorResponse,
  withControlPlaneStorageGuard,
} from "../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

function filterValue(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export async function GET(request: Request) {
  return withControlPlaneStorageGuard(async () =>
    NextResponse.json(
      await buildTaskGraphsDirectoryResponse({
        initiativeId: filterValue(request, "initiative_id"),
        briefId: filterValue(request, "brief_id"),
      })
    )
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isCreateTaskGraphRequest(body)) {
    return apiErrorResponse({
      code: "invalid_task_graph_creation_body",
      message: "Task graph creation requires a briefId.",
      status: 400,
    });
  }

  return withControlPlaneStorageGuard(async () => {
    const response = await createTaskGraphFromBrief(body);
    if (!response) {
      return apiErrorResponse({
        code: "approved_brief_not_found",
        message: `Approved brief ${body.briefId} is required before generating a task graph.`,
        status: 404,
      });
    }

    await triggerAutonomousLoopSafely(response.taskGraph.initiativeId);

    return NextResponse.json(response, { status: 201 });
  }, { accepted: false });
}
