import { NextResponse } from "next/server";

import {
  buildApprovalRequestDetailResponse,
} from "../../../../../../lib/server/control-plane/approvals";
import { withControlPlaneStorageGuard } from "../../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const { approvalId } = await params;
  return withControlPlaneStorageGuard(async () => {
    const response = await buildApprovalRequestDetailResponse(approvalId);

    if (!response) {
      return NextResponse.json(
        {
          detail: `Approval request ${approvalId} is not present in the shell control-plane directory.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(response);
  });
}
