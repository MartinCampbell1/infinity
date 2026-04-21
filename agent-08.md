# agent-08.md — QA / contracts / integration engineer

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

Удержать команду от расползания контрактов и хаоса во время параллельной разработки.

## В зоне ответственности

- frozen interfaces
- fixtures
- projection invariant tests
- host↔workspace smoke tests
- visual regression checklist
- integration test matrix
- contract-diff review gate

## Вне зоны ответственности

- feature ownership за отдельные boards/workspaces
- изменение продуктового направления
- ad-hoc ослабление контрактов ради скорости

### Ты — владелец contract freeze

Заморожены 5 ключевых контрактов:

1. `ExecutionSessionSummary`
2. `NormalizedExecutionEvent`
3. `SessionWorkspaceHostContext` и Host/Workspace message union
4. `AccountQuotaSnapshot` и `AccountCapacityState`
5. Approval response API

Если кто-то хочет поменять один из этих контрактов:

- сначала открывается отдельный contract-diff PR;
- потом это валидируешь ты;
- только потом можно менять реализацию в рабочих ветках.

### Обязательные ключевые флоу для smoke coverage

1. Sessions board → open workspace → bootstrap OK.
2. Tool activity из workspace видна в host.
3. Approval request виден и в workspace, и в shell; ответ проходит успешно.
4. Failed session → retry same account / fallback account.
5. Quota pressure update виден в Accounts board и в workspace meta.

## Зависимости и параллельность

- Стартует сразу и идёт параллельно со всеми
- Получает материалы от Agent 02, 03, 05, 06, 07
- Блокирует merge любого спорного контрактного изменения

## Что нужно сделать

1. Зафиксировать contract fixtures
2. Написать adapter fixture tests
3. Написать projection invariant tests
4. Написать host↔workspace smoke tests
5. Сделать embedded visual regression checklist
6. Собрать integration matrix на основные user flows

## Definition of done

- Ни один PR не мержится без contract/fixture green
- Пять главных flows покрыты smoke tests
- Любые спорные контрактные изменения проходят через QA owner
- Параллельная разработка остаётся безопасной

## Что отдать на handoff

- Список frozen fixtures и test commands
- Integration matrix по flows и ownership
- Checklist для manual regression перед merge
- Короткий отчёт о выявленных contract drifts

## Рекомендуемая ветка

`feat/contracts-and-qa-gate`

## Готовый prompt для передачи агенту

```text
You are the integration and QA owner for the unified control plane. Freeze the core contracts, create fixtures for Codex JSONL and Hermes SSE, validate projections, and guard the FounderOS to workspace bridge with smoke tests. Your job is to make parallel development safe.
```
