# Functional Report

Run ID: `2026-04-18T22-57-07Z`
Generated: `2026-04-18T22:59:12.644418+00:00`
Status: `passed`

## Checks
- `shell_lint` — `passed`
  - Command passed in 11.66s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T22-57-07Z/logs/shell_lint.log
- `shell_typecheck` — `passed`
  - Command passed in 3.54s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T22-57-07Z/logs/shell_typecheck.log
- `shell_test` — `passed`
  - Command passed in 2.55s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T22-57-07Z/logs/shell_test.log
- `work_ui_check` — `passed`
  - Command passed in 18.16s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T22-57-07Z/logs/work_ui_check.log
- `work_ui_test` — `passed`
  - Command passed in 2.47s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T22-57-07Z/logs/work_ui_test.log
- `work_ui_build` — `passed`
  - Command passed in 29.58s. Log: /Users/martin/infinity/handoff-packets/validation/2026-04-18T22-57-07Z/logs/work_ui_build.log

## Scenarios
- `happy_path` — `passed`
  - {"initiative_id": "initiative-1776553109345-10ebwx8f", "brief_id": "brief-1776553109362-i23rnkuh", "task_graph_id": "task-graph-initiative-1776553109345-10ebwx8f-brief-1776553109362-i23rnkuh", "batch_ids": ["batch-1776553109623-p68gsaf3", "batch-1776553109574-p8rx9ifq", "batch-1776553109492-4ix0bz3e", "batch-1776553109430-imuhq4hg", "batch-1776553109383-6v8akpn0"], "delivery_id": "delivery-1776553109765-kj1mx345", "delivery_status": "ready", "preview_ready": true, "handoff_ready": true, "autonomous_one_prompt": true, "shell_first_cta_visible": true, "manual_stage_labels": {"workui_home_embedded": [], "workui_project_brief": [], "workui_project_run": [], "workui_project_result_passed": []}, "preview_url": "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1776553109765-e4xvruw0", "handoff_path": "/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-1776553109345-10ebwx8f/delivery-1776553109765-kj1mx345/HANDOFF.md", "result_url": "http://127.0.0.1:3101/project-result/initiative-1776553109345-10ebwx8f?founderos_launch=1&project_id=project-borealis&session_id=session-2026-04-11-002&group_id=group-core-02&account_id=account-chatgpt-02&workspace_id=workspace-borealis-review&opened_from=execution_board&host_origin=http%3A%2F%2F127.0.0.1%3A3737&embedded=1&launch_token=eyJ2IjoxLCJwcm9qZWN0SWQiOiJwcm9qZWN0LWJvcmVhbGlzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi0yMDI2LTA0LTExLTAwMiIsImdyb3VwSWQiOiJncm91cC1jb3JlLTAyIiwiYWNjb3VudElkIjoiYWNjb3VudC1jaGF0Z3B0LTAyIiwid29ya3NwYWNlSWQiOiJ3b3Jrc3BhY2UtYm9yZWFsaXMtcmV2aWV3Iiwib3BlbmVkRnJvbSI6ImV4ZWN1dGlvbl9ib2FyZCIsImlzc3VlZEF0IjoiMjAyNi0wNC0xOFQyMjo1ODozNi4xNzJaIiwiZXhwaXJlc0F0IjoiMjAyNi0wNC0xOFQyMzowMzozNi4xNzJaIn0.EEtCn2W4vCnBjikNXY4fsZpPqS7nzBh3d2AY1Wumzi8"}
- `failure_recovery_path` — `passed`
  - {"initiative_id": "initiative-1776553116970-u53uqsba", "task_graph_id": "task-graph-initiative-1776553116970-u53uqsba-brief-1776553116981-w8qkyyrd", "delivery_id": "delivery-1776553119933-9yttqlde", "recovered_batches": ["batch-1776553119416-qxwh9yvk", "batch-1776553119478-kj7sz5jq", "batch-1776553119575-i241rzj3", "batch-1776553119728-y8h4fkm3"], "recovery_override_used": true}

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
