# Control-plane retention jobs

Status: P2-BE-01 operational contract.

## Scope

The retention job is intentionally narrow:

- remove expired failed preview records from the shell directory;
- remove expired failed handoff packet records;
- mark stale shell-side agent-session lease mirrors as failed;
- optionally remove local-only orchestration artifact paths under the configured Infinity artifact roots.

It does not delete ready or delivered delivery artifacts. Production object-store lifecycle rules remain the source of truth for durable artifact expiry.

## Job entrypoint

Use the protected shell route:

```bash
curl -sS -X POST "$FOUNDEROS_SHELL_ORIGIN/api/control/orchestration/retention" \
  -H "authorization: Bearer $FOUNDEROS_CONTROL_PLANE_SERVICE_TOKEN" \
  -H "content-type: application/json" \
  --data '{"dryRun":true}'
```

Apply cleanup only after reviewing the dry-run plan:

```bash
curl -sS -X POST "$FOUNDEROS_SHELL_ORIGIN/api/control/orchestration/retention" \
  -H "authorization: Bearer $FOUNDEROS_CONTROL_PLANE_SERVICE_TOKEN" \
  -H "content-type: application/json" \
  --data '{"dryRun":false,"applyFilesystem":true}'
```

The route defaults to dry-run. Local filesystem cleanup only runs when both `dryRun:false` and `applyFilesystem:true` are present.

## Retention policy

Current defaults:

- failed previews: 7 days;
- failed handoff packets: 7 days;
- rejected local delivery artifacts: 30 days;
- stale shell-side agent sessions: 2 hours.

Local artifact deletion is restricted to:

- `FOUNDEROS_ORCHESTRATION_ARTIFACTS_ROOT`, defaulting to `.local-state/assemblies`;
- `FOUNDEROS_ORCHESTRATION_DELIVERIES_ROOT`, defaulting to `.local-state/orchestration/deliveries`.

Paths outside those roots are never deleted by the shell retention job.

## Lease cleanup boundary

Execution-kernel attempt leases are recovered by the kernel itself on boot, heartbeat, and lease acquisition. The shell retention job only cleans stale shell-side agent-session mirrors so the operator boards do not keep displaying dead runtime sessions as active.

## Verification

Focused checks:

```bash
cd apps/shell/apps/web
npx vitest run lib/server/orchestration/retention.test.ts lib/server/http/control-plane-auth.test.ts
npx eslint lib/server/orchestration/retention.ts lib/server/orchestration/retention.test.ts app/api/control/orchestration/retention/route.ts lib/server/http/control-plane-auth.ts lib/server/http/control-plane-auth.test.ts
NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
```

Do not run this job from a watcher or a long-lived local script. Schedule it from the deployed platform scheduler or a short-lived ops worker.
