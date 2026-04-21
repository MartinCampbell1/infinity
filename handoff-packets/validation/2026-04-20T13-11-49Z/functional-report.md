# Functional Report

Run ID: `2026-04-20T13-11-49Z`
Generated: `2026-04-20T13:15:51.030469+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 17.88s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-11-49Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 8.30s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-11-49Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 4.02s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-11-49Z/logs/shell_test.log
- `shell_build` — `passed`
  - Command passed in 18.94s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-11-49Z/logs/shell_build.log
- `work_ui_check` — `passed`
  - Command passed in 29.26s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-11-49Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 3.42s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-11-49Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 96.27s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-11-49Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776690906445-4sc3q7h4", "brief_id": "brief-1776690906478-8wy54flk", "task_graph_id": "task-graph-initiative-1776690906445-4sc3q7h4-brief-1776690906478-8wy54flk", "batch_ids": ["batch-1776690906827-w24h5kot", "batch-1776690906770-80gcuvs1", "batch-1776690906670-mvm0vlv0", "batch-1776690906560-5zix61rp", "batch-1776690906501-vcv9g9mh"], "delivery_id": "delivery-1776690907001-vogchbsr", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "root_frontdoor": {"requested_entry_path": "/", "resolved_url": "http://127.0.0.1:3737/", "redirected_to_execution": false, "composer_visible": true, "shell_anchor_visible": true, "secondary_actions_visible": true}, "manual_stage_labels": {"workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1776690907001-6ot8s5ne", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776690906445-4sc3q7h4/delivery-1776690907001-vogchbsr/HANDOFF.md", "result_url": "http://127.0.0.1:3101/project-result/initiative-1776690906445-4sc3q7h4?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3737&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0yMFQxMzoxNToxNi4zNDJaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0yMFQxMzoyMDoxNi4zNDJaIn0.uPpLUTC_I3PRA49a3hcc_KIGh2h2Fg4G4PDBybgO_ro"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776690917206-0hzstijy", "task_graph_id": "task-graph-initiative-1776690917206-0hzstijy-brief-1776690917219-3i7bkwci", "delivery_id": "delivery-1776690920389-83f6p8wb", "recovered_batches": ["batch-1776690919919-c6gct66o", "batch-1776690919982-dd8n014y", "batch-1776690920085-b1aoo8fy", "batch-1776690920216-syzvfc6b"], "recovery_override_used": true}

## Artifacts
- `route-matrix.json`
- `api-exposure-checklist.json`
- `screenshot-manifest.json`
- `autonomous-proof.json`
- `critic-brief.md`

## Autonomous Evidence
- root frontdoor composer visible: `True`
- root frontdoor shell anchor visible: `True`
- root frontdoor secondary actions visible: `True`
- root frontdoor redirected to /execution: `False`
- autonomous one prompt: `True`
- preview ready: `True`
- handoff ready: `True`
- failure recovery override used: `True`
