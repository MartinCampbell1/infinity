# Final Remaining Fixes Addendum

Date: 2026-04-23
Workspace: `/Users/martin/infinity`
Original implementation branch checked: `codex/infinity-step10-go`
Canonical merged branch: `master`

> Historical note:
> This addendum captured the remaining blockers at the time of the original branch audit.
> Those blockers were later resolved, validated, and merged into `master`.

## Verdict

The branch is now close enough to call a strong localhost-first solo-v1 candidate, but not fully closed in the strict sense.

Two items are still blockers for an honest `done` claim:

1. validation currently leaves `apps/shell/apps/web/next-env.d.ts` dirty;
2. the acceptance note still points at validated tip `78cba44`, while current HEAD is `a153e5d`.

The remaining items below are cleanup/polish rather than core flow blockers, but they should be closed before final handoff so the product does not still read like a partially demo-driven branch.

## Blockers

### 1. Clean-tree acceptance must be true on current HEAD

Current evidence says:

- latest acceptance doc: `docs/validation/2026-04-23-current-tip-acceptance.md`
- validated tip recorded there: `78cba44`
- current branch tip observed in repo: `a153e5d`

Action:

1. run the full gate from a clean tree on current HEAD;
2. ensure the acceptance note names the current exact commit;
3. do not claim final acceptance against an older tip.

### 2. `next-env.d.ts` must stop counting as unresolved product work

Current state:

- `git status --short` shows `M apps/shell/apps/web/next-env.d.ts`
- the diff is only:

```diff
-import "./.next/dev/types/routes.d.ts";
+import "./.next/types/routes.d.ts";
```

Action:

1. decide one canonical post-validation state for this generated file;
2. either revert it after validation or adjust the workflow so validation leaves the repo clean;
3. make the final acceptance gate require a clean tree after all validators finish.

## Cleanup items

### 3. Remove remaining frontdoor demo constants

Files:

- `apps/shell/apps/web/components/frontdoor/plane-root-composer.tsx`

Current leftovers:

- `scope: web`
- `planner · implementer`
- `attempts: 3`
- inert `Attach spec` label

Action:

1. replace hardcoded chips with live data or remove them;
2. keep the frontdoor truthful to the actual autonomous run path;
3. avoid UI hints that look like canned demo metadata.

### 4. Remove remaining presentation leakage in runs board

Files:

- `apps/shell/apps/web/lib/server/orchestration/claude-design-presentation.ts`

Current leftovers:

- `Vercel preview deployment + smoke test`
- `requestedBy: initiative?.requestedBy ?? "martin"`

Action:

1. remove hardcoded habit-tracker/demo-style task titles from live display helpers;
2. remove person-specific fallbacks like `"martin"` from current display state;
3. make the runs board reflect live orchestration objects only.

### 5. Fully isolate or remove the legacy browser-token fallback

Files:

- `apps/work-ui/src/lib/founderos/credentials.ts`

Current leftover:

- standalone fallback can still return `localStorage.token`

Action:

1. keep shell-issued embedded grant/session token as the normal embedded path;
2. isolate legacy token fallback to explicit standalone-only mode, or remove it entirely;
3. make embedded-critical surfaces unable to silently fall back to `localStorage.token`.

### 6. Decide whether runtime maturity wording is still honest

Files:

- `services/execution-kernel/internal/service/service.go`
- `services/execution-kernel/internal/service/service_test.go`

Current state:

- `/healthz` is healthy and restart behavior is much better
- runtime still reports `maturity: phase3_scaffold`

Action:

1. keep the label if it is intentionally conservative;
2. otherwise rename it to a term that matches the now-working localhost solo-v1 state;
3. avoid calling the product fully hardened while the runtime self-describes as scaffold-only without explanation.

## Step-by-step closeout order

1. restore a clean tree and neutralize `next-env.d.ts` churn;
2. rerun the exact-head validation gate;
3. update acceptance evidence to the real current commit;
4. remove frontdoor hardcoded chips and inert hints;
5. remove live runs-board demo/person-specific fallbacks;
6. isolate or remove `localStorage.token` fallback;
7. confirm whether `phase3_scaffold` remains intentional;
8. rerun the final gate and verify the tree is still clean.

## Final gate

Run from the final intended commit:

```bash
git status --short
npm run shell:test
npm run work-ui:check
cd /Users/martin/infinity/services/execution-kernel && go test ./...
npm run validate:full
git status --short
```

The branch may be called fully fixed only if:

1. the first and last `git status --short` are clean;
2. the acceptance note points to the exact validated HEAD;
3. no demo/person-specific frontdoor or runs-board leakage remains on live surfaces;
4. embedded auth no longer silently falls back to `localStorage.token` on the shell-owned path.
