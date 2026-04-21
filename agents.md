# agents.md

## Назначение файла

Этот файл нужен для **субагентов и исполнителей**, которые будут параллельно собирать unified control plane.

Он **не заменяет** большую спеку. Он нужен как:

- короткая, но точная рамка проекта;
- правило, что именно мы строим и чего **не** строим;
- разбиение на параллельные bounded workstreams;
- набор замороженных контрактов, без которых команда развалится на несовместимые ветки.

## Главные документы проекта

1. `unified-control-plane-super-spec-v2-2026-04-10.md` — главный master-doc по продукту, UX и архитектуре.
2. `latest-plan.md` — краткий актуальный план реализации и общее видение.
3. `agents.md` — этот файл; правила делегирования, ownership, границы и execution model.

Если что-то противоречит друг другу:

- по **архитектуре и product direction** побеждает большая спека;
- по **распределению работ и merge-дисциплине** побеждает `agents.md`.

---

# 0. Неподвижное repo rule

## Reference repos всегда read-only

Начиная с этого момента, для проекта действует жёсткое правило:

- `/Users/martin/FounderOS`
- `/Users/martin/open-webui`
- `/Users/martin/hermes-webui`
- любой внешний `cabinet` snapshot

используются **только как reference sources**.

### Что это означает practically

1. **Никогда не редактировать файлы в оригинальных репозиториях.**
2. Если нужен код или asset из reference repo:
   - сначала **копировать его в `/Users/martin/infinity`**;
   - дальше менять **только локальную копию внутри `infinity`**.
3. Все новые product changes, refactors, adapters, tests и scaffolding живут только внутри:
   - `references/*` — read-only snapshots;
   - `apps/*` — рабочие implementation copies;
   - `packages/*` — локальные support packages для shell/runtime scaffolding.
4. Если агент видит удобный путь “быстро поправить FounderOS/Open WebUI прямо там”, это **ошибка**, а не shortcut.

## Source of truth for this project

- product/master-doc: `unified-control-plane-super-spec-v2-2026-04-10.md`
- local project workspace: `/Users/martin/infinity`
- editable implementation roots: `/Users/martin/infinity/apps/*`
- editable support package roots: `/Users/martin/infinity/packages/*`
- read-only local snapshots: `/Users/martin/infinity/references/*`

## Reference freshness rule

На текущем этапе reference repos имеют разную степень визуальной стабильности:

- `FounderOS` считаем **почти визуально frozen** reference для shell language;
- `Open WebUI` считаем **rolling workspace reference**, который ещё может заметно меняться;
- `Hermes` остаётся behavioral reference, а не visual authority для shell;
- `cabinet` остаётся docs-only UX reference.

### Практическое следствие

1. Внешний shell в `infinity` нужно выравнивать по **текущему FounderOS**, а не по старым локальным scaffold-решениям.
2. Workspace в `infinity` можно периодически **refresh-ить из Open WebUI reference**, но только через copy into `references/*` и затем port into `apps/*`.
3. Нельзя считать текущий snapshot `references/open-webui` навсегда замороженным, если upstream local reference заметно ушёл вперёд.
4. При конфликте visual direction:
   - shell-side visual truth = FounderOS;
   - workspace visual truth = текущий local Open WebUI adaptation reference;
   - workspace behavior truth = Hermes-informed semantics.

## Resource budget rule

У проекта ограниченный локальный ресурс машины. Базовое допущение для всех агентов:

- у оператора только `16 GB RAM`;
- параллельно могут быть открыты другие проекты и тяжёлые приложения;
- нельзя рассчитывать на “свободную” машину под долгие прогонки.

### Практические правила

1. **Нельзя запускать watch-режимы, dev servers и browser emulation без прямой необходимости.**
2. **Нельзя держать фоновые `vite`, `next dev`, `svelte-check --watch`, `vitest --watch`, Playwright, Puppeteer или Chrome-подобные процессы после завершения подзадачи.**
3. **Субагенты не запускают full-repo checks по умолчанию.**
4. **Тяжёлая верификация делается только orchestrator-агентом, обычно одним memory-capped прогоном в конце bounded batch.**
5. **Если подзадача требует browser/runtime simulation, агент обязан сначала выбрать самый лёгкий возможный путь и завершить процесс сразу после проверки.**
6. **Если можно проверить reasoning-ом, targeted read-ами и локальной статической правкой вместо тяжёлого runtime-прогона, нужно выбирать именно это.**

### Policy for delegated workers

Каждый subagent должен считать себя memory-constrained worker:

- не запускать watcher’ы;
- не поднимать локальные dev servers;
- не запускать полный `npm run check` / `npm run build` / `npm test`, если orchestrator этого явно не попросил;
- ограничиваться bounded edits в своей write-zone;
- после правок оставлять ноль фоновых процессов.

---

# 1. Что мы строим

## Один абзац, который должны понимать все

Мы строим **один продукт**, но **не один фронтенд и не один репозиторий**.

Правильная композиция такая:

- **FounderOS** = корневой shell и operator-facing control plane;
- **Open WebUI adaptation** = основное conversation/workspace-пространство внутри продукта;
- **Hermes** = источник поведенческой логики workspace, а не третий root-продукт;
- **Codex CLI / app-server / structured events** = execution substrate;
- **cabinet** = reference по IA, боковым панелям, object-first UX и спокойному тону.

## Визуальная формула

