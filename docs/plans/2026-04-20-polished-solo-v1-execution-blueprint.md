# Infinity Polished Solo V1 — Execution Blueprint

> Goal: turn Infinity from a strong internal autonomous MVP into a polished daily-driver product for Martin, with one shell-first flow, Plane AI-inspired UI/UX, live recoveries, and a real localhost-ready result.

## Frozen product rules

- One product, one entry, one primary run flow.
- Root `/` stays shell-owned.
- `apps/work-ui` remains the embedded workspace, not a second product shell.
- Only `secrets / credentials required` may hard-pause the happy path.
- Runtime failures should surface as live recoveries, not manual stage gates.
- Final result must be a real localhost-ready runnable output, not just a handoff bundle.
- The current left sidebar is the visual anchor; do not redesign it unless absolutely required for consistency.
- Inner surfaces must move toward Plane AI quality: clear hierarchy, dense but calm layout, coherent status grammar, and minimal debug noise.

## Execution order

1. Phase 0 — Freeze product and visual contract
2. Phase 1 — Replace fake shell foundation with a real shell frame
3. Phase 2 — Build the primary run surface and reroute the happy path
4. Phase 3 — Demote continuity and `project-*` surfaces from the primary journey
5. Phase 4 — UI/UX unification pass for inner surfaces, guided by Plane AI
6. Phase 5 — Planner 2.0
7. Phase 6 — Runtime and live recovery hardening
8. Phase 7 — Localhost-ready result hardening
9. Phase 8 — Product-grade validation and finish gate

---

## Phase 0 — Freeze product and visual contract

### Goal

Prevent architectural drift and stop the product from sliding back into split UX, staged flow, or generic dashboard sprawl.

### Files

- No code changes required before the freeze is agreed.
- This file becomes the execution source of truth for the next implementation cycle.

### Exact changes

1. Treat this blueprint as the governing implementation plan for polished solo-v1.
2. Freeze the following decisions before further coding:
   - `/` is the only primary user entry.
   - `Start run` lands in one primary run surface.
   - `continuity`, `review`, `audits`, `recoveries`, `accounts`, `events`, `handoffs`, and `project-*` routes are secondary surfaces.
   - left sidebar stays visually stable.
   - inner surfaces must converge to one Plane-like visual grammar.
3. Reject any implementation that reintroduces:
   - split shell/work-ui user mental model,
   - required manual stage buttons,
   - “delivery is ready” without localhost run proof,
   - ad hoc dashboard layouts unrelated to the shell grammar.

### Acceptance criteria

- Team/agent execution follows this document rather than improvising new product structure.
- No new primary route is introduced outside the shell.

### Validation commands

- None for the freeze itself.

### Parallelization notes

- This phase must complete before the rest.

### Risk notes

- If this phase is skipped, the next phases may produce polished fragments but not a coherent product.

---

## Phase 1 — Replace the fake shell foundation with a real shell frame

### Goal

Replace the screenshot-backed `PlaneAiShell` hack with a real production shell layout that preserves the current good left sidebar direction.

### Files

- Modify: `apps/shell/apps/web/components/shell/plane-ai-shell.tsx`
- Create: `apps/shell/apps/web/components/shell/plane-shell-frame.tsx`
- Create: `apps/shell/apps/web/components/shell/plane-shell-primitives.tsx`
- Modify if needed: `apps/shell/apps/web/app/page.tsx`

### Exact changes

1. Remove the static `Image` overlay approach from `plane-ai-shell.tsx`.
2. Build a real shell frame with:
   - persistent left navigation,
   - main content canvas,
   - optional contextual right rail,
   - consistent page padding and max-width behavior.
3. Extract shared shell primitives for:
   - page headers,
   - stat tiles,
   - chips/badges,
   - section cards,
   - rails,
   - empty states,
   - loading skeletons.
4. Preserve the left sidebar look-and-feel as the baseline visual truth.
5. Ensure all shell surfaces can render inside this frame without bespoke outer wrappers.

### Acceptance criteria

- No screenshot-overlay shell remains.
- The shell is fully real React UI.
- The left sidebar remains visually strong and unchanged in spirit.
- `app/page.tsx` and other major shell pages render inside one shared production frame.

