import { NextResponse } from "next/server";

import { buildOperatorActionAuditDirectory } from "../../../../../lib/server/control-plane/operator-audits";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildOperatorActionAuditDirectory());
}
