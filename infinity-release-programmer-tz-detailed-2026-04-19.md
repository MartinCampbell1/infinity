# Infinity — максимально подробное ТЗ для программиста / автономного агента

Дата: `2026-04-19`  
Статус: `detailed implementation spec`  
Назначение: `пошагово довести Infinity до реально рабочего release-like состояния`  
Приоритет: `P0 / blocker removal`

---

## 0. Как читать этот документ

Это не обзорный план и не product summary.  
Это **исполнительское ТЗ**: что именно и в каких местах проекта нужно менять, какие текущие места считаются неправильными, какие функции нужно переписать/добавить, что должно быть на выходе и какими тестами это подтверждать.

Если коротко:

1. сначала закрывается topology;
2. потом shell ↔ workspace seam;
3. потом убирается mock/placeholder truth с critical path;
4. потом чинится orchestration lifecycle;
5. потом runtime/durability;
6. потом QA/release gate.

Нельзя перескакивать к polish, пока не закрыт хотя бы один рабочий end-to-end path.

---

## 1. Главный диагноз

Проблема проекта сейчас не в том, что “не хватает пары функций”.

Проблема в том, что:

- есть много реализованных кусков;
- есть routes, API, типы, формы;
- но **единая рабочая продуктовая траектория не закрыта**.

### Подтверждённые симптомы

1. `shell` реально работает на `127.0.0.1:3737`, но `/` там даёт `404`.
2. `work-ui` отдельно живёт на `5173`.
3. `shell` ожидает `work-ui` на `3101`.
4. `work-ui` всё ещё тянет legacy API assumptions на `8080`.
5. `rollout-status` показывал:
   - `ready = false`
   - `integrationState = "placeholder"`
   - `workUiBaseUrl = "http://127.0.0.1:3101"`
   - `launchSecretConfigured = false`
6. Workspace route в shell строится через `buildMockWorkspaceLaunchViewModel(...)`.
7. `review` route в shell — placeholder.
8. `execution` home и часть board-срезов опираются на функции с `mock_*` семантикой.
9. Planner автоматически и слишком рано переводит lifecycle в `planning`, хотя по продуктовой логике brief approval и planner launch — это разные шаги.
10. `work-ui:test` работает в watch-mode, а не в CI-safe mode.

---

## 2. Неподвижные решения по умолчанию

Если пользователь явно не дал другое решение, исполнитель обязан считать верным именно это.

### 2.1 Кто владеет `/`

По умолчанию:

- route `/` принадлежит `shell`;
- `work-ui` не является root-shell продуктом;
- `work-ui` существует как embedded workspace внутри shell-owned маршрута.

### 2.2 Как трактовать `work-ui`

`apps/work-ui` = это **workspace app**, а не второй global app shell.

Его обязанности:

- transcript;
- composer;
- artifacts/files;
- embedded host mode;
- Hermes-grade workspace behavior.

Его не нужно превращать в:

- dashboard;
- operator navigation hub;
- глобальный control plane.

### 2.3 Что считать unacceptable truth на critical path

На release-critical path unacceptable:

- `placeholder`;
- `ExecutionLegacyPlaceholderSurface`;
- `buildMockWorkspaceLaunchViewModel(...)`;
- функции/страницы, которые визуально выглядят “готово”, но фактически только маскируют mock truth;
- synthetic orchestration lifecycle, который создаёт красивые записи, но не даёт реальной операционной ценности.

---

## 3. Обязательный порядок чтения кода перед правками

Перед началом реализации исполнитель обязан прочитать:

1. `AGENTS.md`
2. `agents.md`
3. `unified-control-plane-super-spec-v2-2026-04-10.md`
4. `latest-plan.md`
5. `infinity-release-programmer-tz-2026-04-19.md`
6. этот файл: `infinity-release-programmer-tz-detailed-2026-04-19.md`

Без этого нельзя начинать implementation.

---

## 4. Карта основных проблем по файлам

Ниже перечислены конкретные файлы и текущая проблема в них.

### 4.1 Root/frontdoor

- `apps/shell/apps/web/app/page.tsx`
  - файла нет;
  - отсюда корневой `shell /` отдаёт `404`.

### 4.2 Shell execution home

- `apps/shell/apps/web/app/(shell)/execution/page.tsx`
  - тянет:
    - `buildMockApprovalRequestsDirectory`
    - `buildMockRecoveryIncidentsDirectory`
    - `buildMockOperatorActionAuditDirectory`
    - `listMockAccounts`
  - страница выглядит как control plane entry, но семантически всё ещё сидит на mock-named слое.

### 4.3 Review

- `apps/shell/apps/web/app/(shell)/execution/review/page.tsx`
  - сейчас это `ExecutionLegacyPlaceholderSurface`
  - это нельзя считать готовым release route.

### 4.4 Workspace handoff page

- `apps/shell/apps/web/app/(shell)/execution/workspace/[sessionId]/page.tsx`
  - использует `buildMockWorkspaceLaunchViewModel`
  - то есть shell workspace route фактически построен на mock-named контексте.

### 4.5 Rollout config

- `apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts`
  - `DEFAULT_WORK_UI_BASE_URL = "http://127.0.0.1:3101"`
  - это расходится с фактическим `work-ui` dev runtime.

- `apps/shell/apps/web/lib/server/control-plane/workspace/rollout-config.ts`
  - даёт локальные дефолты, которые не совпадают с тем, что реально запускается;
  - из-за этого `rollout-status` врёт относительно фактического `work-ui`.

- `apps/shell/apps/web/lib/server/control-plane/workspace/deployment.ts`
  - на базе вышележащих резолверов возвращает `ready=false`, stale base URL и несогласованный rollout state.

### 4.6 Workspace bootstrap/session

- `apps/shell/apps/web/lib/server/control-plane/workspace/bootstrap.ts`
  - использует `buildMockWorkspaceLaunchSessionContext`
  - shell-authored bootstrap всё ещё зависит от mock-named session context builder.

