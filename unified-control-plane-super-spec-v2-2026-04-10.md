# Unified Control Plane for AI/Agent Workflows
## Product / UX / System Design Spec + MVP TЗ

**Date:** 2026-04-10  
**Author:** OpenAI GPT-5.4 Pro  
**Status:** Draft spec for architecture / UX / implementation planning

---

## 0. Framing

Этот документ собирает **не новую абстрактную идею**, а **операционную систему поверх уже существующих направлений**:

- `FounderOS` как кандидат на роль **главного shell / operator-facing control plane**
- `cabinet` как **UX reference**, особенно по спокойной информационной архитектуре, сайдбару, агентно-сессионной модели и ощущению “watch the team work”
- локальный `open-webui` как **Hermes-first adaptation**, который **нельзя размыть редизайном ради редизайна**
- `Codex/Codext CLI` и app/server event mechanics как **реальный machine-readable substrate** для rich transcript / execution UI
- multi-account / quota / failover / fail-safe orchestration как отдельный control-plane concern

### Ключевая позиция

Нужен **не generic AI dashboard**, а **unified operator experience** для many projects / many sessions / many accounts / many automation surfaces.

### Важные исходные ограничения

1. **Не переписывать всё.**  
   Нужно усиливать already-working seams.

2. **Не делать FounderOS “ещё одним приложением”.**  
   Он должен стать shell и coordination surface.

3. **Не превращать Open WebUI в глобальный control shell.**  
   Его правильная роль — chat/workspace/session module внутри большей оболочки.

4. **Не делать quota/router state единственным truth-слоем.**  
   Нужно разделить:
   - upstream quota truth
   - internal schedulable capacity
   - observed operational health

5. **Не рендерить CLI как “грязный терминал”.**  
   Structured events должны подниматься в calm, scan-friendly UI.

### Что важно честно зафиксировать

Локальный проект `/Users/martin/open-webui` **не был напрямую доступен для code-level audit из текущей среды**, поэтому решения по его роли сделаны **на основе заданных продуктовых ограничений**, а не на основе полного ревью конкретной локальной реализации.

---

# 1. Executive summary

## 1.1 Самое правильное общее product direction

**FounderOS должен стать главным unified shell / operator-facing control plane.**

Но это не означает, что FounderOS должен:
- съесть все UX-поверхности,
- заменить Open WebUI как chat product,
- превратить execution/transcript surfaces в ещё один перегруженный dashboard.

Правильная модель такая:

- **FounderOS = global shell / operator control plane**
- **Hermes-first Open WebUI = embedded session/chat/workspace surface**
- **Codex/Codext CLI + app-server + session history = execution substrate**
- **Autopilot / Quorum / quota adapters = source systems**
- **Shell read model = normalized control-plane view**

## 1.2 Главный архитектурный тезис

Нельзя пытаться сделать один “супер-объект”, который одновременно:
- chat UI,
- execution runtime,
- orchestration engine,
- quota truth,
- project workspace,
- review queue,
- analytics dashboard.

Это приводит к хаосу.

Вместо этого нужен **layered control plane**:

1. **Source systems**
   - Quorum
   - Autopilot
   - Codex/Codext runtimes
   - Chat/account/quota sources

2. **Normalization + control-plane read model**
   - session state
   - group state
   - account capacity state
   - attention/recovery state
   - transcript event model

3. **Shell**
   - FounderOS navigation
   - scope management
   - operator flows
   - global command layer

4. **Embedded operational modules**
   - Hermes/Open WebUI
   - event timeline
   - review / approvals / handoffs
   - account capacity board
   - project/session workspace

## 1.3 Главная UX позиция

Пользовательский опыт должен быть не “dashboard first”, а **workflow first**:

- сначала **что запущено / где внимание / что делать дальше**
- потом **в какой project / session / group войти**
- затем **спокойная transcript/workspace surface**
- только после этого — deep telemetry

То есть правильная иерархия:

**attention → scope → session/workspace → transcript → deep telemetry**

а не

**metrics cards → charts → tabs → hidden session reality**

## 1.4 Как объединять FounderOS / Open WebUI / Hermes / execution surfaces

### Рекомендуемая продуктовая композиция

- **FounderOS**
  - root app
  - routing shell
  - command palette
  - account/session/group switching
  - cross-project overview
  - review / approvals / handoffs / events / operators
  - global attention lane

- **Open WebUI Hermes-first adaptation**
  - active conversation surface
  - rich chat UX
  - operator-assisted task steering
  - thread-local workspace affordances
  - session-local context management

- **Codex/Codext execution substrate**
  - structured events
  - session persistence
  - transcript continuity
  - command/file/tool/reasoning phases
  - worktree/workspace semantics

### Итоговая формула

> FounderOS should own the shell.  
> Hermes/Open WebUI should own the rich conversation workspace.  
> Codex/Codext should provide the execution substrate.  
> The control plane should normalize and orchestrate between them.

---

# 2. Quota/account source-of-truth analysis

## 2.1 Сначала важно разделить 3 разных понятия

### A. Quota truth
Это ответ на вопрос:

> “Какой официальный remaining usage / rate limit / reset window сейчас у аккаунта?”

### B. Schedulable capacity
Это ответ на вопрос:

> “Можно ли прямо сейчас безопасно и эффективно запустить на этом аккаунте ещё одну сессию?”

### C. Operational health
Это ответ на вопрос:

> “Насколько этот аккаунт / auth-path / session path сейчас стабилен в реальной работе?”

Эти три вещи нельзя смешивать в одну цифру.

---

## 2.2 Возможные способы получать quota / limit информацию

### Способ 1. Official app-server rate limits surface
**Рекомендация: основной canonical quota source**

Использовать официальный app-server surface, где доступны:
- auth state
- account identity
- ChatGPT account metadata
- rate limits
- rate limit updates

Это наиболее близко к тому, что тебе нужно:
- по уже существующей auth-модели
- без обязательного router/load balancer как source of truth
- с upstream semantics
- в machine-readable виде

### Что он даёт

Нормально использовать как canonical read:
- `usedPercent`
- `windowDurationMins`
- `resetsAt`
- `limitId`
- multi-bucket `rateLimitsByLimitId`

### Когда это особенно хорошо
- когда ты используешь ChatGPT-authenticated Codex account
- когда нужен near-real-time operator visibility
- когда хочешь не скрапить UI и не парсить stderr

### Ограничение
Это **официально документированный surface**, но не в том же классе стабильности, что long-lived public production REST API.  
Нужно считать его **официальным, но operationally guarded**.

---

### Способ 2. `/status` внутри активной Codex session
**Рекомендация: good UX telemetry, not canonical machine source**

Плюсы:
- official user-facing signal
- показывает context / status / rate limits
- полезен для session-local visibility

Минусы:
- это thread/session-local interaction surface
- не самый хороший canonical source для external control plane
- неудобен как fleet-level aggregator
- чаще подходит как backup / runtime inspection path

Итог:
- использовать как UX-visible corroboration
- не делать главным quota truth API

---

### Способ 3. Codex usage dashboard
**Рекомендация: official human source, not control-plane API**

Плюсы:
- официальный источник для человека
- подходит для manual verification
- полезен для ops sanity-check

Минусы:
- это не control-plane integration surface
- не подходит как programmatic canonical input
- легко превращается в brittle scraping trap

Итог:
- использовать как manual reference / debugging reference
- не использовать как canonical system input

---

### Способ 4. Parsing CLI output / stderr / terminal text
**Рекомендация: fallback only**

Плюсы:
- может сработать быстро
- иногда не требует дополнительных интеграций

Минусы:
- хрупко
- зависит от formatting drift
- плохо масштабируется на multi-account / multi-session control plane
- легко ломается version changes

Итог:
- только fallback
- не source of truth
- не база архитектуры

---

### Способ 5. Infer limits from 429 / UsageLimitExceeded / reset hints
**Рекомендация: reactive operational fallback**

Плюсы:
- реально полезно
- отражает observed truth в бою
- помогает scheduler-у

Минусы:
- это уже post-factum signal
- не proactive
- не всегда даёт полный remaining picture
- не заменяет upstream quota read

Итог:
- обязательно собирать
- использовать как operational overlay
- не путать с quota truth

---

### Способ 6. Router / load balancer (`codex-lb`) как quota source
**Рекомендация: не делать canonical quota source**

Плюсы:
- easy centralization
- можно агрегировать observed failures
- удобно для scheduling heuristics

Минусы:
- легко превратить derived estimate в “истину”
- router видит не всё
- любые локальные ошибки начинают маскироваться под quota reality
- появляется ложная архитектурная централизация

Итог:
- router может быть **capacity coordinator**
- router не должен быть **canonical quota truth**

---

## 2.3 Надёжность путей

| Способ | Официальность | Надёжность | Ломкость | Роль в архитектуре |
|---|---|---:|---:|---|
| App-server rate limits | Высокая | Высокая/средняя | Средняя | **Canonical quota source** |
| `/status` | Высокая | Средняя | Низкая/средняя | Session-local telemetry / fallback |
| Usage dashboard | Высокая | Для человека высокая | Высокая для automation | Manual verification |
| CLI text parsing | Низкая | Низкая | Высокая | Emergency fallback |
| 429 / UsageLimitExceeded / reset hints | Средняя | Средняя | Средняя | Operational overlay |
| Router-derived estimates | Внутренняя | Средняя | Средняя | Scheduler-only derived state |

---

## 2.4 Что брать как canonical source

### Рекомендация

**Canonical quota source = upstream official rate-limit read surface через Codex app-server protocol.**

Но с важной формулировкой:

> canonical quota source != canonical execution scheduler

То есть:
- quota truth приходит из upstream
- schedulable capacity вычисляется внутри control plane

---

## 2.5 Рекомендуемая fallback hierarchy

### Tier 1 — Canonical upstream quota truth
Использовать:
- account identity
- rate limit buckets
- reset windows
- usage percent
- rate limit update notifications

### Tier 2 — Session-local verification
Использовать:
- `/status`
- thread-local context/rate signals
- session token usage / current turn state

### Tier 3 — Reactive operational signals
Использовать:
- `UsageLimitExceeded`
- upstream HTTP failures
- retry bursts
- auth refresh churn
- 429 windows
- reset hints

### Tier 4 — Internal derived estimation
Использовать:
- observed cooldown
- recent success rate
- per-account concurrency pressure
- active session count
- routing backoff score

---

## 2.6 Самая важная архитектурная рекомендация по quota

В control plane должны существовать **два разных объекта**:

### `AccountQuotaSnapshot`
Официальное чтение из upstream.
Поля:
- `account_id`
- `account_label`
- `auth_mode`
- `plan_type`
- `limit_buckets[]`
- `used_percent`
- `reset_at`
- `last_verified_at`
- `source = upstream_app_server`
- `confidence = official`

### `AccountCapacityState`
Derived state для scheduler/operator UX.
Поля:
- `schedulable`
- `cooldown_until`
- `recent_429_count`
- `recent_auth_failures`
- `active_sessions`
- `preferred_for_new_work`
- `failover_rank`
- `observed_health`
- `confidence = derived`

Только так можно избежать ложной архитектуры.

---

## 2.7 Практический вывод

### Что делать
- строить **тонкий quota adapter** к official rate-limit surface
- хранить snapshots отдельно от scheduling state
- делать capacity scoring поверх quota + observed runtime signals
- показывать оператору и **официальный лимит**, и **операционную пригодность**

### Чего не делать
- не считать `codex-lb` единственным truth
- не парсить `/status` как главный API
- не скрапить dashboard
- не смешивать “осталось 40%” с “можно запускать ещё 3 тяжёлые сессии”

---

# 3. System architecture recommendation

## 3.1 Архитектурный принцип

Нужна **federated system architecture with shell-owned read model**.

Это означает:
- origin state остаётся в source systems
- shell не подменяет Quorum/Autopilot
- shell нормализует read-side и operator actions
- transcript/event rendering живёт отдельным слоем от business state

---

## 3.2 Рекомендуемые системные слои

```text
┌─────────────────────────────────────────────────────────────┐
│                    FounderOS Unified Shell                 │
│  navigation • command layer • review • control plane      │
└─────────────────────────────────────────────────────────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
     ┌────────────────┐ ┌──────────────┐ ┌────────────────────┐
     │ Shell Read     │ │ Action /     │ │ Embedded Modules   │
     │ Model /        │ │ Mutation     │ │ Hermes/OpenWebUI   │
     │ Snapshots      │ │ Seams        │ │ Transcript Surface │
     └────────────────┘ └──────────────┘ └────────────────────┘
                │            │            │
                └──────┬─────┴──────┬─────┘
                       │            │
                       ▼            ▼
        ┌────────────────────────┐  ┌────────────────────────┐
        │ Domain Source Systems  │  │ Runtime / Event Inputs │
        │ Quorum                 │  │ Codex CLI JSON         │
        │ Autopilot              │  │ Codex app-server       │
        │ Handoff bridge         │  │ auth/quota adapter     │
        └────────────────────────┘  └────────────────────────┘
```

---

## 3.3 Где какой “plane”

### A. Execution plane
Системно execution plane уже живёт вокруг:
- Autopilot runtime
- project/intake/approvals/issues/audits/handoffs/events/agents
- execution review lane
- live execution events

**Рекомендация:** не переносить execution plane в новый объект.  
Нужно **расширить и соединить**, а не перепридумывать.

### B. Discovery/orchestration plane
Это остаётся вокруг Quorum и discovery-owned semantics.

**Рекомендация:** не flatten discovery в “Ideas tab внутри dashboard”.  
Discovery должен остаться самостоятельной plane-поверхностью, но shell-owned.

### C. Chat / session execution plane
Это отдельный слой, где живут:
- thread/session lifecycle
- transcript rendering
- tool/command/file events
- reasoning/plan stages
- workspace chat UX

**Рекомендация:** этот слой должен подключаться в shell как embedded module.

---

## 3.4 Где должен жить каждый state domain

### Account state
**Где хранить:** control-plane service / shell read model  
**Откуда брать:** upstream quota adapter + auth adapter + observed runtime signals

Содержит:
- account identity
- auth mode
- plan
- quota buckets
- health/cooldown
- account-switch history
- current assignment

### Session state
**Где хранить:** normalized shell read model + source runtime link  
**Откуда брать:** CLI/app-server events, persisted session metadata, `.codex` continuity

Содержит:
- session id
- thread id
- current status
- current project/workspace
- bound account
- mode (local/worktree/cloud etc. если применимо)
- timestamps
- active turn
- pending approvals
- latest summary
- attached transcript stream reference

### Transcript state
**Где хранить:** dedicated transcript/event store or append-only event stream with materialized thread view  
**Не смешивать** с project/account state

Содержит:
- ordered turn events
- item lifecycle
- agent messages
- command outputs
- tool calls
- file changes
- diffs
- summaries
- rendering hints

