# 2026-04-25 P3-FE-05 Icon Density Handoff

## Current Audit Step

- Step: `P3-FE-05. Better icon consistency and density tuning`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: design QA approves density.
- Repo boundary: all edits are inside `/Users/martin/infinity`; reference repos remain read-only.
- Resource rule: no watchers, no dev servers, no browser/full-suite checks for this bounded polish step.

## Closed Critic Gates Before This Step

- `P3-FE-04` theme consistency between shell and work-ui: independent critic `GO`

## What Changed In P3-FE-05

- Added shared density tokens in `packages/ui/src/styles/tokens.css`:
  - compact control heights;
  - small/medium/large icon sizes;
  - toolbar gap and horizontal padding tokens.
- Added shell density utility classes in `apps/shell/apps/web/app/globals.css`:
  - `shell-topbar-brand-button`;
  - `shell-topbar-icon-button`;
  - `shell-topbar-action-button`;
  - `shell-icon-sm`, `shell-icon-md`, `shell-icon-lg`.
- Updated shell topbar controls in `apps/shell/apps/web/components/shell/shell-frame.tsx` to use the shared density classes instead of repeated ad hoc `h-10/w-10`, `rounded-full`, `rounded-[14px]`, and mixed icon-size classes.
- Added focused static coverage in `apps/shell/apps/web/components/shell/shell-frame.test.tsx`.
- Added design QA approval artifact:
  - `docs/design/shell-topbar-density-qa.md`

## Verification Passed

Run from `/Users/martin/infinity/apps/shell/apps/web`:

```bash
npx vitest run components/shell/shell-frame.test.tsx
```

Result: passed, 1 file / 6 tests.

Run from `/Users/martin/infinity`:

```bash
npm run qa:shared-design-tokens
```

Result: `Shared design token gate passed.`

Run from `/Users/martin/infinity`:

```bash
git diff --check
```

Result: passed with no output.

Run from `/Users/martin/infinity`:

```bash
rg -n "inline-flex h-10 w-10|inline-flex h-10 items-center gap-2|flex h-9 w-9 items-center justify-center rounded-2xl|rounded-full bg-sky-500/85 text-white" apps/shell/apps/web/components/shell/shell-frame.tsx
```

Result: no matches.

Design QA artifact:

```text
docs/design/shell-topbar-density-qa.md
```

Verdict: `APPROVED` for the bounded shell topbar density slice.

## Independent Critic Gate Result

Status: `GO`.

The first independent critic iteration returned `NO-GO` because the initial
evidence lacked an explicit design-QA density approval artifact. After adding
`docs/design/shell-topbar-density-qa.md` and extending
`scripts/qa/shared-design-tokens-gate.mjs` to cover density tokens, the rerun
returned `GO`.

Critic fix items after rerun: none.

Critic blocker after rerun: none.

## Not Closed By This Step

- No browser visual pass was run; this step uses a source-backed design QA
  artifact for the bounded topbar density slice.
- No full shell suite was run.
- This does not retune every execution board card. It closes the bounded shell topbar icon/density inconsistency where the most visible ad hoc icon controls were mixed.

## Independent Critic Gate Prompt

```text
You are an independent critic-auditor for /Users/martin/infinity.

Use critic-loop-profi semantics and return exactly one gate status: GO, NO-GO, or BLOCKER.

Scope:
- Audit step: P3-FE-05. Better icon consistency and density tuning.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: Design QA approves density.
- Current gate type: implementation/pre-commit gate for the in-flight remediation batch. Do not require a git commit in HEAD for this gate; verify changed files/tests are present, tested, committable, and honest about non-closed browser/full-suite work.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.

Implementation evidence to inspect:
- packages/ui/src/styles/tokens.css
- apps/shell/apps/web/app/globals.css
- apps/shell/apps/web/components/shell/shell-frame.tsx
- apps/shell/apps/web/components/shell/shell-frame.test.tsx
- docs/design/shell-topbar-density-qa.md
- docs/handoffs/2026-04-25-p3-fe-05-icon-density-handoff.md

Verification already run:
- npx vitest run components/shell/shell-frame.test.tsx from apps/shell/apps/web passed, 1 file / 6 tests.
- npm run qa:shared-design-tokens passed.
- git diff --check passed.
- targeted old-topbar-class grep returned no matches.
- docs/design/shell-topbar-density-qa.md records design QA `APPROVED`.

Question:
Does P3-FE-05 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

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
