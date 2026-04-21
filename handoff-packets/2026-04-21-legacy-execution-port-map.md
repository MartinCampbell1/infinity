# Legacy Execution Port Map

Date: 2026-04-21
Workspace: `/Users/martin/infinity`
Scope: `apps/shell/apps/web/components/execution/legacy`

## Why this exists

The release gate is already green.

The remaining `legacy` subtree was intentionally isolated while the cleanup
happened in bounded ports rather than one large
reanimation pass.

This file records the current blocker shape so the next agent can pick one
cluster and move surgically.

## Current Legacy State

- no legacy execution `.tsx` files remain
- `apps/shell/apps/web/components/execution/legacy/README.md` remains as an archive note only
- validator policy: any new TS/TSX under `components/execution/legacy` is now a hard failure

## Ported Back Under Typecheck

- `components/execution/execution-attention-cards.tsx`
- `components/execution/execution-events-workspace.tsx`
- `components/execution/execution-handoffs-workspace.tsx`
- supporting local execution-only helpers:
  - `lib/attention-records.ts`
  - `lib/execution-source.ts`
  - `lib/shell-entry-hrefs.ts`
  - `lib/shell-preferences.ts`
  - `lib/use-shell-manual-refresh.ts`
  - `lib/use-shell-polled-snapshot.ts`
  - `lib/shell-snapshot-client.ts`
  - `lib/execution-live-events.ts`
  - `lib/execution-brief-handoffs.ts`
  - `lib/execution-brief-handoffs.test.ts`
  - `lib/execution-handoffs-model.ts`
  - `lib/execution-handoffs.ts`
  - `app/api/shell/execution/handoffs/route.ts`

This started with the first legacy file intentionally pulled back out of the archive,
continued through the event-stream workspace and the handoff queue, and ended with
deletion of the remaining dead duplicate legacy screens.

## Closure

The initial recommendation held:

- restore only the legacy execution screens that still mattered to live product shape
- delete the dead duplicate screens once the live shell already had a better replacement

The archive folder can remain as a historical note, but it no longer contains executable
legacy UI that needs to be ported back under typecheck.
