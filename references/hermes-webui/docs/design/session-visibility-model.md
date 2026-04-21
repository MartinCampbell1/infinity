# Session visibility model

Status: current behavior as of 2026-04-07

This note documents how Hermes WebUI currently discovers sessions, merges WebUI and CLI history, and decides what is visible in the sidebar. It is intended to anchor follow-up implementation work, not to propose a final product model.

## Scope

Relevant code reviewed:
- `api/routes.py`
- `api/models.py`
- `api/profiles.py`
- `api/workspace.py`
- `static/sessions.js`
- `static/panels.js`
- `tests/test_cli_session_bridge.py`

## 1) WebUI-native session source

WebUI-native sessions are stored as JSON files in the WebUI session directory (`SESSION_DIR`) and cached in memory via `SESSIONS`.

Current behavior:
- `new_session()` creates a `Session` with:
  - `workspace = body workspace or get_last_workspace()`
  - `model = current default model`
  - `profile = active profile name` (`api/models.py`)
- `Session.save()` writes `{session_id}.json` and rebuilds `SESSION_INDEX_FILE`.
- `all_sessions()` reads `SESSION_INDEX_FILE` first, then overlays any newer in-memory sessions.
- Empty untitled sessions are hidden from the session list.
- Older sessions with no `profile` field are backfilled to `profile='default'` for filtering.

Important consequence:
- WebUI-native session visibility is primarily profile-tag based, not workspace based.

## 2) CLI / Hermes session source

CLI sessions are read from the active Hermes profile home, not from WebUI session storage.

Current sources (`api/models.py`):
1. `state.db`
   - Reads `sessions` + `messages` tables.
   - Session list metadata comes from SQL rows.
   - Per-message transcript comes from `messages` ordered by timestamp.
2. JSON transcripts in `{active_hermes_home}/sessions/session_<sid>.json`
   - Used for sidebar metadata and full message loading.
   - Title falls back to the first user message when the file has no explicit title.

Profile coupling:
- `get_cli_sessions()` and `get_cli_session_messages()` use `_get_active_cli_home()`.
- `_get_active_cli_home()` resolves through `api.profiles.get_active_hermes_home()` when available.
- Therefore CLI session discovery is profile-scoped.

Current metadata behavior:
- CLI sessions are returned as sidebar-ready dicts with `is_cli_session=True`.
- CLI session `workspace` is currently set from `get_last_workspace()`, not from transcript-specific metadata.
- JSON transcripts also contribute clone-detection metadata such as:
  - `_cli_first_user`
  - `_cli_non_service_users`
  - `_cli_generated_tail`
  - `is_auxiliary_cli_session`

## 3) How sessions are merged today

### Server-side merge

`GET /api/sessions` does this today (`api/routes.py`):

1. Load WebUI sessions from `all_sessions()`.
2. If `settings.show_cli_sessions` is true (default true), load CLI sessions from `get_cli_sessions()`.
3. For any matching `session_id` already present in the WebUI set:
   - mark the entry as `is_cli_session=True`
   - take the max `updated_at`
   - take the max `message_count`
   - fill missing title/model from CLI metadata
   - copy clone-detection metadata from CLI metadata
4. Add CLI-only sessions that do not already exist in WebUI storage.
5. Run `collapse_cli_session_clones()` over the merged list.
6. Sort by `updated_at` descending.
7. Return:
   - `sessions`
   - `cli_count`
   - `hidden_cli_clones`

### Clone collapsing

`collapse_cli_session_clones()` only applies to CLI sessions with detected non-service user message sequences.

Current rule:
- Group sessions by first non-service user message.
- Only collapse groups that contain generated/service markers.
- Choose one canonical session.
- Hide the others from the sidebar.
- Return an alias map so hidden old IDs can resolve to the canonical one.

Observed behavior confirmed by `tests/test_cli_session_bridge.py`:
- service-tail clones collapse to one visible sidebar entry
- compression-family threads can collapse to one canonical visible thread, but the canonical choice is heuristic and is not simply “latest continuation”
- old hidden session IDs can still load/import and resolve to the canonical visible session
- single-prompt worker/task sessions are marked `is_auxiliary_cli_session`

