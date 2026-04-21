# codext-session-supervisor capture template

```text
source: codext-session-supervisor
scenario_id: CS-###
scenario: session-start | handoff | retry | failover | recovery | restart
captured_at_utc: YYYY-MM-DDTHH:MM:SSZ
format: ndjson | log
session_id: sess-...
bridge_ref: founderos-bootstrap | workspace-ready | n/a
redaction_notes: none | partial | sensitive fields removed
artifact: relative/path/to/raw-file
checksum_sha256: <hex>
expected_golden: relative/path/to/golden-file | n/a
```
