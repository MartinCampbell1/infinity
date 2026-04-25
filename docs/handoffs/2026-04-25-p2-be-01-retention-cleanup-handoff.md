# 2026-04-25 P2-BE-01 Retention Cleanup Handoff

## Current Audit Step

- Step: `P2-BE-01. Background job cleanup/retention`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: retention jobs documented and tested.
- Repo boundary: all edits are inside `/Users/martin/infinity`; reference repos remain read-only.

## Closed Critic Gates Before This Step

- `P1-OPS-02` incident runbooks: independent critic gate `GO`
- `P2-DX-01` lint scripts: independent critic gate `GO`
- `P2-DX-02` dependency hygiene: independent critic gate `GO`
- `P2-DX-03` layout refactor: independent critic gate `GO`
- `P2-DX-04` typed route helpers: first critic `NO-GO`, fixed, rerun `GO`
- `P2-QA-01` critical coverage thresholds: independent critic gate `GO`
- `P2-QA-02` migration drift detection: independent critic gate `GO`
- `P2-QA-03` delivery manifest fixtures: independent critic gate `GO`
- `P2-FE-01` shared design tokens: independent critic gate `GO`
- `P2-FE-02` loading skeletons and retry states: independent critic gate `GO`
- `P2-FE-03` actionable empty states: independent critic gate `GO`
- `P2-FE-04` execution error boundary: independent critic gate `GO`

## What Changed In P2-BE-01

- Added shell-owned orchestration retention planner and apply helper:
  - `apps/shell/apps/web/lib/server/orchestration/retention.ts`
- Added a protected retention job endpoint:
  - `apps/shell/apps/web/app/api/control/orchestration/retention/route.ts`
- Extended service-token scope for the retention producer route:
  - `apps/shell/apps/web/lib/server/http/control-plane-auth.ts`
- Added focused tests:
  - `apps/shell/apps/web/lib/server/orchestration/retention.test.ts`
  - `apps/shell/apps/web/lib/server/http/control-plane-auth.test.ts`
- Added ops documentation:
  - `docs/ops/control-plane-retention.md`

## Behavior

- The route defaults to dry-run.
- State cleanup can remove expired failed preview records and expired failed handoff packets.
- Stale shell-side agent-session mirrors are marked `failed` and an `agent.session.retention_recovered` run event is appended.
- Filesystem cleanup only runs when both `dryRun:false` and `applyFilesystem:true` are provided.
- Local artifact deletion is restricted to the configured orchestration artifact roots.
- Ready and delivered delivery artifacts are preserved by the shell retention job.
- Production object-store lifecycle remains the durable artifact retention source of truth.
- Execution-kernel attempt leases remain owned by the kernel; this shell job only cleans stale shell-side mirrors.

## Verification Passed

Run from `/Users/martin/infinity/apps/shell/apps/web` unless noted.

```bash
npx vitest run lib/server/orchestration/retention.test.ts lib/server/http/control-plane-auth.test.ts
```

Result: passed, 11 tests.

```bash
npx eslint lib/server/orchestration/retention.ts lib/server/orchestration/retention.test.ts app/api/control/orchestration/retention/route.ts lib/server/http/control-plane-auth.ts lib/server/http/control-plane-auth.test.ts
```

Result: passed.

From repo root:

```bash
NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
```

Result: passed.

```bash
git diff --check
```

Result: passed.

## Not Closed Yet

- The retention endpoint was tested through direct route invocation, not through a deployed scheduler.
- No live production object-store lifecycle rule was created or verified.
- No execution-kernel API was changed in this step; existing kernel lease recovery remains the lease-owner boundary.
- No full shell `npm test` was run. Earlier broad shell test execution in this branch hit visual-regression baseline drift unrelated to this slice.

## Independent Critic Gate Result

- Result: `GO`
- Critic note: optional documentation clarity could mention that actor headers are injected by the `/api/control/*` proxy/middleware.
- Blocker: none.

## Next Verification Commands

Focused checks:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run lib/server/orchestration/retention.test.ts lib/server/http/control-plane-auth.test.ts
npx eslint lib/server/orchestration/retention.ts lib/server/orchestration/retention.test.ts app/api/control/orchestration/retention/route.ts lib/server/http/control-plane-auth.ts lib/server/http/control-plane-auth.test.ts
```

Root checks:

```bash
cd /Users/martin/infinity
NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
git diff --check
```

## Independent Critic Gate Prompt

```text
You are an independent critic-auditor for /Users/martin/infinity.

Use critic-loop-profi semantics and return exactly one gate status: GO, NO-GO, or BLOCKER.

Scope:
- Audit step: P2-BE-01. Background job cleanup/retention.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: retention jobs documented and tested.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.

Implementation evidence to inspect:
- apps/shell/apps/web/lib/server/orchestration/retention.ts
- apps/shell/apps/web/lib/server/orchestration/retention.test.ts
- apps/shell/apps/web/app/api/control/orchestration/retention/route.ts
- apps/shell/apps/web/lib/server/http/control-plane-auth.ts
- apps/shell/apps/web/lib/server/http/control-plane-auth.test.ts
- docs/ops/control-plane-retention.md
- docs/handoffs/2026-04-25-p2-be-01-retention-cleanup-handoff.md

Verification already run:
- cd apps/shell/apps/web && npx vitest run lib/server/orchestration/retention.test.ts lib/server/http/control-plane-auth.test.ts
- cd apps/shell/apps/web && npx eslint lib/server/orchestration/retention.ts lib/server/orchestration/retention.test.ts app/api/control/orchestration/retention/route.ts lib/server/http/control-plane-auth.ts lib/server/http/control-plane-auth.test.ts
- NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
- git diff --check

Question:
Does P2-BE-01 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

Return:
Status: GO | NO-GO | BLOCKER
Scope checked:
Done:
Partial:
Missing or broken:
Shortcut or disguised manual step:
Evidence checked:
Fix items:
Blocker:
```
