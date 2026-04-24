package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"execution-kernel/internal/events"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type PersistedState struct {
	Version   int                             `json:"version"`
	Batches   map[string]events.BatchRecord   `json:"batches"`
	Attempts  map[string]events.AttemptRecord `json:"attempts"`
	WorkUnits map[string]events.WorkUnit      `json:"workUnits,omitempty"`
}

type Store interface {
	Kind() string
	DurabilityTier() string
	StatePath() string
	Configured() bool
	Load(context.Context) (PersistedState, error)
	Save(context.Context, PersistedState) error
	Close() error
}

func DefaultState() PersistedState {
	return PersistedState{
		Version:   1,
		Batches:   map[string]events.BatchRecord{},
		Attempts:  map[string]events.AttemptRecord{},
		WorkUnits: map[string]events.WorkUnit{},
	}
}

type MemoryStore struct{}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{}
}

func (store *MemoryStore) Kind() string           { return "memory" }
func (store *MemoryStore) DurabilityTier() string { return "ephemeral_memory" }
func (store *MemoryStore) StatePath() string      { return "" }
func (store *MemoryStore) Configured() bool       { return false }
func (store *MemoryStore) Close() error           { return nil }

func (store *MemoryStore) Load(context.Context) (PersistedState, error) {
	return DefaultState(), nil
}

func (store *MemoryStore) Save(context.Context, PersistedState) error {
	return nil
}

type FileStore struct {
	path string
}

func NewFileStore(path string) *FileStore {
	return &FileStore{path: path}
}

func (store *FileStore) Kind() string           { return "file" }
func (store *FileStore) DurabilityTier() string { return "local_file_snapshot" }
func (store *FileStore) StatePath() string      { return store.path }
func (store *FileStore) Configured() bool       { return store.path != "" }
func (store *FileStore) Close() error           { return nil }

func (store *FileStore) Load(context.Context) (PersistedState, error) {
	state := DefaultState()
	if store.path == "" {
		return state, nil
	}

	raw, err := os.ReadFile(store.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return state, nil
		}
		return state, fmt.Errorf("read persisted execution-kernel state: %w", err)
	}
	if err := json.Unmarshal(raw, &state); err != nil {
		return state, fmt.Errorf("decode persisted execution-kernel state: %w", err)
	}
	return normalizeState(state), nil
}

func (store *FileStore) Save(_ context.Context, state PersistedState) error {
	if store.path == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(store.path), 0o755); err != nil {
		return fmt.Errorf("create execution-kernel state dir: %w", err)
	}

	raw, err := json.MarshalIndent(normalizeState(state), "", "  ")
	if err != nil {
		return fmt.Errorf("encode execution-kernel state: %w", err)
	}

	tempPath := fmt.Sprintf("%s.tmp-%d", store.path, time.Now().UnixNano())
	if err := os.WriteFile(tempPath, raw, 0o644); err != nil {
		return fmt.Errorf("write execution-kernel temp state: %w", err)
	}
	if err := os.Rename(tempPath, store.path); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("replace execution-kernel state: %w", err)
	}
	return nil
}

type PostgresStore struct {
	database *sql.DB
	target   string
	holder   string
}

func NewPostgresStore(databaseURL string) (*PostgresStore, error) {
	database, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}
	database.SetMaxOpenConns(4)
	database.SetMaxIdleConns(2)
	database.SetConnMaxLifetime(30 * time.Minute)
	return &PostgresStore{
		database: database,
		target:   describeDatabaseTarget(databaseURL),
		holder:   defaultLeaseHolder(),
	}, nil
}

func (store *PostgresStore) Kind() string           { return "postgres" }
func (store *PostgresStore) DurabilityTier() string { return "postgres_transactional" }
func (store *PostgresStore) StatePath() string      { return store.target }
func (store *PostgresStore) Configured() bool       { return true }

