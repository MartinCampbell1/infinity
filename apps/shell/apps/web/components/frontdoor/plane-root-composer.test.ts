import { describe, expect, test } from "vitest";

import {
  buildInitiativeCreateRequest,
  deriveTitleFromPrompt,
} from "./plane-root-composer-logic";

describe("plane root composer helpers", () => {
  test("preserves active session scope in the initiative payload", () => {
    expect(
      buildInitiativeCreateRequest(
        "  Build the primary run surface.  ",
        " martin ",
        {
          projectId: "project-atlas",
          intakeSessionId: "intake-007",
          sessionId: "session-123",
          groupId: "",
          accountId: "",
          workspaceId: "",
        }
      )
    ).toEqual({
      title: "Build the primary run surface.",
      userRequest: "Build the primary run surface.",
      requestedBy: "martin",
      workspaceSessionId: "session-123",
    });
  });

  test("falls back to defaults when prompt and requester are empty", () => {
    expect(buildInitiativeCreateRequest("   ", "   ")).toEqual({
      title: "Untitled autonomous run",
      userRequest: "",
      requestedBy: "martin",
      workspaceSessionId: null,
    });
    expect(deriveTitleFromPrompt("   ")).toBe("Untitled autonomous run");
  });
});