- внешний shell и orchestration = FounderOS;
- внутренняя рабочая поверхность = Open WebUI look-and-feel;
- поведение этой рабочей поверхности = Hermes-grade semantics;
- execution/quota truth = normalized control-plane layer поверх CLI/app-server.

## Что пользователь должен ощущать

Пользователь должен ощущать **единый продукт**, в котором есть два естественных режима:

1. **Control mode** — FounderOS shell: проекты, сессии, группы, аккаунты, recoveries, approvals, review.
2. **Work mode** — session/workspace route: Open WebUI visual DNA + Hermes behavior.

Это **не две несвязанные системы**. Это одна система, где один и тот же session/run виден в двух проекциях:

- как рабочая сессия в workspace;
- как операционный объект в control plane.

---

# 2. Что мы точно НЕ строим

## Нельзя делать

1. **Нельзя переписывать Open WebUI на React.**
2. **Нельзя пытаться засунуть Svelte-компоненты как нативные React-компоненты в FounderOS.**
3. **Нельзя делать generic AI dashboard ради dashboard.**
4. **Нельзя делать Hermes третьим равноправным фронтендом в продукте.**
5. **Нельзя использовать router/load balancer как единственный source of truth по квотам.**
6. **Нельзя оставлять approvals в in-memory/process-local состоянии.**
7. **Нельзя сливать admin/operator surfaces прямо в chat canvas.**
8. **Нельзя редизайнить весь workspace “по пути”.**
9. **Нельзя показывать raw CLI JSONL как UI.**
10. **Нельзя ломать Open WebUI identity ради “контрольной панели”.**

## Что считается анти-паттерном

- monolithic mega-SPA “на всё сразу”;
- giant rewrite вместо thin integration seams;
- три разных truth-слоя для sessions/events/quotas;
- скрытая авто-магия вместо видимых recoveries и retries;
- chat UX, в который насильно вшили половину control plane.

---

# 3. Репозитории и ownership

## 3.1 FounderOS — root shell и operator control plane

**Только FounderOS отвечает за:**

- global navigation;
- route scope;
- session/group/account/recovery boards;
- review lane;
- approvals board;
- recoveries lane;
- account capacity board;
- session workspace host route;
- control-plane API/BFF;
- normalized projections, если они живут в shell repo.

**FounderOS не должен:**

- становиться chat-first app;
- копировать UI Open WebUI как глобальную систему;
- напрямую импортировать внутренние UI-фрагменты adaptation как будто это один codebase.

## 3.2 Local Open WebUI adaptation — embedded workspace app

**Open WebUI adaptation отвечает за:**

- message-first workspace experience;
- composer/transcript/files/artifacts;
- embedded host mode;
- bridge с FounderOS;
- Hermes-подобные session/workspace behaviors внутри workspace;
- file/tool/approval UI внутри рабочей поверхности.

**Open WebUI adaptation не отвечает за:**

- глобальный shell;
- cross-project operations board;
- canonical quota truth;
- operator recoveries board;
- глобальную orchestration navigation.

## 3.3 Hermes repo — reference, а не root dependency

**Hermes используется как reference для:**

- three-panel layout semantics;
- tool cards;
- approval cards;
- retry/edit flows;
- session grouping/tagging/pin/archive;
- context usage footer;
- workspace ergonomics.

**Hermes не надо копировать буквально как backend model.**
Особенно нельзя переносить process-local approval storage и process-global state assumptions.

## 3.4 cabinet — UX reference only

**cabinet используется как reference для:**

- calm shell tone;
- object-first navigation;
- collapsible sidebar logic;
- sessions-as-activity model;
- anti-enterprise-workflow bias.

**cabinet не является UI-клоном и не является кодовой базой для слияния.**

---

# 4. Главная архитектурная позиция

## 4.1 Не “один фронт”, а “один продукт из двух приложений”

Правильная техническая композиция:

```text
Shared auth / gateway / shared identity
├─ FounderOS (React / Next / Tailwind)
│  ├─ shell
│  ├─ boards
│  ├─ accounts
│  ├─ recoveries
│  ├─ approvals
│  └─ workspace host route
└─ Open WebUI adaptation (Svelte / Python backend)
   ├─ transcript
   ├─ composer
   ├─ files / artifacts
   ├─ embedded mode
   └─ Hermes-grade workspace behaviors
```

## 4.2 Правильный шов интеграции

**Шов интеграции — route boundary + host bridge, а не component boundary.**

То есть:

- FounderOS открывает `/execution/workspace/[sessionId]`;
- этот route рендерит host container;
- внутри живёт embedded Open WebUI adaptation;
- host и workspace общаются через явный bridge contract;
- внешняя оболочка остаётся FounderOS.

## 4.3 Working formula

- FounderOS решает, **как системой управлять**;
- Open WebUI решает, **как внутри workspace приятно работать**;
- Hermes решает, **как workspace должен вести себя функционально**;
- Codex/Hermes events решают, **на каком substrate строится transcript/execution layer**.

---

# 5. Неподвижные правила проекта

## 5.1 Эти правила нельзя нарушать без отдельного согласования

1. **FounderOS — единственный root shell.**
2. **Open WebUI adaptation — единственный основной workspace UI.**
3. **Hermes — reference and feature source, не третий root app.**
4. **Canonical quota source для ChatGPT-authenticated accounts — upstream app-server rate-limit read/update.**
5. **API-key accounts не притворяются ChatGPT quota buckets.**
6. **CLI/SSE events сначала нормализуются, потом проецируются, и только потом рендерятся.**
7. **Approvals и recoveries — durable first-class objects.**
8. **Route scope должен сохраняться между boards, review и workspace.**
9. **Встроенный workspace не должен превращаться в dashboard.**
10. **Весь MVP должен оставаться calm, scan-friendly, operator-usable.**

