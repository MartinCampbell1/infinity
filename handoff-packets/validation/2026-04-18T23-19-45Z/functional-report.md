# Functional Report

Run ID: `2026-04-18T23-19-45Z`
Generated: `2026-04-18T23:21:46.264148+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 9.47s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-19-45Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 3.96s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-19-45Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 2.68s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-19-45Z/logs/shell_test.log
- `work_ui_check` — `passed`
  - Command passed in 16.42s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-19-45Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 2.98s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-19-45Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 30.48s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-19-45Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776554464672-t3krezhs", "brief_id": "brief-1776554464690-mczhu1hk", "task_graph_id": "task-graph-initiative-1776554464672-t3krezhs-brief-1776554464690-mczhu1hk", "batch_ids": ["batch-1776554464973-jkuymm00", "batch-1776554464926-rxv5qboz", "batch-1776554464848-3dso7xh2", "batch-1776554464773-xtt7zfks", "batch-1776554464712-nke6tr1q"], "delivery_id": "delivery-1776554465113-lnwk4awl", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "shell_first_cta_visible": true, "manual_stage_labels": {"workui_home_embedded": [], "workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1776554465113-c69pc846", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776554464672-t3krezhs/delivery-1776554465113-lnwk4awl/HANDOFF.md", "result_url": "http://127.0.0.1:3101/project-result/initiative-1776554464672-t3krezhs?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3737&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0xOFQyMzoyMToxMi4yNDJaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0xOFQyMzoyNjoxMi4yNDJaIn0.0wBflXrJZD82kphwmVkgMqrJPKMBgQeohvpsv9W8q08"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776554473065-xtiu0kul", "task_graph_id": "task-graph-initiative-1776554473065-xtiu0kul-brief-1776554473078-bi566229", "delivery_id": "delivery-1776554476112-7yx2k993", "recovered_batches": ["batch-1776554475618-uno78srw", "batch-1776554475686-km2lr03j", "batch-1776554475799-sxtolrl9", "batch-1776554475944-k5nzk1vs"], "recovery_override_used": true}

## Artifacts
- `route-matrix.json`
- `api-exposure-checklist.json`
- `screenshot-manifest.json`
- `autonomous-proof.json`
- `critic-brief.md`

## Autonomous Evidence
- shell first: `True`
- autonomous one prompt: `True`
- preview ready: `True`
- handoff ready: `True`
- failure recovery override used: `True`
