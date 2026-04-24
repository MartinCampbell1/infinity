package service

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"execution-kernel/internal/events"
	kerneldb "execution-kernel/pkg/db"
)

type stubStore struct {
	kind           string
	durabilityTier string
	statePath      string
	configured     bool
	state          kerneldb.PersistedState
	saveErr        error
}

func (store *stubStore) Kind() string           { return store.kind }
func (store *stubStore) DurabilityTier() string { return store.durabilityTier }
func (store *stubStore) StatePath() string      { return store.statePath }
func (store *stubStore) Configured() bool       { return store.configured }
func (store *stubStore) Close() error           { return nil }

func (store *stubStore) Load(context.Context) (kerneldb.PersistedState, error) {
	return store.state, nil
}

func (store *stubStore) Save(_ context.Context, state kerneldb.PersistedState) error {
	if store.saveErr != nil {
		return store.saveErr
	}
	store.state = state
	return nil
}

func TestNewFromConfigRefusesLocalStorageInProductionLikeEnvironments(t *testing.T) {
	t.Parallel()

	for _, env := range []string{"production", "staging"} {
		t.Run(env, func(t *testing.T) {
			t.Parallel()

			_, err := NewFromConfig(Config{
				DeploymentEnv: env,
				StatePath:     filepath.Join(t.TempDir(), "state.json"),
			})
			if err == nil {
				t.Fatalf("expected %s config without database URL to fail", env)
			}
			if !strings.Contains(err.Error(), "EXECUTION_KERNEL_DATABASE_URL") {
				t.Fatalf("expected missing database URL error, got %v", err)
			}
		})
	}
}

func TestNewFromConfigAllowsLocalStorageOutsideProduction(t *testing.T) {
	t.Parallel()

	statePath := filepath.Join(t.TempDir(), "state.json")
	svc, err := NewFromConfig(Config{
		DeploymentEnv: "development",
		StatePath:     statePath,
	})
	if err != nil {
		t.Fatalf("NewFromConfig() error = %v", err)
	}
	t.Cleanup(func() {
		if err := svc.Close(); err != nil {
			t.Fatalf("Close() error = %v", err)
		}
	})

	health := svc.Health(context.Background())
	if health.StorageKind != "file" {
		t.Fatalf("expected file storage in development, got %s", health.StorageKind)
	}
	if health.StatePath != statePath {
		t.Fatalf("expected state path %s, got %s", statePath, health.StatePath)
	}
}

func TestHealthReportsPostgresStorageContract(t *testing.T) {
	t.Parallel()

	startedAt := "2026-04-24T00:00:00Z"
	store := &stubStore{
		kind:           "postgres",
		durabilityTier: "postgres_transactional",
		statePath:      "configured-postgres",
		configured:     true,
		state: kerneldb.PersistedState{
			Version: 1,
			Batches: map[string]events.BatchRecord{
				"batch-postgres-health-001": {
					ID:               "batch-postgres-health-001",
					InitiativeID:     "initiative-postgres-health-001",
					TaskGraphID:      "task-graph-postgres-health-001",
					WorkUnitIDs:      []string{"work-unit-postgres-health-001"},
					ConcurrencyLimit: 1,
					Status:           "completed",
					RecoveryState:    "resolved",
					StartedAt:        &startedAt,
					FinishedAt:       &startedAt,
				},
			},
			Attempts: map[string]events.AttemptRecord{
				"attempt-postgres-health-001": {
					ID:            "attempt-postgres-health-001",
					WorkUnitID:    "work-unit-postgres-health-001",
					BatchID:       stringPointer("batch-postgres-health-001"),
					ExecutorType:  "codex",
					Status:        "succeeded",
					RecoveryState: "resolved",
					StartedAt:     startedAt,
					FinishedAt:    &startedAt,
					Summary:       stringPointer("completed"),
					ArtifactURIs:  []string{},
				},
			},
		},
	}

	svc, err := NewWithStore(store)
	if err != nil {
		t.Fatalf("NewWithStore() error = %v", err)
	}
	t.Cleanup(func() {
		if err := svc.Close(); err != nil {
			t.Fatalf("Close() error = %v", err)
		}
	})

	health := svc.Health(context.Background())
	if health.StorageKind != "postgres" {
		t.Fatalf("expected postgres storage kind, got %s", health.StorageKind)
	}
	if health.DurabilityTier != "postgres_transactional" {
		t.Fatalf("expected postgres_transactional durability tier, got %s", health.DurabilityTier)
	}
	if health.StatePath != "configured-postgres" {
		t.Fatalf("expected configured-postgres state path, got %s", health.StatePath)
	}
	if !health.StateConfigured {
		t.Fatalf("expected postgres state to be configured")
	}
	if !health.RestartRecoverable {
		t.Fatalf("expected persisted postgres state to be restart recoverable")
	}
}

