# Packet 07 — Approvals / Recoveries

## Start wave

Wave 3. Start last.

## Repo root

- `/Users/martin/infinity/apps/shell`

## Repo boundary

- External repos are read-only references.
- Do not edit `/Users/martin/FounderOS`, `/Users/martin/open-webui`, or `/Users/martin/hermes-webui`.

## Ownership

- durable approvals storage
- durable recoveries storage
- retry and failover actions
- operator audit trail
- shell-side approvals and recoveries surfaces

## Main anchors

- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/approvals.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/approvals.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/recoveries.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/recoveries.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/approvals/index.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/approvals/index.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/recoveries/index.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/recoveries/index.ts)
- [/Users/martin/infinity/apps/shell/apps/web/app/api/control/execution/approvals/[approvalId]/respond/route.ts](/Users/martin/infinity/apps/shell/apps/web/app/api/control/execution/approvals/[approvalId]/respond/route.ts)
- [/Users/martin/infinity/apps/shell/apps/web/app/api/control/execution/recoveries/[recoveryId]/route.ts](/Users/martin/infinity/apps/shell/apps/web/app/api/control/execution/recoveries/[recoveryId]/route.ts)

## Commands

- Typecheck: pending local workspace scaffold in `apps/shell`

## Must sync with

- `05` for normalized event hooks
- `06` for fallback-account policy
- `03/04` for workspace cards and action reflections
- `08` for merge gate and smoke coverage

## Non-negotiables

- No process-local approvals as truth.
- No hidden auto-retry magic.
- Do not start until approval semantics and failover rules are frozen.
