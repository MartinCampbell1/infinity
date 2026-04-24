import type {
  WorkspaceLaunchRefs,
  WorkspaceLaunchSessionResponse,
  WorkspaceSessionDeliveryMode,
} from "../contracts/workspace-launch";
import {
  buildNormalizedExecutionEventId,
  type NormalizedExecutionEvent,
} from "../contracts/session-events";
import {
  getControlPlaneIntegrationState,
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
  readControlPlaneState,
  updateControlPlaneState,
} from "../state/store";
import { buildWorkspaceBootstrapUser } from "./bootstrap";
import {
  mintWorkspaceSessionGrant,
  redactWorkspaceSessionGrantForDelivery,
} from "./session-grant";
import {
  buildWorkspaceSessionSetCookieHeader,
  mintWorkspaceSessionToken,
  readWorkspaceSessionCookieToken,
  redactWorkspaceSessionForDelivery,
  resolveWorkspaceSessionDeliveryMode,
  verifyWorkspaceSessionToken,
} from "./session-token";

export interface WorkspaceSessionExchange {
  responseBody: WorkspaceLaunchSessionResponse;
  setCookieHeader: string | null;
  rawSessionToken: string | null;
}

function createSessionAuthEvent(params: {
  refs: WorkspaceLaunchRefs;
  deliveryMode: WorkspaceSessionDeliveryMode;
  grantId: string;
  sessionTokenId: string;
  issuedAt: string;
  expiresAt: string;
  refreshAfter: string;
}): NormalizedExecutionEvent {
  const timestamp = params.issuedAt;
  return {
    id: buildNormalizedExecutionEventId({
      sessionId: params.refs.sessionId,
      source: "manual",
      kind: "session.updated",
      timestamp,
      ordinal: 40,
    }),
    sessionId: params.refs.sessionId,
    projectId: params.refs.projectId,
    groupId: params.refs.groupId ?? null,
    source: "manual",
    provider: "openwebui",
    kind: "session.updated",
    status: "completed",
    phase: "planning",
    timestamp,
    summary:
      params.deliveryMode === "http_only_cookie"
        ? "Shell issued a cookie-bound embedded workspace session."
        : "Shell issued a local-dev embedded workspace bearer session.",
    payload: {
      workspaceSessionAuth: {
        action: "issued",
        deliveryMode: params.deliveryMode,
        grantId: params.grantId,
        sessionTokenId: params.sessionTokenId,
        issuedAt: params.issuedAt,
        expiresAt: params.expiresAt,
        refreshAfter: params.refreshAfter,
        bearerExposedToBrowser:
          params.deliveryMode === "local_dev_session_storage",
      },
    },
    raw: null,
  };
}

async function recordWorkspaceSessionIssued(params: {
  refs: WorkspaceLaunchRefs;
  deliveryMode: WorkspaceSessionDeliveryMode;
  grantId: string;
  sessionTokenId: string;
  issuedAt: string;
  expiresAt: string;
  refreshAfter: string;
}) {
  const event = createSessionAuthEvent(params);
  await updateControlPlaneState((draft) => {
    if (!draft.sessions.events.some((candidate) => candidate.id === event.id)) {
      draft.sessions.events.push(event);
    }
  });
}

export async function recordWorkspaceSessionRevoked(params: {
  refs: WorkspaceLaunchRefs;
  grantId?: string | null;
  sessionTokenId?: string | null;
  reason?: string | null;
  now?: Date;
}) {
  const timestamp = (params.now ?? new Date()).toISOString();
  const event: NormalizedExecutionEvent = {
    id: buildNormalizedExecutionEventId({
      sessionId: params.refs.sessionId,
      source: "manual",
      kind: "session.updated",
      timestamp,
      ordinal: 41,
    }),
    sessionId: params.refs.sessionId,
    projectId: params.refs.projectId,
    groupId: params.refs.groupId ?? null,
    source: "manual",
    provider: "openwebui",
    kind: "session.updated",
    status: "completed",
    phase: "planning",
    timestamp,
    summary: "Shell revoked an embedded workspace session grant.",
    payload: {
      workspaceSessionAuth: {
        action: "revoked",
        grantId: params.grantId ?? null,
        sessionTokenId: params.sessionTokenId ?? null,
        reason: params.reason ?? "operator_or_workspace_logout",
        revokedAt: timestamp,
      },
    },
    raw: null,
  };

  await updateControlPlaneState((draft) => {
    if (!draft.sessions.events.some((candidate) => candidate.id === event.id)) {
      draft.sessions.events.push(event);
    }
  });
}

