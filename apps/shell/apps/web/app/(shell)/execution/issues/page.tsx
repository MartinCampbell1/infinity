import React from "react";

import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionRunScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";
import { getExecutionKernelAvailability } from "@/lib/server/orchestration/batches";

type ExecutionIssuesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionIssuesPage({
  searchParams,
}: {
  searchParams?: ExecutionIssuesSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const [state, kernelAvailability] = await Promise.all([
    readControlPlaneState(),
    getExecutionKernelAvailability(),
  ]);
  const runById = new Map(state.orchestration.runs.map((run) => [run.id, run] as const));
  const secretPauseItems = state.orchestration.secretPauses.map((pause) => {
    const run = runById.get(pause.runId);
    return {
      id: pause.id,
      headline: pause.message,
      detail:
        pause.kind === "credential_required"
          ? "Automation is paused until credentials are resolved."
          : "Automation is paused until secrets are resolved.",
      meta: [
        pause.kind,
        pause.resolvedAt ? `resolved ${pause.resolvedAt}` : "open",
      ],
      href: run ? buildExecutionRunScopeHref(run.initiativeId, routeScope) : null,
      sortAt: pause.createdAt,
    };
  });
  const latestRuntimeEventByInitiative = new Map(
    state.orchestration.runEvents
    .filter((event) => event.kind === "runtime.unavailable")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((event) => [event.initiativeId, event] as const)
  );
  const runtimeItems = [...latestRuntimeEventByInitiative.values()].map((event) => ({
      id: event.id,
      headline: event.summary,
      detail:
        typeof event.payload.recoveryCommand === "string"
          ? `Start the local dependency and retry: ${event.payload.recoveryCommand}`
          : "A local runtime dependency is unavailable, so the autonomous path cannot continue yet.",
      meta: [
        typeof event.payload.dependency === "string" ? event.payload.dependency : "runtime",
        typeof event.payload.baseUrl === "string" ? event.payload.baseUrl : null,
        event.stage ?? "blocked",
      ],
      href: buildExecutionRunScopeHref(event.initiativeId, routeScope),
      sortAt: event.createdAt,
    }));
  const syntheticKernelItem =
    !kernelAvailability.available && runtimeItems.length === 0
      ? [
          {
            id: "runtime-kernel-offline",
            headline: `Execution kernel unavailable at ${kernelAvailability.baseUrl}.`,
            detail: kernelAvailability.detail,
            meta: ["execution-kernel", kernelAvailability.baseUrl, "blocked"],
            href: null,
            sortAt: new Date(0).toISOString(),
          },
        ]
      : [];
  const items = [...secretPauseItems, ...runtimeItems, ...syntheticKernelItem]
    .sort((left, right) => right.sortAt.localeCompare(left.sortAt))
    .map((entry) => ({
      id: entry.id,
      headline: entry.headline,
      detail: entry.detail,
      meta: entry.meta,
      href: entry.href,
    }));

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Issues"
      description="Blocking execution issues that require real operator action before the autonomous path can continue."
      items={items}
      emptyTitle="No blocking execution issues"
      emptyDescription="Secret pauses and runtime-unavailable events appear here only when the shell cannot honestly continue the autonomous path."
    />
  );
}
