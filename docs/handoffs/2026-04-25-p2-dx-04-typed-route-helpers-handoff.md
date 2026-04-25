# Handoff: P2-DX-04 Typed Route Helpers

Repo: `/Users/martin/infinity`
Branch at refresh time: `codex/p0-be-14-staging-smoke`
HEAD at refresh time: `977a499 chore: checkpoint audit hardening work`
Audit plan: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
Current date: 2026-04-25
Current bounded audit step: `P2-DX-04. Typed route helpers and API clients across shell/work-ui` - closed for audit acceptance by independent critic `GO`.

## Source of Truth and Rules

Precedence for this step:
1. `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
2. `/Users/martin/infinity/AGENTS.md`
3. Current implementation evidence inside `/Users/martin/infinity`

Hard rules:
- Reference repos remain read-only.
- Make changes only inside `/Users/martin/infinity`.
- Keep using `critic-loop-profi`; do not advance past a step without an independent critic `GO` or explicit `BLOCKER`.
- Do not run watchers or keep dev servers/browser automation alive after checks.

## Current Audit Step

Audit plan excerpt:

```text
P2-DX-04. Typed route helpers and API clients across shell/work-ui
Area: DX / contracts
Problem: Avoid stringly-typed endpoint paths in work-ui bootstrap/session exchange.
Task: implement the change, update matching tests/docs, do not change unrelated design/runtime areas, preserve current validation gates.
Acceptance criteria: Route builders generated/test-covered.
Checks: focused unit/integration tests + relevant shell/work-ui checks + update validation packet where applicable.
```

Current interpretation:
- The host/workspace launch seam should not hand-build workspace launch endpoint paths in multiple places.
- The bounded scope is the workspace launch route family used by bootstrap, session exchange, and launch-token verification.
- The shared route helper must be test-covered and usable by both shell and work-ui.

## Closed Critic Gates Through P2-DX-04

### P1-OPS-02 Incident runbooks

Status: closed with independent critic `GO`.

Evidence is preserved in:
- `docs/handoffs/2026-04-25-p1-ops-02-incident-runbooks-handoff.md`

### P2-DX-01 Lint scripts

Status: closed with independent critic `GO`.

Evidence is preserved in:
- `docs/handoffs/2026-04-25-p2-dx-01-lint-scripts-handoff.md`

### P2-DX-02 Dependency hygiene

Status: closed with independent critic `GO`.

Evidence is preserved in:
- `docs/handoffs/2026-04-25-p2-dx-02-dependency-hygiene-handoff.md`

### P2-DX-03 Layout refactor

Status: closed with independent critic `GO`.

Evidence is preserved in:
- `docs/handoffs/2026-04-25-p2-dx-03-layout-refactor-handoff.md`

### P2-DX-04 Typed route helpers

Status: closed with independent critic `GO` on iteration 2.

Iteration 1 result:
- `Status: NO-GO`
- Reason: `apps/work-ui/src/lib/founderos/launch.ts` still hardcoded the launch-token verification endpoint.

Iteration 2 result:
- `Status: GO`
- Scope checked: bootstrap, session exchange, and launch-token verification.
- Done: shared route builders are test-covered; work-ui bootstrap/session/launch-token paths use the helper; shell bootstrap uses the helper for `sessionExchangePath`.
- Missing or broken: none.
- Fix items: none.
- Blocker: none.

## P2-DX-04 Work Already Present

Files:
- `packages/api-clients/src/workspace-launch-routes.ts`
- `packages/api-clients/src/workspace-launch-routes.test.ts`
- `packages/api-clients/package.json`
- `packages/api-clients/src/index.ts`
- `apps/shell/apps/web/lib/server/control-plane/workspace/bootstrap.ts`
- `apps/work-ui/package.json`
- `package-lock.json`
- `apps/work-ui/src/lib/founderos/bootstrap.ts`
- `apps/work-ui/src/lib/founderos/bootstrap.test.ts`
- `apps/work-ui/src/lib/founderos/launch.ts`
- `apps/work-ui/src/lib/founderos/launch.test.ts`

Implemented behavior:
- Added shared workspace launch route manifest:
  - `WORKSPACE_LAUNCH_API_ROUTES`
  - `WORKSPACE_LAUNCH_API_BASE_PATH`
- Added typed path/URL builders for:
  - bootstrap;
  - launch token verification;
  - runtime ingest;
  - session exchange;
  - session bearer compatibility route.
- Exported the helpers via:
  - `@founderos/api-clients`
  - `@founderos/api-clients/workspace-launch-routes`
- Added `@founderos/api-clients` as a work-ui workspace dependency and updated `package-lock.json`.
- Updated shell bootstrap to build `sessionExchangePath` through `buildWorkspaceLaunchSessionPath`.
- Updated work-ui bootstrap URL resolution to use `buildWorkspaceLaunchBootstrapUrl`.
- Updated work-ui session exchange fallback URL resolution to use `buildWorkspaceLaunchSessionUrl`.
- Updated work-ui launch-token verification URL resolution to use `buildWorkspaceLaunchTokenUrl`.

## Verification Already Passed

Run from `/Users/martin/infinity`:

```sh
NODE_OPTIONS='--max-old-space-size=1024' node_modules/.bin/vitest run packages/api-clients/src/workspace-launch-routes.test.ts
```

Result: passed, 1 file / 4 tests.

Run from `/Users/martin/infinity`:

```sh
npm run typecheck --workspace @founderos/api-clients
```

Result: passed.

Run from `/Users/martin/infinity`:

```sh
npm run lint --workspace @founderos/api-clients
```

Result: passed.

Run from `/Users/martin/infinity/apps/work-ui`:

```sh
NODE_OPTIONS='--max-old-space-size=1024' npx vitest run src/lib/founderos/bootstrap.test.ts src/lib/founderos/launch.test.ts
```

Result: passed, 2 files / 16 tests.

Run from `/Users/martin/infinity/apps/shell/apps/web`:

```sh
NODE_OPTIONS='--max-old-space-size=1024' npx vitest run 'app/api/control/execution/workspace/[sessionId]/bootstrap/route.test.ts'
```

Result: passed, 1 file / 4 tests.

Run from `/Users/martin/infinity`:

```sh
npm run typecheck --workspace @founderos/web
```

Result: passed.

Run from `/Users/martin/infinity`:

```sh
NODE_OPTIONS='--max-old-space-size=1280' npm run check --workspace open-webui
```

Result: passed. `svelte-check` reported 0 errors and 0 warnings. The command still prints the existing `vite-plugin-svelte` warning about `@sveltejs/svelte-virtual-list` missing a package exports condition.

Run from `/Users/martin/infinity`:

```sh
NODE_OPTIONS='--max-old-space-size=1280' npm run lint --workspace open-webui
```

Result: passed. It runs read-only `eslint .` and `svelte-check`. The same existing `vite-plugin-svelte` warning appears.

Run from `/Users/martin/infinity/apps/shell/apps/web`:

```sh
npx eslint lib/server/control-plane/workspace/bootstrap.ts
```

Result: passed.

Run from `/Users/martin/infinity`:

```sh
npm ci --ignore-scripts --dry-run
```

Result: passed. It printed dry-run package additions and did not modify the lockfile.

Run from `/Users/martin/infinity`:

```sh
rg -n "api/control/execution/workspace" apps/work-ui/src | rg -v "\.test\.ts"
```

Result: no matches after the iteration-1 `NO-GO` fix.

Run from `/Users/martin/infinity`:

```sh
git diff --check
```

Result: passed.

Additional note:
- `npm run lint --workspace @founderos/web` currently fails on pre-existing unrelated shell lint errors outside touched files, including `lib/server/orchestration/artifacts.ts` and `scripts/capture-execution-action-inventory.tsx`. This was not counted as a P2-DX-04 blocker because targeted shell lint and shell typecheck passed for this step.

## What Cannot Be Claimed Closed Yet

Do not over-claim these:
- No full `npm run validate:full` or browser E2E release gate was run for this step.
- The shared route helper covers the workspace launch route family, not every route in the shell or work-ui.
- Tests still include literal expected endpoint strings as fixtures; production work-ui source no longer hardcodes the workspace launch endpoint family.
- Full shell lint remains blocked by unrelated pre-existing lint errors.
- No commit/push was performed by this handoff refresh.

## Next Verification Commands

Run these before advancing if the tree changes after this handoff:

```sh
cd /Users/martin/infinity
NODE_OPTIONS='--max-old-space-size=1024' node_modules/.bin/vitest run packages/api-clients/src/workspace-launch-routes.test.ts
```

```sh
cd /Users/martin/infinity/apps/work-ui
NODE_OPTIONS='--max-old-space-size=1024' npx vitest run src/lib/founderos/bootstrap.test.ts src/lib/founderos/launch.test.ts
```

```sh
cd /Users/martin/infinity
npm run typecheck --workspace @founderos/api-clients
npm run lint --workspace @founderos/api-clients
NODE_OPTIONS='--max-old-space-size=1280' npm run check --workspace open-webui
NODE_OPTIONS='--max-old-space-size=1280' npm run lint --workspace open-webui
git diff --check
```

## Independent Critic Gate Prompt for Re-Run

Use this prompt if the tree changes or a second independent P2-DX-04 gate is required:

```text
You are the independent critic gate for audit step P2-DX-04 in /Users/martin/infinity. Use critic-loop-profi standards. Inspect the repo and evidence, do not edit files, and return exactly one gate result: GO, NO-GO, or BLOCKER.

