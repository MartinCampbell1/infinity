import type {
  ControlPlaneDirectoryMeta,
  ControlPlaneIntegrationState,
} from "./control-plane-meta";
import type { OperatorActionAuditEvent } from "./operator-actions";
import type { TenantScopedRecordFields } from "./tenancy";
import type { WorkspaceRuntimeSnapshot } from "./workspace-launch";

export type RecoveryIncidentStatus =
  | "open"
  | "retryable"
  | "failing_over"
  | "recovered"
  | "dead"
  | "unknown";

export type RecoveryIncidentSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "unknown";

export type RecoveryActionKind =
  | "retry"
  | "failover"
  | "resolve"
  | "reopen"
  | "unknown";

export interface RecoveryIncident extends TenantScopedRecordFields {
  id: string;
  sessionId: string;
  externalSessionId?: string | null;
  projectId: string;
  projectName: string;
  groupId?: string | null;
  accountId?: string | null;
  workspaceId?: string | null;
  status: RecoveryIncidentStatus;
  severity: RecoveryIncidentSeverity;
  recoveryActionKind: RecoveryActionKind;
  summary: string;
  rootCause?: string | null;
  recommendedAction?: string | null;
  retryCount: number;
  openedAt: string;
  lastObservedAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  revision: number;
  raw?: Record<string, unknown> | null;
}

export interface RecoveryIncidentsSummary {
  total: number;
  open: number;
  retryable: number;
  failingOver: number;
  recovered: number;
  dead: number;
}

export interface RecoveryIncidentsDirectoryFilters {
  sessionId?: string | null;
  projectId?: string | null;
  initiativeId?: string | null;
  groupId?: string | null;
  accountId?: string | null;
  workspaceId?: string | null;
}

export interface RecoveryIncidentsDirectory extends ControlPlaneDirectoryMeta {
  incidents: RecoveryIncident[];
  summary: RecoveryIncidentsSummary;
  operatorActions: OperatorActionAuditEvent[];
}

export interface RecoveryIncidentDetailResponse extends ControlPlaneDirectoryMeta {
  recoveryIncident: RecoveryIncident;
  operatorActions: OperatorActionAuditEvent[];
  summary: RecoveryIncidentsSummary;
}

export interface RecoveryActionContext {
  targetAccountId?: string | null;
}

export interface RecoveryRecordActionRequest extends RecoveryActionContext {
  actionKind: RecoveryActionKind;
}

export interface RecoveryRecordActionResult {
  recoveryIncident: RecoveryIncident;
  operatorAction: OperatorActionAuditEvent;
  idempotent: boolean;
  accepted: boolean;
  rejectedReason?: string | null;
  integrationState: ControlPlaneIntegrationState;
}

export interface OrchestrationRetryResult {
  initiativeId: string;
  recoveryId: string;
  verificationId: string | null;
  verificationStatus: string | null;
  deliveryId: string | null;
  deliveryStatus: string | null;
  launchProofKind: string | null;
  newRecoveryIncidentId: string | null;
}

export interface RecoveryRecordActionResponse extends ControlPlaneDirectoryMeta {
  recoveryIncident: RecoveryIncident;
  operatorAction: OperatorActionAuditEvent;
  idempotent: boolean;
  accepted: boolean;
  rejectedReason?: string | null;
  orchestrationRetry?: OrchestrationRetryResult | null;
  runtimeSnapshot: WorkspaceRuntimeSnapshot;
}

export function isRecoveryActionKind(value: unknown): value is RecoveryActionKind {
  return (
    value === "retry" ||
    value === "failover" ||
    value === "resolve" ||
    value === "reopen" ||
    value === "unknown"
  );
}

export function isRecoveryRecordActionRequest(
  value: unknown
): value is RecoveryRecordActionRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "actionKind" in value &&
    isRecoveryActionKind((value as { actionKind?: unknown }).actionKind)
  );
}
