import process from "node:process";

import { runVercelDiscovery } from "./external-delivery-vercel-discover.mjs";

const requiredEnvKeys = [
  "FOUNDEROS_DEPLOYMENT_ENV",
  "FOUNDEROS_EXTERNAL_DELIVERY_MODE",
  "FOUNDEROS_GITHUB_TOKEN",
  "FOUNDEROS_GITHUB_REPOSITORY",
  "FOUNDEROS_GITHUB_BASE_BRANCH",
  "FOUNDEROS_VERCEL_TOKEN",
  "FOUNDEROS_VERCEL_PROJECT_ID",
  "FOUNDEROS_VERCEL_GIT_REPO_ID",
  "FOUNDEROS_ARTIFACT_STORE_MODE",
  "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX",
  "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE",
  "FOUNDEROS_ARTIFACT_SIGNING_SECRET",
  "FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT",
  "FOUNDEROS_EXTERNAL_PREVIEW_EXPECTED_TEXT",
];

function envValue(key) {
  return process.env[key]?.trim() || null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactProviderErrorDetail(value) {
  const secretValues = [
    envValue("FOUNDEROS_GITHUB_TOKEN"),
    envValue("FOUNDEROS_VERCEL_TOKEN"),
  ].filter((secret) => secret && secret.length >= 8);
  let redacted = value;
  for (const secret of secretValues) {
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), "g"), "[REDACTED]");
  }
  return redacted.replace(
    /\b(?:github_pat|ghp|gho|ghu|ghs|ghr|vck)_[A-Za-z0-9_=-]{8,}\b/g,
    "[REDACTED]",
  );
}

function assertPreflightEnv() {
  const missing = requiredEnvKeys.filter((key) => !envValue(key));
  if (missing.length) {
    throw new Error(
      `external delivery preflight missing required env keys: ${missing.join(", ")}`,
    );
  }

  if (envValue("FOUNDEROS_EXTERNAL_DELIVERY_MODE") !== "github_vercel") {
    throw new Error(
      "external delivery preflight requires FOUNDEROS_EXTERNAL_DELIVERY_MODE=github_vercel",
    );
  }

  const artifactStoreMode = envValue("FOUNDEROS_ARTIFACT_STORE_MODE")?.toLowerCase();
  if (!["s3", "gcs", "r2", "object"].includes(artifactStoreMode)) {
    throw new Error(
      "external delivery preflight requires FOUNDEROS_ARTIFACT_STORE_MODE to be s3, gcs, r2, or object",
    );
  }
  assertArtifactStorageUriPrefix(artifactStoreMode);

  const deploymentEnv = envValue("FOUNDEROS_DEPLOYMENT_ENV")?.toLowerCase();
  if (deploymentEnv !== "staging") {
    throw new Error(
      "external delivery preflight requires FOUNDEROS_DEPLOYMENT_ENV=staging",
    );
  }

  assertHostedSignedUrlBase();
  assertObjectMirrorRoot();
}

function isLocalLookingUri(value) {
  const normalized = value.trim();
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("file://") ||
    normalized.includes("/Users/")
  ) {
    return true;
  }
  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === "file:" ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function assertArtifactStorageUriPrefix(mode) {
  const value = envValue("FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX");
  if (isLocalLookingUri(value)) {
    throw new Error(
      "external delivery preflight requires FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX to be non-local object storage",
    );
  }
  const expectedScheme =
    mode === "s3" ? "s3://" : mode === "gcs" ? "gs://" : mode === "r2" ? "r2://" : null;
  if (expectedScheme && !value.startsWith(expectedScheme)) {
    throw new Error(
      `external delivery preflight requires FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX to start with ${expectedScheme} when FOUNDEROS_ARTIFACT_STORE_MODE=${mode}`,
    );
  }
  if (mode === "object" && !(value.startsWith("object://") || value.startsWith("https://"))) {
    throw new Error(
      "external delivery preflight requires FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX to start with object:// or https:// when FOUNDEROS_ARTIFACT_STORE_MODE=object",
    );
  }
}

function assertHostedSignedUrlBase() {
  const value = envValue("FOUNDEROS_ARTIFACT_SIGNED_URL_BASE");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "external delivery preflight requires FOUNDEROS_ARTIFACT_SIGNED_URL_BASE to be an HTTPS URL",
    );
  }
  const hostname = parsed.hostname.toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]";
  if (parsed.protocol !== "https:" || isLocalHost || value.includes("/Users/")) {
    throw new Error(
      "external delivery preflight requires FOUNDEROS_ARTIFACT_SIGNED_URL_BASE to be a hosted HTTPS URL, not localhost, file, or a local filesystem path",
    );
  }
}

