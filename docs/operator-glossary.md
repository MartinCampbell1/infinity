# Infinity Operator Glossary

This glossary defines the run lifecycle terms an operator sees in the shell and
workspace. Use these words consistently in docs, UI help, handoffs, and recovery
notes.

## Run

A run is the top-level operator request moving through the autonomous lifecycle.
It starts from `New run`, keeps the original prompt and scope together, and ends
only when the shell has a result, a blocked issue, or an explicit stop.

Use `run` when discussing:

- the whole request from prompt to delivery;
- the lifecycle shown in the run control plane;
- proof, recovery, and handoff state for the complete operator goal.

Do not use `run` for a single worker retry or a single task in the planner.

## Task

A task is a bounded unit of work derived from the run. Tasks usually come from
the planner or task graph and should have enough context, constraints, and
acceptance criteria for a worker to execute without changing the whole product
direction.

Use `task` when discussing:

- planner output;
- work-item ownership;
- a specific implementation, documentation, QA, or ops slice;
- dependencies between units of work.

Do not call a task delivered just because an attempt finished. The task is done only when its acceptance evidence is present.

## Attempt

An attempt is one execution try for a task or recovery action. A task may have
multiple attempts when a worker fails, hits an approval gate, runs out of quota,
or is retried on a fallback account.

Use `attempt` when discussing:

- retry history;
- executor state;
- failure reasons;
- which account, model, or environment tried the work.

An attempt can fail while the task and run remain recoverable.

## Delivery

A delivery is the operator-facing result record for a run. It connects the
finished work to the evidence needed to trust it: preview URL or local output,
manifest, verification summary, handoff, and any known limitations.

Use `delivery` when discussing:

- final output paths;
- preview and launch proof;
- delivery manifests;
- whether a result is ready for staging, production, or only local review.

A delivery is not production-ready unless its proof matches the target environment.

## Related Terms

## Readiness Tier

A readiness tier is the trust level a delivery can honestly claim:
`local_solo`, `staging`, or `production`. The tier should follow the strongest
proof actually attached to the delivery, not the operator's desired wording.

## Staging Topology

A staging topology is the production-like hosted environment described in
`docs/ops/staging-topology.md`. It requires non-local shell and work-ui origins,
a private execution kernel, durable Postgres-backed state, non-local artifact
storage, and a named secrets manager.

## External Proof Manifest

An external proof manifest records hosted delivery evidence such as a GitHub PR,
hosted preview, CI result, signed manifest, and signed artifact URLs. It is the
evidence boundary for staging and production claims, not a replacement for
fresh verification on future releases.

## Brief

A brief is the shell-authored interpretation of the operator request. It turns a
prompt into goals, constraints, open questions, and acceptance criteria.

## Task Graph

A task graph is the dependency-aware plan for a run. It shows which tasks can
start, which tasks wait on others, and where the planner expects assembly or
validation.

## Batch

A batch is a supervised group of task attempts executed together under a
concurrency and recovery policy.

## Work Unit

A work unit is the worker-facing package for one task inside a batch. It should
contain the task scope, files or ownership boundary, acceptance criteria, and
verification expectations.

## Verification

Verification is the evidence-gathering step after implementation. It can include
focused tests, static checks, migration checks, browser proof, screenshots, or a
manual QA checklist depending on the run.

## Recovery

Recovery is an operator-visible action after a failure, blocked approval, quota
problem, or incomplete proof. Recovery can retry the same account, fail over to a fallback account, edit the request, deny an approval, or stop the run.

## Quick Decision Table

| If you mean... | Use this term |
| --- | --- |
| The whole operator goal | Run |
| One planned unit of work | Task |
| One try at doing work | Attempt |
| The final result record and proof | Delivery |
| Planner dependency structure | Task graph |
| Retry or failover path | Recovery |
| Local, staging, or production trust level | Readiness tier |
| Hosted production-like environment contract | Staging topology |
| Hosted PR/preview/CI/artifact evidence | External proof manifest |
