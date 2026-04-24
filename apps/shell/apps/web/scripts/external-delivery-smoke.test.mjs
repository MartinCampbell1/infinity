import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");

function smokeEnv(overrides = {}) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    FOUNDEROS_DEPLOYMENT_ENV: "staging",
    FOUNDEROS_EXTERNAL_DELIVERY_MODE: "github_vercel",
    FOUNDEROS_GITHUB_TOKEN: "github-token",
    FOUNDEROS_GITHUB_REPOSITORY: "founderos/infinity",
    FOUNDEROS_GITHUB_BASE_BRANCH: "main",
    FOUNDEROS_VERCEL_TOKEN: "vercel-token",
    FOUNDEROS_VERCEL_PROJECT_ID: "prj_founderos_infinity",
    FOUNDEROS_VERCEL_GIT_REPO_ID: "123456789",
    FOUNDEROS_ARTIFACT_STORE_MODE: "r2",
    FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX: "r2://infinity-artifacts/prod",
    FOUNDEROS_ARTIFACT_SIGNED_URL_BASE:
      "https://artifacts.infinity.example/download",
    FOUNDEROS_ARTIFACT_SIGNING_SECRET: "artifact-signing-secret",
    FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT: "/mnt/infinity-artifacts",
    FOUNDEROS_EXTERNAL_PREVIEW_EXPECTED_TEXT: "Infinity",
    ...overrides,
  };
}

describe("external delivery smoke launcher", () => {
  test("requires explicit staging deployment env before provider smoke starts", () => {
    const env = smokeEnv();
    delete env.FOUNDEROS_DEPLOYMENT_ENV;
    const result = spawnSync(
      process.execPath,
      ["./scripts/external-delivery-smoke.mjs"],
      {
        cwd: appRoot,
        env,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "external delivery smoke missing required env keys: FOUNDEROS_DEPLOYMENT_ENV",
    );
  });

  test("rejects local signed artifact URL bases before provider smoke starts", () => {
    const result = spawnSync(
      process.execPath,
      ["./scripts/external-delivery-smoke.mjs"],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_ARTIFACT_SIGNED_URL_BASE:
            "file:///Users/martin/infinity/artifacts/download",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE to be a hosted HTTPS URL",
    );
  });

  test("rejects wildcard signed artifact URL bases before provider smoke starts", () => {
    const result = spawnSync(
      process.execPath,
      ["./scripts/external-delivery-smoke.mjs"],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_ARTIFACT_SIGNED_URL_BASE:
            "https://0.0.0.0/api/control/orchestration/artifacts/download",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE to be a hosted HTTPS URL",
    );
  });

  test("rejects local artifact storage URI prefixes before provider smoke starts", () => {
    const result = spawnSync(
      process.execPath,
      ["./scripts/external-delivery-smoke.mjs"],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX:
            "http://localhost:3000/artifacts",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX to be non-local object storage",
    );
  });

  test("rejects artifact storage URI prefixes with the wrong object-store scheme", () => {
    const result = spawnSync(
      process.execPath,
      ["./scripts/external-delivery-smoke.mjs"],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_ARTIFACT_STORE_MODE: "r2",
          FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX:
            "s3://infinity-artifacts/prod",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX to start with r2://",
    );
  });

  test("rejects /Users object mirror roots before provider smoke starts", () => {
    const result = spawnSync(
      process.execPath,
      ["./scripts/external-delivery-smoke.mjs"],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT:
            "/Users/martin/infinity/.local-state/artifact-mirror",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT to be a hosted-readable durable artifact mount",
    );
  });

  test("rejects temp object mirror roots before provider smoke starts", () => {
    const result = spawnSync(
      process.execPath,
      ["./scripts/external-delivery-smoke.mjs"],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT:
            "/var/folders/ng/infinity-artifact-mirror",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT to be a hosted-readable durable artifact mount",
    );
  });

  test("requires a blob token for the Vercel Blob object backend before provider smoke starts", () => {
    const result = spawnSync(
      process.execPath,
      ["./scripts/external-delivery-smoke.mjs"],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_ARTIFACT_STORE_MODE: "object",
          FOUNDEROS_ARTIFACT_OBJECT_BACKEND: "vercel_blob",
          FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX:
            "vercel-blob://infinity-staging",
          FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT: "",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("BLOB_READ_WRITE_TOKEN");
  });

  test("accepts Vercel Blob object backend without a local mirror root", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(`
          globalThis.fetch = async () =>
            new Response("<!doctype html>not found", { status: 404 });
        `)}`,
        "./scripts/external-delivery-smoke.mjs",
      ],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS: "1",
          FOUNDEROS_ARTIFACT_STORE_MODE: "object",
          FOUNDEROS_ARTIFACT_OBJECT_BACKEND: "vercel_blob",
          FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX:
            "vercel-blob://infinity-staging",
          FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT: "",
          BLOB_READ_WRITE_TOKEN: "blob-token",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "deployed artifact download route",
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain(
      "hosted-readable durable artifact mount",
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain("RUN  v");
  });

  test("rejects local artifact mode before provider smoke starts", () => {
    const result = spawnSync(
      process.execPath,
      ["./scripts/external-delivery-smoke.mjs"],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_ARTIFACT_STORE_MODE: "local",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "FOUNDEROS_ARTIFACT_STORE_MODE to be s3, gcs, r2, or object",
    );
  });

  test("requires explicit mutation confirmation before provider smoke starts", () => {
    const result = spawnSync(
      process.execPath,
      ["./scripts/external-delivery-smoke.mjs"],
      {
        cwd: appRoot,
        env: smokeEnv(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1",
    );
  });

  test("rejects missing hosted signed artifact download routes before provider smoke starts", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(`
          globalThis.fetch = async () =>
            new Response("<!doctype html>not found", { status: 404 });
        `)}`,
        "./scripts/external-delivery-smoke.mjs",
      ],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS: "1",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "deployed artifact download route",
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain("RUN  v");
  });

  test("rejects protected hosted signed artifact download routes before provider smoke starts", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(`
          globalThis.fetch = async () =>
            new Response("<!doctype html>authentication required", { status: 401 });
        `)}`,
        "./scripts/external-delivery-smoke.mjs",
      ],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS: "1",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Vercel Deployment Protection",
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain("RUN  v");
  });

  test("sends Vercel protection bypass header when configured", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(`
          globalThis.fetch = async (_url, init) => {
            if (init?.headers?.["x-vercel-protection-bypass"] !== "bypass-secret") {
              throw new Error("Missing Vercel protection bypass header");
            }
            return new Response("<!doctype html>not found", { status: 404 });
          };
        `)}`,
        "./scripts/external-delivery-smoke.mjs",
      ],
      {
        cwd: appRoot,
        env: smokeEnv({
          FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS: "1",
          FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET: "bypass-secret",
        }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).not.toContain(
      "Missing Vercel protection bypass header",
    );
    expect(`${result.stdout}${result.stderr}`).toContain(
      "deployed artifact download route",
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain("RUN  v");
  });

  test("direct live smoke test also requires mutation confirmation", () => {
    const result = spawnSync(
      "npx",
      [
        "vitest",
        "run",
        "lib/server/orchestration/external-delivery.live.test.ts",
        "--testTimeout",
        "5000",
      ],
      {
        cwd: appRoot,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          FOUNDEROS_EXTERNAL_DELIVERY_LIVE_SMOKE: "1",
        },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1",
    );
  });
});
