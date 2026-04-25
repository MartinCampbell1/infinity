import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type {
  AssemblyRecord,
  DeliveryRecord,
  VerificationRunRecord,
} from "../control-plane/contracts/orchestration";

const blobMockState = vi.hoisted(() => ({
  blobs: new Map<
    string,
    {
      bytes: Buffer;
      contentType: string;
      token: string | undefined;
    }
  >(),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (
    pathname: string,
    body: string | Buffer | Uint8Array,
    options: { contentType?: string; token?: string },
  ) => {
    blobMockState.blobs.set(pathname, {
      bytes: Buffer.from(body),
      contentType: options.contentType ?? "application/octet-stream",
      token: options.token,
    });
    return {
      pathname,
      url: `https://blob.example/${pathname}`,
      downloadUrl: `https://blob.example/${pathname}?download=1`,
      contentType: options.contentType ?? "application/octet-stream",
      contentDisposition: "inline",
    };
  }),
  get: vi.fn(async (
    pathname: string,
    options: { token?: string },
  ) => {
    const blob = blobMockState.blobs.get(pathname);
    if (!blob || blob.token !== options.token) {
      return null;
    }
    return {
      statusCode: 200,
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(blob.bytes));
          controller.close();
        },
      }),
      headers: new Headers(),
      blob: {
        url: `https://blob.example/${pathname}`,
        downloadUrl: `https://blob.example/${pathname}?download=1`,
        pathname,
        contentDisposition: "inline",
        cacheControl: "no-store",
        uploadedAt: new Date(),
        etag: "test-etag",
        contentType: blob.contentType,
        size: blob.bytes.byteLength,
      },
    };
  }),
  head: vi.fn(async (
    pathname: string,
    options: { token?: string },
  ) => {
    const blob = blobMockState.blobs.get(pathname);
    if (!blob || blob.token !== options.token) {
      throw new Error("Blob not found");
    }
    return {
      pathname,
      url: `https://blob.example/${pathname}`,
      downloadUrl: `https://blob.example/${pathname}?download=1`,
      contentType: blob.contentType,
      contentDisposition: "inline",
      cacheControl: "no-store",
      uploadedAt: new Date(),
      etag: "test-etag",
      size: blob.bytes.byteLength,
    };
  }),
}));

import {
  artifactEvidenceExists,
  buildDeliveryManifest,
  resolveArtifactStore,
  storeJsonArtifact,
  writeDeliveryManifest,
  writeSignedArtifactManifest,
} from "./artifacts";
import { GET as downloadArtifact } from "../../../app/api/control/orchestration/artifacts/download/route";

const ORIGINAL_DEPLOYMENT_ENV = process.env.FOUNDEROS_DEPLOYMENT_ENV;
const ORIGINAL_INTEGRATION_ROOT = process.env.FOUNDEROS_INTEGRATION_ROOT;
const ORIGINAL_LOCAL_ARTIFACT_STORE_ROOT =
  process.env.FOUNDEROS_LOCAL_ARTIFACT_STORE_ROOT;
const ORIGINAL_ARTIFACT_STORE_MODE = process.env.FOUNDEROS_ARTIFACT_STORE_MODE;
const ORIGINAL_ARTIFACT_STORAGE_URI_PREFIX =
  process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX;
const ORIGINAL_ARTIFACT_SIGNED_URL_BASE =
  process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE;
const ORIGINAL_ARTIFACT_SIGNING_SECRET =
  process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET;
const ORIGINAL_ARTIFACT_OBJECT_MIRROR_ROOT =
  process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT;
const ORIGINAL_ARTIFACT_OBJECT_BACKEND =
  process.env.FOUNDEROS_ARTIFACT_OBJECT_BACKEND;
const ORIGINAL_BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const ORIGINAL_FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN =
  process.env.FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN;

let tempRoot = "";

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

beforeEach(() => {
  tempRoot = mkdtempSync(path.join(tmpdir(), "infinity-artifacts-"));
  process.env.FOUNDEROS_INTEGRATION_ROOT = tempRoot;
  delete process.env.FOUNDEROS_DEPLOYMENT_ENV;
  delete process.env.FOUNDEROS_LOCAL_ARTIFACT_STORE_ROOT;
  delete process.env.FOUNDEROS_ARTIFACT_STORE_MODE;
  delete process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX;
  delete process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE;
  delete process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET;
  delete process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT;
  delete process.env.FOUNDEROS_ARTIFACT_OBJECT_BACKEND;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN;
  blobMockState.blobs.clear();
});

