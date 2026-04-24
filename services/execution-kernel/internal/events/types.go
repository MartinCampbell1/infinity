package events

type WorkUnit struct {
	ID                 string       `json:"id"`
	Title              string       `json:"title"`
	Description        string       `json:"description"`
	ExecutorType       string       `json:"executorType"`
	ScopePaths         []string     `json:"scopePaths"`
	Dependencies       []string     `json:"dependencies"`
	AcceptanceCriteria []string     `json:"acceptanceCriteria"`
	RetryPolicy        *RetryPolicy `json:"retryPolicy,omitempty"`
}

type RetryPolicy struct {
	MaxAttempts           int      `json:"maxAttempts,omitempty"`
	BackoffSeconds        int      `json:"backoffSeconds,omitempty"`
	ExecutorPreference    []string `json:"executorPreference,omitempty"`
	FailureClassification string   `json:"failureClassification,omitempty"`
}

type LaunchBatchRequest struct {
	BatchID          string     `json:"batchId"`
	InitiativeID     string     `json:"initiativeId"`
	TaskGraphID      string     `json:"taskGraphId"`
	ConcurrencyLimit int        `json:"concurrencyLimit"`
	WorkUnits        []WorkUnit `json:"workUnits"`
}

type BatchRecord struct {
	ID               string   `json:"id"`
	InitiativeID     string   `json:"initiativeId"`
	TaskGraphID      string   `json:"taskGraphId"`
	WorkUnitIDs      []string `json:"workUnitIds"`
	ConcurrencyLimit int      `json:"concurrencyLimit"`
	Status           string   `json:"status"`
	RecoveryState    string   `json:"recoveryState,omitempty"`
	StartedAt        *string  `json:"startedAt"`
	FinishedAt       *string  `json:"finishedAt"`
}

type AttemptRecord struct {
	ID                string   `json:"id"`
	WorkUnitID        string   `json:"workUnitId"`
	BatchID           *string  `json:"batchId"`
	ExecutorType      string   `json:"executorType"`
	Status            string   `json:"status"`
	RecoveryState     string   `json:"recoveryState,omitempty"`
	AttemptNumber     int      `json:"attemptNumber,omitempty"`
	ParentAttemptID   *string  `json:"parentAttemptId,omitempty"`
	RetryReason       *string  `json:"retryReason,omitempty"`
	RetryBackoffUntil *string  `json:"retryBackoffUntil,omitempty"`
	StartedAt         string   `json:"startedAt"`
	FinishedAt        *string  `json:"finishedAt"`
	Summary           *string  `json:"summary"`
	ArtifactURIs      []string `json:"artifactUris"`
	ErrorCode         *string  `json:"errorCode"`
	ErrorSummary      *string  `json:"errorSummary"`
	LeaseHolder       *string  `json:"leaseHolder,omitempty"`
	LeaseExpiresAt    *string  `json:"leaseExpiresAt,omitempty"`
	LastHeartbeatAt   *string  `json:"lastHeartbeatAt,omitempty"`
}

type BatchEnvelope struct {
	Batch    BatchRecord     `json:"batch"`
	Attempts []AttemptRecord `json:"attempts"`
}

type AttemptEnvelope struct {
	Attempt AttemptRecord `json:"attempt"`
}

type AttemptActionRequest struct {
	ErrorCode    *string `json:"errorCode"`
	ErrorSummary *string `json:"errorSummary"`
}

type AttemptActionEnvelope struct {
	Batch   BatchRecord   `json:"batch"`
	Attempt AttemptRecord `json:"attempt"`
}

type RetryWorkUnitRequest struct {
	WorkUnitID            string  `json:"workUnitId"`
	ExecutorType          *string `json:"executorType,omitempty"`
	Reason                *string `json:"reason,omitempty"`
	MaxAttempts           *int    `json:"maxAttempts,omitempty"`
	BackoffSeconds        *int    `json:"backoffSeconds,omitempty"`
	FailureClassification *string `json:"failureClassification,omitempty"`
}

type AttemptLeaseRequest struct {
	Holder          string `json:"holder"`
	LeaseTTLSeconds int    `json:"leaseTtlSeconds,omitempty"`
}

type AttemptHeartbeatRequest struct {
	Holder          string `json:"holder"`
	LeaseTTLSeconds int    `json:"leaseTtlSeconds,omitempty"`
}

type BatchCounts struct {
	Total     int `json:"total"`
	Running   int `json:"running"`
	Blocked   int `json:"blocked"`
	Completed int `json:"completed"`
}

type AttemptCounts struct {
	Total     int `json:"total"`
	Queued    int `json:"queued"`
	Leased    int `json:"leased"`
	Running   int `json:"running"`
	Blocked   int `json:"blocked"`
	Canceled  int `json:"canceled"`
	Started   int `json:"started"`
	Succeeded int `json:"succeeded"`
	Failed    int `json:"failed"`
	Completed int `json:"completed"`
}

type FailureSummary struct {
	AttemptID    string  `json:"attemptId"`
	BatchID      *string `json:"batchId,omitempty"`
	WorkUnitID   string  `json:"workUnitId"`
	ErrorCode    *string `json:"errorCode,omitempty"`
	ErrorSummary *string `json:"errorSummary,omitempty"`
	FinishedAt   *string `json:"finishedAt,omitempty"`
}

type HealthResponse struct {
	Status             string          `json:"status"`
	Service            string          `json:"service"`
	GeneratedAt        string          `json:"generatedAt"`
	AuthMode           string          `json:"authMode"`
	DeploymentScope    string          `json:"deploymentScope"`
	Maturity           string          `json:"maturity"`
	StorageKind        string          `json:"storageKind"`
	DurabilityTier     string          `json:"durabilityTier"`
	StatePath          string          `json:"statePath,omitempty"`
	StateConfigured    bool            `json:"stateConfigured"`
	RuntimeState       string          `json:"runtimeState"`
	RecoveryState      string          `json:"recoveryState"`
	RestartRecoverable bool            `json:"restartRecoverable"`
	FailureState       string          `json:"failureState"`
	BatchCounts        BatchCounts     `json:"batchCounts"`
	AttemptCounts      AttemptCounts   `json:"attemptCounts"`
	BlockedBatchIDs    []string        `json:"blockedBatchIds"`
	FailedAttemptIDs   []string        `json:"failedAttemptIds"`
	ResumableBatchIDs  []string        `json:"resumableBatchIds"`
	LatestFailure      *FailureSummary `json:"latestFailure"`
	RecoveryHint       string          `json:"recoveryHint,omitempty"`
	Detail             string          `json:"detail"`
}
