# Infinity Fully Working Solo V1 — Final Hardening Plan

> Goal: close the remaining gaps between the current strong localhost alpha and a genuinely fully working solo-v1 product that can be used daily without qualification.

## Why this plan exists

The current local branch has materially improved the product:

- `/` is shell-owned and works as the frontdoor;
- `validate:full` now passes on the current working tree;
- delivery proof is stricter and distinguishes runnable results from wrapper/scaffold evidence;
- synthetic control-plane seeds are no longer on the normal runtime path by default;
- localhost topology defaults are more consistent than before;
- embedded credentials are cleaner than the old legacy model.

But the product still should not be called fully finished because several high-value gaps remain:

1. test isolation is not stable enough;
2. the execution runtime still behaves like a localhost scaffold rather than a clean operational loop;
3. embedded auth still carries legacy browser-token fallback;
4. privileged browser/API boundaries are still too permissive;
5. secondary recovery surfaces still leak staged/manual semantics;
6. the working tree is still noisy, so “done” is not yet pinned to a clean checkpoint.

This plan turns those remaining gaps into a strict executor checklist.

---

## Scope rules for this cycle

### In scope

- final localhost solo-v1 hardening;
- validator reproducibility;
- runtime health cleanup;
- embedded auth cleanup;
- CORS/browser-boundary hardening;
- delivery/handoff truth enforcement;
- operator/recovery surface cleanup;
- clean-tree finish discipline.

### Out of scope

- multi-user production auth;
- public-cloud deployment hardening;
- full PR/Vercel/GitHub release automation;
- replacing the localhost file-backed runtime with a production distributed system;
- large UI redesigns unrelated to the working-state hardening path.

---

## Do not reopen already-fixed items

The executor must **not** spend time re-solving items that are already materially fixed on the local branch:

1. root `/` ownership;
2. launcher pointing at `/execution` instead of `/`;
3. default kernel port drift (`8787` → `8798`);
4. autonomous proof being hardcoded as unconditional booleans;
5. synthetic control-plane seeds being enabled by default outside tests;
6. delivery overclaiming wrapper/scaffold evidence as runnable proof.

Any further work in those areas must be limited to regression protection, not redesign.

---

## Phase 0 — normalize the repo before claiming product work

### Goal

Make the current branch reviewable, reproducible, and checkpointable.

### Exact work

1. Audit the current dirty tree and separate:
   - intentional shell/runtime/auth/delivery changes;
   - accidental `work-ui` churn;
   - generated files;
   - throwaway notes or scratch files.
2. Resolve the status of:
   - `apps/shell/apps/web/next-env.d.ts`
   - `fixing.md`
   - untracked test files and temporary notes
3. Revert or isolate unrelated noise from the final hardening batch.
4. Ensure `.gitignore` still covers generated/runtime artifacts:
   - `.next/`
   - `.turbo/`
   - `.control-plane-state/`
   - `.local-state/`
   - `node_modules/`
   - `dist/`
   - `build/`
   - `.svelte-kit/`
   - `coverage/`
   - `.DS_Store`
5. Create a clean checkpoint commit before the final acceptance run.

### Acceptance criteria

- `git status --short` is clean or contains only the bounded files for the current phase.
- Generated files are not treated as meaningful product work.
- The final hardening cycle is reviewable as a coherent patch.

---

## Phase 1 — fix test isolation and validator reproducibility

### Goal

Ensure the test and validation stack proves the same result regardless of ambient local processes.

### Current blocker

`validate:full` passes, but `shell:test` can fail when a real kernel is already running because one test assumes the canonical localhost kernel port is offline.

### Files

- `apps/shell/apps/web/lib/server/orchestration/batches.test.ts`
- `apps/shell/apps/web/package.json`
- `scripts/validation/run_infinity_validation.py`

### Exact work

1. Rewrite the offline-kernel expectation in `batches.test.ts` so it does not rely on the real `127.0.0.1:8798` state.
2. For negative-path runtime tests:
   - use an explicitly closed ephemeral port;
   - or use a controlled local test server;
   - never assume the canonical runtime port is unused.
3. Verify that `shell:test` passes in both conditions:
   - with no kernel running;
   - with a real kernel already running.
4. Keep `validate:full` aligned with the same canonical runtime defaults.

### Acceptance criteria

All of these pass consistently:

```bash
npm run shell:test
npm run work-ui:check
cd /Users/martin/infinity/services/execution-kernel && go test ./...
npm run validate:full
```

And the result does not depend on stray local services.

---

## Phase 2 — make runtime health clean on fresh start