---

# 6. 48-часовой contract freeze

В первые 48 часов команда обязана заморозить 5 контрактов. Пока это не сделано, опасно вести полноценную параллельную разработку.

## 6.1 Contract 01 — Session summary

```ts
export type ExecutionSessionStatus =
  | "queued"
  | "starting"
  | "planning"
  | "acting"
  | "validating"
  | "waiting_for_approval"
  | "blocked"
  | "failed"
  | "recovered"
  | "completed"
  | "cancelled"
  | "unknown";

export interface ExecutionSessionSummary {
  id: string;
  externalSessionId?: string | null;
  projectId: string;
  projectName: string;
  groupId?: string | null;
  workspaceId?: string | null;
  accountId?: string | null;
  provider: "codex" | "hermes" | "openwebui" | "mixed" | "unknown";
  model?: string | null;
  title: string;
  status: ExecutionSessionStatus;
  phase?: string | null;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  lastToolAt?: string | null;
  lastErrorAt?: string | null;
  pendingApprovals: number;
  toolActivityCount: number;
  retryCount: number;
  recoveryState: "none" | "retryable" | "failing_over" | "recovered" | "dead";
  quotaPressure: "low" | "medium" | "high" | "exhausted" | "unknown";
  unreadOperatorSignals: number;
}
```

## 6.2 Contract 02 — Normalized execution event

```ts
export type NormalizedExecutionEventKind =
  | "session.started"
  | "session.updated"
  | "turn.started"
  | "turn.completed"
  | "turn.failed"
  | "agent.message.delta"
  | "agent.message.completed"
  | "tool.started"
  | "tool.completed"
  | "command.started"
  | "command.completed"
  | "approval.requested"
  | "approval.resolved"
  | "file.changed"
  | "phase.changed"
  | "quota.updated"
  | "account.switched"
  | "recovery.started"
  | "recovery.completed"
  | "error.raised";

export interface NormalizedExecutionEvent {
  id: string;
  sessionId: string;
  projectId: string;
  groupId?: string | null;
  source: "codex_jsonl" | "codex_app_server" | "hermes_sse" | "openwebui" | "manual";
  provider: "codex" | "hermes" | "openwebui" | "mixed" | "unknown";
  kind: NormalizedExecutionEventKind;
  status?: "in_progress" | "completed" | "failed" | "declined" | "unknown";
  phase?: "planning" | "acting" | "validating" | "blocked" | "review" | "completed" | "unknown";
  timestamp: string;
  summary: string;
  payload: Record<string, unknown>;
  raw?: Record<string, unknown> | null;
}
```

## 6.3 Contract 03 — Host ↔ workspace bridge

```ts
export interface SessionWorkspaceHostContext {
  projectId: string;
  projectName: string;
  sessionId: string;
  externalSessionId?: string | null;
  groupId?: string | null;
  workspaceId?: string | null;
  accountId?: string | null;
  accountLabel?: string | null;
  model?: string | null;
  executionMode?: "local" | "worktree" | "cloud" | "hermes" | "unknown";
  quotaState?: {
    pressure: "low" | "medium" | "high" | "exhausted" | "unknown";
    usedPercent?: number | null;
    resetsAt?: string | null;
  };
  pendingApprovals?: number;
  openedFrom:
    | "dashboard"
    | "execution_board"
    | "review"
    | "group_board"
    | "deep_link"
    | "unknown";
}

export type HostToWorkspaceMessage =
  | { type: "founderos.bootstrap"; payload: SessionWorkspaceHostContext }
  | { type: "founderos.account.switch"; payload: { accountId: string } }
  | { type: "founderos.session.retry"; payload: { retryMode: "same_account" | "fallback_account" } }
  | { type: "founderos.session.focus"; payload: { section: "chat" | "files" | "approvals" | "diff" } }
  | { type: "founderos.session.meta"; payload: Partial<SessionWorkspaceHostContext> };

export type WorkspaceToHostMessage =
  | { type: "workspace.ready" }
  | { type: "workspace.session.updated"; payload: { title?: string; status?: string } }
  | { type: "workspace.tool.started"; payload: { toolName: string; eventId: string } }
  | { type: "workspace.tool.completed"; payload: { toolName: string; eventId: string; status: "completed" | "failed" } }
  | { type: "workspace.approval.requested"; payload: { approvalId: string; summary: string } }
  | { type: "workspace.file.opened"; payload: { path: string } }
  | { type: "workspace.error"; payload: { code?: string; message: string } }
  | { type: "workspace.deepLink"; payload: { sessionId: string; filePath?: string; anchor?: string } };
```

## 6.4 Contract 04 — Quota snapshot and capacity state

```ts
export interface AccountQuotaBucket {
  limitId: string;
  limitName?: string | null;
  usedPercent?: number | null;
  windowDurationMins?: number | null;
  resetsAt?: string | null;
}

export interface AccountQuotaSnapshot {
  accountId: string;
  authMode: "chatgpt" | "chatgptAuthTokens" | "apikey" | "unknown";
  source: "openai_app_server" | "chatgpt_usage_panel" | "observed_runtime" | "router_derived";
  observedAt: string;
  buckets: AccountQuotaBucket[];
  raw?: Record<string, unknown> | null;
}

export interface AccountCapacityState {
  accountId: string;
  schedulable: boolean;
  pressure: "low" | "medium" | "high" | "exhausted" | "unknown";
  reason?: string | null;
  nextResetAt?: string | null;
  preferredForNewSessions: boolean;
}
```

