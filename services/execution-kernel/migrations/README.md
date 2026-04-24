# execution-kernel migrations

`001_kernel_in_memory_noop.sql` is the historical Phase 3 no-op marker.

`002_durable_kernel_store.sql` introduces the production durability boundary:
batches, attempts, work-unit snapshots, leases, heartbeats, and append-only
kernel events.

`003_scheduler_attempt_leases.sql` adds attempt-level lease holder, lease
expiry, and heartbeat columns used by the runnable scheduler.

Runtime request paths must stay free of `CREATE TABLE` or `ALTER TABLE`
statements; production/staging boot fails closed unless
`EXECUTION_KERNEL_DATABASE_URL` is configured.
