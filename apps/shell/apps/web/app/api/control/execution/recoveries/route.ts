import { NextResponse } from "next/server";

import { buildRecoveryIncidentsDirectory } from "../../../../../lib/server/control-plane/recoveries";
import type { RecoveryIncidentsDirectoryFilters } from "../../../../../lib/server/control-plane/contracts/recoveries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters: RecoveryIncidentsDirectoryFilters = {
    sessionId: url.searchParams.get("session_id"),
    projectId: url.searchParams.get("project_id"),
    initiativeId: url.searchParams.get("initiative_id"),
    groupId: url.searchParams.get("group_id"),
    accountId: url.searchParams.get("account_id"),
    workspaceId: url.searchParams.get("workspace_id"),
  };

  return NextResponse.json(await buildRecoveryIncidentsDirectory(filters));
}
