# contracts.md — Contract Freeze v1

## Purpose

This is the active contract freeze for parallel implementation in `/Users/martin/infinity`.

Conflict resolution order:

1. `unified-control-plane-super-spec-v2-2026-04-10.md` for product and architecture.
2. `agents.md` for ownership and merge discipline.
3. This file for frozen integration contracts and QA gate rules.

## Repo boundary freeze

- External repos are always read-only references: `/Users/martin/FounderOS`, `/Users/martin/open-webui`, `/Users/martin/hermes-webui`.
- Editable implementation roots are only:
  - `/Users/martin/infinity/apps/shell`
  - `/Users/martin/infinity/apps/work-ui`
- `references/*` are local snapshots, not runtime app roots.

## Contract set frozen in v1

- Contract 01: `ExecutionSessionSummary`
- Contract 02: `NormalizedExecutionEvent`
- Contract 03: Host <-> workspace bridge messages
- Contract 04: Quota snapshot and capacity derivation
- Contract 05: Approval response API

Changing any of these requires a contract-diff PR and QA owner approval before implementation PRs can merge.

## Canonical repo model

```text
references/
  founderos/
  open-webui/
  hermes-webui/
  cabinet/

apps/
  shell/
  work-ui/
```

Rules:

- Hermes is behavior reference only.
- cabinet is UX docs reference only.
- No third runtime product surface is introduced.

## Durable control-plane truth

Logical owner: `apps/shell/apps/web` server-side control-plane layer.

Physical storage: Postgres.

Durable truth tables:

- `execution_sessions`
- `execution_session_events`
- `approval_requests`
- `recovery_incidents`
- `account_quota_snapshots`

Runtime apps may emit facts/events but do not own these truth tables.

## Canonical identity and binding model

`sessionId` is the only internal canonical key.

- `externalSessionId` means primary runtime external ID only.
- `openWebUiChatId` is UI binding only.
- `codexThreadId` may be 0..N per `sessionId` due to fork/delegation.

Storage pattern:

```text
execution_sessions
  id = sessionId
  primary_runtime
  primary_external_id

execution_session_bindings
  session_id
  kind = primary_runtime | ui_chat | delegate_runtime | fork
  system = hermes | codex | openwebui
  external_id
```

Binding invariants:

- Primary runtime switch may update `primary_external_id`.
- Child/fork/delegate runtime IDs never overwrite primary runtime external ID.
- Deep links, approvals, recoveries, quotas, and telemetry always resolve from `sessionId`.

## MVP topology freeze

MVP is cross-origin with shared auth:

- `ops.<domain>` -> shell
- `work.<domain>` -> work UI

Rules:

- Shared IdP or authenticating proxy is required.
- Launch payload includes `projectId`, `sessionId`, and optional runtime/UI refs.
- Same-origin `/work/*` host mode is Phase 2, not MVP baseline.

## Execution IA freeze

Do not create a parallel execution tree.

Keep primary:

- `/execution`
- `/execution/projects/[projectId]`
- `/execution/approvals`
- `/execution/review`

Keep but demote:

- `/execution/intake`
- `/execution/issues`

Repurpose:

- `/execution/agents` to sessions/groups/runs surface

Demote into contextual lanes:

- `/execution/audits`
- `/execution/events`
- `/execution/handoffs`

## Determinism and state precedence freeze

### Event identity and ordering

- `NormalizedExecutionEvent.id` must be deterministic for replay.
- Source event IDs are preferred as base identity when available.
- When source IDs are absent, adapter must use stable synthetic identity from immutable fields and ordinal.
- Replay must be append-only with stable ordering for identical input streams.

### Timestamp rule

- Prefer source timestamp.
- If missing, set ingest timestamp and mark provenance in payload metadata.
- Adapters must not rewrite existing source timestamps.

### Session status precedence

If conflicting facts arrive, apply this precedence:

1. `cancelled` and `completed` terminal states.
2. `dead`/non-retryable failure outcome.
3. `failed` and `blocked`.
4. `waiting_for_approval`.
5. active phases (`starting`, `planning`, `acting`, `validating`).

### Phase precedence

- `completed` and `review` override non-terminal active phases.
- `blocked` phase overrides active phases while unresolved.

## Payload minima by normalized kind

Minimum payload fields must exist for:

- `agent.message.delta`: `messageId`, `delta`.
- `agent.message.completed`: `messageId`, `content`.
- `tool.started` and `tool.completed`: `toolName`, `eventId`, `status` for completed.
- `command.started` and `command.completed`: `command`, `eventId`, `status` for completed.
- `approval.requested`: `approvalId`, `summary`.
- `approval.resolved`: `approvalId`, `decision`.
- `quota.updated`: `accountId`, `pressure`.
- `account.switched`: `fromAccountId`, `toAccountId`.
- `recovery.started` and `recovery.completed`: `recoveryId`, `mode`, `status`.

## Approval and recovery semantics freeze

- Approval API body remains:
  - `decision`: `approve_once | approve_session | approve_always | deny`
- Respond endpoint must be idempotent by `approvalId` + final decision.
- `approve_session` scope is current `sessionId` only.
- `approve_always` scope is policy-level and requires explicit audit event.
- Recovery modes:
  - `retry_same_account`
  - `retry_fallback_account`
- Every operator action emits a normalized auditable event.

## Quota and failover freeze

- ChatGPT-authenticated accounts use upstream app-server quota truth.
- API-key accounts use runtime capacity signals, not fake ChatGPT buckets.
- Preferred/fallback account selection must be explicit and traceable.
- Failover is allowed only when source account is non-schedulable or policy-blocked.

## Contract-diff evidence required

A contract-diff PR must include:

- Updated affected entry in `contracts.md`.
- Raw fixture updates in `fixtures/raw/*`.
- Golden updates in `fixtures/golden/*`.
- Integration matrix impact in `integration-matrix.md`.
- Launch/order impact in `launch-order.md` if sequence changes.
