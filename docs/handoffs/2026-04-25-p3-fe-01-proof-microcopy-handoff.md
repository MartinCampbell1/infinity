# 2026-04-25 P3-FE-01 Proof Microcopy Handoff

## Current Audit Step

- Step: `P3-FE-01. Microcopy polish for local/prod proof labels`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: copy reviewed; no ambiguous `ready` labels without context.
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

## What Changed In P3-FE-01

- Updated central shell delivery readiness copy:
  - `apps/shell/apps/web/lib/delivery-readiness.ts`
  - `apps/shell/apps/web/lib/delivery-readiness.test.ts`
- Updated shell delivery summary preview/proof labels:
  - `apps/shell/apps/web/components/orchestration/delivery-summary.tsx`
  - `apps/shell/apps/web/components/orchestration/delivery-summary.test.tsx`
- Updated validation board handoff meta copy:
  - `apps/shell/apps/web/app/(shell)/execution/validation/page.tsx`
  - `apps/shell/apps/web/app/(shell)/execution/validation/page.test.tsx`
- Updated work-ui project result copy/test:
  - `apps/work-ui/src/routes/(app)/project-result/[id]/+page.svelte`
  - `apps/work-ui/src/routes/(app)/project-result/project-result-page-structure.test.ts`
- Updated additional work-ui frame badge copy/test after critic review:
  - `apps/work-ui/src/routes/(app)/project-intake/+page.svelte`
  - `apps/work-ui/src/routes/(app)/project-brief/[id]/+page.svelte`
  - `apps/work-ui/src/routes/(app)/project-run/[id]/+page.svelte`
  - `apps/work-ui/src/routes/(app)/founderos-frame-badges-structure.test.ts`
- Updated readiness screenshot fixture expectations:
  - `apps/shell/apps/web/scripts/capture-readiness-proof-screenshots.tsx`

## Copy Policy Applied

- Local proof copy now says `Local runnable proof` / `Local preview proof` and
  repeats that it is not production proof.
- Staging copy says `Staging runnable proof` and names the missing hosted proof
  manifest.
- Production copy says `Production proof complete`, not unqualified
  `handoff ready`.
- Preview card copy is contextual:
  - `Local preview proof` for local preview evidence;
  - `Hosted preview proof` for external hosted preview evidence.
- Validation meta says `production handoff packet` only when the projected
  delivery actually clears production handoff gates.
- Work-ui bare `Ready` labels were replaced with contextual labels:
  - `Ready to verify` for the verification card after assembly exists;
  - `Result loaded` for the page frame badge after data load completes.
  - `Intake form loaded` for the project intake frame badge;
  - `Brief loaded` for the project brief frame badge;
  - `Run loaded` for the project run frame badge.

## Verification Passed

Run from `/Users/martin/infinity/apps/shell/apps/web`.

```bash
npx vitest run lib/delivery-readiness.test.ts components/orchestration/delivery-summary.test.tsx 'app/(shell)/execution/validation/page.test.tsx'
```

Result: passed, 3 files / 14 tests.

Run from `/Users/martin/infinity/apps/work-ui`.

```bash
npm run test:frontend:ci -- --run 'src/routes/(app)/project-result/project-result-page-structure.test.ts' 'src/routes/(app)/founderos-frame-badges-structure.test.ts'
```

Result: passed, 2 files / 4 tests.

Run from `/Users/martin/infinity`.

```bash
rg -n "\? 'Ready'|\? \"Ready\"|badge=\{[^\n]*(?:'Ready'|\"Ready\")" 'apps/work-ui/src/routes/(app)'
```

Result: only negative assertions in structure tests; no visible route-frame
badge source still uses bare `Ready`.

Run from `/Users/martin/infinity`.

```bash
git diff --check
```

Result: passed.

## Not Closed Yet

- No browser visual pass or screenshot regeneration was run; the step is a
  microcopy/test update and resource policy discourages unnecessary browser
  work.
- This does not change readiness semantics or backend proof gates.
- No full shell `npm test` was run. Earlier broad shell test execution in this
  branch hit unrelated visual-regression baseline drift.

## Independent Critic Gate Result

First critic iteration: `NO-GO`.

The critic accepted the shell-side proof tier copy and validation meta gating,
but found two ambiguous work-ui `Ready` labels:

- verification card showed bare `Ready` when assembly existed but verification
  had not run;
- project result frame badge showed bare `Ready` after page load.

Fix applied:

- replaced those labels with `Ready to verify` and `Result loaded`;
- updated the work-ui structure test to assert those contextual labels are
  present and the old bare `? 'Ready'` ternary is absent.

Verification was rerun after the fix and still passed:

- shell focused Vitest: 3 files / 14 tests;
- work-ui project-result structure test: 1 file / 1 test;
- `git diff --check`.

