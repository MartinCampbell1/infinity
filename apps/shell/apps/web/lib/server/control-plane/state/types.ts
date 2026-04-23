import type { OperatorActionAuditEvent } from "../contracts/operator-actions";
import type { AccountQuotaSnapshot, AccountQuotaUpdate } from "../contracts/quota";
import type { RecoveryIncident } from "../contracts/recoveries";
import type { NormalizedExecutionEvent } from "../contracts/session-events";
import type { ApprovalRequest } from "../contracts/approvals";
import type {
  AssemblyRecord,
  DeliveryRecord,
  ExecutionBatchRecord,
  InitiativeRecord,
  ProjectBriefRecord,
  SupervisorActionRecord,
  TaskGraphRecord,
  VerificationRunRecord,
  WorkUnitRecord,
} from "../contracts/orchestration";

export type AutonomousRunStage =
  | "intake"
  | "specing"
  | "planning"
  | "queued"
  | "executing"
  | "assembling"
  | "verifying"
  | "delivering"
  | "preview_ready"
  | "handed_off"
  | "blocked"
  | "failed"
  | "cancelled";

export type AutonomousRunHealth = "healthy" | "degraded" | "blocked" | "failed";

export interface AutonomousRunRecord {
  id: string;
  initiativeId: string;
  title: string;
  originalPrompt: string;
  entryMode: "shell_chat";
  currentStage: AutonomousRunStage;
  health: AutonomousRunHealth;
  automationMode: "autonomous";
  manualStageProgression: boolean;
  operatorOverrideActive: boolean;
  previewStatus: "none" | "building" | "ready" | "failed";
  handoffStatus: "none" | "building" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface AutonomousSpecDocRecord {
  id: string;
  runId: string;
  initiativeId: string;
  briefId: string;
  status: "draft" | "ready" | "revised" | "blocked";
  summary: string;
  goals: string[];
  nonGoals: string[];
  constraints: string[];
  assumptions: string[];
  acceptanceCriteria: string[];
  deliverables: string[];
  clarifications: ProjectBriefRecord["clarificationLog"];
  artifactPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutonomousAgentSessionRecord {
  id: string;
  runId: string;
  batchId: string;
  workItemId: string;
  attemptId?: string | null;
  agentKind: "worker";
  status: "queued" | "starting" | "running" | "completed" | "refused" | "failed" | "cancelled";
  runtimeRef?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface AutonomousRefusalRecord {
  id: string;
  runId: string;
  workItemId?: string | null;
  agentSessionId?: string | null;
  reason: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
}

export interface AutonomousRunEventRecord {
  id: string;
  runId: string;
  initiativeId: string;
  kind: string;
  stage?: AutonomousRunStage | null;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AutonomousPreviewTargetRecord {
  id: string;
  runId: string;
  deliveryId: string;
  mode: "local";
  url: string;
  healthStatus: "pending" | "ready" | "failed";
  launchCommand?: string | null;
  sourcePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutonomousHandoffPacketRecord {
  id: string;
  runId: string;
  deliveryId: string;
  status: "building" | "ready" | "failed";
  rootPath: string;
  finalSummaryPath: string;
  manifestPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutonomousValidationProofRecord {
  id: string;
  runId: string;
  autonomousOnePrompt: boolean;
  manualStageProgression: boolean;
  previewReady: boolean;
  launchReady: boolean;
  handoffReady: boolean;
  launchManifestPath?: string | null;
  launchProofUrl?: string | null;
  eventTimelinePath: string;
  finalSummaryPath: string;
  generatedAt: string;
}

export interface AutonomousSecretPauseRecord {
  id: string;
  runId: string;
  kind: "secret_required" | "credential_required";
  message: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface StoredApprovalsState {
  requests: ApprovalRequest[];
  operatorActions: OperatorActionAuditEvent[];
  actionSequence: number;
}

export interface StoredRecoveriesState {
  incidents: RecoveryIncident[];
  operatorActions: OperatorActionAuditEvent[];
  actionSequence: number;
}

export interface StoredAccountsState {
  snapshots: AccountQuotaSnapshot[];
  updates: AccountQuotaUpdate[];
}

export interface StoredSessionsState {
  events: NormalizedExecutionEvent[];
}

export interface StoredOrchestrationState {
  initiatives: InitiativeRecord[];
  briefs: ProjectBriefRecord[];
  taskGraphs: TaskGraphRecord[];
  workUnits: WorkUnitRecord[];
  batches: ExecutionBatchRecord[];
  supervisorActions: SupervisorActionRecord[];
  assemblies: AssemblyRecord[];
  verifications: VerificationRunRecord[];
  deliveries: DeliveryRecord[];
  runs: AutonomousRunRecord[];
  specDocs: AutonomousSpecDocRecord[];
  agentSessions: AutonomousAgentSessionRecord[];
  refusals: AutonomousRefusalRecord[];
  runEvents: AutonomousRunEventRecord[];
  previewTargets: AutonomousPreviewTargetRecord[];
  handoffPackets: AutonomousHandoffPacketRecord[];
  validationProofs: AutonomousValidationProofRecord[];
  secretPauses: AutonomousSecretPauseRecord[];
}

export interface ControlPlaneState {
  version: 1;
  seededAt: string;
  approvals: StoredApprovalsState;
  recoveries: StoredRecoveriesState;
  accounts: StoredAccountsState;
  sessions: StoredSessionsState;
  orchestration: StoredOrchestrationState;
}
