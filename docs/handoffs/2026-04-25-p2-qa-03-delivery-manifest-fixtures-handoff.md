# 2026-04-25 P2-QA-03 Delivery Manifest Golden Fixtures Handoff

## Current audit step

- Audit source: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`
- Current step: `P2-QA-03. Snapshot tests for generated delivery manifests`
- Area: QA
- Acceptance: Golden fixtures for local/prod delivery manifests.

## Closed critic gates before this step

- `P1-OPS-02` incident runbooks: independent critic `GO`
- `P2-DX-01` lint scripts are non-mutating by default: independent critic `GO`
- `P2-DX-02` dependency hygiene: independent critic `GO`
- `P2-DX-03` high-risk layout refactor: independent critic `GO`
- `P2-DX-04` typed route helpers: independent critic `GO` on iteration 2
- `P2-QA-01` critical coverage thresholds: independent critic `GO`
- `P2-QA-02` migration drift detection: independent critic `GO`

## What changed for P2-QA-03

- Added golden delivery manifest fixtures:
  - `apps/shell/apps/web/lib/server/orchestration/fixtures/delivery-manifests/local.json`
  - `apps/shell/apps/web/lib/server/orchestration/fixtures/delivery-manifests/production.json`
- Extended `apps/shell/apps/web/lib/server/orchestration/artifacts.test.ts` with:
  - local manifest compatibility test via `buildDeliveryManifest`
  - production/object-store manifest compatibility test via `writeDeliveryManifest`
- Added scripts:
  - root `shell:test:delivery-manifests`
  - shell workspace `test:delivery-manifests`
- Added CI gate:
  - `.github/workflows/web-delivery-manifests.yml`
- Documented fixture ownership and refresh policy:
  - `docs/qa/delivery-manifest-golden-fixtures.md`
- Added artifact-store environment keys to `turbo.json` so targeted eslint sees explicit env dependencies.

## Verification completed

Focused fixture gate:

```bash
npm run shell:test:delivery-manifests
```

Observed result:

```text
Test Files  1 passed (1)
Tests  2 passed | 5 skipped (7)
```

Full artifact manifest test file:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run lib/server/orchestration/artifacts.test.ts
```

Observed result:

```text
Test Files  1 passed (1)
Tests  7 passed (7)
```

Static checks:

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('apps/shell/apps/web/package.json','utf8')); console.log('package JSON ok')"
node -e "for (const f of ['local','production']) { JSON.parse(require('fs').readFileSync('apps/shell/apps/web/lib/server/orchestration/fixtures/delivery-manifests/'+f+'.json','utf8')); } console.log('delivery manifest fixtures JSON ok')"
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/web-delivery-manifests.yml'); puts 'web-delivery-manifests workflow YAML ok'"
cd /Users/martin/infinity/apps/shell/apps/web && npx eslint lib/server/orchestration/artifacts.test.ts
git diff --check
```

All passed. One earlier invalid verification attempt tried to parse the YAML workflow as JSON; that was a command mistake and was replaced by the Ruby YAML parse above.

## What is not closed by this step

- This does not create golden fixtures for every delivery route integration scenario; it covers the canonical generated local and production/object-store manifest shapes.
- The production fixture intentionally validates the stored object-store manifest shape, where `localhostReady` is converted to `localRunnableProofReady` and `launchProofUrl` is removed.
- This does not change delivery runtime behavior beyond test coverage and explicit env wiring.

## Commands for next verification

```bash
cd /Users/martin/infinity
npm run shell:test:delivery-manifests
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/web-delivery-manifests.yml')"
git diff --check
```

Optional broader check:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run lib/server/orchestration/artifacts.test.ts
npx eslint lib/server/orchestration/artifacts.test.ts
```

## Independent critic gate prompt

```text
You are an independent critic-auditor for /Users/martin/infinity.

Audit step: P2-QA-03. Snapshot tests for generated delivery manifests.
Acceptance from /Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md:
"Golden fixtures for local/prod delivery manifests."

Files to inspect:
- .github/workflows/web-delivery-manifests.yml
- package.json
- turbo.json
- apps/shell/apps/web/package.json
- apps/shell/apps/web/lib/server/orchestration/artifacts.test.ts
- apps/shell/apps/web/lib/server/orchestration/fixtures/delivery-manifests/local.json
- apps/shell/apps/web/lib/server/orchestration/fixtures/delivery-manifests/production.json
- docs/qa/delivery-manifest-golden-fixtures.md
- docs/handoffs/2026-04-25-p2-qa-03-delivery-manifest-fixtures-handoff.md

Evidence already observed:
- npm run shell:test:delivery-manifests passed
- npx vitest run lib/server/orchestration/artifacts.test.ts passed
- package.json and apps/shell/apps/web/package.json parsed as valid JSON
- local and production fixture JSON parsed successfully
- .github/workflows/web-delivery-manifests.yml parsed as YAML via Ruby
- npx eslint lib/server/orchestration/artifacts.test.ts passed from apps/shell/apps/web
- git diff --check passed

Review for:
- Does this satisfy P2-QA-03 as a bounded remediation?
- Are there golden fixtures for both local and production generated delivery manifests?
- Is the production fixture testing the stored object-store manifest shape, not only a local builder object?
- Is the CI/script wiring sufficient for the snapshot tests to run?
- Are there material gaps that should block this step, not just future broader coverage?

Return exactly one of:
GO
NO-GO: <specific blockers>
BLOCKER: <specific reason this cannot be evaluated>
```
