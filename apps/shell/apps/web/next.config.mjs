import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const DEPLOYMENT_ENV_KEY = "FOUNDEROS_DEPLOYMENT_ENV";
const STRICT_ROLLOUT_ENV_KEY = "FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV";
const CONTROL_PLANE_DATABASE_URL_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_DATABASE_URL";
const EXECUTION_HANDOFF_DATABASE_URL_ENV_KEY =
  "FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL";
const FULL_DEPLOYMENT_ENV_KEYS = [
  "FOUNDEROS_SHELL_PUBLIC_ORIGIN",
  "FOUNDEROS_WORK_UI_BASE_URL",
  "FOUNDEROS_EXECUTION_KERNEL_BASE_URL",
  "FOUNDEROS_EXECUTION_KERNEL_SERVICE_AUTH_SECRET",
  "FOUNDEROS_PRIVILEGED_API_ALLOWED_ORIGINS",
  "FOUNDEROS_WORKSPACE_LAUNCH_SECRET",
  "FOUNDEROS_WORKSPACE_SESSION_GRANT_SECRET",
  "FOUNDEROS_WORKSPACE_SESSION_TOKEN_SECRET",
  "FOUNDEROS_CONTROL_PLANE_OPERATOR_TOKEN",
  "FOUNDEROS_CONTROL_PLANE_SERVICE_TOKEN",
];

function normalizeEnvValue(value) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function resolveDeploymentEnv(env) {
  const normalized = normalizeEnvValue(env[DEPLOYMENT_ENV_KEY])?.toLowerCase();
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
    `${DEPLOYMENT_ENV_KEY} must be one of local, staging, or production.`,
  );
}

function isLocalOnlyUrl(value) {
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

function parseOrigins(value) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function assertBootDeploymentEnv(env) {
  const deploymentEnv = resolveDeploymentEnv(env);
  if (deploymentEnv === "local") {
    return;
  }

  const missing = FULL_DEPLOYMENT_ENV_KEYS.filter(
    (key) => !normalizeEnvValue(env[key]),
  );
  if (
    !normalizeEnvValue(env[CONTROL_PLANE_DATABASE_URL_ENV_KEY]) &&
    !normalizeEnvValue(env[EXECUTION_HANDOFF_DATABASE_URL_ENV_KEY])
  ) {
    missing.push(CONTROL_PLANE_DATABASE_URL_ENV_KEY);
  }
  if (
    deploymentEnv === "production" &&
    normalizeEnvValue(env[STRICT_ROLLOUT_ENV_KEY]) !== "1"
  ) {
    missing.push(STRICT_ROLLOUT_ENV_KEY);
  }

  const localOnlyKeys = [];
  if (deploymentEnv === "production") {
    for (const key of [
      "FOUNDEROS_SHELL_PUBLIC_ORIGIN",
      "FOUNDEROS_WORK_UI_BASE_URL",
      "FOUNDEROS_EXECUTION_KERNEL_BASE_URL",
    ]) {
      if (isLocalOnlyUrl(env[key])) {
        localOnlyKeys.push(key);
      }
    }
    if (
      parseOrigins(env.FOUNDEROS_PRIVILEGED_API_ALLOWED_ORIGINS).some(
        isLocalOnlyUrl,
      )
    ) {
      localOnlyKeys.push("FOUNDEROS_PRIVILEGED_API_ALLOWED_ORIGINS");
    }
  }

  if (missing.length > 0 || localOnlyKeys.length > 0) {
    throw new Error(
      [
        `FounderOS deployment configuration error: ${DEPLOYMENT_ENV_KEY}=${deploymentEnv} is not boot-ready.`,
        missing.length ? `missing env: ${missing.join(", ")}` : null,
        localOnlyKeys.length
          ? `local-only production origins: ${localOnlyKeys.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
}

assertBootDeploymentEnv(process.env);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@founderos/ui", "@founderos/api-clients"],
  turbopack: {
    root: path.join(appDir, "../../../.."),
  },
};

export default nextConfig;
