import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { getMockNormalizedExecutionEvents } from "../sessions/mock";
import { createIsolatedControlPlaneStateDir } from "../state/test-helpers";

import { ingestMockQuotaProducerSnapshot } from "./ingest";

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

describe("ingestMockQuotaProducerSnapshot", () => {
  test("derives active sessions from account ownership and appends quota events", async () => {
    const result = await ingestMockQuotaProducerSnapshot({
      producer: "openai_app_server",
      snapshot: {
        accountId: "account-chatgpt-02",
        authMode: "chatgptAuthTokens",
        source: "openai_app_server",
        observedAt: "2026-04-11T14:55:00.000Z",
        buckets: [
          {
            limitId: "req_5h",
            usedPercent: 90,
            resetsAt: "2026-04-11T15:20:00.000Z",
          },
        ],
        raw: {
          endpoint: "account/rateLimits/updated",
          canonical: true,
        },
      },
    });

    expect(result.accepted).toBe(true);
    expect(result.capacity?.pressure).toBe("high");
    expect(result.affectedSessionIds).toEqual(["session-2026-04-11-002"]);
    expect(result.persistedEvents).toHaveLength(1);
    expect(result.persistedEvents[0]?.kind).toBe("quota.updated");
    expect(result.persistedEvents[0]?.source).toBe("codex_app_server");

    const events = await getMockNormalizedExecutionEvents();
    expect(
      events.some(
        (event) =>
          event.kind === "quota.updated" &&
          event.sessionId === "session-2026-04-11-002" &&
          event.timestamp === "2026-04-11T14:55:00.000Z"
      )
    ).toBe(true);
  });

  test("honors explicit session ids when provided", async () => {
    const result = await ingestMockQuotaProducerSnapshot({
      producer: "observed_runtime",
      snapshot: {
        accountId: "account-chatgpt-01",
        authMode: "chatgpt",
        source: "observed_runtime",
        observedAt: "2026-04-11T15:05:00.000Z",
        buckets: [
          {
            limitId: "req_5h",
            usedPercent: 51,
            resetsAt: "2026-04-11T15:45:00.000Z",
          },
        ],
        raw: {
          canonical: false,
        },
      },
      sessionIds: ["session-2026-04-11-001"],
      summary: "Observed runtime pressure changed for account-chatgpt-01.",
    });

    expect(result.accepted).toBe(true);
    expect(result.affectedSessionIds).toEqual(["session-2026-04-11-001"]);
    expect(result.persistedEvents).toHaveLength(1);
    expect(result.persistedEvents[0]?.source).toBe("manual");
    expect(result.persistedEvents[0]?.summary).toBe(
      "Observed runtime pressure changed for account-chatgpt-01."
    );
  });
});
