package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"execution-kernel/internal/events"
	kerneldb "execution-kernel/pkg/db"
)

var ErrNotFound = errors.New("not found")

type Service interface {
	Health(context.Context) events.HealthResponse
	LaunchBatch(context.Context, events.LaunchBatchRequest) (events.BatchEnvelope, error)
	BatchDetail(context.Context, string) (events.BatchEnvelope, error)
	ResumeBatch(context.Context, string) (events.BatchEnvelope, error)
	DiscardBatch(context.Context, string) (events.BatchEnvelope, error)
	RetryWorkUnit(context.Context, string, events.RetryWorkUnitRequest) (events.AttemptActionEnvelope, error)
	AttemptDetail(context.Context, string) (events.AttemptEnvelope, error)
	AcquireNextAttempt(context.Context, string, events.AttemptLeaseRequest) (events.AttemptActionEnvelope, error)
	HeartbeatAttempt(context.Context, string, events.AttemptHeartbeatRequest) (events.AttemptActionEnvelope, error)
	CompleteAttempt(context.Context, string) (events.AttemptActionEnvelope, error)
	FailAttempt(context.Context, string, events.AttemptActionRequest) (events.AttemptActionEnvelope, error)
}

type InMemory struct {
	mu        sync.RWMutex
	batches   map[string]events.BatchRecord
	attempts  map[string]events.AttemptRecord
	workUnits map[string]events.WorkUnit
	store     kerneldb.Store
}

const (
	attemptStatusQueued    = "queued"
	attemptStatusLeased    = "leased"
	attemptStatusRunning   = "running"
	attemptStatusCompleted = "completed"
	attemptStatusFailed    = "failed"
	attemptStatusBlocked   = "blocked"
	attemptStatusCanceled  = "canceled"

	legacyAttemptStatusStarted   = "started"
	legacyAttemptStatusSucceeded = "succeeded"
	legacyAttemptStatusAbandoned = "abandoned"

	defaultLeaseHolder     = "execution-kernel-scheduler"
	defaultLeaseTTLSeconds = 30
	defaultMaxAttempts     = 3
)

func NewInMemory() *InMemory {
	svc, _ := NewWithStore(kerneldb.NewMemoryStore())
	return svc
}

type Config struct {
	DeploymentEnv string
	StatePath     string
	DatabaseURL   string
}

func NewFromConfig(config Config) (*InMemory, error) {
	deploymentEnv := strings.ToLower(strings.TrimSpace(config.DeploymentEnv))
	productionLike := deploymentEnv == "production" || deploymentEnv == "staging"
	if config.DatabaseURL != "" {
		store, err := kerneldb.NewPostgresStore(config.DatabaseURL)
		if err != nil {
			return nil, err
		}
		return NewWithStore(store)
	}
	if productionLike {
		return nil, errors.New("execution-kernel production/staging deployment requires EXECUTION_KERNEL_DATABASE_URL")
	}
	if config.StatePath != "" {
		return NewFileBacked(config.StatePath)
	}
	return NewInMemory(), nil
}

func archiveRecoveredState(value string) string {
	if value == "resolved" || value == "discarded" {
		return value
	}
	return "archived"
}

func isLiveRecoveryState(value string) bool {
	return value != "archived" && value != "discarded"
}

func NewFileBacked(statePath string) (*InMemory, error) {
	return NewWithStore(kerneldb.NewFileStore(statePath))
}

func NewPostgresBacked(databaseURL string) (*InMemory, error) {
	store, err := kerneldb.NewPostgresStore(databaseURL)
	if err != nil {
		return nil, err
	}
	return NewWithStore(store)
}

func NewWithStore(store kerneldb.Store) (*InMemory, error) {
	if store == nil {
		store = kerneldb.NewMemoryStore()
	}
	svc := &InMemory{
		batches:   map[string]events.BatchRecord{},
		attempts:  map[string]events.AttemptRecord{},
		workUnits: map[string]events.WorkUnit{},
		store:     store,
	}

	if err := svc.hydrate(); err != nil {
		_ = store.Close()
		return nil, err
	}

	return svc, nil
}

func (svc *InMemory) Close() error {
	if svc.store == nil {
		return nil
	}
	return svc.store.Close()
}

func (svc *InMemory) hydrate() error {
	state, err := svc.store.Load(context.Background())
	if err != nil {
		return err
	}

	changed := false
	for batchID, batch := range state.Batches {
		if batch.Status == "blocked" || batch.Status == "completed" || batch.Status == "canceled" {
			recoveryState := archiveRecoveredState(batch.RecoveryState)
			if batch.RecoveryState != recoveryState {
				batch.RecoveryState = recoveryState
				changed = true
			}
		}
		state.Batches[batchID] = batch
	}
	for attemptID, attempt := range state.Attempts {
		if attempt.AttemptNumber <= 0 {
			attempt.AttemptNumber = 1
		}
		if attempt.Status == legacyAttemptStatusStarted || attempt.Status == legacyAttemptStatusAbandoned {
			attempt.Status = attemptStatusQueued
			attempt.RecoveryState = "retryable"
			attempt.FinishedAt = nil
			attempt.LeaseHolder = nil
			attempt.LeaseExpiresAt = nil
			attempt.LastHeartbeatAt = nil
			if attempt.Summary == nil {
				summary := "recovered from legacy in-flight state; queued for retry"
				attempt.Summary = &summary
			}
			changed = true
		} else if attempt.Status == legacyAttemptStatusSucceeded {
			attempt.Status = attemptStatusCompleted
			attempt.RecoveryState = archiveRecoveredState(attempt.RecoveryState)
			changed = true
		} else if attempt.Status == attemptStatusFailed || attempt.Status == attemptStatusCompleted || attempt.Status == attemptStatusCanceled {
			recoveryState := archiveRecoveredState(attempt.RecoveryState)
			if attempt.RecoveryState != recoveryState {
				attempt.RecoveryState = recoveryState
				changed = true
			}
		}
		state.Attempts[attemptID] = attempt
	}

	svc.batches = state.Batches
	svc.attempts = state.Attempts
	svc.workUnits = state.WorkUnits
	if svc.recoverExpiredLeasesLocked(time.Now().UTC()) {
		changed = true
	}
	for batchID := range svc.batches {
		if svc.refreshBatchStateLocked(batchID, nil) {
			changed = true
		}
	}
	state = svc.snapshotLocked()

	if changed {
		if err := svc.store.Save(context.Background(), state); err != nil {
			return fmt.Errorf("persist recovered execution-kernel state: %w", err)
		}
	}
	return nil
}

