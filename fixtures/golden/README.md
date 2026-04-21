# fixtures/golden

Golden outputs live here.

Rules:

- keep projections deterministic;
- pair each golden file with a specific raw scenario;
- update the golden whenever event mapping, quota logic, or recovery semantics change.
- include explicit invariant notes in manifest rows;
- keep projection ordering stable for replay tests.

Leaf buckets:

- `normalized-events`
- `session-projections`
- `quota-projections`
