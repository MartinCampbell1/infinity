import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  artifactEvidenceExists,
  resolveArtifactStore,
  storeJsonArtifact,
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
  if (tempRoot) {
    rmSync(tempRoot, { recursive: true, force: true });
    tempRoot = "";
  }
});

describe("ArtifactStore", () => {
  test("local mode preserves file-backed artifacts with checksums and signed manifests", () => {
    const stored = storeJsonArtifact({
      key: "assemblies/initiative-1/task-1/work-units/attempt-1.json",
      payload: { ok: true },
    });
    const manifest = writeSignedArtifactManifest({
      key: "assemblies/initiative-1/task-1/signed-artifact-manifest.json",
      subject: { kind: "assembly", initiativeId: "initiative-1" },
      artifacts: [stored],
    });

    expect(stored.uri).toMatch(/^file:\/\//);
    expect(stored.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(stored.localPath ?? "")).toBe(true);
    expect(artifactEvidenceExists(stored.uri)).toBe(true);
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

    const stored = storeJsonArtifact({
      key: "deliveries/delivery-1/manifest.json",
      payload: { deliveryId: "delivery-1" },
    });
    const manifest = writeSignedArtifactManifest({
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
    expect(artifactEvidenceExists(stored.uri)).toBe(true);
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