### Validation commands

- `cd /Users/martin/infinity/apps/shell/apps/web && npm run typecheck`
- `cd /Users/martin/infinity/apps/shell/apps/web && npm run test:integration-gate`

### Parallelization notes

- Can be implemented in parallel with Phase 5 planning design work, but must land before Phase 4 UI/UX unification.

### Risk notes

- Biggest risk is over-redesigning the left sidebar instead of only replacing the fake shell wrapper.

---

## Phase 2 — Build the primary run surface and reroute the happy path

### Goal

Make the happy path land in one strong user-facing run surface instead of dropping into continuity or fragmented operator pages.

### Files

- Modify: `apps/shell/apps/web/components/frontdoor/plane-root-composer.tsx`
- Modify: `apps/shell/apps/web/app/page.tsx`
- Create: `apps/shell/apps/web/app/(shell)/execution/runs/[initiativeId]/page.tsx`
- Create: `apps/shell/apps/web/components/execution/primary-run-surface.tsx`
- Create: `apps/shell/apps/web/app/(shell)/execution/runs/[initiativeId]/page.test.tsx`
- Modify if needed: `apps/shell/apps/web/lib/route-scope.ts`

### Exact changes

1. Change `Start run` so it redirects to a new primary run route, not `continuity`.
2. Build `primary-run-surface.tsx` as the main product canvas with:
   - prompt summary,
   - current stage,
   - task board,
   - agent activity,
   - live recovery stream,
   - localhost result state,
   - handoff/evidence summary.
3. Keep links to `continuity`, `review`, `audits`, and `workspace`, but demote them to secondary actions.
4. Make the run surface the visual center of the product after prompt submission.
5. Ensure route scope is preserved across task, agent, recovery, and result links.

### Acceptance criteria

- After `Start run`, the happy path lands in one primary run route.
- User can see tasks, agents, recoveries, and output state without route-hopping.
- `continuity` is no longer the main landing surface.

### Validation commands

- `cd /Users/martin/infinity/apps/shell/apps/web && npm run typecheck`
- `cd /Users/martin/infinity/apps/shell/apps/web && npx vitest run "app/(shell)/execution/runs/[initiativeId]/page.test.tsx"`
- `cd /Users/martin/infinity/apps/shell/apps/web && npm run test:integration-gate`

### Parallelization notes

- The new route test can be developed in parallel with the surface implementation.
- Do not start Phase 4 styling until the primary information architecture is stable.

### Risk notes

- Biggest risk is creating another “nice screen” that still depends on secondary routes to understand the run.

---

## Phase 3 — Demote continuity and `project-*` surfaces from the primary journey

### Goal

Keep secondary and recovery flows useful, but make sure they no longer define the main product experience.

### Files

- Modify: `apps/shell/apps/web/app/(shell)/execution/continuity/[initiativeId]/page.tsx`
- Modify: `apps/shell/apps/web/components/orchestration/continuity-workspace.tsx`
- Modify: `apps/work-ui/src/routes/(app)/project-intake/+page.svelte`
- Modify: `apps/work-ui/src/routes/(app)/project-brief/[id]/+page.svelte`
- Modify: `apps/work-ui/src/routes/(app)/project-run/[id]/+page.svelte`
- Modify: `apps/work-ui/src/routes/(app)/project-result/[id]/+page.svelte`

### Exact changes

1. Rewrite these surfaces so they are explicitly:
   - drill-down views,
   - recovery views,
   - internal detail views,
   - embedded support views.
2. Reduce or visually demote override buttons like:
   - approve override,
   - planner override,
   - verification override,
   - delivery override.
3. Remove wording that makes the staged flow sound like the normal happy path.
4. Keep these routes available for debugging, recovery, and deep inspection.
5. Ensure links from the primary run surface open these pages as secondary detail flows, not next-stage requirements.

### Acceptance criteria

- No secondary route looks like the canonical next step in the happy path.
- Copy no longer teaches staged manual progression.
- Users can still recover or inspect deeper details when needed.

### Validation commands

