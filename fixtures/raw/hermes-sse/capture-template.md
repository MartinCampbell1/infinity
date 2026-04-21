# hermes SSE capture template

```text
source: hermes
scenario_id: HS-###
scenario: happy-path | approval-required | error | done | mixed-runtime
captured_at_utc: YYYY-MM-DDTHH:MM:SSZ
transport: sse
session_id: sess-...
stream_boundary: start->done | start->error
redaction_notes: none | partial | sensitive fields removed
artifact: relative/path/to/raw-file
checksum_sha256: <hex>
expected_golden: relative/path/to/golden-file
```
