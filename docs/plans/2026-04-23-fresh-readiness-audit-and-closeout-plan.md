# Fresh Readiness Audit and Closeout Plan

Date: 2026-04-23
Workspace: `/Users/martin/infinity`
Original implementation branch: `codex/infinity-step10-go`
Canonical merged branch: `master`

## What was rechecked from scratch

Fresh commands run during this audit:

```bash
git status --short
npm run shell:test
npm run work-ui:check
cd /Users/martin/infinity/services/execution-kernel && go test ./...
npm run validate:full
curl -sf http://127.0.0.1:8798/healthz
```

Fresh validation bundle from this audit:

- `handoff-packets/validation/2026-04-23T03-04-56Z`

Fresh validation proof from this audit:

- root frontdoor stayed on `/`
- `autonomous_one_prompt = true`
- `manual_stage_labels = []`
- `preview_ready = true`
- `launch_ready = true`
- `launch_kind = runnable_result`
- `handoff_ready = true`

## Audit summary

The branch is materially working as a localhost-first solo-v1 system, but it is still not honest to call it fully finished.

The biggest remaining gap is no longer simple UI polish. The biggest gap is **truthfulness of runnable-result proof**.

## Status by area

## 1. Unified shell frontdoor and localhost topology

### Status

Done.

### Fresh evidence

- `scripts/start-localhost.mjs` uses shell `3737`, work-ui `3101`, kernel `8798`
- `scripts/validation/run_infinity_validation.py` validates the same topology
- fresh validation bundle `2026-04-23T03-04-56Z` confirms root entry stays on `/`

### Conclusion

The shell-owned root frontdoor and canonical localhost topology are now real.

---

## 2. One-prompt autonomous flow

### Status

Partially done.

### Fresh evidence

- `npm run validate:full` passed in this audit
- fresh `autonomous-proof.json` shows:
  - `autonomous_one_prompt = true`
  - no required manual stage labels
  - preview and handoff both ready

### Why this is not fully done yet

The validator currently proves that the loop finishes, but it does **not yet prove that the delivered runnable result is a real product result**.

### Conclusion

Autonomous progression is real enough to observe, but the final delivery proof is still too synthetic to trust as final readiness.

---

## 3. Delivery truth and runnable-result proof

### Status

Not done. This is the main blocker.

### Fresh evidence

Live code still does all of the following:

1. `apps/shell/apps/web/lib/server/orchestration/attempt-artifacts.ts`
   - maps `final_integration` to:
     - `artifactRole: "attempt_real_product_result"`
     - `targetKind: "runnable_result"`
     - `targetLabel: "Integrated product preview"`
2. the same file writes a hardcoded static HTML page whose visible brand is:
   - `Habit Runway`
3. fresh generated runnable artifact from this audit:
   - `.local-state/orchestration/attempt-artifacts/.../runnable-result/index.html`
   - still renders that canned `Habit Runway` page
4. `apps/shell/apps/web/lib/server/orchestration/delivery.ts`
   - promotes delivery to `status: "ready"` when:
     - `launchProofKind === "runnable_result"`
     - and localhost launch proof exists
5. `apps/shell/apps/web/app/api/control/orchestration/autonomy-happy-path.test.ts`
   - encodes this path as passing behavior

### Meaning

The system can currently pass the final gate with a synthetic canned page that is marked as a real runnable result.

That means:

- validation is green;
- delivery is marked ready;
- handoff is marked ready;
- but the underlying runnable artifact can still be a placeholder/demo-style product.

### Required fix

One of these must become true:

1. `final_integration` must produce a real runnable output derived from actual assembly output; or
2. the current canned output must be downgraded from `runnable_result` to `attempt_scaffold` or equivalent non-ready proof.

### Conclusion

This is the primary blocker separating the branch from an honest “ready product” claim.

---

## 4. Runtime health and restart semantics

### Status

Mostly done, with one honesty gap.

### Fresh evidence

Fresh `/healthz` during this audit returned:

- `status: ok`
- `runtimeState: idle`
- `recoveryState: archived`
- `failureState: historical`
- no live blocked batches
- no live failed attempts

### Remaining issue

The same health response still reports:

- `maturity: phase3_scaffold`

and that label is asserted in:

- `services/execution-kernel/internal/service/service.go`
- `services/execution-kernel/internal/service/service_test.go`

### Conclusion

Operationally the runtime is much healthier than before. The remaining issue is mostly a truth-language decision:

