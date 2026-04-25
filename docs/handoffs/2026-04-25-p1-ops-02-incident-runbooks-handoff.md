# Handoff: P1-OPS-02 Incident Runbooks

Repo: `/Users/martin/infinity`
Branch at refresh time: `codex/p0-be-14-staging-smoke`
HEAD at refresh time: `977a499 chore: checkpoint audit hardening work`
Audit plan: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
Current date: 2026-04-25
Current bounded audit step: `P1-OPS-02. Incident runbooks` - closed for audit acceptance by independent critic `GO` in this handoff refresh.

## Source of Truth and Rules

Precedence for this step:
1. `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
2. `/Users/martin/infinity/AGENTS.md`
3. Current implementation evidence inside `/Users/martin/infinity`

Hard rules:
- Reference repos remain read-only:
  - `/Users/martin/FounderOS`
  - `/Users/martin/open-webui`
  - `/Users/martin/hermes-webui`
  - external `cabinet` snapshots
- Make changes only inside `/Users/martin/infinity`.
- Keep using `critic-loop-profi`; do not advance to the next audit step without an independent critic `GO` or explicit `BLOCKER`.
- Do not run watchers or keep dev servers/browser automation alive after checks.
- Do not copy secrets from chat, screenshots, shell history, or local env into repo files.

## Current Audit Step

Audit plan excerpt:

```text
P1-OPS-02. Incident runbooks
Area: Ops
Problem: Kernel down, DB down, delivery stuck, auth failure need runbooks.
Task: implement the change, update matching tests/docs, do not change unrelated design/runtime areas, preserve current validation gates.
Acceptance criteria: Runbooks exist and are linked from alerts.
Checks: focused unit/integration tests + relevant shell/work-ui checks + update validation packet where applicable.
```

Current interpretation:
- This step is about documented runbooks plus a machine-readable alert/runbook catalog exposed from shell diagnostics.
- It is not a live PagerDuty/Grafana/alert-manager provisioning task unless a later audit step explicitly expands the scope.

## Closed Critic Gates Through P1-OPS-02

### P1-QA-03 Load/backpressure

Status: closed with independent critic `GO`.

Implemented:
- status-preserving kernel request errors in `packages/api-clients/src/multica.ts`;
- shell 429/5xx mapping in `apps/shell/apps/web/app/api/control/orchestration/batches/route.ts`;
- shell burst/backpressure test in `apps/shell/apps/web/app/api/control/orchestration/batches/route.test.ts`;
- execution-kernel concurrency/reload test in `services/execution-kernel/internal/service/service_test.go`;
- `test:load-backpressure` and `.github/workflows/web-load-backpressure.yml`.

Verification reported as passed in the previous gate:
- `npm run typecheck --workspace @founderos/api-clients`
- `npm run typecheck --workspace @founderos/web`
- `npm run test:load-backpressure --workspace @founderos/web`
- `cd services/execution-kernel && go test ./...`
- focused web suite: 35 files / 193 tests
- `git diff --check`

### P1-OPS-01 Staging topology

Status: closed with independent critic `GO`.

Implemented:
- `buildStagingTopologyDiagnostics()` in `apps/shell/apps/web/lib/server/control-plane/workspace/rollout-config.ts`;
- `stagingTopology` in `/api/control/deployment/boot-diagnostics`;
- staging topology tests;
- `docs/ops/staging-topology.md`.

Verification reported as passed in the previous gate:
- `npm run typecheck --workspace @founderos/web`
- targeted suite: 5 files / 46 tests
- broader focused web suite: 37 files / 210 tests
- `git diff --check`

Residual non-blocking note from prior critic:
- Staging topology docs could be polished later to use only exact accepted secret-manager slugs.

### P1-OPS-02 Incident runbooks

Status: closed with independent critic `GO`.

Critic gate source:
- Local isolated CLI critic run with read-only sandbox:
  - `codex exec --ignore-user-config --cd /Users/martin/infinity --sandbox read-only --ephemeral -m gpt-5.2`
- Earlier in-app subagent attempts returned only acknowledgement text and were not counted as gates.
- First CLI attempt failed before review because the local CLI defaulted to unsupported model `gpt-5.5`; it was not counted as a gate.

Critic result summary:
- `Status: GO`
- Scope checked: P1-OPS-02 incident runbooks only.
- Done: four runbooks exist, stable anchors exist, alert IDs map to runbook links in docs and machine-readable catalog, boot diagnostics exposes `incidentRunbooks.alerts[].runbookPath`, tests cover catalog/doc anchors/boot diagnostics exposure.
- Partial: none.
- Missing or broken: none within the acceptance criteria.
- Shortcut note: no live PagerDuty/Grafana/alert-manager provisioning; critic agreed that is not required by P1-OPS-02 acceptance text.
- Fix items: none.
- Blocker: none.

## P1-OPS-02 Work Already Present

Files:
- `apps/shell/apps/web/lib/server/control-plane/ops/incident-runbooks.ts`
- `apps/shell/apps/web/lib/server/control-plane/ops/incident-runbooks.test.ts`
- `apps/shell/apps/web/app/api/control/deployment/boot-diagnostics/route.ts`
- `apps/shell/apps/web/app/api/control/deployment/boot-diagnostics/route.test.ts`
- `docs/ops/incident-runbooks.md`

Implemented behavior:
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
- `/api/control/deployment/boot-diagnostics` returns `incidentRunbooks`.
- Tests verify:
  - required incident coverage;
  - every alert links to a runbook;
  - every required alert/runbook pair is exposed from boot diagnostics;
  - the Markdown runbook document contains every linked anchor;
  - the staging readiness path still avoids leaking secret values.

## Verification Already Passed

Run from `/Users/martin/infinity`:

```sh
npm run typecheck --workspace @founderos/web
```

Result: passed.

Run from `/Users/martin/infinity/apps/shell/apps/web`:

```sh
npx vitest run \
  lib/server/control-plane/ops/incident-runbooks.test.ts \
  app/api/control/deployment/boot-diagnostics/route.test.ts \
  --testTimeout 120000
