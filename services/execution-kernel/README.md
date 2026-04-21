# execution-kernel

First-wave Infinity execution-kernel scaffold for Phase 3.

Current scope:

- `GET /healthz`
- `POST /api/v1/batches`
- `GET /api/v1/batches/{batchId}`
- `GET /api/v1/attempts/{attemptId}`

Current implementation is intentionally small, but the daemon now:

- enforces localhost-only HTTP access;
- keeps a local file-backed state snapshot at `./.local-state/execution-kernel/state.json`
  unless `EXECUTION_KERNEL_STATE_PATH` overrides it;
- exposes durability and recovery hints through `GET /healthz`;
- starts with bounded HTTP timeouts and graceful shutdown.

Phase 4 still owns richer batch orchestration, retries, reassignment, and
supervisor behavior.