- `apps/shell/apps/web/lib/server/control-plane/workspace/session.ts`
  - session exchange работает, но зависит от текущего launch seam.

- `apps/shell/apps/web/lib/server/control-plane/workspace/launch-token.ts`
  - в основе рабочий, но должен быть стабилизирован относительно env/runtime topology.

### 4.7 Control-plane storage semantics

- `apps/shell/apps/web/lib/server/control-plane/state/store.ts`
  - стартует с `integrationState = "placeholder"`
  - local file-backed durable mode маркируется как `mock_file_backed`
  - это путает implementation truth и demo/mock semantics.

### 4.8 Orchestration lifecycle

- `apps/shell/apps/web/lib/server/orchestration/briefs.ts`
  - approved brief может слишком рано запустить task graph path.
  - `approved` и `planner launched` должны быть разными шагами.

- `apps/shell/apps/web/lib/server/orchestration/task-graphs.ts`
  - `ensureTaskGraphForApprovedBrief()` создаёт graph автоматически.
  - по продуктовой логике это должен делать explicit planner action.

- `apps/shell/apps/web/lib/server/orchestration/planner.ts`
  - строит фиксированный 3-unit template graph.
  - этого недостаточно для real project factory.

- `apps/shell/apps/web/lib/server/orchestration/assembly.ts`
  - assembly строится из synthetic attempt URI вида `attempt://...`
  - output path локальный и формальный.

- `apps/shell/apps/web/lib/server/orchestration/verification.ts`
  - verifier проверяет mostly structural consistency, а не real validation gates.

- `apps/shell/apps/web/lib/server/orchestration/delivery.ts`
  - delivery — это local path + `open` command.
  - нет real handoff semantics.

### 4.9 Work UI host mode and auth

- `apps/work-ui/src/lib/founderos/shell-origin.ts`
  - локальные work-ui origins жёстко завязаны на `3101`
  - не учитывают реальный `5173`.

- `apps/work-ui/src/lib/constants.ts`
  - dev base URL завязан на `8080`
  - это legacy Open WebUI assumption, конфликтующая с FounderOS embedded flow.

- `apps/work-ui/src/routes/(app)/+layout.svelte`
  - в embedded bring-up path до сих пор много ранних обращений к `localStorage.token`
  - присутствует `goto('/auth')` fallback, который легко ломает embedded flow
  - bootstrap/session exchange path не изолирован достаточно жёстко от legacy auth path.

### 4.10 Work UI project factory pages

- `apps/work-ui/src/routes/(app)/project-intake/+page.svelte`
  - создаёт initiative + initial brief правильно по направлению, но зависит от shell origin resolution.

- `apps/work-ui/src/routes/(app)/project-brief/[id]/+page.svelte`
  - UI already separates “Approve brief” and “Launch planner”, но backend semantics всё ещё не полностью соответствуют этому.

- `apps/work-ui/src/routes/(app)/project-run/[id]/+page.svelte`
  - опирается на current taskGraph/batch/assembly model, который пока не даёт real runtime truth.

- `apps/work-ui/src/routes/(app)/project-result/[id]/+page.svelte`
  - опирается на current assembly/verification/delivery model, который пока mostly structural.

### 4.11 Execution kernel

- `services/execution-kernel/internal/service/service.go`
  - `InMemory` implementation
  - нет restart-safe persistence.

- `services/execution-kernel/internal/handler/http.go`
  - HTTP API минимален и достаточен только для scaffold.

### 4.12 Test harness

- `apps/work-ui/package.json`
  - `"test:frontend": "vitest --passWithNoTests"`
  - это watch-mode, а не CI run mode.

- root `package.json`
  - `"work-ui:test": "npm run test:frontend --workspace open-webui"`
  - значит root test command тоже не CI-safe.

---

## 5. Главные implementation-пакеты

Дальше идёт уже не описание проблемы, а конкретные пакеты работ.

---

# Пакет A — сделать единый frontdoor и устранить `shell / = 404`

## A.1 Что нужно получить на выходе

Пользователь должен открыть один root URL и попасть в корректный shell-owned frontdoor.

Минимально допустимый вариант:

- `shell /` больше не возвращает `404`;
- `/` либо:
  - рендерит shell-owned homepage;
  - либо делает контролируемый redirect в `/execution`.

Для текущей стадии проекта **допустим redirect на `/execution`**, если он:

- реализован в коде явно;
- покрыт smoke-проверкой;
- согласован с идеей, что shell владеет root entry.

## A.2 Какие файлы менять

- создать `apps/shell/apps/web/app/page.tsx`
- при необходимости скорректировать:
  - `apps/shell/apps/web/app/(shell)/layout.tsx`
  - `apps/shell/apps/web/components/shell/shell-frame.tsx`
  - `scripts/smoke-shell-contract.mjs`

## A.3 Что сделать

### Вариант 1 — минимально безопасный

Создать `app/page.tsx` и сделать server-side redirect на `/execution`.

Пример ожидаемой логики:

```ts
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/execution");
}
```

### Вариант 2 — более правильный продуктово

Создать `app/page.tsx`, который:

- рендерит shell-owned landing state;
- показывает:
  - active initiative;
  - current delivery;
  - entry links в `/execution`, `/execution/sessions`, `/execution/accounts`;
- не встраивает `work-ui` напрямую.

Если делать вариант 2, нельзя превращать `/` в новый dashboard-продукт.  
Он должен оставаться thin shell frontdoor.

## A.4 Acceptance criteria

1. `GET http://127.0.0.1:3737/` больше не отдаёт `404`
2. smoke test явно проверяет root path
3. по коду очевидно, что `/` принадлежит shell, а не work-ui

## A.5 Обязательные тесты

- обновить shell smoke / route checks
- добавить или скорректировать smoke в `scripts/smoke-shell-contract.mjs`