afterEach(() => {
  restoreEnv("FOUNDEROS_DEPLOYMENT_ENV", ORIGINAL_DEPLOYMENT_ENV);
  restoreEnv("FOUNDEROS_INTEGRATION_ROOT", ORIGINAL_INTEGRATION_ROOT);
  restoreEnv("FOUNDEROS_LOCAL_ARTIFACT_STORE_ROOT", ORIGINAL_LOCAL_ARTIFACT_STORE_ROOT);
  restoreEnv("FOUNDEROS_ARTIFACT_STORE_MODE", ORIGINAL_ARTIFACT_STORE_MODE);
  restoreEnv(
    "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX",
    ORIGINAL_ARTIFACT_STORAGE_URI_PREFIX,
  );
  restoreEnv("FOUNDEROS_ARTIFACT_SIGNED_URL_BASE", ORIGINAL_ARTIFACT_SIGNED_URL_BASE);
  restoreEnv("FOUNDEROS_ARTIFACT_SIGNING_SECRET", ORIGINAL_ARTIFACT_SIGNING_SECRET);
  restoreEnv(
    "FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT",
    ORIGINAL_ARTIFACT_OBJECT_MIRROR_ROOT,
  );
  restoreEnv("FOUNDEROS_ARTIFACT_OBJECT_BACKEND", ORIGINAL_ARTIFACT_OBJECT_BACKEND);
  restoreEnv("BLOB_READ_WRITE_TOKEN", ORIGINAL_BLOB_READ_WRITE_TOKEN);
  restoreEnv(
    "FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN",
    ORIGINAL_FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN,
  );
  if (tempRoot) {
    rmSync(tempRoot, { recursive: true, force: true });
    tempRoot = "";
  }
});

