import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type {
  WorkspaceIssuedSession,
  WorkspaceIssuedSessionClaims,
  WorkspaceLaunchRefs,
  WorkspaceSessionDeliveryMode,
} from "../contracts/workspace-launch";
import {
  requiresFullDeploymentEnv,
  resolveWorkspaceSessionTokenSecret,
} from "./rollout-config";

type EnvLike = Record<string, string | undefined>;

const WORKSPACE_SESSION_TOKEN_TTL_MS = 30 * 60 * 1000;
export const WORKSPACE_SESSION_COOKIE_NAME = "founderos_workspace_session";
export const WORKSPACE_SESSION_DELIVERY_MODE_ENV_KEY =
  "FOUNDEROS_WORKSPACE_SESSION_DELIVERY_MODE";

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

function refreshAfter(issuedAt: Date, ttlMs: number) {
  return new Date(issuedAt.getTime() + Math.floor(ttlMs / 2)).toISOString();
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
  deliveryMode?: WorkspaceSessionDeliveryMode;
}): WorkspaceIssuedSession {
  const now = params.now ?? new Date();
  const ttlMs = params.ttlMs ?? WORKSPACE_SESSION_TOKEN_TTL_MS;
  const deliveryMode =
    params.deliveryMode ?? resolveWorkspaceSessionDeliveryMode();
  const refs = normalizeRefs(params.refs);
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const sessionTokenId = randomUUID();
  const claims: WorkspaceIssuedSessionClaims = {
    v: 1,
    kind: "founderos_workspace_embedded_session",
    sessionTokenId,
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
    sessionTokenId,
    issuedAt,
    expiresAt,
    refreshAfter: refreshAfter(now, ttlMs),
    deliveryMode,
    cookieName:
      deliveryMode === "http_only_cookie"
        ? WORKSPACE_SESSION_COOKIE_NAME
        : null,
  };
}

export function resolveWorkspaceSessionDeliveryMode(
  env: EnvLike = process.env,
): WorkspaceSessionDeliveryMode {
  if (requiresFullDeploymentEnv(env)) {
    return "http_only_cookie";
  }

  const configuredMode = env[WORKSPACE_SESSION_DELIVERY_MODE_ENV_KEY]?.trim();
  if (
    configuredMode === "http_only_cookie" ||
    configuredMode === "local_dev_session_storage"
  ) {
    return configuredMode;
  }

  return requiresFullDeploymentEnv(env)
    ? "http_only_cookie"
    : "local_dev_session_storage";
}

export function redactWorkspaceSessionForDelivery(
  session: WorkspaceIssuedSession,
): WorkspaceIssuedSession {
  if (session.deliveryMode === "http_only_cookie") {
    return {
      ...session,
      token: null,
    };
  }

  return session;
}

function cookiePathForSession(sessionId: string) {
  return `/api/control/execution/workspace/${encodeURIComponent(sessionId)}`;
}

function cookieMaxAgeSeconds(expiresAt: string, now: Date) {
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) {
    return 0;
  }
  return Math.max(0, Math.floor((expiresMs - now.getTime()) / 1000));
}

function shouldMarkCookieSecure(env: EnvLike) {
  return requiresFullDeploymentEnv(env);
}

export function buildWorkspaceSessionSetCookieHeader(params: {
  session: WorkspaceIssuedSession;
  refs: WorkspaceLaunchRefs;
  now?: Date;
  env?: EnvLike;
}) {
  if (!params.session.token) {
    return null;
  }

  const now = params.now ?? new Date();
  const env = params.env ?? process.env;
  const attributes = [
    `${WORKSPACE_SESSION_COOKIE_NAME}=${encodeURIComponent(params.session.token)}`,
    "HttpOnly",
    `Path=${cookiePathForSession(params.refs.sessionId)}`,
    "SameSite=Lax",
    `Max-Age=${cookieMaxAgeSeconds(params.session.expiresAt, now)}`,
  ];

  if (shouldMarkCookieSecure(env)) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function buildWorkspaceSessionClearCookieHeader(params: {
  refs: WorkspaceLaunchRefs;
  env?: EnvLike;
}) {
  const env = params.env ?? process.env;
  const attributes = [
    `${WORKSPACE_SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    `Path=${cookiePathForSession(params.refs.sessionId)}`,
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (shouldMarkCookieSecure(env)) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function parseCookieHeader(value: string | null | undefined) {
  const cookies = new Map<string, string>();
  for (const part of (value ?? "").split(";")) {
    const [rawName, ...rawValue] = part.split("=");
    const name = rawName?.trim();
    if (!name) {
      continue;
    }
    cookies.set(name, decodeURIComponent(rawValue.join("=").trim()));
  }
  return cookies;
}

export function readWorkspaceSessionCookieToken(
  headers: Pick<Headers, "get">,
) {
  return (
    parseCookieHeader(headers.get("cookie")).get(WORKSPACE_SESSION_COOKIE_NAME) ??
    null
  );
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
    typeof claims.sessionTokenId === "string" &&
    claims.sessionTokenId.trim().length > 0 &&
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
