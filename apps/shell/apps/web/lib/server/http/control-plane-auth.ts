import type { TenantRole } from "../control-plane/contracts/tenancy";

type EnvLike = Readonly<Record<string, string | undefined>>;

export const REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY =
  "FOUNDEROS_REQUIRE_CONTROL_PLANE_AUTH";
export const CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_OPERATOR_TOKEN";
export const CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_SERVICE_TOKEN";
export const CONTROL_PLANE_OPERATOR_ID_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_OPERATOR_ID";
export const CONTROL_PLANE_SERVICE_ID_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_SERVICE_ID";
export const CONTROL_PLANE_TENANT_ID_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_TENANT_ID";
export const CONTROL_PLANE_OPERATOR_ROLE_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_OPERATOR_ROLE";

export const ACTOR_TYPE_HEADER = "x-founderos-actor-type";
export const ACTOR_ID_HEADER = "x-founderos-actor-id";
export const ACTOR_ROLE_HEADER = "x-founderos-actor-role";
export const ACTOR_TENANT_HEADER = "x-founderos-tenant-id";
export const REQUEST_ID_HEADER = "x-founderos-request-id";
export const AUTH_BOUNDARY_HEADER = "x-founderos-auth-boundary";

export type ControlPlaneActorType = "operator" | "service" | "workspace";

export interface ControlPlaneActor {
  actorType: ControlPlaneActorType;
  actorId: string;
  role: TenantRole;
  tenantId: string;
  requestId: string;
}

export interface ControlPlaneMutationActor {
  actorType: "operator" | "system";
  actorId: string;
  tenantId: string;
  requestId: string;
  authBoundary: string;
}

export interface ControlPlaneActorContext {
  actorType: ControlPlaneMutationActor["actorType"];
  actorId: string;
  tenantId: string;
  requestId: string;
  authBoundary: string;
}

export type ControlPlaneAuthDecision =
  | {
      allowed: true;
      actor: ControlPlaneActor | null;
      requestHeaders: Record<string, string>;
      authBoundary: "token" | "route_owned_launch_token";
    }
  | {
      allowed: false;
      status: 401 | 403 | 503;
      code:
        | "missing_actor"
        | "invalid_actor"
        | "forbidden_actor"
        | "auth_misconfigured";
      detail: string;
    };

function normalizeValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function generateRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}`;
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

function bearerToken(headers: Headers) {
  const authorization = normalizeValue(headers.get("authorization"));
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return normalizeValue(authorization.slice("bearer ".length));
  }
  return null;
}

function actorToken(headers: Headers) {
  const headerToken =
    bearerToken(headers) ??
    normalizeValue(headers.get("x-founderos-actor-token"));
  if (headerToken) {
    return headerToken;
  }

  const cookies = parseCookieHeader(headers.get("cookie"));
  return (
    normalizeValue(cookies.get("founderos_control_plane_operator_token")) ??
    normalizeValue(cookies.get("founderos_control_plane_service_token"))
  );
}

export function requiresControlPlaneAuth(env: EnvLike = process.env) {
  void env;
  return true;
}

function isWorkspaceRuntimePath(pathname: string) {
  return /^\/api\/control\/execution\/workspace\/[^/]+\/runtime$/.test(
    pathname,
  );
}

function isServiceProducerPath(pathname: string, method: string) {
  const normalizedMethod = method.toUpperCase();
  return (
    (normalizedMethod === "POST" &&
      pathname === "/api/control/accounts/quotas") ||
    (normalizedMethod === "POST" && isWorkspaceRuntimePath(pathname)) ||
    (normalizedMethod === "POST" &&
      pathname === "/api/control/orchestration/retention")
  );
}

function isMutationMethod(method: string) {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function isTenantRole(value: string | null): value is TenantRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "operator" ||
    value === "viewer" ||
    value === "service" ||
    value === "workspace_runtime"
  );
}

function normalizeOperatorRole(env: EnvLike): TenantRole {
  const role = normalizeValue(env[CONTROL_PLANE_OPERATOR_ROLE_ENV_KEY]);
  return isTenantRole(role) &&
    role !== "service" &&
    role !== "workspace_runtime"
    ? role
    : "admin";
}

export function controlPlaneRoleCanRead(role: TenantRole) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "operator" ||
    role === "viewer" ||
    role === "service" ||
    role === "workspace_runtime"
  );
}

export function controlPlaneRoleCanMutate(role: TenantRole) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "operator" ||
    role === "service" ||
    role === "workspace_runtime"
  );
}

function actorHeaders(actor: ControlPlaneActor, authBoundary: string) {
  return {
    [ACTOR_TYPE_HEADER]: actor.actorType,
    [ACTOR_ID_HEADER]: actor.actorId,
    [ACTOR_ROLE_HEADER]: actor.role,
    [ACTOR_TENANT_HEADER]: actor.tenantId,
    [REQUEST_ID_HEADER]: actor.requestId,
    [AUTH_BOUNDARY_HEADER]: authBoundary,
  };
}

function isRouteOwnedWorkspaceLaunchPath(pathname: string) {
  return /^\/api\/control\/execution\/workspace\/[^/]+\/(bootstrap|launch-token|session|session-bearer)$/.test(
    pathname,
  );
}

export function controlPlaneMutationActorFromRequest(
  request: Pick<Request, "headers">,
): ControlPlaneMutationActor | null {
  const actorType = normalizeValue(request.headers.get(ACTOR_TYPE_HEADER));
  const actorId = normalizeValue(request.headers.get(ACTOR_ID_HEADER));
  const tenantId = normalizeValue(request.headers.get(ACTOR_TENANT_HEADER));
  const requestId = normalizeValue(request.headers.get(REQUEST_ID_HEADER));
  const authBoundary = normalizeValue(request.headers.get(AUTH_BOUNDARY_HEADER));

  if (!actorType || !actorId || !tenantId || !requestId || !authBoundary) {
    return null;
  }

  if (actorType === "service" || actorType === "workspace") {
    return {
      actorType: "system",
      actorId,
      tenantId,
      requestId,
      authBoundary,
    };
  }

  if (actorType !== "operator") {
    return null;
  }

  return {
    actorType: "operator",
    actorId,
    tenantId,
    requestId,
    authBoundary,
  };
}

export function controlPlaneActorContext(
  actor: ControlPlaneMutationActor,
): ControlPlaneActorContext {
  return {
    actorType: actor.actorType,
    actorId: actor.actorId,
    tenantId: actor.tenantId,
    requestId: actor.requestId,
    authBoundary: actor.authBoundary,
  };
}

function buildActor(params: {
  actorType: ControlPlaneActorType;
  actorId: string;
  role: ControlPlaneActor["role"];
  env: EnvLike;
}) {
  return {
    actorType: params.actorType,
    actorId: params.actorId,
    role: params.role,
    tenantId:
      normalizeValue(params.env[CONTROL_PLANE_TENANT_ID_ENV_KEY]) ?? "default",
    requestId: generateRequestId(),
  };
}

export function authorizeControlPlaneRequest(
  request: Pick<Request, "headers" | "method"> & {
    nextUrl?: { pathname: string };
    url?: string;
  },
  env: EnvLike = process.env,
): ControlPlaneAuthDecision {
  const pathname =
    request.nextUrl?.pathname ??
    (request.url ? new URL(request.url).pathname : "");
  const method = request.method.toUpperCase();

  if (isRouteOwnedWorkspaceLaunchPath(pathname)) {
    const actor = buildActor({
      actorType: "workspace",
      actorId: "workspace-launch-token",
      role: "workspace_runtime",
      env,
    });
    return {
      allowed: true,
      actor,
      requestHeaders: actorHeaders(actor, "route_owned_launch_token"),
      authBoundary: "route_owned_launch_token",
    };
  }

  const operatorToken = normalizeValue(
    env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY],
  );
  const serviceToken = normalizeValue(env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY]);
  if (!operatorToken || !serviceToken) {
    return {
      allowed: false,
      status: 503,
      code: "auth_misconfigured",
      detail:
        "Control-plane auth is enabled but operator/service actor tokens are not fully configured.",
    };
  }

  const token = actorToken(request.headers);
  if (!token) {
    return {
      allowed: false,
      status: 401,
      code: "missing_actor",
      detail: "Privileged control-plane routes require an authenticated actor.",
    };
  }

  if (token === operatorToken) {
    const actor = buildActor({
      actorType: "operator",
      actorId:
        normalizeValue(env[CONTROL_PLANE_OPERATOR_ID_ENV_KEY]) ?? "operator",
      role: normalizeOperatorRole(env),
      env,
    });

    if (
      !controlPlaneRoleCanRead(actor.role) ||
      (isMutationMethod(method) && !controlPlaneRoleCanMutate(actor.role))
    ) {
      return {
        allowed: false,
        status: 403,
        code: "forbidden_actor",
        detail: `Control-plane role ${actor.role} is not permitted to ${method}.`,
      };
    }

    return {
      allowed: true,
      actor,
      requestHeaders: actorHeaders(actor, "token"),
      authBoundary: "token",
    };
  }

  if (token === serviceToken) {
    if (!isServiceProducerPath(pathname, method)) {
      return {
        allowed: false,
        status: 403,
        code: "forbidden_actor",
        detail:
          "Service actor token is only accepted on scoped producer routes.",
      };
    }

    const actor = buildActor({
      actorType: "service",
      actorId:
        normalizeValue(env[CONTROL_PLANE_SERVICE_ID_ENV_KEY]) ??
        "service-producer",
      role: "service",
      env,
    });
    return {
      allowed: true,
      actor,
      requestHeaders: actorHeaders(actor, "token"),
      authBoundary: "token",
    };
  }

  return {
    allowed: false,
    status: 403,
    code: "invalid_actor",
    detail: "Control-plane actor credentials are invalid.",
  };
}