## 6.5 Contract 05 — Approval response API

```ts
POST /api/shell/execution/approvals/[approvalId]/respond
body: {
  decision: "approve_once" | "approve_session" | "approve_always" | "deny";
}
```

## 6.6 Contract rule

Если кто-то хочет поменять один из этих контрактов:

- сначала открывается отдельный contract-diff PR;
- потом это валидирует QA/integration owner;
- только потом можно менять реализацию в workstream-ветках.

---

# 7. Разделение работ по субагентам

Ниже — рекомендуемое разделение на 8 bounded workstreams. Каждый субагент получает **одну** зону ответственности.

---

## 7.1 Subagent 01 — FounderOS shell / IA engineer

**Миссия:** превратить FounderOS execution section в реальный operator board без ломки текущего shell.

**Зона ответственности:**

- routes;
- navigation;
- session/group/account/recovery boards;
- route-scope expansion;
- deep links в workspace.

**Трогает только:** FounderOS.

**Не трогает:** Open WebUI adaptation, Hermes code, quota adapters, event adapters.

**Нужно сделать:**

1. Добавить `Execution -> Sessions / Groups / Accounts / Recoveries`.
2. Расширить route scope `session_id`, `group_id`, `account_id`, `workspace_id`.
3. Создать mock-backed страницы.
4. Добавить deep links из board rows в `/execution/workspace/[sessionId]`.
5. Сохранить текущие nav/shortcut semantics.

**Результат:** shell уже выглядит как control plane даже на моках.

**Definition of done:**

- оператор открывает `/execution/sessions`;
- клик по session переводит в `/execution/workspace/[sessionId]`;
- scope не теряется между переходами.

**Рекомендуемая ветка:** `feat/founderos-shell-sessions`

**Prompt для передачи агенту:**

```text
You are working only inside FounderOS. Extend the existing shell into a session-aware operator control plane without redesigning the shell. Add Execution children for Sessions, Groups, Accounts, and Recoveries. Extend route-scope with session_id, group_id, account_id, and workspace_id. Build mocked but realistic route pages and deep links into /execution/workspace/[sessionId]. Preserve the current navigation model and naming conventions. Do not touch Open WebUI or Hermes code.
```

---

## 7.2 Subagent 02 — FounderOS workspace host engineer

**Миссия:** построить route-level host container, который красиво и предсказуемо встраивает Open WebUI adaptation в FounderOS.

**Зона ответственности:**

- workspace host route;
- iframe/host container;
- postMessage handshake;
- host meta strip;
- optional host drawer для approvals/logs.

**Трогает только:** FounderOS host-side.

**Не трогает:** внутренний UI adaptation.

**Нужно сделать:**

1. Создать `session-workspace-host.tsx`.
2. Реализовать bootstrap handshake.
3. Добавить top meta strip с project/account/model/quota/phase.
4. Добавить right-side host drawer.
5. Обеспечить reload, deep link и same-origin safe behavior.

**Definition of done:**

- embedded child присылает `workspace.ready`;
- host шлёт `founderos.bootstrap`;
- host показывает tool/error/approval signals.

**Рекомендуемая ветка:** `feat/founderos-workspace-host`

**Prompt:**

```text
You are implementing the FounderOS side of the embedded session workspace. Build a route-level host component that embeds a same-origin workspace app, sends bootstrap context, and listens to workspace events. The outer shell remains FounderOS. Optimize for minimalism, robustness, and future migration away from iframe if needed.
```

---

## 7.3 Subagent 03 — Open WebUI host-mode engineer

**Миссия:** сделать adaptation способным жить как embedded workspace inside FounderOS, не теряя Open WebUI visual DNA.

**Зона ответственности:**

- `embedded=1` mode;
- hiding outer chrome;
- bridge listener;
- session meta bar;
- upward events.

**Трогает только:** local Open WebUI adaptation.

**Не трогает:** FounderOS routes/boards.

**Нужно сделать:**

1. Добавить `embedded=1` режим.
2. Скрыть глобальный chrome/nav.
3. Добавить `founderos/bridge.ts`.
4. Добавить session meta bar.
5. Эмитить `tool/approval/error/file-open` events наверх.
6. Не разрушить standalone mode.

**Definition of done:**

- `?embedded=1` даёт workspace-only UI;
- bootstrap от host принимается стабильно;
- standalone visual identity не ломается.

**Рекомендуемая ветка:** `feat/openwebui-embedded-mode`

**Prompt:**

```text
You are working only in the local Open WebUI adaptation. Add a FounderOS embedded mode. In embedded mode the app must hide outer chrome, preserve the chat/file/workspace visual identity, accept bootstrap context from the parent shell, and emit postMessage events back up. Do not redesign the app. Do not make it look like a dashboard. Keep it feeling like Open WebUI, just host-aware.
```

---

## 7.4 Subagent 04 — Hermes behavior porter

**Миссия:** перенести в adaptation именно те behaviors, которые делают Hermes сильным workspace.

**Зона ответственности:**

