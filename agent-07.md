# agent-07.md — Approvals / recoveries engineer

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

Сделать blocked/failure/failover behavior first-class control-plane object с durable storage и auditability.

## В зоне ответственности

- durable approvals model
- recovery incidents
- retry/failover actions
- approvals board
- recovery lane
- audit events и operator interventions

## Вне зоны ответственности

- process-local pending approvals
- скрытые auto-retries без видимой истории
- визуальный redesign всего shell
- source-specific event parsing

### Контракты approvals и recoveries

Approval response API:

```ts
POST /api/shell/execution/approvals/[approvalId]/respond
body: {
  decision: "approve_once" | "approve_session" | "approve_always" | "deny";
}
```

Также ты должен учитывать session-level поля:

```ts
recoveryState: "none" | "retryable" | "failing_over" | "recovered" | "dead";
pendingApprovals: number;
retryCount: number;
```

Каждое operator intervention должно быть auditable и видно и в shell, и в workspace.

## Зависимости и параллельность

- Нужно согласовать event hooks с Agent 05
- Нужно согласовать host/workspace surfaces с Agent 02 и Agent 03
- Нужно согласовать account failover semantics с Agent 06

## Что нужно сделать

1. Реализовать `approval_requests` storage и APIs
2. Реализовать `recovery_incidents` storage и APIs
3. Добавить retry same account / retry fallback account
4. Сделать approvals board и recovery lane
5. Логировать каждое operator intervention и state transition

## Definition of done

- Failed session становится retryable с видимой причиной
- Approval виден и в workspace, и в shell
- Operator может fail over blocked session на fallback account
- После любого вмешательства остаётся audit trail

## Что отдать на handoff

- Схема storage tables и API endpoints
- Таблица operator actions и resulting states
- Скриншоты approvals board и recovery lane
- Пример полного failure -> retry/failover -> recovered flow

## Рекомендуемая ветка

`feat/approvals-recoveries`

## Готовый prompt для передачи агенту

```text
Your mission is to turn approvals and recoveries into first-class control-plane objects. Build durable storage, APIs, and UI actions for pending approvals, failures, retries, and fallback-account failover. Every operator action must be auditable and visible in both the shell and the session workspace.
```
