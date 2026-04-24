import {
  DEFAULT_LOCAL_WORK_UI_BASE_URL,
  WORK_UI_BASE_URL_ENV_KEYS,
} from "../contracts/workspace-launch";

type EnvLike = Record<string, string | undefined>;

export type FounderOsDeploymentEnv = "local" | "staging" | "production";

export const DEPLOYMENT_ENV_KEY = "FOUNDEROS_DEPLOYMENT_ENV";
export const STRICT_ROLLOUT_ENV_KEY = "FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV";
export const CANONICAL_WORK_UI_BASE_URL_ENV_KEY = "FOUNDEROS_WORK_UI_BASE_URL";
export const CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY =
  "FOUNDEROS_SHELL_PUBLIC_ORIGIN";
export const EXECUTION_KERNEL_BASE_URL_ENV_KEY =
  "FOUNDEROS_EXECUTION_KERNEL_BASE_URL";
export const EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY =
  "FOUNDEROS_EXECUTION_KERNEL_SERVICE_AUTH_SECRET";
export const PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY =
  "FOUNDEROS_PRIVILEGED_API_ALLOWED_ORIGINS";
export const CONTROL_PLANE_DATABASE_URL_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_DATABASE_URL";
export const EXECUTION_HANDOFF_DATABASE_URL_ENV_KEY =
  "FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL";
export const CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_OPERATOR_TOKEN";
export const CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_SERVICE_TOKEN";
export const WORKSPACE_LAUNCH_SECRET_ENV_KEY =
  "FOUNDEROS_WORKSPACE_LAUNCH_SECRET";
export const LEGACY_CONTROL_PLANE_SECRET_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_SECRET";
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

const FULL_DEPLOYMENT_ENV_KEYS = [
  CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
  CANONICAL_WORK_UI_BASE_URL_ENV_KEY,
  EXECUTION_KERNEL_BASE_URL_ENV_KEY,
  EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
  PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY,
  WORKSPACE_LAUNCH_SECRET_ENV_KEY,
  WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
  WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
  CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
  CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
] as const;

function normalizeEnvValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeDeploymentEnv(
  value: string | null | undefined,
): FounderOsDeploymentEnv {
  const normalized = normalizeEnvValue(value)?.toLowerCase();
  if (!normalized) {
    return "local";
  }
  if (
    normalized === "local" ||
    normalized === "staging" ||
    normalized === "production"
  ) {
    return normalized;
  }
  throw new Error(
    `FounderOS deployment configuration error: ${DEPLOYMENT_ENV_KEY} must be one of local, staging, or production.`,
  );
}

function buildMissingEnvError(message: string) {
  return new Error(`FounderOS strict rollout configuration error: ${message}`);
}

function buildDeploymentEnvError(message: string) {
  return new Error(`FounderOS deployment configuration error: ${message}`);
}

export function isStrictRolloutEnv(env: EnvLike = process.env) {
  return normalizeEnvValue(env[STRICT_ROLLOUT_ENV_KEY]) === "1";
}

export function resolveFounderOsDeploymentEnv(
  env: EnvLike = process.env,
): FounderOsDeploymentEnv {
  return normalizeDeploymentEnv(env[DEPLOYMENT_ENV_KEY]);
}

export function isProductionDeploymentEnv(env: EnvLike = process.env) {
  return resolveFounderOsDeploymentEnv(env) === "production";
}

export function requiresFullDeploymentEnv(env: EnvLike = process.env) {
  const deploymentEnv = resolveFounderOsDeploymentEnv(env);
  return deploymentEnv === "production" || deploymentEnv === "staging";
}

function hasAnyConfiguredDatabaseUrl(env: EnvLike) {
  return Boolean(
    normalizeEnvValue(env[CONTROL_PLANE_DATABASE_URL_ENV_KEY]) ||
    normalizeEnvValue(env[EXECUTION_HANDOFF_DATABASE_URL_ENV_KEY]),
  );
}

