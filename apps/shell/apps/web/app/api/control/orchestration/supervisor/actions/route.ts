import { NextResponse } from "next/server";

import {
  buildSupervisorActionsDirectoryResponse,
  performSupervisorAction,
} from "../../../../../../lib/server/orchestration/supervisor";
import { runAutonomousLoopSafely } from "../../../../../../lib/server/orchestration/autonomy";
import { isSupervisorActionRequest } from "../../../../../../lib/server/control-plane/contracts/orchestration";

export const dynamic = "force-dynamic";

function filterValue(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export async function GET(request: Request) {
  return NextResponse.json(
    await buildSupervisorActionsDirectoryResponse({
      batchId: filterValue(request, "batch_id"),
      taskGraphId: filterValue(request, "task_graph_id"),
    })
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isSupervisorActionRequest(body)) {
    return NextResponse.json(
      {
        detail:
          "Supervisor action requires a supported actionKind and the required batch/attempt/work-unit fields.",
      },
      { status: 400 }
    );
  }

  let response;
  try {
    response = await performSupervisorAction(body);
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "Supervisor action failed before the shell could persist the result.";
    const status = detail.includes("Execution kernel request failed") ? 502 : 400;

    return NextResponse.json(
      {
        detail,
      },
      { status }
    );
  }

  if (!response) {
    return NextResponse.json(
      {
        detail:
          "Supervisor action could not be applied because the referenced batch, task graph, or work unit was not found.",
      },
      { status: 404 }
    );
  }

  await runAutonomousLoopSafely(response.batch.initiativeId);

  return NextResponse.json(response);
}