func TestLaunchBatchRollsBackMemoryStateWhenPersistFails(t *testing.T) {
	t.Parallel()

	persistErr := errors.New("persist failed")
	store := &stubStore{
		kind:           "postgres",
		durabilityTier: "postgres_transactional",
		statePath:      "configured-postgres",
		configured:     true,
		state:          kerneldb.DefaultState(),
		saveErr:        persistErr,
	}
	svc, err := NewWithStore(store)
	if err != nil {
		t.Fatalf("NewWithStore() error = %v", err)
	}

	_, err = svc.LaunchBatch(context.Background(), events.LaunchBatchRequest{
		BatchID:          "batch-persist-fail-001",
		InitiativeID:     "initiative-persist-fail-001",
		TaskGraphID:      "task-graph-persist-fail-001",
		ConcurrencyLimit: 1,
		WorkUnits: []events.WorkUnit{
			{
				ID:                 "work-unit-persist-fail-001",
				Title:              "Persist failure",
				Description:        "Do not acknowledge non-durable launch state",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"Failed persist rolls back memory"},
			},
		},
	})
	if !errors.Is(err, persistErr) {
		t.Fatalf("expected persist error, got %v", err)
	}
	if _, err := svc.BatchDetail(context.Background(), "batch-persist-fail-001"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected failed launch to be absent from memory, got %v", err)
	}
	health := svc.Health(context.Background())
	if health.BatchCounts.Total != 0 || health.AttemptCounts.Total != 0 {
		t.Fatalf("expected empty in-memory state after failed persist, got %#v %#v", health.BatchCounts, health.AttemptCounts)
	}
}

func TestAttemptMutationRollsBackMemoryStateWhenPersistFails(t *testing.T) {
	t.Parallel()

	persistErr := errors.New("persist failed")
	startedAt := "2026-04-24T00:00:00Z"
	store := &stubStore{
		kind:           "postgres",
		durabilityTier: "postgres_transactional",
		statePath:      "configured-postgres",
		configured:     true,
		state: kerneldb.PersistedState{
			Version: 1,
			Batches: map[string]events.BatchRecord{
				"batch-attempt-persist-fail-001": {
					ID:               "batch-attempt-persist-fail-001",
					InitiativeID:     "initiative-attempt-persist-fail-001",
					TaskGraphID:      "task-graph-attempt-persist-fail-001",
					WorkUnitIDs:      []string{"work-unit-attempt-persist-fail-001"},
					ConcurrencyLimit: 1,
					Status:           "queued",
					RecoveryState:    "retryable",
					StartedAt:        &startedAt,
				},
			},
			Attempts: map[string]events.AttemptRecord{
				"attempt-attempt-persist-fail-001": {
					ID:            "attempt-attempt-persist-fail-001",
					WorkUnitID:    "work-unit-attempt-persist-fail-001",
					BatchID:       stringPointer("batch-attempt-persist-fail-001"),
					ExecutorType:  "codex",
					Status:        "queued",
					RecoveryState: "retryable",
					StartedAt:     startedAt,
					ArtifactURIs:  []string{},
				},
			},
			WorkUnits: map[string]events.WorkUnit{},
		},
		saveErr: persistErr,
	}
	svc, err := NewWithStore(store)
	if err != nil {
		t.Fatalf("NewWithStore() error = %v", err)
	}

	_, err = svc.FailAttempt(context.Background(), "attempt-attempt-persist-fail-001", events.AttemptActionRequest{
		ErrorCode:    stringPointer("PERSIST_FAILURE"),
		ErrorSummary: stringPointer("must roll back"),
	})
	if !errors.Is(err, persistErr) {
		t.Fatalf("expected persist error, got %v", err)
	}

	batch, err := svc.BatchDetail(context.Background(), "batch-attempt-persist-fail-001")
	if err != nil {
		t.Fatalf("BatchDetail() error = %v", err)
	}
	if batch.Batch.Status != "queued" {
		t.Fatalf("expected batch status rollback to queued, got %s", batch.Batch.Status)
	}
	if len(batch.Attempts) != 1 || batch.Attempts[0].Status != "queued" {
		t.Fatalf("expected attempt status rollback to queued, got %#v", batch.Attempts)
	}
	if batch.Attempts[0].ErrorSummary != nil {
		t.Fatalf("expected rolled-back attempt error summary to stay nil, got %#v", batch.Attempts[0].ErrorSummary)
	}
}