- session tags/archive/pin/grouping;
- inline tool cards;
- approval cards;
- retry/edit flows;
- resizable right panel;
- context usage footer.

**Трогает:** adaptation UI/UX внутри workspace.

**Не трогает:** Hermes backend shortcuts, in-memory pending state, FounderOS shell.

**Нужно сделать:**

1. Реализовать или проверить session organization features.
2. Добавить inline tool cards.
3. Добавить approval cards.
4. Добавить retry last assistant response.
5. Добавить edit from prior user message.
6. Добавить resizable right panel.
7. Добавить context usage footer.

**Definition of done:**

- workspace получает Hermes-grade ergonomics;
- behavior живёт на чистом local state + host events;
- нет process-local storage truth.

**Рекомендуемая ветка:** `feat/openwebui-hermes-behaviors`

**Prompt:**

```text
Your mission is to port Hermes WebUI’s strongest session/workspace behaviors into the existing Open WebUI adaptation without changing the overall visual DNA. Focus on session organization, tool activity cards, approvals, retry/edit flows, context usage visibility, and right-panel workspace ergonomics. Do not port Hermes backend shortcuts that rely on module-level state or process-global environment variables.
```

---

## 7.5 Subagent 05 — Event normalization engineer

**Миссия:** построить canonical normalized event layer, который превращает CLI/SSE execution в clean UI substrate.

**Зона ответственности:**

- normalized event contract;
- Codex JSONL adapter;
- Hermes SSE adapter;
- append-only event storage;
- session/group projections;
- fixtures and determinism.

**Трогает:** shared domain layer / FounderOS server-side event model.

**Не трогает:** final UI visuals.

**Нужно сделать:**

1. Описать `NormalizedExecutionEvent`.
2. Реализовать Codex JSONL adapter.
3. Реализовать Hermes SSE adapter.
4. Построить append-only storage.
5. Построить session/group reducers.
6. Дать fixture-based tests.

**Definition of done:**

- одна и та же fixture всегда даёт один и тот же projection;
- raw source differences скрыты за единым контрактом;
- UI не зависит от source-specific event shapes.

**Рекомендуемая ветка:** `feat/event-normalization`

**Prompt:**

```text
Build a normalized execution event layer that can ingest Codex JSONL events and Hermes SSE events, store them append-only, and materialize calm session/group summaries for the UI. The UI must not depend on source-specific event shapes. Optimize for clarity, determinism, and testability.
```

---

## 7.6 Subagent 06 — Quota / accounts engineer

**Миссия:** построить account capacity layer с правильной source-of-truth hierarchy.

**Зона ответственности:**

- app-server quota adapter;
- account capacity derivation;
- accounts board API;
- live quota updates;
- separation of ChatGPT vs API-key semantics.

**Нельзя делать:**

- выдавать router-derived values за canonical truth;
- изображать API-key usage как fake remaining ChatGPT quota.

**Нужно сделать:**

1. Реализовать `AppServerQuotaSource`.
2. Разделить ChatGPT-authenticated и API-key accounts.
3. Вычислять `pressure` и `schedulable`.
4. Собрать `/api/shell/accounts/quotas`.
5. Добавить лёгкий live update path.

**Definition of done:**

- ChatGPT accounts показывают upstream quota buckets;
- API-key accounts честно показывают другой capacity model;
- shell умеет выбирать preferred account.

**Рекомендуемая ветка:** `feat/quota-capacity-layer`

**Prompt:**

```text
Build the quota and account-capacity layer for the control plane. Use official upstream rate-limit reads when the account auth mode is ChatGPT or externally managed ChatGPT tokens. Treat API-key accounts as usage-priced access rather than fake ChatGPT quota buckets. Expose derived pressure and schedulable states for the shell.
```

---

## 7.7 Subagent 07 — Approvals / recoveries engineer

**Миссия:** сделать blocked/failure/failover behavior first-class control-plane object.

**Зона ответственности:**

- durable approvals model;
- recovery incidents;
- retry/failover actions;
- approvals board;
- recovery lane;
- audit events.

**Нужно сделать:**

1. Реализовать `approval_requests` storage и APIs.
2. Реализовать `recovery_incidents` storage и APIs.
3. Добавить retry same account / retry fallback account.
4. Сделать approvals board и recovery lane.
5. Логировать каждое operator intervention.

**Definition of done:**

- failed session становится retryable с видимой причиной;
- approval виден и в workspace, и в shell;
- operator может fail over blocked session на fallback account.

**Рекомендуемая ветка:** `feat/approvals-recoveries`

**Prompt:**

```text
Your mission is to turn approvals and recoveries into first-class control-plane objects. Build durable storage, APIs, and UI actions for pending approvals, failures, retries, and fallback-account failover. Every operator action must be auditable and visible in both the shell and the session workspace.
```

---

## 7.8 Subagent 08 — QA / contracts / integration engineer

**Миссия:** удержать команду от расползания контрактов и хаоса во время параллельной разработки.

**Зона ответственности:**

- frozen interfaces;
- fixtures;
- projection invariant tests;
- host↔workspace smoke tests;
- visual regression checklist;
- integration test matrix.

**Нужно сделать:**

1. Зафиксировать contract fixtures.
2. Написать adapter fixture tests.
3. Написать projection invariant tests.
4. Написать host↔workspace smoke tests.
5. Сделать embedded visual regression checklist.
6. Составить integration matrix на основные user flows.

**Definition of done:**

