# 2026-04-25 P2-BE-04 Structured Error Response Handoff

## Current Audit Step

- Step: `P2-BE-04. Structured error response standard`
- Source of truth: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Acceptance criteria: adopt `{ error: { code, message, details } }` or similar; clients handle consistently.
- Repo boundary: all edits are inside `/Users/martin/infinity`; reference repos remain read-only.

## Closed Critic Gates Before This Step

- `P1-OPS-02` incident runbooks: independent critic gate `GO`
- `P2-DX-01` lint scripts: independent critic gate `GO`
- `P2-DX-02` dependency hygiene: independent critic gate `GO`
- `P2-DX-03` layout refactor: independent critic gate `GO`
- `P2-DX-04` typed route helpers: first critic `NO-GO`, fixed, rerun `GO`
- `P2-QA-01` critical coverage thresholds: independent critic gate `GO`
- `P2-QA-02` migration drift detection: independent critic gate `GO`
- `P2-QA-03` delivery manifest fixtures: independent critic gate `GO`
- `P2-FE-01` shared design tokens: independent critic gate `GO`
- `P2-FE-02` loading skeletons and retry states: independent critic gate `GO`
- `P2-FE-03` actionable empty states: independent critic gate `GO`
- `P2-FE-04` execution error boundary: independent critic gate `GO`
- `P2-BE-01` retention cleanup: independent critic gate `GO`
- `P2-BE-02` directory pagination and cache: independent critic gate `GO`
- `P2-BE-03` pagination/filtering/search consistency: independent critic gate `GO`

## What Changed In P2-BE-04

- Added structured API error helpers:
  - `apps/shell/apps/web/lib/server/http/api-error-response.ts`
  - `apps/shell/apps/web/lib/server/http/api-error-response.test.ts`
- Updated storage-unavailable responses to use the structured envelope:
  - `apps/shell/apps/web/lib/server/http/control-plane-storage-response.ts`
- Updated client snapshot error parsing to prefer `error.message` while still understanding legacy bodies:
  - `apps/shell/apps/web/lib/shell-snapshot-client.ts`
- Converted control API route-level error responses away from mixed `detail`/string `error` bodies to:
  - `{ error: { code, message, details? } }`
- Updated affected control API tests to assert the structured envelope.

## Behavior

- Error responses now use:

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Operator readable message.",
    "details": {}
  }
}
```

- Storage policy failures now carry storage metadata under `error.details`.
- Idempotency conflicts now carry `accepted: false` under `error.details`.
- Shell snapshot clients read `error.message` first and fall back to legacy `detail`, `message`, or string `error`.
- `app/api/control/deployment/boot-diagnostics/route.ts` still contains an `error` data field because it is a diagnostic success payload, not an API error response.

## Verification Passed

Run from `/Users/martin/infinity/apps/shell/apps/web` unless noted.

```bash
npx vitest run lib/server/http/api-error-response.test.ts app/api/control
```

Result: passed, 29 test files / 112 tests.

```bash
npx eslint lib/server/http/api-error-response.ts lib/server/http/api-error-response.test.ts lib/server/http/control-plane-storage-response.ts lib/shell-snapshot-client.ts app/api/control
```

Result: passed with warnings only. The warnings are existing `turbo/no-undeclared-env-vars` warnings in control API tests; no ESLint errors.

From repo root:

```bash
NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
```

Result: passed.

```bash
git diff --check
```

Result: passed.

Route-shape scan:

```bash
rg -n "detail:|error: \"|error:" apps/shell/apps/web/app/api/control apps/shell/apps/web/app/api/shell -g 'route.ts'
```

Result: only `app/api/control/deployment/boot-diagnostics/route.ts` remains, and those `error` fields are diagnostic success fields.

## Independent Critic Gate Result

- Status: `GO`
- Scope checked: P2-BE-04 structured error response helper, storage-unavailable response, control API route-level error shapes, sampled tests, shell snapshot client parsing, and this handoff.
- Evidence checked: `api-error-response.ts`, `api-error-response.test.ts`, `control-plane-storage-response.ts`, `shell-snapshot-client.ts`, control API routes/tests, route-shape scan results, and documented verification commands.
- Partial: upstream kernel mocks in control API tests still emit legacy `{ detail: "..." }` bodies; this is acceptable because route-level responses are standardized and client parsing remains legacy-compatible.
- Non-blocking fix item: dedupe client parsing by reusing `extractApiErrorMessage()` or aligning it with one shared helper to reduce future drift.
- Blocker: none.

## Not Closed Yet

- Some non-route domain contracts still use `note` as a success/verification field; this step only standardizes API error responses.
- The structured envelope is now applied to control API route-level errors; external upstream mocks in tests may still return legacy `detail` bodies because they simulate old kernel behavior.
- No browser/dev-server visual pass was run because this is a backend API response standardization step.
- No full shell `npm test` was run. Earlier broad shell test execution in this branch hit unrelated visual-regression baseline drift.

## Next Verification Commands

Focused checks:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run lib/server/http/api-error-response.test.ts app/api/control
npx eslint lib/server/http/api-error-response.ts lib/server/http/api-error-response.test.ts lib/server/http/control-plane-storage-response.ts lib/shell-snapshot-client.ts app/api/control
rg -n "detail:|error: \"|error:" app/api/control app/api/shell -g 'route.ts'
```

Root checks:

```bash
cd /Users/martin/infinity
NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
git diff --check
```

## Independent Critic Gate Prompt

```text
You are an independent critic-auditor for /Users/martin/infinity.

Use critic-loop-profi semantics and return exactly one gate status: GO, NO-GO, or BLOCKER.

Scope:
- Audit step: P2-BE-04. Structured error response standard.
- Source of truth: /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md
- Acceptance criteria: Adopt {error:{code,message,details}} or similar; clients handle consistently.
- Repo rule: reference repos are read-only; only /Users/martin/infinity is editable.
- Resource rule: no watchers/dev servers/full repo checks unless needed.

Implementation evidence to inspect:
- apps/shell/apps/web/lib/server/http/api-error-response.ts
- apps/shell/apps/web/lib/server/http/api-error-response.test.ts
- apps/shell/apps/web/lib/server/http/control-plane-storage-response.ts
- apps/shell/apps/web/lib/shell-snapshot-client.ts
- apps/shell/apps/web/app/api/control
- apps/shell/apps/web/app/api/control/*/**/*.test.ts
- docs/handoffs/2026-04-25-p2-be-04-structured-error-response-handoff.md

Verification already run:
- cd apps/shell/apps/web && npx vitest run lib/server/http/api-error-response.test.ts app/api/control
- cd apps/shell/apps/web && npx eslint lib/server/http/api-error-response.ts lib/server/http/api-error-response.test.ts lib/server/http/control-plane-storage-response.ts lib/shell-snapshot-client.ts app/api/control
- cd apps/shell/apps/web && rg -n "detail:|error: \"|error:" app/api/control app/api/shell -g 'route.ts'
- NODE_OPTIONS='--max-old-space-size=1280' npm run typecheck --workspace @founderos/web
- git diff --check

Question:
Does P2-BE-04 satisfy its bounded acceptance criteria with enough evidence to proceed to the next audit step?

Return:
Status: GO | NO-GO | BLOCKER
Scope checked:
Done:
Partial:
Missing or broken:
Shortcut or disguised manual step:
Evidence checked:
Fix items:
Blocker:
```
