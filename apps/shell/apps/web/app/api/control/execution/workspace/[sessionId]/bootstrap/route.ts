import { NextResponse } from "next/server";

import {
  normalizeWorkspaceLaunchRefs,
  type WorkspaceLaunchBootstrapRequest,
} from "../../../../../../../lib/server/control-plane/contracts/workspace-launch";
import { buildWorkspaceLaunchBootstrap } from "../../../../../../../lib/server/control-plane/workspace/bootstrap";
import { verifyWorkspaceLaunchToken } from "../../../../../../../lib/server/control-plane/workspace/launch-token";
import { apiErrorResponse } from "../../../../../../../lib/server/http/api-error-response";
import { withControlPlaneStorageGuard } from "../../../../../../../lib/server/http/control-plane-storage-response";

export const dynamic = "force-dynamic";

function normalizeOpenedFrom(
  value: unknown
):
  | "dashboard"
  | "execution_board"
  | "review"
  | "group_board"
  | "deep_link"
  | "unknown" {
  switch (value) {
    case "dashboard":
    case "execution_board":
    case "review":
    case "group_board":
    case "deep_link":
      return value;
    default:
      return "unknown";
  }
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function parseBody(body: unknown): WorkspaceLaunchBootstrapRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const payload = body as Record<string, unknown>;
  if (typeof payload.projectId !== "string") {
    return null;
  }

  return {
    token: asOptionalString(payload.token),
    projectId: payload.projectId,
    sessionId: asOptionalString(payload.sessionId) ?? "",
    groupId: asOptionalString(payload.groupId),
    accountId: asOptionalString(payload.accountId),
    workspaceId: asOptionalString(payload.workspaceId),
    openedFrom: normalizeOpenedFrom(payload.openedFrom),
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = parseBody(await request.json().catch(() => null));

  if (!body) {
    return apiErrorResponse({
      code: "invalid_workspace_bootstrap_body",
      message: "Invalid workspace bootstrap body.",
      status: 400,
    });
  }

  if (body.sessionId && body.sessionId !== sessionId) {
    return apiErrorResponse({
      code: "session_id_mismatch",
      message: "Workspace bootstrap body does not match the route sessionId.",
      status: 400,
      details: { routeSessionId: sessionId, bodySessionId: body.sessionId },
    });
  }

  const refs = normalizeWorkspaceLaunchRefs({
    projectId: body.projectId,
    sessionId,
    groupId: body.groupId,
    accountId: body.accountId,
    workspaceId: body.workspaceId,
  });

  if (!refs.projectId || !refs.sessionId) {
    return apiErrorResponse({
      code: "missing_workspace_launch_refs",
      message: "Workspace bootstrap requires projectId and sessionId.",
      status: 400,
    });
  }

  const verification = verifyWorkspaceLaunchToken({
    token: body.token,
    refs,
    openedFrom: body.openedFrom ?? "unknown",
  });

  if (!verification.valid) {
    return NextResponse.json(
      {
        accepted: false,
        canonicalTruth: "sessionId",
        sessionId: refs.sessionId,
        note: verification.note,
      },
      { status: 401 }
    );
  }

  return withControlPlaneStorageGuard(async () => {
    const responseBody = await buildWorkspaceLaunchBootstrap({
      refs,
      openedFrom: body.openedFrom ?? "unknown",
    });

    return NextResponse.json(responseBody);
  }, { accepted: false });
}