---

# Пакет B — нормализовать runtime topology: `3737 / 5173 / 3101 / 8080`

## B.1 Цель

В проекте должен существовать один согласованный runtime contract.

Сейчас этого нет.

## B.2 Какие файлы менять

- `apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts`
- `apps/shell/apps/web/lib/server/control-plane/workspace/rollout-config.ts`
- `apps/shell/apps/web/lib/server/control-plane/workspace/deployment.ts`
- `apps/work-ui/src/lib/founderos/shell-origin.ts`
- `apps/work-ui/src/lib/constants.ts`
- при необходимости:
  - root `package.json`
  - `apps/work-ui/vite.config.ts`

## B.3 Что именно менять

### B.3.1 `workspace-launch.ts`

Сейчас:

```ts
export const DEFAULT_WORK_UI_BASE_URL = "http://127.0.0.1:3101";
```

Это нужно убрать как stale default.

### Требование

Минимально допустимо:

- заменить на `http://127.0.0.1:5173` для local dev;
- или полностью убрать магический default и оставить только explicit env / resolver.

### Что лучше сделать

Оставить один helper-источник, например:

```ts
export const DEFAULT_LOCAL_WORK_UI_BASE_URL = "http://127.0.0.1:5173";
```

и использовать его только в non-strict local mode.

### B.3.2 `rollout-config.ts`

Нужно переписать/доработать:

- `resolveWorkUiBaseUrlForLaunch`
- `resolveShellPublicOriginForLaunch`
- `resolveWorkspaceLaunchSecret`

#### Требуемая логика для `resolveWorkUiBaseUrlForLaunch`

1. Сначала canonical env:
   - `FOUNDEROS_WORK_UI_BASE_URL`
   - `NEXT_PUBLIC_FOUNDEROS_WORK_UI_BASE_URL`
   - `WORK_UI_BASE_URL`
   - `NEXT_PUBLIC_WORK_UI_BASE_URL`
2. Если strict mode включён — без env бросать ошибку.
3. Если strict mode выключен — использовать **один** local default, согласованный с реальным dev (`5173`), а не `3101`.

#### Нужно добавить helper

```ts
function resolveLocalWorkUiBaseUrl() { ... }
```

и использовать его в non-strict режиме.

### B.3.3 `deployment.ts`

`buildWorkspaceLaunchRolloutStatus()` должен перестать возвращать stale topology.

После фикса он должен показывать:

- реальный `shellPublicOrigin`
- реальный `workUiBaseUrl`
- `launchSecretConfigured = true`, если секрет действительно настроен
- `ready = true`, если topology и secrets реально пригодны для launch

### B.3.4 `shell-origin.ts`

Сейчас `LOCAL_WORK_UI_ORIGINS` знает только про `3101`.

Нужно:

1. включить `5173` и `5050`
2. не считать `5173` “чужим origin”
3. не полагаться на случайный `window.location.origin`, если embedded mode уже дал `hostOrigin`

Рекомендуемое изменение:

```ts
const LOCAL_WORK_UI_ORIGINS = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5050",
  "http://localhost:5050",
  "http://127.0.0.1:3101",
  "http://localhost:3101",
]);
```

### B.3.5 `constants.ts`

Сейчас:

```ts
export const WEBUI_HOSTNAME = browser ? (dev ? `${location.hostname}:8080` : ``) : '';
```

Это legacy assumption.

Нужно вынести API base resolution в отдельную функцию, например:

```ts
export const resolveWebUiBaseUrl = () => { ... }
export const resolveWebUiApiBaseUrl = () => { ... }
```

### Требуемая логика

1. В embedded FounderOS mode:
   - не использовать hardcoded `8080`;
   - предпочитать same-origin либо explicit public env.
2. В standalone Open WebUI mode:
   - можно сохранить legacy fallback, если он всё ещё нужен.

### B.3.6 Root package scripts

Если для локального dev по умолчанию нужен `5173`, убедиться, что:

- `work-ui:dev`
- `shell:dev`
- документация в агентах/ТЗ

не противоречат этому.

## B.4 Acceptance criteria

1. В коде больше нет stale default topology `shell->3101`, если реально всё живёт на `5173`
2. `rollout-status` возвращает согласованный topology state
3. `work-ui` корректно резолвит `shellOrigin`
4. `WEBUI_API_BASE_URL` больше не ломает embedded bring-up через `8080`

---

# Пакет C — сделать shell workspace launch path живым, а не mock-named

## C.1 Цель

Shell route `/execution/workspace/[sessionId]` должен строиться не через mock-named launch builder, а через live session truth builder.

## C.2 Какие файлы менять

- `apps/shell/apps/web/lib/server/control-plane/workspace/mock.ts`
- `apps/shell/apps/web/lib/server/control-plane/workspace/bootstrap.ts`
- `apps/shell/apps/web/lib/server/control-plane/workspace/launch.ts`
- `apps/shell/apps/web/app/(shell)/execution/workspace/[sessionId]/page.tsx`
- связанные тесты:
  - `workspace/mock.test.ts`
  - `workspace/[sessionId]/bootstrap/route.test.ts`
  - `workspace/[sessionId]/session/route.test.ts`
  - `workspace/[sessionId]/launch-token/route.test.ts`

## C.3 Что именно сделать

### C.3.1 Перестать использовать mock naming на реальном launch path

Сейчас есть:

- `buildMockWorkspaceLaunchSessionContext(...)`
- `buildMockWorkspaceLaunchViewModel(...)`

Если они реально читают live control-plane state, их нужно **развести по смыслу**.

### Требуемое изменение

Создать live-функции:

```ts
export async function buildWorkspaceLaunchSessionContext(
  sessionId: string,
  routeScope?: Partial<ShellRouteScope> | null,
  openedFrom?: WorkspaceLaunchSessionContext["openedFrom"]
): Promise<WorkspaceLaunchSessionContext>
```

