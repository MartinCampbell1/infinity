# Incident Runbooks

P1-OPS-02 requires operator runbooks for the production failure modes that can
stop autonomous delivery: kernel down, DB down, delivery stuck, and auth
failure. Alerts must point to the matching anchor in this file.

## Alert Links

| Alert id | Severity | Owner | Runbook |
| --- | --- | --- | --- |
| `execution_kernel_down` | critical | runtime-ops | `docs/ops/incident-runbooks.md#kernel-down` |
| `control_plane_db_down` | critical | platform-ops | `docs/ops/incident-runbooks.md#db-down` |
| `delivery_stuck` | warning | delivery-ops | `docs/ops/incident-runbooks.md#delivery-stuck` |
| `control_plane_auth_failure` | critical | security-ops | `docs/ops/incident-runbooks.md#auth-failure` |

## Kernel Down

<a id="kernel-down"></a>

Symptoms:
- `GET /healthz` fails from the shell runtime.
- Batch launch returns `502`, `503`, or a kernel transport error.
- `/execution/issues` shows `runtime-kernel-health`.

Triage:
1. Check `FOUNDEROS_EXECUTION_KERNEL_BASE_URL` and confirm it is the private
   staging/production kernel endpoint.
2. From the shell runtime, call the kernel health endpoint with the configured
   service auth.
3. Check kernel logs for process crash, DB connection failure, or lease
   saturation.
4. Inspect blocked batch IDs and failed attempt IDs from the health payload.

Mitigation:
1. Restart or redeploy the execution-kernel service.
2. If the kernel reports retryable state, retry blocked batches from the
   recoveries lane.
3. If retries keep failing, pause new autonomous batch launches and keep the
   incident open.

Verification:
- `GET /healthz` returns `status=ok` or a degraded state with a concrete
  retryable recovery hint.
- A new batch can be created and leased.
- `/execution/issues` no longer shows a live kernel-down alert.

## DB Down

<a id="db-down"></a>

Symptoms:
- Boot diagnostics reports `controlPlaneSchema.observed.ready=false`.
- `storagePolicy.postgresRequired=true` and the shell enters read-only degraded
  mode.
- Control-plane mutations fail before durable state is written.

Triage:
1. Check the configured Postgres URL in the secrets manager.
2. Confirm network access from shell and kernel runtimes to the database.
3. Run the schema status check from boot diagnostics and compare the expected
   schema version/checksum.
4. Inspect database provider logs for connection limit, auth, migration, or
   failover errors.

Mitigation:
1. Restore database connectivity or fail over to the standby database.
2. Apply pending migrations only after confirming the target database and schema
   checksum.
3. Keep the shell in read-only mode until schema status is ready.

Verification:
- Boot diagnostics reports `controlPlaneSchema.observed.ready=true`.
- Storage policy is no longer degraded/read-only for staging or production.
- A small authenticated control-plane write succeeds and survives reload.

## Delivery Stuck

<a id="delivery-stuck"></a>

Symptoms:
- Strict delivery remains blocked or stale after verification.
- Preview target health stays failed or pending past the expected window.
- Signed manifest, proof bundle, or external delivery preflight is missing.

Triage:
1. Open the delivery detail and inspect readiness blockers.
2. Check verification records, preview health, signed manifest URI, and external
   delivery result.
3. Download the signed manifest and artifact URLs; verify checksums when
   present.
4. Inspect recovery incidents tied to the initiative/session.

Mitigation:
1. Retry verification if the failure is transient and evidence is still fresh.
2. Rebuild delivery artifacts if checksums, signed URLs, or object storage paths
   are invalid.
3. Re-run external delivery preflight before attempting another GitHub/Vercel
   handoff.

Verification:
- Delivery state is not stale and has runnable proof plus external proof where
  strict mode requires it.
- Signed manifest and every artifact URL are downloadable.
- The delivery page shows a ready state without local file artifact links.

## Auth Failure

<a id="auth-failure"></a>

Symptoms:
- Privileged API returns `401` or `403` for a configured actor.
- Workspace launch/bootstrap/session exchange cannot mint session state.
- Boot diagnostics marks auth secrets or allowed origins missing/invalid.

Triage:
1. Confirm operator/service token presence in the secrets manager.
2. Check `FOUNDEROS_PRIVILEGED_API_ALLOWED_ORIGINS` and the public shell/work-ui
   origins.
3. Verify launch, session-grant, and session-token secrets are distinct and
   configured for the active deployment environment.
4. Inspect the rejected route and auth boundary from response headers/logs.

Mitigation:
1. Rotate or re-sync the affected secret through the configured secrets manager.
2. Redeploy shell/work-ui after secret changes.
3. Reissue workspace session grants for affected sessions.

Verification:
- Boot diagnostics no longer reports missing auth configuration.
- Privileged read and mutation requests succeed with the expected actor headers.
- Workspace bootstrap returns `auth.mode=session_exchange` and does not expose
  raw token values.
