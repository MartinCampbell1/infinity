import { NextResponse } from "next/server";
import { isExecutionKernelRequestError } from "@founderos/api-clients";

import {
  buildExecutionBatchesDirectoryResponse,
  createExecutionBatch,
} from "../../../../../lib/server/orchestration/batches";
import { triggerAutonomousLoopSafely } from "../../../../../lib/server/orchestration/autonomy";
import { isCreateExecutionBatchRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";
import {
  apiErrorResponse,
  controlPlaneStorageUnavailableResponse,
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
      await buildExecutionBatchesDirectoryResponse({
        initiativeId: filterValue(request, "initiative_id"),
        taskGraphId: filterValue(request, "task_graph_id"),
      })
    )
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isCreateExecutionBatchRequest(body)) {
    return apiErrorResponse({
      code: "invalid_batch_creation_body",
      message:
        "Batch creation requires taskGraphId and optional workUnitIds/concurrencyLimit.",
      status: 400,
    });
  }

  let response;
  try {
    response = await createExecutionBatch(body);
  } catch (error) {
    const storageResponse = controlPlaneStorageUnavailableResponse(error, {
      accepted: false,
    });
    if (storageResponse) {
      return storageResponse;
    }

    const status = isExecutionKernelRequestError(error)
      ? error.status === 429
        ? 429
        : error.status >= 500
          ? 502
          : 400
      : 400;

    return apiErrorResponse({
      code: "batch_launch_rejected",
      message:
        error instanceof Error
          ? error.message
          : "Batch launch request was rejected before reaching the execution kernel.",
      status,
    });
  }

  if (!response) {
    return apiErrorResponse({
      code: "batch_task_graph_not_runnable",
      message:
        "Task graph was not found or it did not expose runnable work units for batch launch.",
      status: 404,
    });
  }

  await triggerAutonomousLoopSafely(response.batch.initiativeId);

  return NextResponse.json(response, { status: 201 });
}
