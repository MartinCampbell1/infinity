import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/execution/autonomous-record-board", () => ({
  AutonomousRecordBoard: ({
    title,
    description,
    items,
  }: {
    title: string;
    description: string;
    items: Array<{ headline: string; detail?: string | null; href?: string | null }>;
  }) => (
    <section data-issues-board="true">
      <h1>{title}</h1>
      <p>{description}</p>
      {items.length === 0 ? <div>No items</div> : null}
      {items.map((item) => (
        <article key={item.headline}>
          <div>{item.headline}</div>
          <div>{item.detail ?? "No detail"}</div>
          <div>{item.href ?? "No href"}</div>
        </article>
      ))}
    </section>
  ),
}));

vi.mock("@/lib/route-scope", () => ({
  readShellRouteScopeFromQueryRecord: vi.fn(() => undefined),
  buildExecutionRunScopeHref: vi.fn((initiativeId: string) => `/execution/runs/${initiativeId}`),
}));

vi.mock("@/lib/server/orchestration/batches", () => ({
  getExecutionKernelAvailability: vi.fn(async () => ({
    available: false,
    baseUrl: "http://127.0.0.1:8787",
    detail:
      "Kernel is offline at http://127.0.0.1:8787. Start ./services/execution-kernel/scripts/run-local.sh before launching autonomous runs.",
    generatedAt: null,
  })),
}));

vi.mock("@/lib/server/control-plane/state/store", () => ({
  readControlPlaneState: vi.fn(async () => ({
    orchestration: {
      runs: [
        {
          id: "run-1",
          initiativeId: "initiative-1",
        },
      ],
      secretPauses: [],
      runEvents: [
        {
          id: "run-event-older",
          runId: "run-1",
          initiativeId: "initiative-1",
          kind: "runtime.unavailable",
          stage: "blocked",
          summary: "Execution kernel unavailable at http://127.0.0.1:8787.",
          payload: {
            dependency: "execution-kernel",
            baseUrl: "http://127.0.0.1:8787",
            recoveryCommand:
              "cd /Users/martin/infinity/services/execution-kernel && ./scripts/run-local.sh",
          },
          createdAt: "2026-04-20T11:59:00.000Z",
        },
        {
          id: "run-event-1",
          runId: "run-1",
          initiativeId: "initiative-1",
          kind: "runtime.unavailable",
          stage: "blocked",
          summary: "Execution kernel unavailable at http://127.0.0.1:8787.",
          payload: {
            dependency: "execution-kernel",
            baseUrl: "http://127.0.0.1:8787",
            recoveryCommand:
              "cd /Users/martin/infinity/services/execution-kernel && ./scripts/run-local.sh",
          },
          createdAt: "2026-04-20T12:00:00.000Z",
        },
      ],
    },
  })),
}));

import { getExecutionKernelAvailability } from "@/lib/server/orchestration/batches";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";
import Page from "./page";

describe("execution issues route", () => {
  test("surfaces runtime-unavailable events as blocking operator issues", async () => {
    const markup = renderToStaticMarkup(await Page({}));

    expect(markup).toContain("Issues");
    expect(markup).toContain("Execution kernel unavailable");
    expect(markup).toContain("cd /Users/martin/infinity/services/execution-kernel");
    expect(markup).toContain("./scripts/run-local.sh");
    expect(markup).toContain("/execution/runs/initiative-1");
    expect(markup).not.toContain("run-event-older");
  });

  test("synthesizes a kernel issue when the runtime is offline before any run-level event exists", async () => {
    vi.mocked(readControlPlaneState).mockResolvedValueOnce({
      orchestration: {
        runs: [],
        secretPauses: [],
        runEvents: [],
      },
    } as unknown as Awaited<ReturnType<typeof readControlPlaneState>>);
    vi.mocked(getExecutionKernelAvailability).mockResolvedValueOnce({
      available: false,
      baseUrl: "http://127.0.0.1:8787",
      detail:
        "Kernel is offline at http://127.0.0.1:8787. Start ./services/execution-kernel/scripts/run-local.sh before launching autonomous runs.",
      generatedAt: null,
    });

    const markup = renderToStaticMarkup(await Page({}));

    expect(markup).toContain("Execution kernel unavailable");
    expect(markup).toContain("./services/execution-kernel/scripts/run-local.sh");
    expect(markup).toContain("No href");
  });

  test("surfaces a degraded kernel issue even when healthz is reachable", async () => {
    vi.mocked(readControlPlaneState).mockResolvedValueOnce({
      orchestration: {
        runs: [],
        secretPauses: [],
        runEvents: [],
      },
    } as unknown as Awaited<ReturnType<typeof readControlPlaneState>>);
    vi.mocked(getExecutionKernelAvailability).mockResolvedValueOnce({
      available: true,
      baseUrl: "http://127.0.0.1:8787",
      detail:
        "execution-kernel is reachable as a localhost-only solo-v1 runtime with local_file_snapshot-backed local state configured=true, runtime blocked, recovery retryable, restart-recoverable true, 1 blocked batch(es), and 1 failed attempt(s), and next action: Restart the kernel if needed, then retry blocked batches from the shell: batch-health-001.",
      generatedAt: "2026-04-21T00:00:00.000Z",
      runtimeState: "blocked",
      recoveryState: "retryable",
      restartRecoverable: true,
      failureState: "failed",
      authMode: "localhost_only",
      deploymentScope: "localhost_only_solo",
      maturity: "localhost_solo_v1",
      storageKind: "file",
      durabilityTier: "local_file_snapshot",
      statePath: "/tmp/execution-kernel/state.json",
    });

    const markup = renderToStaticMarkup(await Page({}));

    expect(markup).toContain("Execution kernel retryable");
    expect(markup).toContain("solo-v1 runtime");
    expect(markup).toContain("local_file_snapshot-backed");
    expect(markup).toContain("runtime blocked");
    expect(markup).toContain("restart-recoverable");
  });

  test("does not hide live retryable kernel health behind stale runtime events", async () => {
    vi.mocked(getExecutionKernelAvailability).mockResolvedValueOnce({
      available: true,
      baseUrl: "http://127.0.0.1:8787",
      detail:
        "execution-kernel is reachable as a localhost-only solo-v1 runtime with local_file_snapshot-backed local state configured=true, runtime blocked, recovery retryable, restart-recoverable true, 1 blocked batch(es), and 1 failed attempt(s), and next action: Restart the kernel if needed, then retry blocked batches from the shell: batch-health-001.",
      generatedAt: "2026-04-21T00:00:00.000Z",
      runtimeState: "blocked",
      recoveryState: "retryable",
      restartRecoverable: true,
      failureState: "failed",
      authMode: "localhost_only",
      deploymentScope: "localhost_only_solo",
      maturity: "localhost_solo_v1",
      storageKind: "file",
      durabilityTier: "local_file_snapshot",
      statePath: "/tmp/execution-kernel/state.json",
    });

    const markup = renderToStaticMarkup(await Page({}));

    expect(markup).toContain("Execution kernel unavailable");
    expect(markup).toContain("Execution kernel retryable");
  });
});
