# Functional Report

Run ID: `2026-04-18T23-03-18Z`
Generated: `2026-04-18T23:05:23.615394+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 9.53s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-03-18Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 3.22s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-03-18Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 2.83s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-03-18Z/logs/shell_test.log
- `work_ui_check` — `passed`
  - Command passed in 17.31s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-03-18Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 2.52s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-03-18Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 31.34s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-03-18Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776553477345-jitt2kto", "brief_id": "brief-1776553477365-pewjuohn", "task_graph_id": "task-graph-initiative-1776553477345-jitt2kto-brief-1776553477365-pewjuohn", "batch_ids": ["batch-1776553477604-an74h5hh", "batch-1776553477562-s5lcytci", "batch-1776553477486-6lhdaetw", "batch-1776553477424-4g32x2x1", "batch-1776553477384-0jxwu6wf"], "delivery_id": "delivery-1776553477739-fgsod5s0", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "shell_first_cta_visible": true, "manual_stage_labels": {"workui_home_embedded": [], "workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1776553477739-kvtqqnnu", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776553477345-jitt2kto/delivery-1776553477739-fgsod5s0/HANDOFF.md", "result_url": "http://127.0.0.1:3101/project-result/initiative-1776553477345-jitt2kto?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3737&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0xOFQyMzowNDo0NC4zNTdaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0xOFQyMzowOTo0NC4zNTdaIn0.qLpG2UHoCR7nK3AKhbK1gSX3PZtXe_JbQbqFO9d6S34"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776553485161-xmw0nrlb", "task_graph_id": "task-graph-initiative-1776553485161-xmw0nrlb-brief-1776553485170-uvg2g32p", "delivery_id": "delivery-1776553487986-di22mixj", "recovered_batches": ["batch-1776553487561-uhsn1rlb", "batch-1776553487611-pz64b5im", "batch-1776553487701-yqmhjxem", "batch-1776553487819-444l4d9w"], "recovery_override_used": true}

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
