# agent-03.md — Open WebUI host-mode engineer

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

Сделать local Open WebUI adaptation способным жить как embedded workspace inside FounderOS, не теряя Open WebUI visual DNA.

## В зоне ответственности

- `embedded=1` mode
- hiding outer chrome/nav
- bridge listener/emitter
- session meta bar inside embedded mode
- upward events к host shell
- совместимость standalone и embedded режимов

## Вне зоны ответственности

- FounderOS routes/boards
- FounderOS host container
- quota truth logic
- event normalization backend

### Контракт embed mode

Ты обязан поддержать bridge-контракт из `agents.md` и принимать как минимум:

- `founderos.bootstrap`
- `founderos.account.switch`
- `founderos.session.retry`
- `founderos.session.focus`
- `founderos.session.meta`

И отправлять наверх как минимум:

- `workspace.ready`
- `workspace.session.updated`
- `workspace.tool.started`
- `workspace.tool.completed`
- `workspace.approval.requested`
- `workspace.file.opened`
- `workspace.error`
- `workspace.deepLink`

`embedded=1` не должен ломать standalone mode. Это дополнительный host-aware режим, а не новый продукт.

## Зависимости и параллельность

- Нужно синхронизироваться с Agent 02 по bridge contract и ready/bootstrap lifecycle
- Полезно согласовать сигналы tool/approval/error с Agent 04
- Финальные данные статусов потом может уточнить Agent 05

## Что нужно сделать

1. Добавить `?embedded=1` или эквивалентный флаг режима
2. Скрыть глобальный chrome/nav в embedded mode
3. Добавить `founderos/bridge.ts` или аналогичный модуль связи
4. Добавить тонкую session meta bar, совместимую с host meta strip
5. Эмитить наверх tool/approval/error/file-open/session-update events
6. Сохранить standalone Open WebUI look-and-feel и маршруты

## Definition of done

- `embedded=1` даёт workspace-only UI без внешнего chrome
- Bootstrap от host принимается стабильно и idempotent
- Standalone visual identity не ломается
- Embedded mode ощущается как Open WebUI, а не как dashboard

## Что отдать на handoff

- Список изменённых route/layout files
- Документация по embed mode и bridge lifecycle
- Скриншоты standalone vs embedded
- Набор ручных smoke steps: загрузка, reconnect, focus change, error event

## Рекомендуемая ветка

`feat/openwebui-embedded-mode`

## Готовый prompt для передачи агенту

```text
You are working only in the local Open WebUI adaptation. Add a FounderOS embedded mode. In embedded mode the app must hide outer chrome, preserve the chat/file/workspace visual identity, accept bootstrap context from the parent shell, and emit postMessage events back up. Do not redesign the app. Do not make it look like a dashboard. Keep it feeling like Open WebUI, just host-aware.
```