### Workspace state
**Где хранить:** per project/worktree/workspace registry  
Содержит:
- repo path
- worktree identity
- branch
- dirty state
- linked sessions
- file focus
- active terminal(s)

### Group state
**Где хранить:** shell/control-plane model  
Содержит:
- session group id
- member sessions
- goal / shared task
- aggregate status
- leader session
- failover mapping
- completion policy
- escalation rules

### Recovery state
**Где хранить:** control-plane model  
Содержит:
- retry count
- last failure class
- last recovery action
- fallback account used
- manual intervention required
- quarantine flag

---

## 3.5 Нормализованный domain model

Рекомендуемый набор first-class entities:

- `Project`
- `Workspace`
- `Session`
- `SessionGroup`
- `Task`
- `Turn`
- `ThreadItem`
- `ToolActivity`
- `CommandRun`
- `FileChange`
- `ApprovalRequest`
- `RecoveryAction`
- `Account`
- `AccountQuotaSnapshot`
- `AccountCapacityState`
- `AttentionRecord`
- `Handoff`
- `ExecutionBrief`

---

## 3.6 Рекомендуемый control-plane backend shape

### Слой A. Source adapters
- `quorum-adapter`
- `autopilot-adapter`
- `codex-cli-adapter`
- `codex-app-server-adapter`
- `quota-auth-adapter`
- `workspace-adapter`

### Слой B. Normalization
- event normalization
- identity resolution
- session/account/project linking
- canonical enums
- dedupe / replay handling

### Слой C. Read models
- project overview model
- session detail model
- session group model
- account capacity model
- operator attention model
- review queue model
- event timeline model

### Слой D. Action layer
- start session
- resume session
- attach workspace
- rebind account
- retry / recover
- approve / decline
- quarantine / unquarantine
- open in Hermes/Open WebUI
- open source plane route

---

## 3.7 Рекомендуемый ingestion pipeline

### Ingest input types
1. structured CLI JSONL
2. app-server notifications
3. source-plane snapshots
4. account/rate-limit updates
5. shell-owned manual actions
6. filesystem/session continuity info (`.codex` world)
7. optional router-derived runtime observations

### Event normalization stages
1. **raw_event**
2. **validated_event**
3. **normalized_event**
4. **materialized_session_view**
5. **operator attention derivation**

### Почему это важно
Потому что transcript rendering и operator dashboarding — разные задачи:
- transcript требует ordered fidelity
- control plane требует summarized state

---

## 3.8 Suggested storage split

### Append-only event store
Для:
- raw CLI/app-server events
- replay
- debugging
- auditability

### Materialized operational tables
Для:
- sessions
- session groups
- accounts
- workspaces
- approvals
- attention
- recoveries

### Source-linked documents / contracts
Для:
- execution brief
- handoff context
- task summary
- session synopsis

---

## 3.9 Golden architectural rule

**FounderOS should aggregate, not usurp.**

То есть:
- Quorum остаётся source of truth для discovery semantics
- Autopilot остаётся source of truth для execution semantics
- upstream rate limit surface остаётся source of truth для quota semantics
- shell становится source of truth только для:
  - normalized operator read model
  - cross-plane scope
  - UI state
  - derived attention/capacity/recovery logic

---

# 4. UX architecture recommendation

## 4.1 Главная UX цель

Интерфейс должен быть:
- power-user friendly
- calm
- scanable
- scope-aware
- multi-project
- multi-session
- not visually panicked
- useful before beautiful, but still elegant

---

## 4.2 Основной UX паттерн

### Неправильная модель
“Открывается dashboard, на нём 28 карточек, 9 графиков, 4 tabs, потом где-то внутри можно найти сессию.”

### Правильная модель
“Открывается shell, ты сразу понимаешь:
- где есть attention
- какие группы/проекты живы
- какие аккаунты под давлением
- что можно продолжить
- куда провалиться на один клик”

---

## 4.3 Surface areas

Ниже — рекомендуемое разделение поверхности.

### 1. Navigation layer
Постоянная оболочка.

Содержит:
- top-level sections
- collapsible scoped side nav
- project/group/session quick switch
- command palette
- global search / quick-open

### 2. Global control layer
Тонкая, но всегда доступная operator strip.

Содержит:
- health summary
- account capacity strip
- active group count
- blocked sessions
- pending approvals
- failover / degraded indicators

### 3. Project/workspace layer
Контекст текущего проекта.

Содержит:
- repo / worktree / workspace identity
- linked sessions
- branch
- dirty status
- last activity
- active terminals / commands
- open-in-chat / open-in-events / open-in-review actions

### 4. Session/group layer
Основной объект оркестрации.

Содержит:
- session list
- grouped sessions
- status
- owner account
- recovery state
- task summary
- current phase
- latest event summary

### 5. Chat/transcript layer
Спокойная execution surface.

Содержит:
- messages
- plan
- tool activity
- command blocks
- file changes
- approvals
- summaries
- thread-local actions

### 6. Operational telemetry layer
Расширяемая detail surface.

Содержит:
- event timeline
- raw logs
- tool details
- command stdout/stderr
- retry history
- rate limit details
- auth refresh history

---

## 4.4 FounderOS как shell

Это главный UX-вывод:

**FounderOS должен быть оболочкой, а не только отдельным “экраном execution/discovery”.**

### Почему
Потому что у него уже органически есть:
- unified shell frame
- scoped routing
- command palette / quick actions
- cross-plane dashboard
- review lane
- execution breakdown by work type
- shell-owned seams

### Что это означает UX-практически
FounderOS должен владеть:
- top nav
- left scoped nav
- global attention
- route scope
- open/continue/start patterns
- global search/command actions
- review and control surfaces

---

## 4.5 Что заимствовать из cabinet

**Не UI-клон. Не visual clone. А UX grammar.**

### Что стоит взять

#### A. “Watch the team work”, а не “enterprise software”
Очень важный тон.
Оператор должен чувствовать, что он:
- наблюдает живые процессы,
- вмешивается по необходимости,
- видит work objects,
- не тонет в корпоративном BI-шуме.

#### B. Calm, resizable, collapsible sidebar
Хороший control plane обязан хорошо жить в:
- постоянном левом navigation rail,
- scoped sub-nav,
- длительной работе в одном окне.

#### C. Sessions as primary activity history
Cabinet правильно тяготеет к тому, что activity log = sessions/runs, а не абстрактный feed.

Для тебя это особенно верно.

#### D. Object grouping by ownership
Например:
- jobs under agent
- sessions under agent
- workspace near output

В твоём случае аналог:
- sessions under project/group
- workspaces under project
- approvals under execution/review
- account assignments near sessions/groups

#### E. Detail pages with vertical local nav
На сложных сущностях полезно:
- summary
- sessions
- tools
- approvals
- history
не в таб-хаосе наверху, а в локальном vertical nav.

---

## 4.6 Что НЕ заимствовать из cabinet

- не переносить буквально “startup OS” метафору
- не переносить KB-first model как корень всего интерфейса
- не flatten execution в agent cards + sessions only
- не тянуть Cabinet style туда, где нужен Codex-quality execution UX
- не делать file-tree/knowledge-tree главным root object для operator plane

Cabinet — reference на спокойствие, структуру и object ergonomics, а не template всего продукта.

---

## 4.7 Что сохранить от Open WebUI

Это критически важно.

Open WebUI adaptation должен оставаться:
- узнаваемым
- chat-first внутри своей поверхности
- не растворённым в dashboard language
- не обвешанным лишним chrome
- не превращённым в “ещё один admin panel view”

### Что сохранять
- message-centric composition
- composer primacy
- conversational mental model
- familiar visual identity
- lightweight interaction rhythm

### Что добавлять поверх
- better session context
- linked workspace / project awareness
- session-level operational chips
- open-in-control-plane / open-in-events / open-in-workspace actions
- Hermes capabilities
- richer stateful orchestration affordances

---

## 4.8 Где проходит граница между chat UX и operator UX

### Chat UX
Фокус:
- разговор
- task steering
- iteration
- local context
- reviewing outputs in flow

### Orchestration UX
Фокус:
- many sessions
- many accounts
- many projects
- grouping
- progress / retries / recoveries / switching

### Workspace UX
Фокус:
- files / diffs / terminal / branch / worktree / artifact adjacency

### Operator control plane UX
Фокус:
- overview
- triage
- routing
- escalation
- capacity
- approvals
- attention

### Правильная композиция
Они должны быть **связаны deep links and shared context**, но **не смешаны в одну плоскость**.

---

## 4.9 Recommended shell layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Top bar: scope switcher · command palette · global alerts · account │
├───────────────┬──────────────────────────────────────┬───────────────┤
│ Left nav      │ Main operational surface             │ Right drawer  │
│               │                                      │               │
│ - Dashboard   │ depends on route:                    │ contextual    │
│ - Inbox       │ - project overview                   │ telemetry /   │
│ - Discovery   │ - group board                        │ approvals /   │
│ - Execution   │ - session detail                     │ capacity /    │
│ - Review      │ - Hermes chat surface                │ logs / diff   │
│ - Portfolio   │ - events timeline                    │               │
│ - Settings    │ - review queue                       │               │
├───────────────┴──────────────────────────────────────┴───────────────┤
│ Bottom strip: health · quota · active sessions · failures · retries │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4.10 UX principle checklist

### Всегда visible
- current scope
- current project/group/session
- whether action is safe / blocked / degraded
- account capacity pressure
- pending approvals / blockers

### Never dominant by default
- raw logs
- verbose event spam
- rate limit details
- deep audit payloads

### One-click reachable
- latest blocked session
- resume session
- switch account
- retry on fallback account
- open transcript
- open diff/workspace
- open source-plane route

---

# 5. CLI-to-UI rendering model

## 5.1 Основной тезис

**CLI output should not be rendered as terminal text. It should be rendered as typed UI primitives.**

Structured events — это уже достаточный substrate, чтобы получить UX, который ощущается ближе к нативному Codex app, чем к лог-стриму.

---

## 5.2 Rendering philosophy

### What users need
Не “все события подряд”.
Им нужно:
- понять, что делает агент
- где он сейчас
- что он уже сделал
- где нужна помощь
- какие были команды/инструменты
- что изменилось в workspace
- что пошло не так

### Therefore
Каждое event family должно map'иться не в raw row, а в **semantic block**.

---

## 5.3 Event family → UI primitive mapping

| Event family | UI primitive | Default visibility | Expandability |
|---|---|---|---|
| `thread.started` | Session header / new session chip | visible | no |
| `turn.started` | Turn boundary | subtle | no |
| `turn/plan/updated` | Plan block / checklist | visible | expandable |
| `item/agentMessage/delta` | Streaming message block | visible | no |
| `agentMessage phase=commentary` | Commentary bubble / muted narrative | visible | collapsible |
| `agentMessage phase=final_answer` | Final answer block | emphasized | no |
| `item/reasoning/*` | Reasoning summary capsule | compact | expandable |
| `item/commandExecution/*` | Command card with log tail | compact-visible | expandable |
| `item/fileChange/*` | Diff/change card | compact-visible | expandable |
| `mcp/dynamic/collab tool calls` | Tool activity card | compact-visible | expandable |
| `turn/diff/updated` | Diff summary strip | visible if non-empty | open drawer |
| `thread/tokenUsage/updated` | footer telemetry / usage chip | peripheral | details drawer |
| quota/account switch events | account state chip / operator lane event | peripheral | details drawer |
| `turn.failed` / `error` | failure callout | visible | expandable |
| recovery/retry | recovery timeline item | visible if relevant | expandable |

---

## 5.4 Recommended transcript composition

### Level 1. Calm primary flow
Видно сразу:
- user prompt
- agent messages
- current plan
- command cards with short summaries
- file change summaries
- important failures / approvals

### Level 2. Operational expansion
По клику:
- stdout/stderr
- tool arguments
- detailed payloads
- full diff
- retries
- raw event data

### Level 3. Debug / audit mode
Отдельный mode/drawer:
- raw event stream
- sequence ids
- timestamps
- transport metadata
- replay diagnostics

---

## 5.5 Agent messages

### Commentary messages
Рендерить как:
- спокойные narrative blocks
- smaller emphasis than final answer
- grouped if cadence high
- optionally collapsible when command-heavy turn

### Final answer
Рендерить как:
- завершённый answer card
- stronger hierarchy
- anchored summary for the turn
- action affordances near it:
  - retry
  - continue
  - branch/fork
  - open diff
  - open workspace

---

## 5.6 Tool calls

### Требование
Tool calls не должны превращать transcript в telemetry dump.

### Правильная модель
Каждый tool call — compact block:
- icon/type
- title
- state
- summary
- duration
- open details

Примеры:
- `Web search · completed · 3 sources`
- `MCP: Linear · completed · 2 issues fetched`
- `Dynamic tool · failed · permission denied`

### Группировка
Если много tool calls подряд:
- group by phase
- show compact stack
- allow expand all

---

## 5.7 Command executions

Это один из самых важных UX объектов.

### Command card должен показывать
- command preview
- cwd / workspace
- running/completed/failed/declined
- duration
- exit code
- last 2–5 log lines
- approvals if any

### Expand view
- full stdout/stderr tail
- copy command
- rerun / open terminal
- open related files

### Почему это важно
Потому что command execution — bridge между:
- transcript UX
- terminal UX
- workspace UX
- operator UX

---

## 5.8 Retries / recoveries / failover

Это **не message content** в обычном смысле.  
Это operator-visible runtime history.

### Правильный рендер
- subtle timeline entries
- status chips
- inline reason
- link to source failure
- “recovered on account X”
- “retry suppressed by cooldown”
- “manual approval required”

### Неправильный рендер
Обычное сообщение в ленте:
> “Retrying because account 4 got rate-limited…”

Это создаёт transcript noise.

---

## 5.9 Limits / account switches

Также не должны жить как обычные chat messages.

### Правильный рендер
- session header chips
- bottom status rail
- account pill near session identity
- group-level capacity summary
- operator timeline event on meaningful transitions only

Примеры:
- `acct-03 · 74% used · resets in 11m`
- `switched to acct-07 after UsageLimitExceeded`
- `degraded: auth refresh unstable`

---

## 5.10 Grouped sessions

### Почему first-class
Тебе нужен control plane for many sessions, not just single chat threads.

### Рендер группы
- group title / objective
- member sessions count
- current aggregate status
- progress stage
- account spread
- blockers count
- active leader session
- open group board

### Внутри группы
Показывать:
- lead session
- supporting sessions
- retry/fallback relations
- per-session status row
- latest summary per member

---

## 5.11 Phase completions

Очень важная вещь для качества UX.

Нужно explicitly рендерить bounded phases:
- Planning complete
- Research complete
- Command execution running
- Validation passed
- Waiting for approval
- Recovery complete
- Final answer delivered

### Почему
Это резко повышает scanability и ощущение “система держит форму”.

---

## 5.12 Как приблизиться к quality bar Codex app