```ts
export async function buildWorkspaceLaunchViewModelForSession(
  sessionId: string,
  routeScope?: Partial<ShellRouteScope> | null,
  options?: { openedFrom?: WorkspaceLaunchSessionContext["openedFrom"] }
): Promise<WorkspaceLaunchViewModel>
```

Можно:

- переиспользовать текущую логику из `mock.ts`;
- но убрать слово `mock` из live-path API;
- оставить mock helpers только для явных fixture/demo веток.

### C.3.2 Обновить shell workspace page

В файле:

- `app/(shell)/execution/workspace/[sessionId]/page.tsx`

заменить:

```ts
import { buildMockWorkspaceLaunchViewModel } from ...
```

на live builder.

### C.3.3 Обновить bootstrap builder

Сейчас:

- `buildWorkspaceLaunchBootstrap(...)`
- использует `buildMockWorkspaceLaunchSessionContext(...)`

Нужно перевести на live session context builder.

### C.3.4 Проверить session/session-bearer/launch-token tests

Если после переезда имен и live builder меняется wiring:

- обновить тесты так, чтобы они проверяли real live path;
- не ломать response shape.

## C.4 Acceptance criteria

1. `/execution/workspace/[sessionId]` больше не зависит от `buildMockWorkspaceLaunchViewModel`
2. bootstrap/session/token routes строятся от live session context
3. в critical shell launch path больше нет mock-named seams

---

# Пакет D — переписать embedded auth flow в `work-ui`, чтобы он не ломался на legacy `localStorage.token`

## D.1 Цель

Если workspace открывается shell’ом в embedded режиме, он должен:

1. проверить launch token;
2. запросить shell bootstrap;
3. получить shell-issued embedded session;
4. только потом продолжать обычный app boot.

Он не должен раньше времени:

- падать в `/auth`
- ходить в API через старый `8080`
- читать токен, которого ещё нет

## D.2 Какие файлы менять

- `apps/work-ui/src/routes/(app)/+layout.svelte`
- `apps/work-ui/src/lib/founderos/launch.ts`
- `apps/work-ui/src/lib/founderos/bootstrap.ts`
- `apps/work-ui/src/lib/founderos/index.ts`
- `apps/work-ui/src/lib/constants.ts`
- при необходимости создать новый helper, например:
  - `apps/work-ui/src/lib/founderos/api-base.ts`
  - `apps/work-ui/src/lib/founderos/session.ts`

## D.3 Что сделать в `+layout.svelte`

### D.3.1 Явно изолировать embedded bootstrap path

Сейчас там смешаны:

- FounderOS launch validation
- bootstrap/session exchange
- legacy Open WebUI auth flow
- ранние вызовы `getUserSettings(localStorage.token)`
- ранние вызовы `getModels(localStorage.token)`

Нужно сделать отдельный явный path:

```ts
if ($founderosLaunchContext.enabled) {
  // verify launch
  // fetch bootstrap
  // exchange session
  // seed token/session/user
  // only then continue app boot
}
```

### D.3.2 Не дёргать legacy API до успешного session exchange

До момента, пока shell-issued session token не получен и не сохранён, запрещено вызывать:

- `getUserSettings(localStorage.token)`
- `getModels(localStorage.token)`
- `getTerminalServers(localStorage.token)`
- `getBanners(localStorage.token)`
- `getTools(localStorage.token)`

Потому что в embedded path токен ещё может не существовать.

### D.3.3 Явно записывать shell-issued session token

После `exchangeFounderosLaunchSession(...)` нужно:

- записать session token туда, где его ждёт текущий app boot;
- синхронно обновить `user` store;
- при необходимости установить `localStorage.token` и/или session store так, чтобы legacy paths не развалились.

Если текущая архитектура всё ещё жёстко завязана на `localStorage.token`, минимально допустимо:

- использовать именно `localStorage.token` как compatibility seam;
- но обязательно отметить это как compatibility path, а не новый canonical design.

### D.3.4 Не делать silent fallback в standalone, если embedded launch invalid

Если launch verification или bootstrap/session exchange не проходят:

- не надо “тихо притворяться standalone режимом”;
- нужно показывать корректную embedded error state;
- fallback в `/auth` допустим только если это осознанно разрешено для non-embedded режима.

## D.4 Что добавить/выделить в helper modules

Рекомендуется вынести:

```ts
export const resolveEmbeddedApiBaseUrl = (...) => ...
export const seedEmbeddedSessionToken = (...) => ...
export const isFounderosEmbeddedModeReady = (...) => ...
```

## D.5 Acceptance criteria

1. В embedded mode workspace больше не ломается из-за раннего `localStorage.token`
2. `verify -> bootstrap -> session exchange` проходит последовательно
3. embedded mode не уходит в `/auth` при корректном shell launch
4. legacy `8080` не используется как implicit API base для FounderOS embedded path

---

# Пакет E — привести shell boards к live semantics и убрать placeholder/mock-first смысл

## E.1 Цель

Control-plane surfaces должны либо:

- реально отражать live durable state;
- либо быть честно помечены как non-release route.

Для release-critical path второй вариант не подходит.

## E.2 Какие файлы менять

- `apps/shell/apps/web/app/(shell)/execution/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/accounts/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/groups/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/approvals/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/recoveries/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/review/page.tsx`
- `apps/shell/apps/web/lib/server/control-plane/accounts/mock.ts`
- `apps/shell/apps/web/lib/server/control-plane/approvals/mock.ts`
- `apps/shell/apps/web/lib/server/control-plane/recoveries/mock.ts`
- `apps/shell/apps/web/lib/server/control-plane/sessions/*`

## E.3 Что именно нужно сделать

### E.3.1 Слой функций переименовать по смыслу

Если функции реально читают live file-backed/postgres-backed control-plane truth, то они не должны называться `mock*`.

