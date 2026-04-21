# golden/normalized-events manifest

```text
file | raw_source | scenario_id | scenario | event_kinds | expected_identity_rule | expected_timestamp_rule | invariants
```

```text
codex-happy-path.normalized.json | codex-happy-path.jsonl | CJ-001 | planning/acting/validation happy path | session.started,turn.started,agent.message.completed,tool.completed,turn.completed | id={sessionId}:{source}:{kind}:{timestamp}:{ordinal} | source timestamp preferred | monotonic ordering within session
codex-approval-recovery.normalized.json | codex-approval-recovery.jsonl | CJ-002 | approval requested -> failure -> recovery -> completion | approval.requested,turn.failed,recovery.started,recovery.completed,turn.completed | id={sessionId}:{source}:{kind}:{timestamp}:{ordinal} | source timestamp preferred | one approval flow resolves deterministically
hermes-happy-path.normalized.json | hermes-happy-path.sse | HS-001 | session/tool/approval happy path | session.started,session.updated,tool.started,approval.requested,turn.completed | id={sessionId}:{source}:{kind}:{timestamp}:{ordinal} | source timestamp preferred | workspace.ready maps to session.updated
hermes-approval-error.normalized.json | hermes-approval-error.sse | HS-002 | approval blocked + error + recovery | approval.requested,error.raised,recovery.started,recovery.completed,turn.completed | id={sessionId}:{source}:{kind}:{timestamp}:{ordinal} | source timestamp preferred | blocked flow remains append-only
supervisor-mixed-session.normalized.json | supervisor-mixed-session.ndjson | SV-001 | mixed-runtime binding and interventions | session.updated,approval.requested,recovery.started,recovery.completed | id={sessionId}:manual:{kind}:{timestamp}:{ordinal} | source timestamp preferred | sessionId inferred from raw payload when input does not force one
```
