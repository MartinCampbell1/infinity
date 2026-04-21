# Backend Exposure Matrix

Date: 2026-04-18
Workspace: `/Users/martin/infinity`

## Purpose

This matrix records which backend capabilities are exposed in `work-ui`, which are exposed in the shell operator plane, and which remain internal-only.

## Route Families

| Route family | Owner surface | Exposure status | Primary UI entry |
| --- | --- | --- | --- |
| `/api/control/orchestration/initiatives` | work-ui | user-facing | `Project Factory` home, `project-intake` |
| `/api/control/orchestration/briefs` | work-ui | user-facing | `project-intake`, `project-brief` |
| `/api/control/orchestration/task-graphs` | shell + work-ui handoff | mixed | shell `task graph` page, work-ui brief/run/result shell links |
| `/api/control/orchestration/work-units` | shell | operator-facing | shell task graph + batch supervision context |
| `/api/control/orchestration/batches` | shell + work-ui handoff | mixed | shell task graph launch, shell batch page, work-ui run/result shell links |
| `/api/control/orchestration/supervisor/actions` | shell | operator-facing | shell batch supervision page |
| `/api/control/orchestration/assembly` | work-ui | user-facing | `project-run` |
| `/api/control/orchestration/verification` | work-ui | user-facing | `project-result` |
| `/api/control/orchestration/delivery` | work-ui | user-facing | `project-result` |
| `/api/control/orchestration/continuity` | shell + work-ui handoff | mixed | shell continuity page, work-ui home/run/result links |
| `/api/control/accounts` | shell | operator-facing | shell `accounts` page, work-ui operator links |
| `/api/control/accounts/quotas` | shell | operator-facing | shell `accounts` page |
| `/api/control/execution/approvals` | shell | operator-facing | shell `approvals` page, work-ui operator links |
| `/api/control/execution/approvals/[approvalId]/respond` | shell | operator-facing | shell `approvals` page action buttons |
| `/api/control/execution/recoveries` | shell | operator-facing | shell `recoveries` page, work-ui operator links |
| `/api/control/execution/recoveries/[recoveryId]` | shell | operator-facing | shell `recoveries` page action buttons |
| `/api/control/execution/audits` | shell | operator-facing | shell `audits` page, work-ui operator links |
| `/api/shell/execution/events` | shell | operator-facing | shell events/session surfaces |

## Internal-Only Workspace Launch / Runtime Routes

These routes are not product-facing UI destinations. They remain internal infrastructure:

| Route family | Status | Reason |
| --- | --- | --- |
| `/api/control/execution/workspace/[sessionId]/launch-token` | internal-only | launch integrity |
| `/api/control/execution/workspace/[sessionId]/bootstrap` | internal-only | embedded bootstrap |
| `/api/control/execution/workspace/[sessionId]/session` | internal-only | shell-issued workspace session |
| `/api/control/execution/workspace/[sessionId]/session-bearer` | internal-only | shell-issued bearer exchange |
| `/api/control/execution/workspace/[sessionId]/runtime` | internal-only | runtime ingest / host bridge |
| `/api/control/execution/workspace/rollout-status` | internal-only | rollout diagnostics |

## Product Rules

- Every non-internal backend capability must have:
  - at least one visible UI entrypoint
  - at least one visible outcome surface
- `work-ui` owns user workflow:
  - intake
  - brief
  - run
  - result
- shell owns operator workflow:
  - accounts
  - approvals
  - recoveries
  - audits
  - task-graph execution
  - batch supervision
