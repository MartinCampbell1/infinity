import { describe, expect, test } from "vitest";

import {
  WORKSPACE_LAUNCH_API_ROUTES,
  buildWorkspaceLaunchApiPath,
  buildWorkspaceLaunchApiUrl,
  buildWorkspaceLaunchBootstrapPath,
  buildWorkspaceLaunchBootstrapUrl,
  buildWorkspaceLaunchRuntimePath,
  buildWorkspaceLaunchSessionBearerPath,
  buildWorkspaceLaunchSessionPath,
  buildWorkspaceLaunchSessionUrl,
  buildWorkspaceLaunchTokenPath,
  buildWorkspaceLaunchTokenUrl,
} from "./workspace-launch-routes";

describe("workspace launch API route builders", () => {
  test("builds the frozen workspace launch endpoint paths", () => {
    const sessionId = "session 001/alpha";

    expect(buildWorkspaceLaunchBootstrapPath(sessionId)).toBe(
      "/api/control/execution/workspace/session%20001%2Falpha/bootstrap"
    );
    expect(buildWorkspaceLaunchTokenPath(sessionId)).toBe(
      "/api/control/execution/workspace/session%20001%2Falpha/launch-token"
    );
    expect(buildWorkspaceLaunchRuntimePath(sessionId)).toBe(
      "/api/control/execution/workspace/session%20001%2Falpha/runtime"
    );
    expect(buildWorkspaceLaunchSessionPath(sessionId)).toBe(
      "/api/control/execution/workspace/session%20001%2Falpha/session"
    );
    expect(buildWorkspaceLaunchSessionBearerPath(sessionId)).toBe(
      "/api/control/execution/workspace/session%20001%2Falpha/session-bearer"
    );
  });

  test("builds absolute URLs from shell origins", () => {
    expect(
      buildWorkspaceLaunchBootstrapUrl("http://127.0.0.1:3737", "session-001")
    ).toBe("http://127.0.0.1:3737/api/control/execution/workspace/session-001/bootstrap");
    expect(
      buildWorkspaceLaunchSessionUrl("https://shell.infinity.local/", "session-001")
    ).toBe("https://shell.infinity.local/api/control/execution/workspace/session-001/session");
    expect(
      buildWorkspaceLaunchTokenUrl("https://shell.infinity.local", "session-001")
    ).toBe(
      "https://shell.infinity.local/api/control/execution/workspace/session-001/launch-token"
    );
  });

  test("fails closed when required route inputs are missing", () => {
    expect(buildWorkspaceLaunchApiPath({ sessionId: "", route: "bootstrap" })).toBeNull();
    expect(buildWorkspaceLaunchApiUrl("", { sessionId: "session-001", route: "session" })).toBeNull();
  });

  test("keeps route keys tied to the endpoint segment manifest", () => {
    expect(Object.keys(WORKSPACE_LAUNCH_API_ROUTES)).toEqual([
      "bootstrap",
      "launchToken",
      "runtime",
      "session",
      "sessionBearer",
    ]);
  });
});
