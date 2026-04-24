import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get as getBlob, head as headBlob, put as putBlob } from "@vercel/blob";

import type {
  AssemblyRecord,
  DeliveryRecord,
  TaskGraphRecord,
  VerificationRunRecord,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";

import { nowIso } from "./shared";

const ORCHESTRATION_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;

export type ArtifactStoreMode = "local" | "s3" | "gcs" | "r2" | "object";

export type StoredArtifact = {
  key: string;
  uri: string;
  signedUrl: string;
  expiresAt: string;
  sha256: string;
  byteSize: number;
  contentType: string;
  localPath?: string | null;
};

export type SignedArtifactManifest = {
  version: 1;
  generatedAt: string;
  storeMode: ArtifactStoreMode;
  subject: Record<string, unknown>;
  artifacts: Array<Omit<StoredArtifact, "localPath">>;
  signature: {
    algorithm: "hmac-sha256";
    value: string;
  };
};

export interface ArtifactStore {
  mode: ArtifactStoreMode;
  durable: boolean;
  rootUri: string;
  uriForKey(key: string): string;
  signedUrlFor(params: {
    key: string;
    sha256: string;
    expiresAt?: string;
  }): string;
  localPathForUri(uri: string): string | null;
  putArtifact(params: {
    key: string;
    content: string | Buffer;
    contentType: string;
  }): Promise<StoredArtifact>;
  readArtifact(params: {
    key: string;
    sha256: string;
  }): Promise<{ bytes: Buffer; contentType: string }>;
  artifactExists(uri: string): Promise<boolean>;
}

function trimTrailingSlash(value: string) {
  return value.replace(/[\\/]$/, "");
}

export function resolveInfinityRoot() {
  const explicitRoot = process.env.FOUNDEROS_INTEGRATION_ROOT;
  if (explicitRoot && explicitRoot.trim().length > 0) {
    return trimTrailingSlash(explicitRoot.trim());
  }

  return path.resolve(ORCHESTRATION_DIR, "../../../../../../..");
}

export function resolveOrchestrationArtifactsRoot() {
  const explicitRoot = process.env.FOUNDEROS_ORCHESTRATION_ARTIFACTS_ROOT;
  if (explicitRoot && explicitRoot.trim().length > 0) {
    return trimTrailingSlash(explicitRoot.trim());
  }

  return path.join(resolveInfinityRoot(), ".local-state", "assemblies");
}

export function resolveOrchestrationDeliveriesRoot() {
  const explicitRoot = process.env.FOUNDEROS_ORCHESTRATION_DELIVERIES_ROOT;
  if (explicitRoot && explicitRoot.trim().length > 0) {
    return trimTrailingSlash(explicitRoot.trim());
  }

  return path.join(resolveInfinityRoot(), ".local-state", "orchestration", "deliveries");
}

function normalizeEnvValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function resolveArtifactStoreMode() {
  const configured = normalizeEnvValue(process.env.FOUNDEROS_ARTIFACT_STORE_MODE);
  if (!configured) {
    return "local" as const;
  }
  const normalized = configured.toLowerCase();
  if (
    normalized === "local" ||
    normalized === "s3" ||
    normalized === "gcs" ||
    normalized === "r2" ||
    normalized === "object"
  ) {
    return normalized;
  }
  throw new Error(
    "FOUNDEROS_ARTIFACT_STORE_MODE must be one of local, s3, gcs, r2, or object."
  );
}

function resolveArtifactObjectBackend() {
  return normalizeEnvValue(process.env.FOUNDEROS_ARTIFACT_OBJECT_BACKEND)?.toLowerCase() ?? null;
}

function usesVercelBlobObjectBackend() {
  return resolveArtifactObjectBackend() === "vercel_blob";
}

function requiresObjectArtifactStore() {
  const deploymentEnv = normalizeEnvValue(process.env.FOUNDEROS_DEPLOYMENT_ENV)?.toLowerCase();
  return deploymentEnv === "production" || deploymentEnv === "staging";
}

function isLocalOnlyHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1"
  );
}

