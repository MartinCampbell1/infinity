import { NextResponse } from "next/server";

import { buildApprovalRequestsDirectory } from "@/lib/server/control-plane/approvals";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildApprovalRequestsDirectory());
}
