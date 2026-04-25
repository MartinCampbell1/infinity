# Agent Task Template Library

Use these templates when dispatching bounded implementation agents in Infinity.
They are intentionally short and copy-ready; fill in the task-specific scope,
files, acceptance criteria, and verification commands before sending a worker.

## Templates

- [Backend agent](backend-agent.md) — APIs, storage, adapters, migrations, and server-side projections.
- [Frontend agent](frontend-agent.md) — shell/work-ui UI slices, route components, interaction states, and focused tests.
- [QA agent](qa-agent.md) — contract fixtures, release gates, validation packets, screenshot/checklist coverage, and critic evidence.

## Shared Rules

- Edit only inside `/Users/martin/infinity`.
- Treat `/Users/martin/FounderOS`, `/Users/martin/open-webui`, `/Users/martin/hermes-webui`, and external `cabinet` snapshots as read-only references.
- Do not run watchers, long-lived dev servers, browser automation, or full-repo checks unless the orchestrator explicitly asks.
- Preserve frozen contracts unless a separate contract-diff review has approved the change.
- Leave a handoff with files changed, checks run, known gaps, and critic-gate status.
