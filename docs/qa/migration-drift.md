# Control-plane migration drift gate

`P2-QA-02` adds a committed schema snapshot for the shell control-plane
migrations:

- snapshot: `apps/shell/apps/web/db/migrations/control-plane/schema-snapshot.json`
- gate: `npm run shell:control-plane:migrations:drift`
- helper test: `npm run shell:control-plane:migrations:drift:test`

The drift gate requires `FOUNDEROS_MIGRATION_TEST_DATABASE_URL`. It resets the
test database `public` schema, applies the control-plane migrations, captures a
normalized schema view, and compares it with the committed snapshot.

Captured fields:

- migration manifest version/files/checksums
- public table inventory
- column names, PostgreSQL data types, and nullability
- primary key columns
- row-level-security enablement
- policy names
- explicit `idx_*` indexes

This gate is intentionally separate from the migration smoke test. Smoke checks
behavioral upgrade scenarios and selected invariants; drift checks that the
post-migration schema shape remains committed and reviewable before deployment.

To intentionally update the snapshot after reviewing a migration:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
FOUNDEROS_MIGRATION_TEST_DATABASE_URL=postgres://founderos:founderos@127.0.0.1:5432/founderos_migration_test \
  node ./scripts/control-plane-schema-drift.mjs --write-snapshot
```

Do not refresh the snapshot to silence CI unless the migration SQL change is
intentional and reviewed.
