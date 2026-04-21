import type { ShellExecutionEventsSnapshot } from "@/lib/execution-events-model";

async function parseSnapshotError(response: Response) {
  const fallback = `Snapshot request failed: ${response.status}`;
  const raw = (await response.text()).trim();

  if (!raw) {
    return fallback;
  }

  try {
    const payload = JSON.parse(raw) as { detail?: string; message?: string };
    if (payload.detail) {
      return payload.detail;
    }
    if (payload.message) {
      return payload.message;
    }
  } catch {
    // Fall back to raw response body.
  }

  return raw;
}

async function requestShellSnapshotJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseSnapshotError(response));
  }

  return (await response.json()) as T;
}

export function fetchShellExecutionEventsSnapshot(
  input: RequestInfo | URL = "/api/shell/execution/events",
  init?: RequestInit
): Promise<ShellExecutionEventsSnapshot> {
  return requestShellSnapshotJson<ShellExecutionEventsSnapshot>(input, init);
}
