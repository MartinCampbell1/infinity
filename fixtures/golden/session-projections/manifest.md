# golden/session-projections manifest

```text
file | raw_source | scenario_id | scenario | session_state | expected_phase | notable_fields | invariants
```

```text
codex-happy-path.projection.json | codex-happy-path.normalized.json | CJ-001 | happy path completion | completed | completed | pendingApprovals=0,retryCount=0,recoveryState=none | sessionId is stable; terminal status is completed
codex-approval-recovery.projection.json | codex-approval-recovery.normalized.json | CJ-002 | approval + failure + recovery + completion | completed | completed | pendingApprovals=0,retryCount>=1,recoveryState=recovered | approval resolved before completion
hermes-happy-path.projection.json | hermes-happy-path.normalized.json | HS-001 | hermes happy path | completed | completed | pendingApprovals=0,toolActivityCount=1 | workspace.ready keeps session progression deterministic
hermes-approval-error.projection.json | hermes-approval-error.normalized.json | HS-002 | hermes blocked + recovery path | completed | completed | pendingApprovals=1,retryCount=1,recoveryState=recovered | unresolved approvals stay visible unless explicit approval.resolved arrives
supervisor-mixed-session.projection.json | supervisor-mixed-session.normalized.json | SV-001 | supervisor intervention path | recovered | completed | pendingApprovals=1,retryCount=1,recoveryState=recovered | control-plane can track mixed-runtime intervention from append-only supervisor logs
```
