import React from "react";

import { PlaneWorkItemsSurface } from "@/components/work-items/plane-work-items-surface";
import { PlaneWorkItemsShell } from "@/components/shell/plane-work-items-shell";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";
import { buildSessionWorkspaceHostContext } from "../../lib/server/control-plane/workspace/launch";
import { readWorkspaceLaunchSessionContext } from "../../lib/server/control-plane/workspace/session-context";
import { listExecutionBatches } from "@/lib/server/orchestration/batches";
import { listDeliveries } from "@/lib/server/orchestration/delivery";
import { listOrchestrationInitiatives } from "@/lib/server/orchestration/initiatives";
import { buildTaskGraphDetailResponse } from "@/lib/server/orchestration/task-graphs";

type WorkItemsSearchParams = Promise<Record<string, string | string[] | undefined>>;

const LIVE_INITIATIVE_STATUSES = new Set([
  "clarifying",
  "brief_ready",
  "planning",
  "running",
  "assembly",
  "verifying",
]);

export default async function WorkItemsPage({
  searchParams,
}: {
  searchParams?: WorkItemsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const [initiatives, batches, deliveries, state] = await Promise.all([
    listOrchestrationInitiatives(),
    listExecutionBatches(),
    listDeliveries(),
    readControlPlaneState(),
  ]);

  const currentInitiative =
    initiatives.find((initiative) => LIVE_INITIATIVE_STATUSES.has(initiative.status)) ??
    initiatives[0] ??
    null;
  const currentRun =
    (currentInitiative
      ? state.orchestration.runs.find((run) => run.initiativeId === currentInitiative.id)
      : null) ?? null;
  const currentBatch =
    (currentInitiative
      ? batches.find((batch) => batch.initiativeId === currentInitiative.id)
      : null) ??
    batches[0] ??
    null;
  const currentDelivery =
    (currentInitiative
      ? deliveries.find((delivery) => delivery.initiativeId === currentInitiative.id)
      : null) ??
    deliveries[0] ??
    null;
  const currentTaskGraphId =
    currentBatch?.taskGraphId ??
    (currentInitiative
      ? state.orchestration.taskGraphs.find(
          (taskGraph) => taskGraph.initiativeId === currentInitiative.id
        )?.id ?? null
      : null);
  const currentTaskGraphDetail = currentTaskGraphId
    ? await buildTaskGraphDetailResponse(currentTaskGraphId)
    : null;
  const currentHandoffPacket =
    (currentRun
      ? state.orchestration.handoffPackets.find((packet) => packet.runId === currentRun.id)
      : null) ?? null;
  const agentSessions = currentRun
    ? state.orchestration.agentSessions.filter((session) => session.runId === currentRun.id)
    : [];
  const currentWorkspaceSessionId =
    currentInitiative?.workspaceSessionId || routeScope.sessionId || null;
  const workspaceHostContext = currentWorkspaceSessionId
    ? buildSessionWorkspaceHostContext(
        await readWorkspaceLaunchSessionContext(
          currentWorkspaceSessionId,
          routeScope
        )
      )
    : null;

  return (
    <PlaneWorkItemsShell>
      <PlaneWorkItemsSurface
        routeScope={routeScope}
        currentInitiative={currentInitiative}
        currentRun={currentRun}
        currentTaskGraph={currentTaskGraphDetail?.taskGraph ?? null}
        currentBatch={currentBatch}
        currentDelivery={currentDelivery}
        currentHandoffPacket={currentHandoffPacket}
        workUnits={currentTaskGraphDetail?.workUnits ?? []}
        agentSessions={agentSessions}
        workspaceHostContext={workspaceHostContext}
      />
    </PlaneWorkItemsShell>
  );
}
