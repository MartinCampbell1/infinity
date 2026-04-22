export type ExecutionKernelWorkUnit = {
  id: string;
  title: string;
  description: string;
  executorType: "droid" | "codex" | "human";
  scopePaths: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
};

export type ExecutionKernelBatchStatus =
  | "queued"
  | "dispatching"
  | "running"
  | "blocked"
  | "completed"
  | "failed";

export type ExecutionKernelAttemptStatus =
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
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type ExecutionKernelAttemptRecord = {
  id: string;
  workUnitId: string;
  batchId?: string | null;
  executorType: "droid" | "codex" | "human";
  status: ExecutionKernelAttemptStatus;
  startedAt: string;
  finishedAt?: string | null;
  summary?: string | null;
  artifactUris: string[];
  errorCode?: string | null;
  errorSummary?: string | null;
};

export type ExecutionKernelHealthResponse = {
  status: "ok" | "degraded";
  service: "execution-kernel";
  generatedAt: string;
  authMode?: "localhost_only" | string;
  storageKind?: "memory" | "file" | string;
  statePath?: string | null;
  stateConfigured?: boolean;
  runtimeState?: "idle" | "running" | "blocked" | string;
  recoveryState?: "none" | "retryable" | string;
  restartRecoverable?: boolean;
  failureState?: "none" | "failed" | string;
  batchCounts?: {
    total: number;
    running: number;
    blocked: number;
    completed: number;
  };
  attemptCounts?: {
    total: number;
    started: number;
    succeeded: number;
    failed: number;
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

export type ExecutionKernelAttemptActionEnvelope = {
  batch: ExecutionKernelBatchRecord;
  attempt: ExecutionKernelAttemptRecord;
};
