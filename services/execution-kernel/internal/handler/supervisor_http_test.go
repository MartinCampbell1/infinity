package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"execution-kernel/internal/service"
)

func TestKernelAttemptLifecycleActions(t *testing.T) {
	svc := service.NewInMemory()
	handler := NewHTTPHandler(svc)

	launchBody := map[string]any{
		"batchId":          "batch-002",
		"initiativeId":     "initiative-002",
		"taskGraphId":      "task-graph-002",
		"concurrencyLimit": 1,
		"workUnits": []map[string]any{
			{
				"id":                 "work-unit-002",
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
		t.Fatalf("expected 201 from batch launch, got %d", launchRecorder.Code)
	}

	completeRequest := httptest.NewRequest(http.MethodPost, "/api/v1/attempts/attempt-batch-002-work-unit-002/complete", nil)
	completeRecorder := httptest.NewRecorder()
	handler.ServeHTTP(completeRecorder, completeRequest)
	if completeRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from attempt complete, got %d with body %s", completeRecorder.Code, completeRecorder.Body.String())
	}

	var completeResponse struct {
		Batch struct {
			Status string `json:"status"`
		} `json:"batch"`
		Attempt struct {
			Status string `json:"status"`
		} `json:"attempt"`
	}
	if err := json.Unmarshal(completeRecorder.Body.Bytes(), &completeResponse); err != nil {
		t.Fatalf("failed to decode complete response: %v", err)
	}
	if completeResponse.Batch.Status != "completed" {
		t.Fatalf("expected completed batch, got %s", completeResponse.Batch.Status)
	}
	if completeResponse.Attempt.Status != "completed" {
		t.Fatalf("expected completed attempt, got %s", completeResponse.Attempt.Status)
	}

	launchRecorder = httptest.NewRecorder()
	handler.ServeHTTP(launchRecorder, launchRequest)

	failBody := bytes.NewBufferString(`{"errorSummary":"tool crashed","errorCode":"TOOL_FAILURE"}`)
	failRequest := httptest.NewRequest(http.MethodPost, "/api/v1/attempts/attempt-batch-002-work-unit-002/fail", failBody)
	failRequest.Header.Set("content-type", "application/json")
	failRecorder := httptest.NewRecorder()
	handler.ServeHTTP(failRecorder, failRequest)
	if failRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from attempt fail, got %d with body %s", failRecorder.Code, failRecorder.Body.String())
	}

	var failResponse struct {
		Batch struct {
			Status string `json:"status"`
		} `json:"batch"`
		Attempt struct {
			Status       string `json:"status"`
			ErrorSummary string `json:"errorSummary"`
		} `json:"attempt"`
	}
	if err := json.Unmarshal(failRecorder.Body.Bytes(), &failResponse); err != nil {
		t.Fatalf("failed to decode fail response: %v", err)
	}
	if failResponse.Batch.Status != "blocked" {
		t.Fatalf("expected blocked batch, got %s", failResponse.Batch.Status)
	}
	if failResponse.Attempt.Status != "failed" {
		t.Fatalf("expected failed attempt, got %s", failResponse.Attempt.Status)
	}
	if failResponse.Attempt.ErrorSummary != "tool crashed" {
		t.Fatalf("expected error summary to round-trip, got %s", failResponse.Attempt.ErrorSummary)
	}
}
