package events

type WorkUnit struct {
	ID                 string   `json:"id"`
	Title              string   `json:"title"`
	Description        string   `json:"description"`
	ExecutorType       string   `json:"executorType"`
	ScopePaths         []string `json:"scopePaths"`
	Dependencies       []string `json:"dependencies"`
	AcceptanceCriteria []string `json:"acceptanceCriteria"`
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
	StartedAt        *string  `json:"startedAt"`
	FinishedAt       *string  `json:"finishedAt"`
}

type AttemptRecord struct {
	ID           string   `json:"id"`
	WorkUnitID   string   `json:"workUnitId"`
	BatchID      *string  `json:"batchId"`
	ExecutorType string   `json:"executorType"`
	Status       string   `json:"status"`
	StartedAt    string   `json:"startedAt"`
	FinishedAt   *string  `json:"finishedAt"`
	Summary      *string  `json:"summary"`
	ArtifactURIs []string `json:"artifactUris"`
	ErrorCode    *string  `json:"errorCode"`
	ErrorSummary *string  `json:"errorSummary"`
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

type BatchCounts struct {
	Total     int `json:"total"`
	Running   int `json:"running"`
	Blocked   int `json:"blocked"`
	Completed int `json:"completed"`
}

type AttemptCounts struct {
	Total     int `json:"total"`
	Started   int `json:"started"`
	Succeeded int `json:"succeeded"`
	Failed    int `json:"failed"`
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
	Status             string        `json:"status"`
	Service            string        `json:"service"`
	GeneratedAt        string        `json:"generatedAt"`
	AuthMode           string        `json:"authMode"`
	StorageKind        string        `json:"storageKind"`
	StatePath          string        `json:"statePath,omitempty"`
	StateConfigured    bool          `json:"stateConfigured"`
	RuntimeState       string        `json:"runtimeState"`
	RecoveryState      string        `json:"recoveryState"`
	RestartRecoverable bool          `json:"restartRecoverable"`
	FailureState       string        `json:"failureState"`
	BatchCounts        BatchCounts   `json:"batchCounts"`
	AttemptCounts      AttemptCounts `json:"attemptCounts"`
	BlockedBatchIDs    []string        `json:"blockedBatchIds"`
	FailedAttemptIDs   []string        `json:"failedAttemptIds"`
	ResumableBatchIDs  []string        `json:"resumableBatchIds"`
	LatestFailure      *FailureSummary `json:"latestFailure"`
	RecoveryHint       string        `json:"recoveryHint,omitempty"`
	Detail             string        `json:"detail"`
}
