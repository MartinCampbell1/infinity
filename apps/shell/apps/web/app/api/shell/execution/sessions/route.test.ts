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
    expect(body.filters.cursor).toBeNull();
    expect(body.pageInfo).toEqual(
      expect.objectContaining({
        limit: 3,
        cursor: null,
        totalItems: body.filteredSessions,
      })
    );
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{24}"$/);
    expect(body.sessions.length).toBeLessThanOrEqual(3);
    expect(body.totalSessions).toBeGreaterThanOrEqual(body.sessions.length);
    expect(body.filteredSessions).toBeGreaterThanOrEqual(body.sessions.length);
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

  test("returns a cursor for subsequent session pages", async () => {
    const firstResponse = await getExecutionSessions(
      new Request("http://localhost/api/shell/execution/sessions?limit=1")
    );
    const firstBody = await firstResponse.json();
    const cursor = firstBody.pageInfo.nextCursor;

    const secondResponse = await getExecutionSessions(
      new Request(`http://localhost/api/shell/execution/sessions?limit=1&cursor=${cursor}`)
    );
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(cursor).toEqual(expect.any(String));
    expect(secondBody.filters.cursor).toBe(cursor);
    expect(secondBody.sessions).not.toEqual(firstBody.sessions);
  });

  test("applies exact filters and search before paginating sessions", async () => {
    const response = await getExecutionSessions(
      new Request(
        "http://localhost/api/shell/execution/sessions?project_id=project-borealis&group_id=group-core-02&q=route&limit=5"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.filters.projectId).toBe("project-borealis");
    expect(body.filters.groupId).toBe("group-core-02");
    expect(body.filters.query).toBe("route");
    expect(body.filteredSessions).toBeGreaterThan(0);
    expect(
      body.sessions.every(
        (session: { projectId: string; groupId: string | null; title: string }) =>
          session.projectId === "project-borealis" &&
          session.groupId === "group-core-02" &&
          session.title.toLowerCase().includes("route")
      )
    ).toBe(true);
  });
});
