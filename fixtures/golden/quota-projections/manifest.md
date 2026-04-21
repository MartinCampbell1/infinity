# golden/quota-projections manifest

```text
file | raw_source | scenario_id | scenario | auth_mode | expected_pressure | schedulable | preferred_for_new_sessions | invariants
chatgpt-healthy.projection.json | read-chatgpt-healthy.json | RL-001 | healthy | chatgpt | low | true | true | derived from upstream buckets
chatgpt-high.projection.json | read-chatgpt-high.json | RL-002 | high-pressure | chatgptAuthTokens | high | true | false | pressure reflects upstream utilization
apikey-runtime.projection.json | read-apikey-observed-runtime.json | RL-003 | auth-mode-diff | apikey | medium | true | false | no fake chatgpt buckets
```
