# 2026-04-25 P2-BE-03 Pagination Filtering Search Handoff

## Current Audit Step

- Step: `P2-BE-03. Pagination/filtering/search consistency`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: directory endpoints support cursor pagination and filters.
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
- `P2-BE-02` directory pagination and cache: independent critic gate `GO`

## What Changed In P2-BE-03

- Extended shared directory helpers:
  - `apps/shell/apps/web/lib/server/http/directory-pagination.ts`
  - added exact filter normalization, `q/search/query` aliases, and case-insensitive search matching.
- Extended tests for the shared helper:
  - `apps/shell/apps/web/lib/server/http/directory-pagination.test.ts`
- Added filter-before-pagination behavior to sessions:
  - `apps/shell/apps/web/app/api/shell/execution/sessions/route.ts`
  - `apps/shell/apps/web/app/api/shell/execution/sessions/route.test.ts`
- Added filter-before-pagination behavior to events:
  - `apps/shell/apps/web/app/api/shell/execution/events/route.ts`
  - `apps/shell/apps/web/app/api/shell/execution/events/route.test.ts`
- Added filter-before-pagination behavior to agents:
  - `apps/shell/apps/web/app/api/shell/execution/agents/route.ts`
  - `apps/shell/apps/web/app/api/shell/execution/agents/route.test.ts`
- Extended response models with optional filter/page metadata:
  - `apps/shell/apps/web/lib/execution-events-model.ts`
  - `apps/shell/apps/web/lib/execution-agents-shared.ts`
- Wired frontend route consumers to the scalable endpoints:
  - `apps/shell/apps/web/app/(shell)/execution/events/page.tsx`
  - `apps/shell/apps/web/app/(shell)/execution/agents/page.tsx`
  - `apps/shell/apps/web/components/execution/execution-agents-workspace.tsx`

## Behavior

- `/api/shell/execution/sessions` supports cursor pagination plus:
  - `q`, `search`, or `query`
  - `project_id`, `session_id`, `group_id`, `account_id`, `workspace_id`
  - `status`, `provider`, `recovery_state`, `quota_pressure`, `archived`
- `/api/shell/execution/events` supports cursor pagination plus:
  - `q`, `search`, or `query`
  - `project_id`, `group_id`, `orchestrator_session_id`, `runtime_agent_id`
  - `initiative_id`, `orchestrator`, `kind`/`event`, `status`, `source`, `provider`
- `/api/shell/execution/agents` supports cursor pagination plus:
  - `q`, `search`, or `query`
  - `project_id`, `runtime_agent_id`/`agent_id`, `status`, `role`, `provider`
- Filtering happens before pagination, so `pageInfo.totalItems` reflects filtered result size.
- `/execution/events` now uses the existing execution events workspace surface and passes route filter params to the endpoint-backed feed.
- `/execution/agents` now lets the client fetch the route-scoped/search-filtered endpoint instead of relying on an initial unfiltered SSR snapshot.

## Verification Passed

Run from `/Users/martin/infinity/apps/shell/apps/web` unless noted.

```bash
npx vitest run lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.test.ts
```

Result: passed, 19 tests.

```bash
npx eslint lib/server/http/directory-pagination.ts lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.ts app/api/shell/execution/agents/route.test.ts app/'(shell)'/execution/events/page.tsx app/'(shell)'/execution/agents/page.tsx components/execution/execution-agents-workspace.tsx lib/execution-events-model.ts lib/execution-agents-shared.ts
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
- Scope checked: P2-BE-03 pagination/filtering/search consistency for directory endpoints.
- Evidence checked: helper, sessions/events/agents routes, focused route tests, response models, events/agents frontend consumers, this handoff, and the P2-BE-03 source-of-truth acceptance criteria.
- Non-blocking fix item: response naming is not fully uniform across endpoints (`pageInfo`/`filters` vs `agentsPageInfo`/`agentsFilters`), but behavior and cursor contract are consistent.
- Non-blocking follow-up: UI does not yet expose `nextCursor` controls; the bounded acceptance criteria only required directory endpoints to support cursor pagination and filters.

## Not Closed Yet

- Cursor pagination remains offset-backed and opaque. This satisfies the current bounded acceptance criteria, but keyset cursors would be a later hardening item if live Postgres directories grow substantially.
- Directory response naming is behaviorally consistent but not yet generic-client uniform across sessions/events/agents.
- UI route consumers can request filtered endpoint data, but visible next-page controls are still a later frontend enhancement.
- `/execution/sessions` server-rendered board still reads the local session summaries directly; this step closes the directory API contract and wires events/agents frontend consumers.
- No browser/dev-server visual pass was run because this step was backend/API focused and resource rules discourage unnecessary runtime checks.
- No full shell `npm test` was run. Earlier broad shell test execution in this branch hit unrelated visual-regression baseline drift.

## Next Verification Commands

Focused checks:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.test.ts
npx eslint lib/server/http/directory-pagination.ts lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.ts app/api/shell/execution/agents/route.test.ts app/'(shell)'/execution/events/page.tsx app/'(shell)'/execution/agents/page.tsx components/execution/execution-agents-workspace.tsx lib/execution-events-model.ts lib/execution-agents-shared.ts
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
- Audit step: P2-BE-03. Pagination/filtering/search consistency.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: directory endpoints support cursor pagination and filters.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.

Implementation evidence to inspect:
- apps/shell/apps/web/lib/server/http/directory-pagination.ts
- apps/shell/apps/web/lib/server/http/directory-pagination.test.ts
- apps/shell/apps/web/app/api/shell/execution/sessions/route.ts
- apps/shell/apps/web/app/api/shell/execution/sessions/route.test.ts
- apps/shell/apps/web/app/api/shell/execution/events/route.ts
- apps/shell/apps/web/app/api/shell/execution/events/route.test.ts
- apps/shell/apps/web/app/api/shell/execution/agents/route.ts
- apps/shell/apps/web/app/api/shell/execution/agents/route.test.ts
- apps/shell/apps/web/lib/execution-events-model.ts
- apps/shell/apps/web/lib/execution-agents-shared.ts
- apps/shell/apps/web/app/(shell)/execution/events/page.tsx
- apps/shell/apps/web/app/(shell)/execution/agents/page.tsx
- apps/shell/apps/web/components/execution/execution-agents-workspace.tsx
- docs/handoffs/2026-04-25-p2-be-03-pagination-filtering-search-handoff.md

Verification already run:
- cd apps/shell/apps/web && npx vitest run lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.test.ts
- cd apps/shell/apps/web && npx eslint lib/server/http/directory-pagination.ts lib/server/http/directory-pagination.test.ts app/api/shell/execution/events/route.ts app/api/shell/execution/events/route.test.ts app/api/shell/execution/sessions/route.ts app/api/shell/execution/sessions/route.test.ts app/api/shell/execution/agents/route.ts app/api/shell/execution/agents/route.test.ts app/'(shell)'/execution/events/page.tsx app/'(shell)'/execution/agents/page.tsx components/execution/execution-agents-workspace.tsx lib/execution-events-model.ts lib/execution-agents-shared.ts
- NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
- git diff --check

Question:
Does P2-BE-03 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

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