- ни один PR не мержится без contract/fixture green;
- 5 главных flows покрыты smoke tests;
- все спорные контрактные изменения проходят через QA owner.

**Рекомендуемая ветка:** `feat/contracts-and-qa-gate`

**Prompt:**

```text
You are the integration and QA owner for the unified control plane. Freeze the core contracts, create fixtures for Codex JSONL and Hermes SSE, validate projections, and guard the FounderOS to workspace bridge with smoke tests. Your job is to make parallel development safe.
```

---

# 8. Порядок запуска работ

## День 0–1

Сначала запускаются:

- Subagent 05 — нормализация событий;
- Subagent 06 — quota contract;
- Subagent 01 — route scope / IA;
- Subagent 08 — freeze интерфейсов и fixtures.

## День 1–3

Параллельно после freeze:

- Subagent 02 — workspace host;
- Subagent 03 — embedded mode;
- Subagent 04 — Hermes behaviors на моках;
- Subagent 05 — adapters + projections;
- Subagent 06 — quota source + accounts API.

## День 3–5

Подключаются live paths:

- Subagent 07 — approvals/recoveries;
- Subagent 01 — wiring boards на live projections;
- Subagent 08 — smoke/integration прогон и дефект-листы.

## День 5+

Только после этого:

- polish;
- keyboard shortcuts;
- visual refinements;
- review deep links;
- performance cleanup.

---

# 9. Merge-дисциплина

## 9.1 Branch rule

Один субагент = одна bounded responsibility.

## 9.2 Contract rule

Если нужна правка frozen contract:

1. отдельный PR;
2. явный diff контракта;
3. approval QA/integration owner;
4. только потом меняется код.

## 9.3 UI rule

Нельзя использовать слово “cleanup” как оправдание широкого редизайна.

## 9.4 Debug rule

Raw logs можно показывать только:

- за expander;
- во secondary detail panel;
- в audit/event lane.

Они **не** должны заменять calm primary UI.

## 9.5 Ownership rule

Если задача требует менять сразу shell, adaptation, event model и quota model, значит она слишком большая и её надо разрезать.

---

# 10. Проверка качества решений

Каждый субагент перед PR обязан сам ответить на 10 вопросов:

1. Это не giant rewrite?
2. Это не ломает FounderOS как root shell?
3. Это не ломает Open WebUI identity?
4. Это не делает Hermes третьим root app?
5. Это не добавляет ещё один truth-слой?
6. Это не тащит raw provider events прямо в UI?
7. Это сохраняет route scope?
8. Это сохраняет calm UX?
9. Это тестируется фикстурами?
10. Это действительно помогает operator, а не создаёт “ещё один дашборд”? 

Если хотя бы на 2 вопроса ответ “нет” или “не знаю”, PR ещё не готов.

---

# 11. Общий definition of done для MVP

MVP считается готовым только если одновременно выполнены все условия ниже.

1. В FounderOS есть реальные boards для sessions/groups/accounts/recoveries.
2. FounderOS умеет открывать session workspace route.
3. Open WebUI adaptation умеет работать в embedded mode.
4. Внутри workspace есть Hermes-grade session behaviors.
5. Codex JSONL и Hermes SSE нормализуются в один event model.
6. Accounts board показывает реальные upstream ChatGPT quota buckets там, где они доступны.
7. Approvals и recoveries durable и operator-actionable.
8. Deep links между boards/review/workspace сохраняют scope.
9. Продукт ощущается calm and elegant, а не как перегруженная админка.

---

# 12. Самая короткая формула проекта

Если совсем коротко, все агенты должны помнить одно:

> FounderOS owns the shell.  
> Open WebUI owns the workspace feel.  
> Hermes owns the workspace behavior.  
> Normalized events own the execution substrate.  
> Upstream app-server owns ChatGPT quota truth.

---

# 13. Release hardening addendum (обязателен для всех новых агентов)

Этот раздел добавлен как жёсткое уточнение после фактического аудита текущего состояния `Infinity`.

## 13.1 Что считать правдой о проекте прямо сейчас

На момент последнего аудита подтверждено:

1. `shell` реально поднимается на `127.0.0.1:3737`, но корневой `/` там отдаёт `404`.
2. `work-ui` отдельно поднимается на `localhost:5173`.
3. `shell` фактически живёт на `/execution`, а не на `/`.
4. `rollout-status` показывал:
   - `ready = false`
   - `integrationState = "placeholder"`
   - `workUiBaseUrl = http://127.0.0.1:3101`
   - `launchSecretConfigured = false`
5. В проекте одновременно присутствуют конфликтующие runtime assumptions `3737 / 5173 / 3101 / 8080`.
6. На критических маршрутах и API всё ещё встречаются `mock_file_backed`, mock builders и placeholder-поведение.
7. `execution-kernel` существует, но исторически был in-memory scaffold, а не подтверждённый durable runtime.
8. Planner / task graph / assembly / verification / delivery частично реализованы, но не должны считаться finished только по факту наличия кода.

## 13.2 Из этого следуют жёсткие выводы

Пока не доказано обратное:

1. Проект нельзя считать release-ready.
2. Нельзя объявлять работу завершённой по признакам:
   - “страница открывается”;
   - “typecheck зелёный”;
   - “build прошёл”;
   - “есть route и API”.
3. Главная проблема проекта — не косметика, а **незакрытый release seam между shell и workspace**.

---

# 14. Неявные решения, которые для агента считаются принятыми по умолчанию

