import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  WorkspaceIssuedSessionGrant,
  WorkspaceIssuedSessionGrantClaims,
  WorkspaceLaunchRefs,
} from "../contracts/workspace-launch";
import { resolveWorkspaceSessionGrantSecret } from "./rollout-config";

const WORKSPACE_SESSION_GRANT_TTL_MS = 30 * 60 * 1000;

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

function sessionGrantSecret() {
  return (
    resolveWorkspaceSessionGrantSecret() ??
    "founderos-workspace-session-grant-dev"
  );
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payloadSegment: string) {
  return createHmac("sha256", sessionGrantSecret())
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

export function mintWorkspaceSessionGrant(params: {
  refs: WorkspaceLaunchRefs;
  now?: Date;
  ttlMs?: number;
}): WorkspaceIssuedSessionGrant {
  const now = params.now ?? new Date();
  const ttlMs = params.ttlMs ?? WORKSPACE_SESSION_GRANT_TTL_MS;
  const refs = normalizeRefs(params.refs);
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const claims: WorkspaceIssuedSessionGrantClaims = {
    v: 1,
    kind: "founderos_workspace_session_grant",
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

export function verifyWorkspaceSessionGrant(params: {
  token?: string | null;
  refs: WorkspaceLaunchRefs;
  now?: Date;
}) {
  const token = normalizeValue(params.token);
  if (!token) {
    return {
      valid: false,
      claims: null as WorkspaceIssuedSessionGrantClaims | null,
      note: "Missing shell-issued workspace session grant.",
    };
  }

  const [payloadSegment, signatureSegment, extraSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment || extraSegment) {
    return {
      valid: false,
      claims: null,
      note: "Workspace session grant is malformed.",
    };
  }

  const expectedSignature = signPayload(payloadSegment);
  if (!constantTimeEqual(signatureSegment, expectedSignature)) {
    return {
      valid: false,
      claims: null,
      note: "Workspace session grant is invalid or has been tampered with.",
    };
  }

  let claims: WorkspaceIssuedSessionGrantClaims | null = null;
  try {
    claims = JSON.parse(
      decodeBase64Url(payloadSegment)
    ) as WorkspaceIssuedSessionGrantClaims;
  } catch {
    return {
      valid: false,
      claims: null,
      note: "Workspace session grant payload is not decodable.",
    };
  }

  const refs = normalizeRefs(params.refs);
  const claimsMatch =
    claims.v === 1 &&
    claims.kind === "founderos_workspace_session_grant" &&
    claims.projectId === refs.projectId &&
    claims.sessionId === refs.sessionId &&
    (claims.groupId ?? null) === (refs.groupId ?? null) &&
    (claims.accountId ?? null) === (refs.accountId ?? null) &&
    (claims.workspaceId ?? null) === (refs.workspaceId ?? null);

  if (!claimsMatch) {
    return {
      valid: false,
      claims,
      note: "Workspace session grant does not match the requested launch scope.",
    };
  }

  const now = params.now ?? new Date();
  const expiresAt = Date.parse(claims.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < now.getTime()) {
    return {
      valid: false,
      claims,
      note: "Workspace session grant has expired.",
    };
  }

  return {
    valid: true,
    claims,
    note: "Workspace session grant is valid.",
  };
}
