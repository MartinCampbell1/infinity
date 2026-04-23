# handoff-packets/README.md

## Recommendation

Distribute the project across **8 bounded packets**, but do **not** run 8 independent agents at once.

Recommended concurrency:

- **6 active implementation agents max**
- **1 lead integrator/coordinator** on top

Why 6:

- `01`, `05`, `06`, and `08` can start immediately.
- `02` and `03` should run together as a bridge pod.
- `04` should start after the bridge pod is stable enough.
- `07` should start last because it is the most cross-cutting stream.

So the safe rollout is:

1. Wave 1: `01`, `05`, `06`, `08`
2. Wave 1.5: add `02`, `03`
3. Wave 2: replace a finished slot with `04`
4. Wave 3: replace a finished slot with `07`

That gives you high speed without opening 8 conflicting threads at the same time.

Hard rule for every packet:

- Work only inside `/Users/martin/infinity`.
- Never edit `/Users/martin/FounderOS`, `/Users/martin/open-webui`, or `/Users/martin/hermes-webui`.

## Required common packet

Every agent gets:

- `latest-plan.md`
- `agents.md`
- `contracts.md`
- `repo-map.md`
- `fixtures/README.md`
- its own packet from this directory

Mandatory check before edits:

- Re-read `contracts.md` and `integration-matrix.md`.
- Confirm which `FM-0X` flow IDs are affected.
- If an agent was restarted after failure, include a 3-line resume note before coding:
  - last completed step
  - next step
  - blockers

## Packet index

- `packet-01-shell-ia.md`
- `packet-02-workspace-host.md`
- `packet-03-openwebui-host-mode.md`
- `packet-04-hermes-behaviors.md`
- `packet-05-event-normalization.md`
- `packet-06-quota-accounts.md`
- `packet-07-approvals-recoveries.md`
- `packet-08-qa-contracts.md`

## Historical Status

This directory also contains dated handoffs, release notes, and audit snapshots from earlier phases.

Use this rule:

- treat files explicitly linked from the current acceptance note, the current release tag, or the latest merged PR as active evidence
- treat dated packets and reports not linked from those current artifacts as historical reference only
- do not rewrite or delete historical files during normal release work unless there is a separate archival task

Current canonical release truth lives in:

- `docs/validation/2026-04-23-current-tip-acceptance.md`
- the latest canonical branch `master`
- the published validated-state release `solo-v1-validated-2026-04-23`