Scope and rules:
- Current step only: P2-DX-04 typed route helpers and API clients across shell/work-ui.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md, section P2-DX-04.
- Acceptance: route builders generated/test-covered; avoid stringly-typed endpoint paths in work-ui bootstrap/session exchange.
- Reference repos are read-only.
- Do not judge unrelated dirty files unless they break this step.
- Full shell lint is known to fail on pre-existing unrelated lint errors outside touched files; judge targeted shell lint and typecheck evidence for this step unless you find this step introduced a new shell lint issue.

Implementation evidence to inspect:
- packages/api-clients/src/workspace-launch-routes.ts
- packages/api-clients/src/workspace-launch-routes.test.ts
- packages/api-clients/package.json
- packages/api-clients/src/index.ts
- apps/shell/apps/web/lib/server/control-plane/workspace/bootstrap.ts
- apps/work-ui/package.json
- package-lock.json
- apps/work-ui/src/lib/founderos/bootstrap.ts
- apps/work-ui/src/lib/founderos/bootstrap.test.ts
- apps/work-ui/src/lib/founderos/launch.ts
- apps/work-ui/src/lib/founderos/launch.test.ts

Verification already run:
- Shared route-builder vitest: passed.
- @founderos/api-clients typecheck and lint: passed.
- work-ui bootstrap/launch focused vitest: passed.
- shell workspace bootstrap route vitest: passed.
- @founderos/web typecheck: passed.
- open-webui check and lint: passed.
- targeted shell ESLint on workspace bootstrap: passed.
- npm ci --ignore-scripts --dry-run: passed.
- git diff --check: passed.
- non-test work-ui source search for api/control/execution/workspace: no matches.

Return using the critic-loop-profi template and make the first line exactly one of:
Status: GO
Status: NO-GO
Status: BLOCKER
```

## Stop Point for Next Agent

The next agent should:
1. Open `/Users/martin/infinity`.
2. Read this handoff and `docs/handoffs/2026-04-25-p2-dx-03-layout-refactor-handoff.md` if more continuity is needed.
3. Confirm `git status --short`.
4. Continue with `P2-QA-01. Coverage thresholds for critical modules`.
5. Run a bounded implementation pass only.
6. Run targeted verification.
7. Run an independent `critic-loop-profi` gate before marking P2-QA-01 closed.