function isLocalLookingUri(value: string) {
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
    return parsed.protocol === "file:" || isLocalOnlyHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function expectedObjectScheme(mode: Exclude<ArtifactStoreMode, "local">) {
  if (mode === "s3") {
    return "s3://";
  }
  if (mode === "gcs") {
    return "gs://";
  }
  if (mode === "r2") {
    return "r2://";
  }
  return null;
}

function assertArtifactStorageUriPrefix(
  mode: Exclude<ArtifactStoreMode, "local">,
  uriPrefix: string
) {
  if (isLocalLookingUri(uriPrefix)) {
    throw new Error(
      "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX must not be a local file path, file:// URI, localhost URL, or /Users path."
    );
  }

  const expectedScheme = expectedObjectScheme(mode);
  if (expectedScheme && !uriPrefix.startsWith(expectedScheme)) {
    throw new Error(
      `FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX must start with ${expectedScheme} when FOUNDEROS_ARTIFACT_STORE_MODE=${mode}.`
    );
  }

  if (mode === "object") {
    const validObjectPrefix =
      uriPrefix.startsWith("object://") ||
      uriPrefix.startsWith("vercel-blob://") ||
      uriPrefix.startsWith("https://");
    if (!validObjectPrefix) {
      throw new Error(
        "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX must start with object://, vercel-blob://, or https:// when FOUNDEROS_ARTIFACT_STORE_MODE=object."
      );
    }
  }
}

function assertSignedUrlBase(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("FOUNDEROS_ARTIFACT_SIGNED_URL_BASE must be an absolute URL.");
  }

  if (isLocalOnlyHostname(parsed.hostname) || parsed.protocol === "file:") {
    throw new Error(
      "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE must not point to localhost or file:// storage."
    );
  }

  if (requiresObjectArtifactStore() && parsed.protocol !== "https:") {
    throw new Error(
      "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE must be https:// in production-like deployments."
    );
  }
}

function assertObjectMirrorRoot(value: string) {
  if (usesVercelBlobObjectBackend()) {
    return;
  }
  if (requiresObjectArtifactStore() && objectMirrorRootIsLocalScratch(value)) {
    throw new Error(
      "FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT must be a durable object-store mount in production-like deployments, not /tmp, /var/folders, or a /Users path."
    );
  }
}

function vercelBlobToken() {
  const token =
    normalizeEnvValue(process.env.BLOB_READ_WRITE_TOKEN) ??
    normalizeEnvValue(process.env.FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN);
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN or FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN is required when FOUNDEROS_ARTIFACT_OBJECT_BACKEND=vercel_blob."
    );
  }
  return token;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    byteLength += value.byteLength;
  }
  return Buffer.concat(chunks, byteLength);
}

function objectMirrorRootIsLocalScratch(value: string) {
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

function sanitizeArtifactKey(value: string) {
  const normalized = value.replaceAll("\\", "/");
  const parts = normalized
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (
    parts.length === 0 ||
    parts.some((part) => part === "." || part === ".." || part.includes("\0"))
  ) {
    throw new Error(`Invalid artifact key: ${value}`);
  }

  return parts.join("/");
}

function encodeArtifactKey(value: string) {
  return sanitizeArtifactKey(value)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function decodeArtifactKey(value: string) {
  return value
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part))
    .join("/");
}

function trimLeadingSlash(value: string) {
  return value.replace(/^\/+/, "");
}

function contentBuffer(value: string | Buffer) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
}

function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(contentBuffer(value)).digest("hex");
}

function expiresAt(secondsFromNow = DEFAULT_SIGNED_URL_TTL_SECONDS) {
  return new Date(Date.now() + secondsFromNow * 1000).toISOString();
}

function signingSecret(mode: ArtifactStoreMode) {
  const configured = normalizeEnvValue(process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET);
  if (configured) {
    return configured;
  }
  if (mode !== "local") {
    throw new Error(
      "FOUNDEROS_ARTIFACT_SIGNING_SECRET is required for non-local artifact storage."
    );
  }
  return "local-dev-artifact-signing-secret";
}

function hmacSignature(mode: ArtifactStoreMode, value: string) {
  return createHmac("sha256", signingSecret(mode)).update(value).digest("hex");
}

