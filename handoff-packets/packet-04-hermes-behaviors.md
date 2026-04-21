# Packet 04 — Hermes Behavior Port

## Start wave

Wave 2. Start after `02/03` and after Hermes reference material is attached.

## Repo root

- `/Users/martin/infinity/apps/work-ui`

## Repo boundary

- External repos are read-only references.
- Do not edit `/Users/martin/FounderOS`, `/Users/martin/open-webui`, or `/Users/martin/hermes-webui`.

## Ownership

- session organization ergonomics
- tool cards
- approval cards
- retry/edit flows
- right-panel workspace ergonomics
- context usage footer

## Main anchors

- [/Users/martin/infinity/apps/work-ui/src/lib/components/chat/Chat.svelte](/Users/martin/infinity/apps/work-ui/src/lib/components/chat/Chat.svelte)
- [/Users/martin/infinity/apps/work-ui/src/lib/components/layout/Sidebar/HermesSessionItem.svelte](/Users/martin/infinity/apps/work-ui/src/lib/components/layout/Sidebar/HermesSessionItem.svelte)
- [/Users/martin/infinity/apps/work-ui/src/lib/components/hermes/transcript/HermesApprovalCard.svelte](/Users/martin/infinity/apps/work-ui/src/lib/components/hermes/transcript/HermesApprovalCard.svelte)
- [/Users/martin/infinity/apps/work-ui/src/lib/components/hermes/transcript/HermesToolActivityRow.svelte](/Users/martin/infinity/apps/work-ui/src/lib/components/hermes/transcript/HermesToolActivityRow.svelte)
- [/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesTranscript.ts](/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesTranscript.ts)
- [/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesSessions.ts](/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesSessions.ts)
- [/Users/martin/infinity/references/hermes-webui/docs/design/transcript-behavior-rules.md](/Users/martin/infinity/references/hermes-webui/docs/design/transcript-behavior-rules.md)

## Commands

- Frontend checks: pending local workspace scaffold in `apps/work-ui`

## Must sync with

- `03` for work-mode integration points
- `05` for event mapping
- `07` for approval and retry semantics
- `08` for visual and smoke checks

## Non-negotiables

- Copy behavior, not backend storage shortcuts.
- Do not own durable approval or recovery truth.
- Keep the result Open WebUI-first visually.
