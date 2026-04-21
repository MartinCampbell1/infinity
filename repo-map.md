# repo-map.md — Repo And Runtime Map

## Purpose

This file gives agents a compact map of the real repo boundaries, local roots, and ownership rules that matter during implementation.

---

## Canonical repos

### Read-only reference repos

- `FounderOS` -> upstream branch `main`
- `Open WebUI` -> upstream branch `main`
- `Hermes WebUI` -> upstream branch `master`
- `cabinet` -> upstream branch `main`, docs-only snapshot

### Actual implementation apps

```text
apps/shell
  FounderOS-based control plane implementation

apps/work-ui
  Open WebUI adaptation
```

Rules:

- `references/founderos` is reference material for shell structure and existing patterns.
- `references/open-webui` is reference material for upstream visual/base behavior.
- `references/hermes-webui` is behavior reference only.
- `references/cabinet` is UX reference only.
- Only `apps/shell` and `apps/work-ui` are implementation homes for MVP product code.
- `packages/*` are local support packages copied into Infinity so `apps/shell` can resolve its `@founderos/*` workspace dependencies without touching upstream repos.

---

## Observed local roots

These paths were confirmed during review.

- reference only:
  - `/Users/martin/FounderOS`
  - `/Users/martin/open-webui`
  - `/Users/martin/hermes-webui`
- editable local product roots:
  - `/Users/martin/infinity/apps/shell`
  - `/Users/martin/infinity/apps/work-ui`
- editable local support package roots:
  - `/Users/martin/infinity/packages/api-clients`
  - `/Users/martin/infinity/packages/config`
  - `/Users/martin/infinity/packages/ui`
  - `/Users/martin/infinity/packages/typescript-config`
  - `/Users/martin/infinity/packages/eslint-config`
- copied local reference roots:
  - `/Users/martin/infinity/references/founderos`
  - `/Users/martin/infinity/references/open-webui`
  - `/Users/martin/infinity/references/hermes-webui`
- tooling:
  - `/Users/martin/.local/bin/codext-session-supervisor`

Not observed locally during review:

- cabinet snapshot path

If cabinet is needed during implementation, add a docs-only local snapshot before assigning cabinet-informed visual work.

---

## Ownership map

### apps/shell

Owns:

- global shell;
- route families;
- control-plane boards;
- route scope;
- deep links;
- session orchestration;
- durable control-plane APIs;
- durable truth tables;
- quota/capacity read models;
- approvals and recoveries as control-plane objects.

Does not own:

- Open WebUI transcript/composer/files surface;
- Hermes runtime backend semantics;
- app-local workspace storage as cross-plane truth.

### apps/work-ui

Owns:

- message-first workspace experience;
- composer and transcript ergonomics;
- files and artifacts surfaces;
- embedded or launched work mode behavior;
- workspace-local UI for tools, approvals, retry/edit, right panel, and context usage.

Does not own:

- global shell navigation;
- cross-project boards;
- durable control-plane storage;
- canonical quota truth.

### Hermes reference

Use for:

- three-panel ergonomics;
- session grouping, pin, archive, tags;
- tool cards;
- approval cards;
- retry/edit flows;
- workspace behavior patterns.

Do not use it as:

- third product frontend;
- backend truth model;
- source of process-local approval storage.

### cabinet reference

Use for:

- calm shell tone;
- object-first IA;
- sidebar grammar;
- activity-centric UX.

Do not use it as:

- code import source;
- runtime dependency;
- replacement for FounderOS shell.

---

## Runtime and storage map

### Durable truth

- owner: `apps/web` server-side layer in FounderOS
- storage: Postgres

### Runtime producers and consumers

- Codex / app-server -> producer of runtime facts and events
- Hermes -> producer of runtime facts and events
- Open WebUI adaptation -> consumer and emitter of workspace UI signals
- FounderOS shell -> durable owner of normalized control-plane truth

### Identity and bindings

- canonical key: `sessionId`
- primary runtime external key: `externalSessionId`
- additional bindings live in `execution_session_bindings`

---

## Key local code anchors

These are useful starting points for actual implementation work.

### Local shell implementation

- [/Users/martin/infinity/apps/shell/apps/web/lib/route-scope.ts](/Users/martin/infinity/apps/shell/apps/web/lib/route-scope.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/navigation.ts](/Users/martin/infinity/apps/shell/apps/web/lib/navigation.ts)
- [/Users/martin/infinity/apps/shell/apps/web/components/execution/session-surface.tsx](/Users/martin/infinity/apps/shell/apps/web/components/execution/session-surface.tsx)
- [/Users/martin/infinity/apps/shell/apps/web/components/execution/workspace-handoff-surface.tsx](/Users/martin/infinity/apps/shell/apps/web/components/execution/workspace-handoff-surface.tsx)
- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/session-events.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/session-events.ts)
- [/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts](/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts)

### Local support packages

- [/Users/martin/infinity/packages/api-clients/src/index.ts](/Users/martin/infinity/packages/api-clients/src/index.ts)
- [/Users/martin/infinity/packages/config/src/index.ts](/Users/martin/infinity/packages/config/src/index.ts)
- [/Users/martin/infinity/packages/ui/src/components/button.tsx](/Users/martin/infinity/packages/ui/src/components/button.tsx)
- [/Users/martin/infinity/packages/typescript-config/nextjs.json](/Users/martin/infinity/packages/typescript-config/nextjs.json)
- [/Users/martin/infinity/packages/eslint-config/next.js](/Users/martin/infinity/packages/eslint-config/next.js)

### Local work-ui implementation

- [/Users/martin/infinity/apps/work-ui/src/routes/(app)/+layout.svelte](/Users/martin/infinity/apps/work-ui/src/routes/(app)/+layout.svelte)
- [/Users/martin/infinity/apps/work-ui/src/lib/founderos/index.ts](/Users/martin/infinity/apps/work-ui/src/lib/founderos/index.ts)
- [/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesSessions.ts](/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesSessions.ts)
- [/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesTranscript.ts](/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesTranscript.ts)
- [/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesTranscript.test.ts](/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesTranscript.test.ts)

### Local reference snapshots

- [/Users/martin/infinity/references/founderos/apps/web/lib/route-scope.ts](/Users/martin/infinity/references/founderos/apps/web/lib/route-scope.ts)
- [/Users/martin/infinity/references/open-webui/src/routes/(app)/+layout.svelte](/Users/martin/infinity/references/open-webui/src/routes/(app)/+layout.svelte)
- [/Users/martin/infinity/references/hermes-webui/docs/design/transcript-behavior-rules.md](/Users/martin/infinity/references/hermes-webui/docs/design/transcript-behavior-rules.md)

---

## Practical rule for agents

If a task needs edits across shell, work UI, event normalization, and quota/recovery logic at the same time, it is too large and must be split before work starts.

No agent should ever edit `/Users/martin/FounderOS`, `/Users/martin/open-webui`, or `/Users/martin/hermes-webui` directly.
