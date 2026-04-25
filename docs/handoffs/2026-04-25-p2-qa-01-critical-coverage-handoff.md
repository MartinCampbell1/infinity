# Handoff: P2-QA-01 Critical Coverage Gate

Repo: `/Users/martin/infinity`
Branch at refresh time: `codex/p0-be-14-staging-smoke`
HEAD at refresh time: `977a499 chore: checkpoint audit hardening work`
Audit plan: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
Current date: 2026-04-25
Current bounded audit step: `P2-QA-01. Coverage thresholds for critical modules` - closed for audit acceptance by independent critic `GO`.

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
P2-QA-01. Coverage thresholds for critical modules
Area: QA
Problem: Add coverage gates for auth, state, delivery, kernel scheduler.
Task: implement the change, update matching tests/docs, do not change unrelated design/runtime areas, preserve current validation gates.
Acceptance criteria: Coverage thresholds fail CI if critical modules untested.
Checks: focused unit/integration tests + relevant shell/work-ui checks + update validation packet where applicable.
```

Current interpretation:
- This is a bounded CI gate for critical module test coverage.
- The repo does not currently include Vitest line/branch coverage instrumentation, and the Go kernel toolchain is heavier than a normal local bounded step.
- The implemented gate is therefore a fail-closed critical-module coverage threshold: each declared critical module must have present source files, present test files, and test signals.

## Closed Critic Gates Through P2-QA-01

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

Status: closed with independent critic `GO` after one fix loop.

Evidence is preserved in:
- `docs/handoffs/2026-04-25-p2-dx-04-typed-route-helpers-handoff.md`

### P2-QA-01 Critical coverage

Status: closed with independent critic `GO`.

Critic result summary:
- `Status: GO`
- Scope checked: CI must fail when critical modules are untested, using the manifest-based fail-closed approach.
- Done: critical-module coverage gate, self-tests, CI workflow, root scripts, and docs are present.
- Missing or broken: none for P2-QA-01 acceptance.
- Shortcut or disguised manual step: manifest-based module coverage is documented as not line/branch instrumentation; critic accepted it as satisfying the bounded acceptance.
- Fix items: none.
- Blocker: none.

## P2-QA-01 Work Already Present

Files:
- `scripts/qa/critical-coverage-gate.mjs`
- `scripts/qa/critical-coverage-gate.test.mjs`
- `docs/qa/critical-coverage.md`
- `.github/workflows/critical-coverage.yml`
- `package.json`

Implemented behavior:
- Added root script:
  - `qa:critical-coverage`
- Added root self-test script:
  - `qa:critical-coverage:test`
- Added CI workflow:
  - `.github/workflows/critical-coverage.yml`
- The workflow runs on pull requests and pushes to `main` / `master`.
- The workflow runs `npm ci`, then the gate self-test, then the gate.
- The gate enforces 100% module coverage for:
  - `control-plane-auth`
  - `control-plane-state`
  - `delivery`
  - `kernel-scheduler`
- A module is covered only if all declared source files exist, all declared test files exist, and every declared test file includes a JS/TS test signal or Go `func Test...` signal.

## Verification Already Passed

Run from `/Users/martin/infinity`:

```sh
npm run qa:critical-coverage:test
```

Result: passed, 2 node:test tests.

Run from `/Users/martin/infinity`:

```sh
npm run qa:critical-coverage
```

Result:

```text
Critical coverage gate
- control-plane-auth: 100% module coverage (3/3), required 100%
- control-plane-state: 100% module coverage (3/3), required 100%
- delivery: 100% module coverage (4/4), required 100%
- kernel-scheduler: 100% module coverage (4/4), required 100%
Status: PASS
```

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
- This is not Vitest or Go line/branch coverage instrumentation.
- This does not prove every behavior inside the critical modules is tested.
- This does not run the critical test suites themselves; it enforces the fail-closed source-to-test map in CI.
- No full `npm run validate:full` or browser E2E release gate was run for this step.
- No commit/push was performed by this handoff refresh.

## Next Verification Commands

Run these before advancing if the tree changes after this handoff:

```sh
cd /Users/martin/infinity
npm run qa:critical-coverage:test
npm run qa:critical-coverage
git diff --check
```

## Independent Critic Gate Prompt for Re-Run

Use this prompt if the tree changes or a second independent P2-QA-01 gate is required:

```text
You are the independent critic gate for audit step P2-QA-01 in /Users/martin/infinity. Use critic-loop-profi standards. Inspect the repo and evidence, do not edit files, and return exactly one gate result: GO, NO-GO, or BLOCKER.

Scope and rules:
- Current step only: P2-QA-01 coverage thresholds for critical modules.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md, section P2-QA-01.
- Acceptance: coverage thresholds fail CI if critical modules are untested.
- Reference repos are read-only.
- Do not judge unrelated dirty files unless they break this step.
- The implementation uses a fail-closed critical-module coverage manifest instead of line/branch instrumentation. Judge whether this satisfies the bounded P2-QA-01 acceptance.

Implementation evidence to inspect:
- scripts/qa/critical-coverage-gate.mjs
- scripts/qa/critical-coverage-gate.test.mjs
- docs/qa/critical-coverage.md
- .github/workflows/critical-coverage.yml
- package.json

Verification already run:
- npm run qa:critical-coverage:test: passed, 2 node:test tests.
- npm run qa:critical-coverage: passed with 100% module coverage for control-plane-auth, control-plane-state, delivery, and kernel-scheduler.
- git diff --check: passed.

Return using the critic-loop-profi template and make the first line exactly one of:
Status: GO
Status: NO-GO
Status: BLOCKER
```

## Stop Point for Next Agent

The next agent should:
1. Open `/Users/martin/infinity`.
2. Read this handoff and `docs/handoffs/2026-04-25-p2-dx-04-typed-route-helpers-handoff.md` if more continuity is needed.
3. Confirm `git status --short`.
4. Continue with `P2-QA-02. Migration drift detection`.
5. Run a bounded implementation pass only.
6. Run targeted verification.
7. Run an independent `critic-loop-profi` gate before marking P2-QA-02 closed.