func (store *PostgresStore) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, releaseErr := store.database.ExecContext(ctx, `
		DELETE FROM execution_kernel_leases
		WHERE resource_id = 'kernel-state'
		  AND holder = $1
	`, store.holder)
	closeErr := store.database.Close()
	return errors.Join(releaseErr, closeErr)
}

func (store *PostgresStore) Load(ctx context.Context) (PersistedState, error) {
	state := DefaultState()

	batchRows, err := store.database.QueryContext(ctx, `
		SELECT id, initiative_id, task_graph_id, work_unit_ids, concurrency_limit,
		       status, recovery_state, started_at, finished_at
		FROM execution_kernel_batches
	`)
	if err != nil {
		return state, fmt.Errorf("read execution kernel batches: %w", err)
	}
	defer batchRows.Close()
	for batchRows.Next() {
		var batch events.BatchRecord
		var workUnitIDsRaw []byte
		var startedAt, finishedAt sql.NullTime
		if err := batchRows.Scan(
			&batch.ID,
			&batch.InitiativeID,
			&batch.TaskGraphID,
			&workUnitIDsRaw,
			&batch.ConcurrencyLimit,
			&batch.Status,
			&batch.RecoveryState,
			&startedAt,
			&finishedAt,
		); err != nil {
			return state, err
		}
		_ = json.Unmarshal(workUnitIDsRaw, &batch.WorkUnitIDs)
		batch.StartedAt = timePtrToString(startedAt)
		batch.FinishedAt = timePtrToString(finishedAt)
		state.Batches[batch.ID] = batch
	}
	if err := batchRows.Err(); err != nil {
		return state, err
	}

	attemptRows, err := store.database.QueryContext(ctx, `
		SELECT id, work_unit_id, batch_id, executor_type, status, recovery_state,
		       attempt_number, parent_attempt_id, retry_reason, retry_backoff_until,
		       started_at, finished_at, summary, artifact_uris, error_code, error_summary,
		       lease_holder, lease_expires_at, last_heartbeat_at
		FROM execution_kernel_attempts
	`)
	if err != nil {
		return state, fmt.Errorf("read execution kernel attempts: %w", err)
	}
	defer attemptRows.Close()
	for attemptRows.Next() {
		var attempt events.AttemptRecord
		var batchID, parentAttemptID, retryReason, summary, errorCode, errorSummary, leaseHolder sql.NullString
		var startedAt, finishedAt, retryBackoffUntil, leaseExpiresAt, lastHeartbeatAt sql.NullTime
		var artifactURIsRaw []byte
		if err := attemptRows.Scan(
			&attempt.ID,
			&attempt.WorkUnitID,
			&batchID,
			&attempt.ExecutorType,
			&attempt.Status,
			&attempt.RecoveryState,
			&attempt.AttemptNumber,
			&parentAttemptID,
			&retryReason,
			&retryBackoffUntil,
			&startedAt,
			&finishedAt,
			&summary,
			&artifactURIsRaw,
			&errorCode,
			&errorSummary,
			&leaseHolder,
			&leaseExpiresAt,
			&lastHeartbeatAt,
		); err != nil {
			return state, err
		}
		attempt.BatchID = stringPtr(batchID)
		attempt.ParentAttemptID = stringPtr(parentAttemptID)
		attempt.RetryReason = stringPtr(retryReason)
		attempt.RetryBackoffUntil = timePtrToString(retryBackoffUntil)
		if value := timePtrToString(startedAt); value != nil {
			attempt.StartedAt = *value
		}
		attempt.FinishedAt = timePtrToString(finishedAt)
		attempt.Summary = stringPtr(summary)
		attempt.ErrorCode = stringPtr(errorCode)
		attempt.ErrorSummary = stringPtr(errorSummary)
		attempt.LeaseHolder = stringPtr(leaseHolder)
		attempt.LeaseExpiresAt = timePtrToString(leaseExpiresAt)
		attempt.LastHeartbeatAt = timePtrToString(lastHeartbeatAt)
		_ = json.Unmarshal(artifactURIsRaw, &attempt.ArtifactURIs)
		state.Attempts[attempt.ID] = attempt
	}
	if err := attemptRows.Err(); err != nil {
		return state, err
	}

	workUnitRows, err := store.database.QueryContext(ctx, `
		SELECT work_unit_id, snapshot_json
		FROM execution_kernel_work_units_snapshot
	`)
	if err != nil {
		return state, fmt.Errorf("read execution kernel work unit snapshots: %w", err)
	}
	defer workUnitRows.Close()
	for workUnitRows.Next() {
		var workUnitID string
		var raw []byte
		var workUnit events.WorkUnit
		if err := workUnitRows.Scan(&workUnitID, &raw); err != nil {
			return state, err
		}
		if err := json.Unmarshal(raw, &workUnit); err == nil {
			state.WorkUnits[workUnitID] = workUnit
		}
	}
	if err := workUnitRows.Err(); err != nil {
		return state, err
	}

	return normalizeState(state), nil
}

