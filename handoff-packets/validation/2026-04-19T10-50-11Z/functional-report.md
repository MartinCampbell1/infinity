# Functional Report

Run ID: `2026-04-19T10-50-11Z`
Generated: `2026-04-19T10:52:36.033782+00:00`
Status: `failed`

## Checks
- `shell_lint` — `failed`
  - Command failed in 20.86s. See /Users/martin/infinity/handoff-packets/validation/2026-04-19T10-50-11Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 4.51s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-19T10-50-11Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 3.10s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-19T10-50-11Z/logs/shell_test.log
- `work_ui_check` — `passed`
  - Command passed in 20.31s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-19T10-50-11Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 2.74s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-19T10-50-11Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 34.46s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-19T10-50-11Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776595911721-pus5y0hh", "brief_id": "brief-1776595911736-qdt6aue9", "task_graph_id": "task-graph-initiative-1776595911721-pus5y0hh-brief-1776595911736-qdt6aue9", "batch_ids": ["batch-1776595912025-sin4qx5g", "batch-1776595911968-dqt89sn8", "batch-1776595911869-5zq8fqlq", "batch-1776595911808-rpn1i5bj", "batch-1776595911758-io25e9x9"], "delivery_id": "delivery-1776595912180-pm0pbyla", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "root_frontdoor": {"requested_entry_path": "/", "resolved_url": "http://127.0.0.1:3738/execution", "redirected_to_execution": true, "composer_visible": true, "operator_routes_visible": true, "attention_stats_visible": true}, "manual_stage_labels": {"workui_home_embedded": [], "workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3738/api/control/orchestration/previews/preview-1776595912180-cq0497bf", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776595911721-pus5y0hh/delivery-1776595912180-pm0pbyla/HANDOFF.md", "result_url": "http://127.0.0.1:3102/project-result/initiative-1776595911721-pus5y0hh?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3738&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0xOVQxMDo1MTo1OS42MzJaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0xOVQxMDo1Njo1OS42MzJaIn0.1aU6t43yKCkNXqjeNDYaeTvNq1hB201YRqzfgiF_MUw"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776595920466-mhucxozf", "task_graph_id": "task-graph-initiative-1776595920466-mhucxozf-brief-1776595920482-4jk07g6z", "delivery_id": "delivery-1776595923682-pjv9r06i", "recovered_batches": ["batch-1776595923148-hynfs36c", "batch-1776595923225-su7roqvn", "batch-1776595923346-cva4kqrb", "batch-1776595923499-3flrqgel"], "recovery_override_used": true}

## Artifacts
- `route-matrix.json`
- `api-exposure-checklist.json`
- `screenshot-manifest.json`
- `autonomous-proof.json`
- `critic-brief.md`

## Autonomous Evidence
- root frontdoor composer visible: `True`
- root frontdoor operator routes visible: `True`
- root frontdoor attention stats visible: `True`
- root frontdoor redirected to /execution: `True`
- autonomous one prompt: `True`
- preview ready: `True`
- handoff ready: `True`
- failure recovery override used: `True`
