import { NextResponse } from "next/server";

import {
  buildSupervisorActionsDirectoryResponse,
  performSupervisorAction,
} from "../../../../../../lib/server/orchestration/supervisor";
import { triggerAutonomousLoopSafely } from "../../../../../../lib/server/orchestration/autonomy";
import { isSupervisorActionRequest } from "../../../../../../lib/server/control-plane/contracts/orchestration";
import { controlPlaneMutationActorFromRequest } from "../../../../../../lib/server/http/control-plane-auth";
import {
  controlPlaneStorageUnavailableResponse,
  withControlPlaneStorageGuard,
} from "../../../../../../lib/server/http/control-plane-storage-response";
import {
  controlPlaneIdempotencyKeyFromRequest,
  hashControlPlaneMutationRequest,
  isControlPlaneIdempotencyConflictError,
  readControlPlaneIdempotentMutationResult,
  recordControlPlaneMutationResult,
} from "../../../../../../lib/server/control-plane/state/mutations";
import type { SupervisorActionMutationResponse } from "../../../../../../lib/server/control-plane/contracts/orchestration";

export const dynamic = "force-dynamic";

function filterValue(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export async function GET(request: Request) {
  return withControlPlaneStorageGuard(async () =>
    NextResponse.json(
      await buildSupervisorActionsDirectoryResponse({
        batchId: filterValue(request, "batch_id"),
        taskGraphId: filterValue(request, "task_graph_id"),
      })
    )
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isSupervisorActionRequest(body)) {
    return NextResponse.json(
      {
        detail:
          "Supervisor action requires a supported actionKind and the required batch/attempt/work-unit fields.",
      },
      { status: 400 }
    );
  }

  let response;
  try {
    const actor = controlPlaneMutationActorFromRequest(request);
    if (!actor) {
      return NextResponse.json(
        {
          code: "missing_actor",
          detail: "Supervisor actions require an authenticated actor.",
        },
        { status: 401 },
      );
    }

    const idempotencyKey = controlPlaneIdempotencyKeyFromRequest(request);
    const requestHash = idempotencyKey
      ? hashControlPlaneMutationRequest({
          route: "supervisor.action",
          body,
        })
      : null;
    if (idempotencyKey && requestHash) {
      const replay =
        await readControlPlaneIdempotentMutationResult<SupervisorActionMutationResponse>({
          tenantId: actor.tenantId,
          idempotencyKey,
          requestHash,
        });
      if (replay) {
        return NextResponse.json(replay.responseJson, {
          status: replay.statusCode,
        });
      }
    }

    response = await performSupervisorAction(body, actor);
    if (response && idempotencyKey && requestHash) {
      await recordControlPlaneMutationResult({
        tenantId: actor.tenantId,
        idempotencyKey,
        requestHash,
        mutationKind: "supervisor.action",
        resourceKind: "supervisor_action",
        resourceId: body.batchId,
        actorId: actor.actorId,
        statusCode: 200,
        payload: {
          actionKind: body.actionKind,
          batchId: body.batchId,
          workUnitId: body.workUnitId,
        },
        responseJson: response as unknown as Record<string, unknown>,
      });
    }
  } catch (error) {
    const storageResponse = controlPlaneStorageUnavailableResponse(error, {
      accepted: false,
    });
    if (storageResponse) {
      return storageResponse;
    }
    if (isControlPlaneIdempotencyConflictError(error)) {
      return NextResponse.json(
        {
          code: error.code,
          detail: error.message,
          accepted: false,
        },
        { status: error.status },
      );
    }

    const detail =
      error instanceof Error
        ? error.message
        : "Supervisor action failed before the shell could persist the result.";
    const status = detail.includes("Execution kernel request failed") ? 502 : 400;

    return NextResponse.json(
      {
        detail,
      },
      { status }
    );
  }

  if (!response) {
    return NextResponse.json(
      {
        detail:
          "Supervisor action could not be applied because the referenced batch, task graph, or work unit was not found.",
      },
      { status: 404 }
    );
  }

  await triggerAutonomousLoopSafely(response.batch.initiativeId);

  return NextResponse.json(response);
}
