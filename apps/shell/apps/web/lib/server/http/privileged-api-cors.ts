const DEFAULT_SHELL_ORIGIN = "http://127.0.0.1:3737";
const DEFAULT_WORKSPACE_ORIGIN = "http://127.0.0.1:3101";

type EnvLike = Readonly<Record<string, string | undefined>>;

export const PRIVILEGED_API_ALLOW_METHODS = "GET,POST,PATCH,OPTIONS";
export const PRIVILEGED_API_ALLOW_HEADERS =
  "Content-Type, Authorization, X-Founderos-Workspace-Session-Grant";

function normalizeOrigin(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function expandLocalhostAliases(origin: string) {
  const parsed = new URL(origin);
  const variants = new Set([origin]);

  if (parsed.hostname === "127.0.0.1") {
    parsed.hostname = "localhost";
    variants.add(parsed.origin);
  } else if (parsed.hostname === "localhost") {
    parsed.hostname = "127.0.0.1";
    variants.add(parsed.origin);
  }

  return [...variants];
}

function addOrigin(target: Set<string>, value: string | null | undefined) {
  const origin = normalizeOrigin(value);
  if (!origin) {
    return;
  }

  for (const variant of expandLocalhostAliases(origin)) {
    target.add(variant);
  }
}

export function getPrivilegedApiAllowedOrigins(env: EnvLike = process.env) {
  const origins = new Set<string>();

  addOrigin(origins, DEFAULT_SHELL_ORIGIN);
  addOrigin(origins, DEFAULT_WORKSPACE_ORIGIN);
  addOrigin(origins, env.FOUNDEROS_SHELL_PUBLIC_ORIGIN);
  addOrigin(origins, env.FOUNDEROS_WORK_UI_BASE_URL);

  if (env.FOUNDEROS_WEB_HOST && env.FOUNDEROS_WEB_PORT) {
    addOrigin(origins, `http://${env.FOUNDEROS_WEB_HOST}:${env.FOUNDEROS_WEB_PORT}`);
  }
  if (env.WORK_UI_HOST && env.WORK_UI_PORT) {
    addOrigin(origins, `http://${env.WORK_UI_HOST}:${env.WORK_UI_PORT}`);
  }

  return origins;
}

export function isPrivilegedApiPath(pathname: string) {
  return (
    pathname === "/api/control" ||
    pathname.startsWith("/api/control/") ||
    pathname === "/api/shell" ||
    pathname.startsWith("/api/shell/")
  );
}

export function isAllowedPrivilegedApiOrigin(
  origin: string | null | undefined,
  env: EnvLike = process.env,
) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  return getPrivilegedApiAllowedOrigins(env).has(normalized);
}

export function buildPrivilegedApiCorsHeaders(
  origin: string | null | undefined,
  env: EnvLike = process.env,
) {
  const normalized = normalizeOrigin(origin);
  if (!normalized || !isAllowedPrivilegedApiOrigin(normalized, env)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": normalized,
    "Access-Control-Allow-Methods": PRIVILEGED_API_ALLOW_METHODS,
    "Access-Control-Allow-Headers": PRIVILEGED_API_ALLOW_HEADERS,
    Vary: "Origin",
  };
}

export function getPrivilegedApiCorsRejectionDetail() {
  return "Cross-origin access to privileged shell routes is only allowed for the local shell and workspace origins.";
}
