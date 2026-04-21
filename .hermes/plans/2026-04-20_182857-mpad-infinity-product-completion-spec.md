# M-pad Infinity — detailed product completion spec

> For Hermes: planning only. Do not implement from this document in the same turn. Use this as the working source of truth for bringing Infinity from powerful scaffold to real daily-driver product.

Goal: turn `/Users/martin/infinity` into the canonical, usable, pleasant, trustworthy product Martin originally intended: one operator system with a real shell, a real work mode, real orchestration, and real execution continuity.

Architecture: keep Infinity as the only editable integration workspace; keep `FounderOS`, `open-webui`, and `hermes-webui` as read-only donor/reference repos; finish Infinity as one product with two natural modes:
- Control mode = shell + operator control plane
- Work mode = embedded workspace + transcript + files + approvals + execution handling

Tech stack / implementation roots:
- Shell: `/Users/martin/infinity/apps/shell/apps/web`
- Embedded workspace: `/Users/martin/infinity/apps/work-ui`
- Shared packages: `/Users/martin/infinity/packages/*`
- Execution substrate: `/Users/martin/infinity/services/execution-kernel`
- Canonical frozen contracts: `/Users/martin/infinity/contracts.md`
- Project rules: `/Users/martin/infinity/AGENTS.md`
- Current macro vision: `/Users/martin/infinity/latest-plan.md`
- Master product spec: `/Users/martin/infinity/unified-control-plane-super-spec-v2-2026-04-10.md`

---

## 1. What this spec is solving

The hard part is no longer “what should Infinity be?”

That answer already exists in the codebase and docs:
- Infinity is the canonical merge workspace
- FounderOS is the shell donor
- Open WebUI is the workspace donor
- Hermes is the behavioral donor
- the target is one product, not one repo rewrite and not a generic AI dashboard

The hard part now is this:
- too much exists as powerful scaffolding
- too much is split between “real” and “placeholder-feeling” surfaces
- the system already has deep backend/control-plane work, but the visible product still does not consistently feel finished, calm, or delightful

This spec defines exactly how to close that gap.

---

## 2. Grounded current-state assessment

This assessment is based on live inspection of the current Infinity workspace.

### 2.1 What is already strong

#### A. Shell-side control-plane backend is already far beyond prototype
Observed in:
- `apps/shell/apps/web/lib/server/control-plane/*`
- `apps/shell/apps/web/lib/server/orchestration/*`
- `latest-plan.md`

Already implemented or materially present:
- shell-owned control-plane state model
- Postgres-priority + file fallback durability paths
- approvals / recoveries / audits / accounts / sessions / workspace launch flows
- normalized event ingestion and session projection
- orchestration entities and APIs:
  - initiative
  - brief
  - task graph
  - work unit
  - batch
  - supervisor action
  - assembly
  - verification
  - delivery
- continuity lane linking orchestration objects with approvals/recoveries via `sessionId`

This means Infinity is not missing “backend ideas.”
It is mostly missing product convergence, route truth, happy-path UX, and end-to-end closure.

#### B. Work UI is already a real embedded app, not just a mock
Observed in:
- `apps/work-ui/src/routes/(app)/+layout.svelte`
- `apps/work-ui/src/lib/founderos/*`
- `apps/work-ui/src/lib/components/chat/*`
- `apps/work-ui/src/lib/components/hermes/*`

Already present:
- embedded launch/bootstrap flow
- host/workspace bridge
- trusted-origin message contract
- session exchange / embedded bootstrap behavior
- Hermes-aware transcript handling
- workspace/file browsing
- approvals and operational transcript elements
- operator side rail panels

This means Work UI is not starting from zero either.
It already has substance; it needs reduction of roughness, route completion, rebranding, happy-path cleanup, and better product hierarchy.

#### C. Infinity already contains the right orchestration vocabulary
Observed in:
- `packages/api-clients/src/orchestration.ts`
- `apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts`
- `apps/shell/apps/web/lib/server/orchestration/autonomy.ts`