func TestSchedulerEnforcesDependenciesAndConcurrencyLimit(t *testing.T) {
	t.Parallel()

	svc := NewInMemory()
	launch, err := svc.LaunchBatch(context.Background(), events.LaunchBatchRequest{
		BatchID:          "batch-scheduler-001",
		InitiativeID:     "initiative-scheduler-001",
		TaskGraphID:      "task-graph-scheduler-001",
		ConcurrencyLimit: 1,
		WorkUnits: []events.WorkUnit{
			{
				ID:                 "work-unit-a",
				Title:              "A",
				Description:        "Root dependency",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"A starts first"},
			},
			{
				ID:                 "work-unit-b",
				Title:              "B",
				Description:        "Depends on A",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{"work-unit-a"},
				AcceptanceCriteria: []string{"B waits for A"},
			},
			{
				ID:                 "work-unit-c",
				Title:              "C",
				Description:        "Independent tail",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"C waits for concurrency"},
			},
		},
	})
	if err != nil {
		t.Fatalf("LaunchBatch() error = %v", err)
	}
	statusByWorkUnit := map[string]string{}
	for _, attempt := range launch.Attempts {
		statusByWorkUnit[attempt.WorkUnitID] = attempt.Status
	}
	if statusByWorkUnit["work-unit-a"] != "leased" {
		t.Fatalf("expected A to be leased first, got %#v", statusByWorkUnit)
	}
	if statusByWorkUnit["work-unit-b"] != "queued" || statusByWorkUnit["work-unit-c"] != "queued" {
		t.Fatalf("expected B and C to wait, got %#v", statusByWorkUnit)
	}

	completedA, err := svc.CompleteAttempt(context.Background(), "attempt-batch-scheduler-001-work-unit-a")
	if err != nil {
		t.Fatalf("CompleteAttempt(A) error = %v", err)
	}
	if completedA.Batch.Status != "running" {
		t.Fatalf("expected batch to keep running after A, got %s", completedA.Batch.Status)
	}
	detail, err := svc.BatchDetail(context.Background(), "batch-scheduler-001")
	if err != nil {
		t.Fatalf("BatchDetail() error = %v", err)
	}
	statusByWorkUnit = map[string]string{}
	for _, attempt := range detail.Attempts {
		statusByWorkUnit[attempt.WorkUnitID] = attempt.Status
	}
	if statusByWorkUnit["work-unit-b"] != "leased" || statusByWorkUnit["work-unit-c"] != "queued" {
		t.Fatalf("expected B to unlock before C under concurrency=1, got %#v", statusByWorkUnit)
	}
}

func TestSchedulerLeasesTwoIndependentAttemptsWhenConcurrencyAllows(t *testing.T) {
	t.Parallel()

	svc := NewInMemory()
	launch, err := svc.LaunchBatch(context.Background(), events.LaunchBatchRequest{
		BatchID:          "batch-concurrency-001",
		InitiativeID:     "initiative-concurrency-001",
		TaskGraphID:      "task-graph-concurrency-001",
		ConcurrencyLimit: 2,
		WorkUnits: []events.WorkUnit{
			{ID: "work-unit-1", Title: "One", Description: "One", ExecutorType: "codex", ScopePaths: []string{"/tmp"}, Dependencies: []string{}, AcceptanceCriteria: []string{"one"}},
			{ID: "work-unit-2", Title: "Two", Description: "Two", ExecutorType: "codex", ScopePaths: []string{"/tmp"}, Dependencies: []string{}, AcceptanceCriteria: []string{"two"}},
			{ID: "work-unit-3", Title: "Three", Description: "Three", ExecutorType: "codex", ScopePaths: []string{"/tmp"}, Dependencies: []string{}, AcceptanceCriteria: []string{"three"}},
		},
	})
	if err != nil {
		t.Fatalf("LaunchBatch() error = %v", err)
	}
	leased := 0
	queued := 0
	for _, attempt := range launch.Attempts {
		if attempt.Status == "leased" {
			leased += 1
		}
		if attempt.Status == "queued" {
			queued += 1
		}
	}
	if leased != 2 || queued != 1 {
		t.Fatalf("expected 2 leased and 1 queued attempt, got leased=%d queued=%d attempts=%#v", leased, queued, launch.Attempts)
	}
}

