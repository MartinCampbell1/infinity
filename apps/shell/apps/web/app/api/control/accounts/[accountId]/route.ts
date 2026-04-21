import { NextResponse } from "next/server";

import {
  buildAccountDetailResponse,
  findControlPlaneAccount,
} from "../../../../../lib/server/control-plane/accounts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const account = await findControlPlaneAccount(accountId);

  if (!account) {
    return NextResponse.json(
      { detail: `Account ${accountId} was not found in the shell control-plane directory.` },
      { status: 404 }
    );
  }

  return NextResponse.json(buildAccountDetailResponse(account));
}
