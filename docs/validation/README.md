# Validation

This directory defines the repo-local validation system for Infinity.

## Purpose

The validation loop has four separate evidence layers. They must stay separate in
validation packets and release notes:

- **repo checks**
  - package/type/test/build checks run from the repository
  - kernel/service health checks
  - clean-tree proof before and after release validation
- **functional validator**
  - root-entry proof from `/` into the current shell operator surface
  - route coverage
  - end-to-end user/operator scenarios
  - backend capability exposure
- **screenshot critic**
  - screenshot-based review
  - FounderOS-fit scoring
  - iteration until the score is above the target threshold
- **browser product E2E**
  - fresh prompt submitted from `/`
  - observed autonomous flow from brief to delivery
  - generated localhost preview opened and interacted with
  - generated manual browser checklist tied to the E2E snapshots and report

No single layer is a substitute for the others. In particular, a green repo check
or functional validator packet is not final-release-ready evidence if the
screenshot critic is pending or the browser product E2E proof is missing.

## Current Browser E2E Release Gate

As of the 2026-04-24 audit, a validation packet is not enough to claim that the
product works from idea to finished localhost app unless it includes a real
browser product E2E proof:

- submit a fresh prompt from `/`;
- observe brief, task graph, work units, executor attempts, assembly,
  verification, delivery, and preview;
- prove `delivery.ready` with `launch_kind = runnable_result`;
- open and interact with the generated localhost preview.
- write `manual-browser-checklist.md` into the final validation packet, with
  every checklist item tied to browser/API evidence.

The active remediation TZ is `docs/plans/2026-04-24-browser-e2e-runnable-result-remediation-tz.md`.

## Main assets

- `route-inventory.json`
  - page-route and API-route coverage inventory
- `screenshot-pack.json`
  - required screenshot IDs per validation run
- `critic-rubric.md`
  - scoring guidance for the critic
- `critic-prompt.md`
  - reusable prompt for a screenshot-only critic subagent
- `schemas/*.schema.json`
  - stable output schemas for run artifacts

## Main command

From the repo root:

```bash
npm run validate:full
```

`npm run validate:full` runs the browser product E2E gate and links the browser
packet from `functional-report.json` and `final-validation-summary.md`. It also
writes `manual-browser-checklist.md` into the validation packet so the
human-readable checklist and machine-readable browser report stay together.

The release packet keeps four layers explicit:

- `repo_checks`
- `browser_product_e2e`
- `critic`
- `release_readiness`

The final packet is only `passed-final-release` when the functional validation,
browser E2E, and completed passing critic all pass. A named browser skip is
allowed with `--skip-browser-e2e "<reason>"`, but that downgrades the packet to
`functional-only`; it is not final-release-ready. If the external critic is
`pending_external_critic`, skipped, or not finalized, `release_readiness.status`
is `not_final`.

Fixture-only no-op validation command overrides remain allowed in unit tests,
but release validation does not inject `node -e process.exit(0)` as product
proof. The user-facing autonomous proof comes from the browser product E2E and
the managed functional scenarios.

The validator starts only the services it owns. If canonical local ports are
already occupied, it uses nearby fallback ports and records the requested and
actual ports in the final packet instead of terminating existing services.

Generated validation packets are local evidence, not source files. The
repo-local ignore policy covers `handoff-packets/validation/`,
`handoff-packets/browser-e2e/`, and `.local-state/` so validation runs do not
leave new untracked packet directories in `git status --short`. The tracked
`apps/shell/apps/web/next-env.d.ts` file intentionally includes Next typed
routes via `import "./.next/types/routes.d.ts";`; validation should not rewrite
that canonical state. Each validation packet also writes `git-status-before.txt`,
`git-status-after.txt`, and `tracked_state` in `functional-report.json` so this
claim is auditable.

Or, if the external screenshot critic JSON is already available:

```bash
python3 scripts/validation/run_infinity_validation.py \
  --require-runnable-result \
  --critic-json /path/to/critic-output.json
```

This produces a new validation packet under:

```text
handoff-packets/validation/<timestamp-run-id>/
```

## Critic loop

The runner generates:

- screenshots
- screenshot manifest
- functional report
- critic brief

The functional report should treat `/` as the frontdoor entry for the product.
If the current build still resolves `/` into `/execution`, the report should record that redirect as evidence instead of pretending the legacy route is the user-facing entrypoint.

Then a separate critic subagent should review the screenshots using `critic-prompt.md`.

After the external critic returns strict JSON, finalize the bundle with:

```bash
python3 scripts/validation/finalize_critic_report.py \
  --run-dir handoff-packets/validation/<timestamp-run-id> \
  --critic-json /path/to/critic-output.json
```

The critic loop is not considered complete until:

- `overall_score > 7.0`
- no core cluster score is below `6.5`
- no unresolved `must_fix` findings remain

## Acceptance Policy

Use three separate layers and keep them explicit:

- **validated code checkpoint**
  - the exact clean commit where the full gate passed
- **acceptance note**
  - the current human-readable summary in `2026-04-23-current-tip-acceptance.md`
  - if a later docs-only commit updates the note, keep the validated code checkpoint named explicitly inside the note
- **validated-state tag**
  - use a stable tag when you want a durable anchor for the validated release state, even if `master` later moves forward with docs-only follow-up commits

Practical rule:

- if code changes, rerun the full gate before calling the new head validated
- if only docs change after a validated clean checkpoint, do not silently imply the docs-only head was fully revalidated unless you actually reran the gate
- when in doubt, prefer saying:
  - current canonical head
  - latest validated clean code checkpoint
  - latest validation bundle

This keeps the repo, release notes, and acceptance note honest without forcing unnecessary full reruns for every docs-only follow-up.
