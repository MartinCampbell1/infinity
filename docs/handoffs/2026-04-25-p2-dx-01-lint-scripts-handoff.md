# Handoff: P2-DX-01 Lint Scripts

Repo: `/Users/martin/infinity`
Branch at refresh time: `codex/p0-be-14-staging-smoke`
HEAD at refresh time: `977a499 chore: checkpoint audit hardening work`
Audit plan: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
Current date: 2026-04-25
Current bounded audit step: `P2-DX-01. Remove eslint --fix from CI lint scripts` - closed for audit acceptance by independent critic `GO`.

## Source of Truth and Rules

Precedence for this step:
1. `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
2. `/Users/martin/infinity/AGENTS.md`
3. Current implementation evidence inside `/Users/martin/infinity`

Hard rules:
- Reference repos remain read-only:
  - `/Users/martin/FounderOS`
  - `/Users/martin/open-webui`
  - `/Users/martin/hermes-webui`
  - external `cabinet` snapshots
- Make changes only inside `/Users/martin/infinity`.
- Keep using `critic-loop-profi`; do not advance past a step without an independent critic `GO` or explicit `BLOCKER`.
- Do not run watchers or keep dev servers/browser automation alive after checks.

## Current Audit Step

Audit plan excerpt:

```text
P2-DX-01. Remove eslint --fix from CI lint scripts
Area: DX / CI
Problem: lint:frontend mutates files; CI lint must be read-only.
Task: implement the change, update matching tests/docs, do not change unrelated design/runtime areas, preserve current validation gates.
Acceptance criteria: Separate lint and lint:fix; CI uses read-only lint.
Checks: focused unit/integration tests + relevant shell/work-ui checks + update validation packet where applicable.
```

Current interpretation:
- The default lint entrypoint for `apps/work-ui` must be read-only and runnable.
- The mutating `--fix` path must be isolated behind `lint:fix`.
- This step does not require a broad lint-style cleanup or new lint rules.

## Closed Critic Gates Through P2-DX-01

### P1-OPS-02 Incident runbooks

Status: closed with independent critic `GO`.

Evidence is preserved in:
- `docs/handoffs/2026-04-25-p1-ops-02-incident-runbooks-handoff.md`

### P2-DX-01 Lint scripts

Status: closed with independent critic `GO`.

Critic iterations:
1. First independent critic returned `NO-GO`.
   - Finding: `lint` had been made read-only but was not a usable default/CI entrypoint because it still chained `lint:backend = pylint backend/`; the local scaffold has no `apps/work-ui/backend` directory and `pylint` was not evidenced.
   - Fix applied: default `lint` now runs only frontend lint plus type lint; backend lint remains separate/manual.
2. Second critic response had all-clear content but left the placeholder status line `Status: GO | NO-GO | BLOCKER`; this was not counted as a valid gate.
3. Final adjudication critic returned `Status: GO`.

Final critic result summary:
- `Status: GO`
- Scope checked: P2-DX-01 `lint` vs `lint:fix` contract in `apps/work-ui`.
- Done: `lint` is read-only and contains no `--fix`; `lint:fix` is the only mutating script; backend lint is separate/manual.
- Partial: none.
- Missing or broken: none against stated acceptance.
- Fix items: none.
- Blocker: none.

## P2-DX-01 Work Already Present

Files:
- `apps/work-ui/package.json`
- `apps/work-ui/.eslintrc.cjs`

Implemented behavior:
- `apps/work-ui` scripts now separate default lint and fix lint:
  - `lint`: `npm run lint:frontend && npm run lint:types`
  - `lint:fix`: `npm run lint:frontend -- --fix`
  - `lint:frontend`: `eslint .`
- `lint:backend` remains available as a separate manual script, but is not part of default/CI lint because the local scaffold has no backend directory.
- Added `apps/work-ui/.eslintrc.cjs` so `eslint .` is runnable locally:
  - ignores `.svelte-kit/**`, `.turbo/**`, `build/**`, and `node_modules/**`;
  - parses JS/TS/Svelte;
  - connects `@typescript-eslint` so existing inline disable comments resolve;
  - intentionally avoids introducing a broad style-rule sweep.

## Verification Already Passed

Run from `/Users/martin/infinity`:

```sh
NODE_OPTIONS='--max-old-space-size=1280' npm run lint --workspace open-webui
```

Result:
- `eslint .` passed.
- `svelte-check` passed with 0 errors and 0 warnings.
- Existing non-blocking warning observed from `vite-plugin-svelte`: `@sveltejs/svelte-virtual-list` has a `svelte` field but no `exports` condition for `svelte`.

Run from `/Users/martin/infinity`:

```sh
node - <<'NODE'
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync('apps/work-ui/package.json', 'utf8'));
const scripts = pkg.scripts || {};
const failures = [];
if (scripts.lint !== 'npm run lint:frontend && npm run lint:types') failures.push(`lint script is ${scripts.lint}`);
if (scripts['lint:frontend'] !== 'eslint .') failures.push(`lint:frontend script is ${scripts['lint:frontend']}`);
if (scripts['lint:fix'] !== 'npm run lint:frontend -- --fix') failures.push(`lint:fix script is ${scripts['lint:fix']}`);
for (const name of ['lint', 'lint:frontend']) {
  if ((scripts[name] || '').includes('--fix')) failures.push(`${name} contains --fix`);
}
if (!(scripts['lint:fix'] || '').includes('--fix')) failures.push('lint:fix does not contain --fix');
if ((scripts.lint || '').includes('lint:backend')) failures.push('lint includes backend lint despite missing backend scaffold');
if (!fs.existsSync('apps/work-ui/.eslintrc.cjs')) failures.push('apps/work-ui/.eslintrc.cjs missing');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('P2-DX-01 lint script contract OK');
NODE
```

Result: `P2-DX-01 lint script contract OK`.

Run from `/Users/martin/infinity`:

```sh
rg -n -- "--fix|lint:backend|eslint \.$" apps/work-ui/package.json apps/work-ui/.eslintrc.cjs
```

Result:
- `--fix` appears only in `lint:fix`.
- `lint:backend` remains separate from default `lint`.

Run from `/Users/martin/infinity`:

```sh
git diff --check
```

Result: passed.

## What Cannot Be Claimed Closed Yet

Do not over-claim these:
- No full `npm run validate:full` or browser E2E release gate was run for this step.
- No GitHub Actions workflow was added for work-ui lint; current repo search did not show a workflow invoking work-ui lint.
- The added ESLint config is intentionally minimal and validates parseability/default lint plumbing. It is not a comprehensive style policy.
- `lint:backend` is still a manual script and is not validated in this local scaffold.
- No commit/push was performed by this handoff refresh.

## Next Verification Commands

Run these before advancing if the tree changes after this handoff:

```sh
cd /Users/martin/infinity
NODE_OPTIONS='--max-old-space-size=1280' npm run lint --workspace open-webui
```

```sh
cd /Users/martin/infinity
node - <<'NODE'
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync('apps/work-ui/package.json', 'utf8'));
const scripts = pkg.scripts || {};
const failures = [];
if (scripts.lint !== 'npm run lint:frontend && npm run lint:types') failures.push(`lint script is ${scripts.lint}`);
if (scripts['lint:frontend'] !== 'eslint .') failures.push(`lint:frontend script is ${scripts['lint:frontend']}`);
if (scripts['lint:fix'] !== 'npm run lint:frontend -- --fix') failures.push(`lint:fix script is ${scripts['lint:fix']}`);
for (const name of ['lint', 'lint:frontend']) {
  if ((scripts[name] || '').includes('--fix')) failures.push(`${name} contains --fix`);
}
if (!(scripts['lint:fix'] || '').includes('--fix')) failures.push('lint:fix does not contain --fix');
if ((scripts.lint || '').includes('lint:backend')) failures.push('lint includes backend lint despite missing backend scaffold');
if (!fs.existsSync('apps/work-ui/.eslintrc.cjs')) failures.push('apps/work-ui/.eslintrc.cjs missing');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('P2-DX-01 lint script contract OK');
NODE
```

```sh
cd /Users/martin/infinity
git diff --check
```

## Independent Critic Gate Prompt for Re-Run

Use this prompt if the tree changes or a second independent P2-DX-01 gate is required:

```text
You are the independent critic gate for audit step P2-DX-01 in /Users/martin/infinity. Use critic-loop-profi standards. Inspect the repo and evidence, do not edit files, and return exactly one gate result: GO, NO-GO, or BLOCKER.

Scope and rules:
- Current step only: P2-DX-01 remove eslint --fix from CI/default lint scripts.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md, section P2-DX-01.
- Acceptance: separate lint and lint:fix; CI/default lint uses read-only lint.
- Reference repos are read-only.
- Do not judge unrelated old scaffold gaps unless they break this step.

Implementation evidence to inspect:
- apps/work-ui/package.json
- apps/work-ui/.eslintrc.cjs

Verification already run:
- NODE_OPTIONS='--max-old-space-size=1280' npm run lint --workspace open-webui: passed.
- Static lint-script assertion: passed.
- git diff --check: passed.

Return using the critic-loop-profi template and make the first line exactly one of:
Status: GO
Status: NO-GO
Status: BLOCKER
```

## Stop Point for Next Agent

The next agent should:
1. Open `/Users/martin/infinity`.
2. Treat `P2-DX-01` as closed unless new local changes invalidate the evidence.
3. If the tree changed, re-run the commands above and rerun the critic prompt.
4. If the evidence still holds, continue with `P2-DX-02. Monorepo dependency hygiene`.
