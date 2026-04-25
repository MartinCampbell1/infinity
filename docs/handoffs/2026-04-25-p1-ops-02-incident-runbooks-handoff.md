# Handoff: P1-OPS-02 Incident Runbooks

Repo: `/Users/martin/infinity`
Audit plan: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
Current date: 2026-04-25
Current bounded step: `P1-OPS-02. Incident runbooks`

## Hard Rules

- Reference repos are read-only:
  - `/Users/martin/FounderOS`
  - `/Users/martin/open-webui`
  - `/Users/martin/hermes-webui`
- Make changes only inside `/Users/martin/infinity`.
- Keep using `karpathy-guidelines`, `karpathy-programming-workflow`, and `critic-loop-profi`.
- Do not start the next audit step until the current step has green verification and an independent critic `GO`.
- Do not copy secrets from chat, screenshots, shell history, or local env into repo files.

## Recent Completed Gates

### P1-QA-03 Load/backpressure

Status: closed with critic `GO`.

Implemented:
- status-preserving kernel request errors in `packages/api-clients/src/multica.ts`;
- shell 429/5xx mapping in `apps/shell/apps/web/app/api/control/orchestration/batches/route.ts`;
- shell burst/backpressure test in `apps/shell/apps/web/app/api/control/orchestration/batches/route.test.ts`;
- execution-kernel concurrency/reload test in `services/execution-kernel/internal/service/service_test.go`;
- `test:load-backpressure` and `.github/workflows/web-load-backpressure.yml`.

Verification passed:
- `npm run typecheck --workspace @founderos/api-clients`
- `npm run typecheck --workspace @founderos/web`
- `npm run test:load-backpressure --workspace @founderos/web`
- `cd services/execution-kernel && go test ./...`
- focused web suite: 35 files / 193 tests
- `git diff --check`

### P1-OPS-01 Staging topology

Status: closed with critic `GO`.

Implemented:
- `buildStagingTopologyDiagnostics()` in `apps/shell/apps/web/lib/server/control-plane/workspace/rollout-config.ts`;
- `stagingTopology` in `/api/control/deployment/boot-diagnostics`;
- staging topology tests;
- `docs/ops/staging-topology.md`.

Verification passed:
- `npm run typecheck --workspace @founderos/web`
- targeted suite: 5 files / 46 tests
- broader focused web suite: 37 files / 210 tests
- `git diff --check`

Critic note:
- Non-blocking doc polish: staging topology docs could use only exact accepted secret-manager slugs.

## Current Step: P1-OPS-02

Audit spec:

```text
P1-OPS-02. Incident runbooks
Problem: Kernel down, DB down, delivery stuck, auth failure need runbooks.
Acceptance criteria: Runbooks exist and are linked from alerts.
Checks: focused unit/integration tests + relevant shell/work-ui checks + update validation packet where applicable.
```

## P1-OPS-02 Changes Already Applied

New files:
- `apps/shell/apps/web/lib/server/control-plane/ops/incident-runbooks.ts`
- `apps/shell/apps/web/lib/server/control-plane/ops/incident-runbooks.test.ts`
- `docs/ops/incident-runbooks.md`

Modified files:
- `apps/shell/apps/web/app/api/control/deployment/boot-diagnostics/route.ts`
- `apps/shell/apps/web/app/api/control/deployment/boot-diagnostics/route.test.ts`

Behavior added:
- Static incident runbook catalog for the four required incidents:
  - `kernel-down`
  - `db-down`
  - `delivery-stuck`
  - `auth-failure`
- Static alert catalog linked to runbooks:
  - `execution_kernel_down` -> `docs/ops/incident-runbooks.md#kernel-down`
  - `control_plane_db_down` -> `docs/ops/incident-runbooks.md#db-down`
  - `delivery_stuck` -> `docs/ops/incident-runbooks.md#delivery-stuck`
  - `control_plane_auth_failure` -> `docs/ops/incident-runbooks.md#auth-failure`
- `buildIncidentRunbookDiagnostics()` returns:
  - `ready`
  - `runbookDocPath`
  - `requiredRunbooks`
  - `runbooks`
  - `alerts`
  - `missingRunbooks`
  - `missingAlertLinks`
  - `missingAlertCoverage`
- Boot diagnostics now returns `incidentRunbooks`.
- Tests verify:
  - required incident coverage;
  - every alert links to a runbook;
  - Markdown runbook file contains each linked anchor;
  - boot diagnostics exposes the alert/runbook catalog and does not leak secret values in the staging readiness path.