- `cd /Users/martin/infinity/apps/shell/apps/web && npm run typecheck`
- `cd /Users/martin/infinity/apps/work-ui && NODE_OPTIONS='--max-old-space-size=1280' npm run check`
- `cd /Users/martin/infinity/apps/work-ui && NODE_OPTIONS='--max-old-space-size=1024' npx vitest run src/lib/founderos/bootstrap.test.ts src/lib/founderos/navigation.test.ts src/lib/founderos/bridge.test.ts`

### Parallelization notes

- Shell continuity cleanup and work-ui route cleanup can happen in parallel.

### Risk notes

- Main risk is breaking embedded launch semantics while reducing copy and CTA prominence.

---

## Phase 4 — UI/UX unification pass guided by Plane AI

### Goal

Replace the current “chaotic AI slop” inner surfaces with coherent, dense, premium, Plane-like product quality while preserving the good sidebar.

### Files

- Modify: `apps/shell/apps/web/components/execution/execution-home-surface.tsx`
- Modify: `apps/shell/apps/web/components/work-items/plane-work-items-surface.tsx`
- Modify: `apps/shell/apps/web/components/orchestration/continuity-workspace.tsx`
- Modify: `apps/shell/apps/web/components/execution/workspace-handoff-surface.tsx`
- Modify: `apps/shell/apps/web/components/execution/execution-review-workspace.tsx`
- Modify: `apps/shell/apps/web/components/execution/execution-events-workspace.tsx`
- Modify: `apps/shell/apps/web/components/execution/execution-agents-workspace.tsx`
- Modify: `apps/shell/apps/web/components/execution/control-plane-directory-surfaces.tsx`
- Create: `apps/shell/apps/web/components/execution/plane-run-primitives.tsx`

### Exact changes

1. Create shared inner-surface primitives for:
   - primary summary header,
   - section headers,
   - board lanes,
   - activity feed rows,
   - side-rail modules,
   - result/evidence blocks,
   - empty states,
   - skeletons,
   - status chips.
2. Standardize:
   - spacing rhythm,
   - card radius,
   - typography scale,
   - meta-label style,
   - chip color logic,
   - button hierarchy.
3. Reduce visual noise by:
   - cutting repeated prose,
   - pushing technical metadata into secondary rows,
   - grouping related items into clear modules,
   - avoiding equal visual weight on every card.
4. Use Plane AI as a reference for:
   - information hierarchy,
   - density,
   - scanning rhythm,
   - restrained premium feel,
   - calm contrast.
5. Do **not** imitate Plane AI by screenshots or 1:1 cloning; imitate the product grammar.
6. Preserve route scope and operator power, but stop presenting every surface like a debug console.

### Acceptance criteria

- Inner surfaces feel like one product, not a pile of unrelated cards.
- The sidebar no longer feels disconnected from the content area.
- In 3 seconds, a user can answer:
   - what is the run doing,
   - what is blocked,
   - who is working,
   - what result is ready.
- Technical/debug information exists, but does not dominate the page.

### Validation commands

- `cd /Users/martin/infinity/apps/shell/apps/web && npm run typecheck`
- `cd /Users/martin/infinity/apps/shell/apps/web && npm run test`
- `cd /Users/martin/infinity && npm run validate:quick`

### Parallelization notes

- After the new primitives are frozen, split surface migration across multiple workers:
   - worker A: home + primary run
   - worker B: work-items + agents + events
   - worker C: continuity + review + handoff
   - worker D: workspace handoff surface

### Risk notes

- Main risk is broad visual churn without hierarchy improvements.
- Second risk is accidentally redesigning operator/debug surfaces into decorative dashboards.

---

## Phase 5 — Planner 2.0

### Goal

Move from a mostly template-driven planner to a project-aware planner that can support broad software tasks and produce better task/agent UI downstream.

### Files

- Modify: `apps/shell/apps/web/lib/server/orchestration/planner.ts`
- Modify: `apps/shell/apps/web/lib/server/orchestration/task-graphs.ts`
- Modify if required: `apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts`
- Create: `apps/shell/apps/web/lib/server/orchestration/planner.test.ts`
- Create: `apps/shell/apps/web/lib/server/orchestration/task-graphs.test.ts`

### Exact changes

