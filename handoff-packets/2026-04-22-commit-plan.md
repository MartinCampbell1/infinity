# Commit Plan

Repo: `/Users/martin/infinity`
Branch now: `master`
Baseline: `9ca95da`
Recommended packaging branch: `codex/infinity-step10-go`

## Goal

Turn the current worktree into intentional commits without redoing the release analysis.

Suggested branch command:

```bash
cd /Users/martin/infinity
git switch -c codex/infinity-step10-go
```

## Recommended split

### Commit 1

Subject:

`feat: integrate strict shell-first execution frontend`

Main scope:

- shell execution surfaces
  - `apps/shell/apps/web/app/page.tsx`
  - `apps/shell/apps/web/app/(shell)/execution/runs/page.tsx`
  - `apps/shell/apps/web/app/(shell)/execution/delivery/[deliveryId]/page.tsx`
  - `apps/shell/apps/web/components/frontdoor/*`
  - `apps/shell/apps/web/components/execution/*`
  - `apps/shell/apps/web/components/orchestration/delivery-summary.tsx`
  - `apps/shell/apps/web/components/shell/shell-frame.tsx`
  - `apps/shell/apps/web/components/work-items/plane-work-items-surface.tsx`
  - `apps/shell/apps/web/lib/server/orchestration/claude-design-presentation.ts`
- work-ui route cleanup
  - `apps/work-ui/src/routes/(app)/project-brief/[id]/+page.svelte`
  - `apps/work-ui/src/routes/(app)/project-run/[id]/+page.svelte`
  - `apps/work-ui/src/routes/(app)/project-result/[id]/+page.svelte`

Why:

- this is the visible Claude Design → shell/workspace integration slice

Suggested staging command:

```bash
cd /Users/martin/infinity
git add \
  apps/shell/apps/web/app/page.tsx \
  apps/shell/apps/web/app/'(shell)'/execution/runs/page.tsx \
  apps/shell/apps/web/app/'(shell)'/execution/delivery/'[deliveryId]'/page.tsx \
  apps/shell/apps/web/components/frontdoor \
  apps/shell/apps/web/components/execution \
  apps/shell/apps/web/components/orchestration/delivery-summary.tsx \
  apps/shell/apps/web/components/shell/shell-frame.tsx \
  apps/shell/apps/web/components/work-items/plane-work-items-surface.tsx \
  apps/shell/apps/web/lib/server/orchestration/claude-design-presentation.ts \
  apps/work-ui/src/routes/'(app)'/project-brief/'[id]'/+page.svelte \
  apps/work-ui/src/routes/'(app)'/project-run/'[id]'/+page.svelte \
  apps/work-ui/src/routes/'(app)'/project-result/'[id]'/+page.svelte \
  apps/shell/apps/web/app/globals.css
```

### Commit 2

Subject:

`fix: harden execution truth, auth seam, and validation gates`

Main scope:

- delivery/runtime/orchestration truth
  - `apps/shell/apps/web/lib/server/orchestration/{attempt-artifacts,autonomy,batches,delivery,supervisor,validation}.ts`
  - `apps/shell/apps/web/app/api/control/orchestration/**/*`
  - `packages/api-clients/src/{multica,multica-types}.ts`
  - `services/execution-kernel/internal/{events/types.go,handler/http.go,handler/http_test.go,service/service.go,service/service_test.go}`
- localhost topology
  - `package.json`
  - `apps/work-ui/package.json`
  - `scripts/start-localhost.mjs`
  - `apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts`
  - `apps/shell/apps/web/lib/server/control-plane/workspace/{rollout-config.ts,rollout-config.test.ts}`
  - `apps/work-ui/src/lib/founderos/shell-origin.ts`
  - `apps/work-ui/src/lib/founderos/shell-origin.test.ts`
- embedded auth seam
  - `apps/work-ui/src/lib/founderos/{credentials.ts,credentials.test.ts,bootstrap.test.ts,launch.test.ts}`
  - `apps/work-ui/src/routes/(app)/+layout.svelte`
- validator and smoke updates
  - `apps/shell/apps/web/package.json`
  - `apps/shell/apps/web/scripts/smoke-shell-contract.mjs`
  - `scripts/validation/run_infinity_validation.py`

Why:

- this is the backend truth / readiness / auth / validator hardening slice

Suggested staging command:

```bash
cd /Users/martin/infinity
git add \
  apps/shell/apps/web/lib/server/orchestration/attempt-artifacts.ts \
  apps/shell/apps/web/lib/server/orchestration/autonomy.ts \
  apps/shell/apps/web/lib/server/orchestration/batches.ts \
  apps/shell/apps/web/lib/server/orchestration/batches.test.ts \
  apps/shell/apps/web/lib/server/orchestration/delivery.ts \
  apps/shell/apps/web/lib/server/orchestration/supervisor.ts \
  apps/shell/apps/web/lib/server/orchestration/validation.ts \
  apps/shell/apps/web/app/api/control/orchestration \
  apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts \
  apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts \
  apps/shell/apps/web/lib/server/control-plane/workspace/rollout-config.ts \
  apps/shell/apps/web/lib/server/control-plane/workspace/rollout-config.test.ts \
  apps/shell/apps/web/package.json \
  apps/shell/apps/web/scripts/smoke-shell-contract.mjs \
  apps/work-ui/package.json \
  apps/work-ui/src/lib/founderos/credentials.ts \
  apps/work-ui/src/lib/founderos/credentials.test.ts \
  apps/work-ui/src/lib/founderos/shell-origin.ts \
  apps/work-ui/src/lib/founderos/shell-origin.test.ts \
  apps/work-ui/src/routes/'(app)'/+layout.svelte \
  package.json \
  packages/api-clients/src/multica.ts \
  packages/api-clients/src/multica-types.ts \
  scripts/start-localhost.mjs \
  scripts/validation/run_infinity_validation.py \
  services/execution-kernel/internal/events/types.go \
  services/execution-kernel/internal/handler/http.go \
  services/execution-kernel/internal/handler/http_test.go \
  services/execution-kernel/internal/service/service.go \
  services/execution-kernel/internal/service/service_test.go \
  apps/work-ui/src/lib/components/chat/ShareChatModal.svelte
```

### Commit 3

Subject:

`docs: add strict validation and release handoff artifacts`

Main scope:

- `handoff-packets/2026-04-22-step10-go-status.md`
- `handoff-packets/2026-04-22-final-release-audit.md`

Why:

- keeps operator-facing evidence separate from product code

Suggested staging command:

```bash
cd /Users/martin/infinity
git add \
  handoff-packets/2026-04-22-step10-go-status.md \
  handoff-packets/2026-04-22-final-release-audit.md \
  handoff-packets/2026-04-22-commit-plan.md \
  handoff-packets/2026-04-22-release-status.json
```

## Canonical evidence bundle

Use this as the release bundle for any next agent or human review:

- `/Users/martin/infinity/handoff-packets/validation/2026-04-21T23-37-59Z`

## High-signal verification to mention in commit or PR text

- `python3 scripts/validation/run_infinity_validation.py --skip-static-checks`
- `npm run check --workspace open-webui`
- `npm run typecheck --workspace @founderos/web`
- targeted shell orchestration tests
- targeted work-ui Founderos auth tests
