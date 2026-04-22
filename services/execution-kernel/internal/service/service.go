package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"execution-kernel/internal/events"
)

var ErrNotFound = errors.New("not found")

type Service interface {
	Health(context.Context) events.HealthResponse
	LaunchBatch(context.Context, events.LaunchBatchRequest) (events.BatchEnvelope, error)
	BatchDetail(context.Context, string) (events.BatchEnvelope, error)
	ResumeBatch(context.Context, string) (events.BatchEnvelope, error)
	DiscardBatch(context.Context, string) (events.BatchEnvelope, error)
	AttemptDetail(context.Context, string) (events.AttemptEnvelope, error)
	CompleteAttempt(context.Context, string) (events.AttemptActionEnvelope, error)
	FailAttempt(context.Context, string, events.AttemptActionRequest) (events.AttemptActionEnvelope, error)
}

type InMemory struct {
	mu        sync.RWMutex
	batches   map[string]events.BatchRecord
	attempts  map[string]events.AttemptRecord
	statePath string
}

func NewInMemory() *InMemory {
	return &InMemory{
		batches:  map[string]events.BatchRecord{},
		attempts: map[string]events.AttemptRecord{},
	}
}

type persistedState struct {
	Version  int                             `json:"version"`
	Batches  map[string]events.BatchRecord   `json:"batches"`
	Attempts map[string]events.AttemptRecord `json:"attempts"`
}

func defaultPersistedState() persistedState {
	return persistedState{
		Version:  1,
		Batches:  map[string]events.BatchRecord{},
		Attempts: map[string]events.AttemptRecord{},
	}
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
	svc := &InMemory{
		batches:   map[string]events.BatchRecord{},
		attempts:  map[string]events.AttemptRecord{},
		statePath: statePath,
	}

	if err := svc.hydrateFromDisk(); err != nil {
		return nil, err
	}

	return svc, nil
}

func (svc *InMemory) hydrateFromDisk() error {
	if svc.statePath == "" {
		return nil
	}

	raw, err := os.ReadFile(svc.statePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("read persisted execution-kernel state: %w", err)
	}

	state := defaultPersistedState()
	if err := json.Unmarshal(raw, &state); err != nil {
		return fmt.Errorf("decode persisted execution-kernel state: %w", err)
	}

	if state.Batches == nil {
		state.Batches = map[string]events.BatchRecord{}
	}
	if state.Attempts == nil {
		state.Attempts = map[string]events.AttemptRecord{}
	}

	for batchID, batch := range state.Batches {
		if batch.Status == "running" {
			batch.Status = "blocked"
			batch.RecoveryState = archiveRecoveredState(batch.RecoveryState)
			if batch.FinishedAt == nil {
				finishedAt := nowISO()
				batch.FinishedAt = &finishedAt
			}
		} else if batch.Status == "blocked" || batch.Status == "completed" {
			batch.RecoveryState = archiveRecoveredState(batch.RecoveryState)
		}
		state.Batches[batchID] = batch
	}
	for attemptID, attempt := range state.Attempts {
		if attempt.Status == "started" {
			attempt.Status = "abandoned"
			attempt.RecoveryState = archiveRecoveredState(attempt.RecoveryState)
			if attempt.FinishedAt == nil {
				finishedAt := nowISO()
				attempt.FinishedAt = &finishedAt
			}
			if attempt.Summary == nil {
				summary := "abandoned after restart"
				attempt.Summary = &summary
			}
		} else if attempt.Status == "failed" || attempt.Status == "succeeded" {
			attempt.RecoveryState = archiveRecoveredState(attempt.RecoveryState)
		}
		state.Attempts[attemptID] = attempt
	}

	svc.batches = state.Batches
	svc.attempts = state.Attempts
	return nil
}

