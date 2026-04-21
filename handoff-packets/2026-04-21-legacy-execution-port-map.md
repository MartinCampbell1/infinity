# Legacy Execution Port Map

Date: 2026-04-21
Workspace: `/Users/martin/infinity`
Scope: `apps/shell/apps/web/components/execution/legacy`

## Why this exists

The release gate is already green.

The remaining `legacy` subtree is intentionally isolated and excluded from shell
typecheck, but future cleanup should happen as bounded ports, not as one large
reanimation pass.

This file records the current blocker shape so the next agent can pick one
cluster and move surgically.

## Current Legacy Files

- `execution-agent-workspace.tsx`
- `execution-agents-workspace.tsx`
- `execution-attention-cards.tsx`
- `execution-audit-workspace.tsx`
- `execution-audits-workspace.tsx`
- `execution-events-workspace.tsx`
- `execution-handoff-workspace.tsx`
- `execution-handoffs-workspace.tsx`
- `execution-intake-workspace.tsx`
- `execution-review-workspace.tsx`
- `execution-workspace.tsx`

## Missing Dependency Clusters

### Cluster A — shared polling/snapshot infra

This is the broadest blocker and appears in most legacy files:

- `@/lib/shell-preferences`
- `@/lib/shell-snapshot-client`
- `@/lib/use-shell-polled-snapshot`
- `@/lib/use-shell-manual-refresh`
- `@/lib/use-shell-route-mutation-runner`
- `@/lib/use-shell-snapshot-refresh-nonce`
- `@/lib/use-shell-mutation-runner`

Files blocked by this cluster:

- `execution-agent-workspace.tsx`
- `execution-agents-workspace.tsx`
- `execution-audit-workspace.tsx`
- `execution-audits-workspace.tsx`
- `execution-events-workspace.tsx`
- `execution-handoff-workspace.tsx`
- `execution-handoffs-workspace.tsx`
- `execution-intake-workspace.tsx`
- `execution-review-workspace.tsx`
- `execution-workspace.tsx`

### Cluster B — execution data models and mutations

- `@/lib/execution`
- `@/lib/execution-agent-model`
- `@/lib/execution-agents`
- `@/lib/execution-audits-model`
- `@/lib/execution-handoffs-model`
- `@/lib/execution-live-events`
- `@/lib/execution-mutations`
- `@/lib/execution-review`
- `@/lib/execution-review-model`
- `@/lib/execution-source`
- `@/lib/execution-ui-state`

### Cluster C — review/attention helpers

- `@/lib/attention-action-model`
- `@/lib/attention-records`
- `@/lib/review-batch-actions`
- `@/lib/review-execution-actions`
- `@/lib/review-memory`
- `@/lib/use-scoped-query`
- `@/lib/use-scoped-selection`

### Cluster D — smaller UI/support gaps

- `@/components/shell/shell-route-scope-banner`
- `@/components/shell/shell-skeleton`
- `@/lib/format-utils`
- `@/lib/shell-entry-hrefs`

## Suggested Port Order

1. Do **not** start with `execution-workspace.tsx` or `execution-review-workspace.tsx`.
   They have the widest dependency fan-out.
2. Start with the smallest leaf:
   - `execution-attention-cards.tsx`
   It only needs attention/source/link helpers and is the cheapest probe for whether the archived UI is still worth reviving.
3. Then try one directory-style surface:
   - `execution-events-workspace.tsx`
   - or `execution-handoffs-workspace.tsx`
4. Only after shared polling/snapshot infra is restored should anyone attempt:
   - `execution-intake-workspace.tsx`
   - `execution-handoff-workspace.tsx`
   - `execution-workspace.tsx`
   - `execution-review-workspace.tsx`

## Strong Recommendation

Before porting any legacy file back into the live shell tree, first decide whether
that surface is still product-relevant.

The current live routes already use:

- `ExecutionHomeSurface`
- `PrimaryRunSurface`
- `ExecutionRunComposer`
- `AutonomousRecordBoard`
- `ExecutionWorkspaceHandoffSurface`
- `operator-audit-surfaces`

If a legacy surface duplicates one of those live routes, deletion may be a
better move than restoration.
