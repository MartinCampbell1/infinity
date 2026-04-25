# 2026-04-25 P3-FE-02 Stage Motion Handoff

## Current Audit Step

- Step: `P3-FE-02. Animation/motion polish for stage transitions`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: transitions do not harm performance/accessibility.
- Repo boundary: all edits are inside `/Users/martin/infinity`; reference repos remain read-only.
- Skills used: `frontend-ui-engineering`, `critic-loop-profi`

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
- `P2-BE-03` pagination/filtering/search consistency: independent critic gate `GO`
- `P2-BE-04` structured error response standard: independent critic gate `GO`
- `P2-OPS-01` SBOM and dependency vulnerability scanning: independent critic gate `GO`
- `P2-OPS-02` release checklist automation: independent critic gate `GO`
- `P2-DOC-01` developer onboarding guide: independent critic gate `GO`
- `P2-DOC-02` architecture diagrams: first critic `NO-GO` on literal commit finalization, rerun implementation/pre-commit gate `GO`
- `P2-DOC-03` security model document: independent critic gate `GO`
- `P3-FE-01` proof microcopy: two critic `NO-GO` iterations fixed, third critic `GO`

## What Changed In P3-FE-02

- Added scoped motion classes to the primary run stage strip:
  - `apps/shell/apps/web/components/execution/primary-run-surface.tsx`
- Added subtle transition CSS for stage strip, labels, dots, and connectors:
  - `apps/shell/apps/web/app/globals.css`
- Added a reduced-motion fallback that removes transition duration and active-dot transform:
  - `@media (prefers-reduced-motion: reduce)`
- Added active-step semantics and stable data hooks:
  - `data-run-stage-strip`
  - `data-stage-state`
  - `aria-current="step"`
  - `data-stage-connector-state`
- Updated focused tests to assert the stage hooks and reduced-motion CSS:
  - `apps/shell/apps/web/components/execution/primary-run-surface.test.tsx`

## Motion Policy Applied

- No JavaScript animation loop.
- No watcher, browser, or dev server.
- No layout-affecting size changes; active dot uses `transform: scale(1.15)`.
- Reduced-motion users get `transition-duration: 0ms` and `transform: none`.
- Motion is scoped to the primary run stage strip rather than shared globally.

## Verification Passed

Run from `/Users/martin/infinity/apps/shell/apps/web`.

```bash
npx vitest run components/execution/primary-run-surface.test.tsx
```

Result: passed, 1 file / 3 tests.

Run from `/Users/martin/infinity`.

```bash
rg -n "run-stage-|prefers-reduced-motion|data-run-stage-strip|data-stage-state|aria-current" apps/shell/apps/web/components/execution/primary-run-surface.tsx apps/shell/apps/web/components/execution/primary-run-surface.test.tsx apps/shell/apps/web/app/globals.css
git diff --check
```

Result: stage hooks/CSS found; `git diff --check` passed.

## Not Closed Yet

- No browser visual pass or screenshot regeneration was run; this is a bounded
  CSS/test polish step and resource policy discourages unnecessary browser work.
- No full shell `npm test` was run. Earlier broad shell test execution in this
  branch hit unrelated visual-regression baseline drift.
- This does not change runtime stage truth, stage ordering, delivery readiness,
  or backend behavior.

## Independent Critic Gate Result

Critic iteration: `GO`.

The critic accepted the bounded P3-FE-02 implementation:

- motion is CSS-only and scoped to `.run-stage-*` elements;
- transitions use safe properties for this small stage strip;
- reduced-motion fallback disables transition duration and removes active-dot
  transform;
- stable stage hooks and `aria-current="step"` are present;
- focused tests assert the hooks and reduced-motion CSS;
- no browser visual pass or full-suite run is explicitly disclosed and accepted
  for this resource-bounded polish gate.

## Next Verification Commands

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run components/execution/primary-run-surface.test.tsx

cd /Users/martin/infinity
rg -n "run-stage-|prefers-reduced-motion|data-run-stage-strip|data-stage-state|aria-current" apps/shell/apps/web/components/execution/primary-run-surface.tsx apps/shell/apps/web/components/execution/primary-run-surface.test.tsx apps/shell/apps/web/app/globals.css
git diff --check
```

## Independent Critic Gate Prompt

```text
You are an independent critic-auditor for /Users/martin/infinity.

Use critic-loop-profi semantics and return exactly one gate status: GO, NO-GO, or BLOCKER.

Scope:
- Audit step: P3-FE-02. Animation/motion polish for stage transitions.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: Transitions do not harm performance/accessibility.
- Current gate type: implementation/pre-commit gate for the in-flight remediation batch. Do not require a git commit in HEAD for this gate; verify changed files/tests are present, tested, committable, and honest about non-closed browser/full-suite work.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.
- Read-only critic note: do not rerun Vitest in a read-only sandbox if it would write temp/cache files; inspect the recorded command/output and source/tests instead unless your environment is writable.

Implementation evidence to inspect:
- apps/shell/apps/web/components/execution/primary-run-surface.tsx
- apps/shell/apps/web/components/execution/primary-run-surface.test.tsx
- apps/shell/apps/web/app/globals.css
- docs/handoffs/2026-04-25-p3-fe-02-stage-motion-handoff.md

Verification already run:
- npx vitest run components/execution/primary-run-surface.test.tsx
- rg -n "run-stage-|prefers-reduced-motion|data-run-stage-strip|data-stage-state|aria-current" apps/shell/apps/web/components/execution/primary-run-surface.tsx apps/shell/apps/web/components/execution/primary-run-surface.test.tsx apps/shell/apps/web/app/globals.css
- git diff --check

Question:
Does P3-FE-02 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

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
