# parallel-batch-02.md

## Purpose

This file tracks the current bounded execution batch after shell recovery and the first runnable Infinity scaffold.

It exists to keep the next wave narrow:

- keep all edits inside `/Users/martin/infinity`;
- prevent overlap between `shell` control-plane work and `work-ui` type-closure work;
- keep the product moving along the spec instead of drifting into generic cleanup.

## Global rules

- `/Users/martin/FounderOS`, `/Users/martin/open-webui`, `/Users/martin/hermes-webui`, and any external `cabinet` snapshot remain read-only references.
- Product direction comes from `unified-control-plane-super-spec-v2-2026-04-10.md`.
- Ownership and merge discipline come from `agents.md`.
- Only `apps/shell`, `apps/work-ui`, `packages/*`, docs, and fixtures inside `infinity` are editable.
- All delegated work is low-memory by default: no watch mode, no background dev servers, no browser emulation unless explicitly required, and no full-repo check/build/test from workers unless the orchestrator asks for it.

## Current platform state

- `apps/shell` has completed the shell durability phase and is green on the exact memory-capped verification set:
  - targeted vitest for `workspace/runtime-ingest + route + workspace/mock`
  - `npm run typecheck`
  - `npx --yes tsx ./scripts/verify-event-fixtures.ts`
  - `npm run build`
  - `npm run test`
- `apps/shell` now uses a Postgres-priority control-plane state store with unified fallback file state, and async propagation covers approvals, recoveries, accounts, sessions, workspace, and events through one shell-owned durability seam:
  - `lib/server/control-plane/state/store.ts`
  - `lib/server/control-plane/state/seeds.ts`
  - legacy `approvals.state.json` and `recoveries.state.json` are migration inputs only, not active ownership boundaries
- Healthy file-backed metadata now reports a shell-owned derived source instead of a mock label, and session/event getters can be consumed through live-named aliases without breaking existing imports.
- `apps/shell` has completed the relational Postgres-backed read-model phase: when Postgres is wired, shell directories/events/sessions now read from spec-shaped relational tables (`execution_sessions`, `execution_session_events`, `approval_requests`, `recovery_incidents`, `account_quota_snapshots`, `account_quota_updates`, `operator_action_audit_events`), while the unified control-plane state blob remains the fallback/migration seam.
- `apps/shell` completed the workspace runtime-ingest phase:
  - new `/api/control/execution/workspace/[sessionId]/runtime` route
  - runtime-ingest service
  - best-effort posting of workspace and host actions
  - live recovery and approval upserts
  - smoke coverage for the runtime path
- `apps/work-ui` completed the live workspace emitters phase:
  - real producer surfaces now emit `founderos:*` events from `Chat.svelte`, `HermesWorkspaceStub.svelte`, `Artifacts.svelte`, and `ToolCallDisplay.svelte`
  - `+layout.svelte` now uses extracted `createFounderosWorkspaceRelay(...)` wiring instead of inline listener sprawl
  - targeted FounderOS bridge/event tests are green
  - full memory-capped `npm run work-ui:check` remains green after the emitter integration
- `apps/work-ui` completed the host-driven workspace actions phase:
  - incoming `founderos.account.switch`, `founderos.session.retry`, and `founderos.session.focus` now run through `createFounderosHostActionRelay(...)`
  - embedded meta strip stays truthful by showing account ID when a label is not available
  - `Chat.svelte` now performs real chat/retry/approval focus behavior on host actions
  - `ChatControls.svelte` now performs real files/diff panel focus behavior on host actions
  - targeted FounderOS bridge tests and full memory-capped `work-ui:check` stay green after the host-action integration
- `apps/shell` completed the live runtime feedback loop phase:
  - `/api/control/execution/workspace/[sessionId]/runtime` now returns an authoritative `runtimeSnapshot` derived from persisted shell state
  - the workspace host now keeps local session/account/quota/pending-approval/recovery state in sync from runtime-ingest responses instead of showing only queued signal logs
  - touched approval/recovery objects are surfaced as live drawer state without requiring an iframe reload
  - the exact memory-capped verification set is green:
    - `npx vitest run lib/server/control-plane/workspace/runtime-ingest.test.ts 'app/api/control/execution/workspace/[sessionId]/runtime/route.test.ts'`
    - `npm run typecheck`
    - `npm run build`
- `apps/shell` completed the workspace-host operator-actions phase:
  - approval/recovery action responses now include `runtimeSnapshot`
  - the host now resolves touched approval/recovery objects from that snapshot and can dispatch approve/deny/retry/resolve/reopen actions against them
- `apps/shell` completed the operator-audit lane phase:
  - new `/api/control/execution/audits` and `/api/control/execution/audits/[auditId]` routes now read the real operator-action audit model
  - `/execution/audits` and `/execution/audits/[auditId]` are now live shell pages instead of placeholders
  - workspace host rail now keeps latest audit touches from approval/recovery operator actions and links directly into the audit lane
