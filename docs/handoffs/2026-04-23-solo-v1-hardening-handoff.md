# Solo V1 Hardening Handoff

Date: 2026-04-23
Workspace: `/Users/martin/infinity`
Branch: `codex/infinity-step10-go`

## What landed

This branch now includes two checkpoint commits that closed the hardening plan plus the later addendum:

1. `b66958f` — `feat: complete solo-v1 hardening phases 1-8`
2. `62f899a` — `feat: remove demo leakage and clean runtime restart health`

## Main outcomes

- deterministic shell/kernel validation path
- embedded auth fail-closed for FounderOS launch / embedded mode
- explicit localhost CORS allowlist via `proxy.ts`
- canonical localhost topology locked to `3737 / 3101 / 8798`
- truthful delivery and handoff readiness semantics
- recovery-only secondary work-ui wording
- live workspace session-context logic moved out of `mock` naming into `session-context.ts`
- demo/reference leakage removed from the named live shell components
- stale restarted `running/started` kernel work now becomes archived resumable backlog instead of poisoning fresh health
- direct runtime `localStorage.token` reads reduced to the shared credentials helper plus tests

## Files most affected

- `apps/shell/apps/web/components/frontdoor/plane-ai-home-surface.tsx`
- `apps/shell/apps/web/components/frontdoor/plane-root-composer.tsx`
- `apps/shell/apps/web/components/execution/primary-run-surface.tsx`
- `apps/shell/apps/web/components/orchestration/delivery-summary.tsx`
- `apps/shell/apps/web/proxy.ts`
- `apps/shell/apps/web/lib/server/http/privileged-api-cors.ts`
- `apps/shell/apps/web/lib/server/control-plane/workspace/session-context.ts`
- `apps/work-ui/src/lib/founderos/credentials.ts`
- `apps/work-ui/src/routes/(app)/project-run/[id]/+page.svelte`
- `apps/work-ui/src/routes/(app)/project-result/[id]/+page.svelte`
- `services/execution-kernel/internal/service/service.go`
- `services/execution-kernel/internal/service/service_test.go`
- `scripts/start-localhost.mjs`
- `scripts/validation/run_infinity_validation.py`

## Verification that passed

- `npm run shell:test`
- `npm run work-ui:check`
- `cd /Users/martin/infinity/services/execution-kernel && go test ./...`
- `npm run validate:full`

Recent green validation runs created during this work:

- `handoff-packets/validation/2026-04-22T20-40-38Z`
- `handoff-packets/validation/2026-04-22T21-04-45Z`

## Manual/live checks completed

- shell root `/` answered as frontdoor
- shell frontdoor one-prompt flow was started live from Safari
- kernel health on committed state reported `status=ok`, `runtimeState=idle`, no live blocked/failed counts
- localhost stack was shut down after checks; no persistent watcher/dev processes were intentionally left running

## Non-blocking warnings still visible

- shell lint still emits existing `turbo/no-undeclared-env-vars` warnings for `FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS` and `VITEST`
- work-ui check still emits the existing `@sveltejs/svelte-virtual-list` export-condition warning
- Next/Turbopack still prints the existing NFT tracing warning involving `next.config.mjs`

These warnings did not block the final acceptance gate.
