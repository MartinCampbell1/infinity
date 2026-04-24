import { describe, expect, test } from "vitest";

import {
  buildPrivilegedApiCorsHeaders,
  getPrivilegedApiAllowedOrigins,
  getPrivilegedApiCorsRejectionDetail,
  isAllowedPrivilegedApiOrigin,
  isPrivilegedApiPath,
} from "./privileged-api-cors";
import {
  DEPLOYMENT_ENV_KEY,
  PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY,
} from "../control-plane/workspace/rollout-config";

describe("privileged API CORS policy", () => {
  test("allows the canonical local shell and workspace origins plus localhost aliases", () => {
    const origins = getPrivilegedApiAllowedOrigins({});

    expect(origins).toEqual(
      new Set([
        "http://127.0.0.1:3737",
        "http://localhost:3737",
        "http://127.0.0.1:3101",
        "http://localhost:3101",
      ]),
    );
  });

  test("expands configured localhost origins into stable aliases", () => {
    const origins = getPrivilegedApiAllowedOrigins({
      FOUNDEROS_SHELL_PUBLIC_ORIGIN: "http://localhost:4747",
      FOUNDEROS_WORK_UI_BASE_URL: "http://127.0.0.1:4101",
    });

    expect(origins.has("http://localhost:4747")).toBe(true);
    expect(origins.has("http://127.0.0.1:4747")).toBe(true);
    expect(origins.has("http://127.0.0.1:4101")).toBe(true);
    expect(origins.has("http://localhost:4101")).toBe(true);
  });

  test("builds explicit CORS headers only for allowed origins", () => {
    expect(buildPrivilegedApiCorsHeaders("http://127.0.0.1:3101")).toEqual({
      "Access-Control-Allow-Origin": "http://127.0.0.1:3101",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Founderos-Actor-Token, X-Founderos-Workspace-Session-Grant",
      Vary: "Origin",
    });
    expect(buildPrivilegedApiCorsHeaders("https://evil.example")).toBeNull();
  });

  test("uses only the explicit allow-list in production-like deployment modes", () => {
    const origins = getPrivilegedApiAllowedOrigins({
      [DEPLOYMENT_ENV_KEY]: "production",
      [PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY]:
        "https://shell.infinity.example,https://work.infinity.example",
      FOUNDEROS_SHELL_PUBLIC_ORIGIN: "http://127.0.0.1:3737",
      FOUNDEROS_WORK_UI_BASE_URL: "http://127.0.0.1:3101",
    });

    expect(origins).toEqual(
      new Set([
        "https://shell.infinity.example",
        "https://work.infinity.example",
      ]),
    );
    expect(origins.has("http://127.0.0.1:3737")).toBe(false);
    expect(
      buildPrivilegedApiCorsHeaders("https://shell.infinity.example", {
        [DEPLOYMENT_ENV_KEY]: "production",
        [PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY]:
          "https://shell.infinity.example,https://work.infinity.example",
      }),
    ).toEqual({
      "Access-Control-Allow-Origin": "https://shell.infinity.example",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Founderos-Actor-Token, X-Founderos-Workspace-Session-Grant",
      Vary: "Origin",
    });
  });

  test("recognizes privileged shell API paths", () => {
    expect(isPrivilegedApiPath("/api/control/accounts")).toBe(true);
    expect(isPrivilegedApiPath("/api/shell/execution/events")).toBe(true);
    expect(isPrivilegedApiPath("/api/public/status")).toBe(false);
  });

  test("rejects disallowed browser origins with an explicit detail", () => {
    expect(isAllowedPrivilegedApiOrigin("https://evil.example")).toBe(false);
    expect(getPrivilegedApiCorsRejectionDetail()).toContain(
      "explicitly configured",
    );
  });
});
