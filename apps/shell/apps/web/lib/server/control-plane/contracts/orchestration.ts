import type {
  ControlPlaneIntegrationState,
  ControlPlaneStorageKind,
} from "./control-plane-meta";

export const ORCHESTRATION_API_ROOT = "/api/control/orchestration";

export const ORCHESTRATION_ROUTE_GROUPS = [
  "initiatives",
  "briefs",
  "task-graphs",
  "work-units",
  "batches",
  "supervisor",
  "assembly",
  "verification",
  "delivery",
] as const;

export type OrchestrationRouteGroup = (typeof ORCHESTRATION_ROUTE_GROUPS)[number];

export const ORCHESTRATION_ENTITY_TYPES = [
  "initiative",
  "brief",
  "task_graph",
  "work_unit",
  "attempt",
  "batch",
  "assembly",
  "verification",
  "delivery",
] as const;

export type OrchestrationEntityType = (typeof ORCHESTRATION_ENTITY_TYPES)[number];

export type InitiativePriority = "low" | "normal" | "high";

export type InitiativeStatus =
  | "draft"
  | "clarifying"
  | "brief_ready"
  | "planning"
  | "running"
  | "assembly"
  | "verifying"
  | "ready"
  | "failed"
  | "cancelled";

export const INITIATIVE_STATUS_FLOW = [
  "draft",
  "clarifying",
  "brief_ready",
  "planning",
  "running",
  "assembly",
  "verifying",
  "ready",
] as const satisfies readonly InitiativeStatus[];

export const INITIATIVE_TERMINAL_STATUSES = [
  "failed",
  "cancelled",
] as const satisfies readonly InitiativeStatus[];

