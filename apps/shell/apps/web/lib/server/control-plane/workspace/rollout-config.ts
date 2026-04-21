import {
  DEFAULT_LOCAL_WORK_UI_BASE_URL,
  WORK_UI_BASE_URL_ENV_KEYS,
} from "../contracts/workspace-launch";

type EnvLike = Record<string, string | undefined>;

export const STRICT_ROLLOUT_ENV_KEY = "FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV";
export const CANONICAL_WORK_UI_BASE_URL_ENV_KEY = "FOUNDEROS_WORK_UI_BASE_URL";
export const CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY =
  "FOUNDEROS_SHELL_PUBLIC_ORIGIN";
export const WORKSPACE_LAUNCH_SECRET_ENV_KEY = "FOUNDEROS_WORKSPACE_LAUNCH_SECRET";
export const LEGACY_CONTROL_PLANE_SECRET_ENV_KEY = "FOUNDEROS_CONTROL_PLANE_SECRET";
export const WORKSPACE_SESSION_BEARER_TOKEN_ENV_KEY =
  "FOUNDEROS_WORKSPACE_SESSION_BEARER_TOKEN";
export const WORKSPACE_BOOTSTRAP_BEARER_TOKEN_ENV_KEY =
  "FOUNDEROS_WORKSPACE_BOOTSTRAP_BEARER_TOKEN";
export const WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY =
  "FOUNDEROS_WORKSPACE_SESSION_GRANT_SECRET";
export const WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY =
  "FOUNDEROS_WORKSPACE_SESSION_TOKEN_SECRET";

const SHELL_PUBLIC_ORIGIN_ENV_KEYS = [
  CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
  "FOUNDEROS_WEB_PUBLIC_ORIGIN",
  "NEXT_PUBLIC_FOUNDEROS_SHELL_PUBLIC_ORIGIN",
  "NEXT_PUBLIC_FOUNDEROS_WEB_PUBLIC_ORIGIN",
] as const;

function normalizeEnvValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildMissingEnvError(message: string) {
  return new Error(`FounderOS strict rollout configuration error: ${message}`);
}

export function isStrictRolloutEnv(env: EnvLike = process.env) {
  return normalizeEnvValue(env[STRICT_ROLLOUT_ENV_KEY]) === "1";
}

export function resolveLocalWorkUiBaseUrl(env: EnvLike = process.env) {
  const host = normalizeEnvValue(env.WORK_UI_HOST) ?? "127.0.0.1";
  const port =
    normalizeEnvValue(env.WORK_UI_PORT) ??
    normalizeEnvValue(env.VITE_PORT) ??
    "5173";
  return `http://${host}:${port}`;
}

export function resolveWorkUiBaseUrlForLaunch(env: EnvLike = process.env) {
  for (const key of WORK_UI_BASE_URL_ENV_KEYS) {
    const value = normalizeEnvValue(env[key]);
    if (value) {
      return value;
    }
  }

  if (isStrictRolloutEnv(env)) {
    throw buildMissingEnvError(
      `${CANONICAL_WORK_UI_BASE_URL_ENV_KEY} is required when ${STRICT_ROLLOUT_ENV_KEY}=1.`
    );
  }

  return resolveLocalWorkUiBaseUrl(env) || DEFAULT_LOCAL_WORK_UI_BASE_URL;
}

export function resolveShellPublicOriginForLaunch(env: EnvLike = process.env) {
  for (const key of SHELL_PUBLIC_ORIGIN_ENV_KEYS) {
    const value = normalizeEnvValue(env[key]);
    if (value) {
      return value;
    }
  }

  if (isStrictRolloutEnv(env)) {
    throw buildMissingEnvError(
      `${CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY} is required when ${STRICT_ROLLOUT_ENV_KEY}=1.`
    );
  }

  const host = normalizeEnvValue(env.FOUNDEROS_WEB_HOST) ?? "127.0.0.1";
  const port = normalizeEnvValue(env.FOUNDEROS_WEB_PORT) ?? "3737";
  return `http://${host}:${port}`;
}

export function resolveWorkspaceLaunchSecret(env: EnvLike = process.env) {
  const canonicalSecret = normalizeEnvValue(env[WORKSPACE_LAUNCH_SECRET_ENV_KEY]);
  if (canonicalSecret) {
    return canonicalSecret;
  }

  const legacySecret = normalizeEnvValue(env[LEGACY_CONTROL_PLANE_SECRET_ENV_KEY]);
  if (legacySecret) {
    return legacySecret;
  }

  if (isStrictRolloutEnv(env)) {
    throw buildMissingEnvError(
      `${WORKSPACE_LAUNCH_SECRET_ENV_KEY} is required when ${STRICT_ROLLOUT_ENV_KEY}=1. ${LEGACY_CONTROL_PLANE_SECRET_ENV_KEY} remains a compatibility alias only.`
    );
  }

  return null;
}

export function resolveWorkspaceSessionBearerToken(env: EnvLike = process.env) {
  const canonicalToken = normalizeEnvValue(
    env[WORKSPACE_SESSION_BEARER_TOKEN_ENV_KEY]
  );
  if (canonicalToken) {
    return canonicalToken;
  }

  const legacyToken = normalizeEnvValue(
    env[WORKSPACE_BOOTSTRAP_BEARER_TOKEN_ENV_KEY]
  );
  if (legacyToken) {
    return legacyToken;
  }

  return null;
}

export function resolveWorkspaceBootstrapBearerToken(
  env: EnvLike = process.env
) {
  return resolveWorkspaceSessionBearerToken(env);
}

export function resolveWorkspaceSessionGrantSecret(env: EnvLike = process.env) {
  const configuredSecret = normalizeEnvValue(
    env[WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY]
  );
  if (configuredSecret) {
    return configuredSecret;
  }

  return resolveWorkspaceLaunchSecret(env);
}

export function resolveWorkspaceSessionTokenSecret(env: EnvLike = process.env) {
  const configuredSecret = normalizeEnvValue(
    env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY]
  );
  if (configuredSecret) {
    return configuredSecret;
  }

  return resolveWorkspaceLaunchSecret(env);
}

export function resolveWorkspaceSessionTokenSecretEnvKey(
  env: EnvLike = process.env
) {
  if (normalizeEnvValue(env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY])) {
    return WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY;
  }

  if (normalizeEnvValue(env[WORKSPACE_LAUNCH_SECRET_ENV_KEY])) {
    return WORKSPACE_LAUNCH_SECRET_ENV_KEY;
  }

  if (normalizeEnvValue(env[LEGACY_CONTROL_PLANE_SECRET_ENV_KEY])) {
    return LEGACY_CONTROL_PLANE_SECRET_ENV_KEY;
  }

  return null;
}