### Session loading behavior

`GET /api/session?session_id=...`:
- If CLI visibility is enabled, the requested id is first canonicalized via `resolve_cli_canonical_session_id()`.
- The server then tries the WebUI session store first.
- If no WebUI session exists, it falls back to CLI transcript loading.
- If the requested id resolved to a different canonical id, the response includes `resolved_from_session_id`.

### Import behavior

Clicking a CLI session in the sidebar attempts to import it into the WebUI store first (`static/sessions.js` + `POST /api/session/import_cli`), then falls back to read-only loading if import fails.

Current import semantics:
- import uses the same `session_id` as the CLI transcript
- if the session already exists in WebUI storage, it is refreshed in place from the current CLI transcript
- imported sessions are marked `is_cli_session=True` / `_cli_origin=<sid>`
- after import, the merged session list still treats that session as CLI-backed

This means “import” is currently closer to “materialize/refresh a WebUI copy with the same id” than “make an independent local fork.”

## 4) What workspace selection does and does not control

## What it does control

Workspace selection is used as the active working directory for WebUI chat and file operations.

Current behavior:
- `POST /api/session/update` updates a session's `workspace` and calls `set_last_workspace()`.
- `POST /api/chat/start` updates `s.workspace`, persists it, and calls `set_last_workspace()`.
- The workspace picker in the UI updates the current session workspace.
- New WebUI sessions default to `get_last_workspace()`.
- Profile switch returns `default_workspace = get_last_workspace()` for the newly active profile (`api/profiles.py`).
- `static/panels.js` uses that returned workspace to seed the first new session after a profile switch, or to retarget an empty session in place.
- File browser and file actions resolve against `session.workspace`.
- Messages sent to the agent are prefixed with `[Workspace: /absolute/path]`, and the system message says that tag is authoritative for file operations.

## What it does not control

Workspace selection does not currently partition or filter history.

Specifically:
- `/api/sessions` does not filter by workspace.
- `all_sessions()` does not group by workspace.
- CLI session discovery does not read transcript-specific workspace metadata; it assigns the current profile's `get_last_workspace()` value to every CLI session entry.
- The sidebar workspace picker does not decide which historical sessions are shown.
- Memory (`/api/memory`) is profile-scoped via Hermes home, not workspace-scoped.

Practical result:
- A user can switch workspace and still see the same profile's WebUI sessions plus visible CLI sessions.
- A CLI session may display the current profile workspace even if the original CLI work happened elsewhere.

## 5) Why a user expects continuity but does not see it

Likely causes in the current model:

1. Profile mismatch
- Profile switching changes `HERMES_HOME` and therefore changes the CLI session source, memories, skills, cron, config, and per-profile workspace state.
- WebUI-native conversations created under one profile will not automatically appear when another profile is active unless the UI is showing “other profiles”.
- CLI history is stricter: changing profile changes the server-side source itself, so inactive-profile CLI transcripts are not recovered just by client-side visibility toggles.

2. Workspace is not a history key
- Users often treat workspace as “the project I am in, so I should see the same memory/history.”
- In current code, workspace mostly affects where tools run, not which sessions exist or are visible.

3. CLI visibility can be disabled
- If `show_cli_sessions` is false, `/api/sessions` stops merging CLI sessions and `/api/session` stops canonicalizing against CLI families first.
- A user may know the CLI transcript exists on disk, but the WebUI list will not show it.

4. Hidden clone collapse
- Older CLI thread ids may disappear from the sidebar because they were intentionally collapsed into a canonical session.
- The history still exists, but the exact id the user expects may no longer be visible.

5. Auxiliary CLI sessions hidden by default in the UI
- `static/sessions.js` hides `is_auxiliary_cli_session` items unless the user toggles “Show N auxiliary”.
- A background worker/subtask thread can therefore exist but be invisible in the default sidebar view.

6. Archived sessions hidden by default in the UI
- Archived sessions remain in the merged dataset but are hidden unless the user toggles “Show N archived”.

