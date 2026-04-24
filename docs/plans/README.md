# docs/plans

This directory mixes two kinds of files:

- **current planning spine**
  - plans that still explain the current product shape, release gates, or active follow-up work
- **historical planning snapshots**
  - dated plans that captured an earlier branch state, audit moment, or implementation wave

Use this rule when reading:

- prefer plans that are directly referenced by the current acceptance note, the merged release PR, or an open follow-up issue
- treat older dated plans as historical reference unless a current document explicitly points back to them

For the solo-v1 closeout sequence, the key current references are:

- `2026-04-24-browser-e2e-runnable-result-remediation-tz.md`
- `2026-04-23-fresh-readiness-audit-and-closeout-plan.md`
- `2026-04-23-final-remaining-fixes-addendum.md`

The 2026-04-24 TZ is the current remediation spine for making the product pass a real browser path from idea to runnable localhost result. The 2026-04-23 files describe the historical closeout path that was later completed and merged into canonical `master`.