### Минимальный rename plan

Сейчас:

- `listMockAccounts`
- `buildMockApprovalRequestsDirectory`
- `buildMockRecoveryIncidentsDirectory`
- `buildMockWorkspaceLaunchViewModel`

Нужно перейти к именам типа:

- `listControlPlaneAccounts`
- `buildApprovalRequestsDirectory`
- `buildRecoveryIncidentsDirectory`
- `buildWorkspaceLaunchViewModelForSession`

### Важно

Если переименование слишком объёмно для одной итерации:

1. сначала сделать новые live-имена как thin wrappers;
2. перевести release-critical call sites;
3. потом удалить старые mock-имена.

### E.3.2 `execution/page.tsx`

Заменить imports и использовать live naming.

Если какие-то данные всё ещё file-backed — это допустимо для local durable mode, **если это реально writable/readable truth**, а не demo fixture.

### E.3.3 `accounts/page.tsx`

Сейчас он использует `listMockAccounts()`.

Нужно:

- перевести на live semantic function;
- убедиться, что page отражает actual capacity model, а не placeholder wording.

### E.3.4 `groups/page.tsx`

Сейчас описание прямо говорит:

> mock aggregates and scoped deep links

Это надо убрать.

Нужно:

- либо реально строить группы из session projections по `groupId`;
- либо снять route с release-critical surface.

Для текущего ТЗ нужно именно **сделать реальную группировку**.

### E.3.5 `approvals/page.tsx` и `recoveries/page.tsx`

Перевести на live-named builders.

### E.3.6 `review/page.tsx`

Это сейчас placeholder route. Его нужно заменить на реальный review surface.

Минимально допустимая реализация:

- route показывает:
  - latest initiative ready for review;
  - associated assembly;
  - latest verification;
  - delivery readiness;
  - deep links в task graph / batch / continuity / workspace.

То есть не “beautiful placeholder”, а реальный review-first control surface.

Если полноценный review lane слишком большой для одной итерации, допустимо:

- собрать его как read-only shell surface над real orchestration data;
- но placeholder route должен исчезнуть.

## E.4 Acceptance criteria

1. На release-critical shell surfaces больше нет placeholder UI
2. mock-named helpers removed from critical imports
3. groups route больше не описывает себя как mock aggregate
4. review route показывает реальные orchestration objects

---

# Пакет F — исправить lifecycle: `approved brief` не должен автоматически означать `planner launched`

## F.1 Цель

Сейчас backend слишком рано смешивает:

- brief approval
- planner launch
- task graph creation
- initiative transition to `planning`

Это нужно развести.

## F.2 Правильная целевая lifecycle-модель

### Initiative

1. `clarifying`
2. `brief_ready`
3. `planning`
4. `running`
5. `assembly`
6. `verifying`
7. `ready`

### Обязательное правило

`approved brief` => `initiative.status = "brief_ready"`  
но **не** auto-create graph.

Planner должен запускаться explicit action.

## F.3 Какие файлы менять

- `apps/shell/apps/web/lib/server/orchestration/briefs.ts`
- `apps/shell/apps/web/lib/server/orchestration/task-graphs.ts`
- `apps/work-ui/src/routes/(app)/project-brief/[id]/+page.svelte`
- route tests:
  - `app/api/control/orchestration/briefs/route.test.ts`
  - `app/api/control/orchestration/task-graphs/route.test.ts`

## F.4 Что именно поменять

### F.4.1 `briefs.ts`

Сейчас:

- `createOrchestrationBrief(...)`
- `updateOrchestrationBrief(...)`

могут сразу тащить за собой `ensureTaskGraphForApprovedBrief(...)`.

Это нужно убрать из auto side-effect path.

### Требование

При `status === "approved"`:

- обновить brief;
- перевести initiative в `brief_ready`;
- **не** создавать task graph автоматически.

### F.4.2 `task-graphs.ts`

`createTaskGraphFromBrief(...)` / explicit planner launch endpoint должны стать единственным местом, где:

1. создаётся task graph;
2. materializeятся work units;
3. initiative переходит в `planning`.

### F.4.3 `project-brief/[id]/+page.svelte`

У UI уже есть:

- `Approve brief`
- `Launch planner`

Это хорошо. Нужно лишь синхронизировать backend semantics с этим UI.

После approval:

- taskGraph должен быть `null`, пока не нажали `Launch planner`
- sidebar должен честно показывать “No task graph is attached yet”

После `Launch planner`:

- появляется task graph;
- initiative status становится `planning`

## F.5 Acceptance criteria

1. Approval не создаёт task graph автоматически
2. Planner launch создаёт task graph explicit action’ом
3. Тест `brief_ready` больше не падает из-за premature `planning`

---

# Пакет G — заменить template planner на real deterministic decomposition

## G.1 Цель

Текущий planner строит фиксированный 3-node graph:

- foundation
- shell
- work-ui

Это слишком примитивно.

Нужен rule-based deterministic planner, который учитывает реальное содержание brief.

## G.2 Какие файлы менять

- `apps/shell/apps/web/lib/server/orchestration/planner.ts`
- `apps/shell/apps/web/lib/server/orchestration/task-graphs.ts`
- tests:
  - `task-graphs/route.test.ts`
  - при необходимости work-ui planner-launch tests

## G.3 Что именно реализовать

### G.3.1 Добавить явный decomposition слой

В `planner.ts` добавить helper-функции типа:

```ts
type PlannerWorkstream =
  | "topology_frontdoor"
  | "workspace_launch"
  | "control_plane_data"
  | "orchestration_flow"
  | "runtime_kernel"
  | "qa_release_gate"
  | "shell_ui"
  | "work_ui";
```

