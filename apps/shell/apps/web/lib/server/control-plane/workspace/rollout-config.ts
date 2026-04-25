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
export const ARTIFACT_STORE_MODE_ENV_KEY = "FOUNDEROS_ARTIFACT_STORE_MODE";
export const ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY =
  "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX";
export const ARTIFACT_SIGNED_URL_BASE_ENV_KEY =
  "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE";
export const ARTIFACT_SIGNING_SECRET_ENV_KEY =
  "FOUNDEROS_ARTIFACT_SIGNING_SECRET";
export const ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY =
  "FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT";
export const ARTIFACT_OBJECT_BACKEND_ENV_KEY =
  "FOUNDEROS_ARTIFACT_OBJECT_BACKEND";
export const VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY = "BLOB_READ_WRITE_TOKEN";
export const FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY =
  "FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN";
export const SECRETS_MANAGER_ENV_KEY = "FOUNDEROS_SECRETS_MANAGER";
export const EXTERNAL_DELIVERY_MODE_ENV_KEY =
  "FOUNDEROS_EXTERNAL_DELIVERY_MODE";
export const GITHUB_TOKEN_ENV_KEY = "FOUNDEROS_GITHUB_TOKEN";
export const GITHUB_REPOSITORY_ENV_KEY = "FOUNDEROS_GITHUB_REPOSITORY";
export const GITHUB_BASE_BRANCH_ENV_KEY = "FOUNDEROS_GITHUB_BASE_BRANCH";
export const VERCEL_TOKEN_ENV_KEY = "FOUNDEROS_VERCEL_TOKEN";
export const VERCEL_PROJECT_ID_ENV_KEY = "FOUNDEROS_VERCEL_PROJECT_ID";
export const VERCEL_GIT_REPO_ID_ENV_KEY = "FOUNDEROS_VERCEL_GIT_REPO_ID";
export const VERCEL_TEAM_ID_ENV_KEY = "FOUNDEROS_VERCEL_TEAM_ID";
export const VERCEL_TEAM_SLUG_ENV_KEY = "FOUNDEROS_VERCEL_TEAM_SLUG";
export const VERCEL_PROTECTION_BYPASS_SECRET_ENV_KEY =
  "FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET";

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
  ARTIFACT_STORE_MODE_ENV_KEY,
  ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY,
  ARTIFACT_SIGNED_URL_BASE_ENV_KEY,
  ARTIFACT_SIGNING_SECRET_ENV_KEY,
  EXTERNAL_DELIVERY_MODE_ENV_KEY,
] as const;

const GITHUB_VERCEL_DELIVERY_ENV_KEYS = [
  GITHUB_TOKEN_ENV_KEY,
  GITHUB_REPOSITORY_ENV_KEY,
  GITHUB_BASE_BRANCH_ENV_KEY,
  VERCEL_TOKEN_ENV_KEY,
  VERCEL_PROJECT_ID_ENV_KEY,
  VERCEL_GIT_REPO_ID_ENV_KEY,
] as const;

const SUPPORTED_SECRETS_MANAGERS = [
  "vercel",
  "aws_secrets_manager",
  "gcp_secret_manager",
  "doppler",
  "onepassword",
  "vault",
  "infisical",
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

function parseHttpUrl(value: string | null | undefined) {
  const normalized = normalizeEnvValue(value);
  if (!normalized) {
    return null;
  }
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [first, second] = parts;
  if (first === 10) {
    return true;
  }
  if (first === 172 && second !== undefined && second >= 16 && second <= 31) {
    return true;
  }
  return first === 192 && second === 168;
}

function isPrivateServiceHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    isPrivateIpv4(normalized) ||
    normalized.endsWith(".internal") ||
    normalized.includes(".internal.") ||
    normalized.endsWith(".private") ||
    normalized.includes(".private.") ||
    normalized.endsWith(".svc") ||
    normalized.includes(".svc.") ||
    normalized.endsWith(".cluster.local")
  );
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

