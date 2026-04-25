export const WORKSPACE_LAUNCH_API_BASE_PATH = "/api/control/execution/workspace";

export const WORKSPACE_LAUNCH_API_ROUTES = {
  bootstrap: "bootstrap",
  launchToken: "launch-token",
  runtime: "runtime",
  session: "session",
  sessionBearer: "session-bearer",
} as const;

export type WorkspaceLaunchApiRouteKey = keyof typeof WORKSPACE_LAUNCH_API_ROUTES;
export type WorkspaceLaunchApiRouteSegment =
  (typeof WORKSPACE_LAUNCH_API_ROUTES)[WorkspaceLaunchApiRouteKey];

export interface WorkspaceLaunchApiRouteParams {
  sessionId?: string | null;
  route: WorkspaceLaunchApiRouteKey;
}

function normalizeRouteValue(value: string | null | undefined) {
  return (value || "").trim();
}

export function buildWorkspaceLaunchApiPath({
  sessionId,
  route,
}: WorkspaceLaunchApiRouteParams) {
  const normalizedSessionId = normalizeRouteValue(sessionId);
  if (!normalizedSessionId) {
    return null;
  }

  return `${WORKSPACE_LAUNCH_API_BASE_PATH}/${encodeURIComponent(
    normalizedSessionId
  )}/${WORKSPACE_LAUNCH_API_ROUTES[route]}`;
}

export function buildWorkspaceLaunchApiUrl(
  origin: string | null | undefined,
  params: WorkspaceLaunchApiRouteParams
) {
  const normalizedOrigin = normalizeRouteValue(origin);
  const path = buildWorkspaceLaunchApiPath(params);
  if (!normalizedOrigin || !path) {
    return null;
  }

  return new URL(path, normalizedOrigin).toString();
}

export const buildWorkspaceLaunchBootstrapPath = (sessionId?: string | null) =>
  buildWorkspaceLaunchApiPath({ sessionId, route: "bootstrap" });

export const buildWorkspaceLaunchBootstrapUrl = (
  origin: string | null | undefined,
  sessionId?: string | null
) => buildWorkspaceLaunchApiUrl(origin, { sessionId, route: "bootstrap" });

export const buildWorkspaceLaunchSessionPath = (sessionId?: string | null) =>
  buildWorkspaceLaunchApiPath({ sessionId, route: "session" });

export const buildWorkspaceLaunchSessionUrl = (
  origin: string | null | undefined,
  sessionId?: string | null
) => buildWorkspaceLaunchApiUrl(origin, { sessionId, route: "session" });

export const buildWorkspaceLaunchSessionBearerPath = (sessionId?: string | null) =>
  buildWorkspaceLaunchApiPath({ sessionId, route: "sessionBearer" });

export const buildWorkspaceLaunchTokenPath = (sessionId?: string | null) =>
  buildWorkspaceLaunchApiPath({ sessionId, route: "launchToken" });

export const buildWorkspaceLaunchTokenUrl = (
  origin: string | null | undefined,
  sessionId?: string | null
) => buildWorkspaceLaunchApiUrl(origin, { sessionId, route: "launchToken" });

export const buildWorkspaceLaunchLaunchTokenPath = buildWorkspaceLaunchTokenPath;

export const buildWorkspaceLaunchRuntimePath = (sessionId?: string | null) =>
  buildWorkspaceLaunchApiPath({ sessionId, route: "runtime" });
