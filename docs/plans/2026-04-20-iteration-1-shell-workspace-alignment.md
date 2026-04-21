# Iteration 1 Shell/Workspace Alignment Plan

> For Hermes: use subagent-driven-development skill to implement this plan task-by-task.

Goal: remove the highest-confidence P0/P1 drift between the shell and work-ui so the product moves back toward an embedded chat-first workspace with a credible operator shell.

Architecture: keep the current Infinity split: FounderOS-style shell owns the operator control plane, work-ui owns the embedded workspace. Do not invent new systems. Reuse existing Open WebUI chat surfaces and existing shell control-plane routes. Make the minimum changes that restore product shape and keep verification bounded.

Tech stack: Next.js/React in `apps/shell/apps/web`, SvelteKit/Open WebUI in `apps/work-ui`, Vitest, TypeScript.

---

### Task 1: Restore a chat-first work-ui frontdoor

Objective: stop using `apps/work-ui/src/routes/(app)/+page.svelte` as a beige Project Factory dashboard and make it an actual workspace frontdoor.

Files:
- Modify: `apps/work-ui/src/routes/(app)/+page.svelte`
- Create: `apps/work-ui/src/routes/(app)/c/[id]/+page.svelte`
- Reuse: `apps/work-ui/src/lib/components/chat/Chat.svelte`

Requirements:
- Root `(app)` page should render the existing chat workspace, not a bespoke dashboard.
- Add a routed `/c/[id]` page that renders the existing chat workspace with `chatIdProp` wired from params.
- Preserve existing project-brief/project-run/project-result routes; do not remove them in iteration 1.
- Keep the change surgical and reuse existing chat/workspace behavior.

Verification:
- `cd /Users/martin/infinity/apps/work-ui && NODE_OPTIONS='--max-old-space-size=2048' npm run test:frontend:ci -- src/lib/founderos/bootstrap.test.ts src/lib/founderos/bridge.test.ts src/lib/founderos/navigation.test.ts src/lib/orchestration/home.test.ts`
- `cd /Users/martin/infinity/apps/work-ui && NODE_OPTIONS='--max-old-space-size=3072' npm run build`

### Task 2: Make embedded mode legible instead of passive

Objective: upgrade the embedded strip into a compact embedded-work banner that explains shell-scoped workspace context.

Files:
- Modify: `apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte`
- Modify: `apps/work-ui/src/routes/(app)/+layout.svelte`
- Modify if needed: `apps/work-ui/src/lib/founderos/navigation.ts`
- Read context from: `apps/work-ui/src/lib/founderos/types.ts`

Requirements:
- Show that the user is in an embedded FounderOS workspace.
- Surface richer existing host context when available: `openedFrom`, quota pressure, pending approvals, shell return.
- Keep visual language neutral and Open WebUI-compatible; do not introduce a new design system.
- Remove obvious duplicated shell-link clutter from the root work-ui route if Task 1 makes it redundant.

Verification:
- same work-ui verification commands as Task 1

### Task 3: Remove fake shell/work-items rendering and align shell copy

Objective: fix the shell’s most obvious credibility issues: invisible work-items content, misleading workspace copy, and the current typecheck break.

Files:
- Modify: `apps/shell/apps/web/components/shell/plane-work-items-shell.tsx`
- Modify: `apps/shell/apps/web/components/work-items/plane-work-items-surface.tsx`
- Modify: `apps/shell/apps/web/components/execution/execution-home-surface.tsx`
- Modify if needed: `apps/shell/apps/web/app/work-items/page.tsx`
- Verify existing tests: `apps/shell/apps/web/app/work-items/page.test.tsx`

Requirements:
- Remove the static reference-image shell that hides the actual work-items UI behind an invisible overlay.
- Make the rendered work-items surface visible and usable as an actual product surface.
- Fix the current shell typecheck failure caused by `currentBatch` prop mismatch.
- Update shell copy so it describes work-ui as an embedded session/workspace, not merely `intake / run / result`.
- Keep changes minimal and avoid broad refactors.

Verification:
- `cd /Users/martin/infinity/apps/shell/apps/web && npm run typecheck`
- `cd /Users/martin/infinity/apps/shell/apps/web && npx vitest run app/work-items/page.test.tsx app/api/control/execution/integration-gate.test.ts`

### Task 4: Oracle feedback prep

Objective: leave the tree in a state that is easy to package and re-audit.

Files:
- No specific code target; gather paths after implementation.

Requirements:
- Summarize what changed and what remains intentionally deferred.
- Ensure updated archive can be sent back to GPT-5.4 Pro for iteration-1 re-audit.

Verification:
- root bundle/build step handled by orchestrator after code tasks complete.
