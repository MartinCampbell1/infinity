# Validation

This directory defines the repo-local validation system for Infinity.

## Purpose

The validation loop has two separate outputs:

- **functional validation**
  - root-entry proof from `/` into the current shell operator surface
  - route coverage
  - end-to-end user/operator scenarios
  - backend capability exposure
- **UI/UX criticism**
  - screenshot-based review
  - FounderOS-fit scoring
  - iteration until the score is above the target threshold

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