func (svc *InMemory) persistLocked() error {
	if svc.store == nil {
		return nil
	}
	return svc.store.Save(context.Background(), kerneldb.PersistedState{
		Version:   1,
		Batches:   svc.batches,
		Attempts:  svc.attempts,
		WorkUnits: svc.workUnits,
	})
}

func (svc *InMemory) snapshotLocked() kerneldb.PersistedState {
	return clonePersistedState(kerneldb.PersistedState{
		Version:   1,
		Batches:   svc.batches,
		Attempts:  svc.attempts,
		WorkUnits: svc.workUnits,
	})
}

func (svc *InMemory) restoreLocked(state kerneldb.PersistedState) {
	state = clonePersistedState(state)
	svc.batches = state.Batches
	svc.attempts = state.Attempts
	svc.workUnits = state.WorkUnits
}

func (svc *InMemory) persistOrRollbackLocked(previous kerneldb.PersistedState) error {
	if err := svc.persistLocked(); err != nil {
		svc.restoreLocked(previous)
		return err
	}
	return nil
}

func clonePersistedState(state kerneldb.PersistedState) kerneldb.PersistedState {
	if state.Version == 0 {
		state.Version = 1
	}
	clone := kerneldb.PersistedState{
		Version:   state.Version,
		Batches:   map[string]events.BatchRecord{},
		Attempts:  map[string]events.AttemptRecord{},
		WorkUnits: map[string]events.WorkUnit{},
	}
	for id, batch := range state.Batches {
		batch.WorkUnitIDs = slices.Clone(batch.WorkUnitIDs)
		batch.StartedAt = cloneStringPointer(batch.StartedAt)
		batch.FinishedAt = cloneStringPointer(batch.FinishedAt)
		clone.Batches[id] = batch
	}
	for id, attempt := range state.Attempts {
		attempt.BatchID = cloneStringPointer(attempt.BatchID)
		attempt.FinishedAt = cloneStringPointer(attempt.FinishedAt)
		attempt.Summary = cloneStringPointer(attempt.Summary)
		attempt.ArtifactURIs = slices.Clone(attempt.ArtifactURIs)
		attempt.ErrorCode = cloneStringPointer(attempt.ErrorCode)
		attempt.ErrorSummary = cloneStringPointer(attempt.ErrorSummary)
		attempt.LeaseHolder = cloneStringPointer(attempt.LeaseHolder)
		attempt.LeaseExpiresAt = cloneStringPointer(attempt.LeaseExpiresAt)
		attempt.LastHeartbeatAt = cloneStringPointer(attempt.LastHeartbeatAt)
		attempt.ParentAttemptID = cloneStringPointer(attempt.ParentAttemptID)
		attempt.RetryReason = cloneStringPointer(attempt.RetryReason)
		attempt.RetryBackoffUntil = cloneStringPointer(attempt.RetryBackoffUntil)
		clone.Attempts[id] = attempt
	}
	for id, workUnit := range state.WorkUnits {
		workUnit.ScopePaths = slices.Clone(workUnit.ScopePaths)
		workUnit.Dependencies = slices.Clone(workUnit.Dependencies)
		workUnit.AcceptanceCriteria = slices.Clone(workUnit.AcceptanceCriteria)
		workUnit.RetryPolicy = cloneRetryPolicy(workUnit.RetryPolicy)
		clone.WorkUnits[id] = workUnit
	}
	return clone
}

func cloneRetryPolicy(value *events.RetryPolicy) *events.RetryPolicy {
	if value == nil {
		return nil
	}
	clone := *value
	clone.ExecutorPreference = slices.Clone(value.ExecutorPreference)
	return &clone
}

func cloneStringPointer(value *string) *string {
	if value == nil {
		return nil
	}
	clone := *value
	return &clone
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func latestAttemptTimestamp(attempt events.AttemptRecord) string {
	if attempt.FinishedAt != nil {
		return *attempt.FinishedAt
	}
	return attempt.StartedAt
}

func parseAttemptTimestamp(value string) (time.Time, bool) {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}, false
	}
	return parsed, true
}