function readWorkspaceSessionAuthPayload(event: NormalizedExecutionEvent) {
  const payload = event.payload.workspaceSessionAuth;
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
}

export async function isWorkspaceSessionAuthRevoked(params: {
  sessionId: string;
  grantId?: string | null;
  sessionTokenId?: string | null;
}) {
  const state = await readControlPlaneState();
  const grantId = params.grantId?.trim() || null;
  const sessionTokenId = params.sessionTokenId?.trim() || null;

  return state.sessions.events.some((event) => {
    if (event.sessionId !== params.sessionId) {
      return false;
    }
    const auth = readWorkspaceSessionAuthPayload(event);
    if (auth?.action !== "revoked") {
      return false;
    }
    return (
      (grantId && auth.grantId === grantId) ||
      (sessionTokenId && auth.sessionTokenId === sessionTokenId)
    );
  });
}

export async function verifyWorkspaceSessionCookie(params: {
  headers: Pick<Headers, "get">;
  refs: WorkspaceLaunchRefs;
  now?: Date;
}) {
  const token = readWorkspaceSessionCookieToken(params.headers);
  const verification = verifyWorkspaceSessionToken({
    token,
    refs: params.refs,
    now: params.now,
  });

  if (!verification.valid || !verification.claims) {
    return {
      valid: false,
      claims: verification.claims,
      note: verification.note,
    };
  }

  if (
    await isWorkspaceSessionAuthRevoked({
      sessionId: params.refs.sessionId,
      sessionTokenId: verification.claims.sessionTokenId,
    })
  ) {
    return {
      valid: false,
      claims: verification.claims,
      note: "Embedded workspace session token has been revoked.",
    };
  }

  return {
    valid: true,
    claims: verification.claims,
    note: "Embedded workspace session cookie is valid.",
  };
}

export async function buildWorkspaceSessionExchange(
  refs: WorkspaceLaunchRefs
): Promise<WorkspaceSessionExchange> {
  const deliveryMode = resolveWorkspaceSessionDeliveryMode();
  const rawSession = mintWorkspaceSessionToken({ refs, deliveryMode });
  const rawGrant = mintWorkspaceSessionGrant({ refs });
  const responseBody: WorkspaceLaunchSessionResponse = {
    source: getControlPlaneStorageSource(),
    storageKind: getControlPlaneStorageKind(),
    integrationState: getControlPlaneIntegrationState(),
    canonicalTruth: "sessionId",
    accepted: true,
    note:
      deliveryMode === "http_only_cookie"
        ? "Shell exchanged the verified launch token for a cookie-bound embedded workspace session."
        : "Shell exchanged the verified launch token for a local-dev embedded workspace session.",
    sessionId: refs.sessionId,
    session: redactWorkspaceSessionForDelivery(rawSession),
    sessionGrant: redactWorkspaceSessionGrantForDelivery(rawGrant, deliveryMode),
    user: buildWorkspaceBootstrapUser(),
  };

  await recordWorkspaceSessionIssued({
    refs,
    deliveryMode,
    grantId: rawGrant.grantId,
    sessionTokenId: rawSession.sessionTokenId,
    issuedAt: rawGrant.issuedAt,
    expiresAt: rawGrant.expiresAt,
    refreshAfter: rawGrant.refreshAfter,
  });

  return {
    responseBody,
    setCookieHeader:
      deliveryMode === "http_only_cookie"
        ? buildWorkspaceSessionSetCookieHeader({
            session: rawSession,
            refs,
          })
        : null,
    rawSessionToken: rawSession.token,
  };
}

export async function buildWorkspaceSessionResponse(
  refs: WorkspaceLaunchRefs
): Promise<WorkspaceLaunchSessionResponse> {
  return (await buildWorkspaceSessionExchange(refs)).responseBody;
}
