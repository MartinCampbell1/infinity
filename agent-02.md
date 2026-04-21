# agent-02.md — FounderOS workspace host engineer

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

Построить route-level host container, который красиво и предсказуемо встраивает Open WebUI adaptation в FounderOS.

## В зоне ответственности

- workspace host route
- iframe/host container или эквивалентный same-origin embed
- postMessage handshake
- host meta strip
- optional host drawer для approvals/logs/tool signals
- error/loading/reauth states на стороне host

## Вне зоны ответственности

- внутренний UI adaptation
- FounderOS boards вне workspace host
- event normalization layer
- quota source adapters

### Контракт host ↔ workspace

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

Никаких ad-hoc message names. Никаких скрытых side channels.

## Зависимости и параллельность

- Нужно заранее синхронизироваться с Agent 03 по bridge contract
- Может использовать mock bootstrap payload до готовности Agent 05/06/07
- Deep links должны совпасть с route work Agent 01

## Что нужно сделать

1. Создать route-level host container для `/execution/workspace/[sessionId]`
2. Реализовать bootstrap handshake и event listeners
3. Добавить сверху тонкий meta strip с project/account/model/quota/phase
4. Добавить host drawer для approvals/logs/tool activity, не ломая центральный workspace
5. Сделать reload-safe, deep-link-safe, same-origin-safe поведение
6. Подготовить путь для миграции от iframe к более глубокой интеграции без смены внешнего контракта

## Definition of done

- Embedded child стабильно присылает `workspace.ready`
- Host шлёт `founderos.bootstrap` и умеет обновлять meta
- Tool/error/approval signals видны в host, не вторгаясь в chat canvas
- Обновление страницы не приводит к потере linkability или scope

## Что отдать на handoff

- Карта host route и bridge lifecycle
- Список host events и UI reactions
- Скриншоты host route в idle/running/error/pending-approval состояниях
- Короткая заметка об ограничениях embed mode

## Рекомендуемая ветка

`feat/founderos-workspace-host`

## Готовый prompt для передачи агенту

```text
You are implementing the FounderOS side of the embedded session workspace. Build a route-level host component that embeds a same-origin workspace app, sends bootstrap context, and listens to workspace events. The outer shell remains FounderOS. Optimize for minimalism, robustness, and future migration away from iframe if needed. Do not redesign the inner workspace.
```