function isLocalOnlyUrl(value: string | null | undefined) {
  const normalized = normalizeEnvValue(value);
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

function parseAllowedOrigins(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function findProductionLocalOnlyEnvKeys(env: EnvLike) {
  const localOnlyKeys = new Set<string>();

  for (const key of [
    CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
    CANONICAL_WORK_UI_BASE_URL_ENV_KEY,
    EXECUTION_KERNEL_BASE_URL_ENV_KEY,
  ] as const) {
    if (isLocalOnlyUrl(env[key])) {
      localOnlyKeys.add(key);
    }
  }

  for (const origin of parseAllowedOrigins(
    env[PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY],
  )) {
    if (isLocalOnlyUrl(origin)) {
      localOnlyKeys.add(PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY);
      break;
    }
  }

  return [...localOnlyKeys];
}

export function buildDeploymentEnvDiagnostics(env: EnvLike = process.env) {
  const deploymentEnv = resolveFounderOsDeploymentEnv(env);
  const strictEnv = isStrictRolloutEnv(env);
  const missingEnvKeys: string[] = [];
  const localOnlyEnvKeys: string[] =
    deploymentEnv === "production" ? findProductionLocalOnlyEnvKeys(env) : [];

  if (deploymentEnv === "production" && !strictEnv) {
    missingEnvKeys.push(STRICT_ROLLOUT_ENV_KEY);
  }

  if (deploymentEnv === "production" || deploymentEnv === "staging") {
    for (const key of FULL_DEPLOYMENT_ENV_KEYS) {
      if (!normalizeEnvValue(env[key])) {
        missingEnvKeys.push(key);
      }
    }

    if (!hasAnyConfiguredDatabaseUrl(env)) {
      missingEnvKeys.push(CONTROL_PLANE_DATABASE_URL_ENV_KEY);
    }
  }

  const configuredEnvKeys = [
    DEPLOYMENT_ENV_KEY,
    STRICT_ROLLOUT_ENV_KEY,
    CONTROL_PLANE_DATABASE_URL_ENV_KEY,
    EXECUTION_HANDOFF_DATABASE_URL_ENV_KEY,
    ...FULL_DEPLOYMENT_ENV_KEYS,
  ].filter((key, index, keys) => {
    return keys.indexOf(key) === index && Boolean(normalizeEnvValue(env[key]));
  });

  return {
    deploymentEnv,
    deploymentEnvConfigured: Boolean(
      normalizeEnvValue(env[DEPLOYMENT_ENV_KEY]),
    ),
    strictEnv,
    requiresFullEnv:
      deploymentEnv === "production" || deploymentEnv === "staging",
    ready: missingEnvKeys.length === 0 && localOnlyEnvKeys.length === 0,
    missingEnvKeys,
    localOnlyEnvKeys,
    configuredEnvKeys,
    secretEnvKeys: [
      WORKSPACE_LAUNCH_SECRET_ENV_KEY,
      WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
      WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
      CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
      CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
      EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
    ].filter((key) => Boolean(normalizeEnvValue(env[key]))),
    notes: [
      deploymentEnv === "local"
        ? "Local deployment mode allows explicit localhost defaults."
        : "Production-like deployment mode requires explicit durable state, origins, kernel, and workspace secrets.",
      ...(deploymentEnv === "production"
        ? [
            "Production deployment mode rejects local-only origins and requires the strict rollout opt-in flag.",
          ]
        : deploymentEnv === "staging"
          ? [
              "Staging deployment mode requires the full env set but does not reject localhost origins.",
            ]
          : []),
    ],
  };
}

export function assertDeploymentEnvReady(env: EnvLike = process.env) {
  const diagnostics = buildDeploymentEnvDiagnostics(env);
  if (diagnostics.ready) {
    return diagnostics;
  }

  const missing = diagnostics.missingEnvKeys.length
    ? `missing env: ${diagnostics.missingEnvKeys.join(", ")}`
    : null;
  const localOnly = diagnostics.localOnlyEnvKeys.length
    ? `local-only production origins: ${diagnostics.localOnlyEnvKeys.join(", ")}`
    : null;
  throw buildDeploymentEnvError(
    [
      `${DEPLOYMENT_ENV_KEY}=${diagnostics.deploymentEnv} is not boot-ready.`,
      missing,
      localOnly,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function resolveLocalWorkUiBaseUrl(env: EnvLike = process.env) {
  const host = normalizeEnvValue(env.WORK_UI_HOST) ?? "127.0.0.1";
  const port =
    normalizeEnvValue(env.WORK_UI_PORT) ??
    normalizeEnvValue(env.VITE_PORT) ??
    "3101";
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
      `${CANONICAL_WORK_UI_BASE_URL_ENV_KEY} is required when ${STRICT_ROLLOUT_ENV_KEY}=1.`,
    );
  }

  if (requiresFullDeploymentEnv(env)) {
    throw buildDeploymentEnvError(
      `${CANONICAL_WORK_UI_BASE_URL_ENV_KEY} is required when ${DEPLOYMENT_ENV_KEY}=${resolveFounderOsDeploymentEnv(env)}.`,
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
      `${CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY} is required when ${STRICT_ROLLOUT_ENV_KEY}=1.`,
    );
  }

  if (requiresFullDeploymentEnv(env)) {
    throw buildDeploymentEnvError(
      `${CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY} is required when ${DEPLOYMENT_ENV_KEY}=${resolveFounderOsDeploymentEnv(env)}.`,
    );
  }

  const host = normalizeEnvValue(env.FOUNDEROS_WEB_HOST) ?? "127.0.0.1";
  const port = normalizeEnvValue(env.FOUNDEROS_WEB_PORT) ?? "3737";
  return `http://${host}:${port}`;
}

export function resolveWorkspaceLaunchSecret(env: EnvLike = process.env) {
  const canonicalSecret = normalizeEnvValue(
    env[WORKSPACE_LAUNCH_SECRET_ENV_KEY],
  );
  if (canonicalSecret) {
    return canonicalSecret;
  }

  if (requiresFullDeploymentEnv(env)) {
    throw buildDeploymentEnvError(
      `${WORKSPACE_LAUNCH_SECRET_ENV_KEY} is required when ${DEPLOYMENT_ENV_KEY}=${resolveFounderOsDeploymentEnv(env)}. ${LEGACY_CONTROL_PLANE_SECRET_ENV_KEY} is not accepted for production-like deployment modes.`,
    );
  }

  const legacySecret = normalizeEnvValue(
    env[LEGACY_CONTROL_PLANE_SECRET_ENV_KEY],
  );
  if (legacySecret) {
    return legacySecret;
  }

  if (isStrictRolloutEnv(env)) {
    throw buildMissingEnvError(
      `${WORKSPACE_LAUNCH_SECRET_ENV_KEY} is required when ${STRICT_ROLLOUT_ENV_KEY}=1. ${LEGACY_CONTROL_PLANE_SECRET_ENV_KEY} remains a compatibility alias only.`,
    );
  }

  return null;
}

export function resolveWorkspaceSessionBearerToken(env: EnvLike = process.env) {
  const canonicalToken = normalizeEnvValue(
    env[WORKSPACE_SESSION_BEARER_TOKEN_ENV_KEY],
  );
  if (canonicalToken) {
    return canonicalToken;
  }

  const legacyToken = normalizeEnvValue(
    env[WORKSPACE_BOOTSTRAP_BEARER_TOKEN_ENV_KEY],
  );
  if (legacyToken) {
    return legacyToken;
  }

  return null;
}

export function resolveWorkspaceBootstrapBearerToken(
  env: EnvLike = process.env,
) {
  return resolveWorkspaceSessionBearerToken(env);
}

export function resolveWorkspaceSessionGrantSecret(env: EnvLike = process.env) {
  const configuredSecret = normalizeEnvValue(
    env[WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY],
  );
  if (configuredSecret) {
    return configuredSecret;
  }

  if (requiresFullDeploymentEnv(env)) {
    throw buildDeploymentEnvError(
      `${WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY} is required when ${DEPLOYMENT_ENV_KEY}=${resolveFounderOsDeploymentEnv(env)}.`,
    );
  }

  return resolveWorkspaceLaunchSecret(env);
}

export function resolveWorkspaceSessionTokenSecret(env: EnvLike = process.env) {
  const configuredSecret = normalizeEnvValue(
    env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY],
  );
  if (configuredSecret) {
    return configuredSecret;
  }

  if (requiresFullDeploymentEnv(env)) {
    throw buildDeploymentEnvError(
      `${WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY} is required when ${DEPLOYMENT_ENV_KEY}=${resolveFounderOsDeploymentEnv(env)}.`,
    );
  }

  return resolveWorkspaceLaunchSecret(env);
}

export function resolveWorkspaceSessionTokenSecretEnvKey(
  env: EnvLike = process.env,
) {
  if (normalizeEnvValue(env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY])) {
    return WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY;
  }

  if (requiresFullDeploymentEnv(env)) {
    return null;
  }

  if (normalizeEnvValue(env[WORKSPACE_LAUNCH_SECRET_ENV_KEY])) {
    return WORKSPACE_LAUNCH_SECRET_ENV_KEY;
  }

  if (normalizeEnvValue(env[LEGACY_CONTROL_PLANE_SECRET_ENV_KEY])) {
    return LEGACY_CONTROL_PLANE_SECRET_ENV_KEY;
  }

  return null;
}
