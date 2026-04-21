# parallel-batch-01.md

## Purpose

This file tracks the current parallel execution batch inside `/Users/martin/infinity`.

It exists to prevent overlapping edits, accidental upstream changes, and unordered merges while multiple bounded workers are running.

## Global rules for this batch

- External repos are always read-only:
  - `/Users/martin/FounderOS`
  - `/Users/martin/open-webui`
  - `/Users/martin/hermes-webui`
- Product direction comes from `unified-control-plane-super-spec-v2-2026-04-10.md`.
- Ownership and merge discipline come from `agents.md`.
- Only `apps/shell` and `apps/work-ui` are editable implementation roots.
- `references/*` are copied snapshots, not implementation homes.

## Batch status

Current platform thread limit: 6 parallel agent threads.

### Batch state after reconnect

- Worker 1: completed
- Worker 2: failed due agent-side interruption/usage stop, replaced by Worker 2R
- Worker 3: completed
- Worker 4: completed
- Worker 5: lost during reconnect, replaced by Worker 5R
- Worker 6: completed
- Worker 7: completed
- Worker 8: completed
- Local orchestrator follow-up: copied app manifests/configs into `apps/shell/apps/web` and `apps/work-ui`, added root `package.json` + `turbo.json`, and copied FounderOS support packages into `packages/*`.

### Wave 1 original

1. Worker 1
   Scope:
   - `apps/shell/apps/web/lib/navigation.ts`
   - `apps/shell/apps/web/lib/route-scope.ts`
   - `apps/shell/apps/web/app/(shell)/execution/sessions/page.tsx`
   - `apps/shell/apps/web/app/(shell)/execution/groups/page.tsx`
   - `apps/shell/apps/web/app/(shell)/execution/accounts/page.tsx`
   - `apps/shell/apps/web/app/(shell)/execution/recoveries/page.tsx`
   - `apps/shell/apps/web/components/execution/session-surface.tsx`
   Goal:
   - shell IA, route scope, deep links, mock-backed board quality

2. Worker 2
   Scope:
   - `apps/shell/apps/web/app/(shell)/execution/workspace/[sessionId]/page.tsx`
   - `apps/shell/apps/web/components/execution/workspace-handoff-surface.tsx`
   - `apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts`
   - `apps/shell/apps/web/lib/server/control-plane/workspace/*`
   - `apps/shell/apps/web/scripts/smoke-shell-contract.mjs`
   Goal:
   - workspace host route, handoff contract, smoke path

3. Worker 3
   Scope:
   - `apps/work-ui/src/lib/founderos/*`
   - `apps/work-ui/src/routes/(app)/+layout.svelte`
   - `apps/work-ui/src/lib/components/founderos/*`
   Goal:
   - embedded/launch mode and host-aware layout behavior

4. Worker 4
   Scope:
   - `apps/work-ui/src/lib/components/hermes/**/*`
   - `apps/work-ui/src/lib/utils/hermesSessions.ts`
   - `apps/work-ui/src/lib/utils/hermesTranscript.ts`
   - `apps/work-ui/src/lib/utils/hermesTranscript.test.ts`
   - `apps/work-ui/src/lib/components/layout/Sidebar/HermesSessionItem.svelte`
   Goal:
   - Hermes-grade workspace behavior port within bounded UI scope

5. Worker 5
   Scope:
   - `apps/shell/apps/web/lib/server/control-plane/contracts/session-events.ts`
   - `apps/shell/apps/web/lib/server/control-plane/events/*`
   - `apps/shell/apps/web/lib/server/control-plane/sessions/index.ts`
   - `fixtures/raw/codex-jsonl/*`
   - `fixtures/raw/hermes-sse/*`
   - `fixtures/raw/codext-session-supervisor/*`
   - `fixtures/golden/normalized-events/*`
   - `fixtures/golden/session-projections/*`
   Goal:
   - normalized event layer and deterministic projection fixtures

6. Worker 6
   Scope:
   - `apps/shell/apps/web/lib/server/control-plane/accounts/*`
   - `apps/shell/apps/web/lib/server/control-plane/contracts/quota.ts`
   - `apps/shell/apps/web/app/api/control/accounts/*`
   - `fixtures/raw/codex-app-server-rate-limits/*`
   - `fixtures/golden/quota-projections/*`
   Goal:
   - quota and account-capacity layer

### Wave 2 originally queued

