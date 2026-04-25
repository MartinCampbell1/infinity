import { createHash } from "node:crypto";

export interface DirectoryPaginationInput {
  limit: number;
  cursor: string | null;
  offset: number;
}

export interface DirectoryPageInfo {
  limit: number;
  cursor: string | null;
  nextCursor: string | null;
  hasNextPage: boolean;
  totalItems: number;
}

export function normalizeDirectoryFilterValue(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function readDirectoryFilter(
  searchParams: URLSearchParams,
  key: string,
) {
  return normalizeDirectoryFilterValue(searchParams.get(key));
}

export function readDirectorySearchQuery(searchParams: URLSearchParams) {
  return (
    readDirectoryFilter(searchParams, "q") ??
    readDirectoryFilter(searchParams, "search") ??
    readDirectoryFilter(searchParams, "query")
  );
}

export function matchesDirectorySearchQuery(
  values: readonly unknown[],
  query: string | null | undefined,
): boolean {
  const normalizedQuery = normalizeDirectoryFilterValue(query)?.toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => {
    if (Array.isArray(value)) {
      return matchesDirectorySearchQuery(value, normalizedQuery);
    }
    return String(value ?? "")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function encodeDirectoryCursor(offset: number) {
  return Buffer.from(
    JSON.stringify({ offset: Math.max(0, Math.floor(offset)) }),
    "utf8",
  ).toString("base64url");
}

function decodeDirectoryCursor(value: string | null) {
  if (!value) {
    return 0;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      offset?: unknown;
    };
    return typeof parsed.offset === "number" && Number.isFinite(parsed.offset)
      ? Math.max(0, Math.floor(parsed.offset))
      : 0;
  } catch {
    return 0;
  }
}

export function parseDirectoryPagination(
  searchParams: URLSearchParams,
  options: {
    defaultLimit: number;
    maxLimit: number;
  },
): DirectoryPaginationInput {
  const rawLimit = Number(searchParams.get("limit") ?? options.defaultLimit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), options.maxLimit)
      : options.defaultLimit;
  const cursor = searchParams.get("cursor")?.trim() || null;
  return {
    limit,
    cursor,
    offset: decodeDirectoryCursor(cursor),
  };
}

export function paginateDirectoryItems<T>(
  items: readonly T[],
  pagination: DirectoryPaginationInput,
) {
  const start = Math.min(pagination.offset, items.length);
  const end = Math.min(start + pagination.limit, items.length);
  const pageItems = items.slice(start, end);
  return {
    items: pageItems,
    pageInfo: {
      limit: pagination.limit,
      cursor: pagination.cursor,
      nextCursor: end < items.length ? encodeDirectoryCursor(end) : null,
      hasNextPage: end < items.length,
      totalItems: items.length,
    } satisfies DirectoryPageInfo,
  };
}

export function directoryCacheHeaders(params: {
  route: string;
  generatedAt: string;
  itemCount: number;
  cacheSeconds?: number;
}) {
  const cacheSeconds = params.cacheSeconds ?? 15;
  const etag = createHash("sha256")
    .update(`${params.route}:${params.generatedAt}:${params.itemCount}`)
    .digest("hex")
    .slice(0, 24);

  return {
    "cache-control": `private, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 3}`,
    etag: `"${etag}"`,
    vary: "authorization, cookie",
  };
}
