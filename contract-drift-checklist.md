# contract-drift-checklist.md — Pre-Merge QA Gate

## Purpose

Use this before merge for any change touching contracts, fixtures, bridge flows, or projections.

If any item is "no", the PR is not mergeable.

## Preflight

- Change stays inside `/Users/martin/infinity` only.
- External repos were not edited.
- PR scope maps to one bounded stream owner.

## Contract freeze checks

- No frozen contract changed without an explicit contract-diff section.
- `sessionId` remains the canonical internal key.
- `externalSessionId` remains primary runtime external ID only.
- Bridge message union remains compatible with frozen host/workspace contract.
- Approval response semantics remain idempotent and auditable.
- Quota semantics keep ChatGPT truth and API-key separation.

## Fixture and projection checks

- Raw fixtures were added or updated for every changed scenario.
- Golden outputs were added or updated for every changed raw scenario.
- Each updated raw file has manifest metadata and redaction note.
- Each updated golden file maps to one raw input and explicit invariants.
- Event identity, ordering, and timestamp provenance remain deterministic.
- Session status and phase precedence still match freeze rules.

## Integration flow checks

- Mandatory flow IDs in `integration-matrix.md` were reviewed.
- Required smoke checks were run or explicitly marked blocked with reason.
- Launch sequence impact was reflected in `launch-order.md` when needed.

## Required artifacts in PR description

- Contract-diff summary.
- List of changed raw fixtures.
- List of changed golden fixtures.
- Integration flow IDs impacted.
- Explicit owner signoff line for stream `08`.

## Required reviewer signoff

- `08` QA / contracts / integration.
- Owning stream for the changed surface.

## Fast-fail cases

- Raw fixture changed without matching golden update.
- Bridge message changed without launch-contract note.
- New runtime ID introduced without binding ownership rule.
- Derived projection field changed without reducer rule and fixture evidence.
