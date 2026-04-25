import { NextResponse } from "next/server";

import {
  buildAccountDetailResponse,
  findControlPlaneAccount,
} from "../../../../../lib/server/control-plane/accounts";
import {
  apiErrorResponse,
  withControlPlaneStorageGuard,
} from "../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  return withControlPlaneStorageGuard(async () => {
    const account = await findControlPlaneAccount(accountId);

    if (!account) {
      return apiErrorResponse({
        code: "account_not_found",
        message: `Account ${accountId} was not found in the shell control-plane directory.`,
        status: 404,
      });
    }

    return NextResponse.json(buildAccountDetailResponse(account));
  });
}
