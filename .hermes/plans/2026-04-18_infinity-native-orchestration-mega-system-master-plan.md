# Infinity Native Orchestration Mega-System — Master Plan & Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/Users/martin/infinity` into the main Infinity-first operator system where a user can describe a project in Hermes/work-ui, get a full spec/plan, have that plan decomposed into bounded tasks, dispatch those tasks to specialist executors in controlled batches, automatically monitor/recover/reassign failed work, assemble the finished result, and report back with a testable local output.

**Architecture:** Infinity remains the root product and integration home. Reuse Infinity’s existing shell/work-ui bridge, durable control-plane contracts, approvals/recoveries/audit lanes, and embedded workspace model. Merge **Multica Selfhost** into Infinity **selectively as the execution kernel** (task lifecycle, runtimes, supervisor queue, briefs/projects/outcomes), while preserving Open WebUI as the workspace feel and Hermes as the continuity/behavior layer.

**Tech Stack:** Infinity monorepo (Next.js/React/TypeScript + SvelteKit + Postgres-shaped control plane), Multica Go backend/sqlc/WebSocket/daemon runtime, Open WebUI Hermes router, Hermes Memory sidecar/knowledgebase, FounderOS/Quorum/Autopilot design and contract donors.

---

## 0. Executive decision

### 0.1 Final root decision

**Do not create a new third root repo.**

The implementation root is:
- `/Users/martin/infinity`

This matches the current reality:
- Infinity already contains the editable shell + work-ui implementation roots.
- Infinity already aggregates FounderOS logic and control-plane direction.
- Infinity already has frozen contracts, workspace bridge, runtime ingest, approvals/recoveries, audit lanes, and rollout discipline.

### 0.2 What Infinity is now

Based on current repo state and docs:
- `apps/shell` = FounderOS-derived operator shell implementation.
- `apps/work-ui` = Open WebUI-derived workspace implementation.
- Infinity already owns the durable control-plane contract layer.
- Infinity already has live workspace host/bootstrap/session exchange seams.
- Infinity already has normalized session/runtime event ingestion.

