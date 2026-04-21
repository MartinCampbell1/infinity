import type { ControlPlaneDirectoryMeta } from "./control-plane-meta";
import type { ExecutionSessionSummary } from "./session-events";

export type OperatorActionTargetKind = "approval_request" | "recovery_incident";

export type OperatorActionKind =
  | "approval.responded"
  | "recovery.retry_requested"
  | "recovery.failover_requested"
  | "recovery.resolved"
  | "recovery.reopened";

export type OperatorActionOutcome =
  | "applied"
  | "idempotent"
  | "rejected"
  | "deferred"
  | "failed"
  | "unknown";

export interface OperatorActionAuditEvent {
  id: string;
  sequence: number;
  sessionId: string;
  projectId: string;
  groupId?: string | null;
  targetKind: OperatorActionTargetKind;
  targetId: string;
  kind: OperatorActionKind;
  outcome: OperatorActionOutcome;
  actorType: "operator" | "system";
  actorId?: string | null;
  occurredAt: string;
  summary: string;
  payload: Record<string, unknown>;
  raw?: Record<string, unknown> | null;
}

export interface OperatorActionAuditSummary {
  total: number;
  approvals: number;
  recoveries: number;
  applied: number;
  idempotent: number;
  rejected: number;
  deferred: number;
  failed: number;
}

export interface OperatorActionAuditTargetSummary {
  id: string;
  targetKind: OperatorActionTargetKind;
  title: string;
  summary: string;
  status: string;
  sessionId: string;
  projectId: string;
  projectName: string;
  groupId?: string | null;
  accountId?: string | null;
  workspaceId?: string | null;
  revision?: number | null;
}

export interface OperatorActionAuditDirectory extends ControlPlaneDirectoryMeta {
  events: OperatorActionAuditEvent[];
  summary: OperatorActionAuditSummary;
}

export interface OperatorActionAuditDetailResponse
  extends ControlPlaneDirectoryMeta {
  auditEvent: OperatorActionAuditEvent;
  summary: OperatorActionAuditSummary;
  target: OperatorActionAuditTargetSummary | null;
  session: ExecutionSessionSummary | null;
}
