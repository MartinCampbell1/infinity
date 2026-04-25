import { NextResponse } from "next/server";

import { controlPlaneMutationActorFromRequest } from "../../../../../lib/server/http/control-plane-auth";
import { apiErrorResponse } from "../../../../../lib/server/http/api-error-response";
import {
  controlPlaneStorageUnavailableResponse,
  withControlPlaneStorageGuard,
} from "../../../../../lib/server/http/control-plane-storage-response";
import { runOrchestrationRetentionCleanup } from "../../../../../lib/server/orchestration/retention";

export const dynamic = "force-dynamic";

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const actor = controlPlaneMutationActorFromRequest(request);
  if (!actor) {
    return apiErrorResponse({
      code: "missing_actor",
      message: "Orchestration retention cleanup requires an authenticated actor.",
      status: 401,
    });
  }

  const dryRun = optionalBoolean((body as { dryRun?: unknown }).dryRun) ?? true;
  const applyFilesystem =
    optionalBoolean((body as { applyFilesystem?: unknown }).applyFilesystem) ?? false;

  try {
    return await withControlPlaneStorageGuard(async () =>
      NextResponse.json({
        actor: {
          actorId: actor.actorId,
          actorType: actor.actorType,
          tenantId: actor.tenantId,
        },
        ...(await runOrchestrationRetentionCleanup({
          dryRun,
          applyFilesystem: !dryRun && applyFilesystem,
        })),
      }),
    );
  } catch (error) {
    const storageResponse = controlPlaneStorageUnavailableResponse(error, {
      accepted: false,
    });
    if (storageResponse) {
      return storageResponse;
    }

    return apiErrorResponse({
      code: "orchestration_retention_failed",
      message:
        error instanceof Error
          ? error.message
          : "Orchestration retention cleanup failed.",
      status: 500,
    });
  }
}