```ts
function derivePlannerWorkstreams(brief: ProjectBriefRecord): PlannerWorkstream[] { ... }
function deriveScopeBuckets(brief: ProjectBriefRecord): { shell: string[]; workUi: string[]; services: string[]; shared: string[] } { ... }
function buildWorkUnitsForWorkstreams(...): WorkUnitRecord[] { ... }
function buildTaskGraphEdges(workUnits: WorkUnitRecord[]): TaskGraphEdge[] { ... }
```

### G.3.2 Минимальный набор work units

Для release hardening planner обязан уметь строить work units хотя бы для:

1. frontdoor/topology
2. workspace launch/bootstrap/auth
3. shell control-plane truth cleanup
4. orchestration lifecycle
5. assembly/verification/delivery
6. QA/release validation

Даже если конкретный brief не упоминает эти слова напрямую, planner должен уметь выводить их из:

- goals
- acceptance criteria
- repoScope
- deliverables

### G.3.3 Детерминизм

Одна и та же brief fixture должна всегда давать один и тот же task graph.

### G.3.4 Не тащить LLM в обязательную planner core logic

Для MVP/repair pass planner должен оставаться deterministic и testable.

LLM-assisted enrichment допустим позже, но не как единственный механизм.

## G.4 Acceptance criteria

1. Planner больше не ограничен фиксированными 3 work units
2. Graph зависит от brief contents
3. Task graph детерминирован
4. Tests покрывают минимум 2–3 различные brief shapes

---

# Пакет H — довести `project-run` / `project-result` до реальной операционной ценности

## H.1 Цель

Сейчас:

- `project-run` и `project-result` рендерят orchestration objects,
- но underlying logic всё ещё во многом synthetic.

Нужно сделать так, чтобы эти страницы отражали реальные execution semantics.

## H.2 Какие файлы менять

- `apps/work-ui/src/routes/(app)/project-run/[id]/+page.svelte`
- `apps/work-ui/src/routes/(app)/project-result/[id]/+page.svelte`
- `apps/work-ui/src/lib/orchestration/execution-gates.ts`
- `apps/work-ui/src/lib/orchestration/project-result.ts`
- shell orchestration services:
  - `assembly.ts`
  - `verification.ts`
  - `delivery.ts`

## H.3 Что именно сделать

### H.3.1 `execution-gates.ts`

Сейчас `canCreateAssembly(taskGraph)` проверяет только:

```ts
taskGraph?.status === 'completed'
```

Этого мало.

Нужно сделать gate более строгим:

```ts
canCreateAssembly(taskGraph, batchProgress, workUnits?)
```

или equivalent server-side-enforced logic:

- taskGraph completed
- latest batch completed
- все work units completed
- у work units есть valid attempt/artifact linkage

### H.3.2 `project-run/[id]/+page.svelte`

Если task graph или batch ещё не готовы:

- страница должна честно показывать блокирующую причину;
- не притворяться, что assembly просто “ещё не нажали”.

Если batch blocked/failed:

- основной CTA должен вести в shell remediation path;
- копия UI должна явно говорить, что нужен operator intervention.

### H.3.3 `project-result/[id]/+page.svelte`

Страница должна показывать:

- verification checks;
- delivery status;
- реальный assembly manifest / outputs;
- continuity links.

Если verification failed:

- страница должна показывать не только `failed`, но и какие конкретные checks завалились.

---

# Пакет I — сделать `assembly`, `verification`, `delivery` не синтетическими

## I.1 `assembly.ts`

### Текущая проблема

`artifactUris` строятся как:

- `attempt://attempt-id`

и output location — локальный путь вида:

- `.local-state/assemblies/<initiativeId>`

без реального manifest-а.

### Что нужно сделать

Добавить явный assembly manifest.

Рекомендуемый артефакт:

- `.local-state/assemblies/<initiativeId>/assembly-manifest.json`

Структура manifest должна включать:

- initiativeId
- taskGraphId
- workUnitIds
- attemptIds
- artifact files / URIs
- generatedAt
- source summaries
- verification prerequisites

### Новая функция

```ts
function buildAssemblyManifest(...)
```

### Новая ответственность `createAssembly(...)`

1. собрать актуальные completed work units
2. извлечь реальные attempt outputs
3. сохранить manifest
4. записать assembly record, который ссылается на manifest

## I.2 `verification.ts`

### Текущая проблема

Verifier проверяет только structural consistency.

### Что нужно сделать

Минимально required checks:

1. `assembly_present`
2. `work_units_completed`
3. `assembly_matches_task_graph`
4. `artifact_manifest_complete`
5. `static_checks_passed`
6. `targeted_tests_passed`

### Как это реализовать

Допустимы два шага:

#### Шаг 1 — storage/model layer

Расширить `VerificationCheck.details`, чтобы там были:

- command
- exitCode
- stdoutSnippet / stderrSnippet
- artifact path

#### Шаг 2 — execution layer

Verification path должен запускать validators либо:

- напрямую;
- либо через orchestration/kernal-side execution worker;
- либо через отдельный validation helper.

### Минимально допустимые команды для текущей кодовой базы

- `npm run shell:typecheck`
- `npm run work-ui:check`
- `go test ./...` inside `services/execution-kernel`

Если нужны более узкие targeted tests — добавлять по impacted zone.

## I.3 `delivery.ts`

### Текущая проблема

Delivery сейчас = local path + `open`.

### Что нужно сделать

Delivery record должен содержать:

- verificationRunId
- taskGraphId
- resultSummary
- localOutputPath
- manifestPath
- previewUrl (если есть)
- handoffNotes
- command (можно оставить как дополнительное convenience поле)

### Новая функция

```ts
function buildDeliveryManifest(...)
```

### Ключевое правило

Delivery создаётся только после passed verification.

---

# Пакет J — сделать `execution-kernel` restart-safe и durable

## J.1 Цель

`services/execution-kernel` не должен оставаться purely in-memory.

## J.2 Какие файлы менять

