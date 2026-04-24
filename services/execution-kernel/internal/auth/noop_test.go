package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
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

	if recorder.Code != http.StatusUnauthorized {
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

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected spoofed forwarded header request to be rejected, got %d", recorder.Code)
	}
}

func TestServiceToServiceRejectsMutationWithoutTokenFromPrivateNetwork(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodPost, "/api/v1/batches", nil)
	request.RemoteAddr = "10.0.4.5:8787"
	recorder := httptest.NewRecorder()

	ServiceToService(Config{Secret: "current-secret"})(okHandler()).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected missing token to be rejected, got %d", recorder.Code)
	}
}

func TestServiceToServiceRejectsInvalidToken(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	request.RemoteAddr = "10.0.4.5:8787"
	request.Header.Set("Authorization", "Bearer invalid")
	recorder := httptest.NewRecorder()

	ServiceToService(Config{Secret: "current-secret"})(okHandler()).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected invalid token to be rejected, got %d", recorder.Code)
	}
}

func TestServiceToServiceRejectsMissingScope(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 4, 24, 12, 0, 0, 0, time.UTC)
	token := signTestToken(t, "current-secret", []string{ScopeKernelHealthRead}, now)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/batches", nil)
	request.RemoteAddr = "10.0.4.5:8787"
	request.Header.Set("Authorization", "Bearer "+token)
	recorder := httptest.NewRecorder()

	ServiceToService(Config{
		Secret: "current-secret",
		Clock:  func() time.Time { return now },
	})(okHandler()).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected missing scope to be rejected, got %d", recorder.Code)
	}
}

func TestServiceToServiceAcceptsScopedToken(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 4, 24, 12, 0, 0, 0, time.UTC)
	token := signTestToken(t, "current-secret", []string{ScopeKernelBatchCreate}, now)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/batches", nil)
	request.RemoteAddr = "10.0.4.5:8787"
	request.Header.Set("Authorization", "Bearer "+token)
	recorder := httptest.NewRecorder()

	ServiceToService(Config{
		Secret: "current-secret",
		Clock:  func() time.Time { return now },
	})(okHandler()).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected scoped token to pass, got %d", recorder.Code)
	}
}

func TestServiceToServiceAcceptsPreviousSecretDuringRotation(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 4, 24, 12, 0, 0, 0, time.UTC)
	token := signTestToken(t, "previous-secret", []string{ScopeKernelAttemptMutate}, now)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/attempts/attempt-001/fail", nil)
	request.RemoteAddr = "10.0.4.5:8787"
	request.Header.Set("Authorization", "Bearer "+token)
	recorder := httptest.NewRecorder()

	ServiceToService(Config{
		Secret:         "current-secret",
		PreviousSecret: "previous-secret",
		Clock:          func() time.Time { return now },
	})(okHandler()).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected previous secret token to pass during rotation, got %d", recorder.Code)
	}
}

func TestServiceToServiceAcceptsAttemptMutateScopeForLeaseAndHeartbeatRoutes(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 4, 24, 12, 0, 0, 0, time.UTC)
	token := signTestToken(t, "current-secret", []string{ScopeKernelAttemptMutate}, now)
	for _, path := range []string{
		"/api/v1/batches/batch-001/lease-next",
		"/api/v1/attempts/attempt-001/heartbeat",
	} {
		t.Run(path, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, path, nil)
			request.RemoteAddr = "10.0.4.5:8787"
			request.Header.Set("Authorization", "Bearer "+token)
			recorder := httptest.NewRecorder()

			ServiceToService(Config{
				Secret: "current-secret",
				Clock:  func() time.Time { return now },
			})(okHandler()).ServeHTTP(recorder, request)

			if recorder.Code != http.StatusNoContent {
				t.Fatalf("expected %s to accept attempt mutate scope, got %d", path, recorder.Code)
			}
		})
	}
}

func TestServiceToServiceAcceptsShellClientTokenFixture(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodPost, "/api/v1/batches", nil)
	request.RemoteAddr = "10.0.4.5:8787"
	request.Header.Set(
		"Authorization",
		"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJmb3VuZGVyb3Mtc2hlbGwiLCJhdWQiOiJleGVjdXRpb24ta2VybmVsIiwic2NwIjpbImtlcm5lbC5iYXRjaC5jcmVhdGUiXSwiaWF0IjoxNzc3MDMyMDAwLCJleHAiOjE3NzcwMzIzMDB9.j2gTlfwLSZ0-zHZnq2CYs0FicLr21KT6A3uB4534gxM",
	)
	recorder := httptest.NewRecorder()

	ServiceToService(Config{
		Secret: "shell-client-secret",
		Clock: func() time.Time {
			return time.Unix(1777032000, 0).UTC()
		},
	})(okHandler()).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected shell client token fixture to pass, got %d", recorder.Code)
	}
}

func okHandler() http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusNoContent)
	})
}

func signTestToken(t *testing.T, secret string, scopes []string, now time.Time) string {
	t.Helper()
	token, err := SignServiceToken(secret, scopes, now, 5*time.Minute)
	if err != nil {
		t.Fatalf("SignServiceToken() error = %v", err)
	}
	return token
}
