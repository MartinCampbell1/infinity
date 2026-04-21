import React from "react";

import {
  buildExecutionContinuityScopeHref,
  buildExecutionTaskGraphScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import {
  ExecutionDetailActionLink,
  ExecutionDetailEmptyState,
  ExecutionDetailKeyValueGrid,
  ExecutionDetailMetric,
  ExecutionDetailMetricGrid,
  ExecutionDetailPage,
  ExecutionDetailSection,
  ExecutionDetailStatusPill,
} from "../../../../../components/execution/detail-primitives";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionAgentSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ runtimeAgentId: string }>;
  searchParams?: ExecutionAgentSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(resolvedSearchParams);
  const state = await readControlPlaneState();

  const agentSession =
    state.orchestration.agentSessions.find(
      (candidate) => candidate.id === resolvedParams.runtimeAgentId
    ) ?? null;

  if (!agentSession) {
    return (
      <ExecutionDetailEmptyState
        title="Agent session not found"
        description="The requested autonomous worker session is not present in the shell-owned orchestration directory."
      />
    );
  }

  const run =
    state.orchestration.runs.find((candidate) => candidate.id === agentSession.runId) ?? null;
  const batch =
    state.orchestration.batches.find((candidate) => candidate.id === agentSession.batchId) ?? null;
  const taskGraph = batch
    ? state.orchestration.taskGraphs.find((candidate) => candidate.id === batch.taskGraphId) ?? null
    : null;
  const workUnit =
    state.orchestration.workUnits.find(
      (candidate) => candidate.id === agentSession.workItemId
    ) ?? null;
  const refusal =
    state.orchestration.refusals.find(
      (candidate) => candidate.agentSessionId === agentSession.id
    ) ?? null;

  return (
    <ExecutionDetailPage
      eyebrow="Execution"
      title="Agent Session"
      description="Durable worker-session detail for one autonomous work item inside the shell-owned execution graph."
    >
      <ExecutionDetailMetricGrid>
        <ExecutionDetailMetric label="Agent" value={agentSession.id} />
        <ExecutionDetailMetric
          label="Status"
          value={<ExecutionDetailStatusPill value={agentSession.status} />}
        />
        <ExecutionDetailMetric label="Run" value={run?.title ?? agentSession.runId} />
      </ExecutionDetailMetricGrid>

      <ExecutionDetailSection title="Execution">
        <ExecutionDetailKeyValueGrid
          items={[
            { label: "Batch", value: agentSession.batchId },
            { label: "Work item", value: workUnit?.title ?? agentSession.workItemId },
            { label: "Attempt", value: agentSession.attemptId ?? "n/a" },
            { label: "Runtime ref", value: agentSession.runtimeRef ?? "n/a" },
          ]}
        />
      </ExecutionDetailSection>

      {refusal ? (
        <ExecutionDetailSection title="Refusal">
          <div className="space-y-2">
            <p className="text-sm leading-6 text-amber-100/92">{refusal.reason}</p>
            <p className="text-xs text-amber-200/72">Severity: {refusal.severity}</p>
          </div>
        </ExecutionDetailSection>
      ) : null}

      <ExecutionDetailSection title="Actions">
        <div className="flex flex-wrap gap-3">
          {run ? (
            <ExecutionDetailActionLink
              href={buildExecutionContinuityScopeHref(run.initiativeId, routeScope)}
            >
              Open run
            </ExecutionDetailActionLink>
          ) : null}
          {taskGraph ? (
            <ExecutionDetailActionLink
              href={buildExecutionTaskGraphScopeHref(taskGraph.id, routeScope, {
                initiativeId: taskGraph.initiativeId,
              })}
            >
              Open task graph
            </ExecutionDetailActionLink>
          ) : null}
        </div>
      </ExecutionDetailSection>
    </ExecutionDetailPage>
  );
}