Evidence:
- `/Users/martin/infinity/package.json`
- `/Users/martin/infinity/apps/README.md`
- `/Users/martin/infinity/latest-plan.md`
- `/Users/martin/infinity/contracts.md`
- `/Users/martin/infinity/agents.md`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/workspace/runtime-ingest.ts`
- `/Users/martin/infinity/apps/work-ui/src/lib/founderos/bridge.ts`
- `/Users/martin/infinity/apps/work-ui/src/lib/founderos/bootstrap.ts`

### 0.3 Final thesis

The target system is **not** “install ECC into Infinity”.

The target system **is**:
- Infinity as the product shell and control plane,
- Multica as the execution kernel merged into Infinity,
- Open WebUI as the workspace feel already embedded into Infinity,
- Hermes as the behavior/continuity layer,
- FounderOS/Autopilot/Quorum as already-absorbed design/runtime donors,
- CloudDocs assets as legitimate donor docs/assets when useful.

---

## 1. Research-backed donor map

## 1.1 Primary root: Infinity

### What is already real in Infinity

Infinity is **not a blank plan repo**. It already contains major parts of the final system:

- editable roots:
  - `/Users/martin/infinity/apps/shell`
  - `/Users/martin/infinity/apps/work-ui`
- shell contract layer:
  - `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts`
- workspace runtime ingest + normalized event persistence:
  - `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/workspace/runtime-ingest.ts`
- embedded work-ui bridge:
  - `/Users/martin/infinity/apps/work-ui/src/lib/founderos/bridge.ts`
- shell-authored workspace bootstrap/session exchange:
  - `/Users/martin/infinity/apps/work-ui/src/lib/founderos/bootstrap.ts`
- frozen architecture + rollout discipline:
  - `/Users/martin/infinity/contracts.md`
  - `/Users/martin/infinity/latest-plan.md`
  - `/Users/martin/infinity/unified-control-plane-super-spec-v2-2026-04-10.md`

### Infinity assets that must remain source-of-truth

Keep Infinity authoritative for:
- shell/workspace ownership split
- session identity and binding model
- approvals/recoveries/audit durability
- normalized execution events
- host ↔ workspace bridge
- route scope and operator navigation
- rollout discipline and verification gate

### Infinity files that should become the permanent orchestration core surface

- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/*`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/workspace/*`
- `/Users/martin/infinity/apps/shell/apps/web/components/execution/*`
- `/Users/martin/infinity/apps/work-ui/src/lib/founderos/*`
- `/Users/martin/infinity/packages/api-clients/*`

---

## 1.2 Execution kernel donor: Multica Selfhost

### Decision

**Multica Selfhost is mature enough to be merged into Infinity as the execution kernel, but not as a second product frontend.**

### Why this is high-confidence

Multica already has mature, working runtime/task lifecycle primitives:

#### Runtime/task lifecycle
- `/Users/martin/multica-selfhost/server/internal/service/task.go`
  - enqueue
  - claim
  - start
  - complete
  - fail
  - progress broadcasting
  - skill loading
- `/Users/martin/multica-selfhost/server/internal/handler/daemon.go`
  - daemon registration
  - heartbeat
  - claim task by runtime
  - report messages
  - complete/fail task
  - list task history
- `/Users/martin/multica-selfhost/server/pkg/db/generated/agent.sql.go`
- `/Users/martin/multica-selfhost/server/pkg/db/generated/runtime.sql.go`

#### Mature domain/API surface already present
- `/Users/martin/multica-selfhost/packages/core/api/client.ts`

This file already exposes the right higher-order entities for the target system:
- workspaces
- agents
- runtimes
- tasks
- projects
- initiatives
- briefs
- outcomes
- supervisor directives
- supervisor queue
- supervisor interventions
- review
- chat sessions
- skills

#### Supervisor layer already exists
- `/Users/martin/multica-selfhost/packages/core/supervisor/queries.ts`
- `/Users/martin/multica-selfhost/packages/core/supervisor/mutations.ts`

### What to merge from Multica

**Merge into Infinity:**
- Go execution backend concepts and code
- daemon/runtime registration
- task queue and lifecycle
- task progress / task messages / task output history
- projects / initiatives / briefs / outcomes model
- supervisor queue / directives / interventions model
- skill registry model
- runtime heartbeat / offline failure handling

### What NOT to merge from Multica

**Do not copy wholesale:**
- its separate Next.js frontend as a parallel UI product
- its full board/issue UI as a second shell
- its route architecture as a competing operator surface

### Merge stance

**Use Multica as backend/kernel donor, not as frontend owner.**

---

## 1.3 FounderOS donor

### Decision

FounderOS is now an **upstream shell/runtime donor already partially absorbed by Infinity**, not the new root.

Evidence:
- `/Users/martin/FounderOS/README.md`
- `/Users/martin/infinity/apps/README.md`
- `/Users/martin/infinity/latest-plan.md`

### What FounderOS still donates

- shell route grammar
- unified shell discipline
- cross-plane operator thinking
- Autopilot + Quorum aggregation model
- shared contracts direction

### What not to do

Do **not** treat FounderOS as the future root to build beside Infinity.

Instead:
- Infinity stays root.
- FounderOS remains upstream donor/reference + optional sync source.

---

## 1.4 Autopilot donor

### Key fact

There is **no standalone `/Users/martin/autopilot` root**.

The relevant Autopilot code lives inside FounderOS:
- `/Users/martin/FounderOS/autopilot`

Infinity already reflects Autopilot concepts via:
- `/Users/martin/infinity/packages/api-clients/src/autopilot.ts`
- `/Users/martin/infinity/apps/shell/apps/web/lib/route-scope.ts`
- `/Users/martin/infinity/apps/shell/apps/web/lib/execution-source.ts`

### What to carry forward

Autopilot donates:
- intake → PRD/spec → project launch semantics
- execution project / orchestrator session / approval / issue / event concepts
- control pass / control recommendation / project command policy ideas

### What to do with it

Do not merge raw Autopilot UI as a separate plane.
Use it as:
- domain semantics donor
- API shape donor
- migration guide for project/intake/orchestrator entities inside Infinity

---

## 1.5 Quorum donor

### Key fact

Quorum exists both as a standalone local repo and as a FounderOS submodule:
- `/Users/martin/quorum`
- `/Users/martin/FounderOS/quorum`

### What is useful there

Quorum looks strong as a **discovery/review/topology donor**, not as the execution kernel:
- `/Users/martin/quorum/orchestrator/modes/board.py`
- `/Users/martin/quorum/frontend/components/chat/topology-panel.tsx`

What it offers:
- multi-agent discussion / board / democracy / creator-critic / map-reduce patterns
- topology visualization patterns
- orchestrator-mode ideas
- discovery/review plane semantics

### How to use it in Infinity

Use Quorum as donor for:
- planner/reviewer strategy modes
- orchestration visualization
- discovery → execution conversion semantics
- board/review concepts for orchestrator oversight

Do not make Quorum a second runtime truth source.

---

## 1.6 Open WebUI donor

### Decision

Open WebUI remains the correct visual/workspace base.

Evidence:
- `/Users/martin/open-webui/AGENTS.md`
- `/Users/martin/open-webui/backend/open_webui/routers/hermes.py`
- `/Users/martin/open-webui/backend/open_webui/test/hermes/test_router.py`
- `/Users/martin/open-webui/backend/open_webui/test/hermes/test_utils.py`

### Strong donor assets

Open WebUI/Hermes-side donor pieces:
- Hermes runtime/session/workspace/profile routes
- session approval submission flow
- stream lifecycle
- workspace browse/file access
- real Hermes session import logic
- tests around stream/approval/session continuity

### Infinity rule

Infinity’s `apps/work-ui` must keep:
- Open WebUI identity
- transcript-first experience
- calm shell/workspace feel

Do not replace this with Multica frontend or dashboard-like cards.

---

## 1.7 Hermes / Hermes UI donor

### Current state

`/Users/martin/hermes-ui-martin` currently looks more like a **docs/audit/spec bundle** than a live reusable codebase.

Useful items identified:
- `hermes-ui-file-mapped-implementation-plan.md`
- `hermes_ui_remediation_master_spec_2026-04-12.md`
- `hermes_ui_unified_audit_2026-04-15.md`
- `hermes_ui_verified_addendum_2026-04-15.md`

### How to use it

Use as:
- UX behavior donor
- audit/history donor
- regression avoidance donor

Not as a primary code import root.

---

## 1.8 Hermes Memory donor

### Decision

`/Users/martin/hermesmemory` is the strongest continuity/knowledgebase donor found.

Evidence:
- `/Users/martin/hermesmemory/README.md`
- tests under `/Users/martin/hermesmemory/tests/*`

### What it gives

- local-first memory/KB engine
- raw ingest → compile → claims/provenance pipeline
- Hermes session import path
- controlled sidecar API / knowledgebase tools
- quality-oriented write restrictions and linting

### Recommended role in Infinity

Do **not** reimplement continuity from scratch inside shell first.

Use Hermes Memory as:
- sidecar continuity engine
- KB/provenance source
- Hermes session recall and project context source

Then connect it into Infinity shell/work-ui.

---

## 1.9 CloudDocs donor assets

### Important correction from user

CloudDocs is **not** reference-only by default.
It may contain useful donor docs/assets and must be inspected as a real source pool.

### High-value CloudDocs items found so far

- `/Users/martin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/FOUNDEROS-UNIFIED-SHELL-CONCEPT.md`
- `/Users/martin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/HANDOFF_2026-04-10_control-plane_codex_ui_and_continuity.md`

### Current conclusion

From the inspected CloudDocs slice, the highest-value items are currently **design/handoff/spec donors**, not active code repos.

This means:
- CloudDocs should absolutely stay in the donor search perimeter.
- But current evidence points to docs/architecture/history assets, not a better core code root than Infinity/Multica/Open WebUI.

---

## 2. What the final Infinity system must do end-to-end

## 2.1 User-visible flow

The system the user described should work like this:

1. User writes in Hermes/work-ui:
   - “I want to build X project.”
2. Infinity captures that as a structured intake.
3. Planner creates:
   - large spec / ТЗ
   - execution brief
   - decomposition graph
4. Orchestrator splits the work into bounded batches.
5. Infinity dispatches a limited number of independent tasks in parallel.
6. Executors report progress and artifacts.
7. Supervisor monitors:
   - stalled tasks
   - failed tasks
   - ambiguous specs
   - blocked approvals
8. On failure:
   - retry same executor, or
   - rewrite/clarify task, or
   - reassign to another executor, or
   - escalate to user if truly required.
9. Final assembly stage merges outputs into one coherent project state.
10. Verifier/reviewer/security gates run.
11. Hermes/Infinity notifies user:
   - project ready
   - where to test it
   - localhost / route / artifacts / outstanding risks

## 2.2 Final mental model

Map user intent to the final entities like this:

- user request → **Initiative**
- expanded TZ/spec → **Execution Brief**
- decomposed work graph → **Project + issues/tasks**
- batch execution → **Agent tasks / runtime runs**
- stuck/repair logic → **Supervisor directives + interventions**
- assembled final output → **Outcome**
- shell visibility → **Infinity control plane projections**

---

## 3. Final architecture inside Infinity

## 3.1 Keep current top-level Infinity shape

Keep existing roots:
- `/Users/martin/infinity/apps/shell`
- `/Users/martin/infinity/apps/work-ui`
- `/Users/martin/infinity/packages/*`
- `/Users/martin/infinity/references/*`

## 3.2 Add one new permanent root for the imported kernel

Create inside Infinity:
- `/Users/martin/infinity/services/execution-kernel`

This should be the selective import home for Multica backend/runtime code.

### Why a new service root is the right move

Because:
- Infinity already owns shell/work-ui.
- Multica should become the kernel, not a second web app.
- A dedicated service root keeps the merge clear and reversible.

## 3.3 Infinity layer ownership after the merge

### A. Shell / operator plane
Owns:
- boards
- approvals
- recoveries
- audits
- supervisor visibility
- orchestrator state projections
- route scope
- project/batch/session overview

Root:
- `/Users/martin/infinity/apps/shell/apps/web`

### B. Work UI / Hermes workspace
Owns:
- user intake conversation
- transcript
- files / tools / approvals in context
- session-local steering
- live task/project feedback

Root:
- `/Users/martin/infinity/apps/work-ui`

### C. Execution kernel
Owns:
- runtimes
- daemons
- task queue
- task messages
- projects / initiatives / briefs / outcomes
- supervisor directives / queue / interventions
- executor/provider routing

Root:
- `/Users/martin/infinity/services/execution-kernel`

### D. Continuity engine
Owns:
- memory / KB / provenance
- Hermes session import
- project context recall
- reusable knowledge artifacts

Initial deployment:
- external sidecar via `/Users/martin/hermesmemory`

### E. Normalized control-plane truth
Owns:
- canonical session IDs
- event normalization
- auditability
- approvals/recoveries/quota/control projections

Root:
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane`

---

## 4. Capability matrix — ECC-style behavior translated into Infinity

| ECC-style capability | Final Infinity home | Main donor | Action |
|---|---|---|---|
| planner + large spec generation | `apps/work-ui` intake + `services/execution-kernel` brief pipeline | Multica briefs + Autopilot semantics + Hermes | Keep and adapt |
| lazy skills | Hermes layer + executor profiles | Hermes / current Claude setup | Keep |
| slash-command workflows | work-ui + shell command actions | Hermes / Infinity | Keep and unify |
| specialist executors | execution-kernel agents/runtimes | Multica | Keep and adapt |
| bounded batch dispatch | execution-kernel supervisor/orchestrator | Multica + Quorum patterns | Keep and extend |
| automatic retry/reassign | supervisor queue + interventions | Multica + Infinity recoveries | Keep and extend |
| approvals / recoveries durable | shell control-plane | Infinity | Keep as source-of-truth |
| workspace host bridge | shell + work-ui bridge | Infinity | Keep |
| continuous learning / memory | Hermes Memory sidecar | hermesmemory | Keep, but inspectable |
| security stack audit | shell-side governance tools | Infinity + current security rules | Build natively |
| dashboard/operator visibility | shell boards | Infinity / FounderOS | Keep |
| second frontend from Multica | none | Multica frontend | Skip |
| install ECC wholesale | none | ECC | Skip |

---

## 5. Merge strategy by donor

## 5.1 Multica merge strategy

### Import nearly as-is

Into:
- `/Users/martin/infinity/services/execution-kernel`

Starting set:
- `server/internal/service/task.go`
- `server/internal/handler/daemon.go`
- `server/internal/daemon/*`
- `server/pkg/db/generated/*` and backing queries/migrations
- runtime/task/agent/project/brief/outcome/supervisor domains

### Import selectively into TypeScript packages

Create or extend:
- `/Users/martin/infinity/packages/api-clients/src/multica.ts`
- `/Users/martin/infinity/packages/api-clients/src/multica-types.ts`

Source donor:
- `/Users/martin/multica-selfhost/packages/core/api/client.ts`

### Do not import

- Multica’s standalone Next web app as a product UI

---

## 5.2 FounderOS / Autopilot / Quorum merge strategy

### FounderOS
- use as upstream shell discipline donor
- continue selective visual/route alignment into `apps/shell`

### Autopilot
- use as execution semantics donor already reflected in Infinity contracts/clients
- migrate concepts into the kernel-backed orchestration model

### Quorum
- use as planner/reviewer topology and discovery/review donor
- borrow orchestrator mode patterns and topology visualizations
- do not make it a second runtime truth source

---

## 5.3 Open WebUI / Hermes merge strategy

Keep current rule:
- Open WebUI visual base
- Hermes behavior
- Infinity embedded host awareness

### Important working rule

Do not let:
- Multica UI
n- Quorum UI
- shell/operator carding
replace the work-ui identity.

---

## 6. New canonical Infinity domains after the merge

These must be first-class inside the final system:

- Initiative
- ExecutionBrief
- Project
- Batch
- Task
- Runtime
- SupervisorDirective
- SupervisorQueueItem
- SupervisorIntervention
- Outcome
- AssemblyJob
- VerificationRun

### Domain mapping recommendation

Use Multica-native entities where they already exist:
- Initiative
- Project
- ExecutionBrief
- Outcome
- SupervisorDirective
- SupervisorQueue
- SupervisorIntervention
- AgentTask
- AgentRuntime

Add Infinity-specific projection entities only where shell/work-ui needs them:
- OrchestratorSessionProjection
- ProjectBatchProjection
- AssemblyProjection
- VerificationGateProjection

---

## 7. Contract decisions

## 7.1 Contracts to keep frozen from Infinity

Keep these as-is unless a contract-diff PR is explicitly approved:
- `ExecutionSessionSummary`
- `NormalizedExecutionEvent`
- host ↔ workspace bridge messages
- quota snapshot / capacity derivation
- approval response API

Evidence:
- `/Users/martin/infinity/contracts.md`

## 7.2 New contract family to add

Add a new **kernel-orchestration contract family** without breaking the existing shell/workspace freeze.

Recommended location:
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts`

This should define:
- InitiativeSummary
- ExecutionBriefSummary
- ProjectBatchSummary
- SupervisorQueueRecord
- SupervisorInterventionRecord
- OutcomeSummary
- AssemblyJobSummary

### Important rule

These new contracts must map cleanly to Multica kernel entities and then project into the existing Infinity session/event truth model.

---

## 8. Phased implementation plan

## Phase 0 — Freeze the Infinity-first direction

**Objective:** stop architectural drift before code merge begins.

**Files:**
- Modify: `/Users/martin/infinity/latest-plan.md`
- Modify: `/Users/martin/infinity/agents.md`
- Create: `/Users/martin/infinity/.hermes/plans/2026-04-18_infinity-native-orchestration-mega-system-master-plan.md`

**Deliverables:**
- Infinity explicitly declared as the permanent root.
- Multica explicitly declared as kernel donor.
- CloudDocs explicitly declared as searchable donor pool, not “reference-only”.

**Acceptance:**
- no ambiguity remains about root repo or donor ownership.

---

## Phase 1 — Import the execution kernel from Multica

**Objective:** land the kernel inside Infinity without changing product ownership.

**Files / roots:**
- Create: `/Users/martin/infinity/services/execution-kernel/`
- Source donor: `/Users/martin/multica-selfhost/server/*`
- Source donor: `/Users/martin/multica-selfhost/server/internal/service/task.go`
- Source donor: `/Users/martin/multica-selfhost/server/internal/handler/daemon.go`
- Source donor: `/Users/martin/multica-selfhost/server/internal/daemon/*`
- Source donor: `/Users/martin/multica-selfhost/server/pkg/db/*`

**Deliverables:**
- kernel compiles inside Infinity
- runtime registration works
- task enqueue/claim/start/complete/fail flows work
- task message persistence works
- runtimes can report heartbeat and go offline safely

**Acceptance:**
- Infinity can own the execution kernel locally without launching Multica’s separate web app.

---

## Phase 2 — Expose Multica kernel entities to Infinity shell/work-ui

**Objective:** make kernel-native projects/briefs/outcomes/supervisor visible to the product.

**Files:**
- Create: `/Users/martin/infinity/packages/api-clients/src/multica.ts`
- Create: `/Users/martin/infinity/packages/api-clients/src/multica-types.ts`
- Source donor: `/Users/martin/multica-selfhost/packages/core/api/client.ts`
- Create: `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts`
- Create: `/Users/martin/infinity/apps/shell/apps/web/lib/server/orchestration/*`

**Deliverables:**
- typed access to initiatives, briefs, projects, outcomes, supervisor queue, interventions
- shell-side projection layer from kernel → control-plane read model

**Acceptance:**
- shell can read orchestration state without duplicating kernel truth.

---

## Phase 3 — Intake in Hermes/work-ui → Initiative + Brief

**Objective:** make the user’s natural-language project request become structured execution input.

**Files:**
- Modify: `/Users/martin/infinity/apps/work-ui/src/lib/founderos/*`
- Create: `/Users/martin/infinity/apps/work-ui/src/lib/orchestration/intake.ts`
- Create: `/Users/martin/infinity/apps/work-ui/src/lib/orchestration/briefs.ts`
- Extend shell API routes under:
  - `/Users/martin/infinity/apps/shell/apps/web/app/api/control/orchestration/*`

**Deliverables:**
- user can start a project request from work-ui
- planner run creates Initiative
- spec/TZ becomes ExecutionBrief
- brief is stored durably and visible in shell

**Acceptance:**
- one user message can create a real orchestration record chain.

---

## Phase 4 — Brief decomposition → bounded task graph

**Objective:** convert big briefs into ordered, dependency-aware work batches.

**Files:**
- kernel planner/supervisor roots inside `services/execution-kernel`
- shell projection + APIs under `apps/shell/apps/web/lib/server/orchestration/*`
- UI components under `apps/shell/apps/web/components/execution/*`

**Deliverables:**
- decompose brief into tasks/subtasks
- assign executor types
- mark dependency graph
- group parallelizable tasks into bounded batches
- keep configurable parallel width (e.g. 3 at once)

**Acceptance:**
- system can produce a plan that is executable in waves, not one giant dispatch.

---

## Phase 5 — Batch dispatch + live reporting

**Objective:** run tasks in controlled parallel waves and feed progress back into Infinity.

**Files:**
- `services/execution-kernel/*`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/workspace/runtime-ingest.ts`
- `/Users/martin/infinity/apps/shell/apps/web/components/execution/workspace-handoff-surface.tsx`
- `/Users/martin/infinity/apps/work-ui/src/lib/founderos/bridge.ts`

**Deliverables:**
- dispatch N independent tasks in one batch
- capture task messages, progress, output, usage
- sync executor progress into shell/workspace via existing runtime ingest bridge

**Acceptance:**
- user sees batch progress live in Infinity without a second UI.

---

## Phase 6 — Supervisor monitoring, recovery, and reassignment

**Objective:** make the orchestrator resilient instead of linear.

**Files:**
- kernel supervisor domain
- shell approval/recovery/audit surfaces
- new orchestration projections

**Deliverables:**
- detect stuck/failed tasks
- create supervisor directives
- create interventions
- retry same executor
- retry different executor
- rewrite/clarify task
- fallback account/provider when policy allows

**Acceptance:**
- failures become operator-visible, auditable, and repairable.

---

## Phase 7 — Assembly step

**Objective:** explicitly merge partial outputs into one coherent project state.

**Files:**
- Create: `/Users/martin/infinity/apps/shell/apps/web/lib/server/orchestration/assembly.ts`
- Create: `/Users/martin/infinity/apps/shell/apps/web/app/api/control/orchestration/assembly/*`
- Create UI summary components in shell/work-ui

**Deliverables:**
- final assembly job exists as first-class task
- can consume task outputs/artifacts/diffs
- emits merged outcome record

**Acceptance:**
- the system does not assume “all tasks done” == “project assembled”.

---

## Phase 8 — Review / verification / localhost-ready handoff

**Objective:** end with a real operator result, not just finished tasks.

**Files:**
- shell audit/review lanes
- work-ui result panels
- orchestration outcome/verification routes

**Deliverables:**
- reviewer pass
- security pass when relevant
- release-verifier / verification run
- final result message containing:
  - what was built
  - where it runs
  - localhost / route / artifacts
  - known risks / TODOs

**Acceptance:**
- user gets a clear “project ready to test” outcome.

---

## Phase 9 — Continuity and memory integration

**Objective:** give the system inspectable long-term memory.

**Files / systems:**
- external donor: `/Users/martin/hermesmemory`
- Infinity adapters to Hermes Memory sidecar
- shell/work-ui context entry points

**Deliverables:**
- project context retrieval before planning
- Hermes session recall for active projects
- KB-backed continuity for ongoing long builds
- provenance-aware memory, not black-box drift

**Acceptance:**
- planner and supervisor can use prior context without hidden mutation.

---

## Phase 10 — Security / governance layer

**Objective:** add Infinity-native equivalent of AgentShield, scoped to the real stack.

**Files:**
- Create: `/Users/martin/infinity/scripts/agent-stack-audit.*`
- Create: `/Users/martin/infinity/apps/shell/apps/web/lib/server/governance/*`

**Must scan:**
- AGENTS / CLAUDE / profiles / skills / wrappers
- shell/work-ui bridge permissions
- MCP configs
- secrets in docs/configs
- dangerous hooks / wrapper commands
- overly broad runtime permissions

**Acceptance:**
- one bounded audit command/report exists before scaling the system.

---

## 9. What to implement first

If starting actual build work now, do it in this order:

1. **Freeze direction in docs**
2. **Import Multica kernel into `services/execution-kernel`**
3. **Expose briefs/projects/supervisor via Infinity API clients**
4. **Add intake → brief creation from work-ui/Hermes**
5. **Add decomposition + batch model**
6. **Connect batch dispatch to existing runtime ingest**
7. **Add supervisor interventions / reassignment**
8. **Add assembly job**
9. **Add verification/result handoff**
10. **Add Hermes Memory integration**
11. **Add native stack audit**

---

## 10. Non-negotiables

- No new third root project.
- Infinity remains the main repo.
- No blind merge of Multica frontend.
- No replacement of Open WebUI workspace feel.
- No second parallel session truth model.
- No bypass of existing Infinity contract freeze.
- No “install ECC as product architecture”.
- CloudDocs stays in donor search scope.
- FounderOS is already conceptually inside Infinity; do not branch product ownership back out.

---

## 11. Final implementation stance

### Short version

**Infinity is the product.**

**Multica is the execution kernel to merge into it.**

**Open WebUI remains the workspace feel.**

**Hermes remains the behavior and continuity layer.**

**FounderOS / Autopilot / Quorum remain design/runtime donors already flowing into Infinity.**

### One-line formula

> Keep Infinity as the shell and control-plane truth, merge Multica as the kernel, keep Open WebUI as the workspace, use Hermes/Hermes Memory for behavior and continuity, and let the final system turn natural-language project requests into supervised, batched, recoverable execution.

---

## 12. First concrete coding package after approval

The first real implementation package should create:

- `services/execution-kernel/` from Multica backend
- `packages/api-clients/src/multica.ts`
- `packages/api-clients/src/multica-types.ts`
- `apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts`
- `apps/shell/apps/web/lib/server/orchestration/*`
- `apps/shell/apps/web/app/api/control/orchestration/*`
- `apps/work-ui/src/lib/orchestration/intake.ts`
- `apps/work-ui/src/lib/orchestration/briefs.ts`

That package is the minimum needed to convert this from a research spec into a live Infinity-native orchestration system.
