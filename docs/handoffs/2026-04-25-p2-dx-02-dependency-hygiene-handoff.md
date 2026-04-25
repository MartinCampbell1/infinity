# Handoff: P2-DX-02 Dependency Hygiene

Repo: `/Users/martin/infinity`
Branch at refresh time: `codex/p0-be-14-staging-smoke`
HEAD at refresh time: `977a499 chore: checkpoint audit hardening work`
Audit plan: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
Current date: 2026-04-25
Current bounded audit step: `P2-DX-02. Monorepo dependency hygiene` - closed for audit acceptance by independent critic `GO`.

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
P2-DX-02. Monorepo dependency hygiene
Area: DX
Problem: Root/archive dependency state should be reproducible and documented.
Task: implement the change, update matching tests/docs, do not change unrelated design/runtime areas, preserve current validation gates.
Acceptance criteria: Lockfile checked; install command documented; package manager pinned.
Checks: focused unit/integration tests + relevant shell/work-ui checks + update validation packet where applicable.
```

Current interpretation:
- Root dependency installation must be reproducible from `package-lock.json`.
- The package manager must be explicit.
- The install command and lockfile policy must be documented for local agents and CI.

## Closed Critic Gates Through P2-DX-02

### P2-DX-01 Lint scripts

Status: closed with independent critic `GO`.

Evidence is preserved in:
- `docs/handoffs/2026-04-25-p2-dx-01-lint-scripts-handoff.md`

### P2-DX-02 Dependency hygiene

Status: closed with independent critic `GO`.

Critic result summary:
- `Status: GO`
- Scope checked: P2-DX-02 only.
- Done: package manager pinned, install command documented, lockfile checked/tracked, workflows spot-check aligned with `npm ci` and `package-lock.json`.
- Partial: none.
- Missing or broken: none for stated acceptance.
- Fix items: none.
- Blocker: none.

## P2-DX-02 Work Already Present

Files:
- `package.json`
- `docs/dx/dependency-hygiene.md`

Implemented behavior:
- Root `package.json` keeps the pinned package manager:
  - `packageManager`: `npm@10.9.4`
- Root setup now uses the reproducible lockfile install path:
  - `setup`: `npm ci`
- Added an explicit lockfile refresh helper:
  - `setup:refresh-lockfile`: `npm install --package-lock-only`
- Added `docs/dx/dependency-hygiene.md` documenting:
  - pinned package manager;
  - `npm ci` as the install command;
  - `npm run setup` as the repo-local setup entrypoint;
  - `package-lock.json` as the workspace lockfile;
  - lockfile refresh command;
  - dry-run verification command.

## Verification Already Passed

Run from `/Users/martin/infinity`:

```sh
node - <<'NODE'
const fs = require('node:fs');
const root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const doc = fs.readFileSync('docs/dx/dependency-hygiene.md', 'utf8');
const failures = [];
if (root.packageManager !== 'npm@10.9.4') failures.push(`packageManager is ${root.packageManager}`);
if (root.scripts?.setup !== 'npm ci') failures.push(`setup script is ${root.scripts?.setup}`);
if (root.scripts?.['setup:refresh-lockfile'] !== 'npm install --package-lock-only') failures.push(`setup:refresh-lockfile is ${root.scripts?.['setup:refresh-lockfile']}`);
if (!fs.existsSync('package-lock.json')) failures.push('package-lock.json missing');
if (lock.lockfileVersion !== 3) failures.push(`lockfileVersion is ${lock.lockfileVersion}`);
for (const needle of ['npm@10.9.4', 'npm ci', 'package-lock.json', 'npm run setup:refresh-lockfile']) {
  if (!doc.includes(needle)) failures.push(`doc missing ${needle}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('P2-DX-02 dependency hygiene contract OK');
NODE
```

Result: `P2-DX-02 dependency hygiene contract OK`.

Run from `/Users/martin/infinity`:

```sh
npm ci --ignore-scripts --dry-run
```

Result: passed. It printed dry-run package additions and did not modify `package-lock.json`.

Run from `/Users/martin/infinity`:

```sh
rg -n "npm@10\.9\.4|npm ci|package-lock\.json|setup:refresh-lockfile|npm install" \
  package.json docs/dx/dependency-hygiene.md .github/workflows
```

Result:
- root `package.json` pins `npm@10.9.4`;
- docs contain `npm ci`, `package-lock.json`, and `setup:refresh-lockfile`;
- existing GitHub workflows use `npm ci` and package-lock cache paths where relevant.

Run from `/Users/martin/infinity`:

```sh
git diff --check
```

Result: passed.

## What Cannot Be Claimed Closed Yet

Do not over-claim these:
- No full `npm run validate:full` or browser E2E release gate was run for this step.
- No dependency versions were changed in this step.
- No lockfile refresh was performed because package manifests did not require a lockfile update.
- No commit/push was performed by this handoff refresh.

## Next Verification Commands

Run these before advancing if the tree changes after this handoff:

```sh
cd /Users/martin/infinity
npm ci --ignore-scripts --dry-run
```

```sh
cd /Users/martin/infinity
node - <<'NODE'
const fs = require('node:fs');
const root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const doc = fs.readFileSync('docs/dx/dependency-hygiene.md', 'utf8');
const failures = [];
if (root.packageManager !== 'npm@10.9.4') failures.push(`packageManager is ${root.packageManager}`);
if (root.scripts?.setup !== 'npm ci') failures.push(`setup script is ${root.scripts?.setup}`);
if (root.scripts?.['setup:refresh-lockfile'] !== 'npm install --package-lock-only') failures.push(`setup:refresh-lockfile is ${root.scripts?.['setup:refresh-lockfile']}`);
if (!fs.existsSync('package-lock.json')) failures.push('package-lock.json missing');
if (lock.lockfileVersion !== 3) failures.push(`lockfileVersion is ${lock.lockfileVersion}`);
for (const needle of ['npm@10.9.4', 'npm ci', 'package-lock.json', 'npm run setup:refresh-lockfile']) {
  if (!doc.includes(needle)) failures.push(`doc missing ${needle}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('P2-DX-02 dependency hygiene contract OK');
NODE
```

```sh
cd /Users/martin/infinity
git diff --check
```

## Independent Critic Gate Prompt for Re-Run

Use this prompt if the tree changes or a second independent P2-DX-02 gate is required:

```text
You are the independent critic gate for audit step P2-DX-02 in /Users/martin/infinity. Use critic-loop-profi standards. Inspect the repo and evidence, do not edit files, and return exactly one gate result: GO, NO-GO, or BLOCKER.

Scope and rules:
- Current step only: P2-DX-02 monorepo dependency hygiene.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md, section P2-DX-02.
- Acceptance: lockfile checked; install command documented; package manager pinned.
- Reference repos are read-only.
- Do not judge unrelated dirty files unless they break this step.

Implementation evidence to inspect:
- package.json
- package-lock.json
- docs/dx/dependency-hygiene.md

Verification already run:
- Static dependency-hygiene assertion: passed.
- npm ci --ignore-scripts --dry-run: passed.
- git diff --check: passed.

Return using the critic-loop-profi template and make the first line exactly one of:
Status: GO
Status: NO-GO
Status: BLOCKER
```

## Stop Point for Next Agent

The next agent should:
1. Open `/Users/martin/infinity`.
2. Treat `P2-DX-02` as closed unless new local changes invalidate the evidence.
3. If the tree changed, re-run the commands above and rerun the critic prompt.
4. If the evidence still holds, continue with `P2-DX-03. Refactor large Svelte layout into smaller modules`.
