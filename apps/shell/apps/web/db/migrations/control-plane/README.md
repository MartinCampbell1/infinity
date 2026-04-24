# Control-plane migrations

Production runtime must not create or alter control-plane tables on request
paths. Apply these migrations before booting a production or staging shell with
Postgres-backed state.

Commands from repository root:

```sh
npm run shell:control-plane:migrations:dry-run
npm run shell:control-plane:migrations:apply
npm run shell:control-plane:migrations:status
FOUNDEROS_MIGRATION_TEST_DATABASE_URL=postgres://... npm run shell:control-plane:migrations:smoke
npm run shell:control-plane:preflight
```

Rollback plan for `001_control_plane_state.sql` and `002_tenant_rbac.sql`:

1. Stop shell writes or put the shell in maintenance/read-only mode.
2. Take a Postgres backup or point-in-time recovery checkpoint.
3. If rolling back code only, keep the schema in place; version 1 tables and
   version 2 tenant/RBAC columns are additive for older runtime-created rows.
4. If dropping the schema is required in an empty environment, drop the tables
   in reverse dependency order after backup:
   `tenant_workspaces`, `tenant_projects`, `tenant_memberships`,
   `tenant_users`, `tenants`, `operator_action_audit_events`,
   `account_quota_updates`,
   `account_quota_snapshots`, `recovery_incidents`, `approval_requests`,
   `execution_session_events`, `execution_sessions`,
   `shell_control_plane_state`, `shell_control_plane_schema_migrations`.
5. Re-run `npm run shell:control-plane:migrations:dry-run` and then apply from
   the target release before returning traffic.

Runnable checks:

- `migrations:dry-run` validates the manifest checksum without touching a DB.
- `migrations:smoke` resets a disposable Postgres schema, applies migrations
  against both an empty DB and a simulated old runtime-created DB, verifies the
  latest checksum, confirms the upgraded column path, and performs a transaction
  rollback smoke.
- `control-plane:preflight` is part of production `npm run start`; it is skipped
  outside `FOUNDEROS_DEPLOYMENT_ENV=production|staging` and exits nonzero when
  the observed migration row does not match the manifest.