### Нужно сохранить
- calm thread layout
- clean hierarchy
- scoped terminal/workspace relation
- low-noise status visibility
- transcript continuity
- project/session identity

### Нужно добавить
- multi-session grouping
- cross-project operator shell
- account capacity orchestration
- review / approval / recovery lane
- richer attention model
- stronger routing across planes

### Formula
> Codex-quality session feel + FounderOS shell + operator-grade orchestration

---

## 5.13 Concrete rendering rules

### Rule 1
Если событие не помогает answer вопрос:
> “что происходит сейчас?”
оно не должно занимать много места.

### Rule 2
If event verbosity grows, UI must collapse automatically.

### Rule 3
Every visible event block should answer one of:
- what did agent do?
- what changed?
- what failed?
- what needs attention?
- what can I do next?

### Rule 4
Raw logs belong to drawers, not to the main transcript.

---

# 6. Information architecture

## 6.1 First-class entities in MVP

Ниже — сущности, которые пользователь должен видеть как first-class, а не как скрытые backend ids.

### Core
- Project
- Workspace
- Session
- Session Group
- Account
- Task / Objective

### Operational
- Tool Activity
- Command Run
- Approval
- Recovery State
- Attention Record
- Handoff

### Secondary but visible in detail
- Turn
- Diff
- Event timeline
- Terminal
- Source route
- Linked artifacts

---

## 6.2 Top-level navigation

### Recommended top level
- Dashboard
- Inbox / Attention
- Discovery
- Execution
- Review
- Portfolio
- Settings

### Why this is right
Это уже ближе к существующей FounderOS grammar, чем любая новая IA.

---

## 6.3 Recommended Execution sub-nav

Execution — это и есть ядро operator control plane.

### Рекомендуемые подмаршруты
- Projects
- Sessions
- Groups
- Control Plane
- Events
- Approvals
- Issues
- Handoffs
- Agents
- Accounts (или в Settings/Accounts, но with quick deep link)
- Workspaces

### Практически
Если хочется не раздувать левый nav, то:
- `Sessions`, `Groups`, `Accounts`, `Workspaces` можно сделать secondary local tabs inside Control Plane
- но сущности должны оставаться first-class в data model и quick-open palette

---

## 6.4 Dashboard

Dashboard не должен быть BI page.  
Это должен быть **operator landing route**.

### Что показывать
- active groups
- blocked sessions
- pending approvals
- degraded accounts
- project pressure
- recent failures
- quick resume / quick intervene actions

### Чего не делать
- огромные charts
- слишком много metrics
- hiding actual work objects behind summaries

---

## 6.5 Inbox / Attention

Это critical operator route.

### Содержит
- blocked sessions
- approvals waiting
- budget/quota risk
- workspace conflicts
- retries exhausted
- handoffs awaiting review
- stale sessions that should be resumed or archived

### Why separate from dashboard
Dashboard = overview  
Inbox/Attention = work queue

---

## 6.6 Session IA

### Session detail should include
- session header
- task summary
- account binding
- workspace binding
- status / phase
- transcript
- command/tool timeline
- approvals
- recovery history
- linked diff / files / terminal
- open in Hermes/Open WebUI

### Local nav inside session
- Transcript
- Activity
- Diff
- Workspace
- Approvals
- Recovery
- Raw events

---

## 6.7 Group IA

### Group should have
- group summary
- objective
- child sessions
- aggregate progress
- account distribution
- blockers
- dependencies
- latest summaries
- open all / retry all / pause group / reassign account

### Why this matters
Без group-level IA control plane быстро деградирует в flat list of sessions.

---

## 6.8 Account IA

### Account list view
- account label
- auth mode
- plan
- quota buckets
- health
- active sessions
- cooldown
- preferred/blocked
- recent failures
- switch/failover actions

### Account detail
- quota history
- session assignments
- recent limit events
- auth refresh incidents
- routing decisions
- manual notes/tags

---

## 6.9 Workspace IA

### Workspace detail
- repo path / project root
- worktree / branch
- linked sessions
- dirty state
- recent file changes
- terminal entries
- validation commands
- artifact links

### Key insight
Workspace — не просто metadata.  
Это важный operator object, потому что именно там сходятся:
- commands
- files
- diff
- validation
- branch/worktree isolation

---

## 6.10 Relationships between entities

### Core relationships

- `Project 1:N Workspace`
- `Project 1:N Session`
- `Session N:1 Account`
- `Session N:1 Workspace`
- `Session N:1 SessionGroup`
- `Session 1:N Turn`
- `Turn 1:N ThreadItem`
- `Session 1:N Approval`
- `Session 1:N RecoveryAction`
- `Project 1:N Handoff`
- `AttentionRecord` can attach to:
  - Session
  - Group
  - Account
  - Project
  - Handoff

---

## 6.11 IA rule of thumb

Если сущность:
- frequently scanned,
- routable,
- actionable,
- or needed for triage,

она должна быть **first-class**.

По этому правилу:
- `Session`, `Group`, `Account`, `Approval`, `Workspace` — first-class
- raw JSON event — not first-class

---

# 7. Concrete MVP proposal

## 7.1 MVP goal

Сделать **первый реально рабочий unified control plane**, который:
- уже полезен каждый день,
- не ломает существующие product DNAs,
- не требует giant rewrite,
- создаёт правильную платформу для Phase 2/3.

---

## 7.2 Что брать за основу прямо сейчас

### As-is foundation
- **FounderOS shell**
- existing execution/discovery/review route model
- shell command palette / route scope
- existing execution surfaces (events/review/agents/attention concepts)
- Hermes/Open WebUI adaptation as session module
- Codex CLI JSON events
- `.codex` session continuity
- upstream account rate limits surface
- current multi-account orchestration logic

---

## 7.3 MVP product shape

### The MVP should be:
**FounderOS shell + Control Plane route + embedded Hermes session surface + normalized session/account/group model**

### Core routes in MVP
1. `/dashboard`
2. `/inbox`
3. `/execution`
4. `/execution/control-plane`
5. `/execution/events`
6. `/execution/approvals`
7. `/execution/groups`
8. `/execution/sessions`
9. `/settings/accounts`

При этом:
- Hermes/Open WebUI может открываться как:
  - embedded panel inside session detail
  - full-height dedicated session route under shell
  - pop-out route with shell context preserved

---

## 7.4 MVP feature set

### Must-have

#### 1. Session registry
- list all active/recent sessions
- show current state
- bind project/workspace/account
- resume/open session

#### 2. Session transcript renderer
- render structured CLI/app-server events
- clean message/tool/command/file blocks
- show phase boundaries
- show failures cleanly
- show summary and final answer

#### 3. Group model
- create/view groups
- attach sessions to group
- aggregate status
- show blockers and progress

#### 4. Account capacity view
- show quota truth
- show derived schedulability
- show active assignments
- show cooldown/degraded states
- surface failover eligibility

#### 5. Attention inbox
- approvals
- blocked sessions
- quota-exhausted sessions
- failed recoveries
- stale sessions

#### 6. Workspace linkage
- show repo/worktree/branch per session
- link command executions and file changes to workspace
- quick open diff/workspace

#### 7. Recovery controls
- retry
- rebind account
- pause
- quarantine
- resume

---

## 7.5 Nice-to-have but not MVP-blocking

- fancy analytics
- historical trend charts
- automatic group generation heuristics
- advanced cross-session comparison views
- elaborate planning visualizations
- fully generalized pluggable provider dashboard
- giant configuration center
- bespoke visual redesign of Open WebUI

---

## 7.6 What not to build in Phase 1

### Do not build
- universal agent marketplace
- one giant cross-provider abstraction layer
- custom visual design system rewrite
- full replacement of Open WebUI
- custom terminal emulator if current substrate already exists
- fully autonomous router brain with opaque policies
- complex graph visualizations as default UX

### Why
Потому что всё это съедает время и размывает core operator value.

---

## 7.7 Recommended MVP implementation order

### Slice 1 — canonical visibility
- session registry
- account capacity
- control-plane overview
- event ingestion
- basic transcript mapping

### Slice 2 — actionable orchestration
- group model
- recovery actions
- approvals lane
- workspace linkage

### Slice 3 — integrated conversation surface
- embedded Hermes/Open WebUI
- deep links between transcript, workspace, events, review
- session continuity polish

---

## 7.8 MVP success criteria

MVP считается удачным, если оператор может из одного места:

1. увидеть все активные и недавно завершённые сессии
2. понять, какие из них требуют внимания
3. понять, какие аккаунты доступны или под давлением
4. открыть конкретную сессию и увидеть clean transcript
5. увидеть tool/command/file activity without log noise
6. продолжить, retry, reassign или quarantine сессию
7. работать сразу с несколькими проектами и группами
8. не терять Open WebUI/Hermes chat ergonomics

---

# 8. Risks / anti-patterns

## 8.1 Anti-pattern: generic AI dashboard

### Как выглядит
- всё сведено к cards and charts
- реальные sessions buried
- “projects / agents / runs / logs / usage / tasks / files / prompts” вперемешку
- красиво на Dribbble, бесполезно в ops

### Как избежать
- держать first-class work objects
- dashboard only as overview
- routing to actual operational surfaces within one click

---

## 8.2 Anti-pattern: flattening source-plane semantics

### Как выглядит
- Quorum и Autopilot превращаются в одинаковые generic “data sources”
- discovery / execution distinctions стираются
- shell начинает врать о системе

### Как избежать
- explicit source ownership
- shell-owned seams, not shell-owned semantics
- discovery and execution stay named planes

---

## 8.3 Anti-pattern: Open WebUI identity erosion

### Как выглядит
- chat surface превращается в widget inside admin product
- message composer теряет приоритет
- слишком много telemetry chrome вокруг каждого сообщения

### Как избежать
- clear chat mode boundaries
- retain Open WebUI visual DNA
- embed operational controls around, not inside every chat atom

---

## 8.4 Anti-pattern: transcript as raw event log

### Как выглядит
- пользователь видит JSON-ish noise
- tool spam ломает чтение
- command outputs раздувают thread
- fails hard at scale

### Как избежать
- semantic rendering
- summary-first
- collapse by default
- drawers for detail
- clear phase boundaries

---

## 8.5 Anti-pattern: quota == scheduler truth

### Как выглядит
- “у аккаунта 60% осталось, значит на него можно отправить тяжёлую группу”
- ignores 429s, auth churn, session congestion

### Как избежать
- separate quota snapshot from capacity state
- show both explicitly
- schedule from derived capacity, not raw quota percent

---

## 8.6 Anti-pattern: single-plane mental model

### Как выглядит
Пытаются сделать один root object для:
- sessions
- projects
- chats
- workspaces
- accounts
- approvals
- ideas

### Как избежать
- shell owns navigation and scope
- routes own detailed semantics
- entity relations explicit
- avoid forcing one universal container metaphor

---

## 8.7 Anti-pattern: over-automated orchestration opacity

### Как выглядит
- account switching happens invisibly
- recovery logic impossible to inspect
- operator loses trust

### Как избежать
- every recovery action is explainable
- every account switch visible in timeline
- manual override always available

---

## 8.8 Anti-pattern: “beautiful but slow”

### Как выглядит
- heavy layout
- too much client-only rendering
- laggy session lists
- jittery telemetry

### Как избежать
- server-seeded shell routes where possible
- polling or subscriptions only where needed
- materialized read models
- progressive disclosure

---

# 9. Optional phased roadmap

## Phase 1 — Shell-native control plane baseline

### Goal
Собрать одну рабочую operator оболочку.

### Scope
- FounderOS as root shell
- session registry
- account capacity board
- basic session detail route
- transcript renderer from structured events
- attention inbox
- simple groups
- settings/accounts

### Result
Оператор уже может работать from one place.

---

## Phase 2 — Deep orchestration + review maturity

### Goal
Усилить execution/ops workflows.

### Scope
- approvals and recovery lane
- account failover policies
- richer group management
- workspace + diff + terminal linking
- deeper execution review integration
- better event/history drilldowns
- Hermes embedding polish

### Result
Control plane становится реально мощным orchestration console.

---

## Phase 3 — Compounding automation surfaces

### Goal
Сделать систему compound, not just observable.

### Scope
- automation templates
- policy engine for routing/recovery
- richer handoff/brief pipelines
- predictive attention
- session summarization across groups
- historical reliability scoring
- optional pluggable provider adapters

### Result
Control plane становится не только интерфейсом наблюдения, но и устойчивым coordination layer.

---

# 10. Detailed MVP TЗ

## 10.1 Product objective

Построить unified control plane для AI/agent workflows, который позволяет оператору:
- запускать и продолжать many sessions across many projects
- видеть grouped execution
- управлять account/quota/capacity
- видеть и понимать progress/errors/recovery
- сохранять high-quality chat/workspace interaction
- не терять visual/product DNA существующих продуктов

---

## 10.2 User roles

### Role A. Operator
Главный пользователь control plane.
Нуждается в:
- обзорности
- triage
- intervention
- multi-session control

### Role B. Builder / Founder
Работает попеременно как operator и как chat/workspace user.
Нуждается в:
- быстрых переходах из overview в conversation
- контроле по нескольким проектам
- continuity between sessions

### Role C. Runtime / automation system
Не человек, но actor в системе.
Нуждается в:
- stable IDs
- clear contracts
- append-only events
- action endpoints

---

## 10.3 Functional requirements

### FR-1. Session inventory
Система должна:
- показывать список активных, недавних, failed, paused, completed sessions
- поддерживать фильтры по project, group, account, status, workspace
- позволять открыть, продолжить и сфокусировать session

### FR-2. Session detail
Система должна:
- показывать transcript
- рендерить structured events семантически
- показывать current phase, latest summary, workspace, account, approvals
- позволять retry / resume / reassign / open workspace / open Hermes

### FR-3. Grouping
Система должна:
- позволять создавать session groups
- прикреплять session к group
- показывать aggregate state
- показывать group blockers и progress
- позволять group-level actions

### FR-4. Accounts and capacity
Система должна:
- показывать official quota snapshot
- показывать derived capacity state
- отображать active session assignments
- отображать cooldown / degraded / quarantined состояния
- поддерживать manual override

### FR-5. Event ingestion
Система должна:
- принимать structured CLI JSON events
- принимать app-server events
- нормализовать их в общий event model
- материализовывать session read model
- поддерживать idempotent replay

### FR-6. Recovery handling
Система должна:
- фиксировать failed turns / usage limit errors / auth failures
- выполнять и логировать retry/rebind/quarantine actions
- показывать оператору объяснимую recovery history

### FR-7. Approvals
Система должна:
- показывать pending approvals
- связывать approval with session/turn/item
- позволять approve/decline/cancel
- показывать outcome

### FR-8. Workspace linkage
Система должна:
- связывать session с workspace/worktree
- показывать branch / dirty state
- показывать command/file changes
- открывать diff/workspace context

### FR-9. Embedded chat surface
Система должна:
- открывать Hermes/Open WebUI surface в shell context
- сохранять session identity and continuity
- не ломать visual identity chat продукта

