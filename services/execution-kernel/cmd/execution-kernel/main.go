package main

import (
	"log"
	"os"
	"path/filepath"

	"execution-kernel/internal/daemon"
	"execution-kernel/internal/handler"
	"execution-kernel/internal/service"
)

func main() {
	addr := os.Getenv("EXECUTION_KERNEL_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8787"
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
	server := daemon.NewServer(addr, httpHandler)

	log.Printf("execution-kernel listening on %s with state %s", addr, statePath)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
