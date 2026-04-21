import { NextResponse } from "next/server";

import {
  buildAccountDirectoryResponse,
  listControlPlaneAccounts,
} from "../../../../lib/server/control-plane/accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = await listControlPlaneAccounts();
  const preferredAccountId =
    accounts.find((account) => account.capacity.preferredForNewSessions)?.id ?? null;

  return NextResponse.json(buildAccountDirectoryResponse(accounts, preferredAccountId));
}
