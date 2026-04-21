# agent-06.md — Quota / accounts engineer

## Общий продуктовый контекст

Мы строим **один продукт**, но **не один фронтенд и не один репозиторий**.

Финальная композиция фиксирована:

- **FounderOS** = root shell и operator-facing control plane.
- **Open WebUI adaptation** = основное conversation/workspace-пространство.
- **Hermes** = источник поведенческой логики workspace, а не третий root app.
- **Codex CLI / app-server / structured events** = execution substrate.
- **cabinet** = reference по информационной архитектуре, сайдбарам и спокойному object-first UX.

Пользователь должен чувствовать **одну систему с двумя режимами**:

1. **Control mode** — FounderOS shell: проекты, сессии, группы, аккаунты, recoveries, approvals, review.
2. **Work mode** — session/workspace route: Open WebUI visual DNA + Hermes behavior.

## Repo boundary rule

- `/Users/martin/FounderOS`, `/Users/martin/open-webui`, `/Users/martin/hermes-webui` и любой внешний `cabinet` snapshot всегда read-only.
- Если нужен код, шаблон или reference fragment из upstream, сначала копируй его в `/Users/martin/infinity`.
- Редактировать можно только файлы внутри `/Users/martin/infinity/apps/*`.
- `unified-control-plane-super-spec-v2-2026-04-10.md` — master-doc по product direction; `agents.md` — merge/ownership rulebook.

## Неподвижные правила

1. FounderOS — единственный root shell.
2. Open WebUI adaptation — единственный основной workspace UI.
3. Hermes — reference и feature source, а не третий root app.
4. Quota/account truth сначала берётся из upstream/official surfaces; router-derived данные допустимы только как advisory telemetry.
5. CLI/SSE events сначала нормализуются, потом проецируются, и только потом рендерятся.
6. Approvals и recoveries — durable first-class objects.
7. Встроенный workspace не должен превращаться в dashboard.
8. Нельзя переписывать Open WebUI на React и нельзя импортировать Svelte-части как нативные React-компоненты.

## Что нельзя делать

- giant rewrite вместо thin integration seams;
- monolithic mega-SPA “на всё сразу”;
- generic AI dashboard ради dashboard;
- process-local approvals как production truth;
- raw CLI JSONL в UI без нормализации;
- смешивание operator surfaces и chat surfaces в один хаос.

## Обязательные документы перед стартом

1. `unified-control-plane-super-spec-v2-2026-04-10.md`
2. `latest-plan.md`
3. `agents.md`

## Миссия

Построить account capacity layer с правильной source-of-truth hierarchy и честным разделением ChatGPT- и API-key-семантик.

## В зоне ответственности

- app-server quota adapter
- account capacity derivation
- accounts board API
- live quota updates
- separation of ChatGPT vs API-key semantics
- preferred-account selection support

## Вне зоны ответственности

- router-derived values как canonical truth
- fake ChatGPT quota buckets для API-key accounts
- глубокие UI redesigns boards
- workspace transcript rendering

### Контракт quota / capacity

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

### Source-of-truth hierarchy

1. `openai_app_server` — canonical, если доступен.
2. `chatgpt_usage_panel` — backup/manual-ish fallback.
3. `observed_runtime` — derived fallback.
4. `router_derived` — advisory only, не canonical truth.

API-key accounts показывают usage-priced/capacity model, а не притворяются ChatGPT bucket model.

## Зависимости и параллельность

- Может стартовать независимо
- Нужно синхронизироваться с Agent 05 по `quota.updated` events
- Нужно отдать derived shape Agent 01/02 для Accounts board и host meta strip

## Что нужно сделать

1. Реализовать `AppServerQuotaSource`
2. Разделить ChatGPT-authenticated и API-key accounts
3. Вычислять `pressure` и `schedulable`
4. Собрать `/api/shell/accounts/quotas`
5. Добавить лёгкий live update path
6. Поддержать shell-level preferred account selection

## Definition of done

- ChatGPT accounts показывают upstream quota buckets
- API-key accounts честно показывают другой capacity model
- Shell умеет выбрать preferred account для новых сессий
- Система не врёт пользователю о том, что именно является source of truth

## Что отдать на handoff

- Карта quota sources и fallback behavior
- Примеры JSON для разных authMode
- Документация по pressure/schedulable derivation
- Список известных edge cases и degraded modes

## Рекомендуемая ветка

`feat/quota-capacity-layer`

## Готовый prompt для передачи агенту

```text
Build the quota and account-capacity layer for the control plane. Use official upstream rate-limit reads when the account auth mode is ChatGPT or externally managed ChatGPT tokens. Treat API-key accounts as usage-priced access rather than fake ChatGPT quota buckets. Expose derived pressure and schedulable states for the shell.
```
