# Packet 05 — Event Normalization

## Start wave

Wave 1. Start immediately, but begin with fixtures and mappings before live wiring.

## Repo root

- `/Users/martin/infinity/apps/shell`

## Repo boundary

- External repos are read-only references.
- Do not edit `/Users/martin/FounderOS`, `/Users/martin/open-webui`, or `/Users/martin/hermes-webui`.

## Ownership

- normalized event contract
- raw runtime adapters
- append-only event storage
- session and group projections
- deterministic replay behavior

## Main anchors

- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/session-events.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/session-events.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/events/index.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/events/index.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/sessions/index.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/sessions/index.ts)
- [/Users/martin/.local/bin/codext-session-supervisor](/Users/martin/.local/bin/codext-session-supervisor)

## Commands

- Typecheck: pending local workspace scaffold in `apps/shell`
- Shell smoke: pending local workspace scaffold in `apps/shell`

## Must sync with

- `06` for `quota.updated` and `account.switched`
- `07` for approvals and recoveries events
- `08` for fixtures and goldens

## Non-negotiables

- No live implementation before fixture corpus exists.
- Freeze deterministic event identity and timestamp rules first.
- Do not leak raw source-specific shapes into UI-facing reducers.