Second critic iteration: `NO-GO`.

The critic accepted the shell-side copy, validation gating, and project-result
fix, but broadened the work-ui route-frame check and found three more visible
bare `Ready` badges:

- `apps/work-ui/src/routes/(app)/project-intake/+page.svelte`
- `apps/work-ui/src/routes/(app)/project-brief/[id]/+page.svelte`
- `apps/work-ui/src/routes/(app)/project-run/[id]/+page.svelte`

Fix applied:

- replaced those labels with `Intake form loaded`, `Brief loaded`, and
  `Run loaded`;
- added `apps/work-ui/src/routes/(app)/founderos-frame-badges-structure.test.ts`
  to assert the contextual labels and forbid the old bare badge patterns.

Verification was rerun after the second fix:

- work-ui structure tests: 2 files / 4 tests;
- targeted `rg` for bare route-frame `Ready` badge patterns: only negative
  assertions remain in tests;
- `git diff --check`.

Third critic iteration: `GO`.

The critic accepted the bounded P3-FE-01 implementation:

- shell proof-tier copy is explicit and non-overclaiming;
- delivery summary distinguishes local preview proof from hosted preview proof;
- validation board only shows `production handoff packet` when production
  handoff gates are satisfied;
- work-ui visible frame badges no longer use bare `Ready` copy;
- tests assert contextual labels and forbid the old bare badge patterns.

The critic could not rerun Vitest inside its read-only sandbox because Vitest
writes temp/cache files, but it accepted the recorded focused verification and
confirmed `git diff --check`. Optional non-blocking note: fix the indentation
of the local `sidebarDescription` line in
`apps/shell/apps/web/lib/delivery-readiness.ts` before final formatting if this
batch later runs a formatter.

## Next Verification Commands

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run lib/delivery-readiness.test.ts components/orchestration/delivery-summary.test.tsx 'app/(shell)/execution/validation/page.test.tsx'

cd /Users/martin/infinity/apps/work-ui
npm run test:frontend:ci -- --run 'src/routes/(app)/project-result/project-result-page-structure.test.ts' 'src/routes/(app)/founderos-frame-badges-structure.test.ts'

cd /Users/martin/infinity
rg -n "\? 'Ready'|\? \"Ready\"|badge=\{[^\n]*(?:'Ready'|\"Ready\")" 'apps/work-ui/src/routes/(app)'
git diff --check
```

## Independent Critic Gate Prompt

```text
You are an independent critic-auditor for /Users/martin/infinity.

Use critic-loop-profi semantics and return exactly one gate status: GO, NO-GO, or BLOCKER.

Scope:
- Audit step: P3-FE-01. Microcopy polish for local/prod proof labels.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: Copy reviewed; no ambiguous `ready` labels without context.
- Current gate type: implementation/pre-commit gate for the in-flight remediation batch. Do not require a git commit in HEAD for this gate; verify changed files/tests are present, tested, committable, and honest about non-closed browser/full-suite work.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.

Implementation evidence to inspect:
- apps/shell/apps/web/lib/delivery-readiness.ts
- apps/shell/apps/web/lib/delivery-readiness.test.ts
- apps/shell/apps/web/components/orchestration/delivery-summary.tsx
- apps/shell/apps/web/components/orchestration/delivery-summary.test.tsx
- apps/shell/apps/web/app/(shell)/execution/validation/page.tsx
- apps/shell/apps/web/app/(shell)/execution/validation/page.test.tsx
- apps/work-ui/src/routes/(app)/project-result/[id]/+page.svelte
- apps/work-ui/src/routes/(app)/project-result/project-result-page-structure.test.ts
- apps/work-ui/src/routes/(app)/project-intake/+page.svelte
- apps/work-ui/src/routes/(app)/project-brief/[id]/+page.svelte
- apps/work-ui/src/routes/(app)/project-run/[id]/+page.svelte
- apps/work-ui/src/routes/(app)/founderos-frame-badges-structure.test.ts
- apps/shell/apps/web/scripts/capture-readiness-proof-screenshots.tsx
- docs/handoffs/2026-04-25-p3-fe-01-proof-microcopy-handoff.md

Verification already run:
- npx vitest run lib/delivery-readiness.test.ts components/orchestration/delivery-summary.test.tsx 'app/(shell)/execution/validation/page.test.tsx'
- npm run test:frontend:ci -- --run 'src/routes/(app)/project-result/project-result-page-structure.test.ts' 'src/routes/(app)/founderos-frame-badges-structure.test.ts'
- rg -n "\? 'Ready'|\? \"Ready\"|badge=\{[^\n]*(?:'Ready'|\"Ready\")" 'apps/work-ui/src/routes/(app)'
- git diff --check

Question:
Does P3-FE-01 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

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
