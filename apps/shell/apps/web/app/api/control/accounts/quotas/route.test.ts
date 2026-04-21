import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resetControlPlaneStateForTests } from "../../../../../lib/server/control-plane/state/store";

import { GET as getExecutionEvents } from "../../../shell/execution/events/route";

import { GET as getAccountQuotas, POST as postAccountQuotas } from "./route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL = process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL = process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-control-plane-"));
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
  delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
  await resetControlPlaneStateForTests();
});

afterEach(async () => {
  await resetControlPlaneStateForTests();
  if (ORIGINAL_CONTROL_PLANE_STATE_DIR === undefined) {
    delete process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
  } else {
    process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = ORIGINAL_CONTROL_PLANE_STATE_DIR;
  }
  if (ORIGINAL_CONTROL_PLANE_DATABASE_URL === undefined) {
    delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  } else {
    process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL = ORIGINAL_CONTROL_PLANE_DATABASE_URL;
  }
  if (ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL === undefined) {
    delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
  } else {
    process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL =
      ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL;
  }
  if (tempStateDir) {
    rmSync(tempStateDir, { recursive: true, force: true });
    tempStateDir = "";
  }
});

describe("/api/control/accounts/quotas", () => {
  test("returns canonical quota feed and filtered updates", async () => {
    const response = await getAccountQuotas(
      new Request("http://localhost/api/control/accounts/quotas?includeUpdates=1&since=0")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.storageKind).toBe("file_backed");
    expect(body.canonicalQuotaSource).toBe("openai_app_server");
    expect(body.quotaTruthPolicy.canonicalSource).toBe("openai_app_server");
    expect(body.quotaTruthPolicy.fallbackOrder).toEqual([
      "chatgpt_usage_panel",
      "observed_runtime",
      "router_derived",
    ]);
    expect(Array.isArray(body.snapshots)).toBe(true);
    expect(body.snapshots.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(body.updates)).toBe(true);
    expect(body.updates.length).toBeGreaterThanOrEqual(1);

    const apiKeySnapshot = body.snapshots.find(
      (entry: { snapshot: { accountId: string } }) =>
        entry.snapshot.accountId === "account-apikey-01"
    );
    expect(apiKeySnapshot?.capacity?.pressure).toBe("medium");
    expect(apiKeySnapshot?.capacity?.preferredForNewSessions).toBe(false);
  });

  test("honors authMode and accountId filters", async () => {
    const response = await getAccountQuotas(
      new Request(
        "http://localhost/api/control/accounts/quotas?authMode=chatgptAuthTokens&accountId=account-chatgpt-02&includeUpdates=0"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshots).toHaveLength(1);
    expect(body.snapshots[0].snapshot.accountId).toBe("account-chatgpt-02");
    expect(body.updates).toHaveLength(0);
    expect(body.nextSince).toBe(0);
  });

  test("accepts quota producer writes and surfaces them in feed reads", async () => {
    const response = await postAccountQuotas(
      new Request("http://localhost/api/control/accounts/quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producer: "openai_app_server",
          snapshot: {
            accountId: "account-chatgpt-02",
            authMode: "chatgptAuthTokens",
            source: "openai_app_server",
            observedAt: "2026-04-11T14:45:00.000Z",
            buckets: [
              {
                limitId: "req_5h",
                limitName: "Requests / 5h",
                usedPercent: 92,
                windowDurationMins: 300,
                resetsAt: "2026-04-11T15:15:00.000Z",
              },
            ],
            raw: {
              endpoint: "account/rateLimits/updated",
              canonical: true,
            },
          },
          summary: "App-server push raised pressure on account-chatgpt-02.",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.snapshot.accountId).toBe("account-chatgpt-02");
    expect(body.capacity.pressure).toBe("high");
    expect(body.affectedSessionIds).toContain("session-2026-04-11-002");
    expect(
      body.persistedEvents.some(
        (event: { kind: string; sessionId: string }) =>
          event.kind === "quota.updated" && event.sessionId === "session-2026-04-11-002"
      )
    ).toBe(true);

    const feedResponse = await getAccountQuotas(
      new Request("http://localhost/api/control/accounts/quotas?includeUpdates=1&since=102")
    );
    const feedBody = await feedResponse.json();

    expect(feedResponse.status).toBe(200);
    expect(feedBody.updates).toHaveLength(1);
    expect(feedBody.updates[0].accountId).toBe("account-chatgpt-02");
    expect(feedBody.updates[0].summary).toBe(
      "App-server push raised pressure on account-chatgpt-02."
    );

    const executionEventsResponse = await getExecutionEvents(
      new Request(
        "http://localhost/api/shell/execution/events?orchestrator_session_id=session-2026-04-11-002&limit=50"
      )
    );
    const executionEventsBody = await executionEventsResponse.json();

    expect(executionEventsResponse.status).toBe(200);
    expect(
      executionEventsBody.events.some(
        (event: {
          event: string;
          orchestrator_session_id: string;
          source: string;
          actor: string;
        }) =>
          event.event === "quota.updated" &&
          event.orchestrator_session_id === "session-2026-04-11-002" &&
          event.source === "codex_app_server" &&
          event.actor === "codex"
      )
    ).toBe(true);
  });

  test("rejects malformed quota producer bodies", async () => {
    const response = await postAccountQuotas(
      new Request("http://localhost/api/control/accounts/quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producer: "openai_app_server",
          snapshot: null,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid quota producer ingest body");
  });
});