- `apps/shell` completed the live runtime producer-batch phase:
  - `/api/control/execution/workspace/[sessionId]/runtime` now accepts single bridge messages and bounded `workspace_runtime_bridge` producer batches through one shell-owned ingest seam
  - high-volume workspace runtime traffic is now persisted as one producer batch append path instead of relying on per-message synthetic host writes
  - runtime route tests, runtime-ingest tests, event-store batch tests, build, smoke, and fixture verification are green
- `apps/shell` completed the quota/runtime producer ownership phase:
  - `/api/control/accounts/quotas` now accepts shell-owned quota producer writes instead of staying read-only
  - quota ingest derives capacity from the incoming snapshot, persists the snapshot/update through the unified control-plane store, and appends canonical `quota.updated` normalized session events for affected sessions
  - `/api/shell/execution/events` and smoke coverage now reflect those quota producer writes end-to-end
- `apps/shell` completed the selective Postgres write-through phase:
  - `updateControlPlaneState(...)` can now publish targeted relational deltas when a producer path already knows the exact rows it touched
  - runtime-ingest and quota-ingest now use that targeted Postgres delta path instead of forcing a full read-model table replace for every high-volume producer write
  - the unified state blob remains the fallback/migration seam, but noisy producer paths now have a deeper relational ownership boundary
- `apps/shell` completed the operator-action relational write-through phase:
  - approval responses and recovery actions now publish targeted relational deltas into Postgres read models
  - live operator interventions now use the same deeper write-ownership model as runtime-ingest and quota-ingest instead of falling back to broad full read-model replacement
  - the remaining shell front is no longer about write-path breadth; it is now about final end-to-end integration hardening
- `apps/shell` completed the final end-to-end integration hardening phase:
  - `app/api/control/execution/integration-gate.test.ts` now runs one isolated scenario across runtime producer batches, approval responses, quota producer writes, recovery actions, audits, and execution-event export
  - `npm run test` now includes that integration gate before the production smoke script
  - smoke additionally validates session-specific execution-feed invariants and combined approval/recovery audit totals after live operator/runtime actions
- `apps/work-ui` completed the producer-batch relay phase:
  - FounderOS browser emitters now publish normalized `founderos:producer-batch` payloads alongside legacy host-signal events
  - `+layout.svelte` forwards those batches to the shell host while keeping legacy per-event postMessage traffic only for immediate host UI signals
  - targeted FounderOS bridge/event tests and full memory-capped `work-ui:check` are green after the relay cutover
- `apps/shell` and `apps/work-ui` completed the workspace launch integrity phase:
  - shell now issues short-lived signed launch tokens and exposes `/api/control/execution/workspace/[sessionId]/launch-token`
  - `work-ui` verifies launch integrity before bridge bootstrap for both authenticated and demo-mode embedded launches
  - invalid embedded launches now fail closed instead of silently bootstrapping demo mode
  - local fallback launch signing is deterministic across multi-process `next start` workers, so production smoke can verify launch tokens end-to-end without requiring ad hoc per-process secrets
  - the exact green verification set for this phase is:
    - targeted vitest for `workspace/mock + launch-token route + work-ui founderos launch/index/bridge`
    - `npm run work-ui:check`
    - `npm run typecheck --workspace @founderos/web`
    - `npm run build --workspace @founderos/web`
    - `npm run test --workspace @founderos/web`
- `apps/shell` and `apps/work-ui` completed the shell-authored embedded bootstrap phase:
  - shell now exposes `/api/control/execution/workspace/[sessionId]/bootstrap`
  - the bootstrap route verifies the same launch token and returns a shell-owned embedded hydration payload (`user + hostContext + minimal UI state`)
  - embedded `work-ui` no longer falls back to `bootstrapFounderosDemoMode()` after a valid FounderOS launch; it now hydrates from the shell payload and only then enables the bridge
  - smoke now verifies both `/launch-token` and `/bootstrap` for the same signed launch token
  - the exact green verification set for this phase is:
    - targeted vitest for `workspace/mock + launch-token route + bootstrap route`
    - targeted vitest for `work-ui` `founderos/{index,launch,bootstrap,bridge}.test.ts`
    - `npm run work-ui:check`
    - `npm run typecheck --workspace @founderos/web`
    - `npx --yes tsx ./scripts/verify-event-fixtures.ts`
    - `npm run build --workspace @founderos/web`
    - `npm run test --workspace @founderos/web`
