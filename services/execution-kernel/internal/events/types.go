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

type HealthResponse struct {
	Status      string `json:"status"`
	Service     string `json:"service"`
	GeneratedAt string `json:"generatedAt"`
}