func TestSchedulerReassignsExpiredLeaseAndHeartbeatExtendsIt(t *testing.T) {
	t.Parallel()

	svc := NewInMemory()
	launch, err := svc.LaunchBatch(context.Background(), events.LaunchBatchRequest{
		BatchID:          "batch-lease-001",
		InitiativeID:     "initiative-lease-001",
		TaskGraphID:      "task-graph-lease-001",
		ConcurrencyLimit: 1,
		WorkUnits: []events.WorkUnit{
			{ID: "work-unit-lease", Title: "Lease", Description: "Lease", ExecutorType: "codex", ScopePaths: []string{"/tmp"}, Dependencies: []string{}, AcceptanceCriteria: []string{"lease"}},
		},
	})
	if err != nil {
		t.Fatalf("LaunchBatch() error = %v", err)
	}
	attemptID := launch.Attempts[0].ID

	svc.mu.Lock()
	expiredAt := formatTime(time.Now().UTC().Add(-time.Second))
	attempt := svc.attempts[attemptID]
	attempt.LeaseExpiresAt = &expiredAt
	svc.attempts[attemptID] = attempt
	svc.mu.Unlock()

	reassigned, err := svc.AcquireNextAttempt(context.Background(), "batch-lease-001", events.AttemptLeaseRequest{
		Holder:          "worker-two",
		LeaseTTLSeconds: 60,
	})
	if err != nil {
		t.Fatalf("AcquireNextAttempt() error = %v", err)
	}
	if reassigned.Attempt.LeaseHolder == nil || *reassigned.Attempt.LeaseHolder != "worker-two" {
		t.Fatalf("expected worker-two to hold reassigned lease, got %#v", reassigned.Attempt)
	}

	heartbeat, err := svc.HeartbeatAttempt(context.Background(), attemptID, events.AttemptHeartbeatRequest{
		Holder:          "worker-two",
		LeaseTTLSeconds: 90,
	})
	if err != nil {
		t.Fatalf("HeartbeatAttempt() error = %v", err)
	}
	if heartbeat.Attempt.Status != "running" {
		t.Fatalf("expected heartbeat to mark attempt running, got %s", heartbeat.Attempt.Status)
	}
	if heartbeat.Attempt.LastHeartbeatAt == nil || heartbeat.Attempt.LeaseExpiresAt == nil {
		t.Fatalf("expected heartbeat and lease expiry to be present, got %#v", heartbeat.Attempt)
	}
}

