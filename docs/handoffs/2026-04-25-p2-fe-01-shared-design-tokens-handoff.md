# 2026-04-25 P2-FE-01 Shared Design Tokens Handoff

## Current audit step

- Audit source: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Current step: `P2-FE-01. Design tokens consolidation`
- Area: Frontend / design system
- Acceptance: Color/spacing typography tokens documented and reused.

## Closed critic gates before this step

- `P1-OPS-02` incident runbooks: independent critic `GO`
- `P2-DX-01` lint scripts are non-mutating by default: independent critic `GO`
- `P2-DX-02` dependency hygiene: independent critic `GO`
- `P2-DX-03` high-risk layout refactor: independent critic `GO`
- `P2-DX-04` typed route helpers: independent critic `GO` on iteration 2
- `P2-QA-01` critical coverage thresholds: independent critic `GO`
- `P2-QA-02` migration drift detection: independent critic `GO`
- `P2-QA-03` delivery manifest golden fixtures: independent critic `GO`

## What changed for P2-FE-01

- Added shared design token CSS:
  - `packages/ui/src/styles/tokens.css`
- Exported token CSS from `@founderos/ui`:
  - `@founderos/ui/tokens.css`
- Included tokens in existing shell globals path:
  - `packages/ui/src/styles/globals.css` imports `./tokens.css`
  - `apps/shell/apps/web/app/globals.css` continues importing `@founderos/ui/globals.css`
- Reused tokens in work-ui:
  - `apps/work-ui/src/app.css` imports `@founderos/ui/tokens.css`
  - `apps/work-ui/package.json` declares `@founderos/ui`
  - `apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte` now uses shared spacing, radius, typography, mono font, transitions, and status color tokens
- Moved duplicated shell token values for spacing/radius/status/transition/font-heading/font-features to the shared package token layer.
- Added a static guard:
  - `scripts/qa/shared-design-tokens-gate.mjs`
  - root script `qa:shared-design-tokens`
- Added docs:
  - `docs/design/shared-design-tokens.md`
- Refreshed `package-lock.json` with `npm install --package-lock-only --ignore-scripts`.

## Token groups covered

- typography: font family, font scale, line-height
- spacing: `--space-1` through `--space-11`
- radius: control, pill, nav, input, tile, card, runtime-card, hero
- status colors: running, planning, pending, failed, neutral
- transitions: base and fade

## Verification completed

```bash
npm run qa:shared-design-tokens
node --input-type=module -e "console.log(await import.meta.resolve('@founderos/ui/tokens.css'))"
npm run lint --workspace @founderos/ui
npm run typecheck --workspace @founderos/ui
cd /Users/martin/infinity/apps/work-ui && npx eslint src/lib/components/founderos/EmbeddedMetaStrip.svelte
NODE_OPTIONS='--max-old-space-size=1280' npm run check --workspace open-webui
NODE_OPTIONS='--max-old-space-size=1280' npm run lint --workspace open-webui
git diff --check
```

All passed. The existing vite-plugin-svelte warning about
`@sveltejs/svelte-virtual-list` missing a Svelte exports condition appeared
during work-ui checks; `svelte-check` still reported 0 errors and 0 warnings.

## What is not closed by this step

- This is not a broad visual redesign.
- This does not migrate every hardcoded color/spacing value across shell or work-ui.
- This does not force Open WebUI to look like FounderOS; it only gives the embedded bridge surface shared base tokens where useful.

## Commands for next verification

```bash
cd /Users/martin/infinity
npm run qa:shared-design-tokens
npm run lint --workspace @founderos/ui
npm run typecheck --workspace @founderos/ui
NODE_OPTIONS='--max-old-space-size=1280' npm run lint --workspace open-webui
git diff --check
```

## Independent critic gate prompt

```text
You are an independent critic-auditor for /Users/martin/infinity.

Audit step: P2-FE-01. Design tokens consolidation.
Acceptance from /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md:
"Color/spacing typography tokens documented and reused."

Files to inspect:
- packages/ui/src/styles/tokens.css
- packages/ui/src/styles/globals.css
- packages/ui/package.json
- apps/shell/apps/web/app/globals.css
- apps/work-ui/package.json
- apps/work-ui/src/app.css
- apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte
- scripts/qa/shared-design-tokens-gate.mjs
- package.json
- package-lock.json
- docs/design/shared-design-tokens.md
- docs/handoffs/2026-04-25-p2-fe-01-shared-design-tokens-handoff.md

Evidence already observed:
- npm run qa:shared-design-tokens passed
- work-ui import.meta.resolve('@founderos/ui/tokens.css') resolved to packages/ui/src/styles/tokens.css
- npm run lint --workspace @founderos/ui passed
- npm run typecheck --workspace @founderos/ui passed
- npx eslint src/lib/components/founderos/EmbeddedMetaStrip.svelte passed from apps/work-ui
- NODE_OPTIONS='--max-old-space-size=1280' npm run check --workspace open-webui passed
- NODE_OPTIONS='--max-old-space-size=1280' npm run lint --workspace open-webui passed
- git diff --check passed

Review for:
- Does this satisfy P2-FE-01 as a bounded remediation?
- Are color/status, spacing, and typography tokens documented and reused?
- Is the shell still using the existing @founderos/ui globals path?
- Does work-ui reuse the token export without redesigning the whole workspace?
- Are there material blockers, not just future broader token migration wishes?

Return exactly one of:
GO
NO-GO: <specific blockers>
BLOCKER: <specific reason this cannot be evaluated>
```
