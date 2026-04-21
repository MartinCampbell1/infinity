# agent-04.md — Hermes behavior porter

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

Перенести в adaptation именно те behaviors, которые делают Hermes сильным workspace, не разрушая визуальную идентичность Open WebUI.

## В зоне ответственности

- session tags / archive / pin / grouping
- inline tool cards
- approval cards
- retry/edit flows
- resizable right panel
- context usage footer
- workspace ergonomics и scanability

## Вне зоны ответственности

- Hermes backend shortcuts, завязанные на module-level state или process-global env
- FounderOS shell
- quota/account boards
- durable approvals backend как источник правды

### Поведенческие инварианты

- Поведение должно жить на чистом local state + host events + явных API.
- Нельзя тащить process-local pending state как truth.
- Tool/approval UI должен уметь поднимать сигналы наверх через workspace bridge.
- Retry/edit flows не должны ломать transcript continuity.
- Правая панель должна быть resizable, но не превращаться в ещё один dashboard column.

### Что считается успехом

Workspace получает **Hermes-grade ergonomics**, но визуально остаётся **Open WebUI-first surface**.

## Зависимости и параллельность

- Можно стартовать параллельно с Agent 03
- Для approval state нужно согласовать shape с Agent 07
- Для tool cards полезно согласовать event mapping с Agent 05

## Что нужно сделать

1. Реализовать или проверить session organization features: tags, pin, archive, grouping
2. Добавить inline tool cards, которые читаются в потоке транскрипта
3. Добавить approval cards с понятными CTA
4. Добавить retry last assistant response
5. Добавить edit from prior user message
6. Добавить resizable right panel для files/artifacts/approvals
7. Добавить context usage footer без визуального шума

## Definition of done

- Workspace заметно сильнее по ergonomics, но не выглядит как новый продукт
- Новые поведения работают и в standalone, и в embedded mode
- Нет зависимости от in-memory backend truths
- Transcript остаётся чистым, спокойным и scan-friendly

## Что отдать на handoff

- Список UX behaviors и их entry points
- GIF/скриншоты retry/edit/tool-cards/right-panel/footer
- Описание состояний approval cards
- Короткий note о компромиссах между Hermes behavior и Open WebUI visual DNA

## Рекомендуемая ветка

`feat/openwebui-hermes-behaviors`

## Готовый prompt для передачи агенту

```text
Your mission is to port Hermes WebUI’s strongest session/workspace behaviors into the existing Open WebUI adaptation without changing the overall visual DNA. Focus on session organization, tool activity cards, approvals, retry/edit flows, context usage visibility, and right-panel workspace ergonomics. Do not port Hermes backend shortcuts that rely on module-level state or process-global environment variables.
```
