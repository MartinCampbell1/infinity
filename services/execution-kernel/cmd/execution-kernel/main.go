package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"execution-kernel/internal/auth"
	"execution-kernel/internal/daemon"
	"execution-kernel/internal/handler"
	"execution-kernel/internal/middleware"
	"execution-kernel/internal/service"
)

func main() {
	addr := os.Getenv("EXECUTION_KERNEL_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8798"
	}

	statePath := os.Getenv("EXECUTION_KERNEL_STATE_PATH")
	if statePath == "" {
		statePath = filepath.Join(".local-state", "execution-kernel", "state.json")
	}

	svc, err := service.NewFileBacked(statePath)
	if err != nil {
		log.Fatalf("failed to initialize execution-kernel store: %v", err)
	}
	httpHandler := handler.NewHTTPHandler(svc)
	server := daemon.NewServer(addr, middleware.Chain(httpHandler, auth.LocalhostOnly))

	shutdownContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	shutdownComplete := make(chan struct{})

	go func() {
		defer close(shutdownComplete)
		<-shutdownContext.Done()

		log.Printf("execution-kernel shutting down")
		gracefulContext, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(gracefulContext); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("execution-kernel shutdown error: %v", err)
		}
	}()

	log.Printf("execution-kernel listening on %s with state %s", addr, statePath)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
	if shutdownContext.Err() != nil {
		<-shutdownComplete
	}
}
