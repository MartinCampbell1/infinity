import React from "react";

import { ExecutionDetailEmptyState } from "../../../../../components/execution/detail-primitives";
import { PrimaryRunSurface } from "@/components/execution/primary-run-surface";
import {
  normalizeShellRouteScope,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { listApprovalRequests } from "@/lib/server/control-plane/approvals/mock";
import { listRecoveryIncidents } from "@/lib/server/control-plane/recoveries/mock";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";
import { listExecutionBatches } from "@/lib/server/orchestration/batches";
import { listDeliveries } from "@/lib/server/orchestration/delivery";
import { listOrchestrationInitiatives } from "@/lib/server/orchestration/initiatives";
import { buildTaskGraphDetailResponse } from "@/lib/server/orchestration/task-graphs";
import { buildSessionWorkspaceHostContext } from "../../../../../lib/server/control-plane/workspace/launch";
import { readWorkspaceLaunchSessionContext } from "../../../../../lib/server/control-plane/workspace/mock";

type RunRouteParams = Promise<{ initiativeId: string }>;
type RunRouteSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExecutionRunPage({
  params,
  searchParams,
}: {
  params: RunRouteParams;
  searchParams?: RunRouteSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(resolvedSearchParams);
  const [
    initiatives,
    batches,
    deliveries,
    state,
    approvalRequests,
    recoveryIncidents,
  ] = await Promise.all([
    listOrchestrationInitiatives(),
    listExecutionBatches(),
    listDeliveries(),
    readControlPlaneState(),
    listApprovalRequests(),
    listRecoveryIncidents(),
  ]);

  const initiative =
    initiatives.find((candidate) => candidate.id === resolvedParams.initiativeId) ?? null;

  if (!initiative) {
    return (
      <ExecutionDetailEmptyState
        title="Primary run record not found"
        description="The requested run is not present in the current shell-owned orchestration directory."
      />
    );
  }

  const currentRun =
    state.orchestration.runs.find((run) => run.initiativeId === initiative.id) ?? null;
  const currentBatch =
    [...batches]
      .filter((batch) => batch.initiativeId === initiative.id)
      .sort((left, right) =>
        (right.startedAt ?? right.id).localeCompare(left.startedAt ?? left.id)
      )[0] ?? null;
  const currentDelivery =
    [...deliveries]
      .filter((delivery) => delivery.initiativeId === initiative.id)
      .sort((left, right) =>
        (right.deliveredAt ?? right.id).localeCompare(left.deliveredAt ?? left.id)
      )[0] ?? null;
  const currentTaskGraphId =
    currentBatch?.taskGraphId ??
    state.orchestration.taskGraphs.find((taskGraph) => taskGraph.initiativeId === initiative.id)?.id ??
    null;
  const currentTaskGraphDetail = currentTaskGraphId
    ? await buildTaskGraphDetailResponse(currentTaskGraphId)
    : null;
  const currentPreviewTarget =
    (currentRun
      ? state.orchestration.previewTargets.find((target) => target.runId === currentRun.id)
      : null) ?? null;
  const latestRunEvent =
    (currentRun
      ? [...state.orchestration.runEvents]
          .filter((event) => event.runId === currentRun.id)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
      : null) ?? null;
  const currentHandoffPacket =
    (currentRun
      ? state.orchestration.handoffPackets.find((packet) => packet.runId === currentRun.id)
      : null) ?? null;
  const agentSessions = currentRun
    ? state.orchestration.agentSessions.filter((session) => session.runId === currentRun.id)
    : [];
  const workspaceSessionId = initiative.workspaceSessionId || null;
  const scopedRoute = workspaceSessionId
    ? routeScope
    : normalizeShellRouteScope({
        ...routeScope,
        sessionId: "",
        groupId: "",
        accountId: "",
        workspaceId: "",
      });
  const workspaceHostContext = workspaceSessionId
    ? buildSessionWorkspaceHostContext(
        await readWorkspaceLaunchSessionContext(workspaceSessionId, scopedRoute)
      )
    : null;
  const scopedApprovals = workspaceSessionId
    ? approvalRequests.filter((request) => request.sessionId === workspaceSessionId)
    : [];
  const scopedRecoveries = workspaceSessionId
    ? recoveryIncidents.filter((incident) => incident.sessionId === workspaceSessionId)
    : [];

  return (
    <PrimaryRunSurface
      routeScope={scopedRoute}
      initiative={initiative}
      currentRun={currentRun}
      currentTaskGraph={currentTaskGraphDetail?.taskGraph ?? null}
      currentBatch={currentBatch}
      currentDelivery={currentDelivery}
      currentPreviewTarget={currentPreviewTarget}
      latestRunEvent={latestRunEvent}
      currentHandoffPacket={currentHandoffPacket}
      plannerNotes={currentTaskGraphDetail?.notes ?? []}
      workUnits={currentTaskGraphDetail?.workUnits ?? []}
      agentSessions={agentSessions}
      recoveryIncidents={scopedRecoveries}
      approvalRequests={scopedApprovals}
      workspaceHostContext={workspaceHostContext}
    />
  );
}