func leaseTTL(input int) time.Duration {
	if input <= 0 {
		input = defaultLeaseTTLSeconds
	}
	return time.Duration(input) * time.Second
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

func parseOptionalTime(value *string) (time.Time, bool) {
	if value == nil || *value == "" {
		return time.Time{}, false
	}
	return parseAttemptTimestamp(*value)
}

func normalizedAttemptNumber(attempt events.AttemptRecord) int {
	if attempt.AttemptNumber <= 0 {
		return 1
	}
	return attempt.AttemptNumber
}

func retryAttemptID(batchID string, workUnitID string, attemptNumber int) string {
	if attemptNumber <= 1 {
		return fmt.Sprintf("attempt-%s-%s", batchID, workUnitID)
	}
	return fmt.Sprintf("attempt-%s-%s-retry-%d", batchID, workUnitID, attemptNumber)
}

func isActiveAttemptStatus(status string) bool {
	return status == attemptStatusLeased ||
		status == attemptStatusRunning ||
		status == legacyAttemptStatusStarted
}

func isCompletedAttemptStatus(status string) bool {
	return status == attemptStatusCompleted || status == legacyAttemptStatusSucceeded
}

func isTerminalAttemptStatus(status string) bool {
	return isCompletedAttemptStatus(status) ||
		status == attemptStatusFailed ||
		status == attemptStatusBlocked ||
		status == attemptStatusCanceled
}

func (svc *InMemory) isLeaseExpiredLocked(attempt events.AttemptRecord, now time.Time) bool {
	if !isActiveAttemptStatus(attempt.Status) {
		return false
	}
	expiresAt, ok := parseOptionalTime(attempt.LeaseExpiresAt)
	return !ok || !expiresAt.After(now)
}

func (svc *InMemory) recoverExpiredLeasesLocked(now time.Time) bool {
	changed := false
	for attemptID, attempt := range svc.attempts {
		if !svc.isLeaseExpiredLocked(attempt, now) {
			continue
		}
		summary := "lease expired; queued for retry"
		attempt.Status = attemptStatusQueued
		attempt.RecoveryState = "retryable"
		attempt.FinishedAt = nil
		attempt.Summary = &summary
		attempt.LeaseHolder = nil
		attempt.LeaseExpiresAt = nil
		attempt.LastHeartbeatAt = nil
		svc.attempts[attemptID] = attempt
		changed = true
	}
	return changed
}

func (svc *InMemory) attemptsForWorkUnitLocked(batchID string, workUnitID string) []events.AttemptRecord {
	attempts := make([]events.AttemptRecord, 0)
	for _, attempt := range svc.attempts {
		if attempt.BatchID == nil || *attempt.BatchID != batchID || attempt.WorkUnitID != workUnitID {
			continue
		}
		attempts = append(attempts, attempt)
	}
	slices.SortFunc(attempts, func(left, right events.AttemptRecord) int {
		leftNumber := normalizedAttemptNumber(left)
		rightNumber := normalizedAttemptNumber(right)
		if leftNumber != rightNumber {
			return leftNumber - rightNumber
		}
		switch {
		case left.StartedAt < right.StartedAt:
			return -1
		case left.StartedAt > right.StartedAt:
			return 1
		case left.ID < right.ID:
			return -1
		case left.ID > right.ID:
			return 1
		default:
			return 0
		}
	})
	return attempts
}

func (svc *InMemory) latestAttemptForWorkUnitLocked(batchID string, workUnitID string) (events.AttemptRecord, bool) {
	attempts := svc.attemptsForWorkUnitLocked(batchID, workUnitID)
	if len(attempts) == 0 {
		return events.AttemptRecord{}, false
	}
	return attempts[len(attempts)-1], true
}

func (svc *InMemory) dependenciesCompletedLocked(batch events.BatchRecord, workUnit events.WorkUnit) bool {
	if len(workUnit.Dependencies) == 0 {
		return true
	}
	for _, dependencyID := range workUnit.Dependencies {
		attempt, ok := svc.latestAttemptForWorkUnitLocked(batch.ID, dependencyID)
		if !ok || !isCompletedAttemptStatus(attempt.Status) {
			return false
		}
	}
	return true
}

func (svc *InMemory) hasFailedDependencyLocked(batch events.BatchRecord, workUnit events.WorkUnit) bool {
	if len(workUnit.Dependencies) == 0 {
		return false
	}
	for _, dependencyID := range workUnit.Dependencies {
		attempt, ok := svc.latestAttemptForWorkUnitLocked(batch.ID, dependencyID)
		if !ok {
			continue
		}
		if attempt.Status == attemptStatusFailed || attempt.Status == attemptStatusBlocked || attempt.Status == attemptStatusCanceled {
			return true
		}
	}
	return false
}

func (svc *InMemory) activeAttemptCountLocked(batchID string, now time.Time) int {
	count := 0
	for _, attempt := range svc.attempts {
		if attempt.BatchID == nil || *attempt.BatchID != batchID {
			continue
		}
		if isActiveAttemptStatus(attempt.Status) && !svc.isLeaseExpiredLocked(attempt, now) {
			count += 1
		}
	}
	return count
}

func (svc *InMemory) leaseAttemptLocked(attempt events.AttemptRecord, holder string, ttl time.Duration, now time.Time) events.AttemptRecord {
	if strings.TrimSpace(holder) == "" {
		holder = defaultLeaseHolder
	}
	expiresAt := formatTime(now.Add(ttl))
	heartbeatAt := formatTime(now)
	attempt.Status = attemptStatusLeased
	attempt.RecoveryState = "retryable"
	attempt.FinishedAt = nil
	attempt.LeaseHolder = &holder
	attempt.LeaseExpiresAt = &expiresAt
	attempt.LastHeartbeatAt = &heartbeatAt
	if attempt.Summary != nil && strings.Contains(*attempt.Summary, "lease expired") {
		attempt.Summary = nil
	}
	return attempt
}

func (svc *InMemory) nextRunnableAttemptLocked(batch events.BatchRecord, now time.Time) (events.AttemptRecord, bool) {
	for _, workUnitID := range batch.WorkUnitIDs {
		workUnit, ok := svc.workUnits[workUnitID]
		if !ok {
			continue
		}
		attempt, ok := svc.latestAttemptForWorkUnitLocked(batch.ID, workUnit.ID)
		if !ok || attempt.Status != attemptStatusQueued {
			continue
		}
		if backoffUntil, ok := parseOptionalTime(attempt.RetryBackoffUntil); ok && backoffUntil.After(now) {
			continue
		}
		if svc.hasFailedDependencyLocked(batch, workUnit) {
			attempt.Status = attemptStatusBlocked
			attempt.RecoveryState = "retryable"
			svc.attempts[attempt.ID] = attempt
			continue
		}
		if svc.dependenciesCompletedLocked(batch, workUnit) {
			return attempt, true
		}
	}
	return events.AttemptRecord{}, false
}

func (svc *InMemory) scheduleBatchLocked(batchID string, holder string, now time.Time) bool {
	batch, ok := svc.batches[batchID]
	if !ok || batch.Status == attemptStatusBlocked || batch.Status == attemptStatusCompleted || batch.Status == attemptStatusCanceled {
		return false
	}
	changed := false
	for svc.activeAttemptCountLocked(batch.ID, now) < batch.ConcurrencyLimit {
		attempt, ok := svc.nextRunnableAttemptLocked(batch, now)
		if !ok {
			break
		}
		attempt = svc.leaseAttemptLocked(attempt, holder, leaseTTL(0), now)
		svc.attempts[attempt.ID] = attempt
		changed = true
	}
	if svc.refreshBatchStateLocked(batchID, nil) {
		changed = true
	}
	return changed
}

func (svc *InMemory) refreshBatchStateLocked(batchID string, finishedAt *string) bool {
	batch, ok := svc.batches[batchID]
	if !ok {
		return false
	}
	previous := batch
	total := 0
	completed := 0
	active := 0
	queued := 0
	blocked := 0
	failed := 0
	canceled := 0
	for _, attempt := range svc.attempts {
		if attempt.BatchID == nil || *attempt.BatchID != batchID {
			continue
		}
		total += 1
		switch {
		case isCompletedAttemptStatus(attempt.Status):
			completed += 1
		case isActiveAttemptStatus(attempt.Status):
			active += 1
		case attempt.Status == attemptStatusQueued:
			queued += 1
		case attempt.Status == attemptStatusFailed && isLiveRecoveryState(attempt.RecoveryState):
			failed += 1
		case attempt.Status == attemptStatusBlocked && isLiveRecoveryState(attempt.RecoveryState):
			blocked += 1
		case attempt.Status == attemptStatusCanceled:
			canceled += 1
		}
	}
	switch {
	case total > 0 && completed == total:
		batch.Status = "completed"
		batch.RecoveryState = "resolved"
		if finishedAt != nil {
			batch.FinishedAt = finishedAt
		}
	case canceled > 0 && completed+canceled == total:
		batch.Status = "canceled"
		batch.RecoveryState = "discarded"
		if finishedAt != nil {
			batch.FinishedAt = finishedAt
		}
	case failed > 0 || blocked > 0:
		batch.Status = "blocked"
		batch.RecoveryState = "retryable"
		batch.FinishedAt = nil
	case active > 0:
		batch.Status = "running"
		batch.RecoveryState = "retryable"
		batch.FinishedAt = nil
	case queued > 0:
		batch.Status = "queued"
		batch.RecoveryState = "retryable"
		batch.FinishedAt = nil
	}
	svc.batches[batchID] = batch
	return previous.Status != batch.Status ||
		previous.RecoveryState != batch.RecoveryState ||
		(previous.FinishedAt == nil) != (batch.FinishedAt == nil) ||
		(previous.FinishedAt != nil && batch.FinishedAt != nil && *previous.FinishedAt != *batch.FinishedAt)
}

func (svc *InMemory) Health(_ context.Context) events.HealthResponse {
	svc.mu.RLock()
	defer svc.mu.RUnlock()

	batchCounts := events.BatchCounts{}
	blockedBatchIDs := make([]string, 0)
	archivedBatchIDs := make([]string, 0)
	hasDiscarded := false
	for _, batch := range svc.batches {
		batchCounts.Total += 1
		switch batch.Status {
		case "running":
			batchCounts.Running += 1
		case "queued":
			batchCounts.Running += 1
		case "blocked":
			if isLiveRecoveryState(batch.RecoveryState) {
				batchCounts.Blocked += 1
				blockedBatchIDs = append(blockedBatchIDs, batch.ID)
			} else if batch.RecoveryState == "archived" {
				archivedBatchIDs = append(archivedBatchIDs, batch.ID)
			} else if batch.RecoveryState == "discarded" {
				hasDiscarded = true
			}
		case "completed":
			batchCounts.Completed += 1
		case "canceled":
			if batch.RecoveryState == "discarded" {
				hasDiscarded = true
			}
		}
	}
	slices.Sort(blockedBatchIDs)
	slices.Sort(archivedBatchIDs)

	attemptCounts := events.AttemptCounts{}
	failedAttemptIDs := make([]string, 0)
	var latestFailure *events.FailureSummary
	var latestFailureAt time.Time
	for _, attempt := range svc.attempts {
		attemptCounts.Total += 1
		switch attempt.Status {
		case attemptStatusQueued:
			attemptCounts.Queued += 1
		case attemptStatusLeased:
			attemptCounts.Leased += 1
			attemptCounts.Started += 1
		case attemptStatusRunning, legacyAttemptStatusStarted:
			attemptCounts.Running += 1
			attemptCounts.Started += 1
		case attemptStatusCompleted, legacyAttemptStatusSucceeded:
			attemptCounts.Completed += 1
			attemptCounts.Succeeded += 1
		case attemptStatusBlocked:
			attemptCounts.Blocked += 1
		case attemptStatusCanceled:
			attemptCounts.Canceled += 1
			attemptAt := latestAttemptTimestamp(attempt)
			parsedAttemptAt, ok := parseAttemptTimestamp(attemptAt)
			if latestFailure == nil || (ok && (latestFailureAt.IsZero() || parsedAttemptAt.After(latestFailureAt))) {
				if ok {
					latestFailureAt = parsedAttemptAt
				}
				latestFailure = &events.FailureSummary{
					AttemptID:    attempt.ID,
					BatchID:      attempt.BatchID,
					WorkUnitID:   attempt.WorkUnitID,
					ErrorCode:    attempt.ErrorCode,
					ErrorSummary: attempt.ErrorSummary,
					FinishedAt:   attempt.FinishedAt,
				}
			}
		case attemptStatusFailed:
			if isLiveRecoveryState(attempt.RecoveryState) {
				attemptCounts.Failed += 1
				failedAttemptIDs = append(failedAttemptIDs, attempt.ID)
			} else if attempt.RecoveryState == "discarded" {
				hasDiscarded = true
			}
			attemptAt := latestAttemptTimestamp(attempt)
			parsedAttemptAt, ok := parseAttemptTimestamp(attemptAt)
			if latestFailure == nil || (ok && (latestFailureAt.IsZero() || parsedAttemptAt.After(latestFailureAt))) {
				if ok {
					latestFailureAt = parsedAttemptAt
				}
				latestFailure = &events.FailureSummary{
					AttemptID:    attempt.ID,
					BatchID:      attempt.BatchID,
					WorkUnitID:   attempt.WorkUnitID,
					ErrorCode:    attempt.ErrorCode,
					ErrorSummary: attempt.ErrorSummary,
					FinishedAt:   attempt.FinishedAt,
				}
			}
		}
	}
	slices.Sort(failedAttemptIDs)

	storageKind := svc.store.Kind()
	stateConfigured := svc.store.Configured()
	durabilityTier := svc.store.DurabilityTier()
	deploymentScope := "service_to_service_private"
	maturity := "service_auth_v1"

	runtimeState := "idle"
	if batchCounts.Blocked > 0 {
		runtimeState = "blocked"
	} else if batchCounts.Running > 0 {
		runtimeState = "running"
	}

	failureState := "none"
	if attemptCounts.Failed > 0 {
		failureState = "failed"
	} else {
		for _, batch := range svc.batches {
			if batch.Status == "blocked" && batch.RecoveryState == "archived" {
				failureState = "historical"
				break
			}
		}
	}

	retryable := batchCounts.Blocked > 0 || attemptCounts.Failed > 0
	restartRecoverable := (storageKind == "file" || storageKind == "postgres") && (batchCounts.Total > 0 || attemptCounts.Total > 0)
	resumableBatchIDs := make([]string, 0)
	if restartRecoverable {
		resumableBatchIDs = append(resumableBatchIDs, blockedBatchIDs...)
		resumableBatchIDs = append(resumableBatchIDs, archivedBatchIDs...)
	}

	recoveryState := "none"
	if retryable {
		recoveryState = "retryable"
	}
	if failureState == "historical" && recoveryState == "none" {
		recoveryState = "archived"
	} else if hasDiscarded && recoveryState == "none" {
		recoveryState = "discarded"
	}

	status := "ok"
	if runtimeState == "blocked" || failureState == "failed" {
		status = "degraded"
	}

	recoveryHint := "No operator action required."
	if retryable && restartRecoverable && len(blockedBatchIDs) > 0 {
		recoveryHint = fmt.Sprintf(
			"Restart the kernel if needed, then retry blocked batches from the shell: %s.",
			strings.Join(blockedBatchIDs, ", "),
		)
	} else if retryable && len(blockedBatchIDs) > 0 {
		recoveryHint = fmt.Sprintf(
			"Resolve the failing attempt, then retry blocked batches from the shell: %s.",
			strings.Join(blockedBatchIDs, ", "),
		)
	} else if recoveryState == "discarded" {
		recoveryHint = "Discarded failures remain inspectable but do not block fresh boots."
	} else if recoveryState == "archived" && len(resumableBatchIDs) > 0 {
		recoveryHint = fmt.Sprintf(
			"Archived execution history is inspectable; retry from the shell if you want to resume: %s.",
			strings.Join(resumableBatchIDs, ", "),
		)
	} else if latestFailure != nil && latestFailure.ErrorSummary != nil {
		recoveryHint = fmt.Sprintf(
			"Inspect the latest failed attempt %s before retrying.",
			latestFailure.AttemptID,
		)
	}

	detail := fmt.Sprintf(
		"execution-kernel is reachable as a service-auth runtime with %s-backed local state configured=%t, runtime %s, recovery %s, restart-recoverable %t, %d blocked batch(es), %d failed attempt(s), and next action: %s",
		durabilityTier,
		stateConfigured,
		runtimeState,
		recoveryState,
		restartRecoverable,
		batchCounts.Blocked,
		attemptCounts.Failed,
		recoveryHint,
	)

	return events.HealthResponse{
		Status:             status,
		Service:            "execution-kernel",
		GeneratedAt:        nowISO(),
		AuthMode:           "service_token_or_localhost_dev",
		DeploymentScope:    deploymentScope,
		Maturity:           maturity,
		StorageKind:        storageKind,
		DurabilityTier:     durabilityTier,
		StatePath:          svc.store.StatePath(),
		StateConfigured:    stateConfigured,
		RuntimeState:       runtimeState,
		RecoveryState:      recoveryState,
		RestartRecoverable: restartRecoverable,
		FailureState:       failureState,
		BatchCounts:        batchCounts,
		AttemptCounts:      attemptCounts,
		BlockedBatchIDs:    blockedBatchIDs,
		FailedAttemptIDs:   failedAttemptIDs,
		ResumableBatchIDs:  resumableBatchIDs,
		LatestFailure:      latestFailure,
		RecoveryHint:       recoveryHint,
		Detail:             detail,
	}
}

func (svc *InMemory) LaunchBatch(_ context.Context, input events.LaunchBatchRequest) (events.BatchEnvelope, error) {
	if input.BatchID == "" || input.InitiativeID == "" || input.TaskGraphID == "" {
		return events.BatchEnvelope{}, errors.New("batchId, initiativeId, and taskGraphId are required")
	}
	if input.ConcurrencyLimit <= 0 {
		return events.BatchEnvelope{}, errors.New("concurrencyLimit must be greater than zero")
	}
	if len(input.WorkUnits) == 0 {
		return events.BatchEnvelope{}, errors.New("at least one work unit is required")
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	if batch, ok := svc.batches[input.BatchID]; ok {
		return svc.batchEnvelopeLocked(batch.ID)
	}

	previous := svc.snapshotLocked()
	startedAt := nowISO()
	batch := events.BatchRecord{
		ID:               input.BatchID,
		InitiativeID:     input.InitiativeID,
		TaskGraphID:      input.TaskGraphID,
		WorkUnitIDs:      []string{},
		ConcurrencyLimit: input.ConcurrencyLimit,
		Status:           "running",
		RecoveryState:    "retryable",
		StartedAt:        &startedAt,
		FinishedAt:       nil,
	}

	for _, workUnit := range input.WorkUnits {
		batch.WorkUnitIDs = append(batch.WorkUnitIDs, workUnit.ID)
		svc.workUnits[workUnit.ID] = workUnit
		attemptID := fmt.Sprintf("attempt-%s-%s", input.BatchID, workUnit.ID)
		batchID := input.BatchID
		attempt := events.AttemptRecord{
			ID:            attemptID,
			WorkUnitID:    workUnit.ID,
			BatchID:       &batchID,
			ExecutorType:  workUnit.ExecutorType,
			Status:        attemptStatusQueued,
			RecoveryState: "retryable",
			AttemptNumber: 1,
			StartedAt:     startedAt,
			FinishedAt:    nil,
			Summary:       nil,
			ArtifactURIs:  []string{},
			ErrorCode:     nil,
			ErrorSummary:  nil,
		}
		svc.attempts[attemptID] = attempt
	}

	svc.batches[batch.ID] = batch
	svc.scheduleBatchLocked(batch.ID, defaultLeaseHolder, time.Now().UTC())
	if err := svc.persistOrRollbackLocked(previous); err != nil {
		return events.BatchEnvelope{}, err
	}
	return svc.batchEnvelopeLocked(batch.ID)
}

func (svc *InMemory) BatchDetail(_ context.Context, batchID string) (events.BatchEnvelope, error) {
	svc.mu.RLock()
	defer svc.mu.RUnlock()
	return svc.batchEnvelopeLocked(batchID)
}

func (svc *InMemory) ResumeBatch(_ context.Context, batchID string) (events.BatchEnvelope, error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	batch, ok := svc.batches[batchID]
	if !ok {
		return events.BatchEnvelope{}, ErrNotFound
	}
	if batch.RecoveryState == "discarded" {
		return events.BatchEnvelope{}, fmt.Errorf("batch %s is discarded", batchID)
	}
	if batch.Status != "blocked" && batch.RecoveryState != "archived" {
		return events.BatchEnvelope{}, fmt.Errorf("batch %s is not blocked", batchID)
	}

	previous := svc.snapshotLocked()
	resumedAny := false
	now := time.Now().UTC()
	retryWorkUnitIDs := make([]string, 0)
	seenRetryWorkUnitIDs := map[string]bool{}
	for _, attempt := range svc.attempts {
		if attempt.BatchID == nil || *attempt.BatchID != batchID {
			continue
		}
		if seenRetryWorkUnitIDs[attempt.WorkUnitID] {
			continue
		}
		if attempt.RecoveryState == "discarded" {
			continue
		}
		if attempt.Status != attemptStatusFailed &&
			attempt.Status != attemptStatusBlocked &&
			attempt.Status != legacyAttemptStatusAbandoned {
			if attempt.RecoveryState != "archived" {
				continue
			}
		}
		retryWorkUnitIDs = append(retryWorkUnitIDs, attempt.WorkUnitID)
		seenRetryWorkUnitIDs[attempt.WorkUnitID] = true
	}
	for _, workUnitID := range retryWorkUnitIDs {
		workUnit, ok := svc.workUnits[workUnitID]
		if !ok {
			continue
		}
		reason := "batch resume"
		if _, err := svc.enqueueRetryAttemptLocked(batch, workUnit, events.RetryWorkUnitRequest{
			WorkUnitID: workUnitID,
			Reason:     &reason,
		}, now); err != nil {
			return events.BatchEnvelope{}, err
		}
		resumedAny = true
	}

	if !resumedAny {
		return events.BatchEnvelope{}, fmt.Errorf("batch %s has no failed attempts to resume", batchID)
	}

	batch.Status = "running"
	batch.RecoveryState = "retryable"
	batch.FinishedAt = nil
	svc.batches[batch.ID] = batch
	svc.scheduleBatchLocked(batch.ID, defaultLeaseHolder, now)
	if err := svc.persistOrRollbackLocked(previous); err != nil {
		return events.BatchEnvelope{}, err
	}

	return svc.batchEnvelopeLocked(batchID)
}

func (svc *InMemory) DiscardBatch(_ context.Context, batchID string) (events.BatchEnvelope, error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	batch, ok := svc.batches[batchID]
	if !ok {
		return events.BatchEnvelope{}, ErrNotFound
	}
	if batch.RecoveryState == "discarded" {
		return svc.batchEnvelopeLocked(batchID)
	}
	if batch.Status == "completed" {
		return events.BatchEnvelope{}, fmt.Errorf("batch %s is completed", batchID)
	}

	previous := svc.snapshotLocked()
	for attemptID, attempt := range svc.attempts {
		if attempt.BatchID == nil || *attempt.BatchID != batchID {
			continue
		}
		if isCompletedAttemptStatus(attempt.Status) || attempt.RecoveryState == "resolved" {
			continue
		}
		attempt.Status = attemptStatusCanceled
		attempt.RecoveryState = "discarded"
		attempt.LeaseHolder = nil
		attempt.LeaseExpiresAt = nil
		attempt.LastHeartbeatAt = nil
		svc.attempts[attemptID] = attempt
	}

	finishedAt := nowISO()
	batch.Status = "canceled"
	batch.RecoveryState = "discarded"
	batch.FinishedAt = &finishedAt
	svc.batches[batch.ID] = batch
	if err := svc.persistOrRollbackLocked(previous); err != nil {
		return events.BatchEnvelope{}, err
	}

	return svc.batchEnvelopeLocked(batchID)
}

func retryPolicyForWorkUnit(workUnit events.WorkUnit, input events.RetryWorkUnitRequest) events.RetryPolicy {
	policy := events.RetryPolicy{
		MaxAttempts:        defaultMaxAttempts,
		BackoffSeconds:     0,
		ExecutorPreference: []string{},
	}
	if workUnit.RetryPolicy != nil {
		policy = *workUnit.RetryPolicy
		policy.ExecutorPreference = slices.Clone(workUnit.RetryPolicy.ExecutorPreference)
	}
	if policy.MaxAttempts <= 0 {
		policy.MaxAttempts = defaultMaxAttempts
	}
	if input.MaxAttempts != nil && *input.MaxAttempts > 0 {
		policy.MaxAttempts = *input.MaxAttempts
	}
	if input.BackoffSeconds != nil && *input.BackoffSeconds >= 0 {
		policy.BackoffSeconds = *input.BackoffSeconds
	}
	if input.FailureClassification != nil {
		policy.FailureClassification = *input.FailureClassification
	}
	return policy
}

func retryExecutorType(workUnit events.WorkUnit, latest events.AttemptRecord, input events.RetryWorkUnitRequest, policy events.RetryPolicy) string {
	if input.ExecutorType != nil && strings.TrimSpace(*input.ExecutorType) != "" {
		return strings.TrimSpace(*input.ExecutorType)
	}
	if len(policy.ExecutorPreference) > 0 && strings.TrimSpace(policy.ExecutorPreference[0]) != "" {
		return strings.TrimSpace(policy.ExecutorPreference[0])
	}
	if strings.TrimSpace(latest.ExecutorType) != "" {
		return latest.ExecutorType
	}
	return workUnit.ExecutorType
}

func (svc *InMemory) enqueueRetryAttemptLocked(batch events.BatchRecord, workUnit events.WorkUnit, input events.RetryWorkUnitRequest, now time.Time) (events.AttemptRecord, error) {
	latest, ok := svc.latestAttemptForWorkUnitLocked(batch.ID, workUnit.ID)
	if !ok {
		return events.AttemptRecord{}, fmt.Errorf("work unit %s has no attempt in batch %s", workUnit.ID, batch.ID)
	}
	if latest.Status == attemptStatusQueued || isActiveAttemptStatus(latest.Status) {
		return latest, nil
	}
	if isCompletedAttemptStatus(latest.Status) {
		return events.AttemptRecord{}, fmt.Errorf("work unit %s is already completed", workUnit.ID)
	}

	policy := retryPolicyForWorkUnit(workUnit, input)
	latestNumber := normalizedAttemptNumber(latest)
	if latestNumber >= policy.MaxAttempts {
		return events.AttemptRecord{}, fmt.Errorf("work unit %s exhausted retry policy after %d attempt(s)", workUnit.ID, latestNumber)
	}

	parentAttemptID := latest.ID
	reason := "operator retry"
	if input.Reason != nil && strings.TrimSpace(*input.Reason) != "" {
		reason = strings.TrimSpace(*input.Reason)
	}
	nextNumber := latestNumber + 1
	batchID := batch.ID
	startedAt := formatTime(now)
	attempt := events.AttemptRecord{
		ID:              retryAttemptID(batch.ID, workUnit.ID, nextNumber),
		WorkUnitID:      workUnit.ID,
		BatchID:         &batchID,
		ExecutorType:    retryExecutorType(workUnit, latest, input, policy),
		Status:          attemptStatusQueued,
		RecoveryState:   "retryable",
		AttemptNumber:   nextNumber,
		ParentAttemptID: &parentAttemptID,
		RetryReason:     &reason,
		StartedAt:       startedAt,
		FinishedAt:      nil,
		Summary:         nil,
		ArtifactURIs:    []string{},
		ErrorCode:       nil,
		ErrorSummary:    nil,
	}
	if policy.BackoffSeconds > 0 {
		backoffUntil := formatTime(now.Add(time.Duration(policy.BackoffSeconds) * time.Second))
		attempt.RetryBackoffUntil = &backoffUntil
	}

	latest.RecoveryState = archiveRecoveredState(latest.RecoveryState)
	latest.LeaseHolder = nil
	latest.LeaseExpiresAt = nil
	latest.LastHeartbeatAt = nil
	svc.attempts[latest.ID] = latest
	svc.attempts[attempt.ID] = attempt
	workUnit.ExecutorType = attempt.ExecutorType
	workUnit.RetryPolicy = &policy
	svc.workUnits[workUnit.ID] = workUnit
	return attempt, nil
}

func (svc *InMemory) RetryWorkUnit(_ context.Context, batchID string, input events.RetryWorkUnitRequest) (events.AttemptActionEnvelope, error) {
	workUnitID := strings.TrimSpace(input.WorkUnitID)
	if workUnitID == "" {
		return events.AttemptActionEnvelope{}, errors.New("workUnitId is required")
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	batch, ok := svc.batches[batchID]
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}
	if batch.RecoveryState == "discarded" || batch.Status == "completed" || batch.Status == "canceled" {
		return events.AttemptActionEnvelope{}, fmt.Errorf("batch %s is not retryable", batchID)
	}
	workUnit, ok := svc.workUnits[workUnitID]
	if !ok {
		return events.AttemptActionEnvelope{}, fmt.Errorf("work unit %s not found in batch %s", workUnitID, batchID)
	}
	if !slices.Contains(batch.WorkUnitIDs, workUnitID) {
		return events.AttemptActionEnvelope{}, fmt.Errorf("work unit %s does not belong to batch %s", workUnitID, batchID)
	}

	previous := svc.snapshotLocked()
	now := time.Now().UTC()
	attempt, err := svc.enqueueRetryAttemptLocked(batch, workUnit, input, now)
	if err != nil {
		return events.AttemptActionEnvelope{}, err
	}
	batch.Status = "running"
	batch.RecoveryState = "retryable"
	batch.FinishedAt = nil
	svc.batches[batch.ID] = batch
	svc.scheduleBatchLocked(batch.ID, attempt.ExecutorType, now)
	svc.refreshBatchStateLocked(batch.ID, nil)
	if err := svc.persistOrRollbackLocked(previous); err != nil {
		return events.AttemptActionEnvelope{}, err
	}
	latest, ok := svc.latestAttemptForWorkUnitLocked(batch.ID, workUnit.ID)
	if ok {
		attempt = latest
	}

	return events.AttemptActionEnvelope{
		Batch:   svc.batches[batch.ID],
		Attempt: attempt,
	}, nil
}

func (svc *InMemory) batchEnvelopeLocked(batchID string) (events.BatchEnvelope, error) {
	batch, ok := svc.batches[batchID]
	if !ok {
		return events.BatchEnvelope{}, ErrNotFound
	}

	attempts := make([]events.AttemptRecord, 0)
	for _, attempt := range svc.attempts {
		if attempt.BatchID != nil && *attempt.BatchID == batchID {
			attempts = append(attempts, attempt)
		}
	}

	workUnitOrder := map[string]int{}
	for index, workUnitID := range batch.WorkUnitIDs {
		workUnitOrder[workUnitID] = index
	}
	slices.SortFunc(attempts, func(left, right events.AttemptRecord) int {
		leftOrder, leftOK := workUnitOrder[left.WorkUnitID]
		rightOrder, rightOK := workUnitOrder[right.WorkUnitID]
		if leftOK && rightOK && leftOrder != rightOrder {
			return leftOrder - rightOrder
		}
		switch {
		case left.ID < right.ID:
			return -1
		case left.ID > right.ID:
			return 1
		default:
			return 0
		}
	})

	return events.BatchEnvelope{
		Batch:    batch,
		Attempts: attempts,
	}, nil
}

func (svc *InMemory) AttemptDetail(_ context.Context, attemptID string) (events.AttemptEnvelope, error) {
	svc.mu.RLock()
	defer svc.mu.RUnlock()

	attempt, ok := svc.attempts[attemptID]
	if !ok {
		return events.AttemptEnvelope{}, ErrNotFound
	}

	return events.AttemptEnvelope{Attempt: attempt}, nil
}

func (svc *InMemory) AcquireNextAttempt(_ context.Context, batchID string, input events.AttemptLeaseRequest) (events.AttemptActionEnvelope, error) {
	holder := strings.TrimSpace(input.Holder)
	if holder == "" {
		return events.AttemptActionEnvelope{}, errors.New("holder is required")
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	batch, ok := svc.batches[batchID]
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}
	if batch.Status == "blocked" || batch.Status == "completed" || batch.Status == "canceled" {
		return events.AttemptActionEnvelope{}, fmt.Errorf("batch %s is not leaseable", batchID)
	}

	previous := svc.snapshotLocked()
	now := time.Now().UTC()
	svc.recoverExpiredLeasesLocked(now)
	if svc.activeAttemptCountLocked(batchID, now) >= batch.ConcurrencyLimit {
		return events.AttemptActionEnvelope{}, fmt.Errorf("batch %s has no available concurrency slots", batchID)
	}
	attempt, ok := svc.nextRunnableAttemptLocked(batch, now)
	if !ok {
		svc.refreshBatchStateLocked(batchID, nil)
		return events.AttemptActionEnvelope{}, fmt.Errorf("batch %s has no runnable attempts", batchID)
	}
	attempt = svc.leaseAttemptLocked(attempt, holder, leaseTTL(input.LeaseTTLSeconds), now)
	svc.attempts[attempt.ID] = attempt
	svc.refreshBatchStateLocked(batchID, nil)
	if err := svc.persistOrRollbackLocked(previous); err != nil {
		return events.AttemptActionEnvelope{}, err
	}

	return events.AttemptActionEnvelope{
		Batch:   svc.batches[batchID],
		Attempt: attempt,
	}, nil
}

func (svc *InMemory) HeartbeatAttempt(_ context.Context, attemptID string, input events.AttemptHeartbeatRequest) (events.AttemptActionEnvelope, error) {
	holder := strings.TrimSpace(input.Holder)
	if holder == "" {
		return events.AttemptActionEnvelope{}, errors.New("holder is required")
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	attempt, ok := svc.attempts[attemptID]
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}
	batch, ok := svc.batchForAttemptLocked(attempt)
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}
	if attempt.LeaseHolder == nil || *attempt.LeaseHolder != holder {
		return events.AttemptActionEnvelope{}, fmt.Errorf("attempt %s lease is held by another worker", attemptID)
	}
	now := time.Now().UTC()
	if svc.isLeaseExpiredLocked(attempt, now) {
		previous := svc.snapshotLocked()
		svc.recoverExpiredLeasesLocked(now)
		svc.refreshBatchStateLocked(batch.ID, nil)
		if err := svc.persistOrRollbackLocked(previous); err != nil {
			return events.AttemptActionEnvelope{}, err
		}
		return events.AttemptActionEnvelope{}, fmt.Errorf("attempt %s lease expired", attemptID)
	}

	previous := svc.snapshotLocked()
	expiresAt := formatTime(now.Add(leaseTTL(input.LeaseTTLSeconds)))
	heartbeatAt := formatTime(now)
	attempt.Status = attemptStatusRunning
	attempt.LeaseExpiresAt = &expiresAt
	attempt.LastHeartbeatAt = &heartbeatAt
	svc.attempts[attemptID] = attempt
	svc.refreshBatchStateLocked(batch.ID, nil)
	if err := svc.persistOrRollbackLocked(previous); err != nil {
		return events.AttemptActionEnvelope{}, err
	}

	return events.AttemptActionEnvelope{
		Batch:   svc.batches[batch.ID],
		Attempt: attempt,
	}, nil
}

func (svc *InMemory) CompleteAttempt(_ context.Context, attemptID string) (events.AttemptActionEnvelope, error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	attempt, ok := svc.attempts[attemptID]
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}

	batch, ok := svc.batchForAttemptLocked(attempt)
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}
	if isCompletedAttemptStatus(attempt.Status) {
		return events.AttemptActionEnvelope{
			Batch:   batch,
			Attempt: attempt,
		}, nil
	}

	previous := svc.snapshotLocked()
	finishedAt := nowISO()
	summary := "completed"
	attempt.Status = attemptStatusCompleted
	attempt.RecoveryState = "resolved"
	attempt.FinishedAt = &finishedAt
	attempt.Summary = &summary
	attempt.LeaseHolder = nil
	attempt.LeaseExpiresAt = nil
	attempt.LastHeartbeatAt = nil
	svc.attempts[attemptID] = attempt

	svc.scheduleBatchLocked(batch.ID, defaultLeaseHolder, time.Now().UTC())
	svc.refreshBatchStateLocked(batch.ID, &finishedAt)
	if err := svc.persistOrRollbackLocked(previous); err != nil {
		return events.AttemptActionEnvelope{}, err
	}
	batch = svc.batches[batch.ID]

	return events.AttemptActionEnvelope{
		Batch:   batch,
		Attempt: attempt,
	}, nil
}

