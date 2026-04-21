# Functional Report

Run ID: `2026-04-20T13-23-14Z`
Generated: `2026-04-20T13:27:07.812872+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 14.07s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-23-14Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 6.99s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-23-14Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 6.64s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-23-14Z/logs/shell_test.log
- `shell_build` — `passed`
  - Command passed in 16.47s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-23-14Z/logs/shell_build.log
- `work_ui_check` — `passed`
  - Command passed in 28.11s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-23-14Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 3.99s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-23-14Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 88.97s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-20T13-23-14Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776691582717-pfjc142u", "brief_id": "brief-1776691582744-r6mbzpqq", "task_graph_id": "task-graph-initiative-1776691582717-pfjc142u-brief-1776691582744-r6mbzpqq", "batch_ids": ["batch-1776691583128-ei8gkgtb", "batch-1776691583063-h8zsab1e", "batch-1776691582951-kecvtzyi", "batch-1776691582848-pd3ichse", "batch-1776691582777-esakl1h0"], "delivery_id": "delivery-1776691583353-qm8yva8c", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "root_frontdoor": {"requested_entry_path": "/", "resolved_url": "http://127.0.0.1:3737/", "stays_on_root_entry": true, "composer_visible": true, "shell_anchor_visible": true, "secondary_actions_visible": true}, "manual_stage_labels": {"workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1776691583353-fmigddui", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776691582717-pfjc142u/delivery-1776691583353-qm8yva8c/HANDOFF.md", "result_url": "http://127.0.0.1:3101/project-result/initiative-1776691582717-pfjc142u?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3737&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0yMFQxMzoyNjozNC40MjVaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0yMFQxMzozMTozNC40MjVaIn0.X3rSsRflwZjjwSN5HY92A-p3vGvlI3-BA2tZAp9U-L8"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776691595322-0v37fc4m", "task_graph_id": "task-graph-initiative-1776691595322-0v37fc4m-brief-1776691595335-m9ts1nzi", "delivery_id": "delivery-1776691598365-51pvowr9", "recovered_batches": ["batch-1776691597957-3gs7uhwa", "batch-1776691598010-95iz9yt3", "batch-1776691598093-wj2fshjj", "batch-1776691598219-r5zfemxy"], "recovery_override_used": true}

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