describe("ArtifactStore", () => {
  test("local mode preserves file-backed artifacts with checksums and signed manifests", async () => {
    const stored = await storeJsonArtifact({
      key: "assemblies/initiative-1/task-1/work-units/attempt-1.json",
      payload: { ok: true },
    });
    const manifest = await writeSignedArtifactManifest({
      key: "assemblies/initiative-1/task-1/signed-artifact-manifest.json",
      subject: { kind: "assembly", initiativeId: "initiative-1" },
      artifacts: [stored],
    });

    expect(stored.uri).toMatch(/^file:\/\//);
    expect(stored.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(stored.localPath ?? "")).toBe(true);
    await expect(artifactEvidenceExists(stored.uri)).resolves.toBe(true);
    expect(manifest.manifest.signature.value).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(manifest.stored.localPath ?? "", "utf8")).toContain(
      "initiative-1",
    );
  });

  test("object mode returns immutable object URIs, signed download URLs, and mirrored bytes", async () => {
    process.env.FOUNDEROS_ARTIFACT_STORE_MODE = "r2";
    process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
      "r2://infinity-artifacts/prod";
    process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
      "https://shell.infinity.example/api/control/orchestration/artifacts/download";
    process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET = "test-signing-secret";
    process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT = path.join(
      tempRoot,
      "mirror",
    );

    const stored = await storeJsonArtifact({
      key: "deliveries/delivery-1/manifest.json",
      payload: { deliveryId: "delivery-1" },
    });
    const manifest = await writeSignedArtifactManifest({
      key: "deliveries/delivery-1/signed-artifact-manifest.json",
      subject: { kind: "delivery", deliveryId: "delivery-1" },
      artifacts: [stored],
    });

    expect(stored.uri).toBe(
      "r2://infinity-artifacts/prod/deliveries/delivery-1/manifest.json",
    );
    expect(stored.uri).not.toContain("file://");
    expect(stored.uri).not.toContain("/Users/martin");
    expect(stored.signedUrl).toMatch(
      /^https:\/\/shell\.infinity\.example\/api\/control\/orchestration\/artifacts\/download\?/,
    );
    expect(stored.signedUrl).toContain("signature=");
    await expect(artifactEvidenceExists(stored.uri)).resolves.toBe(true);
    const response = await downloadArtifact(new Request(stored.signedUrl));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-artifact-sha256")).toBe(stored.sha256);
    await expect(response.json()).resolves.toEqual({ deliveryId: "delivery-1" });
    expect(manifest.stored.uri).toBe(
      "r2://infinity-artifacts/prod/deliveries/delivery-1/signed-artifact-manifest.json",
    );
    expect(manifest.manifest.artifacts[0]).toEqual(
      expect.objectContaining({
        uri: stored.uri,
        sha256: stored.sha256,
      }),
    );
  });

  test("vercel blob object backend stores and downloads without a local mirror", async () => {
    process.env.FOUNDEROS_DEPLOYMENT_ENV = "staging";
    process.env.FOUNDEROS_ARTIFACT_STORE_MODE = "object";
    process.env.FOUNDEROS_ARTIFACT_OBJECT_BACKEND = "vercel_blob";
    process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
      "vercel-blob://infinity-staging";
    process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
      "https://shell.infinity.example/api/control/orchestration/artifacts/download";
    process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET = "test-signing-secret";
    process.env.BLOB_READ_WRITE_TOKEN = "blob-rw-token";

    const stored = await storeJsonArtifact({
      key: "deliveries/delivery-1/manifest.json",
      payload: { deliveryId: "delivery-1", hosted: true },
    });
    const manifest = await writeSignedArtifactManifest({
      key: "deliveries/delivery-1/signed-artifact-manifest.json",
      subject: { kind: "delivery", deliveryId: "delivery-1" },
      artifacts: [stored],
    });

    expect(stored.uri).toBe(
      "vercel-blob://infinity-staging/deliveries/delivery-1/manifest.json",
    );
    expect(stored.localPath).toBeNull();
    expect(stored.uri).not.toContain("file://");
    expect(stored.uri).not.toContain("/tmp/");
    expect(blobMockState.blobs.get(stored.key)?.token).toBe("blob-rw-token");
    await expect(artifactEvidenceExists(stored.uri)).resolves.toBe(true);

    const response = await downloadArtifact(new Request(stored.signedUrl));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("x-artifact-sha256")).toBe(stored.sha256);
    await expect(response.json()).resolves.toEqual({
      deliveryId: "delivery-1",
      hosted: true,
    });
    expect(manifest.stored.uri).toBe(
      "vercel-blob://infinity-staging/deliveries/delivery-1/signed-artifact-manifest.json",
    );
  });

  test("production-like deployments reject the local artifact store", () => {
    process.env.FOUNDEROS_DEPLOYMENT_ENV = "production";

    expect(() => resolveArtifactStore()).toThrow(
      /require non-local artifact storage/i,
    );
  });

  test("production-like object storage rejects local-looking prefixes and signed URL bases", () => {
    process.env.FOUNDEROS_DEPLOYMENT_ENV = "production";
    process.env.FOUNDEROS_ARTIFACT_STORE_MODE = "r2";
    process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
      "file:///Users/martin/infinity/artifacts";
    process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
      "https://shell.infinity.example/api/control/orchestration/artifacts/download";
    process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET = "test-signing-secret";
    process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT = "/mnt/infinity-artifacts";

    expect(() => resolveArtifactStore()).toThrow(/must not be a local/i);

    process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
      "s3://infinity-artifacts/prod";
    expect(() => resolveArtifactStore()).toThrow(/must start with r2:\/\//i);

    process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
      "r2://infinity-artifacts/prod";
    process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
      "http://127.0.0.1:3737/api/control/orchestration/artifacts/download";
    expect(() => resolveArtifactStore()).toThrow(/must not point to localhost/i);

    process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
      "https://shell.infinity.example/api/control/orchestration/artifacts/download";
    process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT =
      "/Users/martin/infinity/.local-state/artifacts";
    expect(() => resolveArtifactStore()).toThrow(/durable object-store mount/i);

    process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT =
      "/tmp/infinity-artifact-mirror";
    expect(() => resolveArtifactStore()).toThrow(/durable object-store mount/i);
  });
});