Если пользователь явно не сказал иного, агент обязан исходить из следующих решений.

## 14.1 Кто владеет корневым `/`

По умолчанию:

- корневой route `/` должен принадлежать `FounderOS shell`;
- `work-ui` не должен быть вторым корневым продуктом;
- `work-ui` должен открываться как embedded workspace внутри shell-owned маршрута.

## 14.2 Как интерпретировать Open WebUI adaptation

По умолчанию:

- это `workspace app`, а не глобальный shell;
- он отвечает за message-first рабочую поверхность;
- он не должен забирать себе global navigation и operator control plane.

## 14.3 Как трактовать mock/placeholder state

По умолчанию:

- `mock_file_backed` не считается production truth;
- `placeholder` не считается готовым rollout state;
- synthetic orchestration artifacts не считаются real execution proof.

---

# 15. Что агенту делать в первую очередь, а что запрещено откладывать

## 15.1 Абсолютный приоритет

Если агент начинает новую итерацию разработки, он обязан сначала закрывать именно это:

1. единый frontdoor и owner для `/`;
2. shell ↔ work-ui origin/baseURL contract;
3. launch/bootstrap/session exchange;
4. удаление mock/placeholder truth с release-critical path;
5. превращение orchestration/runtime в реальный рабочий контур;
6. approvals/recoveries/quota как operator-grade layer;
7. тестовый и release validation gate.

## 15.2 Что нельзя делать раньше времени

До закрытия пунктов выше нельзя приоритизировать:

- общий cosmetic cleanup;
- широкие visual redesign changes;
- новые второстепенные UX-фичи;
- performance polish без закрытия topology/runtime truth;
- “рефакторинг ради красоты”.

---

# 16. Автономный режим работы агента

Этот проект должен вестись максимально автономно, но строго в правильную сторону.

## 16.1 Как агент должен действовать

Агент обязан:

1. Сначала читать `AGENTS.md`/`agents.md`, master spec и актуальное ТЗ, потом писать код.
2. Не спрашивать подтверждение на каждый очевидный следующий шаг.
3. Самостоятельно:
   - изучать кодовую зону;
   - выбирать уже существующие паттерны;
   - доводить задачу end-to-end;
   - валидировать результат.
4. Если задача пользователя явно направляет в реализацию, не останавливаться на анализе.
5. Если есть неоднозначность, выбирать решение, максимально совместимое с этим файлом, а не придумывать новую архитектуру.

## 16.2 Когда агент должен остановиться и не импровизировать

Агент обязан остановиться и явно зафиксировать blocker, если:

1. решение требует ломать frozen contracts;
2. для продолжения нужен новый source of truth;
3. задача требует giant rewrite сразу нескольких bounded zones;
4. действие разрушает базовую формулу:
   - FounderOS owns the shell
   - Open WebUI owns the workspace feel
   - Hermes owns the workspace behavior
   - normalized events own execution substrate

---

# 17. Жёсткие release guardrails

## 17.1 Что нельзя считать завершением задачи

Запрещено писать “done”, если выполнено только одно из следующего:

- код компилируется;
- route существует;
- UI выглядит похоже на target design;
- mock API отвечает;
- появился “временный” working flow через ручной обход.

## 17.2 Что считается настоящим завершением

Работа считается завершённой только когда одновременно:

1. critical path реально проходит end-to-end;
2. shell/workspace seam работает на живом контракте;
3. нет зависимости от placeholder/mock truth на релизном пути;
4. runtime переживает reload/restart там, где это требуется;
5. тесты/валидации подтверждают результат;
6. итог совместим с общей архитектурой проекта.

---

# 18. Обязательный маршрут проверки после каждой существенной реализации

После каждого существенного изменения агент обязан проверить не только код, но и продуктовый путь.

Минимальный порядок мысли:

1. Что является user-visible critical path?
2. Какой route/API/runtime seam это изменение затрагивает?
3. Не опирается ли изменение всё ещё на mock/placeholder слой?
4. Не вводит ли изменение новый truth-layer?
5. Есть ли end-to-end proof, что теперь стало лучше?

Если ответов нет, работа не завершена.

---

# 19. Самая короткая операционная инструкция для любого нового агента

Если времени мало, агент должен запомнить только это:

> Сначала закрой `/` и topology.  
> Потом почини shell ↔ workspace launch seam.  
> Потом убери mock truth с critical path.  
> Потом доведи orchestration/runtime до реальной операционности.  
> Не полируй раньше времени.  
> Не объявляй done без end-to-end validation.

---

# 20. Autonomous one-prompt release target (обязателен для всех новых итераций)

С этого момента для проекта считается целевым не просто `manual staged flow`, а именно:

- **one-prompt**
- **unified shell first**
- **autonomous stage progression**
- **full control plane telemetry**
- **local preview**
- **handoff pack**

Главные документы для этой цели:

1. `infinity-autonomous-one-prompt-master-tz-2026-04-19.md`
2. `infinity-autonomous-loop-contracts-2026-04-19.md`
3. `agents.md` — этот файл

Если какой-либо старый документ допускает ручное продвижение между стадиями как норму, а новые autonomous docs это запрещают, побеждают новые autonomous docs.

---

# 21. Что теперь считается настоящим end-to-end

Проект считается `end-to-end` только если пользователь:

1. открывает unified shell;
2. пишет **один** запрос;
3. система сама проходит:
   - intake
   - spec
   - planning
   - scheduling
   - execution
   - assembly
   - verification
   - delivery
   - preview
   - handoff