export interface InitiativeRecord {
  id: string;
  title: string;
  userRequest: string;
  status: InitiativeStatus;
  requestedBy: string;
  workspaceSessionId?: string | null;
  priority?: InitiativePriority;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInitiativeRequest {
  title: string;
  userRequest: string;
  requestedBy: string;
  workspaceSessionId?: string | null;
  priority?: InitiativePriority;
}

export interface UpdateInitiativeRequest {
  title?: string;
  userRequest?: string;
  status?: InitiativeStatus;
  requestedBy?: string;
  workspaceSessionId?: string | null;
  priority?: InitiativePriority;
}

export type ProjectBriefStatus =
  | "draft"
  | "clarifying"
  | "reviewing"
  | "approved"
  | "superseded";

export const PROJECT_BRIEF_STATUS_FLOW = [
  "draft",
  "clarifying",
  "reviewing",
  "approved",
] as const satisfies readonly ProjectBriefStatus[];

export const PROJECT_BRIEF_ALTERNATE_STATUSES = [
  "superseded",
] as const satisfies readonly ProjectBriefStatus[];

export interface ProjectBriefClarificationEntry {
  question: string;
  answer: string;
}

export interface ProjectBriefRecord {
  id: string;
  initiativeId: string;
  summary: string;
  goals: string[];
  nonGoals: string[];
  constraints: string[];
  assumptions: string[];
  acceptanceCriteria: string[];
  repoScope: string[];
  deliverables: string[];
  clarificationLog: ProjectBriefClarificationEntry[];
  status: ProjectBriefStatus;
  authoredBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectBriefRequest {
  initiativeId: string;
  summary: string;
  goals: string[];
  nonGoals: string[];
  constraints: string[];
  assumptions: string[];
  acceptanceCriteria: string[];
  repoScope: string[];
  deliverables: string[];
  clarificationLog: ProjectBriefClarificationEntry[];
  status?: ProjectBriefStatus;
  authoredBy: string;
}

export interface UpdateProjectBriefRequest {
  summary?: string;
  goals?: string[];
  nonGoals?: string[];
  constraints?: string[];
  assumptions?: string[];
  acceptanceCriteria?: string[];
  repoScope?: string[];
  deliverables?: string[];
  clarificationLog?: ProjectBriefClarificationEntry[];
  status?: ProjectBriefStatus;
  authoredBy?: string;
}

export type TaskGraphStatus = "draft" | "ready" | "active" | "completed" | "failed";

export const TASK_GRAPH_STATUS_FLOW = [
  "draft",
  "ready",
  "active",
  "completed",
] as const satisfies readonly TaskGraphStatus[];

export const TASK_GRAPH_TERMINAL_STATUSES = [
  "failed",
] as const satisfies readonly TaskGraphStatus[];

export type TaskGraphEdgeKind = "depends_on";

export interface TaskGraphEdge {
  from: string;
  to: string;
  kind: TaskGraphEdgeKind;
}

export interface TaskGraphRecord {
  id: string;
  initiativeId: string;
  briefId: string;
  version: number;
  nodeIds: string[];
  edges: TaskGraphEdge[];
  status: TaskGraphStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskGraphRequest {
  briefId: string;
}

export type WorkUnitExecutor = "droid" | "codex" | "human";
export type WorkUnitComplexity = "small" | "medium" | "large";
export type WorkUnitStatus =
  | "queued"
  | "ready"
  | "dispatched"
  | "running"
  | "blocked"
  | "retryable"
  | "completed"
  | "failed";

export const WORK_UNIT_STATUS_FLOW = [
  "queued",
  "ready",
  "dispatched",
  "running",
  "completed",
] as const satisfies readonly WorkUnitStatus[];

export const WORK_UNIT_EXCEPTION_STATUSES = [
  "blocked",
  "retryable",
  "failed",
] as const satisfies readonly WorkUnitStatus[];

export const WORK_UNIT_ALLOWED_TRANSITIONS = {
  queued: ["ready"],
  ready: ["dispatched"],
  dispatched: ["running", "blocked", "retryable", "failed"],
  running: ["completed", "blocked", "retryable", "failed"],
  blocked: ["retryable", "failed"],
  retryable: ["dispatched"],
  completed: [],
  failed: [],
} as const satisfies Record<WorkUnitStatus, readonly WorkUnitStatus[]>;

export interface WorkUnitRecord {
  id: string;
  taskGraphId: string;
  title: string;
  description: string;
  executorType: WorkUnitExecutor;
  scopePaths: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  estimatedComplexity?: WorkUnitComplexity;
  retryPolicy?: {
    maxAttempts?: number;
    backoffSeconds?: number;
    executorPreference?: WorkUnitExecutor[];
    failureClassification?: string;
  };
  status: WorkUnitStatus;
  latestAttemptId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkUnitRequest {
  taskGraphId: string;
  title: string;
  description: string;
  executorType: WorkUnitExecutor;
  scopePaths: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  estimatedComplexity?: WorkUnitComplexity;
  status?: WorkUnitStatus;
}

export interface UpdateWorkUnitRequest {
  title?: string;
  description?: string;
  executorType?: WorkUnitExecutor;
  scopePaths?: string[];
  dependencies?: string[];
  acceptanceCriteria?: string[];
  estimatedComplexity?: WorkUnitComplexity;
  status?: WorkUnitStatus;
  latestAttemptId?: string | null;
}

export type AttemptStatus =
  | "queued"
  | "leased"
  | "running"
  | "completed"
  | "blocked"
  | "canceled"
  | "started"
  | "succeeded"
  | "failed"
  | "abandoned";

export const ATTEMPT_TERMINAL_STATUSES = [
  "completed",
  "succeeded",
  "failed",
  "blocked",
  "canceled",
  "abandoned",
] as const satisfies readonly AttemptStatus[];

export interface AttemptRecord {
  id: string;
  workUnitId: string;
  batchId?: string | null;
  executorType: WorkUnitExecutor;
  status: AttemptStatus;
  attemptNumber?: number;
  parentAttemptId?: string | null;
  retryReason?: string | null;
  retryBackoffUntil?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  summary?: string | null;
  artifactUris: string[];
  errorCode?: string | null;
  errorSummary?: string | null;
  leaseHolder?: string | null;
  leaseExpiresAt?: string | null;
  lastHeartbeatAt?: string | null;
}

export interface ExecutorProofBundle {
  executorKind: "codex" | "claude" | "local_command" | "webhook" | "synthetic";
  summary: string;
  changedFiles: string[];
  logs: Array<{
    name: string;
    content: string;
  }>;
  tests: Array<{
    name: string;
    status: "passed" | "failed" | "skipped";
    command?: string[] | null;
    output?: string | null;
  }>;
  artifactUris: string[];
  exitCode: number;
  completedAt: string;
}

export type ExecutionBatchStatus =
  | "queued"
  | "dispatching"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "canceled";

export const EXECUTION_BATCH_STATUS_FLOW = [
  "queued",
  "dispatching",
  "running",
  "completed",
] as const satisfies readonly ExecutionBatchStatus[];

export const EXECUTION_BATCH_EXCEPTION_STATUSES = [
  "blocked",
  "failed",
  "canceled",
] as const satisfies readonly ExecutionBatchStatus[];

export interface ExecutionBatchRecord {
  id: string;
  initiativeId: string;
  taskGraphId: string;
  workUnitIds: string[];
  concurrencyLimit: number;
  status: ExecutionBatchStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface CreateExecutionBatchRequest {
  taskGraphId: string;
  workUnitIds?: string[];
  concurrencyLimit?: number;
}

export type SupervisorActionKind =
  | "batch.queued"
  | "batch.dispatched"
  | "attempt.completed"
  | "attempt.failed"
  | "work_unit.reassigned";

export interface SupervisorActionRecord {
  id: string;
  batchId: string;
  initiativeId: string;
  taskGraphId: string;
  workUnitId?: string | null;
  attemptId?: string | null;
  actionKind: SupervisorActionKind;
  actorType: "operator" | "system";
  actorId?: string | null;
  occurredAt: string;
  summary: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  payload: Record<string, unknown>;
}

export type SupervisorActionRequest =
  | {
      actionKind: "complete_attempt";
      batchId: string;
      attemptId: string;
      workUnitId: string;
      executorProof?: ExecutorProofBundle | null;
    }
  | {
      actionKind: "fail_attempt";
      batchId: string;
      attemptId: string;
      workUnitId: string;
      errorSummary?: string | null;
      errorCode?: string | null;
    }
  | {
      actionKind: "reassign_work_unit";
      batchId: string;
      workUnitId: string;
      executorType: WorkUnitExecutor;
    };

export type AssemblyStatus = "pending" | "assembling" | "assembled" | "failed";

export const ASSEMBLY_STATUS_FLOW = [
  "pending",
  "assembling",
  "assembled",
] as const satisfies readonly AssemblyStatus[];

export const ASSEMBLY_TERMINAL_STATUSES = [
  "failed",
] as const satisfies readonly AssemblyStatus[];

export interface AssemblyRecord {
  id: string;
  initiativeId: string;
  taskGraphId: string;
  inputWorkUnitIds: string[];
  artifactUris: string[];
  outputLocation?: string | null;
  manifestPath?: string | null;
  summary: string;
  status: AssemblyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssemblyRequest {
  initiativeId: string;
}

export type VerificationStatus = "pending" | "running" | "passed" | "failed";
export type VerificationCheckStatus = "pending" | "passed" | "failed";

export const VERIFICATION_STATUS_FLOW = [
  "pending",
  "running",
  "passed",
] as const satisfies readonly VerificationStatus[];

export const VERIFICATION_TERMINAL_STATUSES = [
  "failed",
] as const satisfies readonly VerificationStatus[];

export interface VerificationCheck {
  name: string;
  status: VerificationCheckStatus;
  details?: string | null;
  command?: string | null;
  cwd?: string | null;
  exitCode?: number | null;
  stdoutSnippet?: string | null;
  stderrSnippet?: string | null;
  artifactPath?: string | null;
}

export interface VerificationRunRecord {
  id: string;
  initiativeId: string;
  assemblyId: string;
  checks: VerificationCheck[];
  overallStatus: VerificationStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface CreateVerificationRequest {
  initiativeId: string;
}

export type DeliveryStatus = "pending" | "ready" | "delivered" | "rejected";
export type DeliveryLaunchProofKind =
  | "synthetic_wrapper"
  | "attempt_scaffold"
  | "runnable_result";
export type ReadinessTier = "local_solo" | "staging" | "production";

export const DELIVERY_STATUS_FLOW = [
  "pending",
  "ready",
  "delivered",
] as const satisfies readonly DeliveryStatus[];

export const DELIVERY_TERMINAL_STATUSES = [
  "rejected",
] as const satisfies readonly DeliveryStatus[];

export interface DeliveryRecord {
  id: string;
  initiativeId: string;
  verificationRunId: string;
  taskGraphId?: string | null;
  resultSummary: string;
  localOutputPath?: string | null;
  manifestPath?: string | null;
  previewUrl?: string | null;
  launchManifestPath?: string | null;
  launchProofKind?: DeliveryLaunchProofKind | null;
  launchTargetLabel?: string | null;
  launchProofUrl?: string | null;
  launchProofAt?: string | null;
  externalProofManifestPath?: string | null;
  readinessTier?: ReadinessTier;
  handoffNotes?: string | null;
  command?: string | null;
  status: DeliveryStatus;
  deliveredAt?: string | null;
}

export interface OrchestrationEventRecord {
  id: string;
  entityType: OrchestrationEntityType;
  entityId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface OrchestrationRecordMap {
  initiative: InitiativeRecord;
  brief: ProjectBriefRecord;
  task_graph: TaskGraphRecord;
  work_unit: WorkUnitRecord;
  attempt: AttemptRecord;
  batch: ExecutionBatchRecord;
  assembly: AssemblyRecord;
  verification: VerificationRunRecord;
  delivery: DeliveryRecord;
}

export type OrchestrationEntityRecord =
  OrchestrationRecordMap[OrchestrationEntityType];

export interface ControlPlaneOrchestrationDirectoryMeta {
  generatedAt: string;
  source: "mock" | "postgres" | "upstream" | "derived";
  storageKind: ControlPlaneStorageKind;
  integrationState: ControlPlaneIntegrationState;
  canonicalTruth: "sessionId";
  notes: string[];
}

export interface ControlPlaneOrchestrationDirectoryResponse<TRecord = unknown>
  extends ControlPlaneOrchestrationDirectoryMeta {
  items: TRecord[];
}

export interface ControlPlaneOrchestrationDetailResponse<TRecord = unknown>
  extends ControlPlaneOrchestrationDirectoryMeta {
  item: TRecord;
}

export interface InitiativesDirectoryResponse extends ControlPlaneOrchestrationDirectoryMeta {
  initiatives: InitiativeRecord[];
}

export interface InitiativeDetailResponse extends ControlPlaneOrchestrationDirectoryMeta {
  initiative: InitiativeRecord;
  briefs: ProjectBriefRecord[];
}

export interface InitiativeMutationResponse extends ControlPlaneOrchestrationDirectoryMeta {
  initiative: InitiativeRecord;
  briefs: ProjectBriefRecord[];
}

export interface ProjectBriefsDirectoryResponse extends ControlPlaneOrchestrationDirectoryMeta {
  briefs: ProjectBriefRecord[];
}

export interface ProjectBriefDetailResponse extends ControlPlaneOrchestrationDirectoryMeta {
  brief: ProjectBriefRecord;
  initiative: InitiativeRecord | null;
}

export interface ProjectBriefMutationResponse extends ControlPlaneOrchestrationDirectoryMeta {
  brief: ProjectBriefRecord;
  initiative: InitiativeRecord | null;
  taskGraph?: TaskGraphRecord | null;
}

export interface TaskGraphsDirectoryResponse extends ControlPlaneOrchestrationDirectoryMeta {
  taskGraphs: TaskGraphRecord[];
}

export interface TaskGraphDetailResponse extends ControlPlaneOrchestrationDirectoryMeta {
  taskGraph: TaskGraphRecord;
  initiative: InitiativeRecord | null;
  brief: ProjectBriefRecord | null;
  workUnits: WorkUnitRecord[];
  runnableWorkUnitIds: string[];
}

export interface TaskGraphMutationResponse extends ControlPlaneOrchestrationDirectoryMeta {
  taskGraph: TaskGraphRecord;
  initiative: InitiativeRecord | null;
  brief: ProjectBriefRecord | null;
  workUnits: WorkUnitRecord[];
  runnableWorkUnitIds: string[];
}

export interface WorkUnitsDirectoryResponse extends ControlPlaneOrchestrationDirectoryMeta {
  workUnits: WorkUnitRecord[];
  runnableWorkUnitIds: string[];
}

export interface WorkUnitDetailResponse extends ControlPlaneOrchestrationDirectoryMeta {
  workUnit: WorkUnitRecord;
  taskGraph: TaskGraphRecord | null;
  runnableWorkUnitIds: string[];
}

export interface WorkUnitMutationResponse extends ControlPlaneOrchestrationDirectoryMeta {
  workUnit: WorkUnitRecord;
  taskGraph: TaskGraphRecord | null;
  runnableWorkUnitIds: string[];
}

export interface ExecutionBatchesDirectoryResponse
  extends ControlPlaneOrchestrationDirectoryMeta {
  batches: ExecutionBatchRecord[];
}

export interface ExecutionBatchDetailResponse
  extends ControlPlaneOrchestrationDirectoryMeta {
  batch: ExecutionBatchRecord;
  taskGraph: TaskGraphRecord | null;
  workUnits: WorkUnitRecord[];
  attempts: AttemptRecord[];
  supervisorActions: SupervisorActionRecord[];
}

export interface ExecutionBatchMutationResponse
  extends ControlPlaneOrchestrationDirectoryMeta {
  batch: ExecutionBatchRecord;
  taskGraph: TaskGraphRecord | null;
  workUnits: WorkUnitRecord[];
  attempts: AttemptRecord[];
  supervisorActions: SupervisorActionRecord[];
}

export interface SupervisorActionMutationResponse
  extends ControlPlaneOrchestrationDirectoryMeta {
  batch: ExecutionBatchRecord;
  taskGraph: TaskGraphRecord | null;
  workUnit: WorkUnitRecord;
  attempts: AttemptRecord[];
  supervisorActions: SupervisorActionRecord[];
}

export interface SupervisorActionsDirectoryResponse
  extends ControlPlaneOrchestrationDirectoryMeta {
  supervisorActions: SupervisorActionRecord[];
}

export interface AssembliesDirectoryResponse
  extends ControlPlaneOrchestrationDirectoryMeta {
  assemblies: AssemblyRecord[];
}

export interface AssemblyMutationResponse
  extends ControlPlaneOrchestrationDirectoryMeta {
  assembly: AssemblyRecord;
  taskGraph: TaskGraphRecord | null;
  workUnits: WorkUnitRecord[];
}

export interface VerificationRunsDirectoryResponse
  extends ControlPlaneOrchestrationDirectoryMeta {
  verifications: VerificationRunRecord[];
}

export interface VerificationMutationResponse
  extends ControlPlaneOrchestrationDirectoryMeta {
  verification: VerificationRunRecord;
  assembly: AssemblyRecord | null;
  taskGraph: TaskGraphRecord | null;
  workUnits: WorkUnitRecord[];
  deliveryBlocked: boolean;
}

export interface DeliveryMutationResponse
  extends ControlPlaneOrchestrationDirectoryMeta {
  delivery: DeliveryRecord;
  verification: VerificationRunRecord | null;
  assembly: AssemblyRecord | null;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export function isInitiativePriority(value: unknown): value is InitiativePriority {
  return value === "low" || value === "normal" || value === "high";
}

export function isInitiativeStatus(value: unknown): value is InitiativeStatus {
  return (
    value === "draft" ||
    value === "clarifying" ||
    value === "brief_ready" ||
    value === "planning" ||
    value === "running" ||
    value === "assembly" ||
    value === "verifying" ||
    value === "ready" ||
    value === "failed" ||
    value === "cancelled"
  );
}

export function isProjectBriefStatus(value: unknown): value is ProjectBriefStatus {
  return (
    value === "draft" ||
    value === "clarifying" ||
    value === "reviewing" ||
    value === "approved" ||
    value === "superseded"
  );
}

export function isWorkUnitExecutor(value: unknown): value is WorkUnitExecutor {
  return value === "droid" || value === "codex" || value === "human";
}

export function isWorkUnitComplexity(value: unknown): value is WorkUnitComplexity {
  return value === "small" || value === "medium" || value === "large";
}

export function isWorkUnitStatus(value: unknown): value is WorkUnitStatus {
  return (
    value === "queued" ||
    value === "ready" ||
    value === "dispatched" ||
    value === "running" ||
    value === "blocked" ||
    value === "retryable" ||
    value === "completed" ||
    value === "failed"
  );
}

export function isProjectBriefClarificationEntry(
  value: unknown
): value is ProjectBriefClarificationEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    isNonEmptyString((value as { question?: unknown }).question) &&
    isNonEmptyString((value as { answer?: unknown }).answer)
  );
}

export function isCreateInitiativeRequest(value: unknown): value is CreateInitiativeRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as CreateInitiativeRequest;
  return (
    isNonEmptyString(candidate.title) &&
    isNonEmptyString(candidate.userRequest) &&
    isNonEmptyString(candidate.requestedBy) &&
    (candidate.workspaceSessionId === undefined ||
      candidate.workspaceSessionId === null ||
      typeof candidate.workspaceSessionId === "string") &&
    (candidate.priority === undefined || isInitiativePriority(candidate.priority))
  );
}

export function isUpdateInitiativeRequest(value: unknown): value is UpdateInitiativeRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as UpdateInitiativeRequest;
  return (
    (candidate.title === undefined || isNonEmptyString(candidate.title)) &&
    (candidate.userRequest === undefined || isNonEmptyString(candidate.userRequest)) &&
    (candidate.requestedBy === undefined || isNonEmptyString(candidate.requestedBy)) &&
    (candidate.status === undefined || isInitiativeStatus(candidate.status)) &&
    (candidate.workspaceSessionId === undefined ||
      candidate.workspaceSessionId === null ||
      typeof candidate.workspaceSessionId === "string") &&
    (candidate.priority === undefined || isInitiativePriority(candidate.priority))
  );
}

export function isCreateProjectBriefRequest(
  value: unknown
): value is CreateProjectBriefRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as CreateProjectBriefRequest;
  return (
    isNonEmptyString(candidate.initiativeId) &&
    isNonEmptyString(candidate.summary) &&
    isStringArray(candidate.goals) &&
    isStringArray(candidate.nonGoals) &&
    isStringArray(candidate.constraints) &&
    isStringArray(candidate.assumptions) &&
    isStringArray(candidate.acceptanceCriteria) &&
    isStringArray(candidate.repoScope) &&
    isStringArray(candidate.deliverables) &&
    Array.isArray(candidate.clarificationLog) &&
    candidate.clarificationLog.every(isProjectBriefClarificationEntry) &&
    isNonEmptyString(candidate.authoredBy) &&
    (candidate.status === undefined || isProjectBriefStatus(candidate.status))
  );
}

export function isUpdateProjectBriefRequest(
  value: unknown
): value is UpdateProjectBriefRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as UpdateProjectBriefRequest;
  return (
    (candidate.summary === undefined || isNonEmptyString(candidate.summary)) &&
    (candidate.goals === undefined || isStringArray(candidate.goals)) &&
    (candidate.nonGoals === undefined || isStringArray(candidate.nonGoals)) &&
    (candidate.constraints === undefined || isStringArray(candidate.constraints)) &&
    (candidate.assumptions === undefined || isStringArray(candidate.assumptions)) &&
    (candidate.acceptanceCriteria === undefined || isStringArray(candidate.acceptanceCriteria)) &&
    (candidate.repoScope === undefined || isStringArray(candidate.repoScope)) &&
    (candidate.deliverables === undefined || isStringArray(candidate.deliverables)) &&
    (candidate.clarificationLog === undefined ||
      (Array.isArray(candidate.clarificationLog) &&
        candidate.clarificationLog.every(isProjectBriefClarificationEntry))) &&
    (candidate.authoredBy === undefined || isNonEmptyString(candidate.authoredBy)) &&
    (candidate.status === undefined || isProjectBriefStatus(candidate.status))
  );
}

export function isCreateTaskGraphRequest(value: unknown): value is CreateTaskGraphRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    isNonEmptyString((value as { briefId?: unknown }).briefId)
  );
}

export function isCreateExecutionBatchRequest(
  value: unknown
): value is CreateExecutionBatchRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as CreateExecutionBatchRequest;
  return (
    isNonEmptyString(candidate.taskGraphId) &&
    (candidate.workUnitIds === undefined || isStringArray(candidate.workUnitIds)) &&
    (candidate.concurrencyLimit === undefined ||
      (typeof candidate.concurrencyLimit === "number" &&
        Number.isFinite(candidate.concurrencyLimit) &&
        candidate.concurrencyLimit > 0))
  );
}