func (store *PostgresStore) Save(ctx context.Context, state PersistedState) error {
	state = normalizeState(state)
	tx, err := store.database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(8798001)`); err != nil {
		return err
	}
	leaseResult, err := tx.ExecContext(ctx, `
		INSERT INTO execution_kernel_leases (resource_id, holder, expires_at, updated_at)
		VALUES ('kernel-state', $1, NOW() + INTERVAL '30 seconds', NOW())
		ON CONFLICT (resource_id) DO UPDATE SET
			holder = EXCLUDED.holder,
			expires_at = EXCLUDED.expires_at,
			updated_at = NOW()
		WHERE execution_kernel_leases.holder = EXCLUDED.holder
		   OR execution_kernel_leases.expires_at <= NOW()
	`, store.holder)
	if err != nil {
		return err
	}
	leaseRows, err := leaseResult.RowsAffected()
	if err != nil {
		return err
	}
	if leaseRows != 1 {
		return fmt.Errorf("execution kernel state lease is held by another live process")
	}

	for _, batch := range state.Batches {
		workUnitIDs, err := json.Marshal(batch.WorkUnitIDs)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO execution_kernel_batches (
				id, initiative_id, task_graph_id, work_unit_ids, concurrency_limit,
				status, recovery_state, started_at, finished_at, updated_at
			)
			VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, NOW())
			ON CONFLICT (id) DO UPDATE SET
				initiative_id = EXCLUDED.initiative_id,
				task_graph_id = EXCLUDED.task_graph_id,
				work_unit_ids = EXCLUDED.work_unit_ids,
				concurrency_limit = EXCLUDED.concurrency_limit,
				status = EXCLUDED.status,
				recovery_state = EXCLUDED.recovery_state,
				started_at = EXCLUDED.started_at,
				finished_at = EXCLUDED.finished_at,
				updated_at = NOW()
		`, batch.ID, batch.InitiativeID, batch.TaskGraphID, workUnitIDs, batch.ConcurrencyLimit, batch.Status, batch.RecoveryState, parseTimePtr(batch.StartedAt), parseTimePtr(batch.FinishedAt)); err != nil {
			return err
		}
	}

	for _, attempt := range state.Attempts {
		artifactURIs, err := json.Marshal(attempt.ArtifactURIs)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO execution_kernel_attempts (
				id, work_unit_id, batch_id, executor_type, status, recovery_state,
				attempt_number, parent_attempt_id, retry_reason, retry_backoff_until,
				started_at, finished_at, summary, artifact_uris, error_code, error_summary,
				lease_holder, lease_expires_at, last_heartbeat_at, updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18, $19, NOW())
			ON CONFLICT (id) DO UPDATE SET
				work_unit_id = EXCLUDED.work_unit_id,
				batch_id = EXCLUDED.batch_id,
				executor_type = EXCLUDED.executor_type,
				status = EXCLUDED.status,
				recovery_state = EXCLUDED.recovery_state,
				attempt_number = EXCLUDED.attempt_number,
				parent_attempt_id = EXCLUDED.parent_attempt_id,
				retry_reason = EXCLUDED.retry_reason,
				retry_backoff_until = EXCLUDED.retry_backoff_until,
				started_at = EXCLUDED.started_at,
				finished_at = EXCLUDED.finished_at,
				summary = EXCLUDED.summary,
				artifact_uris = EXCLUDED.artifact_uris,
				error_code = EXCLUDED.error_code,
				error_summary = EXCLUDED.error_summary,
				lease_holder = EXCLUDED.lease_holder,
				lease_expires_at = EXCLUDED.lease_expires_at,
				last_heartbeat_at = EXCLUDED.last_heartbeat_at,
				updated_at = NOW()
		`, attempt.ID, attempt.WorkUnitID, attempt.BatchID, attempt.ExecutorType, attempt.Status, attempt.RecoveryState, normalizedAttemptNumber(attempt.AttemptNumber), attempt.ParentAttemptID, attempt.RetryReason, parseTimePtr(attempt.RetryBackoffUntil), parseRequiredTime(attempt.StartedAt), parseTimePtr(attempt.FinishedAt), attempt.Summary, artifactURIs, attempt.ErrorCode, attempt.ErrorSummary, attempt.LeaseHolder, parseTimePtr(attempt.LeaseExpiresAt), parseTimePtr(attempt.LastHeartbeatAt)); err != nil {
			return err
		}
	}

	for _, workUnit := range state.WorkUnits {
		raw, err := json.Marshal(workUnit)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO execution_kernel_work_units_snapshot (work_unit_id, snapshot_json, updated_at)
			VALUES ($1, $2::jsonb, NOW())
			ON CONFLICT (work_unit_id) DO UPDATE SET
				snapshot_json = EXCLUDED.snapshot_json,
				updated_at = NOW()
		`, workUnit.ID, raw); err != nil {
			return err
		}
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO execution_kernel_heartbeats (id, observed_at)
		VALUES ('kernel', NOW())
		ON CONFLICT (id) DO UPDATE SET observed_at = EXCLUDED.observed_at
	`); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO execution_kernel_events (kind, payload, occurred_at)
		VALUES ('state.persisted', $1::jsonb, NOW())
	`, fmt.Sprintf(`{"batches":%d,"attempts":%d}`, len(state.Batches), len(state.Attempts))); err != nil {
		return err
	}

	return tx.Commit()
}

