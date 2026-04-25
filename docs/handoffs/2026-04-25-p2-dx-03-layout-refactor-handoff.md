# Handoff: P2-DX-03 Work-UI Layout Refactor

Repo: `/Users/martin/infinity`
Branch at refresh time: `codex/p0-be-14-staging-smoke`
HEAD at refresh time: `977a499 chore: checkpoint audit hardening work`
Audit plan: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
Current date: 2026-04-25
Current bounded audit step: `P2-DX-03. Refactor large Svelte layout into smaller modules` - closed for audit acceptance by independent critic `GO`.

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
P2-DX-03. Refactor large Svelte layout into smaller modules
Area: Frontend maintainability
Problem: apps/work-ui/src/routes/(app)/+layout.svelte is very large and mixes auth/bootstrap/UI/shortcuts.
Task: implement the change, update matching tests/docs, do not change unrelated design/runtime areas, preserve current validation gates.
Acceptance criteria: Split into composables/stores/components with tests preserved.
Checks: focused unit/integration tests + relevant shell/work-ui checks + update validation packet where applicable.
```

Current interpretation:
- This step does not require a full redesign or total decomposition of the route layout.
- It requires a bounded extraction of isolated layout responsibilities into smaller test-covered modules.
- Existing route behavior, embedded mode, and standalone mode must keep working.

## Closed Critic Gates Through P2-DX-03

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

Critic result summary:
- `Status: GO`
- Scope checked: P2-DX-03 only.
- Done: shell return routing and workspace keyboard shortcut logic were extracted into test-covered modules.
- Partial: layout remains large at 748 lines, but the audit acceptance has no fixed line-count threshold.
- Missing or broken: none found for the P2-DX-03 acceptance.
- Shortcut or disguised manual step: none found.
- Fix items: none.
- Blocker: none.

## P2-DX-03 Work Already Present

Files:
- `apps/work-ui/src/routes/(app)/+layout.svelte`
- `apps/work-ui/src/lib/founderos/shell-return.ts`
- `apps/work-ui/src/lib/founderos/shell-return.test.ts`
- `apps/work-ui/src/lib/composables/workspace-keyboard-shortcuts.ts`
- `apps/work-ui/src/lib/composables/workspace-keyboard-shortcuts.test.ts`

Implemented behavior:
- Moved FounderOS shell return routing out of the Svelte layout into `resolveFounderosShellReturnPath`.
- Added tests for scoped workspace return paths, encoded session IDs, source-board fallbacks, and null fallback behavior.
- Moved global workspace keyboard shortcut matching, handling, and listener cleanup into `workspace-keyboard-shortcuts.ts`.
- Added tests for:
  - shortcut matching across meta/ctrl keys;
  - search shortcut store mutation;
  - escape shortcut closing modal stores;
  - Hermes-only temporary chat behavior while preserving FounderOS launch scope;
  - keydown listener registration and cleanup.
- Updated the layout to register keyboard shortcuts through `registerWorkspaceKeyboardShortcuts`.
- Updated `onDestroy` to call the extracted keyboard shortcut cleanup function.
- Reduced `apps/work-ui/src/routes/(app)/+layout.svelte` from 884 lines to 748 lines.

## Verification Already Passed

Run from `/Users/martin/infinity`:

```sh
NODE_OPTIONS='--max-old-space-size=1024' npx vitest run \
  src/lib/founderos/shell-return.test.ts \
  src/lib/composables/workspace-keyboard-shortcuts.test.ts \
  src/lib/founderos/navigation.test.ts \
  src/lib/founderos/bridge.test.ts \
  src/lib/founderos/bootstrap.test.ts
```

Result: passed, 5 files / 30 tests.

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

Run from `/Users/martin/infinity`:

```sh
git diff --check
```

Result: passed.

Independent critic gate:

```sh
codex exec --ignore-user-config --cd /Users/martin/infinity --sandbox read-only --ephemeral -m gpt-5.2
```

Result: `Status: GO`.

## What Cannot Be Claimed Closed Yet

Do not over-claim these:
- No full `npm run validate:full` or browser E2E release gate was run for this step.
- The route layout is smaller and less mixed, but it is not fully decomposed; auth/bootstrap/store side effects still live in the layout.
- No browser runtime smoke was run for this step.
- No commit/push was performed by this handoff refresh.
- The existing `vite-plugin-svelte` warning about `@sveltejs/svelte-virtual-list` was not fixed in this step.

## Next Verification Commands

Run these before advancing if the tree changes after this handoff:

```sh
cd /Users/martin/infinity
NODE_OPTIONS='--max-old-space-size=1024' npx vitest run \
  src/lib/founderos/shell-return.test.ts \
  src/lib/composables/workspace-keyboard-shortcuts.test.ts \
  src/lib/founderos/navigation.test.ts \
  src/lib/founderos/bridge.test.ts \
  src/lib/founderos/bootstrap.test.ts
```

```sh
cd /Users/martin/infinity
NODE_OPTIONS='--max-old-space-size=1280' npm run check --workspace open-webui
```

```sh
cd /Users/martin/infinity
NODE_OPTIONS='--max-old-space-size=1280' npm run lint --workspace open-webui
```

```sh
cd /Users/martin/infinity
git diff --check
```

## Independent Critic Gate Prompt for Re-Run

Use this prompt if the tree changes or a second independent P2-DX-03 gate is required:

```text
You are the independent critic gate for audit step P2-DX-03 in /Users/martin/infinity. Use critic-loop-profi standards. Inspect the repo and evidence, do not edit files, and return exactly one gate result: GO, NO-GO, or BLOCKER.

Scope and rules:
- Current step only: P2-DX-03 layout refactor.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md, section P2-DX-03.
- Acceptance: apps/work-ui/src/routes/(app)/+layout.svelte must be split into smaller composables/stores/components with tests preserved.
- Reference repos are read-only.
- Do not judge unrelated dirty files unless they break this step.
- Do not require a specific line-count threshold unless the audit plan states one.

Implementation evidence to inspect:
- apps/work-ui/src/routes/(app)/+layout.svelte
- apps/work-ui/src/lib/founderos/shell-return.ts
- apps/work-ui/src/lib/founderos/shell-return.test.ts
- apps/work-ui/src/lib/composables/workspace-keyboard-shortcuts.ts
- apps/work-ui/src/lib/composables/workspace-keyboard-shortcuts.test.ts

Verification already run:
- Targeted vitest run for shell-return, workspace-keyboard-shortcuts, and adjacent FounderOS bridge/navigation/bootstrap tests: passed, 5 files / 30 tests.
- NODE_OPTIONS='--max-old-space-size=1280' npm run check --workspace open-webui: passed.
- NODE_OPTIONS='--max-old-space-size=1280' npm run lint --workspace open-webui: passed.
- git diff --check: passed.

Return using the critic-loop-profi template and make the first line exactly one of:
Status: GO
Status: NO-GO
Status: BLOCKER
```

## Stop Point for Next Agent

The next agent should:
1. Open `/Users/martin/infinity`.
2. Read this handoff, then `docs/handoffs/2026-04-25-p2-dx-02-dependency-hygiene-handoff.md` if more continuity is needed.
3. Confirm `git status --short`.
4. Continue with `P2-DX-04. Typed route helpers and API clients across shell/work-ui`.
5. Run a bounded implementation pass only.
6. Run targeted verification.
7. Run an independent `critic-loop-profi` gate before marking P2-DX-04 closed.
