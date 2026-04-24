import type {
  ControlPlaneDirectoryMeta,
  ControlPlaneIntegrationState,
} from "./control-plane-meta";
import type { OperatorActionAuditEvent } from "./operator-actions";
import type { TenantScopedRecordFields } from "./tenancy";
import type { WorkspaceRuntimeSnapshot } from "./workspace-launch";

export type ApprovalRequestStatus =
  | "pending"
  | "approved"
  | "denied"
  | "cancelled"
  | "unknown";

export type ApprovalDecision =
  | "approve_once"
  | "approve_session"
  | "approve_always"
  | "deny";

export type ApprovalRequestKind =
  | "tool_call"
  | "command"
  | "file_write"
  | "workspace_action"
  | "model_switch"
  | "unknown";

export interface ApprovalRequest extends TenantScopedRecordFields {
  id: string;
  sessionId: string;
  externalSessionId?: string | null;
  projectId: string;
  projectName: string;
  groupId?: string | null;
  accountId?: string | null;
  workspaceId?: string | null;
  requestKind: ApprovalRequestKind;
  title: string;
  summary: string;
  reason?: string | null;
  status: ApprovalRequestStatus;
  decision?: ApprovalDecision | null;
  requestedAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  expiresAt?: string | null;
  revision: number;
  raw?: Record<string, unknown> | null;
}

export interface ApprovalRequestsSummary {
  total: number;
  pending: number;
  resolved: number;
}

export interface ApprovalRequestsDirectory extends ControlPlaneDirectoryMeta {
  requests: ApprovalRequest[];
  summary: ApprovalRequestsSummary;
  operatorActions: OperatorActionAuditEvent[];
}

export interface ApprovalCreateRequest {
  id?: string | null;
  sessionId: string;
  externalSessionId?: string | null;
  projectId: string;
  projectName: string;
  groupId?: string | null;
  accountId?: string | null;
  workspaceId?: string | null;
  requestKind: ApprovalRequestKind;
  title: string;
  summary: string;
  reason?: string | null;
  expiresAt?: string | null;
  raw?: Record<string, unknown> | null;
}

export interface ApprovalCreateResponse extends ControlPlaneDirectoryMeta {
  approvalRequest: ApprovalRequest;
  summary: ApprovalRequestsSummary;
}

export interface ApprovalRequestDetailResponse extends ControlPlaneDirectoryMeta {
  approvalRequest: ApprovalRequest;
  operatorActions: OperatorActionAuditEvent[];
  summary: ApprovalRequestsSummary;
}

export interface ApprovalRespondResult {
  approvalRequest: ApprovalRequest;
  operatorAction: OperatorActionAuditEvent;
  idempotent: boolean;
  accepted: boolean;
  rejectedReason?: string | null;
  integrationState: ControlPlaneIntegrationState;
}

export interface ApprovalRespondRequest {
  decision: ApprovalDecision;
}

export interface ApprovalRespondResponse extends ControlPlaneDirectoryMeta {
  approvalRequest: ApprovalRequest;
  operatorAction: OperatorActionAuditEvent;
  idempotent: boolean;
  accepted: boolean;
  rejectedReason?: string | null;
  runtimeSnapshot: WorkspaceRuntimeSnapshot;
}

export function isApprovalDecision(value: unknown): value is ApprovalDecision {
  return (
    value === "approve_once" ||
    value === "approve_session" ||
    value === "approve_always" ||
    value === "deny"
  );
}

export function isApprovalRequestKind(value: unknown): value is ApprovalRequestKind {
  return (
    value === "tool_call" ||
    value === "command" ||
    value === "file_write" ||
    value === "workspace_action" ||
    value === "model_switch" ||
    value === "unknown"
  );
}

export function isApprovalRespondRequest(value: unknown): value is ApprovalRespondRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "decision" in value &&
    isApprovalDecision((value as { decision?: unknown }).decision)
  );
}
