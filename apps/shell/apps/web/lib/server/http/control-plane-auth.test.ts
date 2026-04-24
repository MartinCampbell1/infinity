import { describe, expect, test } from "vitest";

import {
  ACTOR_ID_HEADER,
  ACTOR_ROLE_HEADER,
  ACTOR_TENANT_HEADER,
  ACTOR_TYPE_HEADER,
  AUTH_BOUNDARY_HEADER,
  CONTROL_PLANE_OPERATOR_ROLE_ENV_KEY,
  CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
  CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
  REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY,
  REQUEST_ID_HEADER,
  authorizeControlPlaneRequest,
  requiresControlPlaneAuth,
} from "./control-plane-auth";
import { DEPLOYMENT_ENV_KEY } from "../control-plane/workspace/rollout-config";

function request(
  pathname: string,
  init: { method?: string; token?: string } = {},
) {
  return new Request(`http://localhost${pathname}`, {
    method: init.method ?? "GET",
    headers: init.token ? { authorization: `Bearer ${init.token}` } : undefined,
  });
}

const authEnv = {
  [REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY]: "1",
  [CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY]: "operator-secret",
  [CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY]: "service-secret",
  FOUNDEROS_CONTROL_PLANE_OPERATOR_ID: "operator-1",
  FOUNDEROS_CONTROL_PLANE_SERVICE_ID: "quota-producer",
  FOUNDEROS_CONTROL_PLANE_TENANT_ID: "tenant-1",
};

describe("control-plane auth gate", () => {
  test("requires a real actor in local mode too", () => {
    expect(requiresControlPlaneAuth({ [DEPLOYMENT_ENV_KEY]: "local" })).toBe(
      true,
    );

    const decision = authorizeControlPlaneRequest(
      request("/api/control/accounts"),
      {
        [DEPLOYMENT_ENV_KEY]: "local",
        [CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY]: "operator-secret",
        [CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY]: "service-secret",
      },
    );

    expect(decision).toEqual({
      allowed: false,
      status: 401,
      code: "missing_actor",
      detail: "Privileged control-plane routes require an authenticated actor.",
    });
  });

  test("does not allow explicit auth disable in any deployment mode", () => {
    expect(
      requiresControlPlaneAuth({
        [DEPLOYMENT_ENV_KEY]: "local",
        [REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY]: "0",
      }),
    ).toBe(true);
    expect(
      requiresControlPlaneAuth({
        [DEPLOYMENT_ENV_KEY]: "staging",
        [REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY]: "0",
      }),
    ).toBe(true);
    expect(
      requiresControlPlaneAuth({
        [DEPLOYMENT_ENV_KEY]: "production",
        [REQUIRE_CONTROL_PLANE_AUTH_ENV_KEY]: "0",
      }),
    ).toBe(true);
  });

  test("requires an actor when auth is enabled", () => {
    const decision = authorizeControlPlaneRequest(
      request("/api/control/accounts"),
      authEnv,
    );

    expect(decision).toEqual({
      allowed: false,
      status: 401,
      code: "missing_actor",
      detail: "Privileged control-plane routes require an authenticated actor.",
    });
  });

  test("accepts operator tokens for privileged read and mutation routes", () => {
    const decision = authorizeControlPlaneRequest(
      request("/api/control/orchestration/batches", {
        method: "POST",
        token: "operator-secret",
      }),
      authEnv,
    );

    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.actor).toEqual(
        expect.objectContaining({
          actorType: "operator",
          actorId: "operator-1",
          role: "admin",
          tenantId: "tenant-1",
        }),
      );
      expect(decision.requestHeaders).toEqual(
        expect.objectContaining({
          [ACTOR_TYPE_HEADER]: "operator",
          [ACTOR_ID_HEADER]: "operator-1",
          [ACTOR_ROLE_HEADER]: "admin",
          [ACTOR_TENANT_HEADER]: "tenant-1",
          [AUTH_BOUNDARY_HEADER]: "token",
          [REQUEST_ID_HEADER]: expect.any(String),
        }),
      );
    }
  });

  test("limits service tokens to scoped producer routes", () => {
    const forbidden = authorizeControlPlaneRequest(
      request("/api/control/orchestration/batches", {
        method: "POST",
        token: "service-secret",
      }),
      authEnv,
    );
    expect(forbidden).toEqual({
      allowed: false,
      status: 403,
      code: "forbidden_actor",
      detail: "Service actor token is only accepted on scoped producer routes.",
    });

    const allowed = authorizeControlPlaneRequest(
      request("/api/control/accounts/quotas", {
        method: "POST",
        token: "service-secret",
      }),
      authEnv,
    );
    expect(allowed.allowed).toBe(true);
    if (allowed.allowed) {
      expect(allowed.actor).toEqual(
        expect.objectContaining({
          actorType: "service",
          actorId: "quota-producer",
          role: "service",
        }),
      );
    }
  });

  test("allows viewer operators to read but denies privileged mutations", () => {
    const readDecision = authorizeControlPlaneRequest(
      request("/api/control/accounts", {
        method: "GET",
        token: "operator-secret",
      }),
      {
        ...authEnv,
        [CONTROL_PLANE_OPERATOR_ROLE_ENV_KEY]: "viewer",
      },
    );

    expect(readDecision.allowed).toBe(true);
    if (readDecision.allowed) {
      expect(readDecision.actor).toEqual(
        expect.objectContaining({
          actorType: "operator",
          actorId: "operator-1",
          role: "viewer",
          tenantId: "tenant-1",
        }),
      );
    }

    const mutationDecision = authorizeControlPlaneRequest(
      request("/api/control/orchestration/batches", {
        method: "POST",
        token: "operator-secret",
      }),
      {
        ...authEnv,
        [CONTROL_PLANE_OPERATOR_ROLE_ENV_KEY]: "viewer",
      },
    );

    expect(mutationDecision).toEqual({
      allowed: false,
      status: 403,
      code: "forbidden_actor",
      detail: "Control-plane role viewer is not permitted to POST.",
    });
  });

  test("leaves launch-token scoped workspace routes to their route-owned token verification", () => {
    const decision = authorizeControlPlaneRequest(
      request(
        "/api/control/execution/workspace/session-2026-04-11-001/bootstrap",
        { method: "POST" },
      ),
      authEnv,
    );

    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.actor).toEqual(
        expect.objectContaining({
          actorType: "workspace",
          actorId: "workspace-launch-token",
          role: "workspace_runtime",
        }),
      );
      expect(decision.requestHeaders[AUTH_BOUNDARY_HEADER]).toBe(
        "route_owned_launch_token",
      );
    }
  });
});
