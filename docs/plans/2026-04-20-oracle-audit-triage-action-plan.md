# Oracle audit triage action plan

> For Hermes: use subagent-driven-development to execute this plan task-by-task. Treat the oracle audit as advisory only; implement only grounded findings validated against real code.

Goal: convert the weak/generic oracle audit into a grounded, minimal action plan and land the highest-confidence fixes without broad refactors.

Architecture: do not rewrite shell/workspace architecture. Reuse existing shell-owned runtime/context seams that already exist in `runtime-ingest.ts`, and limit user-facing cleanup to copy that directly undermines product truth. Keep edits surgical.

Tech stack: Next.js/React in `apps/shell/apps/web`, Svelte in `apps/work-ui`, Vitest for targeted verification.

Grounded triage summary
- Unsupported / do not act on directly:
  - broad claims about broken shell/workspace integration
  - generic “control-plane lacks visibility” rewrite
  - “inefficient event handling” rewrite
  - “PlaneWorkItemsShell is overloaded”
  - claim that `latest-plan.md` says the unified control plane is almost finalized
- Real validated gaps:
  - `/work-items` under-surfaces shell-owned workspace host context even though that context is already derived elsewhere
  - residual user-visible copy still says `local mock corpus` and `project factory`

Priority buckets
- P0: remove trust-breaking user-visible copy that makes real control-plane surfaces sound fake
- P1: mirror linked workspace runtime host context on `/work-items` using existing shell-owned data
- P2: optional wording polish only after P0/P1 are green

---

### Task 1: Remove trust-breaking copy from user-visible surfaces

Objective: eliminate residual mock/factory wording that directly undermines credibility on real UI surfaces.

Files:
- Modify: `apps/shell/apps/web/components/execution/session-surface.tsx`
- Modify: `apps/work-ui/src/routes/(app)/project-intake/+page.svelte`

Required edits:
- Replace `No active recovery incidents in the local mock corpus.` with neutral truthful copy.
- Replace textarea placeholder `Build the Infinity-native project factory intake and the first durable brief flow.` with neutral current-state wording.
- Replace title placeholder `Atlas Factory` with neutral sample wording if it remains visible.

Constraints:
- No docs churn.
- No test-only text churn unless needed for failing assertions.
- Keep semantics the same; this is terminology cleanup, not flow redesign.

Verification:
- `cd /Users/martin/infinity/apps/shell/apps/web && npx vitest run app/work-items/page.test.tsx app/api/control/execution/integration-gate.test.ts`
- `cd /Users/martin/infinity/apps/work-ui && NODE_OPTIONS='--max-old-space-size=1024' npx vitest run src/lib/founderos/navigation.test.ts`
- If those are unaffected/noisy, at minimum run a bounded build-free sanity check on touched files' nearest existing tests.

---

### Task 2: Expose linked workspace runtime host context on `/work-items`

Objective: make the shell work-items board show the same high-value runtime context the embedded workspace already knows: account/model/mode/quota/approvals/opened-from.

Files:
- Modify: `apps/shell/apps/web/lib/server/control-plane/workspace/runtime-ingest.ts`
- Modify: `apps/shell/apps/web/app/work-items/page.tsx`
- Modify: `apps/shell/apps/web/components/work-items/plane-work-items-surface.tsx`
- Modify: `apps/shell/apps/web/app/work-items/page.test.tsx`

Required edits:
- Add a tiny helper in `runtime-ingest.ts` to resolve `SessionWorkspaceHostContext` from `state.sessions.events` by `sessionId`.
- In `page.tsx`, derive the current workspace session id from initiative/route scope and pass `workspaceHostContext` into the surface.
- In `plane-work-items-surface.tsx`, render a compact runtime summary in the existing embedded-workspace rail:
  - account/accountLabel
  - model
  - execution mode
  - quota pressure (+ used percent if already available)
  - pending approvals
  - opened from
- Prefer `workspaceHostContext.sessionId` when building the workspace link so the rail and link stay aligned.
- Update the route test so the prop is exercised and visible in the mocked surface.

Constraints:
- No new persistence.
- No new API routes.
- Do not introduce a new DTO if existing `SessionWorkspaceHostContext` already works.
- Keep the existing work-items layout; extend the right rail rather than adding a new panel.

Verification:
- `cd /Users/martin/infinity/apps/shell/apps/web && npx vitest run app/work-items/page.test.tsx`
- If type surfaces changed enough to warrant it: `cd /Users/martin/infinity/apps/shell/apps/web && npm run typecheck`

---

### Task 3: Optional wording hardening after P0/P1

Objective: only if needed, reduce future audit misreads without broad doc churn.

Files:
- Optional modify: `latest-plan.md`
- Optional modify: `apps/shell/apps/web/components/shell/plane-work-items-shell.tsx`

Required edits:
- Only land if P0/P1 reveal wording ambiguity that still confuses product truth.
- Prefer a one-line clarification over a doc rewrite.

Verification:
- No separate verification beyond touched-file sanity unless actual code changes require it.

---

Execution order
1. Task 1
2. Task 2
3. Task 3 only if still justified

Definition of done
- No remaining user-visible `mock corpus` or stale `project factory` placeholder on the touched surfaces.
- `/work-items` shows linked workspace runtime context from shell-owned data.
- Targeted tests pass.
- No unrelated cleanup bundled in.