The product already thinks in the right units:
- user request -> initiative
- initiative -> brief
- brief -> task graph
- task graph -> work units
- work units -> execution batches/attempts
- execution -> assembly
- assembly -> verification
- verification -> delivery

This is a strong and differentiated product model. It should be preserved and productized, not replaced.

### 2.2 What is still weak

#### A. The visible shell entry is not the real product yet
Critical issue:
- `apps/shell/apps/web/app/page.tsx`
- `apps/shell/apps/web/components/shell/plane-ai-shell.tsx`

Current reality:
- the shell frontdoor still behaves like a screenshot/hero shell instead of the actual live operator home
- the product does not yet start with an obviously useful, confidence-inspiring, action-oriented home state

This is the biggest product gap.

#### B. There is no single canonical UX grammar across `/`, `/work-items`, and `/execution/*`
Observed split:
- `/` shell frontdoor layer
- `/work-items`
- `/(shell)/execution/*`

Current result:
- multiple shell generations coexist
- parts feel polished, parts feel diagnostic, parts feel prototype-only
- the product does not yet feel like one calm, mature system

#### C. Important route families are missing or unresolved
Examples found during inspection:
- session/group/account detail route helpers exist, but matching pages are missing or incomplete
- some work-ui links point to absent destinations
- some review/deep-link surfaces still reference missing pages

Current result:
- the system feels more complete in code than in actual user navigation

#### D. Work UI still feels like an adapted donor, not fully owned Infinity product
Observed signals:
- package/app naming still tied to Open WebUI in places
- multiple “stopgap” comments and local panel placeholders
- too much residual donor identity and too many partially wired affordances

Current result:
- the user can sense adaptation debt
- trust and delight are undermined

#### E. Orchestration is structurally good but still too “operator/debug/internal” in presentation
Observed in:
- runs / brief / result / review / task-graph / batch surfaces
- continuity and delivery paths

Current result:
- the underlying model is strong
- but too many surfaces still feel like raw state presentation or override tooling
- the product needs more narrative flow, better progress language, and clearer happy-path guidance

#### F. Execution kernel is still minimal relative to the product promise
Observed in:
- `services/execution-kernel/README.md`
- `services/execution-kernel/internal/*`
- `packages/api-clients/src/multica.ts`
- `apps/shell/apps/web/lib/server/orchestration/batches.ts`

Current reality:
- enough exists to launch and inspect batches/attempts
- but not enough yet exists to make the full system feel like a closed-loop production execution substrate

---

## 3. Product definition of done

Infinity is “done enough to love using” only when all of the following are true.

### 3.1 Shell / entry experience
- Opening the product immediately answers:
  - what is active now
  - what is blocked
  - what needs my attention
  - what I should open next
- `/` is a real interactive operator frontdoor, not a static or staged shell
- the root shell, work-items surface, and execution surfaces feel like one IA system

### 3.2 Work mode
- entering a session feels like entering the main product, not a donor iframe hack
- the transcript is calm, fast, readable, and confidence-inspiring
- workspace/files/artifacts are first-class and pleasant
- approvals and recoveries are visible in-context without feeling noisy
- there are no obvious dead links, half-routed panels, or fake destinations

### 3.3 Control mode
- sessions, groups, accounts, approvals, recoveries, audits, task graphs, batches, deliveries all feel operator-ready
- each important entity has a proper detail page with clear actions and context
- the user can move from overview -> scope -> object -> workspace without losing orientation

### 3.4 Orchestration
- the initiative -> brief -> task graph -> execution -> verification -> delivery lifecycle is understandable from the UI
- the default journey feels like the happy path, not like internal recovery tooling
- autonomous execution and manual/operator intervention feel like one system, not two systems glued together

### 3.5 Trust / operations
- no major surface looks fake because of naming like `mock`, placeholder copy, or donor branding
- rollout status, storage source, and integration health are visible without debug archaeology
- the product can run locally in a repeatable way and produce trustworthy state

### 3.6 Emotional/product quality
- the product feels calm
- the product feels intentional
- the product feels singular
- the product feels safe to rely on
- the user would choose to stay in it, not just inspect it

