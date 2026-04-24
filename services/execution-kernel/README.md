# execution-kernel

First-wave Infinity execution-kernel scaffold for Phase 3.

Current scope:

- `GET /healthz`
- `POST /api/v1/batches`
- `GET /api/v1/batches/{batchId}`
- `POST /api/v1/batches/{batchId}/lease-next`
- `POST /api/v1/batches/{batchId}/retry-work-unit`
- `POST /api/v1/batches/{batchId}/resume`
- `POST /api/v1/batches/{batchId}/discard`
- `GET /api/v1/attempts/{attemptId}`
- `POST /api/v1/attempts/{attemptId}/heartbeat`
- `POST /api/v1/attempts/{attemptId}/complete`
- `POST /api/v1/attempts/{attemptId}/fail`

Current implementation is intentionally small, but the daemon now:

- enforces scoped service-to-service auth, with localhost-only bypass available
  only for local development when no service secret is configured;
- uses a durable Postgres store when `EXECUTION_KERNEL_DATABASE_URL` is set;
- schedules queued attempts by dependency readiness and per-batch
  `concurrencyLimit`;
- leases runnable attempts with a TTL, accepts worker heartbeats, and makes
  expired leases retryable/reassignable;
- creates retry/reassignment attempt lineage instead of mutating completed or
  failed attempts in place;
- refuses to boot in `production` or `staging` deployment mode without
  `EXECUTION_KERNEL_DATABASE_URL`;
- keeps a local file-backed state snapshot at `./.local-state/execution-kernel/state.json`
  for development unless `EXECUTION_KERNEL_STATE_PATH` overrides it;
- exposes durability and recovery hints through `GET /healthz`;
- starts with bounded HTTP timeouts and graceful shutdown.

Storage modes:

- `EXECUTION_KERNEL_DATABASE_URL=postgres://...` enables the production store.
  The store persists batches, attempts, work-unit snapshots, leases,
  heartbeats, and append-only kernel events through
  `migrations/002_durable_kernel_store.sql` and
  `migrations/003_scheduler_attempt_leases.sql`.
  `migrations/004_retry_attempt_lineage.sql` adds retry attempt lineage
  metadata.
- `EXECUTION_KERNEL_DEPLOYMENT_ENV=production` or `staging` requires the
  Postgres URL and rejects file/memory stores at boot.
- Development mode may use `EXECUTION_KERNEL_STATE_PATH` for a local JSON
  snapshot. This is not a production durability boundary.
- Set `EXECUTION_KERNEL_TEST_DATABASE_URL` to run the opt-in Postgres restart
  simulation in `go test ./...`.

Service auth:

- `FOUNDEROS_EXECUTION_KERNEL_SERVICE_AUTH_SECRET` enables required
  HMAC/JWT-style service tokens. `EXECUTION_KERNEL_SERVICE_AUTH_SECRET` remains
  a local/legacy fallback.
- `FOUNDEROS_EXECUTION_KERNEL_SERVICE_AUTH_PREVIOUS_SECRET` is accepted during
  secret rotation. `EXECUTION_KERNEL_SERVICE_AUTH_PREVIOUS_SECRET` remains a
  local/legacy fallback.
- Tokens must include one of `kernel.health.read`, `kernel.batch.create`, or
  `kernel.attempt.mutate`, depending on the route. Lease, retry-work-unit,
  heartbeat, resume, discard, completion, and failure routes require
  `kernel.attempt.mutate`.
- `EXECUTION_KERNEL_LOCALHOST_DEV_AUTH_BYPASS=0` disables the local loopback
  fallback even in development.