```

Result from the earlier targeted pass: 2 files / 6 tests passed.

Run from `/Users/martin/infinity/apps/shell/apps/web`:

```sh
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
```

Result from 2026-04-25 refresh: 8 files / 61 tests passed.

Run from `/Users/martin/infinity`:

```sh
git diff --check
```

Result: passed.

Tree state observed before this handoff refresh:

```sh
git status --short --untracked-files=all
```

Result: clean.

After this handoff refresh, the expected dirty file is only:

```text
docs/handoffs/2026-04-25-p1-ops-02-incident-runbooks-handoff.md
```

## What Cannot Be Claimed Closed Yet

Do not over-claim these:
- No live PagerDuty/Grafana/alert-manager rules were provisioned in this step.
- No full `npm run validate:full` or full browser E2E release gate was run for this step.
- No production deployment, staging smoke, or external delivery verification was performed in this step.
- No commit/push was performed by this handoff refresh.
- The next audit step has not been started in this handoff refresh.

## Next Verification Commands

Run these before advancing if the tree changes after this handoff:

```sh
cd /Users/martin/infinity
git status --short --untracked-files=all
npm run typecheck --workspace @founderos/web
```

```sh
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
```

```sh
cd /Users/martin/infinity
git diff --check
```

## Independent Critic Gate Prompt for Re-Run

Use this prompt if the tree changes or a second independent P1-OPS-02 gate is required:

```text
You are the independent critic gate for audit step P1-OPS-02 in /Users/martin/infinity. Use critic-loop-profi standards. Inspect the repo and evidence, do not edit files, and return exactly one gate result: GO, NO-GO, or BLOCKER.

Scope and rules:
- Current step only: P1-OPS-02 incident runbooks.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md, section P1-OPS-02.
- Acceptance: kernel down, DB down, delivery stuck, and auth failure runbooks exist and are linked from alerts.
- Reference repos are read-only: /Users/martin/FounderOS, /Users/martin/open-webui, /Users/martin/hermes-webui, and external cabinet snapshots.
- Do not judge unrelated earlier dirty files unless they break this step.
- Do not require live PagerDuty/Grafana/alert-manager provisioning unless you can tie that requirement directly to the P1-OPS-02 acceptance text.

Implementation evidence to inspect:
- apps/shell/apps/web/lib/server/control-plane/ops/incident-runbooks.ts
- apps/shell/apps/web/lib/server/control-plane/ops/incident-runbooks.test.ts
- apps/shell/apps/web/app/api/control/deployment/boot-diagnostics/route.ts
- apps/shell/apps/web/app/api/control/deployment/boot-diagnostics/route.test.ts
- docs/ops/incident-runbooks.md
- docs/handoffs/2026-04-25-p1-ops-02-incident-runbooks-handoff.md

Verification already run:
- npm run typecheck --workspace @founderos/web: passed.
- targeted P1-OPS-02 vitest suite: 2 files / 6 tests passed.
- broader focused web vitest suite: 8 files / 61 tests passed.
- git diff --check: passed.

Return using the critic-loop-profi template:

Status: GO | NO-GO | BLOCKER

Scope checked:
- ...

Done:
- ...

Partial:
- ...

Missing or broken:
- ...

Shortcut or disguised manual step:
- ...

Evidence checked:
- ...

Fix items:
1. ...

Blocker:
- ...
```

## Stop Point for Next Agent

The next agent should:
1. Open `/Users/martin/infinity`.
2. Read this handoff and the P1-OPS-02 section of `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`.
3. Treat P1-OPS-02 as closed unless new local changes invalidate the evidence.
4. If the tree changed, re-run the verification commands above and then re-run the critic prompt.
5. If a re-run critic returns `NO-GO`, fix only P1-OPS-02, rerun focused verification, then rerun critic.
6. If the evidence still holds, move to the next audit step without reopening P1-OPS-02.