---

## 4. Product principles that must remain fixed

These are not optional.

1. Infinity remains the canonical editable workspace.
2. `FounderOS`, `open-webui`, `hermes-webui`, and cabinet references remain donor/read-only.
3. No rewrite of Open WebUI into React.
4. No direct editing of donor repos.
5. No generic dashboard drift.
6. Shell owns control-plane truth.
7. Workspace owns conversation/work surface.
8. `sessionId` remains canonical cross-surface identity.
9. Product design must be workflow-first, not metrics-first.
10. Nice UX must not be purchased by hiding recoveries, approvals, or quota truth.

---

## 5. The target product shape

### 5.1 Two-mode product

#### Control mode
The shell is where the user:
- sees attention state
- navigates projects and sessions
- inspects groups/accounts/quota pressure
- handles approvals and recoveries
- reviews orchestration progress
- accesses audits and deliveries

#### Work mode
The workspace is where the user:
- chats
- resumes and steers sessions
- edits/retries work
- inspects files/artifacts
- handles approvals in context
- keeps flow without losing operator visibility

### 5.2 Primary user journey

The canonical journey should be:
1. land on frontdoor
2. see active work + urgent blockers + recommended next action
3. choose a project / session / initiative
4. enter workspace or entity detail
5. intervene only if needed
6. return to shell with context preserved
7. finish with delivery/review confidence

### 5.3 Product hierarchy

The hierarchy must feel like:
- attention
- scope
- object
- work
- proof

Not like:
- random boards
- tabs
- hidden implementation state
- donor leftovers

---

## 6. Workstreams required to finish the product

The completion effort should be organized into 7 workstreams.

---

# Workstream 1 — Make the shell frontdoor real

## Objective
Turn the root route into the true operator home of Infinity.

## Why this is first
The shell entry is the first impression and the main missing product surface. Until `/` is real, the whole product will continue to feel “almost there” regardless of backend maturity.

## Current gaps
- staged/static frontdoor behavior
- multiple shell generations
- weak “what should I do now?” guidance
- no confident home-state narrative

## Primary files
- `apps/shell/apps/web/app/page.tsx`
- `apps/shell/apps/web/components/shell/plane-ai-shell.tsx`
- `apps/shell/apps/web/components/frontdoor/plane-ai-home-surface.tsx`
- `apps/shell/apps/web/components/frontdoor/plane-root-composer.tsx`
- `apps/shell/apps/web/app/work-items/page.tsx`
- `apps/shell/apps/web/components/shell/plane-work-items-shell.tsx`
- `apps/shell/apps/web/app/(shell)/layout.tsx`
- `apps/shell/apps/web/components/shell/shell-frame.tsx`

## Requirements
1. Root route must be fully interactive.
2. Home state must show:
   - active initiatives/sessions
   - blocked/attention items
   - pending approvals/recoveries
   - relevant account pressure
   - recommended next action
3. Root route must deep-link cleanly into execution scope and work mode.
4. `/`, `/work-items`, and `/execution/*` must use one visual grammar.
5. No screenshot-style placeholder shell remains.

## Implementation tasks
1. Replace any static/screenshot frontdoor rendering with real live children.
2. Define a canonical “operator home” component and make it the real root page.
3. Collapse duplicate shell wrappers into one primary shell frame.
4. Merge or retire the weaker `/work-items` shell generation.
5. Introduce a single set of shell primitives:
   - page header
   - scope header
   - action rail
   - summary cards
   - activity feed / attention lane
6. Add one strong “resume work” CTA path from frontdoor to session/workspace.
7. Add one strong “review blockers” CTA path from frontdoor to approvals/recoveries.

## Acceptance criteria
- visiting `/` immediately feels useful
- there is one obvious next action for the operator
- all root navigation feels like one system
- shell surfaces share the same spacing, hierarchy, and tone

## Validation
- manual walkthrough: `/` -> session -> workspace -> back to shell
- manual walkthrough: `/` -> approvals -> action -> back to root
- no dead navigation from frontdoor

