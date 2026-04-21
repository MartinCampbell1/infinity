# agent-05.md — Event normalization engineer

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

Построить canonical normalized event layer, который превращает CLI/SSE execution в clean UI substrate.

## В зоне ответственности

- normalized event contract
- Codex JSONL adapter
- Hermes SSE adapter
- append-only event storage
- session/group projections
- fixtures и determinism

## Вне зоны ответственности

- финальные UI visuals
- Open WebUI layout work
- shell IA/layout work
- router/load-balancer implementation

### Канонический event contract

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

Из этого контракта должны собираться `ExecutionSessionSummary` и group-level projections. UI не должен знать исходный shape событий от Codex или Hermes.

## Зависимости и параллельность

- Можно стартовать сразу
- Поставляет ключевые данные для Agent 01, 02, 07 и 08
- Нужно периодически синхронизироваться с Agent 06 по `quota.updated` и `account.switched`

## Что нужно сделать

1. Описать и зафиксировать `NormalizedExecutionEvent`
2. Реализовать Codex JSONL adapter
3. Реализовать Hermes SSE adapter
4. Построить append-only storage
5. Построить session/group reducers и projections
6. Сделать fixture-based tests на детерминированность

## Definition of done

- Одна и та же fixture всегда даёт один и тот же projection
- Raw source differences скрыты за единым контрактом
- UI не зависит от source-specific event shapes
- Можно восстановить session/group state из append-only истории

## Что отдать на handoff

- Схема event adapters и reducers
- Набор fixtures: Codex JSONL, Hermes SSE, mixed session
- Таблица соответствия raw events -> normalized kinds
- Пример session projection и group projection

## Рекомендуемая ветка

`feat/event-normalization`

## Готовый prompt для передачи агенту

```text
Build a normalized execution event layer that can ingest Codex JSONL events and Hermes SSE events, store them append-only, and materialize calm session/group summaries for the UI. The UI must not depend on source-specific event shapes. Optimize for clarity, determinism, and testability.
```
