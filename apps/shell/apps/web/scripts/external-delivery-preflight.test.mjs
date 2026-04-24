import { spawnSync } from "node:child_process";
import process from "node:process";

import { describe, expect, test } from "vitest";

function preflightEnv(overrides = {}) {
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

const successfulDiscoveryFetch = `
  globalThis.fetch = async (url) => {
    const pathname = new URL(String(url)).pathname;
    if (pathname === "/repos/founderos/infinity") {
      return new Response(JSON.stringify({
        full_name: "founderos/infinity",
        permissions: { push: true }
      }), { status: 200 });
    }
    if (pathname === "/repos/founderos/infinity/branches/main") {
      return new Response(JSON.stringify({ name: "main" }), { status: 200 });
    }
    if (pathname === "/v10/projects") {
      return new Response(JSON.stringify({ projects: [] }), { status: 200 });
    }
    if (pathname === "/v9/projects/prj_founderos_infinity") {
      return new Response(JSON.stringify({
        id: "prj_founderos_infinity",
        name: "infinity-web",
        link: {
          repo: "founderos/infinity",
          repoId: "123456789"
        }
      }), { status: 200 });
    }
    if (String(url).startsWith("https://artifacts.infinity.example/download")) {
      return new Response(JSON.stringify({ error: "artifact_unavailable" }), {
        status: 403,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error("Unexpected fetch " + url);
  };
`;

function runPreflightWithFetch(env = preflightEnv(), preloadSource = successfulDiscoveryFetch) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      `data:text/javascript,${encodeURIComponent(preloadSource)}`,
      "./scripts/external-delivery-preflight.mjs",
    ],
    {
      cwd: new URL("..", import.meta.url),
      env,
      encoding: "utf8",
    },
  );
}

