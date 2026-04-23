#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export EXECUTION_KERNEL_ADDR="${EXECUTION_KERNEL_ADDR:-127.0.0.1:8798}"
go run ./cmd/execution-kernel
