# Functional Report

Run ID: `2026-04-18T20-08-15Z`
Generated: `2026-04-18T20:10:08.788770+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 5.98s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T20-08-15Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 5.32s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T20-08-15Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 3.19s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T20-08-15Z/logs/shell_test.log
- `work_ui_check` — `passed`
  - Command passed in 14.61s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T20-08-15Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 2.48s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T20-08-15Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 28.06s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T20-08-15Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776542965446-axsi1x3s", "brief_id": "brief-1776542965463-3jkxwydh", "task_graph_id": "task-graph-initiative-1776542965446-axsi1x3s-brief-1776542965463-3jkxwydh", "batch_ids": ["batch-1776542965626-l5l9ynrj", "batch-1776542965595-an707dhf", "batch-1776542965543-wtzi8oay", "batch-1776542965504-abhxrvjz", "batch-1776542965475-qul0dx0p"], "delivery_id": "delivery-1776542965724-tkantjhf", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "shell_first_cta_visible": true, "manual_stage_labels": {"workui_home_embedded": [], "workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3738/api/control/orchestration/previews/preview-1776542965724-zmutvw3o", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776542965446-axsi1x3s/delivery-1776542965724-tkantjhf/HANDOFF.md", "result_url": "http://127.0.0.1:3102/project-result/initiative-1776542965446-axsi1x3s?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3738&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0xOFQyMDowOTozMS4xNzhaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0xOFQyMDoxNDozMS4xNzhaIn0.F2juV8nQkEWQDIAZMX-S2ue9R7c1SjYz_yhZua_r5E4"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776542971933-idtw32am", "task_graph_id": "task-graph-initiative-1776542971933-idtw32am-brief-1776542971940-yku1dwts", "delivery_id": "delivery-1776542974418-cae5qmih", "recovered_batches": ["batch-1776542974121-hqw97mzq", "batch-1776542974161-oib3t3t7", "batch-1776542974223-opxzcm7d", "batch-1776542974309-db695ned"], "recovery_override_used": true}

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
