# Functional Report

Run ID: `2026-04-20T13-32-35Z`
Generated: `2026-04-20T13:36:11.594661+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 10.19s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-32-35Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 3.97s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-32-35Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 2.67s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-32-35Z/logs/shell_test.log
- `shell_build` — `passed`
  - Command passed in 11.06s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-32-35Z/logs/shell_build.log
- `work_ui_check` — `passed`
  - Command passed in 24.12s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-32-35Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 4.38s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-32-35Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 78.53s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-32-35Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776692124795-521vlp22", "brief_id": "brief-1776692124831-utjn61z8", "task_graph_id": "task-graph-initiative-1776692124795-521vlp22-brief-1776692124831-utjn61z8", "batch_ids": ["batch-1776692125402-awnztxjo", "batch-1776692125322-49o2o558", "batch-1776692125226-upna18ji", "batch-1776692125060-qpf6ossr", "batch-1776692124946-60005tee", "batch-1776692124864-kl4swxc3"], "delivery_id": "delivery-1776692125693-bsqyf964", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "root_frontdoor": {"requested_entry_path": "/", "resolved_url": "http://127.0.0.1:3737/", "stays_on_root_entry": true, "composer_visible": true, "shell_anchor_visible": true, "secondary_actions_visible": true}, "manual_stage_labels": {"workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1776692125693-34g8zeg9", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776692124795-521vlp22/delivery-1776692125693-bsqyf964/HANDOFF.md", "result_url": "http://127.0.0.1:3101/project-result/initiative-1776692124795-521vlp22?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3737&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0yMFQxMzozNTozNy41MTdaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0yMFQxMzo0MDozNy41MTdaIn0.HU3BmnyikUlT1QK0ozP5CedQWNwaKovHDkYjkx0QLVk"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776692138620-qw4ykro9", "task_graph_id": "task-graph-initiative-1776692138620-qw4ykro9-brief-1776692138642-52mnzqst", "delivery_id": "delivery-1776692142856-bqlf15fa", "recovered_batches": ["batch-1776692141856-xaa5gq7z", "batch-1776692141970-4q5hcxqf", "batch-1776692142156-pyi0i012", "batch-1776692142365-jaya9h10", "batch-1776692142479-mq89thff"], "recovery_override_used": true}

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
- root frontdoor stays on /: `True`
- autonomous one prompt: `True`
- preview ready: `True`
- handoff ready: `True`
- failure recovery override used: `True`
