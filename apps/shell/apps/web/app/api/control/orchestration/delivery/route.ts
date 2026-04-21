import { NextResponse } from "next/server";

import {
  buildDeliveriesDirectoryResponse,
  createDelivery,
} from "../../../../../lib/server/orchestration/delivery";
import { isCreateVerificationRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";

export const dynamic = "force-dynamic";

function filterValue(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export async function GET(request: Request) {
  return NextResponse.json(
    await buildDeliveriesDirectoryResponse({
      initiativeId: filterValue(request, "initiative_id"),
    })
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

  const response = await createDelivery(body);
  if (!response) {
    return NextResponse.json(
      {
        detail: "Delivery requires a passed verification for the initiative.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json(response, { status: 201 });
}