func TestRetryWorkUnitCreatesAttemptLineageAndReassignsExecutor(t *testing.T) {
	t.Parallel()

	svc := NewInMemory()
	launch, err := svc.LaunchBatch(context.Background(), events.LaunchBatchRequest{
		BatchID:          "batch-retry-001",
		InitiativeID:     "initiative-retry-001",
		TaskGraphID:      "task-graph-retry-001",
		ConcurrencyLimit: 1,
		WorkUnits: []events.WorkUnit{
			{
				ID:                 "work-unit-retry",
				Title:              "Retry",
				Description:        "Retry with reassignment",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/tmp"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"retry"},
				RetryPolicy: &events.RetryPolicy{
					MaxAttempts:        3,
					ExecutorPreference: []string{"codex", "droid"},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("LaunchBatch() error = %v", err)
	}
	firstAttemptID := launch.Attempts[0].ID
	if _, err := svc.FailAttempt(context.Background(), firstAttemptID, events.AttemptActionRequest{
		ErrorCode:    stringPointer("EXECUTOR_FAILED"),
		ErrorSummary: stringPointer("first executor failed"),
	}); err != nil {
		t.Fatalf("FailAttempt() error = %v", err)
	}

	reason := "operator reassigned to fallback executor"
	executorType := "droid"
	retry, err := svc.RetryWorkUnit(context.Background(), "batch-retry-001", events.RetryWorkUnitRequest{
		WorkUnitID:   "work-unit-retry",
		ExecutorType: &executorType,
		Reason:       &reason,
	})
	if err != nil {
		t.Fatalf("RetryWorkUnit() error = %v", err)
	}
	if retry.Attempt.ID == firstAttemptID {
		t.Fatalf("expected retry to create a new attempt, got original %s", firstAttemptID)
	}
	if retry.Attempt.AttemptNumber != 2 {
		t.Fatalf("expected attempt number 2, got %d", retry.Attempt.AttemptNumber)
	}
	if retry.Attempt.ParentAttemptID == nil || *retry.Attempt.ParentAttemptID != firstAttemptID {
		t.Fatalf("expected parent attempt %s, got %#v", firstAttemptID, retry.Attempt.ParentAttemptID)
	}
	if retry.Attempt.ExecutorType != "droid" {
		t.Fatalf("expected reassigned droid executor, got %s", retry.Attempt.ExecutorType)
	}
	if retry.Attempt.Status != "leased" {
		t.Fatalf("expected retry attempt to be leased, got %s", retry.Attempt.Status)
	}

	replay, err := svc.RetryWorkUnit(context.Background(), "batch-retry-001", events.RetryWorkUnitRequest{
		WorkUnitID:   "work-unit-retry",
		ExecutorType: &executorType,
		Reason:       &reason,
	})
	if err != nil {
		t.Fatalf("RetryWorkUnit() replay error = %v", err)
	}
	if replay.Attempt.ID != retry.Attempt.ID {
		t.Fatalf("expected active retry replay to return %s, got %s", retry.Attempt.ID, replay.Attempt.ID)
	}

	detail, err := svc.BatchDetail(context.Background(), "batch-retry-001")
	if err != nil {
		t.Fatalf("BatchDetail() error = %v", err)
	}
	if len(detail.Attempts) != 2 {
		t.Fatalf("expected failed attempt plus retry attempt, got %#v", detail.Attempts)
	}
	if detail.Attempts[0].RecoveryState != "archived" {
		t.Fatalf("expected original failure to be archived after retry, got %s", detail.Attempts[0].RecoveryState)
	}
}

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
	if len(resumed.Attempts) != 2 {
		t.Fatalf("expected original failed attempt plus retry attempt, got %d", len(resumed.Attempts))
	}
	retryAttempt := resumed.Attempts[1]
	if retryAttempt.AttemptNumber != 2 {
		t.Fatalf("expected default retry policy to create attempt number 2, got %d", retryAttempt.AttemptNumber)
	}
	if retryAttempt.Status != "leased" {
		t.Fatalf("expected retry attempt to be leased, got %s", retryAttempt.Status)
	}
	if retryAttempt.ExecutorType != "codex" {
		t.Fatalf("expected default retry policy to keep original executor, got %s", retryAttempt.ExecutorType)
	}
	if retryAttempt.ParentAttemptID == nil || *retryAttempt.ParentAttemptID != resumed.Attempts[0].ID {
		t.Fatalf("expected retry attempt to link to parent, got %#v", retryAttempt.ParentAttemptID)
	}
	if retryAttempt.ErrorSummary != nil {
		t.Fatalf("expected retry attempt error summary to clear, got %#v", retryAttempt.ErrorSummary)
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
	if health.AuthMode != "service_token_or_localhost_dev" {
		t.Fatalf("expected service_token_or_localhost_dev auth mode, got %s", health.AuthMode)
	}
	if health.DeploymentScope != "service_to_service_private" {
		t.Fatalf("expected service_to_service_private deployment scope, got %s", health.DeploymentScope)
	}
	if health.Maturity != "service_auth_v1" {
		t.Fatalf("expected service_auth_v1 maturity, got %s", health.Maturity)
	}
	if health.StorageKind != "file" {
		t.Fatalf("expected file storage kind, got %s", health.StorageKind)
	}
	if health.DurabilityTier != "local_file_snapshot" {
		t.Fatalf("expected local_file_snapshot durability tier, got %s", health.DurabilityTier)
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

func TestHealthTreatsReloadedBlockedStateAsHistorical(t *testing.T) {
	t.Parallel()

	statePath := filepath.Join(t.TempDir(), "execution-kernel-historical.json")
	svc, err := NewFileBacked(statePath)
	if err != nil {
		t.Fatalf("NewFileBacked() error = %v", err)
	}

	launch, err := svc.LaunchBatch(context.Background(), events.LaunchBatchRequest{
		BatchID:          "batch-historical-001",
		InitiativeID:     "initiative-historical-001",
		TaskGraphID:      "task-graph-historical-001",
		ConcurrencyLimit: 1,
		WorkUnits: []events.WorkUnit{
			{
				ID:                 "work-unit-historical-001",
				Title:              "Historical health",
				Description:        "Persist a stale blocked tail across restart",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"Historical health stays inspectable without degrading fresh boots"},
			},
		},
	})
	if err != nil {
		t.Fatalf("LaunchBatch() error = %v", err)
	}

	if _, err := svc.FailAttempt(context.Background(), launch.Attempts[0].ID, events.AttemptActionRequest{
		ErrorCode:    stringPointer("STALE_FAILURE"),
		ErrorSummary: stringPointer("historical blocked tail"),
	}); err != nil {
		t.Fatalf("FailAttempt() error = %v", err)
	}

	reloaded, err := NewFileBacked(statePath)
	if err != nil {
		t.Fatalf("NewFileBacked() reload error = %v", err)
	}

	health := reloaded.Health(context.Background())
	if health.Status != "ok" {
		t.Fatalf("expected ok health after reload, got %s", health.Status)
	}
	if health.RuntimeState != "idle" {
		t.Fatalf("expected idle runtime state after reload, got %s", health.RuntimeState)
	}
	if health.RecoveryState != "archived" {
		t.Fatalf("expected archived recovery state after reload, got %s", health.RecoveryState)
	}
	if health.FailureState != "historical" {
		t.Fatalf("expected historical failure state after reload, got %s", health.FailureState)
	}
	if health.BatchCounts.Blocked != 0 {
		t.Fatalf("expected no live blocked batches after reload, got %d", health.BatchCounts.Blocked)
	}
	if health.AttemptCounts.Failed != 0 {
		t.Fatalf("expected no live failed attempts after reload, got %d", health.AttemptCounts.Failed)
	}
	if len(health.BlockedBatchIDs) != 0 {
		t.Fatalf("expected no live blocked batch ids after reload, got %#v", health.BlockedBatchIDs)
	}
	if len(health.FailedAttemptIDs) != 0 {
		t.Fatalf("expected no live failed attempt ids after reload, got %#v", health.FailedAttemptIDs)
	}
	if len(health.ResumableBatchIDs) != 1 || health.ResumableBatchIDs[0] != "batch-historical-001" {
		t.Fatalf("expected archived batch to remain resumable, got %#v", health.ResumableBatchIDs)
	}
	if health.LatestFailure == nil || health.LatestFailure.AttemptID != launch.Attempts[0].ID {
		t.Fatalf("expected latest failure to remain inspectable, got %#v", health.LatestFailure)
	}

	detail, err := reloaded.BatchDetail(context.Background(), "batch-historical-001")
	if err != nil {
		t.Fatalf("BatchDetail() error = %v", err)
	}
	if detail.Batch.RecoveryState != "archived" {
		t.Fatalf("expected batch detail recovery state archived, got %s", detail.Batch.RecoveryState)
	}

	resumed, err := reloaded.ResumeBatch(context.Background(), "batch-historical-001")
	if err != nil {
		t.Fatalf("ResumeBatch() error = %v", err)
	}
	if resumed.Batch.Status != "running" {
		t.Fatalf("expected archived batch to resume into running, got %s", resumed.Batch.Status)
	}
	if resumed.Batch.RecoveryState != "retryable" {
		t.Fatalf("expected resumed batch recovery state retryable, got %s", resumed.Batch.RecoveryState)
	}
}

func TestDiscardedBlockedStateStaysInspectableWithoutPoisoningHealth(t *testing.T) {
	t.Parallel()

	statePath := filepath.Join(t.TempDir(), "execution-kernel-discarded.json")
	svc, err := NewFileBacked(statePath)
	if err != nil {
		t.Fatalf("NewFileBacked() error = %v", err)
	}

	launch, err := svc.LaunchBatch(context.Background(), events.LaunchBatchRequest{
		BatchID:          "batch-discarded-001",
		InitiativeID:     "initiative-discarded-001",
		TaskGraphID:      "task-graph-discarded-001",
		ConcurrencyLimit: 1,
		WorkUnits: []events.WorkUnit{
			{
				ID:                 "work-unit-discarded-001",
				Title:              "Discarded health",
				Description:        "Keep discarded failures inspectable without retry pressure",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"Discarded failures do not degrade fresh boots"},
			},
		},
	})
	if err != nil {
		t.Fatalf("LaunchBatch() error = %v", err)
	}

	if _, err := svc.FailAttempt(context.Background(), launch.Attempts[0].ID, events.AttemptActionRequest{
		ErrorCode:    stringPointer("DISCARDED_FAILURE"),
		ErrorSummary: stringPointer("discarded blocked tail"),
	}); err != nil {
		t.Fatalf("FailAttempt() error = %v", err)
	}

	discarded, err := svc.DiscardBatch(context.Background(), "batch-discarded-001")
	if err != nil {
		t.Fatalf("DiscardBatch() error = %v", err)
	}
	if discarded.Batch.RecoveryState != "discarded" {
		t.Fatalf("expected discarded batch recovery state, got %s", discarded.Batch.RecoveryState)
	}
	if discarded.Attempts[0].RecoveryState != "discarded" {
		t.Fatalf("expected discarded attempt recovery state, got %s", discarded.Attempts[0].RecoveryState)
	}

	reloaded, err := NewFileBacked(statePath)
	if err != nil {
		t.Fatalf("NewFileBacked() reload error = %v", err)
	}

	health := reloaded.Health(context.Background())
	if health.Status != "ok" {
		t.Fatalf("expected ok health after discard, got %s", health.Status)
	}
	if health.RuntimeState != "idle" {
		t.Fatalf("expected idle runtime state after discard, got %s", health.RuntimeState)
	}
	if health.RecoveryState != "discarded" {
		t.Fatalf("expected discarded recovery state after discard, got %s", health.RecoveryState)
	}
	if health.FailureState != "none" {
		t.Fatalf("expected discarded failure state to be none, got %s", health.FailureState)
	}
	if health.BatchCounts.Blocked != 0 {
		t.Fatalf("expected discarded batch to avoid live blocked counts, got %d", health.BatchCounts.Blocked)
	}
	if health.AttemptCounts.Failed != 0 {
		t.Fatalf("expected discarded attempt to avoid live failed counts, got %d", health.AttemptCounts.Failed)
	}
	if len(health.BlockedBatchIDs) != 0 {
		t.Fatalf("expected no live blocked batch ids after discard, got %#v", health.BlockedBatchIDs)
	}
	if len(health.FailedAttemptIDs) != 0 {
		t.Fatalf("expected no live failed attempt ids after discard, got %#v", health.FailedAttemptIDs)
	}
	if len(health.ResumableBatchIDs) != 0 {
		t.Fatalf("expected no resumable batch ids after discard, got %#v", health.ResumableBatchIDs)
	}
	if health.LatestFailure == nil || health.LatestFailure.AttemptID != launch.Attempts[0].ID {
		t.Fatalf("expected latest failure to remain inspectable after discard, got %#v", health.LatestFailure)
	}

	detail, err := reloaded.BatchDetail(context.Background(), "batch-discarded-001")
	if err != nil {
		t.Fatalf("BatchDetail() error = %v", err)
	}
	if detail.Batch.RecoveryState != "discarded" {
		t.Fatalf("expected discarded batch detail recovery state, got %s", detail.Batch.RecoveryState)
	}

	if _, err := reloaded.ResumeBatch(context.Background(), "batch-discarded-001"); err == nil {
		t.Fatalf("expected discarded batch to reject resume")
	}
}

func TestHealthTreatsReloadedRunningStateAsArchivedBacklog(t *testing.T) {
	t.Parallel()

	statePath := filepath.Join(t.TempDir(), "execution-kernel-running.json")
	svc, err := NewFileBacked(statePath)
	if err != nil {
		t.Fatalf("NewFileBacked() error = %v", err)
	}

	launch, err := svc.LaunchBatch(context.Background(), events.LaunchBatchRequest{
		BatchID:          "batch-running-001",
		InitiativeID:     "initiative-running-001",
		TaskGraphID:      "task-graph-running-001",
		ConcurrencyLimit: 1,
		WorkUnits: []events.WorkUnit{
			{
				ID:                 "work-unit-running-001",
				Title:              "Interrupted runtime",
				Description:        "Fresh boot should not preserve stale running state as live work",
				ExecutorType:       "codex",
				ScopePaths:         []string{"/Users/martin/infinity/services/execution-kernel"},
				Dependencies:       []string{},
				AcceptanceCriteria: []string{"Stale in-flight work stays resumable without poisoning fresh health"},
			},
		},
	})
	if err != nil {
		t.Fatalf("LaunchBatch() error = %v", err)
	}

	reloaded, err := NewFileBacked(statePath)
	if err != nil {
		t.Fatalf("NewFileBacked() reload error = %v", err)
	}

	health := reloaded.Health(context.Background())
	if health.Status != "ok" {
		t.Fatalf("expected ok health before the lease expires, got %s", health.Status)
	}
	if health.RuntimeState != "running" {
		t.Fatalf("expected running runtime state before the lease expires, got %s", health.RuntimeState)
	}
	if health.RecoveryState != "none" {
		t.Fatalf("expected no recovery pressure before the lease expires, got %s", health.RecoveryState)
	}
	if health.FailureState != "none" {
		t.Fatalf("expected no failure state before the lease expires, got %s", health.FailureState)
	}
	if len(health.ResumableBatchIDs) != 0 {
		t.Fatalf("expected no resumable batch before lease expiry, got %#v", health.ResumableBatchIDs)
	}

	detail, err := reloaded.BatchDetail(context.Background(), "batch-running-001")
	if err != nil {
		t.Fatalf("BatchDetail() error = %v", err)
	}
	if detail.Batch.Status != "running" {
		t.Fatalf("expected interrupted batch to reload as running until lease expiry, got %s", detail.Batch.Status)
	}
	if detail.Batch.RecoveryState != "retryable" {
		t.Fatalf("expected interrupted batch recovery state retryable, got %s", detail.Batch.RecoveryState)
	}
	if len(detail.Attempts) != 1 || detail.Attempts[0].Status != "leased" {
		t.Fatalf("expected interrupted attempt to reload as leased until TTL, got %#v", detail.Attempts)
	}

	reloaded.mu.Lock()
	expiredAt := formatTime(time.Now().UTC().Add(-time.Second))
	attempt := reloaded.attempts[launch.Attempts[0].ID]
	attempt.LeaseExpiresAt = &expiredAt
	reloaded.attempts[attempt.ID] = attempt
	reloaded.mu.Unlock()

	reassigned, err := reloaded.AcquireNextAttempt(context.Background(), launch.Batch.ID, events.AttemptLeaseRequest{
		Holder:          "worker-after-expiry",
		LeaseTTLSeconds: 30,
	})
	if err != nil {
		t.Fatalf("AcquireNextAttempt() after expiry error = %v", err)
	}
	if reassigned.Attempt.Status != "leased" || reassigned.Attempt.LeaseHolder == nil || *reassigned.Attempt.LeaseHolder != "worker-after-expiry" {
		t.Fatalf("expected expired attempt to be reassigned, got %#v", reassigned.Attempt)
	}
}

func TestHealthLatestFailureUsesChronologicalOrdering(t *testing.T) {
	t.Parallel()

	svc := NewInMemory()

	earlierFinishedAt := "2026-04-21T10:00:00.123456789Z"
	laterFinishedAt := "2026-04-21T10:00:01Z"

	svc.attempts["attempt-earlier"] = events.AttemptRecord{
		ID:           "attempt-earlier",
		BatchID:      stringPointer("batch-latest-failure"),
		WorkUnitID:   "work-unit-earlier",
		ExecutorType: "codex",
		Status:       "failed",
		StartedAt:    "2026-04-21T09:59:59Z",
		FinishedAt:   stringPointer(laterFinishedAt),
		ErrorCode:    stringPointer("LATER"),
		ErrorSummary: stringPointer("later failure should win"),
	}
	svc.attempts["attempt-later"] = events.AttemptRecord{
		ID:           "attempt-later",
		BatchID:      stringPointer("batch-latest-failure"),
		WorkUnitID:   "work-unit-later",
		ExecutorType: "codex",
		Status:       "failed",
		StartedAt:    "2026-04-21T09:59:58Z",
		FinishedAt:   stringPointer(earlierFinishedAt),
		ErrorCode:    stringPointer("EARLIER"),
		ErrorSummary: stringPointer("earlier failure should lose"),
	}

	health := svc.Health(context.Background())
	if health.LatestFailure == nil {
		t.Fatalf("expected latest failure to be populated")
	}
	if health.LatestFailure.AttemptID != "attempt-earlier" {
		t.Fatalf("expected attempt-earlier to be latest failure, got %#v", health.LatestFailure)
	}
}

func stringPointer(value string) *string {
	return &value
}
