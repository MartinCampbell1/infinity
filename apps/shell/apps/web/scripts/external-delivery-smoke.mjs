import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");

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
  "FOUNDEROS_EXTERNAL_PREVIEW_EXPECTED_TEXT",
];

const missing = requiredEnvKeys.filter((key) => !process.env[key]?.trim());
const artifactObjectBackend =
  process.env.FOUNDEROS_ARTIFACT_OBJECT_BACKEND?.trim().toLowerCase() || null;
if (artifactObjectBackend === "vercel_blob") {
  if (
    !process.env.BLOB_READ_WRITE_TOKEN?.trim() &&
    !process.env.FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN?.trim()
  ) {
    missing.push("BLOB_READ_WRITE_TOKEN");
  }
} else if (!process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT?.trim()) {
  missing.push("FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT");
}
if (missing.length) {
  console.error(
    `external delivery smoke missing required env keys: ${missing.join(", ")}`,
  );
  process.exit(1);
}

if (process.env.FOUNDEROS_EXTERNAL_DELIVERY_MODE !== "github_vercel") {
  console.error(
    "external delivery smoke requires FOUNDEROS_EXTERNAL_DELIVERY_MODE=github_vercel",
  );
  process.exit(1);
}

const artifactStoreMode =
  process.env.FOUNDEROS_ARTIFACT_STORE_MODE?.trim().toLowerCase();
if (!["s3", "gcs", "r2", "object"].includes(artifactStoreMode)) {
  console.error(
    "external delivery smoke requires FOUNDEROS_ARTIFACT_STORE_MODE to be s3, gcs, r2, or object",
  );
  process.exit(1);
}
if (artifactObjectBackend && artifactObjectBackend !== "vercel_blob") {
  console.error(
    "external delivery smoke requires FOUNDEROS_ARTIFACT_OBJECT_BACKEND to be vercel_blob when configured",
  );
  process.exit(1);
}
if (artifactObjectBackend === "vercel_blob" && artifactStoreMode !== "object") {
  console.error(
    "external delivery smoke requires FOUNDEROS_ARTIFACT_STORE_MODE=object when FOUNDEROS_ARTIFACT_OBJECT_BACKEND=vercel_blob",
  );
  process.exit(1);
}

const artifactStorageUriPrefix =
  process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX?.trim();
