import { NextResponse } from "next/server";

import {
  buildVerificationsDirectoryResponse,
  createVerification,
} from "../../../../../lib/server/orchestration/verification";
import { triggerAutonomousLoopSafely } from "../../../../../lib/server/orchestration/autonomy";
import { isCreateVerificationRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";

export const dynamic = "force-dynamic";

function filterValue(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export async function GET(request: Request) {
  return NextResponse.json(
    await buildVerificationsDirectoryResponse({
      initiativeId: filterValue(request, "initiative_id"),
    })
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isCreateVerificationRequest(body)) {
    return NextResponse.json(
      {
        detail: "Verification creation requires initiativeId.",
      },
      { status: 400 }
    );
  }

  const response = await createVerification(body);
  if (!response) {
    return NextResponse.json(
      {
        detail: "Verification could not be created because the initiative has no task graph.",
      },
      { status: 400 }
    );
  }

  await triggerAutonomousLoopSafely(response.verification.initiativeId);

  return NextResponse.json(response, { status: 201 });
}
