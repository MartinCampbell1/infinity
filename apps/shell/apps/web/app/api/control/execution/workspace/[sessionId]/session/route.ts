import { NextResponse } from "next/server";

import {
  normalizeWorkspaceLaunchRefs,
  type WorkspaceLaunchSessionRequest,
} from "../../../../../../../lib/server/control-plane/contracts/workspace-launch";
import {
  buildWorkspaceSessionExchange,
  recordWorkspaceSessionRevoked,
  verifyWorkspaceSessionCookie,
} from "../../../../../../../lib/server/control-plane/workspace/session";
import { verifyWorkspaceLaunchToken } from "../../../../../../../lib/server/control-plane/workspace/launch-token";
import { buildWorkspaceSessionClearCookieHeader } from "../../../../../../../lib/server/control-plane/workspace/session-token";
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

function parseBody(body: unknown): WorkspaceLaunchSessionRequest | null {
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

function parseRevokeBody(body: unknown): (WorkspaceLaunchSessionRequest & {
  grantId?: string | null;
  reason?: string | null;
}) | null {
  const parsed = parseBody(body);
  if (!parsed || !body || typeof body !== "object") {
    return parsed;
  }

  const payload = body as Record<string, unknown>;
  return {
    ...parsed,
    grantId: asOptionalString(payload.grantId),
    reason: asOptionalString(payload.reason),
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
        error: "Invalid workspace session body.",
      },
      { status: 400 }
    );
  }

  if (body.sessionId && body.sessionId !== sessionId) {
    return NextResponse.json(
      {
        error: "Workspace session body does not match the route sessionId.",
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
        error: "Workspace session exchange requires projectId and sessionId.",
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

  return withControlPlaneStorageGuard(async () => {
    const exchange = await buildWorkspaceSessionExchange(refs);
    const response = NextResponse.json(exchange.responseBody);
    response.headers.set("Cache-Control", "no-store");
    if (exchange.setCookieHeader) {
      response.headers.append("Set-Cookie", exchange.setCookieHeader);
    }

    return response;
  }, { accepted: false });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = parseRevokeBody(await request.json().catch(() => null));

  if (!body) {
    return NextResponse.json(
      {
        error: "Invalid workspace session revoke body.",
      },
      { status: 400 }
    );
  }

  if (body.sessionId && body.sessionId !== sessionId) {
    return NextResponse.json(
      {
        error: "Workspace session revoke body does not match the route sessionId.",
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
        error: "Workspace session revoke requires projectId and sessionId.",
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

  return withControlPlaneStorageGuard(async () => {
    await recordWorkspaceSessionRevoked({
      refs,
      grantId: body.grantId,
      sessionTokenId:
        (await verifyWorkspaceSessionCookie({ headers: request.headers, refs }))
          .claims?.sessionTokenId ?? null,
      reason: body.reason,
    });

    const response = NextResponse.json({
      canonicalTruth: "sessionId",
      accepted: true,
      sessionId: refs.sessionId,
      note: "Embedded workspace session grant was revoked and the cookie-bound session was cleared.",
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.append(
      "Set-Cookie",
      buildWorkspaceSessionClearCookieHeader({ refs }),
    );
    return response;
  }, { accepted: false });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = parseBody(await request.json().catch(() => null));

  if (!body) {
    return NextResponse.json(
      {
        error: "Invalid workspace session refresh body.",
      },
      { status: 400 }
    );
  }

  if (body.sessionId && body.sessionId !== sessionId) {
    return NextResponse.json(
      {
        error: "Workspace session refresh body does not match the route sessionId.",
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
        error: "Workspace session refresh requires projectId and sessionId.",
      },
      { status: 400 }
    );
  }

  const cookieVerification = await verifyWorkspaceSessionCookie({
    headers: request.headers,
    refs,
  });

  if (!cookieVerification.valid || !cookieVerification.claims) {
    return NextResponse.json(
      {
        accepted: false,
        canonicalTruth: "sessionId",
        sessionId: refs.sessionId,
        note: cookieVerification.note,
      },
      { status: 401 }
    );
  }

  const sessionTokenId = cookieVerification.claims.sessionTokenId;

  return withControlPlaneStorageGuard(async () => {
    await recordWorkspaceSessionRevoked({
      refs,
      sessionTokenId,
      reason: "session_rotation",
    });

    const exchange = await buildWorkspaceSessionExchange(refs);
    const response = NextResponse.json({
      ...exchange.responseBody,
      note: "Embedded workspace session was refreshed and rotated.",
    });
    response.headers.set("Cache-Control", "no-store");
    if (exchange.setCookieHeader) {
      response.headers.append("Set-Cookie", exchange.setCookieHeader);
    }
    return response;
  }, { accepted: false });
}
