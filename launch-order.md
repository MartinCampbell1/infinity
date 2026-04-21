# launch-order.md — Safe High-Parallelism Rollout

## Goal

This document turns the project docs into an execution order that supports many agents without losing quality.

It is intentionally staged.

Do not run a blind 8-agent big bang from the docs set alone.

Hard boundary:

- All work is inside `/Users/martin/infinity`.
- External repos are reference-only and never edited.

---

## Wave 0 — Kickoff Freeze

Owner:

- `08` QA / contracts / integration

Output required before live wiring:

- extracted contract packet;
- initial raw fixture corpus;
- initial golden projections;
- repo/file map;
- test and preview commands;
- overlap rulings for the known cross-stream seams.

Must freeze in this wave:

- deterministic event identity and timestamp rules;
- status and phase transition matrix;
- minimum payload schemas by normalized event kind;
- approval and recovery decision semantics;
- quota live-update and failover semantics.

Exit criteria:

- `contracts.md` updated to active freeze version.
- `integration-matrix.md` has flow IDs and evidence requirements.
- Raw and golden fixture manifests include active scenarios.

---

## Wave 1 — Start Immediately

Start these streams immediately:

- `01` FounderOS shell / IA
- `05` Event normalization
- `06` Quota / accounts
- `08` QA / contracts / integration

Scope rules:

- `01` can work mock-first.
- `05` should begin with fixtures and mapping tables before broad live wiring.
- `06` should freeze the auth-mode matrix before UI polish.
- `08` owns the contract-diff gate.

Exit criteria:

- `01` has mock-first session/group/account/recovery routes with scoped deep links.
- `05` has deterministic mapping notes plus raw->golden seeds.
- `06` has auth-mode matrix and preferred/fallback policy text frozen.

---

## Wave 1.5 — Bridge Pod

Start together, not separately:

- `02` FounderOS workspace host
- `03` Open WebUI host mode

Required before start:

- one shared bridge contract file;
- one agreed handshake lifecycle;
- one decision for host strip vs inner meta bar behavior.

These two streams are one coordination pod even if the code lives in different app roots.

Exit criteria:

- Shared bridge message types are frozen.
- Handshake order is explicitly documented and smoke-checkable.
- Embedded mode and standalone mode behaviors are both documented.

---

## Wave 2 — Workspace Ergonomics

Start:

- `04` Hermes behavior port

Required before start:

- Hermes reference screenshots or fixture pack;
- bridge event expectations from `02/03`;
- approval-card state shape from `07` draft semantics.

Rule:

- `04` stays bounded only if durable approval state and recovery actions remain owned by `07`.

Exit criteria:

- Hermes-grade behaviors are mapped to fixture-backed semantics.
- UI-level aliases do not redefine canonical event contracts.

---

## Wave 3 — Cross-Cutting Recovery Work

Start:

- `07` Approvals / recoveries

Required before start:

- approval response semantics frozen;
- fallback-account policy frozen;
- event hooks aligned with `05`;
- host/workspace reaction points aligned with `02/03`;
- preferred vs fallback account behavior aligned with `06`.

`07` is the most cross-cutting stream and should not be first-wave.

Exit criteria:

- Retry and fallback actions are auditable.
- Approval and recovery actions satisfy idempotency and deterministic projection.

---

## Mandatory sync points

### 01 <-> 02

Freeze together:

- route names;
- `session_id`, `group_id`, `account_id`, `workspace_id`;
- deep-link semantics.

### 02 <-> 03

Freeze together:

- `workspace.ready` and `founderos.bootstrap` lifecycle;
- bridge message ownership;
- host strip vs inner meta bar responsibilities.

### 04 <-> 05 <-> 07

Freeze together:

- approval and recovery event mapping;
- workspace cards vs durable state transitions;
- retry and failover UI actions.

### 05 <-> 06

Freeze together:

- ownership of `quota.updated`;
- ownership of `account.switched`;
- projection behavior when runtime and quota facts arrive out of order.

### 06 <-> 07

Freeze together:

- preferred-account rules;
- fallback-account rules;
- failover eligibility.

### 08 <-> everyone

`08` owns:

- contract-diff review;
- fixture corpus gate;
- smoke coverage;
- pre-merge integration sanity checks.

---

## Agent recovery protocol

If an agent dies, times out, or loses context:

1. Restart with its packet + `agents.md` + `contracts.md` + `integration-matrix.md`.
2. Require a short "last completed step / next step / blockers" note before code changes resume.
3. Re-run affected flow checks from `integration-matrix.md` for touched scope.
4. If freeze-sensitive files were touched, run full contract-drift checklist before merge.

---

## Minimum packet per agent

Every agent gets:

- `latest-plan.md`
- `agents.md`
- its own `agent-0N.md`
- `contracts.md`
- `repo-map.md`
- `fixtures/README.md`
- target repo root
- target file map
- test or preview command
- dependency owner list

Specific additions:

- `01/02`: FounderOS route/nav file map and mock session summary JSON
- `03/04`: Open WebUI entry points, launch contract, Hermes reference pack
- `05/06/07/08`: raw fixtures, golden outputs, auth-mode matrix, storage/API home

---

## Practical merge rule

If a PR needs simultaneous changes in shell IA, workspace embed behavior, normalized events, and quota or recovery semantics, it should be split before implementation.