func defaultLeaseHolder() string {
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = "unknown-host"
	}
	return fmt.Sprintf("execution-kernel/%s/%d", hostname, os.Getpid())
}

func normalizeState(state PersistedState) PersistedState {
	if state.Version == 0 {
		state.Version = 1
	}
	if state.Batches == nil {
		state.Batches = map[string]events.BatchRecord{}
	}
	if state.Attempts == nil {
		state.Attempts = map[string]events.AttemptRecord{}
	}
	if state.WorkUnits == nil {
		state.WorkUnits = map[string]events.WorkUnit{}
	}
	return state
}

func normalizedAttemptNumber(value int) int {
	if value <= 0 {
		return 1
	}
	return value
}

func parseTimePtr(value *string) any {
	if value == nil || *value == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339Nano, *value)
	if err != nil {
		return *value
	}
	return parsed
}

func parseRequiredTime(value string) any {
	if value == "" {
		return time.Now().UTC()
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return value
	}
	return parsed
}

func timePtrToString(value sql.NullTime) *string {
	if !value.Valid {
		return nil
	}
	formatted := value.Time.UTC().Format(time.RFC3339Nano)
	return &formatted
}

func stringPtr(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func describeDatabaseTarget(databaseURL string) string {
	if len(databaseURL) > 0 {
		return "configured-postgres"
	}
	return ""
}