function isExecutorProofBundle(value: unknown): value is ExecutorProofBundle {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    ["codex", "claude", "local_command", "webhook", "synthetic"].includes(
      String(candidate.executorKind)
    ) &&
    isNonEmptyString(candidate.summary) &&
    isStringArray(candidate.changedFiles) &&
    Array.isArray(candidate.logs) &&
    candidate.logs.every(
      (log) =>
        typeof log === "object" &&
        log !== null &&
        isNonEmptyString((log as { name?: unknown }).name) &&
        typeof (log as { content?: unknown }).content === "string"
    ) &&
    Array.isArray(candidate.tests) &&
    candidate.tests.every((test) => {
      if (typeof test !== "object" || test === null) {
        return false;
      }
      const record = test as Record<string, unknown>;
      return (
        isNonEmptyString(record.name) &&
        ["passed", "failed", "skipped"].includes(String(record.status)) &&
        (record.command === undefined || record.command === null || isStringArray(record.command)) &&
        (record.output === undefined || record.output === null || typeof record.output === "string")
      );
    }) &&
    isStringArray(candidate.artifactUris) &&
    typeof candidate.exitCode === "number" &&
    Number.isFinite(candidate.exitCode) &&
    isNonEmptyString(candidate.completedAt)
  );
}

export function isSupervisorActionRequest(
  value: unknown
): value is SupervisorActionRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const actionKind = candidate.actionKind;
  if (actionKind === "complete_attempt") {
    return (
      isNonEmptyString(candidate.batchId) &&
      isNonEmptyString(candidate.attemptId) &&
      isNonEmptyString(candidate.workUnitId) &&
      (candidate.executorProof === undefined ||
        candidate.executorProof === null ||
        isExecutorProofBundle(candidate.executorProof))
    );
  }
  if (actionKind === "fail_attempt") {
    return (
      isNonEmptyString(candidate.batchId) &&
      isNonEmptyString(candidate.attemptId) &&
      isNonEmptyString(candidate.workUnitId) &&
      (candidate.errorSummary === undefined ||
        candidate.errorSummary === null ||
        typeof candidate.errorSummary === "string") &&
      (candidate.errorCode === undefined ||
        candidate.errorCode === null ||
        typeof candidate.errorCode === "string")
    );
  }
  if (actionKind === "reassign_work_unit") {
    return (
      isNonEmptyString(candidate.batchId) &&
      isNonEmptyString(candidate.workUnitId) &&
      isWorkUnitExecutor(candidate.executorType)
    );
  }
  return false;
}