- either keep `phase3_scaffold` and stop claiming full completion;
- or rename it to match the actual localhost solo-v1 state.

---

## 5. Embedded auth cleanup

### Status

Partially done.

### Fresh evidence

- shell bootstrap/session exchange is present and is the intended embedded path
- direct component-level `localStorage.token` sprawl is greatly reduced
- but `apps/work-ui/src/lib/founderos/credentials.ts` still falls back to `localStorage.token`
- compatibility route still exists:
  - `/api/control/execution/workspace/[sessionId]/session-bearer`

### Conclusion

This is no longer the main blocker for the shell-owned happy path, but it is still unfinished compatibility debt.

---

## 6. Demo and presentation leakage

### Status

Partially done.

### Fresh evidence

Still present in live code:

- `apps/shell/apps/web/components/frontdoor/plane-root-composer.tsx`
  - `scope: web`
  - `planner · implementer`
  - `attempts: 3`
  - inert `Attach spec`
- `apps/shell/apps/web/lib/server/orchestration/claude-design-presentation.ts`
  - `Vercel preview deployment + smoke test`
  - `requestedBy ?? "martin"`

### Conclusion

This is now secondary. It is not the main product blocker, but it still keeps the product from looking clean and fully truthful.

---

## 7. Repo hygiene and acceptance discipline

### Status

Not done.

### Fresh evidence

Current tree during this audit:

```text
M apps/shell/apps/web/next-env.d.ts
?? docs/plans/2026-04-23-final-remaining-fixes-addendum.md
```

Also:

- `next-env.d.ts` still flips between:
  - `./.next/dev/types/routes.d.ts`
  - `./.next/types/routes.d.ts`

### Conclusion

This is a release/merge blocker even if the product path is mostly working.

---

## What is actually separating the branch from a ready product

In strict priority order:

1. **Synthetic runnable-result proof**
   - current final proof can still be a canned `Habit Runway` artifact
2. **Dirty-tree / acceptance discipline**
   - final gate is not yet clean-tree clean-head ready
3. **Remaining live demo leakage**
   - frontdoor chips and presentation fallbacks
4. **Legacy embedded auth compatibility seam**
   - `localStorage.token` fallback and `session-bearer`
5. **Runtime maturity wording**
   - honesty mismatch, not core flow failure

## Closeout plan

## P0 — Fix delivery truth first

This is the most important step.

### Required work

1. In `attempt-artifacts.ts`, stop treating canned `final_integration` output as a real runnable product result.
2. Remove the hardcoded `Habit Runway` synthetic page from the live `runnable_result` path.
3. Update `delivery.ts` so `status: ready` only happens when the runnable proof comes from real assembly-backed output.
4. Update `autonomy-happy-path.test.ts` and any related tests so they do not bless the canned artifact as a valid real result.
5. Rerun `validate:full` and verify `launch_kind = runnable_result` still means a truthful real output.

## P1 — Clean branch hygiene and acceptance proof

### Required work

1. Neutralize `apps/shell/apps/web/next-env.d.ts` churn.
2. Ensure the tree is clean before and after validators.
3. Refresh acceptance evidence to the exact validated HEAD.

## P2 — Remove remaining live demo leakage

### Required work

1. Remove or replace hardcoded chips in `plane-root-composer.tsx`.
2. Remove person-specific and demo-specific fallbacks from `claude-design-presentation.ts`.

## P3 — Finish auth seam cleanup

### Required work

1. Isolate or remove the `localStorage.token` fallback from the shell-owned embedded path.
2. Keep `session-bearer` explicitly compatibility-only or remove it if no longer needed.

## P4 — Resolve maturity wording

### Required work

1. Keep `phase3_scaffold` only if the team still wants to describe the runtime as scaffold-grade.
2. Otherwise rename the maturity label and tests to match actual localhost solo-v1 readiness.

## Final acceptance gate

After the fixes above, rerun:

```bash
git status --short
npm run shell:test
npm run work-ui:check
cd /Users/martin/infinity/services/execution-kernel && go test ./...
npm run validate:full
curl -sf http://127.0.0.1:8798/healthz
git status --short
```

The branch should be called ready only if all of the following are true:

1. tree is clean before and after validation
2. root `/` remains the shell frontdoor
3. one-prompt loop still completes autonomously
4. validation still proves preview + handoff + runnable result
5. the runnable result is a real product output, not a canned synthetic page
6. embedded auth no longer silently falls back to legacy browser token on the shell-owned path
7. live surfaces no longer show leftover demo/person-specific presentation data
