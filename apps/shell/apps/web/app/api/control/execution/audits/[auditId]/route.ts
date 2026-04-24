import { NextResponse } from "next/server";

import { buildOperatorActionAuditDetailResponse } from "../../../../../../lib/server/control-plane/operator-audits";
import { withControlPlaneStorageGuard } from "../../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ auditId: string }> }
) {
  const { auditId } = await params;
  return withControlPlaneStorageGuard(async () => {
    const response = await buildOperatorActionAuditDetailResponse(auditId);

    if (!response) {
      return NextResponse.json(
        {
          detail: `Operator audit ${auditId} is not present in the shell control-plane directory.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(response);
  });
}
