# Functional Report

Run ID: `2026-04-20T14-30-16Z`
Generated: `2026-04-20T14:32:32.176520+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 6.64s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-30-16Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 3.08s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-30-16Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 2.11s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-30-16Z/logs/shell_test.log
- `shell_build` — `passed`
  - Command passed in 6.24s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-30-16Z/logs/shell_build.log
- `work_ui_check` — `passed`
  - Command passed in 11.47s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-30-16Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 1.75s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-30-16Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 47.84s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-30-16Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776695507322-7c58q2vp", "brief_id": "brief-1776695507345-lv76tsmr", "task_graph_id": "task-graph-initiative-1776695507322-7c58q2vp-brief-1776695507345-lv76tsmr", "batch_ids": ["batch-1776695507584-c3h1e32f", "batch-1776695507544-hpl2r74w", "batch-1776695507508-omn0lqi1", "batch-1776695507441-0kly13d9", "batch-1776695507393-9ayyetsc", "batch-1776695507358-25rz6ao8"], "delivery_id": "delivery-1776695507701-vrvagwel", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "root_frontdoor": {"requested_entry_path": "/", "resolved_url": "http://127.0.0.1:3737/", "stays_on_root_entry": true, "composer_visible": true, "shell_anchor_visible": true, "secondary_actions_visible": true}, "manual_stage_labels": {"workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1776695507701-b110yohu", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776695507322-7c58q2vp/delivery-1776695507701-vrvagwel/HANDOFF.md", "result_url": "http://127.0.0.1:3101/project-result/initiative-1776695507322-7c58q2vp?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3737&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0yMFQxNDozMTo1NS4zODlaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0yMFQxNDozNjo1NS4zODlaIn0.KrF7ZVzC2nGGcf4gcqsm-kJqGe3HPY5SIWe1nPTxHe0"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776695516200-g1pnw9sj", "task_graph_id": "task-graph-initiative-1776695516200-g1pnw9sj-brief-1776695516213-o44j4pcv", "delivery_id": "delivery-1776695519487-q4ynnjm7", "recovered_batches": ["batch-1776695519081-d9q44ne8", "batch-1776695519134-cjgetu8l", "batch-1776695519216-qagwnv91", "batch-1776695519322-omlbevkf", "batch-1776695519371-8k4duzjy"], "recovery_override_used": true}

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
