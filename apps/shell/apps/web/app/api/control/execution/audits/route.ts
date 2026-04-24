import { NextResponse } from "next/server";

import { buildOperatorActionAuditDirectory } from "../../../../../lib/server/control-plane/operator-audits";
import { withControlPlaneStorageGuard } from "../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return withControlPlaneStorageGuard(async () =>
    NextResponse.json(await buildOperatorActionAuditDirectory()),
  );
}
