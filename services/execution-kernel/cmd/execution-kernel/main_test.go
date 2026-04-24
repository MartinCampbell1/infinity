package main

import "testing"

func TestServiceAuthConfigAcceptsCanonicalFounderOSEnv(t *testing.T) {
	t.Setenv("FOUNDEROS_EXECUTION_KERNEL_SERVICE_AUTH_SECRET", "canonical-secret")
	t.Setenv("EXECUTION_KERNEL_SERVICE_AUTH_SECRET", "")
	t.Setenv("FOUNDEROS_EXECUTION_KERNEL_SERVICE_AUTH_PREVIOUS_SECRET", "previous-canonical-secret")
	t.Setenv("EXECUTION_KERNEL_SERVICE_AUTH_PREVIOUS_SECRET", "")

	config := serviceAuthConfigFromEnv("production")

	if config.Secret != "canonical-secret" {
		t.Fatalf("expected canonical FounderOS secret, got %q", config.Secret)
	}
	if config.PreviousSecret != "previous-canonical-secret" {
		t.Fatalf("expected canonical previous secret, got %q", config.PreviousSecret)
	}
}

func TestServiceAuthConfigKeepsLegacyExecutionKernelFallback(t *testing.T) {
	t.Setenv("FOUNDEROS_EXECUTION_KERNEL_SERVICE_AUTH_SECRET", "")
	t.Setenv("EXECUTION_KERNEL_SERVICE_AUTH_SECRET", "legacy-secret")

	config := serviceAuthConfigFromEnv("local")

	if config.Secret != "legacy-secret" {
		t.Fatalf("expected legacy execution-kernel secret fallback, got %q", config.Secret)
	}
}
