# rate-limit capture template

```text
source: app-server
endpoint: account/rateLimits/read | account/rateLimits/updated
scenario_id: RL-###
scenario: healthy | high-pressure | exhausted | auth-mode-diff
captured_at_utc: YYYY-MM-DDTHH:MM:SSZ
account_id: account-...
auth_mode: chatgpt | chatgptAuthTokens | apikey | unknown
sequence: <int, for updated stream records>
source_event_id: <string | null>
redaction_notes: none | partial | sensitive fields removed
artifact: relative/path/to/raw-file
checksum_sha256: <hex>
expected_golden: relative/path/to/golden-file
```