- `services/execution-kernel/internal/service/service.go`
- `services/execution-kernel/internal/handler/http.go`
- добавить storage layer, например:
  - `internal/store/store.go`
  - `internal/store/file_store.go`
  - или `sqlite_store.go`

## J.3 Что именно сделать

### J.3.1 Вынести persistence из `InMemory`

Создать интерфейс вида:

```go
type Store interface {
  SaveBatch(ctx context.Context, batch events.BatchRecord, attempts []events.AttemptRecord) error
  GetBatch(ctx context.Context, batchID string) (events.BatchRecord, []events.AttemptRecord, error)
  GetAttempt(ctx context.Context, attemptID string) (events.AttemptRecord, error)
  UpdateAttempt(ctx context.Context, attempt events.AttemptRecord) error
  UpdateBatch(ctx context.Context, batch events.BatchRecord) error
}
```

### J.3.2 Refactor service

`InMemory` можно оставить только как test helper.  
Production/default service должен использовать persistent store.

### J.3.3 Обязательное поведение

1. LaunchBatch persist'ит batch + attempts до ответа клиенту
2. CompleteAttempt / FailAttempt обновляют persisted state
3. restart сервиса не обнуляет batches/attempts

### J.3.4 Test coverage

Добавить Go tests на:

- launch + reload + read batch
- fail attempt + restart + read blocked batch
- complete all attempts + restart + batch remains completed

## J.4 Acceptance criteria

1. kernel больше не purely in-memory
2. batch/attempt survive restart
3. handler HTTP читает persisted state

---

# Пакет K — привести approvals / recoveries / accounts к operator-grade semantics

## K.1 Что уже неплохо

Текущие approvals/recoveries helpers уже умеют читать state/postgres и писать operator actions.

То есть проблема не в полном отсутствии логики, а в том, что critical path всё ещё окружён mock naming и неполным release wiring.

## K.2 Какие файлы менять

- `apps/shell/apps/web/lib/server/control-plane/approvals/mock.ts`
- `apps/shell/apps/web/lib/server/control-plane/recoveries/mock.ts`
- `apps/shell/apps/web/lib/server/control-plane/accounts/mock.ts`
- call sites в pages и API surfaces

## K.3 Что именно нужно сделать

### K.3.1 Rename semantics

Сделать live-named exports:

```ts
export async function listApprovalRequests() ...
export async function buildApprovalRequestsDirectory() ...
export async function respondToApprovalRequest() ...

export async function listRecoveryIncidents() ...
export async function buildRecoveryIncidentsDirectory() ...
export async function applyRecoveryAction() ...

export async function listControlPlaneAccounts() ...
export async function findControlPlaneAccount() ...
```

Можно временно оставить старые mock exports как aliases, но critical pages/routes должны перейти на новые имена.

### K.3.2 Accounts board

Убедиться, что board показывает:

- authMode
- provider
- quota source
- pressure
- schedulable
- preferredForNewSessions

и не скрывает, какая truth модель реально используется.

### K.3.3 Approvals / recoveries roundtrip

Shell and workspace должны видеть согласованный state после:

- approval
- deny
- retry
- failover

Для этого runtime ingest + operator action routes должны быть проверены end-to-end.

---

# Пакет L — привести `integrationState` / `storageKind` semantics к честному виду

## L.1 Текущая проблема

`state/store.ts` различает:

- `postgres`
- `mock_file_backed`
- `mock_in_memory`

Но для local durable mode слово `mock` создаёт ложное ощущение, что это не настоящая истина.

## L.2 Что делать

Есть два допустимых пути.

### Путь 1 — минимально инвазивный

Оставить enum как есть, но:

- убрать `mock` wording из release-critical UI copy;
- убрать `mock` naming из функций и routes;
- считать file-backed mode допустимой local durable truth.

### Путь 2 — более правильный

Поменять storageKind semantics на:

- `postgres`
- `file_backed`
- `in_memory`

и мигрировать call sites.

### Рекомендация для этой итерации

Сделать **Путь 1**, если Путь 2 слишком большой.  
Главное — убрать mock-semantics с critical implementation surface.

---

# Пакет M — исправить test harness и release validation

## M.1 Work UI tests

### Текущая проблема

`apps/work-ui/package.json`

```json
"test:frontend": "vitest --passWithNoTests"
```

Это режим наблюдения, а не завершение команды.

### Что сделать

Заменить scripts на что-то вроде:

```json
"test:frontend": "vitest",
"test:frontend:ci": "vitest run --passWithNoTests"
```

И root `package.json`:

```json
"work-ui:test": "npm run test:frontend:ci --workspace open-webui"
```

## M.2 Alias resolution

Если direct monorepo run по-прежнему ломает `$lib` alias:

1. добавить `apps/work-ui/vitest.config.ts`
2. использовать `defineConfig` + svelte/vite aliases
3. либо зафиксировать, что canonical validation route для work-ui всегда идёт через workspace-local script

Минимально допустимый результат:

- CI-safe `work-ui:test` завершается успешно и не висит.

## M.3 Shell tests

### Конкретные известные drift points

1. brief lifecycle:
   - test ожидает `brief_ready`
   - код даёт `planning`
2. launch token verification/session exchange:
   - test иногда/где-то давал `accepted=false`

### Что сделать

#### Для briefs

Исправить lifecycle semantics, как описано в Пакете F.

#### Для launch/session tests

Проверить:

- одинаковый secret source во время mint и verify;
- очистку env между тестами;
- отсутствие случайного strict env влияния;
- отсутствие stale sessionId/projectId mismatch.

При необходимости в тестах:

- явно сбрасывать relevant env;
- использовать deterministic `now`;
- изолировать state dir.

## M.4 Обязательный validation matrix

После каждой существенной реализации гонять минимум:

### Shell

- `npm run shell:typecheck`
- `npm run shell:test`

### Work UI

- `npm run work-ui:check`
- `npm run work-ui:test`

### Kernel