1. Replace the mostly fixed workstream template with prompt-aware planning.
2. Add explicit synthesis/final integration task generation.
3. Make planning sensitive to:
   - project type,
   - repo scope,
   - runtime constraints,
   - delivery mode,
   - verification needs.
4. Preserve existing durable object model if possible; avoid unnecessary contract churn.
5. Expose richer planner metadata needed by the primary run UI:
   - decomposition rationale,
   - critical path,
   - concurrency groups,
   - risk flags.

### Acceptance criteria

- Different prompt classes generate materially different task graphs.
- Task graphs include synthesis/finalization logic.
- Planner output is better aligned with broad software requests.

### Validation commands

- `cd /Users/martin/infinity/apps/shell/apps/web && npm run typecheck`
- `cd /Users/martin/infinity/apps/shell/apps/web && npx vitest run lib/server/orchestration/planner.test.ts lib/server/orchestration/task-graphs.test.ts`
- `cd /Users/martin/infinity && npx --yes tsx ./scripts/verify-event-fixtures.ts`

### Parallelization notes

- Can run in parallel with early Phase 6 runtime hardening design, but not with simultaneous contract rewrites.

### Risk notes

- Biggest risk is hidden contract drift that breaks downstream orchestration or UI assumptions.

---

## Phase 6 — Runtime and live recovery hardening

### Goal

Make the autonomous loop feel real and trustworthy: better attempt lifecycle, better retries, better stuck detection, and visible recoveries.

### Files

- Modify: `services/execution-kernel/internal/service/service.go`
- Modify: `services/execution-kernel/internal/handler/http.go`
- Modify: `services/execution-kernel/internal/handler/supervisor_http.go`
- Modify: `apps/shell/apps/web/lib/server/orchestration/autonomy.ts`
- Modify: `apps/shell/apps/web/lib/server/orchestration/supervisor.ts`
- Modify if needed: `apps/shell/apps/web/lib/server/control-plane/workspace/runtime-ingest.ts`
- Create tests in the kernel and shell orchestration layers where coverage is missing

### Exact changes

1. Introduce a stronger attempt state machine.
2. Make retry/failover/reopen policies explicit and machine-driven.
3. Add stuck detection and timeout-driven recovery triggers.
4. Ensure non-secret failures surface as live recoveries rather than dead-end blocked states.
5. Feed recovery state into the primary run surface and supporting rails.
6. Keep `secrets / credentials required` as the only mandatory hard stop.

### Acceptance criteria

- Failed work can be retried or recovered automatically when policy allows.
- Recoveries appear clearly in UI without route-hopping.
- The happy path does not collapse on routine runtime turbulence.

### Validation commands

- `cd /Users/martin/infinity/services/execution-kernel && go test ./...`
- `cd /Users/martin/infinity/apps/shell/apps/web && npm run typecheck`
- `cd /Users/martin/infinity/apps/shell/apps/web && npm run test`
- `cd /Users/martin/infinity && npm run validate:quick`

### Parallelization notes

- Kernel and shell recovery projection work can run in parallel, but they must converge on one shared recovery contract.

### Risk notes

- Main risk is adding recovery complexity without improving truthfulness or stability.

---

## Phase 7 — Localhost-ready result hardening

### Goal

Upgrade delivery from “artifact bundle with preview.html” to a clear localhost-ready result with launch proof.

### Files

- Modify: `apps/shell/apps/web/lib/server/orchestration/assembly.ts`
- Modify: `apps/shell/apps/web/lib/server/orchestration/verification.ts`
- Modify: `apps/shell/apps/web/lib/server/orchestration/delivery.ts`
- Modify: `apps/shell/apps/web/components/execution/primary-run-surface.tsx`
- Modify: `scripts/validation/run_infinity_validation.py`

### Exact changes

1. Explicitly distinguish:
   - artifact bundle,
   - runnable localhost result,
   - handoff packet.
2. Add canonical launch manifest data to delivery.
3. Require runnable localhost proof before marking result “ready”.
4. Surface a real launch action/command in the primary run UI.
5. Make verification fail if the result is only file-backed documentation without runnable proof.

### Acceptance criteria

- Final output is a real localhost-ready product or service.
- Launch command is meaningful and testable.
- UI communicates clearly whether the result is runnable, partial, or only evidence-ready.

