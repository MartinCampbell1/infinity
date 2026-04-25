import { describe, expect, test } from "vitest";

import {
  directoryCacheHeaders,
  encodeDirectoryCursor,
  matchesDirectorySearchQuery,
  paginateDirectoryItems,
  parseDirectoryPagination,
  readDirectoryFilter,
  readDirectorySearchQuery,
} from "./directory-pagination";

describe("directory pagination helpers", () => {
  test("parses bounded limits and opaque offset cursors", () => {
    const cursor = encodeDirectoryCursor(2);
    const pagination = parseDirectoryPagination(
      new URLSearchParams({ limit: "3", cursor }),
      { defaultLimit: 10, maxLimit: 50 },
    );

    expect(pagination).toEqual({
      limit: 3,
      cursor,
      offset: 2,
    });
  });

  test("paginates with next cursor and rejects invalid cursor input safely", () => {
    const pagination = parseDirectoryPagination(
      new URLSearchParams({ limit: "2", cursor: "not-a-valid-cursor" }),
      { defaultLimit: 10, maxLimit: 50 },
    );
    const page = paginateDirectoryItems(["a", "b", "c"], pagination);

    expect(page.items).toEqual(["a", "b"]);
    expect(page.pageInfo).toEqual({
      limit: 2,
      cursor: "not-a-valid-cursor",
      nextCursor: encodeDirectoryCursor(2),
      hasNextPage: true,
      totalItems: 3,
    });
  });

  test("emits private cache headers for authenticated directory reads", () => {
    const headers = directoryCacheHeaders({
      route: "/api/shell/execution/events",
      generatedAt: "2026-04-25T00:00:00.000Z",
      itemCount: 42,
    });

    expect(headers["cache-control"]).toBe("private, max-age=15, stale-while-revalidate=45");
    expect(headers.etag).toMatch(/^"[a-f0-9]{24}"$/);
    expect(headers.vary).toBe("authorization, cookie");
  });

  test("normalizes exact filters and query aliases", () => {
    const searchParams = new URLSearchParams({
      project_id: " project-atlas ",
      search: "  launch ",
    });

    expect(readDirectoryFilter(searchParams, "project_id")).toBe("project-atlas");
    expect(readDirectoryFilter(searchParams, "missing")).toBeNull();
    expect(readDirectorySearchQuery(searchParams)).toBe("launch");
  });

  test("matches directory search values case-insensitively", () => {
    expect(
      matchesDirectorySearchQuery(
        ["Borealis Shell", ["route-scope", "control-plane"]],
        "route",
      ),
    ).toBe(true);
    expect(matchesDirectorySearchQuery(["Atlas Launch"], "cascade")).toBe(false);
    expect(matchesDirectorySearchQuery(["Atlas Launch"], null)).toBe(true);
  });
});
