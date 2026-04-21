import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/route-scope", () => ({
  readShellRouteScopeFromQueryRecord: vi.fn(() => ({
    projectId: "",
    intakeSessionId: "",
    sessionId: "",
    groupId: "",
    accountId: "",
    workspaceId: "",
  })),
}));

vi.mock("@/components/orchestration/batch-board", () => ({
  BatchBoard: ({
    detail,
  }: {
    detail: { batch: { id: string } };
  }) => (
    <section data-batch-board="true">
      <h1>{detail.batch.id}</h1>
    </section>
  ),
}));

vi.mock("@/lib/server/orchestration/batches", () => ({
  buildExecutionBatchDetailResponse: vi.fn(async (batchId: string) => ({
    batch: {
      id: batchId,
    },
    taskGraph: null,
    workUnits: [],
    attempts: [],
    supervisorActions: [],
    notes: [],
  })),
}));

import Page from "./page";

describe("batch page route", () => {
  test("server-renders the batch board", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ batchId: "batch-123" }),
      })
    );

    expect(markup).toContain("batch-123");
    expect(markup).not.toContain("Loading batch");
  });
});
