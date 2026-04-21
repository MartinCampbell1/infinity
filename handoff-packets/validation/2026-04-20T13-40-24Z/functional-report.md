# Functional Report

Run ID: `2026-04-20T13-40-24Z`
Generated: `2026-04-20T13:42:14.576854+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 6.34s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-40-24Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 2.35s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-40-24Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 2.04s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-40-24Z/logs/shell_test.log
- `shell_build` — `passed`
  - Command passed in 5.87s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-40-24Z/logs/shell_build.log
- `work_ui_check` — `passed`
  - Command passed in 10.23s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-40-24Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 1.28s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-40-24Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 30.10s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-40-24Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776692491922-fo25pu6s", "brief_id": "brief-1776692491940-qo8z3dy3", "task_graph_id": "task-graph-initiative-1776692491922-fo25pu6s-brief-1776692491940-qo8z3dy3", "batch_ids": ["batch-1776692492148-aha56iyp", "batch-1776692492115-r23mo3g9", "batch-1776692492078-sdm9d95j", "batch-1776692492021-kuxej4t1", "batch-1776692491980-xfwaedqo", "batch-1776692491951-fpz88267"], "delivery_id": "delivery-1776692492240-pmqfpa0s", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "root_frontdoor": {"requested_entry_path": "/", "resolved_url": "http://127.0.0.1:3737/", "stays_on_root_entry": true, "composer_visible": true, "shell_anchor_visible": true, "secondary_actions_visible": true}, "manual_stage_labels": {"workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1776692492240-wue8goqk", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776692491922-fo25pu6s/delivery-1776692492240-pmqfpa0s/HANDOFF.md", "result_url": "http://127.0.0.1:3101/project-result/initiative-1776692491922-fo25pu6s?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3737&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0yMFQxMzo0MTozOC40NDRaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0yMFQxMzo0NjozOC40NDRaIn0.p6EChr1ofsCDllUffa4YwIyXyEyEc6UfKSAVqYFY40c"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776692499175-t0cdcixx", "task_graph_id": "task-graph-initiative-1776692499175-t0cdcixx-brief-1776692499183-0dxl8kvc", "delivery_id": "delivery-1776692501775-butb21j7", "recovered_batches": ["batch-1776692501433-qservxb1", "batch-1776692501474-fmsos0t7", "batch-1776692501538-6qavc2ds", "batch-1776692501624-uch7gskp", "batch-1776692501669-z4azyui8"], "recovery_override_used": true}

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
