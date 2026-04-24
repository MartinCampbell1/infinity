import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test, vi } from "vitest";

import { artifactLocalPath } from "./artifacts";
import { publishExternalDeliveryProof } from "./external-delivery";

const ORIGINAL_ENV = { ...process.env };
let tempDir = "";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function externalDeliveryInput() {
  return {
    deliveryId: "delivery-live-001",
    initiativeId: "initiative-live-001",
    artifactStorageUri:
      "r2://infinity-artifacts/prod/deliveries/initiative-live-001/delivery-live-001",
    signedManifestUri:
      "https://artifacts.infinity.example/download?key=signed-artifact-manifest.json",
    deliveryManifestUri:
      "r2://infinity-artifacts/prod/deliveries/initiative-live-001/delivery-live-001/delivery-manifest.json",
    launchManifestUri:
      "r2://infinity-artifacts/prod/deliveries/initiative-live-001/delivery-live-001/launch/launch-manifest.json",
    hostedPreviewHtml:
      "<!doctype html><html><body>Infinity hosted runnable delivery result</body></html>",
    assembly: {
      id: "assembly-live-001",
      initiativeId: "initiative-live-001",
      taskGraphId: "task-graph-live-001",
      inputWorkUnitIds: ["work-unit-final"],
      artifactUris: [],
      outputLocation:
        "r2://infinity-artifacts/prod/assemblies/initiative-live-001",
      manifestPath:
        "r2://infinity-artifacts/prod/assemblies/initiative-live-001/assembly-manifest.json",
      summary: "Assembled.",
      status: "assembled" as const,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    },
    verification: {
      id: "verification-live-001",
      initiativeId: "initiative-live-001",
      assemblyId: "assembly-live-001",
      checks: [],
      overallStatus: "passed" as const,
    },
  };
}

function configureObjectArtifacts() {
  tempDir = mkdtempSync(path.join(tmpdir(), "external-delivery-"));
  process.env.FOUNDEROS_ARTIFACT_STORE_MODE = "r2";
  process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
    "r2://infinity-artifacts/prod";
  process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
    "https://artifacts.infinity.example/download";
  process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET =
    "test-artifact-signing-secret";
  process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT = tempDir;
}

function configureGithubVercel() {
  process.env.FOUNDEROS_EXTERNAL_DELIVERY_MODE = "github_vercel";
  process.env.FOUNDEROS_GITHUB_TOKEN = "github-token";
  process.env.FOUNDEROS_GITHUB_REPOSITORY = "founderos/infinity";
  process.env.FOUNDEROS_GITHUB_BASE_BRANCH = "main";
  process.env.FOUNDEROS_VERCEL_TOKEN = "vercel-token";
  process.env.FOUNDEROS_VERCEL_PROJECT_ID = "prj_founderos_infinity";
  process.env.FOUNDEROS_VERCEL_GIT_REPO_ID = "123456789";
}

function configureGithubVercelWithTeamSlug() {
  configureGithubVercel();
  process.env.FOUNDEROS_VERCEL_TEAM_SLUG = "ls-projects-adb8778b";
}

