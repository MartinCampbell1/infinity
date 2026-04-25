# 2026-04-25 P2-FE-03 Actionable Empty States Handoff

## Current Audit Step

- Step: `P2-FE-03. Empty states for no runs/no tasks/no deliveries`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: all major routes have actionable empty states.
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

## What Changed In P2-FE-03

- Added a structured empty-state action to:
  - `apps/shell/apps/web/components/execution/autonomous-record-board.tsx`
- New type:
  - `AutonomousBoardEmptyAction`
- Behavior:
  - Empty board states now render a real action button.
  - If a route does not pass a custom action, the default action links to `/execution` with label `Open execution hub`.
- Added route-specific empty actions to major execution listing routes:
  - `runs`: `Open execution hub`
  - `tasks`: `Open planner`
  - `deliveries`: `Open validation`
  - `events`: `Open runs`
  - `previews`: `Open deliveries`
  - `validation`: `Open runs`
  - `spec`: `Open execution hub`
  - `planner`: `Open specs`
  - `issues`: `Open recoveries`
  - `refusals`: `Open recoveries`
- The route-specific links preserve shell route scope through existing route helpers.
- Added focused coverage in:
  - `apps/shell/apps/web/components/execution/autonomous-record-board.test.tsx`
- Updated existing route test mock in:
  - `apps/shell/apps/web/app/(shell)/execution/deliveries/page.test.tsx`

## Verification Passed

Run from `/Users/martin/infinity` unless noted.

```bash
cd apps/shell/apps/web && npx vitest run components/execution/autonomous-record-board.test.tsx 'app/(shell)/execution/deliveries/page.test.tsx'
```

Result: passed, 4 tests across 2 files.

```bash
cd apps/shell/apps/web && npx eslint components/execution/autonomous-record-board.tsx components/execution/autonomous-record-board.test.tsx 'app/(shell)/execution/deliveries/page.test.tsx' 'app/(shell)/execution/runs/page.tsx' 'app/(shell)/execution/tasks/page.tsx' 'app/(shell)/execution/deliveries/page.tsx' 'app/(shell)/execution/events/page.tsx' 'app/(shell)/execution/previews/page.tsx' 'app/(shell)/execution/validation/page.tsx' 'app/(shell)/execution/spec/page.tsx' 'app/(shell)/execution/planner/page.tsx' 'app/(shell)/execution/issues/page.tsx' 'app/(shell)/execution/refusals/page.tsx'
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

- No browser screenshot review was performed for empty states.
- This step covers major listing routes that use `AutonomousRecordBoard`; custom detail pages may still have their own empty-state UX.
- No visual-regression baseline was approved or refreshed.

## Next Verification Commands

Use the focused commands first:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run components/execution/autonomous-record-board.test.tsx 'app/(shell)/execution/deliveries/page.test.tsx'
npx eslint components/execution/autonomous-record-board.tsx components/execution/autonomous-record-board.test.tsx 'app/(shell)/execution/deliveries/page.test.tsx' 'app/(shell)/execution/runs/page.tsx' 'app/(shell)/execution/tasks/page.tsx' 'app/(shell)/execution/deliveries/page.tsx' 'app/(shell)/execution/events/page.tsx' 'app/(shell)/execution/previews/page.tsx' 'app/(shell)/execution/validation/page.tsx' 'app/(shell)/execution/spec/page.tsx' 'app/(shell)/execution/planner/page.tsx' 'app/(shell)/execution/issues/page.tsx' 'app/(shell)/execution/refusals/page.tsx'
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
- Audit step: P2-FE-03. Empty states for no runs/no tasks/no deliveries.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: all major routes have actionable empty states.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.

Implementation evidence to inspect:
- apps/shell/apps/web/components/execution/autonomous-record-board.tsx
- apps/shell/apps/web/components/execution/autonomous-record-board.test.tsx
- apps/shell/apps/web/app/(shell)/execution/runs/page.tsx
- apps/shell/apps/web/app/(shell)/execution/tasks/page.tsx
- apps/shell/apps/web/app/(shell)/execution/deliveries/page.tsx
- apps/shell/apps/web/app/(shell)/execution/events/page.tsx
- apps/shell/apps/web/app/(shell)/execution/previews/page.tsx
- apps/shell/apps/web/app/(shell)/execution/validation/page.tsx
- apps/shell/apps/web/app/(shell)/execution/spec/page.tsx
- apps/shell/apps/web/app/(shell)/execution/planner/page.tsx
- apps/shell/apps/web/app/(shell)/execution/issues/page.tsx
- apps/shell/apps/web/app/(shell)/execution/refusals/page.tsx
- apps/shell/apps/web/app/(shell)/execution/deliveries/page.test.tsx
- docs/handoffs/2026-04-25-p2-fe-03-actionable-empty-states-handoff.md

Verification already run:
- cd apps/shell/apps/web && npx vitest run components/execution/autonomous-record-board.test.tsx 'app/(shell)/execution/deliveries/page.test.tsx'
- cd apps/shell/apps/web && npx eslint components/execution/autonomous-record-board.tsx components/execution/autonomous-record-board.test.tsx 'app/(shell)/execution/deliveries/page.test.tsx' 'app/(shell)/execution/runs/page.tsx' 'app/(shell)/execution/tasks/page.tsx' 'app/(shell)/execution/deliveries/page.tsx' 'app/(shell)/execution/events/page.tsx' 'app/(shell)/execution/previews/page.tsx' 'app/(shell)/execution/validation/page.tsx' 'app/(shell)/execution/spec/page.tsx' 'app/(shell)/execution/planner/page.tsx' 'app/(shell)/execution/issues/page.tsx' 'app/(shell)/execution/refusals/page.tsx'
- NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
- git diff --check

Question:
Does P2-FE-03 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

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