---

# Workstream 2 — Finish route truth and navigation completeness

## Objective
Make the app navigationally honest: no missing detail pages, no fake destinations, no dead routes.

## Why this matters
A product feels unfinished as soon as users hit links that do not resolve or see panels that imply capabilities that do not exist yet.

## Primary shell files
- `apps/shell/apps/web/lib/route-scope.ts`
- `apps/shell/apps/web/app/(shell)/execution/sessions/*`
- `apps/shell/apps/web/app/(shell)/execution/groups/*`
- `apps/shell/apps/web/app/(shell)/execution/accounts/*`
- `apps/shell/apps/web/app/(shell)/execution/review/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/*`

## Primary work-ui files
- `apps/work-ui/src/lib/components/hermes/panels/HermesSkillsPanel.svelte`
- `apps/work-ui/src/lib/components/layout/Sidebar.svelte`
- `apps/work-ui/src/routes/*`

## Requirements
1. Every prominent entity type has a real detail route:
   - session
   - group
   - account
   - initiative
   - brief
   - task graph
   - batch
   - delivery
   - audit
2. Every CTA in shell and work-ui points to a live route.
3. Routes must reflect actual product hierarchy, not historical experiments.
4. Route names should be simplified where possible.

## Implementation tasks
1. Add missing detail pages for sessions/groups/accounts in shell.
2. Audit all route builders and all href-generating helpers.
3. Remove or rewire stale review/deep-link destinations.
4. Audit work-ui links and either:
   - add the missing route family, or
   - remove the affordance until the route exists.
5. Add route-level empty states and not-found states so the UI fails gracefully.

## Acceptance criteria
- route inventory is complete for all first-class objects
- clicking any major navigation item never produces a dead end
- product feels smaller, more honest, and more trustworthy

## Validation
- route audit checklist across shell and work-ui
- simple script or test enumerating known canonical routes
- manual deep-link tests from root, review, workspace, and continuity views

---

# Workstream 3 — Turn Work UI into owned Infinity work mode

## Objective
Make the embedded workspace feel like a first-class Infinity mode, not a donor adaptation with stopgaps.

## Why this matters
This is where the user spends time. If this mode feels rough, the whole product feels rough even if the shell backend is excellent.

## Primary files
- `apps/work-ui/package.json`
- `apps/work-ui/src/lib/constants.ts`
- `apps/work-ui/src/routes/(app)/+layout.svelte`
- `apps/work-ui/src/routes/(app)/+page.svelte`
- `apps/work-ui/src/routes/(app)/c/[id]/+page.svelte`
- `apps/work-ui/src/lib/components/chat/Chat.svelte`
- `apps/work-ui/src/lib/components/chat/ChatControls.svelte`
- `apps/work-ui/src/lib/components/chat/Navbar.svelte`
- `apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte`
- `apps/work-ui/src/lib/components/hermes/panels/*`
- `apps/work-ui/src/lib/components/hermes/workspace/*`
- `apps/work-ui/src/lib/founderos/*`

## Requirements
1. Work mode must have one clearly defined happy path.
2. Branding and naming must be Infinity-owned, not upstream donor-owned.
3. Right-side panels must feel consistent in depth and importance.
4. Workspace/file/artifact handling must be fast and pleasant.
5. Embedded-only assumptions must be made explicit and coherent.

## Implementation tasks

### 3.1 Product identity cleanup
1. Replace residual Open WebUI product naming with Infinity-owned naming.
2. Audit visible copy for donor/community/upstream references.
3. Normalize terminology across shell and work-ui:
   - session
   - initiative
   - brief
   - task graph
   - approval
   - recovery
   - delivery

### 3.2 Happy-path definition
1. Decide what embedded `/` means:
   - resume current session
   - session home
   - project work home
2. Remove or de-emphasize “override/recovery only” framing from primary paths.
3. Keep recovery tooling available, but not as the emotional center of the product.

