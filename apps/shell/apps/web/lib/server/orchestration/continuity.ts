import {
  buildExecutionApprovalsScopeHref,
  buildExecutionBatchScopeHref,
  buildExecutionContinuityScopeHref,
  buildExecutionDeliveryScopeHref,
  buildExecutionRecoveriesScopeHref,
  buildExecutionTaskGraphScopeHref,
  type ShellRouteScope,
} from "../../route-scope";
import type { InitiativeContinuityResponse } from "../control-plane/contracts/continuity";
import { listMockApprovalRequests } from "../control-plane/approvals";
import { buildControlPlaneStateNotes, getControlPlaneIntegrationState, getControlPlaneStorageKind, getControlPlaneStorageSource, readControlPlaneState } from "../control-plane/state/store";
import { listMockRecoveryIncidents } from "../control-plane/recoveries";

const DEFAULT_HERMES_MEMORY_BASE_URL = "http://127.0.0.1:8766";

function scopeForInitiative(workspaceSessionId?: string | null): Partial<ShellRouteScope> {
  return {
    sessionId: workspaceSessionId ?? null,
  };
}

function normalizeBaseUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_HERMES_MEMORY_BASE_URL;
  }
  return trimmed.replace(/\/$/, "");
}

export async function buildInitiativeContinuityResponse(
  initiativeId: string
): Promise<InitiativeContinuityResponse | null> {
  const state = await readControlPlaneState();
  const initiative =
    state.orchestration.initiatives.find((candidate) => candidate.id === initiativeId) ?? null;
  if (!initiative) {
    return null;
  }

  const briefs = [...state.orchestration.briefs]
    .filter((candidate) => candidate.initiativeId === initiativeId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const taskGraphs = [...state.orchestration.taskGraphs]
    .filter((candidate) => candidate.initiativeId === initiativeId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const batches = [...state.orchestration.batches]
    .filter((candidate) => candidate.initiativeId === initiativeId)
    .sort((left, right) => (right.startedAt ?? right.id).localeCompare(left.startedAt ?? left.id));
  const assembly =
    [...state.orchestration.assemblies]
      .filter((candidate) => candidate.initiativeId === initiativeId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  const verification =
    [...state.orchestration.verifications]
      .filter((candidate) => candidate.initiativeId === initiativeId)
      .sort((left, right) =>
        (right.finishedAt ?? right.startedAt ?? right.id).localeCompare(
          left.finishedAt ?? left.startedAt ?? left.id
        )
      )[0] ?? null;
  const delivery =
    [...state.orchestration.deliveries]
      .filter((candidate) => candidate.initiativeId === initiativeId)
      .sort((left, right) => (right.deliveredAt ?? right.id).localeCompare(left.deliveredAt ?? left.id))[0] ?? null;

  const allApprovals = await listMockApprovalRequests();
  const allRecoveries = await listMockRecoveryIncidents();
  const relatedApprovals = initiative.workspaceSessionId
    ? allApprovals.filter((approval) => approval.sessionId === initiative.workspaceSessionId)
    : [];
  const relatedRecoveries = initiative.workspaceSessionId
    ? allRecoveries.filter((recovery) => recovery.sessionId === initiative.workspaceSessionId)
    : [];

  const routeScope = scopeForInitiative(initiative.workspaceSessionId);
  const memoryBaseUrl = normalizeBaseUrl(process.env.HERMES_MEMORY_SIDECAR_BASE_URL);

  return {
    generatedAt: new Date().toISOString(),
    source: getControlPlaneStorageSource(),
    storageKind: getControlPlaneStorageKind(),
    integrationState: getControlPlaneIntegrationState(),
    canonicalTruth: "sessionId",
    notes: buildControlPlaneStateNotes([
      "Continuity view is shell-owned and shows the durable lifecycle from intake to delivery.",
      initiative.workspaceSessionId
        ? `Approvals and recoveries are linked through workspace session ${initiative.workspaceSessionId}.`
        : "This initiative has no workspaceSessionId, so approvals and recoveries cannot be linked yet.",
    ]),
    initiative,
    briefs,
    taskGraphs,
    batches,
    assembly,
    verification,
    delivery,
    relatedApprovals,
    relatedRecoveries,
    memoryAdapter: {
      enabled: true,
      baseUrl: memoryBaseUrl,
      healthPath: "/health",
      schemaPath: "/actions/schema",
      readActionPath: "/actions/knowledgebase",
      readActions: ["status", "search", "get_page", "get_claim", "query"],
      note: "Read-first continuity adapter over the Hermes memory sidecar; avoid direct DB/layout coupling.",
    },
    links: {
      continuityHref: buildExecutionContinuityScopeHref(initiativeId, routeScope),
      approvalsHref: buildExecutionApprovalsScopeHref(routeScope),
      recoveriesHref: buildExecutionRecoveriesScopeHref(routeScope),
      taskGraphHref: taskGraphs[0]
        ? buildExecutionTaskGraphScopeHref(taskGraphs[0].id, routeScope, {
            initiativeId,
          })
        : null,
      batchHref: batches[0]
        ? buildExecutionBatchScopeHref(batches[0].id, routeScope, {
            initiativeId,
            taskGraphId: batches[0].taskGraphId,
          })
        : null,
      deliveryHref: delivery
        ? buildExecutionDeliveryScopeHref(delivery.id, routeScope, {
            initiativeId,
          })
        : null,
    },
  };
}
