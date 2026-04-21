# Packet 03 — Open WebUI Host Mode / Work Launch

## Start wave

Wave 1.5. Start together with `02`.

## Repo root

- `/Users/martin/infinity/apps/work-ui`

## Repo boundary

- External repos are read-only references.
- Do not edit `/Users/martin/FounderOS`, `/Users/martin/open-webui`, or `/Users/martin/hermes-webui`.

## Ownership

- work-mode launch behavior
- chrome suppression or host-aware presentation when launched from shell
- accepting launch context
- emitting workspace-side signals upward when needed

## Main anchors

- [/Users/martin/infinity/apps/work-ui/src/routes/(app)/+layout.svelte](/Users/martin/infinity/apps/work-ui/src/routes/(app)/+layout.svelte)
- [/Users/martin/infinity/apps/work-ui/src/lib/founderos/index.ts](/Users/martin/infinity/apps/work-ui/src/lib/founderos/index.ts)
- [/Users/martin/infinity/apps/work-ui/src/lib/founderos/types.ts](/Users/martin/infinity/apps/work-ui/src/lib/founderos/types.ts)
- [/Users/martin/infinity/apps/work-ui/src/lib/founderos/bridge.ts](/Users/martin/infinity/apps/work-ui/src/lib/founderos/bridge.ts)
- [/Users/martin/infinity/apps/work-ui/src/lib/components/layout/Sidebar.svelte](/Users/martin/infinity/apps/work-ui/src/lib/components/layout/Sidebar.svelte)
- [/Users/martin/infinity/apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte](/Users/martin/infinity/apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte)

## Commands

- Frontend checks: pending local workspace scaffold in `apps/work-ui`

## Must sync with

- `02` for launch/bootstrap lifecycle
- `04` for workspace ergonomics
- `07` for approval state reflections
- `08` for smoke coverage

## Non-negotiables

- Preserve Open WebUI identity.
- Do not redesign the app into a dashboard.
- Do not treat Open WebUI chat ids as orchestration truth.