7. Imported CLI sessions are not separate conversations
- Importing a CLI session does not create a new independent history line with a new id.
- It reuses the CLI id and refreshes from CLI source data.
- Users may expect a stable local continuation, but the current behavior keeps treating it as CLI-backed.

8. Session list filtering is profile-based in the client
- `static/sessions.js` shows only sessions for `S.activeProfile` by default, except CLI sessions which are allowed through that filter path.
- This is helpful for cleanliness but can make older sessions seem to disappear after profile changes.

## 6) Known ambiguity / risk areas for follow-up work

1. CLI workspace attribution is weak
- CLI sessions currently inherit `get_last_workspace()` during discovery and import.
- That is almost certainly only an approximation.
- If later work needs true project continuity, transcript-level workspace provenance is missing.

2. Imported CLI sessions share ids with CLI source sessions
- This simplifies dedupe/refresh, but it blurs the distinction between:
  - source transcript
  - imported local copy
  - active continuation thread
- Future visibility/archive rules may need separate metadata for “origin” vs “current local session.”

3. Profile filtering and CLI exceptions are asymmetric
- Client filtering uses `s.is_cli_session || s.profile === S.activeProfile`.
- That means CLI sessions bypass the normal profile filter path.
- This may be intentional for visibility, but it is a surprising rule and should be made explicit before changing UX.

4. Archive semantics are only first-class for WebUI sessions
- `archived` exists on WebUI `Session` objects.
- Raw CLI sessions have no independent archive metadata until imported/overlaid.
- If we need archive/legacy handling for non-imported CLI history, we need a persistence model.

5. Clone collapsing is heuristic
- The collapse logic depends on message-prefix heuristics and generated prompt markers.
- It is useful, but false positives/negatives are possible.
- Any product change that relies on “canonical session” should treat this as a heuristic layer, not ground truth.

6. Memory continuity is profile-scoped, not session-scoped
- `/api/memory` reads from `{active_hermes_home}/memories`.
- Users may think “same workspace/session title” implies same memory, but the implementation boundary is profile home.

7. Sidebar visibility is a mix of server and client rules
- Server removes duplicate/hidden CLI clones.
- Client additionally hides archived sessions, auxiliary sessions, and other-profile sessions by default.
- Future work should decide which visibility rules belong server-side versus client-side.

## Working definitions for future tasks

Use these terms consistently in follow-up tasks:

- Active session
  - belongs in the default primary sidebar experience
  - should keep the day-to-day list clean and useful
  - not archived
  - not hidden as an auxiliary CLI task session
  - not suppressed as a collapsed CLI clone
  - product intent: this is the list a user should trust for current work, not the complete historical record

- Archived session
  - a session intentionally removed from the primary active list without deleting its data
  - today this is first-class mainly for WebUI sessions via `archived=true`
  - still loadable and restorable
  - should remain accessible, but not dominate the main view

- Legacy/imported session
  - any session whose origin is an external CLI/Hermes transcript or an older imported continuity path
  - today this is identified only partially (`is_cli_session`, missing-profile backfill, `_cli_origin`)
  - should be accessible, searchable, and recoverable
  - should not dominate the default active list just because it exists

- Hidden noisy clone
  - a CLI transcript suppressed by `collapse_cli_session_clones()` because it appears to be a service/generated/compression family member rather than the canonical visible thread
  - should be treated as presentation noise control, not as disposable data

## UX rule for later implementation

The active list should stay clean and useful.

Legacy sessions should remain accessible but should not dominate the primary sidebar experience. A user should be able to reach them through explicit visibility modes, archive views, or search without forcing every legacy/imported thread into the same top-level stream as active work.

## Recommendation for implementation tasks

When changing visibility behavior, keep these invariants unless intentionally redesigned:
- start with archive/deprioritize, not delete/rewrite
- do not delete or rewrite source CLI transcripts just to clean the sidebar
- prefer explicit visibility metadata over more heuristic hiding
- separate “where tools run” (workspace) from “which history belongs together” (currently mostly profile + session id)
- treat clone collapsing as a presentation optimization, not the source of truth
