import { NextResponse } from "next/server";

import { buildInitiativeContinuityResponse } from "../../../../../../lib/server/orchestration/continuity";
import { withControlPlaneStorageGuard } from "../../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ initiativeId: string }> }
) {
  const { initiativeId } = await params;
  return withControlPlaneStorageGuard(async () => {
    const response = await buildInitiativeContinuityResponse(initiativeId);

    if (!response) {
      return NextResponse.json(
        {
          detail: `Continuity record for initiative ${initiativeId} is not present in the shell orchestration directory.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(response);
  });
}
