import { spawnSync } from "node:child_process";
import process from "node:process";

import { describe, expect, test } from "vitest";

function discoverEnv(overrides = {}) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    FOUNDEROS_GITHUB_REPOSITORY: "founderos/infinity",
    FOUNDEROS_VERCEL_GIT_REPO_ID: "123456789",
    FOUNDEROS_VERCEL_PROJECT_ID: "prj_founderos_infinity",
    FOUNDEROS_VERCEL_TOKEN: "vercel-token",
    ...overrides,
  };
}

function runDiscoverWithFetch(preloadSource, env = discoverEnv()) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      `data:text/javascript,${encodeURIComponent(preloadSource)}`,
      "./scripts/external-delivery-vercel-discover.mjs",
    ],
    {
      cwd: new URL("..", import.meta.url),
      env,
      encoding: "utf8",
    },
  );
}

describe("external delivery Vercel discovery", () => {
  test("falls back to direct configured project preflight when repo search is empty", () => {
    const result = runDiscoverWithFetch(`
      globalThis.fetch = async (url) => {
        const pathname = new URL(String(url)).pathname;
        if (pathname === "/v10/projects") {
          return new Response(JSON.stringify({ projects: [] }), { status: 200 });
        }
        if (pathname === "/v9/projects/prj_founderos_infinity") {
          return new Response(JSON.stringify({
            id: "prj_founderos_infinity",
            name: "infinity-web",
            framework: "nextjs",
            rootDirectory: "apps/shell/apps/web",
            link: {
              repo: "founderos/infinity",
              repoId: "123456789",
              productionBranch: "main"
            }
          }), { status: 200 });
        }
        throw new Error("Unexpected fetch " + url);
      };
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Found configured Vercel project by direct project preflight",
    );
    expect(result.stdout).toContain(
      'export FOUNDEROS_VERCEL_PROJECT_ID="prj_founderos_infinity"',
    );
  });

  test("reports readable configured projects with mismatched Git links", () => {
    const result = runDiscoverWithFetch(`
      globalThis.fetch = async (url) => {
        const pathname = new URL(String(url)).pathname;
        if (pathname === "/v10/projects") {
          return new Response(JSON.stringify({ projects: [] }), { status: 200 });
        }
        if (pathname === "/v9/projects/prj_founderos_infinity") {
          return new Response(JSON.stringify({
            id: "prj_founderos_infinity",
            name: "infinity-web",
            link: {
              repo: "other/repo",
              repoId: "999"
            }
          }), { status: 200 });
        }
        throw new Error("Unexpected fetch " + url);
      };
    `);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Configured Vercel project prj_founderos_infinity is readable",
    );
    expect(result.stderr).toContain("repo=other/repo, repoId=999");
    expect(result.stderr).not.toContain(
      "create the API token in the same personal/team workspace",
    );
  });

  test("redacts configured token values and token-like provider errors", () => {
    const fakeProviderToken = "v" + "ck_SECRET_TEST_TOKEN_123456789";
    const result = runDiscoverWithFetch(`
      const fakeProviderToken = "v" + "ck_SECRET_TEST_TOKEN_123456789";
      globalThis.fetch = async (url) => {
        const pathname = new URL(String(url)).pathname;
        if (pathname === "/v10/projects") {
          return new Response(JSON.stringify({ projects: [] }), { status: 200 });
        }
        if (pathname === "/v9/projects/prj_founderos_infinity") {
          return new Response(JSON.stringify({
            error: {
              message: "Project not found for vercel-token and " + fakeProviderToken
            }
          }), { status: 404 });
        }
        if (pathname === "/v9/projects") {
          return new Response(JSON.stringify({
            error: {
              message: "Listing forbidden for vercel-token and " + fakeProviderToken
            }
          }), { status: 403 });
        }
        if (pathname === "/v2/teams") {
          return new Response(JSON.stringify({
            error: { message: "Team list forbidden for vercel-token and " + fakeProviderToken }
          }), { status: 403 });
        }
        throw new Error("Unexpected fetch " + url);
      };
    `);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[REDACTED]");
    expect(result.stderr).not.toContain("vercel-token");
    expect(result.stderr).not.toContain(fakeProviderToken);
    expect(result.stderr).toContain(
      "create the API token in the same personal/team workspace",
    );
    expect(result.stderr).toContain("Vercel access diagnostics:");
    expect(result.stderr).toContain("scoped project listing failed with 403");
    expect(result.stderr).toContain("personal project listing failed with 403");
    expect(result.stderr).toContain("team listing failed with 403");
    expect(result.stderr).not.toContain("vercel-token");
    expect(result.stderr).not.toContain(fakeProviderToken);
  });

  test("still tries direct project preflight when repo search fails", () => {
    const result = runDiscoverWithFetch(`
      globalThis.fetch = async (url) => {
        const pathname = new URL(String(url)).pathname;
        if (pathname === "/v10/projects") {
          return new Response(JSON.stringify({
            error: { message: "Project search forbidden for vercel-token" }
          }), { status: 403 });
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
        throw new Error("Unexpected fetch " + url);
      };
    `);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Found configured Vercel project by direct project preflight",
    );
    expect(result.stdout).toContain("infinity-web");
  });

  test("passes Vercel team slug through repo search and direct project preflight", () => {
    const result = runDiscoverWithFetch(
      `
        globalThis.fetch = async (url) => {
          const parsed = new URL(String(url));
          if (parsed.searchParams.get("slug") !== "ls-projects-adb8778b") {
            throw new Error("Missing Vercel team slug in " + url);
          }
          if (parsed.pathname === "/v10/projects") {
            if (parsed.searchParams.get("repoUrl") !== "https://github.com/founderos/infinity") {
              throw new Error("Missing repoUrl in " + url);
            }
            return new Response(JSON.stringify({ projects: [] }), { status: 200 });
          }
          if (parsed.pathname === "/v9/projects/prj_founderos_infinity") {
            return new Response(JSON.stringify({
              id: "prj_founderos_infinity",
              name: "infinity-web",
              link: {
                repo: "founderos/infinity",
                repoId: "123456789"
              }
            }), { status: 200 });
          }
          throw new Error("Unexpected fetch " + url);
        };
      `,
      discoverEnv({
        FOUNDEROS_VERCEL_TEAM_SLUG: "ls-projects-adb8778b",
      }),
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Found configured Vercel project by direct project preflight",
    );
  });
});
