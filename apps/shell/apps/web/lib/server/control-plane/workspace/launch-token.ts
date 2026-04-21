import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  WorkspaceLaunchRefs,
  WorkspaceLaunchTokenClaims,
  WorkspaceLaunchTokenVerificationState,
} from "../contracts/workspace-launch";
import { resolveWorkspaceLaunchSecret } from "./rollout-config";

const WORKSPACE_LAUNCH_TOKEN_TTL_MS = 5 * 60 * 1000;

let derivedLaunchSecret: string | null = null;
const WORKSPACE_DIR = path.dirname(fileURLToPath(import.meta.url));

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

function launchSecret() {
  const configuredSecret = resolveWorkspaceLaunchSecret();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (!derivedLaunchSecret) {
    const deterministicSeed = [
      "founderos-workspace-launch-v1",
      path.resolve(WORKSPACE_DIR, "../../../../../../.."),
      process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR ?? "local-state",
      process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1",
      process.env.FOUNDEROS_WEB_PORT ?? "3737",
    ].join("::");
    derivedLaunchSecret = createHash("sha256")
      .update(deterministicSeed)
      .digest("base64url");
  }

  return derivedLaunchSecret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payloadSegment: string) {
  return createHmac("sha256", launchSecret()).update(payloadSegment).digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseClaims(token: string): WorkspaceLaunchTokenClaims | null {
  const [payloadSegment, signatureSegment, extraSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment || extraSegment) {
    return null;
  }

  const expectedSignature = signPayload(payloadSegment);
  if (!constantTimeEqual(signatureSegment, expectedSignature)) {
    return null;
  }

  try {
    const decoded = JSON.parse(decodeBase64Url(payloadSegment)) as WorkspaceLaunchTokenClaims;
    return decoded;
  } catch {
    return null;
  }
}

function claimsMatchRefs(claims: WorkspaceLaunchTokenClaims, refs: WorkspaceLaunchRefs) {
  const normalizedRefs = normalizeRefs(refs);
  return (
    claims.projectId === normalizedRefs.projectId &&
    claims.sessionId === normalizedRefs.sessionId &&
    (claims.groupId ?? null) === (normalizedRefs.groupId ?? null) &&
    (claims.accountId ?? null) === (normalizedRefs.accountId ?? null) &&
    (claims.workspaceId ?? null) === (normalizedRefs.workspaceId ?? null)
  );
}

export function mintWorkspaceLaunchToken(params: {
  refs: WorkspaceLaunchRefs;
  openedFrom: WorkspaceLaunchTokenClaims["openedFrom"];
  now?: Date;
  ttlMs?: number;
}) {
  const now = params.now ?? new Date();
  const ttlMs = params.ttlMs ?? WORKSPACE_LAUNCH_TOKEN_TTL_MS;
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const refs = normalizeRefs(params.refs);
  const claims: WorkspaceLaunchTokenClaims = {
    v: 1,
    projectId: refs.projectId,
    sessionId: refs.sessionId,
    groupId: refs.groupId ?? null,
    accountId: refs.accountId ?? null,
    workspaceId: refs.workspaceId ?? null,
    openedFrom: params.openedFrom,
    issuedAt,
    expiresAt,
  };

  const payloadSegment = encodeBase64Url(JSON.stringify(claims));
  const signatureSegment = signPayload(payloadSegment);

  return {
    token: `${payloadSegment}.${signatureSegment}`,
    claims,
  };
}

export function verifyWorkspaceLaunchToken(params: {
  token?: string | null;
  refs: WorkspaceLaunchRefs;
  openedFrom: WorkspaceLaunchTokenClaims["openedFrom"];
  now?: Date;
}): {
  valid: boolean;
  state: WorkspaceLaunchTokenVerificationState;
  claims: WorkspaceLaunchTokenClaims | null;
  note: string;
} {
  const token = normalizeValue(params.token);
  if (!token) {
    return {
      valid: false,
      state: "missing",
      claims: null,
      note: "Missing shell-issued workspace launch token.",
    };
  }

  const claims = parseClaims(token);
  if (!claims || claims.v !== 1) {
    return {
      valid: false,
      state: "invalid",
      claims: null,
      note: "Workspace launch token is invalid or has been tampered with.",
    };
  }

  if (!claimsMatchRefs(claims, params.refs) || claims.openedFrom !== params.openedFrom) {
    return {
      valid: false,
      state: "invalid",
      claims,
      note: "Workspace launch token does not match the requested session launch scope.",
    };
  }

  const now = params.now ?? new Date();
  const expiresAt = Date.parse(claims.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < now.getTime()) {
    return {
      valid: false,
      state: "expired",
      claims,
      note: "Workspace launch token has expired and must be reissued by the shell.",
    };
  }

  return {
    valid: true,
    state: "valid",
    claims,
    note: "Shell-issued workspace launch token is valid.",
  };
}