func (svc *InMemory) FailAttempt(_ context.Context, attemptID string, input events.AttemptActionRequest) (events.AttemptActionEnvelope, error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	attempt, ok := svc.attempts[attemptID]
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}

	batch, ok := svc.batchForAttemptLocked(attempt)
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}
	if attempt.Status == attemptStatusFailed {
		return events.AttemptActionEnvelope{
			Batch:   batch,
			Attempt: attempt,
		}, nil
	}

	previous := svc.snapshotLocked()
	finishedAt := nowISO()
	attempt.Status = attemptStatusFailed
	attempt.RecoveryState = "retryable"
	attempt.FinishedAt = &finishedAt
	attempt.ErrorCode = input.ErrorCode
	attempt.ErrorSummary = input.ErrorSummary
	attempt.LeaseHolder = nil
	attempt.LeaseExpiresAt = nil
	attempt.LastHeartbeatAt = nil
	svc.attempts[attemptID] = attempt

	for candidateID, candidate := range svc.attempts {
		if candidateID == attemptID || candidate.BatchID == nil || *candidate.BatchID != batch.ID {
			continue
		}
		if !isTerminalAttemptStatus(candidate.Status) {
			candidate.Status = attemptStatusBlocked
			candidate.RecoveryState = "retryable"
			candidate.LeaseHolder = nil
			candidate.LeaseExpiresAt = nil
			candidate.LastHeartbeatAt = nil
			svc.attempts[candidateID] = candidate
		}
	}

	batch.Status = "blocked"
	batch.RecoveryState = "retryable"
	svc.batches[batch.ID] = batch
	if err := svc.persistOrRollbackLocked(previous); err != nil {
		return events.AttemptActionEnvelope{}, err
	}

	return events.AttemptActionEnvelope{
		Batch:   batch,
		Attempt: attempt,
	}, nil
}

func (svc *InMemory) batchForAttemptLocked(attempt events.AttemptRecord) (events.BatchRecord, bool) {
	if attempt.BatchID == nil {
		return events.BatchRecord{}, false
	}
	batch, ok := svc.batches[*attempt.BatchID]
	return batch, ok
}