### Goal

Stop the execution runtime from looking permanently degraded because of accumulated stale blocked state.

### Current blocker

`/healthz` can still report:

- `status: degraded`
- many `blockedBatchIds`
- many `failedAttemptIds`
- `runtimeState: blocked`

even when the product otherwise validates successfully.

### Files

- `services/execution-kernel/internal/service/service.go`
- `services/execution-kernel/internal/service/service_test.go`
- `services/execution-kernel/internal/events/types.go`
- `services/execution-kernel/cmd/execution-kernel/main.go`
- `apps/shell/apps/web/lib/server/orchestration/batches.ts`

### Exact work

1. Define explicit terminal state handling for failed and blocked batches:
   - retryable;
   - resolved;
   - archived;
   - discarded.
2. Add cleanup or reconciliation logic so stale blocked work does not poison fresh localhost boots forever.
3. Ensure restart semantics are explicit and test-covered.
4. Make health snapshots distinguish:
   - live blocking problem;
   - stale historical failures;
   - recoverable backlog;
   - clean healthy start.
5. Keep the runtime local-first, but stop treating persistent stale failure tails as normal health.

### Acceptance criteria

On a fresh runtime state:

```bash
curl http://127.0.0.1:8798/healthz
```

does not report an inherited degraded/blocked tail by default.

And the shell can still inspect or retry historical failures intentionally.

---

## Phase 3 — finish embedded auth cleanup

### Goal

Make shell-issued session grants and embedded session tokens the only normal embedded auth path.

### Current blocker

`credentials.ts` is improved, but `localStorage.token` still survives as fallback, and many `work-ui` surfaces still reference it directly.

### Files

- `apps/work-ui/src/lib/founderos/credentials.ts`
- `apps/work-ui/src/lib/founderos/credentials.test.ts`
- remaining direct `localStorage.token` usages under:
  - `apps/work-ui/src/lib/components/chat/**`
  - `apps/work-ui/src/lib/components/workspace/**`
  - `apps/work-ui/src/lib/components/common/**`
  - `apps/work-ui/src/lib/components/playground/**`

### Exact work

1. Keep shell-issued session grants as the primary embedded path.
2. Remove direct `localStorage.token` access from embedded-critical product surfaces.
3. Restrict any remaining fallback behavior to clearly standalone-only contexts.
4. Route all embedded auth reads through one helper/adapter rather than component-local token reads.
5. Expand tests for:
   - embedded session grant present;
   - embedded session token present;
   - no legacy token available;
   - expired/invalid grant;
   - standalone compatibility mode.

### Acceptance criteria

- Embedded-critical routes do not depend on `localStorage.token` as the normal auth path.
- Remaining legacy token references are intentional and isolated.

---

## Phase 4 — harden the browser/API boundary

### Goal

Remove permissive browser behavior that is acceptable for rough local scaffolding but not for a fully working solo-v1 product.

### Current blocker

`next.config.mjs` still sets wildcard CORS for privileged shell/control routes.

### Files

- `apps/shell/apps/web/next.config.mjs`
- shell/control workspace-launch routes if needed

### Exact work

1. Replace `Access-Control-Allow-Origin: "*"` for:
   - `/api/control/:path*`
   - `/api/shell/:path*`
2. Use an explicit localhost allowlist policy for the shell/workspace pair.
3. Ensure mutation routes are not left broadly callable cross-origin.
4. Keep local developer usability, but make the policy intentional and bounded.

### Acceptance criteria

- No wildcard CORS remains on privileged routes.
- Shell/workspace interop still works locally.
- The resulting policy is explicit and documented by code.

---

## Phase 5 — lock the canonical localhost topology

### Goal

Keep the split-service localhost stack, but make it one explicit, stable, non-ambiguous operating model.

### Canonical target

- shell entry: `http://127.0.0.1:3737/`
- work-ui internal origin: `http://127.0.0.1:3101`
- execution-kernel internal origin: `http://127.0.0.1:8798`

### Files

- `scripts/start-localhost.mjs`
- `apps/shell/apps/web/lib/server/control-plane/workspace/rollout-config.ts`
- `apps/shell/apps/web/lib/server/orchestration/batches.ts`
- `package.json`
- `scripts/validation/run_infinity_validation.py`

### Exact work

1. Remove stale assumptions and test copy that still imply older ports or alternate default topology.
2. Ensure launcher, validation, tests, and runtime helpers all use the same canonical values.
3. Keep shell as the only user-facing entry.
4. Treat work-ui and kernel as internal services, not second products.

