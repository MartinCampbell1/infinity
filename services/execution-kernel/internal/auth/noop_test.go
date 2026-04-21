package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLocalhostOnlyAllowsLoopback(t *testing.T) {
	t.Parallel()

	next := http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	request.RemoteAddr = "127.0.0.1:8787"
	recorder := httptest.NewRecorder()

	LocalhostOnly(next).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected loopback request to pass, got %d", recorder.Code)
	}
}

func TestLocalhostOnlyRejectsRemoteRequests(t *testing.T) {
	t.Parallel()

	next := http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	request.RemoteAddr = "203.0.113.9:8787"
	recorder := httptest.NewRecorder()

	LocalhostOnly(next).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected remote request to be rejected, got %d", recorder.Code)
	}
}

func TestLocalhostOnlyIgnoresSpoofedForwardedHeaders(t *testing.T) {
	t.Parallel()

	next := http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	request.RemoteAddr = "203.0.113.9:8787"
	request.Header.Set("X-Forwarded-For", "127.0.0.1")
	recorder := httptest.NewRecorder()

	LocalhostOnly(next).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected spoofed forwarded header request to be rejected, got %d", recorder.Code)
	}
}