### 3.3 Panel system cleanup
1. Rank the right-rail tabs by true product importance.
2. Normalize all panel headers, action rows, empty states, and CTA patterns.
3. Deepen weak panels like Tasks and Todos so they feel worthy of being first-class.
4. Remove or postpone panels that are currently only symbolic.

### 3.4 Workspace/product polish
1. Refine file preview, workspace switching, attach-to-chat, and path affordances.
2. Ensure embedded meta strip is calm and informative, not debug-heavy.
3. Improve transcript operational elements so approvals/tool activity feel polished and not bolted on.

### 3.5 Technical debt reduction in visible surfaces
1. Break up large core Svelte surfaces, especially chat-heavy files.
2. Reduce `@ts-nocheck` in user-visible core paths.
3. Remove stray debug logging from production-facing flows.
4. Add route- and component-level tests for the major work-mode paths.

## Acceptance criteria
- the user can work in the embedded workspace for extended time without feeling adaptation seams
- no major visible donor branding remains
- right rail feels intentional, not opportunistic
- transcript + approvals + files feel like one designed system

## Validation
- embedded session launch test
- workspace file attach test
- approval-in-transcript test
- “resume after leaving workspace” test
- targeted typecheck on core work-ui surfaces

---

# Workstream 4 — Productize orchestration and make it feel like the core story

## Objective
Turn orchestration from strong internal state machinery into a clear, attractive product experience.

## Why this matters
The orchestration model is one of Infinity’s strongest differentiators. Right now it is structurally correct but still too internal-facing.

## Primary files
- `apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts`
- `apps/shell/apps/web/lib/server/orchestration/task-graphs.ts`
- `apps/shell/apps/web/lib/server/orchestration/batches.ts`
- `apps/shell/apps/web/lib/server/orchestration/autonomy.ts`
- `apps/shell/apps/web/lib/server/orchestration/assembly.ts`
- `apps/shell/apps/web/lib/server/orchestration/verification.ts`
- `apps/shell/apps/web/lib/server/orchestration/delivery.ts`
- `apps/shell/apps/web/lib/server/orchestration/continuity.ts`
- `apps/shell/apps/web/app/(shell)/execution/{runs,spec,planner,tasks,review,validation,handoffs,continuity,batches,task-graphs,delivery}/*`
- `apps/work-ui/src/routes/(app)/project-*/*`

## Requirements
1. The initiative lifecycle must be visible and intuitive.
2. The product should make the happy path obvious:
   - request
   - brief
   - planning
   - execution
   - verification
   - delivery
3. Operator intervention should feel integrated, not like an emergency side tool.
4. Continuity should be readable as a story, not as a raw record dump.

## Implementation tasks

### 4.1 Define one canonical orchestration narrative
1. Pick the primary UI narrative for orchestration.
2. Decide which pages are first-class and which are support/debug surfaces.
3. Promote only the pages needed for normal use.
4. Demote raw/internal lanes that are only useful during deep debugging.

### 4.2 Task graph UX
1. Make task graph view more legible for humans.
2. Show dependencies, status, runnable units, and bottlenecks clearly.
3. Add stronger action affordances:
   - inspect work unit
   - launch batch
   - see blocked dependencies
   - open relevant workspace/session

### 4.3 Batch/execution UX
1. Make batch detail feel like an execution story, not just attempt records.
2. Show progress, active attempts, failed attempts, artifacts, and supervisor actions in one cohesive page.
3. Expose the right next action when a batch stalls.

### 4.4 Continuity and delivery UX
1. Continuity must read like one timeline from initiative to delivery.
2. Delivery should feel like a product outcome surface, not a local artifact page.
3. Verification must clearly state pass/fail plus why it matters.

### 4.5 Work-mode integration
1. Work-ui orchestration routes should be aligned with shell orchestration truth.
2. Avoid duplicate narratives between shell and work-ui.
3. Use work-ui for rich context and shell for control-plane scope.

## Acceptance criteria
- a new user can understand the initiative lifecycle from UI alone
- task graph and batch pages support real operational use
- continuity and delivery feel like outcome-oriented surfaces
- the orchestration model becomes a product feature, not just internal scaffolding

