import { beforeEach, describe, expect, test, vi } from "vitest";

const readAccountQuotaSnapshotsFromPostgres = vi.fn();
const readAccountQuotaUpdatesFromPostgres = vi.fn();

vi.mock("../state/store", () => ({
  getWiredControlPlaneDatabaseUrl: async () => "postgres://control-plane.test/infinity",
  readControlPlaneState: async () => {
    throw new Error("readControlPlaneState should not be called in postgres read-path test");
  },
}));

vi.mock("../state/postgres", () => ({
  readAccountQuotaSnapshotsFromPostgres,
  readAccountQuotaUpdatesFromPostgres,
}));

describe("account postgres read path", () => {
  beforeEach(() => {
    readAccountQuotaSnapshotsFromPostgres.mockReset();
    readAccountQuotaUpdatesFromPostgres.mockReset();
  });

  test("uses Postgres-backed snapshots and collapses account directory rows to the latest snapshot per account", async () => {
    readAccountQuotaSnapshotsFromPostgres.mockResolvedValue([
      {
        accountId: "account-chatgpt-01",
        authMode: "chatgpt",
        source: "openai_app_server",
        observedAt: "2026-04-11T10:00:00.000Z",
        buckets: [{ limitId: "rpm", usedPercent: 10, resetsAt: "2026-04-11T11:00:00.000Z" }],
        raw: null,
      },
      {
        accountId: "account-chatgpt-01",
        authMode: "chatgpt",
        source: "openai_app_server",
        observedAt: "2026-04-11T10:05:00.000Z",
        buckets: [{ limitId: "rpm", usedPercent: 25, resetsAt: "2026-04-11T11:00:00.000Z" }],
        raw: null,
      },
      {
        accountId: "account-apikey-01",
        authMode: "apikey",
        source: "observed_runtime",
        observedAt: "2026-04-11T10:03:00.000Z",
        buckets: [{ limitId: "usage", usedPercent: 40, resetsAt: null }],
        raw: null,
      },
    ]);
    readAccountQuotaUpdatesFromPostgres.mockResolvedValue([
      {
        sequence: 10,
        accountId: "account-chatgpt-01",
        source: "openai_app_server",
        observedAt: "2026-04-11T10:05:00.000Z",
        summary: "Quota refreshed",
        snapshot: {
          accountId: "account-chatgpt-01",
          authMode: "chatgpt",
          source: "openai_app_server",
          observedAt: "2026-04-11T10:05:00.000Z",
          buckets: [{ limitId: "rpm", usedPercent: 25, resetsAt: "2026-04-11T11:00:00.000Z" }],
          raw: null,
        },
      },
    ]);

    const accounts = await import("./mock");
    const directoryRows = await accounts.listMockAccounts();
    const updates = await accounts.listMockQuotaUpdates(0);

    expect(directoryRows).toHaveLength(2);
    expect(directoryRows.find((account) => account.id === "account-chatgpt-01")?.quota.observedAt).toBe(
      "2026-04-11T10:05:00.000Z"
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]?.sequence).toBe(10);
  });
});
