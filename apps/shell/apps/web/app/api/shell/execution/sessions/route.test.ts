import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { GET as getExecutionSessions } from "./route";
import { createIsolatedControlPlaneStateDir } from "../../../../../lib/server/control-plane/state/test-helpers";

let restoreStateDir: (() => void) | null = null;

beforeEach(() => {
  const { restore } = createIsolatedControlPlaneStateDir();
  restoreStateDir = restore;
});

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("/api/shell/execution/sessions", () => {
  test("returns recent non-archived execution sessions", async () => {
    const response = await getExecutionSessions(
      new Request("http://localhost/api/shell/execution/sessions?limit=3")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessionsLoadState).toBe("ready");
    expect(body.sessionsError).toBeNull();
    expect(body.filters.limit).toBe(3);
    expect(body.sessions.length).toBeLessThanOrEqual(3);
    expect(body.totalSessions).toBeGreaterThanOrEqual(body.sessions.length);
    expect(body.sessions.every((session: { archived: boolean }) => session.archived === false)).toBe(
      true
    );
    expect(body.sessions[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        status: expect.any(String),
      })
    );
  });
});
