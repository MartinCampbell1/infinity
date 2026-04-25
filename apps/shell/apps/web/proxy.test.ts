import { NextRequest } from "next/server";
import { afterEach, describe, expect, test } from "vitest";

import {
  CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
  CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
  REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY,
} from "./lib/server/http/control-plane-auth";
import { proxy } from "./proxy";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function nextRequest(
  pathname: string,
  init: {
    method?: string;
    token?: string;
    cookie?: string;
    origin?: string;
    requestMethod?: string;
    secFetchSite?: string;
  } = {},
) {
  const headers = new Headers();
  if (init.token) {
    headers.set("authorization", `Bearer ${init.token}`);
  }
  if (init.cookie) {
    headers.set("cookie", init.cookie);
  }
  if (init.origin) {
    headers.set("origin", init.origin);
  }
  if (init.requestMethod) {
    headers.set("access-control-request-method", init.requestMethod);
  }
  if (init.secFetchSite) {
    headers.set("sec-fetch-site", init.secFetchSite);
  }

  return new NextRequest(`http://localhost${pathname}`, {
    method: init.method ?? "GET",
    headers,
  });
}

describe("privileged API proxy auth gate", () => {
  test("rejects anonymous privileged requests when control-plane auth is required", async () => {
    process.env[REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY] = "1";
    process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY] = "operator-secret";
    process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY] = "service-secret";

    const response = proxy(nextRequest("/api/control/accounts"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      code: "missing_actor",
      detail: "Privileged control-plane routes require an authenticated actor.",
    });
  });

  test("allows operator bearer requests through the proxy", () => {
    process.env[REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY] = "1";
    process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY] = "operator-secret";
    process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY] = "service-secret";

    const response = proxy(
      nextRequest("/api/control/orchestration/batches", {
        method: "POST",
        token: "operator-secret",
      }),
    );

    expect(response.status).toBe(200);
  });

  test("allows signed artifact downloads without a control-plane actor token", () => {
    process.env[REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY] = "1";

    const response = proxy(
      nextRequest(
        "/api/control/orchestration/artifacts/download?key=artifact&sha256=0&expires=2099-01-01T00%3A00%3A00.000Z&signature=probe",
      ),
    );

    expect(response.status).toBe(200);
  });

  test("allows credentialed workspace session revoke preflight", () => {
    process.env[REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY] = "1";

    const response = proxy(
      nextRequest(
        "/api/control/execution/workspace/session-2026-04-11-001/session",
        {
          method: "OPTIONS",
          origin: "http://127.0.0.1:3101",
          requestMethod: "DELETE",
        },
      ),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://127.0.0.1:3101",
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "DELETE",
    );
  });

  test("rejects disallowed cross-origin privileged requests before auth", async () => {
    process.env[REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY] = "1";
    process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY] = "operator-secret";
    process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY] = "service-secret";

    const response = proxy(
      nextRequest("/api/control/orchestration/batches", {
        method: "POST",
        origin: "https://evil.example",
        token: "operator-secret",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(body.detail).toContain("Cross-origin access");
  });

  test("rejects cross-site browser mutations without relying on cookies", async () => {
    process.env[REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY] = "1";
    process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY] = "operator-secret";
    process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY] = "service-secret";

    const response = proxy(
      nextRequest("/api/control/orchestration/batches", {
        method: "POST",
        cookie: "founderos_control_plane_operator_token=operator-secret",
        secFetchSite: "cross-site",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(body.detail).toContain("Cross-origin access");
  });

  test("rejects service bearer requests on operator-only routes", async () => {
    process.env[REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY] = "1";
    process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY] = "operator-secret";
    process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY] = "service-secret";

    const response = proxy(
      nextRequest("/api/control/orchestration/batches", {
        method: "POST",
        token: "service-secret",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("forbidden_actor");
  });
});