### Acceptance criteria

- One canonical localhost topology exists in code and tests.
- No stale runtime guidance contradicts it.
- The product feels shell-first even though the internal services remain separate.

---

## Phase 6 — finish truthful delivery and handoff semantics

### Goal

Guarantee that completed delivery truly means runnable localhost output plus handoff readiness.

### Files

- `apps/shell/apps/web/lib/server/orchestration/delivery.ts`
- `apps/shell/apps/web/lib/server/orchestration/autonomous-run.ts`
- `apps/shell/apps/web/lib/server/orchestration/attempt-artifacts.ts`
- `apps/shell/apps/web/components/orchestration/delivery-summary.tsx`

### Exact work

1. Preserve the current rule:
   - `delivery.status = ready` only when `launchProofKind === "runnable_result"`.
2. Ensure `handoff.ready` and `run.completed` only happen when runnable proof exists.
3. Keep wrapper/scaffold states explicitly partial:
   - `pending`
   - `partial`
   - `building`
4. Verify the UI never upgrades wrapper/scaffold delivery into completed language.
5. Keep continuity/validation records in sync with those rules.

### Acceptance criteria

- No wrapper/scaffold path can surface as finished delivery.
- Handoff and completion semantics are fully aligned with runnable proof.

---

## Phase 7 — demote manual recovery surfaces to true recovery-only behavior

### Goal

Ensure secondary routes expose recovery actions as operator tools, not as normal pipeline progression.

### Files

- `apps/work-ui/src/routes/(app)/project-run/[id]/+page.svelte`
- `apps/work-ui/src/routes/(app)/project-result/[id]/+page.svelte`
- related secondary routes if needed

### Exact work

1. Keep recovery controls available.
2. Reframe them as:
   - operator override;
   - replay;
   - recovery action.
3. Move them into clearly secondary visual treatment if needed.
4. Remove any wording that still suggests they are the expected next step.

### Acceptance criteria

- Secondary routes no longer teach staged manual progression.
- Recovery actions remain available without looking like the canonical happy path.

---

## Phase 8 — final source-of-truth cleanup

### Goal

Ensure the release-critical path is backed by live state, not convenience seeds or UI assumptions.

### Files

- `apps/shell/apps/web/lib/server/control-plane/state/store.ts`
- `apps/shell/apps/web/lib/server/control-plane/state/seeds.ts`
- `apps/shell/apps/web/lib/server/control-plane/state/types.ts`
- `apps/shell/apps/web/lib/server/orchestration/autonomous-run.ts`
- related `mock` exports in control-plane modules

### Exact work

1. Confirm synthetic seeds stay test-only.
2. Confirm runtime projections and validation proof derive from live orchestration state.
3. Confirm preview/handoff/validation records are tied to the real run state.
4. Remove or isolate any remaining mock/default release-path shortcuts.

### Acceptance criteria

- Release-critical flows do not depend on synthetic/mock truth.
- Validation proof is derived from actual run state and evidence.

---

## Final acceptance gate

The executor may not claim “done” until all of the following are true from a clean checkpointed tree.

### Required commands

```bash
git status --short
npm run shell:test
npm run work-ui:check
cd /Users/martin/infinity/services/execution-kernel && go test ./...
npm run validate:full
```

### Required manual product check

1. Start the localhost stack.
2. Open `/`.
3. Launch one real one-prompt run from the shell frontdoor.
4. Observe:
   - preview ready;
   - handoff ready;
   - `launch_kind = runnable_result`.
5. Restart the stack.
6. Verify continuity survives restart.
7. Confirm recovery surfaces remain secondary.
8. Confirm fresh runtime health is not degraded by stale blocked tail.

### Required final condition

All of the following must be true:

1. Shell root `/` is the primary frontdoor.
2. One-prompt autonomous flow completes.
3. `shell:test` is deterministic.
4. `validate:full` passes.
5. `work-ui:check` passes.
6. `go test ./...` passes.
7. Runtime health is clean on fresh start.
8. Embedded auth is not normally driven by `localStorage.token`.
9. Delivery/handoff are truthful.
10. The working tree is clean.

If any item above is false, the cycle is not complete.

---

## What still remains after this plan

If the goal later becomes near-public or production-grade rather than fully working solo-v1, the next track will still include:

- real auth/authz and role enforcement;
- stronger deploy/release truth beyond localhost handoff;
- richer observability and audit surfaces;
- more durable runtime storage and orchestration guarantees;
- stricter multi-user conflict and quota behavior.

That work is **after** this plan, not part of it.
