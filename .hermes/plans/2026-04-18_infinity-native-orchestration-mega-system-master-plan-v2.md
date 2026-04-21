# Infinity Native Orchestration Mega-System — Master Plan & Spec v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/Users/martin/infinity` into a single Infinity-first orchestration product that can accept a natural-language project request in Hermes/work-ui, generate a full TZ/spec + execution brief, decompose it into bounded tasks, dispatch those tasks through a real execution kernel in controlled parallel batches, monitor and repair failures, assemble the final result, run verification, and notify the user with a concrete local output to test.

**Architecture:** Infinity remains the only root product and the only product UI owner. `apps/shell` stays the operator control plane. `apps/work-ui` stays the embedded Open WebUI/Hermes workspace. A new `services/execution-kernel` root inside Infinity absorbs Multica Selfhost’s backend/runtime/supervisor/task system. Hermes Memory remains the continuity engine via sidecar integration, not a hidden prompt blob.

**Tech Stack:** Infinity monorepo (Next.js/React/TypeScript + SvelteKit), new embedded Go execution kernel from Multica, existing Infinity Postgres-backed control-plane contracts, Open WebUI Hermes bridge, Hermes Memory sidecar, FounderOS/Quorum/Autopilot donors, CloudDocs spec/handoff donors.

---

## 0. Hard decisions locked in by v2

## 0.1 Root product decision

**Infinity is the root.**

Do not create:
- a new mega repo,
- a parallel FounderOS root,
- a separate Multica product shell.

Authoritative implementation home:
- `/Users/martin/infinity`

## 0.2 Existing Infinity truth that v2 preserves

Infinity already contains:
- editable shell root:
  - `/Users/martin/infinity/apps/shell`
- editable workspace root:
  - `/Users/martin/infinity/apps/work-ui`
- support packages:
  - `/Users/martin/infinity/packages/api-clients`
  - `/Users/martin/infinity/packages/config`
  - `/Users/martin/infinity/packages/ui`
- frozen contract layer:
  - `/Users/martin/infinity/contracts.md`
- integration boundary docs:
  - `/Users/martin/infinity/repo-map.md`
  - `/Users/martin/infinity/directories.md`
  - `/Users/martin/infinity/latest-plan.md`
- host/workspace bridge and runtime-ingest logic:
  - `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts`
  - `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/workspace/runtime-ingest.ts`
  - `/Users/martin/infinity/apps/work-ui/src/lib/founderos/bridge.ts`
  - `/Users/martin/infinity/apps/work-ui/src/lib/founderos/bootstrap.ts`

## 0.3 Merge doctrine

- Infinity owns product UI and product contracts.
- Multica contributes execution kernel and orchestration backend.
- Open WebUI contributes workspace feel and Hermes runtime bridge patterns.
- FounderOS contributes shell thinking and existing already-absorbed direction.
- Quorum contributes discovery/orchestrator mode patterns.
- Hermes Memory contributes continuity/knowledgebase.
- CloudDocs contributes specs, handoffs, architecture notes, and any reusable archived assets found there.

---

## 1. Exact target directory tree inside Infinity

This is the **intended future tree**, not a vague concept tree.

