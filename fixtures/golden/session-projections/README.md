# golden/session-projections

Store expected `ExecutionSessionSummary` and group projections here.

Keep the output aligned with the frozen session state machine.

Each projection file includes both:

- `expectedSummary` for `materializeSessionProjections`
- `expectedGroupProjection` for `materializeGroupProjections`