function artifactPrefixInvalidForMode(
  mode: string,
  prefix: string,
  artifactObjectBackend?: string | null,
) {
  if (
    prefix.startsWith("/") ||
    prefix.startsWith("file://") ||
    prefix.includes("/Users/")
  ) {
    return true;
  }
  if (isLocalOnlyUrl(prefix)) {
    return true;
  }
  if (mode === "s3") {
    return !prefix.startsWith("s3://");
  }
  if (mode === "gcs") {
    return !prefix.startsWith("gs://");
  }
  if (mode === "r2") {
    return !prefix.startsWith("r2://");
  }
  if (mode === "object") {
    return !(
      prefix.startsWith("object://") ||
      (artifactObjectBackend === "vercel_blob" &&
        prefix.startsWith("vercel-blob://")) ||
      prefix.startsWith("https://")
    );
  }
  return true;
}

function artifactMirrorRootInvalidForProductionLike(value: string) {
  const normalized = value.trim().replace(/\/+$/, "");
  return (
    normalized.includes("/Users/") ||
    normalized === "/tmp" ||
    normalized.startsWith("/tmp/") ||
    normalized === "/private/tmp" ||
    normalized.startsWith("/private/tmp/") ||
    normalized === "/var/tmp" ||
    normalized.startsWith("/var/tmp/") ||
    normalized.startsWith("/var/folders/")
  );
}

function findInvalidArtifactEnvKeys(env: EnvLike) {
  const invalidKeys = new Set<string>();
  const deploymentEnv = resolveFounderOsDeploymentEnv(env);
  const mode = normalizeEnvValue(env[ARTIFACT_STORE_MODE_ENV_KEY])?.toLowerCase();
  const prefix = normalizeEnvValue(env[ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY]);
  const signedUrlBase = normalizeEnvValue(env[ARTIFACT_SIGNED_URL_BASE_ENV_KEY]);
  const mirrorRoot = normalizeEnvValue(env[ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY]);
  const artifactObjectBackend = normalizeEnvValue(
    env[ARTIFACT_OBJECT_BACKEND_ENV_KEY],
  )?.toLowerCase();
  const externalDeliveryMode = normalizeEnvValue(
    env[EXTERNAL_DELIVERY_MODE_ENV_KEY],
  )?.toLowerCase();

  if (
    mode &&
    mode !== "local" &&
    mode !== "s3" &&
    mode !== "gcs" &&
    mode !== "r2" &&
    mode !== "object"
  ) {
    invalidKeys.add(ARTIFACT_STORE_MODE_ENV_KEY);
  }
  if ((deploymentEnv === "production" || deploymentEnv === "staging") && mode === "local") {
    invalidKeys.add(ARTIFACT_STORE_MODE_ENV_KEY);
  }
  if (
    mode &&
    prefix &&
    artifactPrefixInvalidForMode(mode, prefix, artifactObjectBackend)
  ) {
    invalidKeys.add(ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY);
  }
  if (
    artifactObjectBackend &&
    artifactObjectBackend !== "vercel_blob"
  ) {
    invalidKeys.add(ARTIFACT_OBJECT_BACKEND_ENV_KEY);
  }
  if (artifactObjectBackend === "vercel_blob" && mode !== "object") {
    invalidKeys.add(ARTIFACT_STORE_MODE_ENV_KEY);
  }
  if (signedUrlBase) {
    try {
      const parsed = new URL(signedUrlBase);
      if (
        parsed.protocol === "file:" ||
        isLocalOnlyUrl(signedUrlBase) ||
        ((deploymentEnv === "production" || deploymentEnv === "staging") &&
          parsed.protocol !== "https:")
      ) {
        invalidKeys.add(ARTIFACT_SIGNED_URL_BASE_ENV_KEY);
      }
    } catch {
      invalidKeys.add(ARTIFACT_SIGNED_URL_BASE_ENV_KEY);
    }
  }
  if (
    (deploymentEnv === "production" || deploymentEnv === "staging") &&
    artifactObjectBackend !== "vercel_blob" &&
    mirrorRoot &&
    artifactMirrorRootInvalidForProductionLike(mirrorRoot)
  ) {
    invalidKeys.add(ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY);
  }
  if (
    externalDeliveryMode &&
    externalDeliveryMode !== "disabled" &&
    externalDeliveryMode !== "mock" &&
    externalDeliveryMode !== "github_vercel"
  ) {
    invalidKeys.add(EXTERNAL_DELIVERY_MODE_ENV_KEY);
  }
  if (
    (deploymentEnv === "production" || deploymentEnv === "staging") &&
    externalDeliveryMode === "mock"
  ) {
    invalidKeys.add(EXTERNAL_DELIVERY_MODE_ENV_KEY);
  }
  if (
    (deploymentEnv === "production" || deploymentEnv === "staging") &&
    externalDeliveryMode === "disabled"
  ) {
    invalidKeys.add(EXTERNAL_DELIVERY_MODE_ENV_KEY);
  }

  return [...invalidKeys];
}