### FR-10. Attention queue
Система должна:
- собирать items requiring intervention
- поддерживать ordering by severity/urgency
- связывать attention records с projects/sessions/accounts/groups

---

## 10.4 Non-goals

### NFR-NG-1
Не строить universal provider abstraction для всех AI systems на первом этапе.

### NFR-NG-2
Не редизайнить Open WebUI целиком.

### NFR-NG-3
Не переносить весь domain state в shell.

### NFR-NG-4
Не делать analytics-heavy dashboard product.

### NFR-NG-5
Не строить новый router/lb как обязательный центральный мозг quota truth.

---

## 10.5 Data contracts

## Session
```json
{
  "id": "sess_x",
  "thread_id": "thread_x",
  "project_id": "proj_x",
  "workspace_id": "ws_x",
  "group_id": "grp_x",
  "account_id": "acct_x",
  "status": "running",
  "phase": "executing",
  "latest_summary": "Running validation and patching parser",
  "started_at": "2026-04-10T10:00:00Z",
  "updated_at": "2026-04-10T10:12:00Z",
  "source": "codex_cli",
  "recoverability": "automatic"
}
```

## AccountQuotaSnapshot
```json
{
  "account_id": "acct_x",
  "auth_mode": "chatgpt",
  "plan_type": "pro",
  "limit_buckets": [
    {
      "limit_id": "codex",
      "used_percent": 74,
      "window_duration_mins": 15,
      "resets_at": "2026-04-10T10:21:00Z"
    }
  ],
  "source": "upstream_app_server",
  "verified_at": "2026-04-10T10:06:00Z"
}
```

## AccountCapacityState
```json
{
  "account_id": "acct_x",
  "schedulable": true,
  "preferred_for_new_work": false,
  "active_sessions": 3,
  "recent_429_count": 2,
  "cooldown_until": "2026-04-10T10:19:00Z",
  "observed_health": "degraded",
  "reason_codes": ["rate_limit_pressure", "high_concurrency"]
}
```

## AttentionRecord
```json
{
  "id": "attn_x",
  "entity_type": "session",
  "entity_id": "sess_x",
  "severity": "high",
  "state": "needs_approval",
  "title": "Command approval required",
  "summary": "npm test requests broader workspace write",
  "created_at": "2026-04-10T10:10:00Z"
}
```

---

## 10.6 API / adapter requirements

### AR-1. Quota adapter
Должен:
- читать upstream account auth state
- читать rate limits
- подписываться/обновляться на rate limit updates where available
- кешировать last good snapshot
- отличать unavailable from zero

### AR-2. CLI adapter
Должен:
- ingest JSONL
- normalize thread/turn/item events
- capture usage, errors, command/file/tool events
- support resume continuity

### AR-3. App-server adapter
Должен:
- работать с thread/turn/item notifications
- map approvals
- map rate limits
- map token usage
- support auth mode handling

### AR-4. Workspace adapter
Должен:
- resolve repo/worktree/branch
- attach command and file changes
- expose dirty state and recent diffs

### AR-5. Source-plane adapters
Должны:
- приносить summary/state from Quorum and Autopilot
- не терять source ownership
- materialize operator views without flattening semantics

---

## 10.7 UX requirements

### UXR-1
Main shell must remain navigable with keyboard + command palette.

### UXR-2
Primary transcript must remain readable without opening telemetry drawers.

### UXR-3
Session/group/account state must be visually scannable within 3–5 seconds.

### UXR-4
A blocked or failed session must be recoverable from its detail view with <= 2 actions.

### UXR-5
Account capacity pressure must be visible without opening Settings.

### UXR-6
Open WebUI/Hermes surface must preserve chat-first ergonomics.

### UXR-7
Raw event logs must never dominate default session layout.

---

## 10.8 Non-functional requirements

### NFR-1. Explainability
Every automatic recovery/switch/retry must be inspectable.

### NFR-2. Resilience
Partial upstream outage must not blank the shell.
Shell should degrade gracefully.

### NFR-3. Source fidelity
Shell summaries must not rewrite source-plane semantics incorrectly.

### NFR-4. Performance
Control-plane routes must feel instant at navigation level even if telemetry loads progressively.

### NFR-5. Auditability
All recovery/account-switch/approval decisions must be traceable.

### NFR-6. Extensibility
New providers/runtimes should plug into the normalized event/read model without redesigning the shell.

---

## 10.9 Acceptance criteria

### AC-1
Operator can see all active sessions across at least multiple projects from one shell.

### AC-2
Operator can see official quota snapshot and derived capacity state for each account.

### AC-3
Operator can open one session and read a clean transcript with commands/tools/files rendered semantically.

### AC-4
Operator can identify blocked sessions from Inbox/Attention.

### AC-5
Operator can reassign a session to another account and see the action logged.

### AC-6
Operator can open a group and understand aggregate state without visiting every child session.

### AC-7
Operator can jump from control plane into Hermes/Open WebUI without losing project/session context.

### AC-8
Operator can inspect approvals and recoveries from dedicated surfaces.

---

## 10.10 Suggested MVP backlog

### P0
- session registry
- account capacity board
- event normalization
- session detail/transcript
- attention inbox
- basic group model

### P1
- approvals lane
- recovery controls
- workspace linkage
- deep links to Hermes/Open WebUI
- better command/file cards

### P2
- richer account heuristics
- group-level automation
- historical reliability
- predictive attention
- policy engine

---

# 11. Recommended final architecture statement

Если сформулировать в одной фразе:

> Build FounderOS into the unified operator shell, keep Quorum and Autopilot as source planes, treat Hermes/Open WebUI as the embedded conversation workspace, and use Codex structured events plus official upstream rate-limit reads to power a calm, high-fidelity multi-session control plane.

---

# 12. Short implementation memo

Если бы нужно было принять решение прямо сейчас, я бы запускал так:

1. **FounderOS stays the root shell**
2. **Quota truth comes from upstream rate-limit read**
3. **Router keeps only derived capacity logic**
4. **CLI/app-server events normalize into one transcript/event model**
5. **Hermes/Open WebUI becomes the session workspace surface**
6. **Execution control plane gets first-class entities: Session, Group, Account, Workspace, Approval, Recovery**
7. **Dashboard stays thin; Inbox/Attention and Session/Group routes do the real work**

---

# 13. Appendix: one-line decisions

- **Root product object:** FounderOS shell  
- **Canonical quota source:** upstream official rate-limit read surface  
- **Canonical scheduler source:** shell-derived capacity model  
- **Chat/workspace module:** Hermes-first Open WebUI  
- **Execution substrate:** Codex/Codext CLI + app-server events + session continuity  
- **UX reference:** cabinet interaction model, not cabinet UI clone  
- **Main operator objects:** Project, Session, Group, Account, Workspace, Approval, Recovery  
- **Main failure to avoid:** generic AI dashboard syndrome

---

# 14. Source basis used for this spec

This spec was grounded in:

- FounderOS repository structure, README, route/navigation model, execution surfaces, truth matrix, and shell-oriented component structure
- cabinet README, PRD, and sidebar/session/agent information architecture
- OpenAI Codex official documentation for:
  - app-server
  - CLI structured JSON events
  - session resume/continuity
  - app `/status`
  - usage dashboard / current limits
  - feature maturity
  - app features such as multi-project, worktree, and integrated terminal

Note: the local Hermes-first `open-webui` adaptation was not directly code-audited from this environment, so its role in the architecture is specified from the provided product constraints rather than a line-by-line repository review.


---

# 15. V2 deep integration blueprint: how to connect FounderOS + Open WebUI + Hermes WebUI concretely

## 15.1 Прямой ответ на твой главный вопрос: это “одна вкладка” или нет?

**Нет, это не должен быть весь продукт целиком. Но и “просто одна маленькая вкладка” — слишком мало.**

Правильная композиция такая:

- **FounderOS = root shell / operator-facing control plane**
- **Open WebUI adaptation = primary visual language for conversation workspace**
- **Hermes WebUI = behavioral / operational reference for how the conversation workspace should actually work**
- **Codex / CLI / app-server = execution substrate and quota substrate**
- **cabinet = information-architecture and ergonomics reference**

То есть Open WebUI/Hermes fusion — это **не весь root product**, а **first-class route family inside FounderOS**. Не hidden subtool, а одна из главных operational surfaces, в которую оператор входит, когда открывает конкретную session, группу сессий или project-scoped conversation workspace. Это прямо соответствует твоему брифу: FounderOS как operator-facing shell, Open WebUI identity нужно сохранить, а CLI/event substrate нужно превратить в calm UX вместо “грязного терминала”. fileciteturn3file0 fileciteturn3file1 fileciteturn3file2

Почему именно так:

1. В FounderOS уже есть фундамент shell/control-plane продукта: root repo сам описывает себя как release coordinator, где `apps/web` — это `unified shell and operator UI`, а `autopilot` и `quorum` — pinned runtime inputs. citeturn998503view3turn998503view5
2. В FounderOS уже есть mature shell navigation и cross-plane semantics: Dashboard, Inbox, Discovery, Execution, Portfolio, Review, Settings, плюс unified review route и scope-aware navigation. citeturn309909view5turn309911view3turn309911view4turn144274view2turn144274view3
3. Hermes WebUI уже решает именно тот operational interaction layer, которого не хватает чистому Open WebUI: three-panel layout, session projects/tags/archive/pin, tool call cards, approvals, retry/edit/regenerate, context usage footer, workspace browser. citeturn454621view4turn454621view6turn454621view7turn454621view1turn454621view3
4. Open WebUI силён как polished self-hosted AI surface с rich extensibility, file/artifact affordances, tools/functions/pipelines, RBAC и recent Open Terminal/file navigator improvements — но сам по себе он не является тем root operator shell, который тебе нужен. citeturn212084view9turn212084view10turn212084view11turn549950view0turn549950view1

**Итог:**

- FounderOS должен быть **наружной оболочкой и coordination plane**.
- Open WebUI/Hermes fusion должен быть **inner work surface**.
- Это не “ещё одна вкладка в смысле второстепенной функции”, а **главная project/session workspace surface** внутри более широкой оболочки.

---

## 15.2 Репозиторий за репозиторием: кто за что реально должен отвечать

### 15.2.1 FounderOS

**Роль:** главный shell, coordination plane, operator board, review center, route scope, account/capacity view, cross-project control.

На что опираемся в реальном репозитории:

- root repo уже позиционируется как unified shell + pinned runtime topology для `autopilot` и `quorum`; `apps/web` — shell/operator UI, `founderos_contracts/*` — canonical cross-plane contracts. citeturn998503view2turn998503view5
- В навигации уже есть Discovery/Execution/Review/Dashboard и rich child sections. citeturn309909view5
- В shell уже есть route scope persistence через `project_id` и `intake_session_id`, plus scope-aware href helpers. citeturn144274view0turn144274view1turn144274view2turn144274view3
- В shell уже есть review-center, review-pressure, execution-events/live-events, shell SSE hooks и polled snapshot plumbing. citeturn905439view0turn905439view1turn905439view2turn905439view3turn905439view5

**Вывод:** FounderOS не надо “переосмыслять как-нибудь потом”. Его надо **расширять в сторону sessions/accounts/recoveries**, потому что control-plane DNA в нём уже есть.

### 15.2.2 Open WebUI

**Роль:** visual system + message ergonomics + artifact/file/chat polish + potentially hostable workspace shell.

На что опираемся:

- README позиционирует Open WebUI как extensible self-hosted AI platform с tools, pipelines, RBAC, conversations with many models, artifact storage и integrations. citeturn212084view9turn212084view10turn212084view11
- Документация и релиз-ноуты показывают, что Open WebUI особенно силён в file/artifact/browser experience: file navigator history, renaming, port previews, DOCX/XLSX/PPTX preview, tools access to chat-context files, Open Terminal integration. citeturn549950view0turn549950view1turn549950view2turn549950view3
- Но docs очень явно предупреждают: tools/functions/pipelines execute arbitrary Python code on the server; Workspace access нужно ограничивать только trusted admins. citeturn214681view0turn214681view1turn214681view2

**Вывод:**

- От Open WebUI нужно брать **look-and-feel, composition rhythm, file/artifact affordances, chat polish**.
- Но Open WebUI нельзя делать universal root shell для control plane.
- И нельзя бездумно открывать его full plugin surface всем operational пользователям.

### 15.2.3 Hermes WebUI

**Роль:** functional/interaction model для agent workspace.

На что опираемся:

- Hermes WebUI прямо позиционируется как lightweight browser interface with full parity with CLI и three-panel Claude-style layout: left sessions/tools, center chat, right workspace file browsing. citeturn454621view4
- Feature-set почти идеально совпадает с тем, что тебе нужно от session workspace: queue while busy, edit past user message, retry last assistant response, cancel running task, tool call cards, subagent cards, approval cards, context usage indicator, projects/tags/archive/pin, CLI bridge, token/cost display, workspace browser with git badge and resizable right panel. citeturn454621view6turn454621view7turn454621view1turn454621view2turn454621view3
- Архитектура сознательно строится вокруг SSE, not WebSockets, и это полезный паттерн для твоего control plane: browser-friendly, one-way event flow, easy host embedding. citeturn372277view5
- Но Hermes docs также честно признают технические ограничения approval implementation: module-level `_pending` state shared in-process и process-global env vars, что ломается в multi-process/concurrent scenarios. Это нужно **не копировать**, а заменить durable state model. citeturn372277view2

**Вывод:**

- Hermes WebUI нужно использовать как **behavioral/interaction reference and feature source**.
- Но не надо mechanically copy-paste backend constraints Hermes into production control plane.

### 15.2.4 cabinet

**Роль:** UX grammar и information architecture reference.

На что опираемся:

- Cabinet открыто формулирует UX principle: “If it feels like enterprise workflow software, it's wrong. If it feels like watching a team work, it's right.” citeturn678362view2
- В PRD видно very relevant simplification decisions: Mission Control removed, Activity removed, agent sessions become the activity log; left sidebar collapsible; agent detail view uses vertical section navigation; sessions are first-class. citeturn362592view0turn362592view1
- Sidebar/object model из PRD и public site очень полезны именно тебе: collapsible object groups, calm left rail, sessions-as-activity, not “dashboard for dashboard”. citeturn332485view0turn678362view2

**Вывод:** cabinet should shape **how the shell feels**, not what it literally looks like.

---

## 15.3 Формула смешивания: что именно брать от Open WebUI, а что от Hermes

Это важнейшая часть, которую нужно прямо зафиксировать как product contract.

### 15.3.1 Что брать от Open WebUI

Брать:

- визуальную идентичность message-centric AI product
- спокойную chat density
- приятный ритм composer / attachment / message flow
- file/artifact preview feeling
- аккуратную modern self-hosted AI aesthetics
- стриминг, markdown rendering, file-context affordances

Не брать как root model:

- идею, что chat surface = весь продукт
- полный plugin surface как default operator surface
- workspace/tool permissions model без дополнительного контроля

### 15.3.2 Что брать от Hermes WebUI

Брать:

- three-panel layout
- session list semantics
- session projects / tags / archive / pin
- inline tool call cards
- approval cards
- retry/edit/regenerate behaviors
- context usage footer
- workspace browser as right panel
- CLI bridge mental model
- SSE transcript mechanics

Не брать буквально:

- module-level approval storage
- process-global env-var concurrency assumptions
- MVP shortcuts, которые хороши для single-process toy deployment, но плохи для real control plane. citeturn372277view2

### 15.3.3 Что брать от FounderOS

Брать:

- глобальную оболочку
- cross-plane navigation
- route scope and deep links
- dashboard/review/execution separation
- orchestration/control-plane thinking
- multi-project orientation
- shell-admin mutation discipline

### 15.3.4 Что брать от cabinet

Брать:

- object-first sidebar behavior
- collapsible groups
- sessions as activity log
- “watch the team work” tone
- anti-enterprise-workflow bias

### 15.3.5 Фиксированный contract фьюжна

**Open WebUI decides how the inner workspace feels.**

**Hermes decides how the inner workspace behaves.**

**FounderOS decides how the overall system is navigated, monitored, grouped, reviewed, recovered, and capacity-managed.**

Это и есть тот микс, который тебе нужен.

---

## 15.4 Конкретная экранная композиция

### 15.4.1 Top-level shell

```text
FounderOS Shell
├─ Dashboard                → global operator overview
├─ Inbox                    → incoming work / alerts / blockers
├─ Discovery                → idea / research / intake planes
├─ Execution
│  ├─ Projects              → project list and health
│  ├─ Sessions              → session board / groups / queues
│  ├─ Groups                → grouped orchestration lane
│  ├─ Accounts              → quota / capacity / switching
│  ├─ Recoveries            → failures / retries / failover
│  ├─ Events                → rawer timeline / audit lane
│  ├─ Approvals             → pending high-risk actions
│  ├─ Audits                → execution/post-run audit lane
│  └─ Workspace             → deep session workspace entry point
├─ Review                   → unified review center across planes
└─ Settings                 → config / auth / policy / integrations
```

### 15.4.2 Session workspace route

Когда оператор открывает конкретную session или project workspace, shell должен открывать **session workspace surface**, в которой уже работают Open WebUI visual grammar + Hermes behavior.

```text
┌────────────────────────────────────────────────────────────────────┐
│ FounderOS shell top bar                                            │
│ project · group · account · model · quota · approval state         │
├────────────────────────────────────────────────────────────────────┤
│ left project/session rail │ center transcript │ right workspace    │
│                           │                   │                    │
│ cabinet/Hermes logic      │ Open WebUI visual │ Hermes/OpenUI mix  │
│ - projects                │ - messages        │ - files            │
│ - groups                  │ - tool cards      │ - diffs            │
│ - sessions                │ - reasoning cards │ - terminal         │
│ - tags                    │ - composer        │ - approvals        │
│ - filters                 │ - attachments     │ - artifacts        │
├────────────────────────────────────────────────────────────────────┤
│ bottom strip: token usage · quota pressure · runtime health         │
└────────────────────────────────────────────────────────────────────┘
```

### 15.4.3 Что оператор видит, когда он **не** внутри конкретной session

На board surfaces оператор не должен видеть chat-first UI. Он должен видеть:

- session cards / rows
- grouped progress
- accounts / capacity pressure
- failures / recoveries
- project health
- pending approvals
- important phase boundaries

И только при drill-down он попадает в conversation workspace.

---

## 15.5 Выбранный integration pattern: host-aware sidecar, а не full rewrite

### 15.5.1 Почему не надо сразу “вживлять Open WebUI внутрь FounderOS полностью”

Потому что это почти гарантированно приведёт к:

- огромному rewrite scope
- потере upstream compatibility
- расползанию ответственности между shell и chat surface
- поломке того, что тебе уже нравится в Open WebUI

### 15.5.2 Почему не надо навсегда оставаться на тупом iframe

Потому что тогда начнут болеть:

- auth/context handoff
- keyboard shortcuts
- deep linking
- state sync
- host-level actions (retry/reassign/switch account/open review)
- embedded layout polish

### 15.5.3 Практический компромисс: **host-aware sidecar**

Рекомендуемая модель:

1. **Сохраняешь локальный Open WebUI adaptation как отдельный app/runtime**, чтобы не потерять product DNA.
2. FounderOS открывает его в **embedded host mode** под same-origin subpath или controlled route.
3. Open WebUI adaptation в embedded mode:
   - скрывает свой outer chrome,
   - принимает host context,
   - отсылает host events наверх,
   - работает как session workspace module.
4. FounderOS остаётся root owner navigation / control / accounts / groups / review.

Эта схема позволяет идти быстро, параллельно и без giant rewrite.

---

## 15.6 Куда именно встроить это в текущую FounderOS navigation

Судя по текущему navigation model, **самый аккуратный и наименее разрушительный путь** — расширить секцию `Execution`, а не создавать новый top-level section с нуля. У FounderOS уже есть Execution children вроде Projects, Approvals, Audits, Control Plane, Events, Handoffs, Agents. Добавление Sessions / Groups / Accounts / Recoveries выглядит органично и не ломает shell DNA. citeturn309909view5

### 15.6.1 Рекомендуемое расширение `navigation.ts`

```ts
// apps/web/lib/navigation.ts

const executionChildren = [
  { title: "Projects", href: "/execution/projects" },
  { title: "Sessions", href: "/execution/sessions" },
  { title: "Groups", href: "/execution/groups" },
  { title: "Accounts", href: "/execution/accounts" },
  { title: "Recoveries", href: "/execution/recoveries" },
  { title: "Approvals", href: "/execution/approvals" },
  { title: "Audits", href: "/execution/audits" },
  { title: "Control Plane", href: "/execution/review" },
  { title: "Events", href: "/execution/events" },
  { title: "Handoffs", href: "/execution/handoffs" },
  { title: "Agents", href: "/execution/agents" },
];
```

### 15.6.2 Новые route families

```text
/execution/sessions
/execution/sessions/[sessionId]
/execution/groups
/execution/groups/[groupId]
/execution/accounts
/execution/recoveries
/execution/workspace/[sessionId]
```

### 15.6.3 Почему `workspace/[sessionId]` лучше, чем просто `/chat`

Потому что route name должен сразу говорить: это **не просто chat**, это **project/session workspace**, связанный с files, account, tool activity, approvals и operator context.

---

# 16. Concrete fusion contract: Open WebUI visual shell + Hermes operational semantics + FounderOS operator shell

## 16.1 Нельзя просто “смешать два UI” — нужно смешать три разных слоя ответственности

### Layer A — Visual layer (Open WebUI)

Отвечает за:

- message blocks
- composer
- attachments feeling
- markdown / code rendering
- file/artifact preview aesthetics
- color, density, calmness

### Layer B — Workspace behavior layer (Hermes)

Отвечает за:

- session sidebar logic
- session grouping / pin / archive / tags
- tool activity cards
- approval behavior
- workspace browser
- retry / edit / regenerate flows
- SSE streaming model

### Layer C — Control layer (FounderOS)

Отвечает за:

- route ownership
- project scope
- cross-session grouping
- accounts & capacity
- failover / recovery / review
- multi-project orchestration
- operator shortcuts and attention surfaces

Если этот contract не зафиксировать, команда начнет путать, где chat semantics, где session semantics, а где operator semantics.

---

## 16.2 Non-negotiable product rules

### Rule 1
**Chat workspace never becomes the whole product.**

### Rule 2
**Operator overview never invades the transcript by default.**

### Rule 3
**Every session belongs to a project, and may belong to a group.**

### Rule 4
**Quota/capacity is visible everywhere, but detailed quota math is hidden until needed.**

### Rule 5
**Tool activity is rendered as calm cards, not terminal spam.**

### Rule 6
**Recovery and failover are first-class operator actions, not “debug hacks”.**

### Rule 7
**Open WebUI visual DNA is preserved inside the workspace surface.**

### Rule 8
**Hermes interaction strengths are preserved, but backend shortcuts are not copied blindly.**

### Rule 9
**FounderOS remains the only root shell.**

---

## 16.3 Host-mode contract between FounderOS and the Open WebUI adaptation

Для быстрого и красивого объединения нужен явный host contract.

### 16.3.1 Host context payload

```ts
// shared contract (can live in FounderOS first; extract later if needed)
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
```

### 16.3.2 Host → workspace messages

```ts
export type HostToWorkspaceMessage =
  | { type: "founderos.bootstrap"; payload: SessionWorkspaceHostContext }
  | { type: "founderos.account.switch"; payload: { accountId: string } }
  | { type: "founderos.session.retry"; payload: { retryMode: "same_account" | "fallback_account" } }
  | { type: "founderos.session.focus"; payload: { section: "chat" | "files" | "approvals" | "diff" } }
  | { type: "founderos.session.meta"; payload: Partial<SessionWorkspaceHostContext> };
```

### 16.3.3 Workspace → host messages

```ts
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

### 16.3.4 Зачем это нужно

Потому что без явного host contract неизбежно появятся ad-hoc query params, hidden globals и ломающийся sync между shell и workspace.

---

## 16.4 Route scope contract: что нужно расширить в FounderOS

FounderOS already persists route scope for `project_id` and `intake_session_id`. Для unified session/operator experience scope надо расширить. citeturn144274view0turn144274view1

### 16.4.1 Рекомендуемый новый scope type

```ts
// apps/web/lib/route-scope.ts

export interface ShellRouteScope {
  projectId?: string | null;
  intakeSessionId?: string | null;
  executionSessionId?: string | null;
  groupId?: string | null;
  accountId?: string | null;
  workspaceId?: string | null;
}

export function readShellRouteScopeFromSearchParams(
  searchParams: URLSearchParams,
): ShellRouteScope {
  return {
    projectId: searchParams.get("project_id"),
    intakeSessionId: searchParams.get("intake_session_id"),
    executionSessionId: searchParams.get("session_id"),
    groupId: searchParams.get("group_id"),
    accountId: searchParams.get("account_id"),
    workspaceId: searchParams.get("workspace_id"),
  };
}

