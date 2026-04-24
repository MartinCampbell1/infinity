package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"execution-kernel/internal/service"
)

func TestKernelHealthAndBatchLifecycle(t *testing.T) {
	svc := service.NewInMemory()
	handler := NewHTTPHandler(svc)

	healthRequest := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	healthRecorder := httptest.NewRecorder()
	handler.ServeHTTP(healthRecorder, healthRequest)

	if healthRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from /healthz, got %d", healthRecorder.Code)
	}

	var healthBody map[string]any
	if err := json.Unmarshal(healthRecorder.Body.Bytes(), &healthBody); err != nil {
		t.Fatalf("failed to decode health response: %v", err)
	}
	if healthBody["status"] != "ok" {
		t.Fatalf("expected health status ok, got %#v", healthBody["status"])
	}
	if _, ok := healthBody["recoveryHint"]; !ok {
		t.Fatalf("expected health response to include recoveryHint")
	}
	if _, ok := healthBody["blockedBatchIds"]; !ok {
		t.Fatalf("expected health response to include blockedBatchIds")
	}
	if _, ok := healthBody["failedAttemptIds"]; !ok {
		t.Fatalf("expected health response to include failedAttemptIds")
	}

	launchBody := map[string]any{
		"batchId":          "batch-001",
		"initiativeId":     "initiative-001",
		"taskGraphId":      "task-graph-001",
		"concurrencyLimit": 1,
		"workUnits": []map[string]any{
			{
				"id":                 "work-unit-001",
				"title":              "Foundation",
				"description":        "Lay down the execution scaffold",
				"executorType":       "droid",
				"scopePaths":         []string{"/Users/martin/infinity/apps/shell"},
				"dependencies":       []string{},
				"acceptanceCriteria": []string{"Kernel launches the first attempt"},
			},
		},
	}
	rawLaunchBody, err := json.Marshal(launchBody)
	if err != nil {
		t.Fatalf("failed to encode launch request: %v", err)
	}

	launchRequest := httptest.NewRequest(http.MethodPost, "/api/v1/batches", bytes.NewReader(rawLaunchBody))
	launchRequest.Header.Set("content-type", "application/json")
	launchRecorder := httptest.NewRecorder()
	handler.ServeHTTP(launchRecorder, launchRequest)

	if launchRecorder.Code != http.StatusCreated {
		t.Fatalf("expected 201 from batch launch, got %d with body %s", launchRecorder.Code, launchRecorder.Body.String())
	}

	var launchResponse struct {
		Batch struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"batch"`
		Attempts []struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"attempts"`
	}
	if err := json.Unmarshal(launchRecorder.Body.Bytes(), &launchResponse); err != nil {
		t.Fatalf("failed to decode launch response: %v", err)
	}
	if launchResponse.Batch.ID != "batch-001" {
		t.Fatalf("expected batch id batch-001, got %s", launchResponse.Batch.ID)
	}
	if launchResponse.Batch.Status != "running" {
		t.Fatalf("expected running batch status, got %s", launchResponse.Batch.Status)
	}
	if len(launchResponse.Attempts) != 1 || launchResponse.Attempts[0].Status != "leased" {
		t.Fatalf("expected one leased attempt, got %#v", launchResponse.Attempts)
	}

	batchRequest := httptest.NewRequest(http.MethodGet, "/api/v1/batches/batch-001", nil)
	batchRecorder := httptest.NewRecorder()
	handler.ServeHTTP(batchRecorder, batchRequest)
	if batchRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from batch detail, got %d", batchRecorder.Code)
	}

	attemptRequest := httptest.NewRequest(http.MethodGet, "/api/v1/attempts/attempt-batch-001-work-unit-001", nil)
	attemptRecorder := httptest.NewRecorder()
	handler.ServeHTTP(attemptRecorder, attemptRequest)
	if attemptRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from attempt detail, got %d", attemptRecorder.Code)
	}

	failBody := bytes.NewBufferString(`{"errorSummary":"resume smoke","errorCode":"RESUME"}`)
	failRequest := httptest.NewRequest(http.MethodPost, "/api/v1/attempts/attempt-batch-001-work-unit-001/fail", failBody)
	failRequest.Header.Set("content-type", "application/json")
	failRecorder := httptest.NewRecorder()
	handler.ServeHTTP(failRecorder, failRequest)
	if failRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from attempt fail, got %d", failRecorder.Code)
	}

	resumeRequest := httptest.NewRequest(http.MethodPost, "/api/v1/batches/batch-001/resume", nil)
	resumeRecorder := httptest.NewRecorder()
	handler.ServeHTTP(resumeRecorder, resumeRequest)
	if resumeRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from batch resume, got %d with body %s", resumeRecorder.Code, resumeRecorder.Body.String())
	}

	failRecorder = httptest.NewRecorder()
	handler.ServeHTTP(failRecorder, failRequest)
	if failRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from second attempt fail, got %d", failRecorder.Code)
	}

	discardRequest := httptest.NewRequest(http.MethodPost, "/api/v1/batches/batch-001/discard", nil)
	discardRecorder := httptest.NewRecorder()
	handler.ServeHTTP(discardRecorder, discardRequest)
	if discardRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from batch discard, got %d with body %s", discardRecorder.Code, discardRecorder.Body.String())
	}
}