function artifactStoragePrefixIsLocal(value) {
  if (
    value.startsWith("/") ||
    value.startsWith("file://") ||
    value.includes("/Users/")
  ) {
    return true;
  }
  try {
    const parsed = new URL(value);
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
if (artifactStoragePrefixIsLocal(artifactStorageUriPrefix)) {
  console.error(
    "external delivery smoke requires FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX to be non-local object storage",
  );
  process.exit(1);
}
const expectedStorageScheme =
  artifactStoreMode === "s3"
    ? "s3://"
    : artifactStoreMode === "gcs"
      ? "gs://"
      : artifactStoreMode === "r2"
        ? "r2://"
        : null;
if (expectedStorageScheme && !artifactStorageUriPrefix.startsWith(expectedStorageScheme)) {
  console.error(
    `external delivery smoke requires FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX to start with ${expectedStorageScheme} when FOUNDEROS_ARTIFACT_STORE_MODE=${artifactStoreMode}`,
  );
  process.exit(1);
}
if (
  artifactStoreMode === "object" &&
  !(
    artifactStorageUriPrefix.startsWith("object://") ||
    (artifactObjectBackend === "vercel_blob" &&
      artifactStorageUriPrefix.startsWith("vercel-blob://")) ||
    artifactStorageUriPrefix.startsWith("https://")
  )
) {
  console.error(
    "external delivery smoke requires FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX to start with object://, vercel-blob://, or https:// when FOUNDEROS_ARTIFACT_STORE_MODE=object",
  );
  process.exit(1);
}

const deploymentEnv =
  process.env.FOUNDEROS_DEPLOYMENT_ENV?.trim().toLowerCase();
if (deploymentEnv !== "staging") {
  console.error(
    "external delivery smoke requires FOUNDEROS_DEPLOYMENT_ENV=staging",
  );
  process.exit(1);
}

const signedUrlBase = process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE?.trim();
let parsedSignedUrlBase;
try {
  parsedSignedUrlBase = new URL(signedUrlBase);
} catch {
  console.error(
    "external delivery smoke requires FOUNDEROS_ARTIFACT_SIGNED_URL_BASE to be an HTTPS URL",
  );
  process.exit(1);
}
const signedUrlHost = parsedSignedUrlBase.hostname.toLowerCase();
const signedUrlIsLocalHost =
  signedUrlHost === "localhost" ||
  signedUrlHost.endsWith(".localhost") ||
  signedUrlHost === "127.0.0.1" ||
  signedUrlHost === "0.0.0.0" ||
  signedUrlHost === "::1" ||
  signedUrlHost === "[::1]";
if (
  parsedSignedUrlBase.protocol !== "https:" ||
  signedUrlIsLocalHost ||
  signedUrlBase.includes("/Users/")
) {
  console.error(
    "external delivery smoke requires FOUNDEROS_ARTIFACT_SIGNED_URL_BASE to be a hosted HTTPS URL, not localhost, file, or a local filesystem path",
  );
  process.exit(1);
}

function objectMirrorRootIsLocalScratch(value) {
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

if (
  artifactObjectBackend !== "vercel_blob" &&
  objectMirrorRootIsLocalScratch(
    process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT ?? "",
  )
) {
  console.error(
    "external delivery smoke requires FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT to be a hosted-readable durable artifact mount, not /tmp, /var/folders, or /Users",
  );
  process.exit(1);
}

if (process.env.FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS !== "1") {
  console.error(
    "external delivery smoke creates or updates public GitHub branches/PRs and Vercel preview deployments; set FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1 to confirm.",
  );
  process.exit(1);
}

const routeProbeUrl = new URL(signedUrlBase);
routeProbeUrl.searchParams.set("key", "__smoke_route_probe__");
routeProbeUrl.searchParams.set("sha256", "0".repeat(64));
routeProbeUrl.searchParams.set("expires", new Date(Date.now() + 60_000).toISOString());
routeProbeUrl.searchParams.set("signature", "probe");
const vercelProtectionBypassSecret =
  process.env.FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET?.trim() ||
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const routeProbeResponse = await fetch(routeProbeUrl, {
  headers: vercelProtectionBypassSecret
    ? { "x-vercel-protection-bypass": vercelProtectionBypassSecret }
    : undefined,
  redirect: "manual",
});
if (routeProbeResponse.status === 404) {
  console.error(
    "external delivery smoke requires FOUNDEROS_ARTIFACT_SIGNED_URL_BASE to point at a deployed artifact download route; received 404. Deploy the current shell route before live smoke.",
  );
  process.exit(1);
}
if (routeProbeResponse.status === 401) {
  console.error(
    "external delivery smoke artifact download route is protected by Vercel Deployment Protection; configure FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET or point FOUNDEROS_ARTIFACT_SIGNED_URL_BASE at a public deployed route.",
  );
  process.exit(1);
}
if (routeProbeResponse.status >= 500) {
  console.error(
    `external delivery smoke artifact download route returned ${routeProbeResponse.status}; deploy a healthy hosted artifact download route before live smoke.`,
  );
  process.exit(1);
}
const routeProbeContentType = routeProbeResponse.headers.get("content-type") ?? "";
const routeProbeBody = await routeProbeResponse.text();
if (
  routeProbeResponse.status !== 403 ||
  !routeProbeContentType.includes("application/json") ||
  !routeProbeBody.includes("artifact_unavailable")
) {
  console.error(
    `external delivery smoke artifact download route probe expected the signed artifact route 403 JSON response; received ${routeProbeResponse.status}. Verify FOUNDEROS_ARTIFACT_SIGNED_URL_BASE and any Vercel protection bypass secret.`,
  );
  process.exit(1);
}

const result = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "lib/server/orchestration/external-delivery.live.test.ts",
    "--testTimeout",
    "420000",
  ],
  {
    cwd: appRoot,
    env: {
      ...process.env,
      FOUNDEROS_DEPLOYMENT_ENV: "staging",
      FOUNDEROS_EXTERNAL_DELIVERY_LIVE_SMOKE: "1",
    },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