```text
/Users/martin/infinity/
├── apps/
│   ├── shell/
│   │   └── apps/web/
│   │       ├── app/
│   │       │   └── api/control/
│   │       │       ├── accounts/
│   │       │       ├── execution/
│   │       │       ├── orchestration/              # NEW
│   │       │       │   ├── initiatives/            # NEW
│   │       │       │   ├── briefs/                 # NEW
│   │       │       │   ├── projects/               # NEW
│   │       │       │   ├── batches/                # NEW
│   │       │       │   ├── supervisor/             # NEW
│   │       │       │   ├── assembly/               # NEW
│   │       │       │   └── verification/           # NEW
│   │       ├── components/
│   │       │   ├── execution/
│   │       │   └── orchestration/                  # NEW
│   │       │       ├── initiative-workspace.tsx    # NEW
│   │       │       ├── brief-workspace.tsx         # NEW
│   │       │       ├── batch-workspace.tsx         # NEW
│   │       │       ├── supervisor-queue.tsx        # NEW
│   │       │       ├── assembly-workspace.tsx      # NEW
│   │       │       └── verification-workspace.tsx  # NEW
│   │       ├── lib/
│   │       │   ├── server/
│   │       │   │   ├── control-plane/
│   │       │   │   │   ├── contracts/
│   │       │   │   │   │   ├── workspace-launch.ts
│   │       │   │   │   │   ├── session-events.ts
│   │       │   │   │   │   └── orchestration.ts    # NEW
│   │       │   │   │   ├── workspace/
│   │       │   │   │   ├── approvals/
│   │       │   │   │   ├── recoveries/
│   │       │   │   │   ├── audits/
│   │       │   │   │   ├── events/
│   │       │   │   │   ├── sessions/
│   │       │   │   │   └── state/
│   │       │   │   └── orchestration/              # NEW
│   │       │   │       ├── initiatives.ts          # NEW
│   │       │   │       ├── briefs.ts               # NEW
│   │       │   │       ├── projects.ts             # NEW
│   │       │   │       ├── batches.ts              # NEW
│   │       │   │       ├── supervisor.ts           # NEW
│   │       │   │       ├── assembly.ts             # NEW
│   │       │   │       ├── verification.ts         # NEW
│   │       │   │       └── projections.ts          # NEW
│   ├── work-ui/
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── founderos/
│   │       │   ├── apis/
│   │       │   │   ├── hermes/
│   │       │   │   └── orchestration/              # NEW
│   │       │   │       ├── initiatives.ts          # NEW
│   │       │   │       ├── briefs.ts               # NEW
│   │       │   │       ├── batches.ts              # NEW
│   │       │   │       └── verification.ts         # NEW
│   │       │   ├── orchestration/                  # NEW
│   │       │   │   ├── intake.ts                   # NEW
│   │       │   │   ├── brief-builder.ts            # NEW
│   │       │   │   ├── planner-launch.ts           # NEW
│   │       │   │   ├── batch-progress.ts           # NEW
│   │       │   │   └── outcome-handoff.ts          # NEW
│   │       │   └── utils/
│   │       └── routes/
│   │           └── (app)/
│   │               ├── project-intake/             # NEW
│   │               ├── project-brief/[id]/         # NEW
│   │               ├── project-run/[id]/           # NEW
│   │               └── project-result/[id]/        # NEW
├── packages/
│   ├── api-clients/
│   │   └── src/
│   │       ├── autopilot.ts
│   │       ├── multica.ts                          # NEW
│   │       ├── multica-types.ts                    # NEW
│   │       ├── orchestration.ts                    # NEW
│   │       └── index.ts
│   ├── config/
│   ├── ui/
│   ├── typescript-config/
│   └── eslint-config/
├── services/                                       # NEW ROOT
│   └── execution-kernel/                           # NEW ROOT
│       ├── cmd/
│       ├── internal/
│       │   ├── daemon/
│       │   ├── handler/
│       │   ├── service/
│       │   ├── realtime/
│       │   ├── auth/
│       │   ├── middleware/
│       │   ├── events/
│       │   ├── logger/
│       │   └── supervisor/                         # NEW (if not imported directly)
│       ├── pkg/
│       │   ├── db/
│       │   └── agent/
│       ├── migrations/
│       ├── scripts/
│       └── README.md                               # NEW
├── docs/
│   └── orchestration/                              # NEW
│       ├── donor-map.md                            # NEW
│       ├── merge-plan.md                           # NEW
│       ├── contracts-orchestration.md              # NEW
│       ├── rollout-plan.md                         # NEW
│       └── continuity-integration.md               # NEW
├── references/
│   ├── founderos/
│   ├── open-webui/
│   ├── hermes-webui/
│   └── cabinet/
└── .hermes/
    └── plans/
```

### Why this tree

- Keeps shell/work-ui ownership intact.
- Creates one explicit home for the imported kernel.
- Avoids smearing Multica backend code into shell UI directories.
- Gives orchestration its own shell-side projections and work-ui-side APIs.
- Preserves the current Infinity contract boundary model.

---

## 2. Donor repo → Infinity path matrix

## 2.1 Primary donor mapping table

