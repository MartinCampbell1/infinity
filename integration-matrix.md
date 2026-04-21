# integration-matrix.md — Mandatory Flows, Evidence, And Gate

## Scope

This matrix is the pre-merge coordination sheet for parallel delivery.

If a change affects a flow ID below, the listed owners must sign off with fixture and contract evidence.

## Mandatory flow matrix

| Flow ID | Flow | Owners | Required fixtures | Required smoke signal | Merge blocker if missing |
| --- | --- | --- | --- | --- | --- |
| `FM-01` | Sessions board -> workspace open -> bootstrap handshake | `01`, `02`, `03`, `08` | session-projection fixture for selected session | `workspace.ready` then `founderos.bootstrap` observed | Yes |
| `FM-02` | Workspace tool activity visible in host lane | `02`, `03`, `05`, `08` | normalized events with `tool.started` and `tool.completed` | host receives mapped tool event pair | Yes |
| `FM-03` | Approval requested in workspace and resolved from shell | `04`, `07`, `08` | approval raw fixture and normalized approval golden | response endpoint returns stable final decision | Yes |
| `FM-04` | Failed session retry same account, then fallback account | `06`, `07`, `08` | recovery raw fixture and session projection golden | recovery transitions are auditable and deterministic | Yes |
| `FM-05` | Quota pressure update reflected in Accounts and workspace meta | `05`, `06`, `08` | quota raw fixtures and quota projection goldens | pressure change visible after update poll/event | Yes |

## Required sync points per flow

- `FM-01`: route scope keys, `sessionId` binding, launch context shape.
- `FM-02`: bridge event mapping, normalized tool payload minima, host rendering fallback.
- `FM-03`: approval card payload, approval API semantics, durable state reflection.
- `FM-04`: failover eligibility rule, preferred/fallback account policy, event audit chain.
- `FM-05`: `quota.updated` ownership, `account.switched` ordering, pressure derivation rule.

## Ownership notes

- `01` owns shell IA, route scope, and board entry points.
- `02` owns shell host container and bootstrap transport.
- `03` owns embedded work mode and upward workspace events.
- `04` owns Hermes behavior parity inside workspace UI.
- `05` owns normalized event mapping and projection invariants.
- `06` owns quota snapshots and capacity derivation.
- `07` owns durable approvals and recoveries.
- `08` owns contract-diff gate and cross-flow smoke coverage.