describe("external delivery preflight", () => {
  test("requires explicit staging deployment env before provider requests", () => {
    const env = preflightEnv();
    delete env.FOUNDEROS_DEPLOYMENT_ENV;
    const result = runPreflightWithFetch(
      env,
      `
        globalThis.fetch = async (url) => {
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "external delivery preflight missing required env keys: FOUNDEROS_DEPLOYMENT_ENV",
    );
    expect(result.stderr).not.toContain("Unexpected fetch");
  });

  test("rejects local signed artifact URL bases before provider requests", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_ARTIFACT_SIGNED_URL_BASE:
          "http://127.0.0.1:3000/api/control/orchestration/artifacts/download",
      }),
      `
        globalThis.fetch = async (url) => {
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE to be a hosted HTTPS URL",
    );
    expect(result.stderr).not.toContain("Unexpected fetch");
  });

  test("rejects wildcard signed artifact URL bases before provider requests", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_ARTIFACT_SIGNED_URL_BASE:
          "https://0.0.0.0/api/control/orchestration/artifacts/download",
      }),
      `
        globalThis.fetch = async (url) => {
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE to be a hosted HTTPS URL",
    );
    expect(result.stderr).not.toContain("Unexpected fetch");
  });

  test("rejects local artifact storage URI prefixes before provider requests", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX: "/Users/martin/infinity/artifacts",
      }),
      `
        globalThis.fetch = async (url) => {
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX to be non-local object storage",
    );
    expect(result.stderr).not.toContain("Unexpected fetch");
  });

  test("rejects artifact storage URI prefixes with the wrong object-store scheme", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_ARTIFACT_STORE_MODE: "r2",
        FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX: "s3://infinity-artifacts/prod",
      }),
      `
        globalThis.fetch = async (url) => {
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX to start with r2://",
    );
    expect(result.stderr).not.toContain("Unexpected fetch");
  });

  test("rejects /Users object mirror roots before provider requests", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT:
          "/Users/martin/infinity/.local-state/artifact-mirror",
      }),
      `
        globalThis.fetch = async (url) => {
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT to be a hosted-readable durable artifact mount",
    );
    expect(result.stderr).not.toContain("Unexpected fetch");
  });

  test("rejects temp object mirror roots before provider requests", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT:
          "/tmp/infinity-artifact-mirror",
      }),
      `
        globalThis.fetch = async (url) => {
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT to be a hosted-readable durable artifact mount",
    );
    expect(result.stderr).not.toContain("Unexpected fetch");
  });

  test("requires a blob token for the Vercel Blob object backend before provider requests", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_ARTIFACT_STORE_MODE: "object",
        FOUNDEROS_ARTIFACT_OBJECT_BACKEND: "vercel_blob",
        FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX:
          "vercel-blob://infinity-staging",
        FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT: "",
      }),
      `
        globalThis.fetch = async (url) => {
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BLOB_READ_WRITE_TOKEN");
    expect(result.stderr).not.toContain("Unexpected fetch");
  });

  test("accepts Vercel Blob object backend without a local mirror root", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS: "1",
        FOUNDEROS_ARTIFACT_STORE_MODE: "object",
        FOUNDEROS_ARTIFACT_OBJECT_BACKEND: "vercel_blob",
        FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX:
          "vercel-blob://infinity-staging",
        FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT: "",
        BLOB_READ_WRITE_TOKEN: "blob-token",
      }),
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Signed artifact download route preflight passed.");
    expect(result.stdout).toContain("external delivery preflight passed");
  });

  test("rejects invalid GitHub repository format before provider requests", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_GITHUB_REPOSITORY: "founderos",
      }),
      `
        globalThis.fetch = async (url) => {
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "FOUNDEROS_GITHUB_REPOSITORY must be formatted as owner/repo",
    );
    expect(result.stderr).not.toContain("Unexpected fetch");
  });

  test("checks GitHub read access before Vercel discovery", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_GITHUB_TOKEN: "github-token",
      }),
      `
        globalThis.fetch = async (url) => {
          const pathname = new URL(String(url)).pathname;
          if (pathname === "/repos/founderos/infinity") {
            return new Response(JSON.stringify({
              message: "Bad credentials for github-token"
            }), { status: 401 });
          }
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("GitHub / failed with 401");
    expect(result.stderr).toContain("[REDACTED]");
    expect(result.stderr).not.toContain("github-token");
    expect(result.stderr).not.toContain("No Vercel project linked");
  });

  test("rejects GitHub tokens without push permission before Vercel discovery", () => {
    const result = runPreflightWithFetch(
      preflightEnv(),
      `
        globalThis.fetch = async (url) => {
          const pathname = new URL(String(url)).pathname;
          if (pathname === "/repos/founderos/infinity") {
            return new Response(JSON.stringify({
              full_name: "founderos/infinity",
              permissions: { push: false }
            }), { status: 200 });
          }
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "GitHub token does not have push permission for founderos/infinity",
    );
    expect(result.stderr).not.toContain("No Vercel project linked");
  });

  test("rejects missing GitHub base branch before Vercel discovery", () => {
    const fakeGithubToken = "gh" + "p_SECRET_TEST_TOKEN_123456789";
    const result = runPreflightWithFetch(
      preflightEnv(),
      `
        const fakeGithubToken = "gh" + "p_SECRET_TEST_TOKEN_123456789";
        globalThis.fetch = async (url) => {
          const pathname = new URL(String(url)).pathname;
          if (pathname === "/repos/founderos/infinity") {
            return new Response(JSON.stringify({
              full_name: "founderos/infinity",
              permissions: { push: true }
            }), { status: 200 });
          }
          if (pathname === "/repos/founderos/infinity/branches/main") {
            return new Response(JSON.stringify({
              message: "Branch not found for github-token and " + fakeGithubToken
            }), { status: 404 });
          }
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "GitHub /branches/main failed with 404: Branch not found for [REDACTED] and [REDACTED]",
    );
    expect(result.stderr).not.toContain("github-token");
    expect(result.stderr).not.toContain(fakeGithubToken);
    expect(result.stderr).not.toContain("No Vercel project linked");
  });

  test("runs read-only discovery before requiring mutation confirmation", () => {
    const result = runPreflightWithFetch();

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("GitHub preflight passed for founderos/infinity main.");
    expect(result.stdout).toContain(
      "Found configured Vercel project by direct project preflight",
    );
    expect(result.stdout).toContain("Signed artifact download route preflight passed.");
    expect(result.stderr).toContain(
      "FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1",
    );
  });

  test("passes only after discovery and explicit mutation confirmation are present", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS: "1",
      }),
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("GitHub preflight passed for founderos/infinity main.");
    expect(result.stdout).toContain("Signed artifact download route preflight passed.");
    expect(result.stdout).toContain("external delivery preflight passed");
  });

  test("rejects missing hosted signed artifact download routes before mutation confirmation", () => {
    const result = runPreflightWithFetch(
      preflightEnv(),
      `
        ${successfulDiscoveryFetch}
        const discoveryFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).startsWith("https://artifacts.infinity.example/download")) {
            return new Response("<!doctype html>not found", { status: 404 });
          }
          return discoveryFetch(url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("GitHub preflight passed for founderos/infinity main.");
    expect(result.stderr).toContain("deployed artifact download route");
    expect(result.stderr).not.toContain(
      "FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1",
    );
  });

  test("rejects protected hosted signed artifact download routes without bypass", () => {
    const result = runPreflightWithFetch(
      preflightEnv(),
      `
        ${successfulDiscoveryFetch}
        const discoveryFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).startsWith("https://artifacts.infinity.example/download")) {
            return new Response("<!doctype html>authentication required", { status: 401 });
          }
          return discoveryFetch(url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("GitHub preflight passed for founderos/infinity main.");
    expect(result.stderr).toContain("Vercel Deployment Protection");
    expect(result.stderr).not.toContain(
      "FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1",
    );
  });

  test("sends Vercel protection bypass header when configured", () => {
    const result = runPreflightWithFetch(
      preflightEnv({
        FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS: "1",
        FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET: "bypass-secret",
      }),
      `
        ${successfulDiscoveryFetch}
        const discoveryFetch = globalThis.fetch;
        globalThis.fetch = async (url, init) => {
          if (String(url).startsWith("https://artifacts.infinity.example/download")) {
            if (init?.headers?.["x-vercel-protection-bypass"] !== "bypass-secret") {
              throw new Error("Missing Vercel protection bypass header");
            }
          }
          return discoveryFetch(url, init);
        };
      `,
    );

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("Missing Vercel protection bypass header");
    expect(result.stdout).toContain("external delivery preflight passed");
  });

  test("reports discovery failures before mutation confirmation", () => {
    const result = runPreflightWithFetch(
      preflightEnv(),
      `
        globalThis.fetch = async (url) => {
          const pathname = new URL(String(url)).pathname;
          if (pathname === "/repos/founderos/infinity") {
            return new Response(JSON.stringify({
              full_name: "founderos/infinity",
              permissions: { push: true }
            }), { status: 200 });
          }
          if (pathname === "/repos/founderos/infinity/branches/main") {
            return new Response(JSON.stringify({ name: "main" }), { status: 200 });
          }
          if (pathname === "/v10/projects") {
            return new Response(JSON.stringify({ projects: [] }), { status: 200 });
          }
          if (pathname === "/v9/projects/prj_founderos_infinity") {
            return new Response(JSON.stringify({
              error: { message: "Project not found." }
            }), { status: 404 });
          }
          if (pathname === "/v9/projects") {
            return new Response(JSON.stringify({ projects: [] }), { status: 200 });
          }
          if (pathname === "/v2/teams") {
            return new Response(JSON.stringify({
              error: { message: "Team list forbidden." }
            }), { status: 403 });
          }
          throw new Error("Unexpected fetch " + url);
        };
      `,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Direct preflight for configured Vercel project prj_founderos_infinity also failed",
    );
    expect(result.stderr).toContain("Vercel access diagnostics:");
    expect(result.stderr).not.toContain(
      "FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1",
    );
  });
});
