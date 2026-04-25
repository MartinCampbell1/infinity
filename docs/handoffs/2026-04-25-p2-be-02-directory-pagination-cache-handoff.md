# 2026-04-25 P2-BE-02 Directory Pagination And Cache Handoff

## Current Audit Step

- Step: `P2-BE-02. Cache strategy for read-heavy directory pages`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: pagination, indexes, and caching for directory endpoints.
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
- `P2-BE-01` retention cleanup: independent critic gate `GO`

## What Changed In P2-BE-02

- Added shared directory pagination/cache helpers:
  - `apps/shell/apps/web/lib/server/http/directory-pagination.ts`
- Added helper tests:
  - `apps/shell/apps/web/lib/server/http/directory-pagination.test.ts`
- Added cursor pagination and private cache headers to shell execution directory endpoints:
  - `apps/shell/apps/web/app/api/shell/execution/events/route.ts`
  - `apps/shell/apps/web/app/api/shell/execution/sessions/route.ts`
  - `apps/shell/apps/web/app/api/shell/execution/agents/route.ts`
- Updated endpoint tests:
  - `apps/shell/apps/web/app/api/shell/execution/events/route.test.ts`
  - `apps/shell/apps/web/app/api/shell/execution/sessions/route.test.ts`
  - `apps/shell/apps/web/app/api/shell/execution/agents/route.test.ts`
- Extended response models with optional page metadata:
  - `apps/shell/apps/web/lib/execution-events-model.ts`
  - `apps/shell/apps/web/lib/execution-agents-shared.ts`
- Added Postgres directory read indexes:
  - `apps/shell/apps/web/db/migrations/control-plane/004_directory_read_indexes.sql`
  - updated `apps/shell/apps/web/db/migrations/control-plane/manifest.json`
  - updated `apps/shell/apps/web/db/migrations/control-plane/schema-snapshot.json`

## Behavior

- `/api/shell/execution/events` now supports `limit` and opaque `cursor`.
- `/api/shell/execution/sessions` now supports `limit` and opaque `cursor`.
- `/api/shell/execution/agents` now supports `limit` and opaque `cursor` for the agents list.
- Directory endpoints emit private cache headers:
  - `Cache-Control: private, max-age=15, stale-while-revalidate=45`
  - `ETag`
  - `Vary: authorization, cookie`
- Index migration adds read-path indexes for session lists, event lists, and audit-event chronology.

## Verification Passed

Run from `/Users/martin/infinity/apps/shell/apps/web` unless noted.

```bash
npx vitest run lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.test.ts
```

Result: passed, 14 tests.

```bash
node --test ./scripts/control-plane-schema-drift.test.mjs
```

Result: passed, 3 tests.

```bash
npx eslint lib/server/http/directory-pagination.ts lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.ts app/api/shell/execution/agents/route.test.ts lib/execution-events-model.ts lib/execution-agents-shared.ts
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

## Independent Critic Gate Result

- Status: `GO`
- Scope checked: P2-BE-02 directory endpoint pagination, read indexes, and cache headers for sessions, events, and agents.
- Evidence checked: helper, route implementations, route tests, response models, migration files, manifest/snapshot, and this handoff.
- Non-blocking fix item: sessions/events currently pass `generatedAt = new Date().toISOString()` into the ETag hash, so the ETag is time-versioned. Short-lived private caching works for this bounded step, but unchanged reads will not generally produce stable conditional `304` behavior.

## Not Closed Yet

- No live Postgres migration was applied; only migration files, manifest, snapshot, and schema drift unit tests were updated.
- Cursor pagination is offset-backed and opaque, not keyset-backed. That is acceptable for this bounded step; broader consistency/search behavior belongs to `P2-BE-03`.
- Existing UI pages do not yet expose pagination controls. This step closes endpoint behavior, not frontend pagination UX.
- ETag freshness can be improved by deriving the hash from dataset freshness, such as latest `updated_at` or latest `event_ts`, instead of wall-clock response time.
- No full shell `npm test` was run. Earlier broad shell test execution in this branch hit visual-regression baseline drift unrelated to this slice.

## Next Verification Commands

Focused checks:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.test.ts
node --test ./scripts/control-plane-schema-drift.test.mjs
npx eslint lib/server/http/directory-pagination.ts lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.ts app/api/shell/execution/agents/route.test.ts lib/execution-events-model.ts lib/execution-agents-shared.ts
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
- Audit step: P2-BE-02. Cache strategy for read-heavy directory pages.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: pagination, indexes, and caching for directory endpoints.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.

Implementation evidence to inspect:
- apps/shell/apps/web/lib/server/http/directory-pagination.ts
- apps/shell/apps/web/lib/server/http/directory-pagination.test.ts
- apps/shell/apps/web/app/api/shell/execution/events/route.ts
- apps/shell/apps/web/app/api/shell/execution/events/route.test.ts
- apps/shell/apps/web/app/api/shell/execution/sessions/route.ts
- apps/shell/apps/web/app/api/shell/execution/sessions/route.test.ts
- apps/shell/apps/web/app/api/shell/execution/agents/route.ts
- apps/shell/apps/web/app/api/shell/execution/agents/route.test.ts
- apps/shell/apps/web/lib/execution-events-model.ts
- apps/shell/apps/web/lib/execution-agents-shared.ts
- apps/shell/apps/web/db/migrations/control-plane/004_directory_read_indexes.sql
- apps/shell/apps/web/db/migrations/control-plane/manifest.json
- apps/shell/apps/web/db/migrations/control-plane/schema-snapshot.json
- docs/handoffs/2026-04-25-p2-be-02-directory-pagination-cache-handoff.md

Verification already run:
- cd apps/shell/apps/web && npx vitest run lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.test.ts
- cd apps/shell/apps/web && node --test ./scripts/control-plane-schema-drift.test.mjs
- cd apps/shell/apps/web && npx eslint lib/server/http/directory-pagination.ts lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.ts app/api/shell/execution/agents/route.test.ts lib/execution-events-model.ts lib/execution-agents-shared.ts
- NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
- git diff --check

Question:
Does P2-BE-02 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

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
