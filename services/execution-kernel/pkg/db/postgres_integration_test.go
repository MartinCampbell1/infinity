package db

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func TestPostgresStoreRejectsLiveLeaseConflict(t *testing.T) {
	databaseURL := os.Getenv("EXECUTION_KERNEL_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set EXECUTION_KERNEL_TEST_DATABASE_URL to run the Postgres lease simulation")
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

	applyDurableKernelMigrationForDBTest(t, ctx, database)
	truncateDurableKernelTablesForDBTest(t, ctx, database)
	t.Cleanup(func() {
		truncateDurableKernelTablesForDBTest(t, ctx, database)
	})

	first, err := NewPostgresStore(databaseURL)
	if err != nil {
		t.Fatalf("NewPostgresStore(first) error = %v", err)
	}
	first.holder = "lease-holder-one"
	t.Cleanup(func() {
		if err := first.Close(); err != nil {
			t.Fatalf("close first store: %v", err)
		}
	})

	second, err := NewPostgresStore(databaseURL)
	if err != nil {
		t.Fatalf("NewPostgresStore(second) error = %v", err)
	}
	second.holder = "lease-holder-two"
	t.Cleanup(func() {
		if err := second.Close(); err != nil {
			t.Fatalf("close second store: %v", err)
		}
	})

	if err := first.Save(ctx, DefaultState()); err != nil {
		t.Fatalf("first Save() error = %v", err)
	}
	err = second.Save(ctx, DefaultState())
	if err == nil {
		t.Fatalf("expected second holder to fail while first lease is live")
	}
	if !strings.Contains(err.Error(), "lease is held") {
		t.Fatalf("expected lease conflict error, got %v", err)
	}
}

func TestPostgresStoreCloseReleasesLeaseForDifferentRestartHolder(t *testing.T) {
	databaseURL := os.Getenv("EXECUTION_KERNEL_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set EXECUTION_KERNEL_TEST_DATABASE_URL to run the Postgres lease release simulation")
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

	applyDurableKernelMigrationForDBTest(t, ctx, database)
	truncateDurableKernelTablesForDBTest(t, ctx, database)
	t.Cleanup(func() {
		truncateDurableKernelTablesForDBTest(t, ctx, database)
	})

	first, err := NewPostgresStore(databaseURL)
	if err != nil {
		t.Fatalf("NewPostgresStore(first) error = %v", err)
	}
	first.holder = "restart-holder-before-close"
	firstClosed := false
	t.Cleanup(func() {
		if !firstClosed {
			if err := first.Close(); err != nil {
				t.Fatalf("close first store: %v", err)
			}
		}
	})
	if err := first.Save(ctx, DefaultState()); err != nil {
		t.Fatalf("first Save() error = %v", err)
	}
	if err := first.Close(); err != nil {
		t.Fatalf("first Close() error = %v", err)
	}
	firstClosed = true

	second, err := NewPostgresStore(databaseURL)
	if err != nil {
		t.Fatalf("NewPostgresStore(second) error = %v", err)
	}
	second.holder = "restart-holder-after-close"
	t.Cleanup(func() {
		if err := second.Close(); err != nil {
			t.Fatalf("close second store: %v", err)
		}
	})
	if err := second.Save(ctx, DefaultState()); err != nil {
		t.Fatalf("expected different restart holder to save after first Close(), got %v", err)
	}
}

func applyDurableKernelMigrationForDBTest(t *testing.T, ctx context.Context, database *sql.DB) {
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

func truncateDurableKernelTablesForDBTest(t *testing.T, ctx context.Context, database *sql.DB) {
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
