These archived execution workspace surfaces are intentionally isolated from the
live shell UI.

They came from an earlier pre-polish execution shell iteration and still depend
on missing snapshot, preference, and review modules that are not part of the
current route-level product path.

Current execution routes use the live surfaces in:
- `components/execution/autonomous-record-board.tsx`
- `components/execution/execution-run-composer.tsx`
- `components/execution/execution-home-surface.tsx`
- `components/execution/workspace-handoff-surface.tsx`
- `components/execution/operator-audit-surfaces.tsx`

Do not re-import files from this directory into live routes without first
porting them back under full typecheck coverage.
