# agent-01.md — FounderOS shell / IA engineer

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

Превратить FounderOS execution section в реальный operator board без ломки текущего shell.

## В зоне ответственности

- routes и route families внутри FounderOS
- global navigation и Execution children
- session/group/account/recovery boards
- route scope expansion: session_id, group_id, account_id, workspace_id
- deep links в `/execution/workspace/[sessionId]`
- mock-backed pages и calm IA

## Вне зоны ответственности

- Open WebUI adaptation
- Hermes code
- quota adapters
- event adapters
- внутренний workspace UI

### Контракт, который ты обязан уважать

Главный объект для листингов и board rows:

```ts
export interface ExecutionSessionSummary {
  id: string;
  projectId: string;
  projectName: string;
  groupId?: string | null;
  workspaceId?: string | null;
  accountId?: string | null;
  provider: "codex" | "hermes" | "openwebui" | "mixed" | "unknown";
  title: string;
  status:
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
  phase?: string | null;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  pendingApprovals: number;
  toolActivityCount: number;
  retryCount: number;
  recoveryState: "none" | "retryable" | "failing_over" | "recovered" | "dead";
  quotaPressure: "low" | "medium" | "high" | "exhausted" | "unknown";
  unreadOperatorSignals: number;
}
```

Ты можешь временно работать на моках, но shape должен совпадать с этим контрактом.

## Зависимости и параллельность

- Можно стартовать сразу на моках
- Потом подцепить реальные summaries от Agent 05
- Нужно заранее согласовать route names с Agent 02

## Что нужно сделать

1. Добавить в shell ветку `Execution -> Sessions / Groups / Accounts / Recoveries`
2. Расширить route scope, чтобы session/group/account/workspace переживали переходы по shell
3. Собрать mock-backed страницы, которые уже выглядят как control plane, а не как заглушки
4. Сделать deep link из session rows/cards в `/execution/workspace/[sessionId]`
5. Сохранить текущие nav/shortcut semantics FounderOS
6. Подготовить удобные места в shell для будущих live projections без переделки IA

## Definition of done

- Оператор открывает `/execution/sessions` и сразу понимает состояние системы
- Клик по session ведёт в `/execution/workspace/[sessionId]`
- Scope не теряется между Sessions → Groups → Accounts → Recoveries → Workspace
- Shell не превращается в chat app и не теряет текущую навигационную логику

## Что отдать на handoff

- Список новых route files и nav changes
- Описание route params/scope behavior
- Скриншоты Sessions / Groups / Accounts / Recoveries
- Короткая заметка, где shell ожидает данные и каким shape

## Рекомендуемая ветка

`feat/founderos-shell-sessions`

## Готовый prompt для передачи агенту

```text
You are working only inside FounderOS. Extend the existing shell into a session-aware operator control plane without redesigning the shell. Add Execution children for Sessions, Groups, Accounts, and Recoveries. Extend route-scope with session_id, group_id, account_id, and workspace_id. Build mocked but realistic route pages and deep links into /execution/workspace/[sessionId]. Preserve the current navigation model, naming conventions, and calm tone. Do not touch Open WebUI or Hermes code.
```
