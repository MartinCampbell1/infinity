import { NextResponse } from "next/server";

import { buildRecoveryIncidentsDirectory } from "@/lib/server/control-plane/recoveries";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildRecoveryIncidentsDirectory());
}