function signaturesMatch(left: string, right: string) {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

class LocalArtifactStore implements ArtifactStore {
  mode = "local" as const;
  durable = false;
  rootUri: string;

  constructor(private readonly rootPath: string) {
    this.rootUri = `file://${rootPath}`;
  }

  uriForKey(key: string) {
    return `file://${path.join(this.rootPath, sanitizeArtifactKey(key))}`;
  }

  signedUrlFor(params: { key: string; sha256: string; expiresAt?: string }) {
    return this.uriForKey(params.key);
  }

  localPathForUri(uri: string) {
    if (uri.startsWith("file://")) {
      return uri.replace(/^file:\/\//, "");
    }
    if (path.isAbsolute(uri)) {
      return uri;
    }
    return null;
  }

  async putArtifact(params: {
    key: string;
    content: string | Buffer;
    contentType: string;
  }): Promise<StoredArtifact> {
    const key = sanitizeArtifactKey(params.key);
    const localPath = path.join(this.rootPath, key);
    const bytes = contentBuffer(params.content);
    const sha256 = sha256Hex(bytes);
    mkdirSync(path.dirname(localPath), { recursive: true });
    writeFileSync(localPath, bytes);
    return {
      key,
      uri: `file://${localPath}`,
      signedUrl: `file://${localPath}`,
      expiresAt: expiresAt(),
      sha256,
      byteSize: bytes.byteLength,
      contentType: params.contentType,
      localPath,
    };
  }

  async readArtifact(params: { key: string; sha256: string }) {
    const localPath = path.join(this.rootPath, sanitizeArtifactKey(params.key));
    if (!existsSync(localPath)) {
      throw new Error("Signed artifact is not available in the configured artifact store.");
    }
    const bytes = readFileSync(localPath);
    const observedSha256 = sha256Hex(bytes);
    if (observedSha256 !== params.sha256) {
      throw new Error("Signed artifact checksum mismatch.");
    }
    return {
      bytes,
      contentType: "application/octet-stream",
    };
  }

  async artifactExists(uri: string) {
    const localPath = this.localPathForUri(uri);
    return localPath ? existsSync(localPath) : false;
  }
}

class ObjectArtifactStore implements ArtifactStore {
  durable = true;
  rootUri: string;

  constructor(
    readonly mode: Exclude<ArtifactStoreMode, "local">,
    private readonly uriPrefix: string,
    private readonly signedUrlBase: string,
    private readonly mirrorRootPath: string
  ) {
    this.rootUri = uriPrefix.replace(/\/+$/, "");
  }

  uriForKey(key: string) {
    return `${this.rootUri}/${encodeArtifactKey(key)}`;
  }

  signedUrlFor(params: { key: string; sha256: string; expiresAt?: string }) {
    const key = sanitizeArtifactKey(params.key);
    const expiry = params.expiresAt ?? expiresAt();
    const signed = hmacSignature(this.mode, `${key}\n${params.sha256}\n${expiry}`);
    const url = new URL(this.signedUrlBase);
    url.searchParams.set("key", key);
    url.searchParams.set("sha256", params.sha256);
    url.searchParams.set("expires", expiry);
    url.searchParams.set("signature", signed);
    return url.toString();
  }

  localPathForUri(uri: string) {
    if (!uri.startsWith(`${this.rootUri}/`)) {
      return null;
    }
    const encodedKey = trimLeadingSlash(uri.slice(this.rootUri.length));
    const key = decodeArtifactKey(encodedKey);
    return path.join(this.mirrorRootPath, key);
  }

  async putArtifact(params: {
    key: string;
    content: string | Buffer;
    contentType: string;
  }): Promise<StoredArtifact> {
    const key = sanitizeArtifactKey(params.key);
    const bytes = contentBuffer(params.content);
    const sha256 = sha256Hex(bytes);
    const localPath = path.join(this.mirrorRootPath, key);
    mkdirSync(path.dirname(localPath), { recursive: true });
    writeFileSync(localPath, bytes);
    const expires = expiresAt();
    return {
      key,
      uri: this.uriForKey(key),
      signedUrl: this.signedUrlFor({ key, sha256, expiresAt: expires }),
      expiresAt: expires,
      sha256,
      byteSize: bytes.byteLength,
      contentType: params.contentType,
      localPath,
    };
  }

  async readArtifact(params: { key: string; sha256: string }) {
    const localPath = this.localPathForUri(this.uriForKey(params.key));
    if (!localPath || !existsSync(localPath)) {
      throw new Error("Signed artifact is not available in the configured artifact store.");
    }
    const bytes = readFileSync(localPath);
    const observedSha256 = sha256Hex(bytes);
    if (observedSha256 !== params.sha256) {
      throw new Error("Signed artifact checksum mismatch.");
    }
    return {
      bytes,
      contentType: "application/octet-stream",
    };
  }

  async artifactExists(uri: string) {
    const localPath = this.localPathForUri(uri);
    return localPath ? existsSync(localPath) : false;
  }
}

class VercelBlobArtifactStore implements ArtifactStore {
  mode = "object" as const;
  durable = true;
  rootUri: string;

  constructor(
    private readonly uriPrefix: string,
    private readonly signedUrlBase: string
  ) {
    this.rootUri = uriPrefix.replace(/\/+$/, "");
  }

  uriForKey(key: string) {
    return `${this.rootUri}/${encodeArtifactKey(key)}`;
  }

  signedUrlFor(params: { key: string; sha256: string; expiresAt?: string }) {
    const key = sanitizeArtifactKey(params.key);
    const expiry = params.expiresAt ?? expiresAt();
    const signed = hmacSignature(this.mode, `${key}\n${params.sha256}\n${expiry}`);
    const url = new URL(this.signedUrlBase);
    url.searchParams.set("key", key);
    url.searchParams.set("sha256", params.sha256);
    url.searchParams.set("expires", expiry);
    url.searchParams.set("signature", signed);
    return url.toString();
  }

  localPathForUri(_uri: string) {
    return null;
  }

  private keyFromUri(uri: string) {
    if (!uri.startsWith(`${this.rootUri}/`)) {
      return null;
    }
    return decodeArtifactKey(trimLeadingSlash(uri.slice(this.rootUri.length)));
  }

  async putArtifact(params: {
    key: string;
    content: string | Buffer;
    contentType: string;
  }): Promise<StoredArtifact> {
    const key = sanitizeArtifactKey(params.key);
    const bytes = contentBuffer(params.content);
    const sha256 = sha256Hex(bytes);
    await putBlob(key, bytes, {
      access: "private",
      allowOverwrite: true,
      contentType: params.contentType,
      token: vercelBlobToken(),
    });
    const expires = expiresAt();
    return {
      key,
      uri: this.uriForKey(key),
      signedUrl: this.signedUrlFor({ key, sha256, expiresAt: expires }),
      expiresAt: expires,
      sha256,
      byteSize: bytes.byteLength,
      contentType: params.contentType,
      localPath: null,
    };
  }

  async readArtifact(params: { key: string; sha256: string }) {
    const key = sanitizeArtifactKey(params.key);
    const result = await getBlob(key, {
      access: "private",
      token: vercelBlobToken(),
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error("Signed artifact is not available in the configured artifact store.");
    }
    const bytes = await streamToBuffer(result.stream);
    const observedSha256 = sha256Hex(bytes);
    if (observedSha256 !== params.sha256) {
      throw new Error("Signed artifact checksum mismatch.");
    }
    return {
      bytes,
      contentType: result.blob.contentType,
    };
  }

  async artifactExists(uri: string) {
    const key = this.keyFromUri(uri);
    if (!key) {
      return false;
    }
    try {
      await headBlob(key, { token: vercelBlobToken() });
      return true;
    } catch {
      return false;
    }
  }
}

export function resolveArtifactStore(): ArtifactStore {
  const mode = resolveArtifactStoreMode();
  if (mode === "local") {
    if (requiresObjectArtifactStore()) {
      throw new Error(
        "Production-like deployments require non-local artifact storage; set FOUNDEROS_ARTIFACT_STORE_MODE to s3, gcs, r2, or object."
      );
    }
    return new LocalArtifactStore(
      normalizeEnvValue(process.env.FOUNDEROS_LOCAL_ARTIFACT_STORE_ROOT) ??
        path.join(resolveInfinityRoot(), ".local-state", "orchestration")
    );
  }

  const uriPrefix = normalizeEnvValue(process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX);
  if (!uriPrefix) {
    throw new Error(
      "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX is required for non-local artifact storage."
    );
  }
  assertArtifactStorageUriPrefix(mode, uriPrefix);
  const signedUrlBase = normalizeEnvValue(process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE);
  if (!signedUrlBase) {
    throw new Error(
      "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE is required for non-local artifact storage."
    );
  }
  assertSignedUrlBase(signedUrlBase);
  if (mode === "object" && usesVercelBlobObjectBackend()) {
    vercelBlobToken();
    return new VercelBlobArtifactStore(uriPrefix, signedUrlBase);
  }
  const mirrorRootPath = normalizeEnvValue(process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT);
  if (!mirrorRootPath) {
    throw new Error(
      "FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT is required until a cloud upload adapter is configured."
    );
  }
  assertObjectMirrorRoot(mirrorRootPath);

  return new ObjectArtifactStore(mode, uriPrefix, signedUrlBase, mirrorRootPath);
}

export async function storeJsonArtifact(params: {
  key: string;
  payload: unknown;
  contentType?: string;
}) {
  return resolveArtifactStore().putArtifact({
    key: params.key,
    content: JSON.stringify(params.payload, null, 2),
    contentType: params.contentType ?? "application/json",
  });
}

export async function storeTextArtifact(params: {
  key: string;
  content: string;
  contentType?: string;
}) {
  return resolveArtifactStore().putArtifact({
    key: params.key,
    content: params.content,
    contentType: params.contentType ?? "text/plain; charset=utf-8",
  });
}

export async function storeFileArtifact(params: {
  key: string;
  filePath: string;
  contentType?: string;
}) {
  return resolveArtifactStore().putArtifact({
    key: params.key,
    content: readFileSync(params.filePath),
    contentType: params.contentType ?? "application/octet-stream",
  });
}

export async function writeSignedArtifactManifest(params: {
  key: string;
  subject: Record<string, unknown>;
  artifacts: readonly StoredArtifact[];
}) {
  const store = resolveArtifactStore();
  const generatedAt = nowIso();
  const unsigned = {
    version: 1 as const,
    generatedAt,
    storeMode: store.mode,
    subject: params.subject,
    artifacts: params.artifacts.map(({ localPath: _localPath, ...artifact }) => artifact),
  };
  const signature = hmacSignature(store.mode, JSON.stringify(unsigned));
  const manifest: SignedArtifactManifest = {
    ...unsigned,
    signature: {
      algorithm: "hmac-sha256",
      value: signature,
    },
  };
  const stored = await store.putArtifact({
    key: params.key,
    content: JSON.stringify(manifest, null, 2),
    contentType: "application/json",
  });
  return {
    manifest,
    stored,
    storageRootUri: store.uriForKey(path.dirname(sanitizeArtifactKey(params.key))),
  };
}

export async function artifactEvidenceExists(uriOrPath: string | null | undefined) {
  if (!uriOrPath) {
    return false;
  }
  const localPath = artifactLocalPath(uriOrPath);
  if (localPath) {
    return existsSync(localPath);
  }
  try {
    return await resolveArtifactStore().artifactExists(uriOrPath);
  } catch {
    return false;
  }
}

export function artifactLocalPath(uriOrPath: string | null | undefined) {
  if (!uriOrPath) {
    return null;
  }
  if (uriOrPath.startsWith("file://")) {
    return uriOrPath.replace(/^file:\/\//, "");
  }
  if (path.isAbsolute(uriOrPath)) {
    return uriOrPath;
  }
  try {
    return resolveArtifactStore().localPathForUri(uriOrPath);
  } catch {
    return null;
  }
}

export async function readSignedArtifactDownload(searchParams: URLSearchParams) {
  const key = normalizeEnvValue(searchParams.get("key"));
  const sha256 = normalizeEnvValue(searchParams.get("sha256"));
  const expires = normalizeEnvValue(searchParams.get("expires"));
  const signature = normalizeEnvValue(searchParams.get("signature"));
  if (!key || !sha256 || !expires || !signature) {
    throw new Error("Signed artifact URL is missing key, sha256, expires, or signature.");
  }

  const expiresAtMs = Date.parse(expires);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    throw new Error("Signed artifact URL is expired.");
  }

  const store = resolveArtifactStore();
  const expectedSignature = hmacSignature(store.mode, `${key}\n${sha256}\n${expires}`);
  if (!signaturesMatch(signature, expectedSignature)) {
    throw new Error("Signed artifact URL signature is invalid.");
  }

  const artifact = await store.readArtifact({ key, sha256 });

  return {
    bytes: artifact.bytes,
    contentType: artifact.contentType,
    sha256,
    key,
  };
}

export function resolveAssemblyDirectory(initiativeId: string) {
  return path.join(resolveOrchestrationArtifactsRoot(), initiativeId);
}

type AssemblyArtifactRecord = {
  attemptId: string;
  workUnitId: string;
  title: string;
  scopePaths: string[];
  acceptanceCriteria: string[];
  generatedAt: string;
  artifactPath: string;
  artifactUri: string;
};

export async function materializeAssemblyArtifacts(
  initiativeId: string,
  taskGraph: TaskGraphRecord,
  workUnits: readonly WorkUnitRecord[]
) {
  const store = resolveArtifactStore();
  const assemblyDir = resolveAssemblyDirectory(initiativeId);
  const attemptsDir = path.join(assemblyDir, "attempts");
  mkdirSync(attemptsDir, { recursive: true });

  const generatedAt = nowIso();
  const artifacts = await Promise.all(workUnits.map(async (workUnit) => {
    const attemptId = workUnit.latestAttemptId ?? `attempt-missing-${workUnit.id}`;
    const artifactPath = path.join(attemptsDir, `${attemptId}.json`);
    const payload = {
      initiativeId,
      taskGraphId: taskGraph.id,
      workUnitId: workUnit.id,
      attemptId,
      title: workUnit.title,
      description: workUnit.description,
      scopePaths: workUnit.scopePaths,
      acceptanceCriteria: workUnit.acceptanceCriteria,
      generatedAt,
    };
    writeFileSync(artifactPath, JSON.stringify(payload, null, 2));
    const stored = await storeJsonArtifact({
      key: `assemblies/${initiativeId}/${taskGraph.id}/attempts/${attemptId}.json`,
      payload,
    });

    return {
      attemptId,
      workUnitId: workUnit.id,
      title: workUnit.title,
      scopePaths: [...workUnit.scopePaths],
      acceptanceCriteria: [...workUnit.acceptanceCriteria],
      generatedAt,
      artifactPath: store.mode === "local" ? artifactPath : stored.uri,
      artifactUri: stored.uri,
    } satisfies AssemblyArtifactRecord;
  }));

  return {
    assemblyDir:
      store.mode === "local" ? assemblyDir : store.uriForKey(`assemblies/${initiativeId}/${taskGraph.id}`),
    generatedAt,
    artifacts,
  };
}

export function buildAssemblyManifest(params: {
  initiativeId: string;
  taskGraph: TaskGraphRecord;
  workUnits: readonly WorkUnitRecord[];
  artifacts: readonly AssemblyArtifactRecord[];
}) {
  return {
    initiativeId: params.initiativeId,
    taskGraphId: params.taskGraph.id,
    workUnitIds: params.workUnits.map((workUnit) => workUnit.id),
    attemptIds: params.artifacts.map((artifact) => artifact.attemptId),
    artifacts: params.artifacts.map((artifact) => ({
      attemptId: artifact.attemptId,
      workUnitId: artifact.workUnitId,
      title: artifact.title,
      artifactPath: artifact.artifactPath,
      artifactUri: artifact.artifactUri,
    })),
    generatedAt: params.artifacts[0]?.generatedAt ?? nowIso(),
    sourceSummaries: params.workUnits.map((workUnit) => ({
      workUnitId: workUnit.id,
      title: workUnit.title,
      scopePaths: workUnit.scopePaths,
    })),
    verificationPrerequisites: [
      "assembly_present",
      "work_units_completed",
      "assembly_matches_task_graph",
      "assembly_manifest_present",
      "artifact_evidence_present",
      "static_checks_passed",
      "targeted_tests_passed",
    ],
  };
}

export async function writeAssemblyManifest(params: {
  initiativeId: string;
  taskGraph: TaskGraphRecord;
  workUnits: readonly WorkUnitRecord[];
  artifacts: readonly AssemblyArtifactRecord[];
}) {
  const store = resolveArtifactStore();
  const assemblyDir = resolveAssemblyDirectory(params.initiativeId);
  mkdirSync(assemblyDir, { recursive: true });

  const manifestPath = path.join(assemblyDir, "assembly-manifest.json");
  const manifest = buildAssemblyManifest(params);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const storedManifest = await storeJsonArtifact({
    key: `assemblies/${params.initiativeId}/${params.taskGraph.id}/assembly-manifest.json`,
    payload: manifest,
  });
  const signedManifest = await writeSignedArtifactManifest({
    key: `assemblies/${params.initiativeId}/${params.taskGraph.id}/signed-artifact-manifest.json`,
    subject: {
      kind: "assembly",
      initiativeId: params.initiativeId,
      taskGraphId: params.taskGraph.id,
    },
    artifacts: [storedManifest],
  });

  return {
    manifestPath: store.mode === "local" ? manifestPath : signedManifest.stored.uri,
    manifest,
  };
}

export function buildDeliveryManifest(params: {
  delivery: DeliveryRecord;
  assembly: AssemblyRecord;
  verification: VerificationRunRecord;
}) {
  return {
    deliveryId: params.delivery.id,
    initiativeId: params.delivery.initiativeId,
    taskGraphId: params.delivery.taskGraphId ?? params.assembly.taskGraphId,
    verificationRunId: params.delivery.verificationRunId,
    assemblyId: params.assembly.id,
    assemblyManifestPath: params.assembly.manifestPath ?? null,
    localOutputPath: params.delivery.localOutputPath ?? null,
    previewUrl: params.delivery.previewUrl ?? null,
    launchManifestPath: params.delivery.launchManifestPath ?? null,
    launchProofKind: params.delivery.launchProofKind ?? null,
    launchTargetLabel: params.delivery.launchTargetLabel ?? null,
    launchProofUrl: params.delivery.launchProofUrl ?? null,
    launchProofAt: params.delivery.launchProofAt ?? null,
    externalPullRequestUrl: params.delivery.externalPullRequestUrl ?? null,
    externalPullRequestId: params.delivery.externalPullRequestId ?? null,
    readinessTier: params.delivery.readinessTier ?? "local_solo",
    externalPreviewUrl: params.delivery.externalPreviewUrl ?? null,
    externalPreviewProvider: params.delivery.externalPreviewProvider ?? null,
    externalPreviewDeploymentId: params.delivery.externalPreviewDeploymentId ?? null,
    externalProofManifestPath: params.delivery.externalProofManifestPath ?? null,
    ciProofUri: params.delivery.ciProofUri ?? null,
    ciProofProvider: params.delivery.ciProofProvider ?? null,
    ciProofId: params.delivery.ciProofId ?? null,
    artifactStorageUri: params.delivery.artifactStorageUri ?? null,
    signedManifestUri: params.delivery.signedManifestUri ?? null,
    externalDeliveryProof: params.delivery.externalDeliveryProof ?? null,
    localhostReady:
      params.delivery.status === "ready" &&
      params.delivery.launchProofKind === "runnable_result" &&
      Boolean(params.delivery.launchManifestPath && params.delivery.launchProofAt),
    handoffNotes: params.delivery.handoffNotes ?? null,
    deliveredAt: params.delivery.deliveredAt ?? null,
    verificationStatus: params.verification.overallStatus,
  };
}

function objectStoreDeliveryManifest(
  manifest: ReturnType<typeof buildDeliveryManifest>
) {
  const { localhostReady, ...rest } = manifest;
  return {
    ...rest,
    launchProofUrl: null,
    localRunnableProofReady: localhostReady,
  };
}

export async function writeDeliveryManifest(params: {
  delivery: DeliveryRecord;
  assembly: AssemblyRecord;
  verification: VerificationRunRecord;
}) {
  const store = resolveArtifactStore();
  const manifest = buildDeliveryManifest(params);

  if (store.mode !== "local") {
    const storedManifest = objectStoreDeliveryManifest(manifest);
    const stored = await storeJsonArtifact({
      key: `deliveries/${params.delivery.initiativeId}/${params.delivery.id}/delivery-manifest.json`,
      payload: storedManifest,
    });
    return {
      manifestPath: stored.uri,
      manifest: storedManifest,
    };
  }

  const assemblyDir =
    params.delivery.localOutputPath ?? resolveAssemblyDirectory(params.delivery.initiativeId);
  mkdirSync(assemblyDir, { recursive: true });

  const manifestPath = path.join(assemblyDir, "delivery-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    manifestPath,
    manifest,
  };
}