### Validation commands

- `cd /Users/martin/infinity/apps/shell/apps/web && npm run test`
- `cd /Users/martin/infinity && npm run validate:quick`
- `cd /Users/martin/infinity && python3 scripts/validation/run_infinity_validation.py`

### Parallelization notes

- UI result panel work can happen in parallel with backend delivery semantics, but final status wiring must wait for backend truth.

### Risk notes

- Main risk is overfitting delivery to one project type instead of broad software.

---

## Phase 8 — Product-grade validation and finish gate

### Goal

Make the finish gate prove polished solo-v1 behavior, not just internal orchestration completion.

### Files

- Modify: `scripts/validation/run_infinity_validation.py`
- Modify: `apps/shell/apps/web/scripts/smoke-shell-contract.mjs`
- Modify or add targeted route/surface tests in shell and work-ui as needed
- Optional: add scenario docs under `docs/validation/`

### Exact changes

1. Add validation checks for:
   - root prompt lands in the primary run surface,
   - no required manual stage buttons on the happy path,
   - live recovery shows up when recoverable faults are injected,
   - localhost-ready result actually launches,
   - handoff packet exists,
   - split UX has not returned.
2. Add representative acceptance scenarios for broad software requests.
3. Make validation fail if the product regresses into:
   - continuity-first,
   - override-first,
   - preview-only,
   - debug-first UX.

### Acceptance criteria

- Validation proves daily-driver quality for the solo-v1 target.
- A pass means the product feels finished enough to rely on, not just demo.

### Validation commands

- `cd /Users/martin/infinity && npm run typecheck`
- `cd /Users/martin/infinity && npm run test`
- `cd /Users/martin/infinity && npm run validate:quick`
- `cd /Users/martin/infinity && npm run validate:full`

### Parallelization notes

- Best done after Phases 6 and 7, but test scaffolding can start earlier.

### Risk notes

- Main risk is writing tests that validate internal implementation details instead of product truth.

---

## UI/UX remediation checklist

Use this checklist during Phases 1–4.

### Must keep

- Current left sidebar direction and visual quality.
- Calm, dense, premium shell feeling.
- Strong route scope and operator visibility.

### Must remove

- Screenshot-backed shell.
- Equal-weight card soup.
- Overwritten explanatory paragraphs everywhere.
- Debug-console feeling on primary surfaces.
- Recovery/override language as default flow language.

### Must introduce

- One visual grammar for cards, chips, rails, and headers.
- One obvious primary action per screen.
- One clear narrative per surface:
  - what is happening,
  - what is blocked,
  - what is next,
  - what result is ready.
- Strong visual distinction between:
  - primary run surface,
  - secondary operator views,
  - recovery/detail views.

### Plane AI-inspired heuristics

- Keep hierarchy obvious in under 3 seconds.
- Use density, not clutter.
- Prefer fewer stronger modules over many tiny cards.
- Keep technical metadata secondary.
- Make status readable without decoding internal jargon.

---

## Parallelization matrix

### Stream A — Product shell and primary UX

- Phase 1
- Phase 2
- parts of Phase 4

### Stream B — Secondary surface cleanup

- Phase 3
- remaining parts of Phase 4

### Stream C — Planner and runtime

- Phase 5
- Phase 6

### Stream D — Result and validation

- Phase 7
- Phase 8

### Dependency rules

- Phase 1 must land before the full Phase 4 pass.
- Phase 2 must land before Phase 3 demotion work is considered complete.
- Phase 5 and Phase 6 should avoid simultaneous contract drift.
- Phase 7 should not declare success before Phase 8 validation is green.

---

## Final finish gate

Polished solo-v1 is done only if the answer to every question below is “yes”:

1. Does `/` feel like the one real product?
2. Does `Start run` land in one strong primary run surface?
3. Are tasks, agents, recoveries, and result visible without route-hopping?
4. Is the primary UX free from staged manual progression language?
5. Does the result become “ready” only after localhost run proof?
6. Do recoveries feel live and trustworthy?
7. Do the inner surfaces feel like one premium product instead of chaotic AI slop?
8. Would Martin realistically choose to use this daily instead of treating it like a lab prototype?
