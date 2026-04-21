# raw/hermes-sse

Store raw Hermes SSE streams here.

Minimum coverage:

- token events;
- tool events;
- approval request and resolution;
- error and done cases.

Current fixture pack:

- `hermes-happy-path.sse` — session start, tool cycle, approval cycle, message complete, turn complete.
- `hermes-approval-error.sse` — blocked approval, runtime error, recovery cycle, turn completion.

Normalization reference inputs:

- `hermes-happy-path.sse` -> `normalizeHermesSseEvents({ sessionId: "sess_hermes_happy", projectId: "proj_atlas", groupId: null })`
- `hermes-approval-error.sse` -> `normalizeHermesSseEvents({ sessionId: "sess_hermes_error", projectId: "proj_atlas", groupId: null })`
