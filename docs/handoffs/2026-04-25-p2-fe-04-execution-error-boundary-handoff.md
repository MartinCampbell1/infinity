# 2026-04-25 P2-FE-04 Execution Error Boundary Handoff

## Current Audit Step

- Step: `P2-FE-04. Error boundaries around run/detail surfaces`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: error boundary shows recovery and logs link.
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

## What Changed In P2-FE-04

- Added a reusable execution route error surface:
  - `apps/shell/apps/web/components/execution/execution-route-error-boundary.tsx`
- Added the Next route segment error boundary:
  - `apps/shell/apps/web/app/(shell)/execution/error.tsx`
- Behavior:
  - The `/execution` route subtree now has a client error boundary.
  - A failing execution route renders a recovery surface instead of blanking the shell.
  - The surface includes:
    - `Retry surface` reset button
    - `Open recoveries` link to `/execution/recoveries`
    - `Open event logs` link to `/execution/events`
    - sanitized error message and optional digest
- Added focused coverage:
  - `apps/shell/apps/web/components/execution/execution-route-error-boundary.test.tsx`

## Verification Passed

Run from `/Users/martin/infinity` unless noted.

```bash
cd apps/shell/apps/web && npx vitest run components/execution/execution-route-error-boundary.test.tsx
```

Result: passed, 1 test.

```bash
cd apps/shell/apps/web && npx eslint components/execution/execution-route-error-boundary.tsx components/execution/execution-route-error-boundary.test.tsx 'app/(shell)/execution/error.tsx'
```

Result: passed.

```bash
NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
```

Result: passed.

```bash
git diff --check
```

Result: passed.

## Not Closed Yet

- No browser-triggered runtime error was used to visually inspect the boundary.
- No screenshot or visual-regression baseline was approved or refreshed.
- This boundary is route-segment scoped for `/execution`; it does not add custom per-detail error copy to every child route.

## Next Verification Commands

Use the focused commands first:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run components/execution/execution-route-error-boundary.test.tsx
npx eslint components/execution/execution-route-error-boundary.tsx components/execution/execution-route-error-boundary.test.tsx 'app/(shell)/execution/error.tsx'
```

Then from repo root:

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
- Audit step: P2-FE-04. Error boundaries around run/detail surfaces.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: error boundary shows recovery and logs link.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.

Implementation evidence to inspect:
- apps/shell/apps/web/components/execution/execution-route-error-boundary.tsx
- apps/shell/apps/web/components/execution/execution-route-error-boundary.test.tsx
- apps/shell/apps/web/app/(shell)/execution/error.tsx
- docs/handoffs/2026-04-25-p2-fe-04-execution-error-boundary-handoff.md

Verification already run:
- cd apps/shell/apps/web && npx vitest run components/execution/execution-route-error-boundary.test.tsx
- cd apps/shell/apps/web && npx eslint components/execution/execution-route-error-boundary.tsx components/execution/execution-route-error-boundary.test.tsx 'app/(shell)/execution/error.tsx'
- NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
- git diff --check

Question:
Does P2-FE-04 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

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
