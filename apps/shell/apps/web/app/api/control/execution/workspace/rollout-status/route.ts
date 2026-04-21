import { NextResponse } from "next/server";

import { buildWorkspaceLaunchRolloutStatus } from "../../../../../../lib/server/control-plane/workspace/deployment";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await buildWorkspaceLaunchRolloutStatus();
  return NextResponse.json(status);
}
