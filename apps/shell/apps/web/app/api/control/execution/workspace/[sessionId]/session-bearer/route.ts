import { NextResponse } from "next/server";

import {
  normalizeWorkspaceLaunchRefs,
  type WorkspaceLaunchSessionBearerRequest,
} from "../../../../../../../lib/server/control-plane/contracts/workspace-launch";
import { buildWorkspaceSessionBearerResponse } from "../../../../../../../lib/server/control-plane/workspace/session-bearer";
import { verifyWorkspaceLaunchToken } from "../../../../../../../lib/server/control-plane/workspace/launch-token";

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

function parseBody(body: unknown): WorkspaceLaunchSessionBearerRequest | null {
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
    return NextResponse.json(
      {
        error: "Invalid workspace session bearer body.",
      },
      { status: 400 }
    );
  }

  if (body.sessionId && body.sessionId !== sessionId) {
    return NextResponse.json(
      {
        error: "Workspace session bearer body does not match the route sessionId.",
      },
      { status: 400 }
    );
  }

  const refs = normalizeWorkspaceLaunchRefs({
    projectId: body.projectId,
    sessionId,
    groupId: body.groupId,
    accountId: body.accountId,
    workspaceId: body.workspaceId,
  });

  if (!refs.projectId || !refs.sessionId) {
    return NextResponse.json(
      {
        error: "Workspace session bearer requires projectId and sessionId.",
      },
      { status: 400 }
    );
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

  const responseBody = await buildWorkspaceSessionBearerResponse(refs);

  return NextResponse.json(responseBody);
}