7. Worker 7
   Scope:
   - `apps/shell/apps/web/lib/server/control-plane/contracts/approvals.ts`
   - `apps/shell/apps/web/lib/server/control-plane/contracts/recoveries.ts`
   - `apps/shell/apps/web/lib/server/control-plane/contracts/operator-actions.ts`
   - `apps/shell/apps/web/lib/server/control-plane/approvals/*`
   - `apps/shell/apps/web/lib/server/control-plane/recoveries/*`
   - `apps/shell/apps/web/app/api/control/execution/approvals/*`
   - `apps/shell/apps/web/app/api/control/execution/recoveries/*`
   - `apps/shell/apps/web/app/(shell)/execution/approvals/page.tsx`
   Goal:
   - approvals and recoveries as durable control-plane objects

8. Worker 8
   Scope:
   - `contracts.md`
   - `contract-drift-checklist.md`
   - `integration-matrix.md`
   - `launch-order.md`
   - `fixtures/README.md`
   - `fixtures/raw/README.md`
   - `fixtures/golden/README.md`
   - `fixtures/raw/codex-jsonl/manifest.md`
   - `fixtures/raw/codex-app-server-rate-limits/capture-template.md`
   - `fixtures/raw/hermes-sse/capture-template.md`
   - `fixtures/raw/codext-session-supervisor/capture-template.md`
   - `fixtures/golden/normalized-events/manifest.md`
   - `fixtures/golden/session-projections/manifest.md`
   - `fixtures/golden/quota-projections/manifest.md`
   - `handoff-packets/*`
   Goal:
   - contract freeze, fixture guidance, QA merge safety

## Merge order

1. Event normalization
2. Quota/accounts
3. Shell IA
4. Workspace host
5. Embedded mode
6. Hermes behaviors
7. Approvals/recoveries
8. QA/docs sweep

## Active after reconnect

1. Worker 2R
   Scope:
   - `apps/shell/apps/web/app/(shell)/execution/workspace/[sessionId]/page.tsx`
   - `apps/shell/apps/web/components/execution/workspace-handoff-surface.tsx`
   - `apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts`
   - `apps/shell/apps/web/lib/server/control-plane/workspace/*`
   - `apps/shell/apps/web/scripts/smoke-shell-contract.mjs`
   Goal:
   - finish workspace host route in a coherent, buildable state

2. Worker 5R
   Scope:
   - `apps/shell/apps/web/lib/server/control-plane/contracts/session-events.ts`
   - `apps/shell/apps/web/lib/server/control-plane/events/*`
   - `apps/shell/apps/web/lib/server/control-plane/sessions/index.ts`
   - `fixtures/raw/codex-jsonl/*`
   - `fixtures/raw/hermes-sse/*`
   - `fixtures/raw/codext-session-supervisor/*`
   - `fixtures/golden/normalized-events/*`
   - `fixtures/golden/session-projections/*`
   Goal:
   - restore and finish normalized event workstream after disconnect

3. Worker 7
   Goal:
   - approvals/recoveries durable object layer

4. Worker 8
   Goal:
   - QA/doc contract freeze and integration guidance

## Batch result

- Shell IA, workspace host, embedded mode, Hermes behavior port, event normalization, quota/accounts, approvals/recoveries, and QA packet sweep all completed inside `/Users/martin/infinity`.
- Upstream repos remained untouched during this batch.
- Main remaining blocker moved from repo-boundary ambiguity to `apps/work-ui` dependency closure and bounded re-introduction of missing Open WebUI modules.
- Local validation status after orchestration:
  - `npm install` completed at repo root.
  - `npm run shell:typecheck` passed.
  - `npm run shell:build` passed.
  - `npm run shell:test` passed with the rewritten Infinity-scoped smoke contract.
  - `npx --yes tsx ./scripts/verify-event-fixtures.ts` passed.
  - `npx vitest run src/lib/founderos/contract.test.ts src/lib/utils/hermesTranscript.test.ts` in `apps/work-ui` passed.
  - `npm run work-ui:check` still fails broadly because the local copy does not yet include the full upstream dependency tree.

## Integration rules for this batch

- If a worker needs a file outside its scope, it must report the need instead of editing it.
- If two workers require the same file, orchestration resolves it in a later batch.
- No worker is allowed to "clean up" unrelated code while inside its scope.
- UI-facing changes should keep the product calm and scan-friendly.
- Raw provider data may appear only in fixtures, debug surfaces, or secondary detail views.

## Orchestrator responsibilities

- Keep path ownership disjoint.
- Review each worker result before the next wave launches.
- Spawn queued workers only after freeing agent slots.
- Prevent drift from the five frozen contracts and repo-boundary rule.