- `apps/shell` completed the explicit rollout-config phase:
  - strict deployment mode is now opt-in via `FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV=1`
  - in that mode the shell fails fast unless `FOUNDEROS_WORKSPACE_LAUNCH_SECRET`, `FOUNDEROS_WORK_UI_BASE_URL`, and `FOUNDEROS_WORKSPACE_SESSION_BEARER_TOKEN` are present
  - compatibility aliases still work for now (`FOUNDEROS_CONTROL_PLANE_SECRET` and the existing work-ui base-url aliases), but the canonical production contract is now explicit
  - local dev keeps its current localhost defaults because strict rollout validation is not enabled by default
  - the exact green verification set for this phase is:
    - targeted vitest for `lib/server/control-plane/workspace/rollout-config.test.ts`
    - targeted vitest for `app/api/control/execution/workspace/[sessionId]/{launch-token,bootstrap}/route.test.ts`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run typecheck --workspace @founderos/web`
    - `NODE_OPTIONS='--max-old-space-size=1024' npx --yes tsx ./scripts/verify-event-fixtures.ts`
    - `NODE_OPTIONS='--max-old-space-size=1280' npm run build --workspace @founderos/web`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run test --workspace @founderos/web`
- `apps/shell` and `apps/work-ui` completed the production session-exchange phase:
  - shell bootstrap auth now advertises only `bootstrap_only | session_exchange` plus `/session-bearer`, never a bearer token in the bootstrap payload itself
  - the canonical temporary bearer env is now `FOUNDEROS_WORKSPACE_SESSION_BEARER_TOKEN`, with `FOUNDEROS_WORKSPACE_BOOTSTRAP_BEARER_TOKEN` kept as a compatibility alias
  - `work-ui` performs a dedicated `/session-bearer` exchange using the verified shell launch token before authenticated hydration, and fails closed on missing or invalid returned credentials
  - the exact green verification set for this phase is:
    - targeted vitest for `app/api/control/execution/workspace/[sessionId]/{bootstrap,session-bearer}/route.test.ts`
    - targeted vitest for `lib/server/control-plane/workspace/rollout-config.test.ts`
    - targeted `work-ui` vitest for `src/lib/founderos/bootstrap.test.ts`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run work-ui:check`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run typecheck --workspace @founderos/web`
    - `NODE_OPTIONS='--max-old-space-size=1024' npx --yes tsx ./scripts/verify-event-fixtures.ts`
    - `NODE_OPTIONS='--max-old-space-size=1280' npm run build --workspace @founderos/web`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run test --workspace @founderos/web`
- `apps/shell` and `apps/work-ui` completed the live deployment cut-in phase:
  - shell launch view models now carry `shellPublicOrigin`, and the embedded work-ui launch URL receives `host_origin` from server-side rollout config instead of relying only on `window.location.origin`
  - shell now exposes `/api/control/execution/workspace/rollout-status`, which reports strict rollout readiness, public shell origin, work-ui base URL, session auth mode, and launch notes without crashing on incomplete strict env
  - `/session-bearer` now also returns a shell-issued launch-scoped `sessionGrant`; `work-ui` persists that grant in a local credential layer and can already send it as a compatibility header for session-auth tool-server fetches
  - canonical deployment host origin is now `FOUNDEROS_SHELL_PUBLIC_ORIGIN`, while non-strict local runs still derive `http://127.0.0.1:${FOUNDEROS_WEB_PORT || 3737}`
  - the exact green verification set for this phase is:
    - targeted vitest for `lib/server/control-plane/workspace/{rollout-config,mock,session-grant}.test.ts`
    - targeted vitest for `app/api/control/execution/workspace/rollout-status/route.test.ts`
    - targeted vitest for `app/api/control/execution/workspace/[sessionId]/{bootstrap,session-bearer}/route.test.ts`
    - targeted `work-ui` vitest for `src/lib/founderos/{bootstrap,credentials}.test.ts`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run work-ui:check`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run typecheck --workspace @founderos/web`
    - `NODE_OPTIONS='--max-old-space-size=1024' npx --yes tsx ./scripts/verify-event-fixtures.ts`
    - `NODE_OPTIONS='--max-old-space-size=1280' npm run build --workspace @founderos/web`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run test --workspace @founderos/web`
- `apps/shell` and `apps/work-ui` completed the production session issuance phase:
  - shell bootstrap now advertises canonical `sessionExchangePath = /api/control/execution/workspace/[sessionId]/session`
  - shell now mints launch-scoped embedded session tokens itself and no longer depends on the temporary bearer env as the active embedded auth path
  - legacy `/session-bearer` remains only as a compatibility alias and maps to the same shell-issued session token
  - embedded `work-ui` now trusts the shell-issued exchange response for the embedded user and no longer calls upstream `getSessionUser(...)` during FounderOS boot
  - embedded `work-ui` now short-circuits the generic post-login hydration path in FounderOS mode and stays on shell-authored bootstrap state
  - rollout-status now reports `sessionAuthMode = "shell_issued"`, with canonical secret `FOUNDEROS_WORKSPACE_SESSION_TOKEN_SECRET` falling back to `FOUNDEROS_WORKSPACE_LAUNCH_SECRET`
  - the exact green verification set for this phase is:
    - targeted vitest for `lib/server/control-plane/workspace/{rollout-config,session-token}.test.ts`
    - targeted vitest for `app/api/control/execution/workspace/[sessionId]/{bootstrap,session,session-bearer}/route.test.ts`
    - targeted vitest for `app/api/control/execution/workspace/rollout-status/route.test.ts`
    - targeted `work-ui` vitest for `src/lib/founderos/{bootstrap,credentials}.test.ts`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run work-ui:check`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run typecheck --workspace @founderos/web`
    - `NODE_OPTIONS='--max-old-space-size=1024' npx --yes tsx ./scripts/verify-event-fixtures.ts`
    - `NODE_OPTIONS='--max-old-space-size=1280' npm run build --workspace @founderos/web`
    - `NODE_OPTIONS='--max-old-space-size=1024' npm run test --workspace @founderos/web`
- `apps/shell` completed the operator-action canonical event phase:
  - approval responses append canonical normalized session events
  - recovery actions append canonical normalized session events
  - `/api/shell/execution/events` can surface those normalized session records from the session event stream
- `apps/shell` no longer leaks server-side workspace helpers into the client bundle; the workspace host build is green after moving server launch-context derivation back into the route layer.
- `apps/work-ui` is green on:
  - `npm run work-ui:build`
  - `cd apps/work-ui && npx vitest run src/lib/founderos/contract.test.ts src/lib/founderos/index.test.ts`
- `apps/work-ui` is now fully green in full `npm run work-ui:check`; the latest verified low-memory pass is `0 errors / 0 warnings`.
- Recent bounded reductions came from:
  - ambient `getContext('i18n')` typing in `src/app.d.ts`
  - Hermes session/workspace utility strictness fixes
  - prompt component and shared tag/input prop typing
  - shared knowledge/workspace contract typing (`Select`, `DropdownOptions`, `AddContentMenu`, `AttachWebpageModal`, `KnowledgeBase/Files`)
  - bounded connection/config contract typing (`AddConnectionModal`, admin/chat settings wrappers)
  - typed permissions/default-permissions chain (`constants/permissions.ts`, `admin/Users/Groups/*`, `apis/users/index.ts`)
  - bounded note editor typing cleanup (`components/notes/utils.ts`, `NoteEditor.svelte`, `NoteEditor/Chat.svelte`, `NoteEditor/Controls.svelte`, `Notes/NoteMenu.svelte`)
  - bounded models/editor cleanup (`workspace/Models/ModelEditor.svelte`, `workspace/Models/*Selector.svelte`, `Capabilities.svelte`, `PromptSuggestions.svelte`, `workspace/Models.svelte`, `workspace/common/TagSelector.svelte`)
  - bounded interface/input cleanup (`chat/Settings/Interface.svelte`, `chat/Settings/Interface/*`, `channel/MessageInput.svelte`, shared `stores/index.ts`, `common/Switch.svelte`)
  - bounded message-history seam for `chat/Messages/MultiResponseMessages.svelte`
  - bounded channel/admin/chat cleanup (`channel/Channel.svelte`, `channel/Messages.svelte`, `channel/Thread.svelte`, `admin/Settings/Documents.svelte`, `admin/Settings/Images.svelte`, `admin/Settings/Models.svelte`, `admin/Functions.svelte`, `chat/Messages/UserMessage.svelte`, `admin/Settings/Models/Manage/ManageOllama.svelte`, `chat/Messages/CodeBlock.svelte`)
  - partial selector cleanup (`chat/ModelSelector/{Selector.svelte,ModelItem.svelte,ModelItemMenu.svelte}`), with `ModelItemMenu.svelte` already clean and the remaining diagnostics still concentrated in `Selector.svelte` + `ModelItem.svelte`
  - bounded settings/workspace cleanup (`admin/Settings/Pipelines.svelte`, `admin/Settings/WebSearch.svelte`, `workspace/Prompts.svelte`, `workspace/Skills.svelte`, `workspace/Tools.svelte`, `chat/Settings/Audio.svelte`, `playground/Chat.svelte`, `playground/Completions.svelte`)
  - bounded admin/chat cleanup (`admin/Settings/Evaluations.svelte`, `admin/Users/UserList.svelte`, `chat/ContentRenderer/FloatingButtons.svelte`) plus local tail patches in `chat/MessageInput/InputMenu/Knowledge.svelte` and `chat/Overview/Node.svelte`
  - bounded integration/message/editor cleanup (`admin/Settings/Integrations.svelte`, `chat/Settings/Tools/Connection.svelte`, `channel/Messages/Message.svelte`, `common/CodeEditor.svelte`, `common/CodeEditorModal.svelte`, `chat/Controls/Valves.svelte`, `AddTerminalServerModal.svelte`) plus shared prop seams in `common/EmojiPicker.svelte`, `common/Textarea.svelte`, and `common/Valves.svelte`
- `apps/shell` now also has a bounded contextual recent-events seam in workspace surfaces, reusing the existing execution events feed without promoting `/execution/events` into a primary board.
- The next highest-value product batch is now live deployment bring-up and MVP rollout, not more foundational shell ownership work:
  1. use the now-green integration gate as the default MVP readiness check
  2. keep the fallback file state only as a migration and recovery seam until real deployment cut-in happens
  3. shift work from foundational implementation to live environment bring-up, explicit env-backed launch secrets/config, real production session issuance instead of the temporary env-backed session bearer seam, and operational rollout
  4. avoid reopening shell architecture scope unless a concrete live-runtime gap appears

## Production rollout note

- Production rollout now has an explicit fail-fast env gate via `FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV=1`.
- In that strict rollout mode the minimum required envs are `FOUNDEROS_SHELL_PUBLIC_ORIGIN`, `FOUNDEROS_WORKSPACE_LAUNCH_SECRET`, and `FOUNDEROS_WORK_UI_BASE_URL`.
- Compatibility aliases remain accepted for now (`FOUNDEROS_CONTROL_PLANE_SECRET` and existing work-ui base-url aliases), but they are no longer the intended canonical deployment contract.
- Canonical shell-issued session token secret is now `FOUNDEROS_WORKSPACE_SESSION_TOKEN_SECRET`, falling back to `FOUNDEROS_WORKSPACE_LAUNCH_SECRET`.
- The active embedded auth path is now shell-issued session exchange; keep the fallback file state and the temporary bearer compatibility seam only as rollout compatibility.
- The next frontier is operational rollout discipline, live environment bring-up, and then shell/workspace reference alignment.

## Batch ownership

### Local orchestrator

Scope:

- `apps/shell/apps/web/lib/server/control-plane/contracts/session-events.ts`
- `apps/shell/apps/web/lib/server/control-plane/sessions/index.ts`
- `apps/shell/apps/web/lib/server/control-plane/sessions/mock.ts`
- `apps/shell/apps/web/components/execution/session-surface.tsx`
- `latest-plan.md`
- `parallel-batch-02.md`

Goal:

- keep `sessions/groups` on projection-backed server-side runtime events while the runtime-ingest route/service stay green;
- preserve the runtime smoke set and the low-memory policy;
- document the current execution state for the next wave.

### Current work-ui bounded seam

Scope:

- `apps/work-ui/src/app.d.ts`
- `apps/work-ui/src/lib/utils/hermesSessions.ts`
- `apps/work-ui/src/lib/utils/hermesWorkspace.ts`
- `apps/work-ui/src/lib/workers/kokoro.worker.ts`
- `apps/work-ui/src/lib/components/workspace/Prompts/**`
- `apps/work-ui/src/lib/components/common/{Select.svelte,DropdownOptions.svelte,Textarea.svelte,Switch.svelte}`
- `apps/work-ui/src/lib/components/common/Tags/**`
- `apps/work-ui/src/lib/components/workspace/Knowledge/KnowledgeBase/{AddContentMenu.svelte,Files.svelte}`
- `apps/work-ui/src/lib/components/chat/MessageInput/AttachWebpageModal.svelte`

Goal:

- reduce `work-ui:check` error volume via thin type seams and contract cleanup, without redesigning the workspace and without touching shell ownership.

### Completed bounded work-ui seams

Scope:

- `apps/work-ui/src/lib/constants/permissions.ts`
- `apps/work-ui/src/lib/apis/users/index.ts`
- `apps/work-ui/src/lib/components/admin/Users/Groups.svelte`
- `apps/work-ui/src/lib/components/admin/Users/Groups/{Permissions.svelte,EditGroupModal.svelte,GroupItem.svelte}`
- `apps/work-ui/src/lib/components/notes/utils.ts`
- `apps/work-ui/src/lib/components/notes/NoteEditor.svelte`
- `apps/work-ui/src/lib/components/notes/NoteEditor/{Chat.svelte,Controls.svelte}`
- `apps/work-ui/src/lib/components/notes/Notes/NoteMenu.svelte`

Goal:

- eliminate the new strictness clusters in permissions/group editing and NoteEditor without redesigning the workspace.

Status:

- completed in bounded form; full capped `work-ui:check` no longer reports diagnostics in the touched permissions files or NoteEditor files.

### Newly completed bounded work-ui seams

Scope:

- `apps/work-ui/src/lib/components/workspace/Models.svelte`
- `apps/work-ui/src/lib/components/workspace/Models/ModelEditor.svelte`
- `apps/work-ui/src/lib/components/workspace/Models/{ToolsSelector.svelte,SkillsSelector.svelte,FiltersSelector.svelte,ActionsSelector.svelte,Capabilities.svelte,PromptSuggestions.svelte}`
- `apps/work-ui/src/lib/components/workspace/common/TagSelector.svelte`
- `apps/work-ui/src/lib/components/chat/Settings/Interface.svelte`
- `apps/work-ui/src/lib/components/chat/Settings/Interface/{ManageFloatingActionButtonsModal.svelte,ManageImageCompressionModal.svelte}`
- `apps/work-ui/src/lib/components/chat/Messages/{types.ts,MultiResponseMessages.svelte}`
- `apps/work-ui/src/lib/components/channel/MessageInput.svelte`
- `apps/work-ui/src/lib/components/common/Switch.svelte`
- `apps/work-ui/src/lib/stores/index.ts`
- `apps/work-ui/src/lib/components/channel/Channel.svelte`
- `apps/work-ui/src/lib/components/channel/Messages.svelte`
- `apps/work-ui/src/lib/components/channel/Thread.svelte`
- `apps/work-ui/src/lib/components/admin/Settings/Models.svelte`
- `apps/work-ui/src/lib/components/admin/Functions.svelte`
- `apps/work-ui/src/lib/components/chat/Messages/UserMessage.svelte`
- `apps/work-ui/src/lib/components/chat/ModelSelector/Selector.svelte`
- `apps/work-ui/src/lib/components/chat/ModelSelector/ModelItem.svelte`
- `apps/work-ui/src/lib/components/chat/ModelSelector/ModelItemMenu.svelte`
- `apps/work-ui/src/lib/components/admin/Settings/Documents.svelte`
- `apps/work-ui/src/lib/components/admin/Settings/Images.svelte`
- `apps/work-ui/src/lib/components/admin/Settings/Models/Manage/ManageOllama.svelte`
- `apps/work-ui/src/lib/components/chat/Messages/CodeBlock.svelte`

Goal:

- collapse the legacy models/interface/input/message-history strictness sinks without redesigning `work-ui`;
- keep all checks memory-capped and leave no lingering background processes.

Status:

- completed in bounded form; the latest capped `work-ui:check` no longer reports diagnostics in `ModelEditor.svelte`, `Models.svelte`, `TagSelector.svelte`, `chat/Settings/Interface.svelte`, both interface modal files, `MultiResponseMessages.svelte`, `MessageInput.svelte`, `Channel.svelte`, `Messages.svelte`, `Thread.svelte`, `admin/Settings/Models.svelte`, `admin/Functions.svelte`, `chat/Messages/UserMessage.svelte`, `Documents.svelte`, `Images.svelte`, `ManageOllama.svelte`, `CodeBlock.svelte`, or `common/Switch.svelte`.

### Latest completed bounded work-ui seams

Scope:

- `apps/work-ui/src/lib/components/admin/Settings/Pipelines.svelte`
- `apps/work-ui/src/lib/components/admin/Settings/WebSearch.svelte`
- `apps/work-ui/src/lib/components/workspace/Prompts.svelte`
- `apps/work-ui/src/lib/components/workspace/Skills.svelte`
- `apps/work-ui/src/lib/components/workspace/Tools.svelte`
- `apps/work-ui/src/lib/components/chat/Settings/Audio.svelte`
- `apps/work-ui/src/lib/components/playground/Chat.svelte`
- `apps/work-ui/src/lib/components/playground/Completions.svelte`
- `apps/work-ui/src/lib/components/admin/Settings/Evaluations.svelte`
- `apps/work-ui/src/lib/components/admin/Users/UserList.svelte`
- `apps/work-ui/src/lib/components/chat/ContentRenderer/FloatingButtons.svelte`
- `apps/work-ui/src/lib/components/chat/MessageInput/InputMenu/Knowledge.svelte`
- `apps/work-ui/src/lib/components/chat/Overview/Node.svelte`

Goal:

- collapse another full wave of legacy implicit-`any`, async-mount, import-dialog, and nullability sinks without widening scope beyond the touched screens.

Status:

- completed in bounded form; the latest verified capped `work-ui:check` no longer reports diagnostics in `Pipelines.svelte`, `WebSearch.svelte`, `Prompts.svelte`, `Skills.svelte`, `Audio.svelte`, `playground/Chat.svelte`, `playground/Completions.svelte`, `admin/Settings/Evaluations.svelte`, or `admin/Users/UserList.svelte`.
- `workspace/Tools.svelte` was reduced to a single remaining diagnostics line in the prior verified baseline and then received one additional local patch after the check, so it should be treated as effectively closed pending the next full capped run.
- `chat/ContentRenderer/FloatingButtons.svelte`, `chat/MessageInput/InputMenu/Knowledge.svelte`, and `chat/Overview/Node.svelte` received bounded local patches after the verified `685 / 182 / 154` run and should be revalidated in the next capped pass rather than treated as still-open design clusters.

### Current wave14 reductions

Scope:

- `apps/work-ui/src/lib/components/admin/Settings/{Interface.svelte,Interface/Banners.svelte,General.svelte,Integrations.svelte,Audio.svelte,Database.svelte}`
- `apps/work-ui/src/lib/components/workspace/{Knowledge.svelte,Prompts.svelte,Skills.svelte,Tools.svelte}`
- `apps/work-ui/src/lib/components/workspace/Models/{Knowledge/KnowledgeSelector.svelte,ModelList.svelte,ModelSelector.svelte,DefaultFeatures.svelte}`
- `apps/work-ui/src/lib/components/workspace/common/{ManifestModal.svelte,ValvesModal.svelte}`
- `apps/work-ui/src/lib/components/channel/{PinnedMessagesModal.svelte,ChannelInfoModal/UserList.svelte,ChannelInfoModal/AddMembersModal.svelte,MessageInput/MentionList.svelte}`
- `apps/work-ui/src/lib/components/chat/{ChatPlaceholder.svelte,Placeholder/ChatList.svelte,ShortcutItem.svelte,ShortcutsModal.svelte}`
- `apps/work-ui/src/lib/components/chat/Settings/{Account/UserProfileImage.svelte,Integrations/Terminals.svelte,Integrations/Terminals/Connection.svelte,Personalization/ManageModal.svelte,SyncStatsModal.svelte,Connections/Connection.svelte}`
- `apps/work-ui/src/lib/components/chat/Messages/{CodeExecutionModal.svelte}`
- `apps/work-ui/src/lib/components/common/{DropdownSub.svelte}`
- `apps/work-ui/src/lib/components/layout/{Sidebar/SearchInput.svelte,ChatsModal.svelte}`
- `apps/work-ui/src/lib/components/admin/{Analytics/Dashboard.svelte,Analytics/ModelUsage.svelte}`
- `apps/work-ui/src/lib/components/admin/Users/UserList/{AddUserModal.svelte,EditUserModal.svelte,UserChatsModal.svelte}`
- `apps/work-ui/src/lib/components/chat/MessageInput/Commands/Knowledge.svelte`
- `apps/work-ui/src/lib/components/notes/{NotePanel.svelte}`
- `apps/work-ui/src/lib/components/{AddConnectionModal.svelte,ImportModal.svelte}`

Goal:

- drive the legacy `work-ui` type-closure effort from `541 / 179 / 144` down to the current `111 / 129 / 101` baseline without widening into UI redesign or upstream repo edits;
- keep all full checks single-shot and memory-capped.

Status:

- completed in bounded form; the latest verified capped `work-ui:check` no longer reports diagnostics in the bulk of the above files, and the remaining frontier has shifted into call overlay, message input, sidebar, and a smaller set of modal/configuration surfaces.

### Current wave19 reductions

Scope:

- `apps/work-ui/src/lib/components/chat/MessageInput/CallOverlay.svelte`
- `apps/work-ui/src/lib/components/channel/{Navbar.svelte,WebhookItem.svelte,Channel.svelte,ChannelInfoModal.svelte}`
- `apps/work-ui/src/lib/components/chat/MessageInput/{InputMenu/Chats.svelte,InputMenu/Notes.svelte,Commands/{Skills.svelte,Prompts.svelte},ToolServersModal.svelte,MessageInput.svelte,AttachWebpageModal.svelte}`
- `apps/work-ui/src/lib/components/layout/{Sidebar.svelte,Sidebar/Folders/FolderMenu.svelte,Sidebar/UserStatusModal.svelte}`
- `apps/work-ui/src/lib/components/common/{ImagePreview.svelte,Selector.svelte,ToolCallDisplay.svelte}`
- `apps/work-ui/src/lib/components/admin/{Settings/CodeExecution.svelte,Analytics/AnalyticsModelModal.svelte,Evaluations/ModelActivityChart.svelte,Functions.svelte,Functions/FunctionMenu.svelte}`
- `apps/work-ui/src/lib/components/chat/Messages/Markdown/{AlertRenderer.svelte,KatexRenderer.svelte,Citations/CitationsModal.svelte}`
- `apps/work-ui/src/lib/components/workspace/Models/BuiltinTools.svelte`
- `apps/work-ui/src/lib/components/playground/Chat/Message.svelte`
- `apps/work-ui/src/lib/components/common/Tags/TagInput.svelte`
- `apps/work-ui/src/lib/stores/index.ts`
- `apps/work-ui/src/lib/types/katex-mhchem.d.ts`

Goal:

- collapse the last large type-error frontier from the previous `69 / 105 / 94` baseline down into a true endgame-sized residual set, without widening into redesign or non-Infinity repos.

Status:

- completed in bounded form; the verified full check is now `11 errors / 96 warnings / 68 files` on wave19.
- the remaining error set is no longer cluster-shaped; it is now eleven single-file seams that can be closed one by one before switching focus to warnings/a11y cleanup.

### Current wave22 reductions

Scope:

- `apps/work-ui/src/lib/components/workspace/Models/{ModelEditor.svelte,DefaultFiltersSelector.svelte,BuiltinTools.svelte}`
- `apps/work-ui/src/lib/components/admin/Users/UserList/{EditUserModal.svelte}`
- `apps/work-ui/src/lib/components/admin/Users/UserList.svelte`
- `apps/work-ui/src/lib/components/chat/MessageInput/Commands/Models.svelte`
- `apps/work-ui/src/lib/components/chat/FileNav/{CellEditor.svelte,SqliteView.svelte}`
- `apps/work-ui/src/lib/components/layout/FilesModal.svelte`
- `apps/work-ui/src/lib/components/chat/Settings/Integrations.svelte`
- `apps/work-ui/src/lib/components/notes/AIMenu.svelte`
- `apps/work-ui/src/lib/components/workspace/{Prompts/PromptMenu.svelte,Tools/ToolMenu.svelte}`

Goal:

- finish the type-error burn-down completely and move the `work-ui` frontier from contract closure into warning/a11y cleanup.

Status:

- completed in bounded form; the verified full check is now `0 errors / 89 warnings / 57 files` on wave22.
- remaining work is warning-heavy rather than type-error-heavy, so next batches should optimize for markup correctness, a11y labels, self-closing-tag cleanup, and dead-selector cleanup rather than store/contract rewrites.

### Current warning-reduction wave

Scope:

- `apps/work-ui/src/lib/components/chat/{Chat.svelte,Messages.svelte,Messages/ResponseMessage.svelte}`
- `apps/work-ui/src/lib/components/chat/MessageInput/{VoiceRecording.svelte,IntegrationsMenu.svelte,TerminalMenu.svelte}`
- `apps/work-ui/src/lib/components/layout/Sidebar/UserMenu.svelte`
- `apps/work-ui/src/lib/components/workspace/Knowledge/KnowledgeBase/{AddTextContentModal.svelte,AddContentMenu.svelte}`
- `apps/work-ui/src/routes/(app)/+layout.svelte`
- `apps/work-ui/src/lib/components/{notes/RecordMenu.svelte,playground/Images.svelte}`
- `apps/work-ui/src/lib/components/workspace/{Knowledge/CreateKnowledgeBase.svelte,Models/ModelMenu.svelte,Skills/SkillEditor.svelte}`
- `apps/work-ui/src/lib/components/layout/Sidebar/PinnedModelItem.svelte`
- `agents.md`
- `latest-plan.md`
- `parallel-batch-02.md`

Goal:

- convert the first warning-heavy frontier into calm, low-risk markup/a11y cleanup;
- use bounded workers without allowing background dev servers, browser emulation, or worker-owned full checks;
- keep heavy verification centralized in the orchestrator with capped memory.

Status:

- completed in bounded form with low-memory worker agents plus local orchestration cleanup.
- verified `work-ui:check` moved from `0 / 89 / 57` to `0 / 53 / 43`, then to `0 / 45 / 37`, and finally to `0 / 0`.
- this phase is closed; the next workstream should shift away from Svelte hygiene and back into spec-facing integration and durable control-plane ownership.

### Poincare

Scope:

- `apps/shell/apps/web/lib/server/control-plane/accounts/**`
- `apps/shell/apps/web/lib/server/control-plane/contracts/quota.ts`
- `apps/shell/apps/web/app/api/control/accounts/**`

Status:

- completed in bounded form; accounts/quota routes are compile-safe and route-tested.

### Lagrange

Scope:

- read-only shell gap analysis around session/event wiring

Status:

- completed; confirmed that shell directories/events/sessions now read from the spec-shaped relational tables above, while the unified control-plane state blob remains the fallback/migration seam.
- the remaining bounded shell gaps are now downstream write-path alignment and audit surfacing, not the read-model layer itself.

### Hegel

Scope:

- `apps/shell/apps/web/lib/server/control-plane/approvals/**`
- `apps/shell/apps/web/lib/server/control-plane/recoveries/**`
- `apps/shell/apps/web/lib/server/control-plane/contracts/approvals.ts`
- `apps/shell/apps/web/lib/server/control-plane/contracts/recoveries.ts`
- `apps/shell/apps/web/app/api/control/execution/approvals/**`
- `apps/shell/apps/web/app/api/control/execution/recoveries/**`

Status:

- completed in bounded form; approvals/recoveries keep their contract-shaped detail builders and mutation paths, while the active shell read models now resolve through Postgres-backed relational tables when the durability boundary is wired.

## Remaining bounded tasks after this batch

1. Keep the unified control-plane state blob only as the fallback/migration seam; the active shell read models now come from the relational tables above.
2. Move approvals/recoveries from local file-backed actions to durable operator-facing control-plane records with the same canonical `sessionId` contract; snapshot-backed action responses are now already in place.
3. Wire accounts/quota snapshots to real upstream-backed reads and keep API-key accounts on their separate capacity semantics.
4. Advance host ↔ workspace runtime wiring so the embedded work surface emits and consumes live control-plane signals instead of only local bootstrap context; touched-object approval/recovery actions in the workspace host are now in place.
5. Keep route/bridge seams explicit; do not reopen wide `work-ui` cleanup scope now that the green frontier is closed.

## Integration rule for the next wave

- If a task needs both `apps/shell` and `apps/work-ui`, it must be split at the route/bridge seam.
- If a task wants to “clean up” a wide copied Open WebUI subtree, it is not bounded enough and must be narrowed first.
- If a task changes a frozen contract, it must be recorded as a contract diff before implementation spreads.