## Validation
- walkthrough from create initiative -> approve brief -> launch execution -> inspect batch -> verify -> delivery
- screenshot review of each major orchestration surface
- route parity between shell and embedded work mode

---

# Workstream 5 — Close the execution loop for real

## Objective
Move execution from “minimal kernel + shell integration” to believable end-to-end production substrate.

## Why this matters
Without a convincing execution loop, the product will feel half-real even if the control plane looks good.

## Primary files
- `services/execution-kernel/cmd/execution-kernel/main.go`
- `services/execution-kernel/internal/service/service.go`
- `services/execution-kernel/internal/handler/http.go`
- `services/execution-kernel/internal/supervisor/*`
- `services/execution-kernel/internal/events/*`
- `packages/api-clients/src/multica.ts`
- `packages/api-clients/src/multica-types.ts`
- `apps/shell/apps/web/lib/server/orchestration/batches.ts`
- `apps/shell/apps/web/lib/server/orchestration/supervisor.ts`
- `apps/shell/apps/web/lib/server/orchestration/supervisor-shared.ts`

## Requirements
1. Batch/attempt lifecycle must be complete enough to trust.
2. Failure, retry, and supervisor intervention must be first-class.
3. Execution artifacts and summaries must be consistently captured.
4. Shell pages must reflect real execution transitions, not only optimistic state.

## Implementation tasks
1. Finalize explicit attempt lifecycle states and transitions.
2. Complete supervisor action model for retry/fail/complete/reassign where needed.
3. Ensure artifact URIs and summaries are consistently surfaced to shell/work-ui.
4. Harden batch launch and batch refresh against partial failures.
5. Close the loop between kernel events and control-plane orchestration state.
6. Add bounded end-to-end tests for the execution path.

## Acceptance criteria
- launching a batch is not just an API demo; it behaves like a reliable product action
- failed attempts produce understandable operator context
- retry/fallback flows produce visible, coherent state changes
- batch pages feel authoritative

## Validation
- kernel health test
- batch launch test
- attempt failure + retry test
- supervisor action audit test
- shell batch detail consistency test

---

# Workstream 6 — Remove fake-feeling seams and trust debt

## Objective
Remove naming, seed-state, and implementation cues that make real product surfaces feel fake or provisional.

## Why this matters
Trust is emotional and lexical. If the product looks “mock-ish,” users will never fully rely on it.

## Primary files
- `apps/shell/apps/web/lib/server/control-plane/state/store.ts`
- `apps/shell/apps/web/lib/server/control-plane/state/seeds.ts`
- `apps/shell/apps/web/lib/server/control-plane/{sessions,accounts,approvals,recoveries,workspace}/mock.ts`
- `apps/work-ui/package.json`
- `apps/work-ui/src/lib/constants.ts`
- visible user-facing copy across shell/work-ui

## Requirements
1. User-facing and developer-facing naming must reflect production intent.
2. Demo/seed paths must be clearly separated from real runtime paths.
3. There must be a clean story for storage source, integration state, and runtime health.

## Implementation tasks
1. Rename misleading `mock.ts` modules where they are now real durable adapters.
2. Separate demo/dev seed state from production read/write logic.
3. Audit visible UI copy for “mock”, “override”, “temporary”, “stopgap” tone where it harms confidence.
4. Add “state source” truth surfaces that are calm and clear, not debug-noisy.
5. Reframe internal caution text so it supports trust instead of undermining it.

## Acceptance criteria
- major surfaces do not accidentally read as fake
- developers can still distinguish dev/demo paths cleanly
- operators can understand data source and health without reading internal docs

## Validation
- copy audit
- code naming audit
- manual review of rollout/status/source surfaces

---

# Workstream 7 — Operational hardening, rollout discipline, and final polish

## Objective
Make the product stable to run repeatedly and pleasant enough for sustained use.

## Why this matters
A beautiful product that is fragile will not be used. A powerful product that feels rough will also not be used.

