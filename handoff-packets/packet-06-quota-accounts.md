# Packet 06 — Quota / Accounts

## Start wave

Wave 1. Start immediately.

## Repo root

- `/Users/martin/infinity/apps/shell`

## Repo boundary

- External repos are read-only references.
- Do not edit `/Users/martin/FounderOS`, `/Users/martin/open-webui`, or `/Users/martin/hermes-webui`.

## Ownership

- quota source adapters
- auth-mode matrix
- account capacity derivation
- preferred vs fallback account behavior
- accounts read models and shell-facing APIs

## Main anchors

- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/quota.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/quota.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/accounts/capacity.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/accounts/capacity.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/accounts/mock.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/accounts/mock.ts)
- [/Users/martin/infinity/apps/shell/apps/web/app/api/control/accounts/route.ts](/Users/martin/infinity/apps/shell/apps/web/app/api/control/accounts/route.ts)
- [/Users/martin/infinity/apps/shell/apps/web/app/api/control/accounts/quotas/route.ts](/Users/martin/infinity/apps/shell/apps/web/app/api/control/accounts/quotas/route.ts)

## Commands

- Typecheck: pending local workspace scaffold in `apps/shell`

## Must sync with

- `05` for quota and account events
- `02` for shell work-mode metadata
- `07` for failover behavior
- `08` for auth-mode fixtures and quota goldens

## Non-negotiables

- ChatGPT-authenticated accounts use upstream truth.
- API-key accounts do not pretend to have ChatGPT buckets.
- Preferred and fallback account rules must be explicit before live failover work.
