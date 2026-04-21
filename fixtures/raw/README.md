# fixtures/raw

Raw captures live here.

Rules:

- keep captures as source-close as possible;
- one scenario per file when practical;
- add a sidecar note or manifest entry for source, date, and redaction policy;
- do not normalize raw data in place.
- use UTC `captured_at` values;
- include scenario ID in filename where possible;
- never reuse one raw file for unrelated scenarios.

Leaf buckets:

- `codex-jsonl`
- `codex-app-server-rate-limits`
- `hermes-sse`
- `codext-session-supervisor`
