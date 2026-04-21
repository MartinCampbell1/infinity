import { NextResponse } from "next/server";

import {
  buildExecutionBatchesDirectoryResponse,
  createExecutionBatch,
} from "../../../../../lib/server/orchestration/batches";
import { triggerAutonomousLoopSafely } from "../../../../../lib/server/orchestration/autonomy";
import { isCreateExecutionBatchRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";

export const dynamic = "force-dynamic";

function filterValue(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export async function GET(request: Request) {
  return NextResponse.json(
    await buildExecutionBatchesDirectoryResponse({
      initiativeId: filterValue(request, "initiative_id"),
      taskGraphId: filterValue(request, "task_graph_id"),
    })
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isCreateExecutionBatchRequest(body)) {
    return NextResponse.json(
      {
        detail:
          "Batch creation requires taskGraphId and optional workUnitIds/concurrencyLimit.",
      },
      { status: 400 }
    );
  }

  let response;
  try {
    response = await createExecutionBatch(body);
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Batch launch request was rejected before reaching the execution kernel.",
      },
      { status: 400 }
    );
  }

  if (!response) {
    return NextResponse.json(
      {
        detail:
          "Task graph was not found or it did not expose runnable work units for batch launch.",
      },
      { status: 404 }
    );
  }

  await triggerAutonomousLoopSafely(response.batch.initiativeId);

  return NextResponse.json(response, { status: 201 });
}
