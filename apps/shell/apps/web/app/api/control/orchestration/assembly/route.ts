import { NextResponse } from "next/server";

import {
  buildAssembliesDirectoryResponse,
  createAssembly,
} from "../../../../../lib/server/orchestration/assembly";
import { triggerAutonomousLoopSafely } from "../../../../../lib/server/orchestration/autonomy";
import { isCreateAssemblyRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";

export const dynamic = "force-dynamic";

function filterValue(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export async function GET(request: Request) {
  return NextResponse.json(
    await buildAssembliesDirectoryResponse({
      initiativeId: filterValue(request, "initiative_id"),
    })
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isCreateAssemblyRequest(body)) {
    return NextResponse.json(
      {
        detail: "Assembly creation requires initiativeId.",
      },
      { status: 400 }
    );
  }

  const response = await createAssembly(body);
  if (!response) {
    return NextResponse.json(
      {
        detail:
          "Assembly could not be created because the initiative has no task graph or not every work unit is completed.",
      },
      { status: 400 }
    );
  }

  await triggerAutonomousLoopSafely(response.assembly.initiativeId);

  return NextResponse.json(response, { status: 201 });
}
