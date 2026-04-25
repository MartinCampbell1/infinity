# 2026-04-25 P3-FE-04 Theme Consistency Handoff

## Current Audit Step

- Step: `P3-FE-04. Theme consistency between shell and work-ui`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: shared dark theme tokens; visual seams reduced.
- Repo boundary: all edits are inside `/Users/martin/infinity`; reference repos remain read-only.
- Resource rule: no watchers, no dev servers, no full repo checks for this bounded polish step.

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
- `P3-FE-02` stage motion polish: independent critic gate `GO`
- `P3-FE-03` keyboard shortcut help overlay: independent critic gate `GO`

## What Changed In P3-FE-04

- Added shared FounderOS dark seam tokens in `packages/ui/src/styles/tokens.css`:
  - shell background, content, card, border, control, hover, muted, topbar, primary, and focus ring tokens;
  - embedded workspace background, panel, glass, border, foreground, muted, subtle, and hover tokens.
- Rewired shell global dark variables in `apps/shell/apps/web/app/globals.css` to consume the shared seam tokens while preserving the existing dark shell palette.
- Replaced the embedded work-ui root and launch failure seam classes in `apps/work-ui/src/routes/(app)/+layout.svelte` with CSS variable-backed FounderOS workspace classes.
- Replaced raw slate/RGB styling in `apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte` with the shared workspace tokens for the banner, pills, borders, action, hover, and text surfaces.
- Added focused static coverage in `apps/work-ui/src/routes/(app)/founderos-theme-consistency-structure.test.ts`.

## Verification Passed

Run from `/Users/martin/infinity/apps/work-ui`:

```bash
npm run test:frontend:ci -- --run 'src/routes/(app)/founderos-theme-consistency-structure.test.ts'
```

Result: passed, 1 file / 4 tests.

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
rg -n "bg-\[#08101f\]|text-slate-100|bg-slate-900/80|rgb\(15 23 42|rgb\(248 250 252|rgb\(226 232 240|rgb\(255 255 255 / 0\.06\)|shell-nav-active-border, rgba" 'apps/work-ui/src/routes/(app)/+layout.svelte' apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte
```

Result: no matches.

## Independent Critic Gate Status

Status: `GO`.

The built-in subagent tool did not produce a valid gate result in this run:

- first read-only critic returned only a generic AGENTS rules acknowledgement;
- second read-only critic returned only a generic AGENTS rules acknowledgement;
- third full-history critic timed out and was closed;
- fourth short-context critic timed out and was closed.

The gate was then rerun through a separate read-only, ephemeral `codex exec`
process with `-m gpt-5.4`. That independent critic inspected the audit plan,
scoped git diff, changed files, runtime token import path, handoff evidence,
`git diff --check`, and the targeted old-seam grep.

Critic result: `GO`.

Critic fix items: none.

Critic blocker: none.

## Not Closed By This Step

- No browser visual pass was run; this bounded step used source-level guards and resource policy discourages extra browser/dev-server work unless needed.
- No full shell or full work-ui suite was run.
- This does not migrate every hardcoded color in Open WebUI. It narrows the host/workspace seam where the embedded app meets the FounderOS shell.

## Independent Critic Gate Prompt

```text
You are an independent critic-auditor for /Users/martin/infinity.

Use critic-loop-profi semantics and return exactly one gate status: GO, NO-GO, or BLOCKER.

Scope:
- Audit step: P3-FE-04. Theme consistency between shell and work-ui.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: Shared dark theme tokens; visual seams reduced.
- Current gate type: implementation/pre-commit gate for the in-flight remediation batch. Do not require a git commit in HEAD for this gate; verify changed files/tests are present, tested, committable, and honest about non-closed browser/full-suite work.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.

Implementation evidence to inspect:
- packages/ui/src/styles/tokens.css
- apps/shell/apps/web/app/globals.css
- apps/work-ui/src/routes/(app)/+layout.svelte
- apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte
- apps/work-ui/src/routes/(app)/founderos-theme-consistency-structure.test.ts
- docs/handoffs/2026-04-25-p3-fe-04-theme-consistency-handoff.md

Verification already run:
- npm run test:frontend:ci -- --run 'src/routes/(app)/founderos-theme-consistency-structure.test.ts' from apps/work-ui passed, 1 file / 4 tests.
- npm run qa:shared-design-tokens passed.
- git diff --check passed.

Question:
Does P3-FE-04 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

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