| Donor | What to take | Infinity destination | Action type |
|---|---|---|---|
| `/Users/martin/multica-selfhost/server` | backend runtime/task/daemon/realtime/db/agent SDK | `/Users/martin/infinity/services/execution-kernel` | copy + adapt |
| `/Users/martin/multica-selfhost/packages/core/api/client.ts` | typed client surface for projects/briefs/supervisor/runtimes/tasks | `/Users/martin/infinity/packages/api-clients/src/multica.ts` and `multica-types.ts` | port |
| `/Users/martin/multica-selfhost/packages/core/supervisor/*` | supervisor queries/mutations semantics | `/Users/martin/infinity/packages/api-clients/src/orchestration.ts` and shell orchestration services | port/adapt |
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/*` | canonical session/events/approvals/recoveries/audits truth | keep in place | preserve |
| `/Users/martin/infinity/apps/work-ui/src/lib/founderos/*` | embedded host/workspace bridge | keep in place | preserve |
| `/Users/martin/open-webui/backend/open_webui/routers/hermes.py` | Hermes runtime/session/approval/workspace routes semantics | `apps/work-ui` adapters + shell orchestration intake flows | reference/port |
| `/Users/martin/open-webui/backend/open_webui/test/hermes/*` | continuity/approval/session tests | `apps/work-ui` and orchestration tests | port patterns |
| `/Users/martin/FounderOS/autopilot` | intake/project/orchestrator semantics | `packages/api-clients/src/autopilot.ts` + new orchestration contracts | semantic donor |
| `/Users/martin/FounderOS/quorum` and `/Users/martin/quorum` | board/democracy/creator-critic/topology patterns | planner/supervisor strategies + optional shell visualizations | selective donor |
| `/Users/martin/hermesmemory` | continuity/KB sidecar | external sidecar integrated via adapters/docs | external retained |
| CloudDocs `FOUNDEROS-UNIFIED-SHELL-CONCEPT.md` | historical unified shell ideas | `docs/orchestration/donor-map.md` and UX constraints | docs donor |
| CloudDocs `HANDOFF_2026-04-10_control-plane_codex_ui_and_continuity.md` | continuity / codex / control-plane handoff knowledge | `docs/orchestration/continuity-integration.md` | docs donor |

---

## 2.2 File-by-file high-value donor mapping

### Multica backend → Infinity execution kernel

| From | To |
|---|---|
| `/Users/martin/multica-selfhost/server/internal/service/task.go` | `/Users/martin/infinity/services/execution-kernel/internal/service/task.go` |
| `/Users/martin/multica-selfhost/server/internal/handler/daemon.go` | `/Users/martin/infinity/services/execution-kernel/internal/handler/daemon.go` |
| `/Users/martin/multica-selfhost/server/internal/daemon/types.go` | `/Users/martin/infinity/services/execution-kernel/internal/daemon/types.go` |
| `/Users/martin/multica-selfhost/server/internal/realtime/*` | `/Users/martin/infinity/services/execution-kernel/internal/realtime/*` |
| `/Users/martin/multica-selfhost/server/internal/events/*` | `/Users/martin/infinity/services/execution-kernel/internal/events/*` |
| `/Users/martin/multica-selfhost/server/internal/logger/*` | `/Users/martin/infinity/services/execution-kernel/internal/logger/*` |
| `/Users/martin/multica-selfhost/server/internal/auth/*` | `/Users/martin/infinity/services/execution-kernel/internal/auth/*` |
| `/Users/martin/multica-selfhost/server/internal/middleware/*` | `/Users/martin/infinity/services/execution-kernel/internal/middleware/*` |
| `/Users/martin/multica-selfhost/server/pkg/agent/*` | `/Users/martin/infinity/services/execution-kernel/pkg/agent/*` |
| `/Users/martin/multica-selfhost/server/pkg/db/*` | `/Users/martin/infinity/services/execution-kernel/pkg/db/*` |
| `/Users/martin/multica-selfhost/server/migrations/*` | `/Users/martin/infinity/services/execution-kernel/migrations/*` |

### Multica typed client/API surface → Infinity packages

| From | To |
|---|---|
| `/Users/martin/multica-selfhost/packages/core/api/client.ts` | `/Users/martin/infinity/packages/api-clients/src/multica.ts` |
| `types embedded in same client file` | `/Users/martin/infinity/packages/api-clients/src/multica-types.ts` |
| `/Users/martin/multica-selfhost/packages/core/supervisor/queries.ts` | `/Users/martin/infinity/packages/api-clients/src/orchestration.ts` |
| `/Users/martin/multica-selfhost/packages/core/supervisor/mutations.ts` | `/Users/martin/infinity/packages/api-clients/src/orchestration.ts` |

### Infinity shell contract layer remains authoritative

| Existing Infinity file | Role |
|---|---|
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts` | keep as canonical host/workspace bridge and workspace runtime ingest envelope |
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/workspace/runtime-ingest.ts` | keep as canonical workspace → shell event persistence seam |
| `/Users/martin/infinity/contracts.md` | keep as frozen contract source until explicit diff |

### New shell orchestration layer

| New file | Purpose |
|---|---|
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts` | new orchestration-facing canonical contracts |
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/orchestration/initiatives.ts` | initiative service + projection glue |
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/orchestration/briefs.ts` | brief service + decomposition glue |
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/orchestration/projects.ts` | project projection service |
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/orchestration/batches.ts` | batch grouping/projection logic |
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/orchestration/supervisor.ts` | supervisor queue/intervention projection logic |
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/orchestration/assembly.ts` | final merge/assembly job logic |
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/orchestration/verification.ts` | verification/result state logic |
| `/Users/martin/infinity/apps/shell/apps/web/lib/server/orchestration/projections.ts` | kernel → shell projection reducers |

### New work-ui orchestration layer

| New file | Purpose |
|---|---|
| `/Users/martin/infinity/apps/work-ui/src/lib/orchestration/intake.ts` | transform user request into initiative/brief launch payload |
| `/Users/martin/infinity/apps/work-ui/src/lib/orchestration/brief-builder.ts` | spec/TZ composition helpers |
| `/Users/martin/infinity/apps/work-ui/src/lib/orchestration/planner-launch.ts` | launch planning/decomposition flow |
| `/Users/martin/infinity/apps/work-ui/src/lib/orchestration/batch-progress.ts` | live batch progress state |
| `/Users/martin/infinity/apps/work-ui/src/lib/orchestration/outcome-handoff.ts` | final result notification + local run handoff |
| `/Users/martin/infinity/apps/work-ui/src/lib/apis/orchestration/*` | typed fetchers to shell orchestration APIs |

### Continuity integration

| From | To |
|---|---|
| `/Users/martin/hermesmemory` sidecar/API | integrated externally; documented in `/Users/martin/infinity/docs/orchestration/continuity-integration.md` |
| `Hermes session import logic and KB patterns` | adapters under shell/work-ui orchestration services |

---

## 3. Repo-by-repo decision matrix

## 3.1 Infinity

**Status:** root product, source-of-truth

**Keep as owner of:**
- shell
- work-ui integration
- bridge contracts
- normalized event truth
- approvals/recoveries/audits/quota/session projections
- rollout discipline

**Do not replace.**

## 3.2 Multica Selfhost

**Status:** merge donor, backend-heavy

**Keep:**
- backend/kernel logic
- supervisor and task lifecycle
- runtime and daemon primitives
- project/brief/outcome model

**Do not keep as product owner:**
- separate web app
- separate route family as final UI product

## 3.3 FounderOS

**Status:** upstream shell donor already conceptually inside Infinity

**Keep:**
- shell philosophy
- route grammar
- control-plane structuring logic
- pinned Autopilot/Quorum relationship knowledge

**Do not restore as a separate future root.**

## 3.4 Open WebUI

**Status:** workspace donor and active identity baseline

**Keep:**
- workspace visual identity
- transcript/composer/files feel
- Hermes runtime route patterns

**Do not overwrite with dashboard UX.**

## 3.5 Quorum

**Status:** selective orchestration/discovery donor

**Keep:**
- board/democracy/creator-critic/map-reduce orchestration ideas
- topology UI patterns
- discovery/review semantics

**Do not use as execution kernel or second operator truth source.**

## 3.6 Hermes UI Martin

**Status:** docs/audit/spec donor

**Keep:**
- audit findings
- remediation/spec guidance
- behavior notes

**Do not treat as main code import source.**

## 3.7 Hermes Memory

**Status:** continuity sidecar donor

**Keep:**
- ingest/compile/claims/provenance/knowledgebase architecture
- Hermes session import pipeline
- inspectable continuity

**Integrate externally before rewriting anything natively.**

## 3.8 CloudDocs

**Status:** searchable donor archive

**Keep in search perimeter for:**
- specs
- handoffs
- archived IA concepts
- donor docs
- possible forgotten useful bundles

**Current evidence:** strong docs donor, not a stronger root than Infinity.

---

## 4. Precise merge plan by phases and files

## Phase A — Documentation freeze and merge target declaration

### Create/update
- [ ] Modify `/Users/martin/infinity/latest-plan.md`
- [ ] Modify `/Users/martin/infinity/agents.md`
- [ ] Modify `/Users/martin/infinity/repo-map.md`
- [ ] Create `/Users/martin/infinity/docs/orchestration/donor-map.md`
- [ ] Create `/Users/martin/infinity/docs/orchestration/merge-plan.md`
- [ ] Create `/Users/martin/infinity/docs/orchestration/contracts-orchestration.md`

### Result
- Infinity root decision is explicit.
- Multica kernel merge destination is explicit.
- donor map is documented.

---

## Phase B — Create kernel root inside Infinity

### Create
- [ ] `/Users/martin/infinity/services/execution-kernel/README.md`
- [ ] `/Users/martin/infinity/services/execution-kernel/cmd/`
- [ ] `/Users/martin/infinity/services/execution-kernel/internal/`
- [ ] `/Users/martin/infinity/services/execution-kernel/pkg/`
- [ ] `/Users/martin/infinity/services/execution-kernel/migrations/`

### Import first wave from Multica
- [ ] copy `server/internal/service/task.go`
- [ ] copy `server/internal/handler/daemon.go`
- [ ] copy `server/internal/daemon/*`
- [ ] copy `server/internal/realtime/*`
- [ ] copy `server/internal/events/*`
- [ ] copy `server/internal/logger/*`
- [ ] copy `server/pkg/agent/*`
- [ ] copy `server/pkg/db/*`
- [ ] copy `server/migrations/*`

### Adaptation rules
- [ ] rename package/module references to Infinity-local paths only after import lands
- [ ] do not rewrite architecture during import
- [ ] keep backend functionality intact before adding product-specific changes

---

## Phase C — Typed client and API surface import

### Create
- [ ] `/Users/martin/infinity/packages/api-clients/src/multica.ts`
- [ ] `/Users/martin/infinity/packages/api-clients/src/multica-types.ts`
- [ ] `/Users/martin/infinity/packages/api-clients/src/orchestration.ts`

### Port from donor
- [ ] port project APIs
- [ ] port initiative APIs
- [ ] port brief APIs
- [ ] port outcome APIs
- [ ] port runtime/task APIs
- [ ] port supervisor directive/queue/intervention APIs

### Result
- shell/work-ui can talk to the embedded kernel via Infinity-local typed clients

---

## Phase D — New orchestration contracts in shell

### Create
- [ ] `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts`

### Define
- [ ] `InitiativeSummary`
- [ ] `ExecutionBriefSummary`
- [ ] `ExecutionBriefDetail`
- [ ] `ProjectBatchSummary`
- [ ] `KernelTaskSummary`
- [ ] `SupervisorQueueRecord`
- [ ] `SupervisorInterventionRecord`
- [ ] `AssemblyJobRecord`
- [ ] `VerificationRunRecord`
- [ ] `OutcomeSummary`

### Rule
- [ ] do not mutate frozen session/event contracts to fit kernel semantics
- [ ] instead project kernel entities into shell contracts cleanly

---

## Phase E — Shell orchestration projection layer

### Create
- [ ] `lib/server/orchestration/initiatives.ts`
- [ ] `lib/server/orchestration/briefs.ts`
- [ ] `lib/server/orchestration/projects.ts`
- [ ] `lib/server/orchestration/batches.ts`
- [ ] `lib/server/orchestration/supervisor.ts`
- [ ] `lib/server/orchestration/assembly.ts`
- [ ] `lib/server/orchestration/verification.ts`
- [ ] `lib/server/orchestration/projections.ts`

### Responsibilities
- [ ] read from execution kernel
- [ ] project into operator-friendly records
- [ ] connect to existing control-plane session/event truth where needed
- [ ] expose auditable state to shell components

---

## Phase F — Shell API routes

### Create
- [ ] `app/api/control/orchestration/initiatives/*`
- [ ] `app/api/control/orchestration/briefs/*`
- [ ] `app/api/control/orchestration/projects/*`
- [ ] `app/api/control/orchestration/batches/*`
- [ ] `app/api/control/orchestration/supervisor/*`
- [ ] `app/api/control/orchestration/assembly/*`
- [ ] `app/api/control/orchestration/verification/*`

### Result
- work-ui and shell share one Infinity-authored orchestration API surface

---

## Phase G — Work-ui intake and orchestration UX

### Create
- [ ] `src/lib/orchestration/intake.ts`
- [ ] `src/lib/orchestration/brief-builder.ts`
- [ ] `src/lib/orchestration/planner-launch.ts`
- [ ] `src/lib/orchestration/batch-progress.ts`
- [ ] `src/lib/orchestration/outcome-handoff.ts`
- [ ] `src/lib/apis/orchestration/initiatives.ts`
- [ ] `src/lib/apis/orchestration/briefs.ts`
- [ ] `src/lib/apis/orchestration/batches.ts`
- [ ] `src/lib/apis/orchestration/verification.ts`

### Routes to add
- [ ] `src/routes/(app)/project-intake/`
- [ ] `src/routes/(app)/project-brief/[id]/`
- [ ] `src/routes/(app)/project-run/[id]/`
- [ ] `src/routes/(app)/project-result/[id]/`

### Result
- the user’s natural-language project request becomes a real orchestration object flow

---

## Phase H — Batch execution and supervisor repair loop

### Kernel work
- [ ] add decomposition service if not already present
- [ ] add batch grouping layer
- [ ] add parallel-width control
- [ ] add retry/reassign policies
- [ ] add supervisor intervention actions

### Shell work
- [ ] render queue/intervention/blocked/stuck states
- [ ] map failures to recoveries/audit objects where relevant

### Work-ui work
- [ ] render batch progress and current phase in project-run flow

---

## Phase I — Final assembly and verification

### Create shell services
- [ ] `assembly.ts`
- [ ] `verification.ts`

### UX result
- [ ] explicit assembly stage exists
- [ ] explicit verification stage exists
- [ ] final Hermes/Infinity result message can include localhost path, route, artifacts, risks

---

## Phase J — Continuity integration via Hermes Memory

### Add docs and adapters
- [ ] document sidecar setup in `docs/orchestration/continuity-integration.md`
- [ ] create shell-side adapter for KB lookup
- [ ] create work-ui prefill/context hook for planning input

### Rule
- [ ] use Hermes Memory as an inspectable sidecar, not hidden drift logic

---

## Phase K — Native stack audit

### Create
- [ ] `/Users/martin/infinity/scripts/agent-stack-audit.*`
- [ ] `/Users/martin/infinity/apps/shell/apps/web/lib/server/governance/*`

### Scan targets
- [ ] AGENTS / CLAUDE / wrappers / MCP configs / hooks / secrets / dangerous permissions

---

## 5. What is copied vs what is wrapped vs what stays external

## Copy into Infinity
- Multica backend/kernel code
- Multica typed client semantics
- selected supervisor domain helpers

## Port/adapt into Infinity
- Open WebUI Hermes route semantics
- Autopilot domain semantics
- Quorum orchestration mode ideas
- FounderOS shell route/pattern knowledge

## Keep external and integrate
- Hermes Memory engine

## Keep as docs/audit donors only
- Hermes UI Martin spec/audit bundles
- CloudDocs handoff/spec documents (unless later code bundles are found and proven useful)

---

## 6. Non-negotiable v2 rules

1. Infinity remains the only root product.
2. No second web product from Multica is allowed inside the final UX.
3. Existing Infinity frozen contracts remain frozen until explicit contract diff.
4. Open WebUI visual/workspace identity must survive.
5. Kernel truth and shell truth are not the same thing: kernel executes, shell projects.
6. Continuity must remain inspectable.
7. CloudDocs stays inside the donor search boundary.
8. If a task spans shell + work-ui + kernel + continuity at once, split it.

---

## 7. Final one-line implementation formula

> Build the ECC-style system natively by keeping Infinity as the product shell and contract owner, importing Multica as `services/execution-kernel`, preserving Open WebUI as the workspace feel, using Hermes/Hermes Memory for behavior and continuity, and exposing the whole flow through Infinity-authored orchestration APIs and operator surfaces.

---

## 8. Immediate next implementation package after this v2

If proceeding to actual build work, the first implementation package should include exactly:

- `services/execution-kernel/` scaffold
- first Multica backend import wave
- `packages/api-clients/src/multica.ts`
- `packages/api-clients/src/multica-types.ts`
- `apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts`
- `apps/shell/apps/web/lib/server/orchestration/{initiatives,briefs,projects,batches,supervisor}.ts`
- `apps/shell/apps/web/app/api/control/orchestration/{initiatives,briefs,projects,supervisor}/*`
- `apps/work-ui/src/lib/orchestration/{intake,brief-builder,planner-launch}.ts`

That is the smallest real package that converts the spec into a live merge path.
