package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"execution-kernel/internal/events"
	"execution-kernel/internal/service"
)

type HTTPHandler struct {
	service service.Service
}

func NewHTTPHandler(svc service.Service) *HTTPHandler {
	return &HTTPHandler{service: svc}
}

func writeJSON(response http.ResponseWriter, status int, payload any) {
	response.Header().Set("content-type", "application/json")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(payload)
}

func writeError(response http.ResponseWriter, status int, detail string) {
	writeJSON(response, status, map[string]string{"detail": detail})
}

func (handler *HTTPHandler) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	switch {
	case request.Method == http.MethodGet && request.URL.Path == "/healthz":
		writeJSON(response, http.StatusOK, handler.service.Health(request.Context()))
		return

	case request.Method == http.MethodPost && request.URL.Path == "/api/v1/batches":
		handler.launchBatch(response, request)
		return

	case request.Method == http.MethodGet && strings.HasPrefix(request.URL.Path, "/api/v1/batches/"):
		handler.batchDetail(response, request)
		return

	case strings.HasPrefix(request.URL.Path, "/api/v1/attempts/"):
		if strings.HasSuffix(request.URL.Path, "/complete") || strings.HasSuffix(request.URL.Path, "/fail") {
			handler.attemptAction(response, request)
		} else {
			handler.attemptDetail(response, request)
		}
		return

	default:
		writeError(response, http.StatusNotFound, "route not found")
	}
}

func attemptIDFromPath(path string) string {
	trimmed := strings.TrimPrefix(path, "/api/v1/attempts/")
	parts := strings.Split(trimmed, "/")
	if len(parts) == 0 {
		return ""
	}
	return parts[0]
}

func (handler *HTTPHandler) launchBatch(response http.ResponseWriter, request *http.Request) {
	var input events.LaunchBatchRequest
	if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
		writeError(response, http.StatusBadRequest, "invalid batch launch payload")
		return
	}

	result, err := handler.service.LaunchBatch(request.Context(), input)
	if err != nil {
		writeError(response, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(response, http.StatusCreated, result)
}

func (handler *HTTPHandler) batchDetail(response http.ResponseWriter, request *http.Request) {
	batchID := strings.TrimPrefix(request.URL.Path, "/api/v1/batches/")
	if batchID == "" {
		writeError(response, http.StatusBadRequest, "batch id is required")
		return
	}

	result, err := handler.service.BatchDetail(request.Context(), batchID)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			writeError(response, http.StatusNotFound, "batch not found")
			return
		}
		writeError(response, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(response, http.StatusOK, result)
}

func (handler *HTTPHandler) attemptDetail(response http.ResponseWriter, request *http.Request) {
	attemptID := attemptIDFromPath(request.URL.Path)
	if attemptID == "" {
		writeError(response, http.StatusBadRequest, "attempt id is required")
		return
	}

	result, err := handler.service.AttemptDetail(request.Context(), attemptID)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			writeError(response, http.StatusNotFound, "attempt not found")
			return
		}
		writeError(response, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(response, http.StatusOK, result)
}

func (handler *HTTPHandler) attemptAction(response http.ResponseWriter, request *http.Request) {
	attemptID := attemptIDFromPath(request.URL.Path)
	if attemptID == "" {
		writeError(response, http.StatusBadRequest, "attempt id is required")
		return
	}

	switch {
	case request.Method == http.MethodPost && strings.HasSuffix(request.URL.Path, "/complete"):
		result, err := handler.service.CompleteAttempt(request.Context(), attemptID)
		if err != nil {
			if errors.Is(err, service.ErrNotFound) {
				writeError(response, http.StatusNotFound, "attempt not found")
				return
			}
			writeError(response, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(response, http.StatusOK, result)
		return

	case request.Method == http.MethodPost && strings.HasSuffix(request.URL.Path, "/fail"):
		var input events.AttemptActionRequest
		if err := json.NewDecoder(request.Body).Decode(&input); err != nil && !errors.Is(err, io.EOF) {
			writeError(response, http.StatusBadRequest, "invalid attempt fail payload")
			return
		}
		result, err := handler.service.FailAttempt(request.Context(), attemptID, input)
		if err != nil {
			if errors.Is(err, service.ErrNotFound) {
				writeError(response, http.StatusNotFound, "attempt not found")
				return
			}
			writeError(response, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(response, http.StatusOK, result)
		return

	default:
		writeError(response, http.StatusNotFound, "route not found")
	}
}