export function isCreateAssemblyRequest(
  value: unknown
): value is CreateAssemblyRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    isNonEmptyString((value as { initiativeId?: unknown }).initiativeId)
  );
}

export function isCreateVerificationRequest(
  value: unknown
): value is CreateVerificationRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    isNonEmptyString((value as { initiativeId?: unknown }).initiativeId)
  );
}

export function isCreateWorkUnitRequest(value: unknown): value is CreateWorkUnitRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as CreateWorkUnitRequest;
  return (
    isNonEmptyString(candidate.taskGraphId) &&
    isNonEmptyString(candidate.title) &&
    isNonEmptyString(candidate.description) &&
    isWorkUnitExecutor(candidate.executorType) &&
    isStringArray(candidate.scopePaths) &&
    isStringArray(candidate.dependencies) &&
    isStringArray(candidate.acceptanceCriteria) &&
    (candidate.estimatedComplexity === undefined ||
      isWorkUnitComplexity(candidate.estimatedComplexity)) &&
    (candidate.status === undefined || isWorkUnitStatus(candidate.status))
  );
}

export function isUpdateWorkUnitRequest(value: unknown): value is UpdateWorkUnitRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as UpdateWorkUnitRequest;
  return (
    (candidate.title === undefined || isNonEmptyString(candidate.title)) &&
    (candidate.description === undefined || isNonEmptyString(candidate.description)) &&
    (candidate.executorType === undefined || isWorkUnitExecutor(candidate.executorType)) &&
    (candidate.scopePaths === undefined || isStringArray(candidate.scopePaths)) &&
    (candidate.dependencies === undefined || isStringArray(candidate.dependencies)) &&
    (candidate.acceptanceCriteria === undefined ||
      isStringArray(candidate.acceptanceCriteria)) &&
    (candidate.estimatedComplexity === undefined ||
      isWorkUnitComplexity(candidate.estimatedComplexity)) &&
    (candidate.status === undefined || isWorkUnitStatus(candidate.status)) &&
    (candidate.latestAttemptId === undefined ||
      candidate.latestAttemptId === null ||
      typeof candidate.latestAttemptId === "string")
  );
}
