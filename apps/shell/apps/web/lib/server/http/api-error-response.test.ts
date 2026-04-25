import { describe, expect, test } from "vitest";

import {
  apiErrorResponse,
  buildApiErrorBody,
  extractApiErrorMessage,
} from "./api-error-response";

describe("api error response helpers", () => {
  test("builds the structured error envelope", async () => {
    const response = apiErrorResponse({
      code: "missing_actor",
      message: "Privileged control-plane routes require an authenticated actor.",
      status: 401,
      details: { route: "/api/control/example" },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: "missing_actor",
        message: "Privileged control-plane routes require an authenticated actor.",
        details: { route: "/api/control/example" },
      },
    });
  });

  test("extracts new and legacy error messages", () => {
    expect(
      extractApiErrorMessage(
        buildApiErrorBody({
          code: "bad_request",
          message: "Structured message",
        }),
      ),
    ).toBe("Structured message");
    expect(extractApiErrorMessage({ detail: "Legacy detail" })).toBe(
      "Legacy detail",
    );
    expect(extractApiErrorMessage({ message: "Legacy message" })).toBe(
      "Legacy message",
    );
    expect(extractApiErrorMessage({ error: "Legacy error" })).toBe(
      "Legacy error",
    );
  });
});
