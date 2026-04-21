package service

import (
	"context"
	"path/filepath"
	"testing"

	"execution-kernel/internal/events"
)

func TestFileBackedServiceRestoresPersistedState(t *testing.T) {
	t.Parallel()

	statePath := filepath.Join(t.TempDir(), "execution-kernel-state.json")
	svc, err := NewFileBacked(statePath)
	if err != nil {
		t.Fatalf("NewFileBacked() error = %v", err)
	}

	launch, err := svc.LaunchBatch(context.Background(), events.LaunchBatchRequest{
		BatchID:          "batch-persisted-001",
		InitiativeID:     "initiative-persisted-001",
		TaskGraphID:      "task-graph-persisted-001",
		ConcurrencyLimit: 1,
		WorkUnits: []events.WorkUnit{
			{
				ID:                 "work-unit-persisted-001",
				Title:              "Persisted foundation",
				Description:        "Create a restart-safe attempt record",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/apps/shell"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"State survives service recreation"},
			},
		},
	})
	if err != nil {
		t.Fatalf("LaunchBatch() error = %v", err)
	}

	attemptID := launch.Attempts[0].ID
	if _, err := svc.FailAttempt(context.Background(), attemptID, events.AttemptActionRequest{
		ErrorCode:    stringPointer("TOOL_FAILURE"),
		ErrorSummary: stringPointer("persistence smoke"),
	}); err != nil {
		t.Fatalf("FailAttempt() error = %v", err)
	}

	reloaded, err := NewFileBacked(statePath)
	if err != nil {
		t.Fatalf("NewFileBacked() reload error = %v", err)
	}

	batch, err := reloaded.BatchDetail(context.Background(), "batch-persisted-001")
	if err != nil {
		t.Fatalf("BatchDetail() error = %v", err)
	}
	if batch.Batch.Status != "blocked" {
		t.Fatalf("expected blocked batch after reload, got %s", batch.Batch.Status)
	}
	if len(batch.Attempts) != 1 {
		t.Fatalf("expected one persisted attempt, got %d", len(batch.Attempts))
	}
	if batch.Attempts[0].Status != "failed" {
		t.Fatalf("expected failed attempt after reload, got %s", batch.Attempts[0].Status)
	}
	if batch.Attempts[0].ErrorSummary == nil || *batch.Attempts[0].ErrorSummary != "persistence smoke" {
		t.Fatalf("expected persisted error summary, got %#v", batch.Attempts[0].ErrorSummary)
	}

	resumed, err := reloaded.ResumeBatch(context.Background(), "batch-persisted-001")
	if err != nil {
		t.Fatalf("ResumeBatch() error = %v", err)
	}
	if resumed.Batch.Status != "running" {
		t.Fatalf("expected resumed batch to be running, got %s", resumed.Batch.Status)
	}
	if len(resumed.Attempts) != 1 {
		t.Fatalf("expected one resumed attempt, got %d", len(resumed.Attempts))
	}
	if resumed.Attempts[0].Status != "started" {
		t.Fatalf("expected resumed attempt to be started, got %s", resumed.Attempts[0].Status)
	}
	if resumed.Attempts[0].ErrorSummary != nil {
		t.Fatalf("expected resumed attempt error summary to clear, got %#v", resumed.Attempts[0].ErrorSummary)
	}
}

func TestHealthReportsDurableAndRecoverableState(t *testing.T) {
	t.Parallel()

	statePath := filepath.Join(t.TempDir(), "execution-kernel-health.json")
	svc, err := NewFileBacked(statePath)
	if err != nil {
		t.Fatalf("NewFileBacked() error = %v", err)
	}

	launch, err := svc.LaunchBatch(context.Background(), events.LaunchBatchRequest{
		BatchID:          "batch-health-001",
		InitiativeID:     "initiative-health-001",
		TaskGraphID:      "task-graph-health-001",
		ConcurrencyLimit: 1,
		WorkUnits: []events.WorkUnit{
			{
				ID:                 "work-unit-health-001",
				Title:              "Health reporting",
				Description:        "Expose durable runtime state",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"Health reports durable local state"},
			},
		},
	})
	if err != nil {
		t.Fatalf("LaunchBatch() error = %v", err)
	}

	if _, err := svc.FailAttempt(context.Background(), launch.Attempts[0].ID, events.AttemptActionRequest{
		ErrorCode:    stringPointer("HEALTH_CHECK"),
		ErrorSummary: stringPointer("blocked for health snapshot"),
	}); err != nil {
		t.Fatalf("FailAttempt() error = %v", err)
	}

	health := svc.Health(context.Background())
	if health.Status != "degraded" {
		t.Fatalf("expected degraded health, got %s", health.Status)
	}
	if health.AuthMode != "localhost_only" {
		t.Fatalf("expected localhost_only auth mode, got %s", health.AuthMode)
	}
	if health.StorageKind != "file" {
		t.Fatalf("expected file storage kind, got %s", health.StorageKind)
	}
	if health.StatePath != statePath {
		t.Fatalf("expected state path %s, got %s", statePath, health.StatePath)
	}
	if !health.StateConfigured {
		t.Fatalf("expected file-backed state to be configured")
	}
	if health.RuntimeState != "blocked" {
		t.Fatalf("expected blocked runtime state, got %s", health.RuntimeState)
	}
	if health.RecoveryState != "retryable" {
		t.Fatalf("expected retryable recovery state, got %s", health.RecoveryState)
	}
	if !health.RestartRecoverable {
		t.Fatalf("expected restart-recoverable durable state signal")
	}
	if health.FailureState != "failed" {
		t.Fatalf("expected failed failure state, got %s", health.FailureState)
	}
	if health.BatchCounts.Blocked != 1 {
		t.Fatalf("expected one blocked batch, got %d", health.BatchCounts.Blocked)
	}
	if health.AttemptCounts.Failed != 1 {
		t.Fatalf("expected one failed attempt, got %d", health.AttemptCounts.Failed)
	}
	if len(health.BlockedBatchIDs) != 1 || health.BlockedBatchIDs[0] != "batch-health-001" {
		t.Fatalf("expected blocked batch ids to include batch-health-001, got %#v", health.BlockedBatchIDs)
	}
	if len(health.FailedAttemptIDs) != 1 || health.FailedAttemptIDs[0] != launch.Attempts[0].ID {
		t.Fatalf("expected failed attempt ids to include %s, got %#v", launch.Attempts[0].ID, health.FailedAttemptIDs)
	}
	if len(health.ResumableBatchIDs) != 1 || health.ResumableBatchIDs[0] != "batch-health-001" {
		t.Fatalf("expected resumable batch ids to include batch-health-001, got %#v", health.ResumableBatchIDs)
	}
	if health.LatestFailure == nil || health.LatestFailure.AttemptID != launch.Attempts[0].ID {
		t.Fatalf("expected latest failure to reference %s, got %#v", launch.Attempts[0].ID, health.LatestFailure)
	}
	if health.LatestFailure.ErrorCode == nil || *health.LatestFailure.ErrorCode != "HEALTH_CHECK" {
		t.Fatalf("expected latest failure error code HEALTH_CHECK, got %#v", health.LatestFailure)
	}
	if health.RecoveryHint == "" {
		t.Fatalf("expected a recovery hint for degraded runtime")
	}
}

func stringPointer(value string) *string {
	return &value
}
