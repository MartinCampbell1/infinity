import { NextResponse } from "next/server";

import { buildExecutionBatchDetailResponse } from "../../../../../../lib/server/orchestration/batches";
import {
  apiErrorResponse,
  controlPlaneStorageUnavailableResponse,
} from "../../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  let response;
  try {
    response = await buildExecutionBatchDetailResponse(batchId);
  } catch (error) {
    const storageResponse = controlPlaneStorageUnavailableResponse(error);
    if (storageResponse) {
      return storageResponse;
    }

    return apiErrorResponse({
      code: "batch_detail_enrichment_failed",
      message:
        error instanceof Error
          ? error.message
          : `Batch ${batchId} could not be enriched from the execution kernel.`,
      status: 502,
    });
  }

  if (!response) {
    return apiErrorResponse({
      code: "batch_not_found",
      message: `Batch ${batchId} is not present in the shell orchestration directory.`,
      status: 404,
    });
  }

  return NextResponse.json(response);
}