function createGithubVercelFetchMock(options: { existingPullRequest?: boolean } = {}) {
  let blobIndex = 0;
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    const pathname = new URL(href).pathname;
    const method = init?.method ?? "GET";
    if (pathname === "/v9/projects/prj_founderos_infinity" && method === "GET") {
      return jsonResponse({
        id: "prj_founderos_infinity",
        name: "infinity-web",
      });
    }
    if (href.endsWith("/git/ref/heads/main")) {
      return jsonResponse({ object: { sha: "base-ref-sha" } });
    }
    if (href.endsWith("/git/commits/base-ref-sha")) {
      return jsonResponse({
        sha: "base-commit-sha",
        tree: { sha: "base-tree-sha" },
      });
    }
    if (href.endsWith("/git/blobs") && method === "POST") {
      blobIndex += 1;
      return jsonResponse(
        { sha: blobIndex === 1 ? "proof-blob-sha" : "preview-blob-sha" },
        201,
      );
    }
    if (href.endsWith("/git/trees") && method === "POST") {
      return jsonResponse({ sha: "proof-tree-sha" }, 201);
    }
    if (href.endsWith("/git/commits") && method === "POST") {
      return jsonResponse(
        {
          sha: "proof-commit-sha",
          html_url:
            "https://github.com/founderos/infinity/commit/proof-commit-sha",
        },
        201,
      );
    }
    if (href.includes("/git/refs/heads/delivery/delivery-live-001")) {
      return jsonResponse({ ref: "refs/heads/delivery/delivery-live-001" });
    }
    if (href.includes("/pulls?")) {
      return jsonResponse(
        options.existingPullRequest
          ? [
              {
                id: 9876,
                number: 42,
                html_url: "https://github.com/founderos/infinity/pull/42",
              },
            ]
          : [],
      );
    }
    if (href.endsWith("/pulls/42") && method === "PATCH") {
      return jsonResponse({
        id: 9876,
        number: 42,
        html_url: "https://github.com/founderos/infinity/pull/42",
      });
    }
    if (href.endsWith("/pulls") && method === "POST") {
      return jsonResponse(
        {
          id: 9876,
          number: 42,
          html_url: "https://github.com/founderos/infinity/pull/42",
        },
        201,
      );
    }
    if (pathname === "/v13/deployments" && method === "POST") {
      return jsonResponse(
        {
          id: "dpl_live_001",
          url: "delivery-live-001.vercel.app",
          readyState: "BUILDING",
        },
        201,
      );
    }
    if (pathname === "/v13/deployments/dpl_live_001") {
      return jsonResponse({
        id: "dpl_live_001",
        url: "delivery-live-001.vercel.app",
        readyState: "READY",
      });
    }
    if (href.endsWith("/commits/proof-commit-sha/status")) {
      return jsonResponse({
        state: "success",
        target_url: "https://github.com/founderos/infinity/actions/runs/42",
        statuses: [
          {
            id: 4242,
            context: "github-actions",
            state: "success",
            target_url:
              "https://github.com/founderos/infinity/actions/runs/42",
          },
        ],
      });
    }
    throw new Error(`Unexpected fetch ${method} ${href}`);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("external delivery publisher", () => {
  test("rejects mock provider mode in production-like deployments", async () => {
    process.env.FOUNDEROS_EXTERNAL_DELIVERY_MODE = "mock";
    process.env.FOUNDEROS_DEPLOYMENT_ENV = "production";

    await expect(
      publishExternalDeliveryProof({
        ...externalDeliveryInput(),
        deliveryId: "delivery-external-guard-001",
        initiativeId: "initiative-external-guard-001",
      }),
    ).rejects.toThrow(/mock is only allowed for local integration tests/i);
  });

  test("publishes live GitHub PR, Vercel preview, CI proof, and immutable proof manifest", async () => {
    configureObjectArtifacts();
    configureGithubVercel();
    const fetchMock = createGithubVercelFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishExternalDeliveryProof(externalDeliveryInput());

    expect(result?.externalPullRequestUrl).toBe(
      "https://github.com/founderos/infinity/pull/42",
    );
    expect(result?.externalPullRequestId).toBe("9876");
    expect(result?.externalPreviewUrl).toBe(
      "https://delivery-live-001.vercel.app/deliveries/delivery-live-001/index.html",
    );
    expect(result?.externalPreviewDeploymentId).toBe("dpl_live_001");
    expect(result?.ciProofUri).toBe(
      "https://github.com/founderos/infinity/actions/runs/42",
    );
    expect(result?.ciProofProvider).toBe("github_commit_status");
    const proofManifestPath = artifactLocalPath(result?.externalProofManifestPath);
    expect(proofManifestPath).toBeTruthy();
    const proofManifestJson = JSON.stringify(result?.externalDeliveryProof);
    expect(proofManifestJson).toContain("proof-commit-sha");
    expect(proofManifestJson).toContain(
      "apps/shell/apps/web/public/deliveries/delivery-live-001/index.html",
    );
    expect(proofManifestJson).toContain(
      "/deliveries/delivery-live-001/index.html",
    );
    expect(proofManifestJson).toContain("dpl_live_001");
    expect(proofManifestJson).toContain("r2://infinity-artifacts/prod");
    expect(proofManifestJson).not.toContain("file://");
    expect(proofManifestJson).not.toContain(tempDir);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        "https://api.github.com/repos/founderos/infinity/git/ref/heads/main",
        "https://api.github.com/repos/founderos/infinity/git/blobs",
        "https://api.github.com/repos/founderos/infinity/git/trees",
        "https://api.github.com/repos/founderos/infinity/git/commits",
        "https://api.github.com/repos/founderos/infinity/pulls?state=open&head=founderos%3Adelivery%2Fdelivery-live-001&base=main",
        "https://api.github.com/repos/founderos/infinity/pulls",
        "https://api.vercel.com/v9/projects/prj_founderos_infinity",
        "https://api.vercel.com/v13/deployments",
        "https://api.vercel.com/v13/deployments/dpl_live_001",
        "https://api.github.com/repos/founderos/infinity/commits/proof-commit-sha/status",
      ]),
    );
    const treeRequestBody = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/git/trees"),
    )?.[1]?.body;
    expect(String(treeRequestBody)).toContain(
      "delivery-proofs/delivery-live-001.json",
    );
    expect(String(treeRequestBody)).toContain(
      "apps/shell/apps/web/public/deliveries/delivery-live-001/index.html",
    );
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(
      requestedUrls.indexOf("https://api.vercel.com/v9/projects/prj_founderos_infinity"),
    ).toBeLessThan(
      requestedUrls.indexOf(
        "https://api.github.com/repos/founderos/infinity/git/ref/heads/main",
      ),
    );
  });

  test("rejects hosted preview payloads with local-only URLs", async () => {
    configureObjectArtifacts();
    configureGithubVercel();

    await expect(
      publishExternalDeliveryProof({
        ...externalDeliveryInput(),
        hostedPreviewHtml: "<html>http://127.0.0.1:3000/index.html</html>",
      }),
    ).rejects.toThrow(/hosted preview html must not contain local paths/i);
  });

  test("rejects hosted preview payloads with wildcard local URLs", async () => {
    configureObjectArtifacts();
    configureGithubVercel();

    await expect(
      publishExternalDeliveryProof({
        ...externalDeliveryInput(),
        hostedPreviewHtml: "<html>https://0.0.0.0:3000/index.html</html>",
      }),
    ).rejects.toThrow(/hosted preview html must not contain local paths/i);
  });

  test("updates an existing delivery pull request instead of opening a duplicate", async () => {
    configureObjectArtifacts();
    configureGithubVercel();
    const fetchMock = createGithubVercelFetchMock({ existingPullRequest: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishExternalDeliveryProof(externalDeliveryInput());

    expect(result?.externalPullRequestUrl).toBe(
      "https://github.com/founderos/infinity/pull/42",
    );
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        "https://api.github.com/repos/founderos/infinity/pulls?state=open&head=founderos%3Adelivery%2Fdelivery-live-001&base=main",
        "https://api.github.com/repos/founderos/infinity/pulls/42",
      ]),
    );
    expect(
      fetchMock.mock.calls.some(([url, init]) => {
        return String(url).endsWith("/pulls") && init?.method === "POST";
      }),
    ).toBe(false);
  });

  test("fails Vercel project preflight before mutating GitHub", async () => {
    configureObjectArtifacts();
    configureGithubVercel();
    const fakeVercelTokenPattern = "v" + "ck_SECRET_TEST_TOKEN_123456789";
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? "GET";
      if (href === "https://api.vercel.com/v9/projects/prj_founderos_infinity") {
        return jsonResponse(
          {
            message:
              `Project not found for vercel-token and ${fakeVercelTokenPattern}.`,
          },
          404,
        );
      }
      throw new Error(`Unexpected fetch ${method} ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    let observedError: unknown;
    try {
      await publishExternalDeliveryProof(externalDeliveryInput());
    } catch (error) {
      observedError = error;
    }
    expect(observedError).toBeInstanceOf(Error);
    expect((observedError as Error).message).toMatch(
      /Vercel .*Project not found for \[REDACTED\] and \[REDACTED\]/i,
    );
    expect((observedError as Error).message).not.toMatch(
      new RegExp(`vercel-token|${fakeVercelTokenPattern}`, "i"),
    );

    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).startsWith("https://api.github.com/"),
      ),
    ).toBe(false);
  });

  test("uses Vercel team slug for scoped project and deployment requests", async () => {
    configureObjectArtifacts();
    configureGithubVercelWithTeamSlug();
    const fetchMock = createGithubVercelFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await publishExternalDeliveryProof(externalDeliveryInput());

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        "https://api.vercel.com/v9/projects/prj_founderos_infinity?slug=ls-projects-adb8778b",
        "https://api.vercel.com/v13/deployments?slug=ls-projects-adb8778b",
        "https://api.vercel.com/v13/deployments/dpl_live_001?slug=ls-projects-adb8778b",
      ]),
    );
  });
});
