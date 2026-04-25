# Manual QA Screenshot Checklist

Use this checklist when preparing a visual release packet. It is intentionally
manual: the operator should attach or confirm screenshots that match the
manifested screen IDs before treating the visual release evidence as complete.

Source manifest: `docs/validation/screenshot-pack.json`

## Desktop Screens

- `workui_home_embedded` — embedded workspace home opened from the shell.
- `shell_root_frontdoor` — shell frontdoor with the operator run entry.
- `workui_project_brief` — project brief in the embedded work UI.
- `shell_task_graph` — planner task graph in the shell.
- `shell_batch_supervision` — batch supervision and attempt state.
- `shell_approvals` — approvals board with pending/resolved state.
- `shell_recoveries` — recovery lane with retry/failover actions.
- `shell_audits` — audit lane with operator intervention history.
- `workui_project_run` — project run view in work UI.
- `workui_project_result_passed` — passed result view with proof summary.
- `shell_delivery_ready` — delivery board/detail showing ready evidence.

## Failure Screens

- `workui_run_blocked` — workspace run blocked state.
- `workui_result_blocked_verification` — result blocked on verification.
- `workui_result_blocked_delivery` — result blocked on delivery evidence.
- `shell_retryable_recovery` — retryable recovery incident in shell.
- `shell_pending_approval` — pending approval visible in shell.

## Standalone Screens

- `workui_root_standalone` — work UI standalone root.
- `workui_auth_or_redirect_state` — work UI auth or redirect state.
- `shell_root_entry_standalone` — shell root entry without embedded context.

## Review Rules

- Capture the whole viewport unless the release packet explicitly asks for a
  detail crop.
- Redact or avoid credentials, launch tokens, raw bearer values, and private file
  contents.
- Confirm that screenshots match the current commit and validation packet.
- Mark missing screenshots as release evidence gaps instead of silently
  substituting older images.
- Keep visual notes calm and concrete: what screen was checked, what state was
  visible, and what evidence is missing.
