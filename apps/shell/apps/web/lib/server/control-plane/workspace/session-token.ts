import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  WorkspaceIssuedSession,
  WorkspaceIssuedSessionClaims,
  WorkspaceLaunchRefs,
} from "../contracts/workspace-launch";
import { resolveWorkspaceSessionTokenSecret } from "./rollout-config";

const WORKSPACE_SESSION_TOKEN_TTL_MS = 30 * 60 * 1000;

function normalizeValue(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRefs(refs: WorkspaceLaunchRefs): WorkspaceLaunchRefs {
  return {
    projectId: normalizeValue(refs.projectId) ?? "",
    sessionId: normalizeValue(refs.sessionId) ?? "",
    groupId: normalizeValue(refs.groupId),
    accountId: normalizeValue(refs.accountId),
    workspaceId: normalizeValue(refs.workspaceId),
  };
}

function sessionTokenSecret() {
  return (
    resolveWorkspaceSessionTokenSecret() ??
    "founderos-workspace-session-token-dev"
  );
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payloadSegment: string) {
  return createHmac("sha256", sessionTokenSecret())
    .update(payloadSegment)
    .digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function mintWorkspaceSessionToken(params: {
  refs: WorkspaceLaunchRefs;
  now?: Date;
  ttlMs?: number;
}): WorkspaceIssuedSession {
  const now = params.now ?? new Date();
  const ttlMs = params.ttlMs ?? WORKSPACE_SESSION_TOKEN_TTL_MS;
  const refs = normalizeRefs(params.refs);
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const claims: WorkspaceIssuedSessionClaims = {
    v: 1,
    kind: "founderos_workspace_embedded_session",
    projectId: refs.projectId,
    sessionId: refs.sessionId,
    groupId: refs.groupId ?? null,
    accountId: refs.accountId ?? null,
    workspaceId: refs.workspaceId ?? null,
    issuedAt,
    expiresAt,
  };

  const payloadSegment = encodeBase64Url(JSON.stringify(claims));
  const signatureSegment = signPayload(payloadSegment);

  return {
    token: `${payloadSegment}.${signatureSegment}`,
    issuedAt,
    expiresAt,
  };
}

export function verifyWorkspaceSessionToken(params: {
  token?: string | null;
  refs: WorkspaceLaunchRefs;
  now?: Date;
}) {
  const token = normalizeValue(params.token);
  if (!token) {
    return {
      valid: false,
      claims: null as WorkspaceIssuedSessionClaims | null,
      note: "Missing shell-issued embedded workspace session token.",
    };
  }

  const [payloadSegment, signatureSegment, extraSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment || extraSegment) {
    return {
      valid: false,
      claims: null,
      note: "Embedded workspace session token is malformed.",
    };
  }

  const expectedSignature = signPayload(payloadSegment);
  if (!constantTimeEqual(signatureSegment, expectedSignature)) {
    return {
      valid: false,
      claims: null,
      note: "Embedded workspace session token is invalid or has been tampered with.",
    };
  }

  let claims: WorkspaceIssuedSessionClaims | null = null;
  try {
    claims = JSON.parse(
      decodeBase64Url(payloadSegment)
    ) as WorkspaceIssuedSessionClaims;
  } catch {
    return {
      valid: false,
      claims: null,
      note: "Embedded workspace session token payload is not decodable.",
    };
  }

  const refs = normalizeRefs(params.refs);
  const claimsMatch =
    claims.v === 1 &&
    claims.kind === "founderos_workspace_embedded_session" &&
    claims.projectId === refs.projectId &&
    claims.sessionId === refs.sessionId &&
    (claims.groupId ?? null) === (refs.groupId ?? null) &&
    (claims.accountId ?? null) === (refs.accountId ?? null) &&
    (claims.workspaceId ?? null) === (refs.workspaceId ?? null);

  if (!claimsMatch) {
    return {
      valid: false,
      claims,
      note:
        "Embedded workspace session token does not match the requested launch scope.",
    };
  }

  const now = params.now ?? new Date();
  const expiresAt = Date.parse(claims.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < now.getTime()) {
    return {
      valid: false,
      claims,
      note: "Embedded workspace session token has expired.",
    };
  }

  return {
    valid: true,
    claims,
    note: "Embedded workspace session token is valid.",
  };
}