export function withShellRouteScope(
  href: string,
  scope: ShellRouteScope,
): string {
  const url = new URL(href, "http://local.invalid");
  if (scope.projectId) url.searchParams.set("project_id", scope.projectId);
  if (scope.intakeSessionId) url.searchParams.set("intake_session_id", scope.intakeSessionId);
  if (scope.executionSessionId) url.searchParams.set("session_id", scope.executionSessionId);
  if (scope.groupId) url.searchParams.set("group_id", scope.groupId);
  if (scope.accountId) url.searchParams.set("account_id", scope.accountId);
  if (scope.workspaceId) url.searchParams.set("workspace_id", scope.workspaceId);
  return `${url.pathname}${url.search}`;
}
```

### 16.4.2 UX-следствие

После этого оператор может переходить:

- из `Review` в `Execution Session`
- из `Account Capacity` в конкретную blocked session
- из `Group Board` в workspace конкретного child session
- из `Dashboard` в exact file within session workspace

не теряя context.

---

## 16.5 Что именно должно происходить на открытии session workspace

### Flow

1. FounderOS route `/execution/workspace/[sessionId]` loads `ExecutionSessionSummary`.
2. Shell resolves project / group / account / workspace / external session mapping.
3. Shell renders host chrome + right now one of two workspace modes:
   - `embedded-sidecar`
   - `native-shell-renderer`
4. MVP should default to `embedded-sidecar`.
5. FounderOS sends bootstrap context to the workspace app.
6. Workspace app hides its own top-level nav and switches to embedded density.
7. Workspace streams events up to FounderOS while also rendering local UI.

### What the operator sees immediately

- current project
- current session name
- current account / model
- quota pressure chip
- pending approvals chip
- current phase chip (`Planning`, `Acting`, `Validating`, `Blocked`, `Failed`, `Completed`)
- left rail with sessions / group / tag filters
- transcript in center
- files/diff/approvals in right panel

---

# 17. Concrete implementation TЗ: files, contracts, code to introduce

## 17.1 Implementation principle

**Не пытаться first pass’ом переписать Open WebUI fork или FounderOS whole-shell.**

Сначала нужен thin but strong contract layer:

1. session domain model
2. normalized event model
3. account quota model
4. host/embedded bridge
5. a small set of routes and components

Потом уже полировать UI.

---

## 17.2 FounderOS: новые файлы и директории

### 17.2.1 Routes

```text
apps/web/app/(shell)/execution/sessions/page.tsx
apps/web/app/(shell)/execution/sessions/[sessionId]/page.tsx
apps/web/app/(shell)/execution/groups/page.tsx
apps/web/app/(shell)/execution/groups/[groupId]/page.tsx
apps/web/app/(shell)/execution/accounts/page.tsx
apps/web/app/(shell)/execution/recoveries/page.tsx
apps/web/app/(shell)/execution/workspace/[sessionId]/page.tsx
```

### 17.2.2 API routes / BFF

```text
apps/web/app/api/shell/execution/sessions/route.ts
apps/web/app/api/shell/execution/sessions/[sessionId]/route.ts
apps/web/app/api/shell/execution/sessions/[sessionId]/events/route.ts
apps/web/app/api/shell/execution/groups/route.ts
apps/web/app/api/shell/accounts/quotas/route.ts
apps/web/app/api/shell/accounts/[accountId]/capacity/route.ts
apps/web/app/api/shell/execution/recoveries/route.ts
apps/web/app/api/shell/workspace/[sessionId]/bootstrap/route.ts
```

### 17.2.3 Lib contracts / models

```text
apps/web/lib/execution-sessions-model.ts
apps/web/lib/execution-sessions.ts
apps/web/lib/execution-session-events-model.ts
apps/web/lib/execution-session-events.ts
apps/web/lib/execution-groups-model.ts
apps/web/lib/execution-groups.ts
apps/web/lib/account-capacity-model.ts
apps/web/lib/account-capacity.ts
apps/web/lib/quota-source.ts
apps/web/lib/event-normalization.ts
apps/web/lib/session-workspace-host-contract.ts
apps/web/lib/session-workspace-host.ts
```

### 17.2.4 UI components

```text
apps/web/components/execution/session-board.tsx
apps/web/components/execution/session-group-board.tsx
apps/web/components/execution/session-workspace-host.tsx
apps/web/components/execution/session-event-timeline.tsx
apps/web/components/execution/session-phase-chip.tsx
apps/web/components/execution/account-capacity-strip.tsx
apps/web/components/execution/recovery-lane.tsx
apps/web/components/execution/approval-pill.tsx
apps/web/components/execution/tool-activity-card.tsx
apps/web/components/execution/command-execution-card.tsx
```

---

## 17.3 Open WebUI adaptation: что добавлять/патчить

Ниже — **предлагаемые seams**. Поскольку локальный `/Users/martin/open-webui` не был line-by-line audited из этой среды, названия файлов нужно проверить по твоему actual fork. Но если он близок к upstream Open WebUI, структура `src/lib/components/chat/*` и `backend/open_webui/routers/*` реалистична. Upstream repo действительно содержит chat components under `src/lib/components/chat` и backend routers under `backend/open_webui/routers`. citeturn760931search0turn760931search8

### 17.3.1 Proposed additions

```text
src/lib/founderos/bridge.ts
src/lib/founderos/store.ts
src/lib/founderos/embedded.ts
src/lib/components/founderos/SessionMetaBar.svelte
src/lib/components/founderos/EmbeddedWorkspaceShell.svelte
backend/open_webui/routers/founderos.py
```

### 17.3.2 Likely patches

```text
src/lib/components/chat/Chat.svelte
src/lib/components/chat/MessageInput.svelte
src/lib/components/chat/ChatControls.svelte
src/lib/components/layout/Navbar/*.svelte   # hide outer chrome in embedded mode
backend/open_webui/routers/files.py         # optional session/workspace mapping hooks
```

### 17.3.3 Что делает embedded mode

- hides global Open WebUI nav
- keeps transcript/composer/file surfaces intact
- injects session/account/project chips from FounderOS host
- emits postMessage events to host
- respects host-provided deep links and focus commands

---

## 17.4 Hermes behavior: что портировать, а что переписать

### Port as-is conceptually

- session tags/projects/archive/pin
- queue while busy
- retry last assistant response
- edit from prior user message
- approval cards
- tool call cards
- context usage footer
- resizable right panel
- grouped session sidebar

### Rewrite architecturally

- approval state storage
- concurrency guards
- env-var based state sharing
- in-memory only pending state

Hermes architecture notes explicitly acknowledge that module-level approval state and process-global env vars become fragile under scaling/concurrency. That is the strongest sign that you should **copy the UX, not the storage model**. citeturn372277view2

---

## 17.5 Canonical session contract

### 17.5.1 Session summary type

```ts
// apps/web/lib/execution-sessions-model.ts

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

### 17.5.2 Session group type

```ts
export interface ExecutionSessionGroupSummary {
  id: string;
  projectId: string;
  name: string;
  status: "healthy" | "watch" | "blocked" | "degraded" | "failed";
  sessionIds: string[];
  runningCount: number;
  blockedCount: number;
  failedCount: number;
  completedCount: number;
  accountIds: string[];
  updatedAt: string;
}
```

---

## 17.6 Canonical normalized event contract

### 17.6.1 Event type

```ts
// apps/web/lib/execution-session-events-model.ts

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

### 17.6.2 Почему именно append-only normalized events

Потому что ты хочешь одновременно:

- рендерить transcript красиво
- собирать board summaries
- считать tool activity
- строить recovery lanes
- восстанавливать session state after reload
- deep-link’ать из review в точку транскрипта

Для этого лучший substrate — append-only normalized events + materialized projections.

---

## 17.7 Codex JSONL → normalized events

OpenAI официально документирует, что `codex exec --json` отдаёт JSONL stream, где есть `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.*`, `error`, а items могут быть `command_execution` и `agent_message`. Это уже machine-readable substrate для UI. citeturn212084view3turn212084view4turn212084view5turn212084view6

### 17.7.1 Adapter skeleton

```ts
// apps/web/lib/event-normalization.ts

import { randomUUID } from "crypto";
import type { NormalizedExecutionEvent } from "./execution-session-events-model";

interface CodexJsonlEvent {
  type: string;
  thread_id?: string;
  usage?: Record<string, unknown>;
  item?: Record<string, unknown>;
  [key: string]: unknown;
}

export function normalizeCodexJsonlEvent(args: {
  line: string;
  sessionId: string;
  projectId: string;
}): NormalizedExecutionEvent[] {
  const raw = JSON.parse(args.line) as CodexJsonlEvent;
  const ts = new Date().toISOString();

  const base = {
    id: randomUUID(),
    sessionId: args.sessionId,
    projectId: args.projectId,
    source: "codex_jsonl" as const,
    provider: "codex" as const,
    timestamp: ts,
    raw,
  };

  switch (raw.type) {
    case "thread.started":
      return [
        {
          ...base,
          kind: "session.started",
          status: "completed",
          phase: "planning",
          summary: "Codex thread started",
          payload: { threadId: raw.thread_id ?? null },
        },
      ];

    case "turn.started":
      return [
        {
          ...base,
          kind: "turn.started",
          status: "in_progress",
          phase: "planning",
          summary: "Turn started",
          payload: {},
        },
      ];

    case "turn.completed":
      return [
        {
          ...base,
          kind: "turn.completed",
          status: "completed",
          phase: "completed",
          summary: "Turn completed",
          payload: { usage: raw.usage ?? null },
        },
      ];

    case "turn.failed":
      return [
        {
          ...base,
          kind: "turn.failed",
          status: "failed",
          phase: "blocked",
          summary: "Turn failed",
          payload: raw,
        },
      ];

    case "item.started": {
      const item = raw.item ?? {};
      const type = String(item.type ?? "unknown");
      if (type === "command_execution") {
        return [
          {
            ...base,
            kind: "command.started",
            status: "in_progress",
            phase: "acting",
            summary: String(item.command ?? "Command started"),
            payload: {
              itemId: item.id ?? null,
              command: item.command ?? null,
              status: item.status ?? null,
            },
          },
        ];
      }
      return [
        {
          ...base,
          kind: "tool.started",
          status: "in_progress",
          phase: "acting",
          summary: `${type} started`,
          payload: item,
        },
      ];
    }

    case "item.completed": {
      const item = raw.item ?? {};
      const type = String(item.type ?? "unknown");

      if (type === "agent_message") {
        return [
          {
            ...base,
            kind: "agent.message.completed",
            status: "completed",
            phase: "acting",
            summary: "Agent message",
            payload: {
              itemId: item.id ?? null,
              text: item.text ?? "",
            },
          },
        ];
      }

      if (type === "command_execution") {
        return [
          {
            ...base,
            kind: "command.completed",
            status: String(item.status ?? "completed") === "failed" ? "failed" : "completed",
            phase: String(item.status ?? "") === "failed" ? "blocked" : "acting",
            summary: String(item.command ?? "Command completed"),
            payload: item,
          },
        ];
      }

      return [
        {
          ...base,
          kind: "tool.completed",
          status: String(item.status ?? "completed") === "failed" ? "failed" : "completed",
          phase: "acting",
          summary: `${type} completed`,
          payload: item,
        },
      ];
    }

    case "error":
      return [
        {
          ...base,
          kind: "error.raised",
          status: "failed",
          phase: "blocked",
          summary: "Codex error",
          payload: raw,
        },
      ];

    default:
      return [];
  }
}
```

### 17.7.2 Важное правило по рендерингу

Codex raw JSONL **не должен напрямую попадать в UI**. Сначала normalization, потом projection, потом calm UI primitives.

---

## 17.8 Hermes SSE → normalized events

Hermes architecture docs описывают SSE engine с event types `token`, `tool`, `approval`, `done`, `error`, где tool callback fires on tool invocation, approval surfaces immediately after tool fire, and SSE is chosen intentionally over WebSockets. citeturn372277view0turn372277view1turn372277view2turn372277view5

### 17.8.1 Adapter skeleton

```ts
export function normalizeHermesSseEvent(args: {
  event: string;
  data: Record<string, unknown>;
  sessionId: string;
  projectId: string;
}): NormalizedExecutionEvent[] {
  const ts = new Date().toISOString();
  const base = {
    id: crypto.randomUUID(),
    sessionId: args.sessionId,
    projectId: args.projectId,
    source: "hermes_sse" as const,
    provider: "hermes" as const,
    timestamp: ts,
    raw: args.data,
  };

  switch (args.event) {
    case "token":
      return [
        {
          ...base,
          kind: "agent.message.delta",
          status: "in_progress",
          phase: "acting",
          summary: "Agent token delta",
          payload: { text: args.data.text ?? "" },
        },
      ];

    case "tool":
      return [
        {
          ...base,
          kind: "tool.started",
          status: "in_progress",
          phase: "acting",
          summary: String(args.data.name ?? "Tool started"),
          payload: args.data,
        },
      ];

    case "approval":
      return [
        {
          ...base,
          kind: "approval.requested",
          status: "in_progress",
          phase: "blocked",
          summary: String(args.data.description ?? "Approval requested"),
          payload: args.data,
        },
      ];

    case "done":
      return [
        {
          ...base,
          kind: "turn.completed",
          status: "completed",
          phase: "completed",
          summary: "Hermes turn completed",
          payload: args.data,
        },
      ];

    case "error":
      return [
        {
          ...base,
          kind: "turn.failed",
          status: "failed",
          phase: "blocked",
          summary: String(args.data.message ?? "Hermes error"),
          payload: args.data,
        },
      ];

    default:
      return [];
  }
}
```

### 17.8.2 Важное замечание

Hermes `token` events shouldn’t each render as a separate visible row. Их надо складывать в active assistant buffer и flush’ить в one message block. Иначе transcript becomes unreadable.

---

## 17.9 Projection reducer: как из событий строить usable session state

```ts
// apps/web/lib/execution-session-events.ts

import type {
  ExecutionSessionSummary,
  ExecutionSessionStatus,
} from "./execution-sessions-model";
import type { NormalizedExecutionEvent } from "./execution-session-events-model";

export interface SessionProjectionState {
  summary: ExecutionSessionSummary;
  activeAssistantBuffer: string;
}

function deriveStatus(event: NormalizedExecutionEvent): ExecutionSessionStatus | null {
  switch (event.kind) {
    case "session.started":
    case "turn.started":
      return "planning";
    case "tool.started":
    case "command.started":
    case "agent.message.delta":
      return "acting";
    case "approval.requested":
      return "waiting_for_approval";
    case "turn.failed":
    case "error.raised":
      return "failed";
    case "recovery.started":
      return "blocked";
    case "recovery.completed":
      return "recovered";
    case "turn.completed":
      return "completed";
    default:
      return null;
  }
}

export function reduceSessionProjection(
  state: SessionProjectionState,
  event: NormalizedExecutionEvent,
): SessionProjectionState {
  const nextStatus = deriveStatus(event);

  if (event.kind === "agent.message.delta") {
    return {
      ...state,
      activeAssistantBuffer: state.activeAssistantBuffer + String(event.payload.text ?? ""),
      summary: {
        ...state.summary,
        updatedAt: event.timestamp,
        status: nextStatus ?? state.summary.status,
      },
    };
  }

  if (event.kind === "agent.message.completed") {
    return {
      ...state,
      activeAssistantBuffer: "",
      summary: {
        ...state.summary,
        updatedAt: event.timestamp,
        lastMessageAt: event.timestamp,
        status: nextStatus ?? state.summary.status,
      },
    };
  }

  if (event.kind === "approval.requested") {
    return {
      ...state,
      summary: {
        ...state.summary,
        updatedAt: event.timestamp,
        pendingApprovals: state.summary.pendingApprovals + 1,
        status: "waiting_for_approval",
      },
    };
  }

  if (event.kind === "approval.resolved") {
    return {
      ...state,
      summary: {
        ...state.summary,
        updatedAt: event.timestamp,
        pendingApprovals: Math.max(0, state.summary.pendingApprovals - 1),
      },
    };
  }

  if (event.kind === "error.raised" || event.kind === "turn.failed") {
    return {
      ...state,
      summary: {
        ...state.summary,
        updatedAt: event.timestamp,
        lastErrorAt: event.timestamp,
        recoveryState: "retryable",
        status: "failed",
      },
    };
  }

  return {
    ...state,
    summary: {
      ...state.summary,
      updatedAt: event.timestamp,
      status: nextStatus ?? state.summary.status,
    },
  };
}
```

---

## 17.10 Canonical quota / capacity contract

OpenAI now documents two separate realities that matter here:

1. Authentication mode matters. Codex supports ChatGPT sign-in and API-key sign-in; with ChatGPT sign-in, workspace permissions and ChatGPT limits apply; with API key, usage follows API billing. citeturn966179view0
2. App-server explicitly documents ChatGPT rate-limit reads via `account/rateLimits/read` and updates via `account/rateLimits/updated`, including `usedPercent`, `windowDurationMins`, and `resetsAt`. citeturn362171view0
3. Pricing/help surfaces document that local messages and cloud tasks share a five-hour window and additional weekly limits may apply for some plans, while API-key access is usage-based. citeturn552364view1turn552364view3
4. The app-server docs also distinguish stable vs experimental surfaces; experimental API opt-in exists, but the documented account/rateLimits section sits in the regular account flow, while WebSocket transport is called experimental. citeturn197451view1turn212084view1

### 17.10.1 Contract types

```ts
// apps/web/lib/account-capacity-model.ts

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

### 17.10.2 Source interface

```ts
export interface QuotaSource {
  read(accountId: string): Promise<AccountQuotaSnapshot | null>;
  subscribe?(
    accountId: string,
    onUpdate: (snapshot: AccountQuotaSnapshot) => void,
  ): Promise<() => Promise<void>>;
}
```

### 17.10.3 Primary implementation

```ts
// apps/web/lib/quota-source.ts

export class AppServerQuotaSource implements QuotaSource {
  constructor(private client: { request(method: string, params?: unknown): Promise<any> }) {}

  async read(accountId: string): Promise<AccountQuotaSnapshot | null> {
    const result = await this.client.request("account/rateLimits/read", {});
    const buckets = Object.values(result?.rateLimitsByLimitId ?? {}).map((bucket: any) => ({
      limitId: String(bucket.limitId ?? "unknown"),
      limitName: bucket.limitName ?? null,
      usedPercent: bucket.primary?.usedPercent ?? null,
      windowDurationMins: bucket.primary?.windowDurationMins ?? null,
      resetsAt: bucket.primary?.resetsAt
        ? new Date(Number(bucket.primary.resetsAt) * 1000).toISOString()
        : null,
    }));

    return {
      accountId,
      authMode: "chatgpt",
      source: "openai_app_server",
      observedAt: new Date().toISOString(),
      buckets,
      raw: result,
    };
  }
}
```

### 17.10.4 Fallback implementation

```ts
export class ObservedRuntimeQuotaSource implements QuotaSource {
  async read(accountId: string): Promise<AccountQuotaSnapshot | null> {
    // Derived only from recent 429s / reset hints / local runtime state.
    // Never canonical. Use only when upstream read is unavailable.
    return {
      accountId,
      authMode: "unknown",
      source: "observed_runtime",
      observedAt: new Date().toISOString(),
      buckets: [],
      raw: null,
    };
  }
}
```

### 17.10.5 Canonical decision rule

- If account auth mode is `chatgpt` or `chatgptAuthTokens` → canonical source is app-server rate limit read/update. citeturn362171view0turn966179view0
- If account auth mode is `apikey` → there is no ChatGPT quota bucket to read; treat it as usage-priced capacity and surface cost/spend, not fake “remaining quota”. citeturn966179view0turn552364view1
- Router/load balancer state may help scheduling, but it is not truth.

---

## 17.11 Accounts board: what must be visible

Each account row/card should show exactly these fields:

- account label
- auth mode (`ChatGPT`, `API key`, `External ChatGPT tokens`)
- current provider/runtime (`Codex`, `Hermes`, `Mixed`)
- current pressure (`low/medium/high/exhausted`)
- next reset time if known
- current sessions count
- blocked sessions count
- failover availability (`has fallback`, `none`)
- “preferred for new sessions” toggle

**What should not be shown by default:** raw quota JSON, bucket internals, low-level rate-card math.

---

## 17.12 Workspace host component in FounderOS

### 17.12.1 MVP choice: embedded sidecar iframe with explicit bridge

Да, именно **iframe in embedded host mode** — acceptable for MVP here, because:

- it preserves your local Open WebUI adaptation
- allows separate subagent workstreams
- keeps shell and workspace decoupled enough
- avoids giant rewrite

Long-term that can converge to same-origin module/native route rendering. But first pass should optimize for speed and correctness, not ideological purity.

### 17.12.2 Host component skeleton

```tsx
// apps/web/components/execution/session-workspace-host.tsx

"use client";

import { useEffect, useMemo, useRef } from "react";
import type { SessionWorkspaceHostContext } from "@/lib/session-workspace-host-contract";

interface Props {
  workspaceUrl: string;
  context: SessionWorkspaceHostContext;
}

export function SessionWorkspaceHost({ workspaceUrl, context }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const src = useMemo(() => {
    const url = new URL(workspaceUrl, window.location.origin);
    url.searchParams.set("embedded", "1");
    url.searchParams.set("session_id", context.sessionId);
    url.searchParams.set("project_id", context.projectId);
    if (context.groupId) url.searchParams.set("group_id", context.groupId);
    if (context.workspaceId) url.searchParams.set("workspace_id", context.workspaceId);
    return url.toString();
  }, [workspaceUrl, context]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message?.type) return;

      switch (message.type) {
        case "workspace.ready": {
          iframeRef.current?.contentWindow?.postMessage(
            { type: "founderos.bootstrap", payload: context },
            window.location.origin,
          );
          break;
        }
        case "workspace.approval.requested":
        case "workspace.tool.started":
        case "workspace.tool.completed":
        case "workspace.error": {
          // TODO: dispatch into shell store / analytics / notifications.
          break;
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [context]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-background/70">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span>{context.projectName}</span>
          <span>•</span>
          <span>{context.sessionId}</span>
          {context.accountLabel ? (
            <>
              <span>•</span>
              <span>{context.accountLabel}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span>{context.executionMode ?? "unknown"}</span>
          <span>{context.quotaState?.pressure ?? "unknown"}</span>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={src}
        className="min-h-0 flex-1 rounded-b-xl bg-transparent"
        title="Session workspace"
      />
    </div>
  );
}
```

---

## 17.13 Open WebUI adaptation: bridge code skeleton

### 17.13.1 `src/lib/founderos/bridge.ts`

```ts
import { writable } from "svelte/store";

export interface FounderOSHostContext {
  projectId: string;
  projectName: string;
  sessionId: string;
  groupId?: string | null;
  workspaceId?: string | null;
  accountId?: string | null;
  accountLabel?: string | null;
  model?: string | null;
  executionMode?: string | null;
  quotaState?: {
    pressure: string;
    usedPercent?: number | null;
    resetsAt?: string | null;
  };
}

export const embeddedMode = writable(false);
export const hostContext = writable<FounderOSHostContext | null>(null);

export function postToHost(type: string, payload: Record<string, unknown> = {}) {
  if (window.parent === window) return;
  window.parent.postMessage({ type, payload }, window.location.origin);
}

export function initFounderOSBridge() {
  const params = new URLSearchParams(window.location.search);
  embeddedMode.set(params.get("embedded") === "1");

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const message = event.data;
    if (message?.type === "founderos.bootstrap") {
      hostContext.set(message.payload ?? null);
    }
  });

  postToHost("workspace.ready");
}
```

### 17.13.2 Embedded shell wrapper

```svelte
<!-- src/lib/components/founderos/EmbeddedWorkspaceShell.svelte -->
<script lang="ts">
  import { embeddedMode, hostContext } from "$lib/founderos/bridge";
</script>

{#if $embeddedMode && $hostContext}
  <div class="founderos-meta-bar">
    <div class="left">
      <span>{$hostContext.projectName}</span>
      <span>•</span>
      <span>{$hostContext.sessionId}</span>
      {#if $hostContext.accountLabel}
        <span>•</span>
        <span>{$hostContext.accountLabel}</span>
      {/if}
    </div>
    <div class="right">
      {#if $hostContext.executionMode}
        <span class="chip">{$hostContext.executionMode}</span>
      {/if}
      {#if $hostContext.quotaState}
        <span class="chip {$hostContext.quotaState.pressure}">
          {$hostContext.quotaState.pressure}
        </span>
      {/if}
    </div>
  </div>
{/if}

<slot />
```

### 17.13.3 Example patch in `Chat.svelte`

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { initFounderOSBridge, postToHost, embeddedMode } from "$lib/founderos/bridge";

  onMount(() => {
    initFounderOSBridge();
  });

  function emitToolStart(toolName: string, eventId: string) {
    postToHost("workspace.tool.started", { toolName, eventId });
  }

  function emitApprovalRequest(approvalId: string, summary: string) {
    postToHost("workspace.approval.requested", { approvalId, summary });
  }
</script>

<svelte:body class:founderos-embedded={$embeddedMode} />
```

### 17.13.4 CSS rule for embedded mode

```css
body.founderos-embedded .global-sidebar,
body.founderos-embedded .top-navbar,
body.founderos-embedded .instance-switcher {
  display: none !important;
}

body.founderos-embedded .chat-root {
  height: 100vh;
}
```

---

## 17.14 Optional backend hook in Open WebUI adaptation

Если тебе нужен tighter sync между session workspace и FounderOS shell, можно дать adaptation-specific router.

```py
# backend/open_webui/routers/founderos.py
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/founderos", tags=["founderos"])

class BootstrapResponse(BaseModel):
    session_id: str
    external_session_id: str | None = None
    project_id: str | None = None
    workspace_id: str | None = None
    embedded: bool = True

@router.get("/bootstrap", response_model=BootstrapResponse)
def bootstrap(session_id: str, project_id: str | None = None, workspace_id: str | None = None):
    return BootstrapResponse(
        session_id=session_id,
        external_session_id=session_id,
        project_id=project_id,
        workspace_id=workspace_id,
        embedded=True,
    )
```

Это не must-have для MVP, но полезно, если host and workspace need a server-side shared mapping.

---

## 17.15 Durable approvals model: what to build instead of Hermes’ in-memory pending state

Hermes docs are valuable precisely because they show what breaks later: in-memory `_pending` approval entries and process-global state. That is okay for a single-process lightweight UI, but not for a shell that will orchestrate many sessions/projects/accounts. citeturn372277view2

### 17.15.1 Required table

```sql
create table if not exists approval_requests (
  id text primary key,
  session_id text not null,
  provider text not null,
  tool_name text,
  command_text text,
  summary text not null,
  status text not null check (status in ('pending','approved_once','approved_session','approved_always','denied','expired')),
  scope text not null check (scope in ('once','session','always','deny')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  raw_payload jsonb
);
```

### 17.15.2 API contract

```ts
POST /api/shell/execution/approvals/[approvalId]/respond
body: {
  decision: "approve_once" | "approve_session" | "approve_always" | "deny";
}
```

### 17.15.3 UX rules

- approval card appears inline in workspace transcript
- same approval also increments shell-level pending approvals chip
- approvals board shows all pending across sessions
- resolving from shell reflects immediately in workspace

---

## 17.16 SQL schema for MVP

```sql
create table if not exists execution_sessions (
  id text primary key,
  external_session_id text,
  project_id text not null,
  project_name text not null,
  group_id text,
  workspace_id text,
  account_id text,
  provider text not null,
  model text,
  title text not null,
  status text not null,
  phase text,
  tags jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_message_at timestamptz,
  last_tool_at timestamptz,
  last_error_at timestamptz,
  pending_approvals integer not null default 0,
  tool_activity_count integer not null default 0,
  retry_count integer not null default 0,
  recovery_state text not null default 'none',
  quota_pressure text not null default 'unknown'
);

create table if not exists execution_session_events (
  id text primary key,
  session_id text not null references execution_sessions(id) on delete cascade,
  project_id text not null,
  group_id text,
  source text not null,
  provider text not null,
  kind text not null,
  status text,
  phase text,
  event_ts timestamptz not null,
  summary text not null,
  payload jsonb not null,
  raw jsonb
);

create index if not exists idx_execution_session_events_session_ts
  on execution_session_events (session_id, event_ts desc);

create table if not exists execution_groups (
  id text primary key,
  project_id text not null,
  name text not null,
  status text not null,
  session_ids jsonb not null default '[]'::jsonb,
  running_count integer not null default 0,
  blocked_count integer not null default 0,
  failed_count integer not null default 0,
  completed_count integer not null default 0,
  account_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null
);

create table if not exists account_quota_snapshots (
  id text primary key,
  account_id text not null,
  auth_mode text not null,
  source text not null,
  observed_at timestamptz not null,
  buckets jsonb not null,
  raw jsonb
);

create index if not exists idx_account_quota_snapshots_account_observed
  on account_quota_snapshots (account_id, observed_at desc);

create table if not exists recovery_incidents (
  id text primary key,
  session_id text not null references execution_sessions(id) on delete cascade,
  account_id text,
  status text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  strategy text,
  notes text,
  raw jsonb
);
```

---

## 17.17 Session board component behavior

### 17.17.1 What a session row/card must show

- title
- project
- group (if any)
- provider/model
- status / phase chip
- quota pressure chip
- pending approvals count
- last activity timestamp
- last error indicator
- quick actions: open workspace / retry / reassign account / archive / pin

### 17.17.2 What a grouped board must show

- group name
- aggregate status
- session count by state
- current accounts involved
- current bottleneck (approval / quota / failure / waiting)
- bulk actions: open all / retry failed / move to fallback account / archive completed

### 17.17.3 What accounts board must show

- accounts sorted by preference + pressure
- sessions consuming each account
- upcoming reset time
- whether safe for new sessions
- one-click `make preferred`, `drain`, `pause scheduling`, `fail over blocked sessions`

---

## 17.18 CLI-to-UI rendering spec at the component level

### 17.18.1 Agent message

Default visible form:

- normal assistant bubble
- markdown/code rendered cleanly
- collapsible reasoning block if present
- no raw event envelope visible

### 17.18.2 Tool call

Default visible form:

- inline card, slightly lower emphasis than assistant message
- title = tool name
- subtitle = short preview
- expandable details = args/result snippet

This mirrors Hermes’ strength and is much better than printing JSON blobs. citeturn454621view6turn454621view7

### 17.18.3 Command execution

Default visible form:

- card with command text
- status chip (`running`, `ok`, `failed`)
- expandable stdout/stderr
- link to full terminal or raw log if needed

This is also consistent with the Codex app quality bar, where threads have integrated terminal/diff/worktree context rather than a generic chat-only view. citeturn478292search0

### 17.18.4 Approval request

Default visible form:

- high-emphasis approval card inline in transcript
- same item mirrored in shell-level approvals board
- actions: approve once / approve for session / deny
- optional: approve always (admin only)

### 17.18.5 Retry / recovery

Default visible form:

- compact operator card, not assistant bubble
- shows failure reason + next available actions
- actions: retry same account / retry fallback account / open logs / move to review

### 17.18.6 Account switch

Default visible form:

- tiny system event divider in transcript + shell toast
- visible in session metadata strip
- accounted for in audit trail

### 17.18.7 Phase boundaries

Phases should be first-class and sparse:

- Planning
- Acting
- Validating
- Waiting for approval
- Blocked
- Recovered
- Completed

Do **not** render 100 low-level state transitions. Render the phase changes that matter.

---

## 17.19 Example rendering fixtures for contract tests

### 17.19.1 Codex fixture

```json
{"type":"thread.started","thread_id":"thr_123"}
{"type":"turn.started"}
{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"bash -lc pnpm test","status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"Tests are failing in auth.spec.ts"}}
{"type":"turn.failed","error":{"message":"Approval required"}}
```

### 17.19.2 Expected UI primitives

```text
phase divider: Planning
command card: pnpm test (running → failed)
assistant bubble: Tests are failing in auth.spec.ts
approval/recovery card: approval required
phase divider: Blocked
```

### 17.19.3 Hermes fixture

```text
event: token
data: {"text":"I found the issue in the auth guard."}

event: tool
data: {"name":"read_file","preview":"src/auth/guard.ts"}

event: approval
data: {"command":"rm -rf dist","description":"Dangerous shell command"}

event: done
data: {"session":{"id":"sess_1"}}
```

### 17.19.4 Expected UI primitives

```text
assistant bubble delta stream
inline tool card: read_file → src/auth/guard.ts
approval card: Dangerous shell command
phase divider: Completed
```

---

## 17.20 What not to build in MVP

Do **not** build these in phase 1:

- giant mission control canvas
- universal analytics dashboard
- custom visual redesign of Open WebUI
- full native rewrite of the Open WebUI adaptation into FounderOS
- complex auto-routing policies with hidden logic
- multi-tenant RBAC matrix for every entity
- giant plugin marketplace inside control plane

MVP must instead ship:

- working sessions board
- working workspace host route
- working event normalization
- working quota/account board
- working approvals/recovery path

---

# 18. Delegation plan: how to split this across subagents in parallel

## 18.1 Overall decomposition

Минимальный workable split — **8 parallel workstreams**.

### Stream A — Shell & IA
FounderOS routes, navigation, board surfaces, route-scope extension.

### Stream B — Session workspace host
FounderOS workspace host route + embedded frame + host bridge.

### Stream C — Open WebUI host mode
Embedded mode, hidden chrome, postMessage bridge, session meta bar.

### Stream D — Hermes behavior port
Session sidebar semantics, tool/approval cards, resizable right panel, retry/edit flows.

### Stream E — Event normalization & projections
Codex JSONL + Hermes SSE adapters, event store, session/group projections.

### Stream F — Quota & accounts
App-server quota adapter, capacity derivation, accounts board.

### Stream G — Recoveries & approvals
Durable approval model, recovery incidents, fallback account actions.

### Stream H — QA / fixtures / contract tests
Fixtures, projection tests, end-to-end host bridge tests, visual regression smoke tests.

Эти стримы реально можно вести параллельно, если сначала зафиксировать shared contracts.

---

## 18.2 Dependency graph

### Can start immediately

- Stream A (with mocked data)
- Stream B (with mocked host context)
- Stream C (with mocked bootstrap payload)
- Stream D (with static fixtures)
- Stream H (fixture authoring)

### Must wait for initial contracts freeze

- Stream E depends on normalized event contract
- Stream F depends on quota contract
- Stream G depends on approval/recovery contract

### Must wait for E/F/G outputs

- final board behavior polish in A
- live workspace integration polish in B/C
- review lane hooks in G

### 48-hour rule

Within first 48 hours the team must freeze:

1. session summary type
2. normalized event type
3. host/embedded bridge type
4. quota snapshot type
5. approval response type

If these 5 contracts are unstable, parallelization collapses.

---

## 18.3 Workstream-by-workstream TЗ

## 18.3.1 Subagent 01 — FounderOS Shell / IA engineer

**Mission:** превратить FounderOS execution section в реальный operator board для sessions/groups/accounts/recoveries без ломки текущего shell.

**Inputs:**

- existing FounderOS shell/nav/review patterns
- section 15–17 of this spec
- existing `route-scope.ts`, `navigation.ts`, `review-center.ts` patterns

**Tasks:**

1. Add execution children for Sessions / Groups / Accounts / Recoveries.
2. Extend route scope with `session_id`, `group_id`, `account_id`, `workspace_id`.
3. Create mock-backed pages for new execution routes.
4. Add deep-link actions from session/group/account rows into workspace route.
5. Preserve current keyboard shortcut and nav semantics.

**Deliverables:**

- new routes compile
- nav works
- mocked session board works
- no regressions in existing shell

**Definition of done:**

- operator can open `/execution/sessions`
- operator can click a session and land in `/execution/workspace/[sessionId]`
- scope persists through nav transitions

**Prompt to hand this subagent:**

```text
You are working only inside FounderOS. Your mission is to extend the existing shell into a session-aware operator control plane without redesigning the shell. Preserve the current navigation model and route-scope semantics. Add Execution children for Sessions, Groups, Accounts, and Recoveries. Create mocked but realistic route pages and deep links into /execution/workspace/[sessionId]. Do not touch Open WebUI or Hermes code. Optimize for compatibility with the current FounderOS structure and naming conventions.
```

---

## 18.3.2 Subagent 02 — FounderOS workspace host engineer

**Mission:** построить route-level host container, который встраивает Open WebUI adaptation в FounderOS красиво и предсказуемо.

**Tasks:**

1. Create `session-workspace-host.tsx`.
2. Implement postMessage bootstrap handshake.
3. Add top meta strip with project/account/quota/phase chips.
4. Add right-side optional host drawer for approvals/logs.
5. Ensure reload, deep link, and same-origin safety behavior.

**Deliverables:**

- workspace route renders host container
- iframe/embedded app receives bootstrap
- host receives child events

**Definition of done:**

- mocked embedded app can signal `workspace.ready`
- host sends `founderos.bootstrap`
- host surfaces approval/tool/error events

**Prompt:**

```text
You are implementing the FounderOS side of the embedded session workspace. Build a route-level host component that embeds a same-origin workspace app, sends bootstrap context, and listens to workspace events. The outer shell remains FounderOS. Optimize for minimalism, robustness, and future migration away from iframe if needed.
```

---

## 18.3.3 Subagent 03 — Open WebUI host-mode engineer

**Mission:** сделать твой Open WebUI adaptation способным жить как embedded workspace inside FounderOS without losing its own visual identity.

**Tasks:**

1. Add `embedded=1` mode.
2. Hide global app chrome when embedded.
3. Add `founderos/bridge.ts` and bootstrap listener.
4. Add host meta bar.
5. Emit tool/approval/error/file-open events upward.
6. Preserve Open WebUI look-and-feel inside the workspace itself.

**Deliverables:**

- embedded mode works standalone and under host
- global nav hidden in embedded mode
- host context visible inside workspace
- child events emitted

**Definition of done:**

- opening the adaptation with `?embedded=1` shows workspace-only UI
- host bootstrap is consumed without reload bugs
- no visual regression in standalone mode

**Prompt:**

```text
You are working only in the local Open WebUI adaptation. Add a FounderOS embedded mode. In embedded mode the app must hide outer chrome, preserve the chat/file/workspace visual identity, accept bootstrap context from the parent shell, and emit postMessage events back up. Do not redesign the app. Do not make it look like a dashboard. Keep it feeling like Open WebUI, just host-aware.
```

---

## 18.3.4 Subagent 04 — Hermes behavior porter

**Mission:** перенести в adaptation именно те functional behaviors, которые делают Hermes WebUI strong session workspace.

**Tasks:**

1. Implement/verify session tags, archive, pin, grouped date sections.
2. Implement inline tool cards.
3. Implement approval cards.
4. Implement retry last assistant response.
5. Implement edit from prior user message.
6. Implement resizable right panel.
7. Implement context usage footer.

**Explicit non-goals:**

- do not copy Hermes’ in-memory approval storage
- do not copy process-global env assumptions
- do not introduce single-process shortcuts

**Deliverables:**

- UI/UX parity on selected Hermes behaviors
- all driven by clean local state + host events

**Prompt:**

```text
Your mission is to port Hermes WebUI’s strongest session/workspace behaviors into the existing Open WebUI adaptation without changing the overall visual DNA. Focus on session organization, tool activity cards, approvals, retry/edit flows, context usage visibility, and right-panel workspace ergonomics. Do not port Hermes backend shortcuts that rely on module-level state or process-global environment variables.
```

---

## 18.3.5 Subagent 05 — Event normalization engineer

**Mission:** построить canonical normalized event pipeline that makes CLI/SSE execution renderable as elegant UI.

**Tasks:**

1. Define normalized event types.
2. Implement Codex JSONL adapter.
3. Implement Hermes SSE adapter.
4. Build append-only event storage.
5. Build session/group projection reducers.
6. Provide fixture-based tests.

**Deliverables:**

- event adapters
- projection reducer
- session summary materializer
- group summary materializer

**Definition of done:**

- same fixture always produces same projection
- tool/approval/error states are preserved
- raw source differences are hidden behind one contract

**Prompt:**

```text
Build a normalized execution event layer that can ingest Codex JSONL events and Hermes SSE events, store them append-only, and materialize calm session/group summaries for the UI. The UI must not depend on source-specific event shapes. Optimize for clarity, determinism, and testability.
```

---

## 18.3.6 Subagent 06 — Quota / accounts engineer

**Mission:** реализовать account capacity layer with correct source-of-truth hierarchy.

**Tasks:**

1. Implement app-server rate limit read adapter.
2. Separate ChatGPT quota buckets from API-key usage-based accounts.
3. Derive `pressure` and `schedulable` state.
4. Build accounts board API.
5. Build lightweight live update path for quota changes.

**Deliverables:**

- `quota-source.ts`
- account capacity projections
- `/api/shell/accounts/quotas`
- `/execution/accounts` data flow

**Definition of done:**

- ChatGPT accounts show canonical buckets from upstream
- API-key accounts do not pretend to have the same quota model
- shell can choose preferred account for new sessions

**Prompt:**

```text
Build the quota and account-capacity layer for the control plane. Use official upstream rate-limit reads when the account auth mode is ChatGPT or externally managed ChatGPT tokens. Treat API-key accounts as usage-priced access rather than fake ChatGPT quota buckets. Expose derived pressure/schedulable states for the shell.
```

---

## 18.3.7 Subagent 07 — Approvals / recoveries engineer

**Mission:** сделать blocked/failure/failover behavior first-class.

**Tasks:**

1. Implement durable approval_requests table and APIs.
2. Implement recovery_incidents table and APIs.
3. Add retry same account / retry fallback account flows.
4. Add approvals board and recovery lane.
5. Emit audit events for every operator intervention.

**Deliverables:**

- approval model
- recovery model
- actionable recovery lane UI
- retry/failover endpoints

**Definition of done:**

- failed session becomes retryable with visible reason
- approval request visible in both workspace and shell
- operator can fail over a blocked session to fallback account

**Prompt:**

```text
Your mission is to turn approvals and recoveries into first-class control-plane objects. Build durable storage, APIs, and UI actions for pending approvals, failures, retries, and fallback-account failover. Every operator action must be auditable and visible in both the shell and the session workspace.
```

---

## 18.3.8 Subagent 08 — QA / contracts / integration engineer

**Mission:** удержать систему от хаоса while 7 other agents work in parallel.

**Tasks:**

1. Freeze TypeScript interfaces into fixture files.
2. Write adapter fixture tests.
3. Write projection invariant tests.
4. Write host↔workspace bridge smoke tests.
5. Write visual regression checklist for embedded mode.
6. Write integration test matrix for main flows.

**Deliverables:**

- contract tests
- fixture corpus
- regression checklist
- merge gate criteria

**Definition of done:**

- no PR can merge without passing contracts + fixtures
- top 5 flows have automated smoke tests

**Prompt:**

```text
You are the integration/QA owner for the unified control plane. Freeze the core contracts, create fixtures for Codex JSONL and Hermes SSE, validate projections, and guard the FounderOS↔workspace bridge with smoke tests. Your job is to make parallel development safe.
```

---

## 18.4 Recommended execution order across the team

### Day 0–1

- Subagent 05 defines normalized event contract.
- Subagent 06 defines quota contract.
- Subagent 01 defines route scope extension.
- Subagent 08 freezes those interfaces and fixture schemas.

### Day 1–3

- Subagent 02 builds workspace host.
- Subagent 03 builds Open WebUI embedded mode.
- Subagent 04 ports Hermes behaviors on mocks.
- Subagent 05 implements adapters and projections.
- Subagent 06 implements quota adapter and accounts board API.

### Day 3–5

- Subagent 07 adds approvals/recoveries.
- Subagent 01 wires boards to live projections.
- Subagent 08 runs integration smoke tests and sends back defect lists.

### Day 5+

- polish, performance, keyboard shortcuts, review deep links, styling refinements

---

## 18.5 Merge discipline

### Branching rule

Each subagent gets exactly one responsibility boundary.

### Contract rule

If a subagent needs to change one of the 5 frozen contracts, it must first open a contract diff PR and wait for QA owner approval.

### UI rule

No subagent is allowed to redesign the whole workspace UI in the name of “cleanup”.

### Debug rule

Raw logs can be attached behind expanders, but they must not replace calm top-level UI.

---

## 18.6 Definition of done for the whole MVP

MVP is done only if all of the following are true:

1. FounderOS has a real sessions board.
2. FounderOS can open a session workspace route.
3. Open WebUI adaptation can run in embedded mode.
4. Hermes-grade session behaviors exist in the workspace.
5. Codex JSONL and Hermes SSE both normalize into one event model.
6. Accounts board shows real upstream ChatGPT quota buckets where available.
7. Approvals and recoveries are durable and operator-actionable.
8. Deep links across board ↔ review ↔ workspace preserve scope.
9. The product still feels calm and elegant, not like an overbuilt admin dashboard.

---

# 19. Strategic cautions specific to this repo chain

## 19.1 Do not confuse “Open WebUI as visual layer” with “copy CSS and call it done”

Ты любишь Open WebUI не только из-за colors or spacing, а потому что там приятный **message-first interaction rhythm**. Если просто перенести стили в FounderOS, а поведение оставить shell-heavy, результат не будет ощущаться как Open WebUI.

## 19.2 Do not confuse “Hermes functionality” with “copy the backend literally”

Hermes valuable because of:

- session model
- tool/approval cards
- three-panel ergonomics
- retry/edit/session organization

Hermes is **not** valuable because of in-memory pending approval dicts or env-var state coupling. citeturn372277view2

## 19.3 Do not give all users full Open WebUI Workspace/Tools power

Open WebUI docs are very explicit that Tools / Functions / Pipelines can execute arbitrary Python code and should be restricted to trusted admins. In a control-plane product this matters a lot. citeturn214681view0turn214681view1turn214681view2

## 19.4 Do not white-label Open WebUI blindly before license review

Open WebUI README states the codebase includes licensing with an additional requirement to preserve “Open WebUI” branding for relevant sections, and points to license files/history. If you ever move beyond “adaptation that keeps Open WebUI identity”, run a license review first. This spec is product/architecture guidance, not legal advice. citeturn935640view4

## 19.5 Do not let router stats become fake truth

Your router/load balancer can be extremely useful for scheduling and observed health, but if upstream official quota reads are available, router-derived values should remain derived capacity hints, not source-of-truth.

## 19.6 Do not turn recovery into a hidden backend behavior

Operator has to see:

- that a session failed
- why it failed
- whether it is retryable
- what fallback account is available
- what action was taken

Invisible auto-recovery feels magical when it works and maddening when it doesn’t.

---

# 20. Optional final packaging recommendation

Если ты хочешь раздать это нескольким субагентам максимально быстро, practical packaging should be:

1. **This v2 spec** as the master doc.
2. A tiny `contracts.md` extracted from sections 16.3, 16.4, 17.5, 17.6, 17.10.
3. A `fixtures/` folder with Codex JSONL and Hermes SSE examples.
4. One short prompt per subagent from section 18.3.

То есть master doc остаётся длинным и системным, а на execution layer ты даёшь агентам короткие bounded packets.

---

# 21. Final architecture statement, updated after the repo-chain review

> Build FounderOS into the only root shell and operator control plane. Keep Discovery/Execution/Review as shell-owned surfaces. Add Sessions/Groups/Accounts/Recoveries under Execution. Keep the local Open WebUI adaptation as a host-aware embedded workspace app rather than rewriting it into the shell. Preserve Open WebUI visual DNA inside the workspace. Port Hermes WebUI’s operational strengths — three-panel ergonomics, session organization, tool/approval cards, retry/edit flows, context-usage visibility, and workspace browsing — into that adaptation. Normalize Codex JSONL and Hermes SSE into one append-only event model. Use OpenAI app-server `account/rateLimits/read` and `account/rateLimits/updated` as the canonical quota source for ChatGPT-authenticated accounts, treat API-key accounts as usage-priced capacity, and keep router data as derived scheduling telemetry only. Use cabinet as the reference for calm, object-first navigation and sessions-as-activity, not as a UI clone. citeturn998503view5turn309909view5turn144274view2turn362171view0turn966179view0turn362592view1turn678362view2turn454621view4turn454621view6turn214681view0

---

# 22. Short operator memo you can hand to yourself or a lead integrator

Если совсем коротко:

- **Root shell = FounderOS.**
- **Inner workspace = Open WebUI look + Hermes behavior.**
- **Event substrate = Codex JSONL + Hermes SSE normalized into one model.**
- **Quota truth = OpenAI app-server for ChatGPT-auth accounts.**
- **Accounts board, recovery lane, approvals board live in FounderOS, not inside chat.**
- **Workspace stays beautiful and calm because Open WebUI identity is preserved.**
- **System stays useful because FounderOS owns operator complexity instead of dumping it into the transcript.**

