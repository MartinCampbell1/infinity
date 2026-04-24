import { NextResponse } from "next/server";

import {
  buildDeliveriesDirectoryResponse,
  createDelivery,
} from "../../../../../lib/server/orchestration/delivery";
import { isCreateVerificationRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";
import { withControlPlaneStorageGuard } from "../../../../../lib/server/http/control-plane-storage-response";
import {
  activeControlPlaneTenantId,
} from "../../../../../lib/server/control-plane/state/tenancy";
import {
  controlPlaneIdempotencyKeyFromRequest,
  hashControlPlaneMutationRequest,
  isControlPlaneIdempotencyConflictError,
  readControlPlaneIdempotentMutationResult,
  recordControlPlaneMutationResult,
} from "../../../../../lib/server/control-plane/state/mutations";
import type { DeliveryMutationResponse } from "../../../../../lib/server/control-plane/contracts/orchestration";

export const dynamic = "force-dynamic";

function filterValue(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export async function GET(request: Request) {
  return withControlPlaneStorageGuard(async () =>
    NextResponse.json(
      await buildDeliveriesDirectoryResponse({
        initiativeId: filterValue(request, "initiative_id"),
      })
    )
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isCreateVerificationRequest(body)) {
    return NextResponse.json(
      {
        detail: "Delivery creation requires initiativeId.",
      },
      { status: 400 }
    );
  }

  return withControlPlaneStorageGuard(async () => {
    const idempotencyKey = controlPlaneIdempotencyKeyFromRequest(request);
    const requestHash = idempotencyKey
      ? hashControlPlaneMutationRequest({
          route: "delivery.create",
          body,
        })
      : null;
    const tenantId = activeControlPlaneTenantId();
    if (idempotencyKey && requestHash) {
      try {
        const replay =
          await readControlPlaneIdempotentMutationResult<DeliveryMutationResponse>({
            tenantId,
            idempotencyKey,
            requestHash,
          });
        if (replay) {
          return NextResponse.json(replay.responseJson, {
            status: replay.statusCode,
          });
        }
      } catch (error) {
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
        throw error;
      }
    }

    const response = await createDelivery(body);
    if (!response) {
      return NextResponse.json(
        {
          detail: "Delivery requires a passed verification for the initiative.",
        },
        { status: 400 }
      );
    }

    if (idempotencyKey && requestHash) {
      try {
        await recordControlPlaneMutationResult({
          tenantId,
          idempotencyKey,
          requestHash,
          mutationKind: "delivery.create",
          resourceKind: "delivery",
          resourceId: response.delivery.id,
          actorId: null,
          statusCode: 201,
          payload: {
            initiativeId: body.initiativeId,
          },
          responseJson: response as unknown as Record<string, unknown>,
        });
      } catch (error) {
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
        throw error;
      }
    }

    return NextResponse.json(response, { status: 201 });
  }, { accepted: false });
}