## P1-OPS-02 Verification Already Run

Passed:

```sh
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run lib/server/control-plane/ops/incident-runbooks.test.ts app/api/control/deployment/boot-diagnostics/route.test.ts --testTimeout 120000
```

Result: 2 files / 6 tests passed.

Passed after fixing a type enum issue:

```sh
npm run typecheck --workspace @founderos/web
```

## P1-OPS-02 Not Yet Done

Do not call this step closed yet.

Still needed:
1. Run a broader relevant focused suite.
2. Run `git diff --check`.
3. Run independent critic gate for `P1-OPS-02`.
4. If critic returns `NO-GO`, fix only P1-OPS-02, re-run focused verification, then re-run critic.

Suggested next verification:

```sh
npm run typecheck --workspace @founderos/web

cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run \
  lib/server/control-plane/ops/incident-runbooks.test.ts \
  app/api/control/deployment/boot-diagnostics/route.test.ts \
  app/'(shell)'/execution/issues/page.test.tsx \
  lib/server/orchestration/batches.test.ts \
  app/api/control/production-storage-policy.test.ts \
  app/api/control/orchestration/delivery/route.test.ts \
  components/orchestration/delivery-summary.test.tsx \
  app/api/control/execution/workspace/'[sessionId]'/runtime/route.test.ts \
  --testTimeout 120000

git diff --check
```

Suggested critic prompt:

```text
You are the independent critic gate for audit step P1-OPS-02 in /Users/martin/infinity. Use critic-loop-profi standards: inspect the dirty tree, do not edit files, return GO/NO-GO/BLOCKER with concrete blockers only.

Scope/rules:
- Reference repos read-only. Do not touch /Users/martin/FounderOS, /Users/martin/open-webui, /Users/martin/hermes-webui.
- Current step only: P1-OPS-02 incident runbooks.
- Audit spec acceptance: kernel down, DB down, delivery stuck, and auth failure runbooks exist and are linked from alerts.
- Do not judge unrelated earlier dirty files unless they break this step.

Implemented:
- apps/shell/apps/web/lib/server/control-plane/ops/incident-runbooks.ts defines required incident runbooks, alert links, and buildIncidentRunbookDiagnostics().
- apps/shell/apps/web/app/api/control/deployment/boot-diagnostics/route.ts returns incidentRunbooks.
- apps/shell/apps/web/lib/server/control-plane/ops/incident-runbooks.test.ts verifies coverage, alert links, and Markdown anchors.
- apps/shell/apps/web/app/api/control/deployment/boot-diagnostics/route.test.ts verifies boot diagnostics exposes alert/runbook links.
- docs/ops/incident-runbooks.md contains the four runbooks.

Verification:
- npm run typecheck --workspace @founderos/web passed.
- targeted incident-runbook + boot-diagnostics suite passed: 2 files / 6 tests.
- broader focused suite and git diff --check still need to be run unless already completed by the orchestrator.

Please inspect and return GO or NO-GO. If NO-GO, list exact blockers with file/line references. If GO, mention non-blocking residual risks.
```

Potential critic risk:
- The current implementation creates a machine-checkable static alert catalog linked from boot diagnostics. It does not provision live PagerDuty/Grafana/Cloud alert rules. If the critic interprets "linked from alerts" as live alert-manager config, the likely fix is to add an ops alert rules artifact or endpoint that consumes this catalog, not to broaden unrelated runtime code.

## Current Dirty Tree Notes

The worktree is intentionally dirty. It includes prior closed P1/P0 changes plus the current P1-OPS-02 files. Do not revert unrelated changes.

Important current untracked files from recent steps:
- `.github/workflows/web-load-backpressure.yml`
- `.github/workflows/web-security.yml`
- `.github/workflows/web-visual-regression.yml`
- `apps/shell/apps/web/lib/server/control-plane/ops/incident-runbooks.ts`
- `apps/shell/apps/web/lib/server/control-plane/ops/incident-runbooks.test.ts`
- `docs/ops/incident-runbooks.md`
- `docs/ops/staging-topology.md`

No commit has been made and nothing is staged.

## Stop Point

Stop point for the next agent:
- Continue from `P1-OPS-02`.
- First run the broader focused verification and `git diff --check`.
- Then run independent critic.
- Only after critic `GO`, move to the next audit step.