- `cd services/execution-kernel && go test ./...`

### E2E / happy path

- `python3 scripts/validation/run_infinity_validation.py`

или `--skip-static-checks` для быстрых прогонов между большими этапами.

---

## 6. Подробный rename map

Ниже обязательный rename map для семантической очистки critical path.

| Текущее имя | Новое имя | Где |
|---|---|---|
| `buildMockWorkspaceLaunchSessionContext` | `buildWorkspaceLaunchSessionContext` | `workspace/mock.ts` → new live module |
| `buildMockWorkspaceLaunchViewModel` | `buildWorkspaceLaunchViewModelForSession` | shell workspace launch |
| `listMockAccounts` | `listControlPlaneAccounts` | accounts layer |
| `findMockAccount` | `findControlPlaneAccount` | accounts layer |
| `buildMockApprovalRequestsDirectory` | `buildApprovalRequestsDirectory` | approvals layer |
| `findMockApprovalRequest` | `findApprovalRequest` | approvals layer |
| `respondToMockApprovalRequest` | `respondToApprovalRequest` | approvals layer |
| `buildMockRecoveryIncidentsDirectory` | `buildRecoveryIncidentsDirectory` | recoveries layer |
| `findMockRecoveryIncident` | `findRecoveryIncident` | recoveries layer |

Если полное rename слишком широко ломает imports:

1. добавить новые имена;
2. перевести release-critical call sites;
3. оставить старые как temporary aliases;
4. удалить aliases в отдельной cleanup-задаче.

---

## 7. Точный список release-critical call sites, которые нельзя оставлять как есть

Обязательно исправить следующие места:

### Shell

- `apps/shell/apps/web/app/(shell)/execution/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/review/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/accounts/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/groups/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/approvals/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/recoveries/page.tsx`
- `apps/shell/apps/web/app/(shell)/execution/workspace/[sessionId]/page.tsx`
- `apps/shell/apps/web/lib/server/control-plane/workspace/bootstrap.ts`
- `apps/shell/apps/web/lib/server/control-plane/workspace/launch.ts`
- `apps/shell/apps/web/lib/server/orchestration/briefs.ts`
- `apps/shell/apps/web/lib/server/orchestration/task-graphs.ts`
- `apps/shell/apps/web/lib/server/orchestration/planner.ts`
- `apps/shell/apps/web/lib/server/orchestration/assembly.ts`
- `apps/shell/apps/web/lib/server/orchestration/verification.ts`
- `apps/shell/apps/web/lib/server/orchestration/delivery.ts`

### Work UI

- `apps/work-ui/src/routes/(app)/+layout.svelte`
- `apps/work-ui/src/lib/constants.ts`
- `apps/work-ui/src/lib/founderos/shell-origin.ts`
- `apps/work-ui/src/lib/founderos/launch.ts`
- `apps/work-ui/src/lib/founderos/bootstrap.ts`
- `apps/work-ui/src/routes/(app)/project-brief/[id]/+page.svelte`
- `apps/work-ui/src/lib/orchestration/planner-launch.ts`
- `apps/work-ui/src/lib/orchestration/execution-gates.ts`

### Kernel

- `services/execution-kernel/internal/service/service.go`
- `services/execution-kernel/internal/handler/http.go`

---

## 8. Что можно оставить “потом”, а что нельзя

### Нельзя оставлять “потом”

1. root `/`
2. shell/workspace origin mismatch
3. rollout ready=false
4. workspace launch on mock-named path
5. brief approval auto-planner drift
6. work-ui embedded auth breakage
7. work-ui test watch-mode

### Можно оставить на следующую итерацию, если core flow уже жив

1. визуальный polish review lane
2. bundle/chunk optimization
3. secondary UX niceties
4. deeper performance cleanup

---

## 9. Обязательный финальный end-to-end сценарий

Нельзя объявлять задачу завершённой, пока не проходит следующий путь:

1. открыть `/`
2. попасть в shell-owned frontdoor
3. перейти в project intake
4. создать initiative
5. создать/обновить brief
6. approve brief
7. убедиться, что initiative = `brief_ready`, а не `planning`
8. нажать `Launch planner`
9. получить task graph
10. перейти в run
11. получить batch progress / runtime truth
12. открыть workspace из shell
13. пройти verify/bootstrap/session exchange
14. увидеть embedded workspace без auth collapse
15. создать assembly
16. запустить verification
17. создать delivery
18. reload/reopen страницы и убедиться, что state не исчез

Если этот сценарий не проходит — status задачи не `done`.

---

## 10. Команды, которыми исполнитель обязан проверять результат

Минимум:

```bash
npm --prefix "/Users/martin/infinity" run shell:typecheck
npm --prefix "/Users/martin/infinity" run shell:test
npm --prefix "/Users/martin/infinity" run work-ui:check
npm --prefix "/Users/martin/infinity" run work-ui:test
cd "/Users/martin/infinity/services/execution-kernel" && go test ./...
python3 "/Users/martin/infinity/scripts/validation/run_infinity_validation.py" --skip-static-checks
```

Перед финализацией — полный:

```bash
python3 "/Users/martin/infinity/scripts/validation/run_infinity_validation.py"
```

---

## 11. Очень короткий operational summary

Если исполнитель не может держать весь документ в голове, он обязан помнить хотя бы это:

1. Создай shell-owned `/`.
2. Убери рассинхрон `3737/5173/3101/8080`.
3. Переведи shell workspace launch с mock path на live path.
4. Изолируй embedded auth flow в `work-ui`.
5. Разведи `brief approved` и `planner launched`.
6. Сделай planner не шаблонным, а brief-driven.
7. Перестань выдавать synthetic assembly/verification/delivery за готовую систему.
8. Сделай kernel restart-safe.
9. Почини `work-ui:test` и release validation.
10. Не объявляй done, пока не пройдён реальный end-to-end сценарий.
