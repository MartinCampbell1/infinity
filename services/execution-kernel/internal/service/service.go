package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"time"

	"execution-kernel/internal/events"
)

var ErrNotFound = errors.New("not found")

type Service interface {
	Health(context.Context) events.HealthResponse
	LaunchBatch(context.Context, events.LaunchBatchRequest) (events.BatchEnvelope, error)
	BatchDetail(context.Context, string) (events.BatchEnvelope, error)
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

func (svc *InMemory) Health(_ context.Context) events.HealthResponse {
	return events.HealthResponse{
		Status:      "ok",
		Service:     "execution-kernel",
		GeneratedAt: nowISO(),
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
		StartedAt:        &startedAt,
		FinishedAt:       nil,
	}

	attempts := make([]events.AttemptRecord, 0, len(input.WorkUnits))
	for _, workUnit := range input.WorkUnits {
		batch.WorkUnitIDs = append(batch.WorkUnitIDs, workUnit.ID)
		attemptID := fmt.Sprintf("attempt-%s-%s", input.BatchID, workUnit.ID)
		batchID := input.BatchID
		attempt := events.AttemptRecord{
			ID:           attemptID,
			WorkUnitID:   workUnit.ID,
			BatchID:      &batchID,
			ExecutorType: workUnit.ExecutorType,
			Status:       "started",
			StartedAt:    startedAt,
			FinishedAt:   nil,
			Summary:      nil,
			ArtifactURIs: []string{},
			ErrorCode:    nil,
			ErrorSummary: nil,
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
	attempt.FinishedAt = &finishedAt
	attempt.ErrorCode = input.ErrorCode
	attempt.ErrorSummary = input.ErrorSummary
	svc.attempts[attemptID] = attempt

	batch, ok := svc.batchForAttemptLocked(attempt)
	if !ok {
		return events.AttemptActionEnvelope{}, ErrNotFound
	}
	batch.Status = "blocked"
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
