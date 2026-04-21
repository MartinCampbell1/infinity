# Functional Report

Run ID: `2026-04-20T14-04-14Z`
Generated: `2026-04-20T14:07:12.231397+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 8.76s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-04-14Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 3.44s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-04-14Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 2.30s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-04-14Z/logs/shell_test.log
- `shell_build` — `passed`
  - Command passed in 8.21s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-04-14Z/logs/shell_build.log
- `work_ui_check` — `passed`
  - Command passed in 19.03s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-04-14Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 2.68s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-04-14Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 70.30s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T14-04-14Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776693988459-q9rsg61g", "brief_id": "brief-1776693988484-4btk3q6g", "task_graph_id": "task-graph-initiative-1776693988459-q9rsg61g-brief-1776693988484-4btk3q6g", "batch_ids": ["batch-1776693988842-l6g756rt", "batch-1776693988792-e2u8rit5", "batch-1776693988743-w8mb3fa7", "batch-1776693988659-e86rvb3y", "batch-1776693988595-tryhprcd", "batch-1776693988502-ymjo7lew"], "delivery_id": "delivery-1776693989031-oj71qx0w", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "root_frontdoor": {"requested_entry_path": "/", "resolved_url": "http://127.0.0.1:3737/", "stays_on_root_entry": true, "composer_visible": true, "shell_anchor_visible": true, "secondary_actions_visible": true}, "manual_stage_labels": {"workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1776693989031-qxka8ucd", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776693988459-q9rsg61g/delivery-1776693989031-oj71qx0w/HANDOFF.md", "result_url": "http://127.0.0.1:3101/project-result/initiative-1776693988459-q9rsg61g?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3737&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0yMFQxNDowNjozOC4yMTNaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0yMFQxNDoxMTozOC4yMTNaIn0.sJ5NFLqHC0mxuDIpGD7iFGN5tGc0UJ3-a69BiksWctQ"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776693999071-g0oxfkt8", "task_graph_id": "task-graph-initiative-1776693999071-g0oxfkt8-brief-1776693999082-fv88v81i", "delivery_id": "delivery-1776694002369-48456p5v", "recovered_batches": ["batch-1776694001751-ax3ati06", "batch-1776694001839-8ixcnybc", "batch-1776694001943-kntyknxs", "batch-1776694002086-gz0cpeer", "batch-1776694002169-j3jc7tky"], "recovery_override_used": true}

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
