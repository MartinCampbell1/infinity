export type ExecutionKernelWorkUnit = {
  id: string;
  title: string;
  description: string;
  executorType: "droid" | "codex" | "human";
  scopePaths: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  retryPolicy?: {
    maxAttempts?: number;
    backoffSeconds?: number;
    executorPreference?: string[];
    failureClassification?: string;
  };
};

export type ExecutionKernelBatchStatus =
  | "queued"
  | "dispatching"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "canceled";

export type ExecutionKernelAttemptStatus =
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

export type ExecutionKernelBatchRecord = {
  id: string;
  initiativeId: string;
  taskGraphId: string;
  workUnitIds: string[];
  concurrencyLimit: number;
  status: ExecutionKernelBatchStatus;
  recoveryState?: "retryable" | "resolved" | "archived" | "discarded" | string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type ExecutionKernelAttemptRecord = {
  id: string;
  workUnitId: string;
  batchId?: string | null;
  executorType: "droid" | "codex" | "human";
  status: ExecutionKernelAttemptStatus;
  recoveryState?: "retryable" | "resolved" | "archived" | "discarded" | string;
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
};

export type ExecutionKernelHealthResponse = {
  status: "ok" | "degraded";
  service: "execution-kernel";
  generatedAt: string;
  authMode?: "service_token_or_localhost_dev" | "localhost_only" | string;
  deploymentScope?: "service_to_service_private" | "localhost_only_solo" | string;
  maturity?: "service_auth_v1" | "localhost_solo_v1" | string;
  storageKind?: "memory" | "file" | "postgres" | string;
  durabilityTier?:
    | "ephemeral_memory"
    | "local_file_snapshot"
    | "postgres_transactional"
    | string;
  statePath?: string | null;
  stateConfigured?: boolean;
  runtimeState?: "idle" | "running" | "blocked" | string;
  recoveryState?: "none" | "retryable" | "archived" | "discarded" | string;
  restartRecoverable?: boolean;
  failureState?: "none" | "failed" | "historical" | string;
  batchCounts?: {
    total: number;
    running: number;
    blocked: number;
    completed: number;
  };
  attemptCounts?: {
    total: number;
    queued?: number;
    leased?: number;
    running?: number;
    blocked?: number;
    canceled?: number;
    started: number;
    succeeded: number;
    failed: number;
    completed?: number;
  };
  blockedBatchIds?: string[];
  failedAttemptIds?: string[];
  resumableBatchIds?: string[];
  latestFailure?: {
    attemptId: string;
    batchId?: string | null;
    workUnitId: string;
    errorCode?: string | null;
    errorSummary?: string | null;
    finishedAt?: string | null;
  } | null;
  recoveryHint?: string;
  detail?: string;
};

export type ExecutionKernelLaunchBatchRequest = {
  batchId: string;
  initiativeId: string;
  taskGraphId: string;
  concurrencyLimit: number;
  workUnits: ExecutionKernelWorkUnit[];
};

export type ExecutionKernelBatchEnvelope = {
  batch: ExecutionKernelBatchRecord;
  attempts: ExecutionKernelAttemptRecord[];
};

export type ExecutionKernelAttemptEnvelope = {
  attempt: ExecutionKernelAttemptRecord;
};

export type ExecutionKernelAttemptActionRequest = {
  errorCode?: string | null;
  errorSummary?: string | null;
};

export type ExecutionKernelRetryWorkUnitRequest = {
  workUnitId: string;
  executorType?: string | null;
  reason?: string | null;
  maxAttempts?: number | null;
  backoffSeconds?: number | null;
  failureClassification?: string | null;
};

export type ExecutionKernelAttemptLeaseRequest = {
  holder: string;
  leaseTtlSeconds?: number;
};

export type ExecutionKernelAttemptHeartbeatRequest = {
  holder: string;
  leaseTtlSeconds?: number;
};

export type ExecutionKernelAttemptActionEnvelope = {
  batch: ExecutionKernelBatchRecord;
  attempt: ExecutionKernelAttemptRecord;
};