## Primary areas
- local startup/launch flow
- env/rollout status
- memory-capped validation workflow
- shell/work-ui visual alignment
- screenshot and walkthrough QA

## Requirements
1. One documented local bring-up path for Infinity.
2. Clear distinction between strict rollout env and local/dev fallback.
3. Memory-safe verification discipline.
4. Final pass on spacing, hierarchy, typography, cards, and tone.

## Implementation tasks
1. Create a single canonical local bring-up doc for Infinity only.
2. Define the canonical env contract for local and stricter modes.
3. Create one validation script/checklist that tests the product the way a user experiences it.
4. Perform a dedicated polish pass on:
   - root shell
   - session detail
   - workspace host
   - approvals
   - recoveries
   - task graph
   - batch detail
   - continuity
   - delivery
5. Capture final validation screenshots and walkthrough evidence.

## Acceptance criteria
- a future session can start Infinity without archaeology
- validation is repeatable
- product screenshots look like one product
- the product can survive normal day-to-day usage without constant manual babysitting

## Validation
- fresh local bring-up
- root-to-workspace walkthrough
- approval/recovery walkthrough
- orchestration walkthrough
- final screenshot set

---

## 7. Recommended implementation sequence

This order matters.

### Phase 0 — Freeze scope and create execution discipline
Duration: 0.5–1 day

Deliverables:
- this spec accepted as working source of truth
- one canonical backlog extracted from this doc
- one validation checklist skeleton
- one decision on whether Infinity should become/recover as canonical git root

Why first:
- without scope discipline, the product will continue expanding sideways

### Phase 1 — Make `/` real
Duration: 2–4 days

Deliverables:
- live frontdoor
- unified shell frame
- obvious operator home

### Phase 2 — Complete route truth
Duration: 2–4 days

Deliverables:
- missing detail pages
- dead-link cleanup
- route audit complete

### Phase 3 — Productize Work UI
Duration: 4–7 days

Deliverables:
- embedded work mode happy path
- branding cleanup
- panel cleanup
- reduced visible stopgaps

### Phase 4 — Productize orchestration
Duration: 4–7 days

Deliverables:
- canonical orchestration story
- better task graph / batch / continuity / delivery surfaces

### Phase 5 — Close execution loop
Duration: 3–6 days

Deliverables:
- stronger kernel lifecycle
- stronger retry/supervisor model
- authoritative batch state feel

### Phase 6 — Trust debt and rollout hardening
Duration: 2–4 days

Deliverables:
- naming cleanup
- state-source clarity
- local bring-up discipline
- final polish/QA

---

## 8. Concrete file-level target map

This is the shortest practical “where work will happen” map.

### Highest-priority shell files
- `apps/shell/apps/web/app/page.tsx`
- `apps/shell/apps/web/app/(shell)/layout.tsx`
- `apps/shell/apps/web/components/shell/plane-ai-shell.tsx`
- `apps/shell/apps/web/components/shell/shell-frame.tsx`
- `apps/shell/apps/web/components/frontdoor/plane-ai-home-surface.tsx`
- `apps/shell/apps/web/components/frontdoor/plane-root-composer.tsx`
- `apps/shell/apps/web/app/work-items/page.tsx`
- `apps/shell/apps/web/lib/route-scope.ts`

### Highest-priority new/expanded shell routes
- `apps/shell/apps/web/app/(shell)/execution/sessions/[sessionId]/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/groups/[groupId]/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/accounts/[accountId]/page.tsx`

### Highest-priority work-ui files
- `apps/work-ui/package.json`
- `apps/work-ui/src/lib/constants.ts`
- `apps/work-ui/src/routes/(app)/+layout.svelte`
- `apps/work-ui/src/routes/(app)/+page.svelte`
- `apps/work-ui/src/routes/(app)/c/[id]/+page.svelte`
- `apps/work-ui/src/lib/components/chat/Chat.svelte`
- `apps/work-ui/src/lib/components/chat/ChatControls.svelte`
- `apps/work-ui/src/lib/components/chat/Navbar.svelte`
- `apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte`
- `apps/work-ui/src/lib/components/hermes/panels/*`
- `apps/work-ui/src/lib/components/hermes/workspace/*`

