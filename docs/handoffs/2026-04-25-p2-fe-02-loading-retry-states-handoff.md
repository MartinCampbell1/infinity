# 2026-04-25 P2-FE-02 Loading Skeletons and Retry States Handoff

## Current Audit Step

- Step: `P2-FE-02. Loading skeletons and optimistic states`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: key cards and drawers have skeletons and retry buttons.
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

## What Changed In P2-FE-02

- Added reusable shell loading and retry primitives in:
  - `apps/shell/apps/web/components/shell/shell-screen-primitives.tsx`
- New primitives:
  - `ShellSkeletonBlock`
  - `ShellSkeletonCard`
  - `ShellSkeletonCardGrid`
  - `ShellRetryButton`
- Wired initial loading skeleton cards into:
  - `apps/shell/apps/web/components/execution/execution-agents-workspace.tsx`
  - `apps/shell/apps/web/components/execution/execution-agent-workspace.tsx`
  - `apps/shell/apps/web/components/execution/execution-handoffs-workspace.tsx`
- Wired explicit retry buttons into error paths for:
  - agents runtime board load failures
  - runtime-agent detail load failures
  - handoff queue load failures
- Added focused regression coverage:
  - `apps/shell/apps/web/components/execution/execution-loading-states.test.tsx`

## Verification Passed

Run from `/Users/martin/infinity` unless noted.

```bash
cd apps/shell/apps/web && npx vitest run components/execution/execution-loading-states.test.tsx
```

Result: passed, 5 tests.

```bash
cd apps/shell/apps/web && npx eslint components/shell/shell-screen-primitives.tsx components/execution/execution-agents-workspace.tsx components/execution/execution-agent-workspace.tsx components/execution/execution-handoffs-workspace.tsx components/execution/execution-loading-states.test.tsx
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

## Verification Caveat

An incorrect command was briefly run:

```bash
npm run --workspace @founderos/web test -- components/execution/execution-loading-states.test.tsx
```

That package script ignores the single-file target and starts the broader shell test sequence. It reached `test:visual-regression` and failed on existing approved screenshot hash drift for:

- `delivery-preview-expired`
- `delivery-production-ready`
- `execution-record-board`

This is not a focused P2-FE-02 validator. It remains a broader visual-baseline question and should not be reported as green until the visual owner intentionally reviews and refreshes or fixes the approved baselines.

## Not Closed Yet

- No browser screenshot review was performed for the new skeleton states.
- No visual-regression baseline was approved or refreshed.
- The implementation covers key execution cards/list-detail surfaces, not every loading state in the shell.
- No optimistic mutation state was added for write actions; this slice focused on pending load states and retry actions for read surfaces.

## Next Verification Commands

Use the focused commands first:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run components/execution/execution-loading-states.test.tsx
npx eslint components/shell/shell-screen-primitives.tsx components/execution/execution-agents-workspace.tsx components/execution/execution-agent-workspace.tsx components/execution/execution-handoffs-workspace.tsx components/execution/execution-loading-states.test.tsx
```

Then from repo root:

```bash
cd /Users/martin/infinity
NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
git diff --check
```

Only run visual regression deliberately:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npm run test:visual-regression
```

If visual regression is run, treat changed screenshot hashes as a separate visual approval gate.

## Independent Critic Gate Prompt

```text
You are an independent critic-auditor for /Users/martin/infinity.

Use critic-loop-profi semantics and return exactly one gate status: GO, NO-GO, or BLOCKER.

Scope:
- Audit step: P2-FE-02. Loading skeletons and optimistic states.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: key cards/drawers have skeletons and retry buttons.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.

Implementation evidence to inspect:
- apps/shell/apps/web/components/shell/shell-screen-primitives.tsx
- apps/shell/apps/web/components/execution/execution-agents-workspace.tsx
- apps/shell/apps/web/components/execution/execution-agent-workspace.tsx
- apps/shell/apps/web/components/execution/execution-handoffs-workspace.tsx
- apps/shell/apps/web/components/execution/execution-loading-states.test.tsx
- docs/handoffs/2026-04-25-p2-fe-02-loading-retry-states-handoff.md

Verification already run:
- cd apps/shell/apps/web && npx vitest run components/execution/execution-loading-states.test.tsx
- cd apps/shell/apps/web && npx eslint components/shell/shell-screen-primitives.tsx components/execution/execution-agents-workspace.tsx components/execution/execution-agent-workspace.tsx components/execution/execution-handoffs-workspace.tsx components/execution/execution-loading-states.test.tsx
- NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
- git diff --check

Known caveat:
- An accidental full package test reached visual regression and failed on existing screenshot hash drift. Do not treat that as a focused P2-FE-02 green signal. Decide whether it is material to this bounded step or a separate visual-baseline gate.

Question:
Does P2-FE-02 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

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