export function buildDeploymentEnvDiagnostics(env: EnvLike = process.env) {
  const deploymentEnv = resolveFounderOsDeploymentEnv(env);
  const strictEnv = isStrictRolloutEnv(env);
  const missingEnvKeys: string[] = [];
  const localOnlyEnvKeys: string[] =
    deploymentEnv === "production" ? findProductionLocalOnlyEnvKeys(env) : [];
  const invalidEnvKeys = findInvalidArtifactEnvKeys(env);

  if (deploymentEnv === "production" && !strictEnv) {
    missingEnvKeys.push(STRICT_ROLLOUT_ENV_KEY);
  }

  if (deploymentEnv === "production" || deploymentEnv === "staging") {
    for (const key of FULL_DEPLOYMENT_ENV_KEYS) {
      if (!normalizeEnvValue(env[key])) {
        missingEnvKeys.push(key);
      }
    }
    const externalDeliveryMode = normalizeEnvValue(
      env[EXTERNAL_DELIVERY_MODE_ENV_KEY],
    )?.toLowerCase();
    if (externalDeliveryMode === "github_vercel") {
      for (const key of GITHUB_VERCEL_DELIVERY_ENV_KEYS) {
        if (!normalizeEnvValue(env[key])) {
          missingEnvKeys.push(key);
        }
      }
    }
    const artifactObjectBackend = normalizeEnvValue(
      env[ARTIFACT_OBJECT_BACKEND_ENV_KEY],
    )?.toLowerCase();
    if (artifactObjectBackend === "vercel_blob") {
      if (
        !normalizeEnvValue(env[VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY]) &&
        !normalizeEnvValue(env[FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY])
      ) {
        missingEnvKeys.push(VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY);
      }
    } else if (!normalizeEnvValue(env[ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY])) {
      missingEnvKeys.push(ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY);
    }

    if (!hasAnyConfiguredDatabaseUrl(env)) {
      missingEnvKeys.push(CONTROL_PLANE_DATABASE_URL_ENV_KEY);
    }
  }

  const configuredEnvKeys = [
    DEPLOYMENT_ENV_KEY,
    STRICT_ROLLOUT_ENV_KEY,
    EXTERNAL_DELIVERY_MODE_ENV_KEY,
    CONTROL_PLANE_DATABASE_URL_ENV_KEY,
    EXECUTION_HANDOFF_DATABASE_URL_ENV_KEY,
    ...FULL_DEPLOYMENT_ENV_KEYS,
    ARTIFACT_OBJECT_BACKEND_ENV_KEY,
    ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY,
    VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY,
    FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY,
    ...GITHUB_VERCEL_DELIVERY_ENV_KEYS,
    VERCEL_TEAM_ID_ENV_KEY,
    VERCEL_TEAM_SLUG_ENV_KEY,
    VERCEL_PROTECTION_BYPASS_SECRET_ENV_KEY,
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
    ready:
      missingEnvKeys.length === 0 &&
      localOnlyEnvKeys.length === 0 &&
      invalidEnvKeys.length === 0,
    missingEnvKeys,
    localOnlyEnvKeys,
    invalidEnvKeys,
    configuredEnvKeys,
    secretEnvKeys: [
      WORKSPACE_LAUNCH_SECRET_ENV_KEY,
      WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
      WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
      CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
      CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
      ARTIFACT_SIGNING_SECRET_ENV_KEY,
      GITHUB_TOKEN_ENV_KEY,
      VERCEL_TOKEN_ENV_KEY,
      VERCEL_PROTECTION_BYPASS_SECRET_ENV_KEY,
      VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY,
      FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY,
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

export function buildStagingTopologyDiagnostics(env: EnvLike = process.env) {
  const deploymentDiagnostics = buildDeploymentEnvDiagnostics(env);
  const missingEnvKeys = new Set(deploymentDiagnostics.missingEnvKeys);
  const invalidEnvKeys = new Set(deploymentDiagnostics.invalidEnvKeys);
  const deploymentEnv = deploymentDiagnostics.deploymentEnv;

  if (deploymentEnv !== "staging") {
    invalidEnvKeys.add(DEPLOYMENT_ENV_KEY);
  }

  const shellPublicOrigin = parseHttpUrl(
    env[CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY],
  );
  const workUiBaseUrl = parseHttpUrl(env[CANONICAL_WORK_UI_BASE_URL_ENV_KEY]);
  const executionKernelBaseUrl = parseHttpUrl(
    env[EXECUTION_KERNEL_BASE_URL_ENV_KEY],
  );
  const allowedOrigins = parseAllowedOrigins(
    env[PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY],
  )
    .map((origin) => parseHttpUrl(origin)?.origin)
    .filter((origin): origin is string => Boolean(origin));

  const shellReady =
    shellPublicOrigin?.protocol === "https:" &&
    !isLocalOnlyUrl(shellPublicOrigin.toString());
  if (!shellReady && normalizeEnvValue(env[CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY])) {
    invalidEnvKeys.add(CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY);
  }

  const workUiSeparate =
    Boolean(shellPublicOrigin && workUiBaseUrl) &&
    shellPublicOrigin?.origin !== workUiBaseUrl?.origin;
  const workUiReady =
    workUiBaseUrl?.protocol === "https:" &&
    !isLocalOnlyUrl(workUiBaseUrl.toString()) &&
    workUiSeparate;
  if (!workUiReady && normalizeEnvValue(env[CANONICAL_WORK_UI_BASE_URL_ENV_KEY])) {
    invalidEnvKeys.add(CANONICAL_WORK_UI_BASE_URL_ENV_KEY);
  }

  const kernelHost = executionKernelBaseUrl?.hostname.toLowerCase() ?? null;
  const kernelOrigin = executionKernelBaseUrl?.origin ?? null;
  const kernelPrivate =
    Boolean(kernelHost) &&
    isPrivateServiceHostname(kernelHost ?? "") &&
    kernelOrigin !== shellPublicOrigin?.origin &&
    kernelOrigin !== workUiBaseUrl?.origin &&
    !allowedOrigins.includes(kernelOrigin ?? "");
  const kernelReady =
    Boolean(executionKernelBaseUrl) &&
    !isLocalOnlyUrl(executionKernelBaseUrl?.toString()) &&
    kernelPrivate;
  if (!kernelReady && normalizeEnvValue(env[EXECUTION_KERNEL_BASE_URL_ENV_KEY])) {
    invalidEnvKeys.add(EXECUTION_KERNEL_BASE_URL_ENV_KEY);
  }

  const databaseUrl =
    normalizeEnvValue(env[CONTROL_PLANE_DATABASE_URL_ENV_KEY]) ??
    normalizeEnvValue(env[EXECUTION_HANDOFF_DATABASE_URL_ENV_KEY]);
  const postgresReady =
    Boolean(databaseUrl) && /^postgres(?:ql)?:\/\//i.test(databaseUrl ?? "");
  if (databaseUrl && !postgresReady) {
    invalidEnvKeys.add(CONTROL_PLANE_DATABASE_URL_ENV_KEY);
  }

  const artifactKeys = [
    ARTIFACT_STORE_MODE_ENV_KEY,
    ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY,
    ARTIFACT_SIGNED_URL_BASE_ENV_KEY,
    ARTIFACT_SIGNING_SECRET_ENV_KEY,
    ARTIFACT_OBJECT_MIRROR_ROOT_ENV_KEY,
    ARTIFACT_OBJECT_BACKEND_ENV_KEY,
    VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY,
    FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY,
  ] as const;
  const objectStorageReady =
    !artifactKeys.some((key) => missingEnvKeys.has(key) || invalidEnvKeys.has(key)) &&
    normalizeEnvValue(env[ARTIFACT_STORE_MODE_ENV_KEY]) !== "local" &&
    Boolean(normalizeEnvValue(env[ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY])) &&
    Boolean(normalizeEnvValue(env[ARTIFACT_SIGNED_URL_BASE_ENV_KEY])) &&
    Boolean(normalizeEnvValue(env[ARTIFACT_SIGNING_SECRET_ENV_KEY]));

  const secretsManager = normalizeEnvValue(env[SECRETS_MANAGER_ENV_KEY])?.toLowerCase();
  if (!secretsManager) {
    missingEnvKeys.add(SECRETS_MANAGER_ENV_KEY);
  } else if (
    !SUPPORTED_SECRETS_MANAGERS.includes(
      secretsManager as (typeof SUPPORTED_SECRETS_MANAGERS)[number],
    )
  ) {
    invalidEnvKeys.add(SECRETS_MANAGER_ENV_KEY);
  }
  const secretsManagerReady =
    Boolean(secretsManager) && !invalidEnvKeys.has(SECRETS_MANAGER_ENV_KEY);

  const ready =
    deploymentEnv === "staging" &&
    shellReady &&
    workUiReady &&
    kernelReady &&
    postgresReady &&
    objectStorageReady &&
    secretsManagerReady &&
    missingEnvKeys.size === 0 &&
    invalidEnvKeys.size === 0;

  return {
    ready,
    deploymentEnv,
    components: {
      publicShell: {
        ready: shellReady,
        origin: shellPublicOrigin?.origin ?? null,
      },
      separateWorkUi: {
        ready: workUiReady,
        origin: workUiBaseUrl?.origin ?? null,
        separateFromShell: workUiSeparate,
      },
      privateKernel: {
        ready: kernelReady,
        host: kernelHost,
        privateEndpoint: kernelPrivate,
      },
      postgres: {
        ready: postgresReady,
        configured: Boolean(databaseUrl),
      },
      objectStorage: {
        ready: objectStorageReady,
        mode: normalizeEnvValue(env[ARTIFACT_STORE_MODE_ENV_KEY]) ?? null,
        backend: normalizeEnvValue(env[ARTIFACT_OBJECT_BACKEND_ENV_KEY]) ?? null,
      },
      secretsManager: {
        ready: secretsManagerReady,
        provider: secretsManager ?? null,
      },
    },
    missingEnvKeys: [...missingEnvKeys],
    invalidEnvKeys: [...invalidEnvKeys],
    notes: [
      "Staging topology must mirror production boundaries before production promotion.",
      "Shell and work-ui must be public HTTPS surfaces on separate origins.",
      "Execution kernel must remain a private service-to-service endpoint, not a browser CORS origin.",
      "Postgres, non-local object storage, and an explicit secrets manager provider are required.",
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
  const invalid = diagnostics.invalidEnvKeys.length
    ? `invalid env: ${diagnostics.invalidEnvKeys.join(", ")}`
    : null;
  throw buildDeploymentEnvError(
    [
      `${DEPLOYMENT_ENV_KEY}=${diagnostics.deploymentEnv} is not boot-ready.`,
      missing,
      localOnly,
      invalid,
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
