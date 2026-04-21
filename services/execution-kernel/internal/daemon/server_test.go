package daemon

import (
	"net/http"
	"testing"
	"time"
)

func TestNewServerAppliesTimeouts(t *testing.T) {
	t.Parallel()

	server := NewServer("127.0.0.1:8787", http.NewServeMux())

	if server.ReadHeaderTimeout != 5*time.Second {
		t.Fatalf("expected read header timeout 5s, got %s", server.ReadHeaderTimeout)
	}
	if server.ReadTimeout != 15*time.Second {
		t.Fatalf("expected read timeout 15s, got %s", server.ReadTimeout)
	}
	if server.WriteTimeout != 30*time.Second {
		t.Fatalf("expected write timeout 30s, got %s", server.WriteTimeout)
	}
	if server.IdleTimeout != 60*time.Second {
		t.Fatalf("expected idle timeout 60s, got %s", server.IdleTimeout)
	}
}
