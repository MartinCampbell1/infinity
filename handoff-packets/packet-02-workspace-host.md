# Packet 02 — FounderOS Workspace Host

## Start wave

Wave 1.5. Start together with `03`.

## Repo root

- `/Users/martin/infinity/apps/shell`

## Repo boundary

- External repos are read-only references.
- Do not edit `/Users/martin/FounderOS`, `/Users/martin/open-webui`, or `/Users/martin/hermes-webui`.

## Ownership

- work-mode launch surface from shell
- host container behavior
- launch token and deep-link handoff
- host-side session metadata strip or equivalent outer context

## Main anchors

- [/Users/martin/infinity/apps/shell/apps/web/app/(shell)/execution/workspace/[sessionId]/page.tsx](/Users/martin/infinity/apps/shell/apps/web/app/(shell)/execution/workspace/[sessionId]/page.tsx)
- [/Users/martin/infinity/apps/shell/apps/web/components/execution/workspace-handoff-surface.tsx](/Users/martin/infinity/apps/shell/apps/web/components/execution/workspace-handoff-surface.tsx)
- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/route-scope.ts](/Users/martin/infinity/apps/shell/apps/web/lib/route-scope.ts)
- [/Users/martin/infinity/apps/shell/apps/web/app/(shell)/execution/projects/[projectId]/page.tsx](/Users/martin/infinity/apps/shell/apps/web/app/(shell)/execution/projects/[projectId]/page.tsx)

## Commands

- Typecheck: pending local workspace scaffold in `apps/shell`

## Must sync with

- `01` for routes and scope
- `03` for launch contract and bootstrap lifecycle
- `06` for quota and account meta
- `08` for bridge smoke coverage

## Non-negotiables

- MVP topology is cross-origin work mode, not same-origin iframe-first.
- Do not force iframe embed as the primary path.
- Work from the signed launch/deep-link contract in `contracts.md`.