4. и всё это видно в control plane.

## 21.1 Что больше нельзя считать end-to-end

Запрещено называть `end-to-end` любой сценарий, где на happy path обязателен хотя бы один из шагов:

- `Approve brief`
- `Launch planner`
- `Launch batch`
- `Create assembly package`
- `Run verification`
- `Create delivery handoff`

Такие действия могут существовать только как:

- override,
- debug control,
- manual recovery,
- replay action,

но не как required user flow.

---

# 22. Жёсткая продуктовая цель v1

V1 должен давать пользователю:

1. один shell-owned chat entry;
2. один orchestration object `ProjectRun`;
3. batched multi-agent execution;
4. полноценный FounderOS dashboard;
5. full execution telemetry;
6. локальный preview проекта;
7. handoff pack.

## 22.1 Human mode

По умолчанию оператор:

- не обязан вмешиваться;
- только наблюдает;
- вмешивается по желанию.

Оператор должен иметь возможность вмешаться в любой момент, но happy path не должен от него зависеть.

## 22.2 Auto-stop policy

Единственный обязательный auto-stop:

- `secrets / credentials required`

Все остальные проблемы:

- refusal,
- failed attempt,
- verification fail,
- reroute,
- replan,
- recovery

система сначала обязана пытаться обработать сама через policy/reaction engine.

---

# 23. Жёсткие autonomous guardrails

## 23.1 Что агентам теперь запрещено

Запрещено:

1. выдавать staged flow за autonomous flow;
2. выдавать validation runner, который сам последовательно жмёт кнопки, за proof настоящего one-shot loop;
3. считать build/typecheck/route existence доказательством готовности;
4. считать operator click частью нормального happy path;
5. прятать required manual transition в shell sidebar, internal route или hidden button;
6. завершать работу без preview и handoff pack;
7. завершать работу без event/evidence trail.

## 23.2 Что агент обязан доказать

Чтобы честно написать `done`, агент обязан доказать одновременно:

1. `one prompt` действительно запускает run;
2. stage progression автономна;
3. task/batch/agent transitions видны в control plane;
4. refusals и recoveries first-class;
5. verification автоматизирована;
6. delivery автоматизирована;
7. preview реально поднят;
8. handoff pack реально собран.

---

# 24. Обязательные first-class objects нового цикла

Ни один новый orchestration path не считается корректным, если он не работает с durable first-class objects:

- `ProjectRun`
- `Initiative`
- `SpecDoc`
- `TaskGraph`
- `WorkItem`
- `WorkBatch`
- `AgentSession`
- `Refusal`
- `RecoveryIncident`
- `AssemblyPackage`
- `VerificationRun`
- `DeliveryHandoff`
- `PreviewTarget`
- `HandoffPacket`

Запрещено прятать эти сущности внутри:

- local component state;
- ad-hoc route-specific memory;
- process-local variables;
- одноразовых UI-only abstractions.

---

# 25. Обязательные control-plane surfaces

FounderOS shell обязан иметь операторские поверхности как source of operational visibility:

1. Runs
2. Spec
3. Planner
4. Tasks
5. Agents
6. Refusals
7. Recoveries
8. Validation
9. Delivery
10. Previews
11. Audit / Events

Если какая-то часть orchestration существует, но не видна в control plane, значит она не завершена.

---

# 26. Обязательные архитектурные решения

Для autonomous loop обязательны следующие решения:

1. **canonical lifecycle manager**
2. **append-only normalized event log**
3. **derived projections**
4. **reaction engine**
5. **scheduler / batch engine**
6. **durable runtime state**
7. **preview + handoff as done criteria**
8. **invariant-based validation**

Это означает:

- UI не определяет truth;
- truth определяют lifecycle + events + projections + evidence.

---

# 27. Обязательные evidence rules

Каждая стадия обязана оставлять machine-checkable evidence.

Минимальный набор:

- `run.json`
- `initiative.json`
- `spec.md`
- `task-graph.json`
- `batches.json`
- `agent-session/*.json`
- `assembly.json`
- `verification.json`
- `delivery.json`
- `preview.json`
- `handoff/final-summary.md`

Если stage произошёл, а evidence нет, stage не считается завершённой.

---

# 28. Новое правило для validation

Validation теперь обязан доказывать не просто happy path, а именно:

- `autonomous_one_prompt = true`
- `manual_stage_progression = false`

Validation должен падать, если обнаружено:

- обязательное нажатие stage button;
- ручной planner launch;
- ручной batch launch;
- ручной assembly/verification/delivery;
- отсутствие preview;
- отсутствие handoff packet;
- неполный evidence trail.

---

# 29. Новое definition of done

С этого момента задача по autonomous loop считается завершённой только если одновременно:

1. пользователь дал один prompt в unified shell;
2. система сама прошла весь orchestration loop;
3. не было required manual stage progression;
4. preview поднят и достижим;
5. handoff pack собран;
6. control plane показывает весь run;
7. validation это доказал.

Если хотя бы один пункт не выполнен, работа не завершена.

---

# 30. Самая короткая инструкция для нового агента

Если времени мало, агент должен помнить только это:

> Один prompt в shell.  
> Ноль обязательных ручных кликов между стадиями.  
> Full control plane telemetry обязателен.  
> Preview обязателен.  
> Handoff pack обязателен.  
> Manual staged flow больше не считается end-to-end.
