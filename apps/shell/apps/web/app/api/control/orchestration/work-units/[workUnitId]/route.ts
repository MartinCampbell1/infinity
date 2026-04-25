import { NextResponse } from "next/server";

import {
  buildWorkUnitDetailResponse,
  updateOrchestrationWorkUnit,
} from "../../../../../../lib/server/orchestration/work-units";
import { triggerAutonomousLoopSafely } from "../../../../../../lib/server/orchestration/autonomy";
import { isUpdateWorkUnitRequest } from "../../../../../../lib/server/control-plane/contracts/orchestration";
import {
  apiErrorResponse,
  withControlPlaneStorageGuard,
} from "../../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workUnitId: string }> }
) {
  const { workUnitId } = await params;
  return withControlPlaneStorageGuard(async () => {
    const response = await buildWorkUnitDetailResponse(workUnitId);

    if (!response) {
      return apiErrorResponse({
        code: "work_unit_not_found",
        message: `Work unit ${workUnitId} is not present in the shell orchestration directory.`,
        status: 404,
      });
    }

    await triggerAutonomousLoopSafely(response.taskGraph?.initiativeId ?? null);

    return NextResponse.json(response);
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workUnitId: string }> }
) {
  const { workUnitId } = await params;
  const body = await request.json().catch(() => null);

  if (!isUpdateWorkUnitRequest(body)) {
    return apiErrorResponse({
      code: "invalid_work_unit_update_body",
      message:
        "Work unit updates accept optional title, description, executorType, scopePaths, dependencies, acceptanceCriteria, estimatedComplexity, status, and latestAttemptId.",
      status: 400,
    });
  }

  return withControlPlaneStorageGuard(async () => {
    const response = await updateOrchestrationWorkUnit(workUnitId, body);
    if (!response) {
      return apiErrorResponse({
        code: "work_unit_not_found",
        message: `Work unit ${workUnitId} is not present in the shell orchestration directory.`,
        status: 404,
      });
    }

    return NextResponse.json(response);
  }, { accepted: false });
}
