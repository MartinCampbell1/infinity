# Functional Report

Run ID: `2026-04-18T23-08-40Z`
Generated: `2026-04-18T23:10:41.390191+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 8.64s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-08-40Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 3.32s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-08-40Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 2.74s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-08-40Z/logs/shell_test.log
- `work_ui_check` — `passed`
  - Command passed in 16.75s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-08-40Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 2.32s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-08-40Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 31.97s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T23-08-40Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776553797701-c4r06vq9", "brief_id": "brief-1776553797716-76hr7fel", "task_graph_id": "task-graph-initiative-1776553797701-c4r06vq9-brief-1776553797716-76hr7fel", "batch_ids": ["batch-1776553797989-vcd1oiwg", "batch-1776553797947-g3d6c6g4", "batch-1776553797861-dk8dc4xb", "batch-1776553797800-2k9a3xem", "batch-1776553797732-021gx0ip"], "delivery_id": "delivery-1776553798128-adt1lh6m", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "shell_first_cta_visible": true, "manual_stage_labels": {"workui_home_embedded": [], "workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1776553798128-1ulsohb1", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776553797701-c4r06vq9/delivery-1776553798128-adt1lh6m/HANDOFF.md", "result_url": "http://127.0.0.1:3101/project-result/initiative-1776553797701-c4r06vq9?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3737&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0xOFQyMzoxMDowNC44NTRaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0xOFQyMzoxNTowNC44NTRaIn0.8vU5i4OUXzRKFg6wlpLaqhWVE72nHxQ4LVAtgDBON24"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776553805700-3k34v0mi", "task_graph_id": "task-graph-initiative-1776553805700-3k34v0mi-brief-1776553805714-67xzfqu0", "delivery_id": "delivery-1776553808677-4x3fjl40", "recovered_batches": ["batch-1776553808232-jp9uyk2d", "batch-1776553808294-f8soa7uw", "batch-1776553808383-u1db1wp5", "batch-1776553808521-3lkz3phy"], "recovery_override_used": true}

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
