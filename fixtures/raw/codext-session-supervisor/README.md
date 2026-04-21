# raw/codext-session-supervisor

Store internal supervisor logs or NDJSON captures here.

This bucket is intentionally manual-only unless a stable export path is defined.

Current fixture pack:

- `supervisor-mixed-session.ndjson` — binding and operator intervention trail for one mixed-runtime session.

Normalization reference input:

- `supervisor-mixed-session.ndjson` -> `normalizeSupervisorNdjsonEvents({ lines, projectId: "proj_atlas", groupId: null })`
