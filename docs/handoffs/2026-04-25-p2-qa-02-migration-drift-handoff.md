# 2026-04-25 P2-QA-02 Migration Drift Detection Handoff

## Current audit step

- Audit source: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Current step: `P2-QA-02. Migration drift detection`
- Area: QA / DB
- Acceptance: CI checks migrations vs DB schema snapshot.

## Closed critic gates before this step

- `P1-OPS-02` incident runbooks: independent critic `GO`
- `P2-DX-01` lint scripts are non-mutating by default: independent critic `GO`
- `P2-DX-02` dependency hygiene: independent critic `GO`
- `P2-DX-03` high-risk layout refactor: independent critic `GO`
- `P2-DX-04` typed route helpers: independent critic `GO` on iteration 2
- `P2-QA-01` critical coverage thresholds: independent critic `GO`

## What changed for P2-QA-02

- Added committed control-plane DB schema snapshot:
  - `apps/shell/apps/web/db/migrations/control-plane/schema-snapshot.json`
- Added migration schema drift gate:
  - `apps/shell/apps/web/scripts/control-plane-schema-drift.mjs`
- Added unit tests for drift comparison/reporting:
  - `apps/shell/apps/web/scripts/control-plane-schema-drift.test.mjs`
- Added npm scripts:
  - root `shell:control-plane:migrations:drift`
  - root `shell:control-plane:migrations:drift:test`
  - shell workspace `control-plane:migrations:drift`
  - shell workspace `control-plane:migrations:drift:test`
- Added CI execution to `.github/workflows/control-plane-migrations.yml` after the existing migration smoke.
- Added `FOUNDEROS_MIGRATION_TEST_DATABASE_URL` to `turbo.json` global env so targeted eslint has no undeclared-env warning.
- Added operator docs:
  - `docs/qa/migration-drift.md`
- Fixed existing migration smoke assertion bug:
  - `apps/shell/apps/web/scripts/control-plane-migration-smoke.mjs`
  - Root cause: `array_agg(kcu.column_name)` over `information_schema` returned domain-array strings such as `{tenant_id,id}` through node-postgres. The schema was correct, but the assertion compared a string to a JS array. The fix casts `kcu.column_name::text` before aggregation in both primary-key checks.

## Snapshot coverage

The drift gate resets a test Postgres `public` schema, applies the control-plane migrations, captures a normalized schema view, and compares it with the committed snapshot.

Captured fields:

- migration manifest latest version, files, and checksums
- public table inventory
- column names, PostgreSQL data types, and nullability
- primary key columns
- row-level-security enablement
- policy names
- explicit `idx_*` indexes

## Verification completed

Local lightweight checks:

```bash
npm run shell:control-plane:migrations:drift:test
npm run shell:control-plane:migrations:dry-run
node -e "JSON.parse(require('fs').readFileSync('apps/shell/apps/web/db/migrations/control-plane/schema-snapshot.json','utf8')); console.log('schema snapshot JSON ok')"
npx eslint scripts/control-plane-schema-drift.mjs scripts/control-plane-migration-smoke.mjs
git diff --check
```

All passed.

Fail-closed env check:

```bash
npm run shell:control-plane:migrations:drift
```

Expected result without `FOUNDEROS_MIGRATION_TEST_DATABASE_URL`: exits 1 with
`FOUNDEROS_MIGRATION_TEST_DATABASE_URL is required for migration schema drift checks.`

Live DB verification was also run against a temporary local Postgres cluster created with `initdb`, then stopped and removed via shell `trap`.

```bash
npm run shell:control-plane:migrations:smoke
npm run shell:control-plane:migrations:drift
```

Observed result:

```text
control-plane migration smoke passed: empty-db
control-plane migration smoke passed: upgraded-runtime-db
Control-plane migration schema drift check passed.
```

Cleanup proof:

```bash
pgrep -fl "infinity-pg"
```

Observed no matching temp Postgres process.

## What is not closed by this step

- The snapshot does not yet compare every PostgreSQL check constraint, FK definition body, unique constraint, default expression, or full policy expression.
- The gate intentionally covers the high-signal deploy drift surface: tables, columns/types/nullability, primary keys, RLS flags, policy names, explicit indexes, and migration manifest checksums.
- The control-plane migration workflow now includes drift checking, but the full GitHub Actions run itself has not been executed locally.

## Commands for next verification

Fast local verification:

```bash
npm run shell:control-plane:migrations:drift:test
npm run shell:control-plane:migrations:dry-run
cd apps/shell/apps/web
npx eslint scripts/control-plane-schema-drift.mjs scripts/control-plane-migration-smoke.mjs
git diff --check
```

Live Postgres verification:

```bash
cd /Users/martin/infinity
FOUNDEROS_MIGRATION_TEST_DATABASE_URL=postgres://founderos:founderos@127.0.0.1:5432/founderos_migration_test \
  npm run shell:control-plane:migrations:smoke
FOUNDEROS_MIGRATION_TEST_DATABASE_URL=postgres://founderos:founderos@127.0.0.1:5432/founderos_migration_test \
  npm run shell:control-plane:migrations:drift
```

Intentional snapshot refresh after reviewed migration SQL changes:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
FOUNDEROS_MIGRATION_TEST_DATABASE_URL=postgres://founderos:founderos@127.0.0.1:5432/founderos_migration_test \
  node ./scripts/control-plane-schema-drift.mjs --write-snapshot
```

## Independent critic gate prompt

```text
You are an independent critic-auditor for /Users/martin/infinity.

Audit step: P2-QA-02. Migration drift detection.
Acceptance from /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md:
"CI checks migrations vs DB schema snapshot."

Files to inspect:
- .github/workflows/control-plane-migrations.yml
- package.json
- turbo.json
- apps/shell/apps/web/package.json
- apps/shell/apps/web/scripts/control-plane-schema-drift.mjs
- apps/shell/apps/web/scripts/control-plane-schema-drift.test.mjs
- apps/shell/apps/web/scripts/control-plane-migration-smoke.mjs
- apps/shell/apps/web/db/migrations/control-plane/schema-snapshot.json
- docs/qa/migration-drift.md
- docs/handoffs/2026-04-25-p2-qa-02-migration-drift-handoff.md

Evidence already observed:
- npm run shell:control-plane:migrations:drift:test passed
- npm run shell:control-plane:migrations:dry-run passed
- schema-snapshot.json parsed as valid JSON
- npm run shell:control-plane:migrations:drift fails closed without FOUNDEROS_MIGRATION_TEST_DATABASE_URL
- live temp-Postgres run passed:
  - npm run shell:control-plane:migrations:smoke
  - npm run shell:control-plane:migrations:drift
- npx eslint scripts/control-plane-schema-drift.mjs scripts/control-plane-migration-smoke.mjs passed from apps/shell/apps/web
- git diff --check passed
- no temp "infinity-pg" process remained after the live verification

Review for:
- Does this satisfy P2-QA-02 as a bounded remediation?
- Does CI now check migrations against a committed DB schema snapshot?
- Is the snapshot comparison fail-closed and deterministic?
- Is the existing smoke-test parser fix legitimate and scoped?
- Are there material gaps that should block this step, not just future hardening?

Return exactly one of:
GO
NO-GO: <specific blockers>
BLOCKER: <specific reason this cannot be evaluated>
```