func (svc *InMemory) persistLocked() error {
	if svc.statePath == "" {
		return nil
	}

	state := persistedState{
		Version:  1,
		Batches:  svc.batches,
		Attempts: svc.attempts,
	}

	if err := os.MkdirAll(filepath.Dir(svc.statePath), 0o755); err != nil {
		return fmt.Errorf("create execution-kernel state dir: %w", err)
	}

	raw, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("encode execution-kernel state: %w", err)
	}

	tempPath := fmt.Sprintf("%s.tmp-%d", svc.statePath, time.Now().UnixNano())
	if err := os.WriteFile(tempPath, raw, 0o644); err != nil {
		return fmt.Errorf("write execution-kernel temp state: %w", err)
	}

	if err := os.Rename(tempPath, svc.statePath); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("replace execution-kernel state: %w", err)
	}

	return nil
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
		case "started":
			attemptCounts.Started += 1
		case "succeeded":
			attemptCounts.Succeeded += 1
		case "failed":
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

	storageKind := "memory"
	stateConfigured := false
	durabilityTier := "ephemeral_memory"
	if svc.statePath != "" {
		storageKind = "file"
		stateConfigured = true
		durabilityTier = "local_file_snapshot"
	}
	deploymentScope := "localhost_only_solo"
	maturity := "phase3_scaffold"

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
	restartRecoverable := storageKind == "file" && (batchCounts.Total > 0 || attemptCounts.Total > 0)
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
		"execution-kernel is reachable as a localhost-only phase-3 scaffold with %s-backed local state configured=%t, runtime %s, recovery %s, restart-recoverable %t, %d blocked batch(es), %d failed attempt(s), and next action: %s",
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
		AuthMode:           "localhost_only",
		DeploymentScope:    deploymentScope,
		Maturity:           maturity,
		StorageKind:        storageKind,
		DurabilityTier:     durabilityTier,
		StatePath:          svc.statePath,
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

	attempts := make([]events.AttemptRecord, 0, len(input.WorkUnits))
	for _, workUnit := range input.WorkUnits {
		batch.WorkUnitIDs = append(batch.WorkUnitIDs, workUnit.ID)
		attemptID := fmt.Sprintf("attempt-%s-%s", input.BatchID, workUnit.ID)
		batchID := input.BatchID
		attempt := events.AttemptRecord{
			ID:            attemptID,
			WorkUnitID:    workUnit.ID,
			BatchID:       &batchID,
			ExecutorType:  workUnit.ExecutorType,
			Status:        "started",
			RecoveryState: "retryable",
			StartedAt:     startedAt,
			FinishedAt:    nil,
			Summary:       nil,
			ArtifactURIs:  []string{},
			ErrorCode:     nil,
			ErrorSummary:  nil,
		}
		svc.attempts[attemptID] = attempt
		attempts = append(attempts, attempt)
	}

	svc.batches[batch.ID] = batch
	if err := svc.persistLocked(); err != nil {
		return events.BatchEnvelope{}, err
	}
	return events.BatchEnvelope{
		Batch:    batch,
		Attempts: attempts,
	}, nil
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

	resumedAt := nowISO()
	resumedAny := false
	for attemptID, attempt := range svc.attempts {
		if attempt.BatchID == nil || *attempt.BatchID != batchID {
			continue
		}
		if attempt.RecoveryState == "discarded" {
			continue
		}
		if attempt.Status != "failed" && attempt.Status != "abandoned" {
			if attempt.RecoveryState != "archived" {
				continue
			}
		}
		attempt.Status = "started"
		attempt.RecoveryState = "retryable"
		attempt.StartedAt = resumedAt
		attempt.FinishedAt = nil
		attempt.Summary = nil
		attempt.ErrorCode = nil
		attempt.ErrorSummary = nil
		svc.attempts[attemptID] = attempt
		resumedAny = true
	}

	if !resumedAny {
		return events.BatchEnvelope{}, fmt.Errorf("batch %s has no failed attempts to resume", batchID)
	}

	batch.Status = "running"
	batch.RecoveryState = "retryable"
	batch.FinishedAt = nil
	svc.batches[batch.ID] = batch
	if err := svc.persistLocked(); err != nil {
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
	if batch.Status != "blocked" {
		return events.BatchEnvelope{}, fmt.Errorf("batch %s is not blocked", batchID)
	}
	if batch.RecoveryState == "discarded" {
		return svc.batchEnvelopeLocked(batchID)
	}

	for attemptID, attempt := range svc.attempts {
		if attempt.BatchID == nil || *attempt.BatchID != batchID {
			continue
		}
		if attempt.Status == "succeeded" || attempt.RecoveryState == "resolved" {
			continue
		}
		attempt.RecoveryState = "discarded"
		svc.attempts[attemptID] = attempt
	}

	batch.RecoveryState = "discarded"
	svc.batches[batch.ID] = batch
	if err := svc.persistLocked(); err != nil {
		return events.BatchEnvelope{}, err
	}

	return svc.batchEnvelopeLocked(batchID)
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

	slices.SortFunc(attempts, func(left, right events.AttemptRecord) int {
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

func (svc *InMemory) CompleteAttempt(_ context.Context, attemptID string) (events.AttemptActionEnvelope, error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	attempt, ok := svc.attempts[attemptID]
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}

	finishedAt := nowISO()
	summary := "completed"
	attempt.Status = "succeeded"
	attempt.RecoveryState = "resolved"
	attempt.FinishedAt = &finishedAt
	attempt.Summary = &summary
	svc.attempts[attemptID] = attempt

	batch, ok := svc.batchForAttemptLocked(attempt)
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}

	allSucceeded := true
	for _, candidate := range svc.attempts {
		if candidate.BatchID != nil && attempt.BatchID != nil && *candidate.BatchID == *attempt.BatchID {
			if candidate.Status != "succeeded" {
				allSucceeded = false
				break
			}
		}
	}

	if allSucceeded {
		batch.Status = "completed"
		batch.RecoveryState = "resolved"
		batch.FinishedAt = &finishedAt
	}
	svc.batches[batch.ID] = batch
	if err := svc.persistLocked(); err != nil {
		return events.AttemptActionEnvelope{}, err
	}

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

	finishedAt := nowISO()
	attempt.Status = "failed"
	attempt.RecoveryState = "retryable"
	attempt.FinishedAt = &finishedAt
	attempt.ErrorCode = input.ErrorCode
	attempt.ErrorSummary = input.ErrorSummary
	svc.attempts[attemptID] = attempt

	batch, ok := svc.batchForAttemptLocked(attempt)
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}
	batch.Status = "blocked"
	batch.RecoveryState = "retryable"
	svc.batches[batch.ID] = batch
	if err := svc.persistLocked(); err != nil {
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
