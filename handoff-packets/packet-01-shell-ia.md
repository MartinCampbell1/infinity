# Packet 01 — FounderOS Shell / IA

## Start wave

Wave 1. Start immediately.

## Repo root

- `/Users/martin/infinity/apps/shell`

## Repo boundary

- External repos are read-only references.
- Do not edit `/Users/martin/FounderOS`, `/Users/martin/open-webui`, or `/Users/martin/hermes-webui`.

## Ownership

- Execution IA
- route families
- route scope expansion
- Sessions / Groups / Accounts / Recoveries surfaces
- deep links into work mode

## Main anchors

- [/Users/martin/infinity/apps/shell/apps/web/lib/navigation.ts](/Users/martin/infinity/apps/shell/apps/web/lib/navigation.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/route-scope.ts](/Users/martin/infinity/apps/shell/apps/web/lib/route-scope.ts)
- [/Users/martin/infinity/apps/shell/apps/web/app/(shell)/execution/page.tsx](/Users/martin/infinity/apps/shell/apps/web/app/(shell)/execution/page.tsx)
- [/Users/martin/infinity/apps/shell/apps/web/app/(shell)/execution/sessions/page.tsx](/Users/martin/infinity/apps/shell/apps/web/app/(shell)/execution/sessions/page.tsx)
- [/Users/martin/infinity/apps/shell/apps/web/app/(shell)/execution/groups/page.tsx](/Users/martin/infinity/apps/shell/apps/web/app/(shell)/execution/groups/page.tsx)
- [/Users/martin/infinity/apps/shell/apps/web/components/execution/session-surface.tsx](/Users/martin/infinity/apps/shell/apps/web/components/execution/session-surface.tsx)

## Commands

- Typecheck: pending local workspace scaffold in `apps/shell`
- Smoke: pending local workspace scaffold in `apps/shell`

## Must sync with

- `02` for route names and deep-link semantics
- `05` for final session/group projections
- `08` for contract and fixture gate

## Non-negotiables

- Do not create a parallel `/execution` tree.
- Repurpose current execution surfaces instead.
- Mock-first is allowed.
- Use the full canonical `ExecutionSessionSummary`, not the shortened local variant.
