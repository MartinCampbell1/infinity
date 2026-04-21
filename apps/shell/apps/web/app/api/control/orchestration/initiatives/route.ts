import { NextResponse } from "next/server";

import {
  buildInitiativesDirectoryResponse,
  buildInitiativeMutationResponse,
  createOrchestrationInitiative,
} from "../../../../../lib/server/orchestration/initiatives";
import { isCreateInitiativeRequest } from "../../../../../lib/server/control-plane/contracts/orchestration";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildInitiativesDirectoryResponse());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isCreateInitiativeRequest(body)) {
    return NextResponse.json(
      {
        detail:
          "Initiative creation requires title, userRequest, requestedBy, and an optional priority/workspaceSessionId.",
      },
      { status: 400 }
    );
  }

  const initiative = await createOrchestrationInitiative(body);
  const response = await buildInitiativeMutationResponse(initiative.id);

  return NextResponse.json(response, { status: 201 });
}
