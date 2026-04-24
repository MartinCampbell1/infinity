package service

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"execution-kernel/internal/events"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func TestPostgresBackedServiceSurvivesRestart(t *testing.T) {
	databaseURL := os.Getenv("EXECUTION_KERNEL_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set EXECUTION_KERNEL_TEST_DATABASE_URL to run the Postgres restart simulation")
	}

	ctx := context.Background()
	database, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	t.Cleanup(func() {
		if err := database.Close(); err != nil {
			t.Fatalf("close test database: %v", err)
		}
	})

	applyDurableKernelMigration(t, ctx, database)
	truncateDurableKernelTables(t, ctx, database)
	t.Cleanup(func() {
		truncateDurableKernelTables(t, ctx, database)
	})

	svc, err := NewPostgresBacked(databaseURL)
	if err != nil {
		t.Fatalf("NewPostgresBacked() error = %v", err)
	}

	launch, err := svc.LaunchBatch(ctx, events.LaunchBatchRequest{
		BatchID:          "batch-postgres-restart-001",
		InitiativeID:     "initiative-postgres-restart-001",
		TaskGraphID:      "task-graph-postgres-restart-001",
		ConcurrencyLimit: 2,
		WorkUnits: []events.WorkUnit{
			{
				ID:                 "work-unit-postgres-complete-001",
				Title:              "Complete before restart",
				Description:        "Verify completed attempt records survive restart",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"Completed state survives restart"},
			},
			{
				ID:                 "work-unit-postgres-fail-001",
				Title:              "Block before restart",
				Description:        "Verify blocked attempt records survive restart",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"Blocked state survives restart"},
			},
			{
				ID:                 "work-unit-postgres-running-001",
				Title:              "Interrupt before restart",
				Description:        "Verify in-flight attempt records become recoverable after restart",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"Running state survives as recoverable backlog"},
			},
		},
	})
	if err != nil {
		t.Fatalf("LaunchBatch() error = %v", err)
	}
	if _, err := svc.CompleteAttempt(ctx, launch.Attempts[0].ID); err != nil {
		t.Fatalf("CompleteAttempt() error = %v", err)
	}
	if _, err := svc.FailAttempt(ctx, launch.Attempts[1].ID, events.AttemptActionRequest{
		ErrorCode:    stringPointer("POSTGRES_RESTART"),
		ErrorSummary: stringPointer("blocked before restart"),
	}); err != nil {
		t.Fatalf("FailAttempt() error = %v", err)
	}
	if err := svc.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	reloaded, err := NewPostgresBacked(databaseURL)
	if err != nil {
		t.Fatalf("NewPostgresBacked() reload error = %v", err)
	}
	t.Cleanup(func() {
		if err := reloaded.Close(); err != nil {
			t.Fatalf("Close() reload error = %v", err)
		}
	})

	health := reloaded.Health(ctx)
	if health.StorageKind != "postgres" {
		t.Fatalf("expected postgres storage after reload, got %s", health.StorageKind)
	}
	if health.DurabilityTier != "postgres_transactional" {
		t.Fatalf("expected postgres_transactional durability, got %s", health.DurabilityTier)
	}
	if !health.RestartRecoverable {
		t.Fatalf("expected restarted Postgres-backed state to remain recoverable")
	}

	detail, err := reloaded.BatchDetail(ctx, "batch-postgres-restart-001")
	if err != nil {
		t.Fatalf("BatchDetail() error = %v", err)
	}
	if len(detail.Attempts) != 3 {
		t.Fatalf("expected three persisted attempts after restart, got %#v", detail.Attempts)
	}
	statusByWorkUnit := map[string]string{}
	for _, attempt := range detail.Attempts {
		statusByWorkUnit[attempt.WorkUnitID] = attempt.Status
	}
	if statusByWorkUnit["work-unit-postgres-complete-001"] != "completed" {
		t.Fatalf("expected completed attempt to survive restart, got %#v", statusByWorkUnit)
	}
	if statusByWorkUnit["work-unit-postgres-fail-001"] != "failed" {
		t.Fatalf("expected blocked/failed attempt to survive restart, got %#v", statusByWorkUnit)
	}
	if statusByWorkUnit["work-unit-postgres-running-001"] != "blocked" {
		t.Fatalf("expected in-flight tail to block when the batch fails, got %#v", statusByWorkUnit)
	}

	var recoveredAttemptStatus string
	if err := database.QueryRowContext(
		ctx,
		`SELECT status FROM execution_kernel_attempts WHERE work_unit_id = 'work-unit-postgres-running-001'`,
	).Scan(&recoveredAttemptStatus); err != nil {
		t.Fatalf("read recovered attempt status: %v", err)
	}
	if recoveredAttemptStatus != "blocked" {
		t.Fatalf("expected failed batch tail to persist blocked status to Postgres, got %s", recoveredAttemptStatus)
	}

	var snapshotCount int
	if err := database.QueryRowContext(ctx, `SELECT COUNT(*) FROM execution_kernel_work_units_snapshot`).Scan(&snapshotCount); err != nil {
		t.Fatalf("read work unit snapshot count: %v", err)
	}
	if snapshotCount != 3 {
		t.Fatalf("expected three work unit snapshots, got %d", snapshotCount)
	}
}

func applyDurableKernelMigration(t *testing.T, ctx context.Context, database *sql.DB) {
	t.Helper()

	matches, err := filepath.Glob(filepath.Join("..", "..", "migrations", "*.sql"))
	if err != nil {
		t.Fatalf("list durable migrations: %v", err)
	}
	for _, migrationPath := range matches {
		raw, err := os.ReadFile(migrationPath)
		if err != nil {
			t.Fatalf("read durable migration %s: %v", migrationPath, err)
		}
		for _, statement := range strings.Split(string(raw), ";") {
			statement = strings.TrimSpace(statement)
			if statement == "" {
				continue
			}
			if _, err := database.ExecContext(ctx, statement); err != nil {
				t.Fatalf("apply durable migration %s statement %q: %v", migrationPath, statement, err)
			}
		}
	}
}

func truncateDurableKernelTables(t *testing.T, ctx context.Context, database *sql.DB) {
	t.Helper()

	if _, err := database.ExecContext(ctx, `
		TRUNCATE TABLE
			execution_kernel_events,
			execution_kernel_heartbeats,
			execution_kernel_leases,
			execution_kernel_work_units_snapshot,
			execution_kernel_attempts,
			execution_kernel_batches
		RESTART IDENTITY CASCADE
	`); err != nil {
		t.Fatalf("truncate durable kernel tables: %v", err)
	}
}