function assertObjectMirrorRoot() {
  const value = envValue("FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT");
  if (objectMirrorRootIsLocalScratch(value)) {
    throw new Error(
      "external delivery preflight requires FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT to be a hosted-readable durable artifact mount, not /tmp, /var/folders, or /Users",
    );
  }
}

function objectMirrorRootIsLocalScratch(value) {
  const normalized = value.replace(/\/+$/, "");
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

function vercelProtectionBypassHeaders() {
  const secret =
    envValue("FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET") ??
    envValue("VERCEL_AUTOMATION_BYPASS_SECRET");
  return secret ? { "x-vercel-protection-bypass": secret } : undefined;
}

function signedDownloadRouteProbeUrl() {
  const parsed = new URL(envValue("FOUNDEROS_ARTIFACT_SIGNED_URL_BASE"));
  parsed.searchParams.set("key", "__preflight_route_probe__");
  parsed.searchParams.set("sha256", "0".repeat(64));
  parsed.searchParams.set("expires", new Date(Date.now() + 60_000).toISOString());
  parsed.searchParams.set("signature", "probe");
  return parsed;
}

async function assertHostedSignedDownloadRoute() {
  const response = await fetch(signedDownloadRouteProbeUrl(), {
    headers: vercelProtectionBypassHeaders(),
    redirect: "manual",
  });
  if (response.status === 404) {
    throw new Error(
      "external delivery preflight requires FOUNDEROS_ARTIFACT_SIGNED_URL_BASE to point at a deployed artifact download route; received 404. Deploy the current shell route before live smoke.",
    );
  }
  if (response.status === 401) {
    throw new Error(
      "external delivery preflight artifact download route is protected by Vercel Deployment Protection; configure FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET or point FOUNDEROS_ARTIFACT_SIGNED_URL_BASE at a public deployed route.",
    );
  }
  if (response.status >= 500) {
    throw new Error(
      `external delivery preflight artifact download route returned ${response.status}; deploy a healthy hosted artifact download route before live smoke.`,
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (
    response.status !== 403 ||
    !contentType.includes("application/json") ||
    !body.includes("artifact_unavailable")
  ) {
    throw new Error(
      `external delivery preflight artifact download route probe expected the signed artifact route 403 JSON response; received ${response.status}. Verify FOUNDEROS_ARTIFACT_SIGNED_URL_BASE and any Vercel protection bypass secret.`,
    );
  }
  console.log("Signed artifact download route preflight passed.");
}

async function githubJson(path) {
  const repository = envValue("FOUNDEROS_GITHUB_REPOSITORY");
  const token = envValue("FOUNDEROS_GITHUB_TOKEN");
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "founderos-external-delivery-preflight",
      "x-github-api-version": "2022-11-28",
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : text;
    throw new Error(
      `GitHub ${path || "/"} failed with ${response.status}: ${redactProviderErrorDetail(detail)}`,
    );
  }
  return payload;
}

async function assertGithubAccess() {
  const repository = envValue("FOUNDEROS_GITHUB_REPOSITORY");
  if (!/^[^/]+\/[^/]+$/.test(repository ?? "")) {
    throw new Error("FOUNDEROS_GITHUB_REPOSITORY must be formatted as owner/repo.");
  }
  const repo = await githubJson("");
  if (repo?.permissions && repo.permissions.push === false) {
    throw new Error(
      `GitHub token does not have push permission for ${repository}.`,
    );
  }
  const baseBranch = envValue("FOUNDEROS_GITHUB_BASE_BRANCH");
  await githubJson(`/branches/${encodeURIComponent(baseBranch)}`);
  console.log(`GitHub preflight passed for ${repository} ${baseBranch}.`);
}

function assertMutationConfirmation() {
  if (envValue("FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS") !== "1") {
    throw new Error(
      "external delivery preflight passed read-only discovery, but live smoke still requires FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1.",
    );
  }
}

async function main() {
  assertPreflightEnv();
  await assertGithubAccess();
  await runVercelDiscovery();
  await assertHostedSignedDownloadRoute();
  assertMutationConfirmation();
  console.log("external delivery preflight passed; live smoke is allowed to run.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
