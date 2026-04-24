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

	deploymentEnv := firstNonEmpty(
		os.Getenv("EXECUTION_KERNEL_DEPLOYMENT_ENV"),
		os.Getenv("FOUNDEROS_DEPLOYMENT_ENV"),
	)

	svc, err := service.NewFromConfig(service.Config{
		DeploymentEnv: deploymentEnv,
		StatePath:     statePath,
		DatabaseURL:   os.Getenv("EXECUTION_KERNEL_DATABASE_URL"),
	})
	if err != nil {
		log.Fatalf("failed to initialize execution-kernel store: %v", err)
	}
	defer func() {
		if err := svc.Close(); err != nil {
			log.Printf("execution-kernel store close error: %v", err)
		}
	}()
	httpHandler := handler.NewHTTPHandler(svc)
	server := daemon.NewServer(addr, middleware.Chain(httpHandler, auth.ServiceToService(serviceAuthConfigFromEnv(deploymentEnv))))

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

	health := svc.Health(context.Background())
	log.Printf("execution-kernel listening on %s with %s storage %s", addr, health.StorageKind, health.StatePath)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
	if shutdownContext.Err() != nil {
		<-shutdownComplete
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func serviceAuthConfigFromEnv(deploymentEnv string) auth.Config {
	return auth.Config{
		Secret: firstNonEmpty(
			os.Getenv("FOUNDEROS_EXECUTION_KERNEL_SERVICE_AUTH_SECRET"),
			os.Getenv("EXECUTION_KERNEL_SERVICE_AUTH_SECRET"),
		),
		PreviousSecret: firstNonEmpty(
			os.Getenv("FOUNDEROS_EXECUTION_KERNEL_SERVICE_AUTH_PREVIOUS_SECRET"),
			os.Getenv("EXECUTION_KERNEL_SERVICE_AUTH_PREVIOUS_SECRET"),
		),
		DeploymentEnv:           deploymentEnv,
		AllowLocalhostDevBypass: os.Getenv("EXECUTION_KERNEL_LOCALHOST_DEV_AUTH_BYPASS") != "0",
	}
}
