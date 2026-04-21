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
}

func stringPointer(value string) *string {
	return &value
}