function readGoldenDeliveryManifest(name: "local" | "production") {
  return JSON.parse(
    readFileSync(
      new URL(`./fixtures/delivery-manifests/${name}.json`, import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

const goldenAssembly: AssemblyRecord = {
  id: "assembly-golden",
  initiativeId: "initiative-golden",
  taskGraphId: "task-graph-golden",
  inputWorkUnitIds: ["work-unit-ui", "work-unit-api"],
  artifactUris: [
    "file:///tmp/infinity-delivery/golden-local/runnable-result.zip",
  ],
  outputLocation: "/tmp/infinity-delivery/golden-local",
  manifestPath: "file:///tmp/infinity-delivery/golden-local/assembly-manifest.json",
  summary: "Golden assembly for delivery manifest compatibility tests.",
  status: "assembled",
  createdAt: "2026-04-25T00:00:00.000Z",
  updatedAt: "2026-04-25T00:01:00.000Z",
};

const goldenVerification: VerificationRunRecord = {
  id: "verification-golden",
  initiativeId: "initiative-golden",
  assemblyId: "assembly-golden",
  checks: [
    {
      name: "targeted_tests_passed",
      status: "passed",
      details: "Focused manifest compatibility fixture passed.",
    },
  ],
  overallStatus: "passed",
  startedAt: "2026-04-25T00:02:00.000Z",
  finishedAt: "2026-04-25T00:03:00.000Z",
};

const localGoldenDelivery: DeliveryRecord = {
  id: "delivery-golden-local",
  initiativeId: "initiative-golden",
  verificationRunId: "verification-golden",
  taskGraphId: "task-graph-golden",
  resultSummary: "Runnable local handoff generated.",
  localOutputPath: "/tmp/infinity-delivery/golden-local",
  previewUrl: "http://127.0.0.1:4173",
  launchManifestPath: "/tmp/infinity-delivery/golden-local/launch-manifest.json",
  launchProofKind: "runnable_result",
  launchTargetLabel: "Vite preview",
  launchProofUrl: "http://127.0.0.1:4173",
  launchProofAt: "2026-04-25T00:04:00.000Z",
  readinessTier: "local_solo",
  handoffNotes: "Local-only handoff; production proof missing.",
  status: "ready",
  deliveredAt: "2026-04-25T00:05:00.000Z",
  command: "npm run preview",
};

const productionGoldenDelivery: DeliveryRecord = {
  id: "delivery-golden-production",
  initiativeId: "initiative-golden",
  verificationRunId: "verification-golden",
  taskGraphId: "task-graph-golden",
  resultSummary: "Production delivery proof generated.",
  localOutputPath: null,
  previewUrl: null,
  launchManifestPath:
    "r2://infinity-artifacts/prod/deliveries/initiative-golden/delivery-golden-production/launch/launch-manifest.json",
  launchProofKind: "runnable_result",
  launchTargetLabel: "Hosted Vercel preview",
  launchProofUrl: "https://delivery-golden-production.preview.infinity.example",
  launchProofAt: "2026-04-25T00:04:00.000Z",
  externalPullRequestUrl:
    "https://github.com/founderos/infinity/pull/1234",
  externalPullRequestId: "1234",
  externalPreviewUrl:
    "https://delivery-golden-production.preview.infinity.example",
  externalPreviewProvider: "vercel",
  externalPreviewDeploymentId: "dpl_golden_delivery",
  externalProofManifestPath:
    "r2://infinity-artifacts/prod/deliveries/initiative-golden/delivery-golden-production/external-delivery-proof.json",
  ciProofUri:
    "https://github.com/founderos/infinity/commit/mock-golden/checks",
  ciProofProvider: "github_commit_status",
  ciProofId: "ci-golden-delivery",
  artifactStorageUri:
    "r2://infinity-artifacts/prod/deliveries/initiative-golden/delivery-golden-production",
  signedManifestUri:
    "https://shell.infinity.example/api/control/orchestration/artifacts/download?key=deliveries%2Finitiative-golden%2Fdelivery-golden-production%2Fsigned-artifact-manifest.json&signature=golden",
  externalDeliveryProof: {
    provider: "vercel",
    pullRequestId: "1234",
    deploymentId: "dpl_golden_delivery",
    ciProofId: "ci-golden-delivery",
  },
  readinessTier: "production",
  handoffNotes: "Production proof includes PR, preview, CI, and signed manifest.",
  status: "ready",
  deliveredAt: "2026-04-25T00:05:00.000Z",
  command: null,
};

describe("delivery manifest golden fixtures", () => {
  test("local delivery manifest stays compatible with the golden fixture", () => {
    const manifest = buildDeliveryManifest({
      delivery: localGoldenDelivery,
      assembly: goldenAssembly,
      verification: goldenVerification,
    });

    expect(manifest).toEqual(readGoldenDeliveryManifest("local"));
  });

  test("production object-store delivery manifest stays compatible with the golden fixture", async () => {
    process.env.FOUNDEROS_ARTIFACT_STORE_MODE = "r2";
    process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
      "r2://infinity-artifacts/prod";
    process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
      "https://shell.infinity.example/api/control/orchestration/artifacts/download";
    process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET = "test-signing-secret";
    process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT = path.join(
      tempRoot,
      "mirror",
    );

    const { manifest } = await writeDeliveryManifest({
      delivery: productionGoldenDelivery,
      assembly: {
        ...goldenAssembly,
        artifactUris: [
          "r2://infinity-artifacts/prod/assemblies/initiative-golden/task-graph-golden/runnable-result.zip",
        ],
        outputLocation: null,
        manifestPath:
          "r2://infinity-artifacts/prod/assemblies/initiative-golden/task-graph-golden/signed-artifact-manifest.json",
      },
      verification: goldenVerification,
    });

    expect(manifest).toEqual(readGoldenDeliveryManifest("production"));
  });
});
