package db

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDurableStoreMigrationDefinesRequiredTables(t *testing.T) {
	t.Parallel()

	matches, err := filepath.Glob(filepath.Join("..", "..", "migrations", "*.sql"))
	if err != nil {
		t.Fatalf("list durable store migrations: %v", err)
	}
	migration := ""
	for _, migrationPath := range matches {
		raw, err := os.ReadFile(migrationPath)
		if err != nil {
			t.Fatalf("read durable store migration %s: %v", migrationPath, err)
		}
		migration += "\n" + string(raw)
	}
	for _, tableName := range []string{
		"execution_kernel_batches",
		"execution_kernel_attempts",
		"execution_kernel_work_units_snapshot",
		"execution_kernel_leases",
		"execution_kernel_heartbeats",
		"execution_kernel_events",
	} {
		if !strings.Contains(migration, tableName) {
			t.Fatalf("expected migration to define %s", tableName)
		}
	}
	for _, columnName := range []string{
		"lease_holder",
		"lease_expires_at",
		"last_heartbeat_at",
		"attempt_number",
		"parent_attempt_id",
		"retry_reason",
		"retry_backoff_until",
	} {
		if !strings.Contains(migration, columnName) {
			t.Fatalf("expected migrations to define %s", columnName)
		}
	}
}

func TestRuntimeStoreDoesNotOwnSchemaDDL(t *testing.T) {
	t.Parallel()

	raw, err := os.ReadFile("store.go")
	if err != nil {
		t.Fatalf("read runtime store source: %v", err)
	}
	source := strings.ToUpper(string(raw))
	for _, forbidden := range []string{"CREATE TABLE", "ALTER TABLE", "DROP TABLE"} {
		if strings.Contains(source, forbidden) {
			t.Fatalf("runtime store source must not contain %q; schema changes belong in migrations", forbidden)
		}
	}
}

func TestPostgresStoreUsesTransactionalLeaseAndHeartbeatSignals(t *testing.T) {
	t.Parallel()

	raw, err := os.ReadFile("store.go")
	if err != nil {
		t.Fatalf("read runtime store source: %v", err)
	}
	source := string(raw)
	for _, required := range []string{
		"pg_advisory_xact_lock",
		"execution_kernel_leases",
		"execution_kernel_leases.expires_at <= NOW()",
		"RowsAffected",
		"execution_kernel_heartbeats",
		"execution_kernel_events",
	} {
		if !strings.Contains(source, required) {
			t.Fatalf("expected Postgres store to use %s", required)
		}
	}
}
