import { NextResponse } from "next/server";

import {
  buildWorkUnitsDirectoryResponse,
  createOrchestrationWorkUnit,
} from "../../../../../lib/server/orchestration/work-units";
import { isCreateWorkUnitRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";
import { withControlPlaneStorageGuard } from "../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

function filterValue(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export async function GET(request: Request) {
  return withControlPlaneStorageGuard(async () =>
    NextResponse.json(
      await buildWorkUnitsDirectoryResponse({
        taskGraphId: filterValue(request, "task_graph_id"),
      })
    )
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isCreateWorkUnitRequest(body)) {
    return NextResponse.json(
      {
        detail:
          "Work unit creation requires taskGraphId, title, description, executorType, scopePaths, dependencies, and acceptanceCriteria.",
      },
      { status: 400 }
    );
  }

  return withControlPlaneStorageGuard(async () => {
    const response = await createOrchestrationWorkUnit(body);
    if (!response) {
      return NextResponse.json(
        {
          detail: `Task graph ${body.taskGraphId} is not present in the shell orchestration directory.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(response, { status: 201 });
  }, { accepted: false });
}
