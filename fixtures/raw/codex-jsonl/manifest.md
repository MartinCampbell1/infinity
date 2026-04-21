# raw/codex-jsonl manifest

Use one line per capture.

```text
file | source_command | scenario_id | scenario | captured_at_utc | session_id | provider | redaction_notes | checksum_sha256
```

```text
codex-happy-path.jsonl | codex exec --json | CJ-001 | planning/acting/validation happy path | 2026-04-11T09:00:14Z | sess-demo-001 | codex | synthetic fixture | fill-me
codex-approval-recovery.jsonl | codex exec --json | CJ-002 | approval requested -> failure -> recovery -> completion | 2026-04-11T09:15:09Z | sess-demo-002 | codex | synthetic fixture | fill-me
```

```text
normalization_input
CJ-001 -> normalizeCodexJsonlEvents({ sessionId: "sess_codex_happy", projectId: "proj_atlas", groupId: null })
CJ-002 -> normalizeCodexJsonlEvents({ sessionId: "sess_codex_recovery", projectId: "proj_atlas", groupId: null })
```