### Highest-priority orchestration files
- `apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts`
- `apps/shell/apps/web/lib/server/orchestration/task-graphs.ts`
- `apps/shell/apps/web/lib/server/orchestration/batches.ts`
- `apps/shell/apps/web/lib/server/orchestration/autonomy.ts`
- `apps/shell/apps/web/lib/server/orchestration/continuity.ts`
- `apps/shell/apps/web/lib/server/orchestration/assembly.ts`
- `apps/shell/apps/web/lib/server/orchestration/verification.ts`
- `apps/shell/apps/web/lib/server/orchestration/delivery.ts`

### Highest-priority execution-kernel files
- `services/execution-kernel/internal/service/service.go`
- `services/execution-kernel/internal/handler/http.go`
- `services/execution-kernel/internal/supervisor/*`
- `packages/api-clients/src/multica.ts`
- `packages/api-clients/src/multica-types.ts`

---

## 9. Test and validation strategy

Use lightweight targeted validation during development, then bounded full checks at the end of each major batch.

### Always validate after each workstream slice
- route exists and renders
- no dead deep links
- relevant targeted unit/component tests
- typecheck on touched workspace/app where feasible

### Required end-state validation

#### Shell validation
- root frontdoor walkthrough
- session/group/account detail walkthrough
- approvals/recoveries/audits walkthrough
- task graph / batch / continuity / delivery walkthrough

#### Work-mode validation
- embedded launch works
- workspace loads correct session/account context
- file browsing works
- approval interaction works
- return-to-shell path works

#### Orchestration validation
- create initiative
- produce or inspect brief
- inspect task graph
- launch batch
- inspect attempts / supervisor actions
- verify delivery/continuity surface coherence

#### Runtime validation
- kernel health path
- batch launch
- failed attempt handling
- retry path

### Final QA artifact set
Create one final handoff packet containing:
- screenshots of root shell, approvals, recoveries, session detail, workspace, task graph, batch detail, continuity, delivery
- validation logs
- short written operator walkthrough

---

## 10. Risks and failure modes

### Risk 1: polishing before route truth
If visual polish starts before route completeness, the product will still feel broken.

Mitigation:
- finish route truth before late-stage polish

### Risk 2: continuing to build sideways
If new boards, lanes, or panels keep being added before convergence, Infinity will stay powerful-but-messy.

Mitigation:
- add nothing new unless it closes a gap in this spec

### Risk 3: keeping too much donor surface area visible
If residual Open WebUI or FounderOS artifacts remain visible, the product will never feel singular.

Mitigation:
- rebrand and simplify visible surfaces during Workstream 3 and 6

### Risk 4: execution substrate stays too minimal
If execution remains shallow, orchestration will look fake no matter how good the UI gets.

Mitigation:
- prioritize Workstream 5 before declaring product readiness

### Risk 5: validation remains ad hoc
If validation depends on memory and manual intuition, regressions will dominate the final mile.

Mitigation:
- create one canonical validation checklist and final artifact bundle

---

## 11. Immediate next actions

If starting today, do exactly this sequence.

1. Accept this doc as the working product-completion source of truth.
2. Extract a concrete implementation backlog from the 7 workstreams.
3. Start with Workstream 1 only.
4. Do not touch execution-kernel or deep orchestration polish before the shell frontdoor is real.
5. After Workstream 1, do Workstream 2 immediately.
6. Only then move to Workstream 3 and Workstream 4 in parallel or alternating bounded batches.
7. Leave Workstream 6 and Workstream 7 as convergence phases, not procrastinated cleanup.

---

## 12. One-sentence instruction for a coding agent

Implement Infinity as the canonical, unified product by first making the shell frontdoor real and route-complete, then turning the embedded workspace into a fully owned Infinity work mode, then productizing orchestration and hardening the execution loop until the system feels singular, trustworthy, and pleasant to use.
