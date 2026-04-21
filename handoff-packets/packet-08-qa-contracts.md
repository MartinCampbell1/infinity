# Packet 08 — QA / Contracts / Integration

## Start wave

Wave 0 and Wave 1. Start immediately and stay active through the rollout.

## Repo roots

- `/Users/martin/infinity`

## Repo boundary

- External repos are read-only references.
- Do not edit `/Users/martin/FounderOS`, `/Users/martin/open-webui`, or `/Users/martin/hermes-webui`.

## Ownership

- contract extraction and drift control
- fixture corpus
- golden outputs
- smoke coverage
- handoff quality gate

## Main anchors

- [/Users/martin/infinity/contracts.md](/Users/martin/infinity/contracts.md)
- [/Users/martin/infinity/repo-map.md](/Users/martin/infinity/repo-map.md)
- [/Users/martin/infinity/fixtures/README.md](/Users/martin/infinity/fixtures/README.md)
- [/Users/martin/infinity/launch-order.md](/Users/martin/infinity/launch-order.md)
- [/Users/martin/infinity/contract-drift-checklist.md](/Users/martin/infinity/contract-drift-checklist.md)
- [/Users/martin/infinity/integration-matrix.md](/Users/martin/infinity/integration-matrix.md)
- [/Users/martin/infinity/apps/shell/apps/web/scripts/smoke-shell-contract.mjs](/Users/martin/infinity/apps/shell/apps/web/scripts/smoke-shell-contract.mjs)
- [/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesTranscript.test.ts](/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesTranscript.test.ts)

## Commands

- Contract review pass: update `contract-drift-checklist.md` for impacted flows.
- Smoke and typecheck commands are pending until local workspace scaffolds exist in `apps/shell` and `apps/work-ui`.

## Must sync with

- everyone

## Non-negotiables

- No contract drift without explicit approval.
- No event, quota, approval, or recovery changes without fixture updates.
- This stream owns the pre-merge sanity gate.